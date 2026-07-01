# Team 1 — Delta- & UX-Abgleich gegen Team-6-Wissen (2026-07-02)

**Auftrag Pedi (01.07.):** Team 1 kontrollieren, UI/UX optimieren (Leitprinzip: Anwender nicht
überfordern), fehlende Funktionen (u. a. Video) ergänzen, Abgleich mit Team-6-GURU-Wissen.
**Quellen:** TEAM6_CURRENT_TOP_REQUIREMENTS (KGURU-27), Master Scope, Frontend-Anforderungsbeschreibung,
KLARWERK-Konzept-Final-DE, ARGUS-Demo/Handbuch, PMO-Review-Queue (pedi-input/abrundung).

## 1. In dieser Session GESCHLOSSEN (Umsetzung + Tests)

| Bezug | Was | Beleg |
|---|---|---|
| KREL-33-P1 / SCRUM-380 | RC-genaue Runtime/Build-Evidence | `docs/BETA_RC_RUNTIME_START_PATH_BUILD_EVIDENCE_V0.md` (Gesamt-Hash d4f6196e…) |
| KREL-33-P1 / SCRUM-381 | Playwright devDependency + `smoke:browser:setup` | package.json/-lock, smoke-browser.mjs-Doku |
| PMO-FEA-0002 (Pedi-P1) / SCRUM-383 | Wirkungs-Rückmeldung an Originalautor („Dein Wissen hat geholfen") im Feed; kein Selbst-Applaus, keine Scores (EK-19-Richtung); Sprungziel = eigenes KO | notification-feed/-routes, ask.markHelpful-Payload, Topbar, 9 neue Tests |
| Konzept §5 Import / SCRUM-382 | **Video-/Audio-Import & -Analyse**: Objektart `video`, neues Modul `services/media` (modellagnostischer Transcriber, Whisper-kompatibel, Schlüssel nur serverseitig), `/api/media/status|analyze`, Capture: Upload + „Transkribieren" auf Klick, ehrlicher Inaktiv-Zustand ohne Schlüssel (G-2) | services/media, media-routes, Capture.tsx, 8 neue Tests |

## 2. OFFEN mit Empfehlung (neue/bestätigte Jira-Tickets)

| Prio | Gap (Team-6-Bezug) | Empfehlung |
|---|---|---|
| P1 | **KG-UX #9**: Studio-als-Default-Umbau + Gesamt-Usability-Abnahme | Eigener Slice mit Pedi-Review am Bildschirm (SCRUM-384) — bewusst NICHT blind in dieser Session umgebaut: UI-Grundumbau ohne visuelle Abnahme widerspräche „nicht überfordern" |
| P1 | **KG-UX #10 / EK-21**: globale Onboarding-/Story-Hoheit (Team 1+4) | Nach Pedi-Website-Abnahme (KWEB-104) Story-Assets teilen |
| P1 | Lasttest AG-03-DBINDEX-LOADTEST (EK-23) | Team 5-Umgebung mit echtem Postgres |
| P2 | Seed-Datensatz aus ARGUS-Beispielen (PMO-TODO-0002) | In seed-demo.ts kuratiert übernehmen (SCRUM-385 enthält den Auftrag) |
| P2 | Import-Pipeline weitere Quellen (PDF/Excel serverseitig), Output Factory, Priorisierungs-Score | Nach Team-6-Delta-Review (PMO-TODO-0001) als Roadmap-Slices |

## 3. UX-Befund „nicht überfordern" (Ist nach SCRUM-369/370/375/377)

Der geführte Weg existiert bereits stark: Capture→Studio-Empfehlung, Progressive Disclosure,
Rescue-Story in Empty-States, Review-Board-Klarheit. Die in dieser Session ergänzten Flächen folgen
dem Muster (Transkription nur auf Klick, ehrliche Statusmeldungen, keine Automatik).
**Größter verbleibender Hebel** ist der Studio-Default (statt Formular-Erstkontakt) — als
eigener, visuell abzunehmender Slice geplant (SCRUM-384). Bewertungsgrundlage: KG-UX-001/002/003/010.

## 4. Ehrliche Grenzen dieser Session

Kein Browser in der Arbeitsumgebung → keine visuelle Abnahme; alle Änderungen sind DOM-frei
getestet + typgeprüft. Whisper-Transkription real ungetestet (kein Schlüssel hier) — Client per
injiziertem fetch getestet; erster Realtest nach Key-Eintrag in der KLARWERK-App.
