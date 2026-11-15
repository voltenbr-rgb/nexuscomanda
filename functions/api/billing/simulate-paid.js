import {fail} from "../../_lib/http.js";
export async function onRequestPost(){
 return fail("Confirmação simulada desativada. A licença só deve ser liberada após confirmação validada do Mercado Pago.",410);
}
