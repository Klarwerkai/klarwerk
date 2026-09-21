// ================================================================================================
// JOB 3761 · C — DIE KENNZEICHNUNG IM BROWSER, AN DER ENGSTEN UND AN DER BREITESTEN BREITE.
// JOB 4365 · P — UND SIE HÄNGT JETZT AM HOSTNAMEN DER ANFRAGE, NICHT MEHR AN EINEM SCHALTER.
// ================================================================================================
//
// WARUM DIESE DATEI ÜBERHAUPT STEHT. Der gemountete Teil (`flaechen-mounted.test.tsx`) kann eine
// Sache nicht: rechnen. jsdom hat keine Layout-Maschine. Die Zusage des Auftrags lautet aber
// ausdrücklich, die Kennzeichnung dürfe „die vorhandene Firmen-CI nicht verdrängen und nicht
// überlappen — auf 390 px Breite wie auf 1280 px". Das ist eine Frage an Pixel, und sie wird hier
// GEMESSEN statt begründet. Ohne diese Datei stünde in der Rückgabe ein Argument („sie steht in
// einer eigenen Zeile, also kann sie der Zeile nichts wegnehmen") — und genau solche Argumente hat
// JOB 3571 als falsch nachgewiesen, als es den überschlagenen „rund 45 px" nachrechnete.
//
// ------------------------------------------------------------------------------------------------
// WOHER DIE KENNZEICHNUNG KOMMT — DIE STELLE, DIE JOB 4365 GEÄNDERT HAT
// ------------------------------------------------------------------------------------------------
//
// Bis JOB 4365 setzte diese Datei `KLARWERK_DEMO_INSTANZ` in der Umgebung, „wie beim Kunden". Genau
// diese Stelle ist jetzt eine andere: Der Server liest die Kennzeichnung aus dem `Host`-Kopf der
// Anfrage (`services/app/src/feature-flags.ts`, `demoInstanzAusHost`), der Schalter ist abgeschafft.
//
// DIE BÜHNE MUSS DAFÜR EINE SACHE NACHREICHEN, und sie wird hier ausdrücklich benannt statt still
// eingebaut: Der gemeinsame Aufbau (`tests/design/h6-chromium.ts`) reicht jeden `/api/*`-Aufruf der
// Seite an die ECHTE App weiter, ENTFERNT dabei aber den `host`-Kopf (h6-chromium.ts, die Liste
// `["host", "origin", "referer", "cookie"]`) — die App sähe also nie den Host, unter dem der Browser
// die Seite geöffnet hat. Im Betrieb reicht Caddy/Coolify ihn durch. Diese Datei stellt deshalb für
// GENAU EINEN Pfad (`/api/features`) eine eigene Weiche daneben, die ihn setzt — dieselbe Aufgabe,
// die der Reverse-Proxy im Betrieb hat. Alles andere bleibt am unveränderten Aufbau.
//
// Dass die Weiche wirklich greift, ist nicht angenommen, sondern gezählt: `featureAbrufe` muss in
// jedem Fall gestiegen sein. Wäre das Muster daneben, liefe der Aufruf am unveränderten Aufbau
// vorbei — dann trüge kein Fall mehr eine Aussage über den Host, und genau das meldet der Zähler.
//
// DIE FIRMEN-CI KOMMT ÜBER DEN ECHTEN ADMINWEG (`PUT /api/admin/branding`, `schalteCi`) — dieselbe
// Vorrichtung, die JOB 3571/3582/3641 benutzt haben. Zwei Wahrheiten über dieselbe Zeile gibt es
// damit nicht.
//
//   C0  Die Voraussetzung wird selbst gemessen: unter dem Host der ECHTEN Anwendung steht keine
//       Kennzeichnung da, unter `demo.klarwerk.io` steht sie gezeichnet da.
//   C1  Sie liegt ÜBER der Kopfbandzeile und überlappt sie nicht — auf 390 px und auf 1280 px.
//   C2  Die Kopfbandzeile misst mit ihr ZEICHENGLEICH dasselbe wie ohne sie: Logokasten,
//       Wortmarke und der rechteste Kasten stehen auf denselben Pixeln, nichts läuft hinaus.
//   C3  Und die Seite bekommt keinen waagerechten Rollbalken.
//   P1  JOB 4365: die ECHTE ANMELDEMASKE (`/`, `AuthScreens` mit `BrandPanel`/`BrandCompact`)
//       trägt die Kennzeichnung SICHTBAR unter `demo.klarwerk.io` — und unter einem anderen Host
//       gar nichts. Die Anfrage geht dabei OHNE Bearer hinaus, also genau so, wie ein Gast vor der
//       Anmeldung sie stellt.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORIGIN, type Stand, fn, starte, wechsle } from "../design/h6-chromium";
import {
  type LogoBefund,
  type Messung,
  meldeAn,
  messeMitCi,
  schalteCi,
  seiteRoh,
} from "../navigation-schmal/kopfband-messung";
// Der Bau gehört in DIESE Datei und nicht in die Laufreihenfolge: der private Cloud-Schnappschuss
// der Arbeitsprüfung enthält KEIN `apps/web/dist` (so steht es wörtlich im Kopf von `bau.ts`), und
// `h6-chromium.ts:242` bricht dann mit „apps/web/dist fehlt" ab. Gemessen am Lauf vom 13.09.:
// ohne diesen Aufruf meldete der Fall `die Bühne kam nicht hoch: … 'apps/web/dist fehlt'`
// (Arbeitsprüfung eb2b66fe…, Exit 1). Sich darauf zu verlassen, dass eine ANDERE Chromium-Datei im
// selben Lauf zuerst baut, wäre eine Zusage über die Reihenfolge, die vitest nicht gibt.
// `baueFrisch()` baut nur, wenn der Frische-Wächter den Bestand für alt hält — im Tor, wo `dist`
// ohnehin frisch ist, kostet der Aufruf nichts.
import baueFrisch from "../review26-pruefen-schmal/bau";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const KENNUNG = "JOB 3761/4365";
const HOEHE = 800;
/** Die engste zugesicherte Breite (JOB 3582, Fall CI1) und die des Mockups (JOB 3060). */
const BREITEN = [390, 1280] as const;
/** Die Vorführ-Adresse — als Literal, nicht aus dem Produktionscode abgeschrieben. */
const DEMO_HOST = "demo.klarwerk.io";
/** Der Host der ECHTEN Anwendung. Er ist hier der Vergleichsfall, auf den es ankommt. */
const ECHT_HOST = "app.klarwerk.ai";

interface Befund {
  bandDa: boolean;
  bandGezeichnet: boolean;
  bandText: string;
  bandOben: number;
  bandUnten: number;
  bandBreite: number;
  bandHoehe: number;
  kopfOben: number;
  kopfHoehe: number;
  kopfScroll: number;
  kopfClient: number;
  dokScroll: number;
  dokClient: number;
  fenster: number;
}

const BEFUND = fn(`() => {
  const kopf = document.querySelector('header[data-testid="kopfband"]');
  if (!kopf) return null;
  const band = document.querySelector('[data-testid="demo-kennzeichen"]');
  const kr = kopf.getBoundingClientRect();
  const br = band ? band.getBoundingClientRect() : null;
  return {
    bandDa: band !== null,
    bandGezeichnet: band !== null && band.offsetParent !== null && br.height > 0,
    bandText: band ? (band.innerText || '').trim() : '',
    bandOben: br ? br.top : 0,
    bandUnten: br ? br.bottom : 0,
    bandBreite: br ? br.width : 0,
    bandHoehe: br ? br.height : 0,
    kopfOben: kr.top,
    kopfHoehe: kr.height,
    kopfScroll: kopf.scrollWidth,
    kopfClient: kopf.clientWidth,
    dokScroll: document.documentElement.scrollWidth,
    dokClient: document.documentElement.clientWidth,
    fenster: window.innerWidth,
  };
}`);

/**
 * JOB 4365 · P1 — DIE ÖFFENTLICHE MARKENFLÄCHE, FELDWEISE UND AUF SICHTBARKEIT.
 *
 * Nicht `textContent` und nicht „Element vorhanden": Gemessen wird je Kennzeichen, ob es WIRKLICH
 * gezeichnet ist (`offsetParent`, Höhe/Breite) und ob sein Text sichtbar ist (`innerText`, dazu
 * `visibility`, `opacity` und eine nicht durchsichtige Schriftfarbe). Ein sichtbarer Umschlag
 * belegt nicht, dass sein Text sichtbar ist.
 */
interface OeffentlicherBefund {
  /** Steht die Markenspalte überhaupt? Ohne sie misst der Fall gar nichts. */
  markeDa: boolean;
  /** Steht der Anker für schmale Geräte? (Am Desktop ist er da, aber nicht gezeichnet.) */
  ankerDa: boolean;
  /** Die Überschrift der Anmeldekarte — der zweite Beleg, dass die Maske wirklich steht. */
  karteText: string;
  /** Und ihr Formular: ohne Eingabefeld wäre es keine Anmeldemaske. */
  formDa: boolean;
  /**
   * Das Kopfband der angemeldeten Hülle. Es MUSS hier fehlen — sonst misst der Fall die Hülle und
   * nicht die Anmeldemaske, und seine ganze Aussage wäre eine andere als die behauptete.
   */
  kopfbandDa: boolean;
  kennzeichen: {
    form: string;
    gezeichnet: boolean;
    text: string;
    breite: number;
    hoehe: number;
    sichtbarkeit: string;
    deckkraft: string;
    farbe: string;
    /**
     * Die ALPHA-Stufe der Schriftfarbe, 0 = unsichtbar. Sie wird ausgerechnet und nicht am
     * Farbtext geprüft: Der erste Anlauf dieses Falls suchte in `color` nach „, 0)" und wurde an
     * `rgb(138, 90, 0)` rot — das ist eine Null im BLAU-Kanal einer voll deckenden Farbe, nicht
     * durchsichtige Schrift (Cloud-Lauf dcc4b8c9…). Ein Farbtext ist kein Alphawert.
     */
    schriftAlpha: number;
  }[];
}

const OEFFENTLICH = fn(`() => {
  const sichtbar = (el) => {
    const s = getComputedStyle(el);
    const teile = (/rgba?\\(([^)]+)\\)/.exec(s.color) || [null, ''])[1].split(',').map(Number);
    return {
      gezeichnet: el.offsetParent !== null && el.getBoundingClientRect().height > 0,
      text: (el.innerText || '').trim(),
      breite: el.getBoundingClientRect().width,
      hoehe: el.getBoundingClientRect().height,
      sichtbarkeit: s.visibility,
      deckkraft: s.opacity,
      farbe: s.color,
      schriftAlpha: teile.length === 4 ? teile[3] : 1,
    };
  };
  const karte = document.querySelector('h1');
  return {
    markeDa: document.querySelector('[data-testid="auth-brand-panel"]') !== null,
    ankerDa: document.querySelector('[data-testid="auth-brand-compact"]') !== null,
    karteText: karte ? (karte.innerText || '').trim() : '',
    formDa: document.querySelector('form') !== null,
    kopfbandDa: document.querySelector('header[data-testid="kopfband"]') !== null,
    kennzeichen: Array.prototype.map.call(
      document.querySelectorAll('[data-testid="demo-kennzeichen"]'),
      (el) => Object.assign({ form: el.getAttribute('data-demo-form') || '' }, sichtbar(el)),
    ),
  };
}`);

let stand: Stand;
let bearer = "";

// ------------------------------------------------------------------------------------------------
// DIE WEICHE FÜR `/api/features` — sie tut das, was Caddy/Coolify im Betrieb tut: den Host
// durchreichen. Sie ist bewusst auf EINEN Pfad beschränkt; alles andere bleibt am unveränderten
// gemeinsamen Aufbau (`h6-chromium.ts`).
// ------------------------------------------------------------------------------------------------

/** Der Host, den die Weiche dem Server für die nächste Auskunft vorlegt. */
let anfrageHost = ECHT_HOST;
/**
 * Geht die Auskunft MIT Bearer hinaus (angemeldete Hülle) oder OHNE (öffentliche Strecke)?
 * Der zweite Fall ist der Weg der Anmeldemaske und trifft `schalterZustandVorAnmeldung`.
 */
let mitBearer = true;
/** Wie oft die Weiche wirklich gegriffen hat — der Beleg, dass die Fälle den Host setzen. */
let featureAbrufe = 0;

async function lies(): Promise<Befund> {
  const seite = stand.seite;
  if (seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  const b = await seite.evaluate<Befund | null>(BEFUND);
  if (b === null) {
    throw new Error("kein Kopfband in der Seite");
  }
  return b;
}

/** Der rechteste gezeichnete Kasten der Zeile — der, der als Erster hinausliefe. */
function rechtester(m: Messung): { name: string; rechts: number } {
  const k = [...m.kaesten].sort((a, b) => b.rechts - a.rechts)[0];
  if (!k) {
    throw new Error("kein gezeichneter Kasten im Kopfband");
  }
  return { name: k.name, rechts: k.rechts };
}

/** Eine Breite mit Firmen-CI messen, unter einem bestimmten Host — Seite wird neu geladen. */
async function messeUnterHost(
  breite: number,
  host: string,
): Promise<{ m: Messung; logo: LogoBefund; b: Befund; abrufe: number }> {
  anfrageHost = host;
  mitBearer = true;
  const vorher = featureAbrufe;
  const { m, logo } = await messeMitCi(stand, breite, HOEHE);
  const b = await lies();
  expect(
    featureAbrufe,
    `unter „${host}" hat die Seite die Schalter-Auskunft gar nicht geholt — der Fall sagt nichts über den Host`,
  ).toBeGreaterThan(vorher);
  return { m, logo, b, abrufe: featureAbrufe - vorher };
}

beforeAll(async () => {
  await baueFrisch();
  stand = await starte(
    "/start",
    'header[data-testid="kopfband"]',
    BREITEN[1],
    HOEHE,
    async (app) => {
      bearer = await meldeAn(app);
      await schalteCi(app, bearer, true);
    },
  );
  const seite = stand.seite;
  const app = stand.app;
  if (seite !== null && app !== null) {
    // NACH `starte` registriert und deshalb VORRANGIG: Playwright bedient die zuletzt eingetragene
    // passende Weiche zuerst. Der breite Eintrag `${ORIGIN}/**` aus `h6-chromium.ts` bleibt für
    // alles andere zuständig.
    //
    // BEIDE Weichen fragen dieselbe ECHTE App über denselben `inject`-Weg wie der gemeinsame
    // Aufbau. Sie ÄNDERN genau zwei Dinge und erfinden nichts: den `host`-Kopf (den der Aufbau
    // wegwirft) und, für die öffentliche Strecke, den Wegfall des eingespeisten Bearers.
    const weiche = async (
      route: Parameters<Parameters<typeof seite.route>[1]>[0],
      pfad: string,
    ): Promise<void> => {
      const kopf: Record<string, string> = { host: anfrageHost };
      if (mitBearer) {
        kopf.authorization = `Bearer ${bearer}`;
      }
      const res = await app.inject({ method: "GET", url: pfad, headers: kopf });
      await route.fulfill({
        status: res.statusCode,
        body: res.body,
        headers: {
          "content-type": (res.headers["content-type"] as string) ?? "application/json",
        },
      });
    };

    await seite.route(`${ORIGIN}/api/features`, async (route) => {
      featureAbrufe += 1;
      await weiche(route, "/api/features");
    });

    // DIE ZWEITE WEICHE, und sie ist der Grund, aus dem P1 die ECHTE Anmeldemaske sieht: Der
    // gemeinsame Aufbau hängt an JEDEN `/api/*`-Aufruf den Bearer einer echten Anmeldung — die
    // Anwendung hält sich damit immer für angemeldet und käme nie zur Maske. Hier wird nichts
    // vorgetäuscht, sondern diese Einspeisung für den einen Pfad WEGGELASSEN, an dem die Anwendung
    // ihre Sitzung erfragt. Die Antwort kommt unverändert von der echten App: ohne Bearer ein
    // echtes 401, und `App.tsx` zeigt darauf `AuthScreens`. Bei `mitBearer` bleibt alles wie bisher.
    await seite.route(`${ORIGIN}/api/auth/me`, async (route) => {
      await weiche(route, "/api/auth/me");
    });
  }
}, 300_000);

afterAll(async () => {
  try {
    await schliesseChromium("tests/demo-kennzeichnung/band-chromium.test.ts", stand?.browser);
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

describe("JOB 3761/4365 C · die Demo-Kennzeichnung im gebauten Produkt", () => {
  for (const breite of BREITEN) {
    it(`C0–C3 · ${breite} px mit Firmen-CI: sichtbar, über der Zeile, ohne einen Pixel zu kosten`, async () => {
      expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();

      // ---- UNTER DEM HOST DER ECHTEN ANWENDUNG: der Zustand, den jede Kundeninstanz zeigt. Er ist
      // zugleich der Vergleichswert, und er entsteht am SELBEN Stand in DIESEM Lauf — keine
      // gepinnte Zahl.
      const ohne = await messeUnterHost(breite, ECHT_HOST);
      expect(
        ohne.b.bandDa,
        `unter „${ECHT_HOST}" steht eine Demo-Kennzeichnung in der echten Anwendung`,
      ).toBe(false);
      const ohneRechts = rechtester(ohne.m);

      // ---- UNTER `demo.klarwerk.io`.
      const mit = await messeUnterHost(breite, DEMO_HOST);
      expect(mit.b.bandGezeichnet, "die Kennzeichnung ist nicht gezeichnet").toBe(true);
      expect(mit.b.bandText.toLowerCase(), "die Kennzeichnung trägt keinen Text").toContain("demo");
      const mitRechts = rechtester(mit.m);

      console.log(
        `${KENNUNG} · ${breite} px · Host ${ECHT_HOST} → ${DEMO_HOST} · ` +
          `Band ${mit.b.bandBreite.toFixed(1)}×${mit.b.bandHoehe.toFixed(1)} px ` +
          `oben ${mit.b.bandOben.toFixed(1)} → ${mit.b.bandUnten.toFixed(1)}; Kopfband oben ` +
          `${ohne.b.kopfOben.toFixed(1)} → ${mit.b.kopfOben.toFixed(1)} px, Höhe ${mit.b.kopfHoehe.toFixed(1)} px · ` +
          `Logokasten ${ohne.logo.logoBreite.toFixed(1)} → ${mit.logo.logoBreite.toFixed(1)} px · ` +
          `Wortmarke ${ohne.logo.markeBreite.toFixed(1)} → ${mit.logo.markeBreite.toFixed(1)} px · ` +
          `rechtester Kasten ${ohneRechts.name} ${ohneRechts.rechts.toFixed(1)} → ${mitRechts.name} ` +
          `${mitRechts.rechts.toFixed(1)} px im ${breite}-px-Fenster · Auskunft-Abrufe ` +
          `${ohne.abrufe}/${mit.abrufe}`,
      );

      // ---- C1 · SIE LIEGT ÜBER DER ZEILE UND ÜBERLAPPT SIE NICHT.
      expect(mit.b.bandUnten, "die Kennzeichnung ragt in die Kopfbandzeile").toBeLessThanOrEqual(
        mit.b.kopfOben + 0.5,
      );
      expect(mit.b.bandOben, "die Kennzeichnung steht nicht am oberen Rand").toBeLessThanOrEqual(
        0.5,
      );
      // Sie nimmt echten Platz ein (sie schwebt nicht über dem Inhalt): das Kopfband rückt genau um
      // ihre Höhe nach unten. Ein `fixed`-Balken verdeckte sonst Bedienelemente.
      expect(mit.b.kopfOben - ohne.b.kopfOben).toBeCloseTo(mit.b.bandHoehe, 1);
      // Und die Zeile selbst behält ihre 56 px (JOB 3060 · H1).
      expect(mit.b.kopfHoehe).toBeCloseTo(ohne.b.kopfHoehe, 1);

      // ---- C2 · DIE ZEILE KOSTET SIE NICHTS. Das ist die eigentliche Zusage dieses Falls: das
      // Firmenlogo (JOB 3571/3582/3641) steht auf denselben Pixeln wie ohne die Kennzeichnung.
      expect(mit.logo.logoGezeichnet, "das Firmenlogo ist mit der Kennzeichnung fort").toBe(true);
      expect(mit.logo.logoBreite, "der Logokasten ist schmaler geworden").toBeCloseTo(
        ohne.logo.logoBreite,
        1,
      );
      expect(mit.logo.markeBreite, "die Wortmarke ist schmaler geworden").toBeCloseTo(
        ohne.logo.markeBreite,
        1,
      );
      expect(mitRechts.name, "ein anderer Kasten steht jetzt rechts außen").toBe(ohneRechts.name);
      expect(mitRechts.rechts, "der rechteste Kasten ist gewandert").toBeCloseTo(
        ohneRechts.rechts,
        1,
      );
      // Nichts steht außerhalb des Fensters, und die Zeile verlangt nicht mehr Platz, als sie hat.
      expect(mitRechts.rechts).toBeLessThanOrEqual(breite);
      expect(mit.m.scrollBreite, "die Kopfbandzeile läuft über").toBe(mit.m.clientBreite);
      expect(mit.b.bandBreite, "das Band ist nicht so breit wie das Fenster").toBeCloseTo(
        breite,
        0,
      );

      // ---- C3 · KEIN WAAGERECHTER ROLLBALKEN.
      expect(mit.b.dokScroll, "die Seite bekommt einen waagerechten Rollbalken").toBe(
        mit.b.dokClient,
      );
    }, 180_000);
  }
});

// ------------------------------------------------------------------------------------------------
// P1 — DIE ÖFFENTLICHE STRECKE (JOB 4365, Abnahmekriterium K3)
// ------------------------------------------------------------------------------------------------
//
// GEMESSEN WIRD DIE ECHTE ANMELDEMASKE auf `/`, im gebauten Produkt und in echtem Chromium — die
// Fläche also, auf der ein Gast sein Kennwort eintippt und auf der er deshalb VORHER wissen muss,
// wo er es eintippt. Dass sie in dieser Bühne überhaupt erscheint, liegt an der zweiten Weiche oben
// (`/api/auth/me` ohne den eingespeisten Bearer → echtes 401 der echten App → `AuthScreens`).
//
// Und die Schalter-Auskunft geht hier ebenfalls OHNE Bearer hinaus — also über den öffentlichen
// Zweig `schalterZustandVorAnmeldung`, genau so, wie ein Gast sie stellt. Beide Bausteine der
// Maske werden einzeln geprüft: die Markenspalte am Desktop (`BrandPanel`) und der Anker für
// schmale Geräte (`BrandCompact`).
describe("JOB 4365 P · die Anmeldemaske folgt dem Host", () => {
  it("P1 · unter `demo.klarwerk.io` sichtbar gekennzeichnet, unter der echten Adresse gar nicht", async () => {
    expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();
    const seite = seiteRoh(stand);

    async function oeffentlich(host: string, breite: number): Promise<OeffentlicherBefund> {
      anfrageHost = host;
      mitBearer = false;
      const vorher = featureAbrufe;
      await seite.setViewportSize({ width: breite, height: HOEHE });
      await wechsle(stand, "/", '[data-testid="auth-brand-panel"]');
      expect(
        stand.fehler,
        `die Anmeldemaske kam unter „${host}" bei ${breite} px nicht hoch`,
      ).toBeNull();
      const b = await seite.evaluate<OeffentlicherBefund>(OEFFENTLICH);
      expect(
        featureAbrufe,
        `unter „${host}" hat die Anmeldemaske die Schalter-Auskunft gar nicht geholt — der Fall sagt nichts über den Host`,
      ).toBeGreaterThan(vorher);
      // ES IST WIRKLICH DIE ANMELDEMASKE, und sie steht wirklich. Ohne diese fünf Zeilen wäre der
      // Negativfall unten auch dann grün, wenn gar nichts gerendert hätte — oder wenn die Bühne
      // statt der Maske die angemeldete Hülle zeigte.
      expect(b.markeDa, `die Markenspalte fehlt unter „${host}"`).toBe(true);
      expect(b.ankerDa, `der schmale Markenanker fehlt unter „${host}"`).toBe(true);
      expect(b.formDa, `die Anmeldemaske hat unter „${host}" kein Formular`).toBe(true);
      expect(
        b.kopfbandDa,
        `unter „${host}" steht die angemeldete Hülle statt der Anmeldemaske — der Fall misst die falsche Fläche`,
      ).toBe(false);
      expect(
        b.karteText.length,
        `die Anmeldekarte ist unter „${host}" ohne Überschrift`,
      ).toBeGreaterThan(0);
      return b;
    }

    const bericht = (breite: number, b: OeffentlicherBefund): string =>
      `${breite} px: ${b.kennzeichen.length} Kennzeichen${b.kennzeichen
        .map(
          (k) =>
            ` · ${k.form} „${k.text}" ${k.breite.toFixed(1)}×${k.hoehe.toFixed(1)} px, gezeichnet ` +
            `${k.gezeichnet}, visibility ${k.sichtbarkeit}, opacity ${k.deckkraft}, color ` +
            `${k.farbe} (Alpha ${k.schriftAlpha})`,
        )
        .join("")}`;

    /** Was an dieser Breite WIRKLICH gezeichnet ist — und dass es dann auch sichtbar ist. */
    function pruefeSichtbar(breite: number, b: OeffentlicherBefund): void {
      // Beide Bausteine tragen sie; gezeichnet ist je Breite genau der, der dort dran ist
      // (Spalte `hidden … lg:flex`, Anker `lg:hidden`). Nur einer von beiden hieße: auf der
      // Hälfte der Geräte unsichtbar — und genau das würde hier rot.
      expect(
        b.kennzeichen.map((k) => k.form).sort(),
        `${breite} px: nicht beide öffentlichen Bausteine tragen die Kennzeichnung`,
      ).toEqual(["marke", "marke"]);
      const gezeichnet = b.kennzeichen.filter((k) => k.gezeichnet);
      expect(
        gezeichnet.length,
        `${breite} px: keine einzige Kennzeichnung ist gezeichnet`,
      ).toBeGreaterThan(0);
      for (const k of gezeichnet) {
        // SICHTBAR heisst sichtbar: Text da, Kasten da, nichts unsichtbar gestellt.
        expect(
          k.text.toLowerCase(),
          `${breite} px: die sichtbare Kennzeichnung trägt keinen Text`,
        ).toContain("demo");
        expect(k.breite, `${breite} px: die Kennzeichnung ist 0 px breit`).toBeGreaterThan(0);
        expect(k.hoehe, `${breite} px: die Kennzeichnung ist 0 px hoch`).toBeGreaterThan(0);
        expect(k.sichtbarkeit, `${breite} px: die Kennzeichnung steht auf visibility:hidden`).toBe(
          "visible",
        );
        expect(
          Number(k.deckkraft),
          `${breite} px: die Kennzeichnung ist durchsichtig`,
        ).toBeGreaterThan(0);
        expect(
          k.schriftAlpha,
          `${breite} px: die Schrift der Kennzeichnung ist durchsichtig`,
        ).toBeGreaterThan(0);
      }
    }

    // ---- UNTER DEM HOST DER ECHTEN ANWENDUNG: KEIN Zeichen. Das ist die Zusage, auf die es
    // ankommt — ein Demo-Etikett auf der echten Anmeldemaske machte echte Arbeit unglaubwürdig.
    const echt = await oeffentlich(ECHT_HOST, 1280);
    expect(
      echt.kennzeichen,
      `unter „${ECHT_HOST}" steht eine Demo-Kennzeichnung auf der echten Anmeldemaske`,
    ).toEqual([]);

    // ---- UNTER `demo.klarwerk.io`, an beiden zugesicherten Breiten.
    const demoBreit = await oeffentlich(DEMO_HOST, 1280);
    const demoSchmal = await oeffentlich(DEMO_HOST, 390);
    console.log(
      `${KENNUNG} · Anmeldemaske / · ${ECHT_HOST} → ${DEMO_HOST} · ` +
        `${bericht(1280, echt)} → ${bericht(1280, demoBreit)} · ${bericht(390, demoSchmal)}`,
    );
    pruefeSichtbar(1280, demoBreit);
    pruefeSichtbar(390, demoSchmal);
  }, 180_000);
});
