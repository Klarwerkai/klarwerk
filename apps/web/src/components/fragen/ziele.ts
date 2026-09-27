// ================================================================================================
// FE-003 · DIE ZIELE DER FRAGENFLÄCHE — stabile Namen statt Bildschirmkoordinaten.
// ================================================================================================
//
// Das Tutorial „Fragen“ zeigt auf Bedienelemente: das Eingabefeld, den Sendeknopf, einen
// Quellen-Chip. Diese Zuordnung darf nicht an Pixeln hängen (Ticket FE-003, „Aktualität ohne
// Screenshots“) — sie hängt an diesem Attribut, das die GEMEINSAMEN Bausteine selbst tragen. Die
// echte Seite und die Demo rendern dieselben Bausteine, also tragen beide dieselben Ziele.
//
// Fehlt ein Ziel, weil ein Baustein umgebaut wurde, fällt das auf: die Demo meldet es sichtbar
// (`data-tutorial-ziel-fehlt`), und `tests/fe003-tutorial-fragen/` fährt jedes Ziel jedes Schritts ab.
export const ZIEL_ATTRIBUT = "data-tutorial-ziel";

export const FRAGEN_ZIEL = {
  fragefeld: "fragen.fragefeld",
  beispiele: "fragen.beispiele",
  absenden: "fragen.absenden",
  warten: "fragen.warten",
  antworttext: "fragen.antworttext",
  kiHinweis: "fragen.ki-hinweis",
  quellenchip: "fragen.quellenchip",
  menue: "fragen.menue",
  quellenliste: "fragen.quellenliste",
  quellenstand: "fragen.quellenstand",
  original: "fragen.original",
  luecke: "fragen.luecke",
  kiAus: "fragen.ki-aus",
} as const;

export type FragenZiel = (typeof FRAGEN_ZIEL)[keyof typeof FRAGEN_ZIEL];
