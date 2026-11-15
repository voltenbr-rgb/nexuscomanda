import {json,fail,readJson,uid,cleanText} from "../../_lib/http.js";
import {requireTenant} from "../../_lib/auth.js";
import {lojaDisponivel,getTerminal,openCreds,freshCreds,mpPixCreate,mpPixGet,mpPixCancel,GatewayError} from "../../_lib/terminals.js";
// Pix online (QR Code na tela do Caixa) pela conta do Mercado Pago conectada na loja (Área ADM > Maquininhas).
//  GET  ?loja=N                 → {online:true|false} — a loja pode gerar Pix com confirmação automática?
//  GET  ?loja=N&id=PAGAMENTO    → status do pagamento (o Caixa consulta a cada ~3 s)
//  POST {action:"create", loja, amount, description} → cria o Pix e devolve o "copia e cola"
//  POST {action:"cancel", loja, id}                  → cancela o Pix ainda não pago
// O tenant vem da sessão; o token do Mercado Pago fica cifrado no D1 e nunca vai para o navegador.

async function ctx(c,t,loja){
 const L=await lojaDisponivel(c.env,t,loja);if(L.error)throw new GatewayError(L.error,403);
 const term=await getTerminal(c.env,t.id,L.n);
 if(!term||!term.active||term.provider!=="mercadopago_point")return null;
 let creds=await openCreds(c.env,term.credentials_enc);if(!creds?.access_token)return null;
 return await freshCreds(c.env,term,creds);
}
const err=e=>fail(e instanceof GatewayError?e.message:"Falha ao falar com o Mercado Pago.",e.status||502);

export async function onRequestGet(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const q=new URL(c.request.url).searchParams;
 try{
  const creds=await ctx(c,a.tenant,q.get("loja"));
  const id=cleanText(q.get("id"),40);
  if(!id)return json({ok:true,online:!!creds});
  if(!creds)return fail("Mercado Pago não conectado nesta loja.",400);
  return json({ok:true,...await mpPixGet(creds,id)});
 }catch(e){return err(e)}
}

export async function onRequestPost(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const b=await readJson(c.request)||{};
 try{
  const creds=await ctx(c,a.tenant,b.loja);
  if(!creds)return fail("Conecte o Mercado Pago desta loja na Área ADM > Maquininhas para gerar Pix com confirmação automática.",400);
  if(b.action==="cancel"){const id=cleanText(b.id,40);if(!id)return fail("Pagamento inválido.");return json({ok:true,...(await mpPixCancel(creds,id)||{})})}
  if(b.action!=="create")return fail("Ação inválida.");
  const amount=Math.round(Number(b.amount)*100)/100;
  if(!(amount>=0.01&&amount<=100000))return fail("Valor inválido.");
  const r=await mpPixCreate(creds,{amount,description:cleanText(b.description,120)||"Venda",idem:"nxpix-"+uid()});
  return json({ok:true,...r});
 }catch(e){return err(e)}
}
