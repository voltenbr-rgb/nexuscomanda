// Nexus Comanda — utilidades das páginas públicas (cardápio, garçom, produção).
(()=>{
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const brl=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const slug=()=>decodeURIComponent(location.pathname.split('/').filter(Boolean)[1]||'');
 async function api(url,opt={}){
  const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opt,headers:{'content-type':'application/json'},body:opt.body&&JSON.stringify(opt.body)});
  const j=await r.json().catch(()=>({}));
  if(!r.ok){const e=Error(j.error||'Sem conexão. Tente de novo.');e.status=r.status;throw e}
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
 window.CM={$,$$,esc,brl,slug,api,toast,sheet,desde,pill,beep,loop,imprimir,emoji,SIT:ICONE_SIT,PAG:{dinheiro:'💵 Dinheiro',pix:'⚡ Pix',credito:'💳 Crédito',debito:'💳 Débito',vale:'🎫 Vale-refeição'}};
})();
