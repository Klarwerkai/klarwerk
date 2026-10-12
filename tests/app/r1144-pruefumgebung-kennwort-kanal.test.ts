// ================================================================================================
// R-1144 — AUCH DIE FE-002-PRÜFUMGEBUNG ÜBERGIBT IHRE ZUGÄNGE AM KONTROLLIERENDEN TERMINAL.
// ================================================================================================
//
// `scripts/fe002-pruefumgebung.ts` legt bei jedem Start zwei Konten mit frisch erzeugten
// Kennwörtern an und schrieb sie mit `process.stdout.write` aus — auf den Kanal, den eine Umleitung
// und ein automatischer Lauf mitschreiben. Der Demo-Seed ist seit mega65/66 auf `/dev/tty`
// umgestellt (`tests/app/mega65-seed-kennwort-kanal.test.ts`); diese Datei prüft denselben Vertrag
// am zweiten Anlegebefehl:
//
//   P1  Gelingt die Übergabe — auch über viele Teil-Writes —, stehen alle Zugänge GENAU EINMAL am
//       Terminal und KEIN Kennwort auf `stdout`/`stderr`. Adresse und Kennzahlen bleiben auf `stdout`.
//   P2  Ohne kontrollierendes Terminal wird NICHTS ausgegeben, der Lauf meldet `false` und nennt
//       den Kanal — ohne Rückfall auf einen Protokollkanal.
//   P3  Nimmt das Terminal irgendwann nichts mehr an, meldet der Lauf `false` und sagt, dass der
//       Text nicht vollständig angenommen wurde; nichts wird über einen anderen Kanal nachgereicht.
//
// Ersetzt ist NUR das Gerät hinter `/dev/tty` (wie im mega65-Sammler); `kennwort-uebergabe.ts`
// läuft echt mit seiner Schleife über den Byte-Offset. Die Kennwörter hier sind erfunden, und keine
// Meldung dieser Datei enthält eines — sie nennen nur Anzahlen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TTY_GRIFF = 424_243;

const terminal = vi.hoisted(() => ({
  abschnitte: [] as Buffer[],
  geoeffnet: 0,
  geschlossen: 0,
  oeffnenScheitert: false,
  hoechstensJeAufruf: null as number | null,
  nullAbBytes: null as number | null,
  aufrufe: 0,
}));

vi.mock("node:fs", async (echt) => {
  const modul = await echt<typeof import("node:fs")>();
  return {
    ...modul,
    openSync: (pfad: string, flags?: string, mode?: number): number => {
      if (pfad !== "/dev/tty") {
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

const { meldePruefumgebung } = await import("../../scripts/fe002-pruefumgebung");

const KENNWOERTER = ["erfundenAdminWert01", "erfundenExpertinWert02"];
const UMGEBUNG = {
  adresse: "http://127.0.0.1:4702",
  zugaenge: [
    { rolle: "admin" as const, email: "admin@fe002-probe.test", passwort: KENNWOERTER[0] ?? "" },
    {
      rolle: "experte" as const,
      email: "expertin@fe002-probe.test",
      passwort: KENNWOERTER[1] ?? "",
    },
  ],
  ungeleseneMeldungen: 2,
  schliessen: async (): Promise<void> => {},
};

const amTerminal = (): string => Buffer.concat(terminal.abschnitte).toString("utf8");

interface Lauf {
  ergebnis: boolean;
  stdout: string;
  stderr: string;
}

function lauf(): Lauf {
  const aus: string[] = [];
  const fehler: string[] = [];
  const rohStdout = vi.spyOn(process.stdout, "write").mockImplementation((stueck): boolean => {
    aus.push(String(stueck));
    return true;
  });
  const rohStderr = vi.spyOn(process.stderr, "write").mockImplementation((stueck): boolean => {
    fehler.push(String(stueck));
    return true;
  });
  let ergebnis: boolean;
  try {
    ergebnis = meldePruefumgebung(UMGEBUNG);
  } finally {
    rohStdout.mockRestore();
    rohStderr.mockRestore();
  }
  return { ergebnis, stdout: aus.join(""), stderr: fehler.join("") };
}

/** Wie viele der erfundenen Kennwörter in `text` vorkommen. */
const kennwoerterIn = (text: string): number => KENNWOERTER.filter((k) => text.includes(k)).length;

beforeEach(() => {
  terminal.abschnitte = [];
  terminal.geoeffnet = 0;
  terminal.geschlossen = 0;
  terminal.oeffnenScheitert = false;
  terminal.hoechstensJeAufruf = null;
  terminal.nullAbBytes = null;
  terminal.aufrufe = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("R-1144 · die FE-002-Prüfumgebung übergibt ihre Zugänge nur am kontrollierenden Terminal", () => {
  it("P1 · über viele Teil-Writes: alle Zugänge genau einmal am Terminal, keiner auf stdout/stderr", () => {
    terminal.hoechstensJeAufruf = 5;

    const ergebnis = lauf();

    expect(ergebnis.ergebnis, "eine vollständige Übergabe muss gelingen").toBe(true);
    expect(terminal.aufrufe, "es gab keinen Teil-Write").toBeGreaterThan(3);
    // Vollständig und keines doppelt.
    for (const kennwort of KENNWOERTER) {
      const vorkommen = amTerminal().split(kennwort).length - 1;
      expect(vorkommen, "ein Zugang fehlt oder steht doppelt").toBe(1);
    }
    expect(amTerminal().endsWith("\n\n"), "der Schluss der Liste fehlt").toBe(true);
    // Der Kanal ist die Zusage: kein Kennwort in einem umleitbaren Kanal.
    expect(kennwoerterIn(ergebnis.stdout), "Kennwörter auf stdout").toBe(0);
    expect(kennwoerterIn(ergebnis.stderr), "Kennwörter auf stderr").toBe(0);
    // KALIBRIERUNG des Sammlers: die nicht geheimen Angaben kommen auf stdout an.
    expect(ergebnis.stdout).toContain("Adresse:  http://127.0.0.1:4702/start");
    expect(ergebnis.stdout).toContain("Ungelesene Meldungen des Administrators: 2");
    expect([terminal.geoeffnet, terminal.geschlossen]).toEqual([1, 1]);
  });

  it("P2 · ohne Terminal wird nichts ausgegeben, false gemeldet und der Kanal benannt", () => {
    terminal.oeffnenScheitert = true;

    const ergebnis = lauf();

    expect(ergebnis.ergebnis, "ohne Terminal darf die Übergabe nicht als gelungen gelten").toBe(
      false,
    );
    expect(amTerminal(), "ohne Terminal darf nichts geschrieben worden sein").toBe("");
    expect(kennwoerterIn(ergebnis.stdout), "Kennwörter auf stdout").toBe(0);
    expect(kennwoerterIn(ergebnis.stderr), "Kennwörter auf stderr").toBe(0);
    expect(ergebnis.stderr, "der fehlende Kanal wird nicht benannt").toContain("/dev/tty");
    expect(ergebnis.stderr).toContain("NICHT stattgefunden");
  });

  it("P3 · nimmt das Terminal nichts mehr an, ist die Übergabe gescheitert und nichts wird nachgereicht", () => {
    terminal.hoechstensJeAufruf = 6;
    terminal.nullAbBytes = 30;

    const ergebnis = lauf();

    expect(ergebnis.ergebnis, "ein Teil-Write ist keine stattgefundene Übergabe").toBe(false);
    expect(Buffer.concat(terminal.abschnitte).length).toBe(30);
    expect(terminal.aufrufe, "die 0 wurde wiederholt").toBeLessThan(10);
    expect(ergebnis.stderr, "die Meldung nennt nur den Fall ohne Terminal").toContain(
      "nicht vollständig angenommen",
    );
    expect(kennwoerterIn(ergebnis.stdout), "Kennwörter auf stdout").toBe(0);
    expect(kennwoerterIn(ergebnis.stderr), "Kennwörter auf stderr").toBe(0);
    expect(terminal.geschlossen).toBe(1);
  });
});
