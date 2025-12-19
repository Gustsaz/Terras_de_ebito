// adm.js - Admin panel to list users and their characters

document.addEventListener("DOMContentLoaded", async () => {
    console.log('Loading adm.js');

    // Check if admin is logged in (password check, but since we came from modal with password, assume ok)
    // Load all users from 'usuarios' collection

    const usersList = document.getElementById('users-list');
    const charactersSection = document.getElementById('characters-section');
    const charactersList = document.getElementById('characters-list');
    const userNameSpan = document.getElementById('user-name');

    let currentUserId = null;

    // Function to load all users
    async function loadUsers() {
        try {
            const usuariosCol = window.collection(window.firestoredb, 'usuarios');
            const snapshot = await window.getDocs(usuariosCol);
            usersList.innerHTML = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const name = data.name || 'Nome não definido';
                const email = data.email || 'Email não definido';
                const uid = doc.id;

                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.innerHTML = `
                    <div class="user-info">
                        <h3>${name}</h3>
                        <p>Email: ${email}</p>
                        <p>UID: ${uid}</p>
                    </div>
                `;
                userItem.addEventListener('click', () => {
                    document.querySelectorAll('.user-item').forEach(it => it.classList.remove('active'));
                    userItem.classList.add('active');
                    loadUserCharacters(uid, name);
                });
                usersList.appendChild(userItem);
            });
        } catch (error) {
            console.error('Error loading users:', error);
            usersList.innerHTML = '<p>Erro ao carregar usuários.</p>';
        }
    }

    // Function to load characters of a user
    async function loadUserCharacters(uid, name) {
        currentUserId = uid;
        userNameSpan.textContent = name;
        charactersSection.style.display = 'block';

        // Hide other user active
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
        const items = usersList.querySelectorAll('.user-item');
        // Find the item with uid
        // Since we don't have uid in the item, perhaps set active based on clicked

        try {
            const docRef = window.doc(window.firestoredb, 'usuarios', uid);
            const docSnap = await window.getDoc(docRef);
            if (!docSnap.exists()) {
                charactersList.innerHTML = '<p>Usuário não encontrado.</p>';
                return;
            }
            const data = docSnap.data();
            const characters = data.personagens || [];
            charactersList.innerHTML = '';

            if (characters.length === 0) {
                charactersList.innerHTML = '<p>Nenhum personagem criado.</p>';
                return;
            }

            characters.forEach(char => {
                const imgSrc = (char.img && Array.isArray(char.img) && char.img.length > 0)
                    ? char.img[0]
                    : `./imgs/${char.classe.toLowerCase()}.png`;

                const charId = char.uid;
                const charCard = document.createElement('div');
                charCard.className = 'character-card';
                charCard.innerHTML = `
                    <img src="${imgSrc}" alt="Character ${char.nome}" onerror="this.src='./imgs/placeholder.png'">
                    <h4>${char.nome}</h4>
                    <p>Classe: ${char.classe}</p>
                    <p>Raça: ${char.raca}${char.subraca ? ` (${char.subraca})` : ''}</p>
                    <p>Nível: ${char.LVL}</p>
                `;
                charCard.addEventListener('click', () => {
                    window.location.href = 'personagemadm.html?uid=' + encodeURIComponent(charId);
                });
                charactersList.appendChild(charCard);
            });
        } catch (error) {
            console.error('Error loading characters:', error);
            charactersList.innerHTML = '<p>Erro ao carregar personagens.</p>';
        }
    }

    // Load users on load
    await loadUsers();

    // Add back button
    const backBtn = document.createElement('button');
    backBtn.className = 'back-to-users';
    backBtn.textContent = 'Voltar para Usuários';
    backBtn.addEventListener('click', () => {
        charactersSection.style.display = 'none';
        document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    });

    charactersSection.querySelector('h2').appendChild(backBtn);
});

/* helper: resolve firestore functions (uses window.* if available; otherwise dynamic import) */
async function resolveFirestoreFunctions() {
    // cache module on window to avoid multiple imports
    if (window.__FS_MODULE__) {
        const m = window.__FS_MODULE__;
        return {
            collection: m.collection || window.collection,
            getDocs: m.getDocs || window.getDocs,
            addDoc: m.addDoc || window.addDoc,
            doc: m.doc || window.doc,
            getDoc: m.getDoc || window.getDoc,
            setDoc: m.setDoc || window.setDoc,
            updateDoc: m.updateDoc || window.updateDoc,
            deleteDoc: m.deleteDoc || window.deleteDoc
        };
    }

    // prefer using existing window exports if they are functions
    const haveWindowFns = (typeof window.collection === 'function') && (typeof window.getDocs === 'function');

    if (haveWindowFns) {
        return {
            collection: window.collection,
            getDocs: window.getDocs,
            addDoc: window.addDoc,
            doc: window.doc,
            getDoc: window.getDoc,
            setDoc: window.setDoc,
            updateDoc: window.updateDoc,
            deleteDoc: window.deleteDoc
        };
    }

    // fallback: dynamic import from firebase CDN
    try {
        const mod = await import('https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js');
        window.__FS_MODULE__ = mod;
        return {
            collection: mod.collection,
            getDocs: mod.getDocs,
            addDoc: mod.addDoc,
            doc: mod.doc,
            getDoc: mod.getDoc,
            setDoc: mod.setDoc,
            updateDoc: mod.updateDoc,
            deleteDoc: mod.deleteDoc
        };
    } catch (err) {
        console.warn('resolveFirestoreFunctions: import failed, falling back to window.* (may error):', err);
        return {
            collection: window.collection,
            getDocs: window.getDocs,
            addDoc: window.addDoc,
            doc: window.doc,
            getDoc: window.getDoc,
            setDoc: window.setDoc,
            updateDoc: window.updateDoc,
            deleteDoc: window.deleteDoc
        };
    }
}

/* === CAMINHOS: list / edit / create com niveis fixos === */
(function () {
    const CAMINHOS_COLLECTION = 'caminhos'; // <- nome da coleção conforme você descreveu
    const TARGET_NIVEIS = 7; // quantidade exata de índices desejada (mude aqui se quiser outro valor)

    const openBtn = document.getElementById('open-add-caminho');
    const panel = document.getElementById('add-caminho-panel');
    const closeBtn = panel?.querySelector('.close-add-caminho');
    const form = document.getElementById('add-caminho-form');
    const niveisContainer = document.getElementById('niveis-container');
    const addNivelBtn = document.getElementById('add-nivel-btn');
    const cancelBtn = document.getElementById('cancel-add-caminho');
    const loadExampleBtn = document.getElementById('load-example-btn');

    const caminhosListEl = document.getElementById('caminhos-list');
    const novoCaminhoBtn = document.getElementById('novo-caminho-btn');
    const refreshCaminhosBtn = document.getElementById('refresh-caminhos-btn');

    if (!form) return;

    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function createNivelItem(nome = '', descricao = '') {
        const wrapper = document.createElement('div');
        wrapper.className = 'nivel-item';
        wrapper.innerHTML = `
      <div class="nivel-row">
        <div style="flex:1;">
          <label>Nome do Nível
            <input type="text" class="nivel-nome" value="${escapeHtml(nome)}" required />
          </label>
        </div>
        <button type="button" class="remove-nivel" title="Remover Nível">✕</button>
      </div>
      <label>Descrição do Nível
        <textarea class="nivel-desc" rows="3" required>${escapeHtml(descricao)}</textarea>
      </label>
    `;
        wrapper.querySelector('.remove-nivel').addEventListener('click', () => wrapper.remove());
        return wrapper;
    }

    // --- normalize niveis: garante EXACTAMENTE targetLength entradas ---
    function normalizeNiveis(inputArray, targetLength = TARGET_NIVEIS) {
        const out = [];
        // map/transform elementos válidos
        (Array.isArray(inputArray) ? inputArray : []).forEach(item => {
            if (!item) return;
            const nome = (item.nome || item.nome === '') ? item.nome : (item.nome || '');
            const descricao = item.descricao_nivel || item.descricao || '';
            out.push({ nome: String(nome), descricao_nivel: String(descricao) });
        });
        // se faltar, preenche com objetos vazios
        while (out.length < targetLength) out.push({ nome: '', descricao_nivel: '' });
        // se tiver a mais, corta
        if (out.length > targetLength) out.length = targetLength;
        return out;
    }

    // --- abrir painel modo novo ---
    function openFormForNew() {
        form.removeAttribute('data-doc-id');
        form.reset();
        niveisContainer.innerHTML = '';
        // preenche com o número exato de niveis vazios
        for (let i = 0; i < TARGET_NIVEIS; i++) niveisContainer.appendChild(createNivelItem('', ''));
        panel.style.display = 'block';
    }

    // --- abrir painel modo editar: carrega doc do firestore ---
    async function openFormForEdit(docId) {
        try {
            const fns = await resolveFirestoreFunctions();
            const docRef = fns.doc(window.firestoredb, CAMINHOS_COLLECTION, docId);
            const docSnap = await fns.getDoc(docRef);
            if (!docSnap.exists()) { alert('Documento não encontrado.'); return; }
            const data = docSnap.data();

            // preencher campos principais
            document.getElementById('c_classe').value = data.classe || '';
            document.getElementById('c_nome').value = data.nome || '';
            document.getElementById('c_descricao_geral').value = data.descricao_geral || '';
            document.getElementById('c_img').value = data.img || '';

            // preencher niveis normalizados (garantir EXACTAMENTE TARGET_NIVEIS)
            const normalized = normalizeNiveis(data.niveis || []);
            niveisContainer.innerHTML = '';
            normalized.forEach(n => niveisContainer.appendChild(createNivelItem(n.nome, n.descricao_nivel)));

            // marcar doc id no form (usado no submit)
            form.setAttribute('data-doc-id', docId);
            panel.style.display = 'block';
        } catch (err) {
            console.error('Erro ao carregar documento para edição:', err);
            alert('Erro ao carregar dados do documento (veja console).');
        }
    }

    // --- render lista de caminhos ---
    async function loadCaminhos() {
        try {
            caminhosListEl.innerHTML = '<p>Carregando...</p>';
            const fns = await resolveFirestoreFunctions();
            const colRef = fns.collection(window.firestoredb, CAMINHOS_COLLECTION);
            const snap = await fns.getDocs(colRef);
            caminhosListEl.innerHTML = '';

            if (!snap || snap.size === 0) {
                caminhosListEl.innerHTML = '<p>Nenhum caminho cadastrado.</p>';
                return;
            }

            snap.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                const card = document.createElement('div');
                card.className = 'caminho-card';
                card.innerHTML = `
          <h4>${data.nome || 'Sem nome'}</h4>
          <p><strong>Classe:</strong> ${data.classe || '-'}</p>
          <p>${(data.descricao_geral || '').slice(0, 120)}${(data.descricao_geral && data.descricao_geral.length > 120) ? '...' : ''}</p>
          <div class="card-actions">
            <button data-edit-id="${id}" class="edit-caminho-btn">Editar</button>
            <button data-delete-id="${id}" class="del-caminho-btn">Excluir</button>
          </div>
        `;
                caminhosListEl.appendChild(card);
            });

            // delegação de eventos (editar/excluir)
            caminhosListEl.querySelectorAll('.edit-caminho-btn').forEach(btn => {
                btn.addEventListener('click', () => openFormForEdit(btn.dataset.editId));
            });
            caminhosListEl.querySelectorAll('.del-caminho-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.deleteId;
                    if (!confirm('Confirma excluir este caminho?')) return;
                    try {
                        const fns = await resolveFirestoreFunctions();
                        const docRef = fns.doc(window.firestoredb, CAMINHOS_COLLECTION, id);
                        if (typeof fns.deleteDoc === 'function') {
                            await fns.deleteDoc(docRef);
                        } else if (typeof window.deleteDoc === 'function') {
                            await window.deleteDoc(docRef);
                        } else if (typeof fns.setDoc === 'function') {
                            await fns.setDoc(docRef, { _deleted: true }, { merge: true });
                        }
                        alert('Excluído.');
                        loadCaminhos();
                    } catch (err) {
                        console.error('Erro excluindo:', err);
                        alert('Erro ao excluir (veja console).');
                    }
                });
            });

        } catch (err) {
            console.error('Erro ao carregar caminhos:', err);
            caminhosListEl.innerHTML = '<p>Erro ao carregar caminhos.</p>';
        }
    }

    // --- inicializações e eventos ---
    novoCaminhoBtn?.addEventListener('click', openFormForNew);
    refreshCaminhosBtn?.addEventListener('click', loadCaminhos);

    openBtn?.addEventListener('click', openFormForNew); // botão existente também abre novo
    closeBtn?.addEventListener('click', () => panel.style.display = 'none');
    cancelBtn?.addEventListener('click', () => panel.style.display = 'none');

    addNivelBtn?.addEventListener('click', () => niveisContainer.appendChild(createNivelItem('', '')));

    loadExampleBtn?.addEventListener('click', () => {
        // exemplo: preenche (você pode ajustar esse array de exemplo)
        document.getElementById('c_classe').value = 'Arcanista';
        document.getElementById('c_nome').value = 'Conjurador Elemental';
        document.getElementById('c_descricao_geral').value = 'O Conjurador Elemental domina os quatro pilares do mundo físico Fogo, Água, Ar e Terra e os canaliza como extensão do próprio corpo. É o poder bruto da natureza moldado pela mente.';
        document.getElementById('c_img').value = './imgs/Conjurador_elemental.png';

        const niveisEx = [
            { nome: 'Fonte elementar', descricao: '...' },
            { nome: 'Fonte elementar I', descricao: '...' },
            { nome: 'Fonte elementar II', descricao: '...' },
            { nome: 'Fonte elementar III', descricao: '...' },
            { nome: 'Fonte elementar IV', descricao: '...' },
            { nome: 'Fonte elementar V', descricao: '...' }
        ];
        niveisContainer.innerHTML = '';
        niveisEx.forEach(n => niveisContainer.appendChild(createNivelItem(n.nome, n.descricao)));
    });

    // --- form submit: cria ou atualiza documento garantindo niveis com TARGET_NIVEIS ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const classe = document.getElementById('c_classe').value.trim();
            const nome = document.getElementById('c_nome').value.trim();
            const descricao_geral = document.getElementById('c_descricao_geral').value.trim();
            const img = document.getElementById('c_img').value.trim() || './imgs/placeholder.png';

            // montar array niveis a partir do DOM
            const niveisNodes = Array.from(niveisContainer.querySelectorAll('.nivel-item'));
            const niveisRaw = niveisNodes.map(node => {
                return {
                    nome: (node.querySelector('.nivel-nome').value || '').trim(),
                    descricao_nivel: (node.querySelector('.nivel-desc').value || '').trim()
                };
            });

            // normaliza p/ TARGET_NIVEIS
            const niveis = normalizeNiveis(niveisRaw, TARGET_NIVEIS);

            // validações mínimas
            if (!classe || !nome || !descricao_geral) {
                alert('Preencha: classe, nome e descrição geral.');
                return;
            }

            const payload = { classe, nome, descricao_geral, img, niveis };

            const docId = form.getAttribute('data-doc-id');
            const fns = await resolveFirestoreFunctions();
            if (docId) {
                // atualizar documento existente
                const docRef = fns.doc(window.firestoredb, CAMINHOS_COLLECTION, docId);
                try {
                    if (typeof fns.setDoc === 'function') {
                        await fns.setDoc(docRef, payload, { merge: true });
                    } else if (typeof fns.updateDoc === 'function') {
                        await fns.updateDoc(docRef, payload);
                    } else {
                        console.warn('Nenhuma função setDoc/updateDoc disponível, usando addDoc fallback.');
                        await fns.addDoc(fns.collection(window.firestoredb, CAMINHOS_COLLECTION), payload);
                    }
                    alert('Caminho atualizado com sucesso.');
                } catch (err) {
                    console.error('Erro ao atualizar doc:', err);
                    alert('Erro ao atualizar (veja console).');
                }
            } else {
                // criar novo documento
                try {
                    await fns.addDoc(fns.collection(window.firestoredb, CAMINHOS_COLLECTION), payload);
                    alert('Caminho criado com sucesso.');
                } catch (err) {
                    console.error('Erro ao criar caminho:', err);
                    alert('Erro ao criar caminho (veja console).');
                }
            }

            // limpar UI
            form.reset();
            niveisContainer.innerHTML = '';
            for (let i = 0; i < TARGET_NIVEIS; i++) niveisContainer.appendChild(createNivelItem('', ''));
            panel.style.display = 'none';
            // recarregar lista
            loadCaminhos();
        } catch (err) {
            console.error('Erro no submit do caminho:', err);
            alert('Erro inesperado (veja console).');
        }
    });

    // carrega lista inicialmente
    loadCaminhos();
})();

/* === CONDIÇÕES: list / edit / create === */
(function () {
    const CONDICOES_COLLECTION = 'condicoes';

    const openBtn = document.getElementById('open-add-condicao');
    const panel = document.getElementById('add-condicao-panel');
    const closeBtn = panel?.querySelector('.close-add-condicao');
    const form = document.getElementById('add-condicao-form');

    const condicoesListEl = document.getElementById('condicoes-list');
    const novoCondBtn = document.getElementById('novo-condicao-btn');
    const refreshCondBtn = document.getElementById('refresh-condicoes-btn');
    const cancelBtn = document.getElementById('cancel-add-condicao');

    if (!form) return;

    // --- color picker sync (local à UI de Condições) ---
    const colorInput = document.getElementById('cond_cor');
    const colorHexInput = document.getElementById('cond_cor_hex');

    if (colorInput) {
        colorInput.addEventListener('input', () => {
            if (colorHexInput) colorHexInput.value = colorInput.value.toUpperCase();
        });
        if (colorHexInput && colorInput.value) colorHexInput.value = colorInput.value.toUpperCase();
    }

    // helpers
    function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    async function loadCondicoes() {
        try {
            condicoesListEl.innerHTML = '<p>Carregando...</p>';
            const fns = await resolveFirestoreFunctions();
            const colRef = fns.collection(window.firestoredb, CONDICOES_COLLECTION);
            const snap = await fns.getDocs(colRef);
            condicoesListEl.innerHTML = '';

            if (!snap || snap.size === 0) {
                condicoesListEl.innerHTML = '<p>Nenhuma condição cadastrada.</p>';
                return;
            }

            snap.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                const card = document.createElement('div');
                card.className = 'condicao-card';
                const badgeStyle = data.cor ? `style="background:${escapeHtml(data.cor)}"` : '';
                card.innerHTML = `
          <h4>${escapeHtml(data.nome || 'Sem nome')}</h4>
          <p><span class="cond-badge" ${badgeStyle}>${escapeHtml(data.tipo || '')}</span></p>
          <p>${escapeHtml((data.descricao || '').slice(0, 120))}${(data.descricao && data.descricao.length > 120) ? '...' : ''}</p>
          <p><strong>Duração:</strong> ${escapeHtml(data.duracao || '')}</p>
          <p><strong>Efeito:</strong> ${escapeHtml(data.efeito || '')}</p>
          <div class="card-actions">
            <button data-edit-id="${id}" class="edit-cond-btn">Editar</button>
            <button data-delete-id="${id}" class="del-cond-btn">Excluir</button>
          </div>
        `;
                condicoesListEl.appendChild(card);
            });

            condicoesListEl.querySelectorAll('.edit-cond-btn').forEach(btn => {
                btn.addEventListener('click', () => openFormForEdit(btn.dataset.editId));
            });
            condicoesListEl.querySelectorAll('.del-cond-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.deleteId;
                    if (!confirm('Confirma excluir esta condição?')) return;
                    try {
                        const fns = await resolveFirestoreFunctions();
                        const docRef = fns.doc(window.firestoredb, CONDICOES_COLLECTION, id);
                        if (typeof fns.deleteDoc === 'function') await fns.deleteDoc(docRef);
                        else if (typeof window.deleteDoc === 'function') await window.deleteDoc(docRef);
                        else await fns.setDoc(docRef, { _deleted: true }, { merge: true });
                        alert('Excluído.');
                        loadCondicoes();
                    } catch (err) {
                        console.error('Erro excluindo condicao:', err);
                        alert('Erro ao excluir (veja console).');
                    }
                });
            });

        } catch (err) {
            console.error('Erro ao carregar condicoes:', err);
            condicoesListEl.innerHTML = '<p>Erro ao carregar condições.</p>';
        }
    }

    function openFormForNew() {
        form.removeAttribute('data-doc-id');
        form.reset();
        // valores exemplo (pode remover)
        if (colorInput) colorInput.value = '#696565';
        if (colorHexInput) colorHexInput.value = '#696565';
        document.getElementById('cond_tipo').value = 'positiva';
        document.getElementById('cond_duracao').value = '1d4 turnos.';
        document.getElementById('cond_efeito').value = '+1 a +3 Defesa ou -25% a -50% de dano recebido.';
        document.getElementById('cond_descricao').value = 'Energia mágica protege o corpo.';
        panel.style.display = 'block';
    }

    async function openFormForEdit(docId) {
        try {
            const fns = await resolveFirestoreFunctions();
            const docRef = fns.doc(window.firestoredb, CONDICOES_COLLECTION, docId);
            const snap = await fns.getDoc(docRef);
            if (!snap.exists()) { alert('Documento não encontrado.'); return; }
            const data = snap.data();
            document.getElementById('cond_nome').value = data.nome || '';
            document.getElementById('cond_tipo').value = data.tipo || '';
            if (colorInput) colorInput.value = (data.cor && data.cor !== '') ? data.cor : '#696565';
            if (colorHexInput) colorHexInput.value = (data.cor && data.cor !== '') ? data.cor : '#696565';
            document.getElementById('cond_duracao').value = data.duracao || '';
            document.getElementById('cond_efeito').value = data.efeito || '';
            document.getElementById('cond_descricao').value = data.descricao || '';
            form.setAttribute('data-doc-id', docId);
            panel.style.display = 'block';
        } catch (err) {
            console.error('Erro ao abrir condicao para editar:', err);
            alert('Erro ao carregar condição.');
        }
    }

    // eventos
    novoCondBtn?.addEventListener('click', openFormForNew);
    refreshCondBtn?.addEventListener('click', loadCondicoes);
    openBtn?.addEventListener('click', openFormForNew);
    closeBtn?.addEventListener('click', () => panel.style.display = 'none');
    cancelBtn?.addEventListener('click', () => panel.style.display = 'none');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const nome = document.getElementById('cond_nome').value.trim();
            const tipo = document.getElementById('cond_tipo').value.trim();
            const cor = document.getElementById('cond_cor').value.trim();
            const duracao = document.getElementById('cond_duracao').value.trim();
            const efeito = document.getElementById('cond_efeito').value.trim();
            const descricao = document.getElementById('cond_descricao').value.trim();

            if (!nome) { alert('Preencha ao menos o nome.'); return; }

            const payload = { nome, tipo, cor, duracao, efeito, descricao };

            const docId = form.getAttribute('data-doc-id');
            const fns = await resolveFirestoreFunctions();
            if (docId) {
                const docRef = fns.doc(window.firestoredb, CONDICOES_COLLECTION, docId);
                if (typeof fns.setDoc === 'function') await fns.setDoc(docRef, payload, { merge: true });
                else if (typeof fns.updateDoc === 'function') await fns.updateDoc(docRef, payload);
                else await fns.addDoc(fns.collection(window.firestoredb, CONDICOES_COLLECTION), payload);
                alert('Condição atualizada.');
            } else {
                await fns.addDoc(fns.collection(window.firestoredb, CONDICOES_COLLECTION), payload);
                alert('Condição criada.');
            }

            form.reset();
            panel.style.display = 'none';
            loadCondicoes();
        } catch (err) {
            console.error('Erro ao salvar condicao:', err);
            alert('Erro ao salvar condição (veja console).');
        }
    });

    // inicial
    loadCondicoes();
})();

/* === ITENS: list / edit / create / delete + Histórico por campo === */
(function () {
    const ITENS_COLLECTION = 'itens';

    const openBtn = document.getElementById('open-add-item');
    const panel = document.getElementById('add-item-panel');
    const closeBtn = panel?.querySelector('.close-add-item');
    const form = document.getElementById('add-item-form');

    const itensListEl = document.getElementById('itens-list');
    const novoItemBtn = document.getElementById('novo-item-btn');
    const refreshItensBtn = document.getElementById('refresh-itens-btn');
    const cancelBtn = document.getElementById('cancel-add-item');

    if (!form) return;

    /* ===== Histórico inline para campos categoria / tipo_item / tipo_dano ===== */
    const _historyCache = {}; // cache por campo

    async function fetchHistoryValues(field) {
        if (_historyCache[field]) return _historyCache[field];
        try {
            const fns = await resolveFirestoreFunctions();
            const colRef = fns.collection(window.firestoredb, ITENS_COLLECTION);
            const snap = await fns.getDocs(colRef);
            const set = new Set();
            snap.forEach(doc => {
                const val = doc.data()[field];
                if (val !== undefined && val !== null) {
                    const s = String(val).trim();
                    if (s) set.add(s);
                }
            });
            const arr = Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
            _historyCache[field] = arr;
            return arr;
        } catch (err) {
            console.error('fetchHistoryValues error', err);
            return [];
        }
    }

    function buildHistoryDropdown(field, targetDropdown, items) {
        targetDropdown.innerHTML = '';
        if (!items || items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'history-item';
            empty.textContent = 'Nenhum histórico';
            targetDropdown.appendChild(empty);
        } else {
            items.forEach(val => {
                const it = document.createElement('div');
                it.className = 'history-item';
                it.tabIndex = 0;
                it.textContent = val;
                it.addEventListener('click', () => {
                    const input = document.getElementById('item_' + field);
                    if (input) input.value = val;
                    hideAllDropdowns();
                    input.focus();
                });
                it.addEventListener('keydown', (e) => { if (e.key === 'Enter') it.click(); });
                targetDropdown.appendChild(it);
            });
        }

        const footer = document.createElement('div');
        footer.className = 'history-footer';
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Limpar';
        clearBtn.addEventListener('click', () => {
            const input = document.getElementById('item_' + field);
            if (input) input.value = '';
            hideAllDropdowns();
            input.focus();
        });
        const closeBtnF = document.createElement('button');
        closeBtnF.type = 'button';
        closeBtnF.textContent = 'Fechar';
        closeBtnF.addEventListener('click', hideAllDropdowns);
        footer.appendChild(clearBtn);
        footer.appendChild(closeBtnF);
        targetDropdown.appendChild(footer);
    }

    function hideAllDropdowns() {
        panel.querySelectorAll('.history-dropdown').forEach(d => d.setAttribute('hidden', ''));
    }

    function toggleDropdownFor(button) {
        const field = button.dataset.field;
        const dropdown = panel.querySelector(`.history-dropdown[data-field="${field}"]`);
        if (!dropdown) return;
        const isHidden = dropdown.hasAttribute('hidden');
        hideAllDropdowns();
        if (isHidden) {
            fetchHistoryValues(field).then(items => {
                buildHistoryDropdown(field, dropdown, items);
                dropdown.removeAttribute('hidden');
                dropdown.scrollIntoView({ block: 'nearest' });
            }).catch(err => {
                console.error('Erro ao popular histórico', err);
                dropdown.removeAttribute('hidden');
            });
        } else {
            dropdown.setAttribute('hidden', '');
        }
    }

    // Delegation: opened only within the item panel
    function attachHistoryButtonsHandlers() {
        // scope aos botões dentro do panel (evita conflitos)
        const buttons = panel.querySelectorAll('.history-btn');
        buttons.forEach(btn => {
            // avoid duplicate listeners
            btn.removeEventListener('click', btn._historyClickHandler);
            const handler = (e) => {
                e.stopPropagation();
                toggleDropdownFor(btn);
            };
            btn._historyClickHandler = handler;
            btn.addEventListener('click', handler);
        });

        // click fora fecha (apenas quando o panel está aberto)
        document.addEventListener('click', function _outsideClick(e) {
            if (!panel || panel.style.display === 'none') return;
            const isBtn = e.target.closest && e.target.closest('.history-btn');
            const isDropdown = e.target.closest && e.target.closest('.history-dropdown');
            if (!isBtn && !isDropdown) hideAllDropdowns();
        });
    }

    async function refreshHistoryCacheForFields(fields = ['categoria', 'tipo_item', 'tipo_dano']) {
        try {
            for (const f of fields) {
                _historyCache[f] = null; // invalida
                await fetchHistoryValues(f);
            }
        } catch (e) { /* silent */ }
    }

    /* ===== fim do histórico ===== */

    function escapeHtml(s) { if (!s) return ''; return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

    async function loadItens() {
        try {
            itensListEl.innerHTML = '<p>Carregando...</p>';
            const fns = await resolveFirestoreFunctions();
            const colRef = fns.collection(window.firestoredb, ITENS_COLLECTION);
            const snap = await fns.getDocs(colRef);
            itensListEl.innerHTML = '';

            if (!snap || snap.size === 0) {
                itensListEl.innerHTML = '<p>Nenhum item cadastrado.</p>';
                return;
            }

            snap.forEach(doc => {
                const data = doc.data();
                const id = doc.id;
                const card = document.createElement('div');
                card.className = 'item-card';
                card.innerHTML = `
          <h4>${escapeHtml(data.nome || 'Sem nome')}</h4>
          <p><strong>Categoria:</strong> ${escapeHtml(data.categoria || data.tipo_item || '-')}</p>
          <p>${escapeHtml((data.descricao || '').slice(0, 120))}${(data.descricao && data.descricao.length > 120) ? '...' : ''}</p>
          <p><strong>Peso:</strong> ${typeof data.peso === 'number' ? data.peso : '—'}</p>
          <div class="card-actions">
            <button data-edit-id="${id}" class="edit-item-btn">Editar</button>
            <button data-delete-id="${id}" class="del-item-btn">Excluir</button>
          </div>
        `;
                itensListEl.appendChild(card);
            });

            // bind events
            itensListEl.querySelectorAll('.edit-item-btn').forEach(btn => {
                btn.addEventListener('click', () => openFormForEdit(btn.dataset.editId));
            });
            itensListEl.querySelectorAll('.del-item-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.deleteId;
                    if (!confirm('Confirma excluir este item?')) return;
                    try {
                        const fns = await resolveFirestoreFunctions();
                        const docRef = fns.doc(window.firestoredb, ITENS_COLLECTION, id);
                        if (typeof fns.deleteDoc === 'function') await fns.deleteDoc(docRef);
                        else if (typeof window.deleteDoc === 'function') await window.deleteDoc(docRef);
                        else await fns.setDoc(docRef, { _deleted: true }, { merge: true });
                        alert('Excluído.');
                        loadItens();
                        refreshHistoryCacheForFields(); // atualizar histórico pois item removido pode afetar lista
                    } catch (err) {
                        console.error('Erro excluindo item:', err);
                        alert('Erro ao excluir (veja console).');
                    }
                });
            });

        } catch (err) {
            console.error('Erro ao carregar itens:', err);
            itensListEl.innerHTML = '<p>Erro ao carregar itens.</p>';
        }
    }

    function openFormForNew() {
        form.removeAttribute('data-doc-id');
        form.reset();
        // valores padrão
        document.getElementById('item_categoria').value = 'Utilitário';
        document.getElementById('item_tipo_item').value = 'Utilitário';
        document.getElementById('item_dano').value = 'Nenhum';
        document.getElementById('item_tipo_dano').value = 'Nenhum';
        document.getElementById('item_critico').value = 'Nenhum';
        document.getElementById('item_habilidade').value = 'Nenhum';
        document.getElementById('item_peso').value = 1;
        panel.style.display = 'block';

        // attach history handlers now that panel is visible
        attachHistoryButtonsHandlers();
    }

    async function openFormForEdit(docId) {
        try {
            const fns = await resolveFirestoreFunctions();
            const docRef = fns.doc(window.firestoredb, ITENS_COLLECTION, docId);
            const snap = await fns.getDoc(docRef);
            if (!snap.exists()) { alert('Documento não encontrado.'); return; }
            const data = snap.data();

            document.getElementById('item_nome').value = data.nome || '';
            document.getElementById('item_categoria').value = data.categoria || '';
            document.getElementById('item_tipo_item').value = data.tipo_item || '';
            document.getElementById('item_descricao').value = data.descricao || '';
            document.getElementById('item_efeito').value = data.efeito || '';
            document.getElementById('item_dano').value = data.dano || '';
            document.getElementById('item_tipo_dano').value = data.tipo_dano || '';
            document.getElementById('item_critico').value = data.critico || '';
            document.getElementById('item_habilidade').value = data.habilidade || '';
            document.getElementById('item_requisito').value = data.requisito || '';
            document.getElementById('item_peso').value = (typeof data.peso === 'number') ? data.peso : 0;

            form.setAttribute('data-doc-id', docId);
            panel.style.display = 'block';

            // attach handlers
            attachHistoryButtonsHandlers();
        } catch (err) {
            console.error('Erro ao abrir item para editar:', err);
            alert('Erro ao carregar item.');
        }
    }

    // eventos / bindings
    novoItemBtn?.addEventListener('click', openFormForNew);
    refreshItensBtn?.addEventListener('click', () => { loadItens(); refreshHistoryCacheForFields(); });
    openBtn?.addEventListener('click', openFormForNew);
    closeBtn?.addEventListener('click', () => panel.style.display = 'none');
    cancelBtn?.addEventListener('click', () => panel.style.display = 'none');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const nome = document.getElementById('item_nome').value.trim();
            const categoria = document.getElementById('item_categoria').value.trim();
            const tipo_item = document.getElementById('item_tipo_item').value.trim();
            const descricao = document.getElementById('item_descricao').value.trim();
            const efeito = document.getElementById('item_efeito').value.trim();
            const dano = document.getElementById('item_dano').value.trim();
            const tipo_dano = document.getElementById('item_tipo_dano').value.trim();
            const critico = document.getElementById('item_critico').value.trim();
            const habilidade = document.getElementById('item_habilidade').value.trim();
            const requisito = document.getElementById('item_requisito').value.trim();
            const peso = Number(document.getElementById('item_peso').value) || 0;

            if (!nome) { alert('Nome é obrigatório.'); return; }

            const payload = { nome, categoria, tipo_item, descricao, efeito, dano, tipo_dano, critico, habilidade, requisito, peso };

            const docId = form.getAttribute('data-doc-id');
            const fns = await resolveFirestoreFunctions();
            if (docId) {
                const docRef = fns.doc(window.firestoredb, ITENS_COLLECTION, docId);
                if (typeof fns.setDoc === 'function') await fns.setDoc(docRef, payload, { merge: true });
                else if (typeof fns.updateDoc === 'function') await fns.updateDoc(docRef, payload);
                else await fns.addDoc(fns.collection(window.firestoredb, ITENS_COLLECTION), payload);
                alert('Item atualizado.');
                await refreshHistoryCacheForFields(); // atualiza histórico com possíveis novos valores
            } else {
                await fns.addDoc(fns.collection(window.firestoredb, ITENS_COLLECTION), payload);
                alert('Item criado.');
                await refreshHistoryCacheForFields(); // atualiza histórico com possíveis novos valores
            }

            form.reset();
            panel.style.display = 'none';
            loadItens();
        } catch (err) {
            console.error('Erro ao salvar item:', err);
            alert('Erro ao salvar item (veja console).');
        }
    });

    // inicial
    loadItens();
    // também carrega cache inicial do histórico já na inicialização (opcional)
    refreshHistoryCacheForFields();
})();

