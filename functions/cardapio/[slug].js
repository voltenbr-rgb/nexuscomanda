import {pagina} from "../_lib/pagina.js";
// Cardápio digital público: /cardapio/<loja>
export const onRequestGet=c=>pagina(c,{titulo:"Cardápio",js:"cardapio.js",classe:"pg-cardapio"});
