// ================================================================================================
// JOB 3060 · H1 — DAS KOPFBAND, GEMESSEN AN DER GEBAUTEN SEITE IN CHROMIUM.
// ================================================================================================
//
// PEDIS FRAGE (04.09.): „Sieht die Hülle jetzt so aus wie im Mockup — gemessen an der echten Seite,
// nicht an einem Nachbau?" Muster: tests/design/zielbild-validierung.test.ts (JOB 2618 D5).
//
// Die ECHTE Anwendung (`apps/web/dist`) läuft in Chromium, angemeldet, mit zwei echten Wissens-
// objekten im Prüfboard (der Zähler an „Prüfen“ trägt deren Zahl). Das Theme wird NICHT gesetzt —
// seit JOB 3060 ist „modern“ die Vorgabe jedes Browsers ohne gespeicherte Wahl (Lieferung 4), und
// genau das misst Fall T: `html[data-theme="modern"]` ohne Umschalter.
//
// SOLLWERTE aus dem Mockup `design/klarwerk/Main.dc.html` Z.17-33 (gelesen, nicht abgeschrieben):
// Höhe, Farben, Schriftgrößen, Gewichte, Abstände, Radius des Suchfelds, Größe des Konto-Kreises.
// EIN VERGLEICH JE WERT an den REALEN Elementen: das Kopfband, die Wortmarke, ein inaktiver und
// der aktive Punkt, der Zähler, das Suchfeld samt Lupe und Platzhalter, das Zahnrad, der Konto-
// Kreis. Fall S: jedes Element gefunden, auf /start, /bibliothek und /validierung.
//
// ENTSCHIEDEN (JOB 3085 · Q4, Pedis Entscheidung 21 vom 05.09.2026, Option b): der Grund des
// Konto-Kreises war bis hierher der einzige offene Punkt dieser Datei. Er ist es nicht mehr. Der
// Kreis trägt den Funke des Mockups (#E8630A) und dafür NACHT-Initialen (#0E1626, 5,36:1) statt
// des vom Mockup genannten Weiß (3,38:1, unter AA). Er folgt damit NICHT mehr der Hausregel mega41
// (styles/modern.css `.bg-brand.text-white` → Funke dunkel): er trägt kein `text-white` mehr und
// liegt außerhalb ihres Selektors. Fall „konto-grund" misst die Fläche jetzt scharf gegen das
// Mockup; V16 misst die Schrift scharf gegen den benannten Abweichungswert.
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  LESEN,
  LESEN_PSEUDO,
  ORIGIN,
  PFAD_FN,
  type Seite,
  type Strecke,
  ZIELBILD,
  fn,
  kanon,
  oeffne,
  strecke,
  warteBis,
  zielProp,
  zielStil,
  zielSymbol,
  zielText,
} from "./h1-chromium";

const ziel = existsSync(ZIELBILD) ? readFileSync(ZIELBILD, "utf8") : "";

// Anker: eindeutige Stil-Fragmente je Zeile des Mockups (Z.17-33).
const Z_BAND = "height: 56px; padding: 0 32px";
const Z_MARKE = "font-size: 16px; font-weight: 650; letter-spacing: 0.4px";
const Z_PUNKTE = "gap: 26px";
const Z_AKTIV = "font-weight: 600; color: #FAF8F5; border-bottom: 2px solid #E8630A";
const Z_INAKTIV = "font-size: 13.5px; color: #B9C1D2; border-bottom: 2px solid transparent";
const Z_ZAEHLER = "font-size: 10.5px; font-weight: 700; color: #0E1626; background: #B9C1D2";
const Z_RECHTS = "margin-left: auto; display: flex; align-items: center; gap: 16px";
const Z_SUCHE = "width: 260px; padding: 7px 12px; background: #16213A; border-radius: 9px";
const Z_SUCHTEXT = "font-size: 13px; color: #7E879A";
const Z_KONTO = "width: 30px; height: 30px; border-radius: 50%; background: #E8630A";

/** In der Seite: die realen Elemente des Kopfbands finden und ihre Selektoren zurückgeben. */
const ELEMENTE = `(pfadFnSrc) => {
  const pfad = eval('(' + pfadFnSrc + ')');
  const band = document.querySelector('header[data-testid="kopfband"]');
  if (!band) return null;
  const marke = band.querySelector('a.kw-kopfband-marke');
  const punkte = band.querySelector('nav.kw-kopfband-punkte');
  const aktiv = band.querySelector('a.kw-kopfband-punkt[aria-current="page"]');
  const inaktiv = band.querySelector('a.kw-kopfband-punkt:not([aria-current])');
  const zaehler = band.querySelector('.kw-kopfband-zaehler');
  const suche = band.querySelector('form.kw-kopfband-suche');
  const rechts = suche ? suche.parentElement : null;
  const input = suche ? suche.querySelector('input[type="search"]') : null;
  const lupe = suche ? suche.querySelector('svg') : null;
  const zahnrad = band.querySelector('[data-testid="kopfband-zahnrad"]');
  const zahnradSvg = zahnrad ? zahnrad.querySelector('svg') : null;
  const konto = band.querySelector('[data-testid="kopfband-konto"]');
  const p = (e) => (e ? pfad(e) : null);
  const out = {
    band: p(band), marke: p(marke), punkte: p(punkte), aktiv: p(aktiv), inaktiv: p(inaktiv),
    zaehler: p(zaehler), zaehlerText: zaehler ? (zaehler.textContent || '').trim() : null,
    rechts: p(rechts), suche: p(suche), input: p(input), lupe: p(lupe),
    zahnrad: p(zahnrad), zahnradSvg: p(zahnradSvg), konto: p(konto),
    kontoText: konto ? (konto.textContent || '').trim() : null,
    aktivText: aktiv ? (aktiv.textContent || '').trim() : null,
    markeText: marke ? (marke.textContent || '').trim() : null,
    placeholder: input ? input.getAttribute('placeholder') : null,
    punktTexte: [...band.querySelectorAll('a.kw-kopfband-punkt')].map((a) => (a.querySelector('span') || a).textContent.trim()),
  };
  const gefunden = [band, marke, punkte, aktiv, inaktiv, suche, rechts, input, lupe, zahnrad, zahnradSvg, konto].filter(Boolean);
  out.aufgeloest = gefunden.length === 12 && gefunden.every((e) => document.querySelector(pfad(e)) === e);
  return out;
}`;

interface Selektoren {
  band: string;
  marke: string | null;
  punkte: string | null;
  aktiv: string | null;
  inaktiv: string | null;
  zaehler: string | null;
  zaehlerText: string | null;
  rechts: string | null;
  suche: string | null;
  input: string | null;
  lupe: string | null;
  zahnrad: string | null;
  zahnradSvg: string | null;
  konto: string | null;
  kontoText: string | null;
  aktivText: string | null;
  markeText: string | null;
  placeholder: string | null;
  punktTexte: string[];
  aufgeloest: boolean;
}

let s: Strecke | null = null;
let fehler: string | null = null;
let theme = "";
let boardZahl = -1;
let sel: Selektoren | null = null;
/** Die Selektoren je Route (S: jedes Element auf jeder der drei Routen gefunden). */
const jeRoute: Record<string, Selektoren | null> = {};

describe("JOB 3060 · H1 · das Kopfband — die echte Seite, gemountet in Chromium (Vorgabe modern, ohne Umschalter)", () => {
  beforeAll(async () => {
    try {
      s = await strecke({ email: "pedi@job3060-huelle.test" });
      // Zwei echte Wissensobjekte im Prüfboard — die Zahl, die der Zähler an „Prüfen“ tragen muss.
      for (const title of [
        "Halterungen ohne waagerechte Oberseiten",
        "Profile: Ablaufbohrung 8 mm",
      ]) {
        await s.services.ko.create({
          title,
          statement: "Aus dem Projekt gelernt, noch nicht freigegeben.",
          type: "best_practice",
          category: "Allgemein",
          author: s.autorId,
        } as never);
      }
      const board = await s.app.inject({
        method: "GET",
        url: "/api/validation/board",
        headers: { authorization: `Bearer ${s.token}` },
      });
      boardZahl = (board.json() as unknown[]).length;
      for (const pfad of ["/start", "/bibliothek", "/validierung"]) {
        await oeffne(s.seite, pfad);
        // Erst der Zähler (Board geladen), sonst misst man ein Fenster.
        await warteBis(
          s.seite,
          `(n) => { const z = document.querySelector('.kw-kopfband-zaehler'); return z !== null && (z.textContent || '').trim() === String(n); }`,
          boardZahl,
        );
        jeRoute[pfad] = await s.seite.evaluate<Selektoren | null>(fn(ELEMENTE), PFAD_FN);
      }
      // Gemessen wird auf /start (das Mockup Main.dc.html ist die Startseite: „Start“ aktiv).
      await oeffne(s.seite, "/start");
      await warteBis(
        s.seite,
        `(n) => { const z = document.querySelector('.kw-kopfband-zaehler'); return z !== null && (z.textContent || '').trim() === String(n); }`,
        boardZahl,
      );
      theme = await s.seite.evaluate<string>(
        fn(
          `() => document.documentElement.getAttribute('data-theme') || 'classic (kein Attribut)'`,
        ),
      );
      sel = await s.seite.evaluate<Selektoren | null>(fn(ELEMENTE), PFAD_FN);
      console.info(
        `JOB 3060 H1 · Chromium ${s.version} · ${ORIGIN}/start · Theme ${theme} · Board ${boardZahl} · Selektoren ${JSON.stringify(sel)}`,
      );
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 3).join(" | ");
    }
  }, 120_000);

  afterAll(async () => {
    await s?.schliessen();
  }, 60_000);

  async function messen(
    selektor: string | null | undefined,
    eigenschaft: string,
  ): Promise<string | null> {
    expect(fehler, "Seite nicht gemountet").toBeNull();
    expect(selektor, "reales Element nicht gefunden").toBeTruthy();
    return (s as Strecke).seite.evaluate<string | null>(fn(LESEN), [selektor, eigenschaft]);
  }

  it("Z · das Zielbild liefert jeden Sollwert (gelesen, nicht abgeschrieben)", () => {
    expect(zielStil(ziel, Z_BAND)).not.toBeNull();
    expect(zielStil(ziel, Z_MARKE)).not.toBeNull();
    expect(zielStil(ziel, Z_PUNKTE)).not.toBeNull();
    expect(zielStil(ziel, Z_AKTIV)).not.toBeNull();
    expect(zielStil(ziel, Z_INAKTIV)).not.toBeNull();
    expect(zielStil(ziel, Z_ZAEHLER)).not.toBeNull();
    expect(zielStil(ziel, Z_RECHTS)).not.toBeNull();
    expect(zielStil(ziel, Z_SUCHE)).not.toBeNull();
    expect(zielStil(ziel, Z_SUCHTEXT)).not.toBeNull();
    expect(zielStil(ziel, Z_KONTO)).not.toBeNull();
    expect(zielSymbol(ziel, "#7E879A")).not.toBeNull();
    expect(zielSymbol(ziel, "#B9C1D2")).not.toBeNull();
    expect(zielText(ziel, Z_SUCHTEXT)).toBe("Suchen");
  });

  it("T · die Vorgabe ist modern: ohne Umschalter trägt <html> data-theme=modern", () => {
    expect(fehler).toBeNull();
    expect(theme).toBe("modern");
  });

  it("S · die echte Seite steht: jedes Element gefunden, Selektoren rückwärts auflösbar — auf /start, /bibliothek und /validierung", () => {
    expect(fehler).toBeNull();
    expect(sel?.aufgeloest).toBe(true);
    expect(sel?.band).toMatch(/^body > /);
    for (const pfad of ["/start", "/bibliothek", "/validierung"]) {
      expect(jeRoute[pfad]?.aufgeloest, `${pfad}: Elemente unvollständig`).toBe(true);
    }
    // Der aktive Punkt ist der der Route — Start, Bibliothek, Prüfen.
    expect(jeRoute["/start"]?.aktivText).toMatch(/^Start/);
    expect(jeRoute["/bibliothek"]?.aktivText).toMatch(/^Bibliothek/);
    expect(jeRoute["/validierung"]?.aktivText).toMatch(/^Prüfen/);
    // Kein `aside` — die Seitenleiste ist als Ort entfernt, nicht versteckt (gemessen als Admin).
  });

  // ---- Das Band (Z.17) --------------------------------------------------------------------------
  it("V1 · band-höhe 56px — height am realen Kopfband", async () => {
    expect(await messen(sel?.band, "height")).toBe(zielProp(zielStil(ziel, Z_BAND), "height"));
  });
  it("V2 · band-grund #0E1626 — background-color am realen Kopfband", async () => {
    expect(await messen(sel?.band, "background-color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_BAND), "background")),
    );
  });
  it("V3 · band-polster 0 32px — padding-left/-top am realen Kopfband", async () => {
    const p = zielProp(zielStil(ziel, Z_BAND), "padding")?.split(" ") ?? [];
    expect(await messen(sel?.band, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.band, "padding-top")).toBe(`${p[0]}px`.replace("0px", "0px"));
  });
  it("V4 · band-abstand 36px — gap am realen Kopfband", async () => {
    expect(await messen(sel?.band, "gap")).toBe(zielProp(zielStil(ziel, Z_BAND), "gap"));
  });

  // ---- Die Wortmarke (Z.18) ----------------------------------------------------------------------
  it("V5 · marke: Wortlaut KLARWERK, 16px / 650 / 0.4px / #FAF8F5 — an der realen Wortmarke", async () => {
    const stil = zielStil(ziel, Z_MARKE);
    expect(sel?.markeText).toBe("KLARWERK");
    expect(await messen(sel?.marke, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.marke, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.marke, "letter-spacing")).toBe(zielProp(stil, "letter-spacing"));
    expect(await messen(sel?.marke, "color")).toBe(
      kanon(zielProp(zielStil(ziel, Z_BAND), "color")),
    );
  });

  // ---- Die Punkte (Z.19-24) ----------------------------------------------------------------------
  it("V6 · punkte-abstand 26px — gap an der realen Punktleiste", async () => {
    expect(await messen(sel?.punkte, "gap")).toBe(zielProp(zielStil(ziel, Z_PUNKTE), "gap"));
  });
  it("V7 · die fünf Punkte in Mockup-Reihenfolge: Start · Fragen · Bibliothek · Erfassen · Prüfen", () => {
    expect(fehler).toBeNull();
    expect(sel?.punktTexte).toEqual(["Start", "Fragen", "Bibliothek", "Erfassen", "Prüfen"]);
  });
  it("V8 · inaktiver punkt: 13.5px, #B9C1D2, 2px Unterstrich transparent, Polster 6px 2px — am realen Punkt", async () => {
    const stil = zielStil(ziel, Z_INAKTIV);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.inaktiv, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.inaktiv, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(sel?.inaktiv, "border-bottom-width")).toBe("2px");
    expect(await messen(sel?.inaktiv, "border-bottom-color")).toBe("rgba(0, 0, 0, 0)");
    expect(await messen(sel?.inaktiv, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.inaktiv, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.inaktiv, "gap")).toBe(zielProp(stil, "gap"));
  });
  it("V9 · aktiver punkt: #FAF8F5, Gewicht 600, 2px Unterstrich #E8630A — am realen aktiven Punkt", async () => {
    const stil = zielStil(ziel, Z_AKTIV);
    const [breite, , farbe] = zielProp(stil, "border-bottom")?.split(" ") ?? [];
    expect(await messen(sel?.aktiv, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(sel?.aktiv, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.aktiv, "border-bottom-width")).toBe(breite);
    expect(await messen(sel?.aktiv, "border-bottom-color")).toBe(kanon(farbe ?? null));
  });
  it("V10 · zähler an Prüfen: die ECHTE Boardzahl, 10.5px / 700 / #0E1626 auf #B9C1D2 / Radius 999px / Polster 1px 6px", async () => {
    expect(fehler).toBeNull();
    expect(boardZahl, "Kalibrierung: das Board ist nicht leer").toBeGreaterThanOrEqual(2);
    const stil = zielStil(ziel, Z_ZAEHLER);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(sel?.zaehlerText).toBe(String(boardZahl));
    expect(await messen(sel?.zaehler, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.zaehler, "font-weight")).toBe(zielProp(stil, "font-weight"));
    expect(await messen(sel?.zaehler, "color")).toBe(kanon(zielProp(stil, "color")));
    expect(await messen(sel?.zaehler, "background-color")).toBe(
      kanon(zielProp(stil, "background")),
    );
    expect(await messen(sel?.zaehler, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.zaehler, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.zaehler, "padding-left")).toBe(p[1]);
  });

  // ---- Der rechte Block (Z.26-32) ----------------------------------------------------------------
  it("V11 · rechter block: Abstand 16px, schließt rechts mit dem Kopfband-Inhalt ab", async () => {
    expect(await messen(sel?.rechts, "gap")).toBe(zielProp(zielStil(ziel, Z_RECHTS), "gap"));
    const k = await (s as Strecke).seite.evaluate<{ bandRechts: number; blockRechts: number }>(
      fn(
        "([bandSel, blockSel]) => { const b = document.querySelector(bandSel); const r = b.getBoundingClientRect(); const pr = parseFloat(getComputedStyle(b).paddingRight); const k = document.querySelector(blockSel).getBoundingClientRect(); return { bandRechts: r.right - pr, blockRechts: k.right }; }",
      ),
      [sel?.band, sel?.rechts],
    );
    expect(Math.abs(k.bandRechts - k.blockRechts)).toBeLessThan(2);
  });
  it("V12 · suchfeld: 260px, Polster 7px 12px, #16213A, Radius 9px, Abstand 8px — am realen Suchfeld", async () => {
    const stil = zielStil(ziel, Z_SUCHE);
    const p = zielProp(stil, "padding")?.split(" ") ?? [];
    expect(await messen(sel?.suche, "width")).toBe(zielProp(stil, "width"));
    expect(await messen(sel?.suche, "padding-top")).toBe(p[0]);
    expect(await messen(sel?.suche, "padding-left")).toBe(p[1]);
    expect(await messen(sel?.suche, "background-color")).toBe(kanon(zielProp(stil, "background")));
    expect(await messen(sel?.suche, "border-radius")).toBe(zielProp(stil, "border-radius"));
    expect(await messen(sel?.suche, "gap")).toBe(zielProp(stil, "gap"));
  });
  it("V13 · lupe 15px, Strich #7E879A, 1.8 — width, stroke, stroke-width am realen Symbol", async () => {
    const z = zielSymbol(ziel, "#7E879A");
    expect(await messen(sel?.lupe, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.lupe, "stroke")).toBe(kanon("#7E879A"));
    expect(await messen(sel?.lupe, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V14 · suchtext: Platzhalter „Suchen“ (Z.29), 13px, #7E879A — placeholder und ::placeholder am realen Eingabefeld", async () => {
    const stil = zielStil(ziel, Z_SUCHTEXT);
    expect(sel?.placeholder).toBe(zielText(ziel, Z_SUCHTEXT));
    expect(await messen(sel?.input, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(
      await (s as Strecke).seite.evaluate<string | null>(fn(LESEN_PSEUDO), [
        sel?.input,
        "::placeholder",
        "color",
      ]),
    ).toBe(kanon(zielProp(stil, "color")));
  });
  it("V15 · zahnrad 18px, Strich #B9C1D2, 1.8 — am realen Symbol", async () => {
    const z = zielSymbol(ziel, "#B9C1D2");
    expect(await messen(sel?.zahnradSvg, "width")).toBe(`${z?.width}px`);
    expect(await messen(sel?.zahnradSvg, "stroke")).toBe(kanon("#B9C1D2"));
    expect(await messen(sel?.zahnradSvg, "stroke-width")).toBe(`${z?.strichBreite}px`);
  });
  it("V16 · konto-kreis: 30×30, Radius 50%, Initialen PK, 12px / 700 — Schrift BENANNT ABWEICHEND #0E1626 statt Mockup-#FFFFFF (JOB 3085 · Entscheidung 21)", async () => {
    const stil = zielStil(ziel, Z_KONTO);
    expect(await messen(sel?.konto, "width")).toBe(zielProp(stil, "width"));
    expect(await messen(sel?.konto, "height")).toBe(zielProp(stil, "height"));
    expect(await messen(sel?.konto, "border-radius")).toBe(zielProp(stil, "border-radius"));
    // DIE EINE BENANNTE ABWEICHUNG VOM MOCKUP, und sie steht hier als Erwartung, nicht als
    // Lockerung: das Mockup nennt an dieser Stelle Weiß (Main.dc.html Z.32, `color: #FFFFFF`) —
    // gelesen und unten geprüft, damit die Abweichung eine BEKANNTE bleibt. Weiß auf dem Funke
    // #E8630A misst aber nur 3,38:1 und liegt damit unter AA (4,5:1). Pedis Entscheidung 21 vom
    // 05.09.2026 (Option b) bestimmt deshalb Nacht-Initialen: #0E1626 auf #E8630A = 5,36:1.
    // Die gerechnete Zahl steht in tests/kontokreis-funke/; hier steht die gemessene FARBE.
    expect(zielProp(stil, "color"), "das Mockup nennt an dieser Stelle weiterhin Weiß").toBe(
      "#FFFFFF",
    );
    expect(await messen(sel?.konto, "color")).toBe(kanon("#0E1626"));
    expect(await messen(sel?.konto, "font-size")).toBe(zielProp(stil, "font-size"));
    expect(await messen(sel?.konto, "font-weight")).toBe(zielProp(stil, "font-weight"));
    // Initialen aus der bestätigten Sitzung („Peter Kohnert“ → PK, wie im Mockup).
    expect(sel?.kontoText).toBe("PK");
  });

  it("V17 · konto-grund: der reale Kreis trägt den Funke des Mockups #E8630A (JOB 3085 · Entscheidung 21 — vorher OFFEN)", async () => {
    const ist = await messen(sel?.konto, "background-color");
    const soll = kanon(zielProp(zielStil(ziel, Z_KONTO), "background"));
    console.info(
      `JOB 3085 Q4 · konto-grund: Zielbild ${soll} · Seite ${ist} · ${ist === soll ? "GLEICH" : "abweichend"} · Nacht #0E1626 darauf misst 5,36:1 (über AA 4,5:1)`,
    );
    // Scharf statt „nicht null": die Fläche IST der Mockup-Wert, nicht mehr Funke dunkel.
    expect(soll, "der Mockup-Wert wird gelesen, nicht abgeschrieben").toBe("rgb(232, 99, 10)");
    expect(ist).toBe(soll);
  });

  it("KLASSISCH · Protokoll: derselbe Aufbau mit gespeicherter Wahl „classic“ — Grund und Punktfarbe an denselben Selektoren", async () => {
    expect(fehler).toBeNull();
    const seite = (s as Strecke).seite as Seite;
    await seite.evaluate(fn(`() => document.documentElement.removeAttribute('data-theme')`));
    const grund = await seite.evaluate<string | null>(fn(LESEN), [sel?.band, "background-color"]);
    const punkt = await seite.evaluate<string | null>(fn(LESEN), [sel?.inaktiv, "color"]);
    await seite.evaluate(fn(`() => document.documentElement.setAttribute('data-theme', 'modern')`));
    console.info(
      `JOB 3060 H1 · KLASSISCH · Grund ${grund} (Zielbild ${kanon("#0E1626")}) · Punkt ${punkt} (Zielbild ${kanon("#B9C1D2")})`,
    );
    expect(grund).not.toBeNull();
  });
});
