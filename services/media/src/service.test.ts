import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { InMemoryObjectRepo, ObjectStore } from "../../object-store";
import { MediaAnalysisService, mediaIsConfidential } from "./service";
import { cappedTranscriber, createTranscriberFromEnv, whisperClient } from "./transcriber";
import { MediaAnalysisError, type Transcriber, TranscriberConfidentialError } from "./types";

// SCRUM-382: Analyse = ehrlich. Mit Dienst → echtes Transkript samt Herkunft; ohne Dienst →
// klarer Inaktiv-Zustand statt erfundenem Text (G-2). Nur video/audio wird akzeptiert.
// SCRUM-521 (WP1): die Vertraulichkeit für die Egress-Entscheidung stammt AUSSCHLIESSLICH aus dem
// gespeicherten Objekt (`put({ confidentiality })`), nie aus dem Analyse-Request. Der Request-Parameter
// darf nur HOCHSTUFEN. Fehlt der persistierte Wert, gilt fail-safe vertraulich → kein externer Egress.
const videoDataUrl = `data:video/mp4;base64,${Buffer.from("fake-bytes").toString("base64")}`;

function makeStore(): ObjectStore {
  return new ObjectStore({ repo: new InMemoryObjectRepo() });
}

// Ein Spy-Transcriber, der markiert, ob er (= ein externer Egress) je aufgerufen wurde.
function makeSpy(): { transcriber: Transcriber; wasCalled: () => boolean } {
  let called = false;
  return {
    transcriber: {
      name: "spy",
      transcribe: async () => {
        called = true;
        return "darf nur bei nicht-vertraulich laufen";
      },
    },
    wasCalled: () => called,
  };
}

const fakeTranscriber: Transcriber = {
  name: "fake:test",
  transcribe: async (_bytes, _mime, locale) =>
    locale === "de" ? "Spindel nur im Stillstand schmieren." : "Grease only at standstill.",
};

describe("SCRUM-382/521: MediaAnalysisService", () => {
  it("transkribiert ein als intern gespeichertes Video-Objekt und weist die Herkunft aus", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "anlage4.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const media = new MediaAnalysisService({ objects, transcriber: fakeTranscriber });
    const result = await media.analyze(ref.id, "de");
    expect(result.engineActive).toBe(true);
    expect(result.engine).toBe("fake:test");
    expect(result.transcript).toContain("Stillstand");
  });

  it("ohne Dienst: ehrlicher Inaktiv-Zustand, kein erfundenes Transkript", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "a.mp3",
      mime: "audio/mpeg",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const media = new MediaAnalysisService({ objects });
    const result = await media.analyze(ref.id, "de");
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
    await expect(media.analyze(ref.id, "de")).rejects.toMatchObject({
      code: "UNSUPPORTED_KIND",
    });
  });

  it("unbekanntes Objekt → NOT_FOUND, Dienstfehler → ENGINE_FAILED", async () => {
    const objects = makeStore();
    const media = new MediaAnalysisService({ objects, transcriber: fakeTranscriber });
    await expect(media.analyze("gibt-es-nicht", "de")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const ref = await objects.put({
      name: "b.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const kaputt = new MediaAnalysisService({
      objects,
      transcriber: {
        name: "fake:kaputt",
        transcribe: async () => {
          throw new Error("503");
        },
      },
    });
    await expect(kaputt.analyze(ref.id, "de")).rejects.toBeInstanceOf(MediaAnalysisError);
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

  // === SCRUM-521 (WP1): Egress-Entscheidung AUSSCHLIESSLICH serverseitig ============================

  // KERN-TEST der Lücke: das Objekt ist serverseitig als vertraulich gespeichert, der Analyse-Request
  // behauptet "intern" (Herabstufungsversuch) → der externe Transcriber-Spy darf NIE laufen.
  // Ohne den Fix (Route reicht die Client-Stufe als Wahrheit durch) liefe der Spy → Test schlägt fehl.
  it("gespeichert vertraulich + Request 'intern' → Transcriber-Spy NIE aufgerufen (keine Herabstufung)", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "geheim.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "vertraulich",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({ objects, transcriber: spy.transcriber });
    const result = await media.analyze(ref.id, "de", "intern"); // Client versucht herabzustufen
    expect(spy.wasCalled()).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.engineActive).toBe(false);
    expect(result.note).toContain("Vertrauliche");
  });

  it("gespeichert streng_vertraulich + Request 'intern' → Spy NIE aufgerufen", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "top.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "streng_vertraulich",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({ objects, transcriber: spy.transcriber });
    await media.analyze(ref.id, "de", "intern");
    expect(spy.wasCalled()).toBe(false);
  });

  // Fail-safe: FEHLT die persistierte Stufe (Alt-/Fremd-Objekt), gilt vertraulich → kein Egress, selbst
  // wenn der Request "intern" behauptet. Ohne Fail-safe (undefined → transcribe) liefe der Spy.
  it("keine gespeicherte Stufe + Request 'intern' → fail-safe vertraulich, Spy NIE aufgerufen", async () => {
    const objects = makeStore();
    const ref = await objects.put({ name: "alt.mp4", mime: "video/mp4", data: videoDataUrl });
    const spy = makeSpy();
    const media = new MediaAnalysisService({ objects, transcriber: spy.transcriber });
    const result = await media.analyze(ref.id, "de", "intern");
    expect(spy.wasCalled()).toBe(false);
    expect(result.engineActive).toBe(false);
  });

  // Positiv-Kontrolle: ein als intern gespeichertes Medium wird transkribiert (Egress erlaubt).
  it("gespeichert intern → Transcriber läuft (Positiv-Kontrolle)", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "ok.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({ objects, transcriber: spy.transcriber });
    const result = await media.analyze(ref.id, "de");
    expect(spy.wasCalled()).toBe(true);
    expect(result.transcript).not.toBeNull();
  });

  // Der Request darf HOCHSTUFEN: intern gespeichert + Request "vertraulich" → kein Egress.
  it("gespeichert intern + Request 'vertraulich' → Hochstufung greift, Spy NIE aufgerufen", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "hoch.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({ objects, transcriber: spy.transcriber });
    const result = await media.analyze(ref.id, "de", "vertraulich"); // Hochstufung
    expect(spy.wasCalled()).toBe(false);
    expect(result.note).toContain("Vertrauliche");
  });

  // Reine Entscheidungslogik: stored ist Basis, request nur Hochstufung, fail-safe bei fehlend/ungültig.
  it("mediaIsConfidential: stored = Wahrheit, request nur Hochstufung, fail-safe vertraulich", () => {
    // stored intern → nicht vertraulich; Request kann nur hochstufen.
    expect(mediaIsConfidential("intern")).toBe(false);
    expect(mediaIsConfidential("intern", "intern")).toBe(false);
    expect(mediaIsConfidential("intern", "vertraulich")).toBe(true); // Hochstufung
    expect(mediaIsConfidential("intern", "streng_vertraulich")).toBe(true);
    // stored vertraulich/streng → immer vertraulich; Request kann NICHT herabstufen.
    expect(mediaIsConfidential("vertraulich", "intern")).toBe(true);
    expect(mediaIsConfidential("streng_vertraulich", "intern")).toBe(true);
    // fehlt/ungültig stored → fail-safe vertraulich.
    expect(mediaIsConfidential(undefined)).toBe(true);
    expect(mediaIsConfidential("quatsch")).toBe(true);
    // ungültiger Request wird ignoriert (keine Hochstufung, aber auch keine Senkung).
    expect(mediaIsConfidential("intern", "quatsch")).toBe(false);
  });

  // === SCRUM-521 (WP2, nacht24): KO-Kontext — restriktivste Stufe gewinnt ==========================

  it("mediaIsConfidential: KO-Stufen heben an (restriktivste gewinnt), senken NIE", () => {
    // Ein vertrauliches Bezugs-KO macht das intern gespeicherte Medium vertraulich.
    expect(mediaIsConfidential("intern", undefined, ["vertraulich"])).toBe(true);
    expect(mediaIsConfidential("intern", undefined, ["intern", "streng_vertraulich"])).toBe(true);
    // Interne/leere KO-Kontexte ändern nichts.
    expect(mediaIsConfidential("intern", undefined, ["intern"])).toBe(false);
    expect(mediaIsConfidential("intern", undefined, [])).toBe(false);
    // KO-Stufen können ein vertraulich gespeichertes Medium NIE senken.
    expect(mediaIsConfidential("vertraulich", undefined, ["intern"])).toBe(true);
    // FUNKE-FIX P2 (bens Sammel-Nacht): ein PRÄSENTER, aber unbekannter/korrupter KO-Stufenwert wird
    // fail-closed auf den höchsten Rang angehoben (kein externer Egress) statt wie „intern" freigegeben.
    expect(mediaIsConfidential("intern", undefined, ["quatsch"])).toBe(true);
    expect(mediaIsConfidential("intern", undefined, ["intern", "geheim?"])).toBe(true);
  });

  // KERN der WP2-Lücke: das Objekt wurde „intern" hochgeladen, hängt aber an einem VERTRAULICHEN
  // KO → der externe Transcriber-Spy darf NIE laufen (der KO-Kontext gewinnt serverseitig).
  it("intern gespeichert, aber Anhang eines vertraulichen KO → Spy NIE aufgerufen", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "anlage-intern.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({
      objects,
      transcriber: spy.transcriber,
      koConfidentiality: async () => ["vertraulich"],
    });
    const result = await media.analyze(ref.id, "de");
    expect(spy.wasCalled()).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.engineActive).toBe(false);
    expect(result.note).toContain("Vertrauliche");
  });

  // Positiv-Kontrolle: KO-Kontext intern (oder kein KO-Bezug) → öffentliches Medium unverändert.
  it("intern gespeichert + KO-Kontext intern/leer → Transcriber läuft unverändert", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "ok2.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({
      objects,
      transcriber: spy.transcriber,
      koConfidentiality: async () => ["intern"],
    });
    const result = await media.analyze(ref.id, "de");
    expect(spy.wasCalled()).toBe(true);
    expect(result.transcript).not.toBeNull();
  });

  // FUNKE-FIX P2 (bens Sammel-Nacht) Pflichttest: ein intern gespeichertes Medium an einem KO mit
  // UNBEKANNTEM/korruptem Stufenwert wird fail-closed behandelt → der externe Transcriber-Spy wird
  // NIE aufgerufen (Aufruf-Zahl 0). Ohne den Fix (unbekannt = intern) liefe der Spy.
  it("intern gespeichert, aber KO mit unbekannter Stufe → Spy NIE aufgerufen (fail-closed)", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "legacy.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({
      objects,
      transcriber: spy.transcriber,
      koConfidentiality: async () => ["geheim-legacy-wert"], // unerwarteter Legacy-Wert
    });
    const result = await media.analyze(ref.id, "de");
    expect(spy.wasCalled()).toBe(false);
    expect(result.transcript).toBeNull();
    expect(result.engineActive).toBe(false);
    expect(result.note).toContain("Vertrauliche");
  });

  // Fail-safe: scheitert die KO-Kontext-Auflösung, wird NIE egresst (ehrlicher Status).
  it("KO-Kontext-Auflösung wirft → fail-safe vertraulich, Spy NIE aufgerufen", async () => {
    const objects = makeStore();
    const ref = await objects.put({
      name: "unklar.mp4",
      mime: "video/mp4",
      data: videoDataUrl,
      confidentiality: "intern",
    });
    const spy = makeSpy();
    const media = new MediaAnalysisService({
      objects,
      transcriber: spy.transcriber,
      koConfidentiality: async () => {
        throw new Error("Repo nicht erreichbar");
      },
    });
    const result = await media.analyze(ref.id, "de");
    expect(spy.wasCalled()).toBe(false);
    expect(result.engineActive).toBe(false);
    expect(result.note).toContain("Vertrauliche");
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
