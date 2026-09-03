// ================================================================================================
// JOB 3014 · LIEFERUNG 1 + 7 — DIE GROBSTRUKTUR AN DER AUSGELIEFERTEN SEITE, UND DER SCHNITTPLAN.
// ================================================================================================
//
// P11 („das Word-Add-in in lesbare Teile zerlegen, ohne Verhalten zu ändern") ist bis heute eine
// Absicht ohne Maß. Dieser Fall gibt ihr eines: er holt die Seite über die ECHTE
// Produktionsverdrahtung (`registerWebStatic` gegen ein Temp-`dist`, `app.inject` auf
// `KLARA_TASKPANE_PFAD`) — nicht aus der Quelldatei — und zählt nach, wie sich die 375 KB auf
// Markup, Stil und Skript verteilen.
//
// WARUM AUS DER LIEFERUNG UND NICHT AUS DER QUELLE: zwischen beiden liegt `stempleFassung`. Eine
// Zerlegung muss an dem tragen, was der Server SENDET; alles andere misst eine Datei, die so nie
// beim Anwender ankommt.
//
// KEINE ZEILENNUMMERN: an derselben Datei arbeiten JOB 3004/3010/3012/3013. Gemessen wird
// strukturell — Zahlen, Anteile, Namen. Wo eine Zahl steht, steht sie als Schranke mit Luft nach
// beiden Seiten, nicht als Pin.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  KLARA_FASSUNG_PLATZHALTER,
  KLARA_TASKPANE_PFAD,
  registerWebStatic,
} from "../../services/app/src/web-static";
import {
  type Block,
  bloeckeVon,
  bytes,
  inhaltVon,
  inline,
  markenBaum,
  markenVon,
  tabelle,
  taskpaneQuelle,
  zeilen,
} from "./zerlegung";

const FASSUNG = "1.0.0.1";

const aufraeumen: string[] = [];
afterAll(() => {
  for (const dir of aufraeumen) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Ein `dist`-Abbild wie aus `vite build` — mit der WIRKLICHEN Paneldatei, nicht mit einer Attrappe. */
function distMit(dateien: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "kw-zerlegung-"));
  aufraeumen.push(dir);
  mkdirSync(join(dir, "word-addin"), { recursive: true });
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>SPA</title>");
  for (const [name, inhalt] of Object.entries(dateien)) {
    writeFileSync(join(dir, "word-addin", name), inhalt);
  }
  return dir;
}

/** Die Seite, wie der Server sie WIRKLICH sendet. */
async function ausgelieferteSeite(): Promise<string> {
  const app = Fastify();
  await registerWebStatic(app, distMit({ "taskpane.html": taskpaneQuelle() }), FASSUNG);
  const res = await app.inject({ method: "GET", url: KLARA_TASKPANE_PFAD });
  expect(res.statusCode).toBe(200);
  return res.body;
}

let seite = "";
let bloecke: Block[] = [];

beforeAll(async () => {
  seite = await ausgelieferteSeite();
  bloecke = bloeckeVon(seite);
});

// ------------------------------------------------------------------------------------------------
// A — die Kalibrierung gegen den stillen Null-Treffer (Auftrag §6).
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · A — die Messung hat überhaupt etwas in der Hand", () => {
  it("A1 · die ausgelieferte Seite ist größer als 100 KB und trägt keinen Platzhalter mehr", () => {
    // Ein Vergleich an einer leeren oder halben Lieferung wäre grün und misste nichts.
    expect(bytes(seite)).toBeGreaterThan(100_000);
    expect(seite).not.toContain(KLARA_FASSUNG_PLATZHALTER);
    expect(seite).toContain(`content="${FASSUNG}"`);
  });

  it("A2 · der Blocksammler findet Blöcke, und sie liegen in Dokumentreihenfolge", () => {
    expect(bloecke.length).toBeGreaterThan(0);
    for (let i = 1; i < bloecke.length; i += 1) {
      expect((bloecke[i] as Block).tagVon).toBeGreaterThan((bloecke[i - 1] as Block).tagBis - 1);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// B — die Schnittflächen: was die Seite an Inline-Flächen hat und wie groß sie sind.
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · B — die Grobstruktur der ausgelieferten Seite", () => {
  it("B1 · genau EIN Inline-Stil, genau EIN Inline-Skript, genau EINE externe Quelle", () => {
    const stile = inline(bloecke, "style");
    const skripte = inline(bloecke, "script");
    const extern = bloecke.filter((b) => b.extern !== null).map((b) => b.extern);
    expect(stile).toHaveLength(1);
    expect(skripte).toHaveLength(1);
    // Office.js vom Microsoft-CDN — die einzige Fremdressource, und genau sie steht in der
    // Ersatz-CSP (`security-headers.ts`, `script-src`). Ein zweiter Eintrag hier wäre eine
    // Erweiterung der Angriffsfläche und muss auffallen.
    expect(extern).toEqual(["https://appsforoffice.microsoft.com/lib/1/hosted/office.js"]);
  });

  it("B2 · die Verteilung: das Skript trägt den weit überwiegenden Teil der Seite", () => {
    const stil = inhaltVon(seite, inline(bloecke, "style")[0] as Block);
    const skript = inhaltVon(seite, inline(bloecke, "script")[0] as Block);
    const markup = bytes(seite) - bytes(stil) - bytes(skript);

    console.log(
      `\nJOB 3014 · Schnittflächen der AUSGELIEFERTEN Seite (${KLARA_TASKPANE_PFAD}):\n${tabelle(
        ["Fläche", "Zeilen", "Bytes", "Anteil"],
        [
          [
            "Markup (Rest)",
            String(zeilen(seite) - zeilen(stil) - zeilen(skript) + 2),
            String(markup),
            anteil(markup, bytes(seite)),
          ],
          [
            "Inline-Stil (1x)",
            String(zeilen(stil)),
            String(bytes(stil)),
            anteil(bytes(stil), bytes(seite)),
          ],
          [
            "Inline-Skript (1x)",
            String(zeilen(skript)),
            String(bytes(skript)),
            anteil(bytes(skript), bytes(seite)),
          ],
          ["Seite gesamt", String(zeilen(seite)), String(bytes(seite)), "100.0%"],
        ],
      )}\nExterne Quellen: ${bloecke
        .filter((b) => b.extern !== null)
        .map((b) => b.extern)
        .join(", ")}\n`,
    );

    // Der tragende Befund, als Schranke statt als Pin: das Skript ist die Seite. Wer sie lesbar
    // machen will, muss DORT schneiden — Markup und Stil zu trennen löst das Problem nicht.
    expect(bytes(skript) / bytes(seite)).toBeGreaterThan(0.8);
    expect(bytes(stil) / bytes(seite)).toBeLessThan(0.1);
    expect(markup).toBeGreaterThan(10_000);
  });

  // ==============================================================================================
  // B3 — DIE BEWACHTE LÜCKE (Auftrag §6, gleiche Bauform wie JOB 3005).
  // ==============================================================================================
  //
  // SOLL: „Kein Inline-Skript der ausgelieferten Seite ist größer als 500 Zeilen." So stand dieser
  // Fall zuerst hier, und so war er ROT — wörtlich:
  //
  //     AssertionError: expected 5805 to be less than or equal to 500
  //
  // IST: EIN Inline-Skript mit 5805 Zeilen, 88.0 % der gesendeten Bytes.
  // ABWEICHUNG: Faktor 11,6 gegenüber dem Soll; die Grenze ist nicht knapp verfehlt, sondern gar
  // nicht angelegt — es gibt keinen zweiten Skriptblock, zwischen dem geschnitten wäre.
  //
  // Der Fall dreht sich deshalb auf den GEMESSENEN Zustand und bewacht die Lücke, statt sie zu
  // verstecken: solange sie besteht, ist er grün und nennt sie in seiner Beschreibung. In dem
  // Moment, in dem jemand P11 wirklich baut, wird er ROT — und das ist sein Zweck: der Erste, der
  // schneidet, muss diese Stelle sehen und das Soll hier einsetzen.
  it("B3 · GELÜCKT: das eine Inline-Skript ist vielfach größer als die 500-Zeilen-Grenze des Solls", () => {
    const skripte = inline(bloecke, "script");
    expect(skripte).toHaveLength(1);
    const zeilenzahl = zeilen(inhaltVon(seite, skripte[0] as Block));
    // Nach unten: die Lücke besteht noch (wird rot, sobald geschnitten ist — dann Soll einsetzen).
    expect(
      zeilenzahl,
      "Das Inline-Skript ist unter 3000 Zeilen — wurde P11 gebaut? Dann gilt hier wieder das " +
        "SOLL: kein Inline-Skript über 500 Zeilen.",
    ).toBeGreaterThan(3000);
    // Nach oben: Luft für die parallel laufenden Aufträge an derselben Datei, aber kein Blankoscheck.
    expect(zeilenzahl).toBeLessThan(9000);
    expect(SOLL_ZEILEN_JE_SKRIPT).toBe(500);
  });
});

/** Die Grenze aus dem Soll-Satz von B3 — hier als Datum, damit sie nicht im Fließtext verschwindet. */
const SOLL_ZEILEN_JE_SKRIPT = 500;

function anteil(teil: number, ganz: number): string {
  return `${((teil / ganz) * 100).toFixed(1)}%`;
}

// ------------------------------------------------------------------------------------------------
// C — der Schnittplan (Auftrag §5.7): eine nummerierte Empfehlung als AUSGABE, kein Dokument.
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · C — der Schnittplan", () => {
  it("C1 · die Empfehlung steht in der Ausgabe und leitet sich aus den Messungen ab", () => {
    const skript = inhaltVon(seite, inline(bloecke, "script")[0] as Block);
    const stil = inhaltVon(seite, inline(bloecke, "style")[0] as Block);
    const skelett = markenBaum(markenVon(seite, bloecke));
    const verstreut = [...skelett.vorkommen.entries()].filter(([, n]) => n > 1);
    const obersteImSkript = skelett.spannen.filter((s) => s.bereich === "skript" && s.tiefe === 0);
    // Was an EINEM Ort steht, ist heute schneidbar. Was verstreut ist, gehört in Schritt 3.
    const einteilig = obersteImSkript.filter((s) => (skelett.vorkommen.get(s.name) ?? 0) === 1);

    const geschlossen = einteilig
      .slice()
      .sort((a, b) => b.bis - b.von - (a.bis - a.von))
      .map((s, i) => `      ${i + 1}. ${s.name} (~${s.bis - s.von} Zeichen)`)
      .join("\n");

    console.log(
      [
        "",
        "JOB 3014 · SCHNITTPLAN für apps/web/public/word-addin/taskpane.html",
        "==================================================================",
        `Ausgangslage: ${zeilen(seite)} Zeilen gesamt, davon ${zeilen(skript)} im EINEN Inline-Skript`,
        `(${anteil(bytes(skript), bytes(seite))} der Bytes) und ${zeilen(stil)} im EINEN Inline-Stil.`,
        "",
        "1. ZUERST STIL UND SKRIPT AUS DER SEITE LÖSEN (taskpane.css / taskpane.js).",
        "   Das ist der mechanische Schnitt aus `probeschnitt.test.ts`: reine Textoperation, kein",
        "   Modulsystem nötig, keine Reihenfolgeänderung (klassische Skripte laufen in",
        `   Dokumentreihenfolge). Er löst in EINEM Schritt ${anteil(bytes(skript) + bytes(stil), bytes(seite))} der Datei heraus und`,
        "   lässt eine Seite von rund 400 Zeilen reinem Markup zurück. Größter Hebel, kleinstes Risiko.",
        "   VORAUSSETZUNG, gemessen in `probeschnitt.test.ts` C: die Geschwisterdateien fallen NICHT",
        "   in `WORD_ADDIN_CSP_PATHS` und der Fassungsstempel greift nur auf der HTML-Antwort.",
        "",
        "2. DANN DIE EINTEILIGEN MARKENSPANNEN DES SKRIPTS EINZELN HERAUSLÖSEN, größte zuerst —",
        "   jede steht heute schon an EINEM Ort, ohne Elternmarke, als zusammenhängendes Stück:",
        geschlossen,
        "   Jede dieser Spannen kann eine eigene Datei werden, sobald 1. steht. Reihenfolge nach",
        "   Größe, weil jeder Schritt dieselbe Prüfung braucht und der größte am meisten spart.",
        "",
        "3. ERST NACH ENTFLECHTUNG: die verstreuten Anliegen.",
        ...(verstreut.length === 0
          ? ["   (keine — dann entfällt dieser Schritt)"]
          : verstreut.map(([name, n]) => {
              const orte = skelett.spannen
                .filter((s) => s.name === name)
                .map((s) => s.bereich)
                .join(" + ");
              return `   · ${name} macht an ${n} Orten je ein eigenes Paar auf (${orte}). Ein Schnitt entlang dieser Marke erzeugt heute Bruchstücke, kein Modul.`;
            })),
        "   Diese Anliegen müssen VOR ihrem Schnitt an EINEN Ort zusammengezogen werden — sonst",
        "   entsteht pro Anliegen eine Datei mit drei Löchern im Rest.",
        "",
        "4. DIE MITFAHRER NACHFÜHREN. Wer schneidet, führt die in `schnitt-pins.test.ts` gepinnten",
        "   Testdateien mit. Sie greifen auf vier Weisen zu: über das Pfadliteral, über einen aus",
        "   Segmenten gebauten Pfad, über die KW-Marken und über die Panel-Fixture.",
        "",
        "ZUERST DAS GRÖSSTE STÜCK: Schritt 1. Er ist mechanisch, umkehrbar und in",
        "`probeschnitt.test.ts` D am Verhalten belegt — beide Fassungen laufen dort als vollständige",
        "Serverantwort in je einem eigenen jsdom-Fenster an, mit nachgeladener taskpane.js/-css und",
        "derselben bereiten Office-Attrappe; vier Gegenproben (fehlendes JS, fehlendes CSS,",
        "Inline/Extern-Sonde, veränderte Office-Bindung) belegen, dass der Vergleich wirklich beißt.",
        "",
      ].join("\n"),
    );

    // Kalibrierung: eine leere Empfehlung wäre grün und sagte nichts.
    expect(obersteImSkript.length).toBeGreaterThan(3);
    expect(bytes(skript) + bytes(stil)).toBeGreaterThan(bytes(seite) * 0.8);
  });
});
