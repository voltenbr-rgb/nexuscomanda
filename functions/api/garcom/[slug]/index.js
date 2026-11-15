import {json,atendenteCtx,getConfig,nomeLoja,comandasCom} from "../../../_lib/comanda.js";
import {acaoComanda,podeFechar} from "../../../_lib/acoes.js";
import {listarCatalogo} from "../../comanda/catalogo.js";
import {readJson} from "../../../_lib/http.js";
// Estado da tela do garçom: mesas (livres/ocupadas), contas abertas do salão e cardápio. ?parcial=1 omite o cardápio (atualização rápida).
export async function onRequestGet(c){
 const x=await atendenteCtx(c,c.params.slug);if(x.error)return x.error;
 const cfg=await getConfig(c.env,x.tid,x.loja),u=new URL(c.request.url);
 const mesas=(await c.env.DB.prepare("SELECT id,numero,lugares FROM cm_mesas WHERE tenant_id=? AND loja=? AND ativo=1 ORDER BY ordem,CAST(numero AS INTEGER),numero").bind(x.tid,x.loja).all()).results||[];
 const comandas=await comandasCom(c.env,x.tid,x.loja,"status='aberta' AND tipo IN ('mesa','balcao','retirada')",[]);
 const out={atendente:x.atendente,pode_fechar:podeFechar({tipo:"atendente",atendente:x.atendente},cfg),servico_pct:cfg.servico_pct,pagamentos:cfg.pagamentos,mesas,comandas};
 if(u.searchParams.get("parcial")!=="1"){out.loja={nome:await nomeLoja(c.env,x.t,x.loja,cfg),logo:cfg.logo};Object.assign(out,await listarCatalogo(c.env,x.tid,x.loja,{publico:true}))}
 return json(out);
}
export async function onRequestPost(c){
 const x=await atendenteCtx(c,c.params.slug);if(x.error)return x.error;
 return acaoComanda(c.env,x,await readJson(c.request)||{},{tipo:"atendente",atendente:x.atendente});
}
