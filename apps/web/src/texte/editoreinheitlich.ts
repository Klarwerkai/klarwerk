// ================================================================================================
// EDITOR-EINHEITLICH (produkt:20261007:editor-einheitlich) · die Texte des Bearbeitungsformulars.
// ================================================================================================
//
// Das Formular in der Bibliothek sagt jetzt vier Dinge, die beim Erstellen schon gelten: welche
// Angaben Pflicht sind, dass eine aus dem Inhalt gebildete Aussage dem Inhalt folgt (kein zweites
// Pflegen), was Speichern bzw. Einreichen bewirkt, und wo die alte Fassung bleibt.
//
// DIE WÖRTER SIND DIE DES ERSTELLENS: der Titel heisst „Titel" (`capture.wizard.titleLabel`,
// `fd.fieldTitle`), nicht „Kernaussage"; die Pflichtangaben heissen wie im Speicher-Check
// (`capture.ready.title`, `capture.ready.content`). `editoreinheitlich.nurFelder` ist deshalb die
// Fassung von `ko.propose.onlyFields` mit „Titel" — der Altschlüssel bleibt unverändert stehen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "editoreinheitlich.",
  legacySchluessel: [],
  de: {
    "editoreinheitlich.pflichtDirekt":
      "Pflichtangaben: Titel und Aussage / Inhalt. Alles Weitere ist optional.",
    "editoreinheitlich.pflichtPruefweg": "Pflichtangabe: Aussage. Alles Weitere ist optional.",
    "editoreinheitlich.fehltTitel":
      "Titel fehlt — ohne Titel lässt sich nicht speichern. Deine übrigen Eingaben bleiben erhalten.",
    "editoreinheitlich.fehltInhalt":
      "Aussage / Inhalt fehlt — ohne sie lässt sich nicht speichern. Deine übrigen Eingaben bleiben erhalten.",
    "editoreinheitlich.fehltAussage":
      "Aussage fehlt — ohne sie lässt sich nicht einreichen. Deine übrigen Eingaben bleiben erhalten.",
    "editoreinheitlich.aussageFolgt":
      "Diese Aussage wurde wie beim Erstellen aus dem Anfang des Inhalts gebildet und folgt deinen Änderungen am Inhalt — du pflegst den Text nur einmal. Schreibst du hier selbst, gilt deine eigene Aussage.",
    "editoreinheitlich.aussageEigen":
      "Eigene Aussage: Sie unterscheidet sich vom Inhalt und bleibt, wie sie ist — Änderungen am Inhalt ändern sie nicht.",
    "editoreinheitlich.nurFelder":
      "Eingereicht werden Aussage und ausführlicher Inhalt. Titel, Wissensart, Domäne/Kategorie, Bedingungen, Maßnahmen und Tags lassen sich auf diesem Weg nicht ändern — sie bleiben, wie sie sind.",
    "editoreinheitlich.wirkungSpeichern":
      "Speichern legt Version {{neu}} an. Version {{alt}} bleibt im Verlauf nachlesbar. Danach ist der Eintrag wieder offen und braucht eine neue Prüfung.",
    "editoreinheitlich.wirkungSpeichernOhneZahl":
      "Speichern legt eine neue Version an. Die bisherige bleibt im Verlauf nachlesbar. Danach ist der Eintrag wieder offen und braucht eine neue Prüfung.",
    "editoreinheitlich.wirkungEinreichen":
      "Einreichen ändert den geltenden Eintrag noch nicht: Deine Änderung wird als Vorschlag gespeichert. Erst wenn jemand anders ihn übernimmt, entsteht eine neue Version — die bisherige bleibt im Verlauf nachlesbar.",
  },
  en: {
    "editoreinheitlich.pflichtDirekt":
      "Required: title and statement / content. Everything else is optional.",
    "editoreinheitlich.pflichtPruefweg": "Required: statement. Everything else is optional.",
    "editoreinheitlich.fehltTitel":
      "Title missing — without a title it cannot be saved. Your other input stays as it is.",
    "editoreinheitlich.fehltInhalt":
      "Statement / content missing — without it, it cannot be saved. Your other input stays as it is.",
    "editoreinheitlich.fehltAussage":
      "Statement missing — without it, it cannot be submitted. Your other input stays as it is.",
    "editoreinheitlich.aussageFolgt":
      "This statement was formed from the beginning of the content, just like when creating, and follows your changes to the content — you maintain the text only once. If you write here yourself, your own statement applies.",
    "editoreinheitlich.aussageEigen":
      "Own statement: it differs from the content and stays as it is — changes to the content do not change it.",
    "editoreinheitlich.nurFelder":
      "Statement and detailed content are submitted. Title, knowledge type, domain/category, conditions, measures and tags cannot be changed on this path — they stay as they are.",
    "editoreinheitlich.wirkungSpeichern":
      "Saving creates version {{neu}}. Version {{alt}} remains readable in the history. Afterwards the entry is open again and needs a new review.",
    "editoreinheitlich.wirkungSpeichernOhneZahl":
      "Saving creates a new version. The previous one remains readable in the history. Afterwards the entry is open again and needs a new review.",
    "editoreinheitlich.wirkungEinreichen":
      "Submitting does not change the current entry yet: your change is stored as a proposal. Only when someone else accepts it is a new version created — the previous one remains readable in the history.",
  },
  nl: {
    "editoreinheitlich.pflichtDirekt":
      "Verplicht: titel en uitspraak / inhoud. Al het andere is optioneel.",
    "editoreinheitlich.pflichtPruefweg": "Verplicht: uitspraak. Al het andere is optioneel.",
    "editoreinheitlich.fehltTitel":
      "Titel ontbreekt — zonder titel kan niet worden opgeslagen. Je overige invoer blijft bewaard.",
    "editoreinheitlich.fehltInhalt":
      "Uitspraak / inhoud ontbreekt — zonder kan niet worden opgeslagen. Je overige invoer blijft bewaard.",
    "editoreinheitlich.fehltAussage":
      "Uitspraak ontbreekt — zonder kan niet worden ingediend. Je overige invoer blijft bewaard.",
    "editoreinheitlich.aussageFolgt":
      "Deze uitspraak is net als bij het aanmaken gevormd uit het begin van de inhoud en volgt je wijzigingen aan de inhoud — je onderhoudt de tekst maar één keer. Schrijf je hier zelf, dan geldt je eigen uitspraak.",
    "editoreinheitlich.aussageEigen":
      "Eigen uitspraak: ze verschilt van de inhoud en blijft zoals ze is — wijzigingen aan de inhoud veranderen haar niet.",
    "editoreinheitlich.nurFelder":
      "Ingediend worden uitspraak en uitgebreide inhoud. Titel, kennissoort, domein/categorie, voorwaarden, maatregelen en trefwoorden zijn op deze weg niet te wijzigen — ze blijven zoals ze zijn.",
    "editoreinheitlich.wirkungSpeichern":
      "Opslaan maakt versie {{neu}} aan. Versie {{alt}} blijft in de geschiedenis leesbaar. Daarna staat het item weer open en heeft het een nieuwe controle nodig.",
    "editoreinheitlich.wirkungSpeichernOhneZahl":
      "Opslaan maakt een nieuwe versie aan. De vorige blijft in de geschiedenis leesbaar. Daarna staat het item weer open en heeft het een nieuwe controle nodig.",
    "editoreinheitlich.wirkungEinreichen":
      "Indienen verandert het geldende item nog niet: je wijziging wordt als voorstel opgeslagen. Pas als iemand anders het overneemt, ontstaat een nieuwe versie — de vorige blijft in de geschiedenis leesbaar.",
  },
} satisfies Textmodul;
