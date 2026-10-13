// ================================================================================================
// KLARA 12 (Auftrag produkt:20261008:klara-eigeninitiative) — Unterstützung und Eigeninitiative.
// ================================================================================================
//
// Die Texte der drei Modi („Nur auf Nachfrage“, „Passende Hinweise anbieten“, „Ausdrücklich
// übertragene Aufgaben“), ihres Speicherstands, der Hinweise samt „Später“/„Nicht mehr anbieten“,
// der Liste übertragener Aufgaben und der Bedienhilfe dieser Fähigkeit. `{{assistenz}}` ist der
// persönliche Name der Assistenz (oder neutral „Assistenz“).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klarainitiative.",
  legacySchluessel: [],
  de: {
    "klarainitiative.wahl.titel": "Wann ich mich melde",
    "klarainitiative.wahl.intro":
      "Du entscheidest, ob {{assistenz}} von sich aus etwas anbietet. Die Wahl gilt für dein Konto – auch nach dem Neuladen und der nächsten Anmeldung.",
    "klarainitiative.modus.nachfrage.name": "Nur auf Nachfrage",
    "klarainitiative.modus.nachfrage.text":
      "{{assistenz}} bleibt still, bis du fragst oder einen Auftrag gibst. Keine Hinweise.",
    "klarainitiative.modus.hinweise.name": "Passende Hinweise anbieten",
    "klarainitiative.modus.hinweise.text":
      "{{assistenz}} bietet zur aktuellen Seite gelegentlich Hilfe an. Ein Hinweis tut selbst nichts – erst dein Klick. „Später“ und „Nicht mehr anbieten“ lassen ihn ruhen.",
    "klarainitiative.modus.auftraege.name": "Ausdrücklich übertragene Aufgaben",
    "klarainitiative.modus.auftraege.text":
      "Keine Hinweise. {{assistenz}} führt nur die Aufträge sichtbar, die du selbst erteilt hast – mit deinen Rechten.",
    "klarainitiative.stand.ohneKonto": "Zum Speichern bitte anmelden.",
    "klarainitiative.stand.speichert": "Wird gespeichert …",
    "klarainitiative.stand.fehler":
      "Nicht gespeichert – es gilt weiter der angezeigte Modus. Bitte erneut wählen.",
    "klarainitiative.stand.ladefehler":
      "Deine Einstellung konnte nicht gelesen werden – bis dahin bleibt {{assistenz}} still.",
    "klarainitiative.stand.gespeichert": "Für dein Konto gespeichert.",
    "klarainitiative.stand.vorgabe": "Vorgabe – noch nicht gewählt.",
    "klarainitiative.ansage.nachfrage": "Gespeichert: nur auf Nachfrage.",
    "klarainitiative.ansage.hinweise": "Gespeichert: passende Hinweise anbieten.",
    "klarainitiative.ansage.auftraege": "Gespeichert: ausdrücklich übertragene Aufgaben.",
    "klarainitiative.ansage.fehler": "Die Einstellung wurde nicht gespeichert.",
    "klarainitiative.hinweis.titel": "Hinweis von {{assistenz}}",
    "klarainitiative.hinweis.nurAngebot": "Nur ein Angebot – es passiert nichts ohne deinen Klick.",
    "klarainitiative.hinweis.spaeter": "Später",
    "klarainitiative.hinweis.schliessen": "Nicht mehr anbieten",
    "klarainitiative.hinweis.tutorial.text":
      "Für „{{seite}}“ gibt es eine Schritt-für-Schritt-Anleitung. Soll ich dir den nächsten Schritt zeigen?",
    "klarainitiative.hinweis.tutorial.angebot": "Nächsten Schritt zeigen",
    "klarainitiative.hinweis.ungeprueft.text":
      "Dieser Inhalt ist noch nicht geprüft. Soll ich erklären, was das für dich bedeutet?",
    "klarainitiative.hinweis.ungeprueft.angebot": "Erklären",
    "klarainitiative.hinweis.seite.text": "Ich kann dir erklären, wofür „{{seite}}“ da ist.",
    "klarainitiative.hinweis.seite.angebot": "Seite erklären",
    "klarainitiative.erklaerung.ungeprueft":
      "„{{objekt}}“ ist noch nicht geprüft: Niemand aus der Fachprüfung hat den Inhalt bisher bestätigt. Du kannst ihn lesen und nutzen, solltest ihn aber für wichtige Entscheidungen gegenprüfen. Ob und wann er geprüft wird, siehst du am Prüfstatus des Inhalts.",
    "klarainitiative.hinweis.ansage.spaeter":
      "Hinweis zurückgestellt – er kommt frühestens in vier Stunden wieder.",
    "klarainitiative.hinweis.ansage.geschlossen":
      "Hinweis geschlossen – er wird dreissig Tage nicht mehr angeboten.",
    "klarainitiative.aufgaben.titel": "Übertragene Aufgaben",
    "klarainitiative.aufgaben.intro":
      "Nur, was du {{assistenz}} ausdrücklich aufgetragen hast. Details, Abbrechen und Rückgängig stehen an der jeweiligen Auftragskarte.",
    "klarainitiative.aufgaben.leer":
      "Noch keine Aufgabe übertragen. Schreib oder sprich z. B. „Lege den Entwurf ‚Reisekosten‘ an“.",
    "klarainitiative.aufgaben.rueckfrage": "Wartet auf deine Antwort",
    "klarainitiative.aufgaben.nichtAngelegt": "Nicht angelegt – siehe Auftragskarte",
    "klarainitiative.aufgaben.schritte": "{{fertig}} von {{gesamt}} Schritten erledigt",
    "klarainitiative.aufgaben.rechte":
      "Jeder Schritt läuft über die vorhandenen Wege mit deinen Rechten; was du nicht darfst, darf {{assistenz}} auch nicht.",
    "klarainitiative.figur.offen": "Offene Aufgaben: {{anzahl}}",
    "klarainitiative.bedienhilfe.modi":
      "Unter „Wann ich mich melde“ wählst du einen von drei Modi: nur auf Nachfrage, passende Hinweise anbieten oder ausdrücklich übertragene Aufgaben. Die Wahl wird für dein Konto gespeichert.",
    "klarainitiative.bedienhilfe.hinweise":
      "Ein Hinweis erscheint neben der Figur und bietet Hilfe zur aktuellen Seite an. Er führt nichts aus. „Später“ lässt ihn vier Stunden ruhen, „Nicht mehr anbieten“ dreissig Tage; derselbe Hinweis erscheint je Sitzung höchstens einmal.",
    "klarainitiative.bedienhilfe.aufgaben":
      "Im Aufgabenmodus siehst du oben im Gespräch die Aufgaben, die du übertragen hast, mit ihrem Stand – auch nach dem Neuladen. An der Figur steht, wie viele noch offen sind.",
  },
  en: {
    "klarainitiative.wahl.titel": "When I speak up",
    "klarainitiative.wahl.intro":
      "You decide whether {{assistenz}} offers anything on its own. The choice applies to your account – also after reloading and your next sign-in.",
    "klarainitiative.modus.nachfrage.name": "Only when asked",
    "klarainitiative.modus.nachfrage.text":
      "{{assistenz}} stays quiet until you ask or give a task. No hints.",
    "klarainitiative.modus.hinweise.name": "Offer suitable hints",
    "klarainitiative.modus.hinweise.text":
      "{{assistenz}} occasionally offers help for the current page. A hint does nothing by itself – only your click does. “Later” and “Don’t offer again” let it rest.",
    "klarainitiative.modus.auftraege.name": "Explicitly delegated tasks",
    "klarainitiative.modus.auftraege.text":
      "No hints. {{assistenz}} only tracks the tasks you gave yourself, visibly – with your permissions.",
    "klarainitiative.stand.ohneKonto": "Please sign in to save.",
    "klarainitiative.stand.speichert": "Saving …",
    "klarainitiative.stand.fehler":
      "Not saved – the mode shown still applies. Please choose again.",
    "klarainitiative.stand.ladefehler":
      "Your setting could not be read – until then {{assistenz}} stays quiet.",
    "klarainitiative.stand.gespeichert": "Saved for your account.",
    "klarainitiative.stand.vorgabe": "Default – not chosen yet.",
    "klarainitiative.ansage.nachfrage": "Saved: only when asked.",
    "klarainitiative.ansage.hinweise": "Saved: offer suitable hints.",
    "klarainitiative.ansage.auftraege": "Saved: explicitly delegated tasks.",
    "klarainitiative.ansage.fehler": "The setting was not saved.",
    "klarainitiative.hinweis.titel": "Hint from {{assistenz}}",
    "klarainitiative.hinweis.nurAngebot": "Just an offer – nothing happens without your click.",
    "klarainitiative.hinweis.spaeter": "Later",
    "klarainitiative.hinweis.schliessen": "Don’t offer again",
    "klarainitiative.hinweis.tutorial.text":
      "There is a step-by-step guide for “{{seite}}”. Shall I show you the next step?",
    "klarainitiative.hinweis.tutorial.angebot": "Show next step",
    "klarainitiative.hinweis.ungeprueft.text":
      "This content has not been reviewed yet. Shall I explain what that means for you?",
    "klarainitiative.hinweis.ungeprueft.angebot": "Explain",
    "klarainitiative.hinweis.seite.text": "I can explain what “{{seite}}” is for.",
    "klarainitiative.hinweis.seite.angebot": "Explain page",
    "klarainitiative.erklaerung.ungeprueft":
      "“{{objekt}}” has not been reviewed yet: nobody from the expert review has confirmed the content so far. You can read and use it, but should double-check it for important decisions. Whether and when it is reviewed is shown in the content’s review status.",
    "klarainitiative.hinweis.ansage.spaeter":
      "Hint postponed – it returns in four hours at the earliest.",
    "klarainitiative.hinweis.ansage.geschlossen":
      "Hint closed – it will not be offered for thirty days.",
    "klarainitiative.aufgaben.titel": "Delegated tasks",
    "klarainitiative.aufgaben.intro":
      "Only what you explicitly asked {{assistenz}} to do. Details, cancel and undo are on each task card.",
    "klarainitiative.aufgaben.leer":
      "No task delegated yet. Type or say e.g. “Create a draft ‘Travel expenses’”.",
    "klarainitiative.aufgaben.rueckfrage": "Waiting for your answer",
    "klarainitiative.aufgaben.nichtAngelegt": "Not created – see task card",
    "klarainitiative.aufgaben.schritte": "{{fertig}} of {{gesamt}} steps done",
    "klarainitiative.aufgaben.rechte":
      "Every step runs through the existing paths with your permissions; what you may not do, {{assistenz}} may not do either.",
    "klarainitiative.figur.offen": "Open tasks: {{anzahl}}",
    "klarainitiative.bedienhilfe.modi":
      "Under “When I speak up” you choose one of three modes: only when asked, offer suitable hints, or explicitly delegated tasks. The choice is saved for your account.",
    "klarainitiative.bedienhilfe.hinweise":
      "A hint appears next to the figure and offers help for the current page. It carries out nothing. “Later” lets it rest for four hours, “Don’t offer again” for thirty days; the same hint appears at most once per session.",
    "klarainitiative.bedienhilfe.aufgaben":
      "In task mode you see the tasks you delegated at the top of the conversation, with their status – also after reloading. The figure shows how many are still open.",
  },
  nl: {
    "klarainitiative.wahl.titel": "Wanneer ik me meld",
    "klarainitiative.wahl.intro":
      "Jij beslist of {{assistenz}} uit zichzelf iets aanbiedt. De keuze geldt voor je account – ook na herladen en bij de volgende aanmelding.",
    "klarainitiative.modus.nachfrage.name": "Alleen op verzoek",
    "klarainitiative.modus.nachfrage.text":
      "{{assistenz}} blijft stil tot je iets vraagt of een opdracht geeft. Geen tips.",
    "klarainitiative.modus.hinweise.name": "Passende tips aanbieden",
    "klarainitiative.modus.hinweise.text":
      "{{assistenz}} biedt af en toe hulp aan bij de huidige pagina. Een tip doet zelf niets – pas jouw klik. „Later” en „Niet meer aanbieden” laten hem rusten.",
    "klarainitiative.modus.auftraege.name": "Uitdrukkelijk overgedragen taken",
    "klarainitiative.modus.auftraege.text":
      "Geen tips. {{assistenz}} volgt zichtbaar alleen de opdrachten die je zelf hebt gegeven – met jouw rechten.",
    "klarainitiative.stand.ohneKonto": "Meld je aan om op te slaan.",
    "klarainitiative.stand.speichert": "Wordt opgeslagen …",
    "klarainitiative.stand.fehler":
      "Niet opgeslagen – de getoonde modus blijft gelden. Kies opnieuw.",
    "klarainitiative.stand.ladefehler":
      "Je instelling kon niet worden gelezen – tot dan blijft {{assistenz}} stil.",
    "klarainitiative.stand.gespeichert": "Opgeslagen voor je account.",
    "klarainitiative.stand.vorgabe": "Standaard – nog niet gekozen.",
    "klarainitiative.ansage.nachfrage": "Opgeslagen: alleen op verzoek.",
    "klarainitiative.ansage.hinweise": "Opgeslagen: passende tips aanbieden.",
    "klarainitiative.ansage.auftraege": "Opgeslagen: uitdrukkelijk overgedragen taken.",
    "klarainitiative.ansage.fehler": "De instelling is niet opgeslagen.",
    "klarainitiative.hinweis.titel": "Tip van {{assistenz}}",
    "klarainitiative.hinweis.nurAngebot": "Alleen een aanbod – er gebeurt niets zonder jouw klik.",
    "klarainitiative.hinweis.spaeter": "Later",
    "klarainitiative.hinweis.schliessen": "Niet meer aanbieden",
    "klarainitiative.hinweis.tutorial.text":
      "Voor „{{seite}}” is er een stap-voor-stap-handleiding. Zal ik je de volgende stap laten zien?",
    "klarainitiative.hinweis.tutorial.angebot": "Volgende stap tonen",
    "klarainitiative.hinweis.ungeprueft.text":
      "Deze inhoud is nog niet gecontroleerd. Zal ik uitleggen wat dat voor je betekent?",
    "klarainitiative.hinweis.ungeprueft.angebot": "Uitleggen",
    "klarainitiative.hinweis.seite.text": "Ik kan je uitleggen waarvoor „{{seite}}” dient.",
    "klarainitiative.hinweis.seite.angebot": "Pagina uitleggen",
    "klarainitiative.erklaerung.ungeprueft":
      "„{{objekt}}” is nog niet gecontroleerd: niemand uit de inhoudelijke controle heeft de inhoud tot nu toe bevestigd. Je kunt hem lezen en gebruiken, maar controleer hem bij belangrijke beslissingen. Of en wanneer hij gecontroleerd wordt, zie je aan de controlestatus van de inhoud.",
    "klarainitiative.hinweis.ansage.spaeter":
      "Tip uitgesteld – hij komt op zijn vroegst over vier uur terug.",
    "klarainitiative.hinweis.ansage.geschlossen":
      "Tip gesloten – hij wordt dertig dagen niet meer aangeboden.",
    "klarainitiative.aufgaben.titel": "Overgedragen taken",
    "klarainitiative.aufgaben.intro":
      "Alleen wat je {{assistenz}} uitdrukkelijk hebt opgedragen. Details, afbreken en ongedaan maken staan op de betreffende opdrachtkaart.",
    "klarainitiative.aufgaben.leer":
      "Nog geen taak overgedragen. Typ of zeg bijv. „Maak een concept ‚Reiskosten’ aan”.",
    "klarainitiative.aufgaben.rueckfrage": "Wacht op je antwoord",
    "klarainitiative.aufgaben.nichtAngelegt": "Niet aangemaakt – zie opdrachtkaart",
    "klarainitiative.aufgaben.schritte": "{{fertig}} van {{gesamt}} stappen klaar",
    "klarainitiative.aufgaben.rechte":
      "Elke stap loopt via de bestaande wegen met jouw rechten; wat jij niet mag, mag {{assistenz}} ook niet.",
    "klarainitiative.figur.offen": "Open taken: {{anzahl}}",
    "klarainitiative.bedienhilfe.modi":
      "Onder „Wanneer ik me meld” kies je een van drie modi: alleen op verzoek, passende tips aanbieden of uitdrukkelijk overgedragen taken. De keuze wordt voor je account opgeslagen.",
    "klarainitiative.bedienhilfe.hinweise":
      "Een tip verschijnt naast de figuur en biedt hulp bij de huidige pagina aan. Hij voert niets uit. „Later” laat hem vier uur rusten, „Niet meer aanbieden” dertig dagen; dezelfde tip verschijnt per sessie hoogstens één keer.",
    "klarainitiative.bedienhilfe.aufgaben":
      "In de takenmodus zie je bovenaan het gesprek de taken die je hebt overgedragen, met hun stand – ook na herladen. Bij de figuur staat hoeveel er nog open zijn.",
  },
} satisfies Textmodul;
