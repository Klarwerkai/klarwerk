// ================================================================================================
// OCR-02 · BILDER AUTOMATISCH LESEN — die Texte dieses Nutzerwegs.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-bildanalyse-ocr-automatik. Verwendet in
// `components/BildBefundListe.tsx` und an den Bildanhängen in `pages/Capture.tsx`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "bildautomatik.",
  legacySchluessel: [],
  de: {
    "bildautomatik.titel": "Bilder automatisch gelesen",
    "bildautomatik.quelle.laeuft": "Bilder in {{name}} werden gelesen … {{fertig}} von {{gesamt}}",
    "bildautomatik.quelle.vollstaendig": "Alle Bilder in {{name}} gelesen ({{gesamt}}).",
    "bildautomatik.quelle.teilweise":
      "{{name}}: nur teilweise gelesen — {{fertig}} von {{gesamt}} Bildern gelesen.",
    "bildautomatik.quelle.fehlgeschlagen": "{{name}}: Die Bilder konnten nicht gelesen werden.",
    "bildautomatik.quelle.nichtVerfuegbar":
      "{{name}}: Die Texterkennung ist derzeit nicht verfügbar — die Bilder sind nicht gelesen.",
    "bildautomatik.quelle.aus":
      "Automatisches Lesen ist ausgeschaltet — die Bilder in {{name}} sind nicht gelesen.",
    "bildautomatik.hinweis.nichtGelesenFolie":
      "Folie {{folie}}: nicht übernommene Bilder: {{anzahl}} — nicht gelesen.",
    "bildautomatik.hinweis.nichtGelesen": "Nicht übernommene Bilder: {{anzahl}} — nicht gelesen.",
    "bildautomatik.hinweis.pptxLayout":
      "Bilder aus Folienlayout, Master, Diagrammen, SmartArt und Notizen werden nicht erfasst.",
    "bildautomatik.hinweis.grenze": "Automatisch gelesen werden höchstens {{max}} Bilder je Datei.",
    "bildautomatik.fundstelle.folie": "Folie {{folie}}, Bild {{bild}}",
    "bildautomatik.fundstelle.folienansicht": "Folienansicht, Folie {{folie}}",
    "bildautomatik.fundstelle.bild": "Bild {{bild}}",
    "bildautomatik.status.wartet": "wartet",
    "bildautomatik.status.laeuft": "wird gelesen …",
    "bildautomatik.status.gelesen": "Text erkannt",
    "bildautomatik.status.keinText": "kein Text erkannt",
    "bildautomatik.status.fehlgeschlagen": "Lesen fehlgeschlagen",
    "bildautomatik.status.nichtVerfuegbar": "Texterkennung nicht verfügbar",
    "bildautomatik.status.keinZugriff": "kein Zugriff auf das Bild",
    "bildautomatik.status.zeitueberschreitung": "Zeitüberschreitung — nicht gelesen",
    "bildautomatik.status.nichtAnalysiert": "nicht gelesen",
    "bildautomatik.unsicher":
      "Unsichere Stellen: {{n}}. [?…] ist unsicher gelesen, [unleserlich] war nicht lesbar.",
    "bildautomatik.wiederverwendet": "unverändert — vorhandenes Ergebnis",
  },
  en: {
    "bildautomatik.titel": "Images read automatically",
    "bildautomatik.quelle.laeuft": "Reading images in {{name}} … {{fertig}} of {{gesamt}}",
    "bildautomatik.quelle.vollstaendig": "All images in {{name}} read ({{gesamt}}).",
    "bildautomatik.quelle.teilweise":
      "{{name}}: only partly read — {{fertig}} of {{gesamt}} images read.",
    "bildautomatik.quelle.fehlgeschlagen": "{{name}}: The images could not be read.",
    "bildautomatik.quelle.nichtVerfuegbar":
      "{{name}}: Text recognition is currently unavailable — the images have not been read.",
    "bildautomatik.quelle.aus":
      "Automatic reading is switched off — the images in {{name}} have not been read.",
    "bildautomatik.hinweis.nichtGelesenFolie":
      "Slide {{folie}}: images not imported: {{anzahl}} — not read.",
    "bildautomatik.hinweis.nichtGelesen": "Images not imported: {{anzahl}} — not read.",
    "bildautomatik.hinweis.pptxLayout":
      "Images from slide layouts, masters, charts, SmartArt and notes are not captured.",
    "bildautomatik.hinweis.grenze": "At most {{max}} images per file are read automatically.",
    "bildautomatik.fundstelle.folie": "Slide {{folie}}, image {{bild}}",
    "bildautomatik.fundstelle.folienansicht": "Slide view, slide {{folie}}",
    "bildautomatik.fundstelle.bild": "Image {{bild}}",
    "bildautomatik.status.wartet": "waiting",
    "bildautomatik.status.laeuft": "reading …",
    "bildautomatik.status.gelesen": "text recognised",
    "bildautomatik.status.keinText": "no text recognised",
    "bildautomatik.status.fehlgeschlagen": "reading failed",
    "bildautomatik.status.nichtVerfuegbar": "text recognition unavailable",
    "bildautomatik.status.keinZugriff": "no access to the image",
    "bildautomatik.status.zeitueberschreitung": "timed out — not read",
    "bildautomatik.status.nichtAnalysiert": "not read",
    "bildautomatik.unsicher":
      "Uncertain passages: {{n}}. [?…] was read with uncertainty, [unleserlich] was illegible.",
    "bildautomatik.wiederverwendet": "unchanged — existing result",
  },
  nl: {
    "bildautomatik.titel": "Afbeeldingen automatisch gelezen",
    "bildautomatik.quelle.laeuft":
      "Afbeeldingen in {{name}} worden gelezen … {{fertig}} van {{gesamt}}",
    "bildautomatik.quelle.vollstaendig": "Alle afbeeldingen in {{name}} gelezen ({{gesamt}}).",
    "bildautomatik.quelle.teilweise":
      "{{name}}: slechts gedeeltelijk gelezen — {{fertig}} van {{gesamt}} afbeeldingen gelezen.",
    "bildautomatik.quelle.fehlgeschlagen": "{{name}}: De afbeeldingen konden niet worden gelezen.",
    "bildautomatik.quelle.nichtVerfuegbar":
      "{{name}}: Tekstherkenning is momenteel niet beschikbaar — de afbeeldingen zijn niet gelezen.",
    "bildautomatik.quelle.aus":
      "Automatisch lezen is uitgeschakeld — de afbeeldingen in {{name}} zijn niet gelezen.",
    "bildautomatik.hinweis.nichtGelesenFolie":
      "Dia {{folie}}: niet overgenomen afbeeldingen: {{anzahl}} — niet gelezen.",
    "bildautomatik.hinweis.nichtGelesen":
      "Niet overgenomen afbeeldingen: {{anzahl}} — niet gelezen.",
    "bildautomatik.hinweis.pptxLayout":
      "Afbeeldingen uit dia-indelingen, modellen, grafieken, SmartArt en notities worden niet vastgelegd.",
    "bildautomatik.hinweis.grenze":
      "Per bestand worden hoogstens {{max}} afbeeldingen automatisch gelezen.",
    "bildautomatik.fundstelle.folie": "Dia {{folie}}, afbeelding {{bild}}",
    "bildautomatik.fundstelle.folienansicht": "Dia-weergave, dia {{folie}}",
    "bildautomatik.fundstelle.bild": "Afbeelding {{bild}}",
    "bildautomatik.status.wartet": "wacht",
    "bildautomatik.status.laeuft": "wordt gelezen …",
    "bildautomatik.status.gelesen": "tekst herkend",
    "bildautomatik.status.keinText": "geen tekst herkend",
    "bildautomatik.status.fehlgeschlagen": "lezen mislukt",
    "bildautomatik.status.nichtVerfuegbar": "tekstherkenning niet beschikbaar",
    "bildautomatik.status.keinZugriff": "geen toegang tot de afbeelding",
    "bildautomatik.status.zeitueberschreitung": "tijdslimiet overschreden — niet gelezen",
    "bildautomatik.status.nichtAnalysiert": "niet gelezen",
    "bildautomatik.unsicher":
      "Onzekere plaatsen: {{n}}. [?…] is onzeker gelezen, [unleserlich] was onleesbaar.",
    "bildautomatik.wiederverwendet": "ongewijzigd — bestaand resultaat",
  },
} satisfies Textmodul;
