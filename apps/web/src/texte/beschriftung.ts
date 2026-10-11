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
// Mit dem strukturellen Wächter (Nacharbeit 4) kamen dazu: die Bildgrößen-Stufen im Editor (eine
// Datenliste mit „Klein" … „Volle Breite"), „OK"/„FAIL" der KI-Selbsttests (`AdminKiDetails.tsx`)
// „Stufe 2"/Vorlagenzeile der Platzhalterseite (`PlaceholderPage.tsx`) und die Ansage des
// Logo-Links (`shell/Logo.tsx`, deutscher Wortlaut zeichengleich).
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
    "beschriftung.editor.stufe.klein": "Klein",
    "beschriftung.editor.stufe.mittel": "Mittel",
    "beschriftung.editor.stufe.gross": "Groß",
    "beschriftung.editor.stufe.voll": "Volle Breite",
    "beschriftung.selbsttest.ok": "Bestanden",
    "beschriftung.selbsttest.fehler": "Fehlgeschlagen",
    "beschriftung.platzhalter.vorlage": "Gestaltungsvorlage: §{{abschnitt}} · {{bild}}",
    "beschriftung.logo.start": "Klarwerk - zur Startseite",
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
    "beschriftung.editor.stufe.klein": "Small",
    "beschriftung.editor.stufe.mittel": "Medium",
    "beschriftung.editor.stufe.gross": "Large",
    "beschriftung.editor.stufe.voll": "Full width",
    "beschriftung.selbsttest.ok": "Passed",
    "beschriftung.selbsttest.fehler": "Failed",
    "beschriftung.platzhalter.vorlage": "Design template: §{{abschnitt}} · {{bild}}",
    "beschriftung.logo.start": "Klarwerk - to the start page",
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
    "beschriftung.editor.stufe.klein": "Klein",
    "beschriftung.editor.stufe.mittel": "Middel",
    "beschriftung.editor.stufe.gross": "Groot",
    "beschriftung.editor.stufe.voll": "Volle breedte",
    "beschriftung.selbsttest.ok": "Geslaagd",
    "beschriftung.selbsttest.fehler": "Mislukt",
    "beschriftung.platzhalter.vorlage": "Ontwerpsjabloon: §{{abschnitt}} · {{bild}}",
    "beschriftung.logo.start": "Klarwerk - naar de startpagina",
  },
} satisfies Textmodul;
