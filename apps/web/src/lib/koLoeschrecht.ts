// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BIBLIOTHEK-LÖSCHEN (R-0959) — WER EIN WISSENSOBJEKT LÖSCHEN DARF.
// ================================================================================================
//
// Die Regel stand bis hierher zweimal wörtlich gleich in der Oberfläche (Lesefläche der Bibliothek,
// Prüfliste); die Trefferzeile wäre die dritte Abschrift geworden. Abschriften derselben Regel laufen
// beim nächsten Rollenzuschnitt auseinander; deshalb steht sie hier EINMAL, und Lesefläche und
// Trefferzeile lesen sie von hier. Die Prüfliste (`pages/Validation.tsx`) gehört nicht zu diesem
// Auftrag und behält ihre gleichlautende Zeile.
//
// SIE ENTSCHEIDET NUR, OB DER KNOPF ERSCHEINT. Durchgesetzt wird die Regel am Server
// (`DELETE /api/kos/:id`, 403 sonst) — diese Funktion ist ihr Spiegel, keine zweite Instanz.
import type { Role } from "../app/navigation";

export function darfWissensobjektLoeschen(
  role: Role,
  autor: string | null | undefined,
  nutzerId: string | null | undefined,
): boolean {
  return role === "admin" || role === "controller" || (!!nutzerId && autor === nutzerId);
}
