// ================================================================================================
// JOB 3761 · C — DIE KENNZEICHNUNG IM BROWSER, AN DER ENGSTEN UND AN DER BREITESTEN BREITE.
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
// DER SCHALTER KOMMT AUS DER UMGEBUNG, wie beim Kunden: `KLARWERK_DEMO_INSTANZ` wird gesetzt, der
// Server beantwortet `GET /api/features` daraufhin mit `demoInstanz: true` (`feature-flags.ts`
// liest pro Aufruf, nicht beim Modulladen), und die gebaute Seite holt sich die Auskunft selbst.
// Keine Attrappe, kein in die Seite geschriebener Zustand.
//
// DIE FIRMEN-CI KOMMT ÜBER DEN ECHTEN ADMINWEG (`PUT /api/admin/branding`, `schalteCi`) — dieselbe
// Vorrichtung, die JOB 3571/3582/3641 benutzt haben. Zwei Wahrheiten über dieselbe Zeile gibt es
// damit nicht.
//
//   C0  Die Voraussetzung wird selbst gemessen: OHNE Schalter steht keine Kennzeichnung da (das
//       ist der Zustand der ECHTEN Instanz), MIT Schalter steht sie gezeichnet da.
//   C1  Sie liegt ÜBER der Kopfbandzeile und überlappt sie nicht — auf 390 px und auf 1280 px.
//   C2  Die Kopfbandzeile misst mit ihr ZEICHENGLEICH dasselbe wie ohne sie: Logokasten,
//       Wortmarke und der rechteste Kasten stehen auf denselben Pixeln, nichts läuft hinaus.
//   C3  Und die Seite bekommt keinen waagerechten Rollbalken.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Stand, fn, starte } from "../design/h6-chromium";
import {
  type LogoBefund,
  type Messung,
  meldeAn,
  messeMitCi,
  schalteCi,
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

const KENNUNG = "JOB 3761";
const HOEHE = 800;
/** Die engste zugesicherte Breite (JOB 3582, Fall CI1) und die des Mockups (JOB 3060). */
const BREITEN = [390, 1280] as const;
const VARIABLE = "KLARWERK_DEMO_INSTANZ";

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

let stand: Stand;
let bearer = "";

/** Der rechteste gezeichnete Kasten der Zeile — der, der als Erster hinausliefe. */
function rechtester(m: Messung): { name: string; rechts: number } {
  const k = [...m.kaesten].sort((a, b) => b.rechts - a.rechts)[0];
  if (!k) {
    throw new Error("kein gezeichneter Kasten im Kopfband");
  }
  return { name: k.name, rechts: k.rechts };
}

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

/** Eine Breite mit Firmen-CI messen, den Demo-Schalter auf `an` — Seite wird neu geladen. */
async function messeMitDemo(
  breite: number,
  an: boolean,
): Promise<{ m: Messung; logo: LogoBefund; b: Befund }> {
  if (an) {
    process.env[VARIABLE] = "1";
  } else {
    delete process.env[VARIABLE];
  }
  const { m, logo } = await messeMitCi(stand, breite, HOEHE);
  return { m, logo, b: await lies() };
}

beforeAll(async () => {
  delete process.env[VARIABLE];
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
}, 300_000);

afterAll(async () => {
  delete process.env[VARIABLE];
  try {
    await schliesseChromium("tests/demo-kennzeichnung/band-chromium.test.ts", stand?.browser);
  } finally {
    await stand?.app?.close();
  }
}, 60_000);

describe("JOB 3761 C · die Demo-Kennzeichnung im gebauten Produkt", () => {
  for (const breite of BREITEN) {
    it(`C0–C3 · ${breite} px mit Firmen-CI: sichtbar, über der Zeile, ohne einen Pixel zu kosten`, async () => {
      expect(stand.fehler, "die Bühne kam nicht hoch").toBeNull();

      // ---- OHNE Schalter: der Zustand der ECHTEN Instanz. Er ist zugleich der Vergleichswert,
      // und er entsteht am SELBEN Stand in DIESEM Lauf — keine gepinnte Zahl.
      const ohne = await messeMitDemo(breite, false);
      expect(
        ohne.b.bandDa,
        "ohne gesetzten Schalter steht eine Demo-Kennzeichnung in der echten Anwendung",
      ).toBe(false);
      const ohneRechts = rechtester(ohne.m);

      // ---- MIT Schalter.
      const mit = await messeMitDemo(breite, true);
      expect(mit.b.bandGezeichnet, "die Kennzeichnung ist nicht gezeichnet").toBe(true);
      expect(mit.b.bandText.toLowerCase(), "die Kennzeichnung trägt keinen Text").toContain("demo");
      const mitRechts = rechtester(mit.m);

      console.log(
        `${KENNUNG} · ${breite} px · Band ${mit.b.bandBreite.toFixed(1)}×${mit.b.bandHoehe.toFixed(1)} px ` +
          `oben ${mit.b.bandOben.toFixed(1)} → ${mit.b.bandUnten.toFixed(1)}; Kopfband oben ` +
          `${ohne.b.kopfOben.toFixed(1)} → ${mit.b.kopfOben.toFixed(1)} px, Höhe ${mit.b.kopfHoehe.toFixed(1)} px · ` +
          `Logokasten ${ohne.logo.logoBreite.toFixed(1)} → ${mit.logo.logoBreite.toFixed(1)} px · ` +
          `Wortmarke ${ohne.logo.markeBreite.toFixed(1)} → ${mit.logo.markeBreite.toFixed(1)} px · ` +
          `rechtester Kasten ${ohneRechts.name} ${ohneRechts.rechts.toFixed(1)} → ${mitRechts.name} ` +
          `${mitRechts.rechts.toFixed(1)} px im ${breite}-px-Fenster`,
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
