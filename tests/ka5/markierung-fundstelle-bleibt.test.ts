// ================================================================================================
// JOB 3006 · KA5 — DIE MARKIERUNG SUCHT MIT, SIE ERZÄHLT ABER NICHT MIT.
// ================================================================================================
//
// BENS BEFUND ZU RUNDE 2, und er trifft: Die um die Passage erweiterte Termmenge lief nicht nur in
// die Kandidatensuche, sondern auch in `captionSources` — die Auskunft, ob eine Quelle NUR über ihre
// Bild-Fußnote getroffen wurde. Die Oberfläche macht daraus ein sichtbares Herkunfts-Etikett
// („Bildbeschreibung", `apps/web/src/pages/Ask.tsx`). Damit konnte die Markierung eine Fundstelle
// behaupten, die es nie gab: dieselbe Frage, dieselbe Quelle, dieselbe Antwort — aber die Anzeige
// sagte, das Wissen stehe in der Bildunterschrift, obwohl die Frage es im Fließtext gefunden hat.
//
// DER FALL, DEN DIESER WÄCHTER FESTHÄLT, ist genau der aus BENs Messung:
//   · Die FRAGE trifft das Wissensobjekt über seinen FLIESSTEXT (`bodyText`, G27-Weg).
//   · Die MARKIERUNG trifft ausschließlich dessen BILDUNTERSCHRIFT.
//   · Titel und Aussage tragen weder Frage- noch Passagenwort — sonst entschiede schon die zweite
//     Hälfte der Regel (`!… core.includes`), und der Fall wäre stumpf.
// Erwartet wird: mit und ohne Markierung dieselbe Quelle, dieselbe Antwort, und `captionSources`
// bleibt in BEIDEN Fällen leer.
//
// UNGEMOCKT: echte `buildServices()`-Verdrahtung, echter `KoService.create` mit `bodyHtml`, echter
// `AskService.ask`. Nichts ist eingesetzt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Dieselbe Bauform, die `tests/app/ask-caption-retrieval.test.ts` benutzt — eine Schreibweise. */
const FIGURE = (caption: string): string =>
  `<figure><img src="/api/objects/x/raw" alt="Bild"><figcaption data-image-id="kw-img-1">${caption}</figcaption></figure>`;

/** Die Frage trifft NUR den Fließtext — nicht Titel, nicht Aussage, nicht die Fußnote. */
const FRAGE = "Wie wird die Spannrolle der Portalanlage nachgestellt?";
/** Die Markierung trifft NUR die Fußnote („Ölwannenschraube") — sonst nichts am Objekt. */
const PASSAGE = "Rechts unten sitzt die Ölwannenschraube, sie war zuletzt feucht.";

async function bestandMitFliesstextUndFussnote() {
  const services = buildServices();
  // G27 R1: `buildApp` verdrahtet nur; suchbereit wird die Instanz im `onReady`-Hook. Ohne ihn
  // bleibt die Standardsuche fail-closed. Dieselbe Reihenfolge wie im echten Start.
  await buildApp(services).ready();
  const ko = await services.ko.create({
    title: "Betriebsanleitung Baugruppe 7",
    statement: "Dieses Dokument fasst die laufenden Arbeiten am Gerät zusammen.",
    type: "best_practice",
    category: "Wartung",
    author: "anna",
    bodyHtml: `<p>Die Spannrolle der Portalanlage wird halbjährlich nachgestellt.</p>${FIGURE("Ansicht der Ölwannenschraube von unten")}`,
  });
  return { services, ko };
}

describe("KA5 · die Markierung verschiebt keine Fundstelle", () => {
  it("KA5-R10 · KALIBRIERUNG: ohne Markierung trägt der Fließtext — und das Etikett bleibt leer", async () => {
    // Ohne diesen Fall wäre der eigentliche Wächter unten auch dann grün, wenn die Frage das Objekt
    // gar nicht fände oder es ohnehin als Fußnoten-Fund gälte.
    const { services, ko } = await bestandMitFliesstextUndFussnote();
    const { result } = await services.ask.ask(FRAGE, "pedi");
    expect(result.answered).toBe(true);
    expect(result.sources).toEqual([ko.id]);
    expect(result.captionSources).toEqual([]);
  });

  it("KA5-R11 · BENS GEGENFALL: die Markierung trifft die Fußnote — das Etikett bleibt trotzdem leer", async () => {
    const { services, ko } = await bestandMitFliesstextUndFussnote();
    const ohne = await services.ask.ask(FRAGE, "pedi");
    const mit = await services.ask.ask(FRAGE, "pedi", "de", { selection: PASSAGE });

    // Die Quelle wechselt nicht — es gibt nur dieses eine Objekt, und die Frage hat es schon.
    expect(mit.result.sources).toEqual([ko.id]);
    expect(mit.result.answer).toBe(ohne.result.answer);
    expect(mit.result.answered).toBe(ohne.result.answered);

    // DER KERN: „Bildbeschreibung" wird NICHT behauptet. Die Frage hat den Fließtext getroffen;
    // dass die Markierung zufällig ein Wort der Fußnote trägt, ändert daran nichts.
    expect(mit.result.captionSources).toEqual([]);
    expect(mit.result.captionSources).toEqual(ohne.result.captionSources);
  });

  it("KA5-R12 · GEGENPROBE: der ECHTE Fußnoten-Fund wird weiterhin gekennzeichnet", async () => {
    // Ohne diesen Fall könnte man `captionSources` schlicht immer leer lassen und beide Fälle oben
    // wären grün. Hier trifft die FRAGE selbst nur die Fußnote — dann ist das Etikett die Wahrheit.
    const services = buildServices();
    await buildApp(services).ready();
    const ko = await services.ko.create({
      title: "Betriebsanleitung Baugruppe 9",
      statement: "Dieses Dokument fasst die laufenden Arbeiten am Gerät zusammen.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: FIGURE("Die Spannrolle der Portalanlage halbjährlich nachstellen"),
    });
    const { result } = await services.ask.ask(FRAGE, "pedi", "de", { selection: PASSAGE });
    expect(result.sources).toEqual([ko.id]);
    expect(result.captionSources).toEqual([ko.id]);
  });
});
