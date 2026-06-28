# Klarwerk — Skalierung & Kostenkontrolle: Readiness-Runbook

> Ehrliche Bestandsaufnahme, was Klarwerk heute **real** über Last, Laufzeit-/Modellkosten,
> Skalierung und Alerts weiß — und was für **produktives** Scaling/Cost-Control noch fehlt.
> **Keine Cloud-Provisionierung, keine GPU, keine Auto-Scaling-/Budget-Alerts eingerichtet,
> kein Lasttest gegen fremde/produktive Systeme.** Verwandt: `monitoring-logging.md`,
> `maintenance-update-process.md`, `integration-workflows.md`, `backup-disaster-recovery.md`,
> `secrets-management.md`, `deploy-hetzner.md`.

---

## 1. Heutiger Runtime-/Deploy-Zustand

- **Topologie:** **Ein** App-Container + **ein** Postgres (`docker-compose.prod.yml`), `restart: unless-stopped`, betrieben über **Coolify** auf **Hetzner** (`deploy-hetzner.md`). **Single-Instance**, kein Cluster.
- **Keine Replikas, kein Load-Balancer, keine Auto-Scaling-Definition, keine Ressourcen-Limits** (`cpus`/`mem_limit`) in der Compose-Datei.
- **Kein Idle-Shutdown / Scale-to-Zero.**
- **Kein GPU:** der Reasoner ist **anbieteragnostisch** — entweder externer Modell-Provider (API) oder **deterministischer Fallback** (kein Modell). Es läuft **kein self-hosted Modell** → **keine GPU-Kosten in der App**. Modellkosten entstehen, wenn überhaupt, **extern** beim Provider.

---

## 2. Verfügbare Messsignale (real)

| Signal | Endpoint / Quelle | Aussage |
| --- | --- | --- |
| **Liveness** | `GET /health` → `{"status":"ok"}` | App erreichbar |
| **KI-Status/Modus** | `GET /api/reasoner/status`, `/api/ai-status` | `active`, `provider`, `mode` (z. B. `deterministic`) |
| **Modell-Läufe** | `GET /api/model-runs` → `ModelRunRecord` | **`provider, demo, fallback, status, startedAt, finishedAt, model?, locale, task`** |
| **Fachmetriken** | `/api/management/snapshot`, `/api/analytics/impact` | KOs/Gaps/Conflicts/Impact (Business, nicht Infra) |

**Ableitbar aus `model-runs`:** **Latenz** (`finishedAt − startedAt`), **Fallback-Rate**, **Fehlerquote** (`status=error`), **Provider-Mix** (echtes Modell vs. deterministisch). → ein einfaches **Last-/Qualitäts-Monitoring** ist ohne Zusatzbau möglich.

> **Sandbox-Smoke (real ausgeführt, In-Memory + Seed):** `/health`=`ok`; `reasoner/status`=`{active:false,provider:"deterministic",mode:"deterministic"}`; 3× `POST /api/ask` → `http=200`; `/api/model-runs` → 4 Records, Keys `id,task,provider,demo,fallback,locale,startedAt,finishedAt,status`, Latenz ableitbar, `provider=deterministic`, `fallback=false`, `status=success`. **Kein** Lasttest, **keine** fremde Infrastruktur.

---

## 3. Fehlende Kosten-/Token-Erfassung (ehrlich benannt)

- **`ModelRunRecord` enthält KEINE Tokens, KEINE Kosten, KEINE Usage** (Keys s. §2). Eine **produktinterne Kostenmessung pro Anfrage existiert nicht.**
- Token-/Kosten-Transparenz gibt es heute nur **extern** in der Provider-/Abrechnungskonsole — **nicht** in Klarwerk korreliert.
- → **Cost-Control ist heute eine Betreiberpflicht außerhalb des Produkts**, nicht eine im Produkt aktive Funktion.

---

## 4. Rate-Limit / Quota — **nicht vorhanden**

- **Kein** Rate-Limit, **keine** Quota, **kein** Concurrency-Throttle im Produkt (bestätigt auch `integration-workflows.md` §2/§8: „kein Rate-Limit/Quota").
- **Risiko:** ungebremste/automatisierte Nutzung kann Last und (im Modellmodus) Kosten unkontrolliert treiben.
- **Konzept für später:** per-User/-Token Rate-Limit (z. B. Fastify-Rate-Limit-Plugin), getrennte Limits für `/api/ask` (modellkostenrelevant) vs. Lese-Endpoints; 429 + Retry-After; Service-Konto-Quoten für Integrationen.

---

## 5. Auto-Scaling / Idle-Shutdown — **nicht vorhanden**

- Heute **eine** feste Instanz (Coolify). Optionen für später (Betreiber-/Produktentscheidung):
  - **Vertikal:** größerer Server (einfachster erster Schritt; Klarwerk ist ein modularer Monolith → vertikal gut skalierbar).
  - **Horizontal:** mehrere App-Instanzen hinter Load-Balancer — Voraussetzung: **zustandslose** App (Session-Token prüfen), Postgres als gemeinsamer Zustand, ggf. Connection-Pooling/PgBouncer.
  - **Idle/Scale-to-Zero:** nur sinnvoll bei seltener Nutzung; Coolify/Provider-abhängig, Kaltstart-Latenz beachten.
  - **DB-Skalierung:** Connection-Limits, Pooling, Read-Replica erst bei Bedarf.

---

## 6. Kosten-Alerts / Budget-Limits — **Betreiberpflicht (nicht im Produkt)**

Da Modellkosten **extern** entstehen und intern nicht erfasst werden, sind Budget-Kontrollen **beim Betreiber** zu setzen:
- **Provider-Budget-Alerts** (Modell-/API-Konto): monatliches Limit + Schwellen-Alerts.
- **Hosting-Budget** (Hetzner/Coolify): Server-/Volume-Kosten beobachten.
- **Intern ergänzend** (optionales P2): Fallback-/Fehler-/Volumen-Trends aus `/api/model-runs` als Frühindikator (viele Modell-Läufe = potenziell steigende Kosten).

> **Wichtig:** Diese Alerts sind **heute nicht eingerichtet** und in diesem Item **bewusst nicht** provisioniert worden.

---

## 7. Lasttest-Strategie für später (Konzept, NICHT ausgeführt)

- **Nur gegen eine dedizierte Staging-Instanz**, nie gegen Produktion/fremde Systeme.
- Werkzeug z. B. `k6`/`autocannon`; Szenarien: Lese-Last (`/api/kos`, `/health`), Ask-Last (`/api/ask`, **deterministischer** Modus → keine Modellkosten), Misch-Last.
- Messen: Durchsatz (req/s), p95/p99-Latenz, Fehlerquote, DB-Verbindungen; aus `/api/model-runs` Fallback/Fehler korrelieren.
- Ergebnis → Kapazitätsgrenze je Instanzgröße → Schwellen für vertikale/horizontale Skalierung.

---

## 8. Runbook für spätere Aktivierung (Reihenfolge)

1. **Rate-Limit** pro Token/Route einführen (begrenzt Last **und** Modellkosten) — kleinster wirksamster Schritt.
2. **Token-/Kosten-Felder** in `ModelRunRecord` ergänzen (sofern Provider Usage liefert) → interne Kostentransparenz.
3. **Provider-Budget-Alerts** + Hosting-Budget setzen (Betreiber).
4. **Staging-Lasttest** (§7) → Kapazitätsgrenzen dokumentieren.
5. **Skalierungsentscheidung** (vertikal zuerst; horizontal nur bei Bedarf, Zustandslosigkeit sichern).
6. **Monitoring/Alerts** an Latenz/Fehler/Fallback koppeln (`monitoring-logging.md`).

---

## 9. Nicht-Ziele

- Keine Cloud-/GPU-Provisionierung, keine Auto-Scaling-/Budget-Alerts in Providern eingerichtet.
- Kein Lasttest gegen fremde/produktive Systeme; kein RAG/Vector/ModelAdapter/Conductor.
- Kein Produktcode geändert; reine **Readiness-Dokumentation**.

---

## 10. Empfehlung

**PARTIAL.** Klarwerk liefert **reale Runtime-/Health-/ModelRun-Signale** (Liveness, KI-Status, Latenz/Fallback/Fehler aus `/api/model-runs`), und der modulare Monolith ist grundsätzlich gut skalierbar. **Aber:** es gibt **keine produktinterne Token-/Kostenerfassung**, **kein Rate-Limit/Quota**, **kein Auto-Scaling/Idle-Shutdown**, **keine aktiven Kosten-/Budget-Alerts** und **keinen** durchgeführten Lasttest. Das Kriterium „Skalierung & Kostenkontrolle **eingerichtet**" ist daher **nicht** erfüllt → **Partial**; die fehlenden Stücke sind teils Produkt- (Rate-Limit/Usage-Felder), teils Betreiber-/Ops-Aufgaben (Budget-Alerts, Scaling-Entscheidung), die bewusst nicht in diesem Item provisioniert wurden.

---

*Read-only Readiness-Runbook. Kein Produktcode geändert; keine Infrastruktur/GPU/Alerts provisioniert; Evidence nur aus vorhandenen Endpoints + lokalem In-Memory-Smoke (§2).*
