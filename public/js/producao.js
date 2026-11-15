// Nexus Comanda — tela de produção (/producao/<loja>/<cozinha|bar>?t=TOKEN). Feita para TV/tablet: escura, letras grandes.
// Mostra só os itens do setor, agrupados por pedido. Atualiza a cada 3 s, bipa a cada pedido novo e pode imprimir em impressora térmica.
(()=>{
 const {$,esc,api,toast,beep,loop,imprimir}=CM;
 const partes=location.pathname.split('/').filter(Boolean),S=decodeURIComponent(partes[1]||''),SETOR=partes[2]||'cozinha';
 const TK=new URLSearchParams(location.search).get('t')||'';
 const A=`/api/producao/${encodeURIComponent(S)}/${SETOR}`;
 const PREF='cm_prod_'+S+'_'+SETOR;
 let D=null,marca=0,vistos=null,som=true,autoImp=null,offline=false,impressos=new Set();
 try{const p=JSON.parse(localStorage.getItem(PREF)||'{}');som=p.som!==false;autoImp=p.imp??null;impressos=new Set(p.impressos||[])}catch{}
 const guardar=()=>{try{localStorage.setItem(PREF,JSON.stringify({som,imp:autoImp,impressos:[...impressos].slice(-200)}))}catch{}};
 const mmss=ms=>{const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60);return m>=60?`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
 let difRelogio=0;
 const agora=()=>Date.now()+difRelogio;
 const estado=p=>p.itens.every(i=>i.status==='pronto')?'pronto':p.itens.some(i=>i.status!=='novo')?'preparo':'novo';
 const origem=p=>p.tipo==='mesa'?`Mesa ${p.mesa||''}`:p.tipo==='delivery'?`🛵 Delivery${p.cliente?' · '+p.cliente:''}`:p.tipo==='retirada'?`🛍️ Retirada${p.cliente?' · '+p.cliente:''}`:`Balcão${p.cliente?' · '+p.cliente:''}`;

 function inicio(){
  // O navegador só toca som depois de um toque na tela; por isso a tela começa com um botão.
  $('#app').innerHTML=`<div class=pd-start><div><span style="font-size:60px">${SETOR==='bar'?'🍹':'🍳'}</span><h1 style="margin:0">Tela ${SETOR==='bar'?'do Bar':'da Cozinha'}</h1><p class=mu style="margin:0">Deixe esta tela aberta. Os pedidos chegam sozinhos, com aviso sonoro.</p><button class="b lime" id=go style="padding:16px">▶ Iniciar tela</button><small class=mu>Dica: use o modo tela cheia (botão ⛶) e mantenha o aparelho na tomada.</small></div></div>`;
  $('#go').onclick=()=>{beep(1);try{navigator.wakeLock?.request('screen')}catch{}loop(buscar,3000);setInterval(relogios,1000)};
 }
 async function buscar(){
  let r;
  try{r=await api(`${A}?t=${encodeURIComponent(TK)}${D?`&since=${marca}`:''}`);offline=false}
  catch(e){if(e.status===403||e.status===404){$('#app').innerHTML=`<div class=pd-start><div><h1>Link inválido</h1><p class=mu>${esc(e.message)}</p></div></div>`;throw e}offline=true;faixa();return}
  difRelogio=r.agora-Date.now();
  if(r.igual){faixa();return}
  marca=r.marca;D=r;if(autoImp===null)autoImp=!!r.impressao_auto;
  const ids=new Set(r.pedidos.map(p=>p.id));
  if(vistos){const novos=r.pedidos.filter(p=>!vistos.has(p.id));if(novos.length){if(som)beep(3);if(autoImp)novos.forEach(p=>{if(!impressos.has(p.id))imprimirPedido(p)})}}
  vistos=new Set([...(vistos||[]),...ids]);
  if(!vistos.size)vistos=new Set();
  desenhar();
 }
 function faixa(){const f=$('#off');if(f)f.classList.toggle('hide',!offline)}
 function desenhar(){
  const ps=D.pedidos,cnt=s=>ps.filter(p=>estado(p)===s).length;
  const ativos=ps.filter(p=>estado(p)!=='pronto'),prontos=ps.filter(p=>estado(p)==='pronto');
  $('#app').innerHTML=`<div id=off class="pd-off hide">Sem conexão — tentando novamente…</div><header class=pd-top><h1><i>${SETOR==='bar'?'🍹':'🍳'}</i>${esc(D.setor_nome)}</h1><span class=lj>${esc(D.loja)}</span><span class=sp></span>
   <div class=pd-cnt><span>Novos<b>${cnt('novo')}</b></span><span>Preparando<b>${cnt('preparo')}</b></span><span>Prontos<b>${cnt('pronto')}</b></span></div>
   <span class=clk id=clk></span><button class="ic ${som?'on':''}" id=som title="Som">${som?'🔔':'🔕'}</button><button class="ic ${autoImp?'on':''}" id=imp title="Imprimir pedidos novos automaticamente">🖨️</button><button class=ic id=fs title="Tela cheia">⛶</button></header>
   <main class=pd-grid id=g>${ativos.map(tk).join('')}${prontos.map(tk).join('')}${!ps.length?`<div class=pd-empty><i>✨</i>Nenhum pedido no momento.</div>`:''}</main>`;
  faixa();relogios();
  $('#som').onclick=()=>{som=!som;guardar();if(som)beep(1);desenhar()};
  $('#imp').onclick=()=>{autoImp=!autoImp;guardar();toast(autoImp?'Impressão automática ligada':'Impressão automática desligada');desenhar()};
  $('#fs').onclick=()=>{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()};
  $('#g').onclick=clique;
 }
 function tk(p){
  const e=estado(p);
  return `<article class="tk ${e}" data-p="${esc(p.id)}" data-t="${p.criado_em}"><div class=tk-h><span class=n>#${p.numero}</span><span class=w><b>${esc(origem(p))}</b><small>${esc(p.atendente||'')}</small></span><span class=tm data-tm>${mmss(agora()-p.criado_em)}</span></div>
   ${p.obs?`<div class=tk-o>📝 ${esc(p.obs)}</div>`:''}
   <div class=tk-l>${p.itens.map(i=>`<button class="tk-i ${i.status==='pronto'?'ok':''}" data-i="${esc(i.id)}" data-s="${i.status}"><span class=q>${i.qtd}×</span><span><b>${esc(i.nome)}</b>${i.obs?`<span class=ob>⚠ ${esc(i.obs)}</span>`:''}</span></button>`).join('')}</div>
   <div class=tk-f><button class=ic data-print title=Imprimir>🖨️</button>${e==='novo'?`<button class="b lilac" data-st=preparo>Iniciar preparo</button>`:e==='preparo'?`<button class="b lime" data-st=pronto>✓ Pronto</button>`:`<button class="b ghost" data-st=preparo style="color:#fff">↩ Voltar ao preparo</button>`}</div></article>`;
 }
 function relogios(){
  const c=$('#clk');if(c)c.textContent=new Date(agora()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  document.querySelectorAll('.tk').forEach(t=>{const ms=agora()-Number(t.dataset.t);const el=t.querySelector('[data-tm]');if(el)el.textContent=mmss(ms);
   const pr=t.classList.contains('pronto');t.classList.toggle('atr',!pr&&ms>12*60000&&ms<=25*60000);t.classList.toggle('atr2',!pr&&ms>25*60000)});
 }
 async function enviar(body){
  try{await api(A,{method:'POST',body:{t:TK,...body}});await buscarJa()}catch(e){toast(e.message,1)}
 }
 async function buscarJa(){const r=await api(`${A}?t=${encodeURIComponent(TK)}&full=1`);marca=r.marca;D=r;vistos=new Set([...(vistos||[]),...r.pedidos.map(p=>p.id)]);desenhar()}
 function clique(e){
  const t=e.target.closest('.tk');if(!t)return;const p=D.pedidos.find(x=>x.id===t.dataset.p);
  const st=e.target.closest('[data-st]'),it=e.target.closest('[data-i]');
  if(e.target.closest('[data-print]'))return imprimirPedido(p);
  if(st)return enviar({pedido_id:p.id,status:st.dataset.st});
  if(it)return enviar({item_id:it.dataset.i,status:it.dataset.s==='pronto'?'preparo':'pronto'});
 }
 function imprimirPedido(p){
  impressos.add(p.id);guardar();
  const h=new Date(p.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  imprimir(`<h1>${esc(D.setor_nome.toUpperCase())}</h1><h2>PEDIDO #${p.numero}</h2><div class=c>${esc(origem(p))}</div><div class=c>${h}${p.atendente?' · '+esc(p.atendente):''}</div><div class=ln></div>
   ${p.itens.map(i=>`<div class=i>${i.qtd}x ${esc(i.nome)}</div>${i.obs?`<div class=o>&gt; ${esc(i.obs)}</div>`:''}`).join('')}
   ${p.obs?`<div class=ln></div><div>OBS: ${esc(p.obs)}</div>`:''}<div class=ln></div><div class=c>${esc(D.loja)}</div>`);
 }
 inicio();
})();
