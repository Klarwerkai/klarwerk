import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// ================================================================================================
// JOB 943 / D2 — DER CWD-WÄCHTER (BEN D1: PRODUKT ROT).
// ================================================================================================
//
// DER BEFUND AUS I14: „Kein Kopf-Befehl ohne cd." Ein Befehl, der ein relatives Verzeichnis
// annimmt und im falschen Ordner startet, arbeitet still am falschen Bestand.
//
// BENS KORREKTURPFLICHT 2, und sie ist der Kern dieses Durchgangs:
//   „Cwd-Abhaengigkeit SEMANTISCH statt ueber das blosse Fehlen von `cd` bestimmen; erwarteter
//    Beleg: `klarwerk-live-update.command` und `seed-sim-corpus` korrekt als cwd-unabhaengig
//    behandeln oder mit einer konkreten cwd-abhaengigen Operation widerlegen."
//
// D1 hatte beide als „laeuft, wo man es startet" eingestuft. Nachgemessen ist das falsch: keiner
// der beiden fuehrt eine relative Pfadoperation aus — `seed-sim-corpus` arbeitet ausschliesslich
// gegen `KLARWERK_BACKEND_URL`, der Desktopstarter gegen feste URLs und Systemwerkzeuge.
//
// DIE REGEL DES WAECHTERS, in einem Satz:
//   Ein ausfuehrender Weg ist cwd-ABHAENGIG, wenn er eine KONKRETE relative Pfadoperation
//   ausfuehrt. Fehlt eine solche, ist er cwd-UNABHAENGIG — unabhaengig davon, ob `cd` vorkommt.
//   Fuehrt er eine aus, muss er sich vorher verankern ODER eine maschinenlesbare Ausnahme tragen.
// ================================================================================================

const WAECHTER = join(__dirname, "..", "..", "tools", "check-cwd-contract.mjs");
const REPO = join(__dirname, "..", "..");

interface Lauf {
  code: number;
  aus: string;
}

/** Faehrt den Waechter gegen ein Wurzelverzeichnis. Wirft nie — der Exitcode IST das Ergebnis. */
function waechter(wurzel: string, ...args: string[]): Lauf {
  try {
    const aus = execFileSync("node", [WAECHTER, "--wurzel", wurzel, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, aus };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return { code: e.status ?? -1, aus: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

let sandkasten: string;

beforeEach(() => {
  sandkasten = mkdtempSync(join(tmpdir(), "cwd-vertrag-"));
});

afterEach(() => {
  rmSync(sandkasten, { recursive: true, force: true });
});

/** Legt eine Wurzel mit den beiden Markern an, die der Vertrag verlangt. */
function echteWurzel(name = "repo"): string {
  const w = join(sandkasten, name);
  mkdirSync(join(w, "tools"), { recursive: true });
  mkdirSync(join(w, ".git"), { recursive: true });
  writeFileSync(join(w, "package.json"), '{"name":"probe"}\n');
  return w;
}

function skript(wurzel: string, name: string, inhalt: string): void {
  writeFileSync(join(wurzel, "tools", name), inhalt);
}

describe("JOB 943/D2 · der cwd-Waechter erkennt relative Ausfuehrung semantisch", () => {
  // ----------------------------------------------------------------------------------------------
  // A · DIE WURZELVALIDIERUNG — fail-closed, mit sichtbarer Erwartung
  // ----------------------------------------------------------------------------------------------

  it("A1 · eine Wurzel mit `package.json` UND `.git` wird angenommen", () => {
    const w = echteWurzel();
    skript(w, "harmlos", "#!/usr/bin/env bash\ncurl -fsS https://example.invalid/x\n");
    const lauf = waechter(w);
    expect(lauf.code, `Waechter lehnte eine gueltige Wurzel ab:\n${lauf.aus}`).toBe(0);
  });

  it("A2 · ein GLEICHNAMIGES Verzeichnis ohne Marker wird fail-closed abgelehnt", () => {
    // Der Fall, den BEN ausdruecklich verlangt: derselbe Name, die falsche Wurzel.
    const falsch = join(sandkasten, "repo");
    mkdirSync(join(falsch, "tools"), { recursive: true });
    const lauf = waechter(falsch);
    expect(lauf.code, "eine markerlose Wurzel wurde angenommen").not.toBe(0);
    expect(lauf.aus, "die Meldung nennt die erwartete Wurzel nicht").toMatch(/erwartet/i);
    expect(lauf.aus, "die Meldung nennt die gefundene Wurzel nicht").toMatch(/gefunden/i);
  });

  it("A3 · `package.json` ohne `.git` genuegt NICHT", () => {
    const halb = join(sandkasten, "halb");
    mkdirSync(join(halb, "tools"), { recursive: true });
    writeFileSync(join(halb, "package.json"), '{"name":"probe"}\n');
    expect(waechter(halb).code, "eine halbe Wurzel wurde angenommen").not.toBe(0);
  });

  it("A4 · eine nicht existierende Wurzel endet fail-closed, nicht still gruen", () => {
    const lauf = waechter(join(sandkasten, "gibtesnicht"));
    expect(lauf.code, "ein fehlendes Verzeichnis lief gruen durch").not.toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // B · DIE FIXTURE-MATRIX — Shell, Node, Paket, Desktopstarter, je Positiv und Negativ
  // ----------------------------------------------------------------------------------------------

  it("B1 · SHELL: relative Ausfuehrung OHNE Verankerung ist ein Befund", () => {
    const w = echteWurzel();
    skript(w, "unverankert", "#!/usr/bin/env bash\n./tools/build\n");
    const lauf = waechter(w);
    expect(lauf.code, "ein unverankerter relativer Aufruf blieb gruen").not.toBe(0);
    expect(lauf.aus).toMatch(/unverankert/);
  });

  it('B2 · SHELL: dieselbe Ausfuehrung MIT `cd "$(dirname "$0")/.."` ist in Ordnung', () => {
    const w = echteWurzel();
    skript(w, "verankert", '#!/usr/bin/env bash\ncd "$(dirname "$0")/.."\n./tools/build\n');
    expect(waechter(w).code, "ein verankerter Weg wurde als Befund gemeldet").toBe(0);
  });

  it("B3 · SHELL: `git -C` und absolute Pfade sind keine relative Operation", () => {
    const w = echteWurzel();
    skript(w, "absolut", "#!/usr/bin/env bash\ngit -C /opt/x status\n/usr/bin/env node -e ''\n");
    expect(waechter(w).code).toBe(0);
  });

  it("B4 · NODE: relatives `execFile` ohne Verankerung ist ein Befund", () => {
    const w = echteWurzel();
    skript(
      w,
      "knoten.mjs",
      'import {execFileSync} from "node:child_process";\nexecFileSync("./tools/build");\n',
    );
    expect(waechter(w).code, "relatives execFile blieb gruen").not.toBe(0);
  });

  it("B5 · PAKET: ein npm-Aufruf ohne relative Operation ist kein Befund", () => {
    const w = echteWurzel();
    skript(w, "paket", "#!/usr/bin/env bash\nnpm run --silent build\n");
    expect(waechter(w).code, "ein reiner Paketaufruf wurde gemeldet").toBe(0);
  });

  it("B6 · DESKTOP: ein Starter ohne relative Operation ist kein Befund", () => {
    const w = echteWurzel();
    skript(
      w,
      "starter.command",
      '#!/usr/bin/env bash\ncurl -fsS "https://example.invalid/deploy"\n',
    );
    expect(waechter(w).code, "ein cwd-unabhaengiger Starter wurde gemeldet").toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // C · DIE MASCHINENLESBARE AUSNAHME
  // ----------------------------------------------------------------------------------------------

  it("C1 · ein deklariert cwd-unabhaengiger Weg bleibt gruen, auch mit relativer Erwaehnung", () => {
    const w = echteWurzel();
    skript(
      w,
      "erklaert",
      "#!/usr/bin/env bash\n# cwd-unabhaengig: arbeitet nur gegen KLARWERK_BACKEND_URL\n./nur-erwaehnt\n",
    );
    expect(waechter(w).code, "die Ausnahme wurde nicht anerkannt").toBe(0);
  });

  it("C2 · die Ausnahme ohne Begruendung zaehlt NICHT", () => {
    // Sonst waere sie ein Freibrief, den man gedankenlos anhaengt.
    const w = echteWurzel();
    skript(w, "leer", "#!/usr/bin/env bash\n# cwd-unabhaengig:\n./tools/build\n");
    expect(waechter(w).code, "eine begruendungslose Ausnahme wurde anerkannt").not.toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // D · DIE KALIBRIERUNG AM ECHTEN BESTAND — die drei vom Auftrag benannten Faelle
  // ----------------------------------------------------------------------------------------------

  it("D1 · POSITIVKALIBRIERUNG: `tools/check` gilt als verankert", () => {
    // Der Auftrag verlangt „Kalibriere `tools/check` positiv" — also die Einstufung DIESES Weges,
    // nicht die Grünfärbung des ganzen Bestands. `tools/check:4` traegt
    // `cd "$(dirname "$0")/.."` und ist damit der Musterfall der Verankerung.
    const lauf = waechter(REPO, "--erklaere");
    expect(lauf.aus).toMatch(/tools\/check\s+·\s+verankert/);
  });

  it("D4 · der ECHTE Bestand traegt den Vertrag — kein unverankerter Weg mehr", () => {
    // ZUSAGE NACHGEZOGEN am 15.08.2026 vom Chef, wie es dieser Fall selbst vorsah: „Faellt dieser
    // Fall, ist der Befund erledigt — dann gehoert die Zusage nachgezogen, nicht der Waechter
    // entschaerft."
    //
    // Der Befund war echt: `scripts/backup/backup.sh` setzte `DEST="${1:-${BACKUP_DIR:-./backups}}"`.
    // Das Sicherungsziel haengte am Startverzeichnis — wer das Skript aus Cron, Coolify oder einem
    // beliebigen Terminal startete, legte sein Backup anderswo ab und bekam trotzdem „fertig"
    // gemeldet. Bei einer Sicherung ist das die gefaehrlichste Sorte Fehler: Man glaubt, eine zu
    // haben. Behoben durch Ableiten der Wurzel aus dem Skriptpfad (kein `cd`, damit ein relativ
    // uebergebenes Ziel weiter so aufgeloest wird wie bisher).
    //
    // WAS DIESER FALL JETZT LEISTET: Er haelt den Bestand sauber. Zieht jemand kuenftig einen
    // unverankerten Weg ein, wird er hier rot — der Waechter selbst bleibt scharf, was D3 an einem
    // eigens gebauten Fall beweist. Diese beiden Faelle zusammen sind der Ersatz fuer die alte
    // Zusage: D3 belegt, dass der Waechter beisst, D4, dass es nichts zu beissen gibt.
    const lauf = waechter(REPO);
    expect(lauf.code, "unverankerter Weg im Bestand — siehe Ausgabe").toBe(0);
    expect(lauf.aus).toMatch(/unverankert 0/);
  });

  it("D2 · `seed-sim-corpus` und `klarwerk-live-update.command` gelten als cwd-UNABHAENGIG", () => {
    // BENS KORREKTURPFLICHT 2, woertlich gepinnt. Nachgemessen: keiner der beiden fuehrt eine
    // relative Pfadoperation aus. Wuerde der Waechter sie melden, waere er zu grob.
    const lauf = waechter(REPO, "--erklaere");
    expect(lauf.aus).toMatch(/seed-sim-corpus\s+·\s+unabhaengig/);
    expect(lauf.aus).toMatch(/klarwerk-live-update\.command\s+·\s+unabhaengig/);
  });

  it("D3 · die Bilanz geht auf: geprueft = verankert + unabhaengig + ausgenommen", () => {
    // BENS KORREKTURPFLICHT 1: „genau eine Pfadliste, deren Klassen und Summen dieselbe
    // Gesamtzahl ergeben." Eine Zahl, die nicht aufgeht, war D1s schwerster Formfehler.
    const lauf = waechter(REPO, "--erklaere");
    const zahl = (feld: string): number => {
      const t = new RegExp(`${feld}\\s+(\\d+)`).exec(lauf.aus);
      if (!t) {
        throw new Error(`Bilanzfeld ${feld} fehlt in der Ausgabe:\n${lauf.aus}`);
      }
      return Number(t[1]);
    };
    expect(
      zahl("verankert") + zahl("unabhaengig") + zahl("ausgenommen") + zahl("unverankert"),
      "die Klassensummen ergeben nicht die Gesamtzahl — genau D1s schwerster Formfehler",
    ).toBe(zahl("geprueft"));
  });
});
