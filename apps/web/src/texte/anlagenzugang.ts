// ================================================================================================
// Aufnahme `gesamt-anlagenzugang` · DIE TEXTE DES ANLAGENZUGANGS (R-1631, R-1647, R-2174).
// ================================================================================================
//
// · `anlagenzugang.bauteil`, `.material` — die Achsen „Bauteil" und „Material" im Menü „Filter"
//   der Bibliothek (`components/bibliothek/BibliothekFlaeche.tsx`). Die Achse „Anlage" beschriftet
//   seit der Integration nacharbeit-26 mains `wissensmetadaten.anlage.facette` — es gibt EINE
//   Anlagenachse, nicht zwei.
// · `anlagenzugang.kontext.*` — die Kontextleiste der Bibliothek (Version, Standort, Schicht) und
//   dieselben Wahlfelder am QR-Code.
// · `anlagenzugang.qr.*`, `.art.*` — der QR-Code einer Anlage, eines Bauteils oder Materials im
//   Abschnitt „Kopplung und Anlagen" der Leseansicht (`AnlagenQrCode`).
// · `anlagenzugang.pflege.*` — die Pflege der Bezüge und des Geltungskontexts (`AnlagenBezugPflege`).
// · `audit.action.ko_anlagenkontext_changed` — der Protokollvorgang `ko.anlagenkontext-changed`
//   (`services/knowledge-object/src/service.ts`, `setAnlagenkontext`); den Schlüssel leitet
//   `lib/auditAction.ts` aus dem Vorgang ab, darum trägt er nicht das Präfix dieses Moduls.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "anlagenzugang.",
  legacySchluessel: ["audit.action.ko_anlagenkontext_changed"],
  de: {
    "anlagenzugang.bauteil": "Bauteil",
    "anlagenzugang.material": "Material",
    "anlagenzugang.art.asset": "Anlage",
    "anlagenzugang.art.bauteil": "Bauteil",
    "anlagenzugang.art.material": "Material",
    "anlagenzugang.kontext.label": "Geltungskontext",
    "anlagenzugang.kontext.anlagenversion": "Anlagenversion",
    "anlagenzugang.kontext.standort": "Standort",
    "anlagenzugang.kontext.schicht": "Schicht",
    "anlagenzugang.kontext.alle.anlagenversion": "Alle Versionen",
    "anlagenzugang.kontext.alle.standort": "Alle Standorte",
    "anlagenzugang.kontext.alle.schicht": "Alle Schichten",
    "anlagenzugang.qr.titel": "QR-Code für „{{anlage}}“",
    "anlagenzugang.qr.hinweis":
      "Für das Etikett an Anlage, Bauteil oder Material. Der Scan öffnet die Bibliothek mit dem Wissen dazu – nach Anmeldung und mit denselben Rechten wie hier.",
    "anlagenzugang.qr.bild": "QR-Code, der das Wissen zu „{{anlage}}“ öffnet",
    "anlagenzugang.qr.bezug": "Wofür der QR-Code gilt",
    "anlagenzugang.qr.oeffnen": "Wissen dazu öffnen",
    "anlagenzugang.qr.herunterladen": "QR-Code herunterladen (SVG)",
    "anlagenzugang.qr.kontextZuruecksetzen": "Kontext zurücksetzen",
    "anlagenzugang.qr.zuLang":
      "Diese Kennung ist für einen QR-Code zu lang. Mit einer kürzeren Kennung entsteht er.",
    "anlagenzugang.pflege.titel": "Bauteile, Material und Geltung",
    "anlagenzugang.pflege.hinweis":
      "Mehrere Angaben mit Komma trennen. Ohne Version, Standort oder Schicht gilt das Wissen überall.",
    "anlagenzugang.pflege.bauteile": "Bauteil-Nummern",
    "anlagenzugang.pflege.materialien": "Material-Codes",
    "anlagenzugang.pflege.versionen": "Gilt für Anlagenversionen",
    "anlagenzugang.pflege.standorte": "Gilt an Standorten",
    "anlagenzugang.pflege.schichten": "Gilt in Schichten",
    "anlagenzugang.pflege.speichern": "Angaben speichern",
    "anlagenzugang.pflege.gespeichert": "Bauteile, Material und Geltung gespeichert.",
    "audit.action.ko_anlagenkontext_changed": "Bauteile, Material oder Geltung geändert",
  },
  en: {
    "anlagenzugang.bauteil": "Part",
    "anlagenzugang.material": "Material",
    "anlagenzugang.art.asset": "Equipment",
    "anlagenzugang.art.bauteil": "Part",
    "anlagenzugang.art.material": "Material",
    "anlagenzugang.kontext.label": "Context of validity",
    "anlagenzugang.kontext.anlagenversion": "Equipment version",
    "anlagenzugang.kontext.standort": "Site",
    "anlagenzugang.kontext.schicht": "Shift",
    "anlagenzugang.kontext.alle.anlagenversion": "All versions",
    "anlagenzugang.kontext.alle.standort": "All sites",
    "anlagenzugang.kontext.alle.schicht": "All shifts",
    "anlagenzugang.qr.titel": "QR code for “{{anlage}}”",
    "anlagenzugang.qr.hinweis":
      "For the label on the equipment, part or material. Scanning opens the library with the related knowledge – after sign-in and with the same permissions as here.",
    "anlagenzugang.qr.bild": "QR code that opens the knowledge about “{{anlage}}”",
    "anlagenzugang.qr.bezug": "What the QR code is for",
    "anlagenzugang.qr.oeffnen": "Open the related knowledge",
    "anlagenzugang.qr.herunterladen": "Download QR code (SVG)",
    "anlagenzugang.qr.kontextZuruecksetzen": "Reset context",
    "anlagenzugang.qr.zuLang": "This ID is too long for a QR code. A shorter ID will produce one.",
    "anlagenzugang.pflege.titel": "Parts, material and validity",
    "anlagenzugang.pflege.hinweis":
      "Separate several entries with commas. Without version, site or shift the knowledge applies everywhere.",
    "anlagenzugang.pflege.bauteile": "Part numbers",
    "anlagenzugang.pflege.materialien": "Material codes",
    "anlagenzugang.pflege.versionen": "Applies to equipment versions",
    "anlagenzugang.pflege.standorte": "Applies at sites",
    "anlagenzugang.pflege.schichten": "Applies in shifts",
    "anlagenzugang.pflege.speichern": "Save details",
    "anlagenzugang.pflege.gespeichert": "Parts, material and validity saved.",
    "audit.action.ko_anlagenkontext_changed": "Parts, material or validity changed",
  },
  nl: {
    "anlagenzugang.bauteil": "Onderdeel",
    "anlagenzugang.material": "Materiaal",
    "anlagenzugang.art.asset": "Installatie",
    "anlagenzugang.art.bauteil": "Onderdeel",
    "anlagenzugang.art.material": "Materiaal",
    "anlagenzugang.kontext.label": "Geldigheidscontext",
    "anlagenzugang.kontext.anlagenversion": "Installatieversie",
    "anlagenzugang.kontext.standort": "Locatie",
    "anlagenzugang.kontext.schicht": "Ploeg",
    "anlagenzugang.kontext.alle.anlagenversion": "Alle versies",
    "anlagenzugang.kontext.alle.standort": "Alle locaties",
    "anlagenzugang.kontext.alle.schicht": "Alle ploegen",
    "anlagenzugang.qr.titel": "QR-code voor ‘{{anlage}}’",
    "anlagenzugang.qr.hinweis":
      "Voor het etiket op installatie, onderdeel of materiaal. Scannen opent de bibliotheek met de bijbehorende kennis – na aanmelding en met dezelfde rechten als hier.",
    "anlagenzugang.qr.bild": "QR-code die de kennis over ‘{{anlage}}’ opent",
    "anlagenzugang.qr.bezug": "Waarvoor de QR-code geldt",
    "anlagenzugang.qr.oeffnen": "Bijbehorende kennis openen",
    "anlagenzugang.qr.herunterladen": "QR-code downloaden (SVG)",
    "anlagenzugang.qr.kontextZuruecksetzen": "Context wissen",
    "anlagenzugang.qr.zuLang":
      "Deze code is te lang voor een QR-code. Met een kortere code ontstaat er een.",
    "anlagenzugang.pflege.titel": "Onderdelen, materiaal en geldigheid",
    "anlagenzugang.pflege.hinweis":
      "Meerdere gegevens met komma's scheiden. Zonder versie, locatie of ploeg geldt de kennis overal.",
    "anlagenzugang.pflege.bauteile": "Onderdeelnummers",
    "anlagenzugang.pflege.materialien": "Materiaalcodes",
    "anlagenzugang.pflege.versionen": "Geldt voor installatieversies",
    "anlagenzugang.pflege.standorte": "Geldt op locaties",
    "anlagenzugang.pflege.schichten": "Geldt in ploegen",
    "anlagenzugang.pflege.speichern": "Gegevens opslaan",
    "anlagenzugang.pflege.gespeichert": "Onderdelen, materiaal en geldigheid opgeslagen.",
    "audit.action.ko_anlagenkontext_changed": "Onderdelen, materiaal of geldigheid gewijzigd",
  },
} satisfies Textmodul;
