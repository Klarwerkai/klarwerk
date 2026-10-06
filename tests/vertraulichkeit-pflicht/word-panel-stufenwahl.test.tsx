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
//   · P0: ohne Klick sendet das Panel KEINE Stufe; gespeichert wird der Übernahme-Standard
//     „intern" (N11, BEN Nacharbeit 10).
//   · M0/M: derselbe Nachweis für den Markierungsweg (Sendeknopf → `POST /api/drafts`,
//     BEN Nacharbeit 11): ohne Klick gespeichert „intern", mit Klick genau die gewählte Stufe.
//   · H1/H2: eine gespeicherte Stufe eines Word-Entwurfs wird nur angehoben, nie gesenkt
//     (`continueDraft`); H3 grenzt ab: ein Entwurf des Blatts ist davon nicht betroffen.
//
// WAS DIESE DATEI NICHT ERSETZT: den echten Office-/Modellnachweis aus K1 (Word-Host, Bild- und
// Herkunftskette, KI-Wirkung). Der Office-Host ist hier eine Attrappe.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { panelQuelleAus } from "../support/panelquelle";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
// Seit der Zerlegung (main 38508a1e, R-1611) liegt das Fenster in `taskpane.html`, `taskpane.css`,
// `taskpane.js` und `marke.js`; gelesen wird das zusammengefügte Dokument — wie in den übrigen
// Panel-Tests (`tests/support/panelquelle.ts`).
const HTML = panelQuelleAus(resolve(process.cwd(), TASKPANE));
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
/** Nacharbeit 11: dasselbe für den Markierungsweg (`POST /api/drafts`). */
let markierungsAufrufe: DocxAufruf[];
/** Was Word als Markierung meldet — leer heißt: nichts markiert (Ausgangslage aller P-Fälle). */
let markierung = "";
const MARKIERUNG = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";

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
    if (url === "/api/drafts" && methode === "POST") {
      markierungsAufrufe.push({
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
        getSelectedDataAsync(t: string, fn: (r: { status: string; value: string }) => void) {
          // Nacharbeit 11: mit Markierung liefert Word sie als Text bzw. als HTML-Absatz.
          const wert = markierung === "" ? "" : t === "html" ? `<p>${markierung}</p>` : markierung;
          fn({ status: ok, value: wert });
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

/** Der Markierungsweg: der Sendeknopf („Übernehmen") → `POST /api/drafts`, origin word_addin. */
async function markierungEinreichen(): Promise<DocxAufruf> {
  const knopf = el("send-btn") as HTMLButtonElement;
  await warteBis(() => !knopf.disabled);
  const vorher = markierungsAufrufe.length;
  knopf.click();
  await warteBis(() => markierungsAufrufe.length > vorher);
  const aufruf = markierungsAufrufe[markierungsAufrufe.length - 1];
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
  markierungsAufrufe = [];
  markierung = "";
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

  // BEN, Nacharbeit 10 (N11, jüngere Pedi-Entscheidung vom 05.09.): ohne Panelwahl speichert die
  // Word-Übernahme den Übernahme-Standard „intern" — das Panel selbst sendet weiterhin keine Stufe.
  it("P0 · ohne Klick sendet das Panel keine Stufe — der Server speichert den Übernahme-Standard intern", async () => {
    await ladeTaskpane();
    const aufruf = await dokumentEinreichen();
    expect(Object.keys(aufruf.body)).not.toContain("confidentiality");
    const gespeichert = await gespeicherterEntwurf(String(aufruf.antwort.id));
    expect(gespeichert.confidentiality).toBe("intern");
    expect(gespeichert.origin).toBe("word_addin");
  });

  it("P4 · ein Wechsel der Wahl vor dem Einreichen gilt — gesendet wird die zuletzt gewählte", async () => {
    await ladeTaskpane();
    el("capture-stufe-streng_vertraulich").click();
    el("capture-stufe-vertraulich").click();
    const aufruf = await dokumentEinreichen();
    expect(aufruf.body.confidentiality).toBe("vertraulich");
  });

  // BEN, Nacharbeit 11 (K6/N11): der ZWEITE Word-Übernahmeweg — die Markierung über den Sendeknopf
  // und `POST /api/drafts`. Ohne Panelwahl gilt derselbe Übernahme-Standard wie am Dokumentweg.
  it("M0 · Markierung ohne Klick: das Panel sendet keine Stufe — gespeichert wird intern", async () => {
    markierung = MARKIERUNG;
    await ladeTaskpane();
    const aufruf = await markierungEinreichen();
    expect(aufruf.body.origin).toBe("word_addin");
    expect(Object.keys(aufruf.body)).not.toContain("confidentiality");
    const gespeichert = await gespeicherterEntwurf(String(aufruf.antwort.id));
    expect(gespeichert.confidentiality).toBe("intern");
    expect(gespeichert.origin).toBe("word_addin");
  });

  for (const stufe of ["vertraulich", "streng_vertraulich"] as const) {
    it(`M · Markierung mit Klick auf ${stufe}: genau diese Stufe reist und bleibt gespeichert`, async () => {
      markierung = MARKIERUNG;
      await ladeTaskpane();
      el(`capture-stufe-${stufe}`).click();
      const aufruf = await markierungEinreichen();
      expect(aufruf.body.confidentiality).toBe(stufe);
      const gespeichert = await gespeicherterEntwurf(String(aufruf.antwort.id));
      expect(gespeichert.confidentiality).toBe(stufe);
      expect(gespeichert.origin).toBe("word_addin");
    });
  }
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

  // BEN, Nacharbeit 5: die Sperre hing an der ÄNDERBAREN Herkunft in der Nutzlast. Ein vorgeschaltetes
  // `origin: "frontdoor"` ließ das Senken im nächsten Aufruf durch. Jetzt trägt der Entwurf die
  // unveränderliche Marke `stufeNurAnheben` (Draft, nicht Payload).
  it("H5 · erst die Herkunft auf frontdoor, dann senken: das Senken scheitert weiter, GET bleibt vertraulich", async () => {
    const id = await wordEntwurf("vertraulich");
    const umetikettiert = await aendern(id, { origin: "frontdoor" });
    expect(umetikettiert.statusCode, umetikettiert.body).toBe(200);

    const gesenkt = await aendern(id, { confidentiality: "intern" });
    expect(gesenkt.statusCode, gesenkt.body).toBe(400);
    expect((gesenkt.json() as { error?: string }).error).toBe("CONFIDENTIALITY_DOWNGRADE");
    expect((await gespeicherterEntwurf(id)).confidentiality).toBe("vertraulich");

    // Gleichbleiben und Anheben gehen weiterhin — die Sperre verbietet nur das Senken.
    expect((await aendern(id, { confidentiality: "vertraulich" })).statusCode).toBe(200);
    const angehoben = await aendern(id, { confidentiality: "streng_vertraulich" });
    expect(angehoben.statusCode, angehoben.body).toBe(200);
    expect((await gespeicherterEntwurf(id)).confidentiality).toBe("streng_vertraulich");
  });

  it("H6 · auch Herkunft UND Senken in EINEM Aufruf scheitern", async () => {
    const id = await wordEntwurf("vertraulich");
    const res = await aendern(id, { origin: "frontdoor", confidentiality: "intern" });
    expect(res.statusCode, res.body).toBe(400);
    expect((await gespeicherterEntwurf(id)).confidentiality).toBe("vertraulich");
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
