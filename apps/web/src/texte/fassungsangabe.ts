// ================================================================================================
// N-0057 (aufnahme:20260922:gesamt-wissen-versionen) · ÄNDERUNGSANGABEN AN DER FASSUNGSKARTE.
// ================================================================================================
//
// Pedis Befund vom 06.09.: unter v2 stand isoliert „Aussage", unter v1 „Ausgangsversion — kein
// Vorgänger-Diff." — ohne zu sagen, dass „Aussage" ein GEÄNDERTES FELD ist, und mit dem Fachwort
// „Diff". Vorschlag wörtlich: „Geänderte Felder: Aussage und Erste gespeicherte Version schreiben;
// Änderungsdetails direkt mit einer verständlichen Vergleichsaktion verbinden."
//
// WARUM EIN EIGENES MODUL und nicht neue Werte für `ko.snapshotInitial`: die Werte des Grundbestands
// sind über `tests/i18n-textmodule/bestand-unveraendert.test.ts` eingefroren; neue Texte kommen über
// `texte/` dazu. Die Karte (`MehrAbschnitte.tsx`) liest seither diese Schlüssel; die alten bleiben im
// Grundbestand unverändert stehen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fassungsangabe.",
  legacySchluessel: [],
  de: {
    "fassungsangabe.ersteFassung": "Erste gespeicherte Version",
    "fassungsangabe.geaenderteFelder": "Geänderte Felder: {{felder}}",
    "fassungsangabe.vergleichen": "Mit v{{von}} vergleichen",
    "fassungsangabe.vergleichenName":
      "v{{bis}} mit der vorherigen Fassung v{{von}} Feld für Feld vergleichen",
    "fassungsangabe.kopfFassung": "Aktuelle Fassung v{{version}}",
    "fassungsangabe.kopfGeaendert": "geändert {{zeit}}",
    "fassungsangabe.editorTitel": "Gespeicherte Fassungen nebeneinander vergleichen",
    "fassungsangabe.editorHinweis":
      "Verglichen werden gespeicherte Fassungen. Deine noch nicht gespeicherten Änderungen stehen nur im Formular.",
  },
  en: {
    "fassungsangabe.ersteFassung": "First saved version",
    "fassungsangabe.geaenderteFelder": "Changed fields: {{felder}}",
    "fassungsangabe.vergleichen": "Compare with v{{von}}",
    "fassungsangabe.vergleichenName":
      "Compare v{{bis}} field by field with the previous version v{{von}}",
    "fassungsangabe.kopfFassung": "Current version v{{version}}",
    "fassungsangabe.kopfGeaendert": "changed {{zeit}}",
    "fassungsangabe.editorTitel": "Compare saved versions side by side",
    "fassungsangabe.editorHinweis":
      "Only saved versions are compared. Your unsaved changes exist only in the form.",
  },
  nl: {
    "fassungsangabe.ersteFassung": "Eerste opgeslagen versie",
    "fassungsangabe.geaenderteFelder": "Gewijzigde velden: {{felder}}",
    "fassungsangabe.vergleichen": "Vergelijken met v{{von}}",
    "fassungsangabe.vergleichenName":
      "v{{bis}} veld voor veld vergelijken met de vorige versie v{{von}}",
    "fassungsangabe.kopfFassung": "Huidige versie v{{version}}",
    "fassungsangabe.kopfGeaendert": "gewijzigd {{zeit}}",
    "fassungsangabe.editorTitel": "Opgeslagen versies naast elkaar vergelijken",
    "fassungsangabe.editorHinweis":
      "Alleen opgeslagen versies worden vergeleken. Je niet-opgeslagen wijzigingen staan alleen in het formulier.",
  },
} satisfies Textmodul;
