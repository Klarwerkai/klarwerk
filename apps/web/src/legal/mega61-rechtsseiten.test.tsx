import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega61 BLOCK A — DIE ZWEI RECHTSSEITEN, GEDECKT.
// ================================================================================================
//
// Dieser Auftrag stellt rechtliche Behauptungen auf. Jede braucht einen Fall, der sie prüft.
//
//   A1  Beide Seiten sind OHNE ANMELDUNG erreichbar, mit ihren Kernabschnitten. Gemountet wird der
//       ECHTE Torwächter (`App`) mit einer Auskunft, die keinen Nutzer kennt — genau die Lage, in
//       der eine Besucherin die Datenschutzerklärung lesen können muss. Dass die Seite ERSCHEINT,
//       obwohl die Sitzungsabfrage nichts liefert, IST hier die Zusage.
//   A2  Steht der Schalter auf AUS, existiert die Seite nicht — kein halber Zustand, kein
//       Fußbereich, der auf etwas zeigt, das es nicht gibt.
//   A3  Der Fußbereich mit „Impressum" und „Datenschutz" steht auf der ANMELDEMASKE, zusammen mit
//       dem Hinweistext ohne Knöpfe (Block B). Dort beginnt die Datenerhebung; § 5 DDG verlangt das
//       Impressum ohnehin von jeder Seite.
//
// WARUM A3 DIE ANMELDEMASKE DIREKT MONTIERT und nicht über `App` läuft: In jsdom bleibt der
// Torwächter im Ladezustand stehen, weil die zweite Sitzungsabfrage (`/auth/me`) den gemounteten
// Baum nicht mehr erreicht — ein Umstand der Testumgebung, nicht des Produkts. Über `App` würde der
// Fall also die Anmeldemaske nie sehen und wäre entweder rot oder (schlimmer) grün, ohne etwas zu
// prüfen. Die Zusage lautet „der Fußbereich steht auf der Anmeldemaske", und genau das prüft er
// jetzt an der Anmeldemaske selbst.
//
// A4 — der Sammler über die noch offenen Angaben — steht in mega61-vorab-schluessel.test.ts. Er
// liest die Quelldatei und braucht deshalb die Node-Umgebung, nicht jsdom.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Nur die HTTP-Grenze wird ersetzt; Torwächter, Seiten, i18n und Schalter-Leser sind echt.
const server = vi.hoisted(() => ({
  features: { rechtsseiten: true, hinweisbanner: true } as Record<string, boolean>,
}));

// Der Torwächter zieht die ganze App-Hülle mit (Rollen, Bildbeschreibung, Reasoner-Status). Für
// DIESEN Fall zählt nur die Schalter-Auskunft; alles andere antwortet ehrlich mit einem Fehler,
// statt mit erfundenen Daten — die Oberfläche ist überall fail-closed und kommt damit zurecht.
vi.mock("../api/endpoints", () => {
  const nichtBedient: unknown = new Proxy(() => undefined, {
    get: () => nichtBedient,
    apply: () => Promise.reject(new Error("in diesem Fall nicht bedient")),
  });
  return {
    endpoints: new Proxy(
      {},
      {
        get: (_ziel, name) =>
          name === "features"
            ? { get: () => Promise.resolve({ features: server.features }) }
            : nichtBedient,
      },
    ),
  };
});
vi.mock("../api/auth", () => ({
  authApi: {
    status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
    me: () => Promise.reject(new Error("401")),
    notice: () => Promise.reject(new Error("401")),
    ssoStartUrl: "/api/auth/oidc/start",
  },
}));

const { default: App } = await import("../App");
const { AuthScreens } = await import("../auth/AuthScreens");
const { AuthProvider } = await import("../app/AuthContext");
const { default: i18n } = await import("../i18n");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function gehZu(pfad: string): void {
  window.history.pushState({}, "", pfad);
}

async function montieren(element: ReturnType<typeof createElement>): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(QueryClientProvider, { client }, element));
  });
  // Genug Makrotasks, damit die Auskunft WIRKLICH durch den Baum läuft. Zu knapp gewartet wäre
  // jeder „nichts da"-Fall grün, ohne etwas zu beweisen — dieselbe Falle wie in mega46 F2; A1
  // unten ist die Kalibrierung dagegen.
  await act(async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
}

beforeEach(() => {
  server.features = { rechtsseiten: true, hinweisbanner: true };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  gehZu("/");
  vi.clearAllMocks();
});

describe("mega61 A · die zwei Rechtsseiten", () => {
  it("A1 · /impressum ist OHNE Anmeldung da und trägt seine Kernabschnitte", async () => {
    gehZu("/impressum");
    await montieren(createElement(App));
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("legal.imprint.title"));
    // Die Pflichtangabe nach § 5 DDG — NICHT § 5 TMG (aufgehoben am 14.05.2024).
    expect(text).toContain(i18n.t("legal.imprint.ddg"));
    expect(text).toContain("DDG");
    expect(text).not.toContain("TMG");
    expect(text).toContain(i18n.t("legal.imprint.representedBy"));
    expect(text).toContain(i18n.t("legal.imprint.vat"));
    // Und der Vermerk, der einen Platzhalter von einem Defekt unterscheidet.
    expect(container.querySelector("[data-testid=legal-draft-notice]")).not.toBeNull();
    // Die offenen Angaben stehen sichtbar als Platzhalter da — nicht als erfundener Wert.
    expect(container.querySelectorAll("[data-testid=legal-pending]").length).toBeGreaterThan(5);
    // Die Anmeldemaske ist NICHT dahinter durchgerutscht.
    expect(text).not.toContain(i18n.t("auth.submit.login"));
  });

  it("A1 · /datenschutz ist OHNE Anmeldung da und trägt seine Kernabschnitte", async () => {
    gehZu("/datenschutz");
    await montieren(createElement(App));
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t("legal.privacy.title"));
    expect(text).toContain(i18n.t("legal.privacy.s1.title"));
    expect(text).toContain(i18n.t("legal.privacy.s4.title"));
    expect(text).toContain(i18n.t("legal.privacy.s8.title"));
    expect(text).toContain(i18n.t("legal.privacy.s13.title"));
    // § 25 Absatz 2 TDDDG trägt die einwilligungsfreie Speicherung — der Satz muss dastehen.
    expect(text).toContain("TDDDG");
    expect(container.querySelector("[data-testid=legal-draft-notice]")).not.toBeNull();
  });

  it("A2 · SCHALTER AUS: die Seite existiert nicht — kein halber Zustand", async () => {
    server.features = { rechtsseiten: false, hinweisbanner: false };
    gehZu("/impressum");
    await montieren(createElement(App));
    const text = container.textContent ?? "";
    expect(text).not.toContain(i18n.t("legal.imprint.ddg"));
    expect(text).not.toContain(i18n.t("legal.imprint.title"));
    expect(container.querySelector("[data-testid=legal-draft-notice]")).toBeNull();
    // Und kein Fußbereich, der auf eine Seite zeigt, die es nicht gibt.
    expect(container.querySelector("[data-testid=legal-footer]")).toBeNull();
  });

  it("A3 · der Fußbereich steht auf der ANMELDEMASKE, mit beiden Bezeichnungen", async () => {
    await montieren(
      createElement(AuthProvider, null, createElement(AuthScreens, { needsSetup: false })),
    );
    // Die Anmeldemaske ist wirklich da (Kalibrierung — sonst prüfte der Rest nichts).
    expect(container.textContent).toContain(i18n.t("auth.submit.login"));
    const fuss = container.querySelector("[data-testid=legal-footer]");
    expect(fuss).not.toBeNull();
    expect(fuss?.textContent).toContain(i18n.t("legal.footer.imprint"));
    expect(fuss?.textContent).toContain(i18n.t("legal.footer.privacy"));
    // Es sind echte Verweise mit echten Zielen — die Rechtsseiten liegen außerhalb des Routers.
    const ziele = [...(fuss?.querySelectorAll("a") ?? [])].map((a) => a.getAttribute("href"));
    expect(ziele).toContain("/impressum");
    expect(ziele).toContain("/datenschutz");
  });

  it("A3/B · die Anmeldemaske trägt den Hinweis als Text OHNE Knöpfe", async () => {
    await montieren(
      createElement(AuthProvider, null, createElement(AuthScreens, { needsSetup: false })),
    );
    const hinweis = container.querySelector("[data-testid=notice-text]");
    expect(hinweis).not.toBeNull();
    expect(hinweis?.textContent).toContain(i18n.t("notice.banner.cookie"));
    // Kein Quittungsknopf: hier gibt es noch kein Konto, an dem sich etwas vermerken ließe.
    expect(container.querySelector("[data-testid=notice-ack]")).toBeNull();
    expect(container.querySelector("[data-testid=notice-decline-open]")).toBeNull();
  });

  it("A2/B · SCHALTER AUS: die Anmeldemaske zeigt keinen Fußbereich", async () => {
    server.features = { rechtsseiten: false, hinweisbanner: false };
    await montieren(
      createElement(AuthProvider, null, createElement(AuthScreens, { needsSetup: false })),
    );
    expect(container.textContent).toContain(i18n.t("auth.submit.login"));
    expect(container.querySelector("[data-testid=legal-footer]")).toBeNull();
  });
});
