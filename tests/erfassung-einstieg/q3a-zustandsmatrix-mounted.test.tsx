// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg`, Runde 2 (Bens Befund BEN-3) — R-1560, Q3(a) §9: die
// Zustandsmatrix der Vertraulichkeitswahl beim Fortsetzen eines Entwurfs.
// ================================================================================================
//
// R-1560 (criteria_text): „Q3(a) §9 vollständige Lade-/Cache-/fehlgeschlagene Auffrischungs-/
// Offline-Zustandsmatrix ist durch den positiven Kernpfad nicht vollständig belegt." §9 steht in
// `klarwerk_steuerung/archiv/3082/AUFTRAG.md:221-234`. Den Hauptfall „erfolgreich leer" belegt
// schon `tests/vertraulichkeit-pflicht/fortgesetzter-entwurf-verlangt-stufe.test.tsx` F1; hier
// stehen die übrigen Zeilen:
//
//   Z0 Kalibrierung: derselbe Entwurf lädt normal → „intern" steht am Werkzeug.
//   Z1 laden:  Abruf hängt → keine Stufe behauptet, Einreichen gesperrt; danach wie Z0.
//   Z1-en      derselbe Ladezustand in EN (CAP-P1: „DE/EN gemeinsam nachprüfen").
//   Z2 Fehler: Abruf antwortet 500 → Wahl offen (kein „intern"), Fehlersatz, kein Promote.
//   Z3 offline beim Laden: fetch wirft → wie Z2.
//   Z4 offline beim Einreichen: Stufe gewählt, Promote kommt nicht an → Fehlersatz, die gewählte
//      Stufe bleibt unverändert stehen, kein Objekt im Bestand.
//
// „Cache mit laufender / gescheiterter Auffrischung" gibt es auf diesem Weg nicht: das Blatt holt
// den Entwurf mit einem direkten Abruf (`Blatt.tsx`, `endpoints.drafts.get(resumeDraftId)` im
// Ladeeffekt), nicht aus einem Abfrage-Cache; der Arbeitsraum ebenso (`Capture.tsx`, Ladeeffekt des
// Expertenwegs). Die Entwurfsliste (`useDrafts`) ist zwar gecacht, setzt aber keine Stufe.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Verändert die nächste Anlage `POST /api/drafts`, bevor sie beim Server ankommt. */
  anlageUmbauen: null as null | ((rumpf: Record<string, unknown>) => Record<string, unknown>),
  antworten: [] as { method: string; url: string; status: number }[],
  /** Die Weiche für EINEN Aufruf: festhalten, mit 500 antworten oder „offline" (fetch wirft). */
  weiche: null as null | ((method: string, url: string) => "haengen" | "fehler" | "offline" | null),
  festgehalten: [] as (() => void)[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
}

vi.mock("../../apps/web/src/api/endpoints", async (importOriginal) => {
  const original = (await importOriginal()) as {
    endpoints: Record<string, Record<string, unknown>>;
  };
  return {
    ...original,
    endpoints: {
      ...original.endpoints,
      reasoner: {
        ...original.endpoints.reasoner,
        status: vi.fn(async () => ({
          active: true,
          mode: "cloud",
          reachable: "ok",
          tasks: { structure: true, extract: true },
        })),
        config: vi.fn(async () => null),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TITEL = "Dosierpumpe nach Gebindewechsel entlüften";
const KOERPER = "<p>Erst den Nullpunkt am HMI prüfen, dann die Pumpe DP-4 entlüften.</p>";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    let body = init.body;
    if (method === "POST" && /\/api\/drafts$/.test(url) && bruecke.anlageUmbauen && body) {
      body = JSON.stringify(bruecke.anlageUmbauen(JSON.parse(body) as Record<string, unknown>));
      bruecke.anlageUmbauen = null;
    }
    const lage = bruecke.weiche?.(method, url) ?? null;
    if (lage === "offline") {
      throw new TypeError("Failed to fetch");
    }
    if (lage === "fehler") {
      bruecke.antworten.push({ method, url, status: 500 });
      return {
        ok: false,
        status: 500,
        statusText: "",
        text: async () => JSON.stringify({ error: "INTERNAL", message: "Interner Fehler." }),
      };
    }
    if (lage === "haengen") {
      await new Promise<void>((weiter) => bruecke.festgehalten.push(weiter));
    }
    const res = await bruecke.app.inject({
      method,
      url,
      headers,
      ...(body !== undefined ? { payload: body } : {}),
    });
    bruecke.antworten.push({ method, url, status: res.statusCode });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.anlageUmbauen = null;
  bruecke.antworten = [];
  bruecke.weiche = null;
  bruecke.festgehalten = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@zustand.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@zustand.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

async function blattOeffnen(adresse = "/capture/frontdoor"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
                  { initialEntries: [adresse] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function element<T extends Element>(selektor: string, art: new () => T): T {
  const el = container.querySelector(selektor);
  if (!(el instanceof art)) {
    throw new Error(`${selektor} fehlt. Sichtbar: ${seitentext().slice(0, 700)}`);
  }
  return el;
}

async function klick(knopf: HTMLElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

function lage(): string {
  return (container.querySelector('[data-testid="blatt-lage"]')?.textContent ?? "").replace(
    /\s+/g,
    " ",
  );
}

async function entwurfAnlegen(stufe?: "intern"): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}`, "content-type": "application/json" },
    payload: { title: TITEL, bodyHtml: KOERPER, ...(stufe ? { confidentiality: stufe } : {}) },
  });
  expect(res.statusCode, res.body.slice(0, 200)).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

function werkzeugWort(): string {
  return (
    element('[data-testid="blatt-werkzeug-vertraulichkeit"]', HTMLButtonElement).textContent ?? ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function promotes(): { method: string; url: string; status: number }[] {
  return bruecke.antworten.filter((a) => a.url.includes("/promote"));
}

async function bestand(): Promise<unknown[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body) as unknown[];
}

const istEntwurfsAbruf = (method: string, url: string): boolean =>
  method === "GET" && /\/api\/drafts\/[^/?]+$/.test(url);

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  brueckeAufbauen();
  await serverStarten();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  for (const weiter of bruecke.festgehalten) {
    weiter();
  }
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  await i18n.changeLanguage("de");
});

describe("R-1560 · Q3(a) §9 — die Stufe wird in keinem Zustand geraten", () => {
  it("Z0 · Kalibrierung: der Entwurf mit „intern“ lädt, und das Werkzeug nennt die Stufe", async () => {
    const id = await entwurfAnlegen("intern");
    await blattOeffnen(`/capture/frontdoor?draft=${id}`);
    expect(seitentext()).toContain("Nullpunkt am HMI");
    expect(werkzeugWort()).toContain(i18n.t("conf.level.intern"));
  });

  it("Z1 · laden: solange der Abruf hängt, keine Stufe und kein Einreichen — danach die echte Stufe", async () => {
    const id = await entwurfAnlegen("intern");
    bruecke.weiche = (m, u) => (istEntwurfsAbruf(m, u) ? "haengen" : null);
    await blattOeffnen(`/capture/frontdoor?draft=${id}`);

    expect(bruecke.festgehalten.length, "der Abruf wurde nicht festgehalten").toBeGreaterThan(0);
    expect(werkzeugWort()).not.toContain(i18n.t("conf.level.intern"));
    expect(element('[data-testid="blatt-einreichen"]', HTMLButtonElement).disabled).toBe(true);

    bruecke.weiche = null;
    await act(async () => {
      for (const weiter of bruecke.festgehalten.splice(0)) {
        weiter();
      }
      await flush();
    });
    await act(flush);
    expect(werkzeugWort()).toContain(i18n.t("conf.level.intern"));
  });

  it("Z1-en · CAP-P1 auf Englisch: im Ladefenster keine Schreibfläche, der Grund steht in der Sitzungssprache", async () => {
    // R-1560: „Frühe Eingaben erhalten oder Bedienung bis Bereitschaft verhindern; DE/EN gemeinsam
    // nachprüfen." Die deutsche Fassung steht gemountet in `tests/cap-p1-fruehe-eingabe` (F1);
    // dort ist Englisch nur als Textschlüssel geprüft (F6). Hier derselbe Zustand gemountet in EN.
    await i18n.changeLanguage("en");
    const id = await entwurfAnlegen("intern");
    bruecke.weiche = (m, u) => (istEntwurfsAbruf(m, u) ? "haengen" : null);
    await blattOeffnen(`/capture/frontdoor?draft=${id}`);

    expect(container.querySelector('[role="textbox"]')).toBeNull();
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).disabled).toBe(true);
    const hinweis = element('[data-testid="blatt-nicht-bereit"]', HTMLElement).textContent ?? "";
    expect(hinweis).toContain(i18n.t("erfassen.laden.nichtBereit"));
    expect(hinweis).not.toBe(i18n.getFixedT("de")("erfassen.laden.nichtBereit"));

    bruecke.weiche = null;
    await act(async () => {
      for (const weiter of bruecke.festgehalten.splice(0)) {
        weiter();
      }
      await flush();
    });
    await act(flush);
    expect(container.querySelector('[role="textbox"]')).not.toBeNull();
    expect(werkzeugWort()).toContain(i18n.t("conf.level.intern"));
  });

  for (const [fall, art] of [
    ["Z2 · Fehler (500)", "fehler"],
    ["Z3 · offline beim Laden", "offline"],
  ] as const) {
    it(`${fall}: die Wahl bleibt offen, ein Satz steht da, nichts wird eingereicht`, async () => {
      const id = await entwurfAnlegen("intern");
      bruecke.weiche = (m, u) => (istEntwurfsAbruf(m, u) ? art : null);
      await blattOeffnen(`/capture/frontdoor?draft=${id}`);

      expect(werkzeugWort()).toContain(i18n.t("erfassen.werkzeug.vertraulichkeit"));
      expect(werkzeugWort()).not.toContain(i18n.t("conf.level.intern"));
      // Ein Satz steht da, samt Wiederholweg. Beim 500 gewinnt die Servermeldung (JOB 2705),
      // offline der übersetzte Ladefehler — nie die Rohmeldung des Transports („Failed to fetch").
      expect(lage()).toContain(art === "fehler" ? "Interner Fehler." : i18n.t("fd.errLoadFailed"));
      expect(lage()).not.toContain("Failed to fetch");
      expect(lage()).toContain(i18n.t("erfassen.erneutVersuchen"));
      await klick(element('[data-testid="blatt-einreichen"]', HTMLButtonElement));
      expect(promotes()).toHaveLength(0);
      expect(await bestand()).toHaveLength(0);
    });
  }

  it("Z4 · offline beim Einreichen: Fehlersatz, die gewählte Stufe bleibt stehen, kein Objekt", async () => {
    const id = await entwurfAnlegen("intern");
    await blattOeffnen(`/capture/frontdoor?draft=${id}`);
    expect(werkzeugWort()).toContain(i18n.t("conf.level.intern"));

    bruecke.weiche = (m, u) => (m === "POST" && u.includes("/promote") ? "offline" : null);
    await klick(element('[data-testid="blatt-einreichen"]', HTMLButtonElement));

    expect(lage()).not.toBe("");
    expect(lage()).not.toContain(i18n.t("erfassen.eingereicht"));
    expect(werkzeugWort()).toContain(i18n.t("conf.level.intern"));
    expect(await bestand()).toHaveLength(0);
    // Die Eingabe ist noch da.
    expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(TITEL);
  });
});
