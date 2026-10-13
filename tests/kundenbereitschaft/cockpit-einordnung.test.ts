// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KUNDENBEREITSCHAFT (R-1423, RECHERCHE:cockpit-schema) — DER ABGLEICH
// ZEIGT AUF BELEGTES.
// ================================================================================================
//
// `docs/qm/aufnahme-20260922-gesamt-kundenbereitschaft.md` ordnet das Ops-Cockpit v0.2.0 ein und
// grenzt es gegen den heutigen Produktbaum ab. Diese Datei hält fest:
//   · Z   jede Datei und jedes Verzeichnis, das das Dokument in diesem Baum nennt, liegt im Bestand;
//   · F   die tragenden Sätze stehen in der genannten Datei;
//   · A   das Cockpit liegt NICHT im Produkt — kein Ordner, keine Desktop-App, kein Datenvertrag.
//         Wird es (oder ein Nachbau) eingeführt, muss der Abgleich neu geschrieben werden, statt
//         still zu veralten.
//
// WAS DIESE DATEI NICHT BELEGT: das Verhalten des Cockpits (K2). Dessen Quelltext liegt in einem
// anderen Repository.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOKUMENT = "docs/qm/aufnahme-20260922-gesamt-kundenbereitschaft.md";

const lies = (pfad: string): string => readFileSync(pfad, "utf8");

const PFADANGABE = /`((?:services|tests|apps|docs|scripts|tools)\/[^`\s]*)`/g;

function genanntePfade(): string[] {
  const pfade = new Set<string>();
  for (const treffer of lies(DOKUMENT).matchAll(PFADANGABE)) {
    pfade.add(treffer[1] ?? "");
  }
  return [...pfade].sort();
}

// Datei → was das Dokument dort verortet. Wörtliche Zeichenfolgen, keine Zeilennummern.
const FUNDSTELLEN: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "docs/qm/claude-after-report.md",
    [
      "KBB-115: Ops-Cockpit v0.2.0 (Überblick + Server-Reife + Statusbericht)",
      "klarwerk-business-backend/cockpit, Commit 25dbe92",
      "klarwerk-business-backend 25dbe92 lokal — **kein Push**",
      "Team 3: Ops-Cockpit v0 + Desktop-App",
      "klarwerk-business-backend `1c5717e`",
    ],
  ],
  [
    "docs/qm/BOSS_SESSION_STAND_2026-07-02.md",
    ["| Ops-Cockpit (Team 3) | v0.2.0 | 25dbe92 |", "Ops-Cockpit ansehen → SR-1 abhaken"],
  ],
  ["docs/boss-assistant/interviews/team-3.md", ["keine Code-Implementierung"]],
  [
    "docs/boss-assistant/github-jira-architektur.md",
    ["| `klarwerk-business-backend` | **KBB**", "ruht (0 offen)"],
  ],
  ["apps/web/src/pages/Validation.quittung.test.tsx", ["Sollvertrag D-011"]],
  ["OFFEN.md", ["## 1 — Was bei dir liegt"]],
  ["PROJECT_CONTEXT/09_ENTSCHEIDUNGEN.md", ["**D-010:**"]],
  ["docs/demo/stage-1-pilot-readiness.md", ["Stand: 2026-06-29"]],
];

// Kennungen des Cockpit-Datenvertrags — zusammengesetzt, damit diese Datei selbst kein Treffer ist.
const COCKPIT_KENNUNGEN = [
  ["beta", "paused"].join("_"),
  ["current", "state"].join("_"),
  ["ticket", "id"].join("_"),
  ["gonogo", "board.json"].join("-"),
  ["lifecycle", "log.json"].join("-"),
  ["OPS", "STATUSBERICHT"].join("_"),
];
const PRODUKTBEREICHE = ["services", "apps/web/src", "tools", "scripts"];
const UEBERSPRUNGEN = new Set(["node_modules", "dist", ".git"]);

function dateienUnter(verzeichnis: string): string[] {
  const aus: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    if (UEBERSPRUNGEN.has(eintrag.name)) {
      continue;
    }
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      aus.push(...dateienUnter(pfad));
    } else if (eintrag.isFile()) {
      aus.push(pfad);
    }
  }
  return aus;
}

describe("R-1423 · Abgleich des Betriebscockpits", () => {
  it("Z: jede genannte Datei und jedes genannte Verzeichnis liegt im Bestand", () => {
    const pfade = genanntePfade();
    expect(pfade.length).toBeGreaterThan(5);
    const fehlend = pfade.filter((p) => !existsSync(p));
    expect(fehlend).toEqual([]);
  });

  it("F: die tragenden Sätze stehen in der genannten Datei", () => {
    for (const [datei, saetze] of FUNDSTELLEN) {
      const inhalt = lies(datei);
      for (const satz of saetze) {
        expect(inhalt.includes(satz), `${datei}: ${satz}`).toBe(true);
      }
    }
  });

  it("A: das Cockpit liegt weder als Ordner, Desktop-App noch als Datenvertrag im Produkt", () => {
    expect(existsSync("cockpit")).toBe(false);
    expect(existsSync("desktop-app/KLARWERK Ops.app")).toBe(false);
    const treffer: string[] = [];
    for (const bereich of PRODUKTBEREICHE) {
      for (const datei of dateienUnter(bereich)) {
        const inhalt = lies(datei);
        for (const kennung of COCKPIT_KENNUNGEN) {
          if (inhalt.includes(kennung)) {
            treffer.push(`${datei}: ${kennung}`);
          }
        }
      }
    }
    expect(treffer).toEqual([]);
  });

  it("das Dokument behauptet keine Erfüllung und hält die Entscheidung offen", () => {
    const text = lies(DOKUMENT).replace(/\s+/g, " ");
    expect(text).toContain(
      "Eine Erfüllung von R-1423 oder RECHERCHE:cockpit-schema wird hier nicht behauptet",
    );
    expect(text).toContain("eine Entscheidung des Nutzers (Pedi) zwischen A–D");
    for (const alternative of ["**A ·", "**B ·", "**C ·", "**D ·"]) {
      expect(text).toContain(alternative);
    }
  });

  it("die vier Abweichungen aus K2 bleiben als Anforderung erhalten", () => {
    const text = lies(DOKUMENT).replace(/\s+/g, " ");
    for (const teil of [
      "`erfüllt` und `erfuellt`",
      "offene Tickets, nicht geschlossene oder abgebrochene",
      "über `status` bzw. `current_state`",
      "`ticket_id` gegenüber `id`, Verlauf `entries`/`at` gegenüber `log`/`ts`",
    ]) {
      expect(text).toContain(teil);
    }
  });
});
