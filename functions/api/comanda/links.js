import {json,fail,painelCtx,getConfig} from "../../_lib/comanda.js";
import {onRequestGet as linkLoja} from "../painel/link.js";
// Todos os links da loja: cardápio público, acesso do garçom e uma tela de produção por setor (com token secreto).
export async function onRequestGet(c){
 const x=await painelCtx(c);if(x.error)return x.error;
 const r=await linkLoja(c);if(!r.ok)return r;
 const {slug}=await r.json(),o=new URL(c.request.url).origin,cfg=await getConfig(c.env,x.tid,x.loja);
 return json({slug,cardapio:`${o}/cardapio/${slug}`,garcom:`${o}/garcom/${slug}`,mesa:`${o}/mesa/${slug}`,producao:{cozinha:`${o}/producao/${slug}/cozinha?t=${cfg.tokens.cozinha}`,bar:`${o}/producao/${slug}/bar?t=${cfg.tokens.bar}`}});
}
