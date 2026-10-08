// ================================================================================================
// R-1656 · DIE LESESPUR FÜR „ZUSAMMEN GELESEN" — sie bleibt im Browser.
// ================================================================================================
//
// Für das Co-Reading-Muster braucht der Server nur EINE Auskunft: „B wurde in derselben
// Lesesitzung nach A geöffnet". Welcher Eintrag zuletzt offen war, weiß deshalb allein dieser Tab
// (`sessionStorage`); der Server bekommt das Paar, nie die Spur. Gemeldet wird jedes Paar höchstens
// einmal je Tab, und nur, wenn zwischen beiden Einträgen weniger als `LESESITZUNG_MS` liegen —
// wer morgen weiterliest, hat keinen Zusammenhang hergestellt.
//
// GELESEN IST NICHT GEÖFFNET: wer durch die Liste blättert, liest nicht. Ein Eintrag kommt erst in
// die Spur, wenn er `MINDESTLESEZEIT_MS` lang offen war (`Wissensempfehlung.tsx`).
const SCHLUESSEL = "kw.lesespur";

export const MINDESTLESEZEIT_MS = 8_000;
export const LESESITZUNG_MS = 30 * 60 * 1000;
/** Obergrenze der gemerkten Paare — ein Tab ist keine Ablage. */
export const LESESPUR_MAX_PAARE = 200;

export interface Lesespur {
  letzte: string;
  am: number;
  gemeldet: string[];
}

function paarSchluessel(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Rein: die Spur nach dem Öffnen von `koId`. `zuvor` ist gesetzt, wenn genau jetzt ein Paar zu
 * melden ist — sonst `undefined` (erster Eintrag, derselbe Eintrag, zu lange her, schon gemeldet).
 */
export function naechsteLesespur(
  spur: Lesespur | null,
  koId: string,
  jetzt: number,
): { spur: Lesespur; zuvor: string | undefined } {
  const gemeldet = spur?.gemeldet ?? [];
  if (!spur || spur.letzte === koId || jetzt - spur.am > LESESITZUNG_MS || jetzt < spur.am) {
    return { spur: { letzte: koId, am: jetzt, gemeldet }, zuvor: undefined };
  }
  const paar = paarSchluessel(spur.letzte, koId);
  if (gemeldet.includes(paar)) {
    return { spur: { letzte: koId, am: jetzt, gemeldet }, zuvor: undefined };
  }
  return {
    spur: { letzte: koId, am: jetzt, gemeldet: [...gemeldet, paar].slice(-LESESPUR_MAX_PAARE) },
    zuvor: spur.letzte,
  };
}

function speicher(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function lies(s: Storage): Lesespur | null {
  try {
    const roh = JSON.parse(s.getItem(SCHLUESSEL) ?? "null") as Partial<Lesespur> | null;
    if (
      roh &&
      typeof roh.letzte === "string" &&
      typeof roh.am === "number" &&
      Array.isArray(roh.gemeldet)
    ) {
      return {
        letzte: roh.letzte,
        am: roh.am,
        gemeldet: roh.gemeldet.filter((p): p is string => typeof p === "string"),
      };
    }
  } catch {
    // Eine unlesbare Spur ist keine Spur.
  }
  return null;
}

/** Vermerkt das Öffnen von `koId` in diesem Tab und nennt den zu meldenden Vorgänger. */
export function vermerkeGelesen(koId: string, jetzt = Date.now()): string | undefined {
  const s = speicher();
  if (!s || koId === "") {
    return undefined;
  }
  const { spur, zuvor } = naechsteLesespur(lies(s), koId, jetzt);
  try {
    s.setItem(SCHLUESSEL, JSON.stringify(spur));
  } catch {
    // Voller oder gesperrter Speicher: dann wird eben nichts gemeldet — lieber kein Signal als
    // eines, das sich bei jedem Öffnen wiederholt.
    return undefined;
  }
  return zuvor;
}
