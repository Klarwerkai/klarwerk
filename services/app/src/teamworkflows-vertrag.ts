import type { SessionUser } from "../../auth";
import type { TeamUrteil } from "./teamassistenten-wissen";
import type { TeamFassung } from "./teams";

export type WorkflowSprache = "de" | "en" | "nl";
export type WorkflowSitzung = () => Promise<SessionUser | undefined>;
export type WorkflowSchritt =
  | {
      typ: "assistent";
      titel: string;
      assistentId: string;
      version: number;
      frage: string;
      erwartet: TeamUrteil;
    }
  | { typ: "entscheidung"; titel: string; rolle: "mitglied" | "verantwortlich" }
  | { typ: "aktion"; titel: string; aktion: "ergebnis_festhalten" };
export interface WorkflowDefinition {
  name: string;
  ausloeser: string;
  beispielfall?: string;
  schritte: WorkflowSchritt[];
}
export interface WorkflowProbe {
  bestanden: boolean;
  schritte: {
    index: number;
    typ: WorkflowSchritt["typ"];
    bestanden: boolean;
    erwartet?: TeamUrteil;
    ist?: TeamUrteil;
    code?: string;
  }[];
  /** Internal source pins; client responses expose only the evaluated steps. */
  konfliktstand?: Record<string, string>;
  bindungen?: Record<string, Record<string, number>>;
}
export interface WorkflowZugang {
  freigabe(
    id: string,
    user: SessionUser,
    version?: number,
    laufend?: boolean,
  ): Promise<{
    version: number;
    definition: WorkflowDefinition;
    team: TeamFassung;
    pruefung: WorkflowProbe;
  }>;
}
export class WorkflowFehler extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
export function workflowEingabe(): never {
  throw new WorkflowFehler(400, "EINGABE");
}
export function workflowFehlt(): never {
  throw new WorkflowFehler(404, "NICHT_VERFUEGBAR");
}
export function workflowStand(): never {
  throw new WorkflowFehler(409, "STAND_GEAENDERT");
}
export function workflowObjekt(wert: unknown): Record<string, unknown> {
  if (!wert || typeof wert !== "object" || Array.isArray(wert)) return workflowEingabe();
  return wert as Record<string, unknown>;
}
export function workflowText(wert: unknown, max: number) {
  if (typeof wert !== "string" || !wert.trim() || wert.trim().length > max)
    return workflowEingabe();
  return wert.trim();
}
export function workflowNummer(wert: unknown) {
  if (typeof wert !== "number" || !Number.isSafeInteger(wert) || wert < 1) return workflowEingabe();
  return wert;
}
export function workflowSprache(wert: unknown): WorkflowSprache {
  if (wert === undefined) return "de";
  if (wert !== "de" && wert !== "en" && wert !== "nl") return workflowEingabe();
  return wert;
}
export function workflowDefinition(wert: unknown): WorkflowDefinition {
  const d = workflowObjekt(wert);
  if (!Array.isArray(d.schritte) || !d.schritte.length || d.schritte.length > 24)
    return workflowEingabe();
  const schritte = d.schritte.map((roh: unknown): WorkflowSchritt => {
    const s = workflowObjekt(roh);
    const titel = workflowText(s.titel, 150);
    if (
      s.typ === "assistent" &&
      (s.erwartet === "belegt" || s.erwartet === "offen" || s.erwartet === "widerspruch")
    )
      return {
        typ: s.typ,
        titel,
        assistentId: workflowText(s.assistentId, 150),
        version: workflowNummer(s.version),
        frage: workflowText(s.frage, 1000),
        erwartet: s.erwartet,
      };
    if (s.typ === "entscheidung" && (s.rolle === "mitglied" || s.rolle === "verantwortlich"))
      return { typ: s.typ, titel, rolle: s.rolle };
    if (s.typ === "aktion" && s.aktion === "ergebnis_festhalten")
      return { typ: s.typ, titel, aktion: s.aktion };
    return workflowEingabe();
  });
  const beispielfall =
    d.beispielfall === undefined || d.beispielfall === ""
      ? undefined
      : workflowText(d.beispielfall, 500);
  if (!beispielfall && schritte.some((s) => s.typ === "assistent" && s.frage.includes("{{fall}}")))
    return workflowEingabe();
  return {
    name: workflowText(d.name, 100),
    ausloeser: workflowText(d.ausloeser, 500),
    ...(beispielfall ? { beispielfall } : {}),
    schritte,
  };
}
