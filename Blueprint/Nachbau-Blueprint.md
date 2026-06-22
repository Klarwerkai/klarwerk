# Nachbau-Blueprint: KI-gestützte Software-Entwicklung

> Praktische Anleitung, um die **Umgebung** und **Herangehensweise** aus dem Tielke-Vortrag selbst aufzubauen.
> Stack-agnostisch geschrieben: überall, wo `[ANPASSEN]` steht, setzt du deine eigene Technologie ein.
> Begleitende Visualisierung: `Setup-Diagramme.html`.

---

## Teil A — Die Umgebung aufbauen (Setup)

Ziel: eine **kontrollierte Pipeline**, in der die KI Code erzeugt, der automatisch versioniert, getestet und deployt wird. Der Mensch steuert über Specs + Harness, nicht über Copy-Paste.

### A1. Versionsverwaltung (Source of Truth)
- **Gitea** self-hosted aufsetzen (Docker: `gitea/gitea`), alternativ GitHub/GitLab. `[ANPASSEN]`
- Ein **Monorepo** oder klar getrennte Repos pro Microservice. Empfehlung zum Start: Monorepo (die KI sieht den ganzen Kontext).
- Branch-Konvention: `main` (geschützt) + kurzlebige Feature-Branches je Task.

### A2. CI / Build Runner
- **Build Runner** einrichten (Gitea Actions / GitHub Actions / GitLab CI / Jenkins). `[ANPASSEN]`
- Pipeline-Stufen verbindlich machen: **Build → Lint/Format → Tests → (bei grün) Deploy Test-Env**.
- Regel: **Nichts kommt nach `main`, das die Pipeline nicht grün durchläuft.** Das ist das Sicherheitsnetz, das der KI Autonomie erlaubt.

### A3. Umgebungen trennen
- **Dev-Env**: lokal pro Entwicklungsmaschine, alle Services + DBs als Container (`docker compose up`).
- **Test-Env**: automatisches Deploy nach grünem Build, hier laufen Integrations-/Workflow-Tests.
- **Prod-Env**: getrenntes Deploy-Ziel. `[ANPASSEN]` (NAS / VPS / Cloud).
- Alles als **Container** definieren — reproduzierbar und für die KI beschreibbar.

### A4. Coding-Agent-Maschinen
- 1–N Maschinen mit installiertem **Coding Agent** (CLI-Agent deiner Wahl: Claude Code, o. ä.). `[ANPASSEN]`
- Modell: leistungsfähiges Coding-Modell (im Video **Claude/Anthropic**). **Prompt-Caching aktivieren** — laut Token-Folie ein großer Kostenhebel (Cache-Read statt Input bei wiederholtem Kontext).
- Mehrere Maschinen = Parallelisierung von Tasks (im Video „2×", PC1/PC2).

### A5. Laufzeit-/Zielarchitektur vorbereiten
- **Microservices**, je eine fachliche Verantwortung, **je eigene Datenbank**.
- **API Gateway** als zentraler Eingang. `[ANPASSEN]` (z. B. Kong, Traefik, YARP, nginx).
- **Workflow Engine = n8n** für Orchestrierung & Drittanbieter-Integration (Kalender, Chat, Mail, Boards). `[ANPASSEN: Temporal/Camunda statt n8n, falls Code-zentrierter gewünscht]`
- **Namenskonvention für Workflows**: `W-<DOMAIN>-<NR> · <Auslöser> → <Aktion>` (z. B. `W-OPS-03 · WebhookPayments → Zahlungen abgleichen`).

---

## Teil B — Den „Harness" definieren (das Herzstück)

Der **Harness** ist das wiederverwendbare Steuer-Gerüst um den Coding-Agent: alles, was die KI braucht, um *ohne Micromanagement* korrekt zu liefern. Konkret ist es eine **Ordner- und Datei-Konvention im Repo** plus **automatisierte Checks**.

### B1. Empfohlene Repo-Struktur
```
/repo
├── AGENTS.md / CLAUDE.md      # Dauerhafte Regeln für den Agent (Architektur, Stil, Verbote)
├── /specs                     # Quelle der Wahrheit — eine Spec je Feature/Service
│   ├── _template.md
│   └── customer-service.md
├── /services
│   └── customer-service/
│       ├── src/
│       └── tests/             # API-Tests gegen echte DB (TestContainers)
├── /workflows                 # n8n-Exporte (JSON), versioniert
├── /tests-e2e                 # Workflow-/End-to-End-Tests
├── /tools                     # Skripte: lint, format, gen, test, check (ein Befehl je Schritt)
└── /docs                      # automatisch generierte Doku
```

### B2. Agent-Regeldatei (`AGENTS.md` / `CLAUDE.md`)
Inhalt (kurz, präzise, stabil):
- **Architekturregeln**: „Jeder Service hat eigene DB, keine direkten DB-Zugriffe über Servicegrenzen."
- **Code-Stil & Sprache/Framework**: `[ANPASSEN]`.
- **Definition of Done**: Build grün, Tests grün, Doku aktualisiert, keine TODOs.
- **Verbote**: keine Secrets im Code, keine ungetesteten Endpunkte, keine Abkürzungen an Tests.
- **Befehle**: welche `/tools`-Skripte für lint/test/build aufzurufen sind.

### B3. Spec-Format (`specs/_template.md`)
```
# <Feature/Service>
## Ziel            (1–3 Sätze, fachlich)
## Akzeptanzkriterien   (überprüfbare Liste — wird zu Tests)
## API / Schnittstellen (Endpunkte, Ein-/Ausgaben, Fehler)
## Datenmodell     (Entitäten, Felder)
## Nicht-Ziele     (was ausdrücklich NICHT gebaut wird)
## Offene Fragen
```
Die Spec ist die einzige Wahrheit. Code folgt der Spec — nicht umgekehrt.

### B4. Tools (je ein Befehl = ein Schritt)
- `tools/lint`, `tools/format`, `tools/test`, `tools/test-e2e`, `tools/build`, `tools/check` (alles zusammen).
- Diese Befehle ruft der Agent selbst auf — das ist der „Tooling"-Schritt der Pipeline.

### B5. Tests als Akzeptanz-Gate
- **API-Tests** pro Service: gegen echte DB im Container (TestContainers o. ä.). `[ANPASSEN]`
- **Workflow-/E2E-Tests**: Geschäftsprozess über n8n + mehrere Services.
- Regel: Ein Feature gilt erst als fertig, wenn seine Akzeptanzkriterien als grüne Tests existieren.

---

## Teil C — Tech-Stack anpassen (Swap-Punkte)

| Baustein | Im Video | Deine Wahl `[ANPASSEN]` |
|---|---|---|
| Coding Agent | Claude / Anthropic | Claude Code, oder anderer CLI-Agent |
| Git | Gitea (self-hosted) | GitHub / GitLab / Gitea |
| CI | Build Runner | Gitea/GitHub/GitLab Actions, Jenkins |
| Backend-Sprache | (nicht gezeigt) | z. B. .NET, Go, Java, Node, Python |
| Frontend | React + Web | React / Vue / Svelte / Blazor |
| API Gateway | generisch | Traefik / Kong / YARP / nginx |
| Workflow Engine | n8n | n8n / Temporal / Camunda |
| Tests | TestContainers | TestContainers + Test-Framework deiner Sprache |
| Hosting | NAS | NAS / VPS / Cloud (K8s) |
| Vergleichsmodell | DeepSeek V4 Pro (Schätzung) | optional |

**Wichtig:** Die *Methodik* (Harness + Phasen) ist stack-unabhängig. Du kannst jeden Baustein tauschen, ohne den Prozess zu ändern.

---

## Teil D — Reifegrad-Fahrplan (so steigerst du dich)

1. **Quality Driven zuerst**: Agent + feste Lint/Build/Test-Befehle. Du reviewst noch viel.
2. **Spec Driven**: Schreibe Specs vor dem Code; lass den Agent strikt gegen die Spec bauen.
3. **Test Driven**: Akzeptanzkriterien → Tests zuerst; Agent macht Tests grün.
4. **Idea Driven**: Feedback-Loop schließen — Testergebnis/CI-Output fließt automatisch zurück in den Agent-Kontext; Agent iteriert selbst bis grün.
5. **Voice Driven** (optional): Idee per Sprache → Recherche/Spec-Entwurf → Pipeline.

**Messen** (wie im Video): pro Schritt Geschwindigkeit, Tech-Debt, Doku-Quote, Testabdeckung und Token-Kosten erfassen, um den Fortschritt zu belegen.

---

## Startreihenfolge (kompakt)

1. Git + CI + Container-Setup (Teil A1–A3).
2. Ein erster Microservice mit Dev-Env + API-Tests (A5, B5).
3. `AGENTS.md` + `specs/_template.md` + `tools/*` anlegen (Teil B).
4. Coding Agent anschließen, ersten Feature-Loop in „Spec Driven" fahren.
5. n8n + API Gateway ergänzen, sobald >1 Service existiert.
6. Feedback-Loop automatisieren → Richtung „Idea Driven".

> Sag mir deinen geplanten Stack (Sprache, Frontend, Hosting), dann konkretisiere ich `AGENTS.md`, die `tools/*`-Skripte und ein `docker-compose` als Startgerüst für genau deine Technologie.
