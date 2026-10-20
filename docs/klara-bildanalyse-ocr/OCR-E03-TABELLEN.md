# OCR-E03 · Bildhafte Tabellen als bearbeitbare Tabellen

Auftrag `produkt:20261012:klara-ocr-tabellen`, Revision 2, ausschließlich OCR-E03. Abhängigkeit:
`produkt:20261012:klara-ocr-fundstellen-korrekturen` (OCR-E01/E02), geliefert als `01378570`
(1.0.0-beta.1.991). **Stand: Nacharbeit 6 — auf den gelieferten E01/E02-Stand aufgesetzt; keine
Lieferung, keine Gesamt-Hostabnahme.**

## Bezug zur Elternlieferung OCR-E01/E02

Der E01/E02-Anteil von `01378570` (Delta zu `dcd5a041`) ist in diesen Arbeitsbaum **inhaltsgleich**
übernommen: neue Dateien zeichengleich, geänderte Dateien mit genau den E01/E02-Änderungen (geprüft
mit `git diff 01378570 -- <datei>`). Die E03-Ergänzungen liegen darauf. Nacharbeit 7: der reguläre
Integrationsschritt hat `01378570` (main) zusammengeführt; die Konflikte lagen wie erwartet nur an
den E03-Stellen (`bildAutomatik.ts`, `BildBefundListe.tsx`, `playwright.smoke.config.ts`,
Smoke-Manifest) und sind so aufgelöst, dass beide Seiten erhalten sind.

## Was gebaut ist

| Teil | Datei | Inhalt |
| --- | --- | --- |
| Raster | `apps/web/src/lib/bildAutomatik.ts` (`bildTabelleAusWoertern`, `BildTabelle`) | Spalten aus ≥ 2 vollständig besetzten, übereinanderstehenden Zeilen; Zeilen mit Lücken bekommen **leere** Zellen; Kopfzeile nur bei Text ohne Ziffern über Ziffern; Zellinhalt wörtlich mit `[?…]`/`[unleserlich]`; Zustand je Zelle (`sicher`/`unsicher`/`unleserlich`/`ungeprueft`/`leer`), `mehrdeutig` bei Spaltenüberschreitung oder zwei Blöcken in einer Spalte; Rahmen je Zelle und die Wörter der Erkennung, aus denen sie besteht (`woerter`, Indizes in `BildBefund.woerter` aus OCR-E01). Ohne verlässliches Raster: `null`. |
| Automatik | `bildAutomatik.ts` (`BildBefund.bildTabelle`) | Wird im vorhandenen Erkennungslauf mitgebildet und mit dem Befund derselben Bildbytes wiederverwendet — alle bestehenden Eingänge (Einzelbild, PowerPoint, Word, Bilder im Text, Office im Artikel). Die bisherige Nur-Lese-Tabelle (`tabelle`) bleibt unverändert. |
| Bearbeiten/Übernehmen | `apps/web/src/lib/bildTabelle.ts` | Änderungen neben dem Befund, gebunden an die Inhaltskennung (anderes Bild ⇒ leerer Stand); Zurücksetzen je Zelle; HTML-Tabelle (`<caption>` mit Quelle/Folie/Bild, `<thead>/<th>`, leere `<td>`) und tabulatorgetrennter Text; Zwischenablage mit ehrlichem Ergebnis (`tabelle`/`nur-text`/`nicht-verfuegbar`/`fehlgeschlagen`). Keine Umrechnung von Zahlen. |
| OCR-E02-Anbindung (Nacharbeit 6) | `bildTabelle.ts` (`berichtigungsText`, `tabelleMitBerichtigung`), `BildBefundListe.tsx` | „Als Berichtigung speichern“ legt die Tabelle über den **gelieferten** Berichtigungsweg ab (`aendereBildKorrektur`, `PUT /api/me/assistenz/bildkorrekturen`, gebunden an Quelle UND Bildfassung): die Tabellenzeilen des Bildtexts werden durch einen Block ersetzt (eine Zeile je Tabellenzeile, Zellen per Tabulator), alle übrigen Zeilen bleiben; Wörter einer Tabellenzeile ohne eindeutige Zelle bleiben als eigene Zeile erhalten. Eine gespeicherte Berichtigung — aus der Tabelle oder als freier Text über „Text berichtigen“ — gilt auch in der Tabelle: ein Block Zelle für Zelle, freier Text über die Wortausrichtung von OCR-E01 (`textStellen`); was keiner Zelle eindeutig entspricht, wird nicht geraten, sondern benannt. Berichtigte Zellen sind gekennzeichnet, mit dem Erkannten daneben. Rückgängig/Zurücksetzen am Bildtext gelten für die Tabelle mit. Ohne Quelle, ohne Schreibrecht oder solange die Berichtigungen laden, gilt die Änderung nur in der Ansicht, und das steht da. |
| Fundstelle je Zelle (OCR-E01) | `BildBefundListe.tsx` (`zeigeZelle`), `BildFundstelleAnsicht` | „⌖“ je Zelle öffnet das Originalbild mit der Markierung ihrer Wörter; Zellen ohne Wörter (leer, unleserlich, ungeprüft) markieren ihren Bereich im Bild. |
| Ansicht | `apps/web/src/components/BildTabelleBearbeiten.tsx`, Texte `apps/web/src/texte/bildtabelle.ts` | Eingabefeld je Zelle mit Namen „Zeile n, Spalte m“; Zustände als Wort, nicht nur Farbe; „Tabelle kopieren“, „Als Berichtigung speichern“, „Alle Änderungen verwerfen“. Eingebunden in `BildBefundListe.tsx`. |

Unterstützter Zielweg der Übernahme: Zwischenablage → Einfügen in den Fließtext des vorhandenen
Editors (`RichTextEditor`, `normalizePastedHtml` behält Tabellen) bzw. in Tabellenkalkulationen
(Tabulatortext). Dauerhaft gespeichert wird ausschließlich über den vorhandenen E02-Weg; kein neuer
Speicher-, Rechte- oder Hostweg.

## Prüfung

- `tests/klara-bildanalyse-ocr/ocr-e03-tabellen.test.ts` — Raster, Werte-Treue, Unsicherheit,
  Mehrdeutigkeit, Kopierweg, Quellzuordnung (PowerPoint Folie 2), Wiederverwendung, Quellwechsel;
  Nacharbeit 6: Zellwörter, Rundlauf Tabelle → Berichtigung → Tabelle, freier Text mit nicht
  zuordenbarem Wort, unleserliche Zelle per Berichtigung, Quellwechsel über `quellenMitKorrekturen`.
- `tests/klara-bildanalyse-ocr/ocr-e03-tabelle-mounted.test.tsx` — Ansicht, Bearbeiten,
  Zurücksetzen, Kopieren (HTML+Text / nur Text), Bildwechsel.
- `tests/klara-bildanalyse-ocr/ocr-e03-tabelle-berichtigung-mounted.test.tsx` (Nacharbeit 6) — an
  `BildBefundeImRumpf`: speichern am Berichtigungsserver, Kennzeichnung, Neuladen, Fundstelle je
  Zelle, andere Quelle und verändertes Bild ohne Übertragung, Zurücksetzen; „Text berichtigen“ wirkt
  in den Zellen; ohne Schreibrecht nur Ansicht.
- `tests-smoke/klara-ocr-tabellen-browser.spec.ts` — echte Erkennung im Browser (Chromium), Kopie
  aus der echten Zwischenablage, natives Einfügen in einen Entwurf (Datei-/Bildweg, kein Office-Host).
- `tests-smoke/klara-ocr-tabellen-berichtigung-browser.spec.ts` (Nacharbeit 6, `chromium-zustand`) —
  echte Erkennung, Speichern als Berichtigung am Server, Neuladen, Kopie mit Berichtigung,
  Quellwechsel, Zurücksetzen.
- Weiterverwendet (OCR-E01/E02, unverändert übernommen): `korrekturen-am-server`,
  `fundstelle-korrektur-mounted`, `fundstellen-original`, `korrektur-klara`, `datei-quelle-mounted`,
  `fundstellen-formate`, `korrekturen-pg.integration` und
  `tests-smoke/klara-ocr-fundstelle-korrektur-browser.spec.ts`.

## Offen (konkret)

1. **Integration:** mit main `01378570` zusammengeführt (Nacharbeit 7); Abschluss und Prüfung des
   zusammengeführten Kandidaten durch die reguläre Pipeline.
2. **Hosts:** Word-Add-in (Bedienung in Word), PowerPoint (kein Add-in vorhanden) und der
   eingebettete Office-Editor (Collabora/WOPI, im Prüfaufbau nicht eingerichtet) sind für die
   Tabelle nicht geprüft; geprüft wird der Datei-/Bildweg im Browser. Firefox/WebKit:
   Zwischenablagerechte in Playwright nur in Chromium.
3. **Zellen ohne erkannte Wörter (Nacharbeit 4):** fehlende Wörter beweisen keine Leere. Der
   Zellbereich (Spalte × Zeile) wird im Browser am Bild gemessen (`bildTintenAnteile`, nur lesend);
   steht dort sichtbarer Inhalt, heißt die Zelle `[unleserlich]`; nur gemessen ohne Inhalt heißt sie
   „leer“. Ist der Bereich nicht messbar (kein Canvas, Messfehler, fehlendes Ergebnis, kein
   Messweg), heißt sie `[ungeprüft]` (Nacharbeit 5) — die Marke reist in Kopie und Editor mit.
   Linien oder Schmutz innerhalb des Zellbereichs ergeben ebenfalls `[unleserlich]` — lieber
   gekennzeichnet als still leer.
4. **Freier Text und Tabelle:** ein als freier Text berichtigtes Wort ohne erkannte Entsprechung
   (ergänzt oder ganz anders) bekommt keine Zelle; es steht als „ohne Tabellenplatz“ da und bleibt
   beim Speichern aus der Tabelle als eigene Zeile erhalten.
5. Tabellen mit nur einer vollständig besetzten Zeile, verbundene Zellen und gedrehte Tabellen
   ergeben kein Raster (kein Raten).
