// ================================================================================================
// R-0768 · R-1772 · R-2111 · FR-EXT-05 — DAS WISSENSHAUS (KNOWLEDGE HOUSE / COMPANY MEMORY).
// ================================================================================================
//
// Die Texte der Fläche `components/Wissenshaus.tsx` auf `/kapital`: je Fachgebiet ein Stockwerk,
// gesichert oder fragil, mit Füllgrad, dazu die Kennzahlen Import → Wissenshaus → Ausgabe. Die
// Sätze sagen nur, was der Management-Snapshot wirklich zählt (services/management/src/metrics.ts).
//
// Die Aliasfamilie des Terminologie-Vertrags (`tests/app/pro375-terminologie-vertrag.test.ts`) ist
// hier bewusst gemieden: kein „das Haus", „im Haus", „the house", „het huis" — es heisst immer
// Wissenshaus / knowledge house / kennishuis.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissenshaus.",
  legacySchluessel: [],
  de: {
    "wissenshaus.dach": "{{floors}} Stockwerke · eines je Fachgebiet",
    "wissenshaus.ohneFachgebiet": "Ohne Fachgebiet",
    "wissenshaus.ohneFachgebietHinweis":
      "Objekte ohne angegebenes Fachgebiet stehen im untersten Stockwerk. Das Fachgebiet wird am Objekt gesetzt und nicht aus der Kategorie abgeleitet.",
    "wissenshaus.zustand.gesichert": "gesichert",
    "wissenshaus.zustand.fragil": "fragil",
    "wissenshaus.grund.fuellgrad": "unter 50 % validiert",
    "wissenshaus.grund.einzelquelle": "nur ein Urheber",
    "wissenshaus.fuellgrad": "Füllgrad {{pct}} %",
    "wissenshaus.zeile":
      "{{count}} Objekte · {{validated}} validiert · {{authors}} Urheber · {{imported}} importiert",
    "wissenshaus.legende":
      "Füllgrad = Anteil validierter Objekte. Fragil heisst: Füllgrad unter 50 % oder nur ein Urheber.",
    "wissenshaus.fluss.titel": "Import → Wissenshaus → Ausgabe",
    "wissenshaus.fluss.import": "Import",
    "wissenshaus.fluss.importDetail": "davon {{n}} validiert",
    "wissenshaus.fluss.haus": "Wissenshaus",
    "wissenshaus.fluss.hausDetail":
      "{{secured}} gesichert · {{fragile}} von {{floors}} Stockwerken fragil",
    "wissenshaus.fluss.ausgabe": "Ausgabe",
    "wissenshaus.fluss.ausgabeDetail": "ausgabefähig (validiert)",
    "wissenshaus.fluss.grenze":
      "Als importiert zählt nur, was ein Importweg am Objekt markiert hat. Ausgabe zählt, was als Quelle eines Dokuments zulässig ist; erzeugte Dokumente werden nicht abgelegt und nicht gezählt.",
  },
  en: {
    "wissenshaus.dach": "{{floors}} floors · one per subject area",
    "wissenshaus.ohneFachgebiet": "No subject area",
    "wissenshaus.ohneFachgebietHinweis":
      "Objects without a stated subject area sit on the lowest floor. The subject area is set on the object and is not derived from the category.",
    "wissenshaus.zustand.gesichert": "secured",
    "wissenshaus.zustand.fragil": "fragile",
    "wissenshaus.grund.fuellgrad": "under 50 % validated",
    "wissenshaus.grund.einzelquelle": "only one author",
    "wissenshaus.fuellgrad": "Fill level {{pct}} %",
    "wissenshaus.zeile":
      "{{count}} objects · {{validated}} validated · {{authors}} authors · {{imported}} imported",
    "wissenshaus.legende":
      "Fill level = share of validated objects. Fragile means: fill level under 50 % or only one author.",
    "wissenshaus.fluss.titel": "Import → knowledge house → output",
    "wissenshaus.fluss.import": "Import",
    "wissenshaus.fluss.importDetail": "{{n}} of them validated",
    "wissenshaus.fluss.haus": "Knowledge house",
    "wissenshaus.fluss.hausDetail":
      "{{secured}} secured · {{fragile}} of {{floors}} floors fragile",
    "wissenshaus.fluss.ausgabe": "Output",
    "wissenshaus.fluss.ausgabeDetail": "ready for output (validated)",
    "wissenshaus.fluss.grenze":
      "Only what an import route has marked on the object counts as imported. Output counts what may serve as a source of a document; generated documents are not stored and not counted.",
  },
  nl: {
    "wissenshaus.dach": "{{floors}} verdiepingen · één per vakgebied",
    "wissenshaus.ohneFachgebiet": "Zonder vakgebied",
    "wissenshaus.ohneFachgebietHinweis":
      "Objecten zonder opgegeven vakgebied staan op de onderste verdieping. Het vakgebied wordt op het object ingesteld en niet uit de categorie afgeleid.",
    "wissenshaus.zustand.gesichert": "geborgd",
    "wissenshaus.zustand.fragil": "fragiel",
    "wissenshaus.grund.fuellgrad": "minder dan 50 % gevalideerd",
    "wissenshaus.grund.einzelquelle": "slechts één auteur",
    "wissenshaus.fuellgrad": "Vullingsgraad {{pct}} %",
    "wissenshaus.zeile":
      "{{count}} objecten · {{validated}} gevalideerd · {{authors}} auteurs · {{imported}} geïmporteerd",
    "wissenshaus.legende":
      "Vullingsgraad = aandeel gevalideerde objecten. Fragiel betekent: vullingsgraad onder 50 % of slechts één auteur.",
    "wissenshaus.fluss.titel": "Import → kennishuis → uitvoer",
    "wissenshaus.fluss.import": "Import",
    "wissenshaus.fluss.importDetail": "waarvan {{n}} gevalideerd",
    "wissenshaus.fluss.haus": "Kennishuis",
    "wissenshaus.fluss.hausDetail":
      "{{secured}} geborgd · {{fragile}} van {{floors}} verdiepingen fragiel",
    "wissenshaus.fluss.ausgabe": "Uitvoer",
    "wissenshaus.fluss.ausgabeDetail": "klaar voor uitvoer (gevalideerd)",
    "wissenshaus.fluss.grenze":
      "Als geïmporteerd telt alleen wat een importroute op het object heeft gemarkeerd. Uitvoer telt wat als bron van een document is toegestaan; gemaakte documenten worden niet opgeslagen en niet geteld.",
  },
} satisfies Textmodul;
