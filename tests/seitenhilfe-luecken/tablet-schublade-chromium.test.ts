// ================================================================================================
// JOB 3669 R3 — DER GEOMETRIEBELEG: DIE TREFFERLISTE LIEGT AUF DEM TABLET **ÜBER** DEM EINTRAG.
// ================================================================================================
//
// BENS KORREKTURPFLICHT AUS RUNDE 2, wörtlich: „Tablet-Zusage in DE/EN/NL richtigstellen: Die
// Trefferliste wird über dem Eintrag eingeblendet. T1 um die tatsächliche Betätigung ergänzen.
// Erwarteter Beleg: Hilfe und geöffnete Listenlage stimmen überein … Für einen visuellen
// Geometriebeleg Chromium verwenden."
//
// Der gemountete Fall nebenan (`erster-weg-hat-seitenhilfe.test.tsx`, T1) drückt den Schalter und
// liest `data-lage`, `absolute` und `z-20`. Das ist die STRUKTUR. Ob zwei Flächen einander wirklich
// verdecken, ist dagegen eine Frage der Geometrie — und jsdom hat kein Layout (dieselbe Lehre wie
// in `tests/bibliothek-schmal/telefon-chromium.test.ts`: „der Bericht stand im DOM und hatte die
// Breite 0"). Deshalb wird hier an der GEBAUTEN Seite gemessen, im echten Chromium, an echten
// Rechtecken:
//
//   G1 · 768 px, mit gewähltem Eintrag: der Schalter wird gedrückt → die Liste steht da, ihre
//        Lage ist `darueber`, ihre Position ist `absolute`, und ihr Rechteck ÜBERSCHNEIDET das
//        Rechteck des Berichts. „Daneben" wäre eine Schnittfläche von 0.
//   G2 · derselbe Schalter noch einmal: die Schublade geht wieder aus dem Baum — auch das sagt die
//        Hilfe zu („Trefferliste ausblenden nimmt sie wieder weg").
//   G3 · EICHUNG bei 1620 px: dort stehen Liste und Bericht nebeneinander, Schnittfläche 0. Ohne
//        diesen Fall wäre „sie überlappen" kein Befund, sondern eine Eigenschaft der Messung.
//
// EIN BROWSER FÜR ALLE FÄLLE, auf der vorhandenen Vorrichtung (`tests/design/h4-harness.ts`): diese
// Datei ist damit KEINE neue Playwright-Startstelle (der Pin in
// `tests/tor-inventar/tor-bestand-vollstaendig.test.ts` B4 bleibt unberührt), und sie ordnet sich
// über den Importgraphen von selbst in die serielle Browser-Gruppe ein.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, fn, h4Stand } from "../design/h4-harness";
import { sprachbestand } from "../support/i18nBestand";

/** Das Lese-Tablet (`shell/useMediaQuery.ts`, `TABLET_LESE_QUERY`: 760–899 px). */
const TABLET = { width: 768, height: 1024 };
/** Die Breite, für die die Vorrichtung gebaut ist — dort gilt die Spaltenlage. */
const BREIT = { width: 1620, height: 1000 };

interface Rechteck {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Befund {
  fenster: number;
  liste: Rechteck | null;
  lage: string | null;
  position: string | null;
  zIndex: string | null;
  lesen: Rechteck | null;
  schalter: string | null;
  offen: string | null;
}

const MESSEN = `() => {
  const q = (s) => document.querySelector(s);
  const rechteck = (el) => {
    if (!el) { return null; }
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  const liste = q('[data-testid="bib-liste"]');
  const schalter = q('[data-testid="bib-liste-schalter"]');
  return {
    fenster: window.innerWidth,
    liste: rechteck(liste),
    lage: liste ? liste.getAttribute('data-lage') : null,
    position: liste ? getComputedStyle(liste).position : null,
    zIndex: liste ? getComputedStyle(liste).zIndex : null,
    lesen: rechteck(q('[data-testid="bib-lesen"]')),
    schalter: schalter ? schalter.textContent.trim() : null,
    offen: schalter ? schalter.getAttribute('aria-expanded') : null,
  };
}`;

const SCHALTER_KLICK = `() => {
  const el = document.querySelector('[data-testid="bib-liste-schalter"]');
  if (!el) { return false; }
  el.click();
  return true;
}`;

/** Die Fläche, die sich zwei Rechtecke teilen. 0 heisst: sie stehen nebeneinander. */
function schnittflaeche(a: Rechteck | null, b: Rechteck | null): number {
  if (!a || !b) {
    return 0;
  }
  const breite = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const hoehe = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return breite > 0 && hoehe > 0 ? breite * hoehe : 0;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;

async function messen(): Promise<Befund> {
  const s = stand as H4Stand;
  const m = await s.seite.evaluate<Befund>(fn(MESSEN));
  console.info(`JOB 3669 R3 · Tablet-Schublade: ${JSON.stringify(m)}`);
  return m;
}

async function breite(groesse: { width: number; height: number }): Promise<void> {
  const s = stand as H4Stand;
  await s.seite.setViewportSize(groesse);
  await s.seite.waitForTimeout(400);
}

describe("JOB 3669 R3 · die Tablet-Zusage der Bibliothekshilfe, an der gebauten Seite gemessen", () => {
  beforeAll(async () => {
    try {
      // `/wissen/:frei` ist die Adresse MIT gewähltem Eintrag — nur dort gibt es die Schublade.
      stand = await h4Stand("/wissen/:frei", "pedi@job3669.test");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("G1 · 768 px: der Schalter blendet die Liste ein — und sie liegt ÜBER dem Eintrag", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    await breite(TABLET);
    const zu = await messen();
    expect(zu.fenster).toBe(TABLET.width);
    // Vorgabe: die Schublade ist zu, der Bericht trägt die Fläche allein.
    expect(zu.liste).toBeNull();
    expect(zu.offen).toBe("false");
    expect(zu.lesen).not.toBeNull();

    expect(await s.seite.evaluate<boolean>(fn(SCHALTER_KLICK))).toBe(true);
    await s.seite.waitForTimeout(400);
    const offen = await messen();
    expect(offen.offen).toBe("true");
    expect(offen.liste).not.toBeNull();
    expect(offen.lage).toBe("darueber");
    expect(offen.position).toBe("absolute");
    expect(Number(offen.zIndex)).toBeGreaterThan(0);
    // DER PUNKT DIESES FALLES: die beiden Flächen teilen sich wirklich Bildfläche.
    const geteilt = schnittflaeche(offen.liste, offen.lesen);
    console.info(`JOB 3669 R3 · Schnittfläche Liste ∩ Bericht bei 768 px: ${geteilt} px²`);
    expect(geteilt).toBeGreaterThan(0);
    // Und der Eintrag ist nicht gewichen: sein Rechteck ist so breit wie vorher.
    expect(offen.lesen?.w).toBe(zu.lesen?.w);

    // Die ZUSAGE sagt genau das — und nicht mehr „daneben".
    const de = sprachbestand("de");
    const zusage = de["seitenhilfe.bibliothek.body"] ?? "";
    expect(zusage).toContain("ÜBER den Eintrag");
    expect(zusage).not.toContain("daneben");
  }, 90_000);

  it("G2 · derselbe Schalter nimmt die Schublade wieder weg", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(await s.seite.evaluate<boolean>(fn(SCHALTER_KLICK))).toBe(true);
    await s.seite.waitForTimeout(400);
    const m = await messen();
    expect(m.liste).toBeNull();
    expect(m.offen).toBe("false");
    expect(m.lesen).not.toBeNull();
    // Auch dieser Halbsatz steht in der Hilfe — sonst wäre die Schublade eine Einbahnstrasse.
    expect(sprachbestand("de")["seitenhilfe.bibliothek.body"] ?? "").toContain(
      sprachbestand("de")["lib.lesemodus.listeAusblenden"] ?? "###",
    );
  }, 90_000);

  it("G3 · EICHUNG bei 1620 px: dort stehen Liste und Bericht NEBENeinander — Schnittfläche 0", async () => {
    expect(fehler).toBeNull();
    await breite(BREIT);
    const m = await messen();
    expect(m.liste).not.toBeNull();
    expect(m.lage).toBe("spalte");
    expect(m.position).not.toBe("absolute");
    // Ohne diesen Fall wäre „sie überlappen" keine Aussage über das Produkt, sondern über die
    // Messung: hier misst dieselbe Rechnung 0, an derselben Seite, im selben Browser.
    const geteilt = schnittflaeche(m.liste, m.lesen);
    console.info(`JOB 3669 R3 · Schnittfläche Liste ∩ Bericht bei 1620 px: ${geteilt} px²`);
    expect(geteilt).toBe(0);
    // Breit gibt es den Schalter gar nicht — die Zusage nennt ihn deshalb nur fürs Tablet.
    expect(m.schalter).toBeNull();
  }, 90_000);

  it("P · Chromium hat während aller Messungen keinen Seitenfehler gemeldet", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  });
});
