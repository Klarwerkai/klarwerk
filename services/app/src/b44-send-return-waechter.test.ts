import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ================================================================================================
// B44 — DER SENDE-/RUECKGABEWEG: WAS DIE AUSSAGE „SEMANTISCH VERWUNDBAR: 0" WIRKLICH TRAEGT
// ================================================================================================
//
// DER WEG, an dem dieser Waechter haengt (gemessen, nicht erinnert):
//
//   1. SENDEN     ein Routenhandler ruft `reply.code(...).send(...)`.
//   2. RUECKGEBEN er endet entweder mit `return reply` (Thenable-Adoption: die Handler-Promise
//                 resolved erst NACH Response-Ende) oder mit blossem `return;` (resolved mit
//                 `undefined`). Das zweite Muster ist B44.
//   3. AUSLIEFERN die onSend-Kette laeuft; erst danach `writeHead`.
//
//   ZUSTAENDE, die ueber ein zweites Senden entscheiden — Fastify 5.8.5,
//   `node_modules/fastify/lib/wrap-thenable.js:31-38`:
//       payload !== undefined  ODER  (reply.sent === false && reply.raw.headersSent === false
//                                     && request.raw.aborted === false && socket nicht zerstoert)
//   Trifft das bei blossem `return;` zu, sendet Fastify ein ZWEITES Mal → ERR_HTTP_HEADERS_SENT
//   als unbehandelte Zurueckweisung → Prozess-Crash (Mechanik woertlich:
//   `routes/addin-static-routes.ts:130-137`).
//
// WARUM DIE B44-STELLEN HEUTE TROTZDEM HARMLOS SIND: nur weil JEDER onSend-Hook synchron ist.
// Ein einziger async-Hook kostet einen Microtask-Hop vor `writeHead`; ab zwei Hops gewinnt der
// Promise-Abschluss das Rennen. Die semantische Null ist also KEINE Eigenschaft der Sendestellen,
// sondern eine Eigenschaft ihres Schutzes.
//
// WAS DIESER WAECHTER DESHALB PRUEFT — und was ausdruecklich NICHT:
// Der Schutz selbst ist bereits bewacht und wird hier NICHT ein zweites Mal geprueft:
// `sync-onsend-hooks.test.ts` nagelt jede `.addHook("onSend", …)` auf den Callback-Stil,
// `tests/app/mega71-onsend-synchron.test.ts` misst dieselbe Zusage am echten Draht.
// Dieser Waechter deckt die vier Kanten, an denen dieser Schutz UNBEMERKT ins Leere laufen kann,
// ohne dass eine der beiden Dateien rot wird — plus die Kante, an der der Schutz selbst entkernt
// wuerde. Er bewertet die syntaktische Menge der Sendestellen NICHT und fuehrt keine Zahl.
const APP_SRC = dirname(fileURLToPath(import.meta.url));
const SERVICES = resolve(APP_SRC, "..", "..");
const SCHUTZ = join(APP_SRC, "sync-onsend-hooks.test.ts");
// Die Route, die die handler-lokale zweite Schicht fuer sich selbst zur Zusage erklaert
// (`routes/confluence-import-routes.ts:291-297`, dort woertlich: „JEDER Sende-Pfad endet mit
// `return reply`"). Eine Zusage ohne Waechter ist ein Kommentar.
const WPE_ROUTE = join(APP_SRC, "routes", "confluence-import-routes.ts");

// Kommentare raus, Zeilennummern ERHALTEN (Technik aus `sync-onsend-hooks.test.ts:33-37`): eine
// blosse Erwaehnung im Fliesstext ist keine Registrierung, Fundstellen bleiben zitierfaehig.
function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

function produktDateien(dir: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(dir, { withFileTypes: true })) {
    if (eintrag.name === "node_modules") {
      continue;
    }
    const pfad = join(dir, eintrag.name);
    if (eintrag.isDirectory()) {
      out.push(...produktDateien(pfad));
    } else if (eintrag.name.endsWith(".ts") && !eintrag.name.endsWith(".test.ts")) {
      out.push(pfad);
    }
  }
  return out;
}

interface Fund {
  fundort: string;
  zitat: string;
}

/** Alle Treffer eines Musters im gesamten Serverbaum, als `<pfad>:<zeile>` samt Zitat. */
function erhebe(muster: RegExp): Fund[] {
  const funde: Fund[] = [];
  for (const datei of produktDateien(SERVICES)) {
    const src = ohneKommentare(readFileSync(datei, "utf8"));
    for (const m of src.matchAll(muster)) {
      const index = m.index ?? 0;
      funde.push({
        fundort: `${relative(SERVICES, datei)}:${src.slice(0, index).split("\n").length}`,
        zitat: (src.slice(index).split("\n", 1)[0] ?? "").trim(),
      });
    }
  }
  return funde;
}

// Die Form, die der Sammler der Schutzdatei sieht: erstes Argument als String-Literal.
const ADDHOOK_LITERAL = /\.addHook\(\s*["']onSend["']\s*,/g;
// Blindstelle 1 — Fastify erlaubt Hooks auch als ROUTENOPTION (`app.get(url, { onSend: … }, h)`).
// Diese Bauart ist im Produkt real in Gebrauch (`routes/capture-routes.ts:164`,
// `routes/slides-routes.ts:272`, `routes/ask-routes.ts:242` — teils `async`), also kein
// konstruierter Fall: ein onSend-Hook in genau dieser Form waere heute unsichtbar.
const ROUTENOPTION = /(?:^|[\s{,(])["']?onSend["']?\s*:/g;
// Blindstelle 2 — ein Hookname, der kein String-Literal ist (`app.addHook(HOOK, …)`), faellt aus
// der Erhebung der Schutzdatei heraus, statt sie rot zu machen.
const ADDHOOK_INDIREKT = /\.addHook\(\s*(?!["'])[A-Za-z_$[]/g;

describe("B44 · der Sende-/Rueckgabeweg: der Schutz der semantischen Null bleibt erreichbar", () => {
  it("B44-1 · kein onSend-Hook als Routenoption — sonst greift der Synchronitaetsvertrag daran vorbei", () => {
    const funde = erhebe(ROUTENOPTION).map((f) => `${f.fundort}  ${f.zitat}`);
    expect(
      funde,
      "onSend als Routenoption sieht der Sammler in sync-onsend-hooks.test.ts nicht — " +
        'er erhebt ausschliesslich `.addHook("onSend", …)`. Ein async-Hook in dieser Form ' +
        "oeffnet das Doppel-Send-Fenster fuer die Routen, an denen er haengt.",
    ).toEqual([]);
  });

  it("B44-2 · kein onSend-Hook unter indirektem Hooknamen — die Erhebung darf nicht umgangen werden", () => {
    const funde = erhebe(ADDHOOK_INDIREKT).map((f) => `${f.fundort}  ${f.zitat}`);
    expect(
      funde,
      "`.addHook(<Variable>, …)` faellt aus der Erhebung der Schutzdatei heraus, statt sie rot " +
        "zu machen. Neue Bauform: erst entscheiden, dann eintragen — nicht still durchwinken.",
    ).toEqual([]);
  });

  it("B44-3 · jede onSend-Registrierung liegt im Geltungsbereich des Vertrags (services/app/src)", () => {
    const funde = erhebe(ADDHOOK_LITERAL);
    // Ein Waechter, der nichts findet, prueft nichts — dieselbe fail-closed-Regel wie in der
    // Schutzdatei (`sync-onsend-hooks.test.ts:96-98`).
    expect(funde.length, "keine onSend-Registrierung erhoben").toBeGreaterThan(0);
    const ausserhalb = funde.filter((f) => !f.fundort.startsWith("app/src/"));
    expect(
      ausserhalb.map((f) => f.fundort),
      "Der Sammler der Schutzdatei durchsucht NUR sein eigenes Verzeichnis (services/app/src). " +
        "Eine Registrierung ausserhalb waere ungeprueft — und ein async-Hook dort wirkt auf " +
        "dieselbe App, sobald der Baustein eingehaengt wird.",
    ).toEqual([]);
  });

  it("B44-4 · die WP-E-Route haelt ihre handler-lokale Zusage: kein Sende-Pfad endet mit blossem `return;`", () => {
    const src = ohneKommentare(readFileSync(WPE_ROUTE, "utf8"));
    const start = src.indexOf("return async (app)");
    expect(start, "Routenblock der WP-E-Route nicht gefunden").toBeGreaterThan(-1);
    const blankeRueckgaben = src
      .slice(start)
      .split("\n")
      .map((zeile, i) => ({ nr: src.slice(0, start).split("\n").length + i, text: zeile.trim() }))
      .filter((z) => z.text === "return;")
      .map((z) => `${relative(SERVICES, WPE_ROUTE)}:${z.nr}`);
    expect(
      blankeRueckgaben,
      "Diese Datei erklaert `return reply` in :291-297 zur handler-lokalen Absicherung gegen " +
        "das Doppel-Send-Fenster. Ein blosses `return;` nimmt sie zurueck und legt den Pfad " +
        "allein auf den systemischen Schutz.",
    ).toEqual([]);
  });

  it("B44-5 · der Synchronitaetsvertrag ist nicht entkernt — er verbietet async und ist fail-closed", () => {
    // BEN zu JOB 644 D3: die blosse EXISTENZ der Schutzdatei genuegt nicht, „eine vorhandene, aber
    // abgeschwaechte oder leere Testdatei liesse den zweiten Fall weiterhin gruen".
    // Beide Kanten sind so gewaehlt, dass ein Rueckbau nicht still bleiben kann: nimmt jemand die
    // async-Regel heraus und laesst die Kalibrierung stehen, wird die SCHUTZDATEI rot; entfernt er
    // auch die Kalibrierung, wird DIESER Fall rot.
    const schutz = readFileSync(SCHUTZ, "utf8");
    expect(
      /expect\(\s*formVon\(\s*"async[^"]*"\s*\)\s*\)\s*\.toBe\(\s*"async"\s*\)/.test(schutz),
      "Die Schutzdatei kalibriert die async-Form nicht mehr als Verstoss.",
    ).toBe(true);
    expect(
      /funde\.length\s*[,)][^;]*toBeGreaterThan\(\s*0\s*\)/.test(schutz),
      "Die Schutzdatei ist nicht mehr fail-closed: eine leere Erhebung bliebe gruen.",
    ).toBe(true);
  });
});
