// Reine, DOM-freie Logik für „Quelle/Beitrag melden" (SCRUM-131 / FE-KO-06).
// Persistenz erfolgt über den bestehenden KO-Kommentar-Pfad — KEIN neues sources/external-Feld.
// Der Beitrag ist ein Review-Kommentar, keine peer-validierte Quelle.

export const SOURCE_CONTRIBUTION_PREFIX = "Quellenbeitrag:";
export const SOURCE_REFERENCE_PREFIX = "Quelle/Referenz:";

export interface SourceContributionInput {
  contribution: string;
  source?: string;
}

// Pflichttext muss vorhanden sein; Quelle/Referenz ist optional.
export function isSourceContributionValid(input: SourceContributionInput): boolean {
  return input.contribution.trim().length > 0;
}

// Baut den maschinenlesbaren Kommentartext. Quelle-Zeile nur wenn ausgefüllt.
export function formatSourceComment(input: SourceContributionInput): string {
  const contribution = input.contribution.trim();
  const source = input.source?.trim() ?? "";
  const lines = [`${SOURCE_CONTRIBUTION_PREFIX} ${contribution}`];
  if (source.length > 0) {
    lines.push(`${SOURCE_REFERENCE_PREFIX} ${source}`);
  }
  return lines.join("\n");
}
