import {json,fail,uid,cleanText,painelCtx,novoPin,pinValido} from "../../_lib/comanda.js";
import {readJson} from "../../_lib/http.js";
// Garçons e atendentes de caixa: entram no link /garcom/<loja> com nome + PIN (o PIN nunca é guardado em texto).
const T=()=>Date.now();
export async function onRequestGet(c){
 const x=await painelCtx(c);if(x.error)return x.error;
 const q=await c.env.DB.prepare("SELECT id,nome,papel,ativo FROM cm_atendentes WHERE tenant_id=? AND loja=? ORDER BY nome").bind(x.tid,x.loja).all();
 return json({equipe:q.results||[]});
}
export async function onRequestPost(c){
 const b=await readJson(c.request)||{};
 const x=await painelCtx(c,b.loja);if(x.error)return x.error;
 const D=c.env.DB,{tid,loja}=x;
 if(b.action==="salvar"){
  const nome=cleanText(b.nome,40);if(!nome)return fail("Informe o nome.");
  const papel=b.papel==="caixa"?"caixa":"garcom",ativo=b.ativo===0||b.ativo===false?0:1;
  if(b.id){
   const id=String(b.id);
   if(!await D.prepare("SELECT 1 FROM cm_atendentes WHERE id=? AND tenant_id=? AND loja=?").bind(id,tid,loja).first())return fail("Atendente não encontrado.",404);
   if(b.pin){if(!pinValido(b.pin))return fail("O PIN deve ter de 4 a 6 números.");const p=await novoPin(b.pin);await D.prepare("UPDATE cm_atendentes SET pin_hash=?,pin_salt=? WHERE id=?").bind(p.pin_hash,p.pin_salt,id).run()}
   await D.prepare("UPDATE cm_atendentes SET nome=?,papel=?,ativo=?,updated=? WHERE id=?").bind(nome,papel,ativo,T(),id).run();
   return json({ok:true,id});
  }
  if(!pinValido(b.pin))return fail("Crie um PIN de 4 a 6 números.");
  const id=uid(),p=await novoPin(b.pin);
  await D.prepare("INSERT INTO cm_atendentes(id,tenant_id,loja,nome,papel,pin_hash,pin_salt,ativo,updated) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,tid,loja,nome,papel,p.pin_hash,p.pin_salt,ativo,T()).run();
  return json({ok:true,id},201);
 }
 if(b.action==="excluir"){
  await D.prepare("DELETE FROM cm_atendentes WHERE id=? AND tenant_id=? AND loja=?").bind(String(b.id||""),tid,loja).run();
  return json({ok:true});
 }
 return fail("Ação inválida.");
}
