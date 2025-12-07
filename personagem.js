// personagem.js - popula a personagem.html a partir do localStorage using selectedCharId

// Simplificado: apenas home icon, sem auth
console.log('Loading personagem.js');
let clickCountGlobal = {};
let charData = null;
let allowNextContextMenu = false;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading personagem.js');

    // Aguarda o Firebase inicializar o estado do usuário (onAuthStateChanged)
    await new Promise((resolve) => {
        // se já existe currentUser, resolve imediatamente
        if (window.firebaseauth?.currentUser) return resolve();

        // registra um observer e resolve na primeira chamada
        let unsub = null;
        try {
            unsub = window.onAuthStateChanged(window.firebaseauth, (user) => {
                if (typeof unsub === 'function') unsub();
                resolve();
            });
        } catch (e) {
            // caso onAuthStateChanged não exista por algum motivo, resolver para evitar travar
            console.warn('onAuthStateChanged não disponível', e);
            resolve();
        }

        // fallback: timeout curto para não travar indefinidamente
        setTimeout(() => { if (typeof unsub === 'function') unsub(); resolve(); }, 2500);
    });

    // Agora sim checa se o usuário está logado
    if (!window.firebaseauth?.currentUser) {
        alert('User not logged in');
        window.location.href = 'index.html';
        return;
    }

    // Set sidebar to home icon
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.innerHTML = '<a href="index.html" class="sidebar-home"><i class="fas fa-home"></i></a>';
    }

    console.log('DOMContentLoaded in personagem.js');
    // Read UID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const charUid = urlParams.get('uid');
    if (!charUid) {
        alert('No character UID provided');
        window.location.href = 'index.html';
        return;
    }

    // Helper normalize (remove acentos e deixar em minúsculas)
    const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Load character from Firestore
    charData = null;
    try {
        const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
        const userDocSnap = await window.getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            const characters = data.personagens || [];
            charData = characters.find(c => c.uid === charUid);
        }
    } catch (error) {
        console.warn('Error loading character from Firestore', error);
    }

    if (!charData) {
        alert('Personagem não encontrado');
        window.location.href = 'index.html';
        return;
    }

    // Extract data from charData
    const attributes = charData.atributos || {};
    Object.keys(attributes).forEach(k => attributes[k] = Number(attributes[k] || 0));

    const savedRace = charData.raca || null;
    const savedSubrace = charData.subraca || null;
    const savedClass = charData.classe || null;
    const charName = charData.nome || 'Herói Sem Nome';
    const story = charData.historia || '—';
    const appearance = charData.aparencia || '—';

    // Mapear atributos utilizados (chaves esperadas, sem acento)
    const attrKeys = {
        bravura: attributes['bravura'] ?? attributes['bravura'] ?? attributes['bravura'] ?? 0,
        arcano: attributes['arcano'] ?? 0,
        folego: attributes['fôlego'] ?? attributes['folego'] ?? attributes['fôlego'] ?? 0,
        essencia: attributes['essencia'] ?? attributes['essência'] ?? 0,
        tecnica: attributes['técnica'] ?? attributes['tecnica'] ?? 0,
        intelecto: attributes['intelecto'] ?? 0
    };

    // Aplicar bônus raciais automáticos
    if (savedRace === 'Feéricos' && savedSubrace === 'Ágeis') {
        attrKeys['tecnica'] = (attrKeys['tecnica'] || 0) + 1;
    }
    if (savedRace === 'Elfo') {
        attrKeys['intelecto'] = (attrKeys['intelecto'] || 0) + 1;
    }
    if (savedRace === 'Meio Orc') {
        attrKeys['bravura'] = (attrKeys['bravura'] || 0) + 1;
    }

    // Calcula estatísticas de batalha por classe
    let pv = 0, mn = 0, sta = 0, profs = '—';
    if (savedClass === 'Arcanista') {
        pv = 8 + (attrKeys.bravura || 0);
        mn = 10 + (attrKeys.arcano || 0);
        sta = 6 + (attrKeys.folego || 0);
        profs = 'Cajados, Armaduras Leves, Armas Leves';
    } else if (savedClass === 'Escudeiro') {
        pv = 18 + (attrKeys.bravura || 0);
        mn = 2 + (attrKeys.arcano || 0);
        sta = 8 + (attrKeys.folego || 0);
        profs = 'Armaduras Médias, Armas de duas mãos, Escudos Médios';
    } else if (savedClass === 'Errante') {
        pv = 10 + (attrKeys.bravura || 0);
        mn = 5 + (attrKeys.arcano || 0);
        sta = 12 + (attrKeys.folego || 0);
        profs = 'Armas Técnicas, Armaduras Leves, Escudos Leves';
    } else if (savedClass === 'Luminar') {
        pv = 9 + (attrKeys.bravura || 0);
        mn = 10 + (attrKeys.arcano || 0);
        sta = 4 + (attrKeys.essencia || 0);
        profs = 'Tomos, Armaduras Leves, Armas Leves';
    }

    // Initialize atuals if missing
    if (!charData.PV) charData.PV = { total: pv, atual: pv };
    if (!charData.MN) charData.MN = { total: mn, atual: mn };
    if (!charData.STA) charData.STA = { total: sta, atual: sta };
    if (!charData.EXP) charData.EXP = { atual: 0 };
    if (!('LVL' in charData)) charData.LVL = 1;

    // Preencher os elementos já presentes no HTML
    const el = id => document.getElementById(id);
    if (el('char-name')) el('char-name').textContent = charName;
    if (el('char-class')) el('char-class').textContent = savedClass || '—';
    if (el('char-race')) {
        if (!savedRace) el('char-race').textContent = '—';
        else el('char-race').textContent = (savedRace === 'Feéricos' && savedSubrace) ? `Feérico (${savedSubrace})` : savedRace;
    }

    // imagem do personagem (tenta usar imagem pelo nome da classe em lowercase)
    if (el('char-img')) {
        if (savedClass) {
            const candidate = `./imgs/${savedClass.toLowerCase()}.png`;
            // tenta carregar (sem fetch) - definimos src e se falhar, cai ao onerror
            el('char-img').src = candidate;
            el('char-img').onerror = () => { el('char-img').src = './imgs/placeholder.png'; };
        } else {
            el('char-img').src = './imgs/placeholder.png';
        }
    }

    // exibir valores dos atributos
    const attrMapToDom = {
        tecnica: 'attr-tecnica',
        intelecto: 'attr-intelecto',
        essencia: 'attr-essencia',
        arcano: 'attr-arcano',
        bravura: 'attr-bravura',
        folego: 'attr-folego'
    };

    // função para calcular bonus racial
    const getBonus = (key) => {
        let bonus = 0;
        if (savedRace === 'Feéricos' && savedSubrace === 'Ágeis' && key === 'tecnica') bonus = 1;
        if (savedRace === 'Elfo' && key === 'intelecto') bonus = 1;
        if (savedRace === 'Meio Orc' && key === 'bravura') bonus = 1;
        return bonus;
    };

    // exibir valores da Firestore (total = raw + bonus)
    Object.keys(attrMapToDom).forEach(key => {
        const id = attrMapToDom[key];
        const raw = attributes[normalize(key)] ?? 0;
        const bonus = getBonus(normalize(key));
        const total = raw + bonus;
        if (el(id)) {
            el(id).textContent = String(total);
            el(id).title = bonus > 0 ? `${raw} + ${bonus}` : `${raw}`;
        }
    });

    // tornar atributos clicáveis para edição (com restrição de soma, alert 1x e revert)
    document.querySelectorAll('.attr-value').forEach(attrEl => {
        attrEl.style.cursor = 'pointer';
        attrEl.addEventListener('click', async (e) => {
            e.stopPropagation();
            const attrKey = attrEl.id.replace('attr-', '');
            const normalizedKey = normalize(attrKey);
            const currentRaw = attributes[normalizedKey] ?? 0;
            const prevRaw = currentRaw;             // guarda valor anterior para possível revert
            const bonus = getBonus(normalizedKey);

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'attr-input';
            input.value = String(currentRaw);
            input.min = -1;    // permite -1
            input.max = 7;
            input.step = 1;

            let bonusSpan = null;
            if (bonus > 0) {
                bonusSpan = document.createElement('span');
                bonusSpan.textContent = ` +${bonus}`;
                bonusSpan.style.fontSize = '0.8em';
                bonusSpan.style.color = '#ccc';
                bonusSpan.style.marginLeft = '4px';
            }

            attrEl.style.display = 'none';
            const label = document.createElement('span');
            label.textContent = 'Valor Bruto: ';
            label.style.fontSize = '0.8em';
            label.style.color = '#ccc';
            attrEl.parentElement.appendChild(label);
            attrEl.parentElement.appendChild(input);
            if (bonusSpan) attrEl.parentElement.appendChild(bonusSpan);
            input.focus();
            input.select();

            const ATTR_KEYS_LIST = ['tecnica', 'intelecto', 'essencia', 'arcano', 'bravura', 'folego'];
            let alertShown = false; // garante um alerta só por edição

            const revertToPrevious = () => {
                // restaura valores locais e UI para como estavam antes da edição
                attributes[normalizedKey] = prevRaw;
                attrKeys[normalizedKey] = (prevRaw ?? 0) + bonus;
                const prevTotal = (prevRaw ?? 0) + bonus;
                attrEl.textContent = String(prevTotal);
                attrEl.title = bonus > 0 ? `${prevRaw} + ${bonus}` : `${prevRaw}`;
                // limpa UI temporária
                input.remove();
                if (bonusSpan) bonusSpan.remove();
                if (label) label.remove();
                attrEl.style.display = '';
            };

            const finish = async (commit) => {
                if (commit) {
                    // parseia número (pode ser -1)
                    let newValue = parseInt(input.value, 10);
                    if (Number.isNaN(newValue)) newValue = prevRaw;
                    newValue = Math.max(-1, Math.min(7, newValue)); // clamp entre -1 e 7

                    // calcula se existe algum -1 (considerando o novo valor)
                    const anyMinusOne = ATTR_KEYS_LIST.some(k => {
                        const kn = normalize(k);
                        if (kn === normalizedKey) return newValue === -1;
                        return (attributes[kn] === -1);
                    });
                    const allowedCap = anyMinusOne ? 8 : 7;

                    // soma dos valores brutos com a substituição do valor em edição
                    let sumRaw = 0;
                    for (const k of ATTR_KEYS_LIST) {
                        const kn = normalize(k);
                        if (kn === normalizedKey) sumRaw += newValue;
                        else sumRaw += Number(attributes[kn] ?? 0);
                    }

                    if (sumRaw > allowedCap) {
                        // mostra alerta 1 vez e reverte ao valor anterior
                        if (!alertShown) {
                            const remainingBefore = allowedCap - (sumRaw - newValue);
                            alert(`Não é possível atribuir esse valor: total de pontos excederia ${allowedCap}.\nPontos restantes antes desta alteração: ${remainingBefore}.\nSoma proposta: ${sumRaw}.`);
                            alertShown = true;
                        }
                        // feedback visual leve
                        input.animate([
                            { transform: 'translateX(0)' },
                            { transform: 'translateX(-6px)' },
                            { transform: 'translateX(6px)' },
                            { transform: 'translateX(0)' }
                        ], { duration: 220, iterations: 1 });
                        // revert e encerra (sem salvar)
                        revertToPrevious();
                        return;
                    }

                    // Aceita a mudança: atualiza dados locais
                    attributes[normalizedKey] = newValue;
                    attrKeys[normalizedKey] = newValue + bonus;

                    // recalcula stats conforme sua lógica existente
                    if (savedClass === 'Arcanista') {
                        pv = 8 + attrKeys.bravura;
                        mn = 10 + attrKeys.arcano;
                        sta = 6 + attrKeys.folego;
                    } else if (savedClass === 'Escudeiro') {
                        pv = 18 + attrKeys.bravura;
                        mn = 2 + attrKeys.arcano;
                        sta = 8 + attrKeys.folego;
                    } else if (savedClass === 'Errante') {
                        pv = 10 + attrKeys.bravura;
                        mn = 5 + attrKeys.arcano;
                        sta = 12 + attrKeys.folego;
                    } else if (savedClass === 'Luminar') {
                        pv = 9 + attrKeys.bravura;
                        mn = 10 + attrKeys.arcano;
                        sta = 4 + attrKeys.essencia;
                    }
                    charData.PV.total = pv;
                    charData.MN.total = mn;
                    charData.STA.total = sta;
                    // ajustar atuais se necessário
                    if (curPV > pv) curPV = pv;
                    if (curMN > mn) curMN = mn;
                    if (curSTA > sta) curSTA = sta;
                    totPV = pv; totMN = mn; totSTA = sta;

                    // Atualiza UI (mostrando raw+bonus)
                    const newTotal = newValue + bonus;
                    attrEl.textContent = String(newTotal);
                    attrEl.title = bonus > 0 ? `${newValue} + ${bonus}` : `${newValue}`;

                    // update stats display
                    if (el('stat-pv')) el('stat-pv').textContent = pv;
                    if (el('stat-mn')) el('stat-mn').textContent = mn;
                    if (el('stat-sta')) el('stat-sta').textContent = sta;
                    if (el('stat-carga')) el('stat-carga').textContent = (8 + (attrKeys.bravura || 0));

                    updateAllBars();

                    // grava no Firestore (mesma rotina que você já tinha)
                    try {
                        const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
                        const userDocSnap = await window.getDoc(userDocRef);
                        if (userDocSnap.exists()) {
                            const characters = userDocSnap.data().personagens || [];
                            const index = characters.findIndex(c => c.uid === charUid);
                            if (index >= 0) {
                                // garante que os atributos armazenados no documento sejam números
                                characters[index].atributos = characters[index].atributos || {};
                                Object.keys(attributes).forEach(k => {
                                    characters[index].atributos[k] = Number(attributes[k] ?? 0);
                                });

                                // atualiza os totais de PV/MN/STA
                                characters[index].PV = charData.PV;
                                characters[index].MN = charData.MN;
                                characters[index].STA = charData.STA;

                                // SALVA no campo CORRETO 'personagens'
                                await window.updateDoc(userDocRef, { personagens: characters });
                                console.log('Atributos salvos em personagens[' + index + ']', characters[index].atributos);
                            } else {
                                console.warn('Índice do personagem não encontrado ao salvar atributos');
                            }
                        } else {
                            console.warn('Documento de usuário não existe ao tentar salvar atributos');
                        }
                    } catch (error) {
                        console.error('Error saving attribute to Firestore', error);
                    }
                }

                // limpa UI temporária (para caso commit ou não-commit sem exceder)
                // caso já tenhamos revertido, revertToPrevious já removeu os elementos
                if (document.body.contains(input)) {
                    input.remove();
                    if (bonusSpan) bonusSpan.remove();
                    if (label) label.remove();
                    attrEl.style.display = '';
                }
            };

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') finish(true);
                else if (ev.key === 'Escape') finish(false);
            });
            input.addEventListener('blur', () => finish(true));
        });
    });


    // estatísticas de batalha
    if (el('stat-pv')) el('stat-pv').textContent = pv;
    if (el('stat-mn')) el('stat-mn').textContent = mn;
    if (el('stat-sta')) el('stat-sta').textContent = sta;
    if (el('stat-deslocamento')) {
        const baseDesloc = 7;
        const extra = (savedRace === 'Feéricos' && savedSubrace === 'Voadores') ? 2 : 0;
        el('stat-deslocamento').textContent = baseDesloc + extra + (extra ? ` (+${extra} Voadores)` : '');
    }
    if (el('stat-carga')) el('stat-carga').textContent = (8 + (attrKeys.bravura || 0));

    // proficiencias (elemento no HTML)
    if (el('char-proficiencias')) el('char-proficiencias').textContent = profs;

    if (el('char-historia')) el('char-historia').textContent = story;
    if (el('char-aparencia')) el('char-aparencia').textContent = appearance;
    if (el('char-historia-desc')) el('char-historia-desc').value = story;
    if (el('char-aparencia-desc')) el('char-aparencia-desc').value = appearance;



    /* ---------- Auto-save dos textareas (Firestore) + criação do note-panel ---------- */
    // garante que a aba de descrição exista
    const descriptionTabEl = document.querySelector('.tab-description') || document.querySelector('[data-tab="description"]');

    if (descriptionTabEl) {
        // cria note-panel se não existir (id: char-note-desc)
        if (!document.getElementById('char-note-desc')) {
            const noteWrapper = document.createElement('div');
            noteWrapper.className = 'character-note';
            noteWrapper.innerHTML = `
            <h2>Notas</h2>
            <textarea class="note-panel" id="char-note-desc" placeholder="Notas sobre o personagem...">${(charData && charData.notas) ? charData.notas : ''}</textarea>
        `;
            // insere no fim da aba descrição (após personalidade)
            descriptionTabEl.appendChild(noteWrapper);
        }
    }

    // helper debounce
    function debounce(fn, wait = 700) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // função que salva um campo do personagem no array 'personagens' do documento do usuário
    async function saveCharacterField(fieldName, value) {
        if (!window.firebaseauth?.currentUser) return;
        try {
            const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
            const userDocSnap = await window.getDoc(userDocRef);
            if (!userDocSnap.exists()) {
                console.warn('Documento do usuário não existe ao tentar salvar campo', fieldName);
                return;
            }
            const data = userDocSnap.data();
            const characters = Array.isArray(data.personagens) ? data.personagens.slice() : [];
            const idx = characters.findIndex(c => c && c.uid === charUid);
            if (idx < 0) {
                console.warn('Personagem não encontrado ao salvar campo', fieldName);
                return;
            }
            // garante o objeto do personagem
            characters[idx] = characters[idx] || {};
            // atualiza o campo (mantendo outros campos)
            characters[idx][fieldName] = value;
            // grava no Firestore
            await window.updateDoc(userDocRef, { personagens: characters });
            // atualiza charData local para manter sincronizado
            if (charData) charData[fieldName] = value;
            console.log(`Campo '${fieldName}' salvo para personagem[${idx}]`);
        } catch (err) {
            console.error('Erro ao salvar campo do personagem:', fieldName, err);
        }
    }

    // pega referências aos textareas (compatibilidade com ids/classes que você usa)
    const storyTA = document.getElementById('char-historia-desc') || document.querySelector('.story-panel');
    const appearanceTA = document.getElementById('char-aparencia-desc') || document.querySelector('.appearance-panel');
    const personalityTA = document.getElementById('char-personality-desc') || document.getElementById('char-personality') || document.querySelector('.personality-panel');
    const noteTA = document.getElementById('char-note-desc') || document.querySelector('.note-panel');

    // preenche initial values (caso ainda não tenham sido preenchidos antes)
    if (storyTA && (storyTA.value === '' || storyTA.value === '—')) storyTA.value = (charData && charData.historia) ? charData.historia : '';
    if (appearanceTA && (appearanceTA.value === '' || appearanceTA.value === '—')) appearanceTA.value = (charData && charData.aparencia) ? charData.aparencia : '';
    if (personalityTA && (personalityTA.value === '' || personalityTA.value === '—')) personalityTA.value = (charData && charData.personalidade) ? charData.personalidade : '';
    if (noteTA && (noteTA.value === '' || noteTA.value === '—')) noteTA.value = (charData && charData.notas) ? charData.notas : '';

    // debounced savers
    const debSaveStory = debounce((v) => saveCharacterField('historia', v), 700);
    const debSaveAppearance = debounce((v) => saveCharacterField('aparencia', v), 700);
    const debSavePersonality = debounce((v) => saveCharacterField('personalidade', v), 700);
    const debSaveNotes = debounce((v) => saveCharacterField('notas', v), 700);

    // attach listeners (evita duplicar)
    if (storyTA && !storyTA.hasAttribute('data-listener-added-firestore')) {
        storyTA.addEventListener('input', (e) => {
            const v = e.target.value;
            // opcional: também manter localStorage para fallback offline
            try { localStorage.setItem('characterStory', v); } catch (err) { /* ignore */ }
            debSaveStory(v);
        });
        storyTA.setAttribute('data-listener-added-firestore', 'true');
    }
    if (appearanceTA && !appearanceTA.hasAttribute('data-listener-added-firestore')) {
        appearanceTA.addEventListener('input', (e) => {
            const v = e.target.value;
            try { localStorage.setItem('characterAppearance', v); } catch (err) { /* ignore */ }
            debSaveAppearance(v);
        });
        appearanceTA.setAttribute('data-listener-added-firestore', 'true');
    }
    if (personalityTA && !personalityTA.hasAttribute('data-listener-added-firestore')) {
        personalityTA.addEventListener('input', (e) => {
            const v = e.target.value;
            try { localStorage.setItem('characterPersonality', v); } catch (err) { /* ignore */ }
            debSavePersonality(v);
        });
        personalityTA.setAttribute('data-listener-added-firestore', 'true');
    }
    if (noteTA && !noteTA.hasAttribute('data-listener-added-firestore')) {
        noteTA.addEventListener('input', (e) => {
            const v = e.target.value;
            try { localStorage.setItem('characterNotes', v); } catch (err) { /* ignore */ }
            debSaveNotes(v);
        });
        noteTA.setAttribute('data-listener-added-firestore', 'true');
    }


    /* ---------- INVENTÁRIO: será injetado à direita para replicar mockup ---------- */
    // inventory pode existir no localStorage como array de objetos {id,name,img,qty}
    let inventory = [];
    try {
        const invRaw = localStorage.getItem('inventory');
        if (invRaw) inventory = JSON.parse(invRaw);
    } catch (e) {
        console.warn('inventory inválido', e);
    }

    // criar wrapper à direita
    const main = document.querySelector('.character-main');
    if (main) {
        // evita duplicar se já foi inserido
        if (!document.getElementById('inventory-wrap')) {
            const wrap = document.createElement('div');
            wrap.id = 'inventory-wrap';

            // inventário card
            wrap.innerHTML = `
        <div class="inventory-card" aria-label="Inventário">
          <div class="inventory-top">
            <div class="peso">
                <i class="fa-solid fa-dumbbell"></i>
                <span id="peso-info">0 / 0</span>
            </div>
            <input class="search-field" placeholder="Buscar item..." />
          </div>
          <div class="inventory-grid" role="list" aria-label="Slots do inventario"></div>
        </div>
      `;
            main.appendChild(wrap);

            // preencher slots
            const grid = wrap.querySelector('.inventory-grid');

            // padrão: grade 4x5 = 20 slots
            const slotsCount = 20;
            // função para montar slot
            const createSlot = (slotIndex) => {
                const s = document.createElement('div');
                s.className = 'inv-slot';
                s.dataset.slot = slotIndex;
                return s;
            };

            // preencher cada slot com item se existir
            for (let i = 0; i < slotsCount; i++) {
                const slotEl = createSlot(i);
                const item = inventory[i] || null;
                if (item) {
                    const img = document.createElement('img');
                    img.alt = item.name || `item-${i}`;
                    img.src = item.img || `./imgs/${(item.id || 'placeholder')}.png`;
                    img.onerror = () => { img.src = './imgs/placeholder.png'; };
                    slotEl.appendChild(img);

                    if (item.qty && item.qty > 1) {
                        const qty = document.createElement('div');
                        qty.className = 'inv-qty';
                        qty.textContent = item.qty;
                        slotEl.appendChild(qty);
                    }
                    // tooltip on hover
                    slotEl.title = item.name || 'Item';
                    slotEl.addEventListener('click', () => {
                        // ação simples: copia nome do item para clipboard / mostra alerta - você pode customizar
                        navigator.clipboard?.writeText(item.name || '').catch(() => { });
                        const prev = document.querySelector('.inv-slot.active');
                        if (prev) prev.classList.remove('active');
                        slotEl.classList.add('active');
                        // feedback simples
                        slotEl.animate([{ transform: 'translateY(-6px)' }, { transform: 'translateY(0)' }], { duration: 200 });
                    });
                }
                grid.appendChild(slotEl);
            }

            // search filter
            const searchField = wrap.querySelector('.search-field');
            if (searchField) {
                searchField.addEventListener('input', (e) => {
                    const q = e.target.value.trim().toLowerCase();
                    const slots = grid.querySelectorAll('.inv-slot');
                    slots.forEach((slot, idx) => {
                        const item = inventory[idx];
                        if (!q) { slot.style.opacity = '1'; slot.style.filter = 'none'; return; }
                        if (!item) { slot.style.opacity = '0.25'; return; }
                        const name = (item.name || '').toLowerCase();
                        if (name.includes(q)) {
                            slot.style.opacity = '1';
                            slot.style.filter = 'none';
                        } else {
                            slot.style.opacity = '0.25';
                        }
                    });
                });
            }

            // --- update peso inicial: usa carga do personagem (charData) como max, e peso_atual se disponível ---
            const pesoInfoSpan = wrap.querySelector('#peso-info') || wrap.querySelector('.peso span');
            if (pesoInfoSpan) {
                // calcula total de peso a partir do inventory (fallback caso charData.peso_atual não exista)
                let totalPesoInventory = 0;
                inventory.forEach(it => {
                    // aceita tanto "weight" quanto "peso" por segurança
                    const w = Number(it.weight ?? it.peso ?? 0);
                    totalPesoInventory += (w * (it.qty || 1));
                });

                // preferir peso_atual salvo no documento do personagem (charData), se for válido
                let pesoAtual = Number(charData?.peso_atual);
                if (!Number.isFinite(pesoAtual) || pesoAtual === 0) {
                    // se não houver peso_atual, usa o somatório do inventory (pode ser 0)
                    pesoAtual = totalPesoInventory || 0;
                }

                // obter carga máxima: prioridade para charData.carga -> charData.atributos.carga -> fallback 8 + bravura
                let cargaMax = Number(charData?.carga ?? charData?.atributos?.carga);
                if (!Number.isFinite(cargaMax) || cargaMax <= 0) {
                    const bravuraRaw = Number(charData?.atributos?.bravura ?? 0) || 0;
                    cargaMax = 8 + bravuraRaw;
                }

                // escreve só no span filho — mantém o ícone intacto
                pesoInfoSpan.textContent = `${pesoAtual} / ${cargaMax}`;
            }

        }
    }

    // Pequeno ajuste visual: criar a left-card shell caso seu HTML não tenha layout exato
    // Se .left-card não existir, vamos agrupar o conteúdo atual numa .left-card para estilizar
    if (!document.querySelector('.left-card')) {
        // construir left-card e mover conteúdo relevante
        const leftCard = document.createElement('div');
        leftCard.className = 'left-card';

        // mover tudo que estiver dentro de .character-main (exceto inventory que acabamos de criar)
        const childrenToMove = [];
        document.querySelectorAll('.character-main > *').forEach(ch => {
            if (ch.id !== 'inventory-wrap') childrenToMove.push(ch);
        });
        childrenToMove.forEach(ch => leftCard.appendChild(ch));

        // inserir leftCard no início de character-main
        const mainNode = document.querySelector('.character-main');
        if (mainNode) mainNode.insertBefore(leftCard, mainNode.firstChild);
    }

    // acessibilidade / focus
    document.querySelectorAll('.inv-slot').forEach(s => s.setAttribute('tabindex', '0'));

    // pronto: a ficha foi populada a partir do localStorage

    // --- Atualizar barras PV / MN / STA (com drag interativo) ---

    // --- estado inicial das barras (declarado ANTES do bloco EXP para evitar ReferenceError) ---
    // usa valores da Firestore ou defaults (pv/mn/sta/exp já foram definidos acima)
    let curPV = Math.max(0, Math.floor(charData.PV?.atual ?? pv));
    let curMN = Math.max(0, Math.floor(charData.MN?.atual ?? mn));
    let curSTA = Math.max(0, Math.floor(charData.STA?.atual ?? sta));

    let totPV = Math.max(0, Math.floor(Number(pv) || 0));
    let totMN = Math.max(0, Math.floor(Number(mn) || 0));
    let totSTA = Math.max(0, Math.floor(Number(sta) || 0));


    /* ---------------- EXP + integração nas barras ---------------- */

    /* ---------------- EXP + integração nas barras ---------------- */
    /* Definições utilitárias */
    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    const pct = (cur, tot) => (tot > 0 ? Math.min(100, (cur / tot) * 100) : 0);

    function saveCurrent(key, value) {
        try { localStorage.setItem(key, String(value)); } catch (e) { console.warn('Erro salvando localStorage', e); }
    }
    function readCurrentOrFallback(keys, fallback) {
        for (const k of keys) {
            const v = localStorage.getItem(k);
            if (v !== null && v !== undefined && v !== '') {
                const n = Number(v);
                if (!Number.isNaN(n)) return n;
            }
        }
        return fallback;
    }

    /* applyBar (pv/mn/sta/exp) */
    function applyBar(fillId, textId, amount, total, cssClass) {
        const fillEl = document.getElementById(fillId);
        const textEl = document.getElementById(textId);
        if (!fillEl || !textEl) return;
        const percent = Math.max(0, Math.min(100, (total > 0 ? (amount / total) * 100 : 0)));
        fillEl.style.width = percent + '%';
        fillEl.classList.remove('pv', 'mn', 'sta', 'exp');
        if (cssClass) fillEl.classList.add(cssClass);
        textEl.textContent = `${amount}/${total}`;
        const bar = fillEl.parentElement;
        if (bar) {
            bar.setAttribute('aria-valuenow', String(amount));
            bar.setAttribute('aria-valuemax', String(total));
            bar.setAttribute('title', `${amount} / ${total}`);
        }
    }

    /* ---------- Function to save bar values to Firestore ---------- */
    const saveBarsToFirestore = async () => {
        console.log('Saving bars to Firestore:', curPV, curMN, curSTA, currentEXP, expLevel);
        if (!window.firebaseauth.currentUser) return;
        try {
            const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
            const userDocSnap = await window.getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const characters = userDocSnap.data().personagens || [];
                const index = characters.findIndex(c => c.uid === charUid);
                if (index >= 0) {
                    characters[index].PV.atual = curPV;
                    characters[index].MN.atual = curMN;
                    characters[index].STA.atual = curSTA;
                    characters[index].EXP.atual = currentEXP;
                    characters[index].LVL = expLevel;
                    await window.updateDoc(userDocRef, { personagens: characters });
                    console.log('Saved successfully');
                }
            }
        } catch (error) {
            console.error('Error saving bars to Firestore', error);
        }
    };

    /* ---------- EXP: limite por nível ---------- */
    function expLimitForLevel(level) {
        const base = 100;
        return Math.round(base * Math.pow(4 / 3, Math.max(0, level - 1)));
    }

    /* ---------- EXP state ---------- */
    let expLevel = Math.max(1, Math.floor(charData.LVL ?? 1));
    let currentEXP = Math.max(0, Math.floor(charData.EXP?.atual ?? 0));
    function normalizeExpState() {
        let limit = expLimitForLevel(expLevel);
        while (currentEXP >= limit) {
            currentEXP -= limit;
            expLevel++;
            limit = expLimitForLevel(expLevel);
        }
        if (currentEXP < 0) currentEXP = 0;
        saveBarsToFirestore(); // Save adjusted values
    }
    normalizeExpState();

    /* ---------- Atualização global das barras ---------- */
    function updateAllBars() {
        applyBar('pv-bar-fill', 'pv-bar-text', curPV, totPV, 'pv');
        applyBar('mn-bar-fill', 'mn-bar-text', curMN, totMN, 'mn');
        applyBar('sta-bar-fill', 'sta-bar-text', curSTA, totSTA, 'sta');

        const expLimit = expLimitForLevel(expLevel);
        applyBar('exp-bar-fill', 'exp-bar-text', currentEXP, expLimit, 'exp');

        const lvlEl = document.getElementById('exp-level');
        if (lvlEl) lvlEl.textContent = String(expLevel);

        if (document.getElementById('stat-pv')) document.getElementById('stat-pv').textContent = totPV;
        if (document.getElementById('stat-mn')) document.getElementById('stat-mn').textContent = totMN;
        if (document.getElementById('stat-sta')) document.getElementById('stat-sta').textContent = totSTA;

        // Save to Firestore after update
        saveBarsToFirestore();
    }
    updateAllBars();

    /* <<< ADICIONADO: slots de batalha, modal e integração com Firestore >>> */
    (function setupBattleSlotsAndModal() {
        // Mapeamento dos slots para os tipos de itens que deverão ser exibidos na lista
        const slotMap = {
            'armas': ['Arma', 'Equipamento'], // Arma e Equipamento
            'protecao': ['Proteção'],          // Proteção (armaduras/escudos)
            'utilitarios': ['Utilitário']      // Utilitários
        };

        // elements do modal/slots (já adicionados ao HTML conforme instruído)
        const modal = document.getElementById('items-modal');
        const itemsListEl = document.getElementById('items-list');
        const detailPanel = document.getElementById('item-detail');
        const detailName = document.getElementById('detail-name');
        const detailFields = document.getElementById('detail-fields');
        const confirmBtn = document.getElementById('confirm-equip');
        const cancelBtn = document.getElementById('cancel-equip');
        const closeModalBtn = document.getElementById('items-modal-close');

        let currentSlotKey = null; // 'armas' | 'protecao' | 'utilitarios'
        let selectedItem = null;   // armazenará { id, ...dados }

        // util: obtém charUid (tenta usar variável global charUid, senão pega da URL ?uid=)
        function getCharUidFromContext() {
            if (typeof charUid !== 'undefined' && charUid) return charUid;
            try {
                const params = new URLSearchParams(window.location.search);
                const u = params.get('uid');
                if (u) return u;
            } catch (e) { /* ignore */ }
            return null;
        }

        const resolvedCharUid = getCharUidFromContext();
        if (!resolvedCharUid) {
            console.warn('setupBattleSlotsAndModal: não encontrou charUid (declare var charUid ou use ?uid= na URL).');
        }

        // Abre o modal e carrega a lista de itens filtrada por tipo(s)
        function openModalForSlot(slotKey) {
            currentSlotKey = slotKey;
            if (!itemsListEl || !detailPanel) return;
            itemsListEl.innerHTML = '<div style="padding:8px;color:#ddd">Carregando...</div>';
            const content = detailPanel.querySelector('.item-detail-content');
            if (content) content.style.display = 'none';
            const empty = detailPanel.querySelector('.item-detail-empty');
            if (empty) empty.style.display = '';

            // busca itens por tipo (usa where in para múltiplos tipos)
            const types = slotMap[slotKey] || [];
            (async () => {
                try {
                    const itensCol = window.collection(window.firestoredb, 'itens');
                    // se types tiver apenas 1 elemento, também funciona: where('tipo_item', 'in', [thatOne])
                    const q = window.query(itensCol, window.where('tipo_item', 'in', types));
                    const snap = await window.getDocs(q);
                    const items = [];
                    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
                    renderItemsList(items);
                } catch (err) {
                    console.error('Erro carregando itens:', err);
                    itemsListEl.innerHTML = '<div style="padding:8px;color:#faa">Erro ao carregar.</div>';
                }
            })();

            if (modal) modal.setAttribute('aria-hidden', 'false');
        }

        // Fecha modal e reseta estado interno
        function closeModal() {
            if (!modal) return;
            modal.setAttribute('aria-hidden', 'true');
            selectedItem = null;
            currentSlotKey = null;
            if (itemsListEl) itemsListEl.innerHTML = '';
            if (detailName) detailName.textContent = '';
            if (detailFields) detailFields.innerHTML = '';
            const content = detailPanel.querySelector('.item-detail-content');
            if (content) content.style.display = 'none';
            const empty = detailPanel.querySelector('.item-detail-empty');
            if (empty) empty.style.display = '';
        }

        // Renderiza a lista de itens (coluna esquerda)
        function renderItemsList(items) {
            if (!itemsListEl) return;
            if (!items || !items.length) {
                itemsListEl.innerHTML = '<div style="padding:8px;color:#ddd">Nenhum item disponível deste tipo.</div>';
                return;
            }
            itemsListEl.innerHTML = '';
            items.forEach(it => {
                const row = document.createElement('div');
                row.className = 'item-row';
                row.tabIndex = 0;
                row.textContent = it.nome || '(sem nome)';
                row.addEventListener('click', () => selectItemFromList(it));
                row.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') selectItemFromList(it); });
                itemsListEl.appendChild(row);
            });
        }

        // Quando usuário clica em um item: mostra detalhes no painel direito omitindo campos "Nenhum"/null/""
        function selectItemFromList(it) {
            if (!it) return;
            selectedItem = it;
            const empty = detailPanel.querySelector('.item-detail-empty');
            if (empty) empty.style.display = 'none';
            const content = detailPanel.querySelector('.item-detail-content');
            content.style.display = '';
            if (detailName) detailName.textContent = it.nome || 'Item';
            if (detailFields) detailFields.innerHTML = '';

            // ordem e rótulos dos campos que queremos mostrar
            const mapping = [
                ['descricao', 'Descrição'],
                ['efeito', 'Efeito'],
                ['habilidade', 'Habilidade'],
                ['dano', 'Dano'],
                ['tipo_dano', 'Tipo de Dano'],
                ['critico', 'Crítico'],
                ['requisito', 'Requisito'],
                ['peso', 'Peso'],
                ['categoria', 'Categoria'],
                ['tipo_item', 'Tipo']
            ];

            mapping.forEach(([k, label]) => {
                const v = it[k];
                if (v === undefined || v === null) return;
                if (typeof v === 'string' && (v.trim() === '' || v.trim().toLowerCase() === 'nenhum')) return;
                const wrap = document.createElement('div');
                wrap.className = 'detail-row';
                wrap.innerHTML = `<strong>${label}:</strong> <span>${String(v)}</span>`;
                detailFields.appendChild(wrap);
            });
        }

        // REPLACE: função confirmEquip() (corrigida para ler carga a partir de characters[idx].carga)
        async function confirmEquip() {
            if (!selectedItem) {
                alert('Nenhum item selecionado.');
                return;
            }

            const charId = getCharUidFromContext();
            if (!charId) {
                alert('UID do personagem não definido. Informe ?uid=<CHAR_UID> na URL ou defina a variável global charUid.');
                return;
            }

            // desativa botão para evitar cliques repetidos (se existir)
            if (confirmBtn) confirmBtn.disabled = true;

            try {
                const user = window.firebaseauth.currentUser;
                if (!user) throw new Error('Usuário não autenticado.');

                const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                const userSnap = await window.getDoc(userRef);
                if (!userSnap.exists()) throw new Error('Documento de usuário não encontrado.');

                const data = userSnap.data();
                const characters = Array.isArray(data.personagens) ? data.personagens.slice() : [];
                const idx = characters.findIndex(c => c && c.uid === charId);
                if (idx < 0) throw new Error('Personagem não encontrado no array personagens.');

                // garante array de itens do personagem (estado atual antes da adição)
                characters[idx].itens = Array.isArray(characters[idx].itens) ? characters[idx].itens.slice() : [];

                // calcula peso atual (antes de adicionar)
                const pesoAtual = await calcularPesoAtual(characters[idx].itens);

                // tenta obter peso do item selecionado de forma robusta
                let pesoDoItem = Number(selectedItem.peso);
                if (!Number.isFinite(pesoDoItem)) {
                    try {
                        const docRef = window.doc(window.firestoredb, 'itens', selectedItem.id || selectedItem.uid || selectedItem);
                        const docSnap = await window.getDoc(docRef);
                        if (docSnap.exists()) {
                            const d = docSnap.data();
                            pesoDoItem = Number(d?.peso) || 0;
                        } else {
                            pesoDoItem = 0;
                        }
                    } catch (e) {
                        console.warn('Não foi possível ler peso do documento do item, assumindo 0', e);
                        pesoDoItem = 0;
                    }
                }

                // --------- LER CARGA MÁXIMA (PRIMÁRIO: characters[idx].carga) ----------
                let cargaMaxima = Number(characters[idx]?.carga);
                if (!Number.isFinite(cargaMaxima) || cargaMaxima < 0) {
                    // fallback para atributos.carga se o campo direto não existir
                    cargaMaxima = Number(characters[idx]?.atributos?.carga);
                }
                if (!Number.isFinite(cargaMaxima) || cargaMaxima < 0) {
                    // fallback para charData (caso esteja carregado localmente)
                    cargaMaxima = Number(charData?.atributos?.carga);
                }
                if (!Number.isFinite(cargaMaxima) || cargaMaxima <= 0) {
                    // último fallback prático: 8 + bravura RAW do personagem (sem tentar aplicar bônus de classe),
                    // mas isso só roda se realmente não houver campo carga nas fontes anteriores.
                    const bravuraRaw = Number(characters[idx]?.atributos?.bravura ?? charData?.atributos?.bravura ?? 0) || 0;
                    cargaMaxima = 8 + bravuraRaw;
                }

                // normaliza para número inteiro ou mantem decimal se houver (mantemos Number)
                cargaMaxima = Number(cargaMaxima);

                console.debug('confirmEquip check -> pesoAtual:', pesoAtual, 'pesoDoItem:', pesoDoItem, 'cargaMaxima:', cargaMaxima, 'characters[idx].carga:', characters[idx]?.carga, 'characters[idx].atributos?.carga:', characters[idx]?.atributos?.carga);

                // verifica se ultrapassa (permitido quando igual)
                if ((pesoAtual + pesoDoItem) > cargaMaxima) {
                    alert(
                        `Não é possível equipar este item — ele aumentaria o peso de ${pesoAtual} → ${pesoAtual + pesoDoItem} ` +
                        `e ultrapassaria a carga máxima do personagem (${cargaMaxima}).`
                    );
                    return; // não adiciona
                }

                // passa na checagem => adiciona item
                characters[idx].itens.push({ uid: selectedItem.id });

                // recalcula peso_atual já com o novo item
                const novoPeso = await calcularPesoAtual(characters[idx].itens);
                characters[idx].peso_atual = novoPeso;

                // salva no Firestore
                await window.updateDoc(userRef, { personagens: characters });

                // atualiza UI
                await refreshSlotsFromCharData();

                closeModal();
            } catch (err) {
                console.error('Erro ao equipar item:', err);
                alert('Erro ao equipar item. Veja console para detalhes.');
            } finally {
                // reativa botão
                if (confirmBtn) confirmBtn.disabled = false;
            }
        }

        // Calcula a soma dos pesos dos itens equipados
        async function calcularPesoAtual(arrayDeItens) {
            let soma = 0;

            for (const entry of arrayDeItens) {
                if (!entry || !entry.uid) continue;

                try {
                    const itemRef = window.doc(window.firestoredb, 'itens', entry.uid);
                    const itemSnap = await window.getDoc(itemRef);

                    if (itemSnap.exists()) {
                        const itemData = itemSnap.data();
                        const peso = Number(itemData.peso) || 0;
                        soma += peso;
                    }
                } catch (err) {
                    console.warn('Item inválido ao calcular peso:', entry.uid, err);
                }
            }

            return soma;
        }


        // Lê os dados do usuário e preenche os textos dos slots conforme itens equipados
        // Substituir por esta versão — mostra LISTAS de itens por slot (cada item embaixo do outro)
        async function refreshSlotsFromCharData() {
            try {
                const charId = getCharUidFromContext();
                if (!charId) return;
                const user = window.firebaseauth.currentUser;
                if (!user) return;

                const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                const userSnap = await window.getDoc(userRef);
                if (!userSnap.exists()) return;
                const data = userSnap.data();
                const characters = data.personagens || [];
                const myChar = characters.find(c => c && c.uid === charId) || {};
                const equipped = Array.isArray(myChar.itens) ? myChar.itens : [];

                // limpa os slots (preparar container)
                const slotIds = ['char-armas', 'char-protecao', 'char-utilitarios'];
                slotIds.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) {
                        const body = el.querySelector('.slot-body');
                        if (body) {
                            // esvazia e coloca um placeholder durante carregamento
                            body.innerHTML = '<div class="slot-loading">Carregando...</div>';
                        }
                    }
                });

                // --- atualiza o display de peso no inventory-card ---
                const pesoInfoEl = document.getElementById('peso-info');
                let pesoAtual = Number(myChar.peso_atual ?? 0);
                try {
                    // se peso_atual não estiver presente ou for 0/invalid, calcula a partir do array de equipped
                    if (!Number.isFinite(pesoAtual) || pesoAtual === 0) {
                        pesoAtual = Number(await calcularPesoAtual(equipped)) || 0;
                    }
                } catch (e) {
                    pesoAtual = Number(myChar.peso_atual ?? 0) || 0;
                }
                let cargaMax = Number(myChar.carga ?? myChar.atributos?.carga);
                if (!Number.isFinite(cargaMax) || cargaMax <= 0) {
                    const bravuraRaw = Number(myChar.atributos?.bravura ?? 0) || 0;
                    cargaMax = 8 + bravuraRaw;
                }
                if (pesoInfoEl) pesoInfoEl.textContent = `${pesoAtual} / ${cargaMax}`;


                // cria listas vazias para preencher
                const lists = {
                    armas: [],
                    protecao: [],
                    utilitarios: []
                };

                // helper para classificar tipo do item (robusto para variações/acentos)
                function classifyTipo(tipoRaw) {
                    const t = String(tipoRaw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    if (t.includes('utilit')) return 'utilitarios';
                    if (t.includes('prote') || t.includes('armadur') || t.includes('escud')) return 'protecao';
                    // armas / equipamentos -> armas
                    if (t.includes('arma') || t.includes('equip')) return 'armas';
                    // fallback: se não bater, tratar como armas por padrão
                    return 'armas';
                }

                // percorre cada reference de item no personagem e busca o documento correspondende
                // OBS: agora guardamos também o índice original (sourceIndex) para remover apenas a instância clicada
                for (let i = 0; i < equipped.length; i++) {
                    const e = equipped[i];
                    if (!e || !e.uid) continue;
                    try {
                        const itemRef = window.doc(window.firestoredb, 'itens', e.uid);
                        const itemSnap = await window.getDoc(itemRef);
                        if (!itemSnap.exists()) continue;
                        const it = itemSnap.data();
                        const slotKey = classifyTipo(it.tipo_item);
                        // guardamos sourceIndex para poder remover apenas esta ocorrência
                        lists[slotKey].push({ id: itemSnap.id, data: it, sourceIndex: i });
                    } catch (err) {
                        console.warn('Erro lendo item referenciado', e.uid, err);
                    }
                }

                // função auxiliar para montar a UL/LI e inserir no slot
                function renderListInSlot(slotId, itemsArray) {
                    const el = document.getElementById(slotId);
                    if (!el) return;
                    const body = el.querySelector('.slot-body');
                    if (!body) return;

                    body.innerHTML = ''; // limpa

                    if (!itemsArray.length) {
                        body.textContent = 'Vazio';
                        return;
                    }

                    const ul = document.createElement('ul');
                    ul.className = 'equipped-list';

                    itemsArray.forEach((itemWrap) => {
                        const li = document.createElement('li');
                        li.className = 'equipped-item';
                        li.tabIndex = 0;
                        li.dataset.uid = itemWrap.id;
                        // opcional: guarda também o sourceIndex como atributo data para debug/inspeção
                        li.dataset.sourceIndex = String(itemWrap.sourceIndex);

                        // nome
                        const name = document.createElement('div');
                        name.className = 'equipped-item-name';
                        name.textContent = itemWrap.data.nome || '(sem nome)';
                        li.appendChild(name);

                        // metadados (peso, tipo, etc)
                        const meta = document.createElement('div');
                        meta.className = 'equipped-item-meta';
                        const parts = [];
                        if (itemWrap.data.peso !== undefined && itemWrap.data.peso !== null && String(itemWrap.data.peso).trim() !== '') {
                            parts.push(`peso: ${itemWrap.data.peso}`);
                        }
                        if (itemWrap.data.tipo_item) parts.push(String(itemWrap.data.tipo_item));
                        meta.textContent = parts.join(' • ');
                        if (parts.length) li.appendChild(meta);

                        const removeBtn = document.createElement('span');
                        removeBtn.className = 'equipped-item-remove';
                        removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

                        // ao clicar, removemos a instância pelo índice original (sourceIndex)
                        removeBtn.addEventListener('click', async (ev) => {
                            ev.stopPropagation(); // evita abrir modal se clicar no item
                            // itemWrap.sourceIndex é o índice no array personagens[idx].itens
                            await removerItemEquipado(itemWrap.sourceIndex);
                            // atualiza interface
                            await refreshSlotsFromCharData();
                        });

                        li.appendChild(removeBtn);

                        ul.appendChild(li);
                    });

                    body.appendChild(ul);
                }

                // Remove apenas a entrada na posição passada (não remove todas as que têm o mesmo uid)
                async function removerItemEquipado(itemIndexToRemove) {
                    try {
                        const charId = getCharUidFromContext();
                        const user = window.firebaseauth.currentUser;
                        if (!user || !charId) return;

                        const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                        const snap = await window.getDoc(userRef);
                        if (!snap.exists()) return;

                        const data = snap.data();
                        const personagens = Array.isArray(data.personagens) ? data.personagens.slice() : [];
                        const idx = personagens.findIndex(p => p && p.uid === charId);
                        if (idx < 0) return;

                        const itens = Array.isArray(personagens[idx].itens) ? personagens[idx].itens.slice() : [];

                        // se o índice for válido, removemos apenas essa posição
                        if (Number.isFinite(itemIndexToRemove) && itemIndexToRemove >= 0 && itemIndexToRemove < itens.length) {
                            const novoArray = itens.slice();
                            novoArray.splice(itemIndexToRemove, 1); // remove somente esse elemento
                            personagens[idx].itens = novoArray;

                        } else {
                            // fallback: se por algum motivo o índice estiver inválido, remove só a primeira ocorrência do uid
                            console.warn('Índice inválido ao tentar remover item. Aplicando fallback (remover primeira ocorrência).', itemIndexToRemove);
                            // tenta inferir uid a partir do array atual (caso você queira passar uid ao fallback)
                            // aqui não temos o uid diretamente, então apenas mantemos o array como estava
                            return;
                        }

                        // recalcular peso
                        const novoPeso = await calcularPesoAtual(personagens[idx].itens);
                        personagens[idx].peso_atual = novoPeso;

                        // salvar
                        await window.updateDoc(userRef, { personagens });

                    } catch (err) {
                        console.error('Erro ao remover item', err);
                    }
                }

                // renderiza as três listas
                renderListInSlot('char-armas', lists.armas);
                renderListInSlot('char-protecao', lists.protecao);
                renderListInSlot('char-utilitarios', lists.utilitarios);

            } catch (err) {
                console.error('Erro em refreshSlotsFromCharData', err);
            }
        }

        // conecta eventos de clique nos slots
        const slotArm = document.getElementById('char-armas');
        const slotProt = document.getElementById('char-protecao');
        const slotUtil = document.getElementById('char-utilitarios');
        slotArm?.addEventListener('click', () => openModalForSlot('armas'));
        slotProt?.addEventListener('click', () => openModalForSlot('protecao'));
        slotUtil?.addEventListener('click', () => openModalForSlot('utilitarios'));

        // botões do modal
        closeModalBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        confirmBtn?.addEventListener('click', confirmEquip);
        // fechar clicando no backdrop (se existir)
        document.querySelector('.items-modal-backdrop')?.addEventListener('click', closeModal);

        // refresca slots quando a página carregar (curto delay para garantir que auth e firestore estejam prontos)
        setTimeout(() => refreshSlotsFromCharData(), 300);

        // expo: em caso de necessidade externa, disponibiliza funções (opcional)
        window.__battleSlots = {
            openModalForSlot,
            closeModal,
            refreshSlotsFromCharData
        };
    })();


    /* ---------- +/- buttons (PV/MN/STA) ---------- */
    function wirePlusMinus(minusId, plusId, getCur, setCur, total) {
        const minus = document.getElementById(minusId);
        const plus = document.getElementById(plusId);
        if (minus) minus.addEventListener('click', (e) => { e.stopPropagation(); setCur(clamp(getCur() - 1, 0, total)); updateAllBars(); });
        if (plus) plus.addEventListener('click', (e) => { e.stopPropagation(); setCur(clamp(getCur() + 1, 0, total)); updateAllBars(); });
    }
    wirePlusMinus('pv-minus', 'pv-plus', () => curPV, (v) => { curPV = v; }, totPV);
    wirePlusMinus('mn-minus', 'mn-plus', () => curMN, (v) => { curMN = v; }, totMN);
    wirePlusMinus('sta-minus', 'sta-plus', () => curSTA, (v) => { curSTA = v; }, totSTA);

    /* ---------- edição inline (PV/MN/STA) ---------- */
    function enableInlineEdit(textEl, getCur, setCur, total, storageKey) {
        if (!textEl) return;
        textEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'bar-input';
            input.value = String(getCur());
            input.min = 0;
            input.max = total;
            textEl.style.display = 'none';
            textEl.parentElement.appendChild(input);
            input.focus();
            input.select();
            function finish(commit) {
                const raw = input.value.trim();
                if (commit) {
                    let num = Number(raw);
                    if (Number.isNaN(num)) num = getCur();
                    num = Math.floor(num);
                    num = clamp(num, 0, total);
                    setCur(num);
                    saveCurrent(storageKey, num);
                    updateAllBars();
                }
                input.remove();
                textEl.style.display = '';
            }
            input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') finish(false); });
            input.addEventListener('blur', () => finish(true));
        });
    }
    enableInlineEdit(document.getElementById('pv-bar-text'), () => curPV, (v) => { curPV = v; }, totPV, 'currentPV');
    enableInlineEdit(document.getElementById('mn-bar-text'), () => curMN, (v) => { curMN = v; }, totMN, 'currentMN');
    enableInlineEdit(document.getElementById('sta-bar-text'), () => curSTA, (v) => { curSTA = v; }, totSTA, 'currentSTA');

    /* ---------- drag/click para PV/MN/STA ---------- */
    function attachDragToBar(statName, total, getCur, setCur, storageKey, fillId, textId) {
        const bar = document.querySelector(`.stat-bar[data-stat="${statName}"]`);
        if (!bar) return;
        const fill = document.getElementById(fillId);
        let dragging = false;
        let pointerIdActive = null;

        function computeValueFromClientX(clientX) {
            const rect = bar.getBoundingClientRect();
            const style = getComputedStyle(bar);
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const padRight = parseFloat(style.paddingRight) || 0;
            const usableLeft = rect.left + padLeft;
            const usableWidth = Math.max(2, rect.width - padLeft - padRight);
            const rel = clamp((clientX - usableLeft) / usableWidth, 0, 1);
            return Math.round(rel * total);
        }

        function startDrag(ev) {
            if (ev.target.closest('.stat-btn') || ev.target.classList.contains('bar-input')) return;
            ev.preventDefault();
            dragging = true;
            pointerIdActive = ev.pointerId;
            try { bar.setPointerCapture(pointerIdActive); } catch (e) { }
            bar.classList.add('dragging'); document.documentElement.classList.add('dragging');
            const newVal = computeValueFromClientX(ev.clientX);
            setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
        }
        function moveDrag(ev) {
            if (!dragging || ev.pointerId !== pointerIdActive) return;
            ev.preventDefault();
            const newVal = computeValueFromClientX(ev.clientX);
            setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
        }
        function endDrag(ev) {
            if (!dragging) return;
            dragging = false;
            try { if (pointerIdActive != null) bar.releasePointerCapture(pointerIdActive); } catch (e) { }
            pointerIdActive = null;
            bar.classList.remove('dragging'); document.documentElement.classList.remove('dragging');
            if (ev && typeof ev.clientX === 'number') {
                const newVal = computeValueFromClientX(ev.clientX);
                setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
            }
        }

        bar.addEventListener('pointerdown', startDrag);
        bar.addEventListener('pointermove', moveDrag);
        bar.addEventListener('pointerup', endDrag);
        bar.addEventListener('pointercancel', endDrag);
        document.addEventListener('pointerup', endDrag);
        document.addEventListener('pointercancel', endDrag);

        bar.addEventListener('click', (ev) => {
            if (ev.target.closest('.stat-btn') || ev.target.classList.contains('bar-input')) return;
            const newVal = computeValueFromClientX(ev.clientX);
            setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
        });
    }
    attachDragToBar('pv', totPV, () => curPV, (v) => { curPV = v; }, 'currentPV', 'pv-bar-fill', 'pv-bar-text');
    attachDragToBar('mn', totMN, () => curMN, (v) => { curMN = v; }, 'currentMN', 'mn-bar-fill', 'mn-bar-text');
    attachDragToBar('sta', totSTA, () => curSTA, (v) => { curSTA = v; }, 'currentSTA', 'sta-bar-fill', 'sta-bar-text');

    /* ---------- EXP: botões/inline/drag (mantém sua lógica, usando clamp) ---------- */
    function gainExp(delta) {
        if (!Number.isFinite(delta)) return;
        delta = Math.floor(delta);
        if (delta === 0) return;
        if (delta > 0) {
            currentEXP += delta;
            let limit = expLimitForLevel(expLevel);
            while (currentEXP >= limit) { currentEXP -= limit; expLevel++; limit = expLimitForLevel(expLevel); }
        } else {
            currentEXP = Math.max(0, currentEXP + delta);
        }
        saveCurrent('currentEXP', currentEXP);
        saveCurrent('expLevel', expLevel);
        updateAllBars();
    }
    const expMinus = document.getElementById('exp-minus');
    const expPlus = document.getElementById('exp-plus');
    if (expMinus) expMinus.addEventListener('click', (e) => { e.stopPropagation(); gainExp(-1); });
    if (expPlus) expPlus.addEventListener('click', (e) => { e.stopPropagation(); gainExp(1); });

    function enableInlineEditExp(textEl) {
        if (!textEl) return;
        textEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const limit = expLimitForLevel(expLevel);
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'bar-input';
            input.value = String(currentEXP);
            input.min = 0; input.max = limit;
            textEl.style.display = 'none';
            textEl.parentElement.appendChild(input);
            input.focus(); input.select();
            function finish(commit) {
                const raw = input.value.trim();
                if (commit) {
                    let num = Number(raw);
                    if (Number.isNaN(num)) num = currentEXP;
                    num = Math.floor(num);
                    if (num >= limit) gainExp(num - currentEXP);
                    else { currentEXP = clamp(num, 0, limit); saveCurrent('currentEXP', currentEXP); updateAllBars(); }
                }
                input.remove(); textEl.style.display = '';
            }
            input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') finish(true); else if (ev.key === 'Escape') finish(false); });
            input.addEventListener('blur', () => finish(true));
        });
    }
    enableInlineEditExp(document.getElementById('exp-bar-text'));

    /* Drag/click para EXP (modificado para NÃO causar level-up — drag apenas ajusta currentEXP até limit-1) */
    (function attachDragToExp() {
        const bar = document.querySelector(`.stat-bar[data-stat="exp"]`);
        if (!bar) return;
        let dragging = false; let pointerIdActive = null;

        function computeValueFromClientX(clientX) {
            const rect = bar.getBoundingClientRect();
            const style = getComputedStyle(bar);
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const padRight = parseFloat(style.paddingRight) || 0;
            const usableLeft = rect.left + padLeft;
            const usableWidth = Math.max(2, rect.width - padLeft - padRight);
            const rel = clamp((clientX - usableLeft) / usableWidth, 0, 1);
            const limit = expLimitForLevel(expLevel);
            // IMPORTANT: não permitir que o drag alcance o limite (isso impediria level-up via drag)
            const maxDraggable = Math.max(0, limit - 1);
            return clamp(Math.round(rel * limit), 0, maxDraggable);
        }

        function startDrag(ev) {
            if (ev.target.closest('.stat-btn') || ev.target.classList.contains('bar-input')) return;
            ev.preventDefault(); dragging = true; pointerIdActive = ev.pointerId;
            try { bar.setPointerCapture(pointerIdActive); } catch (e) { }
            bar.classList.add('dragging'); document.documentElement.classList.add('dragging');
            const newVal = computeValueFromClientX(ev.clientX);
            currentEXP = newVal;
            saveCurrent('currentEXP', currentEXP);
            updateAllBars();
        }
        function moveDrag(ev) {
            if (!dragging || ev.pointerId !== pointerIdActive) return; ev.preventDefault();
            const newVal = computeValueFromClientX(ev.clientX);
            currentEXP = newVal;
            saveCurrent('currentEXP', currentEXP);
            updateAllBars();
        }
        function endDrag(ev) {
            if (!dragging) return; dragging = false;
            try { if (pointerIdActive != null) bar.releasePointerCapture(pointerIdActive); } catch (e) { }
            pointerIdActive = null; bar.classList.remove('dragging'); document.documentElement.classList.remove('dragging');
            if (ev && typeof ev.clientX === 'number') {
                const newVal = computeValueFromClientX(ev.clientX);
                currentEXP = newVal;
                saveCurrent('currentEXP', currentEXP);
                updateAllBars();
            }
        }
        bar.addEventListener('pointerdown', startDrag);
        bar.addEventListener('pointermove', moveDrag);
        bar.addEventListener('pointerup', endDrag);
        bar.addEventListener('pointercancel', endDrag);
        document.addEventListener('pointerup', endDrag);
        document.addEventListener('pointercancel', endDrag);

        // clique simples: também não permite alcançar o limite (limit) via clique
        bar.addEventListener('click', (ev) => {
            if (ev.target.closest('.stat-btn') || ev.target.classList.contains('bar-input')) return;
            const newVal = computeValueFromClientX(ev.clientX);
            currentEXP = newVal;
            saveCurrent('currentEXP', currentEXP);
            updateAllBars();
        });
    })();

    /* ---------- edição do NÍVEL clicando no próprio número (id="exp-level") ---------- */
    (function enableLevelClickEdit() {
        const lvlEl = document.getElementById('exp-level');
        if (!lvlEl) return;
        lvlEl.style.cursor = 'pointer';
        lvlEl.title = 'Clique para editar o nível (1–30)';
        lvlEl.addEventListener('click', (e) => {
            e.stopPropagation();
            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'bar-input';
            input.min = 1;
            input.max = 30;
            input.value = String(expLevel);
            // colocar o input no lugar do span
            lvlEl.style.display = 'none';
            lvlEl.parentElement.appendChild(input);
            input.focus();
            input.select();

            function finish(commit) {
                if (commit) {
                    let num = Number(input.value);
                    if (Number.isNaN(num)) num = expLevel;
                    num = Math.floor(num);
                    num = clamp(num, 1, 30); // restringe até 30
                    expLevel = num;
                    // ajustar currentEXP caso exceda o novo limite (deixa no máximo limit-1)
                    const limit = expLimitForLevel(expLevel);
                    if (currentEXP >= limit) currentEXP = Math.max(0, limit - 1);
                    saveCurrent('expLevel', expLevel);
                    saveCurrent('currentEXP', currentEXP);
                    updateAllBars();
                }
                input.remove();
                lvlEl.style.display = '';
            }

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') finish(true);
                else if (ev.key === 'Escape') finish(false);
            });
            input.addEventListener('blur', () => finish(true));
        });
    })();

    // expose function for external updates (keeps backward compatibility)
    window.updateStatsFromStorage = function () {
        curPV = clamp(Number(readCurrentOrFallback(['currentPV', 'pvAtual', 'pv_atual', 'hpAtual', 'hp_atual', 'hp'], pv)) || curPV, 0, totPV);
        curMN = clamp(Number(readCurrentOrFallback(['currentMN', 'mnAtual', 'mn_atual', 'mpAtual', 'mp', 'mn'], mn)) || curMN, 0, totMN);
        curSTA = clamp(Number(readCurrentOrFallback(['currentSTA', 'staAtual', 'sta_atual', 'staminaAtual', 'stamina', 'sta'], sta)) || curSTA, 0, totSTA);

        // atualizar expLevel/currentEXP a partir do storage (se necessário)
        expLevel = Math.max(1, Math.floor(Number(readCurrentOrFallback(['expLevel', 'level', 'nivel'], expLevel))));
        currentEXP = Math.max(0, Math.floor(Number(readCurrentOrFallback(['currentEXP', 'expAtual', 'exp_atual', 'exp'], currentEXP))));
        normalizeExpState();

        updateAllBars();
    };

});

/* ------------------ TABS: wiring e sincronização de conteúdo (corrigido) ------------------ */
(function setupTabsAndDescriptionCopy() {
    const leftCard = document.querySelector('.left-card');
    if (!leftCard) return;

    // seletores corretos para seus botões/painéis
    const tabs = Array.from(leftCard.querySelectorAll('.card-tab'));
    const panels = Array.from(leftCard.querySelectorAll('.tab-content'));

    // fallback: se não houver tabs/panels (por algum carregamento diferente), não estoure — apenas continue
    if (!tabs.length || !panels.length) {
        // tenta encontrar pelo HTML original (caso você já tenha um markup inicial diferente)
        // não retorna aqui para não impedir execuções posteriores
    }

    function panelNameFromEl(p) {
        // preferimos data-tab; se não existir, tentamos extrair da classe 'tab-xxx'
        if (p.dataset && p.dataset.tab) return p.dataset.tab;
        const m = p.className.match(/\btab-(\w+)\b/);
        return m ? m[1] : null;
    }

    function setActiveTab(name) {
        tabs.forEach(t => {
            const is = t.dataset.tab === name;
            t.classList.toggle('active', is);
            t.setAttribute('aria-selected', is ? 'true' : 'false');
        });
        panels.forEach(p => {
            const pn = panelNameFromEl(p);
            // se não souber o nome do painel, mantém display (não esconde) para evitar cortar conteúdo crítico
            if (pn) p.style.display = (pn === name) ? '' : 'none';
        });
    }

    // inicial: garantir que 'general' esteja ativo (se houver)
    setActiveTab('general');

    // listeners nas tabs — clique na ativa não faz nada
    tabs.forEach(tab => tab.addEventListener('click', (e) => {
        const name = tab.dataset.tab;
        if (!name) return;
        if (tab.classList.contains('active')) return;
        setActiveTab(name);
        // se for descrição, atualiza os campos a partir do storage / firestore (só se existir a função)
        if (name === 'description' && typeof window.syncDescriptionPanelsFromStorage === 'function') {
            try { window.syncDescriptionPanelsFromStorage(); } catch (err) { console.warn('syncDescriptionPanelsFromStorage erro:', err); }
        }
    }));

    // expõe uma versão segura caso outra parte do código tente chamar
    if (typeof window.syncDescriptionPanelsFromStorage !== 'function') {
        window.syncDescriptionPanelsFromStorage = function () {
            // fallback: preenche campos com localStorage se existir (não lança error)
            const story = localStorage.getItem('characterStory') || '';
            const appearance = localStorage.getItem('characterAppearance') || '';
            const personalityText = localStorage.getItem('characterPersonality') || '';

            const back = leftCard.querySelector('.character-backstory');
            if (back) {
                const panel = back.querySelector('.story-panel') || back.querySelector('textarea');
                if (panel) panel.value = story;
            }
            const app = leftCard.querySelector('.character-appearance');
            if (app) {
                const panel = app.querySelector('.appearance-panel') || app.querySelector('textarea');
                if (panel) panel.value = appearance;
            }
            const pers = leftCard.querySelector('#char-personality-desc, #char-personality, .personality-panel');
            if (pers) pers.value = personalityText;
        };
    }
})();


/* ---------- TABS "orelinhas" (UI + troca de conteúdo) ---------- */
(function setupCardTabs() {
    const leftCard = document.querySelector('.left-card');
    if (!leftCard) return;

    // 1) Travar a altura atual do left-card para que trocas de conteúdo não alterem o tamanho/posição.
    //    Mantemos visual idêntico, apenas fixamos height atual.
    const rect = leftCard.getBoundingClientRect();
    const lockedHeight = Math.max(rect.height, 320); // fallback mínimo
    leftCard.style.height = lockedHeight + 'px';
    leftCard.style.maxHeight = lockedHeight + 'px';
    leftCard.style.overflow = 'visible'; // permitir tabs ficarem para fora

    // 2) Criar wrapper .left-card-body se não existir e mover o conteúdo atual para dentro.
    let body = leftCard.querySelector('.left-card-body');
    if (!body) {
        body = document.createElement('div');
        body.className = 'left-card-body';

        // mover todos os filhos (exceto futuras .card-tabs) para .left-card-body
        const nodes = Array.from(leftCard.childNodes);
        nodes.forEach(n => {
            // se for node de tabs (por acaso já existir), ignorar
            if (n.nodeType === 1 && n.classList.contains('card-tabs')) return;
            body.appendChild(n);
        });
        leftCard.appendChild(body);
    }

    // 3) Criar barra de tabs "orelinhas" (fora do fluxo, colada no topo)
    if (!leftCard.querySelector('.card-tabs')) {
        const tabsBar = document.createElement('div');
        tabsBar.className = 'card-tabs';
        tabsBar.innerHTML = `
            <button class="card-tab active" data-tab="general">Geral</button>
            <button class="card-tab" data-tab="description">Descrição</button>
            <button class="card-tab" data-tab="battle">Batalha</button>
        `;
        leftCard.appendChild(tabsBar);
    }

    const tabs = Array.from(leftCard.querySelectorAll('.card-tab'));
    const tabGeneralBtn = leftCard.querySelector('.card-tab[data-tab="general"]');

    // 4) Preparar conteúdos das tabs:
    //    - pegamos o conteúdo atual como "Geral"
    //    - criamos "Descrição" com backstory, appearance e personality (personality novo)
    //    - "Batalha" fica placeholder (vazio por enquanto)
    const generalContent = document.createElement('div');
    generalContent.className = 'tab-content tab-general';
    // mover todo o conteúdo atual do body para generalContent
    while (body.firstChild) generalContent.appendChild(body.firstChild);
    body.appendChild(generalContent);

    // criar description content (clonar panels se existirem)
    const descriptionContent = document.createElement('div');
    descriptionContent.className = 'tab-content tab-description';
    descriptionContent.style.display = 'none';

    // clonar backstory e appearance se existirem em geral
    const backOrig = generalContent.querySelector('.character-backstory');
    const appOrig = generalContent.querySelector('.character-appearance');
    if (backOrig) descriptionContent.appendChild(backOrig.cloneNode(true));
    if (appOrig) descriptionContent.appendChild(appOrig.cloneNode(true));
    // criar personalidade (mesmo design que appearance/backstory -> usa mesma classe .appearance-panel)
    const personality = document.createElement('div');
    personality.className = 'character-personality';
    personality.innerHTML = `
        <h2>Personalidade</h2>
        <textarea class="personality-panel" id="char-personality" placeholder="Descreva a personalidade do seu personagem...">${localStorage.getItem('characterPersonality') || '—'}</textarea>
    `;
    descriptionContent.appendChild(personality);

    // criar battle content (placeholder)
    const battleContent = document.createElement('div');
    battleContent.className = 'tab-content tab-battle';
    battleContent.style.display = 'none';
    battleContent.innerHTML = `<h2>Batalha</h2><div style="min-height:120px;color:#f2eee9">Em construção...</div>`;

    // anexar os conteúdos ao body (já existe generalContent)
    body.appendChild(descriptionContent);
    body.appendChild(battleContent);

    // 5) Função para trocar tabs (não troca nada se clicar na tab ativa)
    function setActiveTab(name) {
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
        generalContent.style.display = (name === 'general') ? '' : 'none';
        descriptionContent.style.display = (name === 'description') ? '' : 'none';
        battleContent.style.display = (name === 'battle') ? '' : 'none';
    }

    // 6) Event listeners nas tabs (clicar na tab ativa não faz nada)
    tabs.forEach(tab => tab.addEventListener('click', (e) => {
        const name = tab.dataset.tab;
        if (tab.classList.contains('active')) return; // não faz nada se já ativa
        setActiveTab(name);
        // se for descrição, atualizar textos dos painéis a partir do localStorage
        if (name === 'description') {
            syncDescriptionPanelsFromStorage();
        }
    }));

    // 7) Função pública para sincronizar/descriptografar o conteúdo da aba Descrição
    window.syncDescriptionPanelsFromStorage = function () {
        const story = localStorage.getItem('characterStory') || '—';
        const appearance = localStorage.getItem('characterAppearance') || '—';
        const personalityText = localStorage.getItem('characterPersonality') || '—';

        const back = descriptionContent.querySelector('.character-backstory');
        if (back) {
            const panel = back.querySelector('.story-panel');
            if (panel) panel.value = story;
        }
        const app = descriptionContent.querySelector('.character-appearance');
        if (app) {
            const panel = app.querySelector('.appearance-panel');
            if (panel) panel.value = appearance;
        }
        const pers = descriptionContent.querySelector('#char-personality');
        if (pers) pers.value = personalityText;

        // Add listener for the personality panel created here
        if (pers && !pers.hasAttribute('data-listener-added')) {
            pers.addEventListener('input', () => localStorage.setItem('characterPersonality', pers.value));
            pers.setAttribute('data-listener-added', 'true');
        }
    };

    // Sincroniza inicialmente (caso já haja dados)
    window.syncDescriptionPanelsFromStorage();

    // Nota: mantemos a altura travada do left-card para evitar "pulse" de layout.
    // Se você quiser recalcular o tamanho quando mudar algo globalmente, pode chamar:
    // leftCard.style.height = leftCard.getBoundingClientRect().height + 'px';
})();
