// @vitest-environment jsdom
// ================================================================================================
// JOB 3366 · T4 — DER HINWEIS IM KLARA-PANEL (Word), am VOLLSTÄNDIGEN ausgelieferten Fenster.
// ================================================================================================
//
// Bauform wie `tests/ka6-memo-panel/memo-panel-mounted.test.ts` (JOB 1153 / JOB 3091 M2): das ganze
// `taskpane.html` wird geladen, `fetch` ist ein Router über die echten Pfade, und die Frage geht
// über den ECHTEN Knopf durch den ECHTEN Ask-Weg. Gemessen wird das DOM des Fensters — nicht der
// Quelltext einer Funktion.
//
// RED-FIRST: vor diesem Auftrag gab es weder `#ask-fragment` noch `askFragment` im Fenster; P1
// scheiterte an „#ask-fragment fehlt im Aufgabenfenster".
//
// Der Gate-`tsc` läuft ohne DOM-lib; DOM-Zugriffe gehen über schmale Struktur-Typen (dieselbe
// Bauform wie memo-panel-mounted.test.ts:29-51).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

interface El {
  className: string;
  textContent: string | null;
  value: string;
  click(): void;
  dispatchEvent(ereignis: Event): boolean;
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

const FRAGE = "Wie oft wird Ventil V4 geprueft?";
const ANTWORT = "Das Ventil V4 wird jaehrlich geprueft und dann";

/** Der belegte Abbruchbefund, wie ihn der Server sendet (services/reasoner/src/types.ts). */
const BEFUND = {
  finishReason: "length",
  budgetFeld: "max_completion_tokens",
  budget: 1024,
  zeichen: ANTWORT.length,
};

let zuhoerer: Array<{ typ: string; fn: unknown }> = [];
let askAbgesetzt = 0;

function antwort(koerper: unknown, status = 200): unknown {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(koerper) };
}

/** `abbruch` steuert GENAU EIN Feld der Serverantwort — sonst ist jeder Fall identisch. */
function router(abbruch: unknown) {
  return (url: string, init?: { method?: string }) => {
    const methode = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/auth/me") {
      return Promise.resolve(antwort({ id: "u1", name: "Pruefer" }));
    }
    if (url === "/api/reasoner/status") {
      return Promise.resolve(antwort({ enabled: false, reachable: "none" }));
    }
    if (url === "/api/ask" && methode === "POST") {
      askAbgesetzt += 1;
      return Promise.resolve(
        antwort({
          result: {
            answered: true,
            answer: ANTWORT,
            sources: ["ko-1"],
            citedSources: ["ko-1"],
            trust: 70,
            evidence: { grade: "verified", sourcesConflicted: false, conflictsUnproven: false },
            ...(abbruch === undefined ? {} : { abgeschnitten: abbruch }),
          },
          gap: null,
        }),
      );
    }
    if (url.startsWith("/api/kos/")) {
      return Promise.resolve(
        antwort({
          id: "ko-1",
          title: "Pruefintervall Ventil V4",
          trust: 70,
          status: "validiert",
          version: 2,
          createdAt: "2026-08-01T10:00:00.000Z",
        }),
      );
    }
    return Promise.resolve(antwort({}, 404));
  };
}

async function leerlauf(runden = 20): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => process.nextTick(r));
  }
}

async function ladeFenster(abbruch: unknown): Promise<void> {
  vi.stubGlobal("fetch", router(abbruch));
  const quelle = read(TASKPANE);
  const skriptStart = quelle.lastIndexOf("<script>");
  const skriptEnde = quelle.lastIndexOf("</script>");
  expect(skriptStart, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(0);
  const skript = quelle.slice(skriptStart + "<script>".length, skriptEnde);
  const bodyStart = quelle.indexOf("<body>");
  expect(bodyStart).toBeGreaterThan(0);
  umgebung.document.body.innerHTML = quelle.slice(bodyStart + "<body>".length, skriptStart);
  const ASYNC_STATUS = { Succeeded: "succeeded", Failed: "failed" } as const;
  umgebung.window.Office = {
    context: {
      document: {
        url: "",
        addHandlerAsync() {
          /* kein Markierungswechsel im Pruefstand */
        },
        getSelectedDataAsync(_typ: string, fn: (r: { status: string; value: string }) => void) {
          fn({ status: ASYNC_STATUS.Succeeded, value: "" });
        },
        setSelectedDataAsync(_text: string, _opts: unknown, fn: (r: { status: string }) => void) {
          fn({ status: ASYNC_STATUS.Succeeded });
        },
      },
    },
    EventType: {},
    CoercionType: { Text: "text" },
    AsyncResultStatus: ASYNC_STATUS,
    onReady: (cb: () => void) => cb(),
  };
  const originalAdd = umgebung.window.addEventListener.bind(umgebung.window);
  umgebung.window.addEventListener = (typ: string, fn: unknown) => {
    zuhoerer.push({ typ, fn });
    originalAdd(typ, fn);
  };
  new Function(skript)();
  await leerlauf();
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
function wortlaut(key: string, sprache: "de" | "en" | "nl" = "de"): string {
  const quelle = read(TASKPANE);
  const block = quelle.indexOf(`      ${sprache}: {`, quelle.indexOf("var STRINGS = {"));
  expect(block, `${TASKPANE}: Sprachblock ${sprache} nicht gefunden`).toBeGreaterThan(0);
  const treffer = new RegExp(`^\\s*${key}: "([^"]*)"`, "m").exec(quelle.slice(block));
  expect(treffer, `${TASKPANE}: ${key} (${sprache}) fehlt im Woerterbuch`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.length, `${TASKPANE}: ${key} (${sprache}) ist leer`).toBeGreaterThan(0);
  return wert;
}

async function fragen(): Promise<void> {
  el("ask-input").value = FRAGE;
  el("ask-input").dispatchEvent(new umgebung.window.Event("input", { bubbles: true }));
  el("ask-btn").click();
  await leerlauf(40);
  expect(askAbgesetzt, "Die Frage ging nicht an /api/ask").toBeGreaterThan(0);
  expect(el("ask-answer-edit").value, "Keine Antwort im Feld").toContain(ANTWORT);
}

async function spracheWaehlen(sprache: "de" | "en" | "nl"): Promise<void> {
  el(`lang-${sprache}`).click();
  await leerlauf();
}

describe("JOB 3366 · T4 · der Fragment-Hinweis im Klara-Panel", () => {
  beforeEach(() => {
    zuhoerer = [];
    askAbgesetzt = 0;
  });

  afterEach(() => {
    for (const z of zuhoerer) {
      umgebung.window.removeEventListener(z.typ, z.fn);
    }
    zuhoerer = [];
    umgebung.window.Office = undefined;
    umgebung.document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("P0 · §9 laden: vor einer Antwort steht kein Satz — es gibt nichts, worueber er etwas sagt", async () => {
    await ladeFenster(BEFUND);
    expect(sichtbar("ask-fragment")).toBe(false);
    expect(el("ask-fragment").textContent).toBe("");
  });

  it.each(["de", "en"] as const)(
    "P1 · %s: mit Abbruchfeld steht der vollstaendige Satz an der Antwort, der Text bleibt unveraendert",
    async (sprache) => {
      await ladeFenster(BEFUND);
      await spracheWaehlen(sprache);
      await fragen();
      expect(sichtbar("ask-fragment"), "Der Satz fehlt an der Antwort").toBe(true);
      expect(el("ask-fragment").textContent).toBe(wortlaut("askFragment", sprache));
      expect(el("ask-fragment").textContent).not.toBe(
        wortlaut("askFragment", sprache === "de" ? "en" : "de"),
      );
      // Die Antwort selbst bleibt zeichengleich — der Hinweis haengt daneben, nicht im Text.
      expect(el("ask-answer-edit").value).toBe(ANTWORT);
    },
  );

  it("P2 · §9 Erfolg ohne Feld: kein Satz, und keine Gegenaussage „vollstaendig“", async () => {
    await ladeFenster(undefined);
    await fragen();
    expect(sichtbar("ask-fragment")).toBe(false);
    expect(el("ask-fragment").textContent).toBe("");
    expect(umgebung.document.body.innerHTML).not.toContain(wortlaut("askFragment"));
  });

  it.each([
    ["fremdes Feld ohne finishReason", { budget: 1024 }],
    ["blosser Wahrheitswert", true],
    ["Zeichenkette", "length"],
    ["null", null],
  ])(
    "P3 · %s wird NICHT als Befund gelesen — die Flaeche behauptet nur, was der Server gesagt hat",
    async (_name, feld) => {
      await ladeFenster(feld);
      await fragen();
      expect(sichtbar("ask-fragment")).toBe(false);
    },
  );

  it("P4 · der Satz gehoert DIESER Antwort: nach „neue Frage“ ist er weg", async () => {
    await ladeFenster(BEFUND);
    await fragen();
    expect(sichtbar("ask-fragment")).toBe(true);
    // Der Zurueck-Chevron im Kopf fuehrt in die Ruhe (askNeueFrage → resetAskResult).
    el("kw-zurueck").click();
    await leerlauf();
    expect(sichtbar("ask-fragment")).toBe(false);
    expect(el("ask-fragment").textContent).toBe("");
  });

  it("P5 · der Sprachwechsel nimmt den GEHALTENEN Satz mit, ohne die Antwort neu zu holen", async () => {
    await ladeFenster(BEFUND);
    await fragen();
    const abfragenVorher = askAbgesetzt;
    expect(el("ask-fragment").textContent).toBe(wortlaut("askFragment", "de"));
    await spracheWaehlen("en");
    expect(el("ask-fragment").textContent).toBe(wortlaut("askFragment", "en"));
    await spracheWaehlen("nl");
    expect(el("ask-fragment").textContent).toBe(wortlaut("askFragment", "nl"));
    expect(askAbgesetzt).toBe(abfragenVorher);
  });

  it("P6 · der Satz steht IN der Antwortkarte — er ist keine Fehlerkarte", async () => {
    await ladeFenster(BEFUND);
    await fragen();
    const karte = umgebung.document.getElementById("antwortkarte");
    expect(karte).not.toBeNull();
    expect(
      (karte as unknown as { innerHTML: string }).innerHTML.includes('id="ask-fragment"'),
    ).toBe(true);
  });
});
