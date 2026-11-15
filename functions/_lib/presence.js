// Presença em tempo real: cada navegador/aba aberto envia um "ping" a cada poucos segundos.
// Contam como online os que pingaram nos últimos ONLINE_MS. "Navegador" = o id guardado no navegador (cid);
// várias abas do mesmo navegador contam como 1.
export const ONLINE_MS=200000;
export async function presenceSnapshot(env){
 const D=env.DB,since=Date.now()-ONLINE_MS;
 const rows=(await D.prepare("SELECT role,tenant_id,label,cid,COUNT(*) tabs,MAX(last_seen) seen FROM presence WHERE last_seen>? GROUP BY role,tenant_id,cid").bind(since).all()).results||[];
 const master={browsers:0},clients={browsers:0,tenants:0,list:[]},by={};
 for(const r of rows){
  if(r.role==="master"){master.browsers++;continue}
  clients.browsers++;
  const t=(by[r.tenant_id]??={tenant_id:r.tenant_id,label:r.label||"Cliente",browsers:0,seen:0});
  t.browsers++;t.seen=Math.max(t.seen,Number(r.seen)||0);
 }
 clients.list=Object.values(by).sort((a,b)=>b.seen-a.seen);clients.tenants=clients.list.length;
 return {now:Date.now(),master,clients};
}
