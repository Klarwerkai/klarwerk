// ================================================================================================
// DER ZEILENVERGLEICH ZWEIER TEXTE — kürzeste Änderungsfolge nach Myers (1986), ohne Fremdpaket.
// ================================================================================================
//
// Gebraucht vom historischen Umzugsnachweis W1
// (`tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`,
// `spaetereAenderungen` in `./woerterbuchquelle.ts`): er muss jede Abweichung des heutigen
// Wörterbuchs vom Bezugspunkt EINZELN sehen, um sie einem belegten späteren Auftrag zuzuordnen.
// Ein „ist gleich / ist nicht gleich" genügt dafür nicht.
//
// Ergebnis: die Abschnitte, in denen sich die Texte unterscheiden — je Abschnitt die Zeilen von
// vorher und von nachher samt Startzeile (0-basiert). Gleiche Zeilen dazwischen sind nicht
// aufgeführt. Gemeinsamer Anfang und gemeinsames Ende werden vorab abgeschnitten; die Suche läuft
// nur über den Rest. Die Spur ist auf `MAX_AENDERUNGEN` begrenzt — darüber bricht der Vergleich laut
// ab, statt den Speicher zu füllen (dann ist der Bezugspunkt ohnehin nicht mehr derselbe Text).

export interface Abschnitt {
  /** Erste Zeile des Abschnitts im Text VORHER (0-basiert). */
  readonly vorherAb: number;
  readonly vorher: readonly string[];
  /** Erste Zeile des Abschnitts im Text NACHHER (0-basiert). */
  readonly nachherAb: number;
  readonly nachher: readonly string[];
}

export const MAX_AENDERUNGEN = 20_000;

/** Die Abschnitte, in denen sich `vorher` und `nachher` zeilenweise unterscheiden. */
export function zeilenVergleich(
  vorher: readonly string[],
  nachher: readonly string[],
): Abschnitt[] {
  let anfang = 0;
  while (anfang < vorher.length && anfang < nachher.length && vorher[anfang] === nachher[anfang]) {
    anfang += 1;
  }
  let endeA = vorher.length;
  let endeB = nachher.length;
  while (endeA > anfang && endeB > anfang && vorher[endeA - 1] === nachher[endeB - 1]) {
    endeA -= 1;
    endeB -= 1;
  }
  const n = endeA - anfang;
  const m = endeB - anfang;
  const a = (i: number): string | undefined => vorher[anfang + i];
  const b = (j: number): string | undefined => nachher[anfang + j];

  // Vorwärtssuche: v[k] = weitestes x auf Diagonale k nach d Schritten. Je Schritt wird nur der
  // benutzte Bereich k ∈ [−d, d] gesichert — die Spur wächst mit d², nicht mit (n + m)·d.
  const versatz = n + m + 1;
  const v = new Int32Array(2 * versatz + 1);
  const spur: Int32Array[] = [];
  let gefunden = -1;
  for (let d = 0; d <= n + m; d += 1) {
    if (d > MAX_AENDERUNGEN) {
      throw new Error(
        `zeilenVergleich: mehr als ${MAX_AENDERUNGEN} Änderungen — die Texte sind nicht mehr vergleichbar`,
      );
    }
    for (let k = -d; k <= d; k += 2) {
      const links = v[versatz + k - 1] ?? 0;
      const rechts = v[versatz + k + 1] ?? 0;
      let x = k === -d || (k !== d && links < rechts) ? rechts : links + 1;
      let y = x - k;
      while (x < n && y < m && a(x) === b(y)) {
        x += 1;
        y += 1;
      }
      v[versatz + k] = x;
      if (x >= n && y >= m) {
        gefunden = d;
        break;
      }
    }
    spur.push(v.slice(versatz - d, versatz + d + 1));
    if (gefunden >= 0) {
      break;
    }
  }

  // Rückweg: die Paare gleicher Zeilen, von hinten nach vorn.
  const gleich: [number, number][] = [];
  let x = n;
  let y = m;
  for (let d = gefunden; d > 0; d -= 1) {
    const davor = spur[d - 1] as Int32Array;
    const bei = (k: number): number => davor[k + (d - 1)] ?? 0;
    const k = x - y;
    const vonK = k === -d || (k !== d && bei(k - 1) < bei(k + 1)) ? k + 1 : k - 1;
    const vonX = bei(vonK);
    const vonY = vonX - vonK;
    while (x > vonX && y > vonY) {
      x -= 1;
      y -= 1;
      gleich.push([x, y]);
    }
    x = vonX;
    y = vonY;
  }
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    gleich.push([x, y]);
  }
  gleich.reverse();

  // Die Lücken zwischen gleichen Paaren sind die Abschnitte.
  const abschnitte: Abschnitt[] = [];
  let i = 0;
  let j = 0;
  for (const [gi, gj] of [...gleich, [n, m] as [number, number]]) {
    if (gi > i || gj > j) {
      abschnitte.push({
        vorherAb: anfang + i,
        vorher: vorher.slice(anfang + i, anfang + gi),
        nachherAb: anfang + j,
        nachher: nachher.slice(anfang + j, anfang + gj),
      });
    }
    i = gi + 1;
    j = gj + 1;
  }
  return abschnitte;
}
