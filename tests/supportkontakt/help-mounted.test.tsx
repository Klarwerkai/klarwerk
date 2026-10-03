// @vitest-environment jsdom
// ================================================================================================
// R-1064 · SUPPORTKONTAKT — DIE GEMOUNTETE HILFESEITE AN DER ECHTEN APP.
// ================================================================================================
//
// WAS HIER ECHT IST: die Seite `pages/Help.tsx` mit echtem Router und echtem i18n, der echte
// Leseweg `api/support.ts` → `api.get` → `fetch("/api/support")`, und dahinter die echte App
// (`buildApp`/`buildServices`) mit der Route aus `support-routes.ts`. Der EINZIGE Ersatz ist der
// Transport: `globalThis.fetch` liegt auf `app.inject` — dieselbe Bauform wie
// `tests/web/job2660-hilfe-fremdtext-ui.test.tsx` (dort begründet; die Bahn-Sandkiste lässt keinen
// Horchsocket zu).
//
// ZWEI FÄLLE SIND BEWUSST KEINE SERVERANTWORT, und sie sind als solche benannt:
//   · M5 — der Abruf scheitert im Transport (Netz weg). Das ist ein Fehler, keine erfundene Antwort.
//   · M7 — eine GEFÄLSCHTE Antwort, die der echte Server nie gibt (`javascript:` als Ziel). Sie
//          prüft die ZWEITE Prüfung im Client; ohne sie wäre diese Prüfung unbelegt.
//
// Die Ziele sind synthetisch (`.invalid`, RFC 2606) — keine echte Adresse, keine Zuständigkeit.
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Help } from "../../apps/web/src/pages/Help";
import { buildApp, buildServices } from "../../services/app/src/build-app";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const URL_NAME = "KLARWERK_SUPPORT_URL";
const LABEL_NAME = "KLARWERK_SUPPORT_LABEL";
const A = { url: "https://support-a.invalid/servicedesk", label: "Servicedesk A (Testziel)" };
const B = { url: "mailto:support-b@kunde-b.invalid" };

const SCHLUESSEL = [
  "help.support.title",
  "help.support.configured",
  "help.support.linkDefault",
  "help.support.mailDefault",
  "help.support.newTab",
  "help.support.notConfigured",
  "help.support.invalid",
  "help.support.loadError",
  "help.support.loading",
] as const;

// ------------------------------------------------------------------------------------------------
// DER DRAHT — Transport-Ersatz, sonst nichts.
// ------------------------------------------------------------------------------------------------
type Draht =
  | { art: "app"; app: FastifyInstance; token: string | null }
  | { art: "netz-weg" }
  | { art: "gefaelscht"; antwort: unknown };

let draht: Draht | null = null;
let vorherigerFetch: typeof globalThis.fetch;
const abrufe: string[] = [];
const offen: FastifyInstance[] = [];

function drahtLegen(): void {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    abrufe.push(url);
    if (!draht || draht.art === "netz-weg") {
      throw new TypeError("Failed to fetch");
    }
    if (draht.art === "gefaelscht") {
      const text = JSON.stringify(draht.antwort);
      return { status: 200, statusText: "200", ok: true, text: async () => text };
    }
    const kopf: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      kopf[name] = wert;
    });
    if (draht.token) {
      kopf.authorization = `Bearer ${draht.token}`;
    }
    const antwort = await draht.app.inject({
      method: (init?.method ?? "GET") as "GET",
      url,
      headers: kopf,
    });
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
}

/** Eine Installation mit genau diesen Werten; die Umgebung steht danach wieder wie vorher. */
async function installation(
  werte: { url?: string; label?: string },
  angemeldet = true,
): Promise<Draht> {
  const vorher = { url: process.env[URL_NAME], label: process.env[LABEL_NAME] };
  const setze = (name: string, wert: string | undefined): void => {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  };
  setze(URL_NAME, werte.url);
  setze(LABEL_NAME, werte.label);
  let app: FastifyInstance;
  try {
    app = buildApp(buildServices());
  } finally {
    setze(URL_NAME, vorher.url);
    setze(LABEL_NAME, vorher.label);
  }
  offen.push(app);
  await app.ready();
  if (!angemeldet) {
    return { art: "app", app, token: null };
  }
  const marke = Math.random().toString(36).slice(2, 8);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: `ada@${marke}.test`, password: "geheim12345" },
  });
  const adminLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: `ada@${marke}.test`, password: "geheim12345" },
  });
  await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminLogin.json().token}` },
    payload: { name: "Vera", email: `vera@${marke}.test`, password: "geheim12345", role: "viewer" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: `vera@${marke}.test`, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  return { art: "app", app, token: login.json().token as string };
}

// ------------------------------------------------------------------------------------------------
// FLÄCHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function hilfe(): Promise<HTMLElement> {
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(createElement(MemoryRouter, { initialEntries: ["/hilfe"] }, createElement(Help)));
    await durchlaufen();
  });
  return flaeche;
}

function karte(flaeche: HTMLElement): HTMLElement {
  const el = flaeche.querySelector<HTMLElement>('[data-testid="hilfe-support"]');
  if (!el) {
    throw new Error("Die Supportkarte steht nicht auf der Hilfeseite.");
  }
  return el;
}

const flach = (roh: string | null | undefined): string => (roh ?? "").replace(/\s+/g, " ").trim();

async function tippe(flaeche: HTMLElement, wert: string): Promise<void> {
  const feld = flaeche.querySelector<HTMLInputElement>('input[data-testid="hilfe-suche"]');
  expect(feld, "das Suchfeld fehlt").not.toBeNull();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await durchlaufen();
  });
}

/** Hilfe und Suche bleiben bedienbar: das Importkapitel wird gefunden, Unsinn findet nichts. */
async function sucheBedienbar(flaeche: HTMLElement): Promise<void> {
  const kapitel = (): number => flaeche.querySelectorAll("[data-hilfe-thema]").length;
  expect(kapitel(), "keine Kapitel auf der Hilfeseite").toBeGreaterThan(0);
  await tippe(flaeche, "import");
  const treffer = flaeche.querySelector('[data-hilfe-thema="fileimport"]');
  expect(treffer, "die Suche findet das Importkapitel nicht").not.toBeNull();
  await tippe(flaeche, "zzz-kein-kapitel-traegt-das");
  expect(flaeche.querySelectorAll("[data-hilfe-thema]")).toHaveLength(0);
  // Die Supportkarte ist kein Suchtreffer — sie bleibt stehen.
  expect(flaeche.querySelector('[data-testid="hilfe-support"]')).not.toBeNull();
  await tippe(flaeche, "");
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  abrufe.length = 0;
  drahtLegen();
});

afterEach(async () => {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  draht = null;
  globalThis.fetch = vorherigerFetch;
  for (const app of offen.splice(0)) {
    await app.close();
  }
  await i18n.changeLanguage("de");
});

describe("R-1064 · die Supportkarte der echten Hilfeseite", () => {
  it("M1: https-Kontakt mit Bezeichnung — sichtbarer Link, exaktes Ziel, neuer Tab angekündigt", async () => {
    draht = await installation(A);
    const k = karte(await hilfe());
    expect(abrufe, "die Seite hat den Supportweg gar nicht abgerufen").toContain("/api/support");
    expect(k.dataset.supportZustand).toBe("eingerichtet");
    const link = k.querySelector<HTMLAnchorElement>('[data-testid="hilfe-support-link"]');
    expect(link, "kein Link trotz eingerichtetem Kontakt").not.toBeNull();
    expect(link?.getAttribute("href")).toBe(A.url);
    expect(flach(link?.textContent)).toContain(A.label);
    expect(flach(link?.textContent)).toContain(i18n.t("help.support.newTab"));
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel") ?? "").toContain("noopener");
    expect(flach(k.querySelector('[data-testid="hilfe-support-ziel"]')?.textContent)).toBe(A.url);
    expect(k.querySelectorAll("a"), "genau EIN Link in der Karte").toHaveLength(1);
  });

  it("M2: mailto ohne Bezeichnung — Produkttext als Name, Adresse sichtbar, kein neuer Tab", async () => {
    draht = await installation(B);
    const k = karte(await hilfe());
    expect(k.dataset.supportZustand).toBe("eingerichtet");
    const link = k.querySelector<HTMLAnchorElement>('[data-testid="hilfe-support-link"]');
    expect(link?.getAttribute("href")).toBe(B.url);
    expect(flach(link?.textContent)).toBe(i18n.t("help.support.mailDefault"));
    expect(link?.hasAttribute("target")).toBe(false);
    expect(flach(k.querySelector('[data-testid="hilfe-support-ziel"]')?.textContent)).toBe(
      "support-b@kunde-b.invalid",
    );
    expect(k.textContent ?? "").not.toContain("support-a");
  });

  it("M3: nicht eingerichtet — ehrlicher Satz, KEIN Link, Hilfe und Suche bedienbar", async () => {
    draht = await installation({});
    const flaeche = await hilfe();
    const k = karte(flaeche);
    expect(k.dataset.supportZustand).toBe("nicht_eingerichtet");
    expect(flach(k.textContent)).toContain(i18n.t("help.support.notConfigured"));
    expect(k.querySelectorAll("a"), "ein Link ohne Kontakt").toHaveLength(0);
    await sucheBedienbar(flaeche);
  });

  it("M4: javascript: konfiguriert — „ungültig“, kein Link, der Wert steht nirgends auf der Seite", async () => {
    draht = await installation({ url: "javascript:alert(1)", label: "Hilfe" });
    const flaeche = await hilfe();
    const k = karte(flaeche);
    expect(k.dataset.supportZustand).toBe("ungueltig");
    expect(flach(k.textContent)).toContain(i18n.t("help.support.invalid"));
    expect(k.querySelectorAll("a")).toHaveLength(0);
    expect(flaeche.innerHTML).not.toContain("javascript:");
    expect(flaeche.querySelector('a[href^="javascript"], a[href^="data:"]')).toBeNull();
    await sucheBedienbar(flaeche);
  });

  it("M5: Abruf scheitert (Netz weg) — Fehlersatz statt leerer Karte, Hilfe bleibt bedienbar", async () => {
    draht = { art: "netz-weg" };
    const flaeche = await hilfe();
    const k = karte(flaeche);
    expect(abrufe).toContain("/api/support");
    expect(k.dataset.supportZustand).toBe("fehler");
    expect(flach(k.textContent)).toContain(i18n.t("help.support.loadError"));
    expect(k.querySelectorAll("a")).toHaveLength(0);
    await sucheBedienbar(flaeche);
  });

  it("M6: ohne Sitzung antwortet die echte App 401 — die Karte meldet den Fehler, behauptet nichts", async () => {
    draht = await installation(A, false);
    const k = karte(await hilfe());
    expect(k.dataset.supportZustand).toBe("fehler");
    expect(k.querySelectorAll("a")).toHaveLength(0);
    expect(k.textContent ?? "").not.toContain("support-a");
  });

  it("M7: GEGENPROBE der Clientprüfung — eine gefälschte Antwort wird nicht verlinkt", async () => {
    const gefaelscht: unknown[] = [
      { zustand: "eingerichtet", art: "https", ziel: "javascript:alert(1)", anzeige: "x" },
      { zustand: "eingerichtet", art: "mailto", ziel: "mailto:a@b.invalid?bcc=c@d.invalid" },
      { zustand: "eingerichtet", art: "https", ziel: "http://support.invalid/", anzeige: "x" },
      { zustand: "eingerichtet", art: "https", ziel: A.url, anzeige: "   ", bezeichnung: null },
      { zustand: "irgendwas" },
    ];
    for (const antwort of gefaelscht) {
      draht = { art: "gefaelscht", antwort };
      const flaeche = await hilfe();
      const k = karte(flaeche);
      expect(k.dataset.supportZustand, JSON.stringify(antwort)).toBe("fehler");
      expect(k.querySelectorAll("a"), JSON.stringify(antwort)).toHaveLength(0);
      const wurzel = root;
      await act(async () => {
        wurzel?.unmount();
      });
      flaeche.remove();
      root = null;
      container = null;
    }
  });

  // ==============================================================================================
  // BEN F1 (Nacharbeit 1) — DIE LÄNGENGRENZE GILT FÜR DAS NORMALISIERTE ZIEL, AUF BEIDEN SEITEN.
  // `new URL` kodiert jedes „ä" als `%C3%A4`. Der Rohwert `https://support.invalid/` + 80 × „ä" hat
  // 104 Zeichen, sein normalisiertes Ziel 24 + 80 × 6 = 504 — über der Grenze von 500. Vorher
  // lieferte der Server „eingerichtet", der Client verwarf die Antwort, und die Karte zeigte
  // „fehler", obwohl der Abruf gelungen war. Gemessen wird an der ECHTEN Antwort, nicht an einer
  // gefälschten; 79 × „ä" (498 Zeichen) ist die Gegenseite der Grenze und muss verlinkt werden.
  // ==============================================================================================
  it("M9: normalisiertes Ziel über 500 Zeichen — Antwort UND Karte „ungueltig“, kein Link, nie „fehler“", async () => {
    const roh = `https://support.invalid/${"ä".repeat(80)}`;
    expect(roh.length, "der Rohwert liegt unter der Grenze").toBeLessThan(500);
    const inst = await installation({ url: roh });
    draht = inst;
    if (inst.art !== "app" || !inst.token) {
      throw new Error("keine angemeldete Installation");
    }
    const antwort = await inst.app.inject({
      method: "GET",
      url: "/api/support",
      headers: { authorization: `Bearer ${inst.token}` },
    });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({ zustand: "ungueltig" });
    const k = karte(await hilfe());
    expect(k.dataset.supportZustand, "ein gelungener Abruf wurde zu „fehler“").toBe("ungueltig");
    expect(flach(k.textContent)).toContain(i18n.t("help.support.invalid"));
    expect(k.querySelectorAll("a")).toHaveLength(0);
  });

  it("M9b: Gegenseite der Grenze — 79 × „ä“ (498 Zeichen normalisiert) ist eingerichtet und verlinkt", async () => {
    const roh = `https://support.invalid/${"ä".repeat(79)}`;
    const ziel = `https://support.invalid/${"%C3%A4".repeat(79)}`;
    expect(ziel.length).toBe(498);
    const inst = await installation({ url: roh });
    draht = inst;
    if (inst.art !== "app" || !inst.token) {
      throw new Error("keine angemeldete Installation");
    }
    const antwort = await inst.app.inject({
      method: "GET",
      url: "/api/support",
      headers: { authorization: `Bearer ${inst.token}` },
    });
    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual({
      zustand: "eingerichtet",
      art: "https",
      ziel,
      anzeige: ziel,
      bezeichnung: null,
    });
    const k = karte(await hilfe());
    expect(k.dataset.supportZustand).toBe("eingerichtet");
    const links = k.querySelectorAll<HTMLAnchorElement>("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe(ziel);
  });

  it("M8: alle neuen Texte stehen in de, en und nl — und die Karte spricht die gewählte Sprache", async () => {
    const wert = (sprache: string, schluessel: string): string =>
      String(i18n.getResource(sprache, "translation", schluessel) ?? "").trim();
    for (const sprache of ["de", "en", "nl"] as const) {
      for (const schluessel of SCHLUESSEL) {
        expect(wert(sprache, schluessel).length, `${schluessel} (${sprache})`).toBeGreaterThan(0);
      }
    }
    for (const schluessel of ["help.support.notConfigured", "help.support.title"]) {
      expect(wert("en", schluessel), `${schluessel}: en = de`).not.toBe(wert("de", schluessel));
      expect(wert("nl", schluessel), `${schluessel}: nl = de`).not.toBe(wert("de", schluessel));
    }
    draht = await installation({});
    await i18n.changeLanguage("nl");
    const k = karte(await hilfe());
    expect(flach(k.textContent)).toContain(i18n.getFixedT("nl")("help.support.title"));
    expect(flach(k.textContent)).toContain(i18n.getFixedT("nl")("help.support.notConfigured"));
  });
});
