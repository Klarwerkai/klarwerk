// @vitest-environment jsdom
// ================================================================================================
// R-0570 · DIE VORFÜHRUNG AUF DER OBERFLÄCHE — ohne Anmeldung lesen und fragen, gegen den echten
// Server.
// ================================================================================================
//
// Gemessen an der GEMOUNTETEN Fläche: der echte Client spricht über eine Brücke mit dem echten
// Server (Hausform, s. `tests/gast-ablauf-anmeldemaske/anmeldemaske-ablauf-mounted.test.tsx`). Es
// gibt keine Sitzung — jede Anfrage ist unangemeldet.
//
//   F1 · Die Vorführung zeigt Kennzeichnung und erfundene Einträge.
//   F2 · Eine Frage findet den passenden erfundenen Eintrag.
//   F3 · Die Anmeldemaske verweist nur dann auf die Vorführung, wenn sie eingeschaltet ist.
//   F4 · Die Fläche ruft ausschliesslich die zwei Vorführungswege — keinen Wissensweg.
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ refresh: () => {}, oidcEnabled: false, user: null }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthScreens } from "../../apps/web/src/auth/AuthScreens";
import i18n from "../../apps/web/src/i18n";
import { VorfuehrungScreen } from "../../apps/web/src/vorfuehrung/VorfuehrungScreen";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { INHALTE, KENNZEICHNUNG } from "../../services/app/src/vorfuehrung/inhalte";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCHALTER = "KLARWERK_VORFUEHRUNG_ANONYM";

let app: FastifyInstance;
let fetchVorher: typeof fetch;
let schalterVorher: string | undefined;
let aufgerufen: string[] = [];
/** Jede Antwort der Brücke mit Status — Grundlage zum Warten und Klartext in jeder Fehlermeldung. */
let beantwortet: string[] = [];

function brueckeAufbauen(): void {
  globalThis.fetch = (async (eingabe: unknown, init: RequestInit = {}) => {
    const url = String(eingabe);
    const kopf: Record<string, string> = {};
    new Headers(init.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    aufgerufen.push(url);
    const res = await app.inject({ method: "GET", url, headers: kopf });
    beantwortet.push(`${url} → ${res.statusCode}`);
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    } as unknown as Response;
  }) as typeof fetch;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mounten(el: unknown): Promise<void> {
  const div = document.createElement("div");
  document.body.appendChild(div);
  container = div;
  root = createRoot(div);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const r = root;
  await act(async () => {
    r.render(
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client: qc }, el as never),
      ),
    );
    await flush();
  });
}

const alle = (testId: string): Element[] => [
  ...(container?.querySelectorAll(`[data-testid="${testId}"]`) ?? []),
];

/**
 * Wartet, bis die Bedingung gilt — höchstens `ms`. Eine feste Zahl leerer Takte reichte nicht mehr,
 * seit `buildApp` mit dem Hauptstand gewachsen ist: die erste Antwort kam erst danach, und die
 * Fläche wurde vor ihr gelesen (Nacharbeit 5). Die Zusicherungen danach bleiben unverändert.
 */
async function bis(bedingung: () => boolean, ms = 5000): Promise<void> {
  const ende = Date.now() + ms;
  while (!bedingung() && Date.now() < ende) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

const antwortDa = (pfad: string) => (): boolean =>
  beantwortet.some((b) => b.startsWith(`${pfad} `) || b.startsWith(`${pfad}?`));

beforeEach(async () => {
  schalterVorher = process.env[SCHALTER];
  aufgerufen = [];
  beantwortet = [];
  fetchVorher = globalThis.fetch;
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  if (root) {
    const r = root;
    act(() => {
      r.unmount();
    });
    root = null;
  }
  container?.remove();
  container = null;
  globalThis.fetch = fetchVorher;
  if (schalterVorher === undefined) {
    delete process.env[SCHALTER];
  } else {
    process.env[SCHALTER] = schalterVorher;
  }
  await app?.close();
  await i18n.changeLanguage("de");
});

async function starte(schalter: boolean): Promise<void> {
  if (schalter) {
    process.env[SCHALTER] = "1";
  } else {
    delete process.env[SCHALTER];
  }
  app = buildApp(buildServices());
  // Der Server ist fertig aufgebaut, BEVOR die Fläche ihre erste Anfrage stellt.
  await app.ready();
  brueckeAufbauen();
}

describe("R-0570 · die anonyme Vorführung auf der Oberfläche", () => {
  it("F1 · ohne Anmeldung: Kennzeichnung und alle erfundenen Einträge stehen da", async () => {
    await starte(true);
    await mounten(createElement(VorfuehrungScreen));
    await bis(() => alle("vorfuehrung-eintrag").length > 0);
    const kennzeichnung = alle("vorfuehrung-kennzeichnung");
    expect(kennzeichnung, beantwortet.join(" · ")).toHaveLength(1);
    expect(kennzeichnung[0]?.textContent).toBe(KENNZEICHNUNG.de);
    const eintraege = alle("vorfuehrung-eintrag").map((e) => e.textContent ?? "");
    expect(eintraege).toHaveLength(INHALTE.de.length);
    for (const e of INHALTE.de) {
      expect(eintraege.some((t) => t.includes(e.titel))).toBe(true);
    }
  });

  it("F2 · ohne Anmeldung fragen: der passende erfundene Eintrag wird gezeigt", async () => {
    await starte(true);
    await mounten(createElement(VorfuehrungScreen));
    const feld = container?.querySelector("#vorfuehrung-frage");
    expect(feld).toBeInstanceOf(HTMLInputElement);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        feld,
        "Druckluftanlage drucklos machen",
      );
      feld?.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    const form = container?.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flush();
    });
    await bis(() => alle("vorfuehrung-treffer").length > 0);
    const treffer = alle("vorfuehrung-treffer").map((e) => e.textContent ?? "");
    expect(treffer.length, beantwortet.join(" · ")).toBeGreaterThan(0);
    expect(treffer[0]).toContain(INHALTE.de[0]?.titel ?? "—");
  });

  it("F3 · die Anmeldemaske verweist auf die Vorführung — nur wenn sie eingeschaltet ist", async () => {
    await starte(false);
    await mounten(createElement(AuthScreens, { needsSetup: false } as never));
    // Erst wenn die Schalterauskunft beantwortet ist, sagt „kein Verweis" etwas.
    await bis(antwortDa("/api/features"));
    await act(async () => {
      await flush();
    });
    expect(beantwortet.some((b) => b.startsWith("/api/features "))).toBe(true);
    const ohne = alle("auth-zur-vorfuehrung");
    expect(ohne, "Verweis trotz ausgeschalteter Vorführung").toHaveLength(0);
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    await app.close();

    beantwortet = [];
    await starte(true);
    await mounten(createElement(AuthScreens, { needsSetup: false } as never));
    await bis(() => alle("auth-zur-vorfuehrung").length > 0);
    const verweis = alle("auth-zur-vorfuehrung");
    expect(verweis, beantwortet.join(" · ")).toHaveLength(1);
    expect(verweis[0]?.getAttribute("href")).toBe("/vorfuehrung");
  });

  it("F4 · die Fläche ruft nur die Vorführungswege — keinen Wissens- oder Frageweg", async () => {
    await starte(true);
    await mounten(createElement(VorfuehrungScreen));
    // Kalibrierung: es wurde überhaupt etwas gerufen.
    expect(aufgerufen.length).toBeGreaterThan(0);
    const fremd = aufgerufen.filter(
      (u) => !u.startsWith("/api/vorfuehrung") && u !== "/api/features" && u !== "/api/branding",
    );
    expect(fremd).toEqual([]);
  });
});
