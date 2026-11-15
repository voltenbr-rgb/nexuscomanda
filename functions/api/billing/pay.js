import {json,fail} from "../../_lib/http.js";
export async function onRequestPost(){
 return fail("Cobrança simulada desativada. Use os links oficiais de assinatura do Mercado Pago.",410);
}
