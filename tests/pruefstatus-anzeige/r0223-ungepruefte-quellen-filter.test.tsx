// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0223, Ben R2 BEN-06) · DIE UNGEPRÜFTEN TREFFER LASSEN SICH HERAUSZIEHEN.
// ================================================================================================
//
// Zielzustand: „Wissen, das noch niemand geprüft hat, erscheint in Klaras Antwort nicht als
// gesichert, sondern wird als ungeprüft gekennzeichnet. Aus dem bloßen Zähler wurde dabei ein
// Filter: Die ungeprüften Treffer lassen sich gezielt herausziehen."
//
// Gemischte Antwort (zwei validierte, zwei ungeprüfte, eine unbekannte Quelle) an der echten
// `QuellenListe` — dem Baustein, den die Fragen-Seite und das Tutorial zeigen. Geprüft werden
// Herausziehen, Rückkehr zur vollständigen Liste und dass „ungeprüft" dieselbe Menge ist, die der
// Zähler zählt (`answerSourceSummary`).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { QuellenListe, type QuellenZeile } from "../../apps/web/src/components/fragen/QuellenListe";
import "../../apps/web/src/i18n";
import { answerSourceSummary } from "../../apps/web/src/lib/askAnswerContract";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function zeile(id: string, validated: boolean | null): QuellenZeile {
  return {
    id,
    label: `Quelle ${id}`,
    carrying: true,
    verwendung: "verwendet",
    pruefstand: validated === null ? null : validated ? "validiert" : "offen",
    validated,
    pruefstandWort: validated ? "Validiert" : "Offen",
    pruefstandHinweis: "",
    usability: validated ? "ready" : "needs-work",
    checkState: "proven",
    conflictLimited: false,
    demo: false,
  };
}

const GEMISCHT = [
  zeile("v1", true),
  zeile("u1", false),
  zeile("v2", true),
  zeile("u2", false),
  zeile("x1", null),
];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function zeige(quellen: readonly QuellenZeile[]): void {
  act(() => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(QuellenListe, {
          quellen,
          zuordnungTragfaehig: true,
          wissenHref: (id: string) => `/wissen/${id}`,
          bildfundstelle: () => false,
          koVon: () => undefined,
          autorVon: (a: string) => a,
          standBestaetigt: true,
          dank: null,
        }),
      ),
    );
  });
}

function montiere(quellen: readonly QuellenZeile[]): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  zeige(quellen);
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const knopf = (id: string) => marke(id) as HTMLButtonElement;
const gezeigteTitel = () =>
  [...container.querySelectorAll('[data-testid="ask-quellen-liste"] > li')].map((li) =>
    (li.querySelector("a")?.textContent ?? "").trim(),
  );

function klick(element: HTMLElement): void {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

describe("R-0223 · Filter „Nur ungeprüfte“ in der Quellenliste der Antwort", () => {
  it("zieht genau die ungeprüften Treffer heraus und kehrt zur ganzen Liste zurück", () => {
    montiere(GEMISCHT);
    expect(gezeigteTitel()).toEqual([
      "Quelle v1",
      "Quelle u1",
      "Quelle v2",
      "Quelle u2",
      "Quelle x1",
    ]);
    expect(knopf("ask-quellen-filter-alle").getAttribute("aria-pressed")).toBe("true");
    expect(knopf("ask-quellen-filter-ungeprueft").textContent).toBe("Nur ungeprüfte (2)");
    expect(knopf("ask-quellen-filter-alle").textContent).toBe("Alle (5)");

    klick(knopf("ask-quellen-filter-ungeprueft"));
    expect(gezeigteTitel()).toEqual(["Quelle u1", "Quelle u2"]);
    expect(knopf("ask-quellen-filter-ungeprueft").getAttribute("aria-pressed")).toBe("true");
    expect(marke("ask-quellen-filter-hinweis")?.textContent).toContain("2 von 5");

    klick(knopf("ask-quellen-filter-alle"));
    expect(gezeigteTitel()).toHaveLength(5);
    expect(marke("ask-quellen-filter-hinweis")).toBeNull();
  });

  it("„ungeprüft“ ist dieselbe Menge, die der Zähler „offen/ungeprüft“ zählt", () => {
    montiere(GEMISCHT);
    const zaehler = answerSourceSummary(
      GEMISCHT.map((q) => ({
        id: q.id,
        known: q.validated !== null,
        validated: q.validated,
        usability: q.usability,
        conflictLimited: q.conflictLimited,
      })) as unknown as Parameters<typeof answerSourceSummary>[0],
    );
    klick(knopf("ask-quellen-filter-ungeprueft"));
    expect(gezeigteTitel()).toHaveLength(zaehler.open);
  });

  it("unbekannte Quellen (null) zählen nicht als ungeprüft — über sie wird nichts behauptet", () => {
    montiere([zeile("v1", true), zeile("x1", null)]);
    expect(marke("ask-quellen-filter")).toBeNull();
    expect(gezeigteTitel()).toHaveLength(2);
  });

  it("ohne ungeprüfte Quelle kein Filter; fällt die letzte weg, gilt wieder die ganze Liste", () => {
    montiere(GEMISCHT);
    klick(knopf("ask-quellen-filter-ungeprueft"));
    expect(gezeigteTitel()).toHaveLength(2);
    // Neue Antwort ohne ungeprüfte Quelle: kein leerer gefilterter Rest, kein Filter.
    zeige([zeile("v1", true), zeile("v2", true)]);
    expect(marke("ask-quellen-filter")).toBeNull();
    expect(gezeigteTitel()).toEqual(["Quelle v1", "Quelle v2"]);
  });
});
