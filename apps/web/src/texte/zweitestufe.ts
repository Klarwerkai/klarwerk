// ================================================================================================
// R-1030 · DIE VIER BEREICHE DER ZWEITEN STUFE BEKOMMEN IHRE ASSISTENTENFLÄCHE.
// ================================================================================================
//
// Import, Wissensgraph, Kapital-Sichten und Auswertungen sind eine echte zweite Stufe: eigene
// Seite, eigene Seitenhilfe im Zahnrad (`seitenhilfe.{import,graph,kapital,output}`), erklärende
// Karte statt Sackgasse bei ausgeschalteter Stufe 2. Was fehlte, war Klaras „Du bist hier"
// (`lib/klaraRegistry.ts`, `KLARA_PAGES`): auf allen vier Seiten blieb der Assistent stumm, weil
// keine Seitenerklärung hinterlegt war. Diese vier Sätze füllen das — alle vier gleich behandelt.
//
// Die Sätze beschreiben nur, was die Seite heute tut (abgeglichen mit der Seitenhilfe derselben
// Seite in `woerterbuch/`). EN und NL meiden bewusst die Suchschlüssel und Zielstämme der
// Synonymkarte (`KLARA_SYNONYMS`), deren fremdsprachige Wirkung `tests/help/klara-registry.test.ts`
// namentlich festhält — ein neuer Eintrag soll dort keine ungezählte Wirkung erzeugen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "zweitestufe.",
  legacySchluessel: [],
  de: {
    "zweitestufe.klara.output":
      "Aus geprüftem Wissen ein Dokument erzeugen: Art wählen, Quellen ankreuzen und ordnen, dann kopieren oder als Markdown laden — darunter steht, woraus es entstanden ist.",
    "zweitestufe.klara.import":
      "Wissen aus anderen Systemen hereinholen: eine JSON-Datei oder, mit Berechtigung, Confluence. Jeder Eintrag landet als Vorschlag in der Prüfliste, mit Volltext und Quelle — du nimmst an, lehnst ab oder fragst nach.",
    "zweitestufe.klara.graph":
      "Der Bestand als Bild: jeder Punkt ist ein Wissensobjekt, graue Linien heißen gemeinsames Schlagwort, rot gestrichelte einen gemeldeten Widerspruch. Ein Klick auf einen bekannten Punkt öffnet das Objekt.",
    "zweitestufe.klara.kapital":
      "Der Bestand in Zahlen: wie viel Wissen da ist, wie viel davon geprüft und was offen ist — dazu eine Wertschätzung, deren Annahmen du selbst einträgst, und Übersichten zu Modellläufen und Belegen.",
  },
  en: {
    "zweitestufe.klara.output":
      "Produce a document from checked knowledge: pick the kind, tick and order the sources, then copy it or download it as Markdown — underneath you see what it was built from.",
    "zweitestufe.klara.import":
      "Bring knowledge in from other systems: a JSON file or, with permission, Confluence. Every entry lands in the review list as a proposal with full text and source — you accept, reject or ask back.",
    "zweitestufe.klara.graph":
      "The holdings as a picture: every dot is a knowledge object, grey lines mean a shared tag, red dashed lines a reported contradiction. Clicking a known dot opens that object.",
    "zweitestufe.klara.kapital":
      "The holdings in figures: how much knowledge there is, how much has been checked and what is still open — plus a value estimate whose assumptions you enter yourself, and overviews of model runs and evidence.",
  },
  nl: {
    "zweitestufe.klara.output":
      "Maak een document uit gecontroleerde kennis: kies de soort, vink de bronnen aan en zet ze op volgorde, kopieer het of download het als Markdown — eronder staat waaruit het is ontstaan.",
    "zweitestufe.klara.import":
      "Haal kennis uit andere systemen binnen: een JSON-bestand of, met de juiste rechten, Confluence. Elke inzending komt als voorstel in de controlelijst, met volledige tekst en bron — jij neemt aan, wijst af of vraagt door.",
    "zweitestufe.klara.graph":
      "Het bestand als beeld: elk punt is een kennisobject, grijze lijnen betekenen een gedeeld trefwoord, rode stippellijnen een gemelde tegenspraak. Een klik op een bekend punt opent dat object.",
    "zweitestufe.klara.kapital":
      "Het bestand in cijfers: hoeveel kennis er is, hoeveel daarvan gecontroleerd is en wat nog open staat — plus een waardeschatting waarvan je de aannames zelf invult, en overzichten van modelruns en bewijs.",
  },
} satisfies Textmodul;
