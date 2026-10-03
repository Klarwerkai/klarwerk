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
// WAS DIESES PLUGIN TUT, und nur im Bau (`apply: "build"`):
//   1. In `i18n.ts` schneidet es die Blöcke `const en: typeof de = {…};` und `const nl: …` heraus
//      und ersetzt sie durch GLEICH VIELE LEERZEILEN — die Zeilen dahinter behalten ihre Nummer, die
//      Quellkarte bleibt zeilentreu.
//   2. Es ersetzt `VORLIEGEND = { en, nl }` durch `{}` und trägt in `NACHLADEN` je Sprache ein
//      `import("./i18n.sprachpaket.<sprache>.js")` ein. Den Rest erledigt i18next über den
//      Nachlader (`lib/sprachNachlader.ts`).
//   3. Unter genau diesen Namen liefert es je Sprache ein eigenes Modul: der herausgeschnittene
//      Block Zeichen für Zeichen als `export default {…}`, dazu die Importe der Namen, die der
//      Block hineinspreadet (heute `lesevarianteTexteEn`/`…Nl` aus `lib/lesevariante.ts`).
//
// WARUM IM BAU UND NICHT IM QUELLTEXT. `i18n.ts` ist die eine Quelle aller Texte; rund vierzig
// Wächter lesen sie als Text (`readFileSync(…/i18n.ts)`), `tests/support/i18nBestand.ts` liest die
// drei Bündel am initialisierten i18next, und die Textmodul-Prüfung (`sammeln.ts`) leitet den
// Grundbestand aus ihr ab. Ein Umzug der Blöcke in eigene Dateien hätte alle diese Leser verschoben,
// ohne dass sich für einen Menschen etwas ändert. So bleibt der Quelltext unverändert lesbar, und
// jeder Vitest-Lauf sieht weiterhin alle drei Sprachen sofort.
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
// Gegenprobe: `tests/erstladezeit/sprachpakete-nachladen.test.ts` (Schnitt am echten `i18n.ts`)
// und der Block DECKEL in `tests/erstladezeit/eintritt-ohne-seiten.test.ts` (am gebauten Bündel).
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const NACHLADBARE_SPRACHEN = ["en", "nl"] as const;
type NachladbareSprache = (typeof NACHLADBARE_SPRACHEN)[number];

/** Die beiden Zeilen in `i18n.ts`, an denen das Plugin ansetzt — wörtlich, nicht als Muster. */
const VORLIEGEND_ZEILE =
  "const VORLIEGEND: Partial<Record<NachladbareSprache, Woerterbuch>> = { en, nl };";
const NACHLADEN_ZEILE =
  "const NACHLADEN: Partial<Record<NachladbareSprache, () => Promise<Woerterbuch>>> = {};";

const paketSpezifizierer = (sprache: NachladbareSprache): string =>
  `./i18n.sprachpaket.${sprache}.js`;

interface Teilung {
  readonly eintritt: string;
  readonly pakete: Readonly<Record<NachladbareSprache, string>>;
}

function genauEinmal(text: string, anker: string): number {
  const erste = text.indexOf(anker);
  if (erste < 0 || text.indexOf(anker, erste + 1) >= 0) {
    const lage = erste < 0 ? "nicht" : "mehr als einmal";
    const name = JSON.stringify(anker.trim());
    throw new Error(
      `sprachpakete-nachladen: der Anker ${name} steht in apps/web/src/i18n.ts ${lage}. Ohne ihn lägen en und nl wieder im Eintritt (R-0801) — Bau abgebrochen.`,
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

function teile(quelle: string): Teilung {
  const herkunft = importHerkunft(quelle);
  let eintritt = quelle;
  const pakete: Partial<Record<NachladbareSprache, string>> = {};
  for (const sprache of NACHLADBARE_SPRACHEN) {
    const kopf = `\nconst ${sprache}: typeof de = {\n`;
    const start = genauEinmal(eintritt, kopf);
    const ende = eintritt.indexOf("\n};\n", start + kopf.length);
    if (ende < 0) {
      throw new Error(
        `sprachpakete-nachladen: der Block „${sprache}" in apps/web/src/i18n.ts endet nicht mit einer Zeile „};" — Bau abgebrochen.`,
      );
    }
    // Der Rumpf ohne `{` und `}`: von der ersten Eintragszeile bis einschließlich des Umbruchs vor `};`.
    const rumpf = eintritt.slice(start + kopf.length, ende + 1);
    const importe = [...rumpf.matchAll(/^\s*\.\.\.([A-Za-z0-9_$]+),\s*$/gm)].map((treffer) => {
      const name = treffer[1] ?? "";
      const spezifizierer = herkunft.get(name);
      if (spezifizierer === undefined || !spezifizierer.startsWith(".")) {
        throw new Error(
          `sprachpakete-nachladen: der Block „${sprache}" spreadet „${name}", aber i18n.ts importiert ihn nicht relativ — Bau abgebrochen.`,
        );
      }
      return `import { ${name} } from ${JSON.stringify(spezifizierer)};\n`;
    });
    pakete[sprache] = `${importe.join("")}export default {\n${rumpf}};\n`;
    // Der Block reicht vom `const` bis einschließlich `};`. An seine Stelle treten genau so viele
    // Zeilenumbrüche, wie er enthielt — jede Zeile dahinter behält ihre Nummer.
    const blockEnde = ende + "\n};".length;
    const umbrueche = eintritt.slice(start + 1, blockEnde).split("\n").length - 1;
    const leer = "\n".repeat(umbrueche);
    eintritt = `${eintritt.slice(0, start + 1)}${leer}${eintritt.slice(blockEnde)}`;
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
      const teilung = letzteTeilung ?? teile(readFileSync(i18nPfad(), "utf8"));
      return teilung.pakete[sprache];
    },
    transform(code, id) {
      if (id !== i18nPfad()) {
        return null;
      }
      letzteTeilung = teile(code);
      // `map: null`: der Schnitt verschiebt keine Zeile (Leerzeilen statt Block), die Quellkarte
      // der Datei bleibt damit zeilentreu.
      return { code: letzteTeilung.eintritt, map: null };
    },
  };
}
