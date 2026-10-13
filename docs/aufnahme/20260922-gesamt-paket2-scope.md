# Aufnahme 20260922 · Paket 2 — historischer Gegenstand und Umfang (Klärungsakte)

Auftrag `aufnahme:20260922:gesamt-paket2-scope` („Historischen Gegenstand und Umfang von Paket 2
klären“), 13.10.2026. Lauf 1 auf Basis `06468f05` (`1.0.0-beta.1.953`), Nacharbeit 1 am
Kandidaten `cff86cce` (`1.0.0-beta.1.955`). Die Fassung, in der diese Akte ausgeliefert wird, steht
erst nach der Veröffentlichung fest.

Quelle des Anliegens: `QUELLEN.json` des Auftrags, einziger Punkt **R-1395** (Alias F-1395).

**Ergebnis in einem Satz:** „Paket 2“ in R-1395 ist das **Integrationspaket 2 (MEGA87–88:
Auswahlstabilität und Bildanker)**. Sein Inhalt steht seit dem Sammel-Commit `7bc79b10e` vom
10.08.2026 im Hauptstand, ohne dass ein grünes Ben-Urteil für mega87 oder mega88 zugeordnet ist.
Die übrigen „Paket 2“ im Bestand sind namensgleich und nicht Gegenstand von R-1395.

**Korrektur gegenüber Lauf 1.** Lauf 1 hielt den Gegenstand für unbestimmbar und bot die Wahl A–G
an. Dafür gab es keine Grundlage: Die Auftragsdatei von JOB 534 benennt den Gegenstand eindeutig
(Bens Befund, nacharbeit-1). Die Wahl A–G und die Empfehlung „F oder G“ sind zurückgezogen.

## Quellenlage

- **Gelesen:** `QUELLEN.json`; `OFFEN.md` (Zeilen A29, A31, I45 und der überholte Kopf vom
  01.08.2026); `docs/entscheidungen/bildidentitaet.md`; `docs/bestandsaufnahme-bildbeschreibung-ki.md`;
  Testköpfe der unten genannten Dateien; Git-Verlauf des Produktbaums (`git log`, `git show`).
- **Nicht selbst gelesen:**
  `Projekt_klarwerk/03_AUFTRAEGE/archiv_stale/verbraucht_20260810/MAKROAUFTRAG-PRO-JOB-534-D1-PAKET2-SCOPEANALYSE.md`
  und `Projekt_klarwerk/00_CONTROL/INTEGRATIONSPAKETE-ARBEITSBAUM-20260810.md`. Beide liegen außerhalb
  des Bereichs, der für die Bearbeitung freigegeben ist; der Lesezugriff wurde technisch abgewiesen.
  Ben hat beide gelesen. Gegenstand und Zahl der Testdateien stehen hier **nach Bens Wiedergabe**
  (Benurteil nacharbeit-1): Abschnitt „Ergebnis und Nutzen“ der Auftragsdatei,
  `INTEGRATIONSPAKETE-ARBEITSBAUM-20260810.md:73`, „alle sechs dort genannten Testdateien existieren
  im aktuellen Arbeitsbaum“. Die Dateiliste unten ist **mein Abgleich** über die Namen mega87/mega88.
  Dass sie mit den sechs Dateien des Originals übereinstimmt, ist nicht selbst geprüft.
- **Historische Ausführungsanweisungen** aus JOB 534 werden nicht reaktiviert. Die damalige
  Steuerung (Bahnen, Makroaufträge) ist verworfen. Bereich „Maschine“ und Kategorie
  „KLARWERK-intern“ in R-1395 beziehen sich auf diese Paketierung des Arbeitsbaums. Der Inhalt des
  Pakets ist Produktcode.

## Originalpunkt R-1395 (wörtlich, mit Herkunft)

| Feld | Inhalt |
|---|---|
| Name | „Scopeanalyse Paket 2“ |
| Anforderung | „Abgrenzung, was zu Paket 2 gehoert und was nicht.“ |
| Bereich / Kategorie | „Maschine“ / „KLARWERK-intern“, `kundenrelevant: false` |
| Zustand / Prüfstatus | `angedacht` / `nur_altquelle`; Aufnahmezustand `klaerung` |
| Altbestand | F-1395, Status `IN_ARBEIT`, Begründung „Begruendung nicht dokumentiert“ |
| Herkunft | `03_AUFTRAEGE/archiv_stale/verbraucht_20260810/MAKROAUFTRAG-PRO-JOB-534-D1-PAKET2-SCOPEANALYSE.md`, 10.08.2026 |
| Damaliger Beleg | „JOB 534, kein BEN-Urteil; Auftragsdatei liegt in verbraucht_20260810.“ |
| Quell-Kennungen | `JOB 534`, `PAKET2-SCOPEANALYSE` |
| Entscheidungen | keine (`entscheidung: null`, `entscheidungen: []`, `pedi_override: null`) |
| Hinweis | „Altbestand: Einordnung offen. Der damalige Zustand ist kein aktueller Funktionsnachweis.“ |

## Gegenstand: Integrationspaket 2 = mega87 + mega88

Herkunft der Inhalte laut `OFFEN.md` A31 (Zeile 128) und A29 (Zeile 130):

- **mega87 — Auswahlstabilität.** Ein einziger Block: Die Auswahl in der Bildunterschrift wird vor
  dem Fokuswechsel gesichert (Maus und Tastatur) und vor dem nativen Befehl wiederhergestellt. Ob
  formatiert wurde, entscheidet die gemessene Wirkung, nicht der Rückgabewert von `execCommand`.
- **mega88 — Bildanker.** Der Anker eines Bildes entstand nur auf einem Weg (A31). Fünf Blöcke:
  A alle Bildwege erheben, je Weg ein Urteil · B die Invariante an einer Stelle, die alle Wege
  durchlaufen · C Altbestand · D Sanitizer beidseitig · E produktnaher Beleg samt Sammler und
  Gegenmutationen.

| Paket | Datei im heutigen Bestand | Art | In den Hauptstand gekommen |
|---|---|---|---|
| mega87 | `tests/capture/mega87-auswahl-ueberlebt-klick-mounted.test.tsx` | jsdom, gemountet | `7bc79b10e` (10.08.2026) |
| mega87 | `tests-smoke/mega87-caption-formatierung-browser.spec.ts` | Browser-Smoke | `7bc79b10e` (10.08.2026) |
| mega88 | `tests/app/mega88-bildanker-sammler.test.tsx` | Sammler (Block E) | `7bc79b10e` (10.08.2026) |
| mega88 | `tests/capture/mega88-bildstruktur-invariante.test.ts` | Unit | `7bc79b10e` (10.08.2026) |
| mega88 | `tests/capture/mega88-bildweg-anker-mounted.test.tsx` | jsdom, gemountet | `7bc79b10e` (10.08.2026) |
| mega88 | `tests-smoke/mega88-bildanker-browser.spec.ts` | Browser-Smoke | `7bc79b10e` (10.08.2026) |

### Lieferstand mit Fassung und Beleg

| Schritt | Datum | Beleg | Aussage |
|---|---|---|---|
| mega87 geliefert | vor 01.08.2026 | `OFFEN.md` A29: Bericht 213 Zeilen, Diff `patches196` | Lieferung der Bahn, nicht integriert |
| Ben sammel87 | vor 01.08.2026 | `OFFEN.md` A29 | **ROT**: „der Formatierfehler ist behoben, die Auslieferung hängt an A31“ |
| Hash-Befund I45 | vor 01.08.2026 | `OFFEN.md` I45 | Der Diff-Hash in der Schlusszeile von `BERICHT-mega87.md` war falsch; der Inhalts-Hash stimmte |
| mega88 geliefert | vor 01.08.2026 | `OFFEN.md` A29: Bericht 390 Zeilen, Diff `patches197` | Lieferung der Bahn, nicht integriert |
| Ben sammel88 | vor 01.08.2026 | `OFFEN.md` A29 | **ROT**: „der Blocker ist Datenintegrität“; der nackte Einzelbildweg galt als geschlossen |
| Folgekette | bis 01.08.2026 | `OFFEN.md` A29, Kopf vom 01.08. | mega89, mega90 und huelle bis huelle4 setzen am mega88-Stand an. Ben sammel89, 92, 96 und 99: jeweils ROT; Ship 12 blockiert. Kein grünes Urteil zu mega87/88 zugeordnet |
| Paketierung (JOB 534) | 10.08.2026 | R-1395, laut Ben `INTEGRATIONSPAKETE-ARBEITSBAUM-20260810.md:73` | Scopeanalyse für Integrationspaket 2 beauftragt. Kein BEN-Urteil; die Rückgabe wurde am genannten Pfad nicht gefunden (Ben) |
| Einzug in den Hauptstand | 10.08.2026 20:51 | `7bc79b10e` „Bestand: Arbeitsstand der Bahnen 31.07.-10.08.2026“ | mega84 bis mega90 und huelle bis huelle4 **zusammen**, nicht als getrenntes Paket 2. Laut Commit-Nachricht „ein gruener Stand“ ausdrücklich nicht |
| Folgecommit | 10.08.2026 20:52 | `90ec5e0bf` „W2-A/148: Laufdomaene angeschlossen …“ | Laut Nachricht von `7bc79b10e`: „Beide zusammen sind gruen (6929/6929, tsc 0)“. Selbstauskunft, keine Ben-Abnahme |
| Nachbesserung mega87 | 27.09.2026 | `0c2aac0db`, `21165ed52`; `tests/mega87-tastaturweg/modal-meldet-sich-einmal-an-mounted.test.tsx` | Der Tastaturweg aus dem mega87-Smoke war rot; Ursache in `Modal.tsx` behoben |
| Jüngerer Bestandsabgleich mega88 | 29.09. bis 01.10.2026 | `docs/entscheidungen/bildidentitaet.md` (gesonderter Auftrag `gesamt-bildidentitaet`) | R-0010 und R-1604 „erfüllt (Bestand)“ mit den mega88-Tests; der Browser-Smoke dort „nicht wiederholt“ |

### Abgrenzung: was zu Paket 2 gehört und was nicht

- **Gehört dazu:** mega87 (Auswahl in der Bildunterschrift übersteht den Klick, Wirkung entscheidet)
  und mega88 (Bildanker auf allen Bildwegen, Blöcke A–E), mit den sechs Testdateien oben.
- **Nachgelagert, nicht Paketinhalt vom 10.08.:** die mega87-Nachbesserung vom 27.09.2026 (`0c2aac0db`).
  Sie behebt einen Fehler am Paketinhalt.
- **Gehört nicht dazu, mit demselben Commit eingezogen:** mega84 bis mega86 (Vorgänger),
  mega89 (Mehrbild, Paarung), mega90 (Kennung vor Reihenfolge) und huelle bis huelle4 (Ship-12-Fixe).
- **Gesondert geführt:** `aufnahme:20260922:gesamt-bildidentitaet` mit ihren ausgelagerten Teilen,
  etwa `…:belege-browser-word-screenreader`, das unter anderem den Browserbeleg für Bilddateien aus
  der Zwischenablage trägt. Bildanker im Word-Gesamtweg: `docs/operations/word-host-gesamtweg-abgleich.md`
  (R-0048, R-1815, R-1886 „teilweise“). Diese Akte baut und prüft dort nichts.

## Namensgleiche „Paket 2“ im Bestand (nicht Gegenstand von R-1395)

Lauf 1 hat diese Treffer als Kandidaten geführt. Keiner nennt JOB 534 oder eine Scopeanalyse. Sie
stehen hier nur, damit sie nicht verwechselt werden. Belegt ist **nur der Quellbestand**: Datei
und Vermerk sind vorhanden. Eine Lieferfassung oder ein Abschlussbeleg ist in dieser Akte nicht
zugeordnet. Ob sie geliefert und abgenommen sind, sagt diese Akte nicht.

| Alt. | Programm | Gegenstand laut Quellvermerk | Herkunft laut Kommentar | Fundstellen (Auszug) | vorhandene Tests | Weitere Pakete desselben Programms |
|---|---|---|---|---|---|---|
| A | `D-AISTATE` | „Reasoner aktiv“ nur bei echter Erreichbarkeit; Achse 1 „Extern“ als eigene Anzeige; KI beurteilt jeden deterministischen Kandidaten zusätzlich | Pedi 23.07., „bens V2/V3“ | `apps/web/src/lib/reasonerReachability.ts`, `apps/web/src/lib/externalStagePill.ts`, `apps/web/src/shell/StatusZeilen.tsx`, `services/conflicts/src/overlap-service.ts` | `tests/reasoner/reasoner-reachability.test.ts`, `tests/reasoner/aistate-availability.test.ts` | 1, 3, 4 |
| B | `WP-SHIP9-S2` | Import-UX D2–D7: Suche, Filter, Gruppen und Auswahl der Trefferliste; B1 Auswahlkarten | keine Datumsangabe | `apps/web/src/lib/importSelectView.ts`, `apps/web/src/components/ChoiceCards.tsx`, `apps/web/src/components/ImportSelect.tsx` | `tests/app/import-select-view.test.ts`, `tests/app/import-ux-b1-d6.test.tsx` | 3, 4 |
| C | `uxpol1` | gemeinsames Dateityp-Kachel-Bauteil für Erfassen und Import, Quellen-Galerie | keine Datumsangabe | `apps/web/src/components/FileTypePicker.tsx`, `apps/web/src/components/ImportSourceGallery.tsx` | `tests/app/file-type-picker-mounted.test.tsx` | keine gefunden |
| D | `klara1` | Word-Add-in: Bearbeitungsstatus und Deep-Links der Antwortquellen (K2/K3) | keine Datumsangabe | `apps/web/src/lib/wordAddin.ts` | `tests/app/word-addin.test.ts` | keine gefunden |
| E | `nacht24` | SCRUM-506: Bibliotheks-Export durchsetzt dieselbe Lese-Policy wie das normale Lesen | keine Datumsangabe | — | `tests/security/library-export-egress.test.ts` | 3, 5, 6 |

„JOB 534“, „Scopeanalyse“, „F-1395“ und „R-1395“ kommen in `apps/`, `services/` und `docs/` außer
in dieser Akte nicht vor. Der Gegenstand ist im Produktbaum nur über die Namen mega87/mega88
auffindbar.

## Verbleibende Umfangsfrage

Eine Produktentscheidung ist für die Abgrenzung nicht mehr nötig: Der Gegenstand ist benannt, sein
Inhalt ist im Hauptstand. Offen bleibt nur:

- **Paketgrenze am Original bestätigen.** Ob die sechs Dateien oben genau die sechs der
  Paketliste (`INTEGRATIONSPAKETE-ARBEITSBAUM-20260810.md:73`) sind und ob dort weitere Produktdateien
  zu Paket 2 gezählt werden, kann nur jemand mit Lesezugriff auf die Originale bestätigen (Ben).

Daraus folgt keine Umsetzung. Dieser Lauf baut nichts an mega87 oder mega88.

## Quellenwidersprüche und fehlende Belege

1. **Zustand:** R-1395 steht auf `angedacht`, F-1395 auf `IN_ARBEIT`, die Auftragsdatei unter
   `verbraucht_20260810`. Inhaltlich ist die Paketierung durch den Sammel-Commit `7bc79b10e` vom
   selben Abend überholt: Paket 2 wurde nicht getrennt integriert.
2. **„Alte Pedi-Auswahl“:** Der Hinweis kündigt eine historische Pedi-Entscheidung „unten“ an. Im
   Punkt steht keine (`entscheidungen: []`, `pedi_override: null`, `override_am: null`).
3. **Kein grünes Ben-Urteil:** sammel87 und sammel88 sind ROT, die Folgeurteile bis sammel99 ebenfalls.
   Ein Abschlussbeleg für mega87/88 als Paket fehlt. Der Hauptstand trägt den Inhalt trotzdem seit
   10.08.2026; die Grün-Aussage dazu ist eine Selbstauskunft in der Commit-Nachricht.
4. **Rückgabe von JOB 534:** am in der Auftragsdatei genannten Pfad nicht gefunden (Ben). Daraus folgt
   nicht, dass der Auftrag nie bearbeitet wurde.
5. **Originaldateien:** Auftragsdatei und Paketliste liegen außerhalb des Auftrags. Gegenstand und
   Dateizahl stehen hier nach Bens Wiedergabe.
6. **Heutiger Funktionsstand:** Die sechs Tests oben wurden in diesem Auftrag nicht ausgeführt. Der
   jüngste zugeordnete Abgleich für mega88 ist der gesonderte Auftrag `gesamt-bildidentitaet` (Stand
   01.10.2026); für mega87 ist keiner zugeordnet. Ihre Nennung bestellt keinen Prüflauf.

## Geliefert in diesem Auftrag

- Diese Akte, `docs/aufnahme/20260922-gesamt-paket2-scope.md`.
- `tests/aufnahme-paket2-scope/zuordnung.test.ts` hält die Akte am Bestand fest:
  - **Z1:** Jede Datei der Paket-2-Tabelle existiert und trägt ihre Paketkennung.
  - **Z2:** Jede Datei der namensgleichen Tabelle existiert und trägt Programmkennung und „Paket 2“.
  - **Z3:** „JOB 534“, „Scopeanalyse“, „F-1395“ und „R-1395“ stehen in `apps/`, `services/` und
    `docs/` nur in dieser Akte.
  - **Z4:** Die Akte nennt MEGA87–88 als Gegenstand, führt A–E nur als Quellbestand und bietet
    keine Wahl A–G mehr an.
