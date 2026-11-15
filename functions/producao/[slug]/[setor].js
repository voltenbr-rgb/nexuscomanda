import {pagina} from "../../_lib/pagina.js";
// Tela de produção por setor: /producao/<loja>/cozinha?t=TOKEN ou /producao/<loja>/bar?t=TOKEN
export const onRequestGet=c=>pagina(c,{titulo:c.params.setor==="bar"?"Bar":"Cozinha",js:"producao.js",classe:"pg-producao",cor:"#15161a"});
