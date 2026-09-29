// R-1028 (Auftrag deploy-health-commit): der sichtbare Stand im Word-Panel („Klara <Stand>").
//
// Die Programmversion darin ist DIESELBE Konstante, die die Web-Topbar zeigt (`APP_VERSION` aus
// `apps/web/src/version.ts`) — das Plugin `klara-stand` in `apps/web/vite.config.ts` reicht sie
// beim Bauen herein. Word-Panel und Web-Konsole können so keine unterschiedlichen Programmstände
// behaupten. Bauzeit und Git-Kürzel bleiben dahinter stehen: sie beantworten „wann und woraus
// wurde gebaut", die Version „welcher Stand ist das".
//
// Die Add-in-Fassung (`KLARA_TASKPANE_FASSUNG`, = `<Version>` im Office-Manifest) ist davon
// getrennt: Office verlangt dort vier Zahlen, sie steuert den Office-Cache und wird im Panel als
// „Add-in-Fassung" bezeichnet, nicht als Stand.

/** Der Text, der im gebauten Word-Panel an die Stelle von `__KLARA_STAND__` tritt. */
export function klaraStandText(version: string, gebautUm: Date, gitKuerzel: string): string {
  const zeit = `${gebautUm.toISOString().slice(0, 16).replace("T", " ")}Z`;
  return [version, zeit, gitKuerzel].filter((teil) => teil.length > 0).join(" · ");
}
