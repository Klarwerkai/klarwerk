# Klarwerk — Open-Source-Modell: Auswahl & Vergleich

> Shortlist selbst-hostbarer Modelle für Klarwerks Use-Cases mit **primärquellen-verifizierten
> Lizenzen**. Ziel + Fallback sind als **Empfehlung** dokumentiert; die produktive Aktivierung
> bleibt abhängig von Hardware-/Runtime-/Budget-Verifikation.
> **Kein Modell-Download, keine Runtime-/GPU-/Cloud-Arbeit, keine erfundenen Benchmarks.**
> Verwandt: `local-hardware-readiness.md`, `local-runtime-readiness.md`,
> `local-function-performance-baseline.md`, `gpu-provider-decision.md`,
> `budget-cost-planning-readiness.md`, `inference-server-readiness.md`,
> `rag-readiness-decision.md`, `fine-tuning-decision.md`, `data-protection-requirements.md`.

---

## 1. Anforderungen aus Klarwerk (was das Modell können muss)

Der Reasoner nutzt das Modell **nur** als Formulierer (`services/reasoner/src/provider-model.ts`):
- **Strukturieren** von Erfahrungswissen → **JSON** („Do not invent anything").
- **Antworten NUR aus den nummerierten Quellen** („Reichen die Quellen nicht, sage das ehrlich. Erfinde keine Fakten/Zahlen.").
- **Wortlaut verbessern** ohne Inhaltsänderung.
- **Interview**: genau **eine** nächste Frage, **keine** erfundenen Fakten.

**Konsequenzen für die Auswahl:**
- Gefragt sind **Deutsch**, **Instruction-Following**, **treue JSON-/Textausgabe** — **nicht** Faktenwissen. **KOs bleiben die Wahrheit**, das Modell darf **nie** Wahrheitsquelle werden; der **deterministische Fallback** bleibt das Sicherheitsnetz.
- → Ein **kleines (3B–8B) permissiv lizenziertes** Modell genügt; **kein** großes Modell nötig (senkt Hardware-/Kostenhürde).

---

## 2. Kandidatenmatrix (Lizenz primärquellen-verifiziert; Qualität qualitativ/zu testen)

| Modell | Lizenz (verifiziert) | Kommerz. Nutzung | Größe (typ.) | GGUF/Ollama | RAM (Q4, grob) | Eignung Klarwerk |
| --- | --- | --- | --- | --- | --- | --- |
| **Qwen2.5-7B-Instruct** | **Apache 2.0** (außer 3B/72B = Qwen-Lizenz) [Q] | **ja, sauber** | 7B | ja | ~5–6 GB | **stark** (Mehrsprachig inkl. DE, gutes Instruction-Following, saubere Lizenz) |
| **Mistral-7B-Instruct** | **Apache 2.0** [M] | **ja, sauber** | 7B | ja | ~5–6 GB | **stark** (permissiv, breit unterstützt) — **Achtung:** neuere Mistral-Modelle teils **MNPL/Non-Production** [Mn] |
| **Llama 3.1-8B-Instruct** | **Llama Community License** (custom) [L] | ja, **aber** Klausel >700 Mio. MAU + Acceptable-Use | 8B | ja | ~5–6 GB | stark, aber **nicht-OSI**, Lizenz prüfen |
| **Gemma (7B/9B)** | **Gemma Terms of Use** (custom) [G] | ja, **aber** Prohibited-Use + Flow-down + Kündigungsrecht | 7–9B | ja | ~6–8 GB | gut, aber **Lizenz-Vorsicht** (kein echtes OSI) |
| **Phi-3-mini-4k-Instruct** | **MIT** [P] | **ja, sehr offen** | ~3,8B | ja | ~2–3 GB | **klein/sparsam** (für knappe Hardware), DE schwächer als 7B-Klasse (zu testen) |
| Mixtral-8x7B | Apache 2.0 [M] | ja | 8x7B (MoE) | ja | ~25+ GB | leistungsfähig, **zu groß** für kleinen lokalen PoC |

> **Qualitätsspalten (Deutschqualität/Reasoning/Geschwindigkeit) bewusst NICHT als Zahlen** — keine erfundenen Benchmarks; Deutsch-/Aufgaben-Qualität ist auf **Klarwerks** Tasks zu **testen** (§6).

---

## 3. Empfohlene Shortlist & Ziel/Fallback (verantwortbar, mit Vorbehalt)

- **Zielmodell (Empfehlung): `Qwen2.5-7B-Instruct`** — **Apache 2.0** (sauberste permissive Lizenz unter den starken Kandidaten), mehrsprachig inkl. Deutsch, gutes Instruction-Following/JSON, GGUF/Ollama verfügbar, ~5–6 GB Q4 → passt auf Mac ≥16 GB.
- **Fallback (Empfehlung): `Mistral-7B-Instruct` (Apache 2.0)** — ebenfalls permissiv & breit unterstützt; license-sauberer Rückfall.
- **Sparoption (knappe Hardware): `Phi-3-mini` (MIT)** — sehr klein/offen; Deutschqualität zu prüfen.
- **Mit Lizenz-Vorbehalt:** Llama 3.1-8B (Community License) und Gemma (Gemma Terms) nur, wenn die Custom-Lizenzbedingungen vom Betreiber akzeptiert werden.

> **Unabhängig vom Modell:** Der **deterministische Fallback bleibt** aktiv (kein Modell = kein Crash), und das Modell **formuliert nur** — KOs/Quellenbindung/Trust bleiben maßgeblich.

---

## 4. Hardware-/Budget-/Runtime-Abhängigkeiten

- **Hardware:** 7B Q4 braucht ~5–6 GB (Apple Silicon Unified Memory) → Mac ≥16 GB; **Mac-Hardware ist noch zu verifizieren** (`local-hardware-readiness.md`, Partial).
- **Runtime:** Ollama/llama.cpp **noch nicht installiert/verifiziert** (`local-runtime-readiness.md`, Partial) + Klarwerk-Adapter fehlt (`inference-server-readiness.md`).
- **Budget:** lokal = ~0 € laufend; Cloud-GPU separat (`budget-cost-planning-readiness.md`, keine Freigabe).
- **Performance:** Tokens/sec **nicht gemessen** (keine lokale Runtime; `local-function-performance-baseline.md` §7).

---

## 5. Lizenz-/DSGVO-Prüfpunkte

- **Lizenz vor Einsatz final am Modell-Repo prüfen** (Versionsstände ändern Lizenzen — z. B. Qwen 3B/72B ≠ Apache; Mistral-Neuere ggf. MNPL). Lizenztext + Acceptable-Use des **konkreten** Tags lesen.
- **DSGVO:** **lokales** Modell hält Daten im Haus (Vorteil ggü. externer API; `data-protection-requirements.md` §2). Trotzdem VVT/DSFA bei Aktivierung aktualisieren; keine besonderen Kategorien ungeprüft verarbeiten.
- **Herkunft/Vertrauen:** Modelle nur aus offiziellen Repos beziehen (Integrität).

---

## 6. Testplan für später (Konzept, NICHT ausgeführt)

1. Runtime (Ollama) lokal bereitstellen; **Ziel- + Fallback-Modell** Q4 ziehen (nach Pedi-Freigabe).
2. **Klarwerk-Tasks testen** (deutsch): `structure` (valides JSON?), `answer` (nur aus Quellen, ehrliche Lücke?), `assist` (Wortlaut ohne Inhaltsänderung?), `interview` (eine sinnvolle Frage?).
3. Gegen die **Eval-Baseline** (`evaluation-quality-assurance.md`, B1–B4) prüfen; **Quellenbindung/Anti-Halluzination** dürfen **nicht** regredieren.
4. **Tokens/sec + Latenz** messen (schließt die Lücke aus `local-function-performance-baseline.md`).
5. Ergebnis → verbindliche Ziel-/Fallback-Festlegung.

---

## 7. Nicht-Ziele

- Kein Modell-Download, keine Runtime-/GPU-/Cloud-Arbeit, keine erfundenen Benchmarks, keine harten Lizenzzusagen ohne Repo-Verifikation des konkreten Tags.
- Kein Produktcode; reine **Auswahl-/Vergleichsdokumentation**.

---

## 8. Done-Kriterien

1. Runtime + Mac-Hardware verifiziert (`local-runtime-/local-hardware-readiness.md`).
2. Ziel- + Fallback-Modell **lokal getestet** auf Klarwerk-Tasks (§6) ohne Regression bei Quellenbindung.
3. **Lizenz des konkreten Modell-Tags** final geprüft + akzeptiert (Betreiber).
4. Tokens/sec/Latenz gemessen; verbindliche Festlegung dokumentiert.

---

## 9. Empfehlung

**PARTIAL.** Anforderungen, eine **Kandidatenmatrix mit primärquellen-verifizierten Lizenzen** und eine **Shortlist mit Ziel (`Qwen2.5-7B-Instruct`, Apache 2.0) + Fallback (`Mistral-7B-Instruct`, Apache 2.0)** sind dokumentiert — verantwortbar, weil Klarwerk das Modell nur als **Formulierer** nutzt (KOs bleiben Wahrheit, deterministischer Fallback bleibt). **Aber:** **Deutsch-/Aufgabenqualität ist nicht gemessen** (keine erfundenen Benchmarks), und **Hardware-/Runtime-/Budget-Verifikation fehlen** (alle Partial). Daher ist die Auswahl eine **begründete Empfehlung**, **keine** verbindliche Festlegung → **Partial**; verbindlich erst nach lokalem Test (§6) + Lizenz-Final-Check des konkreten Tags.

---

## Quellen (primär/offiziell)

- [Q] Qwen2.5 Lizenz (Apache 2.0; Repo-LICENSE): https://huggingface.co/Qwen/Qwen2.5-7B-Instruct · https://huggingface.co/Qwen/Qwen2.5-7B/blob/main/LICENSE
- [M] Mistral 7B / Mixtral (Apache 2.0): https://mistral.ai/news/announcing-mistral-7b/ · https://huggingface.co/mistralai/Mixtral-8x7B-Instruct-v0.1
- [Mn] Mistral Non-Production License (MNPL, gilt für bestimmte neuere Modelle): https://mistral.ai/news/mistral-ai-non-production-license-mnpl/
- [L] Llama 3.1 Community License: https://www.llama.com/llama3_1/license/ · https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
- [G] Gemma Terms of Use: https://ai.google.dev/gemma/terms
- [P] Phi-3 MIT License: https://huggingface.co/microsoft/Phi-3-mini-4k-instruct/blob/main/LICENSE

*Lizenzen am 2026-06-27 aus offiziellen Quellen recherchiert; vor Einsatz am konkreten Modell-Tag final zu prüfen (Lizenzen können je Version abweichen). Keine Benchmarks erfunden; kein Produktcode geändert.*
