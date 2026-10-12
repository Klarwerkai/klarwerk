// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-1026) — DER TITEL UNTER DER ANTWORT, AM TELEFON.
// ================================================================================================
//
// „Auf dem Telefon bleiben die Titel der Quellen unter einer Antwort lesbar." Die Klassenprüfung
// daneben (`quellentitel-brechen-um.test.ts`) sieht nur den Quelltext; sie erkennt keine
// Abschneidung durch das umgebende Layout. HIER läuft die echte Kette an der GEBAUTEN Seite:
// Telefonfläche `/mobile` → Reiter „Fragen" → echte Frage an die echte App → Antwort mit dem
// Quellenverweis, dessen Titel ein langer Dateiname OHNE Umbruchstelle ist. Gemessen bei 390 und
// 320 px: der ganze Titel steht im DOM UND im Bild — innerhalb der Breite, nicht in sich
// abgeschnitten (scrollWidth ≤ clientWidth), über mehrere Zeilen umgebrochen, ohne Zeilenkappung,
// und die Seite läuft nicht seitlich über.
//
// Vorrichtung: `h4-harness` (gebautes dist, echte App, Chromium). Der zitierte Eintrag wird über
// die echten Dienste angelegt und über denselben Weg wie die Oberfläche freigegeben.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, ORIGIN, fn, h4Stand } from "../design/h4-harness";

const EMAIL = "telefon@r1026.test";
/** Ein langer Dateiname ohne jede Umbruchstelle — der härteste Fall für eine schmale Zeile. */
const TITEL_LANG =
  "Wartungsanweisung_Kuehlmittelpumpe_Zeta17_Revision_2026_Endfassung_Werk_Nord_Linie_3_freigegeben.docx";
const AUSSAGE = "Die Kühlmittelpumpe Zeta-17 wird jeden Monat entlüftet.";
const FRAGE = "Wie oft wird die Kühlmittelpumpe Zeta-17 entlüftet?";

let stand: H4Stand | null = null;
let fehler: string | null = null;

interface Befund {
  text: string;
  links: number;
  rechts: number;
  breite: number;
  scrollW: number;
  clientW: number;
  hoehe: number;
  zeile: number;
  clamp: string;
  ellipse: string;
  ueberlauf: number;
}

const MESSEN = `(titel) => {
  const a = [...document.querySelectorAll('a[title]')].find((x) => x.getAttribute('title') === titel);
  if (!a) { return null; }
  const r = a.getBoundingClientRect();
  const cs = getComputedStyle(a);
  return {
    text: (a.textContent || '').trim(),
    links: r.left,
    rechts: r.right,
    breite: window.innerWidth,
    scrollW: a.scrollWidth,
    clientW: a.clientWidth,
    hoehe: r.height,
    zeile: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2,
    clamp: cs.webkitLineClamp || 'none',
    ellipse: cs.textOverflow,
    ueberlauf: document.documentElement.scrollWidth - window.innerWidth,
  };
}`;

async function fragenBei(breite: number, hoehe: number): Promise<Befund> {
  const s = stand as H4Stand;
  await s.seite.setViewportSize({ width: breite, height: hoehe });
  await s.seite.goto(`${ORIGIN}/mobile`, { waitUntil: "load" });
  // Reiter „Fragen" der Telefonfläche. `/mobile` läuft OHNE App-Hülle (`App.tsx`, „/mobile OHNE
  // Shell") — es gibt dort kein `<main>`; gesucht wird deshalb im Dokument, das nur diese Fläche
  // trägt. (Nacharbeit 5 suchte in `main` und lief deshalb in die Frist, ohne die Fläche zu sehen.)
  await s.seite.waitForFunction(
    fn(
      `() => [...document.querySelectorAll('button')].some((b) => (b.textContent || '').trim() === 'Fragen')`,
    ),
    undefined,
    { timeout: 30_000 },
  );
  await s.seite.evaluate(
    fn(
      `() => [...document.querySelectorAll('button')].find((b) => (b.textContent || '').trim() === 'Fragen').click()`,
    ),
  );
  await s.seite.waitForFunction(fn(`() => !!document.querySelector('form input')`), undefined, {
    timeout: 30_000,
  });
  await s.seite.evaluate(
    fn(`(frage) => {
      const input = document.querySelector('form input');
      const setzen = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setzen.call(input, frage);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }`),
    FRAGE,
  );
  await s.seite.waitForFunction(
    fn(
      `() => { const b = document.querySelector('form button[type="submit"]'); return !!b && !b.disabled; }`,
    ),
    undefined,
    { timeout: 30_000 },
  );
  await s.seite.evaluate(fn(`() => document.querySelector('form button[type="submit"]').click()`));
  await s.seite.waitForFunction(
    fn(
      `(titel) => [...document.querySelectorAll('a[title]')].some((x) => x.getAttribute('title') === titel)`,
    ),
    TITEL_LANG,
    { timeout: 45_000 },
  );
  await s.seite.waitForTimeout(400);
  const m = await s.seite.evaluate<Befund | null>(fn(MESSEN), TITEL_LANG);
  console.info(`R-1026 · ${breite}x${hoehe}: ${JSON.stringify(m)}`);
  expect(m, "kein Quellenverweis mit dem langen Titel unter der Antwort").not.toBeNull();
  return m as Befund;
}

function lesbar(m: Befund): void {
  // Der GANZE Titel steht da — nicht gekürzt, nicht durch eine Kennung ersetzt.
  expect(m.text).toBe(TITEL_LANG);
  // Im Bild und innerhalb der Breite.
  expect(m.links).toBeGreaterThanOrEqual(0);
  expect(m.rechts).toBeLessThanOrEqual(m.breite + 0.5);
  // Nicht in sich abgeschnitten: der Inhalt passt in seine Box.
  expect(m.scrollW).toBeLessThanOrEqual(m.clientW + 1);
  // Umgebrochen statt gekappt: mehr als eine Zeile, keine Zeilenkappung, keine Auslassungspunkte.
  expect(m.hoehe).toBeGreaterThan(m.zeile * 1.5);
  expect(m.clamp).toBe("none");
  expect(m.ellipse).not.toBe("ellipsis");
  // Die Seite läuft nicht seitlich über.
  expect(m.ueberlauf).toBeLessThanOrEqual(0);
}

describe("R-1026 · Quellentitel unter der Antwort auf der Telefon-Fragefläche (Chromium, gebaute Seite)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", EMAIL, async ({ services, app, autorId }) => {
        const ko = (await services.ko.create({
          title: TITEL_LANG,
          statement: AUSSAGE,
          bodyHtml: `<p>${AUSSAGE}</p>`,
          type: "best_practice",
          category: "Instandhaltung",
          author: autorId,
          neededValidations: 1,
        } as never)) as { id: string };
        // Freigabe über denselben Weg wie die Oberfläche (`PUT /api/kos/:id`, action rate).
        const login = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { email: EMAIL, password: "geheim12345" },
        });
        const token = (login.json() as { token: string }).token;
        const freigabe = await app.inject({
          method: "PUT",
          url: `/api/kos/${ko.id}`,
          headers: { authorization: `Bearer ${token}` },
          payload: { action: "rate", verdict: "up" },
        });
        if (freigabe.statusCode >= 400) {
          throw new Error(`Freigabe ${freigabe.statusCode} ${freigabe.body.slice(0, 200)}`);
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

  it("T1 · 390 px: der lange Titel steht ganz, umgebrochen und innerhalb der Breite unter der Antwort", async () => {
    expect(fehler).toBeNull();
    lesbar(await fragenBei(390, 844));
  }, 120_000);

  it("T2 · 320 px: dasselbe an der schmalsten Stelle", async () => {
    expect(fehler).toBeNull();
    lesbar(await fragenBei(320, 568));
  }, 120_000);

  it("T3 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
