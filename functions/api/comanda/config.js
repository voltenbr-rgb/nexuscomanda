import {json,fail,painelCtx,getConfig,saveConfig,sanitizeConfig,espelharLogoPainel} from "../../_lib/comanda.js";
import {readJson} from "../../_lib/http.js";
// Configuração do Comanda por loja: delivery/retirada, taxas, pagamentos, quem fecha a conta, impressão.
export async function onRequestGet(c){
 const x=await painelCtx(c);if(x.error)return x.error;
 return json({config:await getConfig(c.env,x.tid,x.loja)});
}
export async function onRequestPut(c){
 const b=await readJson(c.request);if(!b||typeof b!=="object")return fail("Dados inválidos.");
 const x=await painelCtx(c,b.loja);if(x.error)return x.error;
 const antes=await getConfig(c.env,x.tid,x.loja),cfg=sanitizeConfig(b,antes);
 await saveConfig(c.env,x.tid,x.loja,cfg);
 if("logo" in b&&cfg.logo!==antes.logo)await espelharLogoPainel(c.env,x.tid,x.loja,cfg.logo);
 return json({ok:true,config:await getConfig(c.env,x.tid,x.loja)});
}
