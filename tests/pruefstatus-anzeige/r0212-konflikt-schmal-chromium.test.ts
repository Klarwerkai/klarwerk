// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0212) · DER WIDERSPRUCH HÄLT AUF DEM SCHMALEN BILDSCHIRM — ECHTES CHROMIUM.
// ================================================================================================
//
// Ben (Nacharbeit 1): `r0212-konflikt-schmal.test.tsx` belegt den Komponentenweg in jsdom mit
// einer matchMedia-Attrappe, misst aber weder Layout noch Überlagerung. Diese Gegenprobe öffnet die
// GEBAUTE Bibliothek (`apps/web/dist`, Vorrichtung `tests/design/h4-harness.ts`) bei 390 px:
//   · Bestand über die echten Dienste: ein freigegebener Eintrag bekommt einen echten
//     Wahrheitswiderspruch — dieselben zwei Schritte wie der Produkt-Dispatcher
//     (`ko-routes.ts`, action `conflict`: `conflicts.create` + `markTruthConflictReview`).
//   · Liste: die konfliktbehaftete Zeile trägt „Konflikt“ samt kritischem Punkt, die konfliktfreie
//     Zeile nicht — und beides ist TATSÄCHLICH sichtbar (Ausdehnung > 0, im Fenster, nicht
//     verdeckt: `elementFromPoint` in der Mitte trifft das Element selbst).
//   · Detail: der Bericht trägt die Fläche allein, die Pille sagt „Konflikt“ und ist sichtbar.
//   · Rückweg: führt zur Liste zurück; die Konfliktzeile ist danach weiter gekennzeichnet.
//
// SCHWERER TEST: braucht `./tools/build` (dist) und Chromium (Playwright). Ausführung durch den
// Prüfserver; auf dem Produktions-Mac nicht starten.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import { type H4Stand, ORIGIN, TITEL_FREI, fn, h4Stand } from "../design/h4-harness";

/** Ist ein Element mit dieser Marke im DOM? */
const DA = `(sel) => !!document.querySelector(sel)`;

const KONFLIKT = (): string => i18n.t("status.konflikt", { lng: "de" }) as string;

interface Sicht {
  da: boolean;
  breite: number;
  hoehe: number;
  imFenster: boolean;
  unverdeckt: boolean;
  text: string;
}

/** In der Seite: Sichtbarkeit eines Elements — Ausdehnung, Fensterlage, keine Überlagerung. */
const SICHT = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) { return { da: false, breite: 0, hoehe: 0, imFenster: false, unverdeckt: false, text: '' }; }
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const oben = document.elementFromPoint(cx, cy);
  return {
    da: true,
    breite: Math.round(r.width),
    hoehe: Math.round(r.height),
    imFenster: r.left >= 0 && r.right <= window.innerWidth && r.top >= 0 && r.bottom <= window.innerHeight
      && st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0,
    unverdeckt: !!oben && (oben === el || el.contains(oben)),
    text: (el.textContent || '').trim(),
  };
}`;

let stand: H4Stand | null = null;
let fehler: string | null = null;

function zeileSel(id: string, teil: string): string {
  return `[data-testid="bib-zeile"][data-bib-id="${id}"] ${teil}`;
}

async function sicht(sel: string): Promise<Sicht> {
  const s = stand as H4Stand;
  const m = await s.seite.evaluate<Sicht>(fn(SICHT), sel);
  console.info(`R-0212 Chromium · ${sel}: ${JSON.stringify(m)}`);
  return m;
}

function sichtbar(m: Sicht): void {
  expect(m.da, "Element fehlt").toBe(true);
  expect(m.breite).toBeGreaterThan(0);
  expect(m.hoehe).toBeGreaterThan(0);
  expect(m.imFenster, "nicht vollständig im 390-px-Fenster").toBe(true);
  expect(m.unverdeckt, "von einem anderen Element überlagert").toBe(true);
}

describe("R-0212 · Konflikt bei 390 px in der gebauten Bibliothek (Chromium)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", "pedi@r0212-schmal.test", async (z) => {
        // Derselbe Weg wie der Dispatcher: Konflikt anlegen, beide Seiten zurück in Review.
        await z.services.conflicts.create(
          { koA: z.freiId, koB: z.offenId, type: "truth", description: "Widerspruch R-0212" },
          z.autorId,
        );
        await z.services.ko.markTruthConflictReview(z.freiId, z.autorId);
        await z.services.ko.markTruthConflictReview(z.offenId, z.autorId);
        // Ein konfliktfreier Eintrag als Kontrolle in derselben Liste.
        await z.services.ko.create({
          title: "R-0212 konfliktfreie Kontrolle",
          statement: "Ein Eintrag ohne Widerspruch.",
          type: "best_practice",
          category: "Produktion",
          author: z.autorId,
        } as never);
      });
      await stand.seite.setViewportSize({ width: 390, height: 844 });
      await stand.seite.goto(`${ORIGIN}/bibliothek`, { waitUntil: "load" });
      await stand.seite.waitForFunction(
        fn(`() => document.querySelectorAll('[data-testid="bib-zeile"]').length >= 3`),
        undefined,
        { timeout: 30_000 },
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("K1 · Liste: Konfliktzeile sichtbar als „Konflikt“ mit kritischem Punkt", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(await s.seite.evaluate<number>(fn("() => window.innerWidth"))).toBe(390);
    const meta = await sicht(zeileSel(s.koId, '[data-bib-text="zeile-meta"]'));
    sichtbar(meta);
    expect(meta.text).toContain(KONFLIKT());
    const punkt = await sicht(zeileSel(s.koId, '[data-testid="bib-punkt"]'));
    sichtbar(punkt);
    const kritisch = await s.seite.evaluate<boolean>(
      fn(`(sel) => (document.querySelector(sel)?.className || '').includes('bg-trust-crit-fill')`),
      zeileSel(s.koId, '[data-testid="bib-punkt"]'),
    );
    expect(kritisch).toBe(true);
  }, 60_000);

  it("K2 · Kontrolle: die konfliktfreie Zeile trägt kein „Konflikt“", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    const id = await s.seite.evaluate<string | null>(
      fn(`() => {
        const z = [...document.querySelectorAll('[data-testid="bib-zeile"]')]
          .find((e) => (e.textContent || '').includes('R-0212 konfliktfreie Kontrolle'));
        return z ? z.getAttribute('data-bib-id') : null;
      }`),
    );
    expect(id).not.toBeNull();
    const meta = await sicht(zeileSel(String(id), '[data-bib-text="zeile-meta"]'));
    sichtbar(meta);
    expect(meta.text).not.toContain(KONFLIKT());
  }, 60_000);

  it("K3 · Detail allein auf der Fläche, Pille sichtbar „Konflikt“", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(
      await s.seite.evaluate<boolean>(
        fn(`(id) => {
          const el = document.querySelector('[data-testid="bib-zeile"][data-bib-id="' + id + '"]');
          if (!el) { return false; }
          el.click();
          return true;
        }`),
        s.koId,
      ),
    ).toBe(true);
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-zurueck"]')`),
      undefined,
      { timeout: 30_000 },
    );
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-pille"]')`),
      undefined,
      { timeout: 30_000 },
    );
    expect(await s.seite.evaluate<boolean>(fn(DA), '[data-testid="bib-liste"]')).toBe(false);
    const titel = await sicht('[data-testid="bib-titel"]');
    expect(titel.text).toBe(TITEL_FREI);
    const pille = await sicht('[data-testid="bib-pille"]');
    sichtbar(pille);
    expect(pille.text).toBe(KONFLIKT());
    sichtbar(await sicht('[data-testid="bib-zurueck"]'));
  }, 60_000);

  it("K4 · Rückweg: zurück zur Liste, die Konfliktzeile bleibt gekennzeichnet", async () => {
    expect(fehler).toBeNull();
    const s = stand as H4Stand;
    expect(
      await s.seite.evaluate<boolean>(
        fn(`() => {
          const el = document.querySelector('[data-testid="bib-zurueck"]');
          if (!el) { return false; }
          el.click();
          return true;
        }`),
      ),
    ).toBe(true);
    await s.seite.waitForFunction(
      fn(`() => !!document.querySelector('[data-testid="bib-liste"]')`),
      undefined,
      { timeout: 30_000 },
    );
    expect(await s.seite.evaluate<boolean>(fn(DA), '[data-testid="bib-lesen"]')).toBe(false);
    const meta = await sicht(zeileSel(s.koId, '[data-bib-text="zeile-meta"]'));
    sichtbar(meta);
    expect(meta.text).toContain(KONFLIKT());
    // Auch die Gegenseite des Widerspruchs (der zweite Bestandseintrag) ist gekennzeichnet.
    const gegen = await sicht(zeileSel(s.koOffenId, '[data-bib-text="zeile-meta"]'));
    expect(gegen.text).toContain(KONFLIKT());
    const ueberlauf = await s.seite.evaluate<number>(
      fn("() => document.documentElement.scrollWidth - window.innerWidth"),
    );
    expect(ueberlauf).toBeLessThanOrEqual(0);
  }, 60_000);

  it("K5 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  });
});
