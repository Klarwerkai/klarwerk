import type { KnowledgeObject } from "./types";

// Abgeleiteter Anzeigestatus (Abstimmpunkt 1). Der fachliche Kern-Enum bleibt
// offen|validiert; die feineren Anzeigestufen werden aus vorhandenen Feldern und
// Kontext-Flags abgeleitet. Eine Quelle für Backend und Frontend.
export type DisplayStatus =
  | "entwurf"
  | "offen"
  | "pruefung"
  | "validiert"
  | "abgelehnt"
  | "revalidierung"
  | "konflikt";

export function displayStatus(
  ko: Pick<KnowledgeObject, "status" | "assignments">,
  flags: { conflict?: boolean; revalidation?: boolean; rejected?: boolean } = {},
): DisplayStatus {
  if (flags.conflict) {
    return "konflikt";
  }
  if (flags.rejected) {
    return "abgelehnt";
  }
  if (ko.status === "validiert") {
    return flags.revalidation ? "revalidierung" : "validiert";
  }
  if (ko.assignments.length > 0) {
    return "pruefung";
  }
  return "offen";
}
