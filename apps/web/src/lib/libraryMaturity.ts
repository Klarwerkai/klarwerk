// SCRUM-262: DOM-freie Reife-/Nutzbarkeitsanzeige je Bibliothekstreffer. Leitet die Reife
// AUSSCHLIESSLICH aus dem vorhandenen KO ab (über koOverview → reviewSignals/deriveStatus) und
// übersetzt sie in eine ehrliche Klartext-Aussage: nutzbar (validiert) · in Prüfung · zu prüfen.
// Offene KOs erscheinen damit NIE als „nutzbar". Keine neue Suche, keine Mutation, kein Backend.
import type { KnowledgeObject } from "../api/types";
import { askQuestionHref } from "./askQuestion";
import { type KoUsability, koOverview } from "./koOverview";
import { useReadiness } from "./useReadiness";

export type MaturityTone = "pos" | "warn" | "neutral";

export interface LibraryMaturity {
  usability: KoUsability;
  labelKey: string;
  tone: MaturityTone;
}

export interface LibraryUseCta {
  labelKey: string;
  href: string;
  kind: "ask" | "review";
}

// SCRUM-293: Label + Tönung kommen aus der GETEILTEN Use-Readiness-Sprache (useReadiness), damit
// Bibliothek und KO-Detail für denselben Zustand identische Begriffe zeigen („Nutzbar"/„In Prüfung"/
// „Zu prüfen"). „all" behält seinen eigenen Filter-Key (maturityFilterLabelKey).
const META: Record<KoUsability, { labelKey: string; tone: MaturityTone }> = {
  ready: { labelKey: useReadiness("ready").labelKey, tone: useReadiness("ready").tone },
  "in-review": {
    labelKey: useReadiness("in-review").labelKey,
    tone: useReadiness("in-review").tone,
  },
  "needs-work": {
    labelKey: useReadiness("needs-work").labelKey,
    tone: useReadiness("needs-work").tone,
  },
};

export function libraryMaturity(ko: KnowledgeObject): LibraryMaturity {
  const usability = koOverview(ko).usability;
  return { usability, ...META[usability] };
}

// SCRUM-288: In der Bibliothek führt nur nutzbares/validiertes Wissen in den Ask-Flow. Alles,
// was noch offen oder in Prüfung ist, wird ehrlich Richtung Validierung geführt — keine neue
// Suche, keine Mutation, nur sichere CTA-Wahl aus der vorhandenen Reife.
export function libraryUseCta(ko: KnowledgeObject): LibraryUseCta {
  const maturity = libraryMaturity(ko);
  if (maturity.usability === "ready") {
    return { labelKey: "lib.ask", href: askQuestionHref(ko.title), kind: "ask" };
  }
  return { labelKey: "lib.review", href: "/validierung", kind: "review" };
}

// SCRUM-267: einfacher Reife-Filter für die Bibliothek. „all" + die drei Reifearten — dieselbe
// Logik wie die Plakette (libraryMaturity → koOverview). Arbeitet auf der bereits server-gefilterten
// und client-seitig gerankten Trefferliste; keine neue Suche, kein Backend.
export type MaturityFilter = "all" | KoUsability;

export const MATURITY_FILTERS: readonly MaturityFilter[] = [
  "all",
  "ready",
  "in-review",
  "needs-work",
];

// i18n-Label je Filter (für die Chips). „all" eigener Key; sonst dasselbe Label wie die Plakette.
export function maturityFilterLabelKey(filter: MaturityFilter): string {
  return filter === "all" ? "lib.maturity.all" : META[filter].labelKey;
}

// Filtert eine Liste von Treffern (alles mit `.ko`) nach Reife. „all" lässt unverändert (keine
// stille Ausblendung); sonst exakt die Reife der Plakette — „ready" enthält nie offene/ungeprüfte KOs.
export function filterByMaturity<T extends { ko: KnowledgeObject }>(
  items: readonly T[],
  filter: MaturityFilter,
): T[] {
  if (filter === "all") {
    return [...items];
  }
  return items.filter((item) => libraryMaturity(item.ko).usability === filter);
}

// Ehrliche Zähler je Reife (für die Chips). „all" = Gesamtzahl.
export function countByMaturity<T extends { ko: KnowledgeObject }>(
  items: readonly T[],
): Record<MaturityFilter, number> {
  const counts: Record<MaturityFilter, number> = {
    all: items.length,
    ready: 0,
    "in-review": 0,
    "needs-work": 0,
  };
  for (const item of items) {
    counts[libraryMaturity(item.ko).usability] += 1;
  }
  return counts;
}
