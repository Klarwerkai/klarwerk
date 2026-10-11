# Kundenbetrieb — Betriebsmodelle aus einer Codebasis, Datenfluss, Ports, Annahmen, Punktliste

*Auftrag `aufnahme:20260922:gesamt-kundenbetrieb` · Ausgangsstand `d59159dc` (`1.0.0-beta.1.752`) ·
Quellenstand der Aufnahmepunkte: 22.09.2026*

> Dieses Dokument **gleicht den vorhandenen Stand ab** und hält für jeden zugeordneten Aufnahmepunkt
> Ergebnis oder verbleibende Entscheidung fest (§9). Es **baut nichts neu**, was schon geliefert ist,
> und erfindet keine Anforderungen. Geliefert hat dieser Auftrag: die Prüfsumme am Inselpaket, den
> Abbildbau mit Prüfsumme samt automatischem CI-Lauf, die Versionsbestätigung der Starter, die Instanzidentität an `/health`, den
> Instanzabgleich mit Kanal und Drift, Bedienkarte und Blaupause für den Hausbetrieb (alles §7), den
> Bereitstellungsweg je Modell (§7.1), den letzten Port-Widerspruch in einem Leitfaden (§3) und dieses
> Dokument.
> Was eine menschliche Entscheidung oder einen echten Betriebsnachweis braucht, steht als
> **Entscheidung offen** beziehungsweise **nicht belegt** da.

---

## 1. Abgrenzung

| Umfang | Wo er liegt | Was dieses Dokument tut |
| --- | --- | --- |
| Reale Kundeninstallation, erstes Konto, HTTPS, Neustart von App **und** Datenbank | **B2** (bestehender Auftrag; `docs/operations/kundeninstanz-neuinstallation.md`, Prüfstrecke `tests/neuinstallation/kundeninstallation-strecke.integration.test.ts`) | Verweist darauf. Bestellt **keinen** zweiten Installationsdurchlauf. |
| Sicherung und Wiederherstellung | **B3** (`scripts/backup/**`, `docs/operations/restore-drill.md`) | Nicht berührt. |
| Inselpaket bauen, einspielen, aktualisieren, Rückfall | **B4** (`scripts/insel/**`, `tests/insel-auslieferung/`) | Nicht berührt — außer der Prüfsumme am fertigen Paket (§7). |
| Offline-Material, Signierung, Lizenz, Sicherheitsupdate im Hausbetrieb | Auftrag `aufnahme:20260922:gesamt-insel-updates` (`docs/operations/insel-hausbetrieb-anforderungen.md`) | Verweist darauf. |
| Mehrere App-Instanzen gegen **eine** Datenbank | R-0824, `docs/operations/mehrinstanz-tor.md` (Freigabe **GESPERRT**) | Verweist darauf (§4). |
| Deploy-Commit, Version und Laufzustand an `/health` | `docs/operations/deploy-health-commit-abgleich.md` | Verweist darauf (§7). |
| Betriebsmodelle, Datenfluss, Ports, Plattformannahmen, Profile, Hardware, Leitfäden | **dieser Auftrag** | §2–§8 |

---

## 2. Die drei Betriebsmodelle und ihr tatsächlicher Datenfluss

Das Soll steht in `specs/reference/Technischer-Anhang.md` §5.2 (NFR-PRV-01/02): Cloud, Private AI
(abgeschottete Instanz in der Cloud des Kunden), On-Premises — **eine** Codebasis, Unterschied nur durch
Konfiguration; „keine Daten verlassen das Haus" **ausschließlich** für On-Premises.

### 2.1 Was die eine Codebasis heute tatsächlich unterscheidet

Es gibt **keinen** Schalter „Betriebsmodell". Das Modell ergibt sich aus Startweg und Umgebungswerten des
Startvertrags (`services/app/src/start-vertrag.ts`); der Code ist in allen Wegen derselbe
(`services/app/src/server.ts`, ausgeliefert über das `Dockerfile` beziehungsweise das Inselpaket).

| Modell | Startweg im Repository | Wissen liegt | KI-Aufrufe gehen an | Stand |
| --- | --- | --- | --- | --- |
| **Cloud** (KLARWERK betreibt) | `Dockerfile` über Coolify auf Hetzner (`docs/operations/deploy-hetzner.md`) | PostgreSQL auf dem Server in Deutschland | Anthropic oder OpenAI, wenn `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` gesetzt sind; ohne Schlüssel deterministischer Ersatzmodus | in Betrieb (`app.klarwerk.ai`); Messungen in `docs/operations/deploy-health-commit-abgleich.md` |
| **Eigene Instanz je Kunde** (Linux + Compose) | `docker-compose.prod.yml` (`docs/operations/kundeninstanz-neuinstallation.md`) | eigene PostgreSQL der Instanz | wie Cloud; mit `OPENAI_BASE_URL` an einen OpenAI-kompatiblen Endpunkt des Kunden umlenkbar | Weg auf **einem** leeren Prüfplatz gefahren (B2, ebd. §9.1) |
| **Private AI** (Kundencloud) | derselbe Compose-Weg in der Cloud des Kunden; Modellendpunkt über `OPENAI_BASE_URL` | Cloud-Grenze des Kunden | nur der eingetragene Endpunkt — **wenn** der Betreiber keinen anderen Schlüssel setzt | **nicht belegt**: kein Lauf in einer Kundencloud, kein Endpunkt-Nachweis |
| **On-Premises / Insel** | `scripts/insel/` (nativ, ohne Docker, nur `127.0.0.1`) | Journal bzw. PostgreSQL auf dem Rechner im Haus | lokales Modell über `KLARWERK_LOCAL_LLM_URL`/`KLARWERK_LOCAL_LLM_MODEL` (Ollama/MLX) | Referenzaufbau auf einem Rechner; Produktisierung offen (`docs/operations/insel-hausbetrieb-anforderungen.md`) |

### 2.2 Was das Haus verlassen kann — am Code nachgelesen

- **Modellaufrufe.** Cloud-Anbieter werden in `services/reasoner/src/model-client.ts`
  (`createCappedCloudClientFromEnv`) immer mit `rejectsConfidential: true` gebaut: vertrauliche Inhalte
  werden vor dem Versand abgelehnt. Ein lokaler Endpunkt gilt nur dann als lokal, wenn
  `isConfirmedLocalOrigin` ihn bestätigt — Loopback oder ausdrücklich in
  `KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS` eingetragen. Jede andere Adresse wird wie ein externer Endpunkt
  behandelt (`createCappedLocalClientFromEnv`).
- **Ausgangsprüfung.** Mit `KLARWERK_AUSGANGSPRUEFUNG=an` hält das Produkt jeden KI-Aufruf, der das Haus
  verlassen kann, bis zur Freigabe an. Vorgabe ist **aus**.
- **Einbettung.** `KLARWERK_EMBEDDING_PROVIDER` steht ohne Wert auf `stub` — lexikalische
  Testvektoren, kein Modell, kein Qualitätsbeleg (`services/embedding/src/provider.ts`). Mit `local`
  nimmt die App den **internen Embedding-Weg** (AW-12): ein Embedding-Modell
  (`KLARWERK_LOCAL_EMBEDDING_MODEL`) am selben lokalen Server wie das Sprachmodell, mit Pflichtangabe
  `KLARWERK_EMBEDDING_DIM`. Der Client (`createLocalEmbeddingClientFromEnv` in
  `services/reasoner/src/model-client.ts`) entsteht **nur** für eine bestätigte interne Adresse; jede
  andere Adresse ergibt keinen Embedder, nie still den Stub. `cloud` ist nicht verdrahtet. Gespeicherte
  Vektoren tragen ihre Art in der Version: `stub@<dim>` oder `intern:<modell>@<dim>`
  (`embeddingArt`). In keinem Fall verlässt dafür etwas das Haus. Gegenprobe:
  `tests/kundenbetrieb-betriebsmodelle/interner-embedding-weg.test.ts`.
- **Weitere Ausgänge, die der Betreiber einschaltet:** E-Mail über `SMTP_*`, Firmenanmeldung über
  `OIDC_*`, Word im Browser über `KLARWERK_M365_MANDANTEN`. Sie sind von der Modellwahl unabhängig.

**Folgerung für die Zusage „keine Daten verlassen das Haus" (NFR-PRV-02).** Sie gilt nur für den
Hausbetrieb **und** nur, wenn dort kein Cloud-Schlüssel, kein externer SMTP-/OIDC-Dienst und kein
nicht bestätigter Modellendpunkt eingetragen ist. Der Code erzwingt das nicht als Modell, sondern über
die Einzelwerte. Die Oberfläche sagt den Satz nur aufgabenbezogen, wenn eine Aufgabe über das lokale
Modell läuft (`reasoner.taskInfo.bodyLocal`, `apps/web/src/lib/reasonerTaskInfo.ts`). Ob die
Oberfläche auch für einen nicht bestätigten „lokalen" Endpunkt den Modus `local` anzeigt, ist in diesem
Auftrag **nicht geprüft**.

### 2.3 Eine Firma je Instanz

Das Produkt kennt keinen Mandanten im Wissensbestand: Wissensobjekte, Konten, Rollen und Prüfprotokoll
tragen keine Firmen- oder Mandantenspalte. Die einzige `tenant_id` im Dienstcode bindet eine
Word-Sitzung an ihren Microsoft-Mandanten (`services/reasoner/src/klara-policy-store.ts`) und trennt
keine Firmen. Deshalb gilt: **eine Firma je Instanz** — jede Firma bekommt eigene Instanz, eigene
Datenbank, eigene Adresse und eigenen ersten Administrator, wie es
`docs/operations/kundeninstanz-neuinstallation.md` beschreibt. Mehrere Firmen in einer Instanz sind
weder gebaut noch vorgesehen.

### 2.4 Datenflussblatt des internen Kerns (AW-12)

Für **eine Instanz einer Firma** (§2.3) im Hausbetrieb oder als eigene Kundeninstanz. Grundlage ist die
Zielliste der Verbindungen nach außen (`services/app/src/ausgehende-ziele.json`, gehalten von
`tests/ki-freigaberegeln/ausgehende-ziele.test.ts`). **Die Liste ist derzeit nicht vollständig:** ihr
Wächter ist rot (Fall Z1, Bericht `HISTORIE/nacharbeit-13`), weil zwei Dateien mit Verbindungsmerkmal
nicht eingetragen sind — `services/app/src/routes/office-routes.ts` (ruft die Discovery des
Office-Editors des Betreibers ab; als eigene Zeile unten aufgenommen) und
`services/app/src/transport-tls.ts` (nimmt TLS am App-Port **an**, baut selbst keine Verbindung nach
außen auf, wird vom Wächter aber als Verbindungsdatei erkannt). Beide stammen aus anderen Aufträgen;
ihre Einordnung in die Zielliste steht dort aus. Bis dahin gilt: Was dieses Blatt nennt, ist geprüft
gelistet oder ausdrücklich nachgetragen; dass es **keine weiteren** Wege gibt, ist nicht belegt.

**Interner Kern — verlässt die Instanz nicht:**

| Datenweg | Verarbeitung | Speicherung | Empfänger | Zweck | Aufbewahrung | Ausfallgrenze |
| --- | --- | --- | --- | --- | --- | --- |
| Wissensobjekte, Quellen, Anhänge | App-Prozess | PostgreSQL der Instanz (Insel: Journal `state.jsonl`) | nur Konten der Instanz nach Rolle (`services/rbac/src/policy.ts`) | Erfassen, Prüfen, Nutzen | bis zur Löschung; Papierkorb 30 Tage (`TRASH_RETENTION_DAYS`), dann Endlöschung | Datenbank nicht erreichbar → Anfragen scheitern mit Fehler; keine Ersatzspeicherung |
| KI-Aufgaben am lokalen Sprachmodell | lokaler Modellserver (`KLARWERK_LOCAL_LLM_URL`, nur bestätigte interne Adresse) | vom Produkt keine; was der Modellserver selbst protokolliert, ist seine Konfiguration; in der App nur Laufmetadaten | lokaler Modellserver | Strukturieren, Antworten, Prüfen | Laufmetadaten in `model_runs` ohne Prompt- und Antworttext (`monitoring-logging.md`) | Modell nicht erreichbar → deterministischer Ersatzmodus, sichtbar im KI-Status |
| Einbettungen (Bedeutungssuche, Dublettenvorfilter) | lokaler Modellserver, Modell `KLARWERK_LOCAL_EMBEDDING_MODEL` | Vektoren in der Instanz (`PgEmbeddingStore`), Version `intern:<modell>@<dim>` | lokaler Modellserver | Ähnlichkeit finden | mit dem Objekt; ein Modell- oder Dimensionswechsel entwertet die Vektoren | Server nicht erreichbar → `embed` wirft, kein Vektor wird gespeichert; Stub ist kein Ersatz für echte Ergebnisse |
| Protokolle | App-Prozess (`log-sanitize.ts` schwärzt Geheimnisnamen) | Ausgabe des Prozesses bzw. `logs/` der Insel | Betreiber der Instanz | Betrieb, Fehlersuche | Sache des Betreibers; im Produkt nicht begrenzt | — |
| Sicherungen | `scripts/backup/backup.sh` (`pg_dump`) bzw. Journal-Kopie beim Update | Sicherungsordner der Instanz (`BACKUP_DIR`, Insel `backups/`), je Dump eine `.sha256` | Betreiber der Instanz | Wiederherstellung | `BACKUP_KEEP=<n>` behält n Sicherungen; nicht gesetzt = nichts wird gelöscht | eine Sicherung ohne Prüfsumme wird beim Rückweg nicht angefasst |

**Inhalt von Protokoll und Sicherung.** Sicherungen enthalten den **gesamten** Datenbestand der Instanz
im Klartext des Dumps — sie sind so schutzbedürftig wie die Datenbank selbst. Protokolle enthalten keine
Prompt- und Antworttexte und keine Geheimniswerte; ein Messlauf, der Protokoll- und Sicherungsinhalt an
einer echten Instanz durchsucht, ist **nicht belegt** (§11).

**Abhängigkeiten, die nur der Betreiber einschaltet — getrennt von der Freigabe:**

Spalten „Speicherort beim Empfänger" und „Aufbewahrung beim Empfänger" hängen am Vertrag mit dem
Empfänger, nicht am Produkt; wo das Produkt sie nicht festlegt, steht **Betreiberangabe offen** — das
ist eine Lücke, die der Betreiber vor dem Einschalten schließen muss, keine Zusage. „In der Instanz"
nennt, was das Produkt selbst ablegt. „Ausfallgrenze" nennt nur, was am Code feststeht; sonst
**nicht gemessen**.

| Weg (Kennung) | Empfänger | Was hinausgeht | Speicherort / Aufbewahrung beim Empfänger | In der Instanz | Ausfallgrenze | Freigabe |
| --- | --- | --- | --- | --- | --- | --- |
| `ki-anthropic`, `ki-openai` | Anthropic, OpenAI oder `OPENAI_BASE_URL` | Aufgabentext; Vertrauliches nur mit zweiter Freigabe | Betreiberangabe offen (Anbietervertrag, Region) | Ergebnis im Objekt, Laufmetadaten in `model_runs` | Anbieter nicht erreichbar → Fehler bzw. lokaler/deterministischer Weg, sichtbar im KI-Status | zentrale Adminfreigabe; ohne Schlüssel nicht gebaut |
| `transkription-openai` (**Sprache**) | OpenAI (Whisper) | die Audio-/Videospur | Betreiberangabe offen | Transkript als Text am Objekt | Dienst nicht erreichbar → keine Transkription; Texteingabe bleibt | zentrale Adminfreigabe; ohne Schlüssel nicht gebaut |
| `wissenssuche-wikipedia` | Wikipedia | Suchbegriffe | Wikimedia; Betreiberangabe offen | angehängte Quellen am Objekt | nicht gemessen | Admin-Regler; `EXTERNAL_SEARCH=off` baut den Weg nicht |
| `import-confluence`, `import-jira`, `import-sharepoint` | System des Betreibers | Abrufanfragen mit Zugang; Inhalte kommen herein | beim Betreiber selbst | importierte Objekte wie eigene | Lauf bricht mit Meldung ab; nicht gemessen, ob Teilergebnisse bleiben | nur bei vollständiger Konfiguration, Origin gepinnt |
| `anmeldung-oidc` | Identitätsanbieter des Betreibers | Anmeldevorgang | beim Betreiber selbst | Konto und Sitzung | nicht gemessen | nur bei vollständiger OIDC-Konfiguration |
| `mail-smtp` | Postausgangsserver | Benachrichtigungen, Kennwort-Links | Betreiberangabe offen | — | nicht gemessen | nur mit `SMTP_HOST` |
| `wissensereignisse-webhooks` | eingetragene Ziele | nur Objektkennungen | Betreiberangabe offen | — | nicht gemessen | nur Ziele in `KLARWERK_WEBHOOKS` |
| Office-Editor (**nicht in der Zielliste**, `office-routes.ts`, `office-artikel.ts`) | Editor-Server des Betreibers (`KLARWERK_OFFICE_EDITOR_URL`, `…_INTERN_URL`) | Discovery-Abruf; der Editor holt das Dokument über WOPI | beim Betreiber selbst; Betreiberangabe offen | neue Fassung als Anhang am Objekt | ohne Einrichtung: „nicht eingerichtet"; sonst nicht gemessen | nur mit Editor-Umgebung |
| `word-addin-officejs` (**M365**) | Microsoft | das Laden von Office.js im Word-Fenster | Microsoft; Betreiberangabe offen | — | ohne Office.js kein Word-Fenster; Web-App unberührt | eigene Abhängigkeit; Word im Browser zusätzlich über `KLARWERK_M365_MANDANTEN` |

**Nicht intern verfügbar und deshalb eigene Abhängigkeiten:** M365 (Word-Fenster), externe Sprache,
externe Wissenssuche und die Quellsysteme der Importe. Der interne Kern (Tabelle oben) arbeitet ohne
jede davon.

**Sprache und Textweg.** Eine **interne** Spracherkennung gibt es nicht; Sprache zu Text geht nur über
den externen Weg `transkription-openai`. Ist er nicht freigegeben, bleibt die **Texteingabe** der
vollständige Weg: Erfassen, Fragen und Prüfen funktionieren ohne Sprache.

**OCR.** Eine Texterkennung aus Bildern oder gescannten PDFs ist im Produkt **nicht** vorhanden
(`poppler` im Container dient der Folienausgabe). Bilder versteht nur ein multimodales Modell über den
KI-Weg; das vorgesehene lokale Sprachmodell (§6.1) ist nicht multimodal.

**Betreiber- und Supportrechte.** Das Produkt hat keinen Fernzugang und kein eingebautes
Supportkonto. `KLARWERK_SUPPORT_URL` zeigt nur einen Link; es werden keine Daten übertragen.
Supportzugriff auf Inhalte entsteht nur, wenn der Verwalter der Firma ein Konto mit Rolle anlegt
(`viewer`, `experte`, `controller`, `admin`). Wer Server, Datenbank, Protokolle und Sicherungen
betreibt, sieht alles — im Hausbetrieb die Firma selbst, bei einer von KLARWERK betriebenen Instanz
KLARWERK. Diese Betreiberrolle ist vertraglich zu regeln; das Produkt trennt sie nicht technisch.

### 2.5 Grenzen des lokalen Betriebs

- Eine Insel ist **ein** Rechner; Wiederaufbau und Sicherung der Referenzanlage sind nicht auf einem
  echten Gerät nachgewiesen (R-0809, R-0844 in §9).
- Ein Inselpaket gilt nur für die Plattform, auf der es gebaut wurde (native Bibliotheken,
  `insel-hausbetrieb-anforderungen.md` H1).
- Ohne lokales Modell läuft die Insel im deterministischen Ersatzmodus; die Modellgüte am Zielrechner
  ist nicht gemessen.
- Die Schreibtisch-App und `scripts/local/klarwerk-lokal-starten.command` starten eine **Entwickler-**
  Instanz aus einem Repository-Ordner auf Pedis Rechner. Sie sind kein Kundenprodukt (§7).

---

## 3. Ports — eine Zahl je Dienst

| Dienst | Port | Festgelegt in |
| --- | --- | --- |
| KLARWERK-App im Container (Cloud, Kundeninstanz) | **3001** | `Dockerfile` (`ENV PORT=3001`, `EXPOSE 3001`), `services/app/src/server.ts` (Vorgabe `"3001"`), `docker-compose.prod.yml` (`PORT: 3001`, `"3001:3001"`) |
| KLARWERK-App aus dem Inselpaket (`start.command`, Einspielweg) | **3002** (Vorgabe, über `PORT` änderbar) | `scripts/insel/release-texte.mjs`, `scripts/insel/update-einspielen.sh` |
| KLARWERK-App über den Insel-Referenzstarter | **3001** | `scripts/insel/Insel-App-starten.command`, `docs/operations/UEBERGABE-KLARWERK-Insel.md` |
| KLARWERK-App über `scripts/local/klarwerk-lokal-starten.command` | **3001** | ebd. |
| KLARWERK-App über die Schreibtisch-App | **3010** | `desktop-app/KLARWERK App.app` — weil 3000 auf Pedis Rechner dem lokalen Gitea gehört |
| PostgreSQL | 5432, nie veröffentlicht | `docker-compose.prod.yml` |
| Lokales Modell | 11434 (Ollama) / 8080 (MLX) | `docs/operations/UEBERGABE-KLARWERK-Insel.md` |
| Office-Add-in-Entwicklungsadresse | 3000 | `KLARWERK_ADDON_ORIGIN`-Vorgabe in `env.demo.beispiel` — ein anderer Dienst |

Der Widerspruch aus R-0869 (Compose 3000, alles andere 3001) ist seit JOB 4201 in der Compose-Datei
geschlossen. Übrig war er in `docs/operations/server-hardening-readiness.md` (viermal 3000); dieser
Auftrag hat ihn dort auf 3001 gezogen. Der Wächter in
`tests/kundenbetrieb-betriebsmodelle/betriebsmodelle-am-bestand.test.ts` hält die Zahl fest.

**Insel: zwei Startwege, zwei Ports.** Das Inselpaket startet auf 3002, der Referenzstarter auf dem
Entwicklungs-Mac auf 3001. Für den Kunden gilt das Paket; Bedienkarte und Blaupause nennen deshalb
3002. Der Server horcht in allen Wegen auf allen Schnittstellen (`host: "0.0.0.0"` in
`services/app/src/server.ts`); „nur `127.0.0.1`" in älteren Insel-Texten meint die Aufrufadresse, nicht
eine Sperre.

---

## 4. Plattformannahmen

Die Annahmen über die Betriebsplattform Coolify stehen als benannte Einträge mit Behauptung,
Belegstatus, Restrisiko und Bestätiger in `OFFEN.md` (`I11-U3` TLS, `I11-U4` täglicher `pg_dump`,
`I11-U5` Rückweg, `I11-U6` Auto-Deploy aus, `I11-U8` Datenbanksicherung) — alle **UNBELEGT**,
Bestätiger Ops/Pedi. Die Einzelinstanz-Annahme, an der eine Produktzusage hängt (`DEPLOY-VERTRAG` in
`services/auth/src/repo-pg.ts`), führt `docs/operations/mehrinstanz-tor.md` mit acht offenen und einer
erfüllten Bedingung; die Freigabe für eine zweite Instanz ist **GESPERRT**.

**Nicht belegt:** Die Quelle von R-0807 spricht von 27 Stellen in 15 Dateien. Im Repository stehen
heute fünf `I11-U*`-Einträge und das Mehrinstanz-Tor; die übrigen Stellen und die sechs geschützten,
nicht lesbaren Stellen sind hier nicht einzeln nachgewiesen (§10).

---

## 5. Standard- und Premiumprofile für eigene Kundeninstanzen

**Heute vorhanden ist genau eine Trennungsstufe:** eigene Instanz mit eigener Datenbank, eigener
Adresse, eigenem Administrator, Datenbankport nicht veröffentlicht (§2.3, B2-Weg). Benannte Profile
*Standard* und *Premium* gibt es im Repository nicht. Der Ursprungsauftrag (JOB 706) ruht seit dem
26.08. nach einer roten Prüfung.

**Entscheidung offen.** Was ein Premiumprofil über die eigene Instanz hinaus trennt — etwa eigener
Server statt geteilter Plattform, eigene Schlüssel, eigene Modellanbindung, Region — legen die Quellen
nicht fest. Ohne diese Festlegung wird hier kein Profilinhalt erfunden.

---

## 6. Hardwarevoraussetzungen

| Weg | Was belegt ist | Was fehlt |
| --- | --- | --- |
| Kundeninstanz (Compose) | **ein** erfolgreicher Lauf auf 8 Kernen, 32 GB RAM, rund 22 GB frei unter `/var/lib/docker` (`kundeninstanz-neuinstallation.md` §1, §9.1) | eine Mindestangabe; der Leitfaden nennt ausdrücklich keine |
| Cloud (Hetzner) | Aufsetzweg in `deploy-hetzner.md`; ein Servertyp oder eine Ausstattung ist dort **nicht** genannt | Ausstattungsangabe und Lastmessung — **ungewiss** |
| Insel | Beispielmatrix für das lokale Modell (`docs/operations/local-hardware-readiness.md`) | Werte am Zielrechner, Erstinventar (`insel-hausbetrieb-anforderungen.md` H2) |
| App-Server allgemein | braucht keine GPU (`docs/operations/server-hardening-readiness.md` §6) | — |

### 6.1 Modell- und Laufzeitbestand des internen Kerns (AW-12)

Was das Repository für den internen Kern tatsächlich vorsieht, mit Fundstelle. Lizenzangaben sind die
der Herausgeber; ein Lizenztext liegt **keinem** Artefakt im Repository bei, und die Weitergabe von
Gewichten im Material ist eine offene Entscheidung (`insel-hausbetrieb-anforderungen.md` H1/H6).

| Bestandteil | Fassung im Repository | Fundstelle | Lizenz (Herausgeber) | Betriebsvoraussetzung |
| --- | --- | --- | --- | --- |
| Sprachmodell (Referenz) | `qwen3:32b` (Ollama) bzw. `mlx-community/Qwen3-32B-4bit` (MLX) | `scripts/insel/Insel-App-starten.command` | Apache-2.0 | Apple Silicon mit großem Unified Memory; Werte am Zielrechner nicht gemessen (`docs/operations/local-hardware-readiness.md`) |
| Sprachmodell (Paketvorgabe) | `mistral:latest` — **ungepinnt**, der Tag kann sich ändern | `scripts/insel/release-texte.mjs` (`start.command`) | Apache-2.0 für Mistral 7B; für einen späteren Tag-Inhalt nicht gesichert | wie oben, geringer |
| Embedding-Modell | `bge-m3` (Ollama), Dimension 1024 → `KLARWERK_EMBEDDING_DIM=1024` | `scripts/insel/Insel-inventarisieren.command` (prüft das Vorhandensein) | MIT | am selben Ollama-Server; ohne Gewicht kein interner Embedder |
| Modelllaufzeit | Ollama (`127.0.0.1:11434`) oder MLX-Server (`127.0.0.1:8080`); jeder OpenAI-kompatible Server | `scripts/insel/Insel-App-starten.command` | Ollama MIT, MLX MIT | Vorbedingung beim Kunden, nicht im Paket (H1) |
| App-Laufzeit | Node.js ≥ 20 (Insel); Container-Laufzeitstufe `node:20-bookworm-slim` (Abhängigkeitsstufe Node 24); CI Node 24 | `scripts/insel/README.md`, `Dockerfile`, `.github/workflows/ci.yml` | MIT | Insel: Homebrew-Node; Container bringt sie mit |
| Datenbank | PostgreSQL 16 (Compose) oder Journal (Insel) | `docker-compose.prod.yml`, `scripts/insel/release-texte.mjs` | PostgreSQL License | Compose bringt sie mit |
| Folienausgabe | LibreOffice Impress, poppler im Container | `Dockerfile` | MPL-2.0 bzw. GPL-2.0 | nur im Container |
| OCR | **keins** | — | — | nicht vorhanden (§2.4) |
| Spracherkennung intern | **keine** | — | — | nur extern über `transkription-openai` (§2.4) |

**Widerspruch, ausdrücklich:** Referenzstarter und Paket sehen **verschiedene** Sprachmodelle vor
(`qwen3:32b` gegen `mistral:latest`). Welches Gewicht zum **Lieferumfang** gehört, ist eine offene
Produktentscheidung; der ungepinnte Tag `mistral:latest` taugt nicht als belegte Fassung.

**Referenzkern (für Abnahme und interne Bereitstellung).** Bereitgestellt wird der interne Kern über
`scripts/deploy/compose-intern.yml`: Modellserver Ollama nur am internen Netz, App nur an ihm; die
aus der Basisdatei durchgereichten Cloud-Schlüssel (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) sind im
Profil ausdrücklich geleert, Schlüsselbund aus — wer externe KI will, nimmt dieses Profil nicht. Als
Referenzkombination gilt die des Referenzstarters, weil nur sie im Repository schon gefahren ist —
das entscheidet **nicht** den Lieferumfang:

| Rolle | Gewicht (Tag) | Lizenzbeleg beim Herausgeber | Fassungsbeleg |
| --- | --- | --- | --- |
| Sprachmodell | `qwen3:32b` | Modellkarte `huggingface.co/Qwen/Qwen3-32B` (Apache-2.0) | Digest aus `/api/tags` |
| Embedding | `bge-m3`, `KLARWERK_EMBEDDING_DIM=1024` | Modellkarte `huggingface.co/BAAI/bge-m3` (MIT) | Digest aus `/api/tags` |
| Laufzeit | Ollama, Abbild `KLARWERK_OLLAMA_IMAGE` mit fester Fassung (Pflicht, kein `latest`) | `github.com/ollama/ollama` (MIT) | `/api/version` |

Ein Tag ist keine Fassung. Die **gebundene** Fassung schreibt
`node scripts/betrieb/modellbestand-erfassen.mjs http://127.0.0.1:11434 --sprachmodell qwen3:32b
--embedding bge-m3 --dim 1024` am laufenden Server auf: Laufzeitversion, je Gewicht Digest, Größe,
Quantisierung und den Lizenztext, den das Gewicht selbst mitbringt (SHA-256 und erste Zeile), dazu eine
echte Einbettungsprobe mit Dimensionsvergleich. Fehlt ein Gewicht oder ein Lizenztext, fehlt die
Laufzeitversion oder ist sie leer bzw. keine Zeichenkette, fehlt ein Digest oder ist er kein SHA-256,
oder stimmt die Dimension nicht, endet es mit Exit 1 und dem zugeordneten Fehler. Gegenprobe ohne
echtes Modell:
`tests/kundenbetrieb-betriebsmodelle/referenzkern.test.ts`.

**Betriebsvoraussetzungen dieser Kombination:** Linux mit Docker Compose (wie B2) oder macOS mit
Ollama nativ; Plattenplatz für beide Gewichte im Ordner `KLARWERK_MODELLE_DIR`; Arbeitsspeicher
beziehungsweise Grafikspeicher für ein 32B-Modell in der vom Gewicht gemeldeten Quantisierung. Konkrete
Mindestwerte sind **nicht gemessen** — der Bestand eines echten Rechners mit Laufzeit und Speicherbelegung
ist der erste Beleg dafür (§11).

---

## 7. Start, Bedienkarte, Versions- und Instanzübersicht, Auslieferungsartefakt

- **Doppelklickstart mit bestätigter Version (R-0779).** `desktop-app/KLARWERK App.app` und
  `scripts/local/klarwerk-lokal-starten.command` starten ohne Terminaleingabe. Beide bestätigen jetzt die
  Version, die der **gestartete Server** an `/health` meldet (`scripts/local/laufende-version.mjs`), und
  vergleichen sie mit dem Quellstand (`apps/web/src/version.ts`):
  gleich → „Version … (vom Server bestätigt)"; abweichend → sichtbare Warnung mit beiden Nummern (die
  Schreibtisch-App startet einen abweichenden Altserver neu, statt „läuft bereits" zu melden); keine
  Auskunft → Warnung „nennt keine Version". Gegenprobe:
  `tests/kundenbetrieb-betriebsmodelle/laufende-version.test.ts`. **Grenze:** Beide Starter setzen einen
  Repository-Ordner auf Pedis Rechner voraus; ein Kunde nutzt `install.command`/`start.command` im
  Inselpaket, dessen Einspielweg die Version an `/health` schon selbst prüft. Eine Sichtung im
  Betrieb ist nicht belegt.
- **Installation und Bedienung.** Kundeninstanz: `docs/operations/kundeninstanz-neuinstallation.md`.
  Hausbetrieb (R-0843): **Bedienkarte** `docs/operations/hausbetrieb-bedienkarte.md` (eine Seite: öffnen,
  starten, laufende Fassung prüfen, Update, Paketprüfung, Rückfall, Sicherungen, Fehlerprotokoll) und
  **Einrichtungsblaupause** `docs/operations/hausbetrieb-einrichtung-blaupause.md` (Voraussetzungen mit
  Belegstand, Material, acht Schritte mit sichtbarem Ergebnis, Grenzen). Arbeiten mit KLARWERK:
  `docs/onboarding/user-quickstart.md`. Die Abnahme eines Kunden-Eigenbetriebs durch Dritte ist nicht
  belegt.
- **Instanzidentität, Versions-/Instanzübersicht, Kanal, Soll/Ist, Drift (R-0851, R-0861, R-0781).**
  - *Identität:* `GET /health` meldet jetzt zusätzlich `instanz` — die Adresse, unter der sich die
    Instanz selbst kennt (`APP_BASE_URL`, nur Schema/Host/Port; sonst `unbekannt`;
    `instanzAdresse()` in `services/app/src/build-app.ts`). Je Instanz verschieden, weil
    `APP_BASE_URL` Pflicht jeder Kundeninstanz ist.
  - *Inventar:* eine JSON-Datei beim Betreiber mit `kanaele` (je Kanal die erwartete `version`, optional
    `commit`) und `instanzen` (Kennung, Firma, Modell, Adresse, Kanal); Muster
    `scripts/betrieb/instanzen.beispiel.json`. Kennung und Adresse sind eindeutig (eine Firma je Instanz).
  - *Abgleich:* `node scripts/betrieb/instanzabgleich.mjs <inventar.json> [--json]` fragt jede Instanz an
    `/health` und meldet je Anlage erwartete und laufende Fassung, Kanal, Identität
    (`bestaetigt`/`abweichend`/`nicht_gemeldet`) und Ergebnis (`gleich`/`abweichend`/
    `nicht_erreichbar`/`identitaet_ungeklaert`); je Kanal, ob er **auseinandergelaufen** ist, welche
    Anlagen nicht auf Stand sind (R-0781) und bei welchen die Identität ungeklärt ist. `gleich` heißt:
    Fassung **und** Identität bestätigt. Exit 0 nur, wenn jede Anlage `gleich` ist; 1 bei Abweichung,
    keiner Auskunft oder ungeklärter Identität; 2 Inventar ungültig. Es liest nur und braucht kein
    Geheimnis.
    Gegenprobe: `tests/kundenbetrieb-betriebsmodelle/instanzabgleich.test.ts`.
  - *Grenze:* Das Inventar führt der Betreiber; welche Kanäle es gibt und welche Fassung sie erwarten,
    ist seine Festlegung, nicht die des Werkzeugs. Ein regelmäßiger Lauf mit Alarmkanal ist nicht
    eingerichtet. Instanzen vor dieser Fassung melden `instanz` noch nicht (`nicht_gemeldet`) und
    bestehen den Abgleich deshalb erst nach dem Update (`identitaet_ungeklaert`, Exit 1).
- **Auslieferungsartefakt mit Prüfsumme.**
  - *Inselpaket:* `scripts/insel/build-current-release.mjs` leitet den Namen aus App-Version, Commit
    und Bauzeit her und schreibt **neu** neben `<version>.zip` die Datei `<version>.zip.sha256` im
    Format von `shasum -a 256`; die JSON-Ausgabe meldet `sha256` und `sha256Datei`
    (`scripts/insel/paket-pruefsumme.mjs`). Ohne Verpackung bleiben beide `null`. Prüfen beim
    Empfänger: `shasum -a 256 -c <version>.zip.sha256` im Paketordner. Grenze: belegt Unversehrtheit,
    nicht Herkunft; der Updateweg prüft die Datei nicht.
  - *Container-Abbild (R-1487):* `node scripts/deploy/abbild-bauen.mjs [--ziel <ordner>]` leitet
    Commit (`git rev-parse HEAD`) und Version (`package.json` **desselben Commits**, nicht des
    Arbeitsbaums; eine abweichende Arbeitsbaumversion wird gemeldet) selbst her, baut **genau diesen Commit**
    aus `git archive` in einem Wegwerfkontext (nicht eingecheckte Änderungen gelangen nicht hinein und
    werden gemeldet), mit `SOURCE_COMMIT` (→ `/health.commit`) und den OCI-Etiketten `revision`/`version`.
    Danach schreibt er das Archiv (`docker save`), dessen `.sha256` und eine Nachweisdatei
    `klarwerk-<version>-<commit12>.json` mit Abbildname, Abbildkennung (`sha256:…`), Version, Commit und
    Prüfsumme — **ohne** `docker push`/`login`. Vorgabeziel `dist/abbild`. Eine Kundeninstanz fährt
    dieses Abbild über `scripts/deploy/compose-abbild.yml` (§7.1). Gegenprobe mit Stellvertretern für
    git/tar/docker: `tests/kundenbetrieb-betriebsmodelle/abbild-bauen.test.ts`.
    **Automatisch:** `.github/workflows/ci.yml` hat dafür den Job `abbild` (`needs: check`). Bei jedem
    Push auf `main` und jedem Pull Request baut er nach grünem Gesamttor
    `node scripts/deploy/abbild-bauen.mjs --ziel dist/abbild` und lädt `dist/abbild/` als **ein**
    Laufartefakt `klarwerk-abbild-<commit>` hoch — Archiv, `.sha256` und Nachweisdatei zusammen,
    14 Tage aufbewahrt, ohne Registry-Geheimnis, Login oder Push. Gegenprobe der Einhängung:
    `tests/kundenbetrieb-betriebsmodelle/abbild-bauen.test.ts` C7; der Workflow-Wächter
    `tests/app/job1080-ci-workflow-abgleich.test.ts` ordnet den Job als außerhalb des Tors ein.
    **Grenzen:** Ein echter `docker build` lief im Prüfzug dieses Auftrags nicht (kein Docker im
    Prüfstand); der erste Beleg ist der erste Lauf des Jobs `abbild` auf GitHub nach dem Einbau.

### 7.1 Bereitstellungsweg je Betriebsmodell (R-2072)

R-2072 verlangt „CI/CD mit automatisierten Tests; reproduzierbare Deployments je Modell. AK: Pipeline
grün, Ein-Klick-Deploy." Je Modell der eine Weg, woraus er reproduzierbar ist, und was fehlt:

| Modell | Ein Schritt | Reproduzierbar aus | Was fehlt — technisch umsetzbar oder Voraussetzung/Entscheidung |
| --- | --- | --- | --- |
| Cloud (Hetzner/Coolify) | `scripts/deploy/klarwerk-ship.command "<Text>"`: Tor → Versionszähler → Commit → Push → `klarwerk-live-update.command`; geliefert heißt `/health.commit` = Commit (R-0786) | Commit über `SOURCE_COMMIT` im Coolify-Bau des `Dockerfile` | **Externe Voraussetzung:** Coolify-Zugangsschlüssel im Schlüsselbund und Plattformzustand (`I11-U*` UNBELEGT). Kein Produktrest. |
| Eigene Kundeninstanz (Compose) | `node scripts/deploy/abbild-bauen.mjs`, dann am Ziel `shasum -c`, `docker load`, `KLARWERK_ABBILD=… docker compose -f docker-compose.prod.yml -f scripts/deploy/compose-abbild.yml up -d` | Abbild = `git archive` des Commits, mit Prüfsumme und Nachweisdatei (§7) | **Technisch offen, nicht gemessen:** der Lauf mit geladenem Abbild auf einem echten Compose-Platz (B2 prüft den Weg mit Bau am Ziel). Das Abbild selbst entsteht automatisch im CI-Job `abbild` (s. o.). |
| Private AI (Kundencloud) | derselbe Weg wie die Kundeninstanz, `OPENAI_BASE_URL` auf den Endpunkt des Kunden | wie Kundeninstanz | **Externe Voraussetzung:** Zugang zu einer Kundencloud und einem freigegebenen Modellendpunkt dort. **Entscheidung des Kunden:** welcher Endpunkt und welche Region. Ohne beides kein Nachweis. |
| Hausbetrieb (Insel) | Doppelklick `install.command` im Paket → `update-einspielen.sh` (Sicherung, Vertrag, Health mit Version, Rückfall bei Rot) | Paketname aus Version/Commit/Bauzeit, `.zip.sha256` (§7) | **Gehört zu B4:** der volle Paketlauf auf macOS. **Entscheidung offen** (H1): Node und Modell im Material oder Vorbedingung. |

**Pipeline.** `.github/workflows/ci.yml` fährt bei jedem Push auf `main` und jedem Pull Request
`./tools/check` (Bau, Lint, Architektur, Tests, Chromium-Smoke), die PostgreSQL-Integration und nach
grünem Tor den Abbildbau mit Laufartefakt. Sie veröffentlicht nicht; ausgeliefert wird je Modell über
den Weg oben.

### 7.2 AW-12 / Abnahme S07 — Zuordnung je Teil

Je Teil: was bereitsteht, welcher vorhandene Beleg wiederverwendet wird, und was **konkret** fehlt.
Jeder Lauf wird über `/health` (`commit`, `instanz`) dem Kandidaten und der Instanz zugeordnet und über
den Modellbestand (§6.1) den Gewichten.

| Teil | Bereitgestellt | Wiederverwendeter Beleg | Konkret fehlende Ressource bzw. Lauf |
| --- | --- | --- | --- |
| Getrennte Unternehmensressourcen | eine Firma je Instanz (§2.3): eigene Compose-Instanz, eigene Datenbank, eigene `APP_BASE_URL`; Identität an `/health`, Abgleich `scripts/betrieb/instanzabgleich.mjs` | B2-Prüfstrecke `tests/neuinstallation/kundeninstallation-strecke.integration.test.ts` (eine Instanz auf leerem Linux-Platz); Mehrinstanz-Sperre `docs/operations/mehrinstanz-tor.md` | Ein Lauf mit **zwei** Instanzen zweier Firmen auf demselben Platz: getrennte Volumes und Netze, Konto der einen Firma sieht in der anderen nichts. Ressource: der B2-Linux-Prüfplatz, zweimal `docker compose -p <firma>` |
| Interne Modelle | `scripts/deploy/compose-intern.yml` (Ollama nur am internen Netz), Bestand `scripts/betrieb/modellbestand-erfassen.mjs` | Referenzstarter mit `qwen3:32b` auf dem Mac Studio (`docs/operations/UEBERGABE-KLARWERK-Insel.md`), kein Bestand mit Digest | Ein Rechner mit den Gewichten `qwen3:32b` und `bge-m3` im Modellordner und genug Speicher für ein 32B-Modell; dort ein Bestand mit Exit 0 |
| Synthetischer Kernweg | App mit lokalem Sprachmodell und internem Embedding-Weg (`KLARWERK_EMBEDDING_PROVIDER=local`, Dublettenvorauswahl an) | Gegenproben ohne Modell: `interner-embedding-weg.test.ts`, `referenzkern.test.ts` | Auf demselben Rechner: Objekt anlegen, Frage stellen, Dublettenvorschlag erhalten; `/api/ai-status` meldet `local`, gespeicherte Vektoren tragen `intern:bge-m3@1024` |
| Ausgehende Verbindungen | Zielliste `services/app/src/ausgehende-ziele.json` mit Freigabe je Weg; Egress-Wächter; Modellserver ohne Netz nach außen | `tests/security/egress-chokepoint.test.ts`, `tests/ki-freigaberegeln/ausgehende-ziele.test.ts` (Z1 derzeit rot, §2.4) | Mitschnitt der tatsächlich aufgebauten Verbindungen während des Kernwegs am Host (z. B. Firewall-Protokoll oder `ss`/`conntrack`); erwartet: nur Datenbank und Modellserver |
| Protokoll- und Sicherungsinhalt | `log-sanitize.ts`; `scripts/backup/backup.sh` mit Prüfsumme | B3-Rückweg `docs/operations/restore-drill.md`; `monitoring-logging.md` (keine Prompt-/Antworttexte) | Nach dem Kernweg: Protokoll auf eingegebene Texte und Geheimnisse durchsuchen; Sicherung erstellen und belegen, dass sie den gesamten Bestand enthält und nur am Sicherungsort liegt |

**Ausführbarer Anschluss:** `tests/kundenbetrieb-betriebsmodelle/s07-kernweg.integration.test.ts`
fährt S07 auf dem Prüfplatz der regulären Integrationsprüfung (Docker, PostgreSQL): Ollama-Container
mit fester Fassung (Vorgabe `ollama/ollama:0.32.3`, überschreibbar mit `KLARWERK_S07_OLLAMA_IMAGE`),
Laden der Referenzgewichte `qwen3:32b` und `bge-m3` (oder vorbefüllter Ordner
`KLARWERK_S07_MODELLE_DIR`), Modellbestand (S1), zwei Firmeninstanzen mit eigenen Datenbanken (S2),
Kernweg mit lokalem Sprach- und Embedding-Modell (S3), Mitschnitt jedes TCP-Aufbaus beider
App-Prozesse (`verbindungsmitschnitt.mjs`, S4), Protokolldurchsicht (S5) und Sicherung mit Prüfsumme
und Inhaltsprobe (S6). Das Ergebnis mit Kandidat (`/health.commit`), Rechnername, Rollen und
Kennungen steht in `.local/run/s07/<zeit>/S07-ERGEBNIS.json` und auf stdout. Fehlt eine
Voraussetzung (`KLARWERK_PG_TEST_URL`, `docker`, `pg_dump`/`pg_restore`, Netz zum Laden der
Gewichte), ist der Lauf rot (Zeugenfall Z0), nicht übersprungen. **Modellserver:** Er lädt die
Gewichte einmalig über das Netz; danach wird er in ein `--internal`-Netz verlegt und vom
Standardnetz getrennt, die App erreicht ihn nur über seine Adresse dort (als interne Herkunft
freigegeben). Fall S7 misst die Sperre im Container — TCP nach außen und Namensauflösung müssen
scheitern, und ein Registry-Abruf darf kein Gewicht hinterlassen (gemessen wird die Wirkung über
`ollama list`; der Exitcode von `ollama pull` war am Prüfplatz auch im gesperrten Netz 0) — und hält
Container-ID, Netze und Kandidat in `NETZSPERRE.json` fest. **Grenze des App-Mitschnitts:** Namensauflösung der App-Prozesse ist nicht darin; die App
bekommt keinen Cloud-Schlüssel.

---

## 8. Betriebs- und Governance-Leitfäden — Lücken dem Produkt zugeordnet

Die Leitfäden liegen unter `docs/operations/`. Die in der Quelle genannte Liste der 15 Leitfäden
(`recherche/sichtung/TEAM3-BETRIEBSWISSEN.md`) liegt nicht im Repository; zugeordnet sind hier die fünf
dort genannten Lückenbereiche.

| Bereich | Im Produkt | Leitfaden | Lücke |
| --- | --- | --- | --- |
| Lizenzdurchsetzung | nichts — keine Lizenzdatei, keine Aktivierung | `insel-hausbetrieb-anforderungen.md` H6 | Entscheidung offen (ebd.) |
| Support | Supportkontakt der Installation (`services/app/src/routes/support-routes.ts`) | — | kein Supportprozess mit Reaktionszeiten beschrieben |
| Aufbewahrung | Papierkorb-Endlöschung (`startTrashSweepScheduler` in `services/app/src/server.ts`) | `docs/entscheidungen/loeschung-aufbewahrung.md`, `backup-disaster-recovery.md` | Aufbewahrung alter Inselreleases und Sicherungen offen (`insel-hausbetrieb-anforderungen.md` H2) |
| Rechte | Rollen und Rechte (`services/rbac/src/policy.ts`) | `api-auth-readiness.md` | Abbildung von Gruppen der Firmenanmeldung auf Rollen gehört zu R-0823 (B2) |
| Überwachung | `GET /health` je Instanz; Instanzabgleich über alle Anlagen (`scripts/betrieb/instanzabgleich.mjs`, §7) | `monitoring-logging.md` | Abgleich läuft auf Aufruf; regelmäßiger Lauf und Alarmkanal nicht eingerichtet |

`governance-and-teams.md` beschreibt die Arbeitsorganisation, nicht den Kundenbetrieb. Historische
Markerdateien in den Quellen sind keine realen Kundenvorgänge.

---

## 9. Punktliste — jeder zugeordnete Aufnahmepunkt

Spalten: Punkt · Stand · Ergebnis · Rest.

| Punkt | Stand | Ergebnis | Rest |
| --- | --- | --- | --- |
| R-0779 Doppelklickstart | geliefert | Schreibtisch-App und `klarwerk-lokal-starten.command` starten ohne Terminaleingabe und bestätigen die Version des laufenden Servers an `/health`; Abweichung wird gewarnt bzw. neu gestartet (§7) | Sichtung im Betrieb auf Pedis Rechner nicht belegt |
| R-0781 Drift mehrerer Anlagen | geliefert | Instanzabgleich meldet je Kanal „auseinandergelaufen" und die Anlagen, die nicht auf Stand sind (§7) | regelmäßiger Lauf und Alarmkanal nicht eingerichtet; Inventar führt der Betreiber |
| R-0784 Server in Deutschland mit Handbuch | vorhanden | `deploy-hetzner.md`, `kundeninstanz-neuinstallation.md` | Plattformeigenschaften UNBELEGT (§4) |
| R-0787 drei Betriebsmodelle | teilweise | Cloud und Insel gebaut, Kundeninstanz auf einem Prüfplatz gefahren; Datenfluss in §2 | Private AI in einer Kundencloud nicht belegt; Hausbetrieb nicht als Produkt |
| R-0789 ein Container | vorhanden | `Dockerfile` liefert API und Oberfläche auf 3001 mit eingebautem Healthcheck | Abnahme im Betrieb über B2 |
| R-0807 Plattformannahmen | teilweise | `OFFEN.md` I11-U3…U8 UNBELEGT, `mehrinstanz-tor.md` (§4) | Umfang „27 Stellen in 15 Dateien" nicht einzeln nachgewiesen |
| R-0809 Wiederaufbau der Insel | Skripte vorhanden | `Insel-inventarisieren.command`, `Insel-aufbauen.command` | nie auf einem echten Gerät gefahren |
| R-0821 Wartungs- und Updateprozess | beschrieben | `maintenance-update-process.md`; Inselweg ausführbar (§6.1, B4) | echte Testumgebung, geprobte Wiederherstellung, benannte Verantwortliche offen |
| R-0823 zweite Anlage durch Dritte | bestehender Auftrag B2 | — | gehört zu B2; kein zweiter Durchlauf aus diesem Auftrag |
| R-0826 Aufsetz-Handbuch | bestehender Auftrag B2 | `kundeninstanz-neuinstallation.md` | gehört zu B2 |
| R-0829 eigene Instanz für Pilotkunden | Weg vorhanden | eine Firma je Instanz (§2.3), Weg aus B2 | Installationsprotokoll beim Pilotkunden, Zugang zur Wissensquelle und Großkunden-Vorlaufvertrag nicht belegt |
| R-0843 Bedienkarte und Blaupause Hausbetrieb | geliefert | `hausbetrieb-bedienkarte.md` und `hausbetrieb-einrichtung-blaupause.md` aus den vorhandenen Bausteinen, mit Voraussetzungen und Grenzen (§7) | Aufsetzen durch einen Kunden ohne Beistand nicht belegt; Node/Modell im Material: Entscheidung offen (H1) |
| R-0844 Hausbetrieb mit lokalem Modell | Referenzaufbau | lokaler Modellweg mit bestätigter Adresse (§2.2) | installierbares Produkt offen (`insel-hausbetrieb-anforderungen.md`) |
| R-0851 Instanzmanifest | geliefert | `/health` meldet `version`, `commit` und `instanz`; der Instanzabgleich gleicht Soll und Ist samt Identität ab; ungeklärte Identität besteht nicht (§7) | Identität erst ab dieser Fassung gemeldet, ältere Anlagen bleiben bis zum Update `identitaet_ungeklaert`; ohne gesetzten Kanal-Commit wird nur die Version verglichen |
| R-0852 Standard-/Premiumprofile | nicht gebaut | eine Trennungsstufe vorhanden (§5) | Profilinhalt: Entscheidung offen |
| R-0861 Versionsinventar und Kanäle | geliefert | Inventar mit Kanälen und erwarteter Fassung, Abgleich zeigt je Anlage Kanal, erwartete und laufende Fassung (§7) | Kanäle und ihre Sollfassung legt der Betreiber fest |
| R-0869 eindeutiger Port | erledigt | 3001 für Container, Server, Compose und Leitfäden; letzter Rest in `server-hardening-readiness.md` korrigiert; Inselpaket 3002 ausdrücklich benannt (§3) | — |
| R-1270 Schreibtisch-App | historisch erledigt | `desktop-app/KLARWERK App.app` vorhanden | heutige Vollabnahme nicht belegt |
| R-1487 automatischer Bau mit Prüfsumme | geliefert | Inselpaket mit Prüfsumme; Container-Abbild aus dem Commit mit Abbildkennung, Prüfsumme und Nachweisdatei, ohne Veröffentlichung (`abbild-bauen.mjs`), automatisch im CI-Job `abbild` nach grünem Tor als ein Laufartefakt (§7) | echter `docker build` noch nicht belegt; erster Beleg ist der erste CI-Lauf des Jobs |
| R-2046 Coolify-Eigenheiten kennzeichnen | erledigt im Repository | `OFFEN.md` I11-U3…U8, `mehrinstanz-tor.md` | Bestätigung durch Ops/Pedi |
| R-2053 drei Deployment-Modelle | teilweise | wie R-0787 | wie R-0787 |
| R-2061 Zusage nur für On-Premises | im Text erfüllt | §2.2; Oberfläche sagt den Satz nur bei lokaler Aufgabe | Anzeige für nicht bestätigten Endpunkt nicht geprüft |
| R-2072 CI/CD je Modell | Weg je Modell benannt | Pipeline `ci.yml` (Tor und Integration); je Modell ein Schritt: Ship-Befehl (Cloud), Abbild + `compose-abbild.yml` (Kundeninstanz, Private AI), `install.command` (Insel) (§7.1) | Private AI: Kundencloud-Zugang und Endpunktwahl des Kunden; Kundeninstanz mit geladenem Abbild nicht gemessen |
| JOB-4366 Kundeninstanz mit Neustart über HTTPS | bestehender Auftrag B2 | Prüfstrecke vorhanden | gehört zu B2 |
| P-B2-NEUINSTALLATION-DURCHGAENGIG | bestehender Auftrag B2 | — | gehört zu B2 |
| TEST-A14 Neuinstallation und persistente Daten | über B2 | Prüfstrecke `tests/neuinstallation/kundeninstallation-strecke.integration.test.ts` | Beurteilung gehört zu B2 |
| priority:B2-NEUINSTALLATION-DURCHGAENGIG:7a59b5a35905 | bestehender Auftrag B2 | — | gehört zu B2 |
| package:betrieb | teilweise | Sicherung/Wiederherstellung in B3, Update/Rückfall in B4 | Unterbrechungs- und Duplikatfälle gehören zu den dort genannten Aufträgen |
| SOLL:NFR-PRV-01 transparenter Datenfluss | erfüllt im Dokument | §2 | Verhalten je Modell nur für Cloud und Insel belegt |
| RECHERCHE:team3-fuehrung Leitfäden | zugeordnet | §8 | Liste der 15 Leitfäden liegt nicht im Repository |

---

## 10. Quellenwidersprüche

1. **Port.** Die Quelle (26.08.) nennt 3000 in der Compose-Datei; seit JOB 4201 steht dort 3001. Der
   Rest in `server-hardening-readiness.md` ist in diesem Auftrag korrigiert.
2. **R-0789 und R-0821 als ERLEDIGT.** Die Ursprungsquelle führt beide als erledigt; der Betriebsnachweis
   beziehungsweise drei Voraussetzungen fehlen (§9).
3. **R-0807.** „27 Stellen in 15 Dateien" gegenüber fünf `I11-U*`-Einträgen im Repository (§4).
4. **Drei Modelle.** Der Technische Anhang verlangt drei Modelle als Muss; die Landkarte v3 stellt den
   Hausbetrieb auf Stufe 3 und das Kundencloud-Modell ist nicht umgesetzt.
5. **Schreibtisch-App.** R-1270 gilt historisch als erledigt; R-0779 nennt die Sichtung im Betrieb als
   nicht belegt.

## 11. Fehlende Belege

- Ein Lauf des Modells *Private AI* in einer Kundencloud.
- Eine Bestätigung der Plattformannahmen `I11-U3`…`U8` durch Ops/Pedi.
- Ein Erstinventar und ein Wiederaufbau der Insel auf einem echten Gerät.
- Ein Bau des Inselpakets mit der neuen Prüfsumme auf einem Rechner mit `zip` — die Prüfsumme ist hier
  am Baustein geprüft, nicht an einem vollen Paketlauf.
- Ein echter Lauf von `scripts/deploy/abbild-bauen.mjs` mit Docker und eine Kundeninstanz, die das
  geladene Abbild über `scripts/deploy/compose-abbild.yml` fährt — geprüft sind Herleitung, Argumente,
  Prüfsumme und Nachweis mit Stellvertretern, nicht der Containerbau selbst.
- Ein grüner Lauf des CI-Jobs `abbild` mit hochgeladenem Laufartefakt (eingebaut, noch nicht gelaufen).
- Eine Sichtung der Starter mit Versionsbestätigung auf Pedis Rechner.
- Eine Einrichtung nach Blaupause durch einen Kunden ohne Beistand.
- Die Liste der 15 Leitfäden aus der Recherchequelle.
- **AW-12, Abnahme S07:** je Teil konkret in §7.2 — fehlend sind die Läufe auf einem Rechner mit
  Modellgewichten (zwei Firmeninstanzen, Kernweg, Verbindungsmitschnitt, Protokoll- und
  Sicherungsdurchsicht). Bereitgestellt sind Referenzkern, Bestandswerkzeug und Gegenproben ohne Modell.
- Ein Modellbestand mit Digest und mitgebrachtem Lizenztext von einem echten Rechner (Werkzeug liegt
  bereit, §6.1) und die Entscheidung, welches Sprachmodell zum Lieferumfang gehört.
- Die Einordnung von `office-routes.ts` und `transport-tls.ts` in die Zielliste (Aufträge, die sie
  eingeführt haben; §2.4).
- Eine interne Spracherkennung und eine OCR — beide im Produkt nicht vorhanden (§2.4).
