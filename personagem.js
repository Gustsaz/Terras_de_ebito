// personagem.js - popula a personagem.html a partir do localStorage
document.addEventListener('DOMContentLoaded', () => {
    // Keys esperadas no localStorage:
    // selectedRace, selectedSubrace, selectedClass, attributes (obj JSON),
    // characterName, characterStory, characterAppearance, inventory (opcional array)

    // Helper normalize (remove acentos e deixar em minúsculas)
    const normalize = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Ler attributes salvos
    let attributes = {};
    try {
        const raw = localStorage.getItem('attributes');
        if (raw) {
            attributes = JSON.parse(raw);
            // garantir valores numéricos
            Object.keys(attributes).forEach(k => attributes[k] = Number(attributes[k] || 0));
        }
    } catch (e) {
        console.warn('Não foi possível ler attributes do localStorage', e);
    }

    // Dados basicos
    const savedRace = localStorage.getItem('selectedRace') || null;
    const savedSubrace = localStorage.getItem('selectedSubrace') || null;
    const savedClass = localStorage.getItem('selectedClass') || null;
    const charName = localStorage.getItem('characterName') || 'Herói Sem Nome';
    const story = localStorage.getItem('characterStory') || '—';
    const appearance = localStorage.getItem('characterAppearance') || '—';

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
            const candidate = `imgs/${savedClass.toLowerCase()}.png`;
            // tenta carregar (sem fetch) - definimos src e se falhar, cai ao onerror
            el('char-img').src = candidate;
            el('char-img').onerror = () => { el('char-img').src = 'imgs/placeholder.png'; };
        } else {
            el('char-img').src = 'imgs/placeholder.png';
        }
    }

    // calcular atributos base e bonus
    const baseAttrs = { ...attributes };
    const bonusAttrs = {};
    const attrMapToDom = {
        tecnica: 'attr-tecnica',
        intelecto: 'attr-intelecto',
        essencia: 'attr-essencia',
        arcano: 'attr-arcano',
        bravura: 'attr-bravura',
        folego: 'attr-folego'
    };

    // inicializar bonus como 0
    Object.keys(attrMapToDom).forEach(k => bonusAttrs[normalize(Object.keys(attrMapToDom).find(key => attrMapToDom[key] === `attr-${normalize(k)}`))] = 0);

    // aplicar bonuses
    if (savedRace === 'Feéricos' && savedSubrace === 'Ágeis') {
        bonusAttrs['tecnica'] += 1;
    }
    if (savedRace === 'Elfo') {
        bonusAttrs['intelecto'] += 1;
    }
    if (savedRace === 'Meio Orc') {
        bonusAttrs['bravura'] += 1;
    }

    // exibir apenas o total; tooltip com base + bonus
    Object.keys(attrMapToDom).forEach(key => {
        const id = attrMapToDom[key];
        const base = baseAttrs[normalize(key)] ?? 0;
        const bonus = bonusAttrs[normalize(key)] ?? 0;
        const total = base + bonus;
        const tooltip = `${base} + ${bonus}`;
        if (el(id)) {
            el(id).textContent = String(total);
            el(id).title = tooltip;
        }
    });

    // tornar atributos clicáveis para edição
    document.querySelectorAll('.attr-value').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            const attrKey = el.id.replace('attr-', '');
            const normalizedKey = normalize(attrKey);
            const base = baseAttrs[normalizedKey] ?? 0;
            const bonus = bonusAttrs[normalizedKey] ?? 0;
            const total = base + bonus;

            // criar editor temporário
            const editor = document.createElement('div');
            editor.style.display = 'inline-flex';
            editor.style.alignItems = 'center';
            editor.style.gap = '4px';
            editor.style.fontSize = '0.8rem';
            editor.innerHTML = `
                <input type="number" class="attr-input" value="${base}" max="20" style="width:50px;font-size:0.8rem;" />
                + ${bonus}
            `;

            el.style.display = 'none';
            el.parentElement.appendChild(editor);

            const input = editor.querySelector('.attr-input');
            input.focus();
            input.select();

            function finish(commit) {
                if (commit) {
                    let num = Number(input.value.trim());
                    if (Number.isNaN(num)) num = 0;
                    num = Math.floor(num);
                    num = Math.min(20, num);
                    // salvar novo base
                    let attributes = {};
                    try {
                        const saved = localStorage.getItem('attributes');
                        if (saved) attributes = JSON.parse(saved);
                    } catch (e) { console.warn('Erro lendo attributes', e); }
                    attributes[normalizedKey] = num;
                    try {
                        localStorage.setItem('attributes', JSON.stringify(attributes));
                    } catch (e) { console.warn('Erro salvando attributes', e); }
                    location.reload();
                } else {
                    // cancelar
                }
                editor.remove();
                el.style.display = '';
            }

            input.addEventListener('keydown', ev => {
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

    // história / aparência
    if (el('char-historia')) el('char-historia').textContent = story;
    if (el('char-aparencia')) el('char-aparencia').textContent = appearance;

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
            <div class="peso">0 / 0 kg</div>
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
                    img.src = item.img || `imgs/${(item.id || 'placeholder')}.png`;
                    img.onerror = () => { img.src = 'imgs/placeholder.png'; };
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

            // update peso (se você armazenar peso por item)
            const pesoEl = wrap.querySelector('.peso');
            if (pesoEl) {
                let totalPeso = 0;
                let maxPeso = 0;
                inventory.forEach(it => {
                    const w = Number(it.weight || 0);
                    totalPeso += (w * (it.qty || 1));
                    maxPeso += w * (it.qty || 1);
                });
                // fallback: se não houver peso, mostrar contagem
                if (totalPeso === 0) pesoEl.textContent = `${inventory.length} / ${slotsCount} itens`;
                else pesoEl.textContent = `${totalPeso} / ${Math.max(12, Math.round(maxPeso || 12))} kg`;
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
    // tenta usar valores salvos; se não houver, usa os totais calculados (pv/mn/sta já foram definidos acima)
    let curPV = Math.max(0, Math.min(Math.floor(Number(localStorage.getItem('currentPV') ?? localStorage.getItem('pvAtual') ?? pv) || 0), Math.max(0, Math.floor(Number(pv) || 0))));
    let curMN = Math.max(0, Math.min(Math.floor(Number(localStorage.getItem('currentMN') ?? localStorage.getItem('mnAtual') ?? mn) || 0), Math.max(0, Math.floor(Number(mn) || 0))));
    let curSTA = Math.max(0, Math.min(Math.floor(Number(localStorage.getItem('currentSTA') ?? localStorage.getItem('staAtual') ?? sta) || 0), Math.max(0, Math.floor(Number(sta) || 0))));

    const totPV = Math.max(0, Math.floor(Number(pv) || 0));
    const totMN = Math.max(0, Math.floor(Number(mn) || 0));
    const totSTA = Math.max(0, Math.floor(Number(sta) || 0));


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

    /* ---------- EXP: limite por nível ---------- */
    function expLimitForLevel(level) {
        const base = 100;
        return Math.round(base * Math.pow(4 / 3, Math.max(0, level - 1)));
    }

    /* ---------- EXP state ---------- */
    let expLevel = Math.max(1, Math.floor(Number(readCurrentOrFallback(['expLevel', 'level', 'nivel'], 1))));
    let currentEXP = Math.max(0, Math.floor(Number(readCurrentOrFallback(['currentEXP', 'expAtual', 'exp_atual', 'exp'], 0))));
    function normalizeExpState() {
        let limit = expLimitForLevel(expLevel);
        while (currentEXP >= limit) {
            currentEXP -= limit;
            expLevel++;
            limit = expLimitForLevel(expLevel);
        }
        if (currentEXP < 0) currentEXP = 0;
        saveCurrent('expLevel', expLevel);
        saveCurrent('currentEXP', currentEXP);
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
    }
    updateAllBars();

    /* ---------- +/- buttons (PV/MN/STA) ---------- */
    function wirePlusMinus(minusId, plusId, getCur, setCur, total, storageKey) {
        const minus = document.getElementById(minusId);
        const plus = document.getElementById(plusId);
        if (minus) minus.addEventListener('click', (e) => { e.stopPropagation(); setCur(clamp(getCur() - 1, 0, total)); saveCurrent(storageKey, getCur()); updateAllBars(); });
        if (plus) plus.addEventListener('click', (e) => { e.stopPropagation(); setCur(clamp(getCur() + 1, 0, total)); saveCurrent(storageKey, getCur()); updateAllBars(); });
    }
    wirePlusMinus('pv-minus', 'pv-plus', () => curPV, (v) => { curPV = v; }, totPV, 'currentPV');
    wirePlusMinus('mn-minus', 'mn-plus', () => curMN, (v) => { curMN = v; }, totMN, 'currentMN');
    wirePlusMinus('sta-minus', 'sta-plus', () => curSTA, (v) => { curSTA = v; }, totSTA, 'currentSTA');

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

/* ------------------ TABS: wiring e sincronização de conteúdo ------------------ */
(function setupTabsAndDescriptionCopy() {
    const leftCard = document.querySelector('.left-card');
    const tabs = leftCard?.querySelectorAll('.tab');
    const panels = leftCard?.querySelectorAll('.tab-panel');

    if (!tabs || !panels) return;

    function setActiveTab(name) {
        tabs.forEach(t => {
            const is = t.dataset.tab === name;
            t.classList.toggle('active', is);
            t.setAttribute('aria-selected', is ? 'true' : 'false');
        });
        panels.forEach(p => p.style.display = (p.dataset.tab === name) ? 'block' : 'none');
    }

    // inicial: garantir que 'geral' esteja ativo
    setActiveTab('geral');

    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const target = tab.dataset.tab;
            // se já é a ativa, não faz alteração visual (comportamento pedido)
            const currentlyActive = tab.classList.contains('active');
            if (currentlyActive) return;
            setActiveTab(target);
        });
    });

    // garantir que a left-card mantenha o mesmo tamanho/posicao:
    // pegamos a altura atual e fixamos em px (assim trocar o conteúdo não altera o tamanho do cartão)
    try {
        const rectH = leftCard.getBoundingClientRect().height;
        // somente aplica se não for responsivo pequeno (evita cortar conteúdo em small)
        leftCard.style.height = rectH + 'px';
    } catch (e) { /* ignore */ }

    // Copiar conteúdo do storage para a tab "Descrição" (ids *_desc)
    function syncDescriptionPanelsFromStorage() {
        const historia = localStorage.getItem('characterStory') || '';
        const apariencia = localStorage.getItem('characterAppearance') || '';
        const personality = localStorage.getItem('characterPersonality') || ''; // caso queira salvar futuramente

        const hGeral = document.getElementById('char-historia');
        const aGeral = document.getElementById('char-aparencia');
        const hDesc = document.getElementById('char-historia-desc');
        const aDesc = document.getElementById('char-aparencia-desc');
        const pDesc = document.getElementById('char-personality-desc');

        if (hGeral) hGeral.textContent = historia || '—';
        if (aGeral) aGeral.textContent = apariencia || '—';

        if (hDesc) hDesc.value = historia || '—';
        if (aDesc) aDesc.value = apariencia || '—';
        if (pDesc) pDesc.value = personality || '—';

        // Add event listeners for saving (only add if not already added)
        if (hDesc && !hDesc.hasAttribute('data-listener-added')) {
            hDesc.addEventListener('input', () => localStorage.setItem('characterStory', hDesc.value));
            hDesc.setAttribute('data-listener-added', 'true');
        }
        if (aDesc && !aDesc.hasAttribute('data-listener-added')) {
            aDesc.addEventListener('input', () => localStorage.setItem('characterAppearance', aDesc.value));
            aDesc.setAttribute('data-listener-added', 'true');
        }
        if (pDesc && !pDesc.hasAttribute('data-listener-added')) {
            pDesc.addEventListener('input', () => localStorage.setItem('characterPersonality', pDesc.value));
            pDesc.setAttribute('data-listener-added', 'true');
        }
    }

    // Chamar uma vez na inicialização (se o resto do seu JS sobrescrever depois, ok)
    syncDescriptionPanelsFromStorage();

    // Também expor uma função para sincronizar manualmente
    window.syncDescriptionPanelsFromStorage = syncDescriptionPanelsFromStorage;

    // Se o usuário editar a história/aparência via outras telas e salvar no localStorage,
    // você pode chamar window.syncDescriptionPanelsFromStorage() para sincronizar os textos.
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
    window.syncDescriptionPanelsFromStorage = function() {
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
