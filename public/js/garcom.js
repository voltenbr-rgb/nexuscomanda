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
 }
 async function atualizar(){
  if(!E)return;
  let n;try{n=await api(A+'?parcial=1')}catch(e){if(e.status===401){poll?.stop();poll=null;login()}return}
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
   const enviar=async()=>{$('#ok').disabled=true;try{await api(A+'/login',{method:'POST',body:{id:a.id,pin:p}});iniciar()}catch(e){toast(e.message,1);p='';dots();try{navigator.vibrate?.(150)}catch{}}};
   $('#vt').onclick=quem;
   $('#pd').onclick=e=>{const b=e.target.closest('[data-k]');if(!b)return;const k=b.dataset.k;if(k==='⌫')p=p.slice(0,-1);else if(p.length<6)p+=k;dots();if(p.length===6)enviar()};
   $('#ok').onclick=enviar;
  };
  quem();
 }
 async function sair(){if(!confirm('Sair do acesso de atendente?'))return;poll?.stop();poll=null;try{await api(A+'/login',{method:'DELETE'})}catch{}E=null;login()}

 // ---------- telas ----------
 function topo(titulo,sub,voltar){return `<header class=gc-top>${voltar?`<button class=ic id=vt aria-label=Voltar>←</button>`:''}<b>${esc(titulo)}<small>${esc(sub||'')}</small></b>${voltar?'':`<button class=ic id=atz aria-label=Atualizar>⟳</button><button class="b sm" id=out style="background:#ffffff14">Sair</button>`}</header>`}
 function desenhar(){
  if(tela.v==='cmd'&&C(tela.id))return comanda(tela.id);
  tela={v:'mesas'};
  const oc=E.comandas.filter(c=>c.tipo==='mesa').length,bal=E.comandas.filter(c=>c.tipo!=='mesa');
  $('#app').innerHTML=topo(E.loja?.nome||'Comanda',`${E.atendente.nome} · ${E.atendente.papel==='caixa'?'Caixa':'Garçom'}`)+`<main class=gc-main>
   <div class=seg id=abas style="justify-self:start"><button data-a=mesas class="${aba==='mesas'?'on':''}">🍽️ Mesas <small class=mu>${oc}/${E.mesas.length}</small></button><button data-a=balcao class="${aba==='balcao'?'on':''}">🛍️ Balcão <small class=mu>${bal.length}</small></button></div>
   ${aba==='mesas'?`<div class=leg><span><i style="background:var(--card);box-shadow:inset 0 0 0 1.5px var(--bd)"></i>Livre</span><span><i style="background:var(--lilac)"></i>Ocupada</span><span><i style="background:var(--lime)"></i>Item pronto</span></div>
    <div class=gc-mesas id=ms>${E.mesas.map(m=>{const c=cmdMesa(m.id),pr=c&&c.itens.some(i=>i.status==='pronto');
     return `<button class="ms ${c?'oc':''} ${pr?'pr':''}" data-m="${esc(m.id)}">${pr?'<span class=bdg>PRONTO</span>':m.codigo&&E.mesa_auto?'<span class=bdg title="Cliente pode pedir pelo celular">📱</span>':''}<span class=n>${esc(m.numero)}</span><small>${c?esc(desde(c.aberta_em)):`${m.lugares} lugares`}</small>${c?`<span class="t num">${brl(totalAberto(c))}</span>`:''}</button>`}).join('')||'<div class=card>Nenhuma mesa cadastrada.</div>'}</div>`
   :`<button class="b blk" id=novaB>+ Nova comanda de balcão</button><div class=env>${bal.map(c=>`<button class=it data-c="${esc(c.id)}" style="border:0;text-align:left"><span class=q>🛍️</span><span class=nm><b>${esc(c.cliente_nome||'Balcão')}</b><small>${esc(desde(c.aberta_em))} · ${ativos(c).length} itens</small></span>${pill(c.situacao)}</button>`).join('')||'<p class=mu>Nenhuma comanda de balcão aberta.</p>'}</div>`}
  </main>`;
  $('#out').onclick=sair;$('#atz').onclick=()=>atualizar().then(()=>toast('Atualizado'));
  $('#abas').onclick=e=>{const b=e.target.closest('[data-a]');if(b){aba=b.dataset.a;desenhar()}};
  $('#ms')&&($('#ms').onclick=e=>{const b=e.target.closest('[data-m]');if(b)abrirMesa(b.dataset.m)});
  $('#novaB')&&($('#novaB').onclick=novaBalcao);
  $$('[data-c]').forEach(b=>b.onclick=()=>comanda(b.dataset.c));
 }
 // Mesa livre: a comanda só é criada quando o primeiro pedido é enviado (se o garçom desistir, a mesa continua livre).
 function abrirMesa(mid){
  const c=cmdMesa(mid);if(c)return comanda(c.id);
  const m=E.mesas.find(x=>x.id===mid);
  if(!E.mesa_auto)return itens({virtual:true,tipo:'mesa',mesa_id:mid,mesa_label:m.numero});
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">Mesa ${esc(m.numero)}</h3><button class=ic data-x>✕</button></div><div style="display:grid;gap:10px"><button class="b blk" id=it>🧾 Lançar itens</button><button class="b lilac blk" id=sn>📱 ${m.codigo?'Ver senha da mesa':'Liberar para o cliente pedir pelo celular'}</button></div>`);
  $('#it',s).onclick=()=>{s.close();itens({virtual:true,tipo:'mesa',mesa_id:mid,mesa_label:m.numero})};
  $('#sn',s).onclick=()=>{s.close();senhaMesa(mid)};
 }
 // Senha da mesa: o cliente usa no link /mesa/<loja> para pedir pelo celular. Some quando a conta fecha.
 function senhaMesa(mid){
  const m=E.mesas.find(x=>x.id===mid);
  const salvar=async body=>{try{const r=await api(A,{method:'POST',body:{action:'codigo_mesa',mesa_id:mid,...body}});m.codigo=r.codigo;return true}catch(e){toast(e.message,1);return false}};
  const s=sheet(`<div class=sh-hd><h3 style="margin:0">📱 Pedido pelo celular · Mesa ${esc(m.numero)}</h3><button class=ic data-x>✕</button></div><div id=sc></div>`);
  const draw=()=>{$('#sc',s).innerHTML=m.codigo?`<p class=mu style="margin-top:0">Passe esta senha ao cliente. Ele abre o link da mesa (QR Code), escolhe a <b>Mesa ${esc(m.numero)}</b> e digita:</p>
    <div style="font-size:54px;font-weight:850;letter-spacing:.18em;text-align:center;background:var(--lime);border-radius:22px;padding:14px 0;margin-bottom:12px" class=num>${esc(m.codigo)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="b light" id=nv>🔄 Gerar outra</button><button class="b light" id=df>✏️ Escolher senha</button></div>
    <button class="b ghost blk" id=ds style="margin-top:8px;color:var(--coral)">Bloquear pedidos pelo celular</button><p class=mu style="font-size:12.5px">A senha deixa de valer sozinha quando a conta da mesa é fechada.</p>`
   :`<p class=mu style="margin-top:0">A mesa ainda não está liberada. Crie uma senha fácil para o cliente pedir pelo celular.</p><button class="b blk" id=nv>Gerar senha automática</button><button class="b light blk" id=df style="margin-top:8px">✏️ Escolher a senha</button>`;
   $('#nv',s).onclick=async()=>{if(await salvar({}))draw()};
   $('#df',s).onclick=async()=>{const v=prompt('Senha da mesa (3 a 6 números):','');if(v===null)return;if(await salvar({codigo:v.replace(/\D/g,'')}))draw()};
   $('#ds',s)&&($('#ds',s).onclick=async()=>{if(await salvar({desativar:true})){toast('Pedidos pelo celular bloqueados nesta mesa');draw()}});
  };
  draw();
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
    <div style="display:flex;gap:8px;flex-wrap:wrap">${c.tipo==='mesa'&&E.mesa_auto?`<button class="b light sm" id=snh>📱 Senha da mesa${(E.mesas.find(m=>m.id===c.mesa_id)||{}).codigo?' ✓':''}</button>`:''}${c.tipo==='mesa'?`<button class="b light sm" id=trf>⇄ Transferir mesa</button>`:''}<button class="b light sm" id=cta>🧾 Ver conta</button></div></section>
   ${Object.values(envios).map(e=>`<div class=env><div class=env-h>Pedido #${e.n} · ${desde(e.t)}${e.it[0]?.origem==='mesa_cliente'?' · 📱 pedido pelo cliente':''}</div>${e.it.map(i=>`<div class="it ${i.status==='cancelado'?'cx':''}" data-i="${esc(i.id)}"><span class=q>${i.qtd}</span><span class=nm><b>${esc(i.nome)}</b>${i.obs?`<small>📝 ${esc(i.obs)}</small>`:`<small>${brl(i.preco_cents*i.qtd)}</small>`}</span>
    ${i.status==='pronto'?`<button class="b lime sm" data-ent="${esc(i.id)}">Entregar</button>`:i.status==='novo'?`<button class="pill st-novo" style="border:0" data-cx="${esc(i.id)}" title="Toque para cancelar">Novo ✕</button>`:pill(i.status)}</div>`).join('')}</div>`).join('')||'<div class=card style="text-align:center">Nenhum item ainda.<br><small class=mu>Toque em “Adicionar itens”.</small></div>'}
  </main><div class=act><button class="b" id=add>+ Adicionar itens</button>${E.pode_fechar?`<button class="b lilac" id=fch ${ativos(c).length?'':'disabled'}>Fechar conta</button>`:''}</div>`;
  $('#vt').onclick=()=>{tela={v:'mesas'};desenhar()};
  $('#add').onclick=()=>itens(c.id);
  $('#fch')&&($('#fch').onclick=()=>fechar(c.id));
  $('#cta').onclick=()=>conta(c);
  $('#trf')&&($('#trf').onclick=()=>transferir(c));
  $('#snh')&&($('#snh').onclick=()=>senhaMesa(c.mesa_id));
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
   $('#pl').innerHTML=ps.map(p=>{const x=sel[p.id];return `<div class="pk ${x?'sel':''}" data-p="${esc(p.id)}"><span class=ph>${p.foto?`<img src="${esc(p.foto)}" alt="" loading=lazy>`:emoji(cn(p.categoria_id)+' '+p.nome)}</span><span><b>${esc(p.nome)}</b><small>${brl(p.preco_cents)}</small>${x?`<br><button class=ob data-a=ob>${x.obs?'📝 '+esc(x.obs):'+ observação'}</button>`:''}</span>${x?`<span class=stp><button class=m data-a=menos>−</button><b>${x.q}</b><button data-a=mais>+</button></span>`:`<button class=add data-a=mais aria-label=Adicionar>+</button>`}</div>`}).join('')||'<p class=mu>Nada encontrado.</p>';
   const k=n();$('#env').disabled=!k;$('#env').innerHTML=k?`Enviar ${k} ${k>1?'itens':'item'} · ${brl(tot())}`:'Enviar'};
  lista();
  $('#vt').onclick=$('#cn').onclick=()=>{if(n()&&!confirm('Descartar os itens escolhidos?'))return;if(c.virtual){tela={v:'mesas'};desenhar()}else comanda(cid)};
  $('#q').oninput=e=>{q=e.target.value;lista()};
  $('#cts').onclick=e=>{const b=e.target.closest('[data-c]');if(!b)return;cat=b.dataset.c;$$('#cts .chip').forEach(x=>x.classList.toggle('on',x===b));lista()};
  $('#pl').onclick=e=>{const b=e.target.closest('[data-a]'),r=e.target.closest('[data-p]');if(!r)return;const id=r.dataset.p;
   if(!b){sel[id]=sel[id]||{q:0,obs:''};sel[id].q++;lista();return}
   if(b.dataset.a==='ob'){const s=sheet(`<div class=sh-hd><h3 style="margin:0">Observação · ${esc(P(id).nome)}</h3><button class=ic data-x>✕</button></div><div class=chips id=sug style="flex-wrap:wrap;margin-bottom:10px">${['Sem cebola','Sem gelo','Bem passado','Ao ponto','Mal passado','Sem salada','Com gelo e limão','Para viagem'].map(x=>`<button class=chip>${x}</button>`).join('')}</div><textarea class=in id=ot maxlength=140>${esc(sel[id].obs)}</textarea><button class="b blk" id=ok style="margin-top:12px">Salvar</button>`);
    $('#sug',s).onclick=e=>{const c=e.target.closest('.chip');if(c){const t=$('#ot',s);t.value=(t.value?t.value+', ':'')+c.textContent}};
    $('#ok',s).onclick=()=>{sel[id].obs=$('#ot',s).value.trim().slice(0,140);s.close();lista()};return}
   const x=sel[id]||={q:0,obs:''};x.q+=b.dataset.a==='mais'?1:-1;if(x.q<=0)delete sel[id];lista()};
  $('#env').onclick=async e=>{e.target.disabled=true;try{let id=cid;if(c.virtual){const a=await acao({action:'abrir',tipo:c.tipo,mesa_id:c.mesa_id,cliente_nome:c.cliente_nome});id=a.comanda.id;c.virtual=false;c.id=id}const r=await acao({action:'lancar',comanda_id:id,itens:Object.entries(sel).map(([produto_id,x])=>({produto_id,qtd:x.q,obs:x.obs}))});toast(`Pedido #${r.numero} enviado para a produção`);beep(1);comanda(id)}catch{e.target.disabled=false}};
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
 document.addEventListener('click',()=>{try{beep(0)}catch{}},{once:true}); // libera o som no 1º toque
 iniciar();
})();
