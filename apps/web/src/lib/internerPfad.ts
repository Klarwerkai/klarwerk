// R-1398 · GHSA-wrjc-x8rr-h8h6 und GHSA-jjmj-jmhj-qwj2 (react-router/-dom 6.30.4): Open Redirect,
// wenn ein Navigationsziel mit `//` oder `/\` beginnt und damit für den Browser eine fremde Adresse
// ist.
//
// Fast alle Navigationsziele der Oberfläche stammen aus dem Code: Konstanten, Konfigurationslisten
// oder Vorlagen mit festem Anfang (`/wissen/${id}`, `/spaces/…`, `adminHref(…)`). Sie können so
// nicht beginnen. Zwei Ziele übernehmen dagegen einen früher gelesenen `location.pathname`: der
// Rückweg der Handyfläche (`pages/Mobile.tsx`, aus dem History-State, den `shell/KontoMenue.tsx`
// setzt) und der Sprung zur Herkunft in der Klara-Vorschau (`herkunftZiel`). Nur diese beiden
// laufen hier durch. Alles, was kein eindeutig interner Pfad ist, wird durch den Ersatz ersetzt.
//
// Abgewiesen wird: kein String; kein führender `/`; `//` oder `/\` am Anfang; jeder Backslash (ein
// Browser liest `\` in http-Pfaden als `/`); jedes Steuerzeichen (Tab und Zeilenumbruch entfernt
// der URL-Parser, aus `/\t/x` würde so `//x`).
export function internerPfad(ziel: unknown, ersatz: string): string {
  if (typeof ziel !== "string" || !ziel.startsWith("/")) {
    return ersatz;
  }
  if (ziel.startsWith("//") || ziel.includes("\\")) {
    return ersatz;
  }
  for (let i = 0; i < ziel.length; i += 1) {
    const code = ziel.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) {
      return ersatz;
    }
  }
  return ziel;
}
