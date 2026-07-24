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

// ---- FUNKE F1 (nacht24 Paket 6, SCRUM-477/529): „Meine Wirkung" ------------------------------
// Pure Ableitung der PERSÖNLICHEN Wirkungs-Zähler ausschließlich aus vorhandenen, berechtigten
// Daten (eigene KOs + bestehende Audits ask.query / answer.helpful). DSGVO-nüchtern: NUR Zahlen
// über EIGENE Beiträge — keine Ranglisten, keine fremden Personen, keine Inhalte im Klartext.

export interface ImpactAuditEntry {
  actor: string;
  target: string;
  payload?: Record<string, unknown>;
}

export interface ImpactKo {
  id: string;
  author: string;
  status: string;
}

export interface MyImpact {
  // Eigene (nicht gelöschte) Wissensobjekte und wie viele davon validiert sind.
  contributions: number;
  validated: number;
  // Wie oft eine Antwort mit einem EIGENEN KO als FÜHRENDER Quelle beantwortet wurde. Ehrlich:
  // das ask.query-Audit trägt nur die führende Quelle (sources[0]) — Mehrquellen-Zitate zählen
  // hier konservativ EINMAL (nie zu viel, nie erfunden).
  cited: number;
  // Wie oft jemand ANDERES ein eigenes KO als hilfreich markiert hat (eigene Klicks zählen nicht).
  helpfulReceived: number;
}

export function computeMyImpact(
  userId: string,
  kos: readonly ImpactKo[],
  helpfulAudits: readonly ImpactAuditEntry[],
  askAudits: readonly ImpactAuditEntry[],
): MyImpact {
  const mine = kos.filter((entry) => entry.author === userId);
  const myIds = new Set(mine.map((entry) => entry.id));
  const cited = askAudits.filter(
    (entry) => entry.payload?.answered === true && myIds.has(entry.target),
  ).length;
  const helpfulReceived = helpfulAudits.filter(
    (entry) => entry.actor !== userId && myIds.has(entry.target),
  ).length;
  return {
    contributions: mine.length,
    validated: mine.filter((entry) => entry.status === "validiert").length,
    cited,
    helpfulReceived,
  };
}
