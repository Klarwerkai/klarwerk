// ================================================================================================
// R-0461 / R-1943 (OFFEN.md S5b) — DIE DEKLARIERTE LISTE ECHTER FACHKOMPOSITA.
// ================================================================================================
//
// WOZU. „Unterdruck" und „Widerstand" sind gleich gebaut und bedeuten Verschiedenes: ein Unterdruck
// IST ein Druck, ein Widerstand ist KEIN Stand. Keine Zeichenregel kann beides trennen (mega59/60,
// R-0482 — die formale Zerlegung wird nicht wieder aufgenommen). Deshalb steht hier, ausdrücklich
// und einzeln, welches Kompositum ein Unterfall seines Grundworts ist.
//
// WAS EIN EINTRAG BEWIRKT, und nur das: Fragt jemand nach dem GRUNDWORT („Welche Farbe …?") und
// steht in der Quelle das KOMPOSITUM („Pflichtfarbe Blau"), dann zählt dieser Kompositumtreffer
// nicht mehr nur als suchbar, sondern auch als TRAGEND (Substanz). Ohne Eintrag bleibt jeder
// Kompositumtreffer, was er seit mega60 A ist: suchbar, aber nicht tragend.
//
// DIE GRENZEN, alle fail-closed und in `tests/suche-zuordnung/fachkomposita-liste.test.ts` gemessen:
//   · NUR IN DEKLARIERTER RICHTUNG: Frage-Grundwort → Quell-Kompositum. Eine Quelle, die nur „Farbe"
//     sagt, beantwortet keine Frage nach der „Pflichtfarbe".
//   · NUR ECHTE KOMPOSITA: das Grundwort muss an einer belegbaren Kompositumgrenze im Kompositum
//     stehen (dieselbe Prüfung wie der Suchtreffer). Ein Eintrag, der das nicht erfüllt, wirkt nicht.
//   · NICHTS WIRD ABGELEITET: nicht gelistete Paare (Widerstand/Stand, Arbeitsschutz/Schutz) bleiben
//     nicht tragend.
//
// PFLEGE OHNE PROGRAMMIERARBEIT: eine Zeile je Paar, in normaler Schreibweise, mit Fundstelle.
// Beugung und Großschreibung rechnet der Reasoner selbst um. Ohne Fundstelle kein Eintrag.

/** Ein deklariertes Fachkompositum: `kompositum` ist ein Unterfall von `grundwort`. */
export interface Fachkompositum {
  readonly kompositum: string;
  readonly grundwort: string;
  /** Wo dieses Paar belegt ist. */
  readonly quelle: string;
}

export const FACHKOMPOSITA: readonly Fachkompositum[] = [
  {
    kompositum: "Pflichtfarbe",
    grundwort: "Farbe",
    quelle: "OFFEN.md S5b / R-0461 — „Firmenwagen“ zur Frage nach der „Farbe“ (koCarBlau)",
  },
  {
    kompositum: "Unterdruck",
    grundwort: "Druck",
    quelle: "OFFEN.md S5b / R-0461 — „ein Unterdruck ist ein Druck“",
  },
];
