import { randomUUID } from "node:crypto";
import type { ObjectRepo } from "./repo";
import {
  MAX_OBJECT_BYTES,
  ObjectError,
  type ObjectKind,
  type ObjectRef,
  type StoredObject,
} from "./types";

export interface ObjectStoreDeps {
  repo: ObjectRepo;
  now?: () => number;
  genId?: () => string;
}

// SCRUM-45/46/48: Data-URL in rohe Bytes + MIME zerlegen (für den /raw-Bild-Endpoint).
// Rein/DOM-frei; gibt null bei nicht-base64-Data-URLs zurück.
export function decodeDataUrl(dataUrl: string): { mime: string; bytes: Buffer } | null {
  const m = /^data:([^;,]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!m) {
    return null;
  }
  return { mime: m[1] as string, bytes: Buffer.from(m[2] as string, "base64") };
}

export interface PutObjectInput {
  name: string;
  mime: string;
  data: string;
  kind?: ObjectKind;
  // SCRUM-521 (WP1): beim Upload persistierte Vertraulichkeit (Level-String). Fehlt sie, bleibt sie
  // undefined → der Medien-Egress behandelt das Objekt fail-safe als vertraulich.
  confidentiality?: string;
}

// Leitet die Objektart aus dem MIME-Typ ab (überschreibbar via input.kind).
export function inferKind(mime: string): ObjectKind {
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("video/") || mime.startsWith("audio/")) {
    return "video";
  }
  if (mime === "application/pdf" || mime.startsWith("text/") || mime.includes("word")) {
    return "document";
  }
  return "binary";
}

export class ObjectStore {
  private readonly repo: ObjectRepo;
  private readonly now: () => number;
  private readonly genId: () => string;

  constructor(deps: ObjectStoreDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // SCRUM-121: Original/Binary ablegen → ObjectRef (nur Metadaten) zurück.
  async put(input: PutObjectInput): Promise<ObjectRef> {
    if (!input.name?.trim() || !input.mime?.trim()) {
      throw new ObjectError("INVALID", "name/mime fehlt.");
    }
    if (!input.data || input.data.length === 0) {
      throw new ObjectError("INVALID", "Kein Inhalt.");
    }
    if (input.data.length > MAX_OBJECT_BYTES) {
      throw new ObjectError("INVALID", "Objekt zu groß.");
    }
    const ref: ObjectRef = {
      id: this.genId(),
      name: input.name,
      mime: input.mime,
      size: input.data.length,
      kind: input.kind ?? inferKind(input.mime),
      createdAt: new Date(this.now()).toISOString(),
      // SCRUM-521 (WP1): Vertraulichkeit nur persistieren, wenn ein bekannter Level angegeben ist.
      ...(input.confidentiality ? { confidentiality: input.confidentiality } : {}),
    };
    await this.repo.insert({ ref, data: input.data });
    return ref;
  }

  // Vollständiges Objekt (Referenz + Inhalt) lesen.
  read(id: string): Promise<StoredObject | undefined> {
    return this.repo.findById(id);
  }

  // Nur Metadaten (ObjectRef) lesen.
  async metadata(id: string): Promise<ObjectRef | undefined> {
    return (await this.repo.findById(id))?.ref;
  }
}
