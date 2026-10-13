// ================================================================================================
// produkt:20261010:poc-ki-ausfall-weiterarbeiten · DIE TEXTE ZUM ISOLIERTEN KI-AUSFALL.
// ================================================================================================
//
// Fragenseite und Klara-Sperrhinweis. Jeder Satz nennt eine TATSÄCHLICHE Ursache (PV-03-01) und
// enthält nichts aus der Anfrage, keinen Anbieternamen, keinen Status, keinen Schlüssel. Wo etwas
// gespeichert ist, sagt der Satz WO und mit welcher Grenze (PV-03-03). Die Ableitung, welcher Satz
// gilt, steht in `lib/kiAusfall.ts` — hier stehen nur die Wörter.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "kiausfall.",
  legacySchluessel: [],
  de: {
    "kiausfall.status.nichtErreichbar":
      "KI derzeit nicht erreichbar — der eingerichtete KI-Dienst hat zuletzt nicht geantwortet. Betroffen ist nur die KI: Bestand, Erfassen und Prüfungen bleiben nutzbar.",
    "kiausfall.status.erneutPruefen": "KI-Status erneut prüfen",
    "kiausfall.status.pruefeLaeuft": "KI-Status wird geprüft …",
    "kiausfall.fehler.kapazitaet.titel": "Die KI-Kapazität ist gerade ausgeschöpft.",
    "kiausfall.fehler.kapazitaet.text":
      "Es laufen bereits so viele KI-Anfragen, wie die eingestellte Grenze erlaubt. Für diese Frage wurde keine Antwort erzeugt und keine Wissenslücke angelegt. Bitte gleich erneut versuchen.",
    "kiausfall.fehler.verweigert.titel": "Die Verarbeitung wurde nicht freigegeben.",
    "kiausfall.fehler.verweigert.text":
      "Für diese Anfrage gilt eine Zustimmung nur für einen bestimmten KI-Anbieter, und dieser hat nicht geantwortet. Ein anderer Weg wird dafür nicht ersatzweise genutzt. Es wurde keine Antwort erzeugt.",
    "kiausfall.hilfe.manuell": "Ohne KI weiterarbeiten:",
    "kiausfall.entwurf.browser":
      "Deine Frage steht weiter im Feld und ist in diesem Browser für dein Konto gespeichert — nicht auf dem Server. In einem anderen Browser oder nach dem Löschen der Browserdaten ist sie nicht da.",
    "kiausfall.entwurf.nurSeite":
      "Deine Frage steht weiter im Feld. Dieser Browser speichert sie gerade nicht — beim Neuladen oder Schließen der Seite geht sie verloren.",
    "kiausfall.ersatz.zeitueberschreitung":
      "Ohne KI beantwortet: Der KI-Dienst hat nicht rechtzeitig geantwortet (Zeitüberschreitung). Diese Antwort ist regelbasiert aus dem Bestand zusammengestellt.",
    "kiausfall.ersatz.nicht_erreichbar":
      "Ohne KI beantwortet: Der KI-Dienst war nicht erreichbar. Diese Antwort ist regelbasiert aus dem Bestand zusammengestellt.",
    "kiausfall.ersatz.verweigert":
      "Ohne KI beantwortet: Die Verarbeitung durch den KI-Dienst wurde abgelehnt. Diese Antwort ist regelbasiert aus dem Bestand zusammengestellt.",
    "kiausfall.ersatz.kontingent":
      "Ohne KI beantwortet: Das Kontingent beim KI-Dienst ist ausgeschöpft. Diese Antwort ist regelbasiert aus dem Bestand zusammengestellt.",
    "kiausfall.ersatz.fehler":
      "Ohne KI beantwortet: Der KI-Dienst hat keine verwertbare Antwort geliefert. Diese Antwort ist regelbasiert aus dem Bestand zusammengestellt.",
  },
  en: {
    "kiausfall.status.nichtErreichbar":
      "AI currently unreachable — the configured AI service did not respond recently. Only the AI is affected: the knowledge base, capture and reviews remain available.",
    "kiausfall.status.erneutPruefen": "Check AI status again",
    "kiausfall.status.pruefeLaeuft": "Checking AI status …",
    "kiausfall.fehler.kapazitaet.titel": "AI capacity is currently exhausted.",
    "kiausfall.fehler.kapazitaet.text":
      "As many AI requests are already running as the configured limit allows. No answer was generated for this question and no knowledge gap was created. Please try again shortly.",
    "kiausfall.fehler.verweigert.titel": "Processing was not permitted.",
    "kiausfall.fehler.verweigert.text":
      "For this request, consent applies only to one specific AI provider, and that provider did not respond. No other route is used as a substitute. No answer was generated.",
    "kiausfall.hilfe.manuell": "Continue without AI:",
    "kiausfall.entwurf.browser":
      "Your question is still in the field and is stored in this browser for your account — not on the server. It is not available in another browser or after browser data is cleared.",
    "kiausfall.entwurf.nurSeite":
      "Your question is still in the field. This browser is currently not storing it — it will be lost when the page is reloaded or closed.",
    "kiausfall.ersatz.zeitueberschreitung":
      "Answered without AI: the AI service did not respond in time (timeout). This answer was compiled by rules from the knowledge base.",
    "kiausfall.ersatz.nicht_erreichbar":
      "Answered without AI: the AI service was unreachable. This answer was compiled by rules from the knowledge base.",
    "kiausfall.ersatz.verweigert":
      "Answered without AI: processing by the AI service was refused. This answer was compiled by rules from the knowledge base.",
    "kiausfall.ersatz.kontingent":
      "Answered without AI: the quota of the AI service is exhausted. This answer was compiled by rules from the knowledge base.",
    "kiausfall.ersatz.fehler":
      "Answered without AI: the AI service did not return a usable answer. This answer was compiled by rules from the knowledge base.",
  },
  nl: {
    "kiausfall.status.nichtErreichbar":
      "AI momenteel niet bereikbaar — de ingerichte AI-dienst heeft recent niet geantwoord. Alleen de AI is getroffen: kennisbank, vastleggen en controles blijven bruikbaar.",
    "kiausfall.status.erneutPruefen": "AI-status opnieuw controleren",
    "kiausfall.status.pruefeLaeuft": "AI-status wordt gecontroleerd …",
    "kiausfall.fehler.kapazitaet.titel": "De AI-capaciteit is op dit moment uitgeput.",
    "kiausfall.fehler.kapazitaet.text":
      "Er lopen al zoveel AI-verzoeken als de ingestelde grens toestaat. Voor deze vraag is geen antwoord gemaakt en geen kennislacune aangelegd. Probeer het zo meteen opnieuw.",
    "kiausfall.fehler.verweigert.titel": "De verwerking is niet vrijgegeven.",
    "kiausfall.fehler.verweigert.text":
      "Voor dit verzoek geldt toestemming alleen voor één bepaalde AI-aanbieder, en die heeft niet geantwoord. Een andere weg wordt niet als vervanging gebruikt. Er is geen antwoord gemaakt.",
    "kiausfall.hilfe.manuell": "Zonder AI verder werken:",
    "kiausfall.entwurf.browser":
      "Je vraag staat nog in het veld en is in deze browser voor je account opgeslagen — niet op de server. In een andere browser of na het wissen van browsergegevens is ze er niet.",
    "kiausfall.entwurf.nurSeite":
      "Je vraag staat nog in het veld. Deze browser slaat haar op dit moment niet op — bij herladen of sluiten van de pagina gaat ze verloren.",
    "kiausfall.ersatz.zeitueberschreitung":
      "Zonder AI beantwoord: de AI-dienst heeft niet op tijd geantwoord (time-out). Dit antwoord is op basis van regels uit de kennisbank samengesteld.",
    "kiausfall.ersatz.nicht_erreichbar":
      "Zonder AI beantwoord: de AI-dienst was niet bereikbaar. Dit antwoord is op basis van regels uit de kennisbank samengesteld.",
    "kiausfall.ersatz.verweigert":
      "Zonder AI beantwoord: de verwerking door de AI-dienst is geweigerd. Dit antwoord is op basis van regels uit de kennisbank samengesteld.",
    "kiausfall.ersatz.kontingent":
      "Zonder AI beantwoord: het tegoed bij de AI-dienst is uitgeput. Dit antwoord is op basis van regels uit de kennisbank samengesteld.",
    "kiausfall.ersatz.fehler":
      "Zonder AI beantwoord: de AI-dienst heeft geen bruikbaar antwoord geleverd. Dit antwoord is op basis van regels uit de kennisbank samengesteld.",
  },
} satisfies Textmodul;
