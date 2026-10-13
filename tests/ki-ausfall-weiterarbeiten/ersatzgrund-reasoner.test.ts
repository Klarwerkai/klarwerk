// ================================================================================================
// produkt:20261010:poc-ki-ausfall-weiterarbeiten · PV-03-01 / PV-03-07 — DER ERSATZWEG NENNT SEINE
// TATSÄCHLICHE URSACHE, UND NACH DER ERHOLUNG ANTWORTET WIEDER DAS MODELL.
// ================================================================================================
//
// Isoliert: ein FIKTIVES Modell (kein Netz, kein Schlüssel, keine Kosten) fällt aus und erholt sich.
// Gemessen am echten `Reasoner` mit seiner echten Kette und seinem echten deterministischen Ersatz.
//
//   E1  Klassen: Zeitlimit, Netz, 5xx, 429/402, 401/403/451, Datenschutzsperren, Unbekanntes.
//   E2  Ausfall → Ersatz antwortet, trägt die Ursache — ohne Anbieter, Status, Meldung, Geheimnis.
//   E3  Erholung → dasselbe Modell antwortet wieder, KEINE Ursache an der Antwort.
//   E4  Kein Modell eingerichtet → keine Ursache an der Antwort (das sagt der Status).
//   E5  Kapazitätsgrenze → kein stiller Ersatz, die bestehende Grenze bleibt sichtbar ein Fehler.
//   E6  Zweitmeinungsweg: dieselbe Ursache an der ausgelieferten ersten Antwort.
import { describe, expect, it } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import {
  ConfidentialEgressError,
  ModelCapacityError,
} from "../../services/reasoner/src/model-concurrency";
import {
  ModelHttpError,
  ModelTimeoutError,
  ersatzGrundAus,
} from "../../services/reasoner/src/model-errors";
import { DeterministicProvider, type ReasonerProvider } from "../../services/reasoner/src/provider";
import { Reasoner } from "../../services/reasoner/src/service";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import type { AnswerResult, KnowledgeRef } from "../../services/reasoner/src/types";

// Fiktiver Bestand — kein echter Inhalt.
const KOS: KnowledgeRef[] = [
  {
    id: "ko-fiktiv-1",
    title: "Ventil bei Überdruck schließen",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    status: "validiert",
    trust: 90,
  },
];

// Ein Geheimnis-Stellvertreter in der Fehlermeldung: er darf NIE in der Antwort auftauchen.
const GEHEIM = "sk-fiktiv-GEHEIM-0000";

interface Lage {
  fehler: unknown;
  aufrufe: number;
}

function fiktivesModell(lage: Lage): ReasonerProvider {
  const ersatz = new DeterministicProvider();
  return {
    name: "fiktiv-modell",
    isAvailable: () => true,
    structure: (text, locale) => ersatz.structure(text, locale),
    assistText: (text, locale) => ersatz.assistText(text, locale),
    interview: (antworten, locale) => ersatz.interview(antworten, locale),
    extract: (text, locale) => ersatz.extract(text, locale),
    select: (frage, kandidaten, relevanz) => ersatz.select(frage, kandidaten, relevanz),
    answer: async (_frage, kontext): Promise<AnswerResult> => {
      lage.aufrufe += 1;
      if (lage.fehler !== null) {
        throw lage.fehler;
      }
      const quelle = kontext[0];
      return {
        answered: true,
        answer: "Fiktive Modellantwort [1].",
        knowledgeClass: "gesichert",
        trust: 80,
        sources: quelle ? [quelle.id] : [],
        citedSources: quelle ? [quelle.id] : [],
        steps: [],
        demo: false,
      };
    },
  };
}

async function aufbau(fehler: unknown): Promise<{ reasoner: Reasoner; lage: Lage }> {
  const lage: Lage = { fehler, aufrufe: 0 };
  const reasoner = new Reasoner(fiktivesModell(lage));
  await erteileKiFreigabe(reasoner);
  return { reasoner, lage };
}

describe("E1 · die Ursache wird aus dem Fehler abgeleitet, nie aus Meldungstext an die Fläche", () => {
  it.each([
    ["Zeitlimit", new ModelTimeoutError(`Zeitlimit ${GEHEIM}`, 1000), "zeitueberschreitung"],
    ["Netz", new Error(`fetch failed ${GEHEIM}`), "nicht_erreichbar"],
    ["HTTP 503", new ModelHttpError(`antwortete mit 503 ${GEHEIM}`, 503), "nicht_erreichbar"],
    ["HTTP 429", new ModelHttpError("antwortete mit 429", 429), "kontingent"],
    ["HTTP 402", new ModelHttpError("antwortete mit 402", 402), "kontingent"],
    ["HTTP 401", new ModelHttpError("antwortete mit 401", 401), "verweigert"],
    ["HTTP 403", new ModelHttpError("antwortete mit 403", 403), "verweigert"],
    ["HTTP 451", new ModelHttpError("antwortete mit 451", 451), "verweigert"],
    ["Datenschutzsperre", new ConfidentialEgressError(), "verweigert"],
    ["HTTP 400 ohne bekannte Bedeutung", new ModelHttpError("antwortete mit 400", 400), "fehler"],
    ["unbrauchbare Antwort", new SyntaxError("Unexpected token"), "fehler"],
    ["uneingeordnet", new Error("irgendwas"), "fehler"],
  ])("%s → %s", (_name, fehler, erwartet) => {
    expect(ersatzGrundAus(fehler)).toBe(erwartet);
  });
});

describe("E2/E3 · isolierter Ausfall und Erholung am echten Reasoner", () => {
  it("Ausfall: der Ersatz antwortet mit Ursache; Erholung: das Modell antwortet ohne Ursache", async () => {
    const { reasoner, lage } = await aufbau(new ModelTimeoutError(`Zeitlimit ${GEHEIM}`, 1000));

    const ausfall = await reasoner.answer("Wann Ventil bei Überdruck schließen?", KOS);
    expect(lage.aufrufe, "das Modell wurde nicht versucht").toBe(1);
    expect(ausfall.demo, "der Ersatz hat nicht geantwortet").toBe(true);
    expect(ausfall.ersatzGrund).toBe("zeitueberschreitung");
    // Die Antwort ist weiter quellengebunden — kein leerer Ausfall, kein Erfinden.
    expect(ausfall.answered).toBe(true);
    expect(ausfall.sources).toEqual(["ko-fiktiv-1"]);
    // Keine Meldung, kein Anbietername, kein Geheimnis wandert an die Antwort.
    const draht = JSON.stringify(ausfall);
    expect(draht).not.toContain(GEHEIM);
    expect(draht).not.toContain("fiktiv-modell");
    expect(draht).not.toContain("Zeitlimit");

    // Erholung: derselbe Reasoner, das Modell antwortet wieder.
    lage.fehler = null;
    const erholt = await reasoner.answer("Wann Ventil bei Überdruck schließen?", KOS);
    expect(lage.aufrufe).toBe(2);
    expect(erholt.demo).toBe(false);
    expect(erholt.answer).toBe("Fiktive Modellantwort [1].");
    expect("ersatzGrund" in erholt, "eine Modellantwort trägt eine Ausfallursache").toBe(false);
  });

  it("die Ursache steht auch an einer Lücke (Ersatz findet keine Grundlage)", async () => {
    const { reasoner } = await aufbau(new Error("fetch failed"));
    const luecke = await reasoner.answer("Wie hoch ist der fiktive Wechselkurs?", KOS);
    expect(luecke.answered).toBe(false);
    expect(luecke.ersatzGrund).toBe("nicht_erreichbar");
  });

  it("PV-03-06 · der tatsächlich verwendete Weg bleibt im Laufprotokoll nachvollziehbar", async () => {
    const runs = new InMemoryModelRunRepo();
    const lage: Lage = { fehler: new ModelHttpError("antwortete mit 503", 503), aufrufe: 0 };
    const reasoner = new Reasoner(fiktivesModell(lage), undefined, runs);
    await erteileKiFreigabe(reasoner);
    const ausfall = await reasoner.answer("Wann Ventil bei Überdruck schließen?", KOS);
    expect(ausfall.ersatzGrund).toBe("nicht_erreichbar");
    const [lauf] = await runs.recent(10);
    expect(lauf?.task).toBe("answer");
    // Geantwortet hat der Ersatz — der Datensatz behauptet keinen Modellerfolg …
    expect(lauf?.provider).toBe("deterministic");
    expect(lauf?.demo).toBe(true);
    // … und nennt den gescheiterten Versuch am fiktiven Modell (Fallback über die Kette).
    expect(lauf?.fallback).toBe(true);
    expect(lauf?.error ?? "").toContain("fiktiv-modell");
  });
});

describe("E4 · ohne eingerichtetes Modell sagt die Antwort keine Ausfallursache", () => {
  it("kein Modellversuch → kein Feld", async () => {
    const reasoner = new Reasoner();
    const res = await reasoner.answer("Wann Ventil bei Überdruck schließen?", KOS);
    expect(res.demo).toBe(true);
    expect("ersatzGrund" in res).toBe(false);
  });
});

describe("E5 · die bestehende Kapazitätsgrenze bleibt eine Grenze", () => {
  it("ModelCapacityError fällt nicht still auf den Ersatz, sondern wird durchgereicht", async () => {
    const { reasoner } = await aufbau(new ModelCapacityError("Kapazität erschöpft"));
    const frage = "Wann Ventil bei Überdruck schließen?";
    await expect(reasoner.answer(frage, KOS)).rejects.toBeInstanceOf(ModelCapacityError);
  });
});

describe("E6 · Zweitmeinungsweg", () => {
  it("die ausgelieferte erste Antwort trägt dieselbe Ursache", async () => {
    const { reasoner } = await aufbau(new ModelTimeoutError("Zeitlimit", 1000));
    const frage = "Wann Ventil bei Überdruck schließen?";
    const { erste } = await reasoner.answerMitZweitmeinung(frage, KOS);
    expect(erste.demo).toBe(true);
    expect(erste.ersatzGrund).toBe("zeitueberschreitung");
  });
});
