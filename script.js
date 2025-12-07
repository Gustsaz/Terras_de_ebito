document.addEventListener("DOMContentLoaded", () => {
    // Google login functionality - removed since in sidebar

    // Update sidebar function
    const updateSidebar = (user) => {
        const sidebar = document.querySelector('.sidebar');
        if (user && user.photoURL) {
            sidebar.innerHTML = `
                <a href="index.html" class="sidebar-home">
                    <i class="fas fa-home"></i>
                </a>
                <img src="${user.photoURL}" class="sidebar-profile" alt="Profile" />
            `;
        } else {
            sidebar.innerHTML = `
                <a href="index.html" class="sidebar-home">
                    <i class="fas fa-home"></i>
                </a>
                <button id="google-login" class="sidebar-google">
                    <i class="fab fa-google"></i>
                </button>
            `;
            // Add login event
            document.getElementById('google-login').addEventListener('click', async () => {
                const provider = new window.GoogleAuthProvider();
                try {
                    await window.signInWithPopup(window.firebaseauth, provider);
                } catch (error) {
                    console.error('Error during sign in:', error);
                }
            });
        }
    }

    // Function to load characters from Firebase DB or localStorage
    const loadUserCharacters = async (user) => {
        if (!user) {
            showEmptySlots();
            return;
        }
        try {
            const userDocRef = window.doc(window.firestoredb, 'usuarios', user.uid);
            const userDocSnap = await window.getDoc(userDocRef);
            let characters = [];
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
            characters = data.personnages || [];
            }
            displayCharacters(characters);
        } catch (error) {
            console.warn('Failed to load from Firebase, using localStorage', error);
            const localChars = JSON.parse(localStorage.getItem('characters')) || [];
            displayCharacters(localChars);
        }
    };

            // Function to display characters in slots
    const displayCharacters = (characters) => {
        const slots = document.querySelectorAll('.slot');
        slots.forEach((slot, index) => {
            // Clear any existing innerHTML and events
            slot.innerHTML = '';
            slot.onclick = null;
            slot.className = 'slot';
            if (characters[index]) {
                slot.classList.add('filled');
                slot.innerHTML = `
                    <button class="delete-btn" data-char-id="${characters[index].uid}"><i class="fas fa-trash"></i></button>
                    <button class="edit-btn" data-char-id="${characters[index].uid}"><i class="fa-solid fa-pen"></i></button>
                    <div class="img-area">
                        <img src="imgs/${characters[index].classe.toLowerCase()}.png" alt="Classe ${characters[index].classe}">
                    </div>
                    <div class="char-info">
                        <div class="char-name">${characters[index].nome}</div>
                        <div class="char-class">Classe: ${characters[index].classe}</div>
                    </div>
                `;

                // Delete button event
                const deleteBtn = slot.querySelector('.delete-btn');
                const charId = characters[index].uid;
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent slot click
                    const deleteModal = document.getElementById('delete-modal');
                    deleteModal.style.display = 'flex';
                    deleteModal.dataset.charId = charId;
                });

                // Slot click to go to personagem
                slot.addEventListener('click', () => {
                    localStorage.setItem('selectedCharId', charId);
                    window.location.href = 'personagem.html?uid=' + encodeURIComponent(charId);
                });

                // Edit button click (prevent slot click if edit clicked)
                slot.querySelector('.edit-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent slot click
                    const charId = e.target.closest('.edit-btn').dataset.charId;
                    // Store character ID for personagem page
                    localStorage.setItem('selectedCharId', charId);
                    window.location.href = 'personagem.html?uid=' + encodeURIComponent(charId);
                });
            } else {
                slot.classList.add('empty');
                slot.innerHTML = '<i class="fas fa-plus"></i>';
                slot.onclick = () => {
                    console.log('Empty slot clicked');
                    window.location.href = 'criacao_personagem.html';
                };
            }
        });
    };

    // Function to show empty slots
    const showEmptySlots = () => {
        const slots = document.querySelectorAll('.slot');
        slots.forEach(slot => {
            slot.className = 'slot empty';
            slot.innerHTML = '<i class="fas fa-plus"></i>';
            slot.onclick = () => {
                window.location.href = 'criacao_personagem.html';
            };
        });
    };

    // Start with empty slots
    showEmptySlots();

    // Auth observer to load characters
    window.onAuthStateChanged(window.firebaseauth, (user) => {
        updateSidebar(user);
        loadUserCharacters(user);
        if (user) {
            localStorage.setItem('userLoggedIn', 'true');
        } else {
            localStorage.removeItem('userLoggedIn');
        }
    });

    // Delete modal events
    const deleteModal = document.getElementById('delete-modal');
    const cancelDelete = document.getElementById('cancel-delete');
    const confirmDelete = document.getElementById('confirm-delete');

    cancelDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteModal.style.display = 'none';
    });

    confirmDelete.addEventListener('click', async (e) => {
        e.stopPropagation();
        const charId = deleteModal.dataset.charId;
        if (charId && window.firebaseauth.currentUser) {
            try {
                const userDocRef = window.doc(window.firestoredb, 'usuarios', window.firebaseauth.currentUser.uid);
                const userDocSnap = await window.getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    let characters = userDocSnap.data().personagens || [];
                    characters = characters.filter(c => c.uid !== charId);
                    await window.setDoc(userDocRef, { personagens: characters }, { merge: true });
                    // Reload characters
                    loadUserCharacters(window.firebaseauth.currentUser);
                }
            } catch (error) {
                console.warn('Failed to delete character', error);
            }
        }
        deleteModal.style.display = 'none';
    });
});
