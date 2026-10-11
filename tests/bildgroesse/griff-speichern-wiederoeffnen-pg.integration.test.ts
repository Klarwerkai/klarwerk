// ================================================================================================
// R-0014 · BILDGRÖSSE AN GRIFFEN — GEZOGEN, REGULÄR GESPEICHERT, AUS POSTGRESQL WIEDERGEÖFFNET.
// ================================================================================================
//
// EIN DURCHGEHENDER WEG für die vier Originalkriterien (aufnahme:20260922:gesamt-bildidentitaet:
// bildgroesse-griffe). Vorbild der Bedienfolge (Upload, Formular, Palette, Speichern, Wiederöffnen):
// tests/anhaenge-ziehen/speichern-wiederoeffnen-pg.integration.test.ts
//
//     Chromium auf der gebauten App (`apps/web/dist`) → /erfassen → „Datei ▾" → „Formular" → Bild
//     über das sichtbare Upload-Label → dasselbe Bild zweimal aus der Palette an zwei Textstellen
//     gezogen → je eine Bildbeschreibung über das echte Formular →
//       K1 · erstes Bild anklicken, die sichtbaren Griffe mit der echten Maus ziehen (rechte Ecke,
//            dann linke Ecke), Zwischenbreiten am RECHTECK gemessen; ein Zug mit Escape abgebrochen.
//       K3 · zweites Bild: die vier Stufen der vorhandenen Werkzeugleiste angeklickt, je die
//            dargestellte Breite gemessen.
//       K4 · Kennung an Hülle/Bild/Fußnote, Quelle und Fußnotentext beider Vorkommen vor/nach.
//       K2 · sichtbarer Knopf „Als Entwurf speichern" → echter Socket → Fastify → PostgreSQL;
//            `SELECT data FROM drafts WHERE id = $1` unabhängig gelesen; frische Seite
//            `/erfassen?draft=<id>` mit mitgelesenem `GET /api/drafts/:id`; dieselbe Breite und
//            Identität im wiedergeöffneten Editor erneut im Browser gemessen.
//
// KEINE ATTRAPPEN: kein API-/DB-Mock, kein Modellaufruf, keine Breite per Skript gesetzt — jede
// Größenänderung kommt aus echten Maus-Ereignissen an den Griffen oder Klicks auf die Stufen.
//
// FEHLT EINE VORAUSSETZUNG (KLARWERK_PG_TEST_URL, `apps/web/dist`, Chromium), SCHEITERT DIESE DATEI
// LAUT. Sie wird ausdrücklich aufgerufen; ein Überspringen zählte dort als „erfüllt".
import { deflateSync } from "node:zlib";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import type { Kontext, Seite } from "../gast-nutzerweg/browserweg";
import {
  fn,
  mitFlaeche,
  profil,
  starteChromium,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import {
  type Verbindungszeile,
  alsBefund,
  warteAufVerbindungsende,
} from "../gast-nutzerweg/verbindungsende";
import {
  type BrowserMitVersion,
  type Verbindung,
  entwurfszeile,
  pgUrl,
  pgVersion,
  stelleFlaecheBereit,
  zerlege,
} from "../import-wiederoeffnen-nutzerweg/strecke";
import { FALL_RAHMEN_MS, wartebudget } from "../ux19-speichern-oeffnen-reload/ux19-buehne";

const KENNZEICHEN = "[KLARWERK] Bildgröße Griffe PG-Rundlauf";
const KONTO = "bildgroesse-griffe@k2.test";
const FENSTER = { width: 1280, height: 1000 };
const BILD_NAME = "pumpe-breit.png";
const TITEL = `Bildgröße Griffe ${Date.now()}`;
const LEERZEILEN = 10;
const TEXT = "Alpha Beta Gamma Delta";
const FUSSNOTEN = ["Ventil links", "Ventil rechts"];
const STUFEN: ReadonlyArray<readonly [string, number]> = [
  ["Klein", 0.25],
  ["Mittel", 0.5],
  ["Volle Breite", 1],
  ["Groß", 0.75],
];
// Toleranz für „dargestellte Breite = gespeicherter Prozentwert": 0,1 %-Raster + Subpixel.
const ANTEIL_TOLERANZ = 0.006;

// ── Ein breites, gültiges PNG (800×100) — erzeugt, nicht eingecheckt. Breit, damit der Editor-
// Deckel `max-height: 320px` bei keiner gemessenen Breite greift.
const CRC_TABELLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(daten: Buffer): number {
  let c = 0xffffffff;
  for (const b of daten) {
    c = (CRC_TABELLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngStueck(typ: string, daten: Buffer): Buffer {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const inhalt = Buffer.concat([Buffer.from(typ, "ascii"), daten]);
  const pruefsumme = Buffer.alloc(4);
  pruefsumme.writeUInt32BE(crc32(inhalt));
  return Buffer.concat([laenge, inhalt, pruefsumme]);
}

function breitesPng(breite: number, hoehe: number): Buffer {
  const kopf = Buffer.alloc(13);
  kopf.writeUInt32BE(breite, 0);
  kopf.writeUInt32BE(hoehe, 4);
  kopf[8] = 8; // Bittiefe
  kopf[9] = 2; // RGB
  const zeile = Buffer.alloc(1 + breite * 3);
  for (let x = 0; x < breite; x += 1) {
    zeile[1 + x * 3] = 40;
    zeile[2 + x * 3] = 110;
    zeile[3 + x * 3] = Math.floor((x * 255) / breite);
  }
  const roh = Buffer.concat(Array.from({ length: hoehe }, () => zeile));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngStueck("IHDR", kopf),
    pngStueck("IDAT", deflateSync(roh)),
    pngStueck("IEND", Buffer.alloc(0)),
  ]);
}
const BILD_PNG = breitesPng(800, 100);

interface Antwort {
  url(): string;
  status(): number;
  json(): Promise<unknown>;
  request(): { method(): string };
}
interface Dateiwahl {
  setFiles(datei: { name: string; mimeType: string; buffer: Buffer }): Promise<void>;
}
type Buehne = Seite & {
  getByRole(role: "button", options: { name: string; exact: boolean }): { click(): Promise<void> };
  getByText(text: string, options: { exact: boolean }): { click(): Promise<void> };
  mouse: {
    move(x: number, y: number, o?: Record<string, unknown>): Promise<void>;
    down(): Promise<void>;
    up(): Promise<void>;
    click(x: number, y: number): Promise<void>;
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
  on(ereignis: "response", f: (a: Antwort) => void): void;
  waitForEvent(ereignis: "filechooser", o?: Record<string, unknown>): Promise<Dateiwahl>;
  waitForResponse(f: (a: Antwort) => boolean, o?: Record<string, unknown>): Promise<Antwort>;
  close(o?: Record<string, unknown>): Promise<void>;
};
interface Punkt {
  x: number;
  y: number;
}
// Die Identität eines Vorkommens — aus HTML gelesen (Editor, SQL-Zeile, GET-Antwort gleich).
interface Figur {
  huelleId: string | null;
  bildId: string | null;
  unterschriftId: string | null;
  src: string;
  text: string;
  width: string | null;
  stufe: string | null;
}
// Die Darstellung eines Bildes im Browser.
interface Messung {
  id: string | null;
  width: string | null;
  stufe: string | null;
  breitePx: number;
  spaltePx: number;
  anteil: number;
  links: number;
  oben: number;
}

let adminPool: Pool | undefined;
let pool: Pool | undefined;
let browser: BrowserMitVersion | undefined;
let strecke: Strecke | undefined;
let kontext: Kontext | undefined;
let seite: Buehne | undefined;
let flaeche = "nicht hergestellt";
const wegwerfDb = `klarwerk_bildgroesse_test_${`${Date.now()}`.slice(-9)}`;
const t = i18n.getFixedT("de");

// Zwischen den Fällen weitergereichte Befunde — jeder Fall prüft, dass sein Vorgänger sie lieferte.
let identVorher: Figur[] | undefined;
let gezogen: Messung | undefined;
let vorDemSpeichern: Figur[] | undefined;
let messungVorDemSpeichern: Messung[] | undefined;

function brauche<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(`${KENNZEICHEN}: ${was} fehlt — der Aufbau ist nicht bis dahin gekommen.`);
  }
  return wert;
}

function beleg(zeile: string): void {
  process.stderr.write(`${KENNZEICHEN} ${zeile}\n`);
}

async function seiteAusfuehren<T>(s: Buehne, quelle: string): Promise<T> {
  return s.evaluate<T>(fn(`() => (${quelle})`));
}

async function warteBis(s: Buehne, quelle: string, was: string): Promise<void> {
  await warte(s, `() => (${quelle})`, was, undefined, wartebudget("aufFlaechensatzWarten"));
}

const FELD = `(() => {
  const name = ${JSON.stringify(t("editor.bodyLabel"))};
  const alle = [...document.querySelectorAll('[role="textbox"][contenteditable="true"]')]
    .filter((e) => e.getAttribute("aria-label") === name && e.offsetParent !== null);
  if (alle.length !== 1) { throw new Error("Schreibfelder sichtbar: " + alle.length); }
  return alle[0];
})()`;

const BILD = (i: number): string => `${FELD}.querySelectorAll("figure img")[${i}]`;
const GRIFFE = `document.querySelector('[data-testid="bildgriffe"]')`;
const GRIFF = (ecke: string): string =>
  `document.querySelector('[data-testid="bildgriffe"] [data-kw-griff="${ecke}"]')`;

const lageAus = (htmlAusdruck: string): string => `(() => {
  const d = document.createElement("div");
  d.innerHTML = ${htmlAusdruck};
  return [...d.querySelectorAll("figure")].map((f) => {
    const img = f.querySelector("img");
    const cap = f.querySelector("figcaption");
    return {
      huelleId: f.getAttribute("data-image-id"),
      bildId: img ? img.getAttribute("data-image-id") : null,
      unterschriftId: cap ? cap.getAttribute("data-image-id") : null,
      src: img ? img.getAttribute("src") || "" : "",
      text: cap ? cap.textContent.replace(/\\s+/g, " ").trim() : "",
      width: img ? img.getAttribute("width") : null,
      stufe: img ? img.getAttribute("data-kw-scale") : null,
    };
  });
})()`;

// Die tatsächlich dargestellte Breite eines Bildes und die Spalte, gegen die eine Prozentbreite
// aufgelöst wird (Inhaltsbreite des nächsten nicht-inline Vorfahren).
const messe = (i: number): string => `(() => {
  const img = ${BILD(i)};
  let spalte = img.parentElement;
  while (spalte && /^inline|^contents$/.test(getComputedStyle(spalte).display)) {
    spalte = spalte.parentElement;
  }
  const s = getComputedStyle(spalte);
  const spaltePx = spalte.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
  const r = img.getBoundingClientRect();
  return {
    id: img.getAttribute("data-image-id"),
    width: img.getAttribute("width"),
    stufe: img.getAttribute("data-kw-scale"),
    breitePx: r.width,
    spaltePx,
    anteil: r.width / spaltePx,
    links: r.left,
    oben: r.top,
  };
})()`;

const knopfMitText = (wurzel: string, text: string): string => `(() => {
  const k = [...${wurzel}.querySelectorAll("button")].find((b) =>
    (b.textContent || "").replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)} && !b.disabled && b.offsetParent !== null);
  if (!k) { throw new Error("Knopf fehlt: " + ${JSON.stringify(text)}); }
  return k;
})()`;

// Die vorhandene Größenwerkzeugleiste: der Behälter des Labels „Bildgröße".
const LEISTE = `(() => {
  const l = [...document.querySelectorAll("span")].find((s) => s.textContent.trim() === "Bildgröße" && s.offsetParent !== null);
  if (!l) { throw new Error("Größenwerkzeugleiste fehlt"); }
  return l.parentElement;
})()`;

const BILDKNOPF = `(() => {
  const titel = ${JSON.stringify(t("editor.image"))};
  for (let e = ${FELD}.parentElement; e; e = e.parentElement) {
    const k = e.querySelector('button[title="' + titel + '"]');
    if (k) { return k; }
  }
  throw new Error("kein Bildknopf am Schreibfeld");
})()`;

async function mitte(s: Buehne, elementAusdruck: string, zentrieren = true): Promise<Punkt> {
  await warteBis(
    s,
    `(() => { try {
      const e = ${elementAusdruck};
      if (!e || e.offsetParent === null || e.disabled) { return false; }
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    } catch { return false; } })()`,
    `das nächste Bedienziel steht: ${elementAusdruck.slice(0, 160)}`,
  );
  return seiteAusfuehren<Punkt>(
    s,
    `(() => { const e = ${elementAusdruck}; if (${zentrieren}) { e.scrollIntoView({ block: "center" }); }
      const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
  );
}

const wortPunkt = (wort: string): string => `(() => {
      const feld = ${FELD};
      const gang = document.createTreeWalker(feld, NodeFilter.SHOW_TEXT);
      for (let k = gang.nextNode(); k; k = gang.nextNode()) {
        const i = k.data.indexOf(${JSON.stringify(wort)});
        if (i < 0) { continue; }
        const r = document.createRange(); r.setStart(k, i); r.setEnd(k, i + 1);
        const b = r.getBoundingClientRect();
        return { x: b.left + 1, y: b.top + b.height / 2 };
      }
      throw new Error("Wort nicht im Schreibfeld: " + ${JSON.stringify(wort)});
    })()`;

async function vorWort(s: Buehne, wort: string): Promise<Punkt> {
  return seiteAusfuehren<Punkt>(
    s,
    `(() => {
      const p = ${wortPunkt(wort)};
      if (p.y < 0 || p.y > innerHeight || !${FELD}.contains(document.elementFromPoint(p.x, p.y))) {
        throw new Error("Ziel verdeckt oder ausserhalb des Fensters: " + ${JSON.stringify(wort)} + " " + JSON.stringify(p));
      }
      return p;
    })()`,
  );
}

// Übernommen aus der Anhang-Ziehen-Strecke: Bild aus der Palette an eine Textstelle ziehen.
async function zieheBildVor(s: Buehne, wort: string): Promise<void> {
  const knopf = await mitte(s, BILDKNOPF);
  await s.mouse.click(knopf.x, knopf.y);
  const quellKnopf = knopfMitText("document", BILD_NAME);
  const vorher = await mitte(s, quellKnopf);
  const zielVorher = await seiteAusfuehren<Punkt>(s, wortPunkt(wort));
  const hoehe = await seiteAusfuehren<number>(s, "innerHeight");
  const oben = Math.min(vorher.y, zielVorher.y);
  const unten = Math.max(vorher.y, zielVorher.y);
  if (oben < 80 || unten > hoehe - 80) {
    expect(
      unten - oben,
      "Abstand zwischen Palette und Textziel passt ins Browserfenster",
    ).toBeLessThan(hoehe - 160);
    await s.mouse.move(vorher.x, vorher.y);
    await s.mouse.wheel(0, (oben + unten) / 2 - hoehe / 2);
    await warteBis(
      s,
      `(async () => {
        const messen = () => {
          const r = ${quellKnopf}.getBoundingClientRect();
          return { quelle: r.top + r.height / 2, ziel: ${wortPunkt(wort)}.y };
        };
        const a = messen();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const b = messen();
        return Math.min(b.quelle, b.ziel) >= 80 && Math.max(b.quelle, b.ziel) <= innerHeight - 80 &&
          Math.abs(a.quelle - b.quelle) < 0.5 && Math.abs(a.ziel - b.ziel) < 0.5;
      })()`,
      "Palette und Textziel stehen nach dem Mausrad gemeinsam ruhig im sichtbaren Fenster",
    );
  }
  const quelle = await mitte(s, quellKnopf, false);
  const ziel = await vorWort(s, wort);
  await warteBis(
    s,
    `${quellKnopf}.contains(document.elementFromPoint(${quelle.x}, ${quelle.y}))`,
    "die gezogene Palettenquelle liegt unverdeckt unter der Maus",
  );
  await s.mouse.move(quelle.x, quelle.y);
  await s.mouse.down();
  await s.mouse.move(quelle.x + 6, quelle.y + 6, { steps: 3 });
  await s.mouse.move(ziel.x, ziel.y, { steps: 12 });
  await s.mouse.up();
}

const figurenzahl = (n: number): string =>
  `(() => { try { return ${FELD}.querySelectorAll("figure").length === ${n}; } catch { return false; } })()`;

const BEIDE_GELADEN = `(() => { try {
  const bilder = ${FELD}.querySelectorAll("figure img");
  return bilder.length === 2 && [...bilder].every((b) => b.complete && b.naturalWidth > 0);
} catch { return false; } })()`;

// Eine Bildbeschreibung über das echte Formular: Klick auf die Fußnote, tippen, speichern.
async function schreibeFussnote(s: Buehne, i: number, text: string): Promise<void> {
  const fussnote = await mitte(s, `${FELD}.querySelectorAll("figcaption")[${i}]`);
  await s.mouse.click(fussnote.x, fussnote.y);
  const feld = await mitte(s, `document.querySelector("#caption-form-text")`, false);
  await s.mouse.click(feld.x, feld.y);
  await s.keyboard.type(text);
  const speichern = await mitte(
    s,
    `document.querySelector('[data-testid="caption-form-save"]')`,
    false,
  );
  await s.mouse.click(speichern.x, speichern.y);
  await warteBis(
    s,
    `!document.querySelector("#caption-form-text") &&
      ${FELD}.querySelectorAll("figcaption")[${i}].textContent.trim() === ${JSON.stringify(text)}`,
    `die Bildbeschreibung „${text}" steht an Bild ${i + 1}`,
  );
}

// Der Klick auf ein verankertes Bild öffnet (D44, bestehend) zusätzlich die Großansicht der
// Galerie. Ein Nutzer schließt sie über ihren sichtbaren Knopf; die Bildauswahl bleibt.
async function schliesseGrossansicht(s: Buehne): Promise<void> {
  const offen = await seiteAusfuehren<boolean>(
    s,
    `(async () => {
      for (let i = 0; i < 12; i += 1) {
        await new Promise((r) => requestAnimationFrame(r));
        if (document.querySelector("dialog[open]")) { return true; }
      }
      return false;
    })()`,
  );
  if (!offen) {
    return;
  }
  const selektor = `dialog[open] button[aria-label="${t("ko.galleryClose")}"]`;
  const knopf = await mitte(s, `document.querySelector(${JSON.stringify(selektor)})`, false);
  await s.mouse.click(knopf.x, knopf.y);
  await warteBis(s, `!document.querySelector("dialog[open]")`, "die Großansicht ist geschlossen");
}

// Der Griffrahmen liegt deckungsgleich auf Bild i.
const griffeUmfassen = (i: number): string => `(() => { try {
  const g = ${GRIFFE}; const img = ${BILD(i)};
  if (!g || !img) { return false; }
  const a = g.getBoundingClientRect(); const b = img.getBoundingClientRect();
  return Math.abs(a.left - b.left) < 1.5 && Math.abs(a.top - b.top) < 1.5 &&
    Math.abs(a.width - b.width) < 1.5 && Math.abs(a.height - b.height) < 1.5;
} catch { return false; } })()`;

// Bild i mit der echten Maus auswählen; danach umfassen die Griffe genau dieses Bild.
async function waehleBild(s: Buehne, i: number): Promise<void> {
  const p = await mitte(s, BILD(i));
  await s.mouse.click(p.x, p.y);
  await schliesseGrossansicht(s);
  await warteBis(s, griffeUmfassen(i), `die Griffe umfassen Bild ${i + 1}`);
}

// Griff `ecke` greifen und um `dx` waagerecht bewegen — echte Maus, in Schritten. Losgelassen wird
// vom Aufrufer (oder vorher mit Escape abgebrochen).
async function greifeUndBewege(s: Buehne, ecke: string, dx: number): Promise<Punkt> {
  const g = await mitte(s, GRIFF(ecke), false);
  await warteBis(
    s,
    `${GRIFF(ecke)} === document.elementFromPoint(${g.x}, ${g.y})`,
    `der Griff ${ecke} liegt unverdeckt unter der Maus`,
  );
  await s.mouse.move(g.x, g.y);
  await s.mouse.down();
  await s.mouse.move(g.x + dx, g.y + 2, { steps: 16 });
  return { x: g.x + dx, y: g.y + 2 };
}

// Ein gültiger gespeicherter Prozentwert, der zur Darstellung passt.
function pruefeDarstellung(m: Messung, wo: string): void {
  expect(m.width, `${wo}: gezogene Breite fehlt`).toMatch(/^\d{1,3}(?:\.\d)?%$/);
  const soll = Number((m.width as string).slice(0, -1)) / 100;
  expect(Math.abs(m.anteil - soll), `${wo}: Rechteck ${m.anteil} ≠ ${m.width}`).toBeLessThan(
    ANTEIL_TOLERANZ,
  );
}

function ohneStufe(anteil: number, wo: string): void {
  for (const s of [0.25, 0.5, 0.75, 1]) {
    expect(Math.abs(anteil - s), `${wo}: ${anteil} liegt auf der Stufe ${s}`).toBeGreaterThan(0.02);
  }
}

function pruefeIdentitaet(lage: Figur[], soll: Figur[], wo: string): void {
  expect(lage.length, `${wo}: Zahl der Bildhüllen`).toBe(2);
  const [a, b] = lage as [Figur, Figur];
  for (const f of lage) {
    expect(f.bildId, `${wo}: Bild ohne Anker`).toBeTruthy();
    expect(f.unterschriftId, `${wo}: Fußnote trägt nicht den Anker ihres Bildes`).toBe(f.bildId);
    expect(f.huelleId ?? f.bildId, `${wo}: Hülle mit fremdem Anker`).toBe(f.bildId);
  }
  expect(a.bildId, `${wo}: beide Vorkommen teilen einen Anker`).not.toBe(b.bildId);
  const kern = (l: Figur[]) =>
    l.map((f) => ({
      bildId: f.bildId,
      unterschriftId: f.unterschriftId,
      text: f.text,
      srcLaenge: f.src.length,
    }));
  expect(kern(lage), `${wo}: Identität weicht ab`).toEqual(kern(soll));
  expect(
    lage.map((f) => f.src).join("|") === soll.map((f) => f.src).join("|"),
    `${wo}: Bildquellen weichen ab`,
  ).toBe(true);
}

function rumpfAus(wert: unknown): string | null {
  if (wert && typeof wert === "object") {
    for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
      if (k === "bodyHtml" && typeof v === "string") {
        return v;
      }
      const tief = rumpfAus(v);
      if (tief !== null) {
        return tief;
      }
    }
  }
  return null;
}

// Für das Protokoll: die <img>-Tags des Rumpfes, data:-Quellen gekürzt.
function bildTags(html: string): string {
  return (html.match(/<img\b[^>]*>/g) ?? [])
    .map((tag) => tag.replace(/src="data:[^"]{24}[^"]*"/, (q) => `${q.slice(0, 30)}…"`))
    .join(" ");
}

async function fehlerBefund(s: Buehne, phase: string, fehler: unknown): Promise<void> {
  const befund = await seiteAusfuehren<unknown>(
    s,
    `(() => {
      const sichtbar = (e) => e.offsetParent !== null;
      const rect = (e) => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; };
      const editor = [...document.querySelectorAll('[role="textbox"][contenteditable="true"]')].find(sichtbar);
      const griffe = document.querySelector('[data-testid="bildgriffe"]');
      return { url:location.href, viewport:{ w:innerWidth, h:innerHeight }, scroll:{ x:scrollX, y:scrollY },
        griffe: griffe ? rect(griffe) : null,
        dialoge:[...document.querySelectorAll('dialog[open], [role="dialog"]')].map((e) => e.textContent.slice(0,300)),
        editor:editor ? { rect:rect(editor),
          bilder:[...editor.querySelectorAll('img')].map((i) => ({ id:i.getAttribute('data-image-id'), width:i.getAttribute('width'), stufe:i.getAttribute('data-kw-scale'), rect:rect(i) })) } : null,
        knoepfe:[...document.querySelectorAll('button')].filter(sichtbar).map((b) => ({
          text:b.textContent.trim().slice(0,90), title:b.title, disabled:b.disabled
        })).filter((b) => b.text || b.title).slice(-28) };
    })()`,
  ).catch((e) => ({ diagnoseFehler: String(e) }));
  process.stderr.write(
    `${KENNZEICHEN} FEHLER · ${phase} · ${String(fehler).slice(0, 500)}\n${JSON.stringify(befund).slice(0, 7000)}\n`,
  );
}

async function zumFormular(s: Buehne): Promise<void> {
  await s.click('[data-testid="blatt-werkzeug-datei"]');
  await warteBis(
    s,
    `!!document.querySelector('[data-testid="blatt-menue-datei"]')`,
    "das Dateimenü ist offen",
  );
  const formular = await mitte(
    s,
    knopfMitText(
      `document.querySelector('[data-testid="blatt-menue-datei"]')`,
      t("erfassen.weg.formular"),
    ),
  );
  await s.mouse.click(formular.x, formular.y);
  await warteBis(
    s,
    `(() => { try { return !!${FELD}; } catch { return false; } })()`,
    "das Expertenformular mit Schreibfeld steht",
  );
}

async function anmelden(roh: Seite): Promise<void> {
  const basis = brauche(strecke, "die Messstrecke").basis;
  await roh.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(roh, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
  await tippeMitTastatur(roh, "#auth-email", KONTO, "E-Mail");
  await tippeMitTastatur(roh, "#auth-password", PASSWORT, "Passwort");
  await roh.keyboard.press("Enter");
  await warte(roh, `() => !document.querySelector("#auth-email")`, "die Anmeldung trägt");
  await warte(
    roh,
    `() => !!document.querySelector('[data-testid="notice-ack"]')`,
    "der Ersthinweis steht",
  );
  await roh.click('[data-testid="notice-ack"]');
  await warte(
    roh,
    `() => !document.querySelector('[data-testid="notice-ack"]')`,
    "der Ersthinweis wurde gespeichert",
  );
}

// Fehlerbefund schreiben und weiterwerfen — jeder Fall läuft hierüber.
async function mitBefund(phase: string, lauf: (s: Buehne) => Promise<void>): Promise<void> {
  const s = brauche(seite, "die Browserseite");
  try {
    await lauf(s);
  } catch (fehler) {
    await fehlerBefund(s, phase, fehler);
    throw fehler;
  }
}

describe("Bildgröße an Griffen · K1–K4 · Chromium → Fastify → PostgreSQL → Wiederöffnen", () => {
  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      throw new Error(
        `${KENNZEICHEN}: keine gesicherte KLARWERK_PG_TEST_URL — diese Probe ist damit NICHT gemessen (und nicht etwa bestanden).`,
      );
    }
    const verbindung: Verbindung | undefined = zerlege(url);
    if (!verbindung) {
      throw new Error(`${KENNZEICHEN}: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.`);
    }
    await i18n.changeLanguage("de");
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${wegwerfDb}`);
    flaeche = stelleFlaecheBereit();
    browser = (await starteChromium()) as BrowserMitVersion;

    pool = createPool(pgUrl(verbindung, wegwerfDb));
    await migrate(pool);
    strecke = await starteStrecke({ pool, ...mitFlaeche() });
    await ersteinrichtung(strecke, KONTO);

    const p = await profil(browser, FENSTER);
    kontext = p.kontext;
    await anmelden(p.seite);
    await (p.seite as unknown as Buehne).close({ runBeforeUnload: false });
    beleg(
      `BELEG · Chromium ${browser.version()} · Socket-Port ${new URL(strecke.basis).port} · PostgreSQL „${await pgVersion(pool)}" · dist ${flaeche}`,
    );
  }, 900_000);

  afterAll(async () => {
    await seite?.close({ runBeforeUnload: false }).catch(() => undefined);
    await kontext?.close().catch(() => undefined);
    await browser?.close();
    await strecke?.schliessen().catch(() => undefined);
    await pool?.end().catch(() => undefined);
    let rest: Verbindungszeile[] = [];
    if (adminPool) {
      const befund = await warteAufVerbindungsende(adminPool, wegwerfDb);
      rest = befund.rest;
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${wegwerfDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    expect(
      rest,
      `beim DROP DATABASE hingen noch Verbindungen an ${wegwerfDb}:\n  ${alsBefund(rest)}`,
    ).toEqual([]);
  }, 120_000);

  it(
    "Aufbau · Bild hochgeladen, zweimal aus der Palette gezogen, beide Fußnoten über das Formular",
    async () => {
      const basis = brauche(strecke, "die Messstrecke").basis;
      seite = (await brauche(kontext, "die Sitzung").newPage()) as unknown as Buehne;
      await mitBefund("Aufbau", async (s) => {
        await s.goto(`${basis}/erfassen`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await zumFormular(s);

        const titelfeld = await mitte(
          s,
          `(() => { const l = [...document.querySelectorAll("label")].find((x) =>
            ((x.querySelector("span") || {}).textContent || "").trim() === ${JSON.stringify(t("capture.wizard.titleLabel"))});
            const f = l && l.querySelector("input, textarea");
            if (!f) { throw new Error("Titelfeld fehlt"); } return f; })()`,
        );
        await s.mouse.click(titelfeld.x, titelfeld.y);
        await s.keyboard.type(TITEL);

        const details = await mitte(s, knopfMitText("document", t("capture.advanced.title")));
        await s.mouse.click(details.x, details.y);
        await warteBis(
          s,
          `!!document.querySelector('input[type="file"][accept="image/*"]')`,
          "Bildauswahl in erweiterten Details offen",
        );
        const wahl = s.waitForEvent("filechooser", {
          timeout: wartebudget("aufFlaechensatzWarten"),
        });
        // Playwright wartet auf eine stabile, unverdeckte Fläche nach dem Aufklappen.
        // Der reguläre Dateidialog bleibt Teil der tatsächlichen Browserbedienung.
        await s.getByText(t("capture.imagesUpload"), { exact: true }).click();
        await (await wahl).setFiles({ name: BILD_NAME, mimeType: "image/png", buffer: BILD_PNG });
        await warteBis(
          s,
          `[...document.querySelectorAll("img")].some((img) =>
            img.alt === ${JSON.stringify(BILD_NAME)} && img.offsetParent !== null &&
            img.src.startsWith("data:image/") && img.complete && img.naturalWidth > 0)`,
          "das hochgeladene Bild ist im Produkt als geladene Vorschau sichtbar",
        );

        const feld = await mitte(s, FELD);
        await s.mouse.click(feld.x, feld.y);
        for (let i = 0; i < LEERZEILEN; i += 1) {
          await s.keyboard.press("Enter");
        }
        await s.keyboard.type(TEXT);

        await zieheBildVor(s, "Beta");
        await warteBis(s, figurenzahl(1), "das erste gezogene Bild steht im Schreibfeld");
        await zieheBildVor(s, "Delta");
        await warteBis(s, figurenzahl(2), "das zweite gezogene Bild steht im Schreibfeld");
        await warteBis(s, BEIDE_GELADEN, "beide Bildvorkommen sind geladen");

        for (const [i, text] of FUSSNOTEN.entries()) {
          await schreibeFussnote(s, i, text);
        }

        identVorher = await seiteAusfuehren<Figur[]>(s, lageAus(`${FELD}.innerHTML`));
        expect(identVorher.map((f) => f.text)).toEqual(FUSSNOTEN);
        expect(
          identVorher.map((f) => f.stufe),
          "frisch eingefügte Bilder tragen die Stufe 100",
        ).toEqual(["100", "100"]);
        expect(identVorher.map((f) => f.width)).toEqual([null, null]);
        beleg(
          `AUFBAU · Anker ${identVorher.map((f) => f.bildId).join(", ")} · Fußnoten ${identVorher.map((f) => f.text).join(" | ")}`,
        );
      });
    },
    FALL_RAHMEN_MS * 3,
  );

  it(
    "K1 · ausgewähltes Bild zeigt Griffe; echtes Ziehen ändert die dargestellte Breite stufenlos; Escape bricht ab",
    async () => {
      brauche(identVorher, "der Aufbau");
      await mitBefund("K1", async (s) => {
        await waehleBild(s, 0);
        // Vier sichtbare Griffe an den Ecken des Bildes, außerhalb des Schreibfelds.
        const griffe = await seiteAusfuehren<{
          ecken: Array<{ ecke: string; x: number; y: number; imFeld: boolean; sichtbar: boolean }>;
          bild: { l: number; t: number; r: number; b: number };
          markupImFeld: boolean;
        }>(
          s,
          `(() => {
            const feld = ${FELD};
            const b = ${BILD(0)}.getBoundingClientRect();
            const ecken = [...document.querySelectorAll('[data-testid="bildgriffe"] [data-kw-griff]')].map((g) => {
              const r = g.getBoundingClientRect();
              return { ecke: g.getAttribute("data-kw-griff"), x: r.left + r.width / 2, y: r.top + r.height / 2,
                imFeld: feld.contains(g), sichtbar: r.width > 0 && getComputedStyle(g).visibility !== "hidden" };
            });
            return { ecken, bild: { l: b.left, t: b.top, r: b.right, b: b.bottom },
              markupImFeld: /data-kw-griff|kw-bildgriff/.test(feld.innerHTML) };
          })()`,
        );
        expect(griffe.ecken.map((e) => e.ecke)).toEqual(["nw", "ne", "sw", "se"]);
        const sollEcke: Record<string, Punkt> = {
          nw: { x: griffe.bild.l, y: griffe.bild.t },
          ne: { x: griffe.bild.r, y: griffe.bild.t },
          sw: { x: griffe.bild.l, y: griffe.bild.b },
          se: { x: griffe.bild.r, y: griffe.bild.b },
        };
        for (const e of griffe.ecken) {
          const soll = sollEcke[e.ecke] as Punkt;
          expect(Math.abs(e.x - soll.x), `Griff ${e.ecke} waagerecht an der Ecke`).toBeLessThan(2);
          expect(Math.abs(e.y - soll.y), `Griff ${e.ecke} senkrecht an der Ecke`).toBeLessThan(2);
          expect(e.imFeld, `Griff ${e.ecke} liegt im Dokument`).toBe(false);
          expect(e.sichtbar, `Griff ${e.ecke} ist sichtbar`).toBe(true);
        }
        expect(griffe.markupImFeld, "Griff-Markup im Schreibfeld").toBe(false);

        const start = await seiteAusfuehren<Messung>(s, messe(0));
        const zweitesStart = await seiteAusfuehren<Messung>(s, messe(1));
        expect(start.stufe).toBe("100");
        expect(Math.abs(start.anteil - 1), "Ausgangsbreite = Stufe 100").toBeLessThan(0.01);

        // 1. Zug: rechte untere Ecke um 37 % der Spalte nach links.
        const dx1 = -0.37 * start.spaltePx;
        const los1 = await greifeUndBewege(s, "se", dx1);
        const waehrend = await seiteAusfuehren<Messung>(s, messe(0));
        await s.mouse.up();
        await warteBis(
          s,
          `${BILD(0)}.getAttribute("width") !== null && !${BILD(0)}.hasAttribute("data-kw-scale")`,
          "die gezogene Breite gilt, die Stufe ist zurückgetreten",
        );
        const nachZug1 = await seiteAusfuehren<Messung>(s, messe(0));
        beleg(
          `K1 · Zug 1 · vorher ${start.breitePx.toFixed(1)}px/${start.spaltePx.toFixed(1)}px (${start.stufe}) · während ${waehrend.width} ${waehrend.breitePx.toFixed(1)}px · nachher ${nachZug1.width} ${nachZug1.breitePx.toFixed(1)}px (Anteil ${nachZug1.anteil.toFixed(4)}) · Maus bis ${los1.x.toFixed(1)}`,
        );
        expect(
          waehrend.breitePx,
          "die Breite folgt dem Zeiger schon während des Zugs",
        ).toBeLessThan(start.breitePx - 50);
        pruefeDarstellung(nachZug1, "nach Zug 1");
        expect(Math.abs(nachZug1.anteil - 0.63), "Zug 1 folgt der Maus").toBeLessThan(0.02);
        ohneStufe(nachZug1.anteil, "nach Zug 1");
        expect(nachZug1.breitePx).toBeLessThan(start.breitePx);

        // 2. Zug, mit Escape abgebrochen: die Breite folgt erst, dann steht der Stand vor dem Zug.
        const g = await greifeUndBewege(s, "se", -0.2 * start.spaltePx);
        const imAbbruch = await seiteAusfuehren<Messung>(s, messe(0));
        await s.keyboard.press("Escape");
        await warteBis(
          s,
          `${BILD(0)}.getAttribute("width") === ${JSON.stringify(nachZug1.width)}`,
          "Escape stellt die Breite vor dem Zug her",
        );
        // Weiterbewegen mit gedrückter Taste und Loslassen ändern nach dem Abbruch nichts mehr.
        await s.mouse.move(g.x - 120, g.y, { steps: 6 });
        await s.mouse.up();
        const nachAbbruch = await seiteAusfuehren<Messung>(s, messe(0));
        beleg(
          `K1 · Abbruch · während ${imAbbruch.width} ${imAbbruch.breitePx.toFixed(1)}px · nach Escape ${nachAbbruch.width} ${nachAbbruch.breitePx.toFixed(1)}px`,
        );
        expect(imAbbruch.breitePx).toBeLessThan(nachZug1.breitePx - 50);
        expect(nachAbbruch.width).toBe(nachZug1.width);
        expect(Math.abs(nachAbbruch.breitePx - nachZug1.breitePx)).toBeLessThan(0.6);
        expect(
          await seiteAusfuehren<boolean>(s, `!!document.querySelector("dialog[open]")`),
          "Escape während des Zugs hat einen Dialog berührt",
        ).toBe(false);
        // Abbruch (Escape drücken UND loslassen, Maus über dem Text loslassen) lässt die Auswahl
        // stehen — bewusst OHNE erneuten Klick auf das Bild (Cloudbefund root-nacharbeit-01).
        await warteBis(s, griffeUmfassen(0), "nach dem Abbruch umfassen die Griffe weiter Bild 1");

        // 3. Zug am linken oberen Griff: 20 % der Spalte nach rechts → schmaler. Kein Hängen.
        await greifeUndBewege(s, "nw", 0.2 * start.spaltePx);
        await s.mouse.up();
        await warteBis(
          s,
          `${BILD(0)}.getAttribute("width") !== ${JSON.stringify(nachZug1.width)}`,
          "der zweite reguläre Zug wirkt",
        );
        const nachZug3 = await seiteAusfuehren<Messung>(s, messe(0));
        pruefeDarstellung(nachZug3, "nach Zug am linken Griff");
        expect(Math.abs(nachZug3.anteil - (nachZug1.anteil - 0.2))).toBeLessThan(0.02);
        ohneStufe(nachZug3.anteil, "nach Zug am linken Griff");
        // Die Toolbar nennt den freien Wert, keine Stufe ist gedrückt.
        const leiste = await seiteAusfuehren<{ gedrueckt: string[]; wert: string | null }>(
          s,
          `(() => { const l = ${LEISTE};
            return { gedrueckt: [...l.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent.trim()),
              wert: (l.querySelector('[data-testid="bildgroesse-gezogen"]') || {}).textContent || null }; })()`,
        );
        expect(leiste.gedrueckt).toEqual([]);
        expect(leiste.wert).toBe((nachZug3.width as string).replace("%", " %"));

        // Das zweite Vorkommen desselben Bildes blieb unberührt.
        const zweitesDanach = await seiteAusfuehren<Messung>(s, messe(1));
        expect(zweitesDanach.width).toBeNull();
        expect(zweitesDanach.stufe).toBe(zweitesStart.stufe);
        expect(Math.abs(zweitesDanach.breitePx - zweitesStart.breitePx)).toBeLessThan(0.6);
        gezogen = nachZug3;
        beleg(
          `K1 · Zug 3 (nw) · ${nachZug3.width} · ${nachZug3.breitePx.toFixed(1)}px von ${nachZug3.spaltePx.toFixed(1)}px · Anteil ${nachZug3.anteil.toFixed(4)}`,
        );
      });
    },
    FALL_RAHMEN_MS * 3,
  );

  it(
    "K3 · die vier Stufen 25/50/75/100 der vorhandenen Werkzeugleiste wirken im Browser",
    async () => {
      const erstes = brauche(gezogen, "K1");
      await mitBefund("K3", async (s) => {
        await waehleBild(s, 1);
        for (const [label, anteil] of STUFEN) {
          // Der Knopf kann nach der Bildauswahl oberhalb des Scrollausschnitts liegen.
          // Ein regulärer Locator-Klick scrollt ihn sichtbar und prüft die echte Trefferfläche.
          await s.getByRole("button", { name: label, exact: true }).click();
          await warteBis(
            s,
            `${BILD(1)}.getAttribute("data-kw-scale") === ${JSON.stringify(String(anteil * 100))}`,
            `die Stufe ${label} ist gesetzt`,
          );
          const m = await seiteAusfuehren<Messung>(s, messe(1));
          beleg(
            `K3 · ${label} · ${m.stufe} · ${m.breitePx.toFixed(1)}px von ${m.spaltePx.toFixed(1)}px · Anteil ${m.anteil.toFixed(4)}`,
          );
          expect(m.width, `${label}: keine freie Breite`).toBeNull();
          expect(Math.abs(m.anteil - anteil), `${label}: dargestellte Breite`).toBeLessThan(0.01);
          const gedrueckt = await seiteAusfuehren<string[]>(
            s,
            `[...${LEISTE}.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent.trim())`,
          );
          expect(gedrueckt).toEqual([label]);
          // Das erste, frei gezogene Bild bleibt, wie es ist.
          const a = await seiteAusfuehren<Messung>(s, messe(0));
          expect(a.width).toBe(erstes.width);
          expect(Math.abs(a.breitePx - erstes.breitePx)).toBeLessThan(0.6);
        }
      });
    },
    FALL_RAHMEN_MS * 2,
  );

  it(
    "K4 · Kennung, Hülle und Fußnote beider Vorkommen bleiben beim Größenändern unverändert",
    async () => {
      const vorher = brauche(identVorher, "der Aufbau");
      await mitBefund("K4", async (s) => {
        const nachher = await seiteAusfuehren<Figur[]>(s, lageAus(`${FELD}.innerHTML`));
        pruefeIdentitaet(nachher, vorher, "Editor nach dem Größenändern");
        // Im Editor selbst: auch die Hülle ist unverändert (gleicher Zustand vorher/nachher).
        expect(nachher.map((f) => f.huelleId)).toEqual(vorher.map((f) => f.huelleId));
        expect(nachher.map((f) => f.width)).toEqual([brauche(gezogen, "K1").width, null]);
        expect(nachher.map((f) => f.stufe)).toEqual([null, "75"]);
        vorDemSpeichern = nachher;
        messungVorDemSpeichern = [
          await seiteAusfuehren<Messung>(s, messe(0)),
          await seiteAusfuehren<Messung>(s, messe(1)),
        ];
        beleg(
          `K4 · vor dem Speichern · ${nachher.map((f) => `${f.bildId}/${f.unterschriftId} „${f.text}" width=${f.width} stufe=${f.stufe}`).join(" · ")}`,
        );
      });
    },
    FALL_RAHMEN_MS,
  );

  it(
    "K2 · regulär gespeichert (PostgreSQL), SQL-Zeile gelesen, derselbe Entwurf wiedergeöffnet und erneut gemessen",
    async () => {
      const db = brauche(pool, "der Verbindungspool");
      const basis = brauche(strecke, "die Messstrecke").basis;
      const soll = brauche(vorDemSpeichern, "K4");
      const sollMessung = brauche(messungVorDemSpeichern, "K4");
      let id = "";
      await mitBefund("K2 · Speichern", async (s) => {
        const gespeichert = s.waitForResponse(
          (a) =>
            ["POST", "PUT"].includes(a.request().method()) &&
            /^\/api\/drafts(\/[^/]+)?$/.test(new URL(a.url()).pathname),
          { timeout: wartebudget("aufFlaechensatzWarten") },
        );
        const sichern = await mitte(s, knopfMitText("document", t("capture.saveDraft")));
        await s.mouse.click(sichern.x, sichern.y);
        const bestaetigen = await mitte(
          s,
          knopfMitText("document", t("capture.saveLimit.confirm")),
        );
        await s.mouse.click(bestaetigen.x, bestaetigen.y);
        const antwort = await gespeichert;
        expect(antwort.status(), "Speichern über den Socket").toBeLessThan(300);
        const gesichert = (await antwort.json()) as { id?: unknown };
        id = typeof gesichert.id === "string" ? gesichert.id : "";
        expect(
          id,
          `die Speicherantwort nennt keine Entwurfskennung: ${JSON.stringify(gesichert).slice(0, 300)}`,
        ).not.toBe("");
      });
      // Die Seite wird verlassen.
      await seite?.close({ runBeforeUnload: false }).catch(() => undefined);
      seite = undefined;

      // Unabhängige Leseprobe: die drafts-Zeile in PostgreSQL.
      const zeile = await entwurfszeile(db, id);
      expect(zeile, `keine drafts-Zeile ${id}`).not.toBeNull();
      const rumpfSql = rumpfAus(JSON.parse(zeile as string));
      expect(rumpfSql, "die drafts-Zeile trägt keinen bodyHtml").not.toBeNull();
      beleg(
        `K2 · Entwurf ${id} · SQL drafts.data bodyHtml-Bilder: ${bildTags(rumpfSql as string)}`,
      );
      expect(rumpfSql as string).not.toMatch(/data-kw-griff|kw-bildgriff|bildgriffe/);

      // Reguläres Wiederöffnen derselben Entwurfskennung auf einer frischen Seite.
      seite = (await brauche(kontext, "die Sitzung").newPage()) as unknown as Buehne;
      await mitBefund("K2 · Wiederöffnen", async (s) => {
        const geholt: Antwort[] = [];
        s.on("response", (a) => {
          if (a.request().method() === "GET" && new URL(a.url()).pathname === `/api/drafts/${id}`) {
            geholt.push(a);
          }
        });
        await s.goto(`${basis}/erfassen?draft=${encodeURIComponent(id)}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await zumFormular(s);
        await warteBis(s, figurenzahl(2), "der wiedergeöffnete Entwurf zeigt beide Bildhüllen");
        await warteBis(s, BEIDE_GELADEN, "beide wiedergeöffneten Bilder sind geladen");

        const letzte = geholt.at(-1);
        expect(letzte, `kein GET /api/drafts/${id} beim Wiederöffnen`).toBeDefined();
        expect((letzte as Antwort).status()).toBe(200);
        const rumpfGet = rumpfAus(await (letzte as Antwort).json());
        expect(rumpfGet, "die GET-Antwort trägt keinen bodyHtml").not.toBeNull();
        beleg(`K2 · GET /api/drafts/${id} bodyHtml-Bilder: ${bildTags(rumpfGet as string)}`);

        const ausSql = await seiteAusfuehren<Figur[]>(s, lageAus(JSON.stringify(rumpfSql)));
        const ausGet = await seiteAusfuehren<Figur[]>(s, lageAus(JSON.stringify(rumpfGet)));
        const nachher = await seiteAusfuehren<Figur[]>(s, lageAus(`${FELD}.innerHTML`));
        for (const [wo, lage] of [
          ["drafts-Zeile (SQL)", ausSql],
          ["GET /api/drafts/:id", ausGet],
          ["Editor nach dem Wiederöffnen", nachher],
        ] as const) {
          pruefeIdentitaet(lage, soll, wo);
          expect(
            lage.map((f) => [f.width, f.stufe]),
            `${wo}: Größenangaben`,
          ).toEqual(soll.map((f) => [f.width, f.stufe]));
        }

        // Die Darstellung im wiedergeöffneten Editor — erneut im Browser gemessen.
        const m0 = await seiteAusfuehren<Messung>(s, messe(0));
        const m1 = await seiteAusfuehren<Messung>(s, messe(1));
        const [v0, v1] = sollMessung as [Messung, Messung];
        beleg(
          `K2 · Entwurf ${id} · Bild 1 vorher ${v0.width} Anteil ${v0.anteil.toFixed(4)} (${v0.breitePx.toFixed(1)}px) → nachher ${m0.width} Anteil ${m0.anteil.toFixed(4)} (${m0.breitePx.toFixed(1)}px von ${m0.spaltePx.toFixed(1)}px) · Bild 2 vorher Stufe ${v1.stufe} Anteil ${v1.anteil.toFixed(4)} → nachher Stufe ${m1.stufe} Anteil ${m1.anteil.toFixed(4)}`,
        );
        expect(m0.id).toBe(v0.id);
        expect(m0.width).toBe(v0.width);
        pruefeDarstellung(m0, "wiedergeöffnet, Bild 1");
        expect(Math.abs(m0.anteil - v0.anteil), "Bild 1: Breite vor/nach").toBeLessThan(0.005);
        expect(m1.id).toBe(v1.id);
        expect(m1.stufe).toBe("75");
        expect(Math.abs(m1.anteil - 0.75), "Bild 2: Stufe Groß").toBeLessThan(0.01);

        // Das wiedergeöffnete Bild zeigt beim Auswählen seine freie Breite und seine Griffe.
        await waehleBild(s, 0);
        const wert = await seiteAusfuehren<string | null>(
          s,
          `(${LEISTE}.querySelector('[data-testid="bildgroesse-gezogen"]') || {}).textContent || null`,
        );
        expect(wert).toBe((v0.width as string).replace("%", " %"));
        beleg(`K2 · GRÜN · Entwurf ${id} · Anker ${soll.map((f) => f.bildId).join(", ")}`);
      });
    },
    FALL_RAHMEN_MS * 3,
  );
});
