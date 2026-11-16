import {json,fail,lojaPublica,getConfig,nomeLoja,logoLoja} from "../../../_lib/comanda.js";
import {listarCatalogo} from "../../comanda/catalogo.js";
// Cardápio público (sem login): dados da loja + categorias e produtos ativos. Nunca expõe tokens nem dados internos.
export async function onRequestGet(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Cardápio não encontrado.",404);
 const cfg=await getConfig(c.env,L.tid,L.loja);
 const cat=await listarCatalogo(c.env,L.tid,L.loja,{publico:true});
 return json({loja:{nome:await nomeLoja(c.env,L.t,L.loja,cfg),logo:await logoLoja(c.env,L.tid,L.loja,cfg),capa:cfg.capa,endereco:cfg.endereco,whatsapp:cfg.whatsapp,aceitando:!!cfg.aceitando,delivery:!!cfg.delivery,retirada:!!cfg.retirada,
  taxa_entrega_cents:cfg.taxa_entrega_cents,pedido_minimo_cents:cfg.pedido_minimo_cents,tempo_entrega:cfg.tempo_entrega,tempo_retirada:cfg.tempo_retirada,pagamentos:cfg.pagamentos,pix_chave:cfg.pix_chave},...cat},200,{"cache-control":"no-store"});
}
