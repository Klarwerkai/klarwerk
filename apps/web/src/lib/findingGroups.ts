// SCRUM-486 (nacht24 Paket 3): EINE klare, ruhige Darstellung je Konflikt-/Duplikat-Befund.
// Diese pure, DOM-freie Lib vereinheitlicht die Aufbereitung beider Boards:
//  - WAS: Duplikat / Überschneidung / Konflikt — ehrlich benannt nach ERKENNUNGSWEG
//    („mit KI" nur bei echtem Modell-Fund MIT Konfidenz, sonst „ohne KI (deterministisch)",
//    manuell Angelegtes bleibt „manuell") — dieselbe Ehrlichkeitsregel wie overlapDetectorInfo.
//  - WARUM: der kompakte Kernbeleg (führender Prozentwert + Begründung, nie ein Fake-Prozent).
//  - WELCHE AKTION: die bestehende Empfehlungs-/Nächster-Schritt-Ableitung (keine neue Logik).
//  - GRUPPIERUNG: je Beitrag (koA = der geprüfte/auslösende Beitrag), neueste zuerst.
// Keine Backend-Änderung — reine Anzeige-Aufbereitung über den unresolved()-Quellen (fail-closed
// aus aistate-fix5: stale Befunde erreichen diese Lib nie).
import type { Conflict, KnowledgeObject, OverlapEntry } from "../api/types";
import { conflictOriginInfo } from "./conflictBoard";
import { conflictNextStep } from "./conflictView";
import { overlapDetectorInfo, recommendationLabelKey } from "./duplicateBoard";

export type FindingKind = "konflikt" | "duplikat" | "ueberschneidung";
export type DetectionWay = "ki" | "deterministisch" | "manuell";

export interface FindingView {
  id: string;
  // WAS (ehrlich benannt) — als i18n-Schlüssel für die Kopfzeile der Karte.
  kind: FindingKind;
  kindLabelKey: string;
  // Erkennungsweg (ehrlich): „mit KI" NUR bei echtem Modell-Fund mit Konfidenz.
  way: DetectionWay;
  wayLabelKey: string;
  // Zwischen WELCHEN zwei Beiträgen (die Seite baut daraus klickbare Links beider Seiten).
  koA: string;
  koB: string;
  // WARUM (kompakt): führender Prozentwert (KI-Sicherheit bzw. Textdeckung) + Begründung.
  // Fehlt beides (Alt-/Handdaten), bleibt das Feld leer — kein erfundener Beleg.
  whyPercent?: number;
  whyRationale?: string;
  // WELCHE Aktion als i18n-Schlüssel (bestehende Ableitungen, keine neue Logik).
  actionLabelKey: string;
  open: boolean;
  createdAt: string;
}

const KIND_KEY: Record<FindingKind, string> = {
  konflikt: "finding.kind.konflikt",
  duplikat: "finding.kind.duplikat",
  ueberschneidung: "finding.kind.ueberschneidung",
};

const WAY_KEY: Record<DetectionWay, string> = {
  ki: "finding.way.ki",
  deterministisch: "finding.way.deterministisch",
  manuell: "finding.way.manuell",
};

// Konflikt → Befund-Sicht. Erkennungsweg EHRLICH wie beim Overlap-Pfad (duplicateBoard): „mit KI"
// NUR bei einem echten MODELL-Fund MIT Konfidenz — d. h. `detector.method === "model" && typeof
// confidence === "number"`. bens Sammel-Nacht (P1): ein `method:"deterministic"` mit optionaler
// Confidence darf NIE „mit KI" heißen (der Typ erlaubt diese Kombination). Auch der Prozentwert
// (whyPercent = KI-Sicherheit) erscheint dann NICHT — ein deterministischer Befund führt keinen
// KI-Sicherheitswert. Ohne echten Auto-Beleg bleibt es manuell.
export function conflictFinding(conflict: Conflict): FindingView {
  const origin = conflictOriginInfo(conflict);
  const isModelFinding =
    origin.isAuto &&
    conflict.detector?.method === "model" &&
    typeof conflict.detector?.confidence === "number";
  const way: DetectionWay = origin.isAuto ? (isModelFinding ? "ki" : "deterministisch") : "manuell";
  return {
    id: conflict.id,
    kind: "konflikt",
    kindLabelKey: KIND_KEY.konflikt,
    way,
    wayLabelKey: WAY_KEY[way],
    koA: conflict.koA,
    koB: conflict.koB,
    // KI-Sicherheit (%) nur bei echtem Modell-Fund — nie unter einem „ohne KI"-Etikett.
    ...(isModelFinding && origin.confidencePercent !== undefined
      ? { whyPercent: origin.confidencePercent }
      : {}),
    ...(origin.rationale ? { whyRationale: origin.rationale } : {}),
    actionLabelKey: `con.next.${conflictNextStep(conflict)}`,
    open: conflict.status !== "geloest",
    createdAt: conflict.createdAt,
  };
}

// Überschneidung/Duplikat → Befund-Sicht. WAS: relation „identisch" heißt ehrlich Duplikat,
// alles andere Überschneidung. Erkennungsweg über overlapDetectorInfo (KI nur mit Konfidenz);
// manuell angelegte Einträge bleiben „manuell".
export function overlapFinding(entry: OverlapEntry): FindingView {
  const info = overlapDetectorInfo(entry);
  const way: DetectionWay =
    entry.origin === "manual" ? "manuell" : info?.isModelFinding ? "ki" : "deterministisch";
  const kind: FindingKind = entry.relation === "identisch" ? "duplikat" : "ueberschneidung";
  const whyPercent = info
    ? info.isModelFinding
      ? info.confidencePercent
      : info.overlapPercent
    : undefined;
  return {
    id: entry.id,
    kind,
    kindLabelKey: KIND_KEY[kind],
    way,
    wayLabelKey: WAY_KEY[way],
    koA: entry.koA,
    koB: entry.koB,
    ...(whyPercent !== undefined ? { whyPercent } : {}),
    ...(info?.rationale ? { whyRationale: info.rationale } : {}),
    actionLabelKey: recommendationLabelKey(entry.recommendation),
    open: entry.status !== "geschlossen",
    createdAt: entry.createdAt,
  };
}

// Gruppierung je Beitrag: koA ist der geprüfte/auslösende Beitrag (detect*ForKo legt Befunde mit
// koA = geprüftem KO an) — jeder Befund erscheint genau EINMAL (keine Doppelung unter beiden Seiten).
export interface FindingGroup<T extends { koA: string; createdAt: string }> {
  koId: string;
  // Zeitanker der Gruppe = neuester Befund (für die Gruppen-Sortierung „neueste zuerst").
  newestAt: string;
  items: T[];
}

function timeOf(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Neueste zuerst — innerhalb der Gruppe UND zwischen den Gruppen. Stabil bei gleichem Datum.
export function groupFindingsByBeitrag<T extends { koA: string; createdAt: string }>(
  findings: readonly T[],
): FindingGroup<T>[] {
  const byKo = new Map<string, T[]>();
  for (const finding of findings) {
    const list = byKo.get(finding.koA) ?? [];
    list.push(finding);
    byKo.set(finding.koA, list);
  }
  const groups: FindingGroup<T>[] = [];
  for (const [koId, items] of byKo) {
    const sorted = [...items].sort((x, y) => timeOf(y.createdAt) - timeOf(x.createdAt));
    const newest = sorted[0];
    groups.push({ koId, newestAt: newest ? newest.createdAt : "", items: sorted });
  }
  return groups.sort((x, y) => timeOf(y.newestAt) - timeOf(x.newestAt));
}

// Titel-Auflösung für die Gruppen-Kopfzeile (null = Beitrag entfernt — die Seite zeigt den
// neutralen „entfernt"-Hinweis, nie die Roh-UUID).
export function resolveKo(koId: string, kos: readonly KnowledgeObject[]): KnowledgeObject | null {
  return kos.find((k) => k.id === koId) ?? null;
}
