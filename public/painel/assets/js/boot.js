// Verifica o login, isola os dados por cliente e adapta o dashboard ao segmento (nomes, ícone, serviços iniciais).
const SEGS={
 restaurante:{title:'Nexus Comanda',biz:'Meu Restaurante',emoji:'🍽️',color:'#15161a',pro:['Garçom','Garçons'],unit:'restaurante'},
 pizzaria:{title:'Nexus Comanda',biz:'Minha Pizzaria',emoji:'🍕',color:'#15161a',pro:['Garçom','Garçons'],unit:'pizzaria'},
 lanchonete:{title:'Nexus Comanda',biz:'Minha Lanchonete',emoji:'🍔',color:'#15161a',pro:['Atendente','Atendentes'],unit:'lanchonete'},
 sushi:{title:'Nexus Comanda',biz:'Meu Sushi Bar',emoji:'🍣',color:'#15161a',pro:['Garçom','Garçons'],unit:'restaurante'},
 bar:{title:'Nexus Comanda',biz:'Meu Bar',emoji:'🍺',color:'#15161a',pro:['Garçom','Garçons'],unit:'bar'},
 barbearia:{title:'Gestão de Barbearia',biz:'Minha Barbearia',emoji:'💈',color:'#030712'},
 manicure:{title:'Gestão de Manicure',biz:'Meu Studio de Unhas',emoji:'💅',color:'#be185d',pro:['Profissional','Profissionais'],unit:'estabelecimento',
  svc:[['Esmaltação em gel',60,60,'Unhas'],['Manicure simples',35,45,'Unhas'],['Pedicure',40,45,'Unhas'],['Mão + pé',70,90,'Combo'],['Alongamento em gel',150,120,'Alongamento'],['Manutenção',100,90,'Alongamento'],['Spa dos pés',80,60,'Tratamento']]},
 salao:{title:'Gestão de Salão',biz:'Meu Salão',emoji:'💇',color:'#6d28d9',pro:['Profissional','Profissionais'],unit:'salão',
  svc:[['Corte feminino',80,60,'Cabelo'],['Corte masculino',45,40,'Cabelo'],['Escova',50,45,'Cabelo'],['Coloração',150,120,'Cabelo'],['Hidratação',70,50,'Tratamento'],['Manicure',35,45,'Unhas'],['Sobrancelha',30,30,'Estética']]},
 estetica:{title:'Gestão de Estética',biz:'Minha Clínica de Estética',emoji:'✨',color:'#0f766e',pro:['Profissional','Profissionais'],unit:'clínica',
  svc:[['Limpeza de pele',120,60,'Facial'],['Massagem relaxante',130,60,'Corporal'],['Drenagem linfática',140,60,'Corporal'],['Design de sobrancelha',40,30,'Facial'],['Depilação a laser',90,30,'Depilação'],['Peeling',160,45,'Facial'],['Microagulhamento',250,60,'Facial']]},
 assistencia:{title:'Gestão de Assistência',biz:'Minha Assistência Técnica',emoji:'🔧',color:'#1d4ed8',pro:['Técnico','Técnicos'],unit:'assistência',
  svc:[['Troca de tela',250,60,'Celular'],['Troca de bateria',120,40,'Celular'],['Formatação',80,60,'Computador'],['Limpeza interna',90,60,'Computador'],['Troca de conector',100,45,'Celular'],['Diagnóstico',30,20,'Geral'],['Instalação de película',25,10,'Celular']]},
 outro:{title:'Nexus Comanda',biz:'Meu Negócio',emoji:'🏪',color:'#15161a',pro:['Atendente','Atendentes'],unit:'estabelecimento',
  svc:[['Serviço 1',50,30,'Geral'],['Serviço 2',80,60,'Geral'],['Serviço 3',120,90,'Geral']]}
};
(async()=>{
 try{
  const me=await (await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'})).json();
  if(!me.authenticated||me.role!=='tenant'){location.replace('/');return}
  if(me.blocked){location.replace('/app.html');return}
  const seg=SEGS[me.tenant.segment]?me.tenant.segment:'restaurante',G=SEGS[seg];
  window.TENANT_ID=me.tenant.id;window.TENANT=me;window.__NEXUS_MAX_STORES=Number(me.max_stores||1);
  try{
   if(localStorage.getItem('bp_tenant')!==me.tenant.id){
    Object.keys(localStorage).filter(k=>/^(bp|bdp)/.test(k)).forEach(k=>localStorage.removeItem(k));
    sessionStorage.removeItem('bp_in');localStorage.setItem('bp_tenant',me.tenant.id);
   }
  }catch{}
  // Título do app: "Gestão - [Nome do Negócio]" (aba, tela inicial do celular e tela de abertura). O ícone é o mesmo da marca Nexus para todos os nichos.
  let biz=(me.tenant.company_name||me.tenant.business_name||'').trim();try{window.__OLD_BIZ=localStorage.getItem('nexus_company')||'';localStorage.setItem('nexus_company',biz)}catch{}
  const PH=['Minha Barbearia',G.biz];
  window.__BIZ=biz||undefined;
  const setTitle=n=>{const t='Gestão - '+n;document.title=t;let m=document.querySelector('meta[name=apple-mobile-web-app-title]');if(!m){m=document.createElement('meta');m.name='apple-mobile-web-app-title';document.head.append(m)}m.content=t};
  let syncT=null;
  // chamado pelo dashboard sempre que o "Nome comercial" é carregado/salvo (só a loja principal define o nome do app)
  window.__nexusTitle=(name,loja)=>{
   if(loja!==undefined&&loja!==1)return;
   name=String(name||'').trim();const real=name&&!PH.includes(name);
   setTitle(real?name:(biz||G.biz));
   if(real&&name!==biz){biz=name} // sincronização do nome é feita na área da conta, com validação da senha ADM
  };
  setTitle(biz||G.biz);
  const set=(sel,attr,val)=>{const e=document.querySelector(sel);if(e)e.setAttribute(attr,val)};
  set('meta[name=theme-color]','content',G.color);
  // A versão atual da tela de abertura não possui mais o elemento #splash b.
  const splashIcon=document.querySelector('#splash b');if(splashIcon)splashIcon.textContent=G.emoji;
  // adapta o texto do dashboard ao segmento
  let src=await (await fetch('/painel/assets/js/app.js?v=31',{cache:'no-store'})).text();
  const R=[];
  if(seg!=='barbearia'){
   R.push(['A barbearia não funciona','O '+G.unit+' não funciona'],['dia da barbearia','dia do negócio'],['Barbearia Centro','Loja Centro'],['Minha Barbearia',G.biz],['Barber Dashboard PRO',G.title],['Barbeiros',G.pro[1]],['barbeiros',G.pro[1].toLowerCase()],['Barbeiro',G.pro[0]],['💈',G.emoji]);
   if(G.svc)src=src.replace(/\[\['Corte masculino'[\s\S]*?'Tratamento'\]\]/,JSON.stringify(G.svc).replace(/"/g,"'"));
  }else R.push(['Barber Dashboard PRO',G.title]);
  for(const [a,b] of R)src=src.split(a).join(b);
  const s=document.createElement('script');s.textContent=src;document.body.append(s);
 }catch(e){document.body.innerHTML='<p style="padding:24px;color:#fff;font-family:sans-serif">Não foi possível abrir o painel. <a href="/" style="color:#9cf">Voltar</a></p>'}
})();
document.addEventListener('click',async e=>{
 if(e.target.id==='hout'){if(!confirm('Tem certeza que deseja sair?'))return;try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'})}catch{}location.href='/'}
 if(e.target.id==='hins'){
  try{if(typeof dp!=='undefined'&&dp){dp.prompt();await dp.userChoice;return}}catch{}
  alert('Para instalar o app: no Android/Chrome abra o menu ⋮ e toque em "Instalar app" ou "Adicionar à tela inicial". No iPhone use Compartilhar > "Adicionar à Tela de Início".');
 }
});

// Instalação PWA: esconder o controle quando já estiver instalado e após instalação concluída.
(()=>{const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;const hide=()=>{document.querySelector('#hins')?.remove();document.querySelector('#ins')?.remove()};if(installed())hide();addEventListener('appinstalled',hide);addEventListener('pageshow',()=>{if(installed())hide()});})();
