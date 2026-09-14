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

/**
 * JOB 3772: derselbe Ablauf-Rührer für BEIDE Zeitarten. Die Fälle des Rahmens (JOB 3640) laufen
 * weiter in ECHTER Zeit; die Fälle der Eingrenzung brauchen das 350-ms-Fenster ANGEHALTEN (sonst
 * hinge „die Anfrage lief noch nicht" an der Tagesform des geteilten Rechners). Ein zweiter Rührer
 * daneben wäre ein zweiter Testaufbau — deshalb fragt dieser eine, welche Zeit gerade gilt.
 */
const flush = async (): Promise<void> => {
  for (let i = 0; i < 12; i++) {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(0);
    } else {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
};

/**
 * Echte Zeit abwarten — die Fläche lädt eine offene Vorschau bewusst ERST 350 ms nach der
 * Filteränderung nach (`ImportSelect`, debounce). Genau dieses Fenster ist der Tatort; es mit
 * falschen Zeitgebern wegzuschummeln hiesse, den Fall nicht zu prüfen.
 * JOB 3772: unter angehaltener Zeit wird dieselbe Spanne ausdrücklich vorgedreht — gewartet wird
 * also in beiden Fällen 500 ms, nur einmal echt und einmal gestellt.
 */
const nachDemNachladen = async (): Promise<void> => {
  await act(async () => {
    if (vi.isFakeTimers()) {
      await vi.advanceTimersByTimeAsync(500);
    } else {
      await new Promise((r) => setTimeout(r, 500));
    }
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

// ================================================================================================
// JOB 3772 · DIESELBE ATTRAPPE, EINE EINGRENZUNG WEITER.
// ================================================================================================
//
// Die Fälle unten grenzen NICHT über den Rahmen ein, sondern über das, was die Landkarte und die
// Felder darunter hergeben: einen Themen-Chip, die beiden Jahresfelder und den Deckel. Der Server
// meldet dafür eine ANDERE Seite zurück — nur so ist am Bildschirm und am abgeschickten Körper
// überhaupt zu unterscheiden, welche Antwort gerade dasteht.
const SEITE_STAND = {
  id: "s1",
  title: "[Stand] Ladesäule prüfen",
  hasImage: false,
  themes: ["Stand"],
};

/** Das Thema, über das die Fälle eingrenzen — bewusst eines, das KEINE Vorschauzeile trägt: sonst
 *  böte die Facettenschiene der Trefferliste denselben Wortlaut ein zweites Mal als Knopf an. */
const THEMA = "Stand";

/** Trägt dieser Anfragekörper überhaupt eine Eingrenzung (Chip, Jahr, Deckel)? */
function eingegrenzt(criteria: Record<string, unknown>): boolean {
  return (
    Array.isArray(criteria.themes) ||
    Array.isArray(criteria.authors) ||
    Array.isArray(criteria.spaces) ||
    criteria.yearFrom !== undefined ||
    criteria.yearTo !== undefined ||
    criteria.limit !== undefined
  );
}

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
    if (Array.isArray(body.criteria.titleContains)) {
      return GERAHMT;
    }
    // JOB 3772: eingegrenzt (Chip/Jahr/Deckel) → eine ANDERE Seite, und die Kriterien wörtlich so
    // zurück, wie der Server sie effektiv benutzt hat.
    if (eingegrenzt(body.criteria)) {
      return {
        matched: 9,
        limited: false,
        truncated: false,
        criteria: body.criteria,
        preview: [SEITE_STAND],
      };
    }
    return UNGERAHMT;
  });
  groupMock.mockImplementation(async (body: { selectedCandidateIds?: string[] }) => {
    const ids = body.selectedCandidateIds ?? [];
    if (ids.includes(SEITE_ADVISOR.id)) {
      return gruppen(SEITE_ADVISOR, 9);
    }
    if (ids.includes(SEITE_STAND.id)) {
      return gruppen(SEITE_STAND, 5);
    }
    return gruppen(SEITE_BASIC, 7);
  });
  applyMock.mockResolvedValue({
    imported: 1,
    updates: 0,
    alreadyQueued: 0,
    failed: [],
    notFound: [],
  });
});

afterEach(async () => {
  // JOB 3772: die angehaltene Zeit gilt nur innerhalb eines Falls — sonst erbte der nächste sie.
  // Zuerst zurückstellen, dann abbauen: ein Abbau unter gestellter Zeit müsste sonst selbst
  // vorgedreht werden, und ein hängender Abbau verdeckte jeden echten Befund.
  vi.useRealTimers();
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

// ================================================================================================
// JOB 3772 · ÜBERNOMMEN WIRD NUR, WAS ZUR AKTUELLEN EINGRENZUNG GEHÖRT.
// ================================================================================================
//
// DERSELBE TATORT WIE OBEN, EINE EINGRENZUNG WEITER — und deshalb steht er in DERSELBEN Datei: es
// gibt nach diesem Auftrag genau EINE Regel, die entscheidet, ob die angezeigte Antwort zur
// Gegenwart gehört (`ImportSelect.tsx`, `kriterienVeraltet`), und der Rahmenfall darüber ist ihre
// schärfere Teilmenge. Zwei Wächterdateien für eine Regel wären zwei Aufbauten für eine Sache.
//
// DER REST AUS JOB 3640 R4, wörtlich: „Dieselbe Bauart von Lücke besteht weiterhin für die ÜBRIGEN
// Eingrenzungen (Themen-/Autoren-Chips, Jahre, Deckel): auch dort liegen zwischen der Änderung und
// der neu geholten Vorschau 350 ms, in denen eine schon gebaute Gruppierung der vorherigen
// Eingrenzung übernommen werden kann." Genau das messen die Fälle hier.
//
// WAS SICH VOM RAHMEN UNTERSCHEIDET: der Rahmen ist eine Ausschließlichkeits-Zusage und sperrt
// alles (auch das Anhaken) und baut den Gruppenschritt aus. Eine Eingrenzung ist keine Zusage,
// sondern eine Frage an den Server — gesperrt wird deshalb nur, was etwas ABSCHICKT.

/** Ein Filter-Chip der Landkarte (Themen/Autoren/Quellen) — echtes `button` mit `aria-pressed`. */
async function chipKlicken(label: string): Promise<void> {
  const chip = [...container.querySelectorAll("button[aria-pressed]")].find(
    (b) => (b.textContent ?? "").includes(label) && !verborgen(b),
  );
  if (!(chip instanceof HTMLButtonElement)) {
    throw new Error(`Filter-Chip „${label}" fehlt; Knöpfe: ${knopfTexte()}`);
  }
  await act(async () => {
    chip.click();
  });
  await act(flush);
}

/** Eines der drei Zahlenfelder der Eingrenzung (von/bis Jahr, Deckel) — sie tragen ihr Label. */
function zahlenFeld(labelTeil: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(labelTeil),
  );
  const feld = label?.querySelector("input");
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Feld „${labelTeil}" fehlt; sichtbar: ${sichtbarerText()}`);
  }
  return feld;
}

/** Der Freitext-Satz der Auswahl — für den Titelbefund-Fall. */
function satzEingeben(satz: string): void {
  const feld = [...container.querySelectorAll("input")].find(
    (el) => el.getAttribute("placeholder") === i18n.t("imp.select.promptPlaceholder"),
  );
  if (!(feld instanceof HTMLInputElement)) {
    throw new Error(`Freitext-Feld fehlt; sichtbar: ${sichtbarerText()}`);
  }
  setValue(feld, satz);
}

/**
 * Den Übernahme-Knopf DRÜCKEN, wenn es ihn gibt — und melden, ob es ihn gab. Betrachten genügt
 * nicht: ein ausgegrauter Knopf, der beim Klick trotzdem sendet, wäre genau der Befund.
 */
async function uebernahmeDruecken(): Promise<boolean> {
  const knopf = [...container.querySelectorAll("button")].find(
    (b) => (b.textContent ?? "").includes(i18n.t("imp.groups.applyCta", { n: 1 })) && !verborgen(b),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    return false;
  }
  await act(async () => {
    knopf.click();
  });
  await act(flush);
  return true;
}

describe("JOB 3772 · eine gewechselte Eingrenzung entwertet die alte Liste zum Absenden", () => {
  it("FENSTER VOR DEM NACHLADEN: im Chip-Fenster wird nichts abgeschickt, obwohl noch keine Anfrage lief", async () => {
    await ungerahmtGruppiert();
    const aufrufeVorher = selectMock.mock.calls.length;

    // Ab hier steht die Zeit still — das 350-ms-Fenster ist der Tatort und wird hier NICHT
    // durchlaufen, sondern angehalten. So hängt der Fall nicht an der Tagesform des Rechners.
    vi.useFakeTimers();
    await chipKlicken(THEMA);

    // DER KERN: es lief noch keine einzige neue Anfrage — und trotzdem gehört die Liste unten
    // bereits zur Eingrenzung von vorhin.
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher);

    // Und sie lässt sich nicht abschicken. Im Rotfall steht in der Meldung genau der Körper der
    // weggeklickten Eingrenzung — `criteria: {}` und `includeIds: ["basic1"]`.
    await uebernahmeDruecken();
    expect(applyMock.mock.calls).toEqual([]);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();
    expect(sichtbarerText()).toContain("gehören noch zur Eingrenzung davor");

    // Keine Sackgasse: das Nachladen löst die Sperre von selbst.
    await nachDemNachladen();
    expect(sichtbarerText()).toContain(SEITE_STAND.title);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
  });

  it("NETZWERKFEHLER: scheitert das Nachladen, bleibt die Liste lesbar — und unabsendbar", async () => {
    await ungerahmtGruppiert();

    selectMock.mockRejectedValue(new Error("Netz weg"));
    await chipKlicken(THEMA);
    await nachDemNachladen();

    // Der Übernahme-Knopf ist noch DA (ausgegraut, nicht ausgebaut) — und er schickt nichts.
    expect(await uebernahmeDruecken()).toBe(true);
    expect(applyMock.mock.calls).toEqual([]);

    // UND DER WEG AM AUSGRAUEN VORBEI: ein Klick-Ereignis, das nicht aus der Betätigung der
    // Schaltfläche stammt (Skript, Hilfsmittel, ein anderer Auslöser), umgeht `disabled` — dafür
    // ist der Riegel in der einfangenden Phase da. Ohne ihn käme genau hier die alte Übernahme
    // durch, obwohl der Knopf grau aussieht.
    const grauerKnopf = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes(i18n.t("imp.groups.applyCta", { n: 1 })),
    );
    expect(grauerKnopf?.closest("fieldset")?.disabled).toBe(true);
    await act(async () => {
      grauerKnopf?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await act(flush);
    expect(applyMock.mock.calls).toEqual([]);

    // Die Liste wird NICHT geleert (LEHREN §7) und sagt, wozu sie gehört und wie es weitergeht.
    expect(sichtbarerText()).toContain(SEITE_BASIC.title);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();
    expect(sichtbarerText()).toContain("„Vorschau aktualisieren“ versucht es erneut");
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).not.toBeNull();

    // Anders als beim Rahmen bleibt die Liste selbst bedienbar — gesperrt ist nur das Absenden.
    expect(zeilenHaken(SEITE_BASIC.title).closest("fieldset")?.disabled).toBe(false);
  });

  it("NACH DER AKTUALISIERUNG: die Übernahme trägt genau die Kriterien und IDs der NEUEN Antwort", async () => {
    await ungerahmtGruppiert();

    await chipKlicken(THEMA);
    await nachDemNachladen();

    // Die Vorschau gehört jetzt zur aktuellen Eingrenzung: die alte Seite ist fort, die Sperre auch.
    const text = sichtbarerText();
    expect(text).not.toContain(SEITE_BASIC.title);
    expect(text).toContain(SEITE_STAND.title);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();
    expect(letzterSelect().criteria).toEqual({ themes: [THEMA] });

    // Lieferung 5, GEMESSEN statt behauptet: der aufgebaute Gruppen-Zustand hat den Wechsel nicht
    // überlebt. Der React-Key (`preview.criteria` + gewählte IDs) hat den Schritt neu aufgesetzt —
    // es gibt deshalb gerade keinen Übernahme-Knopf, sondern wieder einen zum Gruppieren.
    expect(await uebernahmeDruecken()).toBe(false);

    await gruppieren();
    expect((groupMock.mock.calls.at(-1)?.[0] as { criteria: unknown }).criteria).toEqual({
      themes: [THEMA],
    });
    await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
    const uebernahme = applyMock.mock.calls[0]?.[0] as {
      criteria: Record<string, unknown>;
      includeIds: string[];
      selectedCandidateIds: string[];
    };
    expect(uebernahme.criteria).toEqual({ themes: [THEMA] });
    expect(uebernahme.includeIds).toEqual([SEITE_STAND.id]);
    expect(uebernahme.selectedCandidateIds).toEqual([SEITE_STAND.id]);
  });

  it("JAHRE: dasselbe Fenster öffnet sich beim Tippen in den Jahresfeldern", async () => {
    await ungerahmtGruppiert();
    const aufrufeVorher = selectMock.mock.calls.length;

    vi.useFakeTimers();
    setValue(zahlenFeld(i18n.t("imp.select.yearFrom")), "2024");
    await act(flush);
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher);
    await uebernahmeDruecken();
    expect(applyMock.mock.calls).toEqual([]);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();

    setValue(zahlenFeld(i18n.t("imp.select.yearTo")), "2026");
    await act(flush);
    await uebernahmeDruecken();
    expect(applyMock.mock.calls).toEqual([]);

    await nachDemNachladen();
    expect(letzterSelect().criteria).toEqual({ yearFrom: 2024, yearTo: 2026 });
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
  });

  it("DECKEL: dasselbe Fenster öffnet sich beim Ändern der Höchstzahl", async () => {
    await ungerahmtGruppiert();
    const aufrufeVorher = selectMock.mock.calls.length;

    vi.useFakeTimers();
    setValue(zahlenFeld(i18n.t("imp.select.limit")), "5");
    await act(flush);
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher);
    await uebernahmeDruecken();
    expect(applyMock.mock.calls).toEqual([]);
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).not.toBeNull();

    await nachDemNachladen();
    expect(letzterSelect().criteria).toEqual({ limit: 5 });
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
  });

  it("ANHAKEN BLEIBT: im gesperrten Fenster lässt sich weiter an- und abwählen", async () => {
    await ungerahmtGruppiert();

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();

    // Das ist die bewusste Grenze gegenüber dem Rahmen: die Liste ist keine Zusage, nur eine
    // Auskunft — man darf an ihr weiterarbeiten, man darf sie nur nicht abschicken.
    const haken = zeilenHaken(SEITE_BASIC.title);
    expect(haken.checked).toBe(true);
    expect(haken.closest("fieldset")?.disabled).toBe(false);
    await act(async () => {
      haken.click();
    });
    await act(flush);
    expect(zeilenHaken(SEITE_BASIC.title).checked).toBe(false);
    await act(async () => {
      zeilenHaken(SEITE_BASIC.title).click();
    });
    await act(flush);
    expect(zeilenHaken(SEITE_BASIC.title).checked).toBe(true);
    expect(applyMock.mock.calls).toEqual([]);
  });

  it("VERSPÄTETE ALTE ANTWORT: eine Antwort der alten Eingrenzung überschreibt die neue nicht", async () => {
    await ungerahmtGruppiert();

    // Eine Auffrischung der ALTEN Eingrenzung ist noch unterwegs, als der Chip gesetzt wird.
    const spaet = offen<typeof UNGERAHMT>();
    selectMock.mockImplementationOnce(async () => spaet.versprechen);
    await klicken(i18n.t("imp.select.previewAgain"));

    await chipKlicken(THEMA);
    await nachDemNachladen();
    expect(sichtbarerText()).toContain(SEITE_STAND.title);

    await act(async () => {
      spaet.aufloesen(UNGERAHMT);
      await flush();
    });
    await act(flush);

    const text = sichtbarerText();
    expect(text).not.toContain(SEITE_BASIC.title);
    expect(text).toContain(SEITE_STAND.title);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();

    await gruppieren();
    await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
    const uebernahme = applyMock.mock.calls[0]?.[0] as {
      criteria: Record<string, unknown>;
      includeIds: string[];
    };
    expect(uebernahme.criteria).toEqual({ themes: [THEMA] });
    expect(uebernahme.includeIds).toEqual([SEITE_STAND.id]);
  });

  it("KALIBRIERUNG: ohne jede Änderung der Eingrenzung übernimmt die Fläche wie bisher", async () => {
    // Der Gegenbeweis zur Dauer-Sperre: ein falsch gebauter Vergleich (Server-Kriterien gegen
    // Client-Kriterien) wäre schon hier ungleich, und die Fläche wäre für immer zu.
    await ungerahmtGruppiert();

    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();
    expect(await uebernahmeDruecken()).toBe(true);
    const uebernahme = applyMock.mock.calls[0]?.[0] as {
      criteria: Record<string, unknown>;
      includeIds: string[];
    };
    expect(uebernahme.criteria).toEqual({});
    expect(uebernahme.includeIds).toEqual([SEITE_BASIC.id]);
  });

  // ==============================================================================================
  // DER TITELBEFUND-KNOPF — die Stelle, an der ein falsch gebauter Schnappschuss sich selbst sperrt.
  // ==============================================================================================
  //
  // Dieser Knopf (JOB 3356) fordert die Vorschau mit GENAU den Server-Kriterien `{titleContains:
  // [satz]}` an — also mit etwas, das die Chips/Jahre/Deckel oben nicht abbilden. Vermerkte der
  // Schnappschuss dafür „gehört zu keiner Eingrenzung", wäre sein Ergebnis ab der ersten Sekunde
  // gesperrt und der Knopf tot. Er vermerkt deshalb den GERADE GÜLTIGEN Client-Schlüssel: nichts
  // wird nachgeladen, was das Ergebnis ablöste, also gehört es zur Gegenwart — bis der Mensch
  // wirklich etwas eingrenzt. Genau diese zwei Aussagen misst der Fall.
  it("TITELBEFUND: sein Ergebnis ist übernehmbar, und die nächste Eingrenzung sperrt es doch", async () => {
    const SATZ = "Wartung";
    const MIT_BEFUND = {
      matched: 0,
      limited: false,
      truncated: false,
      criteria: {},
      preview: [],
      inferenceStatus: "ok" as const,
      titleFallback: { query: SATZ, matched: 1, criteria: { titleContains: [SATZ] } },
    };
    await mount();
    await klicken(i18n.t("imp.explore.cta"));
    selectMock.mockResolvedValue(MIT_BEFUND);
    satzEingeben(SATZ);
    await klicken(i18n.t("imp.select.previewCta"));

    // Der Umschaltknopf holt seine eigene Kriterienmenge — und die Antwort darauf ist NICHT gesperrt.
    selectMock.mockResolvedValue({
      matched: 1,
      limited: false,
      truncated: false,
      criteria: { titleContains: [SATZ] },
      preview: [SEITE_BASIC],
    });
    await klicken(i18n.t("imp.select.titleFallbackCta", { count: 1 }));
    expect(sichtbarerText()).toContain(SEITE_BASIC.title);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();

    await gruppieren();
    await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
    expect((applyMock.mock.calls[0]?.[0] as { criteria: unknown }).criteria).toEqual({
      titleContains: [SATZ],
    });

    // Und sie ist keine Dauer-Freigabe: der nächste Chip sperrt sie wie jede andere alte Antwort.
    vi.useFakeTimers();
    await chipKlicken(THEMA);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();
  });

  it("EN und NL: die Sperre der Eingrenzung steht in allen drei Sprachen da", async () => {
    const FASSUNGEN = [
      {
        sprache: "en",
        liste: "still belong to the previous narrowing",
        gesperrt: "Grouping and importing become available again once the preview matches",
      },
      {
        sprache: "nl",
        liste: "horen nog bij de vorige afbakening",
        gesperrt: "Groeperen en overnemen zijn pas weer beschikbaar als het voorbeeld bij de",
      },
    ] as const;
    for (const fassung of FASSUNGEN) {
      await i18n.changeLanguage(fassung.sprache);
      try {
        await ungerahmtGruppiert();
        vi.useFakeTimers();
        await chipKlicken(THEMA);
        const text = sichtbarerText();
        expect(text).toContain(fassung.liste);
        expect(text).toContain(fassung.gesperrt);
        await uebernahmeDruecken();
        expect(applyMock.mock.calls).toEqual([]);
      } finally {
        vi.useRealTimers();
        await unmount();
        await i18n.changeLanguage("de");
      }
    }
  });
});

// ================================================================================================
// JOB 3799 · WER IM 350-MS-FENSTER ANHAKT, BEHÄLT SEINEN HAKEN.
// ================================================================================================
//
// DERSELBE TATORT, EIN SCHRITT WEITER — und deshalb dieselbe Datei: die Fälle oben haben das
// Fenster aufgemacht und ausdrücklich zugesagt, dass darin „anhaken und abwählen möglich" bleiben
// (`imp.eingrenzung.wechselLaeuft`, Fall „ANHAKEN BLEIBT"). Genau diese Zusage brach 350 ms später:
// `onSuccess` baute `checkedRows` bei JEDER erfolgreichen Antwort neu aus der Vorgabe. Eine
// Nachbardatei müsste Mounten, Klicken, Attrappe und Rührer verdoppeln.
//
// WAS DIESE FÄLLE MESSEN, und zwar am ABGESCHICKTEN KÖRPER (`applyMock`), nicht an der Anwesenheit
// eines Hakens im DOM: die Entscheidung des Menschen kommt beim Server an — oder sie kommt
// belegbar nicht an und die Fläche sagt es.
//
// EIGENE ATTRAPPE, EIN GRUND: die Fälle oben kennen nur Zeilen, die in der VORGABE ANGEHAKT sind.
// An ihnen sähe ein bewusst gesetzter Haken genauso aus wie der Rücksetzer — der Fall wäre blind.
// Unterscheidbar wird es erst an einer Zeile, die die Vorgabe ABWÄHLT (bereits importiert /
// vorgemerkt), und an einer Liste, die ihre REIHENFOLGE ändert.

interface Zeile {
  id: string;
  title: string;
  hasImage: boolean;
  themes: string[];
  alreadyImported?: boolean;
  alreadyQueued?: boolean;
}

/** Die Zeile, an der sich ein bewusstes Anhaken von der Vorgabe unterscheiden lässt. */
const SEITE_BEKANNT: Zeile = {
  id: "bekannt1",
  title: "[Basic] Wartungsplan aus dem Bestand",
  hasImage: false,
  themes: ["Basic"],
  alreadyImported: true,
};
const SEITE_ZWEIT: Zeile = {
  id: "zweit1",
  title: "[Basic] Prüfliste Linie 4",
  hasImage: false,
  themes: ["Basic"],
};
const SEITE_DRITT: Zeile = {
  id: "dritt1",
  title: "[Basic] Schichtübergabe Freitag",
  hasImage: false,
  themes: ["Basic"],
};
/** Einträge, die es in der Antwort davor NICHT gab — einer frisch, einer bereits vorgemerkt. */
const SEITE_FRISCH: Zeile = {
  id: "frisch1",
  title: "[Frisch] Erst in dieser Antwort",
  hasImage: false,
  themes: ["Frisch"],
};
const SEITE_FRISCH_VORGEMERKT: Zeile = {
  id: "frisch2",
  title: "[Frisch] Neu und schon vorgemerkt",
  hasImage: false,
  themes: ["Frisch"],
  alreadyQueued: true,
};

/**
 * Die Auswahl-Attrappe dieser Fälle: VOR der Eingrenzung die eine Liste, nach ihr die andere.
 * Der Rahmenweg (`titleContains`) liefert ABSICHTLICH dieselbe zweite Liste wie die Eingrenzung —
 * nur so misst der Rahmenfall wirklich den Rahmenwechsel und nicht bloss eine andere Liste.
 */
function antworten(vorher: readonly Zeile[], nachher: readonly Zeile[]): void {
  selectMock.mockImplementation(async (body: { criteria: Record<string, unknown> }) => {
    // Die Umfangsmessung des Rahmens (ImportExplore) — sie zählt nur und füllt keine Vorschau.
    if (body.criteria.limit === 1) {
      return { ...GERAHMT, preview: [] };
    }
    if (Array.isArray(body.criteria.titleContains) || eingegrenzt(body.criteria)) {
      return {
        matched: nachher.length,
        limited: false,
        truncated: false,
        criteria: body.criteria,
        preview: nachher,
      };
    }
    return {
      matched: vorher.length,
      limited: false,
      truncated: false,
      criteria: {},
      preview: vorher,
    };
  });
}

/** Der gemeinsame Ausgangspunkt: die Vorschau steht offen, ungerahmt, ohne Eingrenzung. */
async function vorschauOffen(vorher: readonly Zeile[], nachher: readonly Zeile[]): Promise<void> {
  await mount();
  await klicken(i18n.t("imp.explore.cta"));
  antworten(vorher, nachher);
  await klicken(i18n.t("imp.select.previewCta"));
  expect(sichtbarerText()).toContain(vorher[0]?.title ?? "");
}

/** Einen Zeilen-Haken umlegen — der Weg, den der Mensch geht. */
async function hakenKlicken(titelTeil: string): Promise<void> {
  await act(async () => {
    zeilenHaken(titelTeil).click();
  });
  await act(flush);
}

/**
 * Die Auswahl WIRKLICH abschicken und den gesendeten Körper lesen. Gemessen wird hier und nicht am
 * DOM: ein Haken, der gesetzt aussieht, aber nicht mitreist, wäre genau die Scheinfunktion.
 */
async function abgeschickteIds(): Promise<string[]> {
  await gruppieren();
  await klicken(i18n.t("imp.groups.applyCta", { n: 1 }));
  const koerper = applyMock.mock.calls.at(-1)?.[0] as { selectedCandidateIds: string[] };
  return koerper.selectedCandidateIds;
}

describe("JOB 3799 · der Haken, den die Fläche erlaubt, überlebt das Nachladen", () => {
  it("DER HAKEN IM FENSTER ÜBERLEBT: was im 350-ms-Fenster angehakt wird, reist mit", async () => {
    // Die neue Antwort trägt DIESELBEN Einträge in ANDERER Reihenfolge — die Zuordnung darf nur
    // über `entry.id` laufen.
    await vorschauOffen([SEITE_BEKANNT, SEITE_ZWEIT], [SEITE_ZWEIT, SEITE_BEKANNT]);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    // Das Fenster ist offen, die Anfrage läuft noch nicht — und die Fläche sagt zu, dass hier
    // angehakt werden darf.
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();
    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(false);
    await hakenKlicken(SEITE_BEKANNT.title);
    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(true);

    await nachDemNachladen();

    // Der Haken steht noch — und er steht nicht nur da, er wird abgeschickt.
    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(true);
    expect(await abgeschickteIds()).toEqual([SEITE_ZWEIT.id, SEITE_BEKANNT.id]);
    // Nichts ist weggefallen, also steht auch kein Satz darüber.
    expect(container.querySelector('[data-testid="haken-weggefallen"]')).toBeNull();
  });

  it("DIE ABWAHL ÜBERLEBT AUCH: eine weggenommene Wahl kommt nicht angehakt zurück", async () => {
    // Eine Abwahl ist dieselbe bewusste Entscheidung und wiegt schwerer: sie verhindert einen
    // Import, den der Mensch NICHT will.
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT], [SEITE_ZWEIT, SEITE_DRITT]);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    await hakenKlicken(SEITE_ZWEIT.title);
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(false);

    await nachDemNachladen();

    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(false);
    expect(await abgeschickteIds()).toEqual([SEITE_DRITT.id]);
  });

  it("NEUE TREFFER BEKOMMEN DIE VORGABE — und der Index überträgt nichts", async () => {
    // DIESER FALL IST DER ANKER GEGEN DIE VERWECHSLUNG: die neue Antwort ist länger UND anders
    // sortiert. Eine Übertragung über den Originalindex setzte hier Haken auf fremde Seiten
    // (bekannt1 stünde auf frisch1), eine Übertragung über `entry.id` trifft.
    await vorschauOffen(
      [SEITE_BEKANNT, SEITE_ZWEIT],
      [SEITE_FRISCH, SEITE_FRISCH_VORGEMERKT, SEITE_ZWEIT, SEITE_BEKANNT],
    );

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    await hakenKlicken(SEITE_BEKANNT.title); // bewusst an
    await hakenKlicken(SEITE_ZWEIT.title); // bewusst aus

    await nachDemNachladen();

    // Der frische Eintrag steht auf der Vorgabe (an), der frische VORGEMERKTE ebenfalls (aus) —
    // und die beiden bekannten tragen weiter die Entscheidung des Menschen.
    expect(zeilenHaken(SEITE_FRISCH.title).checked).toBe(true);
    expect(zeilenHaken(SEITE_FRISCH_VORGEMERKT.title).checked).toBe(false);
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(false);
    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(true);
    expect(await abgeschickteIds()).toEqual([SEITE_FRISCH.id, SEITE_BEKANNT.id]);
  });

  it("WAS WEGFÄLLT, WIRD GESAGT: mit Zahl, und nur für diesen einen Übergang", async () => {
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT], [SEITE_ZWEIT]);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    // Beide stehen auf der Vorgabe „an" — der Mensch hat also zwei Haken, einer davon fällt weg.
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    expect(zeilenHaken(SEITE_DRITT.title).checked).toBe(true);

    await nachDemNachladen();

    expect(container.querySelector('[data-testid="haken-weggefallen"]')).not.toBeNull();
    const text = sichtbarerText();
    expect(text).toContain("1 gesetzter Haken ist weggefallen");
    expect(text).toContain("gehört nicht mehr zur aktuellen Eingrenzung");
    // Die verbliebene Zeile ist weiter angehakt — der Satz spricht über HAKEN, nicht über Treffer.
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    expect(await abgeschickteIds()).toEqual([SEITE_ZWEIT.id]);

    // Und er beschreibt GENAU EINEN Übergang: die nächste Antwort ohne Wegfall löst ihn ab.
    await klicken(i18n.t("imp.select.previewAgain"));
    expect(container.querySelector('[data-testid="haken-weggefallen"]')).toBeNull();
  });

  it("RAHMENWECHSEL ÜBERTRÄGT NICHTS: dort war Anhaken nie erlaubt", async () => {
    // Die gerahmte Antwort trägt DIESELBEN Einträge — was hier gilt, entscheidet also allein der
    // Rahmenwechsel, nicht eine andere Liste.
    await vorschauOffen([SEITE_BEKANNT, SEITE_ZWEIT], [SEITE_BEKANNT, SEITE_ZWEIT]);

    await hakenKlicken(SEITE_BEKANNT.title); // an
    await hakenKlicken(SEITE_ZWEIT.title); // aus

    await rahmenSetzen(FIRMA);
    await nachDemNachladen();

    // Für ALLE Zeilen gilt wieder die Vorgabe — in beide Richtungen.
    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(false);
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    // Und es gibt nichts zu betrauern: kein Eintrag ist weggefallen, kein Satz steht da.
    expect(container.querySelector('[data-testid="haken-weggefallen"]')).toBeNull();
    expect(await abgeschickteIds()).toEqual([SEITE_ZWEIT.id]);
  });

  it("VERSPÄTETE ALTE ANTWORT ÜBERTRÄGT NICHTS: weder Auswahl noch Satz", async () => {
    await vorschauOffen([SEITE_BEKANNT, SEITE_ZWEIT], [SEITE_ZWEIT]);
    await hakenKlicken(SEITE_BEKANNT.title);

    // Eine Auffrischung der ALTEN Eingrenzung ist noch unterwegs, als der Chip gesetzt wird.
    const spaet = offen<Record<string, unknown>>();
    selectMock.mockImplementationOnce(async () => spaet.versprechen);
    await klicken(i18n.t("imp.select.previewAgain"));

    await chipKlicken(THEMA);
    await nachDemNachladen();
    expect(sichtbarerText()).toContain("1 gesetzter Haken ist weggefallen");

    // Jetzt kommt die überholte Antwort an — sie darf nichts davon anfassen.
    await act(async () => {
      spaet.aufloesen({
        matched: 2,
        limited: false,
        truncated: false,
        criteria: {},
        preview: [SEITE_BEKANNT, SEITE_ZWEIT],
      });
      await flush();
    });
    await act(flush);

    const text = sichtbarerText();
    expect(text).not.toContain(SEITE_BEKANNT.title);
    expect(text).toContain(SEITE_ZWEIT.title);
    expect(text).toContain("1 gesetzter Haken ist weggefallen");
    expect(await abgeschickteIds()).toEqual([SEITE_ZWEIT.id]);
  });

  it("HAKEN WÄHREND DER ANFRAGE: auch was nach dem Absenden angehakt wird, überlebt", async () => {
    // Das Fenster ist nicht mit dem Absenden zu Ende: bis die Antwort da ist, steht die alte Liste
    // weiter da und die Fläche erlaubt das Anhaken weiter. Ein Schnappschuss der Haken vom
    // ANFRAGESTART verlöre genau diese Klicks — dieser Fall hält das fest.
    await vorschauOffen([SEITE_BEKANNT, SEITE_ZWEIT], [SEITE_BEKANNT, SEITE_ZWEIT]);

    const unterwegs = offen<Record<string, unknown>>();
    selectMock.mockImplementationOnce(async () => unterwegs.versprechen);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    const aufrufeVorher = selectMock.mock.calls.length;
    await nachDemNachladen();
    // Die Anfrage ist RAUS und hängt — genau dort hakt der Mensch jetzt an.
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher + 1);
    await hakenKlicken(SEITE_BEKANNT.title);
    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(true);

    await act(async () => {
      unterwegs.aufloesen({
        matched: 2,
        limited: false,
        truncated: false,
        criteria: { themes: [THEMA] },
        preview: [SEITE_BEKANNT, SEITE_ZWEIT],
      });
      await flush();
    });
    await act(flush);

    expect(zeilenHaken(SEITE_BEKANNT.title).checked).toBe(true);
    expect(await abgeschickteIds()).toEqual([SEITE_BEKANNT.id, SEITE_ZWEIT.id]);
  });

  // ==============================================================================================
  // RUNDE 2 (BENS KORREKTURPFLICHT 1) · EIN GEMESSENER WEGFALL IST KEINE AUSSAGE FÜR IMMER.
  // ==============================================================================================
  //
  // BENS BEFUND, wörtlich: „Zwei Haken → Chip setzen → ein Haken fällt weg → Chip entfernen →
  // Nachladen scheitert. Trotzdem steht weiterhin ‚sein Eintrag gehört nicht mehr zur aktuellen
  // Eingrenzung‘. Diese Eingrenzung wurde gerade nicht erfolgreich geprüft."
  //
  // DIE ZAHL BLEIBT, DIE BEHAUPTUNG WIRD SCHWÄCHER — beides gehört zusammen: gemessen ist der
  // Wegfall (LEHREN §7: eine misslungene Auffrischung löscht keine erhobene Auskunft), aber er
  // wurde gegen die Eingrenzung gemessen, mit der die Liste darunter geholt wurde. Steht die nicht
  // mehr zur Gegenwart (`kriterienVeraltet`), hängt die starke Aussage an einer Voraussetzung, die
  // gerade fehlt — dann steht die schwächere da.
  it("ZWEITER WECHSEL, GESCHEITERTES NACHLADEN: der Wegfall-Satz behauptet nichts über die ungeprüfte Eingrenzung", async () => {
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT], [SEITE_ZWEIT]);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    await nachDemNachladen();
    // Hier ist die starke Aussage RICHTIG: sie wurde gegen genau die Eingrenzung gemessen, die
    // jetzt gilt.
    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toContain(
      "gehört nicht mehr zur aktuellen Eingrenzung",
    );

    // Jetzt nimmt der Mensch den Chip wieder weg — und das Nachladen scheitert.
    selectMock.mockRejectedValue(new Error("Netz weg"));
    await chipKlicken(THEMA);
    await nachDemNachladen();

    const satz = container.querySelector('[data-testid="haken-weggefallen"]');
    expect(satz).not.toBeNull();
    // Die erhobene Zahl steht weiter da …
    expect(satz?.textContent).toContain("1 gesetzter Haken ist weggefallen");
    // … aber nicht mehr als Auskunft über eine Eingrenzung, die niemand geholt hat.
    expect(satz?.textContent).not.toContain("gehört nicht mehr zur aktuellen Eingrenzung");
    expect(satz?.textContent).toContain("Zur jetzt eingestellten Eingrenzung sagt das nichts");

    // Auswahl und Sperren bleiben unangetastet — der Satz ändert nichts an der Lage.
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).not.toBeNull();
    await uebernahmeDruecken();
    expect(applyMock.mock.calls).toEqual([]);
  });

  it("ZWEITER WECHSEL, ANGEHALTENES NACHLADEN: derselbe Satz wartet — und die frische Antwort löst ihn ab", async () => {
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT], [SEITE_ZWEIT]);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    await nachDemNachladen();
    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toContain(
      "gehört nicht mehr zur aktuellen Eingrenzung",
    );

    // Der zweite Wechsel, und die Anfrage dazu ist noch nicht einmal losgelaufen (350-ms-Fenster,
    // die Zeit steht). Es gibt also nichts Gemessenes über die jetzt eingestellte Eingrenzung.
    const aufrufeVorher = selectMock.mock.calls.length;
    setValue(zahlenFeld(i18n.t("imp.select.yearFrom")), "2024");
    await act(flush);
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher);

    const satz = container.querySelector('[data-testid="haken-weggefallen"]');
    expect(satz?.textContent).not.toContain("gehört nicht mehr zur aktuellen Eingrenzung");
    expect(satz?.textContent).toContain("Zur jetzt eingestellten Eingrenzung sagt das nichts");

    // Keine Sackgasse: die frische Antwort misst neu. Sie bringt keinen Wegfall — der Satz ist fort.
    await nachDemNachladen();
    expect(letzterSelect().criteria).toEqual({ themes: [THEMA], yearFrom: 2024 });
    expect(container.querySelector('[data-testid="haken-weggefallen"]')).toBeNull();
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
  });

  // ==============================================================================================
  // JOB 3836 · MEHRERE WEGGEFALLENE HAKEN, WÄHREND EINE FOLGEANFRAGE WIRKLICH DRAUSSEN IST.
  // ==============================================================================================
  //
  // BESTELLT VOM PRÜFER im GRÜN-Urteil zu JOB 3799 Runde 2 (Prüfpunkt 6), wörtlich: „Die dauerhaften
  // neuen Tests prüfen Mehrzahl und tatsächlich ausstehende Folgeantwort NICHT ZUSAMMEN; meine
  // Zusatzprobe schliesst diese Messlücke FÜR DIESEN STAND. Testvorschlag: diese DE/EN/NL-Folge
  // DAUERHAFT neben Testzeile 1281 aufnehmen." Seine Zusatzprobe lief in ein Protokoll unter `/tmp`
  // und ist damit fort; im Repo stand von ihr nichts. Ab hier steht sie.
  //
  // KEIN PRODUKTVERHALTEN IST NEU, und deshalb steht hier auch kein Produktpfad im Auftrag. Neu ist
  // allein die dauerhafte MESSUNG: die Fälle darüber kennen „Nachladen gescheitert" (`:1248`) und
  // „Anfrage noch nicht losgelaufen" (`:1281`) — beide mit EINEM Haken. Ungemessen blieben der dritte
  // Nachladezustand „Anfrage raus und hängt" zusammen mit dem Wegfall-Satz und die MEHRZAHL in jedem
  // der drei Zustände. Die Mehrzahl ist der Alltagsfall: wer eingrenzt, verliert selten genau einen
  // Haken.
  //
  // WARUM DIE ZAHL UND DIE FASSUNG BEIDES GEMESSEN WERDEN: die Zahl sagt, WIE VIEL der Mensch
  // verloren hat; die Fassung (stark/schwach) sagt, ob diese Auskunft über die JETZT eingestellte
  // Eingrenzung überhaupt etwas behauptet. Die Fälle nageln deshalb den ganzen gezeichneten Satz
  // fest, nicht nur einen Halbsatz — fiele i18next bei einem fehlenden `_other`-Schlüssel auf die
  // Einzahl zurück, stünde dort „2 gesetzter Haken ist weggefallen", und genau das würde ein
  // Teilstück-Vergleich durchlassen.
  it("MEHRZAHL BEI HÄNGENDER FOLGEANFRAGE: zwei Haken weg — die Zahl bleibt, die starke Aussage fällt, die Übernahme ist gesperrt", async () => {
    // Drei Einträge, alle in der Vorgabe angehakt (keiner trägt `alreadyImported`/`alreadyQueued`);
    // die erste Eingrenzung bringt genau einen davon zurück → ZWEI Haken fallen weg.
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT, SEITE_FRISCH], [SEITE_ZWEIT]);

    vi.useFakeTimers();
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    expect(zeilenHaken(SEITE_DRITT.title).checked).toBe(true);
    expect(zeilenHaken(SEITE_FRISCH.title).checked).toBe(true);

    await chipKlicken(THEMA);
    await nachDemNachladen();

    // Hier ist die STARKE Fassung richtig: gemessen wurde gegen genau die Eingrenzung, die jetzt
    // gilt. Wörtlich und vollständig — das hält die Zahl UND die Beugung der Mehrzahl fest.
    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
      "2 gesetzte Haken sind weggefallen: ihre Einträge gehören nicht mehr zur aktuellen Eingrenzung. An der Trefferliste selbst fehlt nichts.",
    );

    // GRUPPIEREN, SOLANGE DIE ANTWORT PASST — das ist die Voraussetzung dafür, dass die Sperre
    // darunter überhaupt etwas messen kann: ohne aufgebauten Gruppen-Schritt gibt es keinen
    // Übernahme-Knopf, und „es wurde nichts abgeschickt" wäre auch bei fehlender Sperre wahr.
    await gruppieren();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();

    // Die zweite Eingrenzung — und diesmal läuft die Anfrage WIRKLICH los und hängt (Bauform
    // `:1207-1215`). Die Aufrufzahl ist der Unterschied zum Fall darüber, wo sie nicht einmal
    // losgelaufen war; ohne sie wären die beiden Zustände nicht unterscheidbar.
    const unterwegs = offen<Record<string, unknown>>();
    selectMock.mockImplementationOnce(async () => unterwegs.versprechen);
    const aufrufeVorher = selectMock.mock.calls.length;
    setValue(zahlenFeld(i18n.t("imp.select.yearFrom")), "2024");
    await act(flush);
    await nachDemNachladen();
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher + 1);
    expect(letzterSelect().criteria).toEqual({ themes: [THEMA], yearFrom: 2024 });

    // DIE ERHOBENE ZAHL BLEIBT (LEHREN §7), DIE BEHAUPTUNG WIRD SCHWÄCHER — in der Mehrzahl.
    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
      "2 gesetzte Haken sind weggefallen: ihre Einträge gehörten nicht mehr zu der Eingrenzung, mit der die Liste darunter geholt wurde. Zur jetzt eingestellten Eingrenzung sagt das nichts — deren Vorschau steht noch aus.",
    );

    // DIE GESPERRTE ÜBERNAHME IM SELBEN ZUSTAND: die Auswahl bleibt unangetastet, der Riegel steht,
    // und der Knopf ist DA (ausgegraut, nicht ausgebaut) — er schickt trotzdem nichts.
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).not.toBeNull();
    expect(await uebernahmeDruecken()).toBe(true);
    expect(applyMock.mock.calls).toEqual([]);

    // KEINE SACKGASSE: die hängende Antwort kommt an. Sie bringt den überlebenden Eintrag mit,
    // verliert also keinen Haken — nach der Regel des Produkts (`ImportSelect.tsx:690`) ist der
    // Befund damit ABGELÖST und der Kasten fort. Welcher der beiden möglichen Ausgänge gilt, hängt
    // allein daran, ob die frische Antwort selbst einen Wegfall bringt; der andere Ausgang (neuer
    // Wegfall → wieder die STARKE Fassung mit der neuen Zahl) steht im Fall darunter.
    await act(async () => {
      unterwegs.aufloesen({
        matched: 2,
        limited: false,
        truncated: false,
        criteria: { themes: [THEMA], yearFrom: 2024 },
        preview: [SEITE_ZWEIT, SEITE_FRISCH],
      });
      await flush();
    });
    await act(flush);

    expect(container.querySelector('[data-testid="haken-weggefallen"]')).toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();
    expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
    // Der wieder aufgetauchte Eintrag ist für die Fläche ein NEUER Treffer — er bekommt die Vorgabe,
    // nicht seinen alten Haken zurück: übertragen wird nur aus der ANGEZEIGTEN Antwort.
    expect(zeilenHaken(SEITE_FRISCH.title).checked).toBe(true);
    // Und die Freigabe ist keine Behauptung am DOM: der freigegebene Weg schickt WIRKLICH ab.
    expect(await abgeschickteIds()).toEqual([SEITE_ZWEIT.id, SEITE_FRISCH.id]);
  });

  it("MEHRZAHL WIRD ABGELÖST: die frische Antwort ersetzt den alten Befund durch ihren eigenen — wieder stark", async () => {
    // Der zweite mögliche Ausgang, ebenfalls gemessen statt angenommen. Die Zahl läuft dabei von 1
    // auf 2: eine Anzeige, die den alten Befund stehen liesse oder die beiden addierte, fiele hier.
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT, SEITE_FRISCH], [SEITE_ZWEIT, SEITE_DRITT]);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    await nachDemNachladen();
    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toContain(
      "1 gesetzter Haken ist weggefallen",
    );

    const unterwegs = offen<Record<string, unknown>>();
    selectMock.mockImplementationOnce(async () => unterwegs.versprechen);
    const aufrufeVorher = selectMock.mock.calls.length;
    setValue(zahlenFeld(i18n.t("imp.select.yearFrom")), "2024");
    await act(flush);
    await nachDemNachladen();
    expect(selectMock.mock.calls.length).toBe(aufrufeVorher + 1);

    // Die hängende Antwort bringt KEINEN der beiden verbliebenen Haken zurück — zwei fallen weg.
    await act(async () => {
      unterwegs.aufloesen({
        matched: 1,
        limited: false,
        truncated: false,
        criteria: { themes: [THEMA], yearFrom: 2024 },
        preview: [SEITE_FRISCH],
      });
      await flush();
    });
    await act(flush);

    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
      "2 gesetzte Haken sind weggefallen: ihre Einträge gehören nicht mehr zur aktuellen Eingrenzung. An der Trefferliste selbst fehlt nichts.",
    );
    // An der Trefferliste selbst fehlt nichts: der frische Eintrag steht da und trägt die Vorgabe.
    expect(zeilenHaken(SEITE_FRISCH.title).checked).toBe(true);
    expect(await abgeschickteIds()).toEqual([SEITE_FRISCH.id]);
  });

  it("ERFOLGREICH LEERE ANTWORT: sie nennt ALLE verlorenen Haken — und behauptet es stark", async () => {
    // Der zweite Teil der eigenen Messung des Prüfers (sein GRÜN-Urteil, „sowie erfolgreiche leere
    // Antwort"). Genannt wird die VOLLSTÄNDIGE Zahl, drei von drei, nicht eine Teilzahl. Und weil
    // diese Antwort gegen die geltende Eingrenzung erfolgreich gemessen wurde, ist die STARKE
    // Fassung hier die richtige: „gehört nicht mehr zur aktuellen Eingrenzung" ist wahr.
    await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT, SEITE_FRISCH], []);

    vi.useFakeTimers();
    await chipKlicken(THEMA);
    await nachDemNachladen();

    expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
      "3 gesetzte Haken sind weggefallen: ihre Einträge gehören nicht mehr zur aktuellen Eingrenzung. An der Trefferliste selbst fehlt nichts.",
    );
    // Die Antwort war erfolgreich und gehört zur Gegenwart — kein Wechsel-Satz, keine Sperre.
    expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
    expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();
    expect(letzterSelect().criteria).toEqual({ themes: [THEMA] });
    // Und die Liste ist wirklich leer — sonst wäre der Wegfall keine drei Haken wert.
    const text = sichtbarerText();
    expect(text).not.toContain(SEITE_ZWEIT.title);
    expect(text).not.toContain(SEITE_DRITT.title);
    expect(text).not.toContain(SEITE_FRISCH.title);
  });

  it("EN und NL: auch die schwächere Fassung steht in allen drei Sprachen da", async () => {
    const FASSUNGEN = [
      {
        sprache: "en",
        stark: "its entry no longer belongs to the current narrowing",
        schwach: "says nothing about the narrowing set now",
      },
      {
        sprache: "nl",
        stark: "hoort niet meer bij de huidige afbakening",
        schwach: "Over de nu ingestelde afbakening zegt dat niets",
      },
    ] as const;
    for (const fassung of FASSUNGEN) {
      await i18n.changeLanguage(fassung.sprache);
      try {
        await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT], [SEITE_ZWEIT]);
        vi.useFakeTimers();
        await chipKlicken(THEMA);
        await nachDemNachladen();
        expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toContain(
          fassung.stark,
        );

        selectMock.mockRejectedValue(new Error("network gone"));
        await chipKlicken(THEMA);
        await nachDemNachladen();
        const satz = container.querySelector('[data-testid="haken-weggefallen"]');
        expect(satz).not.toBeNull();
        expect(satz?.textContent).not.toContain(fassung.stark);
        expect(satz?.textContent).toContain(fassung.schwach);
      } finally {
        vi.useRealTimers();
        await unmount();
        await i18n.changeLanguage("de");
      }
    }
  });

  it("EN und NL: der Wegfall-Satz steht in allen drei Sprachen da", async () => {
    const FASSUNGEN = [
      { sprache: "en", satz: "1 tick you had set has fallen away" },
      { sprache: "nl", satz: "1 gezet vinkje is vervallen" },
    ] as const;
    for (const fassung of FASSUNGEN) {
      await i18n.changeLanguage(fassung.sprache);
      try {
        await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT], [SEITE_ZWEIT]);
        vi.useFakeTimers();
        await chipKlicken(THEMA);
        await nachDemNachladen();
        expect(container.querySelector('[data-testid="haken-weggefallen"]')).not.toBeNull();
        expect(sichtbarerText()).toContain(fassung.satz);
      } finally {
        vi.useRealTimers();
        await unmount();
        await i18n.changeLanguage("de");
      }
    }
  });

  // ==============================================================================================
  // JOB 3933 · DIE SPRACHFOLGE ENDETE VOR DER BEDIENUNG — AB HIER NICHT MEHR.
  // ==============================================================================================
  //
  // BESTELLT VOM PRÜFER im GRÜN-Urteil zu JOB 3836 Runde 1 (Prüfpunkt 6), wörtlich: „EN/NL enden
  // nach Hinweis- und Hakenprüfung (`:1582`); Übernahmeklick und anschließende Freigabe werden in
  // dieser neuen Folge nur auf Deutsch geprüft. Ergänzungsvorschlag: dieselben Bedienprüfungen samt
  // Antwortauflösung in die Sprachschleife aufnehmen." (`archiv/3836/runde-1/ben.md:34`)
  //
  // WAS JE SPRACHE BISHER GEMESSEN WURDE: die ANZEIGE — welcher Satz mit welcher Zahl und in welcher
  // Fassung dasteht (`:1476`, `:1515`) — und, eine Beschreibung weiter oben, der Sperr-TEXT samt
  // einem folgenlosen Übernahmeklick (`:906`). Ungemessen blieb in EN/NL alles, was DANACH kommt:
  // der aufgebaute Gruppenschritt, der Riegel als eigener Befund (`eingrenzung-gruppen-gesperrt`),
  // der Unterschied „grauer Knopf" gegen „gar kein Knopf", die Auflösung der hängenden Antwort, das
  // Fortfallen von Satz, Wechsel und Sperre — und der WIRKLICH gesendete Körper.
  //
  // WAS AB JETZT GEMESSEN WIRD, ist genau das und nichts darüber hinaus: die vier Fälle darunter
  // führen diese Kette je Sprache aus, für BEIDE möglichen Ausgänge der hängenden Antwort (frische
  // Antwort ohne eigenen Wegfall → Befund abgelöst; frische Antwort mit eigenem Wegfall → wieder
  // die starke Fassung mit der neuen Zahl). Ungemessen bleiben weiterhin Browser, echtes HTTP,
  // Persistenz und Offline sowie die erfolgreich LEERE Antwort in EN/NL — die deckt `:1451` nur auf
  // Deutsch ab.
  //
  // JE SPRACHE EIN EIGENER FALL (`it.each`) STATT EINER SCHLEIFE IN EINEM FALL: eine Schleife bricht
  // beim ersten Fehler ab und liesse die zweite Sprache ungemessen — eine Verstellung, die nur EN
  // trifft, dürfte NL nicht verdecken (Lehre JOB 3889 R1/R2). So nennt schon der Fallname die
  // betroffene Sprache. Die Bauform des Rumpfes bleibt die bisherige: `changeLanguage`, dann
  // `try/finally` mit `useRealTimers`, `unmount` und Rücksetzen auf `de`.
  //
  // GEMESSEN WIRD DER GANZE GEZEICHNETE SATZ (`toBe`, nie `toContain` auf einen Halbsatz): fiele
  // i18next bei einem fehlenden `_other`-Schlüssel auf die Einzahl zurück, liesse ein Teilstück-
  // Vergleich das durch — die Begründung steht ausführlich bei `:1326`.
  const SPRACHFASSUNGEN: {
    sprache: string;
    starkEins: string;
    stark: string;
    schwach: string;
  }[] = [
    {
      sprache: "en",
      starkEins:
        "1 tick you had set has fallen away: its entry no longer belongs to the current narrowing. Nothing is missing from the hit list itself.",
      stark:
        "2 ticks you had set have fallen away: their entries no longer belong to the current narrowing. Nothing is missing from the hit list itself.",
      schwach:
        "2 ticks you had set have fallen away: their entries no longer belonged to the narrowing the list below was fetched with. That says nothing about the narrowing set now — its preview is still outstanding.",
    },
    {
      sprache: "nl",
      starkEins:
        "1 gezet vinkje is vervallen: de bijbehorende pagina hoort niet meer bij de huidige afbakening. Aan de trefferlijst zelf ontbreekt niets.",
      stark:
        "2 gezette vinkjes zijn vervallen: de bijbehorende pagina's horen niet meer bij de huidige afbakening. Aan de trefferlijst zelf ontbreekt niets.",
      schwach:
        "2 gezette vinkjes zijn vervallen: de bijbehorende pagina's hoorden niet meer bij de afbakening waarmee de lijst hieronder is opgehaald. Over de nu ingestelde afbakening zegt dat niets — het voorbeeld daarvoor ontbreekt nog.",
    },
  ];

  it.each(SPRACHFASSUNGEN)(
    "$sprache · MEHRZAHL BEI HÄNGENDER FOLGEANFRAGE: die Zahl bleibt, die starke Aussage fällt, die Übernahme ist gesperrt — und nach der Antwort schickt sie wirklich ab",
    async (fassung) => {
      await i18n.changeLanguage(fassung.sprache);
      try {
        await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT, SEITE_FRISCH], [SEITE_ZWEIT]);
        vi.useFakeTimers();
        await chipKlicken(THEMA);
        await nachDemNachladen();
        // Die starke Wendung VOR dem zweiten Wechsel, mit der Zahl 2 und richtig gebeugt.
        expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
          fassung.stark,
        );

        // GRUPPIEREN, SOLANGE DIE ANTWORT PASST — dieselbe Voraussetzung wie im deutschen Fall
        // (`:1351`): ohne aufgebauten Gruppen-Schritt gibt es keinen Übernahme-Knopf, und „es wurde
        // nichts abgeschickt" wäre auch bei FEHLENDER Sperre wahr. Der Riegel steht hier noch nicht.
        await gruppieren();
        expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();

        // Der zweite Wechsel, dessen Anfrage wirklich losläuft und hängt.
        const unterwegs = offen<Record<string, unknown>>();
        selectMock.mockImplementationOnce(async () => unterwegs.versprechen);
        const aufrufeVorher = selectMock.mock.calls.length;
        setValue(zahlenFeld(i18n.t("imp.select.yearFrom")), "2024");
        await act(flush);
        await nachDemNachladen();
        expect(selectMock.mock.calls.length).toBe(aufrufeVorher + 1);

        const satz = container.querySelector('[data-testid="haken-weggefallen"]');
        expect(satz).not.toBeNull();
        expect(satz?.textContent).not.toContain(fassung.stark);
        expect(satz?.textContent).toBe(fassung.schwach);
        // Auch hier bleibt die Auswahl bedienbar und das Absenden gesperrt.
        expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
        expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).not.toBeNull();

        // JOB 3933 · DIE SPERRE IST KEINE DEUTSCHE BESONDERHEIT. Der Riegel steht als eigener
        // Befund, und der Knopf ist DA — ausgegraut, nicht ausgebaut. Der Rückgabewert `true` ist
        // der Unterschied, den eine blosse Leerprobe auf `applyMock` durchgehen liesse: ohne ihn
        // wäre „nichts abgeschickt" auch bei einem ganz fehlenden Knopf wahr.
        expect(
          container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]'),
        ).not.toBeNull();
        expect(await uebernahmeDruecken()).toBe(true);
        expect(applyMock.mock.calls).toEqual([]);

        // KEINE SACKGASSE: die hängende Antwort kommt an. Sie bringt den überlebenden Eintrag mit,
        // verliert also keinen Haken — nach der Regel des Produkts (`ImportSelect.tsx:690`) ist der
        // Befund damit ABGELÖST und der Kasten fort.
        await act(async () => {
          unterwegs.aufloesen({
            matched: 2,
            limited: false,
            truncated: false,
            criteria: { themes: [THEMA], yearFrom: 2024 },
            preview: [SEITE_ZWEIT, SEITE_FRISCH],
          });
          await flush();
        });
        await act(flush);

        expect(container.querySelector('[data-testid="haken-weggefallen"]')).toBeNull();
        expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
        expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();
        expect(zeilenHaken(SEITE_ZWEIT.title).checked).toBe(true);
        // Der wieder aufgetauchte Eintrag ist für die Fläche ein NEUER Treffer — er bekommt die
        // Vorgabe, nicht seinen alten Haken zurück.
        expect(zeilenHaken(SEITE_FRISCH.title).checked).toBe(true);
        // Und die Freigabe ist keine Behauptung am DOM: der freigegebene Weg schickt WIRKLICH ab.
        expect(await abgeschickteIds()).toEqual([SEITE_ZWEIT.id, SEITE_FRISCH.id]);
      } finally {
        vi.useRealTimers();
        await unmount();
        await i18n.changeLanguage("de");
      }
    },
  );

  it.each(SPRACHFASSUNGEN)(
    "$sprache · MEHRZAHL WIRD ABGELÖST: die frische Antwort bringt ihren eigenen Wegfall — wieder stark, und das Absenden geht wieder",
    async (fassung) => {
      // Der ZWEITE mögliche Ausgang derselben hängenden Antwort, ebenfalls gemessen statt
      // angenommen. Die Zahl läuft dabei von 1 auf 2: eine Anzeige, die den alten Befund stehen
      // liesse oder die beiden addierte, fiele hier — je Sprache.
      await i18n.changeLanguage(fassung.sprache);
      try {
        await vorschauOffen([SEITE_ZWEIT, SEITE_DRITT, SEITE_FRISCH], [SEITE_ZWEIT, SEITE_DRITT]);
        vi.useFakeTimers();
        await chipKlicken(THEMA);
        await nachDemNachladen();
        // Einer weg, und stark behauptet — der ganze Satz, damit die EINZAHL-Beugung mit festhängt.
        expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
          fassung.starkEins,
        );

        await gruppieren();
        expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();

        const unterwegs = offen<Record<string, unknown>>();
        selectMock.mockImplementationOnce(async () => unterwegs.versprechen);
        const aufrufeVorher = selectMock.mock.calls.length;
        setValue(zahlenFeld(i18n.t("imp.select.yearFrom")), "2024");
        await act(flush);
        await nachDemNachladen();
        expect(selectMock.mock.calls.length).toBe(aufrufeVorher + 1);

        // Gesperrt und folgenlos, auch auf diesem Ast — sonst hinge die Sperre am Ausgang.
        expect(
          container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]'),
        ).not.toBeNull();
        expect(await uebernahmeDruecken()).toBe(true);
        expect(applyMock.mock.calls).toEqual([]);

        // Die hängende Antwort bringt KEINEN der beiden verbliebenen Haken zurück — zwei fallen weg.
        await act(async () => {
          unterwegs.aufloesen({
            matched: 1,
            limited: false,
            truncated: false,
            criteria: { themes: [THEMA], yearFrom: 2024 },
            preview: [SEITE_FRISCH],
          });
          await flush();
        });
        await act(flush);

        expect(container.querySelector('[data-testid="haken-weggefallen"]')?.textContent).toBe(
          fassung.stark,
        );
        expect(container.querySelector('[data-testid="eingrenzung-gewechselt"]')).toBeNull();
        expect(container.querySelector('[data-testid="eingrenzung-gruppen-gesperrt"]')).toBeNull();
        // An der Trefferliste selbst fehlt nichts: der frische Eintrag steht da und trägt die Vorgabe.
        expect(zeilenHaken(SEITE_FRISCH.title).checked).toBe(true);
        expect(await abgeschickteIds()).toEqual([SEITE_FRISCH.id]);
      } finally {
        vi.useRealTimers();
        await unmount();
        await i18n.changeLanguage("de");
      }
    },
  );
});
