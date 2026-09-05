// ================================================================================================
// JOB 3074 · V4 — DER CLOUD-WRAPPER DARF DEN VERBRAUCHSWEG NICHT ABSCHNEIDEN.
// ================================================================================================
//
// `cappedModelClient` baut ein NEUES Objekt und kopiert nur ausgewählte Felder
// (`model-concurrency.ts:213-256`). Genau daran ging in JOB 3036 der Modellname verloren: eine Probe
// am rohen Client war grün, während das Produkt — das ausschließlich den gewrappten Client nach
// außen gibt — den Wert nicht mehr sah. Dieser Fall hält fest, dass der Verbrauch denselben Ausgang
// nimmt: derselbe Aufruf, einmal DURCH den Wrapper und einmal direkt, landet in derselben Spur mit
// demselben Wert.
import { describe, expect, it } from "vitest";
import { anthropicClient } from "../../services/reasoner/src/model-client";
import {
  type ModellAufrufSpur,
  cappedModelClient,
  mitModellAufrufSpur,
} from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { alsAntwort, cloudKoerper } from "./hilfe";

const USAGE = { input_tokens: 11, output_tokens: 5 };

function rohClient(): ModelClient {
  return anthropicClient({
    apiKey: "test-schluessel-nur-hier",
    model: "claude-sonnet-4-6",
    fetchFn: (async () => alsAntwort(cloudKoerper("Antwort.", USAGE))) as unknown as typeof fetch,
  });
}

async function verbrauchEinesAufrufs(client: ModelClient): Promise<ModellAufrufSpur> {
  const spur: ModellAufrufSpur = { gerufen: false };
  await mitModellAufrufSpur(spur, () => client.complete("system", "user", false));
  return spur;
}

describe("JOB 3074 V4: durch den Wrapper kommt derselbe Verbrauch an wie ohne ihn", () => {
  it("V4 · gewrappt und direkt liefern denselben Wert in der Spur", async () => {
    const direkt = await verbrauchEinesAufrufs(rohClient());
    const gewrappt = await verbrauchEinesAufrufs(
      cappedModelClient(rohClient(), { rejectsConfidential: true }),
    );

    const erwartet = { eingabeToken: 11, ausgabeToken: 5, gemeldeteAufrufe: 1 };
    expect(direkt.verbrauch, "der rohe Client meldet den Verbrauch").toEqual(erwartet);
    expect(gewrappt.verbrauch, "der Wrapper darf ihn nicht verlieren").toEqual(erwartet);
    expect(gewrappt.gerufen).toBe(true);
  });

  it("V4b · ohne laufende Spur wirft nichts (Probe, completeRaw, direkte Client-Nutzung)", async () => {
    await expect(
      cappedModelClient(rohClient(), { rejectsConfidential: false }).complete("s", "u", false),
    ).resolves.toBe("Antwort.");
  });
});
