// ================================================================================================
// AUFTRAG-mega65 BLOCK A — DER KANAL WIRD AM KANAL GEPRÜFT.
// AUFTRAG-mega66 BLOCK A — UND SEIN ERFOLG WIRD AM BYTE GEPRÜFT, NICHT AM AUSBLEIBEN EINER
// AUSNAHME.
// ================================================================================================
//
// bens ROT-1 (sammel62) war kein Codefehler an einer Zeile, sondern ein Belegfehler: Die Zusage
// „nicht im Protokoll" wurde an der erwarteten Nutzung begründet („wer diesen Befehl aufruft, sitzt
// davor") statt am Kanal. Deshalb prüft diese Datei genau das Kanalverhalten und nichts sonst.
//
// bens ROT-1 aus sammel63 ist DIESELBE Fehlerklasse eine Ebene tiefer: nicht der Kanal war
// angenommen statt gemessen, sondern SEIN ERFOLG. `writeSync` liefert die Zahl der tatsächlich
// geschriebenen Bytes; wer sie ignoriert, meldet einen Teil-Write als vollständige Übergabe. Die
// Attrappe unten liefert deshalb nicht mehr blind `text.length`, sondern nimmt so viele Bytes an,
// wie der jeweilige Fall vorgibt — genau so, wie ein Gerät es darf.
//
//   A-K1  Geöffnet wird `/dev/tty` — und ausschließlich das. Kein `stdout`, kein `stderr`, keine
//         Datei im Arbeitsverzeichnis.
//   A-K2  Gibt es kein kontrollierendes Terminal (CI, Container, Pipeline, Windows), wird NICHTS
//         geschrieben und die Übergabe meldet ehrlich `false`. Die richtige Fehlrichtung.
//   A-K3  Der Deskriptor wird geschlossen, auch wenn das Schreiben scheitert.
//   A-K4  MEHRERE Teil-Writes: exakt alle Bytes kommen an, in Reihenfolge, KEINES doppelt. Das ist
//         der Fall aus bens ROT-1 (sammel63) und der Grund für die Schleife über den Byte-Offset.
//   A-K5  Ein Kanal, der `0` zurückgibt, ist kein Kanal: `false`, kein Endlosdrehen.
//   A-K6  Bricht der Kanal nach der Hälfte mit einer Ausnahme ab, gilt die Übergabe als NICHT
//         stattgefunden — auch wenn schon Bytes durch sind.
//   A-K7  Der Puffer, nicht der String: Umlaute werden nicht an einer Mehrbyte-Grenze zerlegt.
//
// `node:fs` ist ersetzt, weil die Zusage sonst von der Umgebung des Testlaufs abhinge: In einem
// echten Terminal hätte der Lauf ein `/dev/tty` und schriebe dorthin, im CI nicht — der Test wäre
// je nach Aufrufort etwas anderes. Ersetzt ist NUR das Gerät, nicht die Logik: welcher Pfad mit
// welchen Rechten geöffnet wird und wie viele Bytes ankommen, ist genau die geprüfte Aussage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const geraet = vi.hoisted(() => ({
  geoeffnet: [] as Array<{ pfad: string; flags: string }>,
  /** Jeder einzelne angenommene Abschnitt, in Aufrufreihenfolge — daraus wird A-K4 belegt. */
  abschnitte: [] as Array<{ griff: number; bytes: Buffer }>,
  geschlossen: [] as number[],
  oeffnenScheitert: null as string | null,
  schreibenScheitert: false,
  /** Höchstens so viele Bytes je Aufruf annehmen — die Attrappe für den Teil-Write. */
  hoechstensJeAufruf: null as number | null,
  /** Ab dieser Gesamtzahl angenommener Bytes `0` liefern: der Kanal nimmt nichts mehr an. */
  nullAbBytes: null as number | null,
  /** Ab dieser Gesamtzahl angenommener Bytes werfen: Abbruch mitten im Schreibweg. */
  wirftAbBytes: null as number | null,
  /** Die Zahl der `writeSync`-Aufrufe — ein Zähler gegen Endlosdrehen. */
  aufrufe: 0,
}));

/** Alles, was das Gerät angenommen hat, in der Reihenfolge der Annahme. */
const angekommen = (): Buffer => Buffer.concat(geraet.abschnitte.map((a) => a.bytes));

vi.mock("node:fs", async (echt) => ({
  ...(await echt<Record<string, unknown>>()),
  openSync: (pfad: string, flags: string): number => {
    geraet.geoeffnet.push({ pfad, flags });
    if (geraet.oeffnenScheitert !== null) {
      const fehler = new Error(`${geraet.oeffnenScheitert}: no such device or address`);
      (fehler as NodeJS.ErrnoException).code = geraet.oeffnenScheitert;
      throw fehler;
    }
    return 42;
  },
  // Die echte Signatur, nicht die bequeme: `(fd, buffer, offset, length)`. Ein Gerät darf weniger
  // annehmen, als man ihm anbietet, und genau das tut diese Attrappe.
  writeSync: (griff: number, daten: Buffer | string, offset?: number, laenge?: number): number => {
    geraet.aufrufe += 1;
    if (geraet.schreibenScheitert) {
      throw new Error("EIO");
    }
    const bisher = angekommen().length;
    if (geraet.wirftAbBytes !== null && bisher >= geraet.wirftAbBytes) {
      const fehler = new Error("EIO: i/o error, write");
      (fehler as NodeJS.ErrnoException).code = "EIO";
      throw fehler;
    }
    if (geraet.nullAbBytes !== null && bisher >= geraet.nullAbBytes) {
      return 0;
    }
    const puffer = typeof daten === "string" ? Buffer.from(daten, "utf8") : daten;
    const von = offset ?? 0;
    const angeboten = puffer.subarray(von, von + (laenge ?? puffer.length - von));
    let annahme = angeboten.length;
    if (geraet.hoechstensJeAufruf !== null) {
      annahme = Math.min(annahme, geraet.hoechstensJeAufruf);
    }
    if (geraet.wirftAbBytes !== null) {
      annahme = Math.min(annahme, geraet.wirftAbBytes - bisher);
    }
    if (geraet.nullAbBytes !== null) {
      annahme = Math.min(annahme, geraet.nullAbBytes - bisher);
    }
    geraet.abschnitte.push({ griff, bytes: Buffer.from(angeboten.subarray(0, annahme)) });
    return annahme;
  },
  closeSync: (griff: number): void => {
    geraet.geschlossen.push(griff);
  },
}));

const { TERMINAL, amTerminalUebergeben } = await import("./kennwort-uebergabe");

beforeEach(() => {
  geraet.geoeffnet = [];
  geraet.abschnitte = [];
  geraet.geschlossen = [];
  geraet.oeffnenScheitert = null;
  geraet.schreibenScheitert = false;
  geraet.hoechstensJeAufruf = null;
  geraet.nullAbBytes = null;
  geraet.wirftAbBytes = null;
  geraet.aufrufe = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("mega65 A · die Übergabe benutzt das kontrollierende Terminal", () => {
  it("A-K1 · geöffnet wird genau /dev/tty, geschrieben wird genau dorthin", () => {
    const ergebnis = amTerminalUebergeben(["erste Zeile", "zweite Zeile"]);

    expect(ergebnis, "die Übergabe muss gelingen, wenn es ein Terminal gibt").toBe(true);
    // Der Kanal ist die Zusage: ein einziges Öffnen, und zwar des kontrollierenden Terminals.
    expect(geraet.geoeffnet).toEqual([{ pfad: "/dev/tty", flags: "w" }]);
    expect(TERMINAL, "die Konstante muss denselben Kanal nennen").toBe("/dev/tty");
    // Und der Inhalt geht auf DIESEN Deskriptor — nicht auf 1 (stdout) und nicht auf 2 (stderr).
    expect(geraet.abschnitte.map((a) => a.griff)).toEqual([42]);
    expect(angekommen().toString("utf8")).toBe("erste Zeile\nzweite Zeile\n");
    expect(geraet.geschlossen).toEqual([42]);
  });

  it("A-K2 · ohne kontrollierendes Terminal wird NICHTS geschrieben und ehrlich false gemeldet", () => {
    // ENXIO ist genau das, was Node liefert, wenn der Prozess kein kontrollierendes Terminal hat —
    // nachgemessen im CI-artigen Lauf (s. Bericht mega65). Windows liefert ENOENT; beide Wege enden
    // hier gleich.
    geraet.oeffnenScheitert = "ENXIO";

    const ergebnis = amTerminalUebergeben(["etwas, das niemand sehen darf"]);

    expect(ergebnis, "ohne Terminal darf die Übergabe nicht als gelungen gelten").toBe(false);
    expect(geraet.abschnitte, "es darf NICHTS geschrieben worden sein").toEqual([]);
    // Kein Rückfall: kein zweiter Öffnungsversuch auf eine Datei, keine andere Senke.
    expect(geraet.geoeffnet).toEqual([{ pfad: "/dev/tty", flags: "w" }]);
    expect(geraet.geschlossen, "ohne Deskriptor gibt es nichts zu schließen").toEqual([]);
  });

  it("A-K3 · scheitert das Schreiben, wird der Deskriptor trotzdem geschlossen und false gemeldet", () => {
    geraet.schreibenScheitert = true;

    expect(amTerminalUebergeben(["etwas"])).toBe(false);
    expect(geraet.geschlossen, "der geöffnete Deskriptor muss geschlossen werden").toEqual([42]);
  });
});

// ================================================================================================
// AUFTRAG-mega66 — DER ERFOLGSVERTRAG TRÄGT BIS ZUM LETZTEN BYTE.
// ================================================================================================
describe("mega66 A · ein Teil-Write ist keine stattgefundene Übergabe", () => {
  // Die Zeilen tragen absichtlich Umlaute UND E-Mail-artige Paare: es ist die Form, in der die
  // Einmalkennwörter wirklich durch diesen Kanal gehen, und die Umlaute sind der Grund für den
  // Puffer. Kennwortartige Zeichenfolgen hier sind erfunden und stehen in keinem Produktweg.
  const ZEILEN = [
    "",
    "[seed:demo] Einmalkennwörter der neu angelegten Demo-Konten:",
    "[seed:demo]   erste@beispiel.test   AAAA-1111",
    "[seed:demo]   zweite@beispiel.test  BBBB-2222",
    "[seed:demo]   dritte@beispiel.test  CCCC-3333",
    "",
  ];
  const ERWARTET = Buffer.from(`${ZEILEN.join("\n")}\n`, "utf8");

  it("A-K4 · mehrere Teil-Writes: exakt alle Bytes kommen an, in Reihenfolge, keines doppelt", () => {
    // Sieben Bytes je Aufruf. Das erzwingt viele Runden und liegt garantiert nicht auf einer
    // Zeichengrenze — wer die Schleife über einen String statt über den Puffer führt, zerlegt hier
    // ein Mehrbytezeichen oder schiebt zu viel nach.
    geraet.hoechstensJeAufruf = 7;

    const ergebnis = amTerminalUebergeben(ZEILEN);

    expect(ergebnis, "sind alle Bytes angenommen, hat die Übergabe stattgefunden").toBe(true);
    // Es muss wirklich mehrfach geschrieben worden sein, sonst prüft der Fall nichts.
    expect(geraet.abschnitte.length, "es gab keinen Teil-Write").toBeGreaterThan(3);
    // DIE ZUSAGE: byteweise identisch — nicht „enthält", nicht „beginnt mit".
    const summe = angekommen();
    expect(summe.length, `${summe.length} statt ${ERWARTET.length} Bytes am Terminal`).toBe(
      ERWARTET.length,
    );
    expect(summe.equals(ERWARTET), "die angekommenen Bytes weichen ab").toBe(true);
    // Und KEINES doppelt: die Summe der Abschnitte ist genau die Gesamtlänge, es wurde also nichts
    // ein zweites Mal angeboten und angenommen.
    expect(geraet.abschnitte.reduce((n, a) => n + a.bytes.length, 0)).toBe(ERWARTET.length);
  });

  it("A-K5 · nimmt der Kanal nichts mehr an (0), ist die Übergabe gescheitert", () => {
    geraet.hoechstensJeAufruf = 9;
    geraet.nullAbBytes = 18; // erst zwei Runden, dann Stillstand

    const ergebnis = amTerminalUebergeben(ZEILEN);

    expect(ergebnis, "ein Kanal, der nichts mehr annimmt, ist kein Kanal").toBe(false);
    expect(angekommen().length, "es kam mehr an als der Kanal angenommen hat").toBe(18);
    // Kein Endlosdrehen: die `0` beendet die Schleife, sie wiederholt sie nicht.
    expect(
      geraet.aufrufe,
      `${geraet.aufrufe} writeSync-Aufrufe — die 0 wurde wiederholt`,
    ).toBeLessThan(8);
    expect(geraet.geschlossen, "der Deskriptor muss auch hier geschlossen werden").toEqual([42]);
  });

  it("A-K6 · bricht der Kanal nach der Hälfte ab, hat die Übergabe NICHT stattgefunden", () => {
    geraet.hoechstensJeAufruf = 11;
    geraet.wirftAbBytes = Math.floor(ERWARTET.length / 2);

    const ergebnis = amTerminalUebergeben(ZEILEN);

    expect(ergebnis, "durchgekommene Bytes sind keine stattgefundene Übergabe").toBe(false);
    expect(angekommen().length, "der Abbruch kam zu früh oder zu spät").toBeLessThan(
      ERWARTET.length,
    );
    expect(
      angekommen().length,
      "es kam gar nichts an — dann prüft der Fall nichts",
    ).toBeGreaterThan(0);
    expect(geraet.geschlossen).toEqual([42]);
  });

  it("A-K7 · geschrieben wird der Puffer: ein Umlaut wird an keiner Grenze zerlegt", () => {
    // Ein Byte je Aufruf ist der härteste Fall: jede einzelne Grenze fällt hier mitten in die
    // Mehrbytefolge von „ö". Wer Zeichen statt Bytes zählt, kommt hier nie exakt heraus.
    geraet.hoechstensJeAufruf = 1;
    const zeile = "Einmalkennwörter für drei Konten — Größe zählt";

    expect(amTerminalUebergeben([zeile])).toBe(true);
    const summe = angekommen();
    expect(summe.equals(Buffer.from(`${zeile}\n`, "utf8"))).toBe(true);
    // Und das ist der Punkt: mehr Bytes als Zeichen, jeder einzeln durch.
    expect(summe.length, "der Text hätte mehr Bytes als Zeichen haben müssen").toBeGreaterThan(
      `${zeile}\n`.length,
    );
    expect(geraet.abschnitte.length).toBe(summe.length);
  });
});
