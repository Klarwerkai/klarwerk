// ================================================================================================
// JOB 4086 — VIER FEHLERLAGEN, VIER SÄTZE. UND NICHTS DAZWISCHEN.
// ================================================================================================
//
// DAS PROBLEM, GEGEN DAS DIESE DATEI STEHT: Ein Serverfehler ist für den Server eine Zahl und ein
// Kürzel. Für den Menschen vor dem Bildschirm ist er eine Frage: „Was ist los, und was kann ich
// tun?" Bis hierher beantwortete das niemand — ein `503` oder ein englischer Serverbrocken im
// deutschen Bild ist keine Antwort, sondern eine Zumutung.
//
// DIE ABBILDUNG IST REIN UND OHNE DOM, damit sie prüfbar ist, ohne eine Fläche zu montieren:
// Fehlercode hinein, i18n-Schlüssel heraus. Übersetzt wird erst dort, wo die Sprache bekannt ist.
//
// ================================================================================================
// WARUM UNBEKANNTES AUF „VERBINDUNG WEG" FÄLLT UND NICHT AUF EINEN FÜNFTEN SATZ.
// ================================================================================================
//
// Der Server unterscheidet genau vier Zustände (`services/sharepoint/src/graph-client.ts`,
// `sharepoint-import-routes.ts`). Ein Code, der hier nicht steht, kann nur zweierlei sein: eine
// künftige Erweiterung, die ihren Satz noch nicht mitbringt — oder eine Störung auf dem Weg. In
// beiden Fällen ist „die Verbindung steht gerade nicht" die einzige Aussage, die WAHR bleibt.
//
// Ein eigener Satz „unbekannter Fehler" wäre die Alternative, und er wäre schlechter: Er sagt dem
// Menschen nichts, das er nicht schon sähe, und er ist die Tür, durch die eines Tages doch wieder
// ein Serverkürzel auf die Fläche kommt. Was diese Abbildung strukturell ausschliesst: Es gibt
// keinen Rückgabewert `null` und keinen Zweig, der den rohen Code anzeigt.

/** Die vier i18n-Schlüssel, in der Reihenfolge der vier Lagen aus dem Auftrag (a) bis (d). */
export const SHAREPOINT_FEHLERLAGEN = [
  "imp.sharepoint.fehler.nichtEingerichtet",
  "imp.sharepoint.fehler.keineBerechtigung",
  "imp.sharepoint.fehler.nichtVorhanden",
  "imp.sharepoint.fehler.verbindungWeg",
] as const;

/** Der Fehlercode, wie der Server ihn im Feld `error` führt. */
export type SharePointFehlerCode = string;

/**
 * Server-Fehlercode → Satz-Schlüssel. Die vier Einträge sind deckungsgleich mit den vier
 * Ausgängen der Routen; ein fünfter Code dort ohne Eintrag hier fällt auf `verbindungWeg` und
 * macht `tests/sharepoint-onedrive-import/fehlerlagen-dreisprachig.test.ts` nicht rot — was ihn
 * rot macht, ist ein fehlender oder doppelter SATZ.
 */
export const SHAREPOINT_FEHLER_TEXT: Record<string, (typeof SHAREPOINT_FEHLERLAGEN)[number]> = {
  // (a) Die Verbindung ist gar nicht eingerichtet — derselbe Code, den auch der Confluence-Weg für
  //     diesen Zustand nennt. Eine zweite Vokabel dafür gibt es bewusst nicht.
  IMPORT_UNAVAILABLE: "imp.sharepoint.fehler.nichtEingerichtet",
  // (b) Das hinterlegte Konto darf diese Datei/Bibliothek nicht sehen.
  SHAREPOINT_FORBIDDEN: "imp.sharepoint.fehler.keineBerechtigung",
  // (c) Die Quelle gibt es dort nicht mehr.
  SHAREPOINT_NOT_FOUND: "imp.sharepoint.fehler.nichtVorhanden",
  // (d) Zugang abgelaufen ODER Gegenstelle nicht erreichbar — ein Sachverhalt aus Sicht des
  //     Menschen, und der Satz sagt beides.
  SHAREPOINT_UNREACHABLE: "imp.sharepoint.fehler.verbindungWeg",
};

/** Der Satz zu einem Ausgang. Immer ein Satz — nie der rohe Code, nie ein leeres Bild. */
export function sharepointFehlertextKey(
  code: SharePointFehlerCode | null | undefined,
): (typeof SHAREPOINT_FEHLERLAGEN)[number] {
  return (code ? SHAREPOINT_FEHLER_TEXT[code] : undefined) ?? "imp.sharepoint.fehler.verbindungWeg";
}
