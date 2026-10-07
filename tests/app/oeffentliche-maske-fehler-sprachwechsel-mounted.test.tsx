// @vitest-environment jsdom
// ================================================================================================
// R-0531 — DIE SPRACHWAHL WIRKT SOFORT AUF ALLE TEXTE DER MASKE, AUCH AUF EINEN SCHON GEZEIGTEN FEHLER
// ================================================================================================
//
// Der Rest aus der Abnahme vom 05.09. (Live 1.97): „echte Serverfehlermeldungen bleiben jedoch auch
// bei EN und NL deutsch". Die SERVERSEITE ist seit Q9 geschlossen — der Server formuliert nach
// `Accept-Language` (`tests/q9-serverfehlertexte/server.test.ts` R1/R2/R4). Offen blieb die Kante,
// dass ein bereits angezeigter Satz nach dem Umschalten in der ALTEN Sprache stehen blieb.
//
// Gemessen an beiden öffentlichen Masken, gemountet: Fehler in der Absendesprache sichtbar; nach dem
// Umschalten kein Satz der alten Sprache mehr; zurückgeschaltet steht er wieder (er ist ja in dieser
// Sprache formuliert).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draht = vi.hoisted(() => ({ satz: "" }));

vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ refresh: () => {}, oidcEnabled: false, user: null }),
}));
vi.mock("../../apps/web/src/api/auth", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const ablehnen = async (): Promise<never> => {
    throw new ApiError(401, "INVALID_CREDENTIALS", draht.satz);
  };
  return {
    authApi: {
      login: vi.fn(ablehnen),
      register: vi.fn(ablehnen),
      setup: vi.fn(ablehnen),
      forgot: vi.fn(ablehnen),
      reset: vi.fn(ablehnen),
      ssoStartUrl: "/api/auth/sso/start",
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthScreens } from "../../apps/web/src/auth/AuthScreens";
import { ResetScreen } from "../../apps/web/src/auth/ResetScreen";
import i18n from "../../apps/web/src/i18n";
import { MELDUNGEN } from "../../services/auth/src/meldungen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(el: unknown): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(QueryClientProvider, { client: qc }, el as never),
      ),
    );
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

const text = (): string => container.textContent ?? "";

/** Der Umschalter der öffentlichen Strecke — exakt über seinen Knopftext, nicht über Teiltreffer. */
async function waehle(sprache: "de" | "en" | "nl"): Promise<void> {
  const knopf = [...container.querySelectorAll('[data-testid="auth-lang-switch"] button')].find(
    (b) => b.textContent === sprache,
  ) as HTMLButtonElement | undefined;
  expect(knopf, `kein Umschalter für ${sprache}`).toBeDefined();
  await act(async () => {
    knopf?.click();
    await new Promise((r) => setTimeout(r, 0));
  });
  expect(i18n.language).toBe(sprache);
}

/** Das Formular absenden, wie es die Eingabetaste täte, und die Ablehnung abwarten. */
async function absenden(): Promise<void> {
  const form = container.querySelector("form");
  expect(form).not.toBeNull();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

const MASKEN = [
  {
    name: "Anmeldung",
    mounten: () => mount(createElement(AuthScreens, { needsSetup: false } as never)),
  },
  {
    name: "Zurücksetzen",
    mounten: () => {
      window.history.replaceState({}, "", "/reset?token=t-123");
      mount(createElement(ResetScreen));
    },
  },
] as const;

describe("R-0531 · ein angezeigter Fehler folgt der Sprachwahl", () => {
  for (const maske of MASKEN) {
    it(`${maske.name}: DE-Fehler steht, nach EN ist er weg, zurück auf DE steht er wieder`, async () => {
      draht.satz = MELDUNGEN.INVALID_CREDENTIALS.de;
      maske.mounten();
      await absenden();
      // Kalibrierung: ohne sichtbaren Fehler wäre „weg" unten trivial wahr.
      expect(text()).toContain(MELDUNGEN.INVALID_CREDENTIALS.de);

      await waehle("en");
      expect(text(), "der deutsche Satz bleibt nach dem Umschalten stehen").not.toContain(
        MELDUNGEN.INVALID_CREDENTIALS.de,
      );

      await waehle("de");
      expect(text()).toContain(MELDUNGEN.INVALID_CREDENTIALS.de);
    });

    it(`${maske.name}: in NL abgesendet, steht der NL-Satz; nach EN kein NL-Satz mehr`, async () => {
      maske.mounten();
      await waehle("nl");
      draht.satz = MELDUNGEN.INVALID_CREDENTIALS.nl;
      await absenden();
      expect(text()).toContain(MELDUNGEN.INVALID_CREDENTIALS.nl);

      await waehle("en");
      expect(text()).not.toContain(MELDUNGEN.INVALID_CREDENTIALS.nl);
    });
  }
});
