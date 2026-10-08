import type { Pool } from "pg";

// ================================================================================================
// R-0751 · R-1639 · R-2183 (Nacharbeit 3) — DIE FEHLENDEN DATENEINGÄNGE, GEPFLEGT STATT ERFUNDEN.
// ================================================================================================
//
// Ben fand (Nacharbeit 3): vier der neun Prioritätsfaktoren waren fest `null`, und der Bereichs- und
// Ruhestandsblick der Roadmap 5.1 / B14 hatte keine Daten. Am Wissensobjekt gibt es diese Angaben
// nicht, und sie lassen sich aus dem Bestand auch nicht ableiten. Deshalb hier ZWEI gepflegte
// Eingänge (Muster wie `overlap-settings.ts`: InMemory + Pg + Dev-Journal, Pflege nur mit
// `users.manage`):
//
//   1. BEREICHSPROFIL je Kategorie — wer den Bereich verantwortet (`managerId`, eine Nutzer-ID aus
//      dem Verzeichnis) und die Einschätzung der vier Faktoren Kritikalität, Prozessnähe,
//      Wiederholhäufigkeit, Schadenspotenzial in drei Stufen. Nicht gesetzt bleibt `null` — der
//      Faktor ist dann weiterhin „keine Eingangsdaten", nie 0.
//   2. RUHESTANDSHORIZONT je Nutzer — genau die zwei Horizonte der Quelle, 24 oder 36 Monate, und
//      das daraus folgende Fristdatum. BEWUSST KEIN Geburts- oder Renteneintrittsdatum: die Quelle
//      fragt „in den nächsten 24/36 Monaten", mehr wird nicht gespeichert (Datensparsamkeit).
//
// Die Kategorie ist der vorhandene Schlüssel des Wissensgebiets (`KnowledgeObject.category`), die
// Nutzer-ID die vorhandene interne Kennung — keine neue Identität, nichts aus Titeln abgeleitet.

export type AssessmentLevel = "niedrig" | "mittel" | "hoch";
export const ASSESSMENT_LEVELS: readonly AssessmentLevel[] = ["niedrig", "mittel", "hoch"];
/** Der Faktorwert einer Stufe (0–100, höher = dringender zu sichern). */
export const ASSESSMENT_VALUE: Record<AssessmentLevel, number> = {
  niedrig: 0,
  mittel: 50,
  hoch: 100,
};

/** Die vier gepflegten Faktoren — Schlüssel wie in `PriorityFactorKey`. */
export const ASSESSED_FACTORS = [
  "criticality",
  "processProximity",
  "repetition",
  "damagePotential",
] as const;
export type AssessedFactor = (typeof ASSESSED_FACTORS)[number];

export interface CategoryProfile {
  category: string;
  managerId: string | null;
  criticality: AssessmentLevel | null;
  processProximity: AssessmentLevel | null;
  repetition: AssessmentLevel | null;
  damagePotential: AssessmentLevel | null;
  updatedAt: string;
  updatedBy: string;
}

export type RetirementHorizon = 24 | 36;
export const RETIREMENT_HORIZONS: readonly RetirementHorizon[] = [24, 36];

export interface RetirementEntry {
  userId: string;
  horizonMonths: RetirementHorizon;
  // Fristdatum = Erfassungszeitpunkt + Horizont. Bis dahin soll das Wissen gesichert sein.
  dueAt: string;
  updatedAt: string;
  updatedBy: string;
}

export class ManagementProfileError extends Error {
  readonly code = "INVALID_MANAGEMENT_PROFILE";

  constructor(message: string) {
    super(message);
    this.name = "ManagementProfileError";
  }
}

function level(raw: unknown, feld: string): AssessmentLevel | null {
  if (raw === null || raw === undefined || raw === "") {
    return null;
  }
  if (typeof raw === "string" && (ASSESSMENT_LEVELS as readonly string[]).includes(raw)) {
    return raw as AssessmentLevel;
  }
  throw new ManagementProfileError(`${feld} muss niedrig, mittel, hoch oder leer sein.`);
}

/** Prüft eine Profil-Eingabe; unbekannte Stufen und leere Kategorien sind Bedienfehler (HTTP 400). */
export function normalizeCategoryProfile(
  input: unknown,
  actor: string,
  now: number,
): CategoryProfile {
  const rec = (input ?? {}) as Record<string, unknown>;
  const category = typeof rec.category === "string" ? rec.category.trim() : "";
  if (!category) {
    throw new ManagementProfileError("Die Kategorie fehlt.");
  }
  const manager = typeof rec.managerId === "string" ? rec.managerId.trim() : "";
  return {
    category,
    managerId: manager || null,
    criticality: level(rec.criticality, "criticality"),
    processProximity: level(rec.processProximity, "processProximity"),
    repetition: level(rec.repetition, "repetition"),
    damagePotential: level(rec.damagePotential, "damagePotential"),
    updatedAt: new Date(now).toISOString(),
    updatedBy: actor,
  };
}

/** Fristdatum: Erfassungszeitpunkt plus Horizont in Kalendermonaten (UTC). */
export function retirementDueAt(now: number, horizonMonths: RetirementHorizon): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() + horizonMonths);
  return d.toISOString();
}

/** `null` = Eintrag entfernen; sonst genau 24 oder 36. */
export function normalizeRetirementHorizon(raw: unknown): RetirementHorizon | null {
  if (raw === null) {
    return null;
  }
  // R-1349: die zulässigen Horizonte kommen aus EINER Liste, statt hier ein zweites Mal als Literal
  // dazustehen — vorher war `RETIREMENT_HORIZONS` gebaut, aber von niemandem gelesen.
  const treffer = RETIREMENT_HORIZONS.find((h) => h === raw);
  if (treffer !== undefined) {
    return treffer;
  }
  throw new ManagementProfileError("horizonMonths muss 24, 36 oder null sein.");
}

export interface ManagementProfileRepo {
  listCategoryProfiles(): Promise<CategoryProfile[]>;
  setCategoryProfile(profile: CategoryProfile): Promise<void>;
  listRetirement(): Promise<RetirementEntry[]>;
  setRetirement(entry: RetirementEntry): Promise<void>;
  removeRetirement(userId: string): Promise<void>;
}

export class InMemoryManagementProfileRepo implements ManagementProfileRepo {
  private readonly profiles = new Map<string, CategoryProfile>();
  private readonly retirement = new Map<string, RetirementEntry>();

  listCategoryProfiles(): Promise<CategoryProfile[]> {
    return Promise.resolve([...this.profiles.values()]);
  }

  setCategoryProfile(profile: CategoryProfile): Promise<void> {
    this.profiles.set(profile.category, profile);
    return Promise.resolve();
  }

  listRetirement(): Promise<RetirementEntry[]> {
    return Promise.resolve([...this.retirement.values()]);
  }

  setRetirement(entry: RetirementEntry): Promise<void> {
    this.retirement.set(entry.userId, entry);
    return Promise.resolve();
  }

  removeRetirement(userId: string): Promise<void> {
    this.retirement.delete(userId);
    return Promise.resolve();
  }
}

// REIN ADDITIV UND WIEDERHOLBAR: `CREATE TABLE IF NOT EXISTS`, kein DROP, kein DELETE FROM.
export const MANAGEMENT_PROFILE_SCHEMA = `
CREATE TABLE IF NOT EXISTS management_category_profiles (
  category text PRIMARY KEY,
  manager_id text,
  criticality text,
  process_proximity text,
  repetition text,
  damage_potential text,
  updated_at text NOT NULL,
  updated_by text NOT NULL
);
CREATE TABLE IF NOT EXISTS management_retirement_horizons (
  user_id text PRIMARY KEY,
  horizon_months integer NOT NULL,
  due_at text NOT NULL,
  updated_at text NOT NULL,
  updated_by text NOT NULL
);
`;

interface ProfileRow {
  category: string;
  manager_id: string | null;
  criticality: AssessmentLevel | null;
  process_proximity: AssessmentLevel | null;
  repetition: AssessmentLevel | null;
  damage_potential: AssessmentLevel | null;
  updated_at: string;
  updated_by: string;
}

interface RetirementRow {
  user_id: string;
  horizon_months: number;
  due_at: string;
  updated_at: string;
  updated_by: string;
}

export class PgManagementProfileRepo implements ManagementProfileRepo {
  constructor(private readonly pool: Pool) {}

  async listCategoryProfiles(): Promise<CategoryProfile[]> {
    const res = await this.pool.query<ProfileRow>(
      "SELECT * FROM management_category_profiles ORDER BY category",
    );
    return res.rows.map((r) => ({
      category: r.category,
      managerId: r.manager_id,
      criticality: r.criticality,
      processProximity: r.process_proximity,
      repetition: r.repetition,
      damagePotential: r.damage_potential,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    }));
  }

  async setCategoryProfile(p: CategoryProfile): Promise<void> {
    await this.pool.query(
      "INSERT INTO management_category_profiles(category,manager_id,criticality,process_proximity," +
        "repetition,damage_potential,updated_at,updated_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) " +
        "ON CONFLICT (category) DO UPDATE SET manager_id=$2,criticality=$3,process_proximity=$4," +
        "repetition=$5,damage_potential=$6,updated_at=$7,updated_by=$8",
      [
        p.category,
        p.managerId,
        p.criticality,
        p.processProximity,
        p.repetition,
        p.damagePotential,
        p.updatedAt,
        p.updatedBy,
      ],
    );
  }

  async listRetirement(): Promise<RetirementEntry[]> {
    const res = await this.pool.query<RetirementRow>(
      "SELECT * FROM management_retirement_horizons ORDER BY user_id",
    );
    return res.rows.map((r) => ({
      userId: r.user_id,
      horizonMonths: r.horizon_months === 24 ? 24 : 36,
      dueAt: r.due_at,
      updatedAt: r.updated_at,
      updatedBy: r.updated_by,
    }));
  }

  async setRetirement(e: RetirementEntry): Promise<void> {
    await this.pool.query(
      "INSERT INTO management_retirement_horizons(user_id,horizon_months,due_at,updated_at," +
        "updated_by) VALUES($1,$2,$3,$4,$5) ON CONFLICT (user_id) DO UPDATE SET " +
        "horizon_months=$2,due_at=$3,updated_at=$4,updated_by=$5",
      [e.userId, e.horizonMonths, e.dueAt, e.updatedAt, e.updatedBy],
    );
  }

  async removeRetirement(userId: string): Promise<void> {
    await this.pool.query("DELETE FROM management_retirement_horizons WHERE user_id=$1", [userId]);
  }
}
