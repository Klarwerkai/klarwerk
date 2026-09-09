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
// JOB 3384 · UX-26 — WARUM DER RÜCKFALL BLEIBT, UND WAS ER NICHT LEISTEN KANN.
// Der Rückfall trägt nur, solange die TATSÄCHLICH VORKOMMENDEN Codes einen Schlüssel haben. Am
// 09.09. hatten acht von ihnen keinen, und die Herkunftskette zeigte deshalb Programmbrocken:
// `ask.query` → „ask query" (Pedis Befund, N-0053), dazu `answer.helpful`, `ko.document-appended`,
// `ko.ownership`, `ko.ownership-role`, `ko.tags-changed`, `ko.create-followup-failed`,
// `ko.create-rollback-failed`. Alle acht haben seither einen `audit.action.*`-Schlüssel in DE/EN/NL
// (`i18n.ts`, Block „JOB 3384"); die Liste ist am Schreibweg gemessen, nicht geraten (nur Codes mit
// dem KO als `target` erreichen diese Fläche — `koLineage.ts:12-14`).
// WER EINEN NEUEN AUDIT-CODE MIT KO-ZIEL EINFÜHRT, LEGT DEN SCHLÜSSEL MIT AN. Sonst steht die
// Humanisierung wieder da: sie ist die ehrliche Notlösung für das Unvorhergesehene und bleibt
// genau dafür erhalten — sie ist kein Ersatz für einen Namen.
interface Translate {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

export function auditActionLabel(action: string, t: Translate): string {
  const key = `audit.action.${action.replace(/[.-]/g, "_")}`;
  const humanized = action.replace(/[._-]/g, " ").trim();
  return t(key, { defaultValue: humanized });
}
