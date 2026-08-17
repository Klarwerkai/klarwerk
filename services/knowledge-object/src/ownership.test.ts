// ================================================================================================
// JOB 557 · D7 — DIE REGELN DES EIGENTÜMER-AGGREGATS.
// ================================================================================================
//
// Diese Datei prüft das MODUL (reine Funktionen). Dass die Regeln im Produkt auch WIRKEN, prüft
// `services/validation/src/rueckgabe-eigentuemer.test.ts` am Verhalten — die beiden sind bewusst
// getrennt: ein Modul, das richtig rechnet und niemanden erreicht, war der Befund von D5.
import { describe, expect, it } from "vitest";
import {
  normalizeOwnership,
  ownershipOf,
  responsibleKindOf,
  responsibleOf,
  sameOwnership,
  withRole,
} from "./ownership";
import type { KnowledgeObject } from "./types";

/** Der schmalste Ausschnitt, den die Helfer wirklich lesen. */
function ko(
  overrides: Partial<KnowledgeObject> = {},
): Pick<KnowledgeObject, "author" | "ownership"> {
  return { author: "anna-erzeugerin", ...overrides };
}

describe("O · normalizeOwnership — die eine Normalform", () => {
  it("O1 · nimmt Eigentümer und beide Rollenfolgen an", () => {
    expect(
      normalizeOwnership({ owner: "eva", reviewers: ["paula"], validators: ["victor"] }),
    ).toEqual({ owner: "eva", reviewers: ["paula"], validators: ["victor"] });
  });

  it("O2 · trimmt Kennungen und verwirft leere", () => {
    expect(normalizeOwnership({ owner: "  eva  ", reviewers: ["  ", "paula ", ""] })).toEqual({
      owner: "eva",
      reviewers: ["paula"],
      validators: [],
    });
  });

  it("O3 · dedupliziert und behält die gelieferte Reihenfolge", () => {
    expect(normalizeOwnership({ reviewers: ["paula", "petra", "paula"] })?.reviewers).toEqual([
      "paula",
      "petra",
    ]);
  });

  it("O4 · verwirft Nicht-Zeichenketten in den Folgen, statt sie zu erfinden", () => {
    expect(normalizeOwnership({ reviewers: [1, null, {}, "paula"] })?.reviewers).toEqual(["paula"]);
  });

  it("O5 · ein nicht-objektartiger Wert ergibt KEINE Angabe", () => {
    for (const wert of [null, undefined, "eva", 42, ["eva"], true]) {
      expect(normalizeOwnership(wert), String(wert)).toBeNull();
    }
  });

  it("O6 · eine LEERE Angabe legt kein leeres Aggregat ab", () => {
    expect(normalizeOwnership({})).toBeNull();
    expect(normalizeOwnership({ reviewers: [], validators: [] })).toBeNull();
    expect(normalizeOwnership({ owner: "   " })).toBeNull();
  });

  it("O7 · ein Aggregat NUR mit Prüferinnen ist gültig — Eigentum bleibt offen", () => {
    const norm = normalizeOwnership({ reviewers: ["paula"] });
    expect(norm).toEqual({ reviewers: ["paula"], validators: [] });
    expect(norm?.owner).toBeUndefined();
  });

  it("O8 · unbekannte Felder werden nicht übernommen", () => {
    const norm = normalizeOwnership({ owner: "eva", rolle: "chef", darf: ["alles"] });
    expect(Object.keys(norm ?? {}).sort()).toEqual(["owner", "reviewers", "validators"]);
  });

  it("O9 · OHNE Angabe entsteht KEIN Eigentum — kein stiller Default auf den Autor", () => {
    // Die Funktion kennt den Autor gar nicht. Das ist die Bauart, nicht ein Versehen: ein Modul,
    // das ihn kennte, könnte ihn einsetzen — und genau das hat Pedis Entscheidung verworfen.
    expect(normalizeOwnership(undefined)).toBeNull();
    expect(ownershipOf(ko())).toBeNull();
  });
});

describe("R · responsibleOf — der EINE benannte Rückfall", () => {
  it("R1 · mit Eigentümerin ist sie die Verantwortliche", () => {
    const objekt = ko({ ownership: { owner: "eva", reviewers: [], validators: [] } });
    expect(responsibleOf(objekt)).toBe("eva");
    expect(responsibleKindOf(objekt)).toBe("owner");
  });

  it("R2 · ohne Aggregat fällt die Verantwortung auf die Autorin zurück — benannt", () => {
    expect(responsibleOf(ko())).toBe("anna-erzeugerin");
    expect(responsibleKindOf(ko())).toBe("author-fallback");
  });

  it("R3 · ein Aggregat OHNE Eigentümerin fällt ebenfalls zurück", () => {
    const objekt = ko({ ownership: { reviewers: ["paula"], validators: [] } });
    expect(responsibleOf(objekt)).toBe("anna-erzeugerin");
    expect(responsibleKindOf(objekt)).toBe("author-fallback");
  });

  it("R4 · `ownershipOf` gibt den Rückfall NIE zurück — wer die Wahrheit will, bekommt null", () => {
    expect(ownershipOf(ko())).toBeNull();
    expect(ownershipOf(ko({ ownership: { reviewers: [], validators: [] } }))).toBeNull();
  });
});

describe("W · withRole — Fortschreibung aus tatsächlichen Ereignissen", () => {
  it("W1 · legt bei fehlendem Aggregat eines an — OHNE Eigentümerin", () => {
    const nachher = withRole(null, "reviewers", ["paula"]);
    expect(nachher).toEqual({ reviewers: ["paula"], validators: [] });
    expect(nachher?.owner, "aus einer Prüfzuweisung ist Eigentum entstanden").toBeUndefined();
  });

  it("W2 · hängt an und dedupliziert, ohne die Reihenfolge zu ändern", () => {
    const erst = withRole(null, "reviewers", ["paula"]);
    const dann = withRole(erst, "reviewers", ["paula", "petra"]);
    expect(dann?.reviewers).toEqual(["paula", "petra"]);
  });

  it("W3 · eine leere Ereignisliste ändert nichts (idempotent)", () => {
    const vorher = normalizeOwnership({ owner: "eva", reviewers: ["paula"] });
    expect(sameOwnership(withRole(vorher, "reviewers", []), vorher)).toBe(true);
    expect(withRole(null, "validators", [])).toBeNull();
  });

  it("W4 · die Eigentümerin bleibt unangetastet", () => {
    const vorher = normalizeOwnership({ owner: "eva" });
    expect(withRole(vorher, "validators", ["victor"])).toEqual({
      owner: "eva",
      reviewers: [],
      validators: ["victor"],
    });
  });

  it("W5 · die beiden Rollen sind getrennt — eine Validierung ist keine Prüfung", () => {
    const nachher = withRole(withRole(null, "reviewers", ["paula"]), "validators", ["victor"]);
    expect(nachher).toEqual({ reviewers: ["paula"], validators: ["victor"] });
  });
});

describe("S · sameOwnership — die Gleichheit, an der die Idempotenz hängt", () => {
  it("S1 · zwei null sind gleich, null und ein Aggregat nicht", () => {
    expect(sameOwnership(null, null)).toBe(true);
    expect(sameOwnership(null, { reviewers: ["paula"], validators: [] })).toBe(false);
  });

  it("S2 · Reihenfolge zählt — sie stammt von einem Menschen", () => {
    const a = { reviewers: ["paula", "petra"], validators: [] };
    const b = { reviewers: ["petra", "paula"], validators: [] };
    expect(sameOwnership(a, b)).toBe(false);
  });

  it("S3 · ein Eigentümerwechsel wird erkannt", () => {
    expect(
      sameOwnership(
        { owner: "eva", reviewers: [], validators: [] },
        { owner: "erik", reviewers: [], validators: [] },
      ),
    ).toBe(false);
  });
});
