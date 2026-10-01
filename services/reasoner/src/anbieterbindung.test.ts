import { describe, expect, it, vi } from "vitest";
import { anbieterZugelassen, bindeAnbieter, imBindungsrahmen } from "./anbieterbindung";
import { ModelProvider } from "./provider-model";
import { Reasoner } from "./service";
import { mitKiFreigabe } from "./testhelfer-ki-freigabe";

// ================================================================================================
// Auftrag gesamt-ki-einwilligung · Bens B3 (Runde 2) — die Bindung greift beim KETTENBAU.
// ================================================================================================
//
// Echter Reasoner, zwei echte `ModelProvider`, nur der Transport (`complete`) ist ein Spion. Gemessen
// wird, WER tatsächlich gerufen wird — nicht ein Argument davor.

/** Der Lauf in einem Anfragerahmen mit festgehaltener Bindung — so, wie die Routen ihn öffnen. */
function mitAnbieterbindung<T>(anbieter: string | null, lauf: () => T): T {
  return imBindungsrahmen(() => {
    bindeAnbieter(anbieter);
    return lauf();
  });
}

async function aufbau(assist: "openai" | "anthropic") {
  const openai = vi.fn(async () => '{"text":"von OpenAI"}');
  const anthropic = vi.fn(async () => '{"text":"von Anthropic"}');
  const reasoner = new Reasoner(undefined, undefined, undefined, undefined, undefined, undefined, {
    anbieter: {
      openai: new ModelProvider({ name: "cloud:openai:gpt", complete: openai }),
      anthropic: new ModelProvider({ name: "anthropic:claude", complete: anthropic }),
    },
  });
  await reasoner.setTaskConfig(
    mitKiFreigabe({ global: "anthropic", perTask: { answer: "anthropic", assist } }),
  );
  return { reasoner, openai, anthropic };
}

describe("Bens B3 · der Reasoner lässt unter Bindung nur den gebundenen Anbieter in die Kette", () => {
  it("KALIBRIERUNG: ohne Bindung geht `assist` an den zugeordneten Anbieter (OpenAI)", async () => {
    const { reasoner, openai } = await aufbau("openai");
    await reasoner.assistText("Ein Satz.", "de");
    expect(openai).toHaveBeenCalledTimes(1);
  });

  it("gebunden an Anthropic, `assist` steht auf OpenAI: OpenAI wird NICHT gerufen", async () => {
    const { reasoner, openai, anthropic } = await aufbau("openai");
    // Ohne zugelassenes Modell sagt `assistText` ehrlich, dass kein Vorschlag entstand.
    await expect(
      mitAnbieterbindung("anthropic", () => reasoner.assistText("Ein Satz.", "de")),
    ).rejects.toThrow("keine Antwort");
    expect(openai).not.toHaveBeenCalled();
    expect(anthropic).not.toHaveBeenCalled();
  });

  it("gebunden an denselben Anbieter: der Lauf geht hinaus", async () => {
    const { reasoner, anthropic } = await aufbau("anthropic");
    await mitAnbieterbindung("anthropic", () => reasoner.assistText("Ein Satz.", "de"));
    expect(anthropic).toHaveBeenCalledTimes(1);
  });

  it("gebunden an KEINEN Anbieter (`null`): kein externer Aufruf", async () => {
    const { reasoner, anthropic, openai } = await aufbau("anthropic");
    await expect(
      mitAnbieterbindung(null, () => reasoner.assistText("Ein Satz.", "de")),
    ).rejects.toThrow("keine Antwort");
    expect(anthropic).not.toHaveBeenCalled();
    expect(openai).not.toHaveBeenCalled();
  });

  it("die Anzeige (`configStatus`) bleibt unberührt — sie beantwortet die Konfigurationsfrage", async () => {
    const { reasoner } = await aufbau("openai");
    const status = mitAnbieterbindung("anthropic", () => reasoner.configStatus());
    expect(status.effectiveAnbieter.assist).toBe("openai");
  });
});

describe("Bens B3 · der Anfragerahmen", () => {
  it("ohne Rahmen lässt sich nichts binden — der Aufrufer muss sperren", () => {
    expect(bindeAnbieter("anthropic")).toBe(false);
    expect(anbieterZugelassen("openai")).toBe(true);
  });

  it("im Rahmen gilt die Bindung für den Rest des Laufs, auch nach Wartepunkten", async () => {
    await imBindungsrahmen(async () => {
      expect(anbieterZugelassen("openai")).toBe(true);
      expect(bindeAnbieter("anthropic")).toBe(true);
      await new Promise((r) => setTimeout(r, 0));
      expect(anbieterZugelassen("anthropic")).toBe(true);
      expect(anbieterZugelassen("openai")).toBe(false);
    });
  });

  it("Bindungen werden nur enger: eine zweite, andere Bindung schliesst jeden Anbieter aus", async () => {
    await imBindungsrahmen(async () => {
      bindeAnbieter("anthropic");
      bindeAnbieter("openai");
      expect(anbieterZugelassen("anthropic")).toBe(false);
      expect(anbieterZugelassen("openai")).toBe(false);
    });
  });
});
