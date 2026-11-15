import {json,fail,readJson,now} from "../../_lib/http.js";
const enc=new TextEncoder();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("");
export async function onRequestPost(c){
 const secret=c.env.PAYMENT_WEBHOOK_SECRET;
 if(!secret)return fail("Webhook não configurado.",503);
 const raw=await c.request.text(),provided=c.request.headers.get("x-payment-signature")||"";
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const expected=hex(await crypto.subtle.sign("HMAC",key,enc.encode(raw)));
 if(provided!==expected)return fail("Assinatura inválida.",401);
 let b;try{b=JSON.parse(raw)}catch{return fail("JSON inválido.")};
 if(b.event!=="payment.paid"||!b.transaction_id)return fail("Evento não reconhecido.");
 const tx=await c.env.DB.prepare("SELECT t.id,t.tenant_id,t.plan_id,t.status,p.interval_days FROM transactions t JOIN plans p ON p.id=t.plan_id WHERE t.id=?").bind(b.transaction_id).first();
 if(!tx)return fail("Transação não encontrada.",404);
 if(tx.status!=="paid"){
  const tenant=await c.env.DB.prepare("SELECT license_expires_at FROM tenants WHERE id=?").bind(tx.tenant_id).first();
  const base=tenant?.license_expires_at&&new Date(tenant.license_expires_at)>new Date()?new Date(tenant.license_expires_at):new Date();
  base.setDate(base.getDate()+tx.interval_days);
  await c.env.DB.batch([
   c.env.DB.prepare("UPDATE transactions SET status='paid',paid_at=? WHERE id=?").bind(now(),tx.id),
   c.env.DB.prepare("UPDATE tenants SET status='active',plan_id=?,license_expires_at=?,updated_at=? WHERE id=?").bind(tx.plan_id,base.toISOString(),now(),tx.tenant_id)
  ]);
 }
 return json({received:true});
}
