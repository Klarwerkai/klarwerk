# Klarwerk — Lokale Chat-Oberfläche (Open WebUI): Readiness-Notiz

> Ehrliche Bestandsaufnahme, ob eine **lokale Chat-Oberfläche mit lokalem Modell** existiert/
> vorbereitet ist, und wie sie sich von Klarwerks **eigener Ask-Oberfläche** unterscheidet.
> **Kein Open WebUI installiert, kein Docker-Container gestartet, keine Ollama/llama.cpp-Runtime
> verbunden, kein Modell geladen.** Verwandt: `inference-server-readiness.md`,
> `gpu-provider-decision.md`, `fine-tuning-decision.md`, `rag-readiness-decision.md`,
> `api-auth-readiness.md`, `docs/demo/stage-1-demo-path.md`.

---

## 1. Heutiger Zustand

- **Keine lokale Chat-Oberfläche** (Open WebUI o. Ä.) im Code, Docker, Env oder als laufender Dienst. Suche nach `open-webui|webui|11434|OPENAI_BASE_URL|ollama|llama.cpp` → **keine** Implementierung; die einzigen Treffer stehen im internen Dossier und **bestätigen die Abwesenheit** („Lokale LLM-Runtime fehlt (kein Ollama)").
- **Keine lokale Modellruntime** (kein Ollama/llama.cpp). Der Reasoner nutzt **Anthropic-API** (mit Key) **oder** den **deterministischen Fallback** (`inference-server-readiness.md`).
- `docker-compose*.yml`: nur App + Postgres (+ n8n in Dev) — **kein** WebUI-/Modell-Container. `.env.example`: kein `OPENAI_BASE_URL`/`OLLAMA*`.

> **Folge:** Es ist **keine** lokale Chat-Oberfläche mit lokalem Modell erreichbar. Das Jira-Kriterium ist **nicht** erfüllt.

---

## 2. Was Klarwerks eigene Ask-Oberfläche bereits leistet (real)

`apps/web/src/pages/Ask.tsx` + Helfer (`askView`, `askResponse`, `askExamples`, `askQuestion`):

- Frage an `POST /api/ask` → **`AnswerResult`** mit **`knowledgeClass`** (`gesichert` nur bei validiertem KO), **`sources`** (Belegstellen), **`trust`** (ConfidenceBar), **Reasoner-Status-Badge** (Modell vs. deterministisch).
- **Ehrliche Wissenslücke** statt Rateantwort; Lücke → **Capture-CTA** (`captureGapHref`).
- **Beispiel-Fragen** + Erwartungs-Badges; **Helpful**-Feedback (Trust/Audit).
- **RBAC-/Session-geschützt** (`api-auth-readiness.md`).

→ Klarwerk hat **bereits eine produktive Frage-Antwort-UI** — sie ist **nicht** generisch, sondern **wissensgebunden**.

---

## 3. Warum Open WebUI ≠ Klarwerk Ask / Knowledge OS

| Aspekt | **Open WebUI** (generischer Chat) | **Klarwerk Ask** (Knowledge OS) |
| --- | --- | --- |
| Wissensquelle | **Modell-internes** Wissen (lokales LLM) | **validierte Knowledge Objects** (eigene Daten) |
| Quellen/Belege | i. d. R. **keine** | **`sources` + Belegstelle** pro Antwort |
| Validierung/Trust | keine | **`knowledgeClass`/`trust`**, nur validiert = `gesichert` |
| Halluzination | möglich (frei generiert) | **ehrliche Lücke** statt Rateantwort |
| Audit/Governance | gering | **Audit + Versionierung + RBAC** |
| Zweck | freies Chatten mit einem Modell | **geprüftes, quellengebundenes Werkswissen** |

> **Kernpunkt:** Eine generische Chat-UI auf ein lokales Modell würde Klarwerks Leitprinzip („nur validiertes, quellengebundenes Wissen; das Modell formuliert nur") **untergraben**, wenn sie das Knowledge OS umgeht. Open WebUI ist daher **kein Ersatz** für Ask, sondern allenfalls ein **separates Dev-/PoC-Werkzeug** für eine lokale Modellruntime.

---

## 4. Wozu eine lokale Chat-UI (Open WebUI) später nützlich wäre

- **Dev-/PoC-Frontend** für eine lokale Modellruntime (Ollama/vLLM/TGI) — um Modelle/System-Prompts **vor** der Produkt-Integration zu testen.
- **Modellvergleich/Prompt-Tuning** außerhalb des Produkts.
- **Nicht** als End-User-Oberfläche für Werkswissen (das bleibt Ask/Knowledge OS).

---

## 5. PoC-Schritte für später (Konzept, NICHT ausgeführt)

1. **Lokale Modellruntime** bereitstellen (Ollama als einfachste Option; `inference-server-readiness.md` §8) — Voraussetzung.
2. **Open WebUI** lokal/im internen Netz starten (Docker), gegen die Runtime (z. B. `OLLAMA`/OpenAI-kompatible Base-URL) verbinden.
3. **Auth** vor die WebUI setzen (Login/Reverse-Proxy) — nicht offen exponieren.
4. **Datenfluss klären:** nur Testdaten; **kein** ungeprüfter Werkswissens-/PII-Abfluss in ein generisches Chat-Log.
5. **Abgrenzung dokumentieren:** WebUI = Dev/PoC; produktives Werkswissen weiterhin nur über Klarwerk Ask.

---

## 6. Auth / Privacy / Datenfluss

- **Lokal/intern halten:** Open WebUI nie ohne Auth öffentlich exponieren; hinter Login/Proxy.
- **Datenschutz:** ein generischer Chat speichert i. d. R. Verläufe — **keine** echten personenbezogenen/Werksdaten in einen PoC geben; DSGVO/VVT beachten (`gdpr-compliance-runbook.md`).
- **Trennung:** PoC-Chat-Daten **getrennt** von Klarwerks validiertem Wissensbestand; kein automatischer Rückfluss.
- **Logging:** Klarwerk selbst loggt **keine** Prompt-/Antworttexte (`monitoring-logging.md`) — ein PoC-Tool muss das eigenständig sicherstellen.

---

## 7. Done-Kriterien

1. **Lokale Modellruntime** läuft (Ollama o. Ä.) — abhängig von `inference-server-readiness.md`.
2. **Open WebUI** lokal/intern **erreichbar** und **mit dem lokalen Modell verbunden** (Chat funktioniert).
3. **Auth** vor der WebUI aktiv; Datenfluss/Privacy geklärt.
4. **Abgrenzung** zu Klarwerk Ask dokumentiert (PoC vs. Produkt).

---

## 8. Nicht-Ziele

- Keine Open-WebUI-Installation, keine Docker-Container, keine Ollama/llama.cpp-Runtime, kein Modell-Download, keine Nutzer/Logins in fremden Systemen.
- Keine Ersetzung der Klarwerk-Ask-Oberfläche; kein Umgehen des Knowledge OS.
- Kein Produktcode geändert; reine **Readiness-Dokumentation**.

---

## 9. Empfehlung

**PARTIAL.** Es existiert **keine** lokale Chat-Oberfläche (Open WebUI) und **keine** lokale Modellruntime — das Kriterium „lokale Chat-Oberfläche bereitgestellt (mit lokalem Modell verbunden)" ist **nicht** erfüllt. Gleichzeitig hat Klarwerk **bereits** eine produktive, **wissensgebundene** Frage-Antwort-UI (Ask), die einem generischen Chat fachlich **überlegen** ist (Quellen/Trust/Validierung/ehrliche Lücke). Ein lokaler Open-WebUI-PoC ist erst sinnvoll, **nachdem** eine lokale Modellruntime existiert (`inference-server-readiness.md`, ebenfalls Partial), und bleibt ein **Dev-/PoC-Werkzeug**, **nicht** der End-User-Zugang zum Werkswissen → **Partial**; nächste Schritte in §5/§7.

---

*Read-only Readiness-Notiz. Kein Produktcode geändert; keine WebUI/Runtime/Modell erzeugt; Evidence aus vorhandenem Code/Config/Docs.*
