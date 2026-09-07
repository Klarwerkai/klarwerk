// N11b: Fehlende/ungültige Einstufung bleibt im Feld vertraulich und trägt zusätzlich
// nichtEingestuft; nur bestätigte Dokumentzustimmung darf serverseitig intern daraus machen.
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
// JOB 2692 D2: optionale draftId = die Kennung des GESPEICHERTEN Entwurfs — derselbe hebende Backstop
// wie die koId, nur fuer Entwuerfe. Eine Flaeche, die einen gespeicherten Entwurf bearbeitet, MUSS sie
// mitgeben; ohne aufloesbaren Anker behandelt der Server `source:"draft"` als vertraulich.
export function draftProvenance(
  declared: Confidentiality | undefined | null,
  koId?: string,
  draftId?: string,
): ReasonerProvenance {
  return {
    source: "draft",
    confidentiality: failSafeConfidentiality(declared),
    ...(declared !== "intern" && declared !== "vertraulich" && declared !== "streng_vertraulich"
      ? { nichtEingestuft: true as const }
      : {}),
    ...(koId ? { koId } : {}),
    ...(draftId ? { draftId } : {}),
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
    ...(declared !== "intern" && declared !== "vertraulich" && declared !== "streng_vertraulich"
      ? { nichtEingestuft: true as const }
      : {}),
    ...(koId ? { koId } : {}),
  };
}
