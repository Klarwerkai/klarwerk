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

## Die drei Anliegen

| Kennung | Originalsatz (gekürzt) | Stand heute im Code | Beleg (Testdatei) | Urteil |
|---|---|---|---|---|
| **R-0104** | Wissen per gesprochenem Wort erfassen und Fragen stellen, als eigener Vorgang im Großkundenvorlauf, über das browsereigene Diktat hinaus | Browser-Diktat im Erfassungsblatt (`components/erfassen/Blatt.tsx`), im Fragefeld (`pages/Ask.tsx`) und im Startfeld (`pages/Start.tsx`, `components/start/useDiktat.ts`). Gemeinsame Rekorder-Fabrik `lib/speechDictation.ts`. Vorlesen der Antwort (`components/fragen/useVorlesen.ts`). Dazu die **serverseitige Transkription hochgeladener Audio- und Videodateien** (`services/media/src/transcriber.ts`, `POST /api/media/analyze`), nur mit zentraler KI-Freigabe | `tests/diktat-fragefeld/mikrofon-im-fragefeld.test.tsx`, `tests/diktat-fragefeld/sprechen-und-vorlesen.test.tsx`, `tests/app/f0121-aufnahme-verschriftlichen.test.ts`, `tests/admin-ki-freigabe/transkription-grundfreigabe.test.ts` | **Teilweise.** Sprechen und Fragen per Stimme gibt es, aber nur über das Browser-Diktat. „Darüber hinaus“ gibt es nur den **Datei**weg (Aufnahme hochladen → Transkript). Eine Aufnahme im Browser mit Server-Transkription fehlt. Siehe O1 und O2 |
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
- **W4 · „Kein Cloud-STT“.** `lib/speechDictation.ts:14-16` und `lib/speechSupport.ts` versprechen
  für das Diktat ausdrücklich „kein Cloud-STT, kein Backend“. R-0104 verlangt einen Weg „über das
  browsereigene Diktat hinaus“. Das ist kein Fehler im Code, aber eine offene Richtungsfrage (O1).

## Offen

- **O1 · Aufnahme im Browser mit Server-Transkription (R-0104).** Dafür fehlt eine Entscheidung,
  nicht nur Code. Sie würde einen neuen Ausgangsweg für Sprache öffnen, entgegen dem dokumentierten
  Diktatversprechen (W4). Zu klären wären Anbieter, Einwilligung, Freigabe und Speicherung der
  Aufnahme. Die Quelle nennt keine Begründung („Begründung nicht dokumentiert“), Zustand
  „angedacht“, Altstatus SPÄTER. Deshalb ist hier nichts gebaut.
- **O2 · „Eigener Vorgang im Großkundenvorlauf“ (R-0104).** `OFFEN.md` E2g führt die Spracheingabe
  als einen der wiederbelebten Vorgänge, Anker `MIT-GROSSKUNDE`, Zustand OFFEN. Als eigene Zeile
  mit Abnahmesatz fehlt sie. Der Kundenvorlauf selbst (Anmeldung, Instanz, Termin) braucht
  Kundenkontakt und liegt außerhalb dieses Auftrags (Nichtziel).
- **O3 · Wirkung in echtem Word und mit echtem Mikrofon.** Alle Belege oben sind jsdom-, Unit- oder
  Routentests mit Attrappen. Eine menschliche Bedienung im echten Word-Host, ein echter
  Anbieterlauf des Formulierers und ein Diktat mit echtem Mikrofon fehlen. Abgegrenzt ist der
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

Neu ist nur die Testdatei `tests/zuruf-wissen/diktat-wird-entwurf.test.ts` (R-0105). Am Produktcode
ändert dieser Lauf nichts. Welche Tests der Prüfadapter ausführt, steht im Prüfplan des Auftrags.
Ihre Ergebnisse stehen in dessen Bericht, nicht in diesem Dokument.
