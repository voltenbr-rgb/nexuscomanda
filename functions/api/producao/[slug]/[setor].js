import {json,fail,producaoCtx,nomeLoja,SETOR_NOME} from "../../../_lib/comanda.js";
import {readJson} from "../../../_lib/http.js";
// Tela de produção (cozinha / bar). Mostra SÓ os itens do setor, agrupados por pedido. ?since=ms → {igual:true} quando nada mudou.
const T=()=>Date.now();
async function feed(env,x){
 const D=env.DB,lim=T()-16*3600000;
 const it=(await D.prepare(`SELECT i.id,i.pedido_id,i.nome,i.qtd,i.obs,i.status,i.updated,p.numero,p.origem,p.atendente,p.obs pobs,p.criado_em,k.tipo,k.mesa_label,k.cliente_nome
  FROM cm_itens i JOIN cm_pedidos p ON p.id=i.pedido_id JOIN cm_comandas k ON k.id=i.comanda_id
  WHERE i.tenant_id=? AND i.loja=? AND i.setor=? AND p.criado_em>? AND (i.status IN ('novo','preparo') OR (i.status='pronto' AND i.updated>?))
  ORDER BY p.criado_em,i.rowid`).bind(x.tid,x.loja,x.setor,lim,T()-20*60000).all()).results||[];
 const P={};
 for(const i of it){const p=P[i.pedido_id]||={id:i.pedido_id,numero:i.numero,origem:i.origem,atendente:i.atendente,obs:i.pobs,criado_em:i.criado_em,tipo:i.tipo,mesa:i.mesa_label,cliente:i.cliente_nome,itens:[]};
  p.itens.push({id:i.id,nome:i.nome,qtd:i.qtd,obs:i.obs,status:i.status})}
 return Object.values(P);
}
export async function onRequestGet(c){
 const u=new URL(c.request.url);
 const x=await producaoCtx(c,c.params.slug,c.params.setor,u.searchParams.get("t"));if(x.error)return x.error;
 const marca=(await c.env.DB.prepare("SELECT MAX(updated) m FROM cm_itens WHERE tenant_id=? AND loja=? AND setor=?").bind(x.tid,x.loja,x.setor).first())?.m||0;
 const since=Number(u.searchParams.get("since")||0);
 if(since&&marca<=since&&u.searchParams.get("full")!=="1")return json({igual:true,marca,agora:T()});
 return json({loja:await nomeLoja(c.env,x.t,x.loja,x.cfg),setor:x.setor,setor_nome:SETOR_NOME[x.setor],impressao_auto:!!x.cfg.impressao_auto,pedidos:await feed(c.env,x),marca,agora:T()});
}
// Atualiza a situação: {t, pedido_id, status} (todos os itens do setor no pedido) ou {t, item_id, status}.
export async function onRequestPost(c){
 const b=await readJson(c.request)||{};
 const x=await producaoCtx(c,c.params.slug,c.params.setor,b.t);if(x.error)return x.error;
 const st=String(b.status||"");if(!["novo","preparo","pronto"].includes(st))return fail("Situação inválida.");
 const D=c.env.DB,agora=T();
 if(b.item_id)await D.prepare("UPDATE cm_itens SET status=?,updated=? WHERE id=? AND tenant_id=? AND loja=? AND setor=? AND status IN ('novo','preparo','pronto')").bind(st,agora,String(b.item_id),x.tid,x.loja,x.setor).run();
 else if(b.pedido_id)await D.prepare("UPDATE cm_itens SET status=?,updated=? WHERE pedido_id=? AND tenant_id=? AND loja=? AND setor=? AND status IN ('novo','preparo','pronto')").bind(st,agora,String(b.pedido_id),x.tid,x.loja,x.setor).run();
 else return fail("Informe o pedido ou o item.");
 await D.prepare("UPDATE cm_comandas SET updated=? WHERE id IN (SELECT comanda_id FROM cm_itens WHERE tenant_id=? AND loja=? AND (id=? OR pedido_id=?))").bind(agora,x.tid,x.loja,String(b.item_id||""),String(b.pedido_id||"")).run();
 return json({ok:true});
}
