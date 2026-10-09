// ================================================================================================
// K5 · DIE GEGENPROBE GEGEN bf9fcf1c — DER ALTE STAND, OHNE GIT-VORGESCHICHTE HERGESTELLT.
// ================================================================================================
//
// Auftrag arbeit:erfassen-doppelklick-entscheidungen-20261001, Kriterium 5: „Die neuen Tests für die
// Kriterien 1 und 3 sind gegen bf9fcf1c rot und auf der neuen Fassung grün."
//
// WARUM KEIN `git checkout bf9fcf1c`: Der Prüfbaum auf dem Server ist ein flacher Checkout ohne
// Vorgeschichte (dieselbe Lage wie bei der Vorschau-Reichweite, Ben-Befund P1, s.
// `tests/vorschau-reichweite/alte-flaeche.ts`). Und ein voller Stand von bf9fcf1c passte nicht zu
// den heutigen Tests und Hilfen (Wörterbücher, Hülle, Attrappen sind seither gewachsen).
//
// WAS STATTDESSEN GESCHIEHT: `gegenprobe-bf9fcf1c.patch` ist die Umkehrung GENAU DIESER Änderung
// an den neun Produktdateien (erzeugt mit `git diff aec4f50e0 13bf9f2bd -- <Dateien>`). Sie wird auf
// eine Kopie des aktuellen Baums angewandt; die TESTS bleiben die neuen. Das ergibt das Verhalten
// von bf9fcf1c auf den betroffenen Wegen, und zwar belegbar:
//   · `apps/web/src/lib/createOperation.ts` (Schlüsselvergabe `anlageVorgangFuer`) ist danach
//     BYTEGLEICH mit bf9fcf1c — geprüft über die Git-Blob-Kennung (`BF9FCF1C_CREATE_OPERATION`).
//   · In Capture.tsx, service.ts und capture-routes.ts hat zwischen bf9fcf1c und der Basis
//     13bf9f2bd niemand die Anlage-/Wiederholwege berührt (Abgleich `git diff bf9fcf1c 13bf9f2bd`:
//     dort kam nur der Word-Transport `dokumentId` dazu). Die Wächter unten sichern, dass die
//     Kopie die alten Wege trägt und keine Spur der neuen.
// Dafür braucht es nur `git apply` (arbeitet ohne Repository) und denselben Vitest wie im Tor.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, readFileSync, readdirSync, realpathSync, symlinkSync } from "node:fs";
import { basename, join, relative, sep } from "node:path";

export const WURZEL = join(__dirname, "..", "..");
const PATCH = join(__dirname, "gegenprobe-bf9fcf1c.patch");

/** Git-Blob-Kennung von `apps/web/src/lib/createOperation.ts` in bf9fcf1c (= in 13bf9f2bd). */
export const BF9FCF1C_CREATE_OPERATION = "177430c63ae229022544dcea66a09dd2323f46fa";

const CREATE_OPERATION = "apps/web/src/lib/createOperation.ts";
const CAPTURE = "apps/web/src/pages/Capture.tsx";
const DIENST = "services/capture/src/service.ts";
const ROUTE = "services/app/src/routes/capture-routes.ts";
const DE = "apps/web/src/woerterbuch/de.ts";

/** Dieselbe Rechnung wie `git hash-object`. */
export function blobKennung(inhalt: Buffer): string {
  return createHash("sha1")
    .update(Buffer.concat([Buffer.from(`blob ${inhalt.length}\0`), inhalt]))
    .digest("hex");
}

function wache(bedingung: boolean, meldung: string): void {
  if (!bedingung) {
    throw new Error(`[KLARWERK] K5 · Gegenprobe bf9fcf1c: ${meldung}`);
  }
}

/** Abhängigkeiten werden verlinkt, gebaute Stände und Caches nicht mitgenommen. */
const NICHT_KOPIEREN = new Set(["node_modules", ".git", ".local", "coverage", "test-results"]);

function mitnehmen(quelle: string): boolean {
  const name = basename(quelle);
  return !NICHT_KOPIEREN.has(name) && name !== "dist" && !name.startsWith("dist-");
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
      if (eintrag.isDirectory() && tiefe < 3 && mitnehmen(pfad)) {
        gehe(pfad, tiefe + 1);
      }
    }
  };
  gehe(WURZEL, 0);
  return orte;
}

/**
 * Legt in `ziel` eine Kopie des Arbeitsbaums an und nimmt darin diese Änderung zurück. Wirft, wenn
 * der Arbeitsbaum die Änderung nicht trägt, die Umkehrung nicht passt oder das Ergebnis nicht der
 * Stand von bf9fcf1c auf den betroffenen Wegen ist.
 */
export function bereiteAltenStand(ziel: string): void {
  const jetzt = (pfad: string): string => readFileSync(join(WURZEL, pfad), "utf8");
  wache(
    jetzt(CREATE_OPERATION).includes("anlageVorgangWiederholen") &&
      jetzt(CAPTURE).includes("capture-bereits-gespeichert") &&
      jetzt(DIENST).includes("anlageFortschreiben"),
    "der Arbeitsbaum trägt die Änderung nicht — es gäbe nichts zurückzunehmen.",
  );
  cpSync(WURZEL, ziel, { recursive: true, filter: mitnehmen });
  for (const ort of abhaengigkeitsOrte()) {
    if (!existsSync(join(ziel, ort))) {
      symlinkSync(join(WURZEL, ort), join(ziel, ort), "dir");
    }
  }
  execFileSync("git", ["apply", "--whitespace=nowarn", PATCH], {
    cwd: ziel,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const alt = (pfad: string): string => readFileSync(join(ziel, pfad), "utf8");
  wache(
    blobKennung(readFileSync(join(ziel, CREATE_OPERATION))) === BF9FCF1C_CREATE_OPERATION,
    `${CREATE_OPERATION} ist nach der Umkehrung nicht byte-gleich mit bf9fcf1c.`,
  );
  const capture = alt(CAPTURE);
  wache(
    capture.includes("anlageVorgangFuer(eintragVorgangRef.current, JSON.stringify(payload))") &&
      capture.includes("anlageVorgangFuer(null, JSON.stringify(payload))") &&
      !capture.includes("capture-bereits-gespeichert") &&
      !capture.includes("anlageVorgangWiederholen"),
    `${CAPTURE} ist nicht der alte Stand.`,
  );
  wache(
    !alt(DIENST).includes("anlageFortschreiben") && !alt(ROUTE).includes("rohFortschreiben"),
    "Dienst oder Route tragen noch das Fortschreiben.",
  );
  wache(!alt(DE).includes("capture.bereitsGespeichert"), "der Hinweistext steht noch da.");
}

/** Ein Fall des Unterlaufs, wie der JSON-Bericht von Vitest ihn nennt. */
export interface Fall {
  readonly datei: string;
  readonly titel: string;
  readonly status: string;
  readonly meldung: string;
}

/** Fährt die genannten Testdateien mit demselben Vitest in der Kopie; liefert jeden Fall. */
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
