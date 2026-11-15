import {json,fail,readJson,cookie,b64u} from "../../../_lib/http.js";
import {requireTenant,signSession,secretOf} from "../../../_lib/auth.js";
import {lojaDisponivel,checkAdmin,mpOAuthReady,mpAuthUrl} from "../../../_lib/terminals.js";
// "Conectar com Mercado Pago": devolve o endereço de autorização do Mercado Pago para a loja escolhida no ADM.
// Exige a senha do ADM (um funcionário logado na loja não pode trocar a conta que recebe os pagamentos).
// O "state" é assinado e amarrado à conta + loja + um nonce guardado em cookie HttpOnly (válido por 10 min).
export async function onRequestPost(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 if(!mpOAuthReady(c.env))return fail("A conexão automática com o Mercado Pago ainda não foi configurada (faltam os secrets MP_CLIENT_ID e MP_CLIENT_SECRET).",501);
 const b=await readJson(c.request)||{},t=a.tenant;
 const L=await lojaDisponivel(c.env,t,b.loja);if(L.error)return fail(L.error,403);
 if(!await checkAdmin(c.env,t.id,b.admin_password))return fail("Senha do ADM incorreta.",403);
 const nonce=b64u(crypto.getRandomValues(new Uint8Array(18)));
 const state=await signSession({k:"mpo",tid:t.id,loja:L.n,nonce,exp:Date.now()+600000},secretOf(c.env));
 return json({ok:true,url:mpAuthUrl(c.env,c.request,state)},200,{"set-cookie":cookie("nexus_mpo",nonce,{path:"/api/painel/mp-oauth",maxAge:600,secure:new URL(c.request.url).protocol==="https:"})});
}
