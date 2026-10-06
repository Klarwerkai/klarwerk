// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-erfassung-einstieg` — DAS BLATT AM ECHTEN SERVER: Fehlersatz, Knopffolge, Blick.
// ================================================================================================
//
// WAS HIER ECHT IST (Bauform aus `tests/vertraulichkeit-hinweis/einreichen-ohne-stufe-erklaert-
// sich.test.tsx`): das Blatt unter `CaptureFrontDoor`, gemountet mit seinen Providern, der echte
// API-Client und die echte Fastify-Anwendung mit Routen, Rechten und Speicherablage. Der Transport
// liegt auf `app.inject` (kein Horchsocket, kein Docker, keine Datenbank).
//
// WAS GEFÄLSCHT IST: nur der Modelllauf (`reasoner.*`), und in E1/E2 ein AUFRUFER, der das Blatt
// nicht selbst sein kann. Das Blatt baut jedes Feld seiner Nutzlast selbst (`buildFrontDoorPayload`)
// — eine Zahl statt eines Titels oder ein Rumpf über der Servergrenze entsteht dort nicht. R-0080
// fragt aber genau danach: „Schickt ein Aufrufer statt eines Textes eine Zahl …". Die Brücke
// verändert deshalb die EINE ausgehende Anlage, bevor sie beim echten Server ankommt; die Antwort,
// die zurückkommt, ist die des Servers, unverändert. Die Kalibrierung E0 zeigt, dass derselbe Weg
// ohne Eingriff speichert.
//
//   E0 · Kalibrierung: ohne Eingriff wird gesichert, kein roter Kasten.
//   E1 · R-0080: Zahl statt Titel → 400 vom Server → übersetzter Satz, kein `draftPayload`, Text
//        bleibt, kein Entwurf entsteht — in DE, EN und NL.
//   E2 · R-1002: Rumpf über 5 MiB → 413 vom Server → „zu lang", nicht „fehlgeschlagen" — DE, EN, NL.
//   E3 · R-0084: beide Knöpfe tragen ihre Folge als aufgelöste Beschreibung — DE, EN, NL.
//   E4 · R-0084: nach dem Einreichen steht der Fokus auf der Erfolgszeile — DE, EN, NL.
//   E5 · Zeitüberschreitung (`fehlerfaelle`, Kriterium 2): die Anlage kommt nicht zurück → nach der
//        Speicherfrist der übersetzte Fristsatz, Eingabe bleibt — DE, EN, NL. Gefälscht ist hier
//        nur das Ausbleiben der Antwort (die Brücke hält die Anfrage fest), nicht der Satz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Verändert die nächste Anlage `POST /api/drafts`, bevor sie beim Server ankommt. */
  anlageUmbauen: null as null | ((rumpf: Record<string, unknown>) => Record<string, unknown>),
  /** Hält die nächste Anlage `POST /api/drafts` fest: sie erreicht den Server nie und kommt nie zurück. */
  anlageHalten: false,
  gehalten: 0,
  antworten: [] as { method: string; url: string; status: number }[],
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
import {
  FRONT_DOOR_SAVE_TIMEOUT_MESSAGE,
  FRONT_DOOR_SAVE_TIMEOUT_MS,
} from "../../apps/web/src/lib/captureFrontDoor";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const SPRACHEN = ["de", "en", "nl"] as const;
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
    if (method === "POST" && /\/api\/drafts$/.test(url) && bruecke.anlageHalten) {
      bruecke.anlageHalten = false;
      bruecke.gehalten += 1;
      return new Promise(() => {});
    }
    if (method === "POST" && /\/api\/drafts$/.test(url) && bruecke.anlageUmbauen && body) {
      body = JSON.stringify(bruecke.anlageUmbauen(JSON.parse(body) as Record<string, unknown>));
      bruecke.anlageUmbauen = null;
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
  bruecke.anlageHalten = false;
  bruecke.gehalten = 0;
  bruecke.antworten = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@einstieg.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@einstieg.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/** Der gespeicherte Bestand an Entwürfen — beim Server erfragt, nicht aus Aufrufen abgelesen. */
async function entwuerfeAmServer(): Promise<unknown[]> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  const daten = JSON.parse(res.body) as unknown;
  return Array.isArray(daten) ? daten : ((daten as { items?: unknown[] }).items ?? []);
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

async function titelSetzen(wert: string): Promise<void> {
  const feld = element('[data-testid="blatt-titel"]', HTMLInputElement);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(feld, wert);
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    feld.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function textSchreiben(): Promise<void> {
  const el = element('[role="textbox"]', HTMLElement);
  await act(async () => {
    el.innerHTML = KOERPER;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

async function blattFuellen(): Promise<void> {
  await titelSetzen(TITEL);
  await textSchreiben();
}

function lage(): string {
  return (container.querySelector('[data-testid="blatt-lage"]')?.textContent ?? "").replace(
    /\s+/g,
    " ",
  );
}

async function sichern(): Promise<void> {
  const knopf = element('[data-testid="blatt-entwurf-sichern"]', HTMLButtonElement);
  expect(knopf.disabled, `Entwurf sichern ist gesperrt. ${seitentext().slice(0, 500)}`).toBe(false);
  await klick(knopf);
}

/** Die Beschreibung, AUFGELÖST: `aria-describedby` nennt eine `id`, unter der der Satz steht. */
function beschreibungVon(el: Element): string | null {
  const id = el.getAttribute("aria-describedby");
  if (!id) {
    return null;
  }
  return container.ownerDocument.getElementById(id)?.textContent ?? null;
}

async function stufeWaehlen(): Promise<void> {
  await klick(element('[data-testid="blatt-werkzeug-vertraulichkeit"]', HTMLButtonElement));
  const flaeche = element('[data-testid="blatt-menue-vertraulichkeit"]', HTMLElement);
  const beschriftung = i18n.t("conf.level.intern");
  const eintrag = [...flaeche.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  if (!(eintrag instanceof HTMLButtonElement)) {
    throw new Error(`Eintrag „${beschriftung}“ fehlt im Menü.`);
  }
  await klick(eintrag);
}

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  brueckeAufbauen();
  await serverStarten();
});

afterEach(async () => {
  vi.useRealTimers();
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  await i18n.changeLanguage("de");
});

describe("Erfassungseinstieg · der rote Kasten sagt den richtigen Satz (R-0080, R-1002)", () => {
  it("E0 · Kalibrierung: derselbe Weg ohne Eingriff sichert, ohne roten Kasten", async () => {
    await i18n.changeLanguage("de");
    await blattOeffnen();
    await blattFuellen();
    await sichern();
    expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).not.toBeNull();
    expect(lage()).not.toContain(i18n.t("einstieg.fehler.form"));
    expect(await entwuerfeAmServer()).toHaveLength(1);
  });

  for (const sprache of SPRACHEN) {
    it(`E1 · ${sprache}: Zahl statt Titel → Server 400 → übersetzter Satz, Eingabe bleibt, nichts gespeichert`, async () => {
      await i18n.changeLanguage(sprache);
      await blattOeffnen();
      await blattFuellen();
      bruecke.anlageUmbauen = (rumpf) => ({ ...rumpf, title: 123 });
      await sichern();

      // Der Server hat WIRKLICH mit 400 geantwortet — sonst mäße der Satz nichts.
      const anlage = bruecke.antworten.filter(
        (a) => a.method === "POST" && /\/api\/drafts$/.test(a.url),
      );
      expect(anlage.map((a) => a.status)).toEqual([400]);

      expect(lage()).toContain(i18n.t("einstieg.fehler.form"));
      expect(lage()).not.toContain("draftPayload");
      expect(seitentext()).not.toContain("draftPayload");
      // Die Eingabe ist nicht verloren, und es gibt keinen Entwurf, den der Satz verschwiege.
      expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(TITEL);
      expect(seitentext()).toContain("Nullpunkt am HMI");
      expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).toBeNull();
      expect(await entwuerfeAmServer()).toHaveLength(0);
      // Der Wiederholweg aus §9 bleibt.
      expect(container.querySelector('[data-testid="blatt-erneut"]')).not.toBeNull();
    });
  }

  for (const sprache of SPRACHEN) {
    it(`E2 · ${sprache}: Rumpf über der Servergrenze → Server 413 → „zu lang“, nicht „fehlgeschlagen“`, async () => {
      await i18n.changeLanguage(sprache);
      await blattOeffnen();
      await blattFuellen();
      const zuGross = `<p>${"x".repeat(6 * 1024 * 1024)}</p>`;
      bruecke.anlageUmbauen = (rumpf) => ({ ...rumpf, bodyHtml: zuGross });
      await sichern();

      const anlage = bruecke.antworten.filter(
        (a) => a.method === "POST" && /\/api\/drafts$/.test(a.url),
      );
      expect(anlage.map((a) => a.status)).toEqual([413]);
      expect(lage()).toContain(i18n.t("einstieg.fehler.zuLang"));
      expect(lage()).not.toContain(i18n.t("fd.errSaveFailed"));
      // Nicht der Serversatz (deutsch, „Uebernahme"), sondern der Satz der Sitzungssprache.
      expect(lage()).not.toMatch(/zu gross|Uebernahme/);
      expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(TITEL);
      expect(await entwuerfeAmServer()).toHaveLength(0);
    });
  }

  for (const sprache of SPRACHEN) {
    it(`E5 · ${sprache}: die Anlage kommt nicht zurück → nach der Speicherfrist der Fristsatz, Eingabe bleibt`, async () => {
      await i18n.changeLanguage(sprache);
      await blattOeffnen();
      await blattFuellen();
      bruecke.anlageHalten = true;

      vi.useFakeTimers({ shouldAdvanceTime: true });
      await sichern();
      // Die Anfrage hängt wirklich — sonst mäße der Satz eine andere Lage.
      expect(bruecke.gehalten).toBe(1);
      expect(lage()).not.toContain(i18n.t("einstieg.fehler.frist"));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(FRONT_DOOR_SAVE_TIMEOUT_MS + 100);
        await flush();
      });
      vi.useRealTimers();
      await act(flush);

      expect(lage(), `kein Fristsatz. Sichtbar: ${seitentext().slice(0, 600)}`).toContain(
        i18n.t("einstieg.fehler.frist"),
      );
      expect(lage()).not.toContain(i18n.t("fd.errSaveFailed"));
      // Die interne (deutsche) Meldung des Fehlerobjekts erscheint in keiner Sprache.
      expect(seitentext()).not.toContain(FRONT_DOOR_SAVE_TIMEOUT_MESSAGE);
      expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe(TITEL);
      expect(seitentext()).toContain("Nullpunkt am HMI");
      expect(container.querySelector('[data-testid="blatt-entwurf-gespeichert"]')).toBeNull();
      expect(await entwuerfeAmServer()).toHaveLength(0);
    });
  }
});

describe("Erfassungseinstieg · Entwurf und Einreichen erklären ihre Folge (R-0084)", () => {
  for (const sprache of SPRACHEN) {
    it(`E3 · ${sprache}: jeder Knopf trägt seine Folge als aufgelöste Beschreibung`, async () => {
      await i18n.changeLanguage(sprache);
      await blattOeffnen();
      const sichernKnopf = element('[data-testid="blatt-entwurf-sichern"]', HTMLButtonElement);
      const einreichen = element('[data-testid="blatt-einreichen"]', HTMLButtonElement);
      expect(beschreibungVon(sichernKnopf)).toBe(i18n.t("einstieg.knopf.entwurf"));
      expect(beschreibungVon(einreichen)).toBe(i18n.t("einstieg.knopf.einreichen"));
      expect(sichernKnopf.title).toBe(i18n.t("einstieg.knopf.entwurf"));
      expect(einreichen.title).toBe(i18n.t("einstieg.knopf.einreichen"));
      // Die beiden Sätze sind verschieden — sonst wäre nichts unterschieden.
      expect(beschreibungVon(sichernKnopf)).not.toBe(beschreibungVon(einreichen));
      // Ohne Lesen unterscheidbar: umrandet gegen gefüllt.
      expect(sichernKnopf.className).toContain("border");
      expect(einreichen.className).not.toContain("border");
      // Kein Absatz auf der Fläche (Zielbild H3): die Sätze stehen verborgen, nicht als Text.
      expect(container.ownerDocument.getElementById("blatt-folge-entwurf")?.hidden).toBe(true);
    });
  }

  for (const sprache of SPRACHEN) {
    it(`E4 · ${sprache}: nach dem Einreichen steht der Fokus auf der Erfolgszeile, nicht auf dem leeren Blatt`, async () => {
      await i18n.changeLanguage(sprache);
      await blattOeffnen();
      await blattFuellen();
      await stufeWaehlen();
      const einreichen = element('[data-testid="blatt-einreichen"]', HTMLButtonElement);
      einreichen.focus();
      await klick(einreichen);

      const zeile = container.querySelector('[data-testid="blatt-lage"]');
      expect(lage(), `kein Erfolg. Sichtbar: ${seitentext().slice(0, 600)}`).toContain(
        i18n.t("erfassen.eingereicht"),
      );
      expect(document.activeElement).toBe(zeile);
      // Gegenprobe: das Blatt ist wirklich leer geräumt — der Sprung ist also nötig.
      expect(element('[data-testid="blatt-titel"]', HTMLInputElement).value).toBe("");
    });
  }
});
