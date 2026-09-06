// ================================================================================================
// JOB 3114 · UX-05 — DER SATZ MUSS AUCH AUF 320 px GANZ DASTEHEN.
// ================================================================================================
//
// Lieferung 6 des Auftrags ist eine Aussage ueber LAYOUT: „Der Satz bricht um und bleibt bei 320 px
// und 390 px vollstaendig lesbar; er verdeckt weder den Einreichen-Knopf noch das Feld und erzeugt
// keinen waagerechten Rollbalken." jsdom kann das nicht beantworten — es hat keine Layout-Engine,
// jedes Rechteck ist dort 0×0. Eine Zusicherung im jsdom-Test waere also keine Messung, sondern
// eine Behauptung mit Testanstrich.
//
// Deshalb laeuft dieser Fall in CHROMIUM, an der ECHTEN gebauten Seite, auf der vorhandenen Buehne
// der H3-Messungen (`tests/design/h3-blatt-buehne.ts` — nur benutzt, nicht veraendert). Der Weg ist
// der eines Menschen: schmales Fenster, Blatt oeffnen, „Einreichen" ohne gewaehlte Stufe druecken.
//
// WAS GEMESSEN WIRD, UND WARUM GERADE DAS:
//   1. Der Satz steht VOLLSTAENDIG da — nicht abgeschnitten. Gemessen ueber `scrollWidth <=
//      clientWidth` am Hinweis selbst: waere der Text breiter als seine Box, laege Text ausserhalb.
//   2. Er liegt IM Fenster (linke Kante >= 0, rechte Kante <= Fensterbreite). Ein Satz, der rechts
//      hinausragt, ist nicht lesbar, auch wenn er im Baum steht.
//   3. Er verdeckt weder den Einreichen-Knopf noch das Vertraulichkeits-Werkzeug: die Rechtecke
//      ueberschneiden sich nicht.
//   4. Er erzeugt keinen waagerechten Rollbalken, den es nicht schon vorher gab. Bewusst als
//      VERGLEICH mit dem Zustand VOR dem Klick und nicht als absolute Zusage: was die Werkzeugzeile
//      bei 320 px sonst noch tut, ist nicht der Gegenstand dieses Auftrags — dass der Satz nichts
//      verschlimmert, schon.
//
// OHNE `apps/web/dist` laeuft die Datei nicht (dieselbe Bedingung wie bei allen H3-Messungen). Im
// Tor ist der Bau immer da (`tools/check` baut zuerst).
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type Buehne, DIST, buehneAufbauen, fn } from "../design/h3-blatt-buehne";

/** Die beiden Breiten aus Lieferung 6. */
const BREITEN = [320, 390] as const;

const HINWEIS = '[data-testid="blatt-vertraulichkeit-hinweis"]';
const WERKZEUG = '[data-testid="blatt-werkzeug-vertraulichkeit"]';
const EINREICHEN = '[data-testid="blatt-einreichen"]';

/** In der Seite: ein Element anklicken — der echte Klickweg, den React hoert. */
const KLICK = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  el.click();
  return true;
}`;

/** In der Seite: Rechteck, Textbreiten und Text eines Elements. */
const MASS = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
    links: r.left,
    rechts: r.right,
    oben: r.top,
    unten: r.bottom,
    scrollBreite: el.scrollWidth,
    innenBreite: el.clientWidth,
    zeilen: r.height,
  };
}`;

/** In der Seite: die waagerechte Ueberlaenge des Dokuments. */
const UEBERLAUF =
  "() => document.documentElement.scrollWidth - document.documentElement.clientWidth";

interface Mass {
  text: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
  scrollBreite: number;
  innenBreite: number;
  zeilen: number;
}

/**
 * Die Buehne gibt eine schmale Sicht auf die Playwright-Seite; Groesse und Ruhezustand liegen
 * darunter.
 *
 * WARUM `waitForLoadState` HIER STEHT (JOB 3114 R2, gemessen): Ohne ihn war dieser Fall FLAKIG —
 * in 3 von 5 Laeufen fiel er mit „der Erklaersatz steht nicht auf der Flaeche" aus. Ursache ist
 * kein Produktfehler, sondern ein zu frueher Klick: die Buehne wartet nur auf
 * `[data-testid="blatt"]`, waehrend der Entwurfs-Ladeweg des Blattes noch laeuft. Trifft dessen
 * Antwort NACH dem Klick ein, setzt `Blatt.tsx:624` (`setVertraulichkeitMarkiert(false)`) die
 * Markierung zurueck — und mit ihr den Satz. Ein Test, der so gewinnt oder verliert, misst die
 * Netzlaufzeit und nicht das Layout.
 */
interface SeiteMitGroesse {
  setViewportSize(g: { width: number; height: number }): Promise<void>;
  waitForLoadState(zustand: string, opts?: { timeout?: number }): Promise<void>;
}

const distDa = existsSync(join(DIST, "index.html"));

describe.runIf(distDa)("JOB 3114 · UX-05 · der Erklaersatz auf schmalen Flaechen", () => {
  const buehnen: Buehne[] = [];

  afterAll(async () => {
    for (const b of buehnen) {
      await b.schliessen();
    }
  }, 60_000);

  for (const breite of BREITEN) {
    it(`B${breite} · bei ${breite} px steht der Satz ganz da, im Fenster, ohne etwas zu verdecken`, async () => {
      const b = await buehneAufbauen("/erfassen");
      buehnen.push(b);
      expect(b.fehler, "Buehne nicht aufgebaut").toBeNull();
      const seite = b.seite as unknown as SeiteMitGroesse;
      await seite.setViewportSize({ width: breite, height: 800 });

      // ERST RUHEN LASSEN, DANN DRUECKEN. Der Einreichen-Knopf muss da sein (React hat die Zeile
      // montiert) UND das Blatt darf keine Anfrage mehr offen haben — sonst raeumt eine spaet
      // eintreffende Antwort die Markierung wieder weg, und der Fall misst die Netzlaufzeit.
      await b.seite.waitForFunction(
        fn("(sel) => document.querySelector(sel) !== null"),
        EINREICHEN,
        { timeout: 30_000 },
      );
      await seite.waitForLoadState("networkidle", { timeout: 30_000 });

      // Der Zustand VOR dem Klick: der Satz steht nicht da (das ist F8, hier nur die Kalibrierung
      // fuer den Ueberlauf-Vergleich).
      expect(await b.seite.evaluate<Mass | null>(fn(MASS), HINWEIS)).toBeNull();
      const ueberlaufVorher = await b.seite.evaluate<number>(fn(UEBERLAUF));

      expect(await b.seite.evaluate<boolean>(fn(KLICK), EINREICHEN)).toBe(true);
      await b.seite.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), HINWEIS, {
        timeout: 10_000,
      });

      const hinweis = await b.seite.evaluate<Mass | null>(fn(MASS), HINWEIS);
      expect(hinweis, "der Erklaersatz steht nicht auf der Flaeche").not.toBeNull();
      if (!hinweis) {
        return;
      }

      // 1 — VOLLSTAENDIG: der Text passt in seine eigene Box, nichts ist abgeschnitten.
      expect(
        hinweis.scrollBreite,
        `der Satz ist breiter als seine Box (${hinweis.scrollBreite} > ${hinweis.innenBreite}) — er ist abgeschnitten`,
      ).toBeLessThanOrEqual(hinweis.innenBreite);
      // Und er ist WIRKLICH der Satz, nicht ein leeres Element mit der richtigen Kennung.
      expect(hinweis.text.length, `der Satz ist zu kurz: „${hinweis.text}“`).toBeGreaterThan(30);
      // Er BRICHT UM: auf 320 px passt der Satz in keine einzelne Zeile — steht er trotzdem ganz
      // da, ist er umgebrochen. Eine Zeile waere hier der Beweis, dass er hinausragt.
      expect(
        hinweis.zeilen,
        `der Satz belegt nur ${hinweis.zeilen} px Hoehe — er bricht nicht um`,
      ).toBeGreaterThan(20);

      // 2 — IM FENSTER.
      expect(
        hinweis.links,
        "der Satz beginnt links ausserhalb des Fensters",
      ).toBeGreaterThanOrEqual(0);
      expect(
        hinweis.rechts,
        `der Satz ragt rechts hinaus (${hinweis.rechts} > ${breite})`,
      ).toBeLessThanOrEqual(breite);

      // 3 — ER VERDECKT NICHTS.
      for (const [name, sel] of [
        ["der Einreichen-Knopf", EINREICHEN],
        ["das Vertraulichkeits-Werkzeug", WERKZEUG],
      ] as const) {
        const anderes = await b.seite.evaluate<Mass | null>(fn(MASS), sel);
        expect(anderes, `${name} ist nicht auf der Flaeche`).not.toBeNull();
        if (!anderes) {
          continue;
        }
        const ueberschneidet =
          hinweis.links < anderes.rechts &&
          hinweis.rechts > anderes.links &&
          hinweis.oben < anderes.unten &&
          hinweis.unten > anderes.oben;
        expect(ueberschneidet, `der Satz liegt ueber ${name}`).toBe(false);
      }

      // 4 — KEIN NEUER WAAGERECHTER ROLLBALKEN.
      const ueberlaufNachher = await b.seite.evaluate<number>(fn(UEBERLAUF));
      expect(
        ueberlaufNachher,
        `der Satz hat die Seite waagerecht verbreitert (vorher ${ueberlaufVorher}, nachher ${ueberlaufNachher})`,
      ).toBeLessThanOrEqual(ueberlaufVorher);
    }, 180_000);
  }
});
