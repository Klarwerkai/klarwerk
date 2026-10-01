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

/**
 * Wartet, bis die Warteschlange `haltenMs` lang UNUNTERBROCHEN in Ruhe ist (kein `pending`,
 * Sendeknopf bedienbar).
 *
 * Nach einer NEGATIVEN Tab-Suche (Aufnahme 20260922 mobile-abweisung-rest, Ben-Befund B1,
 * pa-1790788737-9307f5fe) reicht die Ruhe nach dem letzten Anschlag nicht: `onFocus → syncNow`
 * setzt `syncing` erst nach seinen eigenen Vorprüfungen, ein soeben ausgelöster Lauf kann also
 * NACH der letzten Ruheprobe beginnen. Die Ruhe muss deshalb eine Weile halten. Das macht nichts
 * weicher: was danach am Vorgang steht, wird weiterhin streng abgenommen (`pending` ist keine
 * Abweisung). Hält die Ruhe nie, scheitert der Aufruf mit Seitentext.
 */
export async function ruheGehalten(seite: Seite, haltenMs = 1_000): Promise<void> {
  await seite.evaluate<boolean>(fn("() => { window.__kwRuheSeit = 0; return true; }"));
  await warte(
    seite,
    `([s, k, ms]) => {
      const ruhig = (${RUHE})([s, k]);
      if (!ruhig) { window.__kwRuheSeit = 0; return false; }
      if (!window.__kwRuheSeit) { window.__kwRuheSeit = performance.now(); }
      return performance.now() - window.__kwRuheSeit >= ms;
    }`,
    `die Warteschlange ist ${haltenMs} ms ununterbrochen ohne Nachsendelauf`,
    [SCHLUESSEL, KOPFZEILE, haltenMs],
    60_000,
  );
}

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
