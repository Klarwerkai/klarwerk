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
import { readFileSync } from "node:fs";
import { join, posix, resolve } from "node:path";

const NACHLADBARE_SPRACHEN = ["en", "nl"] as const;
type NachladbareSprache = (typeof NACHLADBARE_SPRACHEN)[number];

/** Der Ordner der Sprachdateien, relativ zu `src/` (wie `WOERTERBUCH_ORDNER` in sammeln.ts). */
const WOERTERBUCH = "woerterbuch";

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
  // Beide Ersetzungen bleiben auf IHRER Zeile — die Zeilenzahl der Datei ändert sich nicht.
  const lader = NACHLADBARE_SPRACHEN.map(ladeEintrag).join(", ");
  eintritt = eintritt.replace(VORLIEGEND_ZEILE, VORLIEGEND_ZEILE.replace("{ en, nl };", "{};"));
  eintritt = eintritt.replace(NACHLADEN_ZEILE, NACHLADEN_ZEILE.replace("= {};", `= { ${lader} };`));
  return { eintritt, pakete: pakete as Record<NachladbareSprache, string> };
}

/** Ein Eintrag für `NACHLADEN`: die Sprache und ihr `import()` auf das eigene Paketmodul. */
function ladeEintrag(sprache: NachladbareSprache): string {
  const ziel = JSON.stringify(paketSpezifizierer(sprache));
  return `${sprache}: () => import(${ziel}).then((m) => m.default)`;
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
      if (importierer !== i18nPfad()) {
        return null;
      }
      const sprache = NACHLADBARE_SPRACHEN.find((s) => paketSpezifizierer(s) === quelle);
      return sprache ? paketId(sprache) : null;
    },
    load(id) {
      const sprache = spracheZuId(id);
      if (sprache === undefined) {
        return null;
      }
      const teilung = letzteTeilung ?? teile(readFileSync(i18nPfad(), "utf8"), sprachdatei);
      return teilung.pakete[sprache];
    },
    transform(code, id) {
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
