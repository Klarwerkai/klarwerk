// ================================================================================================
// JOB 3034 R2 · DER ZWISCHENSPEICHER ÜBERLEBT EINE GESCHEITERTE AUFFRISCHUNG — FÜR JEDE ABFRAGE.
// ================================================================================================
//
// PRÜFSTATUS-ANZEIGE (R-1534): bis hierher wohnten diese beiden Regeln in `lib/confidentiality.ts`
// („aus Zielpfadgründen", JOB 3034), obwohl sie nichts mit Vertraulichkeit zu tun haben und ihr
// eigener Kommentar die allgemeine Abfragezustands-Schicht als baulichen Ort nannte. Sie gelten für
// JEDE Leseabfrage und stehen deshalb hier — fachneutral, in Inhalt und Verhalten unverändert. Die
// Bauform des sichtbaren Hinweises (`AUFFRISCHUNG_HINWEIS_*`, `auffrischungHinweisText`) bleibt
// beim bisherigen Ort.
import type { UseQueryResult } from "@tanstack/react-query";

//
// WAS RUNDE 1 FALSCH HATTE. Der Chip stand richtig da, solange frisch geladen wurde — aber
// `QueryState` (components/ui.tsx) fragt nur `isError` und wirft dabei vorhandene Daten weg. Bei
// react-query ist nach einem gescheiterten REFETCH beides zugleich wahr: `isError: true`
// (genauer `isRefetchError: true`) UND `data` weiterhin gefüllt. Ergebnis: bei jedem gescheiterten
// Hintergrundabruf verschwanden Titel, Karte und Stufenkennzeichen auf beiden Seiten hinter einer
// Fehlerfläche. Das verletzt REGELN Punkt 7 („die zuletzt erfolgreich geholten Werte bleiben
// SICHTBAR") und Abschnitt 9 des Auftrags („der alte Chip bleibt; es entsteht KEINE neue negative
// Aussage aus einem gescheiterten Abruf") — und offline ist es derselbe Fall.
//
// DIE REGEL, EINE STELLE: liegt ein erfolgreich geholter Stand vor, GILT ER. Der Fehler des
// Auffrischungsversuchs wird dann nicht zur Aussage über den Bestand, sondern zur Aussage über den
// Abruf — die Fläche zeigt ihn als Hinweis „Stand von <Zeit> · Auffrischung fehlgeschlagen"
// (i18n `state.staleRefetchFailed`) NEBEN den weiterhin sichtbaren Werten. Ohne Stand (Erstabruf
// gescheitert) bleibt es beim Fehlerzustand: dann gibt es nichts zu zeigen, und es entsteht auch
// KEIN „nicht eingestuft" — das wäre eine Bestandsaussage ohne Bestand.
//
export function abfrageMitBestand<T>(query: UseQueryResult<T>): UseQueryResult<T> {
  if (!query.isError || query.data == null) {
    return query;
  }
  // Der einzige Zweck der Behauptung: `UseQueryResult` ist eine unterschiedene Vereinigung, deren
  // Zweige sich nicht per Spread neu zusammensetzen lassen. Die gesetzten Felder sind genau die,
  // die den Erfolgszweig ausmachen; `data` ist oben als vorhanden geprüft.
  return {
    ...query,
    status: "success",
    isSuccess: true,
    isPending: false,
    isLoading: false,
    isError: false,
    isLoadingError: false,
    isRefetchError: false,
    error: null,
  } as unknown as UseQueryResult<T>;
}

/**
 * Wahr, wenn ein vorhandener Stand gezeigt wird, OBWOHL die letzte Auffrischung scheiterte.
 * Genau dann (und nur dann) gehört der Hinweis `state.staleRefetchFailed` auf die Fläche.
 */
export function auffrischungGescheitert<T>(query: UseQueryResult<T>): boolean {
  return query.isError && query.data != null;
}
