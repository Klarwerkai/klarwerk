// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:aenderungsfolgen-sichtbar — DER REITER „ERNEUT" ZEIGT DAS WARUM, GEMOUNTET.
// ================================================================================================
//
// Am ECHTEN Produktpfad (`apps/web/src/pages/Lifecycle.tsx`), Attrappen-Muster wie
// `tests/wissen-frische/erneut-reiter-mounted.test.tsx`. Die Serverantworten sind fiktiv, in der
// Form von `GET /api/lifecycle/folgepruefung` (Spiegel: `apps/web/src/api/types.ts`).
//
//   K3  Die Liste nennt Titel, Änderungsgrund, zuständige Person, Prüfstatus und Termin.
//   K2  Die Karte sagt je Anlass, WARUM der Eintrag betroffen ist; sie behauptet keine
//       Vollständigkeit und deutet „Noch gültig" nicht als Freigabe.
//   K5  „Noch gültig" schickt den angezeigten Stand mit; ein 409 sagt, was geschah, und lädt neu.
//   K7  Fehlende Zuständigkeit, fehlender Anlass und weggefallene Kopplung stehen sichtbar da.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => ({
  pending: [] as string[],
  kos: [] as unknown[],
  faelle: [] as unknown[],
  folgepruefung: vi.fn(async (): Promise<unknown[]> => []),
  act: vi.fn(async (_id: string, _body: unknown): Promise<unknown> => ({})),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/app/AuthContext", async (original) => {
  const echt = await original<typeof import("../../apps/web/src/app/AuthContext")>();
  return {
    ...echt,
    useSession: () => ({
      ...echt.useSession(),
      user: { id: "u1", name: "Pia", email: "p@x.de", role: "admin" },
    }),
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      lifecycle: {
        pending: vi.fn(async () => d.pending),
        folgepruefung: d.folgepruefung,
        assetChanged: ok([]),
      },
      ko: { list: vi.fn(async () => d.kos), act: d.act },
      validation: { board: ok([]), overview: ok([]) },
      conflicts: { list: ok([]) },
      duplicates: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok([]), complete: ok({}) },
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
import { ApiError } from "../../apps/web/src/api/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Lifecycle } from "../../apps/web/src/pages/Lifecycle";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const HALTBAR_BIS = "2027-01-15T00:00:00.000Z";

function ko(id: string, title: string) {
  return {
    id,
    title,
    status: "validiert",
    asset: "Dosierstation DP-4",
    frische: {
      stufe: "faellig",
      halbwertszeitTage: 365,
      bezugAm: "2026-06-01T00:00:00.000Z",
      letztesSignal: null,
      haltbarBis: HALTBAR_BIS,
      erinnerungAb: "2027-01-01T00:00:00.000Z",
      erinnern: false,
      verantwortlich: "u2",
      verantwortlichArt: "owner",
      gesichert: false,
      aktuellerStand: false,
      schutz: "intern",
      betriebsmodell: "freigegebene_ki",
      inDokumente: false,
      naechsterSchritt: "erneut_bestaetigen",
      ungeprueft: {},
    },
  };
}

function fallA() {
  return {
    koId: "ka",
    title: "Dosierpumpe DP-4 entlüften",
    status: "validiert",
    version: 4,
    stand: 2,
    seit: "2026-10-10T08:00:00.000Z",
    zustaendig: { id: "u2", name: "Mara Meister", vorhanden: true, art: "owner" },
    anlaesse: [
      {
        grund: "anlage",
        am: "2026-10-10T08:00:00.000Z",
        assetRef: "Dosierstation DP-4",
        kopplungBesteht: true,
        aenderung: "Rev. B",
        ausloeser: null,
        koVersion: 3,
      },
      {
        grund: "nachbar",
        am: "2026-10-10T09:00:00.000Z",
        assetRef: "Dosierstation DP-4",
        kopplungBesteht: true,
        aenderung: "Rev. C",
        ausloeser: { koId: "kb", title: "Dosiermenge DP-4 einstellen", version: 7 },
        koVersion: 3,
      },
    ],
  };
}

function fallB() {
  return {
    koId: "kb",
    title: "Dosiermenge DP-4 einstellen",
    status: "validiert",
    version: 7,
    stand: 1,
    seit: null,
    zustaendig: { id: "konto-ausgeschieden-0001", name: null, vorhanden: false, art: "owner" },
    anlaesse: [],
  };
}

async function mount(): Promise<void> {
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
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/lebenszyklus"] },
              createElement(
                ToastProvider,
                null,
                createElement(Lifecycle),
                createElement(ToastViewport),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

function karte(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="pruefen-karte"]');
  if (!el) {
    throw new Error("Keine Karte gerendert");
  }
  return el;
}

function knopfNochGueltig(): HTMLButtonElement {
  const knopf = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(i18n.t("lcy.stillValid")),
  );
  if (!knopf) {
    throw new Error("Knopf „Noch gültig“ fehlt");
  }
  return knopf;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  d.pending = ["ka", "kb"];
  d.kos = [ko("ka", "Dosierpumpe DP-4 entlüften"), ko("kb", "Dosiermenge DP-4 einstellen")];
  d.folgepruefung.mockImplementation(async () => [fallA(), fallB()]);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("K3 · die Liste nennt Grund, Zuständigkeit, Prüfstatus und Termin", () => {
  it("je Zeile unter dem Titel — aus der Folgeprüfung und der Frische", async () => {
    await mount();
    const zeilen = [...container.querySelectorAll('[data-testid="folgepruefung-zeile"]')].map(
      (z) => z.textContent ?? "",
    );
    expect(zeilen).toHaveLength(2);
    const [a, b] = zeilen;
    expect(a).toContain(i18n.t("folgepruefung.grundKurz.mehrere", { anzahl: 2 }));
    expect(a).toContain("Mara Meister");
    expect(a).toContain(i18n.t("folgepruefung.statusOffen", { stand: 2 }));
    expect(a).toContain(new Date(HALTBAR_BIS).toLocaleDateString());
    expect(b).toContain(i18n.t("folgepruefung.grundKurz.unbekannt"));
    expect(b).toContain(
      i18n.t("folgepruefung.zustaendigFehlt", { id: "konto-ausgeschieden-0001" }),
    );
  });
});

describe("K2 · die Karte begründet die Betroffenheit", () => {
  it("je Anlass Grund, Anlage, Änderungsbeleg und Fassungen; dazu Zuständigkeit, Status, Termin", async () => {
    await mount();
    const warum = karte().querySelector('[data-testid="folgepruefung-warum"]');
    expect(warum, "der Warum-Block steht auf der Karte").not.toBeNull();
    const anlaesse = [...(warum?.querySelectorAll('[data-testid="folgepruefung-anlass"]') ?? [])];
    expect(anlaesse).toHaveLength(2);
    expect(anlaesse[0]?.textContent).toContain(
      i18n.t("folgepruefung.grund.anlage", { asset: "Dosierstation DP-4" }),
    );
    expect(anlaesse[0]?.textContent).toContain(
      i18n.t("folgepruefung.aenderung", { aenderung: "Rev. B" }),
    );
    expect(anlaesse[0]?.textContent).toContain(
      i18n.t("folgepruefung.fassungBeiMeldung", { version: 3 }),
    );
    expect(anlaesse[1]?.textContent).toContain(
      i18n.t("folgepruefung.grund.nachbar", {
        titel: "Dosiermenge DP-4 einstellen",
        asset: "Dosierstation DP-4",
      }),
    );
    expect(anlaesse[1]?.textContent).toContain(
      i18n.t("folgepruefung.ausloeserFassung", { version: 7 }),
    );
    // Seit der Meldung überarbeitet (Fassung 3 → 4): das steht da, statt still zu gelten.
    expect(warum?.textContent).toContain(
      i18n.t("folgepruefung.seitMeldungUeberarbeitet", { alt: 3, neu: 4 }),
    );
    expect(karte().querySelector('[data-testid="folgepruefung-zustaendig"]')?.textContent).toBe(
      "Mara Meister",
    );
    expect(karte().querySelector('[data-testid="folgepruefung-status"]')?.textContent).toContain(
      i18n.t("folgepruefung.statusOffen", { stand: 2 }),
    );
    expect(karte().querySelector('[data-testid="folgepruefung-termin"]')?.textContent).toBe(
      new Date(HALTBAR_BIS).toLocaleDateString(),
    );
    expect(warum?.textContent).toContain(i18n.t("folgepruefung.abdeckung"));
    expect(warum?.textContent).toContain(i18n.t("folgepruefung.bestaetigtHinweis"));
  });

  it("K7: fehlender Anlass und fehlende Zuständigkeit sind benannt", async () => {
    await mount();
    const zweite = container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="pruefen-warteschlange-eintrag"]',
    )[1];
    await act(async () => {
      zweite?.click();
      await flush();
    });
    const warum = karte().querySelector('[data-testid="folgepruefung-warum"]');
    expect(warum?.textContent).toContain(i18n.t("folgepruefung.anlassFehlt"));
    expect(karte().querySelector('[data-testid="folgepruefung-zustaendig"]')?.textContent).toBe(
      i18n.t("folgepruefung.zustaendigFehlt", { id: "konto-ausgeschieden-0001" }),
    );
  });

  it("K7: eine weggefallene Kopplung steht als Warnung am Anlass", async () => {
    d.folgepruefung.mockImplementation(async () => {
      const a = fallA();
      return [{ ...a, anlaesse: [{ ...a.anlaesse[0], kopplungBesteht: false }] }];
    });
    d.pending = ["ka"];
    await mount();
    expect(karte().textContent).toContain(
      i18n.t("folgepruefung.kopplungFehlt", { asset: "Dosierstation DP-4" }),
    );
  });
});

describe("K5 · „Noch gültig“ gilt dem angezeigten Stand", () => {
  it("die Bestätigung schickt den Stand mit", async () => {
    await mount();
    await act(async () => {
      knopfNochGueltig().click();
      await flush();
    });
    expect(d.act).toHaveBeenCalledWith("ka", { action: "revalidate", stand: 2 });
  });

  it("409 STAND_VERALTET: verständliche Meldung, die Übersicht lädt neu, der Eintrag bleibt", async () => {
    d.act.mockImplementationOnce(async () => {
      throw new ApiError(
        409,
        "STAND_VERALTET",
        "Seit der Anzeige ist eine weitere Änderung eingegangen.",
      );
    });
    await mount();
    const aufrufeVorher = d.folgepruefung.mock.calls.length;
    await act(async () => {
      knopfNochGueltig().click();
      await flush();
    });
    const einblendungen = Array.from(container.querySelectorAll("output"), (o) => o.textContent);
    expect(einblendungen).toContain(i18n.t("folgepruefung.standVeraltet"));
    expect(einblendungen).not.toContain(i18n.t("lcy.toast.revalidateFailed"));
    expect(d.folgepruefung.mock.calls.length).toBeGreaterThan(aufrufeVorher);
    expect(container.querySelector('a[href="/wissen/ka"]'), "der Eintrag bleibt").not.toBeNull();
  });

  // Nacharbeit 4 (Ben, K5): die frühere Erwartung — ein UNGEBUNDENER Aufruf ohne Stand — war genau
  // der Fehler. Ohne angezeigten Stand gibt es keinen Abschluss; die Karte bietet das Neuladen an.
  it("ohne geladene Anlässe: „Noch gültig“ gesperrt, kein ungebundener Aufruf, Neuladen holt den Stand", async () => {
    let gestoert = true;
    d.folgepruefung.mockImplementation(async () => {
      if (gestoert) {
        throw new Error("Prüfstand: Übersicht gestört");
      }
      return [fallA(), fallB()];
    });
    await mount();
    const hinweis = karte().querySelector('[data-testid="folgepruefung-ladefehler"]');
    expect(hinweis?.textContent).toContain(i18n.t("folgepruefung.ladefehler"));
    expect(knopfNochGueltig().disabled).toBe(true);
    await act(async () => {
      knopfNochGueltig().click();
      await flush();
    });
    expect(d.act).not.toHaveBeenCalled();

    gestoert = false;
    await act(async () => {
      karte().querySelector<HTMLButtonElement>('[data-testid="folgepruefung-neu-laden"]')?.click();
      await flush();
    });
    expect(knopfNochGueltig().disabled).toBe(false);
    await act(async () => {
      knopfNochGueltig().click();
      await flush();
    });
    expect(d.act).toHaveBeenCalledWith("ka", { action: "revalidate", stand: 2 });
  });

  it("GEGENPROBE: rein fristfälliger Eintrag OHNE Merker bestätigt wie bisher ohne Stand", async () => {
    d.pending = [];
    d.folgepruefung.mockImplementation(async () => []);
    await mount();
    expect(knopfNochGueltig().disabled).toBe(false);
    await act(async () => {
      knopfNochGueltig().click();
      await flush();
    });
    expect(d.act).toHaveBeenCalledWith("ka", { action: "revalidate" });
  });
});
