// ================================================================================================
// JOB 3074 · V1 — DER VERBRAUCH GEHÖRT DEM LAUF, NICHT DEM CLIENT.
// ================================================================================================
//
// DER GRUND, warum der Zähler in der Lauf-Spur (`AsyncLocalStorage`) sitzt und nicht als Merker am
// Modul oder am Client-Objekt: `model-concurrency` bedient GLEICHZEITIGE Läufe auf DERSELBEN
// Client-Instanz — das ist der ganze Zweck der Datei (`model-concurrency.ts:169-173`). Ein
// geteilter Merker liefe zwischen parallelen Läufen über, und dann trüge ein billiger Lauf den
// Verbrauch eines teuren.
//
// DIESER FALL ERZWINGT DIE ÜBERLAPPUNG: Aufruf 1 wird 30 ms offen gehalten, Aufruf 2 antwortet nach
// 1 ms. Lauf 2 schreibt sein Protokoll also, WÄHREND der Modellaufruf von Lauf 1 noch offen steht.
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { alsAntwort, cloudClient, cloudKoerper } from "./hilfe";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JOB 3074 V1: zwei gleichzeitige Läufe vermischen ihren Verbrauch nicht", () => {
  it("V1 · jeder Lauf trägt genau seinen eigenen Wert, keiner den des anderen und keiner die Summe", async () => {
    const jeAufruf = [
      { input_tokens: 100, output_tokens: 10 },
      { input_tokens: 7, output_tokens: 3 },
    ];
    let n = 0;
    vi.stubGlobal("fetch", (async () => {
      const i = n++;
      // Der ERSTE Aufruf bleibt am längsten offen — die Läufe überlappen wirklich.
      await new Promise((fertig) => setTimeout(fertig, i === 0 ? 30 : 1));
      return alsAntwort(cloudKoerper("Geglätteter Satz.", jeAufruf[i]));
    }) as unknown as typeof fetch);

    const repo = new InMemoryModelRunRepo();
    // EINE Client-Instanz für beide Läufe — genau die Lage, in der ein geteilter Merker überliefe.
    const reasoner = new Reasoner(
      new ModelProvider(cloudClient()),
      new DeterministicProvider(),
      repo,
    );
    await Promise.all([
      reasoner.assistText("Erster roher Satz.", "de"),
      reasoner.assistText("Zweiter roher Satz.", "de"),
    ]);

    expect(n, "beide Läufe haben wirklich das Modell befragt").toBe(2);
    const laeufe = await repo.recent(10);
    expect(laeufe).toHaveLength(2);

    // Als Menge geprüft: WELCHER Lauf zuerst am fetch war, ist nicht Gegenstand dieses Falls —
    // dass die zwei Werte GETRENNT bleiben, schon.
    const gemessen = laeufe
      .map((l) => `${l.verbrauch?.eingabeToken}/${l.verbrauch?.ausgabeToken}`)
      .sort();
    expect(gemessen).toEqual(["100/10", "7/3"]);

    for (const lauf of laeufe) {
      expect(lauf.verbrauch?.gemeldeteAufrufe, "je Lauf genau ein meldender Aufruf").toBe(1);
      expect(lauf.verbrauch?.eingabeToken, "kein Lauf trägt die Summe beider").not.toBe(107);
      expect(lauf.verbrauch?.ausgabeToken).not.toBe(13);
    }
  });
});
