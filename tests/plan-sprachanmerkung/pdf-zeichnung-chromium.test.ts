// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) · NACHARBEIT 6 — DIE ECHTE PDF-DARSTELLUNG IM BROWSER
// ================================================================================================
//
// BENs offener Beleg: „Die tatsächliche PDF-Darstellung im Browser ist nicht belegt" — L6 ersetzt
// pdfjs und Canvas durch Doppel, die Flächenprobe ersetzt den Lader. Hier läuft ALLES echt: die
// gebaute Oberfläche (`apps/web/dist`) in Chromium, die echte App mit echtem Objektspeicher, die
// echte pdfjs-Engine samt Worker, das echte Canvas — Vorrichtung `tests/design/h4-harness.ts`.
//
// DIE DATEI IST EINE ECHTE, ZWEISEITIGE PDF, deren Inhalt bekannt ist: Seite 1 trägt ein schwarzes
// Rechteck in der LINKEN Hälfte, Seite 2 eines in der RECHTEN. Gemessen wird am gezeichneten Bild
// (Pixel), nicht an einem Attribut — so ist belegt, dass wirklich DIESE Seite gezeichnet wurde.
//
// P1  die PDF erscheint als Zeichnung, Seite 1 von 2, links dunkel, rechts hell; keine Fehlermeldung
// P2  „Nächste Seite" zeichnet Seite 2: jetzt rechts dunkel, links hell
// P3  ein echter Mausklick auf die Zeichnung setzt die Marke an genau die Stelle
// P4  Notiz tippen und senden: am Eintrag steht die Notiz mit Anhang, Seite 2 und dem Punkt
// P5  Chromium meldet keine Seitenfehler
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, fn, h4Stand } from "../design/h4-harness";

/** Eine kleine, gültige PDF (nur ASCII) mit zwei Seiten zu 200 × 100 pt. */
function zweiseitigePdf(): string {
  // Seite 1: Rechteck x 20..80, y 20..80 (links). Seite 2: x 120..180 (rechts).
  const links = "0 0 0 rg 20 20 60 60 re f";
  const rechts = "0 0 0 rg 120 20 60 60 re f";
  const seite = (inhalt: number): string =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Contents ${inhalt} 0 R /Resources << >> >>`;
  const strom = (inhalt: string): string =>
    `<< /Length ${inhalt.length} >>\nstream\n${inhalt}\nendstream`;
  const objekte = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    seite(4),
    strom(links),
    seite(6),
    strom(rechts),
  ];
  let pdf = "%PDF-1.4\n";
  const lagen: number[] = [];
  for (const [i, o] of objekte.entries()) {
    lagen.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objekte.length + 1}\n0000000000 65535 f \n`;
  pdf += lagen.map((l) => `${String(l).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objekte.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

const NAME = "Bohrbild-Flansch.pdf";
const NOTIZ = "Bezugspunkt rechts messen";

const ZEICHNUNG = '[data-bib-diskussion-zeichnung] [data-bib-zeichnung="waehlbar"] img';

/** Helligkeit (0..255) des gezeichneten Bildes an zwei Stellen — links und rechts der Mitte. */
const HELLIGKEIT = `() => {
  const img = document.querySelector('${ZEICHNUNG}');
  if (!img || !img.complete || !img.naturalWidth) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const k = c.getContext('2d');
  k.drawImage(img, 0, 0);
  const wert = (fx) => {
    const d = k.getImageData(Math.floor(fx * c.width), Math.floor(0.5 * c.height), 1, 1).data;
    return Math.round((d[0] + d[1] + d[2]) / 3);
  };
  return { links: wert(0.25), rechts: wert(0.75), src: img.getAttribute('src').slice(0, 22) };
}`;

interface Helligkeit {
  links: number;
  rechts: number;
  src: string;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;
let objectId = "";
let seite1: Helligkeit | null = null;
let seite2: Helligkeit | null = null;
let seitenanzeige: string | null = null;
let marke: string | null = null;
/** Ein Beitrag, wie ihn `GET /api/kos/:id` liefert. */
interface Gelesen {
  text: string;
  stelle?: Record<string, unknown>;
}
let gespeichert: Gelesen[] = [];

describe("PLAN-SPRACHANMERKUNG · echte PDF-Darstellung in Chromium", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@plan-pdf.test", async (z) => {
        // Hochladen und Anhängen über die ECHTEN Dienste — dieselben, die Upload- und attach-Route
        // benutzen; die Datei liegt danach wirklich im Objektspeicher.
        const b64 = Buffer.from(zweiseitigePdf(), "latin1").toString("base64");
        const ref = await z.services.objects.put({
          name: NAME,
          mime: "application/pdf",
          data: `data:application/pdf;base64,${b64}`,
          kind: "document",
          purpose: "attachment",
          owner: z.autorId,
        });
        objectId = ref.id;
        await z.services.ko.addAttachment(z.freiId, z.autorId, {
          name: NAME,
          mime: "application/pdf",
          objectId: ref.id,
          size: ref.size,
        });
      });
      const s = stand.seite;
      await s.evaluate(
        fn(
          `() => { const b = document.querySelector('[data-testid="bib-mehr"]'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }`,
        ),
      );
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-bib-abschnitt="kommentare"]')`),
        undefined,
        { timeout: 30_000 },
      );
      await s.evaluate(
        fn(
          `() => { const d = document.querySelector('[data-bib-abschnitt="kommentare"]'); if (d && !d.open) d.open = true; }`,
        ),
      );
      await s.waitForFunction(
        fn(`() => !!document.querySelector('[data-bib-diskussion-stellenwahl]')`),
        undefined,
        { timeout: 30_000 },
      );

      // P1 · die PDF wählen; gewartet wird auf das GEZEICHNETE Bild (oder eine Fehlermeldung).
      await s.selectOption("[data-bib-diskussion-stellenwahl]", `anhang:${objectId}`);
      const bereit = `() => !!document.querySelector('[data-bib-anhangszeichnung-fehler]') || (() => { const i = document.querySelector('${ZEICHNUNG}'); return !!i && i.complete && i.naturalWidth > 0; })()`;
      await s.waitForFunction(fn(bereit), undefined, { timeout: 60_000 });
      seite1 = await s.evaluate<Helligkeit | null>(fn(HELLIGKEIT));
      seitenanzeige = await s.evaluate<string | null>(
        fn(
          `() => { const e = document.querySelector('[data-bib-anhangszeichnung-seite]'); return e ? e.getAttribute('data-bib-anhangszeichnung-seite') : null; }`,
        ),
      );

      // P2 · „Nächste Seite" — gewartet wird, bis die Anzeige 2/2 sagt UND das Bild geladen ist.
      await s.click("[data-bib-anhangszeichnung-weiter]");
      await s.waitForFunction(
        fn(
          `() => !!document.querySelector('[data-bib-anhangszeichnung-seite="2/2"]') && (() => { const i = document.querySelector('${ZEICHNUNG}'); return !!i && i.complete && i.naturalWidth > 0; })()`,
        ),
        undefined,
        { timeout: 60_000 },
      );
      seite2 = await s.evaluate<Helligkeit | null>(fn(HELLIGKEIT));

      // P3 · ein echter Mausklick auf die Mitte des rechten Rechtecks (75 % / 50 %).
      const ziel = await s.evaluate<{ x: number; y: number } | null>(
        fn(`() => {
          const img = document.querySelector('${ZEICHNUNG}');
          if (!img) return null;
          img.scrollIntoView({ block: 'center' });
          const r = img.getBoundingClientRect();
          return { x: r.left + r.width * 0.75, y: r.top + r.height * 0.5 };
        }`),
      );
      if (ziel) {
        await s.mouse.click(ziel.x, ziel.y);
      }
      const markeDa = `() => !!document.querySelector('[data-bib-zeichnung-marke]')`;
      await s.waitForFunction(fn(markeDa), undefined, { timeout: 10_000 });
      marke = await s.evaluate<string | null>(
        fn(
          `() => document.querySelector('[data-bib-zeichnung-marke]').getAttribute('data-bib-zeichnung-marke')`,
        ),
      );

      // P4 · tippen und senden, dann den gespeicherten Stand über die echte API lesen.
      const feld = `() => document.querySelector('[data-bib-abschnitt="kommentare"] textarea').focus()`;
      await s.evaluate(fn(feld));
      await s.keyboard.type(NOTIZ);
      await s.click("[data-bib-diskussion-senden]");
      const beitraege = `(id) => fetch('/api/kos/' + id).then((r) => r.json()).then((k) => k.comments || [])`;
      const geschrieben = `(id) => (${beitraege})(id).then((c) => c.length > 0)`;
      await s.waitForFunction(fn(geschrieben), stand.koId, { timeout: 30_000 });
      gespeichert = await s.evaluate<Gelesen[]>(fn(beitraege), stand.koId);
    } catch (e) {
      fehler = String(e);
    }
  }, 300_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("P1 · die PDF erscheint als Zeichnung, Seite 1 von 2: links das Rechteck, rechts weiss", () => {
    expect(fehler).toBeNull();
    expect(seite1, "kein gezeichnetes Bild (Fehlermeldung statt Zeichnung?)").not.toBeNull();
    expect(seite1?.src).toBe("data:image/png;base64,");
    expect(seitenanzeige).toBe("1/2");
    expect(seite1?.links).toBeLessThan(80);
    expect(seite1?.rechts).toBeGreaterThan(200);
  });

  it("P2 · „Nächste Seite“ zeichnet wirklich Seite 2: jetzt rechts das Rechteck", () => {
    expect(fehler).toBeNull();
    expect(seite2?.links).toBeGreaterThan(200);
    expect(seite2?.rechts).toBeLessThan(80);
  });

  it("P3 · ein echter Mausklick setzt die Marke an die geklickte Stelle", () => {
    expect(fehler).toBeNull();
    const [x, y] = (marke ?? "").split(",").map(Number);
    expect(Math.abs((x ?? -99) - 75)).toBeLessThanOrEqual(1);
    expect(Math.abs((y ?? -99) - 50)).toBeLessThanOrEqual(1);
  });

  it("P4 · die gesendete Notiz hängt an Anhang, Seite 2 und Punkt", () => {
    expect(fehler).toBeNull();
    expect(gespeichert).toHaveLength(1);
    const [notiz] = gespeichert;
    expect(notiz?.text).toBe(NOTIZ);
    expect(notiz?.stelle).toMatchObject({ art: "anhang", abschnitt: "", text: objectId, seite: 2 });
    const punkt = notiz?.stelle?.punkt as { x: number; y: number } | undefined;
    expect(Math.abs((punkt?.x ?? -1) - 0.75)).toBeLessThan(0.02);
    expect(Math.abs((punkt?.y ?? -1) - 0.5)).toBeLessThan(0.02);
  });

  it("P5 · Chromium meldet keine Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).seitenfehler, "Chromium meldete Seitenfehler").toEqual([]);
  });
});
