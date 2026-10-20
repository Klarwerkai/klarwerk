import { ARBEITEN } from "./arbeiten";
import { LESEN } from "./lesen";
import { VERWALTUNG } from "./verwaltung";
import { WEITERE } from "./weitere";
export const SEITEN = [...LESEN, ...ARBEITEN, ...VERWALTUNG, ...WEITERE] as const;
/** Erhaltene Spezialwege: sie führen bereits selbst durch ihren jeweiligen Vorgang. */
export const SPEZIALWEGE = {
  "/fragen": "FRAGEN_LEKTION bleibt unverändert in derselben Engine",
  "/klara-vorschau": "Vorhandene interaktive Klara-Vorschau mit eigener Begleitung",
  "/klara-vorschau/artikel/:id": "Vorhandener fiktiver Artikel der Klara-Vorschau",
  "/begleiter": "Native Figur: vorhandene Bedienhilfe im Gespräch, keine Webhülle an der Figur",
  "/begleitung/pruefformular": "Synthetischer Begleitprüfweg, keine produktive Fachseite",
  "/ui-kit": "Entwicklungsansicht, keine produktive Fachseite",
} as const;
