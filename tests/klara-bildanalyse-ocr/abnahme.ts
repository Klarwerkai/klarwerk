// OCR-04 · Der Abnahmeprüfer für Bildbefunde — EIN Maßstab für Unit- und Browserproben.
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-hostpruefung (OCR-04), K2/K3. Er vergleicht, was
// über eine Quelle bekannt ist (SOLL: jedes Bild mit Fundstelle und bekanntem Text), mit dem, was
// das automatische Lesen geliefert hat (IST), und benennt jeden Mangel einzeln:
//
//   · auslassung          ein Bild der Quelle fehlt im Befund
//   · falsche-fundstelle  der Text eines Bildes steht unter einer anderen Fundstelle
//   · fehlender-text      ein bekannter Begriff (Zahl, Wort mit Umlaut) ist nicht erkannt
//   · fremder-text        im Befund steht der Text eines ANDEREN Bildes derselben Quelle
//   · veraltet            im Befund steht noch der Text eines früheren Bildstands
//   · ueberzaehlig        ein Befund unter einer Fundstelle, die es in der Quelle nicht gibt
//
// Dass der Prüfer diese Mängel tatsächlich erkennt, belegen die Gegenproben in
// `ocr04-abnahme.test.ts` — ein Prüfer, der nichts findet, wäre sonst nicht von einem zu
// unterscheiden, der nichts sucht. DOM-frei und ohne Testlaufzeit; diese Datei ist kein Test.

export interface SollBild {
  /** Fundstelle im Wortlaut der Oberfläche, z. B. „Folie 2, Bild 1“ oder „Bild 1“. */
  ort: string;
  /** Begriffe, die im erkannten Text stehen müssen — wörtlich, mit Zahlen und Umlauten. */
  begriffe: readonly string[];
  /** Begriffe eines FRÜHEREN Stands dieses Bildes; stehen sie noch im Befund, ist er veraltet. */
  frueher?: readonly string[];
}

export interface IstBild {
  ort: string;
  /** Der angezeigte Text, gegebenenfalls mit Kennzeichnung (`[?wort]`, `[unleserlich]`). */
  text: string;
}

export type Mangel =
  | { art: "auslassung"; ort: string }
  | { art: "falsche-fundstelle"; ort: string; gefundenBei: string }
  | { art: "fehlender-text"; ort: string; begriff: string }
  | { art: "fremder-text"; ort: string; begriff: string; gehoertZu: string }
  | { art: "veraltet"; ort: string; begriff: string }
  | { art: "ueberzaehlig"; ort: string };

/** Unsichere Wörter zählen als gelesen (`[?Größe]` → `Größe`); unleserliche bleiben draußen. */
export function ohneUnsicherheitsmarke(text: string): string {
  return text.replace(/\[\?([^\]]*)\]/g, "$1");
}

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Steht der Begriff als eigenes Wort im Text? Groß/klein egal, Umlaute und Zahlen genau. */
export function enthaeltBegriff(text: string, begriff: string): boolean {
  const muster = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(begriff)}(?![\\p{L}\\p{N}])`, "iu");
  return muster.test(ohneUnsicherheitsmarke(text).replace(/\s+/g, " "));
}

export function pruefeBefunde(soll: readonly SollBild[], ist: readonly IstBild[]): Mangel[] {
  const maengel: Mangel[] = [];
  const nachOrt = new Map(ist.map((b) => [b.ort, b] as const));
  for (const s of soll) {
    const befund = nachOrt.get(s.ort);
    const vollstaendigIn = (b: IstBild) => s.begriffe.every((w) => enthaeltBegriff(b.text, w));
    if (!befund) {
      const anderswo = ist.find((b) => b.ort !== s.ort && vollstaendigIn(b));
      maengel.push(
        anderswo
          ? { art: "falsche-fundstelle", ort: s.ort, gefundenBei: anderswo.ort }
          : { art: "auslassung", ort: s.ort },
      );
      continue;
    }
    if (!vollstaendigIn(befund)) {
      const anderswo = ist.find((b) => b.ort !== s.ort && vollstaendigIn(b));
      if (anderswo) {
        maengel.push({ art: "falsche-fundstelle", ort: s.ort, gefundenBei: anderswo.ort });
      } else {
        for (const begriff of s.begriffe.filter((w) => !enthaeltBegriff(befund.text, w))) {
          maengel.push({ art: "fehlender-text", ort: s.ort, begriff });
        }
      }
    }
    const eigene = new Set(s.begriffe.map((w) => w.toLowerCase()));
    for (const andere of soll) {
      if (andere === s) {
        continue;
      }
      for (const begriff of andere.begriffe) {
        if (!eigene.has(begriff.toLowerCase()) && enthaeltBegriff(befund.text, begriff)) {
          maengel.push({ art: "fremder-text", ort: s.ort, begriff, gehoertZu: andere.ort });
        }
      }
    }
    for (const begriff of s.frueher ?? []) {
      if (!eigene.has(begriff.toLowerCase()) && enthaeltBegriff(befund.text, begriff)) {
        maengel.push({ art: "veraltet", ort: s.ort, begriff });
      }
    }
  }
  const bekannt = new Set(soll.map((s) => s.ort));
  for (const b of ist) {
    if (!bekannt.has(b.ort)) {
      maengel.push({ art: "ueberzaehlig", ort: b.ort });
    }
  }
  return maengel;
}

const WORT = /[\p{L}\p{N}]+/gu;

/**
 * Für schwierige Vorlagen (gedreht, schwacher Kontrast): die Wörter, die UNGEKENNZEICHNET im Text
 * stehen, aber in der Vorlage nicht vorkommen — also erfunden bzw. falsch und nicht als unsicher
 * markiert. Gekennzeichnete Stellen (`[?…]`, `[unleserlich]`) zählen nicht: sie sind ehrlich.
 */
export function erfundeneWoerter(text: string, vorlage: readonly string[]): string[] {
  const bekannt = new Set(vorlage.flatMap((z) => z.toLowerCase().match(WORT) ?? []));
  const ungekennzeichnet = text.replace(/\[[^\]]*\]/g, " ");
  return (ungekennzeichnet.toLowerCase().match(WORT) ?? []).filter((w) => !bekannt.has(w));
}

/** Für das Protokoll: welche Begriffe gefunden sind, welche fehlen, wie viele Stellen markiert. */
export function genauigkeit(
  begriffe: readonly string[],
  text: string,
): { gefunden: string[]; fehlend: string[]; markiert: number } {
  return {
    gefunden: begriffe.filter((w) => enthaeltBegriff(text, w)),
    fehlend: begriffe.filter((w) => !enthaeltBegriff(text, w)),
    markiert: (text.match(/\[(\?[^\]]*|unleserlich)\]/g) ?? []).length,
  };
}
