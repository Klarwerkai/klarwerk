// @vitest-environment jsdom
// ================================================================================================
// R-0632 · DIE STUFE IM WORD-PANEL MIT EINEM KLICK — BIS ZUM GESPEICHERTEN ENTWURF.
// ================================================================================================
//
// BEN-Befund K2 zu Kandidat 27c4a92d: „Automatischer Nachweis der Panelwahl aller drei Stufen bis
// zum gespeicherten Word-Entwurf fehlt." Diese Datei liefert ihn:
//
//   · Das VOLLSTÄNDIGE ausgelieferte `taskpane.html` samt `rueckweg.js` läuft in jsdom — dieselbe
//     Bauform wie `tests/app/w1-klara-lifecycle-taskpane.test.tsx` (Markup ins Dokument, das
//     unveränderte Inline-Skript ausgeführt, nichts herausgeschnitten).
//   · Office liefert eine FESTE `.docx` (`tests/fixtures/sample.docx`) über `getFileAsync`.
//   · Jeder Abruf des Fensters geht an die ECHTE App (`buildApp` / `app.inject`), angemeldet.
//   · P1–P3: je Stufe ein Klick im Panel, dann der reguläre Weg „Ganzes Dokument übernehmen" →
//     `POST /api/drafts/from-docx`. Der Entwurf wird über `GET /api/drafts/:id` zurückgelesen:
//     exakt die gewählte Stufe und `origin: "word_addin"`.
//   · P0 GEGENPROBE: ohne Klick reist KEINE Stufe — „nicht gewählt" ist keine Wahl.
//   · H1/H2: eine gespeicherte Stufe eines Word-Entwurfs wird nur angehoben, nie gesenkt
//     (`continueDraft`); H3 grenzt ab: ein Entwurf des Blatts ist davon nicht betroffen.
//
// WAS DIESE DATEI NICHT ERSETZT: den echten Office-/Modellnachweis aus K1 (Word-Host, Bild- und
// Herkunftskette, KI-Wirkung). Der Office-Host ist hier eine Attrappe.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
const RUECKWEG_QUELLE = readFileSync(
  resolve(process.cwd(), "apps/web/public/word-addin/rueckweg.js"),
  "utf8",
);
const DOCX = new Uint8Array(readFileSync(resolve(process.cwd(), "tests/fixtures/sample.docx")));

type App = ReturnType<typeof buildApp>;
const STUFEN = ["intern", "vertraulich", "streng_vertraulich"] as const;

let app: App;
let kopf: Record<string, string>;
/** Was das Fenster an `from-docx` geschickt hat und was zurückkam — gelesen, nicht erraten. */
interface DocxAufruf {
  body: Record<string, unknown>;
  status: number;
  antwort: Record<string, unknown>;
}
let docxAufrufe: DocxAufruf[];

const zuhoerer: Array<{ ziel: EventTarget; typ: string; fn: EventListenerOrEventListenerObject }> =
  [];
function zuhoererMitschreiben(ziel: EventTarget): void {
  const original = ziel.addEventListener.bind(ziel);
  (ziel as unknown as { addEventListener: typeof original }).addEventListener = (
    typ: string,
    fn: EventListenerOrEventListenerObject,
    opts?: boolean | AddEventListenerOptions,
  ) => {
    zuhoerer.push({ ziel, typ, fn });
    original(typ, fn, opts);
  };
}

/** Eine Antwort in der Form, die das Fenster liest — aus der echten App-Antwort gebaut. */
function antwortAus(status: number, body: string, headers: Record<string, unknown>): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "",
    headers: {
      get: (name: string) => (headers[name.toLowerCase()] as string | undefined) ?? null,
    },
    json: () => Promise.resolve(body ? JSON.parse(body) : {}),
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

/** Jeder Abruf des Fensters geht an die echte App — angemeldet über den Sitzungsschlüssel. */
function bruecke(): void {
  vi.stubGlobal("fetch", async (eingabe: string, init?: RequestInit) => {
    const url = String(eingabe).replace(window.location.origin, "");
    const methode = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = { ...kopf };
    new Headers(init?.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    const res = await app.inject({
      method: methode as "GET",
      url,
      headers,
      ...(typeof init?.body === "string" ? { payload: init.body } : {}),
    });
    if (url === "/api/drafts/from-docx") {
      docxAufrufe.push({
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        status: res.statusCode,
        antwort: res.body ? (JSON.parse(res.body) as Record<string, unknown>) : {},
      });
    }
    return antwortAus(res.statusCode, res.body, res.headers as Record<string, unknown>);
  });
}

/** Der Office-Host: bereit, ohne Markierung, mit einer festen `.docx` hinter `getFileAsync`. */
function officeAttrappe(): void {
  const ok = "succeeded";
  (window as unknown as { Office?: unknown }).Office = {
    context: {
      document: {
        url: "",
        addHandlerAsync() {},
        getSelectedDataAsync(_t: string, fn: (r: { status: string; value: string }) => void) {
          fn({ status: ok, value: "" });
        },
        getFileAsync(
          _typ: string,
          _opts: unknown,
          fn: (r: { status: string; value: unknown }) => void,
        ) {
          fn({
            status: ok,
            value: {
              sliceCount: 1,
              getSliceAsync(_i: number, cb: (r: { status: string; value: unknown }) => void) {
                cb({ status: ok, value: { data: Array.from(DOCX) } });
              },
              closeAsync(cb: () => void) {
                cb();
              },
            },
          });
        },
      },
    },
    EventType: { DocumentSelectionChanged: "documentSelectionChanged" },
    CoercionType: { Text: "text", Html: "html" },
    AsyncResultStatus: { Succeeded: ok, Failed: "failed" },
    FileType: { Compressed: "compressed" },
    onReady: (cb: () => void) => cb(),
  };
}

async function ladeTaskpane(): Promise<void> {
  const skriptStart = HTML.lastIndexOf("<script>");
  const skriptEnde = HTML.lastIndexOf("</script>");
  const bodyStart = HTML.indexOf("<body>");
  expect(skriptStart).toBeGreaterThan(0);
  expect(bodyStart).toBeGreaterThan(0);
  document.body.innerHTML = HTML.slice(bodyStart + "<body>".length, skriptStart);
  officeAttrappe();
  zuhoererMitschreiben(window);
  zuhoererMitschreiben(document);
  new Function(`${RUECKWEG_QUELLE}\n${HTML.slice(skriptStart + "<script>".length, skriptEnde)}`)();
  // Bereit ist das Fenster, wenn der Dokument-Weg frei ist (Anmeldung UND Office bestätigt).
  await warteBis(() => el("capture-dokument-link").getAttribute("aria-disabled") !== "true");
}

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  expect(e, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return e as HTMLElement;
}

/** Auf ein echtes Ereignis warten (die App rechnet wirklich), mit Frist — danach rot. */
async function warteBis(bedingung: () => boolean, frist = 20_000): Promise<void> {
  const ende = Date.now() + frist;
  while (!bedingung()) {
    if (Date.now() > ende) {
      throw new Error("Zustand nicht erreicht");
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** Den Wortlaut eines Panel-Schlüssels aus dem ausgelieferten Wörterbuch lesen (erste = Deutsch). */
function wortlaut(key: string): string {
  const treffer = new RegExp(`${key}: "([^"]*)"`).exec(HTML);
  expect(treffer, `${key} fehlt im Wörterbuch`).not.toBeNull();
  return treffer?.[1] ?? "";
}

async function dokumentEinreichen(): Promise<DocxAufruf> {
  const vorher = docxAufrufe.length;
  el("capture-dokument-link").click();
  await warteBis(() => docxAufrufe.length > vorher);
  const aufruf = docxAufrufe[docxAufrufe.length - 1];
  expect(aufruf?.status, JSON.stringify(aufruf?.antwort)).toBe(201);
  return aufruf as DocxAufruf;
}

async function gespeicherterEntwurf(id: string): Promise<Record<string, unknown>> {
  const res = await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers: kopf });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { payload: Record<string, unknown> }).payload;
}

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  docxAufrufe = [];
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "r0632@example.test", password: "geheim-r0632" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "r0632@example.test", password: "geheim-r0632" },
  });
  kopf = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  bruecke();
});

afterEach(async () => {
  for (const z of zuhoerer) {
    z.ziel.removeEventListener(z.typ, z.fn);
  }
  zuhoerer.length = 0;
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = "";
  (window as unknown as { Office?: unknown }).Office = undefined;
  await app.close();
});

describe("R-0632 · die drei Stufen im Panel, je ein Klick, bis zum gespeicherten Word-Entwurf", () => {
  it("die Wahl steht im Panel: drei Knöpfe in DE beschriftet, keiner vorgewählt", async () => {
    await ladeTaskpane();
    expect(el("capture-stufe-intern").textContent).toBe(wortlaut("captureStufeIntern"));
    expect(el("capture-stufe-vertraulich").textContent).toBe(wortlaut("captureStufeVertraulich"));
    expect(el("capture-stufe-streng_vertraulich").textContent).toBe(wortlaut("captureStufeStreng"));
    for (const s of STUFEN) {
      expect(el(`capture-stufe-${s}`).getAttribute("aria-pressed")).toBe("false");
    }
  });

  for (const stufe of STUFEN) {
    it(`P · ${stufe}: ein Klick, regulär eingereicht — gespeichert exakt „${stufe}“, origin word_addin`, async () => {
      await ladeTaskpane();
      el(`capture-stufe-${stufe}`).click();
      for (const s of STUFEN) {
        expect(el(`capture-stufe-${s}`).getAttribute("aria-pressed")).toBe(
          s === stufe ? "true" : "false",
        );
      }
      const aufruf = await dokumentEinreichen();
      expect(aufruf.body.confidentiality, "das Panel schickt die gewählte Stufe nicht").toBe(stufe);
      const gespeichert = await gespeicherterEntwurf(String(aufruf.antwort.id));
      expect(gespeichert.confidentiality).toBe(stufe);
      expect(gespeichert.origin).toBe("word_addin");
    });
  }

  it("P0 · GEGENPROBE: ohne Klick reist keine Stufe — der Entwurf bleibt ohne Einstufung", async () => {
    await ladeTaskpane();
    const aufruf = await dokumentEinreichen();
    expect(Object.keys(aufruf.body)).not.toContain("confidentiality");
    const gespeichert = await gespeicherterEntwurf(String(aufruf.antwort.id));
    expect(Object.hasOwn(gespeichert, "confidentiality")).toBe(false);
    expect(gespeichert.origin).toBe("word_addin");
  });

  it("P4 · ein Wechsel der Wahl vor dem Einreichen gilt — gesendet wird die zuletzt gewählte", async () => {
    await ladeTaskpane();
    el("capture-stufe-streng_vertraulich").click();
    el("capture-stufe-vertraulich").click();
    const aufruf = await dokumentEinreichen();
    expect(aufruf.body.confidentiality).toBe("vertraulich");
  });
});

describe("R-0632 · eine gespeicherte Stufe eines Word-Entwurfs wird nur angehoben", () => {
  async function wordEntwurf(stufe: (typeof STUFEN)[number]): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers: kopf,
      payload: {
        name: "Stufe.docx",
        data: Buffer.from(DOCX).toString("base64"),
        confidentiality: stufe,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return (res.json() as { id: string }).id;
  }

  async function aendern(id: string, payload: Record<string, unknown>) {
    return app.inject({ method: "PUT", url: `/api/drafts/${id}`, headers: kopf, payload });
  }

  it("H1 · senken wird abgewiesen — die gespeicherte Stufe bleibt", async () => {
    const id = await wordEntwurf("vertraulich");
    const res = await aendern(id, { confidentiality: "intern" });
    expect(res.statusCode, res.body).toBe(400);
    expect((res.json() as { error?: string }).error).toBe("CONFIDENTIALITY_DOWNGRADE");
    expect((await gespeicherterEntwurf(id)).confidentiality).toBe("vertraulich");
  });

  it("H2 · anheben geht — und gleich bleiben auch", async () => {
    const id = await wordEntwurf("vertraulich");
    expect((await aendern(id, { confidentiality: "vertraulich" })).statusCode).toBe(200);
    const res = await aendern(id, { confidentiality: "streng_vertraulich" });
    expect(res.statusCode, res.body).toBe(200);
    expect((await gespeicherterEntwurf(id)).confidentiality).toBe("streng_vertraulich");
  });

  it("H3 · ABGRENZUNG: ein Entwurf des Blatts (nicht word_addin) bleibt frei korrigierbar", async () => {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: kopf,
      payload: { title: "Blatt", statement: "Aussage.", confidentiality: "vertraulich" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(201);
    const id = (angelegt.json() as { id: string }).id;
    const res = await aendern(id, { confidentiality: "intern" });
    expect(res.statusCode, res.body).toBe(200);
    expect((await gespeicherterEntwurf(id)).confidentiality).toBe("intern");
  });

  it("H4 · eine unbekannte Stufe an from-docx wird abgewiesen, nicht geraten", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers: kopf,
      payload: {
        name: "X.docx",
        data: Buffer.from(DOCX).toString("base64"),
        confidentiality: "geheim",
      },
    });
    expect(res.statusCode, res.body).toBe(400);
  });
});
