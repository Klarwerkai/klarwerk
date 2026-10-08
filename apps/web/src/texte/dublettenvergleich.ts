// ================================================================================================
// AUFNAHME 20260922 · GESAMT-DUBLETTENVERGLEICH — die Texte des Zusammenführen-Assistenten, der
// Belegzeile auf der Duplikatfläche und des Hinweises am aufgegangenen Artikel.
// ================================================================================================
//
// R-1107: der vierschrittige Assistent (Führungsartikel, Eigenanteile, Quellen, Vorschau/Freigabe).
// R-0201: je Feld sichtbar, was übereinstimmt, was abweicht und was nur eine Seite trägt — „abweichend"
//         und nicht „widersprüchlich": ob zwei Texte einander fachlich widersprechen, sagt ein
//         Textvergleich nicht.
// R-0565: Zusammenführen ist kuratorisch; ein Autor einer der beiden Seiten führt nicht zusammen.
// R-0261: Quelle, Quelldatum und Konfidenz je Seite ohne Aufklappen; ein Satz zur Beweislage nur,
//         wenn beide Seiten freigegeben sind und es etwas zu sagen gibt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "dublettenvergleich.",
  legacySchluessel: [],
  de: {
    "dublettenvergleich.seitenhilfe.titel": "Zusammenführen",
    "dublettenvergleich.seitenhilfe.text":
      "Hier werden zwei doppelte Artikel bewusst zu einem: erst den Führungsartikel wählen, dann Feld für Feld entscheiden, welche Inhalte bleiben, dann die Quellen des anderen Artikels mitnehmen, zuletzt die Vorschau prüfen und freigeben. Es entsteht eine neue, ungeprüfte Fassung des Führungsartikels; der andere Artikel wird nicht gelöscht und verweist danach auf ihn. Bis zur Freigabe wird nichts gespeichert.",
    "dublettenvergleich.titel": "Zwei Artikel zusammenführen",
    "dublettenvergleich.schritt.fuehrung": "Führungsartikel wählen",
    "dublettenvergleich.schritt.inhalte": "Eigenanteile übernehmen",
    "dublettenvergleich.schritt.quellen": "Quellen mitnehmen",
    "dublettenvergleich.schritt.vorschau": "Vorschau und Freigabe",
    "dublettenvergleich.schritt.nummer": "Schritt {{nummer}} von 4",
    "dublettenvergleich.laedt": "Das Paar wird geladen …",
    "dublettenvergleich.ladefehler": "Das Paar konnte nicht geladen werden.",
    "dublettenvergleich.nichtGefunden":
      "Diese Dublette ist nicht (mehr) offen oder für dich nicht sichtbar.",
    "dublettenvergleich.zurueckZurListe": "Zurück zu den Dubletten",
    "dublettenvergleich.sperre.keinRecht":
      "Zusammenführen ist eine kuratorische Handlung. Sie steht Prüferinnen und Prüfern sowie Admins offen.",
    "dublettenvergleich.sperre.eigeneSeite":
      "Du bist Autor einer Seite dieses Paares. Zusammenführen entscheidet immer auch über die Gegenseite — das übernimmt deshalb eine andere kuratorische Person.",
    "dublettenvergleich.sperre.geschlossen": "Diese Dublette ist bereits abgeschlossen.",
    "dublettenvergleich.sperre.aufgegangen":
      "Eine Seite dieses Paares ist bereits in einem anderen Artikel aufgegangen.",
    "dublettenvergleich.sperre.redigiert":
      "Mindestens eine Seite ist für dich redigiert. Zusammenführen verlangt Einsicht in den Inhalt beider Seiten.",
    "dublettenvergleich.fuehrung.frage":
      "Welcher Artikel bleibt bestehen und nimmt den Inhalt auf?",
    "dublettenvergleich.fuehrung.vorgeschlagen": "Vorschlag",
    "dublettenvergleich.vorschlag.geprueft":
      "Vorgeschlagen ist der bereits geprüfte Artikel — der andere ist noch ungeprüft.",
    "dublettenvergleich.vorschlag.umfassender":
      "Vorgeschlagen ist der umfassendere Artikel: laut Erkennung enthält er den anderen.",
    "dublettenvergleich.vorschlag.aelter":
      "Vorgeschlagen ist der ältere Artikel, weil keiner geprüft ist und keiner den anderen enthält.",
    "dublettenvergleich.weiter": "Weiter",
    "dublettenvergleich.zurueck": "Zurück",
    "dublettenvergleich.abbrechen": "Abbrechen — nichts speichern",
    "dublettenvergleich.seite.fuehrend": "Führungsartikel",
    "dublettenvergleich.seite.aufgehend": "Aufgehender Artikel",
    "dublettenvergleich.feld.titel": "Titel",
    "dublettenvergleich.feld.kernaussage": "Kernaussage mit Fließtext",
    "dublettenvergleich.feld.bedingungen": "Bedingungen",
    "dublettenvergleich.feld.massnahmen": "Maßnahmen",
    "dublettenvergleich.feld.fliesstext": "Fließtext",
    "dublettenvergleich.fliesstext.kopplung":
      "Der Fließtext reist mit der Kernaussage: wer die Kernaussage einer Seite wählt, übernimmt auch deren Fließtext. Fließtext: {{lage}}.",
    "dublettenvergleich.fliesstext.ersetzt":
      "Bisheriger Fließtext von „{{titel}}“ — er wird ersetzt und bleibt in der Vorfassung lesbar.",
    "dublettenvergleich.veraltet":
      "Eine Seite wurde inzwischen geändert. Die Vorschau zeigt den Stand, mit dem du begonnen hast; freigeben geht erst, wenn du den neuen Stand übernimmst und erneut prüfst.",
    "dublettenvergleich.veraltetUebernehmen": "Neuen Stand übernehmen und neu prüfen",
    "dublettenvergleich.lage.gleich": "stimmt überein",
    "dublettenvergleich.lage.abweichend": "weicht ab",
    "dublettenvergleich.lage.nur_eine_seite": "unsicher — nur eine Seite",
    "dublettenvergleich.lage.beide_leer": "beide leer",
    "dublettenvergleich.herkunft.beide": "in beiden",
    "dublettenvergleich.herkunft.fuehrend": "nur Führungsartikel",
    "dublettenvergleich.herkunft.aufgehend": "nur aufgehender Artikel",
    "dublettenvergleich.leer": "(leer)",
    "dublettenvergleich.keinePositionen": "Keine Einträge auf beiden Seiten.",
    "dublettenvergleich.eigenanteil":
      "Was laut Erkennung nur im aufgehenden Artikel steht: {{text}}",
    "dublettenvergleich.quellen.bleiben": "Bleiben — Quellen des Führungsartikels",
    "dublettenvergleich.quellen.mitnehmen": "Mitnehmen — Quellen des aufgehenden Artikels",
    "dublettenvergleich.quellen.keine": "Keine.",
    "dublettenvergleich.vorschau.fassung":
      "Es entsteht Fassung {{version}} von „{{titel}}“. Sie ist ungeprüft und geht wie jede Überarbeitung in die normale Prüfung.",
    "dublettenvergleich.vorschau.verbleib":
      "„{{titel}}“ wird nicht gelöscht: der Artikel bleibt mit Quellen, Anhängen, Kommentaren und Historie dauerhaft lesbar und verweist auf den Führungsartikel.",
    "dublettenvergleich.vorschau.nichtUebernommen":
      "Nicht übernommen — bleibt im aufgehenden Artikel bzw. in der Vorfassung lesbar",
    "dublettenvergleich.vermerk": "Vermerk zum Zusammenführen (freiwillig)",
    "dublettenvergleich.bestaetigung":
      "Ich habe die Vorschau geprüft und gebe das Zusammenführen frei.",
    "dublettenvergleich.freigeben": "Zusammenführen freigeben",
    "dublettenvergleich.laeuft": "Wird zusammengeführt …",
    "dublettenvergleich.erledigt":
      "Zusammengeführt. „{{fuehrend}}“ hat jetzt Fassung {{version}} und wartet auf die Prüfung; „{{aufgehend}}“ bleibt lesbar und verweist darauf.",
    "dublettenvergleich.zumFuehrungsartikel": "Zum Führungsartikel",
    "dublettenvergleich.zumAufgegangenen": "Zum aufgegangenen Artikel",
    "dublettenvergleich.menue": "Zusammenführen …",
    "dublettenvergleich.beleg": "Quelle · Datum · Konfidenz",
    "dublettenvergleich.beweislage.keine":
      "Keine der beiden Seiten ist mit einer Quelle belegt. Beim Zusammenführen geht deshalb kein Beleg mit — sinnvoll ist, zuerst eine Quelle nachzutragen.",
    "dublettenvergleich.beweislage.einseitig":
      "Nur „{{titel}}“ ist mit einer Quelle belegt. Das ist ein Unterschied in der Beweislage, kein Urteil darüber, welche Seite fachlich stimmt; beim Zusammenführen lässt sich die Quelle mitnehmen.",
    "dublettenvergleich.aufgegangen.hinweis":
      "Dieser Artikel ist am {{datum}} in „{{titel}}“ aufgegangen. Er bleibt lesbar; gepflegt wird der verbleibende Artikel.",
    "dublettenvergleich.aufgegangen.ohneTitel":
      "Dieser Artikel ist am {{datum}} in einem anderen Artikel aufgegangen. Er bleibt lesbar; gepflegt wird der verbleibende Artikel.",
    "dublettenvergleich.aufgegangen.link": "Zum verbleibenden Artikel",
  },
  en: {
    "dublettenvergleich.seitenhilfe.titel": "Merge",
    "dublettenvergleich.seitenhilfe.text":
      "Here two duplicate articles deliberately become one: first choose the leading article, then decide field by field which content stays, then take along the other article's sources, and finally review the preview and approve. A new, unreviewed version of the leading article is created; the other article is not deleted and afterwards points to it. Nothing is saved until you approve.",
    "dublettenvergleich.titel": "Merge two articles",
    "dublettenvergleich.schritt.fuehrung": "Choose leading article",
    "dublettenvergleich.schritt.inhalte": "Take over unique content",
    "dublettenvergleich.schritt.quellen": "Take along sources",
    "dublettenvergleich.schritt.vorschau": "Preview and approval",
    "dublettenvergleich.schritt.nummer": "Step {{nummer}} of 4",
    "dublettenvergleich.laedt": "Loading the pair …",
    "dublettenvergleich.ladefehler": "The pair could not be loaded.",
    "dublettenvergleich.nichtGefunden":
      "This duplicate is no longer open or is not visible to you.",
    "dublettenvergleich.zurueckZurListe": "Back to duplicates",
    "dublettenvergleich.sperre.keinRecht":
      "Merging is a curatorial action. It is open to reviewers and admins.",
    "dublettenvergleich.sperre.eigeneSeite":
      "You are the author of one side of this pair. Merging always decides about the other side as well — so another curator takes care of it.",
    "dublettenvergleich.sperre.geschlossen": "This duplicate has already been closed.",
    "dublettenvergleich.sperre.aufgegangen":
      "One side of this pair has already been merged into another article.",
    "dublettenvergleich.sperre.redigiert":
      "At least one side is redacted for you. Merging requires access to the content of both sides.",
    "dublettenvergleich.fuehrung.frage": "Which article remains and takes in the content?",
    "dublettenvergleich.fuehrung.vorgeschlagen": "Suggestion",
    "dublettenvergleich.vorschlag.geprueft":
      "The suggestion is the article that is already reviewed — the other one is still unreviewed.",
    "dublettenvergleich.vorschlag.umfassender":
      "The suggestion is the more comprehensive article: according to detection it contains the other one.",
    "dublettenvergleich.vorschlag.aelter":
      "The suggestion is the older article, because neither is reviewed and neither contains the other.",
    "dublettenvergleich.weiter": "Next",
    "dublettenvergleich.zurueck": "Back",
    "dublettenvergleich.abbrechen": "Cancel — save nothing",
    "dublettenvergleich.seite.fuehrend": "Leading article",
    "dublettenvergleich.seite.aufgehend": "Article being merged",
    "dublettenvergleich.feld.titel": "Title",
    "dublettenvergleich.feld.kernaussage": "Core statement with body text",
    "dublettenvergleich.feld.bedingungen": "Conditions",
    "dublettenvergleich.feld.massnahmen": "Measures",
    "dublettenvergleich.feld.fliesstext": "Body text",
    "dublettenvergleich.fliesstext.kopplung":
      "The body text travels with the core statement: choosing one side's core statement also takes over its body text. Body text: {{lage}}.",
    "dublettenvergleich.fliesstext.ersetzt":
      "Previous body text of “{{titel}}” — it is replaced and stays readable in the previous version.",
    "dublettenvergleich.veraltet":
      "One side has changed in the meantime. The preview shows the state you started with; approval is only possible once you take over the new state and review again.",
    "dublettenvergleich.veraltetUebernehmen": "Take over new state and review again",
    "dublettenvergleich.lage.gleich": "matches",
    "dublettenvergleich.lage.abweichend": "differs",
    "dublettenvergleich.lage.nur_eine_seite": "uncertain — one side only",
    "dublettenvergleich.lage.beide_leer": "both empty",
    "dublettenvergleich.herkunft.beide": "in both",
    "dublettenvergleich.herkunft.fuehrend": "leading article only",
    "dublettenvergleich.herkunft.aufgehend": "merged article only",
    "dublettenvergleich.leer": "(empty)",
    "dublettenvergleich.keinePositionen": "No entries on either side.",
    "dublettenvergleich.eigenanteil":
      "What, according to detection, only the merged article says: {{text}}",
    "dublettenvergleich.quellen.bleiben": "Remain — sources of the leading article",
    "dublettenvergleich.quellen.mitnehmen": "Take along — sources of the merged article",
    "dublettenvergleich.quellen.keine": "None.",
    "dublettenvergleich.vorschau.fassung":
      "Version {{version}} of “{{titel}}” will be created. It is unreviewed and goes through the normal review like any revision.",
    "dublettenvergleich.vorschau.verbleib":
      "“{{titel}}” is not deleted: the article remains readable for good, with its sources, attachments, comments and history, and points to the leading article.",
    "dublettenvergleich.vorschau.nichtUebernommen":
      "Not taken over — stays readable in the merged article or the previous version",
    "dublettenvergleich.vermerk": "Note on the merge (optional)",
    "dublettenvergleich.bestaetigung": "I have reviewed the preview and approve the merge.",
    "dublettenvergleich.freigeben": "Approve merge",
    "dublettenvergleich.laeuft": "Merging …",
    "dublettenvergleich.erledigt":
      "Merged. “{{fuehrend}}” now has version {{version}} and awaits review; “{{aufgehend}}” stays readable and points to it.",
    "dublettenvergleich.zumFuehrungsartikel": "Open leading article",
    "dublettenvergleich.zumAufgegangenen": "Open merged article",
    "dublettenvergleich.menue": "Merge …",
    "dublettenvergleich.beleg": "Source · date · confidence",
    "dublettenvergleich.beweislage.keine":
      "Neither side is backed by a source. Merging therefore carries no evidence — it makes sense to add a source first.",
    "dublettenvergleich.beweislage.einseitig":
      "Only “{{titel}}” is backed by a source. That is a difference in evidence, not a verdict on which side is correct; the source can be taken along when merging.",
    "dublettenvergleich.aufgegangen.hinweis":
      "This article was merged into “{{titel}}” on {{datum}}. It remains readable; the remaining article is the one being maintained.",
    "dublettenvergleich.aufgegangen.ohneTitel":
      "This article was merged into another article on {{datum}}. It remains readable; the remaining article is the one being maintained.",
    "dublettenvergleich.aufgegangen.link": "Open remaining article",
  },
  nl: {
    "dublettenvergleich.seitenhilfe.titel": "Samenvoegen",
    "dublettenvergleich.seitenhilfe.text":
      "Hier worden twee dubbele artikelen bewust één: kies eerst het leidende artikel, beslis dan veld voor veld welke inhoud blijft, neem daarna de bronnen van het andere artikel mee en controleer tot slot het voorbeeld en geef vrij. Er ontstaat een nieuwe, ongecontroleerde versie van het leidende artikel; het andere artikel wordt niet verwijderd en verwijst er daarna naar. Tot de vrijgave wordt niets opgeslagen.",
    "dublettenvergleich.titel": "Twee artikelen samenvoegen",
    "dublettenvergleich.schritt.fuehrung": "Leidend artikel kiezen",
    "dublettenvergleich.schritt.inhalte": "Eigen inhoud overnemen",
    "dublettenvergleich.schritt.quellen": "Bronnen meenemen",
    "dublettenvergleich.schritt.vorschau": "Voorbeeld en vrijgave",
    "dublettenvergleich.schritt.nummer": "Stap {{nummer}} van 4",
    "dublettenvergleich.laedt": "Het paar wordt geladen …",
    "dublettenvergleich.ladefehler": "Het paar kon niet worden geladen.",
    "dublettenvergleich.nichtGefunden":
      "Deze dubbeling is niet (meer) open of voor jou niet zichtbaar.",
    "dublettenvergleich.zurueckZurListe": "Terug naar de dubbelingen",
    "dublettenvergleich.sperre.keinRecht":
      "Samenvoegen is een curatoriële handeling. Die staat open voor controleurs en beheerders.",
    "dublettenvergleich.sperre.eigeneSeite":
      "Je bent auteur van één kant van dit paar. Samenvoegen beslist altijd ook over de andere kant — daarom doet een andere curator dat.",
    "dublettenvergleich.sperre.geschlossen": "Deze dubbeling is al afgesloten.",
    "dublettenvergleich.sperre.aufgegangen":
      "Eén kant van dit paar is al in een ander artikel opgegaan.",
    "dublettenvergleich.sperre.redigiert":
      "Minstens één kant is voor jou afgeschermd. Samenvoegen vereist inzage in de inhoud van beide kanten.",
    "dublettenvergleich.fuehrung.frage": "Welk artikel blijft bestaan en neemt de inhoud op?",
    "dublettenvergleich.fuehrung.vorgeschlagen": "Voorstel",
    "dublettenvergleich.vorschlag.geprueft":
      "Voorgesteld is het artikel dat al gecontroleerd is — het andere is nog ongecontroleerd.",
    "dublettenvergleich.vorschlag.umfassender":
      "Voorgesteld is het uitgebreidere artikel: volgens de herkenning bevat het het andere.",
    "dublettenvergleich.vorschlag.aelter":
      "Voorgesteld is het oudere artikel, omdat geen van beide gecontroleerd is en geen het andere bevat.",
    "dublettenvergleich.weiter": "Verder",
    "dublettenvergleich.zurueck": "Terug",
    "dublettenvergleich.abbrechen": "Annuleren — niets opslaan",
    "dublettenvergleich.seite.fuehrend": "Leidend artikel",
    "dublettenvergleich.seite.aufgehend": "Opgaand artikel",
    "dublettenvergleich.feld.titel": "Titel",
    "dublettenvergleich.feld.kernaussage": "Kernuitspraak met lopende tekst",
    "dublettenvergleich.feld.bedingungen": "Voorwaarden",
    "dublettenvergleich.feld.massnahmen": "Maatregelen",
    "dublettenvergleich.feld.fliesstext": "Lopende tekst",
    "dublettenvergleich.fliesstext.kopplung":
      "De lopende tekst reist mee met de kernuitspraak: wie de kernuitspraak van een kant kiest, neemt ook diens lopende tekst over. Lopende tekst: {{lage}}.",
    "dublettenvergleich.fliesstext.ersetzt":
      "Vorige lopende tekst van „{{titel}}” — die wordt vervangen en blijft leesbaar in de vorige versie.",
    "dublettenvergleich.veraltet":
      "Eén kant is intussen gewijzigd. Het voorbeeld toont de stand waarmee je begon; vrijgeven kan pas als je de nieuwe stand overneemt en opnieuw controleert.",
    "dublettenvergleich.veraltetUebernehmen": "Nieuwe stand overnemen en opnieuw controleren",
    "dublettenvergleich.lage.gleich": "komt overeen",
    "dublettenvergleich.lage.abweichend": "wijkt af",
    "dublettenvergleich.lage.nur_eine_seite": "onzeker — slechts één kant",
    "dublettenvergleich.lage.beide_leer": "beide leeg",
    "dublettenvergleich.herkunft.beide": "in beide",
    "dublettenvergleich.herkunft.fuehrend": "alleen leidend artikel",
    "dublettenvergleich.herkunft.aufgehend": "alleen opgaand artikel",
    "dublettenvergleich.leer": "(leeg)",
    "dublettenvergleich.keinePositionen": "Geen items aan beide kanten.",
    "dublettenvergleich.eigenanteil":
      "Wat volgens de herkenning alleen in het opgaande artikel staat: {{text}}",
    "dublettenvergleich.quellen.bleiben": "Blijven — bronnen van het leidende artikel",
    "dublettenvergleich.quellen.mitnehmen": "Meenemen — bronnen van het opgaande artikel",
    "dublettenvergleich.quellen.keine": "Geen.",
    "dublettenvergleich.vorschau.fassung":
      "Er ontstaat versie {{version}} van „{{titel}}”. Die is ongecontroleerd en gaat zoals elke bewerking door de normale controle.",
    "dublettenvergleich.vorschau.verbleib":
      "„{{titel}}” wordt niet verwijderd: het artikel blijft met bronnen, bijlagen, opmerkingen en geschiedenis blijvend leesbaar en verwijst naar het leidende artikel.",
    "dublettenvergleich.vorschau.nichtUebernommen":
      "Niet overgenomen — blijft leesbaar in het opgaande artikel of in de vorige versie",
    "dublettenvergleich.vermerk": "Notitie bij het samenvoegen (optioneel)",
    "dublettenvergleich.bestaetigung":
      "Ik heb het voorbeeld gecontroleerd en geef het samenvoegen vrij.",
    "dublettenvergleich.freigeben": "Samenvoegen vrijgeven",
    "dublettenvergleich.laeuft": "Wordt samengevoegd …",
    "dublettenvergleich.erledigt":
      "Samengevoegd. „{{fuehrend}}” heeft nu versie {{version}} en wacht op controle; „{{aufgehend}}” blijft leesbaar en verwijst ernaar.",
    "dublettenvergleich.zumFuehrungsartikel": "Naar het leidende artikel",
    "dublettenvergleich.zumAufgegangenen": "Naar het opgegane artikel",
    "dublettenvergleich.menue": "Samenvoegen …",
    "dublettenvergleich.beleg": "Bron · datum · betrouwbaarheid",
    "dublettenvergleich.beweislage.keine":
      "Geen van beide kanten is met een bron onderbouwd. Bij het samenvoegen gaat daarom geen bewijs mee — het is zinvol eerst een bron toe te voegen.",
    "dublettenvergleich.beweislage.einseitig":
      "Alleen „{{titel}}” is met een bron onderbouwd. Dat is een verschil in bewijslage, geen oordeel over welke kant inhoudelijk klopt; bij het samenvoegen kan de bron worden meegenomen.",
    "dublettenvergleich.aufgegangen.hinweis":
      "Dit artikel is op {{datum}} opgegaan in „{{titel}}”. Het blijft leesbaar; het overgebleven artikel wordt onderhouden.",
    "dublettenvergleich.aufgegangen.ohneTitel":
      "Dit artikel is op {{datum}} opgegaan in een ander artikel. Het blijft leesbaar; het overgebleven artikel wordt onderhouden.",
    "dublettenvergleich.aufgegangen.link": "Naar het overgebleven artikel",
  },
} satisfies Textmodul;
