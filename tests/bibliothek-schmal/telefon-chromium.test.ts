// ================================================================================================
// JOB 3121 · UX-14 — DIE MESSUNG AM ECHTEN GERÄT: 390 px und 320 px, gebaute Seite, Chromium.
// ================================================================================================
// Der gemountete Test daneben misst, WELCHE Fläche im DOM steht. Er kann nicht messen, wie breit
// sie ist — jsdom hat kein Layout. Genau das war aber der Befund N-0043: der Bericht stand im DOM
// und hatte die Breite 0. Hier wird deshalb die gebaute Seite in Chromium bei Telefonbreite
// vermessen: Breite des Berichts, Breite der Liste, kein seitlicher Überlauf.
//
// EINE Browserinstanz für alle Fälle (`h4-harness`, dieselbe Vorrichtung wie die Zielbild-Messung):
// mehr Instanzen kippen im Gesamttor fremde Browsertests (`h6-chromium.ts:317-324`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, ORIGIN, TITEL_FREI, fn, h4Stand } from "../design/h4-harness";

// JOB 3121 R2 hatte sich hier ein `interface SeiteMitTastatur extends Seite { keyboard: { press } }`
// gebaut, ausdrücklich mit der Begründung „`h4-harness.ts` ist nicht Zielpfad". Seit JOB 3564 steht
// `keyboard` in `Seite` selbst; die Erweiterung war nur noch eine Wiederholung. JOB 3775 hat
// `keyboard` um `type` ergänzt — damit war die verengende Wiederholung nicht bloß überflüssig,
// sondern ein Typfehler (TS2430). Sie ist entfernt, der Zugriff geht direkt über `Seite`.

/** So viele zusätzliche Einträge, dass die Liste auf 390 px sicher über mehrere Bildschirme läuft. */
const ZUSATZ = 40;

/**
 * Die INHALTSBREITE bei 320 px: die Hülle hält links und rechts 16 px Rand
 * (`AppShell.tsx:102`, `px-4`). Mehr als das kann keine Fläche der Seite bekommen — „füllt die
 * Breite" heißt deshalb genau diese Zahl und nicht 320.
 */
const INHALT_320 = 320 - 2 * 16;

interface Befund {
  fenster: number;
  lesen: number | null;
  liste: number | null;
  titel: number | null;
  titelText: string;
  zurueck: number | null;
  zurueckText: string;
  ueberlauf: number;
}

const MESSEN = `() => {
  const q = (s) => document.querySelector(s);
  const breite = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
  const titel = q('[data-testid="bib-titel"]');
  const zurueck = q('[data-testid="bib-zurueck"]');
  return {
    fenster: window.innerWidth,
    lesen: breite(q('[data-testid="bib-lesen"]')),
    liste: breite(q('[data-testid="bib-liste"]')),
    titel: breite(titel),
    titelText: titel ? titel.textContent.trim() : '',
    zurueck: breite(zurueck),
    zurueckText: zurueck ? zurueck.textContent.trim() : '',
    ueberlauf: document.documentElement.scrollWidth - window.innerWidth,
  };
}`;

const ZURUECK_KLICK = `() => {
  const el = document.querySelector('[data-testid="bib-zurueck"]');
  if (!el) { return false; }
  el.click();
  return true;
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;

async function messen(breite: number, hoehe: number): Promise<Befund> {
  const s = stand as H4Stand;
  await s.seite.setViewportSize({ width: breite, height: hoehe });
  await s.seite.waitForTimeout(400);
  const m = await s.seite.evaluate<Befund>(fn(MESSEN));
  console.info(`JOB 3121 UX-14 · ${breite}x${hoehe}: ${JSON.stringify(m)}`);
  return m;
}

describe("JOB 3121 · UX-14 · die Bibliothek auf dem Telefon (Chromium, gebaute Seite)", () => {
  beforeAll(async () => {
    try {
      // `/wissen/:frei` ist die Adresse mit GEWÄHLTEM Bericht — der Fall aus dem Befund.
      // Der Bestand bekommt zusätzlich `ZUSATZ` Einträge: ohne eine Liste, die länger ist als der
      // Bildschirm, gibt es keine Rollposition, und C5 misst 0 gegen 0. Auf die Breitenmessungen
      // C1–C4 wirkt die Zahl der Einträge nicht — Liste (380 px) und Bericht (720 px) sind gesetzt.
      stand = await h4Stand("/wissen/:frei", "pedi@job3121.test", async ({ services, autorId }) => {
        for (let i = 0; i < ZUSATZ; i++) {
          await services.ko.create({
            title: `JOB 3121 Bestandseintrag ${String(i).padStart(2, "0")}`,
            statement: "Ein Eintrag, der die Liste über den Bildschirmrand hinaus verlängert.",
            type: "best_practice",
            category: "Konstruktion",
            author: autorId,
          } as never);
        }
      });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("C1 · 390 px: der Bericht hat Breite, die Liste steht nicht daneben, nichts läuft seitlich über", async () => {
    expect(fehler).toBeNull();
    const m = await messen(390, 844);
    expect(m.fenster).toBe(390);
    expect(m.liste).toBeNull();
    expect(m.lesen).toBeGreaterThan(300);
    expect(m.titel).toBeGreaterThan(300);
    expect(m.titelText).toBe(TITEL_FREI);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  it("C2 · 320 px: dasselbe an der schmalsten Stelle — der Bericht bleibt lesbar", async () => {
    expect(fehler).toBeNull();
    const m = await messen(320, 568);
    expect(m.liste).toBeNull();
    // Der Bericht nimmt die ganze Inhaltsbreite — vor JOB 3121 waren es 0 px (N-0043).
    expect(m.lesen).toBe(INHALT_320);
    expect(m.titel).toBe(INHALT_320);
    expect(m.zurueck).toBeGreaterThan(0);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  it("C3 · 320 px: der Rückweg führt zur Liste, und die füllt die Breite", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(await s.seite.evaluate<boolean>(fn(ZURUECK_KLICK))).toBe(true);
    await s.seite.waitForTimeout(400);
    const m = await s.seite.evaluate<Befund>(fn(MESSEN));
    console.info(`JOB 3121 UX-14 · nach dem Rückweg: ${JSON.stringify(m)}`);
    expect(m.lesen).toBeNull();
    // Die Liste füllt die Breite — ihre festen 380 px (`BibliothekListe.tsx:128`) sind schmal
    // aufgehoben; ohne das ragte sie bei 320 px über den Bildschirmrand hinaus.
    expect(m.liste).toBe(INHALT_320);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  it("C4 · 1280 px: breit steht die alte Anordnung — 380 px Liste, 720 px Bericht, kein Rückweg", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.goto(`${ORIGIN}/wissen/${s.koId}`, { waitUntil: "load" });
    const m = await messen(1280, 900);
    expect(m.liste).toBe(380);
    expect(m.lesen).toBe(720);
    expect(m.zurueck).toBeNull();
  }, 60_000);

  // ==============================================================================================
  // C5 · JOB 3121 R2 — DIE KORREKTURPFLICHT DES PRÜFERS: DIE LISTENPOSITION IST EINE ROLLPOSITION.
  // ==============================================================================================
  // Runde 1 belegte Lieferung 4 mit „Fokus auf derselben Zeile, Suchbegriff und Reihenfolge
  // unverändert". Das ist zu wenig: der Prüfer maß 1596 px vor dem Lesen und 1696 px danach — die
  // Liste stand nach dem Rückweg an einer anderen Stelle, und der Mensch sucht seine Zeile neu.
  // Hier wird genau das gemessen: langer Bestand, eine Zeile AUSSERHALB der Bildschirmmitte
  // (deshalb die 100 px Versatz — sonst träfe das rollende `focus()` die alte Stelle zufällig),
  // echte Enter-Taste, Rollposition vorher gegen nachher.
  it("C5 · 390 px: der Rückweg gibt die Liste an derselben Rollposition zurück", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.setViewportSize({ width: 390, height: 844 });
    await s.seite.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load" });
    await s.seite.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length > 30`),
      undefined,
      { timeout: 30_000 },
    );
    const vorher = await s.seite.evaluate<{
      scroll: number;
      hoehe: number;
      id: string | null;
      zeilen: number;
    }>(
      fn(`() => {
        const main = document.querySelector('main');
        const zeilen = document.querySelectorAll('[data-testid="bib-zeile"]');
        const zeile = zeilen[Math.min(18, zeilen.length - 1)];
        zeile.scrollIntoView({ block: 'center' });
        main.scrollTop = main.scrollTop - 100;
        return {
          scroll: main.scrollTop,
          hoehe: main.scrollHeight,
          id: zeile.getAttribute('data-bib-id'),
          zeilen: zeilen.length,
        };
      }`),
    );
    console.info(`JOB 3121 UX-14 · C5 vor dem Lesen: ${JSON.stringify(vorher)}`);
    // Ohne echten Rollweg misst der Test nichts (0 gegen 0) — das ist hier die Voraussetzung.
    expect(vorher.zeilen).toBeGreaterThan(30);
    expect(vorher.scroll).toBeGreaterThan(500);

    // Die gewählte Zeile anklicken (derselbe Weg wie `ZURUECK_KLICK`: ein echtes Klickereignis am
    // Element, ohne dass Playwright die Seite dafür rollt — das Rollen ist ja der Messgegenstand).
    expect(
      await s.seite.evaluate<boolean>(
        fn(`(id) => {
          const el = document.querySelector('[data-testid="bib-zeile"][data-bib-id="' + id + '"]');
          if (!el) { return false; }
          el.click();
          return true;
        }`),
        vorher.id,
      ),
    ).toBe(true);
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-zurueck"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await s.seite.waitForTimeout(400);
    const imBericht = await s.seite.evaluate<{ scroll: number; fokus: string | null }>(
      fn(`() => ({
        scroll: document.querySelector('main').scrollTop,
        fokus: document.activeElement ? document.activeElement.getAttribute('data-testid') : null,
      })`),
    );
    console.info(`JOB 3121 UX-14 · C5 im Bericht: ${JSON.stringify(imBericht)}`);
    // Der frisch geöffnete Bericht beginnt oben, nicht an der Rollposition der Liste.
    expect(imBericht.scroll).toBe(0);
    expect(imBericht.fokus).toBe("bib-zurueck");

    // Der Rückweg mit der ECHTEN Enter-Taste auf dem fokussierten Knopf.
    await s.seite.keyboard.press("Enter");
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-liste"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await s.seite.waitForTimeout(400);
    const nachher = await s.seite.evaluate<{
      scroll: number;
      fokusId: string | null;
      zeilen: number;
      imBild: boolean;
    }>(
      fn(`() => {
        const main = document.querySelector('main');
        const a = document.activeElement;
        const r = a ? a.getBoundingClientRect() : null;
        const m = main.getBoundingClientRect();
        return {
          scroll: main.scrollTop,
          fokusId: a ? a.getAttribute('data-bib-id') : null,
          zeilen: document.querySelectorAll('[data-testid="bib-zeile"]').length,
          imBild: r ? r.top < m.bottom && r.bottom > m.top : false,
        };
      }`),
    );
    console.info(`JOB 3121 UX-14 · C5 nach dem Rückweg: ${JSON.stringify(nachher)}`);
    // Die drei Zusagen aus Lieferung 4, in einer Messung: dieselbe Stelle, dieselbe Zeile unter dem
    // Fokus, und der Fokus ist sichtbar (kein Ziel außerhalb des Bildes, N-0001/0035).
    expect(nachher.scroll).toBe(vorher.scroll);
    expect(nachher.fokusId).toBe(vorher.id);
    expect(nachher.imBild).toBe(true);
    expect(nachher.zeilen).toBeGreaterThanOrEqual(vorher.zeilen);
  }, 90_000);

  it("C6 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
