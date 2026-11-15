// Maquininhas de cartão físicas por loja (conta + nº da loja, igual a store_links).
// Cada provedor é um "adaptador" com a mesma interface: create / status / cancel (+ devices / setPdv quando existir).
// Para ativar Stone ou Ton basta implementar o adaptador e marcar ready:true — o resto do sistema já está pronto.
import {b64u,unb64u} from "./http.js";
import {secretOf,storeLimit,passwordHash} from "./auth.js";
import {lojaN} from "./publico.js";

const enc=new TextEncoder();

/* ---------- Cifra das credenciais (AES-GCM) ----------
   Chave derivada de TERMINALS_SECRET (recomendado) ou, na falta dele, de SESSION_SECRET.
   Se o segredo mudar, as credenciais salvas deixam de abrir e precisam ser cadastradas de novo. */
async function credKey(env){return crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",enc.encode("nexus-terminal-enc:"+(env.TERMINALS_SECRET||secretOf(env)))),"AES-GCM",false,["encrypt","decrypt"])}
export async function sealCreds(env,obj){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},await credKey(env),enc.encode(JSON.stringify(obj||{})));
 return b64u(iv)+"."+b64u(ct);
}
export async function openCreds(env,stored){
 try{const [iv,ct]=String(stored||"").split(".");return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64u(iv)},await credKey(env),unb64u(ct))))}
 catch{return null}
}
export const mask=v=>{v=String(v||"");return v?"••••"+v.slice(-4):""};

/* ---------- Catálogo de provedores (fonte única: o front monta o formulário a partir daqui) ---------- */
export const PROVIDERS={
 mercadopago_point:{
  label:"Mercado Pago Point",ready:true,oauth:true,
  fields:[{k:"access_token",l:"Access Token (produção)",secret:true,ph:"APP_USR-..."}],
  device:{l:"Terminal ID da maquininha",ph:"Toque em “Buscar maquininhas” para preencher"},
  help:"A maquininha precisa estar vinculada à mesma conta do Mercado Pago e em modo PDV. Use “Buscar maquininhas” para listar e ativar o modo PDV."
 },
 stone:{
  label:"Stone",ready:false,
  fields:[{k:"client_id",l:"Client ID",ph:""},{k:"api_key",l:"API Key / Client Secret",secret:true,ph:""},{k:"stone_code",l:"Stone Code",ph:""}],
  device:{l:"Serial da maquininha",ph:"Número de série (etiqueta traseira)"},
  help:"Integração Stone em preparação: as credenciais já podem ser salvas, a cobrança será liberada quando a integração for ativada."
 },
 ton:{
  label:"Ton",ready:false,
  fields:[{k:"client_id",l:"Client ID",ph:""},{k:"api_key",l:"API Key",secret:true,ph:""}],
  device:{l:"Serial da maquininha",ph:"Número de série (etiqueta traseira)"},
  help:"Integração Ton em preparação: as credenciais já podem ser salvas, a cobrança será liberada quando a integração for ativada."
 }
};
export const publicProviders=env=>Object.entries(PROVIDERS).map(([id,p])=>({id,label:p.label,ready:p.ready,oauth:!!p.oauth&&mpOAuthReady(env),fields:p.fields,device:p.device,help:p.help}));

// Senha do ADM (a mesma do cadastro): obrigatória para alterar/conectar credenciais.
export async function checkAdmin(env,tid,pw){
 const cred=await env.DB.prepare("SELECT password_hash,password_salt FROM tenants WHERE id=?").bind(tid).first();
 return !!pw&&!!cred&&await passwordHash(String(pw),cred.password_salt)===cred.password_hash;
}

/* ---------- "Conectar com Mercado Pago" (OAuth authorization_code) ----------
   Uma única aplicação do Nexus Gestor no Mercado Pago (secrets MP_CLIENT_ID e MP_CLIENT_SECRET).
   Cada cliente autoriza com a própria conta; o token dele (e o refresh_token) fica cifrado na loja dele. */
export const mpOAuthReady=env=>!!(env.MP_CLIENT_ID&&env.MP_CLIENT_SECRET);
export const mpRedirectUri=(env,req)=>env.MP_REDIRECT_URI||new URL(req.url).origin+"/api/painel/mp-oauth/callback";
export const mpAuthUrl=(env,req,state)=>"https://auth.mercadopago.com.br/authorization?"+new URLSearchParams({client_id:env.MP_CLIENT_ID,response_type:"code",platform_id:"mp",state,redirect_uri:mpRedirectUri(env,req)});
async function mpToken(env,body){
 let r;try{r=await fetch("https://api.mercadopago.com/oauth/token",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({client_id:env.MP_CLIENT_ID,client_secret:env.MP_CLIENT_SECRET,...body})})}
 catch{throw new GatewayError("Não foi possível falar com o Mercado Pago.")}
 const j=await r.json().catch(()=>({}));
 if(!r.ok||!j.access_token)throw new GatewayError("O Mercado Pago não liberou o acesso"+(j.message||j.error?`: ${j.message||j.error}`:".")+" Tente conectar de novo.",400);
 return {oauth:1,access_token:j.access_token,refresh_token:j.refresh_token||"",expires_at:Date.now()+(Number(j.expires_in)||15552000)*1000,mp_user:String(j.user_id||"")};
}
export const mpExchangeCode=(env,req,code)=>mpToken(env,{grant_type:"authorization_code",code,redirect_uri:mpRedirectUri(env,req)});
// Renova o token conectado via OAuth quando faltar menos de 15 dias para vencer (o cliente não precisa fazer nada).
export async function freshCreds(env,term,creds){
 if(!creds?.oauth||!creds.refresh_token||Number(creds.expires_at)-Date.now()>15*864e5)return creds;
 try{
  const n={...creds,...await mpToken(env,{grant_type:"refresh_token",refresh_token:creds.refresh_token})};
  await env.DB.prepare("UPDATE store_payment_terminals SET credentials_enc=?,updated_at=? WHERE tenant_id=? AND loja=?").bind(await sealCreds(env,n),new Date().toISOString(),term.tenant_id,term.loja).run();
  return n;
 }catch(e){
  if(Number(creds.expires_at)>Date.now())return creds; // ainda vale: tenta renovar de novo na próxima cobrança
  throw new GatewayError("A conexão com o Mercado Pago expirou. Reconecte na Área ADM > Maquininhas de cartão.",400);
 }
}

/* ---------- Loja disponível para a conta (dentro do plano e ativada no ADM) ---------- */
export async function lojaDisponivel(env,t,v){
 const n=lojaN(v);
 if(n>await storeLimit(env,t))return {error:"Esta loja não está disponível no seu plano."};
 if(n>1){
  const g=await env.DB.prepare("SELECT data FROM registros WHERE store=? AND id='lojas' AND deleted=0").bind(t.id+"~global").first();
  let st=null;try{st=JSON.parse(g?.data||"{}").stores}catch{}
  if(Array.isArray(st)&&!st.some(x=>Number(x.n)===n))return {error:"Esta loja não está ativada."};
 }
 return {n};
}

export const getTerminal=(env,tid,n)=>env.DB.prepare("SELECT tenant_id,loja,provider,credentials_enc,credentials_hint,device_id,device_label,active,updated_at FROM store_payment_terminals WHERE tenant_id=? AND loja=?").bind(tid,n).first();

// Erro de negócio com mensagem pronta para o operador.
export class GatewayError extends Error{constructor(msg,status=502){super(msg);this.status=status}}

/* ---------- Mercado Pago Point (API de Orders: /v1/orders, type "point") ---------- */
const MP="https://api.mercadopago.com";
async function mpFetch(token,path,{method="GET",body,idem}={}){
 if(!token)throw new GatewayError("Access Token do Mercado Pago não configurado.",400);
 const h={"Authorization":"Bearer "+token,"Content-Type":"application/json"};
 if(idem)h["X-Idempotency-Key"]=idem;
 let r;
 try{r=await fetch(MP+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)})}
 catch{throw new GatewayError("Não foi possível falar com o Mercado Pago. Verifique a internet e tente de novo.")}
 const j=await r.json().catch(()=>({}));
 if(!r.ok){
  const code=String(j?.errors?.[0]?.code||j?.error||j?.code||""),det=String(j?.errors?.[0]?.message||j?.message||"");
  if(r.status===401)throw new GatewayError("Access Token do Mercado Pago inválido ou expirado.",400);
  if(r.status===403)throw new GatewayError("Esta maquininha não pertence à conta do Access Token informado.",400);
  if(r.status===409&&!/idempotency/.test(code))throw new GatewayError("A maquininha já tem uma cobrança em espera. Finalize ou cancele na maquininha e tente de novo.",409);
  if(r.status===404)throw new GatewayError("Maquininha ou cobrança não encontrada no Mercado Pago. Confira o Terminal ID.",404);
  throw new GatewayError("Mercado Pago recusou a requisição"+(det||code?`: ${det||code}`:"."),r.status>=500?502:400);
 }
 return j;
}
const MP_STATE={processed:"approved",refunded:"canceled",canceled:"canceled",expired:"canceled",failed:"rejected",created:"pending",at_terminal:"pending",action_required:"pending"};
const mpRead=o=>{
 const pay=o?.transactions?.payments?.[0]||{},raw=String(o?.status||"created");
 let state=MP_STATE[raw]||"pending";
 if(state==="approved"&&pay.status&&!["processed","approved","accredited"].includes(pay.status))state="pending";
 return {external_id:o?.id||null,provider_status:raw,state,detail:String(pay.status_detail||o?.status_detail||raw)};
};
const mercadopago_point={
 async create(creds,term,ch){
  const o=await mpFetch(creds.access_token,"/v1/orders",{method:"POST",idem:ch.id,body:{
   type:"point",external_reference:ch.id,expiration_time:"PT10M",description:ch.description||"Venda",
   transactions:{payments:[{amount:(ch.amount_cents/100).toFixed(2)}]},
   config:{point:{terminal_id:term.device_id,print_on_terminal:"no_ticket"},payment_method:{default_type:ch.method==="debito"?"debit_card":ch.method==="pix"?"qr":"credit_card"}}
  }});
  return mpRead(o);
 },
 async status(creds,ch){return mpRead(await mpFetch(creds.access_token,"/v1/orders/"+encodeURIComponent(ch.external_id)))},
 async cancel(creds,ch){
  const cur=mpRead(await mpFetch(creds.access_token,"/v1/orders/"+encodeURIComponent(ch.external_id)));
  if(cur.state!=="pending")return cur;
  if(cur.provider_status!=="created")throw new GatewayError("A cobrança já está na tela da maquininha: cancele direto na maquininha.",409);
  return mpRead(await mpFetch(creds.access_token,"/v1/orders/"+encodeURIComponent(ch.external_id)+"/cancel",{method:"POST",idem:ch.id+"-cancel"}));
 },
 async devices(creds){
  const j=await mpFetch(creds.access_token,"/terminals/v1/list?limit=50&offset=0");
  const list=j?.data?.terminals||j?.terminals||[];
  return list.map(x=>({id:String(x.id||""),mode:String(x.operating_mode||""),pos:String(x.external_pos_id||x.pos_id||"")})).filter(x=>x.id);
 },
 async setPdv(creds,deviceId){
  await mpFetch(creds.access_token,"/terminals/v1/setup",{method:"PATCH",body:{terminals:[{id:deviceId,operating_mode:"PDV"}]}});
  return true;
 },
 // Volta a maquininha ao modo normal (STANDALONE): ela cobra sozinha de novo e deixa de receber cobranças do sistema.
 async setStandalone(creds,deviceId){
  await mpFetch(creds.access_token,"/terminals/v1/setup",{method:"PATCH",body:{terminals:[{id:deviceId,operating_mode:"STANDALONE"}]}});
  return true;
 }
};

/* ---------- Pix online pelo Mercado Pago (QR na tela do Caixa, confirmação automática) ----------
   Usa a mesma conta conectada em "Maquininhas" (não precisa de maquininha). Taxa do Pix cobrada pelo Mercado Pago na conta da loja. */
const pixRead=p=>({id:String(p?.id||""),status:String(p?.status||"pending"),approved:p?.status==="approved",qr:p?.point_of_interaction?.transaction_data?.qr_code||"",amount:Number(p?.transaction_amount||0),detail:String(p?.status_detail||"")});
export async function mpPixCreate(creds,{amount,description,idem,email}){
 const exp=new Date(Date.now()+30*60000).toISOString().replace("Z","-00:00");
 const p=await mpFetch(creds.access_token,"/v1/payments",{method:"POST",idem,body:{transaction_amount:Number(amount.toFixed(2)),description:description||"Venda",payment_method_id:"pix",external_reference:idem,date_of_expiration:exp,payer:{email:email||"cliente@nexusgestor.com.br"}}});
 const r=pixRead(p);if(!r.qr)throw new GatewayError("O Mercado Pago não gerou o QR Code. Confira se a conta tem uma chave Pix cadastrada.",400);
 return r;
}
export const mpPixGet=async(creds,id)=>pixRead(await mpFetch(creds.access_token,"/v1/payments/"+encodeURIComponent(id)));
export async function mpPixCancel(creds,id){try{return pixRead(await mpFetch(creds.access_token,"/v1/payments/"+encodeURIComponent(id),{method:"PUT",body:{status:"cancelled"}}))}catch(e){return null}}

/* ---------- Stone / Ton: estrutura pronta, integração a implementar ---------- */
const pending=label=>{const no=()=>{throw new GatewayError(`A integração com ${label} ainda não está disponível. Use Mercado Pago Point por enquanto.`,501)};return {create:no,status:no,cancel:no}};
const ADAPTERS={mercadopago_point,stone:pending("Stone"),ton:pending("Ton")};
export const adapterOf=p=>ADAPTERS[p]||null;
