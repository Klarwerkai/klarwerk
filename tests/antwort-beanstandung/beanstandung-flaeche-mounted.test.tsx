// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:antwort-beanstandung-korrektur — DIE BEDIENFLÄCHEN DER BEANSTANDUNG.
// ================================================================================================
//
// Gemountet werden die echten Komponenten `AntwortMelden` (an der Antwort) und `LueckenVorgang` (der
// eigene Vorgang) mit dem echten Provider-Stapel; ersetzt ist nur der Server (`endpoints`).
//
//   F1 — An der Antwort: Aussage wählen, Fundstelle wählen, kurze Begründung → gesendet wird genau
//        diese Bindung; die Quittung nennt den Vorgang und verlinkt ihn.
//   F2 — „Quelle fehlt": ohne Quelle gesendet; die Quittung sagt, dass niemand zuständig ist.
//   F3 — Ohne gewählte Aussage bleibt die bisherige einfache Meldung (drei Argumente).
//   F4 — Vorgang des Melders: Aussage, eigene Meldung mit Fassung, zurückgewiesen mit Begründung.
//   F5 — Zuständige Person: zurückgehaltene Aussage wird nicht gezeigt; Zurückweisen sendet Text.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AntwortAussagenBeleg, GapVorgang } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({
  vorgang: null as unknown,
  report: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
  zurueckweisen: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "melda", name: "Melda", email: "m@fiktiv.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ask: { report: lage.report },
    gaps: {
      vorgang: vi.fn(async () => lage.vorgang),
      zurueckweisen: lage.zurueckweisen,
      rueckfrageBeantworten: vi.fn(async () => lage.vorgang),
      abschliessen: vi.fn(async () => lage.vorgang),
      rueckfrage: vi.fn(async () => lage.vorgang),
      uebergeben: vi.fn(async () => lage.vorgang),
      entwurf: vi.fn(async () => lage.vorgang),
      zuruecknehmen: vi.fn(async () => ({})),
    },
    directory: { list: vi.fn(async () => [{ id: "fachmann", name: "Fachmann Fiktiv" }]) },
    ko: { list: vi.fn(async () => [{ id: "ko-1", title: "Spindel SP-7 schmieren" }]) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import type { ReactElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { LueckenVorgang } from "../../apps/web/src/components/LueckenVorgang";
import { AntwortMelden } from "../../apps/web/src/components/fragen/AntwortMelden";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const FALSCH = "Die Spindel SP-7 wird alle 40 Betriebsstunden im laufenden Betrieb geschmiert.";
const GRUND = "Laut Wartungsblatt nur im Stillstand.";

const AUSSAGEN: AntwortAussagenBeleg["aussagen"] = [
  {
    aussageId: "aus_1",
    text: FALSCH,
    deckung: "belegt",
    teile: [
      {
        fundstellen: [
          { fundstelleId: "fs_1", koId: "ko-1", koVersion: 1, auszug: "alle 40 Betriebsstunden" },
        ],
      },
    ],
  },
];

function quittung(teil: Record<string, unknown>) {
  return {
    meldungId: "M-0A1B2C3D4E",
    koId: "ko-1",
    koTitle: "Spindel SP-7 schmieren",
    grund: "antwort-falsch",
    at: "2026-10-10T09:00:00.000Z",
    zugestelltAn: "author-fallback",
    bereitsGemeldet: false,
    beanstandung: {
      vorgangId: "gap-7",
      answerId: "ans-1",
      aussageId: "aus_1",
      aussageFingerabdruck: "0123456789abcdef01234567",
      koVersion: 1,
      fundstelleId: "fs_1",
      quelleFehlt: false,
      zusammengefuehrt: false,
      zustaendigkeit: "zugeordnet",
    },
    ...teil,
  };
}

function sicht(teil: Partial<GapVorgang>): GapVorgang {
  return {
    id: "gap-7",
    question: "Beanstandete Aussage einer Antwort",
    status: "offen",
    phase: "in_bearbeitung",
    rollen: ["fragend"],
    naechsterSchritt: "bearbeitung_abwarten",
    zustaendig: { id: "fachmann", verfuegbar: true },
    fragende: 1,
    askCount: 1,
    zuordnungen: [],
    rueckfragen: [],
    entwurf: null,
    ergebnis: null,
    abschluss: null,
    beanstandung: {
      koId: "ko-1",
      quelleZugaenglich: true,
      quelleFehlt: false,
      fassungenDamals: [1],
      aussage: FALSCH,
      aussageZurueckgehalten: false,
      meldungen: 1,
      eigeneMeldungen: [
        {
          meldungId: "M-0A1B2C3D4E",
          at: "2026-10-10T09:00:00.000Z",
          answerId: "ans-1",
          aussageId: "aus_1",
          koVersion: 1,
          fundstelleId: "fs_1",
          quelleFehlt: false,
          begruendung: GRUND,
        },
      ],
      begruendungen: [],
    },
    ...teil,
  };
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(element: ReactElement): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
              ToastProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/fragen"] }, element),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const melden = (): ReactElement =>
  createElement(AntwortMelden, {
    quellen: [{ id: "ko-1", label: "Spindel SP-7 schmieren" }],
    receipt: "beleg-1",
    belegGueltig: true,
    onFehler: () => {},
    aussagen: AUSSAGEN,
  });

const finde = (testid: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);

async function klick(el: HTMLElement | null): Promise<void> {
  expect(el).not.toBeNull();
  await act(async () => {
    el?.click();
    await flush();
  });
}

async function waehle(testid: string, wert: string): Promise<void> {
  const feld = finde(testid) as HTMLSelectElement | null;
  expect(feld, testid).not.toBeNull();
  await act(async () => {
    if (feld) {
      feld.value = wert;
      feld.dispatchEvent(new Event("change", { bubbles: true }));
    }
    await flush();
  });
}

async function tippe(testid: string, wert: string): Promise<void> {
  const feld = finde(testid) as HTMLTextAreaElement | null;
  expect(feld, testid).not.toBeNull();
  const setzer = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, wert);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function absenden(testid: string): Promise<void> {
  await act(async () => {
    finde(testid)
      ?.closest("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

beforeEach(async () => {
  lage.report.mockReset();
  lage.zurueckweisen.mockReset();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("Beanstandung · Bedienflächen", () => {
  it("F1 · Aussage, Fundstelle und Begründung werden gebunden gesendet; die Quittung verlinkt den Vorgang", async () => {
    lage.report.mockResolvedValue(quittung({}));
    await mount(melden());
    await klick(finde("antwortmeldung-oeffnen"));
    await waehle("antwortmeldung-aussage", "aus_1");
    await waehle("antwortmeldung-fundstelle", "fs_1");
    // Ohne Begründung ist nicht absendbar.
    expect((finde("antwortmeldung-absenden") as HTMLButtonElement).disabled).toBe(true);
    await tippe("antwortmeldung-begruendung", GRUND);
    expect((finde("antwortmeldung-absenden") as HTMLButtonElement).disabled).toBe(false);
    await absenden("antwortmeldung-absenden");

    expect(lage.report).toHaveBeenCalledTimes(1);
    expect(lage.report).toHaveBeenCalledWith("ko-1", "beleg-1", "antwort-falsch", {
      aussage: { aussageId: "aus_1", text: FALSCH, fundstelleId: "fs_1" },
      begruendung: GRUND,
    });
    expect(finde("antwortmeldung-quittung")?.textContent).toContain("M-0A1B2C3D4E");
    expect(finde("antwortmeldung-beanstandung")?.textContent).toContain(
      i18n.t("antwortmeldung.beanstandung.zugeordnet"),
    );
    expect(finde("antwortmeldung-beanstandung")?.textContent).toContain(
      i18n.t("antwortmeldung.beanstandung.fassung", { fassung: 1 }),
    );
    expect(finde("antwortmeldung-vorgang")?.getAttribute("href")).toBe("/luecke/gap-7");
  });

  it("F2 · „Quelle fehlt“ wird ohne Quelle gesendet; niemand ist zuständig", async () => {
    lage.report.mockResolvedValue(
      quittung({
        koId: "",
        koTitle: "",
        zugestelltAn: "niemand",
        beanstandung: {
          ...quittung({}).beanstandung,
          koVersion: null,
          fundstelleId: null,
          quelleFehlt: true,
          zustaendigkeit: "offen",
        },
      }),
    );
    await mount(melden());
    await klick(finde("antwortmeldung-oeffnen"));
    await waehle("antwortmeldung-aussage", "aus_1");
    await klick(finde("antwortmeldung-quelle-fehlt"));
    await tippe("antwortmeldung-begruendung", "Für die 40 Stunden gibt es keinen Beleg.");
    await absenden("antwortmeldung-absenden");
    expect(lage.report).toHaveBeenCalledWith("", "beleg-1", "antwort-falsch", {
      aussage: { aussageId: "aus_1", text: FALSCH, quelleFehlt: true },
      begruendung: "Für die 40 Stunden gibt es keinen Beleg.",
    });
    expect(finde("antwortmeldung-quittung")?.dataset.zugestellt).toBe("niemand");
    expect(finde("antwortmeldung-beanstandung")?.textContent).toContain(
      i18n.t("antwortmeldung.beanstandung.offen"),
    );
  });

  it("F3 · ohne gewählte Aussage bleibt die einfache Meldung", async () => {
    lage.report.mockResolvedValue(quittung({ beanstandung: undefined }));
    await mount(melden());
    await klick(finde("antwortmeldung-oeffnen"));
    expect(finde("antwortmeldung-begruendung")).toBeNull();
    await absenden("antwortmeldung-absenden");
    expect(lage.report).toHaveBeenCalledWith("ko-1", "beleg-1", "antwort-falsch");
    expect(finde("antwortmeldung-vorgang")).toBeNull();
  });

  it("F4 · Vorgang des Melders: Aussage, eigene Meldung, begründete Zurückweisung", async () => {
    lage.vorgang = sicht({
      status: "geschlossen",
      phase: "zurueckgewiesen",
      naechsterSchritt: "begruendung_lesen",
      abschluss: {
        art: "zurueckgewiesen",
        at: "2026-10-11T09:00:00.000Z",
        begruendung: "Für Baujahr 2024 gilt das 40-Stunden-Intervall.",
        koId: "ko-1",
        koVersion: 1,
      },
    });
    await mount(createElement(LueckenVorgang, { gapId: "gap-7", anfangsOffen: true }));
    expect(finde("luecke-beanstandung-aussage")?.textContent).toContain(FALSCH);
    expect(finde("luecke-beanstandung-eigene")?.textContent).toContain(GRUND);
    expect(finde("luecke-beanstandung-eigene")?.textContent).toContain("M-0A1B2C3D4E");
    expect(finde("luecke-vorgang-stand")?.textContent).toContain(
      i18n.t("lueckenvorgang.phase.zurueckgewiesen"),
    );
    expect(finde("luecke-zurueckweisung-begruendung")?.textContent).toBe(
      "Für Baujahr 2024 gilt das 40-Stunden-Intervall.",
    );
    expect(finde("luecke-zurueckweisen")).toBeNull();
  });

  it("F5 · zuständig: zurückgehaltene Aussage bleibt verborgen; Zurückweisen sendet die Begründung", async () => {
    const offen = sicht({
      rollen: ["zustaendig"],
      beanstandung: {
        ...(sicht({}).beanstandung as NonNullable<GapVorgang["beanstandung"]>),
        aussage: "",
        aussageZurueckgehalten: true,
        eigeneMeldungen: [],
        begruendungen: [],
      },
    });
    lage.vorgang = offen;
    lage.zurueckweisen.mockResolvedValue(offen);
    await mount(createElement(LueckenVorgang, { gapId: "gap-7", anfangsOffen: true }));
    expect(finde("luecke-beanstandung-aussage")).toBeNull();
    expect(finde("luecke-beanstandung")?.textContent).toContain(
      i18n.t("lueckenvorgang.beanstandung.zurueckgehalten"),
    );
    expect((finde("luecke-zurueckweisen") as HTMLButtonElement).disabled).toBe(true);
    await tippe("luecke-zurueckweisen-text", "Die Aussage gilt für Baujahr 2024.");
    await absenden("luecke-zurueckweisen");
    expect(lage.zurueckweisen).toHaveBeenCalledWith("gap-7", "Die Aussage gilt für Baujahr 2024.");
  });
});
