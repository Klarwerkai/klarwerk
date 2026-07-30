// ================================================================================================
// AUFTRAG-mega67 BLOCK G — DIE SERVERSEITIGE AUSKUNFT HINTER DEM KOSTENHINWEIS.
// ================================================================================================
//
// Der Auftrag nannte `/api/ai-status` als vorhandene Quelle für „Zustand UND Betriebsart je
// Aufgabe". Der Zustand war da (`tasks`), die BETRIEBSART je Aufgabe NICHT — s. BERICHT-mega67.
// Diese Datei pinnt die neu gebaute Auskunft `billable` und vor allem ihre ABGRENZUNG gegen die
// beiden Felder, die man fälschlich dafür halten könnte:
//
//   `tasks[t]`  = NUTZBARKEIT. Auch das kostenlose LOKALE Modell erfüllt sie.
//   `mode`      = die HAUSWEITE Stufe. Sagt nichts über die Kette DIESER Aufgabe.
//
// Jeder Fall unten prüft deshalb `billable` GEGEN mindestens eines der beiden — ein Test, der nur
// „billable ist true, wenn Cloud verdrahtet ist" zeigte, wäre auch mit `mode` als Quelle grün
// gewesen und hätte den eigentlichen Fehler nicht sehen können.
import { describe, expect, it } from "vitest";
import type { ReasonerProvider } from "../../services/reasoner/src/provider";
import { Reasoner } from "../../services/reasoner/src/service";

function modelProvider(name: string, probe: () => Promise<unknown>): ReasonerProvider {
  return { name, isAvailable: () => true, probe } as unknown as ReasonerProvider;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const OK = async (): Promise<string> => "OK";
const DOWN = async (): Promise<never> => {
  throw new Error("down");
};

describe("mega67 G · billable je Aufgabe — kostet dieser Klick wirklich etwas?", () => {
  it("gar kein Modell → nichts ist kostenpflichtig", () => {
    const pub = new Reasoner().publicStatus();
    expect(Object.values(pub.billable).every((v) => v === false)).toBe(true);
    expect(pub.mode).toBe("deterministic");
  });

  it("nur das LOKALE Modell verdrahtet → nutzbar, aber KOSTENLOS", () => {
    // Der Fall, den `tasks` allein nicht von „kostet" unterscheiden kann.
    const r = new Reasoner(undefined, undefined, undefined, undefined, modelProvider("local", OK));
    const pub = r.publicStatus();
    expect(pub.mode).toBe("local");
    expect(pub.tasks.structure).toBe(true); // nutzbar …
    expect(pub.billable.structure).toBe(false); // … aber nicht kostenpflichtig
  });

  it("Cloud verdrahtet → kostenpflichtig", () => {
    const pub = new Reasoner(modelProvider("cloud", OK)).publicStatus();
    expect(pub.mode).toBe("cloud");
    expect(pub.billable.structure).toBe(true);
  });

  // DER FALL, DER `mode` ALS QUELLE AUSSCHLIESST. mode bleibt "cloud" (die Cloud IST verdrahtet),
  // aber `structure` ist ausdrücklich lokal gestellt — dieser Klick kostet nichts.
  it("mode=cloud, aber DIESE Aufgabe ausdrücklich lokal gestellt → nicht kostenpflichtig", async () => {
    const r = new Reasoner(
      modelProvider("cloud", OK),
      undefined,
      undefined,
      undefined,
      modelProvider("local", OK),
    );
    await r.setTaskConfig({ global: "auto", perTask: { structure: "local" } });
    const pub = r.publicStatus();
    expect(pub.mode).toBe("cloud"); // die hausweite Stufe sagt weiter „cloud" …
    expect(pub.tasks.structure).toBe(true); // … und die Aufgabe ist nutzbar …
    expect(pub.billable.structure).toBe(false); // … kostet aber nichts.
    // Gegenprobe in derselben Installation: eine auto-Aufgabe nimmt die Cloud zuerst → kostet.
    expect(pub.billable.answer).toBe(true);
  });

  it("Aufgabe deterministisch gestellt → nicht kostenpflichtig", async () => {
    const r = new Reasoner(modelProvider("cloud", OK));
    await r.setTaskConfig({ global: "auto", perTask: { extract: "deterministic" } });
    const pub = r.publicStatus();
    expect(pub.billable.extract).toBe(false);
    expect(pub.billable.answer).toBe(true);
  });

  // Erreichbarkeit zählt mit: fällt der Lauf mangels erreichbarer Cloud auf lokal/deterministisch
  // durch, kostet der Klick nichts — der Satz wäre sonst wieder eine falsche Tatsachenaussage.
  it("Cloud verdrahtet, aber zuletzt UNERREICHBAR → nicht kostenpflichtig", async () => {
    const r = new Reasoner(modelProvider("cloud", DOWN));
    r.refreshReachabilityIfStale();
    await flush();
    const pub = r.publicStatus();
    expect(pub.reachable).toBe("unreachable");
    expect(pub.billable.structure).toBe(false);
  });

  // Startfall, spiegelbildlich zu `tasks`: „unverified" (noch kein Probe) zählt als erreichbar —
  // sonst behauptete die Oberfläche direkt nach dem Start „kostenlos", was sie nicht weiß.
  it("Cloud verdrahtet, noch kein Probe (unverified) → kostenpflichtig", () => {
    const pub = new Reasoner(modelProvider("cloud", OK)).publicStatus();
    expect(pub.reachable).toBe("unverified");
    expect(pub.billable.structure).toBe(true);
  });
});
