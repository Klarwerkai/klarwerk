## [Cloud-Worker] SCRUM-414 — Admin-Regler „externe Wissensabfrage" (03.07.2026, v0.9.38-beta)

**Anlass:** Pedi 03.07.: Der Admin soll die externe Wissensabfrage von komplett blockiert bis
offen steuern können. Entscheidung: 4 Stufen. Ist zugleich die Freigabe für die Public-KI-
Anreicherung (SCRUM-426).

**Umsetzung (Muster wie SCRUM-395: persistierte Admin-Einstellung).**
- Neue persistierte Einstellung im external-search-Modul (Interface + InMemory + Pg +
  Dev-Journal): `ExternalKnowledgeStage` = blocked · search_on_click (Standard) · search_attach
  · open. Standard bewusst restriktiv.
- Routen: `GET /api/external/policy` (ko.read, für die Anzeige beim Erfassen/Prüfen) und
  `PUT /api/external/policy` (users.manage, Audit-Eintrag `external.policy.set`).
  Route-Guard-Matrix ergänzt.
- **Server-Gate:** `GET /api/external/search` liefert bei „blocked" ehrlich 403
  (EXTERNAL_SEARCH_BLOCKED) — die Sperre wirkt serverseitig, nicht nur in der UI.
- Admin → KI → neue Karte „Externe Wissensabfrage": 4 Stufen als Auswahl mit
  Erklärungstext, speichern.
- Erfassen: die externe Quellensuche wird ausgeblendet, wenn der Regler auf „blocked" steht.

**Ableitungen für später (SCRUM-426):** `externalSearchAllowed` / `externalAttachAllowed` /
`publicAiEnrichmentAllowed` sind aus der Stufe abgeleitet und exportiert — die
Public-KI-Anreicherung wird auf `open` freigeschaltet.

**Tests:** tests/app/external-policy-e2e.test.ts — Normalisierung (nur die 4 Stufen), Rechte
(Experte liest / nur Admin setzt / ungültig = 400 ohne Wirkung), Default restriktiv, und das
403-Gate der externen Suche bei „blocked".

**Version:** 0.9.37-beta → 0.9.38-beta. **Gates:** Paul-Runner v13 (Gesamtbestand).
