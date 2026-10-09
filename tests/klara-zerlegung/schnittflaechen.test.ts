// ================================================================================================
// JOB 3014 · LIEFERUNG 1 + 7 — DIE GROBSTRUKTUR AN DER AUSGELIEFERTEN SEITE, UND DER SCHNITTPLAN.
// ================================================================================================
//
// P11 („das Word-Add-in in lesbare Teile zerlegen, ohne Verhalten zu ändern") war bis AUFNAHME
// 20260922 (zentrale-module-aufteilen, R-1611) eine Absicht mit Maß, aber ohne Schnitt. Dieser Fall
// holt das Fenster über die ECHTE Produktionsverdrahtung (`registerWebStatic` gegen ein Temp-`dist`,
// `app.inject`) — nicht aus der Quelldatei — und zählt nach, wie es sich auf Markup, Stil und
// Skript verteilt. Seit R-1611 sind das DREI ausgelieferte Dateien.
//
// WARUM AUS DER LIEFERUNG UND NICHT AUS DER QUELLE: zwischen beiden liegt `stempleFassung`. Eine
// Zerlegung muss an dem tragen, was der Server SENDET; alles andere misst eine Datei, die so nie
// beim Anwender ankommt.
//
// KEINE ZEILENNUMMERN: an derselben Datei arbeiten viele Aufträge. Gemessen wird strukturell —
// Zahlen, Anteile, Namen. Wo eine Zahl steht, steht sie als Schranke, nicht als Pin.
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
  CSS_DATEI,
  JS_DATEI,
  MARKE_DATEI,
  RUECKWEG_DATEI,
  WV_DATEI,
  bloeckeVon,
  bytes,
  echterSchnitt,
  inline,
  markenBaum,
  markenVon,
  rueckwegQuelle,
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

/** Ein `dist`-Abbild wie aus `vite build` — mit den WIRKLICHEN Paneldateien, nicht mit Attrappen. */
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

interface Lieferung {
  seite: string;
  stil: string;
  skript: string;
}

/** Was der Server WIRKLICH sendet: die gestempelte Seite und die zwei Geschwisterdateien. */
async function ausgelieferteDateien(): Promise<Lieferung> {
  const schnitt = echterSchnitt();
  const app = Fastify();
  await registerWebStatic(
    app,
    distMit({
      "taskpane.html": schnitt.html,
      [CSS_DATEI]: schnitt.css,
      [JS_DATEI]: schnitt.js,
      [RUECKWEG_DATEI]: rueckwegQuelle(),
    }),
    FASSUNG,
  );
  const hole = async (url: string): Promise<string> => {
    const res = await app.inject({ method: "GET", url });
    expect(res.statusCode, url).toBe(200);
    return res.body;
  };
  return {
    seite: await hole(KLARA_TASKPANE_PFAD),
    stil: await hole(`/word-addin/${CSS_DATEI}?v=${FASSUNG}`),
    skript: await hole(`/word-addin/${JS_DATEI}?v=${FASSUNG}`),
  };
}

let lieferung: Lieferung = { seite: "", stil: "", skript: "" };
let bloecke: Block[] = [];

beforeAll(async () => {
  lieferung = await ausgelieferteDateien();
  bloecke = bloeckeVon(lieferung.seite);
});

// ------------------------------------------------------------------------------------------------
// A — die Kalibrierung gegen den stillen Null-Treffer (Auftrag §6).
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · A — die Messung hat überhaupt etwas in der Hand", () => {
  it("A1 · die Lieferung ist größer als 100 KB, und die Seite trägt keinen Platzhalter mehr", () => {
    // Ein Vergleich an einer leeren oder halben Lieferung wäre grün und misste nichts.
    const gesamt = bytes(lieferung.seite) + bytes(lieferung.stil) + bytes(lieferung.skript);
    expect(gesamt).toBeGreaterThan(100_000);
    expect(lieferung.seite).not.toContain(KLARA_FASSUNG_PLATZHALTER);
    expect(lieferung.seite).toContain(`content="${FASSUNG}"`);
  });

  it("A2 · der Blocksammler findet Blöcke, und sie liegen in Dokumentreihenfolge", () => {
    expect(bloecke.length).toBeGreaterThan(0);
    for (let i = 1; i < bloecke.length; i += 1) {
      expect((bloecke[i] as Block).tagVon).toBeGreaterThan((bloecke[i - 1] as Block).tagBis - 1);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// B — die Schnittflächen: was die Seite an Inline-Flächen hat und wie groß die Dateien sind.
// ------------------------------------------------------------------------------------------------

describe("JOB 3014 · B — die Grobstruktur der ausgelieferten Seite", () => {
  it("B1 · KEIN Inline-Stil, KEIN Inline-Skript; EINE fremde und ZWEI eigene Skriptquellen, EIN Stilblatt", () => {
    expect(inline(bloecke, "style")).toHaveLength(0);
    expect(inline(bloecke, "script")).toHaveLength(0);
    const extern = bloecke.filter((b) => b.extern !== null).map((b) => b.extern);
    // Office.js vom Microsoft-CDN — die einzige FREMDE Ressource, und genau sie steht in der
    // Ersatz-CSP (`security-headers.ts`, `script-src`). Ein zweiter fremder Eintrag hier wäre eine
    // Erweiterung der Angriffsfläche und muss auffallen.
    //
    // JOB 3667 (14.09.2026): dazu kam `rueckweg.js` (Block KW-RUECKWEG). R-1611: dazu kommt
    // `taskpane.js`, das frühere Inline-Skript, an genau seiner Stelle. Beide relativ, gleicher
    // Ursprung, von `script-src 'self'` gedeckt; die Cachekennung ist derselbe Fassungsplatzhalter,
    // den der Server ins Meta stempelt (`stempleFassung`), also die Zahl des Manifests.
    //
    // ZERLEGUNGSAUFTRAG BESTANDSBLICK: eine DRITTE eigene Quelle mit denselben zwei Eigenschaften.
    // Der Block KW-MARKE (das Ende des Skripts) wohnt in `marke.js`, geladen UNMITTELBAR NACH
    // `taskpane.js` — er läuft also an derselben Stelle wie vorher. Anlass ist B3 unten: die
    // Schranke an `taskpane.js` wird nicht angehoben.
    //
    // AUFTRAG firmenwoerterbuch: eine VIERTE eigene Quelle nach derselben Regel — der Block
    // KW-BEGRIFFE wohnt in `begriffe.js` (relativ, gleichherkünftig). Grund ist wieder B3: das
    // Fensterskript wird nicht vergrössert. Sie steht im KOPF hinter office.js und schliesst sich
    // erst bei DOMContentLoaded an (Begründung im Kopf von `begriffe.js`).
    //
    // AUFTRAG „Geschriebene Behauptungen gegen den Wissensbestand prüfen" (R-0336, R-0708): eine
    // FÜNFTE nach der Regel von `marke.js` — der Block KW-WORDVERGLEICH, bis dahin das Ende von
    // `taskpane.js`, wohnt in `wortvergleich.js`, geladen UNMITTELBAR NACH `taskpane.js` und vor
    // `marke.js`. Grund ist wieder B3: der Auftrag baut an diesem Block weiter.
    expect(extern).toEqual([
      "https://appsforoffice.microsoft.com/lib/1/hosted/office.js",
      `begriffe.js?v=${FASSUNG}`,
      `${RUECKWEG_DATEI}?v=${FASSUNG}`,
      `${JS_DATEI}?v=${FASSUNG}`,
      `${WV_DATEI}?v=${FASSUNG}`,
      `${MARKE_DATEI}?v=${FASSUNG}`,
    ]);
    const stilblaetter = [
      ...lieferung.seite.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)"/g),
    ].map((m) => m[1]);
    expect(stilblaetter).toEqual([`${CSS_DATEI}?v=${FASSUNG}`]);
  });

  it("B2 · die Verteilung: das Skript trägt den weit überwiegenden Teil des Fensters", () => {
    const { seite, stil, skript } = lieferung;
    const gesamt = bytes(seite) + bytes(stil) + bytes(skript);
    const zeile = (name: string, text: string): string[] => [
      name,
      String(zeilen(text)),
      String(bytes(text)),
      anteil(bytes(text), gesamt),
    ];

    console.log(
      `\nR-1611 · Schnittflächen der AUSGELIEFERTEN Dateien (${KLARA_TASKPANE_PFAD} + 2):\n${tabelle(
        ["Datei", "Zeilen", "Bytes", "Anteil"],
        [
          zeile("taskpane.html", seite),
          zeile("taskpane.css", stil),
          zeile("taskpane.js", skript),
          ["gesamt", "", String(gesamt), "100.0%"],
        ],
      )}\nExterne Quellen der Seite: ${bloecke
        .filter((b) => b.extern !== null)
        .map((b) => b.extern)
        .join(", ")}\n`,
    );

    // Der tragende Befund, als Schranke statt als Pin: das Skript ist das Fenster. Der Schnitt
    // Markup/Stil/Skript (Schritt 1 des Schnittplans) ist gemacht; wer das Fenster weiter lesbar
    // machen will, muss jetzt IN `taskpane.js` schneiden (Schritt 2).
    expect(bytes(skript) / gesamt).toBeGreaterThan(0.8);
    expect(bytes(stil) / gesamt).toBeLessThan(0.1);
    expect(bytes(seite)).toBeGreaterThan(10_000);
  });

  // ==============================================================================================
  // B3 — DIE BEWACHTE LÜCKE: DAS SOLL IST FÜR DIE SEITE EINGELÖST, FÜR DAS SKRIPT NICHT.
  // ==============================================================================================
  //
  // SOLL (JOB 3014): „Kein Inline-Skript der ausgelieferten Seite ist größer als 500 Zeilen." Bis
  // R-1611 war dieser Fall auf den GEMESSENEN Zustand gedreht (ein Inline-Skript mit zuletzt 12380
  // Zeilen) und sollte ROT werden, sobald jemand schneidet — mit der Pflicht, hier das Soll
  // einzusetzen. Das ist geschehen: die Seite trägt KEIN Inline-Skript mehr.
  //
  // WAS DAMIT NICHT ERLEDIGT IST, und deshalb steht hier weiter eine Schranke: das Skript ist als
  // Ganzes in `taskpane.js` gewandert, nicht in Teile zerlegt. Die Obergrenze von 12500 Zeilen, die
  // bisher am Inline-Skript hing (Anheben verboten seit JOB 3667), hängt deshalb ab hier an
  // `taskpane.js` — der Schnitt darf kein Freibrief zum Weiterwachsen sein. Schritt 2 des
  // Schnittplans (C1) bleibt offen.
  //
  // ZERLEGUNGSAUFTRAG BESTANDSBLICK: DIE SCHRANKE RÜCKT WIEDER NICHT. Der Bestandsblick-Kandidat
  // riss sie mit 12551 Zeilen (Vollcheck pa-1790499744-198b9217); `taskpane.js` stand nach R-1611
  // bei 12595 Zeilen. Geschnitten wurde nach der Regel von JOB 3667: der Abschnitt KW-MARKE (222
  // Zeilen, geschlossen, von keiner Zeile ausserhalb gerufen) ist Zeile für Zeile nach `marke.js`
  // gewandert (B1 oben sieht die Quelle) — der erste Schnitt von Schritt 2. Mit der
  // Bestandsblick-Lesekoordination steht `taskpane.js` danach bei rund 12420 Zeilen.
  it("B3 · SOLL eingelöst: kein Inline-Skript; die Wachstumsschranke hängt jetzt an taskpane.js", () => {
    const zuGross = inline(bloecke, "script").filter(
      (b) => zeilen(lieferung.seite.slice(b.inhaltVon, b.inhaltBis)) > SOLL_ZEILEN_JE_SKRIPT,
    );
    expect(zuGross).toEqual([]);
    const zeilenzahl = zeilen(lieferung.skript);
    // Kalibrierung: das Skript ist wirklich angekommen (sonst wäre die Schranke trivial grün).
    expect(zeilenzahl).toBeGreaterThan(3000);
    expect(zeilenzahl).toBeLessThan(12500);
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
    // Das Marken-Skelett wird am Fenster als EINEM Dokument erhoben (`taskpaneQuelle()`): nur dort
    // ist jede Marke ihrem Bereich (Markup / Stil / Skript) zuzuordnen.
    const ganz = taskpaneQuelle();
    const ganzBloecke = bloeckeVon(ganz);
    const skelett = markenBaum(markenVon(ganz, ganzBloecke));
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
        `Stand: Seite ${zeilen(lieferung.seite)} Zeilen, taskpane.css ${zeilen(lieferung.stil)} Zeilen,`,
        `taskpane.js ${zeilen(lieferung.skript)} Zeilen (${anteil(bytes(lieferung.skript), bytes(ganz))} des Fensters).`,
        "",
        "1. ERLEDIGT (R-1611): STIL UND SKRIPT AUS DER SEITE GELÖST (taskpane.css / taskpane.js).",
        "   Reine Textoperation, Verhalten vorher/nachher in `probeschnitt.test.ts` D belegt, Bytes in",
        "   `schnitt-echt.test.ts` gegen den Basisstand.",
        "",
        "2. OFFEN: DIE EINTEILIGEN MARKENSPANNEN VON taskpane.js EINZELN HERAUSLÖSEN, größte zuerst —",
        "   jede steht heute schon an EINEM Ort, ohne Elternmarke, als zusammenhängendes Stück:",
        geschlossen,
        "   VORSICHT: ein klassisches Skript in MEHRERE Dateien zu teilen, ist keine reine",
        "   Textoperation mehr. Funktionsdeklarationen werden nur innerhalb EINES Skripts",
        "   vorgezogen, und die Strikt-Direktive gilt je Datei. Jeder Teil braucht deshalb",
        "   seinen eigenen Verhaltensabgleich wie `probeschnitt.test.ts` D2.",
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
        "",
        "4. DIE MITFAHRER NACHFÜHREN. Wer schneidet, führt die in `schnitt-pins.test.ts` gepinnten",
        "   Testdateien mit. Seit R-1611 lesen sie das Fenster über `tests/support/panelquelle.ts`.",
        "",
      ].join("\n"),
    );

    // Kalibrierung: eine leere Empfehlung wäre grün und sagte nichts.
    expect(obersteImSkript.length).toBeGreaterThan(3);
    expect(bytes(lieferung.skript) + bytes(lieferung.stil)).toBeGreaterThan(bytes(ganz) * 0.8);
  });
});
