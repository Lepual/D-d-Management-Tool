"use strict";
/*
 * Lettura automatica dei campi dal PDF compilabile della scheda (modello italiano usato al tavolo).
 * Usa PDF.js (caricato solo quando serve) per leggere i campi del modulo e li abbina ai campi
 * dello strumento. Se il PDF non ha campi compatibili non succede nulla.
 */
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// nome della caratteristica nel PDF
const PDF_ABILITY = {
  for: "forza", des: "destrezza", cos: "costituzione",
  int: "intelligenza", sag: "saggezza", car: "carisma",
};

// abilità dello strumento -> nome del campo nel PDF
const PDF_SKILL = {
  atletica: "forza atletica",
  acrobazia: "destrezza acrobazia",
  furtivita: "destrezza furtività",
  rapidita: "destrezza rapidità mano",
  arcano: "intelligenza arcano",
  indagare: "intelligenza investigare",
  natura: "intelligenza natura",
  religione: "intelligenza religione",
  storia: "intelligenza storia",
  addestrare: "saggezza empatia animale",
  intuizione: "saggezza intuizione",
  medicina: "saggezza medicina",
  percepire: "saggezza percezione",
  sopravvivenza: "saggezza sopravvivenza",
  intimidire: "carisma intimidire",
  inganno: "carisma ingannare",
  intrattenere: "carisma intrattenere",
  persuasione: "carisma persuadere",
};

let pdfjsReady = null;
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  pdfjsReady ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS_URL;
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      resolve(window.pdfjsLib);
    };
    s.onerror = () => {
      pdfjsReady = null;
      reject(new Error("Impossibile caricare il lettore PDF (serve la connessione internet)."));
    };
    document.head.appendChild(s);
  });
  return pdfjsReady;
}

const normKey = (k) => String(k).normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
const isChecked = (v) => v != null && !["", "off", "false", "no", "0"].includes(String(v).trim().toLowerCase());
const toInt = (v) => {
  const m = String(v ?? "").match(/[-+]?\d+/);
  return m ? parseInt(m[0], 10) : null;
};

/**
 * Legge il PDF e restituisce { values, found, summary } oppure null se non è una scheda compatibile.
 * values contiene solo chiavi dello strumento (nome, score_for, prof_atletica, ...).
 */
async function readSheetFromPdf(file) {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const raw = (await doc.getFieldObjects()) || {};
  const fields = {};
  for (const [name, list] of Object.entries(raw)) {
    const withValue = list.find((o) => o.value != null && o.value !== "") || list[0];
    fields[normKey(name)] = withValue?.value;
  }
  const get = (name) => fields[normKey(name)];
  const has = (name) => normKey(name) in fields;

  const values = {};
  let found = 0;
  const setText = (key, pdfName) => {
    if (!has(pdfName)) return;
    found++;
    const v = String(get(pdfName) ?? "").trim();
    if (v) values[key] = v;
  };
  const setNum = (key, pdfName) => {
    if (!has(pdfName)) return;
    found++;
    const n = toInt(get(pdfName));
    if (n != null) values[key] = n;
  };
  const setCheck = (key, pdfName) => {
    if (!has(pdfName)) return;
    found++;
    values[key] = isChecked(get(pdfName));
  };

  setText("nome", "Nome");
  setText("classe", "Classe e livello");
  setText("razza", "Razza");
  setText("background", "Background");
  setText("giocatore", "Nome Giocatore");
  setNum("pb", "Bonus competenza");
  setNum("ca", "Classe armatura");
  setText("armatura", "CA1.0");
  setNum("pf_max", "PUNTI FERITA TOTALI");
  setNum("pf", "Ferite");
  setNum("passive_percepire", "Percezione");
  setNum("passive_indagare", "Ispirazione"); // nel modello il riquadro "Indagare passivo" ha questo nome interno

  for (const [ab, pdfAb] of Object.entries(PDF_ABILITY)) {
    setNum(`score_${ab}`, `${pdfAb} 2`);
    setCheck(`save_${ab}`, `${pdfAb} ts`);
  }
  for (const [skill, pdfSkill] of Object.entries(PDF_SKILL)) {
    setCheck(`prof_${skill}`, pdfSkill);
    setCheck(`exp_${skill}`, `${pdfSkill} 2`);
  }

  // una scheda compatibile ha almeno le 6 caratteristiche e qualche abilità
  if (found < 20) return null;

  const abilityNames = { for: "FOR", des: "DES", cos: "COS", int: "INT", sag: "SAG", car: "CAR" };
  const skillName = (id) => window.ABILITIES.flatMap((a) => a.skills).find((s) => s.id === id)?.name || id;
  const scores = Object.keys(PDF_ABILITY)
    .map((ab) => `${abilityNames[ab]} ${values[`score_${ab}`] ?? "–"}`)
    .join(" · ");
  const saves = Object.keys(PDF_ABILITY).filter((ab) => values[`save_${ab}`]).map((ab) => abilityNames[ab]);
  const profs = Object.keys(PDF_SKILL)
    .filter((s) => values[`prof_${s}`] || values[`exp_${s}`])
    .map((s) => skillName(s) + (values[`exp_${s}`] ? " (maestria)" : ""));

  const summary = [
    `Nome: ${values.nome || "–"}`,
    scores,
    `Tiri salvezza con competenza: ${saves.join(", ") || "nessuno"}`,
    `Abilità con competenza: ${profs.join(", ") || "nessuna"}`,
    `CA ${values.ca ?? "–"}${values.armatura ? ` (${values.armatura})` : ""} · PF ${values.pf ?? "–"}/${values.pf_max ?? "–"} · Bonus competenza ${values.pb != null ? fmtSigned(values.pb) : "–"}`,
  ].join("\n");

  return { values, found, summary };
}

function fmtSigned(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}
