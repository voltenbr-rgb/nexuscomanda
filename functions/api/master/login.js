import {json,fail,readJson,cookie} from "../../_lib/http.js";
import {signSession,secretOf,MASTER_DEFAULT_PASSWORD} from "../../_lib/auth.js";
// Acesso Master. Aceita até duas senhas, cada uma num secret do Cloudflare: MASTER_PASSWORD (titular) e MASTER_PASSWORD_2 (sócio).
// Enquanto nenhuma das duas existir, vale a senha de teste 1989.
const same=(a,b)=>{a=String(a);b=String(b);let d=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)d|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return d===0};
export async function onRequestPost(c){
 const b=await readJson(c.request);if(!b?.password)return fail("Informe a senha.");
 const stamp=Math.floor(Date.now()/60000);
 const n=await c.env.DB.prepare("SELECT COUNT(*) n FROM auth_attempts WHERE email='__master__' AND attempted_at>?").bind(stamp-15).first();
 if((n?.n||0)>=10)return fail("Muitas tentativas. Aguarde 15 minutos.",429);
 const senhas=[c.env.MASTER_PASSWORD,c.env.MASTER_PASSWORD_2].filter(v=>typeof v==="string"&&v.length>0);if(!senhas.length)senhas.push(MASTER_DEFAULT_PASSWORD);
 const quem=senhas.findIndex(v=>same(b.password,v)); // compara com todas (tempo constante em cada uma)
 if(quem<0){
  await c.env.DB.prepare("INSERT INTO auth_attempts(id,email,attempted_at) VALUES(?,?,?)").bind(crypto.randomUUID(),"__master__",stamp).run();
  return fail("Senha incorreta.",401);
 }
 const token=await signSession({role:"master",who:quem+1,exp:Date.now()+4*3600000},secretOf(c.env));
 return json({ok:true},200,{"set-cookie":cookie("nexus_session",token,{maxAge:14400,secure:new URL(c.request.url).protocol==="https:"})});
}
