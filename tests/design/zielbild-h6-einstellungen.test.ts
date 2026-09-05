import { existsSync } from "node:fs";
// ================================================================================================
// JOB 3065 H6 · DIE FLÄCHE „EINSTELLUNGEN", AN DER GEBAUTEN SEITE IN CHROMIUM GEMESSEN.
// ================================================================================================
//
// PEDIS FRAGE (04.09.): „Sieht die Einstellungsseite wirklich so aus wie gezeichnet — auf der
// echten Seite gemessen, nicht an einem Nachbau?"
//
// Zielbild: `/Users/peterkohnert/klarwerk_steuerung/design/klarwerk/Admin.dc.html`. Gemessen wird
// per `getComputedStyle` an den REALEN Elementen der in Chromium gemounteten `Admin.tsx` (Theme
// modern, ausdrücklich gesetzt). Der Beleg ist der SELEKTOR: für jedes Element wird ein CSS-Pfad in
// der Seite erzeugt und rückwärts aufgelöst — `document.querySelector(pfad)` muss dasselbe Element
// liefern (Fall S).
//
// EIN VERGLEICH JE WERT. Die Sollwerte werden aus der Vorlage GELESEN (nicht abgeschrieben) und nur
// kanonisiert (Hex → `rgb(…)`, Schatten in Lagen zerlegt, weil CSS die Farbe vor und
// `getComputedStyle` sie hinter die Längen schreibt).
//
// VOLLSTÄNDIG, NICHT STILL: Werte, die das Produkt bewusst anders trägt (die Chevron-Farbe der
// Vorlage steht in keiner Palette; die Seitenbreite entscheidet die Hülle aus JOB 3060), stehen
// unten als OFFEN — an denselben realen Elementen gemessen und protokolliert, nicht als gleich
// behauptet.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LESEN,
  PFAD_FN,
  type Seite,
  type Stand,
  ZIELBILD,
  beende,
  fn,
  kanon,
  schattenLagen,
  starte,
  zielProp,
  zielStil,
  zielbildText,
} from "./h6-chromium";

// ---- Anker im Zielbild ---------------------------------------------------------------------------
const Z_TITEL = "font-size: 26px; font-weight: 650";
const Z_REITERSPALTE = "width: 200px; display: flex; flex-direction: column; gap: 4px";
const Z_REITER_AKTIV =
  "padding: 10px 14px; border-radius: 9px; font-size: 14px; background: #FFFFFF";
const Z_KARTE = "border-radius: 14px; box-shadow";
const Z_ZEILE = "padding: 13px 16px; border-bottom";
const Z_LABEL = "font-size: 14px;";
const Z_WERT = "gap: 6px; font-size: 14px; color: #525B6B";
const Z_KNOPF = "padding: 10px 20px; background: #FFFFFF";
const Z_KICKER = "font-size: 11px; letter-spacing: 0.4px; color: #525B6B";

interface Selektoren {
  titel: string;
  spalte: string;
  reiterAktiv: string;
  karte: string;
  zeile: string;
  zeileMitLinie: string;
  label: string;
  wert: string;
  chevron: string;
  kicker: string;
  knopf: string;
  aufgeloest: boolean;
}

/** In der Seite: die realen Elemente der Fläche finden und ihre Selektoren zurückgeben. */
const ELEMENTE = `([pfadFnSrc]) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const q = (s) => document.querySelector(s);
  const titel = q('[data-einst="titel"]');
  const spalte = q('[data-einst="reiterspalte"]');
  const reiterAktiv = q('[data-einst="reiter"][aria-pressed="true"]');
  const karte = q('[data-einst="karte"]');
  const zeilen = karte ? [...karte.querySelectorAll('[data-einst="zeile"]')] : [];
  const zeile = zeilen[0] || null;
  // Die Trennlinie steht zwischen zwei Zeilen — an der LETZTEN gibt es sie im Zielbild (Z.49) so
  // wenig wie im Produkt. Gemessen wird deshalb eine Zeile, auf die noch eine folgt.
  const zeileMitLinie = document.querySelectorAll('[data-einst="karte"]')[1]
    ? [...document.querySelectorAll('[data-einst="karte"]')].map((k) => [...k.querySelectorAll('[data-einst="zeile"]')]).filter((z) => z.length > 1)[0]?.[0] || null
    : null;
  const label = zeile ? zeile.querySelector('[data-einst="label"]') : null;
  const wert = zeile ? zeile.querySelector('[data-einst="wert"]') : null;
  const wertRahmen = wert ? wert.parentElement : null;
  const chevron = zeile ? zeile.querySelector('[data-einst="chevron"]') : null;
  const kicker = q('[data-einst="kicker"]');
  const knopf = q('[data-einst="flaechenknopf"]');
  if (!titel || !spalte || !reiterAktiv || !karte || !zeile || !zeileMitLinie || !label || !wert || !chevron || !kicker || !knopf) {
    return null;
  }
  const out = {
    titel: pfad(titel), spalte: pfad(spalte), reiterAktiv: pfad(reiterAktiv), karte: pfad(karte),
    zeile: pfad(zeile), zeileMitLinie: pfad(zeileMitLinie), label: pfad(label),
    wert: pfad(wertRahmen), chevron: pfad(chevron), kicker: pfad(kicker), knopf: pfad(knopf),
  };
  out.aufgeloest = Object.values(out).every((p) => typeof p !== 'string' || document.querySelector(p) !== null)
    && document.querySelector(out.karte) === karte
    && document.querySelector(out.zeile) === zeile
    && document.querySelector(out.knopf) === knopf;
  return out;
}`;

let stand: Stand | null = null;
let sel: Selektoren | null = null;
const ziel = zielbildText();

describe.runIf(existsSync(ZIELBILD))(
  "JOB 3065 H6 · Einstellungen — die echte Seite, gemountet in Chromium (Theme modern)",
  () => {
    beforeAll(async () => {
      stand = await starte("/admin", '[data-einst="seite"]');
      if (stand.fehler === null && stand.seite) {
        // Auf die erste Zeile warten: die Nutzerliste kommt aus dem echten `/api/users`.
        await stand.seite.waitForFunction(
          fn(`() => document.querySelectorAll('[data-einst="zeile"]').length > 0`),
          undefined,
          { timeout: 30_000 },
        );
        sel = await stand.seite.evaluate<Selektoren | null>(fn(ELEMENTE), [PFAD_FN]);
        console.info(
          `JOB 3065 H6 · Chromium ${stand.version} · /admin · Theme ${stand.theme} · Selektoren ${JSON.stringify(sel)}`,
        );
      }
    }, 120_000);

    afterAll(async () => {
      if (stand) await beende(stand);
    }, 60_000);

    async function messen(selektor: string | null | undefined, eigenschaft: string) {
      expect(stand?.fehler, "Seite nicht gemountet").toBeNull();
      expect(selektor, "reales Element nicht gefunden").toBeTruthy();
      return (stand?.seite as Seite).evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
    }

    it("S · die echte Seite steht: Theme modern wirksam, alle Träger gefunden, Selektoren rückwärts auflösbar", () => {
      expect(stand?.fehler).toBeNull();
      expect(stand?.theme).toBe("modern");
      expect(
        sel,
        "Fläche unvollständig — Titel, Reiterspalte, Karte, Zeile, Kicker oder Knopf fehlt",
      ).not.toBeNull();
      expect(sel?.aufgeloest).toBe(true);
      expect(sel?.karte).toMatch(/^body > /);
      expect(stand?.seitenfehler).toEqual([]);
    });

    // ---- Titel (Zielbild Z.39) -----------------------------------------------------------------
    it("V0 · titel-text — wörtlich der des Zielbilds (JOB 3065 R2, BENs Prüflücke 6)", async () => {
      // Der Sollwert wird aus der Vorlage GELESEN: der Textinhalt des Trägers, der die 26px/650
      // trägt. Ein Test, der nur Schriftgrad und Gewicht misst, bliebe grün, wenn dort morgen
      // „Admin" stünde — und genau der Titel ist Pedis erste sichtbare Zusage.
      const soll = new RegExp(`<div style="${Z_TITEL}[^"]*">([^<]+)</div>`).exec(ziel)?.[1];
      expect(soll, "Titeltext im Zielbild nicht gefunden").toBe("Einstellungen");
      const ist = await (stand?.seite as Seite).evaluate<string | null>(
        fn(
          "(sel) => { const el = document.querySelector(sel); return el ? (el.textContent || '').trim() : null; }",
        ),
        sel?.titel,
      );
      expect(ist).toBe(soll);
    });
    it("V1 · titel-schriftgrad 26px", async () => {
      expect(await messen(sel?.titel, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, Z_TITEL), "font-size")),
      );
    });
    it("V2 · titel-gewicht 650", async () => {
      expect(await messen(sel?.titel, "font-weight")).toBe(
        kanon(zielProp(zielStil(ziel, Z_TITEL), "font-weight")),
      );
    });
    it("V3 · titel-sperrung -0.3px", async () => {
      expect(await messen(sel?.titel, "letter-spacing")).toBe(
        kanon(zielProp(zielStil(ziel, Z_TITEL), "letter-spacing")),
      );
    });

    // ---- Reiterspalte (Z.43) --------------------------------------------------------------------
    it("V4 · reiterspalte-breite 200px", async () => {
      expect(await messen(sel?.spalte, "width")).toBe(
        kanon(zielProp(zielStil(ziel, Z_REITERSPALTE), "width")),
      );
    });
    it("V5 · reiterspalte-abstand 4px", async () => {
      expect(await messen(sel?.spalte, "gap")).toBe(
        kanon(zielProp(zielStil(ziel, Z_REITERSPALTE), "gap")),
      );
    });
    it("V6 · reiter-polster 10px 14px (aktiver Reiter)", async () => {
      const soll = (zielProp(zielStil(ziel, Z_REITER_AKTIV), "padding") ?? "").split(/\s+/);
      expect(await messen(sel?.reiterAktiv, "padding-top")).toBe(soll[0]);
      expect(await messen(sel?.reiterAktiv, "padding-left")).toBe(soll[1]);
    });
    it("V7 · reiter-radius 9px", async () => {
      expect(await messen(sel?.reiterAktiv, "border-radius")).toBe(
        kanon(zielProp(zielStil(ziel, Z_REITER_AKTIV), "border-radius")),
      );
    });
    it("V8 · reiter-schriftgrad 14px", async () => {
      expect(await messen(sel?.reiterAktiv, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, Z_REITER_AKTIV), "font-size")),
      );
    });
    it("V9 · reiter-gewicht 600 (aktiv)", async () => {
      expect(await messen(sel?.reiterAktiv, "font-weight")).toBe(
        kanon(zielProp(zielStil(ziel, Z_REITER_AKTIV), "font-weight")),
      );
    });
    it("V10 · reiter-fläche #FFFFFF (aktiv)", async () => {
      expect(await messen(sel?.reiterAktiv, "background-color")).toBe(
        kanon(zielProp(zielStil(ziel, Z_REITER_AKTIV), "background")),
      );
    });

    // ---- Karte (Z.45) ---------------------------------------------------------------------------
    it("V11 · karte-radius 14px", async () => {
      expect(await messen(sel?.karte, "border-radius")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KARTE), "border-radius")),
      );
    });
    it("V12 · karte-rand 1px #E9E5DE", async () => {
      const rand = (zielProp(zielStil(ziel, Z_KARTE), "border") ?? "").split(/\s+/);
      expect(await messen(sel?.karte, "border-top-width")).toBe(rand[0]);
      expect(await messen(sel?.karte, "border-top-color")).toBe(kanon(rand[2] ?? null));
    });
    it("V13 · karte-schatten (zwei Lagen, Werkbank-Elevation)", async () => {
      const soll = zielProp(zielStil(ziel, Z_KARTE), "box-shadow");
      const ist = await messen(sel?.karte, "box-shadow");
      expect(soll, "Zielbild trägt keinen Schatten").not.toBeNull();
      expect(schattenLagen(ist ?? "")).toEqual(schattenLagen(soll ?? ""));
    });

    // ---- Zeile (Z.46) ---------------------------------------------------------------------------
    it("V14 · zeile-polster 13px 16px", async () => {
      const soll = (zielProp(zielStil(ziel, Z_ZEILE), "padding") ?? "").split(/\s+/);
      expect(await messen(sel?.zeile, "padding-top")).toBe(soll[0]);
      expect(await messen(sel?.zeile, "padding-bottom")).toBe(soll[0]);
      expect(await messen(sel?.zeile, "padding-left")).toBe(soll[1]);
      expect(await messen(sel?.zeile, "padding-right")).toBe(soll[1]);
    });
    it("V15 · zeile-trennlinie 1px #E9E5DE", async () => {
      const linie = (zielProp(zielStil(ziel, Z_ZEILE), "border-bottom") ?? "").split(/\s+/);
      expect(await messen(sel?.zeileMitLinie, "border-bottom-width")).toBe(linie[0]);
      expect(await messen(sel?.zeileMitLinie, "border-bottom-color")).toBe(kanon(linie[2] ?? null));
    });
    it("V16 · label-schriftgrad 14px", async () => {
      expect(await messen(sel?.label, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, Z_LABEL), "font-size")),
      );
    });
    it("V17 · wert-schriftgrad 14px", async () => {
      expect(await messen(sel?.wert, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, Z_WERT), "font-size")),
      );
    });
    it("V18 · wert-farbe #525B6B", async () => {
      expect(await messen(sel?.wert, "color")).toBe(
        kanon(zielProp(zielStil(ziel, Z_WERT), "color")),
      );
    });
    it("V19 · wert-abstand zum Chevron 6px", async () => {
      expect(await messen(sel?.wert, "gap")).toBe(kanon(zielProp(zielStil(ziel, Z_WERT), "gap")));
    });
    it("V20 · chevron-größe 13px", async () => {
      // Die Vorlage setzt `width="13"` am SVG (Z.46), das Produkt über die Symbolgröße.
      const soll = /<svg width="(\d+)" height="\d+"[^>]*><path d="M9 6l6 6-6 6"/.exec(ziel)?.[1];
      expect(soll, "Chevron im Zielbild nicht gefunden").toBeTruthy();
      expect(await messen(sel?.chevron, "width")).toBe(`${soll}px`);
      expect(await messen(sel?.chevron, "height")).toBe(`${soll}px`);
    });

    // ---- Kicker (Z.52) und Flächenknopf (Z.51) ---------------------------------------------------
    it("V21 · kicker-schriftgrad 11px", async () => {
      expect(await messen(sel?.kicker, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KICKER), "font-size")),
      );
    });
    it("V22 · kicker-sperrung 0.4px", async () => {
      expect(await messen(sel?.kicker, "letter-spacing")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KICKER), "letter-spacing")),
      );
    });
    it("V23 · kicker-farbe #525B6B", async () => {
      expect(await messen(sel?.kicker, "color")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KICKER), "color")),
      );
    });
    it("V24 · knopf-polster 10px 20px", async () => {
      const soll = (zielProp(zielStil(ziel, Z_KNOPF), "padding") ?? "").split(/\s+/);
      expect(await messen(sel?.knopf, "padding-top")).toBe(soll[0]);
      expect(await messen(sel?.knopf, "padding-left")).toBe(soll[1]);
    });
    it("V25 · knopf-radius 10px", async () => {
      expect(await messen(sel?.knopf, "border-radius")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KNOPF), "border-radius")),
      );
    });
    it("V26 · knopf-schriftgrad 14px", async () => {
      expect(await messen(sel?.knopf, "font-size")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KNOPF), "font-size")),
      );
    });
    it("V27 · knopf-fläche #FFFFFF und Schrift #1A2233", async () => {
      expect(await messen(sel?.knopf, "background-color")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KNOPF), "background")),
      );
      expect(await messen(sel?.knopf, "color")).toBe(
        kanon(zielProp(zielStil(ziel, Z_KNOPF), "color")),
      );
    });

    // ---- Die offenen Werte: gemessen, begründet, nicht behauptet ---------------------------------
    const OFFEN: [string, () => Promise<string | null>, () => string, string][] = [
      [
        "chevron-farbe #9AA2B1",
        () => messen(sel?.chevron, "color"),
        () => "rgb(154, 162, 177)",
        "die Vorlagenfarbe steht in keiner Palette (themes.css kennt Tinte-2 #525B6B und Tinte-3 #8B93A2); das Produkt nimmt das vorhandene Token statt eine neue Farbe zu erfinden",
      ],
      [
        "inhaltsbreite 900px",
        () => messen(sel?.karte, "width"),
        () => "900px (Spalte der Vorlage, Z.37)",
        "die Breite entscheidet die Hülle (JOB 3060 H1); die Fläche deckelt bei max-w-[900px] und teilt sie mit der Reiterspalte",
      ],
    ];
    for (const [name, lesen, soll, grund] of OFFEN) {
      it(`OFFEN · ${name} — gemessen am realen Element, begründet`, async () => {
        const ist = await lesen();
        expect(ist, "reales Element liefert keinen Wert").not.toBeNull();
        console.info(
          `JOB 3065 H6 · OFFEN · ${name}: Zielbild ${soll()} · Seite (modern) ${ist} · ${ist === soll() ? "GLEICH" : "abweichend"} · ${grund}`,
        );
      });
    }
  },
);

describe.runIf(!existsSync(ZIELBILD))("JOB 3065 H6 · Zielbild-Abgleich übersprungen", () => {
  it("meldet das fehlende Zielbild, statt eine Prüfung vorzutäuschen", () => {
    expect(existsSync(ZIELBILD), `Zielbild nicht lesbar: ${ZIELBILD}`).toBe(false);
  });
});
