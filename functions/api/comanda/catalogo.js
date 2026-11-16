import {json,fail,uid,cleanText,int,cents,painelCtx,imgOk,SETORES} from "../../_lib/comanda.js";
import {readJson} from "../../_lib/http.js";
// Cardápio da loja: categorias e produtos. O "setor" do produto decide para qual tela de produção o item vai.
const T=()=>Date.now();
export async function listarCatalogo(env,tid,loja,{publico=false}={}){
 // No cardápio/garçom/mesa, produto desmarcado continua aparecendo como "Indisponível no momento" (não some do cardápio).
 const f=publico?" AND ativo=1":"";
 const cats=(await env.DB.prepare(`SELECT id,nome,icone,ordem,ativo FROM cm_categorias WHERE tenant_id=? AND loja=?${f} ORDER BY ordem,nome`).bind(tid,loja).all()).results||[];
 const prods=(await env.DB.prepare(`SELECT id,categoria_id,nome,descricao,preco_cents,foto,setor,destaque,ativo,ordem FROM cm_produtos WHERE tenant_id=? AND loja=? ORDER BY ordem,nome`).bind(tid,loja).all()).results||[];
 return {categorias:cats,produtos:publico?prods.filter(p=>!p.categoria_id||cats.some(c=>c.id===p.categoria_id)).map(({setor,ordem,ativo,...p})=>({...p,indisponivel:ativo?0:1})):prods};
}
export async function onRequestGet(c){
 const x=await painelCtx(c);if(x.error)return x.error;
 return json(await listarCatalogo(c.env,x.tid,x.loja));
}
export async function onRequestPost(c){
 const b=await readJson(c.request)||{};
 const x=await painelCtx(c,b.loja);if(x.error)return x.error;
 const D=c.env.DB,{tid,loja}=x;
 if(b.action==="salvar_categoria"){
  const nome=cleanText(b.nome,40);if(!nome)return fail("Informe o nome da categoria.");
  const id=b.id?String(b.id):uid();
  await D.prepare("INSERT INTO cm_categorias(id,tenant_id,loja,nome,icone,ordem,ativo,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET nome=excluded.nome,icone=excluded.icone,ordem=excluded.ordem,ativo=excluded.ativo,updated=excluded.updated WHERE cm_categorias.tenant_id=excluded.tenant_id AND cm_categorias.loja=excluded.loja")
   .bind(id,tid,loja,nome,cleanText(b.icone,8)||null,int(b.ordem,0,999,0),b.ativo===0||b.ativo===false?0:1,T()).run();
  return json({ok:true,id});
 }
 if(b.action==="excluir_categoria"){
  const id=String(b.id||"");
  if((await D.prepare("SELECT COUNT(*) n FROM cm_produtos WHERE tenant_id=? AND loja=? AND categoria_id=?").bind(tid,loja,id).first())?.n)return fail("Mova ou exclua os produtos desta categoria antes.");
  await D.prepare("DELETE FROM cm_categorias WHERE id=? AND tenant_id=? AND loja=?").bind(id,tid,loja).run();
  return json({ok:true});
 }
 if(b.action==="salvar_produto"){
  const nome=cleanText(b.nome,60);if(!nome)return fail("Informe o nome do produto.");
  const setor=b.setor==="nenhum"?"nenhum":SETORES.includes(b.setor)?b.setor:null;
  if(!setor)return fail("Escolha o destino de preparo (Cozinha, Bar ou Sem preparo).");
  let cat=b.categoria_id?String(b.categoria_id):null;
  if(cat&&!await D.prepare("SELECT 1 FROM cm_categorias WHERE id=? AND tenant_id=? AND loja=?").bind(cat,tid,loja).first())return fail("Categoria inválida.");
  if(b.foto&&!imgOk(b.foto))return fail("Foto inválida ou muito grande.");
  const id=b.id?String(b.id):uid();
  const foto=b.foto===undefined?null:b.foto||"";
  await D.prepare(`INSERT INTO cm_produtos(id,tenant_id,loja,categoria_id,nome,descricao,preco_cents,foto,setor,destaque,ativo,ordem,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET categoria_id=excluded.categoria_id,nome=excluded.nome,descricao=excluded.descricao,preco_cents=excluded.preco_cents,foto=COALESCE(?,cm_produtos.foto),setor=excluded.setor,destaque=excluded.destaque,ativo=excluded.ativo,ordem=excluded.ordem,updated=excluded.updated
   WHERE cm_produtos.tenant_id=excluded.tenant_id AND cm_produtos.loja=excluded.loja`)
   .bind(id,tid,loja,cat,nome,cleanText(b.descricao,300)||null,cents(b.preco_cents),foto||null,setor,b.destaque?1:0,b.ativo===0||b.ativo===false?0:1,int(b.ordem,0,9999,0),T(),foto).run();
  return json({ok:true,id});
 }
 if(b.action==="ativo_produto"){
  await D.prepare("UPDATE cm_produtos SET ativo=?,updated=? WHERE id=? AND tenant_id=? AND loja=?").bind(b.ativo?1:0,T(),String(b.id||""),tid,loja).run();
  return json({ok:true});
 }
 if(b.action==="excluir_produto"){
  await D.prepare("DELETE FROM cm_produtos WHERE id=? AND tenant_id=? AND loja=?").bind(String(b.id||""),tid,loja).run();
  return json({ok:true});
 }
 if(b.action==="modelo"){ // cardápio de exemplo para começar rápido (só se a loja ainda não tem nada)
  if((await D.prepare("SELECT COUNT(*) n FROM cm_categorias WHERE tenant_id=? AND loja=?").bind(tid,loja).first())?.n)return fail("A loja já tem categorias cadastradas.");
  const M=MODELOS[b.modelo]||MODELOS.restaurante,st=[];
  M.forEach(([cn,ic,itens],ci)=>{const cid=uid();st.push(D.prepare("INSERT INTO cm_categorias(id,tenant_id,loja,nome,icone,ordem,updated) VALUES(?,?,?,?,?,?,?)").bind(cid,tid,loja,cn,ic,ci,T()));
   itens.forEach(([n,d,p,s],pi)=>st.push(D.prepare("INSERT INTO cm_produtos(id,tenant_id,loja,categoria_id,nome,descricao,preco_cents,setor,ordem,updated) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(uid(),tid,loja,cid,n,d,p,s,pi,T())))});
  await D.batch(st);return json({ok:true});
 }
 return fail("Ação inválida.");
}
const MODELOS={
 restaurante:[["Pratos","🍽️",[["Parmegiana de frango","Arroz, fritas e salada",4290,"cozinha"],["Filé à parmegiana","Arroz, fritas e salada",5490,"cozinha"],["Executivo do dia","Prato do dia com bebida",3290,"cozinha"]]],["Porções","🍟",[["Batata frita","500 g com cheddar e bacon",3490,"cozinha"],["Isca de frango","400 g com molho da casa",3990,"cozinha"]]],["Bebidas","🥤",[["Refrigerante lata","350 ml",700,"bar"],["Suco natural","500 ml",1200,"bar"],["Água mineral","500 ml",500,"bar"]]],["Drinks","🍹",[["Caipirinha","Limão, cachaça e açúcar",1990,"bar"],["Chopp","300 ml",1290,"bar"]]],["Sobremesas","🍨",[["Petit gâteau","Com sorvete de creme",2490,"cozinha"]]]],
 pizzaria:[["Pizzas","🍕",[["Calabresa","Mussarela, calabresa e cebola",5490,"cozinha"],["Margherita","Mussarela, tomate e manjericão",5290,"cozinha"],["Portuguesa","Presunto, ovo, cebola e azeitona",5990,"cozinha"],["Frango com catupiry","Frango desfiado e catupiry",5790,"cozinha"]]],["Pizzas doces","🍫",[["Chocolate com morango","Chocolate ao leite e morangos",5490,"cozinha"]]],["Bebidas","🥤",[["Refrigerante 2 L","Coca-Cola, Guaraná",1490,"bar"],["Refrigerante lata","350 ml",700,"bar"],["Cerveja long neck","355 ml",1100,"bar"]]]],
 lanchonete:[["Lanches","🍔",[["X-Burger","Pão, carne, queijo e maionese",2290,"cozinha"],["X-Salada","Carne, queijo, alface e tomate",2490,"cozinha"],["X-Bacon","Carne, queijo e bacon",2790,"cozinha"],["X-Tudo","Completo da casa",3290,"cozinha"]]],["Porções","🍟",[["Batata frita","Porção média",1990,"cozinha"]]],["Bebidas","🥤",[["Refrigerante lata","350 ml",700,"bar"],["Milkshake","500 ml",1890,"bar"],["Suco natural","500 ml",1100,"bar"]]]],
 sushi:[["Combinados","🍣",[["Combinado 20 peças","Sushis, sashimis e hossomakis",7990,"cozinha"],["Combinado 40 peças","Seleção do sushiman",13990,"cozinha"]]],["Temakis","🌯",[["Temaki salmão","Salmão e cebolinha",3290,"cozinha"],["Temaki Philadelphia","Salmão e cream cheese",3490,"cozinha"]]],["Quentes","🔥",[["Hot roll","10 unidades",2990,"cozinha"],["Yakisoba","Carne e legumes",4290,"cozinha"]]],["Bebidas","🍶",[["Refrigerante lata","350 ml",700,"bar"],["Saquê","Dose",1590,"bar"],["Chá gelado","500 ml",990,"bar"]]]]
};
