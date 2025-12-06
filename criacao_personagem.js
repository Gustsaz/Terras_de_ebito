let clickCountGlobal = {};
let allowNextContextMenu = false;

document.addEventListener("DOMContentLoaded", () => {
  // Ensure modal starts hidden
  document.getElementById('help-modal').classList.add('hidden');
  // Load from localStorage
  const savedAttributes = localStorage.getItem('attributes');
  if (savedAttributes) {
    clickCountGlobal = JSON.parse(savedAttributes);
    for (const key in clickCountGlobal) {
      clickCountGlobal[key] = Number(clickCountGlobal[key]) || 0;
    }
  }

  const icons = document.querySelectorAll(".icon");
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

  let pontos = Object.values(clickCountGlobal).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  let maxPontos = 7;
  let flaws = 0;

  // Count flaws
  for (const key in clickCountGlobal) {
    if (clickCountGlobal[key] === -1) {
      flaws++;
    }
  }
  maxPontos = 7 + flaws;

  numLeft.textContent = pontos;
  numRight.textContent = maxPontos;

  if (pontos === maxPontos) {
    document.querySelector('.numbers').classList.add('hidden');
    document.querySelector('.circle-container').classList.remove('hidden');
  }

  const descriptions = {
    tecnica: "Técnica: Demonstra a precisão e a elegância do movimento, o olhar frio e certeiro.",
    intelecto: "Intelecto: Reflete a mente racional, a percepção e o domínio do conhecimento.",
    essencia: "Essência: Carrega a chama espiritual, a ligação com o divino, o profano ou o inexplicável.",
    arcano: "Arcana: Revela a sintonia com o oculto, o domínio sobre a magia e as forças invisíveis",
    bravura: "Bravura: Mede a força do coração e a capacidade de enfrentar o medo sem hesitar.",
    folego: "Fôlego: A resistência física, a força para suportar dor e exaustão sem ceder."
  };

  icons.forEach(icon => {
    const nome = icon.classList[1];

    const ctr = document.querySelector(`.counter.${nome}`);
    if (ctr) ctr.textContent = clickCountGlobal[nome] || 0;

    icon.addEventListener("mouseenter", () => {
      // Remove hover from others
      icons.forEach(otherIcon => {
        if (otherIcon !== icon) {
          otherIcon.classList.remove("hovered");
          const otherNome = otherIcon.classList[1];
          const otherCtr = document.querySelector(`.counter.${otherNome}`);
          if (otherCtr) otherCtr.classList.remove("visible");
        }
      });
      // Add hover to current
      icon.classList.add("hovered");
      const ctr = document.querySelector(`.counter.${nome}`);
      if (ctr) ctr.classList.add("visible");

      // Show description
      const descDiv = document.getElementById('attr-description');
      descDiv.classList.remove('hidden');
      descDiv.querySelector('p').textContent = descriptions[nome];
      descDiv.classList.add('visible');
    });

    icon.addEventListener("mouseleave", (e) => {
      if (!e.relatedTarget || (!e.relatedTarget.closest('.icon') && !e.relatedTarget.closest('.counter'))) {
        document.getElementById('attr-description').classList.remove('visible');
      }
    });

    icon.addEventListener("click", () => {
      if (pontos < maxPontos) {
        if (clickCountGlobal[nome] == undefined) clickCountGlobal[nome] = 0;
        clickCountGlobal[nome]++;
        if (clickCountGlobal[nome] === 0) flaws--;
        maxPontos = 7 + flaws;
        pontos = Object.values(clickCountGlobal).reduce((a, b) => a + (b > 0 ? b : 0), 0);
        numRight.textContent = maxPontos;
        numLeft.textContent = pontos;
        if (ctr) ctr.textContent = clickCountGlobal[nome];
        localStorage.setItem('attributes', JSON.stringify(clickCountGlobal));

        if (pontos === maxPontos) {
          document.querySelector('.numbers').classList.add('hidden');
          document.querySelector('.circle-container').classList.remove('hidden');
        }
      }
    });

  });

  // Add listeners for counters
  document.querySelectorAll('.counter').forEach(counter => {
    const nome = counter.classList[1];

    counter.addEventListener("mouseenter", () => {
      // Remove hover from others
      icons.forEach(otherIcon => {
        if (otherIcon !== document.querySelector(`.icon.${nome}`)) {
          otherIcon.classList.remove("hovered");
          const otherNome = otherIcon.classList[1];
          const otherCtr = document.querySelector(`.counter.${otherNome}`);
          if (otherCtr && otherCtr !== counter) otherCtr.classList.remove("visible");
        }
      });
      // Add hover to current
      const icon = document.querySelector(`.icon.${nome}`);
      if (icon) {
        icon.classList.add("hovered");
      }
      counter.classList.add("visible");

      // Show description
      const descDiv = document.getElementById('attr-description');
      descDiv.classList.remove('hidden');
      descDiv.querySelector('p').textContent = descriptions[nome];
      descDiv.classList.add('visible');
    });

    counter.addEventListener("mouseleave", (e) => {
      if (!e.relatedTarget || (!e.relatedTarget.closest('.icon') && !e.relatedTarget.closest('.counter'))) {
        document.getElementById('attr-description').classList.remove('visible');
      }
    });
  });

// Restore section and selections on load
const savedSection = localStorage.getItem('currentSection');
if (savedSection) {
  if (savedSection === 'classe') showSection(secClasse);
  else if (savedSection === 'raca') showSection(secRaca);
  else if (savedSection === 'resumo') showSection(secResumo);
}

// Fix: If stuck at resumo without selection, reset to start
const savedRaceLScheck = localStorage.getItem('selectedRace');
if (savedSection === 'resumo' && !savedRaceLScheck) {
  localStorage.removeItem('currentSection');
  secResumo.classList.add('hidden');
  // atributos remains visible
}

const savedClassLS = localStorage.getItem('selectedClass');
if (savedClassLS) {
  slots.forEach(slot => {
    if (slot.dataset.classe === savedClassLS) {
      slot.classList.add('flipped');
      cartaAtiva = slot;
      // update summaries
      const classe = savedClassLS;
      const desc = slot.querySelector('.char-desc').textContent;
      const artImg = slot.querySelector('.img-area img').src;
      if (resumoClasseNome) resumoClasseNome.textContent = classe;
      if (resumoDesc) resumoDesc.textContent = desc;
      if (classTitle) classTitle.textContent = classe;
      if (classDesc) classDesc.textContent = desc;
      if (resumoClassImg) resumoClassImg.src = artImg;
    }
  });
}

const savedRaceLS = localStorage.getItem('selectedRace');
if (savedRaceLS) {
  // update race section
  const racaImg = document.querySelector('.raca-img');
  const racaTitle = document.querySelector('.raca-title');
  const racaDesc = document.querySelector('.raca-desc');
  racaCards.forEach(rc => {
    if (rc.dataset.raca === savedRaceLS) {
      const iconSrc = rc.querySelector('img').src;
      if (racaImg) racaImg.src = iconSrc;
      if (racaTitle) racaTitle.textContent = savedRaceLS;
      // describe without bonus
      const descricao = document.querySelector('.raca .descricao-texto').textContent;
      if (racaDesc) racaDesc.textContent = descricao.replace(document.querySelector('.raca .bonus').textContent, '').trim();
    }
  });
}

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
      const artImg = slot.querySelector(".img-area img")?.src || "imgs/placeholder.png";

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

      if (descricaoIcon) descricaoIcon.src = "imgs/anão 2.png";
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

  // Handle right-click to decrease
  document.addEventListener('contextmenu', function(e) {
    const target = e.target.closest('.icon, .counter');
    if (target) {
      if (!allowNextContextMenu) {
        e.preventDefault();
        const isIcon = target.classList.contains('icon');
        const isCounter = target.classList.contains('counter');
        let nome = isIcon ? target.classList[1] : target.classList[1];
        if (clickCountGlobal[nome] == 0) {
          clickCountGlobal[nome]--;
          flaws++;
        } else if (clickCountGlobal[nome] > -1) {
          clickCountGlobal[nome]--;
        }
        maxPontos = 7 + flaws;
        pontos = Object.values(clickCountGlobal).reduce((a, b) => a + (b > 0 ? b : 0), 0);
        numRight.textContent = maxPontos;
        numLeft.textContent = pontos;
        const ctr = document.querySelector(`.counter.${nome}`);
        if (ctr) ctr.textContent = clickCountGlobal[nome];
        localStorage.setItem('attributes', JSON.stringify(clickCountGlobal));

        if (pontos < maxPontos) {
          document.querySelector('.numbers').classList.remove('hidden');
          document.querySelector('.circle-container').classList.add('hidden');
        }
      }
      allowNextContextMenu = false;
    }
  });

  // Click on circle to proceed
  document.querySelector('.circle-container').addEventListener('click', () => {
    showSection(secClasse);
    localStorage.setItem('currentSection', 'classe');
  });

  // Allow normal context menu after double-click on targets
  document.addEventListener('dblclick', function(e) {
    const target = e.target.closest('.icon, .counter');
    if (target) {
      allowNextContextMenu = true;
    }
  });

  // Help modal
  document.querySelector('.help-icon').addEventListener('click', () => {
    const modal = document.getElementById('help-modal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  });

  document.querySelector('.close-btn').addEventListener('click', () => {
    const modal = document.getElementById('help-modal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
  });

  // Close modal on background click
  document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('help-modal')) {
      const modal = document.getElementById('help-modal');
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  });

});
