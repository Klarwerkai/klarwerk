# Code-Karte — dev_Klarwerk (Produkt-Repo)

_Erfasst 06.07.2026 direkt am Repo. Verifiziert Team-1-Auskunft (kleine Zahl-Updates)._

## Architektur
Modularer Monolith, Node 20 + TypeScript (strict) + Fastify (Backend) + Vite/React (Frontend).
**dependency-cruiser** erzwingt Modulgrenzen: Cross-Modul-Import nur über die öffentliche `index.ts` des Zielmoduls;
keine Zyklen; Orphans = warn. Verstöße brechen den Build.

## Backend — `services/` (21 Module)
| Modul | ts | Kern |
|---|---|---|
| app | 57 | HTTP-Server, Routen-Verdrahtung, Seed, Web-Delivery (SPA+API single-origin) |
| reasoner | 15 | KI-Reasoner (structure/ask/Konfliktprüfung), deterministischer Fallback, Provider |
| conflicts | 18 | Konflikt- + Duplikat-/OverlapService („jeder gegen jeden") |
| auth | 13 | E-Mail/Passwort (PBKDF2), Sessions, Ersteinrichtung |
| knowledge-object | 12 | KO-Entität, Status, Trust (Deckel 99) |
| validation | 9 | Peer-Review/Validierung |
| ask | 9 | Frage→Antwort quellengebunden |
| audit | 7 | Audit-Log |
| capture | 7 | Erfassen |
| external-search | 7 | externe Wissensquellen |
| model-runs | 7 | Modell-Läufe/Eval-Anbindung |
| object-store | 6 | Datei-/Objektspeicher (`/api/objects/:id/raw`) |
| lifecycle | 6 | Re-Validierung/Lebenszyklus |
| management | 6 | Wissenskapital/Management-Kennzahlen |
| library-analytics | 6 | Bibliothek + Analytics |
| media | 5 | Medien/Anhänge |
| notifications | 5 | Glocke/E-Mail-Aggregat |
| output | 5 | Output Factory (Stufe 2) |
| rbac | 4 | Rollen admin/experte/viewer, canChangeRole, Last-Admin-Schutz |
| i18n | 3 | Server-i18n |
| structure | 3 | Strukturierung |

## Frontend — `apps/web/src/`
- **pages (20):** Admin, Analytics, Ask, Capture, Conflicts, Duplicates, ExternalKnowledge, Help, KnowledgeDetail,
  Library, Lifecycle, Mobile, MyTasks, PlaceholderPage, Profile, Risk, Start, Stufe2, UiKit, Validation.
- **components:** 29 · **lib-Helfer (DOM-frei, testbar):** 158 · zentrale Studio-Komponente `KnowledgeInputStudio.tsx`.
- Version: `apps/web/src/version.ts` (`1.0.0-beta.<Freeze>.<Push-Zähler>`).

## Tests — `tests/` (195 Testdateien)
Unterordner: analytics, api, app, ask, auth, capture, conflicts, contracts, duplicates, fixtures, foundation, help,
i18n, ko, library, lifecycle, management, output, reasoner, security, structure, validation, workflows.
Security: `tests/security/routeGuardAudit.ts` (Guard-Matrix je Route).

## Quelle der Wahrheit (Harness-Ansatz)
- `specs/` — WAS (ideas / stories / decisions / reference).
- `harness/` — WIE (00-principles, 20-system-architecture, 30-coding-guidelines, 40-testing-strategy,
  70-security-and-permissions, 80-definition-of-done, 90-correction-log).
- `tests/` — OB korrekt.

## Gates (`npm run check`)
`build` (tsc --noEmit) → `lint` (biome) → `arch` (depcruise services) → `test` (vitest).
Zusätzlich FE: `(cd apps/web && tsc --noEmit)`; Smoke: `smoke:ui` (playwright), `smoke:browser`.
