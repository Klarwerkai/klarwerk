// ================================================================================================
// R-1169 / R-0983 · BESCHRIFTUNGEN, DIE BISHER HART IM CODE STANDEN.
// ================================================================================================
//
// Der Wächter gegen hart codierte Anzeigetexte (`apps/web/src/texte/intern/hartkodiert.ts`) hat
// bei seiner Einführung genau diese Stellen gefunden: sie standen nur auf Deutsch im TSX und fielen
// in der englischen und niederländischen Oberfläche nicht um, sondern blieben deutsch.
//
//   · `components/RichTextEditor.tsx` — die Beschriftung der Bildgrößen-Leiste („Bildgröße")
//   · `shell/ZahnradMenue.tsx`        — der Titel an der Versionsnummer
//   · `pages/UiKit.tsx`               — Überschriften des Schaufensters unter /ui-kit (dort auch
//                                       das Fachwort „Reasoner-Entwurf", R-0908)
//
// Der deutsche Wortlaut von „Bildgröße" bleibt zeichengleich: die Chromium-Messung
// `tests/bildgroesse/griff-speichern-wiederoeffnen-pg.integration.test.ts` sucht die Leiste über
// genau diese Beschriftung.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "beschriftung.",
  legacySchluessel: [],
  de: {
    "beschriftung.editor.bildgroesse": "Bildgröße",
    "beschriftung.zahnrad.version": "App-Version (Beta-Phase)",
    "beschriftung.uikit.titel": "Vertrauens-System · UI-Kit",
    "beschriftung.uikit.status": "Statusanzeigen",
    "beschriftung.uikit.konfidenz": "Konfidenz / Reifegrad",
    "beschriftung.uikit.wissensarten": "Wissensarten",
    "beschriftung.uikit.kiKennung": "KI-Kennung (KI-Entwurf)",
    "beschriftung.uikit.herkunft": "Herkunftszeile",
  },
  en: {
    "beschriftung.editor.bildgroesse": "Image size",
    "beschriftung.zahnrad.version": "App version (beta phase)",
    "beschriftung.uikit.titel": "Trust system · UI kit",
    "beschriftung.uikit.status": "Status labels",
    "beschriftung.uikit.konfidenz": "Confidence / maturity",
    "beschriftung.uikit.wissensarten": "Knowledge types",
    "beschriftung.uikit.kiKennung": "AI marker (AI draft)",
    "beschriftung.uikit.herkunft": "Provenance line",
  },
  nl: {
    "beschriftung.editor.bildgroesse": "Afbeeldingsgrootte",
    "beschriftung.zahnrad.version": "App-versie (bètafase)",
    "beschriftung.uikit.titel": "Vertrouwenssysteem · UI-kit",
    "beschriftung.uikit.status": "Statuslabels",
    "beschriftung.uikit.konfidenz": "Betrouwbaarheid / rijpheid",
    "beschriftung.uikit.wissensarten": "Kennissoorten",
    "beschriftung.uikit.kiKennung": "AI-markering (AI-concept)",
    "beschriftung.uikit.herkunft": "Herkomstregel",
  },
} satisfies Textmodul;
