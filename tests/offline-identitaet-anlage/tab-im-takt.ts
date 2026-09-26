// ================================================================================================
// DER TAB-WEG IM TAKT EINES MENSCHEN — an der Warteschlange der mobilen Fläche.
// ================================================================================================
//
// GEMESSEN (Aufnahme 20260922 mobile-abweisung-rest, Prüflauf pa-1790442246-b36f4aef): Läuft die
// Tabulatorfolge über das Dokumentende hinaus, verlässt der Fokus die Seite und kehrt beim nächsten
// Anschlag zurück — das FENSTER bekommt `focus` (je Umlauf genau einmal gezählt), und
// `useOfflineQueue` startet dafür einen Nachsendelauf (`onFocus → syncNow`, je Umlauf genau einer
// auf dem Draht). Solange er läuft, ist der Sendeknopf gesperrt (`disabled={queue.syncing …}`) und
// damit keine Fokusstation; abgewiesene Einträge stehen kurz auf `pending`, ihre Meldungen sind
// ausgehängt.
//
// `tabBisZu` drückt schneller, als ein Lauf dauert: jeder Umlauf löst den nächsten Lauf aus und
// trifft den Knopf wieder gesperrt — 150 Anschläge ohne Treffer (pa-1790440661-dc6de05c; derselbe
// Befund an JOB 4354 T2 in pa-1790434825-2407df39). Das ist eine Eigenschaft des Prüfstands, nicht
// der Fläche: ein Mensch sieht nach dem Anschlag hin, und bis dahin ist der Lauf vorbei.
//
// Hier wird deshalb nach JEDEM Anschlag gewartet, bis kein Nachsendelauf mehr unterwegs ist. Wie
// oft das Fenster dabei `focus` bekam, wird zurückgegeben, damit es gemeldet und nicht verschwiegen
// wird (Zähler `window.__kwFensterFokus`, sofern das Profil ihn einhängt — `FENSTER_FOKUS_ZAEHLER`).
import { type Seite, fn, warte } from "../gast-nutzerweg/browserweg";
import { SCHLUESSEL } from "./offlineweg";

/** Der Sendeknopf in der Kopfzeile der Warteschlange (`pages/Mobile.tsx`). */
export const KOPFZEILE = '[data-testid="mob-warteschlange"] button';

/** Init-Skript: zählt, wie oft das FENSTER selbst `focus` bekommt (nicht ein Element darin). */
export const FENSTER_FOKUS_ZAEHLER = `window.__kwFensterFokus = 0; window.addEventListener("focus", (e) => { if (e.target === window) { window.__kwFensterFokus += 1; } }, true);`;

const ZAEHLER = "() => window.__kwFensterFokus || 0";
const TREFFER = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";
const RUHE = `([s, k]) => {
  let q = [];
  try { q = JSON.parse(localStorage.getItem(s) || "[]"); } catch (e) { return false; }
  const knopf = document.querySelector(k);
  return q.every((o) => o.status !== "pending") && !!knopf && !knopf.disabled;
}`;

export async function tabImTakt(
  seite: Seite,
  selektor: string,
  hoechstens: number,
  vonVorn: boolean,
): Promise<{ schritte: number; fensterFokus: number }> {
  const vorher = await seite.evaluate<number>(fn(ZAEHLER));
  if (vonVorn) {
    await seite.evaluate<boolean>(
      fn("() => { const a = document.activeElement; if (a && a.blur) { a.blur(); } return true; }"),
    );
  }
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    await warte(seite, RUHE, "nach dem Tab-Anschlag ist kein Nachsendelauf mehr unterwegs", [
      SCHLUESSEL,
      KOPFZEILE,
    ]);
    if (await seite.evaluate<boolean>(fn(TREFFER), selektor)) {
      const fensterFokus = (await seite.evaluate<number>(fn(ZAEHLER))) - vorher;
      return { schritte, fensterFokus };
    }
  }
  throw new Error(
    `„${selektor}" war in ${hoechstens} Tab-Anschlägen (im Takt, ohne laufenden Nachsendelauf) nicht erreichbar.`,
  );
}
