import {json,fail,readJson,now} from "../../_lib/http.js";
import {requireTenant,passwordHash,storeLimit} from "../../_lib/auth.js";
export async function onRequestPost(c){
 const a=await requireTenant(c,{allowExpired:true});if(a.error)return a.error;const b=await readJson(c.request)||{},t=a.tenant,D=c.env.DB;
 const cred=await D.prepare('SELECT password_hash,password_salt FROM tenants WHERE id=?').bind(t.id).first();
 const pw=String(b.admin_password||'');if(!pw||!cred||await passwordHash(pw,cred.password_salt)!==cred.password_hash)return fail('Senha do ADM incorreta. Nenhuma alteração foi realizada.',403);
 if(b.action==='verify')return json({ok:true});
 if(b.action!=='save')return fail('Ação inválida.');
 const lim=await storeLimit(c.env,t),input=Array.isArray(b.stores)?b.stores:[];
 const stores=[{n:1,name:String(input.find(x=>Number(x.n)===1)?.name||t.company_name||t.business_name).trim().slice(0,60)||'Loja principal',on:1}];
 for(let n=2;n<=lim;n++){const x=input.find(y=>Number(y.n)===n);if(!x||!x.on)continue;stores.push({n,name:String(x.name||`${t.company_name||t.business_name} - Loja ${n}`).trim().slice(0,60)||`Loja ${n}`,on:1})}
 const old=await D.prepare("SELECT data FROM registros WHERE store=? AND id='lojas' AND deleted=0").bind(t.id+'~global').first();let prev=[];try{prev=JSON.parse(old?.data||'{}').stores||[]}catch{}
 const keep=new Set(stores.map(x=>x.n));const removed=Array.from({length:Math.max(0,lim-1)},(_,i)=>i+2).filter(n=>!keep.has(n));
 const batch=[D.prepare("INSERT INTO registros(store,id,data,updated,deleted) VALUES(?,?,?,?,0) ON CONFLICT(store,id) DO UPDATE SET data=excluded.data,updated=excluded.updated,deleted=0").bind(t.id+'~global','lojas',JSON.stringify({stores}),Date.now())];
 for(const n of removed)batch.push(D.prepare('DELETE FROM registros WHERE substr(store,1,?)=? AND store LIKE ?').bind(t.id.length+1,t.id+'~',`%@${n}`));
 await D.batch(batch);return json({ok:true,stores,removed});
}
