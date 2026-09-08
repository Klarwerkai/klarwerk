// @vitest-environment jsdom
// ================================================================================================
// JOB 3279 R2 · KORREKTURPFLICHT 6 — WIEDERÖFFNEN IM ECHTEN KLARWERK-CLIENT.
// ================================================================================================
//
// BENS BEFUND AN RUNDE 1 (Punkt 3): „Wiederöffnen in Klarwerk bleibt UNBEWIESENE HYPOTHESE:
// `artikel.test.tsx:367` erzeugt lediglich ein neues jsdom mit dem gespeicherten HTML, ohne
// Klarwerk-Client oder Editor." Er hat recht. Ein zweites jsdom beweist, dass der Körper wohlgeformt
// ist — nicht, dass die Fläche, die Pedi am Freitag zeigt, das Bild auch anzeigt.
//
// DIESER FALL SCHLIESST DIE LÜCKE MIT DEN ECHTEN BAUTEILEN:
//
//   `SanitizedHtml`     — der EINZIGE Ort im Produkt, der Entwurfs-/Objektkörper rendert
//                         (`apps/web/src/components/SanitizedHtml.tsx`), inklusive des
//                         CLIENT-Sanitizers `richText.sanitizeHtml`.
//   `DraftBodyGallery`  — die Bildergalerie, die im ENTWURF unter dem Editor steht
//                         (`apps/web/src/components/DraftBodyGallery.tsx`, Teil B, Pedis Befund).
//                         Genau sie zeigt Bild und Bildunterschrift nach dem Wiederöffnen.
//
// UND MIT DEM ECHTEN SERVERSCHRITT DAZWISCHEN: `sanitizeHtml` aus `services/structure` ist wörtlich
// die Funktion, die `services/capture/src/service.ts:170` auf jedes `bodyHtml` anwendet, BEVOR es
// persistiert wird. Der Körper reist hier also denselben Weg wie im Betrieb.
//
// WAS DIESER FALL NICHT IST: der vollständige HTTP-Rundweg. Den fährt `artikel.test.tsx` A7 gegen
// ein echtes Fastify und vergleicht den zurückgelesenen Körper zeichengenau mit der Vorschau.
// Beide zusammen decken die Kette ab; keiner von beiden behauptet den Teil des anderen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createContext, runInContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import "../../apps/web/src/i18n";
import { DraftBodyGallery } from "../../apps/web/src/components/DraftBodyGallery";
import { SanitizedHtml } from "../../apps/web/src/components/SanitizedHtml";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { sanitizeHtml } from "../../services/structure";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const wurzel = resolve("extensions/klara-browser");
const lies = (datei: string) => readFileSync(resolve(wurzel, datei), "utf8");

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const QUELLE = "https://status.example.test/bilder/anschluss.png";
const UNTERSCHRIFT = "Rückseite mit beschrifteten Anschlüssen";

/**
 * Der ECHTE Worker mit einer Übernahme, die ein Bild trägt — und der Körper, den er sendet.
 * Der Umweg über den Worker ist Absicht: der Körper soll nicht von Hand geschrieben sein, sondern
 * genau der, den die Erweiterung erzeugt.
 */
async function koerperAusDerErweiterung(): Promise<string> {
  const daten: Record<string, unknown> = {};
  let gesendet = "";
  const listeners: Record<string, (...args: unknown[]) => unknown> = {};
  const ereignis = (schluessel: string) => ({
    addListener: (fn: (...args: unknown[]) => unknown) => {
      listeners[schluessel] = fn;
    },
  });
  const bild = {
    tag: "figure",
    children: [
      { tag: "img", attrs: { src: PNG, alt: "Anschlussbild" } },
      {
        tag: "figcaption",
        children: [{ tag: "#text", text: `${UNTERSCHRIFT} · Quelle / Source: ${QUELLE}` }],
      },
    ],
  };
  const artikel = {
    available: true,
    text: "Netzwerkanschluss\nDer Anschluss meldet den Verbindungszustand.",
    nodes: [
      { tag: "h2", children: [{ tag: "#text", text: "Netzwerkanschluss" }] },
      {
        tag: "p",
        children: [{ tag: "#text", text: "Der Anschluss meldet den Verbindungszustand." }],
      },
      bild,
    ],
    gaps: [],
    images: 1,
  };
  const leer = { available: false, text: "", nodes: [], gaps: [], images: 0 };
  const chrome = {
    runtime: {
      id: "test-extension",
      getURL: (p: string) => `chrome-extension://test-extension/${p}`,
      onMessage: ereignis("message"),
      onInstalled: ereignis("installed"),
    },
    storage: {
      session: {
        get: async () => structuredClone(daten),
        set: async (werte: Record<string, unknown>) => {
          Object.assign(daten, structuredClone(werte));
        },
        clear: async () => {
          for (const k of Object.keys(daten)) delete daten[k];
        },
        setAccessLevel: async () => {},
      },
    },
    contextMenus: { onClicked: ereignis("menu"), create: () => {}, removeAll: async () => {} },
    action: { onClicked: ereignis("action") },
    sidePanel: { open: async () => {}, setPanelBehavior: async () => {} },
    tabs: { onActivated: ereignis("activated"), onUpdated: ereignis("updated") },
    scripting: {
      executeScript: async () => [
        {
          result: {
            text: "",
            title: "Lokale Statusseite",
            url: "https://status.example.test/local",
            variants: { selection: leer, article: artikel, page: leer },
          },
        },
      ],
    },
    i18n: { getMessage: () => "In Klarwerk übernehmen" },
  };
  const netz: typeof fetch = async (eingabe, optionen) => {
    const adresse = String(eingabe);
    if (adresse.endsWith("/login"))
      return Response.json({ token: "t", user: { id: "person-a", email: "a@example.test" } });
    const rumpf = JSON.parse(String(optionen?.body)) as { bodyHtml: string };
    gesendet = rumpf.bodyHtml;
    return Response.json(
      { id: "draft-3279", originalAuthor: "person-a", payload: rumpf },
      { status: 201 },
    );
  };
  const kontext = createContext({
    chrome,
    fetch: netz,
    URL,
    TextEncoder,
    AbortSignal,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
  });
  runInContext(lies("worker.js"), kontext);
  const absender = { id: "test-extension", url: "chrome-extension://test-extension/panel.html" };
  const sende = (nachricht: Record<string, unknown>) =>
    new Promise<{ status: string }>((fertig) => {
      listeners.message?.(
        { captureId: (daten.work as { id?: string } | undefined)?.id, ...nachricht },
        absender,
        fertig,
      );
    });
  await listeners.action?.({ id: 7, url: "https://status.example.test/local", title: "Status" });
  await sende({ type: "login", email: "a@example.test", password: "p" });
  const ergebnis = await sende({
    type: "save",
    form: { title: "Statusseite", context: "Warum wichtig", confidentiality: "intern" },
  });
  expect(ergebnis.status, "die Erweiterung hat gar nicht gespeichert").toBe("saved");
  expect(gesendet, "es wurde kein Körper gesendet").toBeTruthy();
  // GENAU DER SERVERSCHRITT: dieselbe Funktion, die service.ts:170 vor dem Persistieren anwendet.
  return sanitizeHtml(gesendet);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.useRealTimers();
});

describe("JOB 3279 R2 · der Browser-Entwurf im echten Klarwerk-Client", () => {
  it("W1 · nach dem Wiederöffnen zeigt die echte Entwurfsgalerie Bild UND Bildunterschrift mit Quelle", async () => {
    const koerper = await koerperAusDerErweiterung();
    // Der Server hat die Bildhülle verankert — das ist sein Werk, nicht unseres.
    expect(koerper, "der Sanitizer hat die Bildhülle verworfen").toContain("<figure");
    expect(koerper).toContain('data-image-id="');
    act(() => {
      root.render(createElement(DraftBodyGallery, { bodyHtml: koerper }));
    });
    act(() => {
      vi.advanceTimersByTime(LIBRARY_SEARCH_DEBOUNCE_MS + 10);
    });
    const kachel = container.querySelector("button img");
    expect(kachel, "die echte Entwurfsgalerie zeigt kein Bild").not.toBeNull();
    expect(kachel?.getAttribute("src"), "das Bild kam nicht mit").toBe(PNG);
    // Beschriftung UND Quelladresse stehen an der Kachel — beides, nicht eines von beiden.
    expect(kachel?.getAttribute("alt")).toContain(UNTERSCHRIFT);
    expect(kachel?.getAttribute("alt")).toContain(QUELLE);
  });

  it("W2 · der echte Körper-Renderer zeigt Text, Struktur, Herkunft und dasselbe Bild", async () => {
    const koerper = await koerperAusDerErweiterung();
    act(() => {
      root.render(createElement(SanitizedHtml, { html: koerper }));
    });
    const text = container.textContent ?? "";
    expect(text, "der übernommene Inhalt fehlt").toContain("Netzwerkanschluss");
    expect(text, "die Herkunft fehlt").toContain("https://status.example.test/local");
    expect(text, "der gewählte Umfang fehlt").toContain("Umfang / Scope: Artikel / Article");
    expect(text, "die Bildunterschrift fehlt").toContain(UNTERSCHRIFT);
    expect(text, "die Quelle des Bildes fehlt").toContain(QUELLE);
    const bild = container.querySelector("figure img");
    expect(bild, "der Client-Sanitizer hat das Bild verworfen").not.toBeNull();
    expect(bild?.getAttribute("src")).toBe(PNG);
    expect(container.querySelector("h2")?.textContent).toBe("Statusseite");
    expect(container.querySelector("script")).toBeNull();
  });
});
