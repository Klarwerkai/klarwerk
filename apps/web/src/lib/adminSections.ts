// SCRUM-394 (Pedi 02.07.): Der Admin-Bereich wächst (Konten, KI-Verwaltung, Demodaten,
// Audit, künftig Prüfer-Defaults) — Untergliederung in drei ruhige Bereiche statt einer
// langen Kartenwand. DOM-frei, damit die Zuordnung testbar bleibt.
export const ADMIN_SECTIONS = [
  // Konten: Nutzer anlegen, Nutzerliste (Freigabe/Rolle/Reset/Löschen)
  { id: "konten", labelKey: "adm.sec.konten" },
  // KI: KI-Verwaltung (Provider-Status, Key-Test, Zuordnung global + je Einsatz)
  { id: "ki", labelKey: "adm.sec.ki" },
  // Daten: Demodaten (Seed/Purge), Audit-Log
  { id: "daten", labelKey: "adm.sec.daten" },
  // SCRUM-432: Sicherheit — Vertrauen & Sicherheit (Prüfprotokoll + Datenschutz-Nachweis, Investoren)
  { id: "sicherheit", labelKey: "adm.sec.sicherheit" },
  // SCRUM-437: Bereitschaft — Ein-Blick-Status vor dem VIP-Test (KIs, Wissen, Grenzen, Stufe)
  { id: "bereitschaft", labelKey: "adm.sec.bereitschaft" },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];

export const DEFAULT_ADMIN_SECTION: AdminSectionId = "konten";

export function isAdminSectionId(value: string): value is AdminSectionId {
  return ADMIN_SECTIONS.some((s) => s.id === value);
}
