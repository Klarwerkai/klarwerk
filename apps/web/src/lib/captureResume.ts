// SCRUM-457 (Pedi/VIP 06.07.): „Fortsetzen" soll den Entwurf GENAU dort öffnen, wo er gespeichert
// wurde — nicht den Ort aus dem Inhalt raten. Dazu trägt jeder Entwurf beim Speichern einen
// Herkunfts-Marker (`origin`). Diese reine, DOM-freie Logik entscheidet das Ziel und ist testbar.
import type { DraftPayload } from "../api/types";

// Erzähl-Einstieg · geführtes Studio · Experten-Formular.
export type DraftOrigin = "tell" | "studio" | "expert";

// Beim Speichern: aus dem aktuellen Zustand den Herkunfts-Marker bilden.
// Experten-Formular gewinnt; sonst entscheidet der Wizard-Schritt (refine = Studio).
export function originForSave(input: {
  expert: boolean;
  wizStep: "tell" | "refine";
}): DraftOrigin {
  if (input.expert) return "expert";
  return input.wizStep === "refine" ? "studio" : "tell";
}

// Beim Fortsetzen: liegt ein gültiger Marker vor, gilt er EXAKT. Fehlt er (Alt-Entwürfe),
// greift die bisherige Heuristik als ehrlicher Rückfall: strukturierter Inhalt → geführtes
// Studio, sonst zurück in den Erzähl-Einstieg.
export function resumeTargetForDraft(payload: DraftPayload): DraftOrigin {
  if (payload.origin === "tell" || payload.origin === "studio" || payload.origin === "expert") {
    return payload.origin;
  }
  const structured =
    Boolean(payload.bodyHtml?.trim()) ||
    (payload.conditions?.some((x) => x.trim()) ?? false) ||
    (payload.measures?.some((x) => x.trim()) ?? false);
  return structured ? "studio" : "tell";
}
