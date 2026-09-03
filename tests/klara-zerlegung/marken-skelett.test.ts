// ================================================================================================
// JOB 3014 · LIEFERUNG 2 — DAS MARKEN-SKELETT ALS VERTRAG.
// ================================================================================================
//
// Die Datei ist bereits mit `KW-…-START`/`-END` ausgezeichnet. Das sieht nach einem fertigen
// Schnittplan aus und ist keiner — genau diese Verwechslung soll dieser Fall unmöglich machen.
// Gemessen wird an der AUSGELIEFERTEN Seite, mit drei Fragen:
//
//   1. Ist das Skelett überhaupt wohlgeformt? (Jede geöffnete Marke geschlossen, Stapel korrekt,
//      kein Überkreuzen.) — Ohne diese Antwort ist jede Schnittaussage darüber wertlos.
//   2. Wie groß ist jedes Stück, worin liegt es (Markup / Stil / Skript), und wer ist seine
//      Elternmarke?
//   3. Welche Marken machen an MEHREREN Orten je ein eigenes Paar auf? Das ist der tragende
//      Befund für P11: ein Schnitt entlang solcher Marken erzeugt keine Module, sondern
//      Bruchstücke — die Fläche liegt im Markup, die Logik tief im Skript, die Ereignisbindung
//      noch einmal woanders.
//
// KEINE ZEILENNUMMERN IN ZUSICHERUNGEN: an derselben Datei arbeiten JOB 3004/3010/3012/3013.
// Zeilennummern erscheinen ausschließlich in der gedruckten Tabelle, als Lesehilfe.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KLARA_TASKPANE_PFAD, registerWebStatic } from "../../services/app/src/web-static";
import {
  type Marke,
  type Skelett,
  bloeckeVon,
  markenBaum,
  markenVon,
  tabelle,
  taskpaneQuelle,
} from "./zerlegung";

const aufraeumen: string[] = [];
afterAll(() => {
  for (const dir of aufraeumen) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function ausgelieferteSeite(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "kw-marken-"));
  aufraeumen.push(dir);
  mkdirSync(join(dir, "word-addin"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
  writeFileSync(join(dir, "word-addin", "taskpane.html"), taskpaneQuelle());
  const app = Fastify();
  await registerWebStatic(app, dir, "1.0.0.1");
  const res = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
  expect(res.statusCode).toBe(200);
  return res.body;
}

let marken: Marke[] = [];
let skelett: Skelett;

beforeAll(async () => {
  const seite = await ausgelieferteSeite();
  marken = markenVon(seite, bloeckeVon(seite));
  skelett = markenBaum(marken);
});

// ------------------------------------------------------------------------------------------------
// A — Kalibrierung: der Sammler hat etwas in der Hand, und er sammelt das Richtige.
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · A — der Markensammler misst wirklich", () => {
  it("A1 · die Markenliste ist nicht leer und enthält Öffner wie Schließer", () => {
    expect(marken.length).toBeGreaterThan(20);
    expect(marken.filter((m) => m.art === "START").length).toBeGreaterThan(10);
    expect(marken.filter((m) => m.art === "END").length).toBeGreaterThan(10);
  });

  it("A2 · eine Marke ist der Zeilenanfang, nicht ihre Erwähnung im Fließtext", () => {
    // Die Datei ERWÄHNT Marken in Prosakommentaren („… Zeilen unter `KW-KA3-KARTEN-START`").
    // Ein Sammler, der das für eine Marke hält, meldet ein Überkreuzen, das es nicht gibt — und
    // würde damit einen erfundenen Blocker in den Schnittplan schreiben. Gegenprobe an
    // konstruierten Zeilen, damit der Fall nicht von der Tagesform der Produktdatei abhängt.
    const echt = markenVon("    // KW-PROBE-START\nx\n    // KW-PROBE-END\n");
    expect(echt.map((m) => `${m.name}-${m.art}`)).toEqual(["KW-PROBE-START", "KW-PROBE-END"]);
    const erwaehnt = markenVon("    // (siehe `KW-PROBE-START`) — nur ein Verweis\n");
    expect(erwaehnt).toEqual([]);
  });

  it("A3 · die Marken liegen in mehreren Bereichen — sie sind keine reine Skriptauszeichnung", () => {
    const bereiche = new Set(marken.map((m) => m.bereich));
    expect(bereiche.has("skript")).toBe(true);
    expect(bereiche.has("markup")).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// B — die Wohlgeformtheit. Ohne sie ist jede Schnittaussage darüber wertlos.
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · B — das Skelett ist wohlgeformt", () => {
  it("B1 · jede geöffnete Marke wird geschlossen, in der richtigen Reihenfolge, ohne Überkreuzen", () => {
    expect(skelett.fehler, skelett.fehler.join("\n")).toEqual([]);
    expect(skelett.spannen.length).toBe(marken.filter((m) => m.art === "START").length);
  });

  it("B2 · die Stapelprüfung erkennt Überkreuzen wirklich (Gegenprobe)", () => {
    // Ohne diesen Fall wäre B1 auch dann grün, wenn die Prüfung gar nichts prüft.
    const kaputt = markenBaum(
      markenVon("// KW-A-START\n// KW-B-START\n// KW-A-END\n// KW-B-END\n"),
    );
    expect(kaputt.fehler.length).toBeGreaterThan(0);
    expect(kaputt.fehler.join(" ")).toContain("überkreuzt");
    const offen = markenBaum(markenVon("// KW-A-START\n"));
    expect(offen.fehler.join(" ")).toContain("nie geschlossen");
  });
});

// ------------------------------------------------------------------------------------------------
// C — die Schnittflächen je Marke, als Tabelle und als Vertrag.
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · C — was jede Marke wirklich einschließt", () => {
  it("C1 · Name, Vorkommen, Größe, Elternmarke, Bereich — gedruckt", () => {
    const zeilenDaten = skelett.spannen
      .slice()
      .sort((a, b) => a.von - b.von)
      .map((s) => {
        const n = skelett.vorkommen.get(s.name) ?? 0;
        return [
          `${"  ".repeat(s.tiefe)}${s.name}`,
          String(s.bis - s.von),
          `${s.zeileVon}–${s.zeileBis}`,
          s.bereich,
          s.eltern ?? "—",
          n > 1 ? `verstreut über ${n} Orte` : "",
        ];
      });
    console.log(
      `\nJOB 3014 · Marken-Skelett der AUSGELIEFERTEN Seite:\n${tabelle(
        [
          "Marke (eingerückt = geschachtelt)",
          "Zeichen",
          "Zeilen",
          "Bereich",
          "Elternmarke",
          "Befund",
        ],
        zeilenDaten,
      )}\n`,
    );
    expect(zeilenDaten.length).toBeGreaterThan(10);
  });

  // ==============================================================================================
  // C2 — DIE ZWEITE BEWACHTE LÜCKE (Auftrag §6, gleiche Bauform wie B3 in `schnittflaechen`).
  // ==============================================================================================
  //
  // SOLL: „Jede `KW-…`-Marke kommt genau einmal vor." So stand dieser Fall zuerst hier, und so war
  // er ROT — wörtlich:
  //
  //     AssertionError: expected [ …(2) ] to deeply equal []
  //     + Array [ Array [ "KW-KA4-DOKUMENT-CONSENT", 4 ], Array [ "KW-KA1-TERMS", 2 ] ]
  //
  // IST: zwei Anliegen machen an mehreren Orten je ein eigenes, für sich wohlgeformtes Paar auf —
  // `KW-KA4-DOKUMENT-CONSENT` an VIER (Fläche im Markup, Logik im Skript, Anzeige, Ereignisse),
  // `KW-KA1-TERMS` an ZWEI (Markup und Logik).
  // ABWEICHUNG: Die Marken sind kein Schnittplan, sondern eine Themenauszeichnung. Wer entlang
  // `KW-KA4-DOKUMENT-CONSENT` schneidet, bekommt vier Bruchstücke und vier Löcher im Rest.
  //
  // Der Fall dreht sich deshalb auf den GEMESSENEN Zustand: er bewacht die Lücke, statt sie zu
  // verstecken. Er wird ROT, wenn ein Anliegen weiter verstreut wird ODER wenn eines endlich
  // zusammengezogen ist — beides gehört gesehen und hier nachgeführt.
  it("C2 · GELÜCKT: zwei Anliegen liegen verstreut, alle anderen Marken genau einmal", () => {
    const mehrfach = [...skelett.vorkommen.entries()]
      .filter(([, n]) => n > 1)
      .sort((a, b) => b[1] - a[1]);
    expect(
      mehrfach,
      "Die Verstreuung hat sich geändert — Kommentar und Schnittplan nachführen.",
    ).toEqual([
      ["KW-KA4-DOKUMENT-CONSENT", 4],
      ["KW-KA1-TERMS", 2],
    ]);
    // Und die Verstreuung geht wirklich über die Bereichsgrenze — genau das macht sie teuer.
    for (const [name] of mehrfach) {
      const bereiche = new Set(
        skelett.spannen.filter((s) => s.name === name).map((s) => s.bereich),
      );
      expect(bereiche.size, `${name} liegt nur in einem Bereich`).toBeGreaterThan(1);
    }
    // Kalibrierung: die Mehrheit der Marken ist einteilig — sonst wäre die Aussage oben banal.
    const einteilig = [...skelett.vorkommen.entries()].filter(([, n]) => n === 1);
    expect(einteilig.length).toBeGreaterThan(mehrfach.length * 3);
  });

  it("C3 · die Marken schachteln — ein Schnitt je Marke ginge nicht flach auf", () => {
    const geschachtelt = skelett.spannen.filter((s) => s.tiefe > 0);
    expect(geschachtelt.length).toBeGreaterThan(0);
    // Und die Schachtelung ist echt: die Kindspanne liegt vollständig in der Elternspanne.
    for (const kind of geschachtelt) {
      const eltern = skelett.spannen.find(
        (s) => s.name === kind.eltern && s.von < kind.von && s.bis > kind.bis,
      );
      expect(
        eltern,
        `${kind.name} nennt ${kind.eltern} als Eltern, liegt aber nicht darin`,
      ).toBeDefined();
    }
  });
});
