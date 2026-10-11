# Vorführweg · Herkunft der Bildschirmansichten

Aufnahme 20260922 · gesamt-demo-erklaermodus (package:storyboard, R-1660).

Die 20 Bilder unter `apps/web/public/demonstration/vorfuehrweg-ansichten/` sind die Bildschirmansichten,
die der Vorführweg (`apps/web/public/demonstration/vorfuehrweg.html`) je Station verlinkt: Deutsch
`<station>.png`, Englisch `<station>-en.png`.

**Herkunft:** aufgenommen von `tests/vorfuehrweg/ansichten-chromium.test.ts` an der gebauten Fassung,
in echtem Chromium, mit über `POST /api/admin/demo-seed` geladenen Demodaten in der jeweiligen Sprache.
Gesichert als Prüfartefakte (Gruppe `vorfuehrweg-ansichten`, `BILDBELEGE.json`) und unverändert unter
ihrem Ursprungsnamen übernommen.

Alle 20 Bilder entsprechen dem Aufnahmelauf an Kandidat `73a26d5e42aec068b759ebeea0813ed798c5138a`
(Prüfauftrag `auftrag-703b41de15245d33aab2-73a26d5e42ae`, bildbeleg-000 bis -019), also an der Fassung
mit integriertem Hauptstand (u. a. Bibliothek mit Inhalt vor der Kenntnisnahme, neue Einleitung unter
„Fragen“). Der Nutzungshinweis ist regulär bestätigt; die Aufnahme verlangte, dass der jeweilige
Nachweistext (etwa Karls Erfahrung oder die Titel der Fassungen V1, V2 und V3) vollständig und
unverdeckt im Bild steht.

- **18 Bilder** wurden nach Sichtvergleich mit der bisherigen Auslieferung (Aufnahmen aus `775fd23c`
  und `0f9590de`, die die Oberfläche vor der Integration zeigten) durch diesen Lauf ersetzt.
- **importwege, importwege-en** waren in diesem Lauf bytegleich mit der bisherigen Auslieferung
  (bildbeleg-008/-009) und blieben unverändert.

**Abgleich:** `tests/vorfuehrweg/ansichten-auslieferung.test.ts` verlangt je Datei genau die
unten stehende Größe und SHA-256 und ruft jede verlinkte Datei über den echten statischen
Auslieferungsweg ab.

**Grenzen:** Die Bilder zeigen den Stand ihrer Aufnahmefassung. Ohne freigeschaltetes Modell zeigt
`fragen` die vorbefüllte, gesperrte Frage; `lagerfall` zeigt Karls Eintrag in der Bibliothek;
`schweissnaht` zeigt den geöffneten Fassungsverlauf unter „Mehr“.

| Datei | Bytes | SHA-256 |
|---|---:|---|
| bibliothek-en.png | 124583 | 9f7f69366b96a5b572e46e1711a32a9a9abaf60f43fb18bc7b5e063137cb640a |
| bibliothek.png | 124066 | e33179711fcad9b8c0cdcf38ba69650a99e848e13972b013933afc657a0a69f6 |
| demodaten-en.png | 105869 | be6a668cf66f2881ebbdde6776849a7fecf46908736b8b92a8fec2a2041853d8 |
| demodaten.png | 104973 | b6b9fb662c1809ea11dbb586da0c94d7e83c8be4d43fc15a180605262663d014 |
| erfassen-en.png | 73989 | 2875880581ff3582a140e1cdfcbbd76e32777d8ccb136d7fa4a4ba300c58ddd3 |
| erfassen.png | 72027 | 113205389185a8582ffe31011ef13b12c86f56621a04e095f5dba27dc02e6153 |
| fragen-en.png | 87685 | 5e093bf4288caa10bb6fae0054d348554ddc5502081f98b700d84c523b4ef8f2 |
| fragen.png | 87402 | 3c87410efaf658aefc20da41f561b34c0d8ab34bcd085dae99fac5dcbc04a5f6 |
| importwege-en.png | 81869 | ba296aa54349f878e5a0448952eeaa922728c5a32673937cb3bb990381a657ed |
| importwege.png | 87908 | 5f95a7933ec2857aab5552ee09396f227570832d1e797a4e1b04b54f2a3d663f |
| konflikte-en.png | 95966 | 12f4df09d3e0a9d1cde8262e6ce1262c73a7d6cf33fcc9e06e184361fae87c93 |
| konflikte.png | 95400 | 9b51e2a74c644c8495cefbff32a775d9cabecb9ce66b7a1146ec255187c8fb92 |
| lagerfall-en.png | 123350 | c69db633654cdc93cd2cb1a29d34b7c336d768d1e7f1459b7f9273cf9c3e335f |
| lagerfall.png | 125061 | 1dfdb4c3b9fba557e01d04dad0ea5f2780664a3d7930283a9d976e4536e18a54 |
| schweissnaht-en.png | 120411 | f2eee37c1ae870431f08cc3346626d04e8831c5825f00ae24490acbd7aa316e5 |
| schweissnaht.png | 126151 | 1cea861c24f9be88a0dafc11f1b391db4871447eb8992987e5c545e436d4ddd6 |
| start-en.png | 84361 | 5b4c751a2250b7d31d5f140f2cb3e8527bf870cfca093d6ab359f18328d7f597 |
| start.png | 81629 | 50286e40bcd614b614287911c56bff384491baebaffa130e08cfb2750d5a9a41 |
| validierung-en.png | 131366 | bee495dc697d9dc95418d653bf584131a20f106ac10b42a84cfbe1ae106c3ced |
| validierung.png | 133440 | c741028d55d5860bdfd368af3e20b8fe50baa479e08afccb32daa457e000a5b3 |
