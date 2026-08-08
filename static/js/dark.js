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
        toggle.setAttribute("aria-label", "Switch to light mode");
        toggle.setAttribute("title", "Switch to light mode");
    } else if (mode === "light") {
        darkTheme.disabled = true;
        toggle.classList.remove("fa-sun");
        toggle.classList.add("fa-moon");
        toggle.setAttribute("aria-label", "Switch to dark mode");
        toggle.setAttribute("title", "Switch to dark mode");
    }
}
