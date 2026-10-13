// ================================================================================================
// AUFNAHME 20260922 · R-1303 / R-1982 (N6) / R-2190 — DER DIAGNOSEWAECHTER WIRD SELBST GEPRUEFT.
// ================================================================================================
//
// `tools/arbeitsordner-diagnose.ts` erkennt an der WIRKUNG, ob ein Arbeitsbaum unter einer
// Dateisynchronisation liegt: byte-identische ` 2`-Duplikate (auch in `.git`) und ausgelagerte
// Dateien. Zugriffsfehler und freien Platz haelt er fest (R-2190).
//
// WARUM AN SYNTHETISCHEN BAEUMEN: in der Automatisierung liegt kein Baum unter iCloud. Ein Fall,
// der den echten Vorfall braeuchte, waere hier uebersprungen — und ein uebersprungener Fall belegt
// nichts. Gebaut wird deshalb genau das, was JOB 914 gemessen hat: `X 2.ext` neben `X.ext`,
// `ORIG_HEAD 2` in `.git`, und die Gegenproben (aehnlicher Name, andere Bytes).
//
// AUSGELAGERTE DATEIEN NACHGESTELLT: eine dataless-Datei laesst sich ohne iCloud nicht erzeugen.
// Ihr Kennzeichen (Groesse > 0, 0 belegte Bloecke) hat aber auch eine SPAERLICHE Datei, die
// `truncate` anlegt. Die Kalibrierung prueft zuerst, dass das Dateisystem sie wirklich so fuehrt;
// tut es das nicht, wird der Fall ROT und nicht still uebersprungen.
//
// WAS HIER NICHT BELEGT IST: dass auf einem echten Rechner mit „Schreibtisch & Dokumente“ genau
// diese Kennzeichen auftreten. Das stuetzt sich auf die gemessenen Vorfaelle (JOB 914: 611/1003
// Duplikate; F-1293: „compressed,dataless“) und braucht einen Lauf auf einem solchen Rechner.
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  type Dateizugriff,
  EXITCODE,
  NODE_DATEIZUGRIFF,
  argumente,
  bericht,
  byteGleich,
  diagnostiziere,
  istAusgelagert,
  originalName,
  urteil,
} from "../../tools/arbeitsordner-diagnose";

const WURZEL = join(import.meta.dirname, "../..");
const BAEUME: string[] = [];

afterAll(() => {
  for (const b of BAEUME) rmSync(b, { recursive: true, force: true });
});

/** Ein frischer Baum ausserhalb des Arbeitsbaums: `{ "rel/pfad": "inhalt" }`. */
function baum(dateien: Record<string, string>): string {
  const wurzel = mkdtempSync(join(tmpdir(), "arbeitsordner-diagnose-"));
  BAEUME.push(wurzel);
  for (const [rel, inhalt] of Object.entries(dateien)) {
    const ziel = join(wurzel, rel);
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, inhalt);
  }
  return wurzel;
}

/** Eine spaerliche Datei: Groesse > 0, keine belegten Bloecke — wie eine ausgelagerte Datei. */
function spaerlich(wurzel: string, rel: string, groesse = 64 * 1024): string {
  const ziel = join(wurzel, rel);
  mkdirSync(dirname(ziel), { recursive: true });
  writeFileSync(ziel, "");
  truncateSync(ziel, groesse);
  return ziel;
}

/** Den echten Starter fahren — denselben, den `tools/check` ruft. */
function fahreStarter(args: string[]) {
  return spawnSync("bash", ["tools/arbeitsordner-diagnose.sh", ...args], {
    cwd: WURZEL,
    encoding: "utf-8",
  });
}

/**
 * Der echte Dateizugriff mit einem nachgestellten Ausfall: `scheitert(art, pfad)` entscheidet,
 * ob Oeffnen bzw. Lesen dieser Datei mit EACCES wirft. Gezaehlt wird, welche Deskriptoren offen
 * blieben — die Gegenprobe zu Bens Befund (Nacharbeit 2), unabhaengig von Dateirechten, die ein
 * Prueflauf als root ignorieren wuerde.
 */
function zugriffMitAusfall(scheitert: (art: "oeffne" | "lies", pfad: string) => boolean) {
  const offen = new Map<number, string>();
  const zugriff: Dateizugriff = {
    oeffne(pfad) {
      if (scheitert("oeffne", pfad)) {
        throw Object.assign(new Error(`EACCES: open '${pfad}'`), { code: "EACCES" });
      }
      const fd = NODE_DATEIZUGRIFF.oeffne(pfad);
      offen.set(fd, pfad);
      return fd;
    },
    lies(fd, puffer) {
      const pfad = offen.get(fd) ?? "";
      if (scheitert("lies", pfad)) {
        throw Object.assign(new Error(`EIO: read '${pfad}'`), { code: "EIO" });
      }
      return NODE_DATEIZUGRIFF.lies(fd, puffer);
    },
    schliesse(fd) {
      offen.delete(fd);
      NODE_DATEIZUGRIFF.schliesse(fd);
    },
  };
  return { zugriff, offen };
}

describe("R-1303 · der Name allein entscheidet nichts — er waehlt nur Kandidaten", () => {
  it("erkennt den Synchronisationszusatz vor der Endung und ohne Endung", () => {
    expect(originalName("index 2.ts")).toBe("index.ts");
    expect(originalName("ORIG_HEAD 2")).toBe("ORIG_HEAD");
    expect(originalName("gitdir 2")).toBe("gitdir");
    expect(originalName("Bericht 12.md")).toBe("Bericht.md");
    expect(originalName(".env 2")).toBe(".env");
  });

  it("KALIBRIERUNG — Namen ohne Zusatz sind keine Kandidaten", () => {
    expect(originalName("index.ts")).toBeNull();
    expect(originalName("Version 1.md"), "` 1` vergibt die Synchronisation nicht").toBeNull();
    expect(originalName("Version2.md"), "ohne Leerzeichen ist es kein Zusatz").toBeNull();
    expect(originalName("Archiv 2.tar.gz"), "Zusatz nur vor der letzten Endung").toBeNull();
  });
});

describe("R-1303 · DUPLIKATE: byteweise gleich, auch in .git", () => {
  it("findet ` 2`-Duplikate im Arbeitsbaum UND in der Git-Buchfuehrung (JOB 914)", () => {
    const wurzel = baum({
      "src/index.ts": "export const a = 1;\n",
      "src/index 2.ts": "export const a = 1;\n",
      ".git/ORIG_HEAD": "2a96bab2c96cb33c365da3ab145a854622863bf2\n",
      ".git/ORIG_HEAD 2": "2a96bab2c96cb33c365da3ab145a854622863bf2\n",
      ".git/worktrees/w1/gitdir": "/pfad/zum/baum/.git\n",
      ".git/worktrees/w1/gitdir 2": "/pfad/zum/baum/.git\n",
    });

    const d = diagnostiziere(wurzel);

    expect(d.duplikate.map((x) => x.pfad)).toEqual([
      ".git/ORIG_HEAD 2",
      ".git/worktrees/w1/gitdir 2",
      "src/index 2.ts",
    ]);
    expect(d.duplikate.find((x) => x.pfad === "src/index 2.ts")?.original).toBe("src/index.ts");
    expect(urteil(d)).toBe("SYNCHRONISATION_ERKANNT");
  });

  it("GEGENPROBE — gleicher Zusatz, gleiche Groesse, ANDERE Bytes: kein Duplikat", () => {
    // JOB 914: 20 Treffer waren NICHT byte-identisch und zaehlten zu Recht nicht.
    const wurzel = baum({ "a.txt": "abc\n", "a 2.txt": "abd\n" });
    const d = diagnostiziere(wurzel);
    expect(d.duplikate).toEqual([]);
    expect(urteil(d)).toBe("KEIN_HINWEIS");
  });

  it("GEGENPROBE — ohne Original daneben oder mit anderer Groesse: kein Duplikat", () => {
    const wurzel = baum({
      "Kapitel 2.md": "zweites Kapitel\n",
      "b.txt": "kurz\n",
      "b 2.txt": "deutlich laenger\n",
    });
    expect(diagnostiziere(wurzel).duplikate).toEqual([]);
  });

  it("GEGENPROBE — sauberer Baum: KEIN_HINWEIS, und der Bericht sagt, was das NICHT heisst", () => {
    const wurzel = baum({ "README.md": "# Baum\n", "src/a.ts": "export {};\n" });
    const d = diagnostiziere(wurzel);
    expect(d.dateien).toBe(2);
    expect(urteil(d)).toBe("KEIN_HINWEIS");
    const text = bericht(d).join("\n");
    expect(text).toContain("0 byte-identische Sync-Duplikate");
    // „Nichts gefunden“ darf nicht als „keine Synchronisation“ gelesen werden.
    expect(text).toContain("Das belegt nicht, dass keine Synchronisation");
  });

  it("node_modules wird uebersprungen, .git nicht", () => {
    const wurzel = baum({
      "node_modules/x/i.js": "1",
      "node_modules/x/i 2.js": "1",
      ".git/HEAD": "ref: refs/heads/main\n",
      ".git/HEAD 2": "ref: refs/heads/main\n",
    });
    expect(diagnostiziere(wurzel).duplikate.map((x) => x.pfad)).toEqual([".git/HEAD 2"]);
  });
});

describe("R-1303 · AUSGELAGERT: gezaehlt, ohne die Datei zu oeffnen (F-1293)", () => {
  it("das Kennzeichen: Groesse > 0 bei 0 belegten Bloecken", () => {
    const datei = { isFile: () => true };
    expect(istAusgelagert({ ...datei, size: 4096, blocks: 0 })).toBe(true);
    expect(istAusgelagert({ ...datei, size: 4096, blocks: 8 })).toBe(false);
    expect(istAusgelagert({ ...datei, size: 0, blocks: 0 }), "eine leere Datei").toBe(false);
    expect(istAusgelagert({ isFile: () => false, size: 4096, blocks: 0 })).toBe(false);
  });

  it("zaehlt ausgelagerte Dateien, druckt die Rueckholliste und holt NICHTS von selbst", () => {
    const wurzel = baum({ "lokal.txt": "da\n" });
    const datei = spaerlich(wurzel, "wolke/gross.bin");
    // KALIBRIERUNG: ohne sie waere ein Gruen auf einem Dateisystem ohne spaerliche Dateien wertlos.
    expect(lstatSync(datei).blocks, "das Dateisystem fuehrt die Datei nicht spaerlich").toBe(0);

    const d = diagnostiziere(wurzel);

    expect(d.ausgelagert).toEqual(["wolke/gross.bin"]);
    expect(urteil(d)).toBe("SYNCHRONISATION_ERKANNT");
    const text = bericht(d).join("\n");
    expect(text).toContain("1 von 2 Dateien");
    expect(text).toContain("Rueckholliste");
    expect(text).toContain("Zurueckgeholt wird nichts von selbst");
    // Lesen ist keine Leseprobe: die Diagnose hat die Datei nicht beschrieben oder gefuellt.
    expect(lstatSync(datei).blocks, "die Diagnose hat die ausgelagerte Datei angefasst").toBe(0);
  });

  it("ein Paar mit ausgelagertem Teil wird NICHT geoeffnet, sondern als unverglichen gemeldet", () => {
    const wurzel = baum({});
    spaerlich(wurzel, "x.bin");
    spaerlich(wurzel, "x 2.bin");
    const d = diagnostiziere(wurzel);
    expect(d.duplikate).toEqual([]);
    expect(d.unverglichen.map((x) => x.pfad)).toEqual(["x 2.bin"]);
    expect(d.unverglichen[0]?.grund).toContain("Download");
  });
});

describe("R-2190 · Platten- und Dateizugriffsausfaelle werden nachvollziehbar festgehalten", () => {
  it("ein Zugriffsfehler wird mit Pfad und Code festgehalten, nicht verschluckt", () => {
    const fehlt = join(tmpdir(), "arbeitsordner-diagnose-gibt-es-nicht", "unter");
    const d = diagnostiziere(fehlt);
    expect(d.zugriffsfehler.map((x) => x.code)).toContain("ENOENT");
    expect(urteil(d), "ungelesen ist nicht sauber").toBe("UNVOLLSTAENDIG");
    expect(bericht(d).join("\n")).toContain("NICHT vollstaendig gemessen");
  });

  it("scheitert das Oeffnen des ORIGINALS: Fehler unter dem Originalpfad, kein Deskriptor offen", () => {
    const wurzel = baum({ "a.txt": "gleich\n", "a 2.txt": "gleich\n" });
    const original = join(wurzel, "a.txt");
    const { zugriff, offen } = zugriffMitAusfall((art, p) => art === "oeffne" && p === original);

    const d = diagnostiziere(wurzel, zugriff);

    expect(d.zugriffsfehler).toHaveLength(1);
    expect(d.zugriffsfehler[0]?.pfad, "gehoert dem Original, nicht der Kopie").toBe("a.txt");
    expect(d.zugriffsfehler[0]?.code).toBe("EACCES");
    expect([...offen.values()], "die schon geoeffnete Kopie blieb offen").toEqual([]);
    expect(d.duplikate).toEqual([]);
    expect(urteil(d)).toBe("UNVOLLSTAENDIG");
  });

  it("scheitert das Oeffnen der KOPIE: Fehler unter dem Kopienpfad, das Original wird nicht geoeffnet", () => {
    const wurzel = baum({ "a.txt": "gleich\n", "a 2.txt": "gleich\n" });
    const kopie = join(wurzel, "a 2.txt");
    const geoeffnet: string[] = [];
    const { zugriff, offen } = zugriffMitAusfall((art, p) => {
      if (art === "oeffne") geoeffnet.push(p);
      return art === "oeffne" && p === kopie;
    });

    const d = diagnostiziere(wurzel, zugriff);

    expect(d.zugriffsfehler.map((x) => `${x.pfad} · ${x.code}`)).toEqual(["a 2.txt · EACCES"]);
    expect(geoeffnet).toEqual([kopie]);
    expect([...offen.values()]).toEqual([]);
  });

  it("scheitert das LESEN des Originals: Fehler unter dem Originalpfad, beide Deskriptoren zu", () => {
    const wurzel = baum({});
    const original = join(wurzel, "a.txt");
    const kopie = join(wurzel, "a 2.txt");
    writeFileSync(original, "gleich\n");
    writeFileSync(kopie, "gleich\n");
    const { zugriff, offen } = zugriffMitAusfall((art, p) => art === "lies" && p === original);

    const ergebnis = byteGleich(kopie, original, zugriff);

    expect(ergebnis).toMatchObject({ pfad: original });
    expect([...offen.values()], "ein Deskriptor blieb nach dem Lesefehler offen").toEqual([]);
    // KALIBRIERUNG: ohne Ausfall ist dasselbe Paar ein Duplikat — die Vorrichtung misst wirklich.
    expect(byteGleich(kopie, original)).toBe(true);
  });

  it("der freie Platz des Datentraegers steht in jedem Bericht", () => {
    const d = diagnostiziere(baum({ "a.txt": "a" }));
    expect("freiBytes" in d.platz, "statfs lieferte keinen Platz").toBe(true);
    if ("freiBytes" in d.platz) {
      expect(d.platz.gesamtBytes).toBeGreaterThan(0);
      expect(d.platz.freiBytes).toBeGreaterThanOrEqual(0);
    }
    expect(bericht(d).join("\n")).toMatch(/Datentraeger: \d+\.\d GiB frei von/);
  });

  it("--protokoll haengt je Lauf eine JSON-Zeile an — der Verlauf bleibt nachvollziehbar", () => {
    const wurzel = baum({ "a.txt": "1\n", "a 2.txt": "1\n" });
    const protokoll = join(baum({}), "diagnose.jsonl");
    expect(argumente([wurzel, "--protokoll", protokoll])).toEqual({
      wurzel,
      json: false,
      protokoll,
    });

    const erster = fahreStarter([wurzel, "--protokoll", protokoll]);
    const zweiter = fahreStarter([wurzel, "--protokoll", protokoll]);

    expect(erster.status, erster.stderr).toBe(EXITCODE.SYNCHRONISATION_ERKANNT);
    expect(zweiter.status, zweiter.stderr).toBe(EXITCODE.SYNCHRONISATION_ERKANNT);
    const zeilen = readFileSync(protokoll, "utf-8").trim().split("\n");
    expect(zeilen, "das Protokoll wurde ueberschrieben statt ergaenzt").toHaveLength(2);
    const eintrag = JSON.parse(zeilen[0] ?? "{}");
    expect(eintrag.urteil).toBe("SYNCHRONISATION_ERKANNT");
    expect(eintrag.zeitpunkt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(eintrag.duplikate).toEqual([{ pfad: "a 2.txt", original: "a.txt" }]);
  });
});

describe("Die Kette: Starter, Rueckgabewerte und Aufrufer", () => {
  it("der Starter meldet einen sauberen Baum mit 0 und einen betroffenen mit 1", () => {
    const sauber = fahreStarter([baum({ "a.txt": "a\n" })]);
    expect(sauber.status, sauber.stderr).toBe(EXITCODE.KEIN_HINWEIS);
    expect(sauber.stdout).toContain("Keine Sync-Wirkung gefunden");

    const betroffen = fahreStarter([baum({ "a.txt": "a\n", "a 2.txt": "a\n" })]);
    expect(betroffen.status, betroffen.stderr).toBe(EXITCODE.SYNCHRONISATION_ERKANNT);
    expect(betroffen.stdout).toContain("a 2.txt  =  a.txt");
    expect(betroffen.stdout).toContain("ERKANNT");
  });

  it("der dokumentierte Direktaufruf ./tools/arbeitsordner-diagnose.sh laeuft ohne `bash` davor", () => {
    // Ben, Nacharbeit 2: SETUP.md und das Onboarding nennen den Direktaufruf; versioniert war der
    // Starter aber mit 100644 und scheiterte nach dem Klonen am fehlenden Ausfuehrungsrecht.
    const starter = join(WURZEL, "tools/arbeitsordner-diagnose.sh");
    expect(statSync(starter).mode & 0o111, "der Starter ist nicht ausfuehrbar").not.toBe(0);

    const direkt = spawnSync("./tools/arbeitsordner-diagnose.sh", [baum({ "a.txt": "a\n" })], {
      cwd: WURZEL,
      encoding: "utf-8",
    });
    expect(direkt.error, "der Direktaufruf startet nicht").toBeUndefined();
    expect(direkt.status, direkt.stderr).toBe(EXITCODE.KEIN_HINWEIS);
    expect(direkt.stdout).toContain("Keine Sync-Wirkung gefunden");
  });

  it("tools/check faehrt den Waechter — und er meldet dort, ohne das Tor zu sperren", () => {
    const tor = readFileSync(join(WURZEL, "tools/check"), "utf-8");
    const zeile = tor.split("\n").find((z) => z.includes("tools/arbeitsordner-diagnose.sh"));
    expect(zeile, "tools/check ruft den Diagnosewaechter nicht").toBeDefined();
    // Der Befund ist eine Umzugsentscheidung des Menschen, kein Torfehler: `|| echo …`.
    expect(zeile).toMatch(/\|\| echo /);
  });

  it("das Onboarding verweist auf den Diagnosewaechter (Einrichtungshandbuch, R-1982/N6)", () => {
    const onboarding = readFileSync(
      join(WURZEL, "PROJECT_CONTEXT/12_ONBOARDING_NEUER_MITARBEITER.md"),
      "utf-8",
    );
    const warnung = onboarding.indexOf("Wohin die Repos NICHT gehören");
    const verweis = onboarding.indexOf("./tools/arbeitsordner-diagnose.sh");
    const ordner = onboarding.indexOf("Ordner anlegen");
    expect(warnung).toBeGreaterThanOrEqual(0);
    expect(verweis, "der Warnblock nennt den Diagnosewaechter nicht").toBeGreaterThan(warnung);
    expect(verweis, "der Verweis steht nach dem ersten Einrichtungsschritt").toBeLessThan(ordner);
  });
});
