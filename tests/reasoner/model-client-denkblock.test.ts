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
import { describe, expect, it } from "vitest";
import { anthropicClient } from "../../services/reasoner/src/model-client";

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
});
