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
import type { AntwortBelastbarkeit, ArgumentStufe } from "../../apps/web/src/api/types";
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

// Eine Kette in der Gestalt, die der Server liefert (`argumentation` in answer-belastbarkeit.ts).
const KETTE: ArgumentStufe[] = [
  {
    art: "aussage",
    koId: "a",
    titel: "Ventil V4 jährlich prüfen",
    aussage: "Ventil V4 wird jährlich geprüft.",
    wissensart: "technik",
    belegstelle: "jährlich zu prüfen",
    vertrauenswert: 91,
    validiert: true,
    stand: "2026-03-05T10:00:00.000Z",
  },
  {
    art: "aussage",
    koId: "b",
    titel: "Prüfintervall Druckbehälter",
    aussage: "Druckbehälter werden jährlich geprüft.",
    wissensart: "best_practice",
    belegstelle: null,
    vertrauenswert: 76,
    validiert: true,
    stand: "2025-11-20T08:00:00.000Z",
  },
  {
    art: "beziehung",
    kanteId: "k1",
    beziehung: "beispiel_fuer",
    gerichtet: true,
    vonKoId: "a",
    vonTitel: "Ventil V4 jährlich prüfen",
    zuKoId: "b",
    zuTitel: "Prüfintervall Druckbehälter",
    gesetztVon: "Karl Muster",
  },
  {
    art: "einwand",
    konfliktId: "c1",
    seite: {
      einsehbar: true,
      koId: "z",
      titel: "Ventil V4 halbjährlich",
      aussage: "Ventil V4 wird halbjährlich geprüft.",
      version: 1,
      vertrauenswert: 40,
      validiert: false,
      traegtAntwort: false,
    },
  },
  { art: "vorbehalt", grund: "zustaendig_nicht_erreichbar" },
  {
    art: "schluss",
    lage: "belegt_mit_konflikt",
    einstufung: "unverified",
    aussage: "Ventil V4 ist jährlich zu prüfen.",
    gestuetztAuf: ["a", "b"],
    unabhaengig: false,
  },
];

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

  it("R-1627: die Argumentationskette steht aufklappbar da, jede Stufe mit ihrer Quelle", () => {
    const mitKette: AntwortBelastbarkeit = {
      ...MIT_KONFLIKT,
      argumentation: KETTE,
      zuschnitt: {
        rolle: "experte",
        anlass: "frage",
        tiefe: "ausfuehrlich",
        fachsprache: "fach",
        reihenfolge: ["technik", "negativwissen", "lernkurve", "best_practice", "bauchgefuehl"],
      },
    };
    montiere(createElement(Belastbarkeit, { b: mitKette }));
    const stufen = alle("ask-argument-stufe");
    expect(stufen.map((s) => s.getAttribute("data-art"))).toEqual([
      "aussage",
      "aussage",
      "beziehung",
      "einwand",
      "vorbehalt",
      "schluss",
    ]);
    // Ausführlich: jede Stufe steht offen, jede ist ein eigenes <details>.
    const offen = stufen.map((s) => (s.querySelector("details") as HTMLDetailsElement).open);
    expect(offen).toHaveLength(6);
    expect(offen.every((o) => o)).toBe(true);
    expect(stufen[0]?.textContent).toContain("Aussage: Ventil V4 jährlich prüfen");
    expect(stufen[0]?.textContent).toContain("Belegstelle: „jährlich zu prüfen“");
    expect(stufen[0]?.textContent).toContain("Technik");
    // Ben nacharbeit-9: die zweite Quelle ist eine eigene Aussage, keine „Stützung" nach Position.
    expect(stufen[1]?.textContent).toContain("Aussage: Prüfintervall Druckbehälter");
    expect(container.textContent).not.toContain("Gestützt durch");
    // Die Beziehung steht nur, weil der Server eine kuratierte Kante liefert — mit Art und Urheber.
    expect(stufen[2]?.textContent).toContain("Belegte Beziehung");
    expect(stufen[2]?.textContent).toContain(
      "Ventil V4 jährlich prüfen → ist ein Beispiel für → Prüfintervall Druckbehälter",
    );
    expect(stufen[2]?.textContent).toContain("Beziehung gesetzt von Karl Muster");
    expect(stufen[3]?.textContent).toContain("Ventil V4 wird halbjährlich geprüft.");
    expect(stufen[4]?.textContent).toContain("nicht erreichbar");
    // Der Schluss trägt die inhaltliche Schlussfolgerung und ihre Quellen, dazu die Einstufung.
    expect(stufen[5]?.textContent).toContain("Ventil V4 ist jährlich zu prüfen.");
    expect(stufen[5]?.textContent).toContain(
      "Gestützt auf: Ventil V4 jährlich prüfen, Prüfintervall Druckbehälter",
    );
    expect(stufen[5]?.textContent).toContain("Belegt — mit Widerspruch");
    expect(marke("ask-argument-unabhaengig")).toBeNull();
    expect(marke("ask-zuschnitt")?.textContent).toContain("Expertin oder Experte");
    expect(marke("ask-zuschnitt")?.textContent).toContain("freie Frage");
    expect(container.textContent).not.toMatch(/%/);
  });

  it("R-0346: kurz und allgemein — nur Aussage und Schluss offen, keine Fassungsnummer", () => {
    const kurz: AntwortBelastbarkeit = {
      ...MIT_KONFLIKT,
      argumentation: KETTE,
      zuschnitt: {
        rolle: "viewer",
        anlass: "dokument",
        tiefe: "kurz",
        fachsprache: "allgemein",
        reihenfolge: ["best_practice", "negativwissen", "technik", "lernkurve", "bauchgefuehl"],
      },
    };
    montiere(createElement(Belastbarkeit, { b: kurz }));
    const offen = alle("ask-argument-stufe").map((s) => [
      s.getAttribute("data-art"),
      (s.querySelector("details") as HTMLDetailsElement).open,
    ]);
    expect(offen).toEqual([
      ["aussage", true],
      ["aussage", true],
      ["beziehung", false],
      ["einwand", false],
      ["vorbehalt", false],
      ["schluss", true],
    ]);
    // Zugeklappt heisst nicht weggelassen: der Inhalt steht im Baum.
    expect(container.textContent).toContain("Ventil V4 wird halbjährlich geprüft.");
    const zeilen = alle("ask-belastbarkeit-quelle").map((z) => z.textContent ?? "");
    expect(zeilen[0]).not.toContain("v3");
    // Die rohe Kontokennung ist eine Fachangabe — allgemein steht sie nicht da.
    expect(alle("ask-belastbarkeit-verantwortung")[1]?.textContent).not.toContain("u-weg");
    expect(marke("ask-zuschnitt")?.textContent).toContain("Arbeit an einem Dokument");
  });

  it("R-1627: ohne belegte Beziehung sagt der Schluss, dass die Quellen unabhängig stehen", () => {
    const stufen: ArgumentStufe[] = [];
    for (const s of KETTE) {
      if (s.art === "schluss") {
        stufen.push({ ...s, unabhaengig: true });
      } else if (s.art !== "beziehung") {
        stufen.push(s);
      }
    }
    const ohneKante: AntwortBelastbarkeit = { ...MIT_KONFLIKT, argumentation: stufen };
    montiere(createElement(Belastbarkeit, { b: ohneKante }));
    const arten = alle("ask-argument-stufe").map((s) => s.getAttribute("data-art"));
    expect(arten).not.toContain("beziehung");
    expect(marke("ask-argument-unabhaengig")?.textContent).toContain(
      "keine Beziehung belegt — sie stehen unabhängig nebeneinander",
    );
  });

  it("Ben nacharbeit-11: Wörterbucherklärungen stehen getrennt von der Quellenbilanz, mit Herkunft", () => {
    const mitWoerterbuch: AntwortBelastbarkeit = {
      ...MIT_KONFLIKT,
      woerterbuch: [
        {
          benennung: "Druckbehälter",
          definition: "Geschlossener Behälter unter Überdruck.",
          herkunft: {
            eintragId: "begriff-db",
            fassung: 2,
            geltungsbereich: "Werk Nord",
            verantwortlich: "Instandhaltung",
            geaendertAm: "2026-09-01T08:00:00.000Z",
          },
          vertrauenswert: null,
          belastbarkeit: "nicht_bewertet",
        },
      ],
    };
    montiere(createElement(Belastbarkeit, { b: mitWoerterbuch }));
    const abschnitt = marke("ask-belastbarkeit-woerterbuch")?.textContent ?? "";
    expect(abschnitt).toContain("nicht Teil der Quellenbilanz und ohne Vertrauenswert");
    const eintraege = alle("ask-belastbarkeit-woerterbuch-eintrag");
    expect(eintraege).toHaveLength(1);
    const eintrag = eintraege[0]?.textContent ?? "";
    expect(eintrag).toContain("Druckbehälter");
    // Die Erklärung selbst steht hier — im Antworttext hält R-0310 den quellenlosen Absatz zurück.
    expect(marke("ask-belastbarkeit-woerterbuch-definition")?.textContent).toBe(
      "Geschlossener Behälter unter Überdruck.",
    );
    expect(eintrag).toContain("Wörterbucheintrag begriff-db, Fassung 2");
    expect(eintrag).toContain("Werk Nord");
    expect(eintrag).toContain("Verantwortlich: Instandhaltung");
    expect(eintrag).toContain("Stand 01.09.2026");
    expect(eintrag).toContain("Belastbarkeit nicht bewertet");
    // Die Quellenbilanz bleibt die der Wissensobjekte.
    expect(alle("ask-belastbarkeit-quelle")).toHaveLength(2);
    expect(container.textContent).toContain("2 von 3 herangezogenen Quellen");
  });

  it("ohne Wörterbuchergänzung kein Wörterbuchabschnitt", () => {
    montiere(createElement(Belastbarkeit, { b: MIT_KONFLIKT }));
    expect(marke("ask-belastbarkeit-woerterbuch")).toBeNull();
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
