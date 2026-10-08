// ================================================================================================
// KI-SCHREIBHILFE · DIE TEXTE DER MARKIERUNGSBEARBEITUNG — bei ihrer Funktion, nicht im Sammelbuch.
// ================================================================================================
//
// R-0300: „Auf Knopfdruck formuliert die KI den markierten Text klarer … Der Vorschlag kann
// übernommen oder eingefügt werden." Das Blatt (`components/erfassen/Blatt.tsx`) bearbeitet seither
// die markierte Stelle; diese drei Sätze sind neu und gehören nur dorthin:
//   · `schreibhilfe.auswahlBezug` — am Vorschlag: WELCHE Stelle er ersetzt.
//   · `schreibhilfe.einfuegen` — der zweite Übernahmeweg: hinter der Markierung einfügen.
//   · `schreibhilfe.auswahlVeraltet` — die Stelle hat sich seit der Anfrage geändert; nichts wurde
//     übernommen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "schreibhilfe.",
  legacySchluessel: [],
  de: {
    "schreibhilfe.auswahlBezug": "Markierte Stelle: „{{text}}“",
    "schreibhilfe.einfuegen": "Dahinter einfügen",
    "schreibhilfe.auswahlVeraltet":
      "Die markierte Stelle hat sich seit der Anfrage geändert. Bitte neu markieren und erneut anfragen.",
  },
  en: {
    "schreibhilfe.auswahlBezug": "Selected passage: “{{text}}”",
    "schreibhilfe.einfuegen": "Insert after it",
    "schreibhilfe.auswahlVeraltet":
      "The selected passage has changed since the request. Please select it again and ask again.",
  },
  nl: {
    "schreibhilfe.auswahlBezug": "Gemarkeerde passage: „{{text}}”",
    "schreibhilfe.einfuegen": "Erachter invoegen",
    "schreibhilfe.auswahlVeraltet":
      "De gemarkeerde passage is sinds de aanvraag gewijzigd. Markeer opnieuw en vraag het opnieuw.",
  },
} satisfies Textmodul;
