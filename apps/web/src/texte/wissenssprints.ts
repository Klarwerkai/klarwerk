// ================================================================================================
// R-1657 (aufnahme:20260922:gesamt-wissenssprints) — WISSENS-SPRINTS JE BEREICH IN DER
// EMPFEHLUNGSKARTE DER KAPITAL-SICHT (components/WissensSprints.tsx).
// ================================================================================================
//
// Ein eigenes Textmodul statt neuer Einträge in `woerterbuch/{de,en,nl}.ts`: diese drei Dateien
// sind seit der Aufteilung Byte für Byte an `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`
// gebunden; neue Texte gehören hierher. Die Schwellen im Einleitungssatz (50, 3) sind dieselben wie
// in services/management/src/metrics.ts (TRUST_NIEDRIG, WENIG_VALIDIERT).
//
// `mrun.task.gaps` ist die Beschriftung der neuen Laufart `gaps` im KI-Laufprotokoll. Ihr Name ist
// durch die Bestandsstelle in pages/Stufe2.tsx (Schlüssel „mrun.task.<Laufart>“) vorgegeben und kann das
// Präfix dieses Moduls nicht tragen — deshalb steht er ausdrücklich in `legacySchluessel`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissenssprints.",
  legacySchluessel: ["mrun.task.gaps"],
  de: {
    "mrun.task.gaps": "Lückenerkennung",
    "wissenssprints.titel": "Wissens-Sprints",
    "wissenssprints.einleitung":
      "KLARWERK lässt den Reasoner regelmäßig je Bereich offene Konflikte, fällige Re-Validierungen, geringes Vertrauen und wenig validiertes Wissen bewerten — über die Kennzahlen dessen, was du sehen darfst. Fehlt ein Urteil, gilt die benannte Regel (Vertrauen unter 50, unter 3 validierte Objekte). Es sind Vorschläge — angelegt wird nichts.",
    "wissenssprints.quelle.reasoner": "Reasoner",
    "wissenssprints.quelle.rule": "Regel",
    "wissenssprints.analyse.reasoner": "Bewertet vom Reasoner ({{anbieter}}), zuletzt {{zeit}}.",
    "wissenssprints.analyse.geprueft": "Zuletzt geprüft {{zeit}}.",
    "wissenssprints.analyse.ohneUrteil":
      "Kein Reasoner-Urteil: {{grund}}. Es gilt die benannte Regel.",
    "wissenssprints.analyse.ausstehend":
      "Die Reasoner-Analyse für deine Sicht steht noch aus — bis dahin gilt die benannte Regel.",
    "wissenssprints.analyse.aus":
      "Die regelmäßige Reasoner-Analyse läuft in dieser Instanz nicht — es gilt die benannte Regel.",
    "wissenssprints.ursache.no-model": "kein KI-Modell eingerichtet",
    "wissenssprints.ursache.confidential":
      "vertrauliche Bereiche dürfen nicht an die eingerichtete KI",
    "wissenssprints.ursache.model-timeout": "die KI hat nicht rechtzeitig geantwortet",
    "wissenssprints.ursache.model-error": "die KI-Antwort war nicht verwertbar",
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
    "mrun.task.gaps": "Gap detection",
    "wissenssprints.titel": "Knowledge sprints",
    "wissenssprints.einleitung":
      "KLARWERK regularly has the reasoner assess open conflicts, due re-validations, low trust and little validated knowledge per area — from the figures of what you may see. Without a verdict the named rule applies (trust below 50, fewer than 3 validated objects). These are suggestions — nothing is created.",
    "wissenssprints.quelle.reasoner": "Reasoner",
    "wissenssprints.quelle.rule": "Rule",
    "wissenssprints.analyse.reasoner": "Assessed by the reasoner ({{anbieter}}), last at {{zeit}}.",
    "wissenssprints.analyse.geprueft": "Last checked at {{zeit}}.",
    "wissenssprints.analyse.ohneUrteil": "No reasoner verdict: {{grund}}. The named rule applies.",
    "wissenssprints.analyse.ausstehend":
      "The reasoner analysis for your view is still pending — until then the named rule applies.",
    "wissenssprints.analyse.aus":
      "The regular reasoner analysis is not running in this instance — the named rule applies.",
    "wissenssprints.ursache.no-model": "no AI model set up",
    "wissenssprints.ursache.confidential": "confidential areas may not go to the configured AI",
    "wissenssprints.ursache.model-timeout": "the AI did not answer in time",
    "wissenssprints.ursache.model-error": "the AI answer was not usable",
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
    "mrun.task.gaps": "Hiaatdetectie",
    "wissenssprints.titel": "Kennissprints",
    "wissenssprints.einleitung":
      "KLARWERK laat de reasoner regelmatig per gebied open conflicten, vervallen hervalidaties, laag vertrouwen en weinig gevalideerde kennis beoordelen — op basis van de kengetallen van wat jij mag zien. Zonder oordeel geldt de benoemde regel (vertrouwen onder 50, minder dan 3 gevalideerde objecten). Het zijn voorstellen — er wordt niets aangemaakt.",
    "wissenssprints.quelle.reasoner": "Reasoner",
    "wissenssprints.quelle.rule": "Regel",
    "wissenssprints.analyse.reasoner":
      "Beoordeeld door de reasoner ({{anbieter}}), laatst op {{zeit}}.",
    "wissenssprints.analyse.geprueft": "Laatst gecontroleerd op {{zeit}}.",
    "wissenssprints.analyse.ohneUrteil":
      "Geen oordeel van de reasoner: {{grund}}. De benoemde regel geldt.",
    "wissenssprints.analyse.ausstehend":
      "De reasoner-analyse voor jouw weergave staat nog uit — tot dan geldt de benoemde regel.",
    "wissenssprints.analyse.aus":
      "De regelmatige reasoner-analyse draait in deze instantie niet — de benoemde regel geldt.",
    "wissenssprints.ursache.no-model": "geen AI-model ingericht",
    "wissenssprints.ursache.confidential":
      "vertrouwelijke gebieden mogen niet naar de ingerichte AI",
    "wissenssprints.ursache.model-timeout": "de AI heeft niet op tijd geantwoord",
    "wissenssprints.ursache.model-error": "het AI-antwoord was niet bruikbaar",
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
