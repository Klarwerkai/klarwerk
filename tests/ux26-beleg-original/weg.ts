// ================================================================================================
// UX-26 · BELEG UND ORIGINAL — DER WEG IM ECHTEN BROWSER, GENAU EINMAL BESCHRIEBEN.
// ================================================================================================
//
// Einmal beschrieben, zweimal gefahren (Bauform `tests/fassungsrueckholung-echter-browser/weg.ts`):
//   · `beleg-original-im-echten-browser.test.ts` → Speicherablagen, läuft im Tor.
//   · `beleg-original-pg.integration.test.ts`    → `buildPgServices(pool)`, echte PostgreSQL.
// Verschieden ist EIN Argument: wie der Altbestand „Beleg fehlt" entsteht (s. `Altbestand`).
//
// NICHTS HIER IST NACHGEBAUT. Die gebaute Fläche (`apps/web/dist`), der echte Server auf echtem
// Socket (`starteStrecke`), die echte Anmeldemaske und die Tastaturprimitiven kommen aus den
// vorhandenen Vorrichtungen (`tests/gast-nutzerweg/*`, `tests/fassungsrueckholung-echter-browser/
// weg.ts`). Die Vorbereitung legt ihren Bestand über die ECHTEN Routen an; der Weg selbst geht nur
// über die Oberfläche, mit der Tastatur.
//
// WAS DER WEG JE DURCHGANG (Sprache × Breite) MISST — Auftrag arbeit:ux26-beleg-original-20260921:
//   K1  Eintrag mit zwei echten Anhängen und vier Belegen: Anhänge 2, Belege 4 stehen so da; der
//       vorhandene Knopf „Original anzeigen" führt per Tastatur zum RICHTIGEN Anhang, und dessen
//       Öffnen liefert genau die hochgeladenen Bytes.
//   K2  der Beleg des abgelösten dritten Originals bleibt als Karte, sein Satz sagt beides, ohne Knopf.
//   K3  „Beleg fehlt" und „kein Beleganlass" in Abschnitt 9 UND in der Prüfkarte `/kapital`
//       (dort als Zeilenzustand bzw. als Neutral-Zähler) — gelesen VON DER FLÄCHE und der
//       Bedeutung aus `bedeutung.ts` vorgelegt.
//   K4  Leerstand mit Altoriginal: der Bearbeiter folgt „Quelle anlegen" per Tastatur, legt die
//       Quelle an, lädt neu — und der gespeicherte Beleg steht wieder da. Ein Leser sieht keinen Weg.
//   K5  jede dieser Aussagen ist ZEICHENGENAU sichtbar (nichts abgeschnitten, nichts seitlich aus
//       dem Fenster) — bei 320 px und am Desktop, in DE/EN/NL.
//
// KEINE PRODUKTDATEI WIRD BERÜHRT. Einzige Beobachtung im Browser: `window.open` wird im Profil
// MITGESCHRIEBEN statt einen zweiten Tab zu öffnen; die mitgeschriebene Adresse wird danach mit den
// Keksen desselben Profils abgerufen, und ihre Bytes werden gegen die hochgeladene Datei verglichen.
import type { FastifyInstance } from "fastify";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { anmelden, mitTaste, zuElement } from "../fassungsrueckholung-echter-browser/weg";
import {
  type Browser,
  LIES_TEXT,
  type Seite,
  warte as browserWarte,
  fn,
  profil,
} from "../gast-nutzerweg/browserweg";
import { type Sitzung, type Strecke, mussGelingen } from "../gast-nutzerweg/strecke";
import { type Aussage, SCHLUESSEL, type Sprache, verstoesse, zaehlerVerstoesse } from "./bedeutung";

const WER = "UX-26 Beleg/Original";

export const SCHMAL = { width: 320, height: 800 };
export const DESKTOP = { width: 1280, height: 900 };

/** Die Texte des Katalogs je Sprache — die Fläche muss sie zeigen, `bedeutung.ts` muss sie tragen. */
export const Tx = (sprache: Sprache) => i18n.getFixedT(sprache);

// ------------------------------------------------------------------------------------------------
// DER BESTAND — über die echten Routen, KEIN Schritt des Weges.
// ------------------------------------------------------------------------------------------------

export const TITEL_ZWEI = "Reinigung Spritzzone Linie 3 (UX-26 Beleg/Original)";
export const TITEL_FEHLT = "Dichtung Presse 4 aus dem Altbestand (UX-26 Beleg/Original)";
export const ANHANG_1 = "Pruefprotokoll-Linie-3-Seite-1.pdf";
export const ANHANG_2 = "Pruefprotokoll-Linie-3-Seite-2.pdf";
export const ABGELOEST = "Messblatt-Linie-3-vom-Juli.pdf";
export const QUELLE = "Werknorm WN 12-4 Reinigung";
const ALTFOTO = "altes-foto-linie-3.png";
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Drei Dateien mit drei VERSCHIEDENEN Inhalten — sonst bewiese „richtige Bytes" nichts. */
export const INHALT = {
  eins: "%PDF-1.4 UX26 Original Seite 1",
  zwei: "%PDF-1.4 UX26 Original Seite 2",
  drei: "%PDF-1.4 UX26 Original Juli (abgeloest)",
} as const;

const pdf = (inhalt: string): string =>
  `data:application/pdf;base64,${Buffer.from(inhalt).toString("base64")}`;

interface Eintrag {
  koId: string;
  titel: string;
}

export interface Bestand {
  zwei: Eintrag & {
    anhang2: string;
    objekt2: string;
    beleg2: string;
  };
  fehlt: Eintrag;
  /** Je Durchgang EIN eigener Leerstand — der Bearbeiter legt darin eine Quelle an. */
  leer: Map<string, Eintrag>;
  /** Der Leerstand, den nur der Leser öffnet — er bleibt unberührt. */
  leserLeer: Eintrag;
}

/**
 * WIE DER ALTBESTAND „BELEG FEHLT" ENTSTEHT. Über die heutigen Routen gibt es ihn nicht mehr: jede
 * Quelle und jeder Objektanhang schreibt seine Belegzeile (`service.ts`, `addSource`/
 * `addAttachment`). Es gibt ihn in Beständen aus der Zeit vor den Belegzeilen (SCRUM-160). Der
 * PostgreSQL-Lauf stellt ihn her, indem er die Zeilen in `ko_evidence` löscht; der Speicherlauf
 * blendet sie am Draht aus (`altbestandAmDraht`). Beides fasst Produktcode nicht an.
 */
export type Altbestand = (koId: string) => Promise<void>;

async function eintragAnlegen(wer: Sitzung, titel: string): Promise<string> {
  const antwort = mussGelingen(
    `POST /api/kos (${titel})`,
    await wer.sende("POST", "/api/kos", {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} — Kurzfassung.`,
      type: "best_practice",
      category: "Produktion",
      bodyHtml: "<p>Reinigung und Prüfung.</p>",
    }),
    201,
  );
  return (antwort.json as { id: string }).id;
}

async function handle(
  wer: Sitzung,
  koId: string,
  rumpf: Record<string, unknown>,
): Promise<unknown> {
  return mussGelingen(
    `PUT /api/kos/${koId} (${String(rumpf.action)})`,
    await wer.sende("PUT", `/api/kos/${koId}`, rumpf),
  ).json;
}

async function dateiHochladen(wer: Sitzung, name: string, inhalt: string): Promise<string> {
  const antwort = await wer.sende("POST", "/api/objects", {
    name,
    mime: "application/pdf",
    data: pdf(inhalt),
  });
  expect(antwort.status, `POST /api/objects (${name}): ${antwort.text}`).toBeLessThan(300);
  return (antwort.json as { id: string }).id;
}

interface Anhangszeile {
  id: string;
  name: string;
  objectId?: string;
}

async function anhaengen(wer: Sitzung, koId: string, name: string, objectId: string) {
  const ko = (await handle(wer, koId, {
    action: "attach",
    attachment: { name, mime: "application/pdf", objectId },
  })) as { attachments: Anhangszeile[] };
  const neu = ko.attachments.find((a) => a.objectId === objectId);
  expect(neu, `der Anhang ${name} steht nicht am Objekt`).toBeTruthy();
  return (neu as Anhangszeile).id;
}

/** Ein Eintrag mit Altoriginal (Inline-Bild ohne Objektkennung) — Original da, Beleg keiner. */
async function leerstandAnlegen(wer: Sitzung, titel: string): Promise<Eintrag> {
  const koId = await eintragAnlegen(wer, titel);
  await handle(wer, koId, {
    action: "attach",
    attachment: { name: ALTFOTO, mime: "image/png", dataUrl: PNG },
  });
  return { koId, titel };
}

export interface BelegZeile {
  id: string;
  kind: string;
  label: string;
  attachmentId?: string;
  objectId?: string;
}

export async function belegeAmServer(wer: Sitzung, koId: string): Promise<BelegZeile[]> {
  return mussGelingen(
    `GET /api/kos/${koId}/evidence`,
    await wer.sende("GET", `/api/kos/${koId}/evidence`),
  ).json as BelegZeile[];
}

export const durchgangsName = (sprache: Sprache, breite: number): string => `${sprache}-${breite}`;

export async function legeBestandAn(
  admin: Sitzung,
  durchgaenge: readonly string[],
  altbestand: Altbestand,
): Promise<Bestand> {
  // Eine adresslose Quelle ohne Anker ist auf der restriktiven Werksstufe gesperrt
  // (`externalAttachGate.ts`, `unanchored`). Der Leerstandweg braucht sie — die Stufe wird deshalb
  // über den Weg des Administrators freigegeben, nicht umgangen.
  mussGelingen(
    "PUT /api/external/policy",
    await admin.sende("PUT", "/api/external/policy", { stage: "search_attach" }),
  );

  // ── K1/K2: zwei echte Originale, eine Quelle, ein inzwischen abgelöstes drittes Original. ──
  const zweiId = await eintragAnlegen(admin, TITEL_ZWEI);
  const objekt1 = await dateiHochladen(admin, ANHANG_1, INHALT.eins);
  const objekt2 = await dateiHochladen(admin, ANHANG_2, INHALT.zwei);
  const objekt3 = await dateiHochladen(admin, ABGELOEST, INHALT.drei);
  await anhaengen(admin, zweiId, ANHANG_1, objekt1);
  const anhang2 = await anhaengen(admin, zweiId, ANHANG_2, objekt2);
  const anhang3 = await anhaengen(admin, zweiId, ABGELOEST, objekt3);
  await handle(admin, zweiId, {
    action: "add-source",
    source: { label: QUELLE, objectId: objekt1 },
  });
  await handle(admin, zweiId, { action: "detach", attachmentId: anhang3 });
  const zweiBelege = await belegeAmServer(admin, zweiId);
  expect(
    zweiBelege,
    "Vorbedingung: vier Belegzeilen (2 Anhänge, 1 Quelle, 1 abgelöst)",
  ).toHaveLength(4);
  const beleg2 = zweiBelege.find((b) => b.kind === "attachment" && b.attachmentId === anhang2);
  expect(beleg2, "Vorbedingung: der Beleg zum zweiten Anhang").toBeTruthy();
  expect(
    zweiBelege.some((b) => b.attachmentId === anhang3),
    "Vorbedingung: der Beleg des abgelösten Originals ist NICHT mit ihm verschwunden",
  ).toBe(true);

  // ── K3: ein Eintrag mit Quelle, aber ohne Belegzeile — der Altbestand. ────────────────────
  const fehltId = await eintragAnlegen(admin, TITEL_FEHLT);
  await handle(admin, fehltId, { action: "add-source", source: { label: "Werknorm WN 7" } });
  await altbestand(fehltId);
  expect(
    await belegeAmServer(admin, fehltId),
    "Vorbedingung: der Altbestand trägt keine Belegzeile",
  ).toEqual([]);

  const leer = new Map<string, Eintrag>();
  for (const name of durchgaenge) {
    leer.set(name, await leerstandAnlegen(admin, `Pausenregel Halle 2 ${name} (UX-26 Leerstand)`));
  }
  return {
    zwei: { koId: zweiId, titel: TITEL_ZWEI, anhang2, objekt2, beleg2: (beleg2 as BelegZeile).id },
    fehlt: { koId: fehltId, titel: TITEL_FEHLT },
    leer,
    leserLeer: await leerstandAnlegen(admin, "Pausenregel Halle 2 zum Lesen (UX-26 Leerstand)"),
  };
}

/**
 * Der Altbestand für den Speicherlauf: die Belegzeilen EINES Eintrags werden am Draht
 * ausgeblendet — in `/api/kos/:id/evidence` und im Index `/api/evidence`. Ein `onSend`-Haken VOR
 * dem Horchen, ausserhalb des Produktcodes; alle anderen Einträge laufen unberührt durch.
 */
export function altbestandAmDraht(): {
  ids: Set<string>;
  vorListen: (app: FastifyInstance) => Promise<void>;
} {
  const ids = new Set<string>();
  return {
    ids,
    vorListen: async (app) => {
      app.addHook("onSend", async (request, _reply, payload) => {
        if (ids.size === 0 || request.method !== "GET" || typeof payload !== "string") {
          return payload;
        }
        const pfad = request.url.split("?")[0] ?? "";
        const einzeln = /^\/api\/kos\/([^/]+)\/evidence$/.exec(pfad);
        if (einzeln && ids.has(einzeln[1] as string)) {
          return "[]";
        }
        if (pfad === "/api/evidence") {
          const zeilen = JSON.parse(payload) as { koId: string }[];
          return JSON.stringify(zeilen.filter((z) => !ids.has(z.koId)));
        }
        return payload;
      });
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DIE MESSUNGEN IM BROWSER
// ------------------------------------------------------------------------------------------------

/** Die sichtbare Lesung eines Elements — Zeichen für Zeichen (Bauform UX-25 `SICHTBAR_FN`). */
export interface Lesung {
  /** Der eigene Text des Elements (direkte Textknoten), normalisiert. */
  voll: string;
  /** Davon, was im eigenen Kasten UND waagerecht im Fenster liegt. */
  sichtbar: string;
  breite: number;
  hoehe: number;
  unsichtbar: string | null;
}

/**
 * Sucht das Element nach `ziel` und liest es. Alle Suchen gehen über die sichtbare Struktur der
 * Fläche (Abschnitt, Karte, Überschrift) oder über die Marken, die das Produkt SELBST setzt.
 */
const LIES = `(ziel) => {
  const norm = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const belege = document.querySelector('[data-bib-abschnitt="belege"]');
  const karte = (titel) => belege && [...belege.querySelectorAll("li")].find(
    (li) => li.firstElementChild && norm(li.firstElementChild.textContent) === titel);
  let el = null;
  if (ziel.art === "abgeloest") {
    const k = karte(ziel.titel);
    el = k ? k.querySelector("p") : null;
  } else if (ziel.art === "frische") {
    const dt = belege && [...belege.querySelectorAll("dt")].find((d) => norm(d.textContent) === ziel.titel);
    el = dt ? dt.nextElementSibling : null;
  } else if (ziel.art === "satz") {
    el = belege && [...belege.querySelectorAll("p")].find((p) => norm(p.textContent) === ziel.text);
  } else if (ziel.art === "selektor") {
    el = document.querySelector(ziel.selektor);
  } else if (ziel.art === "pruefkarte") {
    const kopf = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && norm(e.textContent) === ziel.titel);
    const kartenEl = kopf ? kopf.parentElement : null;
    const link = kartenEl ? kartenEl.querySelector('li a[href="/wissen/' + ziel.koId + '"]') : null;
    const zeile = link ? link.closest("li") : null;
    el = zeile ? [...zeile.querySelectorAll("span")].find((s) => norm(s.textContent) === ziel.text) || null : null;
  } else if (ziel.art === "neutralZaehler") {
    // Die Zählerzeile der Prüfkarte: der Behälter mit genau vier Zählern „<Wort>: <Zahl>"
    // (Stufe2.tsx: veraltet, fehlend, aktuell, neutral). Gewählt wird nach STELLE, nicht nach
    // Wortlaut — so liest die Messung auch einen falschen oder alten Zählertext, statt ihn zu übersehen.
    const kopf = [...document.querySelectorAll("*")].find(
      (e) => e.children.length === 0 && norm(e.textContent) === ziel.titel);
    const kartenEl = kopf ? kopf.parentElement : null;
    const zaehler = (b) => [...b.children].filter((k) => k.tagName === "SPAN");
    const behaelter = kartenEl ? [...kartenEl.querySelectorAll("div")].find((d) => {
      const z = zaehler(d);
      return z.length === 4 && z.every((k) => /:\\s*\\d+$/.test(norm(k.textContent)));
    }) : null;
    el = behaelter ? zaehler(behaelter)[3] : null;
  }
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  const kasten = el.getBoundingClientRect();
  const breiteFenster = document.documentElement.clientWidth;
  let voll = "";
  let sichtbar = "";
  for (const knoten of el.childNodes) {
    if (knoten.nodeType !== 3) continue;
    const roh = knoten.textContent || "";
    voll += roh;
    const bereich = document.createRange();
    for (let i = 0; i < roh.length; i++) {
      bereich.setStart(knoten, i);
      bereich.setEnd(knoten, i + 1);
      const r = bereich.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) { sichtbar += roh[i]; continue; }
      const drin = r.left >= kasten.left - 0.5 && r.right <= kasten.right + 0.5
        && r.top >= kasten.top - 0.5 && r.bottom <= kasten.bottom + 0.5
        && r.left >= -0.5 && r.right <= breiteFenster + 0.5;
      if (drin) sichtbar += roh[i];
    }
  }
  let unsichtbar = null;
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const s = getComputedStyle(e);
    if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) {
      unsichtbar = "<" + e.tagName.toLowerCase() + "> " + s.display + "/" + s.visibility + "/" + s.opacity;
      break;
    }
  }
  return { voll: norm(voll), sichtbar: norm(sichtbar), breite: Math.round(kasten.width),
    hoehe: Math.round(kasten.height), unsichtbar };
}`;

type Ziel =
  | { art: "abgeloest"; titel: string }
  | { art: "frische"; titel: string }
  | { art: "satz"; text: string }
  | { art: "selektor"; selektor: string }
  | { art: "pruefkarte"; titel: string; koId: string; text: string }
  | { art: "neutralZaehler"; titel: string };

async function lies(seite: Seite, ziel: Ziel, was: string): Promise<Lesung> {
  const lesung = await seite.evaluate<Lesung | null>(fn(LIES), ziel);
  expect(lesung, `${WER}: ${was} — nicht auf der Fläche gefunden`).not.toBeNull();
  return lesung as Lesung;
}

/** K5: ZEICHENGENAU sichtbar — nichts abgeschnitten, nichts seitlich aus dem Fenster. */
function mussLesbarSein(lesung: Lesung, was: string): void {
  expect(lesung.unsichtbar, `${WER}: ${was} ist ausgeblendet`).toBeNull();
  expect(lesung.breite, `${WER}: ${was} hat keine Breite`).toBeGreaterThan(0);
  expect(lesung.hoehe, `${WER}: ${was} hat keine Höhe`).toBeGreaterThan(0);
  expect(lesung.voll.length, `${WER}: ${was} ist leer`).toBeGreaterThan(0);
  expect(lesung.sichtbar, `${WER}: ${was} ist nicht vollständig lesbar: „${lesung.voll}“`).toBe(
    lesung.voll,
  );
}

/** Der Text VON DER FLÄCHE muss der Katalogtext sein UND die festgehaltene Bedeutung tragen. */
function mussBedeuten(sprache: Sprache, aussage: Aussage, text: string, was: string): void {
  expect(text, `${WER}: ${was} zeigt nicht den Katalogtext`).toBe(Tx(sprache)(SCHLUESSEL[aussage]));
  expect(verstoesse(sprache, aussage, text), `${WER}: ${was}`).toEqual([]);
}

const GIBT_ES = "(sel) => !!document.querySelector(sel)";
const AKTIV_IST = "(sel) => !!document.activeElement && document.activeElement.matches(sel)";
const OEFFNEN_MITSCHREIBEN = `try {
  window.__ux26Geoeffnet = [];
  window.open = function (adresse) { window.__ux26Geoeffnet.push(String(adresse)); return null; };
} catch (e) {}`;
const STUFE2_AN = `try { localStorage.setItem("kw.stufe2.v1", "1"); } catch (e) {}`;

async function warte(seite: Seite, quelle: string, was: string, arg?: unknown, frist = 45_000) {
  try {
    await browserWarte(seite, quelle, was, arg, frist);
  } catch (fehler) {
    throw new Error(`${WER}: ${was} — nicht eingetreten.\n${String(fehler)}`);
  }
}

/**
 * Den Eintrag öffnen und Abschnitt 9 „Belege" AUFMACHEN — beides mit der Tastatur.
 *
 * Ob „Mehr" und der Abschnitt schon offen stehen, wird GELESEN und nicht angenommen: nach einem
 * Neuladen kann die Fläche ihren Zustand behalten, und ein zweiter Tastendruck klappte dann zu.
 */
async function belegeOeffnen(
  seite: Seite,
  basis: string,
  sprache: Sprache,
  e: Eintrag,
  marke: string,
  tastatur: Record<string, number>,
  neuLaden = false,
): Promise<void> {
  if (neuLaden) {
    await seite.reload({ waitUntil: "domcontentloaded" });
  } else {
    await seite.goto(`${basis}/wissen/${e.koId}`, { waitUntil: "domcontentloaded" });
  }
  await warte(seite, "(t) => document.body.innerText.includes(t)", `„${e.titel}“`, e.titel, 60_000);
  await warte(seite, GIBT_ES, `die Zeile „Mehr“ (${marke})`, '[data-testid="bib-mehr"]');
  if (!(await seite.evaluate<boolean>(fn(GIBT_ES), '[data-bib-abschnitt="belege"]'))) {
    await mitTaste(seite, '[data-testid="bib-mehr"]', `${marke}_mehr`, tastatur);
  }
  const kopf = '[data-bib-abschnitt="belege"] > summary';
  await warte(seite, GIBT_ES, `der Abschnitt „Belege“ (${marke})`, kopf);
  const offen = "(sel) => !!document.querySelector(sel)?.open";
  if (!(await seite.evaluate<boolean>(fn(offen), '[data-bib-abschnitt="belege"]'))) {
    await mitTaste(seite, kopf, `${marke}_belege`, tastatur);
  }
  const t = Tx(sprache);
  await warte(
    seite,
    "(t) => { const b = document.querySelector('[data-bib-abschnitt=\"belege\"]'); return !!b && b.open && b.innerText.includes(t); }",
    `Abschnitt 9 ist geladen (${marke})`,
    t("ko.evFresh.title"),
    60_000,
  );
}

/**
 * Kein roher Schlüssel in Abschnitt 9, und keiner der ALTEN Texte des Basisstands. Auf Deutsch
 * steht dort „Evidence" überhaupt nicht mehr (dieselbe Zusage wie
 * `tests/ux26-herkunft-belege/herkunft-belege-verstaendlich.test.tsx`, Fall 6).
 */
async function ohneProgrammbrocken(seite: Seite, sprache: Sprache, was: string): Promise<void> {
  const text = await seite.evaluate<string>(
    fn(`() => (document.querySelector('[data-bib-abschnitt="belege"]')?.innerText || "")`),
  );
  expect(text, `${WER}: ${was} zeigt einen rohen Schlüssel`).not.toMatch(/\bko\.ev/);
  const alte: Record<Sprache, readonly string[]> = {
    de: ["Evidence"],
    en: ["Original no longer attached to this object"],
    nl: [
      "Evidence ontbreekt",
      "aanleiding voor evidence",
      "Origineel hangt niet meer aan dit object",
    ],
  };
  for (const alt of alte[sprache]) {
    expect(text, `${WER}: ${was} trägt den alten Text „${alt}“`).not.toContain(alt);
  }
}

// ------------------------------------------------------------------------------------------------
// DER DURCHGANG DES BEARBEITERS
// ------------------------------------------------------------------------------------------------

export interface Durchgangsbefund {
  tastatur: Record<string, number>;
  geoeffnet: string[];
  originalInhalt: string;
  neueQuelle: string;
  textNachNeuladen: string;
}

export async function fahreDurchgang(a: {
  browser: Browser;
  strecke: Strecke;
  bestand: Bestand;
  email: string;
  sprache: Sprache;
  fenster: { width: number; height: number };
}): Promise<Durchgangsbefund> {
  const { sprache, bestand } = a;
  const t = Tx(sprache);
  const basis = a.strecke.basis;
  const name = durchgangsName(sprache, a.fenster.width);
  const tastatur: Record<string, number> = {};
  const { kontext, seite } = await profil(a.browser, a.fenster, sprache);
  await kontext.addInitScript(OEFFNEN_MITSCHREIBEN);
  await kontext.addInitScript(STUFE2_AN);
  try {
    await anmelden(seite, basis, a.email, `${sprache}_anmeldung`, tastatur);

    // ══ K1 · zwei Originale, vier Belege ═════════════════════════════════════════════════════
    await belegeOeffnen(seite, basis, sprache, bestand.zwei, `${sprache}_zwei`, tastatur);
    const sprung = `[data-bib-beleg-sprung="${bestand.zwei.beleg2}"]`;
    await warte(seite, GIBT_ES, "der Knopf „Original anzeigen“ am zweiten Beleg", sprung);
    const abschnitt9 = await seite.evaluate<string>(
      fn(
        `() => document.querySelector('[data-bib-abschnitt="belege"]').innerText.replace(/\\s+/g, " ")`,
      ),
    );
    expect(abschnitt9, `${WER} ${name}: Anhänge 2 und Belege 4 stehen nicht so da`).toContain(
      t("ko.evCons.counts", { sources: "1", attachments: "2", evidence: "4" }),
    );
    for (const titel of [ANHANG_1, ANHANG_2, QUELLE, ABGELOEST]) {
      expect(abschnitt9, `${WER} ${name}: die Belegkarte „${titel}“ fehlt`).toContain(titel);
    }
    expect(abschnitt9, `${WER} ${name}: die Belegart fehlt`).toContain(
      t("ko.evidenceKind.attachment"),
    );
    const knopf = await lies(
      seite,
      { art: "selektor", selektor: sprung },
      "der Knopf zum Original",
    );
    expect(knopf.voll).toBe(t("ko.evidenceToOriginal"));
    mussLesbarSein(knopf, `${name}: „${knopf.voll}“`);

    // ══ K2 · das abgelöste Original ══════════════════════════════════════════════════════════
    const satz = await lies(
      seite,
      { art: "abgeloest", titel: ABGELOEST },
      "der Satz am abgelösten Beleg",
    );
    mussBedeuten(sprache, "abgeloest", satz.voll, `${name}: Satz am abgelösten Beleg`);
    mussLesbarSein(satz, `${name}: Satz am abgelösten Beleg`);
    expect(
      await seite.evaluate<number>(
        fn(`(titel) => {
          const li = [...document.querySelectorAll('[data-bib-abschnitt="belege"] li')].find(
            (l) => l.firstElementChild && l.firstElementChild.textContent.trim() === titel);
          return li ? li.querySelectorAll("button").length : -1;
        }`),
        ABGELOEST,
      ),
      `${WER} ${name}: am abgelösten Beleg steht ein Knopf (oder die Karte fehlt)`,
    ).toBe(0);
    await ohneProgrammbrocken(seite, sprache, `${name}: Eintrag mit zwei Originalen`);

    // ══ K1 · der vorhandene Knopf führt zum RICHTIGEN Original — per Tastatur ════════════════
    await mitTaste(seite, sprung, `${sprache}_original_anzeigen`, tastatur);
    const ziel = `[data-bib-anhang="${bestand.zwei.anhang2}"]`;
    await warte(seite, AKTIV_IST, "der Fokus steht auf dem zweiten Anhang", ziel);
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      "() => (window.__ux26Geoeffnet || []).length > 0",
      "das Original wird geöffnet",
    );
    const geoeffnet = await seite.evaluate<string[]>(fn("() => window.__ux26Geoeffnet"));
    expect(geoeffnet, `${WER} ${name}: ein anderes als das zweite Original`).toEqual([
      `/api/objects/${bestand.zwei.objekt2}/raw`,
    ]);
    const abruf = await seite.evaluate<{ status: number; text: string }>(
      fn(
        "(url) => fetch(url, { credentials: 'include' }).then(async (r) => ({ status: r.status, text: await r.text() }))",
      ),
      geoeffnet[0],
    );
    expect(abruf.status, `${WER} ${name}: das Original ist nicht abrufbar`).toBe(200);
    const inhalt = abruf.text;
    expect(inhalt, `${WER} ${name}: das geöffnete Original trägt fremde Bytes`).toBe(INHALT.zwei);

    // ══ K3 · „Beleg fehlt" in Abschnitt 9 ════════════════════════════════════════════════════
    await belegeOeffnen(seite, basis, sprache, bestand.fehlt, `${sprache}_fehlt`, tastatur);
    const fehlt = await lies(
      seite,
      { art: "frische", titel: t("ko.evFresh.title") },
      "„Beleg fehlt“",
    );
    mussBedeuten(sprache, "belegFehlt", fehlt.voll, `${name}: Abschnitt 9, Beleg fehlt`);
    mussLesbarSein(fehlt, `${name}: Abschnitt 9, Beleg fehlt`);
    const fehltText = await seite.evaluate<string>(fn(LIES_TEXT));
    expect(
      fehltText,
      `${WER} ${name}: wo allein der Beleg fehlt, behauptet die Fläche eine fehlende Datei`,
    ).not.toContain(t("ko.evidenceOriginalDetached"));
    await ohneProgrammbrocken(seite, sprache, `${name}: Altbestand ohne Beleg`);

    // ══ K3 · „Beleg fehlt" in der Prüfkarte ══════════════════════════════════════════════════
    await seite.goto(`${basis}/kapital`, { waitUntil: "domcontentloaded" });
    await warte(
      seite,
      "(sel) => !!document.querySelector(sel)",
      "die Prüfkarte führt den Altbestand",
      `li a[href="/wissen/${bestand.fehlt.koId}"]`,
      60_000,
    );
    const pille = await lies(
      seite,
      {
        art: "pruefkarte",
        titel: t("evFresh.title"),
        koId: bestand.fehlt.koId,
        text: t(SCHLUESSEL.belegFehlt),
      },
      "der Zustand an der Zeile der Prüfkarte",
    );
    mussBedeuten(sprache, "belegFehlt", pille.voll, `${name}: Prüfkarte, Beleg fehlt`);
    mussLesbarSein(pille, `${name}: Prüfkarte, Beleg fehlt`);

    // ══ K3 · „kein Beleganlass" in der Prüfkarte (Runde 2) ═══════════════════════════════════
    // Die Prüfkarte führt diesen Zustand nur als Zähler; er muss den Zustand beim Namen nennen.
    const neutral = await lies(
      seite,
      { art: "neutralZaehler", titel: t("evFresh.title") },
      "der Neutral-Zähler der Prüfkarte",
    );
    expect(
      zaehlerVerstoesse(sprache, neutral.voll),
      `${WER} ${name}: Prüfkarte, Neutral-Zähler „${neutral.voll}“`,
    ).toEqual([]);
    expect(neutral.voll.startsWith(`${t(SCHLUESSEL.keinAnlass)}:`)).toBe(true);
    mussLesbarSein(neutral, `${name}: Prüfkarte, Neutral-Zähler`);

    // ══ K4 · der Leerstand mit Altoriginal: „Quelle anlegen" — und nach Neuladen wieder da ═══
    const leer = bestand.leer.get(name);
    if (!leer) {
      throw new Error(`${WER}: kein Leerstand für ${name} angelegt`);
    }
    await belegeOeffnen(seite, basis, sprache, leer, `${sprache}_leer`, tastatur);
    const anlass = await lies(
      seite,
      { art: "frische", titel: t("ko.evFresh.title") },
      "„kein Beleganlass“",
    );
    mussBedeuten(sprache, "keinAnlass", anlass.voll, `${name}: Abschnitt 9, kein Beleganlass`);
    mussLesbarSein(anlass, `${name}: Abschnitt 9, kein Beleganlass`);
    mussLesbarSein(
      await lies(seite, { art: "satz", text: t("ko.evidenceEmpty") }, "der Leersatz"),
      `${name}: Leersatz`,
    );
    const weg = await lies(
      seite,
      { art: "selektor", selektor: "[data-bib-beleg-leer-weg]" },
      "„Quelle anlegen“",
    );
    expect(weg.voll).toBe(t("ko.evidenceEmptyCta"));
    mussLesbarSein(weg, `${name}: „Quelle anlegen“`);
    await ohneProgrammbrocken(seite, sprache, `${name}: Leerstand`);

    await mitTaste(seite, "[data-bib-beleg-leer-weg]", `${sprache}_quelle_anlegen`, tastatur);
    await warte(
      seite,
      AKTIV_IST,
      "der Weg endet im Abschnitt „Quellen“",
      '[data-bib-abschnitt="quellen"] > summary',
    );
    const neueQuelle = `Werksanweisung ${name.toUpperCase()} Pausen`;
    const feld = `[data-bib-abschnitt="quellen"] input[placeholder="${t("ko.sourceLabel")}"]`;
    tastatur[`${sprache}_quelle_feld`] = await zuElement(seite, feld, "das Feld für die Quelle");
    await seite.keyboard.type(neueQuelle);
    tastatur[`${sprache}_quelle_speichern`] = await tabZuKnopf(seite, t("ko.sourceAdd"));
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      "(t) => (document.querySelector('[data-bib-abschnitt=\"quellen\"]')?.innerText || '').includes(t)",
      "die angelegte Quelle steht im Abschnitt „Quellen“",
      neueQuelle,
    );

    // Neu laden — gezählt wird erst, was danach wieder dasteht.
    await belegeOeffnen(seite, basis, sprache, leer, `${sprache}_neuladen`, tastatur, true);
    await warte(
      seite,
      `(t) => [...document.querySelectorAll('[data-bib-abschnitt="belege"] li')].some(
        (l) => l.firstElementChild && l.firstElementChild.textContent.trim() === t)`,
      "der gespeicherte Beleg steht nach dem Neuladen als Karte da",
      neueQuelle,
    );
    const textNachNeuladen = await seite.evaluate<string>(
      fn(`() => document.querySelector('[data-bib-abschnitt="belege"]').innerText`),
    );
    expect(
      textNachNeuladen,
      `${WER} ${name}: der Leerstand steht trotz Beleg noch da`,
    ).not.toContain(t("ko.evidenceEmpty"));
    const aktuell = await lies(
      seite,
      { art: "frische", titel: t("ko.evFresh.title") },
      "Frische nach Neuladen",
    );
    expect(aktuell.voll, `${WER} ${name}: der neue Beleg zählt nicht als aktuell`).toBe(
      t("ko.evFresh.current"),
    );
    return { tastatur, geoeffnet, originalInhalt: inhalt, neueQuelle, textNachNeuladen };
  } finally {
    await kontext.close();
  }
}

/** Von der jetzigen Stelle weiter, bis ein KNOPF mit genau dieser Beschriftung den Fokus hat. */
async function tabZuKnopf(seite: Seite, text: string, hoechstens = 25): Promise<number> {
  const treffer = `(t) => { const a = document.activeElement;
    return !!a && a.tagName === "BUTTON" && (a.textContent || "").trim() === t; }`;
  for (let i = 1; i <= hoechstens; i += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), text)) {
      return i;
    }
  }
  throw new Error(
    `${WER}: der Knopf „${text}“ war in ${hoechstens} Tab-Anschlägen nicht erreichbar`,
  );
}

// ------------------------------------------------------------------------------------------------
// DER DURCHGANG DES LESERS
// ------------------------------------------------------------------------------------------------

export async function fahreLeser(a: {
  browser: Browser;
  strecke: Strecke;
  bestand: Bestand;
  email: string;
  sprache: Sprache;
}): Promise<{ wegDa: boolean; knoepfe: string[] }> {
  const t = Tx(a.sprache);
  const tastatur: Record<string, number> = {};
  const { kontext, seite } = await profil(a.browser, SCHMAL, a.sprache);
  try {
    await anmelden(seite, a.strecke.basis, a.email, `${a.sprache}_leser`, tastatur);
    await belegeOeffnen(
      seite,
      a.strecke.basis,
      a.sprache,
      a.bestand.leserLeer,
      `${a.sprache}_leser`,
      tastatur,
    );
    const anlass = await lies(
      seite,
      { art: "frische", titel: t("ko.evFresh.title") },
      "„kein Beleganlass“ (Leser)",
    );
    mussBedeuten(a.sprache, "keinAnlass", anlass.voll, `Leser ${a.sprache}: kein Beleganlass`);
    mussLesbarSein(anlass, `Leser ${a.sprache}: kein Beleganlass`);
    mussLesbarSein(
      await lies(seite, { art: "satz", text: t("ko.evidenceEmpty") }, "der Leersatz (Leser)"),
      `Leser ${a.sprache}: Leersatz`,
    );
    const wegDa = await seite.evaluate<boolean>(fn(GIBT_ES), "[data-bib-beleg-leer-weg]");
    // Welche Bedienelemente stehen im Abschnitt? Erwartet ist allein der Nachladeweg (JOB 3430).
    const knoepfe = await seite.evaluate<string[]>(
      fn(`() => [...document.querySelectorAll('[data-bib-abschnitt="belege"] button')].map(
        (b) => b.getAttribute("data-bib-nachladen") !== null ? "nachladen" : (b.textContent || "").trim())`),
    );
    return { wegDa, knoepfe };
  } finally {
    await kontext.close();
  }
}
