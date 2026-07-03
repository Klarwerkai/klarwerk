## [Cloud-Worker] SCRUM-421 + 427 — Upload-Grenzen + Extraktion in Abschnitten (03.07.2026, v0.9.40-beta)

Gebündelt, weil beide den Erfassen-/Extraktions-Bereich betreffen.

### SCRUM-421 — Upload-Grenzen sichtbar + im Admin einstellbar
Bisher fest im Code (max. 8 Anhänge, ~700 KB je Anhang). Jetzt persistierte Admin-Einstellung
(Muster SCRUM-395): InMemory + Pg + Dev-Journal, mit sinnvollen Grenzen (Anzahl 1–30, Größe
0,1–20 MB).
- Admin → Daten → neue Karte „Upload-Grenzen" (Anzahl je Objekt + MB je Anhang). Audit-Eintrag
  `upload.limits.set`.
- Erfassen zeigt die geltenden Grenzen ehrlich an („Bis zu N Dateien, je max. X MB.").
- Serverseitig erzwungen: die Anhang-Route liest die eingestellten Werte statt fester Konstanten.
- Routen: GET /api/upload-limits (ko.read) · PUT (users.manage). Guard-Matrix ergänzt.

### SCRUM-427 — lange Dokumente in Abschnitten extrahieren
Der Gekürzt-Hinweis kam, weil alle Punkte in EINER Antwort angefordert wurden. Jetzt wird der
Dokumenttext in Abschnitte (~8.000 Zeichen, an Absatz-/Satzgrenzen) geteilt und je Abschnitt
extrahiert; die Ergebnisse werden dedupliziert (nach Titel) zusammengeführt, gedeckelt auf
MAX_EXTRACT_POINTS. Jede Belegstelle wird gegen IHREN Abschnitt geprüft (G-2 bleibt).
Dadurch reißt keine Antwort mehr am Token-Limit ab → bei normal langen Dokumenten entfällt der
Hinweis. Semantik erhalten: gekürzte Abschnitts-Antworten werden weiter gerettet (SCRUM-418);
liefert KEIN Abschnitt Punkte UND einer scheitert hart, wird ehrlich gemeldet (SCRUM-411).

**Tests:** tests/app/upload-limits-e2e.test.ts (Normalisierung, Rechte, Enforcement der
Anhang-Anzahl) und services/reasoner/src/extract-failure.test.ts (Abschnitts-Teilung lückenlos,
Mehr-Abschnitt-Zusammenführung ohne Gekürzt-Hinweis, Dedupe über Abschnitte).

**Version:** 0.9.39-beta → 0.9.40-beta. **Gates:** Paul-Runner v15 (Gesamtbestand).

> Betrieb: beide Änderungen liegen im Backend — nach Sync einmal Backend neu starten.
