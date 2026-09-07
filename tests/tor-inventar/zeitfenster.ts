// JOB 3131/3150: unverändertes, mit K1/K2 kalibriertes Messverfahren.
export interface Fenster {
  readonly datei: string;
  readonly von: number;
  readonly bis: number;
}

/**
 * Die groesste Zahl gleichzeitig offener Fenster — ein Durchgang ueber die Zeitachse.
 *
 * Ein Fenster der Laenge 0 (`von === bis`) zaehlt nie mit: der JSON-Bericht setzt so eines, wenn in
 * einer Datei kein einziger Fall lief (dann faellt `startTime` auf die Startzeit des Berichts
 * zurueck). Solche Fenster duerfen keine Ueberlappung vortaeuschen, deshalb schliesst dieser Gang
 * bei gleicher Zeit ZUERST und oeffnet danach.
 */
export function maxGleichzeitig(fenster: readonly Fenster[]): number {
  const ereignisse: Array<{ zeit: number; wert: number }> = [];
  for (const f of fenster) {
    ereignisse.push({ zeit: f.von, wert: 1 }, { zeit: f.bis, wert: -1 });
  }
  ereignisse.sort((a, b) => a.zeit - b.zeit || a.wert - b.wert);
  let offen = 0;
  let groesste = 0;
  for (const e of ereignisse) {
    offen += e.wert;
    if (offen > groesste) {
      groesste = offen;
    }
  }
  return groesste;
}

/** Die Paare, die sich wirklich ueberschneiden — als Beleg in der Fehlermeldung, nicht als Zahl. */
export function ueberlappendePaare(fenster: readonly Fenster[]): string[] {
  const paare: string[] = [];
  for (let i = 0; i < fenster.length; i++) {
    for (let k = i + 1; k < fenster.length; k++) {
      const a = fenster[i] as Fenster;
      const b = fenster[k] as Fenster;
      if (a.von < b.bis && b.von < a.bis) {
        paare.push(`${a.datei} [${a.von}–${a.bis}] ∥ ${b.datei} [${b.von}–${b.bis}]`);
      }
    }
  }
  return paare;
}
