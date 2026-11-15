// Nexus Comanda — regras comuns de cardápio, pedidos, produção e equipe.
// Todas as tabelas cm_* levam tenant_id + loja (mesmo padrão de store_links e maquininhas).
// O tenant SEMPRE vem da sessão assinada (painel/garçom) ou do slug público + token (cardápio/produção), nunca do corpo da requisição.
import {json,fail,uid,getCookie,cookie,cleanText} from "./http.js";
import {requireTenant,storeLimit,signSession,verifySession,secretOf,passwordHash,newSalt} from "./auth.js";
import {resolveLink,tenantActive,lojaN} from "./publico.js";

export const SETORES=["cozinha","bar"]; // por enquanto fixo; a coluna "setor" aceita outros no futuro
export const SETOR_NOME={cozinha:"Cozinha",bar:"Bar",nenhum:"Sem preparo"};
export const PAGAMENTOS=["dinheiro","pix","credito","debito","vale"];
export const PAG_NOME={dinheiro:"Dinheiro",pix:"Pix",credito:"Cartão de crédito",debito:"Cartão de débito",vale:"Vale-refeição"};
export const TIPOS=["mesa","delivery","retirada","balcao"];
const T=()=>Date.now();
const int=(v,min,max,def=0)=>{const n=Math.round(Number(v));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):def};
export const cents=v=>int(v,0,10_000_000,0);
const randTok=()=>crypto.randomUUID().replace(/-/g,"").slice(0,20);

// ---------- Configuração da loja ----------
export const CONFIG_PADRAO={
 aceitando:1,              // cardápio público aceitando pedidos
 delivery:1,retirada:1,    // modalidades do cardápio público
 taxa_entrega_cents:0,     // opcional (0 = sem taxa)
 pedido_minimo_cents:0,
 tempo_entrega:"40–60 min",tempo_retirada:"20–30 min",
 servico_pct:10,           // taxa de serviço sugerida no fechamento de mesa (0 = não cobra)
 fechamento:"garcom",      // quem fecha a conta da mesa: "garcom" (qualquer atendente) ou "caixa" (só atendentes com papel caixa)
 pagamentos:["dinheiro","pix","credito","debito"],
 pix_chave:"",             // opcional: aparece no checkout do cardápio quando o cliente escolhe Pix
 whatsapp:"",endereco:"",nome:"",logo:"",capa:"",
 mesa_auto:1,              // pedido do cliente pelo celular na mesa (link /mesa/<loja> + senha que o garçom gera) — sempre ligado
 impressao_auto:0,         // telas de produção imprimem cada pedido novo automaticamente
 fuso:"America/Sao_Paulo", // fuso da loja (numeração diária dos pedidos e data no caixa)
 tokens:{}                 // token secreto de cada tela de produção (cozinha, bar)
};
export async function getConfig(env,tid,n){
 const r=await env.DB.prepare("SELECT data_json FROM cm_config WHERE tenant_id=? AND loja=?").bind(tid,n).first();
 let d={};try{d=JSON.parse(r?.data_json||"{}")}catch{}
 const c={...CONFIG_PADRAO,...d,tokens:{...(d.tokens||{})}};
 c.mesa_auto=1; // por enquanto sempre disponível: só funciona com a senha gerada pelo garçom
 let mudou=false;for(const s of SETORES)if(!/^[a-f0-9]{20}$/.test(c.tokens[s]||"")){c.tokens[s]=randTok();mudou=true}
 if(mudou||!r)await saveConfig(env,tid,n,c);
 return c;
}
export async function saveConfig(env,tid,n,c){
 await env.DB.prepare("INSERT INTO cm_config(tenant_id,loja,data_json,updated) VALUES(?,?,?,?) ON CONFLICT(tenant_id,loja) DO UPDATE SET data_json=excluded.data_json,updated=excluded.updated").bind(tid,n,JSON.stringify(c),T()).run();
}
// Limpa o que vem do painel (só campos conhecidos, com limites).
export function sanitizeConfig(b,old){
 const c={...old};
 const bool=k=>{if(k in b)c[k]=b[k]?1:0};
 ["aceitando","delivery","retirada","impressao_auto","mesa_auto"].forEach(bool);
 if("taxa_entrega_cents" in b)c.taxa_entrega_cents=cents(b.taxa_entrega_cents);
 if("pedido_minimo_cents" in b)c.pedido_minimo_cents=cents(b.pedido_minimo_cents);
 if("servico_pct" in b)c.servico_pct=int(b.servico_pct,0,30,10);
 if("fechamento" in b)c.fechamento=b.fechamento==="caixa"?"caixa":"garcom";
 if(Array.isArray(b.pagamentos)){const p=b.pagamentos.filter(x=>PAGAMENTOS.includes(x));c.pagamentos=p.length?p:["dinheiro"]}
 for(const [k,max] of [["tempo_entrega",30],["tempo_retirada",30],["pix_chave",120],["endereco",160],["nome",80]])if(k in b)c[k]=cleanText(b[k],max);
 if("fuso" in b)c.fuso=fz(b.fuso);
 if("whatsapp" in b)c.whatsapp=String(b.whatsapp||"").replace(/\D/g,"").slice(0,15);
 for(const k of ["logo","capa"])if(k in b)c[k]=imgOk(b[k],k==="capa"?700000:300000)?b[k]:"";
 if(b.novos_tokens)c.tokens={};
 return c;
}
export const imgOk=(s,max=450000)=>typeof s==="string"&&s.length<max&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s);

// ---------- Acesso ----------
// Painel do lojista: sessão do dono + nº da loja dentro do limite do plano.
export async function painelCtx(c,n){
 const a=await requireTenant(c);if(a.error)return a;
 const loja=lojaN(n??new URL(c.request.url).searchParams.get("loja"));
 if(loja>await storeLimit(c.env,a.tenant))return {error:fail("Esta loja não está disponível no seu plano.",403)};
 return {tenant:a.tenant,tid:a.tenant.id,loja};
}
// Links públicos (cardápio, garçom, produção): o slug define conta + loja.
export async function lojaPublica(env,slug){
 const lk=await resolveLink(env,slug,null);
 if(!lk||!tenantActive(lk.t))return null;
 if(lk.n>await storeLimit(env,lk.t))return null;
 if(lk.n>1){
  const g=await env.DB.prepare("SELECT data FROM registros WHERE store=? AND id='lojas' AND deleted=0").bind(lk.t.id+"~global").first();
  let st=null;try{st=JSON.parse(g?.data||"{}").stores}catch{}
  if(Array.isArray(st)&&!st.some(x=>Number(x.n)===lk.n))return null;
 }
 return {t:lk.t,tid:lk.t.id,loja:lk.n};
}
// Nome exibido da loja: config do Comanda > cadastro de lojas > nome da empresa.
export async function nomeLoja(env,t,n,cfg){
 if(cfg?.nome)return cfg.nome;
 const g=await env.DB.prepare("SELECT data FROM registros WHERE store=? AND id='lojas' AND deleted=0").bind(t.id+"~global").first();
 let st=[];try{st=JSON.parse(g?.data||"{}").stores||[]}catch{}
 const base=(t.company_name||t.business_name||"").trim();
 return (st.find(x=>Number(x.n)===n)||{}).name||(n===1?base:`${base} - Loja ${n}`);
}

// Sessão do garçom/atendente: cookie próprio, separado do login do dono, válido por 14 h (um turno).
const GC="nexus_atendente";
export async function atendenteCookie(c,p){
 const tok=await signSession({role:"atendente",tid:p.tid,loja:p.loja,aid:p.aid,exp:T()+14*3600000},secretOf(c.env));
 return cookie(GC,tok,{maxAge:14*3600,secure:new URL(c.request.url).protocol==="https:"});
}
export const atendenteLogoutCookie=c=>cookie(GC,"",{maxAge:0,secure:new URL(c.request.url).protocol==="https:"});
export async function atendenteCtx(c,slug){
 const loja=await lojaPublica(c.env,slug);
 if(!loja)return {error:fail("Loja não encontrada ou indisponível.",404)};
 const s=await verifySession(getCookie(c.request,GC),secretOf(c.env));
 if(!s||s.role!=="atendente"||s.tid!==loja.tid||s.loja!==loja.loja)return {error:fail("Faça login para continuar.",401),loja};
 const a=await c.env.DB.prepare("SELECT id,nome,papel FROM cm_atendentes WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(s.aid,loja.tid,loja.loja).first();
 if(!a)return {error:fail("Acesso desativado. Fale com o gerente.",401),loja};
 return {...loja,atendente:a};
}
export const pinHash=(pin,salt)=>passwordHash("pin:"+pin,salt);
export async function novoPin(pin){const salt=newSalt();return {pin_salt:salt,pin_hash:await pinHash(pin,salt)}}
export const pinValido=p=>/^\d{4,6}$/.test(String(p||""));

// Tela de produção: slug + setor + token secreto (vai no link; TV da cozinha não precisa de login).
export async function producaoCtx(c,slug,setor,token){
 if(!SETORES.includes(setor))return {error:fail("Setor inválido.",404)};
 const loja=await lojaPublica(c.env,slug);
 if(!loja)return {error:fail("Loja não encontrada ou indisponível.",404)};
 const cfg=await getConfig(c.env,loja.tid,loja.loja);
 if(!token||token!==cfg.tokens[setor])return {error:fail("Link da tela inválido ou trocado. Peça o link novo ao gerente.",403)};
 return {...loja,cfg,setor};
}

// ---------- Datas no fuso da loja ----------
export const FUSOS=["America/Sao_Paulo","America/Campo_Grande","America/Cuiaba","America/Manaus","America/Porto_Velho","America/Rio_Branco","America/Belem","America/Fortaleza","America/Recife","America/Bahia","America/Noronha","America/Boa_Vista"];
const fz=f=>FUSOS.includes(f)?f:"America/Sao_Paulo";
export const diaLocal=(f,ms=Date.now())=>new Intl.DateTimeFormat("en-CA",{timeZone:fz(f),year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(ms));
// Início do dia de hoje (00:00 no fuso da loja), em milissegundos — numeração dos pedidos recomeça todo dia.
export function inicioDia(f){
 const agora=Date.now(),p=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:fz(f),hourCycle:"h23",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"}).formatToParts(new Date(agora)).map(x=>[x.type,x.value]));
 const comoUTC=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second),off=comoUTC-Math.floor(agora/1000)*1000;
 return Date.UTC(+p.year,+p.month-1,+p.day)-off;
}

// ---------- Pedidos ----------
// Monta e grava um envio para a produção. Preço, nome e setor vêm SEMPRE do cadastro do produto (nunca do navegador).
export async function lancarPedido(env,{tid,loja,comanda,itens,origem,atendente,obs,fuso}){
 const D=env.DB;
 const lista=(Array.isArray(itens)?itens:[]).slice(0,60).map(i=>({produto_id:String(i?.produto_id||""),qtd:int(i?.qtd,0,99,0),obs:cleanText(i?.obs,140)})).filter(i=>i.produto_id&&i.qtd>0);
 if(!lista.length)return {erro:"Adicione pelo menos um item."};
 const ids=[...new Set(lista.map(i=>i.produto_id))];
 const q=await D.prepare(`SELECT id,nome,preco_cents,setor FROM cm_produtos WHERE tenant_id=? AND loja=? AND ativo=1 AND id IN (${ids.map(()=>"?").join(",")})`).bind(tid,loja,...ids).all();
 const P=Object.fromEntries((q.results||[]).map(p=>[p.id,p]));
 const falta=lista.find(i=>!P[i.produto_id]);
 if(falta)return {erro:"Um dos itens não está mais disponível. Atualize o cardápio."};
 const agora=T(),pid=uid();
 const desde=inicioDia(fuso);
 const num=((await D.prepare("SELECT MAX(numero) m FROM cm_pedidos WHERE tenant_id=? AND loja=? AND criado_em>=?").bind(tid,loja,desde).first())?.m||0)+1;
 const st=[D.prepare("INSERT INTO cm_pedidos(id,tenant_id,loja,comanda_id,numero,origem,atendente,obs,criado_em,updated) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(pid,tid,loja,comanda.id,num,origem,atendente||null,cleanText(obs,200)||null,agora,agora)];
 for(const i of lista){const p=P[i.produto_id];
  const setor=p.setor==="nenhum"?"nenhum":SETORES.includes(p.setor)?p.setor:"cozinha";
  st.push(D.prepare("INSERT INTO cm_itens(id,tenant_id,loja,pedido_id,comanda_id,produto_id,nome,qtd,preco_cents,obs,setor,status,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(uid(),tid,loja,pid,comanda.id,p.id,p.nome,i.qtd,p.preco_cents,i.obs||null,setor,setor==="nenhum"?"pronto":"novo",agora));
 }
 await D.batch(st);
 await recalcular(env,comanda.id);
 return {pedido_id:pid,numero:num};
}
// Recalcula subtotal/total da comanda a partir dos itens (cancelados não contam).
export async function recalcular(env,cid,extra={}){
 const D=env.DB;
 const c=await D.prepare("SELECT * FROM cm_comandas WHERE id=?").bind(cid).first();if(!c)return null;
 const s=(await D.prepare("SELECT COALESCE(SUM(qtd*preco_cents),0) s FROM cm_itens WHERE comanda_id=? AND status<>'cancelado'").bind(cid).first())?.s||0;
 const servico="servico_cents" in extra?extra.servico_cents:c.servico_cents,desc="desconto_cents" in extra?extra.desconto_cents:c.desconto_cents;
 const total=Math.max(0,s+c.taxa_cents+servico-desc);
 await D.prepare("UPDATE cm_comandas SET subtotal_cents=?,servico_cents=?,desconto_cents=?,total_cents=?,updated=? WHERE id=?").bind(s,servico,desc,total,T(),cid).run();
 return {...c,subtotal_cents:s,servico_cents:servico,desconto_cents:desc,total_cents:total};
}
// Situação geral de uma comanda a partir dos itens (para a fila de pedidos / Order Line).
export function situacao(itens,comanda){
 if(comanda.status==="cancelada")return "cancelado";
 if(comanda.status==="fechada")return "concluido";
 if(comanda.etapa==="saiu")return "saiu";
 const v=itens.filter(i=>i.status!=="cancelado");
 if(!v.length)return "aberto";
 if(v.some(i=>i.status==="novo"))return v.some(i=>i.status!=="novo")?"preparo":"novo";
 if(v.some(i=>i.status==="preparo"))return "preparo";
 if(v.some(i=>i.status==="pronto"))return "pronto";
 return "entregue";
}
// Lista comandas com seus itens (painel e garçom).
export async function comandasCom(env,tid,loja,where,binds){
 const D=env.DB;
 const cs=(await D.prepare(`SELECT *,(SELECT codigo FROM cm_mesas m WHERE m.id=cm_comandas.mesa_id) mesa_codigo FROM cm_comandas WHERE tenant_id=? AND loja=? AND ${where} ORDER BY aberta_em DESC LIMIT 200`).bind(tid,loja,...binds).all()).results||[];
 if(!cs.length)return [];
 const it=(await D.prepare(`SELECT i.*,p.numero pedido_numero,p.criado_em,p.origem FROM cm_itens i JOIN cm_pedidos p ON p.id=i.pedido_id WHERE i.comanda_id IN (${cs.map(()=>"?").join(",")}) ORDER BY p.criado_em,i.rowid`).bind(...cs.map(c=>c.id)).all()).results||[];
 const by={};for(const i of it)(by[i.comanda_id]||=[]).push(i);
 return cs.map(c=>({...c,itens:by[c.id]||[],situacao:situacao(by[c.id]||[],c)}));
}
// Fecha a conta: grava pagamento e lança a entrada no Caixa do painel (tabela registros, mesmo formato do caixa existente).
export async function fecharComanda(env,{tid,loja,comanda,pagamento,servico_cents,desconto_cents,por,fuso}){
 if(comanda.status!=="aberta")return {erro:"Esta conta já foi encerrada."};
 if(!PAGAMENTOS.includes(pagamento))return {erro:"Escolha a forma de pagamento."};
 const c=await recalcular(env,comanda.id,{servico_cents:cents(servico_cents??comanda.servico_cents),desconto_cents:cents(desconto_cents??comanda.desconto_cents)});
 const agora=T();
 await env.DB.prepare("UPDATE cm_comandas SET status='fechada',etapa='concluido',pagamento=?,fechada_por=?,fechada_em=?,updated=? WHERE id=? AND status='aberta'").bind(pagamento,por||null,agora,agora,comanda.id).run();
 await env.DB.prepare("UPDATE cm_itens SET status='entregue',updated=? WHERE comanda_id=? AND status IN ('novo','preparo','pronto')").bind(agora,comanda.id).run();
 if(comanda.tipo==="mesa"&&comanda.mesa_id)await limparCodigo(env,comanda.mesa_id);
 const data=diaLocal(fuso);
 const desc=(comanda.tipo==="mesa"?"Mesa "+(comanda.mesa_label||""):comanda.tipo==="delivery"?"Delivery":comanda.tipo==="retirada"?"Retirada":"Balcão")+(comanda.cliente_nome?" · "+comanda.cliente_nome:"")+" (Comanda)";
 const metodo={dinheiro:"dinheiro",pix:"pix",credito:"credito",debito:"debito",vale:"outro"}[pagamento];
 const store=tid+"~finance"+(loja>1?"@"+loja:"");
 await env.DB.prepare("INSERT INTO registros(store,id,data,updated,deleted) VALUES(?,?,?,?,0) ON CONFLICT(store,id) DO UPDATE SET data=excluded.data,updated=excluded.updated,deleted=0")
  .bind(store,"cm-"+comanda.id,JSON.stringify({id:"cm-"+comanda.id,type:"entrada",desc,value:c.total_cents/100,method:metodo,date:data,comanda:comanda.id}),agora).run();
 return {ok:true,total_cents:c.total_cents};
}
// ---------- Pedido do cliente na mesa ----------
// Senha da mesa: o garçom cria (ou o sistema gera) uma senha curta. Ela vale enquanto a mesa estiver em atendimento
// e é apagada quando a conta fecha — assim um link antigo não consegue fazer pedido.
export const codigoValido=c=>/^\d{3,6}$/.test(String(c||""));
export const gerarCodigo=()=>String(1000+crypto.getRandomValues(new Uint32Array(1))[0]%9000);
export async function limparCodigo(env,mesaId){await env.DB.prepare("UPDATE cm_mesas SET codigo=NULL,codigo_em=NULL,updated=? WHERE id=?").bind(Date.now(),mesaId).run()}
const MC="nexus_mesa";
export async function mesaCookie(c,p){
 const tok=await signSession({role:"mesa",tid:p.tid,loja:p.loja,mid:p.mid,cod:p.cod,exp:Date.now()+8*3600000},secretOf(c.env));
 return cookie(MC,tok,{maxAge:8*3600,secure:new URL(c.request.url).protocol==="https:"});
}
export const mesaSairCookie=c=>cookie(MC,"",{maxAge:0,secure:new URL(c.request.url).protocol==="https:"});
// Sessão do cliente na mesa: confere loja, se o pedido na mesa está ligado e se a senha ainda é a mesma.
export async function mesaCtx(c,slug){
 const loja=await lojaPublica(c.env,slug);
 if(!loja)return {error:fail("Loja não encontrada ou indisponível.",404)};
 const cfg=await getConfig(c.env,loja.tid,loja.loja);
 if(!cfg.mesa_auto)return {error:fail("Pedido pela mesa não está disponível nesta loja. Chame o garçom.",403),loja,cfg};
 const s=await verifySession(getCookie(c.request,MC),secretOf(c.env));
 if(!s||s.role!=="mesa"||s.tid!==loja.tid||s.loja!==loja.loja)return {error:fail("Escolha sua mesa e digite a senha.",401),loja,cfg};
 const m=await c.env.DB.prepare("SELECT id,numero,codigo FROM cm_mesas WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(s.mid,loja.tid,loja.loja).first();
 if(!m||!m.codigo||m.codigo!==s.cod)return {error:fail("O atendimento desta mesa foi encerrado ou a senha mudou. Peça a senha ao garçom.",401),loja,cfg};
 return {...loja,cfg,mesa:m};
}
export {json,fail,uid,cleanText,int};
