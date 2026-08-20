// ================================================================================================
// JOB 1331 D1 (G10) — DIE PRUEFLISTE MUSS DAS ZEILENRECHT MITFUEHREN.
// ================================================================================================
//
// DER BEFUND, DEN DIESER WAECHTER SCHLIESST. JOB 658 D2 hatte gemeldet, dass
// `routeGuardAudit.ts:227` die Herkunftsroute als `{ protection: "ko.read" }` fuehrt, obwohl seit
// mega74 zusaetzlich `darfSehen` wirkt. JOB 1318 D1 hat den Befund am heutigen Stand nachgemessen
// und ihn als einzigen von acht Pfaden bestaetigt — mit der entscheidenden Einordnung:
//
//   „Es geht darum, ob die Pruefliste die ZUSAETZLICHE Zeilensichtbarkeit sichtbar macht — und das
//    betrifft JEDE Route mit Zeilenrecht, nicht nur diese. Ein Schnitt, der nur :227 aendert,
//    macht die Tabelle inkonsistent."
//
// Das ist KEINE Sicherheitsluecke. Die Regel wirkt und ist am Draht gepinnt
// (job1170-herkunft-zentrum-vertraulich.test.ts). Es geht um die Lesbarkeit der Pruefliste: Wer
// `ROUTE_GUARD_MATRIX` liest, sah bisher nur das ROUTENrecht. Eine Route, die zusaetzlich je ZEILE
// entscheidet, war von einer, die es nicht tut, nicht zu unterscheiden.
//
// ================================================================================================
// WARUM DIESER WAECHTER MISST STATT ZU GLAUBEN.
// ================================================================================================
//
// Die Vorlage aus JOB 1318 schlug ein Feld `zeilenrecht?: string` vor und nannte fuer
// `GET /api/kos/:id` den Wert `sichtbaresKoOder404`. GENAU DAS waere der Rueckfall in einen Fehler,
// den dieses Projekt schon einmal bezahlt hat: `mega74-lesewege-sammler.test.ts:89-93` haelt fest,
// dass `sichtbaresKoOder404` aus der Namensliste ENTFERNT wurde, weil es eine dateilokale Torwache
// ist, „der der Sammler ihren NAMEN glaubte". Seither loest der Sammler lokale Helfer ueber ihren
// RUMPF auf — und sieht dort das echte Praedikat `darfSehen`.
//
// Dieser Waechter uebernimmt dieses Verfahren wortgleich (Syntaxbaum, Helferrumpf) und traegt
// deshalb die GEMESSENEN Praedikatnamen aus `services/app/src/sichtbarkeit.ts`, nicht die Namen der
// Torwachen. Ein Eintrag, den die Messung nicht deckt, ist rot (Fall 3) — eine handgepflegte Liste
// koennte hier sonst dasselbe behaupten wie die Annahme, die sie pruefen soll.
//
// BENANNTE BLINDHEIT (verschwiegen waere sie eine Falle):
//   · Die Erhebung ist SYNTAKTISCH, keine Datenflussanalyse. Sie sagt, dass die Registrierung das
//     Praedikat NENNT (ueber Helferrumpfe hinweg) — nicht, dass jeder Rueckgabepfad hindurchlaeuft.
//     Die Pfaddominanz prueft weiterhin mega74-lesewege-sammler.test.ts, das ANTWORTverhalten die
//     Draht-Tests (mega74-lesepfad-vertraulich, job1170-herkunft-zentrum-vertraulich).
//   · Dieser Waechter urteilt NICHT darueber, ob eine Route ein Zeilenrecht haben SOLLTE. Er haelt
//     nur fest, was sie fuehrt. Ob eine Route ohne Zeilenrecht eines braeuchte, ist die Frage des
//     Sammlers und der Draht-Tests, nicht diese.
//   · Routen ausserhalb `services/app` sind nicht Gegenstand — sie geben keine Wissensobjekte aus.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ROUTE_GUARD_MATRIX } from "./routeGuardAudit";

const ROUTES_DIR = "services/app/src/routes";
const KOMPOSITIONSWURZEL = "services/app/src/build-app.ts";
const METHODEN = new Set(["get", "post", "put", "delete", "patch", "all", "head", "options"]);

// AUSSCHLIESSLICH die Exporte aus services/app/src/sichtbarkeit.ts — zeichengleich mit
// `PRAEDIKAT_NAMEN` in mega74-lesewege-sammler.test.ts:94-95. Dieselbe Quelle, dieselbe Liste:
// zwei Waechter mit zwei Namenslisten waeren zwei Wahrheiten.
const PRAEDIKAT_NAMEN =
  /^(darfSehen|sichtbareFuer|sichtbarkeitsfilterFuer|beurteileAnhang|paarSichtbar|sichtbarePaare|sichtbareEintraege)$/;

interface Zeilenrechtsfund {
  schluessel: string;
  datei: string;
  zeile: number;
  /** Die Praedikate aus sichtbarkeit.ts, die diese Registrierung wirklich nennt. Sortiert. */
  praedikate: string[];
}

function dateien(verzeichnis: string = ROUTES_DIR): string[] {
  const liste: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      liste.push(...dateien(pfad));
    } else if (eintrag.name.endsWith(".ts") && !eintrag.name.endsWith(".test.ts")) {
      liste.push(pfad);
    }
  }
  if (verzeichnis === ROUTES_DIR) {
    liste.push(KOMPOSITIONSWURZEL);
  }
  return liste;
}

// Herausgezogen, damit er KALIBRIERBAR ist: nur so laesst sich „gruen" von „prueft nichts"
// unterscheiden (die Lehre aus mega76 Block C, dort :614-621).
function erhebeZeilenrechte(datei: string, text: string): Zeilenrechtsfund[] {
  const funde: Zeilenrechtsfund[] = [];
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, true);

  // Lokale Helfer ueber ihren RUMPF, nicht ueber ihren Namen — mega76 Block C, Grenze 4.
  const lokaleHelfer = new Map<string, ts.Node>();
  const sammleHelfer = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) && n.name && n.body) {
      lokaleHelfer.set(n.name.text, n.body);
    }
    if (
      ts.isVariableDeclaration(n) &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      lokaleHelfer.set(n.name.text, n.initializer.body);
    }
    ts.forEachChild(n, sammleHelfer);
  };
  sammleHelfer(sf);

  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
      const methode = n.expression.name.text;
      const arg0 = n.arguments[0];
      if (METHODEN.has(methode) && arg0 && ts.isStringLiteral(arg0) && arg0.text.startsWith("/")) {
        const gefunden = new Set<string>();
        const besucht = new Set<string>();
        const scan = (x: ts.Node): void => {
          if (ts.isIdentifier(x)) {
            if (PRAEDIKAT_NAMEN.test(x.text)) {
              gefunden.add(x.text);
            }
            const rumpf = lokaleHelfer.get(x.text);
            if (rumpf && !besucht.has(x.text)) {
              besucht.add(x.text);
              scan(rumpf);
            }
          }
          ts.forEachChild(x, scan);
        };
        scan(n);
        funde.push({
          schluessel: `${methode.toUpperCase()} ${arg0.text}`,
          datei,
          zeile: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1,
          praedikate: [...gefunden].sort(),
        });
      }
    }
    ts.forEachChild(n, besuche);
  };
  besuche(sf);
  return funde;
}

const ERHEBUNG: Zeilenrechtsfund[] = dateien().flatMap((datei) =>
  erhebeZeilenrechte(datei, readFileSync(datei, "utf8")),
);

/** Nur die Registrierungen, die wirklich ein Praedikat fahren. */
const MIT_ZEILENRECHT = ERHEBUNG.filter((f) => f.praedikate.length > 0);

// Die gemessene Untergrenze (20.08.2026). Sie darf STEIGEN, aber nie unbemerkt fallen: eine
// geschrumpfte Erhebung ist von einer gruenen sonst nicht zu unterscheiden — genau der Fehler,
// den mega74 Block E in seinem Kopf beschreibt.
const MINDESTZAHL_ZEILENRECHTE = 27;

describe("JOB 1331 · die Pruefliste fuehrt das Zeilenrecht mit", () => {
  it("die Erhebung ist nicht geschrumpft — Untergrenze der Routen mit Zeilenrecht", () => {
    expect(
      MIT_ZEILENRECHT.length,
      "Weniger Routen mit Zeilenrecht als am 20.08.2026 gemessen. Eine geschrumpfte Erhebung ist " +
        "ein Fehler, kein Erfolg: die Pruefungen unten waeren dann gruen, weil sie nichts mehr sehen.",
    ).toBeGreaterThanOrEqual(MINDESTZAHL_ZEILENRECHTE);
  });

  // ============================================================================================
  // DER FALL, DER DEN BEFUND AUS JOB 658 / JOB 1318 SCHLIESST.
  // ============================================================================================
  it("jede Route mit einem Zeilenpraedikat traegt ein zeilenrecht in der Matrix", () => {
    const ohne = MIT_ZEILENRECHT.filter(
      (f) => (ROUTE_GUARD_MATRIX[f.schluessel]?.zeilenrecht ?? []).length === 0,
    ).map(
      (f) =>
        `${f.schluessel} faehrt ${f.praedikate.join(" + ")} (${f.datei}:${f.zeile}), traegt in routeGuardAudit aber kein zeilenrecht`,
    );
    expect(
      ohne,
      `Diese Routen entscheiden ZUSAETZLICH je Zeile, aber die Pruefliste zeigt nur ihr Routenrecht — sie sind dort von einer Route ohne Zeilenrecht nicht zu unterscheiden:\n${ohne.join("\n")}`,
    ).toEqual([]);
  });

  it("kein verwaistes zeilenrecht — ein Eintrag ohne gemessenes Praedikat ist rot", () => {
    const gemessen = new Map(MIT_ZEILENRECHT.map((f) => [f.schluessel, f.praedikate]));
    const verwaist = Object.entries(ROUTE_GUARD_MATRIX)
      .filter(([, e]) => (e.zeilenrecht ?? []).length > 0)
      .filter(([schluessel]) => !gemessen.has(schluessel))
      .map(([schluessel]) => schluessel);
    expect(
      verwaist,
      `Diese Eintraege behaupten ein Zeilenrecht, das die Erhebung nicht findet:\n${verwaist.join("\n")}`,
    ).toEqual([]);
  });

  // ============================================================================================
  // DIE PRUEFUNG, DIE DEN NAMENSGLAUBEN AUSSCHLIESST (mega76 Block C, Grenze 4).
  // ============================================================================================
  it("jeder eingetragene Name ist ein GEMESSENES Praedikat dieser Route, kein geglaubter", () => {
    const gemessen = new Map(MIT_ZEILENRECHT.map((f) => [f.schluessel, f.praedikate]));
    const erfunden: string[] = [];
    for (const [schluessel, eintrag] of Object.entries(ROUTE_GUARD_MATRIX)) {
      const behauptet = eintrag.zeilenrecht ?? [];
      const wirklich = gemessen.get(schluessel) ?? [];
      for (const name of behauptet) {
        if (!wirklich.includes(name)) {
          erfunden.push(
            `${schluessel}: eingetragen '${name}', gemessen '${wirklich.join(", ") || "(keins)"}'`,
          );
        }
      }
    }
    expect(
      erfunden,
      `Ein Eintrag nennt ein Praedikat, das die Registrierung nicht ruft. Genau so ist 'sichtbaresKoOder404' bis mega76 als Schutz durchgegangen — ein geglaubter Name:\n${erfunden.join("\n")}`,
    ).toEqual([]);
  });

  // ============================================================================================
  // KALIBRIERUNGEN — ohne sie waere jedes Gruen oben wertlos.
  // ============================================================================================
  it("KALIBRIERUNG — die Erhebung findet ein Praedikat und uebersieht es nicht", () => {
    const mit = erhebeZeilenrechte(
      "kalibrierung-mit.ts",
      'app.get("/api/x", async (request, reply) => { if (!darfSehen(user, ko)) { return; } });',
    );
    expect(mit).toHaveLength(1);
    expect(mit[0]?.praedikate, "das direkt gerufene Praedikat MUSS auffallen").toEqual([
      "darfSehen",
    ]);

    const ohne = erhebeZeilenrechte(
      "kalibrierung-ohne.ts",
      'app.get("/api/y", async (request, reply) => { reply.code(200).send(alles); });',
    );
    expect(ohne).toHaveLength(1);
    expect(ohne[0]?.praedikate, "eine Route ohne Praedikat darf KEINES melden").toEqual([]);
  });

  it("KALIBRIERUNG — eine lokale Torwache zaehlt ueber ihren RUMPF, nicht ueber ihren Namen", () => {
    // Das ist die Kalibrierung zu der Abweichung von der Vorlage aus JOB 1318: dort war fuer
    // `GET /api/kos/:id` der Wert `sichtbaresKoOder404` vorgeschlagen. Der Name einer dateilokalen
    // Torwache ist aber kein Beleg — mega76 hat ihn genau deshalb aus der Namensliste geworfen.
    const mitRumpf = erhebeZeilenrechte(
      "torwache-mit.ts",
      "function sichtbaresKoOder404(user, ko) { return darfSehen(user, ko); }\n" +
        'app.get("/api/kos/:id", async (request, reply) => {\n' +
        "  if (!sichtbaresKoOder404(user, ko)) { return; }\n});",
    );
    expect(
      mitRumpf[0]?.praedikate,
      "der Rumpf ruft darfSehen — DAS ist das Zeilenrecht, nicht der Name der Torwache",
    ).toEqual(["darfSehen"]);

    // GEGENPROBE: eine gleichnamige Torwache, die NICHTS prueft, darf kein Zeilenrecht ergeben.
    const ohneRumpf = erhebeZeilenrechte(
      "torwache-ohne.ts",
      "function sichtbaresKoOder404(user, ko) { return true; }\n" +
        'app.get("/api/kos/:id", async (request, reply) => {\n' +
        "  if (!sichtbaresKoOder404(user, ko)) { return; }\n});",
    );
    expect(
      ohneRumpf[0]?.praedikate,
      "eine Torwache gleichen Namens ohne Pruefung MUSS ohne Zeilenrecht bleiben",
    ).toEqual([]);
  });

  it("KALIBRIERUNG — die Herkunftsroute aus JOB 658 ist wirklich erfasst", () => {
    // Der urspruengliche Befund, an seiner Stelle nachgeschlagen statt behauptet.
    const fund = MIT_ZEILENRECHT.find((f) => f.schluessel === "GET /api/kos/:id/provenance");
    expect(fund, "die Route, um die es in JOB 658 ging, muss in der Erhebung stehen").toBeDefined();
    expect(fund?.praedikate).toEqual(["darfSehen"]);
    expect(ROUTE_GUARD_MATRIX["GET /api/kos/:id/provenance"]?.zeilenrecht).toEqual(["darfSehen"]);
  });
});
