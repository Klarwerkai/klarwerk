/** Synthetische PCM-Marker, KEIN gesprochener Ton/ASR-Qualitätsbeleg. */
export function pcmQuelle(sekunden = 65) {
  const rate = 8000;
  const daten = Buffer.alloc(rate * sekunden * 2);
  for (let i = 0; i < daten.length / 2; i++)
    daten.writeInt16LE((Math.floor(i / (rate * 30)) + 1) * 100, i * 2);
  const b = Buffer.alloc(44);
  b.write("RIFF");
  b.writeUInt32LE(36 + daten.length, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(daten.length, 40);
  return Buffer.concat([b, daten]);
}
export function markerAntwort(
  marker: number,
  text = `Aufgabe: Synthetischen Teil ${marker} prüfen.`,
) {
  return { text, segmente: [{ id: "asr-0", startMs: 0, endMs: 1000, text }] };
}
