import type { KoSource } from "../api/types";
import { gespeicherteFassungHref } from "./objektbezug";

/** Interne Workflow-Belege werden aus ihren gebundenen Kennungen neu adressiert. */
export function workflowWissensquelle(
  s: Pick<
    KoSource,
    | "url"
    | "provider"
    | "sourceVersion"
    | "externalId"
    | "sourceRemovedAt"
    | "workflowQuellart"
    | "workflowBezug"
  >,
): { typ: "ergebnis" | "quelle"; href: string } | null {
  if (
    s.provider !== "Klarwerk" ||
    s.url !== null ||
    s.sourceRemovedAt ||
    !s.externalId ||
    !s.sourceVersion ||
    !Number.isSafeInteger(s.sourceVersion) ||
    s.sourceVersion < 1
  )
    return null;
  const id = s.externalId;
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return null;
  if (s.workflowQuellart === "wissensfassung" && !s.workflowBezug)
    return { typ: "quelle", href: gespeicherteFassungHref(id, s.sourceVersion) };
  const b = s.workflowBezug;
  if (
    s.workflowQuellart !== "ergebnis" ||
    !b ||
    b.ergebnisId !== id ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(b.workflowId) ||
    !/^[a-f0-9]{64}$/.test(b.laufId) ||
    !new RegExp(`^routine-${b.laufId}-[0-9]{1,2}$`).test(id)
  )
    return null;
  return {
    typ: "ergebnis",
    href: `/teamworkflows?${new URLSearchParams({ workflow: b.workflowId, lauf: b.laufId, ergebnis: id })}`,
  };
}
