import {lojaPublica,getConfig,nomeLoja} from "./_lib/comanda.js";
// Manifesto PWA de cada link (cardápio, garçom, mesa, cozinha, bar). Cada um vira um "app" separado no aparelho:
// o id e o start_url são o próprio link, então a TV da cozinha instala a Cozinha, o celular do garçom instala o Garçom etc.
const TIPOS={cardapio:["Cardápio","standalone","#f3f4ef"],garcom:["Garçom","standalone","#15161a"],mesa:["Pedir na mesa","standalone","#f3f4ef"],producao:["Produção","fullscreen","#0f1013"]};
export async function onRequestGet(c){
 const u=new URL(c.request.url).searchParams.get("u")||"";
 const m=u.match(/^\/(cardapio|garcom|mesa)\/([a-z0-9-]{2,60})$/)||u.match(/^\/(producao)\/([a-z0-9-]{2,60})\/(cozinha|bar)(\?t=[a-f0-9]{20})?$/);
 if(!m)return new Response("Link inválido",{status:404});
 const [,tipo,slug,setor]=m;
 let loja="";try{const L=await lojaPublica(c.env,slug);if(L)loja=await nomeLoja(c.env,L.t,L.loja,await getConfig(c.env,L.tid,L.loja))}catch{}
 const [rot,display,cor]=TIPOS[tipo],nomeApp=tipo==="producao"?(setor==="bar"?"Bar":"Cozinha"):rot;
 const scope=tipo==="producao"?`/producao/${slug}/${setor}`:`/${tipo}/${slug}`,b="/painel/assets/icons";
 return new Response(JSON.stringify({
  id:u,name:`${nomeApp}${loja?" · "+loja:""}`,short_name:nomeApp,description:"Nexus Comanda",
  start_url:u,scope,display,orientation:tipo==="producao"?"any":"portrait",background_color:cor,theme_color:cor,lang:"pt-BR",
  icons:[{src:`${b}/icon-192.png`,sizes:"192x192",type:"image/png",purpose:"any"},{src:`${b}/icon-512.png`,sizes:"512x512",type:"image/png",purpose:"any"},{src:`${b}/icon-maskable-192.png`,sizes:"192x192",type:"image/png",purpose:"maskable"},{src:`${b}/icon-maskable-512.png`,sizes:"512x512",type:"image/png",purpose:"maskable"}]
 }),{headers:{"content-type":"application/manifest+json; charset=utf-8","cache-control":"no-store"}});
}
