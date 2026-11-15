// Lixeira de contas de teste: quem fez o teste grátis, o teste acabou e NUNCA contratou plano vai para a lixeira.
// Fica lá por TRASH_DAYS dias (pode ser restaurado pelo master ou pagar o plano normalmente) e depois é apagado sozinho.
// Nunca entra na lixeira: quem já teve pagamento confirmado, quem recebeu liberação do master (license_expires_at),
// contas suspensas/ativas e a conta "Cliente Teste" da entrada rápida.
export const TRASH_DAYS=30;
const DEMO_PHONE="00000000000";
const DAY=86400000;
// Condição SQL (sobre a tabela tenants, alias t) de "está na lixeira". Parâmetro: agora (ISO).
export const TRASH_SQL=`t.status IN ('trial','expired') AND t.license_expires_at IS NULL AND t.trial_expires_at IS NOT NULL AND t.trial_expires_at < ? AND COALESCE(t.phone,'')<>'${DEMO_PHONE}' AND NOT EXISTS (SELECT 1 FROM transactions x WHERE x.tenant_id=t.id AND x.status='paid')`;
export const purgeDate=trialEnd=>new Date(new Date(trialEnd).getTime()+TRASH_DAYS*DAY).toISOString();

// Apaga o cliente e TODOS os dados ligados a ele (em todas as tabelas que existirem neste banco).
export async function purgeTenant(env,tid){
 const D=env.DB;
 const have=new Set(((await D.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results||[]).map(r=>r.name));
 const st=[];
 const add=(table,sql,...args)=>{if(have.has(table))st.push(D.prepare(sql).bind(...args))};
 add("registros","DELETE FROM registros WHERE substr(store,1,?)=?",tid.length+1,tid+"~");
 add("terminal_charges","DELETE FROM terminal_charges WHERE tenant_id=?",tid);
 add("store_payment_terminals","DELETE FROM store_payment_terminals WHERE tenant_id=?",tid);
 add("store_links","DELETE FROM store_links WHERE tenant_id=?",tid);
 add("tenant_records","DELETE FROM tenant_records WHERE tenant_id=?",tid);
 add("stores","DELETE FROM stores WHERE tenant_id=?",tid);
 add("transactions","DELETE FROM transactions WHERE tenant_id=?",tid);
 add("presence","DELETE FROM presence WHERE tenant_id=?",tid);
 add("message_receipts","DELETE FROM message_receipts WHERE tenant_id=?",tid);
 add("message_replies","DELETE FROM message_replies WHERE tenant_id=?",tid);
 add("messages","DELETE FROM messages WHERE target_tenant=?",tid);
 st.push(D.prepare("DELETE FROM tenants WHERE id=?").bind(tid));
 await D.batch(st); // tudo ou nada
}

// Apaga quem está na lixeira há mais de TRASH_DAYS dias. Roda no máximo a cada 6 h por instância (e sempre que o master abre o painel).
let last=0;
export async function purgeExpiredTrash(env,{force=false}={}){
 if(!force&&Date.now()-last<6*3600000)return 0;
 last=Date.now();
 const nowIso=new Date().toISOString(),cut=new Date(Date.now()-TRASH_DAYS*DAY).toISOString();
 const rows=(await env.DB.prepare(`SELECT t.id FROM tenants t WHERE ${TRASH_SQL} AND t.trial_expires_at < ? LIMIT 25`).bind(nowIso,cut).all()).results||[];
 let n=0;
 for(const r of rows){try{await purgeTenant(env,r.id);n++}catch(e){console.error("lixeira: falha ao apagar",r.id,e?.message||e)}}
 return n;
}
