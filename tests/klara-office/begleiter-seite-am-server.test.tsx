// @vitest-environment jsdom
// ================================================================================================
// KLARA-OFFICE-02 · DIE FLÄCHE DER BEGLEITAPP GEGEN DEN ECHTEN SERVER.
// ================================================================================================
//
// Dieselbe Montage wie `tests/klara-produkt/produkteinstieg-am-server.test.tsx`: echte Hülle (hier
// ihr hüllenloser Zweig `/begleiter`), echte App im selben Prozess über den Draht aus
// `tests/klara-quellen-nutzerweg/kette.ts`, echte Anmeldung. Die native App ist durch ihren
// Nachrichtenkanal vertreten (`window.webkit.messageHandlers.klaraBegleiter`, aufgezeichnet), das
// Word-Fenster durch denselben HTTP-Weg, den `word-addin/begleiter.js` geht (`app.inject` mit der
// Anmeldung derselben Person). Alle Konten und Inhalte sind fiktiv.
//
// WAS DIESER FALL NICHT ZEIGT: ein echtes macOS-Fenster, echtes Ziehen über Word, Vollbild,
// Mehrmonitor, Mikrofon. Das ist die lokale Bedienabnahme (docs/operations/klara-office/).
//
//   S1  KO-02-02/-03 · Figur: gewählter (bzw. gelieferter) Avatar, Zustand „bereit", Hinweis „kein
//       Word-Fenster", Lage „figur" an die App; Pfeiltasten bewegen, Umschalt weiter.
//   S2  KO-02-03 · Gespräch öffnen und schliessen (Klick, Escape, Befehl der App) — mit Lage an die App.
//   S3  KO-02-05 · Word-Kontext ausschliesslich vom angemeldeten Adapter: Host, Fassung, Dateiname,
//       Markierung; eine Frage zur Markierung geht an DIESES Word-Fenster, seine Antwort kommt zurück.
//   S4  KO-02-01 · Fassungen sichtbar: Webfläche und App, so wie die App sie selbst einträgt.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { vergiss } from "../../apps/web/src/components/klara-vorschau/echt";
import { setzeAssistenzProfil } from "../../apps/web/src/components/klara-vorschau/profil";
import i18n from "../../apps/web/src/i18n";
import { BRUECKEN_EREIGNIS } from "../../apps/web/src/lib/begleiterBruecke";
import { Begleiter } from "../../apps/web/src/pages/Begleiter";
import { AppShell } from "../../apps/web/src/shell/AppShell";
import { APP_VERSION } from "../../apps/web/src/version";
import { bis, klick, medienStub, q, ruhe, taste, tippe } from "../fe003-tutorial-fragen/huelle";
import {
  type Aufbau,
  type Draht,
  type Konto,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();

const FENSTER = `bgl-${"e".repeat(32)}`;
const MARKIERUNG = "Fiktive Klausel 7: Die Lieferung erfolgt am dritten Werktag.";
const BASIS = "/api/me/klara/begleiter";
const DOKUMENT = {
  kennung: `url-${"4".repeat(32)}`,
  titel: "Vertrag Muster.docx",
  gespeichert: true,
};
const MIT_MARKIERUNG = { text: MARKIERUNG, laenge: MARKIERUNG.length, stand: 1 };

let draht: Draht;
let aufbau: Aufbau | null = null;
let leser: Konto | null = null;
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let echterFetch: typeof globalThis.fetch;
let anApp: Array<Record<string, unknown>> = [];

const w = window as unknown as Record<string, unknown>;

beforeAll(() => {
  draht = drahtAufbauen();
  echterFetch = globalThis.fetch;
});

afterAll(() => {
  draht.abbauen();
});

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  vergiss();
  setzeAssistenzProfil(null);
  medienStub();
  anApp = [];
  // Die native App, vertreten durch ihren Nachrichtenkanal und ihre selbst eingetragene Fassung.
  w.webkit = {
    messageHandlers: {
      klaraBegleiter: {
        postMessage: (n: Record<string, unknown>) => {
          anApp.push(n);
        },
      },
    },
  };
  w.__KLARA_BEGLEITER__ = { fassung: "0.1.0", bau: "pruefbau" };
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  abbauen();
  document.body.innerHTML = "";
  globalThis.fetch = echterFetch;
  window.fetch = echterFetch;
  vergiss();
  Reflect.deleteProperty(w, "webkit");
  Reflect.deleteProperty(w, "__KLARA_BEGLEITER__");
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  leser = null;
  draht.setzeApp(null);
  draht.setzeCookie(null);
  draht.aufrufe.length = 0;
});

function abbauen(): void {
  if (root) {
    const r = root;
    act(() => r.unmount());
    root = null;
  }
  container?.remove();
  container = null;
}

async function vorrichtung(): Promise<void> {
  const a = await appAufbauen(false);
  aufbau = a;
  draht.setzeApp(a.app);
  leser = await neuesKonto(a.app, "begleiter", a.admin);
  draht.setzeCookie(`kw_session=${leser.token}`);
}

async function montiere(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const r = createRoot(container);
  root = r;
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  await act(async () => {
    r.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/begleiter"] },
                  createElement(AppShell, null, createElement(Begleiter)),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
  await bis(() => Boolean(q(document, "begleiter-figur")), 200);
}

/** Das Word-Fenster: derselbe Weg wie `begleiter.js`, mit der Anmeldung derselben Person. */
async function wordFenster(methode: "POST" | "PUT", url: string, rumpf: unknown) {
  if (!aufbau || !leser) {
    throw new Error("Vorrichtung fehlt");
  }
  return aufbau.app.inject({
    method: methode,
    url,
    headers: leser.kopf,
    payload: rumpf as Record<string, unknown>,
  });
}

function figur(): HTMLButtonElement {
  const f = q<HTMLButtonElement>(document, "begleiter-figur");
  if (!f) {
    throw new Error("Figur fehlt");
  }
  return f;
}

const nachrichten = (art: string) => anApp.filter((n) => n.art === art);

describe("S1 · KO-02-02/-03 — die Figur", () => {
  it("zeigt den Avatar und den tatsächlichen Zustand; meldet der App die Lage „figur“", async () => {
    await vorrichtung();
    await montiere();
    const f = figur();
    expect(f.querySelector("img")?.getAttribute("src")).toBe("/klara/klara-avatar-v1.png");
    expect(f.getAttribute("aria-label")).toContain("Deine Assistenz");
    expect(f.dataset.zustand).toBe("ruhe");
    expect(q(document, "begleiter-figur-ohne-word")).not.toBeNull();
    expect(q(document, "begleiter-gespraech")).toBeNull();
    expect(nachrichten("bereit")).toEqual([{ art: "bereit", webFassung: APP_VERSION }]);
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "figur" });
    expect(nachrichten("griff").length).toBeGreaterThan(0);
  });

  it("Pfeiltasten bewegen die Figur über die App; Umschalt nimmt den grossen Schritt", async () => {
    await vorrichtung();
    await montiere();
    await taste(figur(), "ArrowLeft");
    await act(async () => {
      figur().dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true, bubbles: true }),
      );
    });
    expect(nachrichten("bewegen")).toEqual([
      { art: "bewegen", dx: -12, dy: 0 },
      { art: "bewegen", dx: 0, dy: 60 },
    ]);
  });
});

describe("S2 · KO-02-03 — Gespräch öffnen und schliessen", () => {
  it("Klick öffnet, Escape schliesst, der Befehl der App öffnet wieder", async () => {
    await vorrichtung();
    await montiere();
    await klick(figur());
    await bis(() => Boolean(q(document, "begleiter-gespraech")));
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "gespraech" });
    expect(figur().getAttribute("aria-expanded")).toBe("true");

    await taste(q(document, "begleiter-gespraech") as HTMLElement, "Escape");
    expect(q(document, "begleiter-gespraech")).toBeNull();
    expect(nachrichten("modus").at(-1)).toEqual({ art: "modus", modus: "figur" });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(BRUECKEN_EREIGNIS, { detail: { befehl: "gespraech-oeffnen" } }),
      );
    });
    await bis(() => Boolean(q(document, "begleiter-gespraech")));
    await klick(q(document, "begleiter-schliessen"));
    expect(q(document, "begleiter-gespraech")).toBeNull();
  });
});

describe("S3 · KO-02-05 — der Word-Kontext kommt ausschliesslich vom Adapter", () => {
  it("ohne Fenster: ehrlicher Hinweis; mit Fenster: Host, Fassung, Datei und Markierung", async () => {
    await vorrichtung();
    await montiere();
    await klick(figur());
    await bis(() => Boolean(q(document, "begleiter-kontext-leer")), 120);
    expect(q(document, "begleiter-kontext-leer")?.textContent).toContain(
      "Mit Begleitapp verbinden",
    );

    const angemeldet = await wordFenster("POST", `${BASIS}/adapter`, {
      instanz: FENSTER,
      host: "word-mac",
      hostFassung: "16.89",
      dokument: DOKUMENT,
    });
    expect(angemeldet.statusCode, angemeldet.body).toBe(201);
    const gemeldet = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 1,
      auswahl: MIT_MARKIERUNG,
    });
    expect(gemeldet.statusCode, gemeldet.body).toBe(200);

    await bis(() => q(document, "begleiter-auswahl-text")?.textContent === MARKIERUNG, 160);
    expect(q(document, "begleiter-auswahl-text")?.textContent).toBe(MARKIERUNG);
    const fenster = q(document, "begleiter-fenster");
    expect(fenster?.dataset.aktiv).toBe("ja");
    expect(fenster?.dataset.gebunden).toBe("ja");
    expect(fenster?.textContent).toContain("Vertrag Muster.docx");
    expect(fenster?.textContent).toContain("Word für Mac");
    expect(fenster?.textContent).toContain("Fassung 16.89");
    expect(q(document, "begleiter-figur-ohne-word")).toBeNull();

    // Eine Frage zur Markierung geht an DIESES Word-Fenster — nicht an den allgemeinen Frageweg.
    await tippe(q<HTMLInputElement>(document, "begleiter-word-frage") as HTMLInputElement, "Wann?");
    await klick(q(document, "begleiter-word-frage-senden"));
    await bis(() => q(document, "begleiter-aktionen") !== null, 80);
    const holen = await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 2,
      auswahl: MIT_MARKIERUNG,
    });
    type Auftrag = { id: string; art: string; text: string };
    const auftraege = (holen.json() as { aktionen: Auftrag[] }).aktionen;
    expect(auftraege.map((a) => [a.art, a.text])).toEqual([["frage", "Wann?"]]);
    expect(draht.aufrufe.some((a) => a.url === "/api/ask")).toBe(false);

    // Das Word-Fenster meldet seine Antwort; die Fläche zeigt sie als „Antwort aus Word".
    await wordFenster("PUT", `${BASIS}/adapter/${FENSTER}`, {
      seq: 3,
      auswahl: MIT_MARKIERUNG,
      erledigt: [{ id: auftraege[0]?.id, stand: "erledigt", ergebnis: "Am dritten Werktag." }],
    });
    const aktionen = (): string => q(document, "begleiter-aktionen")?.textContent ?? "";
    await bis(() => aktionen().includes("Werktag."), 160);
    expect(aktionen()).toContain("Antwort aus Word");
    expect(aktionen()).toContain("Am dritten Werktag.");
  });
});

describe("S4 · KO-02-01 — Fassungen sichtbar", () => {
  it("nennt die Fassung der Webfläche und die der App, wie die App sie einträgt", async () => {
    await vorrichtung();
    await montiere();
    await klick(figur());
    await bis(() => Boolean(q(document, "begleiter-version")));
    expect(q(document, "begleiter-version")?.textContent).toBe(
      `Webfläche ${APP_VERSION} · Begleitapp 0.1.0 (pruefbau)`,
    );
  });
});
