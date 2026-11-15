import {json,fail,uid,cleanText,int,painelCtx} from "../../_lib/comanda.js";
import {readJson} from "../../_lib/http.js";
const T=()=>Date.now();
export async function onRequestGet(c){
 const x=await painelCtx(c);if(x.error)return x.error;
 const q=await c.env.DB.prepare("SELECT m.id,m.numero,m.lugares,m.ativo,m.ordem,m.codigo,(SELECT id FROM cm_comandas k WHERE k.mesa_id=m.id AND k.status='aberta' LIMIT 1) comanda_id FROM cm_mesas m WHERE m.tenant_id=? AND m.loja=? ORDER BY m.ordem,CAST(m.numero AS INTEGER),m.numero").bind(x.tid,x.loja).all();
 return json({mesas:q.results||[]});
}
export async function onRequestPost(c){
 const b=await readJson(c.request)||{};
 const x=await painelCtx(c,b.loja);if(x.error)return x.error;
 const D=c.env.DB,{tid,loja}=x;
 if(b.action==="lote"){ // cria as mesas de 1 até N que ainda não existem
  const ate=int(b.ate,1,200,0);if(!ate)return fail("Informe quantas mesas.");
  const st=[];for(let i=1;i<=ate;i++)st.push(D.prepare("INSERT OR IGNORE INTO cm_mesas(id,tenant_id,loja,numero,lugares,ordem,updated) VALUES(?,?,?,?,4,?,?)").bind(uid(),tid,loja,String(i),i,T()));
  await D.batch(st);return json({ok:true});
 }
 if(b.action==="salvar"){
  const numero=cleanText(b.numero,12);if(!numero)return fail("Informe o número ou nome da mesa.");
  const id=b.id?String(b.id):uid();
  try{
   await D.prepare("INSERT INTO cm_mesas(id,tenant_id,loja,numero,lugares,ativo,ordem,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET numero=excluded.numero,lugares=excluded.lugares,ativo=excluded.ativo,ordem=excluded.ordem,updated=excluded.updated WHERE cm_mesas.tenant_id=excluded.tenant_id AND cm_mesas.loja=excluded.loja")
    .bind(id,tid,loja,numero,int(b.lugares,1,50,4),b.ativo===0||b.ativo===false?0:1,int(b.ordem,0,999,0),T()).run();
  }catch(e){return fail("Já existe uma mesa com esse número.")}
  return json({ok:true,id});
 }
 if(b.action==="excluir"){
  const id=String(b.id||"");
  if(await D.prepare("SELECT 1 FROM cm_comandas WHERE mesa_id=? AND status='aberta'").bind(id).first())return fail("A mesa está com a conta aberta.");
  await D.prepare("DELETE FROM cm_mesas WHERE id=? AND tenant_id=? AND loja=?").bind(id,tid,loja).run();
  return json({ok:true});
 }
 return fail("Ação inválida.");
}
