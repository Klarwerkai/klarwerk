import { describe, expect, it } from "vitest";
import { isEgressConfidential } from "./reasoner-routes";

// SCRUM-502 Schicht 2: die effektive Egress-Entscheidung der Modell-Aktions-Endpunkte.
// „Restriktivstes gewinnt": vertraulich ist, was serverseitig gespeichert ODER client-deklariert
// vertraulich ist — ein Client kann ein gespeichertes vertrauliches KO nicht herunterstufen.
describe("SCRUM-502 Schicht 2: isEgressConfidential (restriktivstes gewinnt)", () => {
  it("weder gespeichert noch deklariert vertraulich → nicht vertraulich (Cloud erlaubt)", () => {
    expect(isEgressConfidential(undefined, undefined)).toBe(false);
    expect(isEgressConfidential("intern", "intern")).toBe(false);
    expect(isEgressConfidential(null, "intern")).toBe(false);
  });

  it("Draft deklariert vertraulich (kein gespeichertes KO) → vertraulich", () => {
    expect(isEgressConfidential(undefined, "vertraulich")).toBe(true);
    expect(isEgressConfidential(undefined, "streng_vertraulich")).toBe(true);
  });

  it("gespeichertes KO vertraulich, Client sagt intern → vertraulich (kein Client-Downgrade)", () => {
    expect(isEgressConfidential("vertraulich", "intern")).toBe(true);
    expect(isEgressConfidential("streng_vertraulich", undefined)).toBe(true);
    // Auch ein explizit gefälschtes „intern" vom Client ändert nichts an der gespeicherten Stufe.
    expect(isEgressConfidential("vertraulich", "intern")).toBe(true);
  });

  it("gespeichert intern, Draft-Deklaration vertraulich → vertraulich (Deklaration gewinnt)", () => {
    expect(isEgressConfidential("intern", "vertraulich")).toBe(true);
  });

  it("ungültige/leere Client-Werte normalisieren defensiv auf intern (blockieren nicht fälschlich)", () => {
    expect(isEgressConfidential(undefined, "quatsch")).toBe(false);
    expect(isEgressConfidential(undefined, 42)).toBe(false);
    // aber eine gespeicherte vertrauliche Stufe bleibt maßgeblich, egal was der Client sendet.
    expect(isEgressConfidential("vertraulich", "quatsch")).toBe(true);
  });
});
