import { describe, expect, it } from "vitest";
import { reasonerBadge } from "../../apps/web/src/lib/reasonerBadge";

describe("SCRUM-233: reasonerBadge", () => {
  it("Modellmodus → pos", () => {
    expect(reasonerBadge({ status: { mode: "model" }, isLoading: false, isError: false })).toEqual({
      kind: "model",
      tone: "pos",
      labelKey: "ask.reasoner.model",
    });
  });

  it("deterministischer Modus → warn (ehrlich, kein Fehler)", () => {
    expect(
      reasonerBadge({ status: { mode: "deterministic" }, isLoading: false, isError: false }),
    ).toEqual({ kind: "deterministic", tone: "warn", labelKey: "ask.reasoner.deterministic" });
  });

  it("Ladezustand → neutral/loading (unabhängig von Status)", () => {
    expect(reasonerBadge({ status: undefined, isLoading: true, isError: false }).kind).toBe(
      "loading",
    );
  });

  it("Fehler oder fehlende Daten → neutral/unknown", () => {
    expect(reasonerBadge({ status: null, isLoading: false, isError: true }).kind).toBe("unknown");
    expect(reasonerBadge({ status: undefined, isLoading: false, isError: false }).kind).toBe(
      "unknown",
    );
  });
});
