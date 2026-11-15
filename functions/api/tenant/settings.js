import {json,fail,readJson,now,cleanText} from "../../_lib/http.js";
import {requireTenant,passwordHash,setTenantPassword} from "../../_lib/auth.js";
export async function onRequestPatch(c){
 const a=await requireTenant(c);if(a.error)return a.error;
 const b=await readJson(c.request)||{},t=a.tenant;
 // Confirmação obrigatória do ADM para qualquer alteração de dados/configurações.
 const cred=await c.env.DB.prepare("SELECT password_hash,password_salt FROM tenants WHERE id=?").bind(t.id).first();
 const confirmation=b.admin_password||b.current_password;
 if(!confirmation||!cred||await passwordHash(String(confirmation),cred.password_salt)!==cred.password_hash)return fail("Senha do Administrador incorreta. Nenhuma alteração foi realizada.",403);
 const theme=["dark","light"].includes(b.theme_mode)?b.theme_mode:t.theme_mode;
 const palette=["violet","blue","emerald","amber","rose"].includes(b.color_palette)?b.color_palette:t.color_palette;
 const model=["barber-pro","modern","minimal"].includes(b.panel_model_id)?b.panel_model_id:t.panel_model_id;
 const color="custom_color" in b?(/^#[0-9a-fA-F]{6}$/.test(b.custom_color||"")?b.custom_color:null):t.custom_color;
 await c.env.DB.prepare("UPDATE tenants SET theme_mode=?,color_palette=?,custom_color=?,panel_model_id=?,updated_at=? WHERE id=?").bind(theme,palette,color,model,now(),t.id).run();
 // Nome do negócio (título do app) e nicho (livre)
 if("company_name" in b){
  const v=cleanText(b.company_name,60);if(!v)return fail("Informe o nome do negócio.");
  const oldName=String(t.company_name||t.business_name||'').trim();
  await c.env.DB.prepare("UPDATE tenants SET company_name=?,updated_at=? WHERE id=?").bind(v,now(),t.id).run();
  // Atualiza somente nomes automáticos; nomes personalizados de unidades são preservados.
  const storeRows=await c.env.DB.prepare("SELECT store,id,data FROM registros WHERE substr(store,1,?)=? AND id='main' AND deleted=0 AND store LIKE ?").bind(t.id.length+1,t.id+'~','%settings%').all();
  for(const row of storeRows.results||[]){try{const data=JSON.parse(row.data||'{}');const match=String(data.name||'');if(match===oldName||/^.+ - Loja \d+$/.test(match)&&match.startsWith(oldName+' - Loja ')){const n=Number((row.store.match(/@(\d+)$/)||[])[1]||1);data.name=n===1?v:`${v} - Loja ${n}`;await c.env.DB.prepare("UPDATE registros SET data=?,updated=? WHERE store=? AND id=?").bind(JSON.stringify(data),Date.now(),row.store,row.id).run()}}catch{}}
  const globalRows=await c.env.DB.prepare("SELECT id,data,updated FROM registros WHERE store=? AND id IN ('lojas','adm') AND deleted=0").bind(t.id+'~global').all();
  for(const row of globalRows.results||[]){try{const data=JSON.parse(row.data||'{}');let changed=false;if(row.id==='lojas'&&Array.isArray(data.stores)){data.stores=data.stores.map(x=>{if(x.name===oldName){changed=true;return {...x,name:v}}if(x.name===`${oldName} - Loja ${x.n}`){changed=true;return {...x,name:`${v} - Loja ${x.n}`}}return x})}if(row.id==='adm'&&data.names){for(const [n,name] of Object.entries(data.names)){if(name===oldName){data.names[n]=v;changed=true}else if(name===`${oldName} - Loja ${n}`){data.names[n]=`${v} - Loja ${n}`;changed=true}}}if(changed)await c.env.DB.prepare("UPDATE registros SET data=?,updated=?,deleted=0 WHERE store=? AND id=?").bind(JSON.stringify(data),Date.now(),t.id+'~global',row.id).run()}catch{}}

 }
 if("niche_label" in b||"segment" in b){
  const SEGS=["barbearia","manicure","salao","estetica","assistencia","outro"];
  const seg=SEGS.includes(b.segment)?b.segment:(b.segment===undefined?t.segment:"outro"),niche=cleanText(b.niche_label,40)||null;
  await c.env.DB.prepare("UPDATE tenants SET segment=?,niche_label=?,updated_at=? WHERE id=?").bind(seg,niche,now(),t.id).run();
 }
 if(b.new_password){
  if(String(b.new_password).length<4)return fail("A nova senha precisa ter no mínimo 4 caracteres.");
  const old=await c.env.DB.prepare("SELECT password_hash,password_salt FROM tenants WHERE id=?").bind(t.id).first();
  if(!b.current_password||await passwordHash(String(b.current_password),old.password_salt)!==old.password_hash)return fail("Senha atual incorreta.",403);
  await setTenantPassword(c.env,t.id,b.new_password);
 }
 return json({ok:true});
}
