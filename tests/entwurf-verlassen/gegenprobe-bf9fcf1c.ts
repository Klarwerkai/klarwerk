// ================================================================================================
// K5 · DIE GEGENPROBE GEGEN bf9fcf1c — DER TATSÄCHLICHE PRODUKTSTAND, COMMITGEBUNDEN.
// ================================================================================================
//
// Auftrag arbeit:erfassen-doppelklick-entscheidungen-20261001, Kriterium 5: „Die neuen Tests für die
// Kriterien 1 und 3 sind gegen bf9fcf1c rot und auf der neuen Fassung grün."
//
// BEN, nacharbeit-5: Eine Rücknahme dieser Änderung auf dem heutigen Kandidaten ist NICHT bf9fcf1c —
// dort stehen spätere Änderungen anderer Aufträge in Capture.tsx, service.ts und capture-routes.ts.
// Verlangt ist der tatsächliche Produktstand. Deshalb jetzt:
//
// DAS QUELLARCHIV. `gegenprobe-bf9fcf1c-quellen.patch` enthält den VOLLSTÄNDIGEN Inhalt von
// `apps/web` und `services` aus bf9fcf1c, erzeugt aus dem leeren Baum:
//     git diff --binary --full-index 4b825dc642cb6eb9a060e54bf8d69288fbee4904 bf9fcf1c \
//       -- apps/web services
// Der Prüfbaum auf dem Server hat keine Vorgeschichte (Ben-Befund P1 der Vorschau-Reichweite), ein
// `git checkout bf9fcf1c` geht dort nicht — dieses Archiv braucht nur `git apply` (ohne Repository).
//
// DIE COMMITBINDUNG IST GERECHNET, NICHT BEHAUPTET. Nach dem Auspacken wird über `apps/web` und
// `services` der Git-Baum-Hash gebildet (dieselbe Rechnung wie Git: Blobs, Modi, Sortierung) und
// mit den Bäumen von bf9fcf1c verglichen (`git rev-parse bf9fcf1c:apps/web` / `:services`). Stimmt
// auch nur ein Byte, ein Modus oder eine Datei zu viel nicht, bricht die Gegenprobe ab. Der alte
// Produktcode wird dabei nicht angefasst.
//
// DIE TESTUMGEBUNG — DIE EINZIGEN ANPASSUNGEN, GETRENNT BENANNT:
//   1. `tests/` und die Wurzeldateien (vitest.config.ts, tests/setup-env.ts …) kommen vom
//      KANDIDATEN: sonst gäbe es die neuen Tests nicht. Seit bf9fcf1c unverändert sind dort
//      vitest.config.ts, tests/setup-env.ts und die Hülle `huelle.tsx`; geändert ist nur
//      `attrappen.ts` (durch diesen Auftrag: `anlage` in der Antwort, `fortschreiben`).
//   2. Die installierten Abhängigkeiten (`node_modules`) sind die des Kandidaten, verlinkt. Zwischen
//      bf9fcf1c und dem Kandidaten unterscheiden sich package.json (4 Zeilen) und package-lock.json
//      (58 Zeilen); apps/web/package.json ist gleich — und liegt ohnehin bf9fcf1c-gleich im Archiv.
// Alles andere — der gesamte Produktcode von Oberfläche und Diensten — ist bf9fcf1c.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  symlinkSync,
} from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";

export const WURZEL = join(__dirname, "..", "..");
const QUELLEN = join(__dirname, "gegenprobe-bf9fcf1c-quellen.patch");

/** Der Vergleichscommit, voll ausgeschrieben. */
export const VERGLEICHSCOMMIT = "bf9fcf1c9556b583efe6c606da822c1e94117b25";

/** Die Git-Bäume von bf9fcf1c für die beiden Produktordner (`git rev-parse bf9fcf1c:<ordner>`). */
export const BF9FCF1C_BAEUME: Readonly<Record<string, string>> = {
  "apps/web": "c43f603f85c4ae12ad131621763c1a1e499603e7",
  services: "e7e2ce80d6a400bf9550e0211747e9c68450724f",
};

/** Dieselbe Rechnung wie `git hash-object`. */
export function blobKennung(inhalt: Buffer): string {
  return gitObjekt("blob", inhalt).toString("hex");
}

function gitObjekt(art: "blob" | "tree", inhalt: Buffer): Buffer {
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`${art} ${inhalt.length}\0`), inhalt]))
    .digest();
}

/**
 * Der Git-Baum-Hash eines Ordners — Git-Regeln: Dateien 100644/100755, Symlinks 120000 (Inhalt =
 * Ziel), Ordner 40000, leere Ordner fehlen, Sortierung bytegenau mit „/" hinter Ordnernamen.
 * `node_modules` gehört nie zu einem Commit und wird übergangen (dort hängen die Verlinkungen).
 */
export function baumKennung(ordner: string): string {
  const kennung = baum(ordner);
  return kennung === null ? "" : kennung.toString("hex");
}

function baum(ordner: string): Buffer | null {
  const eintraege: { schluessel: string; zeile: Buffer }[] = [];
  for (const name of readdirSync(ordner)) {
    if (name === "node_modules") {
      continue;
    }
    const pfad = join(ordner, name);
    const art = lstatSync(pfad);
    let modus: string;
    let kennung: Buffer | null;
    if (art.isSymbolicLink()) {
      modus = "120000";
      kennung = gitObjekt("blob", Buffer.from(readlinkSync(pfad)));
    } else if (art.isDirectory()) {
      modus = "40000";
      kennung = baum(pfad);
    } else {
      modus = (art.mode & 0o111) !== 0 ? "100755" : "100644";
      kennung = gitObjekt("blob", readFileSync(pfad));
    }
    if (kennung === null) {
      continue;
    }
    eintraege.push({
      schluessel: art.isDirectory() ? `${name}/` : name,
      zeile: Buffer.concat([Buffer.from(`${modus} ${name}\0`), kennung]),
    });
  }
  if (eintraege.length === 0) {
    return null;
  }
  eintraege.sort((a, b) => Buffer.compare(Buffer.from(a.schluessel), Buffer.from(b.schluessel)));
  return gitObjekt("tree", Buffer.concat(eintraege.map((e) => e.zeile)));
}

function wache(bedingung: boolean, meldung: string): void {
  if (!bedingung) {
    throw new Error(`[KLARWERK] K5 · Gegenprobe bf9fcf1c: ${meldung}`);
  }
}

/** Abhängigkeiten werden verlinkt, gebaute Stände und Caches nicht mitgenommen. */
const NICHT_KOPIEREN = new Set(["node_modules", ".git", ".local", "coverage", "test-results"]);

function kopierbar(quelle: string): boolean {
  const name = basename(quelle);
  if (NICHT_KOPIEREN.has(name) || name === "dist" || name.startsWith("dist-")) {
    return false;
  }
  // Nur Ordner, Dateien und Symlinks. Ein Socket oder eine Pipe im Baum (laufende Dienste im
  // Prüfbaum) lässt `cpSync` mit „Unreachable code" in `getStats` abbrechen (Prüflauf
  // nacharbeit-4) — beides ist kein Quelltext und gehört nicht in die Kopie.
  const art = lstatSync(quelle);
  return art.isDirectory() || art.isFile() || art.isSymbolicLink();
}

/** Die Produktordner kommen NICHT vom Kandidaten, sondern aus dem Quellarchiv. */
function mitnehmen(quelle: string): boolean {
  const rel = relative(WURZEL, quelle).split(sep).join("/");
  if (Object.keys(BF9FCF1C_BAEUME).some((o) => rel === o || rel.startsWith(`${o}/`))) {
    return false;
  }
  return kopierbar(quelle);
}

/** Alle `node_modules` des Arbeitsbaums bis Tiefe 3 — sie werden in der Kopie verlinkt. */
function abhaengigkeitsOrte(): string[] {
  const orte: string[] = [];
  const gehe = (ordner: string, tiefe: number): void => {
    for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
      const pfad = join(ordner, eintrag.name);
      // `node_modules` ist in den Prüfbäumen oft selbst ein Symlink — beides zählt.
      const ordnerArtig = eintrag.isDirectory() || eintrag.isSymbolicLink();
      if (eintrag.name === "node_modules" && ordnerArtig) {
        orte.push(relative(WURZEL, pfad));
        continue;
      }
      if (eintrag.isDirectory() && tiefe < 3 && kopierbar(pfad)) {
        gehe(pfad, tiefe + 1);
      }
    }
  };
  gehe(WURZEL, 0);
  return orte;
}

/** Was die Herstellung über den alten Stand festgestellt hat — für den Beleg. */
export interface AlterStand {
  readonly commit: string;
  readonly baeume: Readonly<Record<string, string>>;
  readonly verlinkt: readonly string[];
}

/**
 * Legt in `ziel` den Prüfbaum an: Tests und Wurzeldateien vom Kandidaten, `apps/web` und `services`
 * aus dem Quellarchiv von bf9fcf1c. Wirft, wenn das Archiv nicht passt oder die Produktordner nicht
 * baumgleich mit bf9fcf1c sind.
 */
export function bereiteAltenStand(ziel: string): AlterStand {
  wache(existsSync(QUELLEN), `das Quellarchiv fehlt: ${QUELLEN}`);
  cpSync(WURZEL, ziel, { recursive: true, filter: mitnehmen });
  for (const ordner of Object.keys(BF9FCF1C_BAEUME)) {
    wache(!existsSync(join(ziel, ordner)), `${ordner} kam vom Kandidaten in den Prüfbaum.`);
  }
  execFileSync("git", ["apply", "--whitespace=nowarn", QUELLEN], {
    cwd: ziel,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // ERST prüfen, DANN verlinken: so kann keine Verlinkung den Baumvergleich berühren.
  const baeume: Record<string, string> = {};
  for (const [ordner, erwartet] of Object.entries(BF9FCF1C_BAEUME)) {
    baeume[ordner] = baumKennung(join(ziel, ordner));
    wache(
      baeume[ordner] === erwartet,
      `${ordner} ist nicht baumgleich mit ${VERGLEICHSCOMMIT}: ${baeume[ordner]} statt ${erwartet}.`,
    );
  }
  const verlinkt: string[] = [];
  for (const ort of abhaengigkeitsOrte()) {
    // Ein Abhängigkeitsort eines Pakets, das es in bf9fcf1c noch nicht gab, entfällt.
    if (!existsSync(join(ziel, ort)) && existsSync(join(ziel, dirname(ort)))) {
      symlinkSync(join(WURZEL, ort), join(ziel, ort), "dir");
      verlinkt.push(ort);
    }
  }
  return { commit: VERGLEICHSCOMMIT, baeume, verlinkt };
}

/** Ein Fall des Unterlaufs, wie der JSON-Bericht von Vitest ihn nennt. */
export interface Fall {
  readonly datei: string;
  readonly titel: string;
  readonly status: string;
  readonly meldung: string;
}

/** Fährt die genannten Testdateien mit demselben Vitest im Prüfbaum; liefert jeden Fall. */
export function fahreAlteTests(ziel: string, dateien: readonly string[]): Fall[] {
  const bericht = join(ziel, "gegenprobe-bericht.json");
  // Ohne `KLARWERK_TESTGRUPPE`: der Unterlauf sieht den ganzen Bestand (s. vitest.config.ts).
  const { KLARWERK_TESTGRUPPE: _gruppe, ...erbe } = process.env;
  const umgebung: NodeJS.ProcessEnv = { ...erbe, KLARWERK_SKIP_KEYCHAIN: "1" };
  const argumente = ["vitest", "run", "--reporter=json", `--outputFile=${bericht}`, ...dateien];
  const lauf = spawnSync("npx", argumente, {
    cwd: ziel,
    env: umgebung,
    encoding: "utf8",
    timeout: 900_000,
    maxBuffer: 64 * 1024 * 1024,
  });
  wache(
    existsSync(bericht),
    `der Unterlauf hat keinen Bericht geschrieben (Status ${lauf.status}, Signal ${lauf.signal}):\n${String(lauf.stderr).slice(-4000)}`,
  );
  const roh = JSON.parse(readFileSync(bericht, "utf8")) as {
    testResults: {
      name: string;
      message?: string;
      assertionResults: { title: string; status: string; failureMessages: string[] }[];
    }[];
  };
  const faelle: Fall[] = [];
  // Vitest berichtet echte Pfade; das Temp-Verzeichnis kann ein Symlink sein (macOS: /var → /private/var).
  const basis = realpathSync(ziel);
  for (const datei of roh.testResults) {
    const name = relative(basis, realpathSync(datei.name)).split(sep).join("/");
    wache(
      datei.assertionResults.length > 0,
      `${name} hat im alten Stand keinen einzigen Fall gesammelt: ${datei.message ?? "(keine Meldung)"}`,
    );
    for (const f of datei.assertionResults) {
      faelle.push({
        datei: name,
        titel: f.title,
        status: f.status,
        meldung: (f.failureMessages[0] ?? "").split("\n")[0] ?? "",
      });
    }
  }
  return faelle;
}
