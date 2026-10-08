import type { Pool } from "pg";
import { ValidationError } from "./types";

// SCRUM-395: Standard-Prüferanzahl als Admin-Einstellung. Gilt, wenn beim Einreichen
// keine eigene Anzahl gesetzt wird (FR-CAP-08: erlaubt bleibt 1–5). Muster wie die
// Assist-Presets (SCRUM-386): Interface + InMemory + Pg, Pflege nur durch users.manage.
export const FALLBACK_NEEDED_VALIDATIONS = 3;
export const MIN_NEEDED_VALIDATIONS = 1;
export const MAX_NEEDED_VALIDATIONS = 5;

// Ehrliche Normalisierung: nur ganze Zahlen im erlaubten Band — alles andere ist ein
// Bedienfehler und wird abgelehnt (kein stilles Zurechtbiegen einer Admin-Einstellung).
export function normalizeDefaultNeeded(value: unknown): number {
  const n = typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(n) || n < MIN_NEEDED_VALIDATIONS || n > MAX_NEEDED_VALIDATIONS) {
    throw new ValidationError(
      "INVALID_DEFAULT",
      `Standard-Prüferanzahl muss eine ganze Zahl zwischen ${MIN_NEEDED_VALIDATIONS} und ${MAX_NEEDED_VALIDATIONS} sein.`,
    );
  }
  return n;
}

export interface ValidationSettingsRepo {
  // null = noch nie gesetzt → der Aufrufer fällt auf FALLBACK_NEEDED_VALIDATIONS zurück.
  getDefaultNeeded(): Promise<number | null>;
  setDefaultNeeded(value: number): Promise<void>;
  // R-1655: wer sich aus der automatischen Prüferzuweisung abgemeldet hat. Eine persönliche
  // Einstellung — sie gilt für die Person selbst, nicht für andere.
  setRoutingOptOut(userId: string, optOut: boolean): Promise<void>;
  routingOptOuts(): Promise<string[]>;
}

export class InMemoryValidationSettingsRepo implements ValidationSettingsRepo {
  private value: number | null = null;
  private readonly optOuts = new Set<string>();

  getDefaultNeeded(): Promise<number | null> {
    return Promise.resolve(this.value);
  }

  setDefaultNeeded(value: number): Promise<void> {
    this.value = value;
    return Promise.resolve();
  }

  setRoutingOptOut(userId: string, optOut: boolean): Promise<void> {
    if (optOut) {
      this.optOuts.add(userId);
    } else {
      this.optOuts.delete(userId);
    }
    return Promise.resolve();
  }

  routingOptOuts(): Promise<string[]> {
    return Promise.resolve([...this.optOuts]);
  }
}

export const VALIDATION_SETTINGS_SCHEMA = `
CREATE TABLE IF NOT EXISTS validation_settings (
  key text PRIMARY KEY,
  value integer NOT NULL
);
`;

const DEFAULT_NEEDED_KEY = "default_needed_validations";
const ROUTING_OPTOUT_PREFIX = "routing_optout:";

// Postgres-Variante: eine Zeile je Einstellung (Key-Value), Upsert beim Setzen.
export class PgValidationSettingsRepo implements ValidationSettingsRepo {
  constructor(private readonly pool: Pool) {}

  async getDefaultNeeded(): Promise<number | null> {
    const res = await this.pool.query<{ value: number }>(
      "SELECT value FROM validation_settings WHERE key=$1",
      [DEFAULT_NEEDED_KEY],
    );
    const row = res.rows[0];
    return row ? row.value : null;
  }

  async setDefaultNeeded(value: number): Promise<void> {
    await this.pool.query(
      "INSERT INTO validation_settings(key,value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2",
      [DEFAULT_NEEDED_KEY, value],
    );
  }

  // R-1655: dieselbe Schlüssel-Wert-Tabelle, ein Schlüssel je abgemeldeter Person — kein neues
  // Schema. Abmelden schreibt die Zeile, Wiederanmelden löscht sie.
  async setRoutingOptOut(userId: string, optOut: boolean): Promise<void> {
    if (optOut) {
      await this.pool.query(
        "INSERT INTO validation_settings(key,value) VALUES($1,1) ON CONFLICT (key) DO UPDATE SET value=1",
        [`${ROUTING_OPTOUT_PREFIX}${userId}`],
      );
    } else {
      await this.pool.query("DELETE FROM validation_settings WHERE key=$1", [
        `${ROUTING_OPTOUT_PREFIX}${userId}`,
      ]);
    }
  }

  async routingOptOuts(): Promise<string[]> {
    const res = await this.pool.query<{ key: string }>(
      "SELECT key FROM validation_settings WHERE starts_with(key, $1) AND value=1",
      [ROUTING_OPTOUT_PREFIX],
    );
    return res.rows.map((row) => row.key.slice(ROUTING_OPTOUT_PREFIX.length));
  }
}
