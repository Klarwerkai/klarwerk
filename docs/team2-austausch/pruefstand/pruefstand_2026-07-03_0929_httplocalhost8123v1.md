# Prüfstand — letzter Lauf 3.7.2026, 09:29:52

Ziel: **http://localhost:8123/v1** · Modell: **Qwen/Qwen3-32B-AWQ** · **16/24 Punkte** · Ø 9.9s

| Fall | Aufgabe | Punkte | Checks | Sek | Anmerkung |
|---|---|---|---|---|---|
| STR-1 | structure | 1 | 5/6 | 15.2 | kein gültiges JSON |
| STR-2 | structure | 1 | 4/5 | 12.9 | kein gültiges JSON |
| EXT-1 | extract | 1 | 4/5 | 11.5 | Belegstelle nicht wörtlich im Dokument (G-2!) |
| EXT-2 | extract | 1 | 3/4 | 15.2 | hat nicht ehrlich 'nichts' geantwortet |
| ANT-1 | answer | 2 | 4/4 | 6 | — |
| ANT-2 | answer | 2 | 4/4 | 5 | — |
| INT-1 | interview | 2 | 4/4 | 8.6 | — |
| INT-2 | interview | 2 | 3/3 | 12.4 | — |
| ASS-1 | assist | 2 | 5/5 | 9.2 | — |
| ASS-2 | assist | 1 | 2/3 | 10.4 | fehlt: "sechs Wochen" |
| SEL-1 | select | 1 | 1/2 | 7.1 | erfunden/falsch: "KO-B" |
| SEL-2 | select | 0 | 1/3 | 5.5 | erfunden/falsch: "KO-A"; erfunden/falsch: "KO-B" |