// ================================================================================================
// R-0570 · DIE TEXTE DER ANONYMEN VORFÜHRUNG (`apps/web/src/vorfuehrung/VorfuehrungScreen.tsx`).
// ================================================================================================
//
// Entscheidung zu Frage 14 (11.10.2026): „Firmenwissen authentifiziert; anonyme Demo nur
// öffentlich/fiktiv." Jeder Satz hier sagt deshalb ausdrücklich, dass die Inhalte erfunden sind —
// niemand soll eine Beispielantwort für eine Auskunft über seinen Betrieb halten.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "vorfuehrung.",
  legacySchluessel: [],
  de: {
    "vorfuehrung.titel": "Vorführung ohne Anmeldung",
    "vorfuehrung.einleitung":
      "Hier können Sie KLARWERK ausprobieren, ohne sich anzumelden. Alles auf dieser Seite ist erfunden; Ihr Unternehmenswissen sehen Sie erst nach der Anmeldung.",
    "vorfuehrung.ohneKi":
      "Antworten kommen hier nicht von einer KI, sondern aus den passenden Beispielinhalten.",
    "vorfuehrung.frageLabel": "Ihre Frage an die Beispielinhalte",
    "vorfuehrung.fragen": "Fragen",
    "vorfuehrung.treffer": "Passende Beispielinhalte",
    "vorfuehrung.keineTreffer": "Dazu steht in den Beispielinhalten nichts.",
    "vorfuehrung.alle": "Alle Beispielinhalte",
    "vorfuehrung.ladefehler": "Die Vorführung ist gerade nicht erreichbar.",
    "vorfuehrung.zurAnmeldung": "Zur Anmeldung",
    "vorfuehrung.zurVorfuehrung": "Ohne Anmeldung ausprobieren (erfundene Beispielinhalte)",
  },
  en: {
    "vorfuehrung.titel": "Demonstration without signing in",
    "vorfuehrung.einleitung":
      "Try KLARWERK here without signing in. Everything on this page is invented; you see your company knowledge only after signing in.",
    "vorfuehrung.ohneKi":
      "Answers here do not come from an AI but from the matching sample content.",
    "vorfuehrung.frageLabel": "Your question about the sample content",
    "vorfuehrung.fragen": "Ask",
    "vorfuehrung.treffer": "Matching sample content",
    "vorfuehrung.keineTreffer": "The sample content says nothing about this.",
    "vorfuehrung.alle": "All sample content",
    "vorfuehrung.ladefehler": "The demonstration is not available right now.",
    "vorfuehrung.zurAnmeldung": "Go to sign-in",
    "vorfuehrung.zurVorfuehrung": "Try without signing in (invented sample content)",
  },
  nl: {
    "vorfuehrung.titel": "Demonstratie zonder aanmelden",
    "vorfuehrung.einleitung":
      "Probeer KLARWERK hier uit zonder je aan te melden. Alles op deze pagina is verzonnen; je bedrijfskennis zie je pas na het aanmelden.",
    "vorfuehrung.ohneKi":
      "Antwoorden komen hier niet van een AI, maar uit de passende voorbeeldinhoud.",
    "vorfuehrung.frageLabel": "Je vraag over de voorbeeldinhoud",
    "vorfuehrung.fragen": "Vragen",
    "vorfuehrung.treffer": "Passende voorbeeldinhoud",
    "vorfuehrung.keineTreffer": "De voorbeeldinhoud zegt hier niets over.",
    "vorfuehrung.alle": "Alle voorbeeldinhoud",
    "vorfuehrung.ladefehler": "De demonstratie is op dit moment niet bereikbaar.",
    "vorfuehrung.zurAnmeldung": "Naar aanmelden",
    "vorfuehrung.zurVorfuehrung": "Uitproberen zonder aanmelden (verzonnen voorbeeldinhoud)",
  },
} satisfies Textmodul;
