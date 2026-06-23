import type { AuditService } from "../../audit";
import type { KoService } from "../../knowledge-object";

// FR-ANA-02: Wirkungs-Dashboard — zwei Kernmetriken über Zeit.
export interface ImpactReport {
  validatedTotal: number;
  validatedByWeek: Record<string, number>; // Schlüssel = Wochenstart (Montag, YYYY-MM-DD)
  askTotal: number;
  answeredWithoutGap: number;
  answerRate: number; // Anteil beantworteter Fragen ohne Wissenslücke (0..1)
}

// Wochenstart (Montag, UTC) als stabiler Gruppierungs-Schlüssel.
function weekKey(iso: string): string {
  const d = new Date(iso);
  const mondayOffset = (d.getUTCDay() + 6) % 7;
  const monday = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset),
  );
  return monday.toISOString().slice(0, 10);
}

export async function impactReport(ko: KoService, audit: AuditService): Promise<ImpactReport> {
  const kos = await ko.list({});
  const validated = kos.filter((entry) => entry.status === "validiert");
  const validatedByWeek: Record<string, number> = {};
  for (const entry of validated) {
    const key = weekKey(entry.createdAt);
    validatedByWeek[key] = (validatedByWeek[key] ?? 0) + 1;
  }

  const asks = await audit.list({ action: "ask.query" });
  const askTotal = asks.length;
  const answeredWithoutGap = asks.filter((entry) => entry.payload.answered === true).length;

  return {
    validatedTotal: validated.length,
    validatedByWeek,
    askTotal,
    answeredWithoutGap,
    answerRate: askTotal > 0 ? answeredWithoutGap / askTotal : 0,
  };
}
