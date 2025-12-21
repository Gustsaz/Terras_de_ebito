// Google login functionality - removed since in sidebar

// Update sidebar function
// --------- updateSidebar (safe) ----------
const updateSidebar = (user) => {
  const sidebar = document.querySelector('.sidebar');

  // Se não houver sidebar nesta página, não faz nada (evita TypeError)
  if (!sidebar) return;

  if (user && user.photoURL) {
    sidebar.innerHTML = `
      <a href="index.html" class="sidebar-home">
        <i class="fas fa-home"></i>
      </a>
      <img src="${user.photoURL}" class="sidebar-profile" alt="Profile" />
    `;

    // Add profile click event (proteção com querySelector pra garantir existência)
    setTimeout(() => {
      const profileImg = sidebar.querySelector('.sidebar-profile');
      if (profileImg) {
        profileImg.addEventListener('click', (e) => {
          e.stopPropagation();
          const existingSair = sidebar.querySelector('.sidebar-sair');
          if (existingSair) {
            existingSair.remove();
            return;
          }
          const sairBtn = document.createElement('button');
          sairBtn.className = 'sidebar-sair';
          sairBtn.textContent = 'Sair';
          sairBtn.style.position = 'absolute';
          sairBtn.style.bottom = '70px';
          sairBtn.style.left = '50%';
          sairBtn.style.transform = 'translateX(-50%)';
          sairBtn.style.background = 'rgba(0,0,0,0.8)';
          sairBtn.style.color = '#efe6e2';
          sairBtn.style.border = 'none';
          sairBtn.style.padding = '5px 10px';
          sairBtn.style.borderRadius = '5px';
          sairBtn.style.cursor = 'pointer';
          sairBtn.style.zIndex = '1000';
          sairBtn.addEventListener('click', async () => {
            try {
              await window.firebaseauth.signOut();
              sairBtn.remove();
            } catch (error) {
              console.error('Error signing out:', error);
            }
          });
          // hide on click outside
          const onDocClick = (evt) => {
            if (!sairBtn.contains(evt.target) && evt.target !== profileImg) {
              sairBtn.remove();
              document.removeEventListener('click', onDocClick);
            }
          };
          document.addEventListener('click', onDocClick);
          sidebar.appendChild(sairBtn);
        });
      }
    }, 100);
  } else {
    sidebar.innerHTML = `
      <a href="index.html" class="sidebar-home">
        <i class="fas fa-home"></i>
      </a>
      <button id="google-login" class="sidebar-google">
        <i class="fab fa-google"></i>
      </button>
    `;
    const googleBtn = sidebar.querySelector('#google-login');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        const provider = new window.GoogleAuthProvider();
        try {
          await window.signInWithPopup(window.firebaseauth, provider);
        } catch (error) {
          console.error('Error during sign in:', error);
        }
      });
    }
  }
};

let clickCountGlobal = {};
let allowNextContextMenu = false;


// ---------- inicialização segura de clickCountGlobal ----------
window.clickCountGlobal = window.clickCountGlobal || {};

// lista de atributos usados (normalizados). Ajuste se seus nomes differirem.
const ATTR_KEYS = ['bravura', 'arcano', 'fôlego', 'essência', 'técnica', 'intelecto'];

for (const raw of ATTR_KEYS) {
  const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // se já há valor salvo (localStorage ou global), forçamos Number, senão inicializamos com 0
  if (typeof clickCountGlobal[key] === 'undefined' || clickCountGlobal[key] === null) {
    clickCountGlobal[key] = 0;
  } else {
    clickCountGlobal[key] = Number(clickCountGlobal[key]) || 0;
  }
}
// (agora clickCountGlobal[...keys] está sempre como Number)

// Auth state observer for profile picture
document.addEventListener("DOMContentLoaded", () => {
  const checkFirebase = () => {
    if (window.firebaseauth) {
      window.firebaseauth.onAuthStateChanged((user) => {
        updateSidebar(user);
        if (user) {
          console.log('User signed in:', user);
          localStorage.setItem('userLoggedIn', 'true');
        } else {
          console.log('No user signed in');
          localStorage.removeItem('userLoggedIn');
        }
      });
    } else {
      setTimeout(checkFirebase, 100);
    }
  };
  checkFirebase();
});

// Main character creation logic
document.addEventListener("DOMContentLoaded", () => {
  // Ensure modal starts hidden
  document.getElementById('help-modal').classList.add('hidden');
  // Start fresh, no loading from localStorage

  // agora inclui também os hexágonos (.hex) para receber os mesmos handlers
  const icons = document.querySelectorAll(".icon, .hex");
  const numLeft = document.querySelector(".num.left");
  const numRight = document.querySelector(".num.right");
  const secAtributos = document.querySelector(".atributos");
  const secClasse = document.querySelector(".classe");
  const secRaca = document.querySelector(".raca");
  const secResumo = document.querySelector(".resumo");
  const slots = document.querySelectorAll(".slot");

  let cartaAtiva = null;

  /* ------- Variables for resumo update ------- */
  const resumoClasseNome = document.querySelector(".resumo .classe-nome");
  const resumoClassImg = document.querySelector(".resumo .class-img");
  const resumoDesc = document.querySelector(".resumo .class-desc");
  const classTitle = document.querySelector(".card-class .class-title");
  const classDesc = document.querySelector(".card-class .class-desc");
  const nomeField = document.querySelector(".resumo .nome-underline");

  /* ------- Variables for race update ------- */
  const racaCards = document.querySelectorAll(".raca-card");
  const racaImg = document.querySelector('.raca-img');
  const racaTitle = document.querySelector('.raca-title');
  const racaDesc = document.querySelector('.raca-desc');

  /* Function to show a section and hide others */
  function showSection(section) {
    secAtributos.classList.add('hidden');
    secClasse.classList.add('hidden');
    secRaca.classList.add('hidden');
    secResumo.classList.add('hidden');
    section.classList.remove('hidden');
  }

  /* ========== Mobile-only carousel for .classe section ========== */
  /* Cole este bloco logo após a função showSection(section) */

  let mobileCarousel = {
    enabled: false,
    index: 0,
    slots: [],
    leftBtn: null,
    rightBtn: null,
    container: null
  };

  /* ========== Mobile-only carousel for .classe section (patched) ========== */

  function updateMobileCarouselDisplay() {
    // esconde todos e só mostra o ativo; garante QUE MOSTRE APENAS O CARD-FRONT (remove .flipped)
    mobileCarousel.slots.forEach((s, i) => {
      const isActive = (i === mobileCarousel.index);
      // display control
      s.style.display = isActive ? '' : 'none';
      s.classList.toggle('mobile-active', isActive);

      // important: quando navegamos no carrossel devemos sempre mostrar o front
      // remove flipped para garantir que o .card-back NÃO apareça por navegação
      s.classList.remove('flipped');

      // se quiser, resetamos transform do inner (opcional; CSS lida com isso)
      const inner = s.querySelector('.card-inner');
      if (inner) inner.style.transform = '';
    });

    // atualiza setas (se existirem)
    if (mobileCarousel.leftBtn) {
      mobileCarousel.leftBtn.disabled = mobileCarousel.slots.length <= 1;
    }
    if (mobileCarousel.rightBtn) {
      mobileCarousel.rightBtn.disabled = mobileCarousel.slots.length <= 1;
    }
  }

  function createMobileArrows(contentEl) {
    // evita criar setas duplicadas
    if (contentEl.querySelector('.mobile-carousel-arrow.left')) return;

    // left
    const left = document.createElement('button');
    left.className = 'mobile-carousel-arrow left';
    left.setAttribute('aria-label', 'Anterior');
    left.innerHTML = '<i class="fas fa-chevron-left" aria-hidden="true"></i>';
    left.type = 'button';

    // right
    const right = document.createElement('button');
    right.className = 'mobile-carousel-arrow right';
    right.setAttribute('aria-label', 'Próximo');
    right.innerHTML = '<i class="fas fa-chevron-right" aria-hidden="true"></i>';
    right.type = 'button';

    // append ao container (contentEl é .classe .content)
    contentEl.appendChild(left);
    contentEl.appendChild(right);

    // comportamento: apenas navega; NÃO dispara click no slot (não vira a carta automaticamente)
    left.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!mobileCarousel.slots.length) return;
      // se o slot atual estiver flipped, resetá-lo antes de navegar para manter consistência
      mobileCarousel.slots[mobileCarousel.index]?.classList.remove('flipped');

      mobileCarousel.index = (mobileCarousel.index - 1 + mobileCarousel.slots.length) % mobileCarousel.slots.length;
      updateMobileCarouselDisplay();
      // não disparamos click(). O usuário deve clicar no slot para ver o card-back.
    });

    right.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!mobileCarousel.slots.length) return;
      mobileCarousel.slots[mobileCarousel.index]?.classList.remove('flipped');

      mobileCarousel.index = (mobileCarousel.index + 1) % mobileCarousel.slots.length;
      updateMobileCarouselDisplay();
      // não disparamos click() aqui também.
    });

    // armazenar refs para remoção posterior
    mobileCarousel.leftBtn = left;
    mobileCarousel.rightBtn = right;
  }

  function enableMobileCarouselIfNeeded() {
    if (!(window.matchMedia && window.matchMedia('(max-width: 768px)').matches)) return disableMobileCarousel();
    if (mobileCarousel.enabled) return; // já ativo

    const classeContent = document.querySelector('.classe .content');
    const slotEls = Array.from(document.querySelectorAll('.classe .slots .slot'));

    if (!classeContent || slotEls.length === 0) return;

    mobileCarousel.slots = slotEls;
    mobileCarousel.container = classeContent;

    // index inicial: preferência para slot que tem .filled ou 0
    const filledIndex = slotEls.findIndex(s => s.classList.contains('filled'));
    mobileCarousel.index = filledIndex >= 0 ? filledIndex : 0;

    // garantir que todos iniciem sem flipped e escondidos
    mobileCarousel.slots.forEach((s) => {
      s.classList.remove('mobile-active', 'flipped');
      s.style.display = 'none';
    });

    // criar setas e ligar events (não disparam clique nos slots)
    createMobileArrows(classeContent);

    // atualizar display inicial (mostra apenas front do slot ativo)
    updateMobileCarouselDisplay();

    mobileCarousel.enabled = true;
  }

  function disableMobileCarousel() {
    if (!mobileCarousel.enabled) return;
    // remove classes e volta ao comportamento normal
    mobileCarousel.slots.forEach(s => {
      s.classList.remove('mobile-active');
      s.style.display = ''; // volta ao estilo padrão (desktop)
    });
    // remove arrows
    if (mobileCarousel.leftBtn && mobileCarousel.leftBtn.parentNode) mobileCarousel.leftBtn.parentNode.removeChild(mobileCarousel.leftBtn);
    if (mobileCarousel.rightBtn && mobileCarousel.rightBtn.parentNode) mobileCarousel.rightBtn.parentNode.removeChild(mobileCarousel.rightBtn);

    mobileCarousel.leftBtn = null;
    mobileCarousel.rightBtn = null;
    mobileCarousel.slots = [];
    mobileCarousel.enabled = false;
    mobileCarousel.container = null;
  }

  // sobrescreve a showSection para ligar/desligar o comportamento mobile quando necessário
  // ======= Patch: mobile profile image + history back handling =======
  // Cole este bloco logo depois da definição original de showSection (ou da sobrescrita existente).
  (function () {
    // helpers - mapeia elementos de section para chaves e de volta
    const sectionKeyFor = (sectionEl) => {
      if (!sectionEl) return 'atributos';
      if (sectionEl.classList.contains('atributos')) return 'atributos';
      if (sectionEl.classList.contains('classe')) return 'classe';
      if (sectionEl.classList.contains('raca')) return 'raca';
      if (sectionEl.classList.contains('resumo')) return 'resumo';
      return 'atributos';
    };
    const sectionElementFor = (key) => {
      switch (key) {
        case 'classe': return secClasse;
        case 'raca': return secRaca;
        case 'resumo': return secResumo;
        default: return secAtributos;
      }
    };

    // Guarda referência do original (pode já existir em seu arquivo; segura se duplicar)
    const __orig_showSection_full = (typeof showSection === 'function') ? showSection : function (s) { };

    // Substitui showSection por uma versão que também empurra histórico e mantém mobile-carousel
    showSection = function (section) {
      // chama a original (esconde/mostra sections)
      __orig_showSection_full(section);

      // mobile carousel: se a versão do arquivo original tinha essa lógica,
      // mantemos comportamento (caso já exista no arquivo original, estará duplicado — mas é idempotente):
      try {
        if (section === secClasse) {
          setTimeout(() => {
            if (typeof enableMobileCarouselIfNeeded === 'function') enableMobileCarouselIfNeeded();
          }, 60);
        } else {
          if (typeof disableMobileCarousel === 'function') disableMobileCarousel();
        }
      } catch (e) { console.warn('carousel patch error', e); }

      // atualiza estado local e empurra history (evita empurrar repetido)
      const key = sectionKeyFor(section);
      try {
        // se já for o mesmo estado, substitui; senão empurra
        if (!history.state || history.state.section !== key) {
          history.pushState({ section: key }, '', '');
        } else {
          history.replaceState({ section: key }, '', '');
        }
      } catch (err) {
        // browsers estranhos podem negar pushState — silenciamos
        console.warn('history.pushState falhou', err);
      }
      try { localStorage.setItem('currentSection', key); } catch (e) { }
    };

    // Inicializa estado na primeira carga (substitui para não criar entradas extras)
    try {
      const initial = localStorage.getItem('currentSection') || 'atributos';
      history.replaceState({ section: initial }, '', '');
    } catch (e) { /* ignore */ }

    // popstate: quando o usuário pressiona voltar físico ou histórico muda
    window.addEventListener('popstate', (ev) => {
      const stateKey = (ev.state && ev.state.section) || localStorage.getItem('currentSection') || 'atributos';
      // se não há mudança real (ev.state.null) e estamos no atributos -> voltamos ao index
      if (stateKey === 'atributos') {
        // Se a página anterior na pilha é externa (i.e. fechar app ou voltar para index),
        // o comportamento desejado é ir para index.html. Para evitar navegação indevida
        // quando o usuário só navegou internamente, checamos se existe mais de uma entry.
        // A heurística simples: se history.length <= 1 -> navegar para index.html
        // (pode variar por browser; é a solução prática mais compatível).
        if ((history.length <= 1) || (!ev.state && !document.referrer)) {
          window.location.href = 'index.html';
          return;
        }
      }

      const el = sectionElementFor(stateKey);
      if (el) {
        // chama showSection sem empurrar outro estado duplicado: usamos __orig_showSection_full
        __orig_showSection_full(el);

        // restaura mobile carousel conforme section
        if (stateKey === 'classe') {
          setTimeout(() => {
            if (typeof enableMobileCarouselIfNeeded === 'function') enableMobileCarouselIfNeeded();
          }, 60);
        } else {
          if (typeof disableMobileCarousel === 'function') disableMobileCarousel();
        }

        try { localStorage.setItem('currentSection', stateKey); } catch (e) { }
      }
    });

    // ========== mobile-profile-btn: garantir imagem e estilo ==========
    function applyProfileImageToBtn(user) {
      const btn = document.getElementById('mobile-profile-btn');
      if (!btn) return;
      btn.innerHTML = ''; // limpa
      if (user && user.photoURL) {
        const img = document.createElement('img');
        img.src = user.photoURL;
        img.alt = user.displayName || 'Profile';
        // estilos inline para garantir que ocupe o botão e seja circular
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '50%';
        img.style.display = 'block';
        img.style.pointerEvents = 'none';
        btn.appendChild(img);
      } else {
        btn.innerHTML = '<i class="fas fa-user"></i>';
      }
    }

    // Atualiza o botão home (seguro: já pode existir, mas reforça)
    const mobileHomeBtn = document.getElementById('mobile-home-btn');
    if (mobileHomeBtn) {
      mobileHomeBtn.addEventListener('click', () => {
        // navega para index.html
        window.location.href = 'index.html';
      });
    }

    // Atachamos handler de clique no profile para abrir menu/sair (se já não tiver)
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    if (mobileProfileBtn && !mobileProfileBtn._profileInitialized) {
      mobileProfileBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        // se user logado, mostra botão Sair; se não, inicia login
        const user = (window.firebaseauth && window.firebaseauth.currentUser) || null;
        if (user) {
          // toggle signout small button
          const parent = document.querySelector('.mobile-nav-buttons');
          if (!parent) return;
          // se já existe, remove
          const existing = parent.querySelector('.mobile-signout');
          if (existing) { existing.remove(); return; }
          const signout = document.createElement('button');
          signout.className = 'mobile-signout';
          signout.textContent = 'Sair';
          signout.style.marginTop = '8px';
          signout.style.padding = '6px 10px';
          signout.style.borderRadius = '8px';
          signout.style.border = 'none';
          signout.style.cursor = 'pointer';
          signout.style.background = 'rgba(92,34,34,0.95)';
          signout.style.color = '#efe6e2';
          signout.style.fontFamily = 'MedievalSharp, serif';
          signout.style.zIndex = 1200;
          signout.addEventListener('click', async (ev) => {
            ev.stopPropagation();
            try {
              if (window.firebaseauth && window.firebaseauth.signOut) {
                await window.firebaseauth.signOut();
              }
              signout.remove();
              applyProfileImageToBtn(null);
            } catch (err) {
              console.error('Erro ao deslogar:', err);
            }
          });
          parent.appendChild(signout);
          // remove se clicar fora
          const onDocClick = (evt) => {
            if (!signout.contains(evt.target) && evt.target !== mobileProfileBtn) {
              signout.remove();
              document.removeEventListener('click', onDocClick);
            }
          };
          document.addEventListener('click', onDocClick);
        } else {
          // trigger Google login (se helpers do firebase existirem)
          if (typeof window.GoogleAuthProvider !== 'undefined') {
            try {
              const provider = new window.GoogleAuthProvider();
              await window.signInWithPopup(window.firebaseauth, provider);
            } catch (err) {
              console.error('Erro login com Google:', err);
            }
          } else {
            // fallback: redireciona para tela de login (se houver)
            console.warn('Firebase auth não disponível para login popup');
          }
        }
      });
      mobileProfileBtn._profileInitialized = true;
    }

    // Se houver observer de auth (onAuthStateChanged), chamamos applyProfileImageToBtn sempre que mudar
    if (window.firebaseauth && typeof window.firebaseauth.onAuthStateChanged === 'function') {
      // Se já existe um observer no seu código, isso apenas chamará a função adicionalmente.
      window.firebaseauth.onAuthStateChanged((u) => {
        try { applyProfileImageToBtn(u); } catch (e) { }
      });
    } else {
      // fallback: tenta usar window.onAuthStateChanged (api compat)
      if (typeof window.onAuthStateChanged === 'function') {
        try {
          window.onAuthStateChanged(window.firebaseauth, (u) => applyProfileImageToBtn(u));
        } catch (e) { }
      }
    }

  })();


  // também reativa/desativa ao redimensionar a tela enquanto estiver na seção .classe
  window.addEventListener('resize', () => {
    // se estamos na tela de classes (visível) chamamos de novo
    if (!document.querySelector('.classe').classList.contains('hidden')) {
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        enableMobileCarouselIfNeeded();
      } else {
        disableMobileCarousel();
      }
    }
  });


  // Reset to default values
  let pontos = 0;
  let maxPontos = 7;
  let flaws = 0;

  numLeft.textContent = pontos;
  numRight.textContent = maxPontos;

  document.querySelector('.numbers').classList.remove('hidden');
  document.querySelector('.circle-container').classList.add('hidden');

  const descriptions = {
    tecnica: "Técnica: Demonstra a precisão e a elegância do movimento, o olhar frio e certeiro.",
    intelecto: "Intelecto: Reflete a mente racional, a percepção e o domínio do conhecimento.",
    essencia: "Essência: Carrega a chama espiritual, a ligação com o divino, o profano ou o inexplicável.",
    arcano: "Arcana: Revela a sintonia com o oculto, o domínio sobre a magia e as forças invisíveis",
    bravura: "Bravura: Mede a força do coração e a capacidade de enfrentar o medo sem hesitar.",
    folego: "Fôlego: A resistência física, a força para suportar dor e exaustão sem ceder."
  };

  /* ---------- START: substituir aqui icons.forEach(...) e counter listeners ---------- */

  function safeInt(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function recalcTotalsAndSave() {
    // garante números
    Object.keys(clickCountGlobal).forEach(k => {
      clickCountGlobal[k] = safeInt(clickCountGlobal[k]);
    });

    // flaws = quantidade de atributos negativos (mesma ideia de penalidade)
    flaws = Object.values(clickCountGlobal).filter(v => v < 0).length;
    maxPontos = 7 + flaws;

    // pontos: soma apenas dos positivos
    pontos = Object.values(clickCountGlobal).reduce((a, b) => a + (b > 0 ? b : 0), 0);

    if (numRight) numRight.textContent = maxPontos;
    if (numLeft) numLeft.textContent = pontos;

    // atualiza todos os counters na UI
    Object.keys(clickCountGlobal).forEach(nome => {
      const ctrDOM = document.querySelector(`.counter.${nome}`);
      if (ctrDOM) ctrDOM.textContent = clickCountGlobal[nome];
    });

    localStorage.setItem('attributes', JSON.stringify(clickCountGlobal));

    // controla a UI quando atinge o limite
    if (pontos === maxPontos) {
      document.querySelector('.numbers').classList.add('hidden');
      document.querySelector('.circle-container').classList.remove('hidden');
    } else {
      document.querySelector('.numbers').classList.remove('hidden');
      document.querySelector('.circle-container').classList.add('hidden');
    }
  }



  /* ---------- START: substituir aqui icons.forEach(...) e counter listeners ---------- */

  function safeInt(v) {
    const n = parseInt(v, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  function recalcTotalsAndSave() {
    Object.keys(clickCountGlobal).forEach(k => {
      clickCountGlobal[k] = safeInt(clickCountGlobal[k]);
    });

    flaws = Object.values(clickCountGlobal).filter(v => v < 0).length;
    maxPontos = 7 + flaws;

    pontos = Object.values(clickCountGlobal).reduce((a, b) => a + (b > 0 ? b : 0), 0);

    if (numRight) numRight.textContent = maxPontos;
    if (numLeft) numLeft.textContent = pontos;

    Object.keys(clickCountGlobal).forEach(nome => {
      const ctrDOM = document.querySelector(`.counter.${nome}`);
      if (ctrDOM) ctrDOM.textContent = clickCountGlobal[nome];
    });

    localStorage.setItem('attributes', JSON.stringify(clickCountGlobal));

    if (pontos === maxPontos) {
      document.querySelector('.numbers').classList.add('hidden');
      document.querySelector('.circle-container').classList.remove('hidden');
    } else {
      document.querySelector('.numbers').classList.remove('hidden');
      document.querySelector('.circle-container').classList.add('hidden');
    }
  }
  /* ===========================
     openNumberInputAt (robusto)
     Substitua todas as ocorrências antigas por esta função
     =========================== */
  function openNumberInputAt(element, nome) {
    // evita abrir mais de um input ao mesmo tempo
    if (document.getElementById('mobile-attr-input')) return;

    const rect = element.getBoundingClientRect();
    const input = document.createElement('input');
    input.type = 'number';
    input.id = 'mobile-attr-input';
    input.value = (clickCountGlobal[nome] !== undefined) ? clickCountGlobal[nome] : 0;

    input.style.position = 'fixed';
    input.style.left = `${rect.left + rect.width / 2}px`;
    input.style.top = `${rect.top + rect.height / 2}px`;
    input.style.transform = 'translate(-50%,-50%)';
    input.style.zIndex = 2000;
    input.style.width = '88px';
    input.style.padding = '8px 10px';
    input.style.fontSize = '20px';
    input.style.borderRadius = '8px';
    input.style.border = '2px solid #5C2222';
    input.style.background = '#1E1E1E';
    input.style.color = '#fff';
    input.style.textAlign = 'center';
    input.style.outline = 'none';

    document.body.appendChild(input);
    input.focus();
    input.select();

    // flag para evitar double-execute (Enter -> blur or blur -> Enter racing)
    let closed = false;

    function cleanup() {
      // remove listeners guardando que já fechou
      if (closed) return;
      closed = true;
      input.removeEventListener('keydown', onKeyDown);
      input.removeEventListener('blur', onBlur);
      // remover somente se ainda estiver no DOM
      if (input.parentNode) input.parentNode.removeChild(input);
    }

    function acceptAndClose() {
      if (closed) return;
      const val = safeInt(input.value);
      clickCountGlobal[nome] = val;
      recalcTotalsAndSave();
      cleanup();
    }

    function onKeyDown(ev) {
      if (ev.key === 'Enter') {
        acceptAndClose();
      } else if (ev.key === 'Escape') {
        cleanup();
      }
    }

    function onBlur() {
      // small timeout to let Enter handler run first if keydown occured
      setTimeout(() => {
        // if already closed by Enter handler, cleanup() will be noop
        acceptAndClose();
      }, 10);
    }

    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('blur', onBlur);
  }


  /* Reaplica listeners com comportamento mobile/desktop adequado */
  icons.forEach(icon => {
    const nome = icon.classList[1];

    const ctr = document.querySelector(`.counter.${nome}`);
    if (ctr) ctr.textContent = clickCountGlobal[nome] || 0;

    icon.addEventListener('mouseenter', () => {
      // Remove hover/dim de outros
      icons.forEach(otherIcon => {
        if (otherIcon !== icon) {
          otherIcon.classList.remove("hovered");
          otherIcon.classList.remove("dimmed");
          const otherNome = otherIcon.classList[1];
          const otherCtr = document.querySelector(`.counter.${otherNome}`);
          if (otherCtr) otherCtr.classList.remove("visible");
        }
      });
      icon.classList.add("hovered");
      if (ctr) ctr.classList.add("visible");

      // only dim icon when counter visible AND mobile
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        icon.classList.add('dimmed');
      }

      const descDiv = document.getElementById('attr-description');
      if (descDiv) {
        descDiv.classList.remove('hidden');
        descDiv.querySelector('p').textContent = descriptions[nome] || '';
        descDiv.classList.add('visible');
      }
    });

    icon.addEventListener('mouseleave', (e) => {
      // remove visible/hover/description only if leaving to non-related targets
      if (!e.relatedTarget || (!e.relatedTarget.closest('.icon') && !e.relatedTarget.closest('.counter'))) {
        const d = document.getElementById('attr-description');
        if (d) d.classList.remove('visible');
        if (ctr) ctr.classList.remove('visible');
        icon.classList.remove('hovered');
        icon.classList.remove('dimmed');
      }
    });

    icon.addEventListener('click', (e) => {
      // Se mobile -> abrir input para digitar valor
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        openNumberInputAt(icon, nome);
        return;
      }

      // Desktop: comportamento original (left click => +1)
      if (pontos < maxPontos) {
        if (clickCountGlobal[nome] == undefined) clickCountGlobal[nome] = 0;
        clickCountGlobal[nome]++;
        recalcTotalsAndSave();
      }
    });

    icon.addEventListener('touchstart', (ev) => {
      /* deixado intencionalmente vazio - mobile usa click handler acima para abrir input */
    });
  });

  // counters: hover + (mobile) click para editar
  document.querySelectorAll('.counter').forEach(counter => {
    const nome = counter.classList[1];

    counter.addEventListener('mouseenter', () => {
      // remove hover/dim de outros icons
      icons.forEach(otherIcon => {
        const otherNome = otherIcon.classList[1];
        if (otherNome !== nome) {
          otherIcon.classList.remove("hovered");
          otherIcon.classList.remove("dimmed");
          const otherCtr = document.querySelector(`.counter.${otherNome}`);
          if (otherCtr && otherCtr !== counter) otherCtr.classList.remove("visible");
        }
      });

      // procura tanto o ícone quanto o hex correspondente
      const icon = document.querySelector(`.icon.${nome}, .hex.${nome}`);
      if (icon) {
        icon.classList.add("hovered");
        // dim only on mobile (when counter visible)
        if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
          icon.classList.add('dimmed');
        }
      }
      counter.classList.add("visible");

      const descDiv = document.getElementById('attr-description');
      if (descDiv) {
        descDiv.classList.remove('hidden');
        descDiv.querySelector('p').textContent = descriptions[nome] || '';
        descDiv.classList.add('visible');
      }
    });

    counter.addEventListener('mouseleave', (e) => {
      if (!e.relatedTarget || (!e.relatedTarget.closest('.icon') && !e.relatedTarget.closest('.counter'))) {
        const d = document.getElementById('attr-description');
        if (d) d.classList.remove('visible');
        counter.classList.remove('visible');

        const icon = document.querySelector(`.icon.${nome}`);
        if (icon) {
          icon.classList.remove('hovered');
          icon.classList.remove('dimmed');
        }
      }
    });

    // click no counter: apenas no mobile abre o input (desktop continua com contextmenu para diminuir)
    counter.addEventListener('click', (e) => {
      if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
        openNumberInputAt(counter, nome);
      }
    });
  });

  /* ---------- END: substituir aqui ---------- */


  // Always start from atributos section
  showSection(secAtributos);

  slots.forEach(slot => {
    slot.addEventListener("click", () => {
      const isFlipped = slot.classList.contains("flipped");

      if (cartaAtiva && cartaAtiva !== slot) {
        cartaAtiva.classList.remove("flipped");
        cartaAtiva = null;
      }

      if (!isFlipped) {
        slot.classList.add("flipped");
        cartaAtiva = slot;
        return;
      }

      if (isFlipped) {
        const classe = slot.dataset.classe;
        localStorage.setItem('selectedClass', classe);
        localStorage.setItem('currentSection', 'raca');
        showSection(secRaca);
      }
    });
  });

  /* ------- Atualiza resumo quando uma classe é selecionada ------- */
  // reaplica listeners nos slots para preencher o resumo (se já clicados)
  slots.forEach(slot => {
    slot.addEventListener("click", () => {
      const classe = slot.dataset.classe || slot.querySelector(".char-name")?.textContent || "—";
      const desc = slot.querySelector(".char-desc")?.textContent || "—";
      const artImg = slot.querySelector(".img-area img")?.src || "./imgs/anão 2.png";

      if (resumoClasseNome) resumoClasseNome.textContent = classe;
      if (resumoDesc) resumoDesc.textContent = desc;
      if (classTitle) classTitle.textContent = classe;
      if (classDesc) classDesc.textContent = desc;
      if (resumoClassImg) resumoClassImg.src = artImg;
    });
  });

  /* ------- Mostrar resumo somente após clicar em um raca-card ------- */
  racaCards.forEach(rc => {
    rc.addEventListener("mouseenter", () => {
      const raca = rc.dataset.raca;
      const imgSrc = rc.querySelector('img').src;
      const descricaoIcon = document.querySelector('.raca .descricao-icon img');
      const descricaoTexto = document.querySelector('.raca .descricao-texto p');
      const bonus = document.querySelector('.raca .bonus');

      if (descricaoIcon) descricaoIcon.src = imgSrc;

      switch (raca) {
        case 'Anão':
          if (descricaoTexto) descricaoTexto.textContent = "Os anões são o reflexo das montanhas de Herta: firmes, engenhosos e incansáveis. Vivem para construir, beber e lutar, acreditando que o trabalho é a forma mais pura de oração.";
          if (bonus) bonus.textContent = "Recebem +1 em aumento de Vida por nível devido à sua robustez e resistência natural.";
          break;
        case 'Feéricos':
          if (descricaoTexto) descricaoTexto.textContent = "Os feéricos são herdeiros das criaturas místicas que outrora dançavam sob a luz dos deuses. Cada um nasce ligado ao espírito de um animal primordial, e dessa união surge seu poder singular.";
          if (bonus) bonus.textContent = "Ágeis: Recebe +1 em Técnica automaticamente. Voadores: Recebe +2 de deslocamento. Robustos: Pode Bloquear sem necessidade de escudo ou arma de duas mãos.";
          break;
        case 'Elfos':
          if (descricaoTexto) descricaoTexto.textContent = "Os elfos de Flodia são filhos do conhecimento e da melancolia. Dotados de uma mente afiada e olhar distante, estudam o mundo como quem busca compreender um segredo esquecido. Sua ligação com o arcano é natural, quase instintiva.";
          if (bonus) bonus.textContent = "Recebem +1 em Intelecto e podem aprender +1 feitiço ao alcançar o nível inicial";
          break;
        case 'Meio Orc':
          if (descricaoTexto) descricaoTexto.textContent = "Forjados nas guerras do leste, os meio-orcs são a fusão da brutalidade e da disciplina. Soldados por tradição, acreditam que a glória está no confronto direto. Seu sangue os impulsiona à frente, e sua vontade os impede de cair.";
          if (bonus) bonus.textContent = "Recebem +1 em testes de Iniciativa e +1 em Bravura, pela natureza marcial e o instinto de combate.";
          break;
      }
    });
  });

  racaCards.forEach(rc => {
    rc.addEventListener("mouseleave", () => {
      // optional: revert to Anão default
      const descricaoIcon = document.querySelector('.raca .descricao-icon img');
      const descricaoTexto = document.querySelector('.raca .descricao-texto p');
      const bonus = document.querySelector('.raca .bonus');

      if (descricaoIcon) descricaoIcon.src = "./imgs/anão 2.png";
      if (descricaoTexto) descricaoTexto.textContent = "Os anões são o reflexo das montanhas de Herta: firmes, engenhosos e incansáveis. Vivem para construir, beber e lutar, acreditando que o trabalho é a forma mais pura de oração.";
      if (bonus) bonus.textContent = "Recebem +1 em aumento de Vida por nível devido à sua robustez e resistência natural.";
    });
  });
  racaCards.forEach(rc => {
    rc.addEventListener("click", () => {
      // opcional: guarda a raça selecionada (se quiser, mostrar em algum lugar)
      const racaNome = rc.dataset.raca || rc.querySelector("p")?.textContent || "—";

      localStorage.setItem('selectedRace', racaNome);

      if (racaNome === 'Feéricos') {
        // Show modal for subclasse selection
        const modal = document.getElementById('ferico-modal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Handle subclasse selection
        document.querySelectorAll('.subraca-card').forEach(subCard => {
          subCard.addEventListener('click', (e) => {
            e.preventDefault();
            const subclasse = subCard.dataset.subraca;
            localStorage.setItem('selectedSubrace', subclasse);

            modal.classList.add('hidden');
            modal.style.display = 'none';

            proceedToResumo(racaNome, subclasse);
          });
        });

        // Close modal on background click or something? Add if needed but for now only on select
      } else {
        proceedToResumo(racaNome);
      }
    });
  });

  function proceedToResumo(racaNome, subclasse = null) {
    localStorage.setItem('currentSection', 'resumo');

    // Calculate total attributes including racial bonuses for class stats
    const totalAttrs = {};
    const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    ['bravura', 'arcano', 'fôlego', 'essência', 'técnica', 'intelecto'].forEach(att => {
      const key = normalize(att);
      totalAttrs[key] = clickCountGlobal[key] ?? 0;
      // Apply racial bonuses
      if (racaNome === 'Feéricos' && subclasse === 'Ágeis' && key === 'tecnica') totalAttrs[key] += 1;
      if (racaNome === 'Elfo' && key === 'intelecto') totalAttrs[key] += 1;
      if (racaNome === 'Meio Orc' && key === 'bravura') totalAttrs[key] += 1;
    });

    // Update race section
    const racaImg = document.querySelector('.raca-img');
    const racaTitle = document.querySelector('.raca-title');
    const racaDesc = document.querySelector('.raca-desc');
    const iconSrc = document.querySelector(`[data-raca="${racaNome}"] img`).src;

    if (racaImg) racaImg.src = iconSrc;
    if (racaTitle) racaTitle.textContent = subclasse ? `${racaNome} (${subclasse})` : racaNome;

    // Calculate class stats based on saved class
    const selectedClass = localStorage.getItem('selectedClass');

    let classStats = '';
    let proficiencias = [];

    if (selectedClass === 'Arcanista') {
      const pv = 8 + totalAttrs.bravura;
      const mn = 10 + totalAttrs.arcano;
      const sta = 6 + totalAttrs[normalize('fôlego')];
      classStats = `PV: ${pv}\nMN: ${mn}\nSTA: ${sta}`;
      proficiencias = ['Cajados', 'Armaduras Leves', 'Armas Leves'];
    } else if (selectedClass === 'Escudeiro') {
      const pv = 18 + totalAttrs.bravura;
      const mn = 2 + totalAttrs.arcano;
      const sta = 8 + totalAttrs[normalize('fôlego')];
      classStats = `PV: ${pv}\nMN: ${mn}\nSTA: ${sta}`;
      proficiencias = ['Armaduras Médias', 'Armas de duas mãos', 'Escudos Médios'];
    } else if (selectedClass === 'Errante') {
      const pv = 10 + totalAttrs.bravura;
      const mn = 5 + totalAttrs.arcano;
      const sta = 12 + totalAttrs[normalize('fôlego')];
      classStats = `PV: ${pv}\nMN: ${mn}\nSTA: ${sta}`;
      proficiencias = ['Armas Técnicas', 'Armaduras Leves', 'Escudos Leves'];
    } else if (selectedClass === 'Luminar') {
      const pv = 9 + totalAttrs.bravura;
      const mn = 10 + totalAttrs.arcano;
      const sta = 4 + totalAttrs[normalize('essência')];
      classStats = `PV: ${pv}\nMN: ${mn}\nSTA: ${sta}`;
      proficiencias = ['Tomos', 'Armaduras Leves', 'Armas Leves'];
    }

    // Update class desc with stats
    if (classDesc && classStats) {
      classDesc.textContent = classStats.replace(/\n/g, '\n');
    }

    // Update proficiencias
    const profList = document.querySelector('.proficiencias-list');
    if (profList) {
      profList.innerHTML = proficiencias.map(prof => `<span>${prof}</span>`).join('<br>');
    }

    let bonusText = '';
    switch (racaNome) {
      case 'Anão':
        bonusText = 'Recebem +1 em aumento de Vida por nível devido à sua robustez e resistência natural.';
        break;
      case 'Feéricos':
        switch (subclasse) {
          case 'Ágeis':
            bonusText = 'Ágeis: Recebe +1 em Técnica automaticamente. Robustos: Pode Bloquear sem necessidade de escudo ou arma de duas mãos.';
            break;
          case 'Voadores':
            bonusText = 'Voadores: Recebe +2 de deslocamento. Robustos: Pode Bloquear sem necessidade de escudo ou arma de duas mãos.';
            break;
          case 'Robustas':
            bonusText = 'Robustos: Pode Bloquear sem necessidade de escudo ou arma de duas mãos.';
            break;
        }
        break;
      case 'Elfo':
        bonusText = 'Recebem +1 em Intelecto e podem aprender +1 feitiço ao alcançar o nível inicial.';
        break;
      case 'Meio Orc':
        bonusText = 'Recebem +1 em testes de Iniciativa e +1 em Bravura, pela natureza marcial e o instinto de combate.';
        break;
    }

    if (racaDesc) racaDesc.textContent = document.querySelector('.raca .descricao-texto p').textContent.replace(document.querySelector('.raca .bonus').textContent, bonusText);

    // fecha seleção de raças e abre o resumo
    showSection(secResumo);

    // Update attribute values in card-stats
    const attrValues = document.querySelectorAll('.card-stats .attr-value');
    attrValues.forEach(span => {
      const alt = span.closest('.attr-item').querySelector('img').alt.toLowerCase();
      let bonus = 0;
      let raceText = '';

      // Apply automatic bonuses
      if (racaNome === 'Feéricos' && subclasse === 'Ágeis' && alt === 'técnica') {
        bonus = 1;
        raceText = 'Feéricos (Ágeis)';
      }
      if (racaNome === 'Elfo' && alt === 'intelecto') {
        bonus = 1;
        raceText = 'Elfo';
      }
      if (racaNome === 'Meio Orc' && alt === 'bravura') {
        bonus = 1;
        raceText = 'Meio Orc';
      }
      span.textContent = totalAttrs[normalize(alt)];

      // Add hover logic for tooltip detailed breakdown
      const item = span.closest('.attr-item');
      let tooltip = null;
      item.addEventListener('mouseenter', (e) => {
        if (bonus > 0) {
          // Create tooltip
          const base = totalAttrs[normalize(alt)] - bonus;
          tooltip = document.createElement('div');
          tooltip.className = 'attr-tooltip';
          tooltip.textContent = `${base} + ${bonus}(${raceText})`;
          tooltip.style.position = 'absolute';
          tooltip.style.background = 'rgba(0,0,0,0.8)';
          tooltip.style.color = 'white';
          tooltip.style.padding = '5px';
          tooltip.style.borderRadius = '3px';
          tooltip.style.fontSize = '12px';
          tooltip.style.pointerEvents = 'none';
          tooltip.style.zIndex = '1000';
          tooltip.style.left = `${e.pageX + 10}px`;
          tooltip.style.top = `${e.pageY - 10}px`;
          document.body.appendChild(tooltip);
        }
      });
      item.addEventListener('mouseleave', () => {
        if (tooltip) {
          document.body.removeChild(tooltip);
          tooltip = null;
        }
      });
    });

    // Update deslocamento and carga
    const deslocamento = document.querySelector('.card-data .deslocamento');
    const carga = document.querySelector('.card-data .carga');

    // Deslocamento: 7 normally, +2 if Feéricos Voadores
    const baseDesloc = 7;
    const extraDesloc = (racaNome === 'Feéricos' && subclasse === 'Voadores') ? 2 : 0;
    const totalDesloc = baseDesloc + extraDesloc;
    if (deslocamento) {
      deslocamento.innerHTML = extraDesloc > 0 ? `${totalDesloc} (${baseDesloc} <span class="bonus-extra">+ ${extraDesloc}</span>)` : totalDesloc;
    }

    // Carga Máxima: 8 + Bravura TOTAL
    let cargaMaxima = 8 + totalAttrs.bravura;
    if (carga) carga.textContent = cargaMaxima;

    // Store race info for hover
    const savedRace = racaNome;
    const savedSubrace = subclasse;

    // Card-class hover to show race
    const cardClass = document.querySelector('.card-class');
    if (cardClass) {
      let originalTitle = classTitle.textContent;
      let originalDesc = classDesc.textContent;
      let originalImg = resumoClassImg.src;

      cardClass.addEventListener('mouseenter', () => {
        cardClass.classList.add('flipped'); // assume CSS for animation
        classTitle.textContent = savedSubrace ? `${savedRace} (${savedSubrace})` : savedRace;
        classDesc.textContent = bonusText;
        resumoClassImg.src = iconSrc; // race icon
      });

      cardClass.addEventListener('mouseleave', () => {
        cardClass.classList.remove('flipped');
        classTitle.textContent = originalTitle;
        classDesc.textContent = originalDesc;
        resumoClassImg.src = originalImg;
      });
    }

    // foca o primeiro painel editável para facilitar escrita
    const primeiroPainel = document.querySelector(".resumo-panel[contenteditable='true']");
    if (primeiroPainel) {
      // small timeout to ensure element is visible before focusing
      setTimeout(() => primeiroPainel.focus(), 50);
    }

    // Create character button
    const createBtn = document.getElementById('create-character');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        const charUid = generateUuid();

        const nome = nomeField.textContent.trim() || 'Herói Sem Nome';
        const historia = document.querySelector('.resumo-box:nth-child(1) .resumo-panel').textContent.trim();
        const aparencia = document.querySelector('.resumo-box:nth-child(2) .resumo-panel').textContent.trim();
        const notas = document.querySelector('.resumo-box:nth-child(3) .resumo-panel').textContent.trim();

        const raca = localStorage.getItem('selectedRace');
        let subraca = null;
        if (raca === 'Feéricos') {
          subraca = localStorage.getItem('selectedSubrace');
        }

        const classe = localStorage.getItem('selectedClass');

        const attribs = { ...clickCountGlobal };
        const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

        let pv = { total: 0, atual: 0 };
        let mn = { total: 0, atual: 0 };
        let sta = { total: 0, atual: 0 };

        const totalAttrs = {};
        ['bravura', 'arcano', 'fôlego', 'essência', 'técnica', 'intelecto'].forEach(att => {
          const key = normalize(att);
          totalAttrs[key] = attribs[key] ?? 0;
          if (raca === 'Feéricos' && subraca === 'Ágeis' && key === 'tecnica') totalAttrs[key] += 1;
          if (raca === 'Elfo' && key === 'intelecto') totalAttrs[key] += 1;
          if (raca === 'Meio Orc' && key === 'bravura') totalAttrs[key] += 1;
        });

        if (classe === 'Arcanista') {
          pv.total = 8 + totalAttrs.bravura;
          mn.total = 10 + totalAttrs.arcano;
          sta.total = 6 + totalAttrs[normalize('fôlego')];
        } else if (classe === 'Escudeiro') {
          pv.total = 18 + totalAttrs.bravura;
          mn.total = 2 + totalAttrs.arcano;
          sta.total = 8 + totalAttrs[normalize('fôlego')];
        } else if (classe === 'Errante') {
          pv.total = 10 + totalAttrs.bravura;
          mn.total = 5 + totalAttrs.arcano;
          sta.total = 12 + totalAttrs[normalize('fôlego')];
        } else if (classe === 'Luminar') {
          pv.total = 9 + totalAttrs.bravura;
          mn.total = 10 + totalAttrs.arcano;
          sta.total = 4 + totalAttrs[normalize('essência')];
        }

        pv.atual = pv.total;
        mn.atual = mn.total;
        sta.atual = sta.total;

        const deslocamento = 7;
        const carga = 8 + totalAttrs.bravura;

        const charData = {
          uid: charUid,
          atributos: attribs, // raw values
          classe: classe,
          raca: raca,
          subraca: subraca,
          historia: historia,
          aparencia: aparencia,
          personalidade: '',
          notas: notas,
          itens: [],
          nome: nome,
          PV: pv,
          MN: mn,
          STA: sta,
          EXP: { total: 100, atual: 0 },
          LVL: 1,
          DEF: 0,
          deslocamento: deslocamento,
          carga: carga
        };

        // Save only to Firebase DB if user logged in
        if (window.firebaseauth?.currentUser) {
          try {
            const user = window.firebaseauth.currentUser;
            const userDocRef = window.doc(window.firestoredb, 'usuarios', user.uid);
            const userDocSnap = await window.getDoc(userDocRef);
            let characters = [];
            if (userDocSnap.exists()) {
              characters = userDocSnap.data().personagens || [];
            }
            characters.push(charData);
            await window.setDoc(userDocRef, { personagens: characters, name: user.displayName, email: user.email }, { merge: true });
          } catch (e) {
            console.warn('Failed to save to Firebase DB', e);
          }
        }

        // Go to personagem with UID
        window.location.href = 'personagem.html?uid=' + encodeURIComponent(charUid);
      });
    }

    // Helper function
    function generateUuid() {
      return '' + Math.random().toString(36).substr(2) + Date.now();
    }

    // se quiser, podemos inserir a raça no nome ou em outro campo.
    // Exemplo (comentado): adicionar a raça ao final do nome se estiver vazio
    // if (nomeField && (!nomeField.textContent || nomeField.textContent.trim() === "")) {
    //   nomeField.textContent = `${racaNome} — `;
    // }
  }

  /* back button */
  const backBtns = document.querySelectorAll('.back-btn');
  backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!secClasse.classList.contains('hidden')) {
        showSection(secAtributos);
        localStorage.setItem('currentSection', 'atributos');
      } else if (!secRaca.classList.contains('hidden')) {
        showSection(secClasse);
        localStorage.setItem('currentSection', 'classe');
      } else if (!secResumo.classList.contains('hidden')) {
        showSection(secRaca);
        localStorage.setItem('currentSection', 'raca');
      }
    });
  });
  document.addEventListener('contextmenu', function (e) {
    const target = e.target.closest('.icon, .counter, .hex');
    if (!target) return;

    // Evita erros se a estrutura global não existir
    if (typeof window.clickCountGlobal !== 'object' || window.clickCountGlobal === null) window.clickCountGlobal = {};

    // Previna menu padrão somente quando for nossa ação
    if (!allowNextContextMenu) {
      e.preventDefault();

      const isIcon = target.classList.contains('icon');
      const nome = isIcon ? target.classList[1] : target.classList[1];
      if (!nome) {
        allowNextContextMenu = false;
        return;
      }

      // Garantir que há um número inicial
      clickCountGlobal[nome] = Number(clickCountGlobal[nome] ?? 0);

      // Regras de decremento: 0 -> -1 (gera penalty), > -1 -> decrementa; nunca abaixo de -1
      if (clickCountGlobal[nome] === 0) {
        clickCountGlobal[nome] = -1;
      } else if (clickCountGlobal[nome] > -1) {
        clickCountGlobal[nome] = clickCountGlobal[nome] - 1;
      } else {
        // já estava -1: mantém -1
        clickCountGlobal[nome] = -1;
      }

      if (clickCountGlobal[nome] < -1) clickCountGlobal[nome] = -1;

      // Atualiza a UI + recalcula flaws/pontos através da função central
      if (typeof recalcTotalsAndSave === 'function') {
        recalcTotalsAndSave();
      } else {
        // fallback seguro (mesma lógica da recalc em linha)
        window.flaws = Object.values(clickCountGlobal).filter(v => v < 0).length;
        window.maxPontos = 7 + (Number(window.flaws || 0));
        window.pontos = Object.values(clickCountGlobal).reduce((acc, v) => acc + (v > 0 ? v : 0), 0);
        document.querySelector('.num.right').textContent = String(window.maxPontos);
        document.querySelector('.num.left').textContent = String(window.pontos);
        localStorage.setItem('attributes', JSON.stringify(clickCountGlobal));
      }

      // atualiza o counter visual do atributo específico
      const ctr = document.querySelector(`.counter.${nome}`);
      if (ctr) ctr.textContent = String(clickCountGlobal[nome]);
    }

    allowNextContextMenu = false;
  });

  // Click on circle to proceed
  document.querySelector('.circle-container').addEventListener('click', () => {
    // Save attributes asynchronously, but don't block advancement
    (async () => {
      if (window.firebaseauth) {
        const user = window.firebaseauth.currentUser;
        if (user) {
          try {
            const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
            const docSnap = await window.getDoc(userRef);
            let userData = docSnap.exists() ? docSnap.data() : {};
            userData.atributos_temp = { ...clickCountGlobal };
            await window.setDoc(userRef, userData);
            console.log('Atributos salvos no realtime');
          } catch (error) {
            console.error('Erro ao salvar atributos no Firebase (bloqueado?), salvando localmente:', error);
            localStorage.setItem('atributos_temp', JSON.stringify(clickCountGlobal));
          }
        } else {
          localStorage.setItem('atributos_temp', JSON.stringify(clickCountGlobal));
        }
      } else {
        localStorage.setItem('atributos_temp', JSON.stringify(clickCountGlobal));
      }
    })();

    showSection(secClasse);
    localStorage.setItem('currentSection', 'classe');
  });

  // Allow normal context menu after double-click on targets
  document.addEventListener('dblclick', function (e) {
    const target = e.target.closest('.icon, .counter');
    if (target) {
      allowNextContextMenu = true;
    }
  });

  // Help icon: reutiliza o mesmo fluxo do mobile-info-btn (evita duplicar lógica)
  const helpIcon = document.querySelector('.help-icon');
  if (helpIcon) {
    helpIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = document.getElementById('mobile-info-btn');
      if (btn) {
        btn.click(); // delega todo o trabalho ao mesmo handler
      } else {
        // fallback mínimo: abre o modal (mas sem conteúdo dinâmico)
        const modal = document.getElementById('help-modal');
        if (modal) {
          modal.classList.remove('hidden');
          modal.style.display = 'flex';
        }
      }
    });
  }


  /* =========================
   Mobile-only: mostrar descrição de raça como modal
   e adicionar botão "Escolher" que leva ao resumo.
   Para Feéricos: escolher -> abrir modal de sub-raças (já existente).
   ========================= */

  (function mobileRaceModalFlow() {
    const mq = window.matchMedia('(max-width: 768px)');
    let attached = false;

    function getRaceTexts(raca) {
      // Mesmo texto usado no JS principal (mantido aqui para consistência mobile)
      let desc = '';
      let bonus = '';
      switch (raca) {
        case 'Anão':
          desc = "Os anões são o reflexo das montanhas de Herta: firmes, engenhosos e incansáveis. Vivem para construir, beber e lutar, acreditando que o trabalho é a forma mais pura de oração.";
          bonus = "Recebem +1 em aumento de Vida por nível devido à sua robustez e resistência natural.";
          break;
        case 'Feéricos':
          desc = "Os feéricos são herdeiros das criaturas místicas que outrora dançavam sob a luz dos deuses. Cada um nasce ligado ao espírito de um animal primordial, e dessa união surge seu poder singular.";
          bonus = "Ágeis: +1 Técnica • Voadores: +2 deslocamento • Robustos: Bloqueio sem escudo.";
          break;
        case 'Elfo':
          desc = "Os elfos de Flodia são filhos do conhecimento e da melancolia. Dotados de uma mente afiada e olhar distante, estudam o mundo como quem busca compreender um segredo esquecido.";
          bonus = "Recebem +1 em Intelecto e podem aprender +1 feitiço ao alcançar o nível inicial.";
          break;
        case 'Meio Orc':
          desc = "Forjados nas guerras do leste, os meio-orcs são a fusão da brutalidade e da disciplina. Soldados por tradição, acreditam que a glória está no confronto direto.";
          bonus = "Recebem +1 em testes de Iniciativa e +1 em Bravura.";
          break;
        default:
          desc = '';
          bonus = '';
      }
      return { desc, bonus };
    }

    function createMobileRacaModalIfNeeded() {
      if (document.getElementById('raca-desc-modal')) return;
      const modal = document.createElement('div');
      modal.id = 'raca-desc-modal';
      modal.className = 'modal hidden';
      modal.style.display = 'none';
      modal.innerHTML = `
      <div class="modal-content">
        <button class="close-btn" aria-label="Fechar">&times;</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:8px;">
          <div class="descricao-icon"><img src="" alt="ícone raça"></div>
          <h3 class="modal-raca-title"></h3>
          <div class="descricao-texto"><p></p><p class="bonus"></p></div>
          <button class="escolher-btn">Escolher</button>
        </div>
      </div>`;
      document.body.appendChild(modal);

      // close handlers
      modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      });
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
          modal.style.display = 'none';
        }
      });
    }

    function attachMobileHandlers() {
      if (attached) return;
      createMobileRacaModalIfNeeded();

      const racaCards = Array.from(document.querySelectorAll('.raca-card'));
      racaCards.forEach(rc => {
        if (rc._mobileHandlerAttached) return;
        // named handler so we can remove later
        const handler = function (e) {
          // prevent other click handlers (desktop flow) from running when mobile
          e.stopImmediatePropagation();
          e.preventDefault();

          const racaNome = rc.dataset.raca || (rc.querySelector('p')?.textContent || '—');
          const iconSrc = rc.querySelector('img')?.src || '';

          const { desc, bonus } = getRaceTexts(racaNome);
          const modal = document.getElementById('raca-desc-modal');
          modal.querySelector('.modal-raca-title').textContent = racaNome;
          const imgEl = modal.querySelector('.descricao-icon img');
          imgEl.src = iconSrc;
          modal.querySelector('.descricao-texto p').textContent = desc;
          modal.querySelector('.descricao-texto .bonus').textContent = bonus;

          const escolherBtn = modal.querySelector('.escolher-btn');

          // remove previous click binding (safe)
          escolherBtn.onclick = null;

          escolherBtn.onclick = () => {
            // close description modal
            modal.classList.add('hidden');
            modal.style.display = 'none';

            if (racaNome === 'Feéricos') {
              // open existing ferico-modal (HTML already has it)
              const fm = document.getElementById('ferico-modal');
              if (fm) {
                fm.classList.remove('hidden');
                fm.style.display = 'flex';

                // attach subraca clicks once (use {once:true} on each to avoid duplication)
                document.querySelectorAll('.subraca-card').forEach(subCard => {
                  subCard.addEventListener('click', function (ev) {
                    ev.preventDefault();
                    const sub = subCard.dataset.subraca;
                    localStorage.setItem('selectedSubrace', sub);
                    // close ferico modal
                    fm.classList.add('hidden');
                    fm.style.display = 'none';
                    // proceed to resumo (usa função existente)
                    if (typeof proceedToResumo === 'function') proceedToResumo('Feéricos', sub);
                  }, { once: true });
                });
              } else {
                // fallback: directly go to resumo without subraca (shouldn't happen)
                if (typeof proceedToResumo === 'function') proceedToResumo('Feéricos', null);
              }
            } else {
              // not feéricos: go straight to resumo
              if (typeof proceedToResumo === 'function') proceedToResumo(racaNome, null);
            }
          };

          // show modal
          modal.style.display = 'flex';
          modal.classList.remove('hidden');
        };

        // attach in capture phase so it runs before existing bubble listeners
        rc.addEventListener('click', handler, { capture: true });
        rc._mobileHandler = handler;
        rc._mobileHandlerAttached = true;
      });

      attached = true;
    }

    function detachMobileHandlers() {
      if (!attached) return;
      const racaCards = Array.from(document.querySelectorAll('.raca-card'));
      racaCards.forEach(rc => {
        if (rc._mobileHandler) {
          rc.removeEventListener('click', rc._mobileHandler, { capture: true });
          delete rc._mobileHandler;
          rc._mobileHandlerAttached = false;
        }
      });
      attached = false;
    }

    // on load and on resize toggle
    function check() {
      if (mq.matches) attachMobileHandlers();
      else detachMobileHandlers();
    }

    // initial
    check();
    // respond to changes
    mq.addEventListener ? mq.addEventListener('change', check) : mq.addListener(check);
    window.addEventListener('resize', check);
  })();
  /* ---------------------------
     Mobile nav behavior (home / profile / signout toggle)
     Paste inside criacao_personagem.js (DOM ready)
     --------------------------- */

  document.addEventListener('DOMContentLoaded', () => {
    const mobileHomeBtn = document.getElementById('mobile-home-btn');
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    const mobileNavContainer = document.querySelector('.mobile-nav-buttons');

    // ---------- Mobile INFO modal (abre conteúdo contextual conforme section visível) ----------
    (function attachMobileInfoModal() {
      const mobileInfoBtn = document.getElementById('mobile-info-btn');
      const helpModal = document.getElementById('help-modal'); // já existe no HTML
      if (!mobileInfoBtn || !helpModal) return;

      const modalContent = helpModal.querySelector('.modal-content');
      const modalLeft = modalContent.querySelector('.modal-left');
      const modalRight = modalContent.querySelector('.modal-right');
      const closeBtn = modalContent.querySelector('.close-btn');

      // textos solicitados (mantive quebras para legibilidade)
      const texts = {
        atributos: {
          left: `Nas Terras de Ébito, cada ser nasce 
marcado por forças que o moldam
coragem, fé, astúcia ou simplesmente a
vontade de sobreviver. Criar um
personagem é o primeiro passo para
adentrar esse mundo, onde cada escolha
define o destino e cada fraqueza carrega 
um preço. Aqui se esculpe a alma do
aventureiro, aquele que desafiará os 
limites da carne e do espírito.`,
          rightTitle: 'Atributos',
          right: `Os atributos representam o que há de
mais essencial em cada personagem:
sua força interior e suas limitações. Eles
definem não apenas o que o herói é 
capaz de fazer, mas também o que ele
teme e evita.`
        },
        classe: {
          left: `As classes são caminhos de propósito
e destino. Elas não são apenas
ofícios, mas manifestações da forma 
como cada personagem vive.`,
          rightTitle: '',
          right: `<p><strong>Escudeiro</strong> ergue o escudo diante do 
caos, a muralha entre o perigo e os que
ama.</p>
<p><strong>Arcanista</strong> manipula o véu invisível da
magia, dobrando a realidade à sua
vontade.</p>
<p><strong>Errante</strong> vive entre a lâmina e o
vento, movendo-se como uma
sombra letal.</p>
<p><strong>Luminar</strong> brilha com fé e esperança, 
sendo a luz que resiste quando tudo 
escurece.</p>`
        },
        raca: {
          center: `Em Ébito, cada raça carrega a memória de um passado que se recusa a morrer.
Os deuses se calaram, mas o sangue antigo ainda fala por meio dos corpos, instintos
e dons de cada povo.`
        },
        resumo: {
          leftTitle: 'Valores Fixos Iniciais',
          left: `Todos os personagens
compartilham algumas bases
que moldam seus limites físicos 
e espirituais.
O <strong>deslocamento</strong> inicial é de 7 blocos de movimento.`,
          right: `A <strong>carga máxima</strong> é igual a 8 mais
o valor de Bravura.
O <strong>nível de equipamento</strong> começa 
em (Nível + 1).
Exemplo: Um escudeiro nível 1
pode usar um escudo nível 2.
A <strong>defesa inicial</strong> é zero, 
modificada apenas pelos equipamentos.`
        }
      };

      // Util: determina qual section está visível (procura a primeira sem .hidden)
      // versão robusta para detectar a section visível no DOM
      function getVisibleSectionKey() {
        const mapping = {
          atributos: document.querySelector('.atributos'),
          classe: document.querySelector('.classe'),
          raca: document.querySelector('.raca'),
          resumo: document.querySelector('.resumo')
        };

        // verifica visibilidade computada (display/offsetParent/dimensions)
        const isVisible = (el) => {
          if (!el) return false;
          // se conter a classe hidden explicitamente, consideramos invisível
          if (el.classList && el.classList.contains('hidden')) return false;
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
          // offsetParent null indica layout:hidden (display:none) ou position offscreen
          if (el.offsetParent === null && !(cs.position && cs.position === 'fixed')) return false;
          // width/height zero -> invisível
          if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
          return true;
        };

        // retorna a primeira section considerada visível (na ordem do mapping)
        for (const key of Object.keys(mapping)) {
          const el = mapping[key];
          if (isVisible(el)) return key;
        }

        // fallback: se nada estiver visível, checa localStorage/currentSection
        const cur = localStorage.getItem('currentSection');
        if (cur && mapping[cur]) return cur;

        // último fallback: atributos
        return 'atributos';
      }


      function openHelpModalFor(sectionKey) {
        // Reset content
        modalContent.classList.remove('modal-centered');
        modalLeft.style.display = '';
        modalRight.style.display = '';

        if (sectionKey === 'raca') {
          // centralizado - usa todo modal-content (esconde left/right flex split)
          modalContent.classList.add('modal-centered');
          modalLeft.style.display = 'none';
          modalRight.style.display = 'none';
          // limpa e insere centro
          modalContent.querySelector('.modal-centered-body')?.remove();
          const centerDiv = document.createElement('div');
          centerDiv.className = 'modal-centered-body';
          centerDiv.style.padding = '8px 12px';
          centerDiv.style.color = '#efeae6';
          centerDiv.style.textAlign = 'center';
          centerDiv.innerHTML = `<p style="white-space:pre-line;line-height:1.35;font-size:1rem">${texts.raca.center}</p>`;
          modalContent.appendChild(centerDiv);
        } else {
          // remove any existing centered body
          modalContent.querySelector('.modal-centered-body')?.remove();
          // populate left and right
          const t = texts[sectionKey];
          modalLeft.innerHTML = `<div style="white-space:pre-line;line-height:1.35">${t.left || ''}</div>`;
          // if there's a rightTitle (for resumo leftTitle), we show it
          if (sectionKey === 'resumo') {
            modalLeft.innerHTML = `<h3 style="margin-top:0;margin-bottom:8px">${t.leftTitle || ''}</h3>` + `<div style="white-space:pre-line;line-height:1.35">${t.left}</div>`;
          }
          if (sectionKey === 'atributos' || sectionKey === 'classe' || sectionKey === 'resumo') {
            // right column: for atributos we want a title over right text
            const rightHTML = (t.rightTitle ? `<h3 style="margin-top:0;margin-bottom:8px">${t.rightTitle}</h3>` : '') + `<div style="white-space:pre-line;line-height:1.35">${t.right || ''}</div>`;
            modalRight.innerHTML = rightHTML;
          } else {
            modalRight.innerHTML = '';
          }
        }

        // show modal
        helpModal.style.display = 'flex';
        helpModal.classList.remove('hidden');
        // ensure focus on closeBtn for accessibility on mobile
        setTimeout(() => closeBtn.focus(), 40);
      }

      // close modal helper
      function closeHelpModal() {
        // hide and clear any centered body
        helpModal.classList.add('hidden');
        helpModal.style.display = 'none';
        modalContent.querySelector('.modal-centered-body')?.remove();
      }

      // clicking the mobile button
      mobileInfoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = getVisibleSectionKey();
        openHelpModalFor(key);
      });

      // close button
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeHelpModal();
      });

      // close when click on overlay (fora do .modal-content)
      helpModal.addEventListener('click', (ev) => {
        if (ev.target === helpModal) closeHelpModal();
      });

      // also close on Escape for accessibility
      document.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape' && helpModal && !helpModal.classList.contains('hidden')) {
          closeHelpModal();
        }
      });
    })();


    // cria/atualiza botão de profile mobile (imagem quando logado)
    function updateMobileProfile(user) {
      if (!mobileProfileBtn) return;
      // limpa conteúdo atual
      mobileProfileBtn.innerHTML = '';
      if (user && user.photoURL) {
        const img = document.createElement('img');
        img.src = user.photoURL;
        img.alt = 'Profile';
        mobileProfileBtn.appendChild(img);
      } else {
        mobileProfileBtn.innerHTML = '<i class="fas fa-user"></i>';
      }
    }

    // inicia login Google (usa mesma lógica já presente no projeto)
    async function startGoogleLogin() {
      if (!window.GoogleAuthProvider || !window.signInWithPopup) {
        console.warn('Firebase auth helpers não encontrados.');
        return;
      }
      const provider = new window.GoogleAuthProvider();
      try {
        await window.signInWithPopup(window.firebaseauth, provider);
      } catch (err) {
        console.error('Erro durante login Google (mobile):', err);
      }
    }

    // mostra/oculta botão "Sair" abaixo dos botões móveis (toggle)
    let mobileSignoutBtn = null;
    function showMobileSignout() {
      // se já existe, remove (toggle)
      if (mobileSignoutBtn) {
        mobileSignoutBtn.remove();
        mobileSignoutBtn = null;
        return;
      }
      if (!mobileNavContainer) return;

      mobileSignoutBtn = document.createElement('button');
      mobileSignoutBtn.className = 'mobile-signout';
      mobileSignoutBtn.textContent = 'Sair';
      // inline styles para garantir que apareça sem precisar de mais CSS
      Object.assign(mobileSignoutBtn.style, {
        marginTop: '8px',
        padding: '6px 10px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        background: 'rgba(92,34,34,0.95)',
        color: '#efe6e2',
        fontFamily: 'MedievalSharp, serif',
        zIndex: '1200',
        boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
      });

      mobileSignoutBtn.onclick = async (e) => {
        e.stopPropagation();
        try {
          await window.firebaseauth.signOut();
          if (mobileSignoutBtn) { mobileSignoutBtn.remove(); mobileSignoutBtn = null; }
        } catch (err) {
          console.error('Erro ao deslogar (mobile):', err);
        }
      };

      // fecha ao clicar fora
      const onDocClick = (ev) => {
        if (!mobileSignoutBtn.contains(ev.target) && ev.target !== mobileProfileBtn) {
          if (mobileSignoutBtn) { mobileSignoutBtn.remove(); mobileSignoutBtn = null; }
          document.removeEventListener('click', onDocClick);
        }
      };
      document.addEventListener('click', onDocClick);

      mobileNavContainer.appendChild(mobileSignoutBtn);
    }

    // Binds
    if (mobileHomeBtn) {
      mobileHomeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
      });
    }

    if (mobileProfileBtn) {
      mobileProfileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const user = window.firebaseauth && window.firebaseauth.currentUser;
        if (user) {
          showMobileSignout();
        } else {
          startGoogleLogin();
        }
      });
    }

    // Integrar com observer de auth já existente: atualiza o botão mobile sempre que muda o auth
    if (window.firebaseauth && window.onAuthStateChanged) {
      window.onAuthStateChanged(window.firebaseauth, (user) => {
        updateMobileProfile(user);
        if (!user && mobileSignoutBtn) {
          mobileSignoutBtn.remove();
          mobileSignoutBtn = null;
        }
      });
    } else {
      // fallback: tenta atualizar com localStorage info (se houver)
      const stored = localStorage.getItem('userLoggedIn');
      if (!stored) updateMobileProfile(null);
    }
  });


});


// --------- Mobile info modal (único handler robusto) ----------
document.addEventListener('DOMContentLoaded', () => {
  const mobileInfoBtn = document.getElementById('mobile-info-btn');
  const helpModal = document.getElementById('help-modal');
  if (!mobileInfoBtn || !helpModal) return;

  const modalContent = helpModal.querySelector('.modal-content');
  // garante que existam as colunas; caso não existam, criamos (compatibilidade)
  let modalLeft = modalContent.querySelector('.modal-left');
  let modalRight = modalContent.querySelector('.modal-right');
  const existingClose = modalContent.querySelector('.close-btn');

  if (!modalLeft) {
    modalLeft = document.createElement('div');
    modalLeft.className = 'modal-left';
    modalContent.insertBefore(modalLeft, modalContent.firstChild);
  }
  if (!modalRight) {
    modalRight = document.createElement('div');
    modalRight.className = 'modal-right';
    // inserir antes do close button, se existir
    if (existingClose) modalContent.insertBefore(modalRight, existingClose);
    else modalContent.appendChild(modalRight);
  }
  const closeBtn = modalContent.querySelector('.close-btn') || existingClose;

  const texts = {
    atributos: {
      left: `Nas Terras de Ébito, cada ser nasce 
marcado por forças que o moldam
coragem, fé, astúcia ou simplesmente a
vontade de sobreviver. Criar um
personagem é o primeiro passo para
adentrar esse mundo, onde cada escolha
define o destino e cada fraqueza carrega 
um preço. Aqui se esculpe a alma do
aventureiro, aquele que desafiará os 
limites da carne e do espírito.`,
      rightTitle: 'Atributos',
      right: `Os atributos representam o que há de
mais essencial em cada personagem:
sua força interior e suas limitações. Eles
definem não apenas o que o herói é 
capaz de fazer, mas também o que ele
teme e evita.`
    },
    classe: {
      left: `As classes são caminhos de propósito
e destino. Elas não são apenas
ofícios, mas manifestações da forma 
como cada personagem vive.`,
      right: `<p><strong>Escudeiro</strong> ergue o escudo diante do 
caos, a muralha entre o perigo e os que
ama.</p>
<p><strong>Arcanista</strong> manipula o véu invisível da
magia, dobrando a realidade à sua
vontade.</p>
<p><strong>Errante</strong> vive entre a lâmina e o
vento, movendo-se como uma
sombra letal.</p>
<p><strong>Luminar</strong> brilha com fé e esperança, 
sendo a luz que resiste quando tudo 
escurece.</p>`
    },
    raca: {
      center: `Em Ébito, cada raça carrega a memória de um passado que se recusa a morrer.
Os deuses se calaram, mas o sangue antigo ainda fala por meio dos corpos, instintos
e dons de cada povo.`
    },
    resumo: {
      leftTitle: 'Valores Fixos Iniciais',
      left: `Todos os personagens
compartilham algumas bases
que moldam seus limites físicos 
e espirituais.
O <strong>deslocamento</strong> inicial é de 7 blocos de movimento.`,
      right: `A <strong>carga máxima</strong> é igual a 8 mais
o valor de Bravura.
O <strong>nível de equipamento</strong> começa 
em (Nível + 1).
Exemplo: Um escudeiro nível 1
pode usar um escudo nível 2.
A <strong>defesa inicial</strong> é zero, 
modificada apenas pelos equipamentos.`
    }
  };

  // detecta qual section está realmente visível (primeiro: localStorage, depois checagem robusta)
  function detectSectionKey() {
    const byStorage = localStorage.getItem('currentSection');
    const mapping = { atributos: document.querySelector('.atributos'), classe: document.querySelector('.classe'), raca: document.querySelector('.raca'), resumo: document.querySelector('.resumo') };
    if (byStorage && mapping[byStorage]) return byStorage;

    // ordem de prioridade: atributos, classe, raca, resumo (igual ao pedido)
    for (const k of ['atributos', 'classe', 'raca', 'resumo']) {
      const el = mapping[k];
      if (!el) continue;
      if (el.classList && el.classList.contains('hidden')) continue;
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      if (el.offsetParent === null && cs.position !== 'fixed') continue;
      if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
      // se passou todas, consideramos visível
      return k;
    }
    // fallback
    return 'atributos';
  }

  // popula o modal conforme a chave
  function populateModal(key) {
    // limpa centered body se houver
    modalContent.querySelector('.modal-centered-body')?.remove();
    modalContent.classList.remove('modal-centered');
    // reset display
    modalLeft.style.display = '';
    modalRight.style.display = '';

    if (key === 'raca') {
      // centralizado
      modalLeft.style.display = 'none';
      modalRight.style.display = 'none';
      modalContent.classList.add('modal-centered');
      const center = document.createElement('div');
      center.className = 'modal-centered-body';
      center.style.padding = '8px 12px';
      center.style.color = '#efeae6';
      center.style.textAlign = 'center';
      center.innerHTML = `<p style="white-space:pre-line;line-height:1.35;font-size:1rem">${texts.raca.center}</p>`;
      modalContent.appendChild(center);
      return;
    }

    // outros: mostra left e right
    const t = texts[key] || {};
    if (key === 'resumo') {
      modalLeft.innerHTML = `<h3 style="margin-top:0;margin-bottom:8px">${t.leftTitle || ''}</h3><div style="white-space:pre-line;line-height:1.35">${t.left || ''}</div>`;
    } else {
      modalLeft.innerHTML = `<div style="white-space:pre-line;line-height:1.35">${t.left || ''}</div>`;
    }

    const rightHTML = (t.rightTitle ? `<h3 style="margin-top:0;margin-bottom:8px">${t.rightTitle}</h3>` : '') + `<div style="white-space:pre-line;line-height:1.35">${t.right || ''}</div>`;
    modalRight.innerHTML = rightHTML;
  }

  function openModalForCurrentSection() {
    const key = detectSectionKey();
    populateModal(key);
    helpModal.style.display = 'flex';
    helpModal.classList.remove('hidden');
    // foco no botão fechar para acessibilidade
    setTimeout(() => { if (closeBtn) closeBtn.focus(); }, 40);
  }

  // handler único do botão de info
  mobileInfoBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openModalForCurrentSection();
  });

  // fechar
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      helpModal.classList.add('hidden');
      helpModal.style.display = 'none';
      modalContent.querySelector('.modal-centered-body')?.remove();
    });
  }

  // fechar ao clicar fora
  helpModal.addEventListener('click', (ev) => {
    if (ev.target === helpModal) {
      helpModal.classList.add('hidden');
      helpModal.style.display = 'none';
      modalContent.querySelector('.modal-centered-body')?.remove();
    }
  });

  // ESC fecha
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !helpModal.classList.contains('hidden')) {
      helpModal.classList.add('hidden');
      helpModal.style.display = 'none';
      modalContent.querySelector('.modal-centered-body')?.remove();
    }
  });
});

/* ---------- Robust Inline SVG draw + fire effect (substituir o bloco antigo) ---------- */
(function () {
  const LOGO_COLOR = '#5C2222';
  const container = document.querySelector('.circle-container');
  if (!container) {
    console.warn('Nenhuma .circle-container encontrada.');
    return;
  }
  const img = container.querySelector('img.circle');
  if (!img) {
    console.warn('Nenhuma <img class="circle"> encontrada dentro de .circle-container.');
    return;
  }
  const src = img.getAttribute('src');
  if (!src) {
    console.warn('A <img> não tem src.');
    return;
  }

  // util: parse string -> svg element
  function parseSvgFromText(svgText) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgText, 'image/svg+xml');
      let svg = doc.querySelector('svg');
      if (!svg) return null;
      svg = document.importNode(svg, true);
      return svg;
    } catch (e) {
      return null;
    }
  }

  // tenta fetch de texto (funciona em servidor http(s))
  function tryFetchText(src) {
    return fetch(src, { cache: "no-store" })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
  }

  // tenta XHR como documento (alguns ambientes permitem)
  function tryXhrDocument(src) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', src, true);
        xhr.responseType = 'document';
        xhr.overrideMimeType && xhr.overrideMimeType('image/svg+xml');
        xhr.onload = function () {
          if (xhr.status === 0 || (xhr.status >= 200 && xhr.status < 400)) {
            const doc = xhr.responseXML || (new DOMParser().parseFromString(xhr.responseText || '', 'image/svg+xml'));
            const svg = doc ? doc.querySelector('svg') : null;
            if (svg) resolve(new XMLSerializer().serializeToString(svg));
            else reject(new Error('document sem <svg>'));
          } else {
            reject(new Error('XHR HTTP ' + xhr.status));
          }
        };
        xhr.onerror = () => reject(new Error('XHR network error'));
        xhr.send();
      } catch (e) {
        reject(e);
      }
    });
  }

  // tenta carregar via <object> e ler contentDocument (último recurso)
  function tryObjectLoad(src) {
    return new Promise((resolve, reject) => {
      const obj = document.createElement('object');
      obj.type = 'image/svg+xml';
      obj.data = src;
      obj.style.position = 'absolute';
      obj.style.left = '-9999px';
      document.body.appendChild(obj);
      const timeout = setTimeout(() => {
        document.body.removeChild(obj);
        reject(new Error('object load timeout'));
      }, 3000);
      obj.onload = function () {
        try {
          const doc = obj.contentDocument;
          const svg = doc && doc.querySelector('svg');
          if (svg) {
            const svgText = new XMLSerializer().serializeToString(svg);
            clearTimeout(timeout);
            document.body.removeChild(obj);
            resolve(svgText);
          } else {
            clearTimeout(timeout);
            document.body.removeChild(obj);
            reject(new Error('object: sem <svg>'));
          }
        } catch (e) {
          clearTimeout(timeout);
          document.body.removeChild(obj);
          reject(e);
        }
      };
      obj.onerror = function (e) {
        clearTimeout(timeout);
        try { document.body.removeChild(obj); } catch (_) { }
        reject(new Error('object error'));
      };
    });
  }

  // principal: tenta as estratégias em cadeia
  (async function loadAndInline() {
    let svgText = null;
    let lastErr = null;

    // 1) fetch
    try {
      svgText = await tryFetchText(src);
      console.log('SVG carregado via fetch:', src);
    } catch (e) {
      lastErr = e;
      console.warn('fetch falhou para', src, e);
    }

    // 2) XHR document
    if (!svgText) {
      try {
        svgText = await tryXhrDocument(src);
        console.log('SVG carregado via XHR document:', src);
      } catch (e) {
        lastErr = e;
        console.warn('XHR document falhou para', src, e);
      }
    }

    // 3) object fallback
    if (!svgText) {
      try {
        svgText = await tryObjectLoad(src);
        console.log('SVG carregado via <object> (contentDocument):', src);
      } catch (e) {
        lastErr = e;
        console.warn('<object> fallback falhou para', src, e);
      }
    }

    if (!svgText) {
      console.error('Falha ao obter SVG por todas as estratégias. Erro final:', lastErr);
      // mantém <img> visível para fallback visual
      img.style.visibility = 'visible';
      return;
    }

    const svg = parseSvgFromText(svgText);
    if (!svg) {
      console.error('Não foi possível parsear o SVG recebido como XML.');
      img.style.visibility = 'visible';
      return;
    }

    // marque a svg com a classe 'circle' para pegar seu CSS (.circle { ... })
    svg.classList.add('circle');
    svg.classList.add('logo-svg');
    svg.style.width = svg.style.width || '200px';
    svg.style.height = svg.style.height || '200px';
    svg.style.position = 'relative';
    svg.style.zIndex = 3;
    svg.style.visibility = 'hidden'; // esconder até preparar

    // substitui a <img> inline
    try { img.replaceWith(svg); } catch (e) { console.warn('replaceWith falhou', e); }

    // Coerce shapes to stroke + set color
    let shapes = svg.querySelectorAll('path, line, polyline, rect, circle, ellipse, polygon');

    if (shapes.length === 0) {
      // tenta transformar fills em stroke para visual de traço
      const candidates = Array.from(svg.querySelectorAll('*')).filter(el => {
        const tag = el.tagName?.toLowerCase?.();
        if (!tag) return false;
        if (['defs', 'metadata', 'style', 'title', 'desc', 'script'].includes(tag)) return false;
        const fill = el.getAttribute && el.getAttribute('fill');
        const style = el.getAttribute && el.getAttribute('style') || '';
        const hasFillInStyle = /fill\s*:\s*[^;]+/.test(style);
        return (fill && fill !== 'none') || hasFillInStyle;
      });
      candidates.forEach(el => {
        try {
          el.setAttribute('stroke', LOGO_COLOR);
          if (!el.getAttribute('stroke-width')) el.setAttribute('stroke-width', '3');
          if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') el.setAttribute('fill', 'none');
        } catch (_) { }
      });
      shapes = svg.querySelectorAll('path, line, polyline, rect, circle, ellipse, polygon');
    }

    if (shapes.length === 0) {
      // último recurso: aplica stroke em todos
      const all = svg.querySelectorAll('*');
      all.forEach(el => {
        try {
          if (el instanceof SVGElement) {
            if (!el.getAttribute('stroke') || el.getAttribute('stroke') === 'none') el.setAttribute('stroke', LOGO_COLOR);
            if (!el.getAttribute('stroke-width')) el.setAttribute('stroke-width', '3');
            if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') el.setAttribute('fill', 'none');
          }
        } catch (_) { }
      });
    }

    // agora animar os traços (como antes)
    const drawable = svg.querySelectorAll('path, line, polyline, rect, circle, ellipse, polygon');
    if (drawable.length === 0) {
      // nada para animar — mostra SVG e sai
      svg.style.visibility = 'visible';
      console.warn('SVG inline inserido, mas não foram encontradas formas vetoriais para animar.');
      return;
    }

    drawable.forEach((el, i) => {
      try {
        el.setAttribute('stroke', LOGO_COLOR);
        if (!el.getAttribute('stroke-width')) el.setAttribute('stroke-width', '3');
        if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') el.setAttribute('fill', 'none');
      } catch (_) { }

      let length = 200;
      try {
        if (typeof el.getTotalLength === 'function') {
          length = el.getTotalLength();
          if (!length || length <= 0) {
            const bb = el.getBBox ? el.getBBox() : { width: 50, height: 50 };
            length = Math.hypot(bb.width, bb.height) * 2;
          }
        } else {
          const bb = el.getBBox ? el.getBBox() : { width: 50, height: 50 };
          length = Math.hypot(bb.width, bb.height) * 2;
        }
      } catch (e) {
        try { const bb = el.getBBox ? el.getBBox() : { width: 50, height: 50 }; length = Math.hypot(bb.width, bb.height) * 2; } catch (ex) { length = 200; }
      }

      el.style.strokeDasharray = length;
      el.style.strokeDashoffset = length;
      el.style.transition = 'stroke 0.15s linear';
      const delay = (i * 0.06);
      el.style.animation = `draw 0.9s ${delay}s linear forwards`;
      el.classList.add('logo-path');
    });

    /* ---------- shimmer contínuo + hover-fill melhorado (substitui o bloco anterior) ---------- */
    try {
      // força tamanho maior
      svg.style.width = '340px';
      svg.style.height = '340px';

      const SHINE_COLOR = '#FFD27A';
      const FILL_COLOR = SHINE_COLOR; // cor do preenchimento ao hover
      const baseStroke = 3;

      // cria clones de brilho (2 clones por path, offsetados) + clone de 'fill' por path
      drawable.forEach((el, i) => {
        try {
          // assegura stroke base
          el.setAttribute('stroke', LOGO_COLOR);
          if (!el.getAttribute('stroke-width')) el.setAttribute('stroke-width', String(baseStroke));
          if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') el.setAttribute('fill', 'none');

          // comprimento do path (fallback robusto)
          let length = 200;
          try {
            if (typeof el.getTotalLength === 'function') {
              length = el.getTotalLength();
              if (!length || length <= 0) {
                const bb = el.getBBox ? el.getBBox() : { width: 50, height: 50 };
                length = Math.hypot(bb.width, bb.height) * 2;
              }
            } else {
              const bb = el.getBBox ? el.getBBox() : { width: 50, height: 50 };
              length = Math.hypot(bb.width, bb.height) * 2;
            }
          } catch (e) {
            try { const bb = el.getBBox ? el.getBBox() : { width: 50, height: 50 }; length = Math.hypot(bb.width, bb.height) * 2; } catch (ex) { length = 200; }
          }

          // parámetro do "segmento brilhante"
          const dashLen = Math.max(Math.round(length * 0.12), 6); // segmento visível
          const gap = Math.max(Math.round(length * 0.8), dashLen + 10);

          // duração proporcional ao comprimento (evita loop muito rápido em paths longos)
          const duration = Math.max(1.6, Math.min(4.0, length / 120)) * 2.50; // em segundos (slowed 25%)
          const half = duration / 2;

          // função que cria um clone de shine com delay específico
          const makeShineClone = (delaySeconds) => {
            const shine = el.cloneNode(true);
            shine.removeAttribute('id');
            shine.removeAttribute('name');
            shine.classList.add('logo-shine');
            shine.setAttribute('stroke', SHINE_COLOR);
            const baseW = parseFloat(el.getAttribute('stroke-width') || baseStroke);
            const shineW = Math.max(baseW + 1.6, baseW * 1.2);
            shine.setAttribute('stroke-width', String(shineW));
            shine.setAttribute('fill', 'none');

            // dash pattern: um pequeno segmento brilhante e um gap grande
            shine.style.strokeDasharray = `${dashLen} ${gap}`;
            // inicial: começo deslocado para fora do path (começa em length)
            shine.style.strokeDashoffset = `${length}`;
            // define variáveis CSS para keyframes usarem
            shine.style.setProperty('--dash-start', `${length}px`);
            shine.style.setProperty('--dash-end', `${-length}px`);
            shine.style.setProperty('--shine-dur', `${duration}s`);
            // define a animação com delay (duas camadas offsetadas criam continuidade)
            shine.style.animation = `shine ${duration}s ${delaySeconds}s linear infinite`;
            // inserir logo-shine após o elemento original
            if (el.parentNode) el.parentNode.insertBefore(shine, el.nextSibling);
            else svg.appendChild(shine);
            return shine;
          };

          // cria duas camadas offsetadas (0 e half) — evita salto visível no reinício
          makeShineClone(0);
          makeShineClone(half * -1); // negative delay faz com que a segunda comece "meio-caminho" já em andamento

          // ------ cria clone fill (por baixo do stroke) para o efeito de preenchimento no hover ------
          // só faz sentido se for um path fechável; ainda assim funciona como overlay
          const fillClone = el.cloneNode(true);
          fillClone.removeAttribute('id');
          fillClone.removeAttribute('name');
          fillClone.classList.add('logo-fill');
          fillClone.setAttribute('fill', FILL_COLOR);
          fillClone.setAttribute('stroke', 'none');
          // início invisível (fill-opacity = 0). O JS irá animar fillOpacity ao hover com delays
          fillClone.style.fillOpacity = '0';
          // posiciona o fill clone **antes** do elemento original para que o stroke continue visível por cima
          if (el.parentNode) el.parentNode.insertBefore(fillClone, el);
          else svg.appendChild(fillClone);

          // armazena referência para usar no hover handlers
          el._fillClone = fillClone;

          // Também guardamos comprimento para possíveis debugging
          el._length = length;

        } catch (err) {
          console.warn('Erro ao processar drawable para shimmer/fill', err);
        }
      });

      // ---------------- Hover handlers para simular preenchimento progressivo ---------------
      // Ao entrar: percorre as shapes e, com pequeno stagger, aumenta fillOpacity para 1
      // Ao sair: reverte fillOpacity para 0
      const hoverEnter = (ev) => {
        // marca container para CSS (opcional)
        container.classList.add('logo-fill-active');
        drawable.forEach((el, i) => {
          const fc = el._fillClone;
          if (!fc) return;
          // stagger em 40ms por elemento
          const d = i * 40;
          // garantir transição com delay por clone
          fc.style.transition = `fill-opacity 560ms cubic-bezier(.2,.9,.3,1) ${d}ms`;
          // seta para visível
          setTimeout(() => { try { fc.style.fillOpacity = '1'; } catch (e) { } }, d);
        });
      };

      const hoverLeave = (ev) => {
        container.classList.remove('logo-fill-active');
        drawable.forEach((el, i) => {
          const fc = el._fillClone;
          if (!fc) return;
          // reverse: sem delay ou com pequeno delay inverso
          const d = 0;
          fc.style.transition = `fill-opacity 420ms ease ${d}ms`;
          setTimeout(() => { try { fc.style.fillOpacity = '0'; } catch (e) { } }, d);
        });
      };

      // attach handlers on svg (ou container): mouseenter/mouseleave and touch events
      svg.addEventListener('mouseenter', hoverEnter);
      svg.addEventListener('mouseleave', hoverLeave);
      // mobile: touchstart toggles briefly
      svg.addEventListener('touchstart', (e) => {
        hoverEnter();
        // auto-revert after 1200ms
        setTimeout(hoverLeave, 1200);
      });

    } catch (err) {
      console.warn('Erro ao aplicar shimmer/jhover avançado:', err);
    }



    const estimatedTotalMs = Math.round(900 + drawable.length * 60 + 300);
    setTimeout(() => {
      container.classList.add('logo-drawn');
      container.classList.add('logo-fire-pulse');
      svg.classList.add('logo-drawn');
      svg.style.visibility = 'visible';
      console.log('Animação do logo iniciada; cor aplicada:', LOGO_COLOR);
    }, estimatedTotalMs);

  })();
})();

// -----------------------------
// Modal backdrop + Esc close
// -----------------------------
document.addEventListener('DOMContentLoaded', () => {
  const allModals = Array.from(document.querySelectorAll('.modal'));

  function closeModal(modal) {
    // mantém compatibilidade com o padrão usado no seu código
    modal.classList.add('hidden');
    try { modal.style.display = 'none'; } catch (e) { /*silent*/ }
  }

  allModals.forEach(modal => {
    // se o modal tiver .modal-content, evita que clique dentro feche
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });
    }

    // clique no backdrop (quando target === modal) fecha
    modal.addEventListener('click', (ev) => {
      if (ev.target === modal) {
        closeModal(modal);
      }
    });

    // fecha ao clicar em qualquer botão .close-btn dentro do modal
    const closeBtn = modal.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        closeModal(modal);
      });
    }
  });

  // Esc fecha qualquer modal aberto
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      allModals.forEach(m => {
        if (!m.classList.contains('hidden')) closeModal(m);
      });
    }
  });
});

// ---- TUTORIAL BUTTON / MODAL (criacao_personagem) ----
document.addEventListener('DOMContentLoaded', () => {
  const tutoBtn = document.getElementById('tuto-btn');
  const tutoModal = document.getElementById('tuto-modal');
  const tutoClose = document.getElementById('tuto-close');

  if (!tutoBtn || !tutoModal || !tutoClose) return;

  function openTuto() {
    tutoModal.style.display = 'flex';
    tutoModal.classList.remove('hidden');
    tutoModal.setAttribute('aria-hidden', 'false');
    // focar botão fechar para acessibilidade
    setTimeout(() => { try { tutoClose.focus(); } catch (e) { } }, 40);
  }

  function closeTuto() {
    tutoModal.style.display = 'none';
    tutoModal.classList.add('hidden');
    tutoModal.setAttribute('aria-hidden', 'true');
  }

  // abrir ao clicar no botão (previne propagação)
  tutoBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    openTuto();
  });

  // fechar no botão X
  tutoClose.addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeTuto();
  });

  // fechar quando clicar fora do modal-content
  tutoModal.addEventListener('click', (ev) => {
    if (ev.target === tutoModal) closeTuto();
  });

  // fechar com Esc
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (tutoModal && !tutoModal.classList.contains('hidden')) {
        closeTuto();
      }
    }
  });

  // garantia extra: esconde botão em mobile por JS também (caso CSS não carregue)
  function updateTutoVisibility() {
    if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
      tutoBtn.style.display = 'none';
    } else {
      tutoBtn.style.display = '';
    }
  }
  updateTutoVisibility();
  window.addEventListener('resize', updateTutoVisibility);
});
