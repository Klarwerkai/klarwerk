// JOB 3239: echter HTTP-Client mit injiziertem fetch; die Servermeldung wird am Ausgang gelesen.
// Kein Client-/Meldefunktions-Mock: A1 muss ohne Produkterkennung rot werden, B bei falscher Bedingung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openAiCompatibleClient } from "../../services/reasoner/src/model-client";
import {
  type ModellAufrufSpur,
  mitModellAufrufSpur,
} from "../../services/reasoner/src/model-concurrency";
import { ModelEmptyResponseError } from "../../services/reasoner/src/model-errors";
import {
  EXTRACT_MAX_TOKENS,
  ModelProvider,
  parseExtractResponse,
} from "../../services/reasoner/src/provider-model";

const FRAGMENT = ' \n{"points":[{"text":"Halb ä';
const BILD = "data:image/png;base64,AAAA";
const PRAEFIX = "[KLARWERK] Modellantwort abgeschnitten: ";

function antwort(content: string | null, finishReason?: string | null, usage?: unknown) {
  return {
    choices: [{ message: { content }, finish_reason: finishReason }],
    usage,
  };
}

function baueClient(
  payload: unknown,
  budgetFeld: "max_tokens" | "max_completion_tokens" = "max_completion_tokens",
  maxTokensFloor?: number,
) {
  const anfragen: Record<string, unknown>[] = [];
  const fetchFn: typeof fetch = async (_url, init) => {
    anfragen.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
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
      budgetFeld,
      bildEingang: true,
      ...(maxTokensFloor === undefined ? {} : { maxTokensFloor }),
      fetchFn,
    }),
  };
}

describe("JOB 3239 · ein Fragment ist serverintern als abgeschnitten bekannt", () => {
  const meldungen: string[] = [];

  beforeEach(() => {
    meldungen.length = 0;
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      meldungen.push(String(chunk));
      return true;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it.each(["max_tokens", "max_completion_tokens"] as const)(
    "A1: length meldet genau einmal nur Metadaten mit gesendetem %s und wirksamem Budget",
    async (budgetFeld) => {
      const payload = antwort(FRAGMENT, "length");
      const { client, anfragen } = baueClient(payload, budgetFeld, 2048);
      await client.complete("synthetischer Systemtext", "synthetischer Nutzertext", false, 512);
      expect(anfragen).toHaveLength(1);
      expect(anfragen[0]?.[budgetFeld]).toBe(2048);
      expect(meldungen).toHaveLength(1);
      expect(meldungen[0]?.startsWith(PRAEFIX)).toBe(true);
      expect(JSON.parse(meldungen[0]?.slice(PRAEFIX.length) ?? "null")).toEqual({
        bezeichnung: "Testanbieter",
        budgetFeld,
        budget: anfragen[0]?.[budgetFeld],
        finish_reason: "length",
        zeichen: FRAGMENT.length,
      });
    },
  );

  it("A2: das Fragment bleibt bis zum Aufrufer zeichengleich, einschließlich Leerraum und Umlaut", async () => {
    const { client, anfragen } = baueClient(antwort(FRAGMENT, "length"));
    await expect(client.complete("sys", "user", false)).resolves.toBe(FRAGMENT);
    expect(anfragen).toHaveLength(1);
  });

  it("G1: zwei aufeinanderfolgende Aufrufe desselben Clients ergeben genau zwei eigene Meldungen", async () => {
    const fragmente = [FRAGMENT, `${FRAGMENT} noch ein Stück`];
    const payload = antwort(FRAGMENT, "length");
    const { client, anfragen } = baueClient(payload);
    for (const fragment of fragmente) {
      payload.choices[0]!.message.content = fragment;
      await expect(client.complete("sys", "user", false)).resolves.toBe(fragment);
    }
    expect(anfragen).toHaveLength(2);
    expect(meldungen.length).toBe(2);
    for (const [index, fragment] of fragmente.entries()) {
      expect(meldungen[index]?.startsWith(PRAEFIX)).toBe(true);
      expect(JSON.parse(meldungen[index]?.slice(PRAEFIX.length) ?? "null")).toEqual({
        bezeichnung: "Testanbieter",
        budgetFeld: "max_completion_tokens",
        budget: anfragen[index]?.max_completion_tokens,
        finish_reason: "length",
        zeichen: fragment.length,
      });
    }
  });

  it.each(["content_filter", "tool_calls", "LENGTH", "Length"])(
    "G2: fremdes finish_reason=%s lässt den Inhalt unverändert und den Ausgang leer",
    async (finishReason) => {
      const payload = antwort(FRAGMENT, finishReason);
      Object.assign(payload.choices[0]!.message, {
        reasoning: "synthetischer Denktext",
        reasoning_content: "weitere synthetische Gedanken",
        thinking: "synthetisches Denken",
      });
      const { client, anfragen } = baueClient(payload);
      await expect(
        client.complete("synthetischer Systemtext", "synthetischer Nutzertext", false),
      ).resolves.toBe(FRAGMENT);
      expect(anfragen).toHaveLength(1);
      expect(meldungen).toEqual([]);
      expect(meldungen.join("")).not.toMatch(/synthetisch|Halb|points|reasoning|thinking/);
    },
  );

  it("G3: der echte Extract-Rettungsweg erhält Punkte und Unvollständigkeit bei einem gemeldeten Fragment", async () => {
    const dokument = "Die Pumpe wird täglich geprüft. Das Ventil bleibt geschlossen.";
    const punkte = [
      {
        title: "Pumpe prüfen",
        summary: "Tägliche Prüfung der Pumpe.",
        sourceExcerpt: "Die Pumpe wird täglich geprüft.",
      },
      {
        title: "Ventil geschlossen halten",
        summary: "Das Ventil bleibt geschlossen.",
        sourceExcerpt: "Das Ventil bleibt geschlossen.",
      },
    ];
    const unbelegt = {
      title: "Unbelegter Punkt",
      summary: "Darf nicht gerettet werden.",
      sourceExcerpt: "Die Anlage wird morgen ersetzt.",
    };
    const fragment = `{"points":[${[...punkte, unbelegt].map((p) => JSON.stringify(p)).join(",")},{"title":"Abgerissen`;
    // Belegt die Voraussetzung für den echten catch-/salvage-Zweig, ohne ihn zu ersetzen.
    expect(() => parseExtractResponse(fragment, dokument)).toThrow(SyntaxError);
    const payload = antwort(fragment, "stop");
    const { client, anfragen } = baueClient(payload);
    const provider = new ModelProvider(client);
    const ohneMeldung = await provider.extract(dokument);
    expect(ohneMeldung).toEqual({
      points: punkte,
      note: "Hinweis: Ein Teil des Dokuments konnte nicht vollständig verarbeitet werden — diese Liste ist möglicherweise unvollständig. Jeder angezeigte Punkt trägt weiterhin eine geprüfte Belegstelle.",
      demo: false,
    });
    expect(meldungen).toEqual([]);
    payload.choices[0]!.finish_reason = "length";
    const mitMeldung = await provider.extract(dokument);
    // ============================================================================================
    // JOB 3366 · NACHGEFÜHRT — HIER STAND `toEqual(ohneMeldung)`, ALSO „VOLLSTÄNDIG IDENTISCH".
    // ============================================================================================
    // Das war die Zusage von JOB 3239: der Befund bleibt serverintern, das Ergebnis ändert sich um
    // kein Feld. JOB 3366 hebt genau diese eine Zusage auf — und nur sie: der Befund reist jetzt
    // ZUSÄTZLICH als maschinenlesbares Feld `abgeschnitten` mit, damit die Erfassen-Fläche das
    // Fragment kennzeichnen kann. Was JOB 3239 wirklich schützt, gilt unverändert weiter und wird
    // deshalb hier WEITER FELDWEISE geprüft: die geretteten Punkte und die abgeleitete `note` sind
    // Zeichen für Zeichen dieselben wie ohne Meldung, und der unbelegte Punkt bleibt draußen.
    expect(mitMeldung.points).toEqual(ohneMeldung.points);
    expect(mitMeldung.note).toBe(ohneMeldung.note);
    expect(mitMeldung.demo).toBe(ohneMeldung.demo);
    expect(ohneMeldung.abgeschnitten).toBeUndefined();
    expect(mitMeldung.abgeschnitten).toEqual({
      finishReason: "length",
      budgetFeld: "max_completion_tokens",
      budget: EXTRACT_MAX_TOKENS,
      zeichen: fragment.length,
    });
    // Das Feld trägt NUR Metadaten — kein Dokument-, Antwort- oder Prompttext.
    expect(JSON.stringify(mitMeldung.abgeschnitten)).not.toMatch(/Pumpe|Ventil|Anlage|Abgerissen/);
    expect(anfragen).toHaveLength(2);
    expect(anfragen[1]?.max_completion_tokens).toBe(EXTRACT_MAX_TOKENS);
    expect(anfragen[1]?.messages).toEqual([
      { role: "system", content: expect.any(String) },
      { role: "user", content: dokument },
    ]);
    expect(meldungen).toHaveLength(1);
    expect(meldungen[0]?.startsWith(PRAEFIX)).toBe(true);
    expect(JSON.parse(meldungen[0]?.slice(PRAEFIX.length) ?? "null")).toEqual({
      bezeichnung: "Testanbieter",
      budgetFeld: "max_completion_tokens",
      budget: anfragen[1]?.max_completion_tokens,
      finish_reason: "length",
      zeichen: fragment.length,
    });
  });

  it("G4: ein Leerraum-Fragment wirft truncated und erzeugt keine Abschnitt-Meldung", async () => {
    const { client, anfragen } = baueClient(antwort("   \n", "length"));
    const fehler: unknown = await client.complete("sys", "user", false).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect(fehler).toMatchObject({
      reason: "truncated",
      finishReason: "length",
      sawReasoning: false,
      maxTokens: anfragen[0]?.max_completion_tokens,
    });
    expect(anfragen).toHaveLength(1);
    expect(meldungen).toEqual([]);
  });

  it.each(["stop", undefined, null])(
    "B: derselbe Inhalt mit finish_reason=%s bleibt still",
    async (finishReason) => {
      const { client } = baueClient(antwort(FRAGMENT, finishReason));
      await expect(client.complete("sys", "user", false)).resolves.toBe(FRAGMENT);
      expect(meldungen).toEqual([]);
    },
  );

  it("C: Reasoning nur im Verbrauch ergibt reasoning-only mit finishReason=length", async () => {
    const { client } = baueClient(
      antwort("", "length", { completion_tokens_details: { reasoning_tokens: 812 } }),
    );
    const fehler: unknown = await client.complete("sys", "user", false).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(ModelEmptyResponseError);
    expect(fehler).toMatchObject({
      reason: "reasoning-only",
      finishReason: "length",
      sawReasoning: true,
    });
    expect(meldungen).toEqual([]);
  });

  it.each([undefined, null, 0, -1, "812", false])(
    "C-Gegenfall: reasoning_tokens=%s belegt keine Denkphase",
    async (reasoningTokens) => {
      const { client } = baueClient(
        antwort("", "length", { completion_tokens_details: { reasoning_tokens: reasoningTokens } }),
      );
      await expect(client.complete("sys", "user", false)).rejects.toMatchObject({
        reason: "truncated",
        finishReason: "length",
        sawReasoning: false,
      });
      expect(meldungen).toEqual([]);
    },
  );

  it.each([undefined, null, {}, { completion_tokens_details: null }])(
    "C-Gegenfall: usage=%j erfindet keine Denkphase",
    async (usage) => {
      const { client } = baueClient(antwort(null, "length", usage));
      await expect(client.complete("sys", "user", false)).rejects.toMatchObject({
        reason: "truncated",
        sawReasoning: false,
      });
      expect(meldungen).toEqual([]);
    },
  );

  it.each([{}, { choices: [] }, { choices: [null] }, null])(
    "D: fehlende erste Auswahl (%j) erzeugt keine Abschnitt-Meldung",
    async (payload) => {
      const { client } = baueClient(payload);
      await expect(client.complete("sys", "user", false)).rejects.toMatchObject({
        reason: "empty",
        finishReason: undefined,
      });
      expect(meldungen).toEqual([]);
    },
  );

  it("E: der Bildweg meldet genau einmal, gibt das Fragment unverändert zurück und wahrt die Verbrauchsreihenfolge", async () => {
    const { client, anfragen } = baueClient(
      antwort(FRAGMENT, "length", { prompt_tokens: 100, completion_tokens: 256 }),
    );
    const spur: ModellAufrufSpur = { gerufen: false };
    const verbrauchBeiMeldung: unknown[] = [];
    vi.mocked(process.stderr.write).mockImplementation((chunk) => {
      meldungen.push(String(chunk));
      verbrauchBeiMeldung.push(spur.verbrauch ? { ...spur.verbrauch } : undefined);
      return true;
    });
    if (!client.completeVision) throw new Error("Bildweg fehlt");
    const vision = client.completeVision.bind(client);
    await expect(
      mitModellAufrufSpur(spur, () => vision("sys", BILD, "user", false, 256)),
    ).resolves.toBe(FRAGMENT);
    expect(anfragen).toHaveLength(1);
    expect(anfragen[0]?.max_completion_tokens).toBe(256);
    expect(JSON.stringify(anfragen[0]?.messages)).toContain('"image_url"');
    expect(meldungen).toEqual([
      `${PRAEFIX}{"bezeichnung":"Testanbieter","budgetFeld":"max_completion_tokens","budget":256,"finish_reason":"length","zeichen":${FRAGMENT.length}}\n`,
    ]);
    expect(verbrauchBeiMeldung).toEqual([
      { eingabeToken: 100, ausgabeToken: 256, gemeldeteAufrufe: 1 },
    ]);
  });

  it("F: Antwort-, Denk-, Prompttext und Schlüssel gelangen nicht in die Meldung", async () => {
    const { client } = baueClient({
      choices: [
        {
          finish_reason: "length",
          message: {
            content: FRAGMENT,
            reasoning: "synthetischer Denktext",
            reasoning_content: "weitere synthetische Gedanken",
            thinking: "synthetisches Denken",
          },
        },
      ],
    });
    await client.complete("synthetischer Systemtext", "synthetischer Nutzertext", false);
    expect(meldungen).toHaveLength(1);
    expect(meldungen.join("")).not.toMatch(/synthetisch|Halb|points|reasoning|thinking/);
  });
});
