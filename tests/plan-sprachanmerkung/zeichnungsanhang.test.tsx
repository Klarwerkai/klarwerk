// @vitest-environment jsdom
// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · NACHARBEIT 2 · D4 — AUS DER HOCHGELADENEN DATEI WIRD
// EINE ZEICHNUNG (`apps/web/src/lib/zeichnungsanhang.ts`)
// ================================================================================================
//
// L1  welche Anhänge Zeichnungen sind: PDF, DXF, DWG, Rasterbild — nach Typ, sonst nach Endung
// L2  DXF: Linie, Polylinie, Kreis und Bogen werden gezeichnet, y nach oben wird gespiegelt; Text
//     der Datei kommt NICHT ins Bild, sondern zählt als ausgelassen
// L3  DXF ohne Zeichenbares: keine Zeichnung
// L4  die Stelle der Fläche besteht die Prüfung des Dienstes (derselbe Abdruck)
// L5  laden: DWG nennt seinen Grund ohne Abruf; Rasterbild über den Rohweg; DXF über den Rohweg;
//     ein gescheiterter Abruf ist „laden"
// L6  PDF: die verlangte Seite wird gezeichnet, begrenzt auf die vorhandenen Seiten
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdf = vi.hoisted(() => ({
  seiten: 3,
  gezeichnet: [] as number[],
  freigegeben: 0,
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => {
  const echt = await importOriginal<typeof import("../../apps/web/src/lib/files")>();
  return {
    ...echt,
    pdfEngine: async () => ({
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: pdf.seiten,
          getPage: async (n: number) => ({
            getViewport: (o: { scale: number }) => ({ width: 800 * o.scale, height: 600 }),
            render: () => {
              pdf.gezeichnet.push(n);
              return { promise: Promise.resolve() };
            },
          }),
          destroy: () => {
            pdf.freigegeben += 1;
          },
        }),
      }),
    }),
  };
});

import {
  ZeichnungNichtDarstellbar,
  anhangStelle,
  dxfAlsBild,
  ladeAnhangsZeichnung,
  zeichnungsArt,
} from "../../apps/web/src/lib/zeichnungsanhang";
import { stelleAmAnhang } from "../../services/knowledge-object/src/stellen-anker";

/** Eine DXF-Datei aus Gruppencode/Wert-Paaren. */
const dxf = (paare: [number, string | number][]): string =>
  paare.map(([c, w]) => `${c}\n${w}`).join("\n");

const ZEICHNUNG = dxf([
  [0, "SECTION"],
  [2, "ENTITIES"],
  [0, "LINE"],
  [10, 0],
  [20, 0],
  [11, 100],
  [21, 0],
  [0, "LWPOLYLINE"],
  [70, 1],
  [10, 0],
  [20, 0],
  [10, 100],
  [20, 0],
  [10, 100],
  [20, 100],
  [10, 0],
  [20, 100],
  [0, "CIRCLE"],
  [10, 50],
  [20, 50],
  [40, 10],
  [0, "ARC"],
  [10, 50],
  [20, 50],
  [40, 20],
  [50, 0],
  [51, 90],
  [0, "TEXT"],
  [1, "<script>alert(1)</script>"],
  [0, "ENDSEC"],
  [0, "EOF"],
]);

const svgAus = (src: string): string =>
  decodeURIComponent(src.replace("data:image/svg+xml;charset=utf-8,", ""));

const antwort = (ok: boolean, text: string): Response =>
  ({ ok, text: async () => text, arrayBuffer: async () => new ArrayBuffer(8) }) as Response;

let fetchVorher: typeof fetch;

beforeEach(() => {
  fetchVorher = globalThis.fetch;
  pdf.seiten = 3;
  pdf.gezeichnet = [];
  pdf.freigegeben = 0;
});

afterEach(() => {
  globalThis.fetch = fetchVorher;
  vi.restoreAllMocks();
});

describe("PLAN-SPRACHANMERKUNG · D4 — die hochgeladene Datei als Zeichnung", () => {
  it("L1 · PDF, DXF, DWG und Rasterbild sind Zeichnungen; anderes nicht", () => {
    expect(zeichnungsArt({ name: "plan", mime: "application/pdf" })).toBe("pdf");
    expect(zeichnungsArt({ name: "Plan.PDF", mime: "" })).toBe("pdf");
    expect(zeichnungsArt({ name: "flansch.dxf", mime: "application/octet-stream" })).toBe("dxf");
    expect(zeichnungsArt({ name: "flansch.dwg", mime: "" })).toBe("dwg");
    expect(zeichnungsArt({ name: "foto.png", mime: "image/png" })).toBe("bild");
    expect(zeichnungsArt({ name: "logo.svg", mime: "image/svg+xml" })).toBeNull();
    expect(zeichnungsArt({ name: "bericht.docx", mime: "application/msword" })).toBeNull();
  });

  it("L2 · DXF: Linie, Polylinie, Kreis und Bogen, gespiegelt; Text bleibt draussen", () => {
    const bild = dxfAlsBild(ZEICHNUNG);
    expect(bild).not.toBeNull();
    expect(bild?.elemente).toBe(4);
    expect(bild?.ausgelassen).toBe(1);
    const svg = svgAus(bild?.src ?? "");
    // Rand 2 % von 100 = 2; CAD-y 0 (unten) liegt im Bild bei 102 (unten), CAD-y 100 bei 2 (oben).
    expect(svg).toContain('viewBox="0 0 104 104"');
    expect(svg).toContain('<path d="M2 102 L102 102"/>');
    expect(svg).toContain('<path d="M2 102 L102 102 L102 2 L2 2 Z"/>');
    expect(svg).toContain('<circle cx="52" cy="52" r="10"/>');
    // Viertelbogen von 0° (rechts) nach 90° (oben), gegen den Uhrzeigersinn: sweep 0.
    expect(svg).toContain('<path d="M72 52 A20 20 0 0 0 52 32"/>');
    expect(svg).not.toContain("script");
    expect(svg).not.toContain("alert");
  });

  it("L3 · ohne Zeichenbares keine Zeichnung", () => {
    const nurText = dxf([
      [0, "SECTION"],
      [2, "ENTITIES"],
      [0, "TEXT"],
      [0, "ENDSEC"],
    ]);
    expect(dxfAlsBild(nurText)).toBeNull();
    expect(dxfAlsBild("kein DXF")).toBeNull();
    expect(dxfAlsBild("")).toBeNull();
  });

  it("L4 · die Stelle der Fläche besteht die Prüfung des Dienstes", () => {
    const stelle = anhangStelle("obj-plan-1", 4, 2, { x: 0.25, y: 0.75 });
    expect(stelle).toMatchObject({
      koVersion: 4,
      art: "anhang",
      abschnitt: "",
      text: "obj-plan-1",
      seite: 2,
      punkt: { x: 0.25, y: 0.75 },
    });
    expect(stelleAmAnhang([{ objectId: "obj-plan-1" }], stelle)).toBe(true);
    // GEGENPROBE: ein anderer Anhang, ein doppelter, keiner.
    expect(stelleAmAnhang([{ objectId: "obj-anderer" }], stelle)).toBe(false);
    const doppelt = [{ objectId: "obj-plan-1" }, { objectId: "obj-plan-1" }];
    expect(stelleAmAnhang(doppelt, stelle)).toBe(false);
    expect(stelleAmAnhang(undefined, stelle)).toBe(false);
  });

  it("L5 · DWG nennt seinen Grund ohne Abruf; Bild und DXF kommen über den Rohweg", async () => {
    const abruf = vi.fn(async (_href: string) => antwort(true, ZEICHNUNG));
    globalThis.fetch = abruf as unknown as typeof fetch;

    const dwgAnhang = { objectId: "obj-dwg", name: "flansch.dwg", mime: "" };
    const pngAnhang = { objectId: "obj-png", name: "plan.png", mime: "image/png" };
    const dxfAnhang = { objectId: "obj-dxf", name: "flansch.dxf", mime: "" };

    const dwg = await ladeAnhangsZeichnung(dwgAnhang, 1).catch((e: unknown) => e);
    expect(dwg).toBeInstanceOf(ZeichnungNichtDarstellbar);
    expect((dwg as ZeichnungNichtDarstellbar).grund).toBe("dwg");
    expect(abruf).not.toHaveBeenCalled();

    const bild = await ladeAnhangsZeichnung(pngAnhang, 1);
    expect(bild).toEqual({ src: "/api/objects/obj-png/raw", seiten: 1, seite: 1, ausgelassen: 0 });

    const cad = await ladeAnhangsZeichnung(dxfAnhang, 1);
    expect(abruf).toHaveBeenCalledWith("/api/objects/obj-dxf/raw", { credentials: "same-origin" });
    expect(cad.src.startsWith("data:image/svg+xml")).toBe(true);
    expect(cad.ausgelassen).toBe(1);

    globalThis.fetch = (async () => antwort(false, "")) as unknown as typeof fetch;
    const weg = await ladeAnhangsZeichnung(dxfAnhang, 1).catch((e: unknown) => e);
    expect((weg as ZeichnungNichtDarstellbar).grund).toBe("laden");
  });

  it("L6 · PDF: die verlangte Seite wird gezeichnet, begrenzt auf die vorhandenen", async () => {
    globalThis.fetch = (async () => antwort(true, "")) as unknown as typeof fetch;
    const kontext = {} as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(kontext);
    const seitenbild = "data:image/png;base64,SEITE";
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(seitenbild);
    const anhang = { objectId: "obj-pdf", name: "Flansch-DN80.pdf", mime: "application/pdf" };

    expect(await ladeAnhangsZeichnung(anhang, 2)).toEqual({
      src: "data:image/png;base64,SEITE",
      seiten: 3,
      seite: 2,
      ausgelassen: 0,
    });
    expect((await ladeAnhangsZeichnung(anhang, 9)).seite).toBe(3);
    expect((await ladeAnhangsZeichnung(anhang, 0)).seite).toBe(1);
    expect(pdf.gezeichnet).toEqual([2, 3, 1]);
    // Jedes geöffnete Dokument wird wieder freigegeben.
    expect(pdf.freigegeben).toBe(3);
  });
});
