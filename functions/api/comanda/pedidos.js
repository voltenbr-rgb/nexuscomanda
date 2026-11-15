import {json,fail,painelCtx,comandasCom,getConfig,inicioDia} from "../../_lib/comanda.js";
import {acaoComanda} from "../../_lib/acoes.js";
import {readJson} from "../../_lib/http.js";
// Fila de pedidos do painel (Order Line): abertas + encerradas de hoje. ?since=ms devolve {igual:true} se nada mudou.
export async function onRequestGet(c){
 const x=await painelCtx(c);if(x.error)return x.error;
 const u=new URL(c.request.url),since=Number(u.searchParams.get("since")||0);
 const ult=(await c.env.DB.prepare("SELECT MAX(updated) m FROM cm_comandas WHERE tenant_id=? AND loja=?").bind(x.tid,x.loja).first())?.m||0;
 const ultI=(await c.env.DB.prepare("SELECT MAX(updated) m FROM cm_itens WHERE tenant_id=? AND loja=?").bind(x.tid,x.loja).first())?.m||0;
 const marca=Math.max(ult,ultI);
 if(since&&marca<=since)return json({igual:true,marca});
 const cfg=await getConfig(c.env,x.tid,x.loja),desde=inicioDia(cfg.fuso);
 const comandas=await comandasCom(c.env,x.tid,x.loja,"(status='aberta' OR aberta_em>=? OR fechada_em>=?)",[desde,desde]);
 return json({comandas,marca});
}
export async function onRequestPost(c){
 const b=await readJson(c.request)||{};
 const x=await painelCtx(c,b.loja);if(x.error)return x.error;
 return acaoComanda(c.env,x,b,{tipo:"painel"});
}
