// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BESTANDSBEREINIGUNG — Doppel-Kandidaten im Aufräum-Kasten (R-0124).
// ================================================================================================
//
// Der Aufräum-Kasten im Import-Bereich (WP-D-CLEAN) zeigt vor dem Aufräumen eine Vorschau und danach
// die Bilanz. R-0124 verlangt beides „einschliesslich der erkannten Doppel-Kandidaten“: die Vorschau
// nennt, wie viele der Kandidaten als Doppel erkannt sind, die Bilanz, wie viele davon wirklich
// entfernt wurden. Beide Zeilen stehen immer da, auch bei null — die Zahl ist die Aussage.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "aufraeumbilanz.",
  legacySchluessel: [],
  de: {
    "aufraeumbilanz.vorschauDoppel": "Davon {{n}} erkannte Doppel-Kandidaten.",
    "aufraeumbilanz.bilanzDoppel": "davon {{n}} erkannte Doppel-Kandidaten entfernt",
  },
  en: {
    "aufraeumbilanz.vorschauDoppel": "Of these, {{n}} detected duplicate candidates.",
    "aufraeumbilanz.bilanzDoppel": "of these, {{n}} detected duplicate candidates removed",
  },
  nl: {
    "aufraeumbilanz.vorschauDoppel": "Waarvan {{n}} herkende dubbele kandidaten.",
    "aufraeumbilanz.bilanzDoppel": "waarvan {{n}} herkende dubbele kandidaten verwijderd",
  },
} satisfies Textmodul;
