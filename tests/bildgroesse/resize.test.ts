// ================================================================================================
// R-0014 · BILDGRÖSSE FREI AN GRIFFEN ZIEHEN — die Wertregel und ihre zwei Sanitizer.
// ================================================================================================
//
// Was hier belegt wird: die Rechnung Zeigerweg → Prozentbreite (Richtung, Grenzen, unbrauchbare
// Messungen) und dass Client- (apps/web) und Server-Sanitizer (services/structure) für die gezogene
// Breite DIESELBE Entscheidung treffen — einschließlich der Gegenproben, die nie aktiv werden dürfen.
// Was hier NICHT belegt wird: dass ein Browser die Breite so darstellt und dass sie Speichern und
// Wiederöffnen übersteht. Das misst `griff-speichern-wiederoeffnen-pg.integration.test.ts`.
import { describe, expect, it } from "vitest";
import {
  IMAGE_WIDTH_MAX_PERCENT,
  IMAGE_WIDTH_MIN_PERCENT,
  breiteAusZug,
  formatImageWidth,
  imageWidthPercent,
  normalizeImageWidth,
} from "../../apps/web/src/lib/imageResize";
import { sanitizeHtml as sanitizeClient } from "../../apps/web/src/lib/richText";
import { sanitizeHtml as sanitizeServer } from "../../services/structure/src/sanitize";

const SRC = "/api/objects/pumpe-1/raw";

describe("R-0014 · Rechnung Zeigerweg → Breite", () => {
  const start = { startBreitePx: 400, spaltenBreitePx: 800 };

  it("rechte Griffe wachsen nach rechts, linke nach links — stufenlos, nicht auf 25/50/75/100", () => {
    expect(breiteAusZug({ ...start, kante: "rechts" }, 100)).toBeCloseTo(62.5, 10);
    expect(breiteAusZug({ ...start, kante: "rechts" }, -100)).toBeCloseTo(37.5, 10);
    expect(breiteAusZug({ ...start, kante: "links" }, -100)).toBeCloseTo(62.5, 10);
    expect(breiteAusZug({ ...start, kante: "links" }, 100)).toBeCloseTo(37.5, 10);
    // Ein einzelner Pixel ändert die Breite — kein Einrasten.
    const a = breiteAusZug({ ...start, kante: "rechts" }, 36) as number;
    const b = breiteAusZug({ ...start, kante: "rechts" }, 37) as number;
    expect(b - a).toBeCloseTo(100 / 800, 10);
    expect(formatImageWidth(a)).toBe("54.5%");
    expect(formatImageWidth(b)).toBe("54.6%");
  });

  it("endliche Grenzen: nie unter 10 %, nie über 100 %", () => {
    expect(breiteAusZug({ ...start, kante: "rechts" }, 100_000)).toBe(IMAGE_WIDTH_MAX_PERCENT);
    expect(breiteAusZug({ ...start, kante: "rechts" }, -100_000)).toBe(IMAGE_WIDTH_MIN_PERCENT);
    expect(breiteAusZug({ ...start, kante: "links" }, 100_000)).toBe(IMAGE_WIDTH_MIN_PERCENT);
  });

  it("unbrauchbare Messung → keine Breite (das Bild bleibt, wie es ist)", () => {
    const ohneSpalte = { startBreitePx: 400, spaltenBreitePx: 0, kante: "rechts" } as const;
    const ohneBild = { startBreitePx: Number.NaN, spaltenBreitePx: 800, kante: "rechts" } as const;
    expect(breiteAusZug(ohneSpalte, 10)).toBe(null);
    expect(breiteAusZug(ohneBild, 10)).toBe(null);
    expect(breiteAusZug({ ...start, kante: "rechts" }, Number.POSITIVE_INFINITY)).toBe(null);
    expect(formatImageWidth(Number.NaN)).toBe(null);
    expect(formatImageWidth(Number.NEGATIVE_INFINITY)).toBe(null);
  });

  it("Attributform: eine Nachkommastelle, kanonisch, Fixpunkt", () => {
    expect(formatImageWidth(37.04)).toBe("37%");
    expect(formatImageWidth(37.06)).toBe("37.1%");
    expect(formatImageWidth(3)).toBe("10%");
    expect(formatImageWidth(250)).toBe("100%");
    expect(normalizeImageWidth("37.0%")).toBe("37%");
    expect(normalizeImageWidth(normalizeImageWidth("37.0%"))).toBe("37%");
    expect(imageWidthPercent("62.5%")).toBe(62.5);
    expect(imageWidthPercent("62.5")).toBe(null);
  });
});

describe("R-0014 · Client- und Server-Sanitizer entscheiden gleich", () => {
  const bild = (attrs: string): string => `<img src="${SRC}"${attrs}>`;

  const GUELTIG: Array<[string, string]> = [
    ['width="10%"', 'width="10%"'],
    ['width="42%"', 'width="42%"'],
    ['width="62.5%"', 'width="62.5%"'],
    ['width="99.9%"', 'width="99.9%"'],
    ['width="100%"', 'width="100%"'],
    ['width="100.0%"', 'width="100%"'],
    ["width=' 37.0% '", 'width="37%"'],
  ];
  const UNGUELTIG = [
    "",
    "600",
    "0%",
    "9.9%",
    "100.1%",
    "1000%",
    "-50%",
    "+50%",
    "50.25%",
    ".5%",
    "50.%",
    "NaN%",
    "Infinity%",
    "1e1%",
    "50px",
    "50 %",
    "50%;",
    "calc(50%)",
    "expression(alert(1))",
    "javascript:alert(1)",
  ];

  it("gültige Breiten bleiben — kanonisch und auf beiden Seiten gleich", () => {
    for (const [ein, aus] of GUELTIG) {
      const soll = `<img src="${SRC}" ${aus}>`;
      expect(sanitizeClient(bild(` ${ein}`)), ein).toBe(soll);
      expect(sanitizeServer(bild(` ${ein}`)), ein).toBe(soll);
    }
  });

  it("ungültige, nicht-endliche und außerhalb liegende Breiten werden nie aktiv", () => {
    for (const wert of UNGUELTIG) {
      const ein = bild(` width="${wert}"`);
      expect(sanitizeClient(ein), wert).toBe(`<img src="${SRC}">`);
      expect(sanitizeServer(ein), wert).toBe(`<img src="${SRC}">`);
    }
  });

  it("der Stufenvertrag bleibt eng: data-kw-scale=42 fällt weiter, die vier Stufen bleiben", () => {
    for (const s of ["25", "50", "75", "100"]) {
      const soll = `<img src="${SRC}" data-kw-scale="${s}">`;
      expect(sanitizeClient(soll)).toBe(soll);
      expect(sanitizeServer(soll)).toBe(soll);
    }
    for (const s of ["42", "62.5", "62.5%", "0", "101"]) {
      expect(sanitizeClient(bild(` data-kw-scale="${s}"`)), s).toBe(`<img src="${SRC}">`);
      expect(sanitizeServer(bild(` data-kw-scale="${s}"`)), s).toBe(`<img src="${SRC}">`);
    }
  });

  it("keine Nebenfreigabe: style, Handler, Ausbruch aus dem Attribut, fremde Quellen, andere Tags", () => {
    const faelle: Array<[string, string]> = [
      [
        bild(' width="50%" style="width:900px" onerror="alert(1)" onload="x"'),
        `<img src="${SRC}" width="50%">`,
      ],
      [bild(` width='50%" onerror="alert(1)'`), `<img src="${SRC}">`],
      ['<img src="javascript:alert(1)" width="50%">', ""],
      ['<img src="https://evil.example/x.png" width="50%">', ""],
      ['<img src="data:image/svg+xml;base64,PHN2Zz4=" width="50%">', ""],
      ['<p width="50%" style="x">a</p>', "<p>a</p>"],
      ['<figcaption width="50%" data-image-id="a1">t</figcaption>', ""],
    ];
    for (const [ein, aus] of faelle) {
      const client = sanitizeClient(ein);
      const server = sanitizeServer(ein);
      if (aus !== "") {
        expect(client, ein).toBe(aus);
        expect(server, ein).toBe(aus);
      }
      for (const ausgabe of [client, server]) {
        expect(ausgabe, ein).not.toMatch(/style=|onerror|onload|javascript:|svg|evil/i);
        expect(ausgabe, ein).not.toMatch(/<(?!img)[a-z]+[^>]*\swidth=/i);
      }
    }
  });

  it("Hülle mit gezogener Breite: Anker, Quelle und Fußnote bleiben, beide Seiten Fixpunkt", () => {
    const huelle =
      `<figure data-image-id="a1"><img data-image-id="a1" src="${SRC}" width="62.5%"><figcaption data-image-id="a1">Ventil <strong>A</strong></figcaption></figure>` +
      `<figure data-image-id="b2"><img data-image-id="b2" src="${SRC}" data-kw-scale="50"><figcaption data-image-id="b2">Ventil <strong>A</strong></figcaption></figure>`;
    expect(sanitizeServer(huelle)).toBe(huelle);
    expect(sanitizeClient(huelle)).toBe(huelle);
    expect(sanitizeServer(sanitizeClient(huelle))).toBe(huelle);
  });
});
