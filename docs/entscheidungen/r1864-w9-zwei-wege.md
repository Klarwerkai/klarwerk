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
| Kein neuer Egress, Retrieval-only | **Abgeglichen (siehe „Egress-Abgleich“ unten): die W9-Aussage gilt so nicht mehr.** Sie wurde schon am 30.07. vom Konzept selbst korrigiert (Abschnitt 7: die Grenze schützt gegen Egress, nicht gegen KI) und danach durch Pedis Entscheidungen ersetzt (S4 → KA4: externe KI je Dokument mit Einwilligung; 10.09.: „Keine Freigabe, kein Egress“). Heute: Stufe 1 und grün/gelb/türkis ohne Modell und ohne Textabfluss; Widerspruch (Stufe 2) und der Zuruf-Weg nur mit Dokumenteinwilligung, vertraulicher Text nie. | `tests/r1864-w9-zuordnung/w9-quelle-und-zuordnung.test.ts` (E1–E4, Quelltextstellen) |
| Reihenfolge S5 → 1 → 2 → 3, Mitlesen zuletzt | Nicht aus dem Quelltext prüfbar (Geschichte, keine Eigenschaft des Stands). Ein Mitlesen beim Tippen ist im Panel nicht gebaut. | — |

## Abgleich mit der Konzeptquelle `KLARA-Zwei-Wege-Konzept.md` (Abschnitte 1–7)

**Herkunft des Textes.** Die Datei liegt außerhalb des Arbeitsbaums
(`dev_Klarwerk/_relay/kopf/KLARA-Zwei-Wege-Konzept.md`, „Kopf, 30.07.2026 nachts · Denkauftrag von
Pedi, keine Umsetzung“). Gelesen ist sie **mittelbar**: als vollständige, unveränderte Ausgabe eines
`cat` dieser Datei im Prüfprotokoll der Nacharbeit 2 (`HISTORIE/nacharbeit-2/BEN/STREAM.jsonl`,
Eintrag 30). Ein Hash der Datei liegt nicht vor.

**Einordnung.** *Bestand 30.07.* = Befund des Konzepts über den damaligen Code · *Idee* =
ausdrücklich als Idee gekennzeichnet · *Korrektur* = Abschnitt 7 · *Entscheidung* = in `OFFEN.md`
oder im Code als Pedis Entscheidung belegt. Eine Idee ist kein Auftrag; aus dieser Tabelle folgt
keine Umsetzung.

| Abschnitt · Aussage | Art | Heute im Bestand |
| --- | --- | --- |
| §1 Richtung hinein: Entwurf mit Formatierung, `structure`/`extract` | Bestand 30.07. | Unverändert Teil des Bestands; in diesem Auftrag nicht neu geprüft. |
| §1 Richtung hinaus: Antwort mit Zitat an der Cursorposition | Bestand 30.07. | Einfügeweg `Word.run`, Rückfall `setSelectedDataAsync` im Panel (siehe Stufe 3, verwandter Bestand). |
| §1 `check-text` mit „null Aufrufer“ | Bestand 30.07. | **Überholt** — Aufrufer im Panel (Zeile „`check-text` ohne Aufrufer“ oben). |
| §1 Output Factory „hat keine Verbindung zu Word“ | Bestand 30.07. | **Gilt weiter** für Word; Web-App ruft sie (Zeile „Output Factory“ oben). |
| §1 `interview`-Aufgabe vorhanden | Bestand 30.07. | Aufgabe `interview` in der Aufgabenliste des Reasoners (`services/reasoner/src/types.ts`); Leistungsstand ungeprüft; kein Lücken-Angebot im Panel. |
| §2 Diagnose „Übergabewerkzeug, kein Begleiter“; jede Idee mit Reizschwelle | Bewertung | Keine Codeaussage; nicht zuordenbar. |
| §3 Stufe 1 als Knopf, drei Antworten (Entwurf / Ungeprüftes / Geprüftes) | Idee, Logik aus S5 | S5 **entschieden** (30.07., „geprüft wird gegen ALLES“, `OFFEN.md` S5). Umsetzung: Zeile Stufe 1 oben. |
| §3 Stufe 1 Ausbau: Prüfen von selbst beim Absatzwechsel (Mitlesen) | Idee, „nur nach bewusstem Ja“ | **Nicht gebaut**; keine Entscheidung belegt. |
| §3 Stufe 2 gedeckt / im Widerspruch / Lücke | Idee | Zeile Stufe 2 oben (Word-Vergleich). |
| §3 Stufe 3 Factory-Tür nach Word | Idee | **Nicht nachgewiesen** (Zeile Stufe 3 oben). |
| §3 Rückkopplung Lücke → Interview (K5) | Idee | **Nicht gebaut**; K5 in `OFFEN.md` weiter `OFFEN`. |
| §4 „Keine der drei Stufen braucht eine Aufweichung … ohne neuen Egress zu haben“ | Bewertung 30.07. | **Durch §7 korrigiert** und durch spätere Entscheidungen ersetzt — siehe Egress-Abgleich. |
| §4 Eine Ableitung, keine zwei (Äquivalenztest); WordApi 1.1 als Bühne; Anzeige zuerst | Auflage | Nicht als Einzelpunkt geprüft. |
| §5 Ungeprüft: Trefferqualität Englisch gegen Deutsch, Leistung `interview`, `addonApiEnabled()` in Produktion, Factory im Lauf | Eingeständnis | Bleibt ungemessen; dieser Auftrag misst es nicht. |
| §6 Reihenfolge S5 → 1 → 2 → Lücken-Interview → 3, Mitlesen zuletzt, nichts vor dem Vortest | Vorschlag | Geschichte, nicht aus dem Stand prüfbar. Stand heute: S5 entschieden, 1 und 2 gebaut, Interview-Angebot und Factory-Tür nicht. |
| §7 Deterministischer Weg kann nur Literales (kein Synonym, keine Übersetzung, keine Embeddings) | Korrektur | Gilt für den Standardweg; Stufe 1 ist ohne Modell ein „ehrlicher Rohbau“ (§7). |
| §7 Semantischer Vorfilter existiert, Standard **aus**; Store nicht befüllt | Korrektur, Befund | **Gilt weiter**: `createSemanticPrefilterFromEnv` nur bei `KLARWERK_DUP_PREFILTER` gleich `1` oder `true`; Kommentar nennt den Store „noch nicht befüllt“ (`services/app/src/build-app.ts`). |
| §7 Hausinterne KI ist ein unterstützter Betriebsmodus | Korrektur, Befund | **Gilt weiter**: `createLocalClientFromEnv` (`services/reasoner/src/model-client.ts`, `KLARWERK_LOCAL_LLM_URL`/`_MODEL`); die Klara-Policy führt `local` als Modus `internal` neben `external` und `deterministic`. |
| §7 Es fehlt „eine Maschine“ (CPX22 ohne GPU); Hardware- und Kostenentscheidung, „gehört Pedi“ | Offene Frage | **Offen**: `OFFEN.md` S6 „Eine Maschine für ein hausinternes Modell — ja oder nein“ steht auf `ENTSCHEIDUNG`/`NACH-VORTEST`. Hier wird **nichts** entschieden und kein Modell bereitgestellt. |
| §7 Stufe 3 braucht kein Verstehen, nur Auswahl und Form | Korrektur | Ändert nichts an „Stufe 3 nicht nachgewiesen“. |
| §7 Vertraulichkeitsregel: „im Haus, in der Cloud oder gar nichts“ | Korrektur | Siehe Egress-Abgleich, Punkt 3. |

## Egress-Abgleich (Zeile „Kein neuer Egress“, abgeschlossen)

1. **W9 und Konzept §4 (30.07.):** „Kein Baustein braucht neuen Egress.“ — **Historische Bewertung.**
2. **Konzept §7 (30.07., Korrektur nach Pedis Einwand):** der Satz war „wahr, aber hohl“; die
   Retrieval-only-Grenze schützt gegen **Egress, nicht gegen KI**; ein hausinternes Modell erzeugt
   keinen Egress. — **Korrektur, keine Entscheidung.** Die daraus folgende Frage (S6, GPU-Maschine)
   ist **offen**.
3. **Belegte Entscheidungen danach:**
   - S4 → KA4: externe KI im Word-Add-in **je Dokument mit Einwilligung** („setzt Pedis
     S4-Entscheid um“, `OFFEN.md` KA4). Im Code: `ka4Freigabe` in
     `services/app/src/routes/check-text-routes.ts`.
   - Pedi 10.09. 21:25, wörtlich zitiert in `services/reasoner/src/klara-policy.ts`: „Öffentliche
     KI nur nach AUSDRÜCKLICHER Adminfreigabe. Keine Freigabe, kein Egress … Im Zweifel gilt:
     gesperrt.“
4. **Heutiger Stand im Code:**
   - Stufe 1 und die Farben grün/gelb/türkis: ohne Modell, ohne Textabfluss.
   - Stufe 2 „Widerspruch“: nur im tiefen Zweig,
     `deepAllowed = wantDeep && (!confidential || vertraulichFreigegeben)`; bei Klara-Bindung ohne
     Dokumenteinwilligung ist der Zweig immer gesperrt (`ausleitungGesperrt`). Vertraulicher Text
     erreicht ihn nur mit der zweiten zentralen Adminfreigabe (nachgeführt im Auftrag
     gesamt-ki-freigaberegeln, Pedis Entscheidung vom 10.09.). Die Route
     unterscheidet dabei **nicht** zwischen hausinternem und Cloud-Modell — beides braucht die
     Einwilligung (strenger als §7, nicht lockerer).
   - Zuruf-Weg (verwandt zu Stufe 3): die Klara-Policy verlangt die Nutzerzustimmung nur für den
     Modus `external` (`externalConsentRequired = effectiveMode === "external"`); `external`
     braucht zusätzlich Adminwahl, verdrahtete Cloud und zentrale Freigabe. `internal` (lokal)
     braucht keine Egress-Zustimmung — das ist die Drei-Wege-Regel aus §7 im Code.
5. **Ergebnis:** Die W9-Zeile „kein neuer Egress“ beschreibt **nicht** den heutigen Zielzustand.
   Gilt heute: **kein Egress ohne Adminfreigabe und Dokumenteinwilligung; vertraulicher Text im
   tiefen Zweig nur mit der zweiten zentralen Adminfreigabe; hausinterne KI ohne Egress möglich, aber ohne Maschine nicht verdrahtet (S6
   offen).** Ob ein hausinternes Modell beschafft wird, ist Pedis offene Entscheidung und wird hier
   nicht vorweggenommen.

## Grenzen

- Die Konzeptquelle ist **mittelbar** gelesen (Prüfprotokoll Nacharbeit 2, unveränderte
  `cat`-Ausgabe); die Originaldatei liegt außerhalb des freigegebenen Arbeitsbereichs, ein Hash fehlt.
- Die ursprüngliche Output-Factory-Verbindung nach Word (Stufe 3) ist **nicht** quellengebunden
  zugeordnet; der Memo-/Zuruf-Weg ist nur verwandter Bestand.
- Die Zeilenangabe `taskpane.html:573-680` aus W9 stammt vom 30.07. und trifft den heutigen Stand
  nicht mehr; zugeordnet ist über die Blockmarken, nicht über Zeilen.
- Ob Pedi W9 nach dem Vortest entschieden hat, steht nicht in der Quelle (die Zeile trägt weiter
  `ENTSCHEIDUNGEN`). Die spätere Richtungsentscheidung Klara-first (W12, 31.07.) priorisiert „die
  entschiedenen Stücke aus W9/W10/S5“; eine eigene W9-Entscheidung wird hier **nicht** behauptet.
