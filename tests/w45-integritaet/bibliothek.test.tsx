// @vitest-environment jsdom
// Review Runde 2 · Bereich BIBLIOTHEK-EDITOR (BIB) · Belegdatei, nur Scratchpad-Export.
// Echter Server im selben Prozess (buildApp(buildServices()), app.inject), Oberfläche in jsdom.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider, useNavGuard } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { BibliothekFlaeche } from "../../apps/web/src/components/bibliothek/BibliothekFlaeche";
import { BibliothekLesen } from "../../apps/web/src/components/bibliothek/BibliothekLesen";
import { Verantwortung } from "../../apps/web/src/components/bibliothek/Verantwortung";
import i18n from "../../apps/web/src/i18n";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(Element.prototype as unknown as { scrollIntoView: () => void }).scrollIntoView = () => {};

let app: App;
let services: ReturnType<typeof buildServices>;
let flaechenToken = "";
let adminToken = "";
let zweiterAdminToken = "";
let experteToken = "";
const putProtokoll: { url: string; body: Record<string, unknown> }[] = [];
let rateStoerung = 0;

function transportEinhaengen(): void {
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode === "PUT" && init?.body) {
      try {
        const b = JSON.parse(String(init.body)) as Record<string, unknown>;
        putProtokoll.push({ url, body: b });
        if (b.action === "rate" && rateStoerung > 0) {
          rateStoerung--;
          const k = JSON.stringify({ error: "ERROR", message: "Verbindung unterbrochen." });
          return { status: 503, ok: false, statusText: "503", text: async () => k };
        }
      } catch {
        /* kein JSON */
      }
    }
    const kopf: Record<string, string> = {};
    if (init?.headers) {
      new Headers(init.headers as HeadersInit).forEach((wert, name) => {
        kopf[name] = wert;
      });
    }
    if (flaechenToken) {
      kopf.authorization = `Bearer ${flaechenToken}`;
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers: kopf,
      ...(init?.body === undefined || init?.body === null
        ? {}
        : { payload: String(init.body as string) }),
    });
    return {
      status: antwort.statusCode,
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof fetch;
}

async function token(email: string, password = "secret123"): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}
async function konto(rolle: string, email: string): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return token(email);
}
async function objektAnlegen(
  titel = "Ventil X schließt bei Überdruck",
  aussage = "Bei Überdruck Ventil X manuell schließen.",
): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: aussage,
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  await services.aiCheckWorker?.idle();
  return (angelegt.json() as { id: string }).id;
}
async function put(tok: string, id: string, payload: Record<string, unknown>) {
  const r = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${tok}` },
    payload,
  });
  return { status: r.statusCode, json: r.json() as Record<string, unknown> };
}
interface Serverstand {
  version: number;
  status: string;
  statement: string;
  spaceId?: string;
  proposals?: { id: string; status: string; baseVersion: number; statement: string }[];
}
async function stand(id: string): Promise<Serverstand> {
  const a = await app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${adminToken}` },
  });
  expect(a.statusCode).toBe(200);
  return a.json() as Serverstand;
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let qc: QueryClient;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};
let navGuardSonde: ReturnType<typeof useNavGuard> | null = null;
function Sonde(): null {
  navGuardSonde = useNavGuard();
  return null;
}
function baum(inhalt: ReturnType<typeof createElement>, pfad: string) {
  return createElement(
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
              { initialEntries: [pfad] },
              createElement(Sonde, null),
              createElement(ImageDescribeProvider, null, inhalt),
              createElement(ToastViewport, null),
            ),
          ),
        ),
      ),
    ),
  );
}
const lesen = (koId: string) =>
  createElement(BibliothekLesen, {
    key: koId,
    koId,
    suchtext: "",
    treffer: [],
    onGeloescht: () => {},
    hinweisSchonGesagt: true,
    lesevarianteSchonGesagt: true,
  });
async function abbauen(): Promise<void> {
  if (root) {
    const r = root;
    await act(async () => {
      r.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
}
async function render(
  inhalt: ReturnType<typeof createElement>,
  pfad = "/bibliothek?edit=1",
): Promise<void> {
  if (!root) {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  }
  const r = root;
  await act(async () => {
    r.render(baum(inhalt, pfad));
    await flush();
  });
  await act(flush);
  await act(flush);
}
const text = (e: Element | null): string => (e?.textContent ?? "").replace(/\s+/g, " ").trim();
async function klick(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}
function knopfMitText(beschriftung: string): HTMLButtonElement {
  const treffer = [...document.body.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === beschriftung,
  );
  if (!treffer) {
    throw new Error(`Knopf „${beschriftung}" fehlt`);
  }
  return treffer;
}
function aussagefeld(): HTMLTextAreaElement | null {
  const beschriftung = i18n.t("capture.fStatement");
  return (
    [...document.body.querySelectorAll("label")]
      .find((l) => l.querySelector("span")?.textContent?.trim() === beschriftung)
      ?.querySelector("textarea") ?? null
  );
}
async function tippen(feld: HTMLTextAreaElement, wert: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}
const MEIN_TEXT = "BELEG-MEIN: Bei Überdruck Ventil X ZUERST entlasten, dann schließen.";
const FREMD_TEXT = "BELEG-FREMD: Ventil X nur mit Zweitperson schließen (Sicherheitsvorgabe).";

beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  transportEinhaengen();
  putProtokoll.length = 0;
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pia Beispiel", email: "pia@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pia@klarwerk.test");
  zweiterAdminToken = await konto("admin", "admin2@klarwerk.test");
  experteToken = await konto("experte", "experte@klarwerk.test");
  await konto("experte", "experte2@klarwerk.test");
  await konto("controller", "controller@klarwerk.test");
  flaechenToken = adminToken;
  await i18n.changeLanguage("de");
});
afterEach(async () => {
  await abbauen();
  qc?.clear();
  await app.close();
});

function erforderlich<T>(wert: T | null | undefined): T {
  if (wert === null || wert === undefined) throw new Error("Prüfaufbau: erwartetes Element fehlt");
  return wert;
}

describe("W4.5 Bibliothekseditor", () => {
  it("Freigabe außerhalb eines Space sendet die tatsächlich angezeigte expectedVersion", async () => {
    const id = await objektAnlegen();
    const kontoId = erforderlich(await services.ko.get(id)).author;
    await services.ko.setOwnership(id, { owner: kontoId, reviewers: [], validators: [] }, kontoId);
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    const ko = res.json();
    expect(ko.spaceId).toBeUndefined();
    await render(
      createElement(Verantwortung, {
        ko,
        angemeldet: ko.ownership.owner,
        darfFreigeben: true,
        nameOf: (id: string) => id,
      }),
      "/bibliothek",
    );
    putProtokoll.length = 0;
    await klick(knopfMitText(i18n.t("verantwortung.freigeben")));
    const schreiben = putProtokoll.find((x) => x.body.action === "owner-validate");
    expect(schreiben?.body.expectedVersion).toBe(ko.version);
  });

  it("Einreichen bleibt bei der Öffnungsfassung, zeigt 409 und behält eigenen Text", async () => {
    const id = await objektAnlegen();
    expect((await put(zweiterAdminToken, id, { action: "admin-validate" })).status).toBe(200);
    const v0 = await stand(id);
    flaechenToken = experteToken;
    await render(lesen(id));
    await tippen(erforderlich(aussagefeld()), MEIN_TEXT);
    expect(
      (
        await put(adminToken, id, {
          action: "revise",
          changes: { statement: FREMD_TEXT, bodyHtml: `<p>${FREMD_TEXT}</p>` },
          expectedVersion: v0.version,
        })
      ).status,
    ).toBe(200);
    expect((await put(zweiterAdminToken, id, { action: "admin-validate" })).status).toBe(200);
    await act(async () => {
      await qc.invalidateQueries({ queryKey: ["ko"] });
      await flush();
    });
    putProtokoll.length = 0;
    await klick(knopfMitText(i18n.t("ko.propose.submit")));
    const gesendet = erforderlich(putProtokoll.find((x) => x.body.action === "propose"));
    expect((gesendet.body.proposal as { baseVersion: number }).baseVersion).toBe(v0.version);
    expect(aussagefeld()?.value).toBe(MEIN_TEXT);
    expect((await stand(id)).statement).toBe(FREMD_TEXT);
    expect(text(document.querySelector('[data-testid="bib-einreichen-lage"]'))).toContain(
      i18n.t("ko.propose.staleVersion", { n: String((await stand(id)).version) }),
    );
  });

  it("unberührt ist sauber; Ändern, Bleiben und Speichern bedienen genau die eigene Wache", async () => {
    const id = await objektAnlegen();
    await render(lesen(id));
    const vor = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(vor);
    expect(vor.defaultPrevented).toBe(false);
    await tippen(erforderlich(aussagefeld()), MEIN_TEXT);
    const offen = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(offen);
    expect(offen.defaultPrevented).toBe(true);
    let gewechselt = 0;
    await act(async () => {
      navGuardSonde?.guard(() => {
        gewechselt++;
      });
      await flush();
    });
    expect(gewechselt).toBe(0);
    await klick(knopfMitText(i18n.t("nav.guard.stay")));
    expect(aussagefeld()?.value).toBe(MEIN_TEXT);
    erforderlich(navGuardSonde).setGuard({ isDirty: () => true, save: async () => {} });
    await klick(erforderlich(document.querySelector<HTMLElement>('[data-testid="bib-speichern"]')));
    expect((await stand(id)).statement).toBe(MEIN_TEXT);
    const gespeichert = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(gespeichert);
    expect(gespeichert.defaultPrevented).toBe(false);
    await act(async () => {
      erforderlich(navGuardSonde).guard(() => {
        gewechselt++;
      });
      await flush();
    });
    expect(gewechselt).toBe(0);
    await klick(knopfMitText(i18n.t("nav.guard.stay")));
    erforderlich(navGuardSonde).setGuard(null);
    await act(async () => {
      navGuardSonde?.guard(() => {
        gewechselt++;
      });
    });
    expect(gewechselt).toBe(1);
  });

  it("Abbrechen fragt nach; Hier bleiben verliert keinen Text", async () => {
    const id = await objektAnlegen();
    await render(lesen(id));
    await tippen(erforderlich(aussagefeld()), MEIN_TEXT);
    await klick(
      erforderlich(document.querySelector<HTMLElement>('[data-testid="bib-bearbeiten-abbrechen"]')),
    );
    expect(aussagefeld()?.value).toBe(MEIN_TEXT);
    await klick(knopfMitText(i18n.t("nav.guard.stay")));
    expect(aussagefeld()?.value).toBe(MEIN_TEXT);
  });

  it("der tatsächliche Listenwechsel wird vor dem Wechsel des Editor-Schlüssels bewacht", async () => {
    const a = await objektAnlegen("Ventil X");
    const b = await objektAnlegen(
      "Brandmelder Batterie",
      "Die Brandschutzprüfung findet jährlich im Januar statt.",
    );
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    });
    expect((await put(zweiterAdminToken, a, { action: "admin-validate" })).status).toBe(200);
    expect((await put(zweiterAdminToken, b, { action: "admin-validate" })).status).toBe(200);
    await render(createElement(BibliothekFlaeche, {}), `/bibliothek?eintrag=${a}&edit=1`);
    const listeEinblenden =
      document.querySelector('[data-testid="bib-liste-beim-bearbeiten"]') ??
      document.querySelector('[data-testid="bib-liste-schalter"]');
    if (listeEinblenden) await klick(listeEinblenden as HTMLElement);
    await tippen(erforderlich(aussagefeld()), MEIN_TEXT);
    const zeile = document.querySelector(
      `[data-testid="bib-zeile"][data-bib-id="${b}"]`,
    ) as HTMLElement;
    expect(zeile, document.body.textContent ?? "").not.toBeNull();
    await klick(zeile);
    expect(aussagefeld()?.value).toBe(MEIN_TEXT);
    await klick(knopfMitText(i18n.t("nav.guard.stay")));
    expect(aussagefeld()?.value).toBe(MEIN_TEXT);
  });
});
