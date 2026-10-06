// @vitest-environment jsdom
// ================================================================================================
// Q3d · DIE STUFENFRAGE BEIM VALIDIEREN — ÜBER DEN ECHTEN WEG BIS ZUM GESPEICHERTEN BESTAND.
// ================================================================================================
//
// BEN-Befund K9 zu Kandidat 27c4a92d: die übrigen Fälle in `tests/validierung-stufe/**` ersetzen
// die Endpunkte; die verlangte Messung der Validierungsroute/-dienstkette bis zum gespeicherten
// Bibliothekszustand fehlte, und der Administratorweg war im Prüfbericht nicht ausgeführt.
//
// WAS HIER ECHT IST (Bauform aus `tests/vertraulichkeit-hinweis/einreichen-ohne-stufe-erklaert-
// sich.test.tsx`): die Seite `pages/Validation.tsx` mit ihren echten Providern, der echte
// API-Client, die echte Fastify-Anwendung mit Rechten und Persistenz. Der EINZIGE Ersatz ist der
// Transport (`fetch` → `app.inject`). Der uneingestufte Altbestand entsteht über den Dienst
// (`ko.create` ohne Stufe — so, wie er im Bestand liegt; die öffentliche Route verlangt seit
// JOB 3429 eine Stufe und kann ihn nicht mehr erzeugen).
//
//   A1 · Administrator, Menü „Als wahr kennzeichnen": Rückfrage, dann die Stufenfrage — VOR der
//        Antwort kein Schreibaufruf; nach der Wahl stehen KO und Bibliothek auf „validiert" mit
//        genau dieser Stufe.
//   A2 · Administrator, Übergehen („ohne Stufe"): validiert, KEINE erfundene Einstufung.
//   C1 · Controller, regulärer Freigabeknopf: dieselbe Frage, dieselbe Zusage bis zur Bibliothek.
//   D1 · ein echter Doppel-Eintrag (OverlapService) steht ZUSÄTZLICH als Paarhinweis auf der
//        Prüfkarte; „validiert + Stufe" bleibt trotzdem regulär in der Bibliothek.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Validation } from "../../apps/web/src/pages/Validation";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

type Services = ReturnType<typeof buildServices>;
type App = ReturnType<typeof buildApp>;

let services: Services;
let app: App;
let token = "";
let anfragen: { method: string; url: string; body: string }[] = [];
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const ADMIN = { name: "Pedi", email: "q3d-admin@example.test", password: "geheim-q3d-1" };
const CONTROLLER = { name: "Cora", email: "q3d-ctrl@example.test", password: "geheim-q3d-2" };

function de(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const res = await app.inject({
      method: (init.method ?? "GET") as "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    anfragen.push({ method: init.method ?? "GET", url, body: init.body ?? "" });
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

async function anmelden(zugang: { email: string; password: string }): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: zugang.email, password: zugang.password },
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { token: string }).token;
}

/** Ein uneingestufter Altbestand — über den Dienst, ohne Stufe, von einer anderen Person. */
async function altbestand(titel: string, needed = 1): Promise<string> {
  const ko = await services.ko.create({
    title: titel,
    statement: `${titel}: vor dem Anfahren den Druck ablassen.`,
    type: "best_practice",
    category: "Wartung",
    author: "fremd-autor",
    tags: [],
    neededValidations: needed,
  });
  expect(ko.confidentiality, "die Vorbedingung „uneingestuft“ trägt nicht").toBeUndefined();
  return ko.id;
}

async function warteBis(bedingung: () => boolean | Promise<boolean>, frist = 15_000) {
  const ende = Date.now() + frist;
  while (!(await bedingung())) {
    if (Date.now() > ende) {
      throw new Error("Zustand nicht erreicht");
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
}

async function brettMontieren(): Promise<void> {
  await i18n.changeLanguage("de");
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
                MemoryRouter,
                { initialEntries: ["/validierung"] },
                createElement(Validation),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await warteBis(() => container.querySelector('[data-testid="pruefen-karte"]') !== null);
}

function finde(sel: string): HTMLElement | null {
  return container.querySelector(sel) as HTMLElement | null;
}

function knopfMitText(text: string): HTMLElement | null {
  for (const b of [...container.querySelectorAll("button")]) {
    if ((b.textContent ?? "").trim() === text) {
      return b as HTMLElement;
    }
  }
  return null;
}

async function klick(el: Element | null): Promise<void> {
  expect(el, "das Bedienelement fehlt").toBeTruthy();
  await act(async () => {
    (el as HTMLElement).click();
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Alle Schreibaufrufe der Oberfläche auf ein Wissensobjekt, in Absendereihenfolge. */
function schreibaufrufe(koId: string): Record<string, unknown>[] {
  return anfragen
    .filter((a) => a.method === "PUT" && a.url === `/api/kos/${koId}`)
    .map((a) => JSON.parse(a.body) as Record<string, unknown>);
}

async function koLesen(koId: string): Promise<Record<string, unknown>> {
  const res = await app.inject({
    method: "GET",
    url: `/api/kos/${koId}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Record<string, unknown>;
}

/** Der Bibliothekszustand — über die reguläre Suche, so wie die Bibliothek ihn liest. */
async function bibliothek(q: string, koId: string): Promise<Record<string, unknown> | undefined> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as Record<string, unknown>[]).find((k) => k.id === koId);
}

beforeEach(async () => {
  window.localStorage.clear();
  anfragen = [];
  services = buildServices();
  app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
  const adminToken = await anmelden(ADMIN);
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { ...CONTROLLER, role: "controller" },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  token = adminToken;
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

describe("Q3d · Administrator: „Als wahr kennzeichnen“ fragt nach der Stufe — bis in die Bibliothek", () => {
  it("A1 · Frage vor jedem Schreibaufruf; nach der Wahl validiert + gewählte Stufe in KO und Bibliothek", async () => {
    const koId = await altbestand("Stufenwortalpha Pumpe");
    await brettMontieren();

    await klick(finde('[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(de("val.markTrue")));
    await klick(knopfMitText(de("val.markTrueYes")));
    expect(finde('[data-testid="pruefen-stufenfrage"]'), "die Stufenfrage fehlt").not.toBeNull();
    expect(schreibaufrufe(koId), "vor der Antwort wurde geschrieben").toEqual([]);

    await klick(finde('[data-testid="pruefen-stufenfrage-wahl-vertraulich"]'));
    await warteBis(async () => (await koLesen(koId)).status === "validiert");

    expect(schreibaufrufe(koId).map((b) => b.action)).toEqual([
      "confidentiality",
      "admin-validate",
    ]);
    const ko = await koLesen(koId);
    expect(ko.status).toBe("validiert");
    expect(ko.confidentiality).toBe("vertraulich");
    const eintrag = await bibliothek("Stufenwortalpha", koId);
    expect(eintrag, "das validierte Objekt fehlt in der Bibliothek").toBeDefined();
    expect(eintrag?.status).toBe("validiert");
    expect(eintrag?.confidentiality).toBe("vertraulich");
  });

  it("A2 · Übergehen: validiert, aber KEINE erfundene Einstufung", async () => {
    const koId = await altbestand("Stufenwortbeta Ventil");
    await brettMontieren();

    await klick(finde('[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(de("val.markTrue")));
    await klick(knopfMitText(de("val.markTrueYes")));
    await klick(finde('[data-testid="pruefen-stufenfrage-ohne"]'));
    await warteBis(async () => (await koLesen(koId)).status === "validiert");

    expect(schreibaufrufe(koId).map((b) => b.action)).toEqual(["admin-validate"]);
    const ko = await koLesen(koId);
    expect(ko.confidentiality ?? null).toBeNull();
    expect(ko.confidentialityProvenance).toBe("unknown");
    const eintrag = await bibliothek("Stufenwortbeta", koId);
    expect(eintrag?.status).toBe("validiert");
    expect(eintrag?.confidentiality ?? null).toBeNull();
  });
});

describe("Q3d · Controller: der reguläre Freigabeknopf fragt nach der Stufe — bis in die Bibliothek", () => {
  it("C1 · Frage vor jedem Schreibaufruf; nach der Wahl validiert + gewählte Stufe", async () => {
    const koId = await altbestand("Stufenwortgamma Filter");
    token = await anmelden(CONTROLLER);
    await brettMontieren();

    await klick(finde('[data-testid="pruefen-entscheidung-up"]'));
    expect(finde('[data-testid="pruefen-stufenfrage"]')).not.toBeNull();
    expect(schreibaufrufe(koId), "vor der Antwort wurde geschrieben").toEqual([]);

    await klick(finde('[data-testid="pruefen-stufenfrage-wahl-streng_vertraulich"]'));
    await warteBis(async () => (await koLesen(koId)).status === "validiert");

    expect(schreibaufrufe(koId)).toEqual([
      { action: "confidentiality", level: "streng_vertraulich" },
      { action: "rate", verdict: "up" },
    ]);
    const ko = await koLesen(koId);
    expect(ko.confidentiality).toBe("streng_vertraulich");
    const eintrag = await bibliothek("Stufenwortgamma", koId);
    expect(eintrag?.status).toBe("validiert");
    expect(eintrag?.confidentiality).toBe("streng_vertraulich");
  });
});

describe("Q3d · der Doppelhinweis kommt ZUSÄTZLICH — die Bibliothek bleibt regulär", () => {
  it("D1 · echter Doppel-Eintrag: Paarhinweis auf der Karte, danach validiert + Stufe in der Bibliothek", async () => {
    const koId = await altbestand("Stufenwortdelta Kompressor");
    // Das zweite Exemplar ist bereits validiert und steht deshalb nicht selbst auf dem Brett.
    const zwilling = await services.ko.create({
      title: "Stufenwortdelta Kompressor (Kopie)",
      statement: "Stufenwortdelta Kompressor: vor dem Anfahren den Druck ablassen.",
      type: "best_practice",
      category: "Wartung",
      author: "fremd-autor",
      tags: [],
      confidentiality: "intern",
    });
    await services.ko.setValidationState(zwilling.id, { trust: 80, status: "validiert" });
    await services.overlaps.createAuto(
      {
        koA: koId,
        koB: zwilling.id,
        relation: "identisch",
        aspects: [],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 1 },
    );
    await brettMontieren();
    await warteBis(() => finde('[data-testid="pruefen-doppelhinweis"]') !== null);
    expect(finde('[data-testid="pruefen-doppelhinweis"]')?.textContent).toContain(
      de("dup.relation.identisch"),
    );

    await klick(finde('[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(de("val.markTrue")));
    await klick(knopfMitText(de("val.markTrueYes")));
    await klick(finde('[data-testid="pruefen-stufenfrage-wahl-intern"]'));
    await warteBis(async () => (await koLesen(koId)).status === "validiert");

    const eintrag = await bibliothek("Stufenwortdelta", koId);
    expect(eintrag?.status).toBe("validiert");
    expect(eintrag?.confidentiality).toBe("intern");
  });
});
