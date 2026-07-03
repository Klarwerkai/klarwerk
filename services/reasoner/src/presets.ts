import type { Pool } from "pg";

// SCRUM-386 (Pedi-Notiz 02.07., Paul 03.07.): kundeneigene KI-Assist-Funktionen (Presets).
// Die Palette im Editor (SCRUM-312/384/404) bietet geführte Aktionen an; im Kern sind das
// benannte instructions für den VORHANDENEN assist-Task. Dieses Modul liefert die fehlende
// Verwaltung: eigene Presets je Instanz (Name + Anweisung), vom Admin gepflegt, für alle
// Rollen in der Palette sichtbar. Leitplanken unverändert (G-3): KI ist Hilfsmittel, die
// Anweisung ist am ?-HelpTip transparent sichtbar, Vorschau + bewusste Übernahme bleiben —
// und die Standard-Funktionen ab Werk (klarer/strukturieren/…) sind NICHT löschbar (Code).
// Datenhoheit: eigenes Repo + eigene Tabelle im reasoner-Modul (Muster notification_seen).

export interface AssistPreset {
  id: string;
  name: string;
  instruction: string;
}

// Eingabe aus Route/Admin-UI: id optional (neu = Server vergibt), Rest wird validiert.
export interface AssistPresetInput {
  id?: string;
  name?: string;
  instruction?: string;
}

export const MAX_ASSIST_PRESETS = 12;
export const ASSIST_PRESET_NAME_MAX = 40;
export const ASSIST_PRESET_INSTRUCTION_MAX = 400;

// Validierung + Normalisierung der kompletten Liste (Replace-Semantik). Wirft mit klarer
// deutscher Meldung; die Route übersetzt das in 400. newId wird injiziert (Service nutzt
// randomUUID, Tests einen Zähler) — das Repo erhält FERTIGE ids (deterministisches Replay
// im Dev-Journal, keine ID-Erzeugung im Repo).
export function normalizeAssistPresets(
  input: readonly AssistPresetInput[],
  newId: () => string,
): AssistPreset[] {
  if (!Array.isArray(input)) {
    throw new Error("Presets müssen als Liste übergeben werden.");
  }
  if (input.length > MAX_ASSIST_PRESETS) {
    throw new Error(`Höchstens ${MAX_ASSIST_PRESETS} eigene KI-Funktionen — weniger ist mehr.`);
  }
  const seen = new Set<string>();
  return input.map((raw) => {
    const name = String(raw?.name ?? "").trim();
    const instruction = String(raw?.instruction ?? "").trim();
    if (name.length < 2 || name.length > ASSIST_PRESET_NAME_MAX) {
      throw new Error(`Der Name einer KI-Funktion braucht 2–${ASSIST_PRESET_NAME_MAX} Zeichen.`);
    }
    if (instruction.length < 5 || instruction.length > ASSIST_PRESET_INSTRUCTION_MAX) {
      throw new Error(
        `Die Anweisung für „${name}“ braucht 5–${ASSIST_PRESET_INSTRUCTION_MAX} Zeichen.`,
      );
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Der Funktionsname „${name}“ ist doppelt vergeben.`);
    }
    seen.add(key);
    const id = typeof raw?.id === "string" && raw.id.trim().length > 0 ? raw.id.trim() : newId();
    return { id, name, instruction };
  });
}

// Repo-Schnittstelle: bewusst NUR list + replaceAll — eine Mutationsfläche, die die
// komplette Liste trägt (einfaches, exaktes Replay im Dev-Persistenz-Journal).
export interface AssistPresetRepo {
  list(): Promise<AssistPreset[]>;
  replaceAll(presets: readonly AssistPreset[]): Promise<void>;
}

// In-Memory-Variante (Tests/Dev/Dev-Journal-Replay).
export class InMemoryAssistPresetRepo implements AssistPresetRepo {
  private presets: AssistPreset[] = [];

  async list(): Promise<AssistPreset[]> {
    return this.presets.map((p) => ({ ...p }));
  }

  async replaceAll(presets: readonly AssistPreset[]): Promise<void> {
    this.presets = presets.map((p) => ({ ...p }));
  }
}

export const ASSIST_PRESETS_SCHEMA = `
CREATE TABLE IF NOT EXISTS assist_presets (
  id text PRIMARY KEY,
  position integer NOT NULL,
  name text NOT NULL,
  instruction text NOT NULL
);
`;

interface PresetRow {
  id: string;
  name: string;
  instruction: string;
}

// Postgres-Variante: gleiche Schnittstelle; Reihenfolge über position (Anzeige = Pflege-Reihenfolge).
export class PgAssistPresetRepo implements AssistPresetRepo {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<AssistPreset[]> {
    const res = await this.pool.query<PresetRow>(
      "SELECT id,name,instruction FROM assist_presets ORDER BY position ASC",
    );
    return res.rows.map((row) => ({ id: row.id, name: row.name, instruction: row.instruction }));
  }

  async replaceAll(presets: readonly AssistPreset[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM assist_presets");
      for (const [i, p] of presets.entries()) {
        await client.query(
          "INSERT INTO assist_presets(id,position,name,instruction) VALUES($1,$2,$3,$4)",
          [p.id, i, p.name, p.instruction],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
