export const DOCX_MAX_COMPRESSED_BYTES = 50 * 1024 * 1024;
export const DOCX_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
export const DOCX_MAX_ENTRIES = 4000;
export const DOCX_MAX_EXPANSION_RATIO = 100;

export type DocxImportErrorReason =
  | "file-too-large"
  | "archive-too-large"
  | "too-many-entries"
  | "expansion-ratio"
  | "invalid-archive";

export class DocxImportError extends Error {
  constructor(readonly reason: DocxImportErrorReason) {
    super(`DOCX_IMPORT:${reason}`);
    this.name = "DocxImportError";
  }
}

export function assertDocxFileSize(size: number): void {
  if (!Number.isSafeInteger(size) || size < 0 || size > DOCX_MAX_COMPRESSED_BYTES) {
    throw new DocxImportError("file-too-large");
  }
}

interface Entry {
  compressed: number;
  original: number;
  name: string;
  start: number;
  end: number;
}

function centralEntries(data: Uint8Array): Entry[] {
  const bad = (): never => {
    throw new DocxImportError("invalid-archive");
  };
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const fits = (offset: number, length: number) => offset >= 0 && offset + length <= data.length;
  let eocd = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i -= 1) {
    if (
      view.getUint32(i, true) === 0x06054b50 &&
      i + 22 + view.getUint16(i + 20, true) === data.length
    ) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return bad();
  const count = view.getUint16(eocd + 10, true);
  if (count > DOCX_MAX_ENTRIES) throw new DocxImportError("too-many-entries");
  const size = view.getUint32(eocd + 12, true);
  const start = view.getUint32(eocd + 16, true);
  if (
    view.getUint16(eocd + 4, true) ||
    view.getUint16(eocd + 6, true) ||
    view.getUint16(eocd + 8, true) !== count ||
    start + size !== eocd ||
    !fits(start, size)
  )
    return bad();
  const entries: Entry[] = [];
  const names = new Set<string>();
  let total = 0;
  let offset = start;
  for (let i = 0; i < count; i += 1) {
    if (!fits(offset, 46) || view.getUint32(offset, true) !== 0x02014b50) return bad();
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const original = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    if (
      flags & 1 ||
      (method !== 0 && method !== 8) ||
      view.getUint16(offset + 34, true) ||
      compressed === 0xffffffff ||
      original === 0xffffffff ||
      local === 0xffffffff ||
      !fits(offset + 46, nameLength + extraLength + commentLength) ||
      !fits(local, 30) ||
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method
    )
      return bad();
    const localNameLength = view.getUint16(local + 26, true);
    const payload = local + 30 + localNameLength + view.getUint16(local + 28, true);
    if (
      nameLength !== localNameLength ||
      !fits(local + 30, localNameLength) ||
      payload + compressed > start
    )
      return bad();
    for (let n = 0; n < nameLength; n += 1) {
      if (data[offset + 46 + n] !== data[local + 30 + n]) return bad();
    }
    const nameBytes = data.subarray(offset + 46, offset + 46 + nameLength);
    // fflate behandelt ZIP-Namen ohne UTF8-Flag als Einbytezeichen.
    const name =
      flags & 0x800
        ? new TextDecoder("utf-8", { fatal: true }).decode(nameBytes)
        : Array.from(nameBytes, (b) => String.fromCharCode(b)).join("");
    if (names.has(name) || name.split("/").some((part) => part === "..") || name.includes("\\"))
      return bad();
    names.add(name);
    if (
      !(flags & 8) &&
      (view.getUint32(local + 18, true) !== compressed ||
        view.getUint32(local + 22, true) !== original)
    )
      return bad();
    if (original > 0 && (compressed === 0 || original / compressed > DOCX_MAX_EXPANSION_RATIO)) {
      throw new DocxImportError("expansion-ratio");
    }
    total += original;
    if (total > DOCX_MAX_UNCOMPRESSED_BYTES) throw new DocxImportError("archive-too-large");
    entries.push({ compressed, original, name, start: local, end: payload + compressed });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== eocd) return bad();
  const ordered = [...entries].sort((a, b) => a.start - b.start);
  for (let i = 1; i < ordered.length; i += 1) {
    if ((ordered[i]?.start ?? 0) < (ordered[i - 1]?.end ?? 0)) return bad();
  }
  return entries;
}

/** Der browserfähige, pausierbare JSZip-Port fehlt lediglich in dessen älterer Typdeklaration. */
interface ZipContentStream {
  on(event: "data", listener: (chunk: Uint8Array) => void): ZipContentStream;
  on(event: "end", listener: () => void): ZipContentStream;
  on(event: "error", listener: (error: unknown) => void): ZipContentStream;
  pause(): ZipContentStream;
  resume(): ZipContentStream;
}

/** Vor Mammoth: Verzeichnisgrenzen UND tatsächliche Bytes, ohne den Inhalt aufzusammeln. */
export async function assertDocxArchive(buffer: ArrayBuffer): Promise<void> {
  assertDocxFileSize(buffer.byteLength);
  const data = new Uint8Array(buffer);
  let entries: Entry[];
  try {
    entries = centralEntries(data);
  } catch (error) {
    if (error instanceof DocxImportError) throw error;
    throw new DocxImportError("invalid-archive");
  }
  // JSZip ist bereits Browser- UND Server-Abhängigkeit; kein zusätzlicher fflate-Laufzeitbedarf.
  // Ein gescheiterter Bundle-Import bleibt für den vorhandenen Neu-laden-Weg unverändert.
  const mod = await import("jszip");
  const JSZip = mod.default ?? mod;
  let archive: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    archive = await JSZip.loadAsync(buffer, { createFolders: false });
  } catch {
    throw new DocxImportError("invalid-archive");
  }
  if (Object.keys(archive.files).length > entries.length)
    throw new DocxImportError("invalid-archive");
  let total = 0;
  for (const file of Object.values(archive.files)) {
    if (file.dir) continue;
    // internalStream ist der öffentliche, auch im Browser vorhandene StreamHelper-Port.
    const stream = (
      file as unknown as {
        internalStream(type: "uint8array"): ZipContentStream;
      }
    ).internalStream("uint8array");
    await new Promise<void>((resolve, reject) => {
      let done = false;
      let entryBytes = 0;
      const stop = (reason: DocxImportErrorReason) => {
        if (done) return;
        done = true;
        stream.pause();
        reject(new DocxImportError(reason));
      };
      stream.on("data", (chunk) => {
        if (done) return;
        entryBytes += chunk.byteLength;
        total += chunk.byteLength;
        if (entryBytes > DOCX_MAX_UNCOMPRESSED_BYTES || total > DOCX_MAX_UNCOMPRESSED_BYTES) {
          stop("archive-too-large");
        } else if (total > buffer.byteLength * DOCX_MAX_EXPANSION_RATIO) {
          stop("expansion-ratio");
        }
      });
      // JSZip prüft außerdem seine deklarierte Eintragslänge gegen die tatsächlichen Bytes.
      stream.on("error", () => stop("invalid-archive"));
      stream.on("end", () => {
        if (!done) {
          done = true;
          resolve();
        }
      });
      stream.resume();
    });
  }
}
