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

- **Audit-Log (fachlich):** lückenlos, **append-only Hash-Kette**; nachträgliche Abweichungen sind rechnerisch prüfbar (tamper-evident), nicht verhindert — die Kette hat keinen extern verankerten Kopf. Jede relevante Aktion. Zweck: Nachvollziehbarkeit/Integrität — **nicht** Leistungs-/Verhaltenskontrolle (Betriebsvereinbarung empfohlen, `gdpr-compliance-runbook.md`). Zugriff: Controller/Admin.
- **ModelRun-Protokoll (KI-Betrieb):** technische Metadaten je Reasoner-Lauf (Provider-Modus, Fallback, Fehler, Timing) — read-only, **ohne Inhalte**.
- **Technische/Runtime-Logs:** die App schreibt strukturierte JSON-Zeilen (Fastify/pino) auf **stdout**; Stufe über `KLARWERK_LOG_LEVEL` (Vorgabe `info`, unbekannte Werte fallen auf `info` zurück). Aufbewahrt werden sie auf der **Coolify-/Traefik-/Container-Ebene** (stdout, Proxy-Logs). → Betreiber zentralisiert diese (s. §11). Was in eine Zeile darf, regelt §4.

---

## 4. Datenschutzkonforme Logging-Regeln (by design)

- **Kein Prompt-/Request-/Antwort-Content-Logging.** Belegt: ModelRun speichert nur Metadaten + **generischen** Fehlertext („NIE Prompt-/Antwortinhalt"); kein `console.log` von Frage/Antwort im Code.
- **Keine Secrets in Logs** (G-7; `secrets-management.md`): Schlüssel/Passwörter/Tokens niemals loggen.
- **IP/Personenbezug:** App-Audit nutzt User-IDs; etwaige IP-Logs entstehen am Proxy → Betreiber-Logging-Policy + DSGVO-Löschfristen.
- **Regel für eigene Log-Erweiterungen:** nur Metadaten, keine Klartext-Inhalte/PII.
- **Fehler nur als erlaubte, strukturierte Felder** (`services/app/src/build-app.ts`, `baueLoggerOptionen`): `type`, `code`, `herkunft` (`datei:zeile:spalte`); Meldung und Stack stehen nie im Protokoll. `type`/`code` nur von `ERLAUBTE_FEHLERTYPEN`/`ERLAUBTE_FEHLERCODES`, sonst `UNBEKANNT`. Eine neue Fehlerklasse oder ein neuer Code in `services/**` macht `services/app/src/build-app.test.ts` rot, bis sie dort eingetragen ist.
- **Anfragen:** nur Methode und Pfad ohne Abfrageteil; keine Header, Adressen, Inhalte.
- **Senke für alles Übrige** (`senkeUeberWert`, `services/app/src/log-sanitize.ts`): entfernt Geheimnisformen, **E-Mail-Adressen** und **ausgewiesene Namen** (`Name: …`, `vorname=…`, `Autor: …`); Felder wie `name`, `email`, `autor`, `empfaenger` fallen in jeder Tiefe ganz weg. Klasseninstanzen, `Map`/`Set` und alles jenseits der Tiefengrenze werden durch einen festen Wert ersetzt; Fehler außerhalb von `err` erhalten dieselbe strukturierte Form wie dort. **Grenze:** Ein Name ohne Kennzeichnung im Freitext ist nicht erkennbar — davor schützt nur die Erlaubnisliste der Fehlerfelder.

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

- **Audit-Log:** bewusst **append-only und hash-verkettet** — nachträgliche Abweichungen sind rechnerisch prüfbar (tamper-evident), nicht verhindert (kein extern verankerter Kettenkopf); keine automatische Löschung (`gdpr-compliance-runbook.md`).
- **ModelRun-Protokoll:** nur Metadaten; Aufbewahrung vom Betreiber festzulegen (z. B. 90 Tage), keine Inhalte.
- **Sessions:** TTL 14 Tage; **Reset-Token:** 1 Stunde (technisch gesetzt).
- **Server-Logs der App — Frist ENTSCHIEDEN:** **14 Tage** als PoC-Standard, danach automatische Löschung am tatsächlichen Speicherort **einschließlich Diagnosekopien** (Entscheidung Peter, 12.10.2026, Nr. 2). Die 14 Tage sind ein Vorschlag, keine gesetzliche Frist. Die Protokolle sind selbst personenbezogen (DSGVO Art. 5 Abs. 1 lit. c, e); protokolliert werden nur erlaubte strukturierte Felder (§4).
- **Durchsetzung je Speicherort:**
  - **Insel (Mac Studio, Datei `$SHARED_ROOT/logs/server-<port>.log`):** technisch umgesetzt. `start.command` nennt die Datei über `KLARWERK_LOG_DATEI`; die App (`services/app/src/protokoll-frist.ts`) rotiert sie täglich ohne Neustart (Kopie + Kürzen, der Server schreibt mit Anhängen weiter) und löscht beim Start und stündlich jede andere `.log`-Datei im Ordner — Archive **und dort abgelegte Diagnosekopien** —, sobald ihre älteste Zeile 14 Tage alt ist. Das Alter kommt aus dem Inhalt (das älteste `time` aller Zeilen, als JSON gelesen), nicht nur aus dem Dateidatum. Auch beim **ersten Lauf** zählt das Inhaltsalter: ein bereits überfälliger Bestand wird sofort rotiert und im selben Lauf gelöscht. Am echten Mac-Studio-Ordner ist die Wirkung **noch nicht im Betrieb belegt**.
  - **Docker allgemein:** Docker legt die Ausgabe jedes Containers auf dem **Host** ab (`/var/lib/docker/containers/<id>/<id>-json.log`, Rotationen `….log.1` usw.) und löscht nur nach Menge, nie nach Alter. Dafür gibt es den **Docker-Hostlauf** `services/app/src/protokoll-frist-docker.ts` im App-Abbild: Er löscht Dockers eigene, abgeschlossene Rotationen (`….log.N`), sobald ihre älteste Zeile — Dockers `time` — 14 Tage alt ist, dazu ein Diagnoseordner. Die **aktive Datei** (`<id>-json.log`) fasst er **nie** an: Docker führt dafür eigene Lesepositionen, und eine von außen gekürzte Datei macht neue Zeilen für `docker logs` unlesbar (echte Docker-Probe, Nacharbeit 15; Docker rät von Fremdzugriffen auf diese Dateien ab). Dass die aktive Datei nicht über die Frist altert, leistet Dockers eigene Rotation nach Menge (`max-size`) — und damit sie **unabhängig vom Ausgabevolumen** greift, schreibt die App **einmal täglich** einen inhaltsfreien Füllblock von mindestens `max-size` Bytes (`services/app/src/protokoll-rotationsimpuls.ts`, Zeilen mit der Kennung `klarwerk-protokollrotation`). Docker rotiert die aktive Datei daraufhin selbst; sie hält höchstens einen Tag, die alte wird zur Rotation und fällt nach 14 Tagen. Voraussetzung: `KLARWERK_DOCKER_LOG_MAX_SIZE` (Dockerfile: `1m`) stimmt mit Dockers `max-size` überein. Kosten: höchstens etwa `max-size` zusätzliche Bytes am Tag. Der Impuls zählt **über Neustarts hinweg**: Der Zeitpunkt des letzten Impulses steht im Container (`/tmp/klarwerk-rotationsimpuls.zeit`), geprüft wird beim Start und stündlich. Ein Container, der öfter als täglich neu startet, impulsiert also trotzdem einmal am Tag. **Gestoppte und pausierte** App-Container schreiben keinen Impuls. Bei ihnen schwärzt der Hostlauf überfällige Zeilen der aktiven Datei **an Ort und Stelle mit gleicher Byte-Länge**: Jede Zeile ab 14 Tagen wird durch eine inhaltsfreie JSON-Zeile genau gleicher Länge ersetzt (`{"log":"\n","stream":…,"time":…}`, mit Leerzeichen aufgefüllt), eine unlesbare Zeile durch Leerzeichen. Datei, Inode, Größe und alle Byte-Positionen bleiben unverändert. Dockers anhängender Schreiber und seine Größenzählung bleiben dadurch gültig, ob der Container steht, pausiert oder genau jetzt startet. Es gibt keinen Austausch und damit keinen Zeitpunkt, an dem Docker eine Datei offen hätte, die der Pfad nicht mehr meint. Was bleibt, ist je überfälliger Zeile ein inhaltsloses Gerüst (Zeit, Strom); es verschwindet mit Dockers nächster Rotation oder dem Entfernen des Containers. Laufende Container bleiben unberührt (Impuls und Rotation).
  - **Ein-Befehl-Weg (`docker-compose.prod.yml`):** automatisch. Der Dienst `protokollpflege` führt den Hostlauf stündlich über `/var/lib/docker/containers` aus. Die Mengengrenze ist bewusst klein (50 × 1 MB), damit Docker die aktive Datei oft selbst rotiert. Voraussetzung: Linux-Host (unter Docker Desktop ist der Containerordner kein freigegebener Pfad).
  - **Coolify:** Coolify baut nur das `Dockerfile`, die Compose-Datei gilt dort nicht. **Betriebsarten getrennt (Nacharbeit 25):** Das Abbild setzt **kein** `KLARWERK_DOCKER_LOG_MAX_SIZE` und **kein** `KLARWERK_LOG_DATEI`. Der interne 1m-Rotationsimpuls der App gehört allein zum Ein-Befehl-Weg, wo `docker-compose.prod.yml` ihn passend zu `max-size: 1m` setzt. Auf dem tatsächlichen Coolify-Host (`json-file` mit 10m/3) halten ein eingerichteter **externer Host-Connector** (`klarwerk-protokollpflege-pro.timer`) und sein 10m-Impuls die Frist. Seine Schutzprüfung bricht ab, wenn die App einen eigenen Impuls oder eine Dateiprotokollierung mitbringt. Deshalb dürfen diese beiden Variablen in Coolify **nicht** gesetzt werden. Ohne einen solchen Connector rotiert Docker ohne `max-size` nie. Dann sind `--log-opt max-size=…` als „Custom Docker Options“ und ein geplanter Aufruf des Hostlaufs nötig (stündlich, z. B. systemd-Timer oder cron):
    `docker run --rm --user root -v /var/lib/docker/containers:/docker-container -v /var/log/klarwerk/diagnose:/diagnose <klarwerk-abbild> npx tsx services/app/src/protokoll-frist-docker.ts /docker-container --auswahl de.klarwerk.protokollpflege=app --diagnose /diagnose`
    Der Lauf bearbeitet **nur** Container, deren Docker-Konfiguration das Label `de.klarwerk.protokollpflege=app` trägt (setzt das `Dockerfile`). Fremde Container auf demselben Host — auch solche mit Sicherheits-/Auditprotokollen — bleiben unberührt; ohne `--auswahl` bricht der Lauf ab, ohne etwas zu bearbeiten.
    Danach läuft die Löschung automatisch.
    **Einrichtung mit Nachweis (Anwendungshost `116.203.127.201`, Root-Zugang per SSH):**
    1. *Zuordnung vorher prüfen* — derselbe Aufruf mit `--bericht` ändert nichts und gibt je Container Kennung, Name, Abbild, `ausgewaehlt` und das Alter der ältesten Protokollzeile in Tagen aus, dazu das Alter der ältesten Diagnosekopie. Erwartet: genau die Klarwerk-App-Container `ausgewaehlt: true`, alle anderen `false`.
    2. *Einrichten* — als Root-Crontab-Eintrag (`0 * * * * <Aufruf oben>`) oder als systemd-Timer mit `OnCalendar=hourly`. Coolifys „Scheduled Tasks“ eignen sich **nicht**: sie laufen im App-Container als Benutzer `node`, ohne den Containerordner des Hosts.
    3. *Wirkung belegen* — nach dem ersten Lauf erneut `--bericht`: bei keinem ausgewählten Container `rotationen.aeltesteZeileTage` ≥ 14, keine Diagnosekopie ≥ 14; die nicht ausgewählten Container unverändert. `aktiveDatei` steht getrennt: sie verwaltet Docker. Erwartet ist dort höchstens etwa 1 Tag (täglicher Rotationsimpuls). Liegt bei einem laufenden Container (`gestoppt: false`) ein Wert ≥ 14 vor, ist der Impuls nicht wirksam, meist weil `max-size` nicht zu `KLARWERK_DOCKER_LOG_MAX_SIZE` passt. Bei `gestoppt: true` oder `pausiert: true` muss der Wert nach dem Lauf unter 14 liegen; geschwärzte Gerüstzeilen zählen nicht als Inhalt. Dazu `docker logs --since 1m <container>`: neue Zeilen müssen lesbar bleiben. `aeltesteZeileTage` ist das **Inhaltsalter** (Zeitangabe der Zeilen); leere Dateien zählen nicht, und das Dateidatum einer gekürzten aktiven Datei spielt keine Rolle. Dateien ohne erkennbare Zeitangabe stehen getrennt unter `ohneZeitangabe` mit ihrem Dateialter (`ohneZeitangabeDateidatumTage`) — ihr Inhaltszeitpunkt ist unbekannt; liegt dort ein Wert ≥ 14 vor, ist die Datei von Hand zu prüfen. Ausgewertet werden **alle** Zeilen, `aeltesteZeileTage` ist das Minimum. Inhaltsreste ohne gültige Zeitangabe (unlesbare Zeilen, Zeilen ohne `time`, eine unvollständige Endzeile, die Docker womöglich gerade schreibt) stehen unter `ungeklaerteReste`, auch wenn andere Zeilen datiert sind. Als Nachweis zählt `fristBestaetigt: true`: keine Inhaltszeile 14 Tage oder älter und nichts ungeklärt.
    **Stand:** nicht eingerichtet und nicht belegt. Laut `sicherungsbestand.md` hat der Host keine Root-Crontab, und Coolify zeigt für die Anwendung keine geplanten Aufgaben. Es fehlt ein Root-/SSH-Zugang zum Anwendungshost für den Ausführenden. Das Deploy-Skript (`scripts/deploy/klarwerk-live-update.command`) hat nur einen Coolify-API-Token mit Deploy-Recht, keinen Hostzugang.
  - **Diagnosekopien:** werden **nur** in den dafür gepflegten Ordner gelegt — Insel `$SHARED_ROOT/logs/diagnose/`, Ein-Befehl-Weg `diagnose-protokolle/` neben der Compose-Datei, Coolify-Host `/var/log/klarwerk/diagnose/`. Jede Datei dort fällt automatisch nach 14 Tagen (Alter aus dem Inhalt, sonst aus dem Dateidatum). Eine Ablage an anderer Stelle (z. B. als Ticketanhang) ist **nicht vorgesehen**, weil sie keiner automatischen Löschung unterliegt.
- **Sicherheits-/Auditnachweise:** fallen **nicht** unter diese 14 Tage. Das Audit-Log (oben) erhält laut Entscheidung eine **eigene begründete Regel**; die ist noch nicht festgelegt.
- **Proxy-Logs:** Aufbewahrung = Betreiber-Logging-Policy (DSGVO-konforme Frist).

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

### P10 · getrennte Betriebsangaben am vorhandenen Weg

`KLARWERK_DIAGNOSE_FRIST_TAGE` konfiguriert die vorhandene Diagnosepflege mit positiven ganzen
Tagen; ohne Wert bleiben die entschiedenen 14 Tage erhalten. Server-Dateipflege, Docker-Hostlauf und
sein Bericht verwenden denselben reinen Parameterleser. Ungültige Werte werden vor Pflegebeginn
abgewiesen. Dies ist eine ausdrückliche technische Betreiberkonfiguration, keine neue Rechtsfrist;
E hat keine Produktionsvariable geändert. Die bestehenden Auswahlgrenzen für fremde Container und
Nachweise bleiben bestehen.

Die vorhandene geschützte VVT-Ausgabe führt vier Zwecke getrennt: Diagnose, Sicherheit, Audit und
Privatverlauf. Für die ersten drei können `KLARWERK_<ZWECK>_VERANTWORTLICH` und
`KLARWERK_<ZWECK>_BEGRUENDUNG` gesetzt werden, wobei `<ZWECK>` für `DIAGNOSE`, `SICHERHEIT` oder
`AUDIT` steht. Ohne Angabe steht die Verantwortung ehrlich als offen im Verzeichnis. Für den
Privatverlauf gilt die authentifizierte Person des bestehenden Gedächtniseintrags mit ihrer
vorhandenen Fristwahl; eine begründete befristete Ausnahme gehört ausschließlich zu dieser Zeile.
Die Konfiguration erzeugt keine zweite Policy- oder Logverwaltung.

Sicherheitsereignisse und Auditnachweise liegen weiterhin in der vorhandenen append-only Hashkette.
Eine zusätzliche Zahlenfrist dafür ist nicht beschlossen und ein allgemeiner Kettenlöschweg nicht
vorhanden. Die entsprechenden `*_FRIST_TAGE`-Werte werden ausdrücklich abgewiesen. Eine eingetragene
Begründung ist kein erfundenes fachliches Urteil und aktiviert keine Diagnosepflege auf der Kette.
Die neue Auditspur einer persönlichen Ausnahme enthält nur Kennung, Art, Fassung und Endzeitpunkt,
keine Begründung, E-Mail-Adresse oder zusätzlichen Namen. Die bestehende Kontokennung bleibt als
minimaler Akteursbeleg erhalten.
