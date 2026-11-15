import {requireMaster} from "../../_lib/auth.js";
// Backup completo do banco D1 (somente sessão master): baixa um arquivo .sql com a estrutura e TODOS os dados.
// Restaurar num banco novo:  npx wrangler d1 execute NOME_DO_BANCO --remote --file=nexus-backup-AAAA-MM-DD.sql
// Atenção: contém dados de clientes, hashes de senha e credenciais cifradas — guarde em local privado.
const q=v=>v===null||v===undefined?"NULL":typeof v==="number"?(Number.isFinite(v)?String(v):"NULL"):typeof v==="boolean"?(v?"1":"0"):"'"+String(v).replace(/'/g,"''")+"'";
export async function onRequestGet(c){
 const a=await requireMaster(c);if(a.error)return a.error;
 const D=c.env.DB,stamp=new Date().toISOString();
 const objs=(await D.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END,name").all()).results||[];
 const out=[`-- Backup completo Nexus Gestor (banco D1)`,`-- Gerado em ${stamp}`,`-- Restaurar: npx wrangler d1 execute NOME_DO_BANCO --remote --file=este-arquivo.sql`,`-- CONFIDENCIAL: contém dados de clientes, hashes de senha e credenciais cifradas.`,"PRAGMA foreign_keys=OFF;",""];
 const tables=objs.filter(o=>o.type==="table");
 for(const t of tables){
  out.push(`-- Tabela ${t.name}`,`DROP TABLE IF EXISTS "${t.name}";`,t.sql.replace(/^CREATE TABLE\s+(IF NOT EXISTS\s+)?/i,"CREATE TABLE IF NOT EXISTS ")+";");
  const rows=(await D.prepare(`SELECT * FROM "${t.name}"`).all()).results||[];
  for(const r of rows){const k=Object.keys(r);out.push(`INSERT INTO "${t.name}" (${k.map(x=>`"${x}"`).join(",")}) VALUES (${k.map(x=>q(r[x])).join(",")});`)}
  out.push(`-- ${rows.length} linha(s)`,"");
 }
 for(const o of objs.filter(o=>o.type!=="table"))out.push(o.sql.replace(/^CREATE (UNIQUE )?INDEX\s+(IF NOT EXISTS\s+)?/i,(m,u)=>`CREATE ${u||""}INDEX IF NOT EXISTS `)+";");
 out.push("","PRAGMA foreign_keys=ON;","");
 const name=`nexus-backup-${stamp.slice(0,10)}.sql`;
 return new Response(out.join("\n"),{headers:{"content-type":"application/sql; charset=utf-8","content-disposition":`attachment; filename="${name}"`,"cache-control":"no-store"}});
}
