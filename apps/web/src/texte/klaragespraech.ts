// ================================================================================================
// KLARA 01 (Auftrag produkt:20261008:klara-basis) — die Texte des echten Klara-Gesprächs.
// ================================================================================================
//
// Die bewegliche Klara im ECHTEN Betrieb: Fragen gehen über den Frageweg von Klarwerk, das Gespräch
// liegt unter dem eigenen Konto. Die Texte sagen an jeder Antwort, wie sie entstanden ist („KI-Antwort"
// nur, wenn ein Modell formuliert hat), und an jeder Nachricht, die NICHT gespeichert werden konnte,
// dass sie fehlt. Die Demo-Texte der Vorschau stehen unverändert in `klaravorschau.ts`.
//
// produkt:20261010:assistenz-name-avatar: `{{assistenz}}` / `{{assistenzTitel}}` statt eines festen
// Namens (gesetzt von `useAssistenzT`); gespeicherte Nachrichten bleiben, wie sie sind.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "klaragespraech.",
  legacySchluessel: [],
  de: {
    "klaragespraech.betrieb.label": "Betrieb",
    "klaragespraech.betrieb.echt": "Echter Betrieb",
    "klaragespraech.betrieb.demo": "Demo",
    "klaragespraech.betrieb.echtKurz": "Echt · Frageweg von Klarwerk",
    "klaragespraech.betrieb.demoKurz": "Demo · vorgefertigt",
    "klaragespraech.untertitel": "Echter Betrieb · dein gespeichertes Gespräch",
    "klaragespraech.hinweis":
      "Echter Betrieb: Deine Fragen gehen an den Frageweg von Klarwerk, wie auf der Seite „Fragen“. Das Gespräch wird unter deinem Konto gespeichert und ist nur für dich sichtbar.",
    "klaragespraech.laden": "Dein Gespräch wird geladen …",
    "klaragespraech.ladeFehler":
      "Dein gespeichertes Gespräch konnte nicht geladen werden. {{grund}}",
    "klaragespraech.ladenNochmal": "Erneut laden",
    "klaragespraech.leer":
      "{{assistenzTitel}} ist bereit – noch kein gespeichertes Gespräch. Stell eine Frage.",
    "klaragespraech.beginn": "Begonnen auf {{seite}} · {{objekt}}",
    "klaragespraech.zurueck": "Dorthin zurück",
    "klaragespraech.schritt.titel": "Zuletzt begonnen",
    "klaragespraech.schritt.frage": "Frage „{{text}}“",
    "klaragespraech.schritt.hilfe": "Hilfe: {{text}}",
    "klaragespraech.schritt.ort": "auf {{seite}} · {{objekt}}",
    "klaragespraech.schritt.stand.laeuft": "läuft",
    "klaragespraech.schritt.stand.beantwortet": "beantwortet",
    "klaragespraech.schritt.stand.abgebrochen": "gestoppt",
    "klaragespraech.schritt.stand.fehlgeschlagen": "fehlgeschlagen",
    "klaragespraech.schritt.stand.unterbrochen": "unterbrochen – keine Antwort erhalten",
    "klaragespraech.schritt.nochmal": "Erneut fragen",
    "klaragespraech.schritt.nichtGespeichert":
      "Der letzte Schritt konnte nicht gespeichert werden. Nach dem Neuladen steht hier der vorige.",
    "klaragespraech.einwilligung.titel": "Einwilligung für dieses Gespräch",
    "klaragespraech.einwilligung.text":
      "{{assistenz}} schickt deine getippten und gesprochenen Fragen (als Text, ohne Tonaufnahme) und als Zusammenhang die vorigen Fragen dieses Gesprächs an den Frageweg von Klarwerk. Markierter Text geht nur mit, wenn du dafür „Erklären“, „Zusammenfassen“ oder den Bezug „Markierung“ wählst – vorher wird geprüft, ob du die Herkunft noch lesen darfst. Geantwortet wird nur aus Wissen, das du lesen darfst; ob und welche Inhalte eine externe KI erhält, entscheiden die zentralen Freigaben.",
    "klaragespraech.einwilligung.erteilen": "Einverstanden",
    "klaragespraech.einwilligung.erteilt": "Einwilligung erteilt am {{zeit}}.",
    "klaragespraech.einwilligung.widerrufen": "Einwilligung widerrufen",
    "klaragespraech.einwilligung.fehlt": "Ohne Einwilligung schickt {{assistenz}} keine Frage los.",
    "klaragespraech.einwilligung.nichtGespeichert":
      "Die Einwilligung wurde nicht gespeichert. {{grund}} Ohne gespeicherte Einwilligung schickt {{assistenz}} nichts an den Frageweg.",
    "klaragespraech.ki.ohneModell":
      "Kein KI-Modell aktiv. {{assistenz}} antwortet dann nur wörtlich aus geprüftem Wissen – das ist keine KI-Antwort und wird so gekennzeichnet.",
    "klaragespraech.ki.unbekannt":
      "Der KI-Status ist gerade nicht abrufbar. Jede Antwort wird so gekennzeichnet, wie sie tatsächlich entstanden ist.",
    "klaragespraech.label.ki": "KI-Antwort",
    "klaragespraech.label.kiHinweis": "KI-generiert, nicht vollständig geprüft",
    "klaragespraech.label.ohneKi": "Ohne KI · wörtlich aus geprüftem Wissen",
    "klaragespraech.label.hilfetext": "Klarwerk-Hilfe · ohne KI",
    "klaragespraech.label.abgebrochen": "Gestoppt",
    "klaragespraech.label.fehler": "Fehler",
    "klaragespraech.gespeichert.laeuft": "wird gespeichert …",
    "klaragespraech.gespeichert.nein": "Nicht gespeichert – fehlt nach dem Neuladen.",
    "klaragespraech.gespeichert.ohneBeleg":
      "Nicht gespeichert – der Frageweg hat keine Antwortkennung geliefert.",
    "klaragespraech.gespeichert.nochmal": "Erneut speichern",
    "klaragespraech.quellen": "Quellen",
    "klaragespraech.antwort.keine":
      "Dazu gibt es in Klarwerk keine Antwort aus Wissen, das du lesen darfst.",
    "klaragespraech.abgebrochen":
      "Anfrage gestoppt. Es kam keine Antwort; der Server kann die Frage trotzdem bearbeitet haben.",
    "klaragespraech.fehler.anmeldung":
      "Deine Anmeldung ist abgelaufen. Bitte neu anmelden – dein Gespräch bleibt gespeichert.",
    "klaragespraech.fehler.berechtigung": "Dir fehlt die Berechtigung für diesen Schritt.",
    "klaragespraech.fehler.netz": "Der Server ist nicht erreichbar.",
    "klaragespraech.fehler.server": "Der Server hat abgelehnt (Status {{status}}).",
    "klaragespraech.laeuftSeit": "Anfrage läuft seit {{s}} s",
    "klaragespraech.stoppen": "Anfrage stoppen",
    "klaragespraech.neu": "Neues Gespräch",
    "klaragespraech.loeschen": "Gespräch löschen",
    "klaragespraech.loeschenBestaetigen": "Wirklich löschen",
    "klaragespraech.loeschenAbbrechen": "Behalten",
    "klaragespraech.aktionHinweis":
      "„Umformulieren“ zeigt Original und Vorschlag nebeneinander – geändert wird erst, wenn du übernimmst und im Editor speicherst. Der Notizentwurf bleibt in dieser Sitzung.",
    "klaragespraech.ansage.beantwortet": "{{assistenz}} hat geantwortet.",
    "klaragespraech.ansage.abgebrochen": "Anfrage gestoppt.",
    "klaragespraech.ansage.fehlgeschlagen": "Die Anfrage ist fehlgeschlagen.",
    "klaragespraech.bedienhilfe.titel": "So arbeitest du mit {{assistenz}}",
    "klaragespraech.bedienhilfe.fragen":
      "Frage tippen und senden. Die Antwort kommt aus dem Frageweg von Klarwerk. „KI-Antwort“ steht nur daran, wenn wirklich ein Modell formuliert hat.",
    "klaragespraech.bedienhilfe.stoppen":
      "Läuft eine Anfrage, bricht „Anfrage stoppen“ sie ab. {{assistenz}} sagt dann, dass keine Antwort kam.",
    "klaragespraech.bedienhilfe.speichern":
      "Das Gespräch liegt unter deinem Konto und geht nach Neuladen, neuer Anmeldung und auf jeder Seite weiter. Was nicht gespeichert werden konnte, ist markiert.",
    "klaragespraech.bedienhilfe.schritt":
      "„Zuletzt begonnen“ zeigt deinen letzten Schritt und die Seite mit dem Objekt, auf der du ihn begonnen hast.",
    "klaragespraech.bedienhilfe.demo":
      "„Demo“ zeigt die vorgefertigten Antworten der Vorschau. Nichts davon ist eine echte Antwort.",
    "klaragespraech.bedienhilfe.bedienen":
      "{{assistenz}} verschieben: ziehen oder Pfeiltasten, Pos1 setzt zurück. Escape schließt das Gespräch; „Seitlich anzeigen“, „Verkleinern“ und „Vollbild“ bleiben verfügbar.",
  },
  en: {
    "klaragespraech.betrieb.label": "Mode",
    "klaragespraech.betrieb.echt": "Live mode",
    "klaragespraech.betrieb.demo": "Demo",
    "klaragespraech.betrieb.echtKurz": "Live · Klarwerk question path",
    "klaragespraech.betrieb.demoKurz": "Demo · prepared",
    "klaragespraech.untertitel": "Live mode · your saved conversation",
    "klaragespraech.hinweis":
      "Live mode: your questions go to Klarwerk's question path, just like on the “Ask” page. The conversation is saved under your account and only visible to you.",
    "klaragespraech.laden": "Loading your conversation …",
    "klaragespraech.ladeFehler": "Your saved conversation could not be loaded. {{grund}}",
    "klaragespraech.ladenNochmal": "Load again",
    "klaragespraech.leer":
      "{{assistenzTitel}} is ready – no saved conversation yet. Ask a question.",
    "klaragespraech.beginn": "Started on {{seite}} · {{objekt}}",
    "klaragespraech.zurueck": "Go back there",
    "klaragespraech.schritt.titel": "Last started",
    "klaragespraech.schritt.frage": "Question “{{text}}”",
    "klaragespraech.schritt.hilfe": "Help: {{text}}",
    "klaragespraech.schritt.ort": "on {{seite}} · {{objekt}}",
    "klaragespraech.schritt.stand.laeuft": "running",
    "klaragespraech.schritt.stand.beantwortet": "answered",
    "klaragespraech.schritt.stand.abgebrochen": "stopped",
    "klaragespraech.schritt.stand.fehlgeschlagen": "failed",
    "klaragespraech.schritt.stand.unterbrochen": "interrupted – no answer received",
    "klaragespraech.schritt.nochmal": "Ask again",
    "klaragespraech.schritt.nichtGespeichert":
      "The last step could not be saved. After reloading, the previous one is shown here.",
    "klaragespraech.einwilligung.titel": "Consent for this conversation",
    "klaragespraech.einwilligung.text":
      "{{assistenz}} sends the questions you type or speak (as text, without the audio), and the earlier questions of this conversation as context, to Klarwerk's question path. Selected text is only sent when you choose “Explain”, “Summarise” or the reference “Selection” – before that, it is checked that you may still read its origin. Answers only use knowledge you may read; whether and which content an external AI receives is decided by the central approvals.",
    "klaragespraech.einwilligung.erteilen": "I agree",
    "klaragespraech.einwilligung.erteilt": "Consent given on {{zeit}}.",
    "klaragespraech.einwilligung.widerrufen": "Withdraw consent",
    "klaragespraech.einwilligung.fehlt":
      "Without consent, {{assistenz}} does not send any question.",
    "klaragespraech.einwilligung.nichtGespeichert":
      "The consent was not saved. {{grund}} Without saved consent, {{assistenz}} sends nothing to the question path.",
    "klaragespraech.ki.ohneModell":
      "No AI model is active. {{assistenz}} then only answers verbatim from verified knowledge – that is not an AI answer and is labelled as such.",
    "klaragespraech.ki.unbekannt":
      "The AI status cannot be retrieved right now. Every answer is labelled the way it was actually produced.",
    "klaragespraech.label.ki": "AI answer",
    "klaragespraech.label.kiHinweis": "AI-generated, not fully verified",
    "klaragespraech.label.ohneKi": "Without AI · verbatim from verified knowledge",
    "klaragespraech.label.hilfetext": "Klarwerk help · without AI",
    "klaragespraech.label.abgebrochen": "Stopped",
    "klaragespraech.label.fehler": "Error",
    "klaragespraech.gespeichert.laeuft": "saving …",
    "klaragespraech.gespeichert.nein": "Not saved – missing after reloading.",
    "klaragespraech.gespeichert.ohneBeleg":
      "Not saved – the question path did not return an answer ID.",
    "klaragespraech.gespeichert.nochmal": "Save again",
    "klaragespraech.quellen": "Sources",
    "klaragespraech.antwort.keine":
      "Klarwerk has no answer to this from knowledge you are allowed to read.",
    "klaragespraech.abgebrochen":
      "Request stopped. No answer arrived; the server may still have processed the question.",
    "klaragespraech.fehler.anmeldung":
      "Your sign-in has expired. Please sign in again – your conversation stays saved.",
    "klaragespraech.fehler.berechtigung": "You do not have permission for this step.",
    "klaragespraech.fehler.netz": "The server cannot be reached.",
    "klaragespraech.fehler.server": "The server refused (status {{status}}).",
    "klaragespraech.laeuftSeit": "Request running for {{s}} s",
    "klaragespraech.stoppen": "Stop request",
    "klaragespraech.neu": "New conversation",
    "klaragespraech.loeschen": "Delete conversation",
    "klaragespraech.loeschenBestaetigen": "Really delete",
    "klaragespraech.loeschenAbbrechen": "Keep",
    "klaragespraech.aktionHinweis":
      "“Rephrase” shows original and suggestion side by side – nothing changes until you apply it and save in the editor. The note draft stays in this session.",
    "klaragespraech.ansage.beantwortet": "{{assistenz}} has answered.",
    "klaragespraech.ansage.abgebrochen": "Request stopped.",
    "klaragespraech.ansage.fehlgeschlagen": "The request failed.",
    "klaragespraech.bedienhilfe.titel": "How to work with {{assistenz}}",
    "klaragespraech.bedienhilfe.fragen":
      "Type a question and send it. The answer comes from Klarwerk's question path. It is only labelled “AI answer” if a model actually wrote it.",
    "klaragespraech.bedienhilfe.stoppen":
      "While a request is running, “Stop request” cancels it. {{assistenz}} then says that no answer arrived.",
    "klaragespraech.bedienhilfe.speichern":
      "The conversation is stored under your account and continues after reloading, signing in again and on every page. Anything that could not be saved is marked.",
    "klaragespraech.bedienhilfe.schritt":
      "“Last started” shows your last step and the page with the object where you started it.",
    "klaragespraech.bedienhilfe.demo":
      "“Demo” shows the prepared answers of the preview. None of them is a real answer.",
    "klaragespraech.bedienhilfe.bedienen":
      "Move {{assistenz}}: drag or use the arrow keys, Home resets. Escape closes the conversation; “Show at the side”, “Minimise” and “Full screen” stay available.",
  },
  nl: {
    "klaragespraech.betrieb.label": "Modus",
    "klaragespraech.betrieb.echt": "Echte modus",
    "klaragespraech.betrieb.demo": "Demo",
    "klaragespraech.betrieb.echtKurz": "Echt · vraagroute van Klarwerk",
    "klaragespraech.betrieb.demoKurz": "Demo · voorbereid",
    "klaragespraech.untertitel": "Echte modus · je opgeslagen gesprek",
    "klaragespraech.hinweis":
      "Echte modus: je vragen gaan naar de vraagroute van Klarwerk, net als op de pagina “Vragen”. Het gesprek wordt onder je account opgeslagen en is alleen voor jou zichtbaar.",
    "klaragespraech.laden": "Je gesprek wordt geladen …",
    "klaragespraech.ladeFehler": "Je opgeslagen gesprek kon niet worden geladen. {{grund}}",
    "klaragespraech.ladenNochmal": "Opnieuw laden",
    "klaragespraech.leer":
      "{{assistenzTitel}} staat klaar – nog geen opgeslagen gesprek. Stel een vraag.",
    "klaragespraech.beginn": "Begonnen op {{seite}} · {{objekt}}",
    "klaragespraech.zurueck": "Daarheen terug",
    "klaragespraech.schritt.titel": "Laatst begonnen",
    "klaragespraech.schritt.frage": "Vraag “{{text}}”",
    "klaragespraech.schritt.hilfe": "Hulp: {{text}}",
    "klaragespraech.schritt.ort": "op {{seite}} · {{objekt}}",
    "klaragespraech.schritt.stand.laeuft": "loopt",
    "klaragespraech.schritt.stand.beantwortet": "beantwoord",
    "klaragespraech.schritt.stand.abgebrochen": "gestopt",
    "klaragespraech.schritt.stand.fehlgeschlagen": "mislukt",
    "klaragespraech.schritt.stand.unterbrochen": "onderbroken – geen antwoord ontvangen",
    "klaragespraech.schritt.nochmal": "Opnieuw vragen",
    "klaragespraech.schritt.nichtGespeichert":
      "De laatste stap kon niet worden opgeslagen. Na herladen staat hier de vorige.",
    "klaragespraech.einwilligung.titel": "Toestemming voor dit gesprek",
    "klaragespraech.einwilligung.text":
      "{{assistenz}} stuurt je getypte en gesproken vragen (als tekst, zonder geluidsopname), en als context de eerdere vragen van dit gesprek, naar de vraagroute van Klarwerk. Gemarkeerde tekst gaat alleen mee als je daarvoor „Uitleggen”, „Samenvatten” of de verwijzing „Markering” kiest – vooraf wordt gecontroleerd of je de herkomst nog mag lezen. Er wordt alleen geantwoord uit kennis die je mag lezen; of en welke inhoud een externe AI krijgt, bepalen de centrale vrijgaven.",
    "klaragespraech.einwilligung.erteilen": "Akkoord",
    "klaragespraech.einwilligung.erteilt": "Toestemming gegeven op {{zeit}}.",
    "klaragespraech.einwilligung.widerrufen": "Toestemming intrekken",
    "klaragespraech.einwilligung.fehlt": "Zonder toestemming stuurt {{assistenz}} geen vraag.",
    "klaragespraech.einwilligung.nichtGespeichert":
      "De toestemming is niet opgeslagen. {{grund}} Zonder opgeslagen toestemming stuurt {{assistenz}} niets naar de vraagroute.",
    "klaragespraech.ki.ohneModell":
      "Er is geen AI-model actief. {{assistenz}} antwoordt dan alleen letterlijk uit gecontroleerde kennis – dat is geen AI-antwoord en wordt zo aangeduid.",
    "klaragespraech.ki.unbekannt":
      "De AI-status is op dit moment niet op te vragen. Elk antwoord wordt aangeduid zoals het werkelijk is ontstaan.",
    "klaragespraech.label.ki": "AI-antwoord",
    "klaragespraech.label.kiHinweis": "Door AI gegenereerd, niet volledig gecontroleerd",
    "klaragespraech.label.ohneKi": "Zonder AI · letterlijk uit gecontroleerde kennis",
    "klaragespraech.label.hilfetext": "Klarwerk-hulp · zonder AI",
    "klaragespraech.label.abgebrochen": "Gestopt",
    "klaragespraech.label.fehler": "Fout",
    "klaragespraech.gespeichert.laeuft": "wordt opgeslagen …",
    "klaragespraech.gespeichert.nein": "Niet opgeslagen – ontbreekt na herladen.",
    "klaragespraech.gespeichert.ohneBeleg":
      "Niet opgeslagen – de vraagroute heeft geen antwoord-ID geleverd.",
    "klaragespraech.gespeichert.nochmal": "Opnieuw opslaan",
    "klaragespraech.quellen": "Bronnen",
    "klaragespraech.antwort.keine":
      "Klarwerk heeft hierop geen antwoord uit kennis die je mag lezen.",
    "klaragespraech.abgebrochen":
      "Verzoek gestopt. Er kwam geen antwoord; de server kan de vraag toch hebben verwerkt.",
    "klaragespraech.fehler.anmeldung":
      "Je aanmelding is verlopen. Meld je opnieuw aan – je gesprek blijft opgeslagen.",
    "klaragespraech.fehler.berechtigung": "Je hebt geen bevoegdheid voor deze stap.",
    "klaragespraech.fehler.netz": "De server is niet bereikbaar.",
    "klaragespraech.fehler.server": "De server heeft geweigerd (status {{status}}).",
    "klaragespraech.laeuftSeit": "Verzoek loopt sinds {{s}} s",
    "klaragespraech.stoppen": "Verzoek stoppen",
    "klaragespraech.neu": "Nieuw gesprek",
    "klaragespraech.loeschen": "Gesprek verwijderen",
    "klaragespraech.loeschenBestaetigen": "Echt verwijderen",
    "klaragespraech.loeschenAbbrechen": "Behouden",
    "klaragespraech.aktionHinweis":
      "„Herformuleren” toont origineel en voorstel naast elkaar – er verandert pas iets als je het overneemt en in de editor opslaat. Het notitieconcept blijft in deze sessie.",
    "klaragespraech.ansage.beantwortet": "{{assistenz}} heeft geantwoord.",
    "klaragespraech.ansage.abgebrochen": "Verzoek gestopt.",
    "klaragespraech.ansage.fehlgeschlagen": "Het verzoek is mislukt.",
    "klaragespraech.bedienhilfe.titel": "Zo werk je met {{assistenz}}",
    "klaragespraech.bedienhilfe.fragen":
      "Typ een vraag en verstuur die. Het antwoord komt uit de vraagroute van Klarwerk. Er staat alleen “AI-antwoord” bij als een model het echt heeft geformuleerd.",
    "klaragespraech.bedienhilfe.stoppen":
      "Loopt er een verzoek, dan breekt “Verzoek stoppen” het af. {{assistenz}} zegt dan dat er geen antwoord kwam.",
    "klaragespraech.bedienhilfe.speichern":
      "Het gesprek staat onder je account en gaat verder na herladen, opnieuw aanmelden en op elke pagina. Wat niet kon worden opgeslagen, is gemarkeerd.",
    "klaragespraech.bedienhilfe.schritt":
      "“Laatst begonnen” toont je laatste stap en de pagina met het object waar je die begon.",
    "klaragespraech.bedienhilfe.demo":
      "“Demo” toont de voorbereide antwoorden van de preview. Geen daarvan is een echt antwoord.",
    "klaragespraech.bedienhilfe.bedienen":
      "{{assistenz}} verplaatsen: slepen of pijltjestoetsen, Home zet terug. Escape sluit het gesprek; “Aan de zijkant tonen”, “Verkleinen” en “Volledig scherm” blijven beschikbaar.",
  },
} satisfies Textmodul;
