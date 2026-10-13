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
    // REF-04: Gesamtkennzeichnung, Bedeutung, Fundstellenwechsel und nächster Schritt.
    "referenzpruefung.gesamt.quellen_geprueft": "Quellen geprüft",
    "referenzpruefung.gesamt.gemischt": "Entwurf · Quellen nur teilweise bestätigt",
    "referenzpruefung.gesamt.nicht_pruefbar": "Entwurf · Quellen nicht prüfbar",
    "referenzpruefung.gesamt.nicht_abgeschlossen": "Entwurf · Prüfung nicht abgeschlossen",
    "referenzpruefung.gesamt.laeuft": "Entwurf · Prüfung läuft",
    "referenzpruefung.gesamt.offen": "Entwurf · Quellenprüfung offen",
    "referenzpruefung.gesamt.fremde_fassung":
      "Entwurf · Prüfung gehört zu einer anderen Antwortfassung",
    "referenzpruefung.gesamt.keine_aussage": "Keine prüfpflichtige Aussage",
    "referenzpruefung.entwurfHinweis":
      "Diese Antwort ist nicht als Ganzes durch Quellen bestätigt. Sie bleibt sichtbar, ist aber keine Quellenfreigabe.",
    "referenzpruefung.bedeutung":
      "„Belegt“ heißt: Die genannte Fundstelle trägt die Aussage. Es heißt nicht: garantiert wahr oder aktuell.",
    "referenzpruefung.detail.oeffnen": "Fundstelle und Begründung zeigen",
    "referenzpruefung.detail.schliessen": "Fundstelle und Begründung schließen",
    "referenzpruefung.detail.titel": "Fundstelle und Prüfbegründung",
    "referenzpruefung.detail.passageOhne":
      "Die Passage liegt dieser Ansicht nicht vor. Öffnen Sie die Quelle in der geprüften Fassung.",
    "referenzpruefung.detail.keineFundstelle":
      "Zu dieser Aussage gibt es keine zugängliche Fundstelle.",
    "referenzpruefung.detail.begruendung": "Begründung:",
    "referenzpruefung.detail.zurueck": "Zurück zur Aussage",
    "referenzpruefung.naechster.label": "Nächster Schritt:",
    "referenzpruefung.naechster.erneut": "Sie können die Prüfung einmal erneut anstoßen.",
    "referenzpruefung.naechster.unbekannt":
      "Stellen Sie die Frage erneut. Bleibt der Zustand, melden Sie ihn der Verwaltung.",
    "referenzpruefung.naechster.keine_aussage":
      "Nichts zu tun. Die Antwort enthält keine Tatsachenaussage, die eine Quelle bräuchte.",
    "referenzpruefung.naechster.keine_fundstelle":
      "Prüfen Sie die Aussage selbst an einer Quelle oder melden Sie die fehlende Quelle über die Meldefunktion der Antwort.",
    "referenzpruefung.naechster.fundstelle_nicht_aufgeloest":
      "Die Quelle ist für Sie nicht (mehr) zugänglich oder wurde geändert. Stellen Sie die Frage erneut.",
    "referenzpruefung.naechster.keine_freigabe_externe_verarbeitung":
      "Die Verwaltung kann die Freigabe für externe Verarbeitung erteilen oder eine interne Referenz-KI erlauben (Verwaltung → KI → Referenzprüfung).",
    "referenzpruefung.naechster.pruefer_nicht_eingerichtet":
      "Die Verwaltung erlaubt eine Referenz-KI unter Verwaltung → KI → Referenzprüfung. Stellen Sie die Frage danach erneut.",
    "referenzpruefung.naechster.pruefer_nicht_verfuegbar":
      "Die Verwaltung richtet eine erlaubte Referenz-KI unter KI-Zugänge ein. Stellen Sie die Frage danach erneut.",
    "referenzpruefung.naechster.pruefer_nicht_freigegeben":
      "Die Verwaltung erteilt die Freigabe oder hebt die KI-Abschaltung auf (Verwaltung → KI).",
    "referenzpruefung.naechster.pruefer_nicht_unabhaengig":
      "Die Verwaltung erlaubt zusätzlich eine Referenz-KI mit einem anderen Modell als die Antwort-KI.",
    "referenzpruefung.naechster.antwortmodell_unbekannt":
      "Stellen Sie die Frage erneut. Erst mit festgehaltenem Antwortmodell ist eine unabhängige Prüfung möglich.",
    "referenzpruefung.naechster.zeitlimit": "Versuchen Sie es in einem Moment noch einmal.",
    "referenzpruefung.naechster.abgebrochen":
      "Stellen Sie die Frage erneut, um sie prüfen zu lassen.",
    "referenzpruefung.naechster.budget_erschoepft":
      "Stellen Sie eine engere Frage. Bleibt das Budget erschöpft, wenden Sie sich an die Verwaltung.",
    "referenzpruefung.naechster.ki_abgeschaltet":
      "Die Verwaltung hebt die KI-Abschaltung auf. Bis dahin bleibt die Antwort ungeprüft.",
    "referenzpruefung.naechster.ungueltige_pruefausgabe":
      "Versuchen Sie es noch einmal. Bleibt die Ausgabe ungültig, prüft die Verwaltung die Referenz-KI mit dem Funktionscheck.",
    "referenzpruefung.naechster.pruefer_fehler":
      "Versuchen Sie es noch einmal. Fällt die Referenz-KI weiter aus, prüft die Verwaltung den Zugang.",
    "referenzpruefung.naechster.modellaufruf_ausgeschlossen":
      "Auf diesem Weg ist das so vorgesehen. Für eine geprüfte Antwort stellen Sie die Frage auf der Fragenseite.",
    "referenzpruefung.naechster.bestaetigung_abgelaufen":
      "Stellen Sie die Frage erneut, damit die aktuelle Fassung mit den aktuellen Rechten geprüft wird.",
    "referenzpruefung.naechster.kein_urteil": "Prüfen Sie die Aussage selbst an der Fundstelle.",
    "referenzpruefung.zweitmeinung.titel": "Quellenprüfung dieser Antwort",
    "referenzpruefung.admin.titel": "Referenz-KI für die Quellenprüfung",
    "referenzpruefung.admin.text":
      "Die Referenz-KI prüft ausschließlich, ob die Fundstellen einer Antwort deren Aussagen tragen. Je Frage wird die erste erlaubte Option gewählt, die ein anderes Modell nutzt als die Antwort.",
    "referenzpruefung.admin.legende": "Erlaubte Referenz-KIs (Reihenfolge = Vorrang)",
    "referenzpruefung.admin.leer":
      "Keine Referenz-KI erlaubt — jede Prüfung steht als „nicht prüfbar“.",
    "referenzpruefung.admin.vorziehen": "{{name}} nach vorn",
    "referenzpruefung.admin.rang": "Vorrang {{rang}}",
    "referenzpruefung.admin.gespeichert": "Referenz-KI gespeichert.",
    // REF-03: der Einstieg „Referenzprüfung" unter Verwaltung → KI.
    "referenzpruefung.einstieg.titel": "Referenzprüfung",
    "referenzpruefung.einstieg.wert": "{{anzahl}} erlaubt",
    "referenzpruefung.einstieg.aus": "aus",
    "referenzpruefung.admin.verweis":
      "Die Referenz-KI für die Quellenprüfung wählen Sie unter Verwaltung → KI → Referenzprüfung.",
    "referenzpruefung.admin.rolle":
      "Die Referenz-KI ist eine eigene, nur lesende Prüfrolle. Sie prüft ausschließlich, ob die Fundstellen einer Antwort deren Aussagen tragen. Sie muss ein anderes Modell nutzen als die Antwort-KI. Das ist eine zweite KI-Prüfung, keine menschliche Freigabe.",
    "referenzpruefung.admin.quelle":
      "Zur Wahl stehen die KI-Zugänge, die in der Providerverwaltung registriert sind (siehe KI-Zugänge). Schlüssel werden hier weder abgelegt noch angezeigt.",
    "referenzpruefung.admin.art.intern": "intern",
    "referenzpruefung.admin.art.oeffentlich": "öffentlich",
    "referenzpruefung.admin.modell": "Modell: {{modell}}",
    "referenzpruefung.admin.modellUnbekannt": "Modell: nicht genannt",
    "referenzpruefung.admin.zustandLabel": "Zustand: {{zustand}}",
    "referenzpruefung.admin.zustand.nicht_eingerichtet": "nicht eingerichtet",
    "referenzpruefung.admin.zustand.ausgeschaltet": "ausgeschaltet",
    "referenzpruefung.admin.zustand.nicht_verfuegbar": "nicht verfügbar",
    "referenzpruefung.admin.zustand.konfiguriert": "konfiguriert, noch nicht geprüft",
    "referenzpruefung.admin.zustand.letzte_pruefung_erfolgreich": "letzte Prüfung erfolgreich",
    "referenzpruefung.admin.zustand.letzte_pruefung_fehlgeschlagen":
      "letzte Prüfung fehlgeschlagen",
    "referenzpruefung.admin.hilfe.nicht_eingerichtet":
      "Dieser Zugang ist nicht eingerichtet. Der Betreiber richtet ihn in der Providerverwaltung ein (KI-Zugänge).",
    "referenzpruefung.admin.hilfe.konfiguriert":
      "Konfiguriert ist noch kein Nachweis. Erst ein Funktionscheck oder eine echte Prüfung zeigt, ob die Quellenprüfung gelingt.",
    "referenzpruefung.admin.sperre.ki_abgeschaltet":
      "Die KI ist administrativ abgeschaltet. Nächster Schritt: die Abschaltung in der KI-Verwaltung aufheben.",
    "referenzpruefung.admin.sperre.keine_freigabe_externe_verarbeitung":
      "Gesperrt: Für öffentliche KI fehlt die Freigabe für externe Verarbeitung. Nächster Schritt: die Freigabe unter Verwaltung → KI → KI-Verwaltung erteilen oder eine interne KI wählen.",
    "referenzpruefung.admin.sperre.nicht_erreichbar":
      "Der Zugang ist eingerichtet, aber gerade nicht erreichbar. Nächster Schritt: Verbindung unter KI-Zugänge testen oder eine weitere Referenz-KI erlauben.",
    "referenzpruefung.admin.sperre.kein_pruefmodell":
      "Der Zugang nennt kein Modell oder bietet keine Prüfung an. Ohne Modellangabe ist die Unabhängigkeit nicht nachweisbar.",
    "referenzpruefung.admin.gleichesModell":
      "Gleiches Modell wie die Antwort-KI — diese Option prüft nie Antworten dieses Modells.",
    "referenzpruefung.admin.antwortmodell": "Antwort-KI heute: {{name}}",
    "referenzpruefung.admin.antwortmodellOhne": "Antwort-KI heute: kein Modell (Ersatzmodus)",
    "referenzpruefung.admin.konflikt":
      "Kein unabhängiger Prüfer: Jede einsatzbereite erlaubte Referenz-KI nutzt dasselbe Modell wie die Antwort-KI. Erlauben Sie zusätzlich eine KI mit anderem Modell. Bis dahin bleibt der Prüfstatus offen, und es gibt kein Vier-Augen-Ergebnis.",
    "referenzpruefung.admin.keineEinsatzbereit":
      "Keine erlaubte Referenz-KI ist einsatzbereit. Wissensbezogene Antworten bleiben mit offenem Prüfstatus „nicht prüfbar“. Erlauben Sie eine eingerichtete KI oder beheben Sie die genannte Sperre.",
    "referenzpruefung.admin.keineBestaetigung":
      "Eine ungeprüfte Antwort kann hier nicht als bestätigt erklärt werden. Bestätigen kann nur eine tatsächliche Prüfung.",
    "referenzpruefung.admin.freigabe.titel": "Freigaben",
    "referenzpruefung.admin.freigabe.text":
      "Öffentliche Referenz-KIs erhalten Inhalte nur mit der Freigabe für externe Verarbeitung, vertrauliche Inhalte zusätzlich nur mit der zweiten Freigabe. Die Auswahl hier hebt keine Space-, Nutzer-, Mandanten- oder Datenfreigabe auf. Fehlt eine Freigabe, steht die Prüfung sichtbar als „nicht prüfbar“.",
    "referenzpruefung.admin.freigabe.stand":
      "Öffentliche KI: {{oeffentlich}} · Vertrauliches: {{vertraulich}}",
    "referenzpruefung.admin.freigabe.an": "freigegeben",
    "referenzpruefung.admin.freigabe.aus": "gesperrt",
    "referenzpruefung.admin.envGesperrt":
      "Die KI-Zuordnung ist per Betreibereinstellung festgelegt. Änderungen sind hier gesperrt.",
    "referenzpruefung.admin.grenzen.titel": "Grenzen",
    "referenzpruefung.admin.grenzen.text":
      "Je Prüfung ein Modellaufruf mit höchstens {{sekunden}} s, {{token}} Antwort-Token, {{posten}} Prüfposten und {{zeichen}} Zeichen Prüfstoff. Höchstens {{erneut}} ausdrücklich angestoßene erneute Prüfung, keine automatische Wiederholung. Prüfrichtlinie {{richtlinie}}.",
    "referenzpruefung.admin.preise.hinterlegt":
      "Kosten nach der Preisliste des Betreibers ({{waehrung}}, Stand {{stand}}). Jeder Prüfaufruf steht im KI-Laufprotokoll.",
    "referenzpruefung.admin.preise.fehlt":
      "Keine Preisliste hinterlegt: Kosten werden nicht berechnet. Der Tokenverbrauch steht im KI-Laufprotokoll.",
    "referenzpruefung.admin.check.titel": "Funktionscheck",
    "referenzpruefung.admin.check.text":
      "Sendet einmal fiktiven Prüfstoff an die gewählte KI. Das ist ein echter Modellaufruf und kann Kosten verursachen. Er läuft nur auf Klick, nie beim Öffnen dieser Seite.",
    "referenzpruefung.admin.check.knopf": "Funktionscheck",
    "referenzpruefung.admin.check.knopfLabel": "Funktionscheck für {{name}} starten",
    "referenzpruefung.admin.check.laeuft": "Prüft …",
    "referenzpruefung.admin.check.ergebnis.erfolgreich": "erfolgreich",
    "referenzpruefung.admin.check.ergebnis.fehlgeschlagen": "fehlgeschlagen",
    "referenzpruefung.admin.check.zeile":
      "Letzter Funktionscheck: {{ergebnis}} · {{zeit}} · Modell {{modell}} · {{dauer}} ms",
    "referenzpruefung.admin.check.andereModell":
      "Der letzte Funktionscheck lief mit einem anderen Modell ({{modell}}) und gilt nicht für das heutige.",
    "referenzpruefung.admin.check.verbrauch":
      "Tatsächlicher Modellaufruf · {{eingabe}} Eingabe- und {{ausgabe}} Ausgabe-Token",
    "referenzpruefung.admin.check.keinVerbrauch":
      "Tatsächlicher Modellaufruf · Verbrauch nicht gemeldet",
    "referenzpruefung.admin.check.keinAufruf": "Kein Modellaufruf — es wurde nichts gesendet.",
    "referenzpruefung.admin.check.kosten": "Kosten: {{betrag}} {{waehrung}}",
    "referenzpruefung.admin.check.keineKosten": "Kosten: nicht berechenbar",
    "referenzpruefung.admin.check.grund.falsches_urteil":
      "Die Prüfausgabe war gültig, aber das Urteil über den fiktiven Prüfstoff war falsch.",
    "referenzpruefung.admin.check.nichtGespeichert":
      "Das Ergebnis konnte nicht im Protokoll gespeichert werden.",
    "referenzpruefung.admin.check.fehler": "Der Funktionscheck ist nicht möglich: {{meldung}}",
    "referenzpruefung.admin.check.keinModell": "nicht genannt",
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
    "referenzpruefung.gesamt.quellen_geprueft": "Sources checked",
    "referenzpruefung.gesamt.gemischt": "Draft · sources only partly confirmed",
    "referenzpruefung.gesamt.nicht_pruefbar": "Draft · sources not checkable",
    "referenzpruefung.gesamt.nicht_abgeschlossen": "Draft · check not completed",
    "referenzpruefung.gesamt.laeuft": "Draft · check running",
    "referenzpruefung.gesamt.offen": "Draft · source check open",
    "referenzpruefung.gesamt.fremde_fassung": "Draft · check belongs to another answer version",
    "referenzpruefung.gesamt.keine_aussage": "No statement to check",
    "referenzpruefung.entwurfHinweis":
      "This answer is not confirmed by sources as a whole. It stays visible but is not a source approval.",
    "referenzpruefung.bedeutung":
      "“Supported” means: the cited passage supports the statement. It does not mean: guaranteed true or current.",
    "referenzpruefung.detail.oeffnen": "Show passage and reasoning",
    "referenzpruefung.detail.schliessen": "Close passage and reasoning",
    "referenzpruefung.detail.titel": "Passage and check reasoning",
    "referenzpruefung.detail.passageOhne":
      "The passage is not available in this view. Open the source in the checked version.",
    "referenzpruefung.detail.keineFundstelle": "There is no accessible passage for this statement.",
    "referenzpruefung.detail.begruendung": "Reasoning:",
    "referenzpruefung.detail.zurueck": "Back to the statement",
    "referenzpruefung.naechster.label": "Next step:",
    "referenzpruefung.naechster.erneut": "You can trigger the check once more.",
    "referenzpruefung.naechster.unbekannt":
      "Ask the question again. If the state remains, report it to the administration.",
    "referenzpruefung.naechster.keine_aussage":
      "Nothing to do. The answer contains no factual statement that needs a source.",
    "referenzpruefung.naechster.keine_fundstelle":
      "Check the statement yourself against a source or report the missing source via the answer's report function.",
    "referenzpruefung.naechster.fundstelle_nicht_aufgeloest":
      "The source is not (or no longer) accessible to you or has changed. Ask the question again.",
    "referenzpruefung.naechster.keine_freigabe_externe_verarbeitung":
      "The administration can grant approval for external processing or allow an internal reference AI (Administration → AI → Reference check).",
    "referenzpruefung.naechster.pruefer_nicht_eingerichtet":
      "The administration allows a reference AI under Administration → AI → Reference check. Then ask the question again.",
    "referenzpruefung.naechster.pruefer_nicht_verfuegbar":
      "The administration sets up an allowed reference AI under AI accesses. Then ask the question again.",
    "referenzpruefung.naechster.pruefer_nicht_freigegeben":
      "The administration grants approval or lifts the AI switch-off (Administration → AI).",
    "referenzpruefung.naechster.pruefer_nicht_unabhaengig":
      "The administration also allows a reference AI with a different model than the answering AI.",
    "referenzpruefung.naechster.antwortmodell_unbekannt":
      "Ask the question again. An independent check needs the answer model to be recorded.",
    "referenzpruefung.naechster.zeitlimit": "Try again in a moment.",
    "referenzpruefung.naechster.abgebrochen": "Ask the question again to have it checked.",
    "referenzpruefung.naechster.budget_erschoepft":
      "Ask a narrower question. If the budget stays exhausted, contact the administration.",
    "referenzpruefung.naechster.ki_abgeschaltet":
      "The administration lifts the AI switch-off. Until then the answer stays unchecked.",
    "referenzpruefung.naechster.ungueltige_pruefausgabe":
      "Try again. If the output stays invalid, the administration checks the reference AI with the function check.",
    "referenzpruefung.naechster.pruefer_fehler":
      "Try again. If the reference AI keeps failing, the administration checks the access.",
    "referenzpruefung.naechster.modellaufruf_ausgeschlossen":
      "This is intended on this path. For a checked answer, ask on the questions page.",
    "referenzpruefung.naechster.bestaetigung_abgelaufen":
      "Ask the question again so that the current version is checked with your current rights.",
    "referenzpruefung.naechster.kein_urteil": "Check the statement yourself against the passage.",
    "referenzpruefung.zweitmeinung.titel": "Source check of this answer",
    "referenzpruefung.admin.titel": "Reference AI for the source check",
    "referenzpruefung.admin.text":
      "The reference AI only checks whether an answer's passages support its statements. For each question the first allowed option using a different model than the answer is chosen.",
    "referenzpruefung.admin.legende": "Allowed reference AIs (order = priority)",
    "referenzpruefung.admin.leer": "No reference AI allowed — every check shows “not checkable”.",
    "referenzpruefung.admin.vorziehen": "Move {{name}} up",
    "referenzpruefung.admin.rang": "Priority {{rang}}",
    "referenzpruefung.admin.gespeichert": "Reference AI saved.",
    "referenzpruefung.einstieg.titel": "Reference check",
    "referenzpruefung.einstieg.wert": "{{anzahl}} allowed",
    "referenzpruefung.einstieg.aus": "off",
    "referenzpruefung.admin.verweis":
      "Choose the reference AI for the source check under Administration → AI → Reference check.",
    "referenzpruefung.admin.rolle":
      "The reference AI is a separate, read-only checking role. It only checks whether an answer's passages support its statements. It must use a different model than the answering AI. This is a second AI check, not a human approval.",
    "referenzpruefung.admin.quelle":
      "You can choose from the AI accesses registered in provider administration (see AI accesses). No keys are stored or shown here.",
    "referenzpruefung.admin.art.intern": "internal",
    "referenzpruefung.admin.art.oeffentlich": "public",
    "referenzpruefung.admin.modell": "Model: {{modell}}",
    "referenzpruefung.admin.modellUnbekannt": "Model: not named",
    "referenzpruefung.admin.zustandLabel": "Status: {{zustand}}",
    "referenzpruefung.admin.zustand.nicht_eingerichtet": "not set up",
    "referenzpruefung.admin.zustand.ausgeschaltet": "switched off",
    "referenzpruefung.admin.zustand.nicht_verfuegbar": "not available",
    "referenzpruefung.admin.zustand.konfiguriert": "configured, not yet checked",
    "referenzpruefung.admin.zustand.letzte_pruefung_erfolgreich": "last check successful",
    "referenzpruefung.admin.zustand.letzte_pruefung_fehlgeschlagen": "last check failed",
    "referenzpruefung.admin.hilfe.nicht_eingerichtet":
      "This access is not set up. The operator sets it up in provider administration (AI accesses).",
    "referenzpruefung.admin.hilfe.konfiguriert":
      "Configured is not proof yet. Only a function check or a real check shows whether the source check works.",
    "referenzpruefung.admin.sperre.ki_abgeschaltet":
      "AI has been switched off by the administrator. Next step: lift the switch-off in AI administration.",
    "referenzpruefung.admin.sperre.keine_freigabe_externe_verarbeitung":
      "Blocked: approval for external processing is missing for public AI. Next step: grant it under Administration → AI → AI administration, or choose an internal AI.",
    "referenzpruefung.admin.sperre.nicht_erreichbar":
      "The access is set up but not reachable right now. Next step: test the connection under AI accesses or allow another reference AI.",
    "referenzpruefung.admin.sperre.kein_pruefmodell":
      "The access names no model or offers no check. Without a model name, independence cannot be shown.",
    "referenzpruefung.admin.gleichesModell":
      "Same model as the answering AI — this option never checks answers from this model.",
    "referenzpruefung.admin.antwortmodell": "Answering AI today: {{name}}",
    "referenzpruefung.admin.antwortmodellOhne": "Answering AI today: no model (fallback mode)",
    "referenzpruefung.admin.konflikt":
      "No independent checker: every usable allowed reference AI uses the same model as the answering AI. Also allow an AI with a different model. Until then the check status stays open and there is no four-eyes result.",
    "referenzpruefung.admin.keineEinsatzbereit":
      "No allowed reference AI is usable. Knowledge answers stay with an open check status “not checkable”. Allow a set-up AI or fix the named block.",
    "referenzpruefung.admin.keineBestaetigung":
      "An unchecked answer cannot be declared confirmed here. Only an actual check can confirm it.",
    "referenzpruefung.admin.freigabe.titel": "Approvals",
    "referenzpruefung.admin.freigabe.text":
      "Public reference AIs only receive content with approval for external processing, and confidential content only with the second approval as well. The choice here does not lift any space, user, tenant or data approval. If an approval is missing, the check visibly shows “not checkable”.",
    "referenzpruefung.admin.freigabe.stand":
      "Public AI: {{oeffentlich}} · Confidential: {{vertraulich}}",
    "referenzpruefung.admin.freigabe.an": "cleared",
    "referenzpruefung.admin.freigabe.aus": "blocked",
    "referenzpruefung.admin.envGesperrt":
      "The AI assignment is fixed by an operator setting. Changes are blocked here.",
    "referenzpruefung.admin.grenzen.titel": "Limits",
    "referenzpruefung.admin.grenzen.text":
      "One model call per check with at most {{sekunden}} s, {{token}} answer tokens, {{posten}} check items and {{zeichen}} characters of material. At most {{erneut}} explicitly triggered repeat check, no automatic retry. Check policy {{richtlinie}}.",
    "referenzpruefung.admin.preise.hinterlegt":
      "Costs according to the operator's price list ({{waehrung}}, as of {{stand}}). Every check call is listed in the AI run log.",
    "referenzpruefung.admin.preise.fehlt":
      "No price list stored: costs are not calculated. Token usage is listed in the AI run log.",
    "referenzpruefung.admin.check.titel": "Function check",
    "referenzpruefung.admin.check.text":
      "Sends fictional check material to the chosen AI once. This is a real model call and may incur costs. It only runs on click, never when this page opens.",
    "referenzpruefung.admin.check.knopf": "Function check",
    "referenzpruefung.admin.check.knopfLabel": "Start function check for {{name}}",
    "referenzpruefung.admin.check.laeuft": "Checking …",
    "referenzpruefung.admin.check.ergebnis.erfolgreich": "successful",
    "referenzpruefung.admin.check.ergebnis.fehlgeschlagen": "failed",
    "referenzpruefung.admin.check.zeile":
      "Last function check: {{ergebnis}} · {{zeit}} · model {{modell}} · {{dauer}} ms",
    "referenzpruefung.admin.check.andereModell":
      "The last function check ran with a different model ({{modell}}) and does not apply to today's.",
    "referenzpruefung.admin.check.verbrauch":
      "Actual model call · {{eingabe}} input and {{ausgabe}} output tokens",
    "referenzpruefung.admin.check.keinVerbrauch": "Actual model call · usage not reported",
    "referenzpruefung.admin.check.keinAufruf": "No model call — nothing was sent.",
    "referenzpruefung.admin.check.kosten": "Costs: {{betrag}} {{waehrung}}",
    "referenzpruefung.admin.check.keineKosten": "Costs: not calculable",
    "referenzpruefung.admin.check.grund.falsches_urteil":
      "The check output was valid, but the verdict on the fictional material was wrong.",
    "referenzpruefung.admin.check.nichtGespeichert": "The result could not be saved in the log.",
    "referenzpruefung.admin.check.fehler": "The function check is not possible: {{meldung}}",
    "referenzpruefung.admin.check.keinModell": "not named",
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
    "referenzpruefung.gesamt.quellen_geprueft": "Bronnen gecontroleerd",
    "referenzpruefung.gesamt.gemischt": "Concept · bronnen slechts deels bevestigd",
    "referenzpruefung.gesamt.nicht_pruefbar": "Concept · bronnen niet controleerbaar",
    "referenzpruefung.gesamt.nicht_abgeschlossen": "Concept · controle niet afgerond",
    "referenzpruefung.gesamt.laeuft": "Concept · controle loopt",
    "referenzpruefung.gesamt.offen": "Concept · broncontrole open",
    "referenzpruefung.gesamt.fremde_fassung":
      "Concept · controle hoort bij een andere antwoordversie",
    "referenzpruefung.gesamt.keine_aussage": "Geen uitspraak om te controleren",
    "referenzpruefung.entwurfHinweis":
      "Dit antwoord is niet als geheel door bronnen bevestigd. Het blijft zichtbaar, maar is geen bronvrijgave.",
    "referenzpruefung.bedeutung":
      "„Onderbouwd” betekent: de genoemde vindplaats draagt de uitspraak. Het betekent niet: gegarandeerd waar of actueel.",
    "referenzpruefung.detail.oeffnen": "Vindplaats en onderbouwing tonen",
    "referenzpruefung.detail.schliessen": "Vindplaats en onderbouwing sluiten",
    "referenzpruefung.detail.titel": "Vindplaats en controle-onderbouwing",
    "referenzpruefung.detail.passageOhne":
      "De passage is in deze weergave niet beschikbaar. Open de bron in de gecontroleerde versie.",
    "referenzpruefung.detail.keineFundstelle":
      "Voor deze uitspraak is er geen toegankelijke vindplaats.",
    "referenzpruefung.detail.begruendung": "Onderbouwing:",
    "referenzpruefung.detail.zurueck": "Terug naar de uitspraak",
    "referenzpruefung.naechster.label": "Volgende stap:",
    "referenzpruefung.naechster.erneut": "U kunt de controle nog één keer starten.",
    "referenzpruefung.naechster.unbekannt":
      "Stel de vraag opnieuw. Blijft de toestand, meld die dan aan het beheer.",
    "referenzpruefung.naechster.keine_aussage":
      "Niets te doen. Het antwoord bevat geen feitelijke uitspraak die een bron nodig heeft.",
    "referenzpruefung.naechster.keine_fundstelle":
      "Controleer de uitspraak zelf aan een bron of meld de ontbrekende bron via de meldfunctie van het antwoord.",
    "referenzpruefung.naechster.fundstelle_nicht_aufgeloest":
      "De bron is voor u niet (meer) toegankelijk of is gewijzigd. Stel de vraag opnieuw.",
    "referenzpruefung.naechster.keine_freigabe_externe_verarbeitung":
      "Het beheer kan de vrijgave voor externe verwerking verlenen of een interne referentie-AI toestaan (Beheer → AI → Referentiecontrole).",
    "referenzpruefung.naechster.pruefer_nicht_eingerichtet":
      "Het beheer staat een referentie-AI toe onder Beheer → AI → Referentiecontrole. Stel de vraag daarna opnieuw.",
    "referenzpruefung.naechster.pruefer_nicht_verfuegbar":
      "Het beheer richt een toegestane referentie-AI in onder AI-toegangen. Stel de vraag daarna opnieuw.",
    "referenzpruefung.naechster.pruefer_nicht_freigegeben":
      "Het beheer verleent de vrijgave of heft de AI-uitschakeling op (Beheer → AI).",
    "referenzpruefung.naechster.pruefer_nicht_unabhaengig":
      "Het beheer staat daarnaast een referentie-AI toe met een ander model dan de antwoord-AI.",
    "referenzpruefung.naechster.antwortmodell_unbekannt":
      "Stel de vraag opnieuw. Een onafhankelijke controle vraagt een vastgelegd antwoordmodel.",
    "referenzpruefung.naechster.zeitlimit": "Probeer het zo meteen nog eens.",
    "referenzpruefung.naechster.abgebrochen": "Stel de vraag opnieuw om haar te laten controleren.",
    "referenzpruefung.naechster.budget_erschoepft":
      "Stel een engere vraag. Blijft het budget op, neem dan contact op met het beheer.",
    "referenzpruefung.naechster.ki_abgeschaltet":
      "Het beheer heft de AI-uitschakeling op. Tot dan blijft het antwoord ongecontroleerd.",
    "referenzpruefung.naechster.ungueltige_pruefausgabe":
      "Probeer het nog eens. Blijft de uitvoer ongeldig, dan controleert het beheer de referentie-AI met de functiecheck.",
    "referenzpruefung.naechster.pruefer_fehler":
      "Probeer het nog eens. Valt de referentie-AI blijvend uit, dan controleert het beheer de toegang.",
    "referenzpruefung.naechster.modellaufruf_ausgeschlossen":
      "Op deze weg is dat zo bedoeld. Voor een gecontroleerd antwoord stelt u de vraag op de vragenpagina.",
    "referenzpruefung.naechster.bestaetigung_abgelaufen":
      "Stel de vraag opnieuw, zodat de huidige versie met uw huidige rechten wordt gecontroleerd.",
    "referenzpruefung.naechster.kein_urteil": "Controleer de uitspraak zelf aan de vindplaats.",
    "referenzpruefung.zweitmeinung.titel": "Broncontrole van dit antwoord",
    "referenzpruefung.admin.titel": "Referentie-AI voor de broncontrole",
    "referenzpruefung.admin.text":
      "De referentie-AI controleert uitsluitend of de vindplaatsen van een antwoord de uitspraken dragen. Per vraag wordt de eerste toegestane optie gekozen die een ander model gebruikt dan het antwoord.",
    "referenzpruefung.admin.legende": "Toegestane referentie-AI's (volgorde = voorrang)",
    "referenzpruefung.admin.leer":
      "Geen referentie-AI toegestaan — elke controle staat als „niet controleerbaar”.",
    "referenzpruefung.admin.vorziehen": "{{name}} naar voren",
    "referenzpruefung.admin.rang": "Voorrang {{rang}}",
    "referenzpruefung.admin.gespeichert": "Referentie-AI opgeslagen.",
    "referenzpruefung.einstieg.titel": "Referentiecontrole",
    "referenzpruefung.einstieg.wert": "{{anzahl}} toegestaan",
    "referenzpruefung.einstieg.aus": "uit",
    "referenzpruefung.admin.verweis":
      "Kies de referentie-AI voor de broncontrole onder Beheer → AI → Referentiecontrole.",
    "referenzpruefung.admin.rolle":
      "De referentie-AI is een eigen, alleen lezende controlerol. Zij controleert uitsluitend of de vindplaatsen van een antwoord de uitspraken dragen. Zij moet een ander model gebruiken dan de antwoord-AI. Dit is een tweede AI-controle, geen menselijke vrijgave.",
    "referenzpruefung.admin.quelle":
      "U kiest uit de AI-toegangen die in het providerbeheer zijn geregistreerd (zie AI-toegangen). Sleutels worden hier niet opgeslagen of getoond.",
    "referenzpruefung.admin.art.intern": "intern",
    "referenzpruefung.admin.art.oeffentlich": "openbaar",
    "referenzpruefung.admin.modell": "Model: {{modell}}",
    "referenzpruefung.admin.modellUnbekannt": "Model: niet genoemd",
    "referenzpruefung.admin.zustandLabel": "Status: {{zustand}}",
    "referenzpruefung.admin.zustand.nicht_eingerichtet": "niet ingericht",
    "referenzpruefung.admin.zustand.ausgeschaltet": "uitgeschakeld",
    "referenzpruefung.admin.zustand.nicht_verfuegbar": "niet beschikbaar",
    "referenzpruefung.admin.zustand.konfiguriert": "geconfigureerd, nog niet gecontroleerd",
    "referenzpruefung.admin.zustand.letzte_pruefung_erfolgreich": "laatste controle geslaagd",
    "referenzpruefung.admin.zustand.letzte_pruefung_fehlgeschlagen": "laatste controle mislukt",
    "referenzpruefung.admin.hilfe.nicht_eingerichtet":
      "Deze toegang is niet ingericht. De beheerder van het platform richt hem in via het providerbeheer (AI-toegangen).",
    "referenzpruefung.admin.hilfe.konfiguriert":
      "Geconfigureerd is nog geen bewijs. Pas een functiecheck of een echte controle laat zien of de broncontrole lukt.",
    "referenzpruefung.admin.sperre.ki_abgeschaltet":
      "AI is door de beheerder uitgeschakeld. Volgende stap: de uitschakeling in het AI-beheer opheffen.",
    "referenzpruefung.admin.sperre.keine_freigabe_externe_verarbeitung":
      "Geblokkeerd: voor openbare AI ontbreekt de vrijgave voor externe verwerking. Volgende stap: de vrijgave verlenen onder Beheer → AI → AI-beheer, of een interne AI kiezen.",
    "referenzpruefung.admin.sperre.nicht_erreichbar":
      "De toegang is ingericht, maar nu niet bereikbaar. Volgende stap: de verbinding testen onder AI-toegangen of een andere referentie-AI toestaan.",
    "referenzpruefung.admin.sperre.kein_pruefmodell":
      "De toegang noemt geen model of biedt geen controle. Zonder modelnaam is onafhankelijkheid niet aantoonbaar.",
    "referenzpruefung.admin.gleichesModell":
      "Hetzelfde model als de antwoord-AI — deze optie controleert nooit antwoorden van dit model.",
    "referenzpruefung.admin.antwortmodell": "Antwoord-AI vandaag: {{name}}",
    "referenzpruefung.admin.antwortmodellOhne": "Antwoord-AI vandaag: geen model (vervangmodus)",
    "referenzpruefung.admin.konflikt":
      "Geen onafhankelijke controleur: elke inzetbare toegestane referentie-AI gebruikt hetzelfde model als de antwoord-AI. Sta daarnaast een AI met een ander model toe. Tot dan blijft de controlestatus open en is er geen vier-ogen-resultaat.",
    "referenzpruefung.admin.keineEinsatzbereit":
      "Geen toegestane referentie-AI is inzetbaar. Kennisantwoorden blijven met een open controlestatus „niet controleerbaar”. Sta een ingerichte AI toe of hef de genoemde blokkade op.",
    "referenzpruefung.admin.keineBestaetigung":
      "Een niet-gecontroleerd antwoord kan hier niet als bevestigd worden verklaard. Alleen een echte controle kan het bevestigen.",
    "referenzpruefung.admin.freigabe.titel": "Vrijgaven",
    "referenzpruefung.admin.freigabe.text":
      "Openbare referentie-AI's krijgen inhoud alleen met de vrijgave voor externe verwerking, vertrouwelijke inhoud bovendien alleen met de tweede vrijgave. De keuze hier heft geen space-, gebruikers-, tenant- of gegevensvrijgave op. Ontbreekt een vrijgave, dan staat de controle zichtbaar als „niet controleerbaar”.",
    "referenzpruefung.admin.freigabe.stand":
      "Openbare AI: {{oeffentlich}} · Vertrouwelijk: {{vertraulich}}",
    "referenzpruefung.admin.freigabe.an": "vrijgegeven",
    "referenzpruefung.admin.freigabe.aus": "geblokkeerd",
    "referenzpruefung.admin.envGesperrt":
      "De AI-toewijzing is vastgelegd door een platforminstelling. Wijzigingen zijn hier geblokkeerd.",
    "referenzpruefung.admin.grenzen.titel": "Grenzen",
    "referenzpruefung.admin.grenzen.text":
      "Per controle één modelaanroep met hoogstens {{sekunden}} s, {{token}} antwoordtokens, {{posten}} controleposten en {{zeichen}} tekens materiaal. Hoogstens {{erneut}} uitdrukkelijk gestarte herhaalde controle, geen automatische herhaling. Controlerichtlijn {{richtlinie}}.",
    "referenzpruefung.admin.preise.hinterlegt":
      "Kosten volgens de prijslijst van de beheerder van het platform ({{waehrung}}, stand {{stand}}). Elke controleaanroep staat in het AI-runlogboek.",
    "referenzpruefung.admin.preise.fehlt":
      "Geen prijslijst opgeslagen: kosten worden niet berekend. Het tokenverbruik staat in het AI-runlogboek.",
    "referenzpruefung.admin.check.titel": "Functiecheck",
    "referenzpruefung.admin.check.text":
      "Stuurt eenmaal fictief controlemateriaal naar de gekozen AI. Dit is een echte modelaanroep en kan kosten veroorzaken. Hij draait alleen na een klik, nooit bij het openen van deze pagina.",
    "referenzpruefung.admin.check.knopf": "Functiecheck",
    "referenzpruefung.admin.check.knopfLabel": "Functiecheck voor {{name}} starten",
    "referenzpruefung.admin.check.laeuft": "Controleert …",
    "referenzpruefung.admin.check.ergebnis.erfolgreich": "geslaagd",
    "referenzpruefung.admin.check.ergebnis.fehlgeschlagen": "mislukt",
    "referenzpruefung.admin.check.zeile":
      "Laatste functiecheck: {{ergebnis}} · {{zeit}} · model {{modell}} · {{dauer}} ms",
    "referenzpruefung.admin.check.andereModell":
      "De laatste functiecheck draaide met een ander model ({{modell}}) en geldt niet voor het huidige.",
    "referenzpruefung.admin.check.verbrauch":
      "Echte modelaanroep · {{eingabe}} invoer- en {{ausgabe}} uitvoertokens",
    "referenzpruefung.admin.check.keinVerbrauch": "Echte modelaanroep · verbruik niet gemeld",
    "referenzpruefung.admin.check.keinAufruf": "Geen modelaanroep — er is niets verzonden.",
    "referenzpruefung.admin.check.kosten": "Kosten: {{betrag}} {{waehrung}}",
    "referenzpruefung.admin.check.keineKosten": "Kosten: niet te berekenen",
    "referenzpruefung.admin.check.grund.falsches_urteil":
      "De controle-uitvoer was geldig, maar het oordeel over het fictieve materiaal was onjuist.",
    "referenzpruefung.admin.check.nichtGespeichert":
      "Het resultaat kon niet in het logboek worden opgeslagen.",
    "referenzpruefung.admin.check.fehler": "De functiecheck is niet mogelijk: {{meldung}}",
    "referenzpruefung.admin.check.keinModell": "niet genoemd",
  },
} satisfies Textmodul;
