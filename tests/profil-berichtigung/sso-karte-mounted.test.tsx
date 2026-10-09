// @vitest-environment jsdom
// ================================================================================================
// R-0582 · BEN-BEFUNDE NACHARBEIT 4 — DER SSO-WEG ÜBER DIE ECHTE PROFILKARTE, HIN UND ZURÜCK.
// ================================================================================================
//
//   U1  ABLAUF UND WIEDERHOLUNG. Konto A bestätigt per SSO, die Bestätigung läuft ab (5 min), das
//       Speichern wird abgelehnt — die Karte setzt den Zustand zurück, behält die Eingabe, zeigt
//       „Mit SSO bestätigen" wieder; die zweite Bestätigung über denselben Knopf führt zum Erfolg.
//   U2  KONTOWECHSEL. A beginnt die Berichtigung, beim Anbieter meldet sich B an. Die Karte
//       verwirft A's Entwurf, zeigt B's eigene Daten und sagt, warum; am Server bleiben A und B
//       unverändert.
//
// WAS ECHT IST: Profilkarte (`pages/Profile.tsx`), Rückrufseite (`auth/SsoCallback.tsx`), Client
// (`api/auth.ts`), Auth-Routen samt OIDC-Prüfung (lokales JWKS, echte Signatur). Ersetzt sind der
// Transport (`fetch` → `app.inject`, mit einem kleinen Cookie-Speicher wie im Browser) und
// `window.location` (jsdom kann nicht navigieren — mitgeschrieben wird, WOHIN die Seite will).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { SsoCallback } from "../../apps/web/src/auth/SsoCallback";
import i18n from "../../apps/web/src/i18n";
import { KONTODATEN_ENTWURF, Profile } from "../../apps/web/src/pages/Profile";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AuthService,
  InMemorySessionRepo,
  InMemoryUserRepo,
  authRoutes,
  createOidcProvider,
} from "../../services/auth";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ISSUER = "https://idp.example.com";
const AUDIENCE = "klarwerk-client";
const KONTO_A = { sub: "sso-a", email: "anna@firma.de", name: "Anna Alt" };
const KONTO_B = { sub: "sso-b", email: "bea@firma.de", name: "Bea Zwei" };
const NEU = "anna.neu@firma.de";

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = await exportJWK(publicKey);
jwk.kid = "test-key";
jwk.alg = "RS256";
const JWKS = createLocalJWKSet({ keys: [jwk] });

/** Wen der Anbieter beim nächsten Rückruf anmeldet. */
let anbieterKonto = KONTO_A;
/** Die nonce des laufenden Ablaufs — der Anbieter spiegelt sie im id_token. */
let nonce = "";

async function idToken(): Promise<string> {
  return new SignJWT({
    nonce,
    sub: anbieterKonto.sub,
    email: anbieterKonto.email,
    email_verified: true,
    name: anbieterKonto.name,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime("1h")
    .sign(privateKey);
}

let app: FastifyInstance | null = null;
/** Der Cookie-Speicher des „Browsers". */
const glas = new Map<string, string>();
/** Wohin die Seite navigieren wollte (`window.location.assign`). */
const zugewiesen: string[] = [];
let vorherigerFetch: typeof globalThis.fetch;
const vorherigeLocation = window.location;

function cookieKopf(): string {
  return [...glas.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function aufnehmen(antwort: LightMyRequestResponse): void {
  const roh = antwort.headers["set-cookie"];
  for (const zeile of Array.isArray(roh) ? roh : roh ? [roh] : []) {
    const [paar = ""] = zeile.split(";");
    const gleich = paar.indexOf("=");
    const name = paar.slice(0, gleich).trim();
    const wert = paar.slice(gleich + 1).trim();
    if (/Max-Age=0/.test(zeile) || wert === "") {
      glas.delete(name);
    } else {
      glas.set(name, wert);
    }
  }
}

async function draht(methode: string, url: string, body?: string): Promise<LightMyRequestResponse> {
  if (!app) {
    throw new Error(`Draht ohne App: ${methode} ${url}`);
  }
  const antwort = await app.inject({
    method: methode as "GET",
    url,
    headers: { cookie: cookieKopf(), "content-type": "application/json" },
    ...(body !== undefined ? { payload: body } : {}),
  });
  aufnehmen(antwort);
  return antwort;
}

function setzeAdresse(suche: string): void {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      href: `https://app.klarwerk.ai/sso/callback${suche}`,
      pathname: "/sso/callback",
      search: suche,
      assign: (ziel: string) => zugewiesen.push(ziel),
    },
  });
}

async function baueApp(): Promise<void> {
  const service = new AuthService({
    users: new InMemoryUserRepo(),
    sessions: new InMemorySessionRepo(),
    audit: new AuditService({ repo: new InMemoryAuditRepo() }),
  });
  const provider = createOidcProvider(
    {
      issuer: ISSUER,
      audience: AUDIENCE,
      jwksUri: "x",
      authorizeUrl: "https://idp.example.com/authorize",
      tokenUrl: "https://idp.example.com/token",
      clientId: AUDIENCE,
      redirectUri: "https://app.klarwerk.ai/sso/callback",
      autoProvision: true,
      roles: { roleClaim: "roles", adminGroup: "kw-admin", controllerGroup: "kw-ctrl" },
    },
    { keyResolver: JWKS, tokenExchanger: () => idToken() },
  );
  app = Fastify();
  await app.register(authRoutes(service, { oidc: provider }));
  await app.ready();
}

/** Der Sprung zum Anbieter: der Start setzt state/nonce/verifier (und ggf. das Ziel) als Cookies. */
async function folgeStart(url: string): Promise<string> {
  const start = await draht("GET", url);
  expect(start.statusCode, start.body).toBe(302);
  nonce = glas.get("kw_oidc_nonce") ?? "";
  return glas.get("kw_oidc_state") ?? "";
}

/** Eine gewöhnliche SSO-Anmeldung, nur am Draht (ohne Oberfläche). */
async function anmelden(konto: typeof KONTO_A): Promise<void> {
  anbieterKonto = konto;
  const state = await folgeStart("/api/auth/oidc/start");
  const r = await draht("POST", "/api/auth/oidc", JSON.stringify({ code: "c", state }));
  expect(r.statusCode, r.body).toBe(200);
}

async function ich(): Promise<{ id: string; name: string; email: string }> {
  const r = await draht("GET", "/api/auth/me");
  expect(r.statusCode).toBe(200);
  return r.json() as { id: string; name: string; email: string };
}

// ------------------------------------------------------------------------------------------------
// Fläche
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

async function ruhe(runden = 30): Promise<void> {
  for (let i = 0; i < runden; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const text = (): string => (container?.textContent ?? "").replace(/\s+/g, " ");
const t = (key: string): string => i18n.t(key);

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 300; i++) {
    if (bedingung()) {
      return;
    }
    await act(async () => {
      await new Promise((r) => setTimeout(r, 5));
    });
  }
  throw new Error(`Zustand nie erreicht: ${was} — sichtbar: ${text().slice(0, 400)}`);
}

async function montiere(inhalt: ReactNode, adresse: string): Promise<void> {
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
                { initialEntries: [adresse] },
                createElement(NavGuardProvider, null, inhalt),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await ruhe();
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
}

function knopf(teil: string): HTMLButtonElement | null {
  const treffer = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").includes(teil),
  );
  return treffer ?? null;
}

async function klick(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error(`Bedienelement fehlt — sichtbar: ${text().slice(0, 400)}`);
  }
  await act(async () => {
    el.click();
  });
  await ruhe();
}

async function tippe(feld: Element | null | undefined, wert: string): Promise<void> {
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error("Eingabefeld fehlt");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await ruhe(5);
}

function feld(beschriftung: string): HTMLInputElement | null {
  const l = [...container.querySelectorAll("label")].find(
    (el) => (el.querySelector("span")?.textContent ?? "").trim() === beschriftung,
  );
  return l?.querySelector("input") ?? null;
}

const karte = (): Element | null => container.querySelector('[data-testid="detail-kontodaten"]');
const alarm = (): string =>
  container.querySelector('[data-testid="detail-kontodaten"] [role="alert"]')?.textContent ?? "";

/** Profil öffnen (ggf. am Rücksprung) und warten, bis die Karte mit Konto steht. */
async function profil(adresse: string, kartenNamen: string): Promise<void> {
  await montiere(createElement(Profile), adresse);
  if (adresse === "/profil") {
    const zeileName = (): string =>
      container.querySelector('[data-testid="zeile-name"]')?.textContent ?? "";
    await warteBis(() => zeileName().includes(kartenNamen), "Sitzungsnutzer geladen");
    await klick(container.querySelector('[data-testid="zeile-kontodaten"]'));
  }
  await warteBis(() => karte() !== null, "Kontodatenkarte offen");
  await warteBis(() => (feld(t("adm.name"))?.value ?? "") !== "", "Felder vorbelegt");
}

/** „Mit SSO bestätigen" klicken, dem Start folgen, den Rückruf über die echte Rückrufseite fahren. */
async function bestaetigeUeberSso(): Promise<void> {
  const vorher = zugewiesen.length;
  await klick(knopf(t("prof.correctSso")));
  const ziel = zugewiesen[vorher];
  expect(ziel, "der Knopf startet die SSO-Bestätigung").toBe("/api/auth/oidc/start?ziel=profil");
  abbauen();
  const state = await folgeStart(ziel as string);
  setzeAdresse(`?code=der-code&state=${state}`);
  await montiere(createElement(SsoCallback), "/sso/callback");
  await warteBis(() => zugewiesen.length > vorher + 1, "Rückrufseite leitet weiter");
  expect(zugewiesen[vorher + 1], "Rücksprung ins Profil").toBe("/profil?kontodaten=sso");
  abbauen();
}

beforeAll(() => {
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const antwort = await draht(
      (init?.method ?? "GET").toUpperCase(),
      String(eingabe),
      init?.body !== undefined && init.body !== null ? String(init.body) : undefined,
    );
    return {
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
});

afterAll(() => {
  globalThis.fetch = vorherigerFetch;
  Object.defineProperty(window, "location", { configurable: true, value: vorherigeLocation });
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
  glas.clear();
  zugewiesen.length = 0;
  window.sessionStorage.clear();
  setzeAdresse("");
  anbieterKonto = KONTO_A;
  await baueApp();
});

afterEach(async () => {
  vi.restoreAllMocks();
  abbauen();
  await app?.close();
  app = null;
});

describe("R-0582 · SSO-Bestätigung über die echte Profilkarte", () => {
  it("U1 — Ablauf: abgelehnt, Zustand zurückgesetzt, Eingabe erhalten; die Wiederholung gelingt", async () => {
    await anmelden(KONTO_A);
    const a = await ich();

    await profil("/profil", KONTO_A.name);
    await tippe(feld(t("adm.email")), NEU);
    await bestaetigeUeberSso();
    const entwurf = JSON.parse(window.sessionStorage.getItem(KONTODATEN_ENTWURF) ?? "{}");
    expect(entwurf, "der Entwurf trägt das Ausgangskonto").toMatchObject({
      kontoId: a.id,
      email: NEU,
    });

    // Zurück im Profil: Karte offen, Entwurf da, bestätigt — kein Passwortfeld, kein SSO-Knopf.
    await profil("/profil?kontodaten=sso", KONTO_A.name);
    expect(feld(t("adm.email"))?.value).toBe(NEU);
    expect(text()).toContain(t("prof.correctSsoConfirmed"));
    expect(knopf(t("prof.correctSso"))).toBeNull();

    // Die Bestätigung läuft ab, BEVOR gespeichert wird.
    const echt = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => echt + 5 * 60 * 1000 + 1);
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => alarm() !== "", "Ablehnung");
    vi.restoreAllMocks();
    expect(alarm()).toContain(
      "Bitte bestätige die neue E-Mail zuerst mit einer erneuten SSO-Anmeldung.",
    );
    expect(feld(t("adm.email"))?.value, "die Eingabe bleibt stehen").toBe(NEU);
    expect(knopf(t("prof.correctSso")), "der Bestätigungsweg ist wieder da").not.toBeNull();
    expect((await ich()).email, "am Server nichts geändert").toBe(KONTO_A.email);

    // Wiederholung über denselben Knopf — diesmal rechtzeitig gespeichert.
    await bestaetigeUeberSso();
    await profil("/profil?kontodaten=sso", KONTO_A.name);
    expect(feld(t("adm.email"))?.value).toBe(NEU);
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => text().includes(t("prof.correctSaved")), "gespeichert");
    const nachher = await ich();
    expect(nachher.id).toBe(a.id);
    expect(nachher.email).toBe(NEU);
  });

  it("U2 — Kontowechsel beim Anbieter: A's Entwurf wird verworfen, B sieht seine Daten, nichts überschrieben", async () => {
    await anmelden(KONTO_B);
    const b = await ich();
    await anmelden(KONTO_A);
    const a = await ich();

    await profil("/profil", KONTO_A.name);
    await tippe(feld(t("adm.name")), "Anna Neu");
    await tippe(feld(t("adm.email")), NEU);
    anbieterKonto = KONTO_B; // beim Anbieter meldet sich B an
    await bestaetigeUeberSso();
    expect((await ich()).id, "die neue Sitzung gehört B").toBe(b.id);

    await profil("/profil?kontodaten=sso", KONTO_B.name);
    await warteBis(() => alarm() !== "", "Hinweis auf den Kontowechsel");
    expect(alarm()).toContain(t("prof.correctSsoKontoGewechselt"));
    expect(feld(t("adm.name"))?.value, "B's eigener Name, nicht A's Entwurf").toBe(KONTO_B.name);
    expect(feld(t("adm.email"))?.value).toBe(KONTO_B.email);
    expect(window.sessionStorage.getItem(KONTODATEN_ENTWURF), "Entwurf entfernt").toBeNull();

    // Speichern ändert nichts — es liegt keine Änderung mehr vor.
    await klick(knopf(t("prof.correctSubmit")));
    await warteBis(() => text().includes(t("prof.correctUnchanged")), "Nichts geändert");
    const bNachher = await ich();
    expect(bNachher).toMatchObject({ id: b.id, name: KONTO_B.name, email: KONTO_B.email });

    // Und A ist ebenfalls unverändert.
    await anmelden(KONTO_A);
    expect(await ich()).toMatchObject({ id: a.id, name: KONTO_A.name, email: KONTO_A.email });
  });
});
