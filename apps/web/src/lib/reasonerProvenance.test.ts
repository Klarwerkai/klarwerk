import { describe, expect, it } from "vitest";
import type { Confidentiality } from "../api/types";
import { documentProvenance, draftProvenance, failSafeConfidentiality } from "./reasonerProvenance";

// SCRUM-502 R6: der gemeinsame fail-safe Helfer ist der EINZIGE Ort, an dem einem Modell-Aktions-
// Inhalt eine Stufe zugewiesen/gedefaultet wird. Property/Enumeration: ohne explizite gültige Stufe
// gilt IMMER „vertraulich" — nie still „intern", nie ein geerbter Container-Wert.
describe("SCRUM-502 R6: failSafeConfidentiality (kein stiller Intern-Default)", () => {
  const VALID: Confidentiality[] = ["intern", "vertraulich", "streng_vertraulich"];

  it("gültige, explizite Stufen bleiben unverändert", () => {
    for (const lvl of VALID) {
      expect(failSafeConfidentiality(lvl)).toBe(lvl);
    }
  });

  it("ALLES Nicht-Gültige → fail-safe 'vertraulich' (nie 'intern')", () => {
    const invalid: unknown[] = [
      undefined,
      null,
      "",
      "intern ",
      "INTERN",
      "geheim",
      0,
      {},
      "public",
    ];
    for (const v of invalid) {
      const out = failSafeConfidentiality(v as Confidentiality | undefined | null);
      expect(out, `Eingabe ${JSON.stringify(v)}`).toBe("vertraulich");
      expect(out).not.toBe("intern");
    }
  });
});

describe("SCRUM-502 R6: draft/documentProvenance", () => {
  it("draftProvenance: korrekte Quelle + fail-safe Stufe + optionaler koId-Backstop", () => {
    expect(draftProvenance("intern")).toEqual({ source: "draft", confidentiality: "intern" });
    // Ungesetzt → vertraulich (kein Intern-Default), koId nur als Backstop mitgeführt.
    expect(draftProvenance(undefined, "ko-1")).toEqual({
      source: "draft",
      confidentiality: "vertraulich",
      koId: "ko-1",
    });
  });

  it("documentProvenance: Uploads sind transient-document, ungesetzt → vertraulich", () => {
    expect(documentProvenance(undefined)).toEqual({
      source: "transient-document",
      confidentiality: "vertraulich",
    });
    expect(documentProvenance("streng_vertraulich", "ko-9")).toEqual({
      source: "transient-document",
      confidentiality: "streng_vertraulich",
      koId: "ko-9",
    });
  });

  // Enumerations-Wächter: JEDER Eintrittspunkt MUSS über diese Helfer laufen. Passiert eine
  // ungesetzte Stufe, darf NIE ein cloud-fähiges „intern" herauskommen (Regress-Bremse).
  it("kein Eintrittspunkt kann über die Helfer still 'intern' erzeugen", () => {
    expect(draftProvenance(undefined).confidentiality).toBe("vertraulich");
    expect(documentProvenance(undefined).confidentiality).toBe("vertraulich");
    expect(draftProvenance(null).confidentiality).toBe("vertraulich");
  });
});
