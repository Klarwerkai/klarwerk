// ================================================================================================
// R-0658 · DIE WARNUNG BEI ERKANNTEN SCHUTZDATEN (Personalnummer, Kontodaten).
// ================================================================================================
//
// · `schutzdaten.warnung` — der Satz unter der Erfolgszeile des Blatts, wenn der Server beim
//   Einreichen Schutzdaten erkannt und den Eintrag in Quarantäne gestellt hat
//   (`components/erfassen/Blatt.tsx`, `BlattLage`; Erkennung in
//   `services/knowledge-object/src/schutzdaten.ts`). `{{arten}}` ist die Aufzählung der ARTEN —
//   der Wert selbst steht nie in der Warnung.
// · `schutzdaten.art.*` — die Benennung je Art; `schutzdaten.und` verbindet zwei Arten.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "schutzdaten.",
  legacySchluessel: [],
  de: {
    "schutzdaten.warnung":
      "Achtung: Im Text wurde {{arten}} erkannt. Der Eintrag ist gespeichert, liegt aber in Quarantäne und erscheint nicht in Suche und Bibliothek, bis diese Daten entfernt sind.",
    "schutzdaten.art.personalnummer": "eine Personalnummer",
    "schutzdaten.art.kontodaten": "eine Kontoangabe (IBAN)",
    "schutzdaten.und": " und ",
  },
  en: {
    "schutzdaten.warnung":
      "Attention: {{arten}} was detected in the text. The entry is saved but held in quarantine and does not appear in search or the library until this data is removed.",
    "schutzdaten.art.personalnummer": "a personnel number",
    "schutzdaten.art.kontodaten": "bank account details (IBAN)",
    "schutzdaten.und": " and ",
  },
  nl: {
    "schutzdaten.warnung":
      "Let op: in de tekst is {{arten}} herkend. De invoer is opgeslagen, maar staat in quarantaine en verschijnt niet in zoeken en bibliotheek tot deze gegevens verwijderd zijn.",
    "schutzdaten.art.personalnummer": "een personeelsnummer",
    "schutzdaten.art.kontodaten": "een rekeninggegeven (IBAN)",
    "schutzdaten.und": " en ",
  },
} satisfies Textmodul;
