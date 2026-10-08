// R-0348: der Gesprächsfaden der Fragen-Seite — DOM-freie Regeln. Eine Nachfrage fängt nicht bei
// null an: die vorangegangenen Fragen derselben Fragestrecke reisen mit (`thread` an POST /api/ask).
// R-0345 bleibt: kein offener Chatbot — der Server nutzt den Faden nur, um Quellen zu finden; die
// Antwort bleibt quellengebunden. Derselbe Deckel wie am Server (`GESPRAECHSFADEN_MAX_FRAGEN`).
export const FADEN_MAX_FRAGEN = 3;

// Ben, Nacharbeit 2: DER THEMENANKER BLEIBT. Die erste Frage des Fadens nennt das Thema („Wie
// werden Urlaubstage berechnet?"); die Nachfragen danach („Und bei …?") tun das oft nicht mehr.
// Ein reines „die jüngsten drei" warf den Anker nach drei Nachfragen hinaus, und der Zusammenhang
// war weg. Begrenzt wird deshalb auf den Anker plus die jüngsten Nachfragen.
export function fadenBegrenzen(fragen: readonly string[]): string[] {
  if (fragen.length <= FADEN_MAX_FRAGEN) {
    return [...fragen];
  }
  return [...fragen.slice(0, 1), ...fragen.slice(-(FADEN_MAX_FRAGEN - 1))];
}

// Was zu einer Frage mitgeschickt wird: der Faden OHNE diese Frage selbst — dieselbe Frage erneut
// zu stellen ist eine Auffrischung, keine Nachfrage auf sich selbst.
export function fadenFuerAnfrage(faden: readonly string[], frage: string): string[] {
  return fadenBegrenzen(faden.filter((f) => f !== frage));
}

// Nach einer angekommenen Antwort (auch einer Wissenslücke) gehört die Frage zum Faden — als
// jüngste, ohne Doppelung. Die Auffrischung des Ankers selbst lässt den Faden, wie er ist.
export function fadenNachAntwort(faden: readonly string[], frage: string): string[] {
  if (faden[0] === frage) {
    return [...faden];
  }
  return fadenBegrenzen([...faden.filter((f) => f !== frage), frage]);
}
