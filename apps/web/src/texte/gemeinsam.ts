// ================================================================================================
// GEMEINSAM AN DERSELBEN ARTIKELFASSUNG ARBEITEN · DIE TEXTE (produkt:20261007:artikel-gemeinsam).
// ================================================================================================
//
// Die Seite `pages/GemeinsamerEntwurf.tsx` und die zwei Wege dorthin (Artikelgespräch im Chat,
// Artikel in der Bibliothek). Die Sätze behaupten nur, was der Server bestätigt hat: „gespeichert"
// erst nach seiner Antwort, „zusammengeführt" nur, wenn er zusammengeführt hat, und eine
// ungespeicherte Eingabe übersteht ein Neuladen nur in DIESEM Browserfenster.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "gemeinsam.",
  legacySchluessel: [],
  de: {
    "gemeinsam.seite.titel": "Gemeinsam bearbeiten",
    "gemeinsam.seite.lead":
      "Alle Berechtigten arbeiten hier an derselben Arbeitsfassung. Leser sehen weiterhin die gültige Fassung, bis der Entwurf übernommen oder freigegeben wird.",
    "gemeinsam.seite.laedt": "Lädt …",
    "gemeinsam.seite.fehler": "Der gemeinsame Entwurf ist gerade nicht erreichbar.",
    "gemeinsam.seite.keinZugang":
      "Diesen Artikel kannst du nicht bearbeiten. Die gültige Fassung findest du im Artikel.",
    "gemeinsam.zumArtikel": "Zur gültigen Fassung im Artikel",
    "gemeinsam.lesefassung.titel": "Gültige Lesefassung",
    "gemeinsam.lesefassung.satz":
      "Fassung {{version}} · {{status}} — diese Fassung lesen alle Leser, bis der Entwurf übernommen wird.",
    "gemeinsam.lesefassung.vorschlag":
      "Freigegebener Artikel: das Ergebnis wird als Änderungsvorschlag eingereicht. Die freigegebene Fassung bleibt gültig, bis jemand anders mit Freigaberecht entscheidet.",
    "gemeinsam.status.validiert": "freigegeben",
    "gemeinsam.status.sonst": "noch nicht freigegeben",
    "gemeinsam.entwurf.titel": "Gemeinsamer Entwurf",
    "gemeinsam.entwurf.stand": "Arbeitsstand {{revision}} auf Basis von Fassung {{version}}",
    "gemeinsam.entwurf.keiner": "Zu diesem Artikel ist noch kein gemeinsamer Entwurf offen.",
    "gemeinsam.entwurf.oeffnen": "Gemeinsamen Entwurf beginnen",
    "gemeinsam.entwurf.reich":
      "Dieser Artikel enthält Bilder, Tabellen oder Listen. Der gemeinsame Entwurf bearbeitet nur Titel und Absätze — bitte im Artikel selbst bearbeiten.",
    "gemeinsam.feld.titel": "Titel",
    "gemeinsam.feld.text": "Text",
    "gemeinsam.feld.hinweis":
      "Abschnitte durch eine Leerzeile trennen. Änderungen an verschiedenen Abschnitten werden beim Speichern zusammengeführt.",
    "gemeinsam.anwesend.titel": "Gerade dabei",
    "gemeinsam.anwesend.du": "Du",
    "gemeinsam.anwesend.niemand": "Außer dir ist gerade niemand im Entwurf.",
    "gemeinsam.anwesend.unbekannt": "Wer sonst dabei ist, ist gerade nicht abrufbar.",
    "gemeinsam.speicher.gespeichert":
      "Gespeichert — Arbeitsstand {{revision}}, {{zeit}}, von {{name}}",
    "gemeinsam.speicher.ungespeichert": "Nicht gespeicherte Änderungen",
    "gemeinsam.speicher.laeuft": "Wird gespeichert …",
    "gemeinsam.speicher.unterbrochen":
      "Verbindung unterbrochen — nicht gespeichert. Deine Eingabe bleibt hier und nach einem Neuladen in diesem Browserfenster erhalten. Speichere erneut, sobald die Verbindung zurück ist.",
    "gemeinsam.speicher.ohneRecht":
      "Du darfst diesen Artikel nicht mehr bearbeiten. Nichts wurde gespeichert; deine Eingabe bleibt hier stehen und lässt sich kopieren.",
    "gemeinsam.speicher.konflikt": "Nicht gespeichert — Konflikt. Entscheide unten je Stelle.",
    "gemeinsam.speicher.zusammengefuehrt":
      "Gespeichert und mit den Änderungen von {{namen}} zusammengeführt — Arbeitsstand {{revision}}",
    "gemeinsam.speicher.fehler": "Nicht gespeichert: {{grund}}",
    "gemeinsam.speicher.netz": "keine Verbindung zum Server",
    "gemeinsam.speichern": "Speichern",
    "gemeinsam.kopieren": "Eingabe kopieren",
    "gemeinsam.kopiert": "In die Zwischenablage kopiert",
    "gemeinsam.wiederhergestellt":
      "Nicht gespeicherte Eingabe aus diesem Browserfenster wiederhergestellt (beruht auf Arbeitsstand {{revision}}). Beim Speichern wird sie mit dem aktuellen Stand zusammengeführt.",
    "gemeinsam.fremd.neu":
      "{{name}} hat Arbeitsstand {{revision}} gespeichert. Beim Speichern wird deine Änderung damit zusammengeführt.",
    "gemeinsam.konflikt.titel": "Konflikt: dieselbe Stelle wurde unterschiedlich geändert",
    "gemeinsam.konflikt.erklaerung":
      "Nichts wurde überschrieben. Wähle je Stelle, welche Fassung gilt, und übernimm die Auswahl in den Text — danach speichern.",
    "gemeinsam.konflikt.basis": "Vorher",
    "gemeinsam.konflikt.meine": "Deine Fassung",
    "gemeinsam.konflikt.deren": "Gespeicherte Fassung von {{namen}}",
    "gemeinsam.konflikt.derenOhneName": "Gespeicherte Fassung",
    "gemeinsam.konflikt.lesefassung": "Gültige Lesefassung",
    "gemeinsam.konflikt.nimmMeine": "Meine nehmen",
    "gemeinsam.konflikt.nimmDeren": "Gespeicherte nehmen",
    "gemeinsam.konflikt.beide": "Beide behalten",
    "gemeinsam.konflikt.stelle": "Stelle {{nr}}",
    "gemeinsam.konflikt.titelStelle": "Titel",
    "gemeinsam.konflikt.leer": "(leer)",
    "gemeinsam.konflikt.uebernehmen": "Auswahl in den Text übernehmen",
    "gemeinsam.konflikt.offen": "Noch {{anzahl}} Stelle(n) ohne Entscheidung.",
    "gemeinsam.angleich.titel": "Die gültige Fassung hat sich geändert",
    "gemeinsam.angleich.satz":
      "Der Artikel liegt inzwischen in Fassung {{version}} vor; der Entwurf beruht auf Fassung {{basis}}. Vor dem Übernehmen den Entwurf angleichen — dabei geht nichts verloren.",
    "gemeinsam.angleich.knopf": "Entwurf an Fassung {{version}} angleichen",
    "gemeinsam.angleich.konflikt":
      "Die gültige Fassung wurde an denselben Stellen geändert wie der Entwurf. Entscheide je Stelle.",
    "gemeinsam.angleich.loesung": "Lösung als Entwurf auf Fassung {{version}} speichern",
    "gemeinsam.uebernahme.titel": "Übernehmen",
    "gemeinsam.uebernahme.direkt": "Als neue Fassung übernehmen",
    "gemeinsam.uebernahme.direktSatz":
      "Die neue Fassung ist danach für Leser sichtbar und steht wieder zur Prüfung an.",
    "gemeinsam.uebernahme.vorschlag": "Als Änderungsvorschlag einreichen",
    "gemeinsam.uebernahme.vorschlagSatz":
      "Die freigegebene Fassung bleibt gültig, bis jemand anders mit Freigaberecht den Vorschlag übernimmt.",
    "gemeinsam.uebernahme.erstSpeichern":
      "Erst speichern — übernommen wird nur ein gespeicherter Arbeitsstand.",
    "gemeinsam.uebernahme.titelNicht":
      "Ein Änderungsvorschlag kann den Titel nicht ändern. Setze den Titel zurück oder lass den Entwurf von jemandem mit Freigaberecht übernehmen.",
    "gemeinsam.uebernahme.laeuft": "Wird übernommen …",
    "gemeinsam.uebernahme.fehler": "Nicht übernommen: {{grund}}",
    "gemeinsam.uebernahme.veraltet":
      "Die gültige Fassung hat sich inzwischen geändert — erst angleichen.",
    "gemeinsam.uebernahme.weiter":
      "Übernommen wurde Arbeitsstand {{revision}}. Danach gespeicherte Änderungen bleiben im Entwurf und sind noch nicht übernommen.",
    "gemeinsam.abgeschlossen.uebernommen":
      "Zuletzt übernommen als Fassung {{fassung}} von {{name}}, {{zeit}}.",
    "gemeinsam.abgeschlossen.eingereicht":
      "Zuletzt als Änderungsvorschlag eingereicht von {{name}}, {{zeit}} — wartet auf Freigabe.",
    "gemeinsam.abgeschlossen.neu": "Neuen gemeinsamen Entwurf beginnen",
    "gemeinsam.verlauf.titel": "Verlauf des Entwurfs",
    "gemeinsam.verlauf.angelegt": "{{name}} hat den Entwurf begonnen",
    "gemeinsam.verlauf.gespeichert": "{{name}} hat gespeichert",
    "gemeinsam.verlauf.zusammengefuehrt": "{{name}} hat gespeichert (zusammengeführt)",
    "gemeinsam.verlauf.angeglichen": "{{name}} hat an Fassung {{fassung}} angeglichen",
    "gemeinsam.verlauf.uebernommen": "{{name}} hat als Fassung {{fassung}} übernommen",
    "gemeinsam.verlauf.eingereicht": "{{name}} hat als Änderungsvorschlag eingereicht",
    "gemeinsam.verlauf.zeile": "Arbeitsstand {{revision}} · {{zeit}} · {{was}}",
    "gemeinsam.beteiligte": "Beteiligt: {{namen}}",
    "gemeinsam.chat.oeffnen": "Gemeinsam bearbeiten: {{titel}}",
    "gemeinsam.artikel.oeffnen": "Gemeinsam bearbeiten",
  },
  en: {
    "gemeinsam.seite.titel": "Edit together",
    "gemeinsam.seite.lead":
      "Everyone with permission works on the same working draft here. Readers keep seeing the valid version until the draft is adopted or approved.",
    "gemeinsam.seite.laedt": "Loading …",
    "gemeinsam.seite.fehler": "The shared draft cannot be reached right now.",
    "gemeinsam.seite.keinZugang":
      "You cannot edit this article. The valid version is shown in the article.",
    "gemeinsam.zumArtikel": "To the valid version in the article",
    "gemeinsam.lesefassung.titel": "Valid reading version",
    "gemeinsam.lesefassung.satz":
      "Version {{version}} · {{status}} — all readers see this version until the draft is adopted.",
    "gemeinsam.lesefassung.vorschlag":
      "Approved article: the result is submitted as a change proposal. The approved version stays valid until someone else with approval rights decides.",
    "gemeinsam.status.validiert": "approved",
    "gemeinsam.status.sonst": "not approved yet",
    "gemeinsam.entwurf.titel": "Shared draft",
    "gemeinsam.entwurf.stand": "Working state {{revision}} based on version {{version}}",
    "gemeinsam.entwurf.keiner": "There is no open shared draft for this article yet.",
    "gemeinsam.entwurf.oeffnen": "Start shared draft",
    "gemeinsam.entwurf.reich":
      "This article contains images, tables or lists. The shared draft only edits the title and paragraphs — please edit in the article itself.",
    "gemeinsam.feld.titel": "Title",
    "gemeinsam.feld.text": "Text",
    "gemeinsam.feld.hinweis":
      "Separate sections with a blank line. Changes to different sections are merged when saving.",
    "gemeinsam.anwesend.titel": "Here right now",
    "gemeinsam.anwesend.du": "You",
    "gemeinsam.anwesend.niemand": "Nobody else is in the draft right now.",
    "gemeinsam.anwesend.unbekannt": "Who else is here cannot be retrieved right now.",
    "gemeinsam.speicher.gespeichert": "Saved — working state {{revision}}, {{zeit}}, by {{name}}",
    "gemeinsam.speicher.ungespeichert": "Unsaved changes",
    "gemeinsam.speicher.laeuft": "Saving …",
    "gemeinsam.speicher.unterbrochen":
      "Connection lost — not saved. Your input stays here and, after a reload, in this browser window. Save again as soon as the connection is back.",
    "gemeinsam.speicher.ohneRecht":
      "You may no longer edit this article. Nothing was saved; your input stays here and can be copied.",
    "gemeinsam.speicher.konflikt": "Not saved — conflict. Decide below for each place.",
    "gemeinsam.speicher.zusammengefuehrt":
      "Saved and merged with the changes by {{namen}} — working state {{revision}}",
    "gemeinsam.speicher.fehler": "Not saved: {{grund}}",
    "gemeinsam.speicher.netz": "no connection to the server",
    "gemeinsam.speichern": "Save",
    "gemeinsam.kopieren": "Copy input",
    "gemeinsam.kopiert": "Copied to the clipboard",
    "gemeinsam.wiederhergestellt":
      "Unsaved input restored from this browser window (based on working state {{revision}}). Saving merges it with the current state.",
    "gemeinsam.fremd.neu":
      "{{name}} saved working state {{revision}}. Saving merges your change with it.",
    "gemeinsam.konflikt.titel": "Conflict: the same place was changed differently",
    "gemeinsam.konflikt.erklaerung":
      "Nothing was overwritten. Choose for each place which version applies and put the choice into the text — then save.",
    "gemeinsam.konflikt.basis": "Before",
    "gemeinsam.konflikt.meine": "Your version",
    "gemeinsam.konflikt.deren": "Saved version by {{namen}}",
    "gemeinsam.konflikt.derenOhneName": "Saved version",
    "gemeinsam.konflikt.lesefassung": "Valid reading version",
    "gemeinsam.konflikt.nimmMeine": "Take mine",
    "gemeinsam.konflikt.nimmDeren": "Take saved",
    "gemeinsam.konflikt.beide": "Keep both",
    "gemeinsam.konflikt.stelle": "Place {{nr}}",
    "gemeinsam.konflikt.titelStelle": "Title",
    "gemeinsam.konflikt.leer": "(empty)",
    "gemeinsam.konflikt.uebernehmen": "Put the choice into the text",
    "gemeinsam.konflikt.offen": "{{anzahl}} place(s) still undecided.",
    "gemeinsam.angleich.titel": "The valid version has changed",
    "gemeinsam.angleich.satz":
      "The article is now at version {{version}}; the draft is based on version {{basis}}. Align the draft before adopting it — nothing is lost.",
    "gemeinsam.angleich.knopf": "Align draft with version {{version}}",
    "gemeinsam.angleich.konflikt":
      "The valid version was changed in the same places as the draft. Decide for each place.",
    "gemeinsam.angleich.loesung": "Save the resolution as draft on version {{version}}",
    "gemeinsam.uebernahme.titel": "Adopt",
    "gemeinsam.uebernahme.direkt": "Adopt as new version",
    "gemeinsam.uebernahme.direktSatz":
      "The new version is then visible to readers and is up for review again.",
    "gemeinsam.uebernahme.vorschlag": "Submit as change proposal",
    "gemeinsam.uebernahme.vorschlagSatz":
      "The approved version stays valid until someone else with approval rights adopts the proposal.",
    "gemeinsam.uebernahme.erstSpeichern": "Save first — only a saved working state is adopted.",
    "gemeinsam.uebernahme.titelNicht":
      "A change proposal cannot change the title. Reset the title or have someone with approval rights adopt the draft.",
    "gemeinsam.uebernahme.laeuft": "Adopting …",
    "gemeinsam.uebernahme.fehler": "Not adopted: {{grund}}",
    "gemeinsam.uebernahme.veraltet": "The valid version has changed in the meantime — align first.",
    "gemeinsam.uebernahme.weiter":
      "Working state {{revision}} was adopted. Changes saved after it stay in the draft and are not adopted yet.",
    "gemeinsam.abgeschlossen.uebernommen":
      "Last adopted as version {{fassung}} by {{name}}, {{zeit}}.",
    "gemeinsam.abgeschlossen.eingereicht":
      "Last submitted as change proposal by {{name}}, {{zeit}} — waiting for approval.",
    "gemeinsam.abgeschlossen.neu": "Start a new shared draft",
    "gemeinsam.verlauf.titel": "Draft history",
    "gemeinsam.verlauf.angelegt": "{{name}} started the draft",
    "gemeinsam.verlauf.gespeichert": "{{name}} saved",
    "gemeinsam.verlauf.zusammengefuehrt": "{{name}} saved (merged)",
    "gemeinsam.verlauf.angeglichen": "{{name}} aligned with version {{fassung}}",
    "gemeinsam.verlauf.uebernommen": "{{name}} adopted as version {{fassung}}",
    "gemeinsam.verlauf.eingereicht": "{{name}} submitted as change proposal",
    "gemeinsam.verlauf.zeile": "Working state {{revision}} · {{zeit}} · {{was}}",
    "gemeinsam.beteiligte": "Involved: {{namen}}",
    "gemeinsam.chat.oeffnen": "Edit together: {{titel}}",
    "gemeinsam.artikel.oeffnen": "Edit together",
  },
  nl: {
    "gemeinsam.seite.titel": "Samen bewerken",
    "gemeinsam.seite.lead":
      "Iedereen met rechten werkt hier aan dezelfde werkversie. Lezers zien de geldige versie tot het concept is overgenomen of vrijgegeven.",
    "gemeinsam.seite.laedt": "Laden …",
    "gemeinsam.seite.fehler": "Het gedeelde concept is nu niet bereikbaar.",
    "gemeinsam.seite.keinZugang":
      "Je kunt dit artikel niet bewerken. De geldige versie staat in het artikel.",
    "gemeinsam.zumArtikel": "Naar de geldige versie in het artikel",
    "gemeinsam.lesefassung.titel": "Geldige leesversie",
    "gemeinsam.lesefassung.satz":
      "Versie {{version}} · {{status}} — alle lezers zien deze versie tot het concept is overgenomen.",
    "gemeinsam.lesefassung.vorschlag":
      "Vrijgegeven artikel: het resultaat wordt als wijzigingsvoorstel ingediend. De vrijgegeven versie blijft geldig tot iemand anders met vrijgaverecht beslist.",
    "gemeinsam.status.validiert": "vrijgegeven",
    "gemeinsam.status.sonst": "nog niet vrijgegeven",
    "gemeinsam.entwurf.titel": "Gedeeld concept",
    "gemeinsam.entwurf.stand": "Werkstand {{revision}} op basis van versie {{version}}",
    "gemeinsam.entwurf.keiner": "Voor dit artikel is nog geen gedeeld concept open.",
    "gemeinsam.entwurf.oeffnen": "Gedeeld concept starten",
    "gemeinsam.entwurf.reich":
      "Dit artikel bevat afbeeldingen, tabellen of lijsten. Het gedeelde concept bewerkt alleen titel en alinea's — bewerk het artikel zelf.",
    "gemeinsam.feld.titel": "Titel",
    "gemeinsam.feld.text": "Tekst",
    "gemeinsam.feld.hinweis":
      "Scheid secties met een lege regel. Wijzigingen in verschillende secties worden bij het opslaan samengevoegd.",
    "gemeinsam.anwesend.titel": "Nu aanwezig",
    "gemeinsam.anwesend.du": "Jij",
    "gemeinsam.anwesend.niemand": "Behalve jij is er nu niemand in het concept.",
    "gemeinsam.anwesend.unbekannt": "Wie er nog meer is, is nu niet op te vragen.",
    "gemeinsam.speicher.gespeichert":
      "Opgeslagen — werkstand {{revision}}, {{zeit}}, door {{name}}",
    "gemeinsam.speicher.ungespeichert": "Niet-opgeslagen wijzigingen",
    "gemeinsam.speicher.laeuft": "Wordt opgeslagen …",
    "gemeinsam.speicher.unterbrochen":
      "Verbinding verbroken — niet opgeslagen. Je invoer blijft hier en na herladen in dit browservenster bewaard. Sla opnieuw op zodra de verbinding terug is.",
    "gemeinsam.speicher.ohneRecht":
      "Je mag dit artikel niet meer bewerken. Er is niets opgeslagen; je invoer blijft hier staan en kan worden gekopieerd.",
    "gemeinsam.speicher.konflikt": "Niet opgeslagen — conflict. Beslis hieronder per plek.",
    "gemeinsam.speicher.zusammengefuehrt":
      "Opgeslagen en samengevoegd met de wijzigingen van {{namen}} — werkstand {{revision}}",
    "gemeinsam.speicher.fehler": "Niet opgeslagen: {{grund}}",
    "gemeinsam.speicher.netz": "geen verbinding met de server",
    "gemeinsam.speichern": "Opslaan",
    "gemeinsam.kopieren": "Invoer kopiëren",
    "gemeinsam.kopiert": "Naar het klembord gekopieerd",
    "gemeinsam.wiederhergestellt":
      "Niet-opgeslagen invoer uit dit browservenster hersteld (gebaseerd op werkstand {{revision}}). Bij het opslaan wordt die met de huidige stand samengevoegd.",
    "gemeinsam.fremd.neu":
      "{{name}} heeft werkstand {{revision}} opgeslagen. Bij het opslaan wordt jouw wijziging daarmee samengevoegd.",
    "gemeinsam.konflikt.titel": "Conflict: dezelfde plek is verschillend gewijzigd",
    "gemeinsam.konflikt.erklaerung":
      "Er is niets overschreven. Kies per plek welke versie geldt en zet de keuze in de tekst — sla daarna op.",
    "gemeinsam.konflikt.basis": "Vooraf",
    "gemeinsam.konflikt.meine": "Jouw versie",
    "gemeinsam.konflikt.deren": "Opgeslagen versie van {{namen}}",
    "gemeinsam.konflikt.derenOhneName": "Opgeslagen versie",
    "gemeinsam.konflikt.lesefassung": "Geldige leesversie",
    "gemeinsam.konflikt.nimmMeine": "Mijne nemen",
    "gemeinsam.konflikt.nimmDeren": "Opgeslagene nemen",
    "gemeinsam.konflikt.beide": "Beide houden",
    "gemeinsam.konflikt.stelle": "Plek {{nr}}",
    "gemeinsam.konflikt.titelStelle": "Titel",
    "gemeinsam.konflikt.leer": "(leeg)",
    "gemeinsam.konflikt.uebernehmen": "Keuze in de tekst zetten",
    "gemeinsam.konflikt.offen": "Nog {{anzahl}} plek(ken) zonder beslissing.",
    "gemeinsam.angleich.titel": "De geldige versie is gewijzigd",
    "gemeinsam.angleich.satz":
      "Het artikel staat inmiddels op versie {{version}}; het concept is gebaseerd op versie {{basis}}. Breng het concept eerst in lijn voordat je het overneemt — er gaat niets verloren.",
    "gemeinsam.angleich.knopf": "Concept in lijn brengen met versie {{version}}",
    "gemeinsam.angleich.konflikt":
      "De geldige versie is op dezelfde plekken gewijzigd als het concept. Beslis per plek.",
    "gemeinsam.angleich.loesung": "Oplossing opslaan als concept op versie {{version}}",
    "gemeinsam.uebernahme.titel": "Overnemen",
    "gemeinsam.uebernahme.direkt": "Als nieuwe versie overnemen",
    "gemeinsam.uebernahme.direktSatz":
      "De nieuwe versie is daarna zichtbaar voor lezers en moet opnieuw worden gecontroleerd.",
    "gemeinsam.uebernahme.vorschlag": "Als wijzigingsvoorstel indienen",
    "gemeinsam.uebernahme.vorschlagSatz":
      "De vrijgegeven versie blijft geldig tot iemand anders met vrijgaverecht het voorstel overneemt.",
    "gemeinsam.uebernahme.erstSpeichern":
      "Eerst opslaan — alleen een opgeslagen werkstand wordt overgenomen.",
    "gemeinsam.uebernahme.titelNicht":
      "Een wijzigingsvoorstel kan de titel niet wijzigen. Zet de titel terug of laat iemand met vrijgaverecht het concept overnemen.",
    "gemeinsam.uebernahme.laeuft": "Wordt overgenomen …",
    "gemeinsam.uebernahme.fehler": "Niet overgenomen: {{grund}}",
    "gemeinsam.uebernahme.veraltet":
      "De geldige versie is inmiddels gewijzigd — eerst in lijn brengen.",
    "gemeinsam.uebernahme.weiter":
      "Werkstand {{revision}} is overgenomen. Daarna opgeslagen wijzigingen blijven in het concept en zijn nog niet overgenomen.",
    "gemeinsam.abgeschlossen.uebernommen":
      "Laatst overgenomen als versie {{fassung}} door {{name}}, {{zeit}}.",
    "gemeinsam.abgeschlossen.eingereicht":
      "Laatst ingediend als wijzigingsvoorstel door {{name}}, {{zeit}} — wacht op vrijgave.",
    "gemeinsam.abgeschlossen.neu": "Nieuw gedeeld concept starten",
    "gemeinsam.verlauf.titel": "Verloop van het concept",
    "gemeinsam.verlauf.angelegt": "{{name}} heeft het concept gestart",
    "gemeinsam.verlauf.gespeichert": "{{name}} heeft opgeslagen",
    "gemeinsam.verlauf.zusammengefuehrt": "{{name}} heeft opgeslagen (samengevoegd)",
    "gemeinsam.verlauf.angeglichen": "{{name}} heeft in lijn gebracht met versie {{fassung}}",
    "gemeinsam.verlauf.uebernommen": "{{name}} heeft overgenomen als versie {{fassung}}",
    "gemeinsam.verlauf.eingereicht": "{{name}} heeft ingediend als wijzigingsvoorstel",
    "gemeinsam.verlauf.zeile": "Werkstand {{revision}} · {{zeit}} · {{was}}",
    "gemeinsam.beteiligte": "Betrokken: {{namen}}",
    "gemeinsam.chat.oeffnen": "Samen bewerken: {{titel}}",
    "gemeinsam.artikel.oeffnen": "Samen bewerken",
  },
} satisfies Textmodul;
