document.addEventListener("DOMContentLoaded", () => {
    const icons = document.querySelectorAll(".icon");
    const numLeft = document.querySelector(".num.left");
    const secAtributos = document.querySelector(".atributos");
    const secClasse = document.querySelector(".classe");

    let pontos = 0;
    const maxPontos = 7;
    const clickCount = {}; // contador individual por atributo

    icons.forEach(icon => {
        const nome = icon.classList[1]; // ex: tecnica, intelecto...
        clickCount[nome] = 0;

        // === Hover: move ícone e mostra contador ===
        icon.addEventListener("mouseenter", () => {
            icon.classList.add("hovered");
            const counter = document.querySelector(`.counter.${nome}`);
            counter.classList.add("visible");
        });

        icon.addEventListener("mouseleave", () => {
            icon.classList.remove("hovered");
            const counter = document.querySelector(`.counter.${nome}`);
            counter.classList.remove("visible");
        });

        // === Clique: incrementa contador e pontos gerais ===
        icon.addEventListener("click", () => {
            if (pontos < maxPontos) {
                pontos++;
                clickCount[nome]++;
                numLeft.textContent = pontos;

                const counter = document.querySelector(`.counter.${nome}`);
                counter.textContent = clickCount[nome];

                if (pontos === maxPontos) {
                    setTimeout(() => {
                        secAtributos.classList.add("hidden");
                        secClasse.classList.remove("hidden");
                    }, 800);
                }
            }
        });
    });
});
