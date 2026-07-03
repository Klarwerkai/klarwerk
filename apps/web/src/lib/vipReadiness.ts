// SCRUM-437 (Pedi 03.07., VIP): Bereitschafts-Checkliste — DOM-freie Ableitung der Ein-Blick-Zeilen
// aus dem echten Systemzustand (keine Fakes, ehrliche Ampel). Eine Quelle für Komponente + Test.
import type { ExternalKnowledgeStage } from "../api/types";

export type ReadinessTone = "ok" | "warn" | "crit" | "info";

export interface ReadinessRow {
  id: string;
  labelKey: string;
  valueKey: string;
  params?: Record<string, string | number>;
  tone: ReadinessTone;
}

export interface ReadinessInput {
  kiBoth: boolean;
  kiAny: boolean;
  validated: number;
  openReviews: number;
  uploadLimits: { maxAttachments: number; maxAttachmentBytes: number } | null;
  externalStage: ExternalKnowledgeStage | null;
}

const STAGE_VALUE_KEY: Record<ExternalKnowledgeStage, string> = {
  blocked: "adm.ready.ext.blocked",
  search_on_click: "adm.ready.ext.searchOnClick",
  search_attach: "adm.ready.ext.searchAttach",
  open: "adm.ready.ext.open",
};

// Reihen in fester Reihenfolge; params NUR gesetzt, wenn vorhanden (exactOptionalPropertyTypes:
// kein explizites undefined zuweisen).
export function readinessRows(i: ReadinessInput): ReadinessRow[] {
  const rows: ReadinessRow[] = [];

  rows.push({
    id: "ki",
    labelKey: "adm.ready.ki",
    valueKey: i.kiBoth
      ? "adm.ready.ki.both"
      : i.kiAny
        ? "adm.ready.ki.partial"
        : "adm.ready.ki.none",
    tone: i.kiBoth ? "ok" : i.kiAny ? "warn" : "crit",
  });

  rows.push({
    id: "validated",
    labelKey: "adm.ready.validated",
    valueKey: "adm.ready.count",
    params: { n: i.validated },
    tone: i.validated > 0 ? "ok" : "warn",
  });

  rows.push({
    id: "openReviews",
    labelKey: "adm.ready.openReviews",
    valueKey: "adm.ready.count",
    params: { n: i.openReviews },
    tone: "info",
  });

  rows.push(
    i.uploadLimits
      ? {
          id: "upload",
          labelKey: "adm.ready.upload",
          valueKey: "adm.ready.upload.val",
          params: {
            n: i.uploadLimits.maxAttachments,
            kb: Math.round(i.uploadLimits.maxAttachmentBytes / 1000),
          },
          tone: "ok",
        }
      : { id: "upload", labelKey: "adm.ready.upload", valueKey: "adm.ready.unknown", tone: "warn" },
  );

  rows.push({
    id: "external",
    labelKey: "adm.ready.external",
    valueKey: i.externalStage ? STAGE_VALUE_KEY[i.externalStage] : "adm.ready.unknown",
    tone: "info",
  });

  return rows;
}
