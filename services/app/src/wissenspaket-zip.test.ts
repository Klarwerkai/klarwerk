import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { WissenspaketZip } from "./wissenspaket-zip";

const jetzt = new Date("2026-10-22T00:00:00Z");

describe("P8 · serieller ZIP-Sink", () => {
  it("ein fehlgeschlagener Eintrag wird vollständig zurückgenommen; folgende Dateien samt CRC bleiben lesbar", async () => {
    const ordner = await mkdtemp(join(tmpdir(), "klarwerk-p8-zip-test-"));
    const pfad = join(ordner, "paket.zip");
    const zip = await WissenspaketZip.oeffne(pfad, jetzt);
    try {
      await zip.lege("erste.txt", [Buffer.from("Erste Datei")]);
      await expect(
        zip.lege("fehlgeschlagen.bin", async (senden) => {
          await senden(Buffer.alloc(100_000, 127));
          throw new Error("synthetischer Fehler nach Teilübertragung");
        }),
      ).rejects.toThrow("synthetischer Fehler");
      await zip.lege("ordner/letzte.txt", [Buffer.from("Letzte Datei")]);
      await zip.abschliessen();
      const gelesen = await JSZip.loadAsync(await readFile(pfad), { checkCRC32: true });
      expect(gelesen.file("fehlgeschlagen.bin")).toBeNull();
      expect(await gelesen.file("erste.txt")?.async("string")).toBe("Erste Datei");
      expect(await gelesen.file("ordner/letzte.txt")?.async("string")).toBe("Letzte Datei");
    } finally {
      await zip.schliessen();
      await rm(ordner, { recursive: true, force: true });
    }
  });

  it.each(["variabel", "klassisch"] as const)(
    "kleine %s Buffer-Ausgabe hält keine große Backing-Allocation",
    async (art) => {
      const zip =
        art === "variabel"
          ? WissenspaketZip.puffer(202 * 1024 * 1024, jetzt)
          : WissenspaketZip.festerPuffer(202 * 1024 * 1024, jetzt);
      try {
        await zip.lege("klein.txt", [Buffer.from("Klein")]);
        await zip.abschliessen();
        const bytes = zip.alsBuffer();
        expect(Buffer.isBuffer(bytes)).toBe(true);
        expect(bytes.buffer.byteLength).toBe(bytes.length);
        const gelesen = await JSZip.loadAsync(bytes, { checkCRC32: true });
        expect(await gelesen.file("klein.txt")?.async("string")).toBe("Klein");
      } finally {
        await zip.schliessen();
      }
    },
  );
});
