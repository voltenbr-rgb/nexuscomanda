// Apoio da página pública de agendamento (sem login). Somente leitura de dados da loja + criação de agendamentos.
// Os dados do painel ficam na tabela "registros" com a chave "<tenant_id>~<base>[@loja]" (ex.: "abc~services@2").
export const slugify=s=>String(s??"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40).replace(/-+$/,"")||"loja";
export const validSlug=s=>/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(String(s||""));
export const lojaN=v=>{const n=Math.floor(Number(v)||1);return n>=1&&n<=10?n:1};
export const sk=(tid,base,n)=>tid+"~"+base+(n>1?"@"+n:"");
export const validDate=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||"")))return false;const x=new Date(d+"T12:00:00Z");return !isNaN(x)&&x.toISOString().slice(0,10)===d};
export const m2=t=>{const m=/^(\d{1,2}):(\d{2})$/.exec(String(t||""));return m?+m[1]*60+ +m[2]:NaN};
export const hhmm=n=>String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0");
const parse=s=>{try{return JSON.parse(s)}catch{return null}};

// Data/hora atual no fuso informado (o do aparelho do cliente); se inválido, horário de Brasília.
export function nowIn(tz){
 for(const z of [tz,"America/Sao_Paulo"]){
  try{
   const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:z,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).map(x=>[x.type,x.value]));
   return {date:`${p.year}-${p.month}-${p.day}`,min:+p.hour*60+ +p.minute};
  }catch{}
 }
 return {date:new Date().toISOString().slice(0,10),min:0};
}

const TCOLS="id,business_name,company_name,status,trial_expires_at,license_expires_at,theme_mode,custom_color,max_stores_override,plan_id";
export const tenantById=(env,id)=>env.DB.prepare(`SELECT ${TCOLS} FROM tenants WHERE id=?`).bind(id).first();
export async function tenantBySlug(env,slug){
 if(!validSlug(slug))return null;
 return env.DB.prepare(`SELECT ${TCOLS} FROM tenants WHERE slug=?`).bind(slug).first();
}
// Cada loja tem o seu próprio endereço (tabela store_links): o slug já define conta + loja, o parâmetro ?loja= é ignorado.
// Links antigos (slug da conta + ?loja=N) continuam funcionando.
export async function resolveLink(env,slug,lojaParam){
 if(!validSlug(slug))return null;
 const L=await env.DB.prepare("SELECT tenant_id,loja FROM store_links WHERE slug=?").bind(slug).first();
 if(L){const t=await tenantById(env,L.tenant_id);return t?{t,n:Number(L.loja)}:null}
 const t=await tenantBySlug(env,slug);
 return t?{t,n:lojaN(lojaParam)}:null;
}
// Conta com teste/licença vencido ou suspensa não recebe agendamentos públicos.
export function tenantActive(t){
 if(!t||t.status==="suspended"||t.status==="expired")return false;
 const until=t.status==="trial"?t.trial_expires_at:t.license_expires_at;
 return !(until&&new Date(until)<new Date());
}
async function limit(env,t){
 if(t.max_stores_override!=null)return Math.max(1,Number(t.max_stores_override));
 if(!t.plan_id||t.status!=="active")return 1;
 const p=await env.DB.prepare("SELECT max_stores FROM plans WHERE id=?").bind(t.plan_id).first();
 return Math.max(1,Number(p?.max_stores||1));
}
// Lê tudo que a página pública precisa de uma loja (configuração, serviços, profissionais, cores).
export async function loadStore(env,t,n){
 if(n>await limit(env,t))return null;
 const keys=[sk(t.id,"settings",n),sk(t.id,"services",n),sk(t.id,"barbers",n),t.id+"~global"];
 const q=await env.DB.prepare(`SELECT store,id,data FROM registros WHERE deleted=0 AND store IN (${keys.map(()=>"?").join(",")})`).bind(...keys).all();
 let set={},services=[],barbers=[],adm={},lojas=null;
 for(const r of q.results||[]){
  const d=parse(r.data);if(!d||typeof d!=="object")continue;
  if(r.store===keys[0]&&r.id==="main")set=d;
  else if(r.store===keys[1]&&String(d.active)!=="0"&&d.name)services.push({id:String(r.id),name:String(d.name),desc:String(d.desc||""),cat:String(d.cat||""),price:Number(d.price)||0,dur:Math.max(5,Math.min(480,Math.round(Number(d.dur))||30))});
  else if(r.store===keys[2]&&d.name)barbers.push({id:String(r.id),name:String(d.name),hours:String(d.hours||""),photo:/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photo||"")&&d.photo.length<400000?d.photo:""});
  else if(r.store===keys[3]&&r.id==="adm")adm=d;
  else if(r.store===keys[3]&&r.id==="lojas")lojas=d;
 }
 if(n>1&&lojas&&Array.isArray(lojas.stores)&&!lojas.stores.some(s=>Number(s.n)===n))return null;
 const base=(t.company_name||t.business_name||"").trim();
 const regName=lojas&&Array.isArray(lojas.stores)?(lojas.stores.find(s=>Number(s.n)===n)||{}).name:"";
 const name=String(set.name||regName||(n===1?base:`${base} - Loja ${n}`)).slice(0,80);
 const color=[adm.storeButtonColors&&adm.storeButtonColors[n],t.custom_color].find(c=>/^#[0-9a-fA-F]{6}$/.test(c||""))||"#7657ff";
 const th=(adm.storeThemes&&adm.storeThemes[n])||t.theme_mode;
 const days=String(set.days||"1,2,3,4,5,6").split(",").map(x=>x.trim()).filter(x=>/^[0-6]$/.test(x)).map(Number);
 const open=m2(set.open)>=0?set.open:"08:00",close=m2(set.close)>m2(open)?set.close:"19:00";
 services.sort((a,b)=>a.id<b.id?-1:1);barbers.sort((a,b)=>a.id<b.id?-1:1);
 const ls=m2(set.lunchS),le=m2(set.lunchE),lunch=ls>=0&&le>ls?{s:set.lunchS,e:set.lunchE}:null;
 return {n,name,lunch,logo:/^data:image\//.test(set.logo||"")?set.logo:"",address:String(set.address||"").slice(0,160),phone:String(set.whatsapp||set.phone||"").replace(/\D/g,"").slice(0,15),color:color.toLowerCase(),theme:th==="light"||th==="neon"?"light":"dark",open,close,days,services,barbers};
}
// Intervalo de trabalho do profissional ("09:00-18:00"), limitado ao da loja.
export function workRange(store,b){
 let a=m2(store.open),z=m2(store.close);
 const m=/^\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*$/.exec(b.hours||"");
 if(m&&m2(m[2])>m2(m[1])){a=Math.max(a,m2(m[1]));z=Math.min(z,m2(m[2]))}
 return [a,z];
}
