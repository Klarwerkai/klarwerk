// ================================================================================================
// R-1662 · GEFÜHRTER WEG VOM PROBLEM ZUR LÖSUNG — die Texte des Lösungswegs an der Antwort.
// ================================================================================================
//
// Zwei Orte (`components/fragen/Loesungsweg.tsx`): der Warnkasten „Was vermeiden" in der
// Antwortkarte, wenn unter den Quellen Negativwissen ist, und das Blatt „Lösungsweg" mit den
// nächsten Schritten. Die Rahmung folgt dem Addendum: „die belastbarsten Hinweise", nie „die
// Lösung"; „validiert" nur, wenn die Einstufung es belegt (`lib/problemloesungsweg.ts`).
// Kein Wert beginnt mit „Nächster Schritt:" — das ist der Satz des Antwortvertrags
// (`tests/app/mega54-ein-naechster-schritt-sammler.test.ts`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "loesungsweg.",
  legacySchluessel: [],
  de: {
    "loesungsweg.oeffnen": "Lösungsweg",
    "loesungsweg.titel": "Lösungsweg zu dieser Frage",
    "loesungsweg.hinweis.geprueft":
      "Auf Basis des vorhandenen validierten Wissens sind dies die belastbarsten Hinweise – keine endgültige Lösung.",
    "loesungsweg.hinweis.ungeprueft":
      "Diese Hinweise stützen sich auf Wissen, das noch nicht vollständig geprüft ist. Prüfe die Quellen, bevor du dich darauf verlässt.",
    "loesungsweg.schritte": "Nächste Schritte",
    "loesungsweg.schritt.quelle": "Belastbarste Quelle öffnen",
    "loesungsweg.schritt.vermeiden": "Bekannte Fehler beachten",
    "loesungsweg.schritt.personen": "Personen mit Wissensspuren fragen",
    "loesungsweg.personQuellen": "zu: {{quellen}}",
    "loesungsweg.keinePerson": "Zu diesen Quellen ist keine Person hinterlegt.",
    "loesungsweg.personenGrenze":
      "Eine Anfrage direkt aus Klarwerk gibt es noch nicht – sprich die Person auf eurem gewohnten Weg an.",
    "loesungsweg.schritt.fall": "Neuen Fall dokumentieren",
    "loesungsweg.vermeiden.titel": "Bekannte Fehler – was vermeiden",
    "loesungsweg.vermeiden.text":
      "Unter den Quellen ist Negativwissen: Dort steht, was in einem ähnlichen Fall nicht funktioniert hat.",
    "loesungsweg.schritt.konflikte": "Gelöste Konflikte zu diesen Quellen",
    "loesungsweg.konflikt.entschieden": "Von einem Menschen entschieden",
    "loesungsweg.konflikt.fehlalarm": "Als Fehlalarm geschlossen – kein Widerspruch",
    "loesungsweg.konflikt.entscheidung": "Entscheidung: {{text}}",
    "loesungsweg.konflikt.zurueckgehalten":
      "Die Entscheidung betrifft ein Objekt, dessen Inhalt du nicht sehen darfst.",
    "loesungsweg.konflikt.keine": "Zu diesen Quellen gibt es keinen gelösten Konflikt.",
    "loesungsweg.schritt.revalidierung": "Revalidierung fällig",
    "loesungsweg.revalidierung.text":
      "Diese Quellen sind zur erneuten Prüfung vorgemerkt – ihre Gültigkeit ist derzeit nicht bestätigt.",
    "loesungsweg.revalidierung.fall": "Zum Revalidierungsfall",
    "loesungsweg.revalidierung.keine": "Keine dieser Quellen ist zur Revalidierung vorgemerkt.",
    "loesungsweg.revalidierung.offenTitel": "Offen",
    "loesungsweg.revalidierung.frueherTitel": "Früher bestätigt",
    "loesungsweg.revalidierung.frueher":
      "Zuletzt am {{datum}} als weiterhin gültig bestätigt (Fassung {{version}}). Bestätigungen insgesamt: {{anzahl}}.",
    "loesungsweg.revalidierung.frueherOhneFassung":
      "Zuletzt am {{datum}} als weiterhin gültig bestätigt. Bestätigungen insgesamt: {{anzahl}}.",
    "loesungsweg.revalidierung.frueherKeine": "Keine dieser Quellen wurde bisher revalidiert.",
    "loesungsweg.stand.laedt": "Wird geprüft …",
    "loesungsweg.stand.fehler": "Nicht abrufbar – darüber ist gerade nichts bekannt.",
  },
  en: {
    "loesungsweg.oeffnen": "Solution path",
    "loesungsweg.titel": "Solution path for this question",
    "loesungsweg.hinweis.geprueft":
      "Based on the existing validated knowledge, these are the most reliable pointers – not a definitive solution.",
    "loesungsweg.hinweis.ungeprueft":
      "These pointers rely on knowledge that has not been fully reviewed yet. Check the sources before you rely on them.",
    "loesungsweg.schritte": "Next steps",
    "loesungsweg.schritt.quelle": "Open the most reliable source",
    "loesungsweg.schritt.vermeiden": "Mind the known mistakes",
    "loesungsweg.schritt.personen": "Ask people with knowledge traces",
    "loesungsweg.personQuellen": "on: {{quellen}}",
    "loesungsweg.keinePerson": "No person is recorded for these sources.",
    "loesungsweg.personenGrenze":
      "You cannot send a request from Klarwerk yet – contact the person the way you usually do.",
    "loesungsweg.schritt.fall": "Document a new case",
    "loesungsweg.vermeiden.titel": "Known mistakes – what to avoid",
    "loesungsweg.vermeiden.text":
      "The sources include negative knowledge: it records what did not work in a similar case.",
    "loesungsweg.schritt.konflikte": "Resolved conflicts on these sources",
    "loesungsweg.konflikt.entschieden": "Decided by a person",
    "loesungsweg.konflikt.fehlalarm": "Closed as a false alarm – no contradiction",
    "loesungsweg.konflikt.entscheidung": "Decision: {{text}}",
    "loesungsweg.konflikt.zurueckgehalten":
      "The decision concerns an item whose content you are not allowed to see.",
    "loesungsweg.konflikt.keine": "There is no resolved conflict on these sources.",
    "loesungsweg.schritt.revalidierung": "Revalidation due",
    "loesungsweg.revalidierung.text":
      "These sources are marked for another review – their validity is not confirmed at the moment.",
    "loesungsweg.revalidierung.fall": "Open the revalidation case",
    "loesungsweg.revalidierung.keine": "None of these sources is marked for revalidation.",
    "loesungsweg.revalidierung.offenTitel": "Open",
    "loesungsweg.revalidierung.frueherTitel": "Confirmed earlier",
    "loesungsweg.revalidierung.frueher":
      "Last confirmed as still valid on {{datum}} (version {{version}}). Confirmations in total: {{anzahl}}.",
    "loesungsweg.revalidierung.frueherOhneFassung":
      "Last confirmed as still valid on {{datum}}. Confirmations in total: {{anzahl}}.",
    "loesungsweg.revalidierung.frueherKeine": "None of these sources has been revalidated so far.",
    "loesungsweg.stand.laedt": "Checking …",
    "loesungsweg.stand.fehler": "Not available – nothing is known about this right now.",
  },
  nl: {
    "loesungsweg.oeffnen": "Oplossingsroute",
    "loesungsweg.titel": "Oplossingsroute voor deze vraag",
    "loesungsweg.hinweis.geprueft":
      "Op basis van de aanwezige gevalideerde kennis zijn dit de meest betrouwbare aanwijzingen – geen definitieve oplossing.",
    "loesungsweg.hinweis.ungeprueft":
      "Deze aanwijzingen steunen op kennis die nog niet volledig is gecontroleerd. Controleer de bronnen voordat je erop vertrouwt.",
    "loesungsweg.schritte": "Volgende stappen",
    "loesungsweg.schritt.quelle": "Meest betrouwbare bron openen",
    "loesungsweg.schritt.vermeiden": "Let op bekende fouten",
    "loesungsweg.schritt.personen": "Personen met kennissporen vragen",
    "loesungsweg.personQuellen": "over: {{quellen}}",
    "loesungsweg.keinePerson": "Bij deze bronnen is geen persoon vastgelegd.",
    "loesungsweg.personenGrenze":
      "Een verzoek rechtstreeks vanuit Klarwerk is nog niet mogelijk – spreek de persoon aan zoals jullie gewend zijn.",
    "loesungsweg.schritt.fall": "Nieuw geval documenteren",
    "loesungsweg.vermeiden.titel": "Bekende fouten – wat te vermijden",
    "loesungsweg.vermeiden.text":
      "Onder de bronnen is negatieve kennis: daar staat wat in een vergelijkbaar geval niet heeft gewerkt.",
    "loesungsweg.schritt.konflikte": "Opgeloste conflicten bij deze bronnen",
    "loesungsweg.konflikt.entschieden": "Door een persoon beslist",
    "loesungsweg.konflikt.fehlalarm": "Als vals alarm gesloten – geen tegenspraak",
    "loesungsweg.konflikt.entscheidung": "Beslissing: {{text}}",
    "loesungsweg.konflikt.zurueckgehalten":
      "De beslissing betreft een object waarvan je de inhoud niet mag zien.",
    "loesungsweg.konflikt.keine": "Bij deze bronnen is er geen opgelost conflict.",
    "loesungsweg.schritt.revalidierung": "Hervalidatie nodig",
    "loesungsweg.revalidierung.text":
      "Deze bronnen zijn gemarkeerd voor een nieuwe controle – hun geldigheid is op dit moment niet bevestigd.",
    "loesungsweg.revalidierung.fall": "Naar het hervalidatiegeval",
    "loesungsweg.revalidierung.keine": "Geen van deze bronnen is gemarkeerd voor hervalidatie.",
    "loesungsweg.revalidierung.offenTitel": "Open",
    "loesungsweg.revalidierung.frueherTitel": "Eerder bevestigd",
    "loesungsweg.revalidierung.frueher":
      "Laatst op {{datum}} bevestigd als nog geldig (versie {{version}}). Bevestigingen in totaal: {{anzahl}}.",
    "loesungsweg.revalidierung.frueherOhneFassung":
      "Laatst op {{datum}} bevestigd als nog geldig. Bevestigingen in totaal: {{anzahl}}.",
    "loesungsweg.revalidierung.frueherKeine": "Geen van deze bronnen is tot nu toe hervalideerd.",
    "loesungsweg.stand.laedt": "Wordt gecontroleerd …",
    "loesungsweg.stand.fehler": "Niet beschikbaar – hierover is op dit moment niets bekend.",
  },
} satisfies Textmodul;
