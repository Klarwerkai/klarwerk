# Job-Stammblatt und Wache gegen doppelte Auftragskennungen

Auftrag `aufnahme:20260922:gesamt-job-stammblatt`, Revision 1, Basis `160b09fb`. Die
Originalkriterien K1–K3 sind unverändert aus `AUFTRAG-B1.json` übernommen. Wortlaut, Herkunft und
Altbestand je Punkt stammen aus `QUELLEN.json` (`original_points`: R-1190, R-1287, R-1393,
R-1492). Auftragsquelle `auftraege-002.json` (SHA-256 `0f277c5e…`), Registerauszug
`REGISTER-SNAPSHOT.json` (SHA-256 `6e22ce8e…`).

**Was dieses Dokument ist:** der Abgleich der zwei Zielzustände mit dem heutigen Arbeitsweg, das
in diesem Auftrag Gelieferte und die Grenzen. **Was es nicht ist:** eine Erfüllungsbehauptung für
alle Kriterien und kein Nachbau der verworfenen alten Steuerung (Relais-Postfach,
`RUECKGABE-…`/`BEN-PRUEFUNG-…`-Dateien, `kw_naechster_durchgang.py`). Diese Namen bezeichnen nur
die Herkunft.

**Stand Nacharbeit 1.** Bens Befunde zum Kandidaten `678c7cc1` sind eingearbeitet. Grundlage ist
die Quellenführung `QUELLEN-FUEHRUNG-STAMMBLATT-ISTWEG-PIPE-20261014T2320.json` im Auftragsordner
(Stand 2026-10-14T21:48Z). Sie enthält:

- Auszüge aus `intake.py`, `benurteil.py` und `test_intake.py` der Koordination;
- einen Lauf der vorhandenen Intake-Prüfungen;
- die Originaldatei zu JOB 1095;
- den Lauf dieses Werkzeugs gegen den echten Bestand.

Zeilenangaben unten beziehen sich auf diese Fassungen.

| Modul | SHA-256 |
| --- | --- |
| `intake.py` | `3fddf3886ccfdfde2ea21baef7de37f525dae72bd248e0ca98948e3dffb5a30e` |
| `benurteil.py` | `597a3cf693b163831a9f841fc9de230e30b7916dc551415058fbd2ab9622ee38` |
| `test_intake.py` | `adf876d83cd60375d48a9412df0593738ade7dad021ff45604d0925cc6a467b5` |

Die Module liegen außerhalb des Produktbaums und der `allowed_paths` dieses Auftrags. Sie werden
hier gelesen, nicht geändert.

## Heutiger Arbeitsweg, soweit belegt

Die Jobnummer des alten Relais ist heute durch den Auftragsordner `auftrag-<kennung>/` der
Produktionskoordination ersetzt. Die Formate unten sind am Ordner dieses Auftrags gelesen
(Inspektion 14.10.2026). Archiv und Benantwort sind in vorhandenen Dokumenten belegt
(`docs/entscheidungen/gesamt-quellenmanifest.md`, K9; `docs/entscheidungen/pruefdienst-bestandsabgleich.md`, K11).
Das Schema der Benantwort ist inzwischen selbst belegt, siehe K2.

| Datei | Gelesene Felder |
| --- | --- |
| `AUFTRAG.json` | `kennung`, `title`, `base`, `branch`, `commit_title` |
| `AUFTRAG-B1.json` | `id`, `revision`, `title`, `status`, `milestones`, `priority` |
| `auftragsstand.json` | `auftrag.id`, `auftrag.branch`, `fortschritt` (`schritt`, `kandidat`, `naechster_schritt`, `lieferung`) |
| `HISTORIE/nacharbeit-<n>/` | archivierter Durchgang mit `PRUEFUNG/PRUEFUNG.json` und `BEN/ANTWORT.json` |
| Gitverlauf | Betreffe `<commit_title> (Arbeitssicherung)`, `(Hauptstand integriert)`, `(<Fassung>)` – belegt an den Commits `8b9887a4`, `e0e1419d` und `160b09fb` |

**Vergabe der Kennung (belegt).** `intake.py` `prepare` (Z. 241–243) bildet die Kennung als
`'auftrag-' + sha256(task['id'])[:20]`. Branch (`codex/` + Kennung) und `commit_title` (Titel des
Auftrags) entstehen an derselben Stelle. Der Auftragsordner wird aus demselben Hash gebildet
(`intake_once`, Ausschnitt Z. 367–525, dort auch die Punkte 2–3 unter K1).

## Geliefert

- `tools/job-stammblatt.ts`: ein reines Lesewerkzeug ohne Schreib- oder Steuerwirkung.
  Aufruf: `node tools/job-stammblatt.ts <auftraege-wurzel> [--json] [--ref main]`.
  - `stammblattVon`: das Blatt je Auftragsordner.
  - `doppelvergaben`: die Wache.
  - `integrationAus`: liest Integrations- und Fassungscommits aus dem Gitverlauf.
  - `benurteilAus`: liest das Benurteil.
  - Exit 1 bei einer Doppelvergabe, Exit 2 ohne Auftragsordner.
  - **Nacharbeit 1:** Der Direktaufruf setzt den Exitcode jetzt über `process.exitCode`, statt den
    Prozess mit `process.exit` zu beenden (`direktaufruf`). Die Ausgabe läuft vollständig aus.
- `tests/structure/job-stammblatt.test.ts`:
  - Fälle S1–S5, U, I, D1–D4 und B an nachgebauten Ordnern und an einem Gitverlauf.
  - Seit Nacharbeit 1 auch P1–P3: der echte Direktaufruf als Kindprozess über eine Pipe, mit mehr
    als 256 KiB JSON, mit und ohne Doppelvergabe; dazu der Ausschluss von `process.exit` im
    Werkzeug.
- Dieses Dokument.

### K1 · R-1393 — Schlüsselprotokoll gegen doppelte Job-Nummern

- Original: „Ein Protokoll soll verhindern, dass dieselbe Auftragsnummer zweimal vergeben wird.“
  Altbestand `IN_ARBEIT` mit Herkunft JOB 1095 D1/I56. Zu diesem Verweis siehe den
  Quellenwiderspruch unten.
- **Vorhandene Vergabeschutzmechanismen der Koordination (belegt):**
  1. **Abgeleitete Kennung:** Die Kennung ist der SHA-256-Präfix der Auftrags-ID (`prepare`,
     Z. 241). Dieselbe ID ergibt immer dieselbe Kennung, denselben Ordner und denselben Branch.
     Eine zweite Nummer für denselben Auftrag kann so nicht entstehen.
  2. **Schon aufgenommene Aufträge werden übersprungen:** `intake_once` sammelt die IDs aller
     aufgenommenen Aufträge (`known`). Jeder solche Auftrag wird übersprungen
     (`if tid in known: continue`). Nach der Aufnahme kommt die ID sofort in `known`.
  3. **Exklusive Sperre:** Die ganze Aufnahme läuft unter einer exklusiven Dateisperre
     (`lock(config + '.intake.lock')`, `fcntl.flock` `LOCK_EX | LOCK_NB`, Z. 39–42). Zwei
     Aufnahmen können nicht gleichzeitig vergeben.
  4. **Vorbereitung bleibt erhalten:** `once` (Z. 45–51) bricht ab, wenn eine vorhandene
     Vorbereitung abweichenden Inhalt bekäme. Eine vorhandene `AUFTRAG.json` wird
     wiederverwendet, nicht neu angelegt.
  5. **Bereits geliefert:** Ein geliefertes Alt-Laufergebnis führt zu „kein Neubau“.
- **Vier bestandene Prüfungen** (Lauf laut Quellenführung `existing_guard_test_execution`: Exit 0,
  4 Tests, B1 gemockt, temporäre Worktrees, keine Cloud- oder Modellstarts):
  - `test_two_jobs_original_contract_same_lock_and_no_duplicate`: Ein zweiter Aufnahmelauf legt
    nichts an; Konfiguration und Worktree-Aufrufe bleiben byte- bzw. aufrufgleich.
  - `test_foreign_actor_stop_and_existing_dependency_block`
  - `test_source_hash_failure_and_partial_preparation_preserved`
  - `test_generic_waiting_running_and_unknown_still_occupy_slot_and_profile`
- **In diesem Auftrag geliefert:** die Wache `doppelvergaben` im Produktbaum. Sie meldet dieselbe
  Auftrags-ID, Kennung, denselben Branch oder Commit-Titel in mehr als einem Auftragsordner. Ein
  gleicher Commit-Titel macht die Zuordnung der Integrationscommits mehrdeutig und wird deshalb
  mitgemeldet. Am Echtbestand fand sie unter 389 Blättern keine Doppelvergabe (siehe K2,
  Echtbestand).
- **Bewertung: erfüllt am heutigen Weg.** Die Verhinderung leistet die Vergabestelle der
  Koordination; belegt ist sie durch Code und die vier bestandenen Prüfungen. Sie wird nicht
  nachgebaut. Die Wache im Produkt erkennt nachträglich und verhindert nichts. Grenze: Zwei
  *verschiedene* IDs mit gleichem 20-Hex-Präfix (80 Bit) decken die vier Prüfungen nicht ab.
- Durchgangsnummern (R-1287): Die Koordination nummeriert sie heute als `nacharbeit-<n>`. Die
  Wache des Altwerkzeugs wird nicht nachgebaut, siehe K3.

### K2 · R-1492 — Job-Stammblatt je Nummer

- Original: „Zu jeder Jobnummer ein Blatt: Gegenstand, Welle oder Scheibe, Durchgangsgeschichte
  mit Urteilen, Integrations-Commit.“ Altbestand `IDEE` (19.08., „Kein Auftrag“).
- Vorhandener Teil: Laut `docs/entscheidungen/gesamt-quellenmanifest.md` (K9) zeigt das Board der
  Koordination je Auftrag `schritt`, `kandidat`, `blockade`, `naechster_schritt`, `lieferung` und
  `verlauf`. Gegenstand, Durchgänge mit Urteilen und Integrationscommit belegt es nicht gebündelt.
- Heute geliefert, `tools/job-stammblatt.ts`:

  | Teil aus R-1492 | Quelle am heutigen Weg |
  | --- | --- |
  | Gegenstand | `AUFTRAG-B1.json` `title` (sonst `AUFTRAG.json` `title`), dazu `id`, `revision`, `status` |
  | Welle oder Scheibe | `AUFTRAG-B1.json` `milestones` und `priority` |
  | Durchgangsgeschichte mit Urteilen | `HISTORIE/nacharbeit-<n>` numerisch geordnet, danach `aktuell`; je Durchgang Prüfbericht vorhanden ja/nein und Benurteil |
  | Integrations-Commit | Gitverlauf (`--ref`, Vorgabe `main`): exakter Betreff `<commit_title> (Hauptstand integriert)` und `<commit_title> (<Fassung>)` |

- **Benurteil (Schema jetzt belegt):** `benurteil.py` (Z. 1–39) legt `benurteil_v2` fest.
  - Pflichtfeld `urteil` mit den Werten `erfuellt`, `nacharbeit` oder `offen`, bei
    `additionalProperties: false`.
  - Das zweite Aufzählungsfeld `urteilsumfang` trägt nur `originalauftrag` oder
    `technische_vorleistung`.
  - Bei jeder schemagerechten Antwort trägt deshalb genau das Feld `urteil` einen Urteilswert. Die
    Leseregel „genau ein Urteilswert auf oberster Ebene“ liest damit das Feld `urteil`.
  - Am Echtbestand sind so `nacharbeit` und `erfuellt` gelesen worden. Ältere Antworten, die nicht
    schemagerecht sind, ergeben weiter „kein Urteil lesbar“ mit Grund.
- **Echtbestand (belegt, Kandidat `678c7cc1`, Werkzeug SHA-256 `6069b0c0…`):**
  - Aufruf mit `--json --ref main` gegen `PRODUKTION-20261003/auftraege`.
  - **Dateiausgabe:** Exit 0, 2.153.824 Bytes gültiges JSON, 389 Blätter, keine Doppelvergabe
    (SHA-256 `a0fccd92…`).
  - **Stichproben:** Für die Ordner `auftrag-5ac77523…` und `auftrag-faf6aa17…` waren die
    Eingaben unverändert. Die Blätter tragen Gegenstand, Meilensteine, Priorität, Lieferung
    (`1.0.0-beta.1.981` bzw. `1.0.0-beta.1.980`) und die Durchgangsgeschichte. Bei `5ac77523`
    sind das 18 archivierte Durchgänge und der laufende mit `erfuellt`.
- **Verbleibender Fehler am Kandidaten `678c7cc1` — in Nacharbeit 1 behoben, Wirkung noch zu
  belegen:**
  - Über eine Pipe kamen nur 65.536 Bytes an, als ungültiges JSON (`JSONDecodeError` bei Zeichen
    65.199), und das mit Exit 0.
  - Ursache: `process.exit` direkt nach der Ausgabe.
  - Behoben durch `process.exitCode` in `direktaufruf`; abgesichert durch die Fälle P1–P3.
  - Bis der Prüflauf P1–P3 grün meldet, gilt die Pipe-Ausgabe als **nicht belegt**. Der Exit 0
    der alten Pipe-Ausgabe war kein bestandener Lauf.
- **Offene Beobachtung zum Integrations-Commit:**
  - In beiden Stichproben ist `integration` leer (`integriert: []`, `fassungen: []`).
  - Im Verlauf dieses Kandidaten stehen aber `e0e1419d` „Aktive Begleitung … · BPA-Ergänzung
    (Hauptstand integriert)“ und `160b09fb` „… (1.0.0-beta.1.981)“, ebenso `6b154bb4`
    „Kunden- und Pilotbereitschaft … (1.0.0-beta.1.980)“.
  - Naheliegend ist ein veralteter lokaler Verweis `main` im Arbeitsbaum, in dem der Lauf stattfand
    (`--ref main`). **Belegt ist diese Ursache nicht**; dieser Durchgang durfte keinen Gitbefehl
    ausführen.
  - Ein Integrationscommit am Echtbestand ist damit noch **nicht belegt**. Mit `--ref` lässt sich
    der Verweis wählen, an dem gelesen wird.
- Weitere Grenzen:
  - **Welle oder Scheibe** hat im heutigen Weg kein eigenes Feld. `milestones` ist das nächste
    Gegenstück; an diesem Auftrag ist es leer, bei `5ac77523` gefüllt.
  - **Durchgänge** werden nach Ordnernamen geführt und nicht gedeutet, also keine Zuordnung
    „Durchgang n = Nacharbeit n“.
- Bewertung: **teilweise.**
  - Gegenstand, Welle/Scheibe und Durchgänge mit Urteilen sind am Echtbestand belegt.
  - Die vollständige Pipe-Ausgabe hängt an P1–P3.
  - Der Integrations-Commit ist am Echtbestand nicht belegt, siehe oben.

### K3 — Lieferbeleg, Abgrenzung, Widersprüche

- **Tatsächlich geliefert:** Werkzeug, Test und Dokument aus „Geliefert“. Den Lieferbeleg mit
  Fassung erzeugt erst die Veröffentlichung.
- **Historisch abgeschlossen, nicht neu gebaut:**
  - **R-1190** (OFFEN.md-Anker je Auftrag): historisch `ERLEDIGT`. Heute trägt jeder Auftrag
    `id`, `source_id` und `locator` seiner Quelle.
  - **R-1287** (Wache gegen doppelte Durchgangsnummern, `kw_naechster_durchgang.py`): historisch
    `ERLEDIGT`, gehört zur verworfenen Steuerung.
  - **Vergabeschutz der Koordination** (`intake.py`, siehe K1): vorhanden und geprüft, wird nicht
    neu gebaut.
- **Gesonderte Aufträge:**
  - `aufnahme:20260922:gesamt-pruefdienst`, mit der Leseregel für historische Markdown-Berichte
    in `tools/urteilslage.ts`. Sie wird hier nicht benutzt, weil der heutige Weg strukturierte
    Antworten hat.
  - Das Handlungs-Board (R-2015, `docs/entscheidungen/gesamt-quellenmanifest.md`).
  - Die verwandte Kennung R-1999 aus R-1393 liegt nicht in den Quellen dieses Auftrags und wird
    nicht bearbeitet.
- **Quellenwidersprüche:**
  - **JOB 1095 D1/I56 betrifft nicht R-1393.**
    - Das Register gibt für R-1393 als Herkunft
      `MAKROAUFTRAG-PRO-JOB-1095-D1-I56-SCHLUESSELPROTOKOLL-DOPPELTE-JOBNUMMER.md` an
      (SHA-256 `f59e1148…`), dazu den Stand „JOB 1095 zuletzt ROT (D1, BEN2, 17.08.)“.
    - Die Datei selbst ist ein lesender Auftrag zu Befund I56: Sie prüft, ob ein protokollierter
      Klartext-Geheimnisfund auf eine Datei begrenzt bleibt. Um die Verhinderung doppelter
      Auftragsnummern geht es dort nicht. Nur der Dateiname nennt „doppelte Jobnummer“.
    - Der rote Stand von JOB 1095 sagt daher nichts über R-1393. Der Geheimnisfund ist ein eigener
      Umfang und gehört nicht zu diesem Auftrag. Eine Geheimnissuche, Rotation oder Kopie gibt es
      hier nicht.
    - Als Beleg für einen realen Doppelnummer-Fall bleibt nur der Registervermerk zur `GRUND.txt`
      vom 28.08. (JOB 2617), ohne vorliegende Datei.
  - R-1190 und R-1287 stehen im Altbestand als `ERLEDIGT`, im Register aber als `angedacht` mit
    `pruefstatus: nur_altquelle`. Maßgeblich ist hier nur die historische Einordnung.
  - R-1492 heißt am 19.08. „Kein Auftrag“, die Aufnahme vom 22.09. führt es als Zielzustand. Die
    jüngere Aufnahme gilt.
  - R-1393 sagt im Titel „Job-Nummern“, im Satz „Auftragsnummer“. Beides ist heute auf die
    Auftragskennung bezogen.
  - Das Feld `user_value` in `AUFTRAG-B1.json` zitiert Pedis Satz zu R-1190 (OFFEN.md-Anker), nicht
    den Nutzen von R-1393 oder R-1492.
- **Fehlende Belege:**
  - Die `GRUND.txt` vom 28.08. und `kw_naechster_durchgang.py` liegen nur als Altquellenverweis
    vor.
  - Noch nicht belegt ist die vollständige Pipe-Ausgabe nach der Korrektur (P1–P3 im Prüflauf).
  - Noch nicht belegt ist ein Integrations-Commit am Echtbestand (siehe K2).
  - **Überholt seit Nacharbeit 1:** Vergabestelle und Benschema sind nicht mehr unbelegt; die
    Echtbestandsausgabe liegt als Dateiausgabe vor.
