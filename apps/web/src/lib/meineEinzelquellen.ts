import type { KnowledgeObject } from "../api/types";

// ================================================================================================
// R-1626 (ROADMAP 1.4) — DIE WISSENS-LÜCKENLISTE ALS PERSÖNLICHE AUFGABENLISTE.
// ================================================================================================
//
// „Jeder Experte sieht eine kurze Liste: ‚Drei Themen aus deinem Bereich haben Bus-Faktor 1. Eines
// davon: … Möchtest du dazu jetzt fünf Minuten sprechen?' — kontextgenau, klein dosiert, immer
// relevant für diese Person."
//
// DIE REGEL IST DIE DES BUS-FAKTORS, nicht eine zweite: je Kategorie zählen die verschiedenen
// Wissensträger (`originalAuthor`) — genau so rechnet `LibraryService.busFactor`
// (services/library-analytics/src/service.ts, „Einzelquelle = nur ein Autor"). Ein Thema gehört in
// DIESE Liste, wenn sein einziger Träger die betrachtende Person ist.
//
// SICHTBARKEIT: gerechnet wird auf der Objektliste, die die Person ohnehin sehen darf (dieselbe
// Liste, aus der „Meine Aufgaben" liest). Es entsteht keine Auskunft über andere Personen und über
// nichts, was sie nicht sehen darf — genannt werden nur ihre eigenen Themen. Ob ein Objekt, das sie
// NICHT sehen darf, das Thema mitträgt, weiß diese Rechnung nicht; die Beschriftung sagt deshalb
// „sichtbares Wissen".

/** So viele Themen nennt die Liste höchstens — „klein dosiert". */
export const EINZELQUELLEN_DECKEL = 3;

export interface EinzelquellenThema {
  readonly thema: string;
  readonly objekte: number;
}

export function meineEinzelquellenThemen(
  objekte: readonly Pick<KnowledgeObject, "category" | "originalAuthor">[],
  userId: string | undefined,
): EinzelquellenThema[] {
  if (!userId) {
    return [];
  }
  const jeThema = new Map<string, { traeger: Set<string>; objekte: number }>();
  for (const ko of objekte) {
    const thema = ko.category?.trim();
    if (!thema) {
      continue;
    }
    const eintrag = jeThema.get(thema) ?? { traeger: new Set<string>(), objekte: 0 };
    eintrag.traeger.add(ko.originalAuthor);
    eintrag.objekte += 1;
    jeThema.set(thema, eintrag);
  }
  return [...jeThema.entries()]
    .filter(([, e]) => e.traeger.size === 1 && e.traeger.has(userId))
    .map(([thema, e]) => ({ thema, objekte: e.objekte }))
    .sort((a, b) => a.thema.localeCompare(b.thema));
}

/** Der Einstieg: das geführte Interview, mit dem Thema als sichtbarem Kontext auf dem Blatt. */
export function einzelquelleErfassenHref(thema: string): string {
  return `/erfassen?weg=interview&thema=${encodeURIComponent(thema)}`;
}
