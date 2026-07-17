import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { InMemoryObjectRepo, ObjectStore } from "../../object-store";
import { MediaAnalysisService } from "./service";
import { cappedTranscriber, createTranscriberFromEnv, whisperClient } from "./transcriber";
import { MediaAnalysisError, type Transcriber, TranscriberConfidentialError } from "./types";

// SCRUM-382: Analyse = ehrlich. Mit Dienst → echtes Transkript samt Herkunft; ohne Dienst →
// klarer Inaktiv-Zustand statt erfundenem Text (G-2). Nur video/audio wird akzeptiert.
const videoDataUrl = `data:video/mp4;base64,${Buffer.from("fake-bytes").toString("base64")}`;

function makeStore(): ObjectStore {
  return new ObjectStore({ repo: new InMemoryObjectRepo() });
}

const fakeTranscriber: Transcriber = {
  name: "fake:test",
  transcribe: async (_bytes, _mime, locale) =>
    locale === "de" ? "Spindel nur im Stillstand schmieren." : "Grease only at standstill.",
};

describe("SCRUM-382: MediaAnalysisService", () => {
  it("transkribiert ein Video-Objekt und weist die Herkunft aus", async () => {
    const objects = makeStore();
    const ref = await objects.put({ name: "anlage4.mp4", mime: "video/mp4", data: videoDataUrl });
    const media = new MediaAnalysisService({ objects, transcriber: fakeTranscriber });
    const result = await media.analyze(ref.id, "de", false);
    expect(result.engineActive).toBe(true);
    expect(result.engine).toBe("fake:test");
    expect(result.transcript).toContain("Stillstand");
  });

  it("ohne Dienst: ehrlicher Inaktiv-Zustand, kein erfundenes Transkript", async () => {
    const objects = makeStore();
    const ref = await objects.put({ name: "a.mp3", mime: "audio/mpeg", data: videoDataUrl });
    const media = new MediaAnalysisService({ objects });
    const result = await media.analyze(ref.id, "de", false);
    expect(result.engineActive).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.note).toContain("nicht aktiv");
  });

  it("weist Nicht-Video-Objekte ab (UNSUPPORTED_KIND)", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "foto.png",
      mime: "image/png",
      data: `data:image/png;base64,${Buffer.from("x").toString("base64")}`,
    });
    const media = new MediaAnalysisService({ objects, transcriber: fakeTranscriber });
    await expect(media.analyze(ref.id, "de", false)).rejects.toMatchObject({
      code: "UNSUPPORTED_KIND",
    });
  });

  it("unbekanntes Objekt → NOT_FOUND, Dienstfehler → ENGINE_FAILED", async () => {
    const objects = makeStore();
    const media = new MediaAnalysisService({ objects, transcriber: fakeTranscriber });
    await expect(media.analyze("gibt-es-nicht", "de", false)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const ref = await objects.put({ name: "b.mp4", mime: "video/mp4", data: videoDataUrl });
    const kaputt = new MediaAnalysisService({
      objects,
      transcriber: {
        name: "fake:kaputt",
        transcribe: async () => {
          throw new Error("503");
        },
      },
    });
    await expect(kaputt.analyze(ref.id, "de", false)).rejects.toBeInstanceOf(MediaAnalysisError);
  });

  it("whisperClient ruft die API korrekt auf (injizierter fetch, kein Netz)", async () => {
    let seenAuth = "";
    let seenUrl = "";
    const client = whisperClient({
      apiKey: "test-key",
      fetchFn: async (url, init) => {
        seenUrl = String(url);
        seenAuth = String(
          (init?.headers as Record<string, string> | undefined)?.authorization ?? "",
        );
        return new Response(JSON.stringify({ text: "Hallo" }), { status: 200 });
      },
    });
    const text = await client.transcribe(Buffer.from("x"), "video/mp4", "de", false);
    expect(text).toBe("Hallo");
    expect(seenUrl).toContain("/v1/audio/transcriptions");
    expect(seenAuth).toBe("Bearer test-key");
  });

  it("createTranscriberFromEnv: ohne Schlüssel undefined, mit Schlüssel benannt", () => {
    expect(createTranscriberFromEnv({})).toBeUndefined();
    expect(createTranscriberFromEnv({ OPENAI_API_KEY: "k" })?.name).toBe("openai:whisper-1");
    expect(
      createTranscriberFromEnv({ MEDIA_TRANSCRIBE_API_KEY: "k", MEDIA_TRANSCRIBE_MODEL: "m9" })
        ?.name,
    ).toBe("openai:m9");
  });

  // SCRUM-502 R7: vertrauliches Medium → KEIN externer Transkriptions-Egress (Spy nie aufgerufen).
  it("vertrauliches Medium → Transcriber-Spy NIE aufgerufen, ehrlicher Hinweis", async () => {
    const objects = makeStore();
    const ref = await objects.put({ name: "geheim.mp4", mime: "video/mp4", data: videoDataUrl });
    let called = false;
    const spy: Transcriber = {
      name: "spy",
      transcribe: async () => {
        called = true;
        return "darf nie laufen";
      },
    };
    const media = new MediaAnalysisService({ objects, transcriber: spy });
    const result = await media.analyze(ref.id, "de", true); // vertraulich
    expect(called).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.engineActive).toBe(false);
    expect(result.note).toContain("Vertrauliche");
  });

  it("nicht vertrauliches Medium → Transcriber läuft (Positiv-Kontrolle)", async () => {
    const objects = makeStore();
    const ref = await objects.put({ name: "ok.mp4", mime: "video/mp4", data: videoDataUrl });
    let called = false;
    const spy: Transcriber = {
      name: "spy",
      transcribe: async () => {
        called = true;
        return "Transkript";
      },
    };
    const media = new MediaAnalysisService({ objects, transcriber: spy });
    const result = await media.analyze(ref.id, "de", false);
    expect(called).toBe(true);
    expect(result.transcript).toBe("Transkript");
  });

  // SCRUM-502 R7: der Chokepoint-Wächter (cappedTranscriber mit rejectsConfidential) wirft bei
  // confidential=true, OHNE den inneren (echten) Transkriber zu rufen — kein Egress by construction.
  it("cappedTranscriber(rejectsConfidential) wirft bei confidential, inner nie aufgerufen", async () => {
    let innerCalled = false;
    const inner: Transcriber = {
      name: "cloud",
      transcribe: async () => {
        innerCalled = true;
        return "x";
      },
    };
    const capped = cappedTranscriber(inner, { rejectsConfidential: true });
    await expect(
      capped.transcribe(Buffer.from("x"), "video/mp4", "de", true),
    ).rejects.toBeInstanceOf(TranscriberConfidentialError);
    expect(innerCalled).toBe(false);
    // nicht vertraulich → reicht durch
    expect(await capped.transcribe(Buffer.from("x"), "video/mp4", "de", false)).toBe("x");
  });
});
