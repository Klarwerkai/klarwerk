// SCRUM-513/487 (WP5-i18n): rohe Audit-Aktionscodes (z. B. „ko.purged") in der Lineage-/Audit-Ansicht
// als lesbares, lokalisiertes Label darstellen. DOM-frei + testbar; der Aufrufer reicht die i18next-t.
// Bekannte Aktionen laufen über audit.action.<code>-Keys (DE/EN/NL); ein unbekannter Code fällt auf eine
// neutrale, sprachunabhängige Humanisierung zurück (Trenner → Leerzeichen), nie ein roher Code/Deutsch.
// AUFTRAG-mega18 Block A-3 (Nebenbefund, aufgedeckt durch den neuen gemounteten KO-Detail-Test):
// die Signatur war `(key, opts?) => string`. Der OPTIONALE zweite Parameter macht die echte
// i18next-`TFunction` unter `exactOptionalPropertyTypes` NICHT zuweisbar (ihr Options-Parameter
// akzeptiert kein `undefined`). Im App-Typecheck fiel das nie auf, weil apps/web/tsconfig.json diese
// Option nicht setzt — der Root-Check und der .tsx-Test-Check tun es. Als Überladung ohne
// `undefined`-Fall passt beides zusammen, und alle Aufrufer bleiben unverändert gültig.
interface Translate {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

export function auditActionLabel(action: string, t: Translate): string {
  const key = `audit.action.${action.replace(/[.-]/g, "_")}`;
  const humanized = action.replace(/[._-]/g, " ").trim();
  return t(key, { defaultValue: humanized });
}
