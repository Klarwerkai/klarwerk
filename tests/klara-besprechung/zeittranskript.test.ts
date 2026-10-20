import { expect, it } from "vitest";
import { cappedTranscriber } from "../../services/media";
import { lokalerTranskriber, whisperClient } from "../../services/media/src/transcriber";
it("vorhandener Whisperadapter fordert echte Zeitsegmente an und übernimmt nur tatsächlich gelieferte Zeiten", async () => {
  let calls = 0;
  const fetchFn = (async (_url: unknown, init?: RequestInit) => {
    calls++;
    const form = init?.body as FormData;
    expect(form.get("model")).toBe("whisper-1");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(form.get("timestamp_granularities[]")).toBe("segment");
    return new Response(
      JSON.stringify({
        text: "Aufgabe: Lizenz prüfen.",
        segments: [{ id: 1, start: 1.25, end: 3.5, text: "Aufgabe: Lizenz prüfen." }],
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  const c = cappedTranscriber(whisperClient({ apiKey: "synthetisch", fetchFn }), {
    rejectsConfidential: true,
  });
  if (!c.transcribeTimed) throw new Error("Zeitadapter fehlt");
  const r = await c.transcribeTimed(Buffer.from("synthetisch"), "audio/wav", "de", false);
  expect(r.segmente).toEqual([
    { id: "asr-1", startMs: 1250, endMs: 3500, text: "Aufgabe: Lizenz prüfen." },
  ]);
  expect(calls).toBe(1);
  await expect(
    c.transcribeTimed(Buffer.from("synthetisch"), "audio/wav", "de", true),
  ).rejects.toThrow();
  expect(calls).toBe(1);
});
it("fehlende oder ungültige Zeitsegmente und Anbieterausfall erzeugen keinen Textblock mit erfundenen Zeiten", async () => {
  for (const data of [
    { text: "nur Text" },
    { text: "Fehler", segments: [{ id: 1, start: 3, end: 2, text: "Fehler" }] },
  ]) {
    const c = lokalerTranskriber({
      basisUrl: "http://127.0.0.1:1/v1",
      lokal: true,
      fetchFn: (async () => new Response(JSON.stringify(data))) as typeof fetch,
    });
    await expect(
      c.transcribeTimed?.(Buffer.from("synthetisch"), "audio/wav", "de", false),
    ).rejects.toThrow();
  }
  let n = 0;
  const c = whisperClient({
    apiKey: "synthetisch",
    fetchFn: (async () => {
      n++;
      throw new Error("synthetischer Ausfall");
    }) as typeof fetch,
  });
  await expect(
    c.transcribeTimed?.(Buffer.from("synthetisch"), "audio/wav", "de", false),
  ).rejects.toThrow();
  expect(n).toBe(1);
});
