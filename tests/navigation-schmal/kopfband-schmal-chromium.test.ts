// ================================================================================================
// JOB 3525 · LIEFERUNG 3 — „KEIN LAYOUTBRUCH" WIRD GEMESSEN, NICHT ERZÄHLT.
// ================================================================================================
//
// Die Schwesterdatei `kopfband-schmal.test.tsx` sagt, WAS im Baum steht. Sie kann nicht sagen, ob
// es PASST: jsdom hat keine Layout-Maschine, jede Pixelzahl daraus wäre erfunden — die Lehre aus
// JOB 3337 Runde 7, wo ein gemounteter Fall die ABSICHT (`scrollIntoView` wurde gerufen) für die
// WIRKUNG hielt und der Befund erst im Browser sichtbar wurde. Diese Datei misst deshalb die
// GEBAUTE Anwendung (`apps/web/dist`) in Chromium, an denselben Breiten, an denen der Auftrag seine
// Zusage macht.
//
// (Die Nachbardatei jenes Jobs unter `tests/design/` wird hier bewusst NICHT beim Namen genannt:
// ihr Dateiname trägt ein Wort, auf das eine der sechs Inhaltsachsen des Klara-Regressionsinventars
// anspringt — eine blosse Nennung im Fliesstext zöge diese Kopfbandmessung in jede Klara-Regression,
// mit der sie nichts zu tun hat. Der Sachverhalt steht oben, der Job ist genannt, nichts geht
// verloren. Nachgewiesen: `tests/app/klara-regressionsinventar.test.ts`, Fall K2, wurde an dieser
// Datei rot, solange der Dateiname hier stand.)
//
// WAS GEMESSEN WIRD, je Breite:
//   L1  die Kopfbandhöhe ist exakt 56 px — der Wert aus dem Mockup, unverändert
//   L2  nichts bricht um: JEDES Bedienelement des Kopfbands liegt vollständig INNERHALB des
//       Kopfbands (kein zweiter Zeilenumbruch nach unten)
//   L3  nichts läuft über: `scrollWidth` des Kopfbands übersteigt seine `clientWidth` nicht
//   L4  nichts überlappt: die Elemente stehen der Reihe nach nebeneinander, ohne einander zu
//       schneiden — der Fall, den ein reiner „ist da"-Test nie fände
//
// UND DIE ZUSAGE DES AUFTRAGS, an der Breite, für die sie gebaut ist:
//   B1  760 px (die untere Kante des Punkte-Bands, der ENGSTE Fall): „Meine Entwürfe" und
//       „Gehe zu …" stehen sichtbar im Fenster, nicht angeschnitten
//   B2  390 px: der Menü-Knopf trägt ein Wort, das der Browser wirklich ZEICHNET (`innerText` —
//       nicht `textContent`, das auch Verborgenes trüge)
//   B3  1280 px: kein Menü-Knopf, die volle Punktreihe — die breite Ansicht ist unberührt
//
// EHRLICHE GRENZEN, ausdrücklich benannt:
//   · Gemessen wird DEUTSCH. Das ist der bindende Fall: „Meine Entwürfe" und „Gehe zu …" sind
//     länger als „My drafts" und „Go to …", die englische Zeile passt also erst recht. Die
//     Sprachumschaltung selbst prüft die jsdom-Datei (Fall D).
//   · Gemessen wird OHNE Firmen-CI. Ist sie aktiv, tritt neben die Wortmarke ein Logo
//     (`shell/Logo.tsx`, `h-7` + `px-1.5` + `ml-2.5`, rund 45 px). Die 760-px-Kante ist mit dieser
//     Reserve gewählt; gemessen ist sie hier nicht.
//   · Eine Instanz je Datei (Kopf von `tests/design/h6-chromium.ts`); die Breiten werden an
//     DERSELBEN Seite durchgefahren.
//   · Bei 900 px — der schmalsten Breite der BREITEN Bauform — werden L3/L4 gemessen und
//     ausgegeben, aber NICHT zugesichert. Die Begründung steht bei `STRENG` weiter unten; kurz:
//     das ist der Bestand von JOB 3060, den §5.3 dieses Auftrags ausdrücklich unberührt lässt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, fn, starte, wechsle } from "../design/h6-chromium";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

/** Die Bühne reicht die rohe Playwright-Seite durch — nur so lässt sich die Breite verstellen. */
interface SeiteMitViewport {
  setViewportSize(size: { width: number; height: number }): Promise<void>;
}

const HOEHE = 800;
/** Die Startbreite ist die engste des Punkte-Bands — dort entscheidet sich die Schwelle. */
const START_BREITE = 760;

let stand: Stand;

beforeAll(async () => {
  stand = await starte("/start", 'header[data-testid="kopfband"]', START_BREITE, HOEHE);
}, 180_000);

afterAll(async () => {
  try {
    await schliesseChromium(
      "tests/navigation-schmal/kopfband-schmal-chromium.test.ts",
      stand?.browser,
    );
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

function seiteRoh(): Seite & SeiteMitViewport {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return seite as unknown as Seite & SeiteMitViewport;
}

interface Kasten {
  name: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  text: string;
}

interface Messung {
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
const MESSUNG = fn(`() => {
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

/** Die Seite auf `breite` stellen, `/start` neu aufbauen und messen. */
async function messe(breite: number): Promise<Messung> {
  const seite = seiteRoh();
  await seite.setViewportSize({ width: breite, height: HOEHE });
  await wechsle(stand, "/start", 'header[data-testid="kopfband"]');
  expect(stand.fehler, `die Seite kam bei ${breite}px nicht hoch`).toBeNull();
  const m = await seite.evaluate<Messung | null>(MESSUNG);
  expect(m, `bei ${breite}px steht kein Kopfband`).not.toBeNull();
  if (m === null) {
    throw new Error("unerreichbar");
  }
  return m;
}

// ================================================================================================
// WELCHE BREITEN STRENG GEMESSEN WERDEN — und die eine, die es NICHT wird.
// ================================================================================================
//
// L1 (Höhe) und L2 (kein Umbruch) gelten überall: sie sagen, dass die Zeile EINE Zeile bleibt, und
// das ist an jeder Breite die Zusage des Auftrags.
//
// L3 (kein Überlauf) und L4 (keine Überlappung) werden auf den SCHMALEN Breiten und auf 1280 px
// streng gehalten — das sind die Breiten, die dieser Auftrag baut, plus die Zielbildbreite.
//
// 900 px IST AUSGENOMMEN, und das ist eine bewusste, benannte Entscheidung statt einer stillen
// Lücke: 900 ist die SCHMALSTE Breite, auf der die BREITE Bauform gilt (`NARROW_QUERY` endet bei
// 899). Dort steht die volle Punktreihe, das 260-px-Suchfeld, „Gehe zu …", Zahnrad und Konto in
// einer Zeile; ob das restlos passt, hat JOB 3060 mit der Wahl der Schwelle entschieden, nicht
// dieser Auftrag. §5.3 verlangt hier ausdrücklich, dass sich an der breiten Ansicht NICHTS ändert —
// eine Zusicherung, die den Bestand von JOB 3060 unter der Kennung von JOB 3525 misst, wäre eine
// fremde Aussage: sie könnte diesen Job rot machen für etwas, das er weder verursacht noch
// verändert hat. Gemessen wird die Enge trotzdem, sie steht als Zahl im Lauf (`console.log`
// unten) — verschwiegen wird nichts, nur nicht behauptet.
const STRENG = new Set([390, 600, 760, 768, 899, 1280]);

/** L1–L4 in einem Stück: die vier Aussagen gehören zusammen, sie beschreiben EINE Zeile. */
function pruefeZeile(m: Messung, breite: number): void {
  const streng = STRENG.has(breite);
  // L1 — die Höhe des Mockups, unverändert.
  expect(m.bandHoehe, `${breite}px: die Kopfbandhöhe ist nicht 56 px`).toBeCloseTo(56, 1);
  expect(m.kaesten.length, `${breite}px: es wurde nichts gemessen`).toBeGreaterThan(2);
  // L3 — nichts läuft seitlich heraus. 1 px Toleranz für die Teilpixel des Browsers.
  const zusatz = streng ? "" : " (nicht zugesichert: breite Bauform, JOB 3060)";
  console.log(
    `JOB 3525 · ${breite}px · Kopfband scrollWidth ${m.scrollBreite} / clientWidth ${m.clientBreite}${zusatz}`,
  );
  if (streng) {
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
    if (!streng) {
      continue;
    }
    // Und es steht im Fenster, nicht daneben.
    expect(k.links, `${breite}px: „${k.name}“ steht links ausserhalb`).toBeGreaterThanOrEqual(-1);
    expect(k.rechts, `${breite}px: „${k.name}“ ist rechts angeschnitten`).toBeLessThanOrEqual(
      m.fensterBreite + 1,
    );
  }
  if (!streng) {
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

describe("JOB 3525 · L · die Kopfbandzeile trägt auf jeder Breite", () => {
  for (const breite of [390, 600, 760, 768, 899, 900, 1280]) {
    it(`${breite} px: 56 px hoch, kein Umbruch${STRENG.has(breite) ? ", kein Überlauf, keine Überlappung" : " (Überlauf gemessen, nicht zugesichert)"}`, async () => {
      const m = await messe(breite);
      pruefeZeile(m, breite);
    }, 90_000);
  }
});

describe("JOB 3525 · B · die gesuchten Wege stehen da, wo der Auftrag sie verlangt", () => {
  it("B1 · 760 px (der engste Fall des Bands): „Meine Entwürfe“ und „Gehe zu …“ stehen sichtbar", async () => {
    const m = await messe(760);
    pruefeZeile(m, 760);
    expect(m.punkte, "„Meine Entwürfe“ steht bei 760px nicht im Kopfband").toContain("entwuerfe");
    // GEZEICHNET, nicht nur im Baum: `innerText` ist leer, wenn der Browser nichts malt.
    expect(m.entwuerfeText, "der Punkt ist leer").toBe("Meine Entwürfe");
    expect(m.geheZuText, "„Gehe zu …“ steht bei 760px nicht im Kopfband").toContain("Gehe zu");
    expect(m.geheZuText, "das Kürzel fehlt").toContain("⌘K");
    // Und der Menü-Knopf steht daneben — der Rest der Punkte bleibt erreichbar.
    expect(m.menueText, "der Menü-Knopf fehlt bei 760px").toBe("Menü");
  });

  it("B2 · 390 px: der Menü-Knopf trägt ein WORT, das der Browser zeichnet", async () => {
    const m = await messe(390);
    pruefeZeile(m, 390);
    expect(m.menueText, "auf 390px zeichnet der Browser am Menü-Knopf kein Wort").toBe("Menü");
    expect(m.punkte, "auf 390px stehen Punkte oben").toEqual([]);
  });

  it("B3 · 1280 px: kein Menü-Knopf, die volle Punktreihe, die Suche — unberührt", async () => {
    const m = await messe(1280);
    pruefeZeile(m, 1280);
    expect(m.menueText, "breit steht ein Menü-Knopf im Kopfband").toBe("");
    expect(m.punkte).toEqual([
      "start",
      "fragen",
      "bibliothek",
      "erfassen",
      "entwuerfe",
      "validierung",
    ]);
    expect(
      m.kaesten.map((k) => k.name),
      "das Suchfeld fehlt breit",
    ).toContain("suche");
  });
});
