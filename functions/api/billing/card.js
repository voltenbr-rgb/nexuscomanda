import {fail} from "../../_lib/http.js";
export async function onRequestPost(){
 return fail("Cartão de teste desativado. Gerencie sua assinatura pelo checkout do Mercado Pago.",410);
}
