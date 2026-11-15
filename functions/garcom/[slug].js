import {pagina} from "../_lib/pagina.js";
// Acesso do garçom/atendente (celular): /garcom/<loja>
export const onRequestGet=c=>pagina(c,{titulo:"Garçom",js:"garcom.js",classe:"pg-garcom",cor:"#15161a"});
