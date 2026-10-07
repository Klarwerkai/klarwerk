# R-0328 · Nachfolger der Schrägstrich-Zitate — lesende Umstellbarkeitsprüfung

Aufnahme 20260922 · antwort-quellenanzeige. Originalpunkt R-0328: „Die bisherige Zitierweise mit
Schrägstrichen bekommt einen Nachfolger; die Umstellbarkeit wird vorab nur lesend geprüft.“
Herkunft laut Register: `PLAN-PRO-DEMO-UX-V1-U1-A4-SLASH-NACHFOLGER-READINESS-220` („read-only
Readiness“, 03.08.2026), kein Bau- oder Urteilsbeleg.

Diese Prüfung ist **nur lesend**. Sie ändert keinen Zitierweg und trifft keine Produktentscheidung.

## Geprüfte Fassung

Arbeitsbaum des Auftrags `auftrag-722f9fccf4b213607792`, Basis `863a0974`, Stand nach Kandidat
`36386e17` (Nacharbeit 3). Gelesen wurden ausschließlich Dateien im Produktbaum.

## Befund 1 — Im Produkt gibt es heute keine Zitierweise mit Schrägstrichen

Suche nach `slash`, `Slash`, `Schrägstrich`, `Schraegstrich`, `Zitierweise`, `Zitierform` in
`apps/web/src`, `apps/web/public/word-addin`, `services`, `docs`, `specs`: nur fachfremde Treffer
(URL-Normalisierung, Tabellen-Escaping, selbstschließende Tags, Trailing-Slash-Regeln). Kein
Quellenverweis wird mit `/` zusammengesetzt, geparst oder angezeigt.

Folge: Der Gegenstand „bisherige Zitierweise mit Schrägstrichen“ ist im heutigen Produkt **nicht
auffindbar**. Er lässt sich nur über den Planeintrag `…-READINESS-220` bestimmen, der außerhalb des
Produktbaums liegt und hier nicht gelesen wurde (Leseumfang des Auftrags).

## Befund 2 — Der heute tatsächlich gelieferte Zitierweg (Ist-Bestand)

| Ebene | Form | Fundstelle |
|---|---|---|
| Modelltext (Reasoner) | Fußnotenmarke `[n]`, Gruppen `[1, 2]`, `[2][3]`; n = Stelle in `sources` (1-basiert) | `services/reasoner/src/provider-model.ts` (`MARKE` Z. 327, `markenIn` Z. 329, `pruefeDeckung` Z. 362, `citedSourceIds` Z. 936) |
| Antwortvertrag | `sources` (herangezogen), `citedSources` (tragend; leer = Zuordnung unbekannt), `steps[].snippet` (Aussage der Quelle) | `services/reasoner/src/types.ts` (`AnswerResult`, `AnswerStep`) |
| Web-Fragenseite | Marke im Text → hochgestellte Ziffer; Chip „n · Titel“; Zuordnung über `citationState`/`attributeSources` | `apps/web/src/lib/answerMarkdown.ts` (`markiereFussnoten`, `splitMarken`), `apps/web/src/lib/askCitedSources.ts`, `apps/web/src/pages/Ask.tsx` |
| Word-Panel | Chip „n · Titel“, Ziffer am Textende, Herkunftszeile „Quelle: Titel · Prüfstand · Version · Stand“, Einschub | `apps/web/public/word-addin/taskpane.js` (`renderAskSources`, `renderAskFussnoten`, `s6HerkunftZeile`, `askEinschubOeffnen`) |
| Word-Dokument | Quellen-Zeile „Quelle: Titel (Prüfstand, Version, Stand …) (KLARWERK-Wissen, abgerufen am …)“ | `apps/web/src/lib/wordAddin.ts` (`buildAskSourceLine`, `composeAnswerOutput`) und Spiegel in `taskpane.js` |

Gepinnte Verträge, die eine Umstellung mitbewegen müsste:
`tests/ask/job3064-fussnoten-vertrag.test.tsx` (Reasoner und Fläche lesen dieselben Zitierformen),
`tests/app/word-addin-ask.test.ts` (Spiegel `taskpane.js` ↔ `wordAddin.ts`, Vorlagen der
Quellen-Zeile), `tests/i18n/mega35-word-wortliste.test.ts` (Vorlagentexte DE/EN/NL).

## Befund 3 — Umstellbarkeit

- **Technisch umstellbar**: Alle Darstellungen hängen an EINER Zuordnung (`citedSources` bzw. der
  Marke `[n]` gegen die Reihenfolge von `sources`). Ein Nachfolger der Darstellung ändert nur die
  Anzeige- und Ausgabefunktionen in der Tabelle oben; der Vertrag bleibt.
- **Hindernis 1 (Gegenstand)**: Welche Schrägstrich-Form abgelöst werden soll, ist im Produkt nicht
  belegbar (Befund 1). Ohne den Planeintrag ist keine konkrete Abbildung alt → neu prüfbar.
- **Hindernis 2 (Entscheidung)**: Die Nachfolgeform selbst ist nicht festgelegt. Sie ist eine
  Produktentscheidung und wird hier nicht vorweggenommen.
- **Hindernis 3 (Rückwärtslesen)**: Ändert sich die Marke im **Modelltext** (nicht nur die Anzeige),
  müssen `MARKE`/`markenIn`/`citedSourceIds` im Reasoner und `splitMarken` in der Fläche gemeinsam
  umgestellt werden — sonst fällt `citedSources` leer aus und jede Antwort gilt als „nicht
  zuordenbar“ (A5-Reißleine).

## Ergebnis

Lesende Prüfung durchgeführt. Umstellung ohne Vertragsbruch möglich, sobald (1) die abzulösende
Form aus `…-READINESS-220` benannt und (2) die Nachfolgeform entschieden ist. Bis dahin: keine
Änderung am Zitierweg.
