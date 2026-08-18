// ================================================================================================
// JOB 1135 · D1 — UMFLOSSENE WORD-BILDER: DIE NICHT-ERFASSUNG IST BELEGT.
// ================================================================================================
//
// JOB-964-Pruefluecke 1, woertlich: „Word-Smoke fuer nicht-inline/umflossenes Bild … Fall: Dokument
// mit inline Bild plus umflossenem/frei positioniertem Bild; erwartetes Ergebnis: Meldung macht
// Geltungsbereich sichtbar **oder belegt Nicht-Erfassung**."
//
// DIESE DATEI BELEGT DIE NICHT-ERFASSUNG — den zweiten der beiden zulaessigen Zweige.
//
// WORAN ES HAENGT (JOB 964 §3.3): Die Erhebung geht ueber `context.document.body.inlinePictures`.
// Die Sammlung heisst `inlinePictures` und ist es woertlich: **Ein umflossenes, verankertes oder
// frei positioniertes Bild ist keine `InlinePicture`** — es steht in keiner der gesammelten
// Kollektionen. Und `countUndeliveredWordImages` zaehlt `<img>`-Tags; wo Word keines erzeugt, hat
// es nichts zu zaehlen.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESER FALL SCHAERFER IST ALS DER REINE KOPFZEILENFALL (Pruefluecke 2).
// ------------------------------------------------------------------------------------------------
//
// Steht ein Bild NUR in der Kopfzeile, ist die Bilanz LEER — eine Null, die als Entwarnung gelesen
// wird. Hier liegt der Fall anders und unangenehmer: Das inline-Bild erzeugt sehr wohl ein `<img>`,
// die Bilanz ist also NICHT leer. Sie sieht aus wie eine Messung und ist eine **Teilmessung**.
//
//   „1 Bild konnte Word nicht uebergeben" klingt nach einer vollstaendigen Auskunft.
//   Tatsaechlich fehlen zwei — das gezaehlte und das nie gesehene.
//
// Eine Zahl, die falsch ist, faellt irgendwann auf. Eine Zahl, die STIMMT und trotzdem eine andere
// Menge meint als der Leser annimmt, faellt nicht auf. Genau das misst U3 und U4.
//
// ------------------------------------------------------------------------------------------------
// KEIN OFFICE-LAUF, UND DAS IST HIER AUSDRUECKLICH BENANNT.
// ------------------------------------------------------------------------------------------------
//
// Dass `body.getHtml()` fuer ein umflossenes Bild kein `<img>` liefert, ist Office.js-Semantik und
// in diesem Durchgang NICHT in Word gemessen — sie bleibt nach Regelwerk Z. 493 eine UNBEWIESENE
// HYPOTHESE (JOB 964 §8.4 sagt dasselbe ueber sich selbst). Gemessen wird hier, was daraus im
// Produkt folgt: Ein HTML, in dem ein Bild keine Spur hinterlaesst, erzeugt eine Bilanz, die den
// Verlust nicht kennt. Diese Folge ist unabhaengig davon wahr, WARUM die Spur fehlt.

import { describe, expect, it } from "vitest";
import {
  countUndeliveredWordImages,
  fillWordImages,
  prepareWordDraftRequest,
} from "../../apps/web/src/lib/wordAddin";

// Ein Dokument mit ZWEI Bildern: eines inline (Word gibt es als `<img>` aus), eines umflossen
// (Word gibt es gar nicht aus). Was hier steht, ist der Textkoerper, wie er beim Client ankommt.
const INLINE_PLUS_UMFLOSSEN =
  '<html><body><p>Pruefablauf</p><p><img src="cid:inline01"></p><p>Der Umlaufplan steht daneben.</p></body></html>';

// Dasselbe Dokument ohne das umflossene Bild — zeichengleich, weil das umflossene nie erschien.
const NUR_INLINE =
  '<html><body><p>Pruefablauf</p><p><img src="cid:inline01"></p><p>Der Umlaufplan steht daneben.</p></body></html>';

// Zwei inline-Bilder — die Gegenprobe: hier sieht der Zaehler wirklich beide.
const ZWEI_INLINE =
  '<html><body><p>Pruefablauf</p><p><img src="cid:inline01"></p><p><img src="cid:inline02"></p></body></html>';

const TEXT = "Pruefablauf\nDer Umlaufplan steht daneben.";

// Ein winziges, gueltiges PNG — genau das, was Word fuer ein geliefertes Bild zurueckgibt.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("JOB 1135 · U — das umflossene Bild hinterlaesst keine Spur", () => {
  it("U1: ein Dokument mit inline UND umflossenem Bild traegt nur EIN <img>", () => {
    // Die Vorbedingung des ganzen Befundes. Faellt sie, war die Annahme ueber Word falsch.
    const treffer = INLINE_PLUS_UMFLOSSEN.match(/<img\b[^>]*>/gi) ?? [];
    expect(treffer).toHaveLength(1);
    expect(countUndeliveredWordImages(INLINE_PLUS_UMFLOSSEN)).toBe(1);
  });

  it("U2: die Bilanz ist von der eines Dokuments OHNE das umflossene Bild nicht zu unterscheiden", () => {
    const mitUmflossenem = prepareWordDraftRequest(INLINE_PLUS_UMFLOSSEN, TEXT);
    const ohneUmflossenes = prepareWordDraftRequest(NUR_INLINE, TEXT);

    expect(mitUmflossenem.undeliveredImages).toBe(ohneUmflossenes.undeliveredImages);
    expect(mitUmflossenem.usedHtml).toBe(ohneUmflossenes.usedHtml);
    expect(mitUmflossenem.overBudget).toBe(ohneUmflossenes.overBudget);
    expect(mitUmflossenem.plainTextFallback).toBe(ohneUmflossenes.plainTextFallback);

    // UND die absoluten Werte, nicht nur ihre Gleichheit. Ein reiner Vergleich waere auch dann
    // gruen, wenn BEIDE Seiten dasselbe falsche Signal traegen — dieser Fall ist beim Bauen
    // wirklich eingetreten (Gegenmutation M3 blieb zunaechst gruen und hat die Luecke gezeigt).
    expect(mitUmflossenem.usedHtml).toBe(true);
    expect(mitUmflossenem.overBudget).toBe(false);
    expect(mitUmflossenem.plainTextFallback).toBe(false);
    // Die Nicht-Erfassung ist damit BELEGT: aus dem gelieferten HTML ist der Unterschied
    // grundsaetzlich nicht herstellbar — kein Zaehler kann ihn sehen. Und die drei Warnsignale
    // stehen dabei allesamt auf „alles in Ordnung".
  });

  it("U3: wird das inline-Bild geliefert, meldet die Bilanz „nichts fehlt“ — obwohl eines fehlt", () => {
    // Der gefaehrlichste Fall dieses Jobs: Word liefert das eine Bild, das es sieht. Danach steht
    // die Bilanz auf null, und der Nutzer liest „vollstaendig".
    const gefuellt = fillWordImages(INLINE_PLUS_UMFLOSSEN, [PNG]);

    expect(gefuellt.filled).toBe(1);
    expect(gefuellt.remaining).toBe(0);
    expect(gefuellt.hindernis).toBeNull();
    // Null gemeldete Verluste — und das umflossene Bild fehlt trotzdem.
  });

  it("U4: wird das inline-Bild NICHT geliefert, meldet sie „1“ — eine Teilmenge, die wie ein Ganzes aussieht", () => {
    const bilanz = prepareWordDraftRequest(INLINE_PLUS_UMFLOSSEN, TEXT);

    expect(bilanz.undeliveredImages).toBe(1);
    // Die Zahl ist RICHTIG fuer das, was gezaehlt wurde, und FALSCH als Auskunft ueber das
    // Dokument. Genau diese Sorte Zahl faellt nie auf.
  });

  it("U5 (KALIBRIERUNG): bei zwei INLINE-Bildern zaehlt derselbe Zaehler wirklich beide", () => {
    // Ohne diesen Fall waere „der Zaehler sieht zu wenig" auch dann erfuellt, wenn er schlicht
    // kaputt waere. Er ist es nicht: Was im Textkoerper steht, erfasst er vollstaendig.
    expect(countUndeliveredWordImages(ZWEI_INLINE)).toBe(2);
    expect(prepareWordDraftRequest(ZWEI_INLINE, TEXT).undeliveredImages).toBe(2);
  });

  it("U6 (KALIBRIERUNG): ein geliefertes Bild wird nicht mehr als fehlend gezaehlt", () => {
    // Die zweite Kalibrierung: Der Zaehler unterscheidet geliefert von nicht geliefert. Ohne sie
    // waere U3 auch dann gruen, wenn er pauschal null meldete.
    const gefuellt = fillWordImages(ZWEI_INLINE, [PNG, PNG]);

    expect(gefuellt.filled).toBe(2);
    expect(gefuellt.remaining).toBe(0);
    expect(countUndeliveredWordImages(gefuellt.html)).toBe(0);
  });
});
