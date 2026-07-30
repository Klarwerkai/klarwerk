import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega62 BLOCK A — DER NOTAUSSCHALTER GILT FÜR BEIDE FLÄCHEN DES HINWEISES.
// ================================================================================================
//
// DIE LÜCKE, DIE DIESER TEST SCHLIESST: Die AUS-Gegenprobe aus mega61 montiert NUR `NoticeBanner`
// (apps/web/src/legal/mega61-hinweisbanner.test.tsx, B3). Der zweite Träger desselben Textes — die
// Anmeldemaske — kam in keiner Montage vor, und genau dort stand er ungesteuert. Ein Schalter, der
// im Test grün „aus" meldet, während der Inhalt auf der empfindlichsten Fläche des Produkts
// weiterläuft, ist eine Zusage ohne Deckung.
//
// Deshalb montiert dieser Test die ECHTE `AuthScreens` — nicht `NoticeText` allein. Ein Test auf
// die einzelne Komponente hätte die Lücke wieder nicht gesehen: sie entstand nicht IN `NoticeText`,
// sondern an der Stelle, die sie einbindet.
//
// Kalibrierung ist Pflicht: JEDER AUS-Fall wird gegen einen AN-Fall gestellt. Ohne ihn wäre grün
// auch dann grün, wenn die Maske aus einem ganz anderen Grund nichts rendert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  features: { rechtsseiten: true, hinweisbanner: true } as Record<string, boolean>,
}));

vi.mock("../api/endpoints", () => ({
  endpoints: { features: { get: () => Promise.resolve({ features: server.features }) } },
}));
vi.mock("../api/auth", () => ({
  authApi: {
    status: () => Promise.resolve({ needsSetup: false, oidcEnabled: false }),
    me: () => Promise.reject(new Error("nicht angemeldet")),
    login: () => Promise.resolve({ token: "t" }),
    register: () => Promise.resolve({}),
    setup: () => Promise.resolve({}),
    forgot: () => Promise.resolve({}),
    logout: () => Promise.resolve(),
    ssoStartUrl: "/api/auth/oidc/start",
  },
}));

const { AuthScreens } = await import("../auth/AuthScreens");
const { AuthProvider } = await import("../app/AuthContext");
const { default: i18n } = await import("../i18n");

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function anmeldemaskeMontieren(): Promise<void> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(AuthProvider, null, createElement(AuthScreens, { needsSetup: false })),
      ),
    );
  });
  // Die Schalterauskunft ist eine Abfrage — sie muss angekommen sein, bevor gemessen wird.
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

beforeEach(() => {
  server.features = { rechtsseiten: true, hinweisbanner: true };
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mega62 A · der Hinweis auf der Anmeldemaske folgt dem Schalter", () => {
  it("KALIBRIERUNG · Schalter AN: der Hinweis steht auf der Anmeldemaske", async () => {
    await anmeldemaskeMontieren();
    expect(container.querySelector("[data-testid=notice-text]")).not.toBeNull();
    // Beide Pflichten, wörtlich — nicht bloß ein Kasten mit dem richtigen Namen.
    expect(container.textContent).toContain(i18n.t("notice.banner.ai"));
    expect(container.textContent).toContain(i18n.t("notice.banner.cookie"));
    abbauen();
  });

  it("SCHALTER AUS: der Hinweis ist auch auf der Anmeldemaske weg — die Maske selbst bleibt", async () => {
    server.features = { rechtsseiten: false, hinweisbanner: false };
    await anmeldemaskeMontieren();

    // Das eigentliche Versprechen: nach `KLARWERK_HINWEISBANNER=0` steht hier nichts mehr.
    expect(container.querySelector("[data-testid=notice-text]")).toBeNull();
    expect(container.textContent).not.toContain(i18n.t("notice.banner.ai"));
    expect(container.textContent).not.toContain(i18n.t("notice.banner.cookie"));
    expect(container.textContent).not.toContain(i18n.t("notice.banner.title"));

    // GEGENPROBE IN DIE ANDERE RICHTUNG: Der Notausschalter nimmt den Hinweis weg und sonst
    // NICHTS. Wäre die Anmeldemaske als Ganzes verschwunden, wäre der Test oben ebenfalls grün —
    // und der Schalter hätte den Anmeldeweg zerlegt statt eine Anzeigefläche abzuschalten.
    expect(container.textContent).toContain(i18n.t("auth.title.login"));
    expect(container.querySelector("form")).not.toBeNull();
    abbauen();
  });

  it("EIN Schalter, nicht zwei: dieselbe Auskunft steuert beide Flächen", async () => {
    // Der gewählte Weg (ein Vertrag statt zwei) ist nur dann wahr, wenn beide Träger DIESELBE
    // Auskunft lesen. Belegt wird das an der Quelle: `NoticeText` und `NoticeBanner` fragen beide
    // `useHinweisbannerAn()` — es gibt keinen zweiten Schalternamen für die zweite Fläche.
    const { readFileSync } = await import("node:fs");
    const quelle = readFileSync(`${process.cwd()}/apps/web/src/legal/NoticeBanner.tsx`, "utf8");
    const traeger = quelle.split("const an = useHinweisbannerAn();").length - 1;
    // Genau zwei Leser: `NoticeText` (Anmeldemaske) und `NoticeBanner` (Anwendungshülle).
    expect(traeger, "beide Flächen lesen dieselbe Auskunft").toBe(2);
    // Und kein zweiter Schaltername ist dafür entstanden.
    expect(quelle).not.toContain("useHinweistextAn");
  });
});
