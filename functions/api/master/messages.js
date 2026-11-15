import {json,fail,readJson,uid} from "../../_lib/http.js";
import {requireMaster} from "../../_lib/auth.js";
import {cleanMsg} from "../../_lib/messages.js";
// Histórico de mensagens enviadas/agendadas, com quem leu e as respostas.
export async function onRequestGet(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 const D=c.env.DB,n=Date.now();
 const ms=(await D.prepare("SELECT m.id,m.body,m.needs_reply,m.target_tenant,m.send_at,m.created_at,t.business_name target_name FROM messages m LEFT JOIN tenants t ON t.id=m.target_tenant ORDER BY m.send_at DESC LIMIT 60").all()).results||[];
 const total=Number((await D.prepare("SELECT COUNT(*) n FROM tenants").first())?.n||0);
 const reads=(await D.prepare("SELECT message_id,COUNT(*) n FROM message_receipts WHERE read_at IS NOT NULL GROUP BY message_id").all()).results||[];
 const rp=(await D.prepare("SELECT r.id,r.message_id,r.body,r.created_at,t.business_name,t.company_name FROM message_replies r LEFT JOIN tenants t ON t.id=r.tenant_id ORDER BY r.created_at ASC").all()).results||[];
 const readBy={};for(const r of reads)readBy[r.message_id]=Number(r.n);
 const repBy={};for(const r of rp)(repBy[r.message_id]??=[]).push({id:r.id,from:r.company_name||r.business_name||"Cliente",body:r.body,created_at:r.created_at});
 return json({now:n,messages:ms.map(m=>({id:m.id,body:m.body,needs_reply:!!m.needs_reply,target_name:m.target_tenant?(m.target_name||"Cliente removido"):null,send_at:m.send_at,created_at:m.created_at,sent:m.send_at<=n,recipients:m.target_tenant?1:total,read:readBy[m.id]||0,replies:repBy[m.id]||[]}))});
}
// {body, needs_reply, target_tenant|null, send_at|null (ms; vazio = agora)}
export async function onRequestPost(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 const b=await readJson(c.request)||{},body=cleanMsg(b.body,1000);
 if(!body)return fail("Escreva a mensagem.");
 const n=Date.now();let at=b.send_at==null||b.send_at===""?n:Number(b.send_at);
 if(!Number.isFinite(at))return fail("Horário inválido.");
 if(at<n)at=n;if(at>n+366*86400000)return fail("O agendamento pode ser de até 1 ano.");
 let target=null;
 if(b.target_tenant){target=String(b.target_tenant);if(!await c.env.DB.prepare("SELECT id FROM tenants WHERE id=?").bind(target).first())return fail("Cliente não encontrado.",404)}
 const id=uid();
 await c.env.DB.prepare("INSERT INTO messages(id,body,needs_reply,target_tenant,send_at,created_at) VALUES(?,?,?,?,?,?)").bind(id,body,b.needs_reply?1:0,target,at,n).run();
 return json({ok:true,id,scheduled:at>n+1000,send_at:at},201);
}
// DELETE ?id=X → cancela agendada ou apaga (some também da tela dos clientes)
export async function onRequestDelete(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 const id=new URL(c.request.url).searchParams.get("id");if(!id)return fail("Mensagem obrigatória.");
 const D=c.env.DB;
 await D.batch([D.prepare("DELETE FROM message_replies WHERE message_id=?").bind(id),D.prepare("DELETE FROM message_receipts WHERE message_id=?").bind(id),D.prepare("DELETE FROM messages WHERE id=?").bind(id)]);
 return json({ok:true});
}
