// ================================================================================================
// KLARA 04 (Auftrag produkt:20261008:klara-vorschlaege) — Entwürfe und bewusste Übernahme.
// ================================================================================================
//
// Die Texte zum Formulierungsvorschlag im echten Betrieb: Original und Vorschlag, Ziel und
// Bearbeitungsfassung, die Rückfrage bei mehrdeutigem Ziel, die Fehler ohne Bearbeitungsrecht und
// das am Server nachgelesene Ergebnis. Dazu die Bedienhilfe dieser Fähigkeit in Klara.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaravorschlag.",
  legacySchluessel: [],
  de: {
    "klaravorschlag.titel": "Formulierungsvorschlag",
    "klaravorschlag.ki.ki": "KI-Formulierung · nicht geprüft",
    "klaravorschlag.ki.ohneKi": "Ohne KI · nur geglättet",
    "klaravorschlag.ziel": "Ziel",
    "klaravorschlag.zurQuelle": "Zur Stelle",
    "klaravorschlag.fassung": "Bearbeitung",
    "klaravorschlag.fassungEditor":
      "Bearbeitungsfassung von „{{titel}}“ im Editor – erst Speichern (oder Einreichen) ändert den Beitrag.",
    "klaravorschlag.fassungEditorFeld":
      "Steht im Editor im Feld „{{feld}}“ – erst Speichern (oder Einreichen) ändert den Beitrag.",
    "klaravorschlag.fassungKeine":
      "Kein bearbeitbarer Beitrag – den Vorschlag kannst du lesen, aber nirgends übernehmen.",
    "klaravorschlag.feld.aussage": "Kernaussage",
    "klaravorschlag.feld.inhalt": "Inhalt",
    "klaravorschlag.original": "Original (unverändert)",
    "klaravorschlag.neu": "Vorschlag",
    "klaravorschlag.stand.offen": "Noch nichts geändert – übernimm den Vorschlag oder verwirf ihn.",
    "klaravorschlag.stand.rueckfrage": "Rückfrage – noch nichts geändert.",
    "klaravorschlag.stand.wartet": "Übergabe an den Editor läuft …",
    "klaravorschlag.stand.in_bearbeitung":
      "In die Bearbeitungsfassung übernommen. Noch nicht gespeichert – speichere oder reiche im Editor ein; „Abbrechen“ dort verwirft die Änderung.",
    "klaravorschlag.stand.gespeichert":
      "Gespeichert – der Beitrag steht jetzt in Fassung {{fassung}}.",
    "klaravorschlag.stand.eingereicht":
      "Als Änderungsvorschlag eingereicht – der Beitrag gilt unverändert, bis jemand ihn übernimmt.",
    "klaravorschlag.stand.nicht_gespeichert":
      "Bearbeitung ohne diese Änderung beendet – das Original gilt unverändert.",
    "klaravorschlag.stand.verworfen": "Verworfen – das Original bleibt unverändert.",
    "klaravorschlag.stand.fehler": "Nicht übernommen – nichts geändert.",
    "klaravorschlag.zumObjekt": "„{{titel}}“ öffnen",
    "klaravorschlag.uebernehmen": "Übernehmen",
    "klaravorschlag.verwerfen": "Verwerfen",
    "klaravorschlag.schliessen": "Schliessen",
    "klaravorschlag.ansage.bereit":
      "Vorschlag bereit – Original und Vorschlag stehen nebeneinander.",
    "klaravorschlag.fehler.leer": "Der Formulierungsweg hat keinen Vorschlag geliefert.",
    "klaravorschlag.fehler.formulieren": "Kein Vorschlag: {{grund}}",
    "klaravorschlag.fehler.uebersetzung":
      "Die Markierung stammt aus der Leseübersetzung von „{{titel}}“. Übernommen werden kann nur ins Original – markiere dort.",
    "klaravorschlag.fehler.keinRecht":
      "Du darfst „{{titel}}“ nicht bearbeiten. Klara hat nichts geändert.",
    "klaravorschlag.fehler.nichtGefunden":
      "Der markierte Wortlaut steht nicht mehr in Kernaussage oder Inhalt von „{{titel}}“. Klara hat nichts geändert.",
    "klaravorschlag.fehler.formatierung":
      "Die Markierung reicht über eine Formatierung (z. B. fett oder einen Verweis). Markiere innerhalb eines gleich formatierten Abschnitts oder ändere die Stelle im Editor selbst.",
    "klaravorschlag.fehler.keinEditor":
      "Der Editor dieses Beitrags hat nicht geantwortet. Klara hat nichts geändert.",
    "klaravorschlag.fehler.formatiertMehrdeutig":
      "Der markierte Wortlaut steht auch an einer formatierten Stelle im Inhalt (z. B. fett oder mit Verweis). Klara kann nicht sicher sagen, welche Stelle gemeint ist, und hat nichts geändert – ändere die Stelle im Editor selbst.",
    "klaravorschlag.rueckfrage.keinObjekt":
      "Wohin soll der Vorschlag? Die Markierung stammt von „{{seite}}“ und gehört zu keinem Beitrag, den Klara bearbeiten kann. Übernimm den Text selbst, wo er hingehört.",
    "klaravorschlag.rueckfrage.anderesObjekt":
      "Der Vorschlag gehört zu „{{titel}}“, geöffnet ist „{{offen}}“. Klara ändert nicht das falsche Objekt – öffne „{{titel}}“ und übernimm dort.",
    "klaravorschlag.rueckfrage.nichtOffen":
      "Der Vorschlag gehört zu „{{titel}}“, dieser Beitrag ist gerade nicht geöffnet. Öffne ihn und übernimm dort.",
    "klaravorschlag.rueckfrage.stellen":
      "Der markierte Wortlaut steht {{anzahl}}-mal im Beitrag. Welche Stelle meinst du?",
    "klaravorschlag.rueckfrage.veraltet":
      "Der Beitrag hat sich seit deiner Auswahl geändert – Klara hat nichts geändert. Der Wortlaut steht jetzt {{anzahl}}-mal darin. Welche Stelle meinst du?",
    "klaravorschlag.bedienhilfe.umformulieren":
      "„Umformulieren“: Klara schlägt für den markierten Text eine klarere Formulierung vor (derselbe Formulierungsweg wie die KI-Hilfe im Editor) und zeigt Original und Vorschlag nebeneinander. Am Beitrag ändert sich dabei nichts.",
    "klaravorschlag.bedienhilfe.uebernehmen":
      "„Übernehmen“ setzt den Vorschlag in die Bearbeitungsfassung des Beitrags im Editor. Dauerhaft wird er erst, wenn du dort speicherst oder einreichst – Klara liest danach nach, was gespeichert ist.",
    "klaravorschlag.bedienhilfe.rueckfrage":
      "Steht der Wortlaut mehrmals im Beitrag, fragt Klara nach der Stelle. Ist ein anderer Beitrag geöffnet oder fehlt dir das Bearbeitungsrecht, ändert Klara nichts und sagt warum.",
    "klaravorschlag.bedienhilfe.notiz":
      "„Notizentwurf“ legt einen Entwurf mit Rücklink zur Stelle an; er bleibt in dieser Sitzung.",
  },
  en: {
    "klaravorschlag.titel": "Wording suggestion",
    "klaravorschlag.ki.ki": "AI wording · not reviewed",
    "klaravorschlag.ki.ohneKi": "Without AI · only smoothed",
    "klaravorschlag.ziel": "Target",
    "klaravorschlag.zurQuelle": "Go to passage",
    "klaravorschlag.fassung": "Editing",
    "klaravorschlag.fassungEditor":
      "Working version of “{{titel}}” in the editor – only saving (or submitting) changes the article.",
    "klaravorschlag.fassungEditorFeld":
      "In the editor, field “{{feld}}” – only saving (or submitting) changes the article.",
    "klaravorschlag.fassungKeine":
      "No editable article – you can read the suggestion but not apply it anywhere.",
    "klaravorschlag.feld.aussage": "Key statement",
    "klaravorschlag.feld.inhalt": "Content",
    "klaravorschlag.original": "Original (unchanged)",
    "klaravorschlag.neu": "Suggestion",
    "klaravorschlag.stand.offen": "Nothing changed yet – apply the suggestion or discard it.",
    "klaravorschlag.stand.rueckfrage": "Question – nothing changed yet.",
    "klaravorschlag.stand.wartet": "Handing over to the editor …",
    "klaravorschlag.stand.in_bearbeitung":
      "Applied to the working version. Not saved yet – save or submit in the editor; “Cancel” there discards the change.",
    "klaravorschlag.stand.gespeichert": "Saved – the article is now at version {{fassung}}.",
    "klaravorschlag.stand.eingereicht":
      "Submitted as a change proposal – the article stays unchanged until someone accepts it.",
    "klaravorschlag.stand.nicht_gespeichert":
      "Editing ended without this change – the original stays unchanged.",
    "klaravorschlag.stand.verworfen": "Discarded – the original stays unchanged.",
    "klaravorschlag.stand.fehler": "Not applied – nothing changed.",
    "klaravorschlag.zumObjekt": "Open “{{titel}}”",
    "klaravorschlag.uebernehmen": "Apply",
    "klaravorschlag.verwerfen": "Discard",
    "klaravorschlag.schliessen": "Close",
    "klaravorschlag.ansage.bereit": "Suggestion ready – original and suggestion side by side.",
    "klaravorschlag.fehler.leer": "The wording path returned no suggestion.",
    "klaravorschlag.fehler.formulieren": "No suggestion: {{grund}}",
    "klaravorschlag.fehler.uebersetzung":
      "The selection comes from the reading translation of “{{titel}}”. Changes can only be applied to the original – select there.",
    "klaravorschlag.fehler.keinRecht":
      "You are not allowed to edit “{{titel}}”. Klara changed nothing.",
    "klaravorschlag.fehler.nichtGefunden":
      "The selected wording is no longer in the key statement or content of “{{titel}}”. Klara changed nothing.",
    "klaravorschlag.fehler.formatierung":
      "The selection spans a formatting change (e.g. bold or a link). Select within one evenly formatted passage or change it in the editor yourself.",
    "klaravorschlag.fehler.keinEditor":
      "The editor of this article did not respond. Klara changed nothing.",
    "klaravorschlag.fehler.formatiertMehrdeutig":
      "The selected wording also occurs at a formatted passage in the content (e.g. bold or a link). Klara cannot tell for sure which passage is meant and changed nothing – change it in the editor yourself.",
    "klaravorschlag.rueckfrage.keinObjekt":
      "Where should the suggestion go? The selection comes from “{{seite}}” and belongs to no article Klara can edit. Copy the text where it belongs yourself.",
    "klaravorschlag.rueckfrage.anderesObjekt":
      "The suggestion belongs to “{{titel}}”, but “{{offen}}” is open. Klara does not change the wrong object – open “{{titel}}” and apply it there.",
    "klaravorschlag.rueckfrage.nichtOffen":
      "The suggestion belongs to “{{titel}}”, which is not open right now. Open it and apply it there.",
    "klaravorschlag.rueckfrage.stellen":
      "The selected wording occurs {{anzahl}} times in the article. Which passage do you mean?",
    "klaravorschlag.rueckfrage.veraltet":
      "The article has changed since your choice – Klara changed nothing. The wording now occurs {{anzahl}} times. Which passage do you mean?",
    "klaravorschlag.bedienhilfe.umformulieren":
      "“Rephrase”: Klara suggests clearer wording for the selected text (the same wording path as the AI help in the editor) and shows original and suggestion side by side. The article does not change.",
    "klaravorschlag.bedienhilfe.uebernehmen":
      "“Apply” puts the suggestion into the article’s working version in the editor. It only becomes permanent when you save or submit there – Klara then checks what was saved.",
    "klaravorschlag.bedienhilfe.rueckfrage":
      "If the wording occurs more than once, Klara asks which passage you mean. If another article is open or you lack editing rights, Klara changes nothing and says why.",
    "klaravorschlag.bedienhilfe.notiz":
      "“Note draft” creates a draft with a link back to the passage; it stays in this session.",
  },
  nl: {
    "klaravorschlag.titel": "Formuleringsvoorstel",
    "klaravorschlag.ki.ki": "AI-formulering · niet gecontroleerd",
    "klaravorschlag.ki.ohneKi": "Zonder AI · alleen gladgestreken",
    "klaravorschlag.ziel": "Doel",
    "klaravorschlag.zurQuelle": "Naar de passage",
    "klaravorschlag.fassung": "Bewerking",
    "klaravorschlag.fassungEditor":
      "Werkversie van „{{titel}}” in de editor – pas opslaan (of indienen) wijzigt het artikel.",
    "klaravorschlag.fassungEditorFeld":
      "Staat in de editor in het veld „{{feld}}” – pas opslaan (of indienen) wijzigt het artikel.",
    "klaravorschlag.fassungKeine":
      "Geen bewerkbaar artikel – je kunt het voorstel lezen, maar nergens overnemen.",
    "klaravorschlag.feld.aussage": "Kernuitspraak",
    "klaravorschlag.feld.inhalt": "Inhoud",
    "klaravorschlag.original": "Origineel (ongewijzigd)",
    "klaravorschlag.neu": "Voorstel",
    "klaravorschlag.stand.offen": "Nog niets gewijzigd – neem het voorstel over of verwerp het.",
    "klaravorschlag.stand.rueckfrage": "Wedervraag – nog niets gewijzigd.",
    "klaravorschlag.stand.wartet": "Overdracht aan de editor loopt …",
    "klaravorschlag.stand.in_bearbeitung":
      "In de werkversie overgenomen. Nog niet opgeslagen – sla op of dien in in de editor; „Annuleren” daar verwerpt de wijziging.",
    "klaravorschlag.stand.gespeichert": "Opgeslagen – het artikel staat nu op versie {{fassung}}.",
    "klaravorschlag.stand.eingereicht":
      "Als wijzigingsvoorstel ingediend – het artikel blijft ongewijzigd tot iemand het overneemt.",
    "klaravorschlag.stand.nicht_gespeichert":
      "Bewerking zonder deze wijziging beëindigd – het origineel blijft ongewijzigd.",
    "klaravorschlag.stand.verworfen": "Verworpen – het origineel blijft ongewijzigd.",
    "klaravorschlag.stand.fehler": "Niet overgenomen – niets gewijzigd.",
    "klaravorschlag.zumObjekt": "„{{titel}}” openen",
    "klaravorschlag.uebernehmen": "Overnemen",
    "klaravorschlag.verwerfen": "Verwerpen",
    "klaravorschlag.schliessen": "Sluiten",
    "klaravorschlag.ansage.bereit": "Voorstel klaar – origineel en voorstel staan naast elkaar.",
    "klaravorschlag.fehler.leer": "De formuleringsroute heeft geen voorstel geleverd.",
    "klaravorschlag.fehler.formulieren": "Geen voorstel: {{grund}}",
    "klaravorschlag.fehler.uebersetzung":
      "De markering komt uit de leesvertaling van „{{titel}}”. Overnemen kan alleen in het origineel – markeer daar.",
    "klaravorschlag.fehler.keinRecht":
      "Je mag „{{titel}}” niet bewerken. Klara heeft niets gewijzigd.",
    "klaravorschlag.fehler.nichtGefunden":
      "De gemarkeerde tekst staat niet meer in kernuitspraak of inhoud van „{{titel}}”. Klara heeft niets gewijzigd.",
    "klaravorschlag.fehler.formatierung":
      "De markering loopt over een opmaak heen (bijv. vet of een link). Markeer binnen een gelijk opgemaakte passage of wijzig de plek zelf in de editor.",
    "klaravorschlag.fehler.keinEditor":
      "De editor van dit artikel heeft niet geantwoord. Klara heeft niets gewijzigd.",
    "klaravorschlag.fehler.formatiertMehrdeutig":
      "De gemarkeerde tekst staat ook op een opgemaakte plek in de inhoud (bijv. vet of met een link). Klara kan niet zeker zeggen welke plek bedoeld is en heeft niets gewijzigd – wijzig de plek zelf in de editor.",
    "klaravorschlag.rueckfrage.keinObjekt":
      "Waar moet het voorstel heen? De markering komt van „{{seite}}” en hoort bij geen artikel dat Klara kan bewerken. Neem de tekst zelf over waar hij hoort.",
    "klaravorschlag.rueckfrage.anderesObjekt":
      "Het voorstel hoort bij „{{titel}}”, geopend is „{{offen}}”. Klara wijzigt niet het verkeerde object – open „{{titel}}” en neem het daar over.",
    "klaravorschlag.rueckfrage.nichtOffen":
      "Het voorstel hoort bij „{{titel}}”, dat artikel is nu niet geopend. Open het en neem het daar over.",
    "klaravorschlag.rueckfrage.stellen":
      "De gemarkeerde tekst staat {{anzahl}} keer in het artikel. Welke plek bedoel je?",
    "klaravorschlag.rueckfrage.veraltet":
      "Het artikel is sinds je keuze gewijzigd – Klara heeft niets gewijzigd. De tekst staat er nu {{anzahl}} keer in. Welke plek bedoel je?",
    "klaravorschlag.bedienhilfe.umformulieren":
      "„Herformuleren”: Klara stelt voor de gemarkeerde tekst een duidelijkere formulering voor (dezelfde formuleringsroute als de AI-hulp in de editor) en toont origineel en voorstel naast elkaar. Het artikel verandert daarbij niet.",
    "klaravorschlag.bedienhilfe.uebernehmen":
      "„Overnemen” zet het voorstel in de werkversie van het artikel in de editor. Blijvend wordt het pas als je daar opslaat of indient – Klara leest daarna na wat er is opgeslagen.",
    "klaravorschlag.bedienhilfe.rueckfrage":
      "Staat de tekst meerdere keren in het artikel, dan vraagt Klara welke plek je bedoelt. Is een ander artikel geopend of mis je bewerkingsrechten, dan wijzigt Klara niets en zegt waarom.",
    "klaravorschlag.bedienhilfe.notiz":
      "„Notitieconcept” maakt een concept met een link terug naar de passage; het blijft in deze sessie.",
  },
} satisfies Textmodul;
