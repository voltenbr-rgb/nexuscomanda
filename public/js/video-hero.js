// Vídeo de apresentação da página inicial: começa sem som (regra dos navegadores para tocar sozinho);
// o botão liga/desliga o áudio. Pausa quando sai da tela para economizar bateria.
(function(){
  var v=document.getElementById('heroVid'),b=document.getElementById('heroSom');if(!v||!b)return;
  var reduz=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduz){v.removeAttribute('autoplay');v.pause();}
  function rot(){b.textContent=v.muted?'🔇 Ativar som':'🔊 Som ligado';b.setAttribute('aria-pressed',String(!v.muted));b.classList.toggle('on',!v.muted);}
  b.addEventListener('click',function(){
    v.muted=!v.muted;
    if(!v.muted){v.currentTime=0;v.volume=1;}   // ao ligar o som, recomeça para ouvir desde o início
    var p=v.play();if(p&&p.catch)p.catch(function(){});
    rot();
  });
  v.addEventListener('click',function(){if(v.paused){v.play();}else{b.click();}});
  if('IntersectionObserver' in window&&!reduz){
    new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var p=v.play();if(p&&p.catch)p.catch(function(){});}else v.pause();});},{threshold:.25}).observe(v);
  }
  rot();
})();
