// @vitest-environment jsdom
// ================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL (produkt:20261007:arbeitswege-objekt) — KLARA UND „FRAGEN".
// ================================================================================================
//
//   K3 · die Zeile „Frage zum Beitrag …" auf `/fragen` nennt Kennung und Fassung und führt mit
//        GENAU diesen zurück in die Lesefläche (`/wissen/<id>?fassung=<n>`).
//   K5 · Klara nennt Seite, Kennung und Fassung aus derselben Quelle (Adresse, sonst der von der
//        Lesefläche gemeldete Stand DESSELBEN Artikels); ihr Weg nach „Fragen" trägt denselben
//        Bezug — auch nach Zurücknavigation und nach Neuladen (neue Montage derselben Adresse).
//
// Echte Bauteile (`KlaraAssistant`, `ObjektbezugZeile`), echte Router-Adressen. Ersetzt sind nur
// der Endpunkt des Modellstatus und die Rolle. Fiktive Kennungen, keine Zugangsdaten.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "none", reachable: "unknown", tasks: {} })),
    },
  },
}));
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("../pruefen-listennavigation/kulisse-mocks")).rolleMock(o as never),
);

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  useLocation,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import { KlaraAssistant } from "../../apps/web/src/components/KlaraAssistant";
import { ObjektbezugZeile } from "../../apps/web/src/components/ObjektbezugZeile";
import i18n from "../../apps/web/src/i18n";
import { meldeGelesenenStand } from "../../apps/web/src/lib/objektbezug";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function durchlaufen(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

function Adresse(): JSX.Element {
  const ort = useLocation();
  return createElement("output", { "data-testid": "test-adresse" }, `${ort.pathname}${ort.search}`);
}

function Zurueck(): JSX.Element {
  const navigate = useNavigate();
  return createElement(
    "button",
    { type: "button", "data-testid": "test-zurueck", onClick: () => navigate(-1) },
    "zurück",
  );
}

async function montiere(eintraege: string[], kinder: JSX.Element[]): Promise<void> {
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
          MemoryRouter,
          { initialEntries: eintraege, initialIndex: eintraege.length - 1 },
          createElement(Adresse),
          createElement(Zurueck),
          ...kinder,
        ),
      ),
    );
  });
  await durchlaufen();
}

function abbauen(): void {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  container = null;
}

function q<T extends Element>(sel: string): T | null {
  return container?.querySelector<T>(sel) ?? null;
}

async function klick(sel: string): Promise<void> {
  const el = q<HTMLElement>(sel);
  expect(el, `${sel} fehlt`).toBeTruthy();
  await act(async () => {
    el?.click();
  });
  await durchlaufen();
}

async function klaraOeffnen(): Promise<HTMLElement> {
  await klick("button[data-klara='1']");
  const bezug = q<HTMLElement>('[data-testid="klara-objektbezug"]');
  expect(bezug, "Klara nennt keinen Beitrag").toBeTruthy();
  return bezug as HTMLElement;
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => abbauen());

describe("K3 · „Frage zum Beitrag …“: Kennung und Fassung bleiben, der Rückweg trägt beide", () => {
  it("Titel, Fassung und Rückweg in die Lesefläche derselben Fassung", async () => {
    const zeileMitTitel = createElement(ObjektbezugZeile, {
      key: "z",
      bezug: { koId: "k7", fassung: 4 },
      titel: "Pumpe P-12 warten",
    });
    await montiere(["/fragen?q=Wie%20oft%3F&ko=k7&fassung=4"], [zeileMitTitel]);
    const zeile = q<HTMLElement>('[data-testid="objektbezug-zeile"]');
    expect(zeile?.getAttribute("data-ko")).toBe("k7");
    expect(zeile?.getAttribute("data-fassung")).toBe("4");
    expect(zeile?.textContent).toContain("Pumpe P-12 warten");
    expect(q('[data-testid="objektbezug-fassung"]')?.textContent).toBe(
      String(i18n.t("arbeitsweg.fassung", { fassung: 4 })),
    );
    expect(q('[data-testid="objektbezug-zurueck"]')?.getAttribute("href")).toBe(
      "/wissen/k7?fassung=4",
    );

    await klick('[data-testid="objektbezug-zurueck"]');
    expect(q('[data-testid="test-adresse"]')?.textContent).toBe("/wissen/k7?fassung=4");
  });

  it("ohne bekannten Titel steht die Kennung — kein geratener Name", async () => {
    const zeileOhneTitel = createElement(ObjektbezugZeile, {
      key: "z",
      bezug: { koId: "k7", fassung: null },
      titel: null,
    });
    await montiere(["/fragen?ko=k7"], [zeileOhneTitel]);
    expect(q('[data-testid="objektbezug-zeile"]')?.textContent).toContain("k7");
    expect(q('[data-testid="objektbezug-fassung"]')).toBeNull();
    expect(q('[data-testid="objektbezug-zurueck"]')?.getAttribute("href")).toBe("/wissen/k7");
  });
});

describe("K5 · Klara und „Fragen“ verwenden denselben Objektbezug", () => {
  it("in der Lesefläche: Seite, Kennung und die dort gezeigte Fassung; der Weg nach „Fragen“ trägt beide", async () => {
    meldeGelesenenStand({ koId: "k7", fassung: 4 });
    await montiere(["/wissen/k7"], [createElement(KlaraAssistant, { key: "k" })]);
    const bezug = await klaraOeffnen();
    expect(bezug.getAttribute("data-seite")).toBe("lesen");
    expect(bezug.getAttribute("data-ko")).toBe("k7");
    expect(bezug.getAttribute("data-fassung")).toBe("4");
    expect(bezug.textContent).toContain(String(i18n.t("arbeitsweg.fassung", { fassung: 4 })));
    expect(q('[data-testid="klara-objektbezug-fragen"]')?.getAttribute("href")).toBe(
      "/fragen?ko=k7&fassung=4",
    );

    // Weiter in „Fragen": Klara nennt dort DENSELBEN Bezug.
    await klick('[data-testid="klara-objektbezug-fragen"]');
    expect(q('[data-testid="test-adresse"]')?.textContent).toBe("/fragen?ko=k7&fassung=4");
    const imChat = await klaraOeffnen();
    expect(imChat.getAttribute("data-seite")).toBe("fragen");
    expect(imChat.getAttribute("data-ko")).toBe("k7");
    expect(imChat.getAttribute("data-fassung")).toBe("4");

    // Zurücknavigation: wieder die Lesefläche, wieder derselbe Bezug.
    await klick('[data-testid="test-zurueck"]');
    expect(q('[data-testid="test-adresse"]')?.textContent).toBe("/wissen/k7");
    const zurueck = q<HTMLElement>('[data-testid="klara-objektbezug"]') ?? (await klaraOeffnen());
    expect(zurueck.getAttribute("data-ko")).toBe("k7");
    expect(zurueck.getAttribute("data-fassung")).toBe("4");
  });

  it("nach Neuladen derselben Adresse: derselbe Bezug (die Adresse trägt ihn)", async () => {
    await montiere(["/fragen?ko=k7&fassung=4"], [createElement(KlaraAssistant, { key: "k" })]);
    const vorher = await klaraOeffnen();
    const erst = [vorher.getAttribute("data-ko"), vorher.getAttribute("data-fassung")];
    abbauen();
    await montiere(["/fragen?ko=k7&fassung=4"], [createElement(KlaraAssistant, { key: "k" })]);
    const nachher = await klaraOeffnen();
    expect([nachher.getAttribute("data-ko"), nachher.getAttribute("data-fassung")]).toEqual(erst);
    expect(erst).toEqual(["k7", "4"]);
  });

  it("ein ANDERER Artikel erbt die Fassung des zuletzt gelesenen nicht", async () => {
    meldeGelesenenStand({ koId: "k7", fassung: 4 });
    await montiere(["/wissen/k8"], [createElement(KlaraAssistant, { key: "k" })]);
    const bezug = await klaraOeffnen();
    expect(bezug.getAttribute("data-ko")).toBe("k8");
    expect(bezug.hasAttribute("data-fassung")).toBe(false);
    expect(q('[data-testid="klara-objektbezug-fragen"]')?.getAttribute("href")).toBe(
      "/fragen?ko=k8",
    );
  });

  it("die Prüfung nennt ihren Beitrag ebenso", async () => {
    await montiere(["/validierung?ko=k7&fassung=4"], [createElement(KlaraAssistant, { key: "k" })]);
    const bezug = await klaraOeffnen();
    expect(bezug.getAttribute("data-seite")).toBe("pruefen");
    expect(bezug.getAttribute("data-ko")).toBe("k7");
    expect(bezug.getAttribute("data-fassung")).toBe("4");
  });

  it("ohne Artikelbezug (Startseite) bleibt der Block weg", async () => {
    await montiere(["/start"], [createElement(KlaraAssistant, { key: "k" })]);
    await klick("button[data-klara='1']");
    expect(q('[data-testid="klara-objektbezug"]')).toBeNull();
  });
});
