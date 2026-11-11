/*
 * Struttura della scheda.
 * - ABILITIES: le 6 caratteristiche con le loro abilità (skills).
 *   armorPenalty: true mostra l'icona "penalità per armatura".
 * - DEFAULT_SHEET: valori iniziali (Roland), usati solo se non c'è nulla di salvato.
 *
 * Chiavi salvate (piatte):
 *   nome, pb, ca, armatura, pf_max, pf
 *   score_<car>          punteggio caratteristica
 *   save_<car>           competenza nel tiro salvezza (true/false)
 *   prof_<skill>         competenza nell'abilità
 *   exp_<skill>          maestria nell'abilità
 */
window.ABILITIES = [
  {
    id: "for", name: "Forza",
    skills: [{ id: "atletica", name: "Atletica" }],
  },
  {
    id: "des", name: "Destrezza",
    skills: [
      { id: "acrobazia", name: "Acrobazia" },
      { id: "furtivita", name: "Furtività", armorPenalty: true },
      { id: "rapidita", name: "Rapidità di mano" },
    ],
  },
  { id: "cos", name: "Costituzione", skills: [] },
  {
    id: "int", name: "Intelligenza",
    skills: [
      { id: "arcano", name: "Arcano" },
      { id: "indagare", name: "Indagare" },
      { id: "natura", name: "Natura" },
      { id: "religione", name: "Religione" },
      { id: "storia", name: "Storia" },
    ],
  },
  {
    id: "sag", name: "Saggezza",
    skills: [
      { id: "addestrare", name: "Addestrare animali" },
      { id: "intuizione", name: "Intuizione" },
      { id: "medicina", name: "Medicina" },
      { id: "percepire", name: "Percepire" },
      { id: "sopravvivenza", name: "Sopravvivenza" },
    ],
  },
  {
    id: "car", name: "Carisma",
    skills: [
      { id: "intimidire", name: "Intimidire" },
      { id: "inganno", name: "Inganno" },
      { id: "intrattenere", name: "Intrattenere" },
      { id: "persuasione", name: "Persuasione" },
    ],
  },
];

window.DEFAULT_SHEET = {
  nome: "Roland",
  pb: 2,
  score_for: 15, score_des: 15, score_cos: 12, score_int: 12, score_sag: 10, score_car: 15,
  save_for: true, save_cos: true,
  prof_atletica: true, prof_percepire: true, prof_sopravvivenza: true, prof_intimidire: true,
  ca: 17, armatura: "Cotta di Maglia",
  pf_max: 11, pf: 11,
  passive_percepire: 10, passive_indagare: 11,
};
