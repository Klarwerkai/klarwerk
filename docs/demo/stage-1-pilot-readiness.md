# Klarwerk — Stage-1 Pilot-Readiness & Go/No-Go (Team-1 Knowledge-OS)

> Kompakter Bereitschaftsstatus für Pedi nach den Team-1-Workflow-Slices SCRUM-296…302.
> Stand: 2026-06-29. Quelle der Belege: `docs/qm/claude-after-report.md` (SCRUM-296…302),
> `docs/demo/stage-1-demo-path.md`, `docs/operations/evaluation-quality-assurance.md`.
> Nur belegte Aussagen — keine neue fachliche Arbeit, keine Architekturentscheidung.

---

## 1. Kurzfazit / Go-No-Go

**Empfehlung: GO für den Stage-1-Pilot/Demo — mit P2-Hinweisen.**

Der Knowledge-OS-Kern (Capture → Validate → Use → Maintain) ist als zusammenhängender, quellengebundener Workflow lauffähig und runtime-nah verifiziert. Antworten kommen ausschließlich aus geprüftem Wissen mit Status, Vertrauen und Quelle; wo keine Grundlage existiert, wird die Lücke ehrlich benannt statt erfunden. Status, Trust, Nutzbarkeit, Version und Quellen sind über die Oberfläche hinweg konsistent (eine gemeinsame Sprache via `useReadiness`/`koOverview`). Die Demo ist deterministisch reproduzierbar (seed-gestützt, Reasoner-Fallback ohne externen Key). Der Pilot ist eine **Stage-1-Funktionsdemo des Knowledge-OS-Kerns**, ausdrücklich kein Beleg für lokale LLM-Runtime, RAG oder Skalierung (siehe §6).

---

## 2. Belegte Kernflows

Alle Flows wurden in den Slices SCRUM-296…301 umgesetzt und in SCRUM-302 runtime-/API-nah am frischen Demo-Seed gegengeprüft.

- **Start / Demo-Pfad.** Der Knowledge-OS-Kreis (Capture → Validate → Use → Maintain) und der konkrete 3-Schritt-Demo-Pilotpfad (Ask → Library/KO-Detail → Validation) sind auf der Startseite sichtbar; zusätzlich die Beweiskette „Wissen finden → Nutzbarkeit erkennen → Quelle/Trust/Version prüfen" (`proofChain`, SCRUM-301). Alle Schritte verweisen auf reale Routen.
- **Capture → Validation.** Erfasstes Wissen wird als **offenes** Wissensobjekt gespeichert (nicht automatisch validiert); die Success-Card zeigt „Status: offen — noch nicht validiert" und führt als nächsten Schritt klar in Review/Validierung (SCRUM-296). Die Knowledge-OS-Phase je Arbeit ist auf Start/MyTasks sichtbar (SCRUM-297).
- **Ask → Quellen → KO-Detail.** Die demo-sichere Frage (Ventil X / Überdruck) liefert eine quellengebundene Antwort mit Status (gesichert/ungeprüft) und Vertrauen; die genutzte Quelle ist als KO-Titel verlinkt und trägt je Quelle die kanonische Nutzbarkeit (`useReadiness`); im Demo-Kontext wird `?demo=stage1` über `demoHref` weitergetragen (SCRUM-300). KO-Detail belegt Status, Trust, Version und Quellen/Anhänge.
- **Library / Nutzbarkeit.** Jeder Treffer zeigt Reife/Nutzbarkeit (über `libraryMaturity` → `useReadiness`), Status (StatusPill), Trust (Confidence-Bar) und den Weg ins KO-Detail. Reife folgt dem **Status**, nicht allein dem Trust: offene Objekte erscheinen nie als „nutzbar".
- **Gap/Risk → Capture.** Offene Wissenslücken sind als „Erfassen"-Arbeit gekennzeichnet (Phase-Chip, `gapPhase`, SCRUM-298) und führen über den bestehenden Capture-Flow — ohne automatische Lücken-Schließung oder KO-Erzeugung.
- **Lifecycle / Revalidation.** Fällige Revalidierungen sind als „Aktuell halten"-Arbeit (Maintain) sichtbar (`revalidationPhase`, SCRUM-299); der nächste Schritt führt über vorhandene Review-/Validation-/Detail-/Ask-Flows. Ein noch nicht freigegebenes KO wird ehrlich als „Validieren" geführt.

---

## 3. Evidence

- **Lokale Gates:** `npm run check` grün — **133 Dateien / 782 Tests** (Stand SCRUM-301/302; Build/tsc + Biome + dependency-cruiser + Vitest). Quelle: After-Report SCRUM-301/302.
- **GitHub CI:** grün (zuletzt gemeldet zu Commit `9bb18f3`, `main…github/main` sauber; Bestätigung durch Codex/Pedi außerhalb der Sandbox).
- **Runtime-/API-naher Befund (SCRUM-302):** In-Memory-App gebaut, Admin registriert, Demo via `POST /api/admin/demo-seed` geseedet (5 KOs, 2 validiert, 1 Lücke, 1 Konflikt, 1 fällige Revalidierung). Ask „Ventil X/Überdruck" → `answered=true`, `knowledgeClass=gesichert`, `trust=100`, genau 1 Quelle, kein Gap. Quell-KO: `validiert, trust 100, v1, 1 Quelle + 1 Anhang` → Nutzbarkeit „ready/Nutzbar". Library: validierte KOs trust 100 (Nutzbar), offene trust 0/50 (Zu prüfen). Validation-Board: 3 offene KOs (echte Review-Arbeit). **Keine Widersprüche** zwischen Trust/Status/Nutzbarkeit/Quellen/Demo-Kontext gefunden → keine Codeänderung nötig.
- **Reasoner-/Ask-Eval (gated):** gezielter Lauf über reasoner + ask + ask-routes + `tests/ask` → **9 Dateien / 68 Tests grün**, inkl. „keine Halluzination ohne Grundlage", fokussierte Quelle, Fallback bei Modellausfall, ModelRun-Protokoll ohne Prompttext. Quelle: `docs/operations/evaluation-quality-assurance.md`.
- **Seed-Mindestsignale (durch `seed.test.ts` abgesichert):** ≥3 User, ≥5 KOs, ≥2 validiert, ≥1 industrielle Wissenslücke, ≥1 Konflikt, ≥1 fällige Revalidierung, ≥1 Anhang, ≥1 Quelle.

---

## 4. Was bereit ist

Der vollständige Knowledge-OS-Kernkreis als sichtbarer, quellengebundener Workflow: Erfassen (offen) → Validieren/Review → quellengebunden Nutzen → Aktuell halten/Revalidieren, plus der Gap→Capture-Eingang. Konsistente, ehrliche Status-/Trust-/Nutzbarkeits-/Versions-/Quellen-Anzeige über eine gemeinsame Begriffsbasis. Ehrlicher Lücken-/Gap-Pfad (keine erfundene Antwort). Deterministisch reproduzierbarer Demo-Seed und transparentes Reasoner-Modus-Badge. Grüne lokale Gates und gated Reasoner-/Ask-Eval. Normale Nutzung ohne Demo-Kontext bleibt unverändert (Demo-Elemente sind an `?demo=stage1` gebunden).

---

## 5. P2 / Pilot-Hinweise

- **Demo bevorzugt auf Deutsch zeigen.** Der Seed und die KO-Inhalte sind deutsch; Beispielfragen bleiben auch im EN-UI seed-sicher (technische Begriffe wie *Ventil X / Überdruck*), die Inhalte selbst sind aber deutsch.
- **Reasoner-Modus bewusst wählen.** Ohne `ANTHROPIC_API_KEY` läuft der deterministische Fallback (belegte KO-Aussagen, klar als Modus markiert) — empfohlen für eine reproduzierbare Demo. Mit Key der Modellmodus; das Modus-Badge auf der Ask-Seite macht das transparent.
- **Automatisiertes Modellmodus-Eval** (echter Key + Token-/Kosten-/Latenz-Schwellen) ist P2/Ops und in der Sandbox nicht ausgeführt.
- **Monitoring/Logging** ist als Konzept dokumentiert (`docs/operations/monitoring-logging.md`); produktive Dashboards/Alerting bleiben Ops/P2.
- **Persistenz für sichtbaren Review:** Für einen über Neustarts stabilen Demo-Stand `DATABASE_URL` setzen; reiner In-Memory-Lauf ist nicht persistent.

---

## 6. Nicht Stage-1 / ausdrücklich nicht behauptet

Für den Stage-1-Pilot werden folgende Dinge **nicht** behauptet und sind **nicht** Teil des Belegumfangs:

- **Kein RAG** und keine Embedding-/Vector-Datenbank (Retrieval ist die vorhandene deterministische KO-Auswahl).
- **Keine neue Suche** / kein neues Retrieval-Verfahren.
- **Keine lokale/eigene LLM-Runtime** und keine Aussage zu lokaler Modell-Performance/Hardware (in den Readiness-Dokumenten durchgängig als Partial/Blocked markiert, da Sandbox ≠ Zielhardware).
- **Keine automatische Validierung/Freigabe** — erfasstes Wissen bleibt offen; Validierung ist menschliche Review-Arbeit. Eine einzelne Bewertung validiert nichts.
- **Keine Fake-Quellen** — Quellen sind reale KO-Bezüge; unbekannte/unauflösbare Quellen werden ehrlich als solche markiert.
- **Keine Backend-/Reasoner-Architekturänderung** im Rahmen der Slices 296…302.

---

## 7. Demo-Voraussetzungen

- **Frischer Seed.** Der Demo-Seed läuft nur, wenn die Wissensbasis leer/uneingerichtet ist (idempotent, produktionsgeschützt). Wege: CLI/Dev (`seedDemo` beim Start einer leeren Instanz) oder als eingerichteter Admin `POST /api/admin/demo-seed` (SCRUM-181). Reiner In-Memory-Lauf ist nicht persistent.
- **Demo-Rollen** (Passwörter sind reine Demo-Fixtures aus dem Repo, siehe `docs/demo/stage-1-demo-path.md`): Admin (sieht alle Boards inkl. Validierung & Lifecycle — empfohlen), Controller (entscheidet Validierung), Experte (erfasst Wissen).
- **Demo-Sprache:** Deutsch (Seed-Inhalte sind deutsch; Beispielfragen seed-sicher auch im EN-UI).
- **Reasoner-Modus:** deterministischer Fallback (ohne Key, reproduzierbar) vs. Modellmodus (mit `ANTHROPIC_API_KEY`); Modus-Badge zeigt den aktiven Modus.
- **Seed-Begriffe:** Ventil X / Überdruck (beantwortbare, quellengebundene Ask-Frage); validierte KOs mit Trust/Quelle/Anhang; ≥1 Lücke, ≥1 Konflikt, ≥1 fällige Revalidierung als sichtbare Arbeit.

---

## 8. Empfehlung nächster Schritt nach dem Pilot

Bei positivem Pilotfeedback ist der erste belastbare Folgeschritt die **Entscheidung über die produktive Inferenz-/Runtime-Linie** (deterministischer Fallback weiter vs. Modellmodus mit Provider-Entscheidung) inklusive automatisiertem Modellmodus-Eval mit Kosten-/Latenz-Schwellen und DSFA-Check — auf Basis der bereits vorliegenden, ehrlich als Partial/Blocked markierten Readiness-Dokumente (Inference-Server, GPU-Provider, RAG-Readiness, Budget/Kosten). Parallel: produktives Monitoring/Logging scharfschalten und einen kleinen realen Datenpilot (echte Erfassungen statt Seed) mit den vorhandenen Validierungs-/Revalidierungs-Workflows fahren. Diese Schritte sind bewusst **außerhalb** von Stage-1 und dieses Tickets.
