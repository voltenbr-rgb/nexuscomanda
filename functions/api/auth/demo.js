import {json,uid,now} from "../../_lib/http.js";
import {passwordHash,newSalt,tenantSessionCookie} from "../../_lib/auth.js";
import {novoPin} from "../../_lib/comanda.js";
import {onRequestPost as catalogo} from "../comanda/catalogo.js";
// Entrada rápida de teste: conta "Cliente Teste" (criada na 1ª vez). Usa um telefone reservado/inválido (DDD 00),
// que ninguém consegue cadastrar nem usar no login — só esta rota entra nela.
const DEMO_PHONE="00000000000";
export async function onRequestPost(c){
 let t=await c.env.DB.prepare("SELECT id,phone FROM tenants WHERE phone=? OR email='cliente teste' ORDER BY phone IS NULL LIMIT 1").bind(DEMO_PHONE).first();
 if(t&&!t.phone){await c.env.DB.prepare("UPDATE tenants SET phone=? WHERE id=?").bind(DEMO_PHONE,t.id).run();t.phone=DEMO_PHONE}
 if(!t){
  const id=uid(),salt=newSalt(),hash=await passwordHash(crypto.randomUUID(),salt),exp=new Date(Date.now()+7*86400000).toISOString();
  await c.env.DB.prepare("INSERT INTO tenants(id,business_name,segment,email,phone,password_hash,password_salt,panel_model_id,status,theme_mode,trial_expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'trial','light',?,?,?)").bind(id,"Cliente Teste","restaurante","cliente teste",DEMO_PHONE,hash,salt,"comanda",exp,now(),now()).run();
  t={id,phone:DEMO_PHONE};
 }
 // Dados 100% fictícios para a demonstração, isolados no tenant de teste.
 await c.env.DB.prepare("DELETE FROM registros WHERE substr(store,1,?)=?").bind(t.id.length+1,t.id+'~').run();
 {
  const stamp=Date.now(),records=[];
  const clients=[['cli01','Ana Souza','67991234567'],['cli02','Bruno Lima','67992345678'],['cli03','Carla Mendes','67993456789'],['cli04','Diego Alves','67994567890'],['cli05','Fernanda Rocha','67995678901'],['cli06','Gabriel Costa','67996789012']];
  clients.forEach((x,i)=>records.push(['clients',x[0],{id:x[0],name:x[1],phone:x[2],created:new Date(Date.now()-i*86400000).toISOString().slice(0,10)}]));
  [['srv1','Corte tradicional',40,40],['srv2','Corte + barba',70,70],['srv3','Barba',30,30]].forEach(x=>records.push(['services',x[0],{id:x[0],name:x[1],price:x[2],dur:x[3],cat:'Geral',active:'1'}]));
  [['bar1','Rafael Santos'],['bar2','Lucas Martins']].forEach(x=>records.push(['barbers',x[0],{id:x[0],name:x[1],comm:40,role:'admin'}]));
  for(let i=0;i<9;i++){const day=new Date(Date.now()-i*86400000).toISOString().slice(0,10),cid=clients[i%clients.length][0],sid=['srv1','srv2','srv3'][i%3],value=[40,70,30][i%3];records.push(['appointments','ag'+i,{id:'ag'+i,date:day,time:['09:00','10:30','14:00'][i%3],client:cid,service:sid,barber:i%2?'bar2':'bar1',status:'concluido',price:value,dur:40}]);records.push(['finance','fin'+i,{id:'fin'+i,date:day,type:'entrada',desc:'Atendimento demonstrativo',value,method:['pix','dinheiro','credito'][i%3]}]);}
  const batch=records.map((r,i)=>c.env.DB.prepare('INSERT OR IGNORE INTO registros(store,id,data,updated,deleted) VALUES(?,?,?,?,0)').bind(t.id+'~'+r[0],r[1],JSON.stringify(r[2]),stamp+i));
  for(let i=0;i<batch.length;i+=50)await c.env.DB.batch(batch.slice(i,i+50));
 }
 // Comanda de demonstração: cardápio modelo, 12 mesas, um garçom (PIN 1234) e um caixa (PIN 4321).
 {
  const D=c.env.DB;
  await D.prepare("UPDATE tenants SET segment='restaurante',panel_model_id='comanda' WHERE id=?").bind(t.id).run();
  for(const tb of ["cm_itens","cm_pedidos","cm_comandas","cm_produtos","cm_categorias","cm_mesas","cm_atendentes"])await D.prepare(`DELETE FROM ${tb} WHERE tenant_id=?`).bind(t.id).run();
  const st=[];for(let i=1;i<=12;i++)st.push(D.prepare("INSERT INTO cm_mesas(id,tenant_id,loja,numero,lugares,ordem,updated) VALUES(?,?,1,?,4,?,?)").bind(uid(),t.id,String(i),i,Date.now()));
  for(const [nome,papel,pin] of [["Garçom Teste","garcom","1234"],["Caixa Teste","caixa","4321"]]){const p=await novoPin(pin);st.push(D.prepare("INSERT INTO cm_atendentes(id,tenant_id,loja,nome,papel,pin_hash,pin_salt,updated) VALUES(?,?,1,?,?,?,?,?)").bind(uid(),t.id,nome,papel,p.pin_hash,p.pin_salt,Date.now()))}
  await D.batch(st);
  const cookieDemo=await tenantSessionCookie(c,t);
  await catalogo({...c,request:new Request(c.request.url,{method:"POST",headers:{cookie:cookieDemo.split(";")[0],"content-type":"application/json"},body:JSON.stringify({action:"modelo",modelo:"restaurante",loja:1})})});
 }
 return json({ok:true,demo:true},200,{"set-cookie":await tenantSessionCookie(c,t)});
}
