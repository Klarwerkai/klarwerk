// ================================================================================================
// R-1581 · 390 PIXEL, GEMESSEN — Nutzer-/Rollentitel und Verwaltungs-Kurzlinks im echten Chromium.
// ================================================================================================
//
// BENs Befund (Nacharbeit 5): `umbruch-statt-kuerzung.test.tsx` belegt nur den Klassenvertrag und
// den vollständigen DOM-Text — jsdom rechnet kein Layout. Ob ein langer Name bei 390 px wirklich
// umbricht statt abgeschnitten zu werden, sieht man erst an den Textrechtecken eines echten
// Browsers. Diese Datei misst genau das am GEBAUTEN Produkt (`tests/design/h6-chromium.ts`: echte
// App hinter der Weiche, echter Bestand, Chromium mit 390 × 844):
//
//   P1  Kontenfläche: die Nutzerzeile mit sehr langem Namen — vollständig in der Karte, nicht gekürzt.
//   P2  Nutzerkarte: der Titel (= dieser lange Name) bricht um, bleibt in der Karte und überdeckt
//       weder „Zurück" noch das „?".
//   P3  Rollenkarte: der Titel bleibt in der Karte und überdeckt nichts.
//   P4  Kurzlinks unter „Berichte und Analyse" (Stufe 2 an): jede Beschriftung vollständig, der
//       Pfeil sichtbar und nicht über dem Text.
//   P5  Kein Fall erzeugt eine waagrechte Überbreite der Seite.
//
// Der jsdom-Test bleibt als ergänzender Beleg des Klassenvertrags bestehen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";

const LANGER_NAME = "Maximiliane Wilhelmine Kunigunde von Hohenzollern-Sigmaringen-Bergheim";
const t = (k: string): string => i18n.t(k);

/** Eine Textmessung in der Seite — die Grundlage jeder Aussage dieser Datei. */
interface Messung {
  fehler: string | null;
  text?: string;
  /** Zahl der Textzeilen (verschiedene Oberkanten der Textrechtecke). */
  zeilen?: number;
  /** Textrechtecke außerhalb der Karte oder des Fensters. */
  ausserhalb?: number;
  /** Mehr Inhalt als sichtbare Breite (abgeschnitten). */
  ueberlauf?: boolean;
  /** `text-overflow: ellipsis` am Träger. */
  auslassung?: boolean;
  /** Fläche, die der Träger mit einem der genannten Nachbarn teilt (px²). */
  ueberdeckung?: number;
  /** Die Seite ist breiter als das Fenster. */
  seiteUeberbreit?: boolean;
}

/**
 * In der Seite: den Träger `sel` messen; `nachbarn` sind Selektoren, mit denen er sich keine Fläche
 * teilen darf. Gemessen wird an den Textrechtecken (`Range.getClientRects`), nicht an der Box —
 * eine Box kann in der Karte liegen, während ihr Text darüber hinausläuft.
 */
const MISS = `(([sel, nachbarn]) => {
  const el = document.querySelector(sel);
  if (!el) return { fehler: 'Träger fehlt: ' + sel };
  const karte = el.closest('[data-einst="detail"], [data-einst="karte"]');
  const kr = karte ? karte.getBoundingClientRect() : { left: 0, right: window.innerWidth };
  const bereich = document.createRange();
  bereich.selectNodeContents(el);
  const stuecke = [...bereich.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
  const ausserhalb = stuecke.filter((r) =>
    r.left < kr.left - 0.5 || r.right > kr.right + 0.5 || r.right > window.innerWidth + 0.5,
  ).length;
  const box = el.getBoundingClientRect();
  let ueberdeckung = 0;
  for (const n of nachbarn) {
    const m = document.querySelector(n);
    if (!m) continue;
    const b = m.getBoundingClientRect();
    const w = Math.min(box.right, b.right) - Math.max(box.left, b.left);
    const h = Math.min(box.bottom, b.bottom) - Math.max(box.top, b.top);
    if (w > 0.5 && h > 0.5) ueberdeckung += w * h;
  }
  const stil = getComputedStyle(el);
  return {
    fehler: null,
    text: (el.textContent || '').replace(/\\s+/g, ' ').trim(),
    zeilen: new Set(stuecke.map((r) => Math.round(r.top))).size,
    ausserhalb,
    ueberlauf: el.scrollWidth > el.clientWidth + 1,
    auslassung: stil.textOverflow === 'ellipsis',
    ueberdeckung,
    seiteUeberbreit: document.documentElement.scrollWidth > window.innerWidth + 1,
  };
})`;

/** In der Seite: eine Zeile anklicken und warten, bis der Behälter steht. */
const OEFFNE = `(async ([zeile, behaelter]) => {
  const warte = async (p, ms = 15000) => {
    const bis = Date.now() + ms;
    while (Date.now() < bis) { if (p()) return true; await new Promise((r) => setTimeout(r, 50)); }
    return p();
  };
  const z = typeof zeile === 'string' ? document.querySelector(zeile) : null;
  if (!z) return 'Zeile fehlt: ' + zeile;
  z.click();
  return (await warte(() => document.querySelector('[data-testid="' + behaelter + '"]') !== null))
    ? null
    : 'Karte ging nicht auf: ' + behaelter;
})`;

let stand: Stand | null = null;

function seite(): NonNullable<Stand["seite"]> {
  const s = stand as Stand;
  expect(s.fehler, `Prüfstand nicht bereit: ${s.fehler}`).toBeNull();
  return s.seite as NonNullable<Stand["seite"]>;
}

async function miss(sel: string, nachbarn: string[] = []): Promise<Messung> {
  return seite().evaluate<Messung>(fn(MISS), [sel, nachbarn]);
}

/** Die gemeinsame Aussage „vollständig lesbar": nichts außerhalb, nichts gekürzt, nichts verdeckt. */
function vollstaendig(m: Messung, was: string): void {
  expect(m.fehler, `${was}: ${m.fehler}`).toBeNull();
  expect(m.ausserhalb, `${was}: Textteile außerhalb der Karte`).toBe(0);
  expect(m.ueberlauf, `${was}: Inhalt breiter als sichtbar (abgeschnitten)`).toBe(false);
  expect(m.auslassung, `${was}: mit Auslassungspunkten gekürzt`).toBe(false);
  expect(m.ueberdeckung, `${was}: überdeckt ein Bedienelement`).toBe(0);
  expect(m.seiteUeberbreit, `${was}: die Seite ist breiter als 390 px`).toBe(false);
}

describe("R-1581 · Lesbarkeit bei 390 px im echten Chromium", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("de");
    stand = await starte("/admin", '[data-einst="seite"]', 390, 844, async (app) => {
      // Ein Konto mit sehr langem Namen — über die ECHTE Anlage-Route, angemeldet als der Admin
      // dieses Prüfstands (die Ersteinrichtung in `starte` legt „Pedi" an).
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3065.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const anlage = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          name: LANGER_NAME,
          email: "lang@r1581.test",
          password: "lang-geheim-1",
          role: "experte",
        },
      });
      if (anlage.statusCode >= 300) {
        throw new Error(`Anlage des langen Kontos: HTTP ${anlage.statusCode} ${anlage.body}`);
      }
    });
  }, 180_000);

  afterAll(async () => {
    if (stand) {
      await beende(stand);
    }
  }, 60_000);

  it("P1 · Kontenfläche: die Zeile mit dem langen Namen steht vollständig in der Karte", async () => {
    // ADMIN-01: `/admin` ist die Startseite der Verwaltung; die Kontenfläche hat ihre eigene Adresse.
    await wechsle(stand as Stand, "/admin?bereich=konten", '[data-testid="flaeche-nutzer"]');
    await seite().waitForFunction(
      fn(
        `(n) => [...document.querySelectorAll('[data-testid="flaeche-nutzer"] [data-einst="label"]')].some((l) => (l.textContent || '').includes(n))`,
      ),
      LANGER_NAME,
      { timeout: 30_000 },
    );
    // Den Träger eindeutig adressieren: die Beschriftung, deren Text der lange Name ist.
    await seite().evaluate(
      fn(`(n) => {
        const l = [...document.querySelectorAll('[data-testid="flaeche-nutzer"] [data-einst="label"]')]
          .find((x) => (x.textContent || '').includes(n));
        if (l) l.setAttribute('data-messung', 'lange-zeile');
      }`),
      LANGER_NAME,
    );
    const m = await miss('[data-messung="lange-zeile"]');
    vollstaendig(m, "Nutzerzeile");
    expect(m.text).toBe(LANGER_NAME);
    expect(m.zeilen, "der lange Name bricht in der Zeile um").toBeGreaterThan(1);
  }, 120_000);

  it("P2 · Nutzerkarte: der Titel bricht um, bleibt in der Karte und überdeckt nichts", async () => {
    const fehler = await seite().evaluate<string | null>(fn(OEFFNE), [
      '[data-messung="lange-zeile"]',
      "detail-nutzer",
    ]);
    expect(fehler).toBeNull();
    const m = await miss('[data-testid="detail-nutzer"] [data-einst="detailtitel"]', [
      '[data-testid="detail-nutzer"] [data-einst="zurueck"]',
      '[data-testid="detail-nutzer"] [data-einst="hilfe"]',
    ]);
    vollstaendig(m, "Titel der Nutzerkarte");
    expect(m.text).toBe(LANGER_NAME);
    expect(m.zeilen, "der Titel bricht um statt abgeschnitten zu werden").toBeGreaterThan(1);
  }, 120_000);

  it("P3 · Rollenkarte: der Titel bleibt in der Karte und überdeckt nichts", async () => {
    await wechsle(stand as Stand, "/admin?bereich=konten", '[data-testid="zeile-rolle-experte"]');
    const fehler = await seite().evaluate<string | null>(fn(OEFFNE), [
      '[data-testid="zeile-rolle-experte"]',
      "detail-rolle",
    ]);
    expect(fehler).toBeNull();
    const m = await miss('[data-testid="detail-rolle"] [data-einst="detailtitel"]', [
      '[data-testid="detail-rolle"] [data-einst="zurueck"]',
      '[data-testid="detail-rolle"] [data-einst="hilfe"]',
    ]);
    vollstaendig(m, "Titel der Rollenkarte");
    expect(m.text).toBe(t("role.name.experte"));
  }, 120_000);

  it("P4 · Kurzlinks unter „Berichte und Analyse“: Beschriftung vollständig, Pfeil frei", async () => {
    // Stufe 2 an (der Schalter wohnt im localStorage, `lib/stufe2Storage.ts`) — sonst stünden hier
    // keine Kurzlinks, sondern „Modul aus".
    await seite().evaluate(fn(`() => localStorage.setItem("kw.stufe2.v1", "1")`));
    await wechsle(stand as Stand, "/admin?bereich=berichte", '[data-einst="kurzlink"]');
    const anzahl = await seite().evaluate<number>(
      fn(`() => {
        const links = [...document.querySelectorAll('[data-einst="kurzlink"]')].map((p) => p.closest('a'));
        links.forEach((a, i) => {
          if (!a) return;
          const l = a.querySelector('[data-einst="label"]');
          if (l) l.setAttribute('data-messung', 'kurzlink-' + i);
          a.querySelector('[data-einst="kurzlink"]').setAttribute('data-messung', 'pfeil-' + i);
        });
        return links.length;
      }`),
    );
    expect(anzahl, "keine Kurzlinks auf „Berichte und Analyse“").toBeGreaterThanOrEqual(4);
    for (let i = 0; i < anzahl; i++) {
      const m = await miss(`[data-messung="kurzlink-${i}"]`, [`[data-messung="pfeil-${i}"]`]);
      vollstaendig(m, `Kurzlink ${i} („${m.text ?? "?"}“)`);
      const pfeil = await miss(`[data-messung="pfeil-${i}"]`);
      expect(pfeil.fehler, `Pfeil ${i}: ${pfeil.fehler}`).toBeNull();
    }
  }, 120_000);

  it("P5 · die Seite hat dabei keinen Fehler geworfen (pageerror)", () => {
    expect(stand?.seitenfehler).toEqual([]);
  });
});
