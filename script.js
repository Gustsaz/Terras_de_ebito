document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".slot.empty").forEach(slot => {
        slot.addEventListener("click", () => {
            window.location.href = "criacao_personagem.html";
        });
    });
});
