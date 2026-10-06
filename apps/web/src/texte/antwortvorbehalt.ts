// ================================================================================================
// R-0287 / R-0286 · DER VORBEHALT EINER ANTWORT IST UNÜBERSEHBAR, OHNE SICH ZU WIEDERHOLEN.
// ================================================================================================
//
// Seit JOB 3064 (H5) stehen Prüfvorbehalt, Konfliktvorbehalt, unbekannter Konfliktstand und der
// Review-Hinweis vollständig im Info-Blatt „…" → „Mehr". Ohne den Griff sah der Leser von ihnen
// nichts — R-0287 verlangt aber: „Die eigentliche Warnung bleibt vollständig und unübersehbar."
// Dieser Satz ist der sichtbare Griff dazu, direkt unter der Antwort. Er wiederholt den Vorbehalt
// NICHT (der steht weiter genau einmal, im Blatt), er sagt nur, DASS es einen gibt und wo er steht.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "antwortvorbehalt.",
  legacySchluessel: [],
  de: {
    "antwortvorbehalt.hinweis_one": "Vorbehalt zu dieser Antwort — vor der Nutzung lesen",
    "antwortvorbehalt.hinweis_other":
      "{{count}} Vorbehalte zu dieser Antwort — vor der Nutzung lesen",
  },
  en: {
    "antwortvorbehalt.hinweis_one": "Caveat on this answer — read before using it",
    "antwortvorbehalt.hinweis_other": "{{count}} caveats on this answer — read before using it",
  },
  nl: {
    "antwortvorbehalt.hinweis_one": "Voorbehoud bij dit antwoord — lees het vóór gebruik",
    "antwortvorbehalt.hinweis_other":
      "{{count}} voorbehouden bij dit antwoord — lees ze vóór gebruik",
  },
} satisfies Textmodul;
