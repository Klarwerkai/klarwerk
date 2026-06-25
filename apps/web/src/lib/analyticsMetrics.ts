// Reine, DOM-freie Analytics-Helfer (SCRUM-139/140/143).
// Alles datenbasiert: rechnet ausschließlich über übergebene Bestandsdaten.
import type { AssignmentSummary, AuditEntry, AuditFilter, KnowledgeObject } from "../api/types";

// SCRUM-139: Trust-Kennzahl — Durchschnitts-Vertrauen über alle Wissensobjekte.
export function averageTrust(kos: readonly KnowledgeObject[]): number {
  if (kos.length === 0) {
    return 0;
  }
  const sum = kos.reduce((acc, ko) => acc + (ko.confidence ?? 0), 0);
  return Math.round(sum / kos.length);
}

// SCRUM-139: Validierungsquote (validiert / gesamt) in Prozent.
export function validationRate(total: number, validated: number): number {
  return total > 0 ? Math.round((validated / total) * 100) : 0;
}

// SCRUM-139: Aufgaben-/Arbeitslast — offene/erledigte Zuweisungen über alle Bearbeiter.
export interface WorkloadSummary {
  openTotal: number;
  doneTotal: number;
  experts: number;
}

export function workloadSummary(summaries: readonly AssignmentSummary[]): WorkloadSummary {
  return summaries.reduce<WorkloadSummary>(
    (acc, s) => ({
      openTotal: acc.openTotal + s.open,
      doneTotal: acc.doneTotal + s.done,
      experts: acc.experts + (s.open > 0 ? 1 : 0),
    }),
    { openTotal: 0, doneTotal: 0, experts: 0 },
  );
}

// SCRUM-140: Antwortquote als Prozent-String.
export function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// SCRUM-140: validierte KOs je Woche, jüngste zuletzt, optional begrenzt.
export function weeklyValidated(
  byWeek: Record<string, number>,
  limit = 8,
): { week: string; count: number }[] {
  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([week, count]) => ({ week, count }));
}

// SCRUM-143: distinkte Actor-/Action-Werte aus echten Audit-Daten (für Filter-Dropdowns).
export function auditActors(entries: readonly AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.actor))].sort();
}

export function auditActions(entries: readonly AuditEntry[]): string[] {
  return [...new Set(entries.map((e) => e.action))].sort();
}

// SCRUM-143: Audit clientseitig filtern. Leerer Filter → unveränderte Liste.
export function filterAudit(entries: readonly AuditEntry[], filter: AuditFilter): AuditEntry[] {
  const target = filter.target?.trim().toLowerCase() ?? "";
  return entries.filter(
    (e) =>
      (!filter.actor || e.actor === filter.actor) &&
      (!filter.action || e.action === filter.action) &&
      (!target || e.target.toLowerCase().includes(target)),
  );
}
