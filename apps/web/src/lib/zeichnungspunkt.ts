// ================================================================================================
// PLAN-SPRACHANMERKUNG (R-1625, R-2177) — EINE NOTIZ AN EINER STELLE DER ZEICHNUNG.
// ================================================================================================
//
// Die Rückfrage an ein Bild (`lib/stellenbezug.ts`, Art `bild`) trägt optional eine POSITION im
// Bild: wer einen Plan liest, tippt auf die Stelle und spricht oder schreibt seine Notiz dazu.
//
// DIE POSITION IST RELATIV (0..1 je Achse), nicht in Pixeln: dieselbe Zeichnung steht auf dem
// Telefon schmaler als am Bildschirm, und die Marke muss auf beiden an derselben Stelle sitzen.
// Gespeichert wird auf vier Nachkommastellen — dieselbe Normalform wie `lesePunkt` im Dienst
// (`services/knowledge-object/src/stellen-anker.ts`), sonst wäre die Wiederholung derselben
// Absendung beim Dienst eine andere.
//
// WAS DIESE DATEI NICHT TUT: das Bild wiederfinden. Das bleibt beim Anker (`data-image-id`) und
// bei `stelleZuordnen`; die Position reist unverändert mit und wird nie umgerechnet.
import type { KoDiskussionsStelle } from "../api/endpoints";
import { sanitizeHtml } from "./richText";

export type Zeichnungspunkt = NonNullable<KoDiskussionsStelle["punkt"]>;

const STELLEN = 10_000;

const rund = (w: number): number => Math.round(Math.min(1, Math.max(0, w)) * STELLEN) / STELLEN;

/**
 * Die Position eines Tipps auf dem gezeichneten Bild. `null`, wenn das Bild keine Fläche hat
 * (noch nicht geladen) — dann gibt es keinen Ort, der sich ehrlich angeben liesse.
 */
export function punktAusTipp(
  flaeche: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): Zeichnungspunkt | null {
  if (!(flaeche.width > 0) || !(flaeche.height > 0)) {
    return null;
  }
  return {
    x: rund((clientX - flaeche.left) / flaeche.width),
    y: rund((clientY - flaeche.top) / flaeche.height),
  };
}

/** Die Position, mit der Tastatur um `schritt` verschoben — am Rand bleibt sie stehen. */
export function punktVerschieben(p: Zeichnungspunkt, dx: number, dy: number): Zeichnungspunkt {
  return { x: rund(p.x + dx), y: rund(p.y + dy) };
}

/** Ganze Prozent für die Anzeige („32 % von links"). */
export function punktProzent(p: Zeichnungspunkt): { x: number; y: number } {
  return { x: Math.round(p.x * 100), y: Math.round(p.y * 100) };
}

/**
 * Die Bildquelle zum Anker `data-image-id` in DIESER Fassung — oder `undefined`, wenn das Bild
 * dort nicht (genau einmal) steht. Gelesen wird derselbe gesäuberte Inhalt, den die Lesefläche
 * zeigt (`SanitizedHtml`): die Zeichnung erscheint hier mit keiner anderen Quelle als dort.
 */
export function bildQuelle(
  bodyHtml: string | null | undefined,
  kennung: string,
): string | undefined {
  const html = bodyHtml ?? "";
  if (html.trim().length === 0 || kennung.length === 0 || typeof DOMParser === "undefined") {
    return undefined;
  }
  // DOMParser führt nichts aus und lädt nichts nach — der Inhalt wird hier nur gelesen.
  const dokument = new DOMParser().parseFromString(sanitizeHtml(html), "text/html");
  const treffer = Array.from(dokument.querySelectorAll("img[data-image-id]")).filter(
    (img) => img.getAttribute("data-image-id") === kennung,
  );
  const [einziges] = treffer;
  if (treffer.length !== 1 || !einziges) {
    return undefined;
  }
  const src = einziges.getAttribute("src") ?? "";
  return src.length > 0 ? src : undefined;
}
