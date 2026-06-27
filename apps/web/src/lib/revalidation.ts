// Reine, DOM-freie Regel für die Re-Validierung aus der Bibliothek (SCRUM-136 / FE-LIB-05).
// Nur bereits validierte Objekte sinnvoll re-validierbar; kein neues Statusmodell.
import type { KnowledgeObject, KoStatus } from "../api/types";

export function canRevalidate(status: KoStatus): boolean {
  return status === "validiert";
}

// SCRUM-254: Lebenszyklus/Revalidierung produktnäher. Die Pending-Liste liefert nur KO-IDs —
// hier werden sie gegen den geladenen Bestand aufgelöst, um Titel, Anlagenbezug und Status
// sichtbar zu machen und GENAU EINE nächste Handlung abzuleiten, die nur auf bestehende echte
// Aktionen zeigt. Kein neues Lifecycle-Modell, keine Persistenz, keine automatische Mutation.
export type RevalNextStep = "review" | "validate" | "openKo";

export interface RevalidationView {
  id: string;
  found: boolean; // false → Objekt nicht im geladenen Bestand (ehrlicher Hinweis)
  title: string; // KO-Titel oder ID als Fallback
  asset: string | null; // Anlagenbezug des Objekts, soweit vorhanden
  status: KoStatus | null; // realer KO-Status (null, wenn nicht auflösbar)
  nextStep: RevalNextStep;
}

// nextStep — ehrlich aus dem realen KO-Status abgeleitet:
//  - nicht auflösbar           → openKo (öffnen, Details liegen nicht vor)
//  - validiert (re-zu-prüfen)  → review (prüfen, ob nach Änderung noch gültig → dann bestätigen)
//  - offen (nicht freigegeben) → validate (zuerst regulär validieren)
export function revalidationView(id: string, kos: readonly KnowledgeObject[]): RevalidationView {
  const ko = kos.find((k) => k.id === id) ?? null;
  if (!ko) {
    return { id, found: false, title: id, asset: null, status: null, nextStep: "openKo" };
  }
  return {
    id,
    found: true,
    title: ko.title,
    asset: ko.asset,
    status: ko.status,
    nextStep: ko.status === "validiert" ? "review" : "validate",
  };
}
