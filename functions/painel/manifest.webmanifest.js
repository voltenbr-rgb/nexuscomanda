import {session} from "../_lib/auth.js";
// Manifesto do PWA: nome "Gestão - [Nome do Negócio]" e o mesmo ícone 3D da marca Nexus para todos os nichos.
export async function onRequestGet(c){
 let nome="Nexus Comanda";
 try{const s=await session(c);if(s?.role==="tenant"&&s.tid){const t=await c.env.DB.prepare("SELECT business_name,company_name FROM tenants WHERE id=?").bind(s.tid).first();const n=(t?.company_name||t?.business_name||"").trim();if(n)nome=n}}catch{}
 const title="Painel - "+nome,b="/painel/assets/icons";
 return new Response(JSON.stringify({id:"/painel/",name:title,short_name:title,start_url:"/painel/",scope:"/",display:"standalone",orientation:"portrait",background_color:"#f3f4ef",theme_color:"#15161a",lang:"pt-BR",icons:[{src:`${b}/icon-192.png`,sizes:"192x192",type:"image/png",purpose:"any"},{src:`${b}/icon-512.png`,sizes:"512x512",type:"image/png",purpose:"any"},{src:`${b}/icon-maskable-192.png`,sizes:"192x192",type:"image/png",purpose:"maskable"},{src:`${b}/icon-maskable-512.png`,sizes:"512x512",type:"image/png",purpose:"maskable"}]}),{headers:{"content-type":"application/manifest+json; charset=utf-8","cache-control":"no-store"}});
}
