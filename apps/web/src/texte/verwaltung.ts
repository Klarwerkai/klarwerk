// ================================================================================================
// ADMIN-01 · DIE STARTSEITE DER VERWALTUNG — die Texte dieses Auftrags, bei ihrer Funktion.
// ================================================================================================
//
// WOHER SIE KOMMEN: `produkt:20261009:admin-verwaltung-uebersicht`. Die Fläche ist
// `pages/AdminUebersicht.tsx`, ihr Modell `lib/adminUebersicht.ts`; die Filtertexte stehen an der
// Kontenliste (`pages/Admin.tsx`) und an der Lückenliste (`pages/Risk.tsx`).
//
// WAS DIE SÄTZE NICHT BEHAUPTEN: dass es in der Verwaltung eine Kommunikationsfunktion gäbe. Die
// Gruppe sagt ausdrücklich, dass dort noch nichts zu bedienen ist (Auftrag: „Funktionen ohne
// Umsetzung nicht als benutzbar anbieten").
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "verwaltung.",
  legacySchluessel: [],
  de: {
    "verwaltung.uebersicht": "Übersicht",
    "verwaltung.aufgaben.titel": "Was gerade ansteht",
    "verwaltung.aufgabe.pruefungen": "Offene Prüfungen",
    "verwaltung.aufgabe.luecken": "Offene Wissenslücken",
    "verwaltung.aufgabe.freigaben": "Konten warten auf Freigabe",
    "verwaltung.aufgabe.kiZugaenge": "KI-Zugänge aktiv",
    "verwaltung.aufgabe.kiZugaengeWert": "{{aktiv}} von {{gesamt}}",
    "verwaltung.aufgabe.kiErsatz": "kein KI-Modell – Ersatzmodus antwortet",
    "verwaltung.aufgaben.erhoben": "erhoben {{zeit}}",
    "verwaltung.wert.laedt": "wird ermittelt …",
    "verwaltung.wert.offline": "unbekannt (offline)",
    "verwaltung.aufgaben.aktualisieren": "Zahlen aktualisieren",
    "verwaltung.aufgaben.laeuft": "Wird aktualisiert …",
    "verwaltung.bereiche.titel": "Bereiche der Verwaltung",
    "verwaltung.gruppe.menschen": "Menschen und Rechte",
    "verwaltung.gruppe.spaces": "Spaces und Wissensordnung",
    "verwaltung.gruppe.qualitaet": "Qualität und Freigaben",
    "verwaltung.gruppe.ki": "KI und Integrationen",
    "verwaltung.gruppe.kommunikation": "Kommunikation",
    "verwaltung.gruppe.berichte": "Berichte und Nachweise",
    "verwaltung.gruppe.betrieb": "Organisation und Betrieb",
    "verwaltung.zweck.menschen":
      "Konten anlegen und freigeben, Rollen prüfen, Beiträge an Nachfolger übergeben.",
    "verwaltung.zweck.spaces":
      "Arbeitsräume, Bibliothek und Quellen ordnen; Gelöschtes wiederherstellen.",
    "verwaltung.zweck.qualitaet":
      "Prüfungen, Konflikte, Dubletten, Lücken und fällige Überprüfungen bearbeiten.",
    "verwaltung.zweck.ki":
      "KI-Anbieter, Zugänge, Grenzen und externe Recherche einstellen; Importe verbinden.",
    "verwaltung.zweck.kommunikation":
      "Welche Meldung wen über welchen Kanal wie oft erreicht; Vorgaben und Zustellstatus.",
    "verwaltung.zweck.berichte":
      "Auswertungen, Prüfprotokoll, Benutzeränderungen und Datenschutzauskunft.",
    "verwaltung.zweck.betrieb":
      "Bereitschaft, Sicherung, Erweiterte Module, Vorführdaten und Werkseinstellungen.",
    "verwaltung.ziel.uebergabe": "Beiträge und Verantwortung übergeben",
    "verwaltung.ziel.spaces": "Spaces",
    "verwaltung.nichtVerfuegbar": "In der Verwaltung noch nicht verfügbar",
    "verwaltung.persoenlich.titel": "Persönliche Einstellungen — getrennt von der Verwaltung",
    "verwaltung.filter.wartet": "Gefiltert: wartet auf Freigabe",
    "verwaltung.filter.offeneLuecken": "Gefiltert: nur offene Lücken",
    "verwaltung.filter.aufheben": "Filter aufheben",
    "verwaltung.filter.keineWartenden": "Kein Konto wartet auf Freigabe.",
    "verwaltung.filter.keineOffenen": "Keine offene Lücke.",
  },
  en: {
    "verwaltung.uebersicht": "Overview",
    "verwaltung.aufgaben.titel": "What needs attention",
    "verwaltung.aufgabe.pruefungen": "Open reviews",
    "verwaltung.aufgabe.luecken": "Open knowledge gaps",
    "verwaltung.aufgabe.freigaben": "Accounts awaiting approval",
    "verwaltung.aufgabe.kiZugaenge": "AI access active",
    "verwaltung.aufgabe.kiZugaengeWert": "{{aktiv}} of {{gesamt}}",
    "verwaltung.aufgabe.kiErsatz": "no AI model – fallback mode answers",
    "verwaltung.aufgaben.erhoben": "collected {{zeit}}",
    "verwaltung.wert.laedt": "being determined …",
    "verwaltung.wert.offline": "unknown (offline)",
    "verwaltung.aufgaben.aktualisieren": "Refresh figures",
    "verwaltung.aufgaben.laeuft": "Refreshing …",
    "verwaltung.bereiche.titel": "Administration areas",
    "verwaltung.gruppe.menschen": "People and permissions",
    "verwaltung.gruppe.spaces": "Spaces and knowledge structure",
    "verwaltung.gruppe.qualitaet": "Quality and approvals",
    "verwaltung.gruppe.ki": "AI and integrations",
    "verwaltung.gruppe.kommunikation": "Communication",
    "verwaltung.gruppe.berichte": "Reports and evidence",
    "verwaltung.gruppe.betrieb": "Organisation and operations",
    "verwaltung.zweck.menschen":
      "Create and approve accounts, check roles, hand over contributions to successors.",
    "verwaltung.zweck.spaces": "Organise workspaces, library and sources; restore deleted items.",
    "verwaltung.zweck.qualitaet": "Work on reviews, conflicts, duplicates, gaps and due re-checks.",
    "verwaltung.zweck.ki":
      "Set AI providers, access, limits and external research; connect imports.",
    "verwaltung.zweck.kommunikation":
      "Which notification reaches whom, through which channel and how often; rules and delivery.",
    "verwaltung.zweck.berichte":
      "Analytics, audit trail, user changes and data protection details.",
    "verwaltung.zweck.betrieb": "Readiness, backup, advanced modules, demo data and factory reset.",
    "verwaltung.ziel.uebergabe": "Hand over contributions and responsibility",
    "verwaltung.ziel.spaces": "Spaces",
    "verwaltung.nichtVerfuegbar": "Not yet available in administration",
    "verwaltung.persoenlich.titel": "Personal settings — kept apart from administration",
    "verwaltung.filter.wartet": "Filtered: awaiting approval",
    "verwaltung.filter.offeneLuecken": "Filtered: open gaps only",
    "verwaltung.filter.aufheben": "Clear filter",
    "verwaltung.filter.keineWartenden": "No account is awaiting approval.",
    "verwaltung.filter.keineOffenen": "No open gap.",
  },
  nl: {
    "verwaltung.uebersicht": "Overzicht",
    "verwaltung.aufgaben.titel": "Wat nu aandacht vraagt",
    "verwaltung.aufgabe.pruefungen": "Openstaande controles",
    "verwaltung.aufgabe.luecken": "Open kennislacunes",
    "verwaltung.aufgabe.freigaben": "Accounts wachten op vrijgave",
    "verwaltung.aufgabe.kiZugaenge": "AI-toegangen actief",
    "verwaltung.aufgabe.kiZugaengeWert": "{{aktiv}} van {{gesamt}}",
    "verwaltung.aufgabe.kiErsatz": "geen AI-model – vervangmodus antwoordt",
    "verwaltung.aufgaben.erhoben": "opgehaald {{zeit}}",
    "verwaltung.wert.laedt": "wordt bepaald …",
    "verwaltung.wert.offline": "onbekend (offline)",
    "verwaltung.aufgaben.aktualisieren": "Cijfers vernieuwen",
    "verwaltung.aufgaben.laeuft": "Wordt vernieuwd …",
    "verwaltung.bereiche.titel": "Onderdelen van het beheer",
    "verwaltung.gruppe.menschen": "Mensen en rechten",
    "verwaltung.gruppe.spaces": "Spaces en kennisordening",
    "verwaltung.gruppe.qualitaet": "Kwaliteit en vrijgaven",
    "verwaltung.gruppe.ki": "AI en integraties",
    "verwaltung.gruppe.kommunikation": "Communicatie",
    "verwaltung.gruppe.berichte": "Rapporten en bewijs",
    "verwaltung.gruppe.betrieb": "Organisatie en bedrijfsvoering",
    "verwaltung.zweck.menschen":
      "Accounts aanmaken en vrijgeven, rollen controleren, bijdragen aan opvolgers overdragen.",
    "verwaltung.zweck.spaces":
      "Werkruimten, bibliotheek en bronnen ordenen; verwijderde items herstellen.",
    "verwaltung.zweck.qualitaet":
      "Controles, conflicten, duplicaten, lacunes en geplande herzieningen afhandelen.",
    "verwaltung.zweck.ki":
      "AI-aanbieders, toegangen, grenzen en extern onderzoek instellen; imports koppelen.",
    "verwaltung.zweck.kommunikation":
      "Welke melding wie via welk kanaal hoe vaak bereikt; regels en bezorgstatus.",
    "verwaltung.zweck.berichte":
      "Analyses, controleprotocol, gebruikerswijzigingen en privacy-informatie.",
    "verwaltung.zweck.betrieb":
      "Gereedheid, back-up, uitgebreide modules, demodata en fabrieksinstellingen.",
    "verwaltung.ziel.uebergabe": "Bijdragen en verantwoordelijkheid overdragen",
    "verwaltung.ziel.spaces": "Spaces",
    "verwaltung.nichtVerfuegbar": "Nog niet beschikbaar in het beheer",
    "verwaltung.persoenlich.titel": "Persoonlijke instellingen — los van het beheer",
    "verwaltung.filter.wartet": "Gefilterd: wacht op vrijgave",
    "verwaltung.filter.offeneLuecken": "Gefilterd: alleen open lacunes",
    "verwaltung.filter.aufheben": "Filter opheffen",
    "verwaltung.filter.keineWartenden": "Geen account wacht op vrijgave.",
    "verwaltung.filter.keineOffenen": "Geen open lacune.",
  },
} satisfies Textmodul;
