// D-AISTATE PAKET 2 (Pedi 23.07.): „Reasoner aktiv" = wirklich ERREICHBAR, nicht nur konfiguriert.
// Der leichte, gecachte Erreichbarkeits-Zustand (reachabilityState) unterscheidet none/unverified/
// active/unreachable; publicStatus() trägt ihn mit. Ein echter Hintergrund-Probe (feuern-und-
// vergessen) frischt den Cache auf — kein Ping pro Request (TTL 60 s im Dienst gepinnt).
import { describe, expect, it } from "vitest";
import type { ReasonerProvider } from "../../services/reasoner/src/provider";
import { Reasoner } from "../../services/reasoner/src/service";

// Kompaktes Modell-Provider-Fake: nur isAvailable + probe (mehr braucht der Erreichbarkeits-Pfad nicht).
function modelProvider(probe: () => Promise<unknown>): ReasonerProvider {
  return { name: "fake-model", isAvailable: () => true, probe } as unknown as ReasonerProvider;
}

const flush = async (): Promise<void> => {
  // Dem feuern-und-vergessen-Probe (eine await-Kette) Zeit zum Auflösen geben.
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

describe("PAKET 2: reasonerReachability — Zustandsmaschine", () => {
  it("kein Modell → none (auch publicStatus.reachable)", () => {
    const r = new Reasoner();
    expect(r.reachabilityState()).toBe("none");
    expect(r.publicStatus().reachable).toBe("none");
    expect(r.publicStatus().mode).toBe("deterministic");
  });

  it("Modell konfiguriert, aber noch nicht geprüft → unverified (kein Fake-Grün)", () => {
    const r = new Reasoner(modelProvider(async () => "OK"));
    expect(r.reachabilityState()).toBe("unverified");
    expect(r.publicStatus().reachable).toBe("unverified");
    // active/mode bleiben die Konfigurations-Wahrheit (rückwärtskompatibel).
    expect(r.publicStatus().active).toBe(true);
    expect(r.publicStatus().mode).toBe("cloud");
  });

  it("recordReachability: true → active, false → unreachable", () => {
    const r = new Reasoner(modelProvider(async () => "OK"));
    r.recordReachability(true);
    expect(r.reachabilityState()).toBe("active");
    r.recordReachability(false);
    expect(r.reachabilityState()).toBe("unreachable");
  });

  it("refreshReachabilityIfStale: erreichbares Modell → nach dem Probe active", async () => {
    const r = new Reasoner(modelProvider(async () => "OK"));
    r.refreshReachabilityIfStale();
    await flush();
    expect(r.reachabilityState()).toBe("active");
  });

  it("refreshReachabilityIfStale: nicht erreichbares Modell (probe wirft) → unreachable", async () => {
    const r = new Reasoner(
      modelProvider(async () => {
        throw new Error("401 key expired");
      }),
    );
    r.refreshReachabilityIfStale();
    await flush();
    expect(r.reachabilityState()).toBe("unreachable");
    expect(r.publicStatus().reachable).toBe("unreachable");
  });

  it("gemischte Matrix (bens V4, aistate-fix3): Cloud unerreichbar + Local erreichbar + Task=cloud ⇒ tasks.answer=false", async () => {
    const cloudDown = modelProvider(async () => {
      throw new Error("401 key expired");
    });
    const localUp = modelProvider(async () => "OK");
    const r = new Reasoner(cloudDown, undefined, undefined, undefined, localUp);
    // answer ist AUSDRÜCKLICH auf cloud gestellt; alle anderen Aufgaben bleiben auto (Cloud→Lokal).
    await r.setTaskConfig({ global: "auto", perTask: { answer: "cloud" } });
    r.refreshReachabilityIfStale();
    await flush();
    const pub = r.publicStatus();
    // Global bleibt „irgendein Modell erreichbar" (Badge) — das Local-Modell antwortet.
    expect(pub.reachable).toBe("active");
    // Aber die answer-Task ist NICHT nutzbar: ihre TATSÄCHLICHE Kette enthält nur die (unerreichbare)
    // Cloud — genau bens V4-Fehlsignal, jetzt pro Task ehrlich.
    expect(pub.tasks.answer).toBe(false);
    // Eine auto-Aufgabe fällt in ihrer Kette auf das erreichbare Local-Modell → nutzbar.
    expect(pub.tasks.structure).toBe(true);
  });

  it("beide Kanten unerreichbar ⇒ global unreachable UND alle Modell-Aufgaben false", async () => {
    const down = async (): Promise<never> => {
      throw new Error("down");
    };
    const r = new Reasoner(
      modelProvider(down),
      undefined,
      undefined,
      undefined,
      modelProvider(down),
    );
    r.refreshReachabilityIfStale();
    await flush();
    const pub = r.publicStatus();
    expect(pub.reachable).toBe("unreachable");
    expect(Object.values(pub.tasks).every((v) => v === false)).toBe(true);
  });

  it("Ladefall/Start (noch kein Probe): unverified zählt als nutzbar — Task-Karte graut NICHT vorschnell aus", () => {
    const r = new Reasoner(modelProvider(async () => "OK"));
    expect(r.publicStatus().reachable).toBe("unverified");
    expect(r.publicStatus().tasks.answer).toBe(true);
  });

  it("frischer Cache → kein zweiter Probe (kein Ping pro Request)", async () => {
    let probes = 0;
    const r = new Reasoner(
      modelProvider(async () => {
        probes += 1;
        return "OK";
      }),
    );
    r.refreshReachabilityIfStale();
    await flush();
    expect(probes).toBe(1);
    // Zweiter Abruf innerhalb der Frist → der Cache ist frisch, kein neuer Probe.
    r.refreshReachabilityIfStale();
    await flush();
    expect(probes).toBe(1);
  });
});
