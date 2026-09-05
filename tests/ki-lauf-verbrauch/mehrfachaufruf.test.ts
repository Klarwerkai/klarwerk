// ================================================================================================
// JOB 3074 · V2 — EIN LAUF MIT DREI MODELLAUFRUFEN VERBRAUCHT DIE SUMME DER DREI.
// ================================================================================================
//
// DIE NAHELIEGENDE HALBHEIT wäre, den zuletzt gemeldeten Wert zu behalten statt zu addieren. Dann
// meldete ausgerechnet `extract` — die Aufgabe, die ein langes Dokument in Abschnitten durch das
// Modell schickt (`provider-model.ts:1378-1387`) — den KLEINSTEN Verbrauch von allen, nämlich den
// des letzten und meist kürzesten Abschnitts.
//
// GEMESSEN WIRD DER ECHTE `extract`, nicht ein nachgebauter Dreifachaufruf: das Dokument ist so
// lang, dass `chunkForExtract` es in genau drei Abschnitte teilt; das wird im Fall selbst geprüft,
// damit er nicht stillschweigend zu einem Einfachaufruf verkümmert, falls sich die Abschnittslänge
// ändert.
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { chunkForExtract } from "../../services/reasoner/src/provider-model";
import { alsAntwort, cloudClient, cloudKoerper } from "./hilfe";

const SATZ = "Der Pruefdruck betraegt 16 bar und wird vor Inbetriebnahme geprueft. ";
const DOKUMENT = SATZ.repeat(300);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3074 V2: der Verbrauch eines Laufs ist die Summe seiner Modellaufrufe", () => {
  it("V2 · drei Abschnitte (Muster extract): Summe der drei und die Zahl 3 als Grundmenge", async () => {
    expect(
      chunkForExtract(DOKUMENT.trim()),
      "das Testdokument muss wirklich drei Modellaufrufe auslösen",
    ).toHaveLength(3);

    const jeAufruf = [
      { input_tokens: 1000, output_tokens: 50 },
      { input_tokens: 2000, output_tokens: 60 },
      { input_tokens: 3000, output_tokens: 70 },
    ];
    let n = 0;
    vi.stubGlobal("fetch", (async () =>
      alsAntwort(cloudKoerper('{"points":[]}', jeAufruf[n++]))) as unknown as typeof fetch);

    const repo = new InMemoryModelRunRepo();
    const reasoner = new Reasoner(
      new ModelProvider(cloudClient()),
      new DeterministicProvider(),
      repo,
    );
    await reasoner.extract(DOKUMENT, "de");

    expect(n, "drei Abschnitte, drei Modellaufrufe").toBe(3);
    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0];
    expect(lauf?.task).toBe("extract");
    expect(lauf?.status).toBe("success");
    // 1000+2000+3000 = 6000 · 50+60+70 = 180 · drei meldende Aufrufe.
    expect(lauf?.verbrauch).toEqual({
      eingabeToken: 6000,
      ausgabeToken: 180,
      gemeldeteAufrufe: 3,
    });
    // Ausdrücklich NICHT der letzte Wert allein — das ist die Halbheit, gegen die dieser Fall steht.
    expect(lauf?.verbrauch?.eingabeToken).not.toBe(3000);
  });
});
