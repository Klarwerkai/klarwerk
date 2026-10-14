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

## Heutiger Arbeitsweg, soweit belegt

Die Jobnummer des alten Relais ist heute durch den Auftragsordner `auftrag-<kennung>/` der
Produktionskoordination ersetzt. Die Formate unten sind am Ordner dieses Auftrags gelesen
(Inspektion 14.10.2026). Archiv und Benantwort sind in vorhandenen Dokumenten belegt
(`docs/entscheidungen/gesamt-quellenmanifest.md`, K9; `docs/entscheidungen/pruefdienst-bestandsabgleich.md`, K11).

| Datei | Gelesene Felder |
| --- | --- |
| `AUFTRAG.json` | `kennung`, `title`, `base`, `branch`, `commit_title` |
| `AUFTRAG-B1.json` | `id`, `revision`, `title`, `status`, `milestones`, `priority` |
| `auftragsstand.json` | `auftrag.id`, `auftrag.branch`, `fortschritt` (`schritt`, `kandidat`, `naechster_schritt`, `lieferung`) |
| `HISTORIE/nacharbeit-<n>/` | archivierter Durchgang mit `PRUEFUNG/PRUEFUNG.json` und `BEN/ANTWORT.json` |
| Gitverlauf | Betreffe `<commit_title> (Arbeitssicherung)`, `(Hauptstand integriert)`, `(<Fassung>)` – belegt an den Commits `8b9887a4`, `e0e1419d` und `160b09fb` |

Kennungen vergibt die Koordination (Intake). Ihr Code liegt außerhalb des Produktbaums und
außerhalb der `allowed_paths` dieses Auftrags. Der Lesebereich dieses Laufs umfasst ihn nicht.

## Geliefert

- `tools/job-stammblatt.ts`: ein reines Lesewerkzeug ohne Schreib- oder Steuerwirkung.
  Aufruf: `node tools/job-stammblatt.ts <auftraege-wurzel> [--json] [--ref main]`.
  - `stammblattVon`: das Blatt je Auftragsordner.
  - `doppelvergaben`: die Wache.
  - `integrationAus`: liest Integrations- und Fassungscommits aus dem Gitverlauf.
  - `benurteilAus`: liest das Benurteil.
  - Exit 1 bei einer Doppelvergabe, Exit 2 ohne Auftragsordner.
- `tests/structure/job-stammblatt.test.ts`: Fälle S1–S5, U, I, D1–D4 und B an nachgebauten Ordnern
  und an einem Gitverlauf.
- Dieses Dokument.

### K1 · R-1393 — Schlüsselprotokoll gegen doppelte Job-Nummern

- Original: „Ein Protokoll soll verhindern, dass dieselbe Auftragsnummer zweimal vergeben wird.“
  Altbestand `IN_ARBEIT`: JOB 1095 zuletzt ROT (D1, 17.08.), die Auftragsdatei lag in `blockiert`.
  Belegt ist ein realer Doppelnummer-Fall in einer `GRUND.txt` vom 28.08.
- Heute geliefert: Die Wache `doppelvergaben` meldet dieselbe Auftrags-ID, Kennung, denselben
  Branch oder Commit-Titel in mehr als einem Auftragsordner. Ein gleicher Commit-Titel macht die
  Zuordnung der Integrationscommits mehrdeutig und wird deshalb mitgemeldet. Zusätzlich stehen am
  Blatt Widersprüche innerhalb eines Ordners: Ordnername ≠ Kennung oder `auftragsstand.json` ≠
  `AUFTRAG-B1.json`.
- Bewertung: **teilweise.** Geliefert ist die Erkennung im Bestand. Ob die Vergabe selbst eine
  Doppelvergabe verhindert, ist **nicht belegt**: Die Vergabestelle liegt in der Koordination,
  außerhalb des Lesebereichs und der `allowed_paths` dieses Auftrags. Die Form der Kennung
  (`auftrag-` plus 20 Hexzeichen) legt eine abgeleitete Kennung nahe, belegt sie aber nicht.
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

- Grenzen:
  - **Benurteil:** Der Feldname im Schema `benurteil_v2` liegt außerhalb des Lesebereichs. Ein
    Urteil gilt deshalb nur, wenn genau ein Feld der obersten Ebene `erfuellt`, `nacharbeit` oder
    `offen` trägt. Sonst steht am Blatt „kein Urteil lesbar“ mit Grund; geraten wird nie.
  - **Welle oder Scheibe** hat im heutigen Weg kein eigenes Feld. `milestones` ist das nächste
    Gegenstück; an diesem Auftrag ist es leer.
  - **Durchgänge** werden nach Ordnernamen geführt und nicht gedeutet, also keine Zuordnung
    „Durchgang n = Nacharbeit n“.
  - **Echter Bestand:** Dieser Lauf durfte keine Befehle ausführen. Ein Lauf gegen die echten
    Auftragsordner liegt daher nicht vor, belegt sind nur die nachgebauten Fälle im Test.
- Bewertung: **erfüllt für die vier Teile am heutigen Weg, mit den genannten Grenzen.** Offen ist
  ein Lauf gegen den echten Bestand.

### K3 — Lieferbeleg, Abgrenzung, Widersprüche

- **Tatsächlich geliefert:** Werkzeug, Test und Dokument aus „Geliefert“. Den Lieferbeleg mit
  Fassung erzeugt erst die Veröffentlichung.
- **Historisch abgeschlossen, nicht neu gebaut:**
  - **R-1190** (OFFEN.md-Anker je Auftrag): historisch `ERLEDIGT`. Heute trägt jeder Auftrag
    `id`, `source_id` und `locator` seiner Quelle.
  - **R-1287** (Wache gegen doppelte Durchgangsnummern, `kw_naechster_durchgang.py`): historisch
    `ERLEDIGT`, gehört zur verworfenen Steuerung.
- **Gesonderte Aufträge:**
  - `aufnahme:20260922:gesamt-pruefdienst`, mit der Leseregel für historische Markdown-Berichte
    in `tools/urteilslage.ts`. Sie wird hier nicht benutzt, weil der heutige Weg strukturierte
    Antworten hat.
  - Das Handlungs-Board (R-2015, `docs/entscheidungen/gesamt-quellenmanifest.md`).
  - Die verwandte Kennung R-1999 aus R-1393 liegt nicht in den Quellen dieses Auftrags und wird
    nicht bearbeitet.
- **Quellenwidersprüche:**
  - R-1190 und R-1287 stehen im Altbestand als `ERLEDIGT`, im Register aber als `angedacht` mit
    `pruefstatus: nur_altquelle`. Maßgeblich ist hier nur die historische Einordnung.
  - R-1492 heißt am 19.08. „Kein Auftrag“, die Aufnahme vom 22.09. führt es als Zielzustand. Die
    jüngere Aufnahme gilt.
  - R-1393 sagt im Titel „Job-Nummern“, im Satz „Auftragsnummer“. Beides ist heute auf die
    Auftragskennung bezogen.
  - Das Feld `user_value` in `AUFTRAG-B1.json` zitiert Pedis Satz zu R-1190 (OFFEN.md-Anker), nicht
    den Nutzen von R-1393 oder R-1492.
- **Fehlende Belege:**
  - `GRUND.txt` vom 28.08., die Auftragsdatei zu JOB 1095 und `kw_naechster_durchgang.py` liegen
    nur als Altquellenverweis vor.
  - Die Vergabestelle der heutigen Kennungen und das Schema `benurteil_v2` waren nicht lesbar.
