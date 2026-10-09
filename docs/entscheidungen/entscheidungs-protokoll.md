# Entscheidungs-Protokoll: Antwortexport mit Zeitstempel und Nutzer-ID (R-1643)

*Aufnahme 20260922 · gesamt-entscheidungsbeleg-export (R-1643, Alias ROADMAP:6.1). Basisstand
`ceb29795`.*

Originalwortlaut (Funktions-Roadmap 6.1, in der Auftragsquelle zitiert, Datum dort `null`): „Jede
KLARWERK-gestützte Entscheidung […] kann mit einem Klick als Audit-Dokument exportiert werden — PDF
mit allen Quellen, Trust-Werten, Argumentationskette, Zeitstempel, Nutzer-ID."

## Abgleich vor der Umsetzung

Am Basisstand per Quelleninspektion festgestellt:

| Teil des Wortlauts | Bestand vor R-1643 | Beleg |
| --- | --- | --- |
| mit einem Klick exportieren | vorhanden: „Kopieren", „Als Markdown", „Drucken / PDF" an der Antwortkarte | SCRUM-430, `apps/web/src/lib/answerExport.ts` |
| alle Quellen (rückverfolgbar) | vorhanden im Markdown, mit stabiler Kennung | JOB 502, `tests/ask/answer-export.test.ts` |
| Trust-Werte | vorhanden im Markdown (Antwort und je Quelle) | SCRUM-430, `tests/ask/answer-export.test.ts` |
| tragend/konsultiert, KI-Kennzeichnung | vorhanden im Markdown | mega62 E, `tests/legal/mega62-export-kennzeichnung.test.ts` |
| **Argumentationskette** | **fehlte**: `result.steps` sind die herangezogenen Kandidaten (Titel + Kernaussage, direkt aus `relevant`), keine Begründung | `services/reasoner/src/provider-model.ts` (Ben, Nacharbeit 2) |
| **Zeitstempel** | **nur der Tag** (`YYYY-MM-DD`) in Fußnote und Kopfblock | `answerExport.ts` vor R-1643 |
| **Nutzer-ID** | **fehlte** | — |
| **PDF mit allen Angaben** | **fehlte**: der Druck zeigt die Karte, Quellen/Schritte/Wert liegen hinter „Mehr" und standen nicht auf dem Blatt | `pages/Ask.tsx`, `.print-area` |

## Lieferung

- `answerExport.ts`: optionales `protocol` (`userId: string | null` als Pflichtfeld darin). Mit
  Protokoll trägt die Datei im Kopfblock `exported-at:` (voller ISO-Zeitstempel, UTC) und – nur wenn
  eine Kennung feststeht – `user-id:`, im Text den Abschnitt „Entscheidungs-Protokoll" mit Zeitpunkt
  und Nutzer-ID bzw. „nicht angemeldet – keine Kennung vorhanden". Ohne Protokoll bleibt die Datei
  zeichengleich.
- `pages/Ask.tsx`: Die Exporteingabe wird einmal gebaut (`buildExportInput`) und von Kopieren,
  Markdown und Druck gelesen. Die Nutzer-ID ist die Kontokennung, unter der die Seite schon den
  Arbeitsstand führt (`useKontoKennung`, Sitzungsabfrage `["auth", "me"]`), ohne Ersatzwert.
- `components/fragen/Entscheidungsprotokoll.tsx` + `.print-only` in `index.css`: Beim „Drucken /
  PDF" steht das Protokoll (Zeitpunkt, Nutzer-ID, Einstufung mit Vertrauenswert, Schritte, Quellen mit
  Kennung und Wert) in der Druckfläche; auf dem Bildschirm nie, nach `afterprint` wieder weg.
- **Argumentationskette (Nacharbeit 2)**: neues Antwortfeld `AnswerResult.argumentation` —
  je Aussage der Antwort die Quelle, deren Wortlaut sie belegt. Es ist die Zuordnung, die
  `pruefeDeckung` ohnehin misst, bevor ein Modelltext hinausgeht (`argumentationAus`); auf dem
  Rückfallweg je ausgegebenem Quellenwortlaut seine Quelle, auf dem deterministischen Weg ein Glied
  (die Antwort ist der Wortlaut der besten Quelle). Kein zusätzlicher Modellaufruf, kein formulierter
  Text. Ohne Antwort fehlt das Feld (auch nach der Herabstufung im Ask-Service). Export und Druck
  zeigen die Kette nummeriert („Aussage" — belegt durch: Titel `Kennung`); fehlt sie, steht dort
  ausdrücklich, dass keine vorliegt — die Schritte springen nicht ein.
- Texte DE/EN/NL: `ask.export.protocol.*`.
- Tests: `tests/ask/r1643-entscheidungsprotokoll.test.ts` (Dateivertrag),
  `tests/ask/r1643-entscheidungsprotokoll-druck.test.tsx` (echte Fragenseite: Druckaugenblick,
  ohne Sitzung, Kopieren), `tests/reasoner/r1643-argumentationskette.test.ts` (Kette aus der
  Deckung, drei Antwortwege).

## Zusammenführung mit main (Kandidat 13cf27a8)

Konflikte in `api/types.ts`, `lib/answerExport.ts`, `pages/Ask.tsx` und `reasoner/src/provider-model.ts`.
Beide Seiten bleiben erhalten:

- `AnswerResult` (Web): main's `belastbarkeit`, `aiGenerated` und `zuordnungUnbekannt` stehen neben
  R-1643 `argumentation`. main's eigene Kette R-1627 (`belastbarkeit.argumentation`: Stufen je
  tragender Quelle, kuratierte Beziehungen, Einwände, Schluss) ist ein **anderes** Feld und bleibt
  unverändert. Ob das Protokoll sie zusätzlich exportieren soll, ist eine offene Produktentscheidung.
- Kopfblock: Die KI-Zeilen folgen main's dreiwertiger Herkunft (bei „ohne-ki“ entfallen sie). Die
  Protokollzeilen `exported-at`/`user-id` sind keine KI-Aussage und bleiben. Ohne Protokoll gilt
  main's Verhalten zeichengleich: bei „ohne-ki“ kein Kopfblock.
- Fragenseite: main's `exportEingabe` (Markdown, Word, PowerPoint, PDF) trägt das R-1643-Protokoll; der
  Druck liest dieselbe Eingabe. main's Quellenreihe, Belegstellen-Links und Datei-Downloads bleiben
  unverändert.
- Reasoner-Importe: main's Liste plus `ArgumentationsGlied`.

## Abgrenzung

- **Auditkette (R-2206, `gesamt-auditprotokoll`)**: die serverseitige, unveränderliche Kette über
  Aktionen samt `/api/audit/export` ist ein gesonderter Auftrag mit eigenen Belegen
  (`docs/entscheidungen/gesamt-auditprotokoll.md`, `audit-aktionsabdeckung.md`). Sie wird hier weder
  geändert noch erneut geprüft. Der Antwortexport schreibt **keinen** Auditeintrag; das verlangt der
  Wortlaut nicht.
- Die mobile Fläche hat keinen Antwortexport; sie ist nicht Teil dieser Lieferung.
- **Fremder Basisfehler (nicht von R-1643 verursacht, nicht hier behoben)**:
  `tests/ask-c02/konflikt.test.ts` K1/lang, K3 und K4 waren am Kandidaten `4f132f8b` rot, alle mit der langen
  Frage aus JOB 3365. Das Modell wurde dabei nie gefragt. Quelleninspektion: Das Tor R-0473 (K8,
  `decktAlleFragebegriffe`, `services/ask/src/service.ts` vor `waehleKandidaten`) bindet auch die
  Rahmenwörter der langen Frage („English", „cite", „stored" …), die keine Quelle trägt, und filtert so
  beide Quellen vor dem Reasoner heraus. K1/kurz im selben Lauf ist grün. Die Abstimmung zwischen
  R-0473 und JOB 3365 ist eine offene Produktentscheidung außerhalb dieses Auftrags.
- **Fremder Basisfehler 2 (nicht von R-1643 verursacht, nicht hier behoben)**:
  `tests/klara-quellen-nutzerweg/zwei-quellen-bleiben-zwei.test.ts` W2 war am Kandidaten `ffc3ffd8` rot,
  und zwar schon im Testaufbau: `admin-validate` der zweiten, wortgleichen Quelle liefert 409
  `DUPLICATE_ACK_REQUIRED` aus dem Dublettentor (`services/app/src/routes/validation-routes.ts`,
  `dublettenTor`). Die wortgleiche Kopie ist eine offene Dublette, und der Testaufbau schickt kein
  `duplicateAcknowledged: true` mit. Gefragt wird in W2 gar nicht erst. W1 (zwei abweichende Fristen,
  geänderter Rückfall mit zwei Quellen über `POST /api/ask`) ist im selben Lauf grün.

## Quellenwidersprüche und offene Grenzen

1. **PDF**: Zum Basisstand `ceb29795` hatte das Produkt keinen PDF-Erzeuger; das PDF entstand nur über
   den Browserdruck. Seit der Zusammenführung mit main (Kandidat `13cf27a8`) erzeugt
   `lib/antwortDateien.ts` (R-0703) echte Word-, PowerPoint- und PDF-Dateien. Ihr gemeinsamer Inhalt
   (`antwortAbsaetze`) trägt jetzt auch das Entscheidungs-Protokoll mit Zeitpunkt, Nutzer-ID und
   Argumentationskette, über dieselben Hilfen wie Markdown und Druck. Der Druckweg bleibt daneben.
   Ein in einem PDF-Betrachter geöffnetes Ergebnis ist nicht belegt; geprüft sind der Inhalt
   (`antwortAbsaetze`) und dass die Datei ohne Abbruch entsteht.
2. **Argumentationskette**: Geliefert ist die belegte Kette „Aussage → Quelle, deren Wortlaut sie
   enthält". Eine Begründung in Form freier Schlussfolgerungen zwischen den Aussagen erzeugt das
   Produkt bewusst nicht (Zitatdeckung, JOB 2659: der Modelltext darf auswählen, nicht
   umformulieren). Antworten älterer Server oder gespeicherte Antworten von vor dieser Änderung haben
   keine Kette; das Protokoll sagt das. Ein Ergebnisbeleg an einem echten Modelllauf liegt nicht vor
   — geprüft ist mit einem Fake-Modell (dieselben Wortlaute wie job2659 P1/P2).
3. **Nutzer-ID**: Es ist die Kennung der **exportierenden** angemeldeten Person, nicht der Person, die
   auf dieser Grundlage entschieden hat. Eine „Entscheidung" als eigenes Objekt gibt es im Produkt nicht.
4. **Trust in Prozent**: Der Wortlaut schreibt „Trust 91 %"; exportiert wird der Wert wie überall im
   Produkt als Zahl (0–100) mit dem übersetzten Wort für Vertrauen.
5. **Steuerungsempfehlung**: ES-055/EC-20260905-R-1643 (05.09.2026) empfahlen „später". Der aktuelle
   Auftrag (22.09.2026) ordnet R-1643 zur Bearbeitung zu und ist jünger.
6. Die Altquelle `KLARWERK-Funktions-Roadmap.md:159` liegt außerhalb des Arbeitsbaums und wurde nicht
   gelesen; maßgeblich war der in der Auftragsquelle zitierte Wortlaut.
