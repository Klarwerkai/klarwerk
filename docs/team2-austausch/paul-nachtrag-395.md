## [Cloud-Worker] SCRUM-395 — Prüfer-Zuweisung + Standard-Prüferanzahl (03.07.2026, v0.9.33-beta)

**Anlass:** Review-Triage 02.07. (T3) — neededValidations existierte je KO, es fehlten die
Zuweisungs-UI beim Einreichen und ein Admin-Default.

**Standard-Prüferanzahl (Admin).**
Neue persistierte Einstellung im Validierungs-Modul (Muster = Assist-Presets: Interface +
InMemory + Pg + Dev-Journal). Admin → Daten → Karte „Prüfungen": 1–5, Änderungen laufen ins
Audit-Log (`validation.defaultNeeded.set`). Gilt für neue Einreichungen ohne eigene Angabe —
auf BEIDEN Wegen (Direkt-Einreichen und Entwurf → Promote; das harte „?? 3" im Capture-Modul
ist entfernt, der Default wird jetzt zentral im knowledge-object-Modul aufgelöst, per
injizierter Funktion ohne Modulgrenzen-Verletzung). Explizite Angaben gewinnen immer.
Routen: GET /api/validation/settings (ko.read) · PUT (users.manage); Route-Guard-Matrix ergänzt.

**Prüfer-Vorschlag beim Einreichen.**
„Wissen erfassen" → Erweiterte Details → neuer Block „Prüfer vorschlagen (optional)":
Personen-Chips aus dem Verzeichnis (ohne den Autor selbst). Beim Einreichen legt der Server
die Review-Zuweisungen an (validation.assign, dedupliziert, Autor wird serverseitig
herausgefiltert) und benachrichtigt die Gewählten (FR-VAL-07, gleicher Weg wie die
Board-Zuweisung). Funktioniert auf beiden Einreich-Wegen (POST /api/kos {reviewerIds} und
POST /api/drafts/:id/promote {reviewerIds}). Der Autor braucht dafür KEIN ko.assign —
er benennt Prüfer nur für sein eigenes, frisch eingereichtes Objekt.

Das Feld „Nötige Validierungen" zeigt den geltenden Standard jetzt ehrlich als Platzhalter
(„Standard: N") — leer lassen heißt: der Admin-Standard gilt.

**Beifang-BUG behoben (Entwurf-Speichern).**
`drafts.create` schickte den Entwurfsinhalt verschachtelt als `{ payload: … }`, der Server
erwartet die Felder flach (wie update/promote). Folge: frisch gespeicherte Entwürfe standen
ohne Titel/Inhalt im Pool, bis das erste Update sie reparierte. Jetzt konsistent flach.

**Tests.** tests/validation/reviewer-defaults-e2e.test.ts (HTTP end-to-end): Normalisierung
(nur ganze Zahlen 1–5), Rechte (Experte liest, nur users.manage setzt, ungültige Werte 400
ohne Wirkung), Default auf beiden Einreich-Wegen, explizit schlägt Default,
Prüfer-Vorschlag inkl. Selbst-Filter und Benachrichtigung, Promote-Weg.

**Version:** 0.9.32-beta → 0.9.33-beta. **Gates:** Paul-Runner v8 (prüft den Gesamtbestand).
