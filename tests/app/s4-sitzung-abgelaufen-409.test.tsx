// @vitest-environment jsdom
// WORD-SENDESPERRE: Kontrollfall KONTROLLE-01 über den reparierten normalen Helfer.
// Keine Ask-/Schreibwiederholung: nur Status/Sitzungsregistrierung werden beobachtet.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { istFrageAufruf } from "../support/frageweg";
import {
  type Antwort,
  type Lauf,
  HTML,
  aufloesung,
  el,
  panelAbraeumen,
  panelStarten,
  ruhe,
  sicht,
  wortlaut,
} from "./k1-panel-lauf";
import { splitTaskpane } from "./klara-panel-fixture";

const echtesJetzt = Date.now;
let versatzMs = 0;
const MIN_MS = Number(/var WORD_ADDIN_LOGIN_POLL_INTERVAL_MS = (\d+);/.exec(HTML)?.[1]);
const FRAGE = "Diese fiktive Eingabe bleibt erhalten.";
type AntwortFn = (nummer: number) => Antwort;
interface Stand {
  status: AntwortFn;
  session?: (nummer: number, body: Record<string, unknown>) => Antwort;
  me?: AntwortFn;
  posts: number;
  reads: number;
  meReads: number;
  headers: Array<Record<string, string>>;
  bodies: Array<Record<string, unknown>>;
}

function starten(status: AntwortFn, session?: Stand["session"]): { lauf: Lauf; stand: Stand } {
  const stand: Stand = {
    status,
    posts: 0,
    reads: 0,
    meReads: 0,
    headers: [],
    bodies: [],
    ...(session ? { session } : {}),
  };
  const lauf = panelStarten((url, methode, body, headers): Antwort => {
    if (url === "/api/auth/me") {
      stand.meReads += 1;
      return (
        stand.me?.(stand.meReads) ?? {
          status: 200,
          body: { id: "konto-1", name: "Fiktiv", role: "experte" },
        }
      );
    }
    if (url === "/api/auth/logout") {
      stand.me = () => ({ status: 401 });
      return { status: 200, body: {} };
    }
    if (url === "/api/reasoner/status")
      return { status: 200, body: { enabled: false, reachable: "none" } };
    if (methode === "HEAD") return { status: 200 };
    if (url === "/api/klara/sessions" && methode === "POST") {
      stand.posts += 1;
      const payload = body as Record<string, unknown>;
      stand.bodies.push(payload);
      return stand.session?.(stand.posts, payload) ?? sitzung(stand.posts, payload);
    }
    if (url === "/api/klara/ai-status") {
      stand.reads += 1;
      stand.headers.push({ ...headers });
      return stand.status(stand.reads);
    }
    if (url.endsWith("/close")) return { status: 200, body: {} };
    return { status: 404 };
  });
  return { lauf, stand };
}

function sitzung(nummer: number, body: Record<string, unknown>): Exclude<Antwort, string> {
  return {
    status: 201,
    body: sicht({
      sessionId: `sess-${nummer}`,
      documentContextId: `doc-${nummer}`,
      addinInstanceId: body.addinInstanceId,
      resolution: aufloesung(),
    }),
  };
}
const gut = (): Antwort => ({ status: 200, body: aufloesung() });
function knopf(): HTMLButtonElement {
  return el<HTMLButtonElement>("ask-btn");
}
function eingabe(): HTMLTextAreaElement {
  return el<HTMLTextAreaElement>("ask-input");
}
function tippen(): void {
  eingabe().value = FRAGE;
  eingabe().dispatchEvent(new Event("input", { bubbles: true }));
}
function keineFrage(lauf: Lauf): void {
  expect(lauf.aufrufe.filter((a) => a.methode === "POST" && istFrageAufruf(a.url))).toHaveLength(0);
}
function fokus(ms = 4_000): void {
  versatzMs += ms;
  window.dispatchEvent(new Event("focus"));
}
function dokument(url: string): void {
  const w = window as unknown as { Office: { context: { document: { url: string } } } };
  w.Office.context.document.url = url;
}
function text(code: string, key: string): string {
  const start = HTML.indexOf(`      ${code}: {`);
  const ende = HTML.indexOf("\n      },", start);
  const wert = new RegExp(`^\\s*${key}: "([^"]*)"`, "m").exec(HTML.slice(start, ende))?.[1];
  expect(wert).toBeTruthy();
  return wert ?? "";
}

beforeEach(() => {
  versatzMs = 0;
  vi.spyOn(Date, "now").mockImplementation(() => echtesJetzt() + versatzMs);
});
afterEach(() => {
  window.dispatchEvent(new Event("pagehide"));
  panelAbraeumen();
  vi.restoreAllMocks();
  versatzMs = 0;
});

describe("A3: abgelaufene S4-Sitzung sicher und begrenzt erholen", () => {
  it.each([404, 409])(
    "%i: genau eine neue Registrierung; gehaltene Zwischenstände bleiben gesperrt und bewahren den Entwurf",
    async (code) => {
      const { lauf, stand } = starten((n) =>
        n === 1 ? gut() : n === 2 ? { status: code } : n === 3 ? "haengt" : gut(),
      );
      await ruhe();
      expect(stand.posts).toBe(1);
      expect(knopf().disabled).toBe(false);
      tippen();
      stand.session = (n, body) => (n === 2 ? "haengt" : sitzung(n, body));
      const aenderungen: MutationRecord[] = [];
      const observer = new MutationObserver((records) => aenderungen.push(...records));
      observer.observe(knopf(), {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ["disabled"],
      });
      try {
        fokus(301_000);
        await ruhe();
        expect(stand.posts).toBe(2);
        expect(stand.reads).toBe(2);
        expect(knopf().disabled).toBe(true);
        expect(eingabe().value).toBe(FRAGE);
        keineFrage(lauf);
        lauf.freigeben(0, sitzung(2, stand.bodies[1] ?? {}));
        await ruhe();
        expect(stand.reads).toBe(3);
        fokus();
        fokus();
        await ruhe();
        expect(stand.reads).toBe(3);
        expect(stand.headers[2]?.["x-klara-session"]).toBe("sess-2");
        expect(stand.headers[2]?.["x-klara-document"]).toBe("doc-2");
        expect(stand.headers[2]?.["x-klara-instance"]).toBe(stand.bodies[1]?.addinInstanceId);
        expect(stand.bodies[1]?.documentDescriptor).toEqual(stand.bodies[0]?.documentDescriptor);
        expect(knopf().disabled).toBe(true);
        expect(eingabe().value).toBe(FRAGE);
        // Jede zweite Hinzufügung hätte eine zwischenzeitliche Entfernung der Sperre bewiesen.
        expect(aenderungen.filter((m) => m.oldValue === null)).toHaveLength(1);
        const resolution =
          code === 409
            ? aufloesung({ executionAllowed: false, blockedReason: "policy_incomplete" })
            : aufloesung();
        lauf.freigeben(1, { status: 200, body: resolution });
        await ruhe();
        if (code === 409) {
          expect(knopf().disabled).toBe(true);
          for (const sprache of ["de", "en", "nl"]) {
            el(`lang-${sprache}`).click();
            await ruhe();
            expect(knopf().title).toBe(text(sprache, "s4ReasonPolicyIncomplete"));
          }
          fokus();
          await ruhe();
        }
        expect(knopf().disabled).toBe(false);
        expect(knopf().title).toBe("");
        expect(eingabe().value).toBe(FRAGE);
        expect(stand.posts).toBe(2);
        keineFrage(lauf);
      } finally {
        observer.disconnect();
      }
    },
  );

  it("401 prüft die Anmeldung frisch; echte Abmeldung erhält den Text und erzeugt keine neue Sitzung", async () => {
    const { lauf, stand } = starten((n) => (n === 1 ? gut() : { status: 401 }));
    await ruhe();
    tippen();
    const vorher = stand.meReads;
    stand.me = () => ({ status: 401 });
    fokus(301_000);
    await ruhe();
    expect(stand.meReads).toBe(vorher + 1);
    expect(el("session-status").textContent).toBe(wortlaut("sessionOff"));
    expect(knopf().title).toBe(wortlaut("sessionOff"));
    expect(knopf().disabled).toBe(true);
    expect(eingabe().value).toBe(FRAGE);
    expect(stand.posts).toBe(1);
    fokus();
    await ruhe();
    expect(stand.meReads).toBe(vorher + 1);
    expect(stand.posts).toBe(1);
    keineFrage(lauf);
  });

  it("401 bei weiter gültiger Anmeldung ersetzt die alte Bindung einmal und erreicht einen frischen erlaubten200-Status", async () => {
    const { lauf, stand } = starten((n) => (n === 2 ? { status: 401 } : gut()));
    await ruhe();
    const vorher = stand.meReads;
    fokus(301_000);
    await ruhe();
    expect(stand.meReads).toBe(vorher + 1);
    expect(stand.posts).toBe(2);
    expect(stand.headers.at(-1)?.["x-klara-session"]).toBe("sess-2");
    expect(knopf().disabled).toBe(false);
    keineFrage(lauf);
  });

  it.each([404, 409, 401])(
    "wiederholte%i erzeugen trotz weiterer Fokusanlässe keine Registrierungs-/Anmeldeschleife",
    async (code) => {
      const { lauf, stand } = starten((n) => (n === 1 ? gut() : { status: code }));
      await ruhe();
      const vorher = stand.meReads;
      if (code === 401) stand.session = (n, body) => (n > 1 ? { status: 401 } : sitzung(n, body));
      fokus(301_000);
      await ruhe();
      for (let n = 0; n < 4; n += 1) {
        fokus();
        await ruhe();
      }
      expect(stand.posts).toBe(2);
      expect(stand.meReads).toBe(vorher + (code === 401 ? 1 : 0));
      expect(knopf().disabled).toBe(true);
      keineFrage(lauf);
    },
  );

  it("404/409 bereits beim Start werden einmal nach der vorhandenen Mindestspanne ersetzt", async () => {
    expect(MIN_MS).toBeGreaterThan(0);
    for (const code of [404, 409]) {
      const { lauf, stand } = starten(
        () => gut(),
        (n, body) => (n === 1 ? { status: code } : sitzung(n, body)),
      );
      await ruhe();
      expect(stand.posts).toBe(1);
      expect(knopf().disabled).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, MIN_MS + 30));
      await ruhe();
      expect(stand.posts).toBe(2);
      expect(knopf().disabled).toBe(false);
      keineFrage(lauf);
      window.dispatchEvent(new Event("pagehide"));
      panelAbraeumen();
    }
  });

  it("eine verspätete erlaubte Statusantwort nach Logout reaktiviert keine Sitzung und startet keinen Ersatz", async () => {
    const { lauf, stand } = starten((n) => (n === 1 ? gut() : "haengt"));
    await ruhe();
    fokus(301_000);
    await ruhe();
    el("logout-btn").click();
    await ruhe();
    lauf.freigeben(0, { status: 200, body: aufloesung() });
    await ruhe();
    expect(stand.posts).toBe(1);
    expect(knopf().disabled).toBe(true);
    expect(el("session-status").textContent).toBe(wortlaut("sessionOff"));
    keineFrage(lauf);
  });

  it("Dokumentwechsel während des Ersatz-POST verwirft dessen Antwort statt die alte Bindung zu reaktivieren", async () => {
    const { lauf, stand } = starten((n) => (n === 1 ? gut() : { status: 409 }));
    await ruhe();
    stand.session = (n, body) => (n === 2 ? "haengt" : sitzung(n, body));
    fokus(301_000);
    await ruhe();
    dokument("https://fiktiv.invalid/anderes-dokument.docx");
    lauf.freigeben(0, sitzung(2, stand.bodies[1] ?? {}));
    await ruhe();
    expect(stand.posts).toBe(2);
    expect(stand.reads).toBe(2);
    expect(knopf().disabled).toBe(true);
    expect(knopf().title).toBe(wortlaut("s4StateGesperrtLokal"));
    keineFrage(lauf);
  });

  it("Schließen während eines gehaltenen Startaufrufs verhindert Status und erneute Registrierung", async () => {
    const { lauf, stand } = starten(
      () => gut(),
      () => "haengt",
    );
    await ruhe();
    window.dispatchEvent(new Event("pagehide"));
    lauf.freigeben(0, sitzung(1, stand.bodies[0] ?? {}));
    await ruhe();
    expect(stand.posts).toBe(1);
    expect(stand.reads).toBe(0);
    fokus();
    await ruhe();
    expect(stand.posts).toBe(1);
    keineFrage(lauf);
  });

  it("normaler Lader sammelt alle Inline-Blöcke in Reihenfolge, behält Markup und verschluckt Syntaxfehler nicht", () => {
    const html =
      '<html><head><script>var erster = 1;</script><script src="fremd.js">throw new Error("extern");</script></head><body><p>vorher</p><script>var zweiter = erster + 1;</script><p>nachher</p><script src="anderes.js"></script><script>var dritter = zweiter + 1;</script></body></html>';
    const { markup, script } = splitTaskpane(html);
    expect(markup).toContain("<p>vorher</p>");
    expect(markup).toContain("<p>nachher</p>");
    expect(markup).not.toContain("<script");
    expect(script).not.toContain('throw new Error("extern")');
    expect(script.indexOf("var erster")).toBeLessThan(script.indexOf("var zweiter"));
    expect(script.indexOf("var zweiter")).toBeLessThan(script.indexOf("var dritter"));
    expect(() => new Function(script)).not.toThrow();
    const kaputt = splitTaskpane("<body><script>const = ;</script></body>");
    expect(() => new Function(kaputt.script)).toThrow(SyntaxError);
  });
});
