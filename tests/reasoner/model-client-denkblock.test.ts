// Der Antwortleser darf nicht blind Block 0 nehmen.
//
// Vorgeschichte (14.08.2026, Produktionsausfall): `model-client.ts` las die Modellantwort
// als `data.content?.[0]?.text ?? ""`. Denkfaehige Modelle stellen der Antwort einen
// `thinking`-Block voran, der kein `text` traegt — der Client gab dann fuer JEDEN Aufruf
// einen leeren String zurueck. Ein leerer String ist kein gueltiges JSON, `extract`
// meldete `hardFailure`, und der Nutzer las "Ein Teil des Dokuments konnte nicht
// vollstaendig verarbeitet werden", obwohl die API mit 200 geantwortet hatte. Weil
// `extract` und `answer` denselben Client benutzen, fielen Import, Fragenstellen und das
// Word-Add-in gemeinsam aus. Der Request setzt `thinking` nirgends, also entschied allein
// die Modellwahl der Umgebung darueber, ob Block 0 ein Textblock war.
//
// Diese Probe haelt beide Faelle fest: Denkblock voran (Antwort trotzdem lesbar) und der
// unveraenderte Normalfall ohne Denkblock.
//
// R-0778 (Gegenmessung): die Quelle fuehrte den Fix als eingebaut, die zugesagte Gegenmessung
// fehlte. Der zweite Block unten misst deshalb nicht nur den Leser, sondern die gemeinsame
// Wurzel: Import (`extract`), Fragen (`answer`, auch der Weg des Word-Zusatzes) und das
// Interview laufen ueber DENSELBEN Client und muessen mit vorangestelltem Denkblock Ergebnisse
// liefern — kein `hardFailure`, keine leere Antwort.
import { describe, expect, it } from "vitest";
import { anthropicClient } from "../../services/reasoner/src/model-client";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import type { KnowledgeRef } from "../../services/reasoner/src/types";

function clientMitAntwort(content: unknown) {
  const fetchFn = async () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({ content }),
    }) as unknown as Response;
  return anthropicClient({
    apiKey: "test-key",
    model: "test-model",
    fetchFn: fetchFn as unknown as typeof fetch,
  });
}

describe("model-client: Antwortleser nimmt den ersten TEXT-Block", () => {
  it("liest den Text, wenn ein Denkblock vorangestellt ist", async () => {
    const client = clientMitAntwort([
      { type: "thinking", thinking: "" },
      { type: "text", text: '{"points":[]}' },
    ]);
    expect(await client.complete("system", "user", false)).toBe('{"points":[]}');
  });

  it("liest den Text weiterhin, wenn kein Denkblock vorangeht", async () => {
    const client = clientMitAntwort([{ type: "text", text: "schlicht" }]);
    expect(await client.complete("system", "user", false)).toBe("schlicht");
  });

  it("gibt leer zurueck, wenn wirklich kein Textblock kommt", async () => {
    const client = clientMitAntwort([{ type: "thinking", thinking: "" }]);
    expect(await client.complete("system", "user", false)).toBe("");
  });

  it("liest den Text auch hinter einem verdeckten Denkblock (redacted_thinking)", async () => {
    const client = clientMitAntwort([
      { type: "redacted_thinking", data: "verdeckt" },
      { type: "text", text: "lesbar" },
    ]);
    expect(await client.complete("system", "user", false)).toBe("lesbar");
  });

  it("liest den Text aelterer Antwortformen ohne type-Feld", async () => {
    const client = clientMitAntwort([{ text: "ohne Typ" }]);
    expect(await client.complete("system", "user", false)).toBe("ohne Typ");
  });

  it("der Bildweg liest denselben Textblock hinter dem Denkblock", async () => {
    const client = clientMitAntwort([
      { type: "thinking", thinking: "" },
      { type: "text", text: "Ein Typenschild." },
    ]);
    const completeVision = client.completeVision;
    expect(completeVision).toBeTypeOf("function");
    expect(
      await completeVision?.("system", "data:image/png;base64,iVBORw0KGgo=", "user", false),
    ).toBe("Ein Typenschild.");
  });
});

describe("R-0778 Gegenmessung: Import, Fragen und Interview mit denkendem Modell", () => {
  const DENKBLOCK = { type: "thinking", thinking: "" };

  function denkenderProvider(text: string) {
    return new ModelProvider(clientMitAntwort([DENKBLOCK, { type: "text", text }]));
  }

  it("Import (extract) liefert Punkte statt hardFailure", async () => {
    const doc = "Protokoll: Dosierpumpe P2 alle 200 Betriebsstunden mit Fett Typ Z schmieren.";
    const result = await denkenderProvider(
      '{"points":[{"title":"Pumpe P2 schmieren","summary":"s","sourceExcerpt":"alle 200 Betriebsstunden mit Fett Typ Z schmieren"}]}',
    ).extract(doc, "de");
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.title).toBe("Pumpe P2 schmieren");
    expect(result.note).toBeNull();
  });

  it("Fragen (answer) beantwortet aus der zitierten Quelle", async () => {
    const kos: KnowledgeRef[] = [
      {
        id: "ko1",
        title: "Ventil bei Überdruck schließen",
        statement: "Bei Überdruck Ventil X schließen.",
        status: "validiert",
        trust: 90,
      },
    ];
    const result = await denkenderProvider("Bei Überdruck Ventil X schließen [1].").answer(
      "Überdruck Ventil",
      kos,
    );
    expect(result.answered).toBe(true);
    expect(result.citedSources).toEqual(["ko1"]);
  });

  it("Interview uebernimmt die formulierte Frage des Modells", async () => {
    const result = await denkenderProvider("Woran erkennst du den Verschleiss?").interview(
      [],
      "de",
    );
    expect(result.question).toBe("Woran erkennst du den Verschleiss?");
  });
});
