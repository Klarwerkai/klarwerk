# Aufnahme `gesamt-fehlermeldungen` — Abgleich und Lieferung

Auftrag `aufnahme:20260922:gesamt-fehlermeldungen` (Revision 1). Basisstand `ceb29795`
(`1.0.0-beta.1.738`). Stand dieser Datei: 08.10.2026.
Auftragsquelle: `gespraech/auftragsaufnahme-01a0c779-20260922/gesamtbestand/auftragsquellen/fehlermeldungen.json`
(fünf Aufnahmepunkte: R-0817, R-0914, R-0948, R-0979, P-Q9).

Die Quelle führt alle fünf Punkte als „Historische Aussage, heutige Erfüllung nicht erneut geprüft".
Jede Einstufung unten ist **am Basisstand im Code gelesen** (Datei, Test). „Live" heißt: an einer
laufenden Instanz gesehen — das hat dieser Lauf **nicht** getan.

## Was dieser Lauf geändert hat

| Datei | Änderung | Punkt |
|---|---|---|
| `services/app/src/routes/ko-routes.ts` | `POST /api/kos/from-document` mit `draftId`: die 404/403-Antworten für unbekannten bzw. fremden Entwurf kommen aus dem Katalog (`DRAFT_NOT_FOUND`, `DRAFT_NOT_VISIBLE`, `meldung(…, sprache(request))`) statt als deutsches Literal. Status, Code und Feldmenge unverändert; der deutsche Wortlaut ist zeichengleich. | P-Q9 |
| `services/app/src/routes/naechster-schritt-entwurf.ts` | Dieselben zwei Literale auf den Katalog umgestellt. Die Route ist in `build-app.ts` **nicht** registriert (Rückbau JOB 1494 D2) — kein Nutzereffekt, nur damit kein Literal dieser Art übrig bleibt. | P-Q9 |
| `tests/q9-entwurfsfehler/entwurfsfehler-sprachfaelle.test.ts` | Abschnitt I: I1/I2 (404 EN/NL), I3/I4 (403 EN/NL), I5 (DE zeichengleich, Draht `toEqual`), I6 (fremder Versuch lässt den Entwurf unberührt) — am echten Draht über `buildApp(buildServices())`. | P-Q9 |
| `tests/q9-serverfehlertexte/katalogschluessel-herkunft.test.ts` | `GEMESSEN_VON` um I1–I4 nachgeführt (H4.2 verlangt die vollständige Liste der Messfälle). | P-Q9 |

## Abgleich je Aufnahmepunkt

| Punkt | Ergebnis heute | Beleg |
|---|---|---|
| R-0817 Serverfehler ohne technische Innenansicht | **erfüllt** (Bestand) | `services/app/src/http.ts` `sendError`: interne Fehler → 500 mit `internalErrorBody` (Katalogsatz `INTERNAL` in der Sitzungssprache), SQLSTATE-Codes mit Ziffern lecken nicht; Diagnose nur im Log. Tests: `tests/q9-fremde-flaechen/interne-antwort.test.ts` (R3 Sprache, R4 „Bestandsschutz G27"), `tests/q9-serverfehlertexte/server.test.ts` R12. Die in der Quelle genannte Kehrseite (Word-Import-Lesefehler als nichtssagender 500) ist für den Dokumentweg durch `job2690` (400 statt maskiertem 500, F2) und die Formfehlerzuordnung der Erfassung adressiert; ein eigener Wortlaut für „falsches Dateiformat beim Word-Import" ist in diesem Lauf **nicht erneut gemessen**. |
| R-0914 Erfassen: zu groß / kein Recht / zu oft — DE/EN/NL, 401 ≠ 403 | **erfüllt** (Bestand, AUFTRAG-JOB507-D4) | Klara in Word: `apps/web/src/lib/wordAddin.ts` `classifyDraftResponse` (401 `auth`, 403 `forbidden`, 413 `too-large`, 429 `rate-limited`), Spiegel in `apps/web/public/word-addin/taskpane.js`; Sätze `sendAuth`/`sendForbidden`/`sendTooLarge`/`sendRateLimited(Unknown)` in DE/EN/NL. Tests: `tests/app/word-addin.test.ts` (403 vs. 401 mit unterschiedlichem Knopf, 429 mit/ohne Retry-After, 413 in DE/EN/NL mit drei verschiedenen Sätzen). Web-Erfassung zusätzlich: `apps/web/src/lib/erfassenFehlersatz.ts` (`tests/erfassung-einstieg/`). Die Quelle nennt „drei Fehlerfälle bleiben offen" (E04, 10.08.) ohne sie zu benennen — **fehlender Beleg**, welche gemeint waren. |
| R-0948 Knöpfe drehen nicht endlos, nennen den Grund | **erfüllt** (Bestand, JOB 2683 D1/D2) | `tests/app/job2683-zwei-knoepfe-flaeche.test.ts` (nie antwortender `fetch` → Frist, hostfreier Grund), Flächen `tests/app/job2683-d2-erkunden-flaeche.test.tsx`, `tests/capture/job2683-d2-suche-flaeche.test.tsx`. Kein Nutzer-Wirkungsbeleg an einer laufenden Instanz. |
| R-0979 Roter Kasten zeigt die Servermeldung statt einer Zahl | **erfüllt** (Bestand, JOB 2690) | `tests/capture/job2690-entwurf-gestaltpruefung.test.tsx` F5 (gemountet: Servermeldung im roten Kasten), `tests/entwurf-fortsetzen-fehlersatz/serversatz-bis-blatt.test.tsx`. |
| P-Q9 Serverfehlertexte in der gewählten Sprache (u. a. echte 401) | **erfüllt** nach diesem Lauf, soweit gemessen | Bestand JOB 3449/3562/3568/3580/3612/3785/3792/3839/3846/3956 (Katalog `services/auth/src/meldungen.ts`, `tests/q9-*`). 401 `NOT_SIGNED_IN` am Rechtetor: `tests/q9-serverfehlertexte/server.test.ts` R11. Rest dieses Laufs: der Dokumentweg (s. oben). |

## Abgrenzung

* Die 15 Katalogschlüssel in `OHNE_ROUTENFALL` (Konto-/Rollenverwaltung, Eingangsprüfungen) sind
  übersetzt, aber ohne EN/NL-Routenfall — gesonderter Verwaltungsweg-Rest aus JOB 3785, nicht Teil
  dieses Laufs.
* Weitere deutsche Techniksätze am Dokumentweg (`documents fehlt …`, `draftPayload fehlt …`,
  `expectedUpdatedAt fehlt …`) sind Vertragsfehler eines Aufrufers, die die Oberfläche nicht
  erzeugt; sie bleiben unverändert und sind hier nur benannt.
* Q8 (Profil-Persistenz der Sprache) ist ausdrücklich nicht Teil von P-Q9.
* **Unveränderter fremder Basisfehler (Nacharbeit 1):** `tests/q9-fremde-flaechen/keine-deutschen-literale.test.ts`
  ist schon an der Basis `ceb29795` rot (R5, R6 Fundzahl/Ausnahmenzahl, R7 Kalibrierung). Er findet in
  `services/app/src/routes/capture-routes.ts` drei Stellen, die keine Ausnahme tragen:
  `error: "DOKUMENT_UNBEKANNT"` und der Satz „Diese Dokumentkennung wurde hier nicht vergeben …"
  (`sendeUnbekannteDokumentkennung`, eingeführt mit `4a88a5ef` „Importiertes Wissen mit dauerhafter
  Herkunft …") sowie „confidentiality muss intern, vertraulich oder streng_vertraulich sein." an der
  .docx-Übernahme (`f4ee706e` „Vertraulichkeitswahl beim Erfassen …"). Weder die Datei noch der
  Wächter sind in diesem Auftrag verändert. Es sind 400-Antworten des Word-/.docx-Wegs, nicht die
  401-Texte von P-Q9; für diesen Weg hält der Wächter fest, dass er „als Ganzes übersetzt" gehört.
  Ob übersetzt oder als begründete Ausnahme eingetragen wird, ist eine offene Folgezeile der
  Q9-Kette und hier **nicht** entschieden. Der Wächter bleibt unverändert rot im Bestand.
* Die ASCII-Schreibweise „verfuegbar" bleibt (Bestandsentscheidung JOB 3956, mehrere Pins).

## Fehlende Belege

* Keine Live-Sichtung an einer laufenden Instanz für einen der fünf Punkte (insbesondere P-Q9
  „Live 1.97" — die Gegenprobe DE/EN/NL an einem echten 401 einer laufenden Instanz fehlt weiter).
* R-0914: welche „drei Fehlerfälle" E04 offen ließ, ist in der Quelle nicht benannt.
* R-0817: der Word-Import-Fall „falsches Dateiformat" ist nicht eigens gemessen.
