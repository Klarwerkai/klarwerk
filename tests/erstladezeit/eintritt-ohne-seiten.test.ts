// ================================================================================================
// JOB 3030 — DIE OBERFLÄCHE KOMMT IN STÜCKEN. GEMESSEN AM AUSGELIEFERTEN BÜNDEL.
// ================================================================================================
//
// WORUM ES GEHT. `routes.tsx` hat bis JOB 3030 alle 24 Seitenmodule STATISCH importiert. Damit lag
// der Code jeder Seite — Admin, UiKit, Wissensnetz, Stufe 2, die Vordertür, die Bibliothek — im
// Eintritts-Stück und musste geladen sein, bevor die erste Seite erscheinen konnte, obwohl ein
// Mensch beim ersten Blick genau eine Seite sieht.
//
// ------------------------------------------------------------------------------------------------
// DER FEHLER, DEN DIESE DATEI IN RUNDE 2 HATTE — und warum er so teuer war (ben, JOB 3030 R2)
// ------------------------------------------------------------------------------------------------
// Vite setzt `process.env.NODE_ENV` beim Bauen NUR, wenn es noch nicht gesetzt ist. Unter vitest
// steht dort `test`. Dieser Test hat deshalb ein TESTMODUS-Bündel gemessen (React-Entwicklungsbau,
// keine Produktionsvereinfachungen) und dessen Zahlen als Bündelgrößen ausgegeben — 3 984 014 B,
// wo die Auslieferung 2 997 405 B hat. Alle Grenzwerte, alle Zahlen in der Rückgabe und der Satz
// „die Registerangabe 2,6 MB ist zu niedrig" standen damit auf der falschen Messung.
// SEITHER GILT HIER: `NODE_ENV=production` wird vor dem Bau AUSDRÜCKLICH gesetzt (und danach
// zurückgestellt), und der Fall „KALIBRIERUNG" belegt am echten `apps/web/dist`, dass dieser Bau
// bytegleich zu dem ist, den `tools/build` ausliefert. Ohne diese Kalibrierung misst der Test
// irgendein Bündel und nicht DAS Bündel.
//
// ------------------------------------------------------------------------------------------------
// DER FEHLER, DEN DIESE DATEI IN RUNDE 4 HATTE — eine Zahl, die von selbst rot wird (ben, R4, PP 2)
// ------------------------------------------------------------------------------------------------
// Runde 4 hielt die Byte-Summe als festen Pin: `SUMME_JS <= 2 997 405`, gemessen am Stand `5409a62`.
// Am 04.09.2026 wurde JOB 3030 auf `5409a62` gebaut und auf `9e1e573` eingebaut; dazwischen kamen
// fremde Frontend-Änderungen (u. a. JOB 3018) in den Baum, und der Fall wurde rot, OHNE dass an der
// Aufteilung etwas falsch war. LEHRE (dieselbe wie JOB 3007): ein Grenzwert, der eine HISTORISCHE
// Messung gegen einen WACHSENDEN Baum stellt, misst das Wachstum des Produkts, nicht die Wirkung
// dieses Auftrags. Deshalb baut diese Datei ZWEIMAL, denselben Quellstand, im selben Lauf.
//
// ------------------------------------------------------------------------------------------------
// DER FEHLER, DEN DIESE DATEI IN RUNDE 7 HATTE — ein falsches „vorher" (ben, R7, Korrekturpflicht 1+2)
// ------------------------------------------------------------------------------------------------
// Der zweite Baulauf hieß bis Runde 7 `inlineDynamicImports: true` und wurde als „exakt der Zustand
// vor JOB 3030" bezeichnet. DAS WAR FALSCH, und ben hat es nachgemessen: `inlineDynamicImports`
// schmilzt JEDES `import()` ein, also auch die FÜNF Stücke, die schon VOR diesem Auftrag getrennt
// ausgeliefert wurden (die zweite React-Insel, `browser`, `pdf`, ein weiteres `index` und
// `_commonjs-dynamic-modules`). Ergebnis: ein künstliches Ein-Stück-Bündel von 2 994 944 B, gegen
// das der Eintritt um „−58,07 %" fiel — während der ECHTE Vorstand `9e1e573` sechs Stücke und einen
// Eintritt von 2 026 850 B hat und der wahre Gewinn 38 % beträgt. Die Zahl war zu gut, weil das
// Vergleichsbündel zu groß war.
//
// SO WIRD DAS „VORHER" SEITHER GEBAUT (`statischeSeiten()` weiter unten): ein Vite-Plugin dreht in
// `routes.tsx` GENAU DAS ZURÜCK, was JOB 3030 dort eingeführt hat — jedes
// `lazy(() => import("./pages/X").then((m) => ({ default: m.Y })))` wird wieder ein statischer
// Import. Alles andere im Produkt bleibt unangetastet, insbesondere jeder schon vorher vorhandene
// dynamische Import. Der Gegenbau trifft den echten Vorstand damit auf 0,06 % genau:
//     ben, echter Produktionsbau von `9e1e573`:   6 Stücke · Eintritt 2 026 850 B · Summe 2 983 570 B
//     dieser Gegenbau am Arbeitsstand `b203c44`:  6 Stücke · Eintritt 2 028 116 B · Summe 2 984 836 B
// Die 1 266 B Unterschied sind der Rest des Gerüsts, das der Gegenbau stehen lässt (die 27
// `lazy(() => Promise.resolve({ default: … }))`-Hüllen) — er baut den heutigen Quellstand, nicht den
// alten Commit, und das ist der Zweck: beide Zahlen wachsen mit dem Produkt mit, ihr VERHÄLTNIS ist
// die Aussage und driftet nicht.
//
// WARUM DIESER TEST BAUT, STATT QUELLTEXT ZU LESEN. Ein Pin auf `lazy(` oder `Suspense` in
// `routes.tsx` misst eine Schreibweise, nicht eine Wirkung: er bliebe grün, wenn dieselbe Datei die
// Seite an anderer Stelle wieder statisch zöge, und er bliebe grün, wenn rollup die Stücke wieder
// zusammenführte. Genau diese Klasse Urteil ist in JOB 3007 viermal durchgefallen (LEHREN.md, R2–R4:
// „am gebauten Bildschirm messen, nicht im Quelltext").
//
// WARUM DER BAU IN `os.tmpdir()` LANDET UND NICHT IN `apps/web/dist`. Vom 30.08. bis 02.09.2026 war
// das Tor drei Tage rot OHNE Produktfehler, weil ein Test ein ausgeliefertes Artefakt neu stempelte
// und damit den Smoke-Abbruch „dist ist AELTER" auslöste (`OFFEN.md:3`). Ein Test, der selbst baut,
// darf `apps/web/dist` deshalb nicht anfassen — lesen darf er es, und genau das tut die
// Kalibrierung. Dass er nichts schreibt, wird nicht zugesagt, sondern gemessen: der letzte Fall
// vergleicht den Fingerabdruck von `apps/web/dist` vor und nach BEIDEN Bauläufen.
//
// DIE SOLLMENGE WIRD ERHOBEN, NICHT ABGESCHRIEBEN. Welche Seiten es gibt, liest Fall (b) zur
// Laufzeit aus `apps/web/src/pages/`. Eine Handliste im Test würde genau die Seite nicht sehen, die
// morgen jemand hinzufügt und statisch einbindet — Lehre JOB 3010 R2: keine Vorfilterung, keine
// abgeschriebene Menge.
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { type Plugin, build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "..", "..");
const WEB = join(WURZEL, "apps", "web");
const SEITEN_ORDNER = join(WEB, "src", "pages");
const DIST = join(WEB, "dist");

const posix = (pfad: string): string => pfad.split(sep).join("/");
const kurz = (pfad: string): string => posix(relative(WURZEL, pfad));

const ROUTES = posix(join(WEB, "src", "routes.tsx"));

// ── Die Sollmenge der Seitenmodule, aus dem Dateisystem erhoben ──────────────────────────────────
const SOLL_SEITEN: string[] = readdirSync(SEITEN_ORDNER)
  .filter((name) => name.endsWith(".tsx") && !name.endsWith(".test.tsx"))
  .map((name) => posix(join(SEITEN_ORDNER, name)))
  .sort();

// ── DER GEGENBAU: nur JOB 3030 zurückgedreht, sonst nichts (ben, R7, Korrekturpflicht 2) ─────────
// Das Muster trifft ausschließlich die Form, die dieser Auftrag in `routes.tsx` eingeführt hat.
// Es trifft KEINEN anderen dynamischen Import im Produkt — weder einen in einer anderen Datei (die
// Bedingung `id === ROUTES` schließt sie aus) noch einen in `routes.tsx`, der nicht auf `./pages/`
// zeigt. Genau das war Bens Auflage: der Gegenbau muss die fünf schon vorher getrennten Stücke
// getrennt lassen, sonst vergleicht er gegen ein Bündel, das es nie gab.
const LAZY_SEITE =
  /lazy\(\s*\(\)\s*=>\s*import\("(\.\/pages\/[^"]+)"\)\s*\.then\(\s*\(m\)\s*=>\s*\(\{\s*default:\s*m\.(\w+)\s*\}\)\s*\)\s*,?\s*\)/g;

// Was der Gegenbau wirklich getan hat — kein Zusagen, sondern eine Zahl, die Fall (v) prüft.
// Ein Plugin, dessen Muster ins Leere greift, würde sonst still denselben Bau ein zweites Mal
// erzeugen und ALLE Vergleiche unten grün machen, ohne irgendetwas zu vergleichen.
const GEGENBAU = { ersetzungen: 0, restImporte: -1, gelaufen: false };

function statischeSeiten(): Plugin {
  return {
    name: "job3030-gegenbau-statische-seiten",
    enforce: "pre",
    transform(code: string, id: string) {
      if (posix(id) !== ROUTES) {
        return null;
      }
      const kopf: string[] = [];
      let n = 0;
      const neu = code.replace(LAZY_SEITE, (_treffer, pfad: string, name: string) => {
        n += 1;
        kopf.push(`import { ${name} as __statisch${n} } from "${pfad}";`);
        // Die `lazy`-Hülle bleibt stehen, damit `routes.tsx` sonst unverändert bleibt (dieselben
        // Bezeichner, dasselbe JSX). Für rollup ist die Seite damit statisch am Eintritt — genau
        // der Zustand vor JOB 3030.
        return `lazy(() => Promise.resolve({ default: __statisch${n} }))`;
      });
      GEGENBAU.ersetzungen = n;
      GEGENBAU.restImporte = (neu.match(/import\("\.\/pages\//g) ?? []).length;
      GEGENBAU.gelaufen = true;
      return { code: `${kopf.join("\n")}\n${neu}`, map: null };
    },
  };
}

// ── Der Fingerabdruck eines Verzeichnisses: jeder Pfad mit seiner Änderungszeit ──────────────────
// Der Verzeichnis-Zeitstempel allein genügt nicht: er ändert sich nur, wenn Einträge dazukommen
// oder verschwinden. Ein neu geschriebener Inhalt bei gleicher Dateiliste bliebe unsichtbar — und
// genau das war der Fehler vom 30.08.
function fingerabdruck(verzeichnis: string): string {
  if (!existsSync(verzeichnis)) {
    return "nicht vorhanden";
  }
  const zeilen: string[] = [];
  const gehe = (ort: string): void => {
    for (const eintrag of readdirSync(ort).sort()) {
      const pfad = join(ort, eintrag);
      const stat = statSync(pfad);
      zeilen.push(`${kurz(pfad)}\t${stat.mtimeMs}`);
      if (stat.isDirectory()) {
        gehe(pfad);
      }
    }
  };
  gehe(verzeichnis);
  return `vorhanden\t${statSync(verzeichnis).mtimeMs}\n${zeilen.join("\n")}`;
}

// ── Was `tools/build` wirklich ausgeliefert hat — gelesen, nicht gebaut ──────────────────────────
interface DistBefund {
  eintrittDatei: string;
  eintrittBytes: number;
  jsDateien: number;
  summeJs: number;
}

function distBefund(): DistBefund | null {
  const index = join(DIST, "index.html");
  const assets = join(DIST, "assets");
  if (!existsSync(index) || !existsSync(assets)) {
    return null;
  }
  // Der Eintritt ist das Modul-Skript, das `index.html` einhängt — dieselbe Quelle, aus der der
  // Browser ihn holt. Kein Namensmuster, kein Raten.
  const treffer = readFileSync(index, "utf8").match(
    /<script[^>]+type="module"[^>]+src="\/assets\/([^"]+\.js)"/,
  );
  // Derselbe Name wie in der Rollup-Ausgabe: dort steht der Pfad RELATIV ZUM Bauziel, also mit
  // `assets/` davor. Ohne diese Angleichung verglichen wir zwei Schreibweisen desselben Namens.
  const eintrittDatei = treffer?.[1] ? `assets/${treffer[1]}` : "";
  const js = readdirSync(assets).filter((n) => n.endsWith(".js"));
  return {
    eintrittDatei,
    eintrittBytes: treffer?.[1] ? statSync(join(assets, treffer[1])).size : 0,
    jsDateien: js.length,
    summeJs: js.reduce((a, n) => a + statSync(join(assets, n)).size, 0),
  };
}

interface RollupStueck {
  type: "chunk" | "asset";
  fileName: string;
  isEntry?: boolean;
  moduleIds?: string[];
  imports?: string[];
  code?: string;
}

interface Stueck {
  fileName: string;
  isEntry: boolean;
  moduleIds: string[];
  // NUR die STATISCHEN Importe dieses Stücks. Genau sie muss der Browser mitladen, bevor der Code
  // des Stücks laufen darf; `dynamicImports` gehören ausdrücklich NICHT dazu — das sind die
  // nachgeladenen Seiten, und ihr Fehlen im Erstzugriff ist der ganze Gewinn dieses Auftrags.
  imports: string[];
  bytes: number;
}

interface Bau {
  name: string;
  stuecke: Stueck[];
  jsStuecke: Stueck[];
  eintritt: Stueck | null;
  summeJs: number;
}

const ZIELE: string[] = [];

async function baue(name: string, plugins: Plugin[]): Promise<Bau> {
  const ziel = mkdtempSync(join(tmpdir(), `klarwerk-erstladezeit-${name}-`));
  ZIELE.push(ziel);
  // `tools/build:48` fährt `(cd apps/web && npx vite build)`, und das `cd` ist nicht Bequemlichkeit:
  // `apps/web/tailwind.config.ts:16` führt seine Inhaltsquellen relativ (`./src/**/*.{ts,tsx}`), und
  // PostCSS löst sie gegen das ARBEITSVERZEICHNIS auf, nicht gegen die Vite-Wurzel. Ohne den Wechsel
  // findet Tailwind keine einzige Klasse und `@apply ring-brand/60` bricht den Bau ab — gemessen,
  // nicht vermutet.
  //
  // UND `NODE_ENV=production`, ausdrücklich (ben, R2): Vite setzt die Variable beim Bauen nur, wenn
  // sie leer ist; unter vitest steht dort `test`, und dann entsteht ein Entwicklungsbau. Beides wird
  // in `finally` zurückgestellt, damit ein Fehlschlag den restlichen Lauf nicht verstellt.
  const vorherigesVerzeichnis = process.cwd();
  const vorherigesEnv = process.env.NODE_ENV;
  let ergebnis: unknown;
  try {
    process.chdir(WEB);
    process.env.NODE_ENV = "production";
    ergebnis = await build({
      root: WEB,
      configFile: join(WEB, "vite.config.ts"),
      mode: "production",
      logLevel: "silent",
      plugins,
      build: { outDir: ziel },
    });
  } finally {
    process.env.NODE_ENV = vorherigesEnv;
    process.chdir(vorherigesVerzeichnis);
  }

  const roh = ergebnis as { output: RollupStueck[] } | { output: RollupStueck[] }[] | undefined;
  const ausgaben: RollupStueck[] = Array.isArray(roh)
    ? roh.flatMap((r) => r.output)
    : (roh?.output ?? []);
  const stuecke: Stueck[] = ausgaben
    .filter((a) => a.type === "chunk")
    .map((a) => ({
      fileName: a.fileName,
      isEntry: a.isEntry === true,
      moduleIds: (a.moduleIds ?? []).map(posix),
      imports: a.imports ?? [],
      bytes: Buffer.byteLength(a.code ?? "", "utf8"),
    }));
  const jsStuecke = stuecke.filter((s) => s.fileName.endsWith(".js"));
  return {
    name,
    stuecke,
    jsStuecke,
    eintritt: stuecke.find((s) => s.isEntry) ?? null,
    summeJs: jsStuecke.reduce((a, s) => a + s.bytes, 0),
  };
}

// ── Die HÜLLE eines Stücks: es selbst plus alles, was es STATISCH nachzieht ─────────────────────
// Das ist die Menge, die im Browser gemeinsam dasein muss. Für den Eintritt ist sie die Antwort auf
// „was lädt, bevor überhaupt etwas erscheint"; für ein Seitenstück die Antwort auf „was kommt beim
// Hinnavigieren dazu". Beides zusammen ist die ERSTLAST der jeweiligen Seite.
function huelle(bau: Bau, start: string[]): Set<string> {
  const nachName = new Map(bau.stuecke.map((s) => [s.fileName, s]));
  const gesehen = new Set<string>();
  const rand = [...start];
  while (rand.length > 0) {
    const datei = rand.pop() as string;
    if (gesehen.has(datei)) {
      continue;
    }
    gesehen.add(datei);
    for (const weiter of nachName.get(datei)?.imports ?? []) {
      rand.push(weiter);
    }
  }
  return gesehen;
}

function bytes(bau: Bau, dateien: Iterable<string>): number {
  const nachName = new Map(bau.stuecke.map((s) => [s.fileName, s]));
  let summe = 0;
  for (const datei of dateien) {
    summe += nachName.get(datei)?.bytes ?? 0;
  }
  return summe;
}

// Die Erstlast JE SEITE, in einem beliebigen Bau erhoben — damit derselbe Maßstab an den
// aufgeteilten UND an den Gegenbau gelegt werden kann. Zwei Rechenwege wären zwei Wahrheiten.
// Liegt die Seite im Eintritt (so im Gegenbau), fällt die Rechnung von selbst auf die
// Eintritts-Hülle zurück — `huelle(bau, [eintritt])` ist dann beides. Kein Sonderfall nötig.
function erstlast(bau: Bau): Map<string, number> {
  const eintrittHuelle = huelle(bau, bau.eintritt ? [bau.eintritt.fileName] : []);
  return new Map(
    SOLL_SEITEN.map((seite) => {
      const traeger = bau.stuecke.find((s) => s.moduleIds.includes(seite));
      if (!traeger) {
        return [seite, -1];
      }
      const gesamt = new Set([...eintrittHuelle, ...huelle(bau, [traeger.fileName])]);
      return [seite, bytes(bau, gesamt)];
    }),
  );
}

let GETEILT: Bau | null = null;
let VORHER: Bau | null = null;
let DIST_VORHER = "";
let DIST_NACHHER = "";
let DIST_BEFUND: DistBefund | null = null;

beforeAll(async () => {
  DIST_VORHER = fingerabdruck(DIST);
  DIST_BEFUND = distBefund();
  GETEILT = await baue("geteilt", []);
  VORHER = await baue("vorher", [statischeSeiten()]);
  DIST_NACHHER = fingerabdruck(DIST);

  const g = GETEILT;
  const v = VORHER;
  const gHuelle = bytes(g, huelle(g, g.eintritt ? [g.eintritt.fileName] : []));
  const vHuelle = bytes(v, huelle(v, v.eintritt ? [v.eintritt.fileName] : []));
  console.log(
    [
      "[JOB 3030] NODE_ENV=production · zwei Bauläufe desselben Quellstands",
      `  VORHER (Seiten statisch): ${v.jsStuecke.length} .js-Stücke · Eintritt ${v.eintritt?.fileName ?? "—"} ${v.eintritt?.bytes ?? 0} B · Eintritts-Hülle ${vHuelle} B · Summe ${v.summeJs} B`,
      `  NACHHER (aufgeteilt):     ${g.jsStuecke.length} .js-Stücke · Eintritt ${g.eintritt?.fileName ?? "—"} ${g.eintritt?.bytes ?? 0} B · Eintritts-Hülle ${gHuelle} B · Summe ${g.summeJs} B`,
      `  Eintritt ${(g.eintritt?.bytes ?? 0) - (v.eintritt?.bytes ?? 0)} B · Summe +${g.summeJs - v.summeJs} B auf ${g.jsStuecke.length - v.jsStuecke.length} zusätzliche Stücke`,
      `  dist: ${DIST_BEFUND ? `${DIST_BEFUND.eintrittDatei} ${DIST_BEFUND.eintrittBytes} B, ${DIST_BEFUND.jsDateien} Dateien, ${DIST_BEFUND.summeJs} B` : "nicht gebaut"}`,
    ].join("\n"),
  );
}, 900_000);

afterAll(() => {
  for (const ziel of ZIELE) {
    rmSync(ziel, { recursive: true, force: true });
  }
});

describe("JOB 3030 · das gebaute Bündel zerfällt in Stücke", () => {
  it("beide Bauläufe sind wirklich gelaufen (ein leeres Ergebnis wäre ein grüner Test)", () => {
    // Ohne diesen Fall könnten alle folgenden allein dadurch grün sein, dass gar nichts gebaut wurde.
    expect(GETEILT, "kein aufgeteilter Bau").not.toBeNull();
    expect(VORHER, "kein Gegenbau").not.toBeNull();
    expect((GETEILT as Bau).jsStuecke.length).toBeGreaterThan(1);
    expect((GETEILT as Bau).eintritt, "kein Eintritts-Stück in der Rollup-Ausgabe").not.toBeNull();
    expect((VORHER as Bau).summeJs).toBeGreaterThan(0);
    expect(
      SOLL_SEITEN.length,
      "keine Seitenmodule gefunden — läuft die Erhebung ins Leere?",
    ).toBeGreaterThan(15);
  });

  // ── KALIBRIERUNG (ben, R2, Korrekturpflicht 1) ────────────────────────────────────────────────
  // Ohne sie misst dieser Test IRGENDEIN Bündel. Mit ihr misst er nachweislich DAS Bündel, das
  // `tools/build` nach `apps/web/dist` schreibt und das der Server ausliefert. Verglichen werden
  // Eintrittsdatei (Name samt Inhaltsstempel), Eintrittsgröße, Zahl der `.js`-Stücke und deren
  // Summe. Der Name enthält den Inhaltshash — stimmt er überein, ist der Eintritt bytegleich.
  it("KALIBRIERUNG: dieser Bau ist derselbe, den `tools/build` ausliefert", () => {
    expect(
      DIST_BEFUND,
      "`apps/web/dist` fehlt — vorher `./tools/build` fahren (im Tor läuft es immer vor den Tests).",
    ).not.toBeNull();
    const d = DIST_BEFUND as DistBefund;
    const g = GETEILT as Bau;
    expect(d.eintrittDatei, "Eintrittsdatei laut dist/index.html").toBe(g.eintritt?.fileName ?? "");
    expect(d.eintrittBytes, "Eintrittsgröße").toBe(g.eintritt?.bytes ?? 0);
    expect(d.jsDateien, "Zahl der .js-Stücke").toBe(g.jsStuecke.length);
    expect(d.summeJs, "Summe aller .js-Bytes").toBe(g.summeJs);
  });

  // ── (v) DER GEGENBAU IST WIRKLICH DER VORZUSTAND (ben, R7, Korrekturpflicht 2) ─────────────────
  // Jede Vorher/Nachher-Aussage unten steht und fällt mit diesem Fall. Er belegt dreierlei:
  //   1. Das Plugin hat gegriffen (Ersetzungen > 20, kein `import("./pages/` blieb übrig). Ein
  //      Muster, das ins Leere greift, würde sonst zweimal denselben Bau erzeugen und alles grün
  //      machen, ohne etwas zu vergleichen.
  //   2. Im Gegenbau liegt JEDE erhobene Seite im EINTRITT — das ist die Definition des Zustands
  //      vor JOB 3030, das Spiegelbild von Fall (a).
  //   3. Der Gegenbau lässt die schon vorher getrennten Stücke getrennt: er hat MEHR als ein Stück.
  //      Genau das war der Fehler von Runde 7 (`inlineDynamicImports` schmolz auch sie ein).
  it("(v) der Gegenbau dreht NUR JOB 3030 zurück und lässt fremde Nachladewege getrennt", () => {
    const v = VORHER as Bau;
    expect(GEGENBAU.gelaufen, "das Gegenbau-Plugin hat `routes.tsx` nie gesehen").toBe(true);
    expect(
      GEGENBAU.ersetzungen,
      'zu wenige `lazy(() => import("./pages/…"))` ersetzt — das Muster passt nicht mehr auf ' +
        "`routes.tsx`, und der Gegenbau wäre kein Vorzustand, sondern eine Kopie des Nachher-Baus.",
    ).toBeGreaterThan(20);
    expect(GEGENBAU.restImporte, "im Gegenbau blieb ein Seiten-`import()` stehen").toBe(0);
    const nichtImEintritt = SOLL_SEITEN.filter(
      (seite) => !(v.eintritt?.moduleIds ?? []).includes(seite),
    ).map(kurz);
    expect(
      nichtImEintritt,
      "Im Gegenbau muss JEDE Seite im Eintritt liegen — das ist der Zustand vor JOB 3030.",
    ).toEqual([]);
    expect(
      v.jsStuecke.length,
      "Der Gegenbau darf NUR die Seiten zurückstellen. Bleibt nur ein Stück übrig, hat er auch die " +
        "schon vorher getrennten Nachladewege eingeschmolzen und vergleicht gegen ein Bündel, das " +
        "es nie gab (ben, R7).",
    ).toBeGreaterThan(1);
    expect(v.jsStuecke.length, "der Gegenbau muss deutlich weniger Stücke haben").toBeLessThan(
      (GETEILT as Bau).jsStuecke.length,
    );
  });

  it("(a) der Eintritt trägt keine einzige Seite", () => {
    const seiten = ((GETEILT as Bau).eintritt?.moduleIds ?? []).filter((id) =>
      id.includes("/apps/web/src/pages/"),
    );
    expect(
      seiten.map((id) => kurz(id)),
      "Diese Seitenmodule liegen im Eintritts-Stück und werden damit vor der ersten sichtbaren " +
        "Seite geladen. Sie gehören über `lazy(() => import(…))` nachgeladen.",
    ).toEqual([]);
  });

  it("(b) jedes erhobene Seitenmodul liegt in genau einem Stück, und das ist nicht der Eintritt", () => {
    const g = GETEILT as Bau;
    const befunde = SOLL_SEITEN.map((seite) => {
      const traeger = g.stuecke.filter((s) => s.moduleIds.includes(seite));
      if (traeger.length !== 1) {
        return `${kurz(seite)} → in ${traeger.length} Stücken (${traeger
          .map((t) => t.fileName)
          .join(", ")})`;
      }
      const eines = traeger[0] as Stueck;
      return eines.isEntry ? `${kurz(seite)} → liegt im Eintritt ${eines.fileName}` : null;
    }).filter((z): z is string => z !== null);
    expect(
      befunde,
      "Die Sollmenge kommt aus `apps/web/src/pages/`, nicht aus einer Liste in diesem Test — eine " +
        "neue Seite, die jemand statisch einbindet, fällt hier automatisch auf.",
    ).toEqual([]);
  });

  // ── (c1) DER KERN VON „ES WÄCHST NICHTS", driftfrei geprüft ────────────────────────────────────
  // Der Auftrag will mit Fall (c) verhindern, dass die Aufteilung Code VERVIELFACHT. Genau das
  // lässt sich ohne jede Byte-Zahl und ohne jede Toleranz prüfen: KEIN Modul darf in mehr als einem
  // Stück liegen. Dieser Fall veraltet nicht und wandert nicht — er ist das eigentliche Versprechen.
  it("(c1) kein einziges Modul liegt doppelt — die Aufteilung vervielfältigt nichts", () => {
    const zaehler = new Map<string, string[]>();
    for (const s of (GETEILT as Bau).stuecke) {
      for (const m of s.moduleIds) {
        zaehler.set(m, [...(zaehler.get(m) ?? []), s.fileName]);
      }
    }
    const doppelt = [...zaehler.entries()]
      .filter(([, stuecke]) => stuecke.length > 1)
      .map(([m, stuecke]) => `${kurz(m)} → ${stuecke.join(", ")}`)
      .sort();
    expect(
      doppelt,
      "Diese Module liegen in mehreren Stücken. Dann trägt die Aufteilung denselben Code mehrfach " +
        "aus, und die Summe wächst um echten Inhalt statt um Rahmen.",
    ).toEqual([]);
  });

  // ── (c2) DER VERPACKUNGSRAHMEN — und was Lieferpunkt 3(c) WÖRTLICH verlangt ────────────────────
  // GEMESSEN AM 04.09.2026 (Arbeitsstand `b203c44`), derselbe Quellstand, zwei Bauläufe:
  //     VORHER  (Seiten statisch):   6 Stücke · 2 984 836 B
  //     NACHHER (aufgeteilt):      103 Stücke · 3 019 654 B
  //     Zuwachs 34 818 B (+1,17 %) auf 97 zusätzliche Stücke = 359 B je Stück.
  //
  // HIER WIRD NICHTS SCHÖNGERECHNET (ben, R7, Korrekturpflicht 3): Lieferpunkt 3(c) verlangt
  // wörtlich „die Summe aller .js-Bytes ist NICHT GRÖSSER als vorher". SIE IST GRÖSSER, um
  // 34 818 B. Der Lieferpunkt ist damit NICHT erfüllt und wird in der Rückgabe als „teilweise"
  // geführt; ob dieser Rahmen als Gegenwert für 772 454 B weniger Erstlast angenommen wird, ist
  // eine Entscheidung des Auftraggebers und nicht die dieser Bahn.
  //
  // WAS DIESER FALL STATTDESSEN PRÜFT — und warum er trotzdem etwas wert ist: der Zuwachs darf
  // ausschließlich VERPACKUNG sein (Import-/Exportzeilen und Nachlade-Helfer je Stück), niemals
  // vervielfältigter INHALT. Fall (c1) daneben ist der harte, toleranzfreie Teil desselben
  // Versprechens: kein Modul liegt doppelt. Die Schranke steht auf 700 B je zusätzlichem Stück,
  // rund dem Doppelten des gemessenen Werts (359 B) — Luft für die Schwankung der Verpackung
  // zwischen zwei rollup-Ständen, zu wenig für mitgewanderten Inhalt.
  const RAHMEN_JE_STUECK = 700;

  it("(c2) der Zuwachs gegenüber dem Vorzustand ist reiner Verpackungsrahmen", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const zuwachs = g.summeJs - v.summeJs;
    const zusaetzlich = g.jsStuecke.length - v.jsStuecke.length;
    expect(
      zusaetzlich,
      "der aufgeteilte Bau muss mehr Stücke haben als der Gegenbau",
    ).toBeGreaterThan(0);
    const jeStueck = zuwachs / zusaetzlich;
    const messung = `${g.summeJs} B aufgeteilt (${g.jsStuecke.length} Stücke) gegen ${v.summeJs} B im Vorzustand (${v.jsStuecke.length}) → ${zuwachs} B auf ${zusaetzlich} zusätzliche Stücke = ${jeStueck.toFixed(1)} B je Stück.`;
    console.log(`[JOB 3030] (c2) ${messung}`);
    expect(
      jeStueck,
      `${messung} Über der Schranke bedeutet: die Aufteilung trägt mehr aus als Verpackung — dann ist Inhalt vervielfältigt worden (siehe c1) oder der Schnitt ist zu fein geworden.`,
    ).toBeLessThan(RAHMEN_JE_STUECK);
  });

  // ── (d) DER EINTRITT IST KLEINER GEWORDEN — gegen den gemessenen Vorzustand ────────────────────
  // Lieferpunkt 3(d) wörtlich: „Die Byte-Größe des Eintritts-Stücks liegt unter einem im Test
  // benannten Grenzwert; der Grenzwert wird aus der gemessenen Vorher-Größe abgeleitet."
  // GEMESSEN AM 04.09.2026 (`b203c44`): Eintritt vorher 2 028 116 B → nachher 1 255 662 B,
  // also 61,9 % der Vorher-Größe (−772 454 B, −38,09 %).
  // DIE SCHRANKE STEHT AUF 75 % und ist bewusst ein ANTEIL, keine Byte-Zahl: eine Byte-Zahl war
  // genau der Pin, der in Runde 4 von selbst rot wurde, weil das Produkt daneben wuchs. Beide
  // Zahlen stammen aus DEMSELBEN Lauf, also driftet der Quotient nicht.
  const EINTRITT_ANTEIL = 0.75;

  it("(d) der Eintritt ist gegenüber dem Vorzustand deutlich kleiner", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const vorher = v.eintritt?.bytes ?? 0;
    const nachher = g.eintritt?.bytes ?? 0;
    const grenze = vorher * EINTRITT_ANTEIL;
    const messung = `Eintritt vorher ${vorher} B → nachher ${nachher} B (${((nachher / vorher) * 100).toFixed(1)} %, Schranke ${EINTRITT_ANTEIL * 100} % = ${Math.round(grenze)} B).`;
    console.log(`[JOB 3030] (d) ${messung}`);
    expect(vorher, "kein Vorher-Eintritt gemessen").toBeGreaterThan(0);
    expect(nachher, messung).toBeLessThan(grenze);
  });

  // ── (d2) DIE ERSTLAST JE SEITE — was der Browser wirklich holt, bevor die Seite steht ──────────
  // Das ist die Zahl, um die es Natascha geht, und sie ist NICHT die Größe des Eintritts allein:
  // der Browser muss die STATISCHE Hülle des Eintritts mitladen (Fremdbibliotheken, Rahmen), und
  // für eine sichtbare Seite dazu noch das Stück dieser Seite samt deren statischer Hülle.
  // Verglichen wird JEDE Seite mit SICH SELBST im Vorzustand — dort ist ihre Erstlast die ganze
  // Eintritts-Hülle, weil sie im Eintritt liegt.
  // GEMESSEN AM 04.09.2026 (`b203c44`), Vorher-Erstlast je Seite 2 028 116 B:
  //     Startseite (`/start`, die erste Fläche nach dem Anmelden):  1 296 152 B ≈ 63,9 %
  //     leichteste Seite (PlaceholderPage):                         1 256 559 B ≈ 61,9 %
  //     schwerste Seite (Capture):                                  1 533 354 B ≈ 75,6 %
  // DIE SCHRANKE STEHT AUF 85 %: sie soll die Zusage halten („jede Seite lädt spürbar weniger als
  // vorher"), nicht den Tagesstand einfrieren. Die schwerste Seite liegt heute bei 89 % der
  // Schranke — Luft für gewöhnliches Wachstum, zu wenig für eine Seite, die zurück in den Eintritt
  // wandert.
  const ERSTLAST_ANTEIL = 0.85;

  it("(d2) für JEDE Seite ist die Erstlast kleiner als im Vorzustand", () => {
    const g = GETEILT as Bau;
    const v = VORHER as Bau;
    const nachher = erstlast(g);
    const vorher = erstlast(v);
    const zeilen = SOLL_SEITEN.map((seite) => {
      const n = nachher.get(seite) ?? -1;
      const alt = vorher.get(seite) ?? -1;
      return { seite: kurz(seite), n, alt, anteil: alt > 0 ? n / alt : -1 };
    }).sort((a, b) => b.anteil - a.anteil);
    const zuLaut = zeilen
      .filter((z) => z.n < 0 || z.alt <= 0 || z.anteil >= ERSTLAST_ANTEIL)
      .map((z) =>
        z.n < 0 || z.alt <= 0
          ? `${z.seite} → in keinem Stück gefunden (vorher ${z.alt} B, nachher ${z.n} B)`
          : `${z.seite} → ${z.n} B von vorher ${z.alt} B = ${(z.anteil * 100).toFixed(1)} %`,
      );
    // Die Erstlast gehört ins Protokoll, nicht nur in die Fehlermeldung: Lieferpunkt 5 verlangt
    // gemessene Zahlen, und eine Zahl, die nur bei Rot erscheint, ist im grünen Lauf keine Messung.
    const zeile = (z: (typeof zeilen)[number]): string =>
      `${z.seite}\t${z.n} B von ${z.alt} B = ${(z.anteil * 100).toFixed(1)} %`;
    const start = zeilen.find((z) => z.seite === "apps/web/src/pages/Start.tsx");
    console.log(
      `[JOB 3030] Erstlast je Seite, nachher gegen vorher (Schranke ${ERSTLAST_ANTEIL * 100} %) — schwerste fünf:\n  ${zeilen
        .slice(0, 5)
        .map(zeile)
        .join(
          "\n  ",
        )}\n  leichteste: ${zeile(zeilen[zeilen.length - 1] as (typeof zeilen)[number])}\n  Startseite (die erste Fläche nach dem Anmelden): ${start ? zeile(start) : "nicht gefunden"}`,
    );
    expect(
      zuLaut,
      `Erstlast = Eintritts-Hülle + Seiten-Hülle, je Seite gegen dieselbe Seite im Vorzustand (Schranke ${ERSTLAST_ANTEIL * 100} %).`,
    ).toEqual([]);
  });

  // ── (d3) KALIBRIERUNG DES RECHENWEGS VON (d2) ─────────────────────────────────────────────────
  // (d2) teilt zwei Zahlen; ist der NENNER falsch, ist der ganze Quotient wertlos. Dieser Fall
  // prüft genau den Nenner: im Gegenbau muss die Erstlast JEDER Seite exakt die Eintritts-Hülle
  // sein — kein Byte weniger. Wäre sie kleiner, hätte `erstlast()` für eine im Eintritt liegende
  // Seite zu wenig gezählt, und (d2) würde einen zu kleinen Vorher-Wert benutzen und damit einen
  // zu GUTEN Anteil ausweisen. Der Fall sagt ausdrücklich NICHT, dass (d2) rot werden kann —
  // das belegt die Handmutation aus Lieferpunkt 7 (ein Seitenimport zurück auf statisch), die in
  // der Rückgabe protokolliert ist.
  it("(d3) KALIBRIERUNG: im Vorzustand ist die Erstlast jeder Seite die volle Eintritts-Hülle", () => {
    const v = VORHER as Bau;
    const eintrittHuelle = bytes(v, huelle(v, v.eintritt ? [v.eintritt.fileName] : []));
    const last = erstlast(v);
    expect(eintrittHuelle, "keine Eintritts-Hülle im Gegenbau").toBeGreaterThan(0);
    const abweichend = SOLL_SEITEN.map((seite) => ({
      seite: kurz(seite),
      wert: last.get(seite) ?? -1,
    }))
      .filter((z) => z.wert !== eintrittHuelle)
      .map((z) => `${z.seite} → ${z.wert} B statt ${eintrittHuelle} B`);
    expect(
      abweichend,
      "Im Vorzustand liegt jede Seite im Eintritt, ihre Erstlast ist also die Eintritts-Hülle. " +
        "Weicht eine ab, zählt `erstlast()` falsch — und der Nenner von (d2) taugt nicht.",
    ).toEqual([]);
    expect(last.size, "die Kalibrierung muss über alle Seiten laufen").toBe(SOLL_SEITEN.length);
  });

  // ── Lieferpunkt 4: dieser Test verschmutzt den ausgelieferten Bau nicht ────────────────────────
  it('der Bau lässt `apps/web/dist` unberührt — sonst bricht der Smoke mit „dist ist AELTER"', () => {
    // `OFFEN.md:3`: genau diese Verschmutzung hat das Tor vom 30.08. bis 02.09.2026 rot gehalten,
    // ohne dass am Produkt etwas falsch war.
    expect(DIST_NACHHER).toBe(DIST_VORHER);
    for (const ziel of ZIELE) {
      expect(ziel.startsWith(tmpdir()), "jeder Bau muss außerhalb des Arbeitsbaums landen").toBe(
        true,
      );
    }
    expect(ZIELE.length, "beide Bauläufe brauchen ein eigenes Ziel").toBe(2);
  });
});
