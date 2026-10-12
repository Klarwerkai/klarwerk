// ================================================================================================
// R-0908 · DER HINWEIS ZUR WEB-SUCHE IN DER KOPFZEILE — OHNE DAS FACHWORT „REASONER".
// ================================================================================================
//
// Die Pille „Web-Suche: …" steht für jede Rolle in der Kopfzeile (`shell/StatusZeilen.tsx`), ihr
// Hinweis kam bisher aus `topbar.external.hint` und endete auf „…, nicht den Reasoner." — das
// Fachwort, das AUFTRAG-mega51 BLOCK G1 an allen anderen Stellen der Kopfzeile bereits durch
// „KI-Modell" ersetzt hat. Der neue Satz sagt, was die Stufe wirklich steuert, und verspricht nichts
// darüber hinaus (R-0981): sie schaltet weder ein KI-Modell ein noch wählt sie eines aus.
//
// WARUM EIN NEUER SCHLÜSSEL STATT EINER ÄNDERUNG AN ORT UND STELLE: der alte Wert steht unverändert
// im Grundbestand (`woerterbuch/`), weil Umzugsnachweis und Byte-Abgleich ihn dort festhalten
// (`tests/i18n-textmodule/bestand-unveraendert.test.ts`,
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Gelesen wird er von keiner Fläche
// mehr; den neuen Schlüssel und das Fehlen des Fachworts hält
// `tests/sprache-begriffe/fachbegriffe-k1.test.ts` fest.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "websuche.",
  legacySchluessel: [],
  de: {
    "websuche.hinweis":
      "Externe Wissensabfrage (Web-Suche) — eine EIGENE Achse, nicht das KI-Modell. Steuert nur die Web-Suche/öffentliche Anreicherung — nicht, ob und welches KI-Modell antwortet.",
  },
  en: {
    "websuche.hinweis":
      "External knowledge lookup (web search) — a SEPARATE axis, not the AI model. It only controls web search / public enrichment — not whether or which AI model answers.",
  },
  nl: {
    "websuche.hinweis":
      "Externe kennisopvraging (webzoekopdracht) — een APARTE as, niet het AI-model. Regelt alleen webzoeken/openbare verrijking — niet of en welk AI-model antwoordt.",
  },
} satisfies Textmodul;
