// AUFTRAG-mega6 Block D (bens Ehrlichkeitskante): die EINZIGE Stelle, an der die Oberfläche die
// Persistenzgrenzen des Entwurfs bezieht. Bewusst KEIN Endpunkt/Fetch: die Grenzen sind
// Vertragskonstanten, keine Laufzeitdaten.
//
// AUFTRAG-mega8 Block A: bis mega7 re-exportierte diese Datei direkt aus
// services/capture/src/draft-limits.ts. Das brach den Produktions-Build — der webbuild-Stage im
// Dockerfile kopiert nur apps/web, der relative Pfad nach services/ zeigte dort ins Leere
// (rollup: "Could not resolve"). apps/web importiert deshalb nichts mehr aus services/; die Werte
// stehen hier nun selbst.
//
// GEGENSTÜCK: services/capture/src/draft-limits.ts (Quelle der Serverseite). Beide Objekte werden
// von tests/capture/draft-limits-shared.test.ts Schlüssel für Schlüssel verglichen — ändert sich
// eine Seite ohne die andere, wird der Test rot. Die Drift, die ben ausschließen wollte, ist damit
// weiterhin ausgeschlossen, nur über den Test statt über den Import.
export const DRAFT_LIMITS = {
  /** Prüfer-Vorschläge je Entwurf. */
  reviewers: 20,
  /** Zeichen je Prüfer-ID (technisch, keine Nutzereingabe). */
  reviewerId: 128,
  /** Einträge in der Quellen-Warteliste. */
  sources: 25,
  /** Zeichen für die Bezeichnung einer Quelle. */
  sourceLabel: 300,
  /** Zeichen für die URL einer Quelle. */
  sourceUrl: 2048,
  /** Zeichen für den Auszug einer Quelle. */
  sourceExcerpt: 500,
  /** Zeichen für die Such-/Herkunftsquelle eines Treffers (kein KI-Anbieter). */
  sourceProvider: 100,
  /**
   * AUFTRAG-mega20 Block D: Zeichen je Referenzfeld einer wartenden Belegstelle (`anchorKey`,
   * `objectId`). Technische Kennungen, keine Nutzereingabe — echte Werte sind UUIDs (36 Zeichen);
   * 128 liegt weit darüber und deckelt trotzdem einen aufgeblähten fremden Payload.
   */
  sourceRef: 128,
  /** Zeichen für die externe Suchanfrage. */
  extQuery: 300,
  /** Gesicherte Interview-Antworten. */
  interviewAnswers: 50,
  /** Zeichen je Interview-Antwort. */
  interviewText: 4000,
  /** Zeichen der gesicherten Interview-Frage (Modellausgabe, keine Nutzereingabe). */
  interviewQuestion: 2000,
} as const;
