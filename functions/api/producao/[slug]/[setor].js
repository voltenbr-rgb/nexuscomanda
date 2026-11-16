import {json,fail,producaoCtx,nomeLoja,logoLoja,SETOR_NOME,SETORES} from "../../../_lib/comanda.js";
import {readJson} from "../../../_lib/http.js";
// Tela de produção (cozinha / bar / cozinha-bar). Mostra SÓ os itens do(s) setor(es), agrupados por pedido. ?since=ms → {igual:true} quando nada mudou.
const T=()=>Date.now();
const setoresDa=x=>x.setor==="cozinha-bar"?SETORES:[x.setor];
const inS=x=>setoresDa(x).map(()=>"?").join(",");
async function feed(env,x){
 const D=env.DB,lim=T()-16*3600000;
 const it=(await D.prepare(`SELECT i.id,i.pedido_id,i.nome,i.qtd,i.obs,i.status,i.updated,i.setor,p.numero,p.origem,p.atendente,p.obs pobs,p.criado_em,k.tipo,k.mesa_label,k.cliente_nome,k.etapa,k.id comanda_id
  FROM cm_itens i JOIN cm_pedidos p ON p.id=i.pedido_id JOIN cm_comandas k ON k.id=i.comanda_id
  WHERE i.tenant_id=? AND i.loja=? AND i.setor IN (${inS(x)}) AND p.criado_em>? AND k.etapa<>'saiu' AND (i.status IN ('novo','preparo') OR (i.status='pronto' AND i.updated>?))
  ORDER BY p.criado_em,i.rowid`).bind(x.tid,x.loja,...setoresDa(x),lim,T()-20*60000).all()).results||[];
 const P={};
 for(const i of it){const p=P[i.pedido_id]||={id:i.pedido_id,numero:i.numero,origem:i.origem,atendente:i.atendente,obs:i.pobs,criado_em:i.criado_em,tipo:i.tipo,comanda_id:i.comanda_id,mesa:i.mesa_label,cliente:i.cliente_nome,itens:[]};
  p.itens.push({id:i.id,nome:i.nome,qtd:i.qtd,obs:i.obs,status:i.status,setor:i.setor})}
 return Object.values(P);
}
export async function onRequestGet(c){
 const u=new URL(c.request.url);
 const x=await producaoCtx(c,c.params.slug,c.params.setor,u.searchParams.get("t"));if(x.error)return x.error;
 const marca=(await c.env.DB.prepare(`SELECT MAX(updated) m FROM cm_itens WHERE tenant_id=? AND loja=? AND setor IN (${inS(x)})`).bind(x.tid,x.loja,...setoresDa(x)).first())?.m||0;
 const since=Number(u.searchParams.get("since")||0);
 if(since&&marca<=since&&u.searchParams.get("full")!=="1")return json({igual:true,marca,agora:T()});
 return json({loja:await nomeLoja(c.env,x.t,x.loja,x.cfg),...(since?{}:{logo:await logoLoja(c.env,x.tid,x.loja,x.cfg)}),setor:x.setor,setor_nome:SETOR_NOME[x.setor],impressao_auto:!!x.cfg.impressao_auto,pedidos:await feed(c.env,x),marca,agora:T()});
}
// Atualiza a situação: {t, pedido_id, status} (todos os itens do setor no pedido) ou {t, item_id, status}.
export async function onRequestPost(c){
 const b=await readJson(c.request)||{};
 const x=await producaoCtx(c,c.params.slug,c.params.setor,b.t);if(x.error)return x.error;
 // Delivery pronto: a produção marca "Saiu para entrega" — o cliente vê no acompanhamento e o pedido sai da tela.
 if(b.saiu&&b.pedido_id){
  const k=await c.env.DB.prepare("SELECT k.id,k.tipo,k.status FROM cm_pedidos p JOIN cm_comandas k ON k.id=p.comanda_id WHERE p.id=? AND p.tenant_id=? AND p.loja=?").bind(String(b.pedido_id),x.tid,x.loja).first();
  if(!k||k.tipo!=="delivery"||k.status!=="aberta")return fail("Só pedidos de delivery em aberto podem sair para entrega.");
  const agora=T();
  await c.env.DB.batch([c.env.DB.prepare("UPDATE cm_comandas SET etapa='saiu',updated=? WHERE id=?").bind(agora,k.id),c.env.DB.prepare("UPDATE cm_itens SET status=CASE WHEN status IN ('novo','preparo') THEN 'pronto' ELSE status END,updated=? WHERE comanda_id=? AND status<>'cancelado'").bind(agora,k.id)]);
  return json({ok:true});
 }
 const st=String(b.status||"");if(!["novo","preparo","pronto"].includes(st))return fail("Situação inválida.");
 const D=c.env.DB,agora=T();
 // Tela única (cozinha-bar): cada metade informa o setor do botão tocado.
 const setor=x.setor==="cozinha-bar"?(SETORES.includes(b.setor)?b.setor:null):x.setor;
 const alvo=setor?[setor]:SETORES;
 if(b.item_id)await D.prepare(`UPDATE cm_itens SET status=?,updated=? WHERE id=? AND tenant_id=? AND loja=? AND setor IN (${alvo.map(()=>"?").join(",")}) AND status IN ('novo','preparo','pronto')`).bind(st,agora,String(b.item_id),x.tid,x.loja,...alvo).run();
 else if(b.pedido_id)await D.prepare(`UPDATE cm_itens SET status=?,updated=? WHERE pedido_id=? AND tenant_id=? AND loja=? AND setor IN (${alvo.map(()=>"?").join(",")}) AND status IN ('novo','preparo','pronto')`).bind(st,agora,String(b.pedido_id),x.tid,x.loja,...alvo).run();
 else return fail("Informe o pedido ou o item.");
 await D.prepare("UPDATE cm_comandas SET updated=? WHERE id IN (SELECT comanda_id FROM cm_itens WHERE tenant_id=? AND loja=? AND (id=? OR pedido_id=?))").bind(agora,x.tid,x.loja,String(b.item_id||""),String(b.pedido_id||"")).run();
 return json({ok:true});
}
