import { describe, expect, it, vi } from "vitest";
import {
  anbieterZugelassen,
  bindeAnbieter,
  bindeZustimmung,
  imBindungsrahmen,
} from "./anbieterbindung";
import { cappedModelClient, resetModelSemaphoreForTests, withModelSlot } from "./model-concurrency";
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

// ================================================================================================
// Lauf 2 · Bens B5 — EIN ABGESCHLOSSENER WIDERRUF SPERRT AUCH DIE SCHON LAUFENDE ANFRAGE.
// ================================================================================================

/** Eine Zustimmung, wie das Tor sie mitliefert: `giltNoch` bis zu ihrem Ende. */
function zustimmung() {
  const lage = { beendet: false };
  return {
    giltNoch: () => !lage.beendet,
    beenden: () => {
      lage.beendet = true;
    },
  };
}

describe("Bens B5 · beendete Zustimmung im Anfragerahmen", () => {
  it("gebundene Zustimmung beendet: kein externer Anbieter mehr zugelassen, auch der gebundene nicht", async () => {
    const z = zustimmung();
    await imBindungsrahmen(async () => {
      expect(bindeZustimmung(z.giltNoch)).toBe(true);
      expect(bindeAnbieter("anthropic")).toBe(true);
      expect(anbieterZugelassen("anthropic")).toBe(true);
      z.beenden();
      expect(anbieterZugelassen("anthropic")).toBe(false);
      expect(anbieterZugelassen("openai")).toBe(false);
    });
  });

  it("GEGENPROBE: eine ANDERE beendete Zustimmung berührt die Anfrage nicht", async () => {
    const eigene = zustimmung();
    const fremde = zustimmung();
    await imBindungsrahmen(async () => {
      bindeZustimmung(eigene.giltNoch);
      bindeAnbieter("anthropic");
      fremde.beenden();
      expect(anbieterZugelassen("anthropic")).toBe(true);
    });
  });

  it("ohne Rahmen lässt sich keine Zustimmung binden (fail-closed beim Aufrufer)", () => {
    expect(bindeZustimmung(zustimmung().giltNoch)).toBe(false);
  });
});

describe("Bens B5 · Widerruf zwischen Kettenbau und Übertragung: der Chokepoint lässt nichts hinaus", () => {
  const MAX = process.env.KLARWERK_MODEL_MAX_INFLIGHT;

  /** Echter Reasoner; Anthropic hinter dem echten Chokepoint (`cappedModelClient`), Slot-Cap 1. */
  async function chokepointAufbau() {
    process.env.KLARWERK_MODEL_MAX_INFLIGHT = "1";
    resetModelSemaphoreForTests();
    const transport = vi.fn(async () => '{"text":"von Anthropic"}');
    const reasoner = new Reasoner(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      {
        anbieter: {
          anthropic: new ModelProvider(
            cappedModelClient(
              { name: "anthropic:claude", complete: transport },
              { rejectsConfidential: true },
            ),
          ),
        },
      },
    );
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "anthropic", perTask: { answer: "anthropic", assist: "anthropic" } }),
    );
    // Der einzige Slot ist belegt: der Lauf baut seine Kette und wartet DANACH am Chokepoint.
    let freigeben: () => void = () => undefined;
    const belegt = withModelSlot(
      () =>
        new Promise<void>((r) => {
          freigeben = r;
        }),
    );
    return { reasoner, transport, freigeben: () => freigeben(), belegt };
  }

  function aufraeumen(): void {
    if (MAX === undefined) {
      delete process.env.KLARWERK_MODEL_MAX_INFLIGHT;
    } else {
      process.env.KLARWERK_MODEL_MAX_INFLIGHT = MAX;
    }
    resetModelSemaphoreForTests();
  }

  it("KALIBRIERUNG: ohne Widerruf geht der wartende Lauf nach Slotfreigabe hinaus", async () => {
    const k = await chokepointAufbau();
    try {
      const lauf = imBindungsrahmen(() => {
        bindeZustimmung(zustimmung().giltNoch);
        bindeAnbieter("anthropic");
        return k.reasoner.assistText("Ein Satz.", "de");
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(k.transport).not.toHaveBeenCalled();
      k.freigeben();
      await k.belegt;
      await lauf;
      expect(k.transport).toHaveBeenCalledTimes(1);
    } finally {
      aufraeumen();
    }
  });

  it("Widerruf, während der Lauf am Chokepoint wartet: der Transport wird NICHT gerufen", async () => {
    const k = await chokepointAufbau();
    try {
      const z = zustimmung();
      const lauf = imBindungsrahmen(() => {
        bindeZustimmung(z.giltNoch);
        bindeAnbieter("anthropic");
        return k.reasoner.assistText("Ein Satz.", "de");
      });
      await new Promise((r) => setTimeout(r, 10));
      z.beenden();
      k.freigeben();
      await k.belegt;
      await expect(lauf).rejects.toThrow("keine Antwort");
      expect(k.transport).not.toHaveBeenCalled();
    } finally {
      aufraeumen();
    }
  });
});
