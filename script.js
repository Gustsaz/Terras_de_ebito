document.addEventListener("DOMContentLoaded", () => {
    // garantir estado inicial mobile para evitar flash de 4 cards
    const slotsContainer = document.querySelector('.slots');
    if (window.innerWidth <= 768 && slotsContainer) {
        slotsContainer.classList.add('mobile-init');
    }

    // helpers para elementos mobile
    const mobileHomeBtn = document.getElementById('mobile-home-btn');
    const mobileProfileBtn = document.getElementById('mobile-profile-btn');
    const mobileNavContainer = document.querySelector('.mobile-nav-buttons');

    // Função que atualiza o botão de perfil mobile (imagem se logado, ícone se não)
    const updateMobileProfile = (user) => {
        if (!mobileProfileBtn) return;
        // remove possíveis imagens/ícones antigos
        mobileProfileBtn.innerHTML = '';

        if (user && user.photoURL) {
            const img = document.createElement('img');
            img.src = user.photoURL;
            img.alt = 'Profile';
            mobileProfileBtn.appendChild(img);
        } else {
            // ícone de conta
            mobileProfileBtn.innerHTML = `<i class="fas fa-user"></i>`;
        }
    };

    // Função para iniciar login Google (reaproveita a mesma lógica do sidebar)
    const startGoogleLogin = async () => {
        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.firebaseauth, provider);
        } catch (error) {
            console.error('Error during sign in:', error);
        }
    };

    // Função para mostrar botão "Sair" próximo aos botões mobile (quando logado)
    let mobileSignoutBtn = null;
    const showMobileSignout = () => {
        // remove existente
        if (mobileSignoutBtn) {
            mobileSignoutBtn.remove();
            mobileSignoutBtn = null;
            return;
        }
        if (!mobileNavContainer) return;

        mobileSignoutBtn = document.createElement('button');
        mobileSignoutBtn.className = 'mobile-signout';
        mobileSignoutBtn.textContent = 'Sair';
        mobileSignoutBtn.style.marginTop = '8px';
        mobileSignoutBtn.style.padding = '6px 10px';
        mobileSignoutBtn.style.borderRadius = '8px';
        mobileSignoutBtn.style.border = 'none';
        mobileSignoutBtn.style.cursor = 'pointer';
        mobileSignoutBtn.style.background = 'rgba(92,34,34,0.95)';
        mobileSignoutBtn.style.color = '#efe6e2';
        mobileSignoutBtn.style.fontFamily = 'MedievalSharp, serif';
        mobileSignoutBtn.style.zIndex = 1200;

        mobileSignoutBtn.onclick = async (e) => {
            e.stopPropagation();
            try {
                await window.firebaseauth.signOut();
                // remove o botão depois do logout
                if (mobileSignoutBtn) { mobileSignoutBtn.remove(); mobileSignoutBtn = null; }
            } catch (err) {
                console.error('Erro ao deslogar', err);
            }
        };

        // fecha ao clicar fora
        const onDocClick = (ev) => {
            if (!mobileSignoutBtn.contains(ev.target) && ev.target !== mobileProfileBtn) {
                if (mobileSignoutBtn) { mobileSignoutBtn.remove(); mobileSignoutBtn = null; }
                document.removeEventListener('click', onDocClick);
            }
        };
        document.addEventListener('click', onDocClick);

        mobileNavContainer.appendChild(mobileSignoutBtn);
    };

    // Bind dos botões mobile (home sempre navega; profile dependendo do estado)
    if (mobileHomeBtn) {
        mobileHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    if (mobileProfileBtn) {
        mobileProfileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Se usuário logado — mostrar botão sair (toggle)
            const user = window.firebaseauth && window.firebaseauth.currentUser;
            if (user) {
                showMobileSignout();
            } else {
                // iniciar login Google
                startGoogleLogin();
            }
        });
    }

    // Update sidebar function (sem criar floating menu nem sidebar-toggle)
    const updateSidebar = (user) => {
        const sidebar = document.querySelector('.sidebar');

        // Monta HTML base (apenas itens principais; sem toggle e sem container flutuante)
        sidebar.innerHTML = `
            <a href="index.html" class="sidebar-home">
                <i class="fas fa-home"></i>
            </a>
        `;

        // Desktop: adiciona perfil/admin ou botão google
        if (user && user.photoURL) {
            sidebar.innerHTML += `
                <button id="admin-login" class="sidebar-admin">
                    <i class="fas fa-user-shield"></i>
                </button>
                <img src="${user.photoURL}" class="sidebar-profile" alt="Profile" />
            `;
        } else {
            sidebar.innerHTML += `
                <button id="google-login" class="sidebar-google">
                    <i class="fab fa-google"></i>
                </button>
            `;
        }

        /* ---------- BIND EVENTS (desktop) ---------- */

        // Google login — desktop
        const desktopGoogle = sidebar.querySelector('#google-login');
        if (desktopGoogle) {
            desktopGoogle.onclick = async () => {
                const provider = new window.GoogleAuthProvider();
                try {
                    await window.signInWithPopup(window.firebaseauth, provider);
                } catch (error) {
                    console.error('Error during sign in:', error);
                }
            };
        }

        // Admin login — desktop
        const adminDesktop = sidebar.querySelector('#admin-login');
        if (adminDesktop) {
            adminDesktop.onclick = () => {
                const adminModal = document.getElementById('admin-modal');
                const adminPassword = document.getElementById('admin-password');
                adminPassword.value = '';
                adminModal.style.display = 'flex';
            };
        }

        // Profile image — desktop (mostra botão sair)
        const profileDesktop = sidebar.querySelector('.sidebar-profile');
        if (profileDesktop) {
            profileDesktop.onclick = (e) => {
                e.stopPropagation();
                const existing = document.querySelector('.sidebar-sair');
                if (existing) { existing.remove(); return; }

                const sairBtn = document.createElement('button');
                sairBtn.className = 'sidebar-sair';
                sairBtn.textContent = 'Sair';
                sairBtn.onclick = async () => {
                    try {
                        await window.firebaseauth.signOut();
                        sairBtn.remove();
                    } catch (error) {
                        console.error('Error signing out:', error);
                    }
                };

                // remove ao clicar fora
                const onDocClick = (evt) => {
                    if (!sairBtn.contains(evt.target) && evt.target !== profileDesktop) {
                        sairBtn.remove();
                        document.removeEventListener('click', onDocClick);
                    }
                };
                document.addEventListener('click', onDocClick);

                sidebar.appendChild(sairBtn);
            };
        }

        /* Note: não criamos nem manipulamos .sidebar-floating nem .sidebar-toggle aqui. */
    };

    // Function to load characters from Firebase DB or localStorage
    const loadUserCharacters = async (user) => {
        if (!user) {
            showEmptySlots();
            updateVisibleSlot();
            return;
        }
        try {
            const userDocRef = window.doc(window.firestoredb, 'usuarios', user.uid);
            const userDocSnap = await window.getDoc(userDocRef);
            let characters = [];
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                characters = data.personagens || [];
                // Update with name and email from auth if missing
                if (!data.name || !data.email) {
                    await window.setDoc(userDocRef, { name: user.displayName, email: user.email }, { merge: true });
                }
            } else {
                // Create initial doc with name and email from auth
                await window.setDoc(userDocRef, { name: user.displayName, email: user.email, personagens: [] });
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
                const charImg = (characters[index].img && Array.isArray(characters[index].img) && characters[index].img.length > 0)
                    ? characters[index].img[0]
                    : `./imgs/${characters[index].classe.toLowerCase()}.png`;
                slot.innerHTML = `
                    <button class="delete-btn" data-char-id="${characters[index].uid}"><i class="fas fa-trash"></i></button>
                    <button class="edit-btn" data-char-id="${characters[index].uid}"><i class="fa-solid fa-pen"></i></button>
                    <div class="img-area">
                        <img src="${charImg}" alt="Character ${characters[index].nome}">
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
        updateVisibleSlot();
    };

    // Function to show empty slots
    const showEmptySlots = () => {
        const slots = document.querySelectorAll('.slot');
        slots.forEach(slot => {
            slot.className = 'slot empty';
            slot.innerHTML = '<i class="fas fa-plus"></i>';
            slot.onclick = () => {
                alert('Você precisa estar logado para criar um personagem.');
            };
        });
    };

    // Start with empty slots
    showEmptySlots();

    // ------------------ setas: posicionamento dinâmico ------------------
    let currentIndex = 0;
    const rightArrow = document.querySelector('.right-arrow');
    const leftArrow = document.querySelector('.left-arrow');

    function positionArrows() {
        // só no mobile precisamos fixar verticalmente
        if (window.innerWidth > 768) {
            // reset estilo (desktop)
            [leftArrow, rightArrow].forEach(a => {
                if (a) {
                    a.style.position = '';
                    a.style.top = '';
                    a.style.transform = '';
                }
            });
            return;
        }

        const slots = document.querySelectorAll('.slot');
        if (!slots || slots.length === 0) return;
        const visibleSlot = slots[currentIndex];
        if (!visibleSlot) return;
        const rect = visibleSlot.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        [leftArrow, rightArrow].forEach(a => {
            if (!a) return;
            a.style.position = 'fixed';
            a.style.top = `${centerY}px`;
            a.style.transform = 'translateY(-50%)';
            a.style.zIndex = '9999';
        });
    }

    function updateVisibleSlot() {
        if (window.innerWidth > 768) {
            // Desktop → mostrar todos
            document.querySelectorAll('.slot').forEach(s => s.style.display = "flex");
            // remover marca mobile-init se existir
            const sc = document.querySelector('.slots');
            if (sc && sc.classList.contains('mobile-init')) sc.classList.remove('mobile-init');
            // reset arrow styles
            positionArrows();
            return;
        }

        // Mobile → apenas 1 slot
        document.querySelectorAll('.slot').forEach((s, i) => {
            s.style.display = i === currentIndex ? "flex" : "none";
        });
        // depois que o JS configurou os displays, podemos remover a marca inicial
        const sc = document.querySelector('.slots');
        if (sc && sc.classList.contains('mobile-init')) {
            sc.classList.remove('mobile-init');
        }
        // posicionar setas no centro do slot visível
        positionArrows();
    }

    // arrow handlers (seguro: só adiciona se existir)
    if (rightArrow) {
        rightArrow.addEventListener('click', () => {
            const slots = document.querySelectorAll('.slot');
            if (currentIndex < slots.length - 1) currentIndex++;
            updateVisibleSlot();
        });
    }

    if (leftArrow) {
        leftArrow.addEventListener('click', () => {
            if (currentIndex > 0) currentIndex--;
            updateVisibleSlot();
        });
    }

    // atualizar ao redimensionar (desktop <-> mobile) e reposicionar setas
    window.addEventListener('resize', () => {
        // manter currentIndex válido
        const slots = document.querySelectorAll('.slot');
        if (currentIndex >= slots.length) currentIndex = Math.max(0, slots.length - 1);
        updateVisibleSlot();
    });

    // Auth observer to load characters
    window.onAuthStateChanged(window.firebaseauth, (user) => {
        updateSidebar(user);
        loadUserCharacters(user);
        updateMobileProfile(user); // atualiza o botão mobile de perfil
        if (user) {
            localStorage.setItem('userLoggedIn', 'true');
        } else {
            localStorage.removeItem('userLoggedIn');
            // se deslogou, remova o botão sair mobile se existir
            if (mobileSignoutBtn) { mobileSignoutBtn.remove(); mobileSignoutBtn = null; }
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

    // Admin modal events
    const adminModal = document.getElementById('admin-modal');
    const adminConfirm = document.getElementById('admin-confirm');
    const adminCancel = document.getElementById('admin-cancel');
    const adminPassword = document.getElementById('admin-password');

    adminCancel.addEventListener('click', () => {
        adminModal.style.display = 'none';
    });

    adminConfirm.addEventListener('click', () => {
        const password = adminPassword.value;
        if (password === 'ebitoMarkao234@') {
            window.location.href = 'adm.html';
        } else {
            alert('Senha incorreta.');
        }
    });

    // garantir posicionamento inicial das setas ao carregar (se houver slots)
    setTimeout(() => {
        updateVisibleSlot();
    }, 120); // leve delay para garantir que animações/DOM estejam prontos
});
