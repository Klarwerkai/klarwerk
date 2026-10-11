// ================================================================================================
// WISSENS-VERMÄCHTNIS-BUCH — die Texte des Vermächtnisbereichs in der Kontokarte.
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensvermaechtnis`. DE/EN/NL, weil der Textmodulvertrag jede
// Sprache der Oberfläche verlangt (docs/i18n-textmodule.md). Das Buch selbst ist deutsch, wie jedes
// Dokument der Output Factory.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "vermaechtnis.",
  legacySchluessel: [],
  de: {
    "vermaechtnis.titel": "Wissens-Vermächtnis",
    "vermaechtnis.hinweis":
      "Ein Buch mit allen Beiträgen dieser Person als Autorin oder Autor — als Würdigung, etwa zum Abschied. Es ändert kein Wissen.",
    "vermaechtnis.erzeugen": "Vermächtnis-Buch erzeugen",
    "vermaechtnis.laedt": "Buch wird zusammengestellt …",
    "vermaechtnis.fehler": "Das Buch konnte nicht erzeugt werden: {{meldung}}",
    "vermaechtnis.leer":
      "Von dieser Person liegt noch kein validierter, einsehbarer und nicht vertraulicher Beitrag vor.",
    "vermaechtnis.umfang":
      "{{anzahl}} Beiträge in {{themen}} Themen, festgehalten von {{von}} bis {{bis}}.",
    "vermaechtnis.ausgelassen": "Nicht aufgenommen:",
    "vermaechtnis.nichtValidiert": "{{anzahl}} noch nicht validiert",
    "vermaechtnis.vertraulich": "{{anzahl}} vertraulich — gehören in kein weitergegebenes Dokument",
    "vermaechtnis.nichtEinsehbar": "{{anzahl}} für dich nicht einsehbar",
    "vermaechtnis.papierkorb": "{{anzahl}} im Papierkorb",
    "vermaechtnis.download": "Digital herunterladen (.md)",
    "vermaechtnis.drucken": "Drucken",
  },
  en: {
    "vermaechtnis.titel": "Knowledge legacy",
    "vermaechtnis.hinweis":
      "A book with every contribution this person authored — as a tribute, for example on leaving. It changes no knowledge.",
    "vermaechtnis.erzeugen": "Create legacy book",
    "vermaechtnis.laedt": "Compiling the book …",
    "vermaechtnis.fehler": "The book could not be created: {{meldung}}",
    "vermaechtnis.leer":
      "This person has no validated, readable and non-confidential contribution yet.",
    "vermaechtnis.umfang":
      "{{anzahl}} contributions in {{themen}} topics, recorded from {{von}} to {{bis}}.",
    "vermaechtnis.ausgelassen": "Not included:",
    "vermaechtnis.nichtValidiert": "{{anzahl}} not yet validated",
    "vermaechtnis.vertraulich": "{{anzahl}} confidential — they belong in no shared document",
    "vermaechtnis.nichtEinsehbar": "{{anzahl}} you may not read",
    "vermaechtnis.papierkorb": "{{anzahl}} in the recycle bin",
    "vermaechtnis.download": "Download digitally (.md)",
    "vermaechtnis.drucken": "Print",
  },
  nl: {
    "vermaechtnis.titel": "Kennisnalatenschap",
    "vermaechtnis.hinweis":
      "Een boek met alle bijdragen die deze persoon heeft geschreven — als eerbetoon, bijvoorbeeld bij het afscheid. Het wijzigt geen kennis.",
    "vermaechtnis.erzeugen": "Nalatenschapsboek maken",
    "vermaechtnis.laedt": "Boek wordt samengesteld …",
    "vermaechtnis.fehler": "Het boek kon niet worden gemaakt: {{meldung}}",
    "vermaechtnis.leer":
      "Van deze persoon is nog geen gevalideerde, leesbare en niet-vertrouwelijke bijdrage beschikbaar.",
    "vermaechtnis.umfang":
      "{{anzahl}} bijdragen in {{themen}} thema's, vastgelegd van {{von}} tot {{bis}}.",
    "vermaechtnis.ausgelassen": "Niet opgenomen:",
    "vermaechtnis.nichtValidiert": "{{anzahl}} nog niet gevalideerd",
    "vermaechtnis.vertraulich": "{{anzahl}} vertrouwelijk — horen in geen gedeeld document",
    "vermaechtnis.nichtEinsehbar": "{{anzahl}} die je niet mag lezen",
    "vermaechtnis.papierkorb": "{{anzahl}} in de prullenbak",
    "vermaechtnis.download": "Digitaal downloaden (.md)",
    "vermaechtnis.drucken": "Afdrukken",
  },
} satisfies Textmodul;
