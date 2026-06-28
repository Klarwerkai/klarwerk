# Klarwerk — Ziele & Use-Cases für das interne LLM

> Festlegung, **wofür** ein internes/self-hosted LLM in Klarwerk dient, **wer** es nutzt, welche
> **Anforderungen/KPIs** gelten und was es **ausdrücklich nicht** tun darf.
> **Leitprinzip:** *Das Modell formuliert — die Knowledge Objects bleiben die Wahrheit; der
> deterministische Fallback bleibt das Sicherheitsnetz.*
> **Keine Modell-/Runtime-/RAG-/Fine-Tuning-Arbeit, kein Download, keine erfundenen Benchmarks,
> keine vorgetäuschte Freigabe.** Verwandt: `open-source-model-selection.md`,
> `evaluation-quality-assurance.md`, `inference-server-readiness.md`,
> `local-function-performance-baseline.md`, `data-protection-requirements.md`,
> `rag-readiness-decision.md`, `fine-tuning-decision.md`, `local-chat-ui-readiness.md`.

---

## 1. Zweck

Ein internes LLM unterstützt den **Knowledge-OS-Kreis** (Capture → Validate → Use → Maintain) als **Formulierer/Strukturierer** — nicht als Wissensquelle. Es senkt die Hürde, Erfahrungswissen **zu erfassen** und **quellengebunden abzufragen**, ohne die Validierungs-/Trust-/Audit-Prinzipien zu untergraben. Ein **self-hosted** Modell hält dabei Daten im Haus (DSGVO-Vorteil, `data-protection-requirements.md`).

---

## 2. Nutzergruppen

| Gruppe | Rolle (RBAC) | LLM-Berührung |
| --- | --- | --- |
| **Experte** | `experte` | Capture-Strukturierung, Interview, Text-Assist beim Erfassen |
| **Controller** | `controller` | Validierung/Review (LLM-Formulierung als Vorschlag, nie Entscheidung) |
| **Admin** | `admin` | Betrieb/Status; keine privilegierte „Wissens"-Sonderrolle |
| **Management/Demo/Viewer** | `viewer`+ | **Ask** (quellengebundene Antwort), Lesen |
| **Entwickler** | — | **separater Dev-/PoC-Use-Case** (z. B. lokale Chat-UI, `local-chat-ui-readiness.md`) — **kein** Produkt-Wissenszugang |

---

## 3. Use-Cases (aus realem Reasoner-Verhalten, `provider-model.ts`)

Belegte LLM-Aufgaben (`ModelRunTask = structure | assist | interview | answer | select`):

| Use-Case | Task | Was das Modell tut | Leitplanke (Code-belegt) |
| --- | --- | --- | --- |
| **Capture-Strukturierung** | `structure` | Erfahrungsnotiz → **JSON**-KO-Entwurf | „Respond ONLY with JSON … **Do not invent anything**" |
| **Ask-Antwortformulierung** | `answer` | Antwort **nur aus den nummerierten Quellen** | „Beantworte **NUR** auf Basis der Quellen … **Erfinde keine Fakten/Zahlen**"; sonst **ehrliche Lücke** |
| **Text-Assistenz/Wording** | `assist` | Wortlaut verbessern **ohne Inhaltsänderung** | „Improve wording **without changing content** … return ONLY the revised text" |
| **Erfassungs-Interview** | `interview` | **genau eine** nächste konkrete Frage | „Ask exactly ONE … **Do NOT invent** any technical content" |
| **Quellenauswahl** | `select` | Kandidaten-KOs für die Antwort wählen | quellengebunden; nur tatsächlich genutzte Quelle (SCRUM-256) |

> **Demo-/Admin-/Support-Hilfe:** allenfalls als **Nebennutzen** über dieselben Aufgaben — **kein** eigener Produktkern (siehe Nicht-Ziele).

---

## 4. Volumenannahmen (NICHT gemessen → als Szenarien markiert)

> Keine echten Nutzungszahlen vorhanden (`local-function-performance-baseline.md`: nur deterministische Latenz, keine Modell-Last). Folgende **Annahmen** dienen der Dimensionierung, **nicht** als Ist-Werte:

| Szenario | Annahme (Asks+Captures/Tag) | Zweck |
| --- | --- | --- |
| **Pilot/klein** | ~10–50 | erster interner Rollout |
| **Abteilung** | ~50–300 | mehrere Experten/Controller |
| **Werk** | ~300–1500 | breite Nutzung |

→ Vor Modellbetrieb reale Zahlen erheben (ModelRun-Metadaten, `scaling-cost-control-readiness.md`).

---

## 5. Funktionale Anforderungen

- **Deutsch** (primär) + sprachbewusste Systemprompts (DE/EN vorhanden).
- **Quellenbindung:** Antworten nur aus KOs; **ehrliche Lücke** statt Rateantwort.
- **JSON-Treue** bei `structure` (valides, vertragskonformes JSON).
- **Keine Inhaltsänderung** bei `assist` (nur Wortlaut).
- **Latenzrahmen:** interaktiv (Richtwert p95 ≤ ~3–5 s im Modellmodus; **zu messen**, heute nur deterministisch ~ms).
- **Kontextlänge:** muss KO-Quellen + Frage fassen (klein–mittel; großer Kontext erst mit RAG/Chunking relevant).
- **Datenschutz:** **keine** Prompt-/Antwort-Persistenz (`data-protection-requirements.md`); lokal = kein externer Datenfluss.
- **Fallback:** Modellausfall → **deterministischer Provider** (kein Crash), `fallback=true` im ModelRun.

---

## 6. Erfolgskriterien / KPIs

| KPI | Messquelle | Zielrichtung |
| --- | --- | --- |
| **Quellenbindungsrate** | `AnswerResult.sources` / Ask-Tests | beantwortbare Fragen → genau die genutzte Quelle |
| **Gap statt Halluzination** | `gap != null` bei fehlender Grundlage | bestandsfremde/industrielle Lücke → **Gap** |
| **JSON-Validität** (`structure`) | Parser/Reasoner-Tests | hohe Validitätsrate, kein Vertragsbruch |
| **Hilfreiche Capture-Strukturierung** | Review-Quote der Entwürfe | Entwürfe werden überwiegend übernommen |
| **Review-Akzeptanz** | Validierungs-/Audit-Daten | Controller akzeptieren LLM-Vorschläge ohne Korrekturflut |
| **Latenz** | ModelRun `startedAt/finishedAt` | im interaktiven Rahmen |
| **Keine Prompt-/Antwort-Persistenz** | Code/Monitoring-Audit | dauerhaft erfüllt (Datenschutz-KPI) |

> Mess-Anker: die **Eval-Baseline** (`evaluation-quality-assurance.md`, B1–B4) ist der wiederholbare KPI-Prüfstand; ein Modellwechsel darf **keine** Regression bei Quellenbindung/Gap verursachen.

---

## 7. Nicht-Ziele (Abgrenzung)

- **Modell als Wissensspeicher** — Fakten leben in **KOs**, nicht in Gewichten (`fine-tuning-decision.md`).
- **Generischer Chat als Ask-Ersatz** — Ask bleibt quellengebunden (`local-chat-ui-readiness.md`).
- **Ungeprüfte Entscheidungen** — LLM **formuliert/schlägt vor**, Validierung/Trust/Audit entscheiden.
- **Personenbezogene/sensible Freitexte** ungeprüft verarbeiten — Datenminimierung (`data-protection-requirements.md`).
- **Code-Hilfe/Kundensupport als Produktkern** — **nicht** beschlossen; allenfalls separater Dev-Use-Case.

---

## 8. Abhängigkeiten

- **Modellauswahl:** Ziel/Fallback empfohlen (`open-source-model-selection.md`, Qwen2.5-7B / Mistral-7B), Lizenz-Final-Check offen.
- **Runtime/Hardware/Budget:** alle **Partial** (`local-runtime-/local-hardware-readiness.md`, `budget-cost-planning-readiness.md`).
- **Adapter:** `REASONER_PROVIDER`/Base-URL noch nicht env-verdrahtet (`inference-server-readiness.md`).

---

## 9. Done-Kriterien

1. Use-Cases/Nutzergruppen/KPIs **mit Pedi/Stakeholdern abgestimmt und freigegeben**.
2. KPIs an die Eval-Baseline gekoppelt (Mess-/Abnahmeplan).
3. Volumen real erhoben (statt Annahmen).
4. Abhängigkeiten (Modell/Runtime/Hardware/Budget) geklärt.

---

## 10. Empfehlung

**PARTIAL.** Ziele, Nutzergruppen, **Use-Cases (aus realem Reasoner-Verhalten belegt)**, funktionale Anforderungen, **KPIs** und **klare Nicht-Ziele** sind dokumentiert — unter Wahrung des Klarwerk-Prinzips (Modell formuliert, KOs bleiben Wahrheit, deterministischer Fallback). **Aber:** es liegt **keine** dokumentierte **Abstimmung/Freigabe** durch Pedi/Stakeholder vor, **Volumen ist nicht gemessen** (nur Annahmen), und die Umsetzungs-Abhängigkeiten sind offen. Das Kriterium „Ziele & Use-Cases **definiert/abgestimmt**" ist **dokumentationsseitig erfüllt**, **freigabeseitig offen** → **Partial**; Done erst mit Stakeholder-Freigabe + KPI-/Volumenanker.

---

*Read-only Ziele-/Use-Case-Definition. Kein Produktcode geändert; keine Modell-/Runtime-Arbeit; Use-Cases/Leitplanken aus `provider-model.ts`/`ask`/RBAC belegt; keine erfundenen Benchmarks; keine vorgetäuschte Freigabe.*
