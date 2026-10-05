// ================================================================================================
// UX26 · DIE TEXTE DER HERKUNFTS- UND BELEGANZEIGE — bei ihrer Funktion, nicht im Sammelbuch.
// ================================================================================================
//
// WAS HIER STEHT UND WARUM GERADE DAS: die vier Schlüssel, die der Vertrag UX26 ändert. Sie sind
// mit JOB 4367 aus `apps/web/src/i18n.ts` hierher umgezogen — wörtlich, in allen drei Sprachen.
//
// ES SIND ALTNAMEN und stehen deshalb in `legacySchluessel` — die Begründung steht in `ux08.ts`
// und gilt hier unverändert. Neue Schlüssel dieses Nutzerwegs heissen `ux26.<name>`.
//
// DIE UX-26-TEILLIEFERUNG „BELEG UND ORIGINAL" (arbeit:ux26-beleg-original-20260921) ändert GENAU
// DREI WERTE, und zwar nur ihre Aussage, keinen Schlüssel:
//
//   · `ko.evidenceOriginalDetached` — der Satz an einer Belegkarte, deren Originaldatei nicht mehr
//     am Objekt hängt. Er nennt jetzt BEIDE Tatsachen: der Beleg (der Datensatz) bleibt verzeichnet,
//     die Originaldatei ist weg. Vorher sagte er nur „Original nicht mehr an diesem Objekt" und liess
//     offen, ob der Beleg darunter noch zählt. Gezeichnet in `MehrAbschnitte.tsx` (Abschnitt 9).
//   · `ko.evFresh.missing` / `ko.evFresh.neutral` — die Frischezustände, die
//     `evidenceFreshnessLabelKey` für die Bibliothek (Abschnitt 9) UND die Prüfkarte
//     „Belegaktualität" (`Stufe2.tsx`) liefert. Deutsch und Niederländisch tragen dort kein
//     „Evidence" mehr. „Beleg fehlt" behauptet KEINE fehlende Datei: der Zustand heisst nur, dass
//     zu Quelle oder Anhang kein Belegdatensatz verzeichnet ist (`evidenceFreshness.ts`).
//     Englisch behält sein normales Wort „evidence" und damit seine Werte.
//
// RUNDE 2 (Ben, K3): DIE PRÜFKARTE ZEIGT „KEIN BELEGANLASS" NICHT ALS ZEILE, sondern nur im Zähler
// `evFresh.summary.neutral` (`Stufe2.tsx:2207`) — und der sagte bloss „neutral: n". `Stufe2.tsx`
// ist nicht Teil des Auftrags. Der Zähler zieht deshalb hierher um und VERSCHACHTELT den Wortlaut
// des Zustands: `$t(ko.evFresh.neutral)` ist genau der Schlüssel, den `evidenceFreshnessLabelKey
// ("neutral")` liefert. Bibliothek Abschnitt 9 und Prüfkarte sprechen damit aus EINER Quelle, und
// der Zähler kann nicht mehr still vom Zustandswort abweichen. Der Schlüssel bleibt derselbe; die
// Schlüsselmenge des Katalogs ändert sich nicht.
//
// `ko.evCons.allOk` BLEIBT UNVERÄNDERT: JOB 3384 hat das ausdrücklich festgehalten, keine Fläche
// zeichnet den Schlüssel heute, und diese Teillieferung hat ihn nicht bestellt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "ux26.",
  legacySchluessel: [
    "ko.evCons.allOk",
    "ko.evFresh.missing",
    "ko.evFresh.neutral",
    "ko.evidenceOriginalDetached",
    "evFresh.summary.neutral",
  ],
  de: {
    // JOB 3272 · UX-25: der ehrliche Satz, wenn das Original nicht mehr an diesem Objekt hängt
    // (dann steht dort KEIN Knopf, der ins Leere führte).
    "ko.evidenceOriginalDetached":
      "Der Beleg bleibt verzeichnet, aber die Originaldatei hängt nicht mehr an diesem Objekt.",
    "ko.evCons.allOk": "Quellen, Anhänge und Evidence sind deckungsgleich.",
    "ko.evFresh.missing": "Beleg fehlt",
    "ko.evFresh.neutral": "kein Beleganlass",
    "evFresh.summary.neutral": "$t(ko.evFresh.neutral): {{n}}",
  },
  en: {
    "ko.evidenceOriginalDetached":
      "The evidence record remains, but the original file is no longer attached to this object.",
    "ko.evCons.allOk": "Sources, attachments and evidence are aligned.",
    "ko.evFresh.missing": "evidence missing",
    "ko.evFresh.neutral": "no evidence expected",
    "evFresh.summary.neutral": "$t(ko.evFresh.neutral): {{n}}",
  },
  nl: {
    "ko.evidenceOriginalDetached":
      "Het bewijs blijft vastgelegd, maar het originele bestand hangt niet meer aan dit object.",
    "ko.evCons.allOk": "Bronnen, bijlagen en evidence komen volledig overeen.",
    "ko.evFresh.missing": "Bewijs ontbreekt",
    "ko.evFresh.neutral": "geen aanleiding voor bewijs",
    "evFresh.summary.neutral": "$t(ko.evFresh.neutral): {{n}}",
  },
} satisfies Textmodul;
