# KI-Laufprotokoll — Abgleich der Aufnahme `gesamt-ki-laufprotokoll`

Auftrag `aufnahme:20260922:gesamt-ki-laufprotokoll`, Lauf 1, Basis `e6e4bf16`
(1.0.0-beta.1.638). Runde 1 am 01.10.2026, Runde 2 (Nacharbeit zu Bens R1-Befunden B1–B5) und
Runde 3 (Nacharbeit zu Bens R2-Befunden B1, B3, B5, B6) am 01.10.2026; Runde-2-Stand
`a98f2b98`. Fassungen sind die Ship-Commits, in denen eine Lieferung zuerst stand. Die Fassung
dieses Laufs erzeugt der Starter.

## Gelieferter Stand vor diesem Lauf (wiederverwendet, nicht neu gebaut)

| Teil | Lieferung | Fassung | Beleg |
|---|---|---|---|
| Protokoll v1, nur Metadaten (Aufgabe, Anbieter, Erfolg/Fehler, Ersatzmodus `fallback`, `demo`, Start/Ende) | SCRUM-164/167 | `7feb10ae`, `bbdb74e7` (26.06.) | `services/model-runs/src/types.ts`, `services/model-runs/src/*.test.ts` |
| Laufkontext nur als Kennungen (`actor`, `subject` = KO) | mega26 Block A | `5150cd5a` | `sanitizeModelRunContext` in `types.ts` |
| Echter Modellname statt zweimal Anbieter | JOB 3036 | 1.0.0-beta.1.50 | `tests/ki-lauf-modell/` |
| Modell und Dauer je Lauf in der KI-Übersicht | JOB 3044 | 1.0.0-beta.1.68 | `tests/ki-lauf-dauer/` |
| Acht Aufgabenarten in der Karte, unbekannte Art als Satz (DE/EN/NL) | JOB 3069 | 1.0.0-beta.1.81 | `tests/ki-aufgabenarten/` |
| Tokenverbrauch je Lauf, auch bei Fehlversuchen (V9 Scheibe 3) | JOB 3074 | 1.0.0-beta.1.88 | `tests/ki-lauf-verbrauch/` |
| MR-SELECT-1: Import-Auswahl (`POST /api/admin/import/confluence/select`) schreibt je echter Anfrage genau einen `select`-Lauf | JOB 3127 | 1.0.0-beta.1.140 | `tests/select-lauf-protokoll/` |
| Gescheiterte Ausweichversuche stehen im Datensatz des Laufs (Anbieter, Modell, Grund) | JOB 3276 | 1.0.0-beta.1.202 | `Reasoner.versuchsfehlerZeile`, `tests/ki-assist-leer/` |

## In diesem Lauf geliefert

| Befund / Kriterium | Lieferung | Beleg (dieses Verzeichnis) |
|---|---|---|
| R-1572, R-1621: `ModelCapacityError` | Ein Lauf, der an der Auslastung endet, schreibt genau einen `error`-Datensatz (Glied, bisheriger Verbrauch, zuletzt gerufenes Modell, Versuchsfehler). Die 503 bleibt, auch wenn das Protokoll nicht schreiben kann. Gilt auch für Konflikt- und Dublettenurteil. | `kapazitaet-hinterlaesst-spur.test.ts` K1–K3, `protokoll-vollstaendig.test.ts` W5 |
| Ben R1 B1 + R2 B1, R-0612 „ohne Frage- und Antworttexte“ | `error` übernimmt Meldungen nur noch von einer Erlaubnisliste selbstgebauter Fehlertypen (Zeitlimit, leere Antwort, Auslastung, Abschaltung, Vertraulichkeitssperre, `ReasonerMeldungFehler`). Bei HTTP-Fehlern stehen nur der eigene Teil und der Status da, z. B. „… antwortete mit 400 (Anbieterbegründung nicht protokolliert)“. Der Anbietertext kann die Anfrage zitieren und wird deshalb nicht übernommen (R3). Für jeden anderen Fehler stehen nur Typ und Fehlerklasse da, z. B. `SyntaxError (parse)`. Der Fehlerdatensatz trägt die Versuchszeile aller Glieder. | `protokoll-vollstaendig.test.ts` I1–I3, H1–H2 (echter OpenAI-kompatibler Client, 400er zitiert die Anfrage) |
| Ben R1 B2, R-0612 „jeder Aufruf“, R-1666 | Vier neue Laufarten: `enrich`, `conflict`, `duplicate`, `probe` (öffentliche Anreicherung, Konflikt-/Dublettenurteil, Anbieterprobe einschließlich lokaler Probe). Je Aufruf mit Modellversuch entsteht genau ein Lauf mit Modell, Verbrauch, Ausgang und inhaltsfreier Fehlerzeile. Ohne Modellversuch entsteht keiner. Karte, Zählung und Texte DE/EN/NL kennen die zwölf Arten (`MODEL_RUN_TASKS`). | `protokoll-vollstaendig.test.ts` W1–W6, `auswertung-flaeche.test.tsx` F6, `tests/ki-aufgabenarten/` R3a–R3i |
| Ben R1 B3 + R2 B3, V9, R-0705, R-0759, R-0833 | Jeder Ausweichversuch steht in `versuche` mit Anbieter, wirklich gerufenem Modell, eigenem Verbrauch, Dauer, Ausgang und Span. Die Kosten werden **je Versuch zum Preis seines Modells** berechnet (R3: vorher wurde der Gesamtverbrauch mit dem Preis des letzten Modells bewertet). Fehlt für einen Versuch mit Verbrauch das Modell oder der Preis, oder passen die Versuche nicht zur Laufsumme, entstehen keine Kosten statt einer zu niedrigen Teilsumme. Dasselbe gilt, wenn ein Versuch ein Modell wirklich gerufen, aber keinen Verbrauch gemeldet hat (Ben R3 B3: unbekannter Verbrauch ist kein Nachweis für null Kosten); die Auswertung zählt solche Läufe unter `verbrauchOhneKosten` statt sie als kostenfrei zu summieren. Eine verworfene Modellantwort (Konflikt-/Dublettenurteil unverwertbar, leere Anreicherung) ist ein Versuch mit Ausgang `fehler` (Ben R3 B7). Altläufe ohne `versuche` bekommen keine Kosten. Die Kosten werden beim Schreiben berechnet und mit Preisstand gespeichert (`kosten`). Die Preisliste setzt der Betreiber über `KLARWERK_KI_PREISLISTE` (Startvertrag, `env.demo.beispiel`). Der Code liefert **keine** Preise mit. Die Laufkarte zeigt je Lauf die Kosten. Die neue KI-Auswertung zeigt je Währung die Summe für den gewählten Zeitraum (7/30/90 Tage), jeweils mit Grundmenge und Preisstand. | `kosten-und-auswertung.test.ts` P1–P5, S1, A1, A3, R1–R2; `protokoll-vollstaendig.test.ts` C1–C3 (Bens Fälle: 0,011 statt 0,002 EUR; N3 ohne Kosten statt 0,001 EUR), V1–V2; `auswertung-flaeche.test.tsx` F1, F3–F5 |
| Ben R1 B4, R-0759, R-1984 | `erzeugt` = Art und Anzahl dessen, was ein gelungener Lauf zurückgab (z. B. 3 × Punkt, 1 × Urteil), nie der Inhalt. Die Laufkarte zeigt es an. | `protokoll-vollstaendig.test.ts` E1–E3, W1–W3; `auswertung-flaeche.test.tsx` F2 |
| Ben R1 B5 + R2 B5, R-2071 | Strukturierte Logzeile `ki_lauf` je Lauf über den App-Logger: Aufgabe, Status, Anbieter, Modell, Dauer, Token, Kosten, Erzeugnis, Zahl der Versuche und Trace-Kennungen. Fehlertext, Anfragender und Gegenstand stehen nicht darin. **Tracing (R3)** nach W3C Trace Context: Je HTTP-Anfrage entsteht ein Trace-Kontext. Ein eingehender `traceparent` wird fortgesetzt, ein ungültiger verworfen. Jeder Lauf trägt `trace` (traceId, eigener Span, Span der Anfrage als Elternteil, `requestId` der Anfrage-Logzeilen), jeder Versuch einen eigenen Span. Läufe ohne Anfrage bekommen einen eigenen Trace. Dazu `GET /api/model-runs/auswertung?von&bis` (`ko.read`, nur Summen) und die Auswertungskarte als KI-Nutzungs- und Kosten-Dashboard. | `kosten-und-auswertung.test.ts` S1–S2, A1–A2, R1–R5, L1–L2 |
| Ben R2 B6, R-1567 Karten-Zustände | Die Auswertungskarte behandelt Offline und gescheiterte Auffrischung wie die Laufkarte. Ohne geladene Zahlen: Fehlersatz statt „Lädt …“. Mit geladenen Zahlen: Diese bleiben stehen, mit Hinweis „Keine Verbindung …“ bzw. „Auffrischung fehlgeschlagen …“. | `auswertung-flaeche.test.tsx` F7–F9 |
| Ben Restrunde P1, MR-SELECT-1, R-1567 select-Kette | Eine echte Anfrage an `POST /api/admin/import/confluence/select` erzeugt eine neue select-ID. Diese wird über `GET /api/model-runs` derselben App gelesen. Die gemountete Seite `Capital` holt sie über dieselbe App selbst ab und zeigt sie in DE/EN/NL mit übersetzter Art. Im echten Chromium (Browser-Gruppe, nicht lokal ausführbar) geht eine per Tastatur angemeldete Anwenderin ohne Maus über Zahnrad → „Bereiche“ → „Kapital-Sichten“ zur Seite. Die Zeile derselben neuen ID trägt Art und Modell sichtbar (je Textknoten gemessen) und steht nach dem Tab-Weg im Fenster. Zwei Kalibrierungen im selben Lauf: Bens Stylesheet-Verstellung und ein aus der Tab-Folge genommener Menüpunkt müssen rot werden. Persistenz heißt hier: das In-Memory-Protokoll der App; PostgreSQL ist nicht gemessen. | `tests/select-lauf-protokoll/kette-anfrage-bis-laufkarte.test.tsx` K5 (jsdom); `tests/select-lauf-protokoll/tastaturweg-laufkarte-im-echten-browser.test.ts` K6 (de/en/nl), K7, K8 (Chromium) |

Gegenproben:
- Wird die Meldungs-Erlaubnisliste ausgeschaltet oder schreibt das Laufbuch nichts, fallen I1, I2,
  W1–W5 und E3 rot aus.
- Ohne die Kapazitätskorrektur fallen K1 und K2 rot aus.
- R3: Mit der alten HTTP-Meldung fallen I3, H1 und H2 rot aus.
- R3: Mit der alten Preisrechnung (letztes Modell) fallen C1 und P4 rot aus.
- R3: Ohne die Zustandsbehandlung fallen F7, F8 und F9 rot aus.

## Offen, mit Grund

- **Preise selbst (Entscheidung Pedi):** Welche Preise, welche Währung und welcher Stand gelten,
  ist nicht festgelegt. Der Mechanismus steht. Ohne gesetzte `KLARWERK_KI_PREISLISTE` zeigt die
  Übersicht „Keine Preisliste hinterlegt — Kosten werden nicht berechnet.“ Altläufe tragen keine
  Kosten, sie werden nicht nachberechnet.
- **Erzeugte Gegenstände als Kennungen:** `erzeugt` nennt Art und Anzahl. Eine Verknüpfung zum
  später gespeicherten Entwurf/KO entsteht erst in den Routen nach dem Lauf und ist nicht gebaut.
  `subject` (KO) bleibt der einzige Objektbezug.
- **Externe Trace-/Metrik-Sammler (R-2071):** Die Trace-Kennungen sind W3C-konform und stehen in
  Datensatz und Logzeile. Ein Export an einen Sammeldienst (z. B. OpenTelemetry-Collector,
  Prometheus) ist nicht gebaut. Das ist Betriebsinfrastruktur außerhalb dieses Auftrags. Die App
  setzt keinen `traceparent`-Antwortkopf. Anfrage-Logzeilen tragen die `requestId`, nicht die
  `traceId`; die Zuordnung läuft über `requestId` im Lauf.
- **Logbereinigung:** Damit die `traceId` im Log lesbar bleibt, lässt `senkeUeberWert` unter genau
  den Feldnamen `traceId`, `spanId` und `parentSpanId` reine Hex-Werte in W3C-Länge (16 oder 32
  Zeichen) an der Token-Regel vorbei. Werte secret-benannter Env-Variablen werden auch dort
  entfernt (Ben R3 B8, L2). Alles andere bleibt der Bereinigung unterworfen (L1).
- **Kennzeichnung nach KI-VO Art. 50:** `enrich` steht seit Entscheidung Pedi 8398db9e in
  `KI_ERZEUGENDE_AUFGABEN`; ein Anreicherungsergebnis mit Text trägt `aiGenerated` (W1b, rot ohne
  Aufnahme). `conflict`, `duplicate` und `probe` bleiben ungekennzeichnet (Begründung in
  `services/model-runs/src/types.ts`).
- **Anzeige des Fehlergrunds:** `error` steht im Datensatz und in der API. Die Laufkarte zeigt ihn
  nicht.
- **Nicht geprüft (R-1536, R-1544, R-1567):**
  - echte Anbieter-API und Schlüsselbund,
  - PostgreSQL-Persistenz einschließlich des neuen `PgModelRunRepo.zwischen` und der neuen
    jsonb-Felder `versuche`/`trace`,
  - Browserlayout und echte Tastaturbedienung der Karten in Chromium,
  - „unbekannte Live-Art“ und die vollständige Karten-Zustandsmatrix,
  - die Klärung OpenAI-400/`model-error` (N12d).

  Im Bau wurde nichts davon ausgeführt (kein Docker, kein Browser auf dem Produktions-Mac).

## Zuordnung der 18 Kriterien (Endabnahme der Fassung `84d59561` = 1.0.0-beta.1.641)

Ein Kriterium ist entweder einem Beleg (Datei und Fall) oder ausdrücklich dem Liefertor-Rest
zugeordnet. Der Liefertor-Rest ist nicht gemessen und kein Bestanden-Beleg:
**(a)** echter Anbieter-/Schlüsselbund-Aufruf und echte Modell-API, **(b)** PostgreSQL-Persistenz
(`PgModelRunRepo.zwischen`, jsonb `versuche`/`trace`), **(c)** unbekannte Live-Art, vollständige
Karten-Zustandsmatrix und Ablösungssuche, **(d)** OpenAI-400/`model-error` unter N12d,
**(e)** vollständiger eigener `tools/check`- und Chromium-Lauf.
Pfade ohne Verzeichnis liegen in `tests/ki-lauf-protokoll/`.
„Server“ heißt: Die Datei startet Chromium und läuft nur auf dem Prüfserver.

| # | Kriterium | Beleg | Liefertor-Rest |
|---|---|---|---|
| 1 | R-0612: Anbieter, Aufgabe, Erfolg, Ersatzmodus, Dauer, Ergebnisstatus ohne Frage- und Antworttexte | `protokoll-vollstaendig.test.ts` I1–I3, H1–H2, W1 (Marken für Frage und Antwort fehlen im Datensatz), W1–W6 (je Aufruf ein Lauf); `tests/ki-lauf-modell/`, `tests/ki-lauf-dauer/`; `kosten-und-auswertung.test.ts` S1 (Logzeile nur Metadaten) | (a), (b) |
| 2 | R-0705: Ausweichversuche zusammengeführt; Verbrauch und Kosten mit eigenem Nachweis | Versuche: `protokoll-vollstaendig.test.ts` C1–C3, V1–V2; Verbrauch: `tests/ki-lauf-verbrauch/`, K2; Kosten: `kosten-und-auswertung.test.ts` P1–P5 | (a), (b) |
| 3 | R-0759: Herkunft, Modell, Aufgabe, Verbrauch, Kosten, Erzeugtes | `tests/ki-lauf-modell/`, `tests/ki-aufgabenarten/` R3a–R3i, `tests/ki-lauf-verbrauch/`, `kosten-und-auswertung.test.ts` P2–P4, R1; Erzeugtes: `protokoll-vollstaendig.test.ts` E1–E3, `auswertung-flaeche.test.tsx` F2 | (a), (b); Erzeugtes nur als Art und Anzahl (siehe „Offen“) |
| 4 | R-0833: Modellherkunft, Ausweichweg, Verbrauch, Kosten einer KI-Antwort | wie 2 und 3; zusätzlich `auswertung-flaeche.test.tsx` F1 (Kosten je Lauf in der Karte) | (a), (b) |
| 5 | R-1536 (Rest) | Sichtbare Weboberfläche nur für die Laufkarte: `tests/select-lauf-protokoll/tastaturweg-laufkarte-im-echten-browser.test.ts` K6–K8 (Server) | (a), (b), (e) |
| 6 | R-1544 (Rest) | kein eigener Beleg | (e); die drei socketabhängigen Auth-Fälle sind lokal ohne Horchrecht nicht messbar |
| 7 | R-1567 (Rest): produktiver select-Aufrufer → eigene select-ID → DE/EN/NL-Karte | `tests/select-lauf-protokoll/route-einstieg.test.ts` A1–A4, `laufkarte-kette.test.ts` K1–K3, `kette-anfrage-bis-laufkarte.test.tsx` K5, `tastaturweg-laufkarte-im-echten-browser.test.ts` K6–K8 (Server); Sprachmatrix der jetzt zwölf Arten: `tests/ki-aufgabenarten/` R3a–R3i, `auswertung-flaeche.test.tsx` F6; Auswertungskarte-Zustände F7–F9 | (c), (d); sechs Fallback-Läufe sind keine KI-Abnahme |
| 8 | R-1572 (Rest): Tokenumfang; `ModelCapacityError` | `tests/ki-lauf-verbrauch/` (1.0.0-beta.1.88); `kapazitaet-hinterlaesst-spur.test.ts` K1–K3, `protokoll-vollstaendig.test.ts` W5 | (a), (b); Browserlayout außer Laufkarte (K6–K8) nicht abgenommen |
| 9 | R-1621 (Rest): Kosten, Modellfassung, Versuchshistorie, Erzeugtes, `ModelCapacityError` | Kosten: `kosten-und-auswertung.test.ts` P1–P5, R1–R2; Modell: `tests/ki-lauf-modell/`; Versuche: `protokoll-vollstaendig.test.ts` C1–C3; Erzeugtes: E1–E3; Auslastung: K1–K3 | (a), (b); „Modellfassung“ ist der gemeldete Modellname, keine eigene Versionskennung |
| 10 | R-1666: KI-Läufe nach Aufgabenart | `tests/ki-aufgabenarten/` R3a–R3i; `auswertung-flaeche.test.tsx` F3 (eine Zeile je Aufgabenart), F6; `kosten-und-auswertung.test.ts` A1 | (c) unbekannte Live-Art |
| 11 | R-1984: Verbrauch und Erzeugtes | `tests/ki-lauf-verbrauch/`; `protokoll-vollstaendig.test.ts` E1–E3, W1–W3; `auswertung-flaeche.test.tsx` F2 | (b) |
| 12 | R-2071: strukturierte Logs, Metriken, Tracing, KI-Kosten-/Nutzungs-Logging, Dashboard | Log: `kosten-und-auswertung.test.ts` S1–S2, L1–L2; Tracing: R4–R5; Metriken/Summen: A1–A3, R1–R3; Dashboard: `auswertung-flaeche.test.tsx` F3–F9 | externer Export ausgeschlossen (Entscheidung 11e9f7a9) |
| 13 | MR-SELECT-1 | wie 7: A1–A4, K5, K6 (de/en/nl, Tastatur) mit Kalibrierungen K7–K8 (Server) | (b): Persistenz nur In-Memory |
| 14 | V9: je Lauf Modell, Dauer, Kosten; Summe je Zeitraum | `tests/ki-lauf-dauer/`; `auswertung-flaeche.test.tsx` F1, F3–F5; `kosten-und-auswertung.test.ts` R1–R2, A1 | (b) |
| 15 | Gelieferte Ergebnisse mit Fassung und Beleg; Abgrenzung; Quellenwidersprüche | Abschnitte „Gelieferter Stand“, „In diesem Lauf geliefert“, diese Tabelle, „Offen, mit Grund“, „Quellenwidersprüche“ | — |
| 16 | Entscheidung 6e757462: Preise nur aus `KLARWERK_KI_PREISLISTE` | `kosten-und-auswertung.test.ts` P1 (ohne Wert keine Liste), R1 (mit Liste) / R2 (ohne Liste, Grund); `auswertung-flaeche.test.tsx` F3 / F4 („Keine Preisliste hinterlegt …“) | — |
| 17 | Entscheidung 11e9f7a9: Auswertungskarte als Dashboard | Karte: `auswertung-flaeche.test.tsx` F3–F5 (Zeitraumwahl, Kostensumme mit Grundmenge); Summen je Währung: `kosten-und-auswertung.test.ts` A1; Route: A2, R1–R3 | F5 misst die Vorgabe 30 und den Wechsel auf 7; die Option 90 ist nicht einzeln geprüft |
| 18 | Entscheidung 8398db9e: `enrich` gekennzeichnet | `protokoll-vollstaendig.test.ts` W1b; `tests/reasoner/mega61-ki-kennzeichnung.test.ts`; `tests/app/g24-ki-kennzeichnung-laufzeitpruefung.test.ts` G24-4 | — |

Zu 18, Gegenprobe (Lauf 3): Ohne `"enrich"` in `KI_ERZEUGENDE_AUFGABEN` fällt W1b rot aus
(`expected [ 'answer', 'interview', 'describe' ] to include 'enrich'`). Die Liste ist kein
Laufzeitschalter an der Route. `enrichPublic` setzt die Marke direkt, wie `answer` und
`interview` auch. Ihre Wirkung liegt in der Oberfläche: `istKiKennzeichnung`
(`apps/web/src/lib/wordAddin.ts`, Spiegel im Aufgabenfenster) erkennt nur gespiegelte Aufgaben an,
und G24-4 hält diese Spiegelung gegen die Liste.

## Quellenwidersprüche

- „Modellläufe werden nicht protokolliert“ (Register, zeitweise): durch SCRUM-164 (26.06.)
  überholt. Bis zu diesem Lauf waren vier Modellwege tatsächlich ohne Protokoll (B2, jetzt
  geschlossen).
- „select rechnet grundsätzlich ohne Modell“ (`types.ts` am Feld `model`, `Reasoner.select`):
  gilt nur für das synchrone Keyword-Ranking `Reasoner.select`. Dafür gibt es keinen produktiven
  Aufrufer. Der produktive `select`-Weg ist `deriveImportCriteria` (JOB 3127) und befragt ein
  echtes Modell.
- `apps/web/src/api/types.ts` (JOB 3074) sagte „KEIN PREIS … die Oberfläche zeigt keine
  Kostenzahl“. Das gilt seit diesem Lauf nur noch ohne hinterlegte Preisliste.
- R-1567 nennt sechs Fallback-Läufe. Sie sind keine KI-Abnahme. Eine Abnahme mit echtem Modell
  fehlt weiterhin.
