// ================================================================================================
// RECHERCHE:pmo-fea-0004 — die Texte des Wissensupdates fürs Teamgespräch.
// ================================================================================================
//
// Zwei Zusagen stehen hier im Wortlaut, weil der Auftrag sie verlangt: was AUFGENOMMEN wird (nur
// validiertes, nicht vertrauliches Wissen aus dem Zeitraum) und dass NICHTS VERSCHICKT wird. Das
// Dokument selbst ist serverseitig deutsch wie jedes Output-Dokument (services/output/src/render.ts).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wochenupdate.",
  legacySchluessel: [],
  de: {
    "wochenupdate.titel": "Wissensupdate fürs Teamgespräch",
    "wochenupdate.einleitung":
      "Fasst zusammen, was in sieben Tagen an validiertem Wissen neu dazukam oder überarbeitet wurde — als Vorlage für das Teamgespräch.",
    "wochenupdate.aufnahme":
      "Aufgenommen wird nur validiertes, nicht vertrauliches Wissen, das im Zeitraum erfasst wurde oder eine neue Fassung bekam. Wer wie viel beigetragen hat, zählt das Update nicht.",
    "wochenupdate.keinVersand":
      "Klarwerk verschickt nichts und richtet keinen Versand ein. Das Update entsteht nur auf Klick; teilen kannst du es selbst über Kopieren oder Download.",
    "wochenupdate.bis": "Zeitraum endet am",
    "wochenupdate.erzeugen": "Wochenupdate erzeugen",
    "wochenupdate.zusammenfassung":
      "{{von}} bis {{bis}}: {{neu}} neu validiert, {{ueberarbeitet}} überarbeitet.",
    "wochenupdate.leer":
      "In diesem Zeitraum ist kein neues oder überarbeitetes validiertes Wissen hinzugekommen.",
    "wochenupdate.fehler": "Das Wochenupdate konnte nicht erzeugt werden.",
  },
  en: {
    "wochenupdate.titel": "Knowledge update for the team meeting",
    "wochenupdate.einleitung":
      "Summarises the validated knowledge that was added or revised within seven days — as a starting point for the team meeting.",
    "wochenupdate.aufnahme":
      "Only validated, non-confidential knowledge that was captured or received a new version within the period is included. The update does not count who contributed how much.",
    "wochenupdate.keinVersand":
      "Klarwerk sends nothing and sets up no distribution. The update is created only when you click; you share it yourself via copy or download.",
    "wochenupdate.bis": "Period ends on",
    "wochenupdate.erzeugen": "Create weekly update",
    "wochenupdate.zusammenfassung":
      "{{von}} to {{bis}}: {{neu}} newly validated, {{ueberarbeitet}} revised.",
    "wochenupdate.leer": "No new or revised validated knowledge was added in this period.",
    "wochenupdate.fehler": "The weekly update could not be created.",
  },
  nl: {
    "wochenupdate.titel": "Kennisupdate voor het teamoverleg",
    "wochenupdate.einleitung":
      "Vat samen welke gevalideerde kennis in zeven dagen is toegevoegd of herzien — als basis voor het teamoverleg.",
    "wochenupdate.aufnahme":
      "Alleen gevalideerde, niet-vertrouwelijke kennis die in de periode is vastgelegd of een nieuwe versie kreeg, wordt opgenomen. De update telt niet wie hoeveel heeft bijgedragen.",
    "wochenupdate.keinVersand":
      "Klarwerk verstuurt niets en richt geen verzending in. De update ontstaat alleen na een klik; je deelt hem zelf via kopiëren of downloaden.",
    "wochenupdate.bis": "Periode eindigt op",
    "wochenupdate.erzeugen": "Weekupdate maken",
    "wochenupdate.zusammenfassung":
      "{{von}} t/m {{bis}}: {{neu}} nieuw gevalideerd, {{ueberarbeitet}} herzien.",
    "wochenupdate.leer":
      "In deze periode is geen nieuwe of herziene gevalideerde kennis bijgekomen.",
    "wochenupdate.fehler": "De weekupdate kon niet worden gemaakt.",
  },
} satisfies Textmodul;
