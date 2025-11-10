document.addEventListener("DOMContentLoaded", () => {
  const icons = document.querySelectorAll(".icon");
  const numLeft = document.querySelector(".num.left");
  const secAtributos = document.querySelector(".atributos");
  const secClasse = document.querySelector(".classe");
  const secRaca = document.querySelector(".raca");
  const slots = document.querySelectorAll(".slot");

  let pontos = 0;
  const maxPontos = 7;
  const clickCount = {};

  icons.forEach(icon => {
    const nome = icon.classList[1];
    clickCount[nome] = 0;

    icon.addEventListener("mouseenter", () => {
      icon.classList.add("hovered");
      document.querySelector(`.counter.${nome}`).classList.add("visible");
    });

    icon.addEventListener("mouseleave", () => {
      icon.classList.remove("hovered");
      document.querySelector(`.counter.${nome}`).classList.remove("visible");
    });

    icon.addEventListener("click", () => {
      if (pontos < maxPontos) {
        pontos++;
        clickCount[nome]++;
        numLeft.textContent = pontos;
        document.querySelector(`.counter.${nome}`).textContent = clickCount[nome];

        if (pontos === maxPontos) {
          setTimeout(() => {
            secAtributos.classList.add("hidden");
            secClasse.classList.remove("hidden");
          }, 800);
        }
      }
    });
  });

  let cartaAtiva = null;

  slots.forEach(slot => {
    slot.addEventListener("click", () => {
      const isFlipped = slot.classList.contains("flipped");
      const isSelected = slot.classList.contains("selected");

      if (cartaAtiva && cartaAtiva !== slot) {
        cartaAtiva.classList.remove("flipped", "selected");
        cartaAtiva = null;
      }

      if (!isFlipped) {
        slot.classList.add("flipped");
        cartaAtiva = slot;
        return;
      }

      if (isFlipped && !isSelected) {
        slot.classList.add("selected");
        cartaAtiva = slot;
        return;
      }

      if (isFlipped && isSelected) {
        slot.classList.remove("selected");
        secClasse.classList.add("hidden");
        secRaca.classList.remove("hidden");
      }
    });
  });
});