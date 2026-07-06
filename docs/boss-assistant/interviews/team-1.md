# Interview — Team 1

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Team 1 (unverifiziert, wo markiert)._

## 1. Rolle & Domäne
- **Team 1 = KLARWERK Produktkern / Knowledge OS.** Fachliche Produktlogik + Nutzeroberfläche
  des Wissenskreises **Capture → Studio → Review → Use → Aktuell halten**.
- KLARWERK ist ein **Knowledge OS (kein Chatbot)**: Erfahrungswissen als **Knowledge Object (KO)**
  erfassen → im Team validieren → quellengebunden nutzen → revalidieren.
- Arbeitsrolle: „Hauptumsetzer fachlicher Inhalt" — schreibt Code/Tests/Doku-Slices,
  **kein** Git/Commit/Push/CI/Jira/Deployment (das macht **Codex**; Freigaben macht **Pedi**).

## 2. Aufgaben & Verantwortung
- Repo: `/Users/peterkohnert/Documents/dev_Klarwerk` (modularer Monolith, Node/TS/Fastify, React `apps/web`).
- Backend-Module (`services/*`, 20): zentral `knowledge-object` (KO + Trust/Status), `capture`,
  `structure`, `validation`, `conflicts`, `ask`, `reasoner`, `lifecycle`, `object-store`,
  `auth`/`rbac`, `audit`, `model-runs`.
- Frontend (`apps/web/src/pages`, 19 Seiten): `Capture`, `KnowledgeDetail`, `Validation`, `Ask`,
  `Library`, `Risk`, `Lifecycle`, `Start`, `MyTasks` … + `components/KnowledgeInputStudio.tsx`
  + ~130 DOM-freie Helfer in `apps/web/src/lib/*`.
- Arbeitsweise: kleiner testbarer Slice → DOM-freier Helfer + Test → UI-Verdrahtung → Gates grün
  (`npm run check` = Build + Biome + dependency-cruiser + Vitest, ~198 Testdateien) + FE-tsc;
  danach `docs/TEAM6_UPDATE.md` + `docs/qm/claude-after-report.md` fortschreiben.

## 3. Aktueller Stand
- **Fertig:** Produktkern-Flow beta-nah; techn. RC-Kandidat `main@1e662e9` (SCRUM-377) an **Team 5** übergeben.
  HEAD aktuell `35e11ec` (SCRUM-379). CI laut Codex-Review grün (**nicht selbst gegen GitHub verifiziert**).
- **In Arbeit / RC-Support-Modus:** kein neuer Feature-Slice während Team-5-RC-Prüfung; reagiert nur auf
  konkrete Smoke-Findings + Pedi-Freigabe (`docs/BETA_RC_SMOKE_FIX_RESPONSE_LANE_V0.md`, SCRUM-379).
- **Blockiert/wartend:** auf Team-5-Smoke-Ergebnis (Conditional Go/No-Go) bzw. Pedi-Fix-Freigabe.

## 4. Entscheidungen & Änderungen (inkl. verworfener Ansätze)
- **KI bewusst begrenzt:** Reasoner deterministisch + quellengebunden; fehlende Basis → **Gap** statt
  erfundener Antwort. Fix gegen Offtopic-Langkontext-„belegt": Stopwort-Filter in
  `services/reasoner/src/provider.ts` (~SCRUM-368).
- **Retrieval:** von „alle KOs in-memory / nur Keyword" → `findCandidates`-Prefilter (InMemory + Pg)
  + `pg_trgm`/GIN-Indizes (SCRUM-360/361/362). **Verworfen:** RAG/Vektor-DB/Embeddings („nicht jetzt /
  anderes Team", `docs/operations/rag-readiness-decision.md`, `vector-db-readiness-decision.md`).
- **Attachments/Evidence:** „nur Bilder" → Nicht-Bild-Dateien behalten Originalbytes → Object-Store;
  kein Legacy-`data:`-URL-Link (verworfen, XSS/Ehrlichkeit), nur `/api/objects/:id/raw` (SCRUM-355/373).
  Teilfehler beim Anhängen kippt nicht mehr den ganzen Save (SCRUM-374).
- **Trust-Formel:** provisorisch (warn wirkungslos, kein Deckel) → zentrale `computeOutcome`
  (warn/down-Gewichte + Deckel 99, SCRUM-359). Vollständige §3-Formel **zurückgestellt (P2)**.
- **UX/Story-Serie:** Capture/Studio geführter (SCRUM-352/369/370/375/376) → app-weite Empty-State-Story
  (SCRUM-377). **Verworfen:** Gamification/Punkte/Score, Auto-Validierung, kompletter UI-Neubau.
- **Draft-Submit:** fortgesetzte Drafts über vorhandene Promote-Route abschließen statt neuem KO (SCRUM-354).

## 5. Offene Punkte & Abhängigkeiten
- **Team 5:** Smoke/Readiness, Deployment-Gates, Last-/Scale-Test (AG-03), Usability-Abnahme (AG-12/13).
  Übergabe: `docs/BETA_RC_TEAM5_HANDOFF_V0.md` (SCRUM-378).
- **Pedi:** finale Freigaben/Go, „validiert-only"-Antwortpolitik, Mehrmandanten-Scope, Live-Modell-Eval (AG-04).
- **Ops:** `pg_trgm` in Zielumgebung; Restore-Test (AG-09); Pen-Test (AG-07); Ersteinrichtung 1. Admin über
  HTTPS; SSO/OIDC scharfschalten.
- **Team 6:** liefert UX-/Gap-Vorgaben (AG-/KG-UX-/FR-*); Team 1 liest read-only, spiegelt in `docs/TEAM6_UPDATE.md`.
- **Team 2 / RAG / Local-LLM:** ausdrücklich außerhalb Team-1-Scope.

## 6. Risiken, Fallstricke & bekannte Widersprüche
- **RC-Drift-Risiko:** „bei Gelegenheit"-Änderungen im Support-Modus — eingedämmt durch Response-Lane + Stop-Lines.
- **Doku-Fallstrick:** in `docs/TEAM6_UPDATE.md` blieben Snapshot-Zeilen teils „ausstehend/pending commit",
  obwohl Codex schon committed hatte → gegen `git log` prüfen.
- **Ehrlichkeits-Fallstrick:** Ask kann aus ungeprüftem Wissen antworten, MUSS als „ungeprüft" kennzeichnen;
  Evidence/Anhänge ersetzen nie Validierung/Status/Trust.
- **Nicht nachgewiesen (offen):** 10k/100k-Scale, Live-Modell-Benchmark, Restore, Pen-Test, DSAR.
- **Unsicherheit:** Jira-Ticket-Zustände + Live-CI nicht direkt verifiziert (nur aus Repo-Doku/Commits abgeleitet).
  `docs/operations/*` überwiegend ehrlich als „Partial" markiert.
- **Kleinigkeit:** `vitest.config.ts.timestamp-*.mjs` = Tool-Temp, kein Produktbestandteil.

## 7. Übergabewissen + Referenzen
- Einstieg: `CLAUDE.md`, `/PROJECT_CONTEXT` (00–12), `docs/TEAM6_UPDATE.md`, `docs/qm/claude-after-report.md`.
- RC-Support: `docs/BETA_RC_TEAM5_HANDOFF_V0.md` (SCRUM-378), `docs/BETA_RC_SMOKE_FIX_RESPONSE_LANE_V0.md` (SCRUM-379).
  Regel: keine RC-Änderung ohne konkretes Finding + Pedi-Freigabe; P0/P1 → genau ein minimaler Fix-Slice.
- Datenmodell: KO-Status `entwurf | offen | validiert | abgelehnt | konflikt`; Trust 0..99/100;
  RBAC `admin | experte | viewer`; Persistenz Postgres (`repo-pg.ts`) + InMemory-Adapter; nur synthetische
  Demo-Daten (`services/app/src/seed-demo.ts`), keine echten Kundendaten/Secrets.
- Gates: `npm run check` grün + FE-tsc grün (`(cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit)`).
- Git: `github` → `git@github.com:Klarwerkai/klarwerk.git`, `origin` → lokale Gitea (`localhost:3000`);
  Branch `main`; RC `1e662e9`, HEAD `35e11ec`.
- Jira: Projekt `SCRUM`; Team-1 jüngst SCRUM-369…379; Cluster: Trust/Konflikt (357–359),
  Retrieval/Scale (360–362), Auth/Security (356/367), Anti-Halluzination-Eval (366/368). Live-Status unverifiziert.
