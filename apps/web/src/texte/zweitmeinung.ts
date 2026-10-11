// ================================================================================================
// AUFNAHME 20260922 (R-0305, R-1099) · DIE TEXTE DER ZWEITMEINUNG ZU EINER ANTWORT.
// ================================================================================================
//
// Fragenseite (Knopf, Gegenüberstellung, Warnzeichen, Gründe) und Adminkarte (Wahl des Zweitmodells).
// Neue Schlüssel tragen das Präfix `zweitmeinung.`. Der eine Altname ist der Aktionsname des
// Prüfprotokolls: `audit.action.*` wird aus dem Aktionsnamen abgeleitet (`ask.zweitmeinung` →
// `audit.action.ask_zweitmeinung`, `lib/auditAction.ts`), und weil der Eintrag die tragende Quelle
// als Ziel hat, erscheint er in der Herkunftskette am Objekt — dort braucht er einen Namen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "zweitmeinung.",
  legacySchluessel: ["audit.action.ask_zweitmeinung"],
  de: {
    "audit.action.ask_zweitmeinung": "Zweitmeinung eingeholt",
    "zweitmeinung.knopf": "Zweitmeinung einholen",
    "zweitmeinung.laeuft": "Zweitmeinung wird eingeholt …",
    "zweitmeinung.titel": "Zweitmeinung",
    "zweitmeinung.erklaerung":
      "Dieselbe Frage wurde mit derselben Grundlage zusätzlich einem zweiten, vom Administrator gewählten Modell gestellt.",
    "zweitmeinung.neuGestellt":
      "Für die Gegenüberstellung wurde die Frage beiden Modellen neu gestellt. Antwort A kann deshalb im Wortlaut von der Antwort oben abweichen.",
    "zweitmeinung.ersteAntwort": "Antwort A · {{stufe}}",
    "zweitmeinung.zweiteAntwort": "Antwort B · {{stufe}}",
    "zweitmeinung.stufe.cloud": "externes Modell",
    "zweitmeinung.stufe.local": "lokales Modell",
    "zweitmeinung.stufe.deterministic": "Ersatzmodus ohne Modell",
    "zweitmeinung.keineAntwort": "Keine belastbare Grundlage gefunden.",
    "zweitmeinung.warnung":
      "Die beiden Antworten weichen voneinander ab. Das ist ein Warnzeichen: Bitte der Sache nachgehen, bevor du dich auf eine der Antworten verlässt.",
    "zweitmeinung.abweichung.beantwortet":
      "Nur eines der beiden Modelle hat eine Antwort gefunden.",
    "zweitmeinung.abweichung.quellen":
      "Die beiden Antworten stützen sich auf keine gemeinsame Quelle.",
    "zweitmeinung.abweichung.zahlen": "Die beiden Antworten nennen unterschiedliche Zahlen.",
    "zweitmeinung.keineAbweichung": "Der automatische Abgleich hat keine Abweichung gefunden.",
    "zweitmeinung.grenze":
      "Der Abgleich prüft nur, ob beide antworten, ob sie eine gemeinsame Quelle nennen und ob die genannten Zahlen übereinstimmen. Den Inhalt bewertet er nicht — bitte beide Antworten lesen.",
    "zweitmeinung.grund.nicht_eingerichtet":
      "Für die Zweitmeinung ist kein zweites Modell gewählt. Ein Administrator kann es unter Einstellungen → KI festlegen.",
    "zweitmeinung.grund.nicht_verfuegbar":
      "Das für die Zweitmeinung gewählte Modell ist nicht eingerichtet.",
    "zweitmeinung.grund.nicht_freigegeben":
      "Das für die Zweitmeinung gewählte Modell ist für diese Inhalte nicht freigegeben.",
    "zweitmeinung.grund.nicht_unabhaengig":
      "Die Antwort kam bereits von dem Modell, das für die Zweitmeinung gewählt ist. Eine unabhängige zweite Einschätzung ist so nicht möglich.",
    "zweitmeinung.grund.fehlgeschlagen":
      "Das zweite Modell hat keine Antwort geliefert. Bitte später erneut versuchen.",
    "zweitmeinung.fehler": "Die Zweitmeinung konnte nicht eingeholt werden.",
    "zweitmeinung.kontextUnbekannt":
      "Für diese gespeicherte Antwort ist nicht bekannt, für welches Werk, welche Schicht oder Rolle sie gestellt wurde. Eine Zweitmeinung zu genau derselben Frage lässt sich so nicht zusichern. Stelle die Frage mit dem oben gewählten Kontext erneut — danach kannst du die Zweitmeinung einholen.",
    "zweitmeinung.neuFragen": "Frage erneut stellen",
    "zweitmeinung.ergaenztAusserhalb":
      "Die Antwort oben ist für dich ergänzt (zum Beispiel um Voraussetzungen oder Begriffe). Diese Ergänzungen gehören nicht zum Vergleich — verglichen werden hier die beiden Modellantworten selbst.",
    "zweitmeinung.admin.titel": "Zweitmeinung zu Antworten",
    "zweitmeinung.admin.text":
      "Auf Wunsch beantwortet ein zweites Modell dieselbe Frage, damit sich niemand auf einen einzigen Weg verlässt. Frage und Grundlage gehen dann zusätzlich an dieses Modell. Ein externer Anbieter braucht die Freigabe für die öffentliche KI.",
    "zweitmeinung.admin.label": "Modell für die Zweitmeinung",
    "zweitmeinung.admin.aus": "Aus — keine Zweitmeinung",
    "zweitmeinung.admin.gespeichert": "Zweitmeinung gespeichert.",
  },
  en: {
    "audit.action.ask_zweitmeinung": "Second opinion obtained",
    "zweitmeinung.knopf": "Get a second opinion",
    "zweitmeinung.laeuft": "Getting a second opinion …",
    "zweitmeinung.titel": "Second opinion",
    "zweitmeinung.erklaerung":
      "The same question was also put, with the same basis, to a second model chosen by the administrator.",
    "zweitmeinung.neuGestellt":
      "For the comparison the question was put to both models again. Answer A may therefore be worded differently from the answer above.",
    "zweitmeinung.ersteAntwort": "Answer A · {{stufe}}",
    "zweitmeinung.zweiteAntwort": "Answer B · {{stufe}}",
    "zweitmeinung.stufe.cloud": "external model",
    "zweitmeinung.stufe.local": "local model",
    "zweitmeinung.stufe.deterministic": "fallback mode without a model",
    "zweitmeinung.keineAntwort": "No reliable basis found.",
    "zweitmeinung.warnung":
      "The two answers differ. This is a warning sign: please look into it before relying on either answer.",
    "zweitmeinung.abweichung.beantwortet": "Only one of the two models found an answer.",
    "zweitmeinung.abweichung.quellen": "The two answers do not rely on any common source.",
    "zweitmeinung.abweichung.zahlen": "The two answers state different numbers.",
    "zweitmeinung.keineAbweichung": "The automatic comparison found no difference.",
    "zweitmeinung.grenze":
      "The comparison only checks whether both answer, whether they cite a common source and whether the numbers they state match. It does not judge the content — please read both answers.",
    "zweitmeinung.grund.nicht_eingerichtet":
      "No second model is chosen for second opinions. An administrator can set one under Settings → AI.",
    "zweitmeinung.grund.nicht_verfuegbar": "The model chosen for second opinions is not set up.",
    "zweitmeinung.grund.nicht_freigegeben":
      "The model chosen for second opinions is not cleared for this content.",
    "zweitmeinung.grund.nicht_unabhaengig":
      "The answer already came from the model chosen for second opinions. An independent second assessment is not possible this way.",
    "zweitmeinung.grund.fehlgeschlagen":
      "The second model did not deliver an answer. Please try again later.",
    "zweitmeinung.fehler": "The second opinion could not be obtained.",
    "zweitmeinung.kontextUnbekannt":
      "It is not known for which plant, shift or role this saved answer was asked. A second opinion on exactly the same question cannot be assured this way. Ask the question again with the context selected above — then you can get the second opinion.",
    "zweitmeinung.neuFragen": "Ask the question again",
    "zweitmeinung.ergaenztAusserhalb":
      "The answer above has been supplemented for you (for example with prerequisites or terms). These additions are not part of the comparison — what is compared here are the two model answers themselves.",
    "zweitmeinung.admin.titel": "Second opinion on answers",
    "zweitmeinung.admin.text":
      "On request a second model answers the same question, so nobody relies on a single path. The question and its basis then also go to this model. An external provider needs the public AI clearance.",
    "zweitmeinung.admin.label": "Model for second opinions",
    "zweitmeinung.admin.aus": "Off — no second opinion",
    "zweitmeinung.admin.gespeichert": "Second opinion saved.",
  },
  nl: {
    "audit.action.ask_zweitmeinung": "Tweede mening ingewonnen",
    "zweitmeinung.knopf": "Tweede mening inwinnen",
    "zweitmeinung.laeuft": "Tweede mening wordt ingewonnen …",
    "zweitmeinung.titel": "Tweede mening",
    "zweitmeinung.erklaerung":
      "Dezelfde vraag is met dezelfde basis ook gesteld aan een tweede model dat de beheerder heeft gekozen.",
    "zweitmeinung.neuGestellt":
      "Voor de vergelijking is de vraag opnieuw aan beide modellen gesteld. Antwoord A kan daarom anders geformuleerd zijn dan het antwoord hierboven.",
    "zweitmeinung.ersteAntwort": "Antwoord A · {{stufe}}",
    "zweitmeinung.zweiteAntwort": "Antwoord B · {{stufe}}",
    "zweitmeinung.stufe.cloud": "extern model",
    "zweitmeinung.stufe.local": "lokaal model",
    "zweitmeinung.stufe.deterministic": "vervangmodus zonder model",
    "zweitmeinung.keineAntwort": "Geen betrouwbare basis gevonden.",
    "zweitmeinung.warnung":
      "De twee antwoorden wijken van elkaar af. Dat is een waarschuwingsteken: zoek het uit voordat je op een van de antwoorden vertrouwt.",
    "zweitmeinung.abweichung.beantwortet":
      "Slechts een van de twee modellen heeft een antwoord gevonden.",
    "zweitmeinung.abweichung.quellen":
      "De twee antwoorden steunen op geen enkele gemeenschappelijke bron.",
    "zweitmeinung.abweichung.zahlen": "De twee antwoorden noemen verschillende getallen.",
    "zweitmeinung.keineAbweichung": "De automatische vergelijking heeft geen afwijking gevonden.",
    "zweitmeinung.grenze":
      "De vergelijking controleert alleen of beide antwoorden, of ze een gemeenschappelijke bron noemen en of de genoemde getallen overeenkomen. De inhoud beoordeelt ze niet — lees beide antwoorden.",
    "zweitmeinung.grund.nicht_eingerichtet":
      "Voor de tweede mening is geen tweede model gekozen. Een beheerder kan het instellen onder Instellingen → AI.",
    "zweitmeinung.grund.nicht_verfuegbar":
      "Het model dat voor de tweede mening is gekozen, is niet ingericht.",
    "zweitmeinung.grund.nicht_freigegeben":
      "Het model dat voor de tweede mening is gekozen, is voor deze inhoud niet vrijgegeven.",
    "zweitmeinung.grund.nicht_unabhaengig":
      "Het antwoord kwam al van het model dat voor de tweede mening is gekozen. Een onafhankelijke tweede beoordeling is zo niet mogelijk.",
    "zweitmeinung.grund.fehlgeschlagen":
      "Het tweede model heeft geen antwoord geleverd. Probeer het later opnieuw.",
    "zweitmeinung.fehler": "De tweede mening kon niet worden ingewonnen.",
    "zweitmeinung.kontextUnbekannt":
      "Het is niet bekend voor welke vestiging, ploeg of rol dit opgeslagen antwoord is gesteld. Een tweede mening over precies dezelfde vraag is zo niet te garanderen. Stel de vraag opnieuw met de hierboven gekozen context — daarna kun je de tweede mening inwinnen.",
    "zweitmeinung.neuFragen": "Vraag opnieuw stellen",
    "zweitmeinung.ergaenztAusserhalb":
      "Het antwoord hierboven is voor je aangevuld (bijvoorbeeld met voorwaarden of begrippen). Deze aanvullingen horen niet bij de vergelijking — hier worden de twee modelantwoorden zelf vergeleken.",
    "zweitmeinung.admin.titel": "Tweede mening bij antwoorden",
    "zweitmeinung.admin.text":
      "Op verzoek beantwoordt een tweede model dezelfde vraag, zodat niemand op één enkele weg vertrouwt. Vraag en basis gaan dan ook naar dit model. Een externe aanbieder heeft de vrijgave voor de openbare AI nodig.",
    "zweitmeinung.admin.label": "Model voor de tweede mening",
    "zweitmeinung.admin.aus": "Uit — geen tweede mening",
    "zweitmeinung.admin.gespeichert": "Tweede mening opgeslagen.",
  },
} satisfies Textmodul;
