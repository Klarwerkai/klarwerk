// ================================================================================================
// ANHÄNGE ZIEHEN · IM ECHTEN BROWSER — Maus runter auf dem Listeneintrag, Maus hoch im Text.
// ================================================================================================
//
// WAS HIER GEFAHREN WIRD: der echte RichTextEditor (`buehne.tsx`), von einem Vite-
// Entwicklungsserver über `apps/web` ausgeliefert, in Chromium. Gezogen wird mit der echten Maus
// (`mouse.down` → `mouse.move` → `mouse.up`); Chromium erzeugt daraus selbst `dragstart`,
// `dragover` und `drop` — mit den Koordinaten, an denen die Maus wirklich losgelassen wurde. Welche
// Textstelle unter diesem Punkt liegt, entscheidet der Browser (`caretPositionFromPoint`), nicht
// der Test.
//
// DIE DREI KRITERIEN DES AUFTRAGS UND IHRE FÄLLE
//   Z1 · Drop an der tatsächlichen Textposition — und nicht am Cursor oder am Ende.
//   Z2 · Eigener Anker je Bildvorkommen: dasselbe Bild zweimal gezogen ergibt zwei Hüllen mit
//        zwei verschiedenen Kennungen, Bild und Unterschrift je gleich.
//   Z3 · Stabil nach Speichern/Wiederöffnen: Sanitizer an der Persistenzgrenze, frischer Editor —
//        dieselben Kennungen an denselben Stellen.
// DAZU
//   Z4 · Datei aus der Dateiliste: sicherer Anhang-Link an der Textposition.
//   Z5 · Abgelegt auf einer vorhandenen Bildunterschrift: hinter die Hülle, die Hülle bleibt.
//   Z6 · Fremdes HTML, URLs und unbekannte Schlüssel: keine Wirkung.
//   E1 · Klick-Einfügen aus der Liste setzt weiter am Klickcursor ein.
//   E2 · Ein Rasterbild als Datei fallen gelassen wird weiter eingebettet und verankert.
//
// GRENZE, benannt: ohne das Tailwind-Stylesheet der App. Die Palette steht deshalb im Fluss über
// dem Schreibfeld statt schwebend; keine Aussage hier hängt an Pixelmaßen, nur an Textstellen.
import { createRequire } from "node:module";
import { createServer as netzServer } from "node:net";
import { join } from "node:path";
import { type ViteDevServer, createServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const DATEI = "tests/anhaenge-ziehen/ziehen-im-browser-chromium.test.ts";
const WURZEL = join(__dirname, "..", "..");
const WEB = join(WURZEL, "apps", "web");
const BUEHNE = join(__dirname, "buehne.tsx").split("\\").join("/");
const verlangeModul = createRequire(join(WEB, "index.js"));

// Gespiegelt aus `buehne.tsx` — die Namen, unter denen ein Mensch die Einträge findet.
const BILD = "Pumpe.png";
const BILD_SRC = "/api/objects/obj-pumpe/raw";
const DATEI_NAME = "Wartungsplan.pdf";
const DATEI_HREF = "/api/objects/obj-plan/raw";

interface Punkt {
  x: number;
  y: number;
}
interface Page {
  goto(url: string): Promise<unknown>;
  route(muster: string, handler: (route: Weiche) => unknown): Promise<void>;
  on(ereignis: string, f: (x: unknown) => void): void;
  evaluate<T>(ausdruck: string): Promise<T>;
  waitForFunction(ausdruck: string, arg?: unknown, o?: Record<string, unknown>): Promise<unknown>;
  mouse: {
    move(x: number, y: number, o?: Record<string, unknown>): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number): Promise<void>;
  };
}
interface Weiche {
  fulfill(o: Record<string, unknown>): Promise<void>;
}
interface Browser {
  newPage(o: Record<string, unknown>): Promise<Page>;
  close(): Promise<void>;
}

interface Figur {
  bildId: string | null;
  unterschriftId: string | null;
  src: string | null;
  unterschrift: string;
  davor: string;
  danach: string;
}
interface Lage {
  figuren: Figur[];
  links: Array<{ href: string | null; davor: string; danach: string }>;
  text: string;
}

let server: ViteDevServer | null = null;
let browser: Browser | null = null;
let seite: Page | null = null;
let basis = "";
const seitenfehler: string[] = [];

async function freierPort(): Promise<number> {
  return new Promise((ok, fehl) => {
    const s = netzServer();
    s.once("error", fehl);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a ? a.port : 0;
      s.close(() => ok(port));
    });
  });
}

const FELD = `document.querySelector('[role="textbox"]')`;

// Die Lage eines Rumpfes — des lebenden Schreibfeldes oder des zuletzt gemeldeten Standes. Text vor
// und nach jeder Hülle wird über einen Bereich vom Anfang bzw. bis zum Ende gelesen und
// whitespace-normalisiert: gefragt ist WO die Hülle im Text steht, nicht welche Absatzknoten der
// HTML-Parser beim Wiederöffnen daraus macht.
const lage = (quelle: "feld" | "gemeldet"): string => `(() => {
  const wurzel = ${
    quelle === "feld"
      ? FELD
      : `(() => { const d = document.createElement("div"); d.innerHTML = window.__buehne.gemeldet(); return d; })()`
  };
  const norm = (s) => s.replace(/\\s+/g, " ").trim();
  const davor = (k) => { const r = document.createRange(); r.setStart(wurzel, 0); r.setEndBefore(k); return norm(r.toString()); };
  const danach = (k) => { const r = document.createRange(); r.setStartAfter(k); r.setEnd(wurzel, wurzel.childNodes.length); return norm(r.toString()); };
  return {
    figuren: [...wurzel.querySelectorAll("figure")].map((f) => ({
      bildId: f.querySelector("img")?.getAttribute("data-image-id") ?? null,
      unterschriftId: f.querySelector("figcaption")?.getAttribute("data-image-id") ?? null,
      src: f.querySelector("img")?.getAttribute("src") ?? null,
      unterschrift: norm(f.querySelector("figcaption")?.textContent ?? ""),
      davor: davor(f),
      danach: danach(f),
    })),
    links: [...wurzel.querySelectorAll("div.attachment > a")].map((a) => ({
      href: a.getAttribute("href"), davor: davor(a.parentElement), danach: danach(a.parentElement),
    })),
    text: norm(wurzel.textContent ?? ""),
  };
})()`;

async function montiere(start: string): Promise<Page> {
  const s = seite as Page;
  await s.evaluate(`window.__buehne.montiere(${JSON.stringify(start)})`);
  await s.waitForFunction(`!!${FELD}`);
  return s;
}

// Die linke Kante des ersten Zeichens von `wort` im Schreibfeld — wer dort loslässt, legt VOR das
// Wort. Die Stelle kommt aus der Darstellung des Browsers, nicht aus einer angenommenen Schrift.
async function vorWort(s: Page, wort: string): Promise<Punkt> {
  return s.evaluate<Punkt>(`(() => {
    const feld = ${FELD};
    const gang = document.createTreeWalker(feld, NodeFilter.SHOW_TEXT);
    for (let k = gang.nextNode(); k; k = gang.nextNode()) {
      const i = k.data.indexOf(${JSON.stringify(wort)});
      if (i >= 0) {
        const r = document.createRange(); r.setStart(k, i); r.setEnd(k, i + 1);
        const b = r.getBoundingClientRect();
        return { x: b.left + 1, y: b.top + b.height / 2 };
      }
    }
    throw new Error("Wort nicht im Schreibfeld: " + ${JSON.stringify(wort)});
  })()`);
}

async function hinterWort(s: Page, wort: string): Promise<Punkt> {
  return s.evaluate<Punkt>(`(() => {
    const feld = ${FELD};
    const gang = document.createTreeWalker(feld, NodeFilter.SHOW_TEXT);
    for (let k = gang.nextNode(); k; k = gang.nextNode()) {
      const i = k.data.indexOf(${JSON.stringify(wort)});
      if (i >= 0) {
        const e = i + ${JSON.stringify(wort)}.length;
        const r = document.createRange(); r.setStart(k, e - 1); r.setEnd(k, e);
        const b = r.getBoundingClientRect();
        return { x: b.right - 1, y: b.top + b.height / 2 };
      }
    }
    throw new Error("Wort nicht im Schreibfeld: " + ${JSON.stringify(wort)});
  })()`);
}

// Die Mitte eines Knopfes, gefunden über seinen sichtbaren Text oder seinen Titel.
async function knopf(s: Page, o: { text?: string; titel?: string }): Promise<Punkt> {
  await s.waitForFunction(
    `[...document.querySelectorAll("button")].some((b) => ${
      o.text !== undefined
        ? `b.textContent.trim() === ${JSON.stringify(o.text)}`
        : `b.title === ${JSON.stringify(o.titel)}`
    })`,
  );
  return s.evaluate<Punkt>(`(() => {
    const b = [...document.querySelectorAll("button")].find((b) => ${
      o.text !== undefined
        ? `b.textContent.trim() === ${JSON.stringify(o.text)}`
        : `b.title === ${JSON.stringify(o.titel)}`
    });
    const r = b.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
}

async function oeffneListe(s: Page, art: "bild" | "datei"): Promise<void> {
  const titel = await s.evaluate<string>(
    `window.__buehne.t(${JSON.stringify(art === "bild" ? "editor.image" : "editor.file")})`,
  );
  const p = await knopf(s, { titel });
  await s.mouse.click(p.x, p.y);
}

// Echtes Ziehen: drücken, ein paar Pixel anrucken (Chromium beginnt den Ziehvorgang erst nach einer
// Bewegung), in Schritten zum Ziel, loslassen.
async function ziehe(s: Page, von: Punkt, nach: Punkt): Promise<void> {
  await s.mouse.move(von.x, von.y);
  await s.mouse.down();
  await s.mouse.move(von.x + 6, von.y + 6, { steps: 3 });
  await s.mouse.move(nach.x, nach.y, { steps: 10 });
  await s.mouse.up();
}

async function zieheBildVor(s: Page, wort: string): Promise<void> {
  await oeffneListe(s, "bild");
  const quelle = await knopf(s, { text: BILD });
  const ziel = await vorWort(s, wort);
  await ziehe(s, quelle, ziel);
}

async function warteAufFiguren(s: Page, anzahl: number): Promise<void> {
  try {
    await s.waitForFunction(`${FELD}.querySelectorAll("figure").length === ${anzahl}`, undefined, {
      timeout: 10_000,
    });
  } catch (e) {
    const html = await s.evaluate<string>(`${FELD}.innerHTML`);
    throw new Error(
      `Erwartet ${anzahl} Bildhülle(n). Schreibfeld: ${html} · Seitenfehler: ${seitenfehler.join(" | ") || "keine"}`,
      { cause: e },
    );
  }
}

beforeAll(async () => {
  const port = await freierPort();
  server = await createServer({
    configFile: false,
    root: WEB,
    logLevel: "error",
    clearScreen: false,
    cacheDir: join(WURZEL, ".local", "run", "vite-cache-anhaenge-ziehen"),
    esbuild: { jsx: "automatic" },
    // Vorgebündelt wird, was der Editor braucht, plus die zwei Namen der Bühne — VOR dem ersten
    // Seitenaufruf, damit kein nachentdecktes Paket die Seite mitten im Lauf neu lädt.
    optimizeDeps: {
      entries: ["src/components/RichTextEditor.tsx"],
      include: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "react-dom/client"],
    },
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      hmr: false,
      fs: { allow: [WURZEL] },
    },
  });
  await server.listen();
  basis = `http://127.0.0.1:${port}`;

  const { chromium } = verlangeModul("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  const s = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  s.on("pageerror", (e) => seitenfehler.push(String(e)));
  await s.route(`${basis}/buehne.html`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body><div id="wurzel"></div><script type="module" src="/@fs${BUEHNE.startsWith("/") ? "" : "/"}${BUEHNE}"></script></body></html>`,
    }),
  );
  await s.goto(`${basis}/buehne.html`);
  try {
    await s.waitForFunction("window.__buehne !== undefined", undefined, { timeout: 150_000 });
  } catch (e) {
    throw new Error(`Die Bühne ist nicht hochgekommen: ${seitenfehler.join(" | ") || "—"}`, {
      cause: e,
    });
  }
  seite = s;
}, 240_000);

afterAll(async () => {
  try {
    await schliesseChromium(DATEI, browser);
  } finally {
    await server?.close();
  }
}, 90_000);

describe("Anhänge ziehen · Z1 — abgelegt wird an der Textstelle unter der Maus", () => {
  it("Z1 · ein Bild aus der Liste landet vor dem Wort, auf dem losgelassen wurde — nicht am Cursor", async () => {
    const s = await montiere("<p>Alpha Beta Gamma</p>");
    // Der Cursor steht bewusst am ENDE. Ein Einfügen am Cursor oder am Ende wäre hier sichtbar falsch.
    const ende = await hinterWort(s, "Gamma");
    await s.mouse.click(ende.x, ende.y);

    await zieheBildVor(s, "Beta");
    await warteAufFiguren(s, 1);

    const feld = await s.evaluate<Lage>(lage("feld"));
    expect(feld.figuren[0]?.src).toBe(BILD_SRC);
    expect(feld.figuren[0]?.davor, JSON.stringify(feld)).toBe("Alpha");
    expect(feld.figuren[0]?.danach, JSON.stringify(feld)).toBe("Beta Gamma");
    // Die vorhandene Bildhülle: Bild + Unterschrift mit derselben Kennung.
    expect(feld.figuren[0]?.bildId).toBeTruthy();
    expect(feld.figuren[0]?.unterschriftId).toBe(feld.figuren[0]?.bildId);
    // Und gemeldet (= gespeichert) ist genau dieser Stand.
    const gemeldet = await s.evaluate<Lage>(lage("gemeldet"));
    expect(gemeldet.figuren).toEqual(feld.figuren);
  });
});

describe("Anhänge ziehen · Z2/Z3 — ein Anker je Vorkommen, stabil über Speichern und Wiederöffnen", () => {
  it("Z2 · dasselbe Bild zweimal gezogen: zwei Hüllen, zwei Kennungen, jede an ihrer Stelle", async () => {
    const s = await montiere("<p>Alpha Beta Gamma Delta</p>");
    await zieheBildVor(s, "Beta");
    await warteAufFiguren(s, 1);
    await zieheBildVor(s, "Delta");
    await warteAufFiguren(s, 2);

    const feld = await s.evaluate<Lage>(lage("feld"));
    const [a, b] = feld.figuren;
    expect(a?.src).toBe(BILD_SRC);
    expect(b?.src).toBe(BILD_SRC);
    expect(a?.bildId).toBeTruthy();
    expect(b?.bildId).toBeTruthy();
    expect(a?.bildId, "beide Vorkommen teilen sich eine Kennung").not.toBe(b?.bildId);
    expect(a?.unterschriftId).toBe(a?.bildId);
    expect(b?.unterschriftId).toBe(b?.bildId);
    expect(a?.davor, JSON.stringify(feld)).toBe("Alpha");
    expect(b?.davor, JSON.stringify(feld)).toBe("Alpha Beta Gamma");
    expect(b?.danach, JSON.stringify(feld)).toBe("Delta");
  });

  it("Z3 · nach Speichern und Wiederöffnen: dieselben Kennungen an denselben Textstellen", async () => {
    const s = await montiere("<p>Alpha Beta Gamma Delta</p>");
    await zieheBildVor(s, "Beta");
    await warteAufFiguren(s, 1);
    await zieheBildVor(s, "Delta");
    await warteAufFiguren(s, 2);
    const vorher = await s.evaluate<Lage>(lage("feld"));

    const gespeichert = await s.evaluate<string>("window.__buehne.neuLaden()");
    await warteAufFiguren(s, 2);
    const nachher = await s.evaluate<Lage>(lage("feld"));

    const kennungen = (l: Lage) => l.figuren.map((f) => [f.bildId, f.unterschriftId, f.src]);
    expect(kennungen(nachher), gespeichert).toEqual(kennungen(vorher));
    expect(nachher.figuren.map((f) => [f.davor, f.danach])).toEqual(
      vorher.figuren.map((f) => [f.davor, f.danach]),
    );
    for (const f of vorher.figuren) {
      // Bild und Unterschrift tragen die Kennung im gespeicherten Rumpf — je genau einmal.
      expect(gespeichert.split(`data-image-id="${f.bildId}"`).length - 1, gespeichert).toBe(2);
    }
  });
});

describe("Anhänge ziehen · Z4/Z5 — Dateien und vorhandene Bildhüllen", () => {
  it("Z4 · eine Datei aus der Dateiliste wird zum sicheren Anhang-Link an der Textstelle", async () => {
    const s = await montiere("<p>Vorher Nachher</p>");
    await oeffneListe(s, "datei");
    const quelle = await knopf(s, { text: DATEI_NAME });
    await ziehe(s, quelle, await vorWort(s, "Nachher"));
    await s.waitForFunction(`!!${FELD}.querySelector("div.attachment > a")`, undefined, {
      timeout: 10_000,
    });

    const feld = await s.evaluate<Lage>(lage("feld"));
    expect(feld.links).toEqual([{ href: DATEI_HREF, davor: "Vorher", danach: "Nachher" }]);
    await s.evaluate("window.__buehne.neuLaden()");
    const nachher = await s.evaluate<Lage>(lage("feld"));
    expect(nachher.links.map((l) => l.href)).toEqual([DATEI_HREF]);
  });

  it("Z5 · auf einer Bildunterschrift losgelassen: das Bild kommt HINTER die Hülle, die bleibt unberührt", async () => {
    const s = await montiere(
      `<figure><img src="/api/objects/obj-alt/raw" alt="Alt"><figcaption>Alte Unterschrift</figcaption></figure><p>Text danach</p>`,
    );
    await warteAufFiguren(s, 1);
    const vorher = await s.evaluate<Lage>(lage("feld"));

    await zieheBildVor(s, "Unterschrift");
    await warteAufFiguren(s, 2);

    const feld = await s.evaluate<Lage>(lage("feld"));
    const [alt, neu] = feld.figuren;
    const alteHuelle = vorher.figuren[0];
    // Die vorhandene Hülle ist dieselbe geblieben: Bild, Kennungen, Unterschrift, Stelle.
    expect([alt?.src, alt?.bildId, alt?.unterschriftId, alt?.davor], JSON.stringify(feld)).toEqual([
      alteHuelle?.src,
      alteHuelle?.bildId,
      alteHuelle?.unterschriftId,
      alteHuelle?.davor,
    ]);
    expect(alt?.unterschrift).toBe("Alte Unterschrift");
    expect(neu?.src).toBe(BILD_SRC);
    expect(neu?.bildId).not.toBe(alt?.bildId);
    expect(neu?.unterschriftId).toBe(neu?.bildId);
    expect(neu?.davor).toBe("Alte Unterschrift");
    expect(neu?.danach).toBe("Text danach");
  });
});

describe("Anhänge ziehen · Z6 — fremde Ziehdaten bleiben draußen", () => {
  const FREMD: Array<[string, Record<string, string>]> = [
    [
      "fremdes HTML",
      { "text/html": `<img src="https://fremd.example/x.png" onerror="window.__boese=1">` },
    ],
    [
      "fremde URL",
      {
        "text/uri-list": "https://fremd.example/x.png",
        "text/plain": "https://fremd.example/x.png",
      },
    ],
    [
      "unbekannter Schlüssel",
      { "application/x-klarwerk-anhang": JSON.stringify({ art: "bild", schluessel: "unbekannt" }) },
    ],
    [
      "Bildschlüssel als Datei",
      {
        "application/x-klarwerk-anhang": JSON.stringify({ art: "datei", schluessel: "obj-pumpe" }),
      },
    ],
    ["Markup statt Schlüssel", { "application/x-klarwerk-anhang": "<img src=x onerror=alert(1)>" }],
  ];

  it.each(FREMD)("Z6 · %s · nichts eingefügt, nichts gemeldet", async (_name, daten) => {
    const s = await montiere("<p>Vorher Nachher</p>");
    const vorher = await s.evaluate<string>(`${FELD}.innerHTML`);
    const p = await vorWort(s, "Nachher");
    await s.evaluate(`(() => {
        const dt = new DataTransfer();
        for (const [typ, wert] of Object.entries(${JSON.stringify(daten)})) dt.setData(typ, wert);
        ${FELD}.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: ${p.x}, clientY: ${p.y} }));
      })()`);
    expect(await s.evaluate<string>(`${FELD}.innerHTML`)).toBe(vorher);
    expect(await s.evaluate<number>("window.__buehne.meldungen()")).toBe(0);
    expect(await s.evaluate<unknown>("window.__boese")).toBeUndefined();
  });

  it("Z6 · mitgeschicktes Markup neben einem bekannten Schlüssel wird nicht übernommen", async () => {
    const s = await montiere("<p>Vorher Nachher</p>");
    const p = await vorWort(s, "Nachher");
    const wert = JSON.stringify({
      art: "bild",
      schluessel: "obj-pumpe",
      html: `<img src="https://fremd.example/x.png" onerror="window.__boese=1">`,
    });
    await s.evaluate(`(() => {
      const dt = new DataTransfer();
      dt.setData("application/x-klarwerk-anhang", ${JSON.stringify(wert)});
      ${FELD}.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: ${p.x}, clientY: ${p.y} }));
    })()`);
    await warteAufFiguren(s, 1);
    const html = await s.evaluate<string>(`${FELD}.innerHTML + window.__buehne.gemeldet()`);
    expect(html).not.toContain("fremd.example");
    expect(html).not.toContain("onerror");
    expect((await s.evaluate<Lage>(lage("feld"))).figuren[0]?.src).toBe(BILD_SRC);
  });
});

describe("Anhänge ziehen · E — die vorhandenen Wege bleiben, wie sie waren", () => {
  it("E1 · Klick auf den Listeneintrag fügt weiter am Klickcursor ein", async () => {
    const s = await montiere("<p>Vorher Nachher</p>");
    const p = await vorWort(s, "Nachher");
    await s.mouse.click(p.x, p.y);
    await oeffneListe(s, "bild");
    const eintrag = await knopf(s, { text: BILD });
    await s.mouse.click(eintrag.x, eintrag.y);
    await warteAufFiguren(s, 1);

    const feld = await s.evaluate<Lage>(lage("feld"));
    expect(feld.figuren[0]?.src).toBe(BILD_SRC);
    expect(feld.figuren[0]?.davor, JSON.stringify(feld)).toBe("Vorher");
    expect(feld.figuren[0]?.danach, JSON.stringify(feld)).toBe("Nachher");
    expect(feld.figuren[0]?.unterschriftId).toBe(feld.figuren[0]?.bildId);
  });

  it("E2 · ein Rasterbild als Datei fallen gelassen wird weiter eingebettet und verankert", async () => {
    const s = await montiere("<p>Vorher Nachher</p>");
    const p = await vorWort(s, "Nachher");
    await s.evaluate(`(async () => {
      const c = document.createElement("canvas"); c.width = 8; c.height = 8;
      c.getContext("2d").fillRect(0, 0, 8, 8);
      const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], "foto.png", { type: "image/png" }));
      ${FELD}.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt, clientX: ${p.x}, clientY: ${p.y} }));
    })()`);
    await warteAufFiguren(s, 1);
    const feld = await s.evaluate<Lage>(lage("feld"));
    expect(feld.figuren[0]?.src?.startsWith("data:image/")).toBe(true);
    expect(feld.figuren[0]?.bildId).toBeTruthy();
    expect(feld.figuren[0]?.unterschriftId).toBe(feld.figuren[0]?.bildId);
    expect(feld.text).toBe("Vorher Nachher");
  });
});
