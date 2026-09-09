// ================================================================================================
// JOB 3366 · T1 / T2 / T5 — DER MASCHINENLESBARE ABBRUCHBEFUND AM ANTWORTVERTRAG.
// ================================================================================================
//
// JOB 3239 hat den Abbruch am HTTP-Chokepoint erkannt und ins Serverlog geschrieben; JOB 3276 R3
// hat ihn als Lauf-Spur (`vermerkeAbbruch` / `mitAbbruchBefund`) auch für den Aufrufer hinterlegt.
// Bis hierher las diese Spur NUR `assistText`. Der Antwortweg (`answer`, `helpAnswer`) und der
// Extraktionsweg (`extract`) reichten das Fragment weiter, ohne irgendwo zu sagen, dass es eines ist.
//
// GEMESSEN WIRD DER FELDWERT, NICHT EIN SATZ IM TEXT (LEHREN.md, JOB 3353 R3). Der Weg läuft durch
// den ECHTEN HTTP-Client (`openAiCompatibleClient` mit injiziertem fetch) — kein Client-Double,
// keine gemockte Meldefunktion: `finish_reason` kommt als Anbieterfeld herein, und was am
// Vertrag herauskommt, ist das Ergebnis des ganzen Wegs.
import { describe, expect, it, vi } from "vitest";
import { openAiCompatibleClient } from "../../services/reasoner/src/model-client";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import type { KnowledgeRef } from "../../services/reasoner/src/types";

// Der Antworttext ist WÖRTLICH ein Satz der Quelle — sonst greift der Deckungsrückfall
// (JOB 2659/3353) und der Modelltext ginge gar nicht erst hinaus. Genau dieser Fall ist der, in
// dem ein Mensch ein Fragment zu sehen bekommt.
const QUELLSATZ = "Das Ventil V4 wird jährlich geprüft.";
const FRAGMENT = `${QUELLSATZ} [1]`;

const QUELLE: KnowledgeRef = {
  id: "ko-1",
  title: "Prüfintervall Ventil V4",
  statement: QUELLSATZ,
  status: "validiert",
  trust: 80,
};

interface Fall {
  content: string;
  finishReason?: string | null;
  budgetFeld?: "max_tokens" | "max_completion_tokens";
}

/** Ein echter Client, dessen fetch genau EINE Anbieterantwort liefert. */
function baueClient(fall: Fall) {
  const anfragen: Record<string, unknown>[] = [];
  const fetchFn: typeof fetch = async (_url, init) => {
    anfragen.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: { content: fall.content },
            ...("finishReason" in fall ? { finish_reason: fall.finishReason } : {}),
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return {
    anfragen,
    client: openAiCompatibleClient({
      baseUrl: "https://anbieter.invalid/v1",
      model: "test-modell",
      apiKey: "synthetischer-test-schluessel",
      bezeichnung: "Testanbieter",
      budgetFeld: fall.budgetFeld ?? "max_completion_tokens",
      fetchFn,
    }),
  };
}

async function frage(fall: Fall) {
  const { client, anfragen } = baueClient(fall);
  const ergebnis = await new ModelProvider(client).answer("Wie oft wird Ventil V4 geprüft?", [
    QUELLE,
  ]);
  return { ergebnis, anfragen };
}

describe("JOB 3366 · T1/T2/T5 · der Abbruchbefund reist als Feld am Antwortvertrag", () => {
  it("T1: finish_reason=length mit Inhalt setzt das Abbruchfeld mit reinen Metadaten", async () => {
    const { ergebnis, anfragen } = await frage({ content: FRAGMENT, finishReason: "length" });
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.abgeschnitten).toEqual({
      finishReason: "length",
      budgetFeld: "max_completion_tokens",
      budget: anfragen[0]?.max_completion_tokens,
      zeichen: FRAGMENT.length,
    });
  });

  it("T1b: das Feld trägt NIE Antwort-, Denk- oder Prompttext und keinen Schlüssel", async () => {
    const { ergebnis } = await frage({ content: FRAGMENT, finishReason: "length" });
    const serialisiert = JSON.stringify(ergebnis.abgeschnitten);
    expect(serialisiert).not.toContain("Ventil");
    expect(serialisiert).not.toContain("synthetischer-test-schluessel");
    expect(serialisiert).not.toContain("Wie oft");
    // Genau die vier vereinbarten Metadatenschlüssel — kein fünfter, der etwas mitschleppt.
    expect(Object.keys(ergebnis.abgeschnitten ?? {}).sort()).toEqual([
      "budget",
      "budgetFeld",
      "finishReason",
      "zeichen",
    ]);
  });

  it("T1c: dasselbe über den Budgetfeld-Zwilling max_tokens — die Zahl heißt, wie sie gesendet wurde", async () => {
    const { ergebnis, anfragen } = await frage({
      content: FRAGMENT,
      finishReason: "length",
      budgetFeld: "max_tokens",
    });
    expect(ergebnis.abgeschnitten?.budgetFeld).toBe("max_tokens");
    expect(ergebnis.abgeschnitten?.budget).toBe(anfragen[0]?.max_tokens);
  });

  it.each([
    ["stop", { content: FRAGMENT, finishReason: "stop" } as Fall],
    ["null", { content: FRAGMENT, finishReason: null } as Fall],
    ["fehlend", { content: FRAGMENT } as Fall],
  ])("T2: finish_reason=%s setzt KEIN Feld — es wird nie erfunden", async (_name, fall) => {
    const { ergebnis } = await frage(fall);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.abgeschnitten).toBeUndefined();
  });

  it("T2b: ein LANGER, an einer Wortgrenze abreißender Text ohne length-Meldung bleibt ohne Feld", async () => {
    // Die naheliegende Halbheit wäre, die Unvollständigkeit aus dem Text zu RATEN (Länge,
    // abgebrochener Satz). Dieser Text sieht abgeschnitten aus und ist es nicht.
    const { ergebnis } = await frage({
      content: `${FRAGMENT} und dann bricht der Satz mitten`,
      finishReason: "stop",
    });
    expect(ergebnis.abgeschnitten).toBeUndefined();
  });

  it("T5: der Antworttext ist auch im Abbruchfall zeichengleich mit dem Modelltext", async () => {
    const { ergebnis } = await frage({ content: FRAGMENT, finishReason: "length" });
    expect(ergebnis.answer).toBe(FRAGMENT);
    expect(ergebnis.answer).not.toContain("abgeschnitten");
    expect(ergebnis.answer).not.toContain("…");
  });

  it("T5b: ohne Abbruch ist die Antwort Zeichen für Zeichen dieselbe wie mit — nur das Feld fehlt", async () => {
    const mit = await frage({ content: FRAGMENT, finishReason: "length" });
    const ohne = await frage({ content: FRAGMENT, finishReason: "stop" });
    expect(mit.ergebnis.answer).toBe(ohne.ergebnis.answer);
    expect({ ...mit.ergebnis, abgeschnitten: undefined }).toEqual({
      ...ohne.ergebnis,
      abgeschnitten: undefined,
    });
  });

  it("T2c: eine Antwort OHNE tragende Quelle trägt kein Feld — es gibt keine Antwort, über die es etwas sagen könnte", async () => {
    const { client } = baueClient({ content: FRAGMENT, finishReason: "length" });
    const ergebnis = await new ModelProvider(client).answer("Frage ohne Kontext", []);
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.abgeschnitten).toBeUndefined();
  });

  it("T2d: verwirft die Deckungsprüfung den Modelltext, trägt der QUELLENWORTLAUT kein Abbruchfeld", async () => {
    // Der Rückfall gibt den Wortlaut der Quelle aus — der ist vollständig. Ein Hinweis „unvollständig"
    // wäre hier eine Falschaussage über einen Text, den das Modell gar nicht geliefert hat.
    const { ergebnis } = await frage({
      content: "Das Ventil wird alle drei Wochen getauscht [1]",
      finishReason: "length",
    });
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.answer).not.toContain("drei Wochen");
    expect(ergebnis.abgeschnitten).toBeUndefined();
  });
});

describe("JOB 3366 · T1/T2 · derselbe Vertrag am Extraktionsweg (Erfassen)", () => {
  const DOKUMENT = "Die Pumpe wird täglich geprüft. Das Ventil bleibt geschlossen.";
  const PUNKTE = JSON.stringify({
    points: [
      {
        title: "Pumpe prüfen",
        summary: "Tägliche Prüfung der Pumpe.",
        sourceExcerpt: "Die Pumpe wird täglich geprüft.",
      },
    ],
  });

  it("T1d: ein am Limit abgeschnittener Extraktionslauf setzt dasselbe Feld", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const { client, anfragen } = baueClient({ content: PUNKTE, finishReason: "length" });
      const ergebnis = await new ModelProvider(client).extract(DOKUMENT);
      expect(ergebnis.points.length).toBeGreaterThan(0);
      expect(ergebnis.abgeschnitten).toEqual({
        finishReason: "length",
        budgetFeld: "max_completion_tokens",
        budget: anfragen[0]?.max_completion_tokens,
        zeichen: PUNKTE.length,
      });
    } finally {
      stderr.mockRestore();
    }
  });

  it("T2e: ein vollständiger Extraktionslauf trägt kein Feld", async () => {
    const { client } = baueClient({ content: PUNKTE, finishReason: "stop" });
    const ergebnis = await new ModelProvider(client).extract(DOKUMENT);
    expect(ergebnis.points.length).toBeGreaterThan(0);
    expect(ergebnis.abgeschnitten).toBeUndefined();
  });
});
