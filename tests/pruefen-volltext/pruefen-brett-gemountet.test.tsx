// @vitest-environment jsdom
// ================================================================================================
// JOB 3290 · C — DERSELBE BEFUND AN DER ECHTEN FLÄCHE, UND DIE BESCHRIFTUNG, DIE IHN VERSCHWEIGT.
// ================================================================================================
//
// `filter-inhalt.test.ts` misst die reine Filterregel. Dieser Prüfstand misst, was Codex vor sich
// hatte: die gemountete Prüfen-Seite, das Filter-Menü aufgeklappt, die Marke ins Feld getippt — und
// danach die Frage, welche Zeilen die Liste noch führt. Ohne diesen zweiten Weg wäre die Aussage
// halb: eine reine Funktion sagt nichts darüber, ob die Seite sie ruft, ob die Board-Antwort den
// `bodyHtml` bis hierher trägt und ob das Feld im Menü an dieselbe Filterzeile gebunden ist.
//
// DIE ZWEITE HÄLFTE DER PFLICHTLIEFERUNG 1 wird hier eingelöst, und zwar VOLLSTÄNDIG: „ist der
// Umfang bewusst enger, sagt die Beschriftung das (DE/EN)". Bis zu diesem Auftrag stand im Feld
// „Volltext filtern …" — eine Auskunft, die mehr behauptet als der Zustand hergibt, denn der
// ausführliche Inhalt wird nicht durchsucht. Wer die Marke tippte, bekam 0 Treffer und konnte
// nicht unterscheiden, ob sie fehlt oder ob das Feld sie nur nicht liest. Genau das ist Codex
// passiert. Die Beschriftung nennt jetzt ihre Grenze.
//
// UND SIE IST AN DAS VERHALTEN GEBUNDEN, nicht an eine Meinung: C4 unten misst ZUERST, ob der
// Filter den Inhalt findet, und leitet daraus ab, was die Beschriftung sagen MUSS. Wird die
// Filterregel eines Tages erweitert, verlangt derselbe Fall automatisch die Rückkehr zu „Volltext"
// — die Beschriftung kann der Fähigkeit weder vor- noch nachlaufen.
//
// WAS GEMESSEN WIRD:
//   C0  VORAUSSETZUNG: die Seite mountet, beide Zeilen sind da, das Menü öffnet, das Tippen kommt
//       an und schneidet die Liste. Ohne diesen Block wäre C1 unten ein Messartefakt.
//   C1  Marke in der Kernaussage → die Zeile bleibt, die andere fällt weg.
//   C2  ANTI-VAKUUM: eine Marke, die es nicht gibt, lässt keine Zeile übrig.
//   C3  DER BEFUND als Tatsache: Marke NUR im Inhalt → keine Zeile.
//   C4  Die Beschriftung sagt die Wahrheit über ihren Umfang — DE, EN und NL.
//   S1  SOLLVERTRAG (`it.fails`): Marke NUR im Inhalt → die Zeile bleibt stehen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";

/** Der Bestand, den der gemockte Board-Abruf ausgibt. */
const lage = vi.hoisted(() => ({ kos: [] as unknown[] }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useValidationBoard: () => ok(lage.kos),
    useDirectory: () => ok([]),
    useReasonerStatus: () => ok({ active: false, mode: "deterministic" }),
    useConflicts: () => ok([]),
    useDuplicates: () => ok([]),
    useLifecyclePending: () => ok([]),
  };
});

vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => undefined }),
}));
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));

// Die Web-Abhängigkeiten liegen unter `apps/web/node_modules` — von `tests/` aus wird der Pfad
// ausgeschrieben, wie in allen übrigen gemounteten Prüfständen dieses Baumes.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
// Der Import richtet die i18n-Instanz ein — ohne ihn stünde überall der SCHLÜSSEL.
import i18n from "../../apps/web/src/i18n";
import {
  EMPTY_VALIDATION_FILTER,
  matchesValidationFilter,
} from "../../apps/web/src/lib/validationFilters";
import { Validation } from "../../apps/web/src/pages/Validation";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MARKE = "ENDE-REV26-065813";

function text(sprache: string, key: string): string {
  return String(i18n.getResource(sprache, "translation", key));
}

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Zu prüfendes Wissen",
    statement: "Eine Aussage ohne Marke.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-08T00:00:00.000Z",
    history: [],
    confidentiality: "intern",
    confidentialityProvenance: "ko",
    ...overrides,
  } as unknown as KnowledgeObject;
}

/** Die Zeile mit der Marke im INHALT — genau Codex' Fall. */
const mitMarkeImInhalt = ko({
  id: "ko-inhalt",
  title: "Absperrarmatur prüfen",
  bodyHtml: `<p>Erster Absatz.</p><p>Letzter Absatz mit ${MARKE} am Ende.</p>`,
});
/** Die Nachbarzeile ohne jede Marke — sie muss wegfallen, sonst misst der Filter nichts. */
const ohneMarke = ko({ id: "ko-ohne", title: "Ganz anderes Wissen" });

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(bestand: KnowledgeObject[]): void {
  lage.kos = bestand;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: ["/validierung"] },
          createElement(Validation),
        ),
      ),
    );
  });
}

/** Das Filter-Menü aufklappen (geschlossen liegt sein Inhalt bewusst NICHT im DOM). */
function oeffneFilter(): void {
  const ausloeser = container.querySelector<HTMLButtonElement>(
    '[data-testid="pruefen-menue-filter"]',
  );
  if (!ausloeser) {
    throw new Error("Kein Filter-Menü auf der gemounteten Prüfen-Seite.");
  }
  act(() => {
    ausloeser.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

/** Das Volltextfeld im aufgeklappten Menü — erkannt an seinem echten Platzhalter. */
function suchfeld(): HTMLInputElement {
  const platzhalter = text("de", "val.filter");
  const feld = [...container.querySelectorAll("input")].find(
    (i) => i.placeholder === platzhalter,
  ) as HTMLInputElement | undefined;
  if (!feld) {
    throw new Error(`Kein Feld mit dem Platzhalter „${platzhalter}" im Filter-Menü.`);
  }
  return feld;
}

/** Tippen wie ein Mensch: den Wert setzen und React das echte input-Ereignis geben. */
function tippe(wert: string): void {
  const feld = suchfeld();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")
    ?.set as (v: string) => void;
  act(() => {
    setter.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Welche der beiden Zeilen führt die Liste noch? Gemessen am sichtbaren Titel. */
function sichtbareTitel(): string[] {
  const inhalt = container.textContent ?? "";
  return [mitMarkeImInhalt.title, ohneMarke.title].filter((titel) => inhalt.includes(titel));
}

beforeEach(() => {
  lage.kos = [];
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ------------------------------------------------------------------------------------------------
// C — WAS HEUTE GILT, samt der Voraussetzung, ohne die S1 nichts messen würde.
// ------------------------------------------------------------------------------------------------
describe("JOB 3290 C · die gemountete Prüfen-Seite und ihr Filterfeld", () => {
  it("C0 · VORAUSSETZUNG: beide Zeilen stehen da, das Menü öffnet, das Tippen schneidet die Liste", () => {
    mount([mitMarkeImInhalt, ohneMarke]);
    expect(sichtbareTitel()).toEqual([mitMarkeImInhalt.title, ohneMarke.title]);
    oeffneFilter();
    expect(suchfeld().value).toBe("");
    tippe("Absperrarmatur");
    expect(suchfeld().value).toBe("Absperrarmatur");
    expect(sichtbareTitel()).toEqual([mitMarkeImInhalt.title]);
  });

  it("C1 · die Marke in der Kernaussage trifft", () => {
    const inAussage = ko({
      id: "ko-aussage",
      title: "Absperrarmatur prüfen",
      statement: `Eine Aussage mit ${MARKE}.`,
    });
    mount([inAussage, ohneMarke]);
    oeffneFilter();
    tippe(MARKE);
    expect(sichtbareTitel()).toEqual([inAussage.title]);
  });

  it("C2 · ANTI-VAKUUM: eine Marke, die nirgends steht, lässt keine Zeile übrig", () => {
    mount([mitMarkeImInhalt, ohneMarke]);
    oeffneFilter();
    tippe("ENDE-REV26-000000");
    expect(sichtbareTitel()).toEqual([]);
  });

  it("C3 · DER BEFUND als Tatsache: die Marke NUR im Inhalt lässt keine Zeile übrig", () => {
    mount([mitMarkeImInhalt, ohneMarke]);
    oeffneFilter();
    tippe(MARKE);
    expect(sichtbareTitel()).toEqual([]);
  });

  it("C4 · die Beschriftung sagt die Wahrheit über ihren Umfang — DE, EN und NL", () => {
    // ZUERST MESSEN, DANN FORDERN. Die Erwartung an den Text wird aus dem tatsächlichen Verhalten
    // des Filters abgeleitet, nicht aus einer Annahme über den Stand des Produkts. Damit kann die
    // Beschriftung der Fähigkeit weder vorlaufen (heutiger Fehler) noch nachlaufen (der Fehler, den
    // eine spätere Erweiterung ohne diesen Fall machen würde).
    const findetInhalt = matchesValidationFilter(
      mitMarkeImInhalt,
      { ...EMPTY_VALIDATION_FILTER, search: MARKE },
      "u1",
    );
    const grenze: Record<string, RegExp> = {
      de: /ohne ausführlichen Inhalt/i,
      en: /without detailed content/i,
      nl: /zonder uitgebreide inhoud/i,
    };
    const volltext = /volltext|full text|volledige tekst/i;
    for (const sprache of ["de", "en", "nl"]) {
      const beschriftung = text(sprache, "val.filter");
      if (findetInhalt) {
        // Der Filter kann es → die Beschriftung DARF und SOLL „Volltext" sagen, und sie darf die
        // Einschränkung nicht mehr behaupten.
        expect(beschriftung, `${sprache}: darf jetzt Volltext heissen`).toMatch(volltext);
        expect(beschriftung, `${sprache}: nennt eine Grenze, die es nicht mehr gibt`).not.toMatch(
          grenze[sprache] as RegExp,
        );
      } else {
        // Der Filter kann es NICHT → die Beschriftung muss die Grenze nennen und darf „Volltext"
        // nicht versprechen.
        expect(beschriftung, `${sprache}: nennt die Grenze nicht`).toMatch(
          grenze[sprache] as RegExp,
        );
        expect(beschriftung, `${sprache}: verspricht Volltext, kann ihn aber nicht`).not.toMatch(
          volltext,
        );
      }
    }
  });
});

// ------------------------------------------------------------------------------------------------
// S — DER SOLLVERTRAG an der Fläche. Heute kausal rot, nach der Behebung grün.
// ------------------------------------------------------------------------------------------------
describe("JOB 3290 C/S · SOLLVERTRAG: die Fläche findet die Marke im ausführlichen Inhalt", () => {
  it.fails("S1 · die Marke steht NUR im Inhalt — die Zeile bleibt, die andere fällt weg", () => {
    // Voraussetzungen ausserhalb dieses Fehlschlags: C0 (Mount, Menü, Tippen, Schnitt) und C1
    // (dieselbe Marke trifft, sobald sie in der Aussage steht).
    mount([mitMarkeImInhalt, ohneMarke]);
    oeffneFilter();
    tippe(MARKE);
    expect(sichtbareTitel()).toEqual([mitMarkeImInhalt.title]);
  });
});
