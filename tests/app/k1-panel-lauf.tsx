// ================================================================================================
// JOB 3056 Runde 4 — DER PANEL-LAUF FUER DIE DREI LAUFZEITTESTS (Sitzungslagen, Abmelden, Fussnoten).
// ================================================================================================
//
// Dieselbe Bauform wie tests/app/mega36-word-ausgaenge.test.tsx und w1-klara-lifecycle-taskpane:
// das VOLLSTAENDIGE Aufgabenfenster (apps/web/public/word-addin/taskpane.html) laeuft in jsdom,
// nichts wird herausgeschnitten; gemessen wird nur, was im DOM steht und welche Abrufe hinausgehen.
// Ein Test ueberschreibt je Fall den Router (`bedienen`), sonst nichts. Die Lebenszyklus-Zuhoerer
// (focus, pagehide, visibilitychange) werden mitgeschrieben und nach jedem Fall entfernt — jsdom
// teilt EIN `window` ueber alle Faelle einer Datei (dieselbe Lehre wie im Lebenszyklus-Test).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "vitest";

export const TASKPANE = "apps/web/public/word-addin/taskpane.html";
export const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

export interface Aufruf {
  url: string;
  methode: string;
  body: unknown;
}

export type Antwort = { status: number; body?: unknown } | "netz" | "haengt";
export type Router = (url: string, methode: string, body: unknown) => Antwort;

export interface Lauf {
  aufrufe: Aufruf[];
  /** Haengende Antworten (`"haengt"`), in Reihenfolge — `freigeben(i, antwort)` loest sie auf. */
  freigeben(index: number, antwort: { status: number; body?: unknown }): void;
  offen(): number;
}

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

function antwortObjekt(a: { status: number; body?: unknown }): Response {
  return {
    ok: a.status >= 200 && a.status < 300,
    status: a.status,
    headers: { get: () => null },
    json: () => Promise.resolve(a.body ?? {}),
  } as unknown as Response;
}

/**
 * Laedt das Aufgabenfenster mit einer Office-Attrappe wie in mega36 (onReady sofort, leere
 * Markierung, `window.open` liefert ein Fenster-Handle) und dem uebergebenen Router.
 */
export function panelStarten(bedienen: Router): Lauf {
  const bodyStart = HTML.indexOf("<body>") + "<body>".length;
  const bodyEnd = HTML.indexOf("</body>");
  const body = HTML.slice(bodyStart, bodyEnd);
  const skriptStart = body.indexOf("<script>") + "<script>".length;
  const skriptEnd = body.lastIndexOf("</script>");
  const skript = body.slice(skriptStart, skriptEnd);
  expect(skript.length, `${TASKPANE}: Inline-Skript nicht gefunden`).toBeGreaterThan(1000);
  document.body.innerHTML = body.slice(0, body.indexOf("<script>"));

  const aufrufe: Aufruf[] = [];
  const haengend: Array<(r: Response) => void> = [];
  const w = window as unknown as Record<string, unknown>;
  w.fetch = (url: string, init?: { method?: string; body?: string }): Promise<Response> => {
    const methode = (init?.method ?? "GET").toUpperCase();
    const koerper = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    aufrufe.push({ url, methode, body: koerper });
    const antwort = bedienen(url, methode, koerper);
    if (antwort === "netz") {
      return Promise.reject(new TypeError("Failed to fetch"));
    }
    if (antwort === "haengt") {
      return new Promise<Response>((res) => {
        haengend.push(res);
      });
    }
    return Promise.resolve(antwortObjekt(antwort));
  };
  w.Office = {
    onReady: (cb: () => void) => cb(),
    CoercionType: { Text: "text", Html: "html" },
    AsyncResultStatus: { Succeeded: "succeeded", Failed: "failed" },
    context: {
      document: {
        url: "",
        getSelectedDataAsync: (_c: unknown, cb: (r: unknown) => void) =>
          cb({ status: "succeeded", value: "" }),
        setSelectedDataAsync: (_t: string, _o: unknown, cb: (r: unknown) => void) =>
          cb({ status: "succeeded" }),
      },
    },
  };
  // Das Anmelde-Fenster: ein Handle, damit der Poll-Lauf beginnt (kein Popup-Blocker-Fall).
  w.open = () => ({ close: () => undefined });

  zuhoererMitschreiben(window);
  zuhoererMitschreiben(document);
  new Function(skript)();
  return {
    aufrufe,
    freigeben(index, antwort) {
      const res = haengend[index];
      expect(res, `keine haengende Antwort Nr. ${index}`).toBeDefined();
      res?.(antwortObjekt(antwort));
    },
    offen: () => haengend.length,
  };
}

/** Nach jedem Fall: Zuhoerer der Fensterinstanz entfernen, DOM leeren. */
export function panelAbraeumen(): void {
  for (const z of zuhoerer) {
    z.ziel.removeEventListener(z.typ, z.fn);
  }
  zuhoerer.length = 0;
  document.body.innerHTML = "";
}

/** Alle anstehenden Promise-Ketten und Null-Timer abarbeiten lassen. */
export async function ruhe(runden = 12): Promise<void> {
  for (let i = 0; i < runden; i += 1) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}

export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  expect(node, `#${id} fehlt im Aufgabenfenster`).not.toBeNull();
  return node as T;
}

/**
 * Sichtbar im Sinne des Panels: weder das Element noch ein Vorfahre traegt die Klasse `hidden`
 * (das Panel blendet ausschliesslich ueber diese Klasse aus; `display:none` steht im Stilblock).
 * SVG-Elemente tragen die Klasse als Attribut — deshalb `getAttribute`, nicht `className`.
 */
export function sichtbar(element: Element | null): boolean {
  for (let e: Element | null = element; e && e !== document.body; e = e.parentElement) {
    if ((e.getAttribute("class") ?? "").split(/\s+/).includes("hidden")) return false;
  }
  return element !== null;
}

/** Die ids der sichtbaren Knoepfe unter einem Element — die Zaehlung „genau eine Aktion". */
export function sichtbareKnoepfe(wurzel: Element): string[] {
  return [...wurzel.querySelectorAll("button, a[href]")]
    .filter((k) => sichtbar(k))
    .map((k) => k.id || k.tagName.toLowerCase());
}

/** Der sichtbare Text unter einem Element (Textknoten sichtbarer Elemente, leerraumnormiert) —
 *  OHNE Knopfbeschriftungen: die zaehlt `sichtbareKnoepfe` als Aktion, nicht als Satz. */
export function sichtbarerText(wurzel: Element): string {
  const teile: string[] = [];
  const walker = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    const eltern = n.parentElement;
    if (t && sichtbar(eltern) && !eltern?.closest("button, a[href]")) teile.push(t);
  }
  return teile.join(" ");
}

/** Der Wortlaut eines Woerterbuch-Schluessels (DE), GELESEN aus der ausgelieferten Datei. */
export function wortlaut(key: string): string {
  const treffer = new RegExp(`^\\s*${key}: "([^"]*)",`, "m").exec(HTML);
  expect(treffer, `${TASKPANE}: ${key} fehlt im Woerterbuch`).not.toBeNull();
  const wert = treffer?.[1] ?? "";
  expect(wert.length, `${TASKPANE}: ${key} ist leer`).toBeGreaterThan(0);
  return wert;
}

/** Eine Klara-Sitzungssicht wie der Server sie liefert (Bauform des Lebenszyklus-Tests). */
export function aufloesung(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    resolutionId: "res-1",
    mode: "external",
    provider: "srv-anbieter",
    model: "srv-modell",
    adminConfiguredMode: "external",
    effectiveMode: "external",
    deviation: false,
    deviationReason: null,
    externalConsentRequired: false,
    externalConsentGranted: false,
    executionAllowed: true,
    blockedReason: null,
    resolvedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    effectivePayloadClasses: ["query_text"],
    blockedPayloadClasses: [],
    ...over,
  };
}

export function sicht(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: "sess-1",
    tenantId: "t1",
    actorId: "a1",
    addinInstanceId: "inst-1",
    documentContextId: "doc-t-1",
    createdAt: new Date(Date.now() - 5000).toISOString(),
    lastActivityAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    policyVersion: "p1",
    configurationVersion: "c1",
    consentState: "none",
    closed: false,
    resolution: aufloesung(),
    ...over,
  };
}
