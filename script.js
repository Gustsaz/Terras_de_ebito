// Tela de carregamento -> Tela principal
window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("loading-screen").classList.add("hidden");
        document.getElementById("main-screen").classList.remove("hidden");
    }, 2500);
});

// Redireciona para criação de personagem ao clicar em slot vazio
document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".slot.empty").forEach(slot => {
        slot.addEventListener("click", () => {
            window.location.href = "criacao_personagem.html";
        });
    });
});
