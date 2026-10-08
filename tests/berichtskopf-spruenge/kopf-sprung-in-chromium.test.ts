// ================================================================================================
// JOB 3108 · UX-03 — DER SPRUNG AN DER ECHTEN, GEBAUTEN SEITE. MIT MAUS UND NUR MIT TASTATUR.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN DER GEMOUNTETEN STEHT (Auftrag §8.1): „Der Zweck ist verfehlt, wenn A
// grün ist und B rot: dann ist nur der Nachbau repariert." Gemessen wird deshalb hier dasselbe
// Versprechen an `apps/web/dist` in Chromium, gegen die echte Fastify-App — dieselbe Vorrichtung
// wie JOB 3063 H4 (`tests/design/h4-harness.ts`, unverändert).
//
// DER BEFUND, VON DER ANDEREN SEITE GEMESSEN (Codex N-0003/N-0021: 7.876,8 px Fließtext über der
// Zeile „Mehr"): B1 misst nicht die Textmenge, sondern ihre Folge — ohne EINEN Rollvorgang ist die
// Sprungzeile im Sichtfeld und `bib-mehr` nicht. Am Stand vor diesem Auftrag ist B1 rot, weil es
// die Sprungzeile nicht gibt.
//
// DER LANGE TEXT WIRD HERGESTELLT, NICHT VORAUSGESETZT: `h4Stand` legt den freigegebenen Eintrag
// mit zwei Absätzen an. Zwei Absätze schöben `bib-mehr` nicht aus dem Bild, und B1 wäre dann eine
// Aussage über eine Lage, die es gar nicht gibt. Der Haken `vorbereiten` überarbeitet den Eintrag
// deshalb über den ECHTEN Dienst (`services.ko.revise`) auf sechzig Abschnitte.
//
// DIE TASTATUR WIRD WIRKLICH BEDIENT (B3). `page.keyboard` gehört zum echten Playwright-Objekt;
// die schlanke `Seite`-Schnittstelle der Vorrichtung nennt es nur nicht. Es wird hier lokal
// nachtypisiert — `h4-harness.ts` bleibt unangetastet. Ein `dispatchEvent('keydown')` aus
// `evaluate` wäre KEINE Tastaturmessung: der Browser führt daraus keine Vorgabehandlung aus.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DIST, type H4Stand, ORIGIN, type Seite, fn, h4Stand } from "../design/h4-harness";

/** Sechzig Abschnitte — der Fall aus dem Auftrag („ein Bericht mit sechzig Abschnitten"). */
const LANGER_TEXT = Array.from(
  { length: 60 },
  (_, i) =>
    `<h2>Abschnitt ${i + 1}</h2><p>Reinigung, Prüfung und Freigabe im Abschnitt ${i + 1}. Offene, ablaufende Profile sind zu bevorzugen, damit Flüssigkeit nicht stehen bleibt.</p>`,
).join("");

/** N-0037: die externe Originalquelle des Berichts (die Adresse wird nie geladen, s. B5). */
const EXTERN_TITEL = "DIN EN 1672-2 Hygieneanforderungen";
const EXTERN_URL = "https://normen.example.org/din-en-1672-2.pdf";

/** Playwright kann mehr, als die schlanke Schnittstelle der Vorrichtung nennt. */
interface Tastatur {
  press(taste: string): Promise<void>;
}
const tastatur = (s: Seite): Tastatur => (s as unknown as { keyboard: Tastatur }).keyboard;

/** In der Seite: Lage und Zustand in EINEM Zug — sonst stammten die Aussagen aus zwei Ständen. */
const MESSEN = `() => {
  const lage = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, hoehe: r.height };
  };
  const aktiv = document.activeElement;
  const quellen = document.querySelector('[data-bib-abschnitt="quellen"]');
  return {
    fenster: window.innerHeight,
    sprungQuellen: lage('[data-testid="bib-sprung-quellen"]'),
    sprungAnhaenge: lage('[data-testid="bib-sprung-anhaenge"]'),
    mehr: lage('[data-testid="bib-mehr"]'),
    titel: lage('[data-testid="bib-titel"]'),
    textHoehe: lage('[data-testid="bib-text"]') ? lage('[data-testid="bib-text"]').hoehe : 0,
    quellenDa: !!quellen,
    quellenOffen: !!(quellen && quellen.open),
    quellenLage: lage('[data-bib-abschnitt="quellen"]'),
    aktivTag: aktiv ? aktiv.tagName : '(keins)',
    aktivTestId: aktiv ? (aktiv.getAttribute('data-testid') || '') : '',
    aktivImQuellen: !!(quellen && aktiv && quellen.contains(aktiv)),
    sprungText: document.querySelector('[data-testid="bib-kopf-spruenge"]')
      ? document.querySelector('[data-testid="bib-kopf-spruenge"]').innerText.replace(/\\s+/g, ' ').trim()
      : '(keine Sprungzeile)',
  };
}`;

interface Lage {
  top: number;
  bottom: number;
  hoehe: number;
}
interface Messung {
  fenster: number;
  sprungQuellen: Lage | null;
  sprungAnhaenge: Lage | null;
  mehr: Lage | null;
  titel: Lage | null;
  textHoehe: number;
  quellenDa: boolean;
  quellenOffen: boolean;
  quellenLage: Lage | null;
  aktivTag: string;
  aktivTestId: string;
  aktivImQuellen: boolean;
  sprungText: string;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;

const messen = async (): Promise<Messung> =>
  (await (stand as H4Stand).seite.evaluate<Messung>(fn(MESSEN))) as Messung;

/** Die Seite von vorn laden — so beginnt jeder Fall mit zugeklapptem „Mehr" und ohne Fokus. */
async function frisch(): Promise<void> {
  const s = (stand as H4Stand).seite;
  await s.goto(`${ORIGIN}/wissen/${(stand as H4Stand).koId}`, {
    waitUntil: "load",
    timeout: 60_000,
  });
  await s.waitForFunction(
    fn(`() => !!document.querySelector('[data-testid="bib-sprung-quellen"]')`),
    undefined,
    { timeout: 30_000 },
  );
}

describe("JOB 3108 · UX-03 — Quellen und Anhänge sind vom Kopf aus erreichbar (Chromium)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@job3108.test", async (z) => {
        // Über den ECHTEN Dienst, nicht über einen Sonderweg: derselbe Aufruf, den die Route
        // `PUT /api/kos/:id` mit `action: "revise"` fährt (`ko-routes.ts:1754`).
        // Aufnahme 20260922 · N-0037 (Ben zu 8e6c9d73): der Bericht trägt zusätzlich eine EXTERNE
        // Originalquelle — die Gegenprüfung vom 06.09. hatte einen leeren Quellenbereich und konnte
        // genau dieses Verhalten nicht prüfen. Die bestehende Dokumentquelle bleibt erhalten.
        const vorher = (await z.services.ko.get(z.freiId)) as unknown as { sources: unknown[] };
        await z.services.ko.revise(
          z.freiId,
          {
            bodyHtml: LANGER_TEXT,
            sources: [
              ...(vorher.sources as never[]),
              {
                id: "n0037-extern-1",
                label: EXTERN_TITEL,
                url: EXTERN_URL,
                excerpt: null,
                kind: "external",
                peerValidated: false,
                author: z.autorId,
                at: new Date().toISOString(),
              } as never,
            ],
          },
          z.autorId,
        );
      });
      await stand.seite.waitForFunction(
        fn(`() => !!document.querySelector('[data-testid="bib-sprung-quellen"]')`),
        undefined,
        { timeout: 30_000 },
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 5).join(" | ");
    }
  }, 240_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("B0 · die Vorrichtung steht: gebautes dist, echte App, Chromium — und der Text ist lang", async () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).version.length).toBeGreaterThan(0);
    const m = await messen();
    console.info(`JOB 3108 B0 · ${JSON.stringify(m)}`);
    // Ohne diese Kalibrierung misst B1 eine Lage, die es gar nicht gibt.
    expect(m.textHoehe, "der Fließtext ist nicht lang genug für den Befund").toBeGreaterThan(3000);
  }, 90_000);

  it("B1 · ohne EINEN Rollvorgang: die Sprungzeile ist im Bild, „Mehr“ ist es nicht", async () => {
    expect(fehler).toBeNull();
    const m = await messen();
    expect(m.sprungQuellen, "die Sprungzeile fehlt").not.toBeNull();
    const sprung = m.sprungQuellen as Lage;
    expect(sprung.top, `Sprungknopf top=${sprung.top}, Fenster=${m.fenster}`).toBeLessThan(
      m.fenster,
    );
    expect(sprung.bottom, "der Sprungknopf liegt über dem Bild").toBeGreaterThan(0);
    // Und der alte Weg liegt weiterhin unten — das IST der Befund N-0003/N-0021.
    expect(m.mehr, "die Zeile „Mehr“ fehlt").not.toBeNull();
    expect(
      (m.mehr as Lage).top,
      `„Mehr“ top=${(m.mehr as Lage).top}, Fenster=${m.fenster} — dann misst B1 nichts`,
    ).toBeGreaterThan(m.fenster);
  }, 90_000);

  it("B2 · ein Klick öffnet „Quellen und Belege“ und bringt den Abschnitt ins Bild", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const s = (stand as H4Stand).seite;
    expect((await messen()).quellenDa, "vor dem Klick ist „Mehr“ zugeklappt").toBe(false);
    await s.evaluate(
      fn(`() => document.querySelector('[data-testid="bib-sprung-quellen"]').click()`),
    );
    await s.waitForFunction(
      fn(
        `() => { const d = document.querySelector('[data-bib-abschnitt="quellen"]'); return !!d && d.open; }`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 3108 B2 · ${JSON.stringify(m)}`);
    expect(m.quellenOffen).toBe(true);
    const lage = m.quellenLage as Lage;
    expect(lage.top, `Abschnitt top=${lage.top}, Fenster=${m.fenster}`).toBeLessThan(m.fenster);
    expect(lage.bottom, "der Abschnitt liegt über dem Bild").toBeGreaterThan(0);
    // Der Fokus steht IM Zielabschnitt — das Vorleseprogramm liest dort weiter, nicht oben.
    expect(m.aktivTag).toBe("SUMMARY");
    expect(m.aktivImQuellen).toBe(true);
  }, 90_000);

  it("B3 · NUR TASTATUR: vom Knopf „Fragen“ aus mit Tab erreichbar, Enter öffnet denselben Zustand", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const s = (stand as H4Stand).seite;
    // Der Startpunkt: der Knopf „Fragen“ in der Kopfzeile. Ab hier wird NUR getippt.
    await s.evaluate(fn(`() => document.querySelector('[data-testid="bib-fragen"]').focus()`));
    let schritte = 0;
    let erreicht = false;
    for (let i = 0; i < 10 && !erreicht; i++) {
      await tastatur(s).press("Tab");
      schritte = i + 1;
      erreicht = await s.evaluate<boolean>(
        fn(
          `() => document.activeElement === document.querySelector('[data-testid="bib-sprung-quellen"]')`,
        ),
      );
    }
    expect(erreicht, "der Sprungknopf war in 10 Tabulatorschritten nicht erreichbar").toBe(true);
    console.info(`JOB 3108 B3 · Sprungknopf nach ${schritte} Tabulatorschritten erreicht`);
    await tastatur(s).press("Enter");
    await s.waitForFunction(
      fn(
        `() => { const d = document.querySelector('[data-bib-abschnitt="quellen"]'); return !!d && d.open; }`,
      ),
      undefined,
      { timeout: 20_000 },
    );
    const m = await messen();
    console.info(`JOB 3108 B3 · ${JSON.stringify(m)}`);
    expect(m.quellenOffen).toBe(true);
    expect(m.aktivTag).toBe("SUMMARY");
    expect(m.aktivImQuellen).toBe(true);
    const lage = m.quellenLage as Lage;
    expect(lage.top).toBeLessThan(m.fenster);
    expect(lage.bottom).toBeGreaterThan(0);
  }, 90_000);

  // ==============================================================================================
  // Aufnahme 20260922 · N-0037 — DAS VERHALTEN DER EXTERNEN ORIGINALQUELLE (Ben zu 8e6c9d73).
  // ==============================================================================================
  // Die Gegenprüfung vom 06.09. (QUELLEN.json, N-0037): „Quellenbereich aktuell leer, daher keine
  // externe Originalquelle geprüft." Gemessen wird hier genau dieser Rest am langen Bericht: vom
  // Kopfsprung aus steht die externe Quelle mit Titel und vollständiger Adresse im Bild, ihr Link
  // führt auf GENAU die gespeicherte Adresse, öffnet in einem NEUEN Tab und gibt keine Herkunft
  // weiter. Der echte Zeigerklick erreicht den Link; sein Öffnen wird abgefangen — die fremde
  // Adresse wird in diesem Lauf NIE geladen (kein Netz, keine fremde Seite).
  it("B5 · N-0037: vom Kopfsprung aus ist die externe Originalquelle erreichbar und öffnet ihre Adresse in einem neuen Tab", async () => {
    expect(fehler).toBeNull();
    await frisch();
    const s = (stand as H4Stand).seite;
    const sprungText = (await messen()).sprungText;
    console.info(`N-0037 B5 · Sprungzeile: ${sprungText}`);
    await s.click('[data-testid="bib-sprung-quellen"]');
    const LINK = `[data-bib-abschnitt="quellen"] a[href="${EXTERN_URL}"]`;
    await s.waitForFunction(fn("(sel) => !!document.querySelector(sel)"), LINK, {
      timeout: 20_000,
    });
    const link = await s.evaluate<{
      text: string;
      target: string | null;
      rel: string | null;
      zeile: string;
      imBild: boolean;
    }>(
      fn(`(sel) => {
        const a = document.querySelector(sel);
        const r = a.getBoundingClientRect();
        const zeile = a.closest('li');
        return {
          text: (a.textContent || '').trim(),
          target: a.getAttribute('target'),
          rel: a.getAttribute('rel'),
          zeile: zeile ? zeile.innerText.replace(/\\s+/g, ' ').trim() : '',
          imBild: r.bottom > 0 && r.top < window.innerHeight,
        };
      }`),
      LINK,
    );
    console.info(`N-0037 B5 · ${JSON.stringify(link)}`);
    expect(link.zeile).toContain(EXTERN_TITEL);
    expect(link.text).toBe(EXTERN_URL);
    expect(link.target).toBe("_blank");
    expect(link.rel ?? "").toMatch(/noreferrer|noopener/);
    // Der echte Klick: erreicht er den Link, und mit welchem Ziel? Das Öffnen wird abgefangen.
    await s.evaluate(
      fn(`() => {
        window.__n0037 = null;
        document.addEventListener('click', (e) => {
          const a = e.target && e.target.closest ? e.target.closest('a') : null;
          if (!a) return;
          e.preventDefault();
          window.__n0037 = { href: a.href, target: a.getAttribute('target') };
        }, { capture: true, once: true });
      }`),
    );
    await s.click(LINK);
    const geklickt = await s.evaluate<{ href: string; target: string | null } | null>(
      fn("() => window.__n0037"),
    );
    expect(geklickt).toEqual({ href: EXTERN_URL, target: "_blank" });
  }, 90_000);

  it("B4 · Chromium meldete keinen Seitenfehler", () => {
    expect(fehler).toBeNull();
    expect((stand as H4Stand).seitenfehler).toEqual([]);
  });
});

describe.runIf(!existsSync(join(DIST, "index.html")))(
  "JOB 3108 · Chromium-Fall übersprungen",
  () => {
    it("meldet das fehlende dist, statt eine Prüfung vorzutäuschen", () => {
      expect(existsSync(join(DIST, "index.html")), `dist fehlt: ${DIST}`).toBe(false);
    });
  },
);
