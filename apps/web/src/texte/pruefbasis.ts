// ================================================================================================
// AUFNAHME 20260922 · PRÜFBASIS-AKTUALITÄT — die Texte des überholten Prüfnachweises.
// ================================================================================================
//
// Ein abgeschlossener KI-Prüfnachweis ist an die Basis gebunden, unter der er lief (Inhaltsfassung,
// Quellen, Anhänge, Einordnung, Vertraulichkeit — services/knowledge-object/src/pruefbasis.ts).
// Hat sich die Basis seither geändert, sagt die Oberfläche das mit diesen Texten, statt den alten
// Nachweis als aktuell zu zeigen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "pruefbasis.",
  legacySchluessel: [],
  de: {
    "pruefbasis.ueberholt": "Prüfung überholt",
    "pruefbasis.ueberholtHinweis":
      "Inhalt, Quellen, Einordnung oder Vertraulichkeit haben sich seit dieser Prüfung geändert. Ihr Ergebnis gilt für den früheren Stand — eine neue Prüfung ist nötig.",
  },
  en: {
    "pruefbasis.ueberholt": "Check outdated",
    "pruefbasis.ueberholtHinweis":
      "Content, sources, classification or confidentiality have changed since this check. Its result applies to the earlier state — a new check is needed.",
  },
  nl: {
    "pruefbasis.ueberholt": "Controle verouderd",
    "pruefbasis.ueberholtHinweis":
      "Inhoud, bronnen, indeling of vertrouwelijkheid zijn sinds deze controle gewijzigd. Het resultaat geldt voor de eerdere stand — een nieuwe controle is nodig.",
  },
} satisfies Textmodul;
