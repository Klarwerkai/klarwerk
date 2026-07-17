import { describe, expect, it } from "vitest";
import { anthropicClient } from "./model-client";
import type { ModelClient } from "./provider-model";
import {
  EXTRACT_MAX_TOKENS,
  ModelProvider,
  chunkForExtract,
  excerptFoundInDocument,
  salvageTruncatedExtract,
} from "./provider-model";
import { Reasoner } from "./service";

// SCRUM-411 (Pedi-Test 03.07.): Extract meldete „kein KI-Modell" trotz grünem Key-Test.
// Ursache 1: max_tokens 1024 für ALLE Aufrufe — das Punkte-JSON realer Dokumente wurde
// abgeschnitten. Ursache 2: Der stille Fallback zeigte die falsche „kein Modell"-Meldung.
// Diese Tests sichern beide Fixes; SCRUM-410 (Interview-Sprache) wird mitgeprüft.
describe("SCRUM-411: Extract-Fehler ehrlich benennen + Antwort-Limit", () => {
  const DOC = "Protokoll: Dosierpumpe P2 alle 200 Betriebsstunden mit Fett Typ Z schmieren.";

  function failingClient(message: string): ModelClient {
    return {
      name: "fake:kaputt",
      complete: () => Promise.reject(new Error(message)),
    };
  }

  it("Modell konfiguriert + Aufruf scheitert → note nennt den echten Grund, NICHT die kein-Modell-Meldung", async () => {
    const reasoner = new Reasoner(
      new ModelProvider(failingClient("Modell-API antwortete mit 500")),
    );
    const result = await reasoner.extract(DOC, "de");
    expect(result.points).toEqual([]);
    expect(result.note).toContain("fehlgeschlagen");
    expect(result.note).toContain("Modell-API antwortete mit 500");
    expect(result.note).toContain("Schlüssel-Test");
    expect(result.note).not.toContain("Ohne KI-Modell");
  });

  it("ohne konfiguriertes Modell bleibt die ehrliche kein-Modell-Meldung", async () => {
    const reasoner = new Reasoner();
    const result = await reasoner.extract(DOC, "de");
    expect(result.points).toEqual([]);
    expect(result.note).toContain("Ohne KI-Modell");
    expect(result.note).not.toContain("fehlgeschlagen (");
  });

  it("bewusst Deterministisch gestellt → weiterhin kein-Modell-Meldung (kein Fehler-Text)", async () => {
    const reasoner = new Reasoner(new ModelProvider(failingClient("egal")));
    await reasoner.setTaskConfig({ global: "auto", perTask: { extract: "deterministic" } });
    const result = await reasoner.extract(DOC, "de");
    expect(result.note).toContain("Ohne KI-Modell");
  });

  it("abgeschnittenes/ungültiges JSON wird als klarer Grund gemeldet (nicht kryptisch)", async () => {
    const truncated: ModelClient = {
      name: "fake:abgeschnitten",
      complete: async () => '{"points": [{"title": "abgeschn',
    };
    const reasoner = new Reasoner(new ModelProvider(truncated));
    const result = await reasoner.extract(DOC, "de");
    expect(result.points).toEqual([]);
    expect(result.note).toContain("kein gültiges JSON");
    expect(result.note).toContain("abgeschnitten");
  });

  // SCRUM-418 (Pedi 03.07., 42k-Zeichen-PDF): Selbst 4096 Token reichten nicht — jetzt werden
  // vollständige, belegte Punkte aus einer trotzdem gekürzten Antwort GERETTET statt alles
  // zu verwerfen, und der Hinweis benennt die mögliche Unvollständigkeit ehrlich.
  it("SCRUM-418: vollständige Punkte einer gekürzten Antwort werden gerettet, Hinweis nennt Unvollständigkeit", async () => {
    const truncated: ModelClient = {
      name: "fake:mittendrin-abgerissen",
      complete: async () =>
        '{"points": [' +
        '{"title": "Schmierintervall der Dosierpumpe", "summary": "Alle 200 Betriebsstunden schmieren.", "sourceExcerpt": "alle 200 Betriebsstunden"}, ' +
        '{"title": "Vorgeschriebenes Fett", "summary": "Fett Typ Z verwenden.", "sourceExcerpt": "mit Fett Typ Z schmieren"}, ' +
        '{"title": "Dritter Punkt bricht mitten im Feld a',
    };
    const reasoner = new Reasoner(new ModelProvider(truncated));
    const result = await reasoner.extract(DOC, "de");
    expect(result.points.map((p) => p.title)).toEqual([
      "Schmierintervall der Dosierpumpe",
      "Vorgeschriebenes Fett",
    ]);
    expect(result.note).toContain("unvollständig");
    expect(result.demo).toBe(false);
  });

  it("SCRUM-418: Rettung bleibt hinter dem G-2-Gate — Punkte ohne echte Belegstelle fliegen auch beim Retten raus", () => {
    const raw =
      '{"points": [' +
      '{"title": "Erfundener Punkt", "summary": "Steht nicht im Dokument.", "sourceExcerpt": "Turbine wöchentlich entlüften"}, ' +
      '{"title": "Echter Punkt", "summary": "Belegt.", "sourceExcerpt": "Dosierpumpe P2"}, ' +
      '{"title": "abgerissen';
    const saved = salvageTruncatedExtract(raw, DOC);
    expect(saved.map((p) => p.title)).toEqual(["Echter Punkt"]);
    // Ohne einen einzigen vollständigen Punkt gibt es nichts zu retten → leere Liste.
    expect(salvageTruncatedExtract('{"points": [{"title": "abgeschn', DOC)).toEqual([]);
  });

  // SCRUM-418 (Pedi 03.07., Extract scheiterte weiter): das Modell bettet die JSON gern in
  // Prosa/Code-Fences ein. Die robuste Extraktion muss das erste ausgewogene {…} finden —
  // die alte „erstes { bis letztes }"-Logik zerbrach an einem „}" im Begleitsatz.
  it("SCRUM-418: JSON in Prosa/Code-Fences mit geschweiften Klammern im Fließtext wird sauber geparst", async () => {
    const wrapped: ModelClient = {
      name: "fake:geschwaetzig",
      complete: async () =>
        "Gerne! Hier die Punkte (nutze {diese} sinnvoll):\n```json\n" +
        '{"points": [{"title": "Schmierintervall", "summary": "Alle 200 h.", "sourceExcerpt": "alle 200 Betriebsstunden"}]}\n' +
        "```\nHoffe, das hilft! {Ende}",
    };
    const result = await new Reasoner(new ModelProvider(wrapped)).extract(DOC, "de");
    expect(result.points.map((p) => p.title)).toEqual(["Schmierintervall"]);
    expect(result.note).toBeNull();
  });

  // SCRUM-418: PDF-Text bringt Silbentrennung/Zeilenumbrüche mit. Ein echtes Zitat, das im
  // Dokument über einen Trennstrich+Umbruch läuft, muss die Belegstelle trotzdem finden.
  it("SCRUM-418: Belegstelle wird trotz Silbentrennung/Umbruch im Dokument erkannt", async () => {
    const pdfDoc = "Protokoll: Die Dosier-\npumpe P2 ist alle 200 Betriebs-\nstunden zu schmieren.";
    const client: ModelClient = {
      name: "fake:sauber",
      complete: async () =>
        '{"points": [{"title": "Schmierintervall", "summary": "Alle 200 h.", "sourceExcerpt": "Dosierpumpe P2 ist alle 200 Betriebsstunden"}]}',
    };
    const result = await new Reasoner(new ModelProvider(client)).extract(pdfDoc, "de");
    expect(result.points).toHaveLength(1);
    expect(result.note).toBeNull();
  });

  it("SCRUM-418: der tolerante Belegstellen-Rückfall erzeugt keine Zufallstreffer (Mindestlänge)", () => {
    // Kurzer, nicht enthaltener Schnipsel darf NICHT über den alnum-Rückfall matchen.
    expect(excerptFoundInDocument("XY 7!", DOC)).toBe(false);
    // Frei erfundene, lange Belegstelle bleibt abgewiesen.
    expect(
      excerptFoundInDocument("Turbine wöchentlich mit Spezialöl entlüften und prüfen", DOC),
    ).toBe(false);
  });

  // SCRUM-427 (Pedi 03.07.): lange Dokumente in Abschnitten extrahieren, damit der
  // Gekürzt-Hinweis bei normal langen Dokumenten entfällt.
  it("SCRUM-427: kurzer Text bleibt EIN Abschnitt; langer wird lückenlos geteilt (≤ Größe)", () => {
    expect(chunkForExtract("kurzer Text", 100)).toEqual(["kurzer Text"]);
    const long = `${"Satz. ".repeat(40)}\n\n${"Absatz zwei. ".repeat(40)}`;
    const parts = chunkForExtract(long, 120);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(long); // lückenlos, nichts verloren
    for (const p of parts) {
      expect(p.length).toBeLessThanOrEqual(120);
    }
  });

  it("SCRUM-427: langes Dokument wird abschnittsweise extrahiert und zusammengeführt (kein Gekürzt-Hinweis)", async () => {
    const a = "ALPHA Ventil V1 bei Ueberdruck schliessen. ";
    const b = "BETA Pumpe P2 alle 200 Betriebsstunden schmieren. ";
    const filler = "Hinweis zur Wartung. ".repeat(500); // je ~10.500 Zeichen, keine Marker
    const longDoc = `${a}${filler}\n\n${b}${filler}`;
    const client: ModelClient = {
      name: "fake:abschnitte",
      complete: async (_system, user) => {
        if (user.includes("ALPHA")) {
          return '{"points": [{"title": "Ventil schließen", "summary": "s", "sourceExcerpt": "Ventil V1 bei Ueberdruck schliessen"}]}';
        }
        if (user.includes("BETA")) {
          return '{"points": [{"title": "Pumpe schmieren", "summary": "s", "sourceExcerpt": "Pumpe P2 alle 200 Betriebsstunden schmieren"}]}';
        }
        return '{"points": []}';
      },
    };
    const result = await new Reasoner(new ModelProvider(client)).extract(longDoc, "de");
    expect(result.points.map((p) => p.title).sort()).toEqual([
      "Pumpe schmieren",
      "Ventil schließen",
    ]);
    expect(result.note).toBeNull(); // keine Kürzung → kein Hinweis
    expect(result.demo).toBe(false);
  });

  it("SCRUM-427: doppelte Punkte über Abschnitte hinweg werden dedupliziert", async () => {
    const filler = "Allgemeiner Hinweis. ".repeat(500);
    const longDoc = `GLEICH Wert X einhalten. ${filler}\n\nGLEICH Wert X einhalten. ${filler}`;
    const client: ModelClient = {
      name: "fake:doppelt",
      complete: async (_system, user) =>
        user.includes("GLEICH")
          ? '{"points": [{"title": "Wert X", "summary": "s", "sourceExcerpt": "Wert X einhalten"}]}'
          : '{"points": []}',
    };
    const result = await new Reasoner(new ModelProvider(client)).extract(longDoc, "de");
    expect(result.points).toHaveLength(1);
    expect(result.points[0]?.title).toBe("Wert X");
  });

  it("extract ruft das Modell mit dem großen Antwort-Limit auf (EXTRACT_MAX_TOKENS)", async () => {
    let seenMaxTokens: number | undefined;
    const recording: ModelClient = {
      name: "fake:aufzeichnung",
      // SCRUM-502 Schicht 2: neue Signatur (system, user, confidential, maxTokens?).
      complete: async (_system, _user, _confidential, maxTokens) => {
        seenMaxTokens = maxTokens;
        return '{"points": []}';
      },
    };
    await new ModelProvider(recording).extract(DOC, "de");
    expect(seenMaxTokens).toBe(EXTRACT_MAX_TOKENS);
    expect(EXTRACT_MAX_TOKENS).toBeGreaterThanOrEqual(4096);
  });

  it("anthropicClient reicht maxTokens in den API-Body durch (Default 1024)", async () => {
    const bodies: { max_tokens: number }[] = [];
    const fetchFn = (async (_url: unknown, init?: { body?: unknown }) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")) as { max_tokens: number });
      return {
        ok: true,
        json: async () => ({ content: [{ text: "ok" }] }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const client = anthropicClient({ apiKey: "test-key", model: "test-model", fetchFn });
    await client.complete("s", "u", false);
    await client.complete("s", "u", false, EXTRACT_MAX_TOKENS);
    expect(bodies[0]?.max_tokens).toBe(1024);
    expect(bodies[1]?.max_tokens).toBe(EXTRACT_MAX_TOKENS);
  });
});

describe("SCRUM-410: Interview-Prompt mit Sprach-Leitplanken", () => {
  it("DE-Prompt verlangt Du-Anrede, EINE kurze Frage und deutsche Antwortsprache", async () => {
    let seenSystem = "";
    const recording: ModelClient = {
      name: "fake:aufzeichnung",
      complete: async (system) => {
        seenSystem = system;
        return "Woran erkennst du, dass das Lager bald ausfällt?";
      },
    };
    const result = await new ModelProvider(recording).interview([], "de");
    expect(result.question).toContain("Woran erkennst du");
    expect(seenSystem).toContain("genau EINE");
    expect(seenSystem).toContain("Du-Anrede");
    expect(seenSystem).toContain("höchstens 20 Wörter");
    expect(seenSystem).toContain("ausschließlich auf Deutsch");
    expect(seenSystem).toContain("Keine Floskeln");
  });

  it("EN-Prompt spiegelt dieselben Leitplanken", async () => {
    let seenSystem = "";
    const recording: ModelClient = {
      name: "fake:recorder",
      complete: async (system) => {
        seenSystem = system;
        return "How do you notice the bearing is about to fail?";
      },
    };
    await new ModelProvider(recording).interview([], "en");
    expect(seenSystem).toContain("exactly ONE");
    expect(seenSystem).toContain("at most 20 words");
    expect(seenSystem).toContain("in English only");
  });
});
