# FE-002 · Diagnose der 44 roten Fälle in `tests/design/h1-funktionsinventar.test.ts` (Nacharbeit 2)

**Status: Ursache ist die Prüfumgebung, kein Produkt- und kein FE-002-Befund. Keine Produkt- oder
Teständerung. FE-002 noch nicht menschlich abgenommen.**

Gebunden an: Kandidat `a3116cac95e7ba227d24649f1b8513335a5f7012`, Prüfplan
`uebernahme-fe002-a3116cac95e7`, Prüfschritt `header-gezielt` (Belege unter
`HISTORIE/nacharbeit-2/PRUEFUNG/`: `header-gezielt.json`, `header-gezielt.log`, `PLAN.json`).

## 1. Befund

- Alle 44 roten Fälle melden dieselbe Ursache: `expected 'Error: Zielbild nicht lesbar: /Users/…' to be
  null` in Zeile 757. Gemeint ist `expect(fehler).toBeNull()`. `fehler` ist der Fehler aus dem
  `beforeAll`.
- Der Fehler kommt aus `tests/design/h1-chromium.ts:172-173`. Die Startvorrichtung `h1Strecke`
  prüft `existsSync(ZIELBILD)` und bricht sonst bewusst ab („fail-closed“). `ZIELBILD` ist ein
  **absoluter Mac-Pfad** (`h1-chromium.ts:25`):
  `/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Main.dc.html`.
- Der Prüfschritt lief auf **Linux**, alle Pfade im Ergebnis beginnen mit `/home/kn/pruef/…`. Dort
  fehlt diese Datei. Im Repository liegt sie nicht, im Arbeitsbaum gibt es kein `design/**/*.dc.html`.
  `PLAN.json` stellt sie nicht bereit.
- Die Vorrichtung startet die App deshalb gar nicht. Keine Zeile des Inventars wurde gegen die App
  gemessen, rot ist nur die Vorbedingung.

## 2. Abgrenzung

- **Nicht FE-002:** `h1-chromium.ts` und sein Pfad gehören zum Hauptstand (JOB 3060). FE-002 hat diese
  Datei nicht geändert. Derselbe Mac-Pfad steht auch in `zielbild-h5-start`, `zielbild-h5-fragen`,
  `h6-chromium.ts` und `k2-buehne.ts`. Jede dieser Dateien würde in dieser Umgebung genauso
  scheitern.
- **Gegenbeleg im selben Lauf:** Die sieben übrigen Dateien des Schritts sind grün:
  - `kopfband-fe002.test.tsx`, `kopfband-fe002-chromium.test.ts` und `pruefumgebung.test.ts`
  - `tastaturweg-im-echten-browser.test.ts`
  - `klara-regressionsinventar.test.ts` (K1–K7)
  - `mega84-bildbeschreibungsweg-sammler.test.tsx`. Damit ist der in Nacharbeit 1 nur gerechnete
    Zähler 435 jetzt **gemessen bestätigt**.
  - `dateiname-bricht-um-chromium.test.ts` (JOB 4095, P1–P4 bei 360/320 px)

  Der Prüfschritt `capture-fall12` ist ebenfalls grün, Fall 12 (de) und (en). Der rote Fall aus dem
  98ee-Volllauf ist am neuen Kandidaten damit nicht reproduziert.
- **Warum es früher grün war:** Die bisherigen Volläufe (`./tools/check` auf dem B6-Prüfserver) hatten
  die Datei unter diesem Pfad. Der neue Übernahme-Prüfweg (`/home/kn/ergebnis/uebernahme-…`) hat sie
  nicht.

## 3. Warum keine Code-Änderung

Den Pfad relativ zu machen, die Vorbedingung zu entfernen oder sie in einen Überspringzweig zu
verwandeln, hieße eine gemeinsame Prüfvorrichtung des Hauptstands abzuschwächen. Davon wären auch
die Zielbild-Abgleiche H1, H5 und H6 betroffen. Ein „übersprungen“ wäre zudem kein Prüfbeleg. Beides
schließt der Auftrag aus. Die Ursache liegt in der Bereitstellung der Prüfumgebung und muss dort
behoben werden.

## 4. Gegenprobe (ergänzend zu `PLAN.json`, Schritt `header-gezielt`)

Voraussetzung auf dem Prüfserver: Die Mockup-Datei `design/klarwerk/Main.dc.html` aus dem
Steuerungsbestand liegt unter dem Pfad, den die Vorrichtung erwartet. Das geht zum Beispiel über eine
schreibgeschützte Spiegelung bzw. einen Symlink
`/Users/peterkohnert/klarwerk_steuerung/design → <Spiegel des Steuerungsbestands>/design`.
Dieselbe Bereitstellung, die die B6-Volläufe haben. Danach:

```
test -r /Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Main.dc.html   # muss Exit 0 sein
./tools/build
node_modules/.bin/vitest run tests/design/h1-funktionsinventar.test.ts --maxWorkers=1 --minWorkers=1
```

**Erwartung:** Alle Fälle der Datei sind grün, ohne übersprungene Fälle. Das schließt den schon jetzt
grünen Fall „die Tabelle ist vollständig … = 44“ und die 44 Zeilenfälle ein. Bleibt danach ein Fall rot, ist das ein echter Inventarbefund und wird an genau
dieser Zeile behoben.

## 5. Fehlendes Mittel

Die Mockup-Datei (`Main.dc.html`) fehlt auf dem Übernahme-Prüfserver. Die Bauseite kann sie weder
bereitstellen noch prüfen. Der Steuerungsordner liegt außerhalb des freigegebenen Arbeitsbereichs.
