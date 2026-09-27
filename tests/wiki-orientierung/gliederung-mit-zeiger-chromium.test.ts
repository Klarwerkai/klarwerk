// ================================================================================================
// AUFNAHME 20260922 · DOKUMENT-POINTER-BEDIENUNG — DIE GLIEDERUNG MIT DEM ECHTEN ZEIGER, SCHMAL.
// ================================================================================================
//
// WAS HIER FEHLTE. `gliederung-mit-tastatur-chromium.test.ts` belegt Tab/Enter in breiter
// Darstellung; sein C2 („mit der Maus") rief bis zu dieser Aufnahme `knopf.click()` in der Seite —
// ein DOM-Ereignis, das auch einen verdeckten Knopf erreicht (der 4145-C2-Hinweis). C2 und C5
// klicken jetzt mit dem echten Zeiger (`gliederung-zeiger.ts`). DIESE Datei trägt, was dort nicht
// hingehört, weil es ein anderes Fenster braucht:
//
//   Z0 · schmal (390 px): der echte Zeiger trifft „Drei"; Sprung, sichtbarer Zielabschnitt und
//        Tastaturfokus in echten Pixeln gemessen.
//   Z1 · schmal, ÜBERLAGERT: der Hilfe-Knopf (`KlaraAssistant`, `fixed bottom-5 right-5`) liegt
//        über dem vollbreiten Knopf „Drei". Der Mittelpunkt bleibt frei und trifft; die Stelle
//        unter dem Hilfe-Knopf meldet der Treffertest als überdeckt, und ein echter Klick dort
//        springt NICHT. Kein eingeschobener Überzug — die Überlagerung ist die des Produkts.
//   Z2 · schmal, NUR TASTATUR: Tab bis „Drei", Enter — dieselbe Folge wie C1, im schmalen Fenster.
//   Z3 · GEGENPROBE: drei künstlich unbedienbar gemachte Griffe (deckender Überzug, durchsichtiger
//        Überzug, `pointer-events: none`) und ein aus dem Fenster gerollter. Der Treffertest meldet
//        jeden als nicht bedienbar, ein echter Klick an der Stelle springt nicht — und ohne den
//        Eingriff trifft derselbe Klick wieder.
//   Z4 · Gliederung und Bedienrechte der Lesefläche sind nach allen Sprüngen unverändert.
//
// VORRICHTUNG: `tests/design/h4-harness.ts`, unverändert (gebautes `apps/web/dist`, echte
// Fastify-App, Chromium). Der Fließtext läuft über den ECHTEN Dienst durch den Server-Sanitizer.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DIST, type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";
import {
  FOKUS_AUF_DRITTER,
  VERSCHACHTELT_LANG,
  griffMessen,
  zeigerKlick,
  zeigerProtokoll,
  zeigerProtokollStarten,
} from "./gliederung-zeiger";

/** Die schmale Darstellung — dieselbe Breite wie die übrigen Schmalprüfungen des Hauses. */
const SCHMAL = { width: 390, height: 844 } as const;

/**
 * Der Hilfe-Knopf sitzt `bottom-5` (20 px) und ist `h-11` (44 px) hoch — seine Mitte liegt also
 * 42 px über der Fensterunterkante (`KlaraAssistant.tsx`).
 */
const HILFE_MITTE_UEBER_UNTERKANTE = 42;

/**
 * In der Seite: Fokus, dritte Überschrift und ob ihr Anfang SICHTBAR ist — im Fenster UND obenauf.
 * „Obenauf" misst `elementFromPoint` an einem Punkt in der Überschriftzeile: ein Kopfband, das
 * nach `scrollIntoView` über dem Ziel läge, fiele hier auf, obwohl das Rechteck im Fenster steht.
 */
const ZIEL = `() => {
  const f = document.querySelector('[data-testid="bib-text"]');
  const u = f ? f.querySelectorAll('h1, h2, h3, h4, h5, h6') : [];
  const dritte = u[2] || null;
  const aktiv = document.activeElement;
  const name = (el) => el
    ? el.tagName + (el.getAttribute('data-testid') ? '#' + el.getAttribute('data-testid') : '') +
      ' „' + (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + '“'
    : '(nichts)';
  if (!dritte) { return { fenster: window.innerHeight, fokusAufDritter: false, top: null, bottom: null, obenauf: false, getroffen: '', aktiv: name(aktiv) }; }
  const r = dritte.getBoundingClientRect();
  const x = r.left + Math.min(24, r.width / 2);
  const y = r.top + r.height / 2;
  const imFenster = y >= 0 && y < window.innerHeight && x >= 0 && x < window.innerWidth;
  const g = imFenster ? document.elementFromPoint(x, y) : null;
  return {
    fenster: window.innerHeight,
    fokusAufDritter: aktiv === dritte,
    aktiv: name(aktiv),
    text: (dritte.textContent || '').trim(),
    top: r.top,
    bottom: r.bottom,
    obenauf: !!(g && dritte.contains(g)),
    getroffen: name(g),
  };
}`;

interface Ziel {
  fenster: number;
  fokusAufDritter: boolean;
  aktiv: string;
  text?: string;
  top: number | null;
  bottom: number | null;
  obenauf: boolean;
  getroffen: string;
}

/**
 * In der Seite: den Knopf „Drei" durch ROLLEN auf eine Zielhöhe bringen. Gerollt wird der nächste
 * rollende Vorfahr ausserhalb der Leiste (sonst das Dokument) — das ist Lageherstellung wie ein
 * Mausrad, keine Bedienung. Zurück kommt die erreichte Mittelhöhe; das Rollen kann am Anfang des
 * Dokuments anschlagen, dann ist sie höher als verlangt.
 */
const ROLLEN_AUF = `(zielY) => {
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
  let r = knopf.getBoundingClientRect();
  const delta = r.top + r.height / 2 - zielY;
  let el = leiste.parentElement;
  let roller = null;
  while (el) {
    const cs = getComputedStyle(el);
    if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) { roller = el; break; }
    el = el.parentElement;
  }
  (roller || document.scrollingElement).scrollTop += delta;
  r = knopf.getBoundingClientRect();
  return r.top + r.height / 2;
}`;

/** In der Seite: Hilfe-Knopf und Knopf „Drei" — überschneiden sie sich, und was liegt wo obenauf? */
const UEBERLAGERUNG = `() => {
  const name = (el) => el
    ? el.tagName + (el.getAttribute('data-testid') ? '#' + el.getAttribute('data-testid') : '') +
      (el.getAttribute('data-klara') ? '[data-klara]' : '') +
      ' „' + (el.textContent || el.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + '“'
    : '(nichts)';
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
  const hilfe = document.querySelector('button[data-klara="1"]');
  if (!hilfe) { return { hilfeDa: false }; }
  const k = knopf.getBoundingClientRect();
  const h = hilfe.getBoundingClientRect();
  const breite = Math.max(0, Math.min(k.right, h.right) - Math.max(k.left, h.left));
  const hoehe = Math.max(0, Math.min(k.bottom, h.bottom) - Math.max(k.top, h.top));
  // Die Stelle UNTER dem Hilfe-Knopf, auf der Höhe von „Drei" — geometrisch im Knopfrechteck.
  const x = h.left + h.width / 2;
  const y = k.top + k.height / 2;
  const g = document.elementFromPoint(x, y);
  return {
    hilfeDa: true,
    schnittflaeche: breite * hoehe,
    punkt: { x: x, y: y },
    punktImKnopfrechteck: x >= k.left && x <= k.right && y >= k.top && y <= k.bottom,
    obenauf: name(g),
    obenaufIstHilfe: !!(g && hilfe.contains(g)),
    obenaufImKnopf: !!(g && knopf.contains(g)),
  };
}`;

interface Ueberlagerung {
  hilfeDa: boolean;
  schnittflaeche?: number;
  punkt?: { x: number; y: number };
  punktImKnopfrechteck?: boolean;
  obenauf?: string;
  obenaufIstHilfe?: boolean;
  obenaufImKnopf?: boolean;
}

/**
 * In der Seite: was an Gliederung und Bedienung der Lesefläche dasteht. Die Knöpfe ausserhalb der
 * Leiste sind die Handlungen, die der angemeldeten Person hier zustehen; ändert ein Sprung an ihnen
 * etwas (einer verschwindet, einer wird gesperrt), fällt es hier auf.
 */
const INVENTAR = `() => {
  const lesen = document.querySelector('[data-testid="bib-lesen"]');
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  const f = document.querySelector('[data-testid="bib-text"]');
  const knoepfe = lesen ? [].slice.call(lesen.querySelectorAll('button')).filter((b) => !(leiste && leiste.contains(b))) : [];
  return {
    leisteName: leiste ? (leiste.getAttribute('aria-label') || '') : '',
    eintraege: leiste ? [].slice.call(leiste.querySelectorAll('button')).map((b) => (b.textContent || '').trim()) : [],
    ueberschriften: f ? [].slice.call(f.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((h) => h.tagName + ':' + (h.textContent || '').trim()) : [],
    handlungen: knoepfe.map((b) => (b.getAttribute('data-testid') || (b.textContent || '').trim() || b.getAttribute('aria-label') || '?') + (b.disabled ? ' (gesperrt)' : '')),
  };
}`;

type Inventar = Record<string, unknown>;

/** Die vier Eingriffe der Gegenprobe; jeder macht den Griff „Drei" auf eine andere Art unbedienbar. */
const EINGRIFF = `(art) => {
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
  if (art === 'zeigerlos') { knopf.style.pointerEvents = 'none'; return; }
  if (art === 'ausserhalb') {
    let el = leiste.parentElement;
    let roller = null;
    while (el) {
      const cs = getComputedStyle(el);
      if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) { roller = el; break; }
      el = el.parentElement;
    }
    const r = knopf.getBoundingClientRect();
    (roller || document.scrollingElement).scrollTop += r.bottom + 50;
    return;
  }
  const r = knopf.getBoundingClientRect();
  const d = document.createElement('div');
  d.setAttribute('data-testid', 'gegenprobe-deckel');
  d.style.cssText = 'position:fixed;z-index:2147483647;left:' + (r.left - 4) + 'px;top:' + (r.top - 4) +
    'px;width:' + (r.width + 8) + 'px;height:' + (r.height + 8) + 'px;' +
    (art === 'deckend' ? 'background:#c00;' : 'background:transparent;');
  document.body.appendChild(d);
}`;

/** Den Eingriff zurücknehmen — danach muss derselbe Griff wieder treffen. */
const EINGRIFF_ZURUECK = `() => {
  const d = document.querySelector('[data-testid="gegenprobe-deckel"]');
  if (d) { d.remove(); }
  const leiste = document.querySelector('[data-testid="bib-gliederung"]');
  const knopf = [].slice.call(leiste.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'Drei');
  knopf.style.pointerEvents = '';
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;
/** Das ruhige Inventar nach dem ersten schmalen Laden — Vergleichsstand für Z4. */
let inventarVorher: Inventar | null = null;

const seite = () => (stand as H4Stand).seite;
const ziel = async (): Promise<Ziel> => (await seite().evaluate<Ziel>(fn(ZIEL))) as Ziel;
const inventar = async (): Promise<Inventar> =>
  (await seite().evaluate<Inventar>(fn(INVENTAR))) as Inventar;

/**
 * Das Inventar, sobald die Lesefläche fertig nachgeladen hat. Gemessen am Testserver (b8a785b6):
 * direkt nach dem Erscheinen der Gliederung fehlt noch `wb-setzen-knopf` — der Bereich
 * Wissensbeziehungen kommt mit einem eigenen Abruf nach. Ein Vergleich gegen diesen Zwischenstand
 * hielte das Nachladen für eine Folge des Sprungs. Gewartet wird deshalb auf einen ZUSTAND: drei
 * gleiche Lesungen im Abstand von 500 ms, höchstens 20 s.
 */
async function ruhigesInventar(): Promise<Inventar> {
  let letztes = JSON.stringify(await inventar());
  let gleich = 0;
  for (let i = 0; i < 40 && gleich < 2; i++) {
    await seite().waitForTimeout(500);
    const jetzt = JSON.stringify(await inventar());
    gleich = jetzt === letztes ? gleich + 1 : 0;
    letztes = jetzt;
  }
  expect(gleich, `die Lesefläche kam in 20 s nicht zur Ruhe: ${letztes}`).toBe(2);
  return JSON.parse(letztes) as Inventar;
}

/** Die Seite schmal und von vorn laden — ohne Fokus, ohne gerollten Text. */
async function frischSchmal(): Promise<void> {
  const s = seite();
  await s.setViewportSize(SCHMAL);
  await s.goto(`${ORIGIN}/wissen/${(stand as H4Stand).koId}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  try {
    await s.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-gliederung"]')`),
      undefined,
      { timeout: 30_000 },
    );
  } catch (e) {
    const titel = await s
      .evaluate(fn(`() => (document.querySelector('[data-testid="bib-titel"]') || {}).textContent`))
      .catch(() => null);
    throw new Error(
      `schmal geladen: die Gliederung stand nach 30 s nicht im Baum · Titel: ${JSON.stringify(titel)} · ${String(e).split("\n")[0]}`,
    );
  }
}

/** Den Knopf „Drei" ins Bild holen, falls er schmal unter der Falz liegt — durch Rollen. */
async function dreiInsBild(): Promise<void> {
  const g = await griffMessen(seite(), "Drei");
  if (g.y < 0 || g.y >= g.fensterHoehe) {
    await seite().evaluate(fn(ROLLEN_AUF), g.fensterHoehe / 2);
  }
}

/** Der Sprung ist geschehen: Fokus auf der dritten Überschrift, ihr Anfang im Bild und obenauf. */
async function sprungBelegt(wo: string): Promise<Ziel> {
  await seite().waitForFunction(FOKUS_AUF_DRITTER, undefined, { timeout: 20_000 });
  const z = await ziel();
  console.info(`DOKUMENT-POINTER · ${wo} · nach dem Sprung · ${JSON.stringify(z)}`);
  expect(z.fokusAufDritter, `${wo}: der Fokus liegt auf ${z.aktiv}`).toBe(true);
  expect(z.text).toBe("Drei");
  expect(z.top as number, `${wo}: „Drei“ top=${z.top}, Fenster=${z.fenster}`).toBeLessThan(
    z.fenster,
  );
  expect(z.bottom as number, `${wo}: „Drei“ liegt über dem Bild`).toBeGreaterThan(0);
  expect(z.obenauf, `${wo}: über „Drei“ liegt ${z.getroffen}`).toBe(true);
  return z;
}

describe("DOKUMENT-POINTER · die Gliederung mit echtem Zeiger, schmal und überlagert", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@dokument-pointer.test", async (z) => {
        // Über den ECHTEN Dienst — derselbe Aufruf wie `PUT /api/kos/:id` mit `action: "revise"`.
        await z.services.ko.revise(z.freiId, { bodyHtml: VERSCHACHTELT_LANG }, z.autorId);
      });
      await frischSchmal();
      inventarVorher = await ruhigesInventar();
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("Z0 · SCHMAL: der echte Zeiger trifft „Drei“ — Sprung, Ziel im Bild, Fokus darauf", async () => {
    expect(fehler).toBeNull();
    await frischSchmal();
    const s = seite();
    // Kalibrierung: dieselbe Gliederung wie breit, und „Drei“ liegt UNTER dem Bild.
    const vor = await ziel();
    expect(vor.fenster).toBe(SCHMAL.height);
    expect(
      vor.top as number,
      "„Drei“ steht schon im Bild — der Sprung bewiese nichts",
    ).toBeGreaterThan(vor.fenster);
    await dreiInsBild();
    const { griff, ereignisse } = await zeigerKlick(s, "Drei");
    console.info(`DOKUMENT-POINTER · Z0 · ${JSON.stringify({ griff, ereignisse })}`);
    expect(griff.fensterBreite).toBe(SCHMAL.width);
    expect(ereignisse).toEqual([
      { art: "pointerdown", echt: true, zeigerart: "mouse", knopf: "Drei" },
      { art: "click", echt: true, zeigerart: "mouse", knopf: "Drei" },
    ]);
    await sprungBelegt("Z0");
  }, 120_000);

  it("Z1 · SCHMAL, ÜBERLAGERT: der Hilfe-Knopf liegt über „Drei“ — die Mitte trifft, die verdeckte Stelle nicht", async () => {
    expect(fehler).toBeNull();
    await frischSchmal();
    const s = seite();
    // ZUERST DAS HINWEISBANNER („Kurz zur Kenntnis“, `legal/NoticeBanner.tsx`) — mit einem echten
    // Klick bestätigt, wie ein Mensch es tut. Gemessen am Testserver (00911a94): solange es
    // steht, belegt es den unteren Fensterrand, die Lesefläche endet darüber, und der Hilfe-Knopf
    // liegt über dem BANNER, nicht über „Drei“. Der Treffertest meldete „Drei“ dort zu Recht als
    // überdeckt — eine echte Überdeckung, aber nicht die, die Z1 misst.
    const bannerKnopf = (await s.evaluate(
      fn(
        `() => { const b = document.querySelector('[data-testid="notice-ack"]'); if (!b) return null; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2; const y = r.top + r.height / 2; const g = document.elementFromPoint(x, y); return { x: x, y: y, obenauf: !!(g && b.contains(g)) }; }`,
      ),
    )) as { x: number; y: number; obenauf: boolean } | null;
    if (bannerKnopf) {
      expect(bannerKnopf.obenauf, "der Bestätigungsknopf des Banners ist selbst verdeckt").toBe(
        true,
      );
      await s.mouse.click(bannerKnopf.x, bannerKnopf.y);
      await s.waitForFunction(
        fn(`() => !document.querySelector('[data-testid="notice-banner"]')`),
        undefined,
        { timeout: 20_000 },
      );
    }
    // LAGE HERSTELLEN: „Drei“ auf die Höhe des Hilfe-Knopfs bringen. Zuerst durch Rollen; schlägt
    // das am Dokumentanfang an (die Leiste steht weit oben), wird das Fenster so niedrig gemacht,
    // dass seine Unterkante — und mit ihr der Hilfe-Knopf — auf „Drei“ zu liegen kommt. Die Breite
    // bleibt 390 px, der Satz bleibt also derselbe; danach wird noch einmal auf die neue Höhe gerollt.
    const soll = SCHMAL.height - HILFE_MITTE_UEBER_UNTERKANTE;
    const erreicht = (await s.evaluate<number>(fn(ROLLEN_AUF), soll)) as number;
    if (Math.abs(erreicht - soll) > 2) {
      const hoehe = Math.round(erreicht + HILFE_MITTE_UEBER_UNTERKANTE);
      expect(hoehe, `„Drei“ steht bei y=${erreicht} — zu weit oben für diese Lage`).toBeGreaterThan(
        240,
      );
      await s.setViewportSize({ width: SCHMAL.width, height: hoehe });
      await s.evaluate(fn(ROLLEN_AUF), hoehe - HILFE_MITTE_UEBER_UNTERKANTE);
    }
    // Die freie Mitte ist VOR dem ersten Klick bedienbar — sonst misst der Rest eine andere Lage.
    const mitteVorher = await griffMessen(s, "Drei");
    console.info(`DOKUMENT-POINTER · Z1 · Mitte vorher · ${JSON.stringify(mitteVorher)}`);
    expect(mitteVorher.bedienbar, `Mitte von „Drei“: ${JSON.stringify(mitteVorher)}`).toBe(true);
    const u = (await s.evaluate<Ueberlagerung>(fn(UEBERLAGERUNG))) as Ueberlagerung;
    console.info(`DOKUMENT-POINTER · Z1 · Überlagerung · ${JSON.stringify(u)}`);
    // Kalibrierung: die Überlagerung ist ECHT — der Hilfe-Knopf schneidet das Knopfrechteck, und an
    // der Stelle unter ihm liegt ER obenauf, nicht „Drei“. Genau dort hätte `knopf.click()` trotzdem
    // „getroffen“.
    expect(u.hilfeDa, "der Hilfe-Knopf fehlt — dann misst Z1 keine Überlagerung").toBe(true);
    expect(
      u.schnittflaeche as number,
      "Hilfe-Knopf und „Drei“ überschneiden sich nicht",
    ).toBeGreaterThan(0);
    expect(u.punktImKnopfrechteck).toBe(true);
    expect(u.obenaufIstHilfe, `obenauf liegt ${u.obenauf}`).toBe(true);
    expect(u.obenaufImKnopf).toBe(false);

    // ERST DIE VERDECKTE STELLE: ein echter Klick dort — geometrisch im Knopfrechteck von „Drei“ —
    // erreicht den Hilfe-Knopf und springt NICHT.
    const punkt = u.punkt as { x: number; y: number };
    await zeigerProtokollStarten(s);
    await s.mouse.click(punkt.x, punkt.y);
    const daneben = await zeigerProtokoll(s);
    console.info(`DOKUMENT-POINTER · Z1 · verdeckte Stelle · ${JSON.stringify(daneben)}`);
    expect(daneben.some((e) => e.art === "click" && e.echt)).toBe(true);
    expect(daneben.filter((e) => e.knopf === "Drei")).toEqual([]);
    // Ein Negativ hat keinen Zustand, auf den sich warten liesse: eine feste Frist, danach darf der
    // Sprung nicht geschehen sein.
    await s.waitForTimeout(1_000);
    const nichts = await ziel();
    expect(
      nichts.fokusAufDritter,
      `Fokus nach dem Klick unter dem Hilfe-Knopf: ${nichts.aktiv}`,
    ).toBe(false);
    expect(nichts.top as number).toBeGreaterThan(nichts.fenster);
    // Derselbe echte Klick schliesst die Hilfe wieder — die Lage ist danach dieselbe wie vorher.
    await s.mouse.click(punkt.x, punkt.y);
    await s.waitForFunction(
      fn(`() => !document.querySelector('section[data-klara="1"]')`),
      undefined,
      { timeout: 20_000 },
    );

    // DANN DIE FREIE MITTE: der Treffertest findet „Drei“ obenauf, und der echte Zeiger springt.
    const { griff, ereignisse } = await zeigerKlick(s, "Drei");
    console.info(`DOKUMENT-POINTER · Z1 · Mitte · ${JSON.stringify({ griff, ereignisse })}`);
    expect(griff.x, "die Mitte liegt selbst unter dem Hilfe-Knopf").toBeLessThan(punkt.x);
    expect(ereignisse.filter((e) => e.art === "click")).toEqual([
      { art: "click", echt: true, zeigerart: "mouse", knopf: "Drei" },
    ]);
    await sprungBelegt("Z1");
  }, 150_000);

  it("Z2 · SCHMAL, NUR TASTATUR: mit Tab bis „Drei“, Enter — Fokus auf der dritten Überschrift, im Bild", async () => {
    expect(fehler).toBeNull();
    await frischSchmal();
    const s = seite();
    await s.evaluate(
      fn(`() => document.querySelector('[data-testid="bib-sprung-anhaenge"]').focus()`),
    );
    let schritte = 0;
    let erreicht = false;
    for (let i = 0; i < 12 && !erreicht; i++) {
      await s.keyboard.press("Tab");
      schritte = i + 1;
      erreicht = (await s.evaluate<boolean>(
        fn(
          `() => { const l = document.querySelector('[data-testid="bib-gliederung"]'); const a = document.activeElement; return !!(l && a && l.contains(a) && (a.textContent || '').trim() === 'Drei'); }`,
        ),
      )) as boolean;
    }
    expect(erreicht, "der Eintrag „Drei“ war in 12 Tabulatorschritten nicht erreichbar").toBe(true);
    console.info(`DOKUMENT-POINTER · Z2 · „Drei“ nach ${schritte} Tabulatorschritten erreicht`);
    await s.keyboard.press("Enter");
    await sprungBelegt("Z2");
  }, 120_000);

  for (const art of ["deckend", "durchsichtig", "zeigerlos", "ausserhalb"] as const) {
    it(`Z3 · GEGENPROBE „${art}“: der Treffertest meldet den Griff als unbedienbar, ein echter Klick springt nicht`, async () => {
      expect(fehler).toBeNull();
      await frischSchmal();
      await dreiInsBild();
      const s = seite();
      const frei = await griffMessen(s, "Drei");
      expect(frei.bedienbar, `vor dem Eingriff: ${JSON.stringify(frei)}`).toBe(true);

      await s.evaluate(fn(EINGRIFF), art);
      const g = await griffMessen(s, "Drei");
      console.info(`DOKUMENT-POINTER · Z3 · ${art} · ${JSON.stringify(g)}`);
      expect(g.bedienbar, `der Treffertest hielt „${art}“ für bedienbar`).toBe(false);
      expect(g.grund).toBe(
        art === "ausserhalb" ? "Mittelpunkt ausserhalb des Fensters" : "überdeckt",
      );
      // Das Rechteck allein hätte „durchsichtig“ und „zeigerlos“ NICHT erkannt: es steht in voller
      // Grösse im Fenster. Erst der Treffertest am Punkt sieht, dass der Zeiger woanders ankommt.
      if (art !== "ausserhalb") {
        expect(g.breite).toBeGreaterThan(0);
        expect(g.y).toBeGreaterThanOrEqual(0);
        expect(g.y).toBeLessThan(g.fensterHoehe);
      }
      // Und der Befund stimmt mit dem Browser überein: ein ECHTER Klick an dieser Stelle springt nicht.
      await expect(zeigerKlick(s, "Drei")).rejects.toThrow(/nicht bedienbar/);
      if (art !== "ausserhalb") {
        await s.mouse.click(g.x, g.y);
        const protokoll = await zeigerProtokoll(s);
        expect(protokoll.some((e) => e.art === "click" && e.echt)).toBe(true);
        expect(protokoll.filter((e) => e.knopf === "Drei")).toEqual([]);
        // Ein Negativ hat keinen Zustand, auf den sich warten liesse: eine feste Frist, danach
        // darf der Sprung nicht geschehen sein.
        await s.waitForTimeout(1_000);
        const z = await ziel();
        expect(z.fokusAufDritter, `nach dem Klick auf den ${art}en Griff`).toBe(false);
        expect(z.top as number).toBeGreaterThan(z.fenster);
      }

      // Ohne den Eingriff trifft derselbe Weg wieder — der Eingriff war der einzige Grund.
      await s.evaluate(fn(EINGRIFF_ZURUECK));
      await dreiInsBild();
      const { ereignisse } = await zeigerKlick(s, "Drei");
      expect(ereignisse.filter((e) => e.art === "click")).toEqual([
        { art: "click", echt: true, zeigerart: "mouse", knopf: "Drei" },
      ]);
      await sprungBelegt(`Z3 · ${art} · zurückgenommen`);
    }, 150_000);
  }

  it("Z4 · Gliederung und Handlungen der Lesefläche sind nach allen Sprüngen unverändert", async () => {
    expect(fehler).toBeNull();
    // Nach dem letzten Sprung (Z3) — derselbe geladene Stand, kein Neuladen dazwischen.
    const nachher = await ruhigesInventar();
    console.info(`DOKUMENT-POINTER · Z4 · ${JSON.stringify({ vorher: inventarVorher, nachher })}`);
    expect(nachher.eintraege).toEqual(["EinsZwei", "Zwei", "Drei"]);
    expect(nachher.ueberschriften).toEqual(["H2:EinsZwei", "H2:Zwei", "H2:Drei"]);
    expect(nachher).toEqual(inventarVorher);
    expect((nachher.handlungen as string[]).length).toBeGreaterThan(0);
  }, 60_000);

  it("Z5 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  });
});

describe.runIf(!existsSync(join(DIST, "index.html")))(
  "DOKUMENT-POINTER · Chromium-Fall übersprungen",
  () => {
    it("meldet das fehlende dist, statt eine Prüfung vorzutäuschen", () => {
      expect(existsSync(join(DIST, "index.html")), `dist fehlt: ${DIST}`).toBe(false);
    });
  },
);
