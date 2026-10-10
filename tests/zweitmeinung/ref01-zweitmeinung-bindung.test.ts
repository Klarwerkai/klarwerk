// ================================================================================================
// produkt:20261009:referenzki-quellenbelege (REF-01, Ben nacharbeit-7 K1) — JEDE AUSGEGEBENE ANTWORT
// TRÄGT IHRE EIGENE AUSSAGEBINDUNG.
// ================================================================================================
//
// Die Zweitmeinung liefert zwei Modellantworten aus, die verschiedene Tatsachen behaupten können.
// Gemessen wird am echten `AskService.ask`: Haupt-, erste und zweite Antwort bekommen je ihre eigene
// Bindung aus ihrem eigenen Text und ihren eigenen Quellen; die Bindung der Hauptantwort wird nicht
// auf den abweichenden Text übertragen. Der Reasoner ist ein Doppelgänger (kein Modell, kein Netz);
// Bestand und Zahlen sind fiktiv.
import { describe, expect, it } from "vitest";
import { AskService, InMemoryGapRepo } from "../../services/ask";

const KO_A = {
  id: "ko-a",
  title: "Ventil F3 Temperatur",
  statement: "Am Ventil F3 gilt höchstens 80 °C.",
  status: "validiert",
  trust: 90,
  confidentiality: "intern",
  author: "autor-a",
  originalAuthor: "autor-a",
  version: 3,
  category: "Anlage",
  tags: [],
  sources: [],
};
const KO_B = {
  ...KO_A,
  id: "ko-b",
  statement: "Am Ventil F3 gilt höchstens 85 °C laut Werksnorm.",
  author: "autor-b",
  originalAuthor: "autor-b",
  version: 5,
};

const ERSTE = "Am Ventil F3 gilt höchstens 80 °C. [1]";
const ZWEITE = "Am Ventil F3 gilt höchstens 85 °C laut Werksnorm. [2]";

function dienst(): AskService {
  const koService = {
    findCandidates: async () => [KO_A, KO_B],
    searchProjectionOf: async () => undefined,
  };
  const reasoner = {
    answer: async () => {
      throw new Error("ohne Zweitmeinung nicht erwartet");
    },
    answerMitZweitmeinung: async () => ({
      erste: {
        answered: true,
        answer: ERSTE,
        knowledgeClass: "regel",
        trust: 50,
        sources: ["ko-a", "ko-b"],
        citedSources: ["ko-a"],
        steps: [],
      },
      zweitmeinung: {
        status: "verglichen",
        ersteStufe: "local",
        zweiteStufe: "cloud",
        erste: {
          answered: true,
          answer: ERSTE,
          sources: ["ko-a", "ko-b"],
          citedSources: ["ko-a"],
          demo: false,
        },
        zweite: {
          answered: true,
          answer: ZWEITE,
          sources: ["ko-a", "ko-b"],
          citedSources: ["ko-b"],
          demo: false,
        },
        abweichend: true,
        abweichungen: ["quellen", "zahlen"],
      },
    }),
  };
  return new AskService({
    reasoner: reasoner as never,
    koService: koService as never,
    gaps: new InMemoryGapRepo(),
  });
}

describe("REF-01 · Zweitmeinung: jede ausgegebene Antwort hat ihre eigene Aussagebindung", () => {
  it("erste und zweite Antwort binden je ihren Text an ihre eigenen Quellen und Fassungen", async () => {
    const out = await dienst().ask("Welche Temperatur gilt am Ventil F3?", "nutzer-1", "de", {
      zweitmeinung: true,
    });
    expect(out.zweitmeinung?.status).toBe("verglichen");
    const z = out.zweitmeinungAussagen;
    expect(z, "die Zweitmeinung trägt eigene Bindungen").toBeDefined();

    const stellen = (beleg: typeof out.aussagen | null | undefined) =>
      (beleg?.aussagen ?? []).flatMap((a) => a.teile.flatMap((t) => t.fundstellen));

    // Erste Antwort: Quelle A in ihrer Fassung 3, mit genau ihrem Wortlaut.
    const erste = stellen(z?.erste);
    expect(erste.map((f) => [f.koId, f.koVersion, f.auszug])).toEqual([
      ["ko-a", 3, KO_A.statement],
    ]);
    // Zweite Antwort: Quelle B in ihrer Fassung 5 — NICHT die Bindung der ersten.
    const zweite = stellen(z?.zweite);
    expect(zweite.map((f) => [f.koId, f.koVersion, f.auszug])).toEqual([
      ["ko-b", 5, KO_B.statement],
    ]);
    expect(z?.zweite?.antwortFingerabdruck).not.toBe(z?.erste?.antwortFingerabdruck);
    expect(z?.zweite?.belegFingerabdruck).not.toBe(out.aussagen?.belegFingerabdruck);

    // Die Hauptantwort ist die erste — ihre Bindung bleibt bei Quelle A.
    expect(stellen(out.aussagen).map((f) => f.koId)).toEqual(["ko-a"]);
  });
});
