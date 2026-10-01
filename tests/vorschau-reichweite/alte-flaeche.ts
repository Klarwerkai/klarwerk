// ================================================================================================
// AUFNAHME 20260922 · VORSCHAU-REICHWEITE — DIE ALTE FLÄCHE FÜR DIE RÜCKNAHME (K4-R).
// ================================================================================================
//
// WARUM KEIN GIT-STAND MEHR (Ben, Lauf 6 Runde 2, Befund P1). K4-R baute die alte Fläche aus dem
// Elter des Commits, der `apps/web/src/texte/vorschau.ts` anlegt. Der Prüfbaum auf dem Server ist
// ein flacher Checkout ohne Vorgeschichte: `git show <stand>^:…` scheiterte mit „invalid object
// name", K4-R brach nach 9 ms ab, bevor irgendetwas gemessen war.
//
// JETZT: die Rücknahme liegt als Datei im Repository — `alte-flaeche.patch` ist die Umkehrung
// GENAU DIESER Änderung an der Fläche (die acht Produktdateien unter `apps/web/src`, Tests nicht).
// Sie wird auf eine Kopie des AKTUELLEN `apps/web` angewandt. Das ergibt das alte Verhalten auf dem
// heutigen Stand: alles andere bleibt gleich, nur diese Änderung ist zurückgenommen. Dafür braucht
// es nur `git apply` (arbeitet ohne Repository), keine Vorgeschichte.
//
// WÄCHTER: Nach dem Anwenden muss die Kopie wirklich alt sein (kein Vorschau-Modul, die alten
// Neuheitsschlüssel wieder in Blatt und LiveReactionZone), und der Arbeitsbaum muss wirklich neu
// sein. Sonst liefe die Rücknahme gegen das Neue. Passt die Umkehrung nicht mehr auf den heutigen
// Stand, scheitert `git apply` laut — `alte-flaeche.test.ts` meldet das schon im normalen Testlauf.
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, readFileSync, symlinkSync } from "node:fs";
import { join, relative, sep } from "node:path";

const WURZEL = join(__dirname, "..", "..");
const PATCH = join(__dirname, "alte-flaeche.patch");

const BLATT = "apps/web/src/components/erfassen/Blatt.tsx";
const ZONE = "apps/web/src/components/capture/intake/LiveReactionZone.tsx";
const VORSCHAU_MODUL = "apps/web/src/lib/vorschauUmfang";
const TEXTMODUL = "apps/web/src/texte/vorschau.ts";

/** Was nicht in die Kopie gehört: Abhängigkeiten (werden verlinkt) und gebaute Stände. */
function mitnehmen(quelle: string): boolean {
  const teile = relative(join(WURZEL, "apps/web"), quelle).split(sep);
  return !teile.some((t) => t === "node_modules" || t === "dist" || t.startsWith("dist-"));
}

function wache(bedingung: boolean, meldung: string): void {
  if (!bedingung) {
    throw new Error(`[KLARWERK] VORSCHAU-REICHWEITE · alte Fläche: ${meldung}`);
  }
}

/**
 * Legt `ziel/apps/web` als Kopie des aktuellen `apps/web` an und nimmt darin diese Änderung zurück.
 * Wirft, wenn die Umkehrung nicht passt oder das Ergebnis nicht der alte Stand ist.
 */
export function bereiteAlteQuelle(ziel: string): void {
  const jetzt = readFileSync(join(WURZEL, BLATT), "utf8");
  wache(
    jetzt.includes("vorschauUmfang") && existsSync(join(WURZEL, TEXTMODUL)),
    "der Arbeitsbaum trägt die Vorschau-Änderung nicht — es gäbe nichts zurückzunehmen.",
  );
  cpSync(join(WURZEL, "apps/web"), join(ziel, "apps/web"), { recursive: true, filter: mitnehmen });
  execFileSync("git", ["apply", "--whitespace=nowarn", PATCH], {
    cwd: ziel,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const blatt = readFileSync(join(ziel, BLATT), "utf8");
  const zone = readFileSync(join(ziel, ZONE), "utf8");
  wache(!existsSync(join(ziel, TEXTMODUL)), "das Textmodul der Vorschau ist noch da.");
  wache(!existsSync(join(ziel, `${VORSCHAU_MODUL}.ts`)), "vorschauUmfang.ts ist noch da.");
  wache(
    !blatt.includes("vorschauUmfang") && blatt.includes('"erfassen.live.neu"'),
    "Blatt.tsx ist nicht der alte Stand.",
  );
  wache(
    !zone.includes("vorschauUmfang") && zone.includes('"intake.live.new"'),
    "LiveReactionZone.tsx ist nicht der alte Stand.",
  );
}

/** Baut die alte Fläche mit demselben `vite build` wie die aktuelle; liefert das Ausgabeverzeichnis. */
export function baueAlteFlaeche(ziel: string): string {
  bereiteAlteQuelle(ziel);
  const web = join(ziel, "apps/web");
  // Die Abhängigkeiten sind dieselben Pakete wie im Arbeitsbaum — verlinkt, nicht neu installiert.
  symlinkSync(join(WURZEL, "apps/web/node_modules"), join(web, "node_modules"), "dir");
  symlinkSync(join(WURZEL, "node_modules"), join(ziel, "node_modules"), "dir");
  const dist = join(ziel, "dist-alt");
  execFileSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], {
    cwd: web,
    stdio: "pipe",
    timeout: 900_000,
  });
  wache(existsSync(join(dist, "index.html")), `gebaut, aber ${dist}/index.html fehlt.`);
  return dist;
}
