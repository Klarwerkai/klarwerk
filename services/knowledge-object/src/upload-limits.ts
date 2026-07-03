import type { Pool } from "pg";
import { KoError } from "./types";

// SCRUM-421 (Pedi 03.07.): Upload-Grenzen sichtbar + im Admin einstellbar. Bisher fest im Code
// (max. 8 Anhänge, ~700 KB je Anhang). Jetzt persistierte Admin-Einstellung (Muster SCRUM-395):
// InMemory + Pg + Dev-Journal. Serverseitig erzwungen; die UI zeigt die geltenden Werte.
export interface UploadLimits {
  maxAttachments: number; // Anhänge je Objekt
  maxAttachmentBytes: number; // Größe je Anhang (Daten-URL/Thumbnail), in Bytes
}

// Werksvorgabe = die bisherigen festen Werte (rückwärtskompatibel).
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxAttachments: 8,
  maxAttachmentBytes: 700_000,
};

// Sinnvolle Ober-/Untergrenzen — schützen vor Fehlkonfiguration (kein 0, kein Riesenwert).
export const UPLOAD_LIMITS_BOUNDS = {
  maxAttachments: { min: 1, max: 30 },
  maxAttachmentBytes: { min: 100_000, max: 20_000_000 },
} as const;

// Ehrliche Normalisierung: nur ganze Zahlen im erlaubten Band; sonst Bedienfehler (KoError).
export function normalizeUploadLimits(input: unknown): UploadLimits {
  const rec = (input ?? {}) as Record<string, unknown>;
  const check = (value: unknown, key: keyof typeof UPLOAD_LIMITS_BOUNDS): number => {
    const n = typeof value === "number" ? value : Number.NaN;
    const { min, max } = UPLOAD_LIMITS_BOUNDS[key];
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new KoError(
        "INVALID_UPLOAD_LIMITS",
        `${key} muss eine ganze Zahl zwischen ${min} und ${max} sein.`,
      );
    }
    return n;
  };
  return {
    maxAttachments: check(rec.maxAttachments, "maxAttachments"),
    maxAttachmentBytes: check(rec.maxAttachmentBytes, "maxAttachmentBytes"),
  };
}

export interface UploadLimitsRepo {
  // null = noch nie gesetzt → Aufrufer nimmt DEFAULT_UPLOAD_LIMITS.
  get(): Promise<UploadLimits | null>;
  set(limits: UploadLimits): Promise<void>;
}

export class InMemoryUploadLimitsRepo implements UploadLimitsRepo {
  private limits: UploadLimits | null = null;

  get(): Promise<UploadLimits | null> {
    return Promise.resolve(this.limits);
  }

  set(limits: UploadLimits): Promise<void> {
    this.limits = limits;
    return Promise.resolve();
  }
}

export const UPLOAD_LIMITS_SCHEMA = `
CREATE TABLE IF NOT EXISTS upload_limits (
  key text PRIMARY KEY,
  max_attachments integer NOT NULL,
  max_attachment_bytes integer NOT NULL
);
`;

const LIMITS_KEY = "upload_limits";

export class PgUploadLimitsRepo implements UploadLimitsRepo {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<UploadLimits | null> {
    const res = await this.pool.query<{ max_attachments: number; max_attachment_bytes: number }>(
      "SELECT max_attachments, max_attachment_bytes FROM upload_limits WHERE key=$1",
      [LIMITS_KEY],
    );
    const row = res.rows[0];
    return row
      ? { maxAttachments: row.max_attachments, maxAttachmentBytes: row.max_attachment_bytes }
      : null;
  }

  async set(limits: UploadLimits): Promise<void> {
    await this.pool.query(
      "INSERT INTO upload_limits(key,max_attachments,max_attachment_bytes) VALUES($1,$2,$3) " +
        "ON CONFLICT (key) DO UPDATE SET max_attachments=$2, max_attachment_bytes=$3",
      [LIMITS_KEY, limits.maxAttachments, limits.maxAttachmentBytes],
    );
  }
}
