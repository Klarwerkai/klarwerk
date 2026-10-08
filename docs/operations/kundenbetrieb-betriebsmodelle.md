# Kundenbetrieb — Betriebsmodelle aus einer Codebasis, Datenfluss, Ports, Annahmen, Punktliste

*Auftrag `aufnahme:20260922:gesamt-kundenbetrieb` · Ausgangsstand `d59159dc` (`1.0.0-beta.1.752`) ·
Quellenstand der Aufnahmepunkte: 22.09.2026*

> Dieses Dokument **gleicht den vorhandenen Stand ab** und hält für jeden zugeordneten Aufnahmepunkt
> Ergebnis oder verbleibende Entscheidung fest (§9). Es **baut nichts neu**, was schon geliefert ist,
> und erfindet keine Anforderungen. Geändert hat dieser Auftrag nur drei Dinge: die Prüfsumme am
> Inselpaket (§7), den letzten Port-Widerspruch in einem Betriebsleitfaden (§3) und dieses Dokument.
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
- **Einbettung.** `KLARWERK_EMBEDDING_PROVIDER` steht ohne Wert auf `stub`
  (`services/embedding/src/provider.ts`); `cloud`/`local` sind nicht verdrahtet. Heute verlässt dafür
  nichts das Haus.
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

### 2.4 Grenzen des lokalen Betriebs

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
| KLARWERK-App auf der Insel | **3001** (nur `127.0.0.1`) | `scripts/insel/README.md`, `docs/operations/UEBERGABE-KLARWERK-Insel.md` |
| KLARWERK-App über `scripts/local/klarwerk-lokal-starten.command` | **3001** | ebd. |
| KLARWERK-App über die Schreibtisch-App | **3010** | `desktop-app/KLARWERK App.app` — weil 3000 auf Pedis Rechner dem lokalen Gitea gehört |
| PostgreSQL | 5432, nie veröffentlicht | `docker-compose.prod.yml` |
| Lokales Modell | 11434 (Ollama) / 8080 (MLX) | `docs/operations/UEBERGABE-KLARWERK-Insel.md` |
| Office-Add-in-Entwicklungsadresse | 3000 | `KLARWERK_ADDON_ORIGIN`-Vorgabe in `env.demo.beispiel` — ein anderer Dienst |

Der Widerspruch aus R-0869 (Compose 3000, alles andere 3001) ist seit JOB 4201 in der Compose-Datei
geschlossen. Übrig war er in `docs/operations/server-hardening-readiness.md` (viermal 3000); dieser
Auftrag hat ihn dort auf 3001 gezogen. Der Wächter in
`tests/kundenbetrieb-betriebsmodelle/betriebsmodelle-am-bestand.test.ts` hält die Zahl fest.

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

---

## 7. Start, Bedienkarte, Versions- und Instanzübersicht, Auslieferungsartefakt

- **Doppelklickstart.** Vorhanden: `desktop-app/KLARWERK App.app` (Schlüsselbund, Neubau bei neuem
  Quellstand, Meldung „Gestartet: Version … Build …") und `scripts/local/klarwerk-lokal-starten.command`.
  Auf der Insel `scripts/insel/Insel-App-starten.command`. **Grenze:** Beide Entwickler-Starter lesen die
  gemeldete Version aus `apps/web/src/version.ts`, nicht aus der Antwort des laufenden Servers; und sie
  setzen einen Repository-Ordner auf Pedis Rechner voraus. Ein Kunde ohne Repository nutzt den Weg
  `install.command`/`start.command` im Inselpaket.
- **Installations- und Bedienkarte.** Installation: `docs/operations/kundeninstanz-neuinstallation.md`
  (Kundeninstanz) und `scripts/insel/README.md` (Insel). Bedienung: `docs/onboarding/user-quickstart.md`.
  Eine **kurze** Bedienkarte und eine Blaupause eigens für den Hausbetrieb (R-0843) gibt es nicht als
  eigenes Blatt; die Abnahme eines Kunden-Eigenbetriebs ist nicht belegt.
- **Versions- und Instanzübersicht.** Jede Instanz meldet an `GET /health` `version`, `commit` und
  Laufzustand (`deploy-health-commit-abgleich.md`, R-0794). Das ist die Auskunft **einer** Instanz.
  Eine Übersicht über mehrere Anlagen, ein Soll/Ist-Tor und eine Drift-Meldung (R-0781, R-0851,
  R-0861) gibt es nicht; die Ursprungsaufträge ruhen. Konkrete Zusatzanforderung, wenn mehr als eine
  Kundeninstanz läuft: eine Liste der Instanzen mit erwarteter Fassung und Kanal, die `/health` jeder
  Instanz abfragt und Abweichung sichtbar meldet.
- **Auslieferungsartefakt mit Prüfsumme.**
  - *Inselpaket:* `scripts/insel/build-current-release.mjs` leitet den Namen aus App-Version, Commit
    und Bauzeit her und schreibt **neu** neben `<version>.zip` die Datei `<version>.zip.sha256` im
    Format von `shasum -a 256`; die JSON-Ausgabe meldet `sha256` und `sha256Datei`
    (`scripts/insel/paket-pruefsumme.mjs`). Ohne Verpackung bleiben beide `null`. Prüfen beim
    Empfänger: `shasum -a 256 -c <version>.zip.sha256` im Paketordner. Grenze: belegt Unversehrtheit,
    nicht Herkunft; der Updateweg prüft die Datei nicht.
  - *Container-Abbild (R-1487):* entsteht weiterhin nur beim Bau durch Coolify beziehungsweise
    `docker compose`. Der Commit ist über `SOURCE_COMMIT` → `/health.commit` nachweisbar, eine
    Abbild-Prüfsumme wird nicht ausgewiesen. Ein automatischer Abbildbau ohne Veröffentlichung gehört
    in `.github/workflows/ci.yml`; diese Datei liegt außerhalb der für diesen Auftrag freigegebenen Pfade
    und ist **nicht geändert**.

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
| Überwachung | `GET /health` je Instanz | `monitoring-logging.md` | keine Überwachung mehrerer Anlagen (§7), kein Alarmkanal belegt |

`governance-and-teams.md` beschreibt die Arbeitsorganisation, nicht den Kundenbetrieb. Historische
Markerdateien in den Quellen sind keine realen Kundenvorgänge.

---

## 9. Punktliste — jeder zugeordnete Aufnahmepunkt

Spalten: Punkt · Stand · Ergebnis · Rest.

| Punkt | Stand | Ergebnis | Rest |
| --- | --- | --- | --- |
| R-0779 Doppelklickstart | vorhanden | Schreibtisch-App und `klarwerk-lokal-starten.command` starten ohne Terminaleingabe und melden die Version (§7) | Version aus dem Quellstand, nicht aus `/health`; Sichtung im Betrieb nicht belegt |
| R-0781 Drift mehrerer Anlagen | nicht gebaut | Auftrag ruht; je Instanz `/health.version`/`commit` vorhanden (§7) | Instanzliste mit Abgleich, sobald mehr als eine Kundeninstanz läuft |
| R-0784 Server in Deutschland mit Handbuch | vorhanden | `deploy-hetzner.md`, `kundeninstanz-neuinstallation.md` | Plattformeigenschaften UNBELEGT (§4) |
| R-0787 drei Betriebsmodelle | teilweise | Cloud und Insel gebaut, Kundeninstanz auf einem Prüfplatz gefahren; Datenfluss in §2 | Private AI in einer Kundencloud nicht belegt; Hausbetrieb nicht als Produkt |
| R-0789 ein Container | vorhanden | `Dockerfile` liefert API und Oberfläche auf 3001 mit eingebautem Healthcheck | Abnahme im Betrieb über B2 |
| R-0807 Plattformannahmen | teilweise | `OFFEN.md` I11-U3…U8 UNBELEGT, `mehrinstanz-tor.md` (§4) | Umfang „27 Stellen in 15 Dateien" nicht einzeln nachgewiesen |
| R-0809 Wiederaufbau der Insel | Skripte vorhanden | `Insel-inventarisieren.command`, `Insel-aufbauen.command` | nie auf einem echten Gerät gefahren |
| R-0821 Wartungs- und Updateprozess | beschrieben | `maintenance-update-process.md`; Inselweg ausführbar (§6.1, B4) | echte Testumgebung, geprobte Wiederherstellung, benannte Verantwortliche offen |
| R-0823 zweite Anlage durch Dritte | bestehender Auftrag B2 | — | gehört zu B2; kein zweiter Durchlauf aus diesem Auftrag |
| R-0826 Aufsetz-Handbuch | bestehender Auftrag B2 | `kundeninstanz-neuinstallation.md` | gehört zu B2 |
| R-0829 eigene Instanz für Pilotkunden | Weg vorhanden | eine Firma je Instanz (§2.3), Weg aus B2 | Installationsprotokoll beim Pilotkunden, Zugang zur Wissensquelle und Großkunden-Vorlaufvertrag nicht belegt |
| R-0843 Bedienkarte und Blaupause Hausbetrieb | nicht gebaut | Bausteine in `scripts/insel/README.md` und `user-quickstart.md` (§7) | eigenes Blatt nach Entscheidung über den Hausbetrieb als Produkt |
| R-0844 Hausbetrieb mit lokalem Modell | Referenzaufbau | lokaler Modellweg mit bestätigter Adresse (§2.2) | installierbares Produkt offen (`insel-hausbetrieb-anforderungen.md`) |
| R-0851 Instanzmanifest | nicht gebaut | Identität je Instanz über `/health` | Soll/Ist-Tor; Auftrag ruht |
| R-0852 Standard-/Premiumprofile | nicht gebaut | eine Trennungsstufe vorhanden (§5) | Profilinhalt: Entscheidung offen |
| R-0861 Versionsinventar und Kanäle | nicht gebaut | Fassung je Instanz über `/health` | Inventar und Kanal je Anlage; Auftrag ruht |
| R-0869 eindeutiger Port | erledigt | 3001 überall für die App; letzter Rest in `server-hardening-readiness.md` korrigiert (§3) | — |
| R-1270 Schreibtisch-App | historisch erledigt | `desktop-app/KLARWERK App.app` vorhanden | heutige Vollabnahme nicht belegt |
| R-1487 automatischer Bau mit Prüfsumme | teilweise | Inselpaket mit Prüfsumme (§7) | Container-Abbild: Bau im CI ohne Veröffentlichung, außerhalb der Auftragspfade |
| R-2046 Coolify-Eigenheiten kennzeichnen | erledigt im Repository | `OFFEN.md` I11-U3…U8, `mehrinstanz-tor.md` | Bestätigung durch Ops/Pedi |
| R-2053 drei Deployment-Modelle | teilweise | wie R-0787 | wie R-0787 |
| R-2061 Zusage nur für On-Premises | im Text erfüllt | §2.2; Oberfläche sagt den Satz nur bei lokaler Aufgabe | Anzeige für nicht bestätigten Endpunkt nicht geprüft |
| R-2072 CI/CD je Modell | teilweise | `ci.yml` fährt `tools/check` und Integration | Ein-Klick-Deploy je Modell und Abbildbau nicht gebaut |
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
- Eine Abbild-Prüfsumme für den Container.
- Die Liste der 15 Leitfäden aus der Recherchequelle.
