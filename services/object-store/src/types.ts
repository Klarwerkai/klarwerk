// SCRUM-121: interner Objekt-/Attachment-Speicher. Hält Originale/Binärdaten getrennt
// vom KO-Modell; das KO trägt nur eine ObjectRef + kleine Vorschau. KEIN S3/Cloud.
export type ObjectKind = "image" | "document" | "binary";

// Metadaten-Referenz (ohne Bytes) — genau das, was im KO/Draft gespeichert wird.
export interface ObjectRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: ObjectKind;
  createdAt: string;
}

// Gespeichertes Objekt = Referenz + Inhalt (Daten-URL/Base64-String).
export interface StoredObject {
  ref: ObjectRef;
  data: string;
}

export type ObjectErrorCode = "NOT_FOUND" | "INVALID";

export class ObjectError extends Error {
  readonly code: ObjectErrorCode;

  constructor(code: ObjectErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ObjectError";
  }
}

// Obergrenze fürs Original (großzügiger als das KO-Thumbnail-Limit, aber begrenzt).
export const MAX_OBJECT_BYTES = 5_000_000; // ~5 MB
