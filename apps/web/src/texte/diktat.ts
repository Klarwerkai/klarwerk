// ================================================================================================
// DIKTAT UND VORLESEN · DIE TEXTE DIESES NUTZERWEGS — bei ihrer Funktion, nicht im Sammelbuch.
// ================================================================================================
//
// Der Auftrag „Diktat und Vorlesen in unterstützten Browsern anbieten" bringt genau diese vier
// Sätze mit. Sie sind NEU, deshalb tragen sie das Präfix `diktat.` (Vertrag in
// `./intern/pruefung.ts`) und keine Ausnahme in `legacySchluessel`.
//   · `diktat.antwortVorlesen*` — R-1053: die Antwort auf /fragen vorlesen; ohne Sprachausgabe der
//     ehrliche Satz im „Mehr“-Blatt (`pages/Ask.tsx`).
//   · `diktat.iosTastatur` — FR-CAP-03: auf iPhone/iPad gibt es kein Browser-Diktat (es friert dort
//     ein); der Ausweg ist das Mikrofon der Bildschirmtastatur (`pages/Ask.tsx`,
//     `components/erfassen/Blatt.tsx`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "diktat.",
  legacySchluessel: [],
  de: {
    "diktat.antwortVorlesen": "Vorlesen",
    "diktat.antwortVorlesenStop": "Vorlesen stoppen",
    "diktat.antwortVorlesenNa":
      "Vorlesen ist in diesem Browser nicht verfügbar. Die Antwort steht vollständig als Text da.",
    "diktat.iosTastatur":
      "Auf iPhone und iPad nutze das Mikrofon der Bildschirmtastatur – es schreibt direkt ins Feld.",
  },
  en: {
    "diktat.antwortVorlesen": "Read aloud",
    "diktat.antwortVorlesenStop": "Stop reading",
    "diktat.antwortVorlesenNa":
      "Reading aloud is not available in this browser. The full answer is shown as text.",
    "diktat.iosTastatur":
      "On iPhone and iPad, use the microphone on the on-screen keyboard — it types straight into the field.",
  },
  nl: {
    "diktat.antwortVorlesen": "Voorlezen",
    "diktat.antwortVorlesenStop": "Voorlezen stoppen",
    "diktat.antwortVorlesenNa":
      "Voorlezen is in deze browser niet beschikbaar. Het volledige antwoord staat als tekst.",
    "diktat.iosTastatur":
      "Gebruik op iPhone en iPad de microfoon van het schermtoetsenbord — die schrijft direct in het veld.",
  },
} satisfies Textmodul;
