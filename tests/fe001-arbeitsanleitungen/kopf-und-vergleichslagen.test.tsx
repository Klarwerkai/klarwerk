// @vitest-environment jsdom
// ================================================================================================
// FE-001 RUNDE 2 · BENS BEFUNDE E3, E9 UND E7 — JE EIN FALL, AN DER GEZEICHNETEN FLÄCHE.
// ================================================================================================
//
//   E3 · „Gespeichert" gilt nur für den GESENDETEN Stand. Wer während einer laufenden Speicherung
//        weitertippt, behält „noch nicht gespeichert" und einen bedienbaren Speicherknopf.
//   E9 · Jede Beschriftung zeigt auf GENAU das Feld, das sie benennt (wirksame Zuordnung, nicht nur
//        „es gibt ein label[for]"), und keine Kennung steht zweimal im Dokument.
//   E7 · Fehlen die Stände, steht „wird geladen" NUR bei laufendem Abruf; offline und „liegt nicht
//        vor" sind eigene Sätze mit nächstem Schritt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { KopfBearbeitung } from "../../apps/web/src/components/gesamtanweisung/KopfBearbeitung";
import {
  VergleichAnsicht,
  vergleichsauswahl,
} from "../../apps/web/src/components/gesamtanweisung/VergleichAnsicht";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KOPF = { titel: "Start im Homeoffice", zweck: "", geltungsbereich: "", voraussetzungen: "" };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

function tippe(element: HTMLTextAreaElement | HTMLInputElement, wert: string): void {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(element, wert);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const zweck = () => container.querySelector("#ga-kopf-zweck") as HTMLTextAreaElement;
const knopf = () => marke("ga-kopf-speichern") as HTMLButtonElement;

describe("E3 · nur der bestätigte Eingabestand gilt als gespeichert", () => {
  it("Weitertippen während der Speicherung bleibt ungespeichert und speicherbar", async () => {
    const gesendet: string[] = [];
    let bestaetige: (ok: boolean) => void = () => undefined;
    const meldungen: boolean[] = [];
    await act(async () => {
      root.render(
        createElement(KopfBearbeitung, {
          kopf: KOPF,
          gesperrt: false,
          grund: null,
          fehler: null,
          meldeUngespeichert: (b: boolean) => meldungen.push(b),
          speichern: (k) => {
            gesendet.push(k.zweck);
            return new Promise<boolean>((fertig) => {
              bestaetige = fertig;
            });
          },
        }),
      );
    });

    await act(async () => {
      tippe(zweck(), "Gesendeter Zweck");
    });
    await act(async () => {
      zweck()
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    // Während die Speicherung unterwegs ist, wird weitergetippt.
    await act(async () => {
      tippe(zweck(), "Noch nicht gesendeter Zweck");
    });
    await act(async () => {
      bestaetige(true);
    });

    expect(gesendet).toEqual(["Gesendeter Zweck"]);
    expect(zweck().value).toBe("Noch nicht gesendeter Zweck");
    expect(marke("ga-kopf-gespeichert"), "„Gespeichert“ über ungesendetem Text").toBeNull();
    expect(marke("ga-kopf-ungespeichert")).not.toBeNull();
    expect(knopf().disabled, "der spätere Stand muss speicherbar bleiben").toBe(false);
    expect(meldungen.at(-1), "die Seite muss vom ungespeicherten Stand erfahren").toBe(true);

    // Gegenprobe: ohne Weitertippen gilt der gesendete Stand als gespeichert.
    await act(async () => {
      zweck()
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      bestaetige(true);
    });
    expect(gesendet).toEqual(["Gesendeter Zweck", "Noch nicht gesendeter Zweck"]);
    expect(marke("ga-kopf-gespeichert")).not.toBeNull();
    expect(marke("ga-kopf-ungespeichert")).toBeNull();
    expect(meldungen.at(-1)).toBe(false);
  });

  it("eine gescheiterte Speicherung behauptet nichts und lässt den Text stehen", async () => {
    await act(async () => {
      root.render(
        createElement(KopfBearbeitung, {
          kopf: KOPF,
          gesperrt: false,
          grund: null,
          fehler: null,
          speichern: async () => false,
        }),
      );
    });
    await act(async () => {
      tippe(zweck(), "Bleibt stehen");
    });
    await act(async () => {
      zweck()
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(zweck().value).toBe("Bleibt stehen");
    expect(marke("ga-kopf-gespeichert")).toBeNull();
    expect(marke("ga-kopf-ungespeichert")).not.toBeNull();
  });
});

describe("E9 · jede Beschriftung benennt wirksam genau ihr Feld", () => {
  it("keine doppelte Kennung; label.control ist das benannte Feld", async () => {
    await act(async () => {
      root.render(
        createElement(KopfBearbeitung, {
          kopf: KOPF,
          gesperrt: false,
          grund: null,
          fehler: null,
          speichern: async () => true,
        }),
      );
    });
    const ids = [...container.querySelectorAll("[id]")].map((e) => e.id);
    expect(
      ids.filter((id, i) => ids.indexOf(id) !== i),
      "doppelte Kennungen",
    ).toEqual([]);
    for (const feld of container.querySelectorAll("input, textarea")) {
      const label = container.querySelector<HTMLLabelElement>(`label[for="${feld.id}"]`);
      expect(label, feld.id).not.toBeNull();
      expect(label?.control, `${feld.id}: die Beschriftung zeigt auf ein anderes Element`).toBe(
        feld,
      );
    }
    // Die Überschrift benennt die Karte, nicht das Titelfeld.
    const karte = marke("ga-kopf");
    const ueberschrift = document.getElementById(karte?.getAttribute("aria-labelledby") ?? "");
    expect(ueberschrift?.tagName).toBe("H2");
  });
});

describe("E7 · fehlende Stände: „wird geladen“ nur bei laufendem Abruf", () => {
  const basis = { von: null, bis: null, staendeFehler: false } as const;

  it("die Lage wird aus Abruf, Verbindung und Fehler bestimmt", () => {
    expect(vergleichsauswahl({ ...basis, staende: undefined, staendeLaeuft: true })).toBe(
      "staendeLaden",
    );
    expect(
      vergleichsauswahl({ ...basis, staende: undefined, staendeLaeuft: false, offline: true }),
    ).toBe("staendeOffline");
    expect(vergleichsauswahl({ ...basis, staende: undefined, staendeLaeuft: false })).toBe(
      "staendeFehler",
    );
    expect(
      vergleichsauswahl({ ...basis, staende: undefined, staendeFehler: true, offline: true }),
    ).toBe("staendeFehler");
    expect(vergleichsauswahl({ ...basis, staende: [1] })).toBe("zuWenige");
    expect(vergleichsauswahl({ ...basis, staende: [1, 2], von: 2, bis: 2 })).toBe("waehlen");
    expect(vergleichsauswahl({ ...basis, staende: [1, 2], von: 1, bis: 2 })).toBe("bereit");
  });

  it("offline ohne Stände: Offline-Satz, kein Ladehinweis", () => {
    const markup = renderToStaticMarkup(
      createElement(VergleichAnsicht, {
        lage: { art: "fehler", offline: true },
        vergleich: undefined,
        staende: [],
        von: null,
        bis: null,
        waehleVon: () => undefined,
        waehleBis: () => undefined,
        auswahl: "staendeOffline",
        abrufLaeuft: false,
      }),
    );
    expect(markup).toContain("ga-vergleich-staende-offline");
    expect(markup).toContain("Keine Verbindung");
    expect(markup).not.toContain("geladen …");
    expect(markup).not.toContain("Lädt");
  });

  it("nicht vorliegend: Satz mit nächstem Schritt und Knopf zum erneuten Laden", () => {
    const markup = renderToStaticMarkup(
      createElement(VergleichAnsicht, {
        lage: { art: "laden" },
        vergleich: undefined,
        staende: [],
        von: null,
        bis: null,
        waehleVon: () => undefined,
        waehleBis: () => undefined,
        auswahl: "staendeFehler",
        abrufLaeuft: false,
        staendeNeuLaden: () => undefined,
      }),
    );
    expect(markup).toContain("ga-vergleich-staende-fehler");
    expect(markup).toContain("Erneut laden");
    expect(markup).not.toContain("Lädt");
  });
});
