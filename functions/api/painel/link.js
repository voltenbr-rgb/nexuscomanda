import {json,fail} from "../../_lib/http.js";
import {requireTenant,storeLimit} from "../../_lib/auth.js";
import {slugify,lojaN,sk} from "../../_lib/publico.js";
// Devolve (e cria na 1ª vez) o endereço público de UMA loja: /cardapio/<slug> (e /garcom/<slug>, /producao/<slug>/<setor>). Cada loja/filial tem o seu slug exclusivo.
// O slug nunca muda depois de criado, para que links já compartilhados continuem valendo mesmo se o nome da loja for alterado.
export async function onRequestGet(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const D=c.env.DB,t=a.tenant,n=lojaN(new URL(c.request.url).searchParams.get("loja"));
 if(n>await storeLimit(c.env,t))return fail("Esta loja não está disponível no seu plano.",403);
 if(n>1){ // só lojas ativadas no ADM
  const g=await D.prepare("SELECT data FROM registros WHERE store=? AND id='lojas' AND deleted=0").bind(t.id+"~global").first();
  let st=null;try{st=JSON.parse(g?.data||"{}").stores}catch{}
  if(Array.isArray(st)&&!st.some(x=>Number(x.n)===n))return fail("Esta loja não está ativada.",404);
 }
 const get=()=>D.prepare("SELECT slug FROM store_links WHERE tenant_id=? AND loja=?").bind(t.id,n).first();
 let slug=(await get())?.slug;
 if(!slug){
  const legacy=n===1?(await D.prepare("SELECT slug FROM tenants WHERE id=?").bind(t.id).first())?.slug:null; // mantém o link da versão anterior
  const sr=await D.prepare("SELECT data FROM registros WHERE store=? AND id='main' AND deleted=0").bind(sk(t.id,"settings",n)).first();
  let nm="";try{nm=String(JSON.parse(sr?.data||"{}").name||"").trim()}catch{}
  const company=(t.company_name||t.business_name||"").trim(),base=slugify(nm||(n===1?company:`${company} loja ${n}`));
  for(let i=0;i<10&&!slug;i++){
   const cand=legacy||(i===0?base:i<5?`${base}-${i+1}`:`${base}-${crypto.randomUUID().slice(0,4)}`);
   try{
    if(!legacy&&await D.prepare("SELECT 1 FROM tenants WHERE slug=? AND id<>?").bind(cand,t.id).first())continue; // já é o endereço de outra conta
    await D.prepare("INSERT INTO store_links(slug,tenant_id,loja) VALUES(?,?,?)").bind(cand,t.id,n).run();slug=cand;
   }catch{if(legacy)break;/* slug já usado: tenta o próximo; ou outra requisição criou esta loja agora */}
  }
  if(!slug)slug=(await get())?.slug;
  if(!slug)return fail("Não foi possível gerar o link agora. Tente novamente.",500);
 }
 const path="/cardapio/"+slug;
 return json({ok:true,slug,loja:n,path,url:new URL(c.request.url).origin+path});
}
