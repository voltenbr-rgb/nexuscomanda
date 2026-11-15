import {json,fail,readJson,now} from "../../_lib/http.js";
import {requireMaster,storeLimit,decryptPassword,setTenantPassword} from "../../_lib/auth.js";
import {normalizePhone,formatPhone,PHONE_ERROR} from "../../_lib/phone.js";
import {TRASH_SQL,TRASH_DAYS,purgeDate,purgeTenant,purgeExpiredTrash} from "../../_lib/trash.js";
// Resumo consolidado de TODOS os cadastros (somente com sessão master).
// Credenciais: o login é o telefone; a senha vem da cópia cifrada (null = conta antiga/teste, sem senha recuperável).
export async function onRequestGet(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 await purgeExpiredTrash(c.env,{force:true}).catch(e=>console.error("lixeira:",e?.message||e));
 const nowIso=now();
 const q=await c.env.DB.prepare("SELECT (CASE WHEN "+TRASH_SQL+" THEN 1 ELSE 0 END) in_trash,t.id,t.business_name,t.company_name,t.niche_label,t.phone,t.segment,t.plan_id,t.status,t.trial_expires_at,t.license_expires_at,t.created_at,t.auto_renew,t.card_last4,t.max_stores_override,t.note,t.password_enc,p.name plan_name FROM tenants t LEFT JOIN plans p ON p.id=t.plan_id ORDER BY t.created_at DESC").bind(nowIso).all();
 const rs=await c.env.DB.prepare("SELECT store FROM registros WHERE deleted=0 GROUP BY store").all();
 const open={};
 for(const r of rs.results||[]){const [tid,st]=r.store.split("~");if(!st||st==="global")continue;const n=st.includes("@")?Number(st.split("@")[1]):1;(open[tid]??=new Set()).add(n)}
 const out=[],sum={total:0,active:0,trial:0,suspended:0,expired:0,trash:0,stores_open:0};
 for(const t of q.results||[]){
  const {password_enc,in_trash,...rest}=t,lojas=[...(open[t.id]||[])].sort((x,y)=>x-y);
  const trash=in_trash?{purge_at:purgeDate(t.trial_expires_at),days_left:Math.max(0,Math.ceil((new Date(purgeDate(t.trial_expires_at))-Date.now())/86400000))}:null;
  out.push({...rest,trash,
   phone_fmt:t.phone?formatPhone(t.phone):null,
   plan_label:t.plan_name||"Sem plano (teste)",
   limit:await storeLimit(c.env,t),
   open:lojas,stores_count:lojas.length,
   credentials:{login:t.phone||null,password:await decryptPassword(c.env,password_enc)}});
  if(trash){sum.trash++;continue}
  sum.total++;sum[t.status]=(sum[t.status]||0)+1;sum.stores_open+=lojas.length;
 }
 const tx=await c.env.DB.prepare("SELECT x.id,x.tenant_id,x.plan_id,p.name plan_name,x.payment_method,x.amount_cents,x.status,x.provider,x.created_at,x.paid_at,t.business_name,t.phone FROM transactions x LEFT JOIN plans p ON p.id=x.plan_id LEFT JOIN tenants t ON t.id=x.tenant_id ORDER BY x.created_at DESC LIMIT 300").all();
 const tickets=await c.env.DB.prepare("SELECT id,name,phone,message,status,created_at FROM support_tickets ORDER BY created_at DESC LIMIT 100").all().catch(()=>({results:[]}));
 const salesRows=tx.results||[],agg=await c.env.DB.prepare("SELECT status,COUNT(*) n,COALESCE(SUM(amount_cents),0) total FROM transactions GROUP BY status").all(),byDayRows=await c.env.DB.prepare("SELECT substr(COALESCE(paid_at,created_at),1,10) day,COUNT(*) count,COALESCE(SUM(amount_cents),0) total_cents FROM transactions WHERE status='paid' GROUP BY day ORDER BY day DESC LIMIT 14").all(),byMethodRows=await c.env.DB.prepare("SELECT payment_method method,COUNT(*) count,COALESCE(SUM(CASE WHEN status='paid' THEN amount_cents ELSE 0 END),0) paid_cents,COALESCE(SUM(CASE WHEN status='pending' THEN amount_cents ELSE 0 END),0) pending_cents FROM transactions GROUP BY payment_method").all();
 const sums={};for(const x of agg.results||[])sums[x.status]={n:Number(x.n||0),total:Number(x.total||0)};
 const activePlans={};for(const t of out){if(t.status==='active'&&t.plan_id)activePlans[t.plan_id]=(activePlans[t.plan_id]||0)+1}
 return json({tenants:out,summary:sum,trash_days:TRASH_DAYS,sales:{paid_count:sums.paid?.n||0,pending_count:sums.pending?.n||0,paid_total_cents:sums.paid?.total||0,pending_total_cents:sums.pending?.total||0,by_day:(byDayRows.results||[]).reverse(),by_method:byMethodRows.results||[],active_plans:activePlans,transactions:salesRows},support:tickets.results||[]});
}
export async function onRequestPatch(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 const b=await readJson(c.request);if(b?.ticket_id){if(!["open","resolved"].includes(b.ticket_status))return fail("Status do chamado inválido.");await c.env.DB.prepare("UPDATE support_tickets SET status=? WHERE id=?").bind(b.ticket_status,b.ticket_id).run();return json({ok:true})}if(!b?.tenant_id)return fail("Cliente obrigatório.");
 if(!await c.env.DB.prepare("SELECT id FROM tenants WHERE id=?").bind(b.tenant_id).first())return fail("Cliente não encontrado.",404);
 if(b.status&&!["active","trial","expired","suspended"].includes(b.status))return fail("Status inválido.");
 if(b.new_password&&String(b.new_password).length<4)return fail("A senha deve ter no mínimo 4 caracteres.");
 if("new_phone" in b){
  const ph=normalizePhone(b.new_phone);if(!ph)return fail(PHONE_ERROR);
  const other=await c.env.DB.prepare("SELECT id FROM tenants WHERE phone=? AND id<>?").bind(ph,b.tenant_id).first();
  if(other)return fail("Esse telefone já pertence a outra conta.",409);
  await c.env.DB.prepare("UPDATE tenants SET phone=?,email=?,updated_at=? WHERE id=?").bind(ph,ph,now(),b.tenant_id).run();
 }
 if(b.status)await c.env.DB.prepare("UPDATE tenants SET status=?,updated_at=? WHERE id=?").bind(b.status,now(),b.tenant_id).run();
 if("stores_limit" in b){const v=b.stores_limit===null||b.stores_limit===""?null:Math.min(20,Math.max(1,Number(b.stores_limit)||1));await c.env.DB.prepare("UPDATE tenants SET max_stores_override=?,updated_at=? WHERE id=?").bind(v,now(),b.tenant_id).run()}
 if(b.extend_days||b.plan_id){
  let planId=null;
  if(b.plan_id){const pl=await c.env.DB.prepare("SELECT id FROM plans WHERE id=?").bind(b.plan_id).first();if(!pl)return fail("Plano inválido.");planId=pl.id}
  const days=b.extend_days?Math.min(1825,Math.max(1,Math.floor(Number(b.extend_days))||0)):0;
  if(b.extend_days&&!days)return fail("Quantidade de dias inválida.");
  const row=await c.env.DB.prepare("SELECT license_expires_at,status FROM tenants WHERE id=?").bind(b.tenant_id).first();
  // Soma a partir do vencimento atual (se ainda válido); senão, a partir de hoje.
  const base=row?.license_expires_at&&new Date(row.license_expires_at)>new Date()?new Date(row.license_expires_at):new Date();
  if(days)base.setDate(base.getDate()+days);
  if(days){
   await c.env.DB.prepare("UPDATE tenants SET status='active',license_expires_at=?,plan_id=COALESCE(?,plan_id),updated_at=? WHERE id=?").bind(base.toISOString(),planId,now(),b.tenant_id).run();
  }else{
   await c.env.DB.prepare("UPDATE tenants SET plan_id=?,updated_at=? WHERE id=?").bind(planId,now(),b.tenant_id).run();
  }
 }
 if(b.restore_trial_days){const d=Math.min(30,Math.max(1,Math.floor(Number(b.restore_trial_days))||7));await c.env.DB.prepare("UPDATE tenants SET status='trial',trial_expires_at=?,updated_at=? WHERE id=?").bind(new Date(Date.now()+d*86400000).toISOString(),now(),b.tenant_id).run()}
 if("note" in b){await c.env.DB.prepare("UPDATE tenants SET note=?,updated_at=? WHERE id=?").bind(String(b.note||"").trim().slice(0,200)||null,now(),b.tenant_id).run()}
 if(b.new_password)await setTenantPassword(c.env,b.tenant_id,b.new_password);
 return json({ok:true});
}
// DELETE ?tenant_id=X&loja=N → apaga os dados da loja N do cliente | DELETE ?tenant_id=X → apaga o cliente inteiro
export async function onRequestDelete(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 const u=new URL(c.request.url),tid=u.searchParams.get("tenant_id"),loja=Number(u.searchParams.get("loja")||0),D=c.env.DB;
 if(!tid)return fail("Cliente obrigatório.");
 if(loja>1){await D.prepare("DELETE FROM registros WHERE substr(store,1,?)=? AND store LIKE ?").bind(tid.length+1,tid+"~","%@"+loja).run();return json({ok:true})}
 if(loja===1){await D.prepare("DELETE FROM registros WHERE substr(store,1,?)=? AND store NOT LIKE '%@%' AND store NOT LIKE '%~global'").bind(tid.length+1,tid+"~").run();return json({ok:true})}
 await purgeTenant(c.env,tid);
 return json({ok:true});
}
