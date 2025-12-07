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

    // Auth state observer
    window.onAuthStateChanged(window.firebaseauth, (user) => {
        updateSidebar(user);
        if (user) {
            console.log('User signed in:', user);
            localStorage.setItem('userLoggedIn', 'true');
            loadUserCharacters(user);
        } else {
            console.log('No user signed in');
            localStorage.removeItem('userLoggedIn');
            // Show all slots as empty
            showEmptySlots();
        }
    });

    // Function to load characters from localStorage
    const loadUserCharacters = (user) => {
        const characters = JSON.parse(localStorage.getItem('characters')) || [];
        displayCharacters(characters);
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
                    <button class="edit-btn" data-char-id="${characters[index].uid}"><i class="fa-solid fa-pen"></i></button>
                    <div class="img-area">
                        <img src="imgs/${characters[index].classe.toLowerCase()}.png" alt="Classe ${characters[index].classe}">
                    </div>
                    <div class="char-info">
                        <div class="char-name">${characters[index].nome}</div>
                        <div class="char-class">Classe: ${characters[index].classe}</div>
                    </div>
                `;

                // Edit button click
                slot.querySelector('.edit-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent slot click
                    const charId = e.target.closest('.edit-btn').dataset.charId;
                    // Store character ID for personagem page
                    localStorage.setItem('selectedCharId', charId);
                    window.location.href = 'personagem.html';
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
});
