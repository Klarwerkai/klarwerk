// AUFTRAG-mega6 Block D (bens Ehrlichkeitskante aus Sammel-Review 6): EINE gemeinsame Quelle für die
// Mengen- und Längengrenzen des PERSISTIERTEN Entwurfs. Vorher standen dieselben Zahlen nur in
// service.ts — die Oberfläche kannte sie nicht, der Server kürzte still, und der Save-Erfolg räumte
// danach den lokalen Zustand: ein stiller Teilverlust. Jetzt leiten BEIDE Seiten ihre Grenzen aus
// dieser Datei ab. Die Servernormalisierung bleibt unverändert Defense-in-Depth gegen fremde
// oder malformte API-Payloads; die Oberfläche verhindert nur, dass ein NORMALER Nutzer unbemerkt in
// diese Grenze läuft.
//
// AUFTRAG-mega8 Block A: die Oberfläche zog diese Werte bis mega7 per Import über die Modulgrenze —
// das brach den Produktions-Build (der webbuild-Stage im Dockerfile kennt services/ nicht). Diese
// Datei ist unverändert die Quelle der SERVERSEITE.
// GEGENSTÜCK: apps/web/src/lib/draftLimits.ts hält dieselben Werte jetzt selbst; beide werden von
// tests/capture/draft-limits-shared.test.ts Schlüssel für Schlüssel verglichen. Wer hier eine Zahl
// ändert, muss die Oberfläche nachziehen, sonst wird der Test rot.
//
// Reines Datenmodul ohne Abhängigkeiten.
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
  /** Zeichen für die externe Suchanfrage. */
  extQuery: 300,
  /** Gesicherte Interview-Antworten. */
  interviewAnswers: 50,
  /** Zeichen je Interview-Antwort. */
  interviewText: 4000,
  /** Zeichen der gesicherten Interview-Frage (Modellausgabe, keine Nutzereingabe). */
  interviewQuestion: 2000,
} as const;
