import {json,fail,readJson,cleanText} from "../../_lib/http.js";
import {session,requireTenant} from "../../_lib/auth.js";
import {presenceSnapshot} from "../../_lib/presence.js";
import {inboxFor} from "../../_lib/messages.js";
const ID=/^[A-Za-z0-9_-]{8,64}$/;
// POST {cid,tab,page}  → registra "estou aberto" e devolve: (cliente) mensagens pendentes | (master) quem está online.
// POST {cid,tab,bye:true} → navegador fechando: remove na hora.
export async function onRequestPost(c){
 const b=await readJson(c.request);
 if(!b||!ID.test(String(b.cid||""))||!ID.test(String(b.tab||"")))return fail("Dados inválidos.");
 const D=c.env.DB;
 if(b.bye){await D.prepare("DELETE FROM presence WHERE cid=? AND tab=?").bind(b.cid,b.tab).run();return json({ok:true})}
 const s=await session(c);
 if(!s)return json({ok:false,authenticated:false},401);
 const page=cleanText(b.page,40),n=Date.now();
 if(s.role==="master"){
  await D.prepare("INSERT INTO presence(cid,tab,role,tenant_id,label,page,last_seen) VALUES(?,?, 'master',NULL,'Master',?,?) ON CONFLICT(cid,tab) DO UPDATE SET role='master',tenant_id=NULL,label='Master',page=excluded.page,last_seen=excluded.last_seen").bind(b.cid,b.tab,page,n).run();
  if(Math.random()<0.05)await D.prepare("DELETE FROM presence WHERE last_seen<?").bind(n-86400000).run(); // limpeza de linhas antigas
  return json({ok:true,role:"master",presence:await presenceSnapshot(c.env)});
 }
 const a=await requireTenant(c,{allowExpired:true});if(a.error)return json({ok:false,authenticated:false},401);
 const t=a.tenant,label=cleanText(t.company_name||t.business_name,60);
 await D.prepare("INSERT INTO presence(cid,tab,role,tenant_id,label,page,last_seen) VALUES(?,?, 'tenant',?,?,?,?) ON CONFLICT(cid,tab) DO UPDATE SET role='tenant',tenant_id=excluded.tenant_id,label=excluded.label,page=excluded.page,last_seen=excluded.last_seen").bind(b.cid,b.tab,t.id,label,page,n).run();
 return json({ok:true,role:"tenant",messages:await inboxFor(c.env,t)});
}
