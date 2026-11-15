import {json,fail,readJson} from "../../_lib/http.js";
import {requireTenant,storeLimit} from "../../_lib/auth.js";
// Sincronização do dashboard, isolada por cliente: toda chave de loja é gravada como "<tenant>~<store>".
const BASES=["clients","barbers","services","appointments","finance","products","stock","settings"];
function parse(s){const m=/^([a-z]+)(?:@(\d{1,2}))?$/.exec(String(s||""));if(!m)return null;if(m[1]==="global")return m[2]?null:{base:"global",n:1};const n=m[2]?Number(m[2]):1;if(!BASES.includes(m[1])||n<1||n>20)return null;return{base:m[1],n}}
export async function onRequestGet(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const u=new URL(c.request.url),pre=a.tenant.id+"~",store=u.searchParams.get("store"),loja=Number(u.searchParams.get("loja")||0),since=Math.max(0,Number(u.searchParams.get("since")||0));
 const trash=u.searchParams.get("trash")==="1",cutoff=Date.now()-30*86400000;
 if(trash)await c.env.DB.prepare("UPDATE registros SET data='' WHERE substr(store,1,?)=? AND deleted=1 AND updated<? AND data<>''").bind(pre.length,pre,cutoff).run();
 let q;
 if(store){
  q=trash?await c.env.DB.prepare("SELECT store,id,data,updated,deleted FROM registros WHERE store=? AND deleted=1 AND updated>=?").bind(pre+store,cutoff).all():await c.env.DB.prepare("SELECT store,id,data,updated,deleted FROM registros WHERE store=? AND updated>?").bind(pre+store,since).all();
 }else if(loja===1||loja>1){
  const names=BASES.map(b=>pre+(loja===1?b:`${b}@${loja}`)),marks=names.map(()=>"?").join(",");
  q=trash?await c.env.DB.prepare(`SELECT store,id,data,updated,deleted FROM registros WHERE store IN (${marks}) AND deleted=1 AND updated>=?`).bind(...names,cutoff).all():await c.env.DB.prepare(`SELECT store,id,data,updated,deleted FROM registros WHERE store IN (${marks}) AND updated>?`).bind(...names,since).all();
 }else{
  q=trash?await c.env.DB.prepare("SELECT store,id,data,updated,deleted FROM registros WHERE store>=? AND store<? AND deleted=1 AND updated>=?").bind(pre,pre+"\uffff",cutoff).all():await c.env.DB.prepare("SELECT store,id,data,updated,deleted FROM registros WHERE store>=? AND store<? AND updated>?").bind(pre,pre+"\uffff",since).all();
 }
 const rows=(q.results||[]).map(r=>({...r,store:r.store.slice(pre.length)}));
 if(store==="global"||(!store&&!loja)){
  const lim=await storeLimit(c.env,a.tenant);
  if(!rows.some(r=>r.store==="global"&&r.id==="lojas"))rows.push({store:"global",id:"lojas",data:JSON.stringify({stores:Array.from({length:lim},(_,i)=>({n:i+1,name:i===0?(a.tenant.company_name||a.tenant.business_name):`${a.tenant.company_name||a.tenant.business_name} - Loja ${i+1}`,on:true}))}),updated:1700000000000+lim,deleted:0});
 }
 return json({success:true,now:Date.now(),records:rows});
}
export async function onRequestPost(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const body=await readJson(c.request);if(!body)return fail("JSON inválido.");
 const lista=Array.isArray(body.records)?body.records:[body],pre=a.tenant.id+"~",lim=await storeLimit(c.env,a.tenant),D=c.env.DB;
 // Uma exclusão é definitiva para aquele ID: um cliente com cache antigo não pode ressuscitar o registro.
 const stmt=D.prepare("INSERT INTO registros (store,id,data,updated,deleted) VALUES (?,?,?,?,?) ON CONFLICT(store,id) DO UPDATE SET data=CASE WHEN excluded.deleted=1 THEN CASE WHEN excluded.data IS NOT NULL AND excluded.data<>'' THEN excluded.data ELSE registros.data END ELSE excluded.data END,updated=MAX(?,registros.updated+1),deleted=CASE WHEN excluded.deleted=1 THEN 1 ELSE excluded.deleted END WHERE registros.deleted=0 AND (excluded.deleted=1 OR ? >= registros.updated)");
 const stmtG=D.prepare("INSERT INTO registros (store,id,data,updated,deleted) VALUES (?,?,?,?,?) ON CONFLICT(store,id) DO UPDATE SET data=excluded.data,updated=excluded.updated,deleted=excluded.deleted");
 const stamp=Date.now(),lote=[];let rej=0;
 for(const r of lista){
  if(!r||!r.id)continue;const ps=parse(r.store);if(!ps)continue;
  if(ps.base==="global"){if(String(r.id)!=="adm")continue}
  else if(ps.n>lim){rej++;continue}
  const dados=typeof r.data==="string"?r.data:JSON.stringify(r.data??null),g=ps.base==="global";
  lote.push(g?stmtG.bind(pre+r.store,String(r.id),dados,stamp,r.deleted?1:0):stmt.bind(pre+r.store,String(r.id),dados,stamp,r.deleted?1:0,stamp,Number(r.updated)||0));
 }
 for(let i=0;i<lote.length;i+=50)await D.batch(lote.slice(i,i+50));
 return json({success:true,saved:lote.length,rejected:rej,stamp});
}
