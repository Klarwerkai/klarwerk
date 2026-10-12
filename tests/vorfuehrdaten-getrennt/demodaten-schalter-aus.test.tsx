// @vitest-environment jsdom
// ================================================================================================
// R-0913 · BEN, Nacharbeit 2 — DIE DEMODATENKARTE BEI AUSGESCHALTETEM BETRIEBSSCHALTER.
// ================================================================================================
//
// Der Befund (`AdminDatenDetails.tsx` Demodatenkarte, `FeatureGate.tsx:32-35`): bei bestätigtem
// `features.demodaten=false` fehlte der Ladeknopf ersatzlos, die Karte sagte nichts über den Grund,
// und das „?"-Menü beschrieb trotzdem uneingeschränkt das Laden (`adm.seedHint`).
//
// Gemessen an der echten Karte (echtes React, echtes i18n, echtes React-Query); Attrappen nur an
// den Endpunktgrenzen und an `useFeatures`, dessen vier Lagen hier der Gegenstand sind:
//
//   S1  bestätigt aus     Aus-Zeile sichtbar, kein Ladeknopf, keine Ladehilfe im „?"-Menü.
//   S2  bestätigt an      Ladeknopf da, Ladehilfe im „?"-Menü, keine Aus-Zeile.
//   S3  lädt              Weder Knopf noch Aus-Zeile — keine Behauptung ohne Auskunft.
//   S4  Fehler            Wie S3: ein gescheiterter Abruf ist kein bestätigtes „aus".
//   S5  Entfernen         Bleibt bei „aus" bedienbar — mit seiner Rückfrage vor dem Aufruf.
//   S6  DE/EN/NL          Die Aus-Zeile ist in allen drei Sprachen übersetzt.
//
// Der Rollenschutz (Recht `users.manage` am Server) wird hier NICHT geändert und nicht gemessen;
// diese Datei prüft nur, dass die Oberfläche keinen Weg öffnet, den der Schalter schließt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  features: { data: undefined, isLoading: false, isError: false } as {
    data: { features: Record<string, boolean> } | undefined;
    isLoading: boolean;
    isError: boolean;
  },
  demoSeed: vi.fn(async () => ({ skipped: false, kos: 0, users: 0 })),
  demoPurge: vi.fn(async () => ({ kos: 0, conflicts: 0, duplicates: 0, gaps: 0, users: 0 })),
}));

vi.mock("../../apps/web/src/api/client", async (echt) => ({
  ...(await echt<typeof import("../../apps/web/src/api/client")>()),
  // Branding-Stand in derselben Form wie `flaeche-mounted.test.tsx:254`.
  api: {
    get: vi.fn(async () => ({ profil: null, aktiv: false, version: 1, marke: null })),
    put: vi.fn(async () => ({})),
  },
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      demoStatus: vi.fn(async () => ({ present: true, count: 4 })),
      demoSeed: d.demoSeed,
      demoPurge: d.demoPurge,
      // Vertragsform `{ packages: [...] }` wie in `flaeche-mounted.test.tsx` — ein nacktes Array
      // liess die Advisor-Karte (`liste.packages.find`) im Rendern werfen.
      demoPackages: { list: vi.fn(async () => ({ packages: [] })), load: vi.fn() },
    },
  },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({
  useFeatures: () => d.features,
  useUsers: () => ({ data: [] }),
  useAudit: () => ({ data: [] }),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { DemodatenDetail } from "../../apps/web/src/pages/AdminDatenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function karte(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(
            MemoryRouter,
            null,
            createElement(DemodatenDetail, { onZurueck: () => {} }),
          ),
        ),
      ),
    );
    await flush();
  });
}

const allgemein = (): Element | null => container.querySelector('[data-einst="karte-allgemein"]');
const ausZeile = (): Element | null => container.querySelector('[data-testid="demo-laden-aus"]');
const ladeknopf = (): HTMLButtonElement | undefined =>
  [...(allgemein()?.querySelectorAll("button") ?? [])].find(
    (b) => (b.textContent ?? "").trim() === i18n.t("adm.seedButton"),
  );

/** Der Text, den das „?"-Menü der Karte anbietet — leer, wenn die Karte gar kein „?" trägt. */
async function hilfetext(): Promise<string> {
  const knopf = container.querySelector('[data-einst="hilfe"]');
  if (!(knopf instanceof HTMLButtonElement)) {
    return "";
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
  return container.querySelector('[data-einst="hilfemenue"]')?.textContent ?? "";
}

function knopfMitText(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").trim() === text,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.features = { data: undefined, isLoading: false, isError: false };
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("R-0913 · Demodatenkarte: ausgeschaltet ist ein sichtbarer Zustand", () => {
  it("S1 · bestätigt aus: Aus-Zeile, kein Ladeknopf, keine Ladehilfe", async () => {
    d.features = { data: { features: { demodaten: false } }, isLoading: false, isError: false };
    await karte();
    expect(ausZeile()?.textContent).toBe(i18n.t("demodaten.ladenAus"));
    expect(ladeknopf(), "der Ladeknopf steht trotz „aus“ da").toBeUndefined();
    expect(await hilfetext()).not.toContain(i18n.t("fachwort.demodaten.hinweis"));
    expect(d.demoSeed).not.toHaveBeenCalled();
  });

  it("S2 · bestätigt an: Ladeknopf und Ladehilfe, keine Aus-Zeile", async () => {
    d.features = { data: { features: { demodaten: true } }, isLoading: false, isError: false };
    await karte();
    expect(ausZeile()).toBeNull();
    expect(ladeknopf()).toBeInstanceOf(HTMLButtonElement);
    expect(await hilfetext()).toContain(i18n.t("fachwort.demodaten.hinweis"));
  });

  it("S3 · Auskunft lädt noch: weder Knopf noch Aus-Zeile", async () => {
    d.features = { data: undefined, isLoading: true, isError: false };
    await karte();
    expect(ausZeile(), "Laden wurde als bestätigtes „aus“ ausgegeben").toBeNull();
    expect(ladeknopf()).toBeUndefined();
    expect(await hilfetext()).not.toContain(i18n.t("fachwort.demodaten.hinweis"));
  });

  it("S4 · Auskunft gescheitert: weder Knopf noch Aus-Zeile", async () => {
    d.features = { data: undefined, isLoading: false, isError: true };
    await karte();
    expect(ausZeile(), "ein Fehler wurde als bestätigtes „aus“ ausgegeben").toBeNull();
    expect(ladeknopf()).toBeUndefined();
  });

  it("S4b · Schalter in der Auskunft nicht genannt: keine Aus-Behauptung", async () => {
    d.features = { data: { features: {} }, isLoading: false, isError: false };
    await karte();
    expect(ausZeile()).toBeNull();
    expect(ladeknopf()).toBeUndefined();
  });

  it("S5 · bei „aus“ bleibt Entfernen bedienbar — erst nach der Rückfrage ein Aufruf", async () => {
    d.features = { data: { features: { demodaten: false } }, isLoading: false, isError: false };
    await karte();
    const entfernen = knopfMitText(i18n.t("adm.purgeButton"));
    expect(entfernen, "Entfernen fehlt bei ausgeschaltetem Laden").toBeInstanceOf(
      HTMLButtonElement,
    );
    await act(async () => {
      entfernen?.click();
      await flush();
    });
    expect(d.demoPurge, "Entfernen lief ohne Rückfrage").not.toHaveBeenCalled();
    expect(container.textContent).toContain(i18n.t("adm.purgeQ"));
    await act(async () => {
      knopfMitText(i18n.t("adm.purgeYes"))?.click();
      await flush();
    });
    expect(d.demoPurge).toHaveBeenCalledTimes(1);
  });

  it("S6 · die Aus-Zeile ist in DE, EN und NL übersetzt", () => {
    const texte = ["de", "en", "nl"].map((lng) => i18n.getFixedT(lng)("demodaten.ladenAus"));
    for (const text of texte) {
      expect(text).not.toBe("demodaten.ladenAus");
      expect(text.length).toBeGreaterThan(0);
    }
    expect(new Set(texte).size, "eine Sprache fiel auf eine andere zurück").toBe(3);
  });
});
