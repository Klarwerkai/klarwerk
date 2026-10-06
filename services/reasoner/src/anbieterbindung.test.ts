import { describe, expect, it, vi } from "vitest";
import {
  KlaraAusweichwegGesperrtFehler,
  anbieterZugelassen,
  bindeAnbieter,
  bindeZustimmung,
  imBindungsrahmen,
} from "./anbieterbindung";
import { cappedModelClient, resetModelSemaphoreForTests, withModelSlot } from "./model-concurrency";
import { DeterministicProvider } from "./provider";
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
    // R-0590 · Ben nacharbeit-3: der zugestimmte Anbieter steht für `assist` nicht in der Kette —
    // statt still den deterministischen Ersatz zu versuchen, endet der Lauf mit dem benannten Grund.
    await expect(
      mitAnbieterbindung("anthropic", () => reasoner.assistText("Ein Satz.", "de")),
    ).rejects.toMatchObject({ grund: "fallback_not_equivalent", anbieter: "anthropic" });
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
      // R-0590 · Ben nacharbeit-3: der Lauf weicht nach dem gesperrten Versuch nicht mehr auf den
      // deterministischen Ersatz aus (der hier „keine Antwort" meldete), sondern endet mit dem
      // benannten Grund — die Zustimmung, auf die er sich stützte, ist beendet.
      await expect(lauf).rejects.toBeInstanceOf(KlaraAusweichwegGesperrtFehler);
      await expect(lauf).rejects.toMatchObject({ grund: "consent_ended", anbieter: "anthropic" });
      expect(k.transport).not.toHaveBeenCalled();
    } finally {
      aufraeumen();
    }
  });
});

// ================================================================================================
// Lauf 2 · Bens B7 — DER CHOKEPOINT SELBST PRÜFT DIE ZUSTIMMUNG, AUF JEDEM WEG (AUCH DEM ZURUF).
// ================================================================================================
//
// Der Zuruf-Formulierer (`zurufModell` in `build-app.ts`) baut keine Reasoner-Kette und hat keine
// Laufspur; er ruft den gecappten Cloud-Client direkt (`createCappedCloudClientFromEnv` →
// `cappedModelClient`). Gemessen wird deshalb GENAU dieser Client, ohne Reasoner.

describe("Bens B7 · Widerruf, während ein direkter Aufruf am gecappten Client wartet", () => {
  const MAX = process.env.KLARWERK_MODEL_MAX_INFLIGHT;

  function aufraeumen(): void {
    if (MAX === undefined) {
      delete process.env.KLARWERK_MODEL_MAX_INFLIGHT;
    } else {
      process.env.KLARWERK_MODEL_MAX_INFLIGHT = MAX;
    }
    resetModelSemaphoreForTests();
  }

  async function wartenderAufruf(rejectsConfidential: boolean) {
    process.env.KLARWERK_MODEL_MAX_INFLIGHT = "1";
    resetModelSemaphoreForTests();
    const transport = vi.fn(async () => "Zuruf");
    const client = cappedModelClient(
      { name: "anthropic:claude", complete: transport },
      { rejectsConfidential },
    );
    let freigeben: () => void = () => undefined;
    const belegt = withModelSlot(
      () =>
        new Promise<void>((r) => {
          freigeben = r;
        }),
    );
    const z = zustimmung();
    const aufruf = imBindungsrahmen(() => {
      bindeZustimmung(z.giltNoch);
      bindeAnbieter("anthropic");
      // Wie der Zuruf-Wrapper: Bindung VOR dem Aufruf geprüft, dann direkt an den Client.
      expect(anbieterZugelassen("anthropic")).toBe(true);
      return client.complete("system", "user", false);
    });
    await new Promise((r) => setTimeout(r, 10));
    return { transport, z, aufruf, belegt, freigeben: () => freigeben() };
  }

  it("KALIBRIERUNG: ohne Widerruf überträgt der wartende Aufruf nach Slotfreigabe genau einmal", async () => {
    try {
      const k = await wartenderAufruf(true);
      expect(k.transport).not.toHaveBeenCalled();
      k.freigeben();
      await k.belegt;
      await expect(k.aufruf).resolves.toBe("Zuruf");
      expect(k.transport).toHaveBeenCalledTimes(1);
    } finally {
      aufraeumen();
    }
  });

  it("Widerruf während des Wartens: der externe Transport wird NICHT gerufen", async () => {
    try {
      const k = await wartenderAufruf(true);
      expect(k.transport).not.toHaveBeenCalled();
      k.z.beenden();
      k.freigeben();
      await k.belegt;
      await expect(k.aufruf).rejects.toThrow("keine externe Übertragung");
      expect(k.transport).not.toHaveBeenCalled();
    } finally {
      aufraeumen();
    }
  });

  it("GEGENPROBE: ein bestätigt lokaler Endpunkt (kein Abfluss) ist nicht betroffen", async () => {
    try {
      const k = await wartenderAufruf(false);
      k.z.beenden();
      k.freigeben();
      await k.belegt;
      await expect(k.aufruf).resolves.toBe("Zuruf");
      expect(k.transport).toHaveBeenCalledTimes(1);
    } finally {
      aufraeumen();
    }
  });
});

// ================================================================================================
// R-0590 · BEN NACHARBEIT-1 — DER NICHT GLEICHWERTIGE AUSWEICHWEG WIRD GESPERRT, MIT GRUND.
// ================================================================================================
//
// Kette einer Klara-Antwort mit `auto`: Anthropic → lokales Modell → deterministischer Ersatz. Alle
// drei Glieder sind verfügbar; gezählt wird, WER antwortet. Die Zustimmung gilt Anthropic. Scheitert
// Anthropic oder fällt es aus der Kette, darf weder das lokale Modell noch der Ersatz einspringen —
// der Lauf endet mit `KlaraAusweichwegGesperrtFehler` und benanntem Grund.

const ANTWORT = {
  answered: true,
  answer: "Antwort",
  knowledgeClass: "gesichert",
  trust: 60,
  sources: [],
  citedSources: [],
  steps: [],
  demo: false,
};

const STRUKTUR = {
  title: "Titel",
  statement: "Aussage",
  conditions: [],
  measures: [],
  tags: [],
  confidence: 0.8,
  demo: false,
};

async function ausweichAufbau(anthropicScheitert: boolean) {
  const anthropic = new ModelProvider({ name: "anthropic:claude", complete: vi.fn() });
  const anthropicAntwort = vi.fn(async () => {
    if (anthropicScheitert) {
      throw new Error("Anthropic: HTTP 503");
    }
    return { ...ANTWORT, answer: "von Anthropic" };
  });
  (anthropic as unknown as { answer: unknown }).answer = anthropicAntwort;
  const lokal = new ModelProvider({ name: "lokal:llm", complete: vi.fn() });
  const lokalAntwort = vi.fn(async () => ({ ...ANTWORT, answer: "vom lokalen Modell" }));
  (lokal as unknown as { answer: unknown }).answer = lokalAntwort;
  // Ben nacharbeit-3: derselbe Aufbau für `structure` — eine zweite Aufgabe unter derselben Bindung.
  const anthropicStruktur = vi.fn(async () => {
    if (anthropicScheitert) {
      throw new Error("Anthropic: HTTP 503");
    }
    return { ...STRUKTUR, title: "von Anthropic" };
  });
  (anthropic as unknown as { structure: unknown }).structure = anthropicStruktur;
  const lokalStruktur = vi.fn(async () => ({ ...STRUKTUR, title: "vom lokalen Modell" }));
  (lokal as unknown as { structure: unknown }).structure = lokalStruktur;
  const ersatz = new DeterministicProvider();
  const ersatzAntwort = vi.spyOn(ersatz, "answer");
  const ersatzStruktur = vi.spyOn(ersatz, "structure");
  const reasoner = new Reasoner(undefined, ersatz, undefined, undefined, lokal, undefined, {
    anbieter: { anthropic },
  });
  await reasoner.setTaskConfig(mitKiFreigabe({ global: "auto", perTask: { answer: "auto" } }));
  const fragen = () => reasoner.answer("Wie wird die Pumpe geschmiert?", [], "de");
  const strukturieren = (vertraulich = false) =>
    reasoner.structure("Pumpe P2 alle 200 Betriebsstunden schmieren.", "de", vertraulich);
  return {
    fragen,
    strukturieren,
    anthropicAntwort,
    lokalAntwort,
    ersatzAntwort,
    anthropicStruktur,
    lokalStruktur,
    ersatzStruktur,
  };
}

describe("R-0590 · kein nicht gleichwertiger Ausweichweg hinter der Zustimmung", () => {
  it("GEGENPROBE: der zugestimmte Anbieter antwortet — seine Antwort kommt an, kein Ersatz läuft", async () => {
    const k = await ausweichAufbau(false);
    const ergebnis = await mitAnbieterbindung("anthropic", k.fragen);
    expect(ergebnis.answer).toBe("von Anthropic");
    expect(k.anthropicAntwort).toHaveBeenCalledTimes(1);
    expect(k.lokalAntwort).not.toHaveBeenCalled();
    expect(k.ersatzAntwort).not.toHaveBeenCalled();
  });

  it("der zugestimmte Anbieter scheitert: lokales Modell und Ersatz laufen NICHT, der Grund ist benannt", async () => {
    const k = await ausweichAufbau(true);
    const lauf = mitAnbieterbindung("anthropic", k.fragen);
    await expect(lauf).rejects.toBeInstanceOf(KlaraAusweichwegGesperrtFehler);
    await expect(lauf).rejects.toMatchObject({
      grund: "fallback_not_equivalent",
      anbieter: "anthropic",
    });
    expect(k.anthropicAntwort).toHaveBeenCalledTimes(1);
    expect(k.lokalAntwort).not.toHaveBeenCalled();
    expect(k.ersatzAntwort).not.toHaveBeenCalled();
  });

  it("der zugestimmte Anbieter fällt aus der Kette (Zustimmung beendet): kein Ersatz, Grund `consent_ended`", async () => {
    const k = await ausweichAufbau(false);
    const z = zustimmung();
    z.beenden();
    const lauf = imBindungsrahmen(() => {
      bindeZustimmung(z.giltNoch);
      bindeAnbieter("anthropic");
      return k.fragen();
    });
    await expect(lauf).rejects.toMatchObject({ grund: "consent_ended", anbieter: "anthropic" });
    expect(k.anthropicAntwort).not.toHaveBeenCalled();
    expect(k.lokalAntwort).not.toHaveBeenCalled();
    expect(k.ersatzAntwort).not.toHaveBeenCalled();
  });

  it("GRENZE: ohne Klara-Bindung bleibt die Kette wie bisher — das lokale Modell springt ein", async () => {
    const k = await ausweichAufbau(true);
    const ergebnis = await k.fragen();
    expect(ergebnis.answer).toBe("vom lokalen Modell");
    expect(k.lokalAntwort).toHaveBeenCalledTimes(1);
  });

  it("GRENZE: bei Absage des Tors (`null`) gibt es keinen zugestimmten Weg — die Enge antwortet wie bisher", async () => {
    const k = await ausweichAufbau(false);
    const ergebnis = await mitAnbieterbindung(null, k.fragen);
    expect(k.anthropicAntwort).not.toHaveBeenCalled();
    expect(ergebnis.answer).toBe("vom lokalen Modell");
  });
});

// ================================================================================================
// R-0590 · BEN NACHARBEIT-3 — DIE SPERRE GILT FÜR JEDE AUFGABE UNTER DER BINDUNG, NICHT NUR `answer`.
// ================================================================================================

describe("R-0590 · gebundener `structure`-Lauf: kein nicht gleichwertiger Ausweichweg", () => {
  it("GEGENPROBE: der zugestimmte Anbieter strukturiert — sein Ergebnis kommt an, kein Ersatz läuft", async () => {
    const k = await ausweichAufbau(false);
    const ergebnis = await mitAnbieterbindung("anthropic", () => k.strukturieren());
    expect(ergebnis.title).toBe("von Anthropic");
    expect(ergebnis.demo).toBe(false);
    expect(k.anthropicStruktur).toHaveBeenCalledTimes(1);
    expect(k.lokalStruktur).not.toHaveBeenCalled();
    expect(k.ersatzStruktur).not.toHaveBeenCalled();
  });

  it("der zugestimmte Anbieter scheitert: lokales Modell und deterministischer Ersatz laufen NICHT", async () => {
    const k = await ausweichAufbau(true);
    const lauf = mitAnbieterbindung("anthropic", () => k.strukturieren());
    await expect(lauf).rejects.toBeInstanceOf(KlaraAusweichwegGesperrtFehler);
    await expect(lauf).rejects.toMatchObject({
      grund: "fallback_not_equivalent",
      anbieter: "anthropic",
    });
    expect(k.anthropicStruktur).toHaveBeenCalledTimes(1);
    expect(k.lokalStruktur).not.toHaveBeenCalled();
    expect(k.ersatzStruktur).not.toHaveBeenCalled();
  });

  it("GRENZE: ohne Klara-Bindung bleibt der Ersatzweg der Basisfunktion erhalten", async () => {
    const k = await ausweichAufbau(true);
    const ergebnis = await k.strukturieren();
    expect(ergebnis.title).toBe("vom lokalen Modell");
    expect(k.lokalStruktur).toHaveBeenCalledTimes(1);
  });

  it("GRENZE: ein VERTRAULICHER Lauf folgt weiter der Vertraulichkeitsregel, nicht der Ausweichwegsperre", async () => {
    // Vertrauliches war nie Gegenstand der Zustimmung: Anthropic steht ohne Vertraulichkeitsfreigabe
    // gar nicht in der Kette, und der Lauf endet wie bisher mit einem gekennzeichneten Ergebnis.
    const k = await ausweichAufbau(false);
    const ergebnis = await mitAnbieterbindung("anthropic", () => k.strukturieren(true));
    expect(k.anthropicStruktur).not.toHaveBeenCalled();
    expect(ergebnis).toBeDefined();
  });
});
