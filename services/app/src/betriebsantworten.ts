// Feste öffentliche Betriebsantworten: keine Fehlerursache, Kennung oder Nutzlast als Textquelle.
export const KI_ABGESCHALTET_MELDUNG: Readonly<Record<"de" | "en" | "nl", string>> = {
  de: "Der Administrator hat die KI abgeschaltet. Fragen an Klara werden derzeit nicht beantwortet, und es werden dafür keine Inhalte gelesen. Die Bibliothek und die Originale bleiben nach Ihren Leserechten nutzbar.",
  en: "The administrator has switched AI off. Questions to Klara are currently not answered, and no content is read for them. The library and the originals remain available according to your read permissions.",
  nl: "De beheerder heeft AI uitgeschakeld. Vragen aan Klara worden momenteel niet beantwoord, en er wordt daarvoor geen inhoud gelezen. De bibliotheek en de originelen blijven beschikbaar volgens uw leesrechten.",
};

export const JOURNAL_UNGEWISS_MELDUNG =
  "Der Ausgang ist ungewiss: der Speicher ist gerade weder lesbar noch beschreibbar. Bitte später neu laden, bevor Sie es erneut versuchen.";
export const FIRMENRESET_MELDUNG =
  "Der Firmenreset läuft — dieser Schreibvorgang wurde nicht gespeichert. Bitte nach dem Neustart erneut versuchen.";

export function sichereBetriebsantwort(
  code: string,
  sprache: "de" | "en" | "nl",
): { error: string; message: string } | undefined {
  switch (code) {
    case "KI_ABGESCHALTET":
      return { error: code, message: KI_ABGESCHALTET_MELDUNG[sprache] };
    case "JOURNAL_AUSGANG_UNGEWISS":
      return { error: code, message: JOURNAL_UNGEWISS_MELDUNG };
    case "FIRMENRESET_LAEUFT":
      return { error: code, message: FIRMENRESET_MELDUNG };
    default:
      return undefined;
  }
}
