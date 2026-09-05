// @vitest-environment jsdom
// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 1 (Sicherheit) · `R-13` — DER ORT ÜBERLEBT KEINEN RECHTEENTZUG.
// ==================================================================================================
//
// DER FALL: Gespeicherte Sichten liegen im `localStorage` des Browsers (`lib/libraryFacets.ts:303`,
// Schlüssel `klarwerk.library.views.<nutzer>`). Der Server sieht sie nie und kann sie nicht
// nachtrimmen. Geriete ein Ort — eine Kennung, ein Name, ein Pfad — je in eine gespeicherte Sicht,
// dann überlebte er dort einen späteren Rechteentzug: der Betrachter dürfte den Raum längst nicht
// mehr sehen, und seine eigene Sicht nennt ihn ihm weiter. Das ist genau die Metadatenspur, die
// REF-0001 `:49` verbietet, nur mit einer Haltbarkeit von Monaten.
//
// DIESER TEST IST EIN BEWAHRUNGSANKER — er ist HEUTE GRÜN und muss es bleiben. Er fährt den ECHTEN,
// gemounteten Seam (`applyView` / `currentViewState` / `saveLibraryView`), nicht ein Nachbau: eine
// Kopie im Testrahmen bewiese über die Seite nichts.
//
// Der Ort wird dabei über den EINZIGEN Weg angeboten, den er heute hätte — den URL-Parameter `raum`
// aus PLAN PRO 378 §4.2. Heute ignoriert die Bibliothek ihn vollständig; nach der Umsetzungswelle
// wird er sie steuern. In BEIDEN Zuständen muss dieselbe Zusicherung gelten, und genau deshalb
// steht sie schon jetzt hier: sie ist die Zeile, die rot wird, wenn die spätere Welle den Ort
// bequemerweise in `currentViewState()` mitnimmt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { ORT_URL_PARAM } from "./support/wissensraum-ort-vertrag";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

// Zwei Beiträge, die sich in der Kategorie unterscheiden — damit ein Filter über die Adresse
// wirklich greift und „Diese Suche merken“ überhaupt erscheint (`anyFilterActive`).
const KO_A = ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1" });
const KO_B = ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2" });
const KOS = [KO_A, KO_B];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
    // JOB 3068 (N5): die Lesefläche fragt das eigene Signal jetzt selbst — leer heißt „kein Befund".
    useEigeneBefunde: () => ok([]),
    // JOB 3063 (H4): die Fläche zeigt rechts den gewählten Eintrag. Diese Tests messen die LISTE;
    // die Lesefläche bleibt deshalb bewusst im Ladezustand — sie ist dann eine leere Fläche ohne
    // Text und mischt sich in keine Zusicherung ein.
    useKo: () => ({ data: undefined, isLoading: true, isError: false, error: null }),
    useAudit: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Library } from "../../apps/web/src/pages/Library";
import { menueOeffnen } from "./support/bib-flaeche";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const VIEWS_KEY = "klarwerk.library.views.u1";
/** Die Ortskennung, die in dieser Prüfung nirgends ankommen darf. */
const GEHEIME_RAUM_ID = "raum-nicht-mehr-sichtbar";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(entry: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [entry] }, createElement(Library)),
      ),
    );
  });
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

/** Eine kontrollierte React-Eingabe treiben (Repo-Muster: nativer Setter umgeht den Value-Tracker). */
function typeInto(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function buttonMitText(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Schaltfläche „${text}“ fehlt; DOM: ${container.textContent}`);
  }
  return btn;
}

/**
 * Sammelt ALLE Zeichenketten aus einem beliebig tief verschachtelten Zustand — Schlüssel wie Werte.
 * Bewusst rekursiv und nicht „Object.keys der obersten Ebene“: ein Ort, der in `facetSel.raum` oder
 * in einem Wertfeld läge, wäre genauso ein Leck wie einer auf der obersten Ebene.
 */
function alleZeichenketten(wert: unknown, aus: string[] = []): string[] {
  if (typeof wert === "string") {
    aus.push(wert);
  } else if (Array.isArray(wert)) {
    for (const eintrag of wert) {
      alleZeichenketten(eintrag, aus);
    }
  } else if (wert !== null && typeof wert === "object") {
    for (const [schluessel, unterwert] of Object.entries(wert)) {
      aus.push(schluessel);
      alleZeichenketten(unterwert, aus);
    }
  }
  return aus;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

describe("PRO 381 · R-13 — der Ort taucht in keiner gemerkten Sicht auf", () => {
  it("R-13 (a) BEWAHRUNGSANKER: eine gespeicherte Sicht trägt weder `raum` noch Ortsnamen", () => {
    // Der Ort steht in der Adresse — der einzige Weg, auf dem er die Seite heute erreichen könnte.
    mount(
      `/bibliothek?category=${encodeURIComponent("Anlage 1")}` +
        `&${ORT_URL_PARAM}=${encodeURIComponent(GEHEIME_RAUM_ID)}`,
    );

    // Der Kategoriefilter greift — sonst erschiene „Diese Suche merken“ gar nicht und der Test
    // prüfte eine Fläche, die es im Moment der Messung nicht gibt.
    expect(container.textContent).toContain("Alpha Ventil");
    expect(container.textContent).not.toContain("Beta Pumpe");

    // JOB 3063 (H4): das Namensfeld und der Knopf „Diese Suche merken" liegen im Menü „…" der
    // Liste, Untermenü „Sicht speichern" (AUFTRAG 3063 §5a). Die Zusage — was in den Speicher
    // wandert — ist davon unberührt; nur der Weg dorthin führt jetzt über das Menü.
    menueOeffnen(container, "bib-liste-menue");
    const nameFeld = container.querySelector("#bib-sichtname");
    if (!(nameFeld instanceof HTMLInputElement)) {
      throw new Error(`Feld für den Sichtnamen fehlt; DOM: ${container.textContent}`);
    }
    typeInto(nameFeld, "Meine Sicht");
    act(() => {
      buttonMitText(res("lib.views.remember")).click();
    });

    const roh = window.localStorage.getItem(VIEWS_KEY);
    expect(
      roh,
      "die Sicht wurde gar nicht gespeichert — der Test misst sonst nichts",
    ).not.toBeNull();
    const gespeichert: unknown = JSON.parse(roh ?? "[]");
    expect(Array.isArray(gespeichert)).toBe(true);

    const texte = alleZeichenketten(gespeichert);
    // Weder die Kennung noch der Parametername selbst dürfen im Speicher liegen.
    expect(texte).not.toContain(GEHEIME_RAUM_ID);
    expect(texte).not.toContain(ORT_URL_PARAM);
    for (const text of texte) {
      expect(text, `gespeicherte Sicht trägt „${text}“`).not.toContain(GEHEIME_RAUM_ID);
    }
  });

  it("R-13 (b) BEWAHRUNGSANKER: `currentViewState()` hat GENAU vier Felder — der Ort ist keines davon", () => {
    // Gepinnt gegen `Library.tsx:393-398`. Diese Zeile ist die eigentliche Schranke: sie wird rot,
    // sobald irgendjemand dem Sicht-Zustand ein fünftes Feld hinzufügt — gleich unter welchem Namen.
    // Ein späterer Auftrag, der den Zustand bewusst erweitert, muss sie ausdrücklich mitändern.
    mount(`/bibliothek?category=${encodeURIComponent("Anlage 1")}`);
    // JOB 3063 (H4): das Namensfeld und der Knopf „Diese Suche merken" liegen im Menü „…" der
    // Liste, Untermenü „Sicht speichern" (AUFTRAG 3063 §5a). Die Zusage — was in den Speicher
    // wandert — ist davon unberührt; nur der Weg dorthin führt jetzt über das Menü.
    menueOeffnen(container, "bib-liste-menue");
    const nameFeld = container.querySelector("#bib-sichtname");
    if (!(nameFeld instanceof HTMLInputElement)) {
      throw new Error(`Feld für den Sichtnamen fehlt; DOM: ${container.textContent}`);
    }
    typeInto(nameFeld, "Nur vier Felder");
    act(() => {
      buttonMitText(res("lib.views.remember")).click();
    });

    const gespeichert = JSON.parse(window.localStorage.getItem(VIEWS_KEY) ?? "[]") as Array<{
      state?: Record<string, unknown>;
    }>;
    expect(gespeichert).toHaveLength(1);
    expect(Object.keys(gespeichert[0]?.state ?? {}).sort()).toEqual([
      "facetSel",
      "groupBy",
      "q",
      "range",
    ]);
  });

  it("R-13 (c) BEWAHRUNGSANKER: eine ALTSICHT mit eingeschleustem `raum` bleibt wirkungslos", () => {
    // Die Gegenrichtung von (a): nicht „kommt der Ort hinein“, sondern „wirkt er, wenn er drin ist“.
    // Eine Sicht kann aus einer fremden Quelle stammen (ein geteiltes Profil, ein Fremdformat, eine
    // spätere Welle, die zurückgebaut wurde). Sie darf die Treffermenge nicht heimlich verengen —
    // dieselbe Regel, die `facetRangeFromSaved` (`facetRail.ts:317`) für den Bereichsfilter trägt:
    // ein neu hinzugekommener Filter verkleinert eine Altsicht niemals nachträglich.
    window.localStorage.setItem(
      VIEWS_KEY,
      JSON.stringify([
        { name: "Fremdsicht", state: { [ORT_URL_PARAM]: GEHEIME_RAUM_ID, home: GEHEIME_RAUM_ID } },
      ]),
    );
    mount("/bibliothek");
    // JOB 3063 (H4): gemerkte Sichten stehen im Menü „…" der Liste, Untermenü „Sichten".
    menueOeffnen(container, "bib-liste-menue");
    act(() => {
      buttonMitText("Fremdsicht").click();
    });

    // Beide Beiträge bleiben sichtbar: „kein Raum“ heisst „gesamtes Unternehmen“, nie „leerer Raum“.
    expect(container.textContent).toContain("Alpha Ventil");
    expect(container.textContent).toContain("Beta Pumpe");
    // Und die Kennung erscheint nirgends auf der Fläche.
    expect(container.textContent ?? "").not.toContain(GEHEIME_RAUM_ID);
  });
});
