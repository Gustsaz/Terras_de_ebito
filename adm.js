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

    // --- helpers UI existentes (reaproveito createNivelItem / escapeHtml) ---
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
            const docRef = window.doc(window.firestoredb, CAMINHOS_COLLECTION, docId);
            const docSnap = await window.getDoc(docRef);
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
            const colRef = window.collection(window.firestoredb, CAMINHOS_COLLECTION);
            const snap = await window.getDocs(colRef);
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
                        const docRef = window.doc(window.firestoredb, CAMINHOS_COLLECTION, id);
                        if (window.deleteDoc) {
                            await window.deleteDoc(docRef);
                        } else {
                            // fallback: set com flag (se preferir ajuste)
                            await window.setDoc(docRef, { _deleted: true }, { merge: true });
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
            if (docId) {
                // atualizar documento existente
                const docRef = window.doc(window.firestoredb, CAMINHOS_COLLECTION, docId);
                try {
                    if (window.setDoc) {
                        await window.setDoc(docRef, payload, { merge: true });
                    } else if (window.updateDoc) {
                        await window.updateDoc(docRef, payload);
                    } else {
                        // fallback: sobrescrever com set via addDoc (não ideal), log
                        console.warn('Nenhuma função setDoc/updateDoc disponível, usando addDoc fallback.');
                        await window.addDoc(window.collection(window.firestoredb, CAMINHOS_COLLECTION), payload);
                    }
                    alert('Caminho atualizado com sucesso.');
                } catch (err) {
                    console.error('Erro ao atualizar doc:', err);
                    alert('Erro ao atualizar (veja console).');
                }
            } else {
                // criar novo documento
                try {
                    await window.addDoc(window.collection(window.firestoredb, CAMINHOS_COLLECTION), payload);
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
