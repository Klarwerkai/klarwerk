// ================================================================================================
// AUFTRAG-mega65 BLOCK A — KEIN EINMALKENNWORT IN DER AUSGABE DES CLI-LAUFS.
// AUFTRAG-mega66 BLOCK A — UND DER SAMMLER SIEHT JETZT AUCH DIE BYTES.
// ================================================================================================
//
// bens ROT-1 (sammel62): `runSeed` gab die frisch erzeugten Einmalkennwörter mit `console.warn`
// aus. `console.warn` schreibt nach `stderr` — also über genau den Kanal, den derselbe
// Kommentarblock zwei Zeilen höher richtig als „jeder CI-Mitschnitt, jede Terminalhistorie, jedes
// Container-Log" beschreibt. Die Unterscheidung „Protokoll gegen Ausgabe" gibt es technisch nicht.
//
// WAS DIESER SAMMLER IN mega65 NICHT SEHEN KONNTE, und ben hat die Stelle genau benannt: Er
// ersetzte `amTerminalUebergeben` durch eine BOOLESCHE Attrappe. Damit war die Byte-Vollständigkeit
// des Kanals grundsätzlich unsichtbar — der Sammler hätte einen Teil-Write nie bemerkt, egal wie
// oft er läuft. Ein Sammler, dessen Grenze ungenannt bleibt, ist die dritte Auflage derselben
// Familie; deshalb ist die Grenze hier nicht bloß benannt, sondern weg: ersetzt ist jetzt das
// GERÄT (`node:fs`, und dort ausschließlich der Pfad `/dev/tty`), nicht der Helfer. `seed.ts` und
// `kennwort-uebergabe.ts` laufen ECHT, mit ihrer echten Schleife über den Byte-Offset.
//
// DIESE DATEI PRÜFT DREI VERSCHIEDENE FRAGEN, und die dritte ist die haltbarste:
//
//   A1/A2  DAS VERHALTEN: Nach einem vollständigen CLI-Lauf steht in KEINEM Konsolenkanal ein
//          erzeugtes Kennwort — weder wenn die Übergabe am Terminal gelingt (A1) noch wenn es kein
//          Terminal gibt (A2). A2 ist der Fall, der im CI und im Container eintritt.
//   A4/A5  DIE BYTES (mega66): Nimmt das Terminal nur wenige Bytes je Aufruf an, kommt die Liste
//          trotzdem GENAU EINMAL und vollständig an (A4). Nimmt es irgendwann nichts mehr an,
//          meldet der Lauf ehrlich Misserfolg statt Erfolg (A5) — bens ROT-1 aus sammel63.
//   A3     DER SAMMLER: Kein `console.*`-Aufruf in `seed.ts` berührt die Kennwortwerte, und jeder
//          Kennwortwert geht durch `amTerminalUebergeben`. Das ist der billige Wächter dagegen,
//          dass es in einem halben Jahr jemand wieder hineinschreibt — mit Kalibrierung gegen die
//          WÖRTLICHE mega64-Zeile, damit er nicht bloß beruhigt.
//
// WAS ER WEITERHIN NICHT SIEHT, und das ist die ehrliche Restgrenze: Das Gerät hinter `/dev/tty`
// ist eine Attrappe. Ob ein ECHTES Terminal existiert, wie es sich bei `EAGAIN` verhält und was
// dessen Scrollback aufbewahrt, kann kein Test im Repo entscheiden; die belastbare Zusage bleibt
// „kein Anwendungs-Logkanal", nicht „in keinem denkbaren Protokoll". Ersetzt ist nur das Gerät —
// jede Entscheidung darüber, WELCHER Pfad geöffnet und WIE VIELE Bytes nachgeschoben werden, fällt
// im Produktcode.
//
// KEINE MELDUNG DIESER DATEI ENTHÄLT EIN KENNWORT. Ein Testbeleg, der den Wert in die
// Fehlermeldung schreibt, wäre derselbe Fehler in einem anderen Kanal; die Meldungen nennen
// deshalb nur Anzahlen und Kanäle.
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_EMAIL_DOMAIN } from "../../services/app/src/seed-demo";

/**
 * Ein Deskriptor, den es in diesem Prozess nicht gibt — die Attrappe erkennt daran ihre eigenen
 * Schreibaufrufe und lässt alle anderen unverändert an das echte `node:fs` durch.
 */
const TTY_GRIFF = 424_242;

const terminal = vi.hoisted(() => ({
  /** Jeder einzelne angenommene Abschnitt, in Aufrufreihenfolge. */
  abschnitte: [] as Buffer[],
  geoeffnet: 0,
  geschlossen: 0,
  /** Kein kontrollierendes Terminal: der Fall im CI, im Container, in der Pipeline. */
  oeffnenScheitert: false,
  /** Höchstens so viele Bytes je Aufruf annehmen — ein Gerät darf das. */
  hoechstensJeAufruf: null as number | null,
  /** Ab dieser Gesamtzahl angenommener Bytes `0` liefern: der Kanal nimmt nichts mehr an. */
  nullAbBytes: null as number | null,
  aufrufe: 0,
}));

// ERSETZT IST DAS GERÄT, NICHT DIE ENTSCHEIDUNG: `seed.ts` ruft unverändert seine Übergabe auf,
// `kennwort-uebergabe.ts` läuft echt — mit Puffer, Byte-Offset und Schleife. Alles, was nicht
// `/dev/tty` ist, geht an das echte Modul; der Seed schreibt sonst nebenbei noch Dateien, und die
// sollen weiter funktionieren.
vi.mock("node:fs", async (echt) => {
  const modul = await echt<typeof import("node:fs")>();
  return {
    ...modul,
    openSync: (pfad: string, flags?: string, mode?: number): number => {
      if (pfad !== "/dev/tty") {
        // Durchlassen mit den Vorgaben von `node:fs` selbst, wenn der Aufrufer sie weggelassen hat.
        return modul.openSync(pfad, flags ?? "r", mode);
      }
      terminal.geoeffnet += 1;
      if (terminal.oeffnenScheitert) {
        const fehler = new Error("ENXIO: no such device or address, open '/dev/tty'");
        (fehler as NodeJS.ErrnoException).code = "ENXIO";
        throw fehler;
      }
      return TTY_GRIFF;
    },
    writeSync: (
      griff: number,
      daten: NodeJS.ArrayBufferView | string,
      offset?: number,
      laenge?: number,
    ): number => {
      if (griff !== TTY_GRIFF) {
        return typeof daten === "string"
          ? modul.writeSync(griff, daten, offset)
          : modul.writeSync(griff, daten, offset, laenge);
      }
      terminal.aufrufe += 1;
      const bisher = Buffer.concat(terminal.abschnitte).length;
      if (terminal.nullAbBytes !== null && bisher >= terminal.nullAbBytes) {
        return 0;
      }
      const puffer =
        typeof daten === "string"
          ? Buffer.from(daten, "utf8")
          : Buffer.from(daten.buffer, daten.byteOffset, daten.byteLength);
      const von = offset ?? 0;
      const angeboten = puffer.subarray(von, von + (laenge ?? puffer.length - von));
      let annahme = angeboten.length;
      if (terminal.hoechstensJeAufruf !== null) {
        annahme = Math.min(annahme, terminal.hoechstensJeAufruf);
      }
      if (terminal.nullAbBytes !== null) {
        annahme = Math.min(annahme, terminal.nullAbBytes - bisher);
      }
      terminal.abschnitte.push(Buffer.from(angeboten.subarray(0, annahme)));
      return annahme;
    },
    closeSync: (griff: number): void => {
      if (griff === TTY_GRIFF) {
        terminal.geschlossen += 1;
        return;
      }
      modul.closeSync(griff);
    },
  };
});

const { readFileSync } = await import("node:fs");

/** Alles, was am Terminal angekommen ist — die Wahrheit, gegen die geprüft wird. */
const amTerminal = (): string => Buffer.concat(terminal.abschnitte).toString("utf8");

/** Und dieselbe Wahrheit in Bytes. Sie ist NICHT `amTerminal().length`, s. A5. */
const bytesAmTerminal = (): number => Buffer.concat(terminal.abschnitte).length;

/**
 * Ein Kennwort in der Ausgabe erkennt man an der Demo-E-Mail mit etwas dahinter. Zwei Fassungen
 * bewusst: ein `/g`-Muster führt bei `.test()` einen `lastIndex` mit und übersieht dann jede zweite
 * Zeile — genau die Sorte still halbierter Prüfung, gegen die diese Datei steht.
 */
const KENNWORT_QUELLE = `@${DEMO_EMAIL_DOMAIN.replace(/\./g, "\\.")}\\s+(\\S+)`;
const TRAEGT_KENNWORT = new RegExp(KENNWORT_QUELLE);
const ALLE_KENNWOERTER = new RegExp(KENNWORT_QUELLE, "g");

interface Lauf {
  konsole: string[];
  amTerminal: string;
}

/**
 * Ein vollständiger CLI-Lauf mit stillgelegten Ausgabekanälen. Erfasst werden ALLE vier
 * `console`-Wege UND die rohen `process.stdout`/`process.stderr` — ein künftiges direktes
 * `process.stderr.write` soll diesem Sammler nicht entgehen.
 */
async function cliLauf(): Promise<Lauf> {
  const konsole: string[] = [];
  const fangen = (...teile: unknown[]): void => {
    konsole.push(teile.map((t) => String(t)).join(" "));
  };
  vi.spyOn(console, "warn").mockImplementation(fangen);
  vi.spyOn(console, "error").mockImplementation(fangen);
  vi.spyOn(console, "log").mockImplementation(fangen);
  vi.spyOn(console, "info").mockImplementation(fangen);
  const rohStdout = vi.spyOn(process.stdout, "write").mockImplementation((stueck): boolean => {
    konsole.push(String(stueck));
    return true;
  });
  const rohStderr = vi.spyOn(process.stderr, "write").mockImplementation((stueck): boolean => {
    konsole.push(String(stueck));
    return true;
  });
  try {
    const { runSeed } = await import("../../services/app/src/seed");
    await runSeed();
  } finally {
    // Die rohen Kanäle sofort zurückgeben: der Testberichter schreibt selbst dorthin.
    rohStdout.mockRestore();
    rohStderr.mockRestore();
  }
  // KALIBRIERUNG DES SAMMLERS SELBST: Ein blinder Fänger wäre bei jeder Zusicherung unten grün.
  console.warn("KALIBRIERMARKE");
  expect(
    konsole.some((z) => z.includes("KALIBRIERMARKE")),
    "der Fänger ist blind",
  ).toBe(true);
  return { konsole, amTerminal: amTerminal() };
}

/** Die Kennwörter, die am Terminal angekommen sind. */
function kennwoerter(text: string): string[] {
  return [...text.matchAll(ALLE_KENNWOERTER)].map((t) => t[1] ?? "");
}

let vorherigerCode: typeof process.exitCode;

beforeEach(() => {
  terminal.abschnitte = [];
  terminal.geoeffnet = 0;
  terminal.geschlossen = 0;
  terminal.oeffnenScheitert = false;
  terminal.hoechstensJeAufruf = null;
  terminal.nullAbBytes = null;
  terminal.aufrufe = 0;
  vorherigerCode = process.exitCode;
  // In-Memory-Lauf: der Seed braucht eine frische, leere Instanz.
  process.env.DATABASE_URL = "";
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
  process.exitCode = vorherigerCode ?? undefined;
});

describe("mega65 A · der CLI-Seed gibt kein Kennwort über einen Protokollkanal aus", () => {
  it("A1 · gelingt die Übergabe am Terminal, steht in keinem Konsolenkanal ein Kennwort", async () => {
    const lauf = await cliLauf();

    // DIE ZUSAGE, und sie steht bewusst zuerst: keine Ausgabezeile trägt eine Demo-E-Mail mit
    // etwas dahinter. Gegen den Stand vor mega65 ist genau diese Zeile rot (3 von 6 Zeilen).
    const verdaechtig = lauf.konsole.filter((zeile) => TRAEGT_KENNWORT.test(zeile));
    expect(
      verdaechtig.length,
      `${verdaechtig.length} von ${lauf.konsole.length} Ausgabezeilen tragen ein Kennwort`,
    ).toBe(0);

    // Und wertgenau: KEINES der tatsächlich erzeugten Kennwörter kommt im gesamten Ausgabetext vor.
    // Das ist die stärkere Prüfung — sie hängt nicht an der Form der Zeile.
    const alleZeilen = lauf.konsole.join("\n");
    const durchgesickert = kennwoerter(lauf.amTerminal).filter((k) => alleZeilen.includes(k));
    expect(durchgesickert.length, `${durchgesickert.length} Kennwörter im Ausgabetext`).toBe(0);

    // KALIBRIERUNG: Ohne diese Zeile wäre oben auch dann grün, wenn gar keine Konten entstanden
    // wären — drei Demo-Konten, drei Kennwörter, und sie sind wirklich am Terminal angekommen.
    expect(kennwoerter(lauf.amTerminal).length, "am Terminal kam kein Kennwort an").toBe(3);
    // Der Kanal ist genau einmal geöffnet und wieder geschlossen worden — kein Rückfall, kein Leck.
    expect([terminal.geoeffnet, terminal.geschlossen]).toEqual([1, 1]);
    // Die Kennzahlen dürfen weiter ins Protokoll; ohne sie wäre der Lauf stumm.
    expect(lauf.konsole.some((z) => z.includes("[seed:demo] Fertig:"))).toBe(true);
    expect(process.exitCode, "eine gelungene Übergabe ist ein erledigter Lauf").not.toBe(1);
  });

  it("A2 · gibt es kein Terminal, wird NICHTS ausgegeben und der Lauf sagt es ehrlich", async () => {
    // Der Fall im CI, im Container, in der Pipeline — und der einzige, in dem der frühere Code
    // seine Zusage brach, ohne dass jemand davorsaß.
    terminal.oeffnenScheitert = true;

    const lauf = await cliLauf();
    const alleZeilen = lauf.konsole.join("\n");

    expect(lauf.amTerminal, "ohne Terminal darf NICHTS geschrieben worden sein").toBe("");
    expect(
      lauf.konsole.filter((zeile) => TRAEGT_KENNWORT.test(zeile)).length,
      "eine Ausgabezeile trägt eine Demo-E-Mail mit etwas dahinter",
    ).toBe(0);

    // EHRLICH heißt: Der Lauf behauptet nicht, die Übergabe sei erfolgt, und er nennt den Ausweg.
    expect(alleZeilen, "der fehlende Kanal wird nicht benannt").toContain("/dev/tty");
    expect(alleZeilen, "der Adminweg fehlt").toContain("/api/auth/users/:id/reset");
    // Und der Rückgabewert sagt es auch der Maschine: die Übergabe ist Teil des Auftrags.
    expect(process.exitCode, "ein nicht übergebenes Kennwort ist kein erledigter Lauf").toBe(1);
  });
});

// ================================================================================================
// AUFTRAG-mega66 — DER SAMMLER SIEHT DIE BYTES, WEIL DER ECHTE HELFER LÄUFT.
// ================================================================================================
describe("mega66 A · der Sammler sieht die Byte-Vollständigkeit des Kanals", () => {
  it("A4 · nimmt das Terminal nur wenige Bytes je Aufruf, kommt die Liste genau einmal vollständig an", async () => {
    // Sieben Bytes je Aufruf: das erzwingt viele Runden und liegt garantiert nicht auf einer
    // Zeichengrenze. Die Zeilen tragen „Einmalkennwörter" — ein Umlaut also mitten im Text.
    terminal.hoechstensJeAufruf = 7;

    const lauf = await cliLauf();
    const alleZeilen = lauf.konsole.join("\n");
    const gefunden = kennwoerter(lauf.amTerminal);

    // Es MUSS mehrfach geschrieben worden sein, sonst prüft dieser Fall nichts.
    expect(terminal.aufrufe, "es gab keinen Teil-Write").toBeGreaterThan(3);
    // VOLLSTÄNDIG: alle drei Zugänge sind da — nicht ein Präfix der Liste.
    expect(gefunden.length, `${gefunden.length} von 3 Zugängen am Terminal`).toBe(3);
    // GENAU EINMAL: kein Kennwort steht doppelt am Terminal. Das ist der Fehler, den ein „bei einem
    // Teil-Write den ganzen String erneut schreiben" erzeugen würde.
    for (const kennwort of gefunden) {
      expect(
        lauf.amTerminal.split(kennwort).length - 1,
        "ein Zugang steht mehrfach am Terminal",
      ).toBe(1);
    }
    // UND NICHTS ABGESCHNITTEN: der Text endet auf der Leerzeile, die `seed.ts` als letzte übergibt.
    expect(lauf.amTerminal.endsWith("\n\n"), "der Schluss der Liste fehlt").toBe(true);
    expect(lauf.amTerminal, "der Kopf der Liste fehlt").toContain("[seed:demo] Einmalkennwörter");
    // Und der Kanal bleibt der Kanal: nichts davon steht in einem Konsolenweg.
    expect(gefunden.filter((k) => alleZeilen.includes(k)).length).toBe(0);
    expect(process.exitCode, "eine vollständige Übergabe ist ein erledigter Lauf").not.toBe(1);
  });

  it("A5 · nimmt das Terminal irgendwann nichts mehr an, meldet der Lauf ehrlich Misserfolg", async () => {
    // GENAU bens ROT-1 aus sammel63, am Ende-zu-Ende-Weg: ein gültiger Teil-Write ohne Ausnahme.
    // Vor mega66 endete dieser Lauf mit Erfolg, ohne Fehlercode und ohne Weg zurück.
    terminal.hoechstensJeAufruf = 9;
    terminal.nullAbBytes = 45;

    const lauf = await cliLauf();
    const alleZeilen = lauf.konsole.join("\n");

    // DIE ZUSAGE STEHT ZUERST, weil sie der Befund ist: Der Lauf sagt, dass die Übergabe nicht
    // stattgefunden hat — und sagt es der Maschine. Gegen den Stand vor mega66 ist genau diese
    // Zeile rot: dort endete derselbe Lauf mit Erfolg und ohne Fehlercode.
    expect(process.exitCode, "ein Teil-Write ist kein erledigter Lauf").toBe(1);
    // GEMESSEN WIRD IN BYTES, und der Unterschied ist hier sichtbar: 45 Bytes ergeben 44
    // Zeichen, weil der Schnitt mitten in das „ö" von „Einmalkennwörter" fällt. Genau deshalb
    // führt der Helfer seine Schleife über einen Puffer und nicht über einen String — eine
    // Zeichenzählung wäre an dieser Stelle schon um eins daneben.
    expect(bytesAmTerminal(), "der Kanal hat mehr angenommen als erlaubt").toBe(45);
    expect(lauf.amTerminal.length, "der Schnitt lag nicht in einem Mehrbytezeichen").toBe(44);
    expect(alleZeilen, "der Kanal wird nicht benannt").toContain("/dev/tty");
    expect(alleZeilen, "der Adminweg fehlt").toContain("/api/auth/users/:id/reset");
    // Und die Meldung darf nicht behaupten, es gebe kein Terminal: hier gab es eines, es hat nur
    // nicht alles angenommen. Eine Diagnose, die im halben Fall falsch ist, ist die zweite falsche
    // Zusage.
    expect(alleZeilen, "die Meldung nennt nur den Fall ohne Terminal").toContain(
      "nicht vollständig angenommen",
    );
    // Kein Ausweichen: was nicht durchkam, wird NICHT nachgereicht.
    expect(
      lauf.konsole.filter((zeile) => TRAEGT_KENNWORT.test(zeile)).length,
      "eine Ausgabezeile trägt eine Demo-E-Mail mit etwas dahinter",
    ).toBe(0);
    // Und was durchkam, steht wertgenau in keinem Konsolenweg.
    expect(kennwoerter(lauf.amTerminal).filter((k) => alleZeilen.includes(k)).length).toBe(0);
  });
});

// ================================================================================================
// A3 — DER SAMMLER: `console.` UND DIE KENNWORTWERTE BLEIBEN GETRENNT.
// ================================================================================================
//
// Er prüft IDENTIFIER, nicht das Thema: `.kennwort` und `einmalkennwoerter` sind Werte, das Wort
// „Kennwort" in einem Hinweistext ist keiner. Genau deshalb darf die ehrliche Ersatzmeldung in
// `seed.ts` von Kennwörtern SPRECHEN, ohne eines zu tragen — ein Wächter, der das verbietet, würde
// die Ehrlichkeit bestrafen statt das Leck.
const SEED_QUELLE = readFileSync(
  join(__dirname, "..", "..", "services", "app", "src", "seed.ts"),
  "utf8",
).replace(/^\s*\/\/.*$/gm, "");

/** Alle Argumentspannen `[start, ende)` der Aufrufe, die auf `muster` passen — klammerbilanziert. */
function aufrufSpannen(quelle: string, muster: RegExp): Array<[number, number]> {
  const spannen: Array<[number, number]> = [];
  for (const treffer of quelle.matchAll(muster)) {
    const start = treffer.index ?? 0;
    let tiefe = 0;
    let i = start + treffer[0].length - 1; // steht auf der öffnenden Klammer
    for (; i < quelle.length; i++) {
      if (quelle[i] === "(") {
        tiefe += 1;
      } else if (quelle[i] === ")") {
        tiefe -= 1;
        if (tiefe === 0) {
          break;
        }
      }
    }
    spannen.push([start, i + 1]);
  }
  return spannen;
}

const WERT = /\.kennwort\b|\beinmalkennwoerter\b/g;

/** Kennwortwerte, die in einem `console.*`-Aufruf stehen — das ist der Befund von ROT-1. */
function werteInKonsole(quelle: string): number {
  const spannen = aufrufSpannen(quelle, /console\.\w+\(/g);
  return [...quelle.matchAll(WERT)].filter((t) =>
    spannen.some(([von, bis]) => (t.index ?? 0) > von && (t.index ?? 0) < bis),
  ).length;
}

describe("mega65 A3 · der Sammler hält console und die Kennwortwerte auseinander", () => {
  it("kein console.*-Aufruf in seed.ts berührt einen Kennwortwert", () => {
    // Selbstschutz: findet der Sammler weder Konsolenaufrufe noch Kennwortwerte, prüft er nichts.
    expect(
      aufrufSpannen(SEED_QUELLE, /console\.\w+\(/g).length,
      "keine console-Aufrufe gefunden",
    ).toBeGreaterThan(2);
    expect([...SEED_QUELLE.matchAll(WERT)].length, "keine Kennwortwerte gefunden").toBeGreaterThan(
      1,
    );

    expect(werteInKonsole(SEED_QUELLE), "ein Kennwortwert steht in einem console-Aufruf").toBe(0);
  });

  it("KALIBRIERUNG: gegen die wörtliche mega64-Zeile schlägt der Sammler an", () => {
    // Der Ist-Stand, den ben gemeldet hat — Zeichen für Zeichen. Stünde hier ein Muster, das ihn
    // nicht trifft, wäre diese ganze Datei eine Beruhigung ohne Inhalt.
    const mega64 = `${SEED_QUELLE}\nconsole.warn(\`[seed:demo]   \${zugang.email}  \${zugang.kennwort}\`);\n`;
    expect(werteInKonsole(mega64), "der Sammler erkennt die alte Zeile nicht").toBeGreaterThan(0);
  });

  it("jeder Kennwortwert geht durch die Terminal-Übergabe", () => {
    const uebergabe = aufrufSpannen(SEED_QUELLE, /amTerminalUebergeben\(/g);
    expect(uebergabe.length, "die Terminal-Übergabe wird nicht aufgerufen").toBe(1);
    const stellen = [...SEED_QUELLE.matchAll(/\.kennwort\b/g)].map((t) => t.index ?? 0);
    expect(stellen.length, "kein Kennwortwert gefunden").toBeGreaterThan(0);
    const draussen = stellen.filter(
      (stelle) => !uebergabe.some(([von, bis]) => stelle > von && stelle < bis),
    );
    expect(draussen.length, `${draussen.length} Kennwortwerte außerhalb der Übergabe`).toBe(0);
  });
});
