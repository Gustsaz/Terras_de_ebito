window.addEventListener("load", () => {
    setTimeout(() => {
        document.getElementById("loading-screen").classList.add("hidden");
        document.getElementById("main-screen").classList.remove("hidden");
    }, 2500);
});

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".slot.empty").forEach(slot => {
        slot.addEventListener("click", () => {
            window.location.href = "criacao_personagem.html";
        });
    });
});