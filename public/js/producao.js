// Nexus Comanda — tela de produção (/producao/<loja>/<cozinha|bar|cozinha-bar>?t=TOKEN). Feita para TV/tablet: letras grandes.
// Mostra só os itens do(s) setor(es), agrupados por pedido. "cozinha-bar" divide a tela: Cozinha à esquerda, Bar à direita.
// Atualiza a cada 3 s, bipa a cada pedido novo, imprime em impressora térmica e alterna tema escuro/claro (guardado no aparelho).
(()=>{
 const {$,esc,api,toast,beep,loop,imprimir}=CM;
 const partes=location.pathname.split('/').filter(Boolean),S=decodeURIComponent(partes[1]||''),TELA=partes[2]||'cozinha';
 const DUPLA=TELA==='cozinha-bar';
 const TK=new URLSearchParams(location.search).get('t')||'';
 const A=`/api/producao/${encodeURIComponent(S)}/${TELA}`;
 const PREF='cm_prod_'+S+'_'+TELA;
 const ICONE={cozinha:'🍳',bar:'🍹','cozinha-bar':'🍳🍹'},NOME={cozinha:'Cozinha',bar:'Bar','cozinha-bar':'Cozinha e Bar'};
 let D=null,logo='',marca=0,vistos=null,som=true,autoImp=null,offline=false,impressos=new Set(),tema='claro';
 try{const p=JSON.parse(localStorage.getItem(PREF)||'{}');som=p.som!==false;autoImp=p.imp??null;impressos=new Set(p.impressos||[]);tema=p.tema==='escuro'?'escuro':'claro'}catch{} // padrão: claro; quem quiser ativa o escuro no 🌙
 const guardar=()=>{try{localStorage.setItem(PREF,JSON.stringify({som,imp:autoImp,tema,impressos:[...impressos].slice(-300)}))}catch{}};
 const aplicarTema=()=>{document.body.classList.toggle('pd-claro',tema==='claro');document.querySelector('meta[name=theme-color]')?.setAttribute('content',tema==='claro'?'#eefbc4':'#0f1013')};
 aplicarTema();
 const mmss=ms=>{const s=Math.max(0,Math.floor(ms/1000)),m=Math.floor(s/60);return m>=60?`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`};
 let difRelogio=0;
 const agora=()=>Date.now()+difRelogio;
 const estado=t=>t.itens.every(i=>i.status==='pronto')?'pronto':t.itens.some(i=>i.status!=='novo')?'preparo':'novo';
 const origem=p=>p.tipo==='mesa'?`Mesa ${p.mesa||''}`:p.tipo==='delivery'?`🛵 Delivery${p.cliente?' · '+p.cliente:''}`:p.tipo==='retirada'?`🛍️ Retirada${p.cliente?' · '+p.cliente:''}`:`Balcão${p.cliente?' · '+p.cliente:''}`;
 // Um "cartão" = um pedido em um setor. Na tela dupla, o mesmo pedido pode ter um cartão na Cozinha e outro no Bar.
 const cartoes=setor=>D.pedidos.map(p=>({...p,setor,itens:p.itens.filter(i=>(i.setor||setor)===setor)})).filter(t=>t.itens.length);
 const setores=()=>DUPLA?['cozinha','bar']:[TELA];
 const marcaLogo=()=>logo?`<span class=pd-logo><img src="${esc(logo)}" alt=""></span>`:`<i>${ICONE[TELA]}</i>`;

 function inicio(){
  // O navegador só toca som depois de um toque na tela; por isso a tela começa com um botão.
  $('#app').innerHTML=`<div class=pd-start><div><span style="font-size:60px">${ICONE[TELA]}</span><h1 style="margin:0">Tela ${DUPLA?'da Cozinha e do Bar':TELA==='bar'?'do Bar':'da Cozinha'}</h1><p class=mu style="margin:0">Deixe esta tela aberta. Os pedidos chegam sozinhos, com aviso sonoro.</p><button class="b lime" id=go style="padding:16px">▶ Iniciar tela</button><small class=mu>Dica: use o modo tela cheia (⛶) e mantenha o aparelho na tomada.</small></div></div>`;
  $('#go').onclick=()=>{beep(1);try{navigator.wakeLock?.request('screen')}catch{}loop(buscar,3000);setInterval(relogios,1000)};
 }
 async function buscar(){
  let r;
  try{r=await api(`${A}?t=${encodeURIComponent(TK)}${D?`&since=${marca}`:''}`,{timeout:12000});offline=false}
  catch(e){if(e.status===403||e.status===404){$('#app').innerHTML=`<div class=pd-start><div><h1>Link inválido</h1><p class=mu>${esc(e.message)}</p></div></div>`;throw e}offline=true;faixa();return}
  difRelogio=r.agora-Date.now();
  if(r.igual){faixa();return}
  if('logo' in r)logo=r.logo||'';
  marca=r.marca;D=r;if(autoImp===null)autoImp=!!r.impressao_auto;
  const ids=new Set(r.pedidos.map(p=>p.id));
  if(vistos){const novos=r.pedidos.filter(p=>!vistos.has(p.id));if(novos.length){if(som)beep(3);if(autoImp)novos.forEach(p=>{if(!impressos.has(p.id)){impressos.add(p.id);setores().forEach(s=>{const t=cartoes(s).find(x=>x.id===p.id);if(t)imprimirCartao(t)})}})}}
  vistos=new Set([...(vistos||[]),...ids]);
  desenhar();
 }
 function faixa(){const f=$('#off');if(f)f.classList.toggle('hide',!offline)}
 const grade=ts=>{const at=ts.filter(t=>estado(t)!=='pronto'),pr=ts.filter(t=>estado(t)==='pronto');return at.map(cartao).join('')+pr.map(cartao).join('')+(!ts.length?`<div class=pd-empty><i>✨</i>Nenhum pedido no momento.</div>`:'')};
 function desenhar(){
  const todos=setores().flatMap(cartoes),cnt=s=>todos.filter(t=>estado(t)===s).length;
  const corpo=DUPLA?`<main class=pd-split>${['cozinha','bar'].map(s=>{const ts=cartoes(s),ab=ts.filter(t=>estado(t)!=='pronto').length;return `<section class=pd-col><h2><i>${ICONE[s]}</i>${NOME[s]} <small>${ab}</small></h2><div class="pd-grid" data-setor=${s}>${grade(ts)}</div></section>`}).join('')}</main>`
   :`<main class=pd-grid data-setor=${TELA}>${grade(cartoes(TELA))}</main>`;
  $('#app').innerHTML=`<div id=off class="pd-off hide">Sem conexão — tentando novamente…</div><header class=pd-top><h1>${marcaLogo()}<span>${esc(D.setor_nome)}<small class=lj>${esc(D.loja)}</small></span></h1><span class=sp></span>
   <div class=pd-cnt><span>Novos<b>${cnt('novo')}</b></span><span>Preparando<b>${cnt('preparo')}</b></span><span>Prontos<b>${cnt('pronto')}</b></span></div>
   <span class=clk id=clk></span><button class=ic id=tema title="Alternar tema claro/escuro">${tema==='claro'?'🌙':'☀️'}</button><button class="ic ${som?'on':''}" id=som title="Som">${som?'🔔':'🔕'}</button><button class="ic ${autoImp?'on':''}" id=imp title="Imprimir pedidos novos automaticamente">🖨️</button><button class=ic id=fs title="Tela cheia">⛶</button></header>${corpo}`;
  faixa();relogios();
  $('#tema').onclick=()=>{tema=tema==='claro'?'escuro':'claro';guardar();aplicarTema();desenhar()};
  $('#som').onclick=()=>{som=!som;guardar();if(som)beep(1);desenhar()};
  $('#imp').onclick=()=>{autoImp=!autoImp;guardar();toast(autoImp?'Impressão automática ligada':'Impressão automática desligada');desenhar()};
  $('#fs').onclick=()=>{document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()};
  document.querySelectorAll('[data-setor]').forEach(g=>g.onclick=clique);
 }
 function cartao(t){
  const e=estado(t);
  return `<article class="tk ${e}" data-p="${esc(t.id)}" data-t="${t.criado_em}"><div class=tk-h><span class=n>#${t.numero}</span><span class=w><b>${esc(origem(t))}</b><small>${esc(t.atendente||'')}</small></span><span class=tm data-tm>${mmss(agora()-t.criado_em)}</span></div>
   ${t.obs?`<div class=tk-o>📝 ${esc(t.obs)}</div>`:''}
   <div class=tk-l>${t.itens.map(i=>`<button class="tk-i ${i.status==='pronto'?'ok':''}" data-i="${esc(i.id)}" data-s="${i.status}"><span class=q>${i.qtd}×</span><span><b>${esc(i.nome)}</b>${i.obs?`<span class=ob>⚠ ${esc(i.obs)}</span>`:''}</span></button>`).join('')}</div>
   <div class=tk-f><button class=ic data-print title=Imprimir>🖨️</button>${e==='novo'?`<button class="b lilac" data-st=preparo>Iniciar preparo</button>`:e==='preparo'?`<button class="b lime" data-st=pronto>✓ Pronto</button>`:`<button class="b ghost vt" data-st=preparo>↩ Voltar ao preparo</button>`}</div></article>`;
 }
 function relogios(){
  const c=$('#clk');if(c)c.textContent=new Date(agora()).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  document.querySelectorAll('.tk').forEach(t=>{const ms=agora()-Number(t.dataset.t);const el=t.querySelector('[data-tm]');if(el)el.textContent=mmss(ms);
   const pr=t.classList.contains('pronto');t.classList.toggle('atr',!pr&&ms>12*60000&&ms<=25*60000);t.classList.toggle('atr2',!pr&&ms>25*60000)});
 }
 async function enviar(body){
  try{await api(A,{method:'POST',body:{t:TK,...body}});await buscarJa()}catch(e){toast(e.message,1)}
 }
 async function buscarJa(){const r=await api(`${A}?t=${encodeURIComponent(TK)}&since=${marca}&full=1`);marca=r.marca;D=r;vistos=new Set([...(vistos||[]),...r.pedidos.map(p=>p.id)]);desenhar()}
 function clique(e){
  const setor=e.currentTarget.dataset.setor,el=e.target.closest('.tk');if(!el)return;
  const t=cartoes(setor).find(x=>x.id===el.dataset.p);if(!t)return;
  const st=e.target.closest('[data-st]'),it=e.target.closest('[data-i]');
  if(e.target.closest('[data-print]')){impressos.add(t.id);guardar();return imprimirCartao(t)}
  if(st)return enviar({pedido_id:t.id,setor,status:st.dataset.st});
  if(it)return enviar({item_id:it.dataset.i,setor,status:it.dataset.s==='pronto'?'preparo':'pronto'});
 }
 function imprimirCartao(t){
  const h=new Date(t.criado_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  imprimir(`<h1>${esc(NOME[t.setor].toUpperCase())}</h1><h2>PEDIDO #${t.numero}</h2><div class=c>${esc(origem(t))}</div><div class=c>${h}${t.atendente?' · '+esc(t.atendente):''}</div><div class=ln></div>
   ${t.itens.map(i=>`<div class=i>${i.qtd}x ${esc(i.nome)}</div>${i.obs?`<div class=o>&gt; ${esc(i.obs)}</div>`:''}`).join('')}
   ${t.obs?`<div class=ln></div><div>OBS: ${esc(t.obs)}</div>`:''}<div class=ln></div><div class=c>${esc(D.loja)}</div>`);
 }
 inicio();
})();
