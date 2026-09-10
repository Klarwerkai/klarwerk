// ================================================================================================
// JOB 3335 · UX-21 — DIE MESSUNG AM ECHTEN GERÄT: 768 px, gebaute Seite, Chromium.
// ================================================================================================
// Der gemountete Test daneben misst, WAS im Baum steht. Er kann nicht messen, wie breit es ist —
// jsdom hat kein Layout. Genau darum ging es aber in N-0044: bei 768 px stand der Text in 356 px
// neben einer 380 px breiten Liste. Hier wird deshalb die gebaute Seite in Chromium bei
// Tablet-Breite vermessen: Breite des Berichtstexts, Breite und Lage der Liste, ob der Schalter
// frei liegt (nicht unter der Schublade), kein seitlicher Überlauf — und zur Kalibrierung 1280 und
// 390, die sich nicht ändern dürfen.
//
// EINE Browserinstanz für alle Fälle (`h4-harness`, dieselbe Vorrichtung wie die Zielbild-Messung
// und wie `tests/bibliothek-schmal/telefon-chromium.test.ts`): mehr Instanzen kippen im Gesamttor
// fremde Browsertests (`h6-chromium.ts:317-324`). Keine eigene Startstelle: Playwright kommt über
// den Prüfstand, nicht über einen zweiten `require("playwright")`.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  BEREICH_FREI,
  type H4Stand,
  ORIGIN,
  TITEL_FREI,
  TITEL_OFFEN,
  fn,
  h4Stand,
} from "../design/h4-harness";

/** So viele zusätzliche Einträge, dass die gefilterte Liste sicher über die Rollspur hinausläuft. */
const ZUSATZ = 40;

/**
 * Die INHALTSBREITE bei 768 px: die Hülle hält links und rechts 16 px Rand (`AppShell.tsx:102`,
 * `px-4`). Mehr als das kann keine Fläche der Seite bekommen.
 */
const INHALT_768 = 768 - 2 * 16;
/**
 * Der Leseraum des Tablets: die Zeilenlängengrenze der Berichtsspalte (`BibliothekFlaeche.tsx`,
 * `LESERAUM_TEXT_PX` — die Begründung steht dort). Hier steht die Zahl als PIN: eine Änderung der
 * Zeilenlänge ist eine Gestaltungsentscheidung und soll gesehen werden.
 */
const LESERAUM_TEXT = 600;
/** Die Spaltenbreite der Liste aus der Vorlage (`BibliothekListe.tsx`, `w-[380px]`). */
const LISTE = 380;

interface Kasten {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
}
interface Befund {
  fenster: number;
  lesen: number | null;
  liste: (Kasten & { lage: string | null }) | null;
  titel: number | null;
  titelText: string;
  zurueck: Kasten | null;
  /** Was in der Mitte des Rückwegs WIRKLICH oben liegt — er selbst oder die Schublade. */
  zurueckFrei: boolean | null;
  schalter: (Kasten & { text: string; expanded: string | null }) | null;
  /** Dasselbe für den Schalter: nur ein freiliegender Knopf ist mit der Maus zu erreichen. */
  schalterFrei: boolean | null;
  ueberlauf: number;
}

const MESSEN = `() => {
  const q = (s) => document.querySelector(s);
  const breite = (el) => (el ? Math.round(el.getBoundingClientRect().width) : null);
  const kasten = (el) => {
    if (!el) { return null; }
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top), breite: Math.round(r.width), hoehe: Math.round(r.height) };
  };
  const frei = (el) => {
    if (!el) { return null; }
    const r = el.getBoundingClientRect();
    const oben = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return oben !== null && (oben === el || el.contains(oben));
  };
  const titel = q('[data-testid="bib-titel"]');
  const liste = q('[data-testid="bib-liste"]');
  const zurueck = q('[data-testid="bib-zurueck"]');
  const schalter = q('[data-testid="bib-liste-schalter"]');
  return {
    fenster: window.innerWidth,
    lesen: breite(q('[data-testid="bib-lesen"]')),
    liste: liste ? { ...kasten(liste), lage: liste.getAttribute('data-lage') } : null,
    titel: breite(titel),
    titelText: titel ? titel.textContent.trim() : '',
    zurueck: kasten(zurueck),
    zurueckFrei: frei(zurueck),
    schalter: schalter
      ? { ...kasten(schalter), text: schalter.textContent.trim(), expanded: schalter.getAttribute('aria-expanded') }
      : null,
    schalterFrei: frei(schalter),
    ueberlauf: document.documentElement.scrollWidth - window.innerWidth,
  };
}`;

const SCHALTER_KLICK = `() => {
  const el = document.querySelector('[data-testid="bib-liste-schalter"]');
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
  console.info(`JOB 3335 UX-21 · ${breite}x${hoehe}: ${JSON.stringify(m)}`);
  return m;
}

describe("JOB 3335 · UX-21 · das Lese-Tablet in Chromium (gebaute Seite)", () => {
  beforeAll(async () => {
    try {
      // `/wissen/:frei` ist die Adresse mit GEWÄHLTEM Bericht — der Fall aus dem Befund N-0044.
      // Der Bestand bekommt zusätzlich `ZUSATZ` Einträge im Bereich des freigegebenen Eintrags
      // (`BEREICH_FREI`): ohne eine Liste, die länger ist als die Rollspur, gibt es keine
      // Rollposition, und T6/T7 mässen 0 gegen 0. Auf die Breitenmessungen T1–T4 wirkt die Zahl
      // nicht — Liste (380 px) und Leseraum (600 px) sind gesetzt.
      stand = await h4Stand("/wissen/:frei", "pedi@job3335.test", async ({ services, autorId }) => {
        for (let i = 0; i < ZUSATZ; i++) {
          await services.ko.create({
            title: `JOB 3335 Bestandseintrag ${String(i).padStart(2, "0")}`,
            statement: "Ein Eintrag, der die Trefferliste über die Rollspur hinaus verlängert.",
            type: "best_practice",
            category: BEREICH_FREI,
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

  it("T1 · 768 px: der Bericht steht im Leseraum, die Liste nicht daneben, der Schalter liegt frei", async () => {
    expect(fehler).toBeNull();
    const m = await messen(768, 1024);
    expect(m.fenster).toBe(768);
    // VORHER (N-0044, hier nachgemessen an 1.0.0-beta.1.244 vor dem Umbau): Liste 380 px, Text
    // 356 px. NACHHER: keine Liste neben dem Text, der Text hat die Breite des Leseraums.
    expect(m.liste).toBeNull();
    expect(m.lesen).toBe(LESERAUM_TEXT);
    expect(m.titel).toBe(LESERAUM_TEXT);
    expect(m.titelText).toBe(TITEL_FREI);
    // Und der Leseraum hat Abstand zum Rand: er ist schmaler als die Inhaltsbreite.
    expect(LESERAUM_TEXT).toBeLessThan(INHALT_768);
    expect(m.zurueck?.breite ?? 0).toBeGreaterThan(0);
    expect(m.zurueckFrei).toBe(true);
    expect(m.schalter).not.toBeNull();
    expect(m.schalter?.expanded).toBe("false");
    expect(m.schalterFrei).toBe(true);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  it("T2 · 768 px, ausgeklappt: die Liste liegt 380 px breit ÜBER dem Bericht, der Text weicht nicht, der Schalter bleibt frei", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(await s.seite.evaluate<boolean>(fn(SCHALTER_KLICK))).toBe(true);
    await s.seite.waitForTimeout(400);
    const m = await s.seite.evaluate<Befund>(fn(MESSEN));
    console.info(`JOB 3335 UX-21 · 768 ausgeklappt: ${JSON.stringify(m)}`);
    expect(m.liste).not.toBeNull();
    expect(m.liste?.breite).toBe(LISTE);
    expect(m.liste?.lage).toBe("darueber");
    // Die Liste beginnt am linken Rand der Inhaltsfläche (16 px Hüllenrand) und UNTER der Leiste
    // mit Rückweg und Schalter — sie deckt keinen der beiden Knöpfe.
    expect(m.liste?.x).toBe(16);
    expect(m.liste?.y ?? 0).toBeGreaterThanOrEqual((m.schalter?.y ?? 0) + (m.schalter?.hoehe ?? 0));
    expect(m.liste?.y ?? 0).toBeGreaterThanOrEqual((m.zurueck?.y ?? 0) + (m.zurueck?.hoehe ?? 0));
    // … und der Bericht weicht NICHT: dieselbe Textbreite wie eingeklappt — keine Quetsche (N-0044).
    expect(m.lesen).toBe(LESERAUM_TEXT);
    expect(m.titel).toBe(LESERAUM_TEXT);
    // Beide Knöpfe liegen frei — sonst könnte niemand die Schublade mit der Maus wieder
    // schliessen, und ein Fokus darunter wäre unsichtbar (N-0001/0035).
    expect(m.schalter?.expanded).toBe("true");
    expect(m.schalterFrei).toBe(true);
    expect(m.zurueck).not.toBeNull();
    expect(m.zurueckFrei).toBe(true);
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
    // Zurückklappen — die Liste verlässt den Baum, die Textbreite bleibt.
    expect(await s.seite.evaluate<boolean>(fn(SCHALTER_KLICK))).toBe(true);
    await s.seite.waitForTimeout(400);
    const zu = await s.seite.evaluate<Befund>(fn(MESSEN));
    expect(zu.liste).toBeNull();
    expect(zu.lesen).toBe(LESERAUM_TEXT);
  }, 60_000);

  it("T3 · 1280 px: breit steht die alte Anordnung — 380 px Liste, 720 px Bericht, kein Schalter", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await s.seite.goto(`${ORIGIN}/wissen/${s.koId}`, { waitUntil: "load" });
    const m = await messen(1280, 900);
    expect(m.liste?.breite).toBe(LISTE);
    expect(m.liste?.lage).toBe("spalte");
    expect(m.lesen).toBe(720);
    expect(m.zurueck).toBeNull();
    expect(m.schalter).toBeNull();
  }, 60_000);

  it("T4 · 390 px: das Telefon bleibt JOB 3121 — Bericht mit Breite, keine Liste, kein Schalter", async () => {
    expect(fehler).toBeNull();
    const m = await messen(390, 844);
    expect(m.liste).toBeNull();
    expect(m.lesen).toBeGreaterThan(300);
    expect(m.zurueck?.breite ?? 0).toBeGreaterThan(0);
    expect(m.schalter).toBeNull();
    expect(m.ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  // ==============================================================================================
  // T6/T7 · JOB 3335 RUNDE 2 — BENs KORREKTURPFLICHT 2: DER ROLLSTAND DER SCHUBLADE, IN PIXELN.
  // ==============================================================================================
  // Runde 1 belegte Lieferung 4 mit Fokusfällen; das beweist keinen Rollstanderhalt (BEN). Hier
  // wird die Liste WIRKLICH gerollt: lange gefilterte Liste (`ZUSATZ` Einträge im Bereich
  // `BEREICH_FREI`), Bericht offen, Schublade auf, Rollspur auf `ROLLZIEL`, zweimal klappen —
  // und dann Position UND Fokus gemessen. T6 ist der Fall des Befunds: der offene Bericht liegt
  // AUSSERHALB der gefilterten Treffer (der offene Eintrag ist „Produktion", gefiltert wird auf
  // „Konstruktion"), T7 die Kontrolle mit dem Bericht in den Treffern.
  const ROLLZIEL = 600;
  // RUNDE 3 (Tor der Runde 2: „Invalid left-hand side in assignment" in T6 UND T7): der Selektor
  // wird in BROWSER-QUELLTEXT eingesetzt, und dort muss er als String-Literal stehen. Runde 2
  // setzte den nackten Wert ein — `querySelector([data-testid="bib-spur"])` ist für den Browser
  // ein Array-Literal mit einer Zuweisung an `data-testid`, also ein Syntaxfehler, der jede der
  // vier Auswertungen unten kippte, bevor ein Pixel gemessen war. `JSON.stringify` liefert das
  // Literal samt Anführungszeichen; T6/T7 messen damit erstmals wirklich.
  const SPUR = JSON.stringify('[data-testid="bib-spur"]');
  const rollstand = `() => {
    const spur = document.querySelector(${SPUR});
    const a = document.activeElement;
    const r = a ? a.getBoundingClientRect() : null;
    const s = spur ? spur.getBoundingClientRect() : null;
    return {
      spur: spur ? spur.scrollTop : null,
      spurHoehe: spur ? spur.scrollHeight - spur.clientHeight : null,
      zeilen: document.querySelectorAll('[data-testid="bib-zeile"]').length,
      fokusMarke: a ? a.getAttribute('data-testid') : null,
      fokusId: a ? a.getAttribute('data-bib-id') : null,
      fokusImBild: r && s ? r.bottom > s.top && r.top < s.bottom : null,
      titel: ((document.querySelector('[data-testid="bib-titel"]') || {}).textContent || '').trim() || null,
    };
  }`;
  interface Roll {
    spur: number | null;
    spurHoehe: number | null;
    zeilen: number;
    fokusMarke: string | null;
    fokusId: string | null;
    fokusImBild: boolean | null;
    titel: string | null;
  }
  async function klappe(offen: boolean): Promise<void> {
    const s = stand as H4Stand;
    const jetzt = await s.seite.evaluate<string | null>(
      fn(
        `() => { const b = document.querySelector('[data-testid="bib-liste-schalter"]'); return b ? b.getAttribute('aria-expanded') : null; }`,
      ),
    );
    if (jetzt !== String(offen)) {
      expect(await s.seite.evaluate<boolean>(fn(SCHALTER_KLICK))).toBe(true);
    }
    await s.seite.waitForFunction(
      fn(`(offen) => !!document.querySelector(${SPUR}) === offen`),
      offen,
      { timeout: 30_000 },
    );
    await s.seite.waitForTimeout(300);
  }
  async function rolleUndKlappe(
    adresse: string,
    titel: string,
  ): Promise<{ vorher: Roll; nachher: Roll }> {
    const s = stand as H4Stand;
    await s.seite.setViewportSize({ width: 768, height: 1024 });
    await s.seite.goto(`${ORIGIN}${adresse}`, { waitUntil: "load" });
    await s.seite.waitForFunction(
      fn(
        `(t) => ((document.querySelector('[data-testid="bib-titel"]') || {}).textContent || '').trim() === t`,
      ),
      titel,
      { timeout: 30_000 },
    );
    await klappe(true);
    await s.seite.waitForFunction(
      fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length > 30`),
      undefined,
      { timeout: 30_000 },
    );
    const vorher = await s.seite.evaluate<Roll>(
      fn(`(ziel) => {
        const spur = document.querySelector(${SPUR});
        spur.scrollTop = ziel;
        return (${rollstand})();
      }`),
      ROLLZIEL,
    );
    await klappe(false);
    await klappe(true);
    const nachher = await s.seite.evaluate<Roll>(fn(rollstand));
    console.info(
      `JOB 3335 UX-21 · Rollstand ${adresse}: vorher=${JSON.stringify(vorher)} nachher=${JSON.stringify(nachher)}`,
    );
    return { vorher, nachher };
  }

  it("T6 · 768 px, Bericht AUSSERHALB der Treffer: die Rollposition überlebt zweimaliges Klappen, der Fokus liegt sichtbar in der Liste", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    const { vorher, nachher } = await rolleUndKlappe(
      `/bibliothek?category=${encodeURIComponent(BEREICH_FREI)}&eintrag=${s.koOffenId}`,
      TITEL_OFFEN,
    );
    // Ohne echten Rollweg misst der Test nichts (0 gegen 0) — das ist hier die Voraussetzung.
    expect(vorher.zeilen).toBeGreaterThan(30);
    expect(vorher.spurHoehe ?? 0).toBeGreaterThan(ROLLZIEL);
    expect(vorher.spur).toBe(ROLLZIEL);
    // Der Bericht liegt außerhalb: seine Zeile ist nicht in der Liste.
    expect(vorher.titel).toBe(TITEL_OFFEN);
    expect(
      await s.seite.evaluate<number>(
        fn(
          `(id) => document.querySelectorAll('[data-testid="bib-zeile"][data-bib-id="' + id + '"]').length`,
        ),
        s.koOffenId,
      ),
    ).toBe(0);
    // Nach Zu und Auf: dieselbe Stelle, der Bericht noch offen, der Fokus auf einer SICHTBAREN Zeile.
    expect(nachher.spur).toBe(ROLLZIEL);
    expect(nachher.titel).toBe(TITEL_OFFEN);
    expect(nachher.fokusMarke).toBe("bib-zeile");
    expect(nachher.fokusImBild).toBe(true);
  }, 90_000);

  it("T7 · KONTROLLE, Bericht IN den Treffern: Rollposition bleibt, der Fokus liegt sichtbar in der Liste", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    const { vorher, nachher } = await rolleUndKlappe(
      `/bibliothek?category=${encodeURIComponent(BEREICH_FREI)}&eintrag=${s.koId}`,
      TITEL_FREI,
    );
    expect(vorher.spur).toBe(ROLLZIEL);
    // Beim ersten Ausklappen lag der Fokus auf der gelesenen Zeile (R8); nach dem Rollen und
    // zweimaligem Klappen zählt die POSITION: sie bleibt, und der Fokus nimmt eine sichtbare Zeile —
    // die gelesene, wenn sie im Bild ist, sonst die erste sichtbare. WO die gelesene Zeile steht,
    // sagt die Vorgabe-Reihung „relevance" (`librarySort.ts`: die Reihenfolge des Servers,
    // nicht der Titel); der Fall verlangt deshalb nur, dass der Fokus auf EINER Zeile im Bild
    // liegt — nicht, auf welcher.
    expect(nachher.spur).toBe(ROLLZIEL);
    expect(nachher.titel).toBe(TITEL_FREI);
    expect(nachher.fokusMarke).toBe("bib-zeile");
    expect(nachher.fokusImBild).toBe(true);
    await klappe(false);
  }, 90_000);

  it("T5 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
