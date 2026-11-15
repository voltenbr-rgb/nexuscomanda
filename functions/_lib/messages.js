// Mensagens do Master para os clientes. "Enviada" = send_at já passou (o agendamento é avaliado na hora da leitura, sem cron).
const WINDOW_MS=30*86400000; // mensagens mais antigas que 30 dias não aparecem para quem acabou de entrar
const created=t=>{const d=new Date(String(t||"").includes("T")?t:String(t||"").replace(" ","T")+"Z");return isNaN(d)?0:d.getTime()};
// Mensagens pendentes (ainda não fechadas/respondidas) deste cliente.
export async function inboxFor(env,tenant){
 const n=Date.now(),from=Math.max(n-WINDOW_MS,created(tenant.created_at));
 const q=await env.DB.prepare("SELECT m.id,m.body,m.needs_reply,m.send_at FROM messages m LEFT JOIN message_receipts r ON r.message_id=m.id AND r.tenant_id=? WHERE m.send_at<=? AND m.send_at>=? AND (m.target_tenant IS NULL OR m.target_tenant=?) AND COALESCE(r.done,0)=0 ORDER BY m.send_at ASC LIMIT 20").bind(tenant.id,n,from,tenant.id).all();
 return (q.results||[]).map(m=>({id:m.id,body:m.body,needs_reply:!!m.needs_reply,send_at:m.send_at}));
}
// Texto livre que preserva quebras de linha (remove só caracteres de controle e < >).
export const cleanMsg=(v,max)=>String(v??"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g,"").replace(/\r\n?/g,"\n").trim().slice(0,max);
