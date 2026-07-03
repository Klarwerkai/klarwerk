## [Cloud-Worker] SCRUM-426 — Public-KI-Anreicherung im Erfassen/Studio (03.07.2026, v0.9.39-beta)

**Anlass:** Pedi 03.07.: Im Rohwissen-Erfassen und im Studio soll man — bei Admin-Freigabe —
weitere Infos von der Public KI holen und optional einarbeiten. Entscheidungen: Quelle
**umschaltbar** (Modellwissen ODER belegte Web-Suche); Freigabe über den 4-Stufen-Regler
(SCRUM-414), aktiv ab Stufe **„offen"**.

**Umsetzung.**
- **Backend:** neue Reasoner-Fähigkeit `enrichPublic(query, locale)` — bewusst NICHT
  quellengebunden (Modell-Weltwissen), knappe Leitplanken (sachlich, keine erfundenen
  Zahlen/Zitate, ehrlich bei Unsicherheit). Nur echte Modelle (Cloud → lokal) liefern; ohne
  Modell ehrlich leer (demo=true, kein Erfinden). Provider-Schnittstelle um optionales
  `enrichPublic` erweitert (nur ModelProvider implementiert es).
- **Route:** `POST /api/reasoner/enrich` — zwei Gates: Schreibrecht (ko.create) UND
  Admin-Regler = „offen" (publicAiEnrichmentAllowed), sonst 403
  (PUBLIC_AI_ENRICHMENT_BLOCKED). Leere query → 400. Guard-Matrix ergänzt.
- **Frontend:** neue, wiederverwendbare Komponente `PublicAiEnrichPanel` — Umschalter
  Modellwissen/Web-Suche, Query, Ergebnisse IMMER als „Extern · ungeprüft" gekennzeichnet,
  Übernahme nur auf Klick (hängt einen markierten Block an den Entwurf; nie automatisch, nie
  validiert). Selbst-Gate auf Stufe „offen" (Server prüft zusätzlich). Modellwissen →
  /reasoner/enrich; Web-Suche → bestehende externe Suche (mit Quelle/Link).
- Eingebunden im Erfassen (Body-Editor) UND im Knowledge Studio (hängt an den internen
  Studio-Entwurf an — kein Auto-Save).

**Tests:** tests/app/enrich-e2e.test.ts — Gate (unter „offen" 403, ab „offen" frei), ohne
Modell ehrlich leer (demo=true), leere query 400.

**Version:** 0.9.38-beta → 0.9.39-beta. **Gates:** Paul-Runner v14 (Gesamtbestand).

> Betrieb: Für einen echten Modell-Beitrag muss ein Modell verbunden sein (Cloud/lokal) und
> der Admin-Regler auf „offen" stehen; Backend nach Änderungen neu starten.
