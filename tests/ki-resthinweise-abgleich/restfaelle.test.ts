// ================================================================================================
// KI-RESTHINWEISE-ABGLEICH — DIE DREI RESTFÄLLE AUS 3239/3366, DIE NOCH OHNE EIGENEN FALL WAREN.
// ================================================================================================
//
// Zuordnung und Begründung: README.md in diesem Ordner. Diese Datei REPARIERT NICHTS — sie hält
// fest, wie der bestehende Chokepoint (`requireChatContent`, model-client.ts) und der bestehende
// Abschnittsweg (`ModelProvider.extract`) sich in genau den Lagen verhalten, für die bisher nur
// Nachbarfälle existierten (G1/G2/E/G3 in tests/ki-abgeschnittene-antwort, T1d in
// tests/ki-fragment-sichtbar). Echter HTTP-Client mit injiziertem fetch, kein Meldefunktions-Mock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAiCompatibleClient } from "../../services/reasoner/src/model-client";
import { ModelEmptyResponseError } from "../../services/reasoner/src/model-errors";
import {
  EXTRACT_MAX_TOKENS,
  ModelProvider,
  chunkForExtract,
} from "../../services/reasoner/src/provider-model";

const FRAGMENT = ' \n{"points":[{"text":"Halb ä';
const BILD = "data:image/png;base64,AAAA";
const PRAEFIX = "[KLARWERK] Modellantwort abgeschnitten: ";
const FREMDE_GRUENDE = ["content_filter", "tool_calls", "LENGTH"] as const;

interface Antwort {
  choices: { message: { content: string | null }; finish_reason?: string | null | undefined }[];
}

function antwort(content: string | null, finishReason?: string | null): Antwort {
  return { choices: [{ message: { content }, finish_reason: finishReason }] };
}

// Jede Anfrage bekommt die nächste Antwort der Liste; die letzte bleibt stehen.
function baueClient(antworten: Antwort[]) {
  const anfragen: Record<string, unknown>[] = [];
  const fetchFn: typeof fetch = async (_url, init) => {
    anfragen.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const payload = antworten[Math.min(anfragen.length, antworten.length) - 1];
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return {
    anfragen,
    client: openAiCompatibleClient({
      baseUrl: "https://anbieter.invalid/v1",
      model: "test-modell",
      apiKey: "synthetischer-test-schluessel",
      bezeichnung: "Testanbieter",
      budgetFeld: "max_completion_tokens",
      bildEingang: true,
      fetchFn,
    }),
  };
}

function gemeldet(meldung: string | undefined): unknown {
  expect(meldung?.startsWith(PRAEFIX)).toBe(true);
  return JSON.parse(meldung?.slice(PRAEFIX.length) ?? "null");
}

describe("KI-RESTHINWEISE · Restfälle am bestehenden Chokepoint", () => {
  const meldungen: string[] = [];

  beforeEach(() => {
    meldungen.length = 0;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      meldungen.push(String(chunk));
      return true;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  // ----------------------------------------------------------------------------------------------
  // R1 · MEHR-CHUNK-MELDUNGEN: ein extract-Lauf über mehrere Abschnitte, jeder ein eigener Aufruf.
  // ----------------------------------------------------------------------------------------------
  const SATZ = "Der Pruefdruck betraegt 16 bar und wird vor Inbetriebnahme geprueft. ";
  const DOKUMENT = SATZ.repeat(300);
  // Drei gültige, punktlose Antworten mit UNTERSCHEIDBARER Länge — die Zeichenzahl im Befund
  // verrät damit, aus welchem Abschnitt er stammt.
  const LEER_A = '{"points":[]}';
  const LEER_B = '{"points": []}';
  const LEER_C = '{"points":  []}';

  it("R1a: je abgeschnittenem Abschnitt genau eine eigene Serverzeile; das Feld trägt den zuletzt gemeldeten", async () => {
    expect(
      chunkForExtract(DOKUMENT.trim()),
      "das Testdokument muss wirklich drei Modellaufrufe auslösen",
    ).toHaveLength(3);
    const { client, anfragen } = baueClient([
      antwort(LEER_A, "length"),
      antwort(LEER_B, "stop"),
      antwort(LEER_C, "length"),
    ]);
    const ergebnis = await new ModelProvider(client).extract(DOKUMENT);
    expect(anfragen).toHaveLength(3);
    expect(meldungen).toHaveLength(2);
    expect(gemeldet(meldungen[0])).toEqual({
      bezeichnung: "Testanbieter",
      budgetFeld: "max_completion_tokens",
      budget: EXTRACT_MAX_TOKENS,
      finish_reason: "length",
      zeichen: LEER_A.length,
    });
    expect(gemeldet(meldungen[1])).toEqual({
      bezeichnung: "Testanbieter",
      budgetFeld: "max_completion_tokens",
      budget: EXTRACT_MAX_TOKENS,
      finish_reason: "length",
      zeichen: LEER_C.length,
    });
    expect(ergebnis.abgeschnitten).toEqual({
      finishReason: "length",
      budgetFeld: "max_completion_tokens",
      budget: EXTRACT_MAX_TOKENS,
      zeichen: LEER_C.length,
    });
  });

  it("R1b: ein vollständiger Abschnitt NACH einem abgeschnittenen löscht den Befund nicht", async () => {
    const { client, anfragen } = baueClient([
      antwort(LEER_A, "length"),
      antwort(LEER_B, "stop"),
      antwort(LEER_C, "stop"),
    ]);
    const ergebnis = await new ModelProvider(client).extract(DOKUMENT);
    expect(anfragen).toHaveLength(3);
    expect(meldungen).toHaveLength(1);
    expect(ergebnis.abgeschnitten).toEqual({
      finishReason: "length",
      budgetFeld: "max_completion_tokens",
      budget: EXTRACT_MAX_TOKENS,
      zeichen: LEER_A.length,
    });
  });

  it("R1c: fremde finish_reason in allen Abschnitten erzeugen weder Zeile noch Feld", async () => {
    const { client, anfragen } = baueClient([
      antwort(LEER_A, "content_filter"),
      antwort(LEER_B, "tool_calls"),
      antwort(LEER_C, "LENGTH"),
    ]);
    const ergebnis = await new ModelProvider(client).extract(DOKUMENT);
    expect(anfragen).toHaveLength(3);
    expect(meldungen).toEqual([]);
    expect("abgeschnitten" in ergebnis).toBe(false);
  });

  // ----------------------------------------------------------------------------------------------
  // R2 · LEERER INHALT MIT FREMDEM finish_reason: „empty", der Anbieterwert bleibt wörtlich erhalten.
  // ----------------------------------------------------------------------------------------------
  it.each(
    FREMDE_GRUENDE.flatMap((grund): [string, string | null][] => [
      [grund, ""],
      [grund, "   \n"],
      [grund, null],
    ]),
  )(
    "R2: finish_reason=%s mit Inhalt %j → empty, kein truncated, keine Abschnittzeile",
    async (grund, inhalt) => {
      const { client, anfragen } = baueClient([antwort(inhalt, grund)]);
      const fehler: unknown = await client.complete("sys", "user", false).catch((e: unknown) => e);
      expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
      expect(fehler).toMatchObject({
        reason: "empty",
        finishReason: grund,
        sawReasoning: false,
        maxTokens: anfragen[0]?.max_completion_tokens,
      });
      expect((fehler as Error).message).toContain(`finish_reason=${grund}`);
      expect(anfragen).toHaveLength(1);
      expect(meldungen).toEqual([]);
    },
  );

  // ----------------------------------------------------------------------------------------------
  // R3 · BILDWEG: wiederholte und fremde finish_reason über `completeVision`.
  // ----------------------------------------------------------------------------------------------
  it("R3a: zwei abgeschnittene Bildaufrufe ergeben genau zwei eigene Zeilen, Fragmente unverändert", async () => {
    const zweites = `${FRAGMENT} noch ein Stück`;
    const { client, anfragen } = baueClient([
      antwort(FRAGMENT, "length"),
      antwort(zweites, "length"),
    ]);
    if (!client.completeVision) throw new Error("Bildweg fehlt");
    const vision = client.completeVision.bind(client);
    await expect(vision("sys", BILD, "user", false, 256)).resolves.toBe(FRAGMENT);
    await expect(vision("sys", BILD, "user", false, 256)).resolves.toBe(zweites);
    expect(anfragen).toHaveLength(2);
    for (const anfrage of anfragen) {
      expect(JSON.stringify(anfrage.messages)).toContain('"image_url"');
    }
    expect(meldungen.map(gemeldet)).toEqual(
      [FRAGMENT, zweites].map((fragment) => ({
        bezeichnung: "Testanbieter",
        budgetFeld: "max_completion_tokens",
        budget: 256,
        finish_reason: "length",
        zeichen: fragment.length,
      })),
    );
  });

  it.each(FREMDE_GRUENDE)(
    "R3b: Bildweg mit fremdem finish_reason=%s gibt den Inhalt unverändert zurück und bleibt still",
    async (grund) => {
      const { client, anfragen } = baueClient([antwort(FRAGMENT, grund)]);
      if (!client.completeVision) throw new Error("Bildweg fehlt");
      await expect(client.completeVision("sys", BILD, "user", false, 256)).resolves.toBe(FRAGMENT);
      expect(anfragen).toHaveLength(1);
      expect(meldungen).toEqual([]);
    },
  );

  it.each(FREMDE_GRUENDE)(
    "R3c: Bildweg ohne Inhalt mit fremdem finish_reason=%s → empty mit wörtlichem Anbieterwert",
    async (grund) => {
      const { client } = baueClient([antwort("", grund)]);
      if (!client.completeVision) throw new Error("Bildweg fehlt");
      const fehler: unknown = await client
        .completeVision("sys", BILD, "user", false, 256)
        .catch((e: unknown) => e);
      expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
      expect(fehler).toMatchObject({ reason: "empty", finishReason: grund, maxTokens: 256 });
      expect(meldungen).toEqual([]);
    },
  );
});
