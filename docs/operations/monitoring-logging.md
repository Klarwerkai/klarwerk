# Klarwerk — Monitoring & Logging (Betreiber-Runbook)

> Ops-Runbook, um Betrieb überwachbar zu machen und Probleme früh zu erkennen.
> **Ehrlichkeitsregel:** Dieses Dokument behauptet **kein** aktives Dashboard und **keine**
> Produktiv-Alerts. Was real existiert, ist unten als Evidence belegt; **Dashboards/Alerts bleiben
> offene Betreiber-/Ops-Aufgabe** (§6/§7/§11).
> Verwandte Doku: `deploy-hetzner.md`, `maintenance-update-process.md`, `backup-disaster-recovery.md`,
> `secrets-management.md`, `docs/compliance/gdpr-compliance-runbook.md`.

---

## 1. Monitoring-Scope

| Ebene | Was | Quelle |
| --- | --- | --- |
| **Verfügbarkeit** | App lebt? | `GET /health` |
| **KI-Status** | Reasoner verfügbar? Modus/Provider? | `GET /api/reasoner/status`, `GET /api/ai-status`, `GET /api/reasoner/config` |
| **KI-Betriebsprotokoll** | jeder Reasoner-Lauf (Metadaten) | `GET /api/model-runs` (read-only, RBAC `ko.read`) |
| **Fachliche Nachvollziehbarkeit** | jede relevante Aktion (wer/wann/Aktion/Ziel) | Audit (append-only Hash-Kette) + Analytics-Audit + `GET /api/audit` |
| **Technische/Runtime-Logs** | Container-stdout, Request-/Access-Logs, Fehler | **Coolify/Reverse-Proxy (Traefik)** — nicht App-intern |
| **Infrastruktur** | CPU/RAM/Disk/Netz, DB | Hetzner/Coolify-Metriken |

---

## 2. Vorhandene Health-/Status-Signale (real)

- **`GET /health`** → `{"status":"ok"}` — schlanker Liveness-Check (auch SPA-Fallback-Ausnahme), genutzt vom Deploy-Smoke.
- **`GET /api/reasoner/status`** (FR-RSN-05) → `{active, provider, mode}` (z. B. `deterministic` ohne Key, Modellmodus mit Key).
- **`GET /api/ai-status`** → `{ai:{…}}` (gleiche Info, §2.1 „ist die KI verfügbar?").
- **`GET /api/reasoner/config`** → Reasoner-Konfig (ohne Geheimnisse).
- **`GET /api/model-runs?limit=N`** → jüngste **ModelRun-Metadaten**: `task` (structure/assist/interview/answer/select), `provider`, `model?`, `status` (success/error), `fallback`, `demo`, `startedAt`/`finishedAt` (→ **Latenz ableitbar**), `error?` (generisch). **Keine** Prompt-/Antworttexte.

---

## 3. Audit vs. technische Logs

- **Audit-Log (fachlich):** lückenlos, **append-only Hash-Kette**, manipulationssicher; jede relevante Aktion. Zweck: Nachvollziehbarkeit/Integrität — **nicht** Leistungs-/Verhaltenskontrolle (Betriebsvereinbarung empfohlen, `gdpr-compliance-runbook.md`). Zugriff: Controller/Admin.
- **ModelRun-Protokoll (KI-Betrieb):** technische Metadaten je Reasoner-Lauf (Provider-Modus, Fallback, Fehler, Timing) — read-only, **ohne Inhalte**.
- **Technische/Runtime-Logs:** das App-Framework (Fastify) läuft **ohne aktivierten Request-Logger**; technische/Access-Logs entstehen auf der **Coolify-/Traefik-/Container-Ebene** (stdout, Proxy-Logs). → Betreiber zentralisiert diese (s. §11).

---

## 4. Datenschutzkonforme Logging-Regeln (by design)

- **Kein Prompt-/Request-/Antwort-Content-Logging.** Belegt: ModelRun speichert nur Metadaten + **generischen** Fehlertext („NIE Prompt-/Antwortinhalt"); kein `console.log` von Frage/Antwort im Code.
- **Keine Secrets in Logs** (G-7; `secrets-management.md`): Schlüssel/Passwörter/Tokens niemals loggen.
- **IP/Personenbezug:** App-Audit nutzt User-IDs; etwaige IP-Logs entstehen am Proxy → Betreiber-Logging-Policy + DSGVO-Löschfristen.
- **Regel für eigene Log-Erweiterungen:** nur Metadaten, keine Klartext-Inhalte/PII; vor Aktivierung von Request-Logging Felder schwärzen.

---

## 5. Metriken-Katalog (Soll — Quelle vorhanden, Aggregation = Ops)

| Metrik | Quelle heute | Status |
| --- | --- | --- |
| Verfügbarkeit/Uptime | `/health` (extern pollen) | Signal da, Aggregation = Ops |
| KI-Modus/Verfügbarkeit | `/api/reasoner/status` | vorhanden |
| Reasoner-Fehlerquote/Fallback-Rate | `/api/model-runs` (`status=error`, `fallback`) | ableitbar |
| Reasoner-Latenz | `model-runs` `startedAt`/`finishedAt` | **ableitbar, nicht aggregiert** |
| **KI-Token/Kosten** | — | **nicht erfasst** (P2, Provider-Usage nötig) |
| Aktions-/Audit-Volumen | Audit-Events | vorhanden |
| HTTP-Fehler/Latenz/Throughput | Proxy/Coolify-Logs | **Ops-seitig** |
| CPU/RAM/Disk/DB | Hetzner/Coolify | **Ops-seitig** |

---

## 6. Empfohlene Dashboards (NICHT installiert)

- **Uptime/Health:** externer Monitor pollt `/health` (z. B. UptimeRobot/Healthchecks) → Verfügbarkeits-Board.
- **KI-Betrieb:** kleines Board aus `/api/model-runs` (Fallback-Rate, Fehlerquote, Latenz-Verlauf).
- **Infra/HTTP:** Coolify-Metriken + Proxy-Access-Logs (optional später Prometheus/Grafana).

> In diesem Ticket wird **kein** Prometheus/Grafana/Cloud-Dashboard installiert — reine Empfehlung.

---

## 7. Alert-Regeln (NICHT aktiv — Vorschlag)

- `/health` ≠ 200 für > N Minuten → **kritisch** (Uptime-Monitor).
- Reasoner-Fehlerquote/Fallback-Rate über Schwelle (aus `model-runs`) → Warnung (Modellmodus prüfen).
- HTTP-5xx-Spike / Latenz-Anstieg (Proxy) → Warnung.
- Disk/DB-Auslastung hoch, Backup-Lauf fehlgeschlagen → kritisch.

> Diese Alerts sind **nicht** aktiv geschaltet — Einrichtung/Empfänger/Kanäle sind Betreiber-Aufgabe.

---

## 8. Aufbewahrungsfristen (Status + Empfehlung)

- **Audit-Log:** bewusst **unveränderlich/append-only** (Manipulationsschutz) — keine automatische Löschung (`gdpr-compliance-runbook.md`).
- **ModelRun-Protokoll:** nur Metadaten; Aufbewahrung vom Betreiber festzulegen (z. B. 90 Tage), keine Inhalte.
- **Sessions:** TTL 14 Tage; **Reset-Token:** 1 Stunde (technisch gesetzt).
- **Proxy-/Server-Logs:** Aufbewahrung = Betreiber-Logging-Policy (DSGVO-konforme Frist).

---

## 9. Incident-Triage (Reihenfolge)

1. **Liveness:** `/health` grün? Container in Coolify up?
2. **KI:** `/api/reasoner/status` — Modus/Fallback wie erwartet? `model-runs` auf Fehler/Fallback-Häufung prüfen.
3. **Aktionen:** Audit/Analytics-Audit auf auffällige/fehlende Aktionen.
4. **Infra/Proxy:** Coolify-Logs, HTTP-5xx/Latenz, Disk/DB.
5. **Eskalation/Rollback:** `maintenance-update-process.md` §11 + `backup-disaster-recovery.md`.

---

## 10. Post-Deploy-Smoke (Pflicht nach jedem Deploy)

- `GET /health` → `{"status":"ok"}`.
- `GET /api/reasoner/status` → erwarteter Modus.
- Login + Kernpfad (`docs/demo/stage-1-demo-path.md`).
- Coolify-Logs ohne Fehler-Spike.

---

## 11. Offene Betreiberpflichten / Nicht-Ziele

- **Uptime-Monitor** auf `/health` einrichten (externer Dienst) — **offen**.
- **Dashboards** (KI-Betrieb/Infra) + **Alert-Regeln/-Kanäle** aktiv schalten — **offen**.
- **Zentrales Log-Management** (Coolify/Proxy-Logs sammeln, Aufbewahrung, Schwärzung) — **offen**.
- **KI-Token/Kosten-Tracking** (falls Modellmodus) über Provider-Usage — **nicht erfasst**, optional.
- Optional: Fastify-Request-Logger aktivieren (strukturierte App-Logs) — bewusst nicht in diesem Doku-Ticket geändert (Produktcode).
- Keine Prometheus/Grafana/Cloud-Installation in diesem Dokument; keine vorgetäuschten Alerts.

---

## 12. Sandbox-Verifikation (ehrliche Evidence)

Real geprüft (sandbox-sicher, gegen lokale In-Memory-Instanz, nach Demo-Seed + zwei Asks):
- `GET /health` → `{"status":"ok"}`.
- `GET /api/reasoner/status` & `/api/ai-status` → `{active:false, provider:"deterministic", mode:"deterministic"}` (KI-Modus sichtbar).
- `GET /api/model-runs?limit=5` → **3 Läufe**, je `task=answer, provider=deterministic, status=success, fallback=false, demo=true`, **ohne** `question/answer/prompt`-Felder (Datenschutz-by-design bestätigt).
- `GET /api/audit` → **24 Events**, Sequenz lückenlos verkettet (`seq` 1..n).

**Nicht geprüft (nicht möglich/aktiv):** Dashboards, Produktiv-Alerts, externes Uptime-Monitoring, zentrales Log-Management — alles Ops-seitig offen.

---

*Read-only Ops-Runbook. Kein Produktcode geändert; kein Dashboard/Alert installiert oder vorgetäuscht. Sandbox-Evidence ausschließlich Health/Status/ModelRun/Audit (§12).*
