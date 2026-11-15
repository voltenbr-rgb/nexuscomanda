// Botões de cadastro sempre visíveis + card de teste grátis na janela de cadastro
(function(){
  function openRegister(){var b=document.getElementById('registerOpen');if(b)b.click();}
  ['registerTop','registerSticky'].forEach(function(id){var e=document.getElementById(id);if(e)e.addEventListener('click',openRegister);});

  // Card "7 dias grátis" no topo da janela "Criar seu painel"
  var body=document.getElementById('modalBody');
  if(body&&'MutationObserver'in window){
    new MutationObserver(function(){
      var h=body.querySelector('h2');
      if(!h||!/criar/i.test(h.textContent)||body.querySelector('.trial-card'))return;
      var c=document.createElement('div');c.className='trial-card';
      c.innerHTML='<span class="trial-ico">🎁</span><div><b>Teste grátis por 7 dias</b><small>Crie seu painel agora e use todos os recursos. Sem cartão e sem e-mail.</small></div>';
      h.parentNode.insertBefore(c,h);
    }).observe(body,{childList:true,subtree:true});
  }

  // Barra flutuante: aparece depois dos botões do topo e some no bloco final
  var bar=document.getElementById('stickyCta'),hero=document.querySelector('.hero .actions'),end=document.querySelector('section.cta'),btn=document.getElementById('registerSticky');
  if(!bar||!hero||!('IntersectionObserver'in window))return;
  var heroVis=true,endVis=false;
  function upd(){var on=!heroVis&&!endVis;bar.classList.toggle('on',on);bar.setAttribute('aria-hidden',on?'false':'true');if(btn)btn.tabIndex=on?0:-1;}
  new IntersectionObserver(function(e){heroVis=e[0].isIntersecting;upd();}).observe(hero);
  if(end)new IntersectionObserver(function(e){endVis=e[0].isIntersecting;upd();}).observe(end);
})();
