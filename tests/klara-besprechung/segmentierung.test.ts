import { expect, it } from "vitest";
import { MediaAnalysisService, cappedTranscriber } from "../../services/media";
import { liesPcmWav, wavAusschnitt, wavPlan } from "../../services/media/src/wav-abschnitte";
import { ObjectStore, InMemoryObjectRepo } from "../../services/object-store";
import { pcmQuelle, markerAntwort } from "./segment-fixture";

it("PCM-Plan teilt echte Frames ohne Lücke/Dublette; unbekannte RIFF-Chunks verschieben keine Audiogrenze", () => {
  const bytes = pcmQuelle();
  const plan = wavPlan(bytes);
  expect(plan.map((p) => [p.startMs, p.endMs])).toEqual([
    [0, 30000],
    [30000, 60000],
    [60000, 65000],
  ]);
  const original = liesPcmWav(bytes).daten;
  const teile = plan.map((p) => liesPcmWav(wavAusschnitt(bytes, p)).daten);
  expect(Buffer.concat(teile)).toEqual(original);
  expect(teile.map((p) => p.readInt16LE(0))).toEqual([100, 200, 300]);
  const junk = Buffer.from([74, 85, 78, 75, 1, 0, 0, 0, 88, 0]);
  const extra = Buffer.concat([bytes.subarray(0, 12), junk, bytes.subarray(12)]);
  extra.writeUInt32LE(extra.length - 8, 4);
  expect(liesPcmWav(extra).daten).toEqual(original);
});
it("Defektes/komprimiertes WAV und geratene Framegrenzen erzeugen keine angebliche Teilquelle", () => {
  const bytes = pcmQuelle(1);
  const kaputt = Buffer.from(bytes);
  kaputt.writeUInt16LE(3, 20);
  expect(() => wavPlan(kaputt)).toThrow(/PCM/);
  expect(() => wavPlan(bytes.subarray(0, -1))).toThrow();
  expect(() => wavAusschnitt(bytes, { vonFrame: 0.5, bisFrame: 20 })).toThrow();
  expect(() => wavAusschnitt(bytes, { vonFrame: 0, bisFrame: 9000 })).toThrow();
});
it("derselbe Medien-/Vertraulichkeitsweg erhält nur Abschnittbytes und reicht AbortSignal an erlaubten Adapter", async () => {
  const objects = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const ref = await objects.put({
    name: "quelle.wav",
    mime: "audio/wav",
    kind: "video",
    data: `data:audio/wav;base64,${pcmQuelle().toString("base64")}`,
    confidentiality: "intern",
  });
  const c = new AbortController();
  let marker = 0;
  let signal: AbortSignal | undefined;
  const media = new MediaAnalysisService({
    objects,
    transcriber: cappedTranscriber(
      {
        name: "kontrolliert-lokal",
        lokal: true,
        transcribe: async () => {
          throw Error("kein anderer Weg");
        },
        transcribeTimed: async (bytes, _m, _l, _v, s) => {
          marker = liesPcmWav(bytes).daten.readInt16LE(0);
          signal = s;
          return markerAntwort(marker);
        },
      },
      { rejectsConfidential: false },
    ),
  });
  const r = await media.analyze(ref.id, "de", undefined, true, wavPlan(pcmQuelle())[1], c.signal);
  expect(marker).toBe(200);
  expect(signal).toBe(c.signal);
  expect(r.zeittranskript?.segmente[0]?.startMs).toBe(0);
});
