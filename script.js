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
    /****************************************************************
 * Sincroniza botão de Admin para aparecer também no mobile nav
 * - cria #mobile-admin-btn (classe mobile-nav-btn) quando em mobile
 * - remove quando em desktop
 * - evita duplicação (checa id existente)
 ****************************************************************/
    (function syncMobileAdminBtn() {
        if (!mobileNavContainer) return;

        const createMobileAdminBtn = () => {
            // se já existe, não faz nada
            if (document.getElementById('mobile-admin-btn')) return;

            const btn = document.createElement('button');
            btn.id = 'mobile-admin-btn';
            btn.type = 'button';
            btn.className = 'mobile-nav-btn';
            btn.title = 'Admin';
            btn.setAttribute('aria-label', 'Admin');
            btn.innerHTML = '<i class="fas fa-user-shield" aria-hidden="true"></i>';

            // ação: abre o mesmo modal admin do desktop
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const adminModal = document.getElementById('admin-modal');
                const adminPassword = document.getElementById('admin-password');
                if (adminPassword) adminPassword.value = '';
                if (adminModal) adminModal.style.display = 'flex';
            });

            // append ao container (pilha de botões mobile)
            mobileNavContainer.appendChild(btn);
        };

        const removeMobileAdminBtn = () => {
            const existing = document.getElementById('mobile-admin-btn');
            if (existing) existing.remove();
        };

        // decide criar/remover conforme largura atual
        const apply = () => {
            if (window.innerWidth <= 768) createMobileAdminBtn();
            else removeMobileAdminBtn();
        };

        // executa agora e também no resize (debounce leve)
        apply();
        let t = null;
        window.addEventListener('resize', () => {
            clearTimeout(t);
            t = setTimeout(apply, 120);
        });

        // proteção extra: se o container for re-renderizado por outro código,
        // tenta reaplicar após pequenas mudanças no DOM (mutation observer leve)
        const mo = new MutationObserver(() => {
            apply();
        });
        mo.observe(mobileNavContainer, { childList: true, subtree: false });
    })();


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

    // ===== startGoogleLogin (safe, prevents concurrent popups) =====
    window.__signInInProgress = window.__signInInProgress || false;

    const startGoogleLogin = async () => {
        // evita tentativas simultâneas que causam auth/cancelled-popup-request
        if (window.__signInInProgress) {
            console.warn('Login já em progresso — ignorando nova tentativa.');
            return;
        }
        window.__signInInProgress = true;

        const provider = new window.GoogleAuthProvider();
        try {
            await window.signInWithPopup(window.firebaseauth, provider);
            // sign-in bem sucedido — onAuthStateChanged do firebase tratará o estado
        } catch (error) {
            // log útil para debug (mantemos o console para ver detalhes no devtools)
            console.error('Error during sign in:', error);
        } finally {
            // libera o lock sempre
            window.__signInInProgress = false;
        }
    };

    // showSignOutConfirm: modal de confirmação reutilizável (Resolve true = confirmar, false = cancelar/fechar)
    function showSignOutConfirm(message) {
        // previne múltiplos diálogos idênticos
        if (document.querySelector('.alert-backdrop.confirm-active')) return Promise.resolve(false);

        function escapeHtml(str) {
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        return new Promise((resolve) => {
            const backdrop = document.createElement('div');
            backdrop.className = 'alert-backdrop confirm-active';
            backdrop.style.zIndex = 12000; // garante estar acima de elementos móveis

            const modal = document.createElement('div');
            modal.className = 'alert-modal confirm-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.style.position = 'relative';

            // criar conteúdo (usa classes já estilizadas)
            modal.innerHTML = `
      <div class="alert-header">Confirmar</div>
      <div class="alert-body">${escapeHtml(message)}</div>
      <div class="alert-actions">
        <button class="alert-btn cancel">Cancelar</button>
        <button class="alert-btn confirm">Confirmar</button>
      </div>
    `;

            // botão X (fechar sem confirmar)
            const closeX = document.createElement('button');
            closeX.setAttribute('aria-label', 'Fechar');
            closeX.className = 'alert-close-x';
            closeX.innerHTML = '&times;';
            Object.assign(closeX.style, {
                position: 'absolute',
                top: '8px',
                right: '10px',
                background: 'transparent',
                border: 'none',
                color: '#efe6e2',
                fontSize: '20px',
                cursor: 'pointer',
                zIndex: 1
            });

            modal.appendChild(closeX);
            backdrop.appendChild(modal);
            document.body.appendChild(backdrop);

            // anima visibilidade (se você tem .alert-backdrop.visible no CSS)
            requestAnimationFrame(() => backdrop.classList.add('visible'));

            // fechar e resolver
            function cleanup(result) {
                backdrop.classList.remove('visible');
                setTimeout(() => {
                    if (backdrop.parentElement) backdrop.parentElement.removeChild(backdrop);
                }, 260);
                document.removeEventListener('keydown', keyHandler);
                resolve(Boolean(result));
            }

            // eventos
            modal.querySelector('.alert-btn.confirm').addEventListener('click', (e) => {
                e.stopPropagation();
                cleanup(true);
            });

            modal.querySelector('.alert-btn.cancel').addEventListener('click', (e) => {
                e.stopPropagation();
                cleanup(false);
            });

            closeX.addEventListener('click', (e) => {
                e.stopPropagation();
                cleanup(false); // X fecha sem deslogar
            });

            // fechar ao clicar fora (no backdrop)
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) cleanup(false);
            });

            // ESC fecha
            function keyHandler(e) {
                if (e.key === 'Escape') cleanup(false);
            }
            document.addEventListener('keydown', keyHandler);

            // foco acessível
            const confirmBtn = modal.querySelector('.alert-btn.confirm');
            if (confirmBtn) confirmBtn.focus();
        });
    }


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
        mobileProfileBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const user = window.firebaseauth && window.firebaseauth.currentUser;

            if (user) {
                // usuário logado -> perguntar se deseja sair
                const confirmed = await showSignOutConfirm('Deseja sair da conta?');
                if (confirmed) {
                    try {
                        await window.firebaseauth.signOut();
                        // opcional: remover qualquer botão "sair" visível
                        const existingSignout = document.querySelector('.mobile-signout');
                        if (existingSignout) existingSignout.remove();
                    } catch (err) {
                        console.error('Erro ao deslogar', err);
                    }
                } else {
                    // Se cancelou/fechou, não faz nada (X e clique fora também chegam aqui)
                }
            } else {
                // não logado -> inicia login
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
            if (desktopGoogle) {
                desktopGoogle.onclick = (e) => {
                    e.stopPropagation?.();
                    startGoogleLogin();
                };
            }

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
        mobileProfileBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const user = window.firebaseauth && window.firebaseauth.currentUser;

            if (user) {
                // usuário logado -> perguntar se deseja sair
                const confirmed = await showSignOutConfirm('Deseja sair da conta?');
                if (confirmed) {
                    try {
                        await window.firebaseauth.signOut();
                        // opcional: remover qualquer botão "sair" visível
                        const existingSignout = document.querySelector('.mobile-signout');
                        if (existingSignout) existingSignout.remove();
                    } catch (err) {
                        console.error('Erro ao deslogar', err);
                    }
                } else {
                    // Se cancelou/fechou, não faz nada (X e clique fora também chegam aqui)
                }
            } else {
                // não logado -> inicia login
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

/* ---------------------------
   BOLINHAS DE FUNDO - manager
   (não interfere em nada da UI)
   --------------------------- */
(function initBackgroundBubbles() {
  const container = document.querySelector('.bg-bubbles');
  if (!container) return;

  const MAX_BUBBLES = 28;       // máximo na tela (ajuste se quiser)
  const INITIAL = 16;           // bolhas iniciais
  const SPAWN_INTERVAL = 700;   // ms entre tentativas de spawn

  function createBubble() {
    // não ultrapassar o limite
    if (container.children.length >= MAX_BUBBLES) return;

    const b = document.createElement('div');
    b.className = 'bubble';

    // tamanho aleatório (px)
    const size = Math.floor(Math.random() * 40) + 8; // 8..48
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;

    // posição horizontal aleatória
    b.style.left = `${Math.random() * 100}%`;

    // duração e atraso aleatórios (para variedade)
    const duration = (Math.random() * 14) + 6; // 6s .. 20s
    // usamos negative delay para que algumas já "estejam em andamento"
    const delay = Math.random() * 2; // 0..2s
    b.style.animation = `rise ${duration}s linear`;
    b.style.animationDelay = `${-delay}s`;

    // leve rotação aleatória (opcional)
    const rotate = (Math.random() - 0.5) * 40; // -20..20deg
    b.style.transform = `rotate(${rotate}deg)`;

    // append e remover após animação
    container.appendChild(b);
    b.addEventListener('animationend', () => {
      if (b && b.parentElement === container) container.removeChild(b);
    });
  }

  // criar um punhado inicial com pequenas diferenças de tempo
  for (let i = 0; i < INITIAL; i++) {
    setTimeout(createBubble, Math.random() * 1800);
  }

  // spawn contínuo
  setInterval(() => {
    createBubble();
  }, SPAWN_INTERVAL);

  // opcional: reduzir números quando a aba estiver em background para performance
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // quando escondido, limpe excesso para economizar memória
      while (container.children.length > 6) container.removeChild(container.firstChild);
    }
  });
})();
