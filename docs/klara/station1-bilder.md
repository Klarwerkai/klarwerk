# Station 1 — Bilder aus Word: was ankommt, was nicht

**Für wen:** Betrieb und Support. Ein Anwender erfasst ein Word-Dokument über Klara (Add-in) oder
den Import, und im Entwurf fehlt ein Bild. Diese Seite sagt, ob das erwartet ist, was der Anwender
dazu gemeldet bekommt und woran man es nachmisst.

**Stand:** 21.09.2026 · **Zusage, nicht Momentaufnahme:** festgeschrieben in
`tests/app/job2923-station1-beweislauf.test.tsx`.

## Die kurze Antwort

Rasterbilder kommen vollständig an. Metafile-Grafiken (EMF/WMF) kommen nicht an — sie werden
**nicht gerettet, sondern als Verlust gemeldet**. Nichts davon geschieht still: der Anwender sieht
im Panel den Satz, wie viele Bilder Word nicht herausgegeben hat, und der Text des Dokuments reist
vollständig mit.

## Was ankommt

Diese Bildformate werden vollständig in den Entwurf übernommen:

- `image/png`
- `image/jpeg`
- `image/jpg`
- `image/gif`
- `image/webp`

„Vollständig" heisst bytegleich, und zwar an **zwei** Stellen: die Bildbytes im gespeicherten
Entwurf UND die Bildbytes, die der Anzeigebaustein am Bildschirm ausgibt, sind dieselben, die im
Word-Dokument stecken — nicht neu kodiert, nicht abgeschnitten, nicht verdoppelt. Beide Stellen
werden einzeln gemessen, weil zwischen ihnen noch eine Verarbeitungsstufe liegt
(`SanitizedHtml` sanitisiert clientseitig ein zweites Mal). Gemessen an zwei echten PNG im
Prüfdokument `tests/fixtures/job2912-zwei-bilder.docx` (Fall `B1`).

Ausnahme, die dazugehört: sehr grosse Bilder werden vor dem Speichern verkleinert (Bildbudget,
JOB 3400). Der Entwurf trägt dann eine kleinere Fassung, und die Antwort nennt sie ausdrücklich
(`imagesShrunk` / `imagesKeptOriginal`). Verloren geht dabei kein Bild.

## Was verloren geht

Diese Formate werden beim Speichern verworfen:

- `image/emf` und `image/x-emf` — Enhanced Metafile
- `image/wmf` und `image/x-wmf` — Windows Metafile
- `image/svg+xml` — bewusst gesperrt, weil SVG Skripte tragen kann (XSS)

EMF/WMF ist der Normalfall bei Grafiken, die aus Excel, PowerPoint oder einer PDF in ein
Word-Dokument eingefügt wurden. Word speichert sie dort als Vektorgrafik, nicht als Bilddatei.

Was der Anwender dann sieht:

- Der **Text** des Dokuments kommt vollständig an. Der Entwurf ist nicht leer, er ist bildlos.
- Steht das Bild in einer Abbildung, bleibt die **Bildunterschrift** stehen — ohne Bild.
- Das Panel meldet den Verlust in einem eigenen Satz, zuerst und sichtbar:
  „Word hat *n* Bilder nicht herausgegeben — der Text ist vollständig."
- **Es wird kein Ersatzbild eingesetzt.** Wo nichts ankam, steht nichts.

Was Support dem Anwender raten kann: die Grafik in Word einmal als PNG einfügen (Rechtsklick →
*Als Grafik speichern*, dann wieder einfügen) und erneut erfassen.

## Warum das so bleibt (Entscheidung 5)

Entscheidung 5 der Fachfragen vom 21.09.2026
(`gespraech/uebernahme-claude-20260920/ENTSCHEIDUNGEN-FACHFRAGEN-20260921.md`, Zeile 11):

> Nur unterstützte Rasterbilder; EMF/WMF ausdrücklich außerhalb des Umfangs (eigene spätere Zeile,
> wenn ein Kunde es braucht).

Begründung dort: ein echter Word-Host-Nachweis fehlt, und der Umfang wird ohne Nachweis nicht
erweitert. Eine Metafile-Rettung ist damit kein Fehler, der offen steht, sondern eine eigene,
später zu beauftragende Zeile.

## Was ausdrücklich offen ist

Ob `InlinePicture.getBase64ImageSrc()` im echten Word-Host bei einer Metafile-Grafik ein
Rasterbild herausgibt, ist **nicht gemessen**. Das braucht einen Menschen mit geladenem Add-in in
Word; in der automatischen Prüfung ist es nicht feststellbar. Solange das offen ist, wird hier
nichts über das Verhalten des Word-Hosts behauptet.

## Woran man es nachmisst

Alles auf dieser Seite hängt an `tests/app/job2923-station1-beweislauf.test.tsx`. Der Lauf schiebt
zwei echte `.docx` durch den echten Import — Route, Speichern, Zurücklesen, Bildschirm — und
druckt am Ende ein Protokoll aus.

| Fall | Was er hält |
| --- | --- |
| `B0` | Die Prüfdokumente tragen wirklich echte PNG- bzw. EMF/WMF-Bytes, kein umbenanntes PNG. |
| `B1` | Zwei PNG kommen bytegleich im gespeicherten Entwurf **und** am Bildschirm an und sind dort nicht ausgeblendet. |
| `B2` | Bei EMF/WMF kommt kein Bild an, der Text bleibt, und es wird keines erfunden. |
| `B4` | Das Panel zeigt den Verlustsatz sichtbar und an erster Stelle. |
| `B5` | Ohne Verlust erscheint keine Verlustmeldung. |
| `Z1` | Die Menge der durchgelassenen Formate ist erschöpfend erhoben und gepinnt. |
| `Z3` | **Diese Seite** wird gegen die Messung gehalten. |

Die Entscheidung am Code trifft der Allowlist-Sanitizer in `services/structure/src/sanitize.ts`
(`isSafeImgSrc`). Wer die Formatliste dort ändert, macht `Z1` und `Z3` rot — und muss diese Seite
mitführen. Das ist so gewollt: ein Betreibertext, den niemand nachrechnet, wird unweigerlich
falsch.
