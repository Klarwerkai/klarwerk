# Frontend ↔ Backend-API-Abgleich (Screens gegen vorhandene Endpunkte)

> Zweck: prüfen, ob die Screens des Design-Handoffs (`UI:UX/design_handoff_klarwerk_frontend/`) gegen die **tatsächlich vorhandenen** Modul-APIs gebaut werden können. Grundsatz: unsere Architektur/Specs/Harness bleiben führend; der Brief passt sich an, außer er bringt eine echte Verbesserung.
>
> Stand: 24.06.2026 · Quelle: `services/app/src/routes/*`, `services/auth/src/routes.ts`, Modul-`index.ts`/`types.ts`.

## Fazit

**Start möglich.** Der Stufe-1-Kernkreislauf ist durch reale Endpunkte gedeckt. Es bleiben **zwei** echte Abstimmpunkte (Status-Granularität, In-App-Benachrichtigungen) und mehrere bereits getickte Stufe-2-Lücken (SCRUM-115–121). Die Abstimmpunkte werden architektur-konform gelöst (Lese-Modell/kleines Modul), nicht durch Designkompromiss.

## Vorhandene Endpunkte (geprüft)

- **Auth/Onboarding (vollständig):** `POST /api/auth/register|login|logout|forgot|reset|oidc|setup`, `GET /api/auth/status|me`, `POST /api/auth/password`. → Login/Registrieren/Wartet-auf-Freigabe/Ersteinrichtung sind gedeckt.
- **Nutzer/Admin:** `GET /api/users`, `POST /api/users`, `PUT /api/users/:id` (Rolle/Passwort), `DELETE /api/users/:id`, `POST /api/auth/users/:id/approve`. → Admin-Screen gedeckt (inkl. Selbstschutz serverseitig).
- **Wissensobjekt:** `GET /api/kos`, `GET /api/kos/:id`, `POST /api/kos`, `DELETE /api/kos/:id`, **`PUT /api/kos/:id`** mit Aktion `rate|assign|revise|category|tags|conflict|resolve-conflict|transfer-author|revalidate`. → Detail/Wiki, Bearbeiten, Validieren, Konflikt melden/lösen, Übergabe, Re-Validierung gedeckt. KO trägt `confidence`, `trust`, `version`, `history`, `originalAuthor`, `author`, `neededValidations`, `assignments`, `asset`, `type`, `tags` (alles, was die Vertrauens-/Herkunftszeile braucht).
- **Erfassen/Entwürfe:** `GET/POST /api/drafts`, `GET /api/drafts/:id`, `DELETE /api/drafts/:id`, `POST /api/drafts/:id/promote` + Reasoner-Route. → Capture-Flow inkl. geräteübergreifendem Entwurf gedeckt.
- **Validierung:** `GET /api/validation/board`, `GET /api/validation/overview`; Bewerten/Zuweisen über KO-Dispatcher. → Validation Board gedeckt.
- **Konflikte:** `GET /api/conflicts`, `GET /api/conflicts/:id`, `POST /api/conflicts/:id/escalate`; Anlegen/Lösen über KO-Dispatcher. → Conflict Board gedeckt.
- **Fragen + Wissenslücken:** `POST /api/ask`, `POST /api/ask/helpful`, `GET /api/gaps`, `PUT /api/gaps/:id` (zuweisen/schließen), `DELETE /api/gaps/:id?confirm=true`. → Ask→Antwort/Lücke **und** Risiko/Lücken sind gedeckt (besser als im Brief angenommen).
- **Bibliothek/Lebenszyklus/Analytics/Audit/i18n/Graph:** `GET /api/library/export`, `POST /api/library/import`, `GET /api/lifecycle/pending`, `GET /api/analytics`, `GET /api/analytics/busfactor`, `GET /api/audit`, `GET /api/i18n/locales`, `GET /api/learning-paths/:role`, `GET /api/graph`. → Bibliothek, Lebenszyklus, Analytics/Audit, Risiko-Bus-Faktor, Graph (Datenpfad vorhanden) gedeckt.

## Echte Abstimmpunkte (vor Bau der abhängigen Screens)

**1. Status-Granularität (wichtigster Punkt).** Backend `KoStatus = "offen" | "validiert"`. Das Design zeigt sieben Status-Pills: `entwurf, offen, in Prüfung, validiert, abgelehnt, re-validierung, konflikt`.
- `entwurf` = eigenes Draft-Objekt (kein KO-Status) → ok.
- `konflikt` / `in Prüfung` / `re-validierung` lassen sich aus vorhandenen Daten **ableiten** (offener Konflikt am KO, `assignments.length > 0` bzw. anstehende Re-Validierung).
- `abgelehnt` ist im Modell nicht vorhanden.
- **Entscheidung (architektur-konform):** Das Lese-/Read-Modell der App liefert einen abgeleiteten **Anzeigestatus** zusätzlich zum fachlichen `KoStatus` — der Kern-Enum bleibt unangetastet. Für „abgelehnt" wird geklärt, ob ein roter Verdict einen eigenen Anzeigestatus rechtfertigt oder „Rückgabe an Autor" (= zurück zu Entwurf/offen) abbildet. Kleine, additive Backend-Erweiterung im `app`/`validation`-Lesepfad, keine Designänderung.

**2. In-App-Benachrichtigungen (U-3, Glocke + Popover).** Das `notifications`-Modul ist **nur E-Mail** (mailer/smtp); es gibt **keinen** `GET /api/notifications`.
- **Entscheidung:** kleiner Lese-Endpunkt, der Benachrichtigungen aus vorhandenen Signalen speist (Zuweisungen, Eskalationen, Rückgaben, Lücken). Entweder als schlanke Erweiterung des `notifications`-Moduls (Read-Store) oder als aggregierende App-Route. Additiv, blockiert den restlichen Bau nicht.

**3. „Meine Aufgaben" (Screen 2a) — Aggregat.** Kein einzelner `/api/tasks`-Endpunkt. Wird clientseitig aus zugewiesenen Validierungen, Entwürfen, Konflikten, Lücken und `lifecycle/pending` zusammengesetzt (oder später als BFF-Route gebündelt). Kein Blocker für Stufe 1.

## Bereits getickte Stufe-2-Lücken (UI mitdenken, später aktivieren)

Output Factory (Output-Logik), Import/Source-Review-Queue (über `library/import` hinaus), externe Quellen, Wissenskapital-Kennzahlen, Objekt-/Dateispeicher für Fotos → SCRUM-115–121. Im UI vorbereiten, erst bei vorhandener API aktivieren.

## Konsequenz für den Bau

Der Kernkreislauf (Auth → Erfassen → Validieren → Konflikt/Lücke → Fragen → Lebenszyklus → Bibliothek/Admin) ist sofort baubar. Die zwei Abstimmpunkte werden als kleine, additive Backend-Anpassungen vor den jeweils abhängigen Screens erledigt — das Frontend-Datenmodell wird von Beginn an darauf ausgelegt (abgeleiteter Anzeigestatus, Notifications-Quelle).
