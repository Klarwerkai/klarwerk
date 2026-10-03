# R-1864 „ENTSCHEIDUNGEN“ — die Entscheidungsquelle W9 (Zwei-Wege-Konzept), beschafft und zugeordnet

*Aufnahme 20260922 · gesamt-klara-assistenz, ausgegliedert nach **Pedis Entscheidung
`entscheidung:759dd154`** (Revision 2, 01.10.2026): „R-1864 wird aus diesem Auftrag in einen eigenen
Folgeauftrag ‚Entscheidungsquelle R-1864 beschaffen und zuordnen‘ ausgegliedert, mit wörtlich
übernommenem Kriterium.“ Das Kriterium lautet unverändert: **„Aufgenommener Zielzustand (R-1864):
ENTSCHEIDUNGEN“.** Dieses Dokument baut nichts; es macht die Quelle im Arbeitsbaum auffindbar und
ordnet jede ihrer Aussagen dem heutigen Bestand zu. Gepinnt von
`tests/r1864-w9-zuordnung/w9-quelle-und-zuordnung.test.ts`.*

## Warum das Kriterium nur ein Wort war

Der Registereintrag R-1864 (`REGISTER-SNAPSHOT.json`, `$.eintraege[1863]`, Alias `OFFEN:W9`,
Bereich „Wissen“, Prüfstatus `nur_altquelle`) hat als Name und Satz nur die **Zustandsspalte** der
OFFEN-Zeile übernommen: `ENTSCHEIDUNGEN`. Der Inhalt steht in seiner Herkunft
`OFFEN.md:177` — und diese Zeile liegt **im Arbeitsbaum**, wortgleich mit dem Wortlaut, den die
Auftragsquelle (`QUELLEN.json`, `R-1864.content.raw.herkunft[0].wortlaut`) festhält. „ENTSCHEIDUNGEN“
heißt also: W9 ist ein Entscheidungspunkt (Spalte 2), fällig „NACH-VORTEST“ (Spalte 3).

## Die Quelle, wörtlich (`OFFEN.md`, Zeile W9)

| W9 | ENTSCHEIDUNGEN | NACH-VORTEST | **Das Zwei-Wege-Konzept liegt: `_relay/kopf/KLARA-Zwei-Wege-Konzept.md` (30.07. nachts, Denkauftrag von Pedi).** Kernbefund der Bestandsaufnahme: **fast alle Bausteine für beide Richtungen existieren** — hinein: Entwurf mit Formatierung, `structure`/`extract` machen Wissenspunkte; hinaus: Antwort mit Zitat und Quellenzeile wird an der Cursorposition eingefügt (`taskpane.html:573-680`); dazu **zwei fertige Bausteine ohne einen einzigen Aufrufer**: `check-text` (Dubletten, für die Add-in-Herkunft entworfen) und die **Output Factory** (`services/output/src/service.ts` — validierte Quellen hinein, Markdown mit Provenienz heraus, stateless). **Diagnose: Klara ist ein Übergabewerkzeug, kein Begleiter — alles ist momentbezogen, nichts spricht von selbst.** Drei Stufen: **1** „Gibt es das schon?“-Knopf (check-text nach S5-Logik, null Egress) · **2** Text verifizieren — gedeckt / im Widerspruch / Lücke (Rahmung des Vorhandenen, klein) · **3** Output Factory bekommt eine Tür nach Word über den vorhandenen Einfügeweg (mittel). Dazu die Rückkopplung: trifft Stufe 1 auf eine Lücke, bietet die vorhandene `interview`-Aufgabe das Lehrlings-Gespräch an (K5) — der Wissende sitzt nachweislich gerade davor. **Kein Baustein braucht neuen Egress; die Retrieval-only-Grenze bleibt bei allen drei Stufen unangetastet.** Reihenfolge: erst S5 entscheiden, dann 1, dann 2, dann 3; Mitlesen beim Tippen zuletzt und nur nach bewusstem Ja. Nichts davor dem Vortest | Ein Senior-Assistent unterscheidet sich vom Nachschlagewerk nicht durch besseres Wissen, sondern dadurch, dass er von sich aus spricht, wenn es nötig ist — und schweigt, wenn nicht. Jede Stufe hat deshalb eine benannte Reizschwelle. |

## Zuordnung zum heutigen Bestand

Quelleninspektion am Stand `8f70ef9a` (`1.0.0-beta.1.663`). „Belegt durch“ nennt vorhandene
Verhaltenstests; ob sie auf diesem Stand grün sind, sagt erst deren Lauf, nicht dieses Dokument.

| W9-Aussage | Heute im Bestand | Belegt durch |
| --- | --- | --- |
| `check-text` ohne Aufrufer | Route `POST /api/check-text` (`services/app/src/routes/check-text-routes.ts`); das Panel ruft sie über genau einen Übersetzer `w6DublettenAusCheckText` (Block `KW-KLARA-W6-CHECKTEXT` in `apps/web/public/word-addin/taskpane.html`). Der Satz „ohne Aufrufer“ ist **überholt**. | `tests/s6-belegte-antwort/check-text-vor-einreichen.test.ts` |
| Output Factory ohne Aufrufer | Die Output Factory (`OutputService.generate`, `services/output/src/service.ts`) hängt an `POST /api/output/generate` (`services/app/src/routes/output-routes.ts`). Ein Aufrufer steht in der **Web-App** (`apps/web/src/api/endpoints.ts`, `/output/generate`); das **Word-Panel** ruft `/api/output/` nirgends. Für die Web-App ist „ohne Aufrufer“ also **überholt**, für Word nicht. | `services/app/src/output-routes.test.ts` (Route, nicht hier ausgeführt) |
| **Stufe 1** „Gibt es das schon?“ | Die Erfassen-Fläche fragt bei stehender Markierung vor dem Senden (`#capture-dubletten`), ohne zu blockieren; Grenzen 40 / 8.000 Zeichen. | `tests/s6-belegte-antwort/check-text-vor-einreichen.test.ts` |
| **Stufe 2** gedeckt / im Widerspruch / Lücke | Word-Vergleich (Block `KW-WORDVERGLEICH`, Knopf `#wv-btn`): grün „wörtlich belegt“, gelb „ähnlich“, türkis „kein Fund“, rot „Widerspruch“ — rot nur mit Einwilligung für den tiefen Zweig; schreibt nichts, färbt nur. | `tests/word-vergleich/absatzvergleich-mounted.test.ts` |
| **Stufe 3** Output Factory → Word über den vorhandenen Einfügeweg | **Nicht nachgewiesen.** Die Output Factory hat keine Tür nach Word: das Panel ruft `/api/output/` nirgends. Ob die ursprüngliche Factory-Verbindung später anders gelöst oder bewusst ersetzt wurde, ist aus diesen Belegen **ungeklärt**. | — |
| *Verwandter heutiger Bestand zu Stufe 3* (kein Nachweis der Factory-Verbindung) | Memo aus einer Quelle (Block `KW-KA6-MEMO`, `ka6MemoAnfordern`, Knopf `#ka6-memo-btn`) über `POST /api/klara/sessions/:sessionId/zuruf`; eingefügt wird erst auf den zweiten Klick über `Word.run` / `setSelectedDataAsync`. Die Route verwendet `ZurufService` mit einem injizierten Formulierer, **nicht** `OutputService.generate`; `services/output/src/zuruf.ts` beschreibt beide ausdrücklich als getrennte Erzeuger (ganzes Dokument gegen Passage). Die Zuruf-Tests belegen diesen Weg, **keine Gleichwertigkeit** mit dem Factory-Weg. | `tests/ka6-memo-panel/memo-panel-mounted.test.ts`, `tests/ka6-memo-panel/memo-route.test.ts`, `tests/output/ka6-zuruf.test.ts` |
| Rückkopplung Lücke → `interview` (K5) | **Nicht zugeordnet.** Die Lücke im Panel (`KW-D2-LUECKE`) bietet „Frage ändern“ und „offene Frage“ (`sendOpenQuestion`); ein Angebot des Lehrlings-Gesprächs über die `interview`-Aufgabe ist im Panel nicht gefunden. | — |
| Kein neuer Egress, Retrieval-only | Stufe 1 und die Farben grün/gelb/türkis laufen ohne Modell; Widerspruch (Stufe 2) und der Zuruf-Weg (verwandt zu Stufe 3) gehen nur mit der dokumentbezogenen Einwilligung (KA4) nach außen. Ob das der Grenze aus W9 genügt, ist eine **Bewertung, die dieses Dokument nicht trifft**. | — |
| Reihenfolge S5 → 1 → 2 → 3, Mitlesen zuletzt | Nicht aus dem Quelltext prüfbar (Geschichte, keine Eigenschaft des Stands). Ein Mitlesen beim Tippen ist im Panel nicht gebaut. | — |

## Grenzen

- `_relay/kopf/KLARA-Zwei-Wege-Konzept.md`, auf das W9 verweist, liegt **nicht** im Arbeitsbaum und
  wurde nicht gelesen (auch nicht sein Abschnitt 7 mit der Unterscheidung hausinterne KI gegen
  Cloud-Egress); zugeordnet ist allein die OFFEN-Zeile. Der Abgleich mit dieser Datei ist **offen**.
- Die ursprüngliche Output-Factory-Verbindung nach Word (Stufe 3) ist **nicht** quellengebunden
  zugeordnet; der Memo-/Zuruf-Weg ist nur verwandter Bestand.
- Die Zeilenangabe `taskpane.html:573-680` aus W9 stammt vom 30.07. und trifft den heutigen Stand
  nicht mehr; zugeordnet ist über die Blockmarken, nicht über Zeilen.
- Ob Pedi W9 nach dem Vortest entschieden hat, steht nicht in der Quelle (die Zeile trägt weiter
  `ENTSCHEIDUNGEN`). Die spätere Richtungsentscheidung Klara-first (W12, 31.07.) priorisiert „die
  entschiedenen Stücke aus W9/W10/S5“; eine eigene W9-Entscheidung wird hier **nicht** behauptet.
