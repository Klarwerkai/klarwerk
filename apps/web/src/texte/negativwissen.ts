// ================================================================================================
// AUFNAHME 20260922 · NEGATIVWISSEN-HINWEIS (R-1629) — die Texte des Hinweises beim Erfassen.
// ================================================================================================
//
// Der Hinweis erscheint, wenn der Entwurf einem Eintrag der Wissensart „Negativwissen" ähnelt
// (services/app/src/knowledge-check.ts, `negativwissenAuskunft`). Belegt ist nur die Textnähe —
// die Texte sagen deshalb „bitte vorher lesen" und fällen kein Urteil über den Entwurf.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "negativwissen.",
  legacySchluessel: [],
  de: {
    "negativwissen.titel": "Achtung: Das wurde schon einmal probiert",
    "negativwissen.einleitung":
      "Dein Text ähnelt einem Weg, der als Negativwissen festgehalten ist („haben wir probiert, ging nicht“). Lies nach, warum er nicht funktioniert hat, bevor du ihn erneut vorschlägst.",
    "negativwissen.grenze":
      "Der Hinweis beruht auf Textähnlichkeit. Ob du wirklich denselben Weg meinst, entscheidest du.",
  },
  en: {
    "negativwissen.titel": "Heads-up: this has been tried before",
    "negativwissen.einleitung":
      "Your text resembles an approach recorded as negative knowledge (“we tried this, it did not work”). Read why it failed before you propose it again.",
    "negativwissen.grenze":
      "This hint is based on text similarity. Whether you really mean the same approach is your call.",
  },
  nl: {
    "negativwissen.titel": "Let op: dit is al eens geprobeerd",
    "negativwissen.einleitung":
      "Je tekst lijkt op een aanpak die als negatieve kennis is vastgelegd (‘hebben we geprobeerd, werkte niet’). Lees waarom het niet werkte voordat je het opnieuw voorstelt.",
    "negativwissen.grenze":
      "Deze hint is gebaseerd op tekstgelijkenis. Of je echt dezelfde aanpak bedoelt, bepaal je zelf.",
  },
} satisfies Textmodul;
