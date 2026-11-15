import {getCookie,cookie,b64u,unb64u,now} from "./http.js";
const enc=new TextEncoder();
async function key(secret){return crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"])}
export async function signSession(payload,secret){
 const body=b64u(enc.encode(JSON.stringify(payload)));
 const sig=b64u(await crypto.subtle.sign("HMAC",await key(secret),enc.encode(body)));
 return `${body}.${sig}`;
}
export async function verifySession(token,secret){
 if(!token||!secret)return null;
 const [body,sig]=token.split(".");
 if(!body||!sig)return null;
 try{
  const ok=await crypto.subtle.verify("HMAC",await key(secret),unb64u(sig),enc.encode(body));
  if(!ok)return null;
  const p=JSON.parse(new TextDecoder().decode(unb64u(body)));
  if(!p.exp||p.exp<Date.now())return null;
  return p;
 }catch{return null}
}
export const secretOf=env=>env.SESSION_SECRET||"nexus-teste-segredo-padrao-troque-em-producao-2026";
export const MASTER_DEFAULT_PASSWORD="1989";
export async function session(context){
 const token=getCookie(context.request,"nexus_session");
 return verifySession(token,secretOf(context.env));
}
export async function storeLimit(env,tenant){
 if(tenant.max_stores_override!=null)return Math.max(1,Number(tenant.max_stores_override));
 if(!tenant.plan_id||tenant.status!=="active")return 1;
 const p=await env.DB.prepare("SELECT max_stores FROM plans WHERE id=?").bind(tenant.plan_id).first();
 return Math.max(1,Number(p?.max_stores||1));
}
const jerr=(msg,status,extra={})=>new Response(JSON.stringify({error:msg,...extra}),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
// Toda rota de cliente passa por aqui: o tenant vem SEMPRE da sessão assinada (nunca de parâmetro da requisição)
// e a sessão fica amarrada ao telefone da conta (se o telefone mudar, a sessão antiga deixa de valer).
export async function requireTenant(context,opts={}){
 const s=await session(context);
 if(!s||s.role!=="tenant"||!s.tid)return {error:jerr("Não autenticado",401)};
 const tenant=await context.env.DB.prepare("SELECT id,business_name,company_name,niche_label,phone,segment,status,created_at,trial_expires_at,license_expires_at,theme_mode,color_palette,custom_color,panel_model_id,plan_id,auto_renew,card_last4,max_stores_override FROM tenants WHERE id=?").bind(s.tid).first();
 if(!tenant)return {error:jerr("Conta não encontrada",401)};
 if((s.ph||null)!==(tenant.phone||null))return {error:jerr("Sessão inválida. Entre novamente.",401)};
 const until=tenant.status==="trial"?tenant.trial_expires_at:tenant.license_expires_at;
 const lapsed=tenant.status==="expired"||(tenant.status!=="suspended"&&until&&new Date(until)<new Date());
 if(lapsed&&tenant.status!=="expired"){await context.env.DB.prepare("UPDATE tenants SET status='expired',updated_at=? WHERE id=?").bind(now(),tenant.id).run();tenant.status="expired"}
 if(tenant.status==="suspended"&&!opts.allowExpired)return {error:jerr("Conta suspensa pelo administrador.",402)};
 if(lapsed&&!opts.allowExpired)return {error:jerr("Licença expirada. Renove seu plano para continuar.",402,{code:"expired"})};
 return {session:s,tenant};
}
// Prefixo de TODOS os registros do cliente na tabela "registros" (ex.: "<tenant_id>~clients@2").
export const tenantPrefix=tenant=>tenant.id+"~";
// Cria o cookie de sessão do cliente (7 dias), já amarrado ao telefone.
export async function tenantSessionCookie(context,tenant){
 const token=await signSession({role:"tenant",tid:tenant.id,ph:tenant.phone||null,exp:Date.now()+7*86400000},secretOf(context.env));
 return cookie("nexus_session",token,{maxAge:604800,secure:new URL(context.request.url).protocol==="https:"});
}
export async function requireMaster(context){
 const s=await session(context);
 if(!s||s.role!=="master")return {error:new Response(JSON.stringify({error:"Acesso master necessário"}),{status:403,headers:{"content-type":"application/json"}})};
 return {session:s};
}
export async function passwordHash(password,salt){
 const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:new TextEncoder().encode(salt),iterations:100000,hash:"SHA-256"},material,256);
 return b64u(bits);
}
export const newSalt=()=>b64u(crypto.getRandomValues(new Uint8Array(16)));

// Senha recuperável (somente para o painel Master de teste): guardada CIFRADA (AES-GCM), nunca em texto puro.
// A chave deriva de SESSION_SECRET; se esse segredo mudar, as senhas antigas deixam de poder ser exibidas.
async function pwKey(env){return crypto.subtle.importKey("raw",await crypto.subtle.digest("SHA-256",enc.encode("nexus-pw-enc:"+secretOf(env))),"AES-GCM",false,["encrypt","decrypt"])}
export async function encryptPassword(env,pw){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},await pwKey(env),enc.encode(String(pw)));
 return b64u(iv)+"."+b64u(ct);
}
export async function decryptPassword(env,stored){
 if(!stored)return null;
 try{
  const [iv,ct]=stored.split(".");
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64u(iv)},await pwKey(env),unb64u(ct)));
 }catch{return null}
}
// Grava senha nova (hash + cópia cifrada) para um cliente.
export async function setTenantPassword(env,tenantId,password){
 const salt=newSalt(),hash=await passwordHash(String(password),salt),encd=await encryptPassword(env,password);
 await env.DB.prepare("UPDATE tenants SET password_hash=?,password_salt=?,password_enc=?,updated_at=? WHERE id=?").bind(hash,salt,encd,now(),tenantId).run();
}
