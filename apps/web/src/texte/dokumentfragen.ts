// ================================================================================================
// R-0347 · FRAGEN AN EIN HOCHGELADENES DOKUMENT — die Texte der Fläche `/fragen/dokument`.
// ================================================================================================
//
// Die Sätze tragen die Ehrlichkeitsregeln aus EF-6 mit: wörtliche Stellen statt Behauptung, die
// Lücke als Lücke, und das Dokument als Arbeitsmaterial, das dieses Gerät nicht verlässt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "dokumentfragen.",
  legacySchluessel: [],
  de: {
    "dokumentfragen.kicker": "Fragen",
    "dokumentfragen.titel": "Fragen an ein Dokument",
    "dokumentfragen.lead":
      "Lade ein Dokument hoch und stelle Fragen dazu. Die Antwort führt die passenden Stellen zusammen und zeigt, wo sie im Dokument stehen.",
    "dokumentfragen.datenschutz":
      "Das Dokument bleibt auf diesem Gerät: Es wird nicht gespeichert, nicht in den Wissensbestand übernommen und an kein KI-Modell geschickt.",
    "dokumentfragen.zurueck": "Zurück zu Fragen an den Wissensbestand",
    "dokumentfragen.dateiWaehlen": "Dokument wählen",
    "dokumentfragen.formate": "PDF, Word (.docx), Text oder Markdown",
    "dokumentfragen.liest": "„{{name}}“ wird gelesen …",
    "dokumentfragen.geladen": "„{{name}}“ · Fundstellen: {{anzahl}}",
    "dokumentfragen.gekuerzt":
      "Das PDF hat mehr Seiten, als gelesen wurden. Fragen beziehen sich nur auf die ersten {{seiten}} Seiten.",
    "dokumentfragen.anderesDokument": "Anderes Dokument",
    "dokumentfragen.fehlerFormat":
      "Dieses Format kann hier nicht gelesen werden. Möglich sind PDF, Word (.docx), Text und Markdown.",
    "dokumentfragen.fehlerGroesse":
      "„{{name}}“ ist zu groß ({{mb}} MB). Dokumente bis {{grenze}} MB können gelesen werden.",
    "dokumentfragen.fehlerLesen": "„{{name}}“ konnte nicht gelesen werden.",
    "dokumentfragen.fehlerLeer":
      "In „{{name}}“ wurde kein lesbarer Text gefunden, zum Beispiel bei einem eingescannten PDF ohne Textebene.",
    "dokumentfragen.frageLabel": "Deine Frage zum Dokument",
    "dokumentfragen.fragePlatzhalter": "Zum Beispiel: Wann wird der Filter gewechselt?",
    "dokumentfragen.fragen": "Fragen",
    "dokumentfragen.antwortEtikett":
      "Aus diesem Dokument zusammengestellt · wörtliche Stellen, nicht geprüft",
    "dokumentfragen.antwortVerknuepft": "Die Antwort verbindet {{anzahl}} Stellen des Dokuments.",
    "dokumentfragen.antwortEineStelle": "Die Antwort stützt sich auf eine Stelle des Dokuments.",
    "dokumentfragen.antwortHinweis":
      "Jede Aussage ist ein Zitat aus dem Dokument; die Marke führt zur Fundstelle. Nichts davon ist im Wissensbestand geprüft.",
    "dokumentfragen.traegt": "Passt zu: {{begriffe}}",
    "dokumentfragen.zitatGekuerzt": "gekürzt, vollständig an der Fundstelle",
    "dokumentfragen.nichtGefunden": "Dazu steht nichts im Dokument: {{begriffe}}",
    "dokumentfragen.lueckeTitel": "Das Dokument gibt dazu keine Antwort her.",
    "dokumentfragen.lueckeText":
      "Keine Stelle des Dokuments trägt diese Frage. Es wird nichts ergänzt, was nicht im Dokument steht.",
    "dokumentfragen.lueckeOhneBegriffe":
      "Die Frage enthält kein Stichwort, nach dem im Dokument gesucht werden kann. Nenne den Gegenstand, um den es geht.",
    "dokumentfragen.ortSeite": "Seite {{seite}}, Absatz {{absatz}}",
    "dokumentfragen.ortAbschnitt": "Abschnitt „{{abschnitt}}“, Absatz {{absatz}}",
    "dokumentfragen.ortAbsatz": "Absatz {{absatz}}",
    "dokumentfragen.zurFundstelle": "Zur Fundstelle {{nummer}}: {{ort}}",
    "dokumentfragen.dokumentTitel": "Das Dokument nach Fundstellen",
    "dokumentfragen.einstieg": "Fragen an ein eigenes Dokument stellen",
    "dokumentfragen.einstiegHinweis": "Die Datei bleibt auf diesem Gerät.",
  },
  en: {
    "dokumentfragen.kicker": "Ask",
    "dokumentfragen.titel": "Ask a document",
    "dokumentfragen.lead":
      "Upload a document and ask questions about it. The answer brings the matching passages together and shows where they are in the document.",
    "dokumentfragen.datenschutz":
      "The document stays on this device: it is not saved, not added to the knowledge base and not sent to any AI model.",
    "dokumentfragen.zurueck": "Back to asking the knowledge base",
    "dokumentfragen.dateiWaehlen": "Choose document",
    "dokumentfragen.formate": "PDF, Word (.docx), text or Markdown",
    "dokumentfragen.liest": "Reading “{{name}}” …",
    "dokumentfragen.geladen": "“{{name}}” · passages: {{anzahl}}",
    "dokumentfragen.gekuerzt":
      "The PDF has more pages than were read. Questions only cover the first {{seiten}} pages.",
    "dokumentfragen.anderesDokument": "Other document",
    "dokumentfragen.fehlerFormat":
      "This format cannot be read here. PDF, Word (.docx), text and Markdown are supported.",
    "dokumentfragen.fehlerGroesse":
      "“{{name}}” is too large ({{mb}} MB). Documents up to {{grenze}} MB can be read.",
    "dokumentfragen.fehlerLesen": "“{{name}}” could not be read.",
    "dokumentfragen.fehlerLeer":
      "No readable text was found in “{{name}}”, for example a scanned PDF without a text layer.",
    "dokumentfragen.frageLabel": "Your question about the document",
    "dokumentfragen.fragePlatzhalter": "For example: When is the filter replaced?",
    "dokumentfragen.fragen": "Ask",
    "dokumentfragen.antwortEtikett":
      "Compiled from this document · verbatim passages, not reviewed",
    "dokumentfragen.antwortVerknuepft": "The answer connects {{anzahl}} passages of the document.",
    "dokumentfragen.antwortEineStelle": "The answer is based on one passage of the document.",
    "dokumentfragen.antwortHinweis":
      "Every statement is a quote from the document; the marker leads to the passage. None of it has been reviewed in the knowledge base.",
    "dokumentfragen.traegt": "Matches: {{begriffe}}",
    "dokumentfragen.zitatGekuerzt": "shortened, complete at the passage",
    "dokumentfragen.nichtGefunden": "The document says nothing about: {{begriffe}}",
    "dokumentfragen.lueckeTitel": "The document does not answer this.",
    "dokumentfragen.lueckeText":
      "No passage of the document supports this question. Nothing is added that is not in the document.",
    "dokumentfragen.lueckeOhneBegriffe":
      "The question contains no keyword to search the document for. Name the subject you are asking about.",
    "dokumentfragen.ortSeite": "Page {{seite}}, paragraph {{absatz}}",
    "dokumentfragen.ortAbschnitt": "Section “{{abschnitt}}”, paragraph {{absatz}}",
    "dokumentfragen.ortAbsatz": "Paragraph {{absatz}}",
    "dokumentfragen.zurFundstelle": "Go to passage {{nummer}}: {{ort}}",
    "dokumentfragen.dokumentTitel": "The document by passage",
    "dokumentfragen.einstieg": "Ask questions about your own document",
    "dokumentfragen.einstiegHinweis": "The file stays on this device.",
  },
  nl: {
    "dokumentfragen.kicker": "Vragen",
    "dokumentfragen.titel": "Vragen aan een document",
    "dokumentfragen.lead":
      "Upload een document en stel er vragen over. Het antwoord brengt de passende passages samen en laat zien waar ze in het document staan.",
    "dokumentfragen.datenschutz":
      "Het document blijft op dit apparaat: het wordt niet opgeslagen, niet aan de kennisbank toegevoegd en naar geen enkel AI-model gestuurd.",
    "dokumentfragen.zurueck": "Terug naar vragen aan de kennisbank",
    "dokumentfragen.dateiWaehlen": "Document kiezen",
    "dokumentfragen.formate": "PDF, Word (.docx), tekst of Markdown",
    "dokumentfragen.liest": "“{{name}}” wordt gelezen …",
    "dokumentfragen.geladen": "“{{name}}” · vindplaatsen: {{anzahl}}",
    "dokumentfragen.gekuerzt":
      "De PDF heeft meer pagina's dan er zijn gelezen. Vragen gaan alleen over de eerste {{seiten}} pagina's.",
    "dokumentfragen.anderesDokument": "Ander document",
    "dokumentfragen.fehlerFormat":
      "Dit formaat kan hier niet worden gelezen. PDF, Word (.docx), tekst en Markdown zijn mogelijk.",
    "dokumentfragen.fehlerGroesse":
      "“{{name}}” is te groot ({{mb}} MB). Documenten tot {{grenze}} MB kunnen worden gelezen.",
    "dokumentfragen.fehlerLesen": "“{{name}}” kon niet worden gelezen.",
    "dokumentfragen.fehlerLeer":
      "In “{{name}}” is geen leesbare tekst gevonden, bijvoorbeeld bij een gescande PDF zonder tekstlaag.",
    "dokumentfragen.frageLabel": "Je vraag over het document",
    "dokumentfragen.fragePlatzhalter": "Bijvoorbeeld: Wanneer wordt het filter vervangen?",
    "dokumentfragen.fragen": "Vragen",
    "dokumentfragen.antwortEtikett":
      "Samengesteld uit dit document · letterlijke passages, niet gecontroleerd",
    "dokumentfragen.antwortVerknuepft":
      "Het antwoord verbindt {{anzahl}} passages van het document.",
    "dokumentfragen.antwortEineStelle": "Het antwoord steunt op één passage van het document.",
    "dokumentfragen.antwortHinweis":
      "Elke uitspraak is een citaat uit het document; de markering leidt naar de vindplaats. Niets daarvan is in de kennisbank gecontroleerd.",
    "dokumentfragen.traegt": "Past bij: {{begriffe}}",
    "dokumentfragen.zitatGekuerzt": "ingekort, volledig bij de vindplaats",
    "dokumentfragen.nichtGefunden": "Het document zegt niets over: {{begriffe}}",
    "dokumentfragen.lueckeTitel": "Het document geeft hierop geen antwoord.",
    "dokumentfragen.lueckeText":
      "Geen passage van het document ondersteunt deze vraag. Er wordt niets aangevuld wat niet in het document staat.",
    "dokumentfragen.lueckeOhneBegriffe":
      "De vraag bevat geen trefwoord om in het document naar te zoeken. Noem het onderwerp waar het om gaat.",
    "dokumentfragen.ortSeite": "Pagina {{seite}}, alinea {{absatz}}",
    "dokumentfragen.ortAbschnitt": "Sectie ‘{{abschnitt}}’, alinea {{absatz}}",
    "dokumentfragen.ortAbsatz": "Alinea {{absatz}}",
    "dokumentfragen.zurFundstelle": "Naar vindplaats {{nummer}}: {{ort}}",
    "dokumentfragen.dokumentTitel": "Het document per vindplaats",
    "dokumentfragen.einstieg": "Vragen stellen over je eigen document",
    "dokumentfragen.einstiegHinweis": "Het bestand blijft op dit apparaat.",
  },
} satisfies Textmodul;
