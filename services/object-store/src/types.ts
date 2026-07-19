// SCRUM-121: interner Objekt-/Attachment-Speicher. Hält Originale/Binärdaten getrennt
// vom KO-Modell; das KO trägt nur eine ObjectRef + kleine Vorschau. KEIN S3/Cloud.
// SCRUM-382: "video" umfasst Video- UND Audio-Dateien (beide transkribierbar).
export type ObjectKind = "image" | "document" | "video" | "binary";

// Metadaten-Referenz (ohne Bytes) — genau das, was im KO/Draft gespeichert wird.
export interface ObjectRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: ObjectKind;
  createdAt: string;
  // SCRUM-521 (WP1): serverseitig PERSISTIERTE Vertraulichkeit des Objekts (Level-String, z. B.
  // "intern"/"vertraulich"/"streng_vertraulich"). Beim Upload gesetzt; die Egress-Entscheidung (Medien-
  // Transkription) liest AUSSCHLIESSLICH diesen Wert — nie den Analyse-Request. Fehlt er, gilt fail-safe
  // vertraulich (kein externer Egress). object-store bleibt von knowledge-object entkoppelt → plain string.
  confidentiality?: string;
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
// WP-D2 („Original ist heilig"): dokumententauglich angehoben — echte Nutzer-PDF/DOCX liegen oft bei
// mehreren MB; gemessen wird die Data-URL-Länge (Base64 ≈ Dateigröße × 1,37). 30 MB Data-URL ≈ ~22 MB
// Datei; der HTTP-Transport wird vom expliziten Route-bodyLimit (object-routes) gedeckelt.
export const MAX_OBJECT_BYTES = 30_000_000; // ~30 MB Data-URL (~22 MB Datei)
