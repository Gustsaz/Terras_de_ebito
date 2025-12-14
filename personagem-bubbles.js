// personagem-bubbles.js
(function () {
  const MAX_BUBBLES = 20;         // máximo de bolinhas na tela ao mesmo tempo
  const SPAWN_INTERVAL = 700;     // ms entre tentativas de spawn
  const containerId = 'bubble-wrap-js';

  // cria container de bolhas (se já existir, usa ele)
  let container = document.querySelector('.bubble-wrap');
  if (!container) {
    container = document.createElement('div');
    container.className = 'bubble-wrap';
    container.id = containerId;
    document.body.appendChild(container);
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  let active = 0;
  function spawnBubble() {
    // não criar em telas pequenas
    if (window.innerWidth <= 920) return;
    if (active >= MAX_BUBBLES) return;

    const b = document.createElement('div');
    b.className = 'bubble';

    // tamanho aleatório em px
    const size = Math.round(rand(8, 36)); // ajuste se quiser maiores/menores
    b.style.width = size + 'px';
    b.style.height = size + 'px';

    // posição horizontal aleatória (evita "sair" 8% nas bordas)
    const left = rand(2, 98);
    b.style.left = left + '%';

    // duração/atraso aleatório (ms)
    const duration = Math.round(rand(4200, 12000));
    const delay = Math.round(rand(0, 900));
    b.style.animationDuration = duration + 'ms';
    b.style.animationDelay = delay + 'ms';

    // opacidade inicial levemente variável
    b.style.opacity = rand(0.6, 1).toFixed(2);

    container.appendChild(b);
    active++;

    // remover quando terminar animação
    b.addEventListener('animationend', function () {
      try { b.remove(); } catch (e) { /* ignore */ }
      active = Math.max(0, active - 1);
    }, { once: true });

    // safety: se por algum motivo não animar, cleanup em 15s
    setTimeout(() => {
      if (document.body.contains(b)) {
        try { b.remove(); } catch (e) {}
        active = Math.max(0, active - 1);
      }
    }, 16000);
  }

  // cria algumas bolhas iniciais para "encher" a cena
  for (let i = 0; i < 8; i++) {
    setTimeout(spawnBubble, i * 180);
  }

  // loop de spawn contínuo
  const intervalId = setInterval(() => {
    spawnBubble();
    // em telas pequenas, garante esconder e limpar container
    if (window.innerWidth <= 920) container.style.display = 'none';
    else container.style.display = '';
  }, SPAWN_INTERVAL);

  // esconder/mostrar on resize
  window.addEventListener('resize', () => {
    if (window.innerWidth <= 920) {
      container.style.display = 'none';
    } else {
      container.style.display = '';
    }
  });

  // cleanup se a página for descarregada
  window.addEventListener('beforeunload', () => clearInterval(intervalId));
})();
