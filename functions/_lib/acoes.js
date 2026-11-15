// Ações sobre comandas, usadas pelo painel do lojista e pela tela do garçom.
// "quem" = {tipo:"painel"} ou {tipo:"atendente", atendente:{id,nome,papel}}; a permissão de cada ação é checada aqui.
import {json,fail,uid,cleanText,int,lancarPedido,recalcular,fecharComanda,comandasCom,getConfig,TIPOS,cents,codigoValido,gerarCodigo,limparCodigo} from "./comanda.js";

const T=()=>Date.now();
const ST_ITEM=["novo","preparo","pronto","entregue","cancelado"];
const ETAPAS=["novo","preparo","pronto","saiu","concluido"];

async function comandaDa(env,tid,loja,id){
 if(!id)return null;
 return env.DB.prepare("SELECT * FROM cm_comandas WHERE id=? AND tenant_id=? AND loja=?").bind(String(id),tid,loja).first();
}
const nomeQuem=q=>q.tipo==="painel"?"Gerente":q.atendente.nome;
export const podeFechar=(q,cfg)=>q.tipo==="painel"||cfg.fechamento!=="caixa"||q.atendente.papel==="caixa";

export async function acaoComanda(env,{tid,loja},b,quem){
 const D=env.DB,acao=String(b?.action||"");
 const cfg=await getConfig(env,tid,loja);
 const umaVolta=async id=>(await comandasCom(env,tid,loja,"id=?",[id]))[0]||null;

 if(acao==="abrir"){
  const tipo=TIPOS.includes(b.tipo)?b.tipo:"mesa";
  if(quem.tipo!=="painel"&&!["mesa","balcao","retirada"].includes(tipo))return fail("Tipo de comanda inválido.");
  let mesa=null;
  if(tipo==="mesa"){
   mesa=await D.prepare("SELECT id,numero FROM cm_mesas WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(String(b.mesa_id||""),tid,loja).first();
   if(!mesa)return fail("Mesa não encontrada.",404);
   const ja=await D.prepare("SELECT id FROM cm_comandas WHERE tenant_id=? AND loja=? AND mesa_id=? AND status='aberta'").bind(tid,loja,mesa.id).first();
   if(ja)return json({ok:true,comanda:await umaVolta(ja.id),existente:true});
  }
  const id=uid(),agora=T();
  // Pedido na mesa ligado: quem abre a comanda (garçom/painel) gera a senha que o cliente usa no celular.
  if(mesa&&cfg.mesa_auto)await D.prepare("UPDATE cm_mesas SET codigo=COALESCE(codigo,?),codigo_em=?,updated=? WHERE id=?").bind(gerarCodigo(),agora,agora,mesa.id).run();
  await D.prepare("INSERT INTO cm_comandas(id,tenant_id,loja,tipo,mesa_id,mesa_label,cliente_nome,cliente_fone,endereco,obs,taxa_cents,aberta_por,aberta_em,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
   .bind(id,tid,loja,tipo,mesa?.id||null,mesa?.numero||null,cleanText(b.cliente_nome,60)||null,String(b.cliente_fone||"").replace(/\D/g,"").slice(0,15)||null,tipo==="delivery"?cleanText(b.endereco,200)||null:null,cleanText(b.obs,200)||null,tipo==="delivery"?cents(b.taxa_cents??cfg.taxa_entrega_cents):0,nomeQuem(quem),agora,agora).run();
  return json({ok:true,comanda:await umaVolta(id)},201);
 }

 // Senha da mesa para o cliente pedir pelo celular: {mesa_id, codigo?} cria/troca; {mesa_id, desativar:true} apaga.
 if(acao==="codigo_mesa"){
  const m=await D.prepare("SELECT id,numero FROM cm_mesas WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(String(b.mesa_id||""),tid,loja).first();
  if(!m)return fail("Mesa não encontrada.",404);
  if(b.desativar){await limparCodigo(env,m.id);return json({ok:true,codigo:null})}
  if(!await D.prepare("SELECT 1 FROM cm_comandas WHERE tenant_id=? AND loja=? AND mesa_id=? AND status='aberta'").bind(tid,loja,m.id).first())return fail("Abra a comanda da mesa primeiro: a senha é criada junto com a comanda.");
  const cod=b.codigo?String(b.codigo).trim():gerarCodigo();
  if(!codigoValido(cod))return fail("A senha da mesa deve ter de 3 a 6 números.");
  await D.prepare("UPDATE cm_mesas SET codigo=?,codigo_em=?,updated=? WHERE id=?").bind(cod,T(),T(),m.id).run();
  return json({ok:true,codigo:cod,mesa:m.numero,pedido_mesa:!!cfg.mesa_auto});
 }

 const c=await comandaDa(env,tid,loja,b.comanda_id);
 if(!c)return fail("Comanda não encontrada.",404);

 if(acao==="lancar"){
  if(c.status!=="aberta")return fail("Esta conta já foi encerrada.");
  const r=await lancarPedido(env,{tid,loja,comanda:c,itens:b.itens,origem:quem.tipo==="painel"?"painel":"garcom",atendente:nomeQuem(quem),obs:b.obs,fuso:cfg.fuso});
  if(r.erro)return fail(r.erro);
  return json({ok:true,...r,comanda:await umaVolta(c.id)});
 }
 if(acao==="item_status"){
  const st=String(b.status||"");if(!ST_ITEM.includes(st))return fail("Situação inválida.");
  const it=await D.prepare("SELECT id,status FROM cm_itens WHERE id=? AND comanda_id=?").bind(String(b.item_id||""),c.id).first();
  if(!it)return fail("Item não encontrado.",404);
  // Garçom só cancela item que a produção ainda não começou; o gerente cancela qualquer um.
  if(st==="cancelado"&&quem.tipo!=="painel"&&it.status!=="novo")return fail("A produção já começou este item. Peça ao gerente para cancelar.",403);
  await D.prepare("UPDATE cm_itens SET status=?,updated=? WHERE id=?").bind(st,T(),it.id).run();
  if(st==="cancelado")await recalcular(env,c.id);else await D.prepare("UPDATE cm_comandas SET updated=? WHERE id=?").bind(T(),c.id).run();
  return json({ok:true,comanda:await umaVolta(c.id)});
 }
 if(acao==="transferir"){
  if(c.status!=="aberta"||c.tipo!=="mesa")return fail("Só é possível transferir mesas abertas.");
  const m=await D.prepare("SELECT id,numero FROM cm_mesas WHERE id=? AND tenant_id=? AND loja=? AND ativo=1").bind(String(b.mesa_id||""),tid,loja).first();
  if(!m)return fail("Mesa não encontrada.",404);
  if(await D.prepare("SELECT 1 FROM cm_comandas WHERE tenant_id=? AND loja=? AND mesa_id=? AND status='aberta'").bind(tid,loja,m.id).first())return fail("A mesa "+m.numero+" já está ocupada.");
  await D.prepare("UPDATE cm_comandas SET mesa_id=?,mesa_label=?,updated=? WHERE id=?").bind(m.id,m.numero,T(),c.id).run();
  if(c.mesa_id)await limparCodigo(env,c.mesa_id); // a senha da mesa antiga deixa de valer
  return json({ok:true,comanda:await umaVolta(c.id)});
 }
 if(acao==="fechar"){
  if(!podeFechar(quem,cfg))return fail("Nesta loja, a conta é fechada pelo caixa.",403);
  const r=await fecharComanda(env,{tid,loja,comanda:c,pagamento:b.pagamento,servico_cents:b.servico_cents,desconto_cents:quem.tipo==="painel"||quem.atendente.papel==="caixa"?b.desconto_cents:c.desconto_cents,por:nomeQuem(quem),fuso:cfg.fuso});
  if(r.erro)return fail(r.erro);
  return json({ok:true,comanda:await umaVolta(c.id)});
 }
 // Daqui para baixo, só o gerente (painel).
 if(quem.tipo!=="painel")return fail("Ação permitida só no painel.",403);
 if(acao==="etapa"){
  const e=String(b.etapa||"");if(!ETAPAS.includes(e)||e==="concluido")return fail("Etapa inválida.");
  await D.prepare("UPDATE cm_comandas SET etapa=?,updated=? WHERE id=?").bind(e,T(),c.id).run();
  if(e==="pronto"||e==="saiu")await D.prepare("UPDATE cm_itens SET status='pronto',updated=? WHERE comanda_id=? AND status IN ('novo','preparo')").bind(T(),c.id).run();
  return json({ok:true,comanda:await umaVolta(c.id)});
 }
 if(acao==="cancelar"){
  if(c.status!=="aberta")return fail("Esta conta já foi encerrada.");
  const agora=T();
  if(c.tipo==="mesa"&&c.mesa_id)await limparCodigo(env,c.mesa_id);
  await D.batch([D.prepare("UPDATE cm_comandas SET status='cancelada',etapa='concluido',obs=COALESCE(obs,'')||?,fechada_em=?,updated=? WHERE id=?").bind(b.motivo?" · Cancelado: "+cleanText(b.motivo,120):"",agora,agora,c.id),
   D.prepare("UPDATE cm_itens SET status='cancelado',updated=? WHERE comanda_id=? AND status<>'entregue'").bind(agora,c.id)]);
  return json({ok:true,comanda:await umaVolta(c.id)});
 }
 return fail("Ação inválida.");
}
