// @vitest-environment jsdom
// ================================================================================================
// JOB 3010 · D2 „KeinWissen" — DIE LUECKENFLAECHE AM LAUFENDEN PANEL GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// PEDIS ZEILE (PRIORITAETEN.md D2): „ehrliche Luecke: kein gesichertes Wissen, Weg zum Erfassen."
//
// DIE LAGE: der Zustand ist im Panel gebaut (`#ask-gap-block`, taskpane.html :630-646) und wird
// echt ausgeloest (`/api/ask` -> `outcome.kind === "gap"` -> :4296). Aber bis zu dieser Datei hing
// er in Tests AUSSCHLIESSLICH an Quelltext-Zeichenfolgen (word-addin-ask :878, mega75 :395,
// mega77 :63) — die bleiben gruen, wenn die Zeichenfolge steht und das Verhalten bricht, und werden
// rot, wenn die Zeichenfolge wandert und das Verhalten haelt. Der einzige Griff am Verhalten war
// ein Klick (job2703-d3 :182-185).
//
// WAS DIESE DATEI TUT — und NUR das:
//   1. Die SOLLWERTTABELLE: jeder tragende Wert aus `KeinWissen.dc.html` Z.27-35, mit Zeilenangabe
//      AUS DER VORLAGE GELESEN (nicht abgetippt) und ohne Renderer kanonisiert (Hex -> rgb(), px
//      bleibt). Gegen ein Literal gepinnt: aendert Pedi das Zielbild, sagt Fall S1, welcher Wert.
//   2. Die MESSUNG am laufenden Fenster: das AUSGELIEFERTE Inline-Skript (Fixture `createKlaraPanel`,
//      Muster job2703-d3), ueber die Transportbruecke an die ECHTE App (`buildApp`) — die ohne
//      Wissen auf `/api/ask` eine echte Luecke liefert. Gemessen wird, was ein Mensch sieht: welche
//      Traeger sichtbar sind, in welcher Reihenfolge, mit welchem Text, welcher Knopf `primary`
//      traegt, ob `#ask-gap-open-block` versteckt ist. Kein `expect(html).toContain(...)`.
//   3. Die ABWEICHUNGSTABELLE: je Sollwert Soll, Ist (oder „im Produkt nicht vorhanden"), Beleg und
//      eines von drei Urteilen. Reine Darstellungswerte (Farbe, Radius, Innenabstand, Schriftgrad)
//      sind in jsdom NICHT ehrlich messbar (kein Layout, kein Cascade-Ergebnis) und tragen
//      `nicht messbar` — die Chromium-Panelmessung baut JOB 3004; eine zweite waere eine zweite
//      Wahrheit. Die Urteile sind GEPINNT AUF DAS GEMESSENE, nicht auf das Erhoffte: der Test ist
//      gruen gegen den heutigen Stand und wird rot, wenn sich die Flaeche bewegt.
//   4. Die VERLUSTLISTE, umgekehrt gelesen: welchen Platz das Zielbild jedem heutigen Traeger gibt,
//      und was der Verlust der platzlosen kostet. Fall V haelt die Traeger fest, damit ein Umbau sie
//      nicht unbemerkt fallen laesst.
//   5. Der TOTE HREF: `#ask-gap-open-link` traegt im Markup (:645) `https://app.klarwerk.ai/erfassen`;
//      im Lueckenzustand ist der Block versteckt, und beim erfolgreichen Senden wird der href
//      (:4739-4741) durch `<origin>/capture/frontdoor?draft=<id>` ERSETZT — die Markup-Adresse wird
//      nie sichtbar ausgeliefert. Zwei Adressen fuer denselben Weg: Fall H haelt beide fest.
//   6. Die GEGENPROBE (Red-first-Ersatz eines Messauftrags): sieben Verfaelschungen im Speicher der
//      Testsitzung (Block versteckt, Titel vertauscht, `primary` entfernt, askGapBody und
//      askRuleNote verfaelscht, ein unmarkierter zweiter `button.primary`, ein unmarkierter
//      Text) kippen JEWEILS GENAU die Messgroesse, deren Name den Wert traegt
//      (Fall G); dazu die Zielbild-Gegenprobe `display: flex` → `block` auf Z.27 im Speicher, die
//      genau ihre Sollzeile kippt (Fall S2). `taskpane.html` und die Vorlage bleiben unangetastet.
//
// RUNDE 2 (BEN, 03.09.2026): Runde 1 liess die Flex-Deklarationen von Z.27/Z.34 pauschal aus und
// verglich askGapBody/askRuleNote nur gegen `panel.t()` — beides blieb bei einer Verfaelschung
// gruen. Jetzt hat jede Deklaration der beiden Zeilen ihre Sollzeile (S1 prueft die Deckung), und
// die heutigen Wortlaute sind als Literal gepinnt (TITEL_HEUTE, BODY_HEUTE, REGEL_HEUTE, AKTION_HEUTE).
// RUNDE 3 (BEN, 03.09.2026): Runde 2 inventarisierte nur `[data-t], [id]` — ein zweiter sichtbarer
// `button.primary` ohne Marker und ein unmarkierter Text blieben unentdeckt. Jetzt ist die Inventur
// MARKERFREI (`inventar`, `primaries`): jede Aktion und jedes Element mit eigenem Text zaehlt, M18
// nennt alle sichtbaren Aktionen im Block, M19 alle sichtbaren `primary` im ganzen Panel.
// RUNDE 4 (BEN, 03.09.2026): Runde 3 las die Lupe (Z.28) ohne `fill` und ohne ihren Kreis — ein
// entfernter Kreis oder eine schwarze Fuellung blieb gruen. Jetzt tragen `fill`, Kreis-Existenz und
// Kreisgeometrie (cx, cy, r) eigene Sollzeilen; S2 verfaelscht jede davon im Speicher.
//
// WAS DIESE DATEI NICHT TUT: nichts umbauen (taskpane.html ist in JOB 3004 gesperrt), keine
// Empfehlung, keine Aussage, ob eine Abweichung „behoben werden sollte" — das entscheidet Pedi.
// Kopfband (Z.17-20, D4) und Frage-Pille (Z.22-25, D1/JOB 3004) sind ausdruecklich nicht Gegenstand.
import { existsSync, readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { type KlaraPanel, createKlaraPanel } from "../app/klara-panel-fixture";
import { type Bruecke, bruecke } from "../library/job2703-bruecke";

// ================================================================================================
// TEIL 1 — DIE SOLLWERTTABELLE, aus KeinWissen.dc.html gelesen und kanonisiert.
// ================================================================================================

const ZIELBILD =
  "/Users/peterkohnert/Documents/Projekt_klarwerk/DESIGN_ZIELBILD_20260827/KeinWissen.dc.html";
const zielbildDa = existsSync(ZIELBILD);
const ZEILEN: readonly string[] = zielbildDa ? readFileSync(ZIELBILD, "utf8").split("\n") : [];

/**
 * Der Zeilensatz, aus dem die Leser gerade lesen. Im Regelfall die Vorlage von der Platte; in der
 * Zielbild-Gegenprobe (S2) ein im Speicher verfaelschter Satz — die Vorlage selbst wird NIE
 * beschrieben (sie liegt ausserhalb des Arbeitsbaums und ist nur lesend Pflichtquelle).
 */
let AKTIV: readonly string[] = ZEILEN;

function zeile(n: number): string {
  const z = AKTIV[n - 1];
  if (z === undefined) {
    throw new Error(`Zielbild hat keine Zeile ${n}`);
  }
  return z;
}

/** Das style-Attribut der Vorlagenzeile — die Vorlage traegt je Zeile genau ein Element. */
function stil(n: number): string {
  const m = /style="([^"]*)"/.exec(zeile(n));
  if (m?.[1] === undefined) {
    throw new Error(`Zielbild Z.${n} traegt kein style-Attribut`);
  }
  return m[1];
}

function eigenschaft(n: number, name: string): string {
  const re = new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+)`, "i");
  const m = re.exec(stil(n));
  if (m?.[1] === undefined) {
    throw new Error(`Zielbild Z.${n} setzt ›${name}‹ nicht`);
  }
  return m[1].trim();
}

function attribut(n: number, name: string): string {
  const re = new RegExp(`\\s${name}="([^"]*)"`);
  const m = re.exec(zeile(n));
  if (m?.[1] === undefined) {
    throw new Error(`Zielbild Z.${n} traegt kein Attribut ›${name}‹`);
  }
  return m[1];
}

/** Der Attributrumpf des ersten `<circle …>` der Vorlagenzeile — oder null, wenn keiner da ist. */
function kreis(n: number): string | null {
  const m = /<circle\s([^>]*)>/.exec(zeile(n));
  return m?.[1] ?? null;
}

/** Ein Attribut des Kreises; fehlt der Kreis, lautet der Wert ehrlich „kein circle". */
function kreisAttribut(n: number, name: string): string {
  const k = kreis(n);
  if (k === null) {
    return "kein circle";
  }
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(k);
  if (m?.[1] === undefined) {
    throw new Error(`Zielbild Z.${n}: der Kreis traegt kein Attribut ›${name}‹`);
  }
  return m[1];
}

/** Der sichtbare Text einer Vorlagenzeile (Tags entfernt, Leerraum gefaltet). */
function wortlaut(n: number): string {
  return zeile(n)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kanonisierung OHNE Renderer: Hex-Farben -> rgb(r, g, b); px-Werte bleiben, wie sie sind. */
function kanon(wert: string): string {
  return wert.replace(/#([0-9a-f]{3}|[0-9a-f]{6})\b/gi, (_, hex: string) => {
    const h = hex.length === 3 ? hex.replace(/./g, (c) => c + c) : hex;
    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    return `rgb(${r}, ${g}, ${b})`;
  });
}

type Art = "struktur" | "wortlaut" | "darstellung";

interface Sollwert {
  kennung: string;
  /** Zeile(n) der Vorlage, aus denen der Wert gelesen wird. */
  zeile: string;
  art: Art;
  /** Der Traeger im Zielbild, in Worten. */
  traeger: string;
  /** Liest den Rohwert aus der Vorlage; `kanon` laeuft darueber. */
  lies: () => string;
}

const NICHT_MESSBAR = "nicht messbar (braucht die Chromium-Panelmessung aus JOB 3004)";
const NICHT_VORHANDEN = "im Produkt nicht vorhanden";

const SOLL_LESART: readonly Sollwert[] = [
  // ---- Z.27 · die Flaeche: ruhig, mittig, KEIN Kasten ----------------------------------------
  // JOB 3010 Runde 2 (BEN, Korrekturpflicht 1): JEDE Deklaration der Zeile bekommt ihre Sollzeile —
  // auch die Flex-Deklarationen, die erst der Browser zu einem Layout rechnet. Sie sind als
  // Deklaration wertgenau lesbar; nur ihr ERGEBNIS ist hier nicht messbar (Urteil `nicht messbar`).
  {
    kennung: "Z.27 flaeche-display",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "display"),
  },
  {
    kennung: "Z.27 flaeche-flex-grow",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "flex-grow"),
  },
  {
    kennung: "Z.27 flaeche-flex-direction",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "flex-direction"),
  },
  {
    kennung: "Z.27 flaeche-align-items",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "align-items"),
  },
  {
    kennung: "Z.27 flaeche-justify-content",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "justify-content"),
  },
  {
    kennung: "Z.27 flaeche-ohne-kasten",
    zeile: "Z.27",
    art: "struktur",
    traeger: "die zentrierte Flaeche (div, flex-grow 1)",
    lies: () => {
      const s = stil(27);
      if (/background|border/.test(s)) {
        throw new Error("Zielbild Z.27 traegt jetzt einen Kasten — Lesart nachfuehren");
      }
      return "kein Kasten (weder background noch border)";
    },
  },
  {
    kennung: "Z.27 flaeche-textausrichtung",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "text-align"),
  },
  {
    kennung: "Z.27 flaeche-abstand-gap",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "gap"),
  },
  {
    kennung: "Z.27 flaeche-innenabstand",
    zeile: "Z.27",
    art: "darstellung",
    traeger: "die zentrierte Flaeche",
    lies: () => eigenschaft(27, "padding"),
  },
  // ---- Z.28 · die Lupe ------------------------------------------------------------------------
  {
    kennung: "Z.28 lupe-vorhanden",
    zeile: "Z.28",
    art: "struktur",
    traeger: "svg 36x36 mit Pfad M21 21l-4.35-4.35 (Lupe)",
    lies: () => {
      const d = /<path d="([^"]*)"><\/path><\/svg>/.exec(zeile(28))?.[1];
      if (d === undefined) {
        throw new Error("Zielbild Z.28: Lupenpfad nicht lesbar");
      }
      return `svg ${attribut(28, "width")}x${attribut(28, "height")} mit Pfad ${d}`;
    },
  },
  {
    kennung: "Z.28 lupe-strichfarbe",
    zeile: "Z.28",
    art: "darstellung",
    traeger: "die Lupe",
    lies: () => attribut(28, "stroke"),
  },
  {
    kennung: "Z.28 lupe-strichstaerke",
    zeile: "Z.28",
    art: "darstellung",
    traeger: "die Lupe",
    lies: () => attribut(28, "stroke-width"),
  },
  // JOB 3010 Runde 4 (BEN, Korrekturpflicht 1): die Lupe ist Strich OHNE Fuellung, und ihr Glas ist
  // ein Kreis mit fester Geometrie. Runde 3 las nur Groesse, Griffpfad, Strichfarbe und -staerke —
  // ein fehlender Kreis oder eine schwarze Fuellung blieb gruen. `fill` steht am svg-Element (das
  // erste fill-Attribut der Zeile); der Kreis wird als eigenes Element gelesen, seine Geometrie
  // Wert fuer Wert. Fehlt der Kreis, lesen die Geometriezeilen „kein circle" — sie gehoeren zu ihm.
  {
    kennung: "Z.28 lupe-fuellung",
    zeile: "Z.28",
    art: "darstellung",
    traeger: "die Lupe (svg fill)",
    lies: () => attribut(28, "fill"),
  },
  {
    kennung: "Z.28 lupe-kreis-vorhanden",
    zeile: "Z.28",
    art: "struktur",
    traeger: "das Glas der Lupe: <circle>",
    lies: () => (kreis(28) === null ? "kein circle" : "circle vorhanden"),
  },
  {
    kennung: "Z.28 lupe-kreis-cx",
    zeile: "Z.28",
    art: "darstellung",
    traeger: "das Glas der Lupe",
    lies: () => kreisAttribut(28, "cx"),
  },
  {
    kennung: "Z.28 lupe-kreis-cy",
    zeile: "Z.28",
    art: "darstellung",
    traeger: "das Glas der Lupe",
    lies: () => kreisAttribut(28, "cy"),
  },
  {
    kennung: "Z.28 lupe-kreis-r",
    zeile: "Z.28",
    art: "darstellung",
    traeger: "das Glas der Lupe",
    lies: () => kreisAttribut(28, "r"),
  },
  // ---- Z.29 · EIN Satz ------------------------------------------------------------------------
  {
    kennung: "Z.29 satz-wortlaut",
    zeile: "Z.29",
    art: "wortlaut",
    traeger: "der eine Satz (div 16px/1.55)",
    lies: () => wortlaut(29),
  },
  {
    kennung: "Z.29 satz-anzahl-texttraeger",
    zeile: "Z.29",
    art: "struktur",
    traeger: "der eine Satz — die Flaeche traegt genau EINEN Textblock vor der Aktion",
    lies: () => "1",
  },
  {
    kennung: "Z.29 satz-schriftgrad",
    zeile: "Z.29",
    art: "darstellung",
    traeger: "der eine Satz",
    lies: () => eigenschaft(29, "font-size"),
  },
  {
    kennung: "Z.29 satz-zeilenhoehe",
    zeile: "Z.29",
    art: "darstellung",
    traeger: "der eine Satz",
    lies: () => eigenschaft(29, "line-height"),
  },
  {
    kennung: "Z.29 satz-farbe",
    zeile: "Z.29",
    art: "darstellung",
    traeger: "der eine Satz",
    lies: () => eigenschaft(29, "color"),
  },
  // ---- Z.30 · die Hauptaktion „Frage aendern" -------------------------------------------------
  {
    kennung: "Z.30 hauptaktion-wortlaut",
    zeile: "Z.30",
    art: "wortlaut",
    traeger: "der weisse Knopf — die Hauptaktion des Zielbilds",
    lies: () => wortlaut(30),
  },
  {
    kennung: "Z.30 knopf-frage-aendern-vorhanden",
    zeile: "Z.30",
    art: "struktur",
    traeger: "der weisse Knopf",
    lies: () => `Knopf ›${wortlaut(30)}‹ vorhanden`,
  },
  {
    kennung: "Z.30 knopf-innenabstand",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "padding"),
  },
  {
    kennung: "Z.30 knopf-hintergrund",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "background"),
  },
  {
    kennung: "Z.30 knopf-rand",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "border"),
  },
  {
    kennung: "Z.30 knopf-radius",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "border-radius"),
  },
  {
    kennung: "Z.30 knopf-schriftgrad",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "font-size"),
  },
  {
    kennung: "Z.30 knopf-schnitt",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "font-weight"),
  },
  {
    kennung: "Z.30 knopf-farbe",
    zeile: "Z.30",
    art: "darstellung",
    traeger: "der weisse Knopf",
    lies: () => eigenschaft(30, "color"),
  },
  // ---- Z.31 · die Nebenaktion „Als offene Frage an KLARWERK geben" -----------------------------
  {
    kennung: "Z.31 nebenaktion-wortlaut",
    zeile: "Z.31",
    art: "wortlaut",
    traeger: "der Textlink (a, 12px) — die Nebenaktion des Zielbilds",
    lies: () => wortlaut(31),
  },
  {
    kennung: "Z.31 nebenaktion-form",
    zeile: "Z.31",
    art: "struktur",
    traeger: "der Textlink",
    lies: () => {
      if (!/^\s*<a /.test(zeile(31))) {
        throw new Error("Zielbild Z.31 ist kein Textlink mehr — Lesart nachfuehren");
      }
      return "a (Textlink, ohne primary)";
    },
  },
  {
    kennung: "Z.31 offene-frage-weg-vorhanden",
    zeile: "Z.31",
    art: "struktur",
    traeger: "der Textlink — der Weg ›offene Frage nach KLARWERK‹ bleibt im Zielbild erhalten",
    lies: () => "Weg ›offene Frage nach KLARWERK‹ vorhanden",
  },
  {
    kennung: "Z.31 nebenaktion-schriftgrad",
    zeile: "Z.31",
    art: "darstellung",
    traeger: "der Textlink",
    lies: () => eigenschaft(31, "font-size"),
  },
  // ---- Z.28-31 · die Reihenfolge ----------------------------------------------------------------
  {
    kennung: "Z.28-31 reihenfolge auskunft-vor-aktion",
    zeile: "Z.28-31",
    art: "struktur",
    traeger: "die Flaeche: Lupe, Satz, Hauptaktion, Nebenaktion — Auskunft VOR jeder Aktion",
    lies: () => {
      // Aus der Vorlage gelesen: Z.29 (Satz) liegt vor Z.30 (Knopf) und Z.31 (Link).
      const satz = AKTIV.findIndex((z) => z.includes(wortlaut(29)));
      const knopf = AKTIV.findIndex((z) => z.includes(wortlaut(30)));
      const link = AKTIV.findIndex((z) => z.includes(wortlaut(31)));
      if (!(satz >= 0 && satz < knopf && knopf < link)) {
        throw new Error("Zielbild: Reihenfolge Satz/Knopf/Link hat sich veraendert");
      }
      return "Auskunft vor Aktion";
    },
  },
  // ---- Z.34-35 · die Fusszeile -----------------------------------------------------------------
  {
    kennung: "Z.35 fusszeile-wortlaut",
    zeile: "Z.35",
    art: "wortlaut",
    traeger: "die Fusszeile (11px, ruhiges Grau)",
    lies: () => wortlaut(35),
  },
  {
    kennung: "Z.35 fusszeile-schriftgrad",
    zeile: "Z.35",
    art: "darstellung",
    traeger: "die Fusszeile",
    lies: () => eigenschaft(35, "font-size"),
  },
  {
    kennung: "Z.35 fusszeile-farbe",
    zeile: "Z.35",
    art: "darstellung",
    traeger: "die Fusszeile",
    lies: () => eigenschaft(35, "color"),
  },
  {
    kennung: "Z.34 fusszeile-innenabstand",
    zeile: "Z.34",
    art: "darstellung",
    traeger: "die Fusszeile (ihr Rahmen)",
    lies: () => eigenschaft(34, "padding"),
  },
  {
    kennung: "Z.34 fusszeile-display",
    zeile: "Z.34",
    art: "darstellung",
    traeger: "die Fusszeile (ihr Rahmen)",
    lies: () => eigenschaft(34, "display"),
  },
  {
    kennung: "Z.34 fusszeile-justify-content",
    zeile: "Z.34",
    art: "darstellung",
    traeger: "die Fusszeile (ihr Rahmen)",
    lies: () => eigenschaft(34, "justify-content"),
  },
];

type SollZeile = Sollwert & { soll: string };

/** Die Sollwerttabelle aus einem Zeilensatz lesen und kanonisieren. */
function sollwerte(zeilen: readonly string[]): SollZeile[] {
  const vorher = AKTIV;
  AKTIV = zeilen;
  try {
    return SOLL_LESART.map((s) => ({ ...s, soll: kanon(s.lies()) }));
  } finally {
    AKTIV = vorher;
  }
}

/** Die Sollwerttabelle der Vorlage von der Platte. Leer, wenn das Zielbild nicht lesbar ist. */
const SOLL: readonly SollZeile[] = zielbildDa ? sollwerte(ZEILEN) : [];

/**
 * DER PIN auf das Zielbild vom 27.08.2026. Aendert Pedi die Vorlage (Klick, „Save"), meldet S1 den
 * geaenderten Wert mit Kennung — statt dass die Abweichungstabelle still gegen ein anderes Bild
 * laeuft.
 */
const SOLL_ERWARTET: Readonly<Record<string, string>> = {
  "Z.27 flaeche-display": "flex",
  "Z.27 flaeche-flex-grow": "1",
  "Z.27 flaeche-flex-direction": "column",
  "Z.27 flaeche-align-items": "center",
  "Z.27 flaeche-justify-content": "center",
  "Z.27 flaeche-ohne-kasten": "kein Kasten (weder background noch border)",
  "Z.27 flaeche-textausrichtung": "center",
  "Z.27 flaeche-abstand-gap": "20px",
  "Z.27 flaeche-innenabstand": "0 32px",
  "Z.28 lupe-vorhanden": "svg 36x36 mit Pfad M21 21l-4.35-4.35",
  "Z.28 lupe-strichfarbe": "rgb(82, 91, 107)",
  "Z.28 lupe-strichstaerke": "1.5",
  "Z.28 lupe-fuellung": "none",
  "Z.28 lupe-kreis-vorhanden": "circle vorhanden",
  "Z.28 lupe-kreis-cx": "11",
  "Z.28 lupe-kreis-cy": "11",
  "Z.28 lupe-kreis-r": "7",
  "Z.29 satz-wortlaut": "Dazu liegt kein freigegebenes Firmenwissen vor.",
  "Z.29 satz-anzahl-texttraeger": "1",
  "Z.29 satz-schriftgrad": "16px",
  "Z.29 satz-zeilenhoehe": "1.55",
  "Z.29 satz-farbe": "rgb(26, 34, 51)",
  "Z.30 hauptaktion-wortlaut": "Frage ändern",
  "Z.30 knopf-frage-aendern-vorhanden": "Knopf ›Frage ändern‹ vorhanden",
  "Z.30 knopf-innenabstand": "10px 22px",
  "Z.30 knopf-hintergrund": "rgb(255, 255, 255)",
  "Z.30 knopf-rand": "1px solid rgb(233, 229, 222)",
  "Z.30 knopf-radius": "10px",
  "Z.30 knopf-schriftgrad": "13.5px",
  "Z.30 knopf-schnitt": "600",
  "Z.30 knopf-farbe": "rgb(26, 34, 51)",
  "Z.31 nebenaktion-wortlaut": "Als offene Frage an KLARWERK geben",
  "Z.31 nebenaktion-form": "a (Textlink, ohne primary)",
  "Z.31 offene-frage-weg-vorhanden": "Weg ›offene Frage nach KLARWERK‹ vorhanden",
  "Z.31 nebenaktion-schriftgrad": "12px",
  "Z.28-31 reihenfolge auskunft-vor-aktion": "Auskunft vor Aktion",
  "Z.35 fusszeile-wortlaut":
    "Klara erfindet keine Antworten — eine Lücke ist eine ehrliche Auskunft.",
  "Z.35 fusszeile-schriftgrad": "11px",
  "Z.35 fusszeile-farbe": "rgb(82, 91, 107)",
  "Z.34 fusszeile-innenabstand": "12px 16px",
  "Z.34 fusszeile-display": "flex",
  "Z.34 fusszeile-justify-content": "center",
};

/** BEWUSST NICHT AUFGENOMMEN — mit fachlicher Begruendung, nicht stillschweigend. */
const NICHT_AUFGENOMMEN: readonly { was: string; wo: string; warum: string }[] = [
  {
    was: "Artboard 360px, Hintergrund #FAF8F5, min-height 720px",
    wo: "Z.15",
    warum: "Rahmen des ganzen Panels, nicht des Lueckenzustands; geteilt mit D1/D3/D4.",
  },
  {
    was: "dunkles Kopfband (Klara / KLARWERK / Zeitstempel)",
    wo: "Z.17-20",
    warum: "D4 (SchlankesPanel), ausdruecklich nicht dieser Auftrag.",
  },
  {
    was: "Frage-Pille mit Stift-Symbol",
    wo: "Z.22-25",
    warum: "D1, baut JOB 3004 — ausdruecklich nicht dieser Auftrag.",
  },
  {
    was: "viewBox, stroke-linecap, stroke-linejoin der Lupe",
    wo: "Z.28",
    warum: "Nebendetails eines Symbols, das im Produkt fehlt; Groesse, Pfad und Farbe tragen.",
  },
  {
    was: 'href="#" des Textlinks',
    wo: "Z.31",
    warum:
      "Platzhalter der Vorlage, kein Sollwert. Bemerkenswert fuer den Befund: AUCH das Zielbild " +
      "nennt keine Zieladresse fuer den Weg — dieselbe Lage wie der tote Markup-href im Produkt.",
  },
  {
    was: "body-Schriftfamilie, Linkfarben a / a:hover",
    wo: "Z.11-12",
    warum: "Helmet-Globals der Vorlage, gelten fuer alle Artboards; keine D2-Aussage.",
  },
];

// ================================================================================================
// TEIL 2 — DIE MESSUNG am laufenden Fenster.
// ================================================================================================

// Schmale DOM-Typen: der Gate-tsc laeuft ohne DOM-lib (tsconfig.json, lib ES2022). Dieselbe Loesung
// wie die Panel-Fixture. `getAttribute("class")` statt `className`: bei SVG-Elementen ist
// `className` ein SVGAnimatedString, kein Text.
interface DomKnoten {
  nodeType: number;
  textContent: string | null;
}

interface DomEl {
  tagName: string;
  id: string;
  textContent: string | null;
  href?: string;
  disabled?: boolean;
  parentElement: DomEl | null;
  children: ArrayLike<DomEl>;
  childNodes: ArrayLike<DomKnoten>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  appendChild(el: DomEl): DomEl;
  removeChild(el: DomEl): DomEl;
  querySelector(selector: string): DomEl | null;
  querySelectorAll(selector: string): ArrayLike<DomEl>;
  click?(): void;
}

interface DomGlobals {
  document: {
    body: DomEl;
    querySelector(selector: string): DomEl | null;
    createElement(tag: string): DomEl;
  };
  window: { location: { origin: string } };
}

const dg = globalThis as unknown as DomGlobals;

function dom(selector: string): DomEl {
  const el = dg.document.querySelector(selector);
  if (el === null) {
    throw new Error(`Panel: Stelle ${selector} existiert nicht`);
  }
  return el;
}

function klassen(el: DomEl): string[] {
  return (el.getAttribute("class") ?? "").split(/\s+/).filter((k) => k.length > 0);
}

function selbstVersteckt(el: DomEl): boolean {
  return klassen(el).includes("hidden");
}

/**
 * Sichtbarkeit, wie das Panel sie schaltet: die Klasse `hidden` (`.hidden { display: none }`,
 * taskpane.html :223) an der Stelle oder einem Vorfahren. jsdom rechnet kein Layout — das ist der
 * einzige Mechanismus, ueber den dieses Panel Flaechen ein- und ausblendet, und er ist am DOM lesbar.
 */
function sichtbarBis(el: DomEl, grenze: DomEl | null): boolean {
  for (let e: DomEl | null = el; e !== null && e !== grenze; e = e.parentElement) {
    if (selbstVersteckt(e)) {
      return false;
    }
  }
  return true;
}

function text(el: DomEl | null): string {
  return (el?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Die Kennung eines Traegers: die id, wenn er eine hat (Selektor), sonst sein data-t-Schluessel,
 * sonst — UNMARKIERT — seine Form und sein Wortlaut. JOB 3010 Runde 3 (BEN): die Inventur darf
 * nicht auf Marker vorfiltern; ein Knopf oder Text ohne id/data-t ist fuer den Menschen genauso da.
 */
function name(el: DomEl): string {
  if (el.id.length > 0) {
    return `#${el.id}`;
  }
  const dt = el.getAttribute("data-t");
  if (dt !== null && dt.length > 0) {
    return dt;
  }
  return `${el.tagName.toLowerCase()}›${text(el)}‹`;
}

const AKTIONS_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

function istAktion(el: DomEl): boolean {
  return AKTIONS_TAGS.has(el.tagName.toUpperCase());
}

/** Der Text, den das Element SELBST traegt (eigene Textknoten, nicht die der Kinder). */
function eigenerText(el: DomEl): string {
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * DIE MARKERFREIE INVENTUR: jedes sichtbare Element unterhalb von `wurzel`, das eine Aktion ist
 * (button/a/input/select/textarea) oder eigenen Text traegt — in Dokumentreihenfolge, ohne
 * Vorfilter auf id oder data-t. Reine Behaelter (div ohne eigenen Text) erscheinen nicht.
 */
function inventar(wurzel: DomEl): DomEl[] {
  return Array.from(wurzel.querySelectorAll("*")).filter(
    (e) => sichtbarBis(e, wurzel) && (istAktion(e) || eigenerText(e).length > 0),
  );
}

/** Alle sichtbaren Traeger mit Klasse `primary` unterhalb von `wurzel` (bis `grenze` geprueft). */
function primaries(wurzel: DomEl, grenze: DomEl | null): string[] {
  return Array.from(wurzel.querySelectorAll("*"))
    .filter((e) => sichtbarBis(e, grenze) && klassen(e).includes("primary"))
    .map(name);
}

/** Eine Messgroesse: Kennung -> gemessener Wert. Alles Zeichenketten, damit die Gegenprobe diffen kann. */
type Messung = Readonly<Record<string, string>>;

const M = {
  blockSichtbar: "M1 · #ask-gap-block sichtbar (keine hidden-Klasse an Block oder Vorfahren)",
  titel: "M2 · Wortlaut askGapTitle",
  hauptaktion:
    "M3 · Hauptaktion im Lueckenblock (ALLE sichtbaren Traeger mit Klasse primary, markerfrei)",
  reihenfolge:
    "M4 · Reihenfolge ALLER sichtbaren Text- und Aktionstraeger im Lueckenblock (markerfrei)",
  openVersteckt: "M5 · #ask-gap-open-block versteckt",
  openHref: "M6 · href von #ask-gap-open-link",
  kasten: "M7 · Klassen des Kastens um askGapTitle",
  svgs: "M8 · SVG-Elemente im Lueckenblock",
  body: "M9 · Wortlaut askGapBody",
  regel: "M10 · Wortlaut askRuleNote im Lueckenblock",
  aktionText: "M11 · Wortlaut #ask-gap-send-btn",
  aktionForm: "M12 · Elementform der Aktion ›offene Frage‹",
  frageAendern: "M13 · ›Frage ändern‹ im Panel-Rumpf",
  fusszeile: "M14 · Fusszeilensatz ›Klara erfindet keine Antworten‹ im Panel-Rumpf",
  texttraeger: "M15 · sichtbare Texttraeger im Lueckenblock ohne Aktionen (Anzahl, markerfrei)",
  status: "M16 · #ask-status sichtbar",
  antwort: "M17 · #ask-answer-block sichtbar",
  aktionen:
    "M18 · sichtbare Aktionstraeger im Lueckenblock (button/a/input/select/textarea, markerfrei)",
  primaryPanel: "M19 · sichtbare Traeger mit Klasse primary im GANZEN Panel",
} as const;

function messen(): Messung {
  const block = dom("#ask-gap-block");
  const titel = dom('#ask-gap-block [data-t="askGapTitle"]');
  const kasten = titel.parentElement;
  if (kasten === null) {
    throw new Error("askGapTitle ohne Elternelement");
  }
  // Runde 3 (BEN): KEIN Vorfilter auf `[data-t], [id]` mehr — ein zweiter, unmarkierter Knopf oder
  // ein unmarkierter Text blieb sonst unsichtbar fuer die Messung, nicht aber fuer den Menschen.
  const imBlock = inventar(block);
  const primary = primaries(block, block);
  const aktionen = imBlock.filter(istAktion).map(name);
  const sendBtn = dom("#ask-gap-send-btn");
  const openBlock = dom("#ask-gap-open-block");
  const openLink = dom("#ask-gap-open-link");
  const rumpf = text(dg.document.body);
  const texttraeger = imBlock.filter((e) => !istAktion(e));
  const primaryPanel = primaries(dg.document.body, null);
  return {
    [M.blockSichtbar]: sichtbarBis(block, null) ? "ja" : "nein",
    [M.titel]: text(titel),
    [M.hauptaktion]: primary.length === 0 ? "keine" : primary.join(", "),
    [M.reihenfolge]: imBlock.map(name).join(" > "),
    [M.openVersteckt]: sichtbarBis(openBlock, block) ? "nein" : "ja",
    [M.openHref]: openLink.getAttribute("href") ?? "",
    [M.kasten]: klassen(kasten).join(" "),
    [M.svgs]: String(block.querySelectorAll("svg").length),
    [M.body]: text(block.querySelector('[data-t="askGapBody"]')),
    [M.regel]: text(block.querySelector('[data-t="askRuleNote"]')),
    [M.aktionText]: text(sendBtn),
    [M.aktionForm]: `${sendBtn.tagName.toLowerCase()}${klassen(sendBtn)
      .map((k) => `.${k}`)
      .join("")}`,
    [M.frageAendern]: rumpf.includes("Frage ändern") ? "ja" : "nein",
    [M.fusszeile]: rumpf.includes("Klara erfindet keine Antworten") ? "ja" : "nein",
    [M.texttraeger]: String(texttraeger.length),
    [M.status]: sichtbarBis(dom("#ask-status"), null) ? "ja" : "nein",
    [M.antwort]: sichtbarBis(dom("#ask-answer-block"), null) ? "ja" : "nein",
    [M.aktionen]: aktionen.length === 0 ? "keine" : aktionen.join(", "),
    [M.primaryPanel]: primaryPanel.length === 0 ? "keine" : primaryPanel.join(", "),
  };
}

// ================================================================================================
// TEIL 3 — DIE ABWEICHUNGSTABELLE: Soll gegen Ist, drei Urteile.
// ================================================================================================

type Urteil = "erfüllt" | "abweichend" | typeof NICHT_MESSBAR;

interface Abweichung {
  kennung: string;
  zeile: string;
  soll: string;
  ist: string;
  beleg: string;
  urteil: Urteil;
}

/**
 * Je Sollwert: WO im Produkt der Traeger liegt (Beleg) und WAS dort gemessen wurde — `null` heisst
 * „im Produkt nicht vorhanden". Fuer Darstellungswerte liefert `ist` nur die Existenz des Traegers:
 * ist er da, gilt `nicht messbar`; fehlt er, ist der Wert `abweichend`, weil nichts ihn tragen kann.
 */
const IST: Readonly<Record<string, { beleg: string; ist: (m: Messung) => string | null }>> = {
  "Z.27 flaeche-display": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-flex-grow": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-flex-direction": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-align-items": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-justify-content": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-ohne-kasten": {
    beleg: "div um askGapTitle (taskpane.html :630)",
    ist: (m) =>
      m[M.kasten] === "" ? "kein Kasten (weder background noch border)" : `Kasten ›${m[M.kasten]}‹`,
  },
  "Z.27 flaeche-textausrichtung": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-abstand-gap": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.27 flaeche-innenabstand": { beleg: "#ask-gap-block", ist: () => "#ask-gap-block" },
  "Z.28 lupe-vorhanden": {
    beleg: "#ask-gap-block svg",
    ist: (m) => (m[M.svgs] === "0" ? null : `${m[M.svgs]} svg`),
  },
  "Z.28 lupe-strichfarbe": {
    beleg: "#ask-gap-block svg",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.28 lupe-strichstaerke": {
    beleg: "#ask-gap-block svg",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.28 lupe-fuellung": {
    beleg: "#ask-gap-block svg",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.28 lupe-kreis-vorhanden": {
    beleg: "#ask-gap-block svg circle",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.28 lupe-kreis-cx": {
    beleg: "#ask-gap-block svg circle",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.28 lupe-kreis-cy": {
    beleg: "#ask-gap-block svg circle",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.28 lupe-kreis-r": {
    beleg: "#ask-gap-block svg circle",
    ist: (m) => (m[M.svgs] === "0" ? null : "svg"),
  },
  "Z.29 satz-wortlaut": { beleg: '[data-t="askGapTitle"] (:631)', ist: (m) => m[M.titel] ?? null },
  "Z.29 satz-anzahl-texttraeger": {
    beleg:
      "markerfreie Inventur des Lueckenblocks: askGapTitle, askGapBody, askRuleNote (:631-641)",
    ist: (m) => m[M.texttraeger] ?? null,
  },
  "Z.29 satz-schriftgrad": { beleg: '[data-t="askGapTitle"]', ist: () => "askGapTitle" },
  "Z.29 satz-zeilenhoehe": { beleg: '[data-t="askGapTitle"]', ist: () => "askGapTitle" },
  "Z.29 satz-farbe": { beleg: '[data-t="askGapTitle"]', ist: () => "askGapTitle" },
  "Z.30 hauptaktion-wortlaut": {
    beleg: "der Traeger mit class=primary im Lueckenblock (#ask-gap-send-btn, :643)",
    ist: (m) => (m[M.hauptaktion] === "keine" ? null : (m[M.aktionText] ?? null)),
  },
  "Z.30 knopf-frage-aendern-vorhanden": {
    beleg: "Panel-Rumpf, Textsuche",
    ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf ›Frage ändern‹ vorhanden" : null),
  },
  "Z.30 knopf-innenabstand": {
    beleg: "—",
    ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null),
  },
  "Z.30 knopf-hintergrund": {
    beleg: "—",
    ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null),
  },
  "Z.30 knopf-rand": { beleg: "—", ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null) },
  "Z.30 knopf-radius": { beleg: "—", ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null) },
  "Z.30 knopf-schriftgrad": {
    beleg: "—",
    ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null),
  },
  "Z.30 knopf-schnitt": { beleg: "—", ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null) },
  "Z.30 knopf-farbe": { beleg: "—", ist: (m) => (m[M.frageAendern] === "ja" ? "Knopf" : null) },
  "Z.31 nebenaktion-wortlaut": {
    beleg: "#ask-gap-send-btn (:643, askGapSendCta :2119)",
    ist: (m) => m[M.aktionText] ?? null,
  },
  "Z.31 nebenaktion-form": { beleg: "#ask-gap-send-btn", ist: (m) => m[M.aktionForm] ?? null },
  "Z.31 offene-frage-weg-vorhanden": {
    beleg: "#ask-gap-send-btn sichtbar, klickbar (job2703-d3 W2)",
    ist: (m) =>
      m[M.reihenfolge]?.includes("#ask-gap-send-btn")
        ? "Weg ›offene Frage nach KLARWERK‹ vorhanden"
        : null,
  },
  "Z.31 nebenaktion-schriftgrad": { beleg: "#ask-gap-send-btn", ist: () => "#ask-gap-send-btn" },
  "Z.28-31 reihenfolge auskunft-vor-aktion": {
    beleg: "M4 (Reihenfolge der sichtbaren Traeger)",
    ist: (m) => {
      const folge = (m[M.reihenfolge] ?? "").split(" > ");
      const auskunft = folge.indexOf("askGapTitle");
      const aktion = folge.indexOf("#ask-gap-send-btn");
      if (auskunft < 0 || aktion < 0) {
        return null;
      }
      return auskunft < aktion ? "Auskunft vor Aktion" : "Aktion vor Auskunft";
    },
  },
  "Z.35 fusszeile-wortlaut": {
    beleg: "Panel-Rumpf, Textsuche",
    ist: (m) => (m[M.fusszeile] === "ja" ? "vorhanden" : null),
  },
  "Z.35 fusszeile-schriftgrad": {
    beleg: "—",
    ist: (m) => (m[M.fusszeile] === "ja" ? "Fuss" : null),
  },
  "Z.35 fusszeile-farbe": { beleg: "—", ist: (m) => (m[M.fusszeile] === "ja" ? "Fuss" : null) },
  "Z.34 fusszeile-innenabstand": {
    beleg: "—",
    ist: (m) => (m[M.fusszeile] === "ja" ? "Fuss" : null),
  },
  "Z.34 fusszeile-display": { beleg: "—", ist: (m) => (m[M.fusszeile] === "ja" ? "Fuss" : null) },
  "Z.34 fusszeile-justify-content": {
    beleg: "—",
    ist: (m) => (m[M.fusszeile] === "ja" ? "Fuss" : null),
  },
};

function abweichungen(m: Messung): Abweichung[] {
  return SOLL.map((s) => {
    const lesart = IST[s.kennung];
    if (lesart === undefined) {
      throw new Error(`Sollwert ${s.kennung} hat keine Ist-Lesart`);
    }
    const ist = lesart.ist(m);
    let urteil: Urteil;
    let istText: string;
    if (ist === null) {
      urteil = "abweichend";
      istText = NICHT_VORHANDEN;
    } else if (s.art === "darstellung") {
      urteil = NICHT_MESSBAR;
      istText = `Traeger vorhanden (${ist}), Wert in jsdom nicht lesbar`;
    } else {
      urteil = ist === s.soll ? "erfüllt" : "abweichend";
      istText = ist;
    }
    return {
      kennung: s.kennung,
      zeile: s.zeile,
      soll: s.soll,
      ist: istText,
      beleg: lesart.beleg,
      urteil,
    };
  });
}

/**
 * DIE URTEILE, GEPINNT AUF DAS GEMESSENE (03.09.2026, main 76de454, 1.0.0-beta.1.31). Das ist
 * der heutige Stand, nicht das Ziel. Bewegt ein Umbau die Flaeche, wird Fall A rot und nennt die
 * Zeile — der Umbau fuehrt den Pin dann bewusst nach, mit dem neuen Urteil.
 */
const URTEIL_ERWARTET: Readonly<Record<string, Urteil>> = {
  "Z.27 flaeche-display": NICHT_MESSBAR,
  "Z.27 flaeche-flex-grow": NICHT_MESSBAR,
  "Z.27 flaeche-flex-direction": NICHT_MESSBAR,
  "Z.27 flaeche-align-items": NICHT_MESSBAR,
  "Z.27 flaeche-justify-content": NICHT_MESSBAR,
  "Z.27 flaeche-ohne-kasten": "abweichend",
  "Z.27 flaeche-textausrichtung": NICHT_MESSBAR,
  "Z.27 flaeche-abstand-gap": NICHT_MESSBAR,
  "Z.27 flaeche-innenabstand": NICHT_MESSBAR,
  "Z.28 lupe-vorhanden": "abweichend",
  "Z.28 lupe-strichfarbe": "abweichend",
  "Z.28 lupe-strichstaerke": "abweichend",
  "Z.28 lupe-fuellung": "abweichend",
  "Z.28 lupe-kreis-vorhanden": "abweichend",
  "Z.28 lupe-kreis-cx": "abweichend",
  "Z.28 lupe-kreis-cy": "abweichend",
  "Z.28 lupe-kreis-r": "abweichend",
  "Z.29 satz-wortlaut": "abweichend",
  "Z.29 satz-anzahl-texttraeger": "abweichend",
  "Z.29 satz-schriftgrad": NICHT_MESSBAR,
  "Z.29 satz-zeilenhoehe": NICHT_MESSBAR,
  "Z.29 satz-farbe": NICHT_MESSBAR,
  "Z.30 hauptaktion-wortlaut": "abweichend",
  "Z.30 knopf-frage-aendern-vorhanden": "abweichend",
  "Z.30 knopf-innenabstand": "abweichend",
  "Z.30 knopf-hintergrund": "abweichend",
  "Z.30 knopf-rand": "abweichend",
  "Z.30 knopf-radius": "abweichend",
  "Z.30 knopf-schriftgrad": "abweichend",
  "Z.30 knopf-schnitt": "abweichend",
  "Z.30 knopf-farbe": "abweichend",
  "Z.31 nebenaktion-wortlaut": "abweichend",
  "Z.31 nebenaktion-form": "abweichend",
  "Z.31 offene-frage-weg-vorhanden": "erfüllt",
  "Z.31 nebenaktion-schriftgrad": NICHT_MESSBAR,
  "Z.28-31 reihenfolge auskunft-vor-aktion": "erfüllt",
  "Z.35 fusszeile-wortlaut": "abweichend",
  "Z.35 fusszeile-schriftgrad": "abweichend",
  "Z.35 fusszeile-farbe": "abweichend",
  "Z.34 fusszeile-innenabstand": "abweichend",
  "Z.34 fusszeile-display": "abweichend",
  "Z.34 fusszeile-justify-content": "abweichend",
};

// ================================================================================================
// TEIL 4 — DIE VERLUSTLISTE, umgekehrt gelesen: was das Zielbild jedem heutigen Traeger gibt.
// ================================================================================================

// DIE HEUTIGEN WORTLAUTE, ALS LITERAL GEPINNT (JOB 3010 Runde 2, BEN Korrekturpflicht 2). Ein
// Vergleich nur gegen `panel.t(...)` bliebe gruen, wenn Schluessel UND Anzeige gemeinsam falsch
// wuerden — der Pin haelt fest, was der Mensch HEUTE liest (taskpane.html :2117-2118, :2096).
const TITEL_HEUTE = "Keine belastbare Grundlage.";
const BODY_HEUTE =
  "Es gibt kein validiertes Wissen zu dieser Frage. Statt einer erfundenen Antwort wurde eine " +
  "Wissenslücke vermerkt — du kannst sie zusätzlich als offene Frage nach KLARWERK geben.";
const REGEL_HEUTE =
  "So arbeitet Klara: Sie zitiert validiertes KLARWERK-Wissen wörtlich, statt eine Antwort zu " +
  "formulieren. Dein markierter Text wird dabei nicht an eine externe KI gesendet.";
const AKTION_HEUTE = "Als offene Frage an KLARWERK senden";

interface Verlust {
  traeger: string;
  heute: string;
  imZielbild: string;
  verlust: string;
  /** Der Nachweis, dass der Traeger HEUTE im Lueckenzustand steht. */
  steht: (m: Messung) => boolean;
}

const VERLUSTLISTE: readonly Verlust[] = [
  {
    traeger: "div.status.warn (:630)",
    heute: "die Luecke ist eine WARNUNG — gelber Kasten wie Fehler und Fristen",
    imZielbild: "KEIN Platz: Z.27 ist eine ruhige, mittige Flaeche ohne Kasten",
    verlust:
      "Der Warn-Ton. Er sagt heute ›hier stimmt etwas nicht‹; das Zielbild sagt ›das ist eine Auskunft‹. " +
      "Wer den Kasten behaelt, behaelt den Alarm; wer ihn streicht, verliert die Sichtbarkeit im Scrollfluss.",
    steht: (m) => (m[M.kasten] ?? "").split(" ").includes("warn"),
  },
  {
    traeger: 'askGapTitle (:631, "Keine belastbare Grundlage.")',
    heute: "der Titel der Absage — derselbe Kernsatz wie in der Konsole (word-addin-ask :905)",
    imZielbild: "ersetzt durch Z.29 ›Dazu liegt kein freigegebenes Firmenwissen vor.‹",
    verlust:
      "Die Parität zur Konsole (word-addin-ask :905-907 pinnt den Satz in drei Sprachen). Zwei " +
      "Wortlaute fuer dieselbe Luecke in zwei Flaechen — oder die Konsole zieht mit.",
    steht: (m) => m[M.titel] === TITEL_HEUTE,
  },
  {
    traeger: "askGapBody (:632, zwei Saetze)",
    heute: "erklaert, DASS die Luecke vermerkt ist und dass sie als offene Frage reisen kann",
    imZielbild: "KEIN Platz: Z.29 ist EIN Satz, ohne Erklaerung",
    verlust:
      "Die Auskunft ›eine Wissensluecke wurde vermerkt‹ — der Mensch erfaehrt im Zielbild nicht mehr, " +
      "dass der Server die Luecke bereits festgehalten hat (das tut /api/ask, :4297).",
    steht: (m) => m[M.body] === BODY_HEUTE,
  },
  {
    traeger: "askRuleNote (:641, die Klara-Regel, bewusst zum zweiten Mal)",
    heute: "im Moment des ›warum nicht?‹ steht die Regel noch einmal (mega75 Block C, :638-640)",
    imZielbild:
      "KEIN Platz — am naechsten kommt die Fusszeile Z.35 ›Klara erfindet keine Antworten‹",
    verlust:
      "Die Aussage ›dein markierter Text geht nicht an eine externe KI‹ an der Stelle der Absage. " +
      "mega75 :395 pinnt heute, dass die Regel in der Absage-Karte steht.",
    steht: (m) => m[M.regel] === REGEL_HEUTE,
  },
  {
    traeger: '#ask-gap-send-btn (:643, class="primary")',
    heute: "die HAUPTAKTION: ›Als offene Frage an KLARWERK senden‹",
    imZielbild:
      "herabgestuft zu Z.31, Textlink 12px ›… geben‹; Hauptaktion wird ›Frage ändern‹ (Z.30)",
    verlust:
      "Nicht der Weg, sondern sein Gewicht: der einzige Knopf des Zustands wird zum Kleingedruckten, " +
      "und ›Frage ändern‹ existiert im Produkt nicht (kein Traeger, keine Funktion).",
    steht: (m) => m[M.hauptaktion] === "#ask-gap-send-btn" && m[M.aktionText] === AKTION_HEUTE,
  },
  {
    traeger: "#ask-gap-open-block (:644-645, versteckt bis zum Senden)",
    heute: "erscheint NACH dem Senden mit dem Link zum Entwurf (/capture/frontdoor?draft=<id>)",
    imZielbild: "KEIN Platz — das Zielbild kennt keinen Zustand ›gesendet‹",
    verlust:
      "Der Rueckweg zum eigenen Entwurf. Ohne ihn ist die offene Frage nach dem Klick fuer den " +
      "Menschen im Panel nicht mehr auffindbar.",
    steht: (m) => m[M.openVersteckt] === "ja",
  },
];

// ================================================================================================
// DER LAUF: das ausgelieferte Panel, an die echte App, in die Luecke.
// ================================================================================================

const FRAGE = "Wie lagern wir Ersatzteile für Linie 4?"; // der Wortlaut der Frage-Pille, Z.23
const TOTER_HREF = "https://app.klarwerk.ai/erfassen";

let b: Bruecke;
let panel: KlaraPanel;
let basis: Messung;
/** Jeder Rumpf, den das Panel an POST /api/drafts geschickt hat. */
const eingaenge: Array<{ statement?: string }> = [];

async function abwarten(bis: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    await panel.flush();
    if (bis()) {
      return;
    }
  }
  throw new Error(`nie eingetreten: ${was} — Status ›${panel.text("#ask-status")}‹`);
}

function drucke(titel: string, zeilen: readonly string[]): void {
  console.info(`\nJOB 3010 · ${titel}\n${zeilen.join("\n")}\n`);
}

describe.runIf(zielbildDa)(
  "JOB 3010 · D2 „KeinWissen“ — Messung am laufenden Panel gegen das Zielbild",
  () => {
    beforeAll(async () => {
      b = await bruecke();
      const bridge = globalThis.fetch;
      panel = createKlaraPanel();
      const mitschrift = (async (eingabe: unknown, init?: RequestInit) => {
        const url = String(eingabe);
        if ((init?.method ?? "GET").toUpperCase() === "POST" && url === "/api/drafts") {
          eingaenge.push(JSON.parse(String(init?.body ?? "{}")));
        }
        return bridge(eingabe as string, init);
      }) as typeof globalThis.fetch;
      globalThis.fetch = mitschrift;
      (globalThis as unknown as { window: { fetch: unknown } }).window.fetch = mitschrift;
      await panel.flush();
      const eingabe = panel.q("#ask-input");
      if (!eingabe) {
        throw new Error("Panel ohne Fragefeld");
      }
      eingabe.value = FRAGE;
      panel.askKlara(); // echte App ohne Wissen -> /api/ask antwortet answered:false -> kind "gap"
      await abwarten(
        () => sichtbarBis(dom("#ask-gap-block"), null),
        "der Lueckenzustand erscheint",
      );
      await panel.flush();
      basis = messen();
    });

    afterAll(async () => {
      await panel.flush();
      panel.restore();
      b.abbauen();
    });

    it("K0 · Kalibrierung: die echte App hat /api/ask beantwortet, das Panel steht in der Luecke — kein stiller Null-Treffer", () => {
      expect(b.aufrufe.some((c) => c.method === "POST" && c.url === "/api/ask")).toBe(true);
      expect(basis[M.blockSichtbar], "der Lueckenzustand ist nicht erreicht").toBe("ja");
      expect(basis[M.antwort], "Antwortblock und Luecke zugleich").toBe("nein");
      expect(
        basis[M.status],
        "der Lueckenzustand versteckt die Statuszeile (:4299 hideAskStatus)",
      ).toBe("nein");
      expect(SOLL.length).toBe(SOLL_LESART.length);
      expect(SOLL.length).toBeGreaterThan(0);
      expect(abweichungen(basis)).toHaveLength(SOLL.length);
      drucke(
        "MESSUNG am laufenden Panel",
        Object.entries(basis).map(([k, v]) => `  ${k} = ›${v}‹`),
      );
    });

    it("S1 · die Sollwerttabelle: jeder Wert aus der Vorlage gelesen, kanonisiert, und gleich dem Pin vom 27.08.2026", () => {
      const gelesen: Record<string, string> = {};
      for (const s of SOLL) {
        gelesen[s.kennung] = s.soll;
      }
      expect(gelesen).toEqual(SOLL_ERWARTET);
      // Jede Deklaration der tragenden Zeilen Z.27 und Z.34 hat ihre Sollzeile — keine ist
      // pauschal ausgelassen (BEN, Runde 1: `display: flex` fehlte).
      for (const n of [27, 34]) {
        const deklariert = stil(n)
          .split(";")
          .map((d) => d.split(":")[0]?.trim() ?? "")
          .filter((d) => d.length > 0);
        expect(deklariert.length, `Z.${n} ohne Deklarationen?`).toBeGreaterThan(0);
        for (const d of deklariert) {
          const gedeckt = SOLL.some(
            (s) =>
              s.zeile === `Z.${n}` &&
              s.art === "darstellung" &&
              s.soll === kanon(eigenschaft(n, d)),
          );
          expect(gedeckt, `Z.${n} ›${d}‹ hat keine Sollzeile`).toBe(true);
        }
      }
      // Kanonisierung ohne Renderer: kein Hex ueberlebt, px bleibt px.
      for (const s of SOLL) {
        expect(s.soll, s.kennung).not.toMatch(/#[0-9a-f]{3,6}\b/i);
      }
      expect(SOLL.find((s) => s.kennung === "Z.29 satz-schriftgrad")?.soll).toBe("16px");
      expect(kanon("#E9E5DE")).toBe("rgb(233, 229, 222)");
      expect(kanon("#fff")).toBe("rgb(255, 255, 255)");
      // Abgedeckt sind Z.27 bis Z.35 — jede tragende Zeile hat mindestens einen Wert.
      for (const z of ["Z.27", "Z.28", "Z.29", "Z.30", "Z.31", "Z.34", "Z.35"]) {
        expect(
          SOLL.some((s) => s.zeile === z),
          `keine Sollzeile fuer ${z}`,
        ).toBe(true);
      }
      drucke(
        "SOLLWERTTABELLE (KeinWissen.dc.html, kanonisiert)",
        SOLL.map(
          (s) => `  ${s.zeile.padEnd(8)} ${s.kennung.padEnd(42)} ${s.art.padEnd(12)} ›${s.soll}‹`,
        ),
      );
      drucke(
        "BEWUSST NICHT AUFGENOMMEN",
        NICHT_AUFGENOMMEN.map((n) => `  ${n.wo.padEnd(8)} ${n.was} — ${n.warum}`),
      );
    });

    it("S2 · ZIELBILD-GEGENPROBEN im Speicher: Z.27 display→block, Z.28 Kreis entfernt, Z.28 fill→schwarz, Z.28 r→5 kippen jeweils GENAU ihre Sollzeile(n)", () => {
      // Die Vorlage auf der Platte wird nicht angefasst (Pflichtquelle, nur lesend) — jeder
      // verfaelschte Zeilensatz lebt nur hier. Jede Verfaelschung trifft genau EINE Zeile der
      // Vorlage (Z.34 traegt ebenfalls `display: flex`, bleibt aber unberuehrt).
      const KREIS = '<circle cx="11" cy="11" r="7"></circle>';
      expect(zeile(27)).toContain("display: flex");
      expect(zeile(28)).toContain(KREIS);
      expect(zeile(28)).toContain('fill="none"');
      const faelle: Array<{
        was: string;
        zeile: number;
        von: string;
        nach: string;
        erwartet: string[];
      }> = [
        {
          was: "Z.27 display: flex → block",
          zeile: 27,
          von: "display: flex",
          nach: "display: block",
          erwartet: ["Z.27 flaeche-display = block"],
        },
        {
          // Runde 4 (BEN): der Kreis weg — seine Existenzzeile UND seine drei Geometriezeilen
          // kippen; sie gehoeren alle zu ihm, keine andere Zeile bewegt sich.
          was: "Z.28 <circle> entfernt",
          zeile: 28,
          von: KREIS,
          nach: "",
          erwartet: [
            "Z.28 lupe-kreis-vorhanden = kein circle",
            "Z.28 lupe-kreis-cx = kein circle",
            "Z.28 lupe-kreis-cy = kein circle",
            "Z.28 lupe-kreis-r = kein circle",
          ],
        },
        {
          was: 'Z.28 fill="none" → fill="#000000"',
          zeile: 28,
          von: 'fill="none"',
          nach: 'fill="#000000"',
          erwartet: ["Z.28 lupe-fuellung = rgb(0, 0, 0)"],
        },
        {
          was: 'Z.28 r="7" → r="5"',
          zeile: 28,
          von: 'r="7"',
          nach: 'r="5"',
          erwartet: ["Z.28 lupe-kreis-r = 5"],
        },
      ];
      for (const f of faelle) {
        const verfaelscht = ZEILEN.map((z, i) =>
          i === f.zeile - 1 ? z.replace(f.von, f.nach) : z,
        );
        expect(verfaelscht[f.zeile - 1], `${f.was}: Verfaelschung griff nicht`).not.toBe(
          ZEILEN[f.zeile - 1],
        );
        const gekippt = sollwerte(verfaelscht)
          .filter((s) => s.soll !== SOLL_ERWARTET[s.kennung])
          .map((s) => `${s.kennung} = ${s.soll}`);
        expect(gekippt, f.was).toEqual(f.erwartet);
      }
      // Der Leser ist danach wieder auf der Platte: dieselbe Tabelle wie S1.
      expect(sollwerte(ZEILEN).map((s) => s.soll)).toEqual(SOLL.map((s) => s.soll));
      expect(AKTIV).toBe(ZEILEN);
    });

    it("M1 · #ask-gap-block ist sichtbar, und zwar als einziges Ergebnis: Antwortblock und Statuszeile sind weg", () => {
      expect(basis[M.blockSichtbar]).toBe("ja");
      expect(basis[M.antwort]).toBe("nein");
      expect(basis[M.status]).toBe("nein");
    });

    it("M2 · der Titel der Luecke lautet ›Keine belastbare Grundlage.‹ — gemessen am gerenderten Text, nicht am Quelltext", () => {
      expect(basis[M.titel]).toBe(TITEL_HEUTE);
      expect(basis[M.titel]).toBe(panel.t("askGapTitle")); // derselbe Schluessel, dieselbe Quelle
    });

    it("M9 · askGapBody lautet heute ›Es gibt kein validiertes Wissen zu dieser Frage. … als offene Frage nach KLARWERK geben.‹ — Literal-Pin, nicht nur t()", () => {
      expect(basis[M.body]).toBe(BODY_HEUTE);
      expect(basis[M.body]).toBe(panel.t("askGapBody"));
    });

    it("M10 · askRuleNote lautet im Lueckenblock heute ›So arbeitet Klara: … nicht an eine externe KI gesendet.‹ — Literal-Pin, nicht nur t()", () => {
      expect(basis[M.regel]).toBe(REGEL_HEUTE);
      expect(basis[M.regel]).toBe(panel.t("askRuleNote"));
    });

    it("M3 · die EINZIGE Hauptaktion (class=primary) im Lueckenblock ist #ask-gap-send-btn ›Als offene Frage an KLARWERK senden‹ — markerfrei gezaehlt; ›Frage ändern‹ gibt es nicht", () => {
      expect(basis[M.hauptaktion]).toBe("#ask-gap-send-btn");
      expect(basis[M.aktionen]).toBe("#ask-gap-send-btn");
      expect(basis[M.aktionText]).toBe(AKTION_HEUTE);
      expect(basis[M.aktionForm]).toBe("button.primary");
      expect(dom("#ask-gap-send-btn").disabled, "die Hauptaktion ist gesperrt").toBe(false);
      expect(basis[M.frageAendern]).toBe("nein");
      // Im GANZEN Panel stehen im Lueckenzustand zwei sichtbare primary-Knoepfe: der Frage-Knopf
      // der Karte darueber und die Hauptaktion der Luecke. Gemessen, dann gepinnt.
      expect(basis[M.primaryPanel]).toBe("#ask-btn, #ask-gap-send-btn");
    });

    it("M4 · was ein Mensch sieht, in dieser Reihenfolge und VOLLSTAENDIG: Titel, Erklaerung, Regel, Knopf — sonst nichts; im gelben Warnkasten, ohne Symbol", () => {
      expect(basis[M.reihenfolge]).toBe(
        "askGapTitle > askGapBody > askRuleNote > #ask-gap-send-btn",
      );
      expect(basis[M.kasten]).toBe("status warn");
      expect(basis[M.svgs]).toBe("0");
      expect(basis[M.texttraeger]).toBe("3");
      expect(basis[M.body]).toBe(BODY_HEUTE);
      expect(basis[M.regel]).toBe(REGEL_HEUTE);
      expect(basis[M.fusszeile]).toBe("nein");
    });

    it("A · die Abweichungstabelle: je Sollwert Soll, Ist, Beleg, Urteil — gepinnt auf das Gemessene", () => {
      const tabelle = abweichungen(basis);
      const urteile: Record<string, Urteil> = {};
      for (const z of tabelle) {
        urteile[z.kennung] = z.urteil;
      }
      expect(urteile).toEqual(URTEIL_ERWARTET);
      // Alle drei Urteile kommen vor — keines ist ein toter Zweig.
      const zaehlung = { erfüllt: 0, abweichend: 0, [NICHT_MESSBAR]: 0 } as Record<Urteil, number>;
      for (const z of tabelle) {
        zaehlung[z.urteil] += 1;
      }
      expect(zaehlung.erfüllt).toBeGreaterThan(0);
      expect(zaehlung.abweichend).toBeGreaterThan(0);
      expect(zaehlung[NICHT_MESSBAR]).toBeGreaterThan(0);
      // Die Ist-Werte, die den Befund tragen — hier als Text, damit ein Wandern sichtbar wird.
      const ist = (k: string): string => tabelle.find((z) => z.kennung === k)?.ist ?? "";
      expect(ist("Z.27 flaeche-ohne-kasten")).toBe("Kasten ›status warn‹");
      expect(ist("Z.29 satz-wortlaut")).toBe("Keine belastbare Grundlage.");
      expect(ist("Z.29 satz-anzahl-texttraeger")).toBe("3");
      expect(ist("Z.30 hauptaktion-wortlaut")).toBe("Als offene Frage an KLARWERK senden");
      expect(ist("Z.30 knopf-frage-aendern-vorhanden")).toBe(NICHT_VORHANDEN);
      expect(ist("Z.31 nebenaktion-form")).toBe("button.primary");
      expect(ist("Z.35 fusszeile-wortlaut")).toBe(NICHT_VORHANDEN);
      expect(ist("Z.28 lupe-vorhanden")).toBe(NICHT_VORHANDEN);
      expect(ist("Z.28 lupe-kreis-vorhanden")).toBe(NICHT_VORHANDEN);
      expect(ist("Z.28 lupe-fuellung")).toBe(NICHT_VORHANDEN);
      drucke("ABWEICHUNGSTABELLE (Soll ← Zielbild · Ist ← laufendes Panel)", [
        `  ${"Kennung".padEnd(42)} ${"Urteil".padEnd(12)} Soll → Ist  [Beleg]`,
        ...tabelle.map(
          (z) =>
            `  ${z.kennung.padEnd(42)} ${(z.urteil === NICHT_MESSBAR ? "nicht messb." : z.urteil).padEnd(12)} ›${z.soll}‹ → ›${z.ist}‹  [${z.beleg}]`,
        ),
        `  Summe: ${zaehlung.erfüllt} erfüllt · ${zaehlung.abweichend} abweichend · ${zaehlung[NICHT_MESSBAR]} ${NICHT_MESSBAR}`,
      ]);
    });

    it("V · die Verlustliste: alle sechs heutigen Traeger stehen im Lueckenzustand — ein Umbau darf keinen unbemerkt fallen lassen", () => {
      expect(VERLUSTLISTE).toHaveLength(6);
      for (const v of VERLUSTLISTE) {
        expect(v.steht(basis), `Traeger fehlt im Lueckenzustand: ${v.traeger}`).toBe(true);
      }
      drucke(
        "VERLUSTLISTE, umgekehrt gelesen",
        VERLUSTLISTE.flatMap((v) => [
          `  ${v.traeger}`,
          `    heute:      ${v.heute}`,
          `    im Zielbild: ${v.imZielbild}`,
          `    Verlust:    ${v.verlust}`,
        ]),
      );
    });

    it("G · GEGENPROBE: sieben Verfaelschungen im Speicher der Testsitzung kippen jeweils GENAU ihre Messgroesse", () => {
      const block = dom("#ask-gap-block");
      const titel = dom('#ask-gap-block [data-t="askGapTitle"]');
      const body = dom('#ask-gap-block [data-t="askGapBody"]');
      const regel = dom('#ask-gap-block [data-t="askRuleNote"]');
      const knopf = dom("#ask-gap-send-btn");
      const textSetzen = (el: DomEl, wert: string | null): void => {
        (el as unknown as { textContent: string | null }).textContent = wert;
      };
      const setzen = (el: DomEl, attr: string, wert: string | null): void => {
        const s = el as unknown as {
          setAttribute(n: string, v: string): void;
          removeAttribute(n: string): void;
        };
        if (wert === null) {
          s.removeAttribute(attr);
        } else {
          s.setAttribute(attr, wert);
        }
      };
      const gefallen = (): string[] =>
        Object.entries(messen())
          .filter(([k, v]) => basis[k] !== v)
          .map(([k]) => k);

      // Vor jeder Verfaelschung: nichts gefallen (die Messung ist stabil, nicht zufaellig).
      expect(gefallen()).toEqual([]);

      // (1) Block versteckt -> M1 faellt, und M19, weil die Hauptaktion der Luecke PANELWEIT nicht
      // mehr sichtbar ist (M3/M4/M18 messen INNERHALB des Blocks, bewusst — sie bleiben stehen).
      const blockKlasse = block.getAttribute("class");
      setzen(block, "class", "hidden");
      const g1 = gefallen();
      const m1 = messen();
      setzen(block, "class", blockKlasse);
      expect(g1).toEqual([M.blockSichtbar, M.primaryPanel]);
      expect(m1[M.primaryPanel]).toBe("#ask-btn");

      // (2) Titel vertauscht -> NUR M2 faellt.
      const titelText = titel.textContent;
      (titel as unknown as { textContent: string }).textContent =
        "Dazu liegt kein freigegebenes Firmenwissen vor.";
      const g2 = gefallen();
      (titel as unknown as { textContent: string | null }).textContent = titelText;
      expect(g2).toEqual([M.titel]);

      // (3) `primary` vom Knopf genommen -> M3 (Hauptaktion) und M12 (Elementform) fallen, sonst nichts.
      const knopfKlasse = knopf.getAttribute("class");
      setzen(knopf, "class", "ghost");
      const g3 = gefallen();
      setzen(knopf, "class", knopfKlasse);
      // M19 faellt mit: panelweit bleibt dann nur der Frage-Knopf als primary.
      expect(g3).toEqual([M.hauptaktion, M.aktionForm, M.primaryPanel]);
      expect(messen()[M.hauptaktion]).toBe("#ask-gap-send-btn");

      // (4) askGapBody verfaelscht -> NUR M9 faellt; und die Verlustliste verliert genau diesen Traeger.
      const bodyText = body.textContent;
      textSetzen(body, "Es gibt dazu Wissen, aber wir zeigen es nicht.");
      const g4 = gefallen();
      const verlust4 = VERLUSTLISTE.filter((v) => !v.steht(messen())).map((v) => v.traeger);
      textSetzen(body, bodyText);
      expect(g4).toEqual([M.body]);
      expect(verlust4).toEqual(["askGapBody (:632, zwei Saetze)"]);

      // (5) askRuleNote verfaelscht -> NUR M10 faellt; die Verlustliste verliert genau die Regel.
      const regelText = regel.textContent;
      textSetzen(regel, "Klara formuliert Antworten frei.");
      const g5 = gefallen();
      const verlust5 = VERLUSTLISTE.filter((v) => !v.steht(messen())).map((v) => v.traeger);
      textSetzen(regel, regelText);
      expect(g5).toEqual([M.regel]);
      expect(verlust5).toEqual(["askRuleNote (:641, die Klara-Regel, bewusst zum zweiten Mal)"]);

      // (6) Runde 3 (BEN): ein ZWEITER sichtbarer `button.primary` OHNE id und OHNE data-t im
      // Lueckenblock -> M3 (Hauptaktion), M4 (Inventur), M18 (Aktionen) und M19 (primary im Panel)
      // fallen — die Messung sieht ihn, obwohl er keinen Marker traegt.
      const extraKnopf = dg.document.createElement("button");
      extraKnopf.setAttribute("class", "primary");
      (extraKnopf as unknown as { textContent: string }).textContent = "Nochmal fragen";
      block.appendChild(extraKnopf);
      const g6 = gefallen();
      const m6 = messen();
      block.removeChild(extraKnopf);
      expect(g6).toEqual([M.hauptaktion, M.reihenfolge, M.aktionen, M.primaryPanel]);
      expect(m6[M.hauptaktion]).toBe("#ask-gap-send-btn, button›Nochmal fragen‹");
      expect(m6[M.reihenfolge]).toBe(
        "askGapTitle > askGapBody > askRuleNote > #ask-gap-send-btn > button›Nochmal fragen‹",
      );

      // (7) Runde 3 (BEN): ein zusaetzlicher sichtbarer Text OHNE Marker im Lueckenblock -> M4
      // (Inventur) und M15 (Anzahl Texttraeger) fallen, sonst nichts.
      const extraText = dg.document.createElement("p");
      (extraText as unknown as { textContent: string }).textContent =
        "Ein Satz, den niemand angemeldet hat.";
      block.appendChild(extraText);
      const g7 = gefallen();
      const m7 = messen();
      block.removeChild(extraText);
      expect(g7).toEqual([M.reihenfolge, M.texttraeger]);
      expect(m7[M.texttraeger]).toBe("4");
      expect(m7[M.reihenfolge]).toContain("> p›Ein Satz, den niemand angemeldet hat.‹");

      // Nach dem Zuruecksetzen: wieder nichts gefallen, kein Traeger verloren.
      expect(gefallen()).toEqual([]);
      expect(VERLUSTLISTE.every((v) => v.steht(messen()))).toBe(true);
    });

    it("H · der tote href: im Lueckenzustand ist der Link versteckt und traegt die Markup-Adresse; nach dem Senden ersetzt das Panel sie durch /capture/frontdoor?draft=<id>", async () => {
      // VOR dem Senden: Block versteckt, href = die Markup-Adresse aus :645 — nie sichtbar ausgeliefert.
      expect(basis[M.openVersteckt]).toBe("ja");
      expect(basis[M.openHref]).toBe(TOTER_HREF);
      expect(sichtbarBis(dom("#ask-gap-open-link"), null)).toBe(false);

      // Senden — die echte App legt den Entwurf an.
      const knopf = dom("#ask-gap-send-btn");
      if (typeof knopf.click !== "function") {
        throw new Error("#ask-gap-send-btn ist nicht klickbar");
      }
      knopf.click();
      await abwarten(() => eingaenge.length > 0, "das Panel schickt die offene Frage");
      await abwarten(
        () => sichtbarBis(dom("#ask-gap-open-block"), null),
        "der Entwurfs-Link erscheint",
      );
      await panel.flush();

      const res = await b.a.inject({ method: "GET", url: "/api/drafts", headers: b.kopf });
      expect(res.statusCode, res.body).toBe(200);
      const entwuerfe = res.json() as Array<{ id: string; payload: { statement?: string } }>;
      const entwurf = entwuerfe.find((d) => d.payload.statement === FRAGE);
      expect(entwurf, "kein Entwurf mit der Frage angelegt").toBeDefined();

      const nachher = messen();
      const origin = dg.window.location.origin;
      const lebendigerHref = `${origin}/capture/frontdoor?draft=${encodeURIComponent(entwurf?.id ?? "")}`;
      expect(nachher[M.openVersteckt]).toBe("nein");
      expect(nachher[M.openHref]).toBe(lebendigerHref);
      expect(nachher[M.openHref]).not.toBe(TOTER_HREF);
      expect(dom("#ask-gap-open-link").href).toBe(lebendigerHref);
      // Die Erfolgszeile nennt den Entwurf; der Lueckenblock bleibt stehen.
      expect(nachher[M.status]).toBe("ja");
      expect(nachher[M.blockSichtbar]).toBe("ja");
      drucke("ZWEI ADRESSEN FUER DENSELBEN WEG (#ask-gap-open-link)", [
        `  im Markup (:645), nie sichtbar:      ${TOTER_HREF}`,
        `  nach dem Senden (:4739-4741), sichtbar: ${nachher[M.openHref]}`,
        `  Statuszeile: ›${panel.text("#ask-status")}‹`,
      ]);
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3010 · D2 Messung uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — Abgleich hier nicht messbar.`).toBe(
      false,
    );
  });
});
