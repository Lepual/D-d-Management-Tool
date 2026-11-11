"use strict";
/* =========================================================
 * Modalità: Giocatore / Dungeon Master
 * Il pannello dadi a destra è condiviso fra le due modalità.
 * ========================================================= */
function setMode(mode) {
  $$(".mode-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  $$("[data-mode-panel]").forEach((p) => (p.hidden = p.dataset.modePanel !== mode));
  store.set("dnd.mode", mode);
}
$$(".mode-tab").forEach((t) => t.addEventListener("click", () => setMode(t.dataset.mode)));
setMode(store.get("dnd.mode", "player"));

/* =========================================================
 * Tracker di combattimento (DM)
 * combatant: { id, type: "pc"|"enemy"|"ally", name, ca, hpMax, hp, initBonus, init, img }
 * ========================================================= */
const DM_KEY = "dnd.dm";
let dm = store.get(DM_KEY, null) ?? { combatants: [], round: 1, turnId: null };

const TYPE_LABEL = { pc: "Giocatore", enemy: "Nemico", ally: "Alleato" };
const uid = () => Math.random().toString(36).slice(2, 10);
const intOr = (v, d = null) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? d : n;
};

function saveDM() {
  try {
    localStorage.setItem(DM_KEY, JSON.stringify(dm));
  } catch {
    alert("Spazio di salvataggio pieno: prova a usare immagini più piccole o a rimuovere qualche partecipante.");
  }
}

// ordine: iniziativa più alta prima; a parità vince il bonus più alto; senza iniziativa in fondo
function ordered() {
  return [...dm.combatants].sort((a, b) => {
    const ai = a.init ?? -Infinity;
    const bi = b.init ?? -Infinity;
    if (bi !== ai) return bi - ai;
    return (b.initBonus ?? 0) - (a.initBonus ?? 0);
  });
}

const rollInit = (c) => rollDie(20) + (c.initBonus ?? 0);

// riduce un'immagine a miniatura quadrata (per non riempire lo spazio di salvataggio)
function toThumb(file, size = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const s = Math.min(img.width, img.height);
      canvas
        .getContext("2d")
        .drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function hpClass(c) {
  if (!c.hpMax) return "";
  const pct = c.hp / c.hpMax;
  return c.hp <= 0 ? "down" : pct <= 0.25 ? "low" : pct <= 0.5 ? "mid" : "";
}

function renderTracker() {
  $("#dm-round").textContent = `Round ${dm.round}`;
  const list = ordered();
  if (!list.length) {
    $("#tracker").innerHTML = '<li class="tracker-empty muted">Nessun partecipante. Aggiungi giocatori e nemici qui sopra.</li>';
    return;
  }
  $("#tracker").innerHTML = list
    .map((c) => {
      const pct = c.hpMax ? Math.max(0, Math.min(100, (c.hp / c.hpMax) * 100)) : 0;
      const initial = esc((c.name || "?").trim().charAt(0).toUpperCase());
      return `
      <li class="combatant type-${c.type} ${c.id === dm.turnId ? "current" : ""} ${hpClass(c) === "down" ? "is-down" : ""}" data-id="${c.id}">
        <div class="c-turn" title="Turno attuale">${c.id === dm.turnId ? "▶" : ""}</div>
        <button type="button" class="c-img" data-act="img" title="Cambia immagine">
          ${c.img ? `<img src="${c.img}" alt="" />` : `<span>${initial}</span>`}
        </button>
        <div class="c-name">
          <input data-field="name" value="${esc(c.name)}" />
          <span class="c-type">${TYPE_LABEL[c.type] || ""}</span>
        </div>
        <label class="c-stat c-ca" title="Classe Armatura">
          <span>CA</span><input type="number" data-field="ca" value="${c.ca ?? ""}" />
        </label>
        <label class="c-stat c-init" title="Iniziativa (bonus ${fmtBonus(c.initBonus ?? 0)})">
          <span>Iniz.</span>
          <div class="c-init-row">
            <input type="number" data-field="init" value="${c.init ?? ""}" />
            <button type="button" data-act="roll-init" title="Tira d20 ${fmtBonus(c.initBonus ?? 0)}">🎲</button>
          </div>
        </label>
        <div class="c-hp ${hpClass(c)}">
          <div class="c-hp-top">
            <span>PF</span>
            <input type="number" data-field="hp" value="${c.hp ?? ""}" />
            <span class="muted">/</span>
            <input type="number" data-field="hpMax" value="${c.hpMax ?? ""}" class="hp-max" />
          </div>
          <div class="c-hp-bar"><div style="width:${pct}%"></div></div>
          <div class="c-hp-ctrl">
            <input type="number" class="c-amount" min="0" placeholder="0" />
            <button type="button" data-act="dmg" class="dmg">Danno</button>
            <button type="button" data-act="heal" class="heal">Cura</button>
          </div>
        </div>
        <button type="button" class="c-remove" data-act="remove" title="Rimuovi">✕</button>
      </li>`;
    })
    .join("");
}

function update() {
  saveDM();
  renderTracker();
  renderMap();
}

/* ---- Aggiunta ---- */
$("#dm-add").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const qty = Math.max(1, intOr(f.get("qty"), 1));
  const name = String(f.get("name")).trim();
  const file = f.get("img");
  let img = null;
  if (file && file.size) {
    try {
      img = await toThumb(file);
    } catch {}
  }
  const hpMax = intOr(f.get("hp"));
  const initBonus = intOr(f.get("initBonus"), 0);
  const fixedInit = intOr(f.get("init"));
  for (let i = 1; i <= qty; i++) {
    const c = {
      id: uid(),
      type: f.get("type"),
      name: qty > 1 ? `${name} ${i}` : name,
      ca: intOr(f.get("ca")),
      hpMax,
      hp: hpMax,
      initBonus,
      init: null,
      img,
    };
    // ogni copia tira la sua iniziativa, a meno che non sia stata scritta a mano
    c.init = fixedInit ?? rollInit(c);
    dm.combatants.push(c);
  }
  e.target.reset();
  e.target.querySelector('[name="qty"]').value = 1;
  e.target.querySelector('[name="type"]').value = f.get("type");
  update();
});

// importa il personaggio dalla scheda giocatore
$("#dm-add-me").addEventListener("click", () => {
  const name = sheet.nome || "Personaggio";
  const existing = dm.combatants.find((c) => c.type === "pc" && c.name === name);
  const data = {
    name,
    ca: intOr(sheet.ca),
    hpMax: intOr(sheet.pf_max),
    hp: intOr(sheet.pf, intOr(sheet.pf_max)),
    initBonus: calc.init(),
  };
  if (existing) Object.assign(existing, data);
  else dm.combatants.push({ id: uid(), type: "pc", init: null, img: null, ...data });
  update();
});

/* ---- Modifiche inline ---- */
$("#tracker").addEventListener("change", (e) => {
  const el = e.target;
  const field = el.dataset.field;
  if (!field) return;
  const c = dm.combatants.find((x) => x.id === el.closest("[data-id]").dataset.id);
  c[field] = field === "name" ? el.value : intOr(el.value);
  if (field === "hpMax" && c.hp == null) c.hp = c.hpMax;
  update();
});

$("#tracker").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const row = btn.closest("[data-id]");
  const c = dm.combatants.find((x) => x.id === row.dataset.id);
  const act = btn.dataset.act;

  if (act === "remove") {
    if (!confirm(`Rimuovere ${c.name}?`)) return;
    if (dm.turnId === c.id) advanceTurn(1);
    dm.combatants = dm.combatants.filter((x) => x !== c);
    if (!dm.combatants.length) dm.turnId = null;
  } else if (act === "roll-init") {
    c.init = rollInit(c);
  } else if (act === "dmg" || act === "heal") {
    const amount = Math.abs(intOr(row.querySelector(".c-amount").value, 0));
    if (!amount) return;
    const hp = c.hp ?? c.hpMax ?? 0;
    c.hp = act === "dmg" ? Math.max(0, hp - amount) : c.hpMax != null ? Math.min(c.hpMax, hp + amount) : hp + amount;
  } else if (act === "img") {
    const input = $("#dm-img-input");
    input.dataset.id = c.id;
    input.click();
    return;
  }
  update();
});

// Invio nel campo "quantità danno" = applica danno
$("#tracker").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.classList.contains("c-amount")) {
    e.preventDefault();
    e.target.closest("[data-id]").querySelector('[data-act="dmg"]').click();
  }
});

$("#dm-img-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const c = dm.combatants.find((x) => x.id === e.target.dataset.id);
  e.target.value = "";
  if (!file || !c) return;
  try {
    c.img = await toThumb(file);
    update();
  } catch {
    alert("Immagine non valida.");
  }
});

/* ---- Turni ---- */
function advanceTurn(step) {
  const list = ordered();
  if (!list.length) return;
  let i = list.findIndex((c) => c.id === dm.turnId);
  if (i === -1) {
    dm.turnId = list[0].id;
    return;
  }
  i += step;
  if (i >= list.length) {
    i = 0;
    dm.round++;
  } else if (i < 0) {
    i = list.length - 1;
    dm.round = Math.max(1, dm.round - 1);
  }
  dm.turnId = list[i].id;
}

$("#dm-next").addEventListener("click", () => {
  advanceTurn(1);
  update();
});
$("#dm-prev").addEventListener("click", () => {
  advanceTurn(-1);
  update();
});

/* ---- Azioni di gruppo ---- */
$("#dm-roll-enemies").addEventListener("click", () => {
  dm.combatants.filter((c) => c.type !== "pc").forEach((c) => (c.init = rollInit(c)));
  update();
});
$("#dm-new-fight").addEventListener("click", () => {
  dm.round = 1;
  dm.turnId = ordered()[0]?.id ?? null;
  update();
});
$("#dm-clear-enemies").addEventListener("click", () => {
  if (!confirm("Rimuovere tutti i nemici?")) return;
  dm.combatants = dm.combatants.filter((c) => c.type !== "enemy");
  if (!dm.combatants.some((c) => c.id === dm.turnId)) dm.turnId = null;
  update();
});
$("#dm-clear-all").addEventListener("click", () => {
  if (!confirm("Svuotare tutto il combattimento?")) return;
  dm = { combatants: [], round: 1, turnId: null };
  update();
});

/* =========================================================
 * Viste del pannello DM: Combattimento / Mappa
 * ========================================================= */
function setDMView(view) {
  $$(".vtab").forEach((t) => t.classList.toggle("active", t.dataset.view === view));
  $$(".dm-view").forEach((v) => (v.hidden = v.id !== `dm-view-${view}`));
  store.set("dnd.dmView", view);
  if (view === "map") renderMap();
}
$$(".vtab").forEach((t) => t.addEventListener("click", () => setDMView(t.dataset.view)));

/* =========================================================
 * Mappa: griglia, pedine, disegni, sfondo
 * dm.map = { cols, rows, cell, showGrid, strokes: [{ color, w, pts: [[x,y], ...] }] }  (coordinate in caselle)
 * combatant.pos = { x, y } | null
 * ========================================================= */
const TOKEN_COLORS = ["#3b2fd6", "#2e6b2a", "#7a3b1d", "#b3262b", "#d6801f", "#8a7a62", "#c9a227", "#6b2fa0", "#1f7a8c"];
let mapTool = "move";

function ensureMap() {
  dm.map ??= {};
  dm.map.cols ??= 16;
  dm.map.rows ??= 10;
  dm.map.cell ??= 64;
  dm.map.showGrid ??= true;
  dm.map.strokes ??= [];
  return dm.map;
}

function tokenColor(c) {
  if (c.color) return c.color;
  if (c.type === "enemy") return "#b3262b";
  let h = 0;
  for (const ch of c.name || "") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TOKEN_COLORS[h % TOKEN_COLORS.length];
}

const bgDB = {
  save: (v) => pdfDB.run("readwrite", (s) => s.put(v, "map-bg")),
  load: () => pdfDB.run("readonly", (s) => s.get("map-bg")),
  remove: () => pdfDB.run("readwrite", (s) => s.delete("map-bg")),
};

function showMapBg(dataUrl) {
  $("#map-bg").style.backgroundImage = dataUrl ? `url("${dataUrl}")` : "";
  $("#map-bg-remove").hidden = !dataUrl;
}

// immagine di sfondo ridotta (max 2000px) per non appesantire il salvataggio
function toMapImage(file, max = 2000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * k);
      canvas.height = Math.round(img.height * k);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function renderRoster() {
  const list = ordered();
  $("#map-roster").innerHTML = list.length
    ? list
        .map(
          (c) => `<button type="button" class="roster-chip ${c.pos ? "on" : ""} ${c.id === dm.turnId ? "current" : ""}" data-id="${c.id}" style="--tc:${tokenColor(c)}" title="${c.pos ? "Togli dalla mappa" : "Metti sulla mappa"}">
            ${c.img ? `<img src="${c.img}" alt="" />` : `<span class="chip-ini">${esc((c.name || "?").charAt(0).toUpperCase())}</span>`}
            ${esc(c.name)}</button>`
        )
        .join("")
    : '<span class="muted small">Nessun partecipante: aggiungili dalla vista Combattimento.</span>';
}

function strokeSVG(s, i) {
  return `<polyline data-i="${i}" points="${s.pts.map((p) => p.join(",")).join(" ")}" stroke="${s.color}" stroke-width="${s.w}" />`;
}

function renderMap() {
  const m = ensureMap();
  if ($("#dm-view-map").hidden) return; // niente da disegnare se la vista non è aperta
  const board = $("#map-board");
  board.style.width = `${m.cols * m.cell}px`;
  board.style.height = `${m.rows * m.cell}px`;
  board.style.setProperty("--cell", `${m.cell}px`);
  board.dataset.tool = mapTool;
  $("#map-grid").hidden = !m.showGrid;
  $("#map-cols").value = m.cols;
  $("#map-rows").value = m.rows;
  $("#map-zoom").value = m.cell;
  $("#map-grid-toggle").checked = m.showGrid;

  const svg = $("#map-draw");
  svg.setAttribute("viewBox", `0 0 ${m.cols} ${m.rows}`);
  svg.innerHTML = m.strokes.map(strokeSVG).join("");

  $("#map-tokens").innerHTML = dm.combatants
    .filter((c) => c.pos)
    .map((c) => {
      const cls = ["token", c.id === dm.turnId ? "current" : "", c.hpMax && c.hp <= 0 ? "down" : ""].join(" ");
      return `<div class="${cls}" data-id="${c.id}" style="left:${(c.pos.x + 0.5) * m.cell}px;top:${(c.pos.y + 0.5) * m.cell}px;--tc:${tokenColor(c)}" title="${esc(c.name)}${c.hpMax ? ` · PF ${c.hp}/${c.hpMax}` : ""}${c.ca != null ? ` · CA ${c.ca}` : ""}">
          <div class="token-face">${c.img ? `<img src="${c.img}" alt="" draggable="false" />` : `<span>${esc((c.name || "?").charAt(0).toUpperCase())}</span>`}</div>
          <div class="token-name">${esc(c.name)}</div>
        </div>`;
    })
    .join("");
  renderRoster();
}

function firstFreeCell() {
  const m = ensureMap();
  const taken = new Set(dm.combatants.filter((c) => c.pos).map((c) => `${c.pos.x},${c.pos.y}`));
  for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) if (!taken.has(`${x},${y}`)) return { x, y };
  return { x: 0, y: 0 };
}

$("#map-roster").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-id]");
  if (!chip) return;
  const c = dm.combatants.find((x) => x.id === chip.dataset.id);
  c.pos = c.pos ? null : firstFreeCell();
  update();
});

/* ---- Strumenti ---- */
$$("#map-tool button").forEach((b) =>
  b.addEventListener("click", () => {
    mapTool = b.dataset.tool;
    $$("#map-tool button").forEach((x) => x.classList.toggle("active", x === b));
    $("#map-board").dataset.tool = mapTool;
  })
);
$("#map-undo").addEventListener("click", () => {
  ensureMap().strokes.pop();
  update();
});
$("#map-clear-draw").addEventListener("click", () => {
  if (!ensureMap().strokes.length || !confirm("Cancellare tutti i disegni della mappa?")) return;
  dm.map.strokes = [];
  update();
});
$("#map-cols").addEventListener("change", (e) => {
  ensureMap().cols = Math.max(2, Math.min(60, intOr(e.target.value, 16)));
  update();
});
$("#map-rows").addEventListener("change", (e) => {
  ensureMap().rows = Math.max(2, Math.min(60, intOr(e.target.value, 10)));
  update();
});
$("#map-zoom").addEventListener("input", (e) => {
  ensureMap().cell = intOr(e.target.value, 64);
  update();
});
$("#map-grid-toggle").addEventListener("change", (e) => {
  ensureMap().showGrid = e.target.checked;
  update();
});
$("#map-bg-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const url = await toMapImage(file);
    showMapBg(url);
    await bgDB.save(url);
  } catch {
    alert("Immagine non valida.");
  }
});
$("#map-bg-remove").addEventListener("click", async () => {
  showMapBg(null);
  await bgDB.remove().catch(() => {});
});

/* ---- Trascinamento pedine e disegno ---- */
const board = $("#map-board");
let drag = null; // { el, c, dx, dy }
let stroke = null; // { data, el }

function boardPoint(e) {
  const r = board.getBoundingClientRect();
  const cell = ensureMap().cell;
  return { x: (e.clientX - r.left) / cell, y: (e.clientY - r.top) / cell };
}

board.addEventListener("pointerdown", (e) => {
  const m = ensureMap();
  if (mapTool === "move") {
    const el = e.target.closest(".token");
    if (!el) return;
    e.preventDefault();
    const c = dm.combatants.find((x) => x.id === el.dataset.id);
    const p = boardPoint(e);
    drag = { el, c, dx: p.x - (c.pos.x + 0.5), dy: p.y - (c.pos.y + 0.5) };
    el.classList.add("dragging");
    board.setPointerCapture(e.pointerId);
  } else if (mapTool === "draw") {
    e.preventDefault();
    const p = boardPoint(e);
    const data = { color: $("#map-color").value, w: 0.12, pts: [[+p.x.toFixed(2), +p.y.toFixed(2)]] };
    const svg = $("#map-draw");
    svg.insertAdjacentHTML("beforeend", strokeSVG(data, m.strokes.length));
    stroke = { data, el: svg.lastElementChild };
    board.setPointerCapture(e.pointerId);
  } else if (mapTool === "erase") {
    const line = e.target.closest("polyline");
    if (!line) return;
    m.strokes.splice(Number(line.dataset.i), 1);
    update();
  }
});

board.addEventListener("pointermove", (e) => {
  const cell = ensureMap().cell;
  if (drag) {
    const p = boardPoint(e);
    drag.el.style.left = `${(p.x - drag.dx) * cell}px`;
    drag.el.style.top = `${(p.y - drag.dy) * cell}px`;
  } else if (stroke) {
    const p = boardPoint(e);
    const last = stroke.data.pts[stroke.data.pts.length - 1];
    if (Math.hypot(p.x - last[0], p.y - last[1]) < 0.06) return;
    stroke.data.pts.push([+p.x.toFixed(2), +p.y.toFixed(2)]);
    stroke.el.setAttribute("points", stroke.data.pts.map((q) => q.join(",")).join(" "));
  }
});

function endPointer(e) {
  const m = ensureMap();
  if (drag) {
    const p = boardPoint(e);
    // aggancio alla casella più vicina, sempre dentro la griglia
    drag.c.pos = {
      x: Math.max(0, Math.min(m.cols - 1, Math.floor(p.x - drag.dx))),
      y: Math.max(0, Math.min(m.rows - 1, Math.floor(p.y - drag.dy))),
    };
    drag = null;
    update();
  } else if (stroke) {
    if (stroke.data.pts.length > 1) m.strokes.push(stroke.data);
    stroke = null;
    update();
  }
}
board.addEventListener("pointerup", endPointer);
board.addEventListener("pointercancel", endPointer);

board.addEventListener("dblclick", (e) => {
  const el = e.target.closest(".token");
  if (!el || mapTool !== "move") return;
  dm.combatants.find((x) => x.id === el.dataset.id).pos = null;
  update();
});

/* ---- Salva / carica partita (combattimento + mappa + sfondo) ---- */
$("#dm-export").addEventListener("click", async () => {
  const now = new Date();
  let mapBg = null;
  try {
    mapBg = (await bgDB.load()) || null;
  } catch {}
  downloadJSON({ kind: "dnd-partita", version: 2, savedAt: now.toISOString(), dm, mapBg }, `Partita ${stamp(now)}.json`);
  setSavedInfo("#dm-saved-info", `Salvata alle ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`);
});

$("#dm-import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return alert("Il file non è valido.");
  }
  if (data.kind === "dnd-scheda") return alert("Questo è un file di scheda: caricalo dalla tab Giocatore.");
  if (data.kind !== "dnd-partita" || !Array.isArray(data.dm?.combatants)) return alert("Questo file non è una partita salvata.");
  const when = data.savedAt ? new Date(data.savedAt).toLocaleString("it-IT") : "data sconosciuta";
  if (!confirm(`Caricare la partita salvata il ${when}? Sostituirà il combattimento attuale.`)) return;
  dm = { round: 1, turnId: null, ...data.dm };
  showMapBg(data.mapBg || null);
  try {
    data.mapBg ? await bgDB.save(data.mapBg) : await bgDB.remove();
  } catch {}
  update();
  setDMView("tracker");
  setSavedInfo("#dm-saved-info", `Caricata da “${file.name}”`);
});

/* ---- Avvio ---- */
ensureMap();
renderTracker();
setDMView(store.get("dnd.dmView", "tracker"));
bgDB
  .load()
  .then((url) => url && showMapBg(url))
  .catch(() => {});
