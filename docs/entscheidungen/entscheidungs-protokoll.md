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
| Argumentationskette | nur als Schritte (`result.steps`) im Markdown | s. Widerspruch 2 |
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
- Texte DE/EN/NL: `ask.export.protocol.*`.
- Tests: `tests/ask/r1643-entscheidungsprotokoll.test.ts` (Dateivertrag),
  `tests/ask/r1643-entscheidungsprotokoll-druck.test.tsx` (echte Fragenseite: Druckaugenblick,
  ohne Sitzung, Kopieren).

## Abgrenzung

- **Auditkette (R-2206, `gesamt-auditprotokoll`)**: die serverseitige, unveränderliche Kette über
  Aktionen samt `/api/audit/export` ist ein gesonderter Auftrag mit eigenen Belegen
  (`docs/entscheidungen/gesamt-auditprotokoll.md`, `audit-aktionsabdeckung.md`). Sie wird hier weder
  geändert noch erneut geprüft. Der Antwortexport schreibt **keinen** Auditeintrag; das verlangt der
  Wortlaut nicht.
- Die mobile Fläche hat keinen Antwortexport; sie ist nicht Teil dieser Lieferung.

## Quellenwidersprüche und offene Grenzen

1. **PDF**: Das Produkt hat keinen PDF-Erzeuger (s. `mega62-export-kennzeichnung.test.ts`). Das PDF
   entsteht über den Browserdruck („Als PDF sichern"). Ob das gedruckte Blatt in jedem Browser
   vollständig aussieht, ist nur per Quelle und jsdom geprüft, nicht an einem echten Druckdialog.
2. **Argumentationskette**: Laut mega39 D2 (`pages/Ask.tsx`) „existiert keine protokollierte
   Herleitung"; exportiert werden die Schritte, die der Reasoner liefert (Fundstellen mit Auszug). Eine
   echte Begründungskette verspricht dieser Export nicht.
3. **Nutzer-ID**: Es ist die Kennung der **exportierenden** angemeldeten Person, nicht der Person, die
   auf dieser Grundlage entschieden hat. Eine „Entscheidung" als eigenes Objekt gibt es im Produkt nicht.
4. **Trust in Prozent**: Der Wortlaut schreibt „Trust 91 %"; exportiert wird der Wert wie überall im
   Produkt als Zahl (0–100) mit dem übersetzten Wort für Vertrauen.
5. **Steuerungsempfehlung**: ES-055/EC-20260905-R-1643 (05.09.2026) empfahlen „später". Der aktuelle
   Auftrag (22.09.2026) ordnet R-1643 zur Bearbeitung zu und ist jünger.
6. Die Altquelle `KLARWERK-Funktions-Roadmap.md:159` liegt außerhalb des Arbeitsbaums und wurde nicht
   gelesen; maßgeblich war der in der Auftragsquelle zitierte Wortlaut.
