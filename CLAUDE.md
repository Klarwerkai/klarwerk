# CLAUDE.md — Agent-Regelwerk Klarwerk

> Dauerhafte Regeln für jeden Coding-Agenten in diesem Repo. Kurz, präzise, stabil.
> Generiert aus `/harness`. Bei Regelverstößen wird **der Harness korrigiert, nicht nur der Code** ("Harness Correction Development").

## Quelle der Wahrheit
1. `/specs` — Was gebaut wird (Ideen → Stories → Akzeptanzkriterien).
2. `/harness` — Wie gebaut wird (Architektur, Stil, Tests, Betrieb).
3. `/tests` — Ob es korrekt ist (deterministische Evidenz).

Code ist ein **regenerierbares Ergebnis** aus Spec + Harness, nicht die primäre Wahrheit.

**Onboarding & Projektgedächtnis:** Neue Mitarbeiter und neue Claude-Sessions starten mit
`/PROJECT_CONTEXT` (Dateien 00–12 in Reihenfolge). Bei größeren Änderungen
`PROJECT_CONTEXT/04_AKTUELLER_STAND.md` fortschreiben — kein Wissensverlust.

## Rangordnung der Qualitätskontrolle (nicht verhandelbar)
1. Compiler / Build (`tools/build`)
2. Architektur- & Strukturregeln (`dependency-cruiser`)
3. Statische Codeanalyse / Lint (`tools/lint` → Biome)
4. Akzeptanz-, API- & Workflow-Tests (`tools/test`)
5. LLM-Review
6. Menschliche Freigabe (Stakeholder: Pedi)

Das LLM darf erklären und reparieren, aber **nicht selbst entscheiden**, ob sein Ergebnis korrekt ist. Nur ein grüner `tools/check`-Lauf erlaubt den nächsten Schritt.

## Architekturregeln
- **Modularer Monolith** zum Start (keine 10 Microservices). Module unter `/services/<modul>`.
- Jedes Modul hat klare Grenzen; **keine direkten Zugriffe über Modulgrenzen** außer über definierte öffentliche Schnittstellen/Events.
- Jedes Modul kapselt seine Datenhaltung; keine geteilten DB-Tabellen über Modulgrenzen.
- Abhängigkeitsrichtung wird von `dependency-cruiser` erzwungen (siehe `.dependency-cruiser.cjs`).

## Code-Stil & Stack
- Node 20+, TypeScript (strict), React (Frontend), Fastify (HTTP je Modul).
- Lint/Format: **Biome**. Tests: **Vitest + Testcontainers**.
- Keine `any` ohne Begründung; keine ungenutzten Exports; keine TODOs im gemergten Code.

## Definition of Done
Build grün · Lint grün · Architekturregeln grün · Tests grün (Akzeptanzkriterien als Tests vorhanden) · Doku aktualisiert · keine Secrets im Code · keine offenen TODOs.

## Verbote
- Keine Secrets im Code oder Harness.
- Keine ungetesteten Endpunkte.
- Keine Abkürzungen an Tests (Tests werden aus Anforderungen erzeugt, nicht aus vorhandenem Code).
- Kein direkter Schreibzugriff auf Produktion. Deployment nur über CI/CD.
- Finanz-/Kommunikationsaktionen nur mit menschlicher Freigabe.

## Befehle
- `tools/lint` · `tools/format` · `tools/test` · `tools/build` · `tools/check` (alles zusammen).
- Der Agent ruft diese selbst auf und liefert nur bei grünem `check`.

## Workflow-Namenskonvention
`W-<DOMAIN>-<NR> · <Auslöser> → <Aktion>` (z. B. `W-OPS-03 · WebhookPayments → Zahlungen abgleichen`).

Siehe `/harness/90-correction-log.md` für die laufende Liste behobener Harness-Lücken.
