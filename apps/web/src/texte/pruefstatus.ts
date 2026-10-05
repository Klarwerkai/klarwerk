// ================================================================================================
// AUFNAHME 20260922 · PRÜFSTATUS-ANZEIGE — KI-Prüfung, menschliche Freigabe, Nutzbarkeit.
// ================================================================================================
//
// Die Texte, mit denen die Oberfläche drei Dinge auseinanderhält, die leicht verwechselt werden:
// was die KI geprüft hat (R-0208), ob ein Mensch fachlich geprüft hat (N-0054) und was davon in
// einer Antwort ungeprüft ist (R-0223). Das Wort „validiert" für eine KI-Prüfung kommt hier
// bewusst nicht vor.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "pruefstatus.",
  legacySchluessel: [],
  de: {
    "pruefstatus.ki.ausstehend": "Prüfung ausstehend",
    "pruefstatus.ki.ausstehendKi": "KI-Prüfung ausstehend",
    "pruefstatus.ki.ausstehendHinweis":
      "Die Duplikat-/Konfliktprüfung ist eingereiht und hat noch nicht begonnen. Das Ergebnis erscheint hier, sobald sie gelaufen ist.",
    "pruefstatus.ki.geprueft": "Geprüft – keine Freigabe",
    "pruefstatus.ki.geprueftKi": "KI-geprüft – keine Freigabe",
    "pruefstatus.ki.geprueftHinweis":
      "Die Duplikat-/Konfliktprüfung ist abgeschlossen. Das ist keine menschliche Freigabe: ob der Eintrag gilt, entscheiden Prüfende.",
    "pruefstatus.ki.konflikt": "Konflikt gefunden",
    "pruefstatus.ki.konfliktHinweis":
      "Die automatische Prüfung hat einen offenen Konflikt mit vorhandenem Wissen gefunden. Er wird unter „Konflikte“ geklärt – das ist weder Freigabe noch Ablehnung.",
    "pruefstatus.ki.unsicher": "Unsicher – nur teilgeprüft",
    "pruefstatus.ki.nichtVerfuegbar": "KI nicht verfügbar",
    "pruefstatus.wert.nochNichtGeprueft": "Noch nicht fachlich geprüft",
    "pruefstatus.bewertung.rest_one":
      "Noch {{count}} positive Bewertung bis zur Validierung ({{have}} von {{need}})",
    "pruefstatus.bewertung.rest_other":
      "Noch {{count}} positive Bewertungen bis zur Validierung ({{have}} von {{need}})",
    "pruefstatus.bewertung.genug": "Genug positive Bewertungen ({{have}} von {{need}})",
    "pruefstatus.bewertung.blockiert_one": "{{count}} rote Bewertung blockiert die Validierung",
    "pruefstatus.bewertung.blockiert_other":
      "{{count}} rote Bewertungen blockieren die Validierung",
    "pruefstatus.quellen.filterLabel": "Quellen filtern",
    "pruefstatus.quellen.alle_one": "Alle ({{count}})",
    "pruefstatus.quellen.alle_other": "Alle ({{count}})",
    "pruefstatus.quellen.nurUngeprueft_one": "Nur ungeprüfte ({{count}})",
    "pruefstatus.quellen.nurUngeprueft_other": "Nur ungeprüfte ({{count}})",
    "pruefstatus.quellen.gefiltert_one":
      "Gezeigt wird {{count}} von {{total}} Quellen: die, die noch niemand geprüft und freigegeben hat.",
    "pruefstatus.quellen.gefiltert_other":
      "Gezeigt werden {{count}} von {{total}} Quellen: die, die noch niemand geprüft und freigegeben hat.",
  },
  en: {
    "pruefstatus.ki.ausstehend": "Check pending",
    "pruefstatus.ki.ausstehendKi": "AI check pending",
    "pruefstatus.ki.ausstehendHinweis":
      "The duplicate/conflict check is queued and has not started yet. The result appears here once it has run.",
    "pruefstatus.ki.geprueft": "Checked – not approved",
    "pruefstatus.ki.geprueftKi": "AI-checked – not approved",
    "pruefstatus.ki.geprueftHinweis":
      "The duplicate/conflict check has finished. This is not a human approval: reviewers decide whether the entry applies.",
    "pruefstatus.ki.konflikt": "Conflict found",
    "pruefstatus.ki.konfliktHinweis":
      "The automatic check found an open conflict with existing knowledge. It is resolved under “Conflicts” – this is neither approval nor rejection.",
    "pruefstatus.ki.unsicher": "Uncertain – only partly checked",
    "pruefstatus.ki.nichtVerfuegbar": "AI not available",
    "pruefstatus.wert.nochNichtGeprueft": "Not yet reviewed by an expert",
    "pruefstatus.bewertung.rest_one":
      "{{count}} more positive review needed for validation ({{have}} of {{need}})",
    "pruefstatus.bewertung.rest_other":
      "{{count}} more positive reviews needed for validation ({{have}} of {{need}})",
    "pruefstatus.bewertung.genug": "Enough positive reviews ({{have}} of {{need}})",
    "pruefstatus.bewertung.blockiert_one": "{{count}} red review blocks validation",
    "pruefstatus.bewertung.blockiert_other": "{{count}} red reviews block validation",
    "pruefstatus.quellen.filterLabel": "Filter sources",
    "pruefstatus.quellen.alle_one": "All ({{count}})",
    "pruefstatus.quellen.alle_other": "All ({{count}})",
    "pruefstatus.quellen.nurUngeprueft_one": "Unreviewed only ({{count}})",
    "pruefstatus.quellen.nurUngeprueft_other": "Unreviewed only ({{count}})",
    "pruefstatus.quellen.gefiltert_one":
      "Showing {{count}} of {{total}} sources: the one nobody has reviewed and approved yet.",
    "pruefstatus.quellen.gefiltert_other":
      "Showing {{count}} of {{total}} sources: those nobody has reviewed and approved yet.",
  },
  nl: {
    "pruefstatus.ki.ausstehend": "Controle in afwachting",
    "pruefstatus.ki.ausstehendKi": "AI-controle in afwachting",
    "pruefstatus.ki.ausstehendHinweis":
      "De duplicaat-/conflictcontrole staat in de wachtrij en is nog niet begonnen. Het resultaat verschijnt hier zodra ze is uitgevoerd.",
    "pruefstatus.ki.geprueft": "Gecontroleerd – niet goedgekeurd",
    "pruefstatus.ki.geprueftKi": "Door AI gecontroleerd – niet goedgekeurd",
    "pruefstatus.ki.geprueftHinweis":
      "De duplicaat-/conflictcontrole is afgerond. Dit is geen goedkeuring door een mens: beoordelaars beslissen of het item geldt.",
    "pruefstatus.ki.konflikt": "Conflict gevonden",
    "pruefstatus.ki.konfliktHinweis":
      "De automatische controle heeft een open conflict met bestaande kennis gevonden. Het wordt onder „Conflicten” opgelost – dit is goedkeuring noch afwijzing.",
    "pruefstatus.ki.unsicher": "Onzeker – slechts deels gecontroleerd",
    "pruefstatus.ki.nichtVerfuegbar": "AI niet beschikbaar",
    "pruefstatus.wert.nochNichtGeprueft": "Nog niet inhoudelijk beoordeeld",
    "pruefstatus.bewertung.rest_one":
      "Nog {{count}} positieve beoordeling nodig voor validatie ({{have}} van {{need}})",
    "pruefstatus.bewertung.rest_other":
      "Nog {{count}} positieve beoordelingen nodig voor validatie ({{have}} van {{need}})",
    "pruefstatus.bewertung.genug": "Genoeg positieve beoordelingen ({{have}} van {{need}})",
    "pruefstatus.bewertung.blockiert_one": "{{count}} rode beoordeling blokkeert de validatie",
    "pruefstatus.bewertung.blockiert_other": "{{count}} rode beoordelingen blokkeren de validatie",
    "pruefstatus.quellen.filterLabel": "Bronnen filteren",
    "pruefstatus.quellen.alle_one": "Alle ({{count}})",
    "pruefstatus.quellen.alle_other": "Alle ({{count}})",
    "pruefstatus.quellen.nurUngeprueft_one": "Alleen niet beoordeeld ({{count}})",
    "pruefstatus.quellen.nurUngeprueft_other": "Alleen niet beoordeeld ({{count}})",
    "pruefstatus.quellen.gefiltert_one":
      "Getoond wordt {{count}} van {{total}} bronnen: de bron die nog niemand heeft beoordeeld en goedgekeurd.",
    "pruefstatus.quellen.gefiltert_other":
      "Getoond worden {{count}} van {{total}} bronnen: de bronnen die nog niemand heeft beoordeeld en goedgekeurd.",
  },
} satisfies Textmodul;
