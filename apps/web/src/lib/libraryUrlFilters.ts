// AUFTRAG-mega9 Block E-2 (KW-E2E-006): Der Bibliotheksfilter übersteht den Reload.
//
// Befund des Prüfers, und er ist mehr als ein Bug: die SORTIERUNG bleibt (usePersistentEnum) und der
// Aufklapp-Zustand von „Weitere Filter" bleibt (usePersistentDisclosure) — aber die eigentliche
// Facetten-Auswahl lebte in useState und war nach dem Reload weg. „Sortierung und Aufklapper bleiben,
// der eigentliche Inhaltsfilter nicht."
//
// Warum die URL und nicht der Browser-Speicher: ein Filterzustand in der URL ist TEILBAR und
// überlebt jeden Reload — und er ist die Voraussetzung für das Filter-Redesign, das noch zur
// Abnahme aussteht. Die Seite las schon `?q=`, `?category=` und `?origin=`; dieser Helfer erweitert
// GENAU diesen bestehenden Weg auf alle Facetten-Dimensionen, statt einen zweiten daneben zu stellen.
//
// Konventionen:
//   • Ein Parameter je Dimension, benannt wie der Facetten-Schlüssel (`category`, `tag`, `trust`, …).
//   • Mehrfachauswahl = WIEDERHOLTER Parameter (`?tag=a&tag=b`) — die Werte selbst brauchen dann kein
//     Trennzeichen und dürfen jedes Zeichen enthalten (kein Escaping-Vertrag, der brechen kann).
//   • `?category=X` (einwertig) bleibt damit unverändert gültig — die bestehenden Deep-Links aus
//     „Risiko & Lücken" funktionieren weiter.
import { DEMO_FILTER_PARAM, readDemoKnowledgeFilter } from "./demoKnowledge";
import { type FacetSelection, type FacetValues, isFacetNoMatch } from "./facets";

// Fremde Parameter, die die Seite für anderes benutzt und die dieser Helfer NIE anfassen darf.
const RESERVED_PARAMS = new Set(["q"]);

// Liest die Facetten-Auswahl aus den Query-Parametern.
//
// `origin` läuft bewusst weiter über readDemoKnowledgeFilter: dessen Vertrag lautet
// „fehlend/ungültig → all (kein Effekt)". Würde diese Dimension generisch gelesen, machte
// `?origin=quatsch` aus einem heute neutralen Link plötzlich einen Filter, der auf nichts passt —
// eine stille Verhaltensänderung an einem bestehenden Deep-Link.
//
// ACHTUNG (AUFTRAG-mega11 Block C): Diese Funktion prüft nur die Parameter-NAMEN und dass ein Wert
// nicht leer ist. Sie KANN die Werte hier nicht prüfen — der Bestand ist zum Zeitpunkt des Lesens
// noch nicht geladen. Die Wertprüfung ist deshalb ein zweiter, nachgelagerter Schritt:
// `pruneFacetSelectionToKnownValues` weiter unten. Wer diese Funktion benutzt, MUSS ihr Ergebnis
// durch jene Prüfung schicken, bevor es zu einem echten Auswahlzustand wird.
export function facetSelectionFromParams(
  params: URLSearchParams,
  facetKeys: readonly string[],
): FacetSelection {
  const selection: FacetSelection = {};
  for (const key of facetKeys) {
    if (RESERVED_PARAMS.has(key)) {
      continue;
    }
    if (key === DEMO_FILTER_PARAM) {
      const origin = readDemoKnowledgeFilter(params);
      if (origin !== "all") {
        selection[key] = [origin];
      }
      continue;
    }
    const values = params.getAll(key).filter((v) => v.length > 0);
    if (values.length > 0) {
      // Doppelte Werte im Link vereinheitlichen — die Auswahl ist eine Menge.
      selection[key] = [...new Set(values)];
    }
  }
  return selection;
}

// Schreibt die Facetten-Auswahl in die Query-Parameter und lässt alles Übrige (insbesondere `q`)
// unberührt.
//
// NO-MATCH wird bewusst NICHT serialisiert. Der No-Match-Zustand ist ein struktureller Typ-Fall
// (FACET_NO_MATCH_SELECTION in lib/facets), den „kein echter Wert je erzeugen oder aufheben kann" —
// genau darum gibt es dort keinen Magic-String. Ihn hier als Zeichenkette in die URL zu schreiben,
// würde diesen reservierten Wert wieder einführen und die Grenze aufweichen, die uxpol4 gezogen hat.
// Eine No-Match-Dimension verschwindet daher aus der URL (der Link zeigt die Auswahl ohne sie).
export function writeFacetSelectionToParams(
  prev: URLSearchParams,
  selection: FacetSelection,
  facetKeys: readonly string[],
): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const key of facetKeys) {
    if (RESERVED_PARAMS.has(key)) {
      continue;
    }
    next.delete(key);
    const groupSelection = selection[key];
    if (!groupSelection || isFacetNoMatch(groupSelection)) {
      continue;
    }
    for (const value of groupSelection) {
      if (value.length > 0) {
        next.append(key, value);
      }
    }
  }
  return next;
}

// Kanonische Zeichenkette einer Auswahl — nur für den Vergleich „hat sich gegenüber der URL etwas
// geändert?" gedacht, damit die Fortschreibung nicht in einer Endlosschleife läuft. Sortiert, damit
// dieselbe Menge in anderer Klick-Reihenfolge dieselbe Zeichenkette ergibt.
export function serializeFacetSelection(
  selection: FacetSelection,
  facetKeys: readonly string[],
): string {
  return facetKeys
    .map((key) => {
      const groupSelection = selection[key];
      if (!groupSelection) {
        return `${key}=`;
      }
      if (isFacetNoMatch(groupSelection)) {
        return `${key}=<no-match>`;
      }
      return `${key}=${[...groupSelection].sort().join("")}`;
    })
    .join("");
}

// ── AUFTRAG-mega11 Block C (bens SB-3): die Werte-Grenze des URL-Eingangs ─────────────────────────
//
// Befund: `facetSelectionFromParams` begrenzt die Parameter-NAMEN auf die bekannten Facetten-
// schlüssel, prüft die WERTE aber nur auf „nicht leer". `?category=erfunden` wurde damit zu einer
// ganz normalen `FacetSelection` — sie filterte auf null Treffer und war vom Typ her ein ECHTER
// Facettenwert. Library.tsx übernahm sie unverändert in `currentViewState`, und „Diese Suche
// merken" schrieb sie in den localStorage. Damit überlebte ein eingeschleuster Wert als echter
// Facettenwert in einer gespeicherten Sicht — genau die Klasse, die uxpol4 über den Magic-String
// geschlossen hatte, nur auf einem anderen Weg wieder herein.
//
// Zwei Grenzen, die hier ausdrücklich NICHT verschoben werden:
//
//  1. Ein unbekannter URL-Wert wird NICHT zu `FACET_NO_MATCH_SELECTION`. Der No-Match-Zustand ist
//     der strukturelle Fall „der Nutzer hat bewusst alles abgewählt ⇒ 0 Treffer". Ein fremder Wert
//     aus einer Adresszeile ist etwas anderes: ein ungültiger Eingang. Beides zu vermischen hieße,
//     einem Link die Macht zu geben, den strukturellen Zustand zu erzeugen — die Grenze, die uxpol4
//     gezogen hat. Ein unbekannter Wert fällt deshalb einfach WEG; bleibt in der Dimension nichts
//     übrig, ist sie offen (kein Filter).
//
//  2. `origin` behält seinen Sondervertrag und wird hier NICHT geprüft. Er ist bereits am Eingang
//     abgesichert (ungültig → neutral, nie ein Filter). Ihn hier zusätzlich gegen den Bestand zu
//     prüfen, hätte eine ANDERE Wirkung: `?origin=demo` in einem Bestand ganz ohne Demo-Wissen ist
//     ein GÜLTIGER Wert, der ehrlich 0 Treffer zeigt — ihn wegzuwerfen machte daraus stillschweigend
//     „kein Filter" und zeigte dem Nutzer die volle Liste, obwohl er ausdrücklich eingegrenzt hat.

// Welche Werte kommen je Facette im BESTAND tatsächlich vor? Gebaut aus denselben abgeleiteten
// Werten, gegen die auch gefiltert wird (`libraryFilterValues`) — keine zweite Wertelehre.
export function knownFacetValues(
  valueSets: Iterable<FacetValues>,
  facetKeys: readonly string[],
): Map<string, Set<string>> {
  const known = new Map<string, Set<string>>(facetKeys.map((key) => [key, new Set<string>()]));
  for (const values of valueSets) {
    for (const key of facetKeys) {
      const bucket = known.get(key);
      if (!bucket) {
        continue;
      }
      for (const value of values[key] ?? []) {
        bucket.add(value);
      }
    }
  }
  return known;
}

// Wirft aus einer Auswahl alles heraus, was im Bestand nicht vorkommt. Reine Funktion; der Aufrufer
// entscheidet, WANN sie läuft (nämlich genau einmal, sobald der Bestand geladen ist).
//
// `exemptKeys`: Dimensionen mit eigenem Eingangsvertrag — für die Bibliothek `origin` (siehe oben).
export function pruneFacetSelectionToKnownValues(
  selection: FacetSelection,
  known: ReadonlyMap<string, ReadonlySet<string>>,
  exemptKeys: readonly string[] = [DEMO_FILTER_PARAM],
): FacetSelection {
  const exempt = new Set(exemptKeys);
  const pruned: FacetSelection = {};
  for (const [key, groupSelection] of Object.entries(selection)) {
    if (groupSelection === undefined) {
      continue;
    }
    // Strukturelles No-Match bleibt unangetastet — es ist kein Wert und wird hier nicht erzeugt.
    if (exempt.has(key) || isFacetNoMatch(groupSelection)) {
      pruned[key] = groupSelection;
      continue;
    }
    const allowed = known.get(key);
    const kept = groupSelection.filter((value) => allowed?.has(value) === true);
    if (kept.length > 0) {
      pruned[key] = kept;
    }
    // Bleibt nichts übrig, verschwindet die Dimension ganz: offen, kein Filter, kein No-Match.
  }
  return pruned;
}
