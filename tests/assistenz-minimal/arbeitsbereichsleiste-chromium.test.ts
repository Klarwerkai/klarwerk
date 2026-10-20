// ================================================================================================
// MACOS-20261014 · MAC-03 / UI-06 (produkt:20261011:assistenz-minimalistische-oberflaeche r2,
// Nacharbeit 53) — DIE ARBEITSBEREICHSLEISTE IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// Ben (Nacharbeit 53): die neue Flächenaufteilung war nur in jsdom geprüft; tatsächlicher
// Breitengewinn, Überdeckungen und abgeschnittene Befehle fehlten. Hier misst die GEBAUTE App
// (`apps/web/dist`) in Chromium gegen die echte Fastify-App — derselbe Prüfstand wie
// `tests/gesamt-navigation/flaechenlast-chromium.test.ts` (`tests/design/h6-chromium.ts`), angemeldet
// als Admin der Ersteinrichtung, Deutsch, Stufe 2 eingeschaltet (die Kapital-Sicht ist ein
// Stufe-2-Bereich), nur synthetische Daten.
//
//   C1  1440 px ohne eigene Wahl: Leiste eingeblendet, CSS-Breite 216 px, `<main>` beginnt rechts
//       daneben und füllt den Rest. Ausblenden per Zeiger: `<main>` wird GENAU um die Leistenbreite
//       breiter; der Einblend-Knopf liegt sichtbar und unverdeckt im Polster; Fokus darauf.
//       Einblenden per TASTATUR (Enter): Leiste zurück, Fokus auf „Seitenleiste ausblenden“.
//   C2  Fensterbreiten 320, 899, 900, 1280, 1439, 1440, 1920 ohne eigene Wahl (/start): schmal Menü statt
//       Leiste; breit Leiste erst ab 1440 px. Keine waagerechte Überbreite; jeder sichtbare Knopf
//       der Leiste bzw. der Einblend-Knopf liegt im Fenster und ist an seiner Mitte nicht verdeckt;
//       kein Leistenpunkt ist abgeschnitten.
//   C3  Der Datenweg (Lagebild-Werte auf /kapital) bei 1440 px mit offener und mit eingeklappter
//       Assistenz: Prüfstatus und Herkunft sichtbar; ein begonnener Korrekturwert, das Formular und
//       der Assistenzentwurf überstehen Aus- und Einblenden; Speichern ergibt Stand 2.
//   C4  Breite Seiten (Bibliothek, Themenkarte) bei 1440 px mit ein- und ausgeblendeter Leiste:
//       `<main>` ohne waagerechte Überbreite (nichts abgeschnitten), keine Überbreite der Seite.
//   P   Chromium hat keinen Seitenfehler gemeldet.
//
// Jede Messung steht im Lauf unter „MAC-03 · Leiste“ — die Zahlen sind der Beleg, nicht nur das Ja.
// NICHT gemessen: Mac-Host, Screenreader, Hell/Dunkel am Host und Peters Urteil (UI-06/UI-08).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ORIGIN, type Seite, type Stand, fn, starte } from "../design/h6-chromium";

const KENNUNG = "MAC-03 · Leiste";
const BREITE = 1440;
const HOEHE = 900;
const LEISTE = '[data-testid="arbeitsbereichsleiste"]';
const KOPFBAND = 'header[data-testid="kopfband"]';
const ENTWURF = "Synthetische Frage zur Leiste, noch nicht gesendet";

interface Rechteck {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Lage {
  fenster: number;
  main: Rechteck | null;
  leiste: Rechteck | null;
  status: string | null;
  ueberbreite: boolean;
  mainUeberbreite: boolean;
  menueKnopf: boolean;
  /** Bereichseinstiege im Kopfband (Punkte und „Arbeitsbereiche“) — Nacharbeit 54, MAC5-03. */
  kopfbandEinstiege: number;
  einblenden: Rechteck | null;
  /** Sichtbare Knöpfe/Links der Leiste bzw. der Einblend-Knopf, die verdeckt oder abgeschnitten sind. */
  probleme: string[];
}

/** In der Seite: Lage von Leiste, `<main>`, Knöpfen; Verdeckung über elementFromPoint. */
const MESSEN = `() => {
  const r = (el) => {
    if (!el) { return null; }
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x * 10) / 10, y: Math.round(b.y * 10) / 10, width: Math.round(b.width * 10) / 10, height: Math.round(b.height * 10) / 10 };
  };
  const main = document.querySelector('main');
  const leiste = document.querySelector('[data-testid="arbeitsbereichsleiste"]');
  const einblenden = document.querySelector('[data-testid="seitenleiste-einblenden"]');
  const probleme = [];
  const name = (el) => el.getAttribute('data-testid') || el.getAttribute('aria-label') || (el.textContent || '').trim().slice(0, 40);
  const pruefe = (el, rahmen) => {
    const b = el.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) { return; }
    if (b.left < -0.5 || b.right > window.innerWidth + 0.5) { probleme.push('ausserhalb des Fensters: ' + name(el)); return; }
    if (rahmen) {
      const f = rahmen.getBoundingClientRect();
      if (b.left < f.left - 0.5 || b.right > f.right + 0.5) { probleme.push('abgeschnitten: ' + name(el)); return; }
    }
    if (b.bottom < 0 || b.top > window.innerHeight) { return; }
    const x = b.left + b.width / 2;
    const y = Math.min(b.top + b.height / 2, window.innerHeight - 1);
    // In der scrollbaren Leiste: was über oder unter ihrem sichtbaren Bereich liegt, ist
    // weggescrollt (erreichbar durch Scrollen), nicht verdeckt.
    if (rahmen) {
      const f = rahmen.getBoundingClientRect();
      if (y < f.top || y > f.bottom) { return; }
    }
    const oben = document.elementFromPoint(x, y);
    if (!oben || (oben !== el && !el.contains(oben))) { probleme.push('verdeckt: ' + name(el) + ' von ' + (oben ? oben.tagName + '.' + (oben.getAttribute('data-testid') || '') : 'nichts')); }
  };
  if (leiste) { leiste.querySelectorAll('a[href], button').forEach((el) => pruefe(el, leiste)); }
  if (einblenden) { pruefe(einblenden, null); }
  return {
    fenster: window.innerWidth,
    main: r(main),
    leiste: r(leiste),
    status: main ? main.getAttribute('data-seitenleiste') : null,
    ueberbreite: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    mainUeberbreite: main ? main.scrollWidth > main.clientWidth + 1 : true,
    menueKnopf: document.querySelector('[data-testid="kopfband-menue"]') !== null,
    kopfbandEinstiege: document.querySelectorAll('header a[data-kopfband-punkt], [data-testid="kopfband-arbeitsbereiche"]').length,
    einblenden: r(einblenden),
    probleme,
  };
}`;

/** In der Seite: ein kontrolliertes React-Feld wie eine Eingabe setzen. */
const SETZEN = `([sel, wert]) => {
  const el = document.querySelector(sel);
  if (!el) { return null; }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, wert);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return el.value;
}`;

const WERT = "(sel) => { const el = document.querySelector(sel); return el ? el.value : null; }";
const MARKIEREN =
  "(sel) => { const el = document.querySelector(sel); if (el) { el.setAttribute('data-probe-gleich', 'ja'); } return el !== null; }";
const GLEICH =
  "(sel) => { const el = document.querySelector(sel); return el !== null && el.getAttribute('data-probe-gleich') === 'ja'; }";
const FOKUS =
  "() => document.activeElement ? document.activeElement.getAttribute('data-testid') : null";
const ATTRIBUT =
  "([sel, attr]) => { const el = document.querySelector(sel); return el ? el.getAttribute(attr) : null; }";

let stand: Stand | null = null;
const protokoll: string[] = [];

function s(): Stand {
  const st = stand as Stand;
  expect(st.fehler, `Prüfstand nicht bereit: ${st.fehler}`).toBeNull();
  return st;
}

function seite(): Seite {
  const se = s().seite;
  if (se === null) {
    throw new Error("keine Seite");
  }
  return se;
}

async function warte(bedingung: string, arg?: unknown): Promise<void> {
  await seite().waitForFunction(fn(bedingung), arg, { timeout: 30_000 });
}

async function miss(wo: string): Promise<Lage> {
  const lage = await seite().evaluate<Lage>(fn(MESSEN));
  protokoll.push(`${KENNUNG} · ${wo} · ${JSON.stringify(lage)}`);
  console.info(`${KENNUNG} · ${wo} · ${JSON.stringify(lage)}`);
  return lage;
}

/**
 * In der Seite: die eigene Leistenwahl entfernen und Stufe 2 einschalten — die Kapital-Sicht ist ein
 * Stufe-2-Bereich (navigation.ts `kapital`), der Admin schaltet sie mit dem Produktschalter ein
 * (`lib/stufe2Storage.ts`, Schlüssel `kw.stufe2.v1`).
 */
const VORBEREITEN = `() => {
  try {
    localStorage.removeItem('klarwerk.seitenleiste');
    localStorage.setItem('kw.stufe2.v1', '1');
  } catch (e) {}
  return null;
}`;

/** Ohne eigene Wahl neu laden: gespeicherte Wahl entfernen, Breite setzen, Seite neu aufbauen. */
async function frisch(breite: number, pfad = "/kapital"): Promise<void> {
  await seite().evaluate(fn(VORBEREITEN));
  await seite().setViewportSize({ width: breite, height: HOEHE });
  await seite().goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
  await warte("(s) => document.querySelector(s) !== null", KOPFBAND);
  await warte("() => document.querySelector('main') !== null");
  await seite().waitForTimeout(400);
}

const nah = (a: number, b: number, toleranz = 1): boolean => Math.abs(a - b) <= toleranz;

describe("MAC-03 · Arbeitsbereichsleiste in Chromium", () => {
  beforeAll(async () => {
    stand = await starte("/kapital", KOPFBAND, BREITE, HOEHE, async (app) => {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3065.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const stand1 = await app.inject({
        method: "PUT",
        url: "/api/management/lagebild-werte/gesamt",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          zeitraumVon: "2025-07-01",
          zeitraumBis: "2025-09-30",
          werte: {
            hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
            hoursSavedPerValidatedKo: {
              wert: 1.5,
              herkunft: "gemessen",
              beleg: "Zeiterfassung Q3 (synthetisch)",
            },
            reuseFactor: { wert: 4, herkunft: "eigene_eingabe", beleg: null },
          },
          basisVersion: 0,
          anfrageId: "leiste-chromium-0001",
        },
      });
      if (stand1.statusCode !== 200) {
        throw new Error(`Lagebild-Stand: HTTP ${stand1.statusCode} ${stand1.body.slice(0, 200)}`);
      }
    });
  }, 300_000);

  afterAll(async () => {
    for (const zeile of protokoll) {
      console.info(zeile);
    }
    await stand?.browser?.close();
    await stand?.app?.close();
  }, 60_000);

  it("C1 · 1440 px: Leiste 216 px; Ausblenden gibt genau diese Breite an <main>; Zeiger und Tastatur", async () => {
    s();
    await frisch(BREITE);
    await warte("(s) => document.querySelector(s) !== null", LEISTE);
    const an = await miss("C1 eingeblendet 1440");
    expect(an.status).toBe("an");
    expect(an.leiste).not.toBeNull();
    expect(an.main).not.toBeNull();
    const leiste = an.leiste as Rechteck;
    const mainAn = an.main as Rechteck;
    expect(nah(leiste.width, 216), `Leistenbreite ${leiste.width}`).toBe(true);
    expect(nah(mainAn.x, leiste.x + leiste.width), `main beginnt bei ${mainAn.x}`).toBe(true);
    expect(nah(mainAn.x + mainAn.width, an.fenster, 20), "main reicht bis zum Fensterrand").toBe(
      true,
    );
    expect(an.probleme).toEqual([]);
    expect(an.ueberbreite).toBe(false);

    // Ausblenden per Zeiger: der Platz geht an <main>, genau die Leistenbreite.
    await seite().getByTestId("seitenleiste-ausblenden").click();
    await warte("(s) => document.querySelector(s) === null", LEISTE);
    const aus = await miss("C1 ausgeblendet 1440");
    expect(aus.status).toBe("aus");
    const mainAus = aus.main as Rechteck;
    expect(
      nah(mainAus.width - mainAn.width, leiste.width),
      `Breitengewinn ${mainAus.width - mainAn.width} statt ${leiste.width}`,
    ).toBe(true);
    expect(nah(mainAus.x, 0)).toBe(true);
    expect(aus.einblenden).not.toBeNull();
    expect(aus.probleme).toEqual([]);
    expect(await seite().evaluate<string | null>(fn(FOKUS))).toBe("seitenleiste-einblenden");

    // Einblenden per Tastatur: Enter auf dem fokussierten Knopf.
    await seite().keyboard.press("Enter");
    await warte("(s) => document.querySelector(s) !== null", LEISTE);
    expect(await seite().evaluate<string | null>(fn(FOKUS))).toBe("seitenleiste-ausblenden");
    const wieder = await miss("C1 per Tastatur eingeblendet 1440");
    expect(nah((wieder.main as Rechteck).width, mainAn.width)).toBe(true);
  }, 180_000);

  it("C2 · 320–1920 px ohne eigene Wahl: Menü/Leiste je Breite, keine Überbreite, nichts verdeckt", async () => {
    s();
    const ergebnisse: string[] = [];
    // Die Hülle wird auf /start gemessen (die Startseite ist für jede Breite gebaut); den Datenweg
    // auf /kapital misst C3.
    for (const breite of [320, 899, 900, 1280, 1439, 1440, 1920]) {
      await frisch(breite, "/start");
      const lage = await miss(`C2 ${breite}`);
      const schmal = breite <= 899;
      expect(lage.menueKnopf, `${breite}: Menü-Knopf`).toBe(schmal);
      expect(lage.ueberbreite, `${breite}: Überbreite der Seite`).toBe(false);
      expect(lage.probleme, `${breite}: verdeckt/abgeschnitten`).toEqual([]);
      if (schmal) {
        expect(lage.leiste, `${breite}: schmal keine Leiste`).toBeNull();
        expect(lage.einblenden, `${breite}: schmal kein Einblend-Knopf`).toBeNull();
      } else if (breite >= 1440) {
        expect(lage.status, `${breite}: Vorgabe eingeblendet`).toBe("an");
        expect(nah((lage.leiste as Rechteck).width, 216), `${breite}: Leistenbreite`).toBe(true);
        // MAC5-03: die Bereiche stehen links — nicht zusätzlich im Kopfband.
        expect(lage.kopfbandEinstiege, `${breite}: Bereiche doppelt`).toBe(0);
      } else {
        expect(lage.status, `${breite}: Vorgabe ausgeblendet`).toBe("aus");
        expect(lage.leiste, `${breite}: keine Leiste`).toBeNull();
        expect(lage.einblenden, `${breite}: Einblend-Knopf`).not.toBeNull();
        expect(lage.kopfbandEinstiege, `${breite}: Bereiche im Kopfband`).toBeGreaterThan(0);
      }
      ergebnisse.push(`${breite}:${lage.status ?? "schmal"}`);
    }
    console.info(`${KENNUNG} · C2 · ${ergebnisse.join(" ")}`);
  }, 300_000);

  it("C3 · Datenweg /kapital mit offener und eingeklappter Assistenz übersteht Aus-/Einblenden", async () => {
    s();
    await frisch(BREITE);
    await warte("(s) => document.querySelector(s) !== null", LEISTE);
    await warte(
      "() => { const a = document.querySelector('[data-testid=\"lagebild-anzeige\"]'); return a !== null && a.getAttribute('data-version') === '1'; }",
    );
    // Prüfen und Quelle verstehen: Herkunft und Prüfstatus an der gemessenen Zahl.
    const zeile = '[data-testid="lagebild-zeile"][data-feld="hoursSavedPerValidatedKo"]';
    expect(await seite().evaluate<string | null>(fn(ATTRIBUT), [zeile, "data-herkunft"])).toBe(
      "gemessen",
    );
    expect(
      await seite().evaluate<string | null>(fn(ATTRIBUT), [
        `${zeile} [data-testid="lagebild-pruefstatus"]`,
        "data-pruefstatus",
      ]),
    ).toBe("nicht_geprueft");

    // Assistenz öffnen, Entwurf eintippen.
    await seite().getByTestId("klara-figur").click();
    await warte("() => document.querySelector('[data-testid=\"klara-gespraech\"]') !== null");
    const eingabe = '[data-testid="klara-eingabe"]';
    expect(await seite().evaluate<string | null>(fn(SETZEN), [eingabe, ENTWURF])).toBe(ENTWURF);

    // Korrektur beginnen.
    await seite().getByTestId("lagebild-bearbeiten").click();
    await warte("() => document.querySelector('[data-testid=\"lagebild-form\"]') !== null");
    const satz = '[data-testid="lagebild-eingabe-hourlyRate"]';
    expect(await seite().evaluate<string | null>(fn(SETZEN), [satz, "81"])).toBe("81");
    expect(await seite().evaluate<boolean>(fn(MARKIEREN), '[data-testid="lagebild-form"]')).toBe(
      true,
    );

    // Leiste aus- und wieder einblenden — offene Assistenz.
    for (const knopf of ["seitenleiste-ausblenden", "seitenleiste-einblenden"]) {
      await seite().getByTestId(knopf).click();
      await seite().waitForTimeout(300);
      const lage = await miss(`C3 nach ${knopf} (Assistenz offen)`);
      expect(lage.probleme, knopf).toEqual([]);
      expect(await seite().evaluate<boolean>(fn(GLEICH), '[data-testid="lagebild-form"]')).toBe(
        true,
      );
      expect(await seite().evaluate<string | null>(fn(WERT), satz), knopf).toBe("81");
      expect(await seite().evaluate<string | null>(fn(WERT), eingabe), knopf).toBe(ENTWURF);
    }

    // Assistenz einklappen, Leiste noch einmal aus- und einblenden, dann speichern.
    await seite().getByTestId("klara-schliessen").click();
    await warte("() => document.querySelector('[data-testid=\"klara-gespraech\"]') === null");
    for (const knopf of ["seitenleiste-ausblenden", "seitenleiste-einblenden"]) {
      await seite().getByTestId(knopf).click();
      await seite().waitForTimeout(300);
      await miss(`C3 nach ${knopf} (Assistenz eingeklappt)`);
      expect(await seite().evaluate<boolean>(fn(GLEICH), '[data-testid="lagebild-form"]')).toBe(
        true,
      );
      expect(await seite().evaluate<string | null>(fn(WERT), satz), knopf).toBe("81");
    }
    await seite().getByTestId("lagebild-speichern").click();
    await warte(
      "() => { const a = document.querySelector('[data-testid=\"lagebild-anzeige\"]'); return a !== null && a.getAttribute('data-version') === '2'; }",
    );
    expect(
      await seite().evaluate<string | null>(fn(ATTRIBUT), [
        '[data-testid="lagebild-anzeige"]',
        "data-version",
      ]),
    ).toBe("2");

    // Assistenz wieder öffnen: der Entwurf ist da.
    await seite().getByTestId("klara-figur").click();
    await warte("() => document.querySelector('[data-testid=\"klara-gespraech\"]') !== null");
    expect(await seite().evaluate<string | null>(fn(WERT), eingabe)).toBe(ENTWURF);
  }, 240_000);

  it("C4 · Bibliothek und Themenkarte bei 1440 px: ein- und ausgeblendet nichts abgeschnitten", async () => {
    s();
    for (const pfad of ["/bibliothek", "/wissensnetz"]) {
      await frisch(BREITE, pfad);
      await seite().waitForTimeout(800);
      const an = await miss(`C4 ${pfad} eingeblendet`);
      expect(an.status, pfad).toBe("an");
      expect(an.ueberbreite, `${pfad}: Seite überbreit`).toBe(false);
      expect(an.mainUeberbreite, `${pfad}: Inhalt in <main> abgeschnitten`).toBe(false);
      expect(an.probleme, pfad).toEqual([]);
      await seite().getByTestId("seitenleiste-ausblenden").click();
      await warte("(s) => document.querySelector(s) === null", LEISTE);
      await seite().waitForTimeout(400);
      const aus = await miss(`C4 ${pfad} ausgeblendet`);
      expect(aus.ueberbreite, `${pfad}: Seite überbreit (aus)`).toBe(false);
      expect(aus.mainUeberbreite, `${pfad}: Inhalt abgeschnitten (aus)`).toBe(false);
      expect(aus.probleme, pfad).toEqual([]);
      expect(
        nah((aus.main as Rechteck).width - (an.main as Rechteck).width, 216),
        `${pfad}: Breitengewinn`,
      ).toBe(true);
    }
  }, 240_000);

  it("P · Chromium hat keinen Seitenfehler gemeldet", () => {
    expect(s().seitenfehler).toEqual([]);
  });
});
