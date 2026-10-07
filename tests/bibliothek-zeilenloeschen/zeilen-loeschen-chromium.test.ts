// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BIBLIOTHEK-LÖSCHEN (R-0959) — DER PAPIERKORB AM TREFFER IM ECHTEN BROWSER.
// ================================================================================================
//
// „Berechtigte können einen Beitrag direkt aus der Trefferliste löschen; vorher fragt eine ruhige
// Zeile nach." Der montierte Fall (`zeilen-loeschen-mounted.test.tsx`) belegt Ablauf, Rechte und
// Fehlerwege; was jsdom nicht kann, steht hier: die ruhige Zeile liegt WIRKLICH im Sichtfenster und
// obenauf, die Liste rollt dabei nicht weg, der Klick trifft den Papierkorb mit der echten Maus, und
// der bestätigende Knopf trägt im gerechneten Stil eine andere Farbe als „Behalten".
//
// GEBAUTE ANWENDUNG (`apps/web/dist`) in echtem Chromium gegen das ECHTE Fastify-Backend
// (`h4-harness`). Die Liste kommt aus `GET /api/library/search`, gelöscht wird über
// `DELETE /api/kos/:id`, und ob ein Objekt weg ist, sagt der Server. Die vier Einträge sind
// Wegwerfdaten dieser einen Instanz; ein echter Bestand wird nicht berührt.
//
// WAS DIESE DATEI NICHT BELEGT: eine Bedienung durch einen Menschen und den Abgleich des Symbols
// mit dem Entwurf `Bibliothek.dc.html` (der liegt ausserhalb dieses Arbeitsbaums).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

const de = i18n.getFixedT("de");

const EMAIL = "pedi@r0959.test";
const PASSWORT = "geheim12345";
const TITEL_A = "Wegwerf A · Ablage Reisekosten";
const TITEL_B = "Wegwerf B · Ablage Bewirtung";

let stand: H4Stand | null = null;
let fehler: string | null = null;
let idA = "";
let idB = "";

const seite = (): H4Stand["seite"] => {
  if (!stand) {
    throw new Error("Browser nicht bereit");
  }
  return stand.seite;
};

async function token(): Promise<string> {
  const antwort = await stand?.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: EMAIL, password: PASSWORT },
  });
  return (antwort?.json() as { token: string }).token;
}

/** Fragt den SERVER, ob es den Eintrag noch gibt — nicht die Liste. */
async function amServer(id: string): Promise<number> {
  const antwort = await stand?.app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: { authorization: `Bearer ${await token()}` },
  });
  return antwort?.statusCode ?? 0;
}

async function warteAuf(quelle: string, was: string, arg?: unknown): Promise<void> {
  await seite()
    .waitForFunction(fn(quelle), arg, { timeout: 30_000 })
    .catch((e: unknown) => {
      throw new Error(`${was}: ${String(e).split("\n")[0]}`);
    });
}

const LISTE_FN = `() => [...document.querySelectorAll('[data-testid="bib-zeile"]')]
  .map((z) => z.getAttribute('data-bib-id'))`;
const liste = (): Promise<string[]> => seite().evaluate<string[]>(fn(LISTE_FN));

/**
 * Die Lage der ruhigen Zeile EINES Treffers im Sichtfenster, samt dem, was daneben gilt: steht sie
 * im Block genau dieses Treffers, liegt sie obenauf, ist keine Dialogfläche offen, wo steht der
 * Fokus, und wie weit ist die Liste gerollt.
 */
const LAGE_FN = `(id) => {
  const block = [...document.querySelectorAll('[data-testid="bib-zeilenblock"]')].find((b) => b.getAttribute('data-bib-id') === id);
  const el = block ? block.querySelector('[data-testid="bib-zeile-loeschen-rueckfrage"]') : null;
  const spur = document.querySelector('[data-testid="bib-spur"]');
  if (!el) { return { da: false, spurOben: spur ? Math.round(spur.scrollTop) : null }; }
  const r = el.getBoundingClientRect();
  const mitte = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
  const knopf = (wort) => [...el.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === wort) || null;
  const ja = knopf(${JSON.stringify(de("ko.deleteYes"))});
  const behalten = knopf(${JSON.stringify(de("ko.deleteKeep"))});
  return {
    da: true,
    oben: Math.round(r.top), unten: Math.round(r.bottom),
    links: Math.round(r.left), rechts: Math.round(r.right), hoehe: Math.round(r.height),
    fensterHoehe: innerHeight, fensterBreite: innerWidth,
    obenauf: mitte !== null && (el === mitte || el.contains(mitte)),
    dialog: document.querySelector('[data-bib-loeschen]') !== null,
    fokus: document.activeElement ? (document.activeElement.textContent || '').trim() : null,
    jaFarbe: ja ? getComputedStyle(ja).color : null,
    jaGrund: ja ? getComputedStyle(ja).backgroundColor : null,
    behaltenFarbe: behalten ? getComputedStyle(behalten).color : null,
    behaltenGrund: behalten ? getComputedStyle(behalten).backgroundColor : null,
    spurOben: spur ? Math.round(spur.scrollTop) : null,
  };
}`;

interface Lage {
  da: boolean;
  oben?: number;
  unten?: number;
  links?: number;
  rechts?: number;
  hoehe?: number;
  fensterHoehe?: number;
  fensterBreite?: number;
  obenauf?: boolean;
  dialog?: boolean;
  fokus?: string | null;
  jaFarbe?: string | null;
  jaGrund?: string | null;
  behaltenFarbe?: string | null;
  behaltenGrund?: string | null;
  spurOben: number | null;
}

const lage = (id: string): Promise<Lage> => seite().evaluate<Lage>(fn(LAGE_FN), id);

const papierkorb = (id: string): string =>
  `[data-testid="bib-zeile-loeschen"][data-bib-id="${id}"]`;
const inRueckfrage = (id: string, wort: string): string =>
  `[data-testid="bib-zeile-loeschen-rueckfrage"][data-bib-id="${id}"] button:has-text("${wort}")`;

// Die Abfragen in der Seite — als Konstanten, damit jeder Fall genau dieselbe Frage stellt.
const KORB_DA_FN = `(id) => [...document.querySelectorAll('[data-testid="bib-zeile-loeschen"]')]
  .some((e) => e.getAttribute('data-bib-id') === id)`;
const FRAGE_DA_FN = `(id) => [...document.querySelectorAll('[data-testid="bib-zeile-loeschen-rueckfrage"]')]
  .some((e) => e.getAttribute('data-bib-id') === id)`;
const FRAGE_WEG_FN = `() => document.querySelector('[data-testid="bib-zeile-loeschen-rueckfrage"]') === null`;
const FRAGEN_ANZAHL_FN = `() => document.querySelectorAll('[data-testid="bib-zeile-loeschen-rueckfrage"]').length`;
const ZEILE_WEG_FN = `(id) => ![...document.querySelectorAll('[data-testid="bib-zeile"]')]
  .some((e) => e.getAttribute('data-bib-id') === id)`;
const LESETITEL_FN = `() => {
  const t = document.querySelector('[data-testid="bib-titel"]');
  return t ? t.textContent.trim() : null;
}`;
const MELDUNGEN_FN = `() => [...document.querySelectorAll('output')]
  .map((o) => (o.textContent || '').trim())`;
const KOERBE_FN = `() => {
  const k = [...document.querySelectorAll('[data-testid="bib-zeile-loeschen"]')];
  return {
    anzahl: k.length,
    mitSymbol: k.filter((b) => b.querySelector('svg') !== null).length,
    namen: k.map((b) => b.getAttribute('aria-label') || ''),
  };
}`;

interface Koerbe {
  anzahl: number;
  mitSymbol: number;
  namen: string[];
}

const leseTitel = (): Promise<string | null> => seite().evaluate<string | null>(fn(LESETITEL_FN));

describe("R-0959 · Papierkorb am Treffer — gebaute Seite, echtes Backend", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", EMAIL, async ({ services, autorId }) => {
        const a = (await services.ko.create({
          title: TITEL_A,
          statement: "Reisekostenbelege gehen binnen 14 Tagen an die Buchhaltung.",
          type: "best_practice",
          category: "Kaufmännisch",
          author: autorId,
        } as never)) as { id: string };
        const b = (await services.ko.create({
          title: TITEL_B,
          statement: "Bewirtungsbelege tragen Anlass und Teilnehmende.",
          type: "best_practice",
          category: "Kaufmännisch",
          author: autorId,
        } as never)) as { id: string };
        idA = a.id;
        idB = b.id;
      });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("Z1 · jeder Treffer trägt einen Papierkorb mit Namen; der Klick öffnet die ruhige Zeile im Blick, ohne Dialog", async () => {
    expect(fehler).toBeNull();
    await seite().goto(`${ORIGIN}/bibliothek`, { waitUntil: "domcontentloaded" });
    await warteAuf(KORB_DA_FN, "kein Papierkorb am Treffer", idB);
    const zeilen = await liste();
    expect(zeilen).toContain(idA);
    expect(zeilen).toContain(idB);
    // Der Prüfstand-Nutzer ist Admin und Autor — jeder Treffer trägt also einen Papierkorb, und
    // jeder ist ein echtes Symbol mit Namen (kein sichtbarer Text, also muss er benannt sein).
    const koerbe = await seite().evaluate<Koerbe>(fn(KOERBE_FN));
    expect(koerbe.anzahl).toBe(zeilen.length);
    expect(koerbe.mitSymbol).toBe(zeilen.length);
    expect(koerbe.namen).toContain(`„${TITEL_B}“ löschen`);

    const leseTitelVorher = await leseTitel();
    const vorher = await lage(idB);

    await seite().click(papierkorb(idB));
    await warteAuf(FRAGE_DA_FN, "die ruhige Zeile kam nicht", idB);
    const l = await lage(idB);
    console.info(`R-0959 · Z1 Lage: ${JSON.stringify(l)}`);
    expect(l.da).toBe(true);
    expect(l.oben ?? -1).toBeGreaterThanOrEqual(0);
    expect(l.unten ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(l.fensterHoehe ?? 0);
    expect(l.links ?? -1).toBeGreaterThanOrEqual(0);
    expect(l.rechts ?? Number.MAX_SAFE_INTEGER).toBeLessThanOrEqual(l.fensterBreite ?? 0);
    expect(l.hoehe ?? 0).toBeGreaterThan(10);
    expect(l.obenauf).toBe(true);
    // RUHIG: keine Dialogfläche, die Liste ist nicht weggerollt, der gelesene Bericht bleibt.
    expect(l.dialog).toBe(false);
    expect(l.spurOben).toBe(vorher.spurOben);
    expect(await leseTitel()).toBe(leseTitelVorher);
    // Der Fokus steht auf dem BEWAHRENDEN Knopf.
    expect(l.fokus).toBe(de("ko.deleteKeep"));
    // Die Warnfarbe trägt der bestätigende Knopf, nicht „Behalten" — gerechnet, nicht gelesen.
    expect(l.jaFarbe).not.toBeNull();
    expect(`${l.jaFarbe}/${l.jaGrund}`).not.toBe(`${l.behaltenFarbe}/${l.behaltenGrund}`);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 90_000);

  it("Z2 · „Behalten“ lässt alles stehen — am Server und in der Liste", async () => {
    expect(fehler).toBeNull();
    const vorher = await liste();
    await seite().click(inRueckfrage(idB, de("ko.deleteKeep")));
    await warteAuf(FRAGE_WEG_FN, "die ruhige Zeile blieb nach „Behalten“ stehen");
    expect(await liste()).toEqual(vorher);
    expect(await amServer(idB)).toBe(200);
  }, 90_000);

  it("Z3 · zwei Löschungen hintereinander aus der Trefferliste — beide am Server weg, ohne Neuladen", async () => {
    expect(fehler).toBeNull();

    await seite().click(papierkorb(idA));
    await seite().click(inRueckfrage(idA, de("ko.deleteYes")));
    await warteAuf(ZEILE_WEG_FN, "Wegwerf A verschwand nicht aus der Liste", idA);
    expect(await amServer(idA)).toBe(404);
    const meldungen = await seite().evaluate<string[]>(fn(MELDUNGEN_FN));
    expect(meldungen.some((m) => m.includes(de("ko.deleteDone")))).toBe(true);
    expect(await seite().evaluate<number>(fn(FRAGEN_ANZAHL_FN))).toBe(0);

    // DAS ZWEITE, direkt danach.
    await seite().click(papierkorb(idB));
    const l = await lage(idB);
    expect(l.da, "beim ZWEITEN Löschen kommt die ruhige Zeile nicht").toBe(true);
    await seite().click(inRueckfrage(idB, de("ko.deleteYes")));
    await warteAuf(ZEILE_WEG_FN, "Wegwerf B verschwand nicht aus der Liste", idB);
    expect(await amServer(idB)).toBe(404);
    const danach = await liste();
    expect(danach).not.toContain(idA);
    expect(danach).not.toContain(idB);
    // Die beiden Einträge des Prüfstands bleiben — gelöscht wurde genau, was bestätigt war.
    expect(danach.length).toBeGreaterThanOrEqual(2);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 120_000);
});
