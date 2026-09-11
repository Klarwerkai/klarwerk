// @vitest-environment jsdom
// ================================================================================================
// JOB 3640 · DIE GEWÄHLTE FIRMA BESTIMMT, WAS DER IMPORT ZEIGT — AN DER ECHTEN FLÄCHE GEMESSEN.
// ================================================================================================
//
// PEDIS BEFUND (11.09., über Codex): Er hatte verlangt, die Firma wählen zu können, für die er
// vorführt; danach sollen nur deren Daten sichtbar sein. Er fand die Auswahl nicht — es gab sie
// nicht, und das Erkunden zeigte 110 Seiten aus einer Quelle.
//
// GEMOUNTET WIRD DIE ECHTE `ImportExplore`-FLÄCHE samt Provider, Schrittleiste und `ImportSelect`;
// ersetzt ist NUR das `endpoints`-Modul. Ein Test, der den Rahmen an einer nachgebauten Hülle
// prüfte, bewiese nichts über den Weg, den Pedi vor sich hat.
//
// SICHTBARKEIT statt `textContent`: dieselbe Lehre wie in JOB 3258/3356 — die Zusage des Auftrags
// ist, dass der Mensch den Rahmen SIEHT. Verborgene Teilbäume bleiben deshalb draußen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    admin: {
      import: {
        explore: vi.fn(),
        select: vi.fn(),
        group: vi.fn(),
        apply: vi.fn(),
      },
    },
    reasoner: { status: vi.fn().mockResolvedValue({ active: false, mode: "deterministic" }) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ImportExplore } from "../../apps/web/src/components/ImportExplore";
import {
  ImportCockpitProvider,
  ImportStepperBar,
} from "../../apps/web/src/components/ImportStepper";
import i18n from "../../apps/web/src/i18n";
import { BESTAND, FIRMA, FIRMA_SEITEN } from "./bestand";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

const exploreMock = endpoints.admin.import.explore as unknown as ReturnType<typeof vi.fn>;
const selectMock = endpoints.admin.import.select as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Steht gerade ein Kasten? `unmount` ist dadurch idempotent — ein Fall, der selbst abräumt (oder
// gar nicht erst mountet), lässt `afterEach` nicht ins Leere greifen.
let montiert = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
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
          MemoryRouter,
          { initialEntries: ["/import"] },
          createElement(
            ImportCockpitProvider,
            null,
            createElement(ImportStepperBar),
            createElement(ImportExplore),
          ),
        ),
      ),
    );
  });
  await act(flush);
  montiert = true;
}

async function unmount(): Promise<void> {
  if (!montiert) {
    return;
  }
  montiert = false;
  await act(async () => {
    root.unmount();
  });
  container.remove();
}

// Ist dieser Knoten (samt Elternkette) für einen sehenden Menschen da?
function verborgen(el: Element): boolean {
  for (let node: Element | null = el; node !== null; node = node.parentElement) {
    if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") {
      return true;
    }
    if (/\b(sr-only|invisible|hidden)\b/.test(node.getAttribute("class") ?? "")) {
      return true;
    }
    if (/display:\s*none|visibility:\s*hidden/.test(node.getAttribute("style") ?? "")) {
      return true;
    }
  }
  return false;
}

function sichtbarerText(): string {
  const teile: string[] = [];
  const gehe = (el: Element): void => {
    if (verborgen(el)) {
      return;
    }
    for (const kind of el.childNodes) {
      if (kind.nodeType === 3) {
        teile.push(kind.textContent ?? "");
      } else if (kind.nodeType === 1) {
        gehe(kind as Element);
      }
    }
  };
  gehe(container);
  return teile.join(" ");
}

function sichtbarerKnopf(teil: string): HTMLButtonElement {
  const treffer = [...container.querySelectorAll("button")].filter(
    (b) => (b.textContent ?? "").includes(teil) && !verborgen(b),
  );
  const btn = treffer[0];
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Sichtbarer Knopf „${teil}" fehlt; sichtbar: ${sichtbarerText()}`);
  }
  return btn;
}

async function klicken(teil: string): Promise<void> {
  await act(async () => {
    sichtbarerKnopf(teil).click();
  });
  await act(flush);
}

function setValue(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function rahmenFeld(): HTMLInputElement {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("aria-label") === i18n.t("imp.rahmen.feldLabel"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Rahmen-Feld fehlt; sichtbar: ${sichtbarerText()}`);
  }
  return feld;
}

/** Die Firma wählen — genau der Weg, den der Mensch geht. */
async function rahmenSetzen(firma: string): Promise<void> {
  setValue(rahmenFeld(), firma);
  await klicken(i18n.t("imp.rahmen.setzen"));
}

/** Eine Auswahl-Antwort, die (wie der echte Server) die effektiv benutzten Kriterien zurückmeldet. */
function auswahlAntwort(criteria: Record<string, unknown>, matched: number) {
  return {
    matched,
    limited: matched > 1,
    truncated: false,
    criteria,
    preview: [{ id: "a1", title: `[${FIRMA}] Onboarding`, hasImage: false, themes: ["Demo"] }],
  };
}

/** Die Kriterien der letzten Auswahl-Anfrage. */
function letzteKriterien(): Record<string, unknown> {
  return (selectMock.mock.calls.at(-1)?.[0] as { criteria: Record<string, unknown> }).criteria;
}

beforeEach(async () => {
  vi.clearAllMocks();
  globalThis.localStorage?.clear();
  await i18n.changeLanguage("de");
  exploreMock.mockResolvedValue(BESTAND);
  // Die Umfangsmessung des Rahmens läuft über dieselbe READ-ONLY Auswahl-Route.
  selectMock.mockImplementation(
    async (body: { criteria: Record<string, unknown>; prompt: string }) => {
      const gerahmt = Array.isArray(body.criteria.titleContains);
      return auswahlAntwort(body.criteria, gerahmt ? FIRMA_SEITEN : BESTAND.summary.totalCount);
    },
  );
});

afterEach(async () => {
  await unmount();
});

describe("JOB 3640 · der Vorführrahmen — die Wahl vor dem Erkunden", () => {
  it("die Wahl steht VOR dem Erkunden sichtbar da, benannt und erklärt", async () => {
    await mount();
    const text = sichtbarerText();
    expect(text).toContain("Für welche Firma führst du vor?");
    // Sie steht VOR dem Erkunden-Knopf — nicht irgendwo unter der Landkarte.
    const wahl = container.querySelector('[data-testid="vorfuehrrahmen-wahl"]');
    const cta = sichtbarerKnopf(i18n.t("imp.explore.cta"));
    expect(wahl).not.toBeNull();
    // „VOR dem Erkunden" heißt hier wörtlich: im Dokument vor dem Erkunden-Knopf.
    // Die Bitmaske ist der Vertrag von `compareDocumentPosition` — FOLLOWING heißt: der Knopf kommt
    // im Dokument NACH dem Rahmenkasten.
    const lage = wahl?.compareDocumentPosition(cta) ?? 0;
    expect(lage & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0);
    // Ohne Wahl behauptet nichts einen Rahmen.
    expect(text).not.toContain("Rahmen:");
  });

  it("ohne Rahmen bleibt alles wie bisher: 110 Seiten, und die Auswahl reist ohne Titelkriterium", async () => {
    await mount();
    await klicken(i18n.t("imp.explore.cta"));
    expect(sichtbarerText()).toContain("110");
    await klicken(i18n.t("imp.select.previewCta"));
    expect(letzteKriterien().titleContains).toBeUndefined();
  });

  // ==============================================================================================
  // §4.4 — DIE ZAHL SAGT DIE WAHRHEIT.
  // ==============================================================================================
  it("mit Rahmen zeigt das Erkunden die GEMESSENE Seitenzahl der Firma, nicht die 110", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    await klicken(i18n.t("imp.explore.cta"));

    const text = sichtbarerText();
    // Die Leiste sagt, dass ein Rahmen gilt, und wie groß er ist.
    expect(text).toContain(`Rahmen: ${FIRMA}`);
    expect(text).toContain(`${FIRMA_SEITEN} Seiten im Rahmen`);
    // Die Kennzahl selbst ist die gerahmte — mit der Gesamtzahl als ehrlicher Bezugsgröße.
    expect(text).toContain("Seiten im Rahmen");
    expect(text).toContain("von 110 im Gesamtbestand");

    // Gemessen wurde sie WIRKLICH: über die Auswahl-Route, mit genau einem Kriterium und OHNE Satz
    // (also ohne Modell, ohne Egress).
    const messung = selectMock.mock.calls
      .map((c) => c[0] as { prompt: string; criteria: Record<string, unknown> })
      .find((c) => Array.isArray(c.criteria.titleContains));
    expect(messung?.prompt).toBe("");
    expect(messung?.criteria.titleContains).toEqual([FIRMA]);
  });

  it("§5 — die Landkarte sagt, dass SIE den Gesamtbestand zählt (statt es zu verschweigen)", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    await klicken(i18n.t("imp.explore.cta"));
    // Autoren-/Themenzähler stammen aus der ungerahmten Erkundung — das steht sichtbar dabei.
    expect(sichtbarerText()).toContain("zählen den GESAMTEN Bestand");
    // Und ohne Rahmen steht dieser Satz NICHT da (er hätte dort keinen Gegenstand).
    await klicken(i18n.t("imp.rahmen.aufheben"));
    expect(sichtbarerText()).not.toContain("zählen den GESAMTEN Bestand");
  });

  // ==============================================================================================
  // §4.2 — DER RAHMEN BINDET, ER SCHLÄGT NICHT NUR VOR.
  // ==============================================================================================
  it("jede Auswahl-Anfrage trägt den Rahmen — auch nach einem Themen-Klick", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    await klicken(i18n.t("imp.explore.cta"));
    await klicken(i18n.t("imp.select.previewCta"));
    expect(letzteKriterien().titleContains).toEqual([FIRMA]);

    // Ein Themenchip GRENZT WEITER EIN, er hebt den Rahmen nicht auf (UND, nicht ODER).
    await klicken("Demo");
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    await act(flush);
    expect(letzteKriterien().titleContains).toEqual([FIRMA]);
    expect(letzteKriterien().themes).toEqual(["Demo"]);
  });

  it("die Kriterienzeile nennt den Rahmen beim Namen", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    await klicken(i18n.t("imp.explore.cta"));
    await klicken(i18n.t("imp.select.previewCta"));
    expect(sichtbarerText()).toContain(`Rahmen (Firma): ${FIRMA}`);
  });

  // ==============================================================================================
  // §4.1 — MIT EINEM GRIFF WIEDER AUFZUHEBEN, UND ER ÜBERLEBT DIE VORBEREITUNG.
  // ==============================================================================================
  it("ein Griff hebt den Rahmen auf — danach ist kein Titelkriterium mehr unterwegs", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    await klicken(i18n.t("imp.explore.cta"));
    await klicken(i18n.t("imp.select.previewCta"));
    expect(letzteKriterien().titleContains).toEqual([FIRMA]);

    await klicken(i18n.t("imp.rahmen.aufheben"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    await act(flush);
    expect(sichtbarerText()).not.toContain(`Rahmen: ${FIRMA}`);
    expect(letzteKriterien().titleContains).toBeUndefined();
    // Und die Kennzahl ist wieder die ungerahmte Gesamtzahl.
    expect(sichtbarerText()).toContain("110");
    expect(sichtbarerText()).not.toContain("von 110 im Gesamtbestand");
  });

  it("der Rahmen überlebt das Schließen der Seite — Pedi muss nicht daran denken", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    await unmount();

    await mount();
    expect(sichtbarerText()).toContain(`Rahmen: ${FIRMA}`);
    // Auch nach dem Neuaufbau ist die Wahl kein bloßer Text: sie rahmt sofort wieder.
    await klicken(i18n.t("imp.explore.cta"));
    await klicken(i18n.t("imp.select.previewCta"));
    expect(letzteKriterien().titleContains).toEqual([FIRMA]);
  });

  // ==============================================================================================
  // ZUSTANDSMODELL (LEHREN §7) — EINE ZAHL NUR MIT GRUNDLAGE.
  // ==============================================================================================
  it("scheitert die Messung, behauptet die Fläche KEINE Seitenzahl", async () => {
    await mount();
    selectMock.mockRejectedValue(new Error("Netz weg"));
    await rahmenSetzen(FIRMA);
    await klicken(i18n.t("imp.explore.cta"));

    const text = sichtbarerText();
    expect(text).toContain("Seitenzahl nicht abrufbar.");
    expect(text).toContain("Erneut zählen");
    // Die ungerahmte 110 darf jetzt NICHT als Zahl des Rahmens dastehen.
    expect(text).not.toContain("Seiten im Rahmen");
    expect(text).not.toContain("von 110 im Gesamtbestand");
    // Der Rahmen selbst gilt weiter — nur seine Zahl ist unbekannt.
    expect(text).toContain(`Rahmen: ${FIRMA}`);
  });

  it("ein leerer Rahmen ist kein stilles Nichts — er sagt, dass er leer ist", async () => {
    await mount();
    selectMock.mockImplementation(async (body: { criteria: Record<string, unknown> }) =>
      auswahlAntwort(body.criteria, 0),
    );
    await rahmenSetzen("Kranhydraulik");
    await klicken(i18n.t("imp.explore.cta"));
    expect(sichtbarerText()).toContain("Keine geladene Seite trägt „Kranhydraulik“ im Titel.");
  });

  it("vor dem Erkunden wird keine Zahl gemessen und keine behauptet", async () => {
    await mount();
    await rahmenSetzen(FIRMA);
    expect(selectMock).not.toHaveBeenCalled();
    expect(sichtbarerText()).toContain("Seitenzahl noch nicht gemessen");
  });

  it("EN: dieselbe Wahl und dieselbe gerahmte Zahl auf Englisch", async () => {
    await i18n.changeLanguage("en");
    try {
      await mount();
      expect(sichtbarerText()).toContain("Which company are you presenting for?");
      await rahmenSetzen(FIRMA);
      await klicken(i18n.t("imp.explore.cta"));
      const text = sichtbarerText();
      expect(text).toContain(`Frame: ${FIRMA}`);
      expect(text).toContain(`${FIRMA_SEITEN} pages inside the frame`);
      expect(text).toContain("of 110 in the entire source");
      expect(text).toContain("count the ENTIRE source");
    } finally {
      await i18n.changeLanguage("de");
    }
  });

  // ==============================================================================================
  // RUNDE 2 · DIE TEXTE WOHNEN NICHT MEHR IM ZENTRALEN KATALOG — ALSO WIRD IHRE ANMELDUNG GEMESSEN.
  // ==============================================================================================
  //
  // Seit Runde 2 stehen die Rahmen-Texte in `ImportSelect.tsx` und melden sich selbst an der EINEN
  // i18next-Instanz an (`registriereRahmenTexte`). Der Fehler, den dieser Weg haben KANN, ist
  // genau einer: ein Schlüssel wird nirgends registriert und die Fläche zeigt statt eines Satzes
  // seinen Rohschlüssel („imp.rahmen.aktiv"). Das fällt in jsdom nicht von selbst auf — ein
  // `toContain("Rahmen:")` wäre auch bei halbem Bündel grün. Deshalb wird es hier ausdrücklich
  // gemessen, in beiden Sprachen der Vorführung.
  it("kein Rohschlüssel auf der Fläche — in DE und EN", async () => {
    for (const sprache of ["de", "en"] as const) {
      // Der gespeicherte Rahmen des ersten Durchgangs darf den zweiten nicht vorbelegen — sonst
      // steht dort gar kein Eingabefeld mehr und der Fall misst einen anderen Zustand als gedacht.
      globalThis.localStorage?.clear();
      await i18n.changeLanguage(sprache);
      await mount();
      await rahmenSetzen(FIRMA);
      await klicken(i18n.t("imp.explore.cta"));
      expect(sichtbarerText(), `Rohschlüssel sichtbar in ${sprache}`).not.toMatch(/imp\.rahmen\./);
      await unmount();
    }
    await i18n.changeLanguage("de");
  });

  it("das Bündel ist in allen DREI Sprachen vollständig — kein stiller Rückfall auf Deutsch", () => {
    // Gemessen am ECHTEN Ressourcenspeicher, nicht an den Quellobjekten: nur was angemeldet ist,
    // findet `t()` auch. Fehlte ein Schlüssel in `en`, fiele i18next auf `fallbackLng: "de"`
    // zurück — ein deutscher Satz, der sich als englischer ausgibt.
    const schluessel = (sprache: string): string[] =>
      Object.keys((i18n.getResourceBundle(sprache, "translation") ?? {}) as Record<string, unknown>)
        .filter((k) => k.startsWith("imp.rahmen."))
        .sort();
    const de = schluessel("de");
    // Ein leeres Ergebnis wäre ein grüner Wächter, der nichts bewacht.
    expect(de.length).toBeGreaterThan(15);
    expect(schluessel("en")).toEqual(de);
    expect(schluessel("nl")).toEqual(de);
  });
});
