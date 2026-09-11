// ================================================================================================
// JOB 3571 · LIEFERUNG 1 — DAS MESSWERKZEUG DER KOPFBANDZEILE STEHT EINMAL, NICHT ZWEIMAL.
// ================================================================================================
//
// Bis hierher wohnte die ganze Messung in `kopfband-schmal-chromium.test.ts` (JOB 3525). JOB 3571
// misst DIESELBE Zeile ein zweites Mal — nur mit eingeschalteter Firmen-CI. Eine Kopie des
// Messcodes wäre die naheliegende und die falsche Antwort: zwei Kästenlisten, zwei Umbruchregeln,
// zwei Toleranzen, und beim nächsten Umbau der Hülle wird eine davon nachgeführt und die andere
// nicht. Genau so entstehen zwei Wahrheiten über dieselbe Zeile.
//
// DESHALB WANDERT DER MESSCODE HIERHER und wird von beiden Dateien importiert. Was NICHT mitwandert,
// ist die ZUSAGE: welche Breiten streng gelten und unter welcher Kennung gemessen wird, entscheidet
// die jeweilige Datei, denn das ist die Zusage ihres Jobs. `pruefeZeile` bekommt beides deshalb als
// Argument, statt es sich aus einer hier gepflegten Menge zu nehmen.
//
// Diese Datei enthält selbst KEINEN Testfall — sie ist Werkzeug, keine Aussage. Und sie startet
// keinen Browser: sie reitet auf `tests/design/h6-chromium.ts`, dem gemeinsamen Prüfstand. Über
// dessen Importhülle ordnet sich jede Datei, die dieses Werkzeug benutzt, von selbst in die
// serielle Browser-Gruppe ein (`tests/tor-inventar/browser-gruppe.ts`).
import { expect } from "vitest";
import { type BrowserFn, type Seite, type Stand, fn, wechsle } from "../design/h6-chromium";

/** Die Bühne reicht die rohe Playwright-Seite durch — nur so lässt sich die Breite verstellen. */
export interface SeiteMitViewport {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}

export interface Kasten {
  name: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  text: string;
}

export interface Messung {
  bandHoehe: number;
  bandOben: number;
  bandUnten: number;
  scrollBreite: number;
  clientBreite: number;
  fensterBreite: number;
  kaesten: Kasten[];
  punkte: string[];
  menueText: string;
  geheZuText: string;
  entwuerfeText: string;
}

// In der Seite: jedes Bedienelement des Kopfbands mit seiner tatsächlichen Lage. Die Auswahl ist
// bewusst die der SICHTBAREN Griffe — Logo, Menü-Knopf, jeder Punkt, „Gehe zu …", Suche, Zahnrad,
// Konto. Was der Browser nicht zeichnet (`offsetParent === null`), fällt heraus statt als
// Nullkasten alles zu überlappen.
//
// `marke` ist dabei der Kasten, der die Firmen-CI von selbst mitträgt: das Firmenlogo hängt
// INNERHALB von `.kw-kopfband-marke` (`shell/Logo.tsx`), die Marke wächst also im vorhandenen
// Raster mit. Für JOB 3571 braucht es deshalb kein zweites Raster, nur einen zweiten Lauf.
export const MESSUNG = fn(`() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const br = band.getBoundingClientRect();
  const sel = [
    ['menue', '[data-testid="kopfband-menue"]'],
    ['marke', '.kw-kopfband-marke'],
    ['gehezu', '[data-testid="kopfband-gehezu"]'],
    ['suche', '.kw-kopfband-suche'],
    ['zahnrad', '[data-testid="kopfband-zahnrad"]'],
    ['konto', '[data-testid="kopfband-konto"]'],
  ];
  const kaesten = [];
  for (const [name, s] of sel) {
    const el = band.querySelector(s);
    if (!el || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    kaesten.push({ name, links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, text: (el.innerText || '').trim() });
  }
  for (const a of band.querySelectorAll('[data-kopfband-punkt]')) {
    if (a.offsetParent === null) continue;
    const r = a.getBoundingClientRect();
    kaesten.push({ name: 'punkt:' + a.getAttribute('data-kopfband-punkt'), links: r.left, rechts: r.right, oben: r.top, unten: r.bottom, text: (a.innerText || '').trim() });
  }
  const menue = band.querySelector('[data-testid="kopfband-menue"]');
  const gehezu = band.querySelector('[data-testid="kopfband-gehezu"]');
  const entwuerfe = band.querySelector('[data-kopfband-punkt="entwuerfe"]');
  return {
    bandHoehe: br.height,
    bandOben: br.top,
    bandUnten: br.bottom,
    scrollBreite: band.scrollWidth,
    clientBreite: band.clientWidth,
    fensterBreite: window.innerWidth,
    kaesten,
    punkte: [...band.querySelectorAll('[data-kopfband-punkt]')].map((a) => a.getAttribute('data-kopfband-punkt')),
    menueText: menue ? (menue.innerText || '').trim() : '',
    geheZuText: gehezu ? (gehezu.innerText || '').trim() : '',
    entwuerfeText: entwuerfe ? (entwuerfe.innerText || '').trim() : '',
  };
}`);

export function seiteRoh(stand: Stand): Seite & SeiteMitViewport {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport;
}

/**
 * Ein zusätzlicher Beweis, dass die Seite für die Messung wirklich fertig ist.
 *
 * JOB 3525 brauchte ihn nicht: sein Kopfband steht, sobald der `<header>` da ist. JOB 3571 misst
 * das Firmenlogo, und das kommt erst mit der Antwort von `/api/branding` und dem geladenen Bild —
 * eine Messung davor läse die Breite der Zeile OHNE CI und nennte sie „mit CI". Wer nichts
 * übergibt, misst wie bisher.
 */
export interface Bereitschaft {
  pruefung: BrowserFn;
  was: string;
}

/** Die Seite auf `breite` stellen, `/start` neu aufbauen und messen. */
export async function messe(
  stand: Stand,
  breite: number,
  hoehe: number,
  bereit?: Bereitschaft,
): Promise<Messung> {
  const seite = seiteRoh(stand);
  await seite.setViewportSize({ width: breite, height: hoehe });
  await wechsle(stand, "/start", 'header[data-testid="kopfband"]');
  expect(stand.fehler, `die Seite kam bei ${breite}px nicht hoch`).toBeNull();
  if (bereit) {
    try {
      await seite.waitForFunction(bereit.pruefung, undefined, { timeout: 30_000 });
    } catch (e) {
      throw new Error(`bei ${breite}px kam die Voraussetzung nicht: ${bereit.was} — ${String(e)}`);
    }
  }
  const m = await seite.evaluate<Messung | null>(MESSUNG);
  expect(m, `bei ${breite}px steht kein Kopfband`).not.toBeNull();
  if (m === null) {
    throw new Error("unerreichbar");
  }
  return m;
}

/**
 * Der grösste freie Zwischenraum der Zeile, abzüglich der Fuge, die dort ohnehin steht.
 *
 * WOZU: Die Zeile schiebt ihre rechte Gruppe mit `ml-auto` an den Rand. Alles, was übrig ist,
 * sammelt sich deshalb in GENAU EINER Lücke — der vor der rechten Gruppe. Diese Zahl sagt also, wie
 * viel Luft eine Breite wirklich noch hat, und sie ist die einzige, die das sagen kann:
 * `scrollWidth === clientWidth` heisst nur „es passt", nicht „um wie viel".
 *
 * `fuge` ist der Spaltenabstand, der an dieser Stelle zum Bau gehört und keine Reserve ist
 * (schmal 20 px, `shell/Kopfband.tsx`).
 */
export function freierRaum(m: Messung, fuge: number): number {
  const sortiert = [...m.kaesten].sort((a, b) => a.links - b.links);
  let groesste = 0;
  for (let i = 1; i < sortiert.length; i++) {
    const vor = sortiert[i - 1];
    const nach = sortiert[i];
    if (!vor || !nach) {
      continue;
    }
    groesste = Math.max(groesste, nach.links - vor.rechts);
  }
  return groesste - fuge;
}

/**
 * WELCHE DER DREI ENGEN ACHSEN AN DIESER BREITE ZUGESICHERT WERDEN.
 *
 * Bis JOB 3571 war das EIN Schalter („streng" ja/nein), weil es genau zwei Lagen gab: die Breiten,
 * die JOB 3525 baut, und die eine, die dem Bestand von JOB 3060 gehört. JOB 3571 hat mit aktiver
 * Firmen-CI eine DRITTE Lage gemessen, und sie ist der Grund für die Auftrennung: bei 390 px trägt
 * die Zeile die Breite des Firmenlogos nicht mehr — `scrollWidth` übersteigt `clientWidth`, und der
 * rechteste Kasten (Konto-Kreis) steht rund 20 px ausserhalb des Fensters (gemessen in
 * `kopfband-ci-chromium.test.ts`, Fall CI5). Was dort WEITERHIN hält, ist alles andere: die Zeile
 * ist 56 px hoch, nichts bricht um, nichts überlappt. Ein einziger Schalter hätte mit den zwei
 * gefallenen Aussagen auch diese dritte fallen lassen — und „zu breit" und „die Elemente schneiden
 * einander" sind für einen Menschen zwei verschiedene Fehler. Die schwächeren Aussagen stehen jetzt
 * genau an ihrer Achse; die übrigen beissen weiter.
 */
export interface Zusage {
  /** L3 — kein Überlauf: `scrollWidth` übersteigt `clientWidth` nicht. */
  ueberlauf: boolean;
  /** Jedes Element steht im Fenster, nichts ist links oder rechts angeschnitten. */
  fenster: boolean;
  /** L4 — nichts überlappt. */
  ueberlappung: boolean;
  /** Steht im Lauf hinter der Zahl, sobald eine Achse NICHT zugesichert ist. */
  grund?: string;
}

/** Die Zusage der Breiten, die ein Auftrag wirklich baut. */
export const STRENG_ALLES: Zusage = { ueberlauf: true, fenster: true, ueberlappung: true };

/** Gemessen und ausgegeben, aber nichts davon zugesichert. */
export function nurGemessen(grund: string): Zusage {
  return { ueberlauf: false, fenster: false, ueberlappung: false, grund };
}

/**
 * L1–L4 in einem Stück: die vier Aussagen gehören zusammen, sie beschreiben EINE Zeile.
 *
 * `zusage` und `kennung` kommen von aussen — welche Breite was zusichert und unter welcher Kennung
 * die Zahl im Lauf steht, ist die Entscheidung des messenden Jobs, nicht die des Werkzeugs.
 */
export function pruefeZeile(m: Messung, breite: number, zusage: Zusage, kennung: string): void {
  // L1 — die Höhe des Mockups, unverändert.
  expect(m.bandHoehe, `${breite}px: die Kopfbandhöhe ist nicht 56 px`).toBeCloseTo(56, 1);
  expect(m.kaesten.length, `${breite}px: es wurde nichts gemessen`).toBeGreaterThan(2);
  // L3 — nichts läuft seitlich heraus. 1 px Toleranz für die Teilpixel des Browsers.
  const zusatz = zusage.ueberlauf ? "" : ` (Überlauf nicht zugesichert: ${zusage.grund ?? "—"})`;
  console.log(
    `${kennung} · ${breite}px · Kopfband scrollWidth ${m.scrollBreite} / clientWidth ${m.clientBreite}${zusatz}`,
  );
  if (zusage.ueberlauf) {
    expect(
      m.scrollBreite,
      `${breite}px: das Kopfband läuft über (${m.scrollBreite} > ${m.clientBreite})`,
    ).toBeLessThanOrEqual(m.clientBreite + 1);
  }
  for (const k of m.kaesten) {
    // L2 — jedes Element liegt IN der Zeile; ein Umbruch schöbe es unter `bandUnten`.
    expect(k.oben, `${breite}px: „${k.name}“ steht über dem Kopfband`).toBeGreaterThanOrEqual(
      m.bandOben - 1,
    );
    expect(
      k.unten,
      `${breite}px: „${k.name}“ ragt unter das Kopfband — die Zeile ist umgebrochen`,
    ).toBeLessThanOrEqual(m.bandUnten + 1);
    if (!zusage.fenster) {
      continue;
    }
    // Und es steht im Fenster, nicht daneben.
    expect(k.links, `${breite}px: „${k.name}“ steht links ausserhalb`).toBeGreaterThanOrEqual(-1);
    expect(k.rechts, `${breite}px: „${k.name}“ ist rechts angeschnitten`).toBeLessThanOrEqual(
      m.fensterBreite + 1,
    );
  }
  if (!zusage.ueberlappung) {
    return;
  }
  // L4 — nichts überlappt: nach links sortiert folgt jedes Element auf das vorige.
  const sortiert = [...m.kaesten].sort((a, b) => a.links - b.links);
  for (let i = 1; i < sortiert.length; i++) {
    const vor = sortiert[i - 1];
    const nach = sortiert[i];
    if (!vor || !nach) {
      continue;
    }
    expect(
      nach.links,
      `${breite}px: „${nach.name}“ überlappt „${vor.name}“ (${nach.links} < ${vor.rechts})`,
    ).toBeGreaterThanOrEqual(vor.rechts - 1);
  }
}
