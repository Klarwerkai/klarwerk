## [Cloud-Worker] SCRUM-422 — Papierkorb für gelöschte Artikel (03.07.2026, v0.9.34-beta)

**Anlass:** Pedi 03.07. — gelöschte Artikel sollen wiederherstellbar sein (Admin), nach
4 Wochen automatisch endgültig gelöscht werden; Demo-Daten immer sofort endgültig.

**Umsetzung.**
Soft-Delete am Wissensobjekt (deletedAt + deletedBy): Löschen über die bestehende Route
verschiebt in den Papierkorb statt zu vernichten. Getrashte KOs sind aus ALLEN Lese- und
Mutations-Pfaden ausgeblendet (get/list/findCandidates/require) — Bibliothek, Board, Ask,
Kennzahlen, Benachrichtigungen und die SCRUM-420-Selbstheilung verhalten sich, als wäre
das Objekt gelöscht. Historie, Versionen und Evidence bleiben unangetastet.

Admin → Daten → neue Karte „Papierkorb": Liste (Titel, gelöscht von/am, Rest-Frist),
Wiederherstellen (Version + Historie unversehrt), sofortige Endlöschung mit ruhiger
Inline-Rückfrage (CI-konform). Routen: GET /api/kos/trash · POST /api/kos/:id/restore ·
DELETE /api/kos/trash/:id — alle users.manage; Route-Guard-Matrix ergänzt.

**Auto-Endlöschung:** TRASH_RETENTION_DAYS = 28. Lazy beim Lesen (Selbstheilungs-Muster
wie SCRUM-420, kein Cron): list() prüft höchstens einmal pro Stunde, die Papierkorb-Ansicht
immer. Endlöschung landet als ko.purged (reason trash-expired) im Audit.

**Demo-Daten:** koService.delete löscht demoSeed-KOs IMMER hart; der Demodaten-Purge
übergibt zusätzlich hard=true (deckt auch nur per Tag markierte Alt-Demo-KOs ab).

**UI-Ehrlichkeit:** Die Lösch-Rückfrage (ko.deleteQ, DE/EN) sagt jetzt, dass der Beitrag
in den Papierkorb wandert (28 Tage) und Demo-Daten endgültig gelöscht werden.

**Tests:** tests/ko/trash-e2e.test.ts (6 Tests, HTTP end-to-end + deterministische
Frist-Prüfung über die injizierbare Service-Uhr): Trash statt Vernichtung, Admin-only
(403 für Experte), Wiederherstellen unversehrt, manuelle Endlöschung, Demo-Daten nie im
Papierkorb, Auto-Endlöschung nach Fristablauf.

**Version:** 0.9.33-beta → 0.9.34-beta. **Gates:** Paul-Runner v9 (prüft den Gesamtbestand).
