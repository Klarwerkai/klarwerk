// @vitest-environment jsdom
// ================================================================================================
// REVIEW26 „Lückenbezug" (K19 · priority:REVIEW26-DESIGN) — DIE AUSGANGSFRAGE AM NORMALEN BLATT.
// ================================================================================================
//
// Originalbefund (NUTZERBEFUNDE-AN-CLAUDE-20260908 §6): „Wissen erfassen öffnet einen leeren Editor
// ohne sichtbaren Wortlaut der Ausgangsfrage." Vorschlag: „die Ausgangsfrage über dem Antworteditor
// anzeigen." Bens Befund (Nacharbeit 10): `/erfassen?gap=<id>` rendert das Blatt, und nur der alte
// Arbeitsraum löste die Kennung auf. Diese Datei fährt den Weg mit echtem Router, echten Seiten und
// dem echten Server (Fastify-App über `fetch` verdrahtet, keine Antwortattrappen):
//   L1  berechtigt: /risiko?fall=<id> → „Wissen erfassen" → Blatt zeigt die Frage über Titel und
//       Text; Titel und Text bleiben leer (Bezug, nicht Inhalt);
//   L2  redigiert (fremde Lücke) und unbekannt: kein Fragetext, obwohl die Liste geladen wurde;
//   L3  ohne `gap`: keine Lückenliste geladen, keine Fläche;
//   L4  Entwurf fortsetzen MIT `gap`: Titel und Text des Entwurfs bleiben, die Frage steht darüber.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

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
import { Capture } from "../../apps/web/src/pages/Capture";
import { Risk } from "../../apps/web/src/pages/Risk";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

interface AnyRes {
  statusCode: number;
  body: string;
}

const bruecke: {
  app: { inject: (o: Record<string, unknown>) => Promise<AnyRes> };
  token: string;
  abrufe: { method: string; url: string }[];
} = { app: null as never, token: "", abrufe: [] };

const FRAGE = "Warum schwankt der Dosierwert an Testlinie L4?";
const FREMDE_FRAGE = "Welche Rezeptur fährt Linie 7 für Kunde Nordmolkerei?";
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
    bruecke.abrufe.push({ method, url });
    const res = await bruecke.app.inject({
      method,
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function anmelden(email: string): Promise<string> {
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  return (JSON.parse(login.body) as { token: string }).token;
}

/** Eine Lücke über den echten Frageweg: eine Frage, auf die der Bestand keine Antwort hat. */
async function lueckeAnlegen(token: string, frage: string): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { authorization: `Bearer ${token}` },
    payload: { question: frage },
  });
  const id = (JSON.parse(res.body) as { gap?: { id?: string } }).gap?.id;
  expect(id, `keine Lücke angelegt: ${res.statusCode} ${res.body.slice(0, 200)}`).toBeTruthy();
  return id as string;
}

async function serverStarten(): Promise<void> {
  bruecke.app = buildApp(buildServices()) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.abrufe = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@lueckenbezug.test", password: "geheim12345" },
  });
  bruecke.token = await anmelden("pedi@lueckenbezug.test");
}

async function oeffnen(adresse: string): Promise<void> {
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
                    createElement(Route, { path: "/risiko", element: createElement(Risk) }),
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

const seitentext = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
function feld(testId: string): Element | null {
  return container.querySelector(`[data-testid="${testId}"]`);
}
const lueckenAbrufe = (): number =>
  bruecke.abrufe.filter((a) => a.method === "GET" && /\/api\/gaps$/.test(a.url)).length;

/** Steht `a` im Dokument vor `b`? (jsdom kennt kein Layout — die Reihenfolge ist die Aussage.) */
const davor = (a: Element | null, b: Element | null): boolean =>
  !!a && !!b && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  brueckeAufbauen();
  await serverStarten();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("REVIEW26 Lückenbezug · Lücke → Wissen erfassen → Blatt mit Ausgangsfrage", () => {
  it("L1 · berechtigt: der Absprung aus /risiko öffnet das Blatt mit der Frage über dem Editor", async () => {
    const gapId = await lueckeAnlegen(bruecke.token, FRAGE);
    await oeffnen(`/risiko?fall=${encodeURIComponent(gapId)}`);
    const zeile = container.querySelector('[data-testid="luecke-zeile"][aria-current="true"]');
    expect(zeile?.textContent).toContain(FRAGE);
    const link = zeile?.querySelector<HTMLAnchorElement>('a[href^="/erfassen?gap="]');
    expect(link?.getAttribute("href")).toBe(`/erfassen?gap=${encodeURIComponent(gapId)}`);
    await act(async () => {
      link?.click();
      await flush();
    });
    await act(flush);

    expect(feld("blatt"), seitentext().slice(0, 500)).not.toBeNull();
    expect(feld("blatt-ausgangsfrage-text")?.textContent).toBe(FRAGE);
    expect(feld("blatt-ausgangsfrage")?.textContent).toContain("Aus offener Wissenslücke");
    expect(davor(feld("blatt-ausgangsfrage"), feld("blatt-titel"))).toBe(true);
    expect(davor(feld("blatt-ausgangsfrage"), feld("blatt-text"))).toBe(true);
    // Bezug, nicht Inhalt: Titel und Text gehören weiter dem Menschen.
    expect((feld("blatt-titel") as HTMLInputElement | null)?.value).toBe("");
    expect(feld("blatt-text")?.textContent ?? "").not.toContain(FRAGE);
  });

  it("L2 · eine fremde (redigierte) und eine unbekannte Lücke zeigen keinen Fragetext", async () => {
    const angelegt = await bruecke.app.inject({
      method: "POST",
      url: "/api/users",
      headers: { authorization: `Bearer ${bruecke.token}` },
      payload: {
        name: "Ex",
        email: "ex@lueckenbezug.test",
        password: "geheim12345",
        role: "experte",
      },
    });
    expect(angelegt.statusCode, angelegt.body.slice(0, 200)).toBeLessThan(300);
    const fremdId = await lueckeAnlegen(await anmelden("ex@lueckenbezug.test"), FREMDE_FRAGE);

    await oeffnen(`/erfassen?gap=${encodeURIComponent(fremdId)}`);
    expect(feld("blatt")).not.toBeNull();
    // KALIBRIERUNG: die Liste WURDE geladen — das Fehlen unten ist die Redaktion, kein Nicht-Laden.
    expect(lueckenAbrufe()).toBeGreaterThan(0);
    expect(feld("blatt-ausgangsfrage")).toBeNull();
    expect(seitentext()).not.toContain(FREMDE_FRAGE);
    act(() => root?.unmount());
    container.remove();
    root = null;

    await oeffnen("/erfassen?gap=gibt-es-nicht");
    expect(feld("blatt")).not.toBeNull();
    expect(feld("blatt-ausgangsfrage")).toBeNull();
    expect(seitentext()).not.toContain(FREMDE_FRAGE);
  });

  it("L3 · ohne gap lädt das Blatt keine Lückenliste und zeigt keine Frage", async () => {
    await lueckeAnlegen(bruecke.token, FRAGE);
    await oeffnen("/erfassen");
    expect(feld("blatt")).not.toBeNull();
    expect(lueckenAbrufe()).toBe(0);
    expect(feld("blatt-ausgangsfrage")).toBeNull();
    expect(seitentext()).not.toContain(FRAGE);
  });

  it("L4 · ein fortgesetzter Entwurf behält Titel und Text; die Frage steht darüber", async () => {
    const gapId = await lueckeAnlegen(bruecke.token, FRAGE);
    const res = await bruecke.app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${bruecke.token}`, "content-type": "application/json" },
      payload: { title: TITEL, bodyHtml: KOERPER, confidentiality: "intern" },
    });
    expect(res.statusCode, res.body.slice(0, 200)).toBe(201);
    const draftId = (JSON.parse(res.body) as { id: string }).id;

    await oeffnen(`/erfassen?${new URLSearchParams({ draft: draftId, gap: gapId })}`);
    expect((feld("blatt-titel") as HTMLInputElement | null)?.value).toBe(TITEL);
    expect(feld("blatt-text")?.textContent ?? "").toContain("Nullpunkt am HMI");
    expect(feld("blatt-text")?.textContent ?? "").not.toContain(FRAGE);
    expect(feld("blatt-ausgangsfrage-text")?.textContent).toBe(FRAGE);
    expect(davor(feld("blatt-ausgangsfrage"), feld("blatt-titel"))).toBe(true);
  });
});
