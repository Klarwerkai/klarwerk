// @vitest-environment jsdom
// ================================================================================================
// JOB 1097 · D1 — DIE OEFFENTLICHE STRECKE: D-023, D-025, D-026, D-027, D-028.
// ================================================================================================
//
// Die Designlieferung fasst diese fuenf Scheiben zu EINEM Auftrag zusammen, und der Grund steht
// dort woertlich: es ist EINE Datei plus ihre Zwillingsmaske — „wer nur AuthScreens repariert,
// laesst die Haelfte stehen." Diese Testdatei prueft deshalb beide Masken, und jede Zusage an
// BEIDEN, wo sie beide betrifft.
//
// Gemessen wird an der gemounteten Maske, nicht am Quelltext: ein `autocomplete`-Attribut, das nur
// im Editor steht, hilft keinem Passwortmanager.
import { afterEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({ oidcEnabled: false }));

vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ refresh: () => {}, oidcEnabled: lage.oidcEnabled, user: null }),
}));
vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    login: vi.fn(async () => ({})),
    register: vi.fn(async () => ({})),
    setup: vi.fn(async () => ({})),
    forgot: vi.fn(async () => ({})),
    reset: vi.fn(async () => ({})),
    ssoStartUrl: "/api/auth/sso/start",
  },
}));

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

const mountAuth = (needsSetup = false): void =>
  mount(createElement(AuthScreens, { needsSetup } as never));

function mountReset(mitToken = true): void {
  // ResetScreen liest den Token aus der echten Adresse.
  window.history.replaceState({}, "", mitToken ? "/reset?token=t-123" : "/reset");
  mount(createElement(ResetScreen));
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  lage.oidcEnabled = false;
  void i18n.changeLanguage("de");
});

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const felder = (): HTMLInputElement[] => [...container.querySelectorAll("input")];
const knopfMit = (teil: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(teil));
const de = (schluessel: string): string =>
  String(i18n.getResource("de", "translation", schluessel));

/** Wechselt den Modus über den sichtbaren Weg — so, wie eine Nutzerin es täte. */
function wechsleZu(knopftext: string): void {
  act(() => {
    knopfMit(knopftext)?.click();
  });
}

// ================================================================================================
// D-023 — Anmelden geht fluessig
// ================================================================================================

describe("JOB 1097 · D-023 — die Felder sind fuer Mensch und Passwortmanager benannt", () => {
  it("Anmelden: E-Mail und Passwort tragen id, name und autocomplete", () => {
    mountAuth();
    const mail = felder().find((f) => f.type === "email");
    const pw = felder().find((f) => f.type === "password");
    expect(mail?.getAttribute("autocomplete")).toBe("email");
    expect(mail?.getAttribute("name")).toBeTruthy();
    expect(mail?.getAttribute("id")).toBeTruthy();
    expect(pw?.getAttribute("autocomplete")).toBe("current-password");
    expect(pw?.getAttribute("name")).toBeTruthy();
    expect(pw?.getAttribute("id")).toBeTruthy();
  });

  it("Registrieren: das Passwort ist ein NEUES — sonst schlaegt der Manager das alte vor", () => {
    mountAuth();
    wechsleZu(de("auth.toRegister"));
    const pws = felder().filter((f) => f.type === "password");
    expect(pws.length).toBeGreaterThanOrEqual(1);
    for (const pw of pws) {
      expect(pw.getAttribute("autocomplete")).toBe("new-password");
    }
  });

  it("Anmelden: der Cursor steht ohne Klick im ersten Feld", () => {
    mountAuth();
    // Geprueft an der WIRKUNG (`document.activeElement`), nicht am Attribut: React setzt
    // `autoFocus` als DOM-Property und ruft `.focus()` selbst — ein Attributtreffer waere hier
    // sogar dann gruen, wenn der Fokus nie gesetzt wuerde.
    expect(document.activeElement).toBe(felder().find((f) => f.type === "email"));
  });

  it("Zuruecksetzen: der Fokus steht im Passwortfeld, nicht auf der E-Mail", () => {
    mountReset();
    const pw = felder().find((f) => f.type === "password");
    expect(document.activeElement).toBe(pw);
    expect(pw?.getAttribute("autocomplete")).toBe("new-password");
    expect(pw?.getAttribute("name")).toBeTruthy();
    expect(pw?.getAttribute("id")).toBeTruthy();
  });

  it("die Feld-ids sind eindeutig — doppelte ids machen die Label-Bindung mehrdeutig", () => {
    mountAuth();
    wechsleZu(de("auth.toRegister"));
    const ids = felder()
      .map((f) => f.getAttribute("id"))
      .filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ================================================================================================
// D-025 — Die Anmeldeseite schweigt ueber Abwesendes
// ================================================================================================

describe("JOB 1097 · D-025 — ohne SSO steht das Wort SSO nirgends", () => {
  it("oidcEnabled=false: weder Trenner noch SSO-Satz erscheinen", () => {
    lage.oidcEnabled = false;
    mountAuth();
    expect(text()).not.toContain(de("auth.ssoUnavailable"));
    // Der „oder"-Trenner traegt nichts mehr, wenn danach nichts kommt.
    expect(text()).not.toContain(de("auth.or"));
  });

  it("KALIBRIERUNG oidcEnabled=true: der SSO-Weg erscheint sehr wohl", () => {
    lage.oidcEnabled = true;
    mountAuth();
    expect(text()).toContain(de("auth.ssoButton"));
    expect(text()).toContain(de("auth.or"));
  });

  it("Passwort-vergessen steht VOR Registrieren — der Alltagsfall zuerst", () => {
    mountAuth();
    // `querySelectorAll` liefert Dokumentreihenfolge — der Vergleich der Fundstellen ist damit
    // genau die Frage der Zusage: welcher der beiden Wege steht weiter oben.
    const beschriftungen = [...container.querySelectorAll("button")].map(
      (b) => b.textContent ?? "",
    );
    const vergessen = beschriftungen.findIndex((s) => s.includes(de("auth.toForgot")));
    const registrieren = beschriftungen.findIndex((s) => s.includes(de("auth.toRegister")));
    expect(vergessen).toBeGreaterThanOrEqual(0);
    expect(registrieren).toBeGreaterThanOrEqual(0);
    expect(vergessen).toBeLessThan(registrieren);
  });

  it("und er ist der optisch staerkere der beiden", () => {
    mountAuth();
    expect(knopfMit(de("auth.toForgot"))?.className).toContain("font-semibold");
    expect(knopfMit(de("auth.toRegister"))?.className).not.toContain("font-semibold");
  });
});

// ================================================================================================
// D-026 — Die Passwortregel steht am Feld
// ================================================================================================

describe("JOB 1097 · D-026 — die Laengenregel steht vor der Eingabe", () => {
  it("Registrieren: die Beschriftung nennt die Mindestlaenge", () => {
    mountAuth();
    wechsleZu(de("auth.toRegister"));
    expect(text()).toContain("8");
    expect(text()).toContain(de("auth.passwordRule"));
  });

  it("Zuruecksetzen: dieselbe Regel steht auch dort", () => {
    mountReset();
    expect(text()).toContain(de("auth.passwordRule"));
  });

  it("Anmelden: dort steht sie NICHT — bei der Anmeldung gilt keine Mindestlaenge", () => {
    // Ohne diesen Gegenfall waere die Regel eine Dekoration, die ueberall klebt.
    mountAuth();
    expect(text()).not.toContain(de("auth.passwordRule"));
  });

  it("die Regel liegt in allen drei Sprachen vor und ist echt uebersetzt", () => {
    const werte = ["de", "en", "nl"].map((s) =>
      String(i18n.getResource(s, "translation", "auth.passwordRule")),
    );
    for (const w of werte) {
      expect(w.length).toBeGreaterThan(0);
      expect(w).not.toBe("auth.passwordRule");
    }
    expect(new Set(werte).size, "zwei Sprachen tragen denselben Text").toBeGreaterThan(1);
  });
});

// ================================================================================================
// D-027 — Wer kein Deutsch spricht, kommt trotzdem hinein
// ================================================================================================

describe("JOB 1097 · D-027 — die Sprache ist VOR der Anmeldung waehlbar", () => {
  it("die Anmeldemaske traegt einen Umschalter mit DE, EN und NL", () => {
    mountAuth();
    for (const l of ["de", "en", "nl"]) {
      expect(knopfMit(l.toUpperCase()) ?? knopfMit(l), `kein Schalter fuer ${l}`).toBeDefined();
    }
  });

  it("ein Klick auf EN aendert die Beschriftung des Anmeldeknopfs", () => {
    mountAuth();
    const vorher = text();
    act(() => {
      (knopfMit("EN") ?? knopfMit("en"))?.click();
    });
    expect(text()).not.toBe(vorher);
    expect(text()).toContain(String(i18n.getResource("en", "translation", "auth.submit.login")));
  });

  it("auch /reset traegt den Umschalter", () => {
    mountReset();
    for (const l of ["de", "en", "nl"]) {
      expect(knopfMit(l.toUpperCase()) ?? knopfMit(l), `kein Schalter fuer ${l}`).toBeDefined();
    }
  });
});

// ================================================================================================
// D-028 — Eine Markenflaeche fuer beide Masken
// ================================================================================================

describe("JOB 1097 · D-028 — die Markenflaeche ist EINE Quelle und verschwindet nicht", () => {
  const marke = (): HTMLElement | null =>
    container.querySelector('[data-testid="auth-brand-panel"]');

  it("die Anmeldemaske zeigt sie", () => {
    mountAuth();
    expect(marke()).not.toBeNull();
    expect(marke()?.textContent).toContain("KLARWERK");
  });

  it("die Zuruecksetzen-Maske zeigt DIESELBE", () => {
    mountReset();
    expect(marke()).not.toBeNull();
    expect(marke()?.textContent).toContain("KLARWERK");
  });

  it("die Wortmarke ist auch auf schmaler Breite im Baum — nicht `hidden lg:flex` allein", () => {
    // Der Befund aus D-028: unterhalb 1024 px verschwand die Spalte komplett, mitsamt Logo und
    // Tagline. jsdom rechnet keine Breite; geprueft wird deshalb, dass es UEBERHAUPT einen
    // Markenanker gibt, der nicht hinter `hidden … lg:flex` allein liegt.
    mountAuth();
    const schmal = container.querySelector('[data-testid="auth-brand-compact"]');
    expect(schmal, "kein Markenanker fuer schmale Breite").not.toBeNull();
    // Er darf nicht UNBEDINGT versteckt sein. `lg:hidden` ist richtig (am Desktop uebernimmt die
    // Spalte daneben); ein unpraefixiertes `hidden` waere der alte Zustand in neuer Form.
    expect(schmal?.className ?? "").not.toMatch(/(^|\s)hidden(\s|$)/);
    expect(schmal?.textContent).toContain("KLARWERK");
  });

  it("die Tagline steht in der Flaeche und kommt aus der Uebersetzung", () => {
    mountAuth();
    expect(marke()?.textContent).toContain(de("auth.taglineSub"));
  });
});
