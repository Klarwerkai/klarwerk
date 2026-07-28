// ================================================================================================
// AUFTRAG-mega32 BLOCK E (bens neunter Fund, Pedis Entscheidung 27.07.)
// ================================================================================================
//
// DER BEFUND. `sourcesConflicted` leitete sich allein aus BEREITS BEKANNTEN Konflikten ab; dieser
// Wert steuerte den Antwortvertrag, und Hinweis wie Konflikt-Plaketten erschienen nur bei bekannten
// Treffern. Bei gedeckelter oder unvollständiger Erkennung konnte eine Antwort damit als GESICHERT
// erscheinen, obwohl unbekannte Konflikte nicht ausgeschlossen sind.
//
// Das ist die Kernausgabe des Produkts. „Beweispflicht statt Plausibilität" muss sich genau dort
// beweisen — und tat es nicht.
//
// PEDIS ENTSCHEIDUNG. Der Antwortvertrag darf Sicherheit nur behaupten, wenn JEDE herangezogene
// Quelle einen vollständig belegten Lauf hat — vollständig im Sinne der Invariante aus BLOCK A.
// Sonst eine Stufe darunter, mit sichtbarem Prüfvorbehalt, der benennt, worauf er sich bezieht.
import { describe, expect, it } from "vitest";
import type { AiCheckCoverage, Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerGrade } from "../../apps/web/src/lib/answerGrade";
import { answerCheckCaveat, answerContract } from "../../apps/web/src/lib/askAnswerContract";
import { answerCheckState, conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";

// Ein BELEGT vollständiger Lauf nach der Invariante aus BLOCK A.
const PROVEN: AiCheckCoverage = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};

// GENAU BENS FALL: der Lauf meldet „done", nichts ist übersprungen, nichts abgebrochen — aber
// gedeckelt. Gegen 20 von 12.479 geprüft. Vor mega32 trug dieser Lauf ein „gesichert".
const CAPPED: AiCheckCoverage = {
  available: 12479,
  selected: 20,
  alreadyOpen: 0,
  attempted: 20,
  completed: 20,
  skipped: 0,
  capped: true,
  aborted: false,
};

// `requestedAt` gehoert zum aiCheck-Vertrag und wird hier nur der Vollstaendigkeit halber gesetzt —
// die Blockaussage haengt an `status` und `coverage`.
function check(
  over: Omit<NonNullable<KnowledgeObject["aiCheck"]>, "requestedAt">,
): NonNullable<KnowledgeObject["aiCheck"]> {
  return { requestedAt: "2026-01-01T00:00:00.000Z", ...over };
}

function ko(id: string, aiCheck?: KnowledgeObject["aiCheck"]): KnowledgeObject {
  return {
    id,
    title: `KO ${id}`,
    statement: "Aussage",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...(aiCheck ? { aiCheck } : {}),
  } as unknown as KnowledgeObject;
}

const NO_CONFLICTS: readonly Conflict[] = [];

describe("mega32 E · ohne belegten Lauf entsteht kein „gesichert“ mehr", () => {
  it("DER BEFUND, reproduziert: gedeckelte Quelle, keine bekannten Konflikte, Klasse gesichert", () => {
    const kos = [ko("k1", check({ status: "done", coverage: CAPPED }))];
    const sources = conflictAwareSourceRefs(["k1"], kos, NO_CONFLICTS);

    // Es ist wirklich der harmlose Fall: kein bekannter Konflikt, validiertes KO, „gesichert".
    expect(sources[0]?.conflictLimited).toBe(false);
    expect(sources[0]?.validated).toBe(true);

    // Vor mega32 hätte GENAU DIESE Eingabe `verified` ergeben — der Vertrag kannte die dritte
    // Bedingung nicht. Seit mega33 A3 lässt sie sich nicht mehr weglassen; das alte Verhalten
    // entsteht nur noch, wenn ein Aufrufer die Abdeckung AUSDRÜCKLICH als belegt behauptet.
    const vorher = answerContract(
      answerGrade({
        answered: true,
        knowledgeClass: "gesichert",
        sourcesConflicted: false,
        sourcesCheckUnproven: false,
        conflictsUnproven: false,
      }),
    );
    expect(vorher.kind).toBe("verified");

    // Jetzt fällt er eine Stufe herunter, weil die Erkennung nicht vollständig belegt ist.
    const caveat = answerCheckCaveat(sources);
    expect(caveat).not.toBeNull();
    const nachher = answerContract(
      answerGrade({
        answered: true,
        knowledgeClass: "gesichert",
        sourcesConflicted: false,
        sourcesCheckUnproven: caveat !== null,
        conflictsUnproven: false,
      }),
    );
    expect(nachher.kind).toBe("unverified");
  });

  it("JEDE Quelle muss belegt sein — eine einzige unbelegte genügt", () => {
    const kos = [
      ko("k1", check({ status: "done", coverage: PROVEN })),
      ko("k2", check({ status: "done", coverage: PROVEN })),
      ko("k3", check({ status: "done", coverage: CAPPED })),
    ];
    const alleBelegt = conflictAwareSourceRefs(["k1", "k2"], kos, NO_CONFLICTS);
    expect(answerCheckCaveat(alleBelegt)).toBeNull();
    expect(
      answerContract(
        answerGrade({
          answered: true,
          knowledgeClass: "gesichert",
          sourcesConflicted: false,
          sourcesCheckUnproven: answerCheckCaveat(alleBelegt) !== null,
          conflictsUnproven: false,
        }),
      ).kind,
    ).toBe("verified");

    const eineUnbelegt = conflictAwareSourceRefs(["k1", "k2", "k3"], kos, NO_CONFLICTS);
    const caveat = answerCheckCaveat(eineUnbelegt);
    expect(caveat).toEqual({ reason: "incomplete", unproven: 1, total: 3 });
    expect(
      answerContract(
        answerGrade({
          answered: true,
          knowledgeClass: "gesichert",
          sourcesConflicted: false,
          sourcesCheckUnproven: true,
          conflictsUnproven: false,
        }),
      ).kind,
    ).toBe("unverified");
  });

  it("DER VORBEHALT BENENNT, WORAUF ER SICH BEZIEHT: Anzahl, Gesamtzahl und Ursache", () => {
    const kos = [
      ko("k1", check({ status: "done", coverage: PROVEN })),
      ko("k2", check({ status: "done", coverage: CAPPED })),
      ko("k3"), // gar kein Prüf-Lauf vermerkt
    ];
    const sources = conflictAwareSourceRefs(["k1", "k2", "k3"], kos, NO_CONFLICTS);
    const caveat = answerCheckCaveat(sources);

    expect(caveat?.unproven).toBe(2);
    expect(caveat?.total).toBe(3);
    // Der SCHWERSTE Zustand regiert den Text — „gar kein Lauf" wiegt schwerer als „Lauf mit Lücke".
    expect(caveat?.reason).toBe("unchecked");
  });

  it("die vier Zustände sind dieselben wie in der serverseitigen Zusammenfassung", () => {
    expect(answerCheckState(undefined)).toBe("unknown");
    expect(answerCheckState(ko("a"))).toBe("unchecked");
    expect(answerCheckState(ko("a", check({ status: "pending" })))).toBe("incomplete");
    // bens ROT-2 aus mega31, hier noch einmal: ein GESCHEITERTER Lauf mit makellosem Protokoll.
    expect(answerCheckState(ko("a", check({ status: "failed", coverage: PROVEN })))).toBe(
      "incomplete",
    );
    expect(answerCheckState(ko("a", check({ status: "done" })))).toBe("noCoverage");
    expect(answerCheckState(ko("a", check({ status: "done", coverage: CAPPED })))).toBe(
      "incomplete",
    );
    expect(answerCheckState(ko("a", check({ status: "done", coverage: PROVEN })))).toBe("proven");
  });

  it("A1-KOPPLUNG: widersprüchliche Zahlen bei sauberen Merkern tragen kein „gesichert“", () => {
    // Merker makellos, aber `completed < attempted`. Genau der Datensatz aus BLOCK A2.
    const widerspruch: AiCheckCoverage = { ...PROVEN, completed: 3 };
    expect(answerCheckState(ko("a", check({ status: "done", coverage: widerspruch })))).toBe(
      "incomplete",
    );
  });

  it("kein Dauerrauschen: bei durchgehend belegten Läufen schweigt der Vorbehalt", () => {
    const kos = [ko("k1", check({ status: "done", coverage: PROVEN }))];
    const sources = conflictAwareSourceRefs(["k1"], kos, NO_CONFLICTS);
    expect(sources[0]?.checkState).toBe("proven");
    expect(answerCheckCaveat(sources)).toBeNull();
  });

  it("eine unbeantwortete Frage bleibt Wissenslücke — der Vorbehalt kippt sie nicht", () => {
    expect(
      answerContract(
        answerGrade({
          answered: false,
          knowledgeClass: "unbekannt",
          sourcesConflicted: false,
          sourcesCheckUnproven: true,
          conflictsUnproven: false,
        }),
      ).kind,
    ).toBe("gap");
  });

  it("der bekannte Konfliktweg bleibt unverändert wirksam (kein Rückschritt)", () => {
    expect(
      answerContract(
        answerGrade({
          answered: true,
          knowledgeClass: "gesichert",
          sourcesConflicted: true,
          sourcesCheckUnproven: false,
          conflictsUnproven: false,
        }),
      ).kind,
    ).toBe("unverified");
  });
});
