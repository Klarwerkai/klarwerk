// ================================================================================================
// JOB 3591 · B — DIE ANMELDEMASKE MIT FIRMEN-CI, IN CHROMIUM WIRKLICH GEMESSEN.
// ================================================================================================
//
// Die Anmeldemaske ist bei der Vorführung die ERSTE Fläche, die ein Gast sieht. Seit JOB 3577 trägt
// sie die Firmen-CI mit — belegt war das aber nur in jsdom
// (`anmeldemaske-marke-mounted.test.tsx`), und jsdom rechnet keine Geometrie. Jene zwölf Fälle
// M0–M9 messen Anwesenheit, Alternativtext, Abrufverhalten und Umschalten ohne Neuladen; KEINE
// einzige Länge, keine einzige Position. Sie werden hier NICHT abgelöst — das sind zwei
// verschiedene Aussagen. Diese Datei misst, was nur ein echter Browser weiss: Plattenhöhe,
// Seitenverhältnis des Kundenlogos, Kanten und die Schwelle zwischen den beiden Bauformen.
//
//   L1   Die Bühnenfrage      Warum diese Datei eine EIGENE Bühne braucht — an `h6-chromium`
//                             gemessen, nicht angenommen.
//   B1   Marke AUS            Die Bezugsmessung bei 1280 und 390 px.
//   B2   Marke AN             Platte, Grössenverhältnis, kein Überstand, kein Umbruch — dieselben
//                             zwei Breiten, damit jede Zahl der Marke zugeordnet werden kann.
//   B3   Die Schwelle         1023 und 1025 px: nie beide Bauformen, nie keine.
//
// SICHTBARKEIT WIRD GERECHNET, NICHT AUS `display` GESCHLOSSEN (Runde 3, Korrekturpflicht BEN).
// Die erste Fassung leitete „steht da" aus `display !== none` und einer Rechteckgrösse > 0 ab. BEN
// hat sie damit widerlegt: ein `invisible` an `BrandPanel.tsx:114` macht die Spalte bei 1025 px
// `display:flex`, 512,5 × 844 px — und unsichtbar; alle dreizehn Fälle blieben grün. Jede
// Sichtbarkeitszusage dieser Datei läuft jetzt über `gemalt` (siehe MESSE), das `visibility` (vererbt)
// und `opacity` über die Vorfahrenkette mitrechnet. Und die Produktidentität hängt nicht mehr am
// `textContent` des Umschlags, sondern am Blattknoten, der das Wort wirklich trägt.
//
// DER MARKENSTAND KOMMT ÜBER DIE GANZE KETTE: `PUT /api/admin/branding` mit dem Admin-Bearer →
// Ablage → `GET /api/branding` (öffentlich) → `lib/brandTheme.ts` → `BrandPanel`. Kein Zugriff in
// die Seite hinein (s. `gast-buehne.ts`, `setzeMarke`).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { beende, fn as h6Fn, starte } from "../design/h6-chromium";
import baueFrisch from "../review26-pruefen-schmal/bau";
import {
  type GastSeite,
  type GastStand,
  beendeGast,
  fn,
  setzeMarke,
  starteGast,
  verstelleFenster,
} from "./gast-buehne";

const PANEL = '[data-testid="auth-brand-panel"]';
const COMPACT = '[data-testid="auth-brand-compact"]';
const FIRMENLOGO = '[data-testid="auth-firmenlogo"]';

/** Das Seitenverhältnis der Originaldatei — `viewBox="0 0 173.1 39.19"`, sonst nichts. */
const LOGO_SEITENVERHAELTNIS = 173.1 / 39.19;
/**
 * Die Platten sind `h-9` (Tailwind: 2,25 rem). Die Wurzelschrift ist 16 px, also 36 px — die Zusage
 * aus `BrandPanel.tsx:44-48`, dass beide Platten GLEICH hoch sind.
 */
const PLATTE_HOEHE = 36;
/** Das Bild ist `h-6` (1,5 rem = 24 px). */
const BILD_HOEHE = 24;
/** Weiss, wie `getComputedStyle` es serialisiert. */
const WEISS = "rgb(255, 255, 255)";

interface Rechteck {
  x: number;
  y: number;
  breite: number;
  hoehe: number;
  rechts: number;
  mitteY: number;
  /** Der BERECHNETE Wert am Element — `visibility` ist vererbt, trägt also die Vorfahren mit. */
  visibility: string;
  opacity: number;
  /** Wirksame Sichtbarkeit, siehe `GEMALT` im Messprogramm. */
  gemalt: boolean;
}
interface Sichtbarkeit {
  da: boolean;
  display: string;
  visibility: string;
  opacity: number;
  gemalt: boolean;
  breite: number;
  hoehe: number;
}
interface Messung {
  innerWidth: number;
  theme: string;
  /** Firmenlogos im GANZEN Dokument — beide Bauformen zusammen (B1 verlangt 0). */
  firmenlogoZahl: number;
  /** Die Wortmarke-Gruppe (`BrandPanel.tsx:65`) innerhalb der SICHTBAREN Bauform. */
  gruppe: Rechteck | null;
  kinderZahl: number;
  zeichen: Rechteck | null;
  zeichenBg: string | null;
  text: Rechteck | null;
  firmen: Rechteck | null;
  firmenBg: string | null;
  bild: Rechteck | null;
  bildGeladen: boolean;
  naturBreite: number;
  naturHoehe: number;
  panel: Sichtbarkeit;
  compact: Sichtbarkeit;
  /** Steht das Wort im Textinhalt der Bauform? (sagt NICHTS darüber, ob man es sieht) */
  klarwerk: boolean;
  reasoning: boolean;
  /** Der Blattknoten, der das Wort wirklich trägt — daran hängt die Sichtbarkeitszusage. */
  klarwerkWort: Rechteck | null;
  reasoningWort: Rechteck | null;
}

/**
 * EINE Auswertung in der Seite je Breite — nicht ein Dutzend Einzelabfragen.
 *
 * `wurzel` ist die Bauform, die bei dieser Breite WIRKLICH sichtbar ist. Das ist keine Feinheit:
 * bei aktiver Marke stehen ZWEI Elemente mit `auth-firmenlogo` im Baum (Spalte und schmaler Anker,
 * eines davon `display:none`). Ein unskopiertes `querySelector` träfe das falsche und misste
 * Rechtecke der Grösse 0.
 */
const MESSE = `(wurzel) => {
  // ----------------------------------------------------------------------------------------------
  // WIRKSAME SICHTBARKEIT — nicht aus \`display\` und Rechteckgrösse allein abgeleitet.
  //
  // Die erste Fassung dieser Datei tat genau das, und BEN hat sie in Runde 2 damit widerlegt: ein
  // einziges zusätzliches \`invisible\` an \`BrandPanel.tsx:114\` liess die Spalte bei 1025 px
  // \`display:flex\` und 512,5 × 844 px melden, während der Gast NICHTS sah — alle dreizehn Fälle
  // blieben grün. Eine Zusage „nie keins", die bei einer unsichtbaren Fläche hält, ist keine.
  //
  // Gemalt heisst hier: das Element belegt Fläche UND wird tatsächlich gezeichnet.
  //   · Rechteck 0 × 0        — deckt \`display:none\` an ihm selbst und an JEDEM Vorfahren ab.
  //   · \`visibility\`         — eine VERERBTE Eigenschaft: steht sie an einem Vorfahren auf
  //                             \`hidden\`, meldet \`getComputedStyle\` sie auch am Kind so. Ein
  //                             Blick auf das Element genügt deshalb für die ganze Kette.
  //   · \`opacity\`            — NICHT vererbt, sondern zusammengesetzt. Ein \`opacity:0\` an einem
  //                             Vorfahren lässt das Kind unverändert \`1\` melden; deshalb läuft
  //                             diese eine Eigenschaft die Vorfahrenkette hoch.
  // Nicht abgedeckt und hier auch nicht behauptet: Verdeckung durch ein darüberliegendes Element,
  // \`clip-path\`, Abschieben aus dem Sichtfenster. Für die vier Zusagen dieser Datei (Höhe,
  // Seitenverhältnis, Kanten, Bauformwahl) ist keine davon der Weg, auf dem etwas verschwindet.
  // ----------------------------------------------------------------------------------------------
  const gemalt = (el) => {
    if (!el) return false;
    const b = el.getBoundingClientRect();
    if (b.width <= 0 || b.height <= 0) return false;
    if (getComputedStyle(el).visibility !== "visible") return false;
    for (let a = el; a !== null; a = a.parentElement) {
      if (Number(getComputedStyle(a).opacity) === 0) return false;
    }
    return true;
  };
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      x: b.x, y: b.y, breite: b.width, hoehe: b.height, rechts: b.right, mitteY: b.y + b.height / 2,
      visibility: s.visibility, opacity: Number(s.opacity), gemalt: gemalt(el),
    };
  };
  const sicht = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return { da: false, display: "—", visibility: "—", opacity: 0, gemalt: false, breite: 0, hoehe: 0 };
    const b = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return {
      da: true, display: s.display, visibility: s.visibility, opacity: Number(s.opacity),
      gemalt: gemalt(e), breite: b.width, hoehe: b.height,
    };
  };
  /**
   * Der BLATT-Knoten, der genau dieses Wort trägt — nicht sein Umschlag.
   * An ihm hängt die Produktidentität: \`textContent\` am Umschlag bliebe auch dann wahr, wenn der
   * Schriftzug selbst unsichtbar gestellt wäre.
   */
  const wortknoten = (box, wort) => {
    if (!box) return null;
    const alle = Array.prototype.slice.call(box.querySelectorAll("*"));
    for (const e of alle) {
      if (e.children.length === 0 && (e.textContent || "").trim() === wort) return e;
    }
    return null;
  };
  const box = document.querySelector(wurzel);
  const gruppe = box ? box.querySelector(":scope > span") : null;
  const kinder = gruppe ? Array.prototype.slice.call(gruppe.children) : [];
  const firmen = box ? box.querySelector('[data-testid="auth-firmenlogo"]') : null;
  const bild = firmen ? firmen.querySelector("img") : null;
  return {
    innerWidth: window.innerWidth,
    theme: document.documentElement.getAttribute("data-theme") || "classic (kein Attribut)",
    firmenlogoZahl: document.querySelectorAll('[data-testid="auth-firmenlogo"]').length,
    gruppe: r(gruppe),
    kinderZahl: kinder.length,
    zeichen: r(kinder[0] || null),
    zeichenBg: kinder[0] ? getComputedStyle(kinder[0]).backgroundColor : null,
    text: r(kinder[1] || null),
    firmen: r(firmen),
    firmenBg: firmen ? getComputedStyle(firmen).backgroundColor : null,
    bild: r(bild),
    bildGeladen: bild ? bild.complete && bild.naturalWidth > 0 : false,
    naturBreite: bild ? bild.naturalWidth : 0,
    naturHoehe: bild ? bild.naturalHeight : 0,
    panel: sicht('[data-testid="auth-brand-panel"]'),
    compact: sicht('[data-testid="auth-brand-compact"]'),
    klarwerk: box ? box.textContent.indexOf("KLARWERK") >= 0 : false,
    reasoning: box ? box.textContent.indexOf("Reasoning System") >= 0 : false,
    klarwerkWort: r(wortknoten(box, "KLARWERK")),
    reasoningWort: r(wortknoten(box, "Reasoning System")),
  };
}`;

let stand: GastStand;

function seite(): GastSeite {
  expect(stand.fehler, "Gast-Bühne kam nicht hoch").toBeNull();
  return stand.seite as GastSeite;
}

/** Die bei dieser Breite sichtbare Bauform — unterhalb 1024 px der schmale Anker, darüber die Spalte. */
const bauform = (breite: number): string => (breite < 1024 ? COMPACT : PANEL);

async function miss(breite: number, hoehe: number, marke: string): Promise<Messung> {
  await verstelleFenster(stand, breite, hoehe);
  const m = await seite().evaluate<Messung>(fn(MESSE), bauform(breite));
  expect(m.innerWidth, "das Fenster steht nicht auf der verlangten Breite").toBe(breite);
  console.log(`JOB 3591 · Marke ${marke} · ${breite}×${hoehe} · ${JSON.stringify(m)}`);
  return m;
}

/**
 * Der eine Satz, den jede Zusage dieser Datei über Sichtbarkeit spricht.
 *
 * Bewusst mit ausgeschriebenem Befund in der Meldung: kippt eine Zusage, soll in der Ausgabe stehen,
 * WARUM nichts zu sehen ist (Grösse null, `visibility:hidden`, durchsichtiger Vorfahr) — nicht bloss
 * „expected false to be true".
 */
function mussGemaltSein(k: Rechteck | null, wo: string, was: string): void {
  expect(k, `${wo}: ${was} steht gar nicht im Baum`).not.toBeNull();
  const e = k as Rechteck;
  expect(
    e.gemalt,
    // „am Element selbst" ist wörtlich zu nehmen: G8 (`opacity-0` an der Spalte) meldet an diesem
    // Blattknoten `visibility:visible` und `opacity 1` und ist trotzdem unsichtbar — der Grund liegt
    // dann bei einem Vorfahren, den `gemalt` mitrechnet, die zwei Zahlen hier aber nicht zeigen.
    `${wo}: ${was} steht im Baum, wird aber nicht gemalt — ${e.breite.toFixed(1)}×${e.hoehe.toFixed(1)} px, am Element selbst visibility:${e.visibility} und opacity ${e.opacity} (ein durchsichtiger oder verborgener VORFAHR zählt mit)`,
  ).toBe(true);
}

/**
 * Die Grundzusage, die in JEDEM Zustand gilt (`BrandPanel.tsx:26-28`, Pedis Auflage).
 *
 * ZWEI STUFEN, seit Runde 3: das Wort muss im Textinhalt stehen UND sein Blattknoten muss wirklich
 * gemalt werden. Die erste Stufe allein war ein Scheinbeleg — `textContent` bleibt wahr, während der
 * Schriftzug unsichtbar gestellt ist (BEN, Runde 2).
 */
function produktidentitaet(m: Messung, wo: string): void {
  expect(m.klarwerk, `${wo}: KLARWERK fehlt`).toBe(true);
  expect(m.reasoning, `${wo}: „Reasoning System" fehlt`).toBe(true);
  mussGemaltSein(m.klarwerkWort, wo, "der Schriftzug KLARWERK");
  mussGemaltSein(m.reasoningWort, wo, 'der Untertitel „Reasoning System"');
}

/** Die weisse Platte des KLARWERK-Zeichens — 36 × 36 px und wirklich zu sehen. */
function zeichenplatte(m: Messung, wo: string): void {
  expect(m.zeichen, `${wo}: die Platte des KLARWERK-Zeichens fehlt`).not.toBeNull();
  const z = m.zeichen as Rechteck;
  expect(Math.round(z.breite), `${wo}: Breite der KLARWERK-Platte`).toBe(PLATTE_HOEHE);
  expect(Math.round(z.hoehe), `${wo}: Höhe der KLARWERK-Platte`).toBe(PLATTE_HOEHE);
  expect(m.zeichenBg, `${wo}: die Platte des KLARWERK-Zeichens ist nicht weiss`).toBe(WEISS);
  mussGemaltSein(m.zeichen, wo, "die Platte des KLARWERK-Zeichens");
}

/**
 * Kein Überstand — gemessen an den KINDERN, nicht am Umschlag.
 *
 * DER UMSCHLAG IST DIE FALSCHE KANTE, und das ist an der ersten Messung dieser Datei aufgefallen:
 * die Wortmarke-Gruppe wird als Flex-Element auf ihren Container gedehnt. Bei 390 px mass sie
 * 342 px breit mit rechter Kante 366 — während ihr äusserstes Kind, die Firmenlogo-Platte, schon
 * bei 300 px endet. `gruppe.rechts` beantwortet also die Frage „wo endet die Karte", nicht „wo endet
 * die Wortmarke", und läge in der Rückgabe um 66 px daneben.
 *
 * Gemessen wird deshalb die äusserste Kante ÜBER ALLE Kinder — die Kante, die der Gast wirklich
 * sieht, und die Zahl, die mit dem Befund von JOB 3571 am Kopfband vergleichbar ist (dort ragte es
 * bei 390 px um 20,5 px hinaus). Die Gegenprobe G3 (`gap-2.5` → `gap-32`) belegt, dass diese Zusage
 * wirklich Geometrie misst: gemessene äusserste Kinderkante 430,0 px bei innerWidth 390.
 */
function imFenster(m: Messung, wo: string): void {
  expect(m.gruppe, `${wo}: die Wortmarke-Gruppe fehlt`).not.toBeNull();
  const g = m.gruppe as Rechteck;
  expect(g.breite, `${wo}: die Gruppe hat keine Breite`).toBeGreaterThan(0);
  const kinder = [m.zeichen, m.text, m.firmen].filter((k): k is Rechteck => k !== null);
  expect(kinder.length, `${wo}: die Gruppe hat gar keine gemessenen Kinder`).toBe(m.kinderZahl);
  const aeussersteKante = Math.max(...kinder.map((k) => k.rechts));
  expect(
    aeussersteKante,
    `${wo}: die Wortmarke ragt ${(aeussersteKante - m.innerWidth).toFixed(1)} px rechts aus dem Fenster (äusserste Kinderkante ${aeussersteKante.toFixed(1)} px bei innerWidth ${m.innerWidth})`,
  ).toBeLessThanOrEqual(m.innerWidth);
  expect(
    Math.min(...kinder.map((k) => k.x)),
    `${wo}: die Wortmarke beginnt links ausserhalb des Fensters`,
  ).toBeGreaterThanOrEqual(0);
}

describe("JOB 3591 L1 · die Bühnenfrage — gemessen, nicht angenommen", () => {
  let h6: Awaited<ReturnType<typeof starte>>;

  beforeAll(async () => {
    await baueFrisch();
    // `main` ist der scharfe Unterscheider: es steht AUSSCHLIESSLICH in der `AppShell`
    // (`shell/AppShell.tsx:102,142`); `AuthScreens.tsx` hat kein einziges.
    h6 = await starte("/start", 'main, [data-testid="page-start"]');
  }, 240_000);

  afterAll(async () => {
    await beende(h6);
  });

  it("L1 · der gemeinsame Prüfstand h6-chromium kann die Anmeldemaske NICHT zeigen", async () => {
    expect(h6.fehler, "h6-Bühne kam nicht hoch").toBeNull();
    const befund = await (h6.seite as NonNullable<typeof h6.seite>).evaluate<{
      main: number;
      panel: number;
      compact: number;
    }>(
      h6Fn(`() => ({
        main: document.querySelectorAll("main").length,
        panel: document.querySelectorAll('[data-testid="auth-brand-panel"]').length,
        compact: document.querySelectorAll('[data-testid="auth-brand-compact"]').length,
      })`),
    );
    console.log(`JOB 3591 · L1 an h6-chromium: ${JSON.stringify(befund)}`);
    // Der Bearer aus `h6-chromium.ts:307` liegt auf JEDEM `/api/*`-Aufruf, also auch auf `me`
    // (`app/AuthContext.tsx:99`). `s.user` ist gesetzt, `App.tsx:88-92` rendert die Shell.
    expect(befund.main, "h6 zeigt gar keine angemeldete Hülle — die Messung sagt nichts aus").toBe(
      1,
    );
    expect(
      befund.panel + befund.compact,
      "h6-chromium zeigt doch die Anmeldemaske — dann wäre die eigene Gast-Bühne unnötig",
    ).toBe(0);
  });
});

describe("JOB 3591 B · die Anmeldemaske in Chromium, an zwei Breiten und an der Schwelle", () => {
  beforeAll(async () => {
    await baueFrisch();
    stand = await starteGast("/", COMPACT, 1280, 900);
    expect(stand.fehler, "Gast-Bühne kam nicht hoch").toBeNull();
    console.log(`JOB 3591 · Gast-Bühne: ${stand.version} · Thema ${stand.theme}`);
  }, 240_000);

  afterAll(async () => {
    await beendeGast(stand);
  });

  // ----------------------------------------------------------------------------------------------
  // B1 — die Bezugsmessung OHNE Marke. Ohne sie ist keine Zahl aus B2 der Marke zuzuordnen.
  // ----------------------------------------------------------------------------------------------
  it("B1 · Marke AUS bei 1280 px: kein Firmenlogo, nichts ragt hinaus, die Platte misst 36 × 36", async () => {
    const m = await miss(1280, 900, "AUS");
    expect(m.firmenlogoZahl, "ohne Firmen-CI steht trotzdem ein Firmenlogo im Baum").toBe(0);
    expect(m.panel.display, "die Markenspalte fehlt bei 1280 px").not.toBe("none");
    expect(m.kinderZahl, "die Wortmarke-Gruppe hat ohne Marke zwei Kinder").toBe(2);
    produktidentitaet(m, "B1/1280");
    zeichenplatte(m, "B1/1280");
    imFenster(m, "B1/1280");
  });

  it("B1 · Marke AUS bei 390 px: dasselbe am schmalen Anker", async () => {
    const m = await miss(390, 844, "AUS");
    expect(m.firmenlogoZahl).toBe(0);
    expect(m.compact.display, "der schmale Anker fehlt bei 390 px").not.toBe("none");
    expect(m.kinderZahl).toBe(2);
    produktidentitaet(m, "B1/390");
    zeichenplatte(m, "B1/390");
    imFenster(m, "B1/390");
  });

  // ----------------------------------------------------------------------------------------------
  // B2 — dieselben zwei Breiten MIT Marke. Erst hier wird die Vorführung wirklich abgenommen.
  // ----------------------------------------------------------------------------------------------
  describe("B2 · Marke AN", () => {
    beforeAll(async () => {
      const version = await setzeMarke(stand, { profil: "advisor", aktiv: true }, COMPACT);
      console.log(`JOB 3591 · Firmen-CI gesetzt, Version ${version}`);
      // Ohne geladenes Bild wären Breite und `naturalWidth` beide 0 und jede Zusage darunter leer.
      await seite().waitForFunction(
        fn(`(sel) => {
          const b = document.querySelector(sel + " img");
          return b !== null && b.complete && b.naturalWidth > 0;
        }`),
        FIRMENLOGO,
        { timeout: 15_000 },
      );
    }, 120_000);

    for (const [breite, hoehe] of [
      [1280, 900],
      [390, 844],
    ] as const) {
      const wo = `B2/${breite}`;

      it(`${wo} · Platte: beide Platten sind 36 px hoch, die Firmenplatte ist weiss und trägt das Bild`, async () => {
        const m = await miss(breite, hoehe, "AN");
        expect(m.firmenlogoZahl, "die Firmen-CI ist an, es steht kein Firmenlogo im Baum").toBe(2);
        expect(m.kinderZahl, "die Wortmarke-Gruppe trägt mit Marke drei Kinder").toBe(3);
        produktidentitaet(m, wo);
        zeichenplatte(m, wo);
        expect(m.firmen, `${wo}: die Firmenlogo-Platte fehlt`).not.toBeNull();
        const f = m.firmen as Rechteck;
        const b = m.bild as Rechteck;
        // Die Zusage aus `BrandPanel.tsx:44-48`: „zwei verschiedene Behandlungen nebeneinander
        // sähen zufällig aus" — also GLEICHE Höhe, nicht bloss beide „ungefähr hoch".
        expect(Math.round(f.hoehe), `${wo}: Höhe der Firmenlogo-Platte`).toBe(PLATTE_HOEHE);
        expect(Math.round(f.hoehe), `${wo}: die beiden Platten sind nicht gleich hoch`).toBe(
          Math.round((m.zeichen as Rechteck).hoehe),
        );
        expect(m.firmenBg, `${wo}: die Firmenlogo-Platte ist nicht weiss`).toBe(WEISS);
        expect(m.bild, `${wo}: das Bild fehlt`).not.toBeNull();
        // Eine Platte mit dem richtigen Mass, die niemand sieht, ist bei der Vorführung nichts wert.
        mussGemaltSein(m.firmen, wo, "die Firmenlogo-Platte");
        mussGemaltSein(m.bild, wo, "das Kundenlogo");
        expect(
          f.breite,
          `${wo}: die Platte ist schmaler als das Bild darin — das Logo steht über`,
        ).toBeGreaterThanOrEqual(b.breite);
      });

      it(`${wo} · Grössenverhältnis: das Kundenlogo ist 24 px hoch und nicht verzerrt`, async () => {
        const m = await miss(breite, hoehe, "AN");
        expect(m.bildGeladen, `${wo}: das Bild ist gar nicht geladen`).toBe(true);
        const b = m.bild as Rechteck;
        expect(Math.round(b.hoehe), `${wo}: Höhe des Bildes (h-6)`).toBe(BILD_HOEHE);
        // Die Originaldatei trägt nur `viewBox` — ihr Seitenverhältnis ist damit die einzige
        // Wahrheit über die Form. Toleranz 2 %: die Gegenprobe G2 (`w-24` statt `w-auto`) landet
        // bei 96/24 = 4,00 gegen 4,417, also 9,4 % daneben und damit sicher ausserhalb.
        const gemessen = b.breite / b.hoehe;
        expect(
          gemessen,
          `${wo}: das Kundenlogo ist verzerrt — gemessen ${gemessen.toFixed(3)}, Original ${LOGO_SEITENVERHAELTNIS.toFixed(3)}`,
        ).toBeCloseTo(LOGO_SEITENVERHAELTNIS, 1);
        expect(
          Math.abs(gemessen - LOGO_SEITENVERHAELTNIS) / LOGO_SEITENVERHAELTNIS,
          `${wo}: Abweichung vom Seitenverhältnis über 2 %`,
        ).toBeLessThan(0.02);
        // Und dasselbe an dem, was der Browser als Eigengrösse der Datei meldet.
        expect(m.naturHoehe, `${wo}: keine Eigenhöhe`).toBeGreaterThan(0);
        expect(
          Math.abs(m.naturBreite / m.naturHoehe - LOGO_SEITENVERHAELTNIS) / LOGO_SEITENVERHAELTNIS,
          `${wo}: die Eigengrösse der Datei passt nicht zum viewBox`,
        ).toBeLessThan(0.02);
      });

      it(`${wo} · kein Überstand und keine Überlappung`, async () => {
        const m = await miss(breite, hoehe, "AN");
        imFenster(m, wo);
        const z = m.zeichen as Rechteck;
        const t = m.text as Rechteck;
        const f = m.firmen as Rechteck;
        // Der Befund, den JOB 3571 am Kopfband gefunden hat (20,5 px bei 390 px), wird hier für die
        // Anmeldemaske ausgeschlossen — oder beziffert.
        expect(
          t.x,
          `${wo}: der Schriftzug überlappt die Platte des KLARWERK-Zeichens`,
        ).toBeGreaterThanOrEqual(z.rechts);
        expect(f.x, `${wo}: die Firmenlogo-Platte überlappt den Schriftzug`).toBeGreaterThanOrEqual(
          t.rechts,
        );
        expect(
          f.x,
          `${wo}: die Firmenlogo-Platte schneidet die Platte des KLARWERK-Zeichens`,
        ).toBeGreaterThanOrEqual(z.rechts);
      });

      it(`${wo} · kein Umbruch: die Gruppe steht auf EINER Zeile`, async () => {
        const m = await miss(breite, hoehe, "AN");
        const g = m.gruppe as Rechteck;
        const z = m.zeichen as Rechteck;
        const t = m.text as Rechteck;
        const f = m.firmen as Rechteck;
        // EINE Zeile heisst: die Gruppe ist nicht höher als ihr höchstes Kind. Bräche sie um, wäre
        // sie mindestens doppelt so hoch — 40 px ist die Grenze mit Luft für Rundung.
        expect(
          g.hoehe,
          `${wo}: die Wortmarke-Gruppe ist ${g.hoehe.toFixed(1)} px hoch — sie bricht um`,
        ).toBeLessThanOrEqual(40);
        // Der Umschlag ist `flex items-center` (`BrandPanel.tsx:65`), richtet also MITTEN aus, nicht
        // Oberkanten; deshalb ist die Mitte die scharfe Zusage. Die Oberkanten werden zusätzlich mit
        // benannter Toleranz gehalten: der Textblock ist niedriger als die 36-px-Platten, weicht
        // also zulässig um wenige Pixel ab — ein Umbruch wäre ein Sprung von mindestens 32 px.
        for (const [name, k] of [
          ["Zeichen", z],
          ["Text", t],
          ["Firmenlogo", f],
        ] as const) {
          expect(k.mitteY, `${wo}: ${name} steht nicht auf derselben Zeile (Mitte)`).toBeCloseTo(
            g.mitteY,
            1,
          );
          expect(
            Math.abs(k.y - g.y),
            `${wo}: ${name} weicht in der Oberkante um ${Math.abs(k.y - g.y).toFixed(1)} px ab`,
          ).toBeLessThanOrEqual(4);
        }
      });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // B3 — die Schwelle. Heute nur als Tailwind-Klasse gepinnt, nie gerechnet.
  // ----------------------------------------------------------------------------------------------
  describe("B3 · die Schwelle zwischen den Bauformen", () => {
    for (const [breite, sichtbar, versteckt] of [
      [1023, "compact", "panel"],
      [1025, "panel", "compact"],
    ] as const) {
      it(`B3 · bei ${breite} px steht ${sichtbar}, und ${versteckt} steht nicht`, async () => {
        const m = await miss(breite, 844, "AN");
        const formen = { panel: m.panel, compact: m.compact };
        const zeige = (s: Sichtbarkeit): string =>
          `${s.display}/${s.visibility}/o${s.opacity} (${s.breite.toFixed(1)}×${s.hoehe.toFixed(1)}) gemalt=${s.gemalt}`;
        console.log(
          `JOB 3591 · B3 ${breite} px · panel=${zeige(m.panel)} · compact=${zeige(m.compact)}`,
        );
        expect(formen[sichtbar].da, `bei ${breite} px fehlt ${sichtbar} im Baum`).toBe(true);
        expect(formen[sichtbar].display, `bei ${breite} px ist ${sichtbar} weggeschaltet`).not.toBe(
          "none",
        );
        expect(
          formen[sichtbar].hoehe,
          `bei ${breite} px hat ${sichtbar} keine Höhe`,
        ).toBeGreaterThan(0);
        // DIE ZUSAGE „NIE KEINS" HÄNGT AN DER WIRKSAMEN SICHTBARKEIT, nicht an `display` und Mass:
        // BEN hat in Runde 2 mit einem einzigen `invisible` an `BrandPanel.tsx:114` eine Fläche
        // hergestellt, die `flex` und 512,5 × 844 px meldet und trotzdem unsichtbar ist. Genau das
        // fängt diese Zeile ab.
        expect(
          formen[sichtbar].gemalt,
          `bei ${breite} px steht ${sichtbar} da, wird aber nicht gemalt — ${zeige(formen[sichtbar])}`,
        ).toBe(true);
        // „Nie beide" ist die Zusage aus `BrandPanel.tsx:129-131`: zwei Wortmarken nebeneinander
        // wären eine Dopplung.
        expect(
          formen[versteckt].display,
          `bei ${breite} px stehen BEIDE Bauformen — eine Dopplung`,
        ).toBe("none");
        expect(formen[versteckt].hoehe, `bei ${breite} px belegt ${versteckt} Platz`).toBe(0);
        expect(
          formen[versteckt].gemalt,
          `bei ${breite} px wird ${versteckt} doch gemalt — ${zeige(formen[versteckt])}`,
        ).toBe(false);
        // Und nie keins: die gemessene Bauform trägt die Marke wirklich UND zeigt sie.
        produktidentitaet(m, `B3/${breite}`);
        expect(m.gruppe, `bei ${breite} px steht keine Wortmarke`).not.toBeNull();
      });
    }
  });
});
