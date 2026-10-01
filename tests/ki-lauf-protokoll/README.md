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
| Ben Restrunde P1, MR-SELECT-1, R-1567 select-Kette | Eine echte Anfrage an `POST /api/admin/import/confluence/select` erzeugt eine neue select-ID. Diese wird über `GET /api/model-runs` derselben App gelesen. Die gemountete Seite `Capital` holt sie über dieselbe App selbst ab und zeigt sie in DE/EN/NL mit übersetzter Art. Die Zeile ist nicht verborgen oder `inert`, und die Karte nimmt nichts aus der Tab-Folge. Persistenz heißt hier: das In-Memory-Protokoll der App; PostgreSQL und echte Tab-Bewegung in Chromium sind nicht gemessen. | `tests/select-lauf-protokoll/kette-anfrage-bis-laufkarte.test.tsx` K5 |

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
