// Reine, DOM-freie Regel für die Re-Validierung aus der Bibliothek (SCRUM-136 / FE-LIB-05).
// Nur bereits validierte Objekte sinnvoll re-validierbar; kein neues Statusmodell.
import type { KnowledgeObject, KoStatus } from "../api/types";
import { askQuestionHref } from "./askQuestion";
import type { KnowledgeOsPhase } from "./taskAction";

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

// SCRUM-268: CTA in den bestehenden Validierungs-/Review-Fluss. Für review/validate führt sie auf
// die vorhandene Route /validierung; für openKo (nicht auflösbares KO) gibt es KEINE CTA (kein
// Fake-Review-Link) — dort bleiben nur Detail-Link und Missing-Hinweis. Keine neue Mutation,
// keine automatische Revalidierung, kein Backend.
export interface RevalidationCta {
  labelKey: string;
  href: string; // vorhandene Route
}

export function revalidationCta(view: Pick<RevalidationView, "nextStep">): RevalidationCta | null {
  switch (view.nextStep) {
    case "review":
      return { labelKey: "lcy.revalCta.review", href: "/validierung" };
    case "validate":
      return { labelKey: "lcy.revalCta.validate", href: "/validierung" };
    default:
      return null; // openKo → keine falsche CTA
  }
}

// SCRUM-278: nach einer erfolgreichen Revalidierungsaktion den nächsten Schritt zeigen. Immer:
// das betroffene KO ansehen (/wissen/:id). NUR wenn der Titel bekannt ist (KO im geladenen Bestand
// auflösbar, `found`) zusätzlich der Use-Schritt „Wissen nutzen/fragen" (/fragen?q=<Titel> via
// askQuestionHref) — kein Auto-Submit, keine automatische Nutzung. Reine, testbare Logik.
export interface RevalidationNextStep {
  labelKey: string;
  to: string; // vorhandene Route
}

export function revalidationNextSteps(done: {
  id: string;
  title: string;
  found: boolean;
}): RevalidationNextStep[] {
  const steps: RevalidationNextStep[] = [{ labelKey: "lcy.nextViewKo", to: `/wissen/${done.id}` }];
  if (done.found) {
    steps.push({ labelKey: "lcy.nextUse", to: askQuestionHref(done.title) });
  }
  return steps;
}

// SCRUM-299: eine fällige Revalidierung ist Knowledge-OS-Phase „Aktuell halten" (Maintain) — Gültigkeit
// prüfen, ggf. Review, danach quellengebunden weiter nutzen. Gleiche Kreis-Sprache wie Start/MyTasks
// (knowledgeOsPhase("task.revalidation") === "maintain"). Sonderfall: ist das KO noch nicht freigegeben
// (nextStep "validate"), ist der ehrliche nächste Kreis-Schritt „Validieren" — keine Maintain-Suggestion
// für noch nicht validiertes Wissen. KEINE automatische Revalidierung, kein neues Statusmodell.
export function revalidationPhase(view: Pick<RevalidationView, "nextStep">): KnowledgeOsPhase {
  return view.nextStep === "validate" ? "validate" : "maintain";
}
