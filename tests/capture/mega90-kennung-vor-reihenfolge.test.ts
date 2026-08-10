// @vitest-environment jsdom
// AUFTRAG-mega90 Block A — DIE KENNUNG SCHLÄGT DIE REIHENFOLGE, UND KEINE KENNUNG WIRD ÜBERSCHRIEBEN.
//
// DER BEFUND (ben in sammel89, vom Kopf am Quelltext des Diffs nachgemessen). Beim Flachmachen einer
// eingehenden figure wurden die direkten Fußnoten eingesammelt und den Bildern rein POSITIONELL
// zugeteilt. Vorhandene `data-image-id`-Paare zählten für die Zuordnung NICHT — und danach schrieb
// `fussnote.setAttribute("data-image-id", id)` die vorhandene, richtige Kennung der Fußnote auf die
// des falsch zugeteilten Bildes um.
//
// Aus `img[A] img[B] figcaption[B] figcaption[A]` wurde damit `A="Text B"` und `B="Text A"`, und die
// Kennungen behaupteten anschließend, das sei so richtig. DAS IST SCHLIMMER ALS EINE FEHLPAARUNG:
// der Fehler löscht seine eigene Spur. Ein späterer Blick auf den gespeicherten Bestand kann nicht
// mehr unterscheiden, ob die Zuordnung von Anfang an so gemeint war.
//
// GEMESSEN WIRD DESHALB BEIDES: dass die Zuordnung stimmt UND dass die ursprünglichen Kennungen
// unangetastet danebenstehen. Die erste Hälfte allein wäre schon in mega89 grün gewesen, wenn man
// nur „hat jedes Bild eine Fußnote" gefragt hätte.
//
// GRENZE, benannt statt verschwiegen: hier steht STRUKTURlogik in jsdom. Die Aussage über den echten
// Browser (laden, getrennt beschreiben, speichern, wieder öffnen) steht in
// `tests-smoke/mega89-mehrbild-browser.spec.ts` — die Lehre aus mega87 gilt weiter.
import { describe, expect, it } from "vitest";
import { type EditableElement, ensureImageAnchors } from "../../apps/web/src/lib/editorFigures";

interface ElementLike extends EditableElement {
  innerHTML: string;
  querySelectorAll(selectors: string): Iterable<ElementLike>;
}
interface DocumentLike {
  createElement(tag: string): ElementLike;
}
const doc = (globalThis as unknown as { document: DocumentLike }).document;

function wurzelMit(html: string): ElementLike {
  const el = doc.createElement("div");
  el.innerHTML = html;
  return el;
}

/** Je Bild: seine Kennung, die Kennung SEINER Fußnote und deren Text. */
interface Paar {
  src: string | null;
  id: string | null;
  fussnote: string;
  fussnoteId: string | null;
}

function paare(root: ElementLike): Paar[] {
  const aus: Paar[] = [];
  for (const figure of root.querySelectorAll("figure")) {
    const img = figure.querySelector(":scope > img");
    if (img === null) {
      continue;
    }
    const cap = figure.querySelector(":scope > figcaption");
    aus.push({
      src: img.getAttribute("src"),
      id: img.getAttribute("data-image-id"),
      fussnote: (cap?.textContent ?? "").trim(),
      fussnoteId: cap?.getAttribute("data-image-id") ?? null,
    });
  }
  return aus;
}

/** Fußnoten, die in KEINER figure mit Bild stehen — der sichtbar erhaltene Rest aus Stufe 3. */
function verwaisteFussnoten(root: ElementLike): { id: string | null; text: string }[] {
  const inPaaren = new Set<ElementLike>();
  for (const figure of root.querySelectorAll("figure")) {
    if (figure.querySelector(":scope > img") === null) {
      continue;
    }
    const cap = figure.querySelector(":scope > figcaption");
    if (cap !== null) {
      inPaaren.add(cap as ElementLike);
    }
  }
  const aus: { id: string | null; text: string }[] = [];
  for (const cap of root.querySelectorAll("figcaption")) {
    if (!inPaaren.has(cap)) {
      aus.push({ id: cap.getAttribute("data-image-id"), text: (cap.textContent ?? "").trim() });
    }
  }
  return aus;
}

const A = "/api/objects/bild-a/raw";
const B = "/api/objects/bild-b/raw";

// DER FALL AUS sammel89, wörtlich: zwei bereits gekennzeichnete Bilder, ihre Fußnoten in
// GEGENLÄUFIGER Reihenfolge. Rein positionell zugeteilt bekommt A den Text von B.
const GEGENLAEUFIG = [
  "<figure>",
  `<img src="${A}" data-image-id="kw-img-alt-1">`,
  `<img src="${B}" data-image-id="kw-img-alt-2">`,
  '<figcaption data-image-id="kw-img-alt-2">Text B</figcaption>',
  '<figcaption data-image-id="kw-img-alt-1">Text A</figcaption>',
  "</figure>",
].join("");

// Gemischt: ein Bild mit markierter Fußnote, ein zweites ohne jede Kennung.
const GEMISCHT = [
  "<figure>",
  `<img src="${A}" data-image-id="kw-img-alt-1">`,
  `<img src="${B}">`,
  '<figcaption data-image-id="kw-img-alt-1">Text A</figcaption>',
  "<figcaption>Text B</figcaption>",
  "</figure>",
].join("");

// Eine Fußnote, deren Kennung zu KEINEM Bild dieser Einheit gehört.
const FREMDE_KENNUNG = [
  "<figure>",
  `<img src="${A}" data-image-id="kw-img-alt-1">`,
  `<img src="${B}" data-image-id="kw-img-alt-2">`,
  '<figcaption data-image-id="kw-img-alt-1">Text A</figcaption>',
  '<figcaption data-image-id="kw-img-fremd-7">Aus einem anderen Beitrag</figcaption>',
  "</figure>",
].join("");

describe("AUFTRAG-mega90 Block A: Stufe 1 — gleiche Kennung schlägt die Dokumentreihenfolge", () => {
  it("A behält Text A und B behält Text B, obwohl die Fußnoten vertauscht stehen", () => {
    const root = wurzelMit(GEGENLAEUFIG);
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(
      gefunden.map((p) => p.src),
      "Die Reihenfolge der Bilder ist verloren",
    ).toEqual([A, B]);
    expect(
      gefunden.map((p) => p.fussnote),
      "Die Fußnoten wurden rein nach ihrer Stellung zugeteilt — Bild A hat den Text von Bild B bekommen",
    ).toEqual(["Text A", "Text B"]);
  });

  it("KEINE Kennung wird überschrieben — der Fehler darf seine Spur nicht löschen können", () => {
    const root = wurzelMit(GEGENLAEUFIG);
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(
      gefunden.map((p) => p.id),
      "Die Bildkennungen wurden neu vergeben — jede offene Bitte der Galerie zeigte danach ins Leere",
    ).toEqual(["kw-img-alt-1", "kw-img-alt-2"]);
    // UND HIER LIEGT DER EIGENTLICHE PIN, weil die Liste der Fußnoten-Kennungen ALLEIN blind ist:
    // teilt man die Fußnoten positionell zu und schreibt ihnen anschließend die Kennung des
    // zugeteilten Bildes, kommt exakt dieselbe Liste heraus — der Fehler hat seine eigene Spur
    // gelöscht. Gemessen wird deshalb, welcher TEXT welche Kennung trägt.
    expect(
      gefunden.map((p) => `${p.fussnoteId}=${p.fussnote}`),
      "Die vorhandene Kennung einer Fußnote wurde auf die des zugeteilten Bildes umgeschrieben. Genau daran ist die falsche Zuordnung anschließend nicht mehr erkennbar.",
    ).toEqual(["kw-img-alt-1=Text A", "kw-img-alt-2=Text B"]);
  });

  it("FIXPUNKT: ein zweiter Lauf ändert daran nichts mehr", () => {
    const root = wurzelMit(GEGENLAEUFIG);
    ensureImageAnchors(root);
    const einmal = root.innerHTML;
    const nochmal = ensureImageAnchors(root);
    expect(root.innerHTML, "Der zweite Lauf hat die Zuordnung erneut angefasst").toBe(einmal);
    expect(nochmal, "Der zweite Lauf meldet Wirkung, obwohl es nichts zu tun gab").toBe(0);
  });
});

describe("AUFTRAG-mega90 Block A: Stufe 2 — unmarkierte Fußnoten der Reihe nach", () => {
  it("gemischt: das markierte Paar findet sich, das unmarkierte geht an das übrige Bild", () => {
    const root = wurzelMit(GEMISCHT);
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(gefunden.map((p) => p.src)).toEqual([A, B]);
    expect(
      gefunden.map((p) => p.fussnote),
      "Die Zuordnung im gemischten Fall stimmt nicht",
    ).toEqual(["Text A", "Text B"]);
    expect(gefunden[0]?.id, "Die vorhandene Kennung von Bild A ging verloren").toBe("kw-img-alt-1");
    expect(gefunden[0]?.fussnoteId).toBe("kw-img-alt-1");
    // Das zweite Bild hatte gar keine Kennung: es bekommt eine neue, und seine unmarkierte Fußnote
    // bekommt genau diese — hier IST das Schreiben richtig, denn es überschreibt nichts.
    expect(gefunden[1]?.id ?? "").toMatch(/^kw-img-[a-z0-9]+-\d+$/);
    expect(gefunden[1]?.fussnoteId).toBe(gefunden[1]?.id);
  });
});

describe("AUFTRAG-mega90 Block A: Stufe 3 — was nicht passt, wird nicht geraten", () => {
  it("eine fremd gekennzeichnete Fußnote wird keinem Bild untergeschoben und bleibt sichtbar", () => {
    const root = wurzelMit(FREMDE_KENNUNG);
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(
      gefunden.map((p) => p.fussnote),
      "Der fremde Text ist an ein Bild gewandert",
    ).toEqual(["Text A", ""]);
    expect(
      verwaisteFussnoten(root),
      "Der Text der fremd gekennzeichneten Fußnote ist verschwunden oder hat seine Kennung verloren",
    ).toEqual([{ id: "kw-img-fremd-7", text: "Aus einem anderen Beitrag" }]);
  });

  it("EIN Bild ohne Kennung übernimmt die der einen übrigen Fußnote (Stufe 2b, Stabilität)", () => {
    // Die figure ist nicht flach (sie enthält eine zweite figure) und trägt genau EIN eigenes Bild.
    const root = wurzelMit(
      [
        "<figure>",
        `<img src="${A}">`,
        '<figcaption data-image-id="kw-img-alt-9">Text A</figcaption>',
        `<figure><img src="${B}" data-image-id="kw-img-alt-2">`,
        '<figcaption data-image-id="kw-img-alt-2">Text B</figcaption></figure>',
        "</figure>",
      ].join(""),
    );
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(gefunden.map((p) => p.fussnote)).toEqual(["Text A", "Text B"]);
    expect(
      gefunden[0]?.id,
      "Das Bild hat eine NEUE Kennung bekommen, statt die seiner eindeutigen Fußnote zu übernehmen — die Beschreibung stünde verwaist daneben",
    ).toBe("kw-img-alt-9");
    expect(gefunden[0]?.fussnoteId, "Die Kennung der Fußnote wurde überschrieben").toBe(
      "kw-img-alt-9",
    );
  });

  it("zwei ABWEICHENDE Kennungen werden NICHT gegeneinander verrechnet", () => {
    // Bild und Fußnote tragen je eine eigene, verschiedene Wahrheit. Jede Paarung müsste eine davon
    // überschreiben — also wird nicht gepaart. Sichtbar danebenstehender Text ist reparierbar, eine
    // überschriebene Kennung ist es nicht.
    const root = wurzelMit(
      [
        "<figure>",
        `<img src="${A}" data-image-id="kw-img-alt-1">`,
        '<figcaption data-image-id="kw-img-alt-9">Text A</figcaption>',
        `<figure><img src="${B}" data-image-id="kw-img-alt-2">`,
        '<figcaption data-image-id="kw-img-alt-2">Text B</figcaption></figure>',
        "</figure>",
      ].join(""),
    );
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(gefunden[0]?.id, "Die Kennung des Bildes wurde überschrieben").toBe("kw-img-alt-1");
    expect(gefunden[0]?.fussnote).toBe("");
    expect(
      verwaisteFussnoten(root),
      "Der Text der abweichend gekennzeichneten Fußnote ist verschwunden — oder ihre Kennung wurde umgeschrieben",
    ).toEqual([{ id: "kw-img-alt-9", text: "Text A" }]);
  });
});
