import { createHash } from "node:crypto";
import { type FileHandle, open } from "node:fs/promises";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createDeflateRaw } from "node:zlib";

const CRC_TABELLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let crc = n;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
  return crc >>> 0;
});

interface GroessenvariablerPuffer extends ArrayBuffer {
  readonly maxByteLength: number;
  resize(byteLength: number): void;
}
const VariablerPuffer = ArrayBuffer as unknown as {
  new (byteLength: number, options: { maxByteLength: number }): GroessenvariablerPuffer;
};

/** Serieller ZIP32-Sink mit DEFLATE/Datenbeschreibungen. Nur das kleine Zentralverzeichnis bleibt. */
export class WissenspaketZip {
  private offset = 0;
  private readonly verzeichnis: Buffer[] = [];
  private geschlossen = false;
  private constructor(
    private readonly datei: FileHandle | undefined,
    private readonly datum: Date,
    private readonly signal: AbortSignal | undefined,
    private puffer?: GroessenvariablerPuffer | Buffer,
  ) {}

  static async oeffne(pfad: string, datum: Date, signal?: AbortSignal): Promise<WissenspaketZip> {
    return new WissenspaketZip(await open(pfad, "wx", 0o600), datum, signal);
  }

  static puffer(groesse: number, datum: Date, signal?: AbortSignal): WissenspaketZip {
    if (typeof (ArrayBuffer.prototype as Partial<GroessenvariablerPuffer>).resize !== "function") {
      return WissenspaketZip.festerPuffer(groesse, datum, signal);
    }
    return new WissenspaketZip(
      undefined,
      datum,
      signal,
      new VariablerPuffer(0, { maxByteLength: groesse }),
    );
  }

  /** Normaler Buffer-Pfad für Laufzeiten ohne größenveränderliche ArrayBuffer. */
  static festerPuffer(groesse: number, datum: Date, signal?: AbortSignal): WissenspaketZip {
    return new WissenspaketZip(undefined, datum, signal, Buffer.allocUnsafeSlow(groesse));
  }

  alsBuffer(): Buffer {
    if (!this.puffer) throw new Error("Wissenspaket ist keine Buffer-Ausgabe.");
    if (Buffer.isBuffer(this.puffer)) {
      if (this.offset < this.puffer.length / 2) {
        const passend = Buffer.allocUnsafeSlow(this.offset);
        this.puffer.copy(passend, 0, 0, this.offset);
        this.puffer = passend;
      }
      return this.puffer.subarray(0, this.offset);
    }
    this.puffer.resize(this.offset);
    return Buffer.from(this.puffer, 0, this.offset);
  }

  private zeit(header: Buffer, offset: number): void {
    header.writeUInt16LE(
      (this.datum.getUTCHours() << 11) |
        (this.datum.getUTCMinutes() << 5) |
        (this.datum.getUTCSeconds() >>> 1),
      offset,
    );
    header.writeUInt16LE(
      ((Math.max(1980, this.datum.getUTCFullYear()) - 1980) << 9) |
        ((this.datum.getUTCMonth() + 1) << 5) |
        this.datum.getUTCDate(),
      offset + 2,
    );
  }

  private async schreiben(bytes: Buffer): Promise<void> {
    this.signal?.throwIfAborted();
    if (this.puffer) {
      const ende = this.offset + bytes.length;
      if (Buffer.isBuffer(this.puffer)) {
        if (ende > this.puffer.length) {
          const erweitert = Buffer.allocUnsafeSlow(Math.max(ende, this.puffer.length * 2));
          this.puffer.copy(erweitert, 0, 0, this.offset);
          this.puffer = erweitert;
        }
        bytes.copy(this.puffer, this.offset);
        this.offset = ende;
        return;
      }
      if (ende > this.puffer.maxByteLength) {
        const erweitert = new VariablerPuffer(ende, {
          maxByteLength: Math.max(ende, this.puffer.maxByteLength * 2),
        });
        Buffer.from(this.puffer).copy(Buffer.from(erweitert), 0, 0, this.offset);
        this.puffer.resize(0);
        this.puffer = erweitert;
      }
      if (ende > this.puffer.byteLength) {
        this.puffer.resize(
          Math.min(this.puffer.maxByteLength, Math.ceil(ende / (1024 * 1024)) * 1024 * 1024),
        );
      }
      bytes.copy(Buffer.from(this.puffer), this.offset);
      this.offset = ende;
      return;
    }
    if (!this.datei) throw new Error("Wissenspaket-Ausgabe fehlt.");
    let position = 0;
    while (position < bytes.length) {
      this.signal?.throwIfAborted();
      const { bytesWritten } = await this.datei.write(
        bytes,
        position,
        bytes.length - position,
        this.offset,
      );
      if (bytesWritten === 0) throw new Error("Wissenspaket konnte nicht geschrieben werden.");
      position += bytesWritten;
      this.offset += bytesWritten;
      if (this.offset > 0xffff_ffff)
        throw new Error("Wissenspaket überschreitet das ZIP32-Format.");
    }
  }

  async lege(
    name: string,
    quelle:
      | AsyncIterable<Buffer>
      | Iterable<Buffer>
      | ((schreiben: (teil: Buffer) => Promise<void>) => Promise<void>),
  ): Promise<{ bytes: number; sha256: string }> {
    const beginn = this.offset;
    const dateiname = Buffer.from(name, "utf8");
    if (dateiname.length > 0xffff || this.verzeichnis.length >= 0xffff) {
      throw new Error("Wissenspaket überschreitet das ZIP32-Format.");
    }
    const kopf = Buffer.alloc(30 + dateiname.length);
    kopf.writeUInt32LE(0x0403_4b50, 0);
    kopf.writeUInt16LE(20, 4);
    kopf.writeUInt16LE(0x0808, 6); // UTF8 und nachfolgende Datenbeschreibung
    kopf.writeUInt16LE(8, 8); // DEFLATE
    this.zeit(kopf, 10);
    kopf.writeUInt16LE(dateiname.length, 26);
    dateiname.copy(kopf, 30);
    let bytes = 0;
    let crc = 0xffff_ffff;
    const hash = createHash("sha256");
    let ausstehend = Promise.resolve();
    const ziel = new Writable({
      highWaterMark: 64 * 1024,
      write: (teil: Buffer, _encoding, callback) => {
        ausstehend = this.schreiben(teil);
        void ausstehend.then(
          () => callback(),
          (error: Error) => callback(error),
        );
      },
      destroy: (error, callback) => {
        void ausstehend.then(
          () => callback(error),
          () => callback(error),
        );
      },
    });
    const kompressor = createDeflateRaw({ chunkSize: 64 * 1024 });
    const lauf = pipeline(kompressor, ziel, { ...(this.signal ? { signal: this.signal } : {}) });
    void lauf.catch(() => {});
    try {
      await this.schreiben(kopf);
      const datenbeginn = this.offset;
      const senden = async (teil: Buffer): Promise<void> => {
        this.signal?.throwIfAborted();
        bytes += teil.length;
        if (bytes > 0xffff_ffff) throw new Error("Wissenspaket überschreitet das ZIP32-Format.");
        hash.update(teil);
        for (let i = 0; i < teil.length; i += 1)
          crc = (CRC_TABELLE[(crc ^ (teil[i] ?? 0)) & 0xff] ?? 0) ^ (crc >>> 8);
        // Callback bestätigt, dass zlib den Eingang verbraucht hat: erst danach ist Wiederverwendung sicher.
        await new Promise<void>((resolve, reject) => {
          kompressor.write(teil, (error) => (error ? reject(error) : resolve()));
        });
      };
      if (typeof quelle === "function") await quelle(senden);
      else for await (const teil of quelle) await senden(teil);
      kompressor.end();
      await lauf;
      const gepackt = this.offset - datenbeginn;
      crc = (crc ^ 0xffff_ffff) >>> 0;
      const beschreibung = Buffer.alloc(16);
      beschreibung.writeUInt32LE(0x0807_4b50, 0);
      beschreibung.writeUInt32LE(crc, 4);
      beschreibung.writeUInt32LE(gepackt, 8);
      beschreibung.writeUInt32LE(bytes, 12);
      await this.schreiben(beschreibung);
      const eintrag = Buffer.alloc(46 + dateiname.length);
      eintrag.writeUInt32LE(0x0201_4b50, 0);
      eintrag.writeUInt16LE(20, 4);
      eintrag.writeUInt16LE(20, 6);
      eintrag.writeUInt16LE(0x0808, 8);
      eintrag.writeUInt16LE(8, 10);
      this.zeit(eintrag, 12);
      eintrag.writeUInt32LE(crc, 16);
      eintrag.writeUInt32LE(gepackt, 20);
      eintrag.writeUInt32LE(bytes, 24);
      eintrag.writeUInt16LE(dateiname.length, 28);
      eintrag.writeUInt32LE(beginn, 42);
      dateiname.copy(eintrag, 46);
      this.verzeichnis.push(eintrag);
      return { bytes, sha256: hash.digest("hex") };
    } catch (error) {
      kompressor.destroy(error instanceof Error ? error : new Error("Wissenspaket abgebrochen."));
      await lauf.catch(() => {});
      await this.datei?.truncate(beginn);
      this.offset = beginn;
      throw error;
    } finally {
      kompressor.destroy();
    }
  }

  async abschliessen(): Promise<void> {
    const beginn = this.offset;
    for (const eintrag of this.verzeichnis) await this.schreiben(eintrag);
    const ende = Buffer.alloc(22);
    ende.writeUInt32LE(0x0605_4b50, 0);
    ende.writeUInt16LE(this.verzeichnis.length, 8);
    ende.writeUInt16LE(this.verzeichnis.length, 10);
    ende.writeUInt32LE(this.offset - beginn, 12);
    ende.writeUInt32LE(beginn, 16);
    await this.schreiben(ende);
    await this.schliessen();
  }

  async schliessen(): Promise<void> {
    if (!this.geschlossen) {
      this.geschlossen = true;
      await this.datei?.close();
    }
  }
}
