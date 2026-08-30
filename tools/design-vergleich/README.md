# Design-Vergleich (JOB 2617 D3 — „Werte statt Bilder")

Der messbare Abgleich zwischen gebauten Design-Staenden und dem Zielbild
(`DESIGN_ZIELBILD_20260827/*.dc.html`, liegt im Kontrollordner, nur lesen).

## Der Wertevergleich (der Nachweis)

`werte.ts` liest beide Seiten und vergleicht Wert fuer Wert (Namen je Wert — ein Fehlschlag sagt,
WELCHER Wert abweicht). Test: `tests/design/zielbild-schlankes-panel.test.ts`. Fuer 2618/2619/2620:
neue Wertetabelle je Zielbild anlegen, `vergleiche()` und der Testaufbau bleiben.

`staende/` traegt die gebauten Design-Endstaende als Dateien im Repo
(`schlankes-panel-2617-d1.html` = Endstand JOB 2617 D1, sha256 d84f1eaf…) — sie sind
Vergleichsgegenstand des Tests UND die Einbauquelle fuer den Chef.

## Die Browser-Gegenueberstellung (Zugabe fuer den Chef-Screenshot, aus JOB 2617 D2)

```
bash tools/design-vergleich/vergleich-bauen.sh <gebaut.html> <zielbild.dc.html> <zielordner>
cd <zielordner> && python3 -m http.server 4617   # → http://localhost:4617/vergleich.html
```

`vergleich-bauen.sh` kopiert beide Seiten in den Zielordner und ersetzt in der Kopie des gebauten
Stands GENAU EINE Zeile (das synchrone office.js-CDN-Script — es blockierte ohne Netz das Parsen:
der Grund des leeren linken Rahmens beim Headless-Render). `render-probe.mjs` prueft ohne Browser
(jsdom), dass die Kopie offline vollstaendig aufbaut; `pruefung.sh` fuehrt Probe + Kalibrierung.
