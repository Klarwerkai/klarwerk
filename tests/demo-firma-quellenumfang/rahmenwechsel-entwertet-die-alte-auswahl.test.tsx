// @vitest-environment jsdom
// ================================================================================================
// JOB 3640 (Runde 4) · EIN GESETZTER ODER GEWECHSELTER RAHMEN ENTWERTET DIE ALTE AUSWAHL SOFORT.
// ================================================================================================
//
// BENS BEFUND (Runde 3, ROT, Korrekturpflicht 1), wörtlich nachgestellt: „Ungerahmte Basic-Seite
// auswählen und gruppieren → ‚Advisor' setzen → neue Auswahl mit Netzwerkfehler beantworten → alte
// Übernahme anklicken. Trotz sichtbarem ‚Rahmen: Advisor' wird gesendet:
// {"criteria":{},"includeIds":["basic1"],"snapshotToken":7,"selectedCandidateIds":["basic1"]}."
//
// WARUM ES DURCHKAM: Der Rahmen reiste nur in NEUE Anfragen mit. Die bereits aufgebaute Vorschau
// samt Gruppen blieb stehen, und ihr Nachladen ist um 350 ms verzögert und kann scheitern. In
// diesem Fenster stand unter der Zusage „ausschließlich Seiten mit diesem Wort im Titel" eine
// Auswahl, die diese Zusage bricht — und sie liess sich absenden.
//
// WAS DIESE DREI FÄLLE MESSEN, und zwar an der ECHTEN Fläche (gemountet sind `ImportExplore`,
// Schrittleiste, `ImportSelect` und `ImportGroups`; ersetzt ist NUR das `endpoints`-Modul):
//   1. NETZWERKFEHLER — nach dem Rahmenwechsel gibt es keinen Übernahme-Weg mehr, und es wird
//      nichts gesendet. Die alte Liste bleibt lesbar, sagt aber, wozu sie gehört.
//   2. ERFOLGREICHE AKTUALISIERUNG — danach trägt die Übernahme ausschließlich die passende ID und
//      das aktuelle Titelkriterium. (Ohne diesen Fall wäre Fall 1 nur eine Sperre, kein Rahmen.)
//   3. VERSPÄTETE ALTE ANTWORT — eine noch unterwegs gewesene ungerahmte Antwort darf die gerahmte
//      Vorschau nicht rückwärts überschreiben.
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
const groupMock = endpoints.admin.import.group as unknown as ReturnType<typeof vi.fn>;
const applyMock = endpoints.admin.import.apply as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let montiert = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Echte Zeit abwarten — die Fläche lädt eine offene Vorschau bewusst ERST 350 ms nach der
 * Filteränderung nach (`ImportSelect`, debounce). Genau dieses Fenster ist der Tatort; es mit
 * falschen Zeitgebern wegzuschummeln hiesse, den Fall nicht zu prüfen.
 */
const nachDemNachladen = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 500));
  });
  await act(flush);
};

/** Ein Versprechen, das dieser Test selbst auflöst — für die verspätete alte Antwort. */
function offen<T>(): { versprechen: Promise<T>; aufloesen: (wert: T) => void } {
  let aufloesen!: (wert: T) => void;
  const versprechen = new Promise<T>((res) => {
    aufloesen = res;
  });
  return { versprechen, aufloesen };
}

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

function knopfTexte(): string {
  return [...container.querySelectorAll("button")]
    .filter((b) => !verborgen(b))
    .map((b) => b.textContent ?? "")
    .join(" | ");
}

function sichtbarerKnopf(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").includes(teil) && !verborgen(b),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Sichtbarer Knopf „${teil}" fehlt; Knöpfe: ${knopfTexte()}`);
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

/** Die Firma wählen — genau der Weg, den der Mensch geht. */
async function rahmenSetzen(firma: string): Promise<void> {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("aria-label") === i18n.t("imp.rahmen.feldLabel"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Rahmen-Feld fehlt; sichtbar: ${sichtbarerText()}`);
  }
  setValue(feld, firma);
  await klicken(i18n.t("imp.rahmen.setzen"));
}

/**
 * Den Gruppieren-Schritt auslösen. Nach einer schon einmal gruppierten, inzwischen ANDEREN Auswahl
 * heisst derselbe Knopf „Gruppierung aktualisieren" (AUFTRAG-mega9 E-4) — genau die Lage nach einem
 * Rahmenwechsel. Der Test greift deshalb den Knopf, der WIRKLICH da steht, statt eine Beschriftung
 * zu erzwingen.
 */
async function gruppieren(): Promise<void> {
  const stale = [...container.querySelectorAll("button")].some(
    (b) => (b.textContent ?? "").includes(i18n.t("imp.groups.refreshGrouping")) && !verborgen(b),
  );
  await klicken(stale ? i18n.t("imp.groups.refreshGrouping") : i18n.t("imp.groups.cta"));
}

/** Der Haken einer Vorschau-Zeile — er trägt den Titel als `aria-label`. */
function zeilenHaken(titelTeil: string): HTMLInputElement {
  const haken = [...container.querySelectorAll('input[type="checkbox"]')].find((el) =>
    (el.getAttribute("aria-label") ?? "").includes(titelTeil),
  );
  if (!(haken instanceof HTMLInputElement)) {
    throw new Error(`Haken für „${titelTeil}" fehlt; sichtbar: ${sichtbarerText()}`);
  }
  return haken;
}

const SEITE_BASIC = {
  id: "basic1",
  title: "[Basic] Wartung Linie 3",
  hasImage: false,
  themes: ["Basic"],
};
const SEITE_ADVISOR = {
  id: "a1",
  title: `[${FIRMA}] Onboarding`,
  hasImage: false,
  themes: ["Demo"],
};

/** Was der Server OHNE Rahmen zurückmeldet — `criteria: {}`, genau wie in bens Gegenprobe. */
const UNGERAHMT = {
  matched: BESTAND.summary.totalCount,
  limited: false,
  truncated: false,
  criteria: {},
  preview: [SEITE_BASIC],
};

/** Und was er IM Rahmen zurückmeldet. */
const GERAHMT = {
  matched: FIRMA_SEITEN,
  limited: false,
  truncated: false,
  criteria: { titleContains: [FIRMA] },
  preview: [SEITE_ADVISOR],
};

function gruppen(seite: typeof SEITE_BASIC, token: number) {
  return {
    groups: [{ title: seite.themes[0] ?? "", ids: [seite.id] }],
    candidates: [
      {
        id: seite.id,
        title: seite.title,
        alreadyImported: false,
        alreadyQueued: false,
        sourceNewer: false,
        hints: [],
      },
    ],
    demo: false,
    snapshotToken: token,
  };
}

/** Der Körper des letzten Auswahl-Aufrufs. */
function letzterSelect(): { criteria: Record<string, unknown>; prompt: string } {
  return selectMock.mock.calls.at(-1)?.[0] as { criteria: Record<string, unknown>; prompt: string };
}

beforeEach(async () => {
  vi.clearAllMocks();
  globalThis.localStorage?.clear();
  await i18n.changeLanguage("de");
  exploreMock.mockResolvedValue(BESTAND);
  // EINE Attrappe für alle drei Aufrufwege der Auswahl-Route: die Umfangsmessung des Rahmens
  // (`limit: 1`, ohne Satz), die gerahmte und die ungerahmte Vorschau.
  selectMock.mockImplementation(async (body: { criteria: Record<string, unknown> }) => {
    if (body.criteria.limit === 1) {
      return { ...GERAHMT, preview: [] };
    }
    return Array.isArray(body.criteria.titleContains) ? GERAHMT : UNGERAHMT;
  });
  groupMock.mockImplementation(async (body: { selectedCandidateIds?: string[] }) =>
    (body.selectedCandidateIds ?? []).includes(SEITE_ADVISOR.id)
      ? gruppen(SEITE_ADVISOR, 9)
      : gruppen(SEITE_BASIC, 7),
  );
  applyMock.mockResolvedValue({
    imported: 1,
    updates: 0,
    alreadyQueued: 0,
    failed: [],
    notFound: [],
  });
});

afterEach(async () => {
  await unmount();
});

/** Der gemeinsame Ausgangspunkt aller drei Fälle: ungerahmt ausgewählt UND bereits gruppiert. */
async function ungerahmtGruppiert(): Promise<void> {
  await mount();
  await klicken(i18n.t("imp.explore.cta"));
  await klicken(i18n.t("imp.select.previewCta"));
  await klicken(i18n.t("imp.groups.cta"));
  // Kalibrierung des Ausgangszustands: hier wurde WIRKLICH ungerahmt gruppiert — sonst prüften die
  // Fälle darunter eine Lage, die es nie gab.
  expect((groupMock.mock.calls[0]?.[0] as { criteria: unknown }).criteria).toEqual({});
  expect(sichtbarerText()).toContain(SEITE_BASIC.title);
}

describe("JOB 3640 R4 · der Rahmenwechsel macht die alte Auswahl sofort unwirksam", () => {
  it("NETZWERKFEHLER: nach dem Rahmenwechsel gibt es keine Übernahme der alten Auswahl mehr", async () => {
    await ungerahmtGruppiert();

    // Die neue Auswahl scheitert — genau bens Fall.
    selectMock.mockRejectedValue(new Error("Netz weg"));
    await rahmenSetzen(FIRMA);
    await nachDemNachladen();

    // DER KERN, und er wird GEDRÜCKT, nicht nur betrachtet: steht der alte Übernahme-Knopf noch da,
    // schickt er die ungerahmte Auswahl ab. Der Fall klickt ihn deshalb, WENN es ihn gibt — im
    // Rotfall steht in der Fehlermeldung genau der Körper, den bens Gegenprobe gesehen hat.
    const alterKnopf = [...container.querySelectorAll("button")].find(
      (b) =>
        (b.textContent ?? "").includes(i18n.t("imp.groups.applyCta", { n: 1 })) && !verborgen(b),
    );
    if (alterKnopf instanceof HTMLButtonElement) {
      await act(async () => {
        alterKnopf.click();
      });
      await act(flush);
    }
    expect(applyMock.mock.calls).toEqual([]);

    // Der Rahmen gilt sichtbar …
    expect(sichtbarerText()).toContain(`Rahmen: ${FIRMA}`);
    // … und die Fläche sagt, dass die Liste darunter NICHT zu ihm gehört und was das bedeutet.
    expect(container.querySelector('[data-testid="rahmen-gewechselt"]')).not.toBeNull();
    expect(sichtbarerText()).toContain("Die Liste unten stammt weiter aus der Abfrage davor");
    // Sie wird dabei NICHT geleert (LEHREN §7) — die zuletzt geholte Auskunft bleibt lesbar.
    expect(sichtbarerText()).toContain(SEITE_BASIC.title);

    // Der Weg in die Übernahme ist fort — Gruppen-Schritt samt Knöpfen.
    expect(knopfTexte()).not.toContain("übernehmen");
    expect(container.querySelector('[data-testid="rahmen-gruppen-gesperrt"]')).not.toBeNull();

    // Und aus der entwerteten Liste lässt sich auch nichts mehr an- oder abwählen.
    const haken = zeilenHaken(SEITE_BASIC.title);
    expect(haken.closest("fieldset")?.disabled).toBe(true);
    await act(async () => {
      haken.click();
    });
    await act(flush);
    expect(zeilenHaken(SEITE_BASIC.title).checked).toBe(true);
    expect(applyMock).not.toHaveBeenCalled();
  });

  it("NACH DER AKTUALISIERUNG: die Übernahme trägt genau die gerahmte ID und das Titelkriterium", async () => {
    await ungerahmtGruppiert();

    await rahmenSetzen(FIRMA);
    await nachDemNachladen();

    // Die Vorschau gehört jetzt zum Rahmen: die fremde Seite ist fort, die Sperre ebenfalls.
    const text = sichtbarerText();
    expect(text).not.toContain(SEITE_BASIC.title);
    expect(text).toContain(SEITE_ADVISOR.title);
    expect(text).toContain(`Rahmen (Firma): ${FIRMA}`);
    expect(container.querySelector('[data-testid="rahmen-gewechselt"]')).toBeNull();
    expect(container.querySelector('[data-testid="rahmen-gruppen-gesperrt"]')).toBeNull();
    expect(letzterSelect().criteria.titleContains).toEqual([FIRMA]);

    // Und der ganze Weg bis zum Ende trägt ihn.
    await gruppieren();
    expect((groupMock.mock.calls.at(-1)?.[0] as { criteria: unknown }).criteria).toEqual({
      titleContains: [FIRMA],
    });
    await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
    const uebernahme = applyMock.mock.calls[0]?.[0] as {
      criteria: Record<string, unknown>;
      includeIds: string[];
      selectedCandidateIds: string[];
    };
    expect(uebernahme.criteria).toEqual({ titleContains: [FIRMA] });
    expect(uebernahme.includeIds).toEqual([SEITE_ADVISOR.id]);
    expect(uebernahme.selectedCandidateIds).toEqual([SEITE_ADVISOR.id]);
  });

  it("VERSPÄTETE ALTE ANTWORT: eine ungerahmte Antwort von unterwegs holt die fremde Seite nicht zurück", async () => {
    await ungerahmtGruppiert();

    // Eine ungerahmte Auffrischung ist noch unterwegs, als der Rahmen gesetzt wird.
    const spaet = offen<typeof UNGERAHMT>();
    selectMock.mockImplementationOnce(async () => spaet.versprechen);
    await klicken(i18n.t("imp.select.previewAgain"));

    await rahmenSetzen(FIRMA);
    await nachDemNachladen();
    expect(sichtbarerText()).toContain(SEITE_ADVISOR.title);

    // Jetzt kommt die alte Antwort — sie darf die gerahmte Vorschau nicht rückwärts überschreiben.
    await act(async () => {
      spaet.aufloesen(UNGERAHMT);
      await flush();
    });
    await act(flush);

    const text = sichtbarerText();
    expect(text).not.toContain(SEITE_BASIC.title);
    expect(text).toContain(SEITE_ADVISOR.title);
    expect(text).toContain(`Rahmen (Firma): ${FIRMA}`);
    expect(container.querySelector('[data-testid="rahmen-gewechselt"]')).toBeNull();

    await gruppieren();
    await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
    const uebernahme = applyMock.mock.calls[0]?.[0] as {
      criteria: Record<string, unknown>;
      includeIds: string[];
    };
    expect(uebernahme.criteria).toEqual({ titleContains: [FIRMA] });
    expect(uebernahme.includeIds).toEqual([SEITE_ADVISOR.id]);
  });

  // ==============================================================================================
  // DIE ANTWORT VON UNTERWEGS — der Fall, der die Herkunft der Zuordnung entscheidet.
  // ==============================================================================================
  //
  // Eine UNGERAHMT gestartete Anfrage kommt an, NACHDEM der Rahmen gesetzt wurde, aber BEVOR das
  // Nachladen (350 ms) überhaupt losgeht. Sie ist dann die jüngste Anfrage — latest-wins lässt sie
  // durch, und sie füllt die Liste. Ob ihr Ergebnis als „gerahmt" gilt, darf deshalb NICHT am
  // gerade gültigen Prop hängen, sondern nur am Rahmen, der WIRKLICH in dieser Anfrage steckte.
  // Sonst trüge eine ungerahmte Antwort den neuen Rahmennamen und wäre sofort übernehmbar.
  it("ANTWORT VON UNTERWEGS: ungerahmt gestartet heisst ungerahmt — auch wenn sie erst danach ankommt", async () => {
    await ungerahmtGruppiert();

    const unterwegs = offen<typeof UNGERAHMT>();
    selectMock.mockImplementationOnce(async () => unterwegs.versprechen);
    await klicken(i18n.t("imp.select.previewAgain"));

    // Der Rahmen wird gesetzt, während sie noch fliegt — und sie landet VOR dem Nachladen.
    await rahmenSetzen(FIRMA);
    await act(async () => {
      unterwegs.aufloesen(UNGERAHMT);
      await flush();
    });
    await act(flush);

    // Sie ist angekommen und füllt die Liste — aber sie gehört zu keinem Rahmen.
    expect(sichtbarerText()).toContain(SEITE_BASIC.title);
    expect(container.querySelector('[data-testid="rahmen-gewechselt"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="rahmen-gruppen-gesperrt"]')).not.toBeNull();
    expect(knopfTexte()).not.toContain("Gruppieren");
    expect(knopfTexte()).not.toContain("Gruppierung aktualisieren");
    expect(applyMock.mock.calls).toEqual([]);

    // Und es bleibt keine Sackgasse: das Nachladen im Rahmen löst die Sperre von selbst.
    await nachDemNachladen();
    expect(sichtbarerText()).toContain(SEITE_ADVISOR.title);
    expect(container.querySelector('[data-testid="rahmen-gewechselt"]')).toBeNull();
  });

  it("EN: die Sperre nach dem Rahmenwechsel steht auch auf Englisch da", async () => {
    await i18n.changeLanguage("en");
    try {
      await ungerahmtGruppiert();
      selectMock.mockRejectedValue(new Error("network gone"));
      await rahmenSetzen(FIRMA);
      await nachDemNachladen();

      const text = sichtbarerText();
      expect(text).toContain("The list below still comes from the previous request");
      expect(text).toContain("Grouping and importing become available again");
      expect(knopfTexte()).not.toMatch(/Import selection/);
      expect(applyMock).not.toHaveBeenCalled();
    } finally {
      await i18n.changeLanguage("de");
    }
  });
});
