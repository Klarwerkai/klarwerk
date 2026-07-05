import type { Pool } from "pg";
import { OverlapError } from "./overlap-types";

// Berater-Konzept Duplikate 04.07. (Pedi): die Anzeige-Schwelle der Duplikat-Erkennung ist jetzt
// eine persistierte Admin-Einstellung (Muster UploadLimits/SCRUM-421): InMemory + Pg + Dev-Journal.
// „minConfidence" = ab welcher KI-Wahrscheinlichkeit ein vermutliches Duplikat angezeigt wird.
export interface OverlapSettings {
  minConfidence: number; // 0..1 — Startwert 0,5 (im Admin einstellbar)
}

export const DEFAULT_OVERLAP_SETTINGS: OverlapSettings = {
  minConfidence: 0.5,
};

// Sinnvolle Grenzen: nie 0 (sonst nur Rauschen), nie 1 (sonst nie ein Treffer).
export const OVERLAP_SETTINGS_BOUNDS = {
  minConfidence: { min: 0.05, max: 0.99 },
} as const;

// Ehrliche Normalisierung: Zahl im erlaubten Band, auf 2 Nachkommastellen (prozentgenau) gerundet;
// sonst Bedienfehler (OverlapError → HTTP 400).
export function normalizeOverlapSettings(input: unknown): OverlapSettings {
  const rec = (input ?? {}) as Record<string, unknown>;
  const raw = typeof rec.minConfidence === "number" ? rec.minConfidence : Number.NaN;
  const { min, max } = OVERLAP_SETTINGS_BOUNDS.minConfidence;
  if (!Number.isFinite(raw) || raw < min || raw > max) {
    throw new OverlapError(
      "INVALID_SETTINGS",
      `minConfidence muss eine Zahl zwischen ${min} und ${max} sein.`,
    );
  }
  return { minConfidence: Math.round(raw * 100) / 100 };
}

export interface OverlapSettingsRepo {
  // null = noch nie gesetzt → Aufrufer nimmt DEFAULT_OVERLAP_SETTINGS.
  get(): Promise<OverlapSettings | null>;
  set(settings: OverlapSettings): Promise<void>;
}

export class InMemoryOverlapSettingsRepo implements OverlapSettingsRepo {
  private settings: OverlapSettings | null = null;

  get(): Promise<OverlapSettings | null> {
    return Promise.resolve(this.settings);
  }

  set(settings: OverlapSettings): Promise<void> {
    this.settings = settings;
    return Promise.resolve();
  }
}

export const OVERLAP_SETTINGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS overlap_settings (
  key text PRIMARY KEY,
  min_confidence double precision NOT NULL
);
`;

const SETTINGS_KEY = "overlap_settings";

export class PgOverlapSettingsRepo implements OverlapSettingsRepo {
  constructor(private readonly pool: Pool) {}

  async get(): Promise<OverlapSettings | null> {
    const res = await this.pool.query<{ min_confidence: number }>(
      "SELECT min_confidence FROM overlap_settings WHERE key=$1",
      [SETTINGS_KEY],
    );
    const row = res.rows[0];
    return row ? { minConfidence: row.min_confidence } : null;
  }

  async set(settings: OverlapSettings): Promise<void> {
    await this.pool.query(
      "INSERT INTO overlap_settings(key,min_confidence) VALUES($1,$2) " +
        "ON CONFLICT (key) DO UPDATE SET min_confidence=$2",
      [SETTINGS_KEY, settings.minConfidence],
    );
  }
}
