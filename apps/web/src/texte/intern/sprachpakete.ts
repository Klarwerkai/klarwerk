// ================================================================================================
// R-0801 · DIE SPRACHPAKETE en UND nl VERLASSEN IM PRODUKTIONSBAU DEN EINTRITT.
// ================================================================================================
//
// DER BEFUND. Der verbindliche Deckel aus R-0801 (1 360 000 B für den ersten geladenen Brocken,
// `tests/erstladezeit/eintritt-ohne-seiten.test.ts`, Block DECKEL) riss am Kandidaten 06e6c8f mit
// 1 750 692 B. Die Seiten werden seit JOB 3030 schon nachgeladen; am Eintritt hing aber
// `apps/web/src/i18n.ts` mit ALLEN DREI Wörterbüchern, obwohl ein Mensch genau eine Sprache sieht.
// Die Blöcke `en` und `nl` allein umfassen im Quelltext 818 533 B.
//
// I18N-AUFTEILUNG (Aufnahme 20260922, integriert mit R-0801): die drei Wörterbücher stehen seither je
// Sprache in `src/woerterbuch/{de,en,nl}.ts`, und `i18n.ts` importiert sie. Das Plugin schneidet
// deshalb keine Blöcke mehr aus `i18n.ts`, sondern nimmt deren IMPORTE heraus; der Rest ist derselbe.
//
// WAS DIESES PLUGIN TUT, und nur im Bau (`apply: "build"`):
//   1. In `i18n.ts` ersetzt es die Importzeilen `import { en } from "./woerterbuch/en";` und
//      `… nl …` durch je eine LEERZEILE — die Zeilen dahinter behalten ihre Nummer, die Quellkarte
//      bleibt zeilentreu.
//   2. Es ersetzt `VORLIEGEND = { en, nl }` durch `{}` und trägt in `NACHLADEN` je Sprache ein
//      `import("./i18n.sprachpaket.<sprache>.js")` ein. Den Rest erledigt i18next über den
//      Nachlader (`lib/sprachNachlader.ts`).
//   3. Unter genau diesen Namen liefert es je Sprache ein eigenes Modul: der Block der Sprachdatei
//      Zeichen für Zeichen als `export default {…}`, dazu die Importe der Namen, die der Block
//      hineinspreadet (heute `lesevarianteTexteEn`/`…Nl` aus `lib/lesevariante.ts`) — ihre Pfade
//      von `woerterbuch/` auf `src/` umgerechnet, wo das Paketmodul liegt.
//
// WARUM IM BAU UND NICHT IM QUELLTEXT. Im Quelltext liegen alle drei Sprachen sofort vor: jeder
// Vitest-Lauf, `tests/support/i18nBestand.ts` (die drei Bündel am initialisierten i18next) und die
// Textmodul-Prüfung (`sammeln.ts`, folgt den Importen nach `woerterbuch/`) sehen den vollen Bestand.
//
// FAIL-CLOSED. Findet das Plugin einen seiner Anker nicht GENAU EINMAL, bricht es den Bau ab. Ein
// stilles Durchlassen hieße: beide Sprachen lägen wieder im Eintritt, und erst der Deckel im
// nächsten Prüflauf fiele auf.
//
// WARUM DIE FABRIK HIER WOHNT UND NICHT IN `vite.config.ts`: dieselbe Begründung wie bei
// `textmodulVertrag` (`sammeln.ts`, Kopf von `vite.config.ts`) — der Test soll GENAU DIESES Plugin
// fahren, und `vite.config.ts` ist im Root-Typcheck nicht typisierbar. Strukturell typisiert, ohne
// Vite-Import.
//
// Gegenprobe: `tests/erstladezeit/sprachpakete-nachladen.test.ts` (Schnitt am echten `i18n.ts` und
// an den echten Sprachdateien) und der Block DECKEL in `tests/erstladezeit/eintritt-ohne-seiten.test.ts`
// (am gebauten Bündel).
//
// ------------------------------------------------------------------------------------------------
// R-0801 · AUCH DIE TEXTMODULE (Gesamtcheck R-1329, Nacharbeit 49).
// ------------------------------------------------------------------------------------------------
// `i18n.ts` sammelt die ≈155 Textmodule (`texte/*.ts`) per `import.meta.glob` EAGER ein, und jedes
// trägt de, en und nl. Die Wörterbücher verliessen den Eintritt, die en-/nl-Blöcke der Textmodule
// nicht. Seither, ebenfalls nur im Bau:
//   4. In jedem Textmodul ersetzt das Plugin die Blöcke `  en: {` … `  },` und `  nl: {` … `  },`
//      durch einen leeren Block `  en: {},` plus Leerzeilen — die Zeilen dahinter behalten ihre
//      Nummer. Ausgenommen sind Module, die eine andere Datei unter `src/` DIREKT importiert (heute
//      `texte/anmeldefehler` in `auth/maskenfehler.ts`, das Serversätze in allen drei Sprachen
//      erkennt): sie bleiben vollständig.
//   5. Je Sprache liefert es ein Paket `i18n.textmodule.<sprache>.js`: die ausgeschnittenen Blöcke
//      aller übrigen Module, Zeichen für Zeichen, in der Reihenfolge des Glob (Dateiname).
//   6. `NACHLADEN` lädt Wörterbuch- und Textmodulpaket gemeinsam; scheitert eines, scheitert der
//      Wechsel wie bisher und der Nachlader fällt auf Deutsch zurück.
//   7. In `i18n.ts` wird `TEXTMODULE_NACHGELADEN` zu `["en", "nl"]`: die Startprüfung im Browser
//      nimmt einen LEEREN Block dieser Sprachen hin. Den vollen Vertrag prüfen weiter das Tor und das
//      Build-Plugin `textmodul-vertrag` an den unveränderten Quellen.
// Jeder Anker ist fail-closed wie oben. Gegenprobe: `tests/erstladezeit/sprachpakete-nachladen.test.ts`
// (Block T) und der Block DECKEL in `tests/erstladezeit/eintritt-ohne-seiten.test.ts`.
//
// ------------------------------------------------------------------------------------------------
// R-0801 · DIE DEUTSCHEN FACHTEXTE (Gesamtcheck R-1329, Nacharbeit 58).
// ------------------------------------------------------------------------------------------------
// Am Kandidaten ed51bf71 lag die Hülle mit 1 554 070 B über dem Deckel; 575 275 B davon waren die
// deutschen Blöcke der Textmodule. Seither, ebenfalls nur im Bau:
//   8. DIE AUSWAHL (`fachtexteMitSeite`): erhoben wird die STATISCHE Eintritts-Hülle im Quelltext —
//      alle Dateien, die `src/main.tsx` über statische `import`/`export … from` erreicht; ein
//      `import()` (Seiten, nachgeladene Flächen) wird nicht verfolgt. Ein Textmodul gibt seinen
//      deutschen Block ab, wenn KEINE dieser Dateien eine Zeichenkette nennt, die mit seinem Präfix
//      beginnt (`"praefix.`, `'praefix.`, `` `praefix. ``). Ausgenommen bleiben Module mit
//      `legacySchluessel` (Altnamen tragen das Präfix nicht und werden auch dynamisch gebildet) und
//      direkt importierte Module (Punkt 4). Nicht als Nennung gelten die Wörterbücher selbst
//      (`texte/`, `woerterbuch/`, `lib/lesevariante.ts`): sie definieren Texte, sie zeigen keine.
//      Die Erhebung ist bewusst grob nach der sicheren Seite: ein Kommentar oder eine fremde
//      Zeichenkette mit dem Präfix hält ein Modul im Eintritt, nie umgekehrt.
//   9. In jedem ausgewählten Modul wird auch der Block `  de: {` … `  },` durch `  de: {},` plus
//      Leerzeilen ersetzt — dieselbe zeilentreue Ersetzung wie für en und nl.
//  10. Das Paket `i18n.fachtexte.de.js` trägt die ausgeschnittenen deutschen Blöcke, Zeichen für
//      Zeichen, in Glob-Reihenfolge.
//  11. In `lib/fachtexte.ts` wird `FACHTEXTE_DE = {}` zu `{ laden: () => import(…) }`. Seiten und
//      nachgeladene Flächen warten darauf (`mitFachtexten`); die Hülle wartet nicht.
// Die Startprüfung in `i18n.ts` bleibt unverändert: ein ausgewähltes Modul trägt im Bau in allen
// drei Sprachen einen leeren Block — es meldet also keinen Schlüssel, der fehlen könnte. Den vollen
// Vertrag prüfen weiter Tor und `textmodul-vertrag` an den unveränderten Quellen. Gegenprobe:
// `tests/erstladezeit/sprachpakete-nachladen.test.ts` (Block F) und am gebauten Bündel der Block
// DECKEL (kein Modul der Hülle nennt ein ausgewähltes Präfix; das Paket liegt außerhalb der Hülle).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, posix, resolve } from "node:path";

const NACHLADBARE_SPRACHEN = ["en", "nl"] as const;
type NachladbareSprache = (typeof NACHLADBARE_SPRACHEN)[number];

/** Der Ordner der Sprachdateien, relativ zu `src/` (wie `WOERTERBUCH_ORDNER` in sammeln.ts). */
const WOERTERBUCH = "woerterbuch";

/** Der Ordner der Textmodule, relativ zu `src/` (wie das Glob-Muster in `i18n.ts`). */
const TEXTE = "texte";

/** Die Zeile in `i18n.ts`, die der Bau auf die nachgeladenen Sprachen setzt — wörtlich. */
const TEXTMODULE_ZEILE = "const TEXTMODULE_NACHGELADEN: readonly string[] = [];";

const textmodulSpezifizierer = (sprache: NachladbareSprache): string =>
  `./i18n.textmodule.${sprache}.js`;

/** Die Datei mit dem Fachtextlader, relativ zu `src/` (Punkt 11 im Kopf). */
const FACHTEXTE_LADER = "lib/fachtexte.ts";

/** Die Zeile in `lib/fachtexte.ts`, die der Bau mit dem Lader füllt — wörtlich. */
const FACHTEXTE_ZEILE = "const FACHTEXTE_DE: { laden?: () => Promise<Fachtextpaket> } = {};";

/** Der Spezifizierer des Fachtextpakets, wie `lib/fachtexte.ts` ihn nach dem Schnitt nennt. */
const FACHTEXTE_SPEZIFIZIERER = "../i18n.fachtexte.de.js";

/** Das Modul des Fachtextpakets, relativ zu `src/`. */
const FACHTEXTE_PAKET = "i18n.fachtexte.de.js";

/** Die beiden Zeilen in `i18n.ts`, an denen das Plugin ansetzt — wörtlich, nicht als Muster. */
const VORLIEGEND_ZEILE =
  "const VORLIEGEND: Partial<Record<NachladbareSprache, Woerterbuch>> = { en, nl };";
const NACHLADEN_ZEILE =
  "const NACHLADEN: Partial<Record<NachladbareSprache, () => Promise<Woerterbuch>>> = {};";

/** Die Importzeile einer nachladbaren Sprache in `i18n.ts` — wörtlich. */
const importZeile = (sprache: NachladbareSprache): string =>
  `import { ${sprache} } from "./${WOERTERBUCH}/${sprache}";\n`;

const paketSpezifizierer = (sprache: NachladbareSprache): string =>
  `./i18n.sprachpaket.${sprache}.js`;

const sprachdateiRelativ = (sprache: NachladbareSprache): string =>
  `apps/web/src/${WOERTERBUCH}/${sprache}.ts`;

interface Teilung {
  readonly eintritt: string;
  readonly pakete: Readonly<Record<NachladbareSprache, string>>;
}

function genauEinmal(text: string, anker: string, datei = "apps/web/src/i18n.ts"): number {
  const erste = text.indexOf(anker);
  if (erste < 0 || text.indexOf(anker, erste + 1) >= 0) {
    const lage = erste < 0 ? "nicht" : "mehr als einmal";
    const name = JSON.stringify(anker.trim());
    throw new Error(
      `sprachpakete-nachladen: der Anker ${name} steht in ${datei} ${lage}. Ohne ihn lägen en und nl wieder im Eintritt (R-0801) — Bau abgebrochen.`,
    );
  }
  return erste;
}

/** Name → Spezifizierer aller benannten Importe; dieselbe Lesart wie `basisQuellen` in sammeln.ts. */
function importHerkunft(quelle: string): Map<string, string> {
  const herkunft = new Map<string, string>();
  for (const treffer of quelle.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    for (const roh of (treffer[1] ?? "").split(",")) {
      const name = roh.replace(/^\s*type\s+/, "").trim();
      if (name.length > 0) {
        herkunft.set(name, treffer[2] ?? "");
      }
    }
  }
  return herkunft;
}

/** Ein relativer Spezifizierer aus `woerterbuch/`, umgerechnet auf `src/` (Lage des Paketmoduls). */
function vonSrcAus(spezifizierer: string): string {
  return `./${posix.normalize(posix.join(WOERTERBUCH, spezifizierer))}`;
}

/**
 * Das Paketmodul einer Sprache aus dem Text ihrer Sprachdatei: der Block Zeichen für Zeichen als
 * Standardexport, davor die Importe seiner Spreads. Exportiert für die Gegenprobe (fail-closed).
 */
export function sprachpaketAus(sprache: NachladbareSprache, sprachdatei: string): string {
  const datei = sprachdateiRelativ(sprache);
  const kopf = `\nconst ${sprache}: typeof de = {\n`;
  const start = genauEinmal(sprachdatei, kopf, datei);
  const ende = sprachdatei.indexOf("\n};\n", start + kopf.length);
  if (ende < 0) {
    throw new Error(
      `sprachpakete-nachladen: der Block „${sprache}" in ${datei} endet nicht mit einer Zeile „};" — Bau abgebrochen.`,
    );
  }
  const herkunft = importHerkunft(sprachdatei);
  // Der Rumpf ohne `{` und `}`: von der ersten Eintragszeile bis einschließlich des Umbruchs vor `};`.
  const rumpf = sprachdatei.slice(start + kopf.length, ende + 1);
  const importe = [...rumpf.matchAll(/^\s*\.\.\.([A-Za-z0-9_$]+),\s*$/gm)].map((treffer) => {
    const name = treffer[1] ?? "";
    const spezifizierer = herkunft.get(name);
    if (!spezifizierer?.startsWith(".")) {
      throw new Error(
        `sprachpakete-nachladen: der Block „${sprache}" spreadet „${name}", aber ${datei} importiert ihn nicht relativ — Bau abgebrochen.`,
      );
    }
    return `import { ${name} } from ${JSON.stringify(vonSrcAus(spezifizierer))};\n`;
  });
  return `${importe.join("")}export default {\n${rumpf}};\n`;
}

function teile(quelle: string, sprachdatei: (sprache: NachladbareSprache) => string): Teilung {
  let eintritt = quelle;
  const pakete: Partial<Record<NachladbareSprache, string>> = {};
  for (const sprache of NACHLADBARE_SPRACHEN) {
    const zeile = importZeile(sprache);
    const start = genauEinmal(eintritt, zeile);
    // An die Stelle des Imports tritt eine Leerzeile — jede Zeile dahinter behält ihre Nummer.
    eintritt = `${eintritt.slice(0, start)}\n${eintritt.slice(start + zeile.length)}`;
    pakete[sprache] = sprachpaketAus(sprache, sprachdatei(sprache));
  }
  genauEinmal(eintritt, VORLIEGEND_ZEILE);
  genauEinmal(eintritt, NACHLADEN_ZEILE);
  genauEinmal(eintritt, TEXTMODULE_ZEILE);
  // Alle Ersetzungen bleiben auf IHRER Zeile — die Zeilenzahl der Datei ändert sich nicht.
  const lader = NACHLADBARE_SPRACHEN.map(ladeEintrag).join(", ");
  const nachgeladen = NACHLADBARE_SPRACHEN.map((s) => JSON.stringify(s)).join(", ");
  eintritt = eintritt.replace(VORLIEGEND_ZEILE, VORLIEGEND_ZEILE.replace("{ en, nl };", "{};"));
  eintritt = eintritt.replace(NACHLADEN_ZEILE, NACHLADEN_ZEILE.replace("= {};", `= { ${lader} };`));
  eintritt = eintritt.replace(
    TEXTMODULE_ZEILE,
    TEXTMODULE_ZEILE.replace("[];", `[${nachgeladen}];`),
  );
  return { eintritt, pakete: pakete as Record<NachladbareSprache, string> };
}

/**
 * Ein Eintrag für `NACHLADEN`: die Sprache, ihr Wörterbuchpaket und ihr Textmodulpaket — gemeinsam.
 * Die Reihenfolge der Spreads ist die bisherige: Grundbestand, dann Textmodule.
 */
function ladeEintrag(sprache: NachladbareSprache): string {
  const ziel = JSON.stringify(paketSpezifizierer(sprache));
  const texte = JSON.stringify(textmodulSpezifizierer(sprache));
  return `${sprache}: () => Promise.all([import(${ziel}), import(${texte})]).then(([w, t]) => ({ ...w.default, ...t.default }))`;
}

// ── Die Textmodule (Punkte 4 und 5 im Kopf) ─────────────────────────────────────────────────────

interface Block {
  /** Versatz des Zeilenanfangs von `  en: {`. */
  readonly start: number;
  /** Versatz direkt hinter `  },`. */
  readonly ende: number;
  /** Die Eintragszeilen zwischen Kopf und Schluss, jede mit ihrem Zeilenumbruch. */
  readonly rumpf: string;
}

/** Der Block einer Sprache in einem Textmodul — fail-closed, wenn Kopf oder Schluss fehlen. */
export function textmodulBlock(sprache: string, quelle: string, datei: string): Block {
  const kopf = `\n  ${sprache}: {\n`;
  const umbruch = genauEinmal(quelle, kopf, datei);
  const rumpfStart = umbruch + kopf.length;
  // Ab dem Umbruch am Kopfende suchen: ein leerer Block (`  en: {\n  },`) wird so auch gefunden.
  const schluss = quelle.indexOf("\n  },\n", rumpfStart - 1);
  if (schluss < 0) {
    throw new Error(
      `sprachpakete-nachladen: der Block „${sprache}" in ${datei} endet nicht mit einer Zeile „  },"; ohne ihn lägen seine Texte im Eintritt (R-0801) — Bau abgebrochen.`,
    );
  }
  const rumpf = schluss + 1 > rumpfStart ? quelle.slice(rumpfStart, schluss + 1) : "";
  return { start: umbruch + 1, ende: schluss + "\n  },".length, rumpf };
}

/**
 * Ein Textmodul ohne seine Blöcke en und nl — und für ein ausgewähltes Fachmodul (Punkt 9) auch
 * ohne de: an ihrer Stelle ein leerer Block, dann Leerzeilen.
 */
export function textmodulOhneNachgeladene(
  quelle: string,
  datei: string,
  sprachen: readonly string[] = NACHLADBARE_SPRACHEN,
): string {
  let text = quelle;
  for (const sprache of sprachen) {
    const b = textmodulBlock(sprache, text, datei);
    const zeilen = text.slice(b.start, b.ende).split("\n").length;
    text = `${text.slice(0, b.start)}  ${sprache}: {},${"\n".repeat(zeilen - 1)}${text.slice(b.ende)}`;
  }
  return text;
}

/** Das Textmodulpaket einer Sprache: die Blöcke der Module in der gegebenen Reihenfolge. */
export function textmodulPaketAus(
  sprache: string,
  module: readonly { readonly datei: string; readonly quelle: string }[],
): string {
  const bloecke = module.map((m) => `{\n${textmodulBlock(sprache, m.quelle, m.datei).rumpf}}`);
  return `export default Object.assign({},\n${bloecke.join(",\n")}\n);\n`;
}

/**
 * Die Textmodule, die eine Datei unter `src/` (ausser `i18n.ts` und den Textmodulen selbst) DIREKT
 * per Pfad nennt. Sie bleiben vollständig — wer sie liest, liest alle Sprachen.
 */
export function direktGenutzteTextmodule(src: string): Set<string> {
  const gefunden = new Set<string>();
  const muster = /["'](?:\.{1,2}\/)+(?:[\w-]+\/)*texte\/([a-z0-9]+)(?:\.ts)?["']/g;
  const gehe = (ordner: string): void => {
    for (const eintrag of readdirSync(ordner)) {
      const pfad = join(ordner, eintrag);
      if (statSync(pfad).isDirectory()) {
        if (eintrag !== "node_modules" && eintrag !== "dist" && pfad !== join(src, TEXTE)) {
          gehe(pfad);
        }
        continue;
      }
      if (!/\.tsx?$/.test(eintrag) || /\.test\.tsx?$/.test(eintrag)) {
        continue;
      }
      if (pfad === join(src, "i18n.ts")) {
        continue;
      }
      for (const treffer of readFileSync(pfad, "utf8").matchAll(muster)) {
        gefunden.add(treffer[1] ?? "");
      }
    }
  };
  gehe(src);
  return gefunden;
}

// ── Die deutschen Fachtexte (Punkte 8 bis 11 im Kopf) ──────────────────────────────────────────

/**
 * Ein STATISCHER Import oder Weiterexport samt Spezifizierer. `import type`/`export type` fallen
 * heraus (sie verschwinden beim Bündeln), `import(…)` ebenso (kein Leerraum nach `import`).
 */
const STATISCHER_IMPORT =
  /(?:^|[^\w$.])(?:import|export)\s+(?!type\s)(?:[^'"`;]*?\sfrom\s*)?["']([^"']+)["']/gm;

const QUELLDATEI = /\.(?:tsx?|jsx?|mjs)$/;

/** Löst einen relativen Spezifizierer wie Vite auf; Pakete und Nicht-Quellen bleiben aussen vor. */
function aufloesen(von: string, spezifizierer: string): string | undefined {
  if (!spezifizierer.startsWith(".")) {
    return undefined;
  }
  const basis = resolve(dirname(von), spezifizierer.replace(/[?#].*$/, ""));
  const kandidaten = [
    basis,
    `${basis}.ts`,
    `${basis}.tsx`,
    join(basis, "index.ts"),
    join(basis, "index.tsx"),
    basis.replace(/\.jsx?$/, ".ts"),
    basis.replace(/\.jsx?$/, ".tsx"),
  ];
  return kandidaten.find((k) => QUELLDATEI.test(k) && existsSync(k) && statSync(k).isFile());
}

/**
 * Die statische Eintritts-Hülle im Quelltext: jede Datei, die `src/main.tsx` über statische Importe
 * erreicht, mit ihrem Text. Exportiert für die Gegenprobe (Block F).
 */
export function statischeHuelle(src: string): Map<string, string> {
  const huelle = new Map<string, string>();
  const offen = [join(src, "main.tsx")];
  while (offen.length > 0) {
    const datei = offen.pop() as string;
    if (huelle.has(datei)) {
      continue;
    }
    const text = readFileSync(datei, "utf8");
    huelle.set(datei, text);
    for (const treffer of text.matchAll(STATISCHER_IMPORT)) {
      const ziel = aufloesen(datei, treffer[1] ?? "");
      if (ziel !== undefined && !huelle.has(ziel)) {
        offen.push(ziel);
      }
    }
  }
  return huelle;
}

/** Definiert Texte, zeigt keine — zählt deshalb nicht als Nennung (Punkt 8). */
function istWoerterbuch(src: string, datei: string): boolean {
  return (
    dirname(datei) === join(src, TEXTE) ||
    dirname(datei) === join(src, TEXTE, "intern") ||
    dirname(datei) === join(src, WOERTERBUCH) ||
    datei === join(src, "lib", "lesevariante.ts")
  );
}

/** Steht in diesem Text eine Zeichenkette, die mit dem Präfix beginnt? */
export function nenntPraefix(text: string, praefix: string): boolean {
  const muster = praefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["'\`]${muster}`).test(text);
}

/**
 * Die Textmodule, deren deutschen Block der Bau in das Fachtextpaket gibt (Punkt 8), als Dateinamen
 * ohne Endung, sortiert. Exportiert für die Gegenprobe (Block F) und den Block DECKEL.
 */
export function fachtexteMitSeite(src: string): string[] {
  const ganz = direktGenutzteTextmodule(src);
  const genannt = [...statischeHuelle(src)]
    .filter(([datei]) => !istWoerterbuch(src, datei))
    .map(([, text]) => text)
    .join("\n");
  return readdirSync(join(src, TEXTE))
    .filter((n) => n.endsWith(".ts"))
    .map((n) => n.slice(0, -".ts".length))
    .filter((name) => {
      if (ganz.has(name)) {
        return false;
      }
      const quelle = readFileSync(join(src, TEXTE, `${name}.ts`), "utf8");
      const ohneAltnamen = /\blegacySchluessel:\s*\[\s*\]/.test(quelle);
      const praefix = `${name}.`;
      const traegtPraefix = quelle.includes(`praefix: ${JSON.stringify(praefix)}`);
      return ohneAltnamen && traegtPraefix && !nenntPraefix(genannt, praefix);
    })
    .sort();
}

/**
 * `lib/fachtexte.ts` mit eingetragenem Lader (Punkt 11): dieselbe Zeile, jetzt mit `import()` des
 * Fachtextpakets — fail-closed, wenn der Anker nicht genau einmal dasteht.
 */
export function fachtexteLaderAus(quelle: string): string {
  genauEinmal(quelle, FACHTEXTE_ZEILE, `apps/web/src/${FACHTEXTE_LADER}`);
  const lader = `{ laden: () => import(${JSON.stringify(FACHTEXTE_SPEZIFIZIERER)}) }`;
  return quelle.replace(FACHTEXTE_ZEILE, FACHTEXTE_ZEILE.replace("= {};", `= ${lader};`));
}

/** Die Gestalt, die Vite an einem Plugin liest — strukturell, ohne Vite-Import. */
interface SprachpaketPlugin {
  readonly name: string;
  readonly apply: "build";
  readonly enforce: "pre";
  configResolved(config: { readonly root: string }): void;
  resolveId(quelle: string, importierer: string | undefined): string | null;
  load(id: string): string | null;
  transform(code: string, id: string): { code: string; map: null } | null;
}

export function sprachpaketeNachladen(): SprachpaketPlugin {
  let src = resolve("src");
  let letzteTeilung: Teilung | undefined;
  const i18nPfad = (): string => join(src, "i18n.ts");
  const sprachdatei = (sprache: NachladbareSprache): string =>
    readFileSync(join(src, WOERTERBUCH, `${sprache}.ts`), "utf8");
  const paketId = (sprache: NachladbareSprache): string =>
    join(src, paketSpezifizierer(sprache).slice(2));
  const spracheZuId = (id: string): NachladbareSprache | undefined =>
    NACHLADBARE_SPRACHEN.find((sprache) => paketId(sprache) === id);
  const textpaketId = (sprache: NachladbareSprache): string =>
    join(src, textmodulSpezifizierer(sprache).slice(2));
  const textspracheZuId = (id: string): NachladbareSprache | undefined =>
    NACHLADBARE_SPRACHEN.find((sprache) => textpaketId(sprache) === id);
  // Einmal je Bau: welche Textmodule vollständig bleiben (Punkt 4 im Kopf).
  let behalten: Set<string> | undefined;
  const vollstaendig = (): Set<string> => {
    behalten ??= direktGenutzteTextmodule(src);
    return behalten;
  };
  const istTextmodul = (id: string): boolean =>
    dirname(id) === join(src, TEXTE) && id.endsWith(".ts");
  // Einmal je Bau: welche Module ihren deutschen Block abgeben (Punkt 8 im Kopf).
  let fachtexte: Set<string> | undefined;
  const auswahl = (): Set<string> => {
    fachtexte ??= new Set(fachtexteMitSeite(src));
    return fachtexte;
  };
  const laderPfad = (): string => join(src, FACHTEXTE_LADER);
  const fachpaketId = (): string => join(src, FACHTEXTE_PAKET);
  /** Die Textmodule in Glob-Reihenfolge (`./texte/<datei>` sortiert), die `behalte` durchlässt. */
  const modulListe = (behalte: (name: string) => boolean): { datei: string; quelle: string }[] =>
    readdirSync(join(src, TEXTE))
      .filter((n) => n.endsWith(".ts") && behalte(n.slice(0, -".ts".length)))
      .map((n) => `./${TEXTE}/${n}`)
      .sort()
      .map((rel) => ({
        datei: `apps/web/src/${rel.slice(2)}`,
        quelle: readFileSync(join(src, rel.slice(2)), "utf8"),
      }));
  /** Die beschnittenen Textmodule (alle ausser den direkt importierten). */
  const beschnittene = (): { datei: string; quelle: string }[] =>
    modulListe((name) => !vollstaendig().has(name));
  return {
    name: "sprachpakete-nachladen",
    apply: "build",
    // VOR der TypeScript-Umwandlung: die Anker sind Quelltext mit Typangaben.
    enforce: "pre",
    // `config.root` und nicht `process.cwd()` — dieselbe Begründung wie bei `textmodulVertrag`.
    configResolved(config) {
      src = join(config.root, "src");
    },
    resolveId(quelle, importierer) {
      if (importierer === laderPfad() && quelle === FACHTEXTE_SPEZIFIZIERER) {
        return fachpaketId();
      }
      if (importierer !== i18nPfad()) {
        return null;
      }
      const sprache = NACHLADBARE_SPRACHEN.find((s) => paketSpezifizierer(s) === quelle);
      if (sprache) {
        return paketId(sprache);
      }
      const textsprache = NACHLADBARE_SPRACHEN.find((s) => textmodulSpezifizierer(s) === quelle);
      return textsprache ? textpaketId(textsprache) : null;
    },
    load(id) {
      if (id === fachpaketId()) {
        return textmodulPaketAus(
          "de",
          modulListe((name) => auswahl().has(name)),
        );
      }
      const textsprache = textspracheZuId(id);
      if (textsprache !== undefined) {
        return textmodulPaketAus(textsprache, beschnittene());
      }
      const sprache = spracheZuId(id);
      if (sprache === undefined) {
        return null;
      }
      const teilung = letzteTeilung ?? teile(readFileSync(i18nPfad(), "utf8"), sprachdatei);
      return teilung.pakete[sprache];
    },
    transform(code, id) {
      if (istTextmodul(id)) {
        const name = basename(id, ".ts");
        if (vollstaendig().has(name)) {
          return null;
        }
        // Leerer Block plus Leerzeilen statt des Blocks: keine Zeile verrutscht (`map: null`).
        // Ein ausgewähltes Fachmodul gibt auch seinen deutschen Block ab (Punkt 9).
        const datei = `apps/web/src/${TEXTE}/${basename(id)}`;
        const sprachen = auswahl().has(name)
          ? [...NACHLADBARE_SPRACHEN, "de"]
          : NACHLADBARE_SPRACHEN;
        return { code: textmodulOhneNachgeladene(code, datei, sprachen), map: null };
      }
      if (id === laderPfad()) {
        return { code: fachtexteLaderAus(code), map: null };
      }
      if (id !== i18nPfad()) {
        return null;
      }
      letzteTeilung = teile(code, sprachdatei);
      // `map: null`: der Schnitt verschiebt keine Zeile (Leerzeile statt Import), die Quellkarte
      // der Datei bleibt damit zeilentreu.
      return { code: letzteTeilung.eintritt, map: null };
    },
  };
}
