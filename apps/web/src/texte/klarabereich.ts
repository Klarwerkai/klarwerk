// ================================================================================================
// OCR-E06 · „KLARA, WAS STEHT HIER?“ — ausgewähltes Bild oder Bereich gezielt erklären; die Texte.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-ocr-bereichsfrage. Verwendet in
// `components/KlaraBereichsfrage.tsx` (Auswahl, Antwort) und `lib/klaraBereich.ts` (Kontext an Klara).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarabereich.",
  legacySchluessel: [],
  de: {
    "klarabereich.titel": "Klara, was steht hier?",
    "klarabereich.erklaerung":
      "Wähle ein Bild und bei Bedarf einen Bereich darin. Klara nutzt nur diese Auswahl: den erkannten Text und, wenn möglich, eine kurze Erklärung. Nachfragen bleiben bei derselben Auswahl.",
    "klarabereich.host":
      "Ausgewählt wird hier in der Bildvorschau von Klarwerk. In Word oder PowerPoint selbst ist keine Bild- oder Bereichsauswahl an Klara angebunden; Bilder von dort kommen über den Dateiimport, den Text im Editor oder den Office-Anhang hierher.",
    "klarabereich.bild.waehlen": "{{ort}} auswählen",
    "klarabereich.bild.ohneVorschau": "{{ort}}: keine Bildvorschau vorhanden – nicht auswählbar.",
    "klarabereich.auswahl.ganz": "Ausgewählt: {{ort}} (ganzes Bild)",
    "klarabereich.auswahl.bereich":
      "Ausgewählt: {{ort}}, Bereich {{x0}}–{{x1}} × {{y0}}–{{y1}} Pixel",
    "klarabereich.vorschau.label":
      "Vorschau von {{ort}} – mit gedrückter Maustaste oder dem Finger einen Bereich aufziehen",
    "klarabereich.vorschau.laedt": "Bildvorschau wird geladen …",
    "klarabereich.knopf.ganz": "Ganzes Bild",
    "klarabereich.knopf.wasStehtHier": "Was steht hier?",
    "klarabereich.knopf.nachfragen": "Nachfragen",
    "klarabereich.knopf.aufheben": "Auswahl aufheben",
    "klarabereich.nachfrage.label": "Nachfrage zu dieser Auswahl",
    "klarabereich.nachfrage.platzhalter": "Nachfrage – bezieht sich auf dieselbe Auswahl",
    "klarabereich.laeuft.lesen": "Klara liest die Auswahl …",
    "klarabereich.laeuft.antwort": "Klara erklärt …",
    "klarabereich.text.titel": "Erkannter Text in der Auswahl",
    "klarabereich.status.leer": "In der Auswahl wurde kein Text erkannt.",
    "klarabereich.status.unleserlich":
      "In der Auswahl stehen nur Zeichen, die nicht lesbar sind – Klara gibt dafür keinen Text aus.",
    "klarabereich.status.ohnePositionen":
      "Für dieses Bild liegen keine Positionen der erkannten Wörter vor. Ein Bereich lässt sich deshalb nicht bestimmen – wähle das ganze Bild.",
    "klarabereich.status.nichtGelesen": "Das Bild ist nicht gelesen: {{status}}.",
    "klarabereich.unsicher": "{{n}} Stelle(n) unsicher erkannt – gekennzeichnet, nicht ergänzt.",
    "klarabereich.herkunft.wiederverwendet": "Aus der vorhandenen Bildanalyse übernommen.",
    "klarabereich.herkunft.gelesen": "Für diese Auswahl gezielt gelesen (nur dieses Bild).",
    "klarabereich.antwort.titel": "Erklärung von Klara",
    "klarabereich.antwort.ohneModell":
      "Für eine Erklärung ist hier gerade kein Modell verfügbar. Der erkannte Text der Auswahl steht oben.",
    "klarabereich.antwort.keinText":
      "Ohne lesbaren Text in der Auswahl gibt Klara keine Erklärung ab.",
    "klarabereich.antwort.fehler": "Klara konnte nicht antworten: {{grund}}",
    "klarabereich.ort.bereich": "{{ort}}, ausgewählter Bereich",
    "klarabereich.kontext.kopf": "--- Ausgewählt: [{{ort}}] – ausschließlich dieser Inhalt ---",
    "klarabereich.kontext.text": "Erkannter Text",
    "klarabereich.kontext.inhalt": "Bildinhalt",
    "klarabereich.kontext.verlauf": "--- Bisherige Fragen zu dieser Auswahl ---",
    "klarabereich.kontext.frage": "Frage",
    "klarabereich.kontext.antwort": "Antwort",
    "klarabereich.anweisung.frage":
      "Beziehe dich ausschließlich auf die Auswahl [{{ort}}]. Frage: {{frage}} Gib wieder, was dort steht, und erkläre es kurz, soweit es nötig ist.",
    "klarabereich.anweisung.grenze":
      "Verwende nichts außerhalb dieser Auswahl und erfinde nichts. [?…] ist unsicher gelesen, [unleserlich] war nicht lesbar: ergänze dort nichts und sage das.",
  },
  en: {
    "klarabereich.titel": "Klara, what does it say here?",
    "klarabereich.erklaerung":
      "Choose an image and, if needed, an area within it. Klara uses only this selection: the recognised text and, where possible, a short explanation. Follow-up questions stay with the same selection.",
    "klarabereich.host":
      "The selection is made here in Klarwerk's image preview. In Word or PowerPoint itself, no image or area selection is connected to Klara; images from there arrive via file import, the text in the editor or the Office attachment.",
    "klarabereich.bild.waehlen": "Select {{ort}}",
    "klarabereich.bild.ohneVorschau": "{{ort}}: no image preview available – cannot be selected.",
    "klarabereich.auswahl.ganz": "Selected: {{ort}} (whole image)",
    "klarabereich.auswahl.bereich": "Selected: {{ort}}, area {{x0}}–{{x1}} × {{y0}}–{{y1}} pixels",
    "klarabereich.vorschau.label":
      "Preview of {{ort}} – drag with the mouse button held down or with your finger to mark an area",
    "klarabereich.vorschau.laedt": "Loading image preview …",
    "klarabereich.knopf.ganz": "Whole image",
    "klarabereich.knopf.wasStehtHier": "What does it say here?",
    "klarabereich.knopf.nachfragen": "Ask again",
    "klarabereich.knopf.aufheben": "Clear selection",
    "klarabereich.nachfrage.label": "Follow-up question about this selection",
    "klarabereich.nachfrage.platzhalter": "Follow-up – refers to the same selection",
    "klarabereich.laeuft.lesen": "Klara is reading the selection …",
    "klarabereich.laeuft.antwort": "Klara is explaining …",
    "klarabereich.text.titel": "Recognised text in the selection",
    "klarabereich.status.leer": "No text was recognised in the selection.",
    "klarabereich.status.unleserlich":
      "The selection only contains illegible characters – Klara does not output any text for them.",
    "klarabereich.status.ohnePositionen":
      "There are no positions for the recognised words of this image. An area can therefore not be determined – select the whole image.",
    "klarabereich.status.nichtGelesen": "The image has not been read: {{status}}.",
    "klarabereich.unsicher":
      "{{n}} passage(s) recognised with uncertainty – marked, not filled in.",
    "klarabereich.herkunft.wiederverwendet": "Taken from the existing image analysis.",
    "klarabereich.herkunft.gelesen": "Read specifically for this selection (this image only).",
    "klarabereich.antwort.titel": "Explanation from Klara",
    "klarabereich.antwort.ohneModell":
      "No model is currently available here for an explanation. The recognised text of the selection is shown above.",
    "klarabereich.antwort.keinText":
      "Without legible text in the selection, Klara does not give an explanation.",
    "klarabereich.antwort.fehler": "Klara could not answer: {{grund}}",
    "klarabereich.ort.bereich": "{{ort}}, selected area",
    "klarabereich.kontext.kopf": "--- Selected: [{{ort}}] – this content only ---",
    "klarabereich.kontext.text": "Recognised text",
    "klarabereich.kontext.inhalt": "Image content",
    "klarabereich.kontext.verlauf": "--- Previous questions about this selection ---",
    "klarabereich.kontext.frage": "Question",
    "klarabereich.kontext.antwort": "Answer",
    "klarabereich.anweisung.frage":
      "Refer only to the selection [{{ort}}]. Question: {{frage}} Reproduce what it says there and explain it briefly where necessary.",
    "klarabereich.anweisung.grenze":
      "Do not use anything outside this selection and do not invent anything. [?…] was read with uncertainty, [unleserlich] was illegible: do not fill these in and say so.",
  },
  nl: {
    "klarabereich.titel": "Klara, wat staat hier?",
    "klarabereich.erklaerung":
      "Kies een afbeelding en zo nodig een gebied daarin. Klara gebruikt alleen deze selectie: de herkende tekst en, waar mogelijk, een korte uitleg. Vervolgvragen blijven bij dezelfde selectie.",
    "klarabereich.host":
      "De selectie gebeurt hier in de afbeeldingsvoorvertoning van Klarwerk. In Word of PowerPoint zelf is geen afbeeldings- of gebiedsselectie aan Klara gekoppeld; afbeeldingen van daar komen via de bestandsimport, de tekst in de editor of de Office-bijlage hier.",
    "klarabereich.bild.waehlen": "{{ort}} selecteren",
    "klarabereich.bild.ohneVorschau":
      "{{ort}}: geen afbeeldingsvoorvertoning beschikbaar – niet selecteerbaar.",
    "klarabereich.auswahl.ganz": "Geselecteerd: {{ort}} (hele afbeelding)",
    "klarabereich.auswahl.bereich":
      "Geselecteerd: {{ort}}, gebied {{x0}}–{{x1}} × {{y0}}–{{y1}} pixels",
    "klarabereich.vorschau.label":
      "Voorvertoning van {{ort}} – met ingedrukte muisknop of met je vinger een gebied trekken",
    "klarabereich.vorschau.laedt": "Afbeeldingsvoorvertoning wordt geladen …",
    "klarabereich.knopf.ganz": "Hele afbeelding",
    "klarabereich.knopf.wasStehtHier": "Wat staat hier?",
    "klarabereich.knopf.nachfragen": "Doorvragen",
    "klarabereich.knopf.aufheben": "Selectie opheffen",
    "klarabereich.nachfrage.label": "Vervolgvraag over deze selectie",
    "klarabereich.nachfrage.platzhalter": "Vervolgvraag – gaat over dezelfde selectie",
    "klarabereich.laeuft.lesen": "Klara leest de selectie …",
    "klarabereich.laeuft.antwort": "Klara legt uit …",
    "klarabereich.text.titel": "Herkende tekst in de selectie",
    "klarabereich.status.leer": "In de selectie is geen tekst herkend.",
    "klarabereich.status.unleserlich":
      "De selectie bevat alleen onleesbare tekens – Klara geeft daarvoor geen tekst.",
    "klarabereich.status.ohnePositionen":
      "Voor deze afbeelding zijn geen posities van de herkende woorden beschikbaar. Een gebied is daarom niet te bepalen – kies de hele afbeelding.",
    "klarabereich.status.nichtGelesen": "De afbeelding is niet gelezen: {{status}}.",
    "klarabereich.unsicher": "{{n}} plaats(en) onzeker herkend – gemarkeerd, niet aangevuld.",
    "klarabereich.herkunft.wiederverwendet": "Overgenomen uit de bestaande beeldanalyse.",
    "klarabereich.herkunft.gelesen": "Gericht gelezen voor deze selectie (alleen deze afbeelding).",
    "klarabereich.antwort.titel": "Uitleg van Klara",
    "klarabereich.antwort.ohneModell":
      "Voor een uitleg is hier nu geen model beschikbaar. De herkende tekst van de selectie staat hierboven.",
    "klarabereich.antwort.keinText":
      "Zonder leesbare tekst in de selectie geeft Klara geen uitleg.",
    "klarabereich.antwort.fehler": "Klara kon niet antwoorden: {{grund}}",
    "klarabereich.ort.bereich": "{{ort}}, geselecteerd gebied",
    "klarabereich.kontext.kopf": "--- Geselecteerd: [{{ort}}] – uitsluitend deze inhoud ---",
    "klarabereich.kontext.text": "Herkende tekst",
    "klarabereich.kontext.inhalt": "Beeldinhoud",
    "klarabereich.kontext.verlauf": "--- Eerdere vragen over deze selectie ---",
    "klarabereich.kontext.frage": "Vraag",
    "klarabereich.kontext.antwort": "Antwoord",
    "klarabereich.anweisung.frage":
      "Ga uitsluitend uit van de selectie [{{ort}}]. Vraag: {{frage}} Geef weer wat daar staat en leg het kort uit voor zover nodig.",
    "klarabereich.anweisung.grenze":
      "Gebruik niets buiten deze selectie en verzin niets. [?…] is onzeker gelezen, [unleserlich] was onleesbaar: vul daar niets aan en zeg dat.",
  },
} satisfies Textmodul;
