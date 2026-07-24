// D-BIB (nacht24 Paket 5): dynamische Facetten der Bibliothek AUS DEM BESTAND — Kategorie
// (Abteilung), Sprache (Titel-Präfix, geteilte Erkennung mit dem Import), Status (dieselbe
// Ableitung wie die Validierungs-Badges), Autor, Alter (Buckets aus createdAt), Trust (Buckets).
// Pure, DOM-frei. Effizienz-Vertrag (10.000+): libraryFacetValues (Regex/Datums-Parsen) läuft
// EINMAL je Datenlauf (die Seite memoisiert die Map je KO-Id); Zählen/Filtern sind billige
// Map-/Array-Operationen (lib/facets).
// Dazu: GESPEICHERTE SICHTEN — benannt, LOKAL je Nutzer (localStorage, wie die Board-Checkboxen;
// bewusst KEIN Server-Speicher — ehrlich dokumentiert: die Sicht lebt nur in diesem Browser).
import type { KnowledgeObject } from "../api/types";
import { deriveStatus } from "./displayStatus";
import { type FacetValues, languageFromTitle } from "./facets";

export const LIBRARY_FACET_KEYS = [
  "category",
  "language",
  "status",
  "author",
  "age",
  "trust",
] as const;
export type LibraryFacetKey = (typeof LIBRARY_FACET_KEYS)[number];

export const LIBRARY_FACET_LABEL_KEYS: Record<LibraryFacetKey, string> = {
  category: "lib.facet.category",
  language: "lib.facet.language",
  status: "lib.facet.status",
  author: "lib.facet.author",
  age: "lib.facet.age",
  trust: "lib.facet.trust",
};

// Alter-Buckets (ehrliche, grobe Staffel): ≤30 Tage · ≤180 Tage · ≤1 Jahr · älter · unbekannt.
export type AgeBucket = "d30" | "d180" | "y1" | "older" | "unknown";
const DAY_MS = 24 * 60 * 60 * 1000;

export function ageBucket(createdAt: string | undefined, nowMs: number): AgeBucket {
  const parsed = createdAt ? Date.parse(createdAt) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    return "unknown";
  }
  const age = nowMs - parsed;
  if (age <= 30 * DAY_MS) {
    return "d30";
  }
  if (age <= 180 * DAY_MS) {
    return "d180";
  }
  if (age <= 365 * DAY_MS) {
    return "y1";
  }
  return "older";
}

// Trust-Buckets: 0 (noch keine Rückmeldung) · 1–39 · 40–69 · 70+.
export type TrustBucket = "t0" | "t1" | "t40" | "t70";

export function trustBucket(trust: number): TrustBucket {
  if (trust >= 70) {
    return "t70";
  }
  if (trust >= 40) {
    return "t40";
  }
  if (trust >= 1) {
    return "t1";
  }
  return "t0";
}

// Die (einmal je Datenlauf abgeleiteten) Facetten-Werte eines KOs.
export function libraryFacetValues(ko: KnowledgeObject, nowMs: number): FacetValues {
  return {
    category: ko.category ? [ko.category] : [],
    language: [languageFromTitle(ko.title)],
    status: [deriveStatus(ko)],
    author: ko.author ? [ko.author] : [],
    age: [ageBucket(ko.createdAt, nowMs)],
    trust: [trustBucket(ko.trust)],
  };
}

// Untergruppen-Ansicht: nach welchen Facetten gruppiert werden kann (metadaten-basiert;
// KI-Themencluster bewusst NICHT — kein trivial anzubindender Bestandteil, im Bericht vermerkt).
export const LIBRARY_GROUP_KEYS = ["none", "category", "language", "status", "author"] as const;
export type LibraryGroupKey = (typeof LIBRARY_GROUP_KEYS)[number];

export interface LibrarySubgroup<T> {
  value: string;
  items: T[];
}

// Gruppiert eine (bereits gefilterte/gefensterte) Liste nach dem ERSTEN Wert der Facette.
// Reihenfolge: Gruppengröße absteigend, dann Wert alphabetisch (ruhige, vorhersagbare Ordnung).
export function groupByFacet<T>(
  items: readonly T[],
  valuesOf: (item: T) => FacetValues,
  key: LibraryFacetKey,
): LibrarySubgroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const value = valuesOf(item)[key]?.[0] ?? "";
    const bucket = buckets.get(value);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(value, [item]);
    }
  }
  return [...buckets.entries()]
    .map(([value, groupItems]) => ({ value, items: groupItems }))
    .sort((a, b) => b.items.length - a.items.length || a.value.localeCompare(b.value));
}

// ---- Gespeicherte Sichten (lokal je Nutzer, localStorage-Muster wie Board-Checkboxen) ----

export interface LibrarySavedView {
  name: string;
  // Der komplette Ansichts-Zustand (Filter, Facetten-Auswahl, Reife, Herkunft, Gruppierung) —
  // bewusst als offenes Objekt: unbekannte Felder älterer/neuerer Stände bleiben erhalten.
  state: Record<string, unknown>;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function viewsKey(userId: string): string {
  return `klarwerk.library.views.${userId || "anon"}`;
}

// Lesen ist fehlertolerant: kaputtes JSON/Fremdformat → leere Liste (nie ein Crash der Seite).
export function readLibraryViews(storage: StorageLike, userId: string): LibrarySavedView[] {
  try {
    const raw = storage.getItem(viewsKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (v): v is LibrarySavedView =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as { name?: unknown }).name === "string" &&
        typeof (v as { state?: unknown }).state === "object" &&
        (v as { state?: unknown }).state !== null,
    );
  } catch {
    return [];
  }
}

// Upsert per Name (Name = Identität der Sicht), alphabetisch stabil sortiert.
export function saveLibraryView(
  storage: StorageLike,
  userId: string,
  view: LibrarySavedView,
): LibrarySavedView[] {
  const name = view.name.trim();
  if (name.length === 0) {
    return readLibraryViews(storage, userId);
  }
  const next = [
    ...readLibraryViews(storage, userId).filter((v) => v.name !== name),
    { name, state: view.state },
  ].sort((a, b) => a.name.localeCompare(b.name));
  storage.setItem(viewsKey(userId), JSON.stringify(next));
  return next;
}

export function removeLibraryView(
  storage: StorageLike,
  userId: string,
  name: string,
): LibrarySavedView[] {
  const next = readLibraryViews(storage, userId).filter((v) => v.name !== name);
  storage.setItem(viewsKey(userId), JSON.stringify(next));
  return next;
}
