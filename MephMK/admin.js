/* Eisenfels RP CMS - V13 direct admin.js with law paragraph form fields */
(function () {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  let cfg = null;
  let data = null;
  let currentSha = null;
  let activeTab = "pages";
  let selected = {
    pages: 0,
    lawGroup: 0,
    law: 0,
    paragraph: 0,
    events: 0,
    trainings: 0,
    prices: 0,
    departments: 0,
    contacts: 0
  };

  function showError(error) {
    const box = $("#errorBox");
    const message = error && (error.stack || error.message) ? (error.stack || error.message) : String(error);
    if (box) {
      box.style.display = "block";
      box.textContent = message;
    }
    console.error(error);
  }

  window.addEventListener("error", (event) => showError(event.error || event.message));
  window.addEventListener("unhandledrejection", (event) => showError(event.reason || event));

  function uid(prefix) {
    return String(prefix || "id") + "-" + Math.random().toString(36).slice(2, 8);
  }

  async function sha256(text) {
    const encoded = new TextEncoder().encode(String(text || ""));
    const hash = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function setStatus(message, ok = true) {
    const status = $("#status") || $("#loginStatus");
    if (status) {
      status.textContent = message;
      status.className = ok ? "status-ok" : "status-bad";
    }
  }

  function getToken() {
    const fromField = $("#token") ? $("#token").value.trim() : "";
    return fromField || localStorage.getItem("ef_github_token") || "";
  }

  function repoApi(path) {
    return "https://api.github.com/repos/" + cfg.repoOwner + "/" + cfg.repoName + "/contents/" + path;
  }

  function decodeBase64Unicode(value) {
    const clean = String(value || "").replace(/\s/g, "");
    const binary = atob(clean);
    const encoded = Array.from(binary, (char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2)).join("");
    return decodeURIComponent(encoded);
  }

  function encodeBase64Unicode(value) {
    return btoa(unescape(encodeURIComponent(String(value || ""))));
  }

  async function ghGet(path) {
    const response = await fetch(repoApi(path) + "?ref=" + encodeURIComponent(cfg.branch), {
      headers: {
        Authorization: "Bearer " + getToken(),
        Accept: "application/vnd.github+json"
      }
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error("GitHub GET Fehler " + response.status + ":\n" + text);
    }

    return JSON.parse(text);
  }

  async function ghPut(path, content, message, sha) {
    const body = {
      message,
      content: encodeBase64Unicode(content),
      branch: cfg.branch
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(repoApi(path), {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + getToken(),
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error("GitHub PUT Fehler " + response.status + ":\n" + text);
    }

    return JSON.parse(text);
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function val(id) {
    return document.getElementById(id)?.value || "";
  }

  function checked(id) {
    return Boolean(document.getElementById(id)?.checked);
  }

  function parseMedia(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|");
        return {
          type: parts[0] || "image",
          url: parts[1] || "",
          caption: parts[2] || "",
          position: parts[3] || "bottom"
        };
      });
  }

  function mediaToText(media) {
    return (media || []).map((item) => [
      item.type || "image",
      item.url || "",
      item.caption || "",
      item.position || "bottom"
    ].join("|")).join("\n");
  }

  function pageOptions(selectedId) {
    return '<option value="">— keine —</option>' + (data.pages || []).map((page) =>
      '<option value="' + esc(page.id) + '" ' + (page.id === selectedId ? "selected" : "") + ">" + esc(page.title) + " (" + esc(page.id) + ")</option>"
    ).join("");
  }

  function factionOptions(selectedId) {
    return '<option value="">— wählen —</option>' + (data.pages || [])
      .filter((page) => page.type === "faction" || page.type === "group")
      .map((page) =>
        '<option value="' + esc(page.id) + '" ' + (page.id === selectedId ? "selected" : "") + ">" + esc(page.title) + " (" + esc(page.id) + ")</option>"
      ).join("");
  }

  function listLayout(title, addText, listHtml, formHtml) {
    return '<h2>' + esc(title) + '</h2>' +
      '<div class="admin-actions"><button id="addItem" type="button">' + esc(addText) + '</button></div>' +
      '<div class="cms-layout"><div class="cms-list">' + listHtml + '</div><div class="cms-form">' + formHtml + '</div></div>';
  }

  async function login() {
    try {
      const hash = await sha256($("#password").value);
      if (hash === cfg.passwordHash) {
        sessionStorage.setItem("ef_admin", "1");
        $("#loginBox").style.display = "none";
        $("#cmsBox").style.display = "block";
        $("#token").value = localStorage.getItem("ef_github_token") || "";
        setStatus("Login erfolgreich.");
      } else {
        $("#loginStatus").textContent = "Falsches Passwort.";
        $("#loginStatus").className = "status-bad";
      }
    } catch (error) {
      showError(error);
    }
  }

  async function loadContent() {
    try {
      if (!getToken()) {
        throw new Error("GitHub Token fehlt.");
      }

      setStatus("Lade Inhalte…");
      const file = await ghGet(cfg.contentPath);
      currentSha = file.sha;
      data = JSON.parse(decodeBase64Unicode(file.content));

      normalizeData();
      $("#editorArea").style.display = "block";
      activeTab = "pages";
      renderTab();
      setStatus("Inhalte geladen.");
    } catch (error) {
      showError(error);
      setStatus("Fehler beim Laden. Details oben/Console.", false);
    }
  }

  async function saveGithub() {
    try {
      if (!data) {
        throw new Error("Keine Inhalte geladen.");
      }

      const formatted = JSON.stringify(data, null, 2);

      if (!currentSha) {
        const file = await ghGet(cfg.contentPath);
        currentSha = file.sha;
      }

      const result = await ghPut(cfg.contentPath, formatted, "Eisenfels CMS Inhalte aktualisiert", currentSha);
      currentSha = result.content.sha;
      setStatus("Gespeichert. Website mit STRG + F5 neu laden.");
    } catch (error) {
      showError(error);
      setStatus("Fehler beim Speichern. Details oben/Console.", false);
    }
  }

  function normalizeData() {
    data.pages = data.pages || [];
    data.lawGroups = data.lawGroups || [];
    data.departments = data.departments || [];
    data.priceLists = data.priceLists || [];
    data.events = data.events || [];
    data.trainings = data.trainings || [];
    data.contacts = data.contacts || [];
    data.settings = data.settings || {};

    data.lawGroups.forEach((group) => {
      group.laws = group.laws || [];
      group.laws.forEach((law) => {
        if (law.description === undefined) {
          law.description = law.body || "";
        }
        law.paragraphs = law.paragraphs || [];
        law.media = law.media || [];
      });
    });
  }

  function renderTab() {
    try {
      $$(".cms-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === activeTab);
      });

      const renderers = {
        pages: renderPages,
        laws: renderLaws,
        events: () => renderItems("events", "Termin"),
        trainings: () => renderItems("trainings", "Ausbildung"),
        prices: renderPrices,
        departments: () => renderSimple("departments", "Fachabteilungen", ["factionId", "name", "description", "slug", "icon", "logo", "banner"]),
        contacts: () => renderSimple("contacts", "Kontakte", ["factionId", "name", "role", "discord", "email", "note"]),
        settings: renderSettings,
        password: renderPassword
      };

      $("#tabContent").innerHTML = renderers[activeTab]();
      bindTab();
    } catch (error) {
      showError(error);
    }
  }

  function renderPages() {
    const arr = data.pages || [];
    const idx = selected.pages || 0;
    const page = arr[idx] || {};

    const list = arr.map((item, index) =>
      '<button type="button" data-sel="' + index + '" class="' + (index === idx ? "active" : "") + '">' +
      esc(item.title) + '<br><span class="cms-small">' + esc(item.slug) + " · " + esc(item.type) + "</span></button>"
    ).join("");

    const form = page.id ? [
      '<div class="cms-row"><div><label>Titel</label><input id="p_title" value="' + esc(page.title) + '"></div><div><label>ID</label><input id="p_id" value="' + esc(page.id) + '"></div></div>',
      '<div class="cms-row"><div><label>URL / Slug</label><input id="p_slug" value="' + esc(page.slug) + '"></div><div><label>Übergeordnete Seite</label><select id="p_parent">' + pageOptions(page.parentId) + '</select></div></div>',
      '<div class="cms-row"><div><label>Typ</label><select id="p_type">' + ["page", "group", "faction", "laws-index", "departments", "price-list", "events-list", "trainings-list", "contact"].map((type) => '<option ' + (page.type === type ? "selected" : "") + '>' + type + '</option>').join("") + '</select></div><div><label>Fraktions-ID</label><input id="p_faction" value="' + esc(page.factionId || "") + '"></div></div>',
      '<div class="cms-row"><div><label>Reihenfolge</label><input id="p_order" type="number" value="' + esc(page.order || 0) + '"></div><div><label>Akzentfarbe</label><select id="p_accent">' + ["red", "orange", "blue"].map((color) => '<option ' + (page.accent === color ? "selected" : "") + '>' + color + '</option>').join("") + '</select></div></div>',
      '<label><input id="p_show" type="checkbox" ' + (page.showInSidebar !== false ? "checked" : "") + '> In Seitenleiste anzeigen</label>',
      '<div class="cms-row"><div><label>Logo/Wappen URL</label><input id="p_logo" value="' + esc(page.logo || "") + '"></div><div><label>Banner URL</label><input id="p_banner" value="' + esc(page.banner || "") + '"></div></div>',
      '<label>Inhalt</label><textarea id="p_body">' + esc(page.body || "") + '</textarea>',
      '<label>Medien: image|URL|Beschriftung|top/bottom oder video|URL|Beschriftung|top/bottom</label><textarea id="p_media">' + esc(mediaToText(page.media)) + '</textarea>',
      '<div class="admin-actions"><button id="savePage" type="button">Seite übernehmen</button><button class="cms-danger" id="deletePage" type="button">Seite löschen</button></div>'
    ].join("") : "<p>Keine Seite ausgewählt.</p>";

    return listLayout("Seiten & Unterseiten", "Neue Seite", list, form);
  }

  function bindPages() {
    $$(".cms-list button[data-sel]").forEach((button) => {
      button.onclick = () => {
        selected.pages = Number(button.dataset.sel);
        renderTab();
      };
    });

    $("#addItem").onclick = () => {
      data.pages.push({
        id: uid("seite"),
        slug: "neue-seite",
        title: "Neue Seite",
        parentId: "",
        order: 10,
        showInSidebar: true,
        type: "page",
        accent: "orange",
        body: "# Neue Seite",
        media: []
      });
      selected.pages = data.pages.length - 1;
      renderTab();
    };

    const save = $("#savePage");
    if (save) {
      save.onclick = () => {
        const page = data.pages[selected.pages || 0];
        Object.assign(page, {
          title: val("p_title"),
          id: val("p_id"),
          slug: val("p_slug"),
          parentId: val("p_parent"),
          type: val("p_type"),
          factionId: val("p_faction"),
          order: Number(val("p_order")),
          accent: val("p_accent"),
          showInSidebar: checked("p_show"),
          logo: val("p_logo"),
          banner: val("p_banner"),
          body: val("p_body"),
          media: parseMedia(val("p_media"))
        });
        renderTab();
        setStatus("Seite übernommen. Danach alle Änderungen speichern.");
      };
    }

    const del = $("#deletePage");
    if (del) {
      del.onclick = () => {
        if (confirm("Seite wirklich löschen?")) {
          data.pages.splice(selected.pages || 0, 1);
          selected.pages = 0;
          renderTab();
        }
      };
    }
  }

  function renderLaws() {
    const groups = data.lawGroups || [];
    const gi = selected.lawGroup || 0;
    const li = selected.law || 0;
    const group = groups[gi] || { laws: [] };
    const law = (group.laws || [])[li] || {};
    const paragraphs = law.paragraphs || [];

    if ((selected.paragraph || 0) >= paragraphs.length) {
      selected.paragraph = 0;
    }

    const paragraph = paragraphs[selected.paragraph || 0] || {};

    const groupList = groups.map((item, index) =>
      '<button type="button" data-g="' + index + '" class="' + (index === gi ? "active" : "") + '">' +
      esc(item.title) + '<br><span class="cms-small">' + ((item.laws || []).length) + " Gesetze</span></button>"
    ).join("");

    const lawList = (group.laws || []).map((item, index) =>
      '<button type="button" data-l="' + index + '" class="' + (index === li ? "active" : "") + '">§ ' + esc(item.title) + "</button>"
    ).join("");

    const paragraphList = paragraphs.map((item, index) =>
      '<button type="button" data-p="' + index + '" class="' + (index === (selected.paragraph || 0) ? "active" : "") + '">' +
      esc(item.paragraph || "§") + " " + esc(item.title || "Ohne Titel") +
      '<br><span class="cms-small">' + (item.minFine || item.maxFine || item.jailMinutes || item.points ? "Sanktionen eingetragen" : "keine Sanktionen") + "</span></button>"
    ).join("");

    const paragraphForm = law.slug ? [
      '<h3>Paragraphen</h3>',
      '<div class="admin-actions"><button id="addParagraph" type="button">Neuer Paragraph</button></div>',
      '<div class="paragraph-editor">',
      '<div class="paragraph-list">' + (paragraphList || '<p class="cms-small">Noch keine Paragraphen.</p>') + '</div>',
      '<div class="paragraph-form">',
      paragraphs.length ? [
        '<div class="cms-row"><div><label>Paragraph</label><input id="para_paragraph" value="' + esc(paragraph.paragraph || "") + '" placeholder="§1"></div><div><label>Titel</label><input id="para_title" value="' + esc(paragraph.title || "") + '" placeholder="Körperverletzung"></div></div>',
        '<label>Beschreibung</label><textarea id="para_description">' + esc(paragraph.description || "") + '</textarea>',
        '<div class="cms-row"><div><label>Mindestgeldstrafe</label><input id="para_minFine" value="' + esc(paragraph.minFine || "") + '" placeholder="€500"></div><div><label>Maximalgeldstrafe</label><input id="para_maxFine" value="' + esc(paragraph.maxFine || "") + '" placeholder="€2.000"></div></div>',
        '<div class="cms-row"><div><label>Haftminuten</label><input id="para_jailMinutes" value="' + esc(paragraph.jailMinutes || "") + '" placeholder="15"></div><div><label>Führerscheinpunkte</label><input id="para_points" value="' + esc(paragraph.points || "") + '" placeholder="nur bei Verkehr"></div></div>',
        '<div class="admin-actions"><button id="saveParagraph" type="button">Paragraph übernehmen</button><button class="cms-danger" id="deleteParagraph" type="button">Paragraph löschen</button></div>'
      ].join("") : "<p>Lege zuerst einen Paragraphen an.</p>",
      "</div></div>"
    ].join("") : "";

    const lawForm = law.slug ? [
      '<h3>Gesetzbuch bearbeiten</h3>',
      '<div class="cms-row"><div><label>Titel</label><input id="l_title" value="' + esc(law.title) + '"></div><div><label>Slug</label><input id="l_slug" value="' + esc(law.slug) + '"></div></div>',
      '<label>Allgemeine Beschreibung des Gesetzbuches</label><textarea id="l_description">' + esc(law.description || law.body || "") + '</textarea>',
      '<label>Medien</label><textarea id="l_media">' + esc(mediaToText(law.media)) + '</textarea>',
      '<div class="admin-actions"><button id="saveLaw" type="button">Gesetzbuch übernehmen</button><button class="cms-danger" id="deleteLaw" type="button">Gesetzbuch löschen</button></div>',
      paragraphForm
    ].join("") : "<p>Kein Gesetzbuch ausgewählt.</p>";

    const form = [
      '<h3>Gruppe</h3>',
      '<div class="cms-row"><div><label>Gruppentitel</label><input id="g_title" value="' + esc(group.title || "") + '"></div><div><label>Gruppen-ID</label><input id="g_id" value="' + esc(group.id || "") + '"></div></div>',
      '<div class="admin-actions"><button id="saveGroup" type="button">Gruppe übernehmen</button><button id="addLaw" type="button">Neues Gesetzbuch</button></div>',
      '<h3>Gesetzbücher dieser Gruppe</h3>',
      '<div class="cms-list">' + lawList + '</div>',
      lawForm
    ].join("");

    return listLayout("Gesetzbücher nach Gruppen", "Neue Gesetzesgruppe", groupList, form);
  }

  function bindLaws() {
    $$(".cms-list button[data-g]").forEach((button) => {
      button.onclick = () => {
        selected.lawGroup = Number(button.dataset.g);
        selected.law = 0;
        selected.paragraph = 0;
        renderTab();
      };
    });

    $$(".cms-list button[data-l]").forEach((button) => {
      button.onclick = () => {
        selected.law = Number(button.dataset.l);
        selected.paragraph = 0;
        renderTab();
      };
    });

    $$(".paragraph-list button[data-p]").forEach((button) => {
      button.onclick = () => {
        selected.paragraph = Number(button.dataset.p);
        renderTab();
      };
    });

    $("#addItem").onclick = () => {
      data.lawGroups.push({ id: uid("gruppe"), title: "Neue Gruppe", laws: [] });
      selected.lawGroup = data.lawGroups.length - 1;
      selected.law = 0;
      selected.paragraph = 0;
      renderTab();
    };

    $("#saveGroup").onclick = () => {
      const group = data.lawGroups[selected.lawGroup || 0];
      group.title = val("g_title");
      group.id = val("g_id");
      renderTab();
      setStatus("Gruppe übernommen.");
    };

    $("#addLaw").onclick = () => {
      const group = data.lawGroups[selected.lawGroup || 0];
      group.laws = group.laws || [];
      group.laws.push({
        slug: "neues-gesetzbuch",
        title: "Neues Gesetzbuch",
        description: "",
        paragraphs: [],
        media: []
      });
      selected.law = group.laws.length - 1;
      selected.paragraph = 0;
      renderTab();
    };

    const saveLaw = $("#saveLaw");
    if (saveLaw) {
      saveLaw.onclick = () => {
        const law = data.lawGroups[selected.lawGroup || 0].laws[selected.law || 0];
        law.title = val("l_title");
        law.slug = val("l_slug");
        law.description = val("l_description");
        law.body = "";
        law.media = parseMedia(val("l_media"));
        law.paragraphs = law.paragraphs || [];
        renderTab();
        setStatus("Gesetzbuch übernommen. Danach alle Änderungen speichern.");
      };
    }

    const deleteLaw = $("#deleteLaw");
    if (deleteLaw) {
      deleteLaw.onclick = () => {
        if (confirm("Gesetzbuch löschen?")) {
          data.lawGroups[selected.lawGroup || 0].laws.splice(selected.law || 0, 1);
          selected.law = 0;
          selected.paragraph = 0;
          renderTab();
        }
      };
    }

    const addParagraph = $("#addParagraph");
    if (addParagraph) {
      addParagraph.onclick = () => {
        const law = data.lawGroups[selected.lawGroup || 0].laws[selected.law || 0];
        law.paragraphs = law.paragraphs || [];
        law.paragraphs.push({
          paragraph: "§",
          title: "Neuer Paragraph",
          description: "",
          minFine: "",
          maxFine: "",
          jailMinutes: "",
          points: ""
        });
        selected.paragraph = law.paragraphs.length - 1;
        renderTab();
      };
    }

    const saveParagraph = $("#saveParagraph");
    if (saveParagraph) {
      saveParagraph.onclick = () => {
        const law = data.lawGroups[selected.lawGroup || 0].laws[selected.law || 0];
        const paragraph = law.paragraphs[selected.paragraph || 0];
        paragraph.paragraph = val("para_paragraph");
        paragraph.title = val("para_title");
        paragraph.description = val("para_description");
        paragraph.minFine = val("para_minFine");
        paragraph.maxFine = val("para_maxFine");
        paragraph.jailMinutes = val("para_jailMinutes");
        paragraph.points = val("para_points");
        renderTab();
        setStatus("Paragraph übernommen. Danach alle Änderungen speichern.");
      };
    }

    const deleteParagraph = $("#deleteParagraph");
    if (deleteParagraph) {
      deleteParagraph.onclick = () => {
        if (confirm("Paragraph löschen?")) {
          const law = data.lawGroups[selected.lawGroup || 0].laws[selected.law || 0];
          law.paragraphs.splice(selected.paragraph || 0, 1);
          selected.paragraph = 0;
          renderTab();
        }
      };
    }
  }

  function renderItems(kind, label) {
    const arr = data[kind] || [];
    const idx = selected[kind] || 0;
    const item = arr[idx] || {};
    const isTraining = kind === "trainings";

    const list = arr.map((entry, index) =>
      '<button type="button" data-sel="' + index + '" class="' + (index === idx ? "active" : "") + '">' +
      esc(entry.title) + '<br><span class="cms-small">' + esc(entry.factionId) + " · " + esc(entry.date || "") + "</span></button>"
    ).join("");

    const trainingFields = isTraining ? [
      '<div class="cms-row"><div><label>Dauer</label><input id="i_duration" value="' + esc(item.duration || "") + '"></div><div><label>Leitung</label><input id="i_lead" value="' + esc(item.lead || "") + '"></div></div>',
      '<label>Voraussetzungen</label><textarea id="i_requirements">' + esc(item.requirements || "") + '</textarea>'
    ].join("") : "";

    const form = item.slug ? [
      '<div class="cms-row"><div><label>Titel</label><input id="i_title" value="' + esc(item.title) + '"></div><div><label>Slug</label><input id="i_slug" value="' + esc(item.slug) + '"></div></div>',
      '<div class="cms-row"><div><label>Fraktion</label><select id="i_faction">' + factionOptions(item.factionId) + '</select></div><div><label>Ort</label><input id="i_location" value="' + esc(item.location || "") + '"></div></div>',
      '<div class="cms-row"><div><label>Datum</label><input id="i_date" value="' + esc(item.date || "") + '"></div><div><label>Uhrzeit</label><input id="i_time" value="' + esc(item.time || "") + '"></div></div>',
      trainingFields,
      '<label>Beschreibung / Kurztext</label><textarea id="i_summary">' + esc(item.summary || "") + '</textarea>',
      '<label>Detailtext</label><textarea id="i_body">' + esc(item.body || "") + '</textarea>',
      '<label>Medien</label><textarea id="i_media">' + esc(mediaToText(item.media)) + '</textarea>',
      '<div class="admin-actions"><button id="saveItem" type="button">Übernehmen</button><button class="cms-danger" id="deleteItem" type="button">Löschen</button></div>'
    ].join("") : "<p>Kein Eintrag ausgewählt.</p>";

    return listLayout(label + " verwalten", "Neu: " + label, list, form);
  }

  function bindItems(kind) {
    $$(".cms-list button[data-sel]").forEach((button) => {
      button.onclick = () => {
        selected[kind] = Number(button.dataset.sel);
        renderTab();
      };
    });

    $("#addItem").onclick = () => {
      const base = {
        factionId: "rettungsdienst",
        slug: uid(kind),
        title: "Neuer Eintrag",
        date: "2026-01-01",
        time: "20:00",
        location: "",
        summary: "",
        body: "",
        media: []
      };

      if (kind === "trainings") {
        base.duration = "";
        base.requirements = "";
        base.lead = "";
      }

      data[kind].push(base);
      selected[kind] = data[kind].length - 1;
      renderTab();
    };

    const save = $("#saveItem");
    if (save) {
      save.onclick = () => {
        const item = data[kind][selected[kind] || 0];
        Object.assign(item, {
          title: val("i_title"),
          slug: val("i_slug"),
          factionId: val("i_faction"),
          location: val("i_location"),
          date: val("i_date"),
          time: val("i_time"),
          summary: val("i_summary"),
          body: val("i_body"),
          media: parseMedia(val("i_media"))
        });

        if (kind === "trainings") {
          item.duration = val("i_duration");
          item.requirements = val("i_requirements");
          item.lead = val("i_lead");
        }

        renderTab();
        setStatus("Eintrag übernommen. Danach alle Änderungen speichern.");
      };
    }

    const del = $("#deleteItem");
    if (del) {
      del.onclick = () => {
        if (confirm("Eintrag löschen?")) {
          data[kind].splice(selected[kind] || 0, 1);
          selected[kind] = 0;
          renderTab();
        }
      };
    }
  }

  function renderPrices() {
    const arr = data.priceLists || [];
    const idx = selected.prices || 0;
    const priceList = arr[idx] || {};

    const list = arr.map((entry, index) =>
      '<button type="button" data-sel="' + index + '" class="' + (index === idx ? "active" : "") + '">' +
      esc(entry.title) + '<br><span class="cms-small">' + esc(entry.factionId) + "</span></button>"
    ).join("");

    const itemText = (priceList.items || []).map((item) => [item.name || "", item.price || "", item.note || ""].join("|")).join("\n");

    const form = priceList.title ? [
      '<div class="cms-row"><div><label>Titel</label><input id="pr_title" value="' + esc(priceList.title) + '"></div><div><label>Fraktion</label><select id="pr_faction">' + factionOptions(priceList.factionId) + '</select></div></div>',
      '<label>Positionen (Leistung|Preis|Hinweis)</label><textarea id="pr_items">' + esc(itemText) + '</textarea>',
      '<div class="admin-actions"><button id="savePrice" type="button">Preisliste übernehmen</button><button class="cms-danger" id="deletePrice" type="button">Löschen</button></div>'
    ].join("") : "<p>Keine Preisliste ausgewählt.</p>";

    return listLayout("Preislisten", "Neue Preisliste", list, form);
  }

  function bindPrices() {
    $$(".cms-list button[data-sel]").forEach((button) => {
      button.onclick = () => {
        selected.prices = Number(button.dataset.sel);
        renderTab();
      };
    });

    $("#addItem").onclick = () => {
      data.priceLists.push({ factionId: "rettungsdienst", title: "Neue Preisliste", items: [] });
      selected.prices = data.priceLists.length - 1;
      renderTab();
    };

    const save = $("#savePrice");
    if (save) {
      save.onclick = () => {
        const priceList = data.priceLists[selected.prices || 0];
        priceList.title = val("pr_title");
        priceList.factionId = val("pr_faction");
        priceList.items = val("pr_items").split(/\r?\n/).filter(Boolean).map((line) => {
          const parts = line.split("|");
          return { name: parts[0] || "", price: parts[1] || "", note: parts.slice(2).join("|") || "" };
        });
        renderTab();
        setStatus("Preisliste übernommen. Danach alle Änderungen speichern.");
      };
    }

    const del = $("#deletePrice");
    if (del) {
      del.onclick = () => {
        if (confirm("Preisliste löschen?")) {
          data.priceLists.splice(selected.prices || 0, 1);
          selected.prices = 0;
          renderTab();
        }
      };
    }
  }

  function renderSimple(kind, title, fields) {
    const arr = data[kind] || [];
    const idx = selected[kind] || 0;
    const item = arr[idx] || {};

    const list = arr.map((entry, index) =>
      '<button type="button" data-sel="' + index + '" class="' + (index === idx ? "active" : "") + '">' +
      esc(entry.name || entry.title || "Eintrag") + '<br><span class="cms-small">' + esc(entry.factionId || "") + "</span></button>"
    ).join("");

    const form = fields.map((field) =>
      '<label>' + esc(field) + '</label>' +
      (field === "description" || field === "note"
        ? '<textarea id="s_' + esc(field) + '">' + esc(item[field] || "") + '</textarea>'
        : '<input id="s_' + esc(field) + '" value="' + esc(item[field] || "") + '">')
    ).join("") + '<div class="admin-actions"><button id="saveSimple" type="button">Übernehmen</button><button class="cms-danger" id="deleteSimple" type="button">Löschen</button></div>';

    return listLayout(title, "Neuer Eintrag", list, form);
  }

  function bindSimple(kind, fields) {
    $$(".cms-list button[data-sel]").forEach((button) => {
      button.onclick = () => {
        selected[kind] = Number(button.dataset.sel);
        renderTab();
      };
    });

    $("#addItem").onclick = () => {
      const item = {};
      fields.forEach((field) => item[field] = "");
      item.name = "Neuer Eintrag";
      item.factionId = "justiz";
      data[kind].push(item);
      selected[kind] = data[kind].length - 1;
      renderTab();
    };

    const save = $("#saveSimple");
    if (save) {
      save.onclick = () => {
        const item = data[kind][selected[kind] || 0];
        fields.forEach((field) => item[field] = val("s_" + field));
        renderTab();
        setStatus("Eintrag übernommen. Danach alle Änderungen speichern.");
      };
    }

    const del = $("#deleteSimple");
    if (del) {
      del.onclick = () => {
        if (confirm("Eintrag löschen?")) {
          data[kind].splice(selected[kind] || 0, 1);
          selected[kind] = 0;
          renderTab();
        }
      };
    }
  }

  function renderSettings() {
    const settings = data.settings || {};
    return [
      '<h2>Einstellungen</h2>',
      '<div class="cms-form">',
      '<label>Servername</label><input id="set_serverName" value="' + esc(settings.serverName || "") + '">',
      '<label>Discord-Link</label><input id="set_discordUrl" value="' + esc(settings.discordUrl || "") + '">',
      '<label>Logo URL</label><input id="set_logo" value="' + esc(settings.logo || "") + '">',
      '<label>Disclaimer</label><textarea id="set_disclaimer">' + esc(settings.disclaimer || "") + '</textarea>',
      '<div class="admin-actions"><button id="saveSettings" type="button">Einstellungen übernehmen</button></div>',
      '</div>'
    ].join("");
  }

  function bindSettings() {
    $("#saveSettings").onclick = () => {
      data.settings.serverName = val("set_serverName");
      data.settings.discordUrl = val("set_discordUrl");
      data.settings.logo = val("set_logo");
      data.settings.disclaimer = val("set_disclaimer");
      setStatus("Einstellungen übernommen. Danach alle Änderungen speichern.");
    };
  }

  function renderPassword() {
    return [
      '<h2>Passwort ändern</h2>',
      '<div class="cms-form">',
      '<label>Neues Passwort</label><input id="newPassword" type="password">',
      '<div class="admin-actions"><button id="changePassword" type="button">Passwort auf GitHub ändern</button></div>',
      '</div>'
    ].join("");
  }

  function bindPassword() {
    $("#changePassword").onclick = async () => {
      try {
        const newPassword = val("newPassword");

        if (!newPassword || newPassword.length < 8) {
          throw new Error("Passwort muss mindestens 8 Zeichen haben.");
        }

        const hash = await sha256(newPassword);
        const text = [
          "window.EISENFELS_ADMIN_CONFIG = {",
          '  passwordHash: "' + hash + '",',
          '  repoOwner: "' + cfg.repoOwner + '",',
          '  repoName: "' + cfg.repoName + '",',
          '  branch: "' + cfg.branch + '",',
          '  contentPath: "' + cfg.contentPath + '"',
          "};",
          ""
        ].join("\n");

        const file = await ghGet("MephMK/admin-config.js");
        await ghPut("MephMK/admin-config.js", text, "Admin Passwort geändert", file.sha);
        setStatus("Passwort geändert. Neu laden und mit neuem Passwort einloggen.");
      } catch (error) {
        showError(error);
        setStatus("Fehler beim Passwort ändern.", false);
      }
    };
  }

  function bindTab() {
    if (activeTab === "pages") bindPages();
    if (activeTab === "laws") bindLaws();
    if (activeTab === "events") bindItems("events");
    if (activeTab === "trainings") bindItems("trainings");
    if (activeTab === "prices") bindPrices();
    if (activeTab === "departments") bindSimple("departments", ["factionId", "name", "description", "slug", "icon", "logo", "banner"]);
    if (activeTab === "contacts") bindSimple("contacts", ["factionId", "name", "role", "discord", "email", "note"]);
    if (activeTab === "settings") bindSettings();
    if (activeTab === "password") bindPassword();
  }

  function bindBaseButtons() {
    $("#loginBtn").addEventListener("click", login);
    $("#password").addEventListener("keydown", (event) => {
      if (event.key === "Enter") login();
    });

    $("#saveToken").addEventListener("click", () => {
      localStorage.setItem("ef_github_token", $("#token").value.trim());
      setStatus("Token lokal gespeichert.");
    });

    $("#loadContent").addEventListener("click", loadContent);
    $("#saveGithub").addEventListener("click", saveGithub);
    $("#logout").addEventListener("click", () => {
      sessionStorage.removeItem("ef_admin");
      location.reload();
    });

    $$(".cms-tab").forEach((button) => {
      button.addEventListener("click", () => {
        activeTab = button.dataset.tab;
        renderTab();
      });
    });
  }

  function boot() {
    try {
      cfg = window.EISENFELS_ADMIN_CONFIG;

      if (!cfg) {
        throw new Error("admin-config.js wurde nicht geladen.");
      }

      bindBaseButtons();

      const bootStatus = $("#bootStatus");
      if (bootStatus) {
        bootStatus.textContent = "CMS geladen. Repo: " + cfg.repoOwner + "/" + cfg.repoName;
      }

      if (sessionStorage.getItem("ef_admin") === "1") {
        $("#loginBox").style.display = "none";
        $("#cmsBox").style.display = "block";
        $("#token").value = localStorage.getItem("ef_github_token") || "";
      }
    } catch (error) {
      showError(error);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
