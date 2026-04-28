document.addEventListener("DOMContentLoaded", () => {
  initLoader();
  initMobileMenu();
  initReveal();
  initBackToTop();
  initYear();
  initProfilePhoto();
  initHomeInteractiveMotion();
  initDynamicProjects();
  initProjectImageZoom();
  initDiplomas();
  initPrivateAdminCenter();
});

function initLoader() {
  const loader = document.getElementById("loader");
  if (!loader) return;
  window.addEventListener("load", () => {
    setTimeout(() => loader.classList.add("hidden"), 350);
  });
}

function initMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => links.classList.toggle("show"));
  links.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => links.classList.remove("show"));
  });
}

function initReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((item) => observer.observe(item));
}

function initBackToTop() {
  const btn = document.getElementById("back-to-top");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    if (window.scrollY > 320) btn.classList.add("show");
    else btn.classList.remove("show");
  });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function initYear() {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

function initHomeInteractiveMotion() {
  const heroMedia = document.querySelector(".hero-media");
  if (!heroMedia) return;

  heroMedia.addEventListener("mousemove", (event) => {
    const rect = heroMedia.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroMedia.style.transform = `translateY(-4px) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg)`;
  });

  heroMedia.addEventListener("mouseleave", () => {
    heroMedia.style.transform = "";
  });
}

function initProfilePhoto() {
  const fileInput = document.getElementById("profile-photo-input");
  const preview = document.getElementById("profile-preview");
  if (!fileInput || !preview) return;

  const key = "daniel_profile_photo";
  const cloudDb = getProjectsCloudDb();
  if (cloudDb) {
    cloudDb.collection("portfolioMeta").doc("profilePhoto").onSnapshot((doc) => {
      const data = doc.exists ? doc.data() : null;
      const cloudPhoto = data && data.photoData ? data.photoData : "";
      if (!cloudPhoto) return;
      preview.src = cloudPhoto;
      preview.style.display = "block";
    });
  } else {
    const savedPhoto = localStorage.getItem(key);
    if (savedPhoto) {
      preview.src = savedPhoto;
      preview.style.display = "block";
    }
  }

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const result = await fileToDataUrl(file);
    if (!result) return;
    preview.src = result;
    preview.style.display = "block";
    if (cloudDb) {
      await cloudDb.collection("portfolioMeta").doc("profilePhoto").set({
        photoData: result,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      localStorage.setItem(key, result);
    }
  });
}

function initDynamicProjects() {
  const form = document.getElementById("project-form");
  const list = document.getElementById("dynamic-project-list");
  if (!list) return;

  const key = "daniel_dynamic_projects";
  const cloudDb = getProjectsCloudDb();
  const projects = JSON.parse(localStorage.getItem(key) || "[]");
  if (cloudDb) {
    cloudDb
      .collection("portfolioProjects")
      .orderBy("createdAt", "desc")
      .onSnapshot((snapshot) => {
        const cloudProjects = [];
        snapshot.forEach((doc) => {
          cloudProjects.push({ id: doc.id, ...doc.data(), source: "cloud" });
        });
        renderProjects(cloudProjects, list, key, false);
      });
  } else {
    renderProjects(projects, list, key, false);
  }

  if (!form) return;
}

function renderProjects(projects, list, key, isAdminView) {
  if (!projects.length) {
    list.innerHTML = "<p class='card'>Aucun projet ajoute pour le moment.</p>";
    return;
  }

  list.innerHTML = "";
  projects.forEach((project) => {
    const card = document.createElement("article");
    card.className = "card project-card-enter";
    const safeHref = safeProjectUrl(project.link);
    const imageMarkup = project.imageData
      ? `<img class="project-visual zoomable-project-image" src="${project.imageData}" alt="Apercu ${escapeHtml(project.title)}">`
      : "";
    const linkMarkup = safeHref
      ? `<a class="link-btn" href="${safeHref}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> Ouvrir le projet</a>`
      : "";
    const deleteMarkup = isAdminView
      ? `<button class="delete-btn" data-id="${project.id}" data-source="${project.source || "local"}" type="button">Supprimer</button>`
      : "";
    card.innerHTML = `
      ${imageMarkup}
      <h3>${escapeHtml(project.title)}</h3>
      <p>${escapeHtml(project.description)}</p>
      <span class="tag">${escapeHtml(project.tech)}</span>
      <div class="project-actions">
        ${linkMarkup}
        ${deleteMarkup}
      </div>
    `;
    list.appendChild(card);
  });

  if (!isAdminView) {
    bindProjectImageZoomEvents();
    return;
  }

  list.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const source = btn.dataset.source || "local";
      const rawId = btn.dataset.id || "";
      if (source === "cloud") {
        const db = getProjectsCloudDb();
        if (!db) return;
        await db.collection("portfolioProjects").doc(rawId).delete();
        return;
      }

      const id = Number(rawId);
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      const updated = current.filter((item) => item.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
      renderProjects(updated, list, key);
    });
  });

  bindProjectImageZoomEvents();
}

function unlockProjectsAdmin(adminPanel) {
  const tokenKey = "daniel_projects_admin_unlocked";
  const secret = "DT-ADMIN-2026";
  const url = new URL(window.location.href);
  const hasToken = localStorage.getItem(tokenKey) === "1";
  const shouldPrompt = url.searchParams.get("admin") === "1";

  if (hasToken) {
    adminPanel.classList.remove("admin-hidden");
    return true;
  }

  if (!shouldPrompt) return false;

  const input = window.prompt("Code admin projets:");
  if (input === secret) {
    localStorage.setItem(tokenKey, "1");
    adminPanel.classList.remove("admin-hidden");
    return true;
  }
  return false;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeProjectUrl(urlText) {
  if (!urlText) return "";
  try {
    const parsed = new URL(urlText);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
    return "";
  } catch {
    return "";
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

function getProjectsCloudDb() {
  const cfg = window.PORTFOLIO_FIREBASE_CONFIG;
  const hasConfig =
    cfg &&
    cfg.apiKey &&
    cfg.projectId &&
    cfg.apiKey !== "PUT_YOUR_API_KEY" &&
    cfg.projectId !== "PUT_YOUR_PROJECT_ID";
  if (!hasConfig) return null;
  if (!window.firebase || !window.firebase.firestore) return null;

  if (!firebase.apps.length) {
    firebase.initializeApp(cfg);
  }
  return firebase.firestore();
}

function initDiplomas() {
  const form = document.getElementById("diploma-form");
  const list = document.getElementById("diploma-list");
  if (!list) return;

  const key = "daniel_diplomas";
  const cloudDb = getProjectsCloudDb();
  if (cloudDb) {
    cloudDb.collection("portfolioDiplomas").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      const cloudDiplomas = [];
      snapshot.forEach((doc) => cloudDiplomas.push({ id: doc.id, ...doc.data(), source: "cloud" }));
      renderDiplomas(cloudDiplomas, list, key, false);
    });
  } else {
    const diplomas = JSON.parse(localStorage.getItem(key) || "[]");
    renderDiplomas(diplomas, list, key, false);
  }
  if (!form) return;
}

function renderDiplomas(diplomas, list, key, isAdminView) {
  if (!diplomas.length) {
    list.innerHTML = "<p class='card'>Aucun diplome ou certificat ajoute pour le moment.</p>";
    return;
  }

  list.innerHTML = "";
  diplomas.forEach((item) => {
    const safeHref = safeProjectUrl(item.link);
    const openLinkBtn = safeHref
      ? `<a class="link-btn" href="${safeHref}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-up-right-from-square"></i> Voir le lien</a>`
      : "";
    const openFileBtn = item.fileData
      ? `<a class="link-btn" href="${item.fileData}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-file-arrow-up"></i> Ouvrir fichier</a>`
      : "";
    const fileLabel = item.fileName ? `<p class="diploma-file">Fichier: ${escapeHtml(item.fileName)}</p>` : "";
    const deleteMarkup = isAdminView
      ? `<button class="delete-btn diploma-delete-btn" data-id="${item.id}" data-source="${item.source || "local"}" type="button">Supprimer</button>`
      : "";

    const card = document.createElement("article");
    card.className = "card project-card-enter";
    card.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>
      <p><strong>Organisme:</strong> ${escapeHtml(item.org)}</p>
      <p><strong>Annee:</strong> ${escapeHtml(item.year)}</p>
      ${fileLabel}
      <div class="project-actions">
        ${openLinkBtn}
        ${openFileBtn}
        ${deleteMarkup}
      </div>
    `;
    list.appendChild(card);
  });

  if (!isAdminView) return;

  list.querySelectorAll(".diploma-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const source = btn.dataset.source || "local";
      const rawId = btn.dataset.id || "";
      if (source === "cloud") {
        const db = getProjectsCloudDb();
        if (!db) return;
        await db.collection("portfolioDiplomas").doc(rawId).delete();
        return;
      }

      const id = Number(rawId);
      const current = JSON.parse(localStorage.getItem(key) || "[]");
      const updated = current.filter((item) => item.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
      renderDiplomas(updated, list, key, true);
    });
  });
}

function unlockDiplomasAdmin() {}

function initProjectImageZoom() {
  const lightbox = document.getElementById("image-lightbox");
  const closeBtn = document.getElementById("lightbox-close");
  const image = document.getElementById("lightbox-image");
  if (!lightbox || !closeBtn || !image) return;

  closeBtn.addEventListener("click", closeProjectLightbox);
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeProjectLightbox();
  });
  image.addEventListener("click", () => toggleLightboxZoom());
  image.addEventListener("wheel", (event) => onLightboxWheelZoom(event), { passive: false });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeProjectLightbox();
  });

  bindProjectImageZoomEvents();
}

function bindProjectImageZoomEvents() {
  const images = document.querySelectorAll(".zoomable-project-image");
  if (!images.length) return;
  images.forEach((img) => {
    img.addEventListener("click", () => openProjectLightbox(img.src, img.alt));
  });
}

function openProjectLightbox(src, alt) {
  const lightbox = document.getElementById("image-lightbox");
  const image = document.getElementById("lightbox-image");
  if (!lightbox || !image || !src) return;
  image.src = src;
  image.alt = alt || "Apercu zoom projet";
  lightbox.dataset.zoom = "1";
  image.style.transform = "scale(1)";
  image.style.cursor = "zoom-in";
  lightbox.classList.add("show");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeProjectLightbox() {
  const lightbox = document.getElementById("image-lightbox");
  const image = document.getElementById("lightbox-image");
  if (!lightbox || !image) return;
  lightbox.classList.remove("show");
  lightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  lightbox.dataset.zoom = "1";
  image.style.transform = "scale(1)";
  image.style.cursor = "zoom-in";
  setTimeout(() => {
    image.src = "";
  }, 220);
}

function toggleLightboxZoom() {
  const lightbox = document.getElementById("image-lightbox");
  const image = document.getElementById("lightbox-image");
  if (!lightbox || !image) return;
  const current = Number(lightbox.dataset.zoom || "1");
  const next = current > 1 ? 1 : 1.8;
  lightbox.dataset.zoom = String(next);
  image.style.transform = `scale(${next})`;
  image.style.cursor = next > 1 ? "zoom-out" : "zoom-in";
}

function onLightboxWheelZoom(event) {
  event.preventDefault();
  const lightbox = document.getElementById("image-lightbox");
  const image = document.getElementById("lightbox-image");
  if (!lightbox || !image) return;
  const current = Number(lightbox.dataset.zoom || "1");
  const delta = event.deltaY < 0 ? 0.12 : -0.12;
  const next = Math.min(3, Math.max(1, current + delta));
  lightbox.dataset.zoom = String(next);
  image.style.transform = `scale(${next})`;
  image.style.cursor = next > 1 ? "zoom-out" : "zoom-in";
}

function initPrivateAdminCenter() {
  const center = document.getElementById("private-admin-center");
  if (!center) return;

  const allowed = ensureAdminAccess("Code admin prive:");
  if (!allowed) return;
  center.classList.remove("admin-hidden");

  initAdminProjectsBlock();
  initAdminDiplomasBlock();
}

function initAdminProjectsBlock() {
  const form = document.getElementById("admin-project-form");
  const list = document.getElementById("admin-project-list");
  if (!form || !list) return;

  const cloudDb = getProjectsCloudDb();
  const key = "daniel_dynamic_projects";
  let projects = JSON.parse(localStorage.getItem(key) || "[]");

  if (cloudDb) {
    cloudDb.collection("portfolioProjects").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      const rows = [];
      snapshot.forEach((doc) => rows.push({ id: doc.id, ...doc.data(), source: "cloud" }));
      renderProjects(rows, list, key, true);
    });
  } else {
    renderProjects(projects, list, key, true);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("admin-project-title").value.trim();
    const description = document.getElementById("admin-project-description").value.trim();
    const tech = document.getElementById("admin-project-tech").value.trim();
    const link = document.getElementById("admin-project-link").value.trim();
    const imageInput = document.getElementById("admin-project-image");
    const file = imageInput && imageInput.files ? imageInput.files[0] : null;
    if (!title || !description || !tech) return;

    let imageData = "";
    if (file) imageData = await fileToDataUrl(file);

    if (cloudDb) {
      await cloudDb.collection("portfolioProjects").add({
        title, description, tech, link, imageData,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      projects.push({ id: Date.now(), title, description, tech, link, imageData, source: "local" });
      localStorage.setItem(key, JSON.stringify(projects));
      renderProjects(projects, list, key, true);
    }
    form.reset();
  });
}

function initAdminDiplomasBlock() {
  const form = document.getElementById("admin-diploma-form");
  const list = document.getElementById("admin-diploma-list");
  if (!form || !list) return;

  const key = "daniel_diplomas";
  const cloudDb = getProjectsCloudDb();
  let diplomas = JSON.parse(localStorage.getItem(key) || "[]");
  if (cloudDb) {
    cloudDb.collection("portfolioDiplomas").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
      const rows = [];
      snapshot.forEach((doc) => rows.push({ id: doc.id, ...doc.data(), source: "cloud" }));
      renderDiplomas(rows, list, key, true);
    });
  } else {
    renderDiplomas(diplomas, list, key, true);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const title = document.getElementById("admin-diploma-title").value.trim();
    const org = document.getElementById("admin-diploma-org").value.trim();
    const year = document.getElementById("admin-diploma-year").value.trim();
    const link = document.getElementById("admin-diploma-link").value.trim();
    const fileInput = document.getElementById("admin-diploma-file");
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!title || !org || !year) return;

    let fileData = "";
    let fileName = "";
    if (file) {
      fileData = await fileToDataUrl(file);
      fileName = file.name || "document";
    }

    if (cloudDb) {
      await cloudDb.collection("portfolioDiplomas").add({
        title,
        org,
        year,
        link,
        fileData,
        fileName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      diplomas.push({ id: Date.now(), title, org, year, link, fileData, fileName, source: "local" });
      localStorage.setItem(key, JSON.stringify(diplomas));
      renderDiplomas(diplomas, list, key, true);
    }
    form.reset();
  });
}

function ensureAdminAccess(promptText) {
  const tokenKey = "daniel_projects_admin_unlocked";
  const secret = "DT-ADMIN-2026";
  const hasToken = localStorage.getItem(tokenKey) === "1";
  if (hasToken) return true;

  const entered = window.prompt(promptText);
  if (entered === secret) {
    localStorage.setItem(tokenKey, "1");
    return true;
  }
  return false;
}
