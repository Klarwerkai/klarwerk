// @vitest-environment jsdom
//
// ================================================================================================
// JOB 3096 · M5 — DAS BILD IM WORD-PANEL, am VOLLSTAENDIGEN ausgelieferten Aufgabenfenster.
// ================================================================================================
//
// Pedis Weg (§1): er markiert in Word „Schraubverbindungen am Profil“, klickt „Bild dazu?", Klara
// zeigt die Treffer aus dem Bestand (Bild, Unterschrift, Herkunft), er waehlt eines, und ERST der
// Klick auf „In Word einfuegen" schreibt Bild, Unterschrift und Herkunftszeile ins Dokument.
//
// RED-FIRST (§6): vor diesem Auftrag gab es weder `#m5-bild-btn` noch `#m5-bild-karte` in
// taskpane.html — P1 scheiterte an „#m5-bild-btn fehlt im Aufgabenfenster". Gegenproben stehen in
// der Rueckgabe (Herkunftszeile weglassen → P3 rot; Einfuegen ohne Klick → P2 rot).
//
// BAUFORM: dieselbe wie tests/ka6-memo-panel/memo-panel-mounted.test.ts (JOB 3091) und
// tests/app/word-addin-ask.test.ts (JOB 1153) — das ganze Fenster wird geladen, `fetch` ist ein
// Router ueber die echten Pfade, und die Spione sitzen auf dem Host: `Word.run` mit einer Paragraph-
// Attrappe, die `insertParagraph` und `insertInlinePictureFromBase64` (WordApi 1.1) protokolliert.
// Eine Abwesenheit („kein Schreibaufruf vor dem Klick") laesst sich nur am Host messen.
//
// Der Gate-`tsc` laeuft ohne DOM-lib; DOM-Zugriffe gehen ueber schmale Struktur-Typen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

interface El {
  id: string;
  className: string;
  textContent: string | null;
  value: string;
  disabled: boolean;
  getAttribute(name: string): string | null;
  click(): void;
  dispatchEvent(ereignis: Event): boolean;
  querySelector(sel: string): El | null;
  querySelectorAll(sel: string): { length: number; [i: number]: El };
}
interface Dok {
  getElementById(id: string): El | null;
  body: { innerHTML: string };
}
interface Fenster {
  Office?: unknown;
  Word?: unknown;
  addEventListener(typ: string, fn: unknown): void;
  removeEventListener(typ: string, fn: unknown): void;
  Event: new (typ: string, init?: { bubbles?: boolean }) => Event;
}
const umgebung = globalThis as unknown as { document: Dok; window: Fenster };

// ------------------------------------------------------------------------------------------------
// Der Drahtvertrag von GET /api/library/images (JOB 3095, apps/web/src/api/types.ts
// LibraryImageHit / LibraryImageSearchResponse) — jedes Feld ein echtes Vertragsfeld.
// ------------------------------------------------------------------------------------------------
interface Treffer {
  imageId: string;
  koId: string;
  koTitel: string;
  version: number;
  pruefstand: "offen" | "validiert";
  caption: string;
  name: string | null;
  gefundenUeber: ("beschreibung" | "name")[];
  thumbnailUrl: string;
}

const MARKIERUNG = "Schraubverbindungen am Profil";
const GEPRUEFT = "2026-09-07T09:41:00.000Z";
// Ein winziges, echtes PNG (1×1) — die Bytes, die Word bekommt, sind genau diese.
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const DATA_URL = `data:image/png;base64,${PNG_BASE64}`;
const RAW_PFAD = "/api/objects/obj-77/raw";
const RAW_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const TREFFER_A: Treffer = {
  imageId: "img-a",
  koId: "ko-a",
  koTitel: "Montageanleitung Profil P40",
  version: 3,
  pruefstand: "validiert",
  caption: "Schraubverbindungen am Profil, Ansicht von oben",
  name: "profil-oben.png",
  gefundenUeber: ["beschreibung"],
  thumbnailUrl: DATA_URL,
};
const TREFFER_B: Treffer = {
  imageId: "img-b",
  koId: "ko-b",
  koTitel: "Pruefprotokoll Schraubverbindungen",
  version: 1,
  pruefstand: "offen",
  caption: "",
  name: "schraubverbindungen-profil.jpg",
  gefundenUeber: ["name"],
  thumbnailUrl: RAW_PFAD,
};

type Sitzung = { id: string; name: string } | null;

/** Die Serverlage eines Falls. */
interface Lage {
  /** Wer /api/auth/me beantwortet — null = 401. Ein Array schaltet je Abruf weiter. */
  me: Sitzung | Sitzung[];
  /** Was GET /api/library/images antwortet. */
  bilder: { status: 200; koerper: unknown } | { status: 401 | 403 | 503 | 500 } | "netz";
  /** Die Markierung, die Word liefert. */
  markierung: string;
  /** Wie /api/objects/…/raw antwortet. */
  raw: "ok" | 404;
}

let bilderAbrufe: Array<{ url: string; init: { credentials?: string } | undefined }> = [];
let rawAbrufe: string[] = [];
let meAbrufe = 0;
let logoutAbrufe = 0;
let wordRunGesamt = 0;
let bilderEingefuegt: Array<{ base64: string; ort: string }> = [];
let absaetzeEingefuegt: Array<{ text: string; ort: string }> = [];
let insertText = 0;
let setSelected = 0;
let zuhoerer: Array<{ typ: string; fn: unknown }> = [];
let meFolge: Sitzung[] = [];

function schreibaufrufe(): number {
  return bilderEingefuegt.length + absaetzeEingefuegt.length + insertText + setSelected;
}

function antwort(koerper: unknown, status = 200): unknown {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(koerper),
  };
}

function rawAntwort(): unknown {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) => (name.toLowerCase() === "content-type" ? "image/jpeg" : null),
    },
    arrayBuffer: () => Promise.resolve(RAW_BYTES.buffer.slice(0)),
  };
}

function suchantwort(treffer: Treffer[], gedeckelt = false): unknown {
  return { treffer, geprueft: GEPRUEFT, gedeckelt };
}

function router(lage: Lage) {
  return (url: string, init?: { method?: string; credentials?: string }) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/auth/me") {
      meAbrufe += 1;
      const naechste = meFolge.length > 1 ? meFolge.shift() : meFolge[0];
      if (naechste === null || naechste === undefined) {
        return Promise.resolve(antwort({ error: "UNAUTHORIZED" }, 401));
      }
      return Promise.resolve(antwort(naechste));
    }
    if (url === "/api/auth/logout" && methode === "POST") {
      logoutAbrufe += 1;
      return Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) });
    }
    if (url === "/api/reasoner/status") {
      return Promise.resolve(antwort({ enabled: false, reachable: "none" }));
    }
    if (url === "/api/klara/sessions" && methode === "POST") {
      return Promise.resolve(antwort({ error: "UNAVAILABLE" }, 503));
    }
    if (url === "/api/klara/ai-status") {
      return Promise.resolve(antwort({ error: "UNAVAILABLE" }, 503));
    }
    if (url.startsWith("/api/library/images")) {
      bilderAbrufe.push({ url, init });
      if (lage.bilder === "netz") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      if (lage.bilder.status === 200) {
        return Promise.resolve(antwort(lage.bilder.koerper));
      }
      return Promise.resolve(antwort({ error: "FEHLER" }, lage.bilder.status));
    }
    if (url === RAW_PFAD) {
      rawAbrufe.push(url);
      if (lage.raw === 404) {
        return Promise.resolve(antwort({ error: "NOT_FOUND" }, 404));
      }
      return Promise.resolve(rawAntwort());
    }
    return Promise.resolve(antwort({}, 404));
  };
}

async function leerlauf(runden = 10): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

/** Die Paragraph-Attrappe: jeder eingefuegte Absatz ist selbst wieder ein Paragraph (Kette). */
function absatzAttrappe(): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  p.insertParagraph = (text: string, ort: string) => {
    absaetzeEingefuegt.push({ text, ort });
    return absatzAttrappe();
  };
  p.insertInlinePictureFromBase64 = (base64: string, ort: string) => {
    bilderEingefuegt.push({ base64, ort });
    return {};
  };
  return p;
}

/** Laedt das VOLLSTAENDIGE Aufgabenfenster und haengt die Spione an den Host (Bauform JOB 1153). */
async function ladeFenster(lage: Lage): Promise<void> {
  meFolge = Array.isArray(lage.me) ? [...lage.me] : [lage.me];
  vi.stubGlobal("fetch", router(lage));
  const quelle = read(TASKPANE);
  const skriptStart = quelle.lastIndexOf("<script>");
  const skriptEnde = quelle.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = quelle.slice(skriptStart + "<script>".length, skriptEnde);
  const bodyStart = quelle.indexOf("<body>");
  expect(bodyStart).toBeGreaterThan(0);
  const markup = quelle.slice(bodyStart + "<body>".length, skriptStart);
  expect(markup.length).toBeGreaterThan(2000);
  umgebung.document.body.innerHTML = markup;

  const COERCION = { Text: "text", Html: "html" } as const;
  const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;
  umgebung.window.Office = {
    context: {
      document: {
        url: "",
        addHandlerAsync() {
          /* kein Markierungswechsel im Pruefstand */
        },
        getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void) {
          fn({ status: ASYNC_STATUS.Succeeded, value: lage.markierung });
        },
        setSelectedDataAsync(
          _text: string,
          _opts: unknown,
          fn: (r: { status: string }) => void,
        ): void {
          setSelected += 1;
          fn({ status: ASYNC_STATUS.Succeeded });
        },
      },
    },
    EventType: {},
    CoercionType: COERCION,
    AsyncResultStatus: ASYNC_STATUS,
    onReady: (cb: () => void) => cb(),
  };
  umgebung.window.Word = {
    InsertLocation: { replace: "Replace", after: "After", end: "End" },
    run: (fn: (ctx: unknown) => unknown) => {
      wordRunGesamt += 1;
      const absaetze = { items: [absatzAttrappe()], load: () => undefined };
      const range = {
        insertText: () => {
          insertText += 1;
        },
        paragraphs: absaetze,
      };
      const ctx = {
        document: {
          getSelection: () => range,
          body: { text: "", load: () => undefined, getHtml: () => ({ value: "" }) },
        },
        sync: () => Promise.resolve(),
      };
      return Promise.resolve(fn(ctx));
    },
  };
  const originalAdd = umgebung.window.addEventListener.bind(umgebung.window);
  umgebung.window.addEventListener = (typ: string, fn: unknown) => {
    zuhoerer.push({ typ, fn });
    originalAdd(typ, fn);
  };
  new Function(skript)();
  await leerlauf(20);
}

function el(id: string): El {
  const gefunden = umgebung.document.getElementById(id);
  expect(gefunden, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return gefunden as El;
}

function sichtbar(id: string): boolean {
  const e = umgebung.document.getElementById(id);
  return e !== null && !e.className.includes("hidden");
}

/** Der Wortlaut eines Schluessels — GELESEN aus dem ausgelieferten Fenster, nie abgeschrieben. */
function wortlaut(key: string, sprache = "de", vars: Record<string, string> = {}): string {
  const quelle = read(TASKPANE);
  const start = key.startsWith("m5Bild")
    ? quelle.indexOf("var M5_BILD_TEXTE")
    : quelle.indexOf("var STRINGS");
  expect(start, `${TASKPANE}: Woerterbuch fuer ${key} fehlt`).toBeGreaterThan(0);
  const block = quelle.indexOf(`      ${sprache}: {`, start);
  expect(block, `${TASKPANE}: Sprachblock ${sprache} fehlt`).toBeGreaterThan(0);
  const treffer = new RegExp(`^\\s*${key}: "((?:[^"\\\\]|\\\\.)*)"`, "m").exec(quelle.slice(block));
  expect(treffer, `${TASKPANE}: ${key} (${sprache}) fehlt im Woerterbuch`).not.toBeNull();
  let wert = (treffer?.[1] ?? "").replace(/\\"/g, '"');
  expect(wert.length, `${TASKPANE}: ${key} ist leer`).toBeGreaterThan(0);
  for (const [k, v] of Object.entries(vars)) {
    wert = wert.replace(`{${k}}`, v);
  }
  return wert;
}

function zeitDe(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const NUTZER: Sitzung = { id: "u-pedi", name: "Pedi" };

function erlaubt(over: Partial<Lage> = {}): Lage {
  return {
    me: NUTZER,
    bilder: { status: 200, koerper: suchantwort([TREFFER_A, TREFFER_B]) },
    markierung: MARKIERUNG,
    raw: "ok",
    ...over,
  };
}

async function bildSuchen(): Promise<void> {
  el("m5-bild-btn").click();
  await leerlauf(40);
}

function karten(): { length: number; [i: number]: El } {
  return el("m5-bild-karte").querySelectorAll("[data-m5-treffer]");
}

function sprache(code: "de" | "en" | "nl"): void {
  el(`lang-${code}`).click();
}

describe("JOB 3096 · M5 · das Bild im Word-Panel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    bilderAbrufe = [];
    rawAbrufe = [];
    meAbrufe = 0;
    logoutAbrufe = 0;
    wordRunGesamt = 0;
    bilderEingefuegt = [];
    absaetzeEingefuegt = [];
    insertText = 0;
    setSelected = 0;
    zuhoerer = [];
  });

  afterEach(() => {
    for (const z of zuhoerer) {
      umgebung.window.removeEventListener(z.typ, z.fn);
    }
    zuhoerer = [];
    umgebung.window.Office = undefined;
    umgebung.window.Word = undefined;
    umgebung.document.body.innerHTML = "";
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("P0 · vor dem Klick: der Knopf steht neben der Ruhe-Mitte, aber es gibt keinen Abruf, keine Karte, keinen Schreibaufruf", async () => {
    await ladeFenster(erlaubt());
    expect(sichtbar("m5-bild-btn"), "Der Knopf „Bild dazu?“ fehlt").toBe(true);
    expect(el("m5-bild-btn").textContent).toBe(wortlaut("m5BildCta"));
    expect(el("m5-bild-btn").disabled).toBe(false);
    // Der Knopf wohnt NEBEN der Ruhe-Mitte in der Fragen-Flaeche, nicht in ihr: die Mitte traegt
    // nur Lupe und den EINEN Satz (JOB 3056 R4, k1-sitzungslagen) — wie der KA3-/N1-Block.
    expect(el("section-ask").querySelectorAll("#m5-bild-btn").length).toBe(1);
    expect(el("ask-ruhe").querySelectorAll("#m5-bild-btn").length).toBe(0);
    expect(sichtbar("m5-bild-block")).toBe(true);
    expect(sichtbar("m5-bild-karte")).toBe(false);
    expect(bilderAbrufe).toHaveLength(0);
    expect(schreibaufrufe()).toBe(0);
  });

  it("P1 · Markierung → Klick → GET /api/library/images?q=<Markierung> mit Sitzung → Karten mit Bild, Unterschrift und Herkunft", async () => {
    await ladeFenster(erlaubt());
    await bildSuchen();
    expect(bilderAbrufe).toHaveLength(1);
    expect(bilderAbrufe[0]?.url).toBe(
      `/api/library/images?q=${encodeURIComponent(MARKIERUNG)}&limit=20`,
    );
    expect(bilderAbrufe[0]?.init?.credentials).toBe("include");
    expect(sichtbar("m5-bild-karte")).toBe(true);
    const liste = karten();
    expect(liste.length).toBe(2);
    // Karte A: Bild aus der data-URL, Original-Unterschrift, Benennung, Herkunft mit Pruefstand.
    const a = liste[0] as El;
    const bildA = a.querySelector("img");
    expect(bildA, "Karte A traegt kein Bild").not.toBeNull();
    expect(bildA?.getAttribute("src")).toBe(DATA_URL);
    expect(a.textContent).toContain(TREFFER_A.caption);
    expect(a.textContent).toContain(wortlaut("m5BildBenennung", "de", { name: "profil-oben.png" }));
    expect(a.textContent).toContain(
      wortlaut("m5BildHerkunftZeile", "de", {
        titel: TREFFER_A.koTitel,
        version: "3",
        stufe: wortlaut("askStatusValidiert"),
      }),
    );
    expect(a.textContent).toContain(
      wortlaut("m5BildGefunden", "de", { felder: wortlaut("m5BildFeldBeschreibung") }),
    );
    // Der Weg zum Objekt ist ein Link auf die echte Detailroute.
    expect(a.querySelector("a")?.getAttribute("href")).toContain("/wissen/ko-a");
    // Karte B: ohne Beschreibung sagt die Karte das — kein erfundener Text, kein Platzhalterbild.
    const b = liste[1] as El;
    expect(b.querySelector("img")?.getAttribute("src")).toBe(RAW_PFAD);
    expect(b.textContent).toContain(wortlaut("m5BildOhneBeschreibung"));
    expect(b.textContent).toContain(
      wortlaut("m5BildHerkunftZeile", "de", {
        titel: TREFFER_B.koTitel,
        version: "1",
        stufe: wortlaut("askStatusOffen"),
      }),
    );
    expect(b.textContent).toContain(
      wortlaut("m5BildGefunden", "de", { felder: wortlaut("m5BildFeldName") }),
    );
    // Der Kopf der Karte nennt Suchwort und Pruefzeit des Servers.
    expect(el("m5-bild-karte").textContent).toContain(
      wortlaut("m5BildTitel", "de", { q: MARKIERUNG, zeit: zeitDe(GEPRUEFT) }),
    );
    expect(el("m5-bild-karte").textContent).not.toContain(wortlaut("m5BildGedeckelt"));
  });

  it("P2 · Treffer sind ein Angebot: OHNE Klick auf „In Word einfuegen“ geht kein Schreibaufruf an Word", async () => {
    await ladeFenster(erlaubt());
    await bildSuchen();
    expect(karten().length).toBe(2);
    // Word.run wird beim Start auch vom Dokument-Begriffsbild (KA1) gerufen — der Massstab fuer
    // „nichts geschrieben" sind deshalb die Schreibaufrufe, nicht die Zahl der Word.run-Laeufe.
    const laeufeVorher = wordRunGesamt;
    await leerlauf(20);
    expect(schreibaufrufe(), "Es wurde ohne Klick in Word geschrieben").toBe(0);
    expect(wordRunGesamt - laeufeVorher).toBe(0);
    expect(rawAbrufe, "Bilddaten wurden ohne Klick nachgeladen").toHaveLength(0);
  });

  it("P3 · Klick auf Karte A → EIN Word.run: Bild (Base64 der data-URL), Unterschrift als Absatz darunter, Herkunftszeile als letzter Absatz", async () => {
    await ladeFenster(erlaubt());
    await bildSuchen();
    const a = karten()[0] as El;
    const knopf = a.querySelector("[data-m5-einfuegen]");
    expect(knopf, "Karte A hat keinen Einfuegen-Knopf").not.toBeNull();
    expect(knopf?.textContent).toBe(wortlaut("m5BildEinfuegen"));
    const laeufeVorher = wordRunGesamt;
    knopf?.click();
    await leerlauf(40);
    expect(wordRunGesamt - laeufeVorher, "Genau EIN Word.run fuer das Einfuegen").toBe(1);
    expect(bilderEingefuegt).toHaveLength(1);
    expect(bilderEingefuegt[0]?.base64).toBe(PNG_BASE64);
    // Reihenfolge der Absaetze: der Bildabsatz (leer, nach der Markierung), die Unterschrift, die Herkunft.
    expect(absaetzeEingefuegt.map((p) => p.text)).toEqual([
      "",
      TREFFER_A.caption,
      wortlaut("m5BildHerkunftZeile", "de", {
        titel: TREFFER_A.koTitel,
        version: "3",
        stufe: wortlaut("askStatusValidiert"),
      }),
    ]);
    expect(absaetzeEingefuegt.map((p) => p.ort)).toEqual(["After", "After", "After"]);
    expect(bilderEingefuegt[0]?.ort).toBe("End");
    // Kein Textweg, kein Rueckfall ueber setSelectedDataAsync — ein Bild ist kein Text.
    expect(insertText + setSelected).toBe(0);
    // Die Karte wird nach dem Einfuegen neu gezeichnet — deshalb frisch lesen, nicht die alte Referenz.
    expect((karten()[0] as El).textContent).toContain(wortlaut("m5BildEinfuegtOk"));
  });

  it("P3b · Karte B (Bildquelle /api/objects/…/raw, ohne Beschreibung): Bytes werden mit Sitzung geladen, kein Unterschrift-Absatz, Herkunft bleibt", async () => {
    await ladeFenster(erlaubt());
    await bildSuchen();
    const b = karten()[1] as El;
    b.querySelector("[data-m5-einfuegen]")?.click();
    await leerlauf(60);
    expect(rawAbrufe).toEqual([RAW_PFAD]);
    expect(bilderEingefuegt).toHaveLength(1);
    // Base64 der gelieferten Bytes — genau das, was der Server geschickt hat.
    expect(bilderEingefuegt[0]?.base64).toBe(Buffer.from(RAW_BYTES).toString("base64"));
    expect(absaetzeEingefuegt.map((p) => p.text)).toEqual([
      "",
      wortlaut("m5BildHerkunftZeile", "de", {
        titel: TREFFER_B.koTitel,
        version: "1",
        stufe: wortlaut("askStatusOffen"),
      }),
    ]);
    expect((karten()[1] as El).textContent).toContain(wortlaut("m5BildEinfuegtOkOhne"));
  });

  it("P3c · die Bilddaten sind nicht ladbar (404) → kein Schreibaufruf, die Karte sagt es", async () => {
    await ladeFenster(erlaubt({ raw: 404 }));
    await bildSuchen();
    const b = karten()[1] as El;
    const laeufeVorher = wordRunGesamt;
    b.querySelector("[data-m5-einfuegen]")?.click();
    await leerlauf(60);
    expect(rawAbrufe).toEqual([RAW_PFAD]);
    expect(schreibaufrufe()).toBe(0);
    expect(wordRunGesamt - laeufeVorher).toBe(0);
    expect((karten()[1] as El).textContent).toContain(
      wortlaut("m5BildEinfuegtFehlerBild", "de", {
        grund: wortlaut("m5BildGrundServer", "de", { status: "404" }),
      }),
    );
  });

  it("P4 · erfolgreich leer: „Kein Bild mit dieser Beschreibung im Bestand (geprueft <Zeit>)“ — keine Karte, kein Platzhalter", async () => {
    await ladeFenster(erlaubt({ bilder: { status: 200, koerper: suchantwort([]) } }));
    await bildSuchen();
    expect(sichtbar("m5-bild-karte")).toBe(true);
    expect(karten().length).toBe(0);
    expect(el("m5-bild-karte").querySelectorAll("img").length).toBe(0);
    expect(el("m5-bild-karte").textContent).toContain(
      wortlaut("m5BildLeer", "de", { zeit: zeitDe(GEPRUEFT), q: MARKIERUNG }),
    );
  });

  it("P4b · gedeckelt: die Karte sagt „Mehr Treffer als angezeigt“ NUR bei Serverauskunft true", async () => {
    await ladeFenster(
      erlaubt({ bilder: { status: 200, koerper: suchantwort([TREFFER_A], true) } }),
    );
    await bildSuchen();
    expect(karten().length).toBe(1);
    expect(el("m5-bild-karte").textContent).toContain(wortlaut("m5BildGedeckelt"));
  });

  it("P5 · HTTP 503: „Suche nicht moeglich“ — kein „kein Bild“, und ein frueherer Stand bleibt datiert stehen", async () => {
    await ladeFenster(erlaubt());
    await bildSuchen();
    expect(karten().length).toBe(2);
    // Der Server faellt aus — derselbe Klick, dieselbe Sitzung.
    vi.stubGlobal("fetch", router(erlaubt({ bilder: { status: 503 } })));
    await bildSuchen();
    expect(bilderAbrufe).toHaveLength(2); // beide Router protokollieren in dieselbe Liste
    const text = el("m5-bild-karte").textContent ?? "";
    expect(text).toContain(
      wortlaut("m5BildFehlerAltStand", "de", {
        zeit: zeitDe(GEPRUEFT),
        grund: wortlaut("m5BildGrundServer", "de", { status: "503" }),
      }),
    );
    expect(text).not.toContain(
      wortlaut("m5BildLeer", "de", { zeit: zeitDe(GEPRUEFT), q: MARKIERUNG }),
    );
    // Die alten Karten sind noch da — nicht geleert.
    expect(karten().length).toBe(2);
    // Ein erneuter Versuch ist moeglich.
    expect(sichtbar("m5-bild-erneut")).toBe(true);
    expect(el("m5-bild-erneut").textContent).toBe(wortlaut("retryCta"));
  });

  it("P5b · Netzfehler ohne frueheren Stand: „Suche nicht moeglich (keine Verbindung)“, keine Karte, kein „kein Bild“", async () => {
    await ladeFenster(erlaubt({ bilder: "netz" }));
    await bildSuchen();
    const text = el("m5-bild-karte").textContent ?? "";
    expect(text).toContain(wortlaut("m5BildFehler", "de", { grund: wortlaut("m5BildGrundNetz") }));
    expect(text).not.toContain("geprüft");
    expect(karten().length).toBe(0);
  });

  it("P6 · 401/403 auf die Suche: der Satz nennt es, der alte Stand faellt (der Stand gehoert der Sitzung)", async () => {
    await ladeFenster(erlaubt());
    await bildSuchen();
    expect(karten().length).toBe(2);
    vi.stubGlobal("fetch", router(erlaubt({ bilder: { status: 403 }, me: null })));
    await bildSuchen();
    expect(karten().length, "Treffer ueberlebten HTTP 403").toBe(0);
    expect(el("m5-bild-karte").textContent).toContain(
      wortlaut("m5BildFehler", "de", { grund: wortlaut("m5BildGrundVerweigert") }),
    );
  });

  it("P6b · bestaetigter Logout verwirft Treffer und Karte", async () => {
    await ladeFenster(erlaubt({ me: [NUTZER, NUTZER, null] }));
    await bildSuchen();
    expect(karten().length).toBe(2);
    el("logout-btn").click();
    await leerlauf(40);
    expect(logoutAbrufe).toBe(1);
    expect(sichtbar("m5-bild-karte"), "Die Karte ueberlebte das Abmelden").toBe(false);
    expect(karten().length).toBe(0);
  });

  it("P7 · ohne Markierung: kein Abruf, sondern der ehrliche Satz", async () => {
    await ladeFenster(erlaubt({ markierung: "   " }));
    await bildSuchen();
    expect(bilderAbrufe).toHaveLength(0);
    expect(el("m5-bild-karte").textContent).toContain(wortlaut("m5BildKeineMarkierung"));
    expect(karten().length).toBe(0);
  });

  it("P8 · beschaedigte Trefferdaten (Herkunft fehlt) sind eine fehlgeschlagene Suche, keine erfolgreiche Leere", async () => {
    const kaputt = {
      treffer: [{ imageId: "x", caption: "Schraube", thumbnailUrl: DATA_URL }],
      geprueft: GEPRUEFT,
      gedeckelt: false,
    };
    await ladeFenster(erlaubt({ bilder: { status: 200, koerper: kaputt } }));
    await bildSuchen();
    const text = el("m5-bild-karte").textContent ?? "";
    expect(text).toContain(wortlaut("m5BildFehler", "de", { grund: wortlaut("m5BildGrundDaten") }));
    expect(text).not.toContain(
      wortlaut("m5BildLeer", "de", { zeit: zeitDe(GEPRUEFT), q: MARKIERUNG }),
    );
    expect(karten().length).toBe(0);
    expect(el("m5-bild-karte").querySelectorAll("img").length).toBe(0);
  });

  it("P9 · EN gleichwertig: Knopf, Kopf, Leersatz und die eingefuegte Herkunftszeile in Englisch", async () => {
    await ladeFenster(erlaubt());
    sprache("en");
    await leerlauf(20);
    expect(el("m5-bild-btn").textContent).toBe(wortlaut("m5BildCta", "en"));
    await bildSuchen();
    expect(el("m5-bild-karte").textContent).toContain(
      wortlaut("m5BildTitel", "en", { q: MARKIERUNG, zeit: zeitDe(GEPRUEFT) }),
    );
    (karten()[0] as El).querySelector("[data-m5-einfuegen]")?.click();
    await leerlauf(40);
    expect(absaetzeEingefuegt.map((p) => p.text)).toEqual([
      "",
      TREFFER_A.caption,
      wortlaut("m5BildHerkunftZeile", "en", {
        titel: TREFFER_A.koTitel,
        version: "3",
        stufe: wortlaut("askStatusValidiert", "en"),
      }),
    ]);
    // Leerfall auf Englisch — derselbe Weg.
    vi.stubGlobal("fetch", router(erlaubt({ bilder: { status: 200, koerper: suchantwort([]) } })));
    await bildSuchen();
    expect(el("m5-bild-karte").textContent).toContain(
      wortlaut("m5BildLeer", "en", { zeit: zeitDe(GEPRUEFT), q: MARKIERUNG }),
    );
    // Und die deutsche Fassung hat dieselben Schluessel — kein Satz nur in einer Sprache.
    for (const key of [
      "m5BildCta",
      "m5BildTitel",
      "m5BildLeer",
      "m5BildFehler",
      "m5BildHerkunftZeile",
      "m5BildEinfuegen",
      "m5BildKeineMarkierung",
    ]) {
      expect(wortlaut(key, "de")).not.toBe(wortlaut(key, "en"));
    }
  });

  it("P10 · ohne Word (Office fehlt) ist der Knopf gesperrt — ohne Word gibt es weder Markierung noch Einfuegen", async () => {
    const lage = erlaubt();
    meFolge = [lage.me as Sitzung];
    vi.stubGlobal("fetch", router(lage));
    const quelle = read(TASKPANE);
    const skriptStart = quelle.lastIndexOf("<script>");
    const skriptEnde = quelle.lastIndexOf("</script>");
    const skript = quelle.slice(skriptStart + "<script>".length, skriptEnde);
    umgebung.document.body.innerHTML = quelle.slice(
      quelle.indexOf("<body>") + "<body>".length,
      skriptStart,
    );
    umgebung.window.Office = undefined;
    umgebung.window.Word = undefined;
    new Function(skript)();
    await leerlauf(20);
    expect(el("m5-bild-btn").disabled).toBe(true);
    expect(el("m5-bild-btn").getAttribute("title")).toBe(wortlaut("noOffice"));
  });
});
