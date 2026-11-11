# Tavolo D&D

Strumento locale per giocare a Dungeons & Dragons.

- **Sinistra – Scheda**: carica il PDF della scheda (anteprima rapida, salvato nel browser). Se è il PDF compilabile della scheda italiana, i campi (nome, caratteristiche, competenze, CA, PF) vengono letti e compilati in automatico.
- **Dungeon Master**: tracker di combattimento (immagine, nome, CA, iniziativa in ordine, PF, turni e round) e mappa a griglia con pedine trascinabili, disegni e sfondo. Con **📚 Carica schede giocatori** il DM carica tutti i PDF (o i file salvati) e apre la scheda di ciascuno cliccando sul giocatore nell'elenco o sulla sua pedina.
- **Destra – Dadi**: d4, d6, d8, d10, d12, d20, d100. Tocca un dado più volte per aggiungerlo, clic destro per toglierlo, modificatore, vantaggio/svantaggio sul d20, cronologia.

## Avvio

Nessuna installazione: apri `index.html` nel browser, oppure:

```bash
python3 serve.py
```

e vai su http://localhost:8125

## Personalizzare i campi della scheda

Modifica `sheet-config.js`.

## Dati

Tutto è salvato in automatico nel browser (localStorage + IndexedDB).
Per salvare su file:

- **Giocatore → 💾 Salva scheda**: un file `.json` con campi, PDF e cronologia dadi. Si riapre con **📂 Carica scheda**.
- **Dungeon Master → 💾 Salva partita**: un file `.json` con partecipanti, PF, iniziative, round e turno. Si riapre con **📂 Carica partita**.
