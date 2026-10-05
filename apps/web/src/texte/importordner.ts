// ================================================================================================
// R-0991 (K3) · DER ORDNER, DESSEN SEITE NICHT MITKOMMT.
// ================================================================================================
//
// Der Ordnerbaum der Importvorschau (`components/ImportPreviewTree.tsx`) zeigt jeden Elterntitel
// aus `sourcePath` als Ordner. Liegt die Elternseite selbst nicht in der Vorschau, sieht der Ordner
// trotzdem aus wie eine mitimportierte Seite (JOB 931 `B2`, JOB 1132). Diese Marke sagt es am
// Ordner, ermittelt von `lib/importSelectView.ts::ordnerOhneEigeneZeile`. Sie entscheidet nichts
// und ändert nichts an Auswahl oder Import.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "importordner.",
  legacySchluessel: [],
  de: {
    "importordner.ohneSeite": "Seite nicht in diesem Import",
    "importordner.ohneSeiteHinweis":
      "Dieser Ordner trägt den Titel einer Elternseite, die in dieser Vorschau nicht vorkommt. Die Seiten darin werden ohne sie übernommen.",
  },
  en: {
    "importordner.ohneSeite": "Page not in this import",
    "importordner.ohneSeiteHinweis":
      "This folder carries the title of a parent page that is not part of this preview. The pages in it are imported without it.",
  },
  nl: {
    "importordner.ohneSeite": "Pagina niet in deze import",
    "importordner.ohneSeiteHinweis":
      "Deze map draagt de titel van een bovenliggende pagina die niet in dit voorbeeld staat. De pagina's erin worden zonder die pagina overgenomen.",
  },
} satisfies Textmodul;
