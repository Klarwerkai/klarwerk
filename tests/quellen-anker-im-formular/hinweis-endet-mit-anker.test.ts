// ================================================================================================
// JOB 3133 · UX-22 — KALIBRIERUNG: DIE LÜCKE LIEGT NICHT IN DER REGEL.
// ================================================================================================
//
// Dieser Fall ist schon VOR der Reparatur grün, und genau das ist seine Aussage. `sourceAttachHint`
// (apps/web/src/lib/externalAttachGate.ts:62-87) kennt den Anker seit mega16 — der dritte Parameter
// `anchored` steht dort, wird geprüft und nimmt den Hinweis „unanchored" zurück.
//
// Falsch war NUR der Aufruf: `MehrAbschnitte.tsx:201` rief die Funktion mit zwei Argumenten auf, und
// der Vorgabewert `anchored = false` machte den Hinweis im Bibliotheksformular unauflösbar. Wer
// diesen Fall rot sieht, hat die REGEL angefasst — und damit den Gleichlauf mit dem Server
// (attach-policy.ts:197-211) verlassen. Das ist nicht der Auftrag.
import { describe, expect, it } from "vitest";
import {
  sourceAttachCertainlyDenied,
  sourceAttachHint,
} from "../../apps/web/src/lib/externalAttachGate";

describe("JOB 3133 · Kalibrierung: die Regel konnte den Anker immer schon", () => {
  it("K1 · restriktive Stufe, keine Adresse: mit Anker kein Hinweis, ohne Anker „unanchored“", () => {
    expect(sourceAttachHint("search_on_click", "", true)).toBeNull();
    expect(sourceAttachHint("search_on_click", "", false)).toBe("unanchored");
  });

  it("K2 · dasselbe auf `blocked` und für eine nicht speicherbare Adresse", () => {
    expect(sourceAttachHint("blocked", "", true)).toBeNull();
    expect(sourceAttachHint("blocked", "kein-url", true)).toBeNull();
    expect(sourceAttachHint("blocked", "/relativ/x", false)).toBe("unanchored");
  });

  it("K3 · der Anker ist kein Generalschlüssel: eine öffentliche Adresse bleibt gesperrt", () => {
    expect(sourceAttachHint("search_on_click", "https://de.wikipedia.org/wiki/X", true)).toBe(
      "public-url",
    );
  });

  it("K4 · ohne geladene Stufe wird nichts behauptet — auch nicht mit Anker", () => {
    expect(sourceAttachHint(null, "", false)).toBeNull();
    expect(sourceAttachHint(undefined, "", true)).toBeNull();
  });

  // RUNDE 4 (Codex R3): der Hinweis ist nicht das Urteil. Hier steht die Trennung, aus der die
  // Oberfläche ihre Sperre ableiten darf — und nur sie.
  it("K5 · sicher abgewiesen ist NUR der adresslose Fall ohne Anker, nicht jede http(s)-Adresse", () => {
    // Weiss die Oberfläche selbst: leere/nicht speicherbare Adresse + kein gültiger Anker.
    expect(sourceAttachCertainlyDenied("unanchored")).toBe(true);
    // Weiss sie NICHT: ob der Betreiber diesen Host als intern eingetragen hat, steht allein in
    // seiner Allowlist (externalAttachGate.ts:50-52). Eine Sperre daraus wäre eine Ablehnung aus
    // Nichtwissen — sie nähme dem Nutzer eine Quelle, die der Server annimmt.
    expect(sourceAttachCertainlyDenied("public-url")).toBe(false);
    // Kein Hinweis, keine Sperre.
    expect(sourceAttachCertainlyDenied(null)).toBe(false);
  });
});
