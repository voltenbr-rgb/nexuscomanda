import {json,fail,lojaPublica,getConfig,nomeLoja,pinHash,atendenteCookie,atendenteLogoutCookie,logoLoja} from "../../../_lib/comanda.js";
import {readJson,uid} from "../../../_lib/http.js";
// Login do garçom/atendente: escolhe o nome e digita o PIN. Bloqueia após 8 tentativas erradas em 15 min (por loja).
export async function onRequestGet(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Loja não encontrada ou indisponível.",404);
 const cfg=await getConfig(c.env,L.tid,L.loja);
 const q=await c.env.DB.prepare("SELECT id,nome,papel FROM cm_atendentes WHERE tenant_id=? AND loja=? AND ativo=1 ORDER BY nome").bind(L.tid,L.loja).all();
 return json({loja:{nome:await nomeLoja(c.env,L.t,L.loja,cfg),logo:await logoLoja(c.env,L.tid,L.loja,cfg)},equipe:q.results||[]});
}
export async function onRequestPost(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Loja não encontrada ou indisponível.",404);
 const b=await readJson(c.request)||{},D=c.env.DB,chave=`pin:${L.tid}:${L.loja}`,desde=Date.now()-900000;
 if(((await D.prepare("SELECT COUNT(*) n FROM auth_attempts WHERE email=? AND attempted_at>?").bind(chave,desde).first())?.n||0)>=8)return fail("Muitas tentativas. Aguarde 15 minutos.",429);
 const a=await D.prepare("SELECT id,nome,papel,pin_hash,pin_salt FROM cm_atendentes WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(String(b.id||""),L.tid,L.loja).first();
 if(!a||await pinHash(String(b.pin||""),a.pin_salt)!==a.pin_hash){
  await D.prepare("INSERT INTO auth_attempts(id,email,attempted_at) VALUES(?,?,?)").bind(uid(),chave,Date.now()).run();
  return fail("PIN incorreto.",401);
 }
 return json({ok:true,atendente:{id:a.id,nome:a.nome,papel:a.papel}},200,{"set-cookie":await atendenteCookie(c,{tid:L.tid,loja:L.loja,aid:a.id})});
}
export async function onRequestDelete(c){return json({ok:true},200,{"set-cookie":atendenteLogoutCookie(c)})}
