// ================================================================================================
// aufnahme:20260922:gesamt-wissen-verantwortung · VERANTWORTUNG UND URHEBERSCHAFT GETRENNT.
// ================================================================================================
//
// R-0507: am Wissensobjekt steht, wem es gehört, wer es geprüft und wer es freigegeben hat; der
// Eigentümer kann die Verantwortung zurückgeben. R-0546: der Name eines früheren Bearbeiters sagt
// „hat bearbeitet", keine Verantwortung. R-0554 / R-2128: die Wissensübergabe beim Ausscheiden
// (Verwaltung → Benutzer). Flächen: `components/bibliothek/Verantwortung.tsx`,
// `components/Wissensuebergabe.tsx`, Historie in `components/bibliothek/MehrAbschnitte.tsx`.
//
// Die zwei `audit.action.*`-Schlüssel sind Altnamen-Muster: `lib/auditAction.ts` leitet sie aus den
// Protokollvorgängen `ko.ownership-released` und `lifecycle.handover` ab.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "verantwortung.",
  legacySchluessel: [
    "audit.action.ko_ownership_released",
    "audit.action.ko_owner_validated",
    "audit.action.lifecycle_handover",
  ],
  de: {
    "audit.action.ko_ownership_released": "Verantwortung zurückgegeben",
    "audit.action.ko_owner_validated": "Vom Eigentümer freigegeben",
    "verantwortung.freigeben": "Als Eigentümer freigeben",
    "verantwortung.freigebenDublette": "Dublette gesehen – trotzdem freigeben",
    "verantwortung.freigegeben": "Als Eigentümer freigegeben. Die Freigabe steht im Prüfprotokoll.",
    "verantwortung.entfernenNachfolger": "Wissen vor dem Entfernen übergeben an",
    "verantwortung.entfernenOhneUebergabe": "Ohne Wissensübergabe entfernen",
    "verantwortung.entfernenAn": "Wissen übergeben an {{name}}",
    "audit.action.lifecycle_handover": "Wissen beim Ausscheiden übergeben",
    "verantwortung.eigentuemer": "Verantwortlich",
    "verantwortung.eigentuemerFehlt":
      "Kein Verantwortlicher benannt – bis dahin gilt der Autor als verantwortlich.",
    "verantwortung.geprueftVon": "Geprüft von",
    "verantwortung.freigegebenVon": "Freigegeben von",
    "verantwortung.niemand": "noch niemand",
    "verantwortung.bearbeiterHinweis":
      "Namen früherer Bearbeiter sagen nur, wer das Objekt bearbeitet hat – nicht, wer für den Inhalt verantwortlich ist.",
    "verantwortung.zurueckgeben": "Verantwortung zurückgeben",
    "verantwortung.zurueckgegeben":
      "Verantwortung zurückgegeben. Prüf- und Freigabespur bleiben erhalten.",
    "verantwortung.bearbeitetVon": "bearbeitet von {{name}}",
    "verantwortung.uebergabe.titel": "Wissen beim Ausscheiden übergeben",
    "verantwortung.uebergabe.erklaerung":
      "Wissensobjekte, Entwürfe, offene Lücken und offene Prüfaufgaben einer Person gehen in einem Zug an einen Nachfolger. Ursprüngliche Autoren bleiben sichtbar.",
    "verantwortung.uebergabe.an": "Nachfolger",
    "verantwortung.uebergabe.waehlen": "Person wählen …",
    "verantwortung.uebergabe.vorschau": "Vorschau anzeigen",
    "verantwortung.uebergabe.ausfuehren": "Jetzt übergeben",
    "verantwortung.uebergabe.leer": "Bei dieser Person liegt nichts, was übergeben werden müsste.",
    "verantwortung.uebergabe.art.wissensobjekt": "Wissensobjekte (Autor)",
    "verantwortung.uebergabe.art.eigentum": "Wissensobjekte (Verantwortung)",
    "verantwortung.uebergabe.art.papierkorb": "Beiträge im Papierkorb (Verantwortung)",
    "verantwortung.uebergabe.art.entwurf": "Entwürfe",
    "verantwortung.uebergabe.art.luecke": "Offene Lücken",
    "verantwortung.uebergabe.art.pruefaufgabe": "Offene Prüfaufgaben",
    "verantwortung.uebergabe.erledigt": "Übergabe abgeschlossen und im Prüfprotokoll festgehalten.",
    "verantwortung.uebergabe.teilweise":
      "{{anzahl}} Schritt(e) konnten nicht übergeben werden. Ein erneuter Lauf übernimmt nur, was noch fehlt.",
  },
  en: {
    "audit.action.ko_ownership_released": "Responsibility handed back",
    "audit.action.ko_owner_validated": "Approved by the owner",
    "verantwortung.freigeben": "Approve as owner",
    "verantwortung.freigebenDublette": "Duplicate seen – approve anyway",
    "verantwortung.freigegeben": "Approved as owner. The approval is recorded in the audit log.",
    "verantwortung.entfernenNachfolger": "Hand over knowledge before removing to",
    "verantwortung.entfernenOhneUebergabe": "Remove without knowledge handover",
    "verantwortung.entfernenAn": "Hand over knowledge to {{name}}",
    "audit.action.lifecycle_handover": "Knowledge handed over on departure",
    "verantwortung.eigentuemer": "Responsible",
    "verantwortung.eigentuemerFehlt":
      "No responsible person named – until then the author is treated as responsible.",
    "verantwortung.geprueftVon": "Reviewed by",
    "verantwortung.freigegebenVon": "Approved by",
    "verantwortung.niemand": "nobody yet",
    "verantwortung.bearbeiterHinweis":
      "Names of earlier editors only say who edited the object – not who is responsible for its content.",
    "verantwortung.zurueckgeben": "Hand back responsibility",
    "verantwortung.zurueckgegeben":
      "Responsibility handed back. The review and approval trail is kept.",
    "verantwortung.bearbeitetVon": "edited by {{name}}",
    "verantwortung.uebergabe.titel": "Hand over knowledge when someone leaves",
    "verantwortung.uebergabe.erklaerung":
      "A person's knowledge objects, drafts, open gaps and open review tasks move to a successor in one step. Original authors stay visible.",
    "verantwortung.uebergabe.an": "Successor",
    "verantwortung.uebergabe.waehlen": "Choose a person …",
    "verantwortung.uebergabe.vorschau": "Show preview",
    "verantwortung.uebergabe.ausfuehren": "Hand over now",
    "verantwortung.uebergabe.leer": "Nothing needs to be handed over for this person.",
    "verantwortung.uebergabe.art.wissensobjekt": "Knowledge objects (author)",
    "verantwortung.uebergabe.art.eigentum": "Knowledge objects (responsibility)",
    "verantwortung.uebergabe.art.papierkorb": "Items in the trash (responsibility)",
    "verantwortung.uebergabe.art.entwurf": "Drafts",
    "verantwortung.uebergabe.art.luecke": "Open gaps",
    "verantwortung.uebergabe.art.pruefaufgabe": "Open review tasks",
    "verantwortung.uebergabe.erledigt": "Handover complete and recorded in the audit log.",
    "verantwortung.uebergabe.teilweise":
      "{{anzahl}} step(s) could not be handed over. Running it again only moves what is still missing.",
  },
  nl: {
    "audit.action.ko_ownership_released": "Verantwoordelijkheid teruggegeven",
    "audit.action.ko_owner_validated": "Vrijgegeven door de eigenaar",
    "verantwortung.freigeben": "Als eigenaar vrijgeven",
    "verantwortung.freigebenDublette": "Duplicaat gezien – toch vrijgeven",
    "verantwortung.freigegeben": "Als eigenaar vrijgegeven. De vrijgave staat in het auditlogboek.",
    "verantwortung.entfernenNachfolger": "Kennis vóór het verwijderen overdragen aan",
    "verantwortung.entfernenOhneUebergabe": "Verwijderen zonder kennisoverdracht",
    "verantwortung.entfernenAn": "Kennis overdragen aan {{name}}",
    "audit.action.lifecycle_handover": "Kennis overgedragen bij vertrek",
    "verantwortung.eigentuemer": "Verantwoordelijk",
    "verantwortung.eigentuemerFehlt":
      "Geen verantwoordelijke aangewezen – tot dan geldt de auteur als verantwoordelijk.",
    "verantwortung.geprueftVon": "Gecontroleerd door",
    "verantwortung.freigegebenVon": "Vrijgegeven door",
    "verantwortung.niemand": "nog niemand",
    "verantwortung.bearbeiterHinweis":
      "Namen van eerdere bewerkers zeggen alleen wie het object heeft bewerkt – niet wie verantwoordelijk is voor de inhoud.",
    "verantwortung.zurueckgeben": "Verantwoordelijkheid teruggeven",
    "verantwortung.zurueckgegeben":
      "Verantwoordelijkheid teruggegeven. Het controle- en vrijgavespoor blijft bewaard.",
    "verantwortung.bearbeitetVon": "bewerkt door {{name}}",
    "verantwortung.uebergabe.titel": "Kennis overdragen bij vertrek",
    "verantwortung.uebergabe.erklaerung":
      "Kennisobjecten, concepten, open lacunes en open controletaken van een persoon gaan in één keer naar een opvolger. Oorspronkelijke auteurs blijven zichtbaar.",
    "verantwortung.uebergabe.an": "Opvolger",
    "verantwortung.uebergabe.waehlen": "Persoon kiezen …",
    "verantwortung.uebergabe.vorschau": "Voorbeeld tonen",
    "verantwortung.uebergabe.ausfuehren": "Nu overdragen",
    "verantwortung.uebergabe.leer": "Bij deze persoon ligt niets dat overgedragen moet worden.",
    "verantwortung.uebergabe.art.wissensobjekt": "Kennisobjecten (auteur)",
    "verantwortung.uebergabe.art.eigentum": "Kennisobjecten (verantwoordelijkheid)",
    "verantwortung.uebergabe.art.papierkorb": "Bijdragen in de prullenbak (verantwoordelijkheid)",
    "verantwortung.uebergabe.art.entwurf": "Concepten",
    "verantwortung.uebergabe.art.luecke": "Open lacunes",
    "verantwortung.uebergabe.art.pruefaufgabe": "Open controletaken",
    "verantwortung.uebergabe.erledigt": "Overdracht voltooid en vastgelegd in het auditlogboek.",
    "verantwortung.uebergabe.teilweise":
      "{{anzahl}} stap(pen) konden niet worden overgedragen. Een nieuwe run neemt alleen over wat nog ontbreekt.",
  },
} satisfies Textmodul;
