import {pagina} from "../../_lib/pagina.js";
// Tela de produção: /producao/<loja>/cozinha, /bar ou /cozinha-bar (tela única dividida) — sempre com ?t=TOKEN
export const onRequestGet=c=>pagina(c,{titulo:{bar:"Bar","cozinha-bar":"Cozinha e Bar"}[c.params.setor]||"Cozinha",js:"producao.js",classe:"pg-producao pd-claro",cor:"#eefbc4"});
