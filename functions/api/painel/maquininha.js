import {json,fail,readJson,now,cleanText} from "../../_lib/http.js";
import {requireTenant} from "../../_lib/auth.js";
import {PROVIDERS,publicProviders,lojaDisponivel,getTerminal,sealCreds,openCreds,freshCreds,mask,adapterOf,checkAdmin,mpOAuthReady,GatewayError} from "../../_lib/terminals.js";
// Configuração da maquininha de cartão de UMA loja (Área ADM). O tenant vem sempre da sessão; a loja, do nº informado.
// As credenciais são gravadas cifradas e nunca voltam para o navegador (só o final mascarado dos campos secretos).

const view=t=>{if(!t)return null;let hint={};try{hint=JSON.parse(t.credentials_hint||"{}")}catch{}
 return {provider:t.provider,provider_label:PROVIDERS[t.provider]?.label||t.provider,ready:!!PROVIDERS[t.provider]?.ready,device_id:t.device_id||"",device_label:t.device_label||"",active:!!t.active,hint,oauth:!!hint.oauth,mp_user:hint.mp_user||"",updated_at:t.updated_at}};

export async function onRequestGet(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const L=await lojaDisponivel(c.env,a.tenant,new URL(c.request.url).searchParams.get("loja"));if(L.error)return fail(L.error,403);
 return json({ok:true,loja:L.n,oauth_available:mpOAuthReady(c.env),providers:publicProviders(c.env),config:view(await getTerminal(c.env,a.tenant.id,L.n))});
}

export async function onRequestPost(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const b=await readJson(c.request)||{},t=a.tenant,D=c.env.DB;
 const L=await lojaDisponivel(c.env,t,b.loja);if(L.error)return fail(L.error,403);
 const cur=await getTerminal(c.env,t.id,L.n);

 // Listar maquininhas da conta do gateway (usa o token digitado ou o já salvo/conectado) e ativar modo PDV.
 if(b.action==="devices"||b.action==="pdv"||b.action==="standalone"){
  const provider=String(b.provider||cur?.provider||"");const ad=adapterOf(provider);
  if(!ad?.devices)return fail("Este provedor não permite listar maquininhas pelo sistema. Digite o serial manualmente.",400);
  try{
   let creds=cur&&cur.provider===provider?await freshCreds(c.env,cur,await openCreds(c.env,cur.credentials_enc)||{}):{};
   const typed=String(b.fields?.access_token||"").trim();if(typed)creds={access_token:typed};
   if(b.action==="pdv"){const id=cleanText(b.device_id,120);if(!id)return fail("Informe a maquininha.");await ad.setPdv(creds,id);return json({ok:true})}
   if(b.action==="standalone"){if(!ad.setStandalone)return fail("Este provedor não permite mudar o modo pelo sistema.",400);const id=cleanText(b.device_id,120);if(!id)return fail("Informe a maquininha.");await ad.setStandalone(creds,id);return json({ok:true})}
   return json({ok:true,devices:await ad.devices(creds)});
  }catch(e){return fail(e instanceof GatewayError?e.message:"Falha ao consultar o provedor.",e.status||502)}
 }

 // Alterar ou remover credenciais exige a senha do ADM (mesma regra de /api/tenant/stores).
 if(!await checkAdmin(c.env,t.id,b.admin_password))return fail("Senha do ADM incorreta. Nenhuma alteração foi realizada.",403);

 if(b.action==="remove"){
  await D.prepare("DELETE FROM store_payment_terminals WHERE tenant_id=? AND loja=?").bind(t.id,L.n).run();
  return json({ok:true,config:null});
 }
 if(b.action!=="save")return fail("Ação inválida.");

 const provider=String(b.provider||"");const P=PROVIDERS[provider];if(!P)return fail("Escolha o provedor da maquininha.");
 const device=cleanText(b.device_id,120);if(!device)return fail(`Informe o ${P.device.l.toLowerCase()}.`);
 // Mesmo provedor: campos secretos em branco mantêm o que já está salvo (inclusive a conexão via "Conectar com Mercado Pago").
 const old=cur&&cur.provider===provider?await openCreds(c.env,cur.credentials_enc)||{}:{};
 let oldHint={};try{oldHint=cur&&cur.provider===provider?JSON.parse(cur.credentials_hint||"{}"):{}}catch{}
 let creds={...old},hint={...oldHint};
 for(const f of P.fields){
  const v=String(b.fields?.[f.k]??"").trim().slice(0,400);
  if(v){
   if(/[\s<>]/.test(v))return fail(`O campo “${f.l}” tem caracteres inválidos.`);
   if(f.k==="access_token"&&old.oauth){creds={};hint={}} // token colado manualmente substitui a conexão automática
   creds[f.k]=v;hint[f.k]=f.secret?mask(v):v;
  }else if(!creds[f.k])return fail(`Preencha o campo “${f.l}”${P.oauth&&mpOAuthReady(c.env)?" ou use “Conectar com Mercado Pago”":""}.`);
 }
 const sealed=await sealCreds(c.env,creds),label=cleanText(b.device_label,40)||null,active=b.active===false?0:1,ts=now();
 await D.prepare("INSERT INTO store_payment_terminals(tenant_id,loja,provider,credentials_enc,credentials_hint,device_id,device_label,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(tenant_id,loja) DO UPDATE SET provider=excluded.provider,credentials_enc=excluded.credentials_enc,credentials_hint=excluded.credentials_hint,device_id=excluded.device_id,device_label=excluded.device_label,active=excluded.active,updated_at=excluded.updated_at")
  .bind(t.id,L.n,provider,sealed,JSON.stringify(hint),device,label,active,ts,ts).run();
 return json({ok:true,config:view(await getTerminal(c.env,t.id,L.n))});
}
