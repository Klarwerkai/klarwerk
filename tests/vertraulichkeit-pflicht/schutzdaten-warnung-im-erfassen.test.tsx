// @vitest-environment jsdom
// ================================================================================================
// R-0658 · DIE SCHUTZDATENWARNUNG STEHT AUF DEM BLATT — NICHT NUR IM API-FELD.
// ================================================================================================
//
// BEN-Befund K4 zu Kandidat 4b15dbc7: „Ein ausgeführter Bediennachweis der sichtbaren
// Quarantänewarnung beim Einreichen über das Blatt fehlt." Bis Nacharbeit 5 reduzierte
// `Blatt.onSuccess` das Einreichergebnis auf `id` und `title`; die Quarantäne-Auskunft des Servers
// hatte keinen Leser.
//
// WAS HIER ECHT IST (Bauform aus `tests/vertraulichkeit-hinweis/einreichen-ohne-stufe-erklaert-
// sich.test.tsx`): die Seite `pages/CaptureFrontDoor.tsx` (= das Blatt) mit ihren echten Providern,
// der echte API-Client, die echte Fastify-Anwendung mit Erkennung, Quarantäne und Suche. Der
// EINZIGE Ersatz ist der Transport (`fetch` → `app.inject`).
//
//   W1 · Text mit „Personalnummer: 12345678" eingeben, „Öffentlich-intern" wählen, einreichen:
//        unter der Erfolgszeile steht die Warnung (Art + Quarantäne/Suchausschluss), angesagt
//        (`role="alert"`) und der fokussierten Erfolgszeile über `aria-describedby` zugeordnet;
//        die Bibliotheksroute findet den Eintrag weder über seine Marke noch über die Nummer.
//   W2 · POSITIVER KONTROLLFALL: derselbe Weg ohne Schutzdaten — keine Warnung, auffindbar.
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
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

type App = ReturnType<typeof buildApp>;

let app: App;
let token = "";
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
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const res = await app.inject({
      method: (init.method ?? "GET") as "GET",
      url: String(input),
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

async function blattOeffnen(): Promise<void> {
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
                  { initialEntries: ["/capture/frontdoor"] },
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

async function klick(el: Element | null): Promise<void> {
  expect(el, `Bedienelement fehlt. Sichtbar: ${seitentext().slice(0, 600)}`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
    await flush();
  });
  await act(flush);
}

/** Inhalt ins Blatt schreiben — der contentEditable-Weg, den ein Mensch geht. */
async function schreiben(html: string): Promise<void> {
  const el = container.querySelector('[role="textbox"]');
  expect(el, `Body-Editor fehlt. Sichtbar: ${seitentext().slice(0, 600)}`).toBeTruthy();
  await act(async () => {
    (el as HTMLElement).innerHTML = html;
    (el as HTMLElement).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function internWaehlen(): Promise<void> {
  await klick(container.querySelector('[data-testid="blatt-werkzeug-vertraulichkeit"]'));
  const menue = container.querySelector('[data-testid="blatt-menue-vertraulichkeit"]');
  const wort = i18n.t("conf.level.intern");
  const eintrag = [...(menue?.querySelectorAll("button") ?? [])].find((b) =>
    (b.textContent ?? "").includes(wort),
  );
  await klick(eintrag ?? null);
}

async function warteAuf(sel: string, frist = 15_000): Promise<HTMLElement> {
  const ende = Date.now() + frist;
  for (;;) {
    const el = container.querySelector(sel);
    if (el instanceof HTMLElement) {
      return el;
    }
    if (Date.now() > ende) {
      throw new Error(`${sel} kam nicht. Sichtbar: ${seitentext().slice(0, 800)}`);
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

async function bibliothek(q: string): Promise<{ id: string; title: string }[]> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { id: string; title: string }[];
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "r0658-blatt@example.test", password: "geheim-r0658-b" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "r0658-blatt@example.test", password: "geheim-r0658-b" },
  });
  token = (login.json() as { token: string }).token;
  brueckeAufbauen();
});

afterEach(async () => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
  await app.close();
});

describe("R-0658 · die Quarantänewarnung beim Einreichen über das Blatt", () => {
  it("W1 · Personalnummer eingegeben: sichtbare, zugeordnete Warnung — und kein Treffer in der Bibliothek", async () => {
    await blattOeffnen();
    await schreiben(
      "<h2>Lohnabrechnung Schutzwortalpha</h2><p>Für die Abrechnung gilt Personalnummer: 12345678 laut Stammblatt.</p>",
    );
    await internWaehlen();
    await klick(container.querySelector('[data-testid="blatt-einreichen"]'));

    const warnung = await warteAuf('[data-testid="blatt-schutzdaten-warnung"]');
    expect(warnung.getAttribute("role")).toBe("alert");
    expect(warnung.textContent).toBe(
      i18n.t("schutzdaten.warnung", { arten: i18n.t("schutzdaten.art.personalnummer") }),
    );
    // Die Warnung nennt die ART, nie den Wert.
    expect(warnung.textContent).not.toContain("12345678");
    // Zugeordnet: die Erfolgszeile (sie bekommt nach dem Einreichen den Fokus) verweist auf sie.
    const zeile = container.querySelector('[data-testid="blatt-lage"]');
    const verweis = zeile?.getAttribute("aria-describedby") ?? "";
    expect(verweis.length).toBeGreaterThan(0);
    expect(container.ownerDocument.getElementById(verweis)).toBe(warnung);

    // Der TATSÄCHLICHE Ausschluss — über die Bibliotheksroute, nicht über die Anzeige.
    expect((await bibliothek("Schutzwortalpha")).map((k) => k.title)).not.toContain(
      "Lohnabrechnung Schutzwortalpha",
    );
    expect(await bibliothek("12345678")).toEqual([]);
  });

  it("W2 · POSITIVER KONTROLLFALL: ohne Schutzdaten keine Warnung — und auffindbar", async () => {
    await blattOeffnen();
    await schreiben(
      "<h2>Lohnabrechnung Sauberwortbeta</h2><p>Für die Abrechnung gilt das Stammblatt der Personalabteilung.</p>",
    );
    await internWaehlen();
    await klick(container.querySelector('[data-testid="blatt-einreichen"]'));

    // Gewartet wird auf die ERFOLGSZEILE, nicht auf irgendeine Lage desselben Ankers.
    const eingereicht = i18n.t("erfassen.eingereicht");
    const ende = Date.now() + 15_000;
    const lageText = (): string =>
      container.querySelector('[data-testid="blatt-lage"]')?.textContent ?? "";
    while (!lageText().includes(eingereicht)) {
      if (Date.now() > ende) {
        throw new Error(`Keine Erfolgszeile. Sichtbar: ${seitentext().slice(0, 800)}`);
      }
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });
    }
    const zeile = container.querySelector('[data-testid="blatt-lage"]') as HTMLElement;
    expect(container.querySelector('[data-testid="blatt-schutzdaten-warnung"]')).toBeNull();
    expect(zeile.getAttribute("aria-describedby")).toBeNull();
    expect((await bibliothek("Sauberwortbeta")).map((k) => k.title)).toContain(
      "Lohnabrechnung Sauberwortbeta",
    );
  });
});
