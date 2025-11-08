// Tela de carregamento -> Tela principal
window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("loading-screen").classList.add("hidden");
        document.getElementById("main-screen").classList.remove("hidden");
    }, 2500);
});
