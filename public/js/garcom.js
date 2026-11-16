// Nexus Comanda — tela do garçom/atendente (/garcom/<loja>), pensada para o celular.
// Fluxo: login (nome + PIN) → mesas → comanda da mesa → adicionar itens → enviar para produção → entregar → fechar conta (se permitido).
(()=>{
 const {$,$$,esc,brl,slug,api,toast,sheet,desde,pill,beep,loop,emoji,PAG}=CM;
 const S=slug(),A='/api/garcom/'+encodeURIComponent(S);
 let iniciado=false,E=null,tela={v:'mesas'},aba='mesas',prontosVistos=new Set(),poll=null;
 const C=id=>E.comandas.find(c=>c.id===id);
 const cmdMesa=mid=>E.comandas.find(c=>c.mesa_id===mid);
 const ativos=c=>c.itens.filter(i=>i.status!=='cancelado');
 const totalAberto=c=>c.total_cents;

 async function iniciar(){
  try{E=await api(A)}catch(e){if(e.status===401)return login();$('#app').innerHTML=`<div class=lg-box><h1>Indisponível</h1><p class=mu>${esc(e.message)}</p></div>`;return}
  E.comandas.forEach(c=>c.itens.forEach(i=>{if(i.status==='pronto')prontosVistos.add(i.id);if(i.origem==='mesa_cliente')prontosVistos.add('c'+i.pedido_id)}));iniciado=true;
  desenhar();
  poll=poll||loop(atualizar,5000);
  faixaRede();setTimeout(processarFila,1500);
 }
 async function atualizar(){
  if(!E)return;
  let n;const t0=Date.now();try{n=await api(A+'?parcial=1',{timeout:12000})}catch(e){if(e.status===401){poll?.stop();poll=null;login()}else if(e.rede)setRede(navigator.onLine===false?'off':'fraca');return}
  setRede(Date.now()-t0>4000?'fraca':'ok');
  Object.assign(E,n);
  const cli=[];E.comandas.forEach(c=>c.itens.forEach(i=>{if(i.origem==='mesa_cliente'&&!prontosVistos.has('c'+i.pedido_id)){prontosVistos.add('c'+i.pedido_id);if(iniciado)cli.push(c)}}));
  if(cli.length){beep(3);toast(`📱 Mesa ${cli[0].mesa_label} fez um pedido pelo celular`)}
  const novos=[];E.comandas.forEach(c=>c.itens.forEach(i=>{if(i.status==='pronto'&&!prontosVistos.has(i.id)){prontosVistos.add(i.id);novos.push([c,i])}}));
  if(novos.length){beep(2);try{navigator.vibrate?.([200,100,200])}catch{}const c=novos[0][0];toast(`✅ Pronto: ${novos.map(x=>x[1].qtd+'× '+x[1].nome).slice(0,2).join(', ')} — ${c.tipo==='mesa'?'Mesa '+c.mesa_label:c.cliente_nome||'Balcão'}`)}
  if(tela.v!=='itens'&&!document.querySelector('.sh-bg'))desenhar();
 }
 // ---------- login ----------
 async function login(){
  let L;try{L=await api(A+'/login')}catch(e){$('#app').innerHTML=`<div class=lg-box><h1>Indisponível</h1><p class=mu>${esc(e.message)}</p></div>`;return}
  const quem=()=>{$('#app').innerHTML=`<div class=lg-box><div style="display:flex;gap:12px;align-items:center"><span class=ic style="background:var(--ink);color:var(--lime);width:48px;height:48px;font-weight:800">${L.loja.logo?`<img src="${esc(L.loja.logo)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="">`:'N'}</span><div><small class=mu>Nexus Comanda</small><h1 style="font-size:22px">${esc(L.loja.nome)}</h1></div></div>
   <p class=mu style="margin:0">Quem está entrando?</p>
   ${L.equipe.length?`<div class=who>${L.equipe.map(a=>`<button data-id="${esc(a.id)}"><i>${a.papel==='caixa'?'💳':'🧑‍🍳'}</i><span>${esc(a.nome)}<br><small class=mu style="font-weight:500">${a.papel==='caixa'?'Caixa':'Garçom'}</small></span></button>`).join('')}</div>`:`<div class=card>Nenhum atendente cadastrado ainda. O gerente cadastra em <b>Painel → Mesas e equipe</b>.</div>`}</div>`;
   $('.who')&&($('.who').onclick=e=>{const b=e.target.closest('[data-id]');if(b)pin(L.equipe.find(a=>a.id===b.dataset.id))})};
  const pin=a=>{let p='';$('#app').innerHTML=`<div class=lg-box style="text-align:center"><button class="b ghost sm" id=vt style="justify-self:start">← Voltar</button><h1>Olá, ${esc(a.nome.split(' ')[0])}!</h1><p class=mu style="margin:0">Digite seu PIN</p><div class=dots id=dt>${'<i></i>'.repeat(4)}</div><div class=pin id=pd>${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k=>k===''?'<span></span>':`<button data-k="${k}">${k}</button>`).join('')}</div><button class="b blk" id=ok disabled>Entrar</button></div>`;
   const dots=()=>{const n=Math.max(4,p.length);$('#dt').innerHTML=Array.from({length:n},(_,i)=>`<i class="${i<p.length?'on':''}"></i>`).join('');$('#ok').disabled=p.length<4};
   const enviar=async()=>{$('#ok').disabled=true;try{await api(A+'/login',{method:'POST',body:{id:a.id,pin:p}});iniciar()}catch(e){toast(e.message,1);p='';dots();const d=$('#dt');d.classList.add('err');setTimeout(()=>d.classList.remove('err'),500);try{navigator.vibrate?.(150)}catch{}}};
   $('#vt').onclick=quem;
   $('#pd').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;if(k==='⌫')p=p.slice(0,-1);else if(p.length<6)p+=k;dots();if(p.length===6)enviar()};
   $('#ok').onclick=enviar;
  };
  quem();
 }
 async function sair(){if(!confirm('Sair do acesso de atendente?'))return;poll?.stop();poll=null;try{await api(A+'/login',{method:'DELETE'})}catch{}E=null;login()}

 // ---------- telas ----------
 function topo(titulo,sub,voltar){return `<header class=gc-top>${voltar?`<button class=ic id=vt aria-label=Voltar>←</button>`:E?.loja?.logo?`<span class=gc-logo><img src="${esc(E.loja.logo)}" alt=""></span>`:''}<b>${esc(titulo)}<small>${esc(sub||'')}</small></b>${voltar?'':`<button class=ic id=atz aria-label=Atualizar>⟳</button><button class="b sm" id=out style="background:#ffffff14">Sair</button>`}</header>`}
 function desenhar(){
  if(tela.v==='cmd'&&C(tela.id))return comanda(tela.id);
  tela={v:'mesas'};
  const oc=E.comandas.filter(c=>c.tipo==='mesa').length,bal=E.comandas.filter(c=>c.tipo!=='mesa');
  $('#app').innerHTML=topo(E.loja?.nome||'Comanda',`${E.atendente.nome} · ${E.atendente.papel==='caixa'?'Caixa':'Garçom'}`)+`<main class=gc-main>
   <div class=seg id=abas style="justify-self:start"><button data-a=mesas class="${aba==='mesas'?'on':''}">🍽️ Mesas <small class=mu>${oc}/${E.mesas.length}</small></button><button data-a=balcao class="${aba==='balcao'?'on':''}">🛍️ Balcão <small class=mu>${bal.length}</small></button></div>
   ${aba==='mesas'?`<div class=leg><span><i style="background:var(--card);box-shadow:inset 0 0 0 1.5px var(--bd)"></i>Livre</span><span><i style="background:var(--lilac)"></i>Ocupada</span><span><i style="background:var(--lime)"></i>Item pronto</span></div>
    <div class=gc-mesas id=ms>${E.mesas.map(m=>{const c=cmdMesa(m.id),pr=c&&c.itens.some(i=>i.status==='pronto'),pd=pendMesa(m.id).length;
     return `<button class="ms ${c||pd?'oc':''} ${pr?'pr':''}" data-m="${esc(m.id)}">${pd?`<span class=bdg style="background:var(--wa);color:var(--ink)">⏳ ${pd}</span>`:pr?'<span class=bdg>PRONTO</span>':c&&c.mesa_codigo?`<span class=bdg title="Senha da mesa">📱 ${esc(c.mesa_codigo)}</span>`:''}<span class=n>${esc(m.numero)}</span><small>${c?esc(desde(c.aberta_em)):`${m.lugares} lugares`}</small>${c?`<span class="t num">${brl(totalAberto(c))}</span>`:''}</button>`}).join('')||'<div class=card style="grid-column:1/-1"><b>Nenhuma mesa cadastrada.</b><br><small class=mu>Peça ao gerente: Painel → <b>Mesas e equipe</b> → <b>Criar várias</b>. Com as mesas cadastradas aparece a senha da mesa para o cliente pedir pelo celular.</small></div>'}</div>`
   :`<button class="b blk" id=novaB>+ Nova comanda de balcão</button><div class=env>${bal.map(c=>`<button class=it data-c="${esc(c.id)}" style="border:0;text-align:left"><span class=q>🛍️</span><span class=nm><b>${esc(c.cliente_nome||'Balcão')}</b><small>${esc(desde(c.aberta_em))} · ${ativos(c).length} itens</small></span>${pill(c.situacao)}</button>`).join('')||'<p class=mu>Nenhuma comanda de balcão aberta.</p>'}</div>`}
  </main>`;
  $('#out').onclick=sair;$('#atz').onclick=()=>atualizar().then(()=>toast('Atualizado'));
  $('#abas').onclick=e=>{const b=e.target.closest('[data-a]');if(b){aba=b.dataset.a;desenhar()}};
  $('#ms')&&($('#ms').onclick=e=>{const b=e.target.closest('[data-m]');if(b)abrirMesa(b.dataset.m)});
  $('#novaB')&&($('#novaB').onclick=novaBalcao);
  $$('[data-c]').forEach(b=>b.onclick=()=>comanda(b.dataset.c));
 }
 // Mesa livre: o garçom abre a comanda (lançando itens ou já gerando a senha do cliente).
 function abrirMesa(mid){
  const c=cmdMesa(mid);if(c)return comanda(c.id);
  if(pendMesa(mid).length)return verFila();
  const m=E.mesas.find(x=>x.id===mid);
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Mesa ${esc(m.numero)} · livre</h3><button class=ic data-x>✕</button></div><div style="display:grid;gap:10px"><button class="b blk" id=it>🧾 Abrir comanda e lançar itens</button><button class="b lime blk" id=sn>📱 Abrir comanda e gerar senha</button><small class=mu>A senha (4 números) é para o cliente pedir pelo celular. Anote e entregue na mesa. Só você, que abriu a comanda, pode gerar — e uma nova só depois de fechar a mesa.</small></div>`);
  $('#it',s).onclick=()=>{s.close();itens({virtual:true,tipo:'mesa',mesa_id:mid,mesa_label:m.numero})};
  $('#sn',s).onclick=async()=>{try{const r=await acao({action:'abrir',tipo:'mesa',mesa_id:mid});s.close();comanda(r.comanda.id);gerarSenha(mid)}catch{}};
 }
 const codigoDe=mid=>(cmdMesa(mid)||{}).mesa_codigo||null;
 const fuiEu=c=>c&&c.aberta_por_id===E.atendente.id;
 async function gerarSenha(mid){
  try{const r=await api(A,{method:'POST',body:{action:'codigo_mesa',mesa_id:mid}});const c=cmdMesa(mid);if(c)c.mesa_codigo=r.codigo;if(tela.v==='cmd')comanda(tela.id);verSenha(mid)}catch(e){toast(e.message,1)}
 }
 // Mostra a senha grande para o garçom anotar no papel.
 function verSenha(mid){
  const m=E.mesas.find(x=>x.id===mid),cod=codigoDe(mid);
  sheet(`<div class=sh-hd><h3 style="margin:0">📱 Senha da Mesa ${esc(m.numero)}</h3><button class=ic data-x>✕</button></div>
   <p class=mu style="margin-top:0">Anote no papel e entregue ao cliente. Ele lê o QR Code da mesa, escolhe a <b>Mesa ${esc(m.numero)}</b> e digita:</p>
   <div style="font-size:60px;font-weight:850;letter-spacing:.2em;text-align:center;background:var(--lime);border-radius:22px;padding:16px 0;margin-bottom:12px" class=num>${esc(cod)}</div>
   <p class=mu style="font-size:13px;margin:0">Com ela o cliente vê o que já foi pedido e pode pedir direto — entra nesta comanda e vai para a cozinha ou o bar. A senha vale até a mesa ser fechada; depois, uma nova é gerada na próxima abertura.</p>
   <button class="b blk" data-x style="margin-top:14px">Anotei</button>`);
 }
 function novaBalcao(){
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Nova comanda de balcão</h3><button class=ic data-x>✕</button></div><label class=fld><span>Nome do cliente</span><input class=in id=nm maxlength=60 placeholder="Ex.: João"></label><button class="b blk" id=ok>Escolher itens</button>`);
  $('#nm',s).focus();
  $('#ok',s).onclick=()=>{const nome=$('#nm',s).value.trim();if(!nome){toast('Informe o nome do cliente.',1);return}s.close();itens({virtual:true,tipo:'balcao',cliente_nome:nome})};
 }
 function comanda(id){
  const c=C(id);if(!c){tela={v:'mesas'};return desenhar()}
  tela={v:'cmd',id};
  const envios={};c.itens.forEach(i=>{(envios[i.pedido_id]||={n:i.pedido_numero,t:i.criado_em,it:[]}).it.push(i)});
  const tit=c.tipo==='mesa'?'Mesa '+c.mesa_label:(c.cliente_nome||'Balcão');
  $('#app').innerHTML=topo(tit,`Aberta ${desde(c.aberta_em)} por ${c.aberta_por||''}`,true)+`<main class=gc-main>
   <section class=cmd-hd><div class=sh-hd style="margin:0"><h2 class=num>${brl(c.total_cents)}</h2>${pill(c.situacao)}</div>
    <small class=mu>${ativos(c).length} itens · subtotal ${brl(c.subtotal_cents)}</small>
    <div style="display:flex;gap:8px;flex-wrap:wrap">${c.tipo==='mesa'?`<button class="b light sm" id=trf>⇄ Transferir mesa</button>`:''}<button class="b light sm" id=cta>🧾 Ver conta</button></div></section>
   ${pendComanda(c.id).map(it=>`<div class=env><div class=env-h style="color:${it.estado==='incerto'?'var(--coral)':'#8a4b00'}">${it.estado==='incerto'?'⚠️ Enviado, porém sem confirmação — confira na cozinha/bar':'⏳ Aguardando internet — será enviado sozinho'}</div>${it.meta.itens.map(t=>`<div class=it style="grid-template-columns:1fr;opacity:.75"><span class=nm><b>${esc(t)}</b></span></div>`).join('')}</div>`).join('')}
   ${Object.values(envios).map(e=>`<div class=env><div class=env-h>Pedido #${e.n} · ${desde(e.t)}${e.it[0]?.origem==='mesa_cliente'?' · 📱 pedido pelo cliente':''}</div>${e.it.map(i=>`<div class="it ${i.status==='cancelado'?'cx':''}" data-i="${esc(i.id)}"><span class=q>${i.qtd}</span><span class=nm><b>${esc(i.nome)}</b>${i.obs?`<small>📝 ${esc(i.obs)}</small>`:`<small>${brl(i.preco_cents*i.qtd)}</small>`}</span>
    ${i.status==='pronto'?`<button class="b lime sm" data-ent="${esc(i.id)}">Entregar</button>`:i.status==='novo'?`<button class="pill st-novo" style="border:0" data-cx="${esc(i.id)}" title="Toque para cancelar">Novo ✕</button>`:pill(i.status)}</div>`).join('')}</div>`).join('')||'<div class=card style="text-align:center">Nenhum item ainda.<br><small class=mu>Toque em “Adicionar itens”.</small></div>'}
   ${c.tipo==='mesa'?`<section class=card style="display:grid;gap:10px;${c.mesa_codigo?'background:var(--lime);box-shadow:none':''}"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><b>📱 Senha da mesa para o cliente</b>${c.mesa_codigo?`<span class=num style="font-size:34px;font-weight:850;letter-spacing:.15em">${esc(c.mesa_codigo)}</span>`:''}</div>${c.mesa_codigo?`<small style="color:#3f5a00">Anote e entregue na mesa. Vale até fechar a conta.</small><button class="b sm" id=snh>Mostrar em tela cheia</button>`:fuiEu(c)?`<small class=mu>O cliente usa a senha no QR Code da mesa para ver a conta e pedir pelo celular.</small><button class="b lime blk" id=gsn>📱 Gerar senha</button>`:`<small class=mu>Só ${esc(c.aberta_por||'quem abriu a comanda')} pode gerar a senha desta mesa.</small>`}</section>`:''}
  </main><div class=act><button class="b" id=add>+ Adicionar itens</button>${E.pode_fechar?`<button class="b lilac" id=fch ${ativos(c).length?'':'disabled'}>Fechar conta</button>`:''}</div>`;
  $('#vt').onclick=()=>{tela={v:'mesas'};desenhar()};
  $('#add').onclick=()=>itens(c.id);
  $('#fch')&&($('#fch').onclick=()=>fechar(c.id));
  $('#cta').onclick=()=>conta(c);
  $('#trf')&&($('#trf').onclick=()=>transferir(c));
  $('#snh')&&($('#snh').onclick=()=>verSenha(c.mesa_id));
  $('#gsn')&&($('#gsn').onclick=()=>gerarSenha(c.mesa_id));
  $('.gc-main').onclick=async e=>{
   const en=e.target.closest('[data-ent]'),cx=e.target.closest('[data-cx]');
   if(en){await acao({action:'item_status',comanda_id:c.id,item_id:en.dataset.ent,status:'entregue'});comanda(c.id)}
   if(cx){const it=c.itens.find(i=>i.id===cx.dataset.cx);if(confirm(`Cancelar ${it.qtd}× ${it.nome}?`)){await acao({action:'item_status',comanda_id:c.id,item_id:it.id,status:'cancelado'});comanda(c.id)}}
  };
 }
 async function acao(body){try{const r=await api(A,{method:'POST',body});const i=E.comandas.findIndex(x=>x.id===r.comanda?.id);if(r.comanda){if(i>=0)E.comandas[i]=r.comanda;else E.comandas.unshift(r.comanda)}return r}catch(e){toast(e.message,1);throw e}}
 function conta(c){
  const ag={};ativos(c).forEach(i=>{const k=i.nome+'|'+i.preco_cents;(ag[k]||={n:i.nome,p:i.preco_cents,q:0}).q+=i.qtd});
  sheet(`<div class=sh-hd><h3 style="margin:0">Conta · ${esc(c.tipo==='mesa'?'Mesa '+c.mesa_label:c.cliente_nome||'Balcão')}</h3><button class=ic data-x>✕</button></div><div class=card style="box-shadow:none;display:grid;gap:6px">${Object.values(ag).map(x=>`<div style="display:flex;justify-content:space-between;gap:8px"><span>${x.q}× ${esc(x.n)}</span><b class=num>${brl(x.q*x.p)}</b></div>`).join('')}<div class=tot style="margin-top:8px"><div class=g><span>Subtotal</span><span>${brl(c.subtotal_cents)}</span></div>${E.servico_pct?`<div><span>Serviço sugerido (${E.servico_pct}%)</span><b>${brl(Math.round(c.subtotal_cents*E.servico_pct/100))}</b></div>`:''}</div></div>`);
 }
 function transferir(c){
  const livres=E.mesas.filter(m=>!cmdMesa(m.id));
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Transferir Mesa ${esc(c.mesa_label)} para…</h3><button class=ic data-x>✕</button></div><div class=gc-mesas>${livres.map(m=>`<button class=ms data-m="${esc(m.id)}"><span class=n>${esc(m.numero)}</span><small>livre</small></button>`).join('')||'<p class=mu>Nenhuma mesa livre.</p>'}</div>`);
  s.onclick=async e=>{const b=e.target.closest('[data-m]');if(!b)return;await acao({action:'transferir',comanda_id:c.id,mesa_id:b.dataset.m});s.close();toast('Mesa transferida');comanda(c.id)};
 }
 // ---------- adicionar itens ----------
 function itens(alvo){
  const c=typeof alvo==='string'?C(alvo):alvo,cid=c.id;tela={v:'itens',id:cid};
  let cat='',q='',sel={};
  const P=id=>E.produtos.find(p=>p.id===id),cn=id=>(E.categorias.find(k=>k.id===id)||{}).nome||'';
  const n=()=>Object.values(sel).reduce((s,x)=>s+x.q,0),tot=()=>Object.entries(sel).reduce((s,[id,x])=>s+P(id).preco_cents*x.q,0);
  $('#app').innerHTML=topo(c.tipo==='mesa'?'Mesa '+c.mesa_label:(c.cliente_nome||'Balcão'),'Adicionar itens',true)+`<main class=gc-main>
   <input class=in id=q placeholder="🔎 Buscar item" autocomplete=off>
   <div class=chips id=cts><button class="chip on" data-c="">Tudo</button>${E.categorias.map(k=>`<button class=chip data-c="${esc(k.id)}">${esc(k.icone||'')} ${esc(k.nome)}</button>`).join('')}</div>
   <div class=pk-l id=pl></div></main><div class=act><button class="b ghost" id=cn style="flex:0 0 auto">Cancelar</button><button class=b id=env disabled>Enviar</button></div>`;
  const lista=()=>{const t=q.trim().toLowerCase(),ps=E.produtos.filter(p=>(!cat||p.categoria_id===cat)&&(!t||p.nome.toLowerCase().includes(t)));
   $('#pl').innerHTML=ps.map(p=>{const x=sel[p.id];if(p.indisponivel)return `<div class="pk off" data-p="${esc(p.id)}" data-off=1><span class=ph>${p.foto?`<img src="${esc(p.foto)}" alt="" loading=lazy>`:emoji(cn(p.categoria_id)+' '+p.nome)}</span><span><b>${esc(p.nome)}</b><small>${brl(p.preco_cents)}</small></span><span class=tag-ind>Indisponível</span></div>`;return `<div class="pk ${x?'sel':''}" data-p="${esc(p.id)}"><span class=ph>${p.foto?`<img src="${esc(p.foto)}" alt="" loading=lazy>`:emoji(cn(p.categoria_id)+' '+p.nome)}</span><span><b>${esc(p.nome)}</b><small>${brl(p.preco_cents)}</small>${x?`<br><button class=ob data-a=ob>${x.obs?'📝 '+esc(x.obs):'+ observação'}</button>`:''}</span>${x?`<span class=stp><button class=m data-a=menos>−</button><b>${x.q}</b><button data-a=mais>+</button></span>`:`<button class=add data-a=mais aria-label=Adicionar>+</button>`}</div>`}).join('')||'<p class=mu>Nada encontrado.</p>';
   const k=n();$('#env').disabled=!k;$('#env').innerHTML=k?`Enviar ${k} ${k>1?'itens':'item'} · ${brl(tot())}`:'Enviar'};
  lista();
  $('#vt').onclick=$('#cn').onclick=()=>{if(n()&&!confirm('Descartar os itens escolhidos?'))return;if(c.virtual){tela={v:'mesas'};desenhar()}else comanda(cid)};
  $('#q').oninput=e=>{q=e.target.value;lista()};
  $('#cts').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cat=b.dataset.c;$$('#cts .chip').forEach(x=>x.classList.toggle('on',x===b));lista()};
  $('#pl').onclick=e=>{const b=e.target.closest('[data-a]'),r=e.target.closest('[data-p]');if(!r)return;const id=r.dataset.p;
   if(r.dataset.off){toast('Item indisponível no momento.');return}
   if(!b){sel[id]=sel[id]||{q:0,obs:''};sel[id].q++;lista();return}
   if(b.dataset.a==='ob'){const s=sheet(`<div class=sh-hd><h3 style="margin:0">Observação · ${esc(P(id).nome)}</h3><button class=ic data-x>✕</button></div><div class=chips id=sug style="flex-wrap:wrap;margin-bottom:10px">${['Sem cebola','Sem gelo','Bem passado','Ao ponto','Mal passado','Sem salada','Com gelo e limão','Para viagem'].map(x=>`<button class=chip>${x}</button>`).join('')}</div><textarea class=in id=ot maxlength=140>${esc(sel[id].obs)}</textarea><button class="b blk" id=ok style="margin-top:12px">Salvar</button>`);
    $('#sug',s).onclick=e=>{const c=e.target.closest('.chip');if(c){const t=$('#ot',s);t.value=(t.value?t.value+', ':'')+c.textContent}};
    $('#ok',s).onclick=()=>{sel[id].obs=$('#ot',s).value.trim().slice(0,140);s.close();lista()};return}
   const x=sel[id]||={q:0,obs:''};x.q+=b.dataset.a==='mais'?1:-1;if(x.q<=0)delete sel[id];lista()};
  $('#env').onclick=async e=>{const bt=e.target;bt.disabled=true;
   const itensEnv=Object.entries(sel).map(([produto_id,x])=>({produto_id,qtd:x.q,obs:x.obs,nome:P(produto_id).nome}));
   const body={action:'lancar',itens:itensEnv.map(({nome,...i})=>i),...(c.virtual?{abrir:{tipo:c.tipo,mesa_id:c.mesa_id,cliente_nome:c.cliente_nome}}:{comanda_id:cid})};
   enviarPedido(body,{rotulo:c.tipo==='mesa'?'Mesa '+c.mesa_label:(c.cliente_nome||'Balcão'),mesa_id:c.mesa_id||null,comanda_id:c.virtual?null:cid,itens:itensEnv.map(i=>i.qtd+'× '+i.nome)},id=>{if(id)comanda(id);else{tela={v:'mesas'};desenhar()}}).then(r=>{if(r===false)bt.disabled=false});
  };
 }
 // ---------- fechar conta ----------
 function fechar(cid){
  const c=C(cid),caixa=E.atendente.papel==='caixa';
  let pag=E.pagamentos[0],serv=E.servico_pct>0&&c.tipo==='mesa',desc=0;
  const sv=()=>serv?Math.round(c.subtotal_cents*E.servico_pct/100):0,total=()=>Math.max(0,c.subtotal_cents+c.taxa_cents+sv()-desc);
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Fechar conta</h3><button class=ic data-x>✕</button></div>
   <div class=card style="box-shadow:none;margin-bottom:12px"><div class=tot><div><span>Subtotal</span><b>${brl(c.subtotal_cents)}</b></div>${E.servico_pct?`<div><label style="display:flex;gap:8px;align-items:center"><input type=checkbox id=sv ${serv?'checked':''}> Serviço (${E.servico_pct}%)</label><b id=svv>${brl(sv())}</b></div>`:''}${caixa?`<div><span>Desconto (R$)</span><input class=in id=ds inputmode=decimal style="width:110px;padding:6px 10px;text-align:right" placeholder="0,00"></div>`:''}<div class=g><span>Total</span><span id=tt>${brl(total())}</span></div></div></div>
   <div class=fld><span>Forma de pagamento</span><div class=pay id=pg>${E.pagamentos.map(p=>`<button type=button data-p=${p} class="${p===pag?'on':''}">${PAG[p]}</button>`).join('')}</div></div>
   <button class="b blk" id=ok>Confirmar recebimento</button>`);
  const up=()=>{$('#tt',s).textContent=brl(total());$('#svv',s)&&($('#svv',s).textContent=brl(sv()))};
  $('#sv',s)&&($('#sv',s).onchange=e=>{serv=e.target.checked;up()});
  $('#ds',s)&&($('#ds',s).oninput=e=>{desc=Math.round((parseFloat(e.target.value.replace(',','.'))||0)*100);up()});
  $('#pg',s).onclick=e=>{const b=e.target.closest('[data-p]');if(!b)return;pag=b.dataset.p;$$('#pg button',s).forEach(x=>x.classList.toggle('on',x===b))};
  $('#ok',s).onclick=async e=>{e.target.disabled=true;try{await acao({action:'fechar',comanda_id:cid,pagamento:pag,servico_cents:sv(),desconto_cents:desc});s.close();toast('Conta fechada · '+brl(total()));E.comandas=E.comandas.filter(x=>x.id!==cid);tela={v:'mesas'};desenhar()}catch{e.target.disabled=false}};
 }
 // ================= Envio com internet fraca =================
 // Cada envio ganha um código único (envio_id). Se a internet falhar, o pedido fica guardado no celular e é reenviado
 // sozinho; o servidor reconhece o código e NUNCA duplica na cozinha. Situações: enviando → ✅ recebido | ⏳ aguardando internet | ⚠️ não confirmado.
 const FK='cm_fila_'+S;
 let fila=[];try{fila=JSON.parse(localStorage.getItem(FK)||'[]')||[]}catch{}
 const salvarFila=()=>{try{localStorage.setItem(FK,JSON.stringify(fila))}catch{}};
 const novoId=()=>(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,12));
 let rede='ok'; // ok | fraca | off
 function setRede(v){if(v===rede)return;rede=v;faixaRede()}
 function faixaRede(){
  let f=document.getElementById('gcRede');
  const pend=fila.length;
  if(rede==='ok'&&!pend){f?.remove();return}
  if(!f){f=document.createElement('div');f.id='gcRede';document.body.prepend(f)}
  f.className='gc-rede '+(rede==='ok'?'pend':rede);
  f.innerHTML=rede==='off'?`📵 <b>Sem internet.</b> ${pend?`${pend} pedido(s) guardado(s) no celular — vão sozinhos quando a conexão voltar.`:'Os pedidos ficam guardados e saem quando a conexão voltar.'} <span>Se for urgente, confira na cozinha/bar.</span>`
   :rede==='fraca'?`🟠 <b>Internet fraca.</b> ${pend?`${pend} pedido(s) aguardando confirmação.`:'Os envios podem demorar.'} <span>Confira na cozinha/bar se for urgente.</span>`
   :`⏳ ${pend} pedido(s) aguardando confirmação…`;
  f.onclick=verFila;
 }
 addEventListener('offline',()=>setRede('off'));
 addEventListener('online',()=>{setRede('fraca');processarFila()});
 // Envia agora; se não der, guarda na fila. pronto(comanda_id) é chamado quando o servidor confirma (ou null se ficou na fila).
 async function enviarPedido(body,meta,pronto){
  const it={envio_id:novoId(),criado:Date.now(),body:{...body},meta,estado:'enviando',tentativas:0};
  it.body.envio_id=it.envio_id;fila.push(it);salvarFila();
  const ok=await tentar(it,true);
  if(ok)pronto&&pronto(ok.comanda_id);
  else if(ok===false){return false}
  else{toast(it.estado==='incerto'?'⚠️ Pedido enviado, porém sem confirmação. Confira na cozinha/bar.':'⏳ Sem internet: pedido guardado no celular. Ele será enviado sozinho.',1);try{navigator.vibrate?.([120,80,120])}catch{};pronto&&pronto(it.meta.comanda_id)}
 }
 // Devolve {comanda_id} se confirmou, false se o servidor recusou (erro real), undefined se ficou pendente.
 async function tentar(it,primeira){
  it.tentativas++;const t0=Date.now();
  try{
   const r=await api(A,{method:'POST',body:it.body,timeout:10000});
   setRede(Date.now()-t0>4000?'fraca':'ok');
   fila=fila.filter(x=>x.envio_id!==it.envio_id);salvarFila();faixaRede();
   if(r.comanda){const i=E.comandas.findIndex(x=>x.id===r.comanda.id);if(i>=0)E.comandas[i]=r.comanda;else E.comandas.unshift(r.comanda)}
   if(primeira){toast(`✅ Pedido #${r.numero} recebido pela produção`);beep(1)}
   else{toast(`✅ ${it.meta.rotulo}: pedido #${r.numero} chegou na produção (enviado depois)`);beep(2)}
   return {comanda_id:r.comanda?.id||r.comanda_id};
  }catch(e){
   if(!e.rede){fila=fila.filter(x=>x.envio_id!==it.envio_id);salvarFila();faixaRede();toast(e.message,1);if(e.status===401){poll?.stop();poll=null;login()}return false}
   setRede(navigator.onLine===false||!e.semResposta?'off':'fraca');
   it.estado=e.semResposta?'incerto':'aguardando';salvarFila();faixaRede();
   return undefined;
  }
 }
 let processando=false,avisado2min=new Set();
 async function processarFila(){
  if(processando||!fila.length||!E)return;processando=true;
  try{for(const it of [...fila]){if(it.estado==='enviando'&&Date.now()-it.criado<15000)continue;const r=await tentar(it,false);if(r===undefined)break}}
  finally{processando=false}
  // Mais de 2 minutos sem confirmação: vibra e avisa em destaque (uma vez por pedido).
  for(const it of fila)if(Date.now()-it.criado>120000&&!avisado2min.has(it.envio_id)){avisado2min.add(it.envio_id);try{navigator.vibrate?.([300,150,300,150,300])}catch{}beep(3);toast(`⚠️ ${it.meta.rotulo}: pedido sem confirmação há mais de 2 min. Confira na cozinha/bar!`,1)}
  faixaRede();if(tela.v!=='itens'&&!document.querySelector('.sh-bg'))desenhar();
 }
 setInterval(processarFila,6000);
 function verFila(){
  if(!fila.length){toast('Nenhum pedido pendente.');return}
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Pedidos pendentes</h3><button class=ic data-x>✕</button></div>
   <p class=mu style="margin-top:0">Ficam guardados neste celular e são reenviados sozinhos. O sistema não duplica o pedido na cozinha.</p>
   <div class=env>${fila.map(it=>`<div class=it style="grid-template-columns:auto 1fr"><span class=q>${it.estado==='incerto'?'⚠️':'⏳'}</span><span class=nm><b>${esc(it.meta.rotulo)}</b><small>${esc(it.meta.itens.join(', '))}</small><small style="color:${it.estado==='incerto'?'var(--coral)':'var(--mu)'};font-weight:600">${it.estado==='incerto'?'Enviado, porém sem confirmação — confira na cozinha/bar.':'Aguardando internet para enviar.'} · ${desde(it.criado)}</small></span></div>`).join('')}</div>
   <button class="b blk" id=tn style="margin-top:12px">Tentar enviar agora</button>`);
  $('#tn',s).onclick=async()=>{fila.forEach(i=>i.estado=i.estado==='enviando'?'aguardando':i.estado);await processarFila();s.close();if(fila.length)verFila()};
 }
 const pendMesa=mid=>fila.filter(i=>i.meta.mesa_id===mid);
 const pendComanda=cid=>fila.filter(i=>i.meta.comanda_id===cid);
 document.addEventListener('click',()=>{try{beep(0)}catch{}},{once:true}); // libera o som no 1º toque
 iniciar();
})();
