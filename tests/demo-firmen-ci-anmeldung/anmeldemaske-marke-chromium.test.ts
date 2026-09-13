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
//   G    Die Gegenproben      JOB 3774: die drei Lücken der Sichtbarkeitsrechnung, jede einzeln von
//                             aussen in die Seite eingebracht — und die Grenzen, die die neue
//                             Messung selbst hat. JOB 3910 hat die vierte Lücke (Teilabdeckung mit
//                             freiem Mittelpunkt, G-F) geschlossen und die zweite Grenze
//                             (kein Kontrast, G-G) gemessen statt behauptet.
//
// SICHTBARKEIT WIRD GERECHNET, NICHT AUS `display` GESCHLOSSEN (Runde 3, Korrekturpflicht BEN).
// Die erste Fassung leitete „steht da" aus `display !== none` und einer Rechteckgrösse > 0 ab. BEN
// hat sie damit widerlegt: ein `invisible` an `BrandPanel.tsx:114` macht die Spalte bei 1025 px
// `display:flex`, 512,5 × 844 px — und unsichtbar; alle dreizehn Fälle blieben grün. Jede
// Sichtbarkeitszusage dieser Datei läuft jetzt über `gemalt` (siehe MESSE), das `visibility` (vererbt)
// und `opacity` über die Vorfahrenkette mitrechnet. Und die Produktidentität hängt nicht mehr am
// `textContent` des Umschlags, sondern am Blattknoten, der das Wort wirklich trägt.
//
// JOB 3774 — „STEHT DA" HEISST JETZT AUCH: AM ORT WIRKLICH GETROFFEN.
// `gemalt` allein hat drei Lücken gelassen, die JOB 3591 im Quelltext selbst benannt und als eigene
// Zeile bestellt hat: Verdeckung durch ein darüberliegendes Element, `clip-path` und das Abschieben
// aus dem Sichtfenster. Alle drei liessen Rechteckgrösse, `visibility` und `opacity` unverändert —
// ein Gast konnte auf eine leere Platte schauen, während dreizehn Fälle grün waren. Dazu kommt jetzt
// die TREFFERPUNKT-MESSUNG (`treffpunkt` in MESSE): `document.elementFromPoint` muss das Element
// selbst oder einen seiner Nachfahren liefern.
//
//   GEDECKT ist damit zusätzlich: ein deckendes Element darüber (es wird geliefert statt des
//   gesuchten), `clip-path` (der geclippte Knoten ist nicht mehr trefferfähig, geliefert wird ein
//   VORFAHR — deshalb gilt ein Vorfahr ausdrücklich NICHT als Treffer) und das Abschieben aus dem
//   Fenster in JEDE Richtung (`elementFromPoint` antwortet dort mit `null`; gemessen in G-C, nicht
//   angenommen).
//
// JOB 3910 — AUS DEM EINEN PUNKT WIRD EINE FLÄCHE, UND DIE ZWEITE GRENZE WIRD GEMESSEN.
// Bis JOB 3910 fragte `treffpunkt` GENAU EINEN Punkt: den Mittelpunkt des Rechtecks. Eine Abdeckung,
// die den Schriftzug zur Hälfte deckt und dabei den Mittelpunkt frei lässt, blieb damit unsichtbar
// für die Messung — der Gast sah die halb verdeckte Wortmarke, die Zusage blieb grün. Gefragt werden
// jetzt FÜNF Punkte (Mitte plus 25 %/75 % in Breite und Höhe), und `trifft` gilt nur, wenn JEDER von
// ihnen das Element oder einen Nachfahren liefert.
//
//   ZUSÄTZLICH GEDECKT: die Teilabdeckung mit freiem Mittelpunkt — gemessen in G-F, wo der freie
//   Mittelpunkt ausdrücklich nachgewiesen wird und trotzdem `trifft` fällt (3 von 5 Punkten).
//   NICHT GEDECKT und hier ausdrücklich als Restschuld benannt, beide Grenzen GEMESSEN, keine bloss
//   behauptet:
//     · ein darüberliegendes Element mit `pointer-events: none`. `elementFromPoint` überspringt es
//       und liefert das verdeckte Element — der Treffer gilt, obwohl der Gast nichts sieht. Gemessen
//       in G-D, nicht vermutet.
//     · eine Deckfarbe, die dem Untergrund gleicht. Gemessen wird ANWESENHEIT, nie Kontrast: steht
//       der Schriftzug in der Farbe des Untergrunds hinter ihm, bleibt jede Zusage grün. Gemessen in
//       G-G — die Hintergrundfarbe wird dort am wirklich dahinterliegenden Knoten abgelesen, nicht
//       angenommen.
//   NICHT GEDECKT und NICHT gemessen bleibt: eine Teilabdeckung, die alle fünf Punkte frei lässt
//   (sehr schmale Streifen zwischen den Punkten, ein Loch um jeden Punkt herum). Fünf Punkte sind
//   eine Stichprobe, keine Deckungsquote — jede weitere Verdichtung wäre eine neue Zusage und
//   gehört in eine eigene Zeile.
//
// `gemalt` BLEIBT — aber nicht mehr als eigenständige Zusage. Kein Fall benutzt es allein; jede
// Sichtbarkeitszusage läuft über den EINEN Satz `mussGemaltSein`, der beides fordert. Was `gemalt`
// weiter leistet, ist die URSACHENAUSKUNFT: kippt eine Zusage, sagt die Meldung, ob nichts gemalt
// wird (Grösse, `visibility`, durchsichtiger Vorfahr) oder ob am Trefferpunkt etwas anderes steht.
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
/**
 * Wie viele Punkte `treffpunkt` je Element fragt (JOB 3910) — Mitte plus vier innenliegende.
 * Die Zahl steht hier UND im Raster von `MESSE`; dass beide dieselbe ist, prüft G-F (`getroffen`
 * eines unverdeckten Trägers muss genau diese Zahl sein).
 */
const PRUEFPUNKTE = 5;

/**
 * Der Blattknoten-Sucher als QUELLTEXTBAUSTEIN — eine Fassung für die Messung UND die Gegenproben.
 *
 * Er wird in `MESSE` (dort misst er den Träger) und in den Einbringhelfern des G-Blocks (dort ist er
 * das Ziel der Verstellung) gebraucht. Zwei Abschriften wären zwei Begriffe davon, welcher Knoten
 * „der Schriftzug" ist — und die Gegenprobe verstellte womöglich einen anderen Knoten, als die
 * Messung misst.
 */
const BLATTKNOTEN_JS = `const blatt = (box, wort) => {
  for (const e of Array.prototype.slice.call(box.querySelectorAll("*"))) {
    if (e.children.length === 0 && (e.textContent || "").trim() === wort) return e;
  }
  return null;
};`;

/**
 * Was diese Datei über „zu sehen" weiss — zwei getrennte Auskünfte, bewusst nicht zu einer
 * verschmolzen (JOB 3774).
 *
 * `gemalt` beantwortet „wird hier überhaupt gezeichnet", `trifft` beantwortet „kommt am Ort dieses
 * Elements auch dieses Element heraus". Erst beide zusammen sind die Zusage (`mussGemaltSein`);
 * getrennt bleiben sie, damit ein Rotlauf ohne Nachmessen sagen kann, WELCHE Ursache greift.
 */
interface Zusehen {
  breite: number;
  hoehe: number;
  /** Der BERECHNETE Wert am Element — `visibility` ist vererbt, trägt also die Vorfahren mit. */
  visibility: string;
  opacity: number;
  /** Wirksame Sichtbarkeit, siehe `GEMALT` im Messprogramm. */
  gemalt: boolean;
  /**
   * Liefert `document.elementFromPoint` an ALLEN fünf Prüfpunkten dieses Element oder einen
   * Nachfahren? Ein einziger Fehltreffer genügt für `false` (JOB 3910).
   */
  trifft: boolean;
  /** Was dort wirklich steht — ausgeschrieben, damit ein Rotlauf lesbar ist. */
  treffer: string;
  /** Wie viele der fünf Prüfpunkte getroffen haben — 5 heisst voll, 0 heisst gar nicht. */
  getroffen: number;
  /** Der Punkt, auf den sich `treffer` bezieht: der ERSTE Fehltreffer, sonst die Mitte. */
  punktName: string;
  punktX: number;
  punktY: number;
}
interface Rechteck extends Zusehen {
  x: number;
  y: number;
  rechts: number;
  unten: number;
  mitteY: number;
}
interface Sichtbarkeit extends Zusehen {
  da: boolean;
  display: string;
}
interface Messung {
  innerWidth: number;
  innerHeight: number;
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
const MESSE = `([wurzel, immerWahr]) => {
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
  // \`gemalt\` DECKT NICHT: Verdeckung durch ein darüberliegendes Element, \`clip-path\`, Abschieben
  // aus dem Sichtfenster. Alle drei lassen Grösse, \`visibility\` und \`opacity\` unverändert. Dafür
  // steht seit JOB 3774 die Trefferpunkt-Messung darunter; \`gemalt\` bleibt die URSACHENAUSKUNFT.
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
  // ----------------------------------------------------------------------------------------------
  // DIE TREFFERPUNKT-MESSUNG (JOB 3774) — „steht da" heisst auch: am Ort wirklich getroffen.
  //
  // Gefragt wird der Browser selbst: \`document.elementFromPoint\`.
  // Die Annahmeregel ist \`el.contains(oben)\` — das Element selbst oder einer seiner Nachfahren.
  //   · Ein VORFAHR gilt ausdrücklich NICHT als Treffer. Genau das kommt bei \`clip-path\` heraus:
  //     der geclippte Knoten ist nicht mehr trefferfähig, geliefert wird der Umschlag darüber.
  //     Wer Vorfahren durchgehen liesse, hätte die Lücke nur verschoben.
  //   · Ein NACHFAHR gilt als Treffer, und das ist kein Zugeständnis, sondern die Messlage. Bei
  //     1280 px mit Marke AN liefert \`elementFromPoint\` an VIER der neun gemessenen Träger einen
  //     Nachfahren statt des Elements: Zeichenplatte → \`circle\`, Textblock → der KLARWERK-Span,
  //     Firmenplatte → \`img.h-6.w-auto\`, Markenspalte → \`p.text-xl\` der Nutzenzeile. Eine Regel
  //     „nur das Element selbst" hätte \`zeichenplatte\` in allen sechs Messpunkten und B3 bei
  //     1025 px aus falschem Grund rot gemacht — gemessen am Bestand, nicht geraten.
  // \`elementFromPoint\` WIRD AUCH DANN GEFRAGT, wenn der Punkt ausserhalb des Fensters liegt — dass
  // es dort \`null\` liefert, ist gemessen (Gegenprobe G-C) und nicht vorweggenommen.
  //
  // AUS DEM EINEN PUNKT WIRD DAS RASTER (JOB 3910). Bis dahin stand hier „kein zweiter Punkt, kein
  // Raster: EIN Punkt". Der Satz hat eine Lücke gedeckt, die G-F jetzt vorführt: eine Abdeckung über
  // der halben Wortmarke, die den Mittelpunkt frei lässt, liess \`trifft\` auf \`true\` — die Zusage
  // blieb grün, während der Gast den Schriftzug halb verdeckt sah.
  //   · Gefragt werden FÜNF Punkte: die Mitte und je einer bei 25 % und 75 % von Breite und Höhe.
  //     \`trifft\` ist nur wahr, wenn JEDER von ihnen trägt — nicht eine Quote, kein Schwellenwert.
  //   · Der ERSTE Fehltreffer trägt die Meldung (Name, Lage, was dort steht); \`getroffen\` sagt
  //     zusätzlich, wie viele Punkte gehalten haben. Ein Rotlauf unterscheidet damit ohne Nachmessen
  //     „ganz weg" (0 von 5) von „halb verdeckt" (3 von 5).
  //   · Die Mitte steht ABSICHTLICH an erster Stelle: bei einer vollflächigen Verdeckung meldet die
  //     Messung damit wörtlich dasselbe wie vor JOB 3910 (G-A, G-B, G-C bleiben unverändert).
  //   · Fünf Punkte sind eine STICHPROBE, keine Deckungsquote. Was zwischen ihnen hindurchpasst,
  //     bleibt ungemessen und steht als Restschuld im Kopf dieser Datei.
  // ----------------------------------------------------------------------------------------------
  const beschreibe = (el) => {
    if (!el) return "nichts";
    const t = el.getAttribute ? el.getAttribute("data-testid") : null;
    const k = typeof el.className === "string"
      ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join(".")
      : "";
    return el.tagName.toLowerCase() + (t ? '[data-testid="' + t + '"]' : "") + (k ? "." + k : "");
  };
  const RASTER = [
    ["Mitte", 0.5, 0.5],
    ["links oben", 0.25, 0.25],
    ["rechts oben", 0.75, 0.25],
    ["links unten", 0.25, 0.75],
    ["rechts unten", 0.75, 0.75],
  ];
  /** EIN Punkt, wörtlich die Rechnung von JOB 3774 — jetzt fünfmal gefragt statt einmal. */
  const einPunkt = (el, x, y) => {
    const oben = document.elementFromPoint(x, y);
    if (oben === null) {
      const lagen = [];
      if (y < 0) lagen.push((-y).toFixed(1) + " px oberhalb");
      if (y >= window.innerHeight) lagen.push((y - window.innerHeight).toFixed(1) + " px unterhalb");
      if (x < 0) lagen.push((-x).toFixed(1) + " px links");
      if (x >= window.innerWidth) lagen.push((x - window.innerWidth).toFixed(1) + " px rechts");
      const fenster = " des Fensters " + window.innerWidth + "×" + window.innerHeight;
      return {
        trifft: false,
        treffer: lagen.length > 0
          ? "elementFromPoint liefert nichts — der Prüfpunkt liegt " + lagen.join(" und ") + " ausserhalb" + fenster
          : "elementFromPoint liefert nichts, obwohl der Prüfpunkt INNERHALB" + fenster + " liegt",
      };
    }
    return {
      trifft: el.contains(oben),
      treffer: el.contains(oben) ? beschreibe(oben) : beschreibe(oben) + " liegt darüber",
    };
  };
  const treffpunkt = (el) => {
    if (!el) {
      return { trifft: false, treffer: "steht gar nicht im Baum", getroffen: 0, punktName: "—", punktX: 0, punktY: 0 };
    }
    const b = el.getBoundingClientRect();
    const mx = b.x + b.width / 2;
    const my = b.y + b.height / 2;
    if (b.width <= 0 || b.height <= 0) {
      return {
        trifft: false,
        treffer: "Rechteck " + b.width.toFixed(1) + "×" + b.height.toFixed(1) + " — es gibt keinen Punkt zu prüfen",
        getroffen: 0, punktName: "Mitte", punktX: mx, punktY: my,
      };
    }
    let getroffen = 0;
    let fehl = null;
    let mitte = null;
    for (const eintrag of RASTER) {
      const name = eintrag[0];
      const x = b.x + b.width * eintrag[1];
      const y = b.y + b.height * eintrag[2];
      const e = einPunkt(el, x, y);
      if (name === "Mitte") mitte = e;
      if (e.trifft) { getroffen += 1; continue; }
      if (fehl === null) fehl = { name: name, x: x, y: y, treffer: e.treffer };
    }
    if (fehl !== null) {
      return { trifft: false, treffer: fehl.treffer, getroffen: getroffen, punktName: fehl.name, punktX: fehl.x, punktY: fehl.y };
    }
    return { trifft: true, treffer: mitte.treffer, getroffen: getroffen, punktName: "Mitte", punktX: mx, punktY: my };
  };
  // NUR FÜR DIE GEGENPROBE G-E: die Prüfung künstlich auf „immer wahr". \`miss\` übergibt immer
  // \`false\`; allein der G-Block stellt den Schalter, um zu belegen, dass G-A/G-B/G-C/G-F wirklich an
  // dieser Prüfung hängen und nicht an einer Nebenwirkung der Verstellung.
  const treffer = (el) => {
    const t = treffpunkt(el);
    if (!immerWahr) return t;
    return {
      trifft: true, treffer: t.treffer + " · G-E: Prüfung künstlich auf immer wahr",
      getroffen: t.getroffen, punktName: t.punktName, punktX: t.punktX, punktY: t.punktY,
    };
  };
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    const tp = treffer(el);
    return {
      x: b.x, y: b.y, breite: b.width, hoehe: b.height, rechts: b.right, unten: b.bottom,
      mitteY: b.y + b.height / 2,
      visibility: s.visibility, opacity: Number(s.opacity), gemalt: gemalt(el),
      trifft: tp.trifft, treffer: tp.treffer, getroffen: tp.getroffen,
      punktName: tp.punktName, punktX: tp.punktX, punktY: tp.punktY,
    };
  };
  const sicht = (sel) => {
    const e = document.querySelector(sel);
    if (!e) return {
      da: false, display: "—", visibility: "—", opacity: 0, gemalt: false,
      trifft: false, treffer: "steht gar nicht im Baum", getroffen: 0, punktName: "—",
      punktX: 0, punktY: 0, breite: 0, hoehe: 0,
    };
    const b = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    const tp = treffer(e);
    return {
      da: true, display: s.display, visibility: s.visibility, opacity: Number(s.opacity),
      gemalt: gemalt(e), trifft: tp.trifft, treffer: tp.treffer, getroffen: tp.getroffen,
      punktName: tp.punktName, punktX: tp.punktX, punktY: tp.punktY,
      breite: b.width, hoehe: b.height,
    };
  };
  /**
   * Der BLATT-Knoten, der genau dieses Wort trägt — nicht sein Umschlag.
   * An ihm hängt die Produktidentität: \`textContent\` am Umschlag bliebe auch dann wahr, wenn der
   * Schriftzug selbst unsichtbar gestellt wäre.
   */
  ${BLATTKNOTEN_JS}
  const wortknoten = (box, wort) => (box ? blatt(box, wort) : null);
  const box = document.querySelector(wurzel);
  const gruppe = box ? box.querySelector(":scope > span") : null;
  const kinder = gruppe ? Array.prototype.slice.call(gruppe.children) : [];
  const firmen = box ? box.querySelector('[data-testid="auth-firmenlogo"]') : null;
  const bild = firmen ? firmen.querySelector("img") : null;
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
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
  // Der zweite Übergabewert ist der G-E-Schalter. Hier steht er FEST auf `false`: die Messung der
  // Zusagen kennt keinen Weg, sich selbst abzuschalten.
  const m = await seite().evaluate<Messung>(fn(MESSE), [bauform(breite), false]);
  expect(m.innerWidth, "das Fenster steht nicht auf der verlangten Breite").toBe(breite);
  console.log(`JOB 3591 · Marke ${marke} · ${breite}×${hoehe} · ${JSON.stringify(m)}`);
  return m;
}

/**
 * Der eine Satz, den jede Zusage dieser Datei über Sichtbarkeit spricht.
 *
 * ZWEI PRÜFUNGEN, SEIT JOB 3774, und beide müssen halten: das Element wird gezeichnet (`gemalt`)
 * UND es wird an seinem eigenen Ort auch getroffen (`trifft`). Es gibt keinen zweiten Weg, in dieser
 * Datei Sichtbarkeit zu behaupten; kein Fall benutzt `gemalt` allein.
 *
 * Bewusst ZWEI getrennte Zusicherungen mit ausgeschriebenem Befund: kippt eine Zusage, soll in der
 * Ausgabe die URSACHE stehen — „wird nicht gemalt" (Grösse null, `visibility:hidden`, durchsichtiger
 * Vorfahr) oder „am Trefferpunkt steht etwas anderes" (Verdeckung, `clip-path`, aus dem Fenster
 * geschoben) — nicht bloss „expected false to be true".
 */
function mussGemaltSein(k: Zusehen | null, wo: string, was: string): void {
  expect(k, `${wo}: ${was} steht gar nicht im Baum`).not.toBeNull();
  const e = k as Zusehen;
  expect(
    e.gemalt,
    // „am Element selbst" ist wörtlich zu nehmen: G8 (`opacity-0` an der Spalte) meldet an diesem
    // Blattknoten `visibility:visible` und `opacity 1` und ist trotzdem unsichtbar — der Grund liegt
    // dann bei einem Vorfahren, den `gemalt` mitrechnet, die zwei Zahlen hier aber nicht zeigen.
    `${wo}: ${was} steht im Baum, wird aber nicht gemalt — ${e.breite.toFixed(1)}×${e.hoehe.toFixed(1)} px, am Element selbst visibility:${e.visibility} und opacity ${e.opacity} (ein durchsichtiger oder verborgener VORFAHR zählt mit)`,
  ).toBe(true);
  expect(
    e.trifft,
    // Seit JOB 3910 nennt die Meldung auch, WIE VIEL getragen hat: 0 von 5 heisst „ganz weg",
    // 3 von 5 heisst „teilweise verdeckt" — zwei verschiedene Befunde, ohne Nachmessen lesbar.
    `${wo}: ${was} wird zwar gemalt, ist an seinem Ort aber nicht zu treffen — ${e.getroffen} von ${PRUEFPUNKTE} Prüfpunkten getroffen, am ersten Fehltreffer „${e.punktName}" (${e.punktX.toFixed(1)}|${e.punktY.toFixed(1)}) steht ${e.treffer}`,
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
 *
 * SEIT JOB 3774 AUCH SENKRECHT. Bis dahin prüfte diese Zusage nur waagerecht — die Hälfte der Frage
 * „liegt es im Fenster" war offen, und ein nach oben oder unten geschobenes Element blieb grün.
 * Gegenprobe G-C fährt beide Richtungen.
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
  const untersteKante = Math.max(...kinder.map((k) => k.unten));
  expect(
    untersteKante,
    `${wo}: die Wortmarke ragt ${(untersteKante - m.innerHeight).toFixed(1)} px unten aus dem Fenster (unterste Kinderkante ${untersteKante.toFixed(1)} px bei innerHeight ${m.innerHeight})`,
  ).toBeLessThanOrEqual(m.innerHeight);
  const obersteKante = Math.min(...kinder.map((k) => k.y));
  expect(
    obersteKante,
    `${wo}: die Wortmarke ragt ${(-obersteKante).toFixed(1)} px oben aus dem Fenster (oberste Kinderkante ${obersteKante.toFixed(1)} px)`,
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
          `${s.display}/${s.visibility}/o${s.opacity} (${s.breite.toFixed(1)}×${s.hoehe.toFixed(1)}) gemalt=${s.gemalt} trifft=${s.trifft} [${s.treffer}]`;
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
        // fängt diese Zeile ab — seit JOB 3774 über denselben EINEN Satz wie jede andere
        // Sichtbarkeitszusage dieser Datei, also auch gegen Verdeckung und Abschieben.
        mussGemaltSein(formen[sichtbar], `B3/${breite}`, `die Bauform ${sichtbar}`);
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
        // Die verschärfte Prüfung darf die weggeschaltete Bauform NICHT plötzlich als Treffer
        // melden: ein Rechteck 0 × 0 hat keinen Punkt, an dem etwas zu treffen wäre.
        expect(
          formen[versteckt].trifft,
          `bei ${breite} px wird ${versteckt} am Trefferpunkt doch getroffen — ${zeige(formen[versteckt])}`,
        ).toBe(false);
        // Und nie keins: die gemessene Bauform trägt die Marke wirklich UND zeigt sie.
        produktidentitaet(m, `B3/${breite}`);
        expect(m.gruppe, `bei ${breite} px steht keine Wortmarke`).not.toBeNull();
      });
    }
  });
});

/** Was das Auflegen der halben Abdeckung (G-F) über sich selbst berichtet — alles GEMESSEN. */
interface HalbeAbdeckung {
  fehler: string;
  /** Welcher Anteil der Schriftzug-Breite wirklich unter der Platte liegt (Soll: rund die Hälfte). */
  anteil: number;
  /** Steht am Mittelpunkt des Schriftzugs NACH dem Auflegen immer noch der Schriftzug? */
  mitteFrei: boolean;
  /** Was am Mittelpunkt steht — für den Rotlauf, falls `mitteFrei` fällt. */
  mitte: string;
  /** Die gemessenen Kanten, damit die Rückgabe Zahlen nennen kann und keine Absicht. */
  wortX: number;
  wortBreite: number;
  platteRechts: number;
}

/** Die Farblage am Schriftzug (G-G) — Schriftfarbe und der Untergrund, der wirklich dahintersteht. */
interface Farblage {
  fehler: string;
  /** `color` am Blattknoten, wie `getComputedStyle` sie serialisiert. */
  farbe: string;
  /** `background-color` am nächsten Vorfahren, der überhaupt deckt — gemessen, nicht angenommen. */
  untergrund: string;
  /** Welcher Knoten das ist, damit die Rückgabe ihn benennen kann. */
  knoten: string;
}

// ==================================================================================================
// JOB 3774 G · DIE GEGENPROBEN — die drei Lücken, einzeln eingebracht, und die eigenen Grenzen.
// ==================================================================================================
//
// WARUM DIE GEGENPROBEN HIER IN DER DATEI STEHEN und nicht nur in einer Rückgabe: eine Zusage, deren
// Schärfe nur behauptet ist, ist bei der nächsten Änderung wieder stumpf. JOB 3591 hat seine
// Gegenproben am PRODUKT gefahren (`invisible` an `BrandPanel.tsx`) und wieder zurückgenommen — der
// Beleg hing damit an einer Änderung, die es heute nicht mehr gibt. Diese sieben Fälle bringen die
// Verstellung von AUSSEN über `seite.evaluate` in die laufende Seite ein, messen, nehmen sie zurück
// und messen erneut. Das Produkt wird dafür nicht angefasst.
//
// A/B/C/F sind LÜCKEN, die geschlossen sind: vor ihrer Lieferung grün, danach rot.
// D/G sind GRENZEN, die bleiben: sie sind grün und sollen es sein — steht eine von ihnen eines Tages
// auf rot, ist die Grenze weg und der Kopf dieser Datei gehört nachgeführt.
// E ist die Gegenrichtung: ohne die Prüfung sind A/B/C/F wieder blind.
//
// DIE EINBRINGHELFER SIND HIER EINGESPERRT. Sie stehen im Rumpf dieses `describe` und sind von
// B1/B2/B3 nicht erreichbar: eine Bühne, die die Seite verstellen kann, darf die Messung der Zusagen
// nicht anfassen. Aus demselben Grund hat dieser Block eine EIGENE Bühne — sie läuft nacheinander mit
// der von B (Vitest fährt die Blöcke einer Datei seriell), nie gleichzeitig.
describe("JOB 3774 G · die Gegenproben zur Trefferpunkt-Messung", () => {
  /** Die Wortmarke-Gruppe in der bei 1280 px sichtbaren Bauform — das Ziel jeder Verstellung. */
  const GRUPPE = `${PANEL} > span`;
  const ABDECKUNG = "job3774-abdeckung";
  /** Das Wort, an dessen BLATTKNOTEN G-F und G-G ansetzen — derselbe, den `MESSE` misst. */
  const WORT = "KLARWERK";

  /** NUR FÜR GEGENPROBEN: einen Stil an ein Element hängen und den alten `style` verwahren. */
  const VERSTELLE = `([sel, stil]) => {
    const el = document.querySelector(sel);
    if (el === null) return "kein Element für " + sel;
    el.setAttribute("data-job3774-vorher", el.getAttribute("style") || "");
    el.setAttribute("style", (el.getAttribute("style") || "") + ";" + stil);
    return "";
  }`;
  /** NUR FÜR GEGENPROBEN: den verwahrten `style` zurückschreiben. */
  const NIMM_ZURUECK = `(sel) => {
    const el = document.querySelector(sel);
    if (el === null) return "kein Element für " + sel;
    const vorher = el.getAttribute("data-job3774-vorher");
    if (vorher === null) return "nichts verwahrt für " + sel;
    if (vorher === "") el.removeAttribute("style"); else el.setAttribute("style", vorher);
    el.removeAttribute("data-job3774-vorher");
    return "";
  }`;
  /**
   * NUR FÜR GEGENPROBEN: eine deckende Platte genau über das Rechteck des Elements legen.
   * `durchlaessig` ist G-D: dieselbe Platte mit `pointer-events: none`.
   */
  const UEBERDECKE = `([sel, id, durchlaessig]) => {
    const el = document.querySelector(sel);
    if (el === null) return "kein Element für " + sel;
    const b = el.getBoundingClientRect();
    const d = document.createElement("div");
    d.id = id;
    d.setAttribute("data-testid", id);
    d.setAttribute("style",
      "position:fixed;left:" + b.x + "px;top:" + b.y + "px;width:" + b.width + "px;height:" + b.height +
      "px;background:rgb(220,0,0);z-index:2147483647;" + (durchlaessig ? "pointer-events:none;" : ""));
    document.body.appendChild(d);
    return "";
  }`;
  const RAEUME_AB = `(id) => {
    const d = document.getElementById(id);
    if (d !== null) d.remove();
    return document.getElementById(id) === null ? "" : "die Abdeckung liess sich nicht entfernen";
  }`;
  /**
   * NUR FÜR GEGENPROBE G-F (JOB 3910): EINE Platte, die die Wortmarke zur HÄLFTE deckt und dabei den
   * Mittelpunkt des Schriftzugs ausdrücklich frei lässt.
   *
   * Die rechte Kante der Platte liegt 1 px LINKS vom Mittelpunkt des Blattknotens — genau dort, wo
   * die Einpunktmessung von JOB 3774 nachgesehen hat. Nach links reicht sie bis zur Kante der
   * Wortmarke-Gruppe, deckt also die Zeichenplatte mit ab (zweiter Träger, wie in G-A).
   *
   * Sie BEHAUPTET das nicht, sondern misst es und gibt es zurück: `mitteFrei` fragt nach dem
   * Auflegen \`elementFromPoint\` am Mittelpunkt, `anteil` nennt den wirklich verdeckten Bruchteil
   * der Schriftzugbreite. Eine Gegenprobe, die ihre eigene Voraussetzung nur annimmt, belegt nichts.
   */
  const UEBERDECKE_HALB = `([wurzelSel, wort, id]) => {
    ${BLATTKNOTEN_JS}
    const leer = { fehler: "", anteil: 0, mitteFrei: false, mitte: "", wortX: 0, wortBreite: 0, platteRechts: 0 };
    const box = document.querySelector(wurzelSel);
    if (box === null) return Object.assign({}, leer, { fehler: "kein Element für " + wurzelSel });
    const gruppe = box.querySelector(":scope > span");
    if (gruppe === null) return Object.assign({}, leer, { fehler: "keine Wortmarke-Gruppe in " + wurzelSel });
    const ziel = blatt(box, wort);
    if (ziel === null) return Object.assign({}, leer, { fehler: "kein Blattknoten mit dem Wort " + wort });
    const w = ziel.getBoundingClientRect();
    const g = gruppe.getBoundingClientRect();
    const mitteX = w.x + w.width / 2;
    const mitteY = w.y + w.height / 2;
    const rechts = mitteX - 1;
    const breite = rechts - g.x;
    if (breite <= 0) {
      return Object.assign({}, leer, {
        fehler: "links des Mittelpunkts ist kein Platz für eine Abdeckung (" + breite.toFixed(1) + " px)",
      });
    }
    const d = document.createElement("div");
    d.id = id;
    d.setAttribute("data-testid", id);
    d.setAttribute("style",
      "position:fixed;left:" + g.x + "px;top:" + g.y + "px;width:" + breite + "px;height:" + g.height +
      "px;background:rgb(220,0,0);z-index:2147483647;");
    document.body.appendChild(d);
    const oben = document.elementFromPoint(mitteX, mitteY);
    return {
      fehler: "",
      anteil: (rechts - w.x) / w.width,
      mitteFrei: oben !== null && ziel.contains(oben),
      mitte: oben === null ? "nichts" : oben.tagName.toLowerCase() + (oben.id ? "#" + oben.id : ""),
      wortX: w.x, wortBreite: w.width, platteRechts: rechts,
    };
  }`;
  /**
   * NUR FÜR GEGENPROBE G-G (JOB 3910): die Farblage am Schriftzug ABLESEN — nichts verstellen.
   *
   * Der Untergrund wird am nächsten Vorfahren gemessen, der überhaupt deckt (Alpha > 0); die
   * Zwischenknoten sind durchsichtig und stehen nicht wirklich hinter dem Wort. Eine Konstante wäre
   * eine Annahme über das Thema, und das Thema wählt die Anwendung selbst (`gast-buehne.ts:195`).
   */
  const FARBLAGE = `([wurzelSel, wort]) => {
    ${BLATTKNOTEN_JS}
    const leer = { fehler: "", farbe: "", untergrund: "", knoten: "" };
    const box = document.querySelector(wurzelSel);
    if (box === null) return Object.assign({}, leer, { fehler: "kein Element für " + wurzelSel });
    const ziel = blatt(box, wort);
    if (ziel === null) return Object.assign({}, leer, { fehler: "kein Blattknoten mit dem Wort " + wort });
    let traeger = null;
    for (let a = ziel; a !== null; a = a.parentElement) {
      const bg = getComputedStyle(a).backgroundColor;
      if (bg !== "transparent" && !/^rgba\\(.*,\\s*0\\)$/.test(bg)) { traeger = a; break; }
    }
    if (traeger === null) return Object.assign({}, leer, { fehler: "hinter dem Wort deckt kein einziger Vorfahr" });
    const t = traeger.getAttribute("data-testid");
    return {
      fehler: "",
      farbe: getComputedStyle(ziel).color,
      untergrund: getComputedStyle(traeger).backgroundColor,
      knoten: traeger.tagName.toLowerCase() + (t ? '[data-testid="' + t + '"]' : ""),
    };
  }`;
  /** NUR FÜR GEGENPROBE G-G: die Schriftfarbe des Blattknotens stellen und den alten `style` verwahren. */
  const FAERBE = `([wurzelSel, wort, farbe]) => {
    ${BLATTKNOTEN_JS}
    const box = document.querySelector(wurzelSel);
    if (box === null) return "kein Element für " + wurzelSel;
    const ziel = blatt(box, wort);
    if (ziel === null) return "kein Blattknoten mit dem Wort " + wort;
    ziel.setAttribute("data-job3910-vorher", ziel.getAttribute("style") || "");
    ziel.setAttribute("style", (ziel.getAttribute("style") || "") + ";color:" + farbe);
    const jetzt = getComputedStyle(ziel).color;
    return jetzt === farbe ? "" : "die Schriftfarbe steht auf " + jetzt + " statt auf " + farbe;
  }`;
  const FAERBE_ZURUECK = `() => {
    const el = document.querySelector("[data-job3910-vorher]");
    if (el === null) return "nichts verwahrt";
    const vorher = el.getAttribute("data-job3910-vorher");
    if (vorher === "") el.removeAttribute("style"); else el.setAttribute("style", vorher);
    el.removeAttribute("data-job3910-vorher");
    return document.querySelector("[data-job3910-vorher]") === null ? "" : "es blieb eine Verstellung stehen";
  }`;

  let g: GastStand;
  const gSeite = (): GastSeite => {
    expect(g.fehler, "Gegenproben-Bühne kam nicht hoch").toBeNull();
    return g.seite as GastSeite;
  };
  /** Jede Verstellung wird NEU gemessen — nie aus einer früheren Messung übernommen. */
  const missG = async (wo: string, immerWahr = false): Promise<Messung> => {
    const m = await gSeite().evaluate<Messung>(fn(MESSE), [PANEL, immerWahr]);
    expect(m.innerWidth, `${wo}: die Gegenprobenbühne steht nicht auf 1280 px`).toBe(1280);
    console.log(
      `JOB 3774 · ${wo} · KLARWERK ${JSON.stringify(m.klarwerkWort)} · Zeichenplatte ${JSON.stringify(m.zeichen)}`,
    );
    return m;
  };
  const stelle = async (stil: string): Promise<void> => {
    expect(await gSeite().evaluate<string>(fn(VERSTELLE), [GRUPPE, stil])).toBe("");
  };
  const zurueck = async (): Promise<void> => {
    expect(await gSeite().evaluate<string>(fn(NIMM_ZURUECK), GRUPPE)).toBe("");
  };
  /**
   * Die halbe Abdeckung auflegen und ihre eigene Voraussetzung SOFORT belegen: der Mittelpunkt des
   * Schriftzugs ist frei. Ohne diesen Beleg wäre G-F nur eine zweite Ausgabe von G-A.
   */
  const legeHalbAuf = async (wo: string): Promise<HalbeAbdeckung> => {
    const halb = await gSeite().evaluate<HalbeAbdeckung>(fn(UEBERDECKE_HALB), [
      PANEL,
      WORT,
      ABDECKUNG,
    ]);
    console.log(`JOB 3910 · ${wo} · halbe Abdeckung ${JSON.stringify(halb)}`);
    expect(halb.fehler, `${wo}: die halbe Abdeckung liess sich nicht auflegen`).toBe("");
    expect(
      halb.mitteFrei,
      `${wo}: der Mittelpunkt des Schriftzugs ist doch verdeckt — dort steht ${halb.mitte}`,
    ).toBe(true);
    return halb;
  };

  beforeAll(async () => {
    await baueFrisch();
    g = await starteGast("/", PANEL, 1280, 900);
    expect(g.fehler, "Gegenproben-Bühne kam nicht hoch").toBeNull();
    const version = await setzeMarke(g, { profil: "advisor", aktiv: true }, PANEL);
    await gSeite().waitForFunction(
      fn(`(sel) => {
        const b = document.querySelector(sel + " img");
        return b !== null && b.complete && b.naturalWidth > 0;
      }`),
      FIRMENLOGO,
      { timeout: 15_000 },
    );
    console.log(
      `JOB 3774 · Gegenproben-Bühne: ${g.version} · Thema ${g.theme} · Marke Version ${version}`,
    );
  }, 240_000);

  afterAll(async () => {
    await beendeGast(g);
  });

  it("G-A · Verdeckung: eine deckende Platte über der Wortmarke macht die Zusage rot", async () => {
    const vorher = await missG("G-A vorher");
    produktidentitaet(vorher, "G-A vorher");
    zeichenplatte(vorher, "G-A vorher");
    try {
      expect(await gSeite().evaluate<string>(fn(UEBERDECKE), [GRUPPE, ABDECKUNG, false])).toBe("");
      const m = await missG("G-A nachher");
      const wort = m.klarwerkWort as Rechteck;
      // DER BEFUND: die alte Rechnung bleibt unverdächtig — genau deshalb war dieser Fall bis
      // JOB 3774 grün, während der Gast eine rote Platte anschaute.
      expect(wort.gemalt, "G-A: `gemalt` sieht die Verdeckung erwartungsgemäss NICHT").toBe(true);
      expect(
        (m.zeichen as Rechteck).gemalt,
        "G-A: `gemalt` sieht die Verdeckung auch an der Platte nicht",
      ).toBe(true);
      // Und die neue Prüfung greift, an beiden Trägern.
      expect(
        wort.trifft,
        `G-A: der Schriftzug gilt trotz Abdeckung als getroffen — ${wort.treffer}`,
      ).toBe(false);
      expect(wort.treffer, "G-A: am Trefferpunkt steht nicht die Abdeckung").toContain(ABDECKUNG);
      expect(
        (m.zeichen as Rechteck).trifft,
        "G-A: die Zeichenplatte gilt trotz Abdeckung als getroffen",
      ).toBe(false);
      // Die Zusage selbst — nicht ein Hilfsfeld — wird rot, mit lesbarer Ursache.
      expect(() => produktidentitaet(m, "G-A")).toThrow(/nicht zu treffen/);
      expect(() => zeichenplatte(m, "G-A")).toThrow(/nicht zu treffen/);
    } finally {
      expect(await gSeite().evaluate<string>(fn(RAEUME_AB), ABDECKUNG)).toBe("");
    }
    const danach = await missG("G-A zurückgenommen");
    produktidentitaet(danach, "G-A zurückgenommen");
    zeichenplatte(danach, "G-A zurückgenommen");
  });

  it("G-B · clip-path: eine weggeschnittene Wortmarke macht die Zusage rot", async () => {
    const vorher = await missG("G-B vorher");
    produktidentitaet(vorher, "G-B vorher");
    try {
      await stelle("clip-path: inset(100%)");
      const m = await missG("G-B nachher");
      const wort = m.klarwerkWort as Rechteck;
      // `clip-path` ändert weder Layout noch `visibility` noch `opacity`: die alte Rechnung bleibt
      // grün. Getroffen wird jetzt ein VORFAHR — und der gilt ausdrücklich nicht als Treffer.
      expect(wort.gemalt, "G-B: `gemalt` sieht das Wegschneiden erwartungsgemäss NICHT").toBe(true);
      expect(wort.breite, "G-B: `clip-path` darf das Rechteck nicht verändern").toBeCloseTo(
        (vorher.klarwerkWort as Rechteck).breite,
        3,
      );
      expect(
        wort.trifft,
        `G-B: der weggeschnittene Schriftzug gilt als getroffen — ${wort.treffer}`,
      ).toBe(false);
      expect(
        (m.zeichen as Rechteck).trifft,
        "G-B: die weggeschnittene Zeichenplatte gilt als getroffen",
      ).toBe(false);
      expect(() => produktidentitaet(m, "G-B")).toThrow(/nicht zu treffen/);
      expect(() => zeichenplatte(m, "G-B")).toThrow(/nicht zu treffen/);
    } finally {
      await zurueck();
    }
    produktidentitaet(await missG("G-B zurückgenommen"), "G-B zurückgenommen");
  });

  it("G-C · aus dem Fenster geschoben: nach oben und nach unten, beide Richtungen rot", async () => {
    // BENs Promptverbesserung zu JOB 3774 (`archiv/3774/runde-1/ben.md:41`), wörtlich: „In G-C
    // zusätzlich die Zeichenplatten-Zusage vor, während und nach jeder Verstellung ausdrücklich
    // prüfen." Bis dahin prüfte G-C nur `produktidentitaet` — die Platte wurde mitgeschoben, ohne
    // dass ein Fall es festhielt.
    const vorher = await missG("G-C vorher");
    produktidentitaet(vorher, "G-C vorher");
    zeichenplatte(vorher, "G-C vorher");
    for (const [richtung, stil, muster] of [
      ["nach oben", "transform: translateY(-9999px)", /px oberhalb/],
      ["nach unten", "transform: translateY(9999px)", /px unterhalb/],
    ] as const) {
      try {
        await stelle(stil);
        const m = await missG(`G-C ${richtung} nachher`);
        const wort = m.klarwerkWort as Rechteck;
        expect(
          wort.gemalt,
          `G-C ${richtung}: \`gemalt\` sieht das Abschieben erwartungsgemäss NICHT`,
        ).toBe(true);
        // LIEFERUNG 2, GEMESSEN STATT ANGENOMMEN: für einen Punkt ausserhalb des Fensters
        // antwortet `elementFromPoint` mit `null` — und die Meldung nennt die senkrechte Lage.
        expect(wort.trifft, `G-C ${richtung}: der abgeschobene Schriftzug gilt als getroffen`).toBe(
          false,
        );
        expect(
          wort.treffer,
          `G-C ${richtung}: die Meldung nennt die senkrechte Lage nicht`,
        ).toMatch(muster);
        expect(wort.treffer).toContain("elementFromPoint liefert nichts");
        expect(() => produktidentitaet(m, `G-C ${richtung}`)).toThrow(/nicht zu treffen/);
        // Die Zeichenplatte wird mitgeschoben und muss ebenso fallen (BENs Promptverbesserung).
        expect(
          (m.zeichen as Rechteck).trifft,
          `G-C ${richtung}: die abgeschobene Zeichenplatte gilt als getroffen`,
        ).toBe(false);
        expect(() => zeichenplatte(m, `G-C ${richtung}`)).toThrow(/nicht zu treffen/);
        // Und die zweite Hälfte des Sichtfensters, die bis JOB 3774 offen war.
        expect(() => imFenster(m, `G-C ${richtung}`)).toThrow(/aus dem Fenster/);
      } finally {
        await zurueck();
      }
      const danach = await missG(`G-C ${richtung} zurückgenommen`);
      produktidentitaet(danach, `G-C ${richtung} zurückgenommen`);
      zeichenplatte(danach, `G-C ${richtung} zurückgenommen`);
      imFenster(danach, `G-C ${richtung} zurückgenommen`);
    }
  });

  it("G-D · die eigene Grenze: eine Abdeckung mit `pointer-events: none` wird NICHT gefunden", async () => {
    try {
      expect(await gSeite().evaluate<string>(fn(UEBERDECKE), [GRUPPE, ABDECKUNG, true])).toBe("");
      const m = await missG("G-D nachher");
      const wort = m.klarwerkWort as Rechteck;
      // ERWARTET GRÜN — und das ist kein Mangel dieses Auftrags, sondern die gemessene Grenze der
      // Trefferpunkt-Messung: `elementFromPoint` überspringt ein Element mit `pointer-events:none`
      // und liefert das verdeckte darunter. Der Gast sähe die rote Platte, die Messung nicht.
      // Steht diese Zeile eines Tages auf rot, ist die Grenze weg — dann gehört der Kopf nachgeführt.
      expect(wort.trifft, `G-D: die Grenze hat sich verschoben — ${wort.treffer}`).toBe(true);
      expect(
        wort.treffer,
        "G-D: geliefert wird die Abdeckung statt des verdeckten Knotens",
      ).not.toContain(ABDECKUNG);
      produktidentitaet(m, "G-D");
      zeichenplatte(m, "G-D");
    } finally {
      expect(await gSeite().evaluate<string>(fn(RAEUME_AB), ABDECKUNG)).toBe("");
    }
    produktidentitaet(await missG("G-D zurückgenommen"), "G-D zurückgenommen");
  });

  it("G-F · Teilabdeckung mit freiem Mittelpunkt: die halb verdeckte Wortmarke macht die Zusage rot", async () => {
    const vorher = await missG("G-F vorher");
    produktidentitaet(vorher, "G-F vorher");
    zeichenplatte(vorher, "G-F vorher");
    // Unverdeckt tragen ALLE Prüfpunkte. Diese Zeile pinnt zugleich die Rastergrösse: stünde in
    // `MESSE` wieder ein einzelner Punkt, wäre `getroffen` hier 1 statt 5.
    expect(
      (vorher.klarwerkWort as Rechteck).getroffen,
      "G-F: der unverdeckte Schriftzug trifft nicht an allen Prüfpunkten",
    ).toBe(PRUEFPUNKTE);
    try {
      const halb = await legeHalbAuf("G-F");
      // „Ungefähr die Hälfte" ist hier eine gemessene Zahl, keine Absicht: die Platte endet 1 px vor
      // dem Mittelpunkt, deckt also die halbe Schriftzugbreite minus diesem einen Pixel.
      expect(
        halb.anteil,
        `G-F: die Abdeckung deckt ${(halb.anteil * 100).toFixed(1)} % des Schriftzugs (${halb.wortBreite.toFixed(1)} px breit ab x ${halb.wortX.toFixed(1)}, Platte bis ${halb.platteRechts.toFixed(1)}) — das ist nicht rund die Hälfte`,
      ).toBeGreaterThan(0.4);
      expect(halb.anteil).toBeLessThan(0.5);
      const m = await missG("G-F nachher");
      const wort = m.klarwerkWort as Rechteck;
      // DER BEFUND: die alte Rechnung bleibt unverdächtig — und bis JOB 3910 auch die neue, weil sie
      // genau den einen Punkt fragte, den diese Abdeckung frei lässt.
      expect(wort.gemalt, "G-F: `gemalt` sieht die Teilabdeckung erwartungsgemäss NICHT").toBe(
        true,
      );
      expect(
        (m.zeichen as Rechteck).gemalt,
        "G-F: `gemalt` sieht die Teilabdeckung auch an der Platte nicht",
      ).toBe(true);
      expect(
        wort.trifft,
        `G-F: der halb verdeckte Schriftzug gilt als getroffen — ${wort.getroffen} von ${PRUEFPUNKTE} Punkten, „${wort.punktName}": ${wort.treffer}`,
      ).toBe(false);
      // DAS IST DER UNTERSCHIED ZU G-A: die Mitte trägt weiter, die linke Hälfte nicht. Genau drei
      // Punkte bleiben — Mitte, rechts oben, rechts unten.
      expect(
        wort.getroffen,
        `G-F: erwartet werden genau drei tragende Punkte, gemeldet sind ${wort.getroffen} (erster Fehltreffer „${wort.punktName}")`,
      ).toBe(3);
      expect(
        wort.punktName,
        "G-F: der erste Fehltreffer liegt nicht in der verdeckten Hälfte",
      ).toBe("links oben");
      expect(wort.treffer, "G-F: am ersten Fehltreffer steht nicht die Abdeckung").toContain(
        ABDECKUNG,
      );
      // Der zweite Träger, wie in G-A: die Zeichenplatte liegt ganz unter der Platte.
      expect(
        (m.zeichen as Rechteck).trifft,
        "G-F: die Zeichenplatte gilt trotz Abdeckung als getroffen",
      ).toBe(false);
      expect(
        (m.zeichen as Rechteck).getroffen,
        "G-F: die ganz verdeckte Zeichenplatte darf keinen einzigen Punkt tragen",
      ).toBe(0);
      // Die Zusagen selbst — nicht ein Hilfsfeld — werden rot, mit lesbarer Ursache.
      expect(() => produktidentitaet(m, "G-F")).toThrow(/nicht zu treffen/);
      expect(() => zeichenplatte(m, "G-F")).toThrow(/nicht zu treffen/);
    } finally {
      expect(await gSeite().evaluate<string>(fn(RAEUME_AB), ABDECKUNG)).toBe("");
    }
    const danach = await missG("G-F zurückgenommen");
    produktidentitaet(danach, "G-F zurückgenommen");
    zeichenplatte(danach, "G-F zurückgenommen");
  });

  it("G-G · die zweite Grenze: eine Deckfarbe gleich dem Untergrund wird NICHT gefunden", async () => {
    const mitKontrast = await gSeite().evaluate<Farblage>(fn(FARBLAGE), [PANEL, WORT]);
    console.log(`JOB 3910 · G-G Farblage vorher ${JSON.stringify(mitKontrast)}`);
    expect(mitKontrast.fehler, "G-G: die Farblage liess sich nicht messen").toBe("");
    // Ohne echten Kontrast im Ausgangszustand sagte der Vergleich unten nichts.
    expect(
      mitKontrast.farbe,
      `G-G: Schrift und Untergrund sind schon vorher gleich (${mitKontrast.untergrund} an ${mitKontrast.knoten})`,
    ).not.toBe(mitKontrast.untergrund);
    const vorher = await missG("G-G vorher (mit Kontrast)");
    produktidentitaet(vorher, "G-G vorher (mit Kontrast)");
    zeichenplatte(vorher, "G-G vorher (mit Kontrast)");
    try {
      expect(
        await gSeite().evaluate<string>(fn(FAERBE), [PANEL, WORT, mitKontrast.untergrund]),
      ).toBe("");
      const ohneKontrast = await gSeite().evaluate<Farblage>(fn(FARBLAGE), [PANEL, WORT]);
      console.log(`JOB 3910 · G-G Farblage nachher ${JSON.stringify(ohneKontrast)}`);
      // Der Unterschied zwischen den beiden Läufen liegt AM FARBWERT und an nichts sonst — gemessen,
      // nicht gefolgert: die Schrift trägt jetzt den Untergrundwert, der Untergrund selbst ist gleich
      // geblieben, und der Träger dahinter ist derselbe Knoten.
      expect(ohneKontrast.farbe, "G-G: die Schriftfarbe steht nicht auf dem Untergrundwert").toBe(
        mitKontrast.untergrund,
      );
      expect(ohneKontrast.untergrund, "G-G: der Untergrund hat sich mitverändert").toBe(
        mitKontrast.untergrund,
      );
      expect(ohneKontrast.knoten, "G-G: hinter dem Wort steht ein anderer Knoten als vorher").toBe(
        mitKontrast.knoten,
      );
      const m = await missG("G-G nachher (ohne Kontrast)");
      const wort = m.klarwerkWort as Rechteck;
      // ERWARTET GRÜN — und das ist kein Mangel dieses Auftrags, sondern die zweite gemessene Grenze:
      // gemessen wird ANWESENHEIT, nie Kontrast. Der Schriftzug belegt seine Fläche, wird gezeichnet
      // und ist an allen fünf Punkten zu treffen; dass er dieselbe Farbe hat wie der Grund dahinter,
      // sieht keine Zeile dieser Datei. Der Gast sähe eine leere Platte.
      // Steht diese Zeile eines Tages auf rot, ist die Grenze weg — dann gehört der Kopf nachgeführt.
      expect(wort.gemalt, "G-G: die Grenze hat sich verschoben — `gemalt` sieht die Farbe").toBe(
        true,
      );
      expect(wort.trifft, `G-G: die Grenze hat sich verschoben — ${wort.treffer}`).toBe(true);
      expect(
        wort.getroffen,
        "G-G: die Grenze hat sich verschoben — nicht mehr alle Prüfpunkte tragen",
      ).toBe(PRUEFPUNKTE);
      produktidentitaet(m, "G-G");
      zeichenplatte(m, "G-G");
    } finally {
      expect(await gSeite().evaluate<string>(fn(FAERBE_ZURUECK))).toBe("");
    }
    const zurueckgestellt = await gSeite().evaluate<Farblage>(fn(FARBLAGE), [PANEL, WORT]);
    expect(zurueckgestellt.farbe, "G-G: die Schriftfarbe kam nicht zurück").toBe(mitKontrast.farbe);
    const danach = await missG("G-G zurückgenommen");
    produktidentitaet(danach, "G-G zurückgenommen");
    zeichenplatte(danach, "G-G zurückgenommen");
  });

  it("G-E · kein Scheingrün: ohne die Trefferpunkt-Messung sind G-A, G-B, G-C und G-F wieder blind", async () => {
    // Der zweite Übergabewert stellt die Prüfung künstlich auf „immer wahr". Bleibt bei GENAU
    // denselben vier Verstellungen dann alles grün, hängt das Rot der vier Fälle wirklich an dieser
    // Prüfung — und nicht an einer Nebenwirkung des Verstellens (Rechteck weg, `visibility`, Fokus).
    // Seit JOB 3910 trägt dieser Fall die Teilabdeckung mit: eine Erweiterung DESSELBEN Satzes, kein
    // zweiter G-E daneben.
    const abgedeckt = async (immerWahr: boolean): Promise<Rechteck> => {
      expect(await gSeite().evaluate<string>(fn(UEBERDECKE), [GRUPPE, ABDECKUNG, false])).toBe("");
      try {
        return (await missG(`G-E Verdeckung immerWahr=${immerWahr}`, immerWahr))
          .klarwerkWort as Rechteck;
      } finally {
        expect(await gSeite().evaluate<string>(fn(RAEUME_AB), ABDECKUNG)).toBe("");
      }
    };
    const gestellt = async (stil: string, immerWahr: boolean): Promise<Rechteck> => {
      await stelle(stil);
      try {
        return (await missG(`G-E ${stil} immerWahr=${immerWahr}`, immerWahr))
          .klarwerkWort as Rechteck;
      } finally {
        await zurueck();
      }
    };
    const halbAbgedeckt = async (immerWahr: boolean): Promise<Rechteck> => {
      await legeHalbAuf(`G-E/F immerWahr=${immerWahr}`);
      try {
        return (await missG(`G-E Teilabdeckung immerWahr=${immerWahr}`, immerWahr))
          .klarwerkWort as Rechteck;
      } finally {
        expect(await gSeite().evaluate<string>(fn(RAEUME_AB), ABDECKUNG)).toBe("");
      }
    };
    expect(
      (await abgedeckt(true)).trifft,
      "G-E/A: die abgeschaltete Prüfung meldet doch einen Fehltreffer",
    ).toBe(true);
    expect((await gestellt("clip-path: inset(100%)", true)).trifft, "G-E/B").toBe(true);
    expect((await gestellt("transform: translateY(-9999px)", true)).trifft, "G-E/C").toBe(true);
    expect((await halbAbgedeckt(true)).trifft, "G-E/F").toBe(true);
    // Gegenrichtung in DERSELBEN Lage: mit eingeschalteter Prüfung sind genau diese vier rot.
    expect((await abgedeckt(false)).trifft, "G-E/A scharf").toBe(false);
    expect((await gestellt("clip-path: inset(100%)", false)).trifft, "G-E/B scharf").toBe(false);
    expect((await gestellt("transform: translateY(-9999px)", false)).trifft, "G-E/C scharf").toBe(
      false,
    );
    expect((await halbAbgedeckt(false)).trifft, "G-E/F scharf").toBe(false);
    // Und nach allem: die Fläche steht wieder vollständig da.
    const danach = await missG("G-E Endstand");
    produktidentitaet(danach, "G-E Endstand");
    zeichenplatte(danach, "G-E Endstand");
    imFenster(danach, "G-E Endstand");
    expect(danach.firmenlogoZahl, "G-E Endstand: die Firmen-CI ist nicht mehr da").toBe(2);
    expect(g.seitenfehler, "G-E Endstand: die Seite hat einen Fehler geworfen").toEqual([]);
  });
});
