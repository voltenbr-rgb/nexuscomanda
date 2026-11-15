import {json,fail,readJson,uid,now,cleanText} from "../../_lib/http.js";
import {passwordHash,newSalt,encryptPassword,tenantSessionCookie} from "../../_lib/auth.js";
import {normalizePhone,PHONE_ERROR} from "../../_lib/phone.js";
// Cadastro: Nome + Telefone válido (com DDD) + Senha. O telefone é o login e identifica o tenant (1 conta por telefone).
export async function onRequestPost(c){
 const b=await readJson(c.request);
 if(!b)return fail("Dados inválidos.");
 const name=String(b.name??"").replace(/[\u0000-\u001f<>]/g,"").trim().replace(/\s+/g," ").slice(0,90),pass=String(b.password??"");
 if(name.length<2)return fail("Informe seu nome.");
 const phone=normalizePhone(b.phone);
 if(!phone)return fail(PHONE_ERROR);
 if(pass.length<4)return fail("A senha deve ter no mínimo 4 caracteres.");
 if(pass.length>100)return fail("Senha muito longa (máximo 100 caracteres).");
 // Nicho livre: "segment" escolhe o modelo do dashboard (se não for um dos prontos, usa "outro") e "niche" é o texto que o cliente escreveu.
 const SEG={restaurante:"Restaurante",pizzaria:"Pizzaria",lanchonete:"Lanchonete",sushi:"Sushi / japonês",bar:"Bar / choperia",outro:"Outro (food service)"};
 const seg=Object.hasOwn(SEG,b.segment)?b.segment:"outro";
 const niche=cleanText(b.niche,40)||SEG[seg],company=cleanText(b.company,60)||name;
 const dup="Já existe uma conta com esse telefone. Use a opção Entrar.";
 if(await c.env.DB.prepare("SELECT id FROM tenants WHERE phone=?").bind(phone).first())return fail(dup,409);
 const id=uid(),salt=newSalt(),hash=await passwordHash(pass,salt),penc=await encryptPassword(c.env,pass);
 const days=Number(c.env.TRIAL_DEFAULT_DAYS||7),expires=new Date(Date.now()+days*86400000).toISOString();
 try{
  // "email" é uma coluna legada (NOT NULL UNIQUE): guardamos o próprio telefone nela.
  await c.env.DB.prepare("INSERT INTO tenants(id,business_name,company_name,niche_label,segment,email,phone,password_hash,password_salt,password_enc,panel_model_id,status,theme_mode,trial_expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'trial','light',?,?,?)")
   .bind(id,name,company,niche,seg,phone,phone,hash,salt,penc,"comanda",expires,now(),now()).run();
 }catch(e){
  if(/UNIQUE/i.test(String(e&&e.message)))return fail(dup,409); // corrida entre dois cadastros simultâneos
  throw e;
 }
 return json({ok:true,tenant:{id,business_name:name,company_name:company,niche_label:niche,segment:seg,phone,status:"trial",trial_expires_at:expires}},201,{"set-cookie":await tenantSessionCookie(c,{id,phone})});
}
