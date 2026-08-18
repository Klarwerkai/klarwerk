// JOB 615 · D7 — DER ÖFFENTLICHE AUFGABENVERTRAG, VON DER QUELLE BIS ZUM VERBRAUCHER.
//
// DER BEFUND, den BEN zu D6 offenließ (BEN-PRUEFUNG-JOB-615-D6.md §2 „EINE ABGELEITETE
// AUFGABENMENGE: verletzt"): Es gab drei Aufgabenbeschreibungen für denselben Begriff —
// `REASONER_TASKS` (acht Werte), eine handschriftliche `ReasonerTask`-Union in
// `services/reasoner/src/types.ts` (acht Werte) und eine zweite in `apps/web/src/api/types.ts`
// (SIEBEN Werte, `group` fehlt). Ein Aufgabenname konnte serverseitig gültig und in der Oberfläche
// unbekannt sein, ohne dass irgendetwas rot wurde.
//
// WARUM DIE OBERFLÄCHE NICHT EINFACH AUS `services/` IMPORTIERT — die Antwort steht im Bestand:
// `tests/capture/draft-limits-shared.test.ts` („AUFTRAG-mega8 Block A: der Produktcode der
// Oberfläche kennt services/ nicht") verbietet genau das, weil der webbuild-Stage im Dockerfile NUR
// `apps/web` kopiert; ein solcher Import bricht den Produktions-Build. `tools/build` benennt
// dieselbe Grenze. Der Bestand hat dieses Problem für `DRAFT_LIMITS` bereits gelöst: beide Seiten
// halten die Werte selbst, und ein Wächtertest vergleicht sie Wert für Wert. Dieser Test tritt für
// die Aufgabenliste an genau dieselbe Stelle — er IST der Ersatz für den verbotenen Import.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deriveAiAvailable, deriveAiBillable } from "../../apps/web/src/lib/aiAvailability";
import { REASONER_TASKS } from "../../services/reasoner/src/service";
import type { ReasonerTask, ReasonerTaskMap } from "../../services/reasoner/src/types";

const WEB_TYPES = join(__dirname, "../../apps/web/src/api/types.ts");
const SERVER_TYPES = join(__dirname, "../../services/reasoner/src/types.ts");
const SERVER_SERVICE = join(__dirname, "../../services/reasoner/src/service.ts");

/**
 * Liest die Aufgabenliste, die eine Datei als `as const`-Array unter einem gegebenen Namen führt.
 * Bewusst über den Quelltext und nicht über einen Import: die Oberfläche darf nicht aus `services/`
 * importieren (s. Kopf), und ein Textvergleich sieht auch eine Liste, die niemand mehr benutzt.
 */
function listeAusQuelltext(datei: string, name: string): string[] {
  const text = readFileSync(datei, "utf8");
  const treffer = new RegExp(`${name}\\s*=\\s*\\[([^\\]]*)\\]\\s*as const`).exec(text);
  if (!treffer?.[1]) {
    return [];
  }
  return [...treffer[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1] as string);
}

/** Jede handschriftliche `type X = "a" | "b" | …`-Union in einer Datei — die Driftquelle. */
function handschriftlicheUnionen(datei: string): string[][] {
  const text = readFileSync(datei, "utf8");
  const unionen: string[][] = [];
  for (const m of text.matchAll(
    /export type ReasonerTask\b[^=]*=\s*((?:\s*\|\s*"[a-z]+")+)\s*;/g,
  )) {
    unionen.push([...(m[1] as string).matchAll(/"([a-z]+)"/g)].map((x) => x[1] as string));
  }
  return unionen;
}

describe("JOB 615 · Auflage 2 — eine einzige Aufgabenquelle, keine zweite Liste", () => {
  it("die Quelle liegt in services/reasoner/src/types.ts und trägt genau die acht Aufgaben", () => {
    // types.ts ist die abhängigkeitsfreie Basisschicht: service.ts importiert daraus (service.ts:57),
    // nicht umgekehrt. Die Liste kann deshalb nur HIER liegen, ohne einen Zirkelbezug zu erzeugen.
    expect(listeAusQuelltext(SERVER_TYPES, "REASONER_TASKS")).toEqual([
      "structure",
      "assist",
      "interview",
      "answer",
      "select",
      "extract",
      "describe",
      "group",
    ]);
  });

  it("service.ts führt KEINE eigene zweite Liste mehr, sondern reicht die Quelle durch", () => {
    expect(listeAusQuelltext(SERVER_SERVICE, "REASONER_TASKS")).toEqual([]);
  });

  it("die durchgereichte Laufzeitliste ist die Quelle — acht Werte, `group` enthalten", () => {
    expect([...REASONER_TASKS]).toEqual(listeAusQuelltext(SERVER_TYPES, "REASONER_TASKS"));
    expect(REASONER_TASKS).toContain("group");
  });

  it("keine Datei führt `ReasonerTask` noch als handschriftliche Union", () => {
    // Genau diese Form war die Drift: eine Union wandert nicht mit, wenn die Liste wächst.
    expect(handschriftlicheUnionen(SERVER_TYPES)).toEqual([]);
    expect(handschriftlicheUnionen(WEB_TYPES)).toEqual([]);
  });
});

describe("JOB 615 · Auflage 4 — der Wächter über die Modulgrenze", () => {
  // Die Oberfläche hält ihre Liste selbst halten (der Import wäre ein Build-Bruch, s. Kopf).
  // Dieser Block ist der Preis dafür — und er muss rot werden, sobald eine Seite wandert.
  it("Oberfläche und Server tragen exakt dieselben Aufgaben, in derselben Reihenfolge", () => {
    expect(listeAusQuelltext(WEB_TYPES, "REASONER_TASKS")).toEqual([...REASONER_TASKS]);
  });

  it("jede Aufgabe ist beidseitig vorhanden — Schlüssel für Schlüssel benannt", () => {
    // Schlüsselweise statt pauschal: fehlt eine, nennt die Meldung genau sie (Muster aus
    // tests/capture/draft-limits-shared.test.ts).
    const web = listeAusQuelltext(WEB_TYPES, "REASONER_TASKS");
    for (const task of REASONER_TASKS) {
      expect(`${task}=${web.includes(task)}`).toBe(`${task}=true`);
    }
  });

  it("eine zweite, abweichende Taskliste macht diesen Wächter gezielt rot", () => {
    // Die Gegenprobe im Test selbst: genau die Mutation, die der Wächter fangen soll.
    const zweiteListe = [...REASONER_TASKS].filter((t) => t !== "group");
    expect(zweiteListe).not.toEqual([...REASONER_TASKS]);
    expect(() => {
      expect(zweiteListe).toEqual([...REASONER_TASKS]);
    }).toThrow();
  });
});

describe("JOB 615 · Auflage 4 — der Verbrauchercompilervertrag an den echten Funktionen", () => {
  const alleWahr = Object.fromEntries(REASONER_TASKS.map((t) => [t, true])) as Record<
    ReasonerTask,
    boolean
  >;

  it("alle acht Positivwerte sind an deriveAiAvailable zulässig und wirken", () => {
    const status = { active: true, mode: "cloud", reachable: "active", tasks: alleWahr } as const;
    for (const task of REASONER_TASKS) {
      expect(`${task}=${deriveAiAvailable(status, task)}`).toBe(`${task}=true`);
    }
  });

  it("alle acht Positivwerte sind an deriveAiBillable zulässig und wirken", () => {
    for (const task of REASONER_TASKS) {
      expect(`${task}=${deriveAiBillable({ billable: alleWahr }, task)}`).toBe(`${task}=true`);
    }
  });

  it("ein Fremdwert ist am Verbraucher statisch unzulässig", () => {
    const status = { active: true, mode: "cloud", reachable: "active", tasks: alleWahr } as const;
    // @ts-expect-error — ein nicht existierender Aufgabenname darf den Verbraucher nicht erreichen.
    deriveAiAvailable(status, "gibt-es-nicht");
    // @ts-expect-error — dieselbe Grenze für die Kostenableitung, Einzelwert …
    deriveAiBillable({ billable: alleWahr }, "gibt-es-nicht");
    // @ts-expect-error — … und für die Mehrfachform, die AiCostHint benutzt.
    deriveAiBillable({ billable: alleWahr }, ["structure", "gibt-es-nicht"]);
  });

  it("die SERVERKARTE ist geschlossen — ein Fremdschlüssel ist dort ein Typfehler", () => {
    // Ohne diesen Fall bleibt `ReasonerTaskMap` unbewacht: die Karte darf breiter werden
    // (`Record<string, boolean>`), ohne dass irgendetwas rot wird — nachgemessen als
    // Gegenmutation 3, die zunächst NICHT biss. Hier ist die Grenze festgehalten.
    const karte: ReasonerTaskMap = {
      structure: true,
      assist: true,
      interview: true,
      answer: true,
      select: true,
      extract: true,
      describe: true,
      group: true,
    };
    expect(Object.keys(karte).sort()).toEqual([...REASONER_TASKS].sort());
    // @ts-expect-error — die vollständige Serverkarte kennt keinen unbekannten Aufgabennamen.
    const mitFremd: ReasonerTaskMap = { ...karte, gibtEsNicht: true };
    expect(Object.keys(mitFremd)).toContain("gibtEsNicht");
  });

  it("eine unvollständige Serverkarte ist ein Typfehler — publicStatus antwortet immer ganz", () => {
    // Die zweite Hälfte derselben Zusage: `Partial` gilt für den WIRE (alter Server), nicht für
    // die Karte, die dieser Server selbst baut.
    // @ts-expect-error — `group` fehlt; eine Karte ohne alle acht Aufgaben ist unzulässig.
    const luecke: ReasonerTaskMap = {
      structure: true,
      assist: true,
      interview: true,
      answer: true,
      select: true,
      extract: true,
      describe: true,
    };
    expect(Object.keys(luecke)).toHaveLength(7);
  });

  it("eine fehlende Wireantwort bleibt darstellbar (alter Server)", () => {
    // Rückwärtskompatibilität: ohne Karte entscheidet der globale Status, nicht `undefined`.
    const ohneKarte = { active: true, mode: "cloud", reachable: "active" } as const;
    expect(deriveAiAvailable(ohneKarte, "structure")).toBe(true);
    expect(deriveAiBillable({}, "structure")).toBe(false);
  });

  it("eine partielle Wireantwort bleibt darstellbar", () => {
    const teilweise = {
      active: true,
      mode: "cloud",
      reachable: "active",
      tasks: { structure: false },
    } as const;
    expect(deriveAiAvailable(teilweise, "structure")).toBe(false);
    // Nicht genannte Aufgabe → globaler Status, kein stilles Ausgrauen.
    expect(deriveAiAvailable(teilweise, "group")).toBe(true);
  });
});

describe("JOB 615 · Auflage 5 — die vier B35-Fokusfälle entlang der Wirkungskette", () => {
  // Die Kette aus BEN D6 §4: REASONER_TASKS → publicStatus → Wiretyp → Availability-Ableitung →
  // React-Verbraucher. Je Glied ein Fall — das ist die Auslegung der „vier B35-Fokusfälle“
  // (in D5/D6 gefordert, dort nirgends einzeln benannt; s. Rückgabe §Restgrenzen).
  const alleWahr = Object.fromEntries(REASONER_TASKS.map((t) => [t, true])) as Record<
    ReasonerTask,
    boolean
  >;

  it("F1 · Quelle — ein falsch geschriebener Name existiert in der Aufgabenmenge nicht", () => {
    expect([...REASONER_TASKS]).not.toContain("strukture");
    expect(REASONER_TASKS).toHaveLength(8);
  });

  it("F2 · Wire — die Oberfläche kennt jede Aufgabe, die der Server melden kann", () => {
    const web = listeAusQuelltext(WEB_TYPES, "REASONER_TASKS");
    const unbekannt = [...REASONER_TASKS].filter((t) => !web.includes(t));
    expect(unbekannt).toEqual([]);
  });

  it("F3 · Ableitung — `false` graut aus, eine fehlende Karte graut NICHT aus", () => {
    // Der eigentliche Schaden aus dem Urteil: ein Tippfehler wurde zu `undefined` und graute
    // still einen Knopf aus. Beide Zustände müssen unterscheidbar bleiben.
    const gestellt = { active: true, mode: "cloud", reachable: "active", tasks: alleWahr } as const;
    expect(deriveAiAvailable({ ...gestellt, tasks: { group: false } }, "group")).toBe(false);
    expect(deriveAiAvailable({ ...gestellt, tasks: {} }, "group")).toBe(true);
  });

  it("F4 · Verbraucher — unerreichbar schlägt jede Positivkarte, für alle acht Aufgaben", () => {
    const unerreichbar = {
      active: true,
      mode: "cloud",
      reachable: "unreachable",
      tasks: alleWahr,
    } as const;
    for (const task of REASONER_TASKS) {
      expect(`${task}=${deriveAiAvailable(unerreichbar, task)}`).toBe(`${task}=false`);
    }
  });
});

describe("JOB 615 · Auflage 5 — Ubiquität und asynchrone Gegenmutation", () => {
  it("Ubiquität: jede der acht Aufgaben ist an JEDEM öffentlichen Verbraucher belegt", () => {
    // Kein Stichprobenbeleg: acht Aufgaben × zwei öffentliche Ableitungen, vollständig aufgezählt.
    const alleWahr = Object.fromEntries(REASONER_TASKS.map((t) => [t, true])) as Record<
      ReasonerTask,
      boolean
    >;
    const status = { active: true, mode: "cloud", reachable: "active", tasks: alleWahr } as const;
    const belegt: string[] = [];
    for (const task of REASONER_TASKS) {
      if (deriveAiAvailable(status, task) && deriveAiBillable({ billable: alleWahr }, task)) {
        belegt.push(task);
      }
    }
    expect(belegt).toEqual([...REASONER_TASKS]);
  });

  it("asynchrone Gegenmutation: eine nachträglich eintreffende Karte kippt die Aussage", () => {
    // Die Kette ist asynchron (React Query): erst kein Status, dann der echte. Beide Zustände
    // müssen ehrlich sein — „noch nichts da“ darf nicht wie „ausgegraut“ aussehen.
    const spaeter = async (): Promise<{ tasks: Record<string, boolean> }> => ({
      tasks: { group: false },
    });
    return spaeter().then((antwort) => {
      const vorher = deriveAiAvailable(undefined, "group");
      const nachher = deriveAiAvailable(
        { active: true, mode: "cloud", reachable: "active", tasks: antwort.tasks },
        "group",
      );
      expect(vorher).toBe(false);
      expect(nachher).toBe(false);
      // Und die Gegenprobe: dieselbe Kette mit `true` kippt auf verfügbar.
      expect(
        deriveAiAvailable(
          { active: true, mode: "cloud", reachable: "active", tasks: { group: true } },
          "group",
        ),
      ).toBe(true);
    });
  });
});
