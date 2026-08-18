// @vitest-environment jsdom
// ==================================================================================================
// JOB 916 · D6 — DIE ABLÖSUNG VON STUFE 2b UND DER EINZELBILD-AUSNAHME
// ==================================================================================================
//
// Auftragstext ist das rote Vollurteil `BEN5-PRUEFUNG-JOB-916-D5.md` (SHA-256 `2f855ec6…`).
//
// WORUM ES GEHT. Zwei Stellen paarten ein Bild mit einer Fußnote, die eine FREMDE Kennung trug:
//
//   · `editorFigures.ts`, Stufe 2b — genau ein Bild ohne eigene Kennung, genau eine übrige
//     Fußnote → das Bild übernahm deren Kennung.
//   · `bodyImages.ts`, `|| bilder.length === 1` — in einer figure mit genau einem Bild bekam es
//     die verbleibende Fußnote auch bei abweichender Kennung.
//
// DER TRAGENDE GRUND, und er kommt aus der Kontrollfolge selbst, nicht aus dem Bauchgefühl: eine
// nach Stufe 2 ÜBRIGE Fußnote kann keine unmarkierte mehr sein — Stufe 2 nimmt genau die. Was
// Stufe 2b erreichte, trug also ZWANGSLÄUFIG eine fremde Kennung. „Stabilität" hieß an dieser
// Stelle: das Bild erbt eine Herkunft, die niemand belegt hat.
//
// Damit gilt für beide Stellen dieselbe Regel, die das Projekt an jeder anderen Stelle längst
// befolgt (`gemeinsameKennung`, `offenerAnker`, mega90 Stufe 3): zwei verschiedene, nicht leere
// Kennungen werden NICHT gegeneinander verrechnet. Sichtbar danebenstehender Text ist reparierbar,
// eine überschriebene Kennung ist es nicht.
//
// ------------------------------------------------------------------------------------------------
// DIE REICHWEITE — ausdrücklich und als EINZIGER Vertrag, nicht als stillschweigende Ausnahme
// ------------------------------------------------------------------------------------------------
// Prüflücke 2 des Urteils verlangt, P1 „präzise auf getrennte Paarung versus gemeinsame `<figure>`
// zu begrenzen … erwartet ist ein einziger kanonischer Vertrag". Der Vertrag lautet:
//
//   Die Zusage „eine fremd gekennzeichnete Fußnote wird keinem Bild untergeschoben" gilt für die
//   PAARUNG mehrerer getrennter Einheiten. Sie gilt NICHT innerhalb EINER flachen `<figure>` —
//   dort ist die figure selbst die Bindungseinheit, und das sagt nicht dieser Test, sondern der
//   Sanitizer: `anchorFigures` (`services/structure`) macht die Kennung der figure führend und
//   gleicht `img` und `figcaption` beim Speichern an. `sanitize.test.ts` pinnt das wörtlich.
//
// Das ist keine Einschränkung, die hier erfunden wird, sondern die Abgrenzung gegen einen
// bestehenden, stärkeren Vertrag. Der Fall `GRENZE` unten hält sie ausführbar fest — beide
// Richtungen, damit niemand die eine für die andere hält.
import { describe, expect, it } from "vitest";
import { extractBodyImages } from "../../apps/web/src/lib/bodyImages";
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

interface Paar {
  id: string | null;
  fussnote: string;
  fussnoteId: string | null;
}

/** Je figure mit direktem Bild: dessen Kennung, der Text SEINER Fußnote und deren Kennung. */
function paare(root: ElementLike): Paar[] {
  const aus: Paar[] = [];
  for (const figure of root.querySelectorAll("figure")) {
    const img = figure.querySelector(":scope > img");
    if (img === null) {
      continue;
    }
    const cap = figure.querySelector(":scope > figcaption");
    aus.push({
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

// Die Einheit ist NICHT flach (sie enthält eine zweite figure) und trägt genau EIN eigenes Bild —
// nur so ist Stufe 2b überhaupt erreichbar. Das Bild hat keine Kennung, die übrige Fußnote eine
// FREMDE. Genau hier paarte Stufe 2b.
const EIN_BILD_FREMDE_FUSSNOTE = [
  "<figure>",
  `<img src="${A}">`,
  '<figcaption data-image-id="kw-img-fremd-9">Gehört woanders hin</figcaption>',
  `<figure><img src="${B}" data-image-id="kw-img-alt-2">`,
  '<figcaption data-image-id="kw-img-alt-2">Text B</figcaption></figure>',
  "</figure>",
].join("");

// ==================================================================================================

describe("JOB 916 · P1 — eine fremd gekennzeichnete Fußnote wird KEINEM Bild untergeschoben", () => {
  it("das Bild bekommt eine NEUE eigene Kennung statt der fremden", () => {
    const root = wurzelMit(EIN_BILD_FREMDE_FUSSNOTE);
    ensureImageAnchors(root);
    const gefunden = paare(root);

    // Vor der Ablösung stand hier `kw-img-fremd-9`: das Bild erbte eine Herkunft, die niemand
    // belegt hat. Jetzt entsteht eine eigene Kennung nach dem üblichen Muster.
    expect(gefunden[0]?.id ?? "").toMatch(/^kw-img-[a-z0-9]+-\d+$/);
    expect(gefunden[0]?.id).not.toBe("kw-img-fremd-9");
    // Und das Bild steht ohne Beschreibung da — ehrlich, statt mit einer geliehenen.
    expect(gefunden[0]?.fussnote).toBe("");
  });

  it("der fremde Text bleibt sichtbar und behält SEINE Kennung (Stufe 3)", () => {
    const root = wurzelMit(EIN_BILD_FREMDE_FUSSNOTE);
    ensureImageAnchors(root);

    // Die zweite Hälfte der Zusage, und ohne sie wäre die erste wertlos: der Text darf nicht
    // verschwinden, nur weil er niemandem zugeordnet werden konnte.
    expect(verwaisteFussnoten(root)).toEqual([
      { id: "kw-img-fremd-9", text: "Gehört woanders hin" },
    ]);
  });

  it("die verschachtelte Schwester bleibt davon unberührt", () => {
    const root = wurzelMit(EIN_BILD_FREMDE_FUSSNOTE);
    ensureImageAnchors(root);
    const gefunden = paare(root);

    // Kalibrierung gegen einen zu breiten Eingriff: das korrekt gekennzeichnete Paar daneben muss
    // exakt so bleiben, wie es war. Würde die Ablösung pauschal jede Paarung verhindern, wäre
    // dieser Fall rot — und der Fall darüber grün, ohne etwas zu beweisen.
    expect(gefunden.map((p) => `${p.id}=${p.fussnote}`)).toContain("kw-img-alt-2=Text B");
  });
});

describe("JOB 916 · S — die ZULÄSSIGEN Altformen bleiben erhalten", () => {
  it("S1: unmarkierte Fußnote und unmarkiertes Bild finden weiterhin zueinander (Stufe 2)", () => {
    const root = wurzelMit(
      [
        "<figure>",
        `<img src="${A}">`,
        "<figcaption>Text A</figcaption>",
        `<figure><img src="${B}" data-image-id="kw-img-alt-2">`,
        '<figcaption data-image-id="kw-img-alt-2">Text B</figcaption></figure>',
        "</figure>",
      ].join(""),
    );
    ensureImageAnchors(root);
    const gefunden = paare(root);

    // Hier überschreibt das Paaren NICHTS: die Fußnote hatte keine Kennung. Genau das ist der
    // Unterschied zu Stufe 2b — und genau das muss die Ablösung stehen lassen.
    expect(gefunden[0]?.fussnote).toBe("Text A");
    expect(gefunden[0]?.fussnoteId).toBe(gefunden[0]?.id);
  });

  it("S2: zwei Bilder, eine unmarkierte Fußnote → sie gehört dem ersten", () => {
    const root = wurzelMit(
      [
        "<figure>",
        `<img src="${A}">`,
        `<img src="${B}">`,
        "<figcaption>Text A</figcaption>",
        "</figure>",
      ].join(""),
    );
    ensureImageAnchors(root);
    const gefunden = paare(root);
    expect(gefunden.map((p) => p.fussnote)).toEqual(["Text A", ""]);
  });

  it("S3: gleiche Kennung auf beiden Seiten schlägt weiterhin die Reihenfolge (Stufe 1)", () => {
    const root = wurzelMit(
      [
        "<figure>",
        `<img src="${A}" data-image-id="kw-img-alt-1">`,
        `<img src="${B}" data-image-id="kw-img-alt-2">`,
        '<figcaption data-image-id="kw-img-alt-2">Text B</figcaption>',
        '<figcaption data-image-id="kw-img-alt-1">Text A</figcaption>',
        "</figure>",
      ].join(""),
    );
    ensureImageAnchors(root);
    expect(paare(root).map((p) => `${p.id}=${p.fussnote}`)).toEqual([
      "kw-img-alt-1=Text A",
      "kw-img-alt-2=Text B",
    ]);
  });

  it("S3b: Bild MIT Kennung und abweichende Fußnote wurden schon vorher nicht verrechnet", () => {
    // Dieser Fall war IMMER so — Stufe 2b griff nur bei einem Bild OHNE eigene Kennung. Er steht
    // hier als Beleg, dass die Ablösung die Regel nicht neu erfindet, sondern die Ausnahme
    // beseitigt, die ihr widersprach.
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
    expect(gefunden[0]?.id).toBe("kw-img-alt-1");
    expect(gefunden[0]?.fussnote).toBe("");
    expect(verwaisteFussnoten(root)).toEqual([{ id: "kw-img-alt-9", text: "Text A" }]);
  });
});

describe("JOB 916 · GRENZE — der kanonische Vertrag, beide Richtungen", () => {
  it("in DERSELBEN flachen figure bleibt die Kennung vereinheitlicht — kein P1-Fall", () => {
    // DIE ABGRENZUNG, ausdrücklich statt stillschweigend. Eine flache figure läuft gar nicht durch
    // `flacheFigurenHtml`/`paare()`; sie kommt erst in der Nachnormalisierung an, und dort gilt der
    // Sanitizer-Vertrag: innerhalb einer figure IST die figure die Bindungseinheit.
    //
    // Wer P1 hierher ausdehnen will, ändert damit `anchorFigures` und `sanitize.test.ts` mit —
    // gemessen sind das 20 fremde Fälle in 6 Dateien (Formularbindung mega9 F/PRO 337,
    // Strukturinvariante mega88, Kennungskonflikte huelle3/huelle4). Das ist eine
    // Owner-Entscheidung über den Sanitizer, keine Nebenwirkung dieser Ablösung.
    const root = wurzelMit(
      `<figure><img src="${A}"><figcaption data-image-id="kw-img-fremd-9">Text</figcaption></figure>`,
    );
    ensureImageAnchors(root);
    const gefunden = paare(root);

    expect(gefunden[0]?.id).toBe("kw-img-fremd-9");
    expect(gefunden[0]?.fussnote).toBe("Text");
  });

  it("dieselbe Konstellation GETRENNT gepaart fällt dagegen unter P1", () => {
    // Beide Richtungen nebeneinander — ohne diesen Gegenfall wäre oben nicht erkennbar, ob die
    // Grenze eine Regel ist oder bloß der Zustand, den der Code zufällig hat.
    const root = wurzelMit(EIN_BILD_FREMDE_FUSSNOTE);
    ensureImageAnchors(root);
    expect(paare(root)[0]?.id).not.toBe("kw-img-fremd-9");
  });
});

describe("JOB 916 · G — die Galerie zieht dieselbe Grenze", () => {
  it("G1: EIN Bild, Fußnote mit abweichender Kennung → keine Beschreibung", () => {
    // Der Zwilling zu P1 im Galerie-Zerleger. Vor der Ablösung gewann hier `bilder.length === 1`
    // und schrieb dem Bild einen Text zu, dessen Kennung auf ein anderes zeigte.
    const html = `<figure><img src="${A}" data-image-id="kw-img-alt-1"><figcaption data-image-id="kw-img-fremd-9">Gehört woanders hin</figcaption></figure>`;
    expect(extractBodyImages(html)).toEqual([{ id: "kw-img-alt-1", src: A, caption: "" }]);
  });

  it("G2 KALIBRIERUNG: eine Fußnote OHNE Kennung wird weiterhin gepaart", () => {
    // Diese Zeile MUSS grün sein und grün bleiben. Ohne sie wäre G1 auch dann grün, wenn die
    // Ablösung die Zuordnung pauschal abgeschaltet hätte — und der zulässige Altbestand aus der
    // Zeit vor WP-BILD-1b verlöre seine Beschreibung.
    const html = `<figure><img src="${A}" data-image-id="kw-img-alt-1"><figcaption>Riefen in Laufrichtung</figcaption></figure>`;
    expect(extractBodyImages(html)).toEqual([
      { id: "kw-img-alt-1", src: A, caption: "Riefen in Laufrichtung" },
    ]);
  });

  it("G3: bei MEHREREN Bildern galt die Regel schon immer — die Ausnahme war die Einzelzahl", () => {
    const html = [
      `<figure><img src="${A}" data-image-id="kw-img-alt-1">`,
      `<img src="${B}" data-image-id="kw-img-alt-2">`,
      '<figcaption data-image-id="kw-img-fremd-9">Gehört woanders hin</figcaption></figure>',
    ].join("");
    expect(extractBodyImages(html)).toEqual([
      { id: "kw-img-alt-1", src: A, caption: "" },
      { id: "kw-img-alt-2", src: B, caption: "" },
    ]);
  });
});
