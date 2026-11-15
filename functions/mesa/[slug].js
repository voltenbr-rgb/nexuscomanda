import {pagina} from "../_lib/pagina.js";
// Pedido do cliente pelo celular na mesa: /mesa/<loja> (escolhe a mesa + senha que o garçom passou)
export const onRequestGet=c=>pagina(c,{titulo:"Pedir na mesa",js:"mesa.js",classe:"pg-cardapio pg-mesa"});
