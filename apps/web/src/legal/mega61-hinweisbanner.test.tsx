import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega61 BLOCK B + D — DER HINWEIS UNTEN, UND WAS EINE ABLEHNUNG AUSLÖST.
// ================================================================================================
//
// Gemountet wird der ECHTE Banner über den ECHTEN Kontovermerk-Weg; nur die HTTP-Grenze ist
// ersetzt. Geprüft werden die Zusagen, die dieser Auftrag rechtlich aufstellt:
//
//   B1  Der Banner ist da, wenn der Vermerk fehlt — und er ist mit der Tastatur bedienbar.
//   B2  ECHTER KLICKPFAD: „Verstanden — weiter" quittiert serverseitig, der Banner ist weg, und er
//       kommt nach dem Neuladen NICHT wieder (frischer Baum, Vermerk vom Server).
//   B3  Schalter aus → gar nichts.
//   B4  Im mobilen Zuschnitt bleibt die Fläche gedeckelt und beide Knöpfe erreichbar.
//   D   „Nicht einverstanden" erklärt zuerst und benutzt dann den BESTEHENDEN Abmeldeweg.
//
// Dass die Abmeldung wirklich wirkt — also eine geschützte Route danach abgewiesen wird —, ist
// eine SERVER-Zusage und steht deshalb in tests/auth/mega61-hinweis-vermerk.test.ts. Eine
// Oberfläche kann das nicht belegen, und ein Test, der so täte, wäre schlimmer als keiner.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  features: { rechtsseiten: true, hinweisbanner: true } as Record<string, boolean>,
  faellig: true,
  quittiert: 0,
  abgemeldet: 0,
}));

vi.mock("../api/endpoints", () => ({
  endpoints: { features: { get: () => Promise.resolve({ features: server.features }) } },
}));
vi.mock("../api/auth", () => ({
  authApi: {
    status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
    me: () => Promise.resolve({ id: "u1", role: "experte" }),
    notice: () => Promise.resolve({ currentVersion: "v1", due: server.faellig }),
    acknowledgeNotice: () => {
      server.quittiert += 1;
      server.faellig = false;
      return Promise.resolve({ currentVersion: "v1", acknowledgedVersion: "v1", due: false });
    },
    logout: () => {
      server.abgemeldet += 1;
      return Promise.resolve();
    },
    ssoStartUrl: "/api/auth/oidc/start",
  },
}));

const { NoticeBanner, DECLINE_MARKER } = await import("../legal/NoticeBanner");
const { AuthProvider } = await import("../app/AuthContext");
const { default: i18n } = await import("../i18n");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function montieren(): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(AuthProvider, null, createElement(NoticeBanner)),
      ),
    );
  });
  await act(async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

function abbauen(): void {
  act(() => root.unmount());
  container.remove();
}

function knopf(kennung: string): HTMLButtonElement {
  const el = container.querySelector<HTMLButtonElement>(`[data-testid=${kennung}]`);
  if (!el) {
    throw new Error(`Knopf „${kennung}“ nicht gefunden`);
  }
  return el;
}

async function klick(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
  });
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

beforeEach(() => {
  server.features = { rechtsseiten: true, hinweisbanner: true };
  server.faellig = true;
  server.quittiert = 0;
  server.abgemeldet = 0;
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mega61 B · der Hinweisbanner", () => {
  it("B1 · er ist da, benannt und mit der Tastatur bedienbar", async () => {
    await montieren();
    const banner = container.querySelector("[data-testid=notice-banner]");
    expect(banner).not.toBeNull();
    // Beide Pflichten in einer Fläche: Endgerätespeicher UND KI-Transparenz.
    expect(banner?.textContent).toContain(i18n.t("notice.banner.cookie"));
    expect(banner?.textContent).toContain(i18n.t("notice.banner.ai"));
    // Eine benannte Region — mit Vorlesesoftware ansteuerbar, ohne den Fokus zu reißen.
    expect(banner?.getAttribute("aria-label")).toBe(i18n.t("notice.banner.aria"));
    // Echte Knöpfe, keine anklickbaren Kästen: damit sind sie in der Tabreihenfolge.
    expect(knopf("notice-ack").tagName).toBe("BUTTON");
    expect(knopf("notice-decline-open").tagName).toBe("BUTTON");
    expect(knopf("notice-ack").hasAttribute("disabled")).toBe(false);
    // Und die zwei Verweise auf die Rechtsseiten.
    const ziele = [...(banner?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(ziele).toContain("/impressum");
    expect(ziele).toContain("/datenschutz");
    abbauen();
  });

  it("B2 · KLICKPFAD: „Verstanden“ quittiert, der Banner geht weg — und bleibt nach dem Neuladen weg", async () => {
    await montieren();
    expect(container.querySelector("[data-testid=notice-banner]")).not.toBeNull();
    await klick(knopf("notice-ack"));
    expect(server.quittiert).toBe(1);
    expect(container.querySelector("[data-testid=notice-banner]")).toBeNull();
    abbauen();

    // „Neuladen": ein frischer Baum mit frischem Zwischenspeicher fragt den Server erneut. Der
    // Vermerk liegt am KONTO, nicht im Browser — deshalb bleibt der Banner weg.
    await montieren();
    expect(container.querySelector("[data-testid=notice-banner]")).toBeNull();
    expect(server.quittiert).toBe(1); // kein zweites, stilles Quittieren
    abbauen();
  });

  it("B3 · SCHALTER AUS: gar nichts — nicht ausgegraut, nicht versteckt", async () => {
    server.features = { rechtsseiten: false, hinweisbanner: false };
    await montieren();
    expect(container.querySelector("[data-testid=notice-banner]")).toBeNull();
    expect(container.textContent).toBe("");
    abbauen();
  });

  it("B4 · mobiler Zuschnitt: die Fläche ist gedeckelt, beide Knöpfe bleiben erreichbar", async () => {
    // jsdom rechnet kein Layout — eine Pixelmessung wäre hier eine Behauptung, keine Messung.
    // Geprüft wird deshalb, was in jsdom WIRKLICH nachweisbar ist: die Höhenbegrenzung ist am
    // Scrollbereich gesetzt (nie mehr als 40 % der Bildschirmhöhe, Rest wird gescrollt), der
    // Banner drängt sich nicht über den Inhalt (kein `fixed`), und beide Knöpfe sind auch im
    // schmalen Zuschnitt da. Die Pixel-Zusage deckt der UI-Smoke im Browser.
    (window as unknown as { innerWidth: number }).innerWidth = 390;
    await montieren();
    const banner = container.querySelector("[data-testid=notice-banner]");
    expect(banner).not.toBeNull();
    const scrollbereich = banner?.querySelector("div");
    expect(scrollbereich?.className).toContain("max-h-[40vh]");
    expect(scrollbereich?.className).toContain("overflow-y-auto");
    // Kein Überlagern: der Banner nimmt echten Layout-Platz, statt Bedienelemente zu verdecken.
    expect(banner?.className).not.toContain("fixed");
    expect(banner?.className).not.toContain("absolute");
    expect(knopf("notice-ack")).toBeTruthy();
    expect(knopf("notice-decline-open")).toBeTruthy();
    abbauen();
  });
});

describe("mega61 D · was bei „Nicht einverstanden“ passiert", () => {
  it("D · erst die Erklärung, dann der BESTEHENDE Abmeldeweg — und ein Grund für danach", async () => {
    await montieren();
    // Schritt 1: der Klick meldet NICHT sofort ab, sondern erklärt.
    await klick(knopf("notice-decline-open"));
    const erklaerung = container.querySelector("[data-testid=notice-decline]");
    expect(erklaerung).not.toBeNull();
    expect(erklaerung?.textContent).toContain(i18n.t("notice.decline.body"));
    expect(server.abgemeldet).toBe(0);

    // Und es ist keine Sackgasse: man kommt zurück.
    await klick(knopf("notice-decline-cancel") as HTMLElement);
    expect(container.querySelector("[data-testid=notice-decline]")).toBeNull();

    // Schritt 2: bestätigen → der eine vorhandene Abmeldeweg wird benutzt.
    await klick(knopf("notice-decline-open"));
    await klick(knopf("notice-decline-confirm"));
    expect(server.abgemeldet).toBe(1);
    // Und der Grund überlebt das harte Neuladen, damit die Anmeldemaske ihn nennen kann.
    expect(window.sessionStorage.getItem(DECLINE_MARKER)).toBe("1");
    abbauen();
  });
});
