# FE-002 · Diagnose des C2-Fehlklicks im Volllauf (Lauf 3, Runde 4)

**Status: Diagnose vorbereitet, Serverausführung offen. Kein Produktfehler festgestellt.
FE-002 noch nicht menschlich abgenommen.**

Gebunden an: Ben-Beleg `beleg:bd315c19-3607-4735-8c29-93a495d2adc3`, Kandidat
`7ed5ada0a90c2670c18917f02336406d76aa5b94` (= `c2c0c411` + Versionsschritt .625).
In dieser Runde wurden weder Produktdateien noch bestehende Tests verändert. Neu sind nur dieser
Bericht und das eigenständige Diagnoseskript `scripts/fe002-c2-diagnose.ts`.

---

## 1. Was rot war (Originalbelege)

| Prüfauftrag | Art | Ergebnis | Inhalt |
|---|---|---|---|
| `pa-1790597147-03157850` (g5) | voll, `./tools/check` | **nicht bestanden**, exit 1 | einziger fachlich roter Fall: `tests/wiki-orientierung/gliederung-mit-tastatur-chromium.test.ts` › C2 „derselbe Weg mit der Maus trifft dieselbe Überschrift“ |
| dieselbe Anlage, `wiederholung-ausgabe.txt` | Einzelwiederholung der Datei | grün | C0–C5 bestanden |
| `pa-1790597147-4af4b6ef`, `pa-1790597147-cd771027` (g9) | gezielt (FE-002-Prüfungen, Bilder) | bestanden | ohne Bezug zu C2 |

**Die Abweichung im roten Lauf** (`ergebnis.json`, `rote_tests.failed_tests`):
`expected … knopf: "Drei"` · `received … knopf: "EinsZwei"`, beide `click` mit `echt: true`,
`zeigerart: "mouse"`. Der Zeigerklick auf „Drei“ kam also als echter Mausklick am Knopf „EinsZwei“ an.

**Die grüne Einzelwiederholung am selben Commit** (`wiederholung-ausgabe.txt`, Zeile 234):
`griff: x 1000, y 377,1875, Höhe 18,75 px, Fenster 1620×900, getroffen BUTTON#bib-gliederung-sprung-2 „Drei“`.

**Was die Belege NICHT enthalten:** Die Konsolenzeile `JOB 4145 R2 · C2 · Zeiger · {griff…}` des
roten Laufs fehlt in der gekürzten Vollausgabe (`ausgabe.txt`: nur die Quelltextzeile 285 im
Fehlerausschnitt). Der Griff des roten Laufs, also der gemessene Klickpunkt, ist deshalb **nicht
belegt**. Ebenso fehlt das `pointerdown`-Ereignis, weil der Fehlerausschnitt nur `click` filtert.

**Häufigkeit in den vorhandenen Belegen** (alle `ergebnis.json` unter `waechter/belege/testserver`,
Volläufe mit Commits, die `b8a785b6` enthalten, den Umbau von C2 auf den echten Zeiger): **8
Volläufe, 1 × C2 rot** (dieser). Grün waren unter anderem der Hauptstand `8bc3b5ba` und `ad623d82`
sowie die FE-002-Kandidaten `60ddd650` (Runde 1) und `d74c93cd` (Runde 2). Die beiden roten
`abbau-0/1.test.ts` stehen in **allen** acht Volläufen, auch in den bestandenen. Sie gehören nicht
zu diesem Befund. 16 gezielte Läufe dieser Datei (Aufnahme `dokument-pointer-bedienung`) enthalten
kein C2-Rot.

---

## 2. Was der Code an dieser Stelle tut

- `tests/wiki-orientierung/gliederung-mit-tastatur-chromium.test.ts:131-138` · `frisch()`: lädt
  `/wissen/:id` und wartet **nur darauf, dass `[data-testid="bib-gliederung"]` im Baum steht**,
  nicht darauf, dass die Lesefläche fertig aufgebaut und in Ruhe ist.
- `tests/wiki-orientierung/gliederung-zeiger.ts` · `zeigerKlick()`: misst den Griff einmal
  (`getBoundingClientRect` und `elementFromPoint`) und klickt danach mit `seite.mouse.click(x, y)`
  an **festen Koordinaten**. Zwischen Messung und Klick liegen zwei Rundreisen zu Chromium. Ob der
  Knopf beim Klick noch dort liegt, wird nicht erneut geprüft.
- `apps/web/src/components/bibliothek/BibliothekLesen.tsx:2180-2181, 2458-2515`: die Kollisionszeile
  `job3025-kollision` („Keine offene Kollision an diesem Objekt.“) wird zurückgehalten, solange ihre
  Daten laden (`kollision.lage === "laedt"`), und erscheint erst danach. Sie steht **über** Titel,
  Sprungleiste und Gliederung. `bib-lesen` ist eine Flex-Spalte mit `gap-[18px]`.
- FE-002 hat die Lesefläche, die Gliederung, die Vorrichtung `h4-harness` und die beiden Testdateien
  **nicht** geändert (`git diff ad623d82 HEAD`: nur `apps/web/src/shell/*`, `index.css`,
  `styles/modern.css`, `texte/fe002.ts`, `app/navigationGliederung.ts`). Das Kopfband hat eine feste
  Höhe (`h-[56px]`).

---

## 3. Funktionsprobe des Diagnoseskripts auf dem Mac (keine Diagnosemessung)

Nur um zu prüfen, dass das Skript läuft: 3 + 3 + 2 Durchläufe, ein Chromium (149.0.7827.55),
Arbeitsbaum dieser Runde (Produkt = Kandidat). Keine Last, keine Wiederholung in großer Zahl. Die
Zahlen sind **Beobachtungen aus dieser Probe, keine Häufigkeitsaussage**:

- Die Gliederung steht zuerst an einer **vorläufigen Lage** (Knopf „Drei“ top 328,7 px). Wenige
  Millisekunden später (gemessen 4–14 ms) wird `DIV#job3025-kollision` eingefügt (Höhe 21,1 px).
  Die `layout-shift`-Quellen `bib-kopf-spruenge`, `bib-titel`, `bib-gliederung` und `bib-text`
  rücken dabei um **39,1 px** nach unten. 39,1 = 21,1 px Zeile + 18 px Spaltenabstand. „Drei“ steht
  danach bei top 367,8 px (Mitte 377,19, genau der Griff der grünen Wiederholung).
- In einem Durchlauf fiel diese Verschiebung **zwischen Beginn der Griffmessung und `pointerdown`**
  (t = 136,8 ms; Messbeginn 128, Zeigerdruck 139,8). Der Griff wurde dort nach der Verschiebung
  gemessen; der Klick traf „Drei“.
- **Rechenprobe zum roten Befund:** Ein Griff auf der vorläufigen Lage ergibt y ≈ 328,7 + 9,4 =
  338,1. Nach der Verschiebung liegt dort „EinsZwei“ (Zeilen je 18,75 px: „Drei“ 367,8, „Zwei“
  ≈ 349,1, „EinsZwei“ ≈ 330,3–349,1). Genau „EinsZwei“ meldete der rote Lauf.
- **Kopfband (FE-002):** In allen Durchläufen blieb das Kopfband 56 px hoch, Stufe 0 bei 1620 px.
  `layout-shift`-Einträge aus dem Kopfband (Wert 0,0004) betreffen Elemente **innerhalb** des Bands
  mit unveränderter Ober- und Unterkante. Keiner verschiebt die Lesefläche.

---

## 4. Diagnose

**Arbeitshypothese, durch Code und Probe gestützt, am roten Lauf selbst nicht belegt:** Der
C2-Fehlklick ist ein **Wettlauf in der Prüfung**. C2 misst den Griff, sobald die Gliederung im Baum
steht. Trifft die Messung die vorläufige Lage, bevor die Kollisionszeile eingefügt ist, und fällt
die Einfügung in die Millisekunden bis zum Klick, landet der echte Mausklick 39,1 px höher, also auf
„EinsZwei“. Unter Last (Volllauf, parallele Browser) wird dieses Zeitfenster eher getroffen als in
der Einzelwiederholung.

**FE-002-Bezug:**
- *Geometrisch:* nicht beteiligt. Die verschiebende Einfügung stammt aus der Lesefläche. Das
  Kopfband ändert seine Höhe nicht, und seine Verschiebungen bleiben im Band.
- *Zeitlich:* nicht ausgeschlossen. Die Stufenmessung des Kopfbands (`kopfbandStufe.ts`, seit
  Runde 3 mit Feld-Zwilling) läuft im selben Hauptthread und kann die Reihenfolge von Messung,
  Einfügung und Klick verschieben. Ob sie die Häufigkeit ändert, lässt sich nur mit einem
  Basisvergleich zum Hauptstand gleicher Last messen (Abschnitt 5).

**Kein Produktfehler festgestellt.** Dass die Kollisionszeile nach dem Laden erscheint, ist das
bestehende Verhalten von JOB 3025/3068. Die daraus folgende Verschiebung ist eine
Bedienbeobachtung, kein FE-002-Befund und nicht Gegenstand dieses Auftrags.

---

## 5. Vorbereitete Gegenprobe für den Server (von Ben zu prüfen und zu binden)

**Skript:** `scripts/fe002-c2-diagnose.ts`. Es liegt nicht in der Vitest-Sammlung (`vitest.config.ts`
sammelt `tests/`, `services/`, `apps/web/src`) und nicht im Biome-Umfang (`biome.json` ignoriert
`scripts`). Es läuft nicht in `tools/check`.
- **Weg:** derselbe wie C2. Vorrichtung `tests/design/h4-harness.ts` und Klick `zeigerKlick` aus
  `tests/wiki-orientierung/gliederung-zeiger.ts`, unverändert importiert. Bestand
  `VERSCHACHTELT_LANG` am ersten Eintrag, `/wissen/:id`, Fenster 1620×900. Je Durchlauf frisch
  geladen, Warten nur auf die Gliederung, dann sofort `zeigerKlick(s, "Drei")`.
- **Aufzeichnung in der Seite** (per `addInitScript`, nur in der Prüfseite):
  - `layout-shift`-Einträge mit Quellknoten und Rechtecken;
  - eingefügte Elemente mit Lage;
  - Lage von „Drei“ je Bild;
  - `data-stufe` und Höhe des Kopfbands;
  - Zeitpunkt des echten `pointerdown`.
- **Bericht (JSON) je Durchlauf:** Treffer, `griffAbweichungPx` (Griffmitte gegen Knopfmitte beim
  Zeigerdruck), Bewegung von „Drei“ im Klickfenster, Verschiebungen nach Erscheinen der Leiste,
  Verschiebungen aus dem Kopfband, Einfügungen.
- **Zusammenfassung:** `fehlklicks`, `griffAufVeralteterLage`, `mitBewegungImKlickfenster`,
  `mitVerschiebungNachLeiste`, `mitVerschiebungAusDemKopfband`, Häufigkeit der Einfügungen und
  gemessene Kopfbandhöhen.
- **Geprüft hier:** `tsc --noEmit` mit der Wurzelkonfiguration grün; Biome-Formatierung über eine
  Kopie; Funktionsprobe (Abschnitt 3).

**Vorschlag für den Prüfplan** (Ben bindet und beauftragt; die Bauseite fordert keinen Server an):

```
# P1 · Kandidat (7ed5ada0 bzw. der feste neue Kandidat, der dieses Skript enthält)
./tools/build
./tools/browserdeckel.sh browser npx tsx scripts/fe002-c2-diagnose.ts --durchlaeufe 100 --bericht <belege>/p1-kandidat.json

# P2 · derselbe Lauf unter Last: gleichzeitig ein zweiter Browserlauf derselben Datei-Gruppe
#      (z. B. die Browsergruppe von tools/check), damit das Zeitfenster des Volllaufs entsteht

# P3 · Basisvergleich am Hauptstand ad623d82 — siehe „fehlender Weg“ unten
```

**Lesart:**
- `griffAufVeralteterLage > 0` und/oder `fehlklicks > 0` mit Verschiebungsquelle
  `job3025-kollision` und ohne vertikale Kopfband-Verschiebung bestätigt die Hypothese
  (Wettlauf in der Prüfung).
- Eine vertikale Verschiebung mit Quelle im Kopfband oder eine andere Kopfbandhöhe als 56 px wäre
  ein FE-002-Befund.
- Unterscheidet sich die Häufigkeit zwischen P1 und P3 bei gleicher Last deutlich, beeinflusst
  FE-002 das Zeitfenster.

**Fehlender Weg (konkret gemeldet):** Der reguläre Prüfweg fährt einen **festen Commit**. Das
Diagnoseskript gibt es am Hauptstand `ad623d82` nicht. Für P3 braucht es einen Weg, der den
Hauptstand auscheckt und **nur** `scripts/fe002-c2-diagnose.ts` hinzulegt (Überlagerung einer
Datei), oder einen eigens angelegten Vergleichszweig „Hauptstand + Skript“. Einen solchen Weg sehe
ich im Prüfweg nicht. Ob der Server ihn anbietet, muss Ben klären. Ebenso fehlt ein Mittel, den
roten Volllauf selbst nachträglich zu vermessen: seine Griffzeile ist nicht erhalten.

---

## 6. Verbleibender Befund und nötiger nächster Schritt

- **Offen:** Der vollständige `./tools/check` am Kandidaten ist nicht grün (E8, Ben-Endabnahme
  gesperrt). Seine einzige fachliche Abweichung ist C2 der Gliederungsprüfung. Nach dieser Diagnose
  ist sie wahrscheinlich ein zeitabhängiger Prüf-Wettlauf ohne FE-002-Geometrie. Belegt ist das erst
  mit der Serverausführung aus Abschnitt 5.
- **Nächster Schritt (nicht in diesem Auftrag, keine Nacharbeit hier):**
  1. Ben prüft `scripts/fe002-c2-diagnose.ts` und bindet P1/P2 (und P3, falls ein Weg besteht).
  2. Bestätigt sich die Hypothese, gehört die Abhilfe zur Prüfung von JOB 4145 bzw. der Aufnahme
     `dokument-pointer-bedienung`, nicht zu FE-002. Denkbar wäre etwa: vor dem Griff auf die ruhende
     Lesefläche warten (auch auf die Kollisionszeile) oder den Griff unmittelbar vor dem Klick erneut
     messen. Das braucht einen eigenen, freigegebenen Auftrag, weil bestehende Tests nicht geändert
     werden dürfen.
  3. Danach ein neuer vollständiger `./tools/check` am festen Kandidaten und ein neues Ben-Urteil
     (E8). Die menschliche Probe E7 bleibt davon unberührt offen.
