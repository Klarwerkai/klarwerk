// @vitest-environment jsdom
// ================================================================================================
// R-0531 — DIE SPRACHWAHL WIRKT SOFORT AUF ALLE TEXTE DER MASKE, AUCH AUF DEN FEHLER
// ================================================================================================
//
// Der Rest aus der Abnahme vom 05.09. (Live 1.97): „echte Serverfehlermeldungen bleiben jedoch auch
// bei EN und NL deutsch". Die SERVERSEITE ist seit Q9 geschlossen — der Server formuliert nach
// `Accept-Language` (`tests/q9-serverfehlertexte/server.test.ts` R1/R2/R4). Offen war die Maske: ein
// schon angezeigter Satz musste nach dem Umschalten in der GEWÄHLTEN Sprache dastehen.
//
// Nacharbeit 1 (BEN): die erste Fassung liess den Satz nach dem Umschalten verschwinden, und dieser
// Test prüfte nur das Verschwinden. Jetzt verlangt jeder Fall den INHALTLICH PASSENDEN Satz in der
// Zielsprache — für beide Masken, für eine Ablehnung, die erst NACH dem Umschalten eintrifft, für
// einen lokalen Netzfehler und für einen Serversatz, der nirgends vorrätig ist.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const draht = vi.hoisted(() => ({
  art: "api" as "api" | "netz",
  satz: "",
  bremse: null as Promise<void> | null,
}));

vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ refresh: () => {}, oidcEnabled: false, user: null }),
}));
vi.mock("../../apps/web/src/api/auth", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const ablehnen = async (): Promise<never> => {
    if (draht.bremse) {
      await draht.bremse;
    }
    if (draht.art === "netz") {
      // Was `fetch` bei getrenntem Netz wirft — kein ApiError, also der lokale Satz der Maske.
      throw new TypeError("Failed to fetch");
    }
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

type Sprache = "de" | "en" | "nl";

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
  draht.art = "api";
  draht.satz = "";
  draht.bremse = null;
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
const wort = (sprache: Sprache, schluessel: string): string =>
  String(i18n.getResource(sprache, "translation", schluessel));

/** Der Umschalter der öffentlichen Strecke — exakt über seinen Knopftext, nicht über Teiltreffer. */
async function waehle(sprache: Sprache): Promise<void> {
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

async function ticken(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

/** Das Formular absenden, wie es die Eingabetaste täte, und die Ablehnung abwarten. */
async function absenden(): Promise<void> {
  const form = container.querySelector("form");
  expect(form).not.toBeNull();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  await ticken();
}

const MASKEN = [
  {
    name: "Anmeldung",
    satz: MELDUNGEN.INVALID_CREDENTIALS,
    mounten: () => mount(createElement(AuthScreens, { needsSetup: false } as never)),
  },
  {
    name: "Zurücksetzen",
    satz: MELDUNGEN.RESET_TOKEN_INVALID,
    mounten: () => {
      window.history.replaceState({}, "", "/reset?token=t-123");
      mount(createElement(ResetScreen));
    },
  },
] as const;

describe("R-0531 · ein Fehler der öffentlichen Masken steht in der gewählten Sprache", () => {
  for (const maske of MASKEN) {
    it(`${maske.name}: in DE abgewiesen, nach EN und NL steht derselbe Satz übersetzt`, async () => {
      draht.satz = maske.satz.de;
      maske.mounten();
      await absenden();
      expect(text()).toContain(maske.satz.de);

      await waehle("en");
      expect(text(), "der Fehler steht nach dem Umschalten nicht auf Englisch").toContain(
        maske.satz.en,
      );
      expect(text(), "der deutsche Satz bleibt stehen").not.toContain(maske.satz.de);

      await waehle("nl");
      expect(text()).toContain(maske.satz.nl);
      expect(text()).not.toContain(maske.satz.en);
    });

    it(`${maske.name}: eine Ablehnung, die erst NACH dem Umschalten eintrifft, steht in der neuen Sprache`, async () => {
      let freigeben: () => void = () => {};
      draht.bremse = new Promise<void>((r) => {
        freigeben = r;
      });
      // Abgesendet auf Deutsch — der Server antwortet also auf Deutsch.
      draht.satz = maske.satz.de;
      maske.mounten();
      await absenden();
      await waehle("en");

      await act(async () => {
        freigeben();
      });
      await ticken();

      expect(text(), "die späte Ablehnung ist verborgen oder deutsch").toContain(maske.satz.en);
      expect(text()).not.toContain(maske.satz.de);
    });

    it(`${maske.name}: ein lokaler Netzfehler folgt der Sprachwahl`, async () => {
      draht.art = "netz";
      maske.mounten();
      await absenden();
      const de = wort("de", "state.error");
      const en = wort("en", "state.error");
      // Kalibrierung: ohne zwei verschiedene Fassungen wäre der Fall trivial grün.
      expect(en).not.toBe(de);
      expect(text()).toContain(de);

      await waehle("en");
      expect(text()).toContain(en);
      expect(text()).not.toContain(de);
    });

    it(`${maske.name}: ein nirgends vorrätiger Serversatz wird nach dem Umschalten erklärt, nicht verschwiegen`, async () => {
      const fremd = "Zugang vorübergehend gesperrt (Wartung).";
      draht.satz = fremd;
      maske.mounten();
      await absenden();
      // In der Sprache, in der er formuliert ist, steht er wörtlich.
      expect(text()).toContain(fremd);

      await waehle("en");
      expect(text()).not.toContain(fremd);
      expect(text(), "statt des Fehlers steht nichts da").toContain(
        wort("en", "anmeldefehler.unbekannt"),
      );
    });
  }

  it("Anmeldung: ein lokaler Satz der Maske (Passwörter ungleich) folgt der Sprachwahl", async () => {
    mount(createElement(AuthScreens, { needsSetup: true } as never));
    const felder = [...container.querySelectorAll('input[type="password"]')] as HTMLInputElement[];
    expect(felder).toHaveLength(2);
    // React liest den Wert über seinen eigenen Setter; ein `input`-Ereignis trägt ihn in den Zustand.
    const setzen = (feld: HTMLInputElement, wert: string): void => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(feld, wert);
      feld.dispatchEvent(new Event("input", { bubbles: true }));
    };
    act(() => {
      setzen(felder[0] as HTMLInputElement, "geheim123");
      setzen(felder[1] as HTMLInputElement, "geheim124");
    });
    await absenden();
    const kasten = (): string =>
      [...container.querySelectorAll("div.rounded-btn")].map((d) => d.textContent ?? "").join(" ");
    expect(kasten()).toContain(wort("de", "auth.passwordMismatch"));

    await waehle("en");
    expect(kasten()).toContain(wort("en", "auth.passwordMismatch"));
    expect(kasten()).not.toContain(wort("de", "auth.passwordMismatch"));
  });
});
