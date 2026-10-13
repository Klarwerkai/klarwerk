# Aufnahme 20260922 · Quellen zu den Kernfragen: Zuordnung geliefert / vorhanden / offen

Auftrag `aufnahme:20260922:gesamt-quellen-kernfragen` („Kernfragen des Projekts mit Quellen und
benannten Lücken belegen“), Lauf 1 vom 13.10.2026 mit Nacharbeit 1. Basis `550807b9`
(`1.0.0-beta.1.954`). Die Fassung, in der dieser Lauf ausgeliefert wird, steht erst nach der
Veröffentlichung fest. Bis dahin ist „dieser Lauf“ der Kandidat auf dieser Basis.

Quelle des Anliegens: `QUELLEN.json` des Auftrags, einziger Punkt **R-1384** „Quellenmatrix zu den
fünf Kernfragen“ (Altkennung F-1384). Der Punkt verlangt: „Für die fünf Kernfragen des Hauses ist
erhoben, welche Quelle sie jeweils beantwortet und wo Belege fehlen. Die Lücken stehen benannt in
einem eigenen Verzeichnis.“

## Was dieser Lauf liefert

| Teil | Ort |
|---|---|
| Matrix Q1–Q5 mit drei Ebenen je Frage: historische Aussage, damals offen, heutiger Stand | `quellenmatrix.json` |
| Eigenes Verzeichnis der Beleglücken, eine Datei je Lücke | `luecken/` |
| Prüfung, dass Matrix, Quellen, Fundstellen und Verzeichnis zusammenpassen | `tests/quellen-kernfragen/matrix-und-luecken.test.ts` |

## Quellen

Die fünf Altquellen sind lesbar. Gelesen hat sie der Lesebefund der Quellenhilfe
`971decb4586933f1…` vom 13.10.2026 (`QUELLEN-HILFE-971decb4586933f1-ALTQUELLEN.json` im
Auftragsordner). Pfade relativ zum alten Projektverzeichnis.

| Kürzel | Datei | SHA-256 |
|---|---|---|
| vertrag | `03_AUFTRAEGE/planung/PLAN-PRO-W2-A276-2-Q1-Q5-SCHLIESSUNGSVERTRAG-301.md` | `18372fff…` |
| job797 | `03_AUFTRAEGE/basic_pausiert/MAKROAUFTRAG-BASIC2-JOB-797-D1-W2-Q1-Q5-QUELLENMATRIX.md` | `a5544f49…` |
| d1 | `_relay/kopf/outbox/RUECKGABE-PRO-JOB-813-D1-W2-Q1-Q5-SCHLIESSUNGSVERTRAG.md` | `1be5f46e…` |
| d2 | `_relay/kopf/outbox/RUECKGABE-PRO-JOB-813-D2-KORREKTUR.md` | `7c83f3fc…` |
| ben7 | `_relay/kopf/outbox/BEN7-PRUEFUNG-JOB-813-D2.md` | `fccf4a32…` |

## Die fünf Kernfragen

Die Kernfragen betreffen den Lauf- und Freeze-Vertrag des Moduls `library-analytics` (W2, Auftrag
A276-2). „Heute“ heißt: Quelleninspektion am Produktbaum in diesem Lauf, kein Testergebnis (L01).

| Kernfrage | Beantwortende Quelle | Historisch belegt | Damals offen | Heute im Produktbaum |
|---|---|---|---|---|
| **Q1** Wo wird der Zählervertrag durchgesetzt? | vertrag:74–85, d1:126–138 | `advance` validiert nur den Patch; P11b (negativer Bestand) ist durch die Vorab-Patchprüfung nicht abgedeckt | Risikoentscheidung zur DDL-Wirkung auf Bestandsdaten, U-1/U-2 | Speicher prüft den zusammengeführten Lauf (`repo.ts:1039`). PostgreSQL prüft nur den Status des Flickens (`repo-pg.ts:903-940`), kein Zähler-CHECK im Schema (`repo-pg.ts:740-770`) |
| **Q2** Woher kommt die Sieben-Felder-Projektion? | vertrag:89–100, d1:140–149 | Snapshot auf sieben Felder begrenzt, nicht exportiert; PostgreSQL schreibt `JSON.stringify(ref)`; beide Varianten gleichwertig | keine Ownerfrage; Variante nicht gewählt | unverändert: `importRunItemRefSnapshot` nicht exportiert (`repo.ts:901-912`), PostgreSQL schreibt ungekürzt (`repo-pg.ts:942-956`) |
| **Q3** Lesepfad und Altzeilen | vertrag:104–115, d1:140–149 | PostgreSQL schreibt und liest roh; InMemory begrenzt beide Wege; eine Schreibkorrektur allein erfasst Altzeilen nicht | Bestandsbereinigung als Risikoentscheidung; U-4/U-6 ungemessen | unverändert roh gelesen (`repo-pg.ts:849-855`, `958-967`). Kein Produktpfad ruft `appendItemRefs` auf (`tests/library/job821-w2-ist-befund.test.ts:51-65`). Altzeilen im Betrieb ungemessen |
| **Q4** Wo dürfen die Gegenproben leben? | vertrag:119–132, d1:151–156 | Paritätsbatterie in einer Freeze-Datei; Alternativen: bestehende Freeze-Testdateien oder eine neue Testdatei | Prozess- und Risikoentscheidung zu Prüfort und Freeze-Umfang | Paritätsfälle weiter in den eingefrorenen Dateien `service.test.ts` und `repo-pg.integration.test.ts` (`tests/library-analytics-freeze144.test.ts:407-453`); keine Entscheidung dokumentiert |
| **Q5** Der Freeze selbst | vertrag:136–147, d1:158–168, d2:28–74, ben7:1–23 | Backfallintegrität bestätigt, Verlustprämisse entfallen; formale Freeze-Lösung bleibt getrennt; D2 schließt die Nachweisbindung ab | förmliche Ownerentscheidung, durch die Entwarnung nicht ersetzt | FREEZE-144 bindet Änderungen an hashgebundene Freigaben, prüft nur deren Form und nennt die Zeichnungsbefugnis als offene Ownerfrage (`tests/library-analytics-freeze144.test.ts:2-50`). Kein heutiger Integritäts- oder Wiederherstellungsnachweis |

## Lückenverzeichnis

Beleglücken sind fehlende Nachweise. Offene Entscheidungen stehen getrennt im nächsten Abschnitt.

- [L01](luecken/L01-heutiger-stand-nur-inspiziert.md): Der heutige Stand je Kernfrage ist nur
  inspiziert, nicht gemessen. Die Zuordnung zum heutigen Code ist aus Begriffen und Bauform
  abgeleitet. (Q1–Q5)
- [L02](luecken/L02-job-813-d2-enge-urteilsreichweite.md): JOB 813 D2 ist abgeschlossen, aber nur
  in engem Umfang geprüft. Keine wiederholte Dateimessung, keine praktische Wiederherstellung, kein
  semantischer Inhalt. (Q5)
- [L03](luecken/L03-quell-ids-ohne-fundstelle.md): Sieben Quell-IDs und die Vorlage
  `…-QUELLENMATRIX-READONLY-334.md` sind nicht ausgewertet.
- [L04](luecken/L04-widersprueche-in-der-quelle.md): Widersprüche innerhalb der Quelle. Vor allem
  „gebaut, wartet auf Einbau“ gegen eine reine Nachweislieferung, dazu Stand, Datum und Kategorie.
- [L05](luecken/L05-quellpakete-nicht-nachgelesen.md): Die Quellpakete der Aufnahme sind nicht
  nachgelesen.

## Offene Entscheidungen (historisch offen, hier nicht getroffen)

- **Q1:** Risikoentscheidung zur DDL-Wirkung auf Bestandsdaten (U-1/U-2).
- **Q2:** Wahl zwischen den zwei gleichwertigen Organisationsvarianten. Das ist eine technische
  Wahl, keine Ownerfrage.
- **Q3:** Bestandsbereinigung der Altzeilen (U-4/U-6).
- **Q4:** Prüfort der Gegenproben und Freeze-Umfang.
- **Q5:** Förmliche Freeze-Lösung und Zeichnungsbefugnis der Freigaben.

Ein jüngerer Abschluss ist für keine davon belegt.

## Zuordnung geliefert / vorhanden / offen

| Anliegen | Stand | Fassung | Beleg |
|---|---|---|---|
| R-1384 Quelle je Kernfrage | **geliefert in diesem Lauf**: Gegenstand, Fundstellen und historische Aussage für Q1–Q5, heutiger Stand inspiziert | dieser Lauf | `quellenmatrix.json`, Test M1–M4 |
| R-1384 Lückenverzeichnis | **geliefert in diesem Lauf** | dieser Lauf | `luecken/`, Test L1–L3 |
| Q5-Nachweisbindung | **vorhanden (historisch abgeschlossen)**: Nachweislieferung ohne Produktänderung | JOB 813 D2, Rückgabe SHA-256 `7c83f3fc83df8dae131945adc9dc2ce5ec9ddf5907bc9d0158634a3210612030`, Clone-Basis `d40097f5` | d2:28–74, d2:103–118; BEN7: Gesamt GRÜN, Produkt GRÜN (eng), Form ROT, Code ROT (L02) |
| Ownerentscheidungen Q1, Q3, Q4, Q5 | **offen** | — | Abschnitt „Offene Entscheidungen“ |

Die Registeraussage „GEBAUT, wartet auf Einbau … kein Commit im Produkt gefunden“ ist kein offener
Einbau. D2 hat bewusst keine Produktdatei geschrieben (L04, Punkt 1).

## Abgrenzung

- **Getrennt geführt laut Quelle** (R-1384, Notiz): „das Quellenmanifest zu den Betriebsbefunden
  N1-N8 und die Quellenwegkarte zum eingefrorenen Stand“. Beides gehört nicht zu diesem Auftrag und
  wurde hier weder erhoben noch geändert.
- **Gesonderter Bestand:** JOB 821 (`tests/library/job821-w2-ist-befund.test.ts`) zum Referenzziel
  von `candidateItemId`. Er ist hier nur als heutiger Befund zu Q3 zitiert und nicht entschieden.
- **Gleiches Wort, anderer Gegenstand** (gefunden und ausgeschlossen):
  - `docs/operations/maintenance-update-process.md` §8 Schritt 3, „Kernfragen testen“: Fachfragen
    an Klara beim Modellwechsel.
  - `OFFEN.md` (zweimal „fünf Fragen“, dazu das „geschlossene Quellenmanifest“ des
    Umstellungsplans): eigene Vorgänge.
  - Die Kommentare „Kernfrage“ in `office-host.ts`, `ask-routes-ka4-einwilligung.test.ts` und
    `job2935-validierung-fussband.test.ts`.
- **Keine Ausführung historischer Entscheidungen** und kein Wiederaufbau der alten Steuerung
  (BASIC2-Makroauftrag, `00_CONTROL`). Produktcode und eingefrorene Dateien sind unverändert.
