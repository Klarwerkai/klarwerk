// ================================================================================================
// JOB 3074 · V6 — JEDER PROVIDER-VERSUCH ZÄHLT GENAU EINMAL: NICHT ZWEIMAL, NICHT KEINMAL.
// ================================================================================================
//
// DER BEFUND (ben, Runde 1): Runde 1 addierte die Spur eines Versuchs an ZWEI Stellen — nach dem
// Erfolg (`service.ts:685`) und noch einmal im Catch-Block desselben Durchlaufs (`:727`). Solange
// nur der Modellaufruf scheitern kann, ist das harmlos: dann wird der Erfolgszweig nie erreicht.
// Der Catch-Block umfasst aber MEHR als den Modellaufruf — er umfasst auch das Protokollschreiben
// (`recordRun`, `:696`). Scheitert das einmal (Verbindung zur Datenbank kurz weg) und gelingt der
// nächste Schreibversuch, so trug der gespeicherte Datensatz den Verbrauch EINES Aufrufs doppelt:
// 84/14 statt 42/7, `gemeldeteAufrufe: 2` statt 1.
//
// Das ist keine Rundungsfrage, sondern eine falsche Auskunft an genau der Stelle, an der dieser
// Auftrag Ehrlichkeit verspricht: die Zahl behauptet einen Modellaufruf, den es nie gab. Und sie ist
// unsichtbar falsch — nichts an der Anzeige verrät, dass ein Schreibversuch dazwischenlag.
//
// DIE ZWEI FÄLLE SIND DIE ZWEI RICHTUNGEN DESSELBEN GESETZES:
//   V6a — ein Modellaufruf, zwei Schreibversuche → EINMAL gezählt (nicht doppelt).
//   V6b — zwei Provider-Versuche, die BEIDE wirklich verbraucht haben → ZWEIMAL gezählt (nicht
//         einer davon unterschlagen). Ohne V6b wäre die Reparatur von V6a durch schlichtes
//         Nicht-mehr-Addieren im Catch-Block zu erschleichen — dann verlöre der teuerste reale
//         Fall (ein Modell scheitert nach seiner Abrechnung, das nächste antwortet) den bezahlten
//         ersten Versuch.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelRunRecord, ModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { alsAntwort, cloudClient, cloudKoerper, lokalKoerper, lokalerClient } from "./hilfe";

// Ein Protokollspeicher, dessen n-ter Schreibversuch scheitert und der sonst normal arbeitet — die
// billigste ehrliche Nachbildung eines kurzen Ausfalls der Datenbankverbindung. `scheitertBei: 0`
// heißt: scheitert nie.
class SchreibenScheitertEinmal implements ModelRunRepo {
  readonly versuche: ModelRunRecord[] = [];
  private readonly gespeichert: ModelRunRecord[] = [];

  constructor(private readonly scheitertBei = 1) {}

  append(record: ModelRunRecord): Promise<void> {
    this.versuche.push(record);
    if (this.versuche.length === this.scheitertBei) {
      return Promise.reject(new Error("Protokollspeicher vorübergehend nicht erreichbar"));
    }
    this.gespeichert.push(record);
    return Promise.resolve();
  }

  recent(limit = 100): Promise<ModelRunRecord[]> {
    return Promise.resolve(this.gespeichert.slice(0, Math.max(0, limit)));
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3074 V6: jeder Provider-Versuch geht genau einmal in den Laufverbrauch", () => {
  it("V6a · ein Modellaufruf, erster Protokollschreibversuch scheitert: 42/7 und EIN gemeldeter Aufruf", async () => {
    let aufrufe = 0;
    vi.stubGlobal("fetch", (async () => {
      aufrufe++;
      return alsAntwort(cloudKoerper("Geglätteter Satz.", { input_tokens: 42, output_tokens: 7 }));
    }) as unknown as typeof fetch);

    const repo = new SchreibenScheitertEinmal(1);
    const reasoner = new Reasoner(
      new ModelProvider(cloudClient()),
      new DeterministicProvider(),
      repo,
    );
    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");

    expect(aufrufe, "genau EIN echter Modellaufruf in diesem Lauf").toBe(1);
    expect(repo.versuche, "der erste Schreibversuch scheiterte, der zweite gelang").toHaveLength(2);

    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    // Ein Aufruf, ein Verbrauch — auch wenn der Datensatz zweimal geschrieben werden musste.
    expect(laeufe[0]?.verbrauch).toEqual({
      eingabeToken: 42,
      ausgabeToken: 7,
      gemeldeteAufrufe: 1,
    });
  });

  it("V6b · zwei Versuche, die BEIDE verbraucht haben: die Summe beider und die Grundmenge 2", async () => {
    // Erster Versuch (lokales Modell): 200 + `usage`, aber ohne Antwortinhalt → er scheitert in
    // `requireChatContent`, NACHDEM der Server abgerechnet hat (derselbe Weg wie V3c).
    // Zweiter Versuch (Cloud): antwortet und meldet ebenfalls. Beides ist bezahlt.
    vi.stubGlobal("fetch", (async (url: unknown) =>
      String(url).includes("127.0.0.1")
        ? alsAntwort(lokalKoerper(null, { prompt_tokens: 42, completion_tokens: 7 }))
        : alsAntwort(
            cloudKoerper("Geglätteter Satz.", { input_tokens: 100, output_tokens: 20 }),
          )) as unknown as typeof fetch);

    const repo = new SchreibenScheitertEinmal(0);
    const reasoner = new Reasoner(
      new ModelProvider(lokalerClient()),
      new DeterministicProvider(),
      repo,
      undefined,
      new ModelProvider(cloudClient()),
    );
    await reasoner.assistText("Roher Satz, der geglättet werden soll.", "de");

    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(1);
    const lauf = laeufe[0];
    // Der zweite Provider hat geantwortet — der gescheiterte erste bleibt trotzdem gezählt.
    expect(lauf?.status).toBe("success");
    expect(lauf?.model).toBe("claude-sonnet-4-6");
    expect(lauf?.verbrauch).toEqual({
      eingabeToken: 142,
      ausgabeToken: 27,
      gemeldeteAufrufe: 2,
    });
  });
});
