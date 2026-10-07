# Office im Artikel — Integrationsweg

*Auftrag `produkt:20261007:office-machbarkeit` (Revision 2) · Basis `863a0974` · Stand 07.10.2026*

**Ergebnis in einem Satz:** Direkt im Artikel eingebettete Bearbeitung von Word, Excel und
PowerPoint ist für Klarwerk heute nur über einen **selbst betriebenen WOPI-Editor (Collabora
Online)** erreichbar. Microsoft 365 für das Web als eingebetteter Editor verlangt eine
**CSPP-Zulassung durch Microsoft**, die nicht vorliegt. Klarwerk baut den WOPI-Hostteil
deshalb protokollgleich, damit Microsoft später ohne Umbau angeschlossen werden kann.

**Was dieser Auftrag liefert und was nicht:**

- Geliefert werden dieser Plan und eine **Teilprobe** in drei Teilen:
  - `services/app/src/office-wopi.ts` ist der Entscheidungskern des Hosts für Formate, Schreibweg,
    Zugangsmarke, Sperren, Speichern und Sitzungsbasis. Geprüft wird er durch
    `services/app/src/office-wopi.test.ts`.
  - `services/app/src/office-wopi-host.ts` ist seit Nacharbeit 1 der **WOPI-Hostweg**: CheckFileInfo,
    GetFile, PutFile, die Sperrvorgänge und die Übernahme als eine rahmenunabhängige Funktion. Geprüft
    wird er über HTTP durch `tests/office-wopi-code/hostweg.test.ts`.
  - `tests/office-wopi-code/code-probe.integration.test.ts` ist die **Integrationsprobe mit einem echten
    Collabora-Editor** (CODE-Container, Chromium). Sie umfasst nur `.docx`: Öffnen, Ändern,
    Speichern, zwei Übernahmen und Wiederöffnen (Abschnitt 7.3).
- **Office im Artikel ist damit nicht geliefert.** Der Hostweg ist nicht in die App-Routen
  verdrahtet, und auf der Artikelseite gibt es kein Editor-iframe. Die Probe läuft mit einer
  Artikel-Attrappe statt dem Wissensobjektdienst. Das gilt auch dann, wenn das Word-Add-in oder ein
  Download funktioniert; beides ersetzt den eingebetteten Editor nicht.

Die Aufträge `aufnahme:20260922:word-echter-arbeitsweg` (Word-Host und Add-in) und
`aufnahme:20260922:wiki-gesamtweg` sind eigenständig. Dieser Auftrag hat dort nichts geändert.

---

## 1 · Bestand und tatsächlich nutzbare Rechte (K1)

### 1.1 Was im Code vorhanden ist

| Teil | Stand im Code | Bedeutung für Office im Artikel |
|---|---|---|
| Klara als Word-Add-in | `apps/web/public/word-addin/`, Manifest `docs/word-addin/klara-manifest.xml`, Einbettungsregel `services/app/src/office-host.ts` | Hier läuft Klara **in** Word, nicht Word **in** Klarwerk. Es ist kein Editor im Artikel. Der Weg ist ein eigener Auftrag. |
| Microsoft-Graph-Anbindung | `services/sharepoint/src/graph-client.ts` | Sie liest nur Liste, Merkmale und `text/plain` bis 256 KiB. Der Zugang ist ein Bearer-Merkmal aus der Betreiberumgebung. Sie kann weder schreiben noch bearbeiten noch einbetten. |
| Microsoft-Anmeldung im Add-in | `docs/word-addin/ABNAHME-M365.md`, Abschnitt 1 | Es gibt kein `WebApplicationInfo`, kein Office-SSO, keine Graph-Rechte und **keine Entra-App-Registrierung**. Angemeldet wird mit dem Klarwerk-Konto. |
| Objektspeicher | `services/object-store` (Postgres-Repo vorhanden) | Ein gespeicherter Inhalt ist je Kennung unveränderlich. Die Grenze liegt bei 30 MB Daten-URL, also rund 22 MB Datei. |
| Artikel = Wissensobjekt | `services/knowledge-object` | `attachments[]` mit `objectId`. `updateAttachment` tauscht den Inhalt eines Anhangs ohne neue Fassung und legt einen Beleg an. `revise` erhöht die Fassung, setzt den Status auf `offen`, den Trust auf 0 und legt einen Snapshot an. Fassungen liest `GET /api/kos/:id/versions`, zurückgeholt wird mit `restoredFromVersion`. |
| Schreibregeln | `services/app/src/routes/ko-routes.ts` | Bedingter Schreibzugriff über `expectedVersion`. Bei Konflikt kommt `409 KO_STALE`. Ein freigegebener Artikel ohne `users.manage` führt zu `PROPOSAL_REQUIRED` und damit zu `propose`. `revise-release` darf nur `admin`. |
| Bearbeitungshinweis | `services/app/src/routes/bearbeitung-routes.ts` | Er zeigt, wer gerade bearbeitet. Er erlaubt und verbietet nichts. |
| Rechte | `ko.read` + `darfSehen`, `ko.create`, `users.manage` | Office im Artikel bekommt **keine neue Rechteachse** (siehe 3.4). |
| WOPI-Host, Editor-Dienst | **nicht vorhanden** | Vor diesem Auftrag gab es im Code keinen Treffer für `wopi`, `cspp`, `collabora` oder `onlyoffice`. `docker-compose.yml` enthält keinen Editor-Dienst. |

### 1.2 Tatsächlich nutzbare Integrationsrechte

| Recht | Stand | Beleg |
|---|---|---|
| Microsoft 365 **Business Basic** im eigenen Testmandanten, Globaler Administrator | vorhanden, Testversion bis 20.10.2026 (Übersicht) bzw. 21.10.2026 (Abrechnung) | Nutzerangabe in `docs/word-addin/ABNAHME-M365.md`, Abschnitt 1. Die Maschine hat keinen Zugang. |
| Word, Excel und PowerPoint für das Web **innerhalb** von SharePoint/OneDrive dieses Mandanten | Business Basic enthält diese Web-Anwendungen. Für Word ist die Verfügbarkeit per Nutzerangabe belegt, für Excel und PowerPoint nicht. | dieselbe Quelle |
| **CSPP-Teilnahme** (Microsoft Cloud Storage Partner Program) | **nicht vorhanden**. Es gibt keine Bewerbung, keine Vereinbarung und keine Freischaltung im Bestand. Ein M365-Testkonto beweist sie nicht. | kein Beleg im Bestand |
| Entra-App mit delegierten Graph-Schreibrechten | **nicht vorhanden** | siehe 1.1 |
| Collabora Online / ONLYOFFICE | keine Subscription vorhanden. Die freien Entwicklungs- bzw. Community-Ausgaben sind ohne Anmeldung nutzbar. | Herstellerangaben, siehe Abschnitt 6 |

---

## 2 · Geprüfte Wege

| Weg | Eingebettet im Artikel? | Was fehlt | Ergebnis |
|---|---|---|---|
| **A · Microsoft 365 für das Web über WOPI (CSPP)** | ja: Microsofts Editor im iframe, Klarwerk als WOPI-Host | Die **CSPP-Zulassung durch Microsoft**: Bewerbung, Programmvertrag, Prüfung mit WOPI-Validator und Interop-Tests, Freischaltung der Host-Domain. Zusätzlich die Proof-Key-Prüfung (`X-WOPI-Proof`). Bearbeiten dürfen nur Nutzer mit berechtigender Microsoft-365-Lizenz. | Zielweg mit der höchsten Office-Treue. **Heute nicht verfügbar und nicht testbar.** |
| **B · Vorhandene Microsoft-Anbindung** (Datei in SharePoint/OneDrive, Graph, Add-in) | **nein.** Bearbeitet wird in Microsofts eigener Oberfläche in einem neuen Tab. Graph `driveItem: preview` liefert eine einbettbare **Vorschau**. Ob man darin bearbeiten kann, ist nicht belegt und wäre im Testmandanten zu messen. | Entra-App-Registrierung, delegierte Graph-Rechte (Dateien lesen und schreiben), Zustimmung des Mandanten-Admins und ein Schreibweg im Graph-Client | Begleitweg „In Microsoft öffnen“. Er **erfüllt „direkt eingebettet“ nicht.** |
| **C · Selbst betriebener WOPI-Editor**: Collabora Online, ersatzweise ONLYOFFICE Docs | ja: Editor im iframe, Datei bleibt im Klarwerk-Objektspeicher | Editor-Dienst im Betrieb. Für den Test reicht die freie Ausgabe, für die Produktion braucht es eine Subscription (Abschnitt 6). | **Gewählter Weg.** Er ist heute ohne fremde Zulassung testbar. |

**Entscheidung: Weg C mit Collabora Online.** Dafür gibt es drei Gründe:

1. Er ist der einzige eingebettete Weg, der ohne fremde Zulassung testbar ist.
2. Collabora spricht WOPI wie Microsoft. Der Hostteil aus Abschnitt 3 ist derselbe, und Weg A
   kommt nach einer CSPP-Zulassung als zweiter Editor dazu (Discovery-Adresse und Proof-Key-Prüfung).
3. Die Dateien bleiben im Klarwerk-Objektspeicher, unter denselben Rechten und Belegen.

ONLYOFFICE bleibt Ersatz. Es kann ebenfalls WOPI, die Community-Ausgabe ist aber auf 20 gleichzeitige
Verbindungen begrenzt und steht unter AGPL. Weg B bleibt für Kunden mit SharePoint ein Begleitweg und
ersetzt den Editor nicht.

**Grenze von C:** Collabora stellt komplexe OOXML-Inhalte weniger getreu dar als Microsoft. Betroffen
sein können Makros, SmartArt, bestimmte Diagramme und Folienübergänge. Das ist nicht gemessen; es
wird im Bedienlauf (Abschnitt 7.4) an festen Prüfdokumenten festgestellt, nicht angenommen.

---

## 3 · Der gewählte Weg im Einzelnen (K2)

### 3.1 Browserhost

- Am Office-Anhang eines Artikels steht auf der Artikelseite „Im Artikel bearbeiten“ bzw. „Im
  Artikel ansehen“.
- Der Klarwerk-Server liest die **Discovery** des Editors (`/hosting/discovery`) und baut daraus die
  Editor-Adresse: die `urlsrc` der Aktion `edit` bzw. `view` für die Endung, mit
  `WOPISrc=<klarwerk>/wopi/files/<anhangId>`.
- Die Seite übergibt `access_token` und `access_token_ttl` per Formular-POST in ein iframe. Das ist
  das von WOPI vorgesehene Muster; die Marke steht so nicht in der Browser-Adresse.
- **CSP in beide Richtungen, eng wie in `office-host.ts`:**
  - Klarwerk erweitert `frame-src` um genau **eine** Editor-Herkunft aus der Betreiberumgebung
    (`KLARWERK_OFFICE_EDITOR_URL`), ohne Platzhalterfamilie.
  - Der Editor erlaubt Klarwerk über `frame-ancestors`; bei Collabora ist das die Einstellung
    `net.frame_ancestors`.

### 3.2 Dateispeicherung

- Der Inhalt liegt im **Objektspeicher** (Postgres).
- Jede angenommene Speicherung (PutFile) legt ein **neues** Objekt an. Das alte wird nie
  überschrieben; Test V1 belegt das am echten `ObjectStore`.
- Der Anhang des Artikels zeigt auf das Objekt der aktuellen Fassung.
- Jede frühere `objectId` bleibt über die Belegkette (`evidence`, Art `attachment`) und die
  Fassungs-Snapshots referenziert. Damit schützt die vorhandene Referenzprüfung
  (`objectReferences` in `build-app.ts`) sie vor dem Aufräumen.
- Größengrenze ist die des Objektspeichers, abgeleitet aus `MAX_OBJECT_BYTES` statt abgeschrieben
  (`passtInObjektspeicher`, Test P5). Darüber antwortet der Host mit 413.
- **Zwei Größen, getrennt (Nacharbeit 2):**
  - `KoAttachment.size` bleibt die Speichergröße nach Objektspeicher-Konvention, also die Länge der
    Daten-URL (`ObjectStore.put`, übernommen in `ko-routes.ts`). Eine Übernahme schreibt weiter genau
    diese Angabe (`ObjectRef.size`).
  - WOPI `CheckFileInfo.Size` ist die Dateigröße in Bytes. Der Host misst sie an den Bytes, die
    GetFile ausliefert; `size` am Anhang liest er dafür nie. Das gilt auch für Altbestand ohne `size`.
  - Belegt durch `hostweg.test.ts` H10, H2 und H3.

### 3.3 Artikelbezug

- Die WOPI-Dateikennung ist die Anhangskennung (`KoAttachment.id`).
- Die Zugangsmarke bindet `koId`, `anhangId`, `nutzerId`, das Schreibrecht und die
  **Öffnungsfassung**. Eine Marke für Anhang A öffnet Anhang B nie (Test M2).
- Die Öffnungsfassung entscheidet nur, ob eine **neue** Editor-Sitzung beginnen darf. Für
  Übernahmen gilt die Sitzungsbasis des Hosts (Abschnitt 5.1), nicht die Marke.
- Nur Anhänge mit einem Format aus Abschnitt 4 bekommen die Editor-Aktion. Ein Widerspruch zwischen
  Endung und Medientyp gilt als „kein Office-Anhang“ (Test F3).

### 3.4 Authentisierung und Rechte

1. **Nutzer → Klarwerk:** wie heute über die Klarwerk-Sitzung. Microsoft-Konten sind nicht nötig.
2. **Klarwerk → Editor:** Klarwerk stellt eine HMAC-SHA-256-Zugangsmarke aus.
   - Der Serverschlüssel kommt aus der Umgebung (`KLARWERK_WOPI_SCHLUESSEL`, mindestens 32 Byte,
     Test M7). Er gehört nie in Auftragsunterlagen.
   - Die Marke ist 10 Stunden gültig, wie WOPI es empfiehlt.
   - Sie ist fälschungssicher (Test M4) und läuft genau zum Ablaufzeitpunkt ab (Test M3).
3. **Editor → Klarwerk** (server-zu-server, `/wopi/files/...`):
   - **Jede** Anfrage prüft die Marke **und** liest die Rechte frisch aus dem Bestand: Rolle,
     `darfSehen`, Status. Ein entzogenes Recht wirkt deshalb ab der nächsten Editor-Anfrage.
   - Collabora kann nur Hosts erreichen, die in seiner Liste `storage.wopi.host` stehen.
   - Für Weg A ist zusätzlich die Proof-Key-Prüfung Pflicht.
   - Die Marke steht in der Anfrage-URL des Editors. Vor dem Verdrahten muss die Protokollierung
     `access_token` schwärzen (`log-sanitize.ts`).
4. **Schreibweg aus vorhandenen Rechten** (`officeSchreibweg`, Tests R1–R5):

| Lage | Schreibweg | Editor |
|---|---|---|
| nicht sichtbar (`darfSehen` falsch) | kein Zugang | 404 wie am Detailabruf |
| kein `ko.create` **oder** Altformat | nur lesen | Ansicht |
| Artikel `validiert`, ohne `users.manage` | Vorschlag | Ansicht. Eine Änderung läuft über den Vorschlagsweg (Abschnitt 5.4). |
| sonst | direkt | bearbeiten |

### 3.5 Versionsrückweg

- Jede Übernahme ist eine Artikelfassung mit Snapshot (`/api/kos/:id/versions`).
- Zurückgeholt wird, indem die `objectId` der gewünschten Fassung wieder an den Anhang gesetzt wird.
  Das ergibt eine **neue** Fassung mit dem Vermerk „aus Fassung n zurückgeholt“. Gelöscht wird nichts.
- **Lücke im Bestand:** `restoredFromVersion` prüft heute, ob die Dateien der alten Fassung noch am
  aktuellen Stand hängen (`pruefeUebernahmeAnhaenge`). Eine ersetzte `objectId` desselben Anhangs
  hängt dort nicht mehr. Der Rückweg braucht deshalb die Erweiterung aus Umsetzungsschritt **U3**:
  dieselbe Anhangskennung mit einer früheren, belegten `objectId` wird zugelassen.

### 3.6 WOPI-Endpunkte und Teilprobe

Die Endpunkte bedient `erstelleWopiHost` (`office-wopi-host.ts`). Die Integrationsprobe stellt
diese Funktion hinter einen schlichten `node:http`-Server. U2 hängt sie in Fastify ein und ergänzt
dort Protokollschwärzung und CSP.

| WOPI-Vorgang | Klarwerk-Route | Entscheidung aus `office-wopi.ts` |
|---|---|---|
| CheckFileInfo | `GET /wopi/files/:anhangId` | `pruefeZugangsmarke`, `officeSchreibweg`, `checkFileInfo` (`UserCanWrite`, `ReadOnly`, `Version` = Fassung + Objekt, `UserCanNotWriteRelative`) |
| GetFile | `GET /wopi/files/:anhangId/contents` | Marke; liefert den Arbeitsstand der Sitzung, sonst das Objekt der aktuellen Fassung |
| Lock, RefreshLock, Unlock, UnlockAndRelock, GetLock | `POST /wopi/files/:anhangId` mit `X-WOPI-Override` | `wendeSperreAn` (30 Minuten, 409 mit `X-WOPI-Lock`, Tests S1–S7). Die erste Sperre einer freien Datei beginnt die Sitzung: `entscheideSitzungsbeginn` (U1). Unlock beendet sie. |
| PutFile | `POST /wopi/files/:anhangId/contents` | `entscheidePutFile` (Schreibmarke, eigene Sperre, Größe; Tests P1–P5) |
| PutRelativeFile, RenameFile | — | nicht angeboten (`UserCanNotWriteRelative`, `SupportsRename: false`). Neben dem Artikel entsteht keine zweite Datei. |

---

## 4 · Word, Excel und PowerPoint (K3)

Alle drei Anwendungen laufen über **denselben** Hostteil; nur die Discovery-Aktion je Endung
unterscheidet sich. Die Tabelle ist mit `OFFICE_FORMATE` in `office-wopi.ts` abgeglichen; Test D1
hält beide gleich.

| Endung | Anwendung | Im Artikel |
|---|---|---|
| `.docx` | Word | bearbeiten |
| `.xlsx` | Excel | bearbeiten |
| `.pptx` | PowerPoint | bearbeiten |
| `.doc` | Word | nur lesen; Bearbeiten erst nach ausdrücklicher Umwandlung in `.docx` als neue Fassung |
| `.xls` | Excel | nur lesen; Bearbeiten erst nach ausdrücklicher Umwandlung in `.xlsx` als neue Fassung |
| `.ppt` | PowerPoint | nur lesen; Bearbeiten erst nach ausdrücklicher Umwandlung in `.pptx` als neue Fassung |

**Umfang der funktionierenden Teilprobe:**

- **Ohne Editor geprüft:** Formaterkennung für alle drei Anwendungen, Schreibweg, Zugangsmarke,
  CheckFileInfo, Sperren, PutFile-Annahme, Größengrenze, Sitzungsbasis und der Hostweg über HTTP.
- **Mit echtem Editor (CODE) geprüft, nur Word:** Die Integrationsprobe öffnet, ändert, speichert,
  übernimmt zweimal und öffnet eine **`.docx`** wieder.
- **Nicht geprüft:** `.xlsx` und `.pptx` im Editor, Microsoft als Editor, die Darstellungstreue sowie
  Excel-Formeln und PowerPoint-Folien.

---

## 5 · Speicherung, gleichzeitige Bearbeitung, Artikel und Status (K5)

### 5.1 Speichern in zwei Stufen

1. **Arbeitsstand (PutFile):**
   - Der Editor speichert automatisch und beim Schließen.
   - Jede angenommene Speicherung wird ein neues Objekt und der Arbeitsstand der Editor-Sitzung.
   - Es entsteht **keine** Artikelfassung; jede automatische Speicherung als Fassung wäre Rauschen.
2. **Übernahme als Fassung:**
   - Auslöser ist das Ende der Sitzung (Unlock bzw. Speichern beim Schließen; Collabora
     kennzeichnet es mit `X-COOL-WOPI-IsExitSave`) oder der Knopf „Als neue Fassung übernehmen“.
   - Neu ist eine Dienstmethode, die in **einer** Transaktion (`mutateKoTx`) die `objectId` des
     Anhangs tauscht **und** die Fassung erhöht. Heute sind das zwei getrennte Wege: `updateAttachment`
     ohne Fassung, `revise` ohne Anhangstausch.
   - Bedingung ist `expectedVersion = Sitzungsbasis`; das ist das vorhandene CAS. Wie die
     Sitzungsbasis entsteht und nachgezogen wird, regelt Abschnitt 5.1a.

### 5.1a Sitzungsbasis (Nacharbeit 1)

Runde 1 band die Übernahme an die Fassung in der Zugangsmarke. Die Marke ändert sich während einer
Sitzung nicht, die Artikelfassung aber schon, nämlich durch die eigene Übernahme. Die zweite
Übernahme derselben Sitzung wäre deshalb an der ersten gescheitert (`KO_STALE` gegen sich selbst).
Seit Nacharbeit 1 gilt:

| Schritt | Regel | Beleg |
|---|---|---|
| Sitzungsbeginn | Die erste Sperre einer freien Datei beginnt die Sitzung. Ihre **Basis** ist die Öffnungsfassung der Marke, aber nur, wenn diese gleich der aktuellen Artikelfassung ist. Sonst kommt `409` mit `X-WOPI-LockFailureReason`, und die Seite öffnet mit frischer Marke neu. | `entscheideSitzungsbeginn`, U1; `hostweg.test.ts` H6 |
| Beitritt | Weitere Teilnehmer der gemeinsamen Editor-Sitzung ändern die Basis nicht, auch wenn ihre Marke eine andere Öffnungsfassung trägt. | H4 |
| Eigene Übernahme | CAS gegen die Basis. Gelingt sie, wird die **neue Fassung die Basis**. Die nächste Übernahme derselben Sitzung ist damit kein Konflikt. Die Marken bleiben gültig und werden für die Übernahme nicht befragt; eine neue Marke ist nicht nötig. | U2; H3; CODE-Probe C3 |
| Fremde Änderung | Weicht die Artikelfassung von der Basis ab, hat jemand außerhalb der Sitzung geschrieben. Dann ist das Ergebnis ein Konflikt (`fremde-aenderung` bzw. `KO_STALE`). Die Basis wird **nicht** still nachgezogen; auch der zweite Versuch bleibt ein Konflikt. Aufgelöst wird durch Schließen und Neuöffnen (neue Basis) oder durch Einreichen als Vorschlag. | U3; H5 |
| Sitzungsende | Unlock beendet die Sitzung. Ein noch nicht übernommener Arbeitsstand wird dabei übernommen. Scheitert das an einer fremden Änderung, bleibt das Objekt erhalten und wird protokolliert; nichts wird überschrieben. Eine abgelaufene Sperre endet ebenso, sobald die nächste Sitzung beginnt. | H6, H7; CODE-Probe C4 |

Die Basis liegt beim Host, je Anhang. In der Probe liegt sie im Arbeitsspeicher
(`SpeicherWopiSitzungen`); für mehrere App-Prozesse braucht es die Postgres-Ablage aus U2.

### 5.2 Gleichzeitige Bearbeitung und Konflikte

| Fall | Verhalten |
|---|---|
| Mehrere Nutzer öffnen dieselbe Datei im Editor | Der Editor führt **eine** gemeinsame Sitzung je `WOPISrc`. Gearbeitet wird gemeinsam in Echtzeit, die Sperre gehört der Editor-Sitzung. Beim Öffnen meldet Klarwerk die Teilnehmer über den vorhandenen Bearbeitungshinweis (`PUT /api/kos/:id/bearbeitungen/:sitzung`). |
| Zweite Editor-Sitzung trifft eine fremde Sperre (z. B. ein zweiter Editor-Knoten) | `409` mit der bestehenden Sperre in `X-WOPI-Lock`. Gespeichert wird nichts (Tests S2, P3). |
| Speichern ohne oder mit abgelaufener Sperre | `409`, `X-WOPI-Lock` leer. Gespeichert wird nichts (Test P4). |
| Während der Editor-Sitzung schreibt jemand anderes am Artikel (Klarwerk-Texteditor, Import, Word-Add-in) | Die Übernahme prüft gegen die Sitzungsbasis (5.1a) und meldet `fremde-aenderung`; auch der CAS-Weg selbst ergibt `KO_STALE`. Der Arbeitsstand bleibt als Objekt erhalten. Der Mensch wählt „Stand neu laden“ oder „als Vorschlag einreichen“. Es wird **nichts überschrieben** (H5). |
| Dieselbe Sitzung übernimmt mehrmals | Jede eigene Übernahme zieht die Basis nach; die zweite und jede weitere gelingt (H3, CODE-Probe C3). |
| Lesemarke versucht zu speichern | `401` (Test P2) |

### 5.3 Auswirkungen auf den Artikel und den fachlichen Status

- Eine Übernahme hat dieselbe Bedeutung wie `revise`: Die Fassung wird um 1 erhöht, der **Status
  wird `offen`**, der Trust 0, und Bewertungen der Vorfassung zählen nicht mehr. Der Artikel muss
  wieder geprüft werden; der Beleg ist `ko.revised`.
- `admin` kann wie heute „übernehmen und freigeben“ wählen (Semantik von `revise-release`, Status
  `validiert`). Andere Rollen können das nicht.
- **Artikeltext und Suche:** Die Office-Datei ist ein Anhang; der Artikeltext (`bodyHtml`) bleibt
  unverändert. Damit Suche und Klara den neuen Inhalt sehen, wird nach der Übernahme der vorhandene
  Dokumentauszugsweg (`appendDocumentExtract`) für die neue Fassung angestoßen. Bis dahin zeigt die
  Artikelseite den Hinweis „Auszug aus Fassung n“; ein veralteter Auszug wird nicht still als
  aktueller ausgegeben. Die Entscheidung dazu fällt in Umsetzungsschritt U3.
- Papierkorb und Löschen bleiben unverändert. Ein Objekt früherer Fassungen bleibt über die
  Referenzprüfung geschützt.

### 5.4 Freigegebener Artikel ohne Freigaberecht

- Der Editor öffnet nur lesend (Test R2), so wie `revise` heute `PROPOSAL_REQUIRED` meldet.
- Eine bearbeitbare Kopie als Vorschlag ist **Phase 2**: `KoProposal` trägt heute nur `statement`
  und `bodyHtml` und braucht für einen Datei-Vorschlag eine `objectId`.
- Bis dahin ist der Weg: Datei herunterladen, ändern und als Vorschlag einreichen. Das ist ausdrücklich
  **kein** „Office im Artikel“.

---

## 6 · Anbieterrechte, Kosten und Lizenzen, Testmittel — getrennt (K4)

Preis- und Lizenzangaben sind Herstellerangaben nach Wissensstand. Vor jeder Buchung bestätigt sie
der Anbieter; gebucht wird nichts ohne Freigabe (Nichtziel).

### 6.1 Anbieterrechte

| Recht | Für | Stand | Bedingung |
|---|---|---|---|
| Microsoft-CSPP-Zulassung | Weg A | **fehlt** | Bewerbung durch den Klarwerk-Inhaber bei Microsoft, Programmvertrag, technische Prüfung (WOPI-Validator, Interop-Tests), Freischaltung der Host-Domain durch Microsoft. Bedingungen und etwaige Kosten regelt der Vertrag; öffentlich ist nichts zugesagt. |
| Entra-App-Registrierung mit delegierten Graph-Dateirechten und Admin-Zustimmung je Kundenmandant | nur Weg B | **fehlt** | Die Registrierung ist kostenlos, braucht aber die Zustimmung des Mandanten-Admins. |
| Collabora-Betrieb | Weg C | **nicht nötig** | Eine Anbieterzulassung gibt es nicht; Klarwerk betreibt den Editor selbst. |

### 6.2 Kosten- und Lizenzbedingungen

| Lizenz | Für | Bedingung |
|---|---|---|
| Microsoft-365-Lizenz der bearbeitenden Nutzer | Weg A (und B) | Bearbeiten in Microsoft 365 für das Web setzt eine berechtigende Microsoft-365-Lizenz je Nutzer voraus; Business Basic enthält die Web-Anwendungen. Die Kosten trägt der Kunde. |
| Collabora Online Development Edition (CODE) | Test für Weg C | MPL 2.0, kostenlos, für Entwicklung und Test bestimmt, ohne Support; zeigt einen Hinweis auf die Entwicklungsausgabe. **Nicht für den Produktivbetrieb.** |
| Collabora Online Subscription | Produktion für Weg C | kostenpflichtig je Nutzer und Jahr; Preis beim Hersteller oder Partner anfragen. **Nicht gebucht.** |
| ONLYOFFICE Docs Community / Enterprise | Ersatz für Weg C | Community: AGPLv3, höchstens 20 gleichzeitige Verbindungen. Enterprise: kostenpflichtig. |

### 6.3 Testmittel

| Testmittel | Stand |
|---|---|
| M365-Business-Basic-Testmandant mit Globalem Admin | **vorhanden** (Nutzerangabe), läuft am 20.10.2026 ab. Taugt für eine Messung an Weg B (Vorschau-Einbettung); **taugt nicht** als Nachweis für Weg A. |
| Docker-Betriebsweg | **vorhanden** (`docker-compose.yml`), aber ohne Editor-Dienst. Die Baubahn startet keine Dienste. |
| CODE-Abbild | frei erhältlich. Die Integrationsprobe startet es als Testcontainer (`collabora/code`, überschreibbar mit `KLARWERK_CODE_ABBILD`). Im Betriebsweg (`docker-compose.yml`) ist es **noch nicht eingebunden** (U1). |
| Prüfdokumente | `.docx`-Sollpaket **vorhanden** (`tools/word-host-wiederoeffnen.ts sollpaket`). Fiktive `.xlsx` mit Formeln und `.pptx` mit Bild und Notiz **fehlen** (U1). |
| Automatische Hostprüfung | **vorhanden**: `services/app/src/office-wopi.test.ts`, `tests/office-wopi-code/hostweg.test.ts` |
| Docker und Chromium in der Prüfbahn für die CODE-Probe | Nötig, um das CODE-Abbild zu laden und zu starten. Ob die Prüfbahn das darf, zeigt erst ihr Lauf; die Baubahn startet keine Dienste. |
| Mensch im Browser für den Bedienbeleg | **nötig, noch nicht erfolgt** (Abschnitt 7.4) |

---

## 7 · Nachweis: was geprüft ist und was offen bleibt

### 7.1 Quelleninspektion (Abschnitt 1)

Gelesen am Stand `863a0974`: `office-host.ts`, `graph-client.ts`, `ABNAHME-M365.md`,
`word-host-gesamtweg.md`, `object-store/src/types.ts` und `service.ts`, `ko-routes.ts`
(`revise`, `revise-release`, `propose`, 409-Abbildung), `bearbeitung-routes.ts`,
`knowledge-object/src/service.ts` (`revise`, `addAttachment`, `updateAttachment`, Dokumentübernahme).

### 7.2 Automatische Prüfung (Teilprobe)

- `services/app/src/office-wopi.test.ts`: Fälle F1–F3, R1–R5, M1–M7, C1, S1–S7, P1–P5, U1–U4, V1,
  D1. In Runde 1 lief die Fassung ohne U1–U4: 30 Fälle grün (Prüfbericht in `HISTORIE/nacharbeit-1`).
- `tests/office-wopi-code/hostweg.test.ts` prüft den Hostweg über HTTP ohne Editor (H1–H9).

Ausgeführt werden beide durch die Prüfbahn; die Baubahn startet keine Tests.

### 7.3 Integrationsprobe mit echtem Editor (Nacharbeit 1)

`tests/office-wopi-code/code-probe.integration.test.ts`:

- **Aufbau:**
  - Der Hostweg `erstelleWopiHost` läuft hinter `node:http`. Eine fiktive `.docx` liegt im
    Objektspeicher, der Artikel ist die `ArtikelAttrappe`.
  - Ein Testcontainer `collabora/code` hat `aliasgroup1` auf den Hostweg und `net.frame_ancestors`
    auf die Host-Seite.
  - Chromium lädt die Host-Seite, und diese bettet den Editor nach dem WOPI-Muster ein (Formular-POST
    mit Marke in ein iframe).
- **C1 Öffnen:** Discovery, Editor lädt (`Document_Loaded`). Der Hostweg sah CheckFileInfo, GetFile
  und LOCK, jeweils mit 200.
- **C2 Ändern und Speichern:** Text wird über die Nachrichtenschnittstelle des Editors eingefügt
  (`Send_UNO_Command` `.uno:InsertText`), danach kommt `Action_Save`. Der Editor schickt PutFile;
  die gespeicherte DOCX enthält Ausgangstext und Änderung.
- **C3:** Zwei Übernahmen derselben offenen Sitzung ergeben Fassung 2, dann 3.
- **C4 Schließen und Wiederöffnen:** Der Editor entsperrt. Die neue Öffnung liest per GetFile das
  Objekt der übernommenen Fassung mit beiden Änderungen. Die Ausgangsfassung ist unverändert lesbar.
- **Bildschirmfotos:** `test-results/office-wopi-code/01-geoeffnet.png`,
  `02-geaendert-gespeichert.png`, `03-wiedergeoeffnet.png`.

**Grenzen der Probe:**

- Nur `.docx`.
- Geändert wird nicht per Tastatur.
- Artikel-Attrappe statt Wissensobjektdienst (U3).
- Keine Klarwerk-Anmeldung und keine Artikelseite (U2, U4).
- Keine Beurteilung der Darstellungstreue.

**Stand der Ausführung:** Bis zur Abgabe dieser Nacharbeit ist die Probe **nicht gelaufen**. Sie
braucht Docker mit Zugriff auf die Abbilder `collabora/code` und `testcontainers/sshd` sowie
Chromium. Scheitert sie am Start (Abbild nicht ladbar, kein Docker), fehlt ein Prüfmittel. Das ist
dann als solches zu belegen und kein Befund am Hostweg.

### 7.4 Offen: menschlicher Bedienlauf im Artikel (nach U1–U4)

1. Testserver mit CODE-Dienst; Umgebung: `KLARWERK_OFFICE_EDITOR_URL`, `KLARWERK_WOPI_SCHLUESSEL`.
   Den Schlüssel erzeugt der Betreiber; er gehört nicht in den Beleg.
2. Als `experte` einen offenen Testartikel mit fiktivem `.docx`, `.xlsx` und `.pptx` öffnen. Nacheinander
   jeweils „Im Artikel bearbeiten“ wählen, eine Zeile, eine Zelle mit Formel und einen Folientitel
   ändern und schließen.
3. Erwartet je Datei: neue Fassung, Status `offen`, die alte Fassung ist abrufbar, und der Download
   der neuen Datei enthält die Änderung.
4. Zwei Browser, zwei Konten, dieselbe Datei: gemeinsame Sitzung. Parallel den Artikeltext im
   Klarwerk-Editor speichern; danach muss die Übernahme `409 KO_STALE` zeigen.
5. Als `experte` einen `validiert`-Artikel öffnen: der Editor zeigt nur die Ansicht.
6. Rückholen von Fassung n: der Anhang zeigt wieder den alten Inhalt.

Belege sind Bildschirmfotos und die JSON-Antworten (`/api/kos/:id`, `/versions`), ohne Marken,
Cookies oder Schlüssel.

**Nicht gemessen und nicht behauptet:**

- dass ein Editor heute auf der Klarwerk-Artikelseite läuft;
- die Darstellungstreue von Collabora;
- die Bearbeitbarkeit der Microsoft-Vorschau (Weg B).

---

## 8 · Nächster Schritt (K6)

**Nächster konkreter Schritt: U1 + U2 auf dem Testserver**, ohne fremdes Recht und ohne Kosten:

- **U1:** CODE als zusätzlicher Dienst in `docker-compose.yml`, nur im Testprofil, mit
  `frame_ancestors` und `storage.wopi.host` auf die eine Klarwerk-Herkunft. Dazu fiktive
  Prüfdokumente `.xlsx` und `.pptx`.
- **U2:** Den vorhandenen Hostweg `erstelleWopiHost` in Fastify verdrahten. Dazu gehören eine
  Sitzungsablage in Postgres (je `anhangId`, statt `SpeicherWopiSitzungen`), die Schwärzung von
  `access_token` in der Protokollierung und die CSP-Erweiterung `frame-src`.
- **U3:** Dienstmethode „Office-Fassung übernehmen“: Anhangstausch und Fassung in einer Transaktion,
  mit CAS. Sie erfüllt den Vertrag `WopiArtikelZugriff.uebernimm` und ersetzt die Attrappe. Dazu
  gehören der Rückweg über eine frühere `objectId` und der Anstoß des Dokumentauszugs.
- **U4:** Editor-iframe auf der Artikelseite. Danach folgt der menschliche Bedienlauf aus 7.4.

**Externe Mittel, genau benannt:**

| Für | Externes Mittel | Wer |
|---|---|---|
| Integrationsprobe 7.3 | **keins** außer einer Prüfbahn mit Docker (Abbilder `collabora/code`, `testcontainers/sshd` aus dem Netz ladbar) und Chromium | Betreiber der Prüfbahn |
| U1–U4 (Test) | **keins** außer der Betriebsfreigabe, auf dem Testserver einen weiteren Docker-Dienst (CODE) zu starten | Betreiber/Pedi |
| Produktivbetrieb Weg C | **Collabora-Online-Subscription** (Angebot und Kauffreigabe) | Pedi |
| Microsoft 365 im Artikel (Weg A) | **CSPP-Zulassung durch Microsoft** (Bewerbung und Programmvertrag) | Klarwerk-Inhaber gegenüber Microsoft |
| „In Microsoft öffnen“ (Weg B, nicht eingebettet) | **Entra-App-Registrierung + Admin-Zustimmung** im Kundenmandanten | Mandanten-Admin des Kunden |
