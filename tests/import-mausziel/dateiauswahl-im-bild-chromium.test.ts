// ================================================================================================
// JOB 3378 · UX-18-M1 — DIE DATEIAUSWAHL KOMMT MIT INS BILD, AUCH FÜR DIE MAUS.
// ================================================================================================
//
// DAS NUTZERVERSPRECHEN. Wer auf `/import` bei 390 px die Word-Kachel mit der MAUS anklickt, landet
// im Erfassen-Arbeitsraum und SIEHT dort den Knopf „Datei auswählen". Er soll nicht raten müssen,
// dass der angekündigte nächste Schritt oberhalb des Fensterrandes wartet.
//
// DIE AUSGANGSMESSUNG (JOB 3378 R1, Ursachensonde, Chromium, 390×720, an `apps/web/dist`) — der
// Knopf lag nach dem echten Kachelklick vollständig OBERHALB des Fensters:
//     DE  left=133.796875  right=256.203125  top=-128.875   bottom=-96.125
//     EN  left=149.96875   right=240.03125   top=-129.0625  bottom=-96.3125
//
// UND DIE URSACHE, gemessen statt vermutet (dieselbe Sonde):
//   · Das FENSTER scrollt gar nicht: `window.scrollY` ist durchgehend 0, `documentElement.
//     scrollHeight` ist 720 = `innerHeight`. Der scrollende Knoten ist `<main>` (clientHeight 664).
//   · Auf `/import` steht die Word-Kachel bei `top=1765.34` — weit unter dem Falz. Ein echter
//     Mausklick muss dorthin scrollen, und `<main>` überlebt den Seitenwechsel: auf `/erfassen`
//     steht sein `scrollTop` unverändert bei 1108 (DE) bzw. 1064 (EN).
//   · `flaeche.focus()` (`Blatt.tsx`, Fokus-Effekt) löst dabei KEINEN Bildlauf aus — gemessen:
//     `scrollTop` und die Bildlage des Knopfes sind vor und nach dem Aufruf identisch. Das ist kein
//     Fehler des Aufrufs: die Arbeitsraum-Fläche ist 2100 px hoch und überspannt den 664 px hohen
//     Scrollbereich vollständig, es gibt für sie also nichts hineinzuscrollen.
//   · Deshalb reicht ein Bildlauf auf die FLÄCHE nicht: `capture-file-pick` liegt 746 px (DE) bzw.
//     707 px (EN) unterhalb der Flächenoberkante, der Scrollbereich ist 664 px hoch. Selbst mit der
//     Flächenoberkante am oberen Rand bliebe der Knopf ausserhalb. Ins Bild muss der KNOPF.
//
// GEMESSEN WIRD AN DER GEBAUTEN ANWENDUNG (`apps/web/dist`, Ergebnis von `./tools/build`) in
// echtem Chromium, auf der geteilten Messstrecke `tests/design/h1-chromium.ts` — dieselbe, auf der
// `tests/import-einstieg/einschritt-chromium.test.ts` reitet. Die Browser-Gruppe des Tors berechnet
// sich aus dem Importgraphen (`tests/tor-inventar/browser-gruppe.ts`); diese Datei ordnet sich damit
// selbst ein, es ist keine Liste zu pflegen. EINE Browserinstanz für alle Fälle.
//
// WARUM DER KLICK ECHT SEIN MUSS, und wie diese Datei das belegt: JOB 3299 R3 hat gemessen, dass
// ein PROGRAMMATISCHER DOM-Klick den Knopf auch dann erreicht, wenn ein Mensch ihn nicht sieht —
// der Klickvergleich derselben Runde blieb mit `element.click()` grün, während `page.click` an einer
// Überdeckung scheiterte. Ein Test, der die Maus nur behauptet, misst also nichts. Deshalb schreibt
// jeder Mausfall hier VOR dem Klick einen Horcher auf die Kachel, der den ersten `pointerdown`
// samt `isTrusted` und Koordinaten in den `sessionStorage` legt, und prüft ihn nach der Ankunft:
// ein `element.click()` erzeugt weder einen `pointerdown` noch ein vertrauenswürdiges Ereignis.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ORIGIN, type Seite, type Strecke, fn, strecke } from "../design/h1-chromium";

type Sprache = "de" | "en";

const KACHEL = '[data-id="docx"]';
const AUSWAHL = '[data-testid="capture-file-pick"]';
const BREITE = 390;
const HOEHE = 720;

interface Bildlage {
  /** `null`, wenn der Knopf gar nicht da ist — das wäre ein anderer Fehler als „nicht im Bild". */
  pick: { top: number; bottom: number; left: number; right: number; height: number } | null;
  innerHeight: number;
  innerWidth: number;
  sprache: string;
  /** Der Bildlaufstand JEDES scrollenden Knotens — im Bestand ist das `<main>`, nicht das Fenster. */
  stand: { pfad: string; scrollTop: number }[];
  scrollY: number;
  aktiv: string | null;
  imArbeitsraum: boolean;
}

/** Bildlage des Auswahlknopfes, Bildlaufstand und Fokus — alles in EINEM Seitenaufruf. */
const LAGE = `() => {
  const el = document.querySelector('[data-testid="capture-file-pick"]');
  const r = el ? el.getBoundingClientRect() : null;
  const aktivKnoten = document.activeElement;
  const raum = document.querySelector('[data-testid="blatt-arbeitsraum"]');
  return {
    pick: r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height } : null,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
    sprache: document.documentElement.lang,
    stand: [...document.querySelectorAll('*')]
      .filter((k) => /auto|scroll|overlay/.test(getComputedStyle(k).overflowY) && k.scrollHeight > k.clientHeight + 1)
      .map((k) => ({
        pfad: k.tagName.toLowerCase() + (k.getAttribute('data-testid') ? '[' + k.getAttribute('data-testid') + ']' : ''),
        scrollTop: k.scrollTop,
      })),
    scrollY: window.scrollY,
    aktiv: aktivKnoten ? (aktivKnoten.getAttribute('data-testid') || aktivKnoten.tagName.toLowerCase()) : null,
    imArbeitsraum: !!(raum && aktivKnoten && (raum === aktivKnoten || raum.contains(aktivKnoten))),
  };
}`;

/**
 * Der Horcher, der den ECHTEN Zeigerdruck festhält. Er läuft VOR dem Klick und schreibt in den
 * `sessionStorage`, weil dieser einen Seitenwechsel überlebt — ein Fensterfeld täte das nicht,
 * falls die Plattform statt der SPA-Navigation einmal wirklich neu lüde.
 */
const HORCHER = `() => {
  sessionStorage.removeItem('job3378.zeiger');
  const kachel = document.querySelector('[data-id="docx"]');
  if (!kachel) { throw new Error('Word-Kachel fehlt — der Horcher hat kein Ziel'); }
  kachel.addEventListener('pointerdown', (e) => {
    if (sessionStorage.getItem('job3378.zeiger')) { return; }
    const r = kachel.getBoundingClientRect();
    sessionStorage.setItem('job3378.zeiger', JSON.stringify({
      typ: e.type,
      vertrauenswuerdig: e.isTrusted,
      x: e.clientX,
      y: e.clientY,
      imRechteck: e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom,
    }));
  }, { capture: true });
}`;

interface Zeigerdruck {
  typ: string;
  vertrauenswuerdig: boolean;
  x: number;
  y: number;
  imRechteck: boolean;
}

const RUHE =
  "() => document.fonts.ready.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))";

let stand: Strecke | undefined;
/** Seitenfehler des Browsers — geprüft in `afterEach`, nicht in einem `finally` je Fall. */
const seitenfehler: string[] = [];

function pruefstand(): Strecke {
  if (!stand) {
    throw new Error("Chromium-Prüfstand fehlt");
  }
  return stand;
}

/** Die zuletzt hinterlegte Produktsprache — sie überlebt jeden Seitenwechsel. */
let gesetzteSprache: Sprache | null = null;

/** `/import` bei 390 px in der genannten Sprache öffnen und warten, bis die Galerie steht. */
async function importOeffnen(seite: Seite, sprache: Sprache): Promise<void> {
  await seite.setViewportSize({ width: BREITE, height: HOEHE });
  if (gesetzteSprache !== sprache) {
    // `localStorage` gehört zur HERKUNFT: auf `about:blank` wirft der Zugriff. Also erst laden,
    // dann hinterlegen — der Ladelauf darunter liest die Wahl beim Start.
    await seite.goto(`${ORIGIN}/import`, { waitUntil: "load", timeout: 60_000 });
    await seite.evaluate(fn('(s) => localStorage.setItem("kw.sprache", s)'), sprache);
    gesetzteSprache = sprache;
  }
  await seite.goto(`${ORIGIN}/import`, { waitUntil: "load", timeout: 60_000 });
  await seite.waitForFunction(
    fn(`() => !!document.querySelector('#import-source-gallery [data-id="docx"]')`),
    undefined,
    { timeout: 30_000 },
  );
  await seite.evaluate(fn(RUHE));
}

/** Warten, bis die Dateiauswahl gerendert ist, und danach die Bildlage lesen. */
async function lageNachAnkunft(seite: Seite, was: string): Promise<Bildlage> {
  await seite.waitForFunction(fn(`() => !!document.querySelector('${AUSWAHL}')`), undefined, {
    timeout: 30_000,
  });
  await seite.evaluate(fn(RUHE));
  const lage = await seite.evaluate<Bildlage>(fn(LAGE));
  console.info(`JOB 3378 · ${was}: ${JSON.stringify(lage)}`);
  return lage;
}

/** Die eine Zusage dieses Auftrags, mit den gemessenen Zahlen in der Fehlermeldung. */
function pruefeImBild(lage: Bildlage, was: string): void {
  const zahlen = JSON.stringify(lage.pick);
  expect(lage.pick, `${was}: der Auswahlknopf ist gar nicht da`).not.toBeNull();
  const pick = lage.pick as NonNullable<Bildlage["pick"]>;
  expect(
    pick.top,
    `${was}: „Datei auswählen" steht OBERHALB des Fensters — ${zahlen}, innerHeight=${lage.innerHeight}, Bildlaufstand ${JSON.stringify(lage.stand)}`,
  ).toBeGreaterThanOrEqual(0);
  expect(
    pick.bottom,
    `${was}: „Datei auswählen" steht UNTERHALB des Fensters — ${zahlen}, innerHeight=${lage.innerHeight}, Bildlaufstand ${JSON.stringify(lage.stand)}`,
  ).toBeLessThanOrEqual(lage.innerHeight);
  // Eine Höhe von 0 wäre „im Bild" und trotzdem unsichtbar — die Zusage meint einen echten Knopf.
  expect(pick.height, `${was}: der Knopf hat keine Höhe — ${zahlen}`).toBeGreaterThan(0);
}

describe("JOB 3378 · UX-18-M1 — nach dem Mausklick steht die Dateiauswahl im Fenster", () => {
  beforeAll(async () => {
    stand = await strecke({
      email: "pedi@job3378-chromium.test",
      stufe2: true,
      viewport: { width: BREITE, height: HOEHE },
    });
    // Seitenfehler sammeln statt je Fall in ein `finally` zu packen (Lehre JOB 3269 R1: dort
    // verdeckt die Prüfung den eigentlichen Fehler).
    (stand.seite as unknown as { on(e: string, h: (x: unknown) => void): void }).on(
      "pageerror",
      (fehler) => {
        seitenfehler.push(String(fehler));
      },
    );
  }, 180_000);
  afterAll(async () => {
    await stand?.schliessen();
  }, 60_000);
  afterEach(() => {
    const gesammelt = seitenfehler.splice(0, seitenfehler.length);
    expect(gesammelt, `Seitenfehler im Browser: ${gesammelt.join(" | ")}`).toEqual([]);
  });

  // ----------------------------------------------------------------------------------------------
  // M · DER MAUSWEG, IN BEIDEN SPRACHEN.
  // ----------------------------------------------------------------------------------------------
  // Die englische Abweichung war mit −129,1 px die grössere; „nur DE" wäre deshalb keine halbe,
  // sondern die falsche Hälfte.
  for (const sprache of ["de", "en"] as const) {
    it(`M · ${sprache.toUpperCase()}: ein echter Mausklick auf die Word-Kachel, und „Datei auswählen" steht im Bild`, async () => {
      const { seite } = pruefstand();
      await importOeffnen(seite, sprache);
      // Die geladene Sprache wird BELEGT, nicht angenommen — eine Messung in der falschen Sprache
      // wäre eine Messung an der falschen Textbreite.
      expect(
        await seite.evaluate<string>(fn("() => document.documentElement.lang")),
        `${sprache}: die Sprachwahl griff nicht`,
      ).toBe(sprache);
      // Und die Beschriftung ist die des Produkts, nicht ein hier getippter Wortlaut.
      expect(
        await seite.evaluate<string>(
          fn(
            `() => (document.querySelector('${KACHEL} [data-tile-name]')?.textContent || '').trim()`,
          ),
        ),
      ).toBe(String(i18n.getFixedT(sprache)("imp.gallery.file.docx")));

      await seite.evaluate(fn(HORCHER));
      // Ein ECHTER Mausklick der Plattform: sie scrollt selbst zur Kachel, sie trifft sie über die
      // Trefferprüfung, und sie führt die Navigation aus. `element.click()` täte nichts davon.
      await seite.click(KACHEL);

      const lage = await lageNachAnkunft(seite, `M/${sprache}`);
      expect(new URL(seite.url()).pathname).toBe("/erfassen");

      // DER BELEG, DASS DIE MAUS GEMESSEN WURDE (Gegenprobe G4): ein vertrauenswürdiger
      // `pointerdown` mit Koordinaten IM Kachelrechteck. Ein DOM-Klick erzeugt keinen.
      const zeiger = await seite.evaluate<Zeigerdruck | null>(
        fn(`() => JSON.parse(sessionStorage.getItem('job3378.zeiger') || 'null')`),
      );
      console.info(`JOB 3378 · M/${sprache} ZEIGERDRUCK: ${JSON.stringify(zeiger)}`);
      expect(
        zeiger,
        `${sprache}: auf der Kachel kam kein Zeigerdruck an — dieser Fall misst dann nicht die Maus`,
      ).not.toBeNull();
      expect(
        (zeiger as Zeigerdruck).vertrauenswuerdig,
        `${sprache}: der Zeigerdruck war nicht vertrauenswürdig — ${JSON.stringify(zeiger)}`,
      ).toBe(true);
      expect(
        (zeiger as Zeigerdruck).imRechteck,
        `${sprache}: der Zeigerdruck lag ausserhalb der Kachel — ${JSON.stringify(zeiger)}`,
      ).toBe(true);

      // Der Test selbst hat auf der ZIELSEITE nicht gescrollt — gemessen wird, was der Mensch sieht.
      pruefeImBild(lage, `M/${sprache}`);
      expect(lage.sprache, `${sprache}: am Ziel steht eine andere Sprache`).toBe(sprache);
      expect(lage.innerWidth).toBe(BREITE);
    }, 120_000);
  }

  // ----------------------------------------------------------------------------------------------
  // T · DER TASTATURWEG BLEIBT — er war schon vor dieser Reparatur grün.
  // ----------------------------------------------------------------------------------------------
  it("T · Tastatur: Tab bis zur Kachel, Enter, weiter bis „Datei auswählen“ — auch dort im Bild", async () => {
    const { seite } = pruefstand();
    await importOeffnen(seite, "de");
    await seite.evaluate(fn("() => document.body.focus()"));
    let aufKachel = false;
    for (let i = 0; i < 120 && !aufKachel; i++) {
      await seite.keyboard.press("Tab");
      aufKachel = await seite.evaluate<boolean>(
        fn(`() => document.activeElement?.getAttribute('data-id') === 'docx'`),
      );
    }
    expect(aufKachel, "die Word-Kachel liegt nicht im Tab-Lauf der Seite").toBe(true);
    await seite.keyboard.press("Enter");
    await lageNachAnkunft(seite, "T/ankunft");

    // Weiter mit der Tastatur bis zum Auswahlknopf — durch echte Bedienung, nicht per `focus()`.
    let aufKnopf = false;
    for (let i = 0; i < 120 && !aufKnopf; i++) {
      await seite.keyboard.press("Tab");
      aufKnopf = await seite.evaluate<boolean>(
        fn(`() => document.activeElement?.getAttribute('data-testid') === 'capture-file-pick'`),
      );
    }
    expect(aufKnopf, "„Datei auswählen“ liegt nicht im Tab-Lauf des Arbeitsraums").toBe(true);
    const lage = await seite.evaluate<Bildlage>(fn(LAGE));
    console.info(`JOB 3378 · T/tastatur: ${JSON.stringify(lage)}`);
    pruefeImBild(lage, "T/tastatur");
    // Und Enter darauf bedient wirklich diesen Knopf: der Weg bleibt begehbar, der Knopf im Bild.
    await seite.keyboard.press("Enter");
    const danach = await seite.evaluate<Bildlage>(fn(LAGE));
    console.info(`JOB 3378 · T/nach Enter: ${JSON.stringify(danach)}`);
    pruefeImBild(danach, "T/nach Enter");
  }, 120_000);

  // ----------------------------------------------------------------------------------------------
  // F · DER FOKUS GEHT WEITERHIN MIT.
  // ----------------------------------------------------------------------------------------------
  // Die Zusage aus JOB 3341 („Der Fokus geht MIT") bleibt wahr: die neue Bildlauf-Regel tritt neben
  // sie, sie ersetzt sie nicht. Ohne sie läge der Fokus nach dem Deep-Link auf `body`, und wer mit
  // Tab und Enter hergekommen ist, müsste die halbe Seite noch einmal durchtabben.
  it("F · nach dem Deep-Link liegt der Fokus auf der Arbeitsraum-Fläche, nicht auf `body`", async () => {
    const { seite } = pruefstand();
    await importOeffnen(seite, "de");
    await seite.click(KACHEL);
    const lage = await lageNachAnkunft(seite, "F");
    expect(lage.aktiv, `der Fokus liegt auf „${lage.aktiv}" statt auf der Arbeitsraum-Fläche`).toBe(
      "blatt-arbeitsraum",
    );
    expect(lage.imArbeitsraum, "der Fokus liegt ausserhalb des Arbeitsraums").toBe(true);
    // KEIN Betriebssystemfenster: der Fokus liegt ausdrücklich nicht auf dem Dateieingang.
    expect(
      await seite.evaluate<string | null>(
        fn("() => document.activeElement?.getAttribute('type') ?? null"),
      ),
    ).not.toBe("file");
  }, 120_000);

  // ----------------------------------------------------------------------------------------------
  // N · KEIN BILDLAUF OHNE ANLASS.
  // ----------------------------------------------------------------------------------------------
  // Der Menüweg ist kein Deep-Link: dort steht der Fokus schon in der Nähe, und der Mensch hat
  // seinen Bildlauf selbst eingestellt. Ein Sprung wäre hier ein Griff, den niemand gemacht hat —
  // dieselbe Zurückhaltung, die `Blatt.tsx` für den Fokus ausdrücklich zusagt.
  it("N · Menüweg ohne `?weg=`: das Öffnen des Arbeitsraums verstellt den Bildlauf NICHT", async () => {
    const { seite } = pruefstand();
    const de = i18n.getFixedT("de");
    await seite.setViewportSize({ width: BREITE, height: HOEHE });
    await seite.goto(`${ORIGIN}/erfassen`, { waitUntil: "load", timeout: 60_000 });
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt-werkzeug-datei"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await seite.evaluate(fn(RUHE));
    const vorher = (await seite.evaluate<Bildlage>(fn(LAGE))).stand;
    console.info(`JOB 3378 · N/vorher: ${JSON.stringify(vorher)}`);

    await seite.click('[data-testid="blatt-werkzeug-datei"]');
    await seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="blatt-menue-datei"] [role="menuitem"]')`),
      undefined,
      { timeout: 30_000 },
    );
    // Der Eintrag wird über sein SICHTBARES Wort gefunden — so findet ihn auch der Mensch.
    await seite.evaluate(
      fn(`(wort) => {
        const eintrag = [...document.querySelectorAll('[data-testid="blatt-menue-datei"] [role="menuitem"]')]
          .find((el) => (el.textContent || '').trim() === wort);
        if (!eintrag) { throw new Error('Menüeintrag fehlt: ' + wort); }
        eintrag.click();
      }`),
      String(de("erfassen.weg.datei")),
    );
    const lage = await lageNachAnkunft(seite, "N/nachher");
    expect(lage.stand, "der Menüweg hat den Bildlauf verstellt").toEqual(vorher);
    expect(lage.scrollY, "der Menüweg hat das Fenster gescrollt").toBe(0);
    // Und der Fokus bleibt, wo der Mensch ihn hatte: der Menüweg versetzt ihn nicht in die Fläche.
    expect(lage.aktiv, "der Menüweg hat den Fokus in den Arbeitsraum versetzt").not.toBe(
      "blatt-arbeitsraum",
    );
  }, 120_000);
});
