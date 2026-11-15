import {ensureSchema} from "./_lib/schema.js";
import {purgeExpiredTrash} from "./_lib/trash.js";
const err=(m,s=500)=>new Response(JSON.stringify({error:m}),{status:s,headers:{"content-type":"application/json; charset=utf-8"}});
export async function onRequest(context){
 const path=new URL(context.request.url).pathname;
 if(path.startsWith("/api/")){
  if(!context.env.DB)return err('Banco D1 não conectado: falta o binding "DB" no Cloudflare Pages (Settings > Bindings > D1 database).');
  try{await ensureSchema(context.env)}catch(e){return err("Erro ao preparar o banco: "+e.message)}
  // Limpeza da lixeira em segundo plano (não atrasa a resposta; no máximo a cada 6 h)
  try{context.waitUntil(purgeExpiredTrash(context.env).catch(e=>console.error("lixeira:",e?.message||e)))}catch{}
 }
 let response;
 try{response=await context.next()}catch(e){return err("Erro interno: "+(e&&e.message||e))}
 const headers=new Headers(response.headers);
 const painel=path.startsWith("/painel");
 headers.set("X-Content-Type-Options","nosniff");
 headers.set("Referrer-Policy","strict-origin-when-cross-origin");
 headers.set("Permissions-Policy","camera=(), microphone=(), geolocation=()");
 headers.set("Content-Security-Policy",`default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'${painel?" 'unsafe-inline'":""}; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
