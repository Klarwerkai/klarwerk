// ================================================================================================
// P-WIKI-STELLENBEZUG (Thema WIKI-ZUSAMMENARBEIT) — die Texte der Rückfrage an Absatz, Tabelle oder Bild.
// ================================================================================================
//
// Im Diskussionsabschnitt der Lesefläche lässt sich eine neue Rückfrage an eine Stelle des Textes
// hängen (`MehrAbschnitte.tsx`, `lib/stellenbezug.ts`). Am Beitrag steht danach, woran er hängt und
// ob die Stelle in der heutigen Fassung eindeutig wiedergefunden ist. Der Satz für den unklaren Fall
// steht wörtlich in der Anforderung; er behauptet keinen Ort, den es nicht gibt. Kein Text spricht
// von Freigabe oder Prüfung des Inhalts — eine Rückfrage ist Diskussion, keine Freigabe.
//
// PLAN-SPRACHANMERKUNG (R-1625, R-2177): `stellenbezug.punkt.*` und `stellenbezug.sprechen.*` — die
// Notiz an einem Punkt einer Zeichnung, gesprochen über das Browser-Diktat.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "stellenbezug.",
  legacySchluessel: [],
  de: {
    "stellenbezug.waehlen": "Bezug im Text (optional)",
    "stellenbezug.keine": "Ganzes Dokument",
    "stellenbezug.art.absatz": "Absatz",
    "stellenbezug.art.tabelle": "Tabelle",
    "stellenbezug.art.bild": "Bild",
    "stellenbezug.anfang": "Dokumentanfang",
    "stellenbezug.stelle": "{{art}} · Abschnitt „{{abschnitt}}“ · Fassung v{{version}}",
    "stellenbezug.hier": "Stelle in dieser Fassung",
    "stellenbezug.eindeutig": "In Fassung v{{aktuell}} eindeutig wiedergefunden",
    "stellenbezug.unklar": "Bezug in der neuen Fassung nicht eindeutig — Zuordnung prüfen",
    "stellenbezug.alteFassung": "Fassung v{{version}} ansehen",
    "stellenbezug.neuWaehlen":
      "Der Eintrag hat sich geändert, seit du die Stelle gewählt hast. Bitte die Stelle neu wählen — dein Text bleibt stehen.",
    "stellenbezug.punkt.hinweis":
      "Tippe in der Zeichnung auf die Stelle, um die es geht (optional). Ohne Punkt gilt die Notiz dem ganzen Bild.",
    "stellenbezug.punkt.waehlen":
      "Zeichnung „{{bild}}“ — Stelle antippen; mit der Tastatur Enter, dann Pfeiltasten",
    "stellenbezug.punkt.lage": "Punkt in der Zeichnung: {{x}} % von links, {{y}} % von oben",
    "stellenbezug.punkt.markiert":
      "Zeichnung „{{bild}}“ mit markiertem Punkt bei {{x}} % von links, {{y}} % von oben",
    "stellenbezug.punkt.entfernen": "Punkt entfernen",
    "stellenbezug.sprechen.start": "Notiz sprechen",
    "stellenbezug.sprechen.stop": "Sprechen beenden",
  },
  en: {
    "stellenbezug.waehlen": "Refers to (optional)",
    "stellenbezug.keine": "Whole document",
    "stellenbezug.art.absatz": "Paragraph",
    "stellenbezug.art.tabelle": "Table",
    "stellenbezug.art.bild": "Image",
    "stellenbezug.anfang": "start of document",
    "stellenbezug.stelle": "{{art}} · section “{{abschnitt}}” · version v{{version}}",
    "stellenbezug.hier": "Passage in this version",
    "stellenbezug.eindeutig": "Found unambiguously in version v{{aktuell}}",
    "stellenbezug.unklar": "Reference in the new version is ambiguous — check the assignment",
    "stellenbezug.alteFassung": "View version v{{version}}",
    "stellenbezug.neuWaehlen":
      "The entry has changed since you chose the passage. Please choose the passage again — your text stays in place.",
    "stellenbezug.punkt.hinweis":
      "Tap the spot in the drawing that the note is about (optional). Without a point, the note refers to the whole image.",
    "stellenbezug.punkt.waehlen":
      "Drawing “{{bild}}” — tap a spot; with the keyboard press Enter, then the arrow keys",
    "stellenbezug.punkt.lage": "Point in the drawing: {{x}} % from the left, {{y}} % from the top",
    "stellenbezug.punkt.markiert":
      "Drawing “{{bild}}” with a marked point at {{x}} % from the left, {{y}} % from the top",
    "stellenbezug.punkt.entfernen": "Remove point",
    "stellenbezug.sprechen.start": "Speak note",
    "stellenbezug.sprechen.stop": "Stop speaking",
  },
  nl: {
    "stellenbezug.waehlen": "Verwijst naar (optioneel)",
    "stellenbezug.keine": "Hele document",
    "stellenbezug.art.absatz": "Alinea",
    "stellenbezug.art.tabelle": "Tabel",
    "stellenbezug.art.bild": "Afbeelding",
    "stellenbezug.anfang": "begin van het document",
    "stellenbezug.stelle": "{{art}} · sectie „{{abschnitt}}” · versie v{{version}}",
    "stellenbezug.hier": "Passage in deze versie",
    "stellenbezug.eindeutig": "Eenduidig teruggevonden in versie v{{aktuell}}",
    "stellenbezug.unklar": "Verwijzing in de nieuwe versie niet eenduidig — toewijzing controleren",
    "stellenbezug.alteFassung": "Versie v{{version}} bekijken",
    "stellenbezug.neuWaehlen":
      "Het item is gewijzigd sinds je de passage koos. Kies de passage opnieuw — je tekst blijft staan.",
    "stellenbezug.punkt.hinweis":
      "Tik in de tekening op de plek waar het om gaat (optioneel). Zonder punt geldt de notitie voor de hele afbeelding.",
    "stellenbezug.punkt.waehlen":
      "Tekening „{{bild}}” — tik op een plek; met het toetsenbord Enter, daarna de pijltoetsen",
    "stellenbezug.punkt.lage": "Punt in de tekening: {{x}} % van links, {{y}} % van boven",
    "stellenbezug.punkt.markiert":
      "Tekening „{{bild}}” met gemarkeerd punt op {{x}} % van links, {{y}} % van boven",
    "stellenbezug.punkt.entfernen": "Punt verwijderen",
    "stellenbezug.sprechen.start": "Notitie inspreken",
    "stellenbezug.sprechen.stop": "Inspreken stoppen",
  },
} satisfies Textmodul;
