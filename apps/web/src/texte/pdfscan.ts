// ================================================================================================
// OCR-E04 · GESCANNTE, MEHRSEITIGE PDF AUTOMATISCH LESEN — die Texte dieses Nutzerwegs.
// ================================================================================================
//
// Neu mit dem Auftrag produkt:20261012:klara-ocr-mehrseitige-scans. Verwendet in
// `components/PdfSeitenListe.tsx`, `components/BildBefundListe.tsx` (Fundstelle) und
// `lib/klaraBildKontext.ts` (Klaras Kontext).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "pdfscan.",
  legacySchluessel: [],
  de: {
    "pdfscan.titel": "Seiten automatisch gelesen",
    "pdfscan.quelle.laeuft": "Seiten von {{name}} werden gelesen … {{fertig}} von {{gesamt}}",
    "pdfscan.quelle.vollstaendig": "Alle {{gesamt}} Seiten von {{name}} gelesen.",
    "pdfscan.quelle.teilweise":
      "{{name}}: nur teilweise gelesen — {{fertig}} von {{gesamt}} Seiten gelesen.",
    "pdfscan.quelle.fehlgeschlagen": "{{name}}: Die Seiten konnten nicht gelesen werden.",
    "pdfscan.quelle.nichtVerfuegbar":
      "{{name}}: Die Texterkennung ist derzeit nicht verfügbar — die gescannten Seiten sind nicht gelesen.",
    "pdfscan.quelle.aus":
      "Automatisches Lesen ist ausgeschaltet — die gescannten Seiten von {{name}} sind nicht gelesen.",
    "pdfscan.fundstelle.seite": "Seite {{seite}}",
    "pdfscan.fundstelle.seiteErkannt": "Seite {{seite}}, erkannt",
    "pdfscan.teil.textebene": "Textebene",
    "pdfscan.teil.bild": "gescannte Seite",
    "pdfscan.doppelt":
      "{{anzahl}} erkannte Zeile(n) stehen schon in der Textebene dieser Seite und sind nicht wiederholt.",
    "pdfscan.hinweis.seitenFehlen":
      "Nur die ersten {{seiten}} Seiten werden gelesen — {{fehlend}} weitere Seite(n) fehlen.",
    "pdfscan.kontext.nurDoppelt":
      "erkannt, aber nur Text, der schon in der Textebene dieser Seite steht ({{anzahl}} Zeile(n), nicht wiederholt)",
    "pdfscan.leer":
      "In „{{name}}“ wurde auf keiner Seite Text gelesen — den Stand je Seite zeigt die Liste.",
    "pdfscan.teilweise":
      "{{name}}: nur {{fertig}} von {{gesamt}} Seiten gelesen — der Text der übrigen Seiten fehlt.",
  },
  en: {
    "pdfscan.titel": "Pages read automatically",
    "pdfscan.quelle.laeuft": "Reading the pages of {{name}} … {{fertig}} of {{gesamt}}",
    "pdfscan.quelle.vollstaendig": "All {{gesamt}} pages of {{name}} read.",
    "pdfscan.quelle.teilweise": "{{name}}: only partly read — {{fertig}} of {{gesamt}} pages read.",
    "pdfscan.quelle.fehlgeschlagen": "{{name}}: The pages could not be read.",
    "pdfscan.quelle.nichtVerfuegbar":
      "{{name}}: Text recognition is currently unavailable — the scanned pages have not been read.",
    "pdfscan.quelle.aus":
      "Automatic reading is switched off — the scanned pages of {{name}} have not been read.",
    "pdfscan.fundstelle.seite": "Page {{seite}}",
    "pdfscan.fundstelle.seiteErkannt": "Page {{seite}}, recognised",
    "pdfscan.teil.textebene": "text layer",
    "pdfscan.teil.bild": "scanned page",
    "pdfscan.doppelt":
      "{{anzahl}} recognised line(s) are already in this page's text layer and are not repeated.",
    "pdfscan.hinweis.seitenFehlen":
      "Only the first {{seiten}} pages are read — {{fehlend}} further page(s) are missing.",
    "pdfscan.kontext.nurDoppelt":
      "recognised, but only text that is already in this page's text layer ({{anzahl}} line(s), not repeated)",
    "pdfscan.leer":
      "No text was read on any page of “{{name}}” — the list shows the state per page.",
    "pdfscan.teilweise":
      "{{name}}: only {{fertig}} of {{gesamt}} pages read — the text of the other pages is missing.",
  },
  nl: {
    "pdfscan.titel": "Pagina's automatisch gelezen",
    "pdfscan.quelle.laeuft": "Pagina's van {{name}} worden gelezen … {{fertig}} van {{gesamt}}",
    "pdfscan.quelle.vollstaendig": "Alle {{gesamt}} pagina's van {{name}} gelezen.",
    "pdfscan.quelle.teilweise":
      "{{name}}: slechts gedeeltelijk gelezen — {{fertig}} van {{gesamt}} pagina's gelezen.",
    "pdfscan.quelle.fehlgeschlagen": "{{name}}: De pagina's konden niet worden gelezen.",
    "pdfscan.quelle.nichtVerfuegbar":
      "{{name}}: Tekstherkenning is momenteel niet beschikbaar — de gescande pagina's zijn niet gelezen.",
    "pdfscan.quelle.aus":
      "Automatisch lezen is uitgeschakeld — de gescande pagina's van {{name}} zijn niet gelezen.",
    "pdfscan.fundstelle.seite": "Pagina {{seite}}",
    "pdfscan.fundstelle.seiteErkannt": "Pagina {{seite}}, herkend",
    "pdfscan.teil.textebene": "tekstlaag",
    "pdfscan.teil.bild": "gescande pagina",
    "pdfscan.doppelt":
      "{{anzahl}} herkende regel(s) staan al in de tekstlaag van deze pagina en worden niet herhaald.",
    "pdfscan.hinweis.seitenFehlen":
      "Alleen de eerste {{seiten}} pagina's worden gelezen — {{fehlend}} verdere pagina('s) ontbreken.",
    "pdfscan.kontext.nurDoppelt":
      "herkend, maar alleen tekst die al in de tekstlaag van deze pagina staat ({{anzahl}} regel(s), niet herhaald)",
    "pdfscan.leer":
      "In “{{name}}” is op geen enkele pagina tekst gelezen — de lijst toont de stand per pagina.",
    "pdfscan.teilweise":
      "{{name}}: slechts {{fertig}} van {{gesamt}} pagina's gelezen — de tekst van de overige pagina's ontbreekt.",
  },
} satisfies Textmodul;
