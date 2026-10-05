// ================================================================================================
// AUFNAHME 20260922 · DOKUMENT-POINTER-BEDIENUNG — DER ECHTE ZEIGER AN DER GLIEDERUNG, EINMAL HIER.
// ================================================================================================
//
// DER ANLASS ist der 4145-C2-Hinweis: C2 hieß „derselbe Weg mit der Maus", rief aber
// `knopf.click()` in der Seite. Das ist ein synthetisches DOM-Ereignis (`isTrusted: false`); es
// erreicht den Knopf auch dann, wenn ein Mensch ihn nie treffen könnte — unter einem Überzug,
// ausserhalb des Fensters, weggeschnitten von der rollenden Leiste (`max-h-40 overflow-y-auto`).
//
// DESHALB ZWEI SCHRITTE, und beide in der Seite gemessen:
//   1. GRIFF: Rechteck des Knopfs, Mittelpunkt im Fenster, und `elementFromPoint` an genau diesem
//      Punkt. Nur wenn dort der Knopf (oder sein Inhalt) OBENAUF liegt, gilt er als bedienbar. Das
//      Rechteck allein sagt das nicht — ein durchsichtiger Überzug hat keine Farbe, aber er fängt
//      den Zeiger (Gegenprobe in `gliederung-mit-zeiger-chromium.test.ts`).
//   2. KLICK: `seite.mouse.click(x, y)` an diesem Punkt — ein echter Zeigerklick von Chromium, der
//      durch den Treffertest des Browsers läuft. Das Protokoll hält fest, dass `pointerdown` und
//      `click` vertrauenswürdig waren und am Knopf ankamen.
//
// GEBAUT AUS DEN HAUSFORMEN: Treffertest wie `ki-palette-fingertipp-chromium.test.ts` (TREFFER),
// Zeigerklick wie `review26-pruefen-schmal/pruefen-schmal-chromium.test.ts`. Kein Nachbau der
// Vorrichtung: `Seite` und `fn` kommen aus `tests/design/h4-harness.ts`.
import { type Seite, fn } from "../design/h4-harness";

/**
 * BENs verschachteltes Gegenbeispiel (JOB 4145 R2), auf mehrere Bildschirmhöhen gestreckt.
 *
 * `<h2>Eins<strong><h2>Zwei</h2></strong></h2>` bleibt nach Server-Sanitizer UND Chromium-Parser
 * verschachtelt stehen — im Baum liegen also Überschriften ÜBEREINANDER. Die Länge ist kein
 * Beiwerk: ohne sie läge „Drei" schon im Bild, und ein Sprung müsste nichts bewirken.
 */
export const VERSCHACHTELT_LANG = [
  "<h2>Eins<strong><h2>Zwei</h2></strong></h2>",
  "<p>Halterungen und Profile sind ohne waagerechte Oberseiten auszuführen. Offene, ablaufende Profile sind zu bevorzugen, damit Flüssigkeit nicht stehen bleibt.</p>".repeat(
    40,
  ),
  "<h2>Drei</h2>",
  "<p>Vollverschweißte Hohlprofile sind in Lebensmittel- und Spritzzonen zu vermeiden, weil ihre Dichtheit langfristig nicht garantiert werden kann.</p>".repeat(
    40,
  ),
].join("");

/** Was der Treffertest an einem Gliederungsknopf gefunden hat. */
export interface Griff {
  bedienbar: boolean;
  /** Leer, wenn bedienbar; sonst der erste Grund, an dem es scheiterte. */
  grund: string;
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  fensterBreite: number;
  fensterHoehe: number;
  /** Was `elementFromPoint` am Mittelpunkt liefert — lesbar, für die Befundmeldung. */
  getroffen: string;
}

/**
 * In der Seite: ist der Gliederungsknopf mit dieser Beschriftung für einen Zeiger erreichbar?
 *
 * Die Reihenfolge der Gründe ist die Reihenfolge, in der ein Mensch scheitert: es gibt ihn nicht,
 * er hat keine Fläche, er liegt nicht im Fenster, oder etwas anderes liegt obenauf (Überzug,
 * Nachbar, der Rand der rollenden Leiste, `pointer-events: none`). Ein Treffer auf einem
 * NACHKOMMEN des Knopfs zählt — der Einrückungs-`span` der Unterpunkte steht in ihm.
 */
const GRIFF = `(text) => {
  const name = (el) => el
    ? el.tagName + (el.getAttribute('data-testid') ? '#' + el.getAttribute('data-testid') : '') +
      ' „' + (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + '“'
    : '(nichts)';
  const leer = { bedienbar: false, x: 0, y: 0, breite: 0, hoehe: 0,
    fensterBreite: window.innerWidth, fensterHoehe: window.innerHeight, getroffen: '' };
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  if (!leiste) { return Object.assign({}, leer, { grund: 'keine Gliederung im Baum' }); }
  const knopf = [].slice.call(leiste.querySelectorAll('button'))
    .find((b) => (b.textContent || '').trim() === text);
  if (!knopf) { return Object.assign({}, leer, { grund: 'kein Knopf „' + text + '“' }); }
  const r = knopf.getBoundingClientRect();
  const lage = Object.assign({}, leer, {
    x: r.left + r.width / 2, y: r.top + r.height / 2, breite: r.width, hoehe: r.height,
  });
  if (r.width < 1 || r.height < 1) { return Object.assign(lage, { grund: 'ohne Fläche' }); }
  if (lage.x < 0 || lage.y < 0 || lage.x >= window.innerWidth || lage.y >= window.innerHeight) {
    return Object.assign(lage, { grund: 'Mittelpunkt ausserhalb des Fensters' });
  }
  const g = document.elementFromPoint(lage.x, lage.y);
  if (!g || !knopf.contains(g)) {
    return Object.assign(lage, { grund: 'überdeckt', getroffen: name(g) });
  }
  return Object.assign(lage, { bedienbar: true, grund: '', getroffen: name(g) });
}`;

/** Den Griff eines Gliederungsknopfs messen, ohne ihn zu bedienen. */
export async function griffMessen(seite: Seite, text: string): Promise<Griff> {
  return (await seite.evaluate<Griff>(fn(GRIFF), text)) as Griff;
}

/** Ein Zeigerereignis, wie es an der Seite ankam. */
export interface Zeigerereignis {
  art: string;
  /** `isTrusted` — `false` hiesse: synthetisch, kein echter Zeiger. */
  echt: boolean;
  zeigerart: string | null;
  /**
   * Die Beschriftung des Knopfs, in dem das Ereignis ankam (Text, sonst `aria-label`); leer
   * ausserhalb eines Knopfs.
   */
  knopf: string;
}

/**
 * In der Seite: ein Protokoll der Zeigerereignisse, in der Einfangphase am Dokument. Einmal je
 * geladener Seite; ein zweiter Aufruf leert es nur. Die Seite selbst wird nicht verändert — das
 * Protokoll lebt in dieser laufenden Seite, nicht im Produkt.
 */
const PROTOKOLL_STARTEN = `() => {
  if (!window.__kwZeiger) {
    window.__kwZeiger = [];
    const merken = (e) => {
      const t = e.target && e.target.closest ? e.target.closest('button') : null;
      window.__kwZeiger.push({
        art: e.type,
        echt: e.isTrusted,
        zeigerart: typeof e.pointerType === 'string' ? e.pointerType : null,
        knopf: t ? ((t.textContent || '').trim() || t.getAttribute('aria-label') || '') : '',
      });
    };
    document.addEventListener('pointerdown', merken, true);
    document.addEventListener('click', merken, true);
  }
  window.__kwZeiger.length = 0;
}`;

/**
 * Den Gliederungsknopf mit dieser Beschriftung mit dem ECHTEN Zeiger treffen.
 *
 * Scheitert der Griff, wird NICHT geklickt, sondern mit dem Befund abgebrochen — ein Klick an
 * einen Punkt, an dem der Knopf nicht obenauf liegt, wäre eine Aussage über etwas anderes.
 */
export async function zeigerKlick(
  seite: Seite,
  text: string,
): Promise<{ griff: Griff; ereignisse: Zeigerereignis[] }> {
  await zeigerProtokollStarten(seite);
  const griff = await griffMessen(seite, text);
  if (!griff.bedienbar) {
    throw new Error(`Gliederungsknopf „${text}“ nicht bedienbar: ${JSON.stringify(griff)}`);
  }
  // `mouse.click` rollt NICHT vor (anders als `locator.click`) — geklickt wird genau dort, wo der
  // Treffertest eben den Knopf obenauf gefunden hat.
  await seite.mouse.click(griff.x, griff.y);
  const ereignisse = await zeigerProtokoll(seite);
  return { griff, ereignisse };
}

/** Das Zeigerprotokoll dieser Seite anlegen oder leeren. */
export async function zeigerProtokollStarten(seite: Seite): Promise<void> {
  await seite.evaluate(fn(PROTOKOLL_STARTEN));
}

/** Das Protokoll seit dem letzten Start lesen. */
export async function zeigerProtokoll(seite: Seite): Promise<Zeigerereignis[]> {
  return (await seite.evaluate<Zeigerereignis[]>(
    fn("() => (window.__kwZeiger || []).slice()"),
  )) as Zeigerereignis[];
}

/** Die Wartebedingung „der Fokus steht auf der DRITTEN Überschrift des Lesetexts". */
export const FOKUS_AUF_DRITTER = fn(
  `() => { const f = document.querySelector('[data-testid="bib-text"]'); if (!f) return false; const u = f.querySelectorAll('h1, h2, h3, h4, h5, h6'); return !!u[2] && document.activeElement === u[2]; }`,
);
