import {json,fail,uid,cleanText,int,lojaPublica,getConfig,lancarPedido,comandasCom,PAGAMENTOS} from "../../../_lib/comanda.js";
import {readJson} from "../../../_lib/http.js";
// Pedido do cardápio público (delivery ou retirada). Preço e taxa são calculados no servidor.
// Limite simples contra abuso: 6 pedidos por telefone a cada 30 min.
export async function onRequestPost(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Loja indisponível.",404);
 const cfg=await getConfig(c.env,L.tid,L.loja),b=await readJson(c.request)||{},D=c.env.DB;
 if(!cfg.aceitando)return fail("A loja não está recebendo pedidos agora.");
 const tipo=b.tipo==="delivery"?"delivery":"retirada";
 if(!cfg[tipo])return fail(tipo==="delivery"?"Esta loja não faz delivery.":"Esta loja não aceita retirada.");
 const nome=cleanText(b.nome,60),fone=String(b.fone||"").replace(/\D/g,"").slice(0,15),end=cleanText(b.endereco,200);
 if(nome.length<2)return fail("Informe seu nome.");
 if(fone.length<10)return fail("Informe um telefone com DDD.");
 if(tipo==="delivery"&&end.length<8)return fail("Informe o endereço de entrega completo.");
 const pag=PAGAMENTOS.includes(b.pagamento)&&cfg.pagamentos.includes(b.pagamento)?b.pagamento:null;
 if(!pag)return fail("Escolha a forma de pagamento.");
 const ago=Date.now()-1800000;
 if(((await D.prepare("SELECT COUNT(*) n FROM cm_comandas WHERE tenant_id=? AND loja=? AND cliente_fone=? AND aberta_em>?").bind(L.tid,L.loja,fone,ago).first())?.n||0)>=6)return fail("Muitos pedidos seguidos. Aguarde alguns minutos ou fale com a loja.",429);
 const id=uid(),agora=Date.now(),taxa=tipo==="delivery"?cfg.taxa_entrega_cents:0;
 await D.prepare("INSERT INTO cm_comandas(id,tenant_id,loja,tipo,cliente_nome,cliente_fone,endereco,obs,pagamento,troco_para_cents,taxa_cents,aberta_por,aberta_em,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
  .bind(id,L.tid,L.loja,tipo,nome,fone,tipo==="delivery"?end:null,cleanText(b.obs,200)||null,pag,pag==="dinheiro"?int(b.troco_para_cents,0,10_000_000,0)||null:null,taxa,"Cardápio online",agora,agora).run();
 const r=await lancarPedido(c.env,{tid:L.tid,loja:L.loja,comanda:{id},itens:b.itens,origem:"cardapio",atendente:"Cardápio online",fuso:cfg.fuso});
 if(r.erro){await D.prepare("DELETE FROM cm_comandas WHERE id=?").bind(id).run();return fail(r.erro)}
 const k=(await D.prepare("SELECT subtotal_cents,total_cents FROM cm_comandas WHERE id=?").bind(id).first());
 if(k.subtotal_cents<cfg.pedido_minimo_cents){
  await D.batch([D.prepare("DELETE FROM cm_itens WHERE comanda_id=?").bind(id),D.prepare("DELETE FROM cm_pedidos WHERE comanda_id=?").bind(id),D.prepare("DELETE FROM cm_comandas WHERE id=?").bind(id)]);
  return fail("Pedido mínimo: R$ "+(cfg.pedido_minimo_cents/100).toFixed(2).replace(".",","));
 }
 return json({ok:true,id,numero:r.numero,total_cents:k.total_cents},201);
}
// Acompanhamento do pedido pelo cliente (o id é aleatório e só quem fez o pedido o conhece).
export async function onRequestGet(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Loja indisponível.",404);
 const id=new URL(c.request.url).searchParams.get("id")||"";
 const [k]=await comandasCom(c.env,L.tid,L.loja,"id=? AND tipo IN ('delivery','retirada')",[id]);
 if(!k)return fail("Pedido não encontrado.",404);
 return json({pedido:{numero:k.itens[0]?.pedido_numero,tipo:k.tipo,situacao:k.situacao,etapa:k.etapa,status:k.status,total_cents:k.total_cents,taxa_cents:k.taxa_cents,pagamento:k.pagamento,aberta_em:k.aberta_em,itens:k.itens.map(i=>({nome:i.nome,qtd:i.qtd,preco_cents:i.preco_cents,status:i.status}))}});
}
