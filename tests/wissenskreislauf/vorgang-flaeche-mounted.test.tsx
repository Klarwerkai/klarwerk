// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:wissenskreislauf-schliessen — DIE VORGANGSFLÄCHE ZEIGT DEN SERVERSTAND.
// ================================================================================================
//
// Gemountet wird die echte Komponente `LueckenVorgang` mit dem echten Provider-Stapel; nur der
// Server ist ersetzt (`endpoints.gaps.*`). Gemessen wird, dass die Fläche anzeigt, was der Server
// sagt — sie rechnet keine Phase und keinen Prüfstand nach — und die vorhandenen Schritte auslöst.
//
//   V1 — gelöst: Stand, nächster Schritt, Klara-Erklärung aus genau diesem Stand, Ergebnislink.
//   V2 — offene Rückfrage: die Fragende antwortet; gesendet wird (Lücke, Rückfrage, Text).
//   V3 — Ergebnis heute nicht zugänglich: kein Titel, kein Link.
//   V4 — administrativ zurückgenommen: eigener Grund, ausdrücklich keine fachliche Antwort.
//   V5 — zuständig: „Fachlich abschließen" erst bei bestandener Fachprüfung, dann gesendet.
//   V6 — Klara im Vorschau-Betrieb: die Erklärung sagt, dass sie aus dem echten Vorgang stammt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GapVorgang } from "../../apps/web/src/api/types";

const lage = vi.hoisted(() => ({
  vorgang: null as unknown,
  antworten: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
  abschliessen: vi.fn(async (..._a: unknown[]): Promise<unknown> => ({})),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "frida", name: "Frida", email: "f@fiktiv.de", role: "experte" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    gaps: {
      vorgang: vi.fn(async () => lage.vorgang),
      rueckfrageBeantworten: lage.antworten,
      abschliessen: lage.abschliessen,
      rueckfrage: vi.fn(async () => lage.vorgang),
      uebergeben: vi.fn(async () => lage.vorgang),
      entwurf: vi.fn(async () => lage.vorgang),
      zuruecknehmen: vi.fn(async () => ({})),
    },
    directory: {
      list: vi.fn(async () => [
        { id: "fachmann", name: "Fachmann Fiktiv" },
        { id: "frida", name: "Frida Fiktiv" },
      ]),
    },
    ko: {
      list: vi.fn(async () => [{ id: "ko-1", title: "Zyrlax-Kreislauf nach Stillstand anfahren" }]),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { LueckenVorgang } from "../../apps/web/src/components/LueckenVorgang";
import { aendere } from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import { notificationTarget } from "../../apps/web/src/lib/notificationTarget";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const LUECKE = { id: "gap-1", question: "Wie stelle ich den Zyrlax-Kreislauf ein?" };

const EINTRAG = {
  koId: "ko-1",
  titel: "Zyrlax-Kreislauf nach Stillstand anfahren",
  koVersion: 2,
  status: "validiert" as const,
  eigentuemer: "fachmann",
  sichtbarkeit: "intern",
  spaceGebunden: false,
  quellen: 1,
  nutzbarkeit: { nutzbar: true, gruende: [], koVersion: 2, benoetigt: 3, gruen: 3, rot: 0 },
};

function sicht(teil: Partial<GapVorgang>): GapVorgang {
  return {
    id: "gap-1",
    question: LUECKE.question,
    status: "offen",
    phase: "in_bearbeitung",
    rollen: ["fragend"],
    naechsterSchritt: "bearbeitung_abwarten",
    zustaendig: { id: "fachmann", verfuegbar: true },
    fragende: 2,
    askCount: 2,
    zuordnungen: [{ an: "fachmann", art: "uebergabe", at: "2026-10-10T08:05:00.000Z" }],
    rueckfragen: [],
    entwurf: null,
    ergebnis: null,
    abschluss: null,
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

async function mount(vorgang: GapVorgang): Promise<void> {
  lage.vorgang = vorgang;
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
              ToastProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: ["/risiko?fall=gap-1"] },
                createElement(LueckenVorgang, { gapId: LUECKE.id, anfangsOffen: true }),
              ),
            ),
          ),
        ),
      ),
    );
  });
  await act(flush);
}

const text = (): string => container.textContent ?? "";
const finde = (testid: string): HTMLElement | null =>
  container.querySelector<HTMLElement>(`[data-testid="${testid}"]`);

beforeEach(async () => {
  lage.antworten.mockReset();
  lage.abschliessen.mockReset();
  await i18n.changeLanguage("de");
  aendere((z) => ({ ...z, betrieb: "echt" }));
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

describe("Vorgangsfläche · zeigt den Serverstand und löst die vorhandenen Schritte aus", () => {
  it("V1 · gelöst: Stand, Klara-Erklärung aus diesem Stand, Ergebnis mit Link", async () => {
    await mount(
      sicht({
        status: "geschlossen",
        phase: "geloest",
        naechsterSchritt: "ergebnis_lesen",
        abschluss: { art: "fachlich", at: "2026-10-10T09:00:00.000Z", koVersion: 2 },
        ergebnis: EINTRAG,
      }),
    );
    const phase = i18n.t("lueckenvorgang.phase.geloest");
    const schritt = i18n.t("lueckenvorgang.schritt.ergebnis_lesen");
    expect(finde("luecke-vorgang-stand")?.textContent).toContain(phase);
    expect(finde("luecke-vorgang-naechster")?.textContent).toContain(schritt);
    expect(finde("luecke-klara")?.textContent).toContain(
      i18n.t("lueckenvorgang.klara.satz", { phase, schritt }),
    );
    expect(finde("luecke-eintrag")?.dataset.nutzbar).toBe("ja");
    expect(finde("luecke-ergebnis-oeffnen")?.getAttribute("href")).toBe("/wissen/ko-1");
    expect(text()).toContain(
      i18n.t("lueckenvorgang.eintrag.pruefung", { gruen: 3, benoetigt: 3, rot: 0 }),
    );
    expect(text()).toContain(i18n.t("lueckenvorgang.nutzbar"));
  });

  it("V2 · offene Rückfrage: die Fragende antwortet, gesendet wird Lücke, Rückfrage, Text", async () => {
    await mount(
      sicht({
        phase: "rueckfrage_offen",
        naechsterSchritt: "rueckfrage_beantworten",
        rueckfragen: [{ id: "rf-1", frage: "Welche Baureihe?", at: "2026-10-10T08:10:00.000Z" }],
      }),
    );
    expect(text()).toContain("Welche Baureihe?");
    const feld = finde("luecke-rueckfrage-antwort") as HTMLTextAreaElement | null;
    expect(feld).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(feld, "Baureihe 4");
      feld?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      feld?.form?.requestSubmit();
    });
    await act(flush);
    expect(lage.antworten).toHaveBeenCalledWith("gap-1", "rf-1", "Baureihe 4");
  });

  it("V3 · Ergebnis heute nicht zugänglich: kein Titel, kein Link", async () => {
    await mount(
      sicht({
        status: "geschlossen",
        phase: "geloest",
        naechsterSchritt: "ergebnis_lesen",
        abschluss: { art: "fachlich", at: "2026-10-10T09:00:00.000Z", koVersion: 2 },
        ergebnis: { zugaenglich: false },
      }),
    );
    expect(finde("luecke-eintrag-gesperrt")?.textContent).toBe(
      i18n.t("lueckenvorgang.ergebnisNichtZugaenglich"),
    );
    expect(text()).not.toContain(EINTRAG.titel);
    expect(finde("luecke-ergebnis-oeffnen")).toBeNull();
  });

  it("V4 · administrativ zurückgenommen: eigener Grund, keine fachliche Antwort", async () => {
    await mount(
      sicht({
        status: "geschlossen",
        phase: "zurueckgenommen",
        naechsterSchritt: "erneut_fragen",
        abschluss: { art: "administrativ", at: "2026-10-10T09:00:00.000Z", grund: "dublette" },
      }),
    );
    const satz = finde("luecke-abschluss")?.textContent ?? "";
    expect(satz).toContain(i18n.t("lueckenvorgang.ruecknahme.dublette"));
    expect(satz).not.toContain(i18n.t("lueckenvorgang.phase.geloest"));
    expect(finde("luecke-ergebnis-oeffnen")).toBeNull();
  });

  it("V5 · zuständig: Abschluss erst nach bestandener Fachprüfung, dann gesendet", async () => {
    await mount(
      sicht({
        rollen: ["zustaendig"],
        phase: "in_fachpruefung",
        naechsterSchritt: "fachpruefung_abwarten",
        entwurf: {
          ...EINTRAG,
          status: "offen",
          nutzbarkeit: {
            nutzbar: false,
            gruende: ["nicht_freigegeben", "bewertungen_fehlen"],
            koVersion: 2,
            benoetigt: 3,
            gruen: 1,
            rot: 0,
          },
        },
      }),
    );
    expect((finde("luecke-abschliessen") as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(text()).toContain(i18n.t("lueckenvorgang.grund.bewertungen_fehlen"));
    await act(async () => {
      root.unmount();
    });
    container.remove();
    await mount(
      sicht({
        rollen: ["zustaendig"],
        phase: "bereit_zum_abschluss",
        naechsterSchritt: "fachlich_abschliessen",
        entwurf: EINTRAG,
      }),
    );
    const knopf = finde("luecke-abschliessen") as HTMLButtonElement | null;
    expect(knopf?.disabled).toBe(false);
    await act(async () => {
      knopf?.click();
    });
    await act(flush);
    expect(lage.abschliessen).toHaveBeenCalledWith("gap-1");
  });

  it("V6 · Klara im Vorschau-Betrieb: die Erklärung stammt trotzdem aus dem echten Vorgang", async () => {
    aendere((z) => ({ ...z, betrieb: "demo" }));
    await mount(sicht({}));
    expect(finde("luecke-klara")?.textContent).toContain(i18n.t("lueckenvorgang.klara.demo"));
  });

  it("V7 · jede Lückenmeldung der Glocke führt in den für Beteiligte erreichbaren Vorgang", async () => {
    await mount(sicht({}));
    expect(notificationTarget({ kind: "luecke", gapId: "gap-1" })).toBe("/luecke/gap-1");
    expect(notificationTarget({ kind: "luecke" })).toBeNull();
  });
});
