// SCRUM-502 R6: EIN gemeinsamer, fail-safe Helfer für die Vertraulichkeit eines Modell-Aktions-
// INHALTS (Draft/Editor-Text/Upload). Grundprinzip: eine Stufe ist ENTWEDER explizit vorhanden und
// gültig, ODER es gilt fail-safe „vertraulich". NIEMALS still auf „intern" defaulten, NIEMALS die
// Stufe des Containers/Ziel-KOs erben. ALLE Eintrittspunkte, die einer Modell-Aktion eine Stufe
// zuweisen, laufen durch diesen Helfer — so kann ein neuer Pfad die Klassifikation nicht vergessen.
import type { ReasonerProvenance } from "../api/endpoints";
import type { Confidentiality } from "../api/types";

// Gültige, explizit deklarierte Stufe → unverändert. Alles andere (undefined/null/leer/unbekannt/die
// „unbekannt = intern"-Konvention eines UNGESETZTEN Feldes) → fail-safe „vertraulich".
export function failSafeConfidentiality(
  declared: Confidentiality | undefined | null,
): Confidentiality {
  return declared === "intern" || declared === "vertraulich" || declared === "streng_vertraulich"
    ? declared
    : "vertraulich";
}

// Getippter/bearbeiteter Text (Capture, Studio, KnowledgeDetail-Editor). Optionale koId = NUR
// hebender Backstop (Downgrade-Schutz), nie Freigabe-Anker.
export function draftProvenance(
  declared: Confidentiality | undefined | null,
  koId?: string,
): ReasonerProvenance {
  return {
    source: "draft",
    confidentiality: failSafeConfidentiality(declared),
    ...(koId ? { koId } : {}),
  };
}

// Hochgeladener Dokumenttext (BodyExtractPanel / „Aus Datei"). Ein Upload ist NEUER Inhalt und erbt
// NIE die Ziel-KO-Stufe; die koId ist nur hebender Backstop.
export function documentProvenance(
  declared: Confidentiality | undefined | null,
  koId?: string,
): ReasonerProvenance {
  return {
    source: "transient-document",
    confidentiality: failSafeConfidentiality(declared),
    ...(koId ? { koId } : {}),
  };
}
