// @vitest-environment jsdom
// RC3-P1: bestehender Gesprächsport, echte API-Clientaufrufe, nur Transport und Uhr kontrolliert.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../../apps/web/src/api/client";
import type { KlaraGespraech } from "../../apps/web/src/api/klaraGespraech";
import {
  einwilligen,
  ladeEcht,
  leseEcht,
  starteQuellpruefung,
  vergiss,
} from "../../apps/web/src/components/klara-vorschau/echt";
import i18n from "../../apps/web/src/i18n";
import { rechtekontextZuruecksetzen } from "../../apps/web/src/lib/rechtekontext";

const KONTO = "rc3-p1-eigenes-konto";
const EIGEN = "Meine freie Frage bleibt erhalten";
const MARKE = "Fiktive-RC3-P1-Quelle: Messwert 73";
const FREI = { pfad: "/fragen", seitenName: "Fragen", objekt: "Eigener Faden" };
const G: KlaraGespraech = {
  id: "rc3-p1-gespraech",
  objektbezug: FREI,
  nachrichten: [
    { id: "p1-frage", von: "du", modus: "frage", text: EIGEN, objektbezug: FREI,
      antwortId: null, quellen: [], wissensklasse: null, grund: null, angelegtAm: "2026-10-21T09:00:00Z" },
    { id: "p1-antwort", von: "klara", modus: "ohne_ki", text: MARKE, objektbezug: FREI,
      antwortId: "p1-eigener-beleg", quellen: ["p1-nord", "p1-frei"], wissensklasse: "gesichert",
      grund: null, angelegtAm: "2026-10-21T09:00:00Z" },
  ],
  letzterSchritt: null,
  einwilligungAm: "2026-10-21T09:00:00Z",
  angelegtAm: "2026-10-21T09:00:00Z",
  geaendertAm: "2026-10-21T09:00:00Z",
};
const vorherSichtbarkeit = Object.getOwnPropertyDescriptor(document, "visibilityState");
let stoppen: (() => void) | null = null;
let put: "voll" | "fehler" | "teil" = "voll";
let halten = false;
let freigeben: (() => void) | null = null;
let eingetreten: Promise<void>;
let hinein: () => void;
const abrufe: { url: string; method: string }[] = [];
const text = () => leseEcht().nachrichten.map((n) => n.text).join("\n");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vergiss();
  rechtekontextZuruecksetzen();
  abrufe.length = 0;
  put = "voll";
  halten = false;
  eingetreten = new Promise<void>((r) => { hinein = r; });
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    now: new Date("2026-10-21T09:00:00Z") });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    abrufe.push({ url, method });
    let daten: unknown;
    let status = 200;
    if (url === "/api/auth/me") daten = { id: KONTO, role: "experte" };
    else if (url === "/api/kos") daten = [];
    else if (method === "GET" && (url === "/api/me/klara/gespraech" || url === `/api/me/klara/gespraeche/${G.id}`)) {
      daten = { gespraech: structuredClone(G) };
      if (halten) {
        hinein();
        await new Promise<void>((r) => { freigeben = r; });
      }
    } else if (method === "PUT" && url.endsWith("/einwilligung")) {
      status = put === "fehler" ? 503 : 200;
      daten = put === "fehler" ? { error: "UNAVAILABLE", message: "Fiktive vorübergehende Störung" }
        : { gespraech: { ...structuredClone(G), nachrichten: put === "teil" ? [G.nachrichten[0]] : G.nachrichten } };
    } else throw new Error(`Kein weiterer RC3-P1-Port erlaubt: ${method} ${url}`);
    return new Response(JSON.stringify(daten), { status,
      headers: { "content-type": "application/json", "x-klarwerk-rechtekontext": "p1-gleicher-kontext" } });
  });
});

afterEach(() => {
  stoppen?.();
  stoppen = null;
  freigeben?.();
  freigeben = null;
  vergiss();
  rechtekontextZuruecksetzen();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (vorherSichtbarkeit) Object.defineProperty(document, "visibilityState", vorherSichtbarkeit);
  else Reflect.deleteProperty(document, "visibilityState");
});

it("RC3-P1: 15-s-Anlass und tatsächlicher60-s-Ablauf; Fehler, Teilecho, hängende Lesung und Session/Listenantwort verlängern nicht", async () => {
  const t = i18n.getFixedT("de");
  await ladeEcht(KONTO, t);
  expect(text()).toContain(MARKE);
  expect(text()).toContain(EIGEN);
  const roh = structuredClone(G);
  stoppen = starteQuellpruefung(KONTO, t);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(abrufe.filter((a) => a.method === "GET" && a.url.startsWith("/api/me/klara/"))).toHaveLength(2);
  expect(text()).toContain(MARKE);
  // Abbau des Darstellers beendet dessen Prüftakt, nicht die Gültigkeitsgrenze des Kontocaches.
  stoppen();
  stoppen = null;
  await vi.advanceTimersByTimeAsync(3_000);
  put = "fehler";
  expect(await einwilligen(true, FREI, t)).toBe(false);
  expect(text()).toContain(MARKE);
  await vi.advanceTimersByTimeAsync(2_000);
  put = "teil";
  halten = true;
  const teilweise = einwilligen(true, FREI, t);
  await eingetreten;
  // Die Vollprojektion von Sekunde15 bleibt vor ihrer Frist sichtbar; ein Teilecho ersetzt sie nicht.
  await vi.advanceTimersByTimeAsync(54_999);
  await api.get("/auth/me");
  await api.get("/kos");
  expect(text()).toContain(MARKE);
  await vi.advanceTimersByTimeAsync(1);
  expect(text()).not.toContain(MARKE);
  expect(text()).toContain(EIGEN);
  // Der vor Ablauf erzeugte, erst danach eintreffende Erfolg öffnet keinen abgelaufenen Inhalt.
  halten = false;
  freigeben?.();
  expect(await teilweise).toBe(false);
  expect(text()).not.toContain(MARKE);
  expect(G).toEqual(roh);
  put = "voll";
  stoppen = starteQuellpruefung(KONTO, t);
  const vorFokus = abrufe.length;
  window.dispatchEvent(new Event("focus"));
  await vi.advanceTimersByTimeAsync(0);
  expect(abrufe.length).toBe(vorFokus + 1);
  expect(text()).toContain(MARKE);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(abrufe.length).toBe(vorFokus + 1);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(abrufe.length).toBe(vorFokus + 2);
  expect(text()).toContain(EIGEN);
  expect(abrufe.some((a) => a.url === "/api/ask" || !a.url.startsWith("/api/"))).toBe(false);
});
