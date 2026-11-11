/*
 * Struttura della scheda.
 * - ABILITIES: le 6 caratteristiche con le loro abilità (skills).
 *   armorPenalty: true mostra l'icona "penalità per armatura".
 * - DEFAULT_SHEET: valori iniziali di una scheda nuova (vuota), usati solo se non c'è nulla di salvato.
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
  pb: 2, // bonus competenza di livello 1
};
