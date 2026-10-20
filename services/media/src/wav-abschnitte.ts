/** Begrenzter PCM-WAV-Weg. RIFF-Chunks werden gelesen, keine Audiozeit geraten.
 * Format/Framebindung: https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex
 * https://learn.microsoft.com/en-us/windows/win32/xaudio2/resource-interchange-file-format--riff-
 */
export interface WavAbschnitt {
  vonFrame: number;
  bisFrame: number;
}
export function liesPcmWav(bytes: Buffer) {
  if (
    bytes.length < 44 ||
    bytes.length > 20 * 1024 * 1024 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE" ||
    bytes.readUInt32LE(4) + 8 !== bytes.length
  )
    throw new Error(
      "Für fortsetzbare Teile eine vollständige PCM-WAV-Datei verwenden (maximal 20 MB).",
    );
  let format: Buffer | undefined;
  let daten: Buffer | undefined;
  let pos = 12;
  while (pos < bytes.length) {
    if (pos + 8 > bytes.length) throw new Error("Unvollständiger WAV-Chunk.");
    const art = bytes.toString("ascii", pos, pos + 4);
    const laenge = bytes.readUInt32LE(pos + 4);
    const ende = pos + 8 + laenge;
    if (ende + (laenge % 2) > bytes.length) throw new Error("Unvollständiger WAV-Chunk.");
    if (art === "fmt ") {
      if (format) throw new Error("Doppeltes WAV-Format.");
      format = bytes.subarray(pos + 8, ende);
    }
    if (art === "data") {
      if (daten) throw new Error("Doppelte WAV-Daten.");
      daten = bytes.subarray(pos + 8, ende);
    }
    pos = ende + (laenge % 2);
  }
  if (!format || format.length < 16 || !daten?.length || format.readUInt16LE(0) !== 1)
    throw new Error("Nur unkomprimiertes PCM-WAV kann fortgesetzt werden.");
  const kanaele = format.readUInt16LE(2);
  const rate = format.readUInt32LE(4);
  const block = format.readUInt16LE(12);
  const bits = format.readUInt16LE(14);
  if (
    ![1, 2].includes(kanaele) ||
    rate < 8000 ||
    rate > 48000 ||
    bits !== 16 ||
    block !== kanaele * 2 ||
    format.readUInt32LE(8) !== rate * block ||
    daten.length % block !== 0
  )
    throw new Error("PCM-WAV mit 16 Bit, 1–2 Kanälen und 8–48 kHz erforderlich.");
  return { daten, format: format.subarray(0, 16), rate, block, frames: daten.length / block };
}
export function wavPlan(bytes: Buffer) {
  const w = liesPcmWav(bytes);
  const schritt = w.rate * 30;
  const teile = Array.from({ length: Math.ceil(w.frames / schritt) }, (_, i) => ({
    id: `teil-${i + 1}`,
    vonFrame: i * schritt,
    bisFrame: Math.min((i + 1) * schritt, w.frames),
    startMs: i * 30000,
    endMs: (Math.min((i + 1) * schritt, w.frames) * 1000) / w.rate,
    fertig: false,
  }));
  if (teile.length > 300) throw new Error("Höchstens 300 Audioabschnitte.");
  return teile;
}
export function wavAusschnitt(bytes: Buffer, bereich: WavAbschnitt): Buffer {
  const w = liesPcmWav(bytes);
  const { vonFrame, bisFrame } = bereich;
  if (
    !Number.isSafeInteger(vonFrame) ||
    !Number.isSafeInteger(bisFrame) ||
    vonFrame < 0 ||
    bisFrame <= vonFrame ||
    bisFrame > w.frames
  )
    throw new Error("Ungültige PCM-Framegrenze.");
  const daten = w.daten.subarray(vonFrame * w.block, bisFrame * w.block);
  const kopf = Buffer.alloc(44);
  kopf.write("RIFF", 0);
  kopf.writeUInt32LE(36 + daten.length, 4);
  kopf.write("WAVEfmt ", 8);
  kopf.writeUInt32LE(16, 16);
  w.format.copy(kopf, 20);
  kopf.write("data", 36);
  kopf.writeUInt32LE(daten.length, 40);
  return Buffer.concat([kopf, daten]);
}
