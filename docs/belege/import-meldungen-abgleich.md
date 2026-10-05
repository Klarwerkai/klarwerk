# Import-Meldungen: Abbruch, Moduswechsel und Meldungsinventar — Abgleich

Auftrag `aufnahme:20260922:import-meldungen` (Kriterien K1–K8 in `AUFTRAG-B1.json`) · Basis
`121500c2` / Fassung `1.0.0-beta.1.701` · erstellt am 05.10.2026.

**Zum Stand dieses Dokuments:** Alles hier beruht auf **Quelleninspektion** und auf **neuen Tests,
die zum Zeitpunkt des Schreibens noch nicht gelaufen sind**. Ob sie grün sind, zeigt erst der Lauf
nach dem Prüfplan. Ein Lieferbeleg mit Fassung entsteht erst mit der Veröffentlichung (K8).

Neue Tests in `tests/import-meldungen-rest/`:

| Datei | Bühne | Kriterien |
|---|---|---|
| `acht-meldungen-drei-sprachen.test.tsx` | gemounteter Arbeitsraum (`datei-buehne.tsx`) | K1, K4, K5 |
| `abbruch-moduswechsel-chromium.test.ts` | gebaute Seite in Chromium an der echten Fastify-App | K2, K5 |
| `neununddreissig-meldungen-zuordnung.test.ts` | Quelleninspektion, maschinell nachgehalten | K3 |

## K1 — die acht festgeschriebenen Sprachmeldungen

Die acht Meldungen sind die, die JOB 3379 (`sprachwechsel-import-meldungen.test.tsx`) als
EINGEFROREN führt. Gepinnt war dort nur DE→EN und nur der Wortlaut. Jetzt hat jede Meldung ihren
auslösenden Zustand, ihren Träger auf der Fläche und eine Messung über DE→EN→NL.

| Meldung | auslösender Zustand | Träger (gemessen) | DE→EN→NL (Befund laut Code und JOB-3379-Pin) |
|---|---|---|---|
| `dropReject` | `.bin` auf die Ablagefläche | Live-Region `capture-datei-meldung` | DE bleibt stehen |
| `unsupported` | `.bin` über den Dateieingang | Live-Region `capture-datei-meldung` | DE bleibt stehen |
| `empty` | leere TXT | Live-Region `capture-datei-meldung` | DE bleibt stehen |
| `parseError` | Lesen wirft | Live-Region `capture-datei-meldung` | DE bleibt stehen |
| `extracting` | Einlesen läuft | `notice` (keine Ansage) | DE bleibt stehen |
| `wholeSaved` | Ganzdokument gespeichert | `notice` (+ Toast) | DE bleibt stehen |
| `tooLargeForImport` | Ganzdokument über der Client-Grenze | Live-Region `capture-datei-meldung` (seit Nacharbeit 1; vorher `err` + Toast) | DE bleibt stehen |
| `wholeOpenMissing` | gespeichert, ohne Entwurfskennung | `err` (+ Toast), Karte daneben | DE bleibt, die Karte übersetzt sich mit |

**Reproduzierbarer Befund, Ursache aus dem Code:** Alle acht werden beim Auslösen als fertig
übersetzter Text in den Zustand gelegt (`Capture.tsx`: `setNotice(t(…))` für `extracting`,
`setFileImportMeldung(t(…))` für `unsupported`, `empty`, `parseError` und `tooLargeForImport`,
`setErr(t(…))` für `wholeOpenMissing`, `setNotice(\`${savedNote}…\`)` für `wholeSaved`;
`CaptureFileImport.tsx`: `setMeldung(t(…))` für `dropReject`). Dieser Befund **begründet einen eigenen
Reparaturschnitt**. Das Muster dafür gibt es schon: `meldungText` / `Textbaustein` in `Capture.tsx`
(JOB 3196 R2). In diesem Auftrag wurde nichts repariert. Die neuen `it.fails`-Fälle werden rot,
sobald die Reparatur greift, und sind dann auf `it` umzustellen.

## K2 — Abbruch und anschließender echter Moduswechsel

- JOB 3379 C1/C2/C4 (`abbruch-dann-moduswechsel.test.tsx`) wurden auf einer Bühne gemessen, die den
  Arbeitsraum **ohne Blatt** montiert. Dort nimmt der Abbruch die Karten weg, und der Moduswechsel
  ist danach nicht bedienbar. Im Produkt gibt `cancelFileImport` die Fläche über
  `onZurueckInsBlatt` ans Blatt zurück. Der nächste Wechsel beginnt dort, über „Datei" → „Datei
  importieren".
- `abbruch-moduswechsel-chromium.test.ts` geht genau diesen Weg im Browser (A: Punkte→Abbruch→Ganzes→
  Punkte→Ganzes→nächste Datei; B: Ganzes→Abbruch→Punkte→nächste Datei). Gemessen werden: die getippte
  Blatt-Eingabe ist unverändert, die Karte steht nach dem Abbruch wieder auf Punkte, die Anleitung
  folgt jeder Wahl, es gibt keine Quittung der abgebrochenen Datei, und die nächste Datei wird in der
  gewählten Art quittiert.
- **C3 bleibt Befund, nicht Fehler:** Während des Einlesens ist „Abbrechen" gesperrt
  (`disabled={fileBusy || …}` in `Capture.tsx`). Das ist eine bewusste Sperre im Code. Ob ein
  Abbruch mitten im Einlesen gewollt ist, muss das Produkt entscheiden. Ohne diese Entscheidung gibt
  es keinen Reparaturschnitt.

## K3 — die 39 inventarisierten Meldungen

Die vollständige Tabelle mit Beleg und Rest steht in `neununddreissig-meldungen-zuordnung.test.ts`.
Ergebnis: **10 erreichbar, 1 ersetzt, 28 weiterhin unbewiesen.**

- **erreichbar** (ein jüngerer Test bedient den echten Arbeitsraum bis in den Zustand): `importNotePdf`,
  `importNotePptx`, `importNoteDocx`, `captionsBalance`, `captionsBalanceAssigned`,
  `imageCaptionPlaceholder`, `draftsSaved`, `draftsPartial`, `pointCount`, `queueBadge`.
  Für die KI-Punkte gilt dabei: Die KI ist eine Attrappe, echte KI ist nicht beteiligt.
- **ersetzt:** `loaded`. Der Arbeitsraum zeigt seit JOB 3196 `loadedStats`/`loadedStatsWhole`. Im
  BodyExtractPanel lebt `loaded` weiter, dieser Weg ist hier nicht geprüft.
- **unbewiesen:** Bildbilanz-, Budget- und Format-Sätze, PDF/PPTX-Grenz- und Leermeldungen, OCR,
  laufende KI-Suche, Warteschlangen-Ende, Verbinden und Abwahl-Nachfrage. Für die meisten ist die
  Auswahllogik einheitengetestet. Einen Flächenfall gibt es für keine davon.
- **Auffällig:** `mergedNote` hat unter `apps/web/src` keinen Produktaufrufer mehr. Das ist ein
  Kandidat für eine Bereinigung, aber kein Fehler.
- **Reparaturschnitt aus den 39:** keiner. „Unbewiesen" heißt „ohne Flächenbeleg", nicht „kaputt".
  Unter den 39 wurde kein reproduzierbarer Fehler gefunden.

## K4 — R-0120 (Ablehnung hörbar, nicht doppelt)

- Vorhanden: `f0120-ablehnung-live-region.test.tsx` (Einzelkomponente, beide Reihenfolgen),
  `abweisung-wird-angesagt-mounted.test.tsx` (T9) und `abweisung-erhaelt-entwurf-chromium.test.ts`
  (T6a–c, Chromium, genau ein Träger).
- Neu: dieselbe Zusage am ganzen Arbeitsraum. Gemessen werden: Ablehnung → Kachel → Ablehnung ergibt
  genau eine Ansage, und zwar die jüngste; eine danach unterstützte Datei räumt die Ansage; wer in EN
  oder NL beginnt, hört die Ablehnung in seiner Sprache. Dazu kommt die Trägerzuordnung aus K1: Die
  vier Ablehnungen des Dateiwegs stehen genau einmal in genau einer Live-Region.
- **Offen:**
  - Ein echter Screenreader oder eine echte Vorlesehilfe (Abnahme laut Register) braucht einen
    Menschen und ist nicht ersetzt.
  - Nach einem Sprachwechsel bleibt die Ansage deutsch (Befund K1).
- **Nacharbeit 1 (Befund Ben, behoben):** `tooLargeForImport` stand im stummen Fehlerkasten UND als
  erst beim Ereignis eingehängter Toast — doppelt und ohne verlässliche Ansage. Jetzt geht er über
  `setFileImportMeldung` in dieselbe dauerhaft montierte Region wie die übrigen Ablehnungen; Fehlerkasten
  und Toast entfallen für diesen Fall. Der Wachen-Dialog (`NavGuardSaveError`) nennt den Satz
  unverändert. Gegenprobe: `abbruch-moduswechsel-chromium.test.ts` (K4, vollständige Anwendung samt
  Toast-Ausgabe: genau ein Träger, die vorher markierte Region, einmal auf der Fläche, Datei und
  Eingabe erhalten) und die jsdom-Zuordnung in `acht-meldungen-drei-sprachen.test.tsx`.
- **Grenze:** `CaptureFileImport` zeigt `meldung ?? importMeldung`. Hat der Mensch NACH der
  Dateiwahl eine nicht importierende Kachel angetippt, verdeckt deren Hinweis eine danach folgende
  Größenablehnung. Nicht gemessen, nicht geändert (das Bauteil ist geteilt).

## K5 — R-0152 (Größengrenze vor der Auswahl)

- Vorhanden: `upload-limits-hint-mounted.test.tsx` (Serverwerte am Bauteil),
  `upload-limits-visible.test.ts` (alle Auswahlstellen, Quelltext) und
  `upload-limits-enforced-e2e.test.ts` (der Server erzwingt die Grenze, eine Admin-Änderung wirkt).
- Neu: Im Arbeitsraum steht der Hinweis unmittelbar vor Ablagefläche und Auswahlknopf. In jsdom folgt
  er der Sprache (DE/EN/NL). In Chromium trägt er genau die Werte, die dieser Server über
  `GET /api/upload-limits` ausliefert.
- **Offen:** eine Sichtung im Betrieb, die Frische der Anzeige nach einer Admin-Änderung in einer
  offenen Sitzung, und die echte Ablehnung einer zu großen Datei an der Fläche.

## K6/K7 — PPTX-Quittung (P-A-PPTX-QUITTUNG, question:K12)

- Laut Quelle geliefert durch JOB 4228 (`1.0.0-beta.1.549`) und JOB 4269 (`1.0.0-beta.1.555`). Die
  Quelle markiert das ausdrücklich als „Source claim, not independently accepted". Deshalb werden die
  vorhandenen Belege im Prüfplan erneut ausgeführt und nicht neu gebaut:
  `quittung-nennt-keinen-bilderverlust.test.ts`, `zwillinge-und-ausgeblendete-bilder.test.ts`,
  `nutzerweg-drei-sprachen-chromium.test.ts` (DE/EN/NL: lesen, speichern, neu laden, annehmen,
  Herkunft), `bildnachweis-gespeichert-chromium.test.ts` (Quittung, tatsächliche Medien,
  Wiederöffnen) und `altbeleg-und-bildbilanz-pg.integration.test.ts` (dauerhaftes Endobjekt in
  PostgreSQL, Altbeleg unverändert).
- `priority:A-PPTX-QUITTUNG:4320d6f685ac` ist eine doppelte Quellenfassung von `P-A-PPTX-QUITTUNG`.

## K8 — Abgrenzung, Quellenwidersprüche, fehlende Belege

- **Widerspruch 1:** P-A-PPTX-QUITTUNG führt „erledigt 17.09.2026 (JOB 4269 LIVE)", question:K12
  „ungeklärt: Verlustfälle bis dauerhaftem Endobjekt". K12 ist die ältere, als historisch markierte
  Zeile und nennt 4269 selbst als Auflösung. Entschieden wird das durch den Lauf der oben genannten
  Belege, nicht durch die Quelle.
- **Widerspruch 2:** R-0152 steht in der Altquelle (Webauswertung 27.07.) als „erledigt", im Register
  als „im Code, nicht abgenommen / teilbelegt". Die neuen Tests belegen die Fläche, nicht den
  Betrieb.
- **Widerspruch 3:** JOB 3379 C1/C2/C4 („Moduswechsel nach Abbruch nicht bedienbar") gelten nur für
  die blattlose jsdom-Bühne. Am Produktweg wird das in Chromium neu gemessen (K2).
- **Abgrenzung:**
  - Die Sprachfolge der acht Meldungen und eine mögliche Abbruchmöglichkeit während des Einlesens
    (C3) sind eigene Reparatur- bzw. Entscheidungsschnitte.
  - OCR, laufende KI-Analyse und Punkt-Warteschlange bleiben als „unbewiesen" stehen. Ihr Weg ist
    nicht Gegenstand dieses Auftrags.
  - Abgeschlossene Teilumfänge: JOB 2969 D1 (F-0120), JOB 4203 D3 (Abweisung in Live-Region,
    Format-Quittungen), JOB 4228/4269 (PPTX).
- **Fehlende Belege:**
  - menschliche Prüfung mit Vorlesehilfe (R-0120)
  - Sichtung im Betrieb (R-0152, PPTX-Weg)
  - Lieferbeleg mit Fassung für diesen Auftrag (entsteht erst mit Veröffentlichung und Deployment)
