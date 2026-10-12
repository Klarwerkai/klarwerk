// ================================================================================================
// OCR-03 · ERKENNTNISSE AUS BILDERN IN KLARA NUTZEN UND DIE AUTOMATIK IM SETUP STEUERN — die Texte.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-bildanalyse-ocr-kontext-setup. Verwendet in
// `components/klara-setup/KlaraSetup.tsx` (Schalter), `components/KlaraBildKontextFrage.tsx`
// (Klara fragen), `components/BildBefundListe.tsx` und `lib/klaraBildKontext.ts` (Kontext an Klara).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarabildkontext.",
  legacySchluessel: [],
  de: {
    "klarabildkontext.setup.titel": "Bilder und Text in Bildern",
    "klarabildkontext.setup.schalter": "Bilder automatisch analysieren und Text erkennen",
    "klarabildkontext.setup.erklaerung":
      "Klara liest Bilder und eingebettete Bilder in Dateien, Folien und Texten, sobald sie Klara bereitgestellt sind – ohne Klick auf die Texterkennung. Das gilt nur für Inhalte, die Klara tatsächlich erreicht; andere Apps werden nicht gelesen. Originaldateien und Bilder bleiben unverändert.",
    "klarabildkontext.setup.an": "Eingeschaltet: Neue Bilder werden automatisch gelesen.",
    "klarabildkontext.setup.aus":
      "Ausgeschaltet: Neue Bilder werden nicht automatisch gelesen. Bereits vorhandene Ergebnisse bleiben sichtbar und sind als vorhanden gekennzeichnet; eine gerade laufende Erkennung eines Bildes wird noch beendet, weitere Bilder werden nicht mehr gelesen. Die Texterkennung per Klick bleibt möglich.",
    "klarabildkontext.setup.geltung":
      "Gilt für dein Konto – nach dem Neuladen und auf allen Geräten.",
    "klarabildkontext.setup.laedt": "Einstellung wird geladen …",
    "klarabildkontext.setup.unbekannt":
      "Die Einstellung konnte nicht geladen werden. Bis sie geladen ist, liest Klara Bilder nicht automatisch.",
    "klarabildkontext.setup.ohneKonto": "Ohne Anmeldung gibt es keine gespeicherte Einstellung.",
    "klarabildkontext.setup.speichert": "Wird gespeichert …",
    "klarabildkontext.setup.gespeichertAn": "Gespeichert: Bilder werden automatisch gelesen.",
    "klarabildkontext.setup.gespeichertAus":
      "Gespeichert: Bilder werden nicht mehr automatisch gelesen.",
    "klarabildkontext.setup.konflikt":
      "Deine Klara-Einstellungen wurden inzwischen an anderer Stelle geändert. Der aktuelle Stand ist neu geladen – bitte erneut wählen.",
    "klarabildkontext.setup.fehler": "Nicht gespeichert – bitte erneut versuchen.",
    "klarabildkontext.grund.automatikAus": "automatisches Lesen ist ausgeschaltet",
    "klarabildkontext.hinweis.einstellungUnbekannt":
      "Die Einstellung zum automatischen Lesen konnte nicht geladen werden – die Bilder sind nicht automatisch gelesen.",
    "klarabildkontext.frage.titel": "Klara zu diesem Inhalt fragen",
    "klarabildkontext.frage.erklaerung":
      "Klara nutzt den Text und den automatisch gelesenen Inhalt der Bilder und nennt bei Bildern die Fundstelle.",
    "klarabildkontext.frage.label": "Frage an Klara",
    "klarabildkontext.frage.platzhalter": "Frage zum Inhalt – auch zu Text in Bildern",
    "klarabildkontext.frage.fragen": "Fragen",
    "klarabildkontext.frage.zusammenfassen": "Zusammenfassen",
    "klarabildkontext.frage.laeuft": "Klara antwortet …",
    "klarabildkontext.stand.vollstaendig": "Alle {{gesamt}} Bilder sind gelesen.",
    "klarabildkontext.stand.laeuft":
      "Bilder werden noch gelesen: {{gelesen}} von {{gesamt}} fertig. Antworten berücksichtigen nur, was schon gelesen ist.",
    "klarabildkontext.stand.teilweise":
      "Nicht alle Bilder sind vollständig gelesen ({{gelesen}} von {{gesamt}} mit gelesenem Text). Antworten können unvollständig sein.",
    "klarabildkontext.antwort.titel": "Antwort von Klara",
    "klarabildkontext.antwort.zusammenfassungTitel": "Zusammenfassung von Klara",
    "klarabildkontext.antwort.unvollstaendig":
      "Beruht auf einem unvollständigen Stand: {{offen}} von {{gesamt}} Bildern ohne gelesenen Text.",
    "klarabildkontext.antwort.ohneModell":
      "Für eine formulierte Antwort ist hier gerade kein Modell verfügbar. Klara zeigt die passenden Fundstellen.",
    "klarabildkontext.antwort.ohneModellZusammenfassung":
      "Für eine Zusammenfassung ist hier gerade kein Modell verfügbar.",
    "klarabildkontext.antwort.fehler": "Klara konnte nicht antworten: {{grund}}",
    "klarabildkontext.antwort.veraltet":
      "Der Inhalt hat sich seit dieser Antwort geändert – sie beruht auf dem früheren Stand. Bitte erneut fragen.",
    "klarabildkontext.belege.titel": "Fundstellen",
    "klarabildkontext.belege.keine":
      "Keine passende Stelle gefunden – weder im Text noch in den gelesenen Bildern.",
    "klarabildkontext.belege.dokument": "Text",
    "klarabildkontext.belege.beruecksichtigt": "Berücksichtigte Bilder: {{orte}}",
    "klarabildkontext.belege.keineBilder": "Noch kein Bild mit gelesenem Inhalt.",
    "klarabildkontext.kontext.kopf":
      "--- Automatisch gelesener Inhalt der Bilder (Fundstelle in eckigen Klammern) ---",
    "klarabildkontext.kontext.text": "Bildtext",
    "klarabildkontext.kontext.inhalt": "Bildinhalt",
    "klarabildkontext.kontext.keinText": "kein Text im Bild",
    "klarabildkontext.kontext.offen": "nicht gelesen ({{status}})",
    "klarabildkontext.kontext.folie": "Folie {{folie}}",
    "klarabildkontext.kontext.nichtUebernommen":
      "{{anzahl}} Bild(er) nicht übernommen – nicht gelesen",
    "klarabildkontext.anweisung.frage":
      "Beantworte diese Frage ausschließlich mit dem folgenden Inhalt (Text und automatisch gelesener Inhalt der Bilder): {{frage}}",
    "klarabildkontext.anweisung.zusammenfassung":
      "Fasse den folgenden Inhalt knapp zusammen. Berücksichtige den Text UND den automatisch gelesenen Text und Inhalt der Bilder.",
    "klarabildkontext.anweisung.fundstellen":
      "Verwendest du etwas aus einem Bild, nenne seine Fundstelle in eckigen Klammern genau so, wie sie dort steht (z. B. [{{beispiel}}]). [?…] ist unsicher gelesen, [unleserlich] war nicht lesbar: ergänze dort nichts und erfinde keinen Text. Steht die Antwort nicht im Inhalt, sage das.",
    "klarabildkontext.anweisung.laeuft": "Das Lesen der Bilder läuft noch.",
    "klarabildkontext.anweisung.unvollstaendig":
      "Die Bilder sind nicht vollständig gelesen ({{offen}} von {{gesamt}} ohne gelesenen Text). Sage ausdrücklich, dass die Antwort deshalb unvollständig sein kann, und behaupte keine Vollständigkeit.",
  },
  en: {
    "klarabildkontext.setup.titel": "Images and text in images",
    "klarabildkontext.setup.schalter": "Analyse images automatically and recognise text",
    "klarabildkontext.setup.erklaerung":
      "Klara reads images and embedded images in files, slides and texts as soon as they are provided to Klara – without clicking text recognition. This only applies to content Klara actually receives; other apps are not read. Original files and images remain unchanged.",
    "klarabildkontext.setup.an": "Switched on: new images are read automatically.",
    "klarabildkontext.setup.aus":
      "Switched off: new images are not read automatically. Existing results stay visible and are marked as existing; a recognition already running for one image is finished, further images are no longer read. Text recognition by click remains available.",
    "klarabildkontext.setup.geltung":
      "Applies to your account – after reloading and on all devices.",
    "klarabildkontext.setup.laedt": "Loading setting …",
    "klarabildkontext.setup.unbekannt":
      "The setting could not be loaded. Until it is loaded, Klara does not read images automatically.",
    "klarabildkontext.setup.ohneKonto": "Without signing in there is no saved setting.",
    "klarabildkontext.setup.speichert": "Saving …",
    "klarabildkontext.setup.gespeichertAn": "Saved: images are read automatically.",
    "klarabildkontext.setup.gespeichertAus": "Saved: images are no longer read automatically.",
    "klarabildkontext.setup.konflikt":
      "Your Klara settings were changed elsewhere in the meantime. The current state has been reloaded – please choose again.",
    "klarabildkontext.setup.fehler": "Not saved – please try again.",
    "klarabildkontext.grund.automatikAus": "automatic reading is switched off",
    "klarabildkontext.hinweis.einstellungUnbekannt":
      "The setting for automatic reading could not be loaded – the images have not been read automatically.",
    "klarabildkontext.frage.titel": "Ask Klara about this content",
    "klarabildkontext.frage.erklaerung":
      "Klara uses the text and the automatically read content of the images and names the location for images.",
    "klarabildkontext.frage.label": "Question for Klara",
    "klarabildkontext.frage.platzhalter": "Question about the content – including text in images",
    "klarabildkontext.frage.fragen": "Ask",
    "klarabildkontext.frage.zusammenfassen": "Summarise",
    "klarabildkontext.frage.laeuft": "Klara is answering …",
    "klarabildkontext.stand.vollstaendig": "All {{gesamt}} images have been read.",
    "klarabildkontext.stand.laeuft":
      "Images are still being read: {{gelesen}} of {{gesamt}} done. Answers only consider what has already been read.",
    "klarabildkontext.stand.teilweise":
      "Not all images have been fully read ({{gelesen}} of {{gesamt}} with read text). Answers may be incomplete.",
    "klarabildkontext.antwort.titel": "Answer from Klara",
    "klarabildkontext.antwort.zusammenfassungTitel": "Summary from Klara",
    "klarabildkontext.antwort.unvollstaendig":
      "Based on an incomplete state: {{offen}} of {{gesamt}} images without read text.",
    "klarabildkontext.antwort.ohneModell":
      "No model is currently available here for a written answer. Klara shows the matching locations.",
    "klarabildkontext.antwort.ohneModellZusammenfassung":
      "No model is currently available here for a summary.",
    "klarabildkontext.antwort.fehler": "Klara could not answer: {{grund}}",
    "klarabildkontext.antwort.veraltet":
      "The content has changed since this answer – it is based on the earlier state. Please ask again.",
    "klarabildkontext.belege.titel": "Locations",
    "klarabildkontext.belege.keine":
      "No matching passage found – neither in the text nor in the images read.",
    "klarabildkontext.belege.dokument": "Text",
    "klarabildkontext.belege.beruecksichtigt": "Images considered: {{orte}}",
    "klarabildkontext.belege.keineBilder": "No image with read content yet.",
    "klarabildkontext.kontext.kopf":
      "--- Automatically read content of the images (location in square brackets) ---",
    "klarabildkontext.kontext.text": "Image text",
    "klarabildkontext.kontext.inhalt": "Image content",
    "klarabildkontext.kontext.keinText": "no text in the image",
    "klarabildkontext.kontext.offen": "not read ({{status}})",
    "klarabildkontext.kontext.folie": "Slide {{folie}}",
    "klarabildkontext.kontext.nichtUebernommen": "{{anzahl}} image(s) not imported – not read",
    "klarabildkontext.anweisung.frage":
      "Answer this question using only the following content (text and automatically read content of the images): {{frage}}",
    "klarabildkontext.anweisung.zusammenfassung":
      "Summarise the following content briefly. Consider the text AND the automatically read text and content of the images.",
    "klarabildkontext.anweisung.fundstellen":
      "If you use anything from an image, give its location in square brackets exactly as written there (e.g. [{{beispiel}}]). [?…] was read with uncertainty, [unleserlich] was illegible: do not fill these in and do not invent text. If the answer is not in the content, say so.",
    "klarabildkontext.anweisung.laeuft": "The images are still being read.",
    "klarabildkontext.anweisung.unvollstaendig":
      "The images have not been fully read ({{offen}} of {{gesamt}} without read text). State explicitly that the answer may therefore be incomplete, and do not claim completeness.",
  },
  nl: {
    "klarabildkontext.setup.titel": "Afbeeldingen en tekst in afbeeldingen",
    "klarabildkontext.setup.schalter": "Afbeeldingen automatisch analyseren en tekst herkennen",
    "klarabildkontext.setup.erklaerung":
      "Klara leest afbeeldingen en ingesloten afbeeldingen in bestanden, dia's en teksten zodra ze aan Klara zijn aangeboden – zonder klik op tekstherkenning. Dit geldt alleen voor inhoud die Klara werkelijk bereikt; andere apps worden niet gelezen. Originele bestanden en afbeeldingen blijven ongewijzigd.",
    "klarabildkontext.setup.an": "Ingeschakeld: nieuwe afbeeldingen worden automatisch gelezen.",
    "klarabildkontext.setup.aus":
      "Uitgeschakeld: nieuwe afbeeldingen worden niet automatisch gelezen. Bestaande resultaten blijven zichtbaar en zijn als bestaand gemarkeerd; een lopende herkenning van één afbeelding wordt nog afgerond, verdere afbeeldingen worden niet meer gelezen. Tekstherkenning met een klik blijft mogelijk.",
    "klarabildkontext.setup.geltung":
      "Geldt voor je account – na opnieuw laden en op alle apparaten.",
    "klarabildkontext.setup.laedt": "Instelling wordt geladen …",
    "klarabildkontext.setup.unbekannt":
      "De instelling kon niet worden geladen. Tot ze geladen is, leest Klara afbeeldingen niet automatisch.",
    "klarabildkontext.setup.ohneKonto": "Zonder aanmelding is er geen opgeslagen instelling.",
    "klarabildkontext.setup.speichert": "Wordt opgeslagen …",
    "klarabildkontext.setup.gespeichertAn": "Opgeslagen: afbeeldingen worden automatisch gelezen.",
    "klarabildkontext.setup.gespeichertAus":
      "Opgeslagen: afbeeldingen worden niet meer automatisch gelezen.",
    "klarabildkontext.setup.konflikt":
      "Je Klara-instellingen zijn intussen elders gewijzigd. De actuele stand is opnieuw geladen – kies opnieuw.",
    "klarabildkontext.setup.fehler": "Niet opgeslagen – probeer het opnieuw.",
    "klarabildkontext.grund.automatikAus": "automatisch lezen is uitgeschakeld",
    "klarabildkontext.hinweis.einstellungUnbekannt":
      "De instelling voor automatisch lezen kon niet worden geladen – de afbeeldingen zijn niet automatisch gelezen.",
    "klarabildkontext.frage.titel": "Klara vragen over deze inhoud",
    "klarabildkontext.frage.erklaerung":
      "Klara gebruikt de tekst en de automatisch gelezen inhoud van de afbeeldingen en noemt bij afbeeldingen de vindplaats.",
    "klarabildkontext.frage.label": "Vraag aan Klara",
    "klarabildkontext.frage.platzhalter": "Vraag over de inhoud – ook over tekst in afbeeldingen",
    "klarabildkontext.frage.fragen": "Vragen",
    "klarabildkontext.frage.zusammenfassen": "Samenvatten",
    "klarabildkontext.frage.laeuft": "Klara antwoordt …",
    "klarabildkontext.stand.vollstaendig": "Alle {{gesamt}} afbeeldingen zijn gelezen.",
    "klarabildkontext.stand.laeuft":
      "Afbeeldingen worden nog gelezen: {{gelesen}} van {{gesamt}} klaar. Antwoorden houden alleen rekening met wat al gelezen is.",
    "klarabildkontext.stand.teilweise":
      "Niet alle afbeeldingen zijn volledig gelezen ({{gelesen}} van {{gesamt}} met gelezen tekst). Antwoorden kunnen onvolledig zijn.",
    "klarabildkontext.antwort.titel": "Antwoord van Klara",
    "klarabildkontext.antwort.zusammenfassungTitel": "Samenvatting van Klara",
    "klarabildkontext.antwort.unvollstaendig":
      "Berust op een onvolledige stand: {{offen}} van {{gesamt}} afbeeldingen zonder gelezen tekst.",
    "klarabildkontext.antwort.ohneModell":
      "Voor een geformuleerd antwoord is hier nu geen model beschikbaar. Klara toont de passende vindplaatsen.",
    "klarabildkontext.antwort.ohneModellZusammenfassung":
      "Voor een samenvatting is hier nu geen model beschikbaar.",
    "klarabildkontext.antwort.fehler": "Klara kon niet antwoorden: {{grund}}",
    "klarabildkontext.antwort.veraltet":
      "De inhoud is sinds dit antwoord gewijzigd – het berust op de eerdere stand. Vraag opnieuw.",
    "klarabildkontext.belege.titel": "Vindplaatsen",
    "klarabildkontext.belege.keine":
      "Geen passende plaats gevonden – niet in de tekst en niet in de gelezen afbeeldingen.",
    "klarabildkontext.belege.dokument": "Tekst",
    "klarabildkontext.belege.beruecksichtigt": "Meegenomen afbeeldingen: {{orte}}",
    "klarabildkontext.belege.keineBilder": "Nog geen afbeelding met gelezen inhoud.",
    "klarabildkontext.kontext.kopf":
      "--- Automatisch gelezen inhoud van de afbeeldingen (vindplaats tussen vierkante haken) ---",
    "klarabildkontext.kontext.text": "Afbeeldingstekst",
    "klarabildkontext.kontext.inhalt": "Beeldinhoud",
    "klarabildkontext.kontext.keinText": "geen tekst in de afbeelding",
    "klarabildkontext.kontext.offen": "niet gelezen ({{status}})",
    "klarabildkontext.kontext.folie": "Dia {{folie}}",
    "klarabildkontext.kontext.nichtUebernommen":
      "{{anzahl}} afbeelding(en) niet overgenomen – niet gelezen",
    "klarabildkontext.anweisung.frage":
      "Beantwoord deze vraag uitsluitend met de volgende inhoud (tekst en automatisch gelezen inhoud van de afbeeldingen): {{frage}}",
    "klarabildkontext.anweisung.zusammenfassung":
      "Vat de volgende inhoud beknopt samen. Houd rekening met de tekst ÉN de automatisch gelezen tekst en inhoud van de afbeeldingen.",
    "klarabildkontext.anweisung.fundstellen":
      "Gebruik je iets uit een afbeelding, noem dan de vindplaats tussen vierkante haken precies zoals die daar staat (bijv. [{{beispiel}}]). [?…] is onzeker gelezen, [unleserlich] was onleesbaar: vul daar niets aan en verzin geen tekst. Staat het antwoord niet in de inhoud, zeg dat dan.",
    "klarabildkontext.anweisung.laeuft": "Het lezen van de afbeeldingen loopt nog.",
    "klarabildkontext.anweisung.unvollstaendig":
      "De afbeeldingen zijn niet volledig gelezen ({{offen}} van {{gesamt}} zonder gelezen tekst). Zeg uitdrukkelijk dat het antwoord daardoor onvolledig kan zijn, en beweer geen volledigheid.",
  },
} satisfies Textmodul;
