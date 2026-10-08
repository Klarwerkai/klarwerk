# Insel-Hausbetrieb — Installationsmaterial, Hardware, Signierung, Lizenz, Sicherheitsupdate, Datenträgeraustausch

*Auftrag `aufnahme:20260922:gesamt-insel-updates` · Ausgangsstand `c62a9855` (`1.0.0-beta.1.745`) ·
Quellenstand der Aufnahmepunkte: 22.09.2026*

> Dieses Dokument **konkretisiert** die Anforderungen, die über den bestehenden Auftrag B4 hinaus
> aufgenommen sind, und hält für jeden zugeordneten Aufnahmepunkt Ergebnis oder verbleibende
> Entscheidung fest. Es **baut nichts neu** und erfindet keine Anforderungen: Was hier als *Soll*
> steht, folgt aus dem Originalwortlaut der Punkte und den vorhandenen Verträgen im Code. Was eine
> menschliche Entscheidung braucht, steht als **Entscheidung offen** da und wird nicht vorweggenommen.
> Kein Satz hier behauptet, dass eine Signatur-, Lizenz- oder Datenträgerfunktion im Produkt existiert —
> sie existiert heute nicht (§2).

---

## 1. Abgrenzung

| Umfang | Wo er liegt | Was dieses Dokument tut |
| --- | --- | --- |
| Echtes Insel-ZIP bauen, einspielen, aktualisieren, Rückfall nach Startfehler, Browsernachweis | **B4** `arbeit:b4-insel-release-update-rueckfall-20260921` (K1–K8, Stand 22.09.: offen, kein Abschlussbeleg) | Verweist darauf. Bestellt nichts neu. Start-/Sicherungsbausteine aus JOB 4012/4315/4332 bleiben Grundlage. |
| Compose-/Kundeninstanz-Neuinstallation | B2 (eigener Auftrag) | Nicht berührt. |
| PostgreSQL-Datenrückweg auf die Produktionsdatenbank | B3 (`scripts/backup/**`) | Nicht berührt. |
| Offline-Installationsmaterial, Hardwareübersicht, Signierung, Überwachung, Lizenzierung (R-0849) | **dieser Auftrag** | §3 |
| Sicherheitsupdate ohne Betriebsunterbrechung, beschrieben und geprobt (R-0856) | **dieser Auftrag** | §4 |
| Signierter Wissen-/Regelaustausch per Datenträger (R-0859) | **dieser Auftrag** | §5, gebunden an Import-/Rechtevertrag |

Der vorhandene Update- und Rückfallweg ist in `docs/operations/maintenance-update-process.md` §6.1 und
`scripts/insel/README.md` beschrieben, geprüft in `tests/insel-update/` und am echten Paket in
`tests/insel-auslieferung/release-update-rueckfall.integration.test.ts`. Ob dieser Paketlauf auf einem
macOS-Prüfplatz vollständig grün gelaufen ist, belegen die Auftragsquellen **nicht** (B4
`completion_evidence` 22.09.: „Kein nachgewiesenes vollständig geliefertes Ergebnis").

---

## 2. Ist-Stand am Code (Ausgangsstand, nachgelesen)

- **Paket:** `scripts/insel/build-current-release.mjs` baut ein Release aus `services/**`, `apps/web/dist`,
  den Betriebswegen und den berechneten Fremdquellen und führt danach im Release-Verzeichnis
  `npm ci --omit=dev` aus. Das ZIP enthält also die **Produktionsabhängigkeiten** (`node_modules`).
- **Update:** `scripts/insel/update-einspielen.sh` sichert, prüft Paket (Archivintegrität),
  Kollision, Schema-Vertrag und Datenstand, schaltet um und prüft `/health` samt Version; bei Rot
  `scripts/insel/rueckfall.sh`.
- **Keine Echtheitsprüfung.** Weder Bauer noch Updateweg erzeugen oder prüfen eine Signatur oder ein
  Prüfsummenmanifest des Pakets. Prüfsummen gibt es nur für die **Sicherungen** (`state.jsonl`,
  Dump-Sidecar). Ein beliebiges, richtig aufgebautes ZIP wird eingespielt.
- **Keine Lizenzierung.** Im Produkt gibt es keine Lizenzdatei, keine Aktivierung, keine Drittlizenzliste
  im Paket.
- **Kein Datenträgeraustausch.** Es gibt kein Bündelformat, keinen Signaturschritt und keinen eigenen
  Importeingang für Wissen oder Regeln von einem Datenträger. Vorhanden sind die allgemeinen Wege
  `GET /api/library/export` und `POST /api/library/import` (§5).
- **Keine Hardwareübersicht als Produktdokument.** `docs/operations/local-hardware-readiness.md` ist eine
  Readiness-Notiz mit Beispielmatrix für das Sprachmodell, ausdrücklich „gültig erst mit echten Werten".

---

## 3. R-0849 · Hausbetrieb als Produkt — konkretisiert

Originalwortlaut: „Damit ein Kunde die Anwendung selbst betreiben kann, braucht es ein
Installationspaket auch ohne Internet, eine Hardwareuebersicht, signierte Offline-Aktualisierungen, den
Ruecksprung auf die vorige Fassung, Ueberwachung und Lizenzierung. Davon existiert heute nichts."

Der Schlusssatz stammt vom 06.07.2026. Heute ist er für **Paket** (Teil) und **Rücksprung** überholt
(§2, B4), für die übrigen Teile weiterhin zutreffend.

### H1 · Installationsmaterial ohne Internet

**Soll.** Ein Kunde installiert auf einem Rechner ohne Netz allein von einem Datenträger. Das Material
besteht aus genau diesen Teilen:

1. dem Release-ZIP des offiziellen Bauers (vorhanden, B4),
2. der Laufzeit, die das Release voraussetzt (`Node.js ≥ 20` laut `scripts/insel/README.md`) — **heute
   nicht im Material**,
3. der lokalen Sprachmodell-Laufzeit und den Modelldateien, falls der Kunde das lokale Modell nutzt
   (Ollama oder MLX laut Übergabe) — **heute nicht im Material**,
4. dem Prüfsummenmanifest und der Signatur (H3),
5. der Drittlizenzliste (H6) und der Hardwareübersicht (H2) als Dateien neben dem Paket.

**Abnahme.** Leerer Zielrechner der unterstützten Plattform, Netz getrennt, Installation nur vom
Datenträger, danach Health mit Version, Anmeldung und ein gespeicherter Eintrag. Der B4-Paketlauf deckt
Punkt 1 auf einem Prüfrechner ab, **nicht** den netzlosen Zielrechner.

**Konkrete Einschränkung.** `npm ci --omit=dev` läuft auf dem **Baurechner**; Bibliotheken mit nativen
Teilen (z. B. `sharp`) bringen dabei Binärdateien für dessen Betriebssystem und Prozessor mit. Ein Paket
ist deshalb nur für die Plattform gültig, auf der es gebaut wurde. Das Material muss die Zielplattform
nennen.

**Entscheidung offen.** (a) Unterstützte Zielplattformen — nur macOS auf Apple Silicon (Mac Studio) oder
mehr. (b) Liefern wir Node und die Modelllaufzeit mit, oder sind sie Vorbedingung beim Kunden. (c) Ob
Modellgewichte weitergegeben werden dürfen, hängt von deren Lizenz ab (H6).

### H2 · Hardwareübersicht

**Soll.** Eine Tabelle *Mindestens / Empfohlen* für die unterstützte Plattform mit gemessenen Werten:

| Posten | Grundlage heute | Fehlt |
| --- | --- | --- |
| App allein (Node, Journal) | braucht keine GPU (`docs/operations/local-hardware-readiness.md` §2) | RAM/CPU unter Last nicht gemessen |
| Lokales Sprachmodell | Beispielmatrix nach Unified Memory (ebd. §4/§5) | Werte am Zielrechner |
| Speicher | je Update ein vollständiges Release mit `node_modules` **plus** die Vorversion für den Rückfall, je Update eine Sicherung, das Journal | Paketgröße heute nicht gemessen; Aufbewahrungsregel für alte Releases und Sicherungen |

**Entscheidung offen.** Das Erstinventar am Mac Studio (`scripts/insel/Insel-inventarisieren.command`)
steht in Übergabe §7 Punkt 4 als offen, und unter `docs/operations/` liegt kein `INSEL-AUFBAU.md`.
Ohne diese Werte bleibt die Übersicht ein Beispiel.

### H3 · Signierte Offline-Aktualisierung

**Soll.**

1. Der Bauer schreibt neben das Release ein **Manifest**: Version, Commit, Bauzeit, Zielplattform und
   SHA-256 jeder Datei; dazu eine **abgelöste Signatur** über das Manifest.
2. `update-einspielen.sh` prüft die Signatur gegen einen **öffentlichen Schlüssel, der schon auf der
   Insel liegt** — nie gegen einen, den das Paket mitbringt — und danach jede Datei gegen das Manifest.
   Das geschieht **vor** Sicherung und Umschalten.
3. Scheitert die Prüfung, bricht der Weg ab, ohne etwas anzufassen, mit genau einer Ergebniszeile und
   eigenem Grund (`signatur`); die laufende Fassung läuft weiter. Das ist derselbe Vertrag wie bei
   `paket` und `kollision` — ein Abbruch vor dem Umschalten.
4. Derselbe Schritt gilt für die Erstinstallation über `install.command`, denn sie übergibt bereits an
   denselben Weg.
5. Der private Schlüssel liegt nie im Repo, nie im Paket und nie auf der Insel.

**Entscheidung offen.** (a) Verfahren: Node bringt Ed25519 ohne Zusatzwerkzeug mit, und Node ist
ohnehin Vorbedingung — das ist die Empfehlung. Apples Notarisierung braucht dagegen eine
Online-Verbindung zu Apple. (b) Wer den privaten Schlüssel hält und wo. (c) Wie der erste öffentliche
Schlüssel vertrauenswürdig auf die Insel kommt, etwa per Fingerabdruckvergleich durch einen Menschen.
(d) Schlüsselwechsel und Widerruf. (e) Exitcode für `signatur` im bestehenden Exitcode-Vertrag vergeben.

### H4 · Rücksprung auf die vorige Fassung

Vorhanden (`scripts/insel/rueckfall.sh`, automatisch und von Hand). Abschluss und Nachweis gehören zu
**B4**. Hier nichts Neues.

### H5 · Überwachung

**Ist.** Der Updateweg prüft `/health` mit Version. `docs/operations/monitoring-logging.md` beschreibt
den Cloudbetrieb. Auf der Insel gibt es keinen Abfluss nach außen und deshalb keine externe Alarmierung.

**Soll.** Lokal ablesbar für den Betreiber und ohne jeden Egress: Health mit Version, Alter der letzten
gelungenen Sicherung, freier Speicher, Größe des Journals.

**Entscheidung offen.** Welche Werte genau, wer sie wie oft ansieht und ob die App sie selbst anzeigt
oder ein Betriebsskript.

### H6 · Lizenzierung

Zwei verschiedene Dinge, die nicht vermischt werden dürfen:

1. **Kundenlizenz für Klarwerk.** **Soll:** eine signierte Lizenzdatei, offline prüfbar mit demselben
   Mechanismus wie H3, aber mit eigenem Zweck. **Entscheidung offen:** Lizenzmodell (Laufzeit,
   Nutzerzahl, Installation), Verhalten bei Ablauf. Ob danach Lesezugriff auf die eigenen Daten bleibt,
   ist eine Geschäftsentscheidung und wird hier nicht getroffen.
2. **Drittlizenzen im Material.** **Soll:** Liste der Lizenzen aller mitgelieferten
   Produktionsabhängigkeiten, gegebenenfalls von Node und der Modellgewichte, erzeugt beim Bau, im
   Material enthalten. **Ist:** nicht vorhanden.

---

## 4. R-0856 · Sicherheitsupdate ohne Betriebsunterbrechung — konkretisiert

Originalwortlaut: „Ein Sicherheitsupdate laesst sich einspielen, ohne den Betrieb zu unterbrechen; der
Weg ist beschrieben und geprobt."

- **N1 · Ein Weg.** Ein Sicherheitsupdate ist ein normales Release über denselben signierten Updateweg
  (H3). Kein zweiter Weg an Sicherung, Vertrag und Rückfall vorbei. Weil das Paket `node_modules`
  enthält, ist auch ein reines Abhängigkeits-Update ein vollständiges Release.
- **N2 · Ohne Betriebsunterbrechung.** **Soll (Originalwortlaut, unverändert im Umfang):** Das
  Sicherheitsupdate wird eingespielt, ohne den Betrieb zu unterbrechen. **Ist, abweichend:** Der
  heutige Weg beendet den alten Server, schaltet um und startet den neuen (§6.1 Schritt 3). Zwischen
  Stopp und grünem Health ist die App nicht erreichbar, und wie lange das dauert, ist nicht gemessen.
  Zwei gleichzeitig laufende Fassungen auf demselben Journal sind im heutigen Aufbau nicht vorgesehen.
  Der Zielzustand ist deshalb **nicht erfüllt**, und um ihn zu erreichen, muss der Umschaltweg geändert
  werden. **Entscheidung offen:** ob eine kurze, angekündigte Neustartpause als Abschwächung dieser
  Anforderung zugelassen wird. Bis jemand das entscheidet, gilt der Originalzielzustand ohne
  Unterbrechung.
- **N3 · Beschrieben.** Der Notfallpfad in `docs/operations/maintenance-update-process.md` §11 ist auf
  Cloud/Coolify zugeschnitten. **Soll für die Insel:** Sicherheitsmeldung bewerten → Release bauen →
  signieren (H3) → Datenträger → `update-einspielen.sh` → Health mit Version → Ergebniszeile und
  Sicherung protokollieren → bei Rot automatischer Rückfall. Dieser Ablauf ist erst dann „beschrieben",
  wenn H3 existiert. Ohne Signatur wäre die Beschreibung eine Behauptung.
- **N4 · Geprobt.** **Fehlt.** Die Quelle sagt dazu: „Der Wartungs- und Updateprozess beschreibt einen
  Notfallpfad, der nicht geprobt ist." Den Paketlauf von B4 kann man technisch als Probe des Update- und
  Rückfallweges werten. Ein Nachweis, dass der Sicherheitsupdate-Weg geprobt ist, fehlt weiterhin:
  Es gibt keinen Probelauf eines Sicherheitsupdates über den beschriebenen Weg (N3), der auch zeigt,
  dass der Betrieb dabei nicht unterbrochen wird (N2).

---

## 5. R-0859 · Signierter Wissen-/Regelaustausch per Datenträger — an Import-/Rechtevertrag gebunden

Originalwortlaut: „Wissen und Regeln wandern signiert auf einem Datentraeger zwischen der zentralen
Installation und der abgeschotteten Anlage, weil ein Netzabgleich dort nicht erlaubt ist."
Herkunft: `docs/Berater/BERATER_KONZEPT_WISSENSSCHICHT_KLARWERK-GEHIRN_2026-07-05.md` §6.3 (Vorschlag:
gerichtet je Schicht, Bündel signiert, bei Signaturbruch komplett ablehnen, Vertraulichkeit reist mit).

Der Austausch braucht **keinen eigenen Schreibweg**. Er wird an die vorhandenen Verträge angeschlossen:

| # | Regel für den Datenträgeraustausch | Vorhandener Vertrag, an den sie bindet |
| --- | --- | --- |
| D1 | **Ausfuhr nur mit Leserecht, vertraulich nur mit Prüfrecht.** Ein Bündel enthält genau, was der Ausführende über den Export sehen darf: validierte Einträge, vertrauliche nur mit `ko.validate`. Das Bündel nennt den Umfang. | `GET /api/library/export`: `ko.read`, `includeConfidential = can(role, "ko.validate")` (`services/app/src/routes/library-routes.ts`); Rechtematrix `services/rbac/src/policy.ts` |
| D2 | **Einfuhr nur als Kandidat.** Ein Bündel schreibt nie direkt Wissensobjekte. Es reiht Kandidaten ein (`ko.create`), ein Wissensobjekt entsteht erst durch die Annahme mit `ko.validate`. Dubletten laufen durch die vorhandene Dublettenprüfung. | `POST /api/library/import` und `…/import/candidates` (`ko.create`), Entscheidung `…/import/candidates/:id` (`ko.validate`), `createImportCandidates` (`services/library-analytics/src/service.ts`) |
| D3 | **Vertraulichkeit reist ausdrücklich mit.** Jeder Eintrag im Bündel trägt `confidentiality`. Ein unbekannter Wert wird schon heute auf `vertraulich` gezogen. Ein **fehlender** Wert fiele bei der Annahme auf den Standard `intern`, deshalb gilt ein Eintrag ohne Wert als Fehler im Bündel. | `sanitizeImportConfidentiality` (`services/library-analytics/src/service.ts`), `ImportItem.confidentiality` (`services/library-analytics/src/types.ts`) |
| D4 | **Quell-Leseeinschränkungen gehen verloren, wie heute.** Über die allgemeinen Importwege werden `sourceRestrictions` verworfen. | `ohneQuellRestriktionen` (`services/library-analytics/src/types.ts`) |
| D5 | **Herkunft und Wiederholbarkeit über vorhandene Felder.** `externalId` = Kennung des Eintrags in der Ursprungsinstallation, `sourceScope` = Kennung der Ursprungsinstallation, `provider` = Datenträger. Ein zweites Einspielen desselben Bündels trifft dieselbe Kennung. | `ImportItem.externalId` / `sourceScope` / `provider` (`services/library-analytics/src/types.ts`) |
| D6 | **Signatur vor allem anderen.** Bündel = Manifest mit SHA-256 je Datei und Signatur, Mechanismus wie H3. Geprüft wird **vor** dem Einreihen. Bei Bruch wird das ganze Bündel abgelehnt, nie ein Teil eingespielt. | neu; einziger Teil ohne vorhandenen Vertrag (gemeinsam mit H3) |
| D7 | **Sichtbar vor der Übernahme.** Was kommt, sieht der Prüfende als Kandidatenliste, bevor irgendetwas Wissen wird. | vorhandene Kandidatenwarteschlange (D2) |

**Entscheidung offen.**

- **„Regeln".** Im Beraterkonzept sind das Verhaltensartefakte (Schicht 2, zentral → Insel). Im
  Produktbaum gibt es dafür **keinen** Speicher und **keinen** Import-/Rechtevertrag. Erst muss
  festgelegt werden, welches Produktobjekt „Regel" heißt, dann lässt sich der Austausch daran binden.
- **Quell-Leseeinschränkungen (D4).** Sollen sie über ein signiertes Bündel erhalten bleiben? Dann
  wäre der Datenträger ein eigener Quell-Adapter des quellneutralen Import-Vertrags (`SourceAdapter`).
  Heute ist das nicht so.
- **Löschungen.** Das Beraterkonzept schlägt Tombstones vor. Der Importvertrag kennt heute keine
  Löschübertragung.
- **Schlüssel.** Gleicher Schlüssel wie für Updates (H3) oder ein eigener Zweck- und Schlüsselbezug.
  Empfehlung: getrennt, damit ein Wissensbündel nie als Programmupdate gilt.
- **Richtung.** Fachwissen beidseitig mit Prüfung, Gedächtnis bleibt lokal (Berater §6.3). Muss als
  Produktentscheidung bestätigt werden.

---

## 6. Punktliste — jeder zugeordnete Aufnahmepunkt

| Punkt | Stand laut Quelle | Ergebnis in diesem Auftrag | Verbleibende Entscheidung / Rest |
| --- | --- | --- | --- |
| R-0815 Update ohne Datenverlust (~2 MB statt ~268 MB) | bestehender Auftrag (B4) und diesem Auftrag zugeordnet | **Offener Rest dieses Auftrags, nicht erfüllt.** Das vollständige B4-Release enthält `node_modules` und belegt nicht das kleine Update, das nur Programm und Oberfläche ersetzt und installierte Bibliotheken und Daten unberührt lässt. Widerspruch W1 festgehalten. | Kleines Update (nur Programm und Oberfläche, Bibliotheken und Daten unberührt, etwa 2 MB statt etwa 268 MB) steht weiter aus. Ungeklärt ist, wie es neben dem B4-Weg mit Sicherung, Schema-Vertrag und Rückfall gebaut wird, ohne einen zweiten Weg daran vorbei. |
| R-0849 Hausbetrieb als Produkt | Arbeitsauftrag | §3 H1–H6 konkretisiert | H1(a–c), H2 Messung, H3(a–e), H5, H6 Modell; Freigabe trotz früherer Einstufung „SPAETER" (W6) |
| R-0856 Notfallupdate bei Sicherheitslücken | Arbeitsauftrag | §4 N1–N4 konkretisiert. Der Zielzustand „ohne Betriebsunterbrechung" ist heute nicht erfüllt (N2). | Umschaltweg ohne Unterbrechung; ob eine Neustartpause als Abschwächung zugelassen wird, ist offen (N2); Nachweis einer Probe fehlt (N4) |
| R-0859 Signierter Datenabgleich per Datenträger | Arbeitsauftrag | §5 D1–D7 an Import-/Rechtevertrag gebunden | „Regeln", D4, Löschungen, Schlüssel, Richtung |
| P-C-INSELPAKET-STARTET | bestehender Auftrag (B4) | Abgegrenzt zu B4 | B4 K1–K8 |
| priority:C-INSELPAKET-STARTET:e64d27979c61 | bestehender Auftrag (B4), gleicher Wortlaut wie P-C-INSELPAKET-STARTET | Abgegrenzt zu B4 | B4 K1–K8 |
| TEST-A16 Update und Rückfall | Arbeitsauftrag, Prüfung offen seit 15.09. | Inhalt deckt sich mit B4. Kein eigener Prüflauf in diesem Auftrag. | Beurteilung über den B4-Paketlauf auf macOS (B4 K7/K8) |
| question:K08 (T013/T015) | bestehender Auftrag (B4), historische Frage | Aufgelöst durch B4. Der B4-Test baut als Vorgänger die erste selbst startende Fassung `1.0.0-beta.1.580`. | Erstinstallation und Update mit demselben ausgelieferten Paket: B4-Abschlussbeleg fehlt |

---

## 7. Quellenwidersprüche

- **W1 · Kleines Update gegen volles Release.** R-0815 und Übergabe §4.4 beschreiben ein Update-ZIP von
  etwa 2 MB, das nur `services/` und `apps/web/dist/` ersetzt und `node_modules` unberührt lässt
  (`UPDATE-einspielen.command`). Heute baut der offizielle Bauer ein vollständiges Release mit
  `npm ci --omit=dev`. `update-einspielen.sh` schaltet ganze Release-Verzeichnisse um. Ein
  `UPDATE-einspielen.command` gibt es unter `scripts/insel/` nicht mehr. Der Kopf von
  `update-einspielen.sh` hält fest, dass jener kleine Weg „gar nichts" sicherte. Das volle Release
  ersetzt die Anforderung nicht: R-0815 bleibt diesem Auftrag zugeordnet und bleibt offen.
- **W2 · Tailscale gegen Abschottung.** Die Übergabe nennt als Transportweg auf die Insel „per
  Tailscale", also eine Netzverbindung. R-0859 setzt voraus, dass „ein Netzabgleich dort nicht erlaubt
  ist". Ungeklärt ist, ob Programmupdates per Tailscale erlaubt bleiben und nur Wissen per Datenträger
  reist, oder ob beides per Datenträger gehen muss.
- **W3 · „Davon existiert heute nichts".** Das galt am 06.07. Heute ist es für Paket und Rücksprung
  überholt (B4-Bestand), für Signierung, Lizenzierung, Hardwareübersicht und Insel-Überwachung nicht.
- **W4 · Lokale Modelllaufzeit.** `docs/operations/local-hardware-readiness.md` §2 sagt „Keine lokale
  Runtime verdrahtet". Der Code verdrahtet ein lokales Modell als zweites Backend
  (`createLocalClientFromEnv` in `services/reasoner/src/model-client.ts`, dort umhüllt von
  `createCappedLocalClientFromEnv`, und diese Hülle ruft `services/app/src/build-app.ts` auf). Die
  Readiness-Notiz ist an dieser Stelle veraltet.
- **W5 · „Ohne Unterbrechung" gegen Umschaltweg.** R-0856 verlangt ein Update ohne
  Betriebsunterbrechung, der heutige Weg stoppt den Server vor dem Neustart. Der Zielzustand bleibt
  bestehen (N2).
- **W6 · Zeitliche Einstufung.** R-0849 trägt als frühere Begründung „das ist ein zweites Unternehmen
  und darf nicht parallel zum ersten Cloud-Piloten laufen" (Status damals `SPAETER`). Dieser Auftrag
  verlangt die Bearbeitung. Die Konkretisierung hier verletzt das nicht. Ob mit dem **Bau** von Signierung
  und Lizenzierung jetzt begonnen werden darf, entscheidet Pedi.

## 8. Fehlende Belege

- Kein Laufbeleg des B4-Paketlaufs auf einem macOS-Prüfplatz in den Auftragsquellen (B4 K7/K8).
- Keine gemessene Paketgröße und keine gemessene Unterbrechungsdauer eines Updates.
- Keine Hardwerte des Mac Studio (Erstinventar offen, kein `INSEL-AUFBAU.md`).
- Keine Probe eines Sicherheitsupdates.
- Kein Lieferbeleg mit Fassung für dieses Dokument. Der entsteht erst mit Veröffentlichung und
  Livefassung.
