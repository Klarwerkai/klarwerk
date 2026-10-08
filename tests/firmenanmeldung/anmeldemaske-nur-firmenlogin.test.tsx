// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME gesamt-sso · R-0541 — DIE ANMELDESEITE, WENN NUR NOCH DER FIRMEN-LOGIN GILT.
// ================================================================================================
//
// Der Server schliesst bei `KLARWERK_SSO_ONLY` jeden Passwortweg mit 403
// (`passwort-abschaltbar.test.ts`). Eine Maske, die trotzdem E-Mail, Passwort, „Passwort
// vergessen" und „Registrieren" anbietet, führte jede Person in diese Absage. Gemessen wird die
// ECHTE Maske am echten `AuthProvider` gegen eine gestellte Auth-API, am DOM:
//   N1  Server sagt „nur SSO": kein Formular, kein Passwortfeld, keine Nebenwege — der SSO-Knopf
//       und der erklärende Satz stehen da.
//   N2  GEGENPROBE unbekannt (älterer Server ohne das Feld): alles wie bisher.
//   N3  Passwort aus, aber kein Firmen-Login eingerichtet (Ben, Nacharbeit 2): auch dann kein
//       Passwortformular — es führte nur in die 403 —, sondern der Satz, dass der Firmen-Login noch
//       eingerichtet werden muss. (Bis Nacharbeit 1 hielt N3 das Gegenteil fest.)
//   N6  SAML als einziger Firmen-Login: der SAML-Knopf steht da, der OIDC-Knopf nicht.
//   N4  GEGENPROBE Ersteinrichtung: das Einrichtungsformular bleibt.
//   N5  de/en/nl: je eigener Satz.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  statusAntwort: { needsSetup: false } as Record<string, unknown>,
}));

vi.mock("../../apps/web/src/api/auth", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const abgelehnt = (): Promise<never> =>
    Promise.reject(new ApiError(401, "UNAUTHORIZED", "keine Sitzung"));
  return {
    authApi: {
      status: () => Promise.resolve(server.statusAntwort),
      me: abgelehnt,
      notice: abgelehnt,
      acknowledgeNotice: abgelehnt,
      logout: () => Promise.resolve(),
      login: () => Promise.resolve({}),
      setup: () => Promise.resolve({}),
      forgot: () => Promise.resolve(),
      register: () => Promise.resolve({}),
      ssoStartUrl: "/api/auth/oidc/start",
      samlStartUrl: "/api/auth/saml/start",
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { AuthScreens } from "../../apps/web/src/auth/AuthScreens";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Sprache = "de" | "en" | "nl";

const wort = (sprache: Sprache, schluessel: string): string =>
  String(i18n.getResource(sprache, "translation", schluessel) ?? "");

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let klient: QueryClient | null = null;

async function durchlaufen(): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((fertig) => setTimeout(fertig, 0));
  }
}

async function abbauen(): Promise<void> {
  const wurzel = root;
  if (wurzel) {
    await act(async () => {
      wurzel.unmount();
    });
  }
  container?.remove();
  klient?.clear();
  container = null;
  root = null;
  klient = null;
}

async function montieren(sprache: Sprache = "de", needsSetup = false): Promise<HTMLDivElement> {
  await abbauen();
  await i18n.changeLanguage(sprache);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  klient = client;
  const flaeche = document.createElement("div");
  document.body.appendChild(flaeche);
  container = flaeche;
  const wurzel = createRoot(flaeche);
  root = wurzel;
  await act(async () => {
    wurzel.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(AuthProvider, null, createElement(AuthScreens, { needsSetup })),
      ),
    );
  });
  await act(durchlaufen);
  return flaeche;
}

const NUR_SSO = { needsSetup: false, oidcEnabled: true, passwordLoginEnabled: false };

const text = (baum: HTMLElement): string => (baum.textContent ?? "").replace(/\s+/g, " ");
const knopfMit = (baum: HTMLElement, teil: string): HTMLButtonElement | undefined =>
  [...baum.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(teil));

beforeEach(() => {
  server.statusAntwort = { needsSetup: false };
});

afterEach(async () => {
  await abbauen();
  await i18n.changeLanguage("de");
});

describe("R-0541 · die Anmeldeseite bei „nur Firmen-Login“", () => {
  it("N1 nur SSO: kein Passwortformular, keine Nebenwege, aber der Firmen-Login mit Erklärung", async () => {
    server.statusAntwort = NUR_SSO;
    const baum = await montieren();

    // Kalibrierung: die Maske steht wirklich.
    expect(text(baum)).toContain(wort("de", "auth.title.login"));
    expect(baum.querySelector("form"), "das Passwortformular steht noch da").toBeNull();
    expect(baum.querySelectorAll("input[type=password]")).toHaveLength(0);
    expect(knopfMit(baum, wort("de", "auth.toForgot"))).toBeUndefined();
    expect(knopfMit(baum, wort("de", "auth.toRegister"))).toBeUndefined();

    const flaeche = baum.querySelector("[data-testid=auth-sso-only]");
    expect(flaeche, "die Fläche „nur Firmen-Login“ fehlt").not.toBeNull();
    expect(text(flaeche as HTMLElement)).toContain(wort("de", "auth.ssoOnlyNote"));
    expect(knopfMit(baum, wort("de", "auth.ssoButton"))).toBeDefined();
  });

  it("N2 Gegenprobe unbekannt: ein Server ohne das Feld lässt die Maske, wie sie war", async () => {
    server.statusAntwort = { needsSetup: false, oidcEnabled: true };
    const baum = await montieren();
    expect(baum.querySelector("[data-testid=auth-sso-only]")).toBeNull();
    expect(baum.querySelectorAll("input[type=password]")).toHaveLength(1);
    expect(knopfMit(baum, wort("de", "auth.toForgot"))).toBeDefined();
    expect(knopfMit(baum, wort("de", "auth.ssoButton"))).toBeDefined();
  });

  it("N3 Passwort aus ohne Firmen-Login: kein Formular, sondern der Satz, dass er fehlt", async () => {
    server.statusAntwort = { needsSetup: false, oidcEnabled: false, passwordLoginEnabled: false };
    const baum = await montieren();
    expect(baum.querySelector("form")).toBeNull();
    expect(baum.querySelectorAll("input[type=password]")).toHaveLength(0);
    const fehlt = baum.querySelector("[data-testid=auth-sso-only-missing]");
    expect(fehlt, "der Satz „Firmen-Login noch nicht eingerichtet“ fehlt").not.toBeNull();
    expect(text(fehlt as HTMLElement)).toContain(wort("de", "auth.ssoOnlyMissing"));
    // Kein Knopf in einen Weg, den es nicht gibt.
    expect(knopfMit(baum, wort("de", "auth.ssoButton"))).toBeUndefined();
    expect(knopfMit(baum, wort("de", "auth.samlButton"))).toBeUndefined();
  });

  it("N6 SAML als einziger Firmen-Login: der SAML-Knopf steht da, der OIDC-Knopf nicht", async () => {
    server.statusAntwort = { needsSetup: false, samlEnabled: true, passwordLoginEnabled: false };
    const baum = await montieren();
    expect(baum.querySelectorAll("input[type=password]")).toHaveLength(0);
    expect(knopfMit(baum, wort("de", "auth.samlButton"))).toBeDefined();
    expect(knopfMit(baum, wort("de", "auth.ssoButton"))).toBeUndefined();
  });

  it("N4 Gegenprobe Ersteinrichtung: das Einrichtungsformular bleibt", async () => {
    server.statusAntwort = { ...NUR_SSO, needsSetup: true };
    const baum = await montieren("de", true);
    expect(baum.querySelector("[data-testid=auth-sso-only]")).toBeNull();
    expect(text(baum)).toContain(wort("de", "auth.title.setup"));
    expect(baum.querySelectorAll("input[type=password]")).toHaveLength(2);
  });

  it.each(["en", "nl"] as const)(
    "N5 der Satz steht in %s und ist nicht der deutsche",
    async (s) => {
      server.statusAntwort = NUR_SSO;
      const baum = await montieren(s);
      const satz = wort(s, "auth.ssoOnlyNote");
      expect(satz).not.toBe("");
      expect(satz).not.toBe(wort("de", "auth.ssoOnlyNote"));
      expect(text(baum)).toContain(satz);
    },
  );
});
