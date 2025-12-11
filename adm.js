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
