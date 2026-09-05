// SCRUM-394 (Pedi 02.07.): Der Admin-Bereich wächst (Konten, KI-Verwaltung, Demodaten,
// Audit, künftig Prüfer-Defaults) — Untergliederung in ruhige Bereiche statt einer
// langen Kartenwand. DOM-frei, damit die Zuordnung testbar bleibt.
//
// JOB 3065 H6 (Pedi 04.09., Maßstab `design/klarwerk/Admin.dc.html`): VIER Reiter, nicht fünf. Der
// bisherige fünfte Bereich „Bereitschaft" ist keine eigene Welt, sondern eine Auskunft über den
// Zustand des Hauses — er lebt als Zeile „Bereitschaft" unter Sicherheit weiter, mit derselben
// Checkliste und demselben Druckknopf in ihrer Detailkarte (Admin.tsx). `adm.sec.bereitschaft`
// bleibt als Beschriftung dieser Zeile in Gebrauch.
export const ADMIN_SECTIONS = [
  // Konten: Nutzerliste (Freigabe/Rolle/Reset/Löschen), Nutzer anlegen, Ansicht als Rolle, Rollen
  { id: "konten", labelKey: "adm.sec.konten" },
  // KI: KI-Verwaltung (Provider-Status, Key-Test, Zuordnung global + je Einsatz), Grenzen, Duplikate
  { id: "ki", labelKey: "adm.sec.ki" },
  // Daten: Demodaten (Seed/Purge), Werkseinstellungen, Papierkorb, Audit-Log
  { id: "daten", labelKey: "adm.sec.daten" },
  // SCRUM-432: Sicherheit — Prüfprotokoll, Datenschutz-Nachweis (Investoren) und Bereitschaft
  { id: "sicherheit", labelKey: "adm.sec.sicherheit" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

export const DEFAULT_ADMIN_SECTION: AdminSectionId = "konten";

export function isAdminSectionId(value: string): value is AdminSectionId {
  return ADMIN_SECTIONS.some((s) => s.id === value);
}
