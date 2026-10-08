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
  },
  en: {
    "fassungsangabe.ersteFassung": "First saved version",
    "fassungsangabe.geaenderteFelder": "Changed fields: {{felder}}",
    "fassungsangabe.vergleichen": "Compare with v{{von}}",
    "fassungsangabe.vergleichenName":
      "Compare v{{bis}} field by field with the previous version v{{von}}",
  },
  nl: {
    "fassungsangabe.ersteFassung": "Eerste opgeslagen versie",
    "fassungsangabe.geaenderteFelder": "Gewijzigde velden: {{felder}}",
    "fassungsangabe.vergleichen": "Vergelijken met v{{von}}",
    "fassungsangabe.vergleichenName":
      "v{{bis}} veld voor veld vergelijken met de vorige versie v{{von}}",
  },
} satisfies Textmodul;
