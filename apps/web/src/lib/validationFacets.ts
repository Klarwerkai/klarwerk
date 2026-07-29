// AUFTRAG-mega45 Block H (SCRUM-425): die Facetten-Schiene der VALIDIERUNG.
//
// Der Filter-Vorschlag vom 25.07. ist gebaut — als `FacetFilter` mit Zählern, ausgegrauten
// Null-Treffern, aktiven Pillen und „Alle zurücksetzen". Eingesetzt war er nur in der Bibliothek.
// SCRUM-425 beschreibt genau diese Lücke.
//
// DIESELBE KOMPONENTE, NICHT EINE ZWEITE FASSUNG: die Schiene, die Gruppenbildung
// (`facetRailGroups`) und die Anwendung (`applyFacetSelection`) sind unverändert die der
// Bibliothek. Nur die WERTE sind andere — und die stammen ausnahmslos aus Feldern, die die
// Validierungs-Karten ohnehin schon anzeigen. Es kommt KEINE neue Abfrage dazu.
//
// WAS BEWUSST FEHLT — „Konfliktlage".
// Sie wäre die naheliegende dritte Facette und ist NICHT gebaut. Grund: ein `KnowledgeObject`
// trägt kein Konfliktfeld. Die Konfliktlage lebt in einer eigenen Abfrage (`useConflicts`), und
// sie hier einzuziehen hiesse, dem Prüf-Board eine zweite Lade- und Fehlerquelle anzuhängen — für
// eine Filterdimension. Das ist kein Einbau mehr, sondern ein Umbau, und der Auftrag sagt für
// diesen Fall: anhalten und melden. Steht so im Bericht zu mega45.
import type { KnowledgeObject } from "../api/types";
import { confidentialityOf } from "./confidentiality";
import type { FacetGroupConfig } from "./facetFilter";
import type { FacetValues } from "./facets";
import { trustBucket } from "./libraryFacets";
import { libraryMaturity } from "./libraryMaturity";
import { reviewWorkView } from "./reviewSignals";

/**
 * Die Facetten des Prüf-Boards. Reihenfolge = Reihenfolge in der Schiene.
 *
 * `pruefstand` und `maturity` sind die beiden fachlichen Dimensionen des Boards; `trust`,
 * `confidentiality` und `author` sind die freien Beigaben aus demselben Objekt. KEINE davon
 * dupliziert ein vorhandenes Bedienelement der Seite (Suche, Wissensart, Kategorie, Schlagwort,
 * „Mir zugewiesen", „KI-Prüfung offen", Herkunft, Review-Fokus bleiben, wie sie sind) — die
 * Schiene ist rein additiv, damit an den Prüf-Aktionen nichts verlorengehen kann.
 */
export const VALIDATION_FACET_CONFIGS: readonly FacetGroupConfig[] = [
  { key: "pruefstand", labelKey: "val.facet.pruefstand" },
  { key: "maturity", labelKey: "lib.facet.maturity" },
  { key: "trust", labelKey: "lib.facet.trust" },
  { key: "confidentiality", labelKey: "lib.facet.confidentiality" },
  { key: "author", labelKey: "lib.facet.author" },
];

/** Seltenere Dimensionen wandern hinter „Weitere Filter" (uxpol5 Punkt 2). */
export const VALIDATION_SECONDARY_FACET_KEYS = ["confidentiality", "author"] as const;

/** Kurz und tonhaltig → Pillenreihe statt Ankreuzliste (wie „Reife" in der Bibliothek). */
export const VALIDATION_PILL_FACET_KEYS = ["pruefstand"] as const;

export const VALIDATION_MORE_FILTERS_STORAGE_KEY = "klarwerk.validation.filters.moreOpen";

/**
 * Die Facettenwerte EINES Prüf-Kandidaten — ausschliesslich aus Feldern, die die Karte ohnehin
 * rendert. `reviewWorkView` und `libraryMaturity` sind dieselben reinen Funktionen, mit denen das
 * Board seine Abzeichen zeichnet; hier entsteht also keine zweite Wahrheit über den Prüfstand.
 */
export function validationFacetValues(ko: KnowledgeObject): FacetValues {
  return {
    pruefstand: [reviewWorkView(ko).state],
    maturity: [libraryMaturity(ko).usability],
    trust: [trustBucket(ko.trust)],
    confidentiality: [confidentialityOf(ko.confidentiality)],
    author: ko.author ? [ko.author] : [],
  };
}
