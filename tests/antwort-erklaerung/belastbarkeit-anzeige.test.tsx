// @vitest-environment jsdom
// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-ERKLÄRUNG — DIE KONSOLE ZEIGT, WAS DER SERVER ENTSCHIEDEN HAT.
// ================================================================================================
//
// Die echte Komponente `Belastbarkeit` (components/fragen/Belastbarkeit.tsx), gemountet mit einer
// Serverauskunft in der Gestalt von `services/ask/src/answer-belastbarkeit.ts`. Gemessen wird, dass
// die Fläche die Lage, die Begründung, den Vertrauenswert samt Herleitung, Stand und Verantwortung
// und bei einem Widerspruch BEIDE Seiten zeigt — und dass sie nichts dazuerfindet (R-0260: keine
// Prozentangabe). Dazu der Prüfrahmen einer Wissenslücke (R-0284).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { AntwortBelastbarkeit } from "../../apps/web/src/api/types";
import { Belastbarkeit, PruefrahmenSatz } from "../../apps/web/src/components/fragen/Belastbarkeit";
import "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MIT_KONFLIKT: AntwortBelastbarkeit = {
  lage: "belegt_mit_konflikt",
  gruende: ["alle_tragenden_quellen_validiert", "offener_konflikt", "zustaendig_nicht_erreichbar"],
  vertrauenswert: {
    wert: 76,
    herleitung: "minimum_tragender_quellen",
    schwaechsteQuelle: "b",
  },
  quellenAnzahl: { herangezogen: 3, tragend: 2 },
  quellen: [
    {
      koId: "a",
      titel: "Ventil V4 jährlich prüfen",
      version: 3,
      vertrauenswert: 91,
      stand: "2026-03-05T10:00:00.000Z",
      validiert: true,
      pruefstand: "proven",
      entscheidungFestgehalten: true,
      verantwortung: {
        art: "owner",
        person: { id: "u-karl", name: "Karl Muster" },
        erreichbar: true,
      },
    },
    {
      koId: "b",
      titel: "Prüfintervall Druckbehälter",
      version: 1,
      vertrauenswert: 76,
      stand: "2025-11-20T08:00:00.000Z",
      validiert: true,
      pruefstand: "proven",
      entscheidungFestgehalten: false,
      verantwortung: {
        art: "author-fallback",
        person: { id: "u-weg", name: null },
        erreichbar: false,
      },
    },
  ],
  konflikte: [
    {
      konfliktId: "c1",
      beschreibung: "Intervall jährlich gegen halbjährlich",
      seiten: [
        {
          einsehbar: true,
          koId: "a",
          titel: "Ventil V4 jährlich prüfen",
          aussage: "Ventil V4 wird jährlich geprüft.",
          version: 3,
          vertrauenswert: 91,
          validiert: true,
          traegtAntwort: true,
        },
        {
          einsehbar: true,
          koId: "z",
          titel: "Ventil V4 halbjährlich",
          aussage: "Ventil V4 wird halbjährlich geprüft.",
          version: 1,
          vertrauenswert: 40,
          validiert: false,
          traegtAntwort: false,
        },
      ],
    },
  ],
  hinweis: "vertrauen_ist_kein_wahrheitsversprechen",
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function montiere(element: ReturnType<typeof createElement>): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(element);
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

const marke = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string) => [...container.querySelectorAll(`[data-testid="${id}"]`)];

describe("Antwort-Erklärung · Belastbarkeit in der Konsole", () => {
  it("zeigt Lage, Begründung, Herleitung des Vertrauenswerts und den Hinweis", () => {
    montiere(createElement(Belastbarkeit, { b: MIT_KONFLIKT }));
    expect(marke("ask-belastbarkeit")?.getAttribute("data-lage")).toBe("belegt_mit_konflikt");
    expect(marke("ask-belastbarkeit-lage")?.textContent).toBe("Belegt — mit Widerspruch");
    const wert = marke("ask-belastbarkeit-vertrauenswert")?.textContent ?? "";
    expect(wert).toContain("76");
    expect(wert).toContain("Prüfintervall Druckbehälter");
    expect(wert).toContain("Bibliothek");
    const gruende = marke("ask-belastbarkeit-gruende")?.textContent ?? "";
    expect(gruende).toContain("offenen Widerspruch");
    expect(gruende).toContain("nicht erreichbar");
    expect(container.textContent).toContain("2 von 3 herangezogenen Quellen");
    expect(container.textContent).toContain("keine Aussage darüber, ob etwas wahr ist");
  });

  it("je tragender Quelle: Stand, Verantwortung und Erreichbarkeit", () => {
    montiere(createElement(Belastbarkeit, { b: MIT_KONFLIKT }));
    const zeilen = alle("ask-belastbarkeit-quelle").map((z) => z.textContent ?? "");
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toContain("Stand 05.03.2026");
    expect(zeilen[0]).toContain("Verantwortlich: Karl Muster");
    expect(zeilen[0]).toContain("erreichbar");
    const verantwortung = alle("ask-belastbarkeit-verantwortung").map((z) => z.textContent ?? "");
    expect(verantwortung[1]).toContain("es gilt der Autor");
    expect(verantwortung[1]).toContain("u-weg");
    expect(verantwortung[1]).toContain("nicht erreichbar");
  });

  it("R-0321: beide Seiten des Widerspruchs mit Aussage, keine gewählt", () => {
    montiere(createElement(Belastbarkeit, { b: MIT_KONFLIKT }));
    const seiten = alle("ask-belastbarkeit-konfliktseite").map((s) => s.textContent ?? "");
    expect(seiten).toHaveLength(2);
    expect(seiten[0]).toContain("Ventil V4 wird jährlich geprüft.");
    expect(seiten[0]).toContain("trägt diese Antwort");
    expect(seiten[1]).toContain("Ventil V4 wird halbjährlich geprüft.");
    expect(seiten[1]).not.toContain("trägt diese Antwort");
    const konflikt = marke("ask-belastbarkeit-konflikt")?.textContent ?? "";
    expect(konflikt).toContain("Es wird keine Seite gewählt");
    // R-0260: kein Wahrheitsgrad, keine Prozentzahl.
    expect(container.textContent).not.toMatch(/%/);
  });

  it("eine nicht einsehbare Seite wird genannt, nicht verschwiegen", () => {
    const verborgen: AntwortBelastbarkeit = {
      ...MIT_KONFLIKT,
      konflikte: [
        {
          konfliktId: "c2",
          beschreibung: null,
          seiten: [
            MIT_KONFLIKT.konflikte[0]?.seiten[0] ?? { einsehbar: false, traegtAntwort: true },
            { einsehbar: false, traegtAntwort: false },
          ],
        },
      ],
    };
    montiere(createElement(Belastbarkeit, { b: verborgen }));
    const seiten = alle("ask-belastbarkeit-konfliktseite").map((s) => s.textContent ?? "");
    expect(seiten).toHaveLength(2);
    expect(seiten[1]).toContain("nicht einsehbar");
  });

  it("R-0284: der Prüfrahmen einer Wissenslücke statt einer nackten Null", () => {
    montiere(
      createElement(PruefrahmenSatz, {
        rahmen: { umfang: "validiert", verglichen: 0, hoechstens: 8, nurWoertlich: true },
      }),
    );
    const satz = marke("ask-pruefrahmen")?.textContent ?? "";
    expect(satz).toContain("nur validiertes, nicht vertrauliches Wissen");
    expect(satz).toContain("0 passende Einträge");
    expect(satz).toContain("höchstens 8");
    expect(satz).toContain("wörtlich");
  });
});
