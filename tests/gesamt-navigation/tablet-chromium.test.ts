// ================================================================================================
// AUFNAHME 20260922 · GESAMT-NAVIGATION — MENÜ UND AKTIVER BEREICH AUF DEM TABLET, IM ECHTEN CHROMIUM.
// ================================================================================================
//
// Anforderungen dieses Auftrags, an der GEBAUTEN Oberfläche gemessen (`apps/web/dist`, echte App
// hinter der Weiche, angemeldeter Admin, ein echtes Wissensobjekt — `tests/design/h4-harness.ts`):
//
//   R-0892  „Menü und Bedienung funktionieren auch auf dem Tablet, nicht nur am Rechner. Ist eine
//           Wissensseite geöffnet, ist im Menü der Bibliothekseintrag als aktiv markiert."
//   R-1045  „Die Seitenleiste verbirgt nicht mehr, dass unten weitere Einträge stehen, und
//           Entwicklerschalter drücken ihr nicht die Höhe weg."
//   package:navigation  „Kein Menüpunkt verschwindet bei kleiner Breite."
//
// DIE FÄLLE:
//   T1  iPad hochkant (768 × 1024) auf `/wissen/:id`: der beschriftete Menü-Knopf öffnet den Drawer,
//       alle sechs Punkte der Hauptnavigation und „Offene Aufgaben" stehen darin, und GENAU der
//       Bibliothekseintrag trägt `aria-current="page"`.
//   T2  Derselbe Drawer ist länger als das Fenster: der Hinweis „Weitere Einträge unten" steht am
//       unteren Rand im Fenster; ganz nach unten gescrollt ist er fort und die letzte Zeile sichtbar;
//       zurück nach oben steht er wieder.
//   T3  Die Liste trägt die volle Höhe des Drawers — kein fester Block (Entwicklerschalter o. ä.)
//       steht neben ihr und nimmt ihr Höhe; der erste Punkt steht oben.
//   T4  iPad quer (1024 × 768), dieselbe Wissensseite: breite Punktreihe, Bibliothek aktiv; die
//       Übersicht „Arbeitsbereiche" zeigt den Hinweis genau dann, wenn sie wirklich überläuft.
//   T5  Erzwungen niedriges Fenster (1024 × 450): die Übersicht läuft über → Hinweis; am Ende fort.
//   P   Chromium hat keinen Seitenfehler gemeldet.
//
// EHRLICHE GRENZE: das ist Chromium mit Tablet-Massen, kein iPad. Touch-Gesten, Safari/WebKit und
// die Bedienung durch einen Menschen am Gerät misst diese Datei nicht.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type H4Stand, fn, h4Stand } from "../design/h4-harness";

const HOCHKANT = { width: 768, height: 1024 };
const QUER = { width: 1024, height: 768 };
const NIEDRIG = { width: 1024, height: 450 };

/** Die sechs Punkte der Hauptnavigation (`app/navigation.ts`, `KOPFBAND_IDS`). */
const PUNKTE = ["start", "fragen", "bibliothek", "erfassen", "entwuerfe", "validierung"];

let stand: H4Stand | null = null;
let fehler: string | null = null;

function s(): H4Stand {
  expect(fehler, `Prüfstand nicht bereit: ${fehler}`).toBeNull();
  return stand as H4Stand;
}

async function fenster(groesse: { width: number; height: number }): Promise<void> {
  await s().seite.setViewportSize(groesse);
  await s().seite.waitForTimeout(400);
}

/** Eine scrollende Liste und ihr Hinweis — alles, was T2/T4/T5 urteilen. */
interface Liste {
  da: boolean;
  scrollHoehe: number;
  sichtHoehe: number;
  scrollStand: number;
  hinweis: string | null;
  hinweisText: string;
  /** Unterkante des sichtbaren Hinweises gegen die Unterkante der Liste (px, 0 = bündig). */
  hinweisAbstandUnten: number | null;
  /** Liegt die letzte Zeile der Liste vollständig im sichtbaren Bereich? */
  letzteZeileSichtbar: boolean;
}

const LISTE = `([liste, hinweis]) => {
  const el = document.querySelector(liste);
  if (!el) { return { da: false, scrollHoehe: 0, sichtHoehe: 0, scrollStand: 0, hinweis: null, hinweisText: "", hinweisAbstandUnten: null, letzteZeileSichtbar: false }; }
  const h = el.querySelector('[data-testid="' + hinweis + '"]');
  const innen = h ? h.firstElementChild : null;
  const r = el.getBoundingClientRect();
  const zeilen = el.querySelectorAll('[role="menuitem"]');
  const letzte = zeilen.length > 0 ? zeilen[zeilen.length - 1].getBoundingClientRect() : null;
  return {
    da: true,
    scrollHoehe: el.scrollHeight,
    sichtHoehe: el.clientHeight,
    scrollStand: el.scrollTop,
    hinweis: h ? h.getAttribute("data-weiter-unten") : null,
    hinweisText: innen ? innen.innerText.trim() : "",
    hinweisAbstandUnten: innen ? Math.round(r.bottom - innen.getBoundingClientRect().bottom) : null,
    letzteZeileSichtbar: letzte !== null && letzte.bottom <= r.bottom + 1 && letzte.top >= r.top - 1,
  };
}`;

async function liste(selektor: string, hinweis: string): Promise<Liste> {
  const m = await s().seite.evaluate<Liste>(fn(LISTE), [selektor, hinweis]);
  console.info(`Gesamt-Navigation · ${selektor}: ${JSON.stringify(m)}`);
  return m;
}

async function scrolleListe(selektor: string, wohin: "ende" | "anfang"): Promise<void> {
  await s().seite.evaluate(
    fn(`([sel, wohin]) => {
      const el = document.querySelector(sel);
      if (el) { el.scrollTop = wohin === "ende" ? el.scrollHeight : 0; }
    }`),
    [selektor, wohin],
  );
  await s().seite.waitForTimeout(250);
}

async function warteAuf(selektor: string): Promise<void> {
  await s().seite.waitForFunction(fn("(sel) => document.querySelector(sel) !== null"), selektor, {
    timeout: 15_000,
  });
}

const DRAWER = ".kw-drawer";
const ARBEITSBEREICHE = '[data-testid="arbeitsbereiche-menue"]';

describe("Gesamt-Navigation · Tablet: Menü, aktiver Bereich und „es geht unten weiter“", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/wissen/:frei", "pedi@gesamt-navigation.test");
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("T1 · 768 × 1024 auf einer Wissensseite: Menü öffnet alle Punkte, nur „Bibliothek“ ist aktiv", async () => {
    await fenster(HOCHKANT);
    const pfad = await s().seite.evaluate<string>(fn("() => location.pathname"));
    expect(pfad, "die Messung steht nicht auf einer Wissensseite").toMatch(/^\/wissen\/./);
    const knopf = await s().seite.evaluate<string>(
      fn(`() => document.querySelector('[data-testid="kopfband-menue"]')?.innerText.trim() ?? ""`),
    );
    expect(knopf, "auf dem Tablet hochkant fehlt der beschriftete Menü-Knopf").toBe("Menü");
    await s().seite.click('[data-testid="kopfband-menue"]');
    await warteAuf(DRAWER);
    const befund = await s().seite.evaluate<{
      punkte: string[];
      aktiv: string[];
      aufgaben: string;
    }>(
      fn(`() => ({
        punkte: [...document.querySelectorAll('${DRAWER} [data-testid^="drawer-punkt-"]')]
          .map((a) => a.getAttribute("data-testid").slice("drawer-punkt-".length)),
        aktiv: [...document.querySelectorAll('${DRAWER} [aria-current="page"]')]
          .map((a) => a.getAttribute("data-testid")),
        aufgaben: document.querySelector('${DRAWER} [data-testid="bereich-aufgaben"]')?.innerText.trim() ?? "",
      })`),
    );
    console.info(`Gesamt-Navigation · T1: ${JSON.stringify(befund)}`);
    expect(befund.punkte).toEqual(PUNKTE);
    const nurBibliothek = ["drawer-punkt-bibliothek"];
    expect(befund.aktiv, "Wissensseite: nicht genau „Bibliothek“ aktiv").toEqual(nurBibliothek);
    // `toContain`: rechts daneben darf der Zähler der offenen Arbeit stehen.
    expect(befund.aufgaben).toContain("Offene Aufgaben");
    expect(befund.aufgaben).not.toContain("Meine Aufgaben");
  }, 90_000);

  it("T2 · der Drawer zeigt, dass unten weitere Einträge stehen — und hört damit am Ende auf", async () => {
    const oben = await liste(DRAWER, "drawer-weiter-unten");
    expect(oben.da, "der Drawer ist nicht offen").toBe(true);
    // Voraussetzung, sonst sagte der Fall nichts: die Liste ist auf dem Tablet länger als das Fenster.
    expect(oben.scrollHoehe, "die Drawerliste passt ganz ins Fenster").toBeGreaterThan(
      oben.sichtHoehe + 4,
    );
    expect(oben.hinweis).toBe("ja");
    expect(oben.hinweisText).toContain("Weitere Einträge unten");
    expect(oben.hinweisAbstandUnten, "der Hinweis sitzt nicht am unteren Rand").not.toBeNull();
    // Bündig mit der Unterkante — höchstens um das Innenpolster des Drawers (16 px) darüber.
    expect(oben.hinweisAbstandUnten ?? 99).toBeGreaterThanOrEqual(-1);
    expect(oben.hinweisAbstandUnten ?? 99).toBeLessThanOrEqual(20);

    await scrolleListe(DRAWER, "ende");
    const unten = await liste(DRAWER, "drawer-weiter-unten");
    expect(unten.scrollStand).toBeGreaterThan(0);
    expect(unten.hinweis, "am Ende der Liste steht der Hinweis noch").toBe("nein");
    expect(unten.hinweisText).toBe("");
    expect(unten.letzteZeileSichtbar, "die letzte Zeile ist am Ende nicht sichtbar").toBe(true);

    await scrolleListe(DRAWER, "anfang");
    expect((await liste(DRAWER, "drawer-weiter-unten")).hinweis).toBe("ja");
  }, 90_000);

  it("T3 · die Liste trägt die volle Höhe des Drawers; nichts Festes nimmt ihr Platz", async () => {
    const m = await s().seite.evaluate<{
      dialog: number;
      liste: number;
      fremd: string[];
      ersterAbstand: number | null;
    }>(
      fn(`() => {
        const liste = document.querySelector('${DRAWER}');
        const dialog = liste ? liste.closest("dialog") : null;
        if (!liste || !dialog) { return { dialog: 0, liste: 0, fremd: ["kein Drawer"], ersterAbstand: null }; }
        const fremd = [...dialog.children]
          .filter((k) => k !== liste && getComputedStyle(k).position !== "absolute")
          .map((k) => k.tagName.toLowerCase() + (k.getAttribute("data-testid") ? "#" + k.getAttribute("data-testid") : ""));
        const erster = liste.querySelector('[data-testid="drawer-punkt-start"]');
        return {
          dialog: dialog.clientHeight,
          liste: liste.clientHeight,
          fremd,
          ersterAbstand: erster ? Math.round(erster.getBoundingClientRect().top - dialog.getBoundingClientRect().top) : null,
        };
      }`),
    );
    console.info(`Gesamt-Navigation · T3: ${JSON.stringify(m)}`);
    expect(m.fremd, "neben der Liste steht ein fester Block im Drawer").toEqual([]);
    expect(m.liste).toBeGreaterThanOrEqual(m.dialog - 1);
    expect(m.ersterAbstand, "„Start“ steht nicht oben im Drawer").not.toBeNull();
    expect(m.ersterAbstand ?? 999).toBeLessThan(140);
    await s().seite.keyboard.press("Escape");
    await s().seite.waitForFunction(fn(`() => !document.querySelector('${DRAWER}')`), undefined, {
      timeout: 15_000,
    });
  }, 90_000);

  it("T4 · 1024 × 768: breite Punktreihe, Bibliothek aktiv; „Arbeitsbereiche“ zeigt den Hinweis nur bei Überlauf", async () => {
    await fenster(QUER);
    const aktiv = await s().seite.evaluate<string[]>(
      fn(`() => [...document.querySelectorAll('a.kw-kopfband-punkt[aria-current="page"]')]
        .map((a) => a.getAttribute("data-kopfband-punkt"))`),
    );
    expect(aktiv, "quer ist auf der Wissensseite nicht genau die Bibliothek aktiv").toEqual([
      "bibliothek",
    ]);
    await s().seite.click('[data-testid="kopfband-arbeitsbereiche"]');
    await warteAuf(ARBEITSBEREICHE);
    const m = await liste(ARBEITSBEREICHE, "arbeitsbereiche-weiter-unten");
    const laeuftUeber = m.scrollHoehe > m.sichtHoehe + 4;
    expect(m.hinweis, `Überlauf ${laeuftUeber ? "ja" : "nein"}, Hinweis passt nicht dazu`).toBe(
      laeuftUeber ? "ja" : "nein",
    );
  }, 90_000);

  it("T5 · 1024 × 450: die Übersicht läuft über, der Hinweis steht — am Ende ist er fort", async () => {
    await fenster(NIEDRIG);
    const oben = await liste(ARBEITSBEREICHE, "arbeitsbereiche-weiter-unten");
    expect(oben.da, "die Übersicht hat die Fenstergrösse nicht überstanden").toBe(true);
    expect(oben.scrollHoehe, "bei 450 px Höhe läuft die Übersicht nicht über").toBeGreaterThan(
      oben.sichtHoehe + 4,
    );
    expect(oben.hinweis).toBe("ja");
    expect(oben.hinweisText).toContain("Weitere Einträge unten");
    await scrolleListe(ARBEITSBEREICHE, "ende");
    const unten = await liste(ARBEITSBEREICHE, "arbeitsbereiche-weiter-unten");
    expect(unten.hinweis).toBe("nein");
    expect(unten.letzteZeileSichtbar).toBe(true);
  }, 90_000);

  it("P · Chromium hat während aller Messungen keinen Seitenfehler gemeldet", () => {
    expect(s().seitenfehler).toEqual([]);
  });
});
