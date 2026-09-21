// ================================================================================================
// UX26 · DIE TEXTE DER HERKUNFTS- UND BELEGANZEIGE — bei ihrer Funktion, nicht im Sammelbuch.
// ================================================================================================
//
// WAS HIER STEHT UND WARUM GERADE DAS: die vier Schlüssel, die der Vertrag UX26 als nächstes
// ÄNDERT. Sie sind aus `apps/web/src/i18n.ts` hierher umgezogen — wörtlich, Zeichen für Zeichen, in
// allen drei Sprachen. Für einen Anwender ändert dieser Umzug nichts (JOB 4367).
//
// ES SIND ALTNAMEN und stehen deshalb in `legacySchluessel` — die Begründung steht in `ux08.ts`
// und gilt hier unverändert. Neue Schlüssel dieses Nutzerwegs heissen `ux26.<name>`.
//
// ZUM WORT „EVIDENCE" IN DEN DEUTSCHEN UND NIEDERLÄNDISCHEN WERTEN: das ist kein Versehen und auch
// keine offene Aufgabe dieses Auftrags. JOB 3384 hat die Schlüssel, die Abschnitt 9 wirklich
// zeichnet, auf „Beleg" gezogen und dabei ausdrücklich festgehalten, dass `ko.evCons.allOk`
// unverändert bleibt. Dieser Auftrag verschiebt Texte, er ändert keinen einzigen — ein stilles
// Nachbessern beim Umzug wäre genau die Sorte Änderung, die niemand bemerkt und niemand geprüft hat.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ux26.",
  legacySchluessel: [
    "ko.evCons.allOk",
    "ko.evFresh.missing",
    "ko.evFresh.neutral",
    "ko.evidenceOriginalDetached",
  ],
  de: {
    // JOB 3272 · UX-25: der ehrliche Satz, wenn das Original nicht mehr an diesem Objekt hängt
    // (dann steht dort KEIN Knopf, der ins Leere führte).
    "ko.evidenceOriginalDetached": "Original nicht mehr an diesem Objekt",
    "ko.evCons.allOk": "Quellen, Anhänge und Evidence sind deckungsgleich.",
    "ko.evFresh.missing": "Evidence fehlt",
    "ko.evFresh.neutral": "kein Evidence-Anlass",
  },
  en: {
    "ko.evidenceOriginalDetached": "Original no longer attached to this object",
    "ko.evCons.allOk": "Sources, attachments and evidence are aligned.",
    "ko.evFresh.missing": "evidence missing",
    "ko.evFresh.neutral": "no evidence expected",
  },
  nl: {
    "ko.evidenceOriginalDetached": "Origineel hangt niet meer aan dit object",
    "ko.evCons.allOk": "Bronnen, bijlagen en evidence komen volledig overeen.",
    "ko.evFresh.missing": "Evidence ontbreekt",
    "ko.evFresh.neutral": "geen aanleiding voor evidence",
  },
} satisfies Textmodul;
