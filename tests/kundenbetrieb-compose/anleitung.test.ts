import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// ==================================================================================================
// B3 · K6 — DIE ANLEITUNG BESCHREIBT DEN WEG, DEN DAS SKRIPT FÄHRT. Gebunden, nicht abgeschrieben.
// ==================================================================================================
//
// Zwei Pflegeorte laufen auseinander, sobald einer sich ändert. Deshalb liest dieser Test beide:
// den Kopf von `scripts/backup/compose-drill.sh` (Exitcodes, Schritte) und die Anleitungen — und
// verlangt, dass sie übereinstimmen. Ein neuer Exitcode ohne Zeile in der Anleitung ist rot.
const root = resolve(import.meta.dirname, "../..");
const lies = (pfad: string) => readFileSync(resolve(root, pfad), "utf8");
const SKRIPT = lies("scripts/backup/compose-drill.sh");
const DRILL_DOC = lies("docs/operations/restore-drill.md");
const DR_DOC = lies("docs/operations/backup-disaster-recovery.md");

function abschnitt(text: string, ueberschrift: string): string {
  const start = text.indexOf(ueberschrift);
  expect(start, `Abschnitt „${ueberschrift}" fehlt`).toBeGreaterThan(-1);
  // Der Abschnitt endet an der nächsten Überschrift GLEICHER oder höherer Ebene — Kommentarzeilen
  // in Codeblöcken (`# 1. …`) sind keine Überschriften.
  const ebene = (/^#+/.exec(ueberschrift)?.[0] ?? "##").length;
  const zeilen = text.slice(start).split("\n");
  let imCode = false;
  let ende = zeilen.length;
  for (let i = 1; i < zeilen.length; i++) {
    const zeile = zeilen[i] ?? "";
    if (zeile.startsWith("```")) imCode = !imCode;
    if (!imCode && new RegExp(`^#{1,${ebene}} `).test(zeile)) {
      ende = i;
      break;
    }
  }
  return zeilen.slice(1, ende).join("\n");
}

it("A1 · die Exitcodes im Skriptkopf und in der Anleitung sind dieselben", () => {
  const kopf = SKRIPT.slice(SKRIPT.indexOf("# EXITCODES"), SKRIPT.indexOf("set -euo pipefail"));
  const imSkript = [...kopf.matchAll(/^#\s+(\d+)\s{2,}\S/gm)].map((m) => Number(m[1]));
  expect(imSkript).toContain(122);
  const tabelle = abschnitt(DRILL_DOC, "### Exitcodes von compose-drill.sh");
  const inDoku = [...tabelle.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
  expect(inDoku).toEqual(imSkript);
});

it("A2 · jeder Schritt des Skripts steht in der Anleitung", () => {
  const faelle = SKRIPT.slice(SKRIPT.lastIndexOf('case "$SCHRITT" in'));
  const schritte = [...faelle.matchAll(/^ {2}([a-z]+)\) schritt_/gm)].map((m) => m[1]);
  expect(schritte).toEqual([
    "werkzeug",
    "bestand",
    "vergleichen",
    "sichern",
    "wiederherstellen",
    "aktualisieren",
    "neustart",
    "pruefen",
    "gegenprobe",
    "rueckweg",
    "sicherung",
    "auslagern",
    "taeglich",
    "zurueckspielen",
    "ablauf",
  ]);
  const compose = abschnitt(DRILL_DOC, "## Compose-Kundeninstanz");
  for (const s of schritte.filter((s) => s !== "werkzeug" && s !== "vergleichen")) {
    expect(compose, s).toContain(`\`${s}\``);
  }
});

it("A3 · beide Anleitungen nennen Sicherung ohne Kennwort, Herkunft, Zweitkopie, Übung, Ernstfall, Aktualisierung und Rückweg", () => {
  for (const [name, doc] of [
    ["restore-drill.md", abschnitt(DRILL_DOC, "## Compose-Kundeninstanz")],
    ["backup-disaster-recovery.md", abschnitt(DR_DOC, "## 13. Compose-Kundeninstanz")],
  ] as const) {
    for (const muss of [
      "compose-drill.sh taeglich",
      "ZWEITER_ORT=",
      "DATABASE_URL=postgresql://klarwerk@db/klarwerk_prod",
      "BACKUP_KEEP",
      "scripts/backup/backup.sh",
      "herkunft.json",
      "instanz.id",
      "compose-drill.sh wiederherstellen",
      "compose-drill.sh zurueckspielen",
      "ZURUECKSPIELEN_BESTAETIGT=klarwerk_prod",
      "compose-drill.sh aktualisieren",
      "--no-deps",
      "rueckfall",
    ]) {
      expect(doc, `${name}: ${muss}`).toContain(muss);
    }
    // Die Adresse in der Anleitung trägt nie ein Kennwort.
    expect(doc).not.toMatch(/postgresql:\/\/klarwerk:[^@\s]+@db/);
  }
});

it("A4 · die Anleitung nennt, was NICHT gemessen ist, statt es zu verschweigen", () => {
  const compose = abschnitt(DRILL_DOC, "## Compose-Kundeninstanz");
  // Lauf 2 R3: lokal gefahren ist NICHT der Prüfplatz — die Anleitung sagt beides auseinander.
  expect(compose).toContain("Dieser Lauf ist auf upcloud25 (`pruefplatz-b3`) NICHT gefahren");
  expect(compose).toContain("nicht den Prüfplatz");
  expect(abschnitt(DR_DOC, "### 13.4")).toContain("noch nicht\ngefahren");
  expect(abschnitt(DR_DOC, "### 13.6")).toContain("liegt **nicht** vor");
  expect(abschnitt(DR_DOC, "### 13.6")).toContain("**keine** Zusage");
});

// ==================================================================================================
// LAUF 2 R3 · A7 — DER GEFAHRENE LOKALE COMPOSE-LAUF IST BELEGT, NICHT NUR BEHAUPTET.
// ==================================================================================================
//
// Die Anleitung (restore-drill.md E2) und §13.7 berufen sich auf den Lauf `b3-20260926T110706Z`.
// Dieser Test hält die Archive gegen ihre Prüfsummen und liest aus dem Archiv selbst, was die
// Anleitung behauptet: `ablauf` exit 0, jeder Schritt 0, und die K1/K5-Kernzahlen.
const BELEGE = "docs/operations/b3-belege/lokal-docker-20260926";
function ausArchiv(archiv: string, datei: string): string {
  const r = spawnSync("tar", ["-xOzf", resolve(root, BELEGE, archiv), `./${datei}`], {
    encoding: "utf8",
  });
  expect(r.status, r.stderr).toBe(0);
  return r.stdout;
}

it("A7 · die Belegarchive passen zu SHA256SUMS, und der grüne Lauf sagt selbst exit 0", () => {
  const summen = lies(`${BELEGE}/SHA256SUMS`).trim().split("\n");
  expect(summen).toHaveLength(2);
  for (const zeile of summen) {
    const [soll, name] = zeile.split(/\s+/);
    const ist = createHash("sha256")
      .update(readFileSync(resolve(root, BELEGE, String(name))))
      .digest("hex");
    expect(ist, String(name)).toBe(soll);
  }
  const gruen = "lauf2-20260926T110706Z-gruen.tar.gz";
  const ablauf = JSON.parse(ausArchiv(gruen, "b3-20260926T110706Z-ablauf.json"));
  expect(ablauf.exit).toBe(0);
  expect(ablauf.instanz_stand_zu_beginn).not.toBe(ablauf.instanz_stand);
  const schritte = ablauf.schritte as { schritt: string; exit: number }[];
  expect(schritte.map((x) => x.schritt)).toEqual([
    "bestand",
    "aktualisieren",
    "neustart",
    "sichern",
    "wiederherstellen",
    "pruefen",
    "gegenprobe",
    "zurueckspielen",
    "taeglich",
    "rueckweg",
  ]);
  for (const x of schritte) expect(x.exit, x.schritt).toBe(0);

  const sichern = JSON.parse(ausArchiv(gruen, "b3-20260926T110706Z-sichern.json"));
  expect(sichern.anzahl_danach).toBe(2);
  expect(sichern.kennwort_im_log).toBe("nein");
  const gegen = JSON.parse(ausArchiv(gruen, "b3-20260926T110706Z-gegenprobe.json"));
  const faelle = gegen.faelle as { erwartet: number; gemessen: number }[];
  for (const f of faelle) expect(f.gemessen).toBe(f.erwartet);
  expect(faelle.map((f) => f.erwartet)).toEqual([11, 22, 130, 161, 161]);
  const integration = JSON.parse(ausArchiv(gruen, "b3-20260926T110706Z-pruefen-integration.json"));
  expect(integration.numFailedTests).toBe(0);
  expect(integration.numPendingTests).toBe(0);
  expect(integration.numPassedTests).toBeGreaterThanOrEqual(4);

  // Und der erste Lauf bleibt als Beleg des Befunds stehen: 140 in `pruefen`, Drill-Ende 80.
  const rot = JSON.parse(
    ausArchiv("lauf1-20260926T105944Z-ohne-init.tar.gz", "b3-20260926T105944Z-ablauf.json"),
  );
  expect(rot.exit).toBe(140);
});

it("A5 · B1: der Ernstfall steht als geprüfter Schritt da, nicht als Befehlsfolge ohne Abbruch", () => {
  for (const doc of [abschnitt(DR_DOC, "### 13.4"), abschnitt(DRILL_DOC, "### C · Ernstfall")]) {
    expect(doc).toContain("compose-drill.sh zurueckspielen");
    // Kein abtippbares Umbenennen/createdb/pg_restore gegen klarwerk_prod ausserhalb des Schritts.
    expect(doc).not.toMatch(/exec -T db createdb/);
    expect(doc).not.toMatch(/pg_restore[^\n]*-d klarwerk_prod[^\n]*</);
  }
});

it("A6 · B5: die Prüfplatz-Befehlsfolge nennt die Compose-Dateien, mit denen `hochfahren` startet", () => {
  const e = abschnitt(DRILL_DOC, "### E · Der Prüfplatz-Lauf");
  expect(e).toContain(
    'COMPOSE_DATEIEN="docker-compose.prod.yml docker-compose.pruefplatz.override.yml"',
  );
  expect(e).toContain("OVERRIDE=docker-compose.pruefplatz-b3.override.yml");
  // … und erklärt, warum beides zusammengehört (PRUEFPLATZ-B.sh vorbereiten kopiert OVERRIDE unter diesen Namen).
  expect(e).toContain("zusätzlich unter dem Namen");
});
