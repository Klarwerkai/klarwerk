// SCRUM-394 (Pedi 02.07.): Der Admin-Bereich wächst (Konten, KI-Verwaltung, Demodaten,
// Audit, künftig Prüfer-Defaults) — Untergliederung in ruhige Bereiche statt einer
// langen Kartenwand. DOM-frei, damit die Zuordnung testbar bleibt.
//
// JOB 3065 H6 (Pedi 04.09., Maßstab `design/klarwerk/Admin.dc.html`): VIER Reiter, nicht fünf.
//
// ================================================================================================
// JOB 3337 · ADMIN-NAVIGATION — SIEBEN THEMEN STATT VIER REITER (Pedi 08.09.).
// ================================================================================================
//
// Pedi: „Die Gliederung ist schlecht … alle im Admin-Bereich befindlichen Seiten … schlecht und
// unlogisch." Die Vorlage von Codex
// (`gespraech/advisor-freitag/navigation/ADMIN-NAVIGATION-AUFTRAG.md`, Abschnitt „Gewünschte
// Nutzerstruktur") nennt die sieben Themen der Verwaltung namentlich. Die vier alten Reiter waren
// keine Themen, sondern Behälter: „Daten" trug Demodaten, Werkseinstellungen, Papierkorb UND das
// Audit-Log — vier Dinge aus vier Welten.
//
// WAS SICH VERSCHOBEN HAT, und warum (jeweils die Zeile der Vorlage):
//   · `audit`        Daten → Sicherheit und Nachweise   („Benutzeränderungen/Audit")
//   · `werk`         Daten → System                     („Werkseinstellungen in eigenem Abschnitt")
//   · `papierkorb`   Daten → Quellen und Daten          („Import und Quellen …, Papierkorb")
//   · `demo`         Daten → Vorführdaten               (eigenes Thema, mit den Paketen aus 3277)
//   · `bereitschaft` Sicherheit → System                („System: Bereitschaft, …")
//
// KEINE Detailkennung fällt dabei weg: `ADMIN_DETAILS` unten führt jede statische Kennung des
// Detail-Switch in `pages/Admin.tsx` mit ihrem Thema und ihrem sichtbaren Namen. Die beiden
// dynamischen (`nutzer:<id>`, `rolle:<rolle>`) stehen bewusst NICHT darin — sie tragen
// personenbezogene Namen und gehören nicht in eine globale Suchliste (Vorlage,
// „Vollständigkeitsinventar"). Erreichbar bleiben sie über das Thema „Benutzer und Rollen"; ihre
// Adressierbarkeit prüft `isAdminDetailId` in `app/navigationGliederung.ts`.
export const ADMIN_SECTIONS = [
  // Benutzer und Rollen: Kontenliste, Nutzer anlegen/bearbeiten, Rollenrechte, Ansicht als Rolle
  { id: "konten", labelKey: "adm.sec.konten" },
  // KI: Anbieter und Modelle, Zugänge, Funktionen, Grenzen, externe Recherche, Doppelungen
  { id: "ki", labelKey: "adm.sec.ki" },
  // Quellen und Daten: Import und Quellen (Kurzlink), Papierkorb, Verweis auf die Uploadgrenzen
  { id: "quellen", labelKey: "adm.sec.quellen" },
  // Vorführdaten: Demodaten und die auswählbaren Pakete (JOB 3277/3326) an EINEM Auffindeort
  { id: "vorfuehrdaten", labelKey: "adm.sec.vorfuehrdaten" },
  // Sicherheit und Nachweise: Prüfprotokoll, Datenschutz, Benutzeränderungen (Audit)
  { id: "sicherheit", labelKey: "adm.sec.sicherheit" },
  // Berichte und Analyse: Analytics & Audit, Auswertungen, Wissensgraph, Kapital-Sichten
  { id: "berichte", labelKey: "adm.sec.berichte" },
  // System: Bereitschaft, Erweiterte Module (Stufe 2), Werkseinstellungen im eigenen Abschnitt
  { id: "system", labelKey: "adm.sec.system" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

export const DEFAULT_ADMIN_SECTION: AdminSectionId = "konten";

export function isAdminSectionId(value: string): value is AdminSectionId {
  return ADMIN_SECTIONS.some((s) => s.id === value);
}

/**
 * Eine statische Detailkarte der Verwaltung als NAVIGATIONSZIEL.
 *
 * Vorlage, Punkt 3: „Titel und Suchnamen aus einer gemeinsamen Quelle." Genau deshalb steht hier
 * der `labelKey` — dieselbe Beschriftung trägt die Zeile auf der Fläche (`pages/Admin.tsx`), der
 * Direktzugang („Gehe zu …") und der lesbare Pfad über der Detailansicht. Drei Orte, ein Name.
 */
export interface AdminDetailZiel {
  /** Die Kennung des Detail-Switch in `pages/Admin.tsx` — unverändert, alte Wege bleiben gültig. */
  id: string;
  section: AdminSectionId;
  labelKey: string;
  /** Weitere Namen, unter denen dieses Ziel gefunden werden soll (Synonyme, auch englische). */
  synonymKeys?: readonly string[];
}

export const ADMIN_DETAILS: readonly AdminDetailZiel[] = [
  { id: "nutzerNeu", section: "konten", labelKey: "einst.konten.hinzufuegen" },
  { id: "ansichtRolle", section: "konten", labelKey: "role.viewAs" },
  { id: "ki", section: "ki", labelKey: "adm.ai.title", synonymKeys: ["adm.ziel.ki.syn"] },
  { id: "kiZugaenge", section: "ki", labelKey: "adm.ai.accessTitle" },
  { id: "kiFunktionen", section: "ki", labelKey: "adm.presets.title" },
  { id: "kiGrenzen", section: "ki", labelKey: "einst.ki.grenzen" },
  { id: "kiExtern", section: "ki", labelKey: "adm.ext.title" },
  { id: "kiDup", section: "ki", labelKey: "adm.dup.title" },
  {
    id: "papierkorb",
    section: "quellen",
    labelKey: "adm.trash.title",
    synonymKeys: ["adm.ziel.papierkorb.syn"],
  },
  // Der Name des ZIELS ist „Demodaten", nicht „Demodaten laden": eine Navigation darf nichts laden
  // und nichts entfernen (Vorlage, Punkt 6). Geladen wird erst IN der Karte, mit ihrer Bestätigung.
  {
    id: "demo",
    section: "vorfuehrdaten",
    labelKey: "adm.ziel.demo",
    synonymKeys: ["adm.ziel.demo.syn"],
  },
  { id: "protokoll", section: "sicherheit", labelKey: "adm.ziel.protokoll" },
  { id: "datenschutz", section: "sicherheit", labelKey: "adm.sich.dataTitle" },
  { id: "audit", section: "sicherheit", labelKey: "adm.auditTitle" },
  { id: "werk", section: "system", labelKey: "adm.factory.title" },
  { id: "bereitschaft", section: "system", labelKey: "adm.ready.title" },
];

/** Das Thema, unter dem diese Detailkarte wohnt — oder `null` für eine unbekannte Kennung. */
export function adminSectionFuerDetail(detail: string): AdminSectionId | null {
  if (detail.startsWith("nutzer:") || detail.startsWith("rolle:")) {
    return "konten";
  }
  return ADMIN_DETAILS.find((d) => d.id === detail)?.section ?? null;
}

/**
 * Die Adresse eines Verwaltungsziels.
 *
 * Vorlage, Punkt 4: „Reiter/Detailzustand muss über einen geprüften, erlaubten Navigationswert
 * adressierbar sein, etwa Queryparameter." `/admin` ohne Query bleibt gültig und führt auf das
 * erste Thema — alte Links, Hilfekapitel und der FAQ-Bestand zeigen weiterhin dorthin.
 */
export function adminHref(section: AdminSectionId, detail?: string): string {
  const query = `bereich=${encodeURIComponent(section)}`;
  return detail === undefined
    ? `/admin?${query}`
    : `/admin?${query}&detail=${encodeURIComponent(detail)}`;
}
