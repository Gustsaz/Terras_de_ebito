// personagemadm.js - Visualização da ficha do personagem (só para ver, sem editar)

// Simplificado: apenas load and display
let clickCountGlobal = {};
let charData = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading personagemadm.js');

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

    // Agora checa se o usuário está logado
    if (!window.firebaseauth?.currentUser) {
        alert('User not logged in');
        window.location.href = 'adm.html';
        return;
    }

    // Set sidebar to home icon linking back to adm.html
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.innerHTML = '<a href="adm.html" class="sidebar-home"><i class="fas fa-home"></i></a>';
    }

    console.log('DOMContentLoaded in personagemadm.js');
    // Read UID from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const charUid = urlParams.get('uid');
    if (!charUid) {
        alert('No character UID provided');
        window.location.href = 'adm.html';
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
            // Note: admin can view any character, but we load only the user's characters, assuming the uid is of the owner's character
            // To properly implement: need to find which user owns the character, but since uid is per user, it's the current user
            charData = characters.find(c => c.uid === charUid);
        }
    } catch (error) {
        console.warn('Error loading character from Firestore', error);
    }

    if (!charData) {
        alert('Personagem não encontrado');
        window.location.href = 'adm.html';
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
    const personality = charData.personalidade || '—';

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

    // Transforma RAW → TOTAL (com bônus)
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

    // se charData não tiver proeficiencias, usa a lista padrão calculada acima
    if (!Array.isArray(charData.proeficiencias) || charData.proeficiencias.length === 0) {
        proeficiencias = proeficiencias;
    } else {
        // se existir, usa as salvas
        proeficiencias = charData.proeficiencias.slice();
    }

    // render proficiencias
    const profListEl = document.getElementById('proficiencias-list') || document.getElementById('char-proficiencias');
    if (profListEl) {
        profListEl.innerHTML = '';
        if (Array.isArray(proeficiencias) && proeficiencias.length) {
            const ul = document.createElement('ul');
            ul.className = 'profs-list';
            proeficiencias.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p;
                ul.appendChild(li);
            });
            profListEl.appendChild(ul);
        } else {
            profListEl.textContent = '—';
        }
    }

    // Preencher os elementos já presentes no HTML
    const el = id => document.getElementById(id);
    if (el('char-name')) el('char-name').textContent = 'Nome: ' + charName;
    if (el('char-class')) el('char-class').textContent = savedClass || '—';
    if (el('char-race')) {
        if (!savedRace) el('char-race').textContent = '—';
        else el('char-race').textContent = (savedRace === 'Feéricos' && savedSubrace) ? `Feérico (${savedSubrace})` : savedRace;
    }

    // imagem do personagem
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
    }

    // exibir valores dos atributos
    // função para calcular bonus racial
    const getBonus = (key) => {
        let bonus = 0;
        if (savedRace === 'Feéricos' && savedSubrace === 'Ágeis' && key === 'tecnica') bonus = 1;
        if (savedRace === 'Elfo' && key === 'intelecto') bonus = 1;
        if (savedRace === 'Meio Orc' && key === 'bravura') bonus = 1;
        return bonus;
    };

    // exibir valores
    Object.keys(attrKeys).forEach(key => {
        const attrMapToDom = {
            tecnica: 'attr-tecnica',
            intelecto: 'attr-intelecto',
            essencia: 'attr-essencia',
            arcano: 'attr-arcano',
            bravura: 'attr-bravura',
            folego: 'attr-folego'
        };
        const raw = attributes[normalize(key)] ?? 0;
        const total = raw + getBonus(normalize(key));
        if (el(attrMapToDom[key])) {
            el(attrMapToDom[key]).textContent = String(total);
            el(attrMapToDom[key]).title = getBonus(normalize(key)) > 0 ? `${raw} + ${getBonus(normalize(key))} (bônus racial)` : `${raw}`;
        }
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

    // description panels
    if (el('char-historia-desc')) el('char-historia-desc').textContent = story;
    if (el('char-aparencia-desc')) el('char-aparencia-desc').textContent = appearance;
    if (el('char-personality-desc')) el('char-personality-desc').textContent = personality;

    /* ---------- barras EXP/PV/MN/STA ---------- */

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const pct = (cur, tot) => (tot > 0 ? Math.min(100, (cur / tot) * 100) : 0);

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
        }
    }

    // Initialize values
    let curPV = Math.max(0, Math.floor(charData?.PV?.atual ?? charData?.PV ?? pv));
    let curMN = Math.max(0, Math.floor(charData?.MN?.atual ?? charData?.MN ?? mn));
    let curSTA = Math.max(0, Math.floor(charData?.STA?.atual ?? charData?.STA ?? sta));
    let expLevel = Math.max(1, Math.floor(charData.LVL ?? 1));
    let currentEXP = Math.max(0, Math.floor(charData.EXP?.atual ?? 0));

    function expLimitForLevel(level) {
        const base = 100;
        return Math.round(base * Math.pow(4 / 3, Math.max(0, level - 1)));
    }

    // Use totals
    let totPV = Math.max(0, Math.floor(Number(charData?.PV?.total ?? pv)));
    let totMN = Math.max(0, Math.floor(Number(charData?.MN?.total ?? mn)));
    let totSTA = Math.max(0, Math.floor(Number(charData?.STA?.total ?? sta)));

    // Update bars
    applyBar('pv-bar-fill', 'pv-bar-text', curPV, totPV, 'pv');
    applyBar('mn-bar-fill', 'mn-bar-text', curMN, totMN, 'mn');
    applyBar('sta-bar-fill', 'sta-bar-text', curSTA, totSTA, 'sta');

    const expLimit = expLimitForLevel(expLevel);
    applyBar('exp-bar-fill', 'exp-bar-text', currentEXP, expLimit, 'exp');

    if (el('exp-level')) el('exp-level').textContent = String(expLevel);

    /* ---------- Equipment slots population ---------- */

    let inventoryFromFirebase = [];

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
    async function refreshSlotsFromCharData() {
        try {
            const charObj = charData || {};
            const equipped = Array.isArray(charObj.itens) ? charObj.itens : [];

            // --- atualização do display de peso no inventory-card ---
            let pesoAtual = Number(charObj.peso_atual ?? 0);
            try {
                if (!Number.isFinite(pesoAtual) || pesoAtual === 0) {
                    pesoAtual = Number(await calcularPesoAtual(equipped)) || 0;
                }
            } catch (e) {
                pesoAtual = Number(charObj.peso_atual ?? 0) || 0;
            }
            let cargaMax = Number(charObj.carga ?? charObj.atributos?.carga);
            if (!Number.isFinite(cargaMax) || cargaMax <= 0) {
                const raw = Number(charObj?.atributos?.bravura ?? 0) || 0;
                let bonus = 0;
                if (charObj.raca === 'Feéricos' && charObj.subraca === 'Ágeis') bonus = 1;
                if (charObj.raca === 'Elfo') bonus = 1;
                if (charObj.raca === 'Meio Orc') bonus = 1;
                cargaMax = 8 + (raw + bonus);
            }

            const pesoInfoEl = document.getElementById('peso-info');
            if (pesoInfoEl) pesoInfoSpan.textContent = `${pesoAtual} / ${cargaMax}`;

            // cria listas para preencher
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
                if (t.includes('arma') || t.includes('equip')) return 'armas';
                return 'armas';
            }

            // percorre e busca documentos
            for (let i = 0; i < equipped.length; i++) {
                const e = equipped[i];
                if (!e || !e.uid) continue;
                try {
                    const itemRef = window.doc(window.firestoredb, 'itens', e.uid);
                    const itemSnap = await window.getDoc(itemRef);
                    if (!itemSnap.exists()) continue;
                    const it = itemSnap.data();
                    const slotKey = classifyTipo(it.tipo_item);
                    lists[slotKey].push({ id: itemSnap.id, data: it });
                } catch (err) {
                    console.warn('Erro lendo item referenciado', e.uid, err);
                }
            }

            // função para renderizar lista em slot (simples, sem botão remover)
            function renderListInSlot(slotId, itemsArray) {
                const el = document.getElementById(slotId);
                if (!el) return;
                const body = el.querySelector('.slot-body');
                if (!body) return;

                body.innerHTML = '';

                if (!itemsArray.length) {
                    body.textContent = 'Vazio';
                    return;
                }

                const ul = document.createElement('ul');
                ul.className = 'equipped-list';

                itemsArray.forEach((itemWrap) => {
                    const li = document.createElement('li');
                    li.className = 'equipped-item';
                    li.textContent = itemWrap.data.nome || '(sem nome)';
                    ul.appendChild(li);
                });

                body.appendChild(ul);
            }

            // renderiza as três listas
            renderListInSlot('char-armas', lists.armas);
            renderListInSlot('char-protecao', lists.protecao);
            renderListInSlot('char-utilitarios', lists.utilitarios);

        } catch (err) {
            console.error('Erro em refreshSlotsFromCharData', err);
        }
    }

    /* ---------- Magic slots ---------- */
    async function refreshMagicSlotsFromCharData() {
        try {
            const charObj = charData || {};

            // helper: renderiza lista simples para feitiços ou milagres
            async function buildList(arr, collectionName, slotEl) {
                const body = slotEl.querySelector('.slot-body');
                body.innerHTML = '';

                const validArray = Array.isArray(arr) ? arr : [];
                if (!validArray.length || validArray.every(a => !a?.uid)) {
                    body.textContent = 'Vazio';
                    return;
                }

                const ul = document.createElement('ul');
                ul.className = 'equipped-list';

                for (const entry of validArray) {
                    if (!entry?.uid) continue;
                    try {
                        const dref = window.doc(window.firestoredb, collectionName, entry.uid);
                        const ds = await window.getDoc(dref);
                        const nameText = (ds && ds.exists()) ? (ds.data().nome || ds.id) : '(?)';

                        const li = document.createElement('li');
                        li.className = 'equipped-item';
                        li.textContent = nameText;
                        ul.appendChild(li);
                    } catch (e) {
                        console.warn('Erro ao buscar doc de', entry.uid, e);
                    }
                }

                body.appendChild(ul);
            }

            if (document.getElementById('char-feiticos')) {
                const arrF = Array.isArray(charData?.feiticos) ? charData.feiticos : [];
                await buildList(arrF, 'feitiços', document.getElementById('char-feiticos'));
            }
            if (document.getElementById('char-milagres')) {
                const arrM = Array.isArray(charData?.milagres) ? charData.milagres : [];
                await buildList(arrM, 'milagres', document.getElementById('char-milagres'));
            }

        } catch (err) {
            console.warn('refreshMagicSlotsFromCharData erro', err);
        }
    }

    /* ---------- Defense Cat ---------- */
    async function refreshDefenseCat() {
        try {
            const el = document.getElementById('char-def-value');
            if (!el) return;

            let defVal = null;

            try {
                if (typeof charData === 'object' && charData !== null) {
                    if (charData.DEF !== undefined && charData.DEF !== null) defVal = charData.DEF;
                }
            } catch (e) {
                console.warn('Erro lendo DEF', e);
            }

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

            if (defVal !== null && defVal !== undefined && defVal !== '') {
                el.textContent = String(defVal);
            } else {
                el.textContent = '—';
            }
        } catch (err) {
            console.error('refreshDefenseCat erro:', err);
        }
    }

    window.refreshDefenseCat = refreshDefenseCat;

    setTimeout(async () => {
        await refreshDefenseCat();
        await refreshSlotsFromCharData();
        await refreshMagicSlotsFromCharData();
    }, 450);

    /* ---------- TABS setup ---------- */
    (function setupTabsAndDescriptionCopy() {
        const leftCard = document.querySelector('.left-card');
        if (!leftCard) return;

        const tabs = Array.from(leftCard.querySelectorAll('.card-tab'));
        const panels = Array.from(leftCard.querySelectorAll('.tab-content'));

        if (!tabs.length || !panels.length) return;

        function panelNameFromEl(p) {
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
                if (pn) p.style.display = (pn === name) ? '' : 'none';
            });
        }

        setActiveTab('general');

        tabs.forEach(tab => tab.addEventListener('click', (e) => {
            const name = tab.dataset.tab;
            if (!name) return;
            if (tab.classList.contains('active')) return;
            setActiveTab(name);
        }));
    })();
});

// Placeholder functions
function renderProficiencies(char) {
    const profListEl = document.getElementById('proficiencias-list') || document.getElementById('char-proficiencias');
    if (!profListEl) return;
    const arr = Array.isArray(char.proeficiencias) ? char.proeficiencias
        : Array.isArray(char.proficiencias) ? char.proficiencias : [];

    if (!arr || arr.length === 0) {
        profListEl.innerHTML = '<em>Sem proficiências</em>';
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'profs-list';
    arr.forEach(p => {
        const li = document.createElement('li');
        li.textContent = String(p);
        ul.appendChild(li);
    });

    profListEl.innerHTML = '';
    profListEl.appendChild(ul);
}
