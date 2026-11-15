import {json,fail,readJson} from "../../_lib/http.js";
import {passwordHash,tenantSessionCookie} from "../../_lib/auth.js";
import {normalizePhone,PHONE_ERROR} from "../../_lib/phone.js";
// Login do cliente: Telefone (com DDD) + Senha. Sem nome de usuário, então não há problema de maiúsculas/minúsculas.
export async function onRequestPost(c){
 const b=await readJson(c.request);
 if(!b?.phone||!b?.password)return fail("Informe telefone e senha.");
 const phone=normalizePhone(b.phone);
 if(!phone)return fail(PHONE_ERROR);
 const key="tel:"+phone,stamp=Math.floor(Date.now()/60000);
 const attempts=await c.env.DB.prepare("SELECT COUNT(*) n FROM auth_attempts WHERE email=? AND attempted_at>?").bind(key,stamp-15).first();
 if((attempts?.n||0)>=10)return fail("Muitas tentativas. Aguarde 15 minutos.",429);
 const t=await c.env.DB.prepare("SELECT id,phone,password_hash,password_salt FROM tenants WHERE phone=?").bind(phone).first();
 if(!t||await passwordHash(String(b.password),t.password_salt)!==t.password_hash){
  await c.env.DB.prepare("INSERT INTO auth_attempts(id,email,attempted_at) VALUES(?,?,?)").bind(crypto.randomUUID(),key,stamp).run();
  return fail("Telefone ou senha incorretos.",401);
 }
 return json({ok:true},200,{"set-cookie":await tenantSessionCookie(c,t)});
}
