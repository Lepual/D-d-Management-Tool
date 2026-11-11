"use strict";

/* =========================================================
 * Utility
 * ========================================================= */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

/* =========================================================
 * Tabs (sezione scheda)
 * ========================================================= */
$$(".tab").forEach((tab) =>
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.toggle("active", t === tab));
    $$(".tab-body").forEach((b) => b.classList.toggle("active", b.id === `tab-${tab.dataset.tab}`));
    store.set("dnd.tab", tab.dataset.tab);
  })
);
const savedTab = store.get("dnd.tab", "pdf");
$(`.tab[data-tab="${savedTab}"]`)?.click();

/* =========================================================
 * PDF: caricamento, anteprima, persistenza in IndexedDB
 * ========================================================= */
const pdfDB = {
  open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("dnd-tool", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async run(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("files", mode);
      const req = fn(tx.objectStore("files"));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  save: (file) => pdfDB.run("readwrite", (s) => s.put(file, "sheet-pdf")),
  load: () => pdfDB.run("readonly", (s) => s.get("sheet-pdf")),
  remove: () => pdfDB.run("readwrite", (s) => s.delete("sheet-pdf")),
};

let pdfUrl = null;

function showPdf(file) {
  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  const frame = $("#pdf-frame");
  if (!file) {
    pdfUrl = null;
    frame.hidden = true;
    frame.removeAttribute("src");
    $("#pdf-empty").hidden = false;
    $("#pdf-name").textContent = "Nessun PDF caricato";
    $("#pdf-open").hidden = $("#pdf-remove").hidden = true;
    return;
  }
  pdfUrl = URL.createObjectURL(file);
  frame.src = pdfUrl + "#view=FitH";
  frame.hidden = false;
  $("#pdf-empty").hidden = true;
  $("#pdf-name").textContent = file.name || "scheda.pdf";
  $("#pdf-open").hidden = $("#pdf-remove").hidden = false;
}

async function setPdf(file) {
  if (!file || file.type !== "application/pdf") {
    alert("Seleziona un file PDF.");
    return;
  }
  showPdf(file);
  try {
    await pdfDB.save(file);
  } catch (e) {
    console.warn("Impossibile salvare il PDF in locale", e);
  }
}

$("#pdf-input").addEventListener("change", (e) => {
  setPdf(e.target.files[0]);
  e.target.value = "";
});
$("#pdf-open").addEventListener("click", () => pdfUrl && window.open(pdfUrl, "_blank"));
$("#pdf-remove").addEventListener("click", async () => {
  showPdf(null);
  try {
    await pdfDB.remove();
  } catch {}
});

const drop = $("#pdf-drop");
["dragenter", "dragover"].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add("drag");
  })
);
["dragleave", "drop"].forEach((ev) =>
  drop.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.remove("drag");
  })
);
drop.addEventListener("drop", (e) => setPdf(e.dataTransfer.files[0]));

pdfDB
  .load()
  .then((file) => file && showPdf(file))
  .catch(() => {});

/* =========================================================
 * Scheda: struttura da sheet-config.js, valori calcolati
 * ========================================================= */
const SHEET_KEY = "dnd.sheet";
let sheet = store.get(SHEET_KEY, null) ?? { ...window.DEFAULT_SHEET };

const num = (v, d = 0) => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? d : n;
};
const fmtBonus = (n) => (n >= 0 ? `+${n}` : `${n}`);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const calc = {
  pb: () => num(sheet.pb, 2),
  mod: (ab) => Math.floor((num(sheet[`score_${ab}`], 10) - 10) / 2),
  save: (ab) => calc.mod(ab) + (sheet[`save_${ab}`] ? calc.pb() : 0),
  skill(id) {
    const ab = window.ABILITIES.find((a) => a.skills.some((s) => s.id === id)).id;
    const mult = sheet[`exp_${id}`] ? 2 : sheet[`prof_${id}`] ? 1 : 0;
    return calc.mod(ab) + mult * calc.pb();
  },
  init: () => calc.mod("des"),
  passive: (id) => 10 + calc.skill(id),
};

// "ability:for" | "save:for" | "skill:atletica" | "init" -> { label, bonus }
// Restituisce { label, parts }: ogni parte è un addendo con nome (es. FOR +2, Competenza +2)
function resolveRoll(key) {
  const [kind, id] = key.split(":");
  const abShort = (abId) => abId.toUpperCase();
  const pb = calc.pb();
  if (kind === "ability") {
    const ab = window.ABILITIES.find((a) => a.id === id);
    return { label: `Prova di ${ab.name}`, parts: [{ name: abShort(id), value: calc.mod(id) }] };
  }
  if (kind === "save") {
    const ab = window.ABILITIES.find((a) => a.id === id);
    const parts = [{ name: abShort(id), value: calc.mod(id) }];
    if (sheet[`save_${id}`]) parts.push({ name: "Competenza", value: pb });
    return { label: `TS ${ab.name}`, parts };
  }
  if (kind === "skill") {
    const ab = window.ABILITIES.find((a) => a.skills.some((s) => s.id === id));
    const sk = ab.skills.find((s) => s.id === id);
    const parts = [{ name: abShort(ab.id), value: calc.mod(ab.id) }];
    if (sheet[`exp_${id}`]) parts.push({ name: "Maestria", value: pb * 2 });
    else if (sheet[`prof_${id}`]) parts.push({ name: "Competenza", value: pb });
    return { label: sk.name, parts };
  }
  if (kind === "init") return { label: "Iniziativa", parts: [{ name: "DES", value: calc.init() }] };
}

const check = (name, cls, title) =>
  `<input type="checkbox" class="${cls}" name="${name}" title="${title}" ${sheet[name] ? "checked" : ""} />`;

function renderSheet() {
  const abilities = window.ABILITIES.map(
    (ab) => `
    <div class="ab-block">
      <div class="ab-shield">
        <button type="button" class="ab-mod roll-btn" data-roll="ability:${ab.id}" data-calc="mod:${ab.id}" title="Tira prova di ${ab.name}"></button>
        <input type="number" class="ab-score" name="score_${ab.id}" value="${esc(sheet[`score_${ab.id}`])}" placeholder="10" title="Punteggio" />
      </div>
      <div class="ab-list">
        <h4>${ab.name}</h4>
        <div class="sk sk-save">
          ${check(`save_${ab.id}`, "dot", "Competenza")}<span class="diamond-spacer"></span>
          <span class="sk-val" data-calc="save:${ab.id}"></span>
          <button type="button" class="sk-name roll-btn" data-roll="save:${ab.id}"><strong>Tiro Salvezza</strong></button>
        </div>
        ${ab.skills
          .map(
            (s) => `
        <div class="sk">
          ${check(`prof_${s.id}`, "dot", "Competenza")}${check(`exp_${s.id}`, "diamond", "Maestria")}
          <span class="sk-val" data-calc="skill:${s.id}"></span>
          <button type="button" class="sk-name roll-btn" data-roll="skill:${s.id}">${s.name}${
              s.armorPenalty ? ' <span class="armor-pen" title="Penalità per armatura">🛡</span>' : ""
            }</button>
        </div>`
          )
          .join("")}
      </div>
    </div>`
  ).join("");

  $("#sheet-form").innerHTML = `
    <div class="cs-name">
      <input name="nome" value="${esc(sheet.nome)}" placeholder="Nome" />
      <span>Nome Personaggio</span>
    </div>
    <div class="cs-cols">
      <div class="cs-abilities">
        ${abilities}
        <p class="legend"><span class="dot-ico"></span> Competenza · <span class="diamond-ico"></span> Maestria · 🛡 Penalità per armatura · <em>clic su un nome per tirare</em></p>
      </div>
      <div class="cs-side">
        <div class="stat-row">
          <div class="stat">
            <input type="number" name="pb" value="${esc(sheet.pb)}" class="stat-val" />
            <span>Bonus competenza</span>
          </div>
          <div class="stat">
            <button type="button" class="stat-val roll-btn" data-roll="init" data-calc="init"></button>
            <span>Iniziativa</span>
          </div>
        </div>

        <div class="box">
          <div class="box-head">
            <input type="number" name="ca" value="${esc(sheet.ca)}" class="stat-val shield" />
            <span>Classe Armatura</span>
          </div>
          <input name="armatura" value="${esc(sheet.armatura)}" placeholder="Armatura" class="line-input" />
        </div>

        <div class="box">
          <label class="hp-row">Massimo dei punti ferita
            <input type="number" name="pf_max" value="${esc(sheet.pf_max)}" class="line-input short" />
          </label>
          <div class="hp-current">
            <span>Punti ferita attuali</span>
            <div class="hp-ctrl">
              <button type="button" data-hp="-1">−</button>
              <input type="number" name="pf" value="${esc(sheet.pf)}" />
              <button type="button" data-hp="1">+</button>
            </div>
            <div class="hp-bar"><div id="hp-fill"></div></div>
          </div>
        </div>

        <label class="passive"><input type="number" name="passive_percepire" value="${esc(sheet.passive_percepire)}" data-placeholder="passive:percepire" title="Vuoto = calcolato automaticamente" />Saggezza (Percepire) passiva</label>
        <label class="passive"><input type="number" name="passive_indagare" value="${esc(sheet.passive_indagare)}" data-placeholder="passive:indagare" title="Vuoto = calcolato automaticamente" />Intelligenza (Indagare) passivo</label>
      </div>
    </div>`;
  recalc();
}

function recalc() {
  $$("[data-calc]").forEach((el) => {
    const [kind, id] = el.dataset.calc.split(":");
    const v = calc[kind](id);
    el.textContent = kind === "passive" ? v : fmtBonus(v);
  });
  // campi modificabili a mano: se vuoti mostrano il valore calcolato come suggerimento
  $$("[data-placeholder]").forEach((el) => {
    const [kind, id] = el.dataset.placeholder.split(":");
    el.placeholder = calc[kind](id);
  });
  const max = num(sheet.pf_max, 0);
  const cur = num(sheet.pf, 0);
  const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
  const fill = $("#hp-fill");
  if (fill) {
    fill.style.width = pct + "%";
    fill.className = pct <= 25 ? "low" : pct <= 50 ? "mid" : "";
  }
}

function saveSheet() {
  store.set(SHEET_KEY, sheet);
  recalc();
}

$("#sheet-form").addEventListener("input", (e) => {
  const el = e.target;
  if (!el.name) return;
  sheet[el.name] = el.type === "checkbox" ? el.checked : el.value;
  saveSheet();
});

$("#sheet-form").addEventListener("click", (e) => {
  const hpBtn = e.target.closest("[data-hp]");
  if (hpBtn) {
    const input = $('input[name="pf"]');
    input.value = num(input.value) + num(hpBtn.dataset.hp);
    sheet.pf = input.value;
    saveSheet();
    return;
  }
  const rollBtn = e.target.closest(".roll-btn");
  if (rollBtn) {
    const { label, parts } = resolveRoll(rollBtn.dataset.roll);
    rollCheck(label, parts);
  }
});
$("#sheet-form").addEventListener("submit", (e) => e.preventDefault());

/* ---- Salva / carica scheda completa (campi + PDF + cronologia) ---- */
const blobToDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// es. "2026-11-11 15.30"
const stamp = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(
    d.getHours()
  ).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
const safeName = (s) => String(s || "").replace(/[\\/:*?"<>|]+/g, "").trim();

function setSavedInfo(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}

$("#sheet-export").addEventListener("click", async () => {
  let pdf = null;
  try {
    const file = await pdfDB.load();
    if (file) pdf = { name: file.name || "scheda.pdf", data: await blobToDataURL(file) };
  } catch {}
  const now = new Date();
  downloadJSON(
    { kind: "dnd-scheda", version: 1, savedAt: now.toISOString(), sheet, pdf, history },
    `${safeName(sheet.nome) || "scheda"} - scheda ${stamp(now)}.json`
  );
  setSavedInfo("#sheet-saved-info", `Salvata alle ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`);
});

$("#sheet-import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    return alert("Il file non è valido.");
  }
  if (data.kind === "dnd-partita") return alert("Questo è un file di partita del DM: caricalo dalla tab Dungeon Master.");
  // compatibile anche con i vecchi file che contenevano solo i campi
  const isFull = data.kind === "dnd-scheda";
  const nextSheet = isFull ? data.sheet || {} : data;
  if (!confirm(`Caricare la scheda di ${nextSheet.nome || "questo personaggio"}? Sostituirà quella attuale.`)) return;

  sheet = nextSheet;
  store.set(SHEET_KEY, sheet);
  renderSheet();

  if (isFull) {
    if (data.pdf?.data) {
      const blob = await (await fetch(data.pdf.data)).blob();
      await setPdf(new File([blob], data.pdf.name || "scheda.pdf", { type: "application/pdf" }));
    } else {
      showPdf(null);
      pdfDB.remove().catch(() => {});
    }
    if (Array.isArray(data.history)) {
      history = data.history;
      store.set("dnd.history", history);
      renderHistory();
    }
  }
  setSavedInfo("#sheet-saved-info", `Caricata da “${file.name}”`);
});
$("#sheet-reset").addEventListener("click", () => {
  if (!confirm("Svuotare tutti i campi della scheda?")) return;
  sheet = {};
  store.set(SHEET_KEY, sheet);
  renderSheet();
});

renderSheet();

/* =========================================================
 * Dadi
 * ========================================================= */
const DICE = [4, 6, 8, 10, 12, 20, 100];
const pool = Object.fromEntries(DICE.map((d) => [d, 0]));
let advMode = "normal";

// numero casuale crittograficamente uniforme 1..sides
function rollDie(sides) {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / sides) * sides;
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return (x % sides) + 1;
}

const DIE_SHAPES = {
  4: '<polygon points="50,8 94,88 6,88"/>',
  6: '<rect x="12" y="12" width="76" height="76" rx="10"/>',
  8: '<polygon points="50,4 94,50 50,96 6,50"/>',
  10: '<polygon points="50,4 94,40 80,92 20,92 6,40"/>',
  12: '<polygon points="50,4 90,24 96,64 70,94 30,94 4,64 10,24"/>',
  20: '<polygon points="50,4 92,28 92,72 50,96 8,72 8,28"/>',
  100: '<circle cx="50" cy="50" r="44"/>',
};

function renderDiceGrid() {
  const grid = $("#dice-grid");
  grid.innerHTML = DICE.map(
    (d) => `
      <button class="die" data-die="${d}" title="Aggiungi d${d} (clic destro per togliere)">
        <svg viewBox="0 0 100 100" aria-hidden="true">${DIE_SHAPES[d]}</svg>
        <span class="die-label">d${d}</span>
        <span class="die-count" hidden></span>
        <span class="die-ctrl" hidden>
          <span class="die-step" data-step="-1" role="button" aria-label="Togli un d${d}">−</span>
          <span class="die-step" data-step="1" role="button" aria-label="Aggiungi un d${d}">+</span>
        </span>
      </button>`
  ).join("");
}

function renderPool() {
  for (const d of DICE) {
    const badge = $(`.die[data-die="${d}"] .die-count`);
    badge.hidden = pool[d] === 0;
    badge.textContent = pool[d];
    $(`.die[data-die="${d}"] .die-ctrl`).hidden = pool[d] === 0;
    $(`.die[data-die="${d}"]`).classList.toggle("selected", pool[d] > 0);
  }
  const parts = DICE.filter((d) => pool[d]).map((d) => `${pool[d]}d${d}`);
  const mod = parseInt($("#modifier").value, 10) || 0;
  $("#pool").innerHTML = parts.length
    ? `<span class="formula">${parts.join(" + ")}${mod ? (mod > 0 ? ` + ${mod}` : ` − ${-mod}`) : ""}</span>`
    : '<span class="muted">Nessun dado selezionato</span>';
}

$("#dice-grid").addEventListener("click", (e) => {
  const btn = e.target.closest(".die");
  if (!btn) return;
  const step = e.target.closest("[data-step]");
  const d = btn.dataset.die;
  pool[d] = Math.max(0, pool[d] + (step ? Number(step.dataset.step) : 1));
  renderPool();
});
$("#dice-grid").addEventListener("contextmenu", (e) => {
  const btn = e.target.closest(".die");
  if (!btn) return;
  e.preventDefault();
  const d = btn.dataset.die;
  if (pool[d] > 0) pool[d]--;
  renderPool();
});

$$("[data-mod]").forEach((b) =>
  b.addEventListener("click", () => {
    const input = $("#modifier");
    input.value = (parseInt(input.value, 10) || 0) + parseInt(b.dataset.mod, 10);
    renderPool();
  })
);
$("#modifier").addEventListener("input", renderPool);

$$("#adv-mode button").forEach((b) =>
  b.addEventListener("click", () => {
    advMode = b.dataset.adv;
    $$("#adv-mode button").forEach((x) => x.classList.toggle("active", x === b));
  })
);

$("#reset-pool").addEventListener("click", () => {
  DICE.forEach((d) => (pool[d] = 0));
  $("#modifier").value = 0;
  renderPool();
});

/* ---- Tiro ---- */
let history = store.get("dnd.history", []);

function doRoll() {
  const selected = DICE.filter((d) => pool[d]);
  if (!selected.length) {
    // nessun dado: tira un d20 come scorciatoia
    pool[20] = 1;
    renderPool();
    return doRoll();
  }
  const mod = parseInt($("#modifier").value, 10) || 0;
  const groups = [];
  let total = 0;

  for (const d of selected) {
    const rolls = [];
    for (let i = 0; i < pool[d]; i++) {
      rolls.push(d === 20 ? rollD20() : { value: rollDie(d), sides: d });
    }
    total += rolls.reduce((s, r) => s + r.value, 0);
    groups.push({ sides: d, rolls });
  }
  total += mod;

  const entry = {
    formula: $("#pool .formula")?.textContent || "",
    adv: selected.includes(20) ? advMode : "normal",
    groups,
    mod,
    total,
    time: Date.now(),
  };
  pushEntry(entry);
}

// d20 con vantaggio/svantaggio secondo l'opzione selezionata
function rollD20() {
  if (advMode === "normal") return { value: rollDie(20), sides: 20 };
  const a = rollDie(20);
  const b = rollDie(20);
  const kept = advMode === "adv" ? Math.max(a, b) : Math.min(a, b);
  return { value: kept, dropped: kept === a ? b : a, sides: 20 };
}

// Tiro dalla scheda: d20 + bonus (prova, tiro salvezza, abilità, iniziativa)
function rollCheck(label, parts) {
  const r = rollD20();
  const bonus = parts.reduce((s, p) => s + p.value, 0);
  const signed = (n) => (n >= 0 ? ` + ${n}` : ` − ${-n}`);
  pushEntry({
    label,
    formula: `${label} d20${signed(bonus)}`,
    adv: advMode,
    groups: [{ sides: 20, rolls: [r] }],
    parts,
    mod: bonus,
    total: r.value + bonus,
    time: Date.now(),
  });
}

function pushEntry(entry) {
  showResult(entry);
  history.unshift(entry);
  history = history.slice(0, 50);
  store.set("dnd.history", history);
  renderHistory();
}

function rollChip(r) {
  let cls = "chip";
  if (r.sides === 20 && r.value === 20) cls += " crit";
  if (r.sides === 20 && r.value === 1) cls += " fumble";
  const dropped = r.dropped != null ? `<s class="dropped">${r.dropped}</s>` : "";
  return `<span class="${cls}"><small>d${r.sides}</small>${r.value}${dropped}</span>`;
}

function showResult(entry) {
  const res = $("#result");
  res.classList.remove("pop");
  void res.offsetWidth; // riavvia animazione
  res.classList.add("pop");

  $("#result-total").textContent = entry.total;
  const chips = entry.groups.flatMap((g) => g.rolls.map(rollChip)).join("");
  const sign = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
  const modTxt = entry.parts
    ? `<span class="chip mod"><small>bonus</small>${sign(entry.mod)}</span>` +
      `<span class="breakdown">${entry.parts.map((p) => `${esc(p.name)} ${sign(p.value)}`).join(" + ")}</span>`
    : entry.mod ?`<span class="chip mod">${entry.mod > 0 ? "+" : "−"}${Math.abs(entry.mod)}</span>` : "";
  const advTxt =
    entry.adv === "adv" ? '<span class="tag">Vantaggio</span>' : entry.adv === "dis" ? '<span class="tag">Svantaggio</span>' : "";
  const labelTxt = entry.label ? `<span class="tag label">${esc(entry.label)}</span>` : "";
  $("#result-detail").innerHTML = labelTxt + chips + modTxt + advTxt;

  $$(".die").forEach((b) => {
    if (entry.label ? b.dataset.die === "20" : pool[b.dataset.die]) {
      b.classList.remove("shake");
      void b.offsetWidth;
      b.classList.add("shake");
    }
  });
}

function renderHistory() {
  const fmtTime = (t) => new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("#history").innerHTML = history
    .map((h) => {
      const vals = h.groups.flatMap((g) => g.rolls.map((r) => r.value)).join(", ");
      const adv = h.adv === "adv" ? " · V" : h.adv === "dis" ? " · S" : "";
      return `<li><span class="h-formula">${h.formula}${adv}</span><span class="h-vals">[${vals}]</span><strong>${h.total}</strong><time>${fmtTime(h.time)}</time></li>`;
    })
    .join("");
}

$("#roll").addEventListener("click", doRoll);
$("#clear-history").addEventListener("click", () => {
  history = [];
  store.set("dnd.history", history);
  renderHistory();
});

// Scorciatoia: barra spaziatrice / Invio per tirare (se non si sta scrivendo)
document.addEventListener("keydown", (e) => {
  if (e.target.closest("input, textarea")) return;
  if (e.code === "Space" || e.key === "Enter") {
    e.preventDefault();
    doRoll();
  }
});

renderDiceGrid();
renderPool();
renderHistory();
