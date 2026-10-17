// DOM-freier OCR-Adapter (SCRUM-123).
// Recognizer wird injiziert → in Node mit Stub testbar, kein tesseract-Import hier.
// Die echte tesseract.js-Engine (lazy, Worker/WASM) wird im Browser-Wrapper `files.ts` gebaut.

export type OcrStatus = "running" | "success" | "failed" | "unavailable";

/** Ein erkanntes Wort mit der Sicherheit der Engine (0–100), wie tesseract.js 5 es liefert. */
export interface OcrWort {
  text: string;
  confidence: number;
  // OCR-02: der Rahmen des Wortes im Bild (Pixel) — Grundlage der Tabellenerkennung.
  bbox?: { x0: number; y0: number; x1: number; y1: number };
  // Basisreparatur 58→53: die Gegenlesung im Originalmaßstab las an dieser Stelle etwas anderes.
  // Das Wort gilt dann als unsicher, gleich wie hoch die Engine es selbst bewertet.
  abweichend?: true;
}

export interface OcrResult {
  status: OcrStatus;
  text: string;
  error?: string;
  // OCR-02 (Klara-Bildanalyse): die Wörter mit ihrer Sicherheit — Grundlage, um unsichere und
  // unleserliche Stellen zu kennzeichnen, statt sie still als gelesen auszugeben.
  woerter?: OcrWort[];
}

export interface OcrRecognizer {
  recognize(input: unknown): Promise<{ data: { text: string; words?: OcrWort[] } }>;
}

// ================================================================================================
// Basisreparatur (produkt:20261015:ocr-basis-erkannter-genauigkeitsfehler) — 58 → 53.
// ================================================================================================
//
// DER BEFUND (OCR-04, zwei Browserläufe): das klar lesbare Textbild „Schlüssel 58 / Füllstand 93“
// (fett 80 px, schwarz auf weiß) kam als „Schlüssel 53“ zurück — ohne Unsicherheitsmarke. In
// derselben Vorlagenform lasen „VENTIL 38“ (gedreht) und „LAGER 54“ (schwacher Kontrast) richtig.
//
// DIE URSACHE, wie sie sich aus Weg und Vorlage ergibt: die Schrift ist für die LSTM-Erkennung von
// Tesseract übergroß. Die Wortrahmen sind rund 60–70 px hoch, Großbuchstaben und Ziffern rund
// 57 px; trainiert und zuverlässig ist die Erkennung bei Großbuchstaben um 30 px. Bei solchen Größen
// entscheiden Zeilenzuschnitt und Herunterrechnen innerhalb der Engine über einzelne Zeichen (fette
// 8 mit kleinen Innenräumen ↔ 3). Und der Weg hatte keinen Abgleich: was die Engine einmal las,
// stand mit ihrer eigenen — hier hohen — Sicherheit im Befund.
//
// DIE KORREKTUR, im selben Weg und mit derselben Engine (keine zweite Erkennung, keine Ersetzung
// von Inhalten, kein Raten):
//   1. Liegt die Schrift deutlich über dem zuverlässigen Bereich (unteres Viertel der Wortrahmen
//      über OCR_GROSS_AB), wird das Bild auf OCR_ZIEL_WORTHOEHE verkleinert und noch einmal gelesen.
//      Diese Lesung ist der Befund; ihre Wortrahmen werden in den Originalmaßstab zurückgerechnet.
//   2. Die erste Lesung im Originalmaßstab bleibt Gegenlesung: Wo die beiden nicht übereinstimmen,
//      ist das Wort `abweichend` und wird als unsicher gekennzeichnet — eine instabile Zahl steht nie
//      mehr ungekennzeichnet im Befund. Findet die Nachlesung weniger Wörter, bleibt die erste
//      Lesung der Befund (mit derselben Kennzeichnung), damit keine Stelle verloren geht.
// Normal große Schrift (Bildschirmfotos, Dokumente) wird wie bisher genau einmal gelesen.

/** Höhe (px) der Wortrahmen im unteren Viertel, auf die übergroße Schrift verkleinert wird. */
export const OCR_ZIEL_WORTHOEHE = 32;
/** Ab dieser Höhe (px, unteres Viertel der Wortrahmen) gilt die Schrift als übergroß. */
export const OCR_GROSS_AB = 48;
/** Stärker wird nicht verkleinert — sonst gingen feine Teile des Bildes verloren. */
export const OCR_KLEINSTER_FAKTOR = 0.25;
/** Obergrenze (Wörter × Wörter) für den Abgleich über die längste gemeinsame Wortfolge. */
const OCR_ABGLEICH_HOECHSTENS = 4_000_000;

/**
 * Zeichnet das Bild im Maßstab `faktor` neu (Browser: Canvas) und liefert es als Eingabe für dieselbe
 * Engine — oder `null`, wenn das nicht möglich ist (dann bleibt es bei der ersten Lesung).
 */
export type OcrSkalierer = (input: unknown, faktor: number) => Promise<unknown | null>;

const HAT_ZEICHEN = /[\p{L}\p{N}]/u;

/** Verkleinerungsfaktor für übergroße Schrift, sonst `null` (Bild bleibt, wie es ist). */
export function verkleinerungsFaktor(woerter: readonly OcrWort[] | undefined): number | null {
  const hoehen = (woerter ?? [])
    .filter((w) => w.bbox !== undefined && HAT_ZEICHEN.test(w.text))
    .map((w) => (w.bbox ? w.bbox.y1 - w.bbox.y0 : 0))
    .filter((h) => h > 0)
    .sort((a, b) => a - b);
  if (hoehen.length === 0) {
    return null;
  }
  // Das untere Viertel, nicht der Median: kleinere Schrift im selben Bild soll durch das
  // Verkleinern nicht unter die Zielhöhe fallen.
  const unten = hoehen[Math.floor(hoehen.length / 4)] ?? 0;
  if (unten <= OCR_GROSS_AB) {
    return null;
  }
  return Math.max(OCR_KLEINSTER_FAKTOR, OCR_ZIEL_WORTHOEHE / unten);
}

const zeichenWoerter = (woerter: readonly OcrWort[]): number =>
  woerter.filter((w) => HAT_ZEICHEN.test(w.text)).length;

function wortListe(
  words: { text: string; confidence: number; bbox?: OcrWort["bbox"] }[] | undefined,
  faktor = 1,
): OcrWort[] {
  return (words ?? []).map((w) => ({
    text: w.text,
    confidence: w.confidence,
    ...(w.bbox
      ? {
          bbox: {
            x0: w.bbox.x0 / faktor,
            y0: w.bbox.y0 / faktor,
            x1: w.bbox.x1 / faktor,
            y1: w.bbox.y1 / faktor,
          },
        }
      : {}),
  }));
}

/**
 * Markiert in `lesung` jedes Wort, das in der `gegenlesung` nicht an entsprechender Stelle steht
 * (längste gemeinsame Wortfolge). Text und Sicherheiten bleiben, wie die Engine sie geliefert hat.
 */
export function gleicheLesungenAb(
  lesung: readonly OcrWort[],
  gegenlesung: readonly OcrWort[],
): OcrWort[] {
  const a = lesung.map((w) => w.text);
  const b = gegenlesung.map((w) => w.text);
  if (a.length * b.length > OCR_ABGLEICH_HOECHSTENS) {
    // Sehr viele Wörter: Stelle für Stelle statt der vollen Tabelle.
    return lesung.map<OcrWort>((w, n) =>
      w.text === b[n] || !HAT_ZEICHEN.test(w.text) ? w : { ...w, abweichend: true },
    );
  }
  const breite = b.length + 1;
  const tabelle = new Uint32Array((a.length + 1) * breite);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      tabelle[i * breite + j] =
        a[i] === b[j]
          ? (tabelle[(i + 1) * breite + j + 1] ?? 0) + 1
          : Math.max(tabelle[(i + 1) * breite + j] ?? 0, tabelle[i * breite + j + 1] ?? 0);
    }
  }
  const gleich = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      gleich.add(i);
      i += 1;
      j += 1;
    } else if ((tabelle[(i + 1) * breite + j] ?? 0) >= (tabelle[i * breite + j + 1] ?? 0)) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return lesung.map<OcrWort>((w, n) =>
    gleich.has(n) || !HAT_ZEICHEN.test(w.text) ? w : { ...w, abweichend: true },
  );
}

// SCRUM-123: Bild → Text. Kein Recognizer (Engine nicht ladbar) → ehrlich „unavailable".
// Fehler bei der Erkennung → „failed" (keine Fake-OCR). Erfolg → „success" + getrimmter Text.
// Basisreparatur 58→53: mit `skaliere` wird übergroße Schrift verkleinert nachgelesen (s. oben).
export async function recognizeImage(
  input: unknown,
  recognizer: OcrRecognizer | null,
  skaliere?: OcrSkalierer,
): Promise<OcrResult> {
  if (!recognizer) {
    return { status: "unavailable", text: "" };
  }
  try {
    const result = await recognizer.recognize(input);
    const woerter = wortListe(result.data.words);
    const erste: OcrResult = {
      status: "success",
      text: (result.data.text ?? "").trim(),
      ...(woerter.length > 0 ? { woerter } : {}),
    };
    const faktor = skaliere ? verkleinerungsFaktor(woerter) : null;
    if (!skaliere || faktor === null) {
      return erste;
    }
    const zweite = await skaliere(input, faktor)
      .then((verkleinert) => (verkleinert === null ? null : recognizer.recognize(verkleinert)))
      .catch(() => null);
    if (zweite === null) {
      // Nicht verkleinerbar oder Nachlesung gescheitert — dann gilt die erste Lesung.
      return erste;
    }
    const text = (zweite.data.text ?? "").trim();
    const zweiteWoerter = wortListe(zweite.data.words, faktor);
    if (text.length === 0 || zweiteWoerter.length === 0) {
      // Die Nachlesung fand nichts — dann gilt die erste Lesung.
      return erste;
    }
    if (zeichenWoerter(zweiteWoerter) < zeichenWoerter(woerter)) {
      // Die Nachlesung fand weniger: die erste Lesung bleibt der Befund, damit nichts verloren geht;
      // wo die Nachlesung anders las, ist sie markiert.
      return { ...erste, woerter: gleicheLesungenAb(woerter, zweiteWoerter) };
    }
    return { status: "success", text, woerter: gleicheLesungenAb(zweiteWoerter, woerter) };
  } catch (error) {
    return {
      status: "failed",
      text: "",
      error: error instanceof Error ? error.message : "ocr-error",
    };
  }
}
