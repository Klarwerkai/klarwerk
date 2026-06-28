# Klarwerk — Datenschutz- & DSGVO-Anforderungen (konsolidiert)

> Konsolidierte **Anforderungs-/Klassifikationssicht** als Ergänzung zum operativen
> `gdpr-compliance-runbook.md` (VVT/DSFA/Betroffenenrechte/Review). Hier: **Datenarten**,
> **lokal vs. Cloud**, **Prompt-/Log-/Audit-Aufbewahrung**, **AVV/DSFA-Checkpunkte**,
> **Verantwortlichkeiten**.
> **Keine Rechtsberatung. Keine Rechtsgrundlage/AVV/DSFA-Freigabe.** Diese liegen beim
> **Betreiber/DSB**. Verwandt: `monitoring-logging.md`, `secrets-management.md`,
> `inference-server-readiness.md`, `local-runtime-readiness.md`, `local-chat-ui-readiness.md`,
> `rag-readiness-decision.md`, `fine-tuning-decision.md`, `api-auth-readiness.md`.

---

## 1. Datenklassifikation je Datenfläche (belegt aus Code)

| Datenfläche | Inhalt | Klasse | Personenbezug | Speicherort |
| --- | --- | --- | --- | --- |
| **Knowledge Objects** | betriebliches Fachwissen (Titel/Statement/Body) | intern (i. d. R.) | möglich in Freitext | Postgres |
| **Anhänge** (`object-store`) | Original-Dateien/Bilder (Bytes) | intern–**sensibel möglich** | **möglich** (Foto/Dokument) | Postgres (`objects`) |
| **Quellen** (`KoSource`) | externe Belege (url/excerpt/provider) | öffentlich/extern | gering | Postgres |
| **Audit-Log** | wer (User-ID), wann, Aktion, Ziel, `payload` | **personenbezogen** | **ja** | append-only Hash-Kette |
| **ModelRun-Protokoll** | **nur Metadaten** (Provider/Status/Fallback/Timing/generischer Fehler) | technisch | **nein** (per Design **keine** Prompt-/Antworttexte/KO-Inhalte) | Postgres (`model-runs`) |
| **Wissenslücken** (`Gap`) | **die gestellte Frage** (Freitext) + Status/Priorität | intern–**personenbezogen möglich** | **möglich** (Frage als Freitext) | Postgres |
| **Konto/Auth** | Name, E-Mail, Rolle, Login-Events | **personenbezogen** | **ja** | Postgres + Audit |
| **Server-/Proxy-Logs** | ggf. IP, Request-Meta (außerhalb App-Audit) | personenbezogen möglich | möglich | Betreiber-Logging (Coolify/Proxy) |

**Klassifikationsschema:** *öffentlich · intern · personenbezogen · besondere Kategorien (Art. 9)*.
**Wichtige, ehrliche Befunde:**
- **ModelRuns enthalten KEINE Prompt-/Antwortinhalte** (Code: „NIE Prompt-/Antwortinhalt"; `monitoring-logging.md`).
- **Unbeantwortete Fragen werden als `Gap` mit `question`-Freitext gespeichert** → kann personenbezogene/sensible Eingaben enthalten (Datenminimierung in AUP beachten).
- **Anhänge** können besondere Kategorien (Art. 9) enthalten → AUP: solche Inhalte nur wenn rechtlich gedeckt.

---

## 2. Verarbeitung: lokal vs. Cloud

| Modus | Datenfluss | DSGVO-Konsequenz |
| --- | --- | --- |
| **Deterministischer Default** (kein Modell) | **bleibt im System** (kein externer Call) | datenschutzfreundlichster Betrieb |
| **Anthropic-Modellmodus** (API-Key) | Frage/Kontext → **externer Modellanbieter** | **AVV/Subprozessor + DSFA-Prüfung**; sensible Inhalte ausschließen |
| **Lokale Runtime später** (Ollama/llama.cpp, `local-runtime-readiness.md`) | bleibt **lokal/im Haus** | datenschutzfreundlich; kein externer Modell-Datenfluss |
| **Cloud-GPU später** (`gpu-provider-decision.md`) | Daten → Cloud-Region | **EU-Region + AVV** zwingend; DSFA aktualisieren |
| **RAG/Embeddings später** (`rag-readiness-decision.md`) | Embedding-Erzeugung = neue Verarbeitung | VVT/DSFA-Update; PII-Filter vor Index |
| **Fine-Tuning später** (`fine-tuning-decision.md`) | Trainingsdaten → Anbieter; Wissen „eingebacken" | konfligiert mit Löschung; eigene DSFA |

→ **Heute:** Default lokal/extern-optional. **Jeder** Wechsel zu Cloud/Modell/RAG/Fine-Tuning ist ein **DSFA-/AVV-Trigger** (§4).

---

## 3. Aufbewahrung / Löschung (Prompts, Logs, Audit)

| Daten | Aufbewahrung | Löschung |
| --- | --- | --- |
| **Prompts/Antworten** | **werden nicht gespeichert** (keine Persistenz) | n/a (existieren nicht) |
| **ModelRun-Metadaten** | vom **Betreiber festzulegen** (z. B. 90 Tage, `monitoring-logging.md`); **keine** Inhalte | per Retention-Policy löschbar |
| **Gap-Fragen (Freitext)** | so lange Lücke offen/relevant | mit KO-/Gap-Lebenszyklus; löschbar (kein Audit) |
| **KOs/Anhänge** | fachlicher Lebenszyklus; Admin kann **löschen** (`ko.deleted`) | über UI/Admin |
| **Audit-Log** | **append-only, unveränderlich** (Manipulationsschutz) | **bewusst nicht löschbar** → Abwägung *Recht auf Löschung ↔ Nachweispflicht* **dokumentieren** |
| **Konto** | bis Löschung; Admin `user.delete` | über Admin |
| **Server-/Proxy-Logs** | **Betreiber-Logging-Policy** (außerhalb App) | Betreiber |

> **Kritisch/offen:** Für ModelRun-Metadaten und Server-/Proxy-Logs ist die **konkrete Retention-Frist** noch **Betreiberentscheidung**; die **Audit-Löschungs-Abwägung** ist organisatorisch zu dokumentieren.

---

## 4. AVV- & DSFA-Checkpunkte

**AVV (Auftragsverarbeitung)** prüfen/abschließen bei:
- Managed-Hosting (Hetzner/Coolify) als Auftragsverarbeiter,
- **externem Modellanbieter** (Anthropic) im Modellmodus,
- **Cloud-GPU**-Provider (später),
- jedem weiteren Subprozessor (SMTP, externe Suche).

**DSFA (Schwellwert, `gdpr-compliance-runbook.md` §2)** prüfen bei „ja" zu u. a.:
- besondere Kategorien/Beschäftigtendaten in größerem Umfang,
- **Aktivierung externer KI** (Modellmodus),
- neue Verarbeitung (RAG/Embeddings, Fine-Tuning, Cloud-GPU).

> Beides ist **Betreiber-/DSB-Aufgabe**; dieses Dokument **ersetzt keine** rechtliche Bewertung.

---

## 5. Verantwortlichkeiten

| Rolle | Verantwortung |
| --- | --- |
| **Betreiber (Verantwortlicher i. S. d. DSGVO)** | Rechtsgrundlagen, VVT, AVV, DSFA, Retention-Fristen, Betriebsvereinbarung |
| **DSB / juristische Beratung** | rechtliche Bewertung, DSFA-Durchführung, Betroffenenrechte-Prozess |
| **Admin** | Nutzer-/KO-Löschung, manuelle Auskunft, Rollen/RBAC |
| **Klarwerk (Software)** | technische Schutzmaßnahmen (RBAC, Auth, append-only Audit, kein Prompt-Logging) |

---

## 6. Kritische offene Punkte (ehrlich, ohne Folge-Ticketflut)

1. **Retention-Fristen** für ModelRun-Metadaten + Server-/Proxy-Logs — Betreiber festzulegen.
2. **Audit-Löschungs-Abwägung** (Art. 17 ↔ Integrität) — organisatorisch dokumentieren.
3. **Self-Service Auskunft/Export & Löschung** — heute **manuell** (Admin/DSB), kein Produktfeature (NFR-PRV-04).
4. **Gap-Frage-Freitext** kann PII/sensibles enthalten — Datenminimierung in AUP betonen.
5. **AVV/DSFA** für Modellmodus/Cloud/RAG/Fine-Tuning — vor Aktivierung.

---

## 7. Nicht-Ziele

- **Keine Rechtsberatung**, keine Rechtsgrundlage/AVV/DSFA-Freigabe, keine Massen-Folge-Tickets.
- Kein Produktcode geändert; reine **Anforderungs-/Klassifikationsdokumentation**.

---

## 8. Done-Kriterien

1. **Datenklassifikation** über alle Flächen vorhanden (§1) — ✓ mit diesem Dokument.
2. **Lokal-vs-Cloud-Verarbeitung** dokumentiert (§2) — ✓.
3. **Aufbewahrung Prompts/Logs/Audit** dokumentiert (§3) — ✓ (Fristen: Betreiber offen).
4. **AVV/DSFA-Checkpunkte + Verantwortlichkeiten** benannt (§4/§5) — ✓.
5. **Rechtliche Freigabe + konkrete Fristen** durch Betreiber/DSB — **offen** (außerhalb dieses Dokuments).

---

## 9. Empfehlung

**PARTIAL.** Die **Anforderungen sind jetzt konsolidiert dokumentiert**: vollständige **Datenklassifikation** (inkl. der ehrlichen Befunde „ModelRuns ohne Inhalte" und „Gap speichert Frage-Freitext"), **lokal-vs-Cloud**-Verarbeitung mit allen späteren Triggern, **Aufbewahrung/Löschung** für Prompts/Logs/Audit, **AVV-/DSFA-Checkpunkte** und **Verantwortlichkeiten** — ergänzend zum operativen Runbook. **Aber:** die **rechtliche Bewertung, AVV-/DSFA-Durchführung und konkrete Retention-Fristen** sind **Betreiber-/DSB-Aufgaben** und **liegen nicht vor** (werden hier bewusst **nicht** erfunden). Das Kriterium „Anforderungen festgehalten" ist **dokumentationsseitig erfüllt**, **freigabeseitig offen** → **Partial**; offene Punkte in §6, Done-Kriterien §8.

---

*Read-only Anforderungs-/Klassifikationsnotiz. Kein Produktcode geändert; keine Rechtsberatung/Freigabe; Befunde aus Code (`model-runs`, `audit`, `ask`, `object-store`, `knowledge-object`) + bestehendem Runbook.*
