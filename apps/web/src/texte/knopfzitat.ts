// ================================================================================================
// R-1176 · WAS EIN HILFETEXT ALS KNOPF ZITIERT, STEHT AUF DEM KNOPF — IN ALLEN DREI SPRACHEN.
// ================================================================================================
//
// Der Wächter `tests/sprache-begriffe/zitierte-beschriftungen.test.ts` liest jedes deutsche Zitat
// „…" eines Textes, das wortgleich eine Beschriftung der Oberfläche ist, und verlangt, dass die
// englische und die niederländische Fassung desselben Textes die englische bzw. niederländische
// Beschriftung zeichengleich zitiert. Bei seiner Einführung fand er diese Hilfetexte, deren
// Übersetzung den Knopf anders nannte, als er heißt:
//
//   pilot.check.maintain           EN „Keep current"            Knopf: „Maintain"
//   pilot.obs.outdated.map         EN „keep current"            Knopf: „Maintain"
//                                  NL „actueel houden"          Knopf: „Actueel houden"
//   stage2.gate.body               EN 'stage 2' / NL „fase 2"   Menü: „Stage 2" / „Stap 2"
//   seitenhilfe.admin.audit.text   NL „Veiligheid en bewijs"    Reiter: „Beveiliging en bewijs"
//   seitenhilfe.admin.bereitschaft EN „not retrievable"         Anzeige: „not available"
//                                  NL „niet opvraagbaar"        Anzeige: „niet op te halen"
//   wb.grenze.widerspricht/ersetzt EN/NL groß geschrieben       Beziehung: „contradicts"/„replaces"
//   vhelp.reject/assign/contribution.body
//                                  EN klein geschrieben         Knopf: „Report conflict",
//                                                               „Assigned to me", „Add source"
//   capture.file.connectHint       DE/EN/NL „Verbinden"/„Übernehmen"
//                                  Knöpfe: „Ausgewählte zu einem Eintrag verbinden",
//                                  „Ausgewählte übernehmen" (Nacharbeit 6, schon deutsch abweichend)
//
// Die alten Schlüssel stehen im Grundbestand unter Prüfsumme
// (`tests/i18n-textmodule/bestand-unveraendert.test.ts`); sie
// bleiben dort unverändert liegen und werden nicht mehr gelesen. Der deutsche Wortlaut ist
// zeichengleich übernommen — mit einer Ausnahme: `stage2.gate.body` sagte „im Haus „Stufe 2"
// genannt"; „im Haus" ist seit PRO 375 der Betriebswahrheit vorbehalten (R-0975), hier steht
// „intern", wie es die niederländische Fassung schon immer sagte.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "knopfzitat.",
  legacySchluessel: [],
  de: {
    "knopfzitat.pilot.pflegen":
      "„Aktuell halten“ heißt: Einträge, deren Prüfung fällig ist, werden erneut angesehen — nichts bleibt automatisch für immer gültig.",
    "knopfzitat.pilot.veraltet": "Lebenszyklus — dort wird er erneut angesehen („Aktuell halten“).",
    "knopfzitat.stufe2.hinweis":
      "Dieses Modul gehört zu den Erweiterten Funktionen — intern „Stufe 2“ genannt: zusätzliche Module über den Kernablauf hinaus. Sie sind gerade ausgeschaltet, deshalb ist dieser Bereich noch nicht sichtbar.",
    "knopfzitat.admin.audit":
      "Eine reine Auskunft ohne Bedienelemente: die jüngsten Einträge zu Konten und Anmeldung, je Zeile Zeitpunkt, Aktion und die Kennung des Ausführenden. Hier lässt sich nichts ändern und nichts löschen — die Liste ist das Ergebnis dessen, was anderswo getan wurde. Die vollständige, hash-verkettete Kette samt Prüfknopf steht unter „Sicherheit und Nachweise“ im Prüfprotokoll.",
    "knopfzitat.admin.bereitschaft":
      "Die Checkliste vor einer Vorführung: KI, validierte Objekte, offene Prüfungen, Uploadgrenzen, externe Recherche und Demodaten — je Zeile eine Ampel aus echten Zahlen. Sie stellt nichts ein, sie liest sechs Quellen und sagt, was fehlt. Fällt eine davon aus, steht statt einer geratenen Null „nicht abrufbar“ mit einem Knopf, der alle sechs neu abruft. Die Zeile „Demodaten“ führt direkt auf die Karte, auf der du sie lädst.",
    "knopfzitat.wb.widerspricht":
      "„widerspricht“ ist ein verantworteter Vermerk eines Menschen und kein Beweis.",
    "knopfzitat.wb.ersetzt":
      "„ersetzt“ ändert keine Freigabe und veröffentlicht keinen Nachfolger.",
    "knopfzitat.vhelp.reject":
      "Du hältst die Aussage für falsch, veraltet oder riskant. Auch hier ist die Begründung Pflicht — ohne sie kann der Autor nichts lernen und nichts korrigieren. Danach fließt deine Ablehnung in den Prüfstand des Objekts ein; es wird dadurch NICHT gelöscht und NICHT gesperrt, sondern bleibt sichtbar in Prüfung, bis Autor oder Controller reagieren. Wenn zwei gesicherte Aussagen einander widersprechen, ist „Konflikt melden“ der bessere Weg als eine Ablehnung.",
    "knopfzitat.vhelp.assign":
      "Du bittest eine bestimmte Kollegin oder einen Kollegen um die Prüfung dieses Objekts. Die Person sieht es danach in ihrer persönlichen Review-Liste („Mir zugewiesen“) und bekommt eine Benachrichtigung über die Glocke. Die Zuweisung ist eine Einladung, keine Bewertung: Sie ändert weder Status noch Vertrauen, und geprüft wird erst, wenn die Person selbst entscheidet.",
    "knopfzitat.vhelp.contribution":
      "Du kennst eine Ergänzung, Korrektur oder Fundstelle, willst aber nicht selbst am Objekt arbeiten? Beschreibe sie hier — dein Hinweis wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Anders als „Quelle hinzufügen“ entsteht dabei KEIN Quellen-Eintrag; es ist eine Nachricht an die Menschen, kein Beleg am Objekt.",
    "knopfzitat.datei.wege":
      "Mehrere anhaken, dann: „Ausgewählte zu einem Eintrag verbinden“ fasst sie zu EINEM Eintrag zusammen · „Als Entwürfe speichern“ legt je Punkt einen eigenen an · „Ausgewählte übernehmen“ arbeitet sie einzeln ab.",
  },
  en: {
    "knopfzitat.pilot.pflegen":
      "“Maintain” means: entries whose check is due are looked at again — nothing stays valid forever automatically.",
    "knopfzitat.pilot.veraltet": "Lifecycle — it is looked at again there (“Maintain”).",
    "knopfzitat.stufe2.hinweis":
      "This module belongs to the advanced features — called “Stage 2” internally: additional modules beyond the core flow. They are currently switched off, that is why this area is not visible yet.",
    "knopfzitat.admin.audit":
      "Pure information without controls: the most recent entries about accounts and sign-in, each line with time, action and the identifier of whoever acted. Nothing can be changed or deleted here — the list is the result of what was done elsewhere. The complete hash-chained trail including its verify button lives under “Security and evidence” in the audit trail.",
    "knopfzitat.admin.bereitschaft":
      "The checklist before a demo: AI, validated objects, open reviews, upload limits, external research and demo data — one indicator per row, built from real numbers. It sets nothing; it reads six sources and says what is missing. If one of them fails, you get “not available” with a button that refetches all six instead of a guessed zero. The “Demo data” row leads straight to the card where you load it.",
    "knopfzitat.wb.widerspricht":
      "The relation “contradicts” is a note a person is responsible for, not a proof.",
    "knopfzitat.wb.ersetzt":
      "The relation “replaces” changes no approval and publishes no successor.",
    "knopfzitat.vhelp.reject":
      "You consider the statement wrong, outdated or risky. Here too the reason is mandatory — without it the author can learn and correct nothing. Your rejection then flows into the object's review record; it is NOT deleted and NOT locked, but remains visibly in review until the author or a controller reacts. If two validated statements contradict each other, “Report conflict” is the better path than a rejection.",
    "knopfzitat.vhelp.assign":
      "You ask a specific colleague to review this object. They will see it in their personal review list (“Assigned to me”) and receive a notification via the bell. The assignment is an invitation, not a rating: it changes neither status nor trust, and nothing is reviewed until that person decides themselves.",
    "knopfzitat.vhelp.contribution":
      "You know an addition, correction or reference but do not want to work on the object yourself? Describe it here — your note is stored as a comment on the knowledge object, visible to author and reviewers. Unlike “Add source”, NO source entry is created; it is a message to people, not evidence on the object.",
    "knopfzitat.datei.wege":
      "Tick several, then: “Connect selected into one entry” combines them into ONE entry · “Save as drafts” creates one per point · “Take over selected” processes them one by one.",
  },
  nl: {
    "knopfzitat.pilot.pflegen":
      "„Actueel houden“ betekent: items waarvan de controle verloopt, worden opnieuw bekeken — niets blijft automatisch voor altijd geldig.",
    "knopfzitat.pilot.veraltet":
      "Levenscyclus — daar wordt het opnieuw bekeken („Actueel houden“).",
    "knopfzitat.stufe2.hinweis":
      "Deze module hoort bij de uitgebreide functies — intern „Stap 2“ genoemd: extra modules naast de kernstroom. Die staan nu uit, daarom is dit gedeelte nog niet zichtbaar.",
    "knopfzitat.admin.audit":
      "Een zuivere inlichting zonder bedieningselementen: de jongste regels over accounts en aanmelding, per regel tijdstip, actie en de kenmerk van wie handelde. Hier valt niets te wijzigen en niets te verwijderen — de lijst is het resultaat van wat elders is gedaan. De volledige, hash-geketende keten met haar controleknop staat onder „Beveiliging en bewijs“ in het controleprotocol.",
    "knopfzitat.admin.bereitschaft":
      "De checklist vóór een demonstratie: AI, gevalideerde objecten, openstaande toetsingen, uploadgrenzen, extern onderzoek en demogegevens — per regel een stoplicht uit echte getallen. Ze stelt niets in; ze leest zes bronnen en zegt wat ontbreekt. Valt er één uit, dan staat er „niet op te halen“ met een knop die alle zes opnieuw ophaalt, in plaats van een geraden nul. De regel „Demogegevens“ leidt rechtstreeks naar de kaart waar je ze laadt.",
    "knopfzitat.wb.widerspricht":
      "De relatie „spreekt tegen” is een verantwoorde aantekening van een mens en geen bewijs.",
    "knopfzitat.wb.ersetzt":
      "De relatie „vervangt” wijzigt geen vrijgave en publiceert geen opvolger.",
    "knopfzitat.vhelp.reject":
      'Je vindt de uitspraak onjuist, verouderd of riskant. Ook hier is de motivatie verplicht — zonder die kan de auteur niets leren en niets corrigeren. Daarna vloeit jouw afwijzing mee in de beoordeling van het object; het wordt daardoor NIET verwijderd en NIET geblokkeerd, maar blijft zichtbaar in beoordeling tot de auteur of controller reageert. Als twee zekere uitspraken elkaar tegenspreken, is „Conflict melden" de betere weg dan een afwijzing.',
    "knopfzitat.vhelp.assign":
      'Je vraagt een bepaalde collega om de beoordeling van dit object. Die persoon ziet het daarna in haar persoonlijke review-lijst („Aan mij toegewezen") en krijgt een melding via de bel. De toewijzing is een uitnodiging, geen beoordeling: het verandert status noch vertrouwen, en beoordeeld wordt er pas als de persoon zelf beslist.',
    "knopfzitat.vhelp.contribution":
      'Ken je een aanvulling, correctie of vindplaats, maar wil je niet zelf aan het object werken? Beschrijf het hier — je tip wordt als opmerking bij het kennisobject opgeslagen, zichtbaar voor auteur en beoordelaar. Anders dan bij „Bron toevoegen" ontstaat hierbij GEEN bronvermelding; het is een bericht aan de mensen, geen bewijs bij het object.',
    "knopfzitat.datei.wege":
      "Meerdere aanvinken, dan: „Geselecteerde tot één item samenvoegen“ voegt ze samen tot ÉÉN item · „Als concepten opslaan“ maakt per punt een eigen concept · „Geselecteerde overnemen“ verwerkt ze een voor een.",
  },
} satisfies Textmodul;
