// R-0046: Die Bildbeschreibung wird gegen Fehlverhalten abgesichert — gegen leere, erfundene oder
// abgeschnittene Ergebnisse. Leer und „ohne Modell erfunden" deckt `describe-image.test.ts` schon
// ab; hier stehen die beiden Abbruchwege, die bis zu diesem Auftrag als fertige Fußnote durchgingen:
//   1. der Server-Deckel schnitt blind mitten im Wort oder Satz (`slice(0, 300)`);
//   2. eine am Token-Limit abgerissene Modellantwort kam als vollständiger Vorschlag an.
import { describe, expect, it } from "vitest";
import { MAX_IMAGE_DESCRIPTION_LENGTH, ModelProvider, Reasoner } from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner";
import { anthropicClient } from "../../services/reasoner/src/model-client";
import {
  beschreibungDeckeln,
  mitAbbruchBefund,
  vermerkeAbbruch,
} from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

function visionModell(antwort: () => Promise<string>): ModelClient {
  return { name: "anthropic:test", complete: async () => "", completeVision: antwort };
}

async function beschreibe(client: ModelClient) {
  const reasoner = new Reasoner(new ModelProvider(client));
  await erteileKiFreigabe(reasoner);
  return reasoner.describeImage(PNG_URL, "de");
}

// Eine Antwort der Anthropic Messages API, wie sie der rohe Client sieht — ohne Netz.
function anthropicAntwort(text: string, stopReason: string): typeof fetch {
  return (async () => ({
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text }], stop_reason: stopReason }),
  })) as unknown as typeof fetch;
}

describe("R-0046: der Deckel endet an einer Grenze, nie mitten im Wort", () => {
  it("überlange Antwort mit Sätzen endet am letzten VOLLSTÄNDIGEN Satz innerhalb der Grenze", () => {
    const satz = "Eine Kreiselpumpe mit blauem Gehäuse steht auf einem Prüfstand aus Stahl. ";
    const text = satz.repeat(8).trim();
    const gedeckelt = beschreibungDeckeln(text);
    expect(gedeckelt.length).toBeLessThanOrEqual(MAX_IMAGE_DESCRIPTION_LENGTH);
    expect(gedeckelt.endsWith("Stahl.")).toBe(true);
    expect(text.startsWith(gedeckelt)).toBe(true);
    expect(gedeckelt).not.toContain("…");
  });

  it("ohne Satzende endet er an einer Wortgrenze, und die Kürzung ist sichtbar (…)", () => {
    const text = "Pumpe Ventil Leitung Flansch ".repeat(20).trim();
    const gedeckelt = beschreibungDeckeln(text);
    expect(gedeckelt.length).toBeLessThanOrEqual(MAX_IMAGE_DESCRIPTION_LENGTH);
    expect(gedeckelt.endsWith("…")).toBe(true);
    const ohneZeichen = gedeckelt.slice(0, -1);
    // Jedes Wort im Ergebnis ist ein ganzes Wort des Originals — keines ist angeschnitten.
    for (const wort of ohneZeichen.split(" ")) {
      expect(["Pumpe", "Ventil", "Leitung", "Flansch"]).toContain(wort);
    }
  });

  it('ein Dezimalpunkt ist kein Satzende („P-12.5 mm" bleibt ganz)', () => {
    const text = `Typenschild P-12.5 mm ${"Gehäuse ".repeat(60)}`.trim();
    const gedeckelt = beschreibungDeckeln(text);
    expect(gedeckelt.startsWith("Typenschild P-12.5 mm")).toBe(true);
    expect(gedeckelt.endsWith("…")).toBe(true);
  });

  it("was passt, bleibt byteweise unverändert", () => {
    const text = "Ein Schaltschrank mit geöffneter Tür.";
    expect(beschreibungDeckeln(text)).toBe(text);
  });

  it("am Dienst: eine überlange Modellantwort kommt als ganzer Satz an, nicht als Fragment", async () => {
    const satz = "Ein Förderband mit Kartons läuft durch eine Halle. ";
    const res = await beschreibe(visionModell(async () => satz.repeat(10)));
    expect(res.demo).toBe(false);
    expect(res.text?.endsWith("Halle.")).toBe(true);
    expect(res.text?.length).toBeLessThanOrEqual(MAX_IMAGE_DESCRIPTION_LENGTH);
  });
});

describe("R-0046: eine am Token-Limit abgerissene Antwort wird kein Vorschlag", () => {
  it("vermerkter Abbruch MIT Text → kein Vorschlag, kein Titel, ehrliche Ursache", async () => {
    const res = await beschreibe(
      visionModell(async () => {
        vermerkeAbbruch({
          budgetFeld: "max_tokens",
          budget: 256,
          finishReason: "length",
          zeichen: 40,
        });
        return "Eine Kreiselpumpe mit blauem Gehäuse auf ei";
      }),
    );
    expect(res.text).toBeNull();
    expect(res.demo).toBe(true);
    expect(res.fallbackReason).toBe("model-error");
    expect(res.titelVorschlag).toBeUndefined();
  });

  it("Anthropic-Kante: stop_reason max_tokens auf dem Bildweg wird erkannt und verworfen", async () => {
    const client = anthropicClient({
      apiKey: "test",
      model: "test-modell",
      fetchFn: anthropicAntwort("Eine Kreiselpumpe mit blauem Geh", "max_tokens"),
    });
    const res = await beschreibe(client);
    expect(res.text).toBeNull();
    expect(res.fallbackReason).toBe("model-error");
    expect(res.titelVorschlag).toBeUndefined();
  });

  it("Anthropic-Kante: ein regulär beendeter Bildweg (end_turn) bleibt ein Vorschlag mit Titel", async () => {
    const client = anthropicClient({
      apiKey: "test",
      model: "test-modell",
      fetchFn: anthropicAntwort("Eine Kreiselpumpe auf einem Prüfstand.", "end_turn"),
    });
    const res = await beschreibe(client);
    expect(res.text).toBe("Eine Kreiselpumpe auf einem Prüfstand.");
    expect(res.demo).toBe(false);
    expect(res.titelVorschlag).toEqual({
      titel: "Eine Kreiselpumpe auf einem Prüfstand",
      grund: "abgeleitet",
    });
  });

  it("Anthropic-Kante: der Textweg bleibt unberührt (kein Vermerk außerhalb des Bildwegs)", async () => {
    const client = anthropicClient({
      apiKey: "test",
      model: "test-modell",
      fetchFn: anthropicAntwort("Teilantwort", "max_tokens"),
    });
    const { wert, abbruch } = await mitAbbruchBefund(() => client.complete("s", "u", false));
    expect(wert).toBe("Teilantwort");
    expect(abbruch).toBeNull();
  });
});
