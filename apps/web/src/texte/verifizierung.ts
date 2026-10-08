// ================================================================================================
// AUFNAHME 20260922 · gesamt-wissen-herkunft · R-0228 — DIE VERIFIZIERUNGSMARKE.
// ================================================================================================
//
// „An jedem Wissensobjekt steht, wer es wann geprüft hat und ob der maschinelle Prüflauf
// vollständig war." Die Zustände der KI-Prüfung selbst tragen ihre vorhandenen Texte
// (`pruefstatus.ki.*`, `pruefbasis.ueberholt`, `val.aiCheck.*`); hier stehen nur die Sätze der
// Marke und die ehrlichen Auskünfte für das, was fehlt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "verifizierung.",
  legacySchluessel: [],
  de: {
    "verifizierung.titel": "Prüfmarke",
    "verifizierung.mensch.bewertung": "Fachlich geprüft von {{name}} am {{zeit}}",
    "verifizierung.mensch.verwalter":
      "Von {{name}} am {{zeit}} als gültig gekennzeichnet (Verwalter, ohne Gegenprüfung)",
    "verifizierung.mensch.rueckgabe": "Von {{name}} am {{zeit}} zur Nacharbeit zurückgegeben",
    "verifizierung.mensch.fruehereFassung":
      "Die Prüfung galt Fassung v{{fassung}} — die heutige Fassung ist noch nicht geprüft.",
    "verifizierung.mensch.fassungUnbekannt":
      "Welche Fassung geprüft wurde, steht nicht im Prüfbeleg.",
    "verifizierung.mensch.nichtBelegt": "Fachliche Prüfung nicht belegt",
    "verifizierung.mensch.nichtAuffindbar":
      "Fachliche Prüfung: der Prüfbeleg, auf den dieser Eintrag verweist, ist nicht auffindbar.",
    "verifizierung.mensch.nichtAbrufbar": "Fachliche Prüfung: Prüfbeleg derzeit nicht abrufbar.",
    "verifizierung.mensch.nichtErhoben": "Fachliche Prüfung: Angaben nicht geladen.",
    "verifizierung.zeitUnbekannt": "unbekanntem Datum",
    "verifizierung.validiertVon": "Validiert von: {{namen}}",
    "verifizierung.ki.titel": "Maschinelle Prüfung",
    "verifizierung.ki.keine": "keine erfasst",
    "verifizierung.ki.am": "abgeschlossen am {{zeit}}",
    "verifizierung.ki.vollstaendig": "Prüflauf vollständig",
    "verifizierung.ki.unvollstaendig": "Prüflauf unvollständig ({{completed}} von {{available}})",
    "verifizierung.ki.umfangUnbekannt": "Umfang des Prüflaufs nicht protokolliert",
  },
  en: {
    "verifizierung.titel": "Verification mark",
    "verifizierung.mensch.bewertung": "Reviewed by {{name}} on {{zeit}}",
    "verifizierung.mensch.verwalter":
      "Marked as valid by {{name}} on {{zeit}} (administrator, without peer review)",
    "verifizierung.mensch.rueckgabe": "Returned for rework by {{name}} on {{zeit}}",
    "verifizierung.mensch.fruehereFassung":
      "The review applied to version v{{fassung}} — the current version has not been reviewed yet.",
    "verifizierung.mensch.fassungUnbekannt":
      "The review record does not state which version was reviewed.",
    "verifizierung.mensch.nichtBelegt": "Review not documented",
    "verifizierung.mensch.nichtAuffindbar":
      "Review: the review record this entry refers to cannot be found.",
    "verifizierung.mensch.nichtAbrufbar": "Review: review record currently unavailable.",
    "verifizierung.mensch.nichtErhoben": "Review: details not loaded.",
    "verifizierung.zeitUnbekannt": "an unknown date",
    "verifizierung.validiertVon": "Validated by: {{namen}}",
    "verifizierung.ki.titel": "Automated check",
    "verifizierung.ki.keine": "none recorded",
    "verifizierung.ki.am": "completed on {{zeit}}",
    "verifizierung.ki.vollstaendig": "check run complete",
    "verifizierung.ki.unvollstaendig": "check run incomplete ({{completed}} of {{available}})",
    "verifizierung.ki.umfangUnbekannt": "scope of the check run not recorded",
  },
  nl: {
    "verifizierung.titel": "Controlemarkering",
    "verifizierung.mensch.bewertung": "Inhoudelijk gecontroleerd door {{name}} op {{zeit}}",
    "verifizierung.mensch.verwalter":
      "Door {{name}} op {{zeit}} als geldig gemarkeerd (beheerder, zonder tegencontrole)",
    "verifizierung.mensch.rueckgabe": "Door {{name}} op {{zeit}} teruggegeven voor herwerking",
    "verifizierung.mensch.fruehereFassung":
      "De controle gold versie v{{fassung}} — de huidige versie is nog niet gecontroleerd.",
    "verifizierung.mensch.fassungUnbekannt":
      "Welke versie is gecontroleerd, staat niet in het controlebewijs.",
    "verifizierung.mensch.nichtBelegt": "Inhoudelijke controle niet vastgelegd",
    "verifizierung.mensch.nichtAuffindbar":
      "Inhoudelijke controle: het controlebewijs waarnaar dit item verwijst, is niet te vinden.",
    "verifizierung.mensch.nichtAbrufbar":
      "Inhoudelijke controle: controlebewijs momenteel niet beschikbaar.",
    "verifizierung.mensch.nichtErhoben": "Inhoudelijke controle: gegevens niet geladen.",
    "verifizierung.zeitUnbekannt": "een onbekende datum",
    "verifizierung.validiertVon": "Gevalideerd door: {{namen}}",
    "verifizierung.ki.titel": "Automatische controle",
    "verifizierung.ki.keine": "geen vastgelegd",
    "verifizierung.ki.am": "afgerond op {{zeit}}",
    "verifizierung.ki.vollstaendig": "controle volledig uitgevoerd",
    "verifizierung.ki.unvollstaendig":
      "controle onvolledig uitgevoerd ({{completed}} van {{available}})",
    "verifizierung.ki.umfangUnbekannt": "omvang van de controle niet vastgelegd",
  },
} satisfies Textmodul;
