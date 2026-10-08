// ================================================================================================
// KONFLIKTARBEIT · R-0252 — welche Art von Arbeit vor dem Prüfenden liegt (Regel, Sache, Version).
// ================================================================================================
//
// Der Satz steht auf der Konfliktseite VOR den beiden Karten. Er beschreibt die Arbeit, nicht das
// Ergebnis: auch beim Sachkonflikt sagt er nicht, welche Seite stimmt. `abgeleitet` steht dabei,
// wenn niemand die Arbeitsart gewählt hat und sie aus der Art des Konflikts folgt
// (`lib/conflictView.ts`, `conflictWorkKind`); `gewaehlt`, wenn sie bei der Anlage gewählt wurde.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "konfliktarbeit.",
  legacySchluessel: [],
  de: {
    "konfliktarbeit.satz.regel":
      "Regelkonflikt: zwei interne Festlegungen stehen gegeneinander. Keine Quelle kann ihn entscheiden — das tut eine befugte Person.",
    "konfliktarbeit.satz.sache":
      "Sachkonflikt: durch Belege entscheidbar — welche Aussage zutrifft, zeigen Quellen und Nachweise.",
    "konfliktarbeit.satz.version":
      "Versionskonflikt: dieselbe Sache in zwei Ständen — zu klären ist, welcher Stand gilt.",
    "konfliktarbeit.abgeleitet": "Eingeordnet nach der Art „{{art}}“.",
    "konfliktarbeit.gewaehlt": "Bei der Anlage so eingeordnet.",
    "konfliktarbeit.knopf.standLinks": "Linker Stand gilt",
    "konfliktarbeit.knopf.standRechts": "Rechter Stand gilt",
    "konfliktarbeit.feld": "Art der Arbeit",
    "konfliktarbeit.feld.automatisch": "Aus der Art ableiten",
    "konfliktarbeit.name.regel": "Regelkonflikt — nur eine befugte Person entscheidet",
    "konfliktarbeit.name.sache": "Sachkonflikt — durch Belege entscheidbar",
    "konfliktarbeit.name.version": "Versionskonflikt — dieselbe Sache, zwei Stände",
  },
  en: {
    "konfliktarbeit.satz.regel":
      "Rule conflict: two internal decisions stand against each other. No source can settle it — an authorised person does.",
    "konfliktarbeit.satz.sache":
      "Factual conflict: can be settled by evidence — sources and proof show which statement is correct.",
    "konfliktarbeit.satz.version":
      "Version conflict: the same thing in two states — the question is which state applies.",
    "konfliktarbeit.abgeleitet": "Classified from the type “{{art}}”.",
    "konfliktarbeit.gewaehlt": "Classified this way when it was reported.",
    "konfliktarbeit.knopf.standLinks": "Left state applies",
    "konfliktarbeit.knopf.standRechts": "Right state applies",
    "konfliktarbeit.feld": "Kind of work",
    "konfliktarbeit.feld.automatisch": "Derive from the type",
    "konfliktarbeit.name.regel": "Rule conflict — only an authorised person decides",
    "konfliktarbeit.name.sache": "Factual conflict — can be settled by evidence",
    "konfliktarbeit.name.version": "Version conflict — the same thing, two states",
  },
  nl: {
    "konfliktarbeit.satz.regel":
      "Regelconflict: twee interne vastleggingen staan tegenover elkaar. Geen bron kan het beslissen — dat doet een bevoegde persoon.",
    "konfliktarbeit.satz.sache":
      "Inhoudelijk conflict: met bewijs te beslissen — bronnen en bewijsstukken tonen welke uitspraak klopt.",
    "konfliktarbeit.satz.version":
      "Versieconflict: dezelfde zaak in twee stadia — te verduidelijken is welk stadium geldt.",
    "konfliktarbeit.abgeleitet": "Ingedeeld volgens het type ‘{{art}}’.",
    "konfliktarbeit.gewaehlt": "Bij het melden zo ingedeeld.",
    "konfliktarbeit.knopf.standLinks": "Linker stadium geldt",
    "konfliktarbeit.knopf.standRechts": "Rechter stadium geldt",
    "konfliktarbeit.feld": "Soort werk",
    "konfliktarbeit.feld.automatisch": "Afleiden uit het type",
    "konfliktarbeit.name.regel": "Regelconflict — alleen een bevoegde persoon beslist",
    "konfliktarbeit.name.sache": "Inhoudelijk conflict — met bewijs te beslissen",
    "konfliktarbeit.name.version": "Versieconflict — dezelfde zaak, twee stadia",
  },
} satisfies Textmodul;
