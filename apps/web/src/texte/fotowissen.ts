// ================================================================================================
// FOTO-ZU-WISSEN (R-1624) · DIE TEXTE DIESES NUTZERWEGS — bei ihrer Funktion, nicht im Sammelbuch.
// ================================================================================================
//
// Der Auftrag „Wissen aus Fotos mit kontextbezogenen Rückfragen erfassen" bringt diese Sätze mit.
// Sie sind NEU, deshalb tragen sie das Präfix `fotowissen.` (Vertrag in `./intern/pruefung.ts`)
// und keine Ausnahme in `legacySchluessel`. Verwendet in `components/FotoInterviewStart.tsx` und
// im Interview-Arbeitsraum von `pages/Capture.tsx`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fotowissen.",
  legacySchluessel: [],
  de: {
    "fotowissen.titel": "Mit Foto starten",
    "fotowissen.lead":
      "Fotografiere einen Schaden, eine Schweißnaht oder ein Bauteil. KLARWERK beschreibt, was auf dem Bild zu sehen ist, und fragt dich dann gezielt nach Fehler, Ursache und Lösung. Das Foto geht erst mit „Bild auswerten“ an das Modell.",
    "fotowissen.waehlen": "Foto aufnehmen oder wählen",
    "fotowissen.anderes": "Anderes Foto",
    "fotowissen.auswerten": "Bild auswerten",
    "fotowissen.auswertenLaeuft": "Bild wird ausgewertet …",
    "fotowissen.befund": "Auf dem Bild erkannt — prüfe und korrigiere bei Bedarf",
    "fotowissen.befundKi": "KI-Vorschlag",
    "fotowissen.befundOhneKi":
      "Kein KI-Bildbefund verfügbar. Beschreibe kurz selbst, was auf dem Foto zu sehen ist (Maschine, Bauteil) — die Rückfragen folgen danach genauso.",
    "fotowissen.befundFehler":
      "Das Foto konnte nicht ausgewertet werden. Beschreibe kurz selbst, was darauf zu sehen ist.",
    "fotowissen.bildFehler": "Das Foto konnte nicht gelesen werden. Bitte ein anderes wählen.",
    "fotowissen.starten": "Foto-Interview starten",
    "fotowissen.laeuft": "Foto-Interview",
    "fotowissen.vorschau": "Gewähltes Foto",
  },
  en: {
    "fotowissen.titel": "Start with a photo",
    "fotowissen.lead":
      "Take a photo of a damage, a weld seam or a component. KLARWERK describes what can be seen in the picture and then asks you specifically about fault, cause and solution. The photo is only sent to the model when you click “Analyse image”.",
    "fotowissen.waehlen": "Take or choose a photo",
    "fotowissen.anderes": "Different photo",
    "fotowissen.auswerten": "Analyse image",
    "fotowissen.auswertenLaeuft": "Analysing image …",
    "fotowissen.befund": "Recognised in the image — check and correct if needed",
    "fotowissen.befundKi": "AI suggestion",
    "fotowissen.befundOhneKi":
      "No AI image finding available. Briefly describe yourself what the photo shows (machine, component) — the follow-up questions work the same way afterwards.",
    "fotowissen.befundFehler":
      "The photo could not be analysed. Briefly describe yourself what it shows.",
    "fotowissen.bildFehler": "The photo could not be read. Please choose another one.",
    "fotowissen.starten": "Start photo interview",
    "fotowissen.laeuft": "Photo interview",
    "fotowissen.vorschau": "Selected photo",
  },
  nl: {
    "fotowissen.titel": "Met een foto beginnen",
    "fotowissen.lead":
      "Fotografeer een schade, een lasnaad of een onderdeel. KLARWERK beschrijft wat er op de foto te zien is en vraagt je daarna gericht naar fout, oorzaak en oplossing. De foto gaat pas met „Beeld analyseren“ naar het model.",
    "fotowissen.waehlen": "Foto maken of kiezen",
    "fotowissen.anderes": "Andere foto",
    "fotowissen.auswerten": "Beeld analyseren",
    "fotowissen.auswertenLaeuft": "Beeld wordt geanalyseerd …",
    "fotowissen.befund": "Herkend op de foto — controleer en corrigeer indien nodig",
    "fotowissen.befundKi": "AI-voorstel",
    "fotowissen.befundOhneKi":
      "Geen AI-beeldbevinding beschikbaar. Beschrijf kort zelf wat er op de foto te zien is (machine, onderdeel) — de vervolgvragen werken daarna hetzelfde.",
    "fotowissen.befundFehler":
      "De foto kon niet worden geanalyseerd. Beschrijf kort zelf wat erop te zien is.",
    "fotowissen.bildFehler": "De foto kon niet worden gelezen. Kies een andere.",
    "fotowissen.starten": "Foto-interview starten",
    "fotowissen.laeuft": "Foto-interview",
    "fotowissen.vorschau": "Gekozen foto",
  },
} satisfies Textmodul;
