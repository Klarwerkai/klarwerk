# Geschriebene Behauptungen gegen den Wissensbestand prüfen — Zuordnung und Lieferung

*Aufnahme 20260922 · `aufnahme:20260922:gesamt-text-gegen-wissen` (Revision 1). Zugeordnete Anliegen:
R-0336 und R-0708. Basis dieses Kandidaten: `817d5347` (`1.0.0-beta.1.768`). Die ausgelieferte
Fassungsnummer entsteht erst mit der Veröffentlichung; sie steht deshalb hier nicht.*

## Die zwei Anliegen, wörtlich

| Kennung | Zielzustand (Register, `QUELLEN.json` → `original_points`) | Herkunft |
| --- | --- | --- |
| R-0336 (alt F-0336, `SPAETER`) | „Man markiert in einem bestehenden Dokument eine Behauptung, und Klara sagt eines von drei Dingen: gedeckt (mit Quelle und Zitat), im Widerspruch (mit der Gegenquelle) oder dazu wissen wir nichts. … Es ist eine Rahmung des bereits Vorhandenen, kein neuer Datenabfluss.“ | `KLARA-Zwei-Wege-Konzept.md` (30.07.), OFFEN.md W9 „Stufe 2“ |
| R-0708 (alt F-0708, `GEPLANT`, E31) | „Das Word-Seitenfenster behält seinen eigenen Prüfweg und bekommt eine ausdrückliche Zustimmung, auch nicht validierten Bestand einzubeziehen. Der Weg der Erfassung bleibt davon getrennt, weil beide verschiedene Fragen stellen.“ | `ENTSCHEIDUNGEN-OFFEN-20260812.md` Punkt F: „ENTSCHIEDEN — Pedi am 13.08.2026 … Der Weg: Opt-in auf /api/check-text.“ Bau- oder Einbaubeleg laut Register: nicht vorhanden |

## Stand vor diesem Auftrag (Quelleninspektion an `817d5347`)

- **Absatzweiser Abgleich vorhanden** (JOB 3281, Block `KW-WORDVERGLEICH`, Knopf „Dokument prüfen“):
  je Absatz grün „Wörtlich im Bestand belegt“, gelb „Ähnlich“, türkis „Kein Fund im durchsuchten
  Bestand“, rot „Widerspruch zu einem Eintrag“ (mit `stellen.quelle` der Gegenquelle), sonst ohne
  Farbe mit Grund. Das deckt „absatzweise gegen das Haus prüfen“.
- **Es fehlten** für R-0336: der Abgleich einer *markierten* Behauptung (nur das ganze Dokument war
  möglich) und bei „gedeckt“ das *Zitat* (die Zeile nannte nur Titel und Prüfstand der Quelle; die
  Route lieferte die `fundstelle` längst mit).
- **Es fehlte** für R-0708 die Zustimmung: Das Fenster ruft `/api/check-text` über die Sitzung, und
  der Sitzungsweg bezog seit JOB 3020 **immer** auch eingereichte, noch nicht validierte Einträge
  ein — ohne dass der Mensch gefragt wurde. Ein Rumpffeld dafür gab es bewusst nicht.

## Geliefert

| Anliegen | Ergebnis | Stelle | Beleg (neu, in diesem Kandidaten) |
| --- | --- | --- | --- |
| R-0336 · markierte Behauptung | Knopf „Markierung prüfen“ (`#wv-markierung`): liest die Markierung über `Word.run`/`getSelection`, fragt denselben Weg (`w6DublettenAusCheckText`) und stuft mit derselben Funktion ein wie je Absatz — gedeckt, im Widerspruch, kein Fund (oder ehrlich „Nicht abgeglichen“ mit Grund). Schreibt weder Text noch Farbe; ohne Markierung kein Abruf, sondern der Satz, was fehlt. | `apps/web/public/word-addin/wortvergleich.js` (`wvMarkierungPruefen`, `wvMarkierungLesen`) | `tests/word-vergleich/behauptung-und-zustimmung.test.ts` M1–M6 |
| R-0336 · Quelle und Zitat | Jede Quelle eines Quellenfunds trägt ihre Fundstelle als „Die Quelle sagt: „…““ — bei „gedeckt“ die belegende Stelle; bei Widerspruch wie bisher die Gegenstelle. Gilt für „Dokument prüfen“ und „Markierung prüfen“. | `wvQuellen` | M1, M2, M6 |
| R-0708 · ausdrückliche Zustimmung | Haken „Auch noch nicht validierten Bestand einbeziehen“ (`#wv-ungeprueft`): AUS bis zum Haken, gilt nur für dieses Fenster, wird beim Logout verworfen, je Lauf beim Start gelesen. Der Prüfweg schickt `ungeprueftEinbeziehen` **immer ausdrücklich** mit; der Standsatz nennt die Reichweite des Laufs. | `wortvergleich.js` (`wvUmschlag`, `wvBlockElement`, `wvZeichnen`, `wvVerwerfen`) | M-Datei Z1–Z3 |
| R-0708 · Route | `POST /api/check-text` nimmt das optionale `ungeprueftEinbeziehen` an: `false` beschränkt den Sitzungsweg auf Validiertes, `true`/fehlend wie bisher. Am Add-in-Schlüssel wirkungslos — das Feld kann nie weiter öffnen als der Weg. | `services/app/src/routes/check-text-routes.ts` | `tests/text-gegen-wissen/zustimmung-an-der-route.test.ts` Z1–Z2, E1–E2 |
| R-0708 · Erfassung getrennt | Der Weg der Erfassung („Haben wir das schon?“, Dublettenprüfung der Erfassen-Fläche) schickt das Feld nicht und behält seine Frage und Reichweite (JOB 3020). | unverändert (`KW-N1-BESTAND`, `KW-KLARA-W6-CHECKTEXT`) | M-Datei Z4, Routendatei E1 |

Technische Begleitänderung: Weil `taskpane.js` an der Zeilenschranke B3 stand (12493 von < 12500),
ist der Block `KW-WORDVERGLEICH` vor dem Umbau Zeile für Zeile nach `wortvergleich.js` gewandert
(Vorbild `marke.js`); siehe `docs/word-addin/aufgabenfenster-dateien.md`. Die Prüfstände der
Zerlegung (`probeschnitt`, `schnitt-echt`, `schnittflaechen`, `word-addin-csp`,
`zielbild-keinwissen`, `schnitt-pins`, Regressionsinventar) sind nachgeführt.

Wiederverwendet (unverändert, weiter gültig): die Einstufung und der Absatzweg aus
`tests/word-vergleich/*` (JOB 3281), die Reichweitenfälle `tests/pruefung-gegen-alles/*` (JOB 3020),
der Vergleich der zwei Prüfverträge `tests/pruefwege-vergleich/*`.

## Abgrenzung

- **R-1864 / W9 (Zuordnung der Entscheidungsquelle)** — eigener, abgeschlossener Folgeauftrag;
  `docs/entscheidungen/r1864-w9-zwei-wege.md` bleibt unverändert. Seine Zeile „Stufe 2“ beschreibt
  den absatzweisen Abgleich; was dieser Auftrag dazu ergänzt (Markierung, Zitat, Zustimmung), steht
  hier.
- **R-0334 / R-1869 (W6, Dublettenprüfung wirklich rufen), R-0427 (Absatzwechsel nach bewusstem
  Ja)** — Auftrag gesamt-bestandsblick; nicht berührt.
- **KA7 „Passt das zur Regelung?“ (JOB 3094)** — eigener Widerspruchs-Hinweis an der Markierung;
  laut Register (Notiz zu R-0336) „bewusst nicht verschmolzen“. Er bleibt, wie er ist, und schickt
  das neue Feld nicht.
- **Stufe 3 (Output Factory nach Word), Lücke → Interview (K5)** — nicht zugeordnet, nicht gebaut.
- **Gegenstück zu R-0708** („Dublettenprüfung in denselben Zugang legen“) — laut Register verworfen;
  entsprechend nicht gebaut.

## Quellenwidersprüche

1. **S5 gegen R-0708.** Pedi hat am 30./31.07. entschieden, „geprüft wird gegen ALLES“ (OFFEN.md S5,
   umgesetzt in JOB 3020 ohne Rückfrage). Am 13.08. entschied Pedi für E31 „Opt-in auf
   /api/check-text“. Aufgelöst nach dem Wortlaut von R-0708 selbst: S5 regelt die Frage der
   Erfassung („gibt es das schon?“), die ungeändert gegen alles prüft; der Prüfweg („ist das
   gedeckt?“) fragt mit dem Opt-in. Sollte Pedi das Opt-in auch für die Erfassung gemeint haben,
   wäre das eine neue Entscheidung — hier nicht vorweggenommen.
2. **R-0336 „kein neuer Datenabfluss“ gegen den Widerspruchsweg.** „Im Widerspruch“ entsteht nur im
   tiefen Zweig der Route (`want: "deep"`, Modellurteil) — das ist Textabfluss an die KI und nach
   KA4 und Pedis Regel vom 10.09. nur mit Dokumenteinwilligung und Adminfreigabe erlaubt. Ohne sie
   kann Rot konstruktiv nicht entstehen; das Fenster sagt das („Ohne Einwilligung … bleibt der
   Widerspruchsabgleich aus“) und behauptet keine Widerspruchsfreiheit. „Gedeckt“ und „kein Fund“
   bleiben ohne Modell und ohne Textabfluss aus dem Haus. Die jüngeren Freigaberegeln gelten; nichts
   ist gelockert.
3. **„Drei Dinge“ gegen die vorhandenen Lagen.** Der Abgleich kennt neben gedeckt / Widerspruch /
   kein Fund weiter „Ähnlich“ und „Nicht abgeglichen“. Beide bleiben: „Ähnlich“ ohne wörtlichen Beleg
   als „gedeckt“ zu melden oder „Nicht abgeglichen“ als „wissen wir nicht“, wäre eine Aussage ohne
   Beleg. Auch die Wortlaute sind nicht in „gedeckt“/„dazu wissen wir nichts“ umbenannt — sie sind
   gemessen und beachten die Wortliste der Word-Fläche; der Sinn ist derselbe.
4. **Kennung W9 doppelt** (Register-Notiz): W9 steht auch für „Vertrauenslage und Aktualität an der
   Antwort“. Diese Zuordnung meint ausschließlich W9 „Stufe 2“.

## Fehlende Belege und offene Voraussetzungen

- **Kein echter Word-Host.** „Markierung prüfen“ liest über `Word.run` → `getSelection()` (WordApi
  1.1); gemessen nur an der nachgebauten Bühne (jsdom), nicht in Word für Mac/Windows/Web.
- **Kein PostgreSQL-Gesamtweg** für die Route mit dem neuen Feld; gemessen am In-Memory-Dienst über
  die echte Fastify-Verdrahtung.
- **Inhalts-Pins** `PANEL_VOR_SCHNITT_BLOB` (`schnitt-echt.test.ts` E2) und `PIN` (Inhalts-Pin in
  `mega69-klara-waechter.test.ts`) müssen wandern; ohne zugelassenes Hash-Werkzeug in dieser Bahn
  nicht berechnet. Der Prüflauf meldet die Ist-Werte.
- **Lieferbeleg mit Fassung** (K3): entsteht erst mit Veröffentlichung und Livefassung.
