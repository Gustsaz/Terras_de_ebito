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

    // Load character from Firestore — busca em TODOS os usuários para localizar o personagem pelo charUid
    charData = null;
    let ownerUserId = null;
    try {
        // 1) Primeiro tentativa rápida: se o admin (currentUser) tiver o personagem no próprio doc — mantém compatibilidade
        try {
            if (window.firebaseauth?.currentUser?.uid) {
                const tryRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
                const trySnap = await window.getDoc(tryRef);
                if (trySnap && trySnap.exists()) {
                    const data = trySnap.data();
                    const chars = Array.isArray(data.personagens) ? data.personagens : [];
                    const found = chars.find(c => c && String(c.uid) === String(charUid));
                    if (found) {
                        charData = found;
                        ownerUserId = window.firebaseauth.currentUser.uid;
                    }
                }
            }
        } catch (innerErr) {
            // não interrompe — vamos para a busca global abaixo
            console.debug('personagemadm: verificação rápida falhou', innerErr);
        }

        // 2) Se não encontrado no currentUser, buscar em toda a coleção 'usuarios'
        if (!charData) {
            const usuariosCol = window.collection(window.firestoredb, 'usuarios');
            const snap = await window.getDocs(usuariosCol);
            if (snap && !snap.empty) {
                // iterar documentos; quando encontrar, guarda charData e ownerUserId e sai
                for (const docItem of snap.docs) {
                    try {
                        const data = docItem.data();
                        const chars = Array.isArray(data.personagens) ? data.personagens : [];
                        if (!chars || chars.length === 0) continue;
                        const found = chars.find(c => c && String(c.uid) === String(charUid));
                        if (found) {
                            charData = found;
                            ownerUserId = docItem.id;
                            break;
                        }
                    } catch (e) {
                        // ignora entry com problema e continua
                        console.warn('personagemadm: erro ao checar doc usuarios', docItem.id, e);
                    }
                }
            }
        }
    } catch (error) {
        console.warn('Error loading character from Firestore (global search)', error);
    }

    // se não encontrou nada — fallback e redireciona como antes
    if (!charData) {
        alert('Personagem não encontrado');
        window.location.href = 'adm.html';
        return;
    }

    // (Opcional) expõe ownerUserId para debug/futuras ações (ex.: edição pelo admin)
    window._personagemAdmOwner = ownerUserId || null;

    /* ===== INVENTÁRIO (para página personagemadm.html) =====
   Substitua o bloco/funcão atual de inventário por este código.
   Usa ownerUserId e charUid já carregados no início do arquivo personagemadm.js.
*/
    (async function renderInventoryForAdmin() {
        try {
            // ownerUserId e charUid devem já existir (carregados acima em personagemadm.js)
            if (!ownerUserId || !charUid) {
                console.warn('renderInventoryForAdmin: ownerUserId ou charUid não definidos');
                return;
            }

            // --- Criar modal de detalhe do item (se não existir) ---
            function ensureItemModalExists() {
                if (document.getElementById('inventory-item-modal-backdrop')) return;
                const tpl = `
        <div id="inventory-item-modal-backdrop" class="inventory-modal" aria-hidden="true" style="display:none;">
          <div class="modal-content" role="dialog" aria-modal="true" id="inventory-item-modal">
            <button class="close-btn" id="inventory-item-modal-close" title="Fechar">&times;</button>
            <div class="item-detail">
              <h3 id="inv-detail-name">—</h3>
              <div class="item-detail-fields" id="inv-detail-fields"></div>
              <div class="item-detail-actions">
                <button type="button" id="inv-detail-close" class="alert-btn">Fechar</button>
              </div>
            </div>
          </div>
        </div>
      `;
                const div = document.createElement('div');
                div.innerHTML = tpl;
                document.body.appendChild(div);
                const closeBtns = [
                    document.getElementById('inventory-item-modal-close'),
                    document.getElementById('inv-detail-close')
                ];
                const backdrop = document.getElementById('inventory-item-modal-backdrop');
                closeBtns.forEach(b => b?.addEventListener('click', () => {
                    backdrop.classList.remove('open'); backdrop.style.display = 'none';
                    backdrop.setAttribute('aria-hidden', 'true');
                }));
                // fechar ao clicar fora
                backdrop.addEventListener('click', (ev) => {
                    if (ev.target === backdrop) {
                        backdrop.classList.remove('open'); backdrop.style.display = 'none';
                        backdrop.setAttribute('aria-hidden', 'true');
                    }
                });
            }

            ensureItemModalExists();

            // abre o modal com os dados do item
            async function openItemDetail(itemDoc) {
                const backdrop = document.getElementById('inventory-item-modal-backdrop');
                const nameEl = document.getElementById('inv-detail-name');
                const fieldsEl = document.getElementById('inv-detail-fields');
                if (!backdrop || !nameEl || !fieldsEl) return;
                nameEl.textContent = itemDoc.nome || '(Sem nome)';
                fieldsEl.innerHTML = `
        <div><strong>Categoria:</strong> ${escapeHtml(String(itemDoc.categoria || '—'))}</div>
        <div><strong>Tipo:</strong> ${escapeHtml(String(itemDoc.tipo_item || '—'))}</div>
        <div><strong>Peso:</strong> ${escapeHtml(String(itemDoc.peso ?? '—'))}</div>
        <div style="margin-top:8px;"><strong>Descrição:</strong><div style="opacity:0.95;margin-top:6px;">${escapeHtml(String(itemDoc.descricao || '—'))}</div></div>
        <div style="margin-top:6px;"><strong>Efeito:</strong><div style="opacity:0.95;margin-top:6px;">${escapeHtml(String(itemDoc.efeito || '—'))}</div></div>
      `;
                backdrop.style.display = 'block';
                setTimeout(() => { backdrop.classList.add('open'); backdrop.setAttribute('aria-hidden', 'false'); }, 10);
            }

            function escapeHtml(s) {
                return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
            }

            // Fetch do usuário proprietário e localizar personagem
            const userDocRef = window.doc(window.firestoredb, 'usuarios', ownerUserId);
            const userSnap = await window.getDoc(userDocRef);
            if (!userSnap || !userSnap.exists()) {
                console.warn('renderInventoryForAdmin: usuário dono não encontrado', ownerUserId);
                return;
            }
            const userData = userSnap.data() || {};
            const personagens = Array.isArray(userData.personagens) ? userData.personagens : [];
            const foundIdx = personagens.findIndex(p => p && String(p.uid) === String(charUid));
            if (foundIdx < 0) {
                console.warn('renderInventoryForAdmin: personagem não encontrado no usuário', charUid);
                return;
            }
            const thisChar = personagens[foundIdx];

            // cria container inventory-wrap (se já existir, apenas atualiza)
            let wrap = document.getElementById('inventory-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.id = 'inventory-wrap';
                const main = document.querySelector('.character-main') || document.body;
                main.appendChild(wrap);
            }

            // === Monta grid 4x5 (20 slots) usando classes do personagem.css ===
            wrap.innerHTML = `
      <div class="inventory-card">
        <h3>Inventário</h3>
        <div class="inventory-top">
          <div class="peso-line">Peso: <span id="peso-info">—</span></div>
          <div class="inventory-actions"></div>
        </div>
        <div class="inventory-grid" id="inv-grid" aria-live="polite" role="grid" aria-label="Inventário do personagem"></div>
      </div>
    `;

            const grid = wrap.querySelector('#inv-grid');

            // helpers
            function createEmptySlot(index) {
                const slot = document.createElement('div');
                slot.className = 'inv-slot';
                slot.dataset.slotIndex = String(index);
                slot.innerHTML = `<div class="inv-slot-empty"></div>`;
                return slot;
            }

            const itensArray = Array.isArray(thisChar.itens) ? thisChar.itens.slice() : [];
            const TOTAL_SLOTS = 20;
            grid.innerHTML = '';

            // preencher slots
            for (let slotIndex = 0; slotIndex < TOTAL_SLOTS; slotIndex++) {
                const entry = itensArray[slotIndex];
                const slotEl = createEmptySlot(slotIndex);

                if (!entry) {
                    grid.appendChild(slotEl);
                    continue;
                }

                // enquanto carrega
                slotEl.innerHTML = `<div class="inv-slot-loading">Carregando...</div>`;
                grid.appendChild(slotEl);

                (async () => {
                    try {
                        const uidItem = (typeof entry === 'string') ? entry : (entry.uid || entry.id || null);
                        if (!uidItem) {
                            slotEl.innerHTML = `<div class="inv-slot-empty">Item inválido</div>`;
                            return;
                        }
                        const itRef = window.doc(window.firestoredb, 'itens', String(uidItem));
                        const itSnap = await window.getDoc(itRef);
                        if (!itSnap || !itSnap.exists()) {
                            slotEl.innerHTML = `<div class="inv-slot-empty">Item não encontrado</div>`;
                            return;
                        }
                        const item = itSnap.data() || {};
                        const nome = item.nome || '(Sem nome)';
                        const peso = Number(item.peso ?? 0);
                        const imgSrc = (item.img && String(item.img).length) ? item.img : (item.icon || '');
                        let imgHtml = '';
                        if (imgSrc) {
                            imgHtml = `<div class="inv-slot-img-wrap"><img src="${String(imgSrc).replace(/"/g, '')}" alt="${escapeHtml(nome)}" onerror="this.style.opacity=.6; this.src='./imgs/placeholder.png'"></div>`;
                        } else {
                            imgHtml = `<div class="inv-slot-name">${escapeHtml(nome)}</div>`;
                        }
                        const qty = (typeof entry.qty !== 'undefined') ? Number(entry.qty) : (item.quantidade || item.qtd || null);
                        const qtyHtml = (qty && qty > 1) ? `<span class="inv-qty">${qty}</span>` : '';

                        slotEl.innerHTML = `
            ${imgHtml}
            ${qtyHtml}
          `;
                        slotEl.dataset.itemUid = String(uidItem);
                        slotEl.dataset.itemName = nome;
                        slotEl.dataset.itemPeso = String(peso);

                        slotEl.style.cursor = 'pointer';
                        slotEl.addEventListener('click', async (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            try {
                                // recarrega item antes de abrir detalhe
                                const reloadSnap = await window.getDoc(window.doc(window.firestoredb, 'itens', String(uidItem)));
                                const reloadData = (reloadSnap && reloadSnap.exists()) ? reloadSnap.data() : item;
                                openItemDetail(reloadData);
                            } catch (err) {
                                console.warn('Erro ao abrir detalhe do item', err);
                            }
                        });

                    } catch (err) {
                        console.warn('Erro ao renderizar slot de inventário (admin):', err);
                        slotEl.innerHTML = `<div class="inv-slot-empty">Erro</div>`;
                    }
                })();
            }

            // atualiza peso (melhor esforço)
            (async function updatePeso() {
                try {
                    const pesoSpan = document.getElementById('peso-info');
                    if (!pesoSpan) return;
                    let pesoAtual = Number(thisChar.peso_atual ?? 0);
                    if (!Number.isFinite(pesoAtual) || pesoAtual === 0) {
                        let total = 0;
                        for (const entry of itensArray) {
                            try {
                                const uid = (typeof entry === 'string') ? entry : (entry.uid || entry.id || null);
                                if (!uid) continue;
                                const itS = await window.getDoc(window.doc(window.firestoredb, 'itens', String(uid)));
                                if (itS && itS.exists()) {
                                    const d = itS.data();
                                    total += Number(d.peso ?? 0) || 0;
                                }
                            } catch (e) { /* ignore per-item errors */ }
                        }
                        pesoAtual = total;
                    }
                    const cargaMax = Number(thisChar.carga ?? (thisChar.atributos?.carga) ?? (8 + Number(thisChar.atributos?.bravura ?? 0)));
                    pesoSpan.textContent = `${pesoAtual} / ${Number.isFinite(cargaMax) ? cargaMax : 0}`;
                } catch (e) {
                    console.warn('updatePeso erro', e);
                }
            })();

            // polling opcional para manter sincronizado
            let pollInterval = Number(wrap.dataset.pollInterval) || 6000;
            const pollId = setInterval(async () => {
                // re-fetch dados do personagem e repopula grade (simples): chama populate-like behavior
                try {
                    const snap = await window.getDoc(window.doc(window.firestoredb, 'usuarios', ownerUserId));
                    if (!snap || !snap.exists()) return;
                    const data = snap.data() || {};
                    const chars = Array.isArray(data.personagens) ? data.personagens : [];
                    const idx = chars.findIndex(p => p && String(p.uid) === String(charUid));
                    if (idx < 0) return;
                    // se mudou, atualiza thisChar and re-render quickly by calling this IIFE again would be heavy;
                    // simple approach: refresh the page area by reloading this function (cheap in admin view)
                    // For now, just update weight and leave slots as-is (they are mostly static)
                    // You can call a full re-render by uncommenting the next lines:
                    // clearInterval(pollId);
                    // renderInventoryForAdmin(); // recursion avoided here
                } catch (e) { /* ignore poll errors */ }
            }, pollInterval);

            wrap.dataset.pollId = String(pollId);

        } catch (err) {
            console.error('renderInventoryForAdmin error', err);
        }
    })();



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
