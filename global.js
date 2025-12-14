/* global.js
   Posicionamento absoluto + JS que empilha os botões acima do menu.
   Funciona independentemente da quantidade de botões dentro de .mobile-nav-buttons.
*/

(function () {
  const MOBILE_MAX = 768;

  const isMobile = () => window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches;

  document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.mobile-nav-buttons');
    if (!container) return;

    // ARIA
    container.setAttribute('role', 'navigation');
    container.setAttribute('aria-label', 'Navegação móvel');

    // Cria #mobile-menu-btn se necessário
    let menuBtn = document.getElementById('mobile-menu-btn');
    if (!menuBtn) {
      menuBtn = document.createElement('button');
      menuBtn.id = 'mobile-menu-btn';
      menuBtn.className = 'mobile-nav-btn';
      menuBtn.type = 'button';
      menuBtn.title = 'Abrir menu';
      menuBtn.setAttribute('aria-label', 'Abrir menu');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-haspopup', 'true');
      menuBtn.style.touchAction = 'manipulation';
      // garante que fique na base (bottom/right)
      menuBtn.style.bottom = '0';
      menuBtn.style.right = '0';
      menuBtn.style.position = 'absolute';
      menuBtn.style.pointerEvents = 'auto';
      // ícone
      const icon = document.createElement('i');
      icon.className = 'fas fa-bars';
      icon.setAttribute('aria-hidden', 'true');
      menuBtn.appendChild(icon);
      container.appendChild(menuBtn);
    } else {
      // garanto position absoluto caso CSS externo interfira
      menuBtn.style.position = 'absolute';
      menuBtn.style.bottom = '0';
      menuBtn.style.right = '0';
      menuBtn.style.pointerEvents = 'auto';
      menuBtn.setAttribute('aria-expanded', menuBtn.getAttribute('aria-expanded') || 'false');
    }

    // Pegar todos os botões (live NodeList)
    const getNavButtons = () => Array.from(container.querySelectorAll('.mobile-nav-btn'));

    // lê variáveis CSS (fallbacks)
    const readNumberVar = (el, name, fallback) => {
      const val = getComputedStyle(el).getPropertyValue(name).trim();
      if (!val) return fallback;
      const parsed = parseFloat(val);
      return isNaN(parsed) ? fallback : parsed;
    };

    // função que aplica posições quando open=true/false
    let animating = false;
    const applyPositions = (open) => {
      const btns = getNavButtons();
      // separa menuBtn e demais (preserva DOM order)
      const others = btns.filter(b => b.id !== 'mobile-menu-btn');
      // pega tamanho e gap a partir do container/roots
      const size = readNumberVar(container, '--mobile-nav-size', 60);
      const gap = readNumberVar(container, '--mobile-nav-gap', 12);
      const step = Math.round(size + gap);

      // base z
      const baseZ = readNumberVar(container, '--mobile-nav-z', 1200);

      // menuBtn (fica na base)
      menuBtn.style.transform = 'translateY(0) scale(1)';
      menuBtn.style.opacity = '1';
      menuBtn.style.visibility = 'visible';
      menuBtn.style.zIndex = String(baseZ + 40);
      menuBtn.style.pointerEvents = 'auto';

      if (!open) {
        // recolher: posiciona todos no mesmo lugar (embaixo), invisíveis
        others.forEach((btn) => {
          btn.style.transform = 'translateY(0) scale(.98)';
          btn.style.opacity = '0';
          btn.style.visibility = 'hidden';
          btn.style.pointerEvents = 'none';
          btn.style.zIndex = String(baseZ + 50); // continuará acima do menu quando expandidos
        });
        container.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
        return;
      }

      // abrir: para cada botão i, mover para cima por (i+1)*step px
      others.forEach((btn, i) => {
        const offset = (i + 1) * step;
        // mover para cima: negativo no translateY
        btn.style.transform = `translateY(-${offset}px) scale(1)`;
        btn.style.opacity = '1';
        btn.style.visibility = 'visible';
        btn.style.pointerEvents = 'auto';
        // zIndex: quem fica mais acima (maior offset) deve ter maior z-index
        btn.style.zIndex = String(baseZ + 60 + (others.length - i));
      });

      container.classList.add('open');
      menuBtn.setAttribute('aria-expanded', 'true');
    };

    // toggle
    const toggle = () => {
      if (!isMobile()) {
        applyPositions(false);
        return;
      }
      if (animating) return;
      animating = true;
      const open = !container.classList.contains('open');
      applyPositions(open);
      setTimeout(() => { animating = false; }, 360);
    };

    // clique no menu
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggle();
    });

    // clique em qualquer outro botão fecha depois de pequeno delay (permite ação do botão)
    container.addEventListener('click', (e) => {
      const target = e.target.closest('.mobile-nav-btn, .mobile-signout');
      if (!target) return;
      if (target.id === 'mobile-menu-btn') return;
      // deixa o botão executar e então fecha
      setTimeout(() => applyPositions(false), 120);
    });

    // fechamento ao clicar fora
    document.addEventListener('click', (e) => {
      if (!container.classList.contains('open')) return;
      if (e.target.closest && e.target.closest('.mobile-nav-buttons')) return;
      applyPositions(false);
    });

    // ESC fecha
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && container.classList.contains('open')) {
        applyPositions(false);
      }
    });

    // Reajusta ao redimensionar (fecha se sair do mobile)
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!isMobile()) applyPositions(false);
        else {
          // reaplica posições caso já esteja aberto
          if (container.classList.contains('open')) applyPositions(true);
        }
      }, 120);
    });

    // Inicial: garante posição recolhida
    applyPositions(false);
  });
})();
