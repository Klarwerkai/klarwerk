# Klaras Aufgabenfenster — drei Dateien statt einer

*Aufnahme 20260922 · zentrale-module-aufteilen (R-1611, P11). Basis `3b79c5d1`
(`1.0.0-beta.1.657`). Gilt für `apps/web/public/word-addin/`.*

## Die kurze Fassung

Das Word-Aufgabenfenster war bis zu diesem Auftrag **eine** Datei, `taskpane.html`
(13.729 Zeilen, 803.665 Bytes). Jetzt sind es drei:

| Datei | Inhalt | Zeilen |
| --- | --- | --- |
| `taskpane.html` | das Markup; das Manifest zeigt weiter genau hierhin | 497 |
| `taskpane.css` | der frühere `<style>`-Block, Zeile für Zeile | 733 |
| `taskpane.js` | der frühere `<script>`-Block, Zeile für Zeile | 12.497 |

Dazu kommt wie bisher `rueckweg.js` (JOB 3667). Für Anwender ändert sich nichts: der Schnitt ist eine
reine Textoperation — kein Zeichen von Markup, Stil oder Skript ist umgeschrieben, nur verschoben.

Wer am Markup arbeitet, fasst die Skriptdatei nicht mehr an, und umgekehrt. Genau das ist der Zweck:
zwei Aufträge an derselben Oberfläche treffen sich nicht mehr in einer Datei (R-1499).

## Wie die Seite die zwei Dateien lädt

```html
<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
<link rel="stylesheet" href="taskpane.css?v=__KW_FASSUNG__" />
…
<script src="rueckweg.js?v=__KW_FASSUNG__"></script>
<script src="taskpane.js?v=__KW_FASSUNG__"></script>
```

- **An derselben Stelle** wie vorher der Block. Klassische Skripte ohne `async`/`defer` laufen in
  Dokumentreihenfolge; `taskpane.js` läuft also genau dort, wo das Inline-Skript lief.
- **Cachekennung `?v=__KW_FASSUNG__`** — derselbe Platzhalter wie am Meta `kw-loaded-version` und an
  `rueckweg.js`. Der Server ersetzt ihn beim Ausliefern (`stempleFassung`,
  `services/app/src/web-static.ts`). Ein Fassungswechsel ändert damit die Adresse beider Dateien.
- **Bau-Stempel**: `var KLARA_STAND = "__KLARA_STAND__"` steht jetzt in `taskpane.js`. Das
  Vite-Plugin `klara-stand` (`apps/web/src/lib/klaraStand.ts`) stempelt deshalb `taskpane.html` **und**
  `taskpane.js` (`KLARA_STAND_DATEIEN`).
- **CSP**: unverändert. Die Dokument-CSP der Seite trägt `script-src 'self'` und `style-src 'self'`;
  gleichherkünftige, relative Dateien sind darin enthalten. `WORD_ADDIN_CSP_PATHS` bleibt eine Liste
  von HTML-Adressen.
- **Biome**: `taskpane.js` und `taskpane.css` stehen wie `rueckweg.js` in `files.ignore`. Als
  Inline-Blöcke lagen sie nie im Lint; der Schnitt ändert daran nichts.

## Wie Tests das Fenster lesen — `tests/support/panelquelle.ts`

Rund hundert Prüfstände schneiden Blöcke an `KW-…`-Marken heraus, bauen den Rumpf ins jsdom-DOM und
führen das Skript aus. Sie lesen das Fenster als **ein** Dokument:

| Funktion | Rückgabe |
| --- | --- |
| `panelQuelle()` | das Fenster als EIN Dokument — die drei Dateien an ihren Stellen zusammengefügt |
| `panelQuelleAus(pfad)` | dasselbe, für Prüfstände, die den Pfad als eigene Konstante führen; der Pfad muss auf `taskpane.html` zeigen, sonst bricht es |
| `panelTeile()` | `{ html, css, js }` — die drei Dateien, wie sie im Baum liegen |
| `fuegePanelZusammen(teile)` | die Umkehrung des Schnitts; fail-closed, wenn ein Verweis fehlt oder doppelt steht |
| `gitBlobKennung(text)` | dieselbe Kennung wie `git hash-object` |

Neue Prüfstände: **nicht** `readFileSync(".../taskpane.html")` für Skript- oder Stilinhalte — die
Datei enthält sie nicht mehr. `panelQuelle()` nehmen; wer die **Auslieferung** prüft (Verweise,
Kopfzeilen), liest die echte Datei oder fragt den Server.

Das Mitfahrerverzeichnis `tests/klara-zerlegung/schnitt-pins.test.ts` führt dafür den Griff
`panelquelle`. Wer einen neuen Prüfstand anlegt, trägt ihn dort ein (A2 meldet ihn sonst).

## Woran „ohne Verhalten zu ändern" gemessen ist

| Aussage | Beleg |
| --- | --- |
| Die drei Dateien ergeben Byte für Byte die frühere `taskpane.html` | `tests/klara-zerlegung/schnitt-echt.test.ts` E2, gegen die Git-Blob-Kennung `95226f65…` des Basisstands (nachprüfbar: `git rev-parse 3b79c5d1:apps/web/public/word-addin/taskpane.html`) |
| Der Schnitt ist die mechanische Textoperation (`schneideDrei`), bis auf Cachekennung und Blockränder | `tests/klara-zerlegung/probeschnitt.test.ts` A1 |
| Vorher und nachher verhalten sich gleich (DOM, Stilwerte, Office-Zugriffe, Netzaufrufe, Fehler), im Word- und im Nicht-Word-Zustand | `probeschnitt.test.ts` D2/D7, je ein eigenes jsdom-Fenster über die echte Fastify-Verdrahtung; Gegenproben D3–D6 |
| Alle drei Dateien kommen mit den richtigen Kopfzeilen an; fehlt eine, scheitert der Abruf laut | `probeschnitt.test.ts` B/C |
| Der Inhalts-Pin des Fensters musste nicht wandern | `tests/app/mega69-klara-waechter.test.ts`, Pin `5fbf5f64…` über das zusammengefügte Dokument |
| Der Bau stempelt die Programmversion ins Skript | `tests/deploy-health-commit/eine-programmversion.test.ts` |

## Was nicht gemessen ist

- **Word selbst.** Kein Lauf im echten Word-WebView (Mac/Windows/Web), kein Sideload, kein echtes
  Office-CDN. jsdom lädt, führt aus und rechnet Stilwerte, malt aber nicht. Chromium fährt die
  geschnittene Seite in `tests/design/zielbild-keinwissen.test.ts` (nur wenn das Zielbild auf dem
  Rechner liegt) und über `dist` in den K1-Messungen (`tests/design/k1-messung.ts`) — beides ohne
  Office-Host.
- **Fassungsgleichheit von HTML und Skript.** Die Cachekennung erzwingt einen neuen Abruf nach einem
  Fassungswechsel; sie erzwingt nicht, dass der Server zur Kennung passende Bytes liefert. Er liefert
  unter jeder Kennung die Datei, die gerade auf der Platte liegt (`probeschnitt.test.ts` B4). Der
  Fassungskopf `X-KW-Available-Version` steht weiter nur an der HTML-Antwort.

## Nachtrag: weitere Geschwisterdateien

Seither sind zwei weitere Abschnitte vom Ende des Fensterskripts Zeile für Zeile in eigene
klassische Skripte gewandert, die `panelQuelle()` an ihrer früheren Stelle wieder einsetzt:
`marke.js` (KW-MARKE) und — mit dem Auftrag „Geschriebene Behauptungen gegen den Wissensbestand
prüfen“ (R-0336, R-0708) — `wortvergleich.js` (KW-WORDVERGLEICH). `wortvergleich.js` wird
unmittelbar nach `taskpane.js` geladen (Verweis in derselben Zeile, damit `taskpane.html` unter 500
Zeilen bleibt) und vor `marke.js`. Der Schnitt selbst ändert am zusammengefügten Dokument kein Byte;
geprüft in `probeschnitt.test.ts` (A1–A3, C2, D2) und `schnitt-echt.test.ts` (E5). Daneben steht
`begriffe.js` (KW-BEGRIFFE) als eigenständige Datei im Kopf der Seite; sie ist kein Teil des Schnitts.

## Was als Nächstes kommt (nicht Teil dieser Lieferung)

`taskpane.js` ist mit 12.497 Zeilen noch selbst eine Sammeldatei. Der Schnittplan
(`tests/klara-zerlegung/schnittflaechen.test.ts` C1) nennt die einteiligen Markenspannen als nächste
Schnittstücke. Vorsicht: ein klassisches Skript in mehrere Dateien zu teilen, ist **keine** reine
Textoperation mehr — Funktionsdeklarationen werden nur innerhalb eines Skripts vorgezogen, und
`"use strict"` gilt je Datei. Jeder weitere Teil braucht seinen eigenen Verhaltensabgleich.
Bis dahin bewacht `schnittflaechen.test.ts` B3 die Größe von `taskpane.js` mit derselben Schranke
(12.500 Zeilen), die vorher am Inline-Skript hing.
