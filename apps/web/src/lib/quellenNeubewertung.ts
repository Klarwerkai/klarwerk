// BD12-02-K06 / K08 (Ben, Nacharbeit 17): der Teilfehler nach einer gespeicherten Quellenänderung.
//
// Der Server speichert die Quellenänderung und schließt danach die Neubewertung früherer
// Konfliktentscheidungen an. Scheitert nur dieser Folgeschritt, antwortet er mit 200 und
// `followUpsFailed: ["konfliktentscheidung"]` — die Quelle steht, die Neubewertung nicht. Die
// Oberfläche darf das nicht als vollen Erfolg melden; sie bietet das Nachholen an
// (`action: "konflikt-neubewertung"`), ohne die Quellenänderung zu wiederholen.

export interface OffeneNeubewertung {
  art: "quelle_hinzugefuegt" | "quelle_entfernt";
  sourceIds: string[];
}

/** Meldet die Antwort, dass die Neubewertung nach der Quellenänderung ausgefallen ist? */
export function neubewertungFehlt(antwort: unknown): boolean {
  if (typeof antwort !== "object" || antwort === null) {
    return false;
  }
  const fehlgeschlagen = (antwort as { followUpsFailed?: unknown }).followUpsFailed;
  return Array.isArray(fehlgeschlagen) && fehlgeschlagen.includes("konfliktentscheidung");
}

/** Die zuletzt ergänzte Quelle aus der Antwort von `add-source` (das gespeicherte Objekt). */
export function ergaenzteQuelle(antwort: unknown): string | null {
  if (typeof antwort !== "object" || antwort === null) {
    return null;
  }
  const quellen = (antwort as { sources?: { id?: unknown }[] }).sources;
  const letzte = Array.isArray(quellen) ? quellen[quellen.length - 1] : undefined;
  return typeof letzte?.id === "string" ? letzte.id : null;
}
