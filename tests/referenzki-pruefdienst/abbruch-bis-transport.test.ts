// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02, K9, Ben nacharbeit-3) — ABBRUCH UND ZEITLIMIT
// BEENDEN DEN ANBIETERAUFRUF SELBST, NICHT NUR DAS WARTEN.
// ================================================================================================
//
// Gemessen wird die ganze Kette mit den ECHTEN Bausteinen: ReferenzPruefdienst → Reasoner
// (Laufbuch, Freigaben) → ModelProvider → cappedModelClient (Chokepoint) → anthropicClient bzw.
// openAiCompatibleClient (Transport). Ersetzt ist nur `fetch`: ein Doppelgänger, der das
// übergebene `signal` festhält und erst antwortet, wenn es ausgelöst wird (oder nie). Kein Netz,
// kein Modell, ein fiktiver Testwert statt eines Schlüssels.
//
//   T1 · Prüfzeitlimit des Dienstes ⇒ das Transport-Signal ist ausgelöst, Grund „zeitlimit",
//        ein Fehlerlauf `referenz` im Protokoll.
//   T2 · Anfrageabbruch während der Übertragung ⇒ Transport-Signal ausgelöst, Grund „abgebrochen".
//   T3 · Abbruch vor der Übertragung ⇒ kein `fetch` überhaupt.
//   T4 · OpenAI-kompatibler Transport: dasselbe für das Zeitlimit.
//   T5 · GEGENPROBE — ohne Abbruch antwortet der Transport, das Signal bleibt unberührt.
import { describe, expect, it } from "vitest";
import { ReferenzPruefdienst } from "../../services/ask";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import {
  type ModelClient,
  ModelProvider,
  Reasoner,
  cappedModelClient,
} from "../../services/reasoner";
import { anthropicClient, openAiCompatibleClient } from "../../services/reasoner/src/model-client";
import { mitKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import { PRUEF_FAELLE, belegDes } from "./faelle";

const FALL = PRUEF_FAELLE.find((f) => f.kennung === "korrekter_beleg");
if (!FALL) {
  throw new Error("Fall fehlt");
}

interface Transport {
  fetchFn: typeof fetch;
  signale: AbortSignal[];
  aufrufe: () => number;
}

/** Ein `fetch`, das sein Signal festhält und nur auf Abbruch (oder sofort, wenn `antwort`) endet. */
function transport(antwort?: () => Response): Transport {
  const signale: AbortSignal[] = [];
  const fetchFn = ((_url: unknown, init?: { signal?: AbortSignal }) => {
    const signal = init?.signal;
    if (signal) {
      signale.push(signal);
    }
    if (antwort) {
      return Promise.resolve(antwort());
    }
    return new Promise<Response>((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("Übertragung abgebrochen"), { name: "AbortError" }));
      });
    });
  }) as unknown as typeof fetch;
  return { fetchFn, signale, aufrufe: () => signale.length };
}

const ANTHROPIC_OK = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({
      content: [{ type: "text", text: '{"richtlinie":"referenzpruefung-v1","ergebnisse":[]}' }],
      usage: { input_tokens: 120, output_tokens: 8 },
    }),
  }) as unknown as Response;

/** Der echte Anthropic-Transport mit dem `fetch`-Doppelgänger und einem fiktiven Testwert. */
function anthropic(t: Transport): ModelClient {
  return anthropicClient({
    apiKey: "testwert-fiktiv",
    model: "claude-fiktiv-2",
    fetchFn: t.fetchFn,
  });
}

async function aufbau(roh: ModelClient) {
  const runs = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(undefined, undefined, runs, undefined, undefined, undefined, {
    anbieter: {
      anthropic: new ModelProvider(cappedModelClient(roh, { rejectsConfidential: true })),
    },
  });
  await reasoner.setTaskConfig(
    mitKiFreigabe({ global: "anthropic", perTask: {}, referenzpruefung: ["anthropic"] }),
  );
  return { reasoner, runs };
}

function dienst(reasoner: Reasoner, zeitlimitMs: number) {
  return new ReferenzPruefdienst({
    waehlePruefer: (antwort, vertraulich) => reasoner.referenzPruefer(antwort, vertraulich),
    externErlaubt: (vertraulich) => reasoner.externeVerarbeitungErlaubt(vertraulich),
    istVertraulich: () => false,
    zeitlimitMs,
  });
}

function eingabe(signal?: AbortSignal) {
  const f = FALL as NonNullable<typeof FALL>;
  const objekte = new Map(
    f.quellen.map((q) => [
      q.id,
      { id: q.id, version: q.version, originalAuthor: "autor-fiktiv", statement: q.statement },
    ]),
  );
  return {
    beleg: belegDes(f),
    antwortRolle: { anbieter: "fixtur", modell: "fixtur-antwort", stufe: "cloud" as const },
    akteur: "nutzer-fiktiv",
    leser: {
      aktuell: async (id: string) => objekte.get(id),
      imPapierkorb: async () => undefined,
      fassung: async (id: string, v: number) => {
        const o = objekte.get(id);
        return o && o.version === v ? { statement: o.statement } : undefined;
      },
    },
    darfSehen: () => true,
    ...(signal ? { signal } : {}),
  };
}

const kurz = () => new Promise((r) => setTimeout(r, 5));

describe("REF-02 · K9 — Abbruch und Zeitlimit reichen bis zum Transport", () => {
  it("T1 · Prüfzeitlimit: das Transport-Signal ist ausgelöst, Fehlerlauf im Protokoll", async () => {
    const t = transport();
    const { reasoner, runs } = await aufbau(anthropic(t));
    const e = await dienst(reasoner, 40).pruefe(eingabe());
    expect(e.grund).toBe("zeitlimit");
    expect(t.aufrufe()).toBe(1);
    expect(t.signale[0]?.aborted, "der laufende Anbieteraufruf wurde abgebrochen").toBe(true);
    await kurz();
    const laeufe = await runs.recent();
    expect(laeufe.map((l) => [l.task, l.status, l.model])).toEqual([
      ["referenz", "error", "claude-fiktiv-2"],
    ]);
  });

  it("T2 · Anfrageabbruch während der Übertragung: Signal ausgelöst, Grund „abgebrochen“", async () => {
    const t = transport();
    const { reasoner } = await aufbau(anthropic(t));
    const steuerung = new AbortController();
    const lauf = dienst(reasoner, 5_000).pruefe(eingabe(steuerung.signal));
    // Warten, bis der Transport wirklich angefragt wurde — dann abbrechen.
    for (let i = 0; i < 100 && t.aufrufe() === 0; i += 1) {
      await kurz();
    }
    expect(t.aufrufe()).toBe(1);
    steuerung.abort();
    const e = await lauf;
    expect(e.grund).toBe("abgebrochen");
    expect(t.signale[0]?.aborted).toBe(true);
  });

  it("T3 · Abbruch vor der Übertragung: kein einziger Transportaufruf", async () => {
    const t = transport();
    const { reasoner } = await aufbau(anthropic(t));
    const steuerung = new AbortController();
    steuerung.abort();
    const e = await dienst(reasoner, 5_000).pruefe(eingabe(steuerung.signal));
    expect(e.grund).toBe("abgebrochen");
    expect(t.aufrufe()).toBe(0);
  });

  it("T4 · OpenAI-kompatibler Transport: das Zeitlimit bricht die Übertragung ab", async () => {
    const t = transport();
    const roh = openAiCompatibleClient({
      baseUrl: "https://openai-fiktiv.invalid/v1",
      model: "gpt-fiktiv-1",
      apiKey: "testwert-fiktiv",
      name: "anthropic:gpt-fiktiv-1",
      fetchFn: t.fetchFn,
    });
    const { reasoner } = await aufbau(roh);
    const e = await dienst(reasoner, 40).pruefe(eingabe());
    expect(e.grund).toBe("zeitlimit");
    expect(t.signale[0]?.aborted).toBe(true);
  });

  it("T5 · GEGENPROBE — ohne Abbruch antwortet der Transport, das Signal bleibt unberührt", async () => {
    const t = transport(ANTHROPIC_OK);
    const { reasoner, runs } = await aufbau(anthropic(t));
    const e = await dienst(reasoner, 5_000).pruefe(eingabe());
    expect(e.grund).not.toBe("zeitlimit");
    expect(e.grund).not.toBe("abgebrochen");
    expect(e.messung.modellaufrufe).toBe(1);
    expect(t.signale[0]?.aborted).toBe(false);
    const laeufe = await runs.recent();
    expect(laeufe[0]).toMatchObject({
      task: "referenz",
      status: "success",
      model: "claude-fiktiv-2",
    });
  });
});
