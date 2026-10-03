// ================================================================================================
// FE-002 · HEADER TEIL 1 — DIE GERENDERTE LEISTE IM ECHTEN BROWSER (E5, E6).
// ================================================================================================
//
// Die gebaute App (`apps/web/dist`) in Chromium, über die gemeinsame Bühne `tests/design/
// h6-chromium.ts` (echte Fastify-App, angemeldeter Administrator, Firmen-CI über den echten
// Adminweg). jsdom kennt kein Layout — ob etwas überdeckt, abgeschnitten oder verdrängt ist, lässt
// sich nur hier messen.
//
// TESTBESTAND FÜR MELDUNGEN, ECHT UND OHNE ATTRAPPE: vor dem ersten Seitenaufbau stellt der
// Administrator zwei Fragen, auf die der leere Bestand keine Antwort hat. Der Server legt daraus
// zwei offene Wissenslücken an, und `/api/notifications` liefert sie als ungelesene Meldungen
// (Fall C0 prüft das an der App, bevor irgendetwas gemessen wird).
//
// GEMESSEN (E5): Desktop 1440/1280, Laptop 1024, die geänderten Umbruchgrenzen 1000/999/940/900
// und 899/760, schmal 390 — jeweils ohne und mit Firmen-CI, Deutsch; Englisch und Niederländisch
// an den engsten Laptopbreiten. Zugesagt wird an JEDER dieser Breiten:
//   · kein Überlauf der Zeile und des Dokuments, kein Griff außerhalb des Fensters
//   · keine zwei Griffe überlappen sich (Marke, Punkte, Arbeitsbereiche, Seite finden, Suche,
//     Zahnrad, Meldungen, Konto, Menü-Knopf)
//   · die vier Zwecke haben an jeder Breite einen sichtbaren Griff
// Die Tastaturwege (Tab, Enter, Pfeile, Escape, Fokusrückgabe, sichtbarer Fokusring) laufen mit
// echten Tasten. C8 führt in Einstellungen, Meldungen und Konto je einen Eintrag per Tastatur aus
// (1280/1024/390 px; Bilder `auswahl-*` mit dem fokussierten Eintrag und `ziel-*` mit der
// erreichten Seite).
//
// BILDBELEGE (E6): steht `FE002_BELEGE` auf einem Verzeichnis, legt der Lauf dort die gerenderten
// Ansichten ab (ruhende Leiste je Breite, geöffnete Menüs, Palette, Drawer). Ohne die Variable
// entstehen keine Dateien — ein Torlauf verschmutzt den Baum nicht.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { APP_VERSION } from "../../apps/web/src/version";
import {
  type Seite,
  type Stand,
  beende,
  fn,
  setzeSprache,
  starte,
  wechsle,
} from "../design/h6-chromium";
import { meldeAn, schalteCi } from "../navigation-schmal/kopfband-messung";

const BELEGE = process.env.FE002_BELEGE ?? "";
if (BELEGE) {
  mkdirSync(BELEGE, { recursive: true });
}

const KOPF = 'header[data-testid="kopfband"]';

let stand: Stand;
let bearer = "";
let buehne: NonNullable<Stand["app"]> | null = null;

function seite(): Seite {
  if (stand.seite === null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return stand.seite;
}

/** Je Bild eine Zeile Prüfmetadaten — abgelegt als `belege.json` neben den Bildern (E6). */
const belegliste: Array<Record<string, unknown>> = [];

/**
 * Ist die Firmen-CI über den Adminweg eingeschaltet? Nicht dasselbe wie „Logo sichtbar": von 900
 * bis 999 px blendet die Bestandsregel `LOGO_OHNE_PLATZ_QUERY` (shell/Logo.tsx, JOB 3641) das
 * Firmenlogo aus, obwohl die CI an ist — Bens Hinweis zu den Metadaten (Lauf 3 R1).
 */
let ciSchalter = false;

async function beleg(name: string, nurKopf = false, bedienweg = "ruhend"): Promise<void> {
  if (!BELEGE) {
    return;
  }
  const breite = await seite().evaluate<number>(fn("() => window.innerWidth"));
  const zustand = await seite().evaluate<{
    lang: string;
    stufe: string;
    ci: boolean;
    pfad: string;
  }>(
    fn(
      `() => ({ lang: document.documentElement.lang, stufe: document.querySelector('.kw-kopfband-rechts')?.getAttribute('data-stufe') ?? '', ci: !!document.querySelector('[data-testid="kopfband-firmenlogo"] img'), pfad: location.pathname })`,
    ),
  );
  belegliste.push({
    datei: `${name}.png`,
    breite,
    sprache: zustand.lang,
    firmenCi: ciSchalter,
    firmenlogoSichtbar: zustand.ci,
    stufe: zustand.stufe,
    pfad: zustand.pfad,
    bedienweg,
    rolle: "admin",
  });
  await seite().screenshot({
    path: join(BELEGE, `${name}.png`),
    ...(nurKopf ? { clip: { x: 0, y: 0, width: breite, height: 64 } } : {}),
  });
}

interface Kasten {
  name: string;
  links: number;
  rechts: number;
  oben: number;
  unten: number;
}

interface Lage {
  bandBreite: number;
  bandScroll: number;
  dokBreite: number;
  dokScroll: number;
  fenster: number;
  kaesten: Kasten[];
  suchfeldSichtbar: boolean;
  suchfeldBreite: number;
  meldungenWort: boolean;
  /** Was an der Suche SICHTBAR als Benennung steht (Platzhalter des Feldes oder Kurzform). */
  sucheBeschriftung: string;
  /** Passt die sichtbare Benennung ungekürzt in ihren Platz? */
  sucheBeschriftungGanz: boolean;
  /** Wie weit der Inhalt der Suche über ihren eigenen Kasten ragt (px, 0 = gar nicht). */
  sucheInhaltUeber: number;
  /** Diagnose: Textbreite des Platzhalters und Breite des Feldes (px; 0 = kein Feld). */
  sucheText: number;
  sucheInnen: number;
  stufe: string;
}

/**
 * In der Seite: zeigt das Suchfeld seinen Platzhalter ungekürzt? Lauf 3 R3 (Bens Befund B2): eine
 * Probe-Zeile mit derselben Schrift (Runde 2) meldete auf Linux „108.0 von 113.0 px" — und das Bild
 * zeigte „Search knowledg". Ein `type="search"`-Feld reserviert in Chromium neben dem Text Platz für
 * den Löschknopf, auch leer; die Probe-Zeile kennt diesen Platz nicht. Gefragt wird deshalb das Feld:
 * ein unsichtbarer Zwilling in derselben Breite trägt den Platzhalter als WERT, und `scrollWidth`
 * meldet, was der Browser für diesen Text im Feld braucht. `text` (Probe-Zeile) steht nur zur
 * Diagnose daneben. Fall C2b prüft an einem nachgestellten Feld, dass diese Messung die Linux-Lage
 * erkennt, die die Probe-Zeile übersah.
 */
const PLATZHALTER_JS = `(feld) => {
  const s = getComputedStyle(feld);
  const probe = document.createElement('span');
  probe.textContent = feld.placeholder;
  Object.assign(probe.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, fontStyle: s.fontStyle, letterSpacing: s.letterSpacing });
  feld.parentElement.appendChild(probe);
  const text = probe.getBoundingClientRect().width;
  probe.remove();
  const zwilling = feld.cloneNode(false);
  zwilling.removeAttribute('data-testid');
  zwilling.removeAttribute('placeholder');
  Object.assign(zwilling.style, { position: 'absolute', visibility: 'hidden', left: '0', top: '0', width: feld.getBoundingClientRect().width + 'px' });
  zwilling.value = feld.placeholder;
  feld.parentElement.appendChild(zwilling);
  const braucht = zwilling.scrollWidth;
  const platz = zwilling.clientWidth;
  zwilling.remove();
  return { ganz: braucht <= platz, braucht, platz, text, probeSagtGanz: text <= platz + 0.5 };
}`;

// In der Seite: jeder sichtbare Griff der Leiste mit seiner tatsächlichen Lage.
const LAGE = fn(`() => {
  const platzhalter = ${PLATZHALTER_JS};
  const band = document.querySelector('header[data-testid="kopfband"]');
  const sel = [
    ['menue', '[data-testid="kopfband-menue"]'],
    ['marke', '.kw-kopfband-marke'],
    ['arbeitsbereiche', '[data-testid="kopfband-arbeitsbereiche"]'],
    ['seiteFinden', '[data-testid="kopfband-gehezu"]'],
    ['suche', '.kw-kopfband-suche'],
    ['zahnrad', '[data-testid="kopfband-zahnrad"]'],
    ['meldungen', '[data-testid="kopfband-meldungen"]'],
    ['konto', '[data-testid="kopfband-konto"]'],
  ];
  const sichtbar = (el) => el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';
  const kaesten = [];
  for (const [name, s] of sel) {
    const el = band.querySelector(s);
    if (!sichtbar(el)) continue;
    const r = el.getBoundingClientRect();
    kaesten.push({ name, links: r.left, rechts: r.right, oben: r.top, unten: r.bottom });
  }
  for (const a of band.querySelectorAll('[data-kopfband-punkt]')) {
    if (!sichtbar(a)) continue;
    const r = a.getBoundingClientRect();
    kaesten.push({ name: 'punkt:' + a.getAttribute('data-kopfband-punkt'), links: r.left, rechts: r.right, oben: r.top, unten: r.bottom });
  }
  const feld = band.querySelector('[data-testid="kopfband-wissen-suchen"]');
  const wort = band.querySelector('.kw-kopfband-meldungen-wort');
  const kurz = band.querySelector('[data-testid="kopfband-wissen-suchen-kurz"]');
  const form = band.querySelector('.kw-kopfband-suche');
  let sucheBeschriftung = '';
  let sucheBeschriftungGanz = false;
  let sucheInhaltUeber = 0;
  let sucheText = 0;
  let sucheInnen = 0;
  // Lauf 3 R2 (Bens Befund B2): die SICHTBARE Benennung wird als eigener Kasten mitgeführt — der
  // Kasten des Formulars allein verdeckte, dass sein Inhalt über das Zahnrad ragte (900 px/nl).
  if (sichtbar(form)) {
    const f = form.getBoundingClientRect();
    sucheInhaltUeber = Math.max(0, form.scrollWidth - form.clientWidth);
    for (const kind of form.querySelectorAll('*')) {
      if (!sichtbar(kind)) continue;
      const r = kind.getBoundingClientRect();
      if (r.width <= 0) continue;
      sucheInhaltUeber = Math.max(sucheInhaltUeber, f.left - r.left, r.right - f.right);
    }
  }
  if (sichtbar(feld)) {
    sucheBeschriftung = feld.placeholder;
    // Gemessen am Feld selbst (PLATZHALTER_JS): Text samt Knopfplatz gegen die Feldbreite.
    const m = platzhalter(feld);
    sucheBeschriftungGanz = m.ganz;
    sucheText = m.text;
    sucheInnen = m.platz;
  } else if (sichtbar(kurz)) {
    sucheBeschriftung = (kurz.innerText || '').replace(/\\s+/g, ' ').trim();
    sucheBeschriftungGanz = kurz.scrollWidth <= kurz.clientWidth + 0.5;
    const r = kurz.getBoundingClientRect();
    kaesten.push({ name: 'suche:wort', links: r.left, rechts: r.right, oben: r.top, unten: r.bottom });
  }
  return {
    bandBreite: band.clientWidth,
    bandScroll: band.scrollWidth,
    dokBreite: document.documentElement.clientWidth,
    dokScroll: document.documentElement.scrollWidth,
    fenster: window.innerWidth,
    kaesten,
    suchfeldSichtbar: sichtbar(feld),
    suchfeldBreite: sichtbar(feld) ? feld.getBoundingClientRect().width : 0,
    meldungenWort: sichtbar(wort),
    sucheBeschriftung,
    sucheBeschriftungGanz,
    sucheInhaltUeber,
    sucheText,
    sucheInnen,
    stufe: band.querySelector('.kw-kopfband-rechts')?.getAttribute('data-stufe') ?? '',
  };
}`);

async function stelle(breite: number): Promise<Lage> {
  await seite().setViewportSize({ width: breite, height: 800 });
  await wechsle(stand, "/start", KOPF);
  // Bereit ist die Leiste, wenn der Meldungsabruf frisch bestätigt ist (dann steht die Zahl, falls
  // es Ungelesenes gibt) und das Firmenlogo — falls an — geladen ist. Beides verändert Breiten.
  await seite().waitForFunction(
    fn(`() => {
      const zugang = document.querySelector('[data-testid="kopfband-meldungen"]');
      if (!zugang || zugang.getAttribute('data-frisch') !== 'ja') return false;
      const bild = document.querySelector('[data-testid="kopfband-firmenlogo"] img');
      return !bild || (bild.complete && bild.naturalWidth > 0) || bild.offsetParent === null;
    }`),
    undefined,
    { timeout: 20_000 },
  );
  // Lauf 3 R2 (Bens Befund B2): erst wenn alle Schriften geladen sind, steht die Zeile so, wie das
  // Bild sie zeigt — `page.screenshot` wartet selbst auf die Schriften.
  await seite().evaluate(fn("() => document.fonts.ready.then(() => true)"));
  // Die Stufe der rechten Gruppe wird nach Grössenänderungen im nächsten Bildaufbau nachgeführt
  // (`shell/kopfbandStufe.ts`). Gemessen wird die RUHENDE Zeile: zwei Bildaufbauten abwarten, dann
  // noch einmal prüfen, dass sich die Stufe nicht mehr ändert.
  const ruhe = fn(
    "() => new Promise((fertig) => requestAnimationFrame(() => requestAnimationFrame(() => fertig(document.querySelector('.kw-kopfband-rechts')?.getAttribute('data-stufe') ?? ''))))",
  );
  let vorher = await seite().evaluate<string>(ruhe);
  for (let i = 0; i < 10; i++) {
    const jetzt = await seite().evaluate<string>(ruhe);
    if (jetzt === vorher) {
      break;
    }
    vorher = jetzt;
  }
  return seite().evaluate<Lage>(LAGE);
}

/** Eine Lage mit auf Zehntelpixel gerundeten Kästen — für den Vergleich vor und nach der Aufnahme. */
function gerundet(l: Lage): Lage {
  const r = (x: number): number => Math.round(x * 10) / 10;
  return {
    ...l,
    suchfeldBreite: r(l.suchfeldBreite),
    sucheInhaltUeber: r(l.sucheInhaltUeber),
    sucheText: r(l.sucheText),
    sucheInnen: r(l.sucheInnen),
    kaesten: l.kaesten.map((k) => ({
      ...k,
      links: r(k.links),
      rechts: r(k.rechts),
      oben: r(k.oben),
      unten: r(k.unten),
    })),
  };
}

/**
 * Lauf 3 R2 (Bens Befund B2): geprüft wird der Zustand, der im Bild steht. Die ruhende Zeile wird
 * gemessen und geprüft, dann aufgenommen, dann NOCH EINMAL gemessen: die zweite Messung muss der
 * ersten gleichen und dieselben Zusagen bestehen. Das Bild liegt damit zwischen zwei gleichen,
 * bestandenen Messungen — ein Zustand, der sich erst beim Aufnehmen einstellt (etwa nach dem Laden
 * einer Schrift), fällt hier auf statt im Bild.
 */
async function pruefeUndBelege(
  breite: number,
  kennung: string,
  sprache: string,
  bild: string,
): Promise<Lage> {
  const vorher = await stelle(breite);
  const platz =
    vorher.sucheInnen > 0
      ? ` · Platzhalter-Text ${vorher.sucheText.toFixed(1)} px im Feld ${vorher.sucheInnen.toFixed(1)} px (mit Knopfplatz: ${vorher.sucheBeschriftungGanz ? "ganz" : "gekappt"})`
      : "";
  console.log(`FE-002 · ${kennung} px: Stufe ${vorher.stufe}${platz}`);
  pruefeLage(vorher, kennung, sprache);
  await beleg(bild, true);
  const nachher = await seite().evaluate<Lage>(LAGE);
  expect(gerundet(nachher), `${kennung}: Zeile nach der Aufnahme anders als geprüft`).toEqual(
    gerundet(vorher),
  );
  pruefeLage(nachher, `${kennung} (nach der Aufnahme)`, sprache);
  return vorher;
}

function ueberlappungen(k: Kasten[]): string[] {
  const funde: string[] = [];
  for (let i = 0; i < k.length; i++) {
    for (let j = i + 1; j < k.length; j++) {
      const a = k[i];
      const b = k[j];
      if (!a || !b) continue;
      if (a.name.split(":")[0] === "suche" && b.name.split(":")[0] === "suche") continue;
      const x = Math.min(a.rechts, b.rechts) - Math.max(a.links, b.links);
      const y = Math.min(a.unten, b.unten) - Math.max(a.oben, b.oben);
      if (x > 0.5 && y > 0.5) {
        funde.push(`${a.name}×${b.name} (${x.toFixed(1)} px)`);
      }
    }
  }
  return funde;
}

function pruefeLage(l: Lage, kennung: string, sprache = "de"): void {
  expect(l.bandScroll, `${kennung}: Zeile läuft über`).toBeLessThanOrEqual(l.bandBreite);
  expect(l.dokScroll, `${kennung}: waagerechter Rollbalken`).toBeLessThanOrEqual(l.dokBreite);
  const draussen = l.kaesten.filter((k) => k.links < -0.5 || k.rechts > l.fenster + 0.5);
  expect(
    draussen.map((k) => k.name),
    `${kennung}: außerhalb des Fensters`,
  ).toEqual([]);
  expect(ueberlappungen(l.kaesten), `${kennung}: überlappende Griffe`).toEqual([]);
  const namen = l.kaesten.map((k) => k.name);
  // Die vier Zwecke haben an JEDER Breite einen sichtbaren Griff: breit direkt, schmal über den
  // beschrifteten Menü-Knopf (Arbeitsbereiche) — Zahnrad, Meldungen und Konto immer.
  for (const pflicht of ["zahnrad", "meldungen", "konto"]) {
    expect(namen, `${kennung}: ${pflicht} fehlt`).toContain(pflicht);
  }
  if (l.fenster >= 900) {
    expect(namen, `${kennung}: Arbeitsbereiche fehlt`).toContain("arbeitsbereiche");
    expect(namen, `${kennung}: Suche fehlt`).toContain("suche");
    expect(namen.filter((n) => n.startsWith("punkt:")).length, `${kennung}: Punkte`).toBe(6);
  } else {
    expect(namen, `${kennung}: Menü-Knopf fehlt`).toContain("menue");
  }
  if (l.fenster >= 900) {
    // Runde 2 (Bens Befund E1/E2): die Suche trägt an JEDER breiten Stufe ihre Benennung sichtbar
    // und ungekürzt — als Platzhalter im Feld oder, in Stufe 3, als Wort neben der Lupe.
    expect(
      l.sucheBeschriftung,
      `${kennung}: Suche ohne sichtbare Benennung (Stufe ${l.stufe})`,
    ).toBe(i18n.getFixedT(sprache)("fe002.wissenSuchen"));
    expect(l.sucheBeschriftungGanz, `${kennung}: Benennung der Suche abgeschnitten`).toBe(true);
    expect(
      l.sucheInhaltUeber,
      `${kennung}: Inhalt der Suche ragt über ihren Kasten (Stufe ${l.stufe})`,
    ).toBeLessThanOrEqual(0.5);
  }
}

beforeAll(async () => {
  stand = await starte("/start", KOPF, 1280, 800, async (app) => {
    buehne = app;
    bearer = await meldeAn(app);
    for (const frage of [
      "Wie beantrage ich Sonderurlaub?",
      "Wer genehmigt Dienstreisen ins Ausland?",
    ]) {
      const antwort = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { authorization: `Bearer ${bearer}` },
        payload: { question: frage, locale: "de" },
      });
      if (antwort.statusCode !== 200) {
        throw new Error(`Testbestand: /api/ask HTTP ${antwort.statusCode}`);
      }
    }
  });
}, 180_000);

afterAll(async () => {
  if (BELEGE && belegliste.length > 0) {
    writeFileSync(
      join(BELEGE, "belege.json"),
      `${JSON.stringify(
        {
          erzeugt: new Date().toISOString(),
          appVersion: APP_VERSION,
          // Der Git-Stand, aus dem gebaut und aufgenommen wurde — vom Aufrufer gesetzt
          // (`FE002_ARBEITSSTAND=$(git rev-parse HEAD)`), sonst ausdrücklich unbekannt.
          arbeitsstand: process.env.FE002_ARBEITSSTAND ?? "nicht angegeben",
          chromium: stand.version,
          buehne: "tests/design/h6-chromium.ts (gebautes apps/web/dist, Fastify im Prozess)",
          bilder: belegliste,
        },
        null,
        2,
      )}\n`,
    );
  }
  await beende(stand);
}, 60_000);

describe("FE-002 · Kopfband in Chromium", () => {
  it("C0 · Voraussetzung: Bühne steht, Testbestand hat zwei ungelesene Meldungen", async () => {
    expect(stand.fehler).toBeNull();
    expect(buehne).not.toBeNull();
    const antwort = await buehne?.inject({
      method: "GET",
      url: "/api/notifications",
      headers: { authorization: `Bearer ${bearer}` },
    });
    const liste = antwort?.json() as Array<{ seen: boolean; kind: string }>;
    expect(liste.filter((n) => !n.seen).length).toBe(2);
    expect(stand.version.length).toBeGreaterThan(0);
  });

  it("C1 · ruhende Leiste ohne Firmen-CI: keine Überdeckung, kein Überlauf, alle Zwecke sichtbar", async () => {
    for (const breite of [1440, 1280, 1024, 1000, 940, 900, 899, 760, 390]) {
      await pruefeUndBelege(breite, `ohne CI de ${breite}`, "de", `kopf-de-${breite}`);
    }
    // Desktop: „Seite finden ⌘K" steht sichtbar neben der Wissenssuche.
    // „Seite finden ⌘K“ und das Wort „Meldungen“ treten per Container-Abfrage zurück, wenn die
    // rechte Gruppe zu schmal wird (index.css). Wo das genau geschieht, hängt an Zählern und an den
    // Schriftmassen der Maschine — deshalb werden sie hier GEMESSEN und ausgegeben, zugesichert
    // wird nur ihr Weg (Arbeitsbereiche, ⌘K; Name und Zeigehinweis der Glocke). Bei 1440 px ist
    // für beide Platz (Messung 26.09.2026: Gruppe 584 px).
    const l1440 = await stelle(1440);
    expect(
      l1440.kaesten.map((k) => k.name),
      "1440 px: „Seite finden“ fehlt",
    ).toContain("seiteFinden");
    const l1280 = await stelle(1280);
    console.log(
      `FE-002 · 1280 px ohne CI: „Seite finden“ ${l1280.kaesten.some((k) => k.name === "seiteFinden") ? "sichtbar" : "zurückgetreten"}, Wort „Meldungen“ ${l1280.meldungenWort ? "sichtbar" : "zurückgetreten"}, Suchfeld ${l1280.suchfeldBreite.toFixed(1)} px`,
    );
    await beleg("seite-de-1280-start", false, "ruhende Startseite");
  }, 240_000);

  it("C2 · ruhende Leiste MIT Firmen-CI: dieselben Zusagen", async () => {
    if (buehne === null) throw new Error("Bühne fehlt");
    await schalteCi(buehne, bearer, true);
    ciSchalter = true;
    try {
      for (const breite of [1440, 1280, 1024, 1000, 999, 940, 900, 899, 760, 390]) {
        await pruefeUndBelege(breite, `mit CI de ${breite}`, "de", `kopf-ci-de-${breite}`);
      }
      // 982 px (Lauf 3 R3): auf macOS die Lage, die Linux bei 999 px/en zeigte — das Feld 113 px
      // breit, der Text 107 px, mit dem Knopfplatz des Suchfeldes gekappt. Am Stand vor Runde 3 hier
      // rot („Benennung der Suche abgeschnitten"), gemessen in der Gegenprobe dieser Runde.
      for (const sprache of ["en", "nl"]) {
        await setzeSprache(stand, sprache);
        for (const breite of [1440, 1280, 1024, 1000, 999, 982, 940, 900, 899, 760, 390]) {
          await pruefeUndBelege(
            breite,
            `mit CI ${sprache} ${breite}`,
            sprache,
            `kopf-ci-${sprache}-${breite}`,
          );
        }
      }
    } finally {
      await setzeSprache(stand, "de");
      await schalteCi(buehne, bearer, false);
      ciSchalter = false;
    }
  }, 300_000);

  it("C2b · Messgerät: die Platzhalterprüfung erkennt die Linux-Lage „108 von 113 px“, die die Probe-Zeile übersah", async () => {
    // Bens Befund B2 (Lauf 3 R2): Linux, 999 px/en, „Platzhalter 108.0 von 113.0 px", Bild abgeschnitten.
    // Auf macOS hat das Feld dort mehr Platz; die Lage wird deshalb NACHGESTELLT: ein Zwilling des
    // echten Suchformulars (dieselben Klassen, dieselbe Schrift, derselbe englische Platzhalter)
    // steht ausserhalb des Kopfbands und wird so breit gesetzt, dass das Feld GENAU 5 px mehr hat als
    // die Probe-Zeile — wie auf Linux. Erwartet: die Probe-Zeile meint „passt", die Prüfung von C1/C2
    // meldet „abgeschnitten". Mit genug Platz meldet dieselbe Prüfung „ganz".
    await setzeSprache(stand, "en");
    try {
      await stelle(1280);
      const r = await seite().evaluate<{
        eng: {
          ganz: boolean;
          braucht: number;
          platz: number;
          text: number;
          probeSagtGanz: boolean;
        };
        weit: {
          ganz: boolean;
          braucht: number;
          platz: number;
          text: number;
          probeSagtGanz: boolean;
        };
      }>(
        fn(`() => {
          const messe = ${PLATZHALTER_JS};
          const vorlage = document.querySelector('header[data-testid="kopfband"] .kw-kopfband-suche');
          const nachbau = vorlage.cloneNode(true);
          nachbau.setAttribute('data-testid', 'fe002-messgeraet');
          nachbau.querySelector('[data-testid="kopfband-wissen-suchen"]').setAttribute('data-testid', 'fe002-messgeraet-feld');
          Object.assign(nachbau.style, { position: 'fixed', left: '40px', top: '120px', zIndex: '9999', flexShrink: '0' });
          document.body.appendChild(nachbau);
          const feld = nachbau.querySelector('input');
          const setze = (innen) => {
            const zuschlag = nachbau.getBoundingClientRect().width - feld.clientWidth;
            nachbau.style.width = (innen + zuschlag) + 'px';
          };
          setze(Math.ceil(messe(feld).text) + 5);
          const eng = messe(feld);
          setze(Math.ceil(eng.braucht) + 4);
          const weit = messe(feld);
          setze(Math.ceil(eng.text) + 5);
          return { eng, weit };
        }`),
      );
      console.log(`FE-002 · C2b Messgerät: ${JSON.stringify(r)}`);
      await beleg(
        "messgeraet-en-kappung",
        false,
        "nachgestellte Linux-Lage: Feld 5 px breiter als der Text, Platzhalter sichtbar gekappt",
      );
      expect(r.eng.probeSagtGanz, "Nachbau: die Probe-Zeile sollte hier „passt“ melden").toBe(true);
      expect(r.eng.ganz, "Messgerät übersieht den gekappten Platzhalter").toBe(false);
      expect(r.weit.ganz, "Messgerät meldet Kappung bei ausreichendem Platz").toBe(true);
    } finally {
      await seite().evaluate(
        fn(`() => document.querySelector('[data-testid="fe002-messgeraet"]')?.remove()`),
      );
      await setzeSprache(stand, "de");
    }
  }, 60_000);

  it("C3 · Tastatur bei 1280 px: Tab erreicht Arbeitsbereiche mit sichtbarem Fokus, Enter öffnet, Pfeil wandert, Escape gibt den Fokus zurück", async () => {
    await stelle(1280);
    const aktiv = fn(
      `() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName`,
    );
    let gefunden = false;
    for (let i = 0; i < 20 && !gefunden; i++) {
      await seite().keyboard.press("Tab");
      gefunden = (await seite().evaluate<string>(aktiv)) === "kopfband-arbeitsbereiche";
    }
    expect(gefunden, "Tab erreicht „Arbeitsbereiche“ nicht").toBe(true);
    const ring = await seite().evaluate<{ fv: boolean; stil: string; breite: string }>(
      fn(
        `() => { const el = document.activeElement; const s = getComputedStyle(el); return { fv: el.matches(':focus-visible'), stil: s.outlineStyle, breite: s.outlineWidth }; }`,
      ),
    );
    expect(ring.fv).toBe(true);
    expect(ring.stil).not.toBe("none");
    expect(Number.parseFloat(ring.breite)).toBeGreaterThanOrEqual(2);
    await beleg("fokus-arbeitsbereiche-1280", true, "ab Seitenanfang Tab bis „Arbeitsbereiche“");

    await seite().keyboard.press("Enter");
    const offen = fn(`(id) => !!document.querySelector('[data-testid="' + id + '"]')`);
    expect(await seite().evaluate<boolean>(offen, "arbeitsbereiche-menue")).toBe(true);
    const ersteZeile = await seite().evaluate<string>(
      fn(`() => document.activeElement?.getAttribute('role') ?? ''`),
    );
    expect(ersteZeile).toBe("menuitem");
    await seite().keyboard.press("ArrowDown");
    await beleg("offen-arbeitsbereiche-1280", false, "Tab bis „Arbeitsbereiche“, Enter, Pfeil ab");
    // Die Fläche liegt ganz im Fenster.
    const flaeche = await seite().evaluate<{
      l: number;
      r: number;
      u: number;
      f: number;
      h: number;
    }>(
      fn(
        `() => { const r = document.querySelector('[data-testid="arbeitsbereiche-menue"]').getBoundingClientRect(); return { l: r.left, r: r.right, u: r.bottom, f: window.innerWidth, h: window.innerHeight }; }`,
      ),
    );
    expect(flaeche.l).toBeGreaterThanOrEqual(0);
    expect(flaeche.r).toBeLessThanOrEqual(flaeche.f);
    expect(flaeche.u).toBeLessThanOrEqual(flaeche.h);
    await seite().keyboard.press("Escape");
    expect(await seite().evaluate<boolean>(offen, "arbeitsbereiche-menue")).toBe(false);
    expect(await seite().evaluate<string>(aktiv)).toBe("kopfband-arbeitsbereiche");
  }, 120_000);

  it("C4 · Tastatur: Zahnrad (Einstellungen und Hilfe), Meldungen und Konto öffnen und schließen mit Fokusrückgabe", async () => {
    await stelle(1280);
    const aktiv = fn(`() => document.activeElement?.getAttribute('data-testid') ?? ''`);
    const fokus = fn(`(id) => document.querySelector('[data-testid="' + id + '"]').focus()`);
    const offen = fn(`(id) => !!document.querySelector('[data-testid="' + id + '"]')`);
    for (const [ausloeser, flaeche, bild] of [
      ["kopfband-zahnrad", "zahnrad-menue", "offen-einstellungen-1280"],
      ["kopfband-meldungen", "meldungen-menue", "offen-meldungen-1280"],
      ["kopfband-konto", "konto-menue", "offen-konto-1280"],
    ] as const) {
      await seite().evaluate(fokus, ausloeser);
      await seite().keyboard.press("Enter");
      expect(await seite().evaluate<boolean>(offen, flaeche), `${flaeche} öffnet nicht`).toBe(true);
      await beleg(bild, false, `Fokus auf ${ausloeser}, Enter`);
      await seite().keyboard.press("Escape");
      expect(await seite().evaluate<boolean>(offen, flaeche), `${flaeche} schließt nicht`).toBe(
        false,
      );
      expect(await seite().evaluate<string>(aktiv), `${flaeche}: Fokus nicht zurück`).toBe(
        ausloeser,
      );
    }
  }, 120_000);

  // ==============================================================================================
  // C8 — EINTRAG PER TASTATUR WÄHLEN UND AUSFÜHREN (Ben, K5, Kandidat b1b53642).
  // ==============================================================================================
  // C4 öffnet Einstellungen, Meldungen und Konto und schließt sie sofort per Escape; ein Eintrag
  // wurde dort nie gewählt. Hier läuft der ganze Weg mit echten Tasten, ohne `focus()` oder
  // `click()` aus dem Skript: ab dem Seitenanfang von /start Tab bis zum Auslöser (sichtbarer Fokus),
  // Enter öffnet, Pfeil ab bis zum Eintrag (sichtbarer Fokus, im Menü), Enter führt ihn aus. Danach
  // stehen die Zielroute und ihr Seitenanker (`page-<schlüssel>`, wie in der UI-Rauchprobe) sichtbar
  // da, und das Menü ist zu. Einstellungen → „Persönliche Einstellungen“ → /profil; Meldungen → eine
  // der beiden Wissenslücken aus dem Testbestand (POST /api/ask, s. o.) → /risiko; Konto → „Profil“
  // → /profil. An 1280, 1024 und 390 px sind Zahnrad, Glocke und Konto direkte Griffe im Kopfband.
  it("C8 · Tastatur bis zur Ausführung: Einstellungen, Meldungen und Konto — Tab, Enter, Pfeil, Enter führt den Eintrag aus (1280/1024/390 px)", async () => {
    type Fokus = {
      testid: string;
      art: string;
      imMenue: boolean;
      fv: boolean;
      outline: string;
      outlineBreite: number;
      hintergrund: string;
      text: string;
      pfad: string;
    };
    const FOKUS = fn(`() => {
      const a = document.activeElement;
      const echt = !!a && a !== document.body;
      const s = echt ? getComputedStyle(a) : null;
      return {
        testid: echt ? (a.getAttribute('data-testid') || '') : '',
        art: echt ? (a.getAttribute('data-art') || '') : '',
        imMenue: echt && !!a.closest('[role="menu"]'),
        fv: echt && a.matches(':focus-visible'),
        outline: s ? s.outlineStyle : '',
        outlineBreite: s ? (Number.parseFloat(s.outlineWidth) || 0) : 0,
        hintergrund: s ? s.backgroundColor : '',
        text: echt ? (a.textContent || '').trim().slice(0, 80) : '',
        pfad: location.pathname,
      };
    }`);
    const fokusSichtbar = (f: Fokus): boolean =>
      f.fv &&
      ((f.outline !== "none" && f.outlineBreite >= 1) ||
        (f.hintergrund !== "rgba(0, 0, 0, 0)" && f.hintergrund !== "transparent"));
    const offen = fn(`(id) => !!document.querySelector('[data-testid="' + id + '"]')`);
    const FAELLE = [
      {
        name: "einstellungen",
        ausloeser: "kopfband-zahnrad",
        flaeche: "zahnrad-menue",
        eintrag: "„Persönliche Einstellungen“ (zahnrad-persoenlich)",
        istEintrag: (f: Fokus) => f.testid === "zahnrad-persoenlich",
        pfad: "/profil",
        anker: "page-profil",
      },
      {
        name: "meldungen",
        ausloeser: "kopfband-meldungen",
        flaeche: "meldungen-menue",
        eintrag: "eine Wissenslücke (meldung-oeffnen, Art gap)",
        istEintrag: (f: Fokus) => f.testid === "meldung-oeffnen" && f.art === "gap",
        pfad: "/risiko",
        anker: "page-risiko",
      },
      {
        name: "konto",
        ausloeser: "kopfband-konto",
        flaeche: "konto-menue",
        eintrag: "„Profil“ (konto-profil)",
        istEintrag: (f: Fokus) => f.testid === "konto-profil",
        pfad: "/profil",
        anker: "page-profil",
      },
    ] as const;
    const wege: string[] = [];
    for (const breite of [1280, 1024, 390]) {
      for (const fall of FAELLE) {
        const kennung = `${fall.name} ${breite} px`;
        await stelle(breite);

        // 1 · Tab ab dem Seitenanfang bis zum Auslöser, sichtbarer Fokus.
        let f = await seite().evaluate<Fokus>(FOKUS);
        let tabs = 0;
        while (f.testid !== fall.ausloeser && tabs < 60) {
          await seite().keyboard.press("Tab");
          tabs += 1;
          f = await seite().evaluate<Fokus>(FOKUS);
        }
        expect(
          f.testid,
          `${kennung}: Tab erreicht ${fall.ausloeser} nicht (${tabs} Schritte)`,
        ).toBe(fall.ausloeser);
        expect(
          fokusSichtbar(f),
          `${kennung}: Fokus am Auslöser unsichtbar ${JSON.stringify(f)}`,
        ).toBe(true);

        // 2 · Enter öffnet; der Fokus liegt danach IM Menü.
        await seite().keyboard.press("Enter");
        await seite().waitForFunction(offen, fall.flaeche, { timeout: 10_000 });
        const imMenue = await seite()
          .waitForFunction(
            fn(`() => !!document.activeElement?.closest('[role="menu"]')`),
            undefined,
            { timeout: 5_000 },
          )
          .then(() => true)
          .catch(() => false);
        const nachEnter = await seite().evaluate<Fokus>(FOKUS);
        expect(
          imMenue,
          `${kennung}: Fokus nach Enter nicht im Menü ${JSON.stringify(nachEnter)}`,
        ).toBe(true);

        // 3 · Pfeil ab bis zum Eintrag, sichtbarer Fokus im Menü.
        f = await seite().evaluate<Fokus>(FOKUS);
        let pfeile = 0;
        while (!fall.istEintrag(f) && pfeile < 40) {
          await seite().keyboard.press("ArrowDown");
          pfeile += 1;
          f = await seite().evaluate<Fokus>(FOKUS);
        }
        const zuletzt = JSON.stringify(f);
        expect(
          fall.istEintrag(f),
          `${kennung}: Pfeil ab erreicht ${fall.eintrag} nicht (${pfeile} Schritte, zuletzt ${zuletzt})`,
        ).toBe(true);
        expect(f.imMenue, `${kennung}: Eintrag liegt nicht im Menü`).toBe(true);
        expect(
          fokusSichtbar(f),
          `${kennung}: Fokus am Eintrag unsichtbar ${JSON.stringify(f)}`,
        ).toBe(true);
        // 3b · Lage (Ben, Kandidat b18faa93: bei 390 px ragte das Einstellungsmenü links aus dem
        // Fenster, Beschriftungen und Fokusring abgeschnitten). Fläche UND fokussierter Eintrag samt
        // sichtbarem Ring müssen ganz zwischen 0 und der Fensterbreite liegen. Das Bild entsteht vor
        // den Zusicherungen, damit es auch im roten Fall vorliegt.
        const lage = await seite().evaluate<{
          fenster: number;
          flaeche: { links: number; rechts: number };
          eintrag: { links: number; rechts: number };
          ring: number;
        }>(
          fn(`(id) => {
            const f = document.querySelector('[data-testid="' + id + '"]').getBoundingClientRect();
            const a = document.activeElement;
            const e = a.getBoundingClientRect();
            const s = getComputedStyle(a);
            const ring = s.outlineStyle === 'none'
              ? 0
              : (Number.parseFloat(s.outlineWidth) || 0) + Math.max(0, Number.parseFloat(s.outlineOffset) || 0);
            return {
              fenster: window.innerWidth,
              flaeche: { links: f.left, rechts: f.right },
              eintrag: { links: e.left - ring, rechts: e.right + ring },
              ring: ring,
            };
          }`),
          fall.flaeche,
        );
        await beleg(
          `auswahl-${fall.name}-${breite}`,
          false,
          `Tastatur: ${tabs}× Tab bis ${fall.ausloeser}, Enter, ${pfeile}× Pfeil ab bis ${fall.eintrag}`,
        );
        const lageText = JSON.stringify(lage);
        expect(
          lage.flaeche.links,
          `${kennung}: Menü ragt links hinaus ${lageText}`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          lage.flaeche.rechts,
          `${kennung}: Menü ragt rechts hinaus ${lageText}`,
        ).toBeLessThanOrEqual(lage.fenster);
        expect(
          lage.eintrag.links,
          `${kennung}: Eintrag/Fokusring links abgeschnitten ${lageText}`,
        ).toBeGreaterThanOrEqual(0);
        expect(
          lage.eintrag.rechts,
          `${kennung}: Eintrag/Fokusring rechts abgeschnitten ${lageText}`,
        ).toBeLessThanOrEqual(lage.fenster);

        // 4 · Enter führt aus: Zielroute, sichtbarer Seitenanker, Menü zu.
        await seite().keyboard.press("Enter");
        await seite().waitForFunction(fn("(p) => location.pathname === p"), fall.pfad, {
          timeout: 15_000,
        });
        await seite().waitForFunction(
          fn(`(id) => {
            const el = document.querySelector('[data-testid="' + id + '"]');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
          }`),
          fall.anker,
          { timeout: 15_000 },
        );
        expect(
          await seite().evaluate<boolean>(offen, fall.flaeche),
          `${kennung}: ${fall.flaeche} bleibt nach der Ausführung offen`,
        ).toBe(false);
        await beleg(
          `ziel-${fall.name}-${breite}`,
          false,
          `Tastatur: Enter auf ${fall.eintrag} → ${fall.pfad}`,
        );
        wege.push(`${kennung}: ${tabs} Tab, ${pfeile} Pfeil → ${fall.pfad} („${f.text}“)`);
      }
    }
    console.info(`FE-002 · C8 · Tastaturwege: ${wege.join(" | ")}`);
    expect(wege).toHaveLength(9);
  }, 300_000);

  it("C5 · Seite finden: Strg+K öffnet die Palette ohne technische Pfade, Tippen findet, Enter öffnet; Wissen suchen führt in die Bibliothek", async () => {
    await stelle(1280);
    await seite().keyboard.press("Control+k");
    await seite().waitForFunction(fn(`() => !!document.querySelector('[data-cmd="suchfeld"]')`));
    await beleg("offen-seite-finden-1280", false, "Strg+K");
    const zeilen = await seite().evaluate<string[]>(
      fn(`() => [...document.querySelectorAll('[data-cmd-ziel]')].map((z) => z.innerText)`),
    );
    expect(zeilen.length).toBeGreaterThan(20);
    const mitPfad = zeilen.filter((z) => /(^|\\s)\/[a-z]/.test(z) || z.includes("?bereich="));
    expect(mitPfad, `sichtbare Pfade: ${mitPfad.slice(0, 3).join(" | ")}`).toEqual([]);
    // Die Palette setzt den Fokus einen Takt nach dem Öffnen (`CommandPalette.tsx`) — erst darauf
    // warten, sonst gingen die ersten Anschläge ins Leere.
    await seite().waitForFunction(
      fn(`() => document.activeElement?.getAttribute('data-cmd') === 'suchfeld'`),
    );
    for (const zeichen of "Konflikte") {
      await seite().keyboard.press(zeichen);
    }
    await seite().waitForFunction(
      fn(
        `() => document.querySelector('[data-cmd-stelle="0"]')?.getAttribute('data-cmd-pfad') === '/konflikte'`,
      ),
    );
    await seite().keyboard.press("Enter");
    await seite().waitForFunction(fn(`() => location.pathname === '/konflikte'`));

    await wechsle(stand, "/start", KOPF);
    await seite().evaluate(
      fn(`() => document.querySelector('[data-testid="kopfband-wissen-suchen"]').focus()`),
    );
    await seite().waitForFunction(
      fn(`() => document.activeElement?.getAttribute('data-testid') === 'kopfband-wissen-suchen'`),
    );
    for (const zeichen of "Urlaub") {
      await seite().keyboard.press(zeichen);
    }
    await seite().keyboard.press("Enter");
    await seite().waitForFunction(
      fn(`() => location.pathname === '/bibliothek' && location.search === '?q=Urlaub'`),
    );
  }, 120_000);

  it("C6 · Laptop 1024 px und schmal 390 px: geöffnete Flächen liegen im Fenster; schmal führt der Menü-Knopf zu allen Abschnitten", async () => {
    await stelle(1024);
    await seite().evaluate(
      fn(`() => document.querySelector('[data-testid="kopfband-arbeitsbereiche"]').click()`),
    );
    await beleg("offen-arbeitsbereiche-1024", false, "Klick auf „Arbeitsbereiche“");
    const r1024 = await seite().evaluate<{ l: number; r: number; f: number }>(
      fn(
        `() => { const r = document.querySelector('[data-testid="arbeitsbereiche-menue"]').getBoundingClientRect(); return { l: r.left, r: r.right, f: window.innerWidth }; }`,
      ),
    );
    expect(r1024.l).toBeGreaterThanOrEqual(0);
    expect(r1024.r).toBeLessThanOrEqual(r1024.f);

    await stelle(390);
    await seite().evaluate(
      fn(`() => document.querySelector('[data-testid="kopfband-meldungen"]').click()`),
    );
    await beleg("offen-meldungen-390", false, "Klick auf die Glocke");
    const r390 = await seite().evaluate<{ l: number; r: number; f: number }>(
      fn(
        `() => { const r = document.querySelector('[data-testid="meldungen-menue"]').getBoundingClientRect(); return { l: r.left, r: r.right, f: window.innerWidth }; }`,
      ),
    );
    expect(r390.l).toBeGreaterThanOrEqual(0);
    expect(r390.r).toBeLessThanOrEqual(r390.f);
    await seite().keyboard.press("Escape");

    await seite().evaluate(
      fn(`() => document.querySelector('[data-testid="kopfband-menue"]').click()`),
    );
    await seite().waitForFunction(fn(`() => !!document.querySelector('.kw-drawer')`));
    const koepfe = await seite().evaluate<string[]>(
      fn(
        `() => [...document.querySelectorAll('.kw-drawer .kw-menue-kopf')].map((k) => k.innerText.trim())`,
      ),
    );
    // `innerText` folgt `text-transform` — verglichen wird deshalb ohne Groß-/Kleinschreibung.
    const klein = koepfe.map((k) => k.toLowerCase());
    for (const kopf of ["hauptnavigation", "arbeitsbereiche", "einstellungen und hilfe", "konto"]) {
      expect(klein, `Drawer-Abschnitt ${kopf} fehlt`).toContain(kopf);
    }
    await beleg("offen-drawer-390", false, "Klick auf „Menü“");
  }, 120_000);

  // ==============================================================================================
  // C7 — DER GANZE SCHMALE WEG ZUM SCHNELLZUGRIFF, mit der echten Modalgrenze (Ben, Lauf 2 R1).
  // ==============================================================================================
  // Bens Befund: „Seite finden" im Drawer schloss den Drawer und öffnete KEINE Palette — das
  // Öffnungsereignis kam, solange die Grenze noch gesperrt war, und wurde verworfen. C6 hatte nur
  // die Abschnitte des Drawers gelesen und den Eintrag nie betätigt. Hier wird er betätigt: einmal
  // mit der Maus bis zur Zielauswahl, einmal mit der Tastatur bis Escape und Fokusrückgabe.
  it("C7 · schmal 390 px: Menü → „Seite finden“ öffnet die Palette; Auswahl navigiert, Escape gibt den Fokus an „Menü“ zurück", async () => {
    const DRAWER_OFFEN = fn(`() => !!document.querySelector('.kw-drawer')`);
    const PALETTE_BEREIT = fn(
      `() => !document.querySelector('.kw-drawer') && document.activeElement?.getAttribute('data-cmd') === 'suchfeld'`,
    );
    /** Der sichtbare Zustand für die Fehlermeldung: Palette, Drawer, Fokus, Pfad. */
    const ZUSTAND = fn(`() => {
      const a = document.activeElement;
      const fokus = a ? (a.getAttribute('data-testid') || a.getAttribute('data-cmd') || a.tagName) : 'keiner';
      return JSON.stringify({
        seiteFinden: !!document.querySelector('[data-cmd="suchfeld"]'),
        drawer: !!document.querySelector('.kw-drawer'),
        fokus: fokus,
        pfad: location.pathname,
      });
    }`);

    // MAUS: Menü → Seite finden → tippen → Treffer anklicken.
    await stelle(390);
    await seite().getByTestId("kopfband-menue").click();
    await seite().waitForFunction(DRAWER_OFFEN);
    await seite().locator('.kw-drawer [data-testid="arbeitsbereiche-seite-finden"]').click();
    await seite().waitForFunction(PALETTE_BEREIT, undefined, { timeout: 10_000 });
    await beleg("offen-seite-finden-aus-drawer-390", false, "Menü → „Seite finden“ (Maus)");
    // Dieselbe Palette ohne technische Pfade wie in C5 — kein zweiter Schnellzugriff.
    const zeilen = await seite().evaluate<string[]>(
      fn(`() => [...document.querySelectorAll('[data-cmd-ziel]')].map((z) => z.innerText)`),
    );
    expect(zeilen.length).toBeGreaterThan(20);
    expect(zeilen.filter((z) => /(^|\s)\/[a-z]/.test(z) || z.includes("?bereich="))).toEqual([]);
    for (const zeichen of "Konflikte") {
      await seite().keyboard.press(zeichen);
    }
    await seite().waitForFunction(
      fn(
        `() => document.querySelector('[data-cmd-stelle="0"]')?.getAttribute('data-cmd-pfad') === '/konflikte'`,
      ),
    );
    await seite().locator('[data-cmd-stelle="0"]').click();
    await seite().waitForFunction(fn(`() => location.pathname === '/konflikte'`));
    expect(
      await seite().evaluate<boolean>(fn(`() => !document.querySelector('[data-cmd="suchfeld"]')`)),
    ).toBe(true);

    // TASTATUR: Menü per Enter → Seite finden per Enter → Escape → Fokus zurück auf „Menü".
    // FÜNFMAL HINTEREINANDER, Escape jeweils SOFORT nach dem Öffnen: ein erster Serverlauf dieses
    // Falls (Prüfauftrag pa-1790487855-00a5d588) lief nach Escape in die Frist, ein zweiter mit
    // einer Zustandsabfrage vor Escape bestand. Ob der Weg einen Wettlauf hat, zeigt erst die
    // Wiederholung; jede Runde meldet ihren Zustand, und bewertet wird am Ende JEDE Runde.
    await stelle(390);
    await seite().evaluate(
      fn(`() => document.querySelector('[data-testid="kopfband-menue"]').focus()`),
    );
    const runden: string[] = [];
    for (let runde = 1; runde <= 5; runde++) {
      await seite().keyboard.press("Enter");
      await seite().waitForFunction(DRAWER_OFFEN);
      await seite().evaluate(
        fn(
          `() => document.querySelector('.kw-drawer [data-testid="arbeitsbereiche-seite-finden"]').focus()`,
        ),
      );
      await seite().keyboard.press("Enter");
      await seite().waitForFunction(PALETTE_BEREIT, undefined, { timeout: 10_000 });
      await seite().keyboard.press("Escape");
      const zurueck = await seite()
        .waitForFunction(
          fn(
            `() => !document.querySelector('[data-cmd="suchfeld"]') && document.activeElement?.getAttribute('data-testid') === 'kopfband-menue'`,
          ),
          undefined,
          { timeout: 10_000 },
        )
        .then(() => "ok")
        .catch(() => "FRIST");
      const zustand = await seite().evaluate<string>(ZUSTAND);
      runden.push(`${runde}: ${zurueck} ${zustand}`);
      if (runde === 1 && zurueck === "ok") {
        await beleg(
          "fokus-menue-nach-seite-finden-390",
          false,
          "Tastatur: Menü (Enter) → „Seite finden“ (Enter) → Escape — Fokus zurück auf „Menü“",
        );
      }
      if (zurueck !== "ok") {
        break;
      }
    }
    console.info(`FE-002 · C7 · Tastaturrunden: ${runden.join(" | ")}`);
    expect(
      runden.filter((r) => !r.includes(": ok ")),
      runden.join(" | "),
    ).toEqual([]);
    expect(runden).toHaveLength(5);
    const pfad = await seite().evaluate<string>(fn("() => location.pathname"));
    expect(pfad).toBe("/start");
  }, 120_000);
});
