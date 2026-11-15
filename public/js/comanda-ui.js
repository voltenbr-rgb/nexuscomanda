// Nexus Comanda — utilidades das páginas públicas (cardápio, garçom, produção).
(()=>{
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const brl=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const slug=()=>decodeURIComponent(location.pathname.split('/').filter(Boolean)[1]||'');
 // opt.timeout (ms): desiste da espera e lança erro com e.semResposta=true (a requisição pode ter chegado ao servidor).
 async function api(url,opt={}){
  const ac=opt.timeout?new AbortController():null,t=ac&&setTimeout(()=>ac.abort(),opt.timeout);
  let r;
  try{r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opt,signal:ac?.signal,headers:{'content-type':'application/json'},body:opt.body&&JSON.stringify(opt.body)})}
  catch(x){const e=Error(navigator.onLine===false?'Sem internet.':'Internet fraca ou sem resposta.');e.rede=true;e.semResposta=x?.name==='AbortError';throw e}
  finally{t&&clearTimeout(t)}
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=Error(j.error||'Erro no servidor. Tente de novo.');e.status=r.status;if(r.status>=500)e.rede=true;throw e}
  return j;
 }
 function toast(m,erro){const t=document.createElement('div');t.className='toast'+(erro?' e':'');t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3000)}
 // Folha inferior (no computador vira janela central). Devolve o elemento .sh; fecha com close().
 function sheet(html,{onClose}={}){
  const bg=document.createElement('div');bg.className='sh-bg';bg.innerHTML=`<div class=sh role=dialog aria-modal=true>${html}</div>`;
  const close=()=>{bg.remove();onClose&&onClose()};
  bg.addEventListener('click',e=>{if(e.target===bg||e.target.closest('[data-x]'))close()});
  document.body.append(bg);const s=bg.firstChild;s.close=close;return s;
 }
 const desde=ms=>{const m=Math.max(0,Math.floor((Date.now()-ms)/60000));return m<1?'agora':m<60?`há ${m} min`:`há ${Math.floor(m/60)} h ${m%60} min`};
 const ICONE_SIT={novo:'Novo',preparo:'Em preparo',pronto:'Pronto para servir',saiu:'Saiu para entrega',entregue:'Entregue',concluido:'Concluído',cancelado:'Cancelado',aberto:'Aberta'};
 const pill=s=>`<span class="pill st-${esc(s)}">${esc(ICONE_SIT[s]||s)}</span>`;
 // Bipe curto (Web Audio). O navegador só libera som depois de um toque na tela.
 let ac;function beep(n=2){try{ac=ac||new (window.AudioContext||window.webkitAudioContext)();ac.resume();for(let i=0;i<n;i++){const o=ac.createOscillator(),g=ac.createGain();o.type='sine';o.frequency.value=i%2?1320:880;g.gain.setValueAtTime(.0001,ac.currentTime+i*.22);g.gain.exponentialRampToValueAtTime(.4,ac.currentTime+i*.22+.02);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+i*.22+.2);o.connect(g).connect(ac.destination);o.start(ac.currentTime+i*.22);o.stop(ac.currentTime+i*.22+.22)}}catch{}}
 // Atualização periódica que pausa com a aba escondida e acelera ao voltar.
 function loop(fn,ms){let t,parado=false;const tick=async()=>{clearTimeout(t);if(parado)return;try{await fn()}catch{}t=setTimeout(tick,document.hidden?ms*4:ms)};document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});tick();return {stop(){parado=true;clearTimeout(t)},now:tick}}
 // Impressão térmica: monta o cupom em #prt e chama a impressão do navegador.
 function imprimir(html){let p=$('#prt');if(!p){p=document.createElement('div');p.id='prt';document.body.append(p)}p.innerHTML=html;setTimeout(()=>window.print(),30)}
 const emoji=n=>{const s=String(n||'').toLowerCase();return /pizza/.test(s)?'🍕':/sushi|temaki|hot|combinad|sashimi/.test(s)?'🍣':/burger|x-|lanche/.test(s)?'🍔':/batata|fritas|porç/.test(s)?'🍟':/suco|refri|água|agua|lata|bebida|milk/.test(s)?'🥤':/cerveja|chopp|chope|drink|caipi|saquê|vinho/.test(s)?'🍺':/doce|sobremesa|petit|sorvete|chocolate|açaí/.test(s)?'🍨':/salada/.test(s)?'🥗':'🍽️'};
 // App instalável (PWA): cada link vira um app no aparelho. Garçom e telas de produção mostram o botão "Instalar".
 try{navigator.serviceWorker?.register('/service-worker.js')}catch{}
 const instalado=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||navigator.standalone;
 let pedidoInstalar=null;
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();pedidoInstalar=e;botaoInstalar()});
 function botaoInstalar(){
  if(instalado()||document.getElementById('cmInst')||!/pg-(garcom|producao)/.test(document.body.className))return;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent);if(!pedidoInstalar&&!ios)return;
  const b=document.createElement('button');b.id='cmInst';b.className='cm-inst';b.innerHTML='📲 Instalar app<small>abre direto nesta tela</small><i aria-label=Fechar>✕</i>';
  b.onclick=async e=>{if(e.target.tagName==='I'){b.remove();try{sessionStorage.cmInstX=1}catch{}return}
   if(pedidoInstalar){pedidoInstalar.prompt();const r=await pedidoInstalar.userChoice;pedidoInstalar=null;b.remove();if(r.outcome==='accepted')toast('App instalado! Abra pelo ícone na tela inicial.')}
   else sheet('<div class=sh-hd><h3 style="margin:0">Instalar no iPhone</h3><button class=ic data-x>✕</button></div><p>1. Toque em <b>Compartilhar</b> (quadrado com seta) na barra do Safari.<br>2. Escolha <b>Adicionar à Tela de Início</b>.<br>3. Toque em <b>Adicionar</b>.</p><p class=mu>Depois é só abrir pelo ícone: ele já entra direto nesta tela.</p>')};
  try{if(sessionStorage.cmInstX)return}catch{}
  document.body.append(b);
 }
 addEventListener('load',()=>setTimeout(botaoInstalar,1500));
 addEventListener('appinstalled',()=>document.getElementById('cmInst')?.remove());
 window.CM={$,$$,esc,brl,slug,api,toast,sheet,desde,pill,beep,loop,imprimir,emoji,SIT:ICONE_SIT,PAG:{dinheiro:'💵 Dinheiro',pix:'⚡ Pix',credito:'💳 Crédito',debito:'💳 Débito',vale:'🎫 Vale-refeição'}};
})();
