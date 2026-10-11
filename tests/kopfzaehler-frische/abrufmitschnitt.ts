// ================================================================================================
// R-1558 / P-H1b — DER ABRUFMITSCHNITT DER CHROMIUM-ABNAHME, getrennt und kalibrierbar.
// ================================================================================================
//
// BEN, Lauf 3 R1 (B2): Der erste Mitschnitt schrieb erst NACH der Antwort mit, und die Herkunft
// zählte nur HTTP 200. Ein zusätzlicher 503-Abruf oder ein noch laufender Abruf in den 35 s blieb
// damit unsichtbar — die Aussage „kein Abruf einer Zählquelle" war nicht gedeckt.
//
// Deshalb zwei getrennte Listen:
//   · `__anfragen`  — jeder START eines Abrufs, sofort und unabhängig von Antwort, Status oder
//                     Netzfehler. Daran hängt die Aussage „kein zusätzlicher Abruf".
//   · `__abrufe`    — jede ANTWORT mit Status (Netzfehler als Status 0). Daraus kommen die
//                     erfolgreichen Bestätigungen und ihre Herkunftszeiten (`herkunft`).
//
// Die Datei importiert bewusst nichts aus Playwright: sie ist reiner Text und reine Rechnung, damit
// `abrufmitschnitt-kalibrierung.test.ts` sie ohne Browser prüfen kann (Browser-Gruppe:
// `tests/tor-inventar/browser-gruppe.ts`, berechnet aus dem Importgraphen).

/** Die fünf Quellen der Kopfband-Zahlen (`app/useNavBadges.ts`). */
export const ZAEHLQUELLEN = [
  "/api/validation/board",
  "/api/conflicts",
  "/api/duplicates",
  "/api/gaps/summary",
  "/api/lifecycle/pending",
] as const;

export interface Anfrage {
  readonly pfad: string;
  readonly t: number;
}

export interface Abruf {
  readonly pfad: string;
  readonly status: number;
  readonly t: number;
}

// Läuft VOR jedem Skript der Seite und überlebt keinen Neuaufbau — er wird bei jedem Laden neu
// gesetzt. `Date.now()` ist dort die Seitenuhr, also die, die auch die Frist misst.
export const MITSCHNITT = `(() => {
  const roh = window.fetch.bind(window);
  window.__anfragen = [];
  window.__abrufe = [];
  const pfadVon = (eingabe) => {
    try {
      const url = typeof eingabe === "string" ? eingabe : (eingabe && eingabe.url) || String(eingabe);
      return new URL(url, location.href).pathname;
    } catch (e) {
      return String(eingabe);
    }
  };
  window.fetch = async (eingabe, init) => {
    const pfad = pfadVon(eingabe);
    window.__anfragen.push({ pfad, t: Date.now() });
    let antwort;
    try {
      antwort = await roh(eingabe, init);
    } catch (fehler) {
      window.__abrufe.push({ pfad, status: 0, t: Date.now() });
      throw fehler;
    }
    window.__abrufe.push({ pfad, status: antwort.status, t: Date.now() });
    return antwort;
  };
})();`;

/**
 * Je Zählquelle: wie viele Abrufe GESTARTET wurden — gleich ob beantwortet, gescheitert oder noch
 * unterwegs. Der Vergleich zweier Stände belegt „kein zusätzlicher Abruf".
 */
export function anfragenJeQuelle(liste: readonly Anfrage[]): Record<string, number> {
  const ergebnis: Record<string, number> = {};
  for (const quelle of ZAEHLQUELLEN) {
    ergebnis[quelle] = liste.filter((a) => a.pfad === quelle).length;
  }
  return ergebnis;
}

/** Je Zählquelle: wie oft ERFOLGREICH bestätigt, und wann (Seitenzeit) zuletzt. */
export function herkunft(
  liste: readonly Abruf[],
): Record<string, { anzahl: number; zuletzt: number | null }> {
  const ergebnis: Record<string, { anzahl: number; zuletzt: number | null }> = {};
  for (const quelle of ZAEHLQUELLEN) {
    const treffer = liste.filter((a) => a.pfad === quelle && a.status === 200);
    ergebnis[quelle] = {
      anzahl: treffer.length,
      zuletzt: treffer.length > 0 ? (treffer[treffer.length - 1]?.t ?? null) : null,
    };
  }
  return ergebnis;
}
