// ================================================================================================
// JOB 3060 · H1 — DER SICHTBARE TEXT DES KOPFBANDS SIND GENAU SIEBEN WÖRTER.
// ================================================================================================
//
// Pedi (04.09. 06:50): „Text über Text über Text.“ Das Kopfband der gebauten App trägt als sicht-
// baren Text genau KLARWERK, Start, Fragen, Bibliothek, Erfassen, Prüfen und den Platzhalter
// Suchen — den Zähler an „Prüfen“ und die Initialen im Konto-Kreis ausgenommen. Kein „Design:
// Klassisch", kein „DE EN NL“, keine Versions-Pille, kein „Mobil“, keine Hilfe-Beschriftung.
//
// Und auf /start gibt es weder eine Seitenleiste (`aside`) noch eine Fußzeile (`footer`) im DOM —
// gemessen als Admin, also mit jedem Punkt, den es gibt. Die Seitenleiste ist ENTFERNT, nicht
// versteckt (§8.4 des Auftrags: Halbheit wäre „Sidebar per CSS hidden“).
//
// Gemessen wird `innerText` (was gezeichnet ist — nicht `textContent`, das auch Verborgenes trüge)
// am realen `<header>` der gebauten App in Chromium, auf drei Routen.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { APP_VERSION } from "../../apps/web/src/version";
import { type Strecke, fn, oeffne, strecke, warteBis } from "./h1-chromium";

/** In der Seite: der gezeichnete Text des Kopfbands, in Wörter zerlegt, plus Zähler/Initialen/Platzhalter. */
const INVENTAR = `() => {
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const zaehler = band.querySelector('.kw-kopfband-zaehler');
  const konto = band.querySelector('[data-testid="kopfband-konto"]');
  const input = band.querySelector('input[type="search"]');
  return {
    innerText: band.innerText,
    woerter: band.innerText.split(/\\s+/).filter(Boolean),
    zaehler: zaehler ? zaehler.innerText.trim() : null,
    initialen: konto ? konto.innerText.trim() : null,
    placeholder: input ? input.getAttribute('placeholder') : null,
    // Eine SEITENLEISTE ist ein <aside> mit Navigationszielen (die alte trug nav + Nav-Links);
    // ein <aside> mit Seiteninhalt (z. B. der Klara-Teaser auf Start) ist keine.
    seitenleisten: [...document.querySelectorAll('aside')].filter((a) => a.querySelector('nav, a[href="/start"], a[href="/bibliothek"], a[href="/hilfe"], a[href="/profil"]') !== null).length,
    kwSidebar: document.querySelectorAll('.kw-sidebar').length,
    asides: [...document.querySelectorAll('aside')].map((a) => (a.innerText || '').trim().slice(0, 60)),
    footer: document.querySelectorAll('footer').length,
    header: document.querySelectorAll('header').length,
  };
}`;

interface Inventar {
  innerText: string;
  woerter: string[];
  zaehler: string | null;
  initialen: string | null;
  placeholder: string | null;
  seitenleisten: number;
  kwSidebar: number;
  asides: string[];
  footer: number;
  header: number;
}

let s: Strecke | null = null;
let fehler: string | null = null;
const jeRoute: Record<string, Inventar | null> = {};
let boardZahl = -1;

const ROUTEN = ["/start", "/bibliothek", "/validierung", "/erfassen"];

describe("JOB 3060 · H1 · kein Erklärtext im Kopfband — die echte Seite in Chromium", () => {
  beforeAll(async () => {
    try {
      await i18n.changeLanguage("de");
      s = await strecke({ email: "pedi@job3060-text.test" });
      // Ein echtes Wissensobjekt im Prüfboard, damit der Zähler steht und AUSGENOMMEN werden muss.
      await s.services.ko.create({
        title: "Halterungen ohne waagerechte Oberseiten",
        statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
        type: "best_practice",
        category: "Allgemein",
        author: s.autorId,
      } as never);
      const board = await s.app.inject({
        method: "GET",
        url: "/api/validation/board",
        headers: { authorization: `Bearer ${s.token}` },
      });
      boardZahl = (board.json() as unknown[]).length;
      for (const pfad of ROUTEN) {
        await oeffne(s.seite, pfad);
        await warteBis(
          s.seite,
          `(n) => { const z = document.querySelector('.kw-kopfband-zaehler'); return z !== null && (z.textContent || '').trim() === String(n); }`,
          boardZahl,
        );
        jeRoute[pfad] = await s.seite.evaluate<Inventar | null>(fn(INVENTAR));
      }
      console.info(`JOB 3060 H1 · Erklärtext · ${JSON.stringify(jeRoute)}`);
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await s?.schliessen();
  }, 60_000);

  const SIEBEN = ["KLARWERK", "Start", "Fragen", "Bibliothek", "Erfassen", "Prüfen"];

  it("Z · die sechs Wörter des Bands sind die Übersetzungen des Produkts (de) — nicht abgeschrieben", () => {
    expect([
      i18n.getFixedT("de")("app.name"),
      i18n.getFixedT("de")("nav.start"),
      i18n.getFixedT("de")("nav.ask"),
      i18n.getFixedT("de")("nav.library"),
      i18n.getFixedT("de")("kopfband.erfassen"),
      i18n.getFixedT("de")("kopfband.pruefen"),
    ]).toEqual(SIEBEN);
    expect(i18n.getFixedT("de")("kopfband.suchen")).toBe("Suchen");
  });

  for (const pfad of ROUTEN) {
    it(`T · ${pfad}: innerText des Kopfbands = KLARWERK Start Fragen Bibliothek Erfassen Prüfen (+ Zähler, + Initialen), Platzhalter Suchen`, () => {
      expect(fehler).toBeNull();
      const inv = jeRoute[pfad];
      expect(inv, "Kopfband nicht gefunden").toBeTruthy();
      if (!inv) return;
      // Zähler und Initialen sind die beiden zugelassenen Ausnahmen — und sie stehen wirklich da.
      expect(inv.zaehler).toBe(String(boardZahl));
      expect(inv.initialen).toBe("PK");
      const ohneAusnahmen = inv.woerter.filter((w) => w !== inv.zaehler && w !== inv.initialen);
      expect(ohneAusnahmen).toEqual(SIEBEN);
      expect(inv.placeholder).toBe("Suchen");
    });
  }

  it("N · nichts von der alten Kopfzeile ist noch zu lesen: Design, DE/EN/NL, Version, Mobil, Hilfe, Reasoning System", () => {
    expect(fehler).toBeNull();
    const text = jeRoute["/start"]?.innerText ?? "";
    for (const verboten of [
      "Design",
      "Klassisch",
      "Modern",
      "DE",
      "EN",
      "NL",
      `v${APP_VERSION}`,
      "Mobil",
      "Hilfe",
      "Reasoning",
      "KI",
      "Web-Suche",
      "Abmelden",
    ]) {
      expect(text, `„${verboten}“ steht im Kopfband`).not.toContain(verboten);
    }
  });

  it("A · auf /start gibt es KEINE Seitenleiste (aside mit Navigationszielen, kein .kw-sidebar) und KEINE Fußzeile (footer) im DOM — und genau EIN header", () => {
    expect(fehler).toBeNull();
    const inv = jeRoute["/start"];
    // Protokoll: welche <aside>-Elemente die Seite trägt (Seiteninhalt, z. B. der Klara-Teaser —
    // keines davon ist eine Leiste mit Navigationszielen).
    console.info(`JOB 3060 H1 · aside auf /start: ${JSON.stringify(inv?.asides)}`);
    expect(inv?.seitenleisten, "ein <aside> mit Navigationszielen — die Seitenleiste lebt").toBe(0);
    expect(inv?.kwSidebar).toBe(0);
    expect(inv?.footer).toBe(0);
    expect(inv?.header).toBe(1);
  });
});
