(function () {
    const toc = document.querySelector("#article-toc #TableOfContents");
    const content = document.querySelector(".main-content");
    if (!toc || !content) return;

    const items = Array.from(toc.querySelectorAll('a[href^="#"]'))
        .map((link) => {
            let id;
            try {
                id = decodeURIComponent(link.hash.slice(1));
            } catch (_) {
                id = link.hash.slice(1);
            }

            const heading = document.getElementById(id);
            const listItem = link.closest("li");
            if (!heading || !listItem) return null;

            const progress = document.createElement("span");
            progress.className = "toc-progress";
            progress.setAttribute("aria-hidden", "true");
            link.insertBefore(progress, link.firstChild);

            link.addEventListener("click", (event) => {
                event.preventDefault();
                history.pushState(null, "", link.hash);
                heading.scrollIntoView({ behavior: "smooth", block: "start" });
            });

            return { link, heading, listItem };
        })
        .filter(Boolean);

    if (!items.length) return;

    let scheduled = false;

    function updateToc() {
        const marker = Math.min(180, window.innerHeight * 0.25);
        let activeIndex = 0;

        for (let index = 0; index < items.length; index += 1) {
            if (items[index].heading.getBoundingClientRect().top <= marker) {
                activeIndex = index;
            } else {
                break;
            }
        }

        items.forEach((item, index) => {
            const active = index === activeIndex;
            item.link.classList.toggle("toc-active", active);
            if (active) {
                item.link.setAttribute("aria-current", "location");
            } else {
                item.link.removeAttribute("aria-current");
            }
            item.listItem.classList.toggle("toc-current", active);
            item.listItem.classList.toggle("toc-read", index < activeIndex);
        });

        const activeLink = items[activeIndex].link;
        const sidebar = document.getElementById("article-toc");
        if (sidebar && window.innerWidth >= 992) {
            const linkTop = activeLink.offsetTop;
            const linkBottom = linkTop + activeLink.offsetHeight;
            if (linkTop < sidebar.scrollTop || linkBottom > sidebar.scrollTop + sidebar.clientHeight) {
                activeLink.scrollIntoView({ block: "nearest" });
            }
        }

        scheduled = false;
    }

    function scheduleUpdate() {
        if (scheduled) return;
        scheduled = true;
        window.requestAnimationFrame(updateToc);
    }

    updateToc();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
})();
