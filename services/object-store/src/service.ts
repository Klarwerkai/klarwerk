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

export interface PutObjectInput {
  name: string;
  mime: string;
  data: string;
  kind?: ObjectKind;
}

// Leitet die Objektart aus dem MIME-Typ ab (überschreibbar via input.kind).
export function inferKind(mime: string): ObjectKind {
  if (mime.startsWith("image/")) {
    return "image";
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
