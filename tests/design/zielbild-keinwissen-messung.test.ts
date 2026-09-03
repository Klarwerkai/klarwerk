// @vitest-environment jsdom
// ================================================================================================
// JOB 3010 · D2 „KeinWissen" — DIE LUECKENFLAECHE AM LAUFENDEN PANEL GEMESSEN, NICHT BEHAUPTET.
// JOB 3046 · D2 — NACHGEFUEHRT AUF DEN UMBAU: dieselbe Messung, jetzt gegen die gebaute Auskunft.
// ================================================================================================
//
// PEDIS ZEILE (PRIORITAETEN.md D2): „ehrliche Luecke: kein gesichertes Wissen, Weg zum Erfassen."
//
// DIE LAGE BIS JOB 3046: der Zustand war im Panel als gelber Warnkasten gebaut (`div.status.warn`
// mit askGapTitle, askGapBody, einer Zweitkopie von askRuleNote und `button.primary#ask-gap-send-
// btn`), ausgeloest ueber `/api/ask` -> `outcome.kind === "gap"`. JOB 3010 hat ihn am laufenden
// Panel gemessen und die Urteile GEPINNT AUF DAS GEMESSENE — mit der Ansage, dass ein Umbau diese
// Datei rot macht und die Pins bewusst nachfuehrt. Genau das ist mit JOB 3046 geschehen.
//
// DIE LAGE SEIT JOB 3046 (Markenblock KW-D2-LUECKE in taskpane.html): `#ask-gap-block` traegt die
// Flaeche `#ask-luecke` (Z.27, kein Kasten) mit Lupe (Z.28), dem EINEN Satz `#ask-luecke-satz`
// (askGapTitle, Wortlaut Z.29), der Hauptaktion `#ask-luecke-frage-aendern` (Z.30) und dem Textlink
// `a#ask-gap-send-btn` (Z.31, derselbe Handler wie bisher); dazu `#ask-luecke-fuss` (Z.34/35) und
// weiter `#ask-gap-open-block` (Rueckweg zum Entwurf). askGapBody und die Zweitkopie der Regel sind
// ENTFERNT; die Regel steht unter der Antwortflaeche (`#ask-rule-note`, JOB 3004).
//
// WAS DIESE DATEI TUT — und NUR das:
//   1. Die SOLLWERTTABELLE: jeder tragende Wert aus `KeinWissen.dc.html` Z.27-35, mit Zeilenangabe
//      AUS DER VORLAGE GELESEN (nicht abgetippt) und ohne Renderer kanonisiert (Hex -> rgb(), px
//      bleibt). Gegen ein Literal gepinnt: aendert Pedi das Zielbild, sagt Fall S1, welcher Wert.
//   2. Die MESSUNG am laufenden Fenster: das AUSGELIEFERTE Inline-Skript (Fixture `createKlaraPanel`,
//      Muster job2703-d3), ueber die Transportbruecke an die ECHTE App (`buildApp`) — die ohne
//      Wissen auf `/api/ask` eine echte Luecke liefert. Gemessen wird, was ein Mensch sieht: welche
//      Traeger sichtbar sind, in welcher Reihenfolge, mit welchem Text, ob ein Knopf `primary`
//      traegt, ob `#ask-gap-open-block` versteckt ist. Kein `expect(html).toContain(...)`.
//   3. Die ABWEICHUNGSTABELLE: je Sollwert Soll, Ist (oder „im Produkt nicht vorhanden"), Beleg und
//      eines von drei Urteilen. Reine Darstellungswerte aus dem Cascade (Farbe, Radius, Innenabstand,
//      Schriftgrad) sind in jsdom NICHT ehrlich messbar (kein Layout) und tragen `nicht messbar` —
//      sie misst die Chromium-Panelmessung `zielbild-keinwissen.test.ts` (JOB 3046) je Wert; eine
//      zweite Chromium-Wahrheit waere eine zweite Wahrheit. JOB 3046: SVG-ATTRIBUTE der Lupe
//      (stroke-width, fill, cx, cy, r) sind am DOM EXAKT lesbar — kein Cascade-Ergebnis — und werden
//      deshalb hier verglichen (Lesart `exakt`), nicht als „nicht messbar" weggeschoben. Die
//      Strichfarbe dagegen kommt ueber `currentColor` aus dem Stil (var(--muted)) und bleibt jsdom
//      verschlossen. Die Urteile sind GEPINNT AUF DAS GEMESSENE: der Test ist gruen gegen den
//      Stand nach JOB 3046 und wird rot, wenn sich die Flaeche bewegt.
//   4. Die VERLUSTLISTE, jetzt UMGEKEHRT gelesen: jeder der sechs Traeger von vor JOB 3046 mit
//      seinem neuen Platz — oder seinem dokumentierten Verlust — und dem Beleg am laufenden Panel,
//      dass es so ist (Fall V). Nichts ist still gefallen.
//   5. Der TOTE HREF: `#ask-gap-open-link` traegt im Markup `https://app.klarwerk.ai/erfassen`; im
//      Lueckenzustand ist der Block versteckt, und beim erfolgreichen Senden wird der href durch
//      `<origin>/capture/frontdoor?draft=<id>` ERSETZT — die Markup-Adresse wird nie sichtbar
//      ausgeliefert. Zwei Adressen fuer denselben Weg: Fall H haelt beide fest.
//   6. Die GEGENPROBE (Red-first-Ersatz eines Messauftrags): Verfaelschungen im Speicher der
//      Testsitzung kippen JEWEILS GENAU die Messgroesse, deren Name den Wert traegt (Fall G) —
//      JOB 3046 ergaenzt: „Frage ändern" entfernt -> M13 rot. Dazu die Zielbild-Gegenprobe
//      `display: flex` -> `block` auf Z.27 im Speicher, die genau ihre Sollzeile kippt (Fall S2).
//      `taskpane.html` und die Vorlage bleiben unangetastet.
//   7. JOB 3046, DIE UEBERGAENGE: „Frage ändern" (Fall F: Flaeche zu, Frage im Feld, Fokus im Feld,
//      kein Reststatus, kein POST); Luecke -> neue Frage -> Antwort (Fall U1: die Luecke raeumt
//      sich ab, der Antwortblock steht); jede echte Warnung (Fall U2: leer, 401, 403, 500) zeigt
//      den Warnkasten in #ask-status und NIE die Lueckenflaeche — keine negative Aussage ohne
//      erfolgreiche Antwort; der truncated-Hinweis (Fall U3) steht als Warnung NEBEN der Luecke.
//
// RUNDE 2 (BEN, 03.09.2026): Runde 1 liess die Flex-Deklarationen von Z.27/Z.34 pauschal aus und
// verglich askGapBody/askRuleNote nur gegen `panel.t()` — beides blieb bei einer Verfaelschung
// gruen. Jetzt hat jede Deklaration der beiden Zeilen ihre Sollzeile (S1 prueft die Deckung), und
// die Wortlaute sind als Literal gepinnt.
// RUNDE 3 (BEN, 03.09.2026): Runde 2 inventarisierte nur `[data-t], [id]` — ein zweiter sichtbarer
// `button.primary` ohne Marker und ein unmarkierter Text blieben unentdeckt. Jetzt ist die Inventur
// MARKERFREI (`inventar`, `primaries`): jede Aktion und jedes Element mit eigenem Text zaehlt, M18
// nennt alle sichtbaren Aktionen im Block, M19 alle sichtbaren `primary` im ganzen Panel.
// RUNDE 4 (BEN, 03.09.2026): Runde 3 las die Lupe (Z.28) ohne `fill` und ohne ihren Kreis — ein
// entfernter Kreis oder eine schwarze Fuellung blieb gruen. Jetzt tragen `fill`, Kreis-Existenz und
// Kreisgeometrie (cx, cy, r) eigene Sollzeilen; S2 verfaelscht jede davon im Speicher.
//
// WAS DIESE DATEI NICHT TUT: keine Empfehlung, keine Aussage, ob eine verbliebene Abweichung
// „behoben werden sollte" — das entscheidet Pedi. Kopfband (Z.17-20, D4) und Frage-Pille
// (Z.22-25, D1) sind ausdruecklich nicht Gegenstand.
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
  value?: string;
  selectionStart?: number;
  selectionEnd?: number;
  parentElement: DomEl | null;
  children: ArrayLike<DomEl>;
  childNodes: ArrayLike<DomKnoten>;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  appendChild(el: DomEl): DomEl;
  removeChild(el: DomEl): DomEl;
  querySelector(selector: string): DomEl | null;
  querySelectorAll(selector: string): ArrayLike<DomEl>;
  click?(): void;
}

interface DomGlobals {
  document: {
    body: DomEl;
    activeElement: DomEl | null;
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
 * taskpane.html) an der Stelle oder einem Vorfahren. jsdom rechnet kein Layout — das ist der
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

const KEINE_LUPE = "keine Lupe";
const KEIN_TRAEGER = "kein Traeger";

const M = {
  blockSichtbar: "M1 · #ask-gap-block sichtbar (keine hidden-Klasse an Block oder Vorfahren)",
  titel: "M2 · Wortlaut askGapTitle (#ask-luecke-satz)",
  hauptaktion:
    "M3 · sichtbare Traeger mit Klasse primary im Lueckenblock (markerfrei) — das Zielbild kennt keinen",
  reihenfolge:
    "M4 · Reihenfolge ALLER sichtbaren Text- und Aktionstraeger im Lueckenblock (markerfrei)",
  openVersteckt: "M5 · #ask-gap-open-block versteckt",
  openHref: "M6 · href von #ask-gap-open-link",
  kasten: "M7 · Klassen des Elternelements von askGapTitle (die Flaeche #ask-luecke)",
  svgs: "M8 · SVG-Elemente im Lueckenblock",
  body: "M9 · askGapBody: Traeger im Lueckenblock und Schluessel im Woerterbuch",
  regel: "M10 · askRuleNote im Lueckenblock (Traeger — die Zweitkopie)",
  aktionText: "M11 · Wortlaut #ask-gap-send-btn",
  aktionForm: "M12 · Elementform der Aktion ›offene Frage‹",
  frageAendern:
    "M13 · Knopf ›Frage ändern‹ (#ask-luecke-frage-aendern) sichtbar in der Flaeche, Wortlaut",
  fusszeile: "M14 · Fusszeile #ask-luecke-fuss sichtbar im Lueckenblock, Wortlaut",
  texttraeger:
    "M15 · sichtbare Texttraeger in der Flaeche #ask-luecke ohne Aktionen (Anzahl, markerfrei)",
  status: "M16 · #ask-status sichtbar",
  antwort: "M17 · #ask-answer-block sichtbar",
  aktionen:
    "M18 · sichtbare Aktionstraeger im Lueckenblock (button/a/input/select/textarea, markerfrei)",
  primaryPanel: "M19 · sichtbare Traeger mit Klasse primary im GANZEN Panel",
  regelUnten:
    "M20 · #ask-rule-note sichtbar mit dem Wortlaut der Regel (die EINE Stelle der Regel)",
  lupe: "M21 · die Lupe in der Flaeche: svg BxH mit Griffpfad (Attribute, exakt lesbar)",
  lupeKreis: "M22 · das Glas der Lupe: circle cx/cy/r (Attribute, exakt lesbar)",
  lupeStrich: "M23 · Strich und Fuellung der Lupe: stroke, stroke-width, fill (Attribute)",
  flaecheInline: "M24 · style-Attribut von #ask-luecke (ein Kasten per Inline-Stil?)",
  ahnen:
    "M25 · die Ahnen von #ask-luecke bis zum Panel (Kennung und Klassen) — kein Kasten dazwischen",
} as const;

/** Runde 2: die Ahnenkette von `el` bis (ausschliesslich) body, je `#id` oder `tag` plus Klassen. */
function ahnenkette(el: DomEl): string {
  const teile: string[] = [];
  for (let e = el.parentElement; e !== null && e !== dg.document.body; e = e.parentElement) {
    const k = klassen(e).filter((x) => x !== "hidden");
    teile.push(
      `${e.id.length > 0 ? `#${e.id}` : e.tagName.toLowerCase()}${k.length > 0 ? `.${k.join(".")}` : ""}`,
    );
  }
  return teile.join(" > ");
}

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
  const flaeche = block.querySelector("#ask-luecke");
  const texttraeger = flaeche === null ? [] : inventar(flaeche).filter((e) => !istAktion(e));
  const primaryPanel = primaries(dg.document.body, null);
  const knopf = block.querySelector("#ask-luecke-frage-aendern");
  const fuss = block.querySelector("#ask-luecke-fuss");
  const regelUnten = dg.document.querySelector("#ask-rule-note");
  const svg = flaeche?.querySelector("svg") ?? null;
  const kreis = svg?.querySelector("circle") ?? null;
  const pfad = svg?.querySelector("path") ?? null;
  const a = (el: DomEl | null, n: string): string => el?.getAttribute(n) ?? "—";
  return {
    [M.blockSichtbar]: sichtbarBis(block, null) ? "ja" : "nein",
    [M.titel]: text(titel),
    [M.hauptaktion]: primary.length === 0 ? "keine" : primary.join(", "),
    [M.reihenfolge]: imBlock.map(name).join(" > "),
    [M.openVersteckt]: sichtbarBis(openBlock, block) ? "nein" : "ja",
    [M.openHref]: openLink.getAttribute("href") ?? "",
    [M.kasten]: klassen(kasten).join(" "),
    [M.svgs]: String(block.querySelectorAll("svg").length),
    [M.body]: `${block.querySelectorAll('[data-t="askGapBody"]').length} Traeger, Schluessel ${
      panel.t("askGapBody") === "askGapBody" ? "entfernt" : "vorhanden"
    }`,
    [M.regel]: `${block.querySelectorAll('[data-t="askRuleNote"]').length} Traeger`,
    [M.aktionText]: text(sendBtn),
    [M.aktionForm]: `${sendBtn.tagName.toLowerCase()}${klassen(sendBtn)
      .map((k) => `.${k}`)
      .join("")}`,
    [M.frageAendern]: knopf !== null && sichtbarBis(knopf, null) ? text(knopf) : "nein",
    [M.fusszeile]: fuss !== null && sichtbarBis(fuss, null) ? text(fuss) : "nein",
    [M.texttraeger]: String(texttraeger.length),
    [M.status]: sichtbarBis(dom("#ask-status"), null) ? "ja" : "nein",
    [M.antwort]: sichtbarBis(dom("#ask-answer-block"), null) ? "ja" : "nein",
    [M.aktionen]: aktionen.length === 0 ? "keine" : aktionen.join(", "),
    [M.primaryPanel]: primaryPanel.length === 0 ? "keine" : primaryPanel.join(", "),
    [M.regelUnten]:
      regelUnten !== null && sichtbarBis(regelUnten, null) ? text(regelUnten) : "nein",
    [M.lupe]:
      svg === null
        ? KEINE_LUPE
        : `svg ${a(svg, "width")}x${a(svg, "height")} mit Pfad ${a(pfad, "d")}`,
    [M.lupeKreis]:
      svg === null
        ? KEINE_LUPE
        : kreis === null
          ? "kein circle"
          : `circle cx=${a(kreis, "cx")} cy=${a(kreis, "cy")} r=${a(kreis, "r")}`,
    [M.lupeStrich]:
      svg === null
        ? KEINE_LUPE
        : `stroke=${a(svg, "stroke")} stroke-width=${a(svg, "stroke-width")} fill=${a(svg, "fill")}`,
    [M.flaecheInline]: flaeche === null ? KEIN_TRAEGER : (flaeche.getAttribute("style") ?? ""),
    [M.ahnen]: flaeche === null ? KEIN_TRAEGER : ahnenkette(flaeche),
  };
}

/** Ein Attribut aus einer M21-M23-Zeile (`name=wert`), oder null, wenn die Lupe fehlt. */
function lupenWert(m: Messung, zeile: string, attribut: string): string | null {
  const roh = m[zeile] ?? "";
  if (roh === KEINE_LUPE || roh === "kein circle") {
    return null;
  }
  return new RegExp(`(?:^|\\s)${attribut}=(\\S+)`).exec(roh)?.[1] ?? null;
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
 * „im Produkt nicht vorhanden". Fuer Darstellungswerte aus dem Cascade liefert `ist` nur die
 * Existenz des Traegers: ist er da, gilt `nicht messbar`; fehlt er, ist der Wert `abweichend`,
 * weil nichts ihn tragen kann. JOB 3046: `exakt` markiert Darstellungswerte, die am DOM als
 * ATTRIBUT exakt lesbar sind (die Lupe: stroke-width, fill, cx, cy, r) — sie werden verglichen.
 */
const IST: Readonly<
  Record<string, { beleg: string; exakt?: boolean; ist: (m: Messung) => string | null }>
> = {
  "Z.27 flaeche-display": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-flex-grow": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-flex-direction": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-align-items": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-justify-content": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-ohne-kasten": {
    beleg: "#ask-luecke (Elternelement von askGapTitle): Klassen und Inline-Stil",
    ist: (m) => {
      if (m[M.flaecheInline] === KEIN_TRAEGER) {
        return null;
      }
      const inline = m[M.flaecheInline] ?? "";
      const klasse = m[M.kasten] ?? "";
      if (klasse === "" && !/background|border/.test(inline)) {
        return "kein Kasten (weder background noch border)";
      }
      return `Kasten ›${klasse}${inline.length > 0 ? ` style=${inline}` : ""}‹`;
    },
  },
  "Z.27 flaeche-textausrichtung": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-abstand-gap": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.27 flaeche-innenabstand": { beleg: "#ask-luecke", ist: (m) => flaecheDa(m) },
  "Z.28 lupe-vorhanden": {
    beleg: "#ask-luecke svg (M21)",
    ist: (m) => (m[M.lupe] === KEINE_LUPE ? null : (m[M.lupe] ?? null)),
  },
  "Z.28 lupe-strichfarbe": {
    beleg:
      "#ask-luecke svg stroke=currentColor, Farbe aus `#ask-luecke svg { color: var(--muted) }`",
    ist: (m) => (m[M.lupe] === KEINE_LUPE ? null : "svg (currentColor, Cascade)"),
  },
  "Z.28 lupe-strichstaerke": {
    beleg: "#ask-luecke svg[stroke-width] (M23)",
    exakt: true,
    ist: (m) => lupenWert(m, M.lupeStrich, "stroke-width"),
  },
  "Z.28 lupe-fuellung": {
    beleg: "#ask-luecke svg[fill] (M23)",
    exakt: true,
    ist: (m) => lupenWert(m, M.lupeStrich, "fill"),
  },
  "Z.28 lupe-kreis-vorhanden": {
    beleg: "#ask-luecke svg circle (M22)",
    ist: (m) =>
      m[M.lupeKreis] === KEINE_LUPE
        ? null
        : m[M.lupeKreis] === "kein circle"
          ? "kein circle"
          : "circle vorhanden",
  },
  "Z.28 lupe-kreis-cx": {
    beleg: "#ask-luecke svg circle[cx] (M22)",
    exakt: true,
    ist: (m) => lupenWert(m, M.lupeKreis, "cx"),
  },
  "Z.28 lupe-kreis-cy": {
    beleg: "#ask-luecke svg circle[cy] (M22)",
    exakt: true,
    ist: (m) => lupenWert(m, M.lupeKreis, "cy"),
  },
  "Z.28 lupe-kreis-r": {
    beleg: "#ask-luecke svg circle[r] (M22)",
    exakt: true,
    ist: (m) => lupenWert(m, M.lupeKreis, "r"),
  },
  "Z.29 satz-wortlaut": {
    beleg: '#ask-luecke-satz [data-t="askGapTitle"]',
    ist: (m) => m[M.titel] ?? null,
  },
  "Z.29 satz-anzahl-texttraeger": {
    beleg: "markerfreie Inventur der Flaeche #ask-luecke ohne Aktionen (M15)",
    ist: (m) => m[M.texttraeger] ?? null,
  },
  "Z.29 satz-schriftgrad": { beleg: "#ask-luecke-satz", ist: () => "#ask-luecke-satz" },
  "Z.29 satz-zeilenhoehe": { beleg: "#ask-luecke-satz", ist: () => "#ask-luecke-satz" },
  "Z.29 satz-farbe": { beleg: "#ask-luecke-satz", ist: () => "#ask-luecke-satz" },
  "Z.30 hauptaktion-wortlaut": {
    beleg: "#ask-luecke-frage-aendern (M13)",
    ist: (m) => (m[M.frageAendern] === "nein" ? null : (m[M.frageAendern] ?? null)),
  },
  "Z.30 knopf-frage-aendern-vorhanden": {
    beleg: "#ask-luecke-frage-aendern (M13)",
    ist: (m) => (m[M.frageAendern] === "nein" ? null : `Knopf ›${m[M.frageAendern]}‹ vorhanden`),
  },
  "Z.30 knopf-innenabstand": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.30 knopf-hintergrund": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.30 knopf-rand": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.30 knopf-radius": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.30 knopf-schriftgrad": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.30 knopf-schnitt": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.30 knopf-farbe": { beleg: "#ask-luecke-frage-aendern", ist: (m) => knopfDa(m) },
  "Z.31 nebenaktion-wortlaut": {
    beleg: "#ask-gap-send-btn (askGapSendCta)",
    ist: (m) => m[M.aktionText] ?? null,
  },
  "Z.31 nebenaktion-form": {
    beleg: "#ask-gap-send-btn (M12)",
    ist: (m) =>
      m[M.aktionForm] === "a" ? "a (Textlink, ohne primary)" : (m[M.aktionForm] ?? null),
  },
  "Z.31 offene-frage-weg-vorhanden": {
    beleg: "#ask-gap-send-btn sichtbar, klickbar (job2703-d3 W2, Fall H)",
    ist: (m) =>
      m[M.reihenfolge]?.includes("#ask-gap-send-btn")
        ? "Weg ›offene Frage nach KLARWERK‹ vorhanden"
        : null,
  },
  "Z.31 nebenaktion-schriftgrad": { beleg: "#ask-gap-send-btn", ist: () => "#ask-gap-send-btn" },
  "Z.28-31 reihenfolge auskunft-vor-aktion": {
    beleg: "M4 (Reihenfolge der sichtbaren Traeger): Satz vor ›Frage ändern‹ vor Textlink",
    ist: (m) => {
      const folge = (m[M.reihenfolge] ?? "").split(" > ");
      const auskunft = folge.indexOf("#ask-luecke-satz");
      const haupt = folge.indexOf("#ask-luecke-frage-aendern");
      const neben = folge.indexOf("#ask-gap-send-btn");
      if (auskunft < 0 || haupt < 0 || neben < 0) {
        return null;
      }
      return auskunft < haupt && haupt < neben ? "Auskunft vor Aktion" : "Aktion vor Auskunft";
    },
  },
  "Z.35 fusszeile-wortlaut": {
    beleg: "#ask-luecke-fuss (askGapFuss, M14)",
    ist: (m) => (m[M.fusszeile] === "nein" ? null : (m[M.fusszeile] ?? null)),
  },
  "Z.35 fusszeile-schriftgrad": { beleg: "#ask-luecke-fuss", ist: (m) => fussDa(m) },
  "Z.35 fusszeile-farbe": { beleg: "#ask-luecke-fuss", ist: (m) => fussDa(m) },
  "Z.34 fusszeile-innenabstand": { beleg: "#ask-luecke-fuss", ist: (m) => fussDa(m) },
  "Z.34 fusszeile-display": { beleg: "#ask-luecke-fuss", ist: (m) => fussDa(m) },
  "Z.34 fusszeile-justify-content": { beleg: "#ask-luecke-fuss", ist: (m) => fussDa(m) },
};

function flaecheDa(m: Messung): string | null {
  return m[M.flaecheInline] === KEIN_TRAEGER ? null : "#ask-luecke";
}
function knopfDa(m: Messung): string | null {
  return m[M.frageAendern] === "nein" ? null : "#ask-luecke-frage-aendern";
}
function fussDa(m: Messung): string | null {
  return m[M.fusszeile] === "nein" ? null : "#ask-luecke-fuss";
}

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
    } else if (s.art === "darstellung" && lesart.exakt !== true) {
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
 * DIE URTEILE, GEPINNT AUF DAS GEMESSENE (03.09.2026, JOB 3046 auf Basis 9ae6c22). Das ist der
 * Stand NACH dem Umbau: keine Abweichung mehr; 25 Werte tragen „nicht messbar" — sie sind in
 * Chromium gemessen (zielbild-keinwissen.test.ts, ein Vergleich je Wert). Bewegt ein Umbau die
 * Flaeche, wird Fall A rot und nennt die Zeile.
 */
const URTEIL_ERWARTET: Readonly<Record<string, Urteil>> = {
  "Z.27 flaeche-display": NICHT_MESSBAR,
  "Z.27 flaeche-flex-grow": NICHT_MESSBAR,
  "Z.27 flaeche-flex-direction": NICHT_MESSBAR,
  "Z.27 flaeche-align-items": NICHT_MESSBAR,
  "Z.27 flaeche-justify-content": NICHT_MESSBAR,
  "Z.27 flaeche-ohne-kasten": "erfüllt",
  "Z.27 flaeche-textausrichtung": NICHT_MESSBAR,
  "Z.27 flaeche-abstand-gap": NICHT_MESSBAR,
  "Z.27 flaeche-innenabstand": NICHT_MESSBAR,
  "Z.28 lupe-vorhanden": "erfüllt",
  "Z.28 lupe-strichfarbe": NICHT_MESSBAR,
  "Z.28 lupe-strichstaerke": "erfüllt",
  "Z.28 lupe-fuellung": "erfüllt",
  "Z.28 lupe-kreis-vorhanden": "erfüllt",
  "Z.28 lupe-kreis-cx": "erfüllt",
  "Z.28 lupe-kreis-cy": "erfüllt",
  "Z.28 lupe-kreis-r": "erfüllt",
  "Z.29 satz-wortlaut": "erfüllt",
  "Z.29 satz-anzahl-texttraeger": "erfüllt",
  "Z.29 satz-schriftgrad": NICHT_MESSBAR,
  "Z.29 satz-zeilenhoehe": NICHT_MESSBAR,
  "Z.29 satz-farbe": NICHT_MESSBAR,
  "Z.30 hauptaktion-wortlaut": "erfüllt",
  "Z.30 knopf-frage-aendern-vorhanden": "erfüllt",
  "Z.30 knopf-innenabstand": NICHT_MESSBAR,
  "Z.30 knopf-hintergrund": NICHT_MESSBAR,
  "Z.30 knopf-rand": NICHT_MESSBAR,
  "Z.30 knopf-radius": NICHT_MESSBAR,
  "Z.30 knopf-schriftgrad": NICHT_MESSBAR,
  "Z.30 knopf-schnitt": NICHT_MESSBAR,
  "Z.30 knopf-farbe": NICHT_MESSBAR,
  "Z.31 nebenaktion-wortlaut": "erfüllt",
  "Z.31 nebenaktion-form": "erfüllt",
  "Z.31 offene-frage-weg-vorhanden": "erfüllt",
  "Z.31 nebenaktion-schriftgrad": NICHT_MESSBAR,
  "Z.28-31 reihenfolge auskunft-vor-aktion": "erfüllt",
  "Z.35 fusszeile-wortlaut": "erfüllt",
  "Z.35 fusszeile-schriftgrad": NICHT_MESSBAR,
  "Z.35 fusszeile-farbe": NICHT_MESSBAR,
  "Z.34 fusszeile-innenabstand": NICHT_MESSBAR,
  "Z.34 fusszeile-display": NICHT_MESSBAR,
  "Z.34 fusszeile-justify-content": NICHT_MESSBAR,
};

// ================================================================================================
// TEIL 4 — DIE VERLUSTLISTE, UMGEKEHRT: jeder Traeger von vor JOB 3046 mit seinem neuen Platz.
// ================================================================================================

// DIE WORTLAUTE VON VOR JOB 3046, ALS LITERAL — damit die Verlustliste sagt, WAS gefallen ist,
// und die Gegenprobe (G) den alten Titel als Verfaelschung einsetzen kann.
const TITEL_ALT = "Keine belastbare Grundlage.";
const BODY_ALT =
  "Es gibt kein validiertes Wissen zu dieser Frage. Statt einer erfundenen Antwort wurde eine " +
  "Wissenslücke vermerkt — du kannst sie zusätzlich als offene Frage nach KLARWERK geben.";
const AKTION_ALT = "Als offene Frage an KLARWERK senden";
// DIE WORTLAUTE SEIT JOB 3046, ALS LITERAL GEPINNT (nicht nur ueber `panel.t()` — Runde 2, BEN):
// was der Mensch JETZT liest. S1 haelt sie zusaetzlich gegen die Vorlage.
const SATZ_NEU = "Dazu liegt kein freigegebenes Firmenwissen vor.";
const KNOPF_NEU = "Frage ändern";
const AKTION_NEU = "Als offene Frage an KLARWERK geben";
const FUSS_NEU = "Klara erfindet keine Antworten — eine Lücke ist eine ehrliche Auskunft.";
/** Die Klara-Regel — unveraendert, an ihrer EINEN Stelle unter der Antwortflaeche. */
const REGEL =
  "So arbeitet Klara: Sie zitiert validiertes KLARWERK-Wissen wörtlich, statt eine Antwort zu " +
  "formulieren. Dein markierter Text wird dabei nicht an eine externe KI gesendet.";

interface Traeger {
  traeger: string;
  vorher: string;
  jetzt: string;
  verlust: string;
  /** Der Nachweis am laufenden Panel, dass der neue Platz (oder der Verlust) so ist. */
  belegt: (m: Messung) => boolean;
}

const VERLUSTLISTE: readonly Traeger[] = [
  {
    traeger: "div.status.warn (der gelbe Kasten um die Luecke)",
    vorher: "die Luecke war eine WARNUNG — gelber Kasten wie Fehler und Fristen",
    jetzt:
      "ENTFERNT aus der Luecke: askGapTitle steht in der kastenlosen Flaeche #ask-luecke (Z.27). " +
      "`.status.warn` bleibt den echten Warnungen in #ask-status (askEmpty, askAuth, askForbiddenRead, " +
      "askError, askTimeout, s4FragenGesperrt, truncated) — Fall U2/U3.",
    verlust:
      "Der Warn-Ton. Das ist Absicht: eine Luecke ist eine Auskunft, kein Fehler. Die Sichtbarkeit " +
      "im Scrollfluss traegt jetzt die Lupe (36px) und der 16px-Satz.",
    belegt: (m) =>
      m[M.kasten] === "" &&
      !/background|border/.test(m[M.flaecheInline] ?? "") &&
      m[M.status] === "nein",
  },
  {
    traeger: `askGapTitle (vorher „${TITEL_ALT}")`,
    vorher: "der Titel der Absage — derselbe Kernsatz wie in der Konsole",
    jetzt: `BLEIBT als Schluessel; Wortlaut Z.29 „${SATZ_NEU}" im Traeger #ask-luecke-satz.`,
    verlust: [
      `Die Paritaet zur Konsole (ask.noBasisTitle „${TITEL_ALT}" bleibt dort).`,
      "Bewusst: Zielbild vor Paritaet (Pedi 27.08./03.09.), word-addin-ask pinnt beide Saetze.",
    ].join(" "),
    belegt: (m) => m[M.titel] === SATZ_NEU && m[M.titel] === panel.t("askGapTitle"),
  },
  {
    traeger: `askGapBody (vorher „${BODY_ALT.slice(0, 48)}…")`,
    vorher: "erklaerte, DASS die Luecke vermerkt ist und dass sie als offene Frage reisen kann",
    jetzt: "ENTFERNT — Traeger und Schluessel, in allen drei Sprachen (kein toter Schluessel).",
    verlust:
      "Die Auskunft ›eine Wissensluecke wurde vermerkt‹. Sie bleibt WAHR (/api/ask vermerkt sie), " +
      "wird an der Auskunft aber nicht mehr gesagt; die Fusszeile Z.35 traegt die Haltung.",
    belegt: (m) => m[M.body] === "0 Traeger, Schluessel entfernt",
  },
  {
    traeger: "askRuleNote im Lueckenblock (die Zweitkopie, mega75 Block C)",
    vorher: "im Moment des ›warum nicht?‹ stand die Regel noch einmal im Kasten",
    jetzt:
      "Die Zweitkopie ist ENTFERNT; die Regel steht an ihrer EINEN Stelle #ask-rule-note unter der " +
      "Antwortflaeche (JOB 3004), sichtbar auch in der Luecke — M20.",
    verlust:
      "Keine Zusage faellt: derselbe Schluessel, derselbe Wortlaut, sichtbar bei jeder Antwort und " +
      "jeder Absage — nur nicht mehr doppelt.",
    belegt: (m) => m[M.regel] === "0 Traeger" && m[M.regelUnten] === REGEL,
  },
  {
    traeger: `button.primary#ask-gap-send-btn (vorher „${AKTION_ALT}")`,
    vorher: "die HAUPTAKTION der Luecke; panelweit der zweite sichtbare primary neben #ask-btn",
    jetzt: [
      `Textlink a#ask-gap-send-btn (Z.31) „${AKTION_NEU}", derselbe Handler sendOpenQuestion,`,
      "dieselbe Kennung, askGapSentOk und der Entwurfs-Link wie bisher (Fall H); ohne primary.",
      `Hauptaktion ist jetzt #ask-luecke-frage-aendern „${KNOPF_NEU}" (Z.30) — Fall F.`,
    ].join(" "),
    verlust:
      "Nicht der Weg, sondern sein Gewicht: der Knopf wird zum Kleingedruckten. Ein <a> kennt kein " +
      "`disabled` — die Doppel-POST-Sperre traegt `aria-disabled`.",
    belegt: (m) =>
      m[M.hauptaktion] === "keine" &&
      m[M.aktionForm] === "a" &&
      m[M.aktionText] === AKTION_NEU &&
      m[M.frageAendern] === KNOPF_NEU &&
      m[M.primaryPanel] === "#ask-btn",
  },
  {
    traeger: "#ask-gap-open-block (versteckt bis zum Senden)",
    vorher: "erscheint NACH dem Senden mit dem Link zum Entwurf (/capture/frontdoor?draft=<id>)",
    jetzt: "BLEIBT unveraendert im Lueckenblock, zwischen Flaeche und Fusszeile (Fall H).",
    verlust: "keiner — der Rueckweg zum eigenen Entwurf ist nach dem Senden weiter auffindbar.",
    belegt: (m) => m[M.openVersteckt] === "ja",
  },
];

// ================================================================================================
// DER LAUF: das ausgelieferte Panel, an die echte App, in die Luecke.
// ================================================================================================

const FRAGE = "Wie lagern wir Ersatzteile für Linie 4?"; // der Wortlaut der Frage-Pille, Z.23
const TOTER_HREF = "https://app.klarwerk.ai/erfassen";

/**
 * JOB 3046, Fall U: die Uebergaenge brauchen Ausgaenge, die die echte App ohne Wissen nicht liefert
 * (Antwort, 401, 403, 500). Diese Fragen werden VOR der Bruecke beantwortet — benannt, nicht
 * versteckt; jede andere Frage geht unveraendert an die echte App. Gemessen wird das Panel.
 */
const STUB_FRAGEN: Readonly<Record<string, { status: number; body?: unknown }>> = {
  "STUB: Antwort": {
    status: 200,
    body: {
      result: {
        answered: true,
        answer: "Ersatzteile für Linie 4 lagern im Regal B3.",
        sources: ["stub-quelle-3046"],
        trust: 80,
      },
    },
  },
  "STUB: 401": { status: 401, body: {} },
  "STUB: 403": { status: 403, body: {} },
  "STUB: 500": { status: 500, body: {} },
};

let b: Bruecke;
let panel: KlaraPanel;
let basis: Messung;
/** Jeder Rumpf, den das Panel an POST /api/drafts geschickt hat. */
const eingaenge: Array<{ statement?: string }> = [];
/** Jeder POST /api/ask, den das Panel abgesetzt hat (Frage), in Reihenfolge. */
const askFragen: string[] = [];
/** Runde 2 (F2): den naechsten Entwurfsversand festhalten, bis `entwurfFreigeben()` — ggf. als Fehler. */
let entwurfHalten = false;
let entwurfFehler = false;
let entwurfFreigeben: () => void = () => undefined;
const FRAGE_A = "Was gilt für Linie 8?";
const FRAGE_B = "Neue Frage zu Linie 9?";
const FRAGE_C = "Gibt es eine Regel für Linie 10?";
const FRAGE_D = "Und für Linie 11?";

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
  console.info(`\nJOB 3010/3046 · ${titel}\n${zeilen.join("\n")}\n`);
}

function eingabe(): DomEl {
  return dom("#ask-input");
}

/** Eine Frage stellen und auf den genannten Ausgang warten. */
async function fragen(frage: string, bis: () => boolean, was: string): Promise<void> {
  const el = eingabe();
  (el as unknown as { value: string }).value = frage;
  panel.askKlara();
  await abwarten(bis, was);
  await panel.flush();
}

const luecke = (): boolean => sichtbarBis(dom("#ask-gap-block"), null);
const warnung = (): boolean =>
  sichtbarBis(dom("#ask-status"), null) && klassen(dom("#ask-status")).includes("warn");

describe.runIf(zielbildDa)(
  "JOB 3010/3046 · D2 „KeinWissen“ — Messung am laufenden Panel gegen das Zielbild",
  () => {
    beforeAll(async () => {
      b = await bruecke();
      const bridge = globalThis.fetch;
      panel = createKlaraPanel();
      const mitschrift = (async (eingabe: unknown, init?: RequestInit) => {
        const url = String(eingabe);
        const method = (init?.method ?? "GET").toUpperCase();
        if (method === "POST" && url === "/api/drafts") {
          eingaenge.push(JSON.parse(String(init?.body ?? "{}")));
          // Runde 2 (Fall F2): der Versand kann festgehalten werden — wie ein langsamer Server —
          // und dann als Fehler enden; sonst geht er an die echte App.
          if (entwurfHalten) {
            entwurfHalten = false;
            await new Promise<void>((r) => {
              entwurfFreigeben = r;
            });
            if (entwurfFehler) {
              entwurfFehler = false;
              return {
                ok: false,
                status: 500,
                statusText: "500",
                headers: { get: () => null },
                text: async () => "{}",
                json: async () => ({}),
              } as unknown as Response;
            }
          }
        }
        if (method === "POST" && url === "/api/ask") {
          const frage = String(
            (JSON.parse(String(init?.body ?? "{}")) as { question?: string }).question ?? "",
          );
          askFragen.push(frage);
          const stub = STUB_FRAGEN[frage];
          if (stub !== undefined) {
            return {
              ok: stub.status >= 200 && stub.status < 300,
              status: stub.status,
              statusText: String(stub.status),
              headers: { get: () => null },
              text: async () => JSON.stringify(stub.body ?? {}),
              json: async () => stub.body ?? {},
            } as unknown as Response;
          }
        }
        return bridge(eingabe as string, init);
      }) as typeof globalThis.fetch;
      globalThis.fetch = mitschrift;
      (globalThis as unknown as { window: { fetch: unknown } }).window.fetch = mitschrift;
      await panel.flush();
      // echte App ohne Wissen -> /api/ask antwortet answered:false -> kind "gap"
      await fragen(FRAGE, luecke, "der Lueckenzustand erscheint");
      basis = messen();
    });

    afterAll(async () => {
      await panel.flush();
      panel.restore();
      b.abbauen();
    });

    it("K0 · Kalibrierung: die echte App hat /api/ask beantwortet, das Panel steht in der Luecke — kein stiller Null-Treffer", () => {
      expect(b.aufrufe.some((c) => c.method === "POST" && c.url === "/api/ask")).toBe(true);
      expect(askFragen).toEqual([FRAGE]);
      expect(basis[M.blockSichtbar], "der Lueckenzustand ist nicht erreicht").toBe("ja");
      expect(basis[M.antwort], "Antwortblock und Luecke zugleich").toBe("nein");
      expect(basis[M.status], "der Lueckenzustand versteckt die Statuszeile (hideAskStatus)").toBe(
        "nein",
      );
      expect(SOLL.length).toBe(SOLL_LESART.length);
      expect(SOLL.length).toBeGreaterThan(0);
      expect(abweichungen(basis)).toHaveLength(SOLL.length);
      drucke(
        "MESSUNG am laufenden Panel",
        Object.entries(basis).map(([k, v]) => `  ${k} = ›${v}‹`),
      );
    });

    it("S1 · die Sollwerttabelle: jeder Wert aus der Vorlage gelesen, kanonisiert, und gleich dem Pin vom 27.08.2026 — und die gepinnten Wortlaute sind die der Vorlage", () => {
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
      // JOB 3046: die Literal-Pins dieser Datei SIND die Vorlage — Wort fuer Wort.
      expect(SATZ_NEU).toBe(SOLL_ERWARTET["Z.29 satz-wortlaut"]);
      expect(KNOPF_NEU).toBe(SOLL_ERWARTET["Z.30 hauptaktion-wortlaut"]);
      expect(AKTION_NEU).toBe(SOLL_ERWARTET["Z.31 nebenaktion-wortlaut"]);
      expect(FUSS_NEU).toBe(SOLL_ERWARTET["Z.35 fusszeile-wortlaut"]);
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

    it("M2 · der eine Satz lautet ›Dazu liegt kein freigegebenes Firmenwissen vor.‹ (Z.29) — gemessen am gerenderten Text, nicht am Quelltext; derselbe Schluessel askGapTitle", () => {
      expect(basis[M.titel]).toBe(SATZ_NEU);
      expect(basis[M.titel]).toBe(panel.t("askGapTitle")); // derselbe Schluessel, dieselbe Quelle
      expect(basis[M.titel]).not.toBe(TITEL_ALT);
    });

    it("M9 · askGapBody ist ENTFERNT — kein Traeger im Block, kein Schluessel im Woerterbuch (t() faellt auf den Schluesselnamen zurueck), in allen drei Sprachen", () => {
      expect(basis[M.body]).toBe("0 Traeger, Schluessel entfernt");
      for (const sprache of ["de", "en", "nl"]) {
        panel.setLang(sprache);
        expect(panel.t("askGapBody"), `${sprache}: askGapBody lebt noch`).toBe("askGapBody");
        expect(panel.t("askGapTitle"), `${sprache}: askGapTitle leer`).not.toBe("askGapTitle");
        expect(panel.t("askGapFrageAendern"), `${sprache}: askGapFrageAendern fehlt`).not.toBe(
          "askGapFrageAendern",
        );
        expect(panel.t("askGapFuss"), `${sprache}: askGapFuss fehlt`).not.toBe("askGapFuss");
      }
      panel.setLang("de");
      expect(messen()).toEqual(basis); // der Sprachwechsel hin und zurueck laesst nichts zurueck
    });

    it("M10 · die Zweitkopie von askRuleNote ist aus dem Block ENTFERNT; die Regel steht an ihrer EINEN Stelle #ask-rule-note, sichtbar in der Luecke, im unveraenderten Wortlaut", () => {
      expect(basis[M.regel]).toBe("0 Traeger");
      expect(basis[M.regelUnten]).toBe(REGEL);
      expect(basis[M.regelUnten]).toBe(panel.t("askRuleNote"));
    });

    it("M3 · KEIN primary im Lueckenblock; die Hauptaktion ist der Knopf ›Frage ändern‹, die Nebenaktion der Textlink a#ask-gap-send-btn ›… geben‹; panelweit genau EIN primary (#ask-btn)", () => {
      expect(basis[M.hauptaktion]).toBe("keine");
      expect(basis[M.aktionen]).toBe("#ask-luecke-frage-aendern, #ask-gap-send-btn");
      expect(basis[M.frageAendern]).toBe(KNOPF_NEU);
      expect(basis[M.aktionText]).toBe(AKTION_NEU);
      expect(basis[M.aktionForm]).toBe("a");
      expect(
        dom("#ask-gap-send-btn").getAttribute("aria-disabled"),
        "der Textlink ist gesperrt",
      ).not.toBe("true");
      expect(dom("#ask-gap-send-btn").getAttribute("href")).toBe("#");
      // Im GANZEN Panel steht im Lueckenzustand genau EIN sichtbarer primary: der Frage-Knopf der
      // Karte darueber. Vor JOB 3046 waren es zwei.
      expect(basis[M.primaryPanel]).toBe("#ask-btn");
    });

    it("M4 · was ein Mensch sieht, in dieser Reihenfolge und VOLLSTAENDIG: Lupe, Satz, ›Frage ändern‹, Textlink, Fusszeile — sonst nichts; kein Kasten", () => {
      expect(basis[M.reihenfolge]).toBe(
        "#ask-luecke-satz > #ask-luecke-frage-aendern > #ask-gap-send-btn > #ask-luecke-fuss",
      );
      expect(basis[M.kasten]).toBe("");
      expect(basis[M.flaecheInline]).toBe("");
      // Runde 2 (BEN): die Flaeche steht NEBEN der Frage-Karte — zwischen ihr und dem Panel liegt
      // kein `.card` mehr (vor Runde 2: `#ask-gap-block > #ask-karte.card > #section-ask`).
      expect(basis[M.ahnen]).toBe("#ask-gap-block > #section-ask");
      expect(basis[M.svgs]).toBe("1");
      expect(basis[M.lupe]).toBe("svg 36x36 mit Pfad M21 21l-4.35-4.35");
      expect(basis[M.lupeKreis]).toBe("circle cx=11 cy=11 r=7");
      expect(basis[M.lupeStrich]).toBe("stroke=currentColor stroke-width=1.5 fill=none");
      expect(basis[M.texttraeger]).toBe("1");
      expect(basis[M.fusszeile]).toBe(FUSS_NEU);
      expect(basis[M.fusszeile]).toBe(panel.t("askGapFuss"));
    });

    it("A · die Abweichungstabelle: je Sollwert Soll, Ist, Beleg, Urteil — gepinnt auf das Gemessene: 17 erfüllt · 0 abweichend · 25 nicht messbar (in Chromium gemessen)", () => {
      const tabelle = abweichungen(basis);
      const urteile: Record<string, Urteil> = {};
      for (const z of tabelle) {
        urteile[z.kennung] = z.urteil;
      }
      expect(urteile).toEqual(URTEIL_ERWARTET);
      const zaehlung = { erfüllt: 0, abweichend: 0, [NICHT_MESSBAR]: 0 } as Record<Urteil, number>;
      for (const z of tabelle) {
        zaehlung[z.urteil] += 1;
      }
      // JOB 3046: keine Abweichung mehr. Der Zweig „abweichend" ist kein toter Zweig — die
      // Gegenprobe G zeigt ihn (alter Titel eingesetzt -> Z.29 satz-wortlaut abweichend).
      expect(zaehlung.erfüllt).toBe(17);
      expect(zaehlung.abweichend).toBe(0);
      expect(zaehlung[NICHT_MESSBAR]).toBe(25);
      // Die Ist-Werte, die den Befund tragen — hier als Text, damit ein Wandern sichtbar wird.
      const ist = (k: string): string => tabelle.find((z) => z.kennung === k)?.ist ?? "";
      expect(ist("Z.27 flaeche-ohne-kasten")).toBe("kein Kasten (weder background noch border)");
      expect(ist("Z.29 satz-wortlaut")).toBe(SATZ_NEU);
      expect(ist("Z.29 satz-anzahl-texttraeger")).toBe("1");
      expect(ist("Z.30 hauptaktion-wortlaut")).toBe(KNOPF_NEU);
      expect(ist("Z.30 knopf-frage-aendern-vorhanden")).toBe("Knopf ›Frage ändern‹ vorhanden");
      expect(ist("Z.31 nebenaktion-form")).toBe("a (Textlink, ohne primary)");
      expect(ist("Z.35 fusszeile-wortlaut")).toBe(FUSS_NEU);
      expect(ist("Z.28 lupe-vorhanden")).toBe("svg 36x36 mit Pfad M21 21l-4.35-4.35");
      expect(ist("Z.28 lupe-kreis-vorhanden")).toBe("circle vorhanden");
      expect(ist("Z.28 lupe-fuellung")).toBe("none");
      expect(ist("Z.28 lupe-strichstaerke")).toBe("1.5");
      expect(ist("Z.28 lupe-kreis-r")).toBe("7");
      drucke("ABWEICHUNGSTABELLE (Soll ← Zielbild · Ist ← laufendes Panel)", [
        `  ${"Kennung".padEnd(42)} ${"Urteil".padEnd(12)} Soll → Ist  [Beleg]`,
        ...tabelle.map(
          (z) =>
            `  ${z.kennung.padEnd(42)} ${(z.urteil === NICHT_MESSBAR ? "nicht messb." : z.urteil).padEnd(12)} ›${z.soll}‹ → ›${z.ist}‹  [${z.beleg}]`,
        ),
        `  Summe: ${zaehlung.erfüllt} erfüllt · ${zaehlung.abweichend} abweichend · ${zaehlung[NICHT_MESSBAR]} ${NICHT_MESSBAR}`,
      ]);
    });

    it("V · die Verlustliste, umgekehrt: jeder der sechs Traeger von vor JOB 3046 hat seinen neuen Platz oder seinen dokumentierten Verlust — am laufenden Panel belegt", () => {
      expect(VERLUSTLISTE).toHaveLength(6);
      for (const v of VERLUSTLISTE) {
        expect(v.belegt(basis), `nicht belegt: ${v.traeger}`).toBe(true);
      }
      drucke(
        "VERLUSTLISTE, umgekehrt gelesen (vor JOB 3046 → jetzt)",
        VERLUSTLISTE.flatMap((v) => [
          `  ${v.traeger}`,
          `    vorher:  ${v.vorher}`,
          `    jetzt:   ${v.jetzt}`,
          `    Verlust: ${v.verlust}`,
        ]),
      );
    });

    it("G · GEGENPROBE: acht Verfaelschungen im Speicher der Testsitzung kippen jeweils GENAU ihre Messgroesse — darunter ›Frage ändern‹ entfernt → M13", () => {
      const block = dom("#ask-gap-block");
      const flaeche = dom("#ask-luecke");
      const titel = dom('#ask-gap-block [data-t="askGapTitle"]');
      const knopf = dom("#ask-luecke-frage-aendern");
      const link = dom("#ask-gap-send-btn");
      const fuss = dom("#ask-luecke-fuss");
      const textSetzen = (el: DomEl, wert: string | null): void => {
        (el as unknown as { textContent: string | null }).textContent = wert;
      };
      const setzen = (el: DomEl, attr: string, wert: string | null): void => {
        if (wert === null) {
          el.removeAttribute(attr);
        } else {
          el.setAttribute(attr, wert);
        }
      };
      const gefallen = (): string[] =>
        Object.entries(messen())
          .filter(([k, v]) => basis[k] !== v)
          .map(([k]) => k);

      // Vor jeder Verfaelschung: nichts gefallen (die Messung ist stabil, nicht zufaellig).
      expect(gefallen()).toEqual([]);

      // (1) Block versteckt -> M1 faellt, M13 und M14 (Knopf und Fusszeile sind dann nicht mehr
      // sichtbar); M3/M4/M18 messen INNERHALB des Blocks, bewusst — sie bleiben stehen; M19 bleibt,
      // weil die Luecke keinen primary mehr traegt (vor JOB 3046 fiel M19 hier mit).
      const blockKlasse = block.getAttribute("class");
      setzen(block, "class", "hidden");
      const g1 = gefallen();
      setzen(block, "class", blockKlasse);
      expect(g1).toEqual([M.blockSichtbar, M.frageAendern, M.fusszeile]);

      // (2) Titel auf den ALTEN Satz zurueckgedreht -> NUR M2 faellt; die Abweichungstabelle
      // nennt genau Z.29 satz-wortlaut als abweichend (der Zweig ist kein toter Zweig).
      const titelText = titel.textContent;
      textSetzen(titel, TITEL_ALT);
      const g2 = gefallen();
      const abweichend2 = abweichungen(messen())
        .filter((z) => z.urteil === "abweichend")
        .map((z) => z.kennung);
      textSetzen(titel, titelText);
      expect(g2).toEqual([M.titel]);
      expect(abweichend2).toEqual(["Z.29 satz-wortlaut"]);

      // (3) `primary` auf den Textlink gesetzt -> M3 (primary im Block), M12 (Elementform) und
      // M19 (primary im Panel) fallen — die Ein-primary-Regel des Zielbilds kippt.
      const linkKlasse = link.getAttribute("class");
      setzen(link, "class", "primary");
      const g3 = gefallen();
      const m3 = messen();
      setzen(link, "class", linkKlasse);
      expect(g3).toEqual([M.hauptaktion, M.aktionForm, M.primaryPanel]);
      expect(m3[M.primaryPanel]).toBe("#ask-btn, #ask-gap-send-btn");

      // (4) JOB 3046: ›Frage ändern‹ ENTFERNT -> M13 faellt, und mit ihm M4 (Inventur) und M18
      // (Aktionen); die Abweichungstabelle verliert genau die neun Z.30-Werte und die Reihenfolge.
      const knopfEltern = knopf.parentElement;
      if (knopfEltern === null) {
        throw new Error("Knopf ohne Elternelement");
      }
      const knopfNachbar = link; // der Knopf steht direkt vor dem Textlink
      knopfEltern.removeChild(knopf);
      const g4 = gefallen();
      const m4 = messen();
      const abweichend4 = abweichungen(m4)
        .filter((z) => z.urteil === "abweichend")
        .map((z) => z.kennung);
      (knopfEltern as unknown as { insertBefore(a: DomEl, b: DomEl): void }).insertBefore(
        knopf,
        knopfNachbar,
      );
      expect(g4).toEqual([M.reihenfolge, M.frageAendern, M.aktionen]);
      expect(m4[M.frageAendern]).toBe("nein");
      expect(abweichend4).toEqual([
        "Z.30 hauptaktion-wortlaut",
        "Z.30 knopf-frage-aendern-vorhanden",
        "Z.30 knopf-innenabstand",
        "Z.30 knopf-hintergrund",
        "Z.30 knopf-rand",
        "Z.30 knopf-radius",
        "Z.30 knopf-schriftgrad",
        "Z.30 knopf-schnitt",
        "Z.30 knopf-farbe",
        "Z.28-31 reihenfolge auskunft-vor-aktion",
      ]);

      // (5) Fusszeilensatz veraendert -> NUR M14 faellt; die Verlustliste haelt (sie haengt nicht
      // am Fuss), die Abweichungstabelle nennt Z.35 fusszeile-wortlaut.
      const fussText = fuss.textContent;
      textSetzen(fuss, "Klara erfindet manchmal Antworten.");
      const g5 = gefallen();
      const abweichend5 = abweichungen(messen())
        .filter((z) => z.urteil === "abweichend")
        .map((z) => z.kennung);
      textSetzen(fuss, fussText);
      expect(g5).toEqual([M.fusszeile]);
      expect(abweichend5).toEqual(["Z.35 fusszeile-wortlaut"]);

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
      expect(m6[M.hauptaktion]).toBe("button›Nochmal fragen‹");
      expect(m6[M.primaryPanel]).toBe("#ask-btn, button›Nochmal fragen‹");

      // (7) Runde 3 (BEN): ein zusaetzlicher sichtbarer Text OHNE Marker in der FLAECHE -> M4
      // (Inventur) und M15 (Anzahl Texttraeger — Z.29 kennt genau EINEN) fallen, sonst nichts.
      const extraText = dg.document.createElement("p");
      (extraText as unknown as { textContent: string }).textContent =
        "Ein Satz, den niemand angemeldet hat.";
      flaeche.appendChild(extraText);
      const g7 = gefallen();
      const m7 = messen();
      flaeche.removeChild(extraText);
      expect(g7).toEqual([M.reihenfolge, M.texttraeger]);
      expect(m7[M.texttraeger]).toBe("2");
      expect(m7[M.reihenfolge]).toContain("> p›Ein Satz, den niemand angemeldet hat.‹");

      // (8) JOB 3046: ein Kasten per Inline-Stil auf der Flaeche -> M24 faellt; Z.27 flaeche-ohne-
      // kasten wird abweichend, und die Verlustliste verliert genau den Warnkasten-Traeger.
      setzen(flaeche, "style", "background: #FDF1D7; border: 1px solid #8A5A00");
      const g8 = gefallen();
      const m8 = messen();
      const abweichend8 = abweichungen(m8)
        .filter((z) => z.urteil === "abweichend")
        .map((z) => z.kennung);
      const verlust8 = VERLUSTLISTE.filter((v) => !v.belegt(m8)).map((v) => v.traeger);
      setzen(flaeche, "style", null);
      expect(g8).toEqual([M.flaecheInline]);
      expect(abweichend8).toEqual(["Z.27 flaeche-ohne-kasten"]);
      expect(verlust8).toEqual(["div.status.warn (der gelbe Kasten um die Luecke)"]);

      // Nach dem Zuruecksetzen: wieder nichts gefallen, kein Traeger verloren.
      expect(gefallen()).toEqual([]);
      expect(VERLUSTLISTE.every((v) => v.belegt(messen()))).toBe(true);
    });

    it("F · ›Frage ändern‹ tut, was es sagt: Flaeche zu, Ergebnisreste weg, Frage im Feld, Fokus im Feld, Cursor am Ende, kein Reststatus, KEIN POST /api/ask", async () => {
      const askVorher = askFragen.length;
      const knopf = dom("#ask-luecke-frage-aendern");
      if (typeof knopf.click !== "function") {
        throw new Error("#ask-luecke-frage-aendern ist nicht klickbar");
      }
      knopf.click();
      await panel.flush();
      const feld = eingabe();
      expect(sichtbarBis(dom("#ask-gap-block"), null)).toBe(false);
      expect(sichtbarBis(dom("#ask-gap-open-block"), null)).toBe(false);
      expect(sichtbarBis(dom("#ask-answer-block"), null)).toBe(false);
      expect(sichtbarBis(dom("#ask-status"), null)).toBe(false);
      expect(feld.value).toBe(FRAGE);
      expect(dg.document.activeElement, "der Fokus liegt nicht in #ask-input").toBe(feld);
      expect(feld.selectionStart).toBe(FRAGE.length);
      expect(feld.selectionEnd).toBe(FRAGE.length);
      expect(askFragen.length, "›Frage ändern‹ hat einen Serveraufruf ausgeloest").toBe(askVorher);
      // Zurueck in die Luecke — dieselbe Frage, dieselbe echte App: die Messung ist dieselbe.
      await fragen(FRAGE, luecke, "die Luecke erscheint erneut");
      expect(askFragen.length).toBe(askVorher + 1);
      expect(messen()).toEqual(basis);
    });

    it("U1 · Luecke → neue Frage → Antwort: die Luecke raeumt sich ab (resetAskResult), der Antwortblock steht, kein Warnkasten", async () => {
      await fragen(
        "STUB: Antwort",
        () => sichtbarBis(dom("#ask-answer-block"), null),
        "die Antwort erscheint",
      );
      expect(sichtbarBis(dom("#ask-gap-block"), null)).toBe(false);
      expect(sichtbarBis(dom("#ask-luecke-fuss"), null)).toBe(false);
      expect(sichtbarBis(dom("#ask-status"), null)).toBe(false);
      expect(
        text(dom("#ask-answer-edit")).length + (dom("#ask-answer-edit").value ?? "").length,
      ).toBeGreaterThan(0);
      // Und zurueck: Antwort → neue Frage → Luecke. Der Antwortblock geht, die Luecke steht.
      await fragen(FRAGE, luecke, "die Luecke erscheint nach der Antwort");
      expect(sichtbarBis(dom("#ask-answer-block"), null)).toBe(false);
      expect(messen()).toEqual(basis);
    });

    it("U2 · jede echte Warnung (leer, 401, 403, 500) zeigt den Warnkasten in #ask-status und NIE die Lueckenflaeche — keine negative Aussage ohne erfolgreiche Antwort", async () => {
      const faelle: Array<{ frage: string; schluessel: string }> = [
        { frage: "", schluessel: "askEmpty" },
        { frage: "STUB: 401", schluessel: "askAuth" },
        { frage: "STUB: 403", schluessel: "askForbiddenRead" },
        { frage: "STUB: 500", schluessel: "askError" },
      ];
      for (const f of faelle) {
        await fragen(f.frage, warnung, `Warnung fuer ›${f.frage}‹`);
        expect(sichtbarBis(dom("#ask-gap-block"), null), `${f.schluessel}: Luecke sichtbar`).toBe(
          false,
        );
        expect(
          sichtbarBis(dom("#ask-answer-block"), null),
          `${f.schluessel}: Antwort sichtbar`,
        ).toBe(false);
        expect(klassen(dom("#ask-status"))).toEqual(["status", "warn"]);
        const erwartet = panel.t(f.schluessel, { detail: "HTTP 500" });
        expect(panel.text("#ask-status"), f.schluessel).toBe(erwartet);
        // Zurueck in die Luecke: sie steht wieder, der Warnkasten ist weg.
        await fragen(FRAGE, luecke, `Luecke nach ${f.schluessel}`);
        expect(messen()).toEqual(basis);
      }
    });

    it("U3 · der truncated-Hinweis bleibt eine echte Warnung NEBEN der Luecke (#ask-status warn); ›Frage ändern‹ nimmt ihn mit", async () => {
      const lang = `${"Wie lagern wir Ersatzteile? ".repeat(80)}Ende.`;
      expect(lang.length).toBeGreaterThan(2000);
      await fragen(lang, () => luecke() && warnung(), "Luecke mit truncated-Warnung");
      expect(panel.text("#ask-status")).toBe(panel.t("askTruncated", { max: "2000" }));
      expect(sichtbarBis(dom("#ask-luecke"), null)).toBe(true);
      const knopf = dom("#ask-luecke-frage-aendern");
      if (typeof knopf.click !== "function") {
        throw new Error("#ask-luecke-frage-aendern ist nicht klickbar");
      }
      knopf.click();
      await panel.flush();
      expect(sichtbarBis(dom("#ask-gap-block"), null)).toBe(false);
      expect(sichtbarBis(dom("#ask-status"), null)).toBe(false);
      expect(eingabe().value).toBe(lang);
      await fragen(FRAGE, luecke, "die Luecke erscheint nach der langen Frage");
      expect(messen()).toEqual(basis);
    });

    it("F2 · UEBERLAPPUNG (Runde 2, BEN): offene Frage gesendet → vor dem Ruecklauf ›Frage ändern‹ → andere Frage → der alte Ruecklauf (Erfolg, dann Fehler) veraendert die neue Luecke nicht; ›Frage ändern‹ loest die Sperre", async () => {
      const link = dom("#ask-gap-send-btn");
      const knopf = dom("#ask-luecke-frage-aendern");
      if (typeof link.click !== "function" || typeof knopf.click !== "function") {
        throw new Error("Textlink oder Knopf nicht klickbar");
      }
      const gesperrt = (): boolean => link.getAttribute("aria-disabled") === "true";
      // (a) Erfolg der alten Frage kommt in der neuen Luecke an.
      await fragen(FRAGE_A, luecke, "Luecke fuer Linie 8");
      const eingaengeVorher = eingaenge.length;
      entwurfHalten = true;
      link.click();
      await abwarten(() => eingaenge.length === eingaengeVorher + 1, "der alte Versand geht ab");
      expect(gesperrt(), "waehrend des Versands ist der Textlink gesperrt").toBe(true);
      knopf.click(); // ›Frage ändern‹ — die Sperre faellt HIER, nicht erst mit einem Ruecklauf.
      await panel.flush();
      expect(sichtbarBis(dom("#ask-gap-block"), null)).toBe(false);
      expect(gesperrt()).toBe(false);
      await fragen(FRAGE_B, luecke, "Luecke fuer Linie 9");
      const neueLuecke = messen();
      expect(gesperrt()).toBe(false);
      expect(neueLuecke[M.status]).toBe("nein");
      expect(neueLuecke[M.openVersteckt]).toBe("ja");
      entwurfFreigeben(); // der alte Erfolg (die echte App legt den Entwurf fuer Linie 8 an)
      await abwarten(
        () => b.aufrufe.filter((c) => c.method === "POST" && c.url === "/api/drafts").length >= 1,
        "der alte Versand erreicht die echte App",
      );
      await panel.flush();
      await panel.flush();
      expect(messen(), "der alte Erfolg hat die neue Luecke veraendert").toEqual(neueLuecke);
      expect(gesperrt()).toBe(false);
      expect(dom("#ask-gap-open-link").href).not.toContain("draft=");
      // Der neue Versand gehoert der neuen Frage.
      link.click();
      await abwarten(() => eingaenge.length === eingaengeVorher + 2, "der neue Versand geht ab");
      await abwarten(
        () => sichtbarBis(dom("#ask-gap-open-block"), null),
        "der Entwurfs-Link der neuen Frage erscheint",
      );
      expect(eingaenge[eingaenge.length - 1]?.statement).toBe(FRAGE_B);
      expect(panel.text("#ask-status")).toContain(FRAGE_B);
      expect(klassen(dom("#ask-status"))).toEqual(["status", "ok"]);
      // (b) Fehler der alten Frage kommt in der neuen Luecke an — keine Warnung, keine Sperre.
      knopf.click();
      await panel.flush();
      await fragen(FRAGE_C, luecke, "Luecke fuer Linie 10");
      entwurfHalten = true;
      entwurfFehler = true;
      link.click();
      await abwarten(
        () => eingaenge.length === eingaengeVorher + 3,
        "der alte Fehlversand geht ab",
      );
      expect(gesperrt()).toBe(true);
      knopf.click();
      await panel.flush();
      await fragen(FRAGE_D, luecke, "Luecke fuer Linie 11");
      const neueLuecke2 = messen();
      entwurfFreigeben();
      await panel.flush();
      await panel.flush();
      expect(messen(), "der alte Fehler hat die neue Luecke veraendert").toEqual(neueLuecke2);
      expect(neueLuecke2[M.status]).toBe("nein");
      expect(gesperrt()).toBe(false);
      // Kalibrierung: derselbe Fehler OHNE Wechsel ist sichtbar (sendError) und loest die Sperre.
      entwurfHalten = true;
      entwurfFehler = true;
      link.click();
      await abwarten(
        () => eingaenge.length === eingaengeVorher + 4,
        "der Kalibrier-Versand geht ab",
      );
      entwurfFreigeben();
      await abwarten(() => !gesperrt(), "der Fehler loest die Sperre");
      expect(klassen(dom("#ask-status"))).toEqual(["status", "warn"]);
      expect(panel.text("#ask-status")).toBe(panel.t("sendError", { detail: "HTTP 500" }));
      // Zurueck in den Grundzustand: dieselbe Messung wie zu Beginn — bis auf M6: der href des
      // (verborgenen) Entwurfs-Links traegt den zuletzt gesendeten Entwurf; er wird vor jedem
      // Einblenden neu gesetzt (sendOpenQuestion), nie sichtbar mit altem Ziel (Fall H prueft das).
      await fragen(FRAGE, luecke, "die Luecke erscheint erneut");
      const ohneHref = (m: Messung): Record<string, string> => {
        const { [M.openHref]: _href, ...rest } = m;
        return rest;
      };
      expect(ohneHref(messen())).toEqual(ohneHref(basis));
      expect(messen()[M.openHref]).toContain("/capture/frontdoor?draft=");
    });

    it("H · der tote href: im Lueckenzustand ist der Link versteckt und traegt die Markup-Adresse; nach dem Senden ueber den Textlink ersetzt das Panel sie durch /capture/frontdoor?draft=<id>", async () => {
      // VOR dem Senden: Block versteckt, href = die Markup-Adresse — nie sichtbar ausgeliefert.
      expect(basis[M.openVersteckt]).toBe("ja");
      expect(basis[M.openHref]).toBe(TOTER_HREF);
      expect(sichtbarBis(dom("#ask-gap-open-link"), null)).toBe(false);

      // Senden ueber den Textlink — die echte App legt den Entwurf an.
      const link = dom("#ask-gap-send-btn");
      if (typeof link.click !== "function") {
        throw new Error("#ask-gap-send-btn ist nicht klickbar");
      }
      link.click();
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
      // Die Erfolgszeile nennt den Entwurf; der Lueckenblock bleibt stehen; der Textlink ist
      // wieder frei (aria-disabled entfernt).
      expect(nachher[M.status]).toBe("ja");
      expect(klassen(dom("#ask-status"))).toEqual(["status", "ok"]);
      expect(nachher[M.blockSichtbar]).toBe("ja");
      expect(link.getAttribute("aria-disabled")).toBeNull();
      drucke("ZWEI ADRESSEN FUER DENSELBEN WEG (#ask-gap-open-link)", [
        `  im Markup, nie sichtbar:            ${TOTER_HREF}`,
        `  nach dem Senden, sichtbar:          ${nachher[M.openHref]}`,
        `  Statuszeile: ›${panel.text("#ask-status")}‹`,
      ]);
    });
  },
);

describe.runIf(!zielbildDa)("JOB 3010/3046 · D2 Messung uebersprungen", () => {
  it("meldet den fehlenden Kontrollordner statt eine Pruefung vorzutaeuschen", () => {
    expect(zielbildDa, `Zielbild nicht lesbar: ${ZIELBILD} — Abgleich hier nicht messbar.`).toBe(
      false,
    );
  });
});
