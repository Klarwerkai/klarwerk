// R-0779 — DER DOPPELKLICK-STARTER BESTÄTIGT DIE VERSION DES LAUFENDEN SERVERS.
//
// Befund aus der Prüfung (Ben, Kandidat 09a1e475): beide Starter meldeten die Nummer aus
// `apps/web/src/version.ts` und prüften an `/health` nur `status: ok`. Ein alter Prozess auf dem Port
// hätte denselben Text erzeugt. Gemessen wird hier der echte Baustein
// `scripts/local/laufende-version.mjs` als eigener Prozess gegen einen echten HTTP-Server — und dass
// beide Starter ihn benutzen, statt die Quellversion als bestätigt auszugeben.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { type HealthServer, fahreNode, freieAdresse, healthServer } from "./hilfen";

const BAUSTEIN = repoPfad("scripts/local/laufende-version.mjs");
const LOKAL = readFileSync(repoPfad("scripts/local/klarwerk-lokal-starten.command"), "utf8");
const APP = readFileSync(
  repoPfad("desktop-app/KLARWERK App.app/Contents/MacOS/KLARWERK_App"),
  "utf8",
);

let server: HealthServer | undefined;
afterEach(async () => {
  await server?.schliessen();
  server = undefined;
});

describe("R-0779 · laufende Version statt Quellversion", () => {
  it("V1 · gleiche Version: Exit 0, stdout ist die vom Server gemeldete Version", async () => {
    server = await healthServer(() => ({ status: "ok", version: "1.0.0-beta.1.760", commit: "x" }));
    const lauf = await fahreNode([BAUSTEIN, `${server.adresse}/health`, "1.0.0-beta.1.760"]);
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(lauf.stdout).toBe("1.0.0-beta.1.760\n");
  });

  it("V2 · der Server fährt eine andere Version: Exit 3, die laufende wird genannt", async () => {
    server = await healthServer(() => ({ status: "ok", version: "1.0.0-beta.1.700" }));
    const lauf = await fahreNode([BAUSTEIN, `${server.adresse}/health`, "1.0.0-beta.1.760"]);
    expect(lauf.code).toBe(3);
    expect(lauf.stdout).toBe("1.0.0-beta.1.700\n");
    expect(lauf.stderr).toContain("erwartet 1.0.0-beta.1.760, laufend 1.0.0-beta.1.700");
  });

  it("V3 · ohne Version oder ohne status ok gibt es keine Bestätigung (Exit 2)", async () => {
    server = await healthServer(() => ({ status: "ok" }));
    const ohneVersion = await fahreNode([BAUSTEIN, `${server.adresse}/health`, "1.0.0"]);
    expect(ohneVersion.code).toBe(2);
    expect(ohneVersion.stdout).toBe("");
    await server.schliessen();
    server = await healthServer(() => ({ status: "fehler", version: "1.0.0" }));
    const krank = await fahreNode([BAUSTEIN, `${server.adresse}/health`, "1.0.0"]);
    expect(krank.code).toBe(2);
  });

  it("V4 · nicht erreichbar: Exit 2, keine Version auf stdout", async () => {
    const lauf = await fahreNode([BAUSTEIN, `${await freieAdresse()}/health`, "1.0.0"]);
    expect(lauf.code).toBe(2);
    expect(lauf.stdout).toBe("");
    expect(lauf.stderr).toContain("nicht erreichbar");
  });

  it("V5 · klarwerk-lokal-starten.command bestätigt die Antwort des Servers", () => {
    expect(LOKAL).toContain(
      'node scripts/local/laufende-version.mjs "http://localhost:${PORT}/health" "${VERSION:-}"',
    );
    expect(LOKAL).toContain("(laufende Version ${LAUFEND}, vom Server bestätigt)");
    expect(LOKAL).toContain('elif [ "$RC" = "3" ]; then');
    // Die Quellversion allein gilt nicht mehr als Bestätigung.
    expect(LOKAL).not.toContain("(Version ${VERSION:-?})");
  });

  it("V6 · die Schreibtisch-App bestätigt an beiden Stellen die laufende Version", () => {
    expect(APP).toContain('"$REPO/scripts/local/laufende-version.mjs"');
    const treffer = APP.match(/LAUFEND="\$\(laufende_version "\$(?:OLD_)?PORT"\)" \|\| LRC=\$\?/g);
    expect(treffer ?? []).toHaveLength(2);
    expect(APP).toContain('confirm "Läuft bereits: Version $LAUFEND (vom Server bestätigt)');
    expect(APP).toContain('confirm "Gestartet: Version $LAUFEND (vom Server bestätigt)');
    expect(APP).not.toMatch(/confirm "(Läuft bereits|Gestartet): Version \$VER/);
    // Eine Abweichung wird sichtbar, nicht als „gestartet" verbucht.
    expect(APP).toContain('elif [ "$LRC" = "3" ]; then');
    expect(APP).toMatch(/warn "Gestartet, aber der Server meldet Version \$LAUFEND statt \$VER/);
  });
});
