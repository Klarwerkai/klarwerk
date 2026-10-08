// ================================================================================================
// R-1657 (aufnahme:20260922:gesamt-wissenssprints) — WISSENS-SPRINTS JE BEREICH IN DER
// EMPFEHLUNGSKARTE DER KAPITAL-SICHT (components/WissensSprints.tsx).
// ================================================================================================
//
// Ein eigenes Textmodul statt neuer Einträge in `woerterbuch/{de,en,nl}.ts`: diese drei Dateien
// sind seit der Aufteilung Byte für Byte an `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`
// gebunden; neue Texte gehören hierher. Die Schwellen im Einleitungssatz (50, 3) sind dieselben wie
// in services/management/src/metrics.ts (TRUST_NIEDRIG, WENIG_VALIDIERT).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissenssprints.",
  legacySchluessel: [],
  de: {
    "wissenssprints.titel": "Wissens-Sprints",
    "wissenssprints.einleitung":
      "Bei jedem Aufruf prüft KLARWERK je Bereich offene Konflikte, fällige Re-Validierungen, geringes Vertrauen (unter 50) und wenig validiertes Wissen (unter 3 Objekten). Es sind Vorschläge — angelegt wird nichts.",
    "wissenssprints.leer": "Kein Bereich braucht derzeit einen Wissens-Sprint.",
    "wissenssprints.bereich": "Bereich {{bereich}}:",
    "wissenssprints.grund.conflicts_one": "{{count}} Objekt in offenen Konflikten",
    "wissenssprints.grund.conflicts_other": "{{count}} Objekte in offenen Konflikten",
    "wissenssprints.grund.revalidation_one": "{{count}} Objekt zur Re-Validierung",
    "wissenssprints.grund.revalidation_other": "{{count}} Objekte zur Re-Validierung",
    "wissenssprints.grund.lowTrust_one": "{{count}} Objekt mit geringem Vertrauen",
    "wissenssprints.grund.lowTrust_other": "{{count}} Objekte mit geringem Vertrauen",
    "wissenssprints.grund.thinKnowledge_one": "nur {{count}} validiertes Objekt",
    "wissenssprints.grund.thinKnowledge_other": "nur {{count}} validierte Objekte",
    "wissenssprints.vorschlag_one": "{{count}}-Tages-Sprint vorschlagen?",
    "wissenssprints.vorschlag_other": "{{count}}-Tage-Sprint vorschlagen?",
  },
  en: {
    "wissenssprints.titel": "Knowledge sprints",
    "wissenssprints.einleitung":
      "On every visit KLARWERK checks each area for open conflicts, due re-validations, low trust (below 50) and little validated knowledge (fewer than 3 objects). These are suggestions — nothing is created.",
    "wissenssprints.leer": "No area needs a knowledge sprint right now.",
    "wissenssprints.bereich": "Area {{bereich}}:",
    "wissenssprints.grund.conflicts_one": "{{count}} object in open conflicts",
    "wissenssprints.grund.conflicts_other": "{{count}} objects in open conflicts",
    "wissenssprints.grund.revalidation_one": "{{count}} object to re-validate",
    "wissenssprints.grund.revalidation_other": "{{count}} objects to re-validate",
    "wissenssprints.grund.lowTrust_one": "{{count}} object with low trust",
    "wissenssprints.grund.lowTrust_other": "{{count}} objects with low trust",
    "wissenssprints.grund.thinKnowledge_one": "only {{count}} validated object",
    "wissenssprints.grund.thinKnowledge_other": "only {{count}} validated objects",
    "wissenssprints.vorschlag_one": "Suggest a {{count}}-day sprint?",
    "wissenssprints.vorschlag_other": "Suggest a {{count}}-day sprint?",
  },
  nl: {
    "wissenssprints.titel": "Kennissprints",
    "wissenssprints.einleitung":
      "Bij elk bezoek controleert KLARWERK per gebied open conflicten, vervallen hervalidaties, laag vertrouwen (onder 50) en weinig gevalideerde kennis (minder dan 3 objecten). Het zijn voorstellen — er wordt niets aangemaakt.",
    "wissenssprints.leer": "Geen enkel gebied heeft nu een kennissprint nodig.",
    "wissenssprints.bereich": "Gebied {{bereich}}:",
    "wissenssprints.grund.conflicts_one": "{{count}} object in open conflicten",
    "wissenssprints.grund.conflicts_other": "{{count}} objecten in open conflicten",
    "wissenssprints.grund.revalidation_one": "{{count}} object om te hervalideren",
    "wissenssprints.grund.revalidation_other": "{{count}} objecten om te hervalideren",
    "wissenssprints.grund.lowTrust_one": "{{count}} object met laag vertrouwen",
    "wissenssprints.grund.lowTrust_other": "{{count}} objecten met laag vertrouwen",
    "wissenssprints.grund.thinKnowledge_one": "slechts {{count}} gevalideerd object",
    "wissenssprints.grund.thinKnowledge_other": "slechts {{count}} gevalideerde objecten",
    "wissenssprints.vorschlag_one": "Sprint van {{count}} dag voorstellen?",
    "wissenssprints.vorschlag_other": "Sprint van {{count}} dagen voorstellen?",
  },
} satisfies Textmodul;
