# R-1235 „Faeule-Werkzeug": Gegenstand, Wirkung und offene Einordnung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-faeulewerkzeug`, Revision 1, Lauf 1 auf Basis
`06468f05` (`1.0.0-beta.1.953`). Zugeordnet: **R-1235** (alias F-1235), einziger Originalpunkt.
Abgleich am 13.10.2026. Die festgehaltene Fassung erzeugt der Starter nach dem Lauf; der echte
Lieferbeleg (Deployment, Livefassung) entsteht erst nach der Veröffentlichung.*

Diese Datei klärt, **was** über das Werkzeug belegt ist, **was** es heute im Produkt bewirkt und
**welche** Einordnung noch entschieden werden muss. Sie baut nichts und ersetzt keine Entscheidung.

## 1. Was die Quelle belegt — und was nicht

Wortlaut der einzigen Herkunft (Registerzeile R-1235, Altquelle `FUNKTIONSREGISTER.json:28369`,
Datum 11.08.2026):

> „In Betrieb: CLAUDE.md fuehrt kw_faeule.py unter „GEBAUT UND IN BETRIEB". Sein Gegenstand ist in
> den ausgewerteten Quellen nicht weiter beschrieben."

| Angabe | Wert in der Quelle | Bedeutung |
| --- | --- | --- |
| Name / Satz | „Faeule-Werkzeug" — „Ein Werkzeug spuert verfaulende Bestaende im Betrieb auf." | Der Satz ist eine **Deutung des Dateinamens**; die Herkunft sagt ausdrücklich, dass der Gegenstand nicht beschrieben ist. |
| Bereich / Kategorie | `Maschine` / `KLARWERK-intern`, `kundenrelevant: false` | ein internes Werkzeug der damaligen Arbeitssteuerung, kein Kundenmerkmal |
| Altstatus | `ERLEDIGT`, Begründung „nicht dokumentiert" | historische Aussage; kein heutiger Funktionsnachweis |
| Heutiger Stand im Register | `zustand: angedacht`, `pruefstatus: nur_altquelle`, `state: klaerung` | ungeklärt |
| Entscheidungen | `entscheidung: null`, `entscheidungen: []`, `pedi_override: null` | **keine** Nutzerentscheidung zu R-1235 |

Das Präfix `kw_` gehört zu den Skripten der alten Steuerung im damaligen Projektverzeichnis
(`00_CONTROL`): `kw_pruefer.py` (Maschinenurteil, s. `tools/urteilslage.ts`) und
`kw_nachtwache.py` (launchd-Dienst, `OFFEN.md`). Diese Steuerungsarchitektur ist verworfen; der
Auftrag verbietet ihren Wiederaufbau.

## 2. Abgleich mit dem heutigen Bestand (Basis `06468f05`)

- **Kein `kw_faeule.py` im Produkt.** Weder unter `services/`, `apps/web/src/`, `tools/` und
  `scripts/` noch in `CLAUDE.md` oder `AGENTS.md` kommt der Name vor (festgehalten in
  `tests/faeulewerkzeug/r1235-einordnung.test.ts`, Fall A). Die Liste „GEBAUT UND IN BETRIEB", in
  der das Register ihn fand, steht im heutigen `CLAUDE.md` nicht mehr.
- **Wirkung im heutigen Produkt: keine eigene.** Es gibt keinen Lauf-, Dienst- oder Bedienweg, der
  zu diesem Werkzeug gehört. Was es 2026-08 tatsächlich tat, lässt sich aus dem Produktbaum nicht
  feststellen (s. Abschnitt 5).
- Inhaltlich **verwandte** Produktfunktionen bestehen bereits — mit eigener Herkunft und eigenen
  Aufträgen, nicht als Nachfolger von `kw_faeule.py` belegt:

| Lesart „verfaulende Bestände" | Vorhanden im Bestand | Zugehörigkeit |
| --- | --- | --- |
| **Veraltendes Wissen** (Objekte, deren Stand nicht mehr bestätigt ist) | Frische-Stufen `frisch / altert / faellig / veraltet`, Haltbarkeit und Halbwertszeit je Kategorie (`services/knowledge-object/src/frische.ts`), Erinnerung, Mahnung und Wochenvorlage an die verantwortliche Person in der Glocke (`services/app/src/frische-meldungen.ts`), Reiter „Erneut" (`apps/web/src/pages/Lifecycle.tsx`, `apps/web/src/lib/frische.ts`); Tests unter `tests/wissen-frische/` | gesonderter Auftrag `aufnahme:20260922:gesamt-wissen-frische` (R-0207, R-0236, R-0248, R-0266, R-0652, R-1636, FR-EXT-06). Dessen Erfüllungsstand wird **hier nicht** bewertet. |
| **Still beschädigte Sicherungen** (Bitfäule, halbe Kopien) | Paarprüfung vor dem Ausdünnen alter Sicherungen (`scripts/backup/backup.sh`, `paar_ist_heil`), Wiederherstellungsprobe (`scripts/backup/restore-drill.sh`); Lastprobe `tests/sicherung-dauerbetrieb/lauf.ts` | Betrieb/Sicherung; nicht diesem Auftrag zugeordnet |
| **Liegengebliebene Arbeits- oder Prüfstände** der Entwicklungssteuerung | im Produkt nichts; gehört zur verworfenen alten Steuerung | nicht wiederaufbauen |

## 3. Offene Geltungs-/Umfangsfrage (K1)

**Frage:** Was ist R-1235 heute — und folgt daraus überhaupt Produktumfang?

| Alternative | Inhalt | Folge |
| --- | --- | --- |
| **A · Altbestand der alten Steuerung** | `kw_faeule.py` war ein internes Werkzeug der verworfenen Steuerung. | R-1235 als erledigte/obsolete Herkunft schließen; kein Produktumfang. |
| **B · Produktfunktion „veraltetes Wissen aufspüren"** | Die Lesart des Registersatzes trifft auf Wissensobjekte. | Bereits durch den Bestand aus Abschnitt 2 abgedeckt und dem Auftrag `gesamt-wissen-frische` zugeordnet; R-1235 dort als verwandt vermerken, hier nichts bauen. |
| **C · Betriebsfunktion „verfaulte Sicherungen erkennen"** | Lesart „Bestände" = gesicherte Daten. | Bestand in `scripts/backup/`; R-1235 dort als verwandt vermerken. |
| **D · Eigenes neues Werkzeug** | Ein darüber hinausgehender Fäule-Bericht (welcher Bestand, welche Schwelle, wer liest ihn). | Nur mit einer **neuen, ausdrücklichen** Anforderung; heute in keiner Quelle beschrieben. |

**Jüngste Belege:** Registerzeile R-1235, `aktualisiert` 05.09.2026, Prüfstatus `nur_altquelle`;
Altquelle vom 11.08.2026; keine jüngere Entscheidung, kein Erledigungsbeleg.

**Noch erforderlich:** eine Entscheidung des Nutzers (Pedi) zwischen A–D — oder die Vorlage des
alten Skripts, aus dem sich der Gegenstand belegen lässt.

**Eindeutig bestellt und umgesetzt** ist daraus nur die Klärung selbst (diese Datei und ihre
Fundstellenprobe). Es wurde **kein** Produktcode geändert, nichts aus der alten Steuerung
übernommen und kein bestehender Weg umgedeutet.

## 4. Gelieferter Stand und Abgrenzung (K3)

| Anliegen | Ergebnis in diesem Lauf | Beleg | Rest |
| --- | --- | --- | --- |
| R-1235 Gegenstand und Wirkung klären | diese Datei | `tests/faeulewerkzeug/r1235-einordnung.test.ts` (Fundstellen Z/F, Abwesenheit A) | Entscheidung A–D (Abschnitt 3) |
| Frische veraltenden Wissens | **nicht** Teil dieser Lieferung | eigener Auftrag `gesamt-wissen-frische` | — |
| Sicherungsprüfung | **nicht** Teil dieser Lieferung | Bestand `scripts/backup/` | — |

Fassung und Lieferbeleg dieses Laufs entstehen erst mit der Veröffentlichung; eine Erfüllung von
R-1235 wird hier nicht behauptet.

## 5. Quellenwidersprüche und fehlende Belege

1. **Hinweistext gegen Datensatz:** Der Hinweis sagt „Auch eine alte Pedi-Auswahl bleibt unten als
   historische Entscheidung erhalten" — der Datensatz trägt aber `pedi_override: null`,
   `override_am: null` und keine Entscheidung. Eine Pedi-Auswahl zu R-1235 ist **nicht vorhanden**;
   der Satz ist offenbar ein Sammelhinweis aller Altbestandszeilen.
2. **„ERLEDIGT" gegen „angedacht":** Der Altstatus `ERLEDIGT` (11.08.) und der heutige Zustand
   `angedacht` / `klaerung` widersprechen sich; der Altstatus stützt sich nur auf die Listung in
   einer damaligen `CLAUDE.md`, nicht auf einen Funktionsbeleg.
3. **Satz gegen Herkunft:** Der Registersatz beschreibt einen Gegenstand („verfaulende Bestände"),
   den die Herkunft ausdrücklich als „nicht weiter beschrieben" bezeichnet.
4. **„im Betrieb" mehrdeutig:** Kundenbetrieb (Wissen, Sicherungen) oder Entwicklungsbetrieb der
   alten Steuerung — die Quelle unterscheidet nicht.
5. **Fehlende Belege:** Inhalt von `kw_faeule.py`, die damalige `CLAUDE.md` und die Registerzeile
   `FUNKTIONSREGISTER.json:28369` liegen außerhalb des Produktbaums und wurden **nicht gelesen**
   (außerhalb des erlaubten Arbeitsbereichs). Der Altbeleg trägt keine Zeitangabe (`zeit: null`).
