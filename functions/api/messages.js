import {json,fail,readJson,uid} from "../_lib/http.js";
import {requireTenant} from "../_lib/auth.js";
import {inboxFor,cleanMsg} from "../_lib/messages.js";
// Ações do cliente sobre uma mensagem recebida: {id, action:"read"|"close"|"reply", text}
export async function onRequestPost(c){
 const a=await requireTenant(c,{allowExpired:true});if(a.error)return a.error;
 const b=await readJson(c.request);if(!b?.id)return fail("Mensagem inválida.");
 const D=c.env.DB,t=a.tenant,n=Date.now();
 const m=(await inboxFor(c.env,t)).find(x=>x.id===b.id);
 if(!m)return json({ok:true,gone:true}); // já fechada, apagada ou não é para este cliente
 if(b.action==="read"){
  await D.prepare("INSERT INTO message_receipts(message_id,tenant_id,read_at,done) VALUES(?,?,?,0) ON CONFLICT(message_id,tenant_id) DO UPDATE SET read_at=COALESCE(message_receipts.read_at,excluded.read_at)").bind(m.id,t.id,n).run();
  return json({ok:true});
 }
 if(b.action==="close"){
  if(m.needs_reply)return fail("Esta mensagem precisa de resposta.");
  await D.prepare("INSERT INTO message_receipts(message_id,tenant_id,read_at,done) VALUES(?,?,?,1) ON CONFLICT(message_id,tenant_id) DO UPDATE SET read_at=COALESCE(message_receipts.read_at,excluded.read_at),done=1").bind(m.id,t.id,n).run();
  return json({ok:true});
 }
 if(b.action==="reply"){
  if(!m.needs_reply)return fail("Esta mensagem não aceita resposta.");
  const text=cleanMsg(b.text,1000);if(!text)return fail("Escreva a resposta.");
  await D.batch([
   D.prepare("INSERT INTO message_replies(id,message_id,tenant_id,body,created_at) VALUES(?,?,?,?,?)").bind(uid(),m.id,t.id,text,n),
   D.prepare("INSERT INTO message_receipts(message_id,tenant_id,read_at,done) VALUES(?,?,?,1) ON CONFLICT(message_id,tenant_id) DO UPDATE SET read_at=COALESCE(message_receipts.read_at,excluded.read_at),done=1").bind(m.id,t.id,n)
  ]);
  return json({ok:true});
 }
 return fail("Ação inválida.");
}
