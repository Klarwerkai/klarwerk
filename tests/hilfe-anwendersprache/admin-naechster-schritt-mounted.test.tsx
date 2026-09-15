// @vitest-environment jsdom
// ================================================================================================
// JOB 4067 · „NÄCHSTER SCHRITT" NACH DEM DEMODATEN-LADEN — GEMESSEN AM DOM, IN DE, EN UND NL.
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI FESTHÄLT. Nach einem erfolgreichen Demodaten-Lauf stand unter
// Admin → Daten: „Jetzt Stage-1 ansehen oder die Pilot-Checkliste öffnen", mit den Schaltflächen
// „Stage-1 starten (Start öffnen)" und „Pilot-Checkliste öffnen". „Stage-1" steht nirgends in der
// Oberfläche, und die Zielkarte auf `/hilfe` heisst seit JOB 4022 „Der erste Arbeitsweg: so fängst
// du an" (`i18n.ts:4943`) — der Link nannte ein Ziel, das es unter diesem Namen nicht gibt.
//
// WO DIESE KARTE WIRKLICH STEHT. Der REST-Absatz von JOB 4022
// (`archiv/4022/runde-1/RUECKGABE.md:52`) verortet `pilot.next.*` „auf dem Start-Bildschirm". Das
// ist nachgemessen falsch: einziger Renderer ist `pages/AdminDatenDetails.tsx:585-606`, sichtbar
// allein bei `demoSeed.isSuccess && !demoSeed.data?.skipped`. Genau diese Bedingung wird hier
// mitgeprüft (A3/A4) — die Sprachumstellung darf die Karte in keinen Zustand hineinziehen, in dem
// sie heute nicht steht.
//
// BAUFORM wie `tests/vorfuehrdaten-getrennt/flaeche-mounted.test.tsx`: echte Karte, echtes React,
// echtes i18n, echtes React-Query; Attrappen ausschliesslich an den Endpunktgrenzen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  demoStatus: vi.fn(),
  demoSeed: vi.fn(),
  demoPurge: vi.fn(),
  paketListe: vi.fn(),
  paketLaden: vi.fn(),
}));

vi.mock("../../apps/web/src/api/client", async (echt) => ({
  ...(await echt<typeof import("../../apps/web/src/api/client")>()),
  api: { get: d.get, put: d.put },
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      demoStatus: d.demoStatus,
      demoSeed: d.demoSeed,
      demoPurge: d.demoPurge,
      demoPackages: { list: d.paketListe, load: d.paketLaden },
    },
  },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({
  useFeatures: () => ({ data: { features: { demodaten: true } } }),
  useUsers: () => ({ data: [] }),
  useAudit: () => ({ data: [] }),
}));

import { PILOT_NEXT_STEPS } from "../../apps/web/src/lib/pilotNextSteps";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;

// Dieselbe Herkunft wie im Wächter nebenan (Bedienbefund 18:16 plus die Wortwahl der Oberfläche),
// hier auf die Schaltflächen angewandt — am DOM, einschliesslich Überschrift und Hinweissatz.
const INTERN = ["Stage-1", "Stage 1", "Pilot", "pilot", "Peers", "peers", "Review", "review", "UX"];

async function frischesFenster() {
  vi.resetModules();
  const react = await import("../../apps/web/node_modules/react");
  const reactDom = await import("../../apps/web/node_modules/react-dom/client");
  const reactQuery = await import("../../apps/web/node_modules/@tanstack/react-query");
  // Die drei Schaltflächen sind `<Link>`s — ohne Router wirft React-Router beim Rendern.
  const router = await import("../../apps/web/node_modules/react-router-dom");
  const toast = await import("../../apps/web/src/app/ToastContext");
  const i18nModul = await import("../../apps/web/src/i18n");
  const seite = await import("../../apps/web/src/pages/AdminDatenDetails");

  await i18nModul.default.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);

  return {
    act: react.act,
    createElement: react.createElement,
    i18n: i18nModul.default,
    container,
    root: reactDom.createRoot(container),
    qc: new reactQuery.QueryClient({ defaultOptions: { queries: { retry: false } } }),
    Anbieter: reactQuery.QueryClientProvider,
    Router: router.MemoryRouter,
    Meldungen: toast.ToastProvider,
    Karte: seite.DemodatenDetail,
  };
}

let f: Awaited<ReturnType<typeof frischesFenster>>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function stelleAuf(sprache: string): Promise<void> {
  await f.act(async () => {
    await f.i18n.changeLanguage(sprache);
  });
  await f.act(async () => {
    f.root.render(
      f.createElement(
        f.Anbieter,
        { client: f.qc },
        f.createElement(
          f.Router,
          null,
          f.createElement(
            f.Meldungen,
            null,
            f.createElement(f.Karte, { onZurueck: () => undefined }),
          ),
        ),
      ),
    );
  });
  await f.act(async () => {
    await flush();
  });
}

const karteAllgemein = (): HTMLElement => {
  const el = f.container.querySelector('[data-einst="karte-allgemein"]');
  expect(el, "die allgemeine Demodaten-Karte fehlt").not.toBeNull();
  return el as HTMLElement;
};

/**
 * Die Karte „Nächster Schritt" — an ihrem Inhalt erkannt, nicht an einer Testmarke: sie trägt die
 * Überschrift UND alle drei Ziele aus `PILOT_NEXT_STEPS`. Gesucht wird die INNERSTE solche Hülle
 * (Dokumentreihenfolge listet Eltern vor Kindern), damit nicht die halbe Seite mitgemessen wird.
 */
function naechsterSchritt(): HTMLElement {
  const titel = f.i18n.t("pilot.next.title");
  const ziele = PILOT_NEXT_STEPS.map((s) => s.to);
  const treffer = [...karteAllgemein().querySelectorAll("div")].filter((el) => {
    if (!(el.textContent ?? "").includes(titel)) {
      return false;
    }
    const hrefs = [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    return ziele.every((ziel) => hrefs.includes(ziel));
  });
  expect(treffer.length, "die Karte „Nächster Schritt“ steht nicht da").toBeGreaterThan(0);
  return treffer[treffer.length - 1] as HTMLElement;
}

const stehtNichtDa = (): void => {
  expect(
    karteAllgemein().textContent ?? "",
    "die Karte „Nächster Schritt“ steht in einem Zustand, in dem sie nicht stehen darf",
  ).not.toContain(f.i18n.t("pilot.next.title"));
};

const klick = async (el: HTMLElement): Promise<void> => {
  await f.act(async () => {
    el.click();
  });
  await f.act(async () => {
    await flush();
  });
};

/** Der Ladeknopf der allgemeinen Karte, über seine sichtbare Schrift gesucht — so findet ihn Pedi. */
const ladeknopf = (): HTMLButtonElement => {
  const schrift = f.i18n.t("adm.seedButton");
  const treffer = [...karteAllgemein().querySelectorAll("button")].filter((b) =>
    (b.textContent ?? "").includes(schrift),
  );
  expect(treffer.length, `Knopf „${schrift}“`).toBe(1);
  return treffer[0] as HTMLButtonElement;
};

beforeEach(async () => {
  for (const spy of Object.values(d)) {
    spy.mockReset();
  }
  d.get.mockResolvedValue({ profil: null, aktiv: false, version: 1, marke: null });
  d.demoStatus.mockResolvedValue({ present: false, count: 0 });
  d.paketListe.mockResolvedValue({ packages: [] });
  d.demoSeed.mockResolvedValue({ kos: 12, users: 3, skipped: false, einmalkennwoerter: [] });
  f = await frischesFenster();
});

afterEach(async () => {
  await f.act(async () => {
    f.root.unmount();
  });
  f.container.remove();
  f.qc.clear();
});

describe("JOB 4067 · „Nächster Schritt“ unter Admin → Daten", () => {
  for (const sprache of SPRACHEN) {
    describe(`Sprache ${sprache}`, () => {
      it("A1: nach dem Laden stehen drei Schaltflächen in unveränderter Reihenfolge da", async () => {
        await stelleAuf(sprache);
        await klick(ladeknopf());
        const karte = naechsterSchritt();
        expect(karte.textContent ?? "").toContain(f.i18n.t("pilot.next.hint"));
        // Reihenfolge UND Beschriftung, Zeile für Zeile aus derselben Quelle, die die Fläche liest.
        const gesehen = [...karte.querySelectorAll("a")].map((a) => ({
          href: a.getAttribute("href"),
          schrift: (a.textContent ?? "").trim(),
        }));
        expect(gesehen).toEqual(
          PILOT_NEXT_STEPS.map((s) => ({ href: s.to, schrift: f.i18n.t(s.labelKey) })),
        );
      });

      it("A2: keine Schaltfläche nennt „Stage-1“ oder die Karte, die es nicht mehr gibt", async () => {
        await stelleAuf(sprache);
        await klick(ladeknopf());
        const text = naechsterSchritt().textContent ?? "";
        for (const begriff of INTERN) {
          expect(text, `„${begriff}" steht in der Karte (${sprache})`).not.toContain(begriff);
        }
        // Und der Link trägt den HEUTIGEN Namen der Zielkarte auf `/hilfe`.
        const checkliste = [...naechsterSchritt().querySelectorAll("a")].find(
          (a) => a.getAttribute("href") === "/hilfe",
        );
        expect(checkliste, "der Link auf die Hilfe fehlt").not.toBeUndefined();
        expect(checkliste?.textContent ?? "").toContain(f.i18n.t("pilot.access.title"));
      });
    });
  }

  it("A3: ein übersprungener Lauf zeigt KEINE Karte — es gibt nichts, was gerade entstanden wäre", async () => {
    d.demoSeed.mockResolvedValue({ kos: 0, users: 0, skipped: true, einmalkennwoerter: [] });
    await stelleAuf("de");
    await klick(ladeknopf());
    stehtNichtDa();
  });

  it("A4: vor dem Laden steht die Karte nicht da", async () => {
    await stelleAuf("de");
    stehtNichtDa();
  });
});
