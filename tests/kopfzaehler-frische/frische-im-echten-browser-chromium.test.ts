// ================================================================================================
// AUFNAHME 20260922 · GESAMT-AUFGABENANSICHT · R-1558 / P-H1b — DIE FRIST AM GEBAUTEN PRODUKT.
// ================================================================================================
//
// Bens Befund (Runde 1): `kopfzaehler-frische-mounted.test.tsx` misst mit gemockten Endpunkten und
// Testuhr in jsdom; der englische Fall endete nach dem Ausblenden, eine Tastaturabnahme fehlte, die
// Herkunftszeiten der einzelnen Zählquellen waren nicht erfasst, und der ungefilterte Nullbestand
// war nur als „unbelegt" benannt.
//
// DIESE DATEI MISST DAS GEBAUTE BÜNDEL (`apps/web/dist`) in Chromium gegen die ECHTE Fastify-App
// (`tests/design/h1-chromium.ts`: echte Dienste, echter Bestand, echte Anmeldung). Die Instanz ist
// je Sprache FRISCH und LEER — das ist der isolierte Board-Scope, den R-1558 für den Normalweg
// verlangt; es wird nichts global zurückgesetzt, weil nichts Geteiltes da ist.
//
// DIE UHR: `page.clock` (Playwright) ersetzt `Date`, `setTimeout` & Co. IN DER SEITE. Nur so sind
// „35 s ohne Abruf" eine Messung und keine Wartezeit. Die Anfragen der Seite werden über einen
// `fetch`-Mitschnitt mit SEITENZEIT festgehalten — das sind die Herkunftszeiten je Zählquelle.
//
// Je Sprache (DE, EN), am selben Bestand:
//   N   frische leere Instanz: alle fünf Zählquellen antworten, das Board ist leer → KEINE Zahl,
//       der Punkt „Prüfen" steht (echter ungefilterter Nullbestand, kein Filter, kein Reset);
//   A   zwei offene Einträge, frischer Abruf → Zahl im Kopfband und in „Weitere Bereiche"
//       (per Tastatur geöffnet); 35 s ohne JEDEN Abruf einer Zählquelle → beide Zahlen weg;
//       Tastaturweg auf „Prüfen" löst den Neuabruf aus → richtige neue Zahl im Kopfband; Tastaturweg
//       zurück auf „Start" → auch „Weitere Bereiche" trägt die richtige Zahl wieder;
//   B   schmal (390 px): derselbe Ablauf im Drawer — Zahl, 35 s → weg, Tastaturweg → wieder da.
//
// „OHNE ABRUF" (BEN, Lauf 3 R1, B2): gemessen an den gestarteten Anfragen je Zählquelle
// (`__anfragen`), nicht an den erfolgreichen Antworten — ein gescheiterter oder noch laufender
// Abruf zählt mit. Der Mitschnitt und seine Rechnung stehen in `abrufmitschnitt.ts` und sind in
// `abrufmitschnitt-kalibrierung.test.ts` gegen genau diese Gegenfälle kalibriert.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Seite, type Strecke, fn, oeffne, strecke, warteBis } from "../design/h1-chromium";
import {
  type Abruf,
  type Anfrage,
  MITSCHNITT,
  ZAEHLQUELLEN,
  anfragenJeQuelle,
  herkunft,
} from "./abrufmitschnitt";

type Uhrseite = Seite & {
  clock: { install(o?: { time?: number }): Promise<void>; fastForward(ms: number): Promise<void> };
  focus(selector: string): Promise<void>;
};

const FRIST_UEBERSCHRITTEN_MS = 35_000;

const KOPF_ZAHL = 'header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler';
const KOPF_PUNKT = 'header a[data-kopfband-punkt="validierung"]';
const BEREICH_ZAHL = '[data-testid="bereich-aufgaben"] .kw-menue-wert';
const DRAWER_ZAHL = '[data-testid="drawer-punkt-validierung"] .kw-menue-wert';
const DRAWER_PUNKT = '[data-testid="drawer-punkt-validierung"]';

async function abrufe(seite: Seite): Promise<Abruf[]> {
  return seite.evaluate<Abruf[]>(fn("() => window.__abrufe || []"));
}

/** Gestartete Anfragen je Zählquelle — einschließlich gescheiterter und noch laufender. */
async function anfragen(seite: Seite): Promise<Record<string, number>> {
  return anfragenJeQuelle(await seite.evaluate<Anfrage[]>(fn("() => window.__anfragen || []")));
}

async function text(seite: Seite, selektor: string): Promise<string | null> {
  return seite.evaluate<string | null>(
    fn(
      "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').trim() : null; }",
    ),
    selektor,
  );
}

async function allesGeholt(seite: Seite, quellen: readonly string[] = ZAEHLQUELLEN): Promise<void> {
  await warteBis(
    seite,
    "(quellen) => quellen.every((q) => (window.__abrufe || []).some((a) => a.pfad === q && a.status === 200))",
    quellen,
  );
}

async function tastatur(seite: Uhrseite, selektor: string): Promise<void> {
  await seite.focus(selektor);
  await seite.keyboard.press("Enter");
}

// FE-002: die weiteren Bereiche stehen seit dem 26.09.2026 unter dem beschrifteten Einstieg
// „Arbeitsbereiche" im Kopfband (`shell/ArbeitsbereicheMenue.tsx`), nicht mehr hinter dem Zahnrad.
// Die Liste ist dieselbe (`WeitereBereicheZeilen`), also auch derselbe Zählerort `bereich-aufgaben`.
async function weitereBereicheMitTastatur(seite: Uhrseite): Promise<void> {
  await tastatur(seite, '[data-testid="kopfband-arbeitsbereiche"]');
  await warteBis(
    seite,
    `() => document.querySelector('[data-testid="bereich-aufgaben"]') !== null`,
  );
}

async function eintragAnlegen(s: Strecke, titel: string): Promise<void> {
  await s.services.ko.create({
    title: titel,
    statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
    type: "best_practice",
    category: "Allgemein",
    author: s.autorId,
  } as never);
}

async function boardZahl(s: Strecke): Promise<number> {
  const res = await s.app.inject({
    method: "GET",
    url: "/api/validation/board",
    headers: { authorization: `Bearer ${s.token}` },
  });
  return (res.json() as unknown[]).length;
}

for (const sprache of ["de", "en"] as const) {
  describe(`R-1558 · P-H1b · die Frist des Kopfzählers am gebauten Produkt (${sprache})`, () => {
    let s: Strecke | undefined;
    let fehler: string | null = null;
    const seite = (): Uhrseite => {
      if (!s) {
        throw new Error(`Strecke steht nicht: ${fehler ?? "unbekannt"}`);
      }
      return s.seite as Uhrseite;
    };

    beforeAll(async () => {
      try {
        s = await strecke({ email: `frist-${sprache}@aufnahme-20260922.test` });
        const sp = s.seite as Uhrseite;
        await sp.addInitScript(
          `try { localStorage.setItem("kw.sprache", "${sprache}"); } catch (e) {}`,
        );
        await sp.addInitScript(MITSCHNITT);
        await sp.clock.install();
      } catch (e) {
        fehler = String(e).split("\n").slice(0, 3).join(" | ");
      }
    }, 120_000);

    afterAll(async () => {
      await s?.schliessen();
    }, 60_000);

    it("N · frische leere Instanz: alle Zählquellen antworten, das Board ist leer — keine Zahl, der Punkt steht", async () => {
      expect(fehler).toBeNull();
      const sp = seite();
      expect(await boardZahl(s as Strecke), "die Instanz beginnt wirklich leer").toBe(0);
      await oeffne(sp, "/start");
      await allesGeholt(sp);
      expect(await text(sp, KOPF_ZAHL)).toBeNull();
      expect(await text(sp, KOPF_PUNKT)).not.toBeNull();
      const lage = herkunft(await abrufe(sp));
      console.info(`R-1558 ${sprache} · N · Herkunft je Zählquelle: ${JSON.stringify(lage)}`);
      for (const quelle of ZAEHLQUELLEN) {
        expect(lage[quelle]?.anzahl, `${quelle} hat nicht geantwortet`).toBeGreaterThan(0);
      }
    }, 90_000);

    it("A · Zahl → 35 s ohne Abruf → weg in Kopfband und „Weitere Bereiche“ → Tastaturweg → richtige Zahl wieder da", async () => {
      expect(fehler).toBeNull();
      const sp = seite();
      await eintragAnlegen(s as Strecke, "Halterungen ohne waagerechte Oberseiten");
      await eintragAnlegen(s as Strecke, "Profile: Ablaufbohrung 8 mm");
      const zwei = await boardZahl(s as Strecke);
      expect(zwei).toBe(2);

      // (1) Frischer Abruf: die Zahl steht im Kopfband und in „Weitere Bereiche" (per Tastatur).
      await oeffne(sp, "/start");
      await allesGeholt(sp);
      await warteBis(
        sp,
        `(sel) => { const z = document.querySelector(sel); return z !== null && z.textContent.trim() === "2"; }`,
        KOPF_ZAHL,
      );
      await weitereBereicheMitTastatur(sp);
      expect(await text(sp, BEREICH_ZAHL)).toBe("2");
      const vorher = herkunft(await abrufe(sp));
      const gestartetVorher = await anfragen(sp);
      console.info(`R-1558 ${sprache} · A1 · Herkunft je Zählquelle: ${JSON.stringify(vorher)}`);

      // (2) 35 s Seitenzeit — ohne jeden Abruf einer Zählquelle.
      await sp.clock.fastForward(FRIST_UEBERSCHRITTEN_MS);
      await warteBis(sp, "(sel) => document.querySelector(sel) === null", KOPF_ZAHL);
      const danach = herkunft(await abrufe(sp));
      const gestartetDanach = await anfragen(sp);
      console.info(
        `R-1558 ${sprache} · A2 · nach 35 s: ${JSON.stringify(danach)} · gestartet ${JSON.stringify(gestartetDanach)}`,
      );
      expect(
        gestartetDanach,
        "in den 35 s startete keine Zählquelle einen Abruf — auch keinen gescheiterten oder laufenden",
      ).toEqual(gestartetVorher);
      expect(danach, "und keine Zählquelle wurde neu bestätigt").toEqual(vorher);
      expect(await text(sp, KOPF_ZAHL)).toBeNull();
      expect(await text(sp, BEREICH_ZAHL)).toBeNull();
      // Der Punkt selbst steht unverändert — nur die Zahl ist weg, kein Ersatzzeichen.
      expect(await text(sp, KOPF_PUNKT)).not.toBeNull();
      expect(
        await sp.evaluate<number>(
          fn("() => document.querySelectorAll('.kw-kopfband-zaehler').length"),
        ),
      ).toBe(0);
      await sp.keyboard.press("Escape");

      // (3) Ein dritter Eintrag kommt dazu; der Tastaturweg auf „Prüfen" löst den Neuabruf aus.
      await eintragAnlegen(s as Strecke, "Dichtung: Nut 2 mm tiefer");
      expect(await boardZahl(s as Strecke)).toBe(3);
      await tastatur(sp, KOPF_PUNKT);
      await warteBis(sp, `() => location.pathname === "/validierung"`);
      await warteBis(
        sp,
        `(sel) => { const z = document.querySelector(sel); return z !== null && z.textContent.trim() === "3"; }`,
        KOPF_ZAHL,
      );

      // (4) Tastaturweg zurück auf „Start": die Aufgabenzahl in „Weitere Bereiche" ist wieder gedeckt.
      await tastatur(sp, 'header a[data-kopfband-punkt="start"]');
      await warteBis(sp, `() => location.pathname === "/start"`);
      await weitereBereicheMitTastatur(sp);
      await warteBis(
        sp,
        `(sel) => { const z = document.querySelector(sel); return z !== null && z.textContent.trim() === "3"; }`,
        BEREICH_ZAHL,
      );
      const zuletzt = herkunft(await abrufe(sp));
      console.info(`R-1558 ${sprache} · A4 · nach dem Tastaturweg: ${JSON.stringify(zuletzt)}`);
      for (const quelle of ZAEHLQUELLEN) {
        expect(
          zuletzt[quelle]?.zuletzt ?? 0,
          `${quelle} wurde nach dem Ablauf nicht neu bestätigt`,
        ).toBeGreaterThan(vorher[quelle]?.zuletzt ?? 0);
      }
      await sp.keyboard.press("Escape");
    }, 120_000);

    it("B · schmal (390 px): Zahl im Drawer → 35 s ohne Abruf → weg → Tastaturweg → wieder da", async () => {
      expect(fehler).toBeNull();
      const sp = seite();
      await sp.setViewportSize({ width: 390, height: 844 });
      const erwartet = String(await boardZahl(s as Strecke));
      await oeffne(sp, "/start");
      // Schmal holt die Seite `/api/duplicates` erst mit geöffnetem Drawer (dort steht „Dubletten");
      // die Drawer-Zahl an „Prüfen" hängt allein am Board — auf das wird hier gewartet.
      await allesGeholt(sp, ["/api/validation/board"]);
      const menue = `header button[aria-label="${sprache === "de" ? "Menü öffnen" : "Open menu"}"]`;
      await tastatur(sp, menue);
      await warteBis(
        sp,
        `(sel) => { const z = document.querySelector(sel); return z !== null && z.textContent.trim() === "${erwartet}"; }`,
        DRAWER_ZAHL,
      );
      const vorher = herkunft(await abrufe(sp));
      const gestartetVorher = await anfragen(sp);

      await sp.clock.fastForward(FRIST_UEBERSCHRITTEN_MS);
      await warteBis(sp, "(sel) => document.querySelector(sel) === null", DRAWER_ZAHL);
      expect(
        await anfragen(sp),
        "in den 35 s startete keine Zählquelle einen Abruf — auch keinen gescheiterten oder laufenden",
      ).toEqual(gestartetVorher);
      expect(herkunft(await abrufe(sp)), "und keine Zählquelle wurde neu bestätigt").toEqual(
        vorher,
      );
      expect(await text(sp, DRAWER_PUNKT)).not.toBeNull();

      // Der Drawer-Punkt „Prüfen" per Tastatur: Neuabruf, danach trägt der Drawer die Zahl wieder.
      await tastatur(sp, DRAWER_PUNKT);
      await warteBis(sp, `() => location.pathname === "/validierung"`);
      await tastatur(sp, menue);
      await warteBis(
        sp,
        `(sel) => { const z = document.querySelector(sel); return z !== null && z.textContent.trim() === "${erwartet}"; }`,
        DRAWER_ZAHL,
      );
      console.info(
        `R-1558 ${sprache} · B · Herkunft je Zählquelle: ${JSON.stringify(herkunft(await abrufe(sp)))}`,
      );
      await sp.keyboard.press("Escape");
      await sp.setViewportSize({ width: 1280, height: 800 });
    }, 120_000);
  });
}
