import { existsSync } from "node:fs";
// ================================================================================================
// JOB 3062 · H3 — /erfassen GEGEN DAS MOCKUP, IN CHROMIUM AN DER GEBAUTEN SEITE GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE (04.09.): „Sieht das Erfassen jetzt aus wie das Blatt, das ich gesehen habe — auf der
// echten Seite, nicht an einem Nachbau?“
//
// WAS DIESER TEST ABLÖST: Die beiden bisherigen „Zielbild“-Prüfungen des Erfassens
// (`zielbild-wissen-erfassen*.test.ts`) vergleichen TEXT gegen TEXT und sie messen eine ANDERE
// Fläche — `apps/web/public/word-addin/taskpane.html`, das Aufgabenfenster von Klara. Für die
// Web-App `/erfassen` gab es bis hierher ÜBERHAUPT KEINE Messung an der gebauten Seite. Die
// entsteht hier, nach dem abgenommenen Muster von `zielbild-validierung.test.ts` (JOB 2618 D5):
// echte `dist`, echte Fastify-App, Theme `modern`, `getComputedStyle` an den REALEN Elementen.
//
// EIN VERGLEICH JE WERT. Eine Mutation im Produkt (etwa die Blattbreite) macht GENAU EINEN Fall
// rot — nicht die halbe Datei. Die Sollwerte werden aus `design/klarwerk/Erfassen.dc.html` GELESEN
// und ohne Renderer kanonisiert; ein zweiter Zahlenbestand im Test würde beim nächsten Mockup
// still veralten.
//
// ROT VOR DEM UMBAU (Red-first-Vertrag §6, gemessen am Basisstand 237b44c): auf `/erfassen` gab es
// weder `[data-testid="blatt"]` noch die Werkzeugzeile — der Fall S („die Bühne steht“) war rot,
// und mit ihm jeder Vergleich, weil kein Element zu messen war. Dafür standen dort der
// Standardweg-Kasten und die Modus-Leiste.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// Die Vordertür-Adresse aus DER QUELLE, nicht abgeschrieben: der Auftrag nennt sie „/erfassen/
// vordertuer", die Navigationstabelle führt sie unter `/capture/frontdoor` (`app/navigation.ts`,
// `EXTRA_GUARDED_ITEMS`). Ein zweites Literal hier wäre genau die Tabelle, die auseinanderläuft.
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import {
  type Buehne,
  LESEN,
  MOCKUP,
  ORIGIN,
  buehneAufbauen,
  fn,
  kanon,
  mockup,
  schattenKanon,
  schattenSichtbar,
  zielProp,
  zielStil,
} from "./h3-blatt-buehne";

// ---- Anker im Mockup ---------------------------------------------------------------------------
const A_SPALTE = "width: 820px; padding: 24px 0 0";
const A_ZEILE = "display: flex; align-items: center; gap: 22px; padding: 0 4px";
const A_WERKZEUG = "gap: 6px; font-size: 13px; color: #525B6B";
const A_RECHTS = "padding: 6px 12px; background: #FFFFFF; border: 1px solid #E9E5DE";
const A_BLATT = "border-radius: 14px 14px 0 0; padding: 56px 72px 0";
const A_TITEL = "font-size: 28px; font-weight: 650";
const A_TEXT = "font-size: 16px; line-height: 1.75";
const A_SICHERN = "padding: 10px 20px; background: #FFFFFF; color: #1A2233";
const A_EINREICHEN = "background: #C2500A; color: #FFFFFF";

// ---- Selektoren der REALEN Elemente --------------------------------------------------------------
const S_SPALTE = '[data-testid="blatt-huelle"]';
const S_ZEILE = '[data-testid="blatt-werkzeugzeile"]';
const S_WERKZEUG = '[data-testid="blatt-werkzeug-diktieren"]';
const S_RECHTS = '[data-testid="blatt-werkzeug-bereich"]';
const S_BLATT = '[data-testid="blatt"]';
const S_TITEL = '[data-testid="blatt-titel"]';
const S_TEXT = '[data-testid="blatt-text"] [role="textbox"]';
const S_SICHERN = '[data-testid="blatt-entwurf-sichern"]';
const S_EINREICHEN = '[data-testid="blatt-einreichen"]';

const mockupDa = existsSync(MOCKUP);

describe.runIf(mockupDa)(
  "JOB 3062 · H3 · /erfassen — das Blatt, gemessen an der gebauten Seite in Chromium (Theme modern)",
  () => {
    let b: Buehne;
    const ziel = mockup();

    beforeAll(async () => {
      b = await buehneAufbauen("/erfassen");
      if (!b.fehler) {
        console.info(
          `JOB 3062 H3 · Chromium ${b.version} · /erfassen · Theme ${b.theme} · pageerror ${b.seitenfehler.length}`,
        );
      }
    }, 120_000);

    // JOB 2935 D1: Aufräumen braucht unter der Last des Gesamttors mehr als die zehn Sekunden, die
    // vitest einem Hook ohne eigene Angabe gibt.
    afterAll(async () => {
      await b?.schliessen();
    }, 60_000);

    async function messen(selektor: string, eigenschaft: string): Promise<string | null> {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      return b.seite.evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
    }

    it("S · die Bühne steht: Theme modern, das Blatt und seine Werkzeugzeile sind da, nichts geworfen", async () => {
      expect(b.fehler).toBeNull();
      expect(b.theme).toBe("modern");
      expect(b.seitenfehler, "pageerror beim Mounten").toEqual([]);
      const da = await b.seite.evaluate<Record<string, boolean>>(
        fn(
          "(sel) => Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, document.querySelector(v) !== null]))",
        ),
        {
          spalte: S_SPALTE,
          zeile: S_ZEILE,
          blatt: S_BLATT,
          titel: S_TITEL,
          text: S_TEXT,
          sichern: S_SICHERN,
          einreichen: S_EINREICHEN,
        },
      );
      expect(da).toEqual({
        spalte: true,
        zeile: true,
        blatt: true,
        titel: true,
        text: true,
        sichern: true,
        einreichen: true,
      });
    });

    it("S2 · die Fläche ist RUHIG: kein Standardweg-Kasten, keine Modus-Leiste, keine „Weiteren Wege“", async () => {
      expect(b.fehler).toBeNull();
      const gefunden = await b.seite.evaluate<string[]>(
        fn(
          `(woerter) => { const t = (document.body.innerText || ''); return woerter.filter((w) => t.includes(w)); }`,
        ),
        [
          "Standardweg",
          "Weitere Wege",
          "Dokument-Editor öffnen",
          "Alle Erfassungs-Modi",
          "Mehr Erfassungswege",
          "Erzähl dein Wissen",
        ],
      );
      expect(gefunden).toEqual([]);
    });

    // ---- Das Blatt (Mockup Z.46-52) ------------------------------------------------------------
    it("V1 · blatt-breite 820px — das reale Blatt", async () => {
      expect(b.fehler).toBeNull();
      const breite = await b.seite.evaluate<number | null>(
        fn(
          "(sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().width : null; }",
        ),
        S_BLATT,
      );
      expect(`${breite}px`).toBe(kanon(zielProp(zielStil(ziel, A_SPALTE), "width")));
    });

    it("V2 · blatt-grund #FFFFFF — background-color am realen Blatt", async () => {
      expect(await messen(S_BLATT, "background-color")).toBe(
        kanon(zielProp(zielStil(ziel, A_BLATT), "background")),
      );
    });

    it("V3 · blatt-linie 1px — border-top-width am realen Blatt", async () => {
      expect(await messen(S_BLATT, "border-top-width")).toBe("1px");
    });

    it("V4 · blatt-linie-farbe #E9E5DE (Token hairline → --kw-hairline modern) — border-top-color", async () => {
      expect(await messen(S_BLATT, "border-top-color")).toBe(kanon("#E9E5DE"));
    });

    it("V5 · blatt-radius oben 14px — border-top-left-radius am realen Blatt", async () => {
      const soll = (zielProp(zielStil(ziel, A_BLATT), "border-radius") ?? "").split(/\s+/);
      expect(await messen(S_BLATT, "border-top-left-radius")).toBe(soll[0]);
    });

    it("V6 · blatt-radius unten 0 — border-bottom-left-radius am realen Blatt", async () => {
      const soll = (zielProp(zielStil(ziel, A_BLATT), "border-radius") ?? "").split(/\s+/);
      expect(await messen(S_BLATT, "border-bottom-left-radius")).toBe(`${soll[3]}px`);
    });

    it("V7 · blatt-schatten (Token shadow-tile → --kw-shadow-tile modern) — box-shadow am realen Blatt", async () => {
      expect(schattenSichtbar(await messen(S_BLATT, "box-shadow"))).toBe(
        schattenKanon(zielProp(zielStil(ziel, A_BLATT), "box-shadow")),
      );
    });

    it("V8 · blatt-innen oben 56px — padding-top am realen Blatt", async () => {
      const soll = (zielProp(zielStil(ziel, A_BLATT), "padding") ?? "").split(/\s+/);
      expect(await messen(S_BLATT, "padding-top")).toBe(soll[0]);
    });

    it("V9 · blatt-innen seitlich 72px — padding-left am realen Blatt", async () => {
      const soll = (zielProp(zielStil(ziel, A_BLATT), "padding") ?? "").split(/\s+/);
      expect(await messen(S_BLATT, "padding-left")).toBe(soll[1]);
    });

    it("V10 · blatt-innen unten 0 — padding-bottom am realen Blatt", async () => {
      const soll = (zielProp(zielStil(ziel, A_BLATT), "padding") ?? "").split(/\s+/);
      expect(await messen(S_BLATT, "padding-bottom")).toBe(`${soll[2]}px`);
    });

    it("V11 · blatt-innenabstand 22px — gap am realen Blatt", async () => {
      expect(await messen(S_BLATT, "gap")).toBe(kanon(zielProp(zielStil(ziel, A_BLATT), "gap")));
    });

    // ---- Titel und Text --------------------------------------------------------------------------
    it("V12 · titel-groesse 28px — font-size am realen Titelfeld", async () => {
      expect(await messen(S_TITEL, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, A_TITEL), "font-size")),
      );
    });

    it("V13 · titel-gewicht 650 — font-weight am realen Titelfeld", async () => {
      expect(await messen(S_TITEL, "font-weight")).toBe(
        kanon(zielProp(zielStil(ziel, A_TITEL), "font-weight")),
      );
    });

    it("V14 · titel-laufweite -0.3px — letter-spacing am realen Titelfeld", async () => {
      expect(await messen(S_TITEL, "letter-spacing")).toBe(
        kanon(zielProp(zielStil(ziel, A_TITEL), "letter-spacing")),
      );
    });

    it("V15 · text-groesse 16px — font-size am realen Textfeld", async () => {
      expect(await messen(S_TEXT, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, A_TEXT), "font-size")),
      );
    });

    it("V16 · text-zeilenhoehe 1.75 (= 28px bei 16px) — line-height am realen Textfeld", async () => {
      const faktor = Number.parseFloat(zielProp(zielStil(ziel, A_TEXT), "line-height") ?? "0");
      const grad = Number.parseFloat(zielProp(zielStil(ziel, A_TEXT), "font-size") ?? "0");
      expect(await messen(S_TEXT, "line-height")).toBe(`${faktor * grad}px`);
    });

    // ---- Werkzeugzeile (Mockup Z.36-45) ---------------------------------------------------------
    it("V17 · zeilenabstand 22px — gap an der realen Werkzeugzeile", async () => {
      expect(await messen(S_ZEILE, "gap")).toBe(kanon(zielProp(zielStil(ziel, A_ZEILE), "gap")));
    });

    it("V18 · werkzeug-groesse 13px — font-size am realen Werkzeug „Diktieren“", async () => {
      expect(await messen(S_WERKZEUG, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, A_WERKZEUG), "font-size")),
      );
    });

    it("V19 · werkzeug-farbe #525B6B (Token muted-2 → --kw-muted-2 modern) — color am realen Werkzeug", async () => {
      expect(await messen(S_WERKZEUG, "color")).toBe(
        kanon(zielProp(zielStil(ziel, A_WERKZEUG), "color")),
      );
    });

    it("V20 · rechtes-menue-radius 8px — border-radius am realen Menü „Bereich“", async () => {
      expect(await messen(S_RECHTS, "border-radius")).toBe(
        kanon(zielProp(zielStil(ziel, A_RECHTS), "border-radius")),
      );
    });

    it("V21 · rechtes-menue-linie 1px #E9E5DE — border-top-width/-color am realen Menü „Bereich“", async () => {
      expect(await messen(S_RECHTS, "border-top-width")).toBe("1px");
      expect(await messen(S_RECHTS, "border-top-color")).toBe(kanon("#E9E5DE"));
    });

    it("V22 · rechtes-menue-groesse 13px — font-size am realen Menü „Bereich“", async () => {
      expect(await messen(S_RECHTS, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, A_RECHTS), "font-size")),
      );
    });

    it("V23 · rechtes-menue-innen 6px/12px — padding am realen Menü „Bereich“", async () => {
      const soll = (zielProp(zielStil(ziel, A_RECHTS), "padding") ?? "").split(/\s+/);
      expect(await messen(S_RECHTS, "padding-top")).toBe(soll[0]);
      expect(await messen(S_RECHTS, "padding-left")).toBe(soll[1]);
    });

    // ---- Die beiden Knöpfe (Mockup Z.53) ---------------------------------------------------------
    it("V24 · sichern-grund #FFFFFF — background-color am realen Knopf „Entwurf sichern“", async () => {
      expect(await messen(S_SICHERN, "background-color")).toBe(
        kanon(zielProp(zielStil(ziel, A_SICHERN), "background")),
      );
    });

    it("V25 · sichern-schrift #1A2233 — color am realen Knopf „Entwurf sichern“", async () => {
      expect(await messen(S_SICHERN, "color")).toBe(
        kanon(zielProp(zielStil(ziel, A_SICHERN), "color")),
      );
    });

    it("V26 · sichern-radius 10px — border-radius am realen Knopf „Entwurf sichern“", async () => {
      expect(await messen(S_SICHERN, "border-radius")).toBe(
        kanon(zielProp(zielStil(ziel, A_SICHERN), "border-radius")),
      );
    });

    it("V27 · sichern-groesse 14px — font-size am realen Knopf „Entwurf sichern“", async () => {
      expect(await messen(S_SICHERN, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, A_SICHERN), "font-size")),
      );
    });

    it("V28 · sichern-innen 10px/20px — padding am realen Knopf „Entwurf sichern“", async () => {
      const soll = (zielProp(zielStil(ziel, A_SICHERN), "padding") ?? "").split(/\s+/);
      expect(await messen(S_SICHERN, "padding-top")).toBe(soll[0]);
      expect(await messen(S_SICHERN, "padding-left")).toBe(soll[1]);
    });

    it("V29 · einreichen-grund #C2500A — background-color am realen Knopf „Einreichen“", async () => {
      expect(await messen(S_EINREICHEN, "background-color")).toBe(
        kanon(zielProp(zielStil(ziel, A_EINREICHEN), "background")),
      );
    });

    it("V30 · einreichen-schrift #FFFFFF — color am realen Knopf „Einreichen“", async () => {
      expect(await messen(S_EINREICHEN, "color")).toBe(
        kanon(zielProp(zielStil(ziel, A_EINREICHEN), "color")),
      );
    });

    it("V31 · einreichen-radius 10px — border-radius am realen Knopf „Einreichen“", async () => {
      expect(await messen(S_EINREICHEN, "border-radius")).toBe(
        kanon(zielProp(zielStil(ziel, A_EINREICHEN), "border-radius")),
      );
    });

    it("V32 · einreichen-gewicht 600 — font-weight am realen Knopf „Einreichen“", async () => {
      expect(await messen(S_EINREICHEN, "font-weight")).toBe(
        kanon(zielProp(zielStil(ziel, A_EINREICHEN), "font-weight")),
      );
    });

    // ---- Die Spalte (Mockup Z.35) ----------------------------------------------------------------
    it("V33 · spaltenabstand 14px — gap an der realen Spalte", async () => {
      expect(await messen(S_SPALTE, "gap")).toBe(kanon(zielProp(zielStil(ziel, A_SPALTE), "gap")));
    });

    it("V34 · spalte-oben 24px — padding-top an der realen Spalte", async () => {
      const soll = (zielProp(zielStil(ziel, A_SPALTE), "padding") ?? "").split(/\s+/);
      expect(await messen(S_SPALTE, "padding-top")).toBe(soll[0]);
    });

    it("K · KALIBRIERUNG: die Sollwerte kommen wirklich aus dem Mockup (kein null-null-Treffer)", () => {
      for (const [name, anker, eigenschaft] of [
        ["blatt", A_BLATT, "padding"],
        ["titel", A_TITEL, "font-size"],
        ["text", A_TEXT, "line-height"],
        ["zeile", A_ZEILE, "gap"],
        ["werkzeug", A_WERKZEUG, "color"],
        ["rechts", A_RECHTS, "border-radius"],
        ["sichern", A_SICHERN, "border-radius"],
        ["einreichen", A_EINREICHEN, "background"],
        ["spalte", A_SPALTE, "width"],
      ] as const) {
        expect(
          zielProp(zielStil(ziel, anker), eigenschaft),
          `${name}.${eigenschaft}`,
        ).not.toBeNull();
      }
      // Und die Umschrift des Schattens ist keine Identität.
      expect(schattenKanon("0 1px 2px rgba(14, 22, 38, 0.05)")).toBe(
        "rgba(14, 22, 38, 0.05) 0px 1px 2px 0px",
      );
      // Und der Filter entfernt NUR die leeren Tailwind-Ringlagen, nicht einen echten Ring.
      expect(
        schattenSichtbar("rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(1, 2, 3) 0px 0px 0px 2px"),
      ).toBe("rgb(1, 2, 3) 0px 0px 0px 2px");
    });

    // ==========================================================================================
    // R · DIE DRITTE ADRESSE. Auftrag §5.1 und Prüfpunkt 4 verlangen einen Test JE ROUTE: eine
    // halb umgebaute Fläche („Vordertür umgebaut, /erfassen zeigt weiter die alte Seite") ist
    // genau die Halbheit, die ausgeschlossen werden soll. `/erfassen` misst diese Datei in jedem
    // Wert, `/erfassen/neu` misst der Textmesser — `/erfassen/vordertuer` wurde von KEINER
    // Chromium-Messung berührt und stand nur über gemountete Tests da. Der Fall holt sie herein.
    // ==========================================================================================
    // BEWUSST DIESELBE BÜHNE, per Navigation — KEINE zweite. Ein zweiter `buehneAufbauen` würde
    // einen zweiten Chromium starten; das schlägt hier zuverlässig mit „browserType.launch: Target
    // page, context or browser has been closed" fehl (dieselbe Grenze, an der auch das unberührte
    // `job2935-validierung-fussband.test.ts` in seinem zweiten Block scheitert). Die Navigation
    // misst dieselbe gebaute Seite und kostet keinen zweiten Prozess. Der Fall steht am ENDE des
    // Blocks und führt die Bühne danach auf `/erfassen` zurück, damit keine Reihenfolge zerbricht.
    it("R · /erfassen/vordertuer zeigt DASSELBE Blatt — 820px, Werkzeugzeile, beide Knöpfe, nichts geworfen", async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      const vorher = b.seitenfehler.length;
      try {
        await b.seite.goto(`${ORIGIN}${CAPTURE_FRONT_DOOR_ROUTE}`, {
          waitUntil: "load",
          timeout: 60_000,
        });
        await b.seite.waitForFunction(
          fn("(sel) => document.querySelector(sel) !== null"),
          S_BLATT,
          { timeout: 30_000 },
        );
        const da = await b.seite.evaluate<Record<string, boolean>>(
          fn(
            "(sel) => Object.fromEntries(Object.entries(sel).map(([k, v]) => [k, document.querySelector(v) !== null]))",
          ),
          { zeile: S_ZEILE, blatt: S_BLATT, sichern: S_SICHERN, einreichen: S_EINREICHEN },
        );
        expect(da).toEqual({ zeile: true, blatt: true, sichern: true, einreichen: true });
        // Nicht nur „ein Blatt da", sondern DASSELBE: die tragende Breite aus dem Mockup.
        const breite = await b.seite.evaluate<number | null>(
          fn(
            "(sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().width : null; }",
          ),
          S_BLATT,
        );
        expect(`${breite}px`).toBe(kanon(zielProp(zielStil(ziel, A_SPALTE), "width")));
        expect(b.seitenfehler.slice(vorher), "pageerror auf /erfassen/vordertuer").toEqual([]);
      } finally {
        await b.seite.goto(`${ORIGIN}/erfassen`, { waitUntil: "load", timeout: 60_000 });
      }
    }, 120_000);
  },
);

describe.runIf(!mockupDa)("JOB 3062 · H3 · Mockup-Abgleich übersprungen", () => {
  it("meldet das fehlende Mockup, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(MOCKUP), `Mockup nicht lesbar: ${MOCKUP}`).toBe(false);
  });
});
