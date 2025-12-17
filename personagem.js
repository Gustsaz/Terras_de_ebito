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

    // Set sidebar to home icon and user photo
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.innerHTML = '<a href="index.html" class="sidebar-home"><i class="fas fa-home"></i></a>';

        const user = window.firebaseauth?.currentUser;
        if (user && user.photoURL) {
            const img = document.createElement('img');
            img.src = user.photoURL;
            img.className = 'sidebar-profile';
            img.title = user.displayName || user.email || 'User';
            sidebar.appendChild(img);
            // Add click event for logout
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                const existingSair = document.querySelector('.sidebar-sair');
                if (existingSair) {
                    existingSair.remove();
                } else {
                    const sairBtn = document.createElement('button');
                    sairBtn.className = 'sidebar-sair';
                    sairBtn.textContent = 'Sair';
                    sairBtn.style.position = 'absolute';
                    sairBtn.style.bottom = '70px'; // above the img
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
                            window.location.href = 'index.html'; // redirect to home
                        } catch (error) {
                            console.error('Error signing out:', error);
                        }
                    });
                    // hide on click outside
                    document.addEventListener('click', (evt) => {
                        if (!sairBtn.contains(evt.target) && evt.target !== img) {
                            sairBtn.remove();
                        }
                    });
                    sidebar.appendChild(sairBtn);
                }
            });
        }
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
    let charName = charData.nome || 'Herói Sem Nome';
    const story = charData.historia || '—';
    const appearance = charData.aparencia || '—';

    // Mapear atributos utilizados (RAW)
    const attrKeys = {
        bravura: attributes['bravura'] ?? 0,
        arcano: attributes['arcano'] ?? 0,
        folego: attributes['fôlego'] ?? attributes['folego'] ?? 0,
        essencia: attributes['essencia'] ?? attributes['essência'] ?? 0,
        tecnica: attributes['técnica'] ?? attributes['tecnica'] ?? 0,
        intelecto: attributes['intelecto'] ?? 0
    };

    function applyRacialBonus(rawValue, key) {
        if (rawValue > 7) return rawValue;  // evita aplicar novamente ao recarregar

        if (savedRace === 'Feéricos' && savedSubrace === 'Ágeis' && key === 'tecnica')
            return rawValue + 1;

        if (savedRace === 'Elfo' && key === 'intelecto')
            return rawValue + 1;

        if (savedRace === 'Meio Orc' && key === 'bravura')
            return rawValue + 1;

        return rawValue;
    }

    // ✔️ TRANSFORMA RAW → TOTAL (com bônus)
    attrKeys.bravura = applyRacialBonus(attrKeys.bravura, 'bravura');
    attrKeys.arcano = applyRacialBonus(attrKeys.arcano, 'arcano');
    attrKeys.tecnica = applyRacialBonus(attrKeys.tecnica, 'tecnica');
    attrKeys.folego = applyRacialBonus(attrKeys.folego, 'folego');
    attrKeys.essencia = applyRacialBonus(attrKeys.essencia, 'essencia');
    attrKeys.intelecto = applyRacialBonus(attrKeys.intelecto, 'intelecto');


    // Calcula estatísticas de batalha por classe e define array de proeficiencias
    let pv = 0, mn = 0, sta = 0;
    let proeficiencias = []; // array de strings
    if (savedClass === 'Arcanista') {
        pv = 8 + (attrKeys.bravura || 0);
        mn = 10 + (attrKeys.arcano || 0);
        sta = 6 + (attrKeys.folego || 0);
        proeficiencias = ['Cajados', 'Armaduras Leves', 'Armas Leves'];
    } else if (savedClass === 'Escudeiro') {
        pv = 18 + (attrKeys.bravura || 0);
        mn = 2 + (attrKeys.arcano || 0);
        sta = 8 + (attrKeys.folego || 0);
        proeficiencias = ['Armaduras Médias', 'Armas de Duas Mãos', 'Escudos Médios'];
    } else if (savedClass === 'Errante') {
        pv = 10 + (attrKeys.bravura || 0);
        mn = 5 + (attrKeys.arcano || 0);
        sta = 12 + (attrKeys.folego || 0);
        proeficiencias = ['Armas Técnicas', 'Armaduras leves'];
    } else if (savedClass === 'Luminar') {
        pv = 9 + (attrKeys.bravura || 0);
        mn = 10 + (attrKeys.arcano || 0);
        sta = 4 + (attrKeys.essencia || 0);
        proeficiencias = ['Tomos', 'Armaduras leves', 'Armas Leves'];
    }

    // string legível (fallback caso precise mostrar como texto)
    const profs = (Array.isArray(proeficiencias) && proeficiencias.length) ? proeficiencias.join(', ') : '—';


    // Initialize atuals if missing
    // ---- Garantir e persistir proeficiencias + remover localStorage antigo ----
    // limpa eventuais entradas antigas no localStorage que contenham "profic"
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.toLowerCase().includes('profic')) {
                localStorage.removeItem(key);
                // ajusta índice pois removemos um item
                i = -1; // reinicia varredura segura (pequeno número de chaves)
            }
        }
    } catch (e) {
        // ambientes que bloqueiam localStorage podem lançar - ignoramos
        console.warn('Não foi possível limpar localStorage (profic):', e);
    }

    // se charData não tiver proeficiencias, salva a lista padrão calculada acima
    if (!Array.isArray(charData.proeficiencias) || charData.proeficiencias.length === 0) {
        try {
            // salva no documento do usuário (função helper definida mais abaixo)
            await saveCharacterField('proeficiencias', proeficiencias);
            // atualiza a cópia local charData
            charData.proeficiencias = Array.from(proeficiencias);
        } catch (e) {
            console.warn('Falha ao salvar proeficiencias iniciais:', e);
        }
    } else {
        // se existir, usa as proeficiencias já salvas (prioridade ao que está no Firestore)
        proeficiencias = Array.isArray(charData.proeficiencias) ? charData.proeficiencias.slice() : proeficiencias;
    }

    // Exibe as proeficiencias: se existir um elemento <ul id="proficiencias-list">, preenche como <li>,
    // senão escreve no fallback #char-proficiencias
    const profListEl = document.getElementById('proficiencias-list');
    const profTextEl = document.getElementById('char-proficiencias');

    if (profListEl) {
        // limpa e insere itens
        profListEl.innerHTML = '';
        if (Array.isArray(proeficiencias) && proeficiencias.length) {
            proeficiencias.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                profListEl.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.textContent = '—';
            profListEl.appendChild(li);
        }
        // remove fallback texto caso exista
        if (profTextEl) profTextEl.style.display = 'none';
    } else if (profTextEl) {
        // fallback textual (mantive seu ID existente)
        profTextEl.textContent = (Array.isArray(proeficiencias) && proeficiencias.length) ? proeficiencias.join(', ') : '—';
        profTextEl.style.display = '';
    }
    // ---- fim proeficiencias ----


    // Preencher os elementos já presentes no HTML
    const el = id => document.getElementById(id);
    if (el('char-name')) el('char-name').textContent = charName;
    if (el('char-class')) el('char-class').textContent = savedClass || '—';
    if (el('char-race')) {
        if (!savedRace) el('char-race').textContent = '—';
        else el('char-race').textContent = (savedRace === 'Feéricos' && savedSubrace) ? `Feérico (${savedSubrace})` : savedRace;
    }

    // imagem do personagem (prioriza img[] personalizado; fallback para imagem da classe)
    if (el('char-img')) {
        let imgSrc;
        const hasCustomImg = charData.img && Array.isArray(charData.img) && charData.img.length > 0;
        if (hasCustomImg) {
            imgSrc = charData.img[0];
        } else if (savedClass) {
            imgSrc = `./imgs/${savedClass.toLowerCase()}.png`;
        } else {
            imgSrc = './imgs/placeholder.png';
        }
        el('char-img').src = imgSrc;
        el('char-img').onerror = () => { el('char-img').src = './imgs/placeholder.png'; };

        // adicionar botão de deletar imagem (se houver imagem customizada)
        const charPortraitDiv = el('char-img').parentElement;
        if (charPortraitDiv && !charPortraitDiv.querySelector('.delete-img-btn')) {
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-img-btn';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Remover imagem customizada';
            deleteBtn.style.position = 'absolute';
            deleteBtn.style.top = '5px';
            deleteBtn.style.right = '5px';
            deleteBtn.style.background = 'rgba(0,0,0,0.7)';
            deleteBtn.style.color = '#fff';
            deleteBtn.style.border = 'none';
            deleteBtn.style.borderRadius = '50%';
            deleteBtn.style.width = '30px';
            deleteBtn.style.height = '30px';
            deleteBtn.style.cursor = 'pointer';
            deleteBtn.style.display = hasCustomImg ? '' : 'none'; // mostrar se tiver imagem custom

            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation(); // não acionar o upload
                try {
                    charData.img = [];
                    await saveCharacterField('img', []);
                    // atualizar src para classe
                    let fallbackSrc = './imgs/placeholder.png';
                    if (savedClass) {
                        fallbackSrc = `./imgs/${savedClass.toLowerCase()}.png`;
                    }
                    el('char-img').src = fallbackSrc;
                    deleteBtn.style.display = 'none'; // esconder botão
                } catch (err) {
                    console.error('Erro ao remover imagem:', err);
                }
            });

            charPortraitDiv.style.position = 'relative'; // garantir relativo para absolute child
            charPortraitDiv.appendChild(deleteBtn);
        } else if (charPortraitDiv) {
            // se já existe o botão, ajustar visibilidade
            const existingBtn = charPortraitDiv.querySelector('.delete-img-btn');
            if (existingBtn) {
                existingBtn.style.display = hasCustomImg ? '' : 'none';
            }
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

    // --- INÍCIO: mostrar e salvar "Pontos restantes" ao lado do <h3> de .attr-section ---
    const attrSectionH3 = document.querySelector('.attr-section h3');
    let remainingSpan = null;

    function ensureRemainingElement() {
        if (!attrSectionH3) return;
        if (!remainingSpan) {
            remainingSpan = document.createElement('span');
            remainingSpan.id = 'attr-remaining';
            // estilo simples (pode ajustar no CSS depois)
            remainingSpan.style.float = 'right';
            remainingSpan.style.fontSize = '0.95rem';
            remainingSpan.style.opacity = '0.95';
            remainingSpan.style.marginLeft = '8px';
            remainingSpan.style.color = '#dcdcdc';
            attrSectionH3.appendChild(remainingSpan);
        }
    }

    // calcula allowedCap/sum/remaining com base no objeto `attributes`
    // garante que funcione com chaves acentuadas/normalizadas e usa APENAS os valores brutos (sem bônus racial)
    function computeAllowedAndRemainingFromAttributes(attrObj) {
        const ATTR_KEYS_LIST = ['tecnica', 'intelecto', 'essencia', 'arcano', 'bravura', 'folego'];

        // cria um mapa normalizedKey -> rawValue a partir do objeto que pode ter chaves acentuadas
        const normalizedMap = {};
        Object.keys(attrObj || {}).forEach(origKey => {
            try {
                const nk = normalize(origKey);
                normalizedMap[nk] = Number(attrObj[origKey] ?? 0);
            } catch (e) {
                // fallback: guarda com a própria key como string
                normalizedMap[String(origKey)] = Number(attrObj[origKey] ?? 0);
            }
        });

        // agora soma usando as keys normalizadas esperadas
        const anyMinusOne = ATTR_KEYS_LIST.some(k => Number(normalizedMap[k] ?? 0) === -1);
        const allowedCap = anyMinusOne ? 8 : 7;

        let sumRaw = 0;
        for (const k of ATTR_KEYS_LIST) sumRaw += Number(normalizedMap[k] ?? 0);

        const remaining = allowedCap - sumRaw;
        return { allowedCap, sumRaw, remaining };
    }

    function updateRemainingUI() {
        ensureRemainingElement();

        // 1) Se o Firestore já forneceu pontos_restantes, mostra esse valor (prioridade)
        const firebasePR = (typeof charData !== 'undefined' && charData && typeof charData.pontos_restantes !== 'undefined')
            ? Number(charData.pontos_restantes)
            : null;

        if (firebasePR !== null && !Number.isNaN(firebasePR)) {
            remainingSpan.textContent = `Pontos restantes: ${firebasePR}`;
            return;
        }

        // 2) fallback: calcula baseado nos atributos (o comportamento que você tinha antes)
        const { remaining } = computeAllowedAndRemainingFromAttributes(attributes);
        const display = Math.max(0, Number.isFinite(remaining) ? remaining : 0);
        remainingSpan.textContent = `Pontos restantes: ${display}`;
    }

    // inicializa o display (na carga da página)
    updateRemainingUI();

    // --------- INICIA LISTENER PARA ATUALIZAR "Pontos restantes" EM TEMPO REAL ---------
    let __unsubAttrRemaining = null;

    function startAttrRemainingListener() {
        if (!window.firebaseauth?.currentUser) return;
        const uid = window.firebaseauth.currentUser.uid;
        if (!uid) return;

        const userDocRef = window.doc(window.firestoredb, 'usuarios', uid);

        // helper para aplicar os novos dados vindos do Firestore na UI/local state
        // aplica dados remotos do personagem na UI sem re-salvar no Firestore
        function applyRemoteCharData(newChar) {
            if (!newChar) return;
            // atualiza charData global
            charData = newChar;
            // após charData = newChar; (ou perto do final de applyRemoteCharData)
            try { renderProficiencies(newChar); } catch (e) { console.warn('renderProficiencies erro', e); }


            // 1) Atualiza attributes (raw) a partir do doc recebido
            try {
                // limpa objeto attributes e preenche com valores normalizados
                Object.keys(attributes).forEach(k => delete attributes[k]);
            } catch (e) { /* ignore */ }
            const incomingAttrs = newChar.atributos || {};
            Object.keys(incomingAttrs).forEach(origKey => {
                try {
                    const nk = normalize(origKey);
                    attributes[nk] = Number(incomingAttrs[origKey] ?? 0);
                } catch (e) {
                    attributes[origKey] = Number(incomingAttrs[origKey] ?? 0);
                }
            });

            // 2) Recalcula attrKeys (total = raw + bônus racial) usando applyRacialBonus quando disponível
            try {
                attrKeys.bravura = applyRacialBonus(Number(attributes.bravura ?? 0), 'bravura');
                attrKeys.arcano = applyRacialBonus(Number(attributes.arcano ?? 0), 'arcano');
                attrKeys.folego = applyRacialBonus(Number(attributes.folego ?? 0), 'folego');
                attrKeys.essencia = applyRacialBonus(Number(attributes.essencia ?? 0), 'essencia');
                attrKeys.tecnica = applyRacialBonus(Number(attributes.tecnica ?? 0), 'tecnica');
                attrKeys.intelecto = applyRacialBonus(Number(attributes.intelecto ?? 0), 'intelecto');
            } catch (e) {
                // fallback sem bônus
                attrKeys.bravura = Number(attributes.bravura ?? 0);
                attrKeys.arcano = Number(attributes.arcano ?? 0);
                attrKeys.folego = Number(attributes.folego ?? 0);
                attrKeys.essencia = Number(attributes.essencia ?? 0);
                attrKeys.tecnica = Number(attributes.tecnica ?? 0);
                attrKeys.intelecto = Number(attributes.intelecto ?? 0);
            }

            // 3) Atualiza DOM dos atributos (attr-*)
            try {
                Object.keys(attrMapToDom).forEach(key => {
                    const id = attrMapToDom[key];
                    const raw = attributes[normalize(key)] ?? 0;
                    const bonus = getBonus(normalize(key));
                    const total = raw + bonus;
                    const elm = el(id);
                    if (elm) {
                        elm.textContent = String(total);
                        elm.title = bonus > 0 ? `${raw} + ${bonus}` : `${raw}`;
                    }
                });
            } catch (e) { /* silencioso */ }

            // 4) Atualiza PV/MN/STA totais e atuais (suporta formato {atual, total} ou apenas número)
            function readFieldVal(obj, fallback) {
                if (obj == null) return fallback;
                if (typeof obj === 'number') return obj;
                if (typeof obj === 'object' && typeof obj.total !== 'undefined') return obj.total;
                return fallback;
            }
            function readFieldAtual(obj, fallback) {
                if (obj == null) return fallback;
                if (typeof obj === 'object' && typeof obj.atual !== 'undefined') return obj.atual;
                if (typeof obj === 'number') return obj;
                return fallback;
            }

            const newTotPV = Number(readFieldVal(newChar.PV, totPV));
            const newTotMN = Number(readFieldVal(newChar.MN, totMN));
            const newTotSTA = Number(readFieldVal(newChar.STA, totSTA));

            // se o documento traz os atuais, respeita; senão garante que atuais não excedam totais
            const newCurPV = Number(readFieldAtual(newChar.PV, Math.min(curPV, newTotPV)));
            const newCurMN = Number(readFieldAtual(newChar.MN, Math.min(curMN, newTotMN)));
            const newCurSTA = Number(readFieldAtual(newChar.STA, Math.min(curSTA, newTotSTA)));

            // aplica nas variáveis locais
            totPV = Math.max(0, Math.floor(newTotPV || 0));
            totMN = Math.max(0, Math.floor(newTotMN || 0));
            totSTA = Math.max(0, Math.floor(newTotSTA || 0));

            curPV = clamp(Number(newCurPV || 0), 0, totPV);
            curMN = clamp(Number(newCurMN || 0), 0, totMN);
            curSTA = clamp(Number(newCurSTA || 0), 0, totSTA);

            // 5) Atualiza LVL e EXP locais (sevier existir no doc)
            expLevel = Math.max(1, Math.floor(Number(newChar.LVL ?? expLevel)));
            currentEXP = Math.max(0, Math.floor(Number(newChar.EXP?.atual ?? currentEXP)));
            normalizeExpState(); // garante que currentEXP/expLevel estejam coerentes com limites

            // 6) Atualiza pontos_restantes local e no display (prioridade Firestore)
            // charData já aponta para newChar, por isso updateRemainingUI() usará pontos_restantes vindo do Firestore
            // mas atualizamos charData.pontos_restantes explicitamente para coerência
            if (typeof newChar.pontos_restantes !== 'undefined') {
                charData.pontos_restantes = Number(newChar.pontos_restantes ?? 0);
            }

            // 7) Atualiza as barras e textos na UI sem salvar (usar applyBar em vez de updateAllBars para evitar re-save)
            try {
                applyBar('pv-bar-fill', 'pv-bar-text', curPV, totPV, 'pv');
                applyBar('mn-bar-fill', 'mn-bar-text', curMN, totMN, 'mn');
                applyBar('sta-bar-fill', 'sta-bar-text', curSTA, totSTA, 'sta');

                const expLimit = expLimitForLevel(expLevel);
                applyBar('exp-bar-fill', 'exp-bar-text', currentEXP, expLimit, 'exp');

                // atualiza textos estáticos
                const lvlEl = document.getElementById('exp-level');
                if (lvlEl) lvlEl.textContent = String(expLevel);

                if (document.getElementById('stat-pv')) document.getElementById('stat-pv').textContent = String(totPV);
                if (document.getElementById('stat-mn')) document.getElementById('stat-mn').textContent = String(totMN);
                if (document.getElementById('stat-sta')) document.getElementById('stat-sta').textContent = String(totSTA);
            } catch (e) {
                console.warn('Erro atualizando barras localmente:', e);
            }

            // 8) Atualiza display de pontos restantes e outros elementos dependentes
            try {
                updateRemainingUI(); // já prioriza charData.pontos_restantes se existir
            } catch (e) {
                console.warn('updateRemainingUI erro:', e);
            }

            // 9) Mantém consistente charData locais (útil para outras funções que leem charData)
            try {
                charData.PV = (charData.PV && typeof charData.PV === 'object') ? charData.PV : { atual: curPV, total: totPV };
                charData.MN = (charData.MN && typeof charData.MN === 'object') ? charData.MN : { atual: curMN, total: totMN };
                charData.STA = (charData.STA && typeof charData.STA === 'object') ? charData.STA : { atual: curSTA, total: totSTA };
                charData.LVL = expLevel;
                charData.EXP = charData.EXP || {};
                charData.EXP.atual = currentEXP;
                // pontos_restantes já atualizado acima se veio do Firestore
            } catch (e) { /* silencioso */ }
        }

        // se onSnapshot disponível (Firebase modular), usa ele
        if (typeof window.onSnapshot === 'function') {
            __unsubAttrRemaining = window.onSnapshot(userDocRef, (snap) => {
                if (!snap || !snap.exists) return;
                const data = snap.data();
                const chars = Array.isArray(data.personagens) ? data.personagens : [];
                const found = chars.find(c => c && c.uid === charUid);
                if (found) applyRemoteCharData(found);
            }, (err) => {
                console.warn('onSnapshot erro (attr-remaining):', err);
            });
        } else {
            // fallback: polling discreto a cada 5s
            let lastFetched = null;
            __unsubAttrRemaining = setInterval(async () => {
                try {
                    const doc = await window.getDoc(userDocRef);
                    if (!doc || !doc.exists()) return;
                    const data = doc.data();
                    // evita re-aplicar se não mudou (controle simples via JSON stringify)
                    const key = JSON.stringify(data.personagens || []);
                    if (key === lastFetched) return;
                    lastFetched = key;
                    const chars = Array.isArray(data.personagens) ? data.personagens : [];
                    const found = chars.find(c => c && c.uid === charUid);
                    if (found) applyRemoteCharData(found);
                } catch (e) {
                    console.warn('Polling attr-remaining falhou:', e);
                }
            }, 5000);
        }

        // cleanup ao sair da página
        window.addEventListener('beforeunload', () => {
            try {
                if (typeof __unsubAttrRemaining === 'function') __unsubAttrRemaining();
                else if (typeof __unsubAttrRemaining === 'number') clearInterval(__unsubAttrRemaining);
            } catch (e) { /* silencioso */ }
        });
    }

    // inicia imediatamente (após a UI inicial já ter sido montada)
    startAttrRemainingListener();

    // --- FIM: mostrar e salvar "Pontos restantes" ---


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
                try { updateRemainingUI(); } catch (e) {/* silencioso */ }
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
                                    const raw = Number(attributes[k] ?? 0);
                                    const bonus = getBonus(k);        // já existe na sua função
                                    const total = raw + bonus;
                                    characters[index].atributos[k] = raw;
                                });

                                // atualiza os totais de PV/MN/STA
                                characters[index].PV = charData.PV;
                                characters[index].MN = charData.MN;
                                characters[index].STA = charData.STA;

                                // ----------- ATUALIZAÇÃO AUTOMÁTICA DA CARGA -----------
                                // Usa BRAVURA TOTAL — inclusive com bônus racial aplicado.
                                const bravuraTotal = Number(attrKeys.bravura ?? 0);
                                const novaCarga = 8 + bravuraTotal;


                                // salva no objeto local
                                characters[index].carga = novaCarga;

                                // também salva em atributos.carga (compatibilidade retroativa)
                                characters[index].atributos = characters[index].atributos || {};
                                characters[index].atributos.carga = novaCarga;

                                // atualiza UI do stat-carga
                                const cargaEl = document.getElementById('stat-carga');
                                if (cargaEl) cargaEl.textContent = novaCarga;
                                updatePesoUI();

                                // mantém charData em sincronia
                                if (charData) {
                                    charData.carga = novaCarga;
                                    if (charData.atributos) charData.atributos.carga = novaCarga;
                                }

                                (() => {
                                    const ATTR_KEYS_LIST = ['tecnica', 'intelecto', 'essencia', 'arcano', 'bravura', 'folego'];
                                    const savedAttrs = characters[index].atributos || {};

                                    // cria mapa normalizedKey -> rawValue a partir do objeto salvo (pode ter acento)
                                    const normalizedMapSaved = {};
                                    Object.keys(savedAttrs).forEach(origKey => {
                                        try {
                                            const nk = normalize(origKey);
                                            normalizedMapSaved[nk] = Number(savedAttrs[origKey] ?? 0);
                                        } catch (e) {
                                            normalizedMapSaved[String(origKey)] = Number(savedAttrs[origKey] ?? 0);
                                        }
                                    });

                                    const anyMinusOneSaved = ATTR_KEYS_LIST.some(k => Number(normalizedMapSaved[k] ?? 0) === -1);
                                    const allowedCapSaved = anyMinusOneSaved ? 8 : 7;

                                    let sumRawSaved = 0;
                                    for (const k of ATTR_KEYS_LIST) sumRawSaved += Number(normalizedMapSaved[k] ?? 0);

                                    const remainingSaved = Math.max(0, allowedCapSaved - sumRawSaved);

                                    // salva como number no objeto do personagem
                                    characters[index].pontos_restantes = Number(remainingSaved);
                                    // também mantém charData local em sincronia, se aplicável
                                    if (charData) charData.pontos_restantes = Number(remainingSaved);
                                })();

                                // SALVA no campo CORRETO 'personagens'
                                await window.updateDoc(userDocRef, { personagens: characters });
                                console.log('Atributos salvos em personagens[' + index + ']', characters[index].atributos);
                                try { updateRemainingUI(); } catch (e) {/* ignorar */ }
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

    // tornar nome clicável para edição
    const charNameEl = document.getElementById('char-name');
    if (charNameEl) {
        charNameEl.style.cursor = 'pointer';
        charNameEl.addEventListener('click', async (e) => {
            e.stopPropagation();

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'char-name-input';
            input.value = charName;
            input.style.fontSize = charNameEl.style.fontSize;
            input.style.fontWeight = charNameEl.style.fontWeight;
            input.style.color = charNameEl.style.color;

            charNameEl.style.display = 'none';
            charNameEl.parentElement.appendChild(input);
            input.focus();
            input.select();

            async function finish(commit) {
                if (commit) {
                    const newName = input.value.trim();
                    if (newName && newName !== charName) {
                        charName = newName;
                        charData.nome = newName;
                        charNameEl.textContent = newName;

                        try {
                            await saveCharacterField('nome', newName);
                        } catch (error) {
                            console.error('Error saving character name:', error);
                        }
                    }
                }
                input.remove();
                charNameEl.style.display = '';
            }

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') finish(true);
                else if (ev.key === 'Escape') finish(false);
            });
            input.addEventListener('blur', () => finish(true));
        });
    }

    // tornar imagem clicável para upload
    const charImgEl = document.getElementById('char-img');
    if (charImgEl) {
        charImgEl.style.cursor = 'pointer';
        charImgEl.title = 'Clique para mudar a imagem';
        charImgEl.addEventListener('click', async (e) => {
            e.stopPropagation();

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            document.body.appendChild(fileInput);
            fileInput.click();

            fileInput.addEventListener('change', async (ev) => {
                const file = ev.target.files[0];
                if (!file) {
                    document.body.removeChild(fileInput);
                    return;
                }

                // ler arquivo como base64
                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const base64 = evt.target.result.split(',')[1]; // tirar 'data:image/...;base64,'

                    try {
                        // upload para imgbb
                        const apiKey = '36597d22e15804939e4f93e0dc35445d'; // Substitua pela sua chave imgbb
                        const formData = new URLSearchParams();
                        formData.set('key', apiKey);
                        formData.set('image', base64);
                        formData.set('expiration', '0'); // nunca expira

                        const response = await fetch('https://api.imgbb.com/1/upload', {
                            method: 'POST',
                            body: formData,
                            headers: {
                                'Content-Type': 'application/x-www-form-urlencoded'
                            }
                        });

                        const data = await response.json();
                        if (!data.success) {
                            alert('Erro ao fazer upload da imagem.');
                            console.error(data);
                            return;
                        }

                        const imgUrl = data.data.url; // URL direta da imagem
                        console.log('Imagem uploadada:', imgUrl);

                        // salvar no campo 'img' (array)
                        let imgs = Array.isArray(charData.img) ? [...charData.img] : [];
                        imgs.unshift(imgUrl); // colocar no inicio como primeira imagem
                        charData.img = imgs;

                        // atualizar src
                        charImgEl.src = imgUrl;

                        // salvar no Firestore
                        await saveCharacterField('img', imgs);

                    } catch (error) {
                        alert('Erro ao fazer upload da imagem.');
                        console.error(error);
                    } finally {
                        document.body.removeChild(fileInput);
                    }
                };
                reader.readAsDataURL(file);
            });

            // remover input após um tempo para não deixar lixo
            setTimeout(() => {
                if (document.body.contains(fileInput)) document.body.removeChild(fileInput);
            }, 30000); // 30s timeout
        });
    }


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
    renderProficiencies(charData || {});

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
            if (charData) {
                charData[fieldName] = value;
                // se atualizamos pontos no Firestore, atualiza a UI imediatamente
                try { if (typeof updateRemainingUI === 'function') updateRemainingUI(); } catch (e) { /* silencioso */ }
            }
            console.log(`Campo '${fieldName}' salvo para personagem[${idx}]`);
        } catch (err) {
            console.error('Erro ao salvar campo do personagem:', fieldName, err);
        }
    }

    // ---------- Funções de Level Up e modal de proficiências ----------

    /**
     * Mostra um modal simples para escolher uma proficiência entre as options
     * (removendo as que o personagem já possui). Chama onChoose(profic) quando
     * o jogador selecionar.
     */
    function showProficiencyModal(options, existing = [], onChoose = () => { }) {
        // evita múltiplos modais abertos
        if (document.getElementById('profic-modal-overlay')) return;

        const available = options.filter(o => !existing.includes(o));
        if (!available.length) {
            alert('Não há proficiências novas disponíveis.');
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'profic-modal-overlay';
        overlay.style = `
        position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
        background:rgba(0,0,0,0.6);z-index:9999;
    `;

        const box = document.createElement('div');
        box.style = `
        width:520px;max-width:92%;background:#161414;border:4px solid rgba(92,34,34,0.95);
        padding:18px;border-radius:12px;color:#efe6e2;font-family:inherit;
    `;
        box.innerHTML = `<h3 style="margin-top:0">Escolha uma proficiência</h3>
                     <p>Selecione uma proficiência para adicionar à sua ficha:</p>`;
        const list = document.createElement('div');
        list.style = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;';

        // protege contra double-clicks
        let resolved = false;
        function safeResolve(value) {
            if (resolved) return;
            resolved = true;
            try { onChoose(value); } catch (e) { console.warn('onChoose error', e); }
            if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
        }

        available.forEach(opt => {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = opt;
            b.style = `
            padding:8px 10px;border-radius:8px;border:2px solid rgba(92,34,34,0.9);
            background:transparent;color:inherit;cursor:pointer;font-weight:600;
        `;
            b.onclick = () => safeResolve(opt);
            list.appendChild(b);
        });

        const cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.textContent = 'Fechar';
        cancel.style = 'margin-top:12px;padding:8px 10px;border-radius:8px;cursor:pointer;';
        cancel.onclick = () => safeResolve(null); // IMPORTANT: resolve com null para evitar Promise pendente

        box.appendChild(list);
        box.appendChild(cancel);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    }


    /**
     * Aplica efeitos de subir níveis: incrementa pontos_restantes, aumenta PV/MN/STA.total
     * conforme a classe e atributos atuais (attrKeys). Para cada nível ganho executa as ações.
     *
     * @param {number} oldLevel
     * @param {number} newLevel
     */
    async function handleLevelUps(oldLevel, newLevel) {
        try {
            if (!window.firebaseauth?.currentUser) return;

            const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
            const userDocSnap = await window.getDoc(userDocRef);
            if (!userDocSnap.exists()) return;

            const data = userDocSnap.data();
            const characters = Array.isArray(data.personagens) ? data.personagens.slice() : [];
            const idx = characters.findIndex(c => c && c.uid === charUid);
            if (idx < 0) return;

            // loop nível-a-nível (para tratar triggers por nível se necessário)
            // loop nível-a-nível (para tratar triggers por nível se necessário)
            for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
                // 1) pontos_restantes +1
                const prevPR = Number(characters[idx].pontos_restantes ?? 0);
                characters[idx].pontos_restantes = prevPR + 1;
                if (charData) charData.pontos_restantes = characters[idx].pontos_restantes;

                // 2) incrementos em PV / MN / STA.total de acordo com a classe (usa attrKeys já calculado)
                const brav = Number(attrKeys.bravura ?? 0);
                const arca = Number(attrKeys.arcano ?? 0);
                const fole = Number(attrKeys.folego ?? 0);
                const ess = Number(attrKeys.essencia ?? 0);

                let addPV = 0, addMN = 0, addSTA = 0;
                if (savedClass === 'Arcanista') {
                    addPV = 2 + brav;
                    addMN = 5 + arca;
                    addSTA = 2 + fole;
                } else if (savedClass === 'Escudeiro') {
                    addPV = 4 + brav;
                    addMN = 1 + arca;
                    addSTA = 1 + fole;
                } else if (savedClass === 'Luminar') {
                    addPV = 2 + brav;
                    addMN = 4 + arca;
                    addSTA = 4 + ess;
                } else if (savedClass === 'Errante') {
                    addPV = 3 + brav;
                    addMN = 1 + arca;
                    addSTA = 5 + fole;
                }

                // registra histórico
                characters[idx].levelHistory = Array.isArray(characters[idx].levelHistory) ? characters[idx].levelHistory : [];
                const histEntry = {
                    lvl: lvl,
                    addPV: Number(addPV) || 0,
                    addMN: Number(addMN) || 0,
                    addSTA: Number(addSTA) || 0,
                    pointsAdded: 1,
                    profAdded: null,
                    ts: Date.now()
                };
                characters[idx].levelHistory.push(histEntry);

                // garante campos e aplica incrementos
                characters[idx].PV = characters[idx].PV || { atual: 0, total: 0 };
                characters[idx].MN = characters[idx].MN || { atual: 0, total: 0 };
                characters[idx].STA = characters[idx].STA || { atual: 0, total: 0 };

                characters[idx].PV.total = Number(characters[idx].PV.total ?? 0) + Number(addPV);
                characters[idx].MN.total = Number(characters[idx].MN.total ?? 0) + Number(addMN);
                characters[idx].STA.total = Number(characters[idx].STA.total ?? 0) + Number(addSTA);

                // ajusta atuais se necessário
                if (Number(characters[idx].PV.atual) > characters[idx].PV.total) characters[idx].PV.atual = characters[idx].PV.total;
                if (Number(characters[idx].MN.atual) > characters[idx].MN.total) characters[idx].MN.atual = characters[idx].MN.total;
                if (Number(characters[idx].STA.atual) > characters[idx].STA.total) characters[idx].STA.atual = characters[idx].STA.total;

                // 3) se nível for múltiplo de 5, abrir modal de proficiências e aguardar escolha (cancel retorna null)
                if (lvl % 5 === 0) {
                    const allOptions = [
                        'Armas Leves', 'Armas Comuns', 'Armas de Duas Mãos', 'Armas Técnicas',
                        'Escudos Leves', 'Escudos Médios', 'Escudos Pesados',
                        'Armaduras Leves', 'Armaduras Médias', 'Armaduras Pesadas',
                        'Cajados', 'Tomos'
                    ];

                    const existing = Array.isArray(characters[idx].proeficiencias)
                        ? characters[idx].proeficiencias.slice()
                        : (Array.isArray(charData?.proeficiencias) ? charData.proeficiencias.slice() : []);

                    // espera o usuário escolher OU cancelar (null)
                    await new Promise(resolve => {
                        showProficiencyModal(allOptions, existing, async (pick) => {
                            try {
                                if (pick) {
                                    const arr = Array.isArray(characters[idx].proeficiencias) ? characters[idx].proeficiencias : [];
                                    if (!arr.includes(pick)) {
                                        arr.push(pick);
                                        characters[idx].proeficiencias = arr;
                                        if (charData) charData.proeficiencias = arr.slice();
                                        histEntry.profAdded = pick;
                                        // salva a mudança de proficiência imediatamente (otimistic + persist)
                                        try {
                                            await window.updateDoc(userDocRef, { personagens: characters });
                                            // atualiza UI local (otimistic)
                                            charData = characters[idx];
                                            try { renderProficiencies(charData); } catch (e) { console.warn('renderProficiencies erro (post-level):', e); }

                                        } catch (e) {
                                            console.warn('Falha ao salvar proficiência', e);
                                        }
                                    }
                                }
                            } catch (e) {
                                console.warn('Erro no callback de proficiência', e);
                            } finally {
                                resolve();
                            }
                        });
                    });
                }

                // fim do loop
            } // fim for levels

            // Atualiza LVL no objeto e persiste TUDO (garante que LVL subiu)
            characters[idx].LVL = Number(newLevel);
            if (charData) charData.LVL = Number(newLevel);

            // grava alterações finais (PV/MN/STA totals + pontos_restantes + proeficiencias)
            await window.updateDoc(userDocRef, { personagens: characters });

            // --- OTIMISTIC UI UPDATE: aplica imediatamente sem esperar onSnapshot ---
            try {
                charData = characters[idx];
                try { renderProficiencies(charData); } catch (e) { console.warn('renderProficiencies erro (post-level):', e); }

                // atualizar variáveis locais usadas pela UI
                totPV = Number(charData.PV?.total ?? totPV);
                totMN = Number(charData.MN?.total ?? totMN);
                totSTA = Number(charData.STA?.total ?? totSTA);

                curPV = Math.min(curPV, totPV);
                curMN = Math.min(curMN, totMN);
                curSTA = Math.min(curSTA, totSTA);

                // atualiza as barras/textos (sem regravar)
                applyBar('pv-bar-fill', 'pv-bar-text', curPV, totPV, 'pv');
                applyBar('mn-bar-fill', 'mn-bar-text', curMN, totMN, 'mn');
                applyBar('sta-bar-fill', 'sta-bar-text', curSTA, totSTA, 'sta');

                const expLimit = expLimitForLevel(Number(charData.LVL ?? expLevel));
                applyBar('exp-bar-fill', 'exp-bar-text', currentEXP, expLimit, 'exp');

                const lvlEl = document.getElementById('exp-level');
                if (lvlEl) lvlEl.textContent = String(charData.LVL ?? expLevel);

                if (document.getElementById('stat-pv')) document.getElementById('stat-pv').textContent = String(totPV);
                if (document.getElementById('stat-mn')) document.getElementById('stat-mn').textContent = String(totMN);
                if (document.getElementById('stat-sta')) document.getElementById('stat-sta').textContent = String(totSTA);

                try { updateRemainingUI(); } catch (e) { console.warn('updateRemainingUI erro (post-level):', e); }
            } catch (e) {
                console.warn('Erro no optimistic UI update pós-level:', e);
            }

            // também salva barras (LVL/EXP e atuais) usando sua rotina existente
            await saveBarsToFirestore();

        } catch (err) {
            console.error('handleLevelUps error', err);
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

    // --- Substitua sua função openItemDetailModal existente por esta ---
    function openItemDetailModal(itemId, itemData) {
        const modal = document.getElementById("inventory-item-modal");
        if (!modal) {
            console.warn("Modal do inventário não encontrado no HTML");
            return;
        }

        const titleEl = modal.querySelector(".item-detail-title");
        const fieldsEl = modal.querySelector(".item-detail-fields");
        const actionsContainer = modal.querySelector(".item-detail-actions");

        if (!titleEl || !fieldsEl) {
            console.warn("Elementos internos do modal não encontrados (title/fields).");
            return;
        }

        // título
        titleEl.textContent = (itemData && itemData.nome) ? String(itemData.nome) : "(Sem nome)";

        // limpa conteúdo
        fieldsEl.innerHTML = "";

        // adiciona campos válidos (mesma lógica que já tinha)
        for (const [key, value] of Object.entries(itemData || {})) {
            if (key === "nome") continue;
            if (value === "Nenhum") continue;
            if (value === "" || value === null) continue;
            if (typeof value === "string" && value.trim() === "") continue;
            if (value === undefined) continue;

            const row = document.createElement("div");
            row.className = "detail-row";
            // mostra label mais legível: capitaliza key simples (você pode ajustar conforme quiser)
            const label = String(key).replace(/_/g, ' ');
            row.innerHTML = `<strong>${label}:</strong> <span>${String(value)}</span>`;
            fieldsEl.appendChild(row);
        }

        // garante que a área de ações exista (se o HTML não tiver, criamos)
        if (!actionsContainer) {
            const ac = document.createElement('div');
            ac.className = 'item-detail-actions';
            ac.style.display = 'flex';
            ac.style.flexDirection = 'column';
            ac.style.gap = '8px';
            ac.style.marginTop = '12px';

            const btnDelete = document.createElement('button');
            btnDelete.id = 'inv-item-delete';
            btnDelete.type = 'button';
            btnDelete.className = 'alert-btn';
            btnDelete.textContent = 'Excluir';
            ac.appendChild(btnDelete);

            const btnRemove = document.createElement('button');
            btnRemove.id = 'inv-remove-from-char';
            btnRemove.type = 'button';
            btnRemove.className = 'alert-btn';
            btnRemove.textContent = 'Remover do inventário';
            ac.appendChild(btnRemove);

            modal.querySelector('.modal-content').appendChild(ac);
        } else {
            // se existe, removemos event listeners antigos pra evitar duplicação (substituímos via clone)
            // (nó rápido: clona e substitui para limpar listeners)
            const fresh = actionsContainer.cloneNode(true);
            actionsContainer.parentElement.replaceChild(fresh, actionsContainer);
        }

        // abre o modal
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");

        // botão fechar
        const closeBtn = document.getElementById("inv-item-close");
        if (closeBtn) {
            closeBtn.onclick = (ev) => {
                ev.stopPropagation();
                modal.classList.remove("open");
                modal.setAttribute("aria-hidden", "true");
            };
        }

        // Handler do botão "Remover do inventário" (apaga somente a entrada em usuários.personagens[].itens)
        const removeBtn = document.getElementById('inv-remove-from-char');
        if (removeBtn) {
            removeBtn.onclick = async (ev) => {
                ev.stopPropagation();
                if (!itemId) {
                    alert('UID do item não disponível — impossível remover.');
                    return;
                }
                // confirmação
                const ok = window.confirm('Remover este item do inventário do personagem?');
                if (!ok) return;

                try {
                    const user = window.firebaseauth?.currentUser;
                    if (!user) throw new Error('Usuário não autenticado.');

                    const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                    const userSnap = await window.getDoc(userRef);
                    if (!userSnap.exists()) throw new Error('Documento de usuário não encontrado.');

                    const data = userSnap.data() || {};
                    const personagens = Array.isArray(data.personagens) ? data.personagens.slice() : [];

                    // busca o charId no contexto (usa sua função utilitária se existir)
                    const charId = (typeof getCharUidFromContext === 'function') ? getCharUidFromContext() : (typeof charUid !== 'undefined' ? charUid : null);
                    if (!charId) throw new Error('UID do personagem não definido (getCharUidFromContext/charUid).');

                    const idx = personagens.findIndex(p => p && p.uid === charId);
                    if (idx < 0) throw new Error('Personagem não encontrado no documento do usuário.');

                    // garante array de itens do personagem
                    personagens[idx].itens = Array.isArray(personagens[idx].itens) ? personagens[idx].itens.slice() : [];

                    // encontra por uid e remove somente aquela entrada
                    const removeIndex = personagens[idx].itens.findIndex(it => String(it?.uid) === String(itemId));
                    if (removeIndex < 0) {
                        alert('Item não encontrado no inventário deste personagem.');
                        return;
                    }

                    const removedEntry = personagens[idx].itens[removeIndex];
                    const removedItemUid = removedEntry?.uid;

                    // cria novo array sem o elemento
                    const novoArray = personagens[idx].itens.slice();
                    novoArray.splice(removeIndex, 1);
                    personagens[idx].itens = novoArray;

                    // recalcula peso usando sua função existente (calcularPesoAtual)
                    let novoPeso = 0;
                    try {
                        if (typeof calcularPesoAtual === 'function') {
                            novoPeso = await calcularPesoAtual(personagens[idx].itens);
                        }
                    } catch (e) {
                        console.warn('Falha ao recalcular peso (não crítico):', e);
                    }
                    personagens[idx].peso_atual = Number(novoPeso || 0);

                    // salva no Firestore
                    await window.updateDoc(userRef, { personagens });

                    // se o item removido tiver uid, ajusta DEF via sua função (se aplicável)
                    if (removedItemUid && typeof modifyDefByItemUid === 'function') {
                        try {
                            await modifyDefByItemUid(String(removedItemUid), 'remove');
                        } catch (e) {
                            console.warn('Falha ao ajustar DEF depois de remover item (não crítico):', e);
                        }
                    }

                    // Atualiza UI local (peso, slots)
                    if (typeof updatePesoImmediately === 'function') {
                        try { await updatePesoImmediately(); } catch (e) { console.warn('updatePesoImmediately falhou:', e); }
                    } else if (typeof updatePesoUI === 'function') {
                        try { updatePesoUI(); } catch (e) {/*silent*/ }
                    }
                    if (typeof refreshSlotsFromCharData === 'function') await refreshSlotsFromCharData();

                    // Fecha modal
                    modal.classList.remove('open');
                    modal.setAttribute('aria-hidden', 'true');

                } catch (err) {
                    console.error('Erro ao remover item do inventário', err);
                    alert('Erro ao remover item do inventário. Veja o console para detalhes.');
                }
            };
        }

        // (Opcional) Handler do botão "Excluir" (apenas visual — se você já tiver lógica para apagar o documento, mantenha;
        //  aqui não implementamos exclusão de documento para segurança — caso queira que ele apague o doc de 'itens',
        //  posso adicionar essa lógica depois.)
        const deleteBtn = document.getElementById('inv-item-delete');
        if (deleteBtn) {
            deleteBtn.onclick = (ev) => {
                ev.stopPropagation();
                // se você tiver uma função específica para excluir o documento do collection 'itens', chame-a aqui.
                // Exemplo (NÃO HABILITADO): deleteItemDocument(itemId);
                // por enquanto, mostramos um aviso:
                const c = window.confirm('Este botão deveria apagar o documento do collection "itens". Deseja implementar?');
                if (c) {
                    alert('Função de exclusão de documento não foi implementada automaticamente (precisa confirmar comportamento).');
                }
            };
        }
    }

    /* ---------- INVENTÁRIO (real-time Firestore) ---------- */

    let inventoryFromFirebase = []; // usado no peso

    const main = document.querySelector('.character-main');
    if (main && !document.getElementById('inventory-wrap')) {

        const wrap = document.createElement('div');
        wrap.id = 'inventory-wrap';

        wrap.innerHTML = `
        <div class="inventory-card" aria-label="Inventário">
            <div class="inventory-top">
                <div class="peso">
                    <i class="fa-solid fa-dumbbell"></i>
                    <span id="peso-info">0 / 0</span><span>kg</span>
                </div>
                <input class="search-field" placeholder="Buscar item..." />
            </div>
            <div class="inventory-grid" role="list" aria-label="Slots do inventário"></div>
        </div>`;

        main.appendChild(wrap);

        const grid = wrap.querySelector(".inventory-grid");
        const slotsCount = 20;

        function createEmptySlots() {
            grid.innerHTML = "";
            for (let i = 0; i < slotsCount; i++) {
                const s = document.createElement("div");
                s.className = "inv-slot";
                s.dataset.slot = i;
                s.setAttribute("tabindex", "0");

                // handler: se vazio -> abrir modal criar; se tiver .inv-name -> abrir detalhe
                s.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    // se tem um filho com classe inv-name (item presente) -> abrir detalhe
                    if (s.querySelector('.inv-name')) {
                        // você já tem função openItemDetailModal(itemId, itemData)
                        // tentaremos extrair o id do texto ou dataset — caso o populate normal já setou
                        const nameDiv = s.querySelector('.inv-name');
                        // se o slot foi populado via enableRealtimeInventory, o onclick já será setado
                        // mas aqui tentamos uma proteção: se existir dataset.itemUid use ele
                        const uid = nameDiv && nameDiv.dataset && nameDiv.dataset.uid;
                        if (typeof openItemDetailModal === 'function' && uid) {
                            openItemDetailModal(uid);
                        } else if (typeof openItemDetailModal === 'function') {
                            openItemDetailModal(null); // fallback se sua função aceita null
                        }
                    } else {
                        // slot vazio -> abrir modal criar item
                        openCreateItemModal(Number(s.dataset.slot || 0));
                    }
                });

                // permitir keyboard enter para abrir também
                s.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') s.click();
                });

                grid.appendChild(s);
            }
        }

        createEmptySlots();

        /* ----------- REALTIME FIRESTORE LISTENER ----------- */
        function enableRealtimeInventory() {
            const user = window.firebaseauth?.currentUser;
            if (!user) return;

            const userRef = window.doc(window.firestoredb, "usuarios", user.uid);

            // Verifica se onSnapshot está disponível
            if (typeof window.onSnapshot === 'function') {
                // Usa realtime listener
                window.onSnapshot(userRef, async (snap) => {
                    if (!snap.exists()) return;

                    const data = snap.data();
                    const personagens = data.personagens || [];
                    const myChar = personagens.find(p => p.uid === charUid);
                    if (!myChar) return;

                    const equipped = Array.isArray(myChar.itens) ? myChar.itens : [];

                    // reseta a UI
                    inventoryFromFirebase = [];
                    createEmptySlots();

                    const slots = grid.querySelectorAll(".inv-slot");
                    let index = 0;

                    for (const entry of equipped) {
                        if (!entry?.uid) continue;
                        if (index >= slotsCount) break;

                        try {
                            const itemRef = window.doc(window.firestoredb, "itens", entry.uid);
                            const itemSnap = await window.getDoc(itemRef);
                            if (!itemSnap.exists()) continue;

                            const item = itemSnap.data();
                            inventoryFromFirebase.push(item);

                            const s = slots[index];

                            const div = document.createElement("div");
                            div.className = "inv-name";
                            div.textContent = item.nome || "(Sem nome)";

                            s.appendChild(div);
                            s.onclick = () => openItemDetailModal(itemSnap.id, item);

                            index++;
                        } catch (err) {
                            console.warn("Erro lendo item:", err);
                        }
                    }

                    if (typeof updatePesoImmediately === 'function') {
                        try { await updatePesoImmediately(); } catch (e) { console.warn('updatePesoImmediately falhou:', e); }
                    } else if (typeof updatePesoUI === 'function') {
                        try { updatePesoUI(); } catch (e) {/*silent*/ }
                    }
                }, (error) => {
                    console.warn('onSnapshot error:', error);
                });
            } else {
                // Fallback: polling manual a cada 3 segundos
                console.log('onSnapshot not available, using polling fallback');

                async function pollInventory() {
                    try {
                        const snap = await window.getDoc(userRef);
                        if (!snap.exists()) return;

                        const data = snap.data();
                        const personagens = data.personagens || [];
                        const myChar = personagens.find(p => p.uid === charUid);
                        if (!myChar) return;

                        const equipped = Array.isArray(myChar.itens) ? myChar.itens : [];

                        // reseta a UI
                        inventoryFromFirebase = [];
                        createEmptySlots();

                        const slots = grid.querySelectorAll(".inv-slot");
                        let index = 0;

                        for (const entry of equipped) {
                            if (!entry?.uid) continue;
                            if (index >= slotsCount) break;

                            try {
                                const itemRef = window.doc(window.firestoredb, "itens", entry.uid);
                                const itemSnap = await window.getDoc(itemRef);
                                if (!itemSnap.exists()) continue;

                                const item = itemSnap.data();
                                inventoryFromFirebase.push(item);

                                const s = slots[index];

                                const div = document.createElement("div");
                                div.className = "inv-name";
                                div.textContent = item.nome || "(Sem nome)";

                                s.appendChild(div);
                                s.onclick = () => openItemDetailModal(itemSnap.id, item);

                                index++;
                            } catch (err) {
                                console.warn("Erro lendo item:", err);
                            }
                        }

                        if (typeof updatePesoImmediately === 'function') {
                            try { await updatePesoImmediately(); } catch (e) { console.warn('updatePesoImmediately falhou:', e); }
                        } else if (typeof updatePesoUI === 'function') {
                            try { updatePesoUI(); } catch (e) {/*silent*/ }
                        }
                    } catch (error) {
                        console.warn('Poll inventory error:', error);
                    }
                }

                // Carrega inicialmente
                pollInventory();

                // Atualiza a cada 3 segundos
                setInterval(pollInventory, 3000);
            }
        }

        /* ========== Create-item modal logic ========== */
        const createBackdrop = document.getElementById('create-item-backdrop');
        const viewChoose = document.getElementById('create-view-choose');
        const viewForm = document.getElementById('create-view-form');
        const btnOpenForm = document.getElementById('btn-open-create-form');
        const btnCancelCreate = document.getElementById('btn-cancel-create');
        const btnBackToChoose = document.getElementById('btn-back-to-choose');
        const btnConfirmCreate = document.getElementById('btn-confirm-create');
        const inputNome = document.getElementById('create-item-nome');
        const inputDesc = document.getElementById('create-item-descricao');
        const inputPeso = document.getElementById('create-item-peso');

        // abre modal (slotIndex é reservado para futura lógica, hoje não usado mas útil)
        function openCreateItemModal(slotIndex) {
            if (!createBackdrop) return;
            // reset form
            if (inputNome) inputNome.value = '';
            if (inputDesc) inputDesc.value = '';
            if (inputPeso) inputPeso.value = '';
            // show choose view
            if (viewChoose) viewChoose.style.display = '';
            if (viewForm) viewForm.style.display = 'none';
            createBackdrop.style.display = 'flex';
            createBackdrop.classList.add('visible');
            createBackdrop.setAttribute('aria-hidden', 'false');
            // focar botão criar (melhora acessibilidade)
            if (btnOpenForm) btnOpenForm.focus();
        }

        // fechar modal
        function closeCreateItemModal() {
            if (!createBackdrop) return;
            createBackdrop.classList.remove('visible');
            createBackdrop.style.display = 'none';
            createBackdrop.setAttribute('aria-hidden', 'true');
        }

        // botão "Criar" mostra o formulário
        if (btnOpenForm) btnOpenForm.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (viewChoose) viewChoose.style.display = 'none';
            if (viewForm) viewForm.style.display = 'flex';
            if (inputNome) inputNome.focus();
        });

        // voltar para choose
        if (btnBackToChoose) btnBackToChoose.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (viewForm) viewForm.style.display = 'none';
            if (viewChoose) viewChoose.style.display = '';
            if (btnOpenForm) btnOpenForm.focus();
        });

        // cancelar / fechar
        if (btnCancelCreate) btnCancelCreate.addEventListener('click', (ev) => {
            ev.stopPropagation();
            closeCreateItemModal();
        });

        // clique no backdrop fecha
        if (createBackdrop) {
            createBackdrop.addEventListener('click', (ev) => {
                if (ev.target === createBackdrop) closeCreateItemModal();
            });
        }

        // confirmar criação: cria doc em 'itens' e adiciona uid em usuarios.personagens[idx].itens
        if (btnConfirmCreate) btnConfirmCreate.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (!inputNome) return alert('Preencha o nome.');
            const nome = String(inputNome.value || '').trim();
            const descricao = String(inputDesc.value || '').trim();

            if (!nome) {
                alert('O nome do item é obrigatório.');
                inputNome.focus();
                return;
            }


            try {
                // dentro do try do btnConfirmCreate:
                btnConfirmCreate.disabled = true;

                // 1) ler peso do input (se existir)
                let pesoNumber = "Nenhum";
                try {
                    const rawPeso = (typeof inputPeso !== 'undefined' && inputPeso) ? String(inputPeso.value || '').trim() : '';
                    const p = parseFloat(rawPeso.replace(',', '.'));
                    if (!isNaN(p) && isFinite(p)) pesoNumber = Number(p);
                } catch (e) {
                    pesoNumber = "Nenhum";
                }

                // 2) criar documento na coleção 'itens' (incluindo peso numérico quando aplicável)
                const itensCol = window.collection(window.firestoredb, 'itens');
                const newDocRef = await window.addDoc(itensCol, {
                    categoria: "Comum",
                    critico: "Nenhum",
                    dano: "Nenhum",
                    descricao: descricao || "",
                    efeito: "Nenhum",
                    habilidade: "Nenhum",
                    nome: nome,
                    peso: pesoNumber,
                    requisito: "Nenhum",
                    tipo_dano: "Nenhum",
                    tipo_item: "Nenhum"
                });

                const newItemId = String(newDocRef.id);

                // 3) adiciona UID no array do personagem (igual antes)
                const user = window.firebaseauth.currentUser;
                if (!user) throw new Error('Usuário não autenticado.');

                const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                const userSnap = await window.getDoc(userRef);
                if (!userSnap.exists()) throw new Error('Documento de usuário não encontrado.');

                const data = userSnap.data();
                const characters = Array.isArray(data.personagens) ? data.personagens.slice() : [];

                // achar índice do personagem atual (usa getCharUidFromContext se existir)
                const charId = (typeof getCharUidFromContext === 'function') ? getCharUidFromContext() : (typeof charUid !== 'undefined' ? charUid : null);
                if (!charId) throw new Error('UID do personagem não definido (getCharUidFromContext/charUid).');

                const idx = characters.findIndex(p => p && p.uid === charId);
                if (idx < 0) throw new Error('Personagem não encontrado no documento do usuário.');

                // garantir array e inserir { uid: newItemId }
                characters[idx].itens = Array.isArray(characters[idx].itens) ? characters[idx].itens.slice() : [];
                characters[idx].itens.push({ uid: newItemId });

                // salva o array no Firestore (peso será recalculado por updatePesoImmediately)
                await window.updateDoc(userRef, { personagens: characters });

                // Atualiza UI local e força recalculo e salvamento imediato do peso
                if (typeof refreshSlotsFromCharData === 'function') await refreshSlotsFromCharData();
                // usa a nova função para garantir que peso_atual e UI fiquem consistentes agora
                if (typeof updatePesoImmediately === 'function') await updatePesoImmediately();

                closeCreateItemModal();
                alert('Item criado e adicionado ao inventário.');


            } catch (err) {
                console.error('Erro criando item:', err);
                alert('Erro ao criar item. Veja console.');
            } finally {
                btnConfirmCreate.disabled = false;
            }
        });


        // ativa listener realtime
        setTimeout(enableRealtimeInventory, 300);

        /* ----------- BUSCA ----------- */
        const searchField = wrap.querySelector(".search-field");
        searchField?.addEventListener("input", () => {
            const q = searchField.value.trim().toLowerCase();
            grid.querySelectorAll(".inv-slot").forEach(s => {
                const txt = s.innerText.toLowerCase();
                s.style.opacity = txt.includes(q) ? "1" : "0.25";
            });
        });

    }


    /* ---------- PESO (permanece igual, só estava fora do lugar) ---------- */

    const pesoInfoSpan = document.getElementById('peso-info');
    if (pesoInfoSpan) {

        let totalPesoInventory = 0;
        inventoryFromFirebase.forEach(it => {
            const w = Number(it.peso ?? 0);
            totalPesoInventory += w;
        });

        let pesoAtual = Number(charData?.peso_atual);
        if (!Number.isFinite(pesoAtual) || pesoAtual === 0) {
            pesoAtual = totalPesoInventory || 0;
        }

        let cargaMax = Number(charData?.carga ?? charData?.atributos?.carga);
        if (!Number.isFinite(cargaMax) || cargaMax <= 0) {
            const bravuraRaw = Number(charData?.atributos?.bravura ?? 0) || 0;
            cargaMax = 8 + bravuraRaw;
        }

        pesoInfoSpan.textContent = `${pesoAtual} / ${cargaMax}`;
    }

    function updatePesoUI() {
        const pesoInfo = document.getElementById('peso-info');
        if (!pesoInfo) return;

        let pesoAtual = Number(charData?.peso_atual ?? 0);
        if (!Number.isFinite(pesoAtual)) pesoAtual = 0;

        const bravuraTotal = Number(attrKeys.bravura ?? 0);
        const cargaMax = 8 + bravuraTotal;

        pesoInfo.textContent = `${pesoAtual} / ${cargaMax}`;
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
    // inicializa atuais usando o que estiver salvo no Firestore (ou fallback para os valores base)
    let curPV = Math.max(0, Math.floor(charData?.PV?.atual ?? charData?.PV ?? pv));
    let curMN = Math.max(0, Math.floor(charData?.MN?.atual ?? charData?.MN ?? mn));
    let curSTA = Math.max(0, Math.floor(charData?.STA?.atual ?? charData?.STA ?? sta));

    // helper pequeno para ler total salvo (suporta {total: N} ou número antigo)
    function readTotal(fieldObj, fallback) {
        try {
            const v = fieldObj;
            if (v == null) return fallback;
            if (typeof v === 'number') return v;
            if (typeof v === 'object' && typeof v.total === 'number') return v.total;
            return fallback;
        } catch (e) {
            return fallback;
        }
    }

    // renderiza proficiências do personagem (robusto a nomes com/sem typo)
    function renderProficiencies(char) {
        if (!char) return;
        // procura o elemento onde as profs devem aparecer (suporta ambos IDs)
        const possibleIds = ['proficiencias-list', 'char-proficiencias'];
        let container = null;
        for (const id of possibleIds) {
            const e = document.getElementById(id);
            if (e) { container = e; break; }
        }
        if (!container) return;

        // lê ambas as variantes do campo no documento (compatibilidade)
        const arr = Array.isArray(char.proeficiencias) ? char.proeficiencias
            : Array.isArray(char.proficiencias) ? char.proficiencias
                : [];

        // atualiza DOM de forma clara
        if (!arr || arr.length === 0) {
            container.innerHTML = '<em>Sem proficiências</em>';
            return;
        }

        // cria lista simples com <ul> para melhor formatação
        const ul = document.createElement('ul');
        ul.className = 'profs-list';
        arr.forEach(p => {
            const li = document.createElement('li');
            li.textContent = String(p);
            ul.appendChild(li);
        });

        // substitui conteúdo atual
        container.innerHTML = '';
        container.appendChild(ul);
    }


    // usar o total salvo no Firestore se existir, caso contrário usa o valor base calculado (pv/mn/sta)
    let totPV = Math.max(0, Math.floor(Number(readTotal(charData?.PV, pv)) || 0));
    let totMN = Math.max(0, Math.floor(Number(readTotal(charData?.MN, mn)) || 0));
    let totSTA = Math.max(0, Math.floor(Number(readTotal(charData?.STA, sta)) || 0));


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
            // esconder ou resetar a imagem do detalhe (se existir)
            const imgEl = detailPanel.querySelector('#detail-icon');
            if (imgEl) {
                imgEl.style.display = 'none';
                imgEl.src = './imgs/placeholder.png';
            }
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

            // --- exibir imagem baseada em tipo/categoria ---
            try {
                // garante que exista o elemento (caso você não tenha inserido no HTML, cria em runtime)
                let imgEl = detailPanel.querySelector('#detail-icon');
                if (!imgEl) {
                    imgEl = document.createElement('img');
                    imgEl.id = 'detail-icon';
                    imgEl.className = 'detail-icon';
                    imgEl.style.display = 'none';
                    // insere logo após o título (detail-name)
                    const nameEl = detailPanel.querySelector('#detail-name');
                    if (nameEl && nameEl.parentNode) nameEl.parentNode.insertBefore(imgEl, nameEl.nextSibling);
                    else detailPanel.querySelector('.item-detail-content')?.prepend(imgEl);
                }

                // função helper para normalizar e comparar sem acentos/caixa
                const normalizeStr = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

                const tipo = normalizeStr(it.tipo_item);
                const categoria = normalizeStr(it.categoria);

                // regras de prioridade conforme solicitado:
                // 1) se tipo_item == "Arma" -> Arma.png
                // 2) se categoria == "Armadura" -> Armadura.png
                // 3) se categoria == "Tomo" -> Tomo.png
                // 4) se categoria == "Cajado" -> Cajado.png
                // 5) se tipo_item == "Utilitário" -> Utilitário.png
                // 6) se categoria == "Escudo" -> Escudos.png
                let src = './imgs/placeholder.png';

                if (tipo === 'arma') {
                    src = './imgs/Arma.png';
                } else if (categoria === 'armadura') {
                    src = './imgs/Armadura.png';
                } else if (categoria === 'tomo') {
                    src = './imgs/Tomo.png';
                } else if (categoria === 'cajado') {
                    src = './imgs/Cajado.png';
                } else if (tipo.includes('utilit')) { // cobre 'utilitário' e variações
                    src = './imgs/Utilitário.png';
                } else if (categoria === 'escudo') {
                    src = './imgs/Escudos.png';
                }

                // aplica src e mostra o elemento
                imgEl.src = src;
                imgEl.alt = it.nome ? `Ícone de ${it.nome}` : 'Ícone do item';
                imgEl.style.display = ''; // remove display:none

                // fallback: se imagem não carregar, volta para placeholder
                imgEl.onerror = function () {
                    this.onerror = null;
                    this.src = './imgs/placeholder.png';
                };
            } catch (err) {
                console.warn('Erro ao montar imagem do item (não crítico):', err);
            }


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

        // REPLACE: confirmEquip() com verificação única para "Armadura" e "Escudo"
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

                // Lê doc do item selecionado (robusto: aceita selectedItem.id ou selectedItem.uid)
                const selItemId = String(selectedItem.id || selectedItem.uid || selectedItem);
                const selItemRef = window.doc(window.firestoredb, 'itens', selItemId);
                const selItemSnap = await window.getDoc(selItemRef);
                const selItemData = selItemSnap && selItemSnap.exists() ? selItemSnap.data() : selectedItem;

                // categoria do item (normalizada)
                const categoriaRaw = (selItemData && selItemData.categoria) ? String(selItemData.categoria) : '';
                const categoriaNorm = categoriaRaw.normalize ? categoriaRaw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : String(categoriaRaw).trim().toLowerCase();

                // helper: verifica se já existe um item equipado com determinada categoria
                async function isCategoryAlreadyEquipped(itemsArray, categoriaToCheck) {
                    if (!categoriaToCheck) return false;
                    const norm = String(categoriaToCheck).normalize ? categoriaToCheck.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : String(categoriaToCheck).trim().toLowerCase();
                    // percorre os itens equipados e busca documentos (paralelizar requisições)
                    const promises = (itemsArray || []).map(async (entry) => {
                        if (!entry || !entry.uid) return false;
                        try {
                            const ref = window.doc(window.firestoredb, 'itens', entry.uid);
                            const snap = await window.getDoc(ref);
                            if (!snap.exists()) return false;
                            const d = snap.data();
                            const cat = (d && d.categoria) ? String(d.categoria) : '';
                            const catNorm = cat.normalize ? cat.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() : String(cat).trim().toLowerCase();
                            return catNorm === norm;
                        } catch (e) {
                            console.warn('isCategoryAlreadyEquipped: erro ao ler item', entry.uid, e);
                            return false;
                        }
                    });

                    const results = await Promise.all(promises);
                    return results.some(Boolean);
                }

                // Se o item que será equipado for "Armadura" ou "Escudo", checamos duplicata
                if (categoriaNorm === 'armadura' || categoriaNorm === 'escudo') {
                    const already = await isCategoryAlreadyEquipped(characters[idx].itens, categoriaNorm);
                    if (already) {
                        alert(`Já existe um item equipado com categoria "${categoriaRaw}". Só é permitido ter 1 ${categoriaRaw} equipado por personagem.`);
                        return;
                    }
                }

                // calcula peso atual (antes de adicionar)
                const pesoAtual = await calcularPesoAtual(characters[idx].itens);

                // tenta obter peso do item selecionado de forma robusta
                let pesoDoItem = Number(selItemData?.peso ?? selectedItem.peso);
                if (!Number.isFinite(pesoDoItem)) {
                    try {
                        const docRef = window.doc(window.firestoredb, 'itens', selItemId);
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

                // LER CARGA MÁXIMA
                let cargaMaxima = Number(characters[idx].carga ?? characters[idx].atributos?.carga);
                if (!Number.isFinite(cargaMaxima) || cargaMaxima <= 0) {
                    const raw = Number(characters[idx]?.atributos?.bravura ?? charData?.atributos?.bravura ?? 0) || 0;
                    let bonus = 0;
                    const r = characters[idx].raca;
                    const sr = characters[idx].subraca;
                    if (r === 'Feéricos' && sr === 'Ágeis') bonus = 1;
                    if (r === 'Elfo') bonus = 1;
                    if (r === 'Meio Orc') bonus = 1;
                    cargaMaxima = 8 + (raw + bonus);
                }
                cargaMaxima = Number(cargaMaxima);

                if ((pesoAtual + pesoDoItem) > cargaMaxima) {
                    alert(
                        `Não é possível equipar este item — ele aumentaria o peso de ${pesoAtual} → ${pesoAtual + pesoDoItem} ` +
                        `e ultrapassaria a carga máxima do personagem (${cargaMaxima}).`
                    );
                    return; // não adiciona
                }

                // adiciona item (armazenando uid)
                characters[idx].itens.push({ uid: selItemId });

                // recalcula peso_atual já com o novo item
                const novoPeso = (typeof calcularPesoAtual === 'function')
                    ? await calcularPesoAtual(characters[idx].itens)
                    : Number(await (window.calcularPesoAtual?.(characters[idx].itens) ?? 0));
                characters[idx].peso_atual = novoPeso;

                // salva no Firestore
                await window.updateDoc(userRef, { personagens: characters });

                // Após salvar com sucesso, ajustar DEF se necessário (item de proteção)
                try {
                    await modifyDefByItemUid(selItemId, 'add');
                } catch (e) {
                    console.warn('Avise: falha ao tentar ajustar DEF depois de equipar (não crítico):', e);
                }

                // Atualiza UI imediatamente
                updatePesoUI();
                await refreshSlotsFromCharData();
                closeModal();

            } catch (err) {
                console.error('Erro ao equipar item:', err);
                alert('Erro ao equipar item. Veja console para detalhes.');
            } finally {
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

        window.calcularPesoAtual = calcularPesoAtual;

        // ---------- NOVO: recalc + salva e atualiza a UI imediatamente ----------
        async function updatePesoImmediately() {
            try {
                // pega uid do personagem no contexto
                const charId = (typeof getCharUidFromContext === 'function') ? getCharUidFromContext() : (typeof charUid !== 'undefined' ? charUid : null);
                if (!charId) return;

                const user = window.firebaseauth?.currentUser;
                if (!user) return;

                const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                const userSnap = await window.getDoc(userRef);
                if (!userSnap.exists()) return;

                const data = userSnap.data() || {};
                const personagens = Array.isArray(data.personagens) ? data.personagens.slice() : [];
                const idx = personagens.findIndex(p => p && p.uid === charId);
                if (idx < 0) return;

                // garante array itens
                const itensArray = Array.isArray(personagens[idx].itens) ? personagens[idx].itens.slice() : [];

                // calcula peso (usa sua função existente)
                let novoPeso = 0;
                if (typeof calcularPesoAtual === 'function') {
                    try {
                        novoPeso = await calcularPesoAtual(itensArray);
                    } catch (e) {
                        console.warn('Falha ao calcular peso dentro de updatePesoImmediately (não crítico):', e);
                        novoPeso = Number(personagens[idx].peso_atual || 0);
                    }
                }

                novoPeso = Number(novoPeso || 0);
                personagens[idx].peso_atual = novoPeso;

                // salva no Firestore (substitui array personagens)
                await window.updateDoc(userRef, { personagens });

                // atualiza cache local se existir
                try { if (typeof charData !== 'undefined') charData = personagens[idx]; } catch (e) {/*ignore*/ }

                // atualiza o span de peso na UI imediatamente
                const pesoInfoEl = document.getElementById('peso-info');
                if (pesoInfoEl) {
                    // tenta calcular carga máxima (usa sua lógica atual: carga / atributos.bravura / fallback)
                    let cargaMax = Number(personagens[idx].carga ?? personagens[idx].atributos?.carga);
                    if (!Number.isFinite(cargaMax) || cargaMax <= 0) {
                        const bravuraRaw = Number(personagens[idx].atributos?.bravura ?? 0) || 0;
                        cargaMax = 8 + bravuraRaw;
                    }
                    pesoInfoEl.textContent = `${novoPeso} / ${cargaMax}`;
                }

            } catch (err) {
                console.warn('updatePesoImmediately falhou:', err);
            }
        }

        // expõe globalmente (protege casos onde outras funções chamam global)
        window.updatePesoImmediately = updatePesoImmediately;


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
                    // RAW + bônus racial
                    const raw = Number(myChar.atributos?.bravura ?? 0) || 0;

                    let bonus = 0;
                    if (myChar.raca === 'Feéricos' && myChar.subraca === 'Ágeis') bonus = 1;
                    if (myChar.raca === 'Elfo') bonus = 1;
                    if (myChar.raca === 'Meio Orc') bonus = 1;

                    const bravuraTotal = raw + bonus;

                    cargaMax = 8 + bravuraTotal;
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
                        // ao clicar, removemos a instância pelo índice original (sourceIndex)
                        removeBtn.addEventListener('click', async (ev) => {
                            ev.stopPropagation(); // evita abrir modal se clicar no item
                            // passa o sourceIndex (índice no array personagens[idx].itens)
                            await removerItemEquipado(itemWrap.sourceIndex);
                            // refresh é chamado dentro de removerItemEquipado, mas aqui manter redundância segura:
                            await refreshSlotsFromCharData();
                        });

                        li.appendChild(removeBtn);

                        ul.appendChild(li);
                    });

                    body.appendChild(ul);
                }

                // Remove apenas a entrada na posição passada (não remove todas as que têm o mesmo uid)
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

                        // valida índice
                        if (!Number.isFinite(itemIndexToRemove) || itemIndexToRemove < 0 || itemIndexToRemove >= itens.length) {
                            console.warn('Índice inválido ao tentar remover item.', itemIndexToRemove);
                            return;
                        }

                        // pega uid do item que será removido (antes de splice)
                        const removedItemEntry = itens[itemIndexToRemove];
                        const removedItemUid = removedItemEntry?.uid;

                        // remove somente esse elemento
                        const novoArray = itens.slice();
                        novoArray.splice(itemIndexToRemove, 1);
                        personagens[idx].itens = novoArray;

                        // recalcular peso
                        const novoPeso = await calcularPesoAtual(personagens[idx].itens);
                        personagens[idx].peso_atual = novoPeso;

                        // salva no Firestore
                        await window.updateDoc(userRef, { personagens });

                        // se tivermos o uid do item removido, ajustar DEF subtraindo efeito (se for proteção)
                        if (removedItemUid) {
                            try {
                                await modifyDefByItemUid(String(removedItemUid), 'remove');
                            } catch (e) {
                                console.warn('Falha ao ajustar DEF depois de remover item (não crítico):', e);
                            }
                        }

                        // atualizar UI local
                        updatePesoUI();
                        // atualiza slots na UI
                        await refreshSlotsFromCharData();
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

        /* ===== Gerenciar DEF ao equipar / desequipar itens de tipo "proteção" =====
   Uso:
     // depois de adicionar o documento do item ao array personagens[].itens
     await modifyDefByItemUid(itemUid, 'add');

     // depois de remover (quando for remover do array personagens[].itens)
     await modifyDefByItemUid(itemUid, 'remove');

   Observação: o campo 'efeito' no documento em coleção 'itens' será convertido para Number().
*/
        async function modifyDefByItemUid(itemUid, operation = 'add') {
            try {
                if (!itemUid) {
                    console.warn('modifyDefByItemUid: itemUid ausente.');
                    return;
                }
                // garante operação válida
                if (operation !== 'add' && operation !== 'remove') {
                    console.warn('modifyDefByItemUid: operação inválida', operation);
                    return;
                }

                // pega documento do item
                const itemRef = window.doc(window.firestoredb, 'itens', String(itemUid));
                const itemSnap = await window.getDoc(itemRef);
                if (!itemSnap || !itemSnap.exists()) {
                    console.warn('modifyDefByItemUid: documento de item não encontrado:', itemUid);
                    return;
                }
                const itemData = itemSnap.data() || {};

                // só prossegue se for tipo "proteção" (case-insensitive)
                const tipo = String(itemData.tipo_item || '').trim().toLowerCase();
                if (tipo !== 'proteção' && tipo !== 'protecao') { // aceita sem acento também
                    // não é item de proteção -> nada a fazer
                    return;
                }

                // obtém valor numérico do efeito (padrão 0)
                const efeitoRaw = itemData.efeito;
                // garantir conversão segura para número (se for string "3" ou number 3)
                const efeito = Number(efeitoRaw);
                if (Number.isNaN(efeito) || efeito === 0) {
                    // nada para somar/subtrair
                    return;
                }

                // usuário atual
                const currentUser = window.firebaseauth?.currentUser;
                if (!currentUser) {
                    console.warn('modifyDefByItemUid: usuário não autenticado.');
                    return;
                }

                // pega documento do usuário
                const userRef = window.doc(window.firestoredb, 'usuarios', currentUser.uid);
                const userSnap = await window.getDoc(userRef);
                if (!userSnap || !userSnap.exists()) {
                    console.warn('modifyDefByItemUid: documento de usuário não encontrado.');
                    return;
                }
                const userData = userSnap.data() || {};

                // copia array de personagens pra editar
                const personagens = Array.isArray(userData.personagens) ? userData.personagens.slice() : [];
                const pIndex = personagens.findIndex(p => p && p.uid === charUid);
                if (pIndex < 0) {
                    console.warn('modifyDefByItemUid: personagem não encontrado no documento do usuário (charUid):', charUid);
                    return;
                }

                // pega DEF atual (garante number)
                const currentDEFraw = personagens[pIndex].DEF;
                const currentDEF = (currentDEFraw === undefined || currentDEFraw === null) ? 0 : Number(currentDEFraw);
                const safeCurrentDEF = Number.isNaN(currentDEF) ? 0 : currentDEF;

                // cálculo (digit-by-digit implícito no JS, mas garantimos coersão antes de operar)
                // novo valor:
                let newDEF;
                if (operation === 'add') {
                    // soma
                    newDEF = safeCurrentDEF + efeito;
                } else {
                    // subtrai
                    newDEF = safeCurrentDEF - efeito;
                }

                // evita DEF negativo (se quiser permitir, remova o clamp)
                if (newDEF < 0) newDEF = 0;

                // set no objeto local
                personagens[pIndex].DEF = newDEF;

                // grava alteração inteira do array personagens no Firestore
                await window.updateDoc(userRef, { personagens });

                // atualiza charData local (se existir)
                try {
                    if (typeof charData === 'object' && charData !== null) {
                        charData.DEF = newDEF;
                    }
                } catch (e) {
                    console.warn('modifyDefByItemUid: não foi possível atualizar charData local.', e);
                }

                // atualiza UI
                if (typeof window.refreshDefenseCat === 'function') {
                    window.refreshDefenseCat();
                } else {
                    // fallback: atualiza direto se existir elemento
                    const el = document.getElementById('char-def-value');
                    if (el) el.textContent = String(newDEF);
                }

                console.log(`modifyDefByItemUid: ${operation} efeito=${efeito} para item ${itemUid}. DEF: ${safeCurrentDEF} → ${newDEF}`);
                return;

            } catch (err) {
                console.error('modifyDefByItemUid erro:', err);
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

        /* ===== ADD: Feitiços / Milagres integration ===== */
        (function setupMagicSlots() {
            // elementos
            const slotFeit = document.getElementById('char-feiticos');
            const slotMil = document.getElementById('char-milagres');

            // modal elements
            const magicModal = document.getElementById('magic-modal');
            const magicBackdrop = document.getElementById('magic-modal-backdrop');
            const magicListEl = document.getElementById('magic-list');
            const magicListTitle = document.getElementById('magic-list-title');
            const magicDetailName = document.getElementById('magic-detail-name');
            const magicDetailFields = document.getElementById('magic-detail-fields');
            const magicConfirmBtn = document.getElementById('magic-confirm-btn');
            const magicCancelBtn = document.getElementById('magic-cancel-btn');
            const magicCloseBtn = document.getElementById('magic-modal-close');
            const magicDetailContent = document.getElementById('magic-detail-content');
            const magicDetailEmpty = document.getElementById('magic-detail-empty');

            // mapping colors for feitiços by elemento
            const elementColors = {
                "Básico": "#ebe1cf",
                "Arcano": "#5d2322",
                "Vento": "#e6e6e6",
                "Fogo": "#ffeb6b",
                "Água": "#9fd3ff",
                "Feras": "#bff2b0"
            };

            // mapping imagens para milagres por tomo
            const tomoImgs = {
                "Solyn": "./imgs/Solyn.png",
                "Naruva": "./imgs/Naruva.png",
                "Nyra": "./imgs/Nyra.png",
                "Sanguis": "./imgs/Sanguis.png",
                "Kaelun": "./imgs/Kaelun.png",
                "Mileth": "./imgs/Mileth.png",
                "Elyra": "./imgs/Elyra.png",
                "Thalun": "./imgs/Thalun.png",
                "Nenhum": null
            };

            // estado temporário
            let activeCollection = null; // 'feitiços' or 'milagres'
            let selectedDocUid = null;
            let selectedDocData = null;

            // abre modal e lista
            async function openMagicModal(collectionName) {
                activeCollection = collectionName;
                selectedDocUid = null;
                selectedDocData = null;
                magicListEl.innerHTML = `<div style="padding:8px;color:#ddd">Carregando ${collectionName}...</div>`;
                magicDetailContent.style.display = 'none';
                magicDetailEmpty.style.display = '';
                magicListTitle.textContent = (collectionName === 'feitiços') ? 'Feitiços' : 'Milagres';
                magicConfirmBtn.disabled = true;

                // show modal
                magicBackdrop.classList.add('open'); magicBackdrop.setAttribute('aria-hidden', 'false');
                magicModal.classList.add('open'); magicModal.setAttribute('aria-hidden', 'false');

                try {
                    const colRef = window.collection(window.firestoredb, collectionName);
                    const snap = await window.getDocs(colRef);
                    const docs = [];
                    snap.forEach(d => docs.push({ id: d.id, data: d.data() }));

                    if (!docs.length) {
                        magicListEl.innerHTML = `<div style="padding:8px;color:#ddd">Nenhum documento em ${collectionName}.</div>`;
                        return;
                    }

                    // render list
                    magicListEl.innerHTML = '';
                    for (const d of docs) {
                        const it = document.createElement('div');
                        it.className = 'magic-item';
                        it.dataset.uid = d.id;

                        const left = document.createElement('div'); left.className = 'mi-left';
                        const nameSpan = document.createElement('div'); nameSpan.className = 'mi-name';
                        nameSpan.textContent = d.data.nome || '(Sem nome)';

                        // styling for feitiços by elemento
                        if (collectionName === 'feitiços') {
                            const el = d.data.elemento || 'Básico';
                            const bg = elementColors[el] || '#e6e6e6';
                            nameSpan.style.background = bg;
                            nameSpan.style.opacity = '0.95';
                            nameSpan.style.color = (el === 'Arcano' ? '#fff' : '#0d0d0d');
                        }

                        left.appendChild(nameSpan);

                        // For milagres: show tomo icon on the right (small)
                        if (collectionName === 'milagres') {
                            const meta = document.createElement('div');
                            meta.className = 'mi-meta';
                            meta.textContent = d.data.tipo ? `${d.data.tipo}` : '';
                            left.appendChild(meta);
                        }

                        it.appendChild(left);

                        // right side: image for milagres tomo (if any) or elemento short text for feitiços
                        const right = document.createElement('div');
                        if (collectionName === 'milagres') {
                            const tomo = d.data.tomo || 'Nenhum';
                            const src = tomoImgs[tomo];
                            if (src) {
                                const img = document.createElement('img');
                                img.src = src;
                                img.alt = tomo;
                                img.style.width = '44px'; img.style.height = '36px'; img.style.objectFit = 'contain';
                                right.appendChild(img);
                            }
                        } else {
                            const small = document.createElement('div');
                            small.textContent = d.data.elemento || '';
                            small.style.fontSize = '0.85rem';
                            small.style.color = '#efe6e2';
                            right.appendChild(small);
                        }
                        it.appendChild(right);

                        // click handler
                        it.addEventListener('click', () => {
                            // unselect previous
                            magicListEl.querySelectorAll('.magic-item').forEach(el => el.classList.remove('selected'));
                            it.classList.add('selected');
                            selectedDocUid = d.id;
                            selectedDocData = d.data;
                            renderMagicDetail(d.id, d.data);
                            magicConfirmBtn.disabled = false;
                        });

                        magicListEl.appendChild(it);
                    }

                } catch (err) {
                    console.error('Erro carregando coleção', collectionName, err);
                    magicListEl.innerHTML = `<div style="padding:8px;color:#faa">Erro ao carregar ${collectionName}.</div>`;
                }
            }

            function renderMagicDetail(uid, data) {
                magicDetailName.textContent = data.nome || '(Sem nome)';
                magicDetailFields.innerHTML = '';
                // iterate fields and show only valid ones (excluir "Nenhum", "", null, undefined)
                Object.entries(data).forEach(([k, v]) => {
                    if (k === 'nome') return;
                    if (v === 'Nenhum') return;
                    if (v === '' || v === null || v === undefined) return;
                    if (typeof v === 'string' && v.trim() === '') return;

                    const row = document.createElement('div');
                    row.className = 'detail-row';
                    row.innerHTML = `<strong>${k}:</strong> ${v}`;
                    magicDetailFields.appendChild(row);
                });

                magicDetailEmpty.style.display = 'none';
                magicDetailContent.style.display = '';
            }

            function closeMagicModal() {
                magicBackdrop.classList.remove('open'); magicBackdrop.setAttribute('aria-hidden', 'true');
                magicModal.classList.remove('open'); magicModal.setAttribute('aria-hidden', 'true');
                magicListEl.innerHTML = '';
                magicDetailFields.innerHTML = '';
                magicDetailName.textContent = '';
                selectedDocUid = null;
                selectedDocData = null;
            }

            async function confirmMagicSelection() {
                if (!selectedDocUid || !activeCollection) return;
                try {
                    const user = window.firebaseauth.currentUser;
                    if (!user) { alert('Usuário não autenticado'); return; }
                    const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                    const snap = await window.getDoc(userRef);
                    if (!snap.exists()) { alert('Documento de usuário não encontrado'); return; }
                    const data = snap.data();
                    const personagens = Array.isArray(data.personagens) ? data.personagens.slice() : [];
                    const idx = personagens.findIndex(p => p && p.uid === charUid);
                    if (idx < 0) { alert('Personagem não encontrado'); closeMagicModal(); return; }

                    // garante o array correto e insere um documento aleatório (objeto) com 'uid' do feitiço/milagre
                    const arrName = (activeCollection === 'feitiços') ? 'feiticos' : 'milagres';
                    personagens[idx][arrName] = Array.isArray(personagens[idx][arrName]) ? personagens[idx][arrName].slice() : [];

                    // cria documento aleatório (map) com campo uid (seguindo seu esquema)
                    const randomId = String(Date.now()) + '_' + Math.random().toString(36).slice(2, 8);
                    const mapObj = { uid: String(selectedDocUid), _id: randomId };

                    personagens[idx][arrName].push(mapObj);

                    // salva no Firestore
                    await window.updateDoc(userRef, { personagens });
                    // atualiza charData local para refletir na UI
                    if (charData && Array.isArray(charData[arrName])) {
                        charData[arrName].push(mapObj);
                    } else if (charData) {
                        charData[arrName] = [mapObj];
                    }

                    // recicla UI (tentamos atualizar os slots existentes)
                    refreshSlotsFromCharData?.(); // se essa função existir no scope
                    // fechar modal
                    closeMagicModal();

                } catch (err) {
                    console.error('Erro ao salvar feitiço/milagre no personagem', err);
                    alert('Erro ao salvar. Veja console.');
                }
            }

            // Wire events
            slotFeit?.addEventListener('click', () => openMagicModal('feitiços'));
            slotMil?.addEventListener('click', () => openMagicModal('milagres'));
            magicCloseBtn?.addEventListener('click', closeMagicModal);
            magicCancelBtn?.addEventListener('click', closeMagicModal);
            magicBackdrop?.addEventListener('click', closeMagicModal);
            magicConfirmBtn?.addEventListener('click', confirmMagicSelection);

            // function to refresh the display in the two slots from charData (called on load)
            // ---- substituir a função refreshMagicSlotsFromCharData() existente por esta ----
            async function refreshMagicSlotsFromCharData() {
                try {
                    const charObj = charData || {};

                    // helper: renderiza lista vertical para um array (feiticos ou milagres)
                    async function buildList(arr, collectionName, slotEl) {
                        const body = slotEl.querySelector('.slot-body');
                        body.innerHTML = ''; // limpa

                        const validArray = Array.isArray(arr) ? arr : [];
                        if (!validArray.length || validArray.every(a => !a?.uid)) {
                            body.textContent = 'Vazio';
                            return;
                        }

                        const ul = document.createElement('ul');
                        ul.className = 'equipped-list';

                        // percorre e busca cada documento por uid; usa index para remoção precisa
                        for (let i = 0; i < validArray.length; i++) {
                            const entry = validArray[i];
                            if (!entry?.uid) continue;

                            try {
                                const dref = window.doc(window.firestoredb, collectionName, entry.uid);
                                const ds = await window.getDoc(dref);
                                const nameText = (ds && ds.exists()) ? (ds.data().nome || ds.id) : '(?)';

                                const li = document.createElement('li');
                                li.className = 'equipped-item';
                                li.tabIndex = 0;
                                li.dataset.index = String(i);

                                // left: nome + meta
                                const left = document.createElement('div');
                                left.style.flex = '1';
                                left.style.display = 'flex';
                                left.style.flexDirection = 'column';
                                left.style.gap = '4px';

                                const nameDiv = document.createElement('div');
                                nameDiv.className = 'equipped-item-name';
                                nameDiv.textContent = nameText;

                                // estilo especial para feitiços por elemento
                                if (collectionName === 'feitiços' && ds && ds.exists()) {
                                    const elField = ds.data().elemento || 'Básico';
                                    const elementColors = {
                                        "Básico": "#ebe1cf",
                                        "Arcano": "#5d2322",
                                        "Vento": "#e6e6e6",
                                        "Fogo": "#ffeb6b",
                                        "Água": "#9fd3ff",
                                        "Feras": "#bff2b0"
                                    };
                                    const bg = elementColors[elField] || '#e6e6e6';
                                    nameDiv.style.background = bg;
                                    nameDiv.style.opacity = '0.95';
                                    nameDiv.style.color = (elField === 'Arcano' ? '#fff' : '#0d0d0d');
                                    nameDiv.style.padding = '6px 8px';
                                    nameDiv.style.borderRadius = '6px';
                                    nameDiv.style.display = 'inline-block';
                                }

                                left.appendChild(nameDiv);

                                // meta breve (ex: tipo/tomo/custo)
                                if (ds && ds.exists()) {
                                    const d = ds.data();
                                    const metaParts = [];
                                    if (d.custo !== undefined && d.custo !== null && String(d.custo).trim() !== '') metaParts.push(String(d.custo));
                                    if (d.elemento) metaParts.push(String(d.elemento));
                                    if (d.tomo) metaParts.push(String(d.tomo));
                                    if (metaParts.length) {
                                        const meta = document.createElement('div');
                                        meta.className = 'equipped-item-meta';
                                        meta.textContent = metaParts.join(' • ');
                                        left.appendChild(meta);
                                    }
                                }

                                li.appendChild(left);

                                // right: imagem de tomo (para milagres) + botão remover
                                const right = document.createElement('div');
                                right.style.display = 'flex';
                                right.style.alignItems = 'center';
                                right.style.gap = '8px';

                                if (collectionName === 'milagres' && ds && ds.exists()) {
                                    const tomoImgs = {
                                        "Solyn": "./imgs/Solyn.png",
                                        "Naruva": "./imgs/Naruva.png",
                                        "Nyra": "./imgs/Nyra.png",
                                        "Sanguis": "./imgs/Sanguis.png",
                                        "Kaelun": "./imgs/Kaelun.png",
                                        "Mileth": "./imgs/Mileth.png",
                                        "Elyra": "./imgs/Elyra.png",
                                        "Thalun": "./imgs/Thalun.png",
                                        "Nenhum": null
                                    };
                                    const tomo = ds.data().tomo || 'Nenhum';
                                    const src = tomoImgs[tomo];
                                    if (src) {
                                        const img = document.createElement('img');
                                        img.src = src;
                                        img.alt = tomo;
                                        img.style.width = '44px';
                                        img.style.height = '32px';
                                        img.style.objectFit = 'contain';
                                        right.appendChild(img);
                                    }
                                }

                                // botão remover (remove apenas essa instância/index)
                                const removeBtn = document.createElement('span');
                                removeBtn.className = 'equipped-item-remove';
                                removeBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                                removeBtn.title = 'Remover';
                                removeBtn.style.cursor = 'pointer';
                                removeBtn.addEventListener('click', async (ev) => {
                                    ev.stopPropagation();
                                    // remove por índice no array do personagem
                                    try {
                                        const user = window.firebaseauth.currentUser;
                                        if (!user) throw new Error('Usuário não autenticado');
                                        const userRef = window.doc(window.firestoredb, 'usuarios', user.uid);
                                        const snap = await window.getDoc(userRef);
                                        if (!snap.exists()) throw new Error('Documento de usuário não encontrado');
                                        const data = snap.data();
                                        const personagens = Array.isArray(data.personagens) ? data.personagens.slice() : [];
                                        const idx = personagens.findIndex(p => p && p.uid === charUid);
                                        if (idx < 0) throw new Error('Personagem não encontrado no documento');

                                        const arrName = (collectionName === 'feitiços') ? 'feiticos' : 'milagres';
                                        const arrLocal = Array.isArray(personagens[idx][arrName]) ? personagens[idx][arrName].slice() : [];

                                        // se índice válido, remover
                                        if (i >= 0 && i < arrLocal.length) {
                                            arrLocal.splice(i, 1);
                                            personagens[idx][arrName] = arrLocal;
                                            // salvar
                                            await window.updateDoc(userRef, { personagens });
                                            // atualizar charData local (manter sincronizado)
                                            if (charData && Array.isArray(charData[arrName])) {
                                                charData[arrName].splice(i, 1);
                                            }
                                            // refrescar UI
                                            await refreshMagicSlotsFromCharData();
                                        } else {
                                            console.warn('Índice inválido ao remover magia/milagre', i);
                                        }
                                    } catch (err) {
                                        console.error('Erro removendo magia/milagre:', err);
                                        alert('Erro ao remover. Veja console.');
                                    }
                                });

                                right.appendChild(removeBtn);
                                li.appendChild(right);

                                ul.appendChild(li);
                            } catch (e) {
                                console.warn('Erro ao buscar doc de', entry.uid, e);
                            }
                        } // end for

                        body.appendChild(ul);
                    } // end buildList

                    // Feiticos
                    if (slotFeit) {
                        const arrF = Array.isArray(charObj?.feiticos) ? charObj.feiticos : [];
                        await buildList(arrF, 'feitiços', slotFeit);
                    }
                    // Milagres
                    if (slotMil) {
                        const arrM = Array.isArray(charObj?.milagres) ? charObj.milagres : [];
                        await buildList(arrM, 'milagres', slotMil);
                    }

                } catch (err) {
                    console.warn('refreshMagicSlotsFromCharData erro', err);
                }
            }

            /* ===== ADD: Atualiza a defense-cat (mostra campo DEF do personagem) ===== */
            async function refreshDefenseCat() {
                try {
                    const el = document.getElementById('char-def-value');
                    if (!el) return;

                    let defVal = null;

                    // 1) tentar obter direto do objeto charData (se já existir no escopo)
                    try {
                        if (typeof charData === 'object' && charData !== null) {
                            // seu esquema parece ter DEF direto no objeto do personagem
                            if (charData.DEF !== undefined && charData.DEF !== null) {
                                defVal = charData.DEF;
                            }
                            // Em alguns casos o campo pode estar aninhado; checamos variantes comuns
                            else if (charData.DEF?.at !== undefined) {
                                defVal = charData.DEF; // fallback
                            }
                        }
                    } catch (e) {
                        console.warn('Erro lendo charData para DEF', e);
                    }

                    // 2) se não encontrou em charData, buscar no documento do usuário e procurar na array personagens[]
                    if (defVal === null) {
                        try {
                            const currentUser = window.firebaseauth?.currentUser;
                            if (currentUser) {
                                const userRef = window.doc(window.firestoredb, 'usuarios', currentUser.uid);
                                const userSnap = await window.getDoc(userRef);
                                if (userSnap.exists()) {
                                    const userData = userSnap.data();
                                    const personagens = Array.isArray(userData.personagens) ? userData.personagens : [];
                                    const p = personagens.find(pp => pp && pp.uid === charUid);
                                    if (p && (p.DEF !== undefined && p.DEF !== null)) defVal = p.DEF;
                                }
                            }
                        } catch (err) {
                            console.warn('Erro buscando DEF no Firestore:', err);
                        }
                    }

                    // 3) exibir valor (ou traço se indefinido)
                    if (defVal !== null && defVal !== undefined && defVal !== '') {
                        el.textContent = String(defVal);
                    } else {
                        el.textContent = '—';
                    }
                } catch (err) {
                    console.error('refreshDefenseCat erro:', err);
                }
            }

            // Expor a função globalmente para que outras partes do sistema possam chamar
            window.refreshDefenseCat = refreshDefenseCat;

            // Tenta rodar uma vez após carregar a UI (ajuste de tempo para quando charData for populado)
            setTimeout(() => {
                try { refreshDefenseCat(); } catch (e) { console.warn(e); }
            }, 450);

            // Se você tiver uma função global que atualiza toda a UI (ex: refreshSlotsFromCharData), 
            // chame refreshDefenseCat() a partir dela também. Se não tiver, pode chamar manualmente
            // window.refreshDefenseCat() após o charData ser carregado.


            // chama na inicialização (se existir a função global refreshSlotsFromCharData que você já usa, chamamos ela depois)
            setTimeout(() => refreshMagicSlotsFromCharData(), 400);

            // expose small API (opcional)
            window.__magicSlots = {
                open: openMagicModal,
                close: closeMagicModal,
                refresh: refreshMagicSlotsFromCharData
            };

        })();

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
    function attachDragToBar(statName, getCur, setCur, storageKey, fillId, textId) {
        const bar = document.querySelector(`.stat-bar[data-stat="${statName}"]`);
        if (!bar) return;
        const fill = document.getElementById(fillId);
        let dragging = false;
        let pointerIdActive = null;

        function getTotal() {
            switch (statName) {
                case 'pv': return totPV;
                case 'mn': return totMN;
                case 'sta': return totSTA;
                default: return 0;
            }
        }

        function computeValueFromClientX(clientX) {
            const rect = bar.getBoundingClientRect();
            const style = getComputedStyle(bar);
            const padLeft = parseFloat(style.paddingLeft) || 0;
            const padRight = parseFloat(style.paddingRight) || 0;
            const usableLeft = rect.left + padLeft;
            const usableWidth = Math.max(2, rect.width - padLeft - padRight);
            const rel = clamp((clientX - usableLeft) / usableWidth, 0, 1);
            const total = getTotal();
            return Math.round(rel * total);
        }

        function startDrag(ev) {
            if (ev.target.closest('.stat-btn') || ev.target.classList.contains('bar-input')) return;
            ev.preventDefault();
            dragging = true;
            pointerIdActive = ev.pointerId;
            try { bar.setPointerCapture(pointerIdActive); } catch (e) { }
            bar.classList.add('dragging'); document.documentElement.classList.add('dragging');
            const newVal = clamp(computeValueFromClientX(ev.clientX), 0, getTotal());
            setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
        }
        function moveDrag(ev) {
            if (!dragging || ev.pointerId !== pointerIdActive) return;
            ev.preventDefault();
            const newVal = clamp(computeValueFromClientX(ev.clientX), 0, getTotal());
            setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
        }
        function endDrag(ev) {
            if (!dragging) return;
            dragging = false;
            try { if (pointerIdActive != null) bar.releasePointerCapture(pointerIdActive); } catch (e) { }
            pointerIdActive = null;
            bar.classList.remove('dragging'); document.documentElement.classList.remove('dragging');
            if (ev && typeof ev.clientX === 'number') {
                const newVal = clamp(computeValueFromClientX(ev.clientX), 0, getTotal());
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
            const newVal = clamp(computeValueFromClientX(ev.clientX), 0, getTotal());
            setCur(newVal); saveCurrent(storageKey, newVal); updateAllBars();
        });
    }
    attachDragToBar('pv', () => curPV, (v) => { curPV = v; }, 'currentPV', 'pv-bar-fill', 'pv-bar-text');
    attachDragToBar('mn', () => curMN, (v) => { curMN = v; }, 'currentMN', 'mn-bar-fill', 'mn-bar-text');
    attachDragToBar('sta', () => curSTA, (v) => { curSTA = v; }, 'currentSTA', 'sta-bar-fill', 'sta-bar-text');

    /* ---------- EXP: botões/inline/drag (mantém sua lógica, usando clamp) ---------- */
    // ---------- gainExp (substituída para suportar handleLevelUps) ----------
    async function gainExp(delta) {
        if (!Number.isFinite(delta)) return;
        delta = Math.floor(delta);
        if (delta === 0) return;

        if (delta > 0) {
            currentEXP += delta;
            let limit = expLimitForLevel(expLevel);
            // detecta e aplica level-ups um-a-um (chama handleLevelUps)
            while (currentEXP >= limit) {
                currentEXP -= limit;
                const previousLevel = expLevel;
                expLevel++;
                // chama nossa rotina que aplica as mudanças ao subir níveis
                try {
                    // não bloquear a UI: chamamos e aguardamos para garantir consistência no Firestore
                    // (caso queira async fire-and-forget, remova o await)
                    // handleLevelUps incrementa pontos_restantes e ajusta PV/MN/STA.totals
                    // e também mostra modal para múltiplos de 5
                    // eslint-disable-next-line no-await-in-loop
                    await handleLevelUps(previousLevel, expLevel);
                } catch (e) {
                    console.warn('Erro em handleLevelUps:', e);
                }
                limit = expLimitForLevel(expLevel);
            }
        } else {
            currentEXP = Math.max(0, currentEXP + delta);
        }
        saveCurrent('currentEXP', currentEXP);
        saveCurrent('expLevel', expLevel);
        updateAllBars();
        updateRemainingUI();
    }

    const expMinus = document.getElementById('exp-minus');
    const expPlus = document.getElementById('exp-plus');

    if (expMinus) {
        expMinus.addEventListener('click', async (e) => {
            e.stopPropagation();

            // Se EXP.atual === 0 e pode diminuir de nível, tenta reverter o último level-up
            if (currentEXP === 0 && expLevel > 1) {
                const confirmed = confirm('Tem certeza que deseja regridir 1 nível? Isso removerá pontos e o aumento de PV/MN/STA aplicado ao subir de nível.');
                if (!confirmed) return;
                try {
                    await revertLastLevel();
                } catch (err) {
                    console.error('Erro ao regredir nível:', err);
                    alert('Falha ao regredir nível. Veja console.');
                }
                return;
            }
            // caso normal: só diminui EXP
            gainExp(-1);
        });
    }
    if (expPlus) expPlus.addEventListener('click', (e) => { e.stopPropagation(); gainExp(1); });

    /**
     * Reverte o último level-up registrado (usa characters[idx].levelHistory se existir).
     * Remove PV/MN/STA.total adicionados, subtrai pontos_restantes e remove profAdded caso exista.
     */
    async function revertLastLevel() {
        if (!window.firebaseauth?.currentUser) return;
        const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
        const userDocSnap = await window.getDoc(userDocRef);
        if (!userDocSnap.exists()) {
            alert('Documento do usuário não encontrado.');
            return;
        }
        const data = userDocSnap.data();
        const characters = Array.isArray(data.personagens) ? data.personagens.slice() : [];
        const idx = characters.findIndex(c => c && c.uid === charUid);
        if (idx < 0) {
            alert('Personagem não encontrado.');
            return;
        }

        const char = characters[idx];

        // encontra a última entrada de histórico (se houver)
        const history = Array.isArray(char.levelHistory) ? char.levelHistory : [];
        if (history.length > 0) {
            const last = history.pop(); // remove do histórico local
            // aplica reversões
            char.PV = char.PV || { atual: 0, total: 0 };
            char.MN = char.MN || { atual: 0, total: 0 };
            char.STA = char.STA || { atual: 0, total: 0 };

            char.PV.total = Math.max(0, Number(char.PV.total ?? 0) - Number(last.addPV ?? 0));
            char.MN.total = Math.max(0, Number(char.MN.total ?? 0) - Number(last.addMN ?? 0));
            char.STA.total = Math.max(0, Number(char.STA.total ?? 0) - Number(last.addSTA ?? 0));

            // ajusta atuais se necessário para não exceder novos totais
            if (Number(char.PV.atual) > char.PV.total) char.PV.atual = char.PV.total;
            if (Number(char.MN.atual) > char.MN.total) char.MN.atual = char.MN.total;
            if (Number(char.STA.atual) > char.STA.total) char.STA.atual = char.STA.total;

            // pontos_restantes retrocede
            char.pontos_restantes = Math.max(0, Number(char.pontos_restantes ?? 0) - Number(last.pointsAdded ?? 1));

            // remover proficiência adicionada (se houver)
            if (last.profAdded && Array.isArray(char.proeficiencias)) {
                const pidx = char.proeficiencias.indexOf(last.profAdded);
                if (pidx >= 0) char.proeficiencias.splice(pidx, 1);
            }

            // atualiza LVL para LVL - 1 (garantir mínimo 1)
            char.LVL = Math.max(1, Number(char.LVL ?? expLevel) - 1);

            // atualiza o array de personagens e persiste no Firestore
            characters[idx] = char;
            try {
                await window.updateDoc(userDocRef, { personagens: characters });
            } catch (err) {
                console.error('Falha ao salvar reversão no Firestore', err);
                throw err;
            }

            // atualiza variáveis locais e UI
            expLevel = Number(char.LVL);
            currentEXP = 0; // deixa 0 (comportamento consistente ao clicar quando estava 0)
            // read totals to local state (charData)
            totPV = Number(char.PV.total ?? totPV);
            totMN = Number(char.MN.total ?? totMN);
            totSTA = Number(char.STA.total ?? totSTA);

            // ajusta atuais locais
            curPV = Math.min(curPV, totPV);
            curMN = Math.min(curMN, totMN);
            curSTA = Math.min(curSTA, totSTA);

            // mantém charData local consistente
            if (charData) {
                charData.PV = char.PV;
                charData.MN = char.MN;
                charData.STA = char.STA;
                charData.pontos_restantes = char.pontos_restantes;
                charData.LVL = char.LVL;
                if (char.proeficiencias) charData.proeficiencias = char.proeficiencias.slice();
            }

            updateAllBars();
            // salva barras + LVL/EXP
            await saveBarsToFirestore();

            alert(`Nível ${last.lvl} revertido com sucesso.`);
            return;
        }

        // --- fallback: se não existir histórico, tenta estimativa reversa (menos segura) ---
        // tenta subtrair de acordo com fórmulas atuais (pior caso)
        const brav = Number(attrKeys.bravura ?? 0);
        const arca = Number(attrKeys.arcano ?? 0);
        const fole = Number(attrKeys.folego ?? 0);
        const ess = Number(attrKeys.essencia ?? 0);
        let subPV = 0, subMN = 0, subSTA = 0;
        if (savedClass === 'Arcanista') { subPV = 2 + brav; subMN = 5 + arca; subSTA = 2 + fole; }
        else if (savedClass === 'Escudeiro') { subPV = 4 + brav; subMN = 1 + arca; subSTA = 1 + fole; }
        else if (savedClass === 'Luminar') { subPV = 2 + brav; subMN = 4 + arca; subSTA = 4 + ess; }
        else if (savedClass === 'Errante') { subPV = 3 + brav; subMN = 1 + arca; subSTA = 5 + fole; }

        // aplica a subtração conservadora
        char.PV = char.PV || { atual: 0, total: 0 };
        char.MN = char.MN || { atual: 0, total: 0 };
        char.STA = char.STA || { atual: 0, total: 0 };

        char.PV.total = Math.max(0, Number(char.PV.total ?? 0) - subPV);
        char.MN.total = Math.max(0, Number(char.MN.total ?? 0) - subMN);
        char.STA.total = Math.max(0, Number(char.STA.total ?? 0) - subSTA);
        char.pontos_restantes = Math.max(0, Number(char.pontos_restantes ?? 0) - 1);
        char.LVL = Math.max(1, Number(char.LVL ?? expLevel) - 1);

        // salva fallback
        characters[idx] = char;
        await window.updateDoc(userDocRef, { personagens: characters });

        // atualiza locais como acima
        expLevel = Number(char.LVL);
        currentEXP = 0;
        totPV = Number(char.PV.total ?? totPV);
        totMN = Number(char.MN.total ?? totMN);
        totSTA = Number(char.STA.total ?? totSTA);
        curPV = Math.min(curPV, totPV);
        curMN = Math.min(curMN, totMN);
        curSTA = Math.min(curSTA, totSTA);
        if (charData) {
            charData.PV = char.PV;
            charData.MN = char.MN;
            charData.STA = char.STA;
            charData.pontos_restantes = char.pontos_restantes;
            charData.LVL = char.LVL;
        }
        updateAllBars();
        await saveBarsToFirestore();
        alert('Reversão feita por estimativa (não havia histórico detalhado).');
    }

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

            async function finish(commit) {
                if (!commit) {
                    input.remove();
                    lvlEl.style.display = '';
                    return;
                }

                // parse e clamp do valor novo
                let num = Number(input.value);
                if (Number.isNaN(num)) num = expLevel;
                num = Math.floor(num);
                num = clamp(num, 1, 30); // restringe até 30

                // nada a fazer se não mudou
                if (num === expLevel) {
                    input.remove();
                    lvlEl.style.display = '';
                    return;
                }

                // ajusta currentEXP caso exceda o novo limite (deixa no máximo limit-1)
                const newLimit = expLimitForLevel(num);
                if (currentEXP >= newLimit) currentEXP = Math.max(0, newLimit - 1);

                try {
                    // executa alteração em batch (faz update no Firestore e atualiza estado local/UI)
                    await applyBatchLevelChange(num);
                } catch (err) {
                    console.error('Erro aplicando mudança de nível:', err);
                    alert('Falha ao alterar nível. Veja console para detalhes.');
                } finally {
                    // salvar expLevel/currentEXP locais (saveBarsToFirestore é chamado dentro de applyBatchLevelChange)
                    saveCurrent('expLevel', expLevel);
                    saveCurrent('currentEXP', currentEXP);
                    input.remove();
                    lvlEl.style.display = '';
                }
            }

            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') finish(true);
                else if (ev.key === 'Escape') finish(false);
            });
            input.addEventListener('blur', () => finish(true));
        });

        /**
         * Aplica uma mudança direta para `newLevel` (pode ser > ou < que expLevel).
         * - Atualiza personagens[] no Firestore (faz busca/update robusto).
         * - Cria/consome entradas em levelHistory para garantir reversão exata quando possível.
         * - Atualiza variáveis locais (expLevel, totPV/totMN/totSTA, curPV/curMN/curSTA, pontos_restantes).
         */
        async function applyBatchLevelChange(newLevel) {
            if (!window.firebaseauth?.currentUser) throw new Error('Usuário não autenticado');
            const uid = window.firebaseauth.currentUser.uid;
            const userDocRef = window.doc(window.firestoredb, 'usuarios', uid);
            const userDocSnap = await window.getDoc(userDocRef);
            if (!userDocSnap.exists()) throw new Error('Documento de usuário não encontrado');
            const data = userDocSnap.data();
            const characters = Array.isArray(data.personagens) ? data.personagens.slice() : [];
            const idx = characters.findIndex(c => c && c.uid === charUid);
            if (idx < 0) throw new Error('Personagem não encontrado');

            const char = characters[idx];

            // garante estruturas
            char.PV = (char.PV == null) ? { atual: 0, total: 0 } : (typeof char.PV === 'number' ? { atual: char.PV, total: char.PV } : char.PV);
            char.MN = (char.MN == null) ? { atual: 0, total: 0 } : (typeof char.MN === 'number' ? { atual: char.MN, total: char.MN } : char.MN);
            char.STA = (char.STA == null) ? { atual: 0, total: 0 } : (typeof char.STA === 'number' ? { atual: char.STA, total: char.STA } : char.STA);
            char.pontos_restantes = Number(char.pontos_restantes ?? 0);
            char.levelHistory = Array.isArray(char.levelHistory) ? char.levelHistory : [];

            // ------------------------- INÍCIO PATCH: usar ATTR TOTAL (attrKeys) -------------------------
            // atributos e classe (robustos) — usar o TOTAL que você já calcula (attrKeys)
            function getTotalAttrFromContext(key) {
                // preferir attrKeys (já contém raw + bônus racial e é o que aparece no DOM)
                try {
                    if (typeof attrKeys !== 'undefined' && attrKeys && typeof attrKeys[key] !== 'undefined') {
                        const n = Number(attrKeys[key]);
                        if (!Number.isNaN(n)) return Math.floor(n);
                    }
                } catch (e) { /* ignore */ }

                // fallback: ler do char.atributos (raw) e aplicar applyRacialBonus se existir
                const raw = Number((char.atributos && typeof char.atributos[key] !== 'undefined') ? char.atributos[key] : 0) || 0;
                if (typeof applyRacialBonus === 'function') {
                    const tot = Number(applyRacialBonus(raw, key) || 0);
                    return Math.floor(tot);
                }
                return Math.floor(raw);
            }

            // lê os totais (bruto+racial) para cada atributo usado nas fórmulas
            const brav = getTotalAttrFromContext('bravura');
            const arca = getTotalAttrFromContext('arcano');
            const fole = getTotalAttrFromContext('folego');
            const ess = getTotalAttrFromContext('essencia');

            const className = String(char.classe ?? (typeof savedClass !== 'undefined' ? savedClass : ''));

            // helper: calcula incremento por 1 nível dependendo da classe e atributos
            function perLevelDelta(cls) {
                let addPV = 0, addMN = 0, addSTA = 0;
                if (cls === 'Arcanista') {
                    addPV = 2 + brav;
                    addMN = 5 + arca;
                    addSTA = 2 + fole;
                } else if (cls === 'Escudeiro') {
                    addPV = 4 + brav;
                    addMN = 1 + arca;
                    addSTA = 1 + fole;
                } else if (cls === 'Luminar') {
                    addPV = 2 + brav;
                    addMN = 4 + arca;
                    addSTA = 4 + ess;
                } else if (cls === 'Errante') {
                    addPV = 3 + brav;
                    addMN = 1 + arca;
                    addSTA = 5 + fole;
                } else { // fallback neutro
                    addPV = 1 + brav;
                    addMN = 1 + arca;
                    addSTA = 1 + fole;
                }
                return {
                    addPV: Math.floor(Number(addPV || 0)),
                    addMN: Math.floor(Number(addMN || 0)),
                    addSTA: Math.floor(Number(addSTA || 0)),
                    pointsAdded: 1
                };
            }
            // ------------------------- FIM PATCH -------------------------

            function perLevelDelta(cls) {
                let addPV = 0, addMN = 0, addSTA = 0;
                if (cls === 'Arcanista') {
                    addPV = 2 + brav;
                    addMN = 5 + arca;
                    addSTA = 2 + fole;
                } else if (cls === 'Escudeiro') {
                    addPV = 4 + brav;
                    addMN = 1 + arca;
                    addSTA = 1 + fole;
                } else if (cls === 'Luminar') {
                    addPV = 2 + brav;
                    addMN = 4 + arca;
                    addSTA = 4 + ess;
                } else if (cls === 'Errante') {
                    addPV = 3 + brav;
                    addMN = 1 + arca;
                    addSTA = 5 + fole;
                } else { // fallback neutro
                    addPV = 1 + brav;
                    addMN = 1 + arca;
                    addSTA = 1 + fole;
                }
                return { addPV: Number(addPV || 0), addMN: Number(addMN || 0), addSTA: Number(addSTA || 0), pointsAdded: 1 };
            }

            const oldLevel = Number(char.LVL ?? expLevel);
            if (newLevel === oldLevel) {
                // nada a fazer
                expLevel = newLevel;
                updateAllBars();
                return;
            }

            if (newLevel > oldLevel) {
                // subir níveis: acumula deltas e cria entradas em levelHistory (uma por nível)
                const levelsToAdd = newLevel - oldLevel;
                let totalAddPV = 0, totalAddMN = 0, totalAddSTA = 0, totalPoints = 0;
                for (let i = 1; i <= levelsToAdd; i++) {
                    const lvlReached = oldLevel + i;
                    const d = perLevelDelta(className);
                    totalAddPV += d.addPV;
                    totalAddMN += d.addMN;
                    totalAddSTA += d.addSTA;
                    totalPoints += d.pointsAdded;

                    // registra histórico (permite revert preciso)
                    const histEntry = {
                        lvl: lvlReached,
                        addPV: d.addPV,
                        addMN: d.addMN,
                        addSTA: d.addSTA,
                        pointsAdded: d.pointsAdded,
                        profAdded: null,
                        ts: Date.now()
                    };
                    char.levelHistory.push(histEntry);
                }

                char.PV.total = Number(char.PV.total ?? 0) + totalAddPV;
                char.MN.total = Number(char.MN.total ?? 0) + totalAddMN;
                char.STA.total = Number(char.STA.total ?? 0) + totalAddSTA;

                char.pontos_restantes = Number(char.pontos_restantes ?? 0) + totalPoints;
                char.LVL = newLevel;

                // sincroniza no array e salva
                characters[idx] = char;
                await window.updateDoc(userDocRef, { personagens: characters });
                // --- OTIMISTIC UI UPDATE (colar logo após await window.updateDoc(...)) ---
                // atualiza charData local com a versão salva e força atualização visual imediata
                try {
                    // characters[idx] já contém o objeto atualizado que salvamos
                    charData = characters[idx];

                    // Atualiza pontos_restantes no display (prioridade ao valor salvo)
                    try { updateRemainingUI(); } catch (e) { console.warn('updateRemainingUI erro (optimistic):', e); }

                    // Atualiza totals/atuais locais e barras sem salvar de novo
                    totPV = Number(charData.PV?.total ?? totPV);
                    totMN = Number(charData.MN?.total ?? totMN);
                    totSTA = Number(charData.STA?.total ?? totSTA);

                    curPV = Math.min(curPV, totPV);
                    curMN = Math.min(curMN, totMN);
                    curSTA = Math.min(curSTA, totSTA);

                    // atualiza DOM das barras (usa applyBar para NÃO causar novo save)
                    try {
                        applyBar('pv-bar-fill', 'pv-bar-text', curPV, totPV, 'pv');
                        applyBar('mn-bar-fill', 'mn-bar-text', curMN, totMN, 'mn');
                        applyBar('sta-bar-fill', 'sta-bar-text', curSTA, totSTA, 'sta');

                        // atualiza nível/exp visíveis
                        const lvlEl = document.getElementById('exp-level');
                        if (lvlEl) lvlEl.textContent = String(charData.LVL ?? expLevel);
                        const expLimit = expLimitForLevel(Number(charData.LVL ?? expLevel));
                        applyBar('exp-bar-fill', 'exp-bar-text', currentEXP, expLimit, 'exp');

                        // atualiza stat texts
                        const pvText = document.getElementById('stat-pv');
                        const mnText = document.getElementById('stat-mn');
                        const staText = document.getElementById('stat-sta');
                        if (pvText) pvText.textContent = String(totPV);
                        if (mnText) mnText.textContent = String(totMN);
                        if (staText) staText.textContent = String(totSTA);
                    } catch (e) {
                        console.warn('Erro aplicando barras (optimistic):', e);
                    }
                } catch (e) {
                    console.warn('Erro no optimistic UI update:', e);
                }

                // atualiza variáveis locais (totals/curs/expLevel)
                totPV = Number(char.PV.total ?? totPV);
                totMN = Number(char.MN.total ?? totMN);
                totSTA = Number(char.STA.total ?? totSTA);

                // assegura atuais não maiores que os novos totais
                curPV = Math.min(curPV, totPV);
                curMN = Math.min(curMN, totMN);
                curSTA = Math.min(curSTA, totSTA);

                expLevel = newLevel;
                // currentEXP já ajustado antes (em caller)
                updateAllBars();
                await saveBarsToFirestore();
                return;
            } else {
                // diminuir níveis: tenta remover entradas do levelHistory; se faltar, usa estimativa
                const levelsToRemove = oldLevel - newLevel;
                let totalSubPV = 0, totalSubMN = 0, totalSubSTA = 0, totalPointsSub = 0;
                for (let i = 0; i < levelsToRemove; i++) {
                    if (char.levelHistory.length > 0) {
                        const last = char.levelHistory.pop();
                        totalSubPV += Number(last.addPV ?? 0);
                        totalSubMN += Number(last.addMN ?? 0);
                        totalSubSTA += Number(last.addSTA ?? 0);
                        totalPointsSub += Number(last.pointsAdded ?? 1);

                        // se tinha profAdded, remove do array de proeficiencias
                        if (last.profAdded && Array.isArray(char.proeficiencias)) {
                            const pidx = char.proeficiencias.indexOf(last.profAdded);
                            if (pidx >= 0) char.proeficiencias.splice(pidx, 1);
                        }
                    } else {
                        // fallback estimado (quando não existe histórico suficiente)
                        const d = perLevelDelta(className);
                        totalSubPV += d.addPV;
                        totalSubMN += d.addMN;
                        totalSubSTA += d.addSTA;
                        totalPointsSub += d.pointsAdded;
                    }
                }

                char.PV.total = Math.max(0, Number(char.PV.total ?? 0) - totalSubPV);
                char.MN.total = Math.max(0, Number(char.MN.total ?? 0) - totalSubMN);
                char.STA.total = Math.max(0, Number(char.STA.total ?? 0) - totalSubSTA);

                // ajustar atuais para não ultrapassarem novos totais
                char.PV.atual = Math.min(Number(char.PV.atual ?? 0), char.PV.total);
                char.MN.atual = Math.min(Number(char.MN.atual ?? 0), char.MN.total);
                char.STA.atual = Math.min(Number(char.STA.atual ?? 0), char.STA.total);

                char.pontos_restantes = Math.max(0, Number(char.pontos_restantes ?? 0) - totalPointsSub);
                char.LVL = Math.max(1, newLevel);

                // salva alterações
                characters[idx] = char;
                await window.updateDoc(userDocRef, { personagens: characters });
                // --- OTIMISTIC UI UPDATE (colar logo após await window.updateDoc(...)) ---
                // atualiza charData local com a versão salva e força atualização visual imediata
                try {
                    // characters[idx] já contém o objeto atualizado que salvamos
                    charData = characters[idx];

                    // Atualiza pontos_restantes no display (prioridade ao valor salvo)
                    try { updateRemainingUI(); } catch (e) { console.warn('updateRemainingUI erro (optimistic):', e); }

                    // Atualiza totals/atuais locais e barras sem salvar de novo
                    totPV = Number(charData.PV?.total ?? totPV);
                    totMN = Number(charData.MN?.total ?? totMN);
                    totSTA = Number(charData.STA?.total ?? totSTA);

                    curPV = Math.min(curPV, totPV);
                    curMN = Math.min(curMN, totMN);
                    curSTA = Math.min(curSTA, totSTA);

                    // atualiza DOM das barras (usa applyBar para NÃO causar novo save)
                    try {
                        applyBar('pv-bar-fill', 'pv-bar-text', curPV, totPV, 'pv');
                        applyBar('mn-bar-fill', 'mn-bar-text', curMN, totMN, 'mn');
                        applyBar('sta-bar-fill', 'sta-bar-text', curSTA, totSTA, 'sta');

                        // atualiza nível/exp visíveis
                        const lvlEl = document.getElementById('exp-level');
                        if (lvlEl) lvlEl.textContent = String(charData.LVL ?? expLevel);
                        const expLimit = expLimitForLevel(Number(charData.LVL ?? expLevel));
                        applyBar('exp-bar-fill', 'exp-bar-text', currentEXP, expLimit, 'exp');

                        // atualiza stat texts
                        const pvText = document.getElementById('stat-pv');
                        const mnText = document.getElementById('stat-mn');
                        const staText = document.getElementById('stat-sta');
                        if (pvText) pvText.textContent = String(totPV);
                        if (mnText) mnText.textContent = String(totMN);
                        if (staText) staText.textContent = String(totSTA);
                    } catch (e) {
                        console.warn('Erro aplicando barras (optimistic):', e);
                    }
                } catch (e) {
                    console.warn('Erro no optimistic UI update:', e);
                }

                // atualiza variáveis locais (totals/curs/expLevel)
                totPV = Number(char.PV.total ?? totPV);
                totMN = Number(char.MN.total ?? totMN);
                totSTA = Number(char.STA.total ?? totSTA);

                curPV = Math.min(curPV, totPV);
                curMN = Math.min(curMN, totMN);
                curSTA = Math.min(curSTA, totSTA);

                expLevel = char.LVL;
                // deixar currentEXP como estava (ou 0) — caller já ajustou para limit-1 se necessário
                updateAllBars();
                await saveBarsToFirestore();
                return;
            }
        }
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

    // showCustomAlert: exibe um modal simples dentro do site e resolve quando o usuário fechar (OK, X, ESC ou clique fora).
    // Uso: await showCustomAlert('Mensagem...');
    // Substitua a função showCustomAlert existente por esta versão:
    function showCustomAlert(message) {
        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        return new Promise((resolve) => {
            // overlay (backdrop)
            const overlay = document.createElement('div');
            overlay.className = 'custom-alert-overlay';
            Object.assign(overlay.style, {
                position: 'fixed',
                inset: '0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.6)',
                zIndex: 12000,
                padding: '16px',
                backdropFilter: 'blur(2px)'
            });

            const panel = document.createElement('div');
            panel.className = 'custom-alert-panel';
            Object.assign(panel.style, {
                maxWidth: '520px',
                width: '100%',
                background: 'linear-gradient(180deg,#161414,#241a1a)',
                color: '#efe6e2',
                borderRadius: '12px',
                border: '6px solid rgba(92,34,34,0.95)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
                padding: '18px',
                textAlign: 'center',
                fontFamily: 'inherit',
                position: 'relative'
            });

            const closeX = document.createElement('button');
            closeX.type = 'button';
            closeX.className = 'custom-alert-close';
            closeX.setAttribute('aria-label', 'Fechar alerta');
            closeX.innerHTML = '&times;';
            Object.assign(closeX.style, {
                position: 'absolute',
                top: '8px',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: '#efe6e2',
                fontSize: '22px',
                lineHeight: '1',
                cursor: 'pointer',
                padding: '6px'
            });

            const msg = document.createElement('div');
            msg.innerHTML = `<div style="margin-bottom:14px;font-size:1rem;line-height:1.3;color:#f2eae6">${escapeHtml(message)}</div>`;

            const btnWrap = document.createElement('div');
            btnWrap.style.display = 'flex';
            btnWrap.style.justifyContent = 'center';

            const okBtn = document.createElement('button');
            okBtn.type = 'button';
            okBtn.textContent = 'OK';
            Object.assign(okBtn.style, {
                minWidth: '96px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(180deg,#5c2222,#3d1616)',
                color: '#fff',
                fontWeight: '700',
                boxShadow: '0 8px 20px rgba(0,0,0,0.35)'
            });

            // evitar múltiplas resoluções
            let resolved = false;
            function doResolve(val) {
                if (resolved) return;
                resolved = true;
                // cleanup
                document.removeEventListener('keydown', keyHandler);
                if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
                resolve(val);
            }

            function keyHandler(e) {
                if (e.key === 'Escape') doResolve(false); // ESC = cancel
            }

            // clique no X => cancelar
            closeX.addEventListener('click', (e) => {
                e.stopPropagation();
                doResolve(false);
            });

            // clique no OK => confirmar
            okBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                doResolve(true);
            });

            // fechar ao clicar no backdrop (fora do painel) => cancelar
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) doResolve(false);
            });

            // evitar que clique dentro do painel propague
            panel.addEventListener('click', (e) => e.stopPropagation());

            // montagem DOM
            btnWrap.appendChild(okBtn);
            panel.appendChild(closeX);
            panel.appendChild(msg);
            panel.appendChild(btnWrap);
            overlay.appendChild(panel);
            document.body.appendChild(overlay);

            // foco acessível
            okBtn.focus();

            // adiciona ESC listener
            document.addEventListener('keydown', keyHandler);
        });
    }


    // Nota: mantemos a altura travada do left-card para evitar "pulse" de layout.
    // Se você quiser recalcular o tamanho quando mudar algo globalmente, pode chamar:
    // leftCard.style.height = leftCard.getBoundingClientRect().height + 'px';
    /* ========== MOBILE NAVIGATION ========== */
    /* ========== MOBILE NAVIGATION (corrigido para inventário criado depois) ========== */
    (function setupMobileNavigation() {
        function isMobile() { return window.innerWidth <= 920; }
        if (!isMobile()) return;

        const charBtn = document.getElementById('mobile-char-btn');
        const invBtn = document.getElementById('mobile-inv-btn');
        const homeBtn = document.getElementById('mobile-home-btn');
        const profileBtn = document.getElementById('mobile-profile-btn');
        // --- mostrar foto do usuário dentro do mobile-profile-btn, se disponível ---
        function updateMobileProfileImage() {
            try {
                if (!profileBtn) return;

                // limpa conteúdo atual
                profileBtn.innerHTML = '';

                const user = window.firebaseauth?.currentUser || null;

                if (user && user.photoURL) {
                    const img = document.createElement('img');
                    img.src = user.photoURL;
                    img.alt = user.displayName || user.email || 'Perfil';
                    img.title = user.displayName || user.email || 'Perfil';

                    // caso a imagem falhe
                    img.onerror = function () {
                        profileBtn.innerHTML = '<i class="fas fa-user"></i>';
                    };

                    profileBtn.appendChild(img);
                } else {
                    // fallback
                    profileBtn.innerHTML = '<i class="fas fa-user"></i>';
                }
            } catch (err) {
                console.warn('updateMobileProfileImage error:', err);
            }
        }

        // chama agora
        updateMobileProfileImage();

        // atualiza quando o estado de auth mudar
        try {
            if (window.firebaseauth && typeof window.firebaseauth.onAuthStateChanged === "function") {
                window.firebaseauth.onAuthStateChanged(() => updateMobileProfileImage());
            } else if (typeof window.onAuthStateChanged === "function") {
                window.onAuthStateChanged(window.firebaseauth, () => updateMobileProfileImage());
            }
        } catch (e) {
            console.warn("Não foi possível registrar auth listener no mobile-profile-btn:", e);
        }

        const closeBtn = document.getElementById('mobile-close-btn');
        const overlay = document.getElementById('mobile-overlay');

        // left-card pode existir já no DOM; usamos uma função para buscá-lo dinamicamente
        const getLeftCard = () => document.querySelector('.left-card');

        if (!charBtn || !invBtn || !closeBtn || !overlay) {
            console.warn('Mobile navigation elements not found');
            return;
        }

        let currentView = null; // 'char' | 'inv' | null

        function closeAllViews() {
            const leftCard = getLeftCard();
            const inventoryWrap = document.getElementById('inventory-wrap');
            if (leftCard) leftCard.classList.remove('mobile-active');
            if (inventoryWrap) inventoryWrap.classList.remove('mobile-active');
            overlay.classList.remove('visible');
            closeBtn.classList.remove('visible');
            charBtn.classList.remove('active');
            invBtn.classList.remove('active');
            currentView = null;
            document.body.style.overflow = '';
        }

        function openCharView() {
            closeAllViews();
            const leftCard = getLeftCard();
            if (leftCard) leftCard.classList.add('mobile-active');
            overlay.classList.add('visible');
            closeBtn.classList.add('visible');
            charBtn.classList.add('active');
            currentView = 'char';
            document.body.style.overflow = 'hidden';
        }

        function openInvView() {
            // Fecha primeiro para garantir estado limpo; em seguida tenta ativar inventory-wrap
            closeAllViews();

            // função recursiva / retry caso o inventory-wrap ainda não exista (gerado async)
            const tryActivate = () => {
                const inventoryWrap = document.getElementById('inventory-wrap');
                if (inventoryWrap) {
                    inventoryWrap.classList.add('mobile-active');
                    overlay.classList.add('visible');
                    closeBtn.classList.add('visible');
                    invBtn.classList.add('active');
                    currentView = 'inv';
                    document.body.style.overflow = 'hidden';
                } else {
                    // tenta novamente após um curto delay — a criação do inventário geralmente é rápida
                    setTimeout(tryActivate, 120);
                }
            };

            tryActivate();
        }

        // Event listeners — sempre (re)abre a view correspondente (clicar no ativo a recarrega)
        charBtn.addEventListener('click', (e) => { e.stopPropagation(); openCharView(); });
        invBtn.addEventListener('click', (e) => { e.stopPropagation(); openInvView(); });

        // home/profile/close/overlay listeners
        if (homeBtn) homeBtn.addEventListener('click', (e) => { e.stopPropagation(); window.location.href = 'index.html'; });
        if (profileBtn) profileBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const confirmed = await showCustomAlert('Deseja sair da conta?');
            if (!confirmed) return; // usuário cancelou (X / ESC / fora do painel)
            try {
                await window.firebaseauth.signOut();
                window.location.href = 'index.html';
            } catch (err) {
                console.error('Erro ao sair:', err);
                await showCustomAlert('Erro ao sair. Tente novamente.');
            }
        });


        if (closeBtn) closeBtn.addEventListener('click', closeAllViews);
        if (overlay) overlay.addEventListener('click', closeAllViews);

        // Fechar com ESC
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && currentView) closeAllViews(); });

        // fallback: se o botão de inventário não tiver icon (FontAwesome ausente), insere um ícone comum
        try {
            if (invBtn && !invBtn.querySelector('i') && !invBtn.querySelector('img')) {
                invBtn.innerHTML = '<i class="fas fa-box"></i>';
            }
        } catch (e) { /* silencioso se DOM for modificado */ }

        // Inicializa com a ficha aberta (mobile)
        openCharView();

        // Reage ao redimensionamento para fechar quando virar desktop
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                const nowMobile = window.innerWidth <= 920;
                if (!nowMobile && currentView) closeAllViews();
            }, 160);
        });
    })();


    /* ========== DEBUG MOBILE ========== */
    (function debugMobile() {
        console.log('=== DEBUG MOBILE ===');
        console.log('Window width:', window.innerWidth);
        console.log('Is mobile?', window.innerWidth <= 920);

        setTimeout(() => {
            const charBtn = document.getElementById('mobile-char-btn');
            const invBtn = document.getElementById('mobile-inv-btn');
            const leftCard = document.querySelector('.left-card');
            const inventoryWrap = document.getElementById('inventory-wrap');

            console.log('Elements found:');
            console.log('- mobile-char-btn:', !!charBtn);
            console.log('- mobile-inv-btn:', !!invBtn);
            console.log('- left-card:', !!leftCard);
            console.log('- inventory-wrap:', !!inventoryWrap);

            if (leftCard) {
                console.log('left-card display:', getComputedStyle(leftCard).display);
                console.log('left-card has mobile-active?', leftCard.classList.contains('mobile-active'));
            }

            if (inventoryWrap) {
                console.log('inventory-wrap display:', getComputedStyle(inventoryWrap).display);
                console.log('inventory-wrap has mobile-active?', inventoryWrap.classList.contains('mobile-active'));
            }
        }, 1000);
    })();
    /* === Ensure mobile-profile-btn ALWAYS shows the logged-in user's Google photo === */
    (function ensureMobileProfileImageAlways() {
        function setProfileImage() {
            try {
                const profileBtn = document.getElementById('mobile-profile-btn') || document.querySelector('.mobile-nav-btn#mobile-profile-btn');
                if (!profileBtn) return; // se o botão não estiver no DOM (ex: desktop), sai silenciosamente

                const user = window.firebaseauth?.currentUser || null;

                if (user && user.photoURL) {
                    // se já existe <img> com a mesma src, não re-criar
                    const existing = profileBtn.querySelector('img');
                    if (existing && existing.src === user.photoURL) return;

                    profileBtn.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = user.photoURL;
                    img.alt = user.displayName || user.email || 'Perfil';
                    img.title = user.displayName || user.email || 'Perfil';

                    img.onerror = function () {
                        // fallback visual (ícone)
                        profileBtn.innerHTML = '<i class="fas fa-user"></i>';
                    };

                    profileBtn.appendChild(img);
                } else {
                    // fallback: ícone (não sobrescreve se já houver imagem)
                    if (!profileBtn.querySelector('img')) profileBtn.innerHTML = '<i class="fas fa-user"></i>';
                }
            } catch (e) {
                console.warn('ensureMobileProfileImageAlways error:', e);
            }
        }

        // executa imediatamente e em eventos relevantes
        setProfileImage();

        // atualiza quando auth muda (compatível com seu código que já tenta registrar listener)
        try {
            if (window.firebaseauth && typeof window.firebaseauth.onAuthStateChanged === 'function') {
                window.firebaseauth.onAuthStateChanged(setProfileImage);
            } else if (typeof window.onAuthStateChanged === 'function') {
                window.onAuthStateChanged(window.firebaseauth, setProfileImage);
            }
        } catch (e) {
            console.warn('Erro registrando onAuthStateChanged para mobile-profile-btn:', e);
        }

        // reforços: resize (caso a UI apareça/remova botões) e pequeno timeout
        window.addEventListener('resize', setProfileImage);
        setTimeout(setProfileImage, 600); // tenta novamente caso a barra móvel seja injetada depois
    })();

})();
