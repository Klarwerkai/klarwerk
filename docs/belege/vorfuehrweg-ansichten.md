# Vorführweg · Herkunft der Bildschirmansichten

Aufnahme 20260922 · gesamt-demo-erklaermodus (package:storyboard, R-1660).

Die 20 Bilder unter `apps/web/public/demonstration/vorfuehrweg-ansichten/` sind die Bildschirmansichten,
die der Vorführweg (`apps/web/public/demonstration/vorfuehrweg.html`) je Station verlinkt: Deutsch
`<station>.png`, Englisch `<station>-en.png`.

**Herkunft:** aufgenommen von `tests/vorfuehrweg/ansichten-chromium.test.ts` an der gebauten Fassung
von Kandidat `775fd23c497eef62d535da1ee82565944860c1a9` (Prüfauftrag
`auftrag-703b41de15245d33aab2-775fd23c497e`), in echtem Chromium, mit über `POST /api/admin/demo-seed`
geladenen Demodaten in der jeweiligen Sprache. Jede Aufnahme entstand erst, nachdem das Demo-Ergebnis
der Station sichtbar war. Gesichert als Prüfartefakte (Gruppe `vorfuehrweg-ansichten`,
`BILDBELEGE.json`) und unverändert unter ihrem Ursprungsnamen übernommen.

**Abgleich:** `tests/vorfuehrweg/ansichten-auslieferung.test.ts` verlangt je Datei genau die
unten stehende Größe und SHA-256 und ruft jede verlinkte Datei über den echten statischen
Auslieferungsweg ab.

**Grenzen:** Die Bilder zeigen den Stand ihrer Aufnahmefassung. Ohne freigeschaltetes Modell zeigt
`fragen` die vorbefüllte, gesperrte Frage; `lagerfall` zeigt Karls Eintrag in der Bibliothek.

| Datei | Bytes | SHA-256 |
|---|---:|---|
| bibliothek-en.png | 110789 | 1ff5fb26a6968c803ff3b9e755f045659ddb038401a89e77547cfab5ae5010dd |
| bibliothek.png | 109655 | 548461c672107ee17e0c72ca4beeaa61fa4a0eaaf1a1580c718399a4e02dcec4 |
| demodaten-en.png | 93871 | 4da4d11ec9da1c8f1309fecc5eab430b4316ea460691cefc59939de379b70179 |
| demodaten.png | 94864 | 6108d2484d64179c18f7700a4faa6db7bce7e5cba539c93a727633c193fdf39b |
| erfassen-en.png | 69870 | b35fe1ede3bb1d4f8f5b8272207d1cb3b9b3bd7f738b6a8ee81d0665dc0475b7 |
| erfassen.png | 70598 | 6b5361fff47734ecb2f1b85ab0e46fb956deac6641173a36256a3645859297af |
| fragen-en.png | 67209 | ca136a5ad1544ce2dbb7fb1f55b129e25ab3f3d04d9011ba855dfc23f8b5bd37 |
| fragen.png | 69011 | 5a86305fbc37b67ee5e374b7f537b0fad94306e0fc16d083d871e6ea72737f4c |
| importwege-en.png | 81869 | ba296aa54349f878e5a0448952eeaa922728c5a32673937cb3bb990381a657ed |
| importwege.png | 87908 | 5f95a7933ec2857aab5552ee09396f227570832d1e797a4e1b04b54f2a3d663f |
| konflikte-en.png | 95039 | b9abf0f551962054c718eaa85449b66d8856d7f6fd8c3df53f7e48cc3295e6ff |
| konflikte.png | 98397 | 35c93d4d75123be9a40820dcdf8568175c4331dce8e2b9e13eb349cbf3cefff2 |
| lagerfall-en.png | 113326 | da22911c24f8fe1a76a6c815be52d6bf98694608a9e4e1ff7815e36e812f63e7 |
| lagerfall.png | 110236 | d48cafaa5b855950290848e853841d90ebe233f3f4bd9a4c85f378787ea1f113 |
| schweissnaht-en.png | 111699 | a94408c235be2566ff43915543d505db9d3b9151101c5030dcaf5beddcde7ac4 |
| schweissnaht.png | 116168 | f3c9ec34ec31b9cffe8622109f5a26a2f1efb3ee753aa01b2a236479f33405d8 |
| start-en.png | 81623 | 0e9c26d36fad864d8f56700bbabe907449684cce98afc34470b5e7aa29badb46 |
| start.png | 82000 | df8c9ccddb11ccc10ff20ec66edfba8d09c08df78c668f5a78a4c755bc2285cd |
| validierung-en.png | 107906 | 353166a17defe2f298c4c32bcb7cdcb96217eb1f178ff1fe9b3de963551e5246 |
| validierung.png | 107529 | 498898e5143833b0bfbf404d5a0ec82b8241052d5b01c988b6ae30116ca47b80 |
