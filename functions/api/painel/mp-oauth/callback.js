import {now,getCookie,cookie} from "../../../_lib/http.js";
import {requireTenant,verifySession,secretOf} from "../../../_lib/auth.js";
import {lojaDisponivel,getTerminal,sealCreds,mask,mpOAuthReady,mpExchangeCode,GatewayError} from "../../../_lib/terminals.js";
// Retorno do Mercado Pago depois que o cliente autoriza. Troca o "code" pelo token da conta DELE e grava cifrado
// na loja (store_payment_terminals). Depois volta para o painel, que abre a escolha da maquininha.
const back=(c,q)=>new Response(null,{status:302,headers:{location:"/painel/?"+new URLSearchParams(q),"set-cookie":cookie("nexus_mpo","",{path:"/api/painel/mp-oauth",maxAge:0,secure:new URL(c.request.url).protocol==="https:"}),"cache-control":"no-store"}});
export async function onRequestGet(c){
 const u=new URL(c.request.url),err=m=>back(c,{mp:"erro",msg:m});
 if(u.searchParams.get("error"))return err("A autorização foi cancelada no Mercado Pago.");
 if(!mpOAuthReady(c.env))return err("Conexão automática com o Mercado Pago não configurada.");
 const st=await verifySession(u.searchParams.get("state"),secretOf(c.env));
 if(!st||st.k!=="mpo")return err("Link de conexão inválido ou vencido. Tente conectar de novo.");
 const a=await requireTenant(c);if(a.error)return err("Entre no painel com a sua conta e tente conectar de novo.");
 const t=a.tenant;
 if(st.tid!==t.id||getCookie(c.request,"nexus_mpo")!==st.nonce)return err("Esta conexão foi iniciada em outra conta ou outro navegador. Tente de novo.");
 const L=await lojaDisponivel(c.env,t,st.loja);if(L.error)return err(L.error);
 const code=u.searchParams.get("code");if(!code)return err("O Mercado Pago não enviou a autorização.");
 let creds;try{creds=await mpExchangeCode(c.env,c.request,code)}catch(e){return err(e instanceof GatewayError?e.message:"Falha ao conectar com o Mercado Pago.")}
 const cur=await getTerminal(c.env,t.id,L.n),keep=cur&&cur.provider==="mercadopago_point";
 const hint={access_token:mask(creds.access_token),oauth:1,mp_user:creds.mp_user},ts=now();
 await c.env.DB.prepare("INSERT INTO store_payment_terminals(tenant_id,loja,provider,credentials_enc,credentials_hint,device_id,device_label,active,created_at,updated_at) VALUES(?,?,'mercadopago_point',?,?,?,?,1,?,?) ON CONFLICT(tenant_id,loja) DO UPDATE SET provider=excluded.provider,credentials_enc=excluded.credentials_enc,credentials_hint=excluded.credentials_hint,device_id=excluded.device_id,device_label=excluded.device_label,updated_at=excluded.updated_at")
  .bind(t.id,L.n,await sealCreds(c.env,creds),JSON.stringify(hint),keep?cur.device_id:"",keep?cur.device_label:null,ts,ts).run();
 return back(c,{mp:"ok",loja:String(L.n)});
}
