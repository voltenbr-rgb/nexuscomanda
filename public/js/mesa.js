// Nexus Comanda — pedido do cliente pelo celular na mesa (/mesa/<loja>).
// 1) escolhe a mesa  2) digita a senha que o garçom passou  3) escolhe os itens  4) confirma o aviso ("já pediu ao garçom?") e envia.
(()=>{
 const {$,$$,esc,brl,slug,api,toast,sheet,pill,emoji,desde,loop}=CM;
 const S=slug(),A='/api/mesa/'+encodeURIComponent(S);
 let I=null,D=null,cat='',busca='',sac={},poll=null;
 const P=id=>D.produtos.find(p=>p.id===id);
 const linhas=()=>Object.entries(sac).filter(([id,x])=>P(id)&&x.q>0).map(([id,x])=>({p:P(id),...x}));
 const sub=()=>linhas().reduce((s,l)=>s+l.p.preco_cents*l.q,0),qtd=()=>linhas().reduce((s,l)=>s+l.q,0);
 const cab=(extra='')=>`<header class=cd-top><span class=lg>${I?.loja?.logo?`<img src="${esc(I.loja.logo)}" alt="">`:esc((I?.loja?.nome||'N')[0])}</span><b>${esc(I?.loja?.nome||'')}</b>${extra}</header>`;

 async function iniciar(msg){
  poll?.stop();poll=null;
  try{I=await api(A)}catch(e){$('#app').innerHTML=`<div class=lg-box><h1>Indisponível</h1><p class=mu>${esc(e.message)}</p></div>`;return}
  if(!I.ativo){$('#app').innerHTML=`<div class=lg-box>${cab()}<div class=card style="text-align:center"><div style="font-size:44px">🙋</div><h2>Peça ao garçom</h2><p class=mu>Esta loja não está recebendo pedidos pelo celular na mesa.</p></div></div>`;return}
  if(I.sessao)return cardapio();
  escolherMesa(msg);
 }
 function escolherMesa(msg){
  $('#app').innerHTML=`<div class=lg-box style="max-width:560px">${cab()}
   ${msg?`<div class=card style="background:var(--coral2);box-shadow:none;color:#8a1c1c;font-weight:600">${esc(msg)}</div>`:''}
   <div><h1>Em qual mesa você está?</h1><p class=mu style="margin:6px 0 0">O número fica na plaquinha da mesa.</p></div>
   <div class=gc-mesas id=ms>${I.mesas.map(m=>`<button class=ms data-m="${esc(m.id)}"><span class=n>${esc(m.numero)}</span><small>mesa</small></button>`).join('')||'<p class=mu>Nenhuma mesa cadastrada.</p>'}</div></div>`;
  $('#ms').onclick=e=>{const b=e.target.closest('[data-m]');if(b)senha(I.mesas.find(m=>m.id===b.dataset.m))};
 }
 function senha(m){
  let p='';
  $('#app').innerHTML=`<div class=lg-box style="text-align:center">${cab()}<button class="b ghost sm" id=vt style="justify-self:start">← Trocar mesa</button>
   <h1>Mesa ${esc(m.numero)}</h1><p class=mu style="margin:0">Digite a <b>senha da mesa</b> que o garçom informou.</p>
   <div class=dots id=dt>${'<i></i>'.repeat(4)}</div><div class=pin id=pd>${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button data-k="${k}">${k}</button>`).join('')}</div>
   <button class="b blk" id=ok disabled>Entrar na mesa</button><small class=mu>Não tem a senha? Chame o garçom — ele libera a mesa para você pedir por aqui.</small></div>`;
  const dots=()=>{const n=Math.max(4,p.length);$('#dt').innerHTML=Array.from({length:n},(_,i)=>`<i class="${i<p.length?'on':''}"></i>`).join('');$('#ok').disabled=p.length<3};
  const enviar=async()=>{$('#ok').disabled=true;try{await api(A,{method:'POST',body:{mesa_id:m.id,codigo:p}});I.sessao={mesa_id:m.id,numero:m.numero};cardapio()}catch(e){toast(e.message,1);p='';dots()}};
  $('#vt').onclick=()=>escolherMesa();
  $('#pd').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;if(k==='⌫')p=p.slice(0,-1);else if(p.length<6)p+=k;dots();if(p.length===6)enviar()};
  $('#ok').onclick=enviar;
 }
 // Sessão inválida (mesa fechada / senha trocada): volta para o início com o aviso.
 const perdeu=e=>{if(e.status===401||e.status===403){sac={};iniciar(e.message);return true}return false};
 async function cardapio(){
  try{D=await api(A+'/pedido')}catch(e){if(!perdeu(e))toast(e.message,1);return}
  desenhar();if(D.ja_pedido.length)pedidosMesa(); // ao entrar, o cliente já vê o que foi pedido na mesa
  poll=loop(async()=>{try{const r=await api(A+'/pedido?parcial=1');D.ja_pedido=r.ja_pedido;D.total_cents=r.total_cents;const b=$('#jp');if(b)b.innerHTML=`🧾 Pedidos da mesa <small>${r.ja_pedido.length}</small>`}catch(e){perdeu(e)}},12000);
 }
 function desenhar(){
  const cats=D.categorias.filter(c=>D.produtos.some(p=>p.categoria_id===c.id));
  $('#app').innerHTML=`<div class=wrap style="grid-template-columns:1fr"><div style="display:grid;gap:16px;min-width:0">
   ${cab(`<span class="pill" style="background:var(--lime);color:var(--ink)">Mesa ${esc(D.mesa.numero)}</span><button class="b sm" id=sair style="background:#ffffff14">Sair</button>`)}
   <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button class="b light" id=jp>🧾 Pedidos da mesa <small>${D.ja_pedido.length}</small></button><input class=in id=q placeholder="🔎 Buscar no cardápio" value="${esc(busca)}" style="flex:1;min-width:180px"></div>
   <nav class=cd-cats id=cats><button class="cd-cat ${!cat?'on':''}" data-c=""><i>✨</i><span>Tudo</span></button>${cats.map(c=>`<button class="cd-cat ${cat===c.id?'on':''}" data-c="${esc(c.id)}"><i>${esc(c.icone||'🍽️')}</i><span>${esc(c.nome)}</span></button>`).join('')}</nav>
   <div id=lista class=cd-sec></div></div></div><div id=bagBar></div>`;
  lista();barra();
  $('#q').oninput=e=>{busca=e.target.value;lista()};
  $('#cats').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cat=b.dataset.c;$$('.cd-cat').forEach(x=>x.classList.toggle('on',x===b));lista()};
  $('#jp').onclick=pedidosMesa;
  $('#sair').onclick=async()=>{if(!confirm('Sair desta mesa?'))return;try{await api(A,{method:'DELETE'})}catch{}I.sessao=null;sac={};iniciar()};
 }
 const card=p=>{const q=sac[p.id]?.q||0,cn=(D.categorias.find(c=>c.id===p.categoria_id)||{}).nome||'';
  return `<article class="pc${q?' in-cart':''}" data-p="${esc(p.id)}"><div class=ph>${p.foto?`<img src="${esc(p.foto)}" alt="" loading=lazy>`:emoji(cn+' '+p.nome)}</div><div class=bd><span class=ct>${esc(cn)}</span><h3>${esc(p.nome)}</h3>${p.descricao?`<p>${esc(p.descricao)}</p>`:''}<div class=ft><span class=pr>${brl(p.preco_cents)}</span>${q?`<span class=stp><button class=m data-a=menos>−</button><b>${q}</b><button data-a=mais>+</button></span>`:`<button class=add data-a=mais aria-label=Adicionar>+</button>`}</div></div></article>`};
 function lista(){
  const t=busca.trim().toLowerCase(),ps=D.produtos.filter(p=>(!cat||p.categoria_id===cat)&&(!t||(p.nome+' '+(p.descricao||'')).toLowerCase().includes(t)));
  $('#lista').innerHTML=ps.length?`<div class=cd-grid>${ps.map(card).join('')}</div>`:'<div class=cd-empty>Nada encontrado.</div>';
  $('#lista').onclick=e=>{const b=e.target.closest('[data-a]'),c=e.target.closest('[data-p]');if(!c)return;const id=c.dataset.p;
   if(!b)return obs(id);const x=sac[id]||{q:0,obs:''};x.q=Math.max(0,x.q+(b.dataset.a==='mais'?1:-1));if(x.q)sac[id]=x;else delete sac[id];c.outerHTML=card(P(id));barra()};
 }
 function obs(id){
  const p=P(id),x=sac[id]||{q:1,obs:''};
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">${esc(p.nome)}</h3><button class=ic data-x>✕</button></div>${p.foto?`<img src="${esc(p.foto)}" alt="" style="width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:20px;margin:6px 0 12px">`:''}${p.descricao?`<p class=mu style="margin-top:0">${esc(p.descricao)}</p>`:''}<label class=fld><span>Observação (opcional)</span><textarea class=in id=ob maxlength=140 placeholder="Ex.: sem cebola, sem gelo…">${esc(x.obs)}</textarea></label><button class="b blk" id=ok>Adicionar · ${brl(p.preco_cents)}</button>`);
  $('#ok',s).onclick=()=>{sac[id]={q:Math.max(1,x.q),obs:$('#ob',s).value.trim().slice(0,140)};s.close();lista();barra()};
 }
 function barra(){const n=qtd(),b=$('#bagBar');if(!b)return;b.innerHTML=n?`<div class=bag-bar style="display:flex"><span class=q>${n}</span><b>Ver meu pedido · ${brl(sub())}</b><button class="b lime sm">Revisar</button></div>`:'';if(n)b.firstChild.onclick=revisar}
 function revisar(){
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Seu pedido · Mesa ${esc(D.mesa.numero)}</h3><button class=ic data-x>✕</button></div><div id=rv></div>`);
  const draw=()=>{if(!qtd()){s.close();barra();lista();return}
   $('#rv',s).innerHTML=`<div class=lst style="display:grid;gap:8px">${linhas().map(l=>`<div class=bi><b>${esc(l.p.nome)}</b><span class=pr>${brl(l.p.preco_cents*l.q)}</span>${l.obs?`<span class=ob>📝 ${esc(l.obs)}</span>`:''}<span class=stp data-id="${esc(l.p.id)}"><button class=m data-a=menos>−</button><b>${l.q}</b><button data-a=mais>+</button></span></div>`).join('')}</div>
    <label class=fld style="margin-top:12px"><span>Observação para o pedido (opcional)</span><input class=in id=po maxlength=200></label>
    <div class=tot><div class=g><span>Total deste pedido</span><span>${brl(sub())}</span></div></div><button class="b blk" id=env style="margin-top:12px">Continuar</button>`;
   $('#env',s).onclick=()=>{const o=$('#po',s).value;s.close();aviso(o)}};
  draw();
  $('#rv',s).onclick=e=>{const b=e.target.closest('[data-a]');if(!b)return;const id=b.closest('[data-id]').dataset.id,x=sac[id];x.q+=b.dataset.a==='mais'?1:-1;if(x.q<=0)delete sac[id];draw()};
 }
 // Aviso obrigatório antes de enviar: mostra o que já foi pedido na mesa e destaca possíveis repetidos.
 function aviso(pobs){
  const ja=D.ja_pedido,nomesJa=new Set(ja.map(i=>i.nome)),rep=linhas().filter(l=>nomesJa.has(l.p.nome));
  const s=sheet(`<div style="text-align:center;font-size:40px">⚠️</div><h3 style="text-align:center;margin:4px 0 8px">Antes de enviar, confira</h3>
   <p style="margin:0 0 12px;text-align:center">Você <b>já pediu algum destes itens ao garçom</b>? Este pedido vai <b>direto para a cozinha e o bar</b> e entra na conta da <b>Mesa ${esc(D.mesa.numero)}</b>.</p>
   ${rep.length?`<div class=card style="background:#fff4d6;box-shadow:none;margin-bottom:10px"><b>Atenção: já existe na conta da mesa</b><br>${rep.map(l=>esc(l.p.nome)).join(', ')}</div>`:''}
   <div class=card style="box-shadow:none;margin-bottom:10px"><b>Você vai pedir agora</b>${linhas().map(l=>`<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px"><span>${l.q}× ${esc(l.p.nome)}${l.obs?` <small class=mu>(${esc(l.obs)})</small>`:''}</span><b>${brl(l.q*l.p.preco_cents)}</b></div>`).join('')}</div>
   ${ja.length?`<details class=card style="box-shadow:none;margin-bottom:10px"><summary><b>Já pedido nesta mesa (${ja.length})</b></summary>${ja.map(i=>`<div style="display:flex;justify-content:space-between;gap:8px;margin-top:6px"><span>${i.qtd}× ${esc(i.nome)}</span><small class=mu>${i.quem==='mesa_cliente'?'📱 celular':'🧑‍🍳 garçom'}</small></div>`).join('')}</details>`:''}
   <label style="display:flex;gap:10px;align-items:flex-start;margin:6px 0 12px;font-weight:600"><input type=checkbox id=ck style="width:22px;height:22px;flex:0 0 auto"> Conferi: não pedi estes itens ao garçom.</label>
   <div style="display:flex;gap:8px"><button class="b ghost" data-x style="flex:0 0 auto">Voltar</button><button class=b id=ok disabled style="flex:1">Enviar pedido</button></div>`);
  $('#ck',s).onchange=e=>{$('#ok',s).disabled=!e.target.checked};
  $('#ok',s).onclick=async e=>{e.target.disabled=true;
   try{const r=await api(A+'/pedido',{method:'POST',body:{confirmado:true,obs:pobs,itens:linhas().map(l=>({produto_id:l.p.id,qtd:l.q,obs:l.obs}))}});
    s.close();sac={};toast(`Pedido #${r.numero} enviado para a cozinha!`);const n=await api(A+'/pedido?parcial=1');D.ja_pedido=n.ja_pedido;D.total_cents=n.total_cents;desenhar();pedidosMesa()}
   catch(x){s.close();if(!perdeu(x))toast(x.message,1)}};
 }
 function pedidosMesa(){
  const ja=D.ja_pedido;
  sheet(`<div class=sh-hd><h3 style="margin:0">Pedidos da Mesa ${esc(D.mesa.numero)}</h3><button class=ic data-x>✕</button></div>
   ${ja.length?`<div class=env>${ja.map(i=>`<div class=it><span class=q>${i.qtd}</span><span class=nm><b>${esc(i.nome)}</b><small>${i.quem==='mesa_cliente'?'📱 pelo celular':'🧑‍🍳 pelo garçom'} · ${desde(i.criado_em)}</small></span>${pill(i.status)}</div>`).join('')}</div><div class=tot style="margin-top:12px"><div class=g><span>Total da mesa</span><span>${brl(D.total_cents)}</span></div></div><p class=mu style="font-size:13px">Para fechar a conta, chame o garçom.</p>`:'<p class=mu>Nenhum pedido ainda nesta mesa.</p>'}`);
 }
 iniciar();
})();
