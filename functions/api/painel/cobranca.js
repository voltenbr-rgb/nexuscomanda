import {json,fail,readJson,uid,now,cleanText} from "../../_lib/http.js";
import {requireTenant} from "../../_lib/auth.js";
import {PROVIDERS,lojaDisponivel,getTerminal,openCreds,freshCreds,adapterOf,GatewayError} from "../../_lib/terminals.js";
// Cobrança na maquininha física a partir da frente de caixa.
//  POST {action:"create", loja, amount, method:"credito"|"debito"|"pix", description} (PIX = QR Code na tela da maquininha) → envia o valor para a maquininha da loja
//  GET  ?id=...                                                                  → consulta o status (o caixa chama a cada ~3 s)
//  POST {action:"cancel", id}                                                    → cancela enquanto ainda não foi para a tela da maquininha
// O tenant vem da sessão; as credenciais são lidas do D1 (store_payment_terminals) e nunca saem do servidor.

const LABEL={pending:"Aguardando pagamento na maquininha...",approved:"Pagamento aprovado",rejected:"Pagamento recusado",canceled:"Cobrança cancelada",error:"Erro na cobrança"};
const out=ch=>({ok:true,id:ch.id,status:ch.status,label:LABEL[ch.status]||ch.status,detail:ch.status_detail||"",amount:ch.amount_cents/100,method:ch.method,provider:ch.provider,external_id:ch.external_id||null});
const getCharge=(D,tid,id)=>D.prepare("SELECT * FROM terminal_charges WHERE id=? AND tenant_id=?").bind(String(id||"").slice(0,80),tid).first();
async function save(D,ch,r){
 Object.assign(ch,{status:r.state,status_detail:r.detail||null,provider_status:r.provider_status||null,external_id:r.external_id||ch.external_id,updated_at:now()});
 await D.prepare("UPDATE terminal_charges SET status=?,status_detail=?,provider_status=?,external_id=?,updated_at=? WHERE id=?").bind(ch.status,ch.status_detail,ch.provider_status,ch.external_id,ch.updated_at,ch.id).run();
 return ch;
}
async function loadCtx(c,tid,loja){
 const term=await getTerminal(c.env,tid,loja);
 if(!term||!term.active)throw new GatewayError("Nenhuma maquininha configurada para esta loja. Configure na Área ADM.",404);
 if(!term.device_id)throw new GatewayError("Escolha a maquininha desta loja na Área ADM > Maquininhas de cartão.",404);
 let creds=await openCreds(c.env,term.credentials_enc);
 if(!creds)throw new GatewayError("Não foi possível ler as credenciais da maquininha. Cadastre-as novamente na Área ADM.",500);
 creds=await freshCreds(c.env,term,creds);
 const ad=adapterOf(term.provider);if(!ad)throw new GatewayError("Provedor de maquininha desconhecido.",400);
 return {term,creds,ad};
}
const gwFail=e=>fail(e instanceof GatewayError?e.message:"Falha ao falar com a maquininha.",e.status||502);

export async function onRequestGet(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const D=c.env.DB,ch=await getCharge(D,a.tenant.id,new URL(c.request.url).searchParams.get("id"));
 if(!ch)return fail("Cobrança não encontrada.",404);
 if(ch.status!=="pending"||!ch.external_id)return json(out(ch));
 try{const {creds,ad}=await loadCtx(c,a.tenant.id,ch.loja);return json(out(await save(D,ch,await ad.status(creds,ch))))}
 catch(e){return json({...out(ch),warning:e instanceof GatewayError?e.message:"Sem resposta da maquininha, tentando de novo..."})} // segue aguardando
}

export async function onRequestPost(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const b=await readJson(c.request)||{},t=a.tenant,D=c.env.DB;

 if(b.action==="cancel"){
  const ch=await getCharge(D,t.id,b.id);if(!ch)return fail("Cobrança não encontrada.",404);
  if(ch.status!=="pending")return json(out(ch));
  try{const {creds,ad}=await loadCtx(c,t.id,ch.loja);return json(out(await save(D,ch,ch.external_id?await ad.cancel(creds,ch):{state:"canceled",detail:"cancelado no caixa"})))}
  catch(e){return gwFail(e)}
 }
 if(b.action!=="create")return fail("Ação inválida.");

 const L=await lojaDisponivel(c.env,t,b.loja);if(L.error)return fail(L.error,403);
 const cents=Math.round(Number(b.amount)*100);
 if(!Number.isFinite(cents)||cents<100||cents>10000000)return fail("Valor inválido para a maquininha (mínimo R$ 1,00).");
 const method=["credito","debito","pix"].includes(b.method)?b.method:null;if(!method)return fail("Na maquininha, escolha Cartão de crédito, Cartão de débito ou PIX.");
 let ctx;try{ctx=await loadCtx(c,t.id,L.n)}catch(e){return gwFail(e)}
 if(!PROVIDERS[ctx.term.provider]?.ready)return fail(`A integração com ${PROVIDERS[ctx.term.provider]?.label||ctx.term.provider} ainda não está disponível.`,501);

 const ch={id:uid(),tenant_id:t.id,loja:L.n,provider:ctx.term.provider,device_id:ctx.term.device_id,external_id:null,amount_cents:cents,method,description:cleanText(b.description,60)||"Venda",status:"pending",status_detail:null,provider_status:null,created_at:now(),updated_at:now()};
 await D.prepare("INSERT INTO terminal_charges(id,tenant_id,loja,provider,device_id,amount_cents,method,description,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)")
  .bind(ch.id,ch.tenant_id,ch.loja,ch.provider,ch.device_id,ch.amount_cents,ch.method,ch.description,ch.status,ch.created_at,ch.updated_at).run();
 try{return json(out(await save(D,ch,await ctx.ad.create(ctx.creds,ctx.term,ch))))}
 catch(e){await save(D,ch,{state:"error",detail:e.message||"falha"});return gwFail(e)}
}
