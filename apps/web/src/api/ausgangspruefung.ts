// Ausgangsprüfung (R-1646) — der Draht zu `services/app/src/routes/ausgangspruefung-routes.ts`.
//
// Die Gestalt ist die des Servers (`services/reasoner/src/ausgangspruefung.ts`); sie steht hier ein
// zweites Mal, weil die Web-App keine Servertypen importiert. Geändert wird beides gemeinsam.
import { api } from "./client";

export type AnonymisierungsArt = "email" | "iban" | "telefon" | "person";

export interface AusgangsAbschnitt {
  text: string;
  ersetzt: AnonymisierungsArt | null;
}

export interface OffeneAusgangspruefung {
  id: string;
  anbieter: string;
  erstelltAm: string;
  laeuftAbAm: string;
  system: AusgangsAbschnitt[];
  nutzer: AusgangsAbschnitt[];
  bildUnveraendert: boolean;
  ersetzungen: Record<AnonymisierungsArt, number>;
}

export interface AusgangspruefungLage {
  aktiv: boolean;
  wartezeitMs: number | null;
  offen: OffeneAusgangspruefung[];
}

export const ausgangspruefungApi = {
  lage: () => api.get<AusgangspruefungLage>("/ausgangspruefung"),
  freigeben: (id: string) =>
    api.post<{ id: string; entscheidung: "freigegeben" }>(
      `/ausgangspruefung/${encodeURIComponent(id)}/freigeben`,
      {},
    ),
  ablehnen: (id: string) =>
    api.post<{ id: string; entscheidung: "abgelehnt" }>(
      `/ausgangspruefung/${encodeURIComponent(id)}/ablehnen`,
      {},
    ),
};
