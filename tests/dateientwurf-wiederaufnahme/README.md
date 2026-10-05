# Dateientwurf wieder öffnen — Abgleich des historischen Absturzes (BEN-3633)

Auftrag `aufnahme:20260922:dateientwurf-absturz` (Revision 3), Basis `93c25f5a` (`1.0.0-beta.1.700`).
Originalpunkte: `P-C-DATEIENTWURF-VERLASSEN` und `priority:C-DATEIENTWURF-VERLASSEN:7a62d0276509`
(doppelte Quellenfassung desselben Zielzustands).

Diese Datei ist **Quelleninspektion am Basisstand**. Was davon durch einen Lauf belegt wird, steht in
der Spalte „Prüfweg“; ausgeführt hat diese Bahn selbst keinen Test.

## 1 · Auslöser, damaliger Stand, spätere Lieferungen

| Stelle | Was dort wirklich steht | Beleg im Repository |
| --- | --- | --- |
| **Auslöser 3633** | Codex, 11.09., Live `1.307`: `/erfassen?draft=<id>` eines **ChatGPT-Übernahme-Entwurfs** bleibt vollständig weiß. Kein Dateientwurf, kein Stacktrace — eine weiße Seite. | `tests/entwurf-aus-adresse/adresse-entwurf-chromium.test.ts:5-9` |
| Lieferung 3633 (`1.0.0-beta.1.313`, `d38c48dc`) | Weiße Seite als Fehlerklasse im echten Chromium festgenagelt: A1 gültig, A2 unbekannt (404), A3 fremd (403), A4 leer, **A5 erzwungener Absturz im Ladeweg**, A6 Kaltstart Expertenformular, **A7 fehlendes gesichertes Original** (`bodyHtml: null` + `anchorsMissing`). Das Blatt nennt den zurückgehaltenen Text seither. | `adresse-entwurf-chromium.test.ts:254-455`; `apps/web/src/components/erfassen/Blatt.tsx:373-394`, `:960`, `:3607` |
| Offener Rest von 3633 | „Der Entwurfsabruf hat KEINE Zeitgrenze“ (`archiv/3633/runde-2/RUECKGABE.md:34`, nur als Zitat im Code). | `apps/web/src/api/endpoints.ts:531-561` |
| Lieferung 3782 (`1.0.0-beta.1.368`, `a2f70e78`) | Zeitgrenze des Entwurfsabrufs (gemessen, nicht gegriffen); Ablauf ergibt einen eigenen Satz und lässt das Blatt bedienbar. | `tests/entwurf-laden-zeitgrenze/entwurf-laden-zeitgrenze.test.tsx:422-609`, `frist-messung.test.ts:99`; `Blatt.tsx:211-216` |
| 3426 (`1.0.0-beta.1.256`) | Entwürfe verwalten; R2: ein Ladevorgang, dessen Entwurf gerade gelöscht wird, wird verworfen statt als offen geführt. | `Blatt.tsx:402-420`, `:1006-1011`; `tests/entwuerfe-verwalten/blatt-entwuerfe-verwalten.test.tsx:745` |
| 3561 (`1.0.0-beta.1.328`) | **TOR-FARBFALLE** (eingefärbte Testausgabe). Kein Bezug zum Öffnen eines Entwurfs. | Commit `b898d3b5` |
| 3637 (`1.314`) / 3777 (`1.363`) | **Wissensobjekt löschen** in der Bibliothek (Rückfrage im Blick; schon gelöschtes Objekt ist kein Fehler). Kein Bezug zum Öffnen eines Entwurfs. | `apps/web/src/components/bibliothek/BibliothekLesen.tsx:1114-1201` |
| 4231 (`1.0.0-beta.1.546`) | Quittung des Verlassen-Wegs für beide Dateizweige; Lieferung 9 (echter Browser, Persistenz, Wiederöffnen) blieb offen. | `apps/web/src/pages/Capture.tsx:3467`, `:3601`, `:3642`, `:3722`; `tests/datei-verlassen-quittung/quittung-dateiwege-mounted.test.tsx` |
| 4324 (`1.0.0-beta.1.577`) | Lieferung 9 als Strecke in Chromium gegen echtes PostgreSQL: P1 Import, P2 Verlassen mit Quittung, P3 Neuladen, P4 neue Sitzung, P5 Fehlerfall. P2 war damals absichtlich rot (Produktbefund). | `tests/import-wiederoeffnen-nutzerweg/import-wiederoeffnen-pg-im-browser.integration.test.ts` |
| 4335 (`1.0.0-beta.1.592`, `03779583`) | (1) Wache bietet „Entwurf speichern und wechseln“ auch bei geladener, nicht ausgewerteter Datei. (2) Runde 2: `NavGuardContext.tsx` führt ein Verzeichnis von Wachen statt eines Platzes — vorher antwortete auf `/erfassen` immer die Wache des Blatts, die die Datei nicht sicherte. | `apps/web/src/app/NavGuardContext.tsx:169-219`; `tests/datei-verlassen-quittung/wache-zustaendigkeit-blatt-und-arbeitsraum.test.tsx`, `wachen-verbund-reihenfolge.test.tsx` |

## 2 · Absturz, fehlender Originaltext und Zeitüberschreitung sind drei verschiedene Lagen

| Lage | Was der Mensch sieht | Prüfweg |
| --- | --- | --- |
| Absturz im Ladeweg (Wurf im `.then`) | Lagezeile „Der Entwurf konnte nicht geladen werden.“ oder Fehlergrenze — nie eine weiße Seite; Titelfeld bleibt bedienbar | Chromium, A5 |
| Gesichertes Original fehlt | Titel geladen, Text zurückgehalten, Satz „Ein gesichertes Original fehlt …“; der Rumpf wird nicht überschrieben | Chromium gegen echte App, A7 |
| Zeitüberschreitung | nach der Frist der Rückfallsatz, Blatt bedienbar; der größte zulässige Entwurf kommt innerhalb der Frist vollständig an | jsdom T1–T6, Messung `frist-messung.test.ts` |
| Serverfehler / Netzabriss beim Wiederöffnen eines Dateientwurfs | Servermeldung (500) bzw. Rückfallsatz (Abbruch), kein Entwurf offen, `drafts`-Zeile bytegleich, danach lädt derselbe Entwurf wieder | Chromium + PostgreSQL, P5 |
| Erfolg | Inhalt und Quellenanzeige der realen DOCX nach Neuladen und in neuer Sitzung | Chromium + PostgreSQL, P3/P4 |

## 3 · Ergebnis dieses Auftrags

**Kein weiterhin reproduzierbarer Absturz beim Öffnen eines Dateientwurfs ist am Basisstand belegt.**
Die bekannten Ursachenklassen (weiße Seite, verschwiegener Teilrumpf, fehlende Zeitgrenze, falsche
Wache beim Verlassen) haben je eine Lieferung mit eigenem Prüfstand. Ein Reparaturrest wird deshalb
nicht ausgewiesen. Ob das so bleibt, entscheiden die Läufe aus `CLAUDE/PRUEFPLAN.json`.

Geändert, weil konkrete Lücken bestanden:

1. **Neuer Fall `P2w`** in `import-wiederoeffnen-pg-im-browser.integration.test.ts`: der beim Verlassen
   gesicherte Entwurf K2 wird über die Adresse geöffnet und neu geladen; Inhalt und Originalquelle
   müssen sichtbar dastehen, Zeilenzahl und K2-Zeile bleiben unverändert. Bisher war K2 nur in der
   Tabelle belegt („findet den gespeicherten Bestand samt Originalquelle wieder“ war im Browser offen).
2. **Kommentar von P2 berichtigt**: er behauptete „bleibt rot“, obwohl die Reparatur aus JOB 4335
   Runde 2 mit `1.0.0-beta.1.592` im Produkt steht. Die Erwartungen von P2 sind unverändert.

## 4 · Quellenwidersprüche und fehlende Belege

- Der Auftrag spricht von einem **Dateientwurf**; der dokumentierte 3633-Auslöser war ein
  **ChatGPT-Übernahme-Entwurf** (Browser-Erweiterung). Ein Absturz speziell beim Dateientwurf ist im
  Repository nirgends belegt.
- Der **Originaltext des BEN-3633-Befunds** liegt weder in `QUELLEN.json` (nur die Kennung im
  Lieferumfang) noch im Repository. Ebenso nicht verfügbar: `archiv/3633/runde-2/RUECKGABE.md`,
  `archiv/4231/runde-2/ben.md`, `gespraech/codex-pro/nutzerpaket-abgleich/4231-LIVE-ABNAHMEREST.md`.
  Sie sind nur als Zitate in Codekommentaren sichtbar; ein wörtlicher Abgleich ist damit nicht möglich.
- 3561, 3637 und 3777 betreffen Tor-Ausgabe bzw. Löschen in der Bibliothek, nicht das Öffnen eines
  Entwurfs. Die Zuordnung im Lieferumfang ist nach Quellenlage nicht begründet.
- Die Zeilenangaben im Originalpunkt (`Capture.tsx:3239/3256/3271`, später `:3268-3271/:3288-3290`)
  sind verschoben; die beschriebene Ablösung steht heute an `Capture.tsx:3601-3722`.

## 5 · Grenzen

- Der Zweig **„ausgewählte Punkte“** im echten Chromium braucht eine echte Modellauswertung
  (`POST /api/reasoner`, `task: "extract"`); er ist nur gemountet belegt (Abwahl, Teilfehler,
  Wiederholung ohne Doppelanlage). Ein Browserbeleg mit echtem Modell bleibt eine offene externe
  Voraussetzung.
- Echte menschliche Bedienung an der Livefassung ist durch keinen dieser Prüfstände ersetzt.
- Liefernachweis mit Fassung entsteht erst nach Veröffentlichung (AUFTRAG.json, K5).
- Abgegrenzt: Entwurfsverwaltung/CRUD (Nichtziel), Papierkorb und Leserechte (eigene Aufnahmen,
  `tests/entwurf-einreichen/README.md:383`), Verwerfen-Gesamtfehler (`tests/erfassen-verwerfen-gesamtfehler/`).
