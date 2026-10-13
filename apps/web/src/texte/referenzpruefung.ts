// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02) — DIE TEXTE DER REFERENZPRÜFUNG.
// ================================================================================================
//
// `mrun.task.referenz` ist die Beschriftung der Laufart `referenz` im KI-Laufprotokoll. Ihr Name ist
// durch die Bestandsstelle in pages/Stufe2.tsx (Schlüssel „mrun.task.<Laufart>“) vorgegeben und kann
// das Präfix dieses Moduls nicht tragen — deshalb steht er ausdrücklich in `legacySchluessel`.
//
// Ben nacharbeit-3: dazu die Anzeige des Prüfergebnisses an der Antwort und am Stichtagsvergleich
// (components/fragen/Referenzpruefung.tsx) und die Auswahl der Referenz-KI in der KI-Verwaltung
// (pages/AdminKiDetails.tsx). Je Grund des Servers ein eigener Satz — ein unbekannter Grund fällt
// auf `grund.unbekannt`, nie auf einen Rohschlüssel.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "referenzpruefung.",
  legacySchluessel: ["mrun.task.referenz"],
  de: {
    "mrun.task.referenz": "Referenzprüfung der Quellen",
    "referenzpruefung.titel": "Quellenprüfung durch eine zweite KI",
    "referenzpruefung.versuch": "Prüflauf {{nummer}} von höchstens {{hoechstens}}",
    "referenzpruefung.status.geprueft":
      "Eine eigene Referenz-KI ({{pruefer}}) hat geprüft, ob die Fundstellen die Aussagen tragen.",
    "referenzpruefung.status.nicht_pruefbar": "Nicht prüfbar.",
    "referenzpruefung.stufe.cloud": "extern",
    "referenzpruefung.stufe.local": "im Haus",
    "referenzpruefung.stufe.deterministic": "ohne Modell",
    "referenzpruefung.stufe.unbekannt": "unbekannt",
    "referenzpruefung.zustand.belegt": "Belegt",
    "referenzpruefung.zustand.teilweise_belegt": "Teilweise belegt",
    "referenzpruefung.zustand.widersprochen": "Widersprochen",
    "referenzpruefung.zustand.nicht_pruefbar": "Nicht prüfbar",
    "referenzpruefung.grund.keine_aussage":
      "Die Antwort enthält keine prüfpflichtige Tatsachenaussage.",
    "referenzpruefung.grund.keine_fundstelle":
      "Für diese Aussage liegt keine Fundstelle vor — das ist kein inhaltlicher Widerspruch.",
    "referenzpruefung.grund.fundstelle_nicht_aufgeloest":
      "Die genannte Fundstelle ließ sich mit Ihren aktuellen Rechten nicht in ihrer Fassung auflösen und gilt nicht als Beleg.",
    "referenzpruefung.grund.keine_freigabe_externe_verarbeitung":
      "Ohne Freigabe für externe Verarbeitung wurden die Inhalte nicht an die Referenz-KI übermittelt.",
    "referenzpruefung.grund.pruefer_nicht_eingerichtet":
      "In der KI-Verwaltung ist keine Referenz-KI erlaubt.",
    "referenzpruefung.grund.pruefer_nicht_verfuegbar":
      "Keine erlaubte Referenz-KI ist eingerichtet.",
    "referenzpruefung.grund.pruefer_nicht_freigegeben":
      "Für die erlaubten Referenz-KIs fehlt die Freigabe, oder die KI ist abgeschaltet.",
    "referenzpruefung.grund.pruefer_nicht_unabhaengig":
      "Jede erlaubte Referenz-KI nutzt dasselbe Modell wie die Antwort — der unabhängige Nachweis bleibt offen.",
    "referenzpruefung.grund.antwortmodell_unbekannt":
      "Das Modell der Antwort ist nicht festgehalten — die Unabhängigkeit ist nicht nachweisbar.",
    "referenzpruefung.grund.zeitlimit":
      "Die Referenz-KI hat nicht rechtzeitig geantwortet; der Aufruf wurde abgebrochen.",
    "referenzpruefung.grund.abgebrochen": "Die Prüfung wurde abgebrochen.",
    "referenzpruefung.grund.budget_erschoepft": "Das Budget für die Prüfung ist ausgeschöpft.",
    "referenzpruefung.grund.ki_abgeschaltet": "Die KI ist administrativ abgeschaltet.",
    "referenzpruefung.grund.ungueltige_pruefausgabe":
      "Die Ausgabe der Referenz-KI war ungültig und wurde verworfen.",
    "referenzpruefung.grund.pruefer_fehler": "Die Referenz-KI ist ausgefallen.",
    "referenzpruefung.grund.modellaufruf_ausgeschlossen":
      "Auf diesem Antwortweg ist jeder Modellaufruf ausgeschlossen; eine Referenzprüfung findet nicht statt.",
    "referenzpruefung.grund.kein_urteil":
      "Die Referenz-KI hat dazu kein gültiges Urteil geliefert.",
    "referenzpruefung.grund.unbekannt": "Der Grund ist nicht bekannt.",
    "referenzpruefung.grund.bestaetigung_abgelaufen":
      "Für den aktuellen Stand (Ihre Rechte, Quellen, Prüfmodell, Prüfrichtlinie) liegt kein gültiger Prüfbeleg vor — die frühere Bestätigung gilt nicht mehr.",
    "referenzpruefung.unbestaetigt":
      "Die gespeicherte Quellenprüfung wird gegen Ihre aktuellen Rechte und den aktuellen Prüfstand bestätigt …",
    "referenzpruefung.abgelaufen":
      "Die gespeicherte Quellenprüfung ist nicht mehr bestätigbar und wird nicht angezeigt. Stellen Sie die Frage erneut für eine neue Prüfung.",
    "referenzpruefung.fundstelle": "Fundstelle: {{titel}}, Fassung {{fassung}}",
    "referenzpruefung.quelleOhneTitel": "Quelle",
    "referenzpruefung.teile": "{{anzahl}} Teilaussagen einzeln",
    "referenzpruefung.aktualitaet.titel": "Aktualität und Konflikte (getrennt von der Prüfung)",
    "referenzpruefung.technisch.titel": "Technische Hinweise",
    "referenzpruefung.hinweis.neuere_fassung":
      "Die Quelle hat inzwischen eine neuere Fassung ({{aktuell}}); geprüft wurde Fassung {{gebunden}}.",
    "referenzpruefung.hinweis.abruf_nicht_belegt":
      "Für eine externe Fundstelle ist kein Abruf nachgewiesen — über ihre Aktualität wird nichts gesagt.",
    "referenzpruefung.hinweis.bekannter_konflikt":
      "Zu einer Quelle ist ein offener Konflikt mit einer anderen Quelle bekannt.",
    "referenzpruefung.hinweis.gegenpassage":
      "Eine zugängliche Fundstelle widerspricht der Aussage.",
    "referenzpruefung.hinweis.fundstelle_verworfen":
      "Eine Fundstelle wurde technisch verworfen und zählt nicht als Beleg.",
    "referenzpruefung.hinweis.nicht_aufgeloeste_modellangabe":
      "Die Antwort nennt einen Link oder eine Marke ohne Fundstelle ({{wert}}) — das ist kein Beleg.",
    "referenzpruefung.hinweis.anweisungsaehnlicher_text":
      "Der Prüfstoff enthielt anweisungsähnlichen Text; er wurde als Datum behandelt und nicht befolgt.",
    "referenzpruefung.grenze":
      "Die Prüfung sagt nur, ob die genannten Fundstellen die Aussagen tragen — sie behauptet keine allgemeine Wahrheit oder Aktualität und ist keine menschliche Freigabe.",
    "referenzpruefung.erneut.knopf": "Erneut prüfen",
    "referenzpruefung.erneut.laeuft": "Prüft …",
    "referenzpruefung.erneut.fehler": "Die erneute Prüfung ist nicht möglich.",
    "referenzpruefung.vergleich.heute": "Quellenprüfung der heutigen Antwort",
    "referenzpruefung.vergleich.damals": "Quellenprüfung der Antwort zum Stichtag",
    "referenzpruefung.admin.titel": "Referenz-KI für die Quellenprüfung",
    "referenzpruefung.admin.text":
      "Die Referenz-KI prüft ausschließlich, ob die Fundstellen einer Antwort deren Aussagen tragen. Je Frage wird die erste erlaubte Option gewählt, die ein anderes Modell nutzt als die Antwort.",
    "referenzpruefung.admin.legende": "Erlaubte Referenz-KIs (Reihenfolge = Vorrang)",
    "referenzpruefung.admin.leer":
      "Keine Referenz-KI erlaubt — jede Prüfung steht als „nicht prüfbar“.",
    "referenzpruefung.admin.vorziehen": "{{name}} nach vorn",
    "referenzpruefung.admin.rang": "Vorrang {{rang}}",
    "referenzpruefung.admin.gespeichert": "Referenz-KI gespeichert.",
  },
  en: {
    "mrun.task.referenz": "Reference check of sources",
    "referenzpruefung.titel": "Source check by a second AI",
    "referenzpruefung.versuch": "Check run {{nummer}} of at most {{hoechstens}}",
    "referenzpruefung.status.geprueft":
      "A separate reference AI ({{pruefer}}) checked whether the cited passages support the statements.",
    "referenzpruefung.status.nicht_pruefbar": "Not checkable.",
    "referenzpruefung.stufe.cloud": "external",
    "referenzpruefung.stufe.local": "in-house",
    "referenzpruefung.stufe.deterministic": "without model",
    "referenzpruefung.stufe.unbekannt": "unknown",
    "referenzpruefung.zustand.belegt": "Supported",
    "referenzpruefung.zustand.teilweise_belegt": "Partly supported",
    "referenzpruefung.zustand.widersprochen": "Contradicted",
    "referenzpruefung.zustand.nicht_pruefbar": "Not checkable",
    "referenzpruefung.grund.keine_aussage": "The answer contains no factual statement to check.",
    "referenzpruefung.grund.keine_fundstelle":
      "There is no cited passage for this statement — that is not a contradiction.",
    "referenzpruefung.grund.fundstelle_nicht_aufgeloest":
      "The cited passage could not be resolved in its version with your current rights and does not count as evidence.",
    "referenzpruefung.grund.keine_freigabe_externe_verarbeitung":
      "Without approval for external processing, the content was not sent to the reference AI.",
    "referenzpruefung.grund.pruefer_nicht_eingerichtet":
      "No reference AI is allowed in AI administration.",
    "referenzpruefung.grund.pruefer_nicht_verfuegbar": "No allowed reference AI is set up.",
    "referenzpruefung.grund.pruefer_nicht_freigegeben":
      "Approval is missing for the allowed reference AIs, or AI is switched off.",
    "referenzpruefung.grund.pruefer_nicht_unabhaengig":
      "Every allowed reference AI uses the same model as the answer — independent proof remains open.",
    "referenzpruefung.grund.antwortmodell_unbekannt":
      "The answer's model is not recorded — independence cannot be shown.",
    "referenzpruefung.grund.zeitlimit":
      "The reference AI did not answer in time; the call was cancelled.",
    "referenzpruefung.grund.abgebrochen": "The check was cancelled.",
    "referenzpruefung.grund.budget_erschoepft": "The budget for the check is exhausted.",
    "referenzpruefung.grund.ki_abgeschaltet": "AI has been switched off by the administrator.",
    "referenzpruefung.grund.ungueltige_pruefausgabe":
      "The reference AI's output was invalid and was discarded.",
    "referenzpruefung.grund.pruefer_fehler": "The reference AI failed.",
    "referenzpruefung.grund.modellaufruf_ausgeschlossen":
      "On this answer path every model call is excluded; no reference check takes place.",
    "referenzpruefung.grund.kein_urteil": "The reference AI gave no valid verdict on this.",
    "referenzpruefung.grund.unbekannt": "The reason is unknown.",
    "referenzpruefung.grund.bestaetigung_abgelaufen":
      "There is no valid check record for the current state (your rights, sources, check model, check policy) — the earlier confirmation no longer applies.",
    "referenzpruefung.unbestaetigt":
      "The saved source check is being confirmed against your current rights and the current check state …",
    "referenzpruefung.abgelaufen":
      "The saved source check can no longer be confirmed and is not shown. Ask the question again for a new check.",
    "referenzpruefung.fundstelle": "Passage: {{titel}}, version {{fassung}}",
    "referenzpruefung.quelleOhneTitel": "Source",
    "referenzpruefung.teile": "{{anzahl}} partial statements individually",
    "referenzpruefung.aktualitaet.titel": "Currency and conflicts (separate from the check)",
    "referenzpruefung.technisch.titel": "Technical notes",
    "referenzpruefung.hinweis.neuere_fassung":
      "The source now has a newer version ({{aktuell}}); version {{gebunden}} was checked.",
    "referenzpruefung.hinweis.abruf_nicht_belegt":
      "No retrieval is recorded for an external passage — nothing is said about its currency.",
    "referenzpruefung.hinweis.bekannter_konflikt":
      "An open conflict with another source is known for one source.",
    "referenzpruefung.hinweis.gegenpassage": "An accessible passage contradicts the statement.",
    "referenzpruefung.hinweis.fundstelle_verworfen":
      "A passage was rejected technically and does not count as evidence.",
    "referenzpruefung.hinweis.nicht_aufgeloeste_modellangabe":
      "The answer names a link or marker without a passage ({{wert}}) — that is not evidence.",
    "referenzpruefung.hinweis.anweisungsaehnlicher_text":
      "The material contained instruction-like text; it was treated as data and not followed.",
    "referenzpruefung.grenze":
      "The check only says whether the cited passages support the statements — it claims no general truth or currency and is not a human approval.",
    "referenzpruefung.erneut.knopf": "Check again",
    "referenzpruefung.erneut.laeuft": "Checking …",
    "referenzpruefung.erneut.fehler": "Checking again is not possible.",
    "referenzpruefung.vergleich.heute": "Source check of today's answer",
    "referenzpruefung.vergleich.damals": "Source check of the answer at the reference date",
    "referenzpruefung.admin.titel": "Reference AI for the source check",
    "referenzpruefung.admin.text":
      "The reference AI only checks whether an answer's passages support its statements. For each question the first allowed option using a different model than the answer is chosen.",
    "referenzpruefung.admin.legende": "Allowed reference AIs (order = priority)",
    "referenzpruefung.admin.leer": "No reference AI allowed — every check shows “not checkable”.",
    "referenzpruefung.admin.vorziehen": "Move {{name}} up",
    "referenzpruefung.admin.rang": "Priority {{rang}}",
    "referenzpruefung.admin.gespeichert": "Reference AI saved.",
  },
  nl: {
    "mrun.task.referenz": "Referentiecontrole van bronnen",
    "referenzpruefung.titel": "Broncontrole door een tweede AI",
    "referenzpruefung.versuch": "Controle {{nummer}} van hoogstens {{hoechstens}}",
    "referenzpruefung.status.geprueft":
      "Een eigen referentie-AI ({{pruefer}}) heeft gecontroleerd of de vindplaatsen de uitspraken dragen.",
    "referenzpruefung.status.nicht_pruefbar": "Niet controleerbaar.",
    "referenzpruefung.stufe.cloud": "extern",
    "referenzpruefung.stufe.local": "intern",
    "referenzpruefung.stufe.deterministic": "zonder model",
    "referenzpruefung.stufe.unbekannt": "onbekend",
    "referenzpruefung.zustand.belegt": "Onderbouwd",
    "referenzpruefung.zustand.teilweise_belegt": "Deels onderbouwd",
    "referenzpruefung.zustand.widersprochen": "Weersproken",
    "referenzpruefung.zustand.nicht_pruefbar": "Niet controleerbaar",
    "referenzpruefung.grund.keine_aussage":
      "Het antwoord bevat geen feitelijke uitspraak om te controleren.",
    "referenzpruefung.grund.keine_fundstelle":
      "Voor deze uitspraak is er geen vindplaats — dat is geen tegenspraak.",
    "referenzpruefung.grund.fundstelle_nicht_aufgeloest":
      "De genoemde vindplaats kon met uw huidige rechten niet in haar versie worden opgehaald en telt niet als bewijs.",
    "referenzpruefung.grund.keine_freigabe_externe_verarbeitung":
      "Zonder vrijgave voor externe verwerking is de inhoud niet naar de referentie-AI gestuurd.",
    "referenzpruefung.grund.pruefer_nicht_eingerichtet":
      "In het AI-beheer is geen referentie-AI toegestaan.",
    "referenzpruefung.grund.pruefer_nicht_verfuegbar":
      "Geen toegestane referentie-AI is ingericht.",
    "referenzpruefung.grund.pruefer_nicht_freigegeben":
      "Voor de toegestane referentie-AI's ontbreekt de vrijgave, of AI is uitgeschakeld.",
    "referenzpruefung.grund.pruefer_nicht_unabhaengig":
      "Elke toegestane referentie-AI gebruikt hetzelfde model als het antwoord — het onafhankelijke bewijs blijft open.",
    "referenzpruefung.grund.antwortmodell_unbekannt":
      "Het model van het antwoord is niet vastgelegd — onafhankelijkheid is niet aantoonbaar.",
    "referenzpruefung.grund.zeitlimit":
      "De referentie-AI antwoordde niet op tijd; de aanroep is afgebroken.",
    "referenzpruefung.grund.abgebrochen": "De controle is afgebroken.",
    "referenzpruefung.grund.budget_erschoepft": "Het budget voor de controle is op.",
    "referenzpruefung.grund.ki_abgeschaltet": "AI is door de beheerder uitgeschakeld.",
    "referenzpruefung.grund.ungueltige_pruefausgabe":
      "De uitvoer van de referentie-AI was ongeldig en is verworpen.",
    "referenzpruefung.grund.pruefer_fehler": "De referentie-AI is uitgevallen.",
    "referenzpruefung.grund.modellaufruf_ausgeschlossen":
      "Op deze antwoordweg is elke modelaanroep uitgesloten; er vindt geen referentiecontrole plaats.",
    "referenzpruefung.grund.kein_urteil": "De referentie-AI gaf hierover geen geldig oordeel.",
    "referenzpruefung.grund.unbekannt": "De reden is onbekend.",
    "referenzpruefung.grund.bestaetigung_abgelaufen":
      "Voor de huidige stand (uw rechten, bronnen, controlemodel, controlerichtlijn) is er geen geldig controlebewijs — de eerdere bevestiging geldt niet meer.",
    "referenzpruefung.unbestaetigt":
      "De opgeslagen broncontrole wordt bevestigd tegen uw huidige rechten en de huidige controlestand …",
    "referenzpruefung.abgelaufen":
      "De opgeslagen broncontrole kan niet meer worden bevestigd en wordt niet getoond. Stel de vraag opnieuw voor een nieuwe controle.",
    "referenzpruefung.fundstelle": "Vindplaats: {{titel}}, versie {{fassung}}",
    "referenzpruefung.quelleOhneTitel": "Bron",
    "referenzpruefung.teile": "{{anzahl}} deeluitspraken afzonderlijk",
    "referenzpruefung.aktualitaet.titel": "Actualiteit en conflicten (los van de controle)",
    "referenzpruefung.technisch.titel": "Technische opmerkingen",
    "referenzpruefung.hinweis.neuere_fassung":
      "De bron heeft inmiddels een nieuwere versie ({{aktuell}}); versie {{gebunden}} is gecontroleerd.",
    "referenzpruefung.hinweis.abruf_nicht_belegt":
      "Voor een externe vindplaats is geen ophaling aangetoond — over de actualiteit wordt niets gezegd.",
    "referenzpruefung.hinweis.bekannter_konflikt":
      "Voor een bron is een open conflict met een andere bron bekend.",
    "referenzpruefung.hinweis.gegenpassage":
      "Een toegankelijke vindplaats weerspreekt de uitspraak.",
    "referenzpruefung.hinweis.fundstelle_verworfen":
      "Een vindplaats is technisch verworpen en telt niet als bewijs.",
    "referenzpruefung.hinweis.nicht_aufgeloeste_modellangabe":
      "Het antwoord noemt een link of markering zonder vindplaats ({{wert}}) — dat is geen bewijs.",
    "referenzpruefung.hinweis.anweisungsaehnlicher_text":
      "Het materiaal bevatte instructie-achtige tekst; die is als gegeven behandeld en niet opgevolgd.",
    "referenzpruefung.grenze":
      "De controle zegt alleen of de genoemde vindplaatsen de uitspraken dragen — zij beweert geen algemene waarheid of actualiteit en is geen menselijke vrijgave.",
    "referenzpruefung.erneut.knopf": "Opnieuw controleren",
    "referenzpruefung.erneut.laeuft": "Controleert …",
    "referenzpruefung.erneut.fehler": "Opnieuw controleren is niet mogelijk.",
    "referenzpruefung.vergleich.heute": "Broncontrole van het antwoord van vandaag",
    "referenzpruefung.vergleich.damals": "Broncontrole van het antwoord op de peildatum",
    "referenzpruefung.admin.titel": "Referentie-AI voor de broncontrole",
    "referenzpruefung.admin.text":
      "De referentie-AI controleert uitsluitend of de vindplaatsen van een antwoord de uitspraken dragen. Per vraag wordt de eerste toegestane optie gekozen die een ander model gebruikt dan het antwoord.",
    "referenzpruefung.admin.legende": "Toegestane referentie-AI's (volgorde = voorrang)",
    "referenzpruefung.admin.leer":
      "Geen referentie-AI toegestaan — elke controle staat als „niet controleerbaar”.",
    "referenzpruefung.admin.vorziehen": "{{name}} naar voren",
    "referenzpruefung.admin.rang": "Voorrang {{rang}}",
    "referenzpruefung.admin.gespeichert": "Referentie-AI opgeslagen.",
  },
} satisfies Textmodul;
