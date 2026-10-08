# Bestandsaufnahme: KI-Bildbeschreibungen mit vertraulichen Daten (R-0045, R-0046, R-0050, R-0051, R-1890)

Auftrag `aufnahme:20260922:gesamt-bildbeschreibung-ki`. Diese Datei hält fest, was zu den
zugeordneten Anliegen geliefert ist, wo es steht und was offen bleibt. Sie ersetzt keine Prüfung:
„geliefert“ heißt hier „im Produktbaum vorhanden und mit Beleg zugeordnet“, nicht „heute erneut
ausgeführt“. Wo kein jüngerer Abschlussbeleg vorliegt, ist der heutige Stand **ungeklärt**.

## Quellenlage

- Gelesen: `OFFEN.md` (Zeilen B27–B47, A29, A31), Code- und Testvermerke im Produktbaum, die
  Prüfläufe dieses Auftrags (HISTORIE/nacharbeit-1 und -2).
- **Nicht gelesen:** `_relay/hand/erledigt/AUFTRAG-mega69.md` und
  `_relay/hand/outbox/BERICHT-mega69.md` (Bericht vom 30.07.2026). Beide liegen außerhalb des für
  diesen Auftrag freigegebenen Bereichs; der Lesezugriff wurde technisch abgewiesen. Die
  Blockzuordnung unten stützt sich deshalb auf die Vermerke im Produktbaum, nicht auf den
  Originalwortlaut. Die im Bericht genannten **Ausbauvorschläge sind ungelesen** und hier nicht
  eingeordnet.

## R-0045 · R-0046 · R-0050 · R-0051

| Anliegen | Ergebnis | Fassung / Beleg | Grenze |
|---|---|---|---|
| R-0045 getrennter Titel- und Beschreibungsvorschlag, ehrlich „kein Titel“ | geliefert (Bestand) | `services/reasoner/src/titel-vorschlag.ts`, `components/RichTextEditor.tsx` (`caption-form-title-none`); Prüflauf nacharbeit-1 grün | Auf dem Blatt ist die alte Editorkarte nach JOB 3062 R6 verborgen; das Blatt meldet ohne Vorschlag „Titelvorschlag: noch keiner“ (Ben, nacharbeit-2) |
| R-0046 Absicherung gegen leere, erfundene, abgeschnittene Ergebnisse | **in diesem Auftrag ergänzt** (Kandidat ea50de3d) | `beschreibungDeckeln` und Abbruch-Spur in `services/reasoner/src/provider-model.ts`, Anthropic-Vision-Abbruch in `model-client.ts`; `tests/reasoner/r0046-bildbeschreibung-haertung.test.ts`; Prüflauf nacharbeit-1 grün | Inhaltlich erfundene Aussagen eines Modells sind deterministisch nicht erkennbar; dagegen steht nur der Prompt „nur Sichtbares“ |
| R-0050 durchsuchbare Beschreibung, Riegel gegen vertrauliche Bilder | technisch geliefert (Bestand) | Route `/api/reasoner/describe` mit `resolveConfidential`; Egress-Tests `job2692`, `job2666`, `describe-image`; Suche `f0435`; Prüflauf nacharbeit-1 grün | **Offen, getrennte Menschenprobe:** Abnahme mit echten vertraulichen Dokumenten über Word, lokal und Cloud im laufenden Produkt |
| R-0051 Vorschlag aus umgebendem Text und Dokumenttitel, Titel als Pflichtfeld | geliefert (Bestand) | `collectImageContext(…, documentTitle)` in `RichTextEditor.tsx`; mega85-Titelvertrag; Prüflauf nacharbeit-1 grün | — |

## R-1890 · mega69 (OFFEN.md B29), alle acht Blöcke

Datierter Verlauf laut `OFFEN.md`:

1. **B29** — mega69 beauftragt, acht Blöcke, Block A mit Vorrang.
2. **B33** — mega69 geliefert, `./tools/check` damals grün (731 Testdateien / 5.421 Fälle /
   18 Rauchproben), Diff `patches180` (kumulativ mega67+68+69).
3. **B35** — ben sammel67 zu `patches180`: **ROT**. Blocker: `onSend`-Hook in
   `services/app/src/web-static.ts` war `async` registriert (Block D). Ben: B1, B2, B3 aus
   sammel65 „zu“; gelb blieben Ubiquität der Nachbarschaft und der Typkommentar zu `billable`.
4. **B36/B43** — gesonderter Auftrag **mega71** behebt das: A Hook synchron, B Sammler-Wächter
   `services/app/src/sync-onsend-hooks.test.ts`, C Nachbarschaftsfilter, D Typkommentar.
5. **B46** — ben sammel69 zu `patches182`: **GRÜN**, „letztes Verdikt vor der Auslieferung“.
6. **B47** — **Ship 10, `7ae58bc`, 30.07.2026 21:19.** Dass jede mega69-Datei darin enthalten
   ist, ist nicht einzeln belegt: die Dateiliste `_relay/kopf/ship10-dateien.txt` liegt nicht im
   Produktbaum.

Einordnung je Block. „Heute“ bezieht sich auf den Produktbaum dieses Kandidaten.

| Block | Inhalt (aus den Vermerken im Code) | Datiertes Ergebnis | Heutiger Beleg im Produktbaum | Verbleibende Grenze / gesonderter Auftrag |
|---|---|---|---|---|
| A | Bildbeschreibungsfeld dort, wo das Bild ankommt (Galerie, Vordertür), mit KI-Vorschlag aus dem umgebenden Text | B33 geliefert; ab B35 nicht mehr beanstandet | `BodyImageGallery.tsx`, `DraftBodyGallery.tsx`, `KoRead.tsx`/`KoReadView.tsx`, `RichTextEditor.tsx`, `lib/captureFrontDoor.ts`, `lib/docx.ts`; `tests/capture/mega69-bildweg-mounted.test.tsx` **in nacharbeit-1 und -2 dieses Auftrags grün (2/2)** | Der mega69-Anker verankerte nur `data:image`-Quellen, keine Objekt-Store-Bilder, und hing an einer Seite. Gemeldet als **A31**, gesondert beauftragt als **mega88 Block B** (alle Bildwege). Die A29-Zeile in `OFFEN.md` vermerkt beide Lücken als „nebenbei mitgeschlossen“ (13 Bildwege erhoben); welchem Durchgang das gehört, steht dort nicht eindeutig. Nicht Teil dieses Auftrags |
| B1 | Kostenhinweis der Fragenfläche nur unter Bedingung | B35: „zu“ | `pages/Ask.tsx`; `tests/ask/mega69-ask-kostenhinweis-mounted.test.tsx` | heutiger Lauf: ungeklärt (in diesem Auftrag nicht ausgeführt) |
| B2 | `billable` ehrlich als „kann Kosten auslösen“ benannt | B35: „zu“; Typkommentar gelb → mega71 D | `services/reasoner/src/service.ts`, `services/app/src/build-app.ts`, `woerterbuch/de.ts`; `tests/ask/mega61-kostenhinweis.test.ts` | heutiger Lauf: ungeklärt |
| B3 | Importzugang ehrlich auf drei erreichbare Zustände verengt | B35: „zu“ | `lib/importAccessState.ts`, `components/ImportAccessPanel.tsx`; `tests/app/mega67-zugang-flaeche-mounted.test.tsx` | heutiger Lauf: ungeklärt |
| C | Sichtbare deutsche Texte in Klara mit echten Umlauten | B33 geliefert | `tests/app/mega69-klara-waechter.test.ts` (Abschnitt „mega69 C“), `tests-smoke/word-taskpane-kopieren.spec.ts` | heutiger Lauf: ungeklärt |
| D | Auslieferung von Klaras Datei nie unveränderlich gecacht | B35 **ROT** (async-Hook) → mega71 A → B46 grün → B47 Ship 10 | `services/app/src/web-static.ts` (Hook heute im Callback-Stil); `tests/app/mega69-klara-auslieferung.test.ts`, `services/app/src/sync-onsend-hooks.test.ts` | Korrektur gehört zum gesonderten Auftrag mega71; heutiger Lauf: ungeklärt |
| E | Sichtbarer Auslieferungsstand im Word-Panel (Build-Stempel) | B33 geliefert | `lib/klaraStand.ts`, `apps/web/vite.config.ts`, `public/word-addin/taskpane.html`, `taskpane.js`; `mega69-klara-waechter.test.ts` (E/F) | heutiger Lauf: ungeklärt |
| F | Auslieferungs-Wächter mit Inhalts-Pin über das Word-Panel | B33 geliefert | `tests/app/mega69-klara-waechter.test.ts`, `tests/app/mega69-klara-merkmale.test.ts` | Der Pin wandert mit jeder Panel-Änderung anderer Aufträge. In nacharbeit-1 war er rot, weil die Basis (Firmenwörterbuch, a7e6b249) `taskpane.html` geändert hatte (fremder Basisfehler); laut Ben ist er im integrierten Kandidaten anderweitig nachgeführt. Pflege gehört dem jeweils ändernden Auftrag |
| G | **im Produktbaum keinem Vermerk zuordenbar** | ungeklärt | — | Inhalt und Ergebnis nur aus dem nicht lesbaren Originalauftrag/-bericht bestimmbar: **ungeklärt** |
| H | Ungelesener Schalter `confluenceImport` aus dem Client-Vertrag entfernt | B33 geliefert | `apps/web/src/api/types.ts`; `docs/bestandsaufnahme-confluence-import.md` (R-0134); `tests/funktionsschalter/schalter-leser.test.ts` | heutiger Lauf: ungeklärt |
| (Restschuld mega68) | Nachweis der Nachbarschaftsroute, kumulativ in `patches180` | B28 → B33 nachgereicht | — | Welchem Block das im Original zugeordnet ist, ist ohne Originalauftrag ungeklärt; Nachbarschaftsfilter gehört zu mega71 C |

### Abgrenzung

- **Teil dieses Auftrags und hier geprüft:** nur Block A, weil nur er die Bildbeschreibung betrifft.
  Er ist geliefert und in diesem Auftrag grün belegt.
- **Gesonderte, bereits abgeschlossene Aufträge:** mega71 (Korrekturen zu Ben ROT an mega69),
  ausgeliefert mit Ship 10 am 30.07.2026.
- **Gesondert beauftragt:** A31/mega88 Block B (alle Bildwege verankern); A29/huelle3
  (Einstieg der Bildbeschreibung, siehe R-0051).
- **B–H sind keine Bildbeschreibungsfunktionen.** Sie sind laut Verlauf historisch geliefert und
  über Ben GRÜN (B46) und Ship 10 abgeschlossen. Ein jüngerer Abschlussbeleg fehlt; ihr
  **heutiger Erfüllungsstand ist ungeklärt**. Dieser Auftrag hat dafür keinen eigenen Prüflauf
  bestellt.
- **Ausbauvorschläge aus `BERICHT-mega69.md`:** nicht gelesen, nicht eingeordnet (Zugriff fehlt).
