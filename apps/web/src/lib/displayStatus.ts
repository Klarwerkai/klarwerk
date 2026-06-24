import type { DisplayStatus } from "../components/trust/types";

// Abgeleiteter Anzeigestatus (BRIEF §5, Abstimmpunkt 1). Der fachliche Kern-Enum
// im Backend ist offen|validiert; die feineren Pills werden hier aus den
// vorhandenen Feldern abgeleitet. Wird in #62 serverseitig gespiegelt.
export function deriveStatus(
  ko: { status: "offen" | "validiert"; assignments?: string[] },
  flags?: { conflict?: boolean; revalidation?: boolean; rejected?: boolean },
): DisplayStatus {
  if (flags?.conflict) {
    return "konflikt";
  }
  if (flags?.rejected) {
    return "abgelehnt";
  }
  if (ko.status === "validiert") {
    return flags?.revalidation ? "revalidierung" : "validiert";
  }
  if (ko.assignments && ko.assignments.length > 0) {
    return "pruefung";
  }
  return "offen";
}
