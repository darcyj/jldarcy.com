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
  const isCompactViewport = window.matchMedia("(max-width: 960px)").matches;
  const revealOptions = {
    threshold: 0,
    rootMargin: isCompactViewport ? "0px 0px 260px 0px" : "0px 0px 120px 0px"
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

function photosDataUrls() {
  const current = new URL(window.location.href);
  const candidates = [
    "data/photos.json",
    "./data/photos.json",
    new URL("data/photos.json", current).href
  ];
  if (window.location.origin && window.location.origin !== "null") {
    candidates.push(`${window.location.origin}/data/photos.json`);
    candidates.push(`${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}data/photos.json`);
  }
  return [...new Set(candidates)];
}

async function fetchPhotosData() {
  let lastError;
  for (const url of photosDataUrls()) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} at ${url}`);
        continue;
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Could not load photos.json");
}

function photoSrc(photo) {
  return `assets/photos/${photo.filename}`;
}

function formatPhotoMeta(photo) {
  return [photo.location_minor, photo.location_major, photo.year]
    .filter(Boolean)
    .join(" · ");
}

function formatLightboxCaption(photo) {
  const meta = formatPhotoMeta(photo);
  const text = photo.caption || "";
  return (
    (text ? `<span class="lightbox-caption-text">${text}</span>` : "") +
    (meta ? `<span class="lightbox-caption-meta">${meta}</span>` : "")
  );
}

function createPhotoCard(photo, onOpen) {
  const fig = document.createElement("figure");
  fig.className = "photo-card" + (photo.feature ? " large" : "");
  fig.setAttribute("role", "button");
  fig.setAttribute("tabindex", "0");
  fig.setAttribute("aria-label", photo.caption || photo.location_minor || "Open photo");

  const img = document.createElement("img");
  img.loading = "lazy";
  img.src = photoSrc(photo);
  img.alt = photo.caption || "";
  fig.appendChild(img);

  const cap = document.createElement("figcaption");
  cap.textContent = `${photo.location_minor || ""}${photo.year ? ` (${photo.year})` : ""}`.trim();
  fig.appendChild(cap);

  fig.addEventListener("click", onOpen);
  fig.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  });
  return fig;
}

function createSeeAllTile(totalCount, onOpen) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "photo-card see-all";
  btn.id = "photo-grid-see-all";
  btn.setAttribute("aria-label", "Open photo gallery with every expedition photo");
  btn.innerHTML =
    '<span class="see-all-inner">' +
      '<span class="see-all-label">See all photos</span>' +
      `<span class="see-all-count">${totalCount} photos in the field</span>` +
    '</span>';
  btn.addEventListener("click", onOpen);
  return btn;
}

async function setupPhotoLightbox() {
  const grid = document.getElementById("photo-grid");
  const lightbox = document.getElementById("photo-lightbox");
  const image = document.getElementById("lightbox-image");
  const caption = document.getElementById("lightbox-caption");
  const closeButton = document.getElementById("lightbox-close");
  const prevButton = document.getElementById("lightbox-prev");
  const nextButton = document.getElementById("lightbox-next");
  const strip = document.getElementById("lightbox-strip");
  const uiToggle = document.getElementById("lightbox-ui-toggle");
  const locationButtons = Array.from(document.querySelectorAll(".location-strip [data-location-major]"));

  if (!grid || !lightbox || !image || !caption || !closeButton || !prevButton || !nextButton) {
    return;
  }

  let photos;
  try {
    photos = await fetchPhotosData();
  } catch (err) {
    console.warn("Photo data failed to load:", err);
    grid.removeAttribute("aria-busy");
    return;
  }
  if (!Array.isArray(photos) || !photos.length) {
    grid.removeAttribute("aria-busy");
    return;
  }

  let currentSet = photos;
  let currentIndex = 0;
  let isOpen = false;
  let stripItems = [];

  const rebuildStrip = (set) => {
    if (!strip) return;
    strip.replaceChildren();
    stripItems = set.map((photo, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "lightbox-strip-item";
      item.setAttribute("role", "tab");
      item.setAttribute("aria-label", photo.caption || formatPhotoMeta(photo) || `Photo ${index + 1}`);
      const thumb = document.createElement("img");
      thumb.src = photoSrc(photo);
      thumb.alt = "";
      thumb.loading = "lazy";
      item.appendChild(thumb);
      item.addEventListener("click", () => renderPhoto(index));
      strip.appendChild(item);
      return item;
    });
  };

  const renderPhoto = (index) => {
    if (!currentSet.length) return;
    const safeIndex = (index + currentSet.length) % currentSet.length;
    currentIndex = safeIndex;
    const photo = currentSet[safeIndex];
    image.src = photoSrc(photo);
    image.alt = photo.caption || "Expedition photo";
    caption.innerHTML = formatLightboxCaption(photo);
    stripItems.forEach((node, i) => {
      if (i === safeIndex) {
        node.setAttribute("aria-current", "true");
        if (!lightbox.hidden) {
          node.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      } else {
        node.removeAttribute("aria-current");
      }
    });
  };

  const openLightbox = (set, index = 0) => {
    currentSet = set && set.length ? set : photos;
    rebuildStrip(currentSet);
    isOpen = true;
    lightbox.hidden = false;
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    renderPhoto(index);
    requestAnimationFrame(() => {
      const activeThumb = stripItems[currentIndex];
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: "auto", block: "nearest", inline: "center" });
      }
    });
    closeButton.focus();
  };

  const closeLightbox = () => {
    isOpen = false;
    lightbox.hidden = true;
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    image.removeAttribute("src");
    // Reset UI chrome to visible for the next open
    lightbox.classList.remove("ui-hidden");
    if (uiToggle) {
      uiToggle.setAttribute("aria-pressed", "false");
      uiToggle.setAttribute("aria-label", "Hide controls");
    }
  };

  const toggleUi = () => {
    const hidden = lightbox.classList.toggle("ui-hidden");
    if (uiToggle) {
      uiToggle.setAttribute("aria-pressed", hidden ? "true" : "false");
      uiToggle.setAttribute("aria-label", hidden ? "Show controls" : "Hide controls");
    }
  };

  // Render visible photo cards into the grid
  grid.replaceChildren();
  photos.forEach((photo, fullIdx) => {
    if (photo.hidden) return;
    const card = createPhotoCard(photo, () => openLightbox(photos, fullIdx));
    grid.appendChild(card);
  });
  grid.appendChild(createSeeAllTile(photos.length, () => openLightbox(photos, 0)));
  grid.removeAttribute("aria-busy");

  // Location-strip filters: click a pill to open the lightbox with photos from that major location only
  locationButtons.forEach((btn) => {
    const major = btn.getAttribute("data-location-major");
    const subset = photos.filter((p) => p.location_major === major);
    if (!subset.length) {
      btn.disabled = true;
      btn.setAttribute("aria-disabled", "true");
      return;
    }
    btn.setAttribute("aria-label", `Open ${subset.length} photo${subset.length === 1 ? "" : "s"} from ${major}`);
    btn.addEventListener("click", () => openLightbox(subset, 0));
  });

  closeButton.addEventListener("click", closeLightbox);
  prevButton.addEventListener("click", () => renderPhoto(currentIndex - 1));
  nextButton.addEventListener("click", () => renderPhoto(currentIndex + 1));
  if (uiToggle) {
    uiToggle.addEventListener("click", toggleUi);
  }

  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) {
      closeLightbox();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!isOpen) return;
    if (event.key === "Escape") { closeLightbox(); return; }
    if (event.key === "ArrowLeft") { renderPhoto(currentIndex - 1); return; }
    if (event.key === "ArrowRight") { renderPhoto(currentIndex + 1); }
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

  return cleaned.replace(/(Darcy\s*,?\s*(John\s*L\.?|J\.?\s*L\.?|JL)?)/gi, '<strong class="author-self">$1</strong>');
}

function toNumberYear(value) {
  const year = Number.parseInt(String(value || "").match(/\d{4}/)?.[0] || "0", 10);
  return Number.isFinite(year) ? year : 0;
}

const KNOWN_TAGS = ["firstauthor", "coauthor", "chapter", "preprint", "letter"];

const TAG_LABELS = {
  firstauthor: "first-author",
  coauthor: "co-author",
  chapter: "book chapter",
  preprint: "preprint",
  letter: "letter"
};

function publicationTags(entry) {
  const keywords = (entry.keywords || "").toLowerCase();
  return KNOWN_TAGS.filter((tag) => keywords.includes(tag));
}

function publicationRole(entry) {
  // Backwards-compatible single-role: used by filter logic.
  const tags = publicationTags(entry);
  if (tags.includes("firstauthor")) return "firstauthor";
  if (tags.includes("coauthor")) return "coauthor";
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
      const venue = entry.journal || entry.booktitle || entry.publisher || "Venue not listed";
      const title = entry.title || "Untitled";
      const authors = normalizeAuthors(entry.author || "");
      const doi = entry.doi ? `https://doi.org/${entry.doi.replace(/^https?:\/\/doi\.org\//i, "")}` : "";
      const url = entry.url || "";

      const tags = publicationTags(entry);
      const tagBadges = tags.length
        ? tags.map((t) => `<span class="tag tag-${t}">${TAG_LABELS[t] || t}</span>`).join("")
        : `<span class="tag">${entry.type || "publication"}</span>`;
      const titleLink = doi || url;
      const titleHtml = titleLink
        ? `<a href="${titleLink}" target="_blank" rel="noopener noreferrer">${title}</a>`
        : title;

      return `
        <article class="pub-card reveal visible">
          <h3>${titleHtml}</h3>
          <p class="pub-meta">${authors}</p>
          <p class="pub-meta">${venue} | ${year}</p>
          <div class="pub-extra">
            ${tagBadges}
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

    const tags = publicationTags(entry);
    let tagMatch;
    if (role === "all") tagMatch = true;
    else if (role === "nopreprint") tagMatch = !tags.includes("preprint");
    else tagMatch = tags.includes(role);
    return tagMatch && yearMatch && searchMatch;
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

async function loadHeroStats() {
  try {
    const res = await fetch("data/stats.json", { cache: "no-store" });
    if (!res.ok) return;
    const stats = await res.json();
    const years = document.getElementById("stat-years");
    const pubs = document.getElementById("stat-pubs");
    const hIndex = document.getElementById("stat-h-index");
    if (years && Number.isFinite(stats.years_active)) {
      years.textContent = `${stats.years_active}+ Years`;
    }
    if (pubs && Number.isFinite(stats.publications)) {
      pubs.textContent = `${stats.publications}+ Publications`;
    }
    if (hIndex && Number.isFinite(stats.h_index)) {
      hIndex.textContent = stats.h_index;
    }
  } catch (err) {
    console.warn("hero stats load failed:", err);
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
  loadHeroStats();

  const year = document.getElementById("year");
  year.textContent = new Date().getFullYear();
}

window.addEventListener("DOMContentLoaded", init);
