const toggle = document.getElementById("dark-mode-toggle");
const darkTheme = document.getElementById("dark-mode-theme");

if (toggle && darkTheme) {
    toggle.addEventListener("click", () => {
        setTheme(toggle.classList.contains("fa-moon") ? "dark" : "light");
    });
}

function setTheme(mode) {
    if (!toggle || !darkTheme) return;

    localStorage.setItem("dark-mode-storage", mode);
    if (mode === "dark") {
        darkTheme.disabled = false;
        toggle.classList.remove("fa-moon");
        toggle.classList.add("fa-sun");
        toggle.setAttribute("aria-label", "切换浅色模式");
        toggle.setAttribute("title", "切换浅色模式");
    } else if (mode === "light") {
        darkTheme.disabled = true;
        toggle.classList.remove("fa-sun");
        toggle.classList.add("fa-moon");
        toggle.setAttribute("aria-label", "切换深色模式");
        toggle.setAttribute("title", "切换深色模式");
    }
}
