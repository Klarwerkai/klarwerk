// ================================================================================================
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — die Texte der Wissensvorschau beim Erfassen.
// ================================================================================================
//
// Die Live-Prüfung beim Erfassen vergleicht den Entwurf nur mit einer begrenzten Vorauswahl des
// Bestands (services/app/src/knowledge-check.ts, `KnowledgeCheckCoverage`). Diese Texte nennen sie
// deshalb „Vorschau" und sagen nur, was die Antwort belegt: wie viele Einträge verglichen wurden,
// ob die Grenze erreicht war — oder dass der Umfang unbekannt ist. Eine erreichte Grenze belegt
// NICHT, dass es weitere passende Einträge gibt (bei genau 40 Einträgen im Bestand gibt es keine);
// die Texte nennen das deshalb als offene Frage, nie als Tatsache (Ben, Runde 1, Befund B1).
// Eine bestandweite Aussage wie „Das ist neu" oder „dazu gibt es noch nichts" steht hier bewusst
// nirgends.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "vorschau.",
  legacySchluessel: [],
  de: {
    "vorschau.name": "Vorschau",
    "vorschau.laeuft": "Vorschau läuft: Vergleich mit vorausgewählten Einträgen …",
    "vorschau.keinTreffer": "kein Treffer",
    "vorschau.umfang_one": "{{count}} Eintrag verglichen",
    "vorschau.umfang_other": "{{count}} Einträge verglichen",
    "vorschau.umfangGrenze_one": "{{count}} Eintrag verglichen, Grenze erreicht",
    "vorschau.umfangGrenze_other": "{{count}} Einträge verglichen, Grenze erreicht",
    "vorschau.umfangUnbekannt": "Umfang unbekannt",
    "vorschau.erklaerung_one":
      "Vorschau ohne Treffer: verglichen wurde {{count}} vorausgewählter Eintrag. Das ist kein Abgleich mit dem gesamten Wissensbestand.",
    "vorschau.erklaerung_other":
      "Vorschau ohne Treffer: verglichen wurden {{count}} vorausgewählte Einträge. Das ist kein Abgleich mit dem gesamten Wissensbestand.",
    "vorschau.erklaerungGrenze_one":
      "Vorschau ohne Treffer: verglichen wurde {{count}} vorausgewählter Eintrag. Die Auswahlgrenze von {{limit}} war erreicht — ob es darüber hinaus passende Einträge gibt, hat diese Vorschau nicht geprüft.",
    "vorschau.erklaerungGrenze_other":
      "Vorschau ohne Treffer: verglichen wurden {{count}} vorausgewählte Einträge. Die Auswahlgrenze von {{limit}} war erreicht — ob es darüber hinaus passende Einträge gibt, hat diese Vorschau nicht geprüft.",
    "vorschau.erklaerungUnbekannt":
      "Vorschau ohne Treffer. Wie viele Einträge verglichen wurden, ist nicht bekannt — das ist kein Abgleich mit dem gesamten Wissensbestand.",
    "vorschau.ohneTreffer": "Vorschau ohne ähnlichen Treffer ({{umfang}}).",
  },
  en: {
    "vorschau.name": "Preview",
    "vorschau.laeuft": "Preview running: comparing with preselected entries …",
    "vorschau.keinTreffer": "no match",
    "vorschau.umfang_one": "{{count}} entry compared",
    "vorschau.umfang_other": "{{count}} entries compared",
    "vorschau.umfangGrenze_one": "{{count}} entry compared, limit reached",
    "vorschau.umfangGrenze_other": "{{count}} entries compared, limit reached",
    "vorschau.umfangUnbekannt": "scope unknown",
    "vorschau.erklaerung_one":
      "Preview without a match: {{count}} preselected entry was compared. This is not a comparison with the entire knowledge base.",
    "vorschau.erklaerung_other":
      "Preview without a match: {{count}} preselected entries were compared. This is not a comparison with the entire knowledge base.",
    "vorschau.erklaerungGrenze_one":
      "Preview without a match: {{count}} preselected entry was compared. The selection limit of {{limit}} was reached — whether further matching entries exist was not checked by this preview.",
    "vorschau.erklaerungGrenze_other":
      "Preview without a match: {{count}} preselected entries were compared. The selection limit of {{limit}} was reached — whether further matching entries exist was not checked by this preview.",
    "vorschau.erklaerungUnbekannt":
      "Preview without a match. How many entries were compared is not known — this is not a comparison with the entire knowledge base.",
    "vorschau.ohneTreffer": "Preview without a similar match ({{umfang}}).",
  },
  nl: {
    "vorschau.name": "Voorbeeld",
    "vorschau.laeuft": "Voorbeeld loopt: vergelijken met voorgeselecteerde items …",
    "vorschau.keinTreffer": "geen treffer",
    "vorschau.umfang_one": "{{count}} item vergeleken",
    "vorschau.umfang_other": "{{count}} items vergeleken",
    "vorschau.umfangGrenze_one": "{{count}} item vergeleken, grens bereikt",
    "vorschau.umfangGrenze_other": "{{count}} items vergeleken, grens bereikt",
    "vorschau.umfangUnbekannt": "omvang onbekend",
    "vorschau.erklaerung_one":
      "Voorbeeld zonder treffer: {{count}} voorgeselecteerd item is vergeleken. Dit is geen vergelijking met de volledige kennisbank.",
    "vorschau.erklaerung_other":
      "Voorbeeld zonder treffer: {{count}} voorgeselecteerde items zijn vergeleken. Dit is geen vergelijking met de volledige kennisbank.",
    "vorschau.erklaerungGrenze_one":
      "Voorbeeld zonder treffer: {{count}} voorgeselecteerd item is vergeleken. De selectiegrens van {{limit}} was bereikt — of er daarbuiten passende items zijn, heeft dit voorbeeld niet gecontroleerd.",
    "vorschau.erklaerungGrenze_other":
      "Voorbeeld zonder treffer: {{count}} voorgeselecteerde items zijn vergeleken. De selectiegrens van {{limit}} was bereikt — of er daarbuiten passende items zijn, heeft dit voorbeeld niet gecontroleerd.",
    "vorschau.erklaerungUnbekannt":
      "Voorbeeld zonder treffer. Hoeveel items zijn vergeleken, is niet bekend — dit is geen vergelijking met de volledige kennisbank.",
    "vorschau.ohneTreffer": "Voorbeeld zonder vergelijkbare treffer ({{umfang}}).",
  },
} satisfies Textmodul;
