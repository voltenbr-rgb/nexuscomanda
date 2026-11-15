const $=s=>document.querySelector(s);async function api(p,o={}){const r=await fetch('/api/'+p,{credentials:'same-origin',headers:{'content-type':'application/json'},...o});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Error(j.error||'Erro');return j}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>!d?'—':/^\d{4}-\d{2}-\d{2}$/.test(String(d))?String(d).split('-').reverse().join('/'):new Date(d).toLocaleDateString('pt-BR');
const ST={active:'Ativo',trial:'Teste',suspended:'Suspenso',expired:'Expirado'};
const patch=b=>api('master/tenants',{method:'PATCH',body:JSON.stringify(b)});
let DATA=[],shown=new Set(),openRows=new Set(),TRASHV=false;
function render(){
 const q=$('#q').value.trim().toLowerCase(),qd=q.replace(/\D/g,'');
 const tb=$('#trashBtn'),nt=DATA.filter(t=>t.trash).length;if(tb){tb.textContent=TRASHV?'← Voltar aos cadastros':'🗑 Lixeira ('+nt+')';tb.classList.toggle('on',TRASHV)}$('#trashInfo').hidden=!TRASHV;
 const list=DATA.filter(t=>!!t.trash===TRASHV).filter(t=>!q||t.business_name.toLowerCase().includes(q)||(t.note||'').toLowerCase().includes(q)||(qd&&(t.phone||'').includes(qd)));
 $('#tenants').innerHTML=list.length?`<table class="m-table"><thead><tr><th>Cliente</th><th>Telefone</th><th>Plano</th><th>Lojas</th><th>Login · Senha</th><th>Status</th><th></th></tr></thead><tbody>${list.map(t=>{
  const pw=t.credentials.password,vis=shown.has(t.id);
  const pwCell=pw==null?'<span class="m-muted">indisponível — redefina</span>':`<span class="m-pass">${vis?esc(pw):'••••••'}</span> <button class="textbtn" data-eye="${t.id}">${vis?'ocultar':'ver'}</button>`;
  return `<tr><td><i class="m-dot" data-dot="${t.id}"></i><b>${esc(t.business_name)}</b><br><small class="m-muted">${t.company_name?esc(t.company_name)+' · ':''}${esc(t.niche_label||t.segment)} · desde ${fmt(t.created_at)}</small>${t.note?`<br><small class="m-note">📝 ${esc(t.note)}</small>`:''}</td><td>${t.phone?esc(t.phone_fmt):'<span class="m-muted">— sem telefone</span>'}</td><td>${esc(t.plan_label)}</td><td><b>${t.stores_count}</b> <small class="m-muted">de ${t.limit} liberadas</small></td><td><small class="m-muted">${t.phone?esc(t.phone_fmt):'—'}</small><br>${pwCell}</td><td>${t.trash?`<span class="badge m-trash">🗑 Lixeira</span><br><small class="m-muted">apaga em ${t.trash.days_left} dia${t.trash.days_left===1?'':'s'} (${fmt(t.trash.purge_at)})</small>`:`<span class="badge">${ST[t.status]||esc(t.status)}</span><br><small class="m-muted">vence ${fmt(t.license_expires_at||t.trial_expires_at)}</small>`}</td><td><button class="textbtn" data-more="${t.id}">${openRows.has(t.id)?'fechar':'gerenciar'}</button></td></tr>${openRows.has(t.id)?detail(t):''}`}).join('')}</tbody></table>`:(TRASHV?'<p class="m-muted">A lixeira está vazia.</p>':'<p>Nenhum cliente encontrado.</p>');
 bind();applyDots();
}
function detail(t){return `<tr class="m-detail"><td colspan="7"><div class="m-grant-wrap"><div class="m-grant"><b>Liberar acesso</b><select data-gplan="${t.id}"><option value="starter"${t.plan_id==='starter'?' selected':''}>Plano Básico</option><option value="pro"${t.plan_id==='pro'?' selected':''}>Plano Completo</option><option value="business"${t.plan_id==='business'?' selected':''}>Plano Premium</option></select><select data-gdays="${t.id}"><option value="30">+30 dias</option><option value="90">+90 dias</option><option value="180">+6 meses</option><option value="365">+12 meses</option><option value="custom">Outro (dias)…</option></select><input type="text" class="m-gnote" data-gnote="${t.id}" maxlength="200" placeholder="Observação (ex.: veio do curso X)" value="${esc(t.note||'')}"><button class="btn" data-grant="${t.id}">Liberar</button></div></div><div class="m-actions">${t.trash?`<button class="btn" data-restore="${t.id}">♻ Restaurar teste (+7 dias)</button>`:''}<select data-status="${t.id}"><option value="">Mudar status…</option><option value="active">Ativo</option><option value="trial">Teste</option><option value="suspended">Suspender</option><option value="expired">Expirar</option></select><button class="textbtn" data-note="${t.id}">Observação</button><button class="textbtn" data-limit="${t.id}">Nº de lojas</button><button class="textbtn" data-phone="${t.id}">${t.phone?'Alterar telefone':'Definir telefone'}</button><button class="textbtn" data-reset="${t.id}">Redefinir senha</button><button class="textbtn" data-deltenant="${t.id}" data-n="${esc(t.business_name)}">${t.trash?'Apagar agora':'Excluir cliente'}</button></div>${t.open.length?'<div class="sub">'+t.open.map(n=>`<div class="data-row"><span>🏪 Loja ${n}</span><button class="textbtn" data-delstore="${t.id}" data-loja="${n}">Retirar loja</button></div>`).join('')+'</div>':'<small class="m-muted">Nenhuma loja aberta ainda.</small>'}${t.auto_renew?`<br><small class="m-muted">Cartão de teste ••••${esc(t.card_last4)}</small>`:''}</td></tr>`}
const run=async f=>{try{await f();await load()}catch(e){alert(e.message)}};
function bind(){
 const on=(sel,key,fn)=>document.querySelectorAll(sel).forEach(el=>el.onclick=()=>fn(el));
 on('[data-eye]','eye',b=>{const id=b.dataset.eye;shown.has(id)?shown.delete(id):shown.add(id);render()});
 on('[data-more]','more',b=>{const id=b.dataset.more;openRows.has(id)?openRows.delete(id):openRows.add(id);render()});
 document.querySelectorAll('[data-status]').forEach(s=>s.onchange=()=>s.value&&run(()=>patch({tenant_id:s.dataset.status,status:s.value})));
on('[data-grant]','',b=>{const id=b.dataset.grant,plan=document.querySelector(`[data-gplan="${id}"]`).value,sel=document.querySelector(`[data-gdays="${id}"]`).value;let days=Number(sel);if(sel==='custom'){const v=prompt('Quantos dias liberar? (1 a 1825)');if(!v)return;days=Number(v)}if(!days||days<1)return alert('Informe uma quantidade de dias válida.');const names={starter:'Básico',pro:'Completo',business:'Premium'};if(confirm('Liberar '+days+' dias do plano '+names[plan]+' para este cliente?'))run(()=>{const body={tenant_id:id,plan_id:plan,extend_days:days},cur=(DATA.find(x=>x.id===id)||{}).note||'',nv=document.querySelector(`[data-gnote="${id}"]`).value.trim();if(nv!==cur)body.note=nv;return patch(body)})});
 on('[data-restore]','',b=>confirm('Tirar este cliente da lixeira e dar mais 7 dias de teste?')&&run(()=>patch({tenant_id:b.dataset.restore,restore_trial_days:7})));
 on('[data-note]','',b=>{const cur=(DATA.find(x=>x.id===b.dataset.note)||{}).note||'';const v=prompt('Observação sobre este cliente (ex.: veio do curso X). Deixe vazio para apagar.',cur);if(v!==null)run(()=>patch({tenant_id:b.dataset.note,note:v.trim()}))});
 on('[data-limit]','',b=>{const v=prompt('Quantas lojas liberar para este cliente? (1 a 20). Deixe vazio para voltar ao limite do plano.');if(v!==null)run(()=>patch({tenant_id:b.dataset.limit,stores_limit:v.trim()}))});
 on('[data-phone]','',b=>{const v=prompt('Novo telefone com DDD (ex.: 67 99612-3456):');if(v)run(()=>patch({tenant_id:b.dataset.phone,new_phone:v}))});
 on('[data-reset]','',b=>{const p=prompt('Nova senha (mínimo 4 caracteres):');if(p)run(async()=>{await patch({tenant_id:b.dataset.reset,new_password:p});shown.add(b.dataset.reset);alert('Senha redefinida.')})});
 on('[data-delstore]','',b=>confirm('Apagar os dados da Loja '+b.dataset.loja+' deste cliente?')&&run(()=>api('master/tenants?tenant_id='+encodeURIComponent(b.dataset.delstore)+'&loja='+b.dataset.loja,{method:'DELETE'})));
 on('[data-deltenant]','',b=>confirm('Excluir o cliente "'+b.dataset.n+'" com todas as lojas e dados? Não dá para desfazer.')&&run(()=>api('master/tenants?tenant_id='+encodeURIComponent(b.dataset.deltenant),{method:'DELETE'})));
}
function moneyC(v){return 'R$ '+(Number(v||0)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}
function renderSales(s,tickets){
 const stats=[['Recebido',moneyC(s.paid_total_cents)],['Pagamentos confirmados',s.paid_count||0],['Aguardando pagamento',s.pending_count||0],['Valor pendente',moneyC(s.pending_total_cents)]];$('#salesStats').innerHTML=stats.map(([a,b])=>`<div class="stat"><small>${a}</small><b>${b}</b></div>`).join('');
 const days=s.by_day||[];$('#salesDays').innerHTML=days.length?`<div class="sales-bars">${days.map(x=>{const max=Math.max(1,...days.map(y=>y.total_cents));return `<div class="sales-bar"><b>${x.count||0} pag.</b><i style="height:${Math.max(5,x.total_cents/max*100)}%"></i><small>${fmt(x.day)}</small><small>${moneyC(x.total_cents)}</small></div>`}).join('')}</div>`:'<p class="m-muted">Ainda não há pagamentos confirmados.</p>';
 const labels={pix:'PIX',card:'Cartão',dinheiro:'Dinheiro',credito:'Cartão de crédito',debito:'Cartão de débito',outros:'Outros'};$('#salesMethods').innerHTML=(s.by_method||[]).length?(s.by_method||[]).map(x=>`<div class="data-row"><span>${labels[x.method]||esc(x.method)}<br><small class="m-muted">${x.count||0} transação(ões)</small></span><b>${moneyC(x.paid_cents)}<br><small class="m-muted">${moneyC(x.pending_cents)} pendente</small></b></div>`).join(''):'<p class="m-muted">Sem pagamentos registrados.</p>';
 const planNames={starter:'Básico',pro:'Completo',business:'Premium'};const ap=s.active_plans||{};$('#activePlans').innerHTML=Object.keys(ap).length?Object.entries(ap).map(([id,count])=>`<div class="data-row"><span>Plano ${planNames[id]||esc(id)}</span><b>${count} cliente(s)</b></div>`).join(''):'<p class="m-muted">Ainda não há assinaturas ativas.</p>'; 
 $('#supportTickets').innerHTML=tickets.length?tickets.map(x=>`<div class="data-row support-ticket"><div><b>${esc(x.name)}</b> · ${esc(x.phone)}<p>${esc(x.message)}</p><small class="m-muted">${fmt(x.created_at)} · ${x.status==='resolved'?'Resolvido':'Em aberto'}</small></div><a class="textbtn" target="_blank" rel="noopener" href="https://wa.me/55${String(x.phone).replace(/\D/g,'')}">WhatsApp</a><button class="textbtn" data-ticket="${x.id}" data-state="${x.status}">${x.status==='resolved'?'Reabrir':'Marcar resolvido'}</button></div>`).join(''):'<p class="m-muted">Nenhuma solicitação de suporte.</p>';
 document.querySelectorAll('[data-ticket]').forEach(b=>b.onclick=async()=>{try{await patch({ticket_id:b.dataset.ticket,ticket_status:b.dataset.state==='resolved'?'open':'resolved'});await load()}catch(e){alert(e.message)}});
}
async function load(){try{const {tenants,summary:s,sales={},support=[]}=await api('master/tenants');DATA=tenants;renderSales(sales,support);
 $('#stats').innerHTML=[['Clientes',s.total],['Ativos',s.active||0],['Em teste',s.trial||0],['Lojas abertas',s.stores_open],['Na lixeira',s.trash||0]].map(([l,v])=>`<div class="stat"><small>${l}</small><b>${v}</b></div>`).join('');
 render();fillTargets()}catch(e){alert(e.message);location.href='/'}}
// ---------- Online agora (navegadores abertos, em tempo real) ----------
let ONL={},lastOk=0;
const ago=ms=>{const s=Math.max(0,Math.round((Date.now()-ms)/1000));return s<20?'agora':s<90?'há '+s+' s':'há '+Math.round(s/60)+' min'};
function applyDots(){document.querySelectorAll('[data-dot]').forEach(d=>{const n=ONL[d.dataset.dot]||0;d.classList.toggle('on',n>0);d.title=n?'Online · '+n+(n>1?' navegadores':' navegador'):'Offline'})}
function renderLive(p){
 lastOk=Date.now();const m=p.master.browsers,c=p.clients;
 $('#liveMaster').textContent=m;$('#liveClients').textContent=c.browsers;$('#liveTenants').textContent=c.tenants;
 $('#liveDot').classList.remove('off');
 ONL={};c.list.forEach(t=>ONL[t.tenant_id]=t.browsers);applyDots();
 $('#liveList').innerHTML=c.list.length?c.list.map(t=>`<div class="data-row"><span><i class="m-dot on"></i> <b>${esc(t.label)}</b></span><span class="m-muted">${t.browsers} ${t.browsers>1?'navegadores':'navegador'} · ${ago(t.seen)}</span></div>`).join(''):'<p class="m-muted">Nenhum cliente com o sistema aberto agora.</p>';
}
addEventListener('nexus:presence',e=>renderLive(e.detail));if(window.__nexusPresence)renderLive(window.__nexusPresence);
setInterval(()=>{if(lastOk&&Date.now()-lastOk>200000)$('#liveDot').classList.add('off')},5000);
$('#liveRefresh').onclick=async()=>{const b=$('#liveRefresh');b.disabled=true;try{await window.__nexusBeat?.()}finally{setTimeout(()=>{b.disabled=false},800)}};
$('#liveToggle').onclick=()=>{const l=$('#liveList');l.hidden=!l.hidden;$('#liveToggle').textContent=l.hidden?'ver quem':'ocultar'};

// ---------- Mensagens para os clientes ----------
const pad=n=>String(n).padStart(2,'0'),dtl=ms=>{const d=new Date(ms);return pad(d.getDate())+'/'+pad(d.getMonth()+1)+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const mf=$('#msgForm'),openRep=new Set();
function fillTargets(){const sel=$('#msgTo'),cur=sel.value;sel.innerHTML='<option value="">Todos os clientes</option>'+DATA.map(t=>`<option value="${t.id}">${esc(t.business_name)}</option>`).join('');sel.value=DATA.some(t=>t.id===cur)?cur:''}
$('#msgBody').oninput=()=>{$('#msgCount').textContent=$('#msgBody').value.length+'/1000'};
$('#msgSched').onchange=()=>{const a=$('#msgAt');a.hidden=!$('#msgSched').checked;$('#msgSend').textContent=$('#msgSched').checked?'Agendar':'Enviar';if(!a.hidden){if(!a.value){const d=new Date(Date.now()+3600000);d.setMinutes(0,0,0);a.value=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes())}a.min=new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);a.focus()}};
mf.onsubmit=async e=>{e.preventDefault();const body=$('#msgBody').value.trim(),st=$('#msgStatus'),btn=$('#msgSend');
 if(!body){st.textContent='Escreva a mensagem.';$('#msgBody').focus();return}
 let at=null;if($('#msgSched').checked){at=new Date($('#msgAt').value).getTime();if(!Number.isFinite(at)){st.textContent='Escolha o dia e o horário.';return}if(at<=Date.now()){st.textContent='O horário já passou. Escolha um horário futuro ou desmarque "Agendar".';return}}
 btn.disabled=true;st.textContent='';
 try{const r=await api('master/messages',{method:'POST',body:JSON.stringify({body,needs_reply:$('#msgReply').checked,target_tenant:$('#msgTo').value||null,send_at:at})});
  st.textContent=r.scheduled?'✓ Agendada para '+dtl(r.send_at)+'.':'✓ Enviada. Quem estiver com o sistema aberto vê em até 2 minutos.';
  $('#msgBody').value='';$('#msgCount').textContent='0/1000';$('#msgReply').checked=false;
  if($('#msgSched').checked){$('#msgSched').checked=false;$('#msgSched').onchange()}
  await loadMsgs()}catch(x){st.textContent=x.message}finally{btn.disabled=false}};
function renderMsgs(list){
 $('#msgList').innerHTML=list.length?list.map(m=>{
  const who=m.target_name?esc(m.target_name):'Todos os clientes',n=m.replies.length,open=openRep.has(m.id);
  const state=m.sent?'<span class="badge">Enviada '+dtl(m.send_at)+'</span>':'<span class="badge m-sched">⏰ Agendada '+dtl(m.send_at)+'</span>';
  return `<div class="m-msg"><div class="m-msg-top">${state}<small class="m-muted">Para: ${who}${m.needs_reply?' · pede resposta':''}</small><span class="m-spacer"></span>${m.sent?`<small class="m-muted">Lida por ${m.read} de ${m.recipients}</small>`:''}${n?`<button class="textbtn" data-reps="${m.id}">${open?'ocultar':'ver'} ${n} resposta${n>1?'s':''}</button>`:''}<button class="textbtn" data-delmsg="${m.id}" data-sent="${m.sent?1:''}">${m.sent?'Apagar':'Cancelar'}</button></div><p class="m-msg-body">${esc(m.body)}</p>${open?'<div class="m-reps">'+m.replies.map(r=>`<div class="m-rep"><b>${esc(r.from)}</b> <small class="m-muted">${dtl(r.created_at)}</small><p>${esc(r.body)}</p></div>`).join('')+'</div>':''}</div>`}).join(''):'<p class="m-muted">Nenhuma mensagem ainda.</p>';
 document.querySelectorAll('[data-reps]').forEach(b=>b.onclick=()=>{const id=b.dataset.reps;openRep.has(id)?openRep.delete(id):openRep.add(id);renderMsgs(MSGS)});
 document.querySelectorAll('[data-delmsg]').forEach(b=>b.onclick=async()=>{if(!confirm(b.dataset.sent?'Apagar esta mensagem? Ela some também da tela dos clientes que ainda não fecharam.':'Cancelar esta mensagem agendada?'))return;try{await api('master/messages?id='+encodeURIComponent(b.dataset.delmsg),{method:'DELETE'});await loadMsgs()}catch(x){alert(x.message)}});
}
let MSGS=[];
async function loadMsgs(){try{MSGS=(await api('master/messages')).messages;renderMsgs(MSGS)}catch{}}
loadMsgs();setInterval(loadMsgs,20000);

$('#q').oninput=render;
$('#trashBtn').onclick=()=>{TRASHV=!TRASHV;openRows.clear();render()};
$('#logout').onclick=async()=>{await api('auth/logout',{method:'POST'});location.href='/'};load();
