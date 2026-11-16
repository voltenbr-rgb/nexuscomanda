import {ensureSchema} from "./schema.js";
import {lojaPublica,getConfig,nomeLoja} from "./comanda.js";
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
// Casca HTML das páginas públicas (cardápio, garçom, produção). O conteúdo é montado pelo JS da página via API.
export async function pagina(c,{titulo,js,classe,cor="#f4f5f0",manifest}){
 let nome="",ok=false;
 try{await ensureSchema(c.env);const L=await lojaPublica(c.env,c.params.slug);if(L){ok=true;nome=await nomeLoja(c.env,L.t,L.loja,await getConfig(c.env,L.tid,L.loja))}}catch{}
 const t=ok?`${titulo} · ${nome}`:"Loja não encontrada";
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(t)}</title><meta name="theme-color" content="${cor}"><meta name="robots" content="noindex,nofollow"><meta property="og:title" content="${esc(t)}"><link rel="icon" type="image/png" href="/painel/assets/icons/favicon-48.png"><link rel="apple-touch-icon" href="/painel/assets/icons/apple-touch-icon.png"><link rel="manifest" href="/pwa.webmanifest?u=${encodeURIComponent(new URL(c.request.url).pathname+(new URL(c.request.url).search.match(/^\?t=[a-f0-9]{20}$/)?new URL(c.request.url).search:""))}"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="${esc(titulo)}"><link rel="stylesheet" href="/css/comanda.css?v=7"></head><body class="${classe}"><div id="app"><p class="cm-load">Carregando…</p></div><script src="/js/comanda-ui.js?v=5" defer></script><script src="/js/${js}?v=10" defer></script></body></html>`;
 return new Response(html,{status:ok?200:404,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store"}});
}
