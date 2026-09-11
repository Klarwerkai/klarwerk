import { describe, expect, it } from "vitest";
import { ModelProvider } from "./provider-model";
import type { ModelClient } from "./provider-model";
import type { ReasonerPolicyRepo } from "./reasoner-policy";
import { Reasoner } from "./service";
// JOB 3570: die Grundfreigabe im Aufbau. Die Datei unterscheidet `confidential` von `no-model`,
// `model-error` und `model-timeout` — jede dieser Ursachen setzt voraus, dass die Cloud ERLAUBT
// war und nur an der Einstufung bzw. der Zuordnung scheiterte. Die drei Fälle ohne Modell
// (`new Reasoner()`) bekommen keine Freigabe: dort ist kein öffentlicher Anbieter verdrahtet.
import { erteileKiFreigabe, mitKiFreigabe } from "./testhelfer-ki-freigabe";
import type { ReasonerTaskConfig } from "./types";

// WP-SHIP9-S2 (bens Folgeschnitt B4): die in Slice 1 für groupCandidates etablierte Ursachen-
// Harmonisierung auf structure/describe/deriveImportCriteria übertragen. Kernvertrag:
//  - Ursache "confidential" NUR über den taskbezogenen Helfer cloudExcludedByConfidentiality
//    (Cloud konfiguriert UND Task-Policy cloud-geeignet, aber die Cloud-Kante wegen vertraulichem
//    Text entfernt und kein lokales Modell sprang ein) — NIE ein globales usingAnyModel().
//  - deterministic/local-ohne-Modell/Policy-Ladefehler dürfen NIE als "confidential" erscheinen.
//  - lokaler Timeout/Fehler behält seine Klasse (model-timeout/model-error).
//  - die Cloud wird bei vertraulichem Text NIE aufgerufen (Cloud-Spy zählt 0).

// Cloud-Spy-Client: zählt JEDEN Aufruf (complete/completeVision). Bei vertraulichem Text darf er
// nie erreicht werden — die Provider-Kette nimmt ihn heraus, bevor irgendetwas egress geht.
function cloudSpyClient(): { client: ModelClient; calls: () => number } {
  let calls = 0;
  const client: ModelClient = {
    name: "cloud:spy",
    complete: async () => {
      calls += 1;
      return '{"title":"t","statement":"s","conditions":[],"measures":[],"tags":[],"confidence":1}';
    },
    completeVision: async () => {
      calls += 1;
      return "Ein Bild.";
    },
  };
  return { client, calls: () => calls };
}

// Lokaler Modell-Client, der wirft — für „lokaler Timeout/Fehler behält Klasse".
function throwingClient(message: string): ModelClient {
  return {
    name: "local:kaputt",
    complete: async () => {
      throw new Error(message);
    },
    completeVision: async () => {
      throw new Error(message);
    },
  };
}

// Policy-Repo, dessen get() wirft → loadPersistedPolicy fällt fail-closed auf deterministic
// (source "load-error"). Ein Ladefehler ist KEINE Vertraulichkeitsblockade.
const failingPolicyRepo: ReasonerPolicyRepo = {
  get: async () => {
    throw new Error("DB weg");
  },
  set: async () => undefined,
};

const DETERMINISTIC: ReasonerTaskConfig = { global: "deterministic", perTask: {} };

describe("WP-SHIP9-S2: structure — confidential-Harmonisierung", () => {
  it("vertraulich + Cloud konfiguriert (auto) → fallbackReason confidential, Cloud-Spy 0", async () => {
    const { client, calls } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    // SPERRFALL MIT GRUNDFREIGABE: `calls()` bleibt 0 wegen der EINSTUFUNG, nicht wegen einer
    // fehlenden Adminfreigabe. Die Freigabe für VERTRAULICHES bleibt in allen Fällen dieser Datei ungesetzt.
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.structure("Geheimer Text.", "de", true);
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("confidential");
    expect(calls()).toBe(0); // die Cloud wurde NIE erreicht
  });

  it("nicht vertraulich + Cloud konfiguriert → echtes Modell-Ergebnis (kein Fallback)", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.structure("Öffentlicher Text.", "de", false);
    expect(res.demo).toBe(false);
    expect(res.fallbackReason).toBeUndefined();
  });

  it("deterministisch gestellt + vertraulich → no-model, NICHT confidential", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "auto", perTask: { structure: "deterministic" } }),
    );
    const res = await reasoner.structure("Geheimer Text.", "de", true);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("local-Policy ohne lokales Modell + vertraulich → no-model, NICHT confidential", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "auto", perTask: { structure: "local" } }),
    );
    const res = await reasoner.structure("Geheimer Text.", "de", true);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("Policy-Ladefehler (fail-closed deterministic) + vertraulich → no-model, NICHT confidential", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(
      new ModelProvider(client),
      undefined,
      undefined,
      undefined,
      undefined,
      failingPolicyRepo,
    );
    const loaded = await reasoner.loadPersistedPolicy();
    expect(loaded.source).toBe("load-error");
    // NACH dem Laden: `loadPersistedPolicy` schreibt die wirksame Zuordnung neu, eine vorher
    // gesetzte Freigabe wäre wirkungslos. So bleibt die Ursache die fail-closed Policy.
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.structure("Geheimer Text.", "de", true);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("vertraulich + lokales Modell wirft Timeout → model-timeout (behält Klasse)", async () => {
    const { client: cloud, calls } = cloudSpyClient();
    const reasoner = new Reasoner(
      new ModelProvider(cloud),
      undefined,
      undefined,
      undefined,
      new ModelProvider(throwingClient("Zeitlimit überschritten")),
    );
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.structure("Geheimer Text.", "de", true);
    expect(res.fallbackReason).toBe("model-timeout");
    expect(calls()).toBe(0); // Cloud bleibt trotz lokalem Versuch aussen vor
  });

  it("vertraulich + lokales Modell wirft HTTP-Fehler → model-error", async () => {
    const { client: cloud } = cloudSpyClient();
    const reasoner = new Reasoner(
      new ModelProvider(cloud),
      undefined,
      undefined,
      undefined,
      new ModelProvider(throwingClient("Modell-API antwortete mit 500")),
    );
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.structure("Geheimer Text.", "de", true);
    expect(res.fallbackReason).toBe("model-error");
  });

  it("ohne Modell + nicht vertraulich → no-model (alte Darstellung unverändert)", async () => {
    const reasoner = new Reasoner();
    const res = await reasoner.structure("Text.", "de", false);
    expect(res.fallbackReason).toBe("no-model");
  });
});

describe("WP-SHIP9-S2: describeImage — confidential-Harmonisierung", () => {
  const IMG = "data:image/png;base64,AAAA";

  it("vertraulich + Cloud-Vision konfiguriert → confidential, Vision-Spy 0", async () => {
    const { client, calls } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    // SPERRFALL MIT GRUNDFREIGABE, wie oben bei `structure`.
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.describeImage(IMG, "de", true);
    expect(res.demo).toBe(true);
    expect(res.text).toBeNull();
    expect(res.fallbackReason).toBe("confidential");
    expect(calls()).toBe(0);
  });

  it("ohne Modell + nicht vertraulich → no-model (alte Darstellung unverändert)", async () => {
    const reasoner = new Reasoner();
    const res = await reasoner.describeImage(IMG, "de", false);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("vertraulich + lokales Modell wirft → model-error (behält Klasse)", async () => {
    const { client: cloud, calls } = cloudSpyClient();
    const reasoner = new Reasoner(
      new ModelProvider(cloud),
      undefined,
      undefined,
      undefined,
      new ModelProvider(throwingClient("Modell-API antwortete mit 500")),
    );
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.describeImage(IMG, "de", true);
    expect(res.fallbackReason).toBe("model-error");
    expect(calls()).toBe(0);
  });

  it("deterministisch + vertraulich → no-model, NICHT confidential", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client), undefined, undefined, undefined);
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "deterministic", perTask: {} }));
    const res = await reasoner.describeImage(IMG, "de", true);
    expect(res.fallbackReason).toBe("no-model");
  });
});

describe("WP-SHIP9-S2: deriveImportCriteria — confidential-Harmonisierung", () => {
  it("vertraulich + Cloud konfiguriert (auto) → confidential, completeRaw-Spy 0", async () => {
    const { client, calls } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    // SPERRFALL MIT GRUNDFREIGABE, wie oben bei `structure`.
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.deriveImportCriteria("finde alles zu Pumpen", "de", true);
    expect(res.criteria).toBeNull();
    expect(res.fallbackReason).toBe("confidential");
    expect(calls()).toBe(0);
  });

  it("nicht vertraulich + Cloud konfiguriert → Modell liefert Kriterien", async () => {
    const client: ModelClient = {
      name: "cloud:json",
      complete: async () =>
        '{"themes":["Pumpen"],"keywords":[],"authors":[],"yearFrom":null,"yearTo":null}',
    };
    const reasoner = new Reasoner(new ModelProvider(client));
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.deriveImportCriteria("finde alles zu Pumpen", "de", false);
    expect(res.fallbackReason).toBeNull();
    expect(res.criteria).not.toBeNull();
  });

  it("ohne Modell → no-model (alte Darstellung unverändert)", async () => {
    const reasoner = new Reasoner();
    const res = await reasoner.deriveImportCriteria("egal", "de", false);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("deterministisch (select) + vertraulich → no-model, NICHT confidential", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "auto", perTask: { select: "deterministic" } }),
    );
    const res = await reasoner.deriveImportCriteria("egal", "de", true);
    expect(res.fallbackReason).toBe("no-model");
  });

  it("leerer Prompt → kein Ausfall (fallbackReason null), auch vertraulich", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(new ModelProvider(client));
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.deriveImportCriteria("   ", "de", true);
    expect(res.fallbackReason).toBeNull();
    expect(res.criteria).toBeNull();
  });

  it("Policy-Ladefehler (fail-closed deterministic) + vertraulich → no-model", async () => {
    const { client } = cloudSpyClient();
    const reasoner = new Reasoner(
      new ModelProvider(client),
      undefined,
      undefined,
      undefined,
      undefined,
      failingPolicyRepo,
    );
    await reasoner.loadPersistedPolicy();
    await erteileKiFreigabe(reasoner);
    const res = await reasoner.deriveImportCriteria("egal", "de", true);
    expect(res.fallbackReason).toBe("no-model");
  });
});

// Sicherheitsnetz: DETERMINISTIC ist ein gültiger Policy-Wert (kein toter Import).
describe("WP-SHIP9-S2: Policy-Konstanten", () => {
  it("deterministic-Policy ist wohlgeformt", () => {
    expect(DETERMINISTIC.global).toBe("deterministic");
  });
});
