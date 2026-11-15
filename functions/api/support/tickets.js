import {json,fail,readJson,uid,now,cleanText} from "../../_lib/http.js";
// Solicitações públicas de suporte, inclusive recuperação de acesso. Nunca solicita nem armazena senha.
export async function onRequestPost(c){
 const b=await readJson(c.request)||{},name=cleanText(b.name,90),rawPhone=String(b.phone||'').replace(/\D/g,''),phone=(rawPhone.startsWith('55')&&rawPhone.length>11?rawPhone.slice(2):rawPhone).slice(0,11),message=cleanText(b.message,700)||'Preciso de ajuda para recuperar o acesso à minha conta.';
 if(!name||name.length<2)return fail('Informe seu nome.');
 if(phone.length<10||phone.length>13)return fail('Informe um telefone com DDD válido.');
 const recent=await c.env.DB.prepare("SELECT COUNT(*) n FROM support_tickets WHERE phone=? AND created_at>=datetime('now','-1 hour')").bind(phone).first();if(Number(recent?.n||0)>=5)return fail('Já recebemos várias solicitações deste telefone. Aguarde um pouco.',429);
 const id=uid();await c.env.DB.prepare("INSERT INTO support_tickets(id,name,phone,message,status,created_at) VALUES(?,?,?,?,'open',?)").bind(id,name,phone,message,now()).run();
 return json({ok:true,ticket_id:id,message:'Solicitação enviada. Nossa equipe poderá entrar em contato pelo telefone informado.'},201);
}
