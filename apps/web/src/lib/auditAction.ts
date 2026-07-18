// SCRUM-513/487 (WP5-i18n): rohe Audit-Aktionscodes (z. B. „ko.purged") in der Lineage-/Audit-Ansicht
// als lesbares, lokalisiertes Label darstellen. DOM-frei + testbar; der Aufrufer reicht die i18next-t.
// Bekannte Aktionen laufen über audit.action.<code>-Keys (DE/EN/NL); ein unbekannter Code fällt auf eine
// neutrale, sprachunabhängige Humanisierung zurück (Trenner → Leerzeichen), nie ein roher Code/Deutsch.
type Translate = (key: string, opts?: Record<string, unknown>) => string;

export function auditActionLabel(action: string, t: Translate): string {
  const key = `audit.action.${action.replace(/[.-]/g, "_")}`;
  const humanized = action.replace(/[._-]/g, " ").trim();
  return t(key, { defaultValue: humanized });
}
