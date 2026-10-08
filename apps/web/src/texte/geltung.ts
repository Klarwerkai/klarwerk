// ================================================================================================
// R-1632 / R-1633 (aufnahme:20260922:gesamt-standortwissen) · STANDORT- UND SCHICHTGELTUNG.
// ================================================================================================
//
// Die Texte des Geltungsfelds am Wissensobjekt (Konzern-Standard / Werks-Praxis /
// Schicht-spezifisch, optional Rolle) und der Angabe „Ich frage für" auf der Fragen-Seite samt der
// Auskunft, wofür gewichtet wurde. Regel und Vererbung: services/knowledge-object/src/geltung.ts.
//
// `audit.action.ko_geltung_changed` ist ein Altname-Muster (`lib/auditAction.ts` leitet ihn aus dem
// Protokollvorgang `ko.geltung-changed` ab) und steht deshalb in `legacySchluessel`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "geltung.",
  legacySchluessel: ["audit.action.ko_geltung_changed"],
  de: {
    "audit.action.ko_geltung_changed": "Geltung geändert",
    "geltung.titel": "Geltung",
    "geltung.erklaerung":
      "Ein Konzern-Standard gilt in jedem Werk. Eine Werks-Praxis gilt in diesem Werk und allen seinen Schichten. Schicht-spezifisches Wissen gilt nur in dieser Schicht.",
    "geltung.keine": "Keine Geltung angegeben",
    "geltung.ebene.konzern": "Konzern-Standard",
    "geltung.ebene.werk": "Werks-Praxis",
    "geltung.ebene.schicht": "Schicht-spezifisch",
    "geltung.feld.ebene": "Gilt als",
    "geltung.feld.ohne": "Keine Angabe",
    "geltung.feld.werk": "Werk",
    "geltung.feld.schicht": "Schicht",
    "geltung.feld.rolle": "Rolle (optional)",
    "geltung.speichern": "Geltung speichern",
    "geltung.unvollstaendig": "Bitte {{feld}} angeben.",
    "geltung.frage.titel": "Ich frage für",
    "geltung.frage.leer": "keine Angabe",
    "geltung.frage.hinweis":
      "Unter gleich passenden Quellen stehen die aus Ihrer Schicht und Ihrem Werk vorn. Quellen von anderswo bleiben sichtbar.",
    "geltung.frage.leeren": "Angaben leeren",
    "geltung.frage.gewichtet": "Gewichtet für: {{kontext}}",
    "geltung.frage.quellen": "Geltung der herangezogenen Quellen",
    "geltung.passung.eigene_schicht": "Ihre Schicht",
    "geltung.passung.eigenes_werk": "Ihr Werk",
    "geltung.passung.konzern": "Konzernweit",
    "geltung.passung.unbestimmt": "Nicht zuzuordnen",
    "geltung.passung.andere": "Gilt anderswo",
  },
  en: {
    "audit.action.ko_geltung_changed": "Scope changed",
    "geltung.titel": "Scope",
    "geltung.erklaerung":
      "A group standard applies in every plant. A plant practice applies in that plant and all its shifts. Shift-specific knowledge applies only in that shift.",
    "geltung.keine": "No scope given",
    "geltung.ebene.konzern": "Group standard",
    "geltung.ebene.werk": "Plant practice",
    "geltung.ebene.schicht": "Shift-specific",
    "geltung.feld.ebene": "Applies as",
    "geltung.feld.ohne": "Not specified",
    "geltung.feld.werk": "Plant",
    "geltung.feld.schicht": "Shift",
    "geltung.feld.rolle": "Role (optional)",
    "geltung.speichern": "Save scope",
    "geltung.unvollstaendig": "Please enter {{feld}}.",
    "geltung.frage.titel": "I am asking for",
    "geltung.frage.leer": "not specified",
    "geltung.frage.hinweis":
      "Among equally fitting sources, those from your shift and plant come first. Sources from elsewhere stay visible.",
    "geltung.frage.leeren": "Clear",
    "geltung.frage.gewichtet": "Weighted for: {{kontext}}",
    "geltung.frage.quellen": "Scope of the sources consulted",
    "geltung.passung.eigene_schicht": "Your shift",
    "geltung.passung.eigenes_werk": "Your plant",
    "geltung.passung.konzern": "Group-wide",
    "geltung.passung.unbestimmt": "Cannot be matched",
    "geltung.passung.andere": "Applies elsewhere",
  },
  nl: {
    "audit.action.ko_geltung_changed": "Geldigheid gewijzigd",
    "geltung.titel": "Geldigheid",
    "geltung.erklaerung":
      "Een concernstandaard geldt in elke vestiging. Een vestigingspraktijk geldt in die vestiging en al haar ploegen. Ploegspecifieke kennis geldt alleen in die ploeg.",
    "geltung.keine": "Geen geldigheid opgegeven",
    "geltung.ebene.konzern": "Concernstandaard",
    "geltung.ebene.werk": "Vestigingspraktijk",
    "geltung.ebene.schicht": "Ploegspecifiek",
    "geltung.feld.ebene": "Geldt als",
    "geltung.feld.ohne": "Geen opgave",
    "geltung.feld.werk": "Vestiging",
    "geltung.feld.schicht": "Ploeg",
    "geltung.feld.rolle": "Rol (optioneel)",
    "geltung.speichern": "Geldigheid opslaan",
    "geltung.unvollstaendig": "Vul {{feld}} in.",
    "geltung.frage.titel": "Ik vraag voor",
    "geltung.frage.leer": "geen opgave",
    "geltung.frage.hinweis":
      "Bij even passende bronnen staan die uit uw ploeg en vestiging vooraan. Bronnen van elders blijven zichtbaar.",
    "geltung.frage.leeren": "Wissen",
    "geltung.frage.gewichtet": "Gewogen voor: {{kontext}}",
    "geltung.frage.quellen": "Geldigheid van de gebruikte bronnen",
    "geltung.passung.eigene_schicht": "Uw ploeg",
    "geltung.passung.eigenes_werk": "Uw vestiging",
    "geltung.passung.konzern": "Concernbreed",
    "geltung.passung.unbestimmt": "Niet toe te wijzen",
    "geltung.passung.andere": "Geldt elders",
  },
} satisfies Textmodul;
