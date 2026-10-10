// ================================================================================================
// N-0084 / R-0885 — DIE GEÄNDERTEN LÜCKENFLÄCHEN IM ECHTEN BROWSER GEMESSEN.
// ================================================================================================
//
// BEN (Nacharbeit 3): die gemounteten jsdom-Tests prüfen die STRUKTUR (Etikett nicht im kürzenden
// Titel, `shrink-0`), aber jsdom kennt weder Breiten noch Abschneiden. Gemessen wird deshalb die
// GEBAUTE Anwendung (`apps/web/dist`) in Chromium gegen die echte App — dieselbe Bühne wie
// `tests/review26-aufgaben-schmal/aufgaben-schmal-chromium.test.ts` (`tests/design/h6-chromium.ts`).
//
//   C1 · R-0885: auf „Risiko & Lücken" bei 711 px (die Breite der Design-Lead-Abnahme vom 15.08.)
//        und 1280 px: das Sprach-Etikett „Englisch" und die Häufigkeit „2× gefragt" stehen
//        vollständig sichtbar in der Zeile; gekürzt wird der Titel davor (Kalibrierung: der lange
//        Titel IST bei 711 px abgeschnitten — sonst wäre die Zusage trivial).
//   C2 · N-0084: `/erfassen?gap=<id>` zeigt bei 390 px die Ausgangsfrage vollständig ÜBER dem
//        Titelfeld des Blatts, ohne seitlich abgeschnitten zu sein.
//
// Bestand über die echten Routen (`POST /api/ask` ohne Treffer → Lücke), keine eingespielten Daten.
// Was das NICHT ersetzt: eine menschliche Sichtung des Gesamteindrucks.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";

const KONTO = { email: "pedi@job3065.test", password: "geheim12345" } as const;
const LANGE_ENGLISCHE_FRAGE =
  "Are countersunk screws allowed in food contact zones and splash zones of the filling lines in hall seven?";
const AUSGANGSFRAGE =
  "Wie lange muss die Pumpe an Linie Zeta nach dem Anfahren entlüftet werden, bevor sie Last bekommt?";

interface Kasten {
  links: number;
  rechts: number;
  oben: number;
  unten: number;
}

interface Zeilenmessung {
  fehler: string | null;
  viewport: number;
  zeile: Kasten;
  titelKlient: number;
  titelScroll: number;
  etikettText: string;
  etikett: Kasten;
  etikettKlient: number;
  etikettScroll: number;
  haeufigkeitText: string;
  haeufigkeit: Kasten;
}

const ZEILE_MESSEN = `((frage) => {
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom }; };
  const zeile = [...document.querySelectorAll('[data-testid="luecke-zeile"]')].find((z) => (z.textContent || '').includes(frage.slice(0, 30)));
  if (!zeile) return { fehler: 'Zeile fehlt', viewport: window.innerWidth };
  const etikett = zeile.querySelector('[data-testid="luecke-etikett"]');
  const haeufigkeit = zeile.querySelector('[data-testid="luecke-haeufigkeit"]');
  const titel = [...zeile.querySelectorAll('.truncate')].find((t) => (t.textContent || '').includes(frage.slice(0, 30)));
  if (!etikett || !haeufigkeit || !titel) return { fehler: 'Etikett, Häufigkeit oder Titel fehlt', viewport: window.innerWidth };
  return {
    fehler: null,
    viewport: window.innerWidth,
    zeile: kasten(zeile),
    titelKlient: titel.clientWidth,
    titelScroll: titel.scrollWidth,
    etikettText: (etikett.textContent || '').trim(),
    etikett: kasten(etikett),
    etikettKlient: etikett.clientWidth,
    etikettScroll: etikett.scrollWidth,
    haeufigkeitText: (haeufigkeit.textContent || '').trim(),
    haeufigkeit: kasten(haeufigkeit),
  };
})`;

interface Blattmessung {
  fehler: string | null;
  viewport: number;
  text: string;
  frage: Kasten;
  frageKlient: number;
  frageScroll: number;
  titelfeld: Kasten;
}

const BLATT_MESSEN = `(() => {
  const kasten = (el) => { const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, oben: r.top, unten: r.bottom }; };
  const frage = document.querySelector('[data-testid="blatt-ausgangsfrage"]');
  const titelfeld = document.querySelector('[data-testid="blatt-titel"]');
  if (!frage || !titelfeld) return { fehler: 'Ausgangsfrage oder Titelfeld fehlt', viewport: window.innerWidth };
  return {
    fehler: null,
    viewport: window.innerWidth,
    text: (frage.textContent || '').replace(/\\s+/g, ' ').trim(),
    frage: kasten(frage),
    frageKlient: frage.clientWidth,
    frageScroll: frage.scrollWidth,
    titelfeld: kasten(titelfeld),
  };
})`;

let stand: Stand;
let ausgangsLueckeId = "";

function seite(): Seite {
  if (stand.seite === null || stand.fehler !== null) {
    throw new Error(`Bühne steht nicht: ${stand.fehler ?? "unbekannt"}`);
  }
  return stand.seite;
}

function innerhalb(innen: Kasten, aussen: Kasten): boolean {
  return (
    innen.links >= aussen.links - 0.5 &&
    innen.rechts <= aussen.rechts + 0.5 &&
    innen.oben >= aussen.oben - 0.5 &&
    innen.unten <= aussen.unten + 0.5
  );
}

describe("N-0084 / R-0885 · die Lückenflächen in Chromium", () => {
  beforeAll(async () => {
    stand = await starte("/risiko", '[data-testid="luecke-zeile"]', 711, 900, async (app) => {
      const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: KONTO });
      const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
      await app.inject({ method: "POST", url: "/api/auth/notice", headers });
      // Zweimal dieselbe englische Frage → EINE Lücke mit locale „en" und askCount 2.
      for (const question of [LANGE_ENGLISCHE_FRAGE, LANGE_ENGLISCHE_FRAGE]) {
        const res = await app.inject({
          method: "POST",
          url: "/api/ask",
          headers,
          payload: { question, locale: "en" },
        });
        expect(res.statusCode, res.body).toBe(200);
      }
      const res = await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: { question: AUSGANGSFRAGE, locale: "de" },
      });
      expect(res.statusCode, res.body).toBe(200);
      const liste = await app.inject({ method: "GET", url: "/api/gaps", headers });
      const gaps = liste.json() as { id: string; question: string }[];
      ausgangsLueckeId = gaps.find((g) => g.question.startsWith("Wie lange muss"))?.id ?? "";
    });
  }, 180_000);

  afterAll(async () => {
    await beende(stand);
  }, 60_000);

  it("C1 · R-0885: Etikett und Häufigkeit bleiben bei 711 px und 1280 px ganz sichtbar, der Titel kürzt davor", async () => {
    for (const breite of [711, 1280]) {
      await seite().setViewportSize({ width: breite, height: 900 });
      const m = await seite().evaluate<Zeilenmessung>(fn(ZEILE_MESSEN), LANGE_ENGLISCHE_FRAGE);
      expect(m.fehler, `Messung bei ${breite} px`).toBeNull();
      expect(m.viewport).toBe(breite);
      expect(m.etikettText).toBe("Englisch");
      expect(m.haeufigkeitText).toBe("2× gefragt");
      const bei = `${breite} px`;
      expect(m.etikettScroll, `Etikett gekürzt, ${bei}`).toBeLessThanOrEqual(m.etikettKlient);
      expect(innerhalb(m.etikett, m.zeile), `Etikett außerhalb der Zeile, ${bei}`).toBe(true);
      const fensterRand = breite + 0.5;
      expect(m.etikett.rechts, `Etikett außerhalb, ${bei}`).toBeLessThanOrEqual(fensterRand);
      expect(innerhalb(m.haeufigkeit, m.zeile), `Häufigkeit abgeschnitten, ${bei}`).toBe(true);
      if (breite === 711) {
        // KALIBRIERUNG: der lange Titel IST hier gekürzt — die Zusage oben ist nicht trivial.
        expect(m.titelScroll, "Titel bei 711 px nicht gekürzt").toBeGreaterThan(m.titelKlient);
      }
    }
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
  }, 60_000);

  it("C2 · N-0084: die Ausgangsfrage steht bei 390 px ganz über dem Titelfeld des Blatts", async () => {
    expect(ausgangsLueckeId, "KALIBRIERUNG: die Lücke ist angelegt").not.toBe("");
    await seite().setViewportSize({ width: 390, height: 800 });
    await wechsle(
      stand,
      `/erfassen?gap=${encodeURIComponent(ausgangsLueckeId)}`,
      '[data-testid="blatt-ausgangsfrage"]',
    );
    expect(stand.fehler, "die Erfassung mit Lückenbezug lädt nicht").toBeNull();
    const m = await seite().evaluate<Blattmessung>(fn(BLATT_MESSEN));
    expect(m.fehler).toBeNull();
    expect(m.viewport).toBe(390);
    expect(m.text).toContain(AUSGANGSFRAGE);
    const titelOben = m.titelfeld.oben + 0.5;
    expect(m.frage.unten, "Frage nicht über dem Titelfeld").toBeLessThanOrEqual(titelOben);
    expect(m.frage.links).toBeGreaterThanOrEqual(0);
    expect(m.frage.rechts, "Frage ragt aus dem Fenster").toBeLessThanOrEqual(390.5);
    expect(m.frageScroll, "Frage seitlich abgeschnitten").toBeLessThanOrEqual(m.frageKlient);
    expect(stand.seitenfehler, "die Seite hat selbst Fehler geworfen").toEqual([]);
  }, 60_000);
});
