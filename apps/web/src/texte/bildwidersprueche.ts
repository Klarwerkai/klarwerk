// ================================================================================================
// OCR-E05 · MÖGLICHE ABWEICHUNGEN ZWISCHEN BILDTEXT UND DOKUMENTTEXT — die Texte.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-ocr-widersprueche. Verwendet in
// `components/BildWidersprueche.tsx` (Anzeige) und `lib/bildWidersprueche.ts` (Fundstellen, Zusatz
// zur Anweisung an Klara).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bildwidersprueche.",
  legacySchluessel: [],
  de: {
    "bildwidersprueche.titel": "Mögliche Abweichungen zwischen Text und Bildern",
    "bildwidersprueche.erklaerung":
      "Klara vergleicht Beträge, Zahlen, Datums- und Namensangaben zum selben Sachverhalt. Andere Zeiträume, Versionen oder Einheiten gelten nicht als Abweichung. Klara entscheidet nicht, welche Angabe stimmt – beide bleiben unverändert. Bitte am Original prüfen.",
    "bildwidersprueche.art.moeglich": "Mögliche Abweichung",
    "bildwidersprueche.art.unsicher": "Unsichere Erkennung – kein belegter Widerspruch",
    "bildwidersprueche.beschreibung.moeglich":
      "Zu „{{sachverhalt}}“ steht im Text {{text}}, im Bild {{bild}}. Die Angaben weichen voneinander ab; welche stimmt, lässt sich daraus nicht sagen.",
    "bildwidersprueche.beschreibung.unsicher":
      "Zu „{{sachverhalt}}“ steht im Text {{text}}. Im Bild ist der Wert nur unsicher erkannt ({{bild}}). Das ist kein belegter Widerspruch – bitte die Erkennung am Bild prüfen und bei Bedarf berichtigen.",
    "bildwidersprueche.seite.text": "Im Text",
    "bildwidersprueche.seite.bild": "Im Bild",
    "bildwidersprueche.wert.unsicher": "unsicher gelesen",
    "bildwidersprueche.ort.text": "Text, Absatz {{absatz}}, Satz {{satz}}",
    "bildwidersprueche.ort.bild": "{{quelle}} · {{ort}}, Zeile {{zeile}}",
    "bildwidersprueche.anweisung.kopf":
      "Text und Bilder nennen zum selben Sachverhalt abweichende Angaben. Geht es in deiner Antwort darum, nenne beide Angaben mit ihrer Fundstelle und entscheide nicht ohne Beleg, welche stimmt:",
    "bildwidersprueche.anweisung.stelle":
      "„{{sachverhalt}}“: {{text}} ({{textOrt}}) gegenüber {{bild}} ([{{bildOrt}}]).",
    "bildwidersprueche.anweisung.unsicher":
      "„{{sachverhalt}}“: {{text}} ({{textOrt}}) gegenüber unsicher gelesenem {{bild}} ([{{bildOrt}}]) – keine belegte Abweichung.",
  },
  en: {
    "bildwidersprueche.titel": "Possible differences between text and images",
    "bildwidersprueche.erklaerung":
      "Klara compares amounts, numbers, dates and names for the same matter. Other periods, versions or units do not count as a difference. Klara does not decide which value is correct – both remain unchanged. Please check against the original.",
    "bildwidersprueche.art.moeglich": "Possible difference",
    "bildwidersprueche.art.unsicher": "Uncertain recognition – no proven contradiction",
    "bildwidersprueche.beschreibung.moeglich":
      "For “{{sachverhalt}}” the text says {{text}}, the image says {{bild}}. The values differ; which one is correct cannot be told from this.",
    "bildwidersprueche.beschreibung.unsicher":
      "For “{{sachverhalt}}” the text says {{text}}. In the image the value was only recognised with uncertainty ({{bild}}). This is no proven contradiction – please check the recognition against the image and correct it if needed.",
    "bildwidersprueche.seite.text": "In the text",
    "bildwidersprueche.seite.bild": "In the image",
    "bildwidersprueche.wert.unsicher": "read with uncertainty",
    "bildwidersprueche.ort.text": "Text, paragraph {{absatz}}, sentence {{satz}}",
    "bildwidersprueche.ort.bild": "{{quelle}} · {{ort}}, line {{zeile}}",
    "bildwidersprueche.anweisung.kopf":
      "Text and images give different values for the same matter. If your answer concerns it, name both values with their location and do not decide without evidence which one is correct:",
    "bildwidersprueche.anweisung.stelle":
      "“{{sachverhalt}}”: {{text}} ({{textOrt}}) versus {{bild}} ([{{bildOrt}}]).",
    "bildwidersprueche.anweisung.unsicher":
      "“{{sachverhalt}}”: {{text}} ({{textOrt}}) versus uncertainly read {{bild}} ([{{bildOrt}}]) – no proven difference.",
  },
  nl: {
    "bildwidersprueche.titel": "Mogelijke verschillen tussen tekst en afbeeldingen",
    "bildwidersprueche.erklaerung":
      "Klara vergelijkt bedragen, getallen, datums en namen bij hetzelfde onderwerp. Andere perioden, versies of eenheden gelden niet als verschil. Klara beslist niet welke waarde klopt – beide blijven ongewijzigd. Controleer het origineel.",
    "bildwidersprueche.art.moeglich": "Mogelijk verschil",
    "bildwidersprueche.art.unsicher": "Onzekere herkenning – geen aangetoonde tegenspraak",
    "bildwidersprueche.beschreibung.moeglich":
      "Bij „{{sachverhalt}}” staat in de tekst {{text}}, in de afbeelding {{bild}}. De waarden verschillen; welke klopt, valt hieruit niet af te leiden.",
    "bildwidersprueche.beschreibung.unsicher":
      "Bij „{{sachverhalt}}” staat in de tekst {{text}}. In de afbeelding is de waarde alleen onzeker herkend ({{bild}}). Dit is geen aangetoonde tegenspraak – controleer de herkenning in de afbeelding en corrigeer die zo nodig.",
    "bildwidersprueche.seite.text": "In de tekst",
    "bildwidersprueche.seite.bild": "In de afbeelding",
    "bildwidersprueche.wert.unsicher": "onzeker gelezen",
    "bildwidersprueche.ort.text": "Tekst, alinea {{absatz}}, zin {{satz}}",
    "bildwidersprueche.ort.bild": "{{quelle}} · {{ort}}, regel {{zeile}}",
    "bildwidersprueche.anweisung.kopf":
      "Tekst en afbeeldingen noemen voor hetzelfde onderwerp verschillende waarden. Gaat je antwoord daarover, noem dan beide waarden met hun vindplaats en beslis niet zonder bewijs welke klopt:",
    "bildwidersprueche.anweisung.stelle":
      "„{{sachverhalt}}”: {{text}} ({{textOrt}}) tegenover {{bild}} ([{{bildOrt}}]).",
    "bildwidersprueche.anweisung.unsicher":
      "„{{sachverhalt}}”: {{text}} ({{textOrt}}) tegenover onzeker gelezen {{bild}} ([{{bildOrt}}]) – geen aangetoond verschil.",
  },
} satisfies Textmodul;
