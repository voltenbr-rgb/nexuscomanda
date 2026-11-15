import {json,fail,lojaPublica,getConfig,nomeLoja,mesaCookie,mesaSairCookie,mesaCtx} from "../../../_lib/comanda.js";
import {readJson,uid} from "../../../_lib/http.js";
// Pedido do cliente na mesa (/mesa/<loja>): lista de mesas e entrada com a senha que o garçom passou.
export async function onRequestGet(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Loja não encontrada ou indisponível.",404);
 const cfg=await getConfig(c.env,L.tid,L.loja);
 const base={loja:{nome:await nomeLoja(c.env,L.t,L.loja,cfg),logo:cfg.logo,capa:cfg.capa},ativo:!!cfg.mesa_auto};
 if(!cfg.mesa_auto)return json(base);
 const ms=(await c.env.DB.prepare("SELECT id,numero FROM cm_mesas WHERE tenant_id=? AND loja=? AND ativo=1 ORDER BY ordem,CAST(numero AS INTEGER),numero").bind(L.tid,L.loja).all()).results||[];
 const s=await mesaCtx(c,c.params.slug);
 return json({...base,mesas:ms,sessao:s.error?null:{mesa_id:s.mesa.id,numero:s.mesa.numero}});
}
// {mesa_id, codigo}. Bloqueia após 15 senhas erradas em 15 min na loja.
export async function onRequestPost(c){
 const L=await lojaPublica(c.env,c.params.slug);if(!L)return fail("Loja não encontrada ou indisponível.",404);
 const cfg=await getConfig(c.env,L.tid,L.loja);
 if(!cfg.mesa_auto)return fail("Pedido pela mesa não está disponível nesta loja. Chame o garçom.",403);
 const b=await readJson(c.request)||{},D=c.env.DB,chave=`mesa:${L.tid}:${L.loja}`;
 if(((await D.prepare("SELECT COUNT(*) n FROM auth_attempts WHERE email=? AND attempted_at>?").bind(chave,Date.now()-900000).first())?.n||0)>=15)return fail("Muitas tentativas. Chame o garçom.",429);
 const m=await D.prepare("SELECT id,numero,codigo FROM cm_mesas WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(String(b.mesa_id||""),L.tid,L.loja).first();
 if(!m)return fail("Mesa não encontrada.",404);
 if(!m.codigo)return fail(`A mesa ${m.numero} ainda não foi liberada para pedir pelo celular. Peça a senha ao garçom.`,403);
 if(String(b.codigo||"").trim()!==m.codigo){
  await D.prepare("INSERT INTO auth_attempts(id,email,attempted_at) VALUES(?,?,?)").bind(uid(),chave,Date.now()).run();
  return fail("Senha incorreta. Confira com o garçom.",401);
 }
 return json({ok:true,mesa:{id:m.id,numero:m.numero}},200,{"set-cookie":await mesaCookie(c,{tid:L.tid,loja:L.loja,mid:m.id,cod:m.codigo})});
}
export async function onRequestDelete(c){return json({ok:true},200,{"set-cookie":mesaSairCookie(c)})}
