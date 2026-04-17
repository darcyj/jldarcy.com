const state = {
  publications: [],
  filtered: []
};

const THEME_STORAGE_KEY = "jld-theme";

function applyTheme(themeName) {
  const theme = themeName === "monokai" ? "monokai" : "light";
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);

  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.checked = theme === "monokai";
  }

  const status = document.getElementById("theme-mode-label");
  if (status) {
    status.textContent = theme === "monokai" ? "Monokai (dark)" : "Blinding Mode";
  }
}

function setupThemeToggle() {
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) {
    return;
  }

  let storedTheme = "";
  try {
    storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "";
  } catch (error) {
    storedTheme = "";
  }

  const presetTheme = document.documentElement.getAttribute("data-theme") || "";
  const initialTheme = storedTheme === "monokai" || storedTheme === "light"
    ? storedTheme
    : (presetTheme === "monokai" || presetTheme === "light" ? presetTheme : "monokai");
  applyTheme(initialTheme);

  toggle.addEventListener("change", () => {
    const nextTheme = toggle.checked ? "monokai" : "light";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (error) {
    }
  });
}

function setupNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  const links = nav.querySelectorAll("a");

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("open");
  });

  links.forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

function setupProgress() {
  const bar = document.querySelector(".scroll-progress");
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = `${pct}%`;
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
}

function setupReveals() {
  const items = document.querySelectorAll(".reveal");
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const revealOptions = isMobile
    ? {
        threshold: 0,
        rootMargin: "0px 0px 35% 0px"
      }
    : {
        threshold: 0.18,
        rootMargin: "0px 0px -10% 0px"
      };
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    revealOptions
  );

  items.forEach((item) => observer.observe(item));
}

function setupActiveSection() {
  const sections = document.querySelectorAll("section[data-section]");
  const navLinks = Array.from(document.querySelectorAll(".site-nav a"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const id = entry.target.getAttribute("id");
        navLinks.forEach((link) => {
          link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
        });
      });
    },
    {
      rootMargin: "-35% 0px -55% 0px",
      threshold: 0
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function setupParallax() {
  const nodes = document.querySelectorAll(".parallax");
  if (!nodes.length) {
    return;
  }

  const update = () => {
    const y = window.scrollY;
    nodes.forEach((node) => {
      const speed = Number(node.dataset.speed || "0.15");
      node.style.setProperty("--parallax-shift", `${Math.round(y * speed)}px`);
    });
  };

  update();
  window.addEventListener("scroll", () => window.requestAnimationFrame(update), { passive: true });
}

function setupPhotoLightbox() {
  const cards = Array.from(document.querySelectorAll(".photo-grid .photo-card"));
  const lightbox = document.getElementById("photo-lightbox");
  const image = document.getElementById("lightbox-image");
  const caption = document.getElementById("lightbox-caption");
  const closeButton = document.getElementById("lightbox-close");
  const prevButton = document.getElementById("lightbox-prev");
  const nextButton = document.getElementById("lightbox-next");

  if (!cards.length || !lightbox || !image || !caption || !closeButton || !prevButton || !nextButton) {
    return;
  }

  const photos = cards
    .map((card) => {
      const cardImage = card.querySelector("img");
      const cardCaption = card.querySelector("figcaption");
      if (!cardImage) {
        return null;
      }

      return {
        src: cardImage.getAttribute("src") || "",
        alt: cardImage.getAttribute("alt") || "Expedition photo",
        caption: cardCaption ? cardCaption.textContent.trim() : ""
      };
    })
    .filter(Boolean);

  if (!photos.length) {
    return;
  }

  let currentIndex = 0;
  let isOpen = false;

  const renderPhoto = (index) => {
    const safeIndex = (index + photos.length) % photos.length;
    currentIndex = safeIndex;
    const item = photos[safeIndex];
    image.src = item.src;
    image.alt = item.alt;
    caption.textContent = item.caption;
  };

  const openLightbox = (index) => {
    renderPhoto(index);
    isOpen = true;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    closeButton.focus();
  };

  const closeLightbox = () => {
    isOpen = false;
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    image.removeAttribute("src");
  };

  const showPrevious = () => {
    renderPhoto(currentIndex - 1);
  };

  const showNext = () => {
    renderPhoto(currentIndex + 1);
  };

  cards.forEach((card, index) => {
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `Open photo ${index + 1} of ${photos.length}`);

    card.addEventListener("click", () => {
      openLightbox(index);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openLightbox(index);
      }
    });
  });

  closeButton.addEventListener("click", closeLightbox);
  prevButton.addEventListener("click", showPrevious);
  nextButton.addEventListener("click", showNext);

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      closeLightbox();
      return;
    }

    if (event.key === "ArrowLeft") {
      showPrevious();
      return;
    }

    if (event.key === "ArrowRight") {
      showNext();
    }
  });
}

function parseBibTeX(text) {
  const entries = [];
  let i = 0;

  while (i < text.length) {
    const at = text.indexOf("@", i);
    if (at === -1) {
      break;
    }

    let cursor = at + 1;
    while (cursor < text.length && /[a-zA-Z]/.test(text[cursor])) {
      cursor += 1;
    }
    const type = text.slice(at + 1, cursor).toLowerCase();

    while (cursor < text.length && text[cursor] !== "{") {
      cursor += 1;
    }
    if (cursor >= text.length) {
      break;
    }

    cursor += 1;
    let keyStart = cursor;
    while (cursor < text.length && text[cursor] !== ",") {
      cursor += 1;
    }
    const key = text.slice(keyStart, cursor).trim();
    cursor += 1;

    const bodyStart = cursor;
    let depth = 1;
    while (cursor < text.length && depth > 0) {
      if (text[cursor] === "{") {
        depth += 1;
      } else if (text[cursor] === "}") {
        depth -= 1;
      }
      cursor += 1;
    }
    const body = text.slice(bodyStart, cursor - 1);
    const fields = parseFields(body);
    entries.push({ type, key, ...fields });
    i = cursor;
  }

  return entries;
}

function parseFields(body) {
  const fields = {};
  let i = 0;

  while (i < body.length) {
    while (i < body.length && /[\s,]/.test(body[i])) {
      i += 1;
    }
    if (i >= body.length) {
      break;
    }

    const keyStart = i;
    while (i < body.length && /[^\s=]/.test(body[i])) {
      if (body[i] === "=") {
        break;
      }
      i += 1;
    }
    const key = body.slice(keyStart, i).trim().toLowerCase();
    while (i < body.length && body[i] !== "=") {
      i += 1;
    }
    i += 1;
    while (i < body.length && /\s/.test(body[i])) {
      i += 1;
    }

    let value = "";
    if (body[i] === "{") {
      let depth = 0;
      i += 1;
      while (i < body.length) {
        if (body[i] === "{" ) {
          depth += 1;
        } else if (body[i] === "}") {
          if (depth === 0) {
            i += 1;
            break;
          }
          depth -= 1;
        }
        value += body[i];
        i += 1;
      }
    } else if (body[i] === "\"") {
      i += 1;
      while (i < body.length && body[i] !== "\"") {
        value += body[i];
        i += 1;
      }
      i += 1;
    } else {
      while (i < body.length && body[i] !== ",") {
        value += body[i];
        i += 1;
      }
    }

    fields[key] = cleanupBibValue(value);
    while (i < body.length && body[i] !== ",") {
      i += 1;
    }
    if (body[i] === ",") {
      i += 1;
    }
  }

  return fields;
}

function cleanupBibValue(value) {
  return value
    .replace(/[{}]/g, "")
    .replace(/\\textsubscript\{([^}]*)\}/g, "_$1")
    .replace(/\\&/g, "&")
    .replace(/\\'/g, "")
    .replace(/\\"/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthors(authorText) {
  if (!authorText) {
    return "Unknown authors";
  }

  const cleaned = authorText
    .replace(/\s+and\s+/gi, "; ")
    .replace(/\s*,\s*and\s*/gi, "; ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.replace(/(Darcy\s*,?\s*(John\s*L\.?|J\.?\s*L\.?|JL)?)/gi, "<strong>$1</strong>");
}

function toNumberYear(value) {
  const year = Number.parseInt(String(value || "").match(/\d{4}/)?.[0] || "0", 10);
  return Number.isFinite(year) ? year : 0;
}

function publicationRole(entry) {
  const keywords = (entry.keywords || "").toLowerCase();
  if (keywords.includes("firstauthor")) {
    return "firstauthor";
  }
  if (keywords.includes("coauthor")) {
    return "coauthor";
  }
  return "other";
}

function buildYearFilter(entries) {
  const years = Array.from(new Set(entries.map((entry) => toNumberYear(entry.year)).filter(Boolean))).sort((a, b) => b - a);
  const select = document.getElementById("pub-year");

  years.forEach((year) => {
    const option = document.createElement("option");
    option.value = String(year);
    option.textContent = String(year);
    select.appendChild(option);
  });
}

function renderPublications(entries) {
  const container = document.getElementById("publications-list");
  const count = document.getElementById("pub-count");

  if (!entries.length) {
    container.innerHTML = "<p>No publications match your filter.</p>";
    count.textContent = "0 publications";
    return;
  }

  count.textContent = `${entries.length} publications`;
  container.innerHTML = entries
    .map((entry) => {
      const year = toNumberYear(entry.year) || "n.d.";
      const role = publicationRole(entry);
      const venue = entry.journal || entry.booktitle || entry.publisher || "Venue not listed";
      const title = entry.title || "Untitled";
      const authors = normalizeAuthors(entry.author || "");
      const doi = entry.doi ? `https://doi.org/${entry.doi.replace(/^https?:\/\/doi\.org\//i, "")}` : "";
      const url = entry.url || "";

      return `
        <article class="pub-card reveal visible">
          <h3>${title}</h3>
          <p class="pub-meta">${authors}</p>
          <p class="pub-meta">${venue} | ${year}</p>
          <div class="pub-extra">
            <span class="tag">${role === "other" ? entry.type : role.replace("author", "-author")}</span>
            ${doi ? `<a href="${doi}" target="_blank" rel="noopener noreferrer">DOI</a>` : ""}
            ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">Link</a>` : ""}
          </div>
        </article>
      `;
    })
    .join("");
}

function applyPublicationFilters() {
  const role = document.getElementById("pub-role").value;
  const year = document.getElementById("pub-year").value;
  const search = document.getElementById("pub-search").value.trim().toLowerCase();

  state.filtered = state.publications.filter((entry) => {
    const yearMatch = year === "all" || String(toNumberYear(entry.year)) === year;
    const blob = [entry.title, entry.author, entry.journal, entry.booktitle, entry.keywords].join(" ").toLowerCase();
    const searchMatch = !search || blob.includes(search);

    if (role === "recent") {
      return yearMatch && searchMatch;
    }

    const roleMatch = role === "all" || publicationRole(entry) === role;
    return roleMatch && yearMatch && searchMatch;
  });

  if (role === "recent") {
    state.filtered = state.filtered.slice(0, 10);
  }

  renderPublications(state.filtered);

  if (role === "recent") {
    const count = document.getElementById("pub-count");
    count.textContent = `${state.filtered.length} recent publications`;
  }
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function publicationUrls() {
  const current = new URL(window.location.href);
  const candidates = [
    "data/publications.bib",
    "./data/publications.bib",
    new URL("data/publications.bib", current).href
  ];

  if (window.location.origin && window.location.origin !== "null") {
    candidates.push(`${window.location.origin}/data/publications.bib`);
    candidates.push(`${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}data/publications.bib`);
  }

  return unique(candidates);
}

async function fetchBibTeXText() {
  const urls = publicationUrls();
  let lastError = new Error("Could not load publications from BibTeX");

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        lastError = new Error(`Could not load BibTeX (${response.status}) at ${url}`);
        continue;
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }

  if (window.location.protocol === "file:") {
    throw new Error("Browsers block reading local files from JavaScript. Start a local server from this folder (python3 -m http.server 8000), then open http://localhost:8000.");
  }

  throw lastError;
}

async function loadPublications() {
  const container = document.getElementById("publications-list");

  try {
    const text = await fetchBibTeXText();
    const entries = parseBibTeX(text)
      .filter((entry) => entry.title)
      .sort((a, b) => {
        const yearDiff = toNumberYear(b.year) - toNumberYear(a.year);
        if (yearDiff !== 0) {
          return yearDiff;
        }
        return (a.title || "").localeCompare(b.title || "");
      });

    state.publications = entries;
    buildYearFilter(entries);
    applyPublicationFilters();

    document.getElementById("pub-role").addEventListener("change", applyPublicationFilters);
    document.getElementById("pub-year").addEventListener("change", applyPublicationFilters);
    document.getElementById("pub-search").addEventListener("input", applyPublicationFilters);
  } catch (error) {
    container.innerHTML = `<p>Unable to load publications right now. ${error.message}</p>`;
    document.getElementById("pub-count").textContent = "Publication feed unavailable";
  }
}

function init() {
  setupThemeToggle();
  setupNav();
  setupProgress();
  setupReveals();
  setupActiveSection();
  setupParallax();
  setupPhotoLightbox();
  loadPublications();

  const year = document.getElementById("year");
  year.textContent = new Date().getFullYear();
}

window.addEventListener("DOMContentLoaded", init);
