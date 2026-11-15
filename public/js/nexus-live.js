// Nexus Live — presença (conta navegadores abertos) + caixa de mensagens discreta para os clientes.
// Carregado em /painel/, /app.html e /master.html. No Master só envia o "estou aqui" e repassa quem está online.
(()=>{
 if(window.__nexusLive)return;window.__nexusLive=1;
 const MASTER=location.pathname.startsWith('/master');
 const rid=()=>{try{return crypto.randomUUID()}catch{return 'x'+Math.random().toString(36).slice(2)+Date.now().toString(36)}};
 let cid='';try{cid=localStorage.getItem('nexus_cid')||'';if(!/^[A-Za-z0-9_-]{8,64}$/.test(cid)){cid=rid();localStorage.setItem('nexus_cid',cid)}}catch{cid=cid||rid()}
 const tab=rid(),page=MASTER?'master':location.pathname.startsWith('/painel')?'painel':'conta';
 const post=(path,body)=>fetch('/api/'+path,{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify(body),keepalive:true});
 let stopped=false,timer=null,inflight=false;
 async function beat(){
  if(stopped||inflight)return;inflight=true;
  try{
   const r=await post('presence/ping',{cid,tab,page});
   if(r.status===401){return} // sem login: tenta de novo no próximo ciclo
   const j=await r.json();
   if(j.presence){window.__nexusPresence=j.presence;dispatchEvent(new CustomEvent('nexus:presence',{detail:j.presence}))}
   if(j.messages)inbox.set(j.messages);
  }catch{}finally{inflight=false}
 }
 // Economia de gravações no D1: 1 aviso a cada 90 s. O 1º aviso do cliente espera 6 s (não disputa com a abertura do painel).
 // Cliente com a aba escondida há mais de 10 min deixa de avisar (conta como ausente até voltar a olhar a tela).
 const EVERY=90000,AWAY=600000;let hiddenAt=0;
 window.__nexusBeat=beat;
 const loop=()=>{clearTimeout(timer);timer=setTimeout(()=>{if(MASTER||!(document.hidden&&hiddenAt&&Date.now()-hiddenAt>AWAY))beat();loop()},EVERY)};
 MASTER?beat():setTimeout(beat,6000);loop();
 addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();return}const away=hiddenAt&&Date.now()-hiddenAt>AWAY;hiddenAt=0;if(away||MASTER)beat()});
 addEventListener('online',beat);
 // fechou a aba/navegador: avisa na hora para sair da contagem
 addEventListener('pagehide',()=>{stopped=true;try{navigator.sendBeacon('/api/presence/ping',new Blob([JSON.stringify({cid,tab,bye:true})],{type:'application/json'}))}catch{}});
 addEventListener('pageshow',e=>{if(e.persisted){stopped=false;beat()}});
 if(MASTER)return;

 // ---------- Caixa de mensagens (somente clientes) ----------
 const css=`
#nxm-tab{position:fixed;right:0;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:80;width:26px;height:52px;border:0;border-radius:12px 0 0 12px;background:var(--card,#1b1b2a);color:var(--tx,var(--text,#f5f4fa));box-shadow:-2px 2px 14px #0005;border:1px solid var(--bd,var(--line,#2a2938));border-right:0;cursor:pointer;display:none;align-items:center;justify-content:center;font:700 16px/1 system-ui;opacity:.55;transition:opacity .2s,width .2s,transform .2s;padding:0}
#nxm-tab:hover,#nxm-tab:focus-visible{opacity:1;width:32px}
#nxm-tab.on{display:flex}
#nxm-tab.pulse{opacity:.95;animation:nxmp 2.4s ease-in-out infinite}
#nxm-tab b{position:absolute;left:-7px;top:-7px;min-width:18px;height:18px;border-radius:9px;background:var(--ac,var(--accent,#7c5cff));color:#fff;font:700 11px/18px system-ui;text-align:center;padding:0 4px}
@keyframes nxmp{0%,100%{box-shadow:-2px 2px 14px #0005}50%{box-shadow:-2px 2px 18px var(--ac,var(--accent,#7c5cff))}}
#nxm-card{position:fixed;right:12px;bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:81;width:min(340px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:var(--card,#1b1b2a);color:var(--tx,var(--text,#f5f4fa));border:1px solid var(--bd,var(--line,#2a2938));border-radius:14px;box-shadow:0 18px 50px #0008;padding:14px 14px 12px;display:none;font:14px/1.45 system-ui,Segoe UI,Roboto,sans-serif}
#nxm-card.on{display:block;animation:nxmi .18s ease-out}
@keyframes nxmi{from{opacity:0;transform:translateY(8px)}}
#nxm-card .h{display:flex;align-items:center;gap:8px;margin-bottom:8px;color:var(--mu,var(--muted,#a4a2b5));font-size:12px}
#nxm-card .h b{color:var(--tx,var(--text,#f5f4fa));font-size:13px;flex:1}
#nxm-card .x{background:none;border:0;color:inherit;font-size:20px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:8px}
#nxm-card .x:hover{background:#8883}
#nxm-card .t{white-space:pre-wrap;word-break:break-word;margin:0 0 10px}
#nxm-card textarea{width:100%;min-height:68px;resize:vertical;border-radius:10px;border:1px solid var(--bd,var(--line,#2a2938));background:var(--bg,#0b0b12);color:inherit;padding:9px 10px;font:inherit;margin-bottom:8px}
#nxm-card .a{display:flex;gap:8px;justify-content:flex-end;align-items:center}
#nxm-card .b{border:0;border-radius:10px;padding:8px 14px;background:var(--ac,var(--accent,#7c5cff));color:#fff;font:600 13px system-ui;cursor:pointer}
#nxm-card .b:disabled{opacity:.5}
#nxm-card .g{background:none;border:0;color:var(--mu,var(--muted,#a4a2b5));font:13px system-ui;cursor:pointer;padding:8px 6px}
#nxm-card .bar{height:3px;border-radius:2px;background:#8883;margin-top:10px;overflow:hidden}
#nxm-card .bar i{display:block;height:100%;width:100%;background:var(--ac,var(--accent,#7c5cff));transform-origin:left}
#nxm-card .ok{color:var(--ok,var(--good,#22c55e));font-weight:600}
@media (prefers-reduced-motion:reduce){#nxm-tab.pulse{animation:none}#nxm-card.on{animation:none}}`;
 const st=document.createElement('style');st.textContent=css;document.head.append(st);
 const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.textContent=h;return e};
 const tabBtn=el('button','', '‹');tabBtn.id='nxm-tab';tabBtn.type='button';tabBtn.title='Nova mensagem';tabBtn.setAttribute('aria-label','Abrir mensagem');
 const badge=el('b');tabBtn.append(badge);
 const card=el('div');card.id='nxm-card';card.setAttribute('role','dialog');card.setAttribute('aria-live','polite');
 const mount=()=>{document.body.append(tabBtn,card)};
 document.body?mount():addEventListener('DOMContentLoaded',mount);

 let list=[],open=false,deferred=new Set(),autoT=null,barAnim=null,cur=null;
 const hhmm=ms=>{const d=new Date(ms),t=new Date();const h=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});return d.toDateString()===t.toDateString()?h:d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})+' '+h}
 const act=(id,action,text)=>post('messages',{id,action,text}).then(async r=>{const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Erro');return j});
 const drop=id=>{list=list.filter(m=>m.id!==id);cur=null};
 function clearAuto(){clearTimeout(autoT);autoT=null;if(barAnim){barAnim.cancel();barAnim=null}}
 function paintTab(){
  const n=list.length;tabBtn.classList.toggle('on',n>0&&!open);badge.textContent=n>1?String(n):'';badge.style.display=n>1?'':'none';
  tabBtn.classList.toggle('pulse',n>0&&list.some(m=>!deferred.has(m.id)));
 }
 function close(){open=false;clearAuto();card.classList.remove('on');paintTab()}
 function show(){
  clearAuto();
  if(!list.length){close();return}
  open=true;card.classList.add('on');paintTab();
  const m=list[0];cur=m.id;deferred.delete(m.id);
  card.textContent='';
  const h=el('div','h'),title=el('b','', 'Mensagem');
  const meta=el('span','',hhmm(m.send_at)+(list.length>1?' · 1 de '+list.length:''));
  const x=el('button','x','×');x.type='button';x.title='Fechar';x.setAttribute('aria-label','Fechar');
  h.append(title,meta,x);card.append(h,el('p','t',m.body));
  act(m.id,'read').catch(()=>{}); // abriu = lida
  if(m.needs_reply){
   const ta=el('textarea');ta.placeholder='Escreva sua resposta…';ta.maxLength=1000;
   const a=el('div','a'),later=el('button','g','Depois'),send=el('button','b','Responder');later.type=send.type='button';
   a.append(later,send);card.append(ta,a);ta.focus({preventScroll:true});
   x.onclick=later.onclick=()=>{deferred.add(m.id);close()}; // resposta é pedida: só minimiza, volta quando entrar de novo
   send.onclick=async()=>{
    const v=ta.value.trim();if(!v){ta.focus();return}
    send.disabled=ta.disabled=true;
    try{await act(m.id,'reply',v);drop(m.id);card.textContent='';const ok=el('p','t ok','✓ Resposta enviada');card.append(ok);setTimeout(()=>{if(cur===null)show()},1400)}
    catch(e){send.disabled=ta.disabled=false;alert(e.message)}
   };
  }else{
   const finish=async()=>{clearAuto();const id=m.id;drop(id);try{await act(id,'close')}catch{}show()};
   x.onclick=finish;
   const ms=Math.min(30000,Math.max(8000,m.body.length*70)),bar=el('div','bar'),fill=el('i');bar.append(fill);card.append(bar);
   const start=()=>{clearTimeout(autoT);autoT=setTimeout(finish,ms);try{barAnim=fill.animate([{transform:'scaleX(1)'},{transform:'scaleX(0)'}],{duration:ms,easing:'linear',fill:'forwards'})}catch{}};
   start();
   // mexeu o mouse sobre o cartão (está lendo): pausa a contagem; saiu: retoma de onde parou
   let paused=false;
   card.onmousemove=()=>{if(paused||cur!==m.id)return;paused=true;clearTimeout(autoT);autoT=null;if(barAnim)barAnim.pause()};
   card.onmouseleave=()=>{if(!paused||cur!==m.id)return;paused=false;const left=barAnim&&barAnim.effect?ms*(1-(barAnim.effect.getComputedTiming().progress||0)):ms;clearTimeout(autoT);autoT=setTimeout(finish,Math.max(2500,left));if(barAnim)barAnim.play()};
  }
 }
 tabBtn.onclick=()=>show();
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&cur){const m=list.find(x=>x.id===cur);if(m&&!m.needs_reply)card.querySelector('.x')?.click();else if(m){deferred.add(m.id);close()}}});
 const inbox={set(msgs){
  const ids=new Set(msgs.map(m=>m.id));
  // mantém a ordem do servidor; descarta o que já foi fechado em outra aba/dispositivo
  list=msgs;deferred=new Set([...deferred].filter(id=>ids.has(id)));
  if(open&&cur&&!ids.has(cur)){cur=null;list.length?show():close()}
  else paintTab();
 }};
})();
