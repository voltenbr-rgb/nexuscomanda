/* Nexus Comanda — módulos do painel do lojista: Pedidos (fila em tempo real), Cardápio, Mesas e equipe, Links e operação.
   Carregado ANTES do app.js do painel: as funções cmPedidos/cmCardapio/cmMesas/cmLinks entram no menu (NAV).
   Usa em tempo de execução: LOJA, toast, go (do app.js). Todas as chamadas levam ?loja=N (o servidor confere o limite do plano). */
const CMP=(()=>{
 const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];
 const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const brl=c=>(Number(c||0)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const reais=v=>Math.round((parseFloat(String(v||'0').replace(/\./g,'').replace(',','.'))||0)*100);
 const fmtR=c=>(Number(c||0)/100).toFixed(2).replace('.',',');
 const L=()=>typeof LOJA!=='undefined'?LOJA:1;
 async function api(url,opt={}){
  const u=url+(url.includes('?')?'&':'?')+'loja='+L();
  const r=await fetch(u,{credentials:'same-origin',cache:'no-store',...opt,headers:{'content-type':'application/json'},body:opt.body&&JSON.stringify({loja:L(),...opt.body})});
  const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Falha na comunicação com o servidor.');return j;
 }
 const aviso=(m,err)=>{try{toast(m,err)}catch{alert(m)}};
 const view=()=>q('#view');
 const modal=(html,cls='')=>{const m=q('#modal');m.hidden=false;m.innerHTML=`<div class="card cmp ${cls}">${html}</div>`;m.onclick=ev=>{if(ev.target===m||ev.target.closest('[data-x]'))fechar()};return m.firstChild};
 const fechar=()=>{const m=q('#modal');m.hidden=true;m.innerHTML='';m.onclick=null};
 const SIT={novo:'Novo',preparo:'Em preparo',pronto:'Pronto para servir',saiu:'Saiu para entrega',entregue:'Entregue',concluido:'Concluído',cancelado:'Cancelado',aberto:'Aberta'};
 const pill=(s,c)=>`<span class="cm-pill st-${e(s)}">${e(s==='pronto'&&c&&c.tipo==='delivery'?'Pronto p/ entrega':s==='pronto'&&c&&c.tipo==='retirada'?'Pronto p/ retirar':SIT[s]||s)}</span>`;
 const PAG={dinheiro:'💵 Dinheiro',pix:'⚡ Pix',credito:'💳 Crédito',debito:'💳 Débito',vale:'🎫 Vale'};
 const TIPO={mesa:'🍽️ Salão',delivery:'🛵 Delivery',retirada:'🛍️ Retirada',balcao:'🧍 Balcão'};
 const nomeC=c=>c.tipo==='mesa'?'Mesa '+(c.mesa_label||''):(c.cliente_nome||TIPO[c.tipo].slice(3));
 const desde=ms=>{const m=Math.max(0,Math.floor((Date.now()-ms)/60000));return m<1?'agora':m<60?`${m} min`:`${Math.floor(m/60)}h${String(m%60).padStart(2,'0')}`};
 const num=c=>c.itens[0]?.pedido_numero?'#'+c.itens[0].pedido_numero:'';
 let ac;const beep=(n=2)=>{try{ac=ac||new AudioContext();ac.resume();for(let i=0;i<n;i++){const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=i%2?1320:880;g.gain.setValueAtTime(.0001,ac.currentTime+i*.22);g.gain.exponentialRampToValueAtTime(.35,ac.currentTime+i*.22+.02);g.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+i*.22+.2);o.connect(g).connect(ac.destination);o.start(ac.currentTime+i*.22);o.stop(ac.currentTime+i*.22+.22)}}catch{}};
 const emoji=n=>{const s=String(n||'').toLowerCase();return /pizza/.test(s)?'🍕':/sushi|temaki|hot|combinad/.test(s)?'🍣':/burger|x-|lanche/.test(s)?'🍔':/batata|porç/.test(s)?'🍟':/suco|refri|água|lata|bebida|milk/.test(s)?'🥤':/cerveja|chopp|drink|caipi|saquê/.test(s)?'🍺':/doce|sobremesa|petit|sorvete/.test(s)?'🍨':'🍽️'};
 // Foto do produto: reduz no navegador (máx. 800 px, WebP/JPEG) para caber no banco e carregar rápido no cardápio.
 const reduzir=(file,max=800,qual=.8)=>new Promise((ok,err)=>{const fr=new FileReader();fr.onerror=err;fr.onload=()=>{const im=new Image();im.onerror=()=>err(Error('Imagem inválida'));im.onload=()=>{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);let d=c.toDataURL('image/webp',qual);if(!d.startsWith('data:image/webp'))d=c.toDataURL('image/jpeg',qual);if(d.length>440000)d=c.toDataURL('image/jpeg',.6);ok(d)};im.src=fr.result};fr.readAsDataURL(file)});
 const imprimir=html=>{let p=q('#prt');if(!p){p=document.createElement('div');p.id='prt';document.body.append(p)}p.innerHTML=html;setTimeout(()=>print(),30)};

 /* ===================== PEDIDOS ===================== */
 let P={lista:[],marca:0,filtro:'todos',timer:null,vistos:null,som:true};
 try{P.som=localStorage.getItem('cm_painel_som')!=='0'}catch{}
 async function pedidos(){
  view().innerHTML=`<div class="cmp cmp-ped" id=cmpPed><div class=cmp-hd><div><h2>Pedidos</h2><p class=mu id=cmpSub>Atualiza sozinho a cada poucos segundos.</p></div><div class=cmp-hda><button class="cmp-ic ${P.som?'on':''}" id=cmpSom title="Aviso sonoro de pedido novo">${P.som?'🔔':'🔕'}</button><button class="cmp-b" id=cmpNovo>+ Novo pedido</button></div></div>
   <div class=cmp-kpis id=cmpK></div>
   <div class=cmp-sec><div class=cmp-sech><h3>Fila de pedidos</h3><div class=cmp-seg id=cmpF>${[['todos','Todos'],['mesa','Salão'],['delivery','Delivery'],['retirada','Retirada'],['balcao','Balcão']].map(([k,t])=>`<button data-f=${k} class="${P.filtro===k?'on':''}">${t}<small data-n=${k}></small></button>`).join('')}</div></div><div class=cmp-line id=cmpLine></div></div>
   <div class=cmp-board id=cmpBoard></div></div>`;
  q('#cmpSom').onclick=ev=>{P.som=!P.som;try{localStorage.setItem('cm_painel_som',P.som?'1':'0')}catch{}if(P.som)beep(1);ev.currentTarget.classList.toggle('on',P.som);ev.currentTarget.textContent=P.som?'🔔':'🔕'};
  q('#cmpNovo').onclick=novoPedido;
  q('#cmpF').onclick=ev=>{const b=ev.target.closest('[data-f]');if(!b)return;P.filtro=b.dataset.f;qa('#cmpF button').forEach(x=>x.classList.toggle('on',x===b));desenharPed()};
  P.marca=0;desenharPed();await atualizarPed();
  clearInterval(P.timer);P.timer=setInterval(()=>{if(!q('#cmpPed')){clearInterval(P.timer);return}if(!document.hidden)atualizarPed()},4000);
 }
 async function atualizarPed(forcar){
  let r;try{r=await api('/api/comanda/pedidos'+(P.marca&&!forcar?'?since='+P.marca:''))}catch(x){const s=q('#cmpSub');if(s)s.textContent='⚠ '+x.message;return}
  const s=q('#cmpSub');if(s)s.textContent='Atualizado às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  if(r.igual)return;P.marca=r.marca;P.lista=r.comandas;
  const ids=new Set(r.comandas.map(c=>c.id));
  if(P.vistos){const novos=r.comandas.filter(c=>!P.vistos.has(c.id)&&c.status==='aberta');if(novos.length&&P.som)beep(novos.some(c=>c.tipo==='delivery'||c.tipo==='retirada')?4:2);if(novos.length)aviso(novos.length>1?`${novos.length} pedidos novos`:`Novo pedido: ${nomeC(novos[0])}`)}
  P.vistos=new Set([...(P.vistos||[]),...ids]);
  desenharPed();
  const m=q('#modal .cmp-det');if(m){const c=P.lista.find(x=>x.id===m.dataset.id);if(c)detalhe(c.id,true)}
 }
 function desenharPed(){
  if(!q('#cmpPed'))return;
  const all=P.lista,abertas=all.filter(c=>c.status==='aberta'),fech=all.filter(c=>c.status==='fechada');
  const vendas=fech.reduce((s,c)=>s+c.total_cents,0);
  q('#cmpK').innerHTML=[['Vendas hoje',brl(vendas),'lime'],['Contas fechadas',fech.length],['Ticket médio',brl(fech.length?vendas/fech.length:0)],['Em aberto',abertas.length+' · '+brl(abertas.reduce((s,c)=>s+c.total_cents,0)),'dark']].map(([a,b,c])=>`<div class="cmp-kpi ${c||''}"><small>${a}</small><b>${b}</b></div>`).join('');
  const f=P.filtro,vis=all.filter(c=>f==='todos'||c.tipo===f);
  qa('#cmpF [data-n]').forEach(x=>{const k=x.dataset.n,n=abertas.filter(c=>k==='todos'||c.tipo===k).length;x.textContent=n||''});
  const ab=vis.filter(c=>c.status==='aberta');
  q('#cmpLine').innerHTML=ab.length?ab.map(c=>`<button class=cmp-oc data-c="${e(c.id)}"><div class=t><b>${e(nomeC(c))}</b><small>${num(c)}</small></div><small class=mu>${c.itens.filter(i=>i.status!=='cancelado').reduce((s,i)=>s+i.qtd,0)} itens · ${desde(c.aberta_em)}</small><div class=t><span class=cmp-tag>${c.tipo==="mesa"?"🍽️ Salão":TIPO[c.tipo]}</span>${pill(c.situacao,c)}</div></button>`).join(''):`<p class=mu style="padding:8px 4px">Nenhum pedido em aberto${f!=='todos'?' neste filtro':''}.</p>`;
  const col=(t,ls,cls)=>`<div class="cmp-col ${cls}"><h4>${t} <small>${ls.length}</small></h4>${ls.map(c=>`<button class=cmp-card data-c="${e(c.id)}"><div class=t><b>${e(nomeC(c))}</b><span class=mu>${num(c)} · ${desde(c.aberta_em)}</span></div><div class=its>${c.itens.filter(i=>i.status!=='cancelado').slice(0,4).map(i=>`<span>${i.qtd}× ${e(i.nome)}</span>`).join('')}${c.itens.length>4?`<span class=mu>+${c.itens.length-4}…</span>`:''}</div><div class=t><span class=cmp-tag>${TIPO[c.tipo]}</span><b class=num>${brl(c.total_cents)}</b></div>${c.tipo==='delivery'&&c.status==='aberta'&&c.etapa!=='saiu'&&['pronto','entregue'].includes(c.situacao)?`<span class="cmp-b sm saiu" role=button data-saiu="${e(c.id)}">🛵 Saiu para entrega</span>`:c.tipo==='delivery'&&c.etapa==='saiu'&&c.status==='aberta'?`<span class="cmp-b sm ghost" role=button data-c="${e(c.id)}">Entregue? Concluir e receber</span>`:''}</button>`).join('')||'<p class=mu style="margin:6px 2px">—</p>'}</div>`;
  q('#cmpBoard').innerHTML=col('Novos',ab.filter(c=>['novo','aberto'].includes(c.situacao)),'c-novo')+col('Em preparo',ab.filter(c=>c.situacao==='preparo'),'c-prep')+col('Prontos / entrega',ab.filter(c=>['pronto','saiu','entregue'].includes(c.situacao)),'c-pronto')+col('Encerrados hoje',vis.filter(c=>c.status!=='aberta').slice(0,30),'c-fim');
  q('#cmpPed').onclick=async ev=>{const sa=ev.target.closest('[data-saiu]');if(sa){ev.stopPropagation();try{await acao({action:'etapa',comanda_id:sa.dataset.saiu,etapa:'saiu'});aviso('🛵 Saiu para entrega — o cliente já vê no acompanhamento.')}catch(x){aviso(x.message,1)}return}const b=ev.target.closest('[data-c]');if(b)detalhe(b.dataset.c)};
 }
 async function acao(body){const r=await api('/api/comanda/pedidos',{method:'POST',body});if(r.comanda){const i=P.lista.findIndex(x=>x.id===r.comanda.id);if(i>=0)P.lista[i]=r.comanda;else P.lista.unshift(r.comanda)}P.marca=0;desenharPed();return r}
 function detalhe(id,silencioso){
  const c=P.lista.find(x=>x.id===id);if(!c)return;
  const ab=c.status==='aberta',ent=c.tipo==='delivery'||c.tipo==='retirada';
  const envios={};c.itens.forEach(i=>{(envios[i.pedido_id]||={n:i.pedido_numero,t:i.criado_em,it:[]}).it.push(i)});
  const sc=q('#modal .cmp-det')?.scrollTop||0;
  const m=modal(`<div class=cmp-det data-id="${e(c.id)}"><div class=cmp-mh><div><small class=mu>${TIPO[c.tipo]} ${num(c)}</small><h3>${e(nomeC(c))}</h3></div>${pill(c.situacao,c)}</div>
   ${c.cliente_fone||c.endereco||c.obs?`<div class=cmp-info>${c.cliente_fone?`<a href="https://wa.me/55${e(c.cliente_fone.replace(/^55/,''))}" target=_blank rel=noopener>📱 ${e(c.cliente_fone)}</a>`:''}${c.endereco?`<span>📍 ${e(c.endereco)}</span>`:''}${c.obs?`<span>📝 ${e(c.obs)}</span>`:''}${c.pagamento&&ab?`<span>Pagamento previsto: ${PAG[c.pagamento]||c.pagamento}${c.troco_para_cents?` · troco para ${brl(c.troco_para_cents)}`:''}</span>`:''}</div>`:''}
   ${c.tipo==='mesa'&&ab&&c.mesa_codigo?`<div class=cmp-info style="background:#eefbc4;color:#15161a"><span>📱 Senha da mesa para o cliente: <b style="font-size:18px;letter-spacing:.1em">${e(c.mesa_codigo)}</b></span></div>`:''}<small class=mu>Aberto por ${e(c.aberta_por||'')} · ${new Date(c.aberta_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${c.fechada_em?` · encerrado ${new Date(c.fechada_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${c.fechada_por?' por '+e(c.fechada_por):''}`:''}</small>
   ${Object.values(envios).map(v=>`<div class=cmp-env><small class=mu>Pedido #${v.n} · ${desde(v.t)}${v.it[0]?.origem==='mesa_cliente'?' · 📱 feito pelo cliente':''}</small>${v.it.map(i=>`<div class="cmp-it ${i.status==='cancelado'?'cx':''}"><b>${i.qtd}×</b><span>${e(i.nome)}${i.obs?`<small>📝 ${e(i.obs)}</small>`:''}<small class=mu>${i.setor==='bar'?'🍹 Bar':i.setor==='nenhum'?'Sem preparo':'🍳 Cozinha'} · ${brl(i.qtd*i.preco_cents)}</small></span>${pill(i.status)}${ab&&i.status==='pronto'?`<button class="cmp-b sm lime" data-it="${e(i.id)}" data-s=entregue>Entregue</button>`:''}${ab&&!['cancelado','entregue'].includes(i.status)?`<button class="cmp-ic sm" data-it="${e(i.id)}" data-s=cancelado title="Cancelar item">✕</button>`:''}</div>`).join('')}</div>`).join('')||'<p class=mu>Sem itens.</p>'}
   <div class=cmp-tot><div><span>Subtotal</span><b>${brl(c.subtotal_cents)}</b></div>${c.taxa_cents?`<div><span>Entrega</span><b>${brl(c.taxa_cents)}</b></div>`:''}${c.servico_cents?`<div><span>Serviço</span><b>${brl(c.servico_cents)}</b></div>`:''}${c.desconto_cents?`<div><span>Desconto</span><b>− ${brl(c.desconto_cents)}</b></div>`:''}<div class=g><span>Total</span><b>${brl(c.total_cents)}</b></div>${!ab&&c.pagamento?`<div><span>Pago em</span><b>${PAG[c.pagamento]||c.pagamento}</b></div>`:''}</div>
   ${ab&&c.tipo==='delivery'&&c.etapa!=='saiu'?`<button class="cmp-b blk saiu" data-et=saiu>🛵 Saiu para entrega</button>`:''}${ab&&c.tipo==='delivery'&&c.etapa==='saiu'?`<div class=cmp-info style="background:#ffe9c7;color:#8a4b00"><span>🛵 <b>Saiu para entrega</b> — o cliente está vendo isso no acompanhamento. Ao entregar, clique em “Concluir e receber”.</span></div>`:''}
   ${ab?`${ent?`<div class=cmp-et><small class=mu>Etapa do pedido</small><div class=cmp-seg>${[['preparo','Em preparo'],['pronto',c.tipo==='delivery'?'Pronto':'Pronto p/ retirar'],...(c.tipo==='delivery'?[['saiu','Saiu p/ entrega']]:[])].map(([k,t])=>`<button data-et=${k} class="${c.etapa===k?'on':''}">${t}</button>`).join('')}</div></div>`:''}
    <div class=cmp-acts><button class="cmp-b ghost" data-a=add>+ Itens</button><button class="cmp-b ghost" data-a=prt>🖨️ Cupom</button><button class="cmp-b ghost danger" data-a=cancel>Cancelar</button><button class="cmp-b" data-a=fechar ${c.itens.some(i=>i.status!=='cancelado')?'':'disabled'}>${ent?'Concluir e receber':'Fechar conta'}</button></div>`
   :`<div class=cmp-acts><button class="cmp-b ghost" data-a=prt>🖨️ Imprimir cupom</button></div>`}</div>`,'cmp-wide');
  m.querySelector('.cmp-det').scrollTop=sc;
  m.onclick=async ev=>{
   const it=ev.target.closest('[data-it]'),et=ev.target.closest('[data-et]'),a=ev.target.closest('[data-a]')?.dataset.a;
   try{
    if(it){const i=c.itens.find(x=>x.id===it.dataset.it);if(it.dataset.s==='cancelado'&&!confirm(`Cancelar ${i.qtd}× ${i.nome}?`))return;await acao({action:'item_status',comanda_id:c.id,item_id:i.id,status:it.dataset.s});detalhe(c.id)}
    else if(et){await acao({action:'etapa',comanda_id:c.id,etapa:et.dataset.et});detalhe(c.id)}
    else if(a==='add')seletor(c.id);
    else if(a==='prt')cupom(c);
    else if(a==='cancel'){const mo=prompt('Cancelar este pedido inteiro? Escreva o motivo (opcional):');if(mo===null)return;await acao({action:'cancelar',comanda_id:c.id,motivo:mo});fechar();aviso('Pedido cancelado.')}
    else if(a==='fechar')receber(c.id);
   }catch(x){aviso(x.message,1)}
  };
 }
 async function receber(id){
  const c=P.lista.find(x=>x.id===id);const cfg=(await api('/api/comanda/config')).config;
  let pag=cfg.pagamentos.includes(c.pagamento)?c.pagamento:cfg.pagamentos[0],serv=c.tipo==='mesa'&&cfg.servico_pct>0,desc=0;
  const sv=()=>serv?Math.round(c.subtotal_cents*cfg.servico_pct/100):0,tot=()=>Math.max(0,c.subtotal_cents+c.taxa_cents+sv()-desc);
  const m=modal(`<div class=cmp-mh><h3>${c.tipo==='mesa'||c.tipo==='balcao'?'Fechar conta':'Concluir pedido'} · ${e(nomeC(c))}</h3></div>
   <div class=cmp-tot><div><span>Subtotal</span><b>${brl(c.subtotal_cents)}</b></div>${c.taxa_cents?`<div><span>Entrega</span><b>${brl(c.taxa_cents)}</b></div>`:''}${cfg.servico_pct?`<div><label style="display:flex;gap:8px;align-items:center;margin:0"><input type=checkbox id=sv ${serv?'checked':''} style="width:auto"> Serviço (${cfg.servico_pct}%)</label><b id=svv>${brl(sv())}</b></div>`:''}<div><span>Desconto (R$)</span><input id=ds inputmode=decimal placeholder="0,00" style="width:120px;text-align:right"></div><div class=g><span>Total</span><b id=tt>${brl(tot())}</b></div></div>
   <small class=mu>Forma de pagamento</small><div class=cmp-pay id=pg>${cfg.pagamentos.map(p=>`<button data-p=${p} class="${p===pag?'on':''}">${PAG[p]}</button>`).join('')}</div>
   <button class="cmp-b blk" id=ok>Confirmar recebimento</button><small class=mu>O valor entra automaticamente no Caixa e no Financeiro desta loja.</small>`);
  const up=()=>{q('#tt',m).textContent=brl(tot());const s=q('#svv',m);if(s)s.textContent=brl(sv())};
  q('#sv',m)&&(q('#sv',m).onchange=ev=>{serv=ev.target.checked;up()});
  q('#ds',m).oninput=ev=>{desc=reais(ev.target.value);up()};
  q('#pg',m).onclick=ev=>{const b=ev.target.closest('[data-p]');if(!b)return;pag=b.dataset.p;qa('#pg button',m).forEach(x=>x.classList.toggle('on',x===b))};
  q('#ok',m).onclick=async ev=>{ev.target.disabled=true;try{await acao({action:'fechar',comanda_id:c.id,pagamento:pag,servico_cents:sv(),desconto_cents:desc});fechar();aviso('Recebido: '+brl(tot()));try{typeof sync==='function'&&sync(true)}catch{}}catch(x){aviso(x.message,1);ev.target.disabled=false}};
 }
 function cupom(c){
  const ag={};c.itens.filter(i=>i.status!=='cancelado').forEach(i=>{const k=i.nome+'|'+i.preco_cents;(ag[k]||={n:i.nome,p:i.preco_cents,q:0}).q+=i.qtd});
  const nm=q('#lojatag')?.textContent.replace('🏪 ','')||document.title.replace('Gestão - ','');
  imprimir(`<h1>${e(nm)}</h1><h2>${e(nomeC(c))} ${num(c)}</h2><div class=c>${new Date().toLocaleString('pt-BR')}</div>${c.endereco?`<div>${e(c.endereco)}</div>`:''}${c.cliente_fone?`<div>Tel: ${e(c.cliente_fone)}</div>`:''}<div class=ln></div>
   ${Object.values(ag).map(x=>`<div class=r><span>${x.q}x ${e(x.n)}</span><span>${fmtR(x.q*x.p)}</span></div>`).join('')}<div class=ln></div>
   <div class=r><span>Subtotal</span><span>${fmtR(c.subtotal_cents)}</span></div>${c.taxa_cents?`<div class=r><span>Entrega</span><span>${fmtR(c.taxa_cents)}</span></div>`:''}${c.servico_cents?`<div class=r><span>Serviço</span><span>${fmtR(c.servico_cents)}</span></div>`:''}${c.desconto_cents?`<div class=r><span>Desconto</span><span>-${fmtR(c.desconto_cents)}</span></div>`:''}
   <div class="r i"><span>TOTAL</span><span>R$ ${fmtR(c.total_cents)}</span></div>${c.pagamento?`<div>Pagamento: ${e((PAG[c.pagamento]||'').replace(/^\S+ /,''))}${c.troco_para_cents?` (troco p/ ${fmtR(c.troco_para_cents)})`:''}</div>`:''}<div class=ln></div><div class=c>Não é documento fiscal</div>`);
 }
 // Novo pedido pelo painel: mesa, balcão, retirada ou delivery (por telefone).
 async function novoPedido(){
  const [ms,cfg]=await Promise.all([api('/api/comanda/mesas'),api('/api/comanda/config')]).then(([a,b])=>[a.mesas.filter(x=>x.ativo),b.config]).catch(x=>{aviso(x.message,1);return [null]});if(!ms)return;
  let tipo='mesa';
  const m=modal(`<div class=cmp-mh><h3>Novo pedido</h3></div><div class=cmp-seg id=tp>${Object.entries(TIPO).map(([k,t])=>`<button data-t=${k} class="${k===tipo?'on':''}">${t}</button>`).join('')}</div><div id=fx style="margin-top:12px"></div>`);
  const fx=()=>{q('#fx',m).innerHTML=tipo==='mesa'?`<div class=cmp-mesas>${ms.map(x=>`<button data-m="${e(x.id)}" class="${x.comanda_id?'oc':''}"><b>${e(x.numero)}</b><small>${x.comanda_id?'ocupada':'livre'}</small></button>`).join('')||'<p class=mu>Cadastre mesas em “Mesas e equipe”.</p>'}</div>`
   :`<label>Nome do cliente<input id=nm maxlength=60></label>${tipo!=='balcao'?`<label>Telefone<input id=fn inputmode=tel maxlength=20></label>`:''}${tipo==='delivery'?`<label>Endereço<textarea id=en maxlength=200 rows=2></textarea></label><label>Taxa de entrega (R$)<input id=tx inputmode=decimal value="${fmtR(cfg.taxa_entrega_cents)}"></label>`:''}<button class="cmp-b blk" id=ok>Escolher itens</button>`;
   const ok=q('#ok',m);if(ok)ok.onclick=()=>{const nm=q('#nm',m).value.trim();if(!nm)return aviso('Informe o nome do cliente.',1);seletor(null,{tipo,cliente_nome:nm,cliente_fone:q('#fn',m)?.value||'',endereco:q('#en',m)?.value||'',taxa_cents:q('#tx',m)?reais(q('#tx',m).value):0})};
  };fx();
  q('#tp',m).onclick=ev=>{const b=ev.target.closest('[data-t]');if(!b)return;tipo=b.dataset.t;qa('#tp button',m).forEach(x=>x.classList.toggle('on',x===b));fx()};
  q('#fx',m).addEventListener('click',ev=>{const b=ev.target.closest('[data-m]');if(!b)return;const x=ms.find(y=>y.id===b.dataset.m);if(x.comanda_id){fechar();detalhe(x.comanda_id)}else seletor(null,{tipo:'mesa',mesa_id:x.id,rotulo:'Mesa '+x.numero})});
 }
 // Seletor de itens (lança na comanda existente ou cria a comanda no primeiro envio).
 async function seletor(cid,nova){
  let cat;try{cat=await api('/api/comanda/catalogo')}catch(x){return aviso(x.message,1)}
  const ps=cat.produtos.filter(p=>p.ativo),sel={};let ct='',bq='';
  const c=cid&&P.lista.find(x=>x.id===cid),tit=c?nomeC(c):nova.rotulo||nova.cliente_nome;
  const m=modal(`<div class=cmp-mh><h3>Itens · ${e(tit)}</h3></div><input id=bq placeholder="🔎 Buscar"><div class=cmp-chips id=ct><button data-c="" class=on>Tudo</button>${cat.categorias.map(k=>`<button data-c="${e(k.id)}">${e(k.icone||'')} ${e(k.nome)}</button>`).join('')}</div><div class=cmp-pk id=pl></div><button class="cmp-b blk" id=env disabled>Enviar</button>`,'cmp-wide');
  const tot=()=>Object.entries(sel).reduce((s,[id,x])=>s+ps.find(p=>p.id===id).preco_cents*x,0),n=()=>Object.values(sel).reduce((s,x)=>s+x,0);
  const draw=()=>{const t=bq.toLowerCase();q('#pl',m).innerHTML=ps.filter(p=>(!ct||p.categoria_id===ct)&&(!t||p.nome.toLowerCase().includes(t))).map(p=>`<div class="${sel[p.id]?'on':''}" data-p="${e(p.id)}"><span class=ph>${p.foto?`<img src="${p.foto}" alt="">`:emoji(p.nome)}</span><span><b>${e(p.nome)}</b><small class=mu>${brl(p.preco_cents)} · ${p.setor==='bar'?'Bar':p.setor==='nenhum'?'Sem preparo':'Cozinha'}</small></span><span class=cmp-stp>${sel[p.id]?`<button data-d=-1>−</button><b>${sel[p.id]}</b>`:''}<button data-d=1>+</button></span></div>`).join('')||'<p class=mu>Nada encontrado.</p>';
   const b=q('#env',m),k=n();b.disabled=!k;b.textContent=k?`Enviar ${k} ${k>1?'itens':'item'} · ${brl(tot())}`:'Enviar'};
  draw();
  q('#bq',m).oninput=ev=>{bq=ev.target.value;draw()};
  q('#ct',m).onclick=ev=>{const b=ev.target.closest('[data-c]');if(!b)return;ct=b.dataset.c;qa('#ct button',m).forEach(x=>x.classList.toggle('on',x===b));draw()};
  q('#pl',m).onclick=ev=>{const r=ev.target.closest('[data-p]');if(!r)return;const d=Number(ev.target.closest('[data-d]')?.dataset.d||1);sel[r.dataset.p]=Math.max(0,(sel[r.dataset.p]||0)+d);if(!sel[r.dataset.p])delete sel[r.dataset.p];draw()};
  q('#env',m).onclick=async ev=>{ev.target.disabled=true;try{let id=cid;if(!id){const a=await acao({action:'abrir',...nova});id=a.comanda.id}const r=await acao({action:'lancar',comanda_id:id,itens:Object.entries(sel).map(([produto_id,qtd])=>({produto_id,qtd}))});aviso(`Pedido #${r.numero} enviado para a produção`);detalhe(id)}catch(x){aviso(x.message,1);ev.target.disabled=false}};
 }

 /* ===================== CARDÁPIO ===================== */
 let K={categorias:[],produtos:[]},kCat='';
 async function cardapio(){
  view().innerHTML=`<div class=cmp id=cmpCar><div class=cmp-hd><div><h2>Cardápio</h2><p class=mu>Cada produto tem um <b>destino de preparo</b>: o pedido aparece só na tela da Cozinha ou só na do Bar.</p></div><div class=cmp-hda><button class="cmp-b ghost" id=nc>+ Categoria</button><button class=cmp-b id=np>+ Produto</button></div></div><div id=cmpCarB><p class=mu>Carregando…</p></div></div>`;
  q('#nc').onclick=()=>editCat();q('#np').onclick=()=>editProd();
  try{K=await api('/api/comanda/catalogo')}catch(x){q('#cmpCarB').innerHTML=`<p class=mu>${e(x.message)}</p>`;return}
  desenharCar();
 }
 function desenharCar(){
  const B=q('#cmpCarB');if(!B)return;
  if(!K.categorias.length&&!K.produtos.length){B.innerHTML=`<div class="cmp-empty"><h3>Seu cardápio está vazio</h3><p class=mu>Comece com um modelo pronto (dá para editar tudo depois) ou cadastre do zero.</p><div class=cmp-mods>${[['restaurante','🍽️ Restaurante'],['pizzaria','🍕 Pizzaria'],['lanchonete','🍔 Lanchonete'],['sushi','🍣 Sushi']].map(([k,t])=>`<button class="cmp-b ghost" data-mod=${k}>${t}</button>`).join('')}</div></div>`;
   B.onclick=async ev=>{const b=ev.target.closest('[data-mod]');if(!b)return;try{await api('/api/comanda/catalogo',{method:'POST',body:{action:'modelo',modelo:b.dataset.mod}});aviso('Cardápio modelo criado. Agora é só ajustar preços e fotos.');cardapio()}catch(x){aviso(x.message,1)}};return}
  const cnt=id=>K.produtos.filter(p=>p.categoria_id===id).length;
  const ps=K.produtos.filter(p=>!kCat||p.categoria_id===kCat||(kCat==='_'&&!p.categoria_id));
  B.innerHTML=`<div class=cmp-cats>${[{id:'',nome:'Todos',icone:'✨'},...K.categorias].map(c=>`<div class="cmp-cat ${kCat===c.id?'on':''} ${c.ativo===0?'off':''}" data-cat="${e(c.id)}"><i>${e(c.icone||'🍽️')}</i><span><b>${e(c.nome)}</b><small>${c.id?cnt(c.id):K.produtos.length} itens</small></span>${c.id?`<button class=cmp-ic data-ec="${e(c.id)}" title="Editar categoria">✎</button>`:''}</div>`).join('')}</div>
   <div class=cmp-prods>${ps.map(p=>{const c=K.categorias.find(k=>k.id===p.categoria_id);return `<div class="cmp-prod ${p.ativo?'':'off'}" data-p="${e(p.id)}"><div class=ph>${p.foto?`<img src="${p.foto}" alt="">`:emoji((c?.nome||'')+' '+p.nome)}</div><div class=bd><small class=mu>${e(c?.nome||'Sem categoria')}${p.ativo?'':' · <b style="color:#b42323">Indisponível</b>'}</small><b>${e(p.nome)}</b>${p.descricao?`<small class=mu>${e(p.descricao)}</small>`:''}<div class=ft><b class=num>${brl(p.preco_cents)}</b><span class="cmp-set s-${p.setor}">${p.setor==='bar'?'🍹 Bar':p.setor==='nenhum'?'✋ Sem preparo':'🍳 Cozinha'}</span></div></div><label class=cmp-sw title="${p.ativo?'Disponível':'Indisponível no momento (continua visível, sem poder pedir)'}"><input type=checkbox data-on="${e(p.id)}" ${p.ativo?'checked':''}><i></i></label></div>`}).join('')||'<p class=mu>Nenhum produto nesta categoria.</p>'}</div>`;
  B.onclick=async ev=>{
   const on=ev.target.closest('[data-on]');if(on){try{await api('/api/comanda/catalogo',{method:'POST',body:{action:'ativo_produto',id:on.dataset.on,ativo:on.checked}});K.produtos.find(p=>p.id===on.dataset.on).ativo=on.checked?1:0;desenharCar();aviso(on.checked?'Produto disponível no cardápio':'Produto aparece como “Indisponível no momento” no cardápio e no garçom')}catch(x){aviso(x.message,1)}return}
   if(ev.target.closest('.cmp-sw'))return;
   const ec=ev.target.closest('[data-ec]');if(ec)return editCat(ec.dataset.ec);
   const ca=ev.target.closest('[data-cat]');if(ca){kCat=ca.dataset.cat;desenharCar();return}
   const p=ev.target.closest('[data-p]');if(p)editProd(p.dataset.p);
  };
 }
 function editCat(id){
  const c=K.categorias.find(x=>x.id===id)||{nome:'',icone:'🍽️',ordem:K.categorias.length,ativo:1};
  const ICS=['🍽️','🍕','🍔','🍟','🍣','🥗','🍝','🥩','🍗','🌮','🥪','🍜','🥤','🍹','🍺','🍷','☕','🍨','🍰','🍫','🥐','🍤','🌯','✨'];
  const m=modal(`<div class=cmp-mh><h3>${id?'Editar':'Nova'} categoria</h3></div><label>Nome<input id=nm maxlength=40 value="${e(c.nome)}" placeholder="Ex.: Bebidas"></label><small class=mu>Ícone</small><div class=cmp-icons id=ic>${ICS.map(i=>`<button class="${i===c.icone?'on':''}">${i}</button>`).join('')}</div><div class=row2><label>Ordem<input id=or type=number min=0 value="${c.ordem||0}"></label><label class=cmp-ck style="margin-top:22px"><input type=checkbox id=at ${c.ativo!==0?'checked':''} style="width:auto"> Visível no cardápio</label></div><div class=cmp-acts>${id?'<button class="cmp-b ghost danger" id=del>Excluir</button>':''}<button class=cmp-b id=ok>Salvar</button></div>`);
  let ic=c.icone;q('#ic',m).onclick=ev=>{const b=ev.target.closest('button');if(!b)return;ic=b.textContent;qa('#ic button',m).forEach(x=>x.classList.toggle('on',x===b))};
  q('#ok',m).onclick=async()=>{try{await api('/api/comanda/catalogo',{method:'POST',body:{action:'salvar_categoria',id,nome:q('#nm',m).value,icone:ic,ordem:q('#or',m).value,ativo:q('#at',m).checked}});fechar();cardapio()}catch(x){aviso(x.message,1)}};
  q('#del',m)&&(q('#del',m).onclick=async()=>{if(!confirm('Excluir esta categoria?'))return;try{await api('/api/comanda/catalogo',{method:'POST',body:{action:'excluir_categoria',id}});kCat='';fechar();cardapio()}catch(x){aviso(x.message,1)}});
 }
 function editProd(id){
  const p=K.produtos.find(x=>x.id===id)||{nome:'',descricao:'',preco_cents:0,categoria_id:kCat&&kCat!=='_'?kCat:(K.categorias[0]?.id||''),setor:'',ativo:1,destaque:0,ordem:0};
  let foto,setor=p.setor;
  const m=modal(`<div class=cmp-mh><h3>${id?'Editar':'Novo'} produto</h3></div>
   <div class=cmp-fotoed><label class=ph id=fph>${p.foto?`<img src="${p.foto}" alt="">`:'<span>📷<br><small>Adicionar foto</small></span>'}<input type=file accept="image/*" id=ff hidden></label><div style="flex:1;display:grid;gap:8px"><label>Nome<input id=nm maxlength=60 value="${e(p.nome)}" placeholder="Ex.: X-Bacon"></label><label>Preço (R$)<input id=pr inputmode=decimal value="${p.preco_cents?fmtR(p.preco_cents):''}" placeholder="0,00"></label></div></div>
   ${p.foto?'<button class="cmp-b ghost sm" id=rf type=button>Remover foto</button>':''}
   <label>Descrição<textarea id=ds maxlength=300 rows=2 placeholder="Ingredientes, tamanho, acompanhamentos…">${e(p.descricao||'')}</textarea></label>
   <label>Categoria<select id=ct><option value="">Sem categoria</option>${K.categorias.map(c=>`<option value="${e(c.id)}" ${c.id===p.categoria_id?'selected':''}>${e(c.icone||'')} ${e(c.nome)}</option>`).join('')}</select></label>
   <small class=mu><b>Destino de preparo</b> — para qual tela de produção este item vai</small>
   <div class=cmp-dest id=st>${[['cozinha','🍳','Cozinha','Pratos, porções, lanches'],['bar','🍹','Bar','Bebidas, drinks, sucos'],['nenhum','✋','Sem preparo','Já pronto (ex.: lata, sobremesa pronta)']].map(([k,i,t,d])=>`<button data-s=${k} class="${setor===k?'on':''}"><i>${i}</i><b>${t}</b><small>${d}</small></button>`).join('')}</div>
   <div class=row2><label class=cmp-ck ><input type=checkbox id=at ${p.ativo?'checked':''} style="width:auto"> Disponível</label><label class=cmp-ck ><input type=checkbox id=dq ${p.destaque?'checked':''} style="width:auto"> ★ Destaque no cardápio</label></div>
   <div class=cmp-acts>${id?'<button class="cmp-b ghost danger" id=del>Excluir</button>':''}<button class=cmp-b id=ok>Salvar produto</button></div>`,'cmp-wide');
  q('#st',m).onclick=ev=>{const b=ev.target.closest('[data-s]');if(!b)return;setor=b.dataset.s;qa('#st button',m).forEach(x=>x.classList.toggle('on',x===b))};
  const trocaFoto=async ev=>{const f=ev.target.files[0];if(!f)return;try{foto=await reduzir(f);q('#fph',m).innerHTML=`<img src="${foto}" alt=""><input type=file accept="image/*" id=ff hidden>`;q('#ff',m).onchange=trocaFoto}catch(x){aviso('Não foi possível usar essa imagem.',1)}};
  q('#ff',m).onchange=trocaFoto;
  q('#rf',m)&&(q('#rf',m).onclick=ev=>{foto='';q('#fph',m).innerHTML='<span>📷<br><small>Adicionar foto</small></span><input type=file accept="image/*" id=ff hidden>';q('#ff',m).onchange=trocaFoto;ev.target.remove()});
  q('#ok',m).onclick=async ev=>{
   if(!setor)return aviso('Escolha o destino de preparo: Cozinha, Bar ou Sem preparo.',1);
   ev.target.disabled=true;
   try{await api('/api/comanda/catalogo',{method:'POST',body:{action:'salvar_produto',id,nome:q('#nm',m).value,preco_cents:reais(q('#pr',m).value),descricao:q('#ds',m).value,categoria_id:q('#ct',m).value,setor,ativo:q('#at',m).checked,destaque:q('#dq',m).checked,ordem:p.ordem,...(foto!==undefined?{foto}:{})}});fechar();aviso('Produto salvo');K=await api('/api/comanda/catalogo');desenharCar()}catch(x){aviso(x.message,1);ev.target.disabled=false}
  };
  q('#del',m)&&(q('#del',m).onclick=async()=>{if(!confirm('Excluir este produto?'))return;try{await api('/api/comanda/catalogo',{method:'POST',body:{action:'excluir_produto',id}});fechar();cardapio()}catch(x){aviso(x.message,1)}});
 }

 /* ===================== MESAS E EQUIPE ===================== */
 async function mesas(){
  view().innerHTML=`<div class=cmp id=cmpMes><div class=cmp-hd><div><h2>Mesas e equipe</h2><p class=mu>Mesas do salão e quem acessa o link do garçom (nome + PIN).</p></div></div><div id=cmpMesB><p class=mu>Carregando…</p></div></div>`;
  let ms,eq;try{[ms,eq]=await Promise.all([api('/api/comanda/mesas'),api('/api/comanda/equipe')])}catch(x){q('#cmpMesB').innerHTML=`<p class=mu>${e(x.message)}</p>`;return}
  const cfg=(await api('/api/comanda/config').catch(()=>({config:{}}))).config;
  q('#cmpMesB').innerHTML=`<div class=cmp-2>
   <section class=cmp-box><div class=cmp-sech><h3>🪑 Mesas <small class=mu>${ms.mesas.length}</small></h3><div style="display:flex;gap:6px"><button class="cmp-b ghost sm" id=lt>Criar várias</button><button class="cmp-b sm" id=nm>+ Mesa</button></div></div>
    <div class=cmp-mesas>${ms.mesas.map(x=>`<button data-m="${e(x.id)}" class="${x.comanda_id?'oc':''} ${x.ativo?'':'off'}"><b>${e(x.numero)}</b><small>${x.comanda_id?'ocupada':x.lugares+' lugares'}${x.codigo&&cfg.mesa_auto?' · 📱 '+e(x.codigo):''}</small></button>`).join('')||'<p class=mu>Nenhuma mesa. Use “Criar várias” para cadastrar de 1 até N.</p>'}</div></section>
   <section class=cmp-box><div class=cmp-sech><h3>🧑‍🍳 Equipe <small class=mu>${eq.equipe.length}</small></h3><button class="cmp-b sm" id=na>+ Pessoa</button></div>
    <div class=cmp-eq>${eq.equipe.map(a=>`<button data-a="${e(a.id)}" class="${a.ativo?'':'off'}"><i>${a.papel==='caixa'?'💳':'🧑‍🍳'}</i><span><b>${e(a.nome)}</b><small class=mu>${a.papel==='caixa'?'Caixa — pode fechar contas':'Garçom'}${a.ativo?'':' · desativado'}</small></span><span class=mu>✎</span></button>`).join('')||'<p class=mu>Ninguém cadastrado ainda.</p>'}</div>
    <p class=mu style="margin:12px 0 0;font-size:13px">Fechamento de conta: <b>${cfg.fechamento==='caixa'?'somente atendentes de Caixa':'qualquer garçom'}</b> · altere em “Links e operação”.</p></section></div>`;
  q('#lt').onclick=async()=>{const n=prompt('Criar mesas de 1 até:', String(Math.max(10,ms.mesas.length)));if(!n)return;try{await api('/api/comanda/mesas',{method:'POST',body:{action:'lote',ate:n}});mesas()}catch(x){aviso(x.message,1)}};
  const edM=x=>{x=x||{numero:'',lugares:4,ativo:1,ordem:ms.mesas.length+1};const m=modal(`<div class=cmp-mh><h3>${x.id?'Mesa '+e(x.numero):'Nova mesa'}</h3></div><div class=row2><label>Número / nome<input id=n maxlength=12 value="${e(x.numero)}" placeholder="Ex.: 15 ou Varanda 2"></label><label>Lugares<input id=l type=number min=1 max=50 value="${x.lugares}"></label></div><div class=row2><label>Ordem<input id=o type=number min=0 value="${x.ordem||0}"></label><label class=cmp-ck style="margin-top:22px"><input type=checkbox id=a ${x.ativo?'checked':''} style="width:auto"> Ativa</label></div>${x.id&&cfg.mesa_auto&&x.comanda_id?`<div class=cmp-tot><div><span>📱 Senha para o cliente pedir pelo celular</span><b id=cod class=num style="font-size:20px">${x.codigo?e(x.codigo):'—'}</b></div><div style="justify-content:flex-end;gap:6px"><button class="cmp-b sm ghost" id=cg>Gerar nova</button>${x.codigo?'<button class="cmp-b sm ghost danger" id=cb>Bloquear</button>':''}</div></div>`:''}<div class=cmp-acts>${x.id?'<button class="cmp-b ghost danger" id=del>Excluir</button>':''}<button class=cmp-b id=ok>Salvar</button></div>`);
   const cod=async body=>{try{const r=await api('/api/comanda/pedidos',{method:'POST',body:{action:'codigo_mesa',mesa_id:x.id,...body}});x.codigo=r.codigo;fechar();mesas();aviso(r.codigo?'Senha da mesa '+x.numero+': '+r.codigo:'Pedidos pelo celular bloqueados')}catch(y){aviso(y.message,1)}};
   q('#cg',m)&&(q('#cg',m).onclick=()=>cod({}));q('#cb',m)&&(q('#cb',m).onclick=()=>cod({desativar:true}));
   q('#ok',m).onclick=async()=>{try{await api('/api/comanda/mesas',{method:'POST',body:{action:'salvar',id:x.id,numero:q('#n',m).value,lugares:q('#l',m).value,ordem:q('#o',m).value,ativo:q('#a',m).checked}});fechar();mesas()}catch(y){aviso(y.message,1)}};
   q('#del',m)&&(q('#del',m).onclick=async()=>{if(!confirm('Excluir esta mesa?'))return;try{await api('/api/comanda/mesas',{method:'POST',body:{action:'excluir',id:x.id}});fechar();mesas()}catch(y){aviso(y.message,1)}})};
  const edA=a=>{a=a||{nome:'',papel:'garcom',ativo:1};const m=modal(`<div class=cmp-mh><h3>${a.id?'Editar':'Nova pessoa'}</h3></div><label>Nome<input id=n maxlength=40 value="${e(a.nome)}"></label><small class=mu>Função</small><div class=cmp-seg id=pp><button data-p=garcom class="${a.papel!=='caixa'?'on':''}">🧑‍🍳 Garçom</button><button data-p=caixa class="${a.papel==='caixa'?'on':''}">💳 Caixa</button></div><label style="margin-top:10px">${a.id?'Novo PIN (deixe vazio para manter)':'PIN de acesso (4 a 6 números)'}<input id=pin inputmode=numeric maxlength=6 autocomplete=off placeholder="••••"></label><label class=cmp-ck ><input type=checkbox id=at ${a.ativo?'checked':''} style="width:auto"> Acesso ativo</label><div class=cmp-acts>${a.id?'<button class="cmp-b ghost danger" id=del>Excluir</button>':''}<button class=cmp-b id=ok>Salvar</button></div>`);
   let papel=a.papel;q('#pp',m).onclick=ev=>{const b=ev.target.closest('[data-p]');if(!b)return;papel=b.dataset.p;qa('#pp button',m).forEach(x=>x.classList.toggle('on',x===b))};
   q('#pin',m).oninput=ev=>{ev.target.value=ev.target.value.replace(/\D/g,'')};
   q('#ok',m).onclick=async()=>{try{await api('/api/comanda/equipe',{method:'POST',body:{action:'salvar',id:a.id,nome:q('#n',m).value,papel,pin:q('#pin',m).value,ativo:q('#at',m).checked}});fechar();aviso('Salvo');mesas()}catch(y){aviso(y.message,1)}};
   q('#del',m)&&(q('#del',m).onclick=async()=>{if(!confirm('Excluir o acesso de '+a.nome+'?'))return;try{await api('/api/comanda/equipe',{method:'POST',body:{action:'excluir',id:a.id}});fechar();mesas()}catch(y){aviso(y.message,1)}})};
  q('#nm').onclick=()=>edM();q('#na').onclick=()=>edA();
  q('#cmpMesB').addEventListener('click',ev=>{const b=ev.target.closest('[data-m]');if(b)edM(ms.mesas.find(x=>x.id===b.dataset.m));const a=ev.target.closest('[data-a]');if(a)edA(eq.equipe.find(x=>x.id===a.dataset.a))});
 }

 /* ===================== LINKS E OPERAÇÃO ===================== */
 async function links(){
  view().innerHTML=`<div class=cmp id=cmpLk><div class=cmp-hd><div><h2>Links e operação</h2><p class=mu>Os três acessos da loja e as regras de pedido.</p></div></div><div id=cmpLkB><p class=mu>Carregando…</p></div></div>`;
  let lk,cfg;try{[lk,{config:cfg}]=await Promise.all([api('/api/comanda/links'),api('/api/comanda/config')])}catch(x){q('#cmpLkB').innerHTML=`<p class=mu>${e(x.message)}</p>`;return}
  if(!window.NexusQR)await new Promise(ok=>{const s=document.createElement('script');s.src='/painel/assets/js/qr.js?v=1';s.onload=ok;s.onerror=ok;document.head.append(s)});
  const qr=t=>window.NexusQR?window.NexusQR(t):'';
  const card=(ic,t,d,url,cls)=>`<div class="cmp-lk ${cls||''}"><div class=qr>${qr(url)}</div><div class=bd><b>${ic} ${t}</b><small class=mu>${d}</small><code>${e(url.replace(/^https?:\/\//,''))}</code><div class=bt><button class="cmp-b sm" data-cp="${e(url)}">Copiar link</button><a class="cmp-b sm ghost" href="${e(url)}" target=_blank rel=noopener>Abrir ↗</a></div></div></div>`;
  const ck=(k,t)=>`<label class=cmp-ck><input type=checkbox data-k=${k} ${cfg[k]?'checked':''}><span>${t}</span></label>`;
  q('#cmpLkB').innerHTML=`<div class=cmp-lks>
    ${card('🧾','Cardápio digital','Para clientes: delivery e retirada. Divulgue no Instagram, WhatsApp e no QR da mesa.',lk.cardapio,'pub')}
    ${card('🧑‍🍳','Garçom / atendente','Abra no celular do garçom. Entrada com nome + PIN.',lk.garcom)}
    ${card('📱','Pedido na mesa (cliente)','Imprima o QR e coloque nas mesas. O garçom abre a comanda, gera a senha e entrega ao cliente.',lk.mesa)}
    ${card('🍳','Tela da Cozinha','Abra na TV ou tablet da cozinha. Mostra só pratos.',lk.producao.cozinha,'dk')}
    ${card('🍹','Tela do Bar','Abra na TV ou tablet do bar. Mostra só bebidas.',lk.producao.bar,'dk')}
    ${card('🍳🍹','Cozinha + Bar (tela única)','Para quem tem uma pessoa cuidando dos dois: a tela fica dividida — pratos à esquerda, bebidas à direita.',lk.producao['cozinha-bar'],'dk')}
   </div>
   <p class=mu style="font-size:13px">🔒 Os links das telas de produção (Cozinha, Bar e Cozinha + Bar) têm um código secreto. Se um link vazar, <button class=cmp-lnk id=rot>gere links novos</button> (os antigos param de funcionar).</p>
   <div class=cmp-2>
    <section class=cmp-box><h3>🛵 Cardápio online</h3>${ck('aceitando','Recebendo pedidos agora')}${ck('delivery','Faz delivery')}${ck('retirada','Aceita retirada no balcão')}
     <div class=row2><label>Taxa de entrega (R$)<input data-r=taxa_entrega_cents value="${fmtR(cfg.taxa_entrega_cents)}" inputmode=decimal></label><label>Pedido mínimo (R$)<input data-r=pedido_minimo_cents value="${fmtR(cfg.pedido_minimo_cents)}" inputmode=decimal></label></div>
     <div class=row2><label>Tempo de entrega<input data-t=tempo_entrega value="${e(cfg.tempo_entrega)}" maxlength=30></label><label>Tempo de retirada<input data-t=tempo_retirada value="${e(cfg.tempo_retirada)}" maxlength=30></label></div>
     <small class=mu>Formas de pagamento aceitas</small><div class=cmp-pay id=pgs>${Object.entries(PAG).map(([k,t])=>`<button data-p=${k} class="${cfg.pagamentos.includes(k)?'on':''}">${t}</button>`).join('')}</div>
     <label>Chave Pix (opcional, aparece no checkout)<input data-t=pix_chave value="${e(cfg.pix_chave)}" maxlength=120></label>
     <div class=row2><label>WhatsApp da loja<input data-t=whatsapp value="${e(cfg.whatsapp)}" inputmode=tel maxlength=20></label><label>Nome no cardápio<input data-t=nome value="${e(cfg.nome)}" maxlength=80 placeholder="Usa o nome da loja"></label></div>
     <label>Endereço<input data-t=endereco value="${e(cfg.endereco)}" maxlength=160></label>
     <div class=row2><label>Logo da empresa (aparece no cardápio, garçom, telas de produção e painel)<input type=file accept="image/*" data-img=logo></label><label>Capa do cardápio<input type=file accept="image/*" data-img=capa></label></div>
     <div class=cmp-imgs>${cfg.logo?`<span><img src="${cfg.logo}" alt=""><button class=cmp-lnk data-rm=logo>remover logo</button></span>`:''}${cfg.capa?`<span><img src="${cfg.capa}" alt="" style="width:120px"><button class=cmp-lnk data-rm=capa>remover capa</button></span>`:''}</div>
    </section>
    <section class=cmp-box><h3>🍽️ Salão e produção</h3>
     <small class=mu>📱 Pedido na mesa: o garçom que abriu a comanda gera a senha (4 números) e entrega ao cliente. A senha vale até a mesa fechar. Antes de enviar, o cliente confirma que não pediu o mesmo ao garçom.</small>
     <small class=mu>Quem pode fechar a conta da mesa?</small><div class=cmp-seg id=fch><button data-f=garcom class="${cfg.fechamento!=='caixa'?'on':''}">Qualquer garçom</button><button data-f=caixa class="${cfg.fechamento==='caixa'?'on':''}">Só o Caixa</button></div>
     <label style="margin-top:12px">Taxa de serviço sugerida (%)<input data-n=servico_pct type=number min=0 max=30 value="${cfg.servico_pct}"></label>
     ${ck('impressao_auto','Telas de produção imprimem cada pedido novo automaticamente')}
     <small class=mu>Para imprimir sem a janela de confirmação, abra a tela da cozinha no Chrome com a opção “--kiosk-printing” e a impressora térmica (80 mm) como padrão.</small>
     <label style="margin-top:12px">Fuso horário da loja<select data-t=fuso>${['America/Sao_Paulo|Brasília (SP, RJ, MG, Sul, NE…)','America/Campo_Grande|Mato Grosso do Sul','America/Cuiaba|Mato Grosso','America/Manaus|Amazonas','America/Porto_Velho|Rondônia','America/Rio_Branco|Acre','America/Belem|Pará','America/Fortaleza|Ceará','America/Recife|Pernambuco','America/Bahia|Bahia','America/Boa_Vista|Roraima','America/Noronha|Fernando de Noronha'].map(x=>{const[v,t]=x.split('|');return `<option value="${v}" ${cfg.fuso===v?'selected':''}>${t}</option>`}).join('')}</select></label>
    </section></div>
   <div class=cmp-save><button class=cmp-b id=sv>Salvar configurações</button></div>`;
  const B=q('#cmpLkB'),img={};
  B.onclick=async ev=>{
   const cp=ev.target.closest('[data-cp]');if(cp){try{await navigator.clipboard.writeText(cp.dataset.cp);aviso('Link copiado')}catch{prompt('Copie o link:',cp.dataset.cp)}return}
   const p=ev.target.closest('#pgs [data-p]');if(p){p.classList.toggle('on');return}
   const f=ev.target.closest('#fch [data-f]');if(f){qa('#fch button').forEach(x=>x.classList.toggle('on',x===f));return}
   const rm=ev.target.closest('[data-rm]');if(rm){img[rm.dataset.rm]='';rm.parentElement.remove();return}
   if(ev.target.id==='rot'){if(!confirm('Gerar links novos para as telas de produção (Cozinha, Bar e Cozinha + Bar)? As telas abertas com o link antigo vão parar de funcionar.'))return;try{await api('/api/comanda/config',{method:'PUT',body:{novos_tokens:true}});aviso('Links novos gerados');links()}catch(x){aviso(x.message,1)}return}
   if(ev.target.id==='sv'){
    const b={pagamentos:qa('#pgs .on').map(x=>x.dataset.p),fechamento:q('#fch .on').dataset.f,...img};
    qa('[data-k]',B).forEach(x=>b[x.dataset.k]=x.checked);qa('[data-t]',B).forEach(x=>b[x.dataset.t]=x.value);qa('[data-r]',B).forEach(x=>b[x.dataset.r]=reais(x.value));qa('[data-n]',B).forEach(x=>b[x.dataset.n]=Number(x.value));
    ev.target.disabled=true;try{await api('/api/comanda/config',{method:'PUT',body:b});aviso('Configurações salvas');links()}catch(x){aviso(x.message,1);ev.target.disabled=false}
   }
  };
  qa('[data-img]',B).forEach(i=>i.onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{img[i.dataset.img]=await reduzir(f,i.dataset.img==='capa'?1400:400,.8);aviso('Imagem pronta — clique em Salvar')}catch{aviso('Imagem inválida',1)}});
 }
 return {pedidos,cardapio,mesas,links};
})();
function cmPedidos(){return CMP.pedidos()}
function cmCardapio(){return CMP.cardapio()}
function cmMesas(){return CMP.mesas()}
function cmLinks(){return CMP.links()}
