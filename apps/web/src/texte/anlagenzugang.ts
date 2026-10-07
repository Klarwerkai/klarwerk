// ================================================================================================
// Aufnahme `gesamt-anlagenzugang` · DIE TEXTE DES ANLAGENZUGANGS (R-1631, R-1647, R-2174).
// ================================================================================================
//
// · `anlagenzugang.facette` — die Achse „Anlage" im Menü „Filter" der Bibliothek
//   (`components/bibliothek/BibliothekFlaeche.tsx`). Dasselbe Wort wie das Erfassungsfeld
//   „Anlage / Gerät" (`capture.fAsset`), kurz, weil es als Menüpunkt und Filterpille steht.
// · `anlagenzugang.qr.*` — der QR-Code einer Anlage im Abschnitt „Kopplung und Anlagen" der
//   Leseansicht (`components/bibliothek/MehrAbschnitte.tsx`, `AnlagenQrCode`).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "anlagenzugang.",
  legacySchluessel: [],
  de: {
    "anlagenzugang.facette": "Anlage",
    "anlagenzugang.qr.titel": "QR-Code für „{{anlage}}“",
    "anlagenzugang.qr.hinweis":
      "Für das Etikett an der Anlage. Der Scan öffnet die Bibliothek mit dem Wissen zu dieser Anlage – nach Anmeldung und mit denselben Rechten wie hier.",
    "anlagenzugang.qr.bild": "QR-Code, der das Wissen zur Anlage „{{anlage}}“ öffnet",
    "anlagenzugang.qr.oeffnen": "Wissen dieser Anlage öffnen",
    "anlagenzugang.qr.herunterladen": "QR-Code herunterladen (SVG)",
    "anlagenzugang.qr.zuLang":
      "Diese Anlagenkennung ist für einen QR-Code zu lang. Mit einer kürzeren Kennung entsteht er.",
  },
  en: {
    "anlagenzugang.facette": "Equipment",
    "anlagenzugang.qr.titel": "QR code for “{{anlage}}”",
    "anlagenzugang.qr.hinweis":
      "For the label on the equipment. Scanning opens the library with the knowledge about this equipment – after sign-in and with the same permissions as here.",
    "anlagenzugang.qr.bild": "QR code that opens the knowledge about the equipment “{{anlage}}”",
    "anlagenzugang.qr.oeffnen": "Open knowledge for this equipment",
    "anlagenzugang.qr.herunterladen": "Download QR code (SVG)",
    "anlagenzugang.qr.zuLang":
      "This equipment ID is too long for a QR code. A shorter ID will produce one.",
  },
  nl: {
    "anlagenzugang.facette": "Installatie",
    "anlagenzugang.qr.titel": "QR-code voor ‘{{anlage}}’",
    "anlagenzugang.qr.hinweis":
      "Voor het etiket op de installatie. Scannen opent de bibliotheek met de kennis over deze installatie – na aanmelding en met dezelfde rechten als hier.",
    "anlagenzugang.qr.bild": "QR-code die de kennis over de installatie ‘{{anlage}}’ opent",
    "anlagenzugang.qr.oeffnen": "Kennis van deze installatie openen",
    "anlagenzugang.qr.herunterladen": "QR-code downloaden (SVG)",
    "anlagenzugang.qr.zuLang":
      "Deze installatiecode is te lang voor een QR-code. Met een kortere code ontstaat er een.",
  },
} satisfies Textmodul;
