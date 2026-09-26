// ================================================================================================
// UX08 · DIE TEXTE DES ERFASSUNGS- UND EXTERNWISSENS-WEGS — bei ihrer Funktion, nicht im Sammelbuch.
// ================================================================================================
//
// WAS HIER STEHT UND WARUM GERADE DAS: die drei Schlüssel, die der Vertrag UX08 als nächstes
// ÄNDERT. Sie sind aus `apps/web/src/i18n.ts` hierher umgezogen — wörtlich, Zeichen für Zeichen, in
// allen drei Sprachen. Für einen Anwender ändert dieser Umzug nichts; er ändert nur, WELCHE Datei
// eine Bahn anfasst, wenn sie an diesem Nutzerweg arbeitet (JOB 4367).
//
// ES SIND ALTNAMEN, und deshalb stehen sie in `legacySchluessel`. Sie tragen NICHT das Präfix
// `ux08.`, weil ihre Namen in `services/`, in Tests und in Playwright-Spuren stehen; sie
// umzubenennen wäre eine zweite, viel grössere Änderung und ist hier ausdrücklich nicht beauftragt.
// JEDER NEUE Schlüssel dieses Nutzerwegs heisst dagegen `ux08.<name>` — dann kann kein zweites
// Modul denselben Namen erfinden. Die Regel wird nicht nur beschrieben, sie wird geprüft:
// `apps/web/src/texte/intern/pruefung.ts`, im Tor und im Produktbuild.
//
// UX-08 · QUELLENHINWEIS-HÄLFTE: der Weg zur Stufe heisst in jeder Sprache genau so, wie ein
// Administrator ihn anklickt — Seitentitel (`einst.titel`), Reiter (`adm.sec.ki`), Zeile und
// Detailkarte (`adm.ext.title`). Das frühere „Verwaltung → Externes Wissen“ gab es als Menüweg
// nicht. Nachgemessen in `tests/ux08-quellenhinweis/`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ux08.",
  legacySchluessel: ["capture.sourceMissingNext", "ext.attachBlocked", "ext.gate.how"],
  de: {
    // AUFTRAG-mega17 Block A-2: fehlende HERKUNFT beim Namen nennen — und wie du das nachholst.
    "capture.sourceMissingNext":
      "Nächster Schritt: Wissensobjekt öffnen, das Quelldokument dort anhängen und die Quelle erneut vermerken. Erlaubt die eingestellte Stufe der externen Wissensabfrage das nicht, kann ein Administrator sie unter Einstellungen → KI → Externe Wissensabfrage ändern.",
    // AUFTRAG-mega14 Block D (SCRUM-414): der Knopf ist auf gesperrter Stufe nicht anwählbar — und
    // sagt WARUM. Ein ausgegrauter Knopf ohne Grund ist eine Sackgasse, keine Erklärung.
    "ext.attachBlocked":
      "Auf der eingestellten Stufe darf gesucht, aber nicht angehängt werden. Ein Administrator kann das unter Einstellungen → KI → Externe Wissensabfrage ändern.",
    "ext.gate.how":
      "Ein Administrator kann die Stufe unter Einstellungen → KI → Externe Wissensabfrage ändern.",
  },
  en: {
    "capture.sourceMissingNext":
      "Next step: open the knowledge object, attach the source document there and record the source again. If the configured external knowledge stage does not allow this, an administrator can change it under Settings → AI → External knowledge.",
    "ext.attachBlocked":
      "At the configured stage, searching is allowed but attaching is not. An administrator can change this under Settings → AI → External knowledge.",
    "ext.gate.how":
      "An administrator can change the stage under Settings → AI → External knowledge.",
  },
  nl: {
    "capture.sourceMissingNext":
      "Volgende stap: kennisobject openen, het brondocument daar bijvoegen en de bron opnieuw vermelden. Staat het ingestelde niveau van de externe kennisopvraag dat niet toe, dan kan een beheerder het wijzigen onder Instellingen → AI → Externe kennisopvraag.",
    "ext.attachBlocked":
      "Op het ingestelde niveau mag wel worden gezocht, maar niet worden toegevoegd. Een beheerder kan dit wijzigen onder Instellingen → AI → Externe kennisopvraag.",
    "ext.gate.how":
      "Een beheerder kan het niveau wijzigen onder Instellingen → AI → Externe kennisopvraag.",
  },
} satisfies Textmodul;
