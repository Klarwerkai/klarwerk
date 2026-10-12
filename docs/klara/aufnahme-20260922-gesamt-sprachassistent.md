# Aufnahme 20260922 · Gesamt-Sprachassistent — Abgleich je Anliegen

Auftrag `aufnahme:20260922:gesamt-sprachassistent`, Revision 1. Abgeglichen am 08.10.2026 gegen den
Stand **1.0.0-beta.1.763** (Basis `6a7fea2f`).

Dies ist ein **Abgleich mit dem vorhandenen Stand**. Fertige Teile werden nicht neu gebaut, und
offene Teile werden als offen genannt. Die Auftragsquelle mit Originalwortlaut, Herkunft und
Altbelegen liegt **nicht** im Arbeitsbaum. Sie wurde dem Lauf als `QUELLEN.json` beigegeben
(Registerauszug `REGISTER-SNAPSHOT.json`, sha256 `6e22ce8e…`). Die Kennungen R-0104, R-0105 und
R-0376 kommen im Repository nicht vor. Alle drei tragen dort `pruefstatus: nur_altquelle`, also:
„Historische Aussage, heutige Erfüllung nicht erneut geprüft“.

Fassungsangaben: Die Commit-Kennungen unten stammen aus der Quelle oder aus Vermerken im Code. Ihre
erste `ship:`-Fassung wurde in diesem Lauf **nicht** nachgeschlagen, weil die Git-Historie hier
nicht lesbar war. Der echte Lieferbeleg dieses Auftrags entsteht erst mit Deployment und
Livefassung (K4).

**Nacharbeit 1 (Bens Befunde zum Kandidaten `366e624e`):**

- **Befund zu Zeile 51 (O1):** Die behauptete Entscheidungssperre ist entfernt. Sie war aus dem
  Kommentar zum Browser-Diktat abgeleitet und durch keine Nutzersperre und keine externe
  Voraussetzung belegt. Der weitergehende Sprachweg ist jetzt gebaut und nutzt die vorhandene
  Transkription (siehe R-0104 und „Der Sprachweg“ unten).
- **Befund zu Zeile 56 (O2):** Der Sprachvorgang steht jetzt als eigene Zeile `E2g-SPRACHE` in
  `OFFEN.md`, Abschnitt 4 („Nach Ship 6, vor dem Großkunden“). Die Zeile nennt Zielzustand,
  Abnahmesatz, Bezug zu E2g, R-0104 und JOB 1000 sowie die für den Kundentermin offenen Mittel.

## Die drei Anliegen

| Kennung | Originalsatz (gekürzt) | Stand heute im Code | Beleg (Testdatei) | Urteil |
|---|---|---|---|---|
| **R-0104** | Wissen per gesprochenem Wort erfassen und Fragen stellen, als eigener Vorgang im Großkundenvorlauf, über das browsereigene Diktat hinaus | **Bestand:** Browser-Diktat im Erfassungsblatt, im Fragefeld und im Startfeld (`lib/speechDictation.ts`), Vorlesen der Antwort, Datei-Transkription (`POST /api/media/analyze`). **Neu (Nacharbeit 1):** Knopf „Aufnehmen“ im Erfassungsblatt (`blatt-werkzeug-aufnehmen`) und am Fragefeld (`ask-sprachaufnahme`). Die Aufnahme geht an die vorhandene Transkription (`POST /api/media/transcribe` → `MediaAnalysisService.transcribeRecording`) und wird nicht gespeichert. Das Transkript wird angehängt. **Vorgang:** `OFFEN.md` Zeile `E2g-SPRACHE`, Anker `MIT-GROSSKUNDE` | `tests/admin-ki-freigabe/sprachaufnahme-transkription.test.ts`, `tests/sprachweg/sprachaufnahme-lib.test.ts`, `tests/sprachweg/aufnahme-im-fragefeld.test.tsx`, `tests/sprachweg/aufnahme-im-blatt.test.tsx`; Bestand: `tests/diktat-fragefeld/*`, `tests/app/f0121-aufnahme-verschriftlichen.test.ts`, `tests/admin-ki-freigabe/transkription-grundfreigabe.test.ts` | **Im Code erfüllt**, sobald die neuen Tests im Prüflauf grün sind. Offen bleiben Betriebsmittel und eine Bedienprobe (O1, O3) |
| **R-0105** | Der Anwender ruft zu, was festgehalten werden soll; das System erstellt daraus einen Wissenseintrag, ohne Formular | Diktat ins Erfassungsblatt → „Sichern“. Nötig ist nur Inhalt (`canSave = hasSavableContent && !busy`). Titel, Kernaussage, Typ und Bereich leitet `createFrontDoorDraft` (`lib/captureFrontDoor.ts`) aus dem Gesagten ab. Es entsteht ein **Entwurf**, kein validiertes Wissensobjekt | **neu:** `tests/zuruf-wissen/diktat-wird-entwurf.test.ts`. Dazu `tests/cap-p1-fruehe-eingabe/blatt-fruehe-eingabe.test.tsx` (L-B1: Endgültiges landet genau einmal im Editor) | **Erfüllt für den Entwurf.** Beim Einreichen bleibt die Wahl der Vertraulichkeit Pflicht (JOB 3082). Das ist eine bewusste Sperre, kein Formularrest. Die Quelle ordnet R-0105 KA6 zu („die Sache übernimmt JOB 1491“), siehe W2 |
| **R-0376** | KA6: Klara formuliert auf Zuruf; Vorschlag im Panel, Einfügen nur auf Klick; Herkunft oder KI-Kennzeichnung; nie selbsttätig | Erzeuger `services/output/src/zuruf.ts`: kein Schreibfeld im Ergebnis, `aiGenerated`, `herkunft` (`bestand`/`frei`), `provenance`, `anbieter`/`modell`. Einwilligung über das Sitzungstor (JOB 3026). Route `POST /api/klara/sessions/{id}/zuruf` (`services/app/src/routes/klara-session-routes.ts`). Panel: drei Zurufe und Memo-Block in `apps/web/public/word-addin/taskpane.html` | `tests/output/ka6-zuruf.test.ts`, `tests/ka6/job3026-riegel-am-erzeuger.test.ts`, `tests/ka6-memo-panel/memo-route.test.ts`, `tests/ka6-memo-panel/memo-panel-mounted.test.ts`, `tests/app/word-addin-ask.test.ts` (Block „JOB 1153 · KA6 Stufe 1“) | **Im Code erfüllt, Stufen 1 und 2.** Ein Beleg aus echtem Word fehlt (O3) |

## Quellenwidersprüche

- **W1 · KA6 Stufe 2 „FEHLT“ gegen den heutigen Code.** Die Quelle (Stand 21./26.08.) führt den
  externen Riegel als FEHLT/geparkt („NICHT schneiden. Parken.“, Kennung O1). Heute liegt der Riegel
  im Erzeuger. `ZurufEingabe` hat kein Einwilligungsfeld mehr, gefragt wird
  `KlaraSessionService.pruefeExterneAusfuehrung` (JOB 3026). Außerdem steht
  `KLARA_EXTERNAL_EXECUTION_MIGRATED = true` (`services/reasoner/src/klara-policy.ts:273`). Der
  Vermerk im Testkopf von `job3026-riegel-am-erzeuger.test.ts:20-23` („eine Route gäbe es nicht,
  weil … auf `false` steht“) ist damit selbst überholt: Die Route besteht seit JOB 3091/3110/3134.
  Ein BEN-Urteil zu JOB 3026 ist im Arbeitsbaum nicht einsehbar.
- **W2 · Zuordnung von R-0105.** Der Name lautet „Wissen auf Zuruf erstellen (KA6)“, die Herkunft
  ist JOB 1146 „KA6-SCHREIBEN-AUF-ZURUF-ERSTELLEN“. Der Satz verlangt aber einen
  **Wissenseintrag**, während KA6 einen **Textvorschlag im Word-Dokument** erzeugt. Beide Lesarten
  sind hier belegt: Den Wissenseintrag deckt der Blatt-Weg (Entwurf), den Textvorschlag deckt
  R-0376. Welche Lesart gemeint war, sagt die Quelle nicht.
- **W3 · JOB 1491 grün oder rot.** Die Quelle benennt den Widerspruch selbst: Der Pedi-Eingang vom
  21.08. führt JOB 1491 D1 als grün und eingebaut (`2eaa857`), der Relay-Jobindex führt ihn bei D10
  als rot und geparkt. Im Code ist die Stufe-1-Fläche vorhanden (siehe Tabelle). Das Relay-Urteil
  ist hier nicht einsehbar.
- **W4 · „Kein Cloud-STT“ (in Runde 1 falsch eingeordnet).** `lib/speechDictation.ts:14-16` und
  `lib/speechSupport.ts` beschreiben nur den **Diktatweg**. Daraus folgt keine Sperre für einen
  weiteren Sprachweg. Das Diktat bleibt unverändert und schickt nichts an den Server. Die Aufnahme
  ist ein eigener Knopf, und ihr Weg nach draußen ist der der vorhandenen Transkription.

## Der Sprachweg (Nacharbeit 1)

Neu gebaut ist nur ein **Eingang** zur vorhandenen Transkription. Der Dienst selbst ist derselbe.

- **Server:** `MediaAnalysisService.transcribeRecording` (`services/media/src/service.ts`) prüft in
  derselben Reihenfolge wie `analyze`: Vertraulichkeit (zweite Adminfreigabe), Dienst vorhanden,
  zentrale Grundfreigabe. Danach ruft sie denselben gekapselten Transkriber. Die Aufnahme kommt
  aus dem Rumpf und wird **nicht** im Objektspeicher abgelegt. Ohne genannte Stufe gilt sie als
  vertraulich. Route `POST /api/media/transcribe` (`ko.read`, Anmeldung vor dem Einlesen, Grenze
  20 MiB) mit Einträgen in Routenaudit, Lesewege-Sammler, KI-Anfragebremse und HTTP-Referenz.
- **Oberfläche:** Haken `components/sprache/useSprachaufnahme.ts` (MediaRecorder,
  Mikrofon aus beim Stopp, beim Abbau und nach 5 Minuten) und DOM-freie Hilfen in
  `lib/sprachaufnahme.ts`. Das Blatt verschriftlicht unter der **gewählten** Stufe. Das Fragefeld
  nutzt „intern“, weil auch die getippte Frage auf `/fragen` ohne Vertraulichkeitsmarke an den
  Reasoner geht; markiert wird nur der Dokumenttext des Word-Panels
  (`services/ask/src/service.ts`, `dokumenttextVertraulich`). Im Blatt trennt
  `diktatVomBlattTrennen` auch die Aufnahme: Laden, anderen Entwurf öffnen und Verwerfen machen
  ein spätes Transkript wirkungslos.
- **Ohne Text kein Text:** Fehlen Schlüssel oder Freigabe, oder ist der Inhalt vertraulich, dann
  steht der Satz des Servers als Hinweis da. Erfunden wird nichts.

## Offen

- **O1 · Betriebsmittel für den Sprachweg.** In der jeweiligen Instanz müssen ein
  Transkriptionsschlüssel (`MEDIA_TRANSCRIBE_API_KEY`) und die zentrale KI-Freigabe gesetzt sein.
  Das ist Betrieb, kein Produktfehler. Ohne beides sagt die Fläche ehrlich, warum kein Text kommt.
- **O2 · Kundenvorlauf.** Die interne Zuordnung steht als `E2g-SPRACHE` in `OFFEN.md`. Den Termin
  mit dem Großkunden, seine Instanz und seine Anmeldung organisiert dieser Auftrag nicht
  (Nichtziel: kein Kundenkontakt).
- **O3 · Wirkung in echtem Word und mit echtem Mikrofon.** Alle Belege oben sind jsdom-, Unit- oder
  Routentests mit Attrappen. Eine menschliche Bedienung im echten Word-Host, ein echter
  Anbieterlauf des Formulierers und eine Aufnahme oder ein Diktat mit echtem Mikrofon fehlen.
  Ebenso fehlt ein echter Lauf beim Transkriptionsanbieter. Abgegrenzt ist der
  bestehende M365-Folgeauftrag zur Realabnahme (siehe
  `docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md`).

## Abgrenzung

- KA1–KA5, KA7 und KA8 sowie die Dachfunktion R-0380 gehören zum Auftrag
  `aufnahme:20260922:gesamt-klara-assistenz` (`docs/klara/aufnahme-20260922-gesamt-klara-assistenz.md`).
  Dort steht KA6 nur als Zeile mit Verweis. Die Prüfung von KA6 gehört zu diesem Auftrag.
- Die Diktat-Bausteine (JOB 3038, JOB 3064 H5, JOB 3141, JOB 3256), die Datei-Transkription
  (F-0121, JOB 2955) und die zentrale Transkriptionsfreigabe stammen aus abgeschlossenen
  Aufträgen. Sie werden hier nur als Bestand genannt.
- Verwandte Registerzeilen aus der Quelle, die diesem Auftrag **nicht** zugeordnet sind: R-1779 und
  R-1818 sowie „Diktat statt Tippen im Browser“.

## Prüfung in diesem Lauf

Runde 1 fügte nur `tests/zuruf-wissen/diktat-wird-entwurf.test.ts` (R-0105) hinzu. Ihr Prüflauf
am Kandidaten `366e624e` war grün: 189 Fälle in elf Dateien, Bau und Format bestanden
(`HISTORIE/nacharbeit-1/PRUEFUNG`). Nacharbeit 1 ändert Produktcode (siehe „Der Sprachweg“).
Welche Tests der Prüfadapter dafür ausführt, steht im Prüfplan des Auftrags; die Ergebnisse
stehen in dessen Bericht, nicht in diesem Dokument.

**Nacharbeit 2 (Prüflauf am Kandidaten `3565804e`):** Grün waren die neuen Sprachwegtests, die
Bestandstests der berührten Wege, die Chromium-Zielbilder und der Bau. Rot waren acht Fälle der
globalen Routenwächter (HTTP-Referenz, Rollenabnahme, Zeilenrecht, Lesewege-Sammler,
Routenaudit). Alle betreffen Routen anderer Aufträge aus dem integrierten Hauptstand, darunter
spaces, begriffe, ausgangspruefung, mcp, library-import, duplicates-merge und drafts-pool.
`POST /api/ask` erscheint als „public“, weil `mcp-routes.ts` den Pfad in einem
Weiterleitungsaufruf nennt. `POST /api/media/transcribe` stand in keiner dieser Fehlerlisten. Die
Wächter bleiben unverändert. Die neue Tür prüft gezielt
`tests/sprachweg/transcribe-in-den-registern.test.ts`.

**Nacharbeit 3 (Bens Befund zu `useSprachaufnahme.ts:126`):** Zwischen dem Ende einer Aufnahme
und ihrem Versand liegt das asynchrone Einlesen (`FileReader`). Bisher wurde die Generation erst
nach dem Serveraufruf geprüft, und die Stufe wurde erst nach dem Einlesen aus den aktuellen
Optionen gelesen. Jetzt hält `onstop` Generation, Stufe und Sprache synchron als „Vorgang“ fest.
Nach dem Einlesen und unmittelbar vor dem Netz wird die Generation geprüft, eine getrennte
Aufnahme wird verworfen. Gegenproben mit angehaltenem Leser: `aufnahme-im-blatt.test.tsx`, Fälle
E4 bis E7 (verwerfen, anderer Entwurf mit eigener Stufe, Stufenwechsel nach dem Ende,
Kalibrierung).
