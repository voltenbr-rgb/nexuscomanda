import {json,fail,uid,mesaCtx,lancarPedido,comandasCom,nomeLoja,logoLoja} from "../../../_lib/comanda.js";
import {listarCatalogo} from "../../comanda/catalogo.js";
import {readJson} from "../../../_lib/http.js";
// Cardápio + o que já foi pedido nesta mesa (para o cliente conferir antes de pedir de novo).
export async function onRequestGet(c){
 const x=await mesaCtx(c,c.params.slug);if(x.error)return x.error;
 const u=new URL(c.request.url);
 const [k]=await comandasCom(c.env,x.tid,x.loja,"mesa_id=? AND status='aberta'",[x.mesa.id]);
 const out={mesa:{id:x.mesa.id,numero:x.mesa.numero},ja_pedido:(k?.itens||[]).filter(i=>i.status!=="cancelado").map(i=>({nome:i.nome,qtd:i.qtd,obs:i.obs,status:i.status,quem:i.origem,numero:i.pedido_numero,criado_em:i.criado_em})),total_cents:k?.total_cents||0};
 if(u.searchParams.get("parcial")!=="1"){out.loja={nome:await nomeLoja(c.env,x.t,x.loja,x.cfg),logo:await logoLoja(c.env,x.tid,x.loja,x.cfg)};Object.assign(out,await listarCatalogo(c.env,x.tid,x.loja,{publico:true}))}
 return json(out,200,{"cache-control":"no-store"});
}
// Envia o pedido do cliente: exige a confirmação do aviso ("já pedi ao garçom?") e espera 20 s entre envios da mesma mesa.
export async function onRequestPost(c){
 const x=await mesaCtx(c,c.params.slug);if(x.error)return x.error;
 const b=await readJson(c.request)||{},D=c.env.DB;
 if(!b.confirmado)return fail("Confirme o aviso antes de enviar o pedido.");
 const k=await D.prepare("SELECT * FROM cm_comandas WHERE tenant_id=? AND loja=? AND mesa_id=? AND status='aberta'").bind(x.tid,x.loja,x.mesa.id).first();
 if(!k)return fail("A comanda desta mesa foi encerrada. Chame o garçom.",401); // só o garçom abre comanda
 {const ult=await D.prepare("SELECT MAX(criado_em) t FROM cm_pedidos WHERE comanda_id=? AND origem='mesa_cliente'").bind(k.id).first();
  if(ult?.t&&Date.now()-ult.t<20000)return fail("Seu último pedido acabou de ser enviado. Aguarde alguns segundos.",429)}
 const r=await lancarPedido(c.env,{tid:x.tid,loja:x.loja,comanda:k,itens:(b.itens||[]).slice(0,30),origem:"mesa_cliente",atendente:"📱 Cliente da mesa",obs:b.obs,fuso:x.cfg.fuso});
 if(r.erro)return fail(r.erro);
 return json({ok:true,numero:r.numero},201);
}
