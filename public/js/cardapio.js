// Nexus Comanda — cardápio digital público (/cardapio/<loja>): vitrine clara, sacola e pedido de delivery/retirada.
(()=>{
 const {$,$$,esc,brl,slug,api,toast,sheet,pill,emoji,PAG}=CM;
 const S=slug(),KEY='cm_sacola_'+S,KEYC='cm_cliente';
 let D=null,tipo='delivery',cat='',busca='',sac={};
 try{sac=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
 const salvar=()=>{try{localStorage.setItem(KEY,JSON.stringify(sac))}catch{}};
 const P=id=>D.produtos.find(p=>p.id===id);
 const linhas=()=>Object.entries(sac).filter(([id,x])=>P(id)&&x.q>0).map(([id,x])=>({p:P(id),...x}));
 const subtotal=()=>linhas().reduce((s,l)=>s+l.p.preco_cents*l.q,0);
 const qtd=()=>linhas().reduce((s,l)=>s+l.q,0);
 const taxa=()=>tipo==='delivery'?D.loja.taxa_entrega_cents:0;

 async function iniciar(){
  try{D=await api('/api/cardapio/'+encodeURIComponent(S))}catch(e){$('#app').innerHTML=`<div class=lg-box><h1>Cardápio indisponível</h1><p class=mu>${esc(e.message)}</p></div>`;return}
  if(!D.loja.delivery&&D.loja.retirada)tipo='retirada';
  document.title='Cardápio · '+D.loja.nome;
  const ult=sessionStorage.getItem('cm_ult_'+S);if(location.hash.startsWith('#pedido='))return acompanhar(location.hash.slice(8));
  render();if(ult&&!qtd())bannerUltimo(ult);
 }
 function render(){
  const L=D.loja,cats=D.categorias.filter(c=>D.produtos.some(p=>p.categoria_id===c.id));
  const cnt=id=>D.produtos.filter(p=>p.categoria_id===id).length;
  $('#app').innerHTML=`<div class=wrap><div class=cd-main style="display:grid;gap:18px;min-width:0">
   <header class=cd-top><span class=lg>${L.logo?`<img src="${esc(L.logo)}" alt="">`:esc((L.nome||'N')[0])}</span><b>${esc(L.nome)}</b><label class=srch>🔎<input id=q placeholder="Buscar no cardápio" value="${esc(busca)}" autocomplete=off></label></header>
   <section class="cd-hero${L.capa?' capa':''}" ${L.capa?`style="background-image:url('${esc(L.capa)}')"`:''}>
    <h1>${esc(L.nome)}</h1>
    <div class=meta>${L.aceitando?`<span>🟢 Aberto para pedidos</span>`:`<span class=off>Fechado para pedidos agora</span>`}${L.delivery?`<span>🛵 Entrega ${esc(L.tempo_entrega)}</span>`:''}${L.retirada?`<span>🛍️ Retirada ${esc(L.tempo_retirada)}</span>`:''}${L.delivery?`<span>${L.taxa_entrega_cents?'Taxa '+brl(L.taxa_entrega_cents):'Entrega grátis'}</span>`:''}${L.pedido_minimo_cents?`<span>Mínimo ${brl(L.pedido_minimo_cents)}</span>`:''}</div>
    ${L.delivery&&L.retirada?`<div><div class=seg id=tipo><button data-t=delivery class="${tipo==='delivery'?'on':''}">🛵 Delivery</button><button data-t=retirada class="${tipo==='retirada'?'on':''}">🛍️ Retirada</button></div></div>`:''}
    ${L.endereco?`<small style="opacity:.85">📍 ${esc(L.endereco)}</small>`:''}
   </section>
   <nav class=cd-cats id=cats><button class="cd-cat ${!cat?'on':''}" data-c=""><i>✨</i><span>Tudo<br><small class=mu>${D.produtos.length} itens</small></span></button>${cats.map(c=>`<button class="cd-cat ${cat===c.id?'on':''}" data-c="${esc(c.id)}"><i>${esc(c.icone||'🍽️')}</i><span>${esc(c.nome)}<br><small class=mu>${cnt(c.id)} itens</small></span></button>`).join('')}</nav>
   <div id=lista class=cd-sec></div></div>
   <aside class="bag side" id=bagSide></aside></div><div id=bagBar></div>`;
  lista();sacola();
  $('#q').oninput=e=>{busca=e.target.value;lista()};
  $('#cats').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cat=b.dataset.c;$$('.cd-cat').forEach(x=>x.classList.toggle('on',x===b));lista();window.scrollTo({top:$('#cats').offsetTop-70,behavior:'smooth'})};
  const tp=$('#tipo');if(tp)tp.onclick=e=>{const b=e.target.closest('[data-t]');if(!b)return;tipo=b.dataset.t;$$('#tipo button').forEach(x=>x.classList.toggle('on',x===b));sacola()};
 }
 function card(p,cn){
  const q=sac[p.id]?.q||0;
  return `<article class="pc${q?' in-cart':''}" data-p="${esc(p.id)}">${p.destaque?'<span class=dst>★ Destaque</span>':''}<div class=ph>${p.foto?`<img src="${esc(p.foto)}" alt="" loading=lazy>`:emoji(cn+' '+p.nome)}</div>
   <div class=bd><span class=ct>${esc(cn)}</span><h3>${esc(p.nome)}</h3>${p.descricao?`<p>${esc(p.descricao)}</p>`:''}
   <div class=ft><span class=pr>${brl(p.preco_cents)}</span>${q?`<span class=stp><button class=m data-a=menos aria-label="Tirar um">−</button><b>${q}</b><button data-a=mais aria-label="Mais um">+</button></span>`:`<button class=add data-a=mais aria-label="Adicionar">+</button>`}</div></div></article>`;
 }
 function lista(){
  const q=busca.trim().toLowerCase(),cn=id=>(D.categorias.find(c=>c.id===id)||{}).nome||'';
  let ps=D.produtos.filter(p=>(!cat||p.categoria_id===cat)&&(!q||(p.nome+' '+(p.descricao||'')).toLowerCase().includes(q)));
  const grupos=cat||q?[{c:null,ps}]:D.categorias.map(c=>({c,ps:ps.filter(p=>p.categoria_id===c.id)})).concat([{c:{nome:'Outros'},ps:ps.filter(p=>!p.categoria_id)}]).filter(g=>g.ps.length);
  const destaques=!cat&&!q?D.produtos.filter(p=>p.destaque):[];
  $('#lista').innerHTML=!ps.length?`<div class=cd-empty>Nada encontrado${q?` para “${esc(busca)}”`:''}.</div>`:
   (destaques.length?`<h2 class=cd-h2>★ Destaques</h2><div class=cd-grid>${destaques.map(p=>card(p,cn(p.categoria_id))).join('')}</div>`:'')+
   grupos.map(g=>`${g.c?`<h2 class=cd-h2>${esc(g.c.icone||'')} ${esc(g.c.nome)} <small>${g.ps.length}</small></h2>`:''}<div class=cd-grid>${g.ps.map(p=>card(p,cn(p.categoria_id))).join('')}</div>`).join('');
  $('#lista').onclick=e=>{const b=e.target.closest('[data-a]'),c=e.target.closest('[data-p]');if(!c)return;const id=c.dataset.p;
   if(!b){detalhe(id);return}
   mudar(id,b.dataset.a==='mais'?1:-1)};
 }
 function mudar(id,d){
  if(!D.loja.aceitando&&d>0){toast('A loja não está recebendo pedidos agora.',1);return}
  const x=sac[id]||{q:0,obs:''};x.q=Math.max(0,Math.min(99,x.q+d));if(x.q)sac[id]=x;else delete sac[id];salvar();
  $$(`.cd-grid [data-p="${CSS.escape(id)}"]`).forEach(el=>{const p=P(id);el.outerHTML=card(p,(D.categorias.find(k=>k.id===p.categoria_id)||{}).nome||'')});
  sacola();
 }
 function detalhe(id){
  const p=P(id),x=sac[id]||{q:0,obs:''};let q=Math.max(1,x.q);
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">${esc(p.nome)}</h3><button class=ic data-x aria-label=Fechar>✕</button></div>
   ${p.foto?`<img src="${esc(p.foto)}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:20px;margin:8px 0 12px">`:''}
   ${p.descricao?`<p class=mu style="margin-top:0">${esc(p.descricao)}</p>`:''}
   <label class=fld><span>Alguma observação?</span><textarea class=in id=ob maxlength=140 placeholder="Ex.: sem cebola, ponto da carne…">${esc(x.obs||'')}</textarea></label>
   <div style="display:flex;gap:12px;align-items:center"><span class=stp><button class=m id=dm>−</button><b id=dq>${q}</b><button id=dp>+</button></span><button class="b blk" id=ok style="flex:1">Adicionar · <span id=dt>${brl(p.preco_cents*q)}</span></button></div>`);
  const up=()=>{$('#dq',s).textContent=q;$('#dt',s).textContent=brl(p.preco_cents*q)};
  $('#dm',s).onclick=()=>{q=Math.max(1,q-1);up()};$('#dp',s).onclick=()=>{q=Math.min(99,q+1);up()};
  $('#ok',s).onclick=()=>{if(!D.loja.aceitando){toast('A loja não está recebendo pedidos agora.',1);return}sac[id]={q,obs:$('#ob',s).value.trim().slice(0,140)};salvar();s.close();lista();sacola()};
 }
 function resumoHTML(edit=true){
  const ls=linhas(),sub=subtotal(),tx=taxa();
  return `<div class=lst>${ls.map(l=>`<div class=bi><div><b>${esc(l.p.nome)}</b></div><span class=pr>${brl(l.p.preco_cents*l.q)}</span>${l.obs?`<span class=ob>📝 ${esc(l.obs)}</span>`:''}${edit?`<span class=stp data-id="${esc(l.p.id)}"><button class=m data-a=menos>−</button><b>${l.q}</b><button data-a=mais>+</button></span><button class=ic data-a=rm data-id="${esc(l.p.id)}" style="justify-self:end;width:30px;height:30px;font-size:13px" aria-label=Remover>✕</button>`:`<small class=mu>${l.q}× ${brl(l.p.preco_cents)}</small>`}</div>`).join('')}</div>
   <div class=tot><div><span>Subtotal</span><b>${brl(sub)}</b></div>${tipo==='delivery'?`<div><span>Taxa de entrega</span><b>${tx?brl(tx):'Grátis'}</b></div>`:''}<div class=g><span>Total</span><span>${brl(sub+tx)}</span></div></div>`;
 }
 function sacola(){
  const n=qtd(),side=$('#bagSide'),bar=$('#bagBar');if(!side)return;
  const min=D.loja.pedido_minimo_cents,falta=min&&subtotal()<min?min-subtotal():0;
  side.innerHTML=`<h2>Seu pedido <span class="pill st-novo">${tipo==='delivery'?'🛵 Delivery':'🛍️ Retirada'}</span></h2>`+(n?resumoHTML()+(falta?`<small class=mu>Faltam ${brl(falta)} para o pedido mínimo.</small>`:'')+`<button class="b blk" id=fin ${falta||!D.loja.aceitando?'disabled':''}>Finalizar pedido</button>`:`<div class=cd-empty style="padding:24px">🛒<br>Sua sacola está vazia.<br><small>Toque no + para adicionar.</small></div>`);
  side.onclick=e=>{const b=e.target.closest('[data-a]');if(b){const id=b.dataset.id||b.closest('[data-id]').dataset.id;if(b.dataset.a==='rm'){delete sac[id];salvar();lista();sacola()}else mudar(id,b.dataset.a==='mais'?1:-1)}if(e.target.id==='fin')checkout()};
  bar.innerHTML=n?`<div class=bag-bar><span class=q>${n}</span><b>Ver sacola · ${brl(subtotal()+taxa())}</b><button class="b lime sm" id=vb>Abrir</button></div>`:'';
  if(n)bar.firstChild.onclick=()=>bolsaMobile();
 }
 function bolsaMobile(){
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Seu pedido</h3><button class=ic data-x aria-label=Fechar>✕</button></div><div id=bm class=bag style="position:static;background:transparent;padding:0"></div>`);
  const draw=()=>{const min=D.loja.pedido_minimo_cents,falta=min&&subtotal()<min?min-subtotal():0;if(!qtd()){s.close();return}
   $('#bm',s).innerHTML=resumoHTML()+(falta?`<small class=mu>Faltam ${brl(falta)} para o pedido mínimo.</small>`:'')+`<button class="b blk" id=fin2 ${falta||!D.loja.aceitando?'disabled':''}>Continuar</button>`};
  draw();
  $('#bm',s).onclick=e=>{const b=e.target.closest('[data-a]');if(b){const id=b.dataset.id||b.closest('[data-id]').dataset.id;if(b.dataset.a==='rm'){delete sac[id]}else{const x=sac[id];x.q=Math.max(0,x.q+(b.dataset.a==='mais'?1:-1));if(!x.q)delete sac[id]}salvar();lista();sacola();draw()}if(e.target.id==='fin2'){s.close();checkout()}};
 }
 function checkout(){
  const L=D.loja;let c={};try{c=JSON.parse(localStorage.getItem(KEYC)||'{}')}catch{}
  let pag=L.pagamentos.includes(c.pag)?c.pag:L.pagamentos[0];
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">${tipo==='delivery'?'🛵 Entrega':'🛍️ Retirada'} · finalizar</h3><button class=ic data-x aria-label=Fechar>✕</button></div>
   <label class=fld><span>Seu nome</span><input class=in id=nm maxlength=60 autocomplete=name value="${esc(c.nome||'')}"></label>
   <label class=fld><span>WhatsApp / telefone</span><input class=in id=fn inputmode=tel autocomplete=tel placeholder="(67) 99999-9999" value="${esc(c.fone||'')}"></label>
   ${tipo==='delivery'?`<label class=fld><span>Endereço de entrega</span><textarea class=in id=en maxlength=200 placeholder="Rua, número, bairro e referência">${esc(c.end||'')}</textarea></label>`:`<p class=mu style="margin-top:0">Retire em: ${esc(L.endereco||L.nome)} · ${esc(L.tempo_retirada)}</p>`}
   <div class=fld><span>Pagamento ${tipo==='delivery'?'na entrega':'na retirada'}</span><div class=pay id=pg>${L.pagamentos.map(p=>`<button type=button data-p=${p} class="${p===pag?'on':''}">${PAG[p]}</button>`).join('')}</div></div>
   <div id=extra></div>
   <label class=fld><span>Observação do pedido (opcional)</span><input class=in id=ob maxlength=200 placeholder="Ex.: interfone quebrado"></label>
   <div class=card style="box-shadow:none;margin-bottom:12px">${resumoHTML(false)}</div>
   <button class="b blk" id=env>Enviar pedido · ${brl(subtotal()+taxa())}</button>`);
  const extra=()=>{$('#extra',s).innerHTML=pag==='dinheiro'?`<label class=fld><span>Troco para quanto? (opcional)</span><input class=in id=tr inputmode=decimal placeholder="Ex.: 100"></label>`:pag==='pix'&&L.pix_chave?`<div class=card style="box-shadow:none;margin-bottom:12px;background:var(--lime2)"><b>Chave Pix</b><br><span class=num style="word-break:break-all">${esc(L.pix_chave)}</span><br><small class=mu>Você pode pagar agora ou na ${tipo==='delivery'?'entrega':'retirada'}.</small></div>`:''};extra();
  $('#pg',s).onclick=e=>{const b=e.target.closest('[data-p]');if(!b)return;pag=b.dataset.p;$$('#pg button',s).forEach(x=>x.classList.toggle('on',x===b));extra()};
  $('#fn',s).oninput=e=>{let d=e.target.value.replace(/\D/g,'').slice(0,11);e.target.value=d.length>6?`(${d.slice(0,2)}) ${d.slice(2,d.length-4)}-${d.slice(-4)}`:d.length>2?`(${d.slice(0,2)}) ${d.slice(2)}`:d};
  $('#env',s).onclick=async e=>{
   const b=e.target;b.disabled=true;
   const body={tipo,nome:$('#nm',s).value,fone:$('#fn',s).value,endereco:$('#en',s)?.value||'',pagamento:pag,obs:$('#ob',s).value,troco_para_cents:Math.round(parseFloat(String($('#tr',s)?.value||'0').replace(',','.'))*100)||0,itens:linhas().map(l=>({produto_id:l.p.id,qtd:l.q,obs:l.obs}))};
   try{
    const r=await api('/api/cardapio/'+encodeURIComponent(S)+'/pedido',{method:'POST',body});
    try{localStorage.setItem(KEYC,JSON.stringify({nome:body.nome,fone:body.fone,end:body.endereco,pag}))}catch{}
    sac={};salvar();sessionStorage.setItem('cm_ult_'+S,r.id);s.close();acompanhar(r.id);
   }catch(x){toast(x.message,1);b.disabled=false}
  };
 }
 function bannerUltimo(id){const d=document.createElement('div');d.className='bag-bar';d.style.cssText='background:var(--lime);color:var(--ink)';d.innerHTML='<b>📦 Acompanhe seu último pedido</b><button class="b sm">Ver</button>';d.onclick=()=>{d.remove();acompanhar(id)};$('#bagBar').append(d)}
 let tTrk;
 async function acompanhar(id){
  history.replaceState(null,'','#pedido='+id);
  const passos=r=>r.tipo==='delivery'?[['novo','Pedido recebido'],['preparo','Em preparo'],['pronto','Pronto'],['saiu','Saiu para entrega'],['concluido','Entregue']]:[['novo','Pedido recebido'],['preparo','Em preparo'],['pronto','Pronto para retirar'],['concluido','Retirado']];
  const draw=async()=>{
   let r;try{r=(await api(`/api/cardapio/${encodeURIComponent(S)}/pedido?id=${encodeURIComponent(id)}`)).pedido}catch(e){$('#app').innerHTML=`<div class=lg-box><h1>Pedido não encontrado</h1><button class=b id=vt>Voltar ao cardápio</button></div>`;$('#vt').onclick=voltar;return}
   const ps=passos(r),sit=r.status==='cancelada'?'cancelado':r.situacao==='entregue'?'pronto':r.situacao,ix=ps.findIndex(p=>p[0]===sit);
   $('#app').innerHTML=`<div class=lg-box style="max-width:520px"><header class=cd-top><span class=lg>✓</span><b>${esc(D.loja.nome)}</b></header>
    <div class=card><div class=sh-hd><h1 style="font-size:24px;margin:0">Pedido #${r.numero||''}</h1>${CM.pill(sit)}</div><p class=mu style="margin:6px 0 16px">${r.tipo==='delivery'?'🛵 Delivery':'🛍️ Retirada'} · ${CM.desde(r.aberta_em)} · ${PAG[r.pagamento]||''}</p>
    ${sit==='cancelado'?`<p style="color:var(--coral);font-weight:700">Este pedido foi cancelado pela loja.${D.loja.whatsapp?' Fale com a loja pelo WhatsApp.':''}</p>`:`<div class=trk><div class=stp-l>${ps.map((p,i)=>`<div class="s ${i<ix||sit==='concluido'?'ok':i===ix?'at ok':''}"><i>${i<ix||sit==='concluido'?'✓':i+1}</i><div><b>${p[1]}</b></div></div>`).join('')}</div></div>`}</div>
    <div class=card><div class=lst style="display:grid;gap:6px">${r.itens.map(i=>`<div style="display:flex;justify-content:space-between;gap:8px"><span>${i.qtd}× ${esc(i.nome)}</span><b>${brl(i.qtd*i.preco_cents)}</b></div>`).join('')}</div><div class=tot style="margin-top:10px">${r.taxa_cents?`<div><span>Entrega</span><b>${brl(r.taxa_cents)}</b></div>`:''}<div class=g><span>Total</span><span>${brl(r.total_cents)}</span></div></div></div>
    ${D.loja.whatsapp?`<a class="b lime blk" href="https://wa.me/55${esc(D.loja.whatsapp.replace(/^55/,''))}?text=${encodeURIComponent('Olá! Sobre o meu pedido #'+(r.numero||''))}" target=_blank rel=noopener>💬 Falar com a loja</a>`:''}
    <button class="b ghost blk" id=vt>Fazer outro pedido</button></div>`;
   $('#vt').onclick=voltar;
   clearTimeout(tTrk);if(!['concluido','cancelado'].includes(sit))tTrk=setTimeout(draw,document.hidden?30000:8000);
  };
  draw();
 }
 function voltar(){clearTimeout(tTrk);history.replaceState(null,'',location.pathname);render()}
 iniciar();
})();
