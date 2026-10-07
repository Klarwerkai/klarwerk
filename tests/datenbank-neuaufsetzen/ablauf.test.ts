import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MIGRATIONSSPERRE } from "../../services/app/src/db";
import { postgresDbAus } from "../app/job2354-datenbanknamen";

// ================================================================================================
// R-1155 / OFFEN.md E5 + E7 — DER FESTGELEGTE ABLAUF DES NEUAUFSETZENS BLEIBT AM BAUM.
// ================================================================================================
//
// Die Anleitung `docs/operations/datenbank-neuaufsetzen.md` legt Reihenfolge, Voraussetzungen und
// Abnahme fest, BEVOR jemand die Produktionsdatenbank neu aufsetzt. Ausgeführt wird sie von
// Menschen, und genau deshalb darf sie nicht still veralten: ein Name, der in Compose längst anders
// heißt, oder ein Verweis auf eine Datei, die es nicht mehr gibt, fiele erst am Tag des Aufsetzens
// auf. Diese Datei liest die Werte aus dem Baum, statt sie zu wiederholen.
//
// WAS SIE NICHT PRÜFT: dass das Aufsetzen stattgefunden hat oder gelingt. Das belegt allein die
// Abnahme A1 bis A7 der Anleitung, ausgeführt gegen die echte Datenbank.

const ANLEITUNG = "docs/operations/datenbank-neuaufsetzen.md";
const lies = (pfad: string): string => readFileSync(pfad, "utf8");

const TEXT = lies(ANLEITUNG);
const NAME_PROD = postgresDbAus(lies("docker-compose.prod.yml"));

describe("R-1155 · Ablauf des Neuaufsetzens der Produktionsdatenbank", () => {
  it("D1 · die drei verlangten Teile stehen da: Voraussetzungen, Reihenfolge, Abnahme", () => {
    for (const teil of ["## 1. Voraussetzungen", "## 2. Reihenfolge", "## 3. Abnahme"]) {
      expect(TEXT, `${ANLEITUNG}: Abschnitt „${teil}“ fehlt`).toContain(teil);
    }
  });

  it("D2 · der Zielname ist der Name aus docker-compose.prod.yml — gelesen, nicht abgeschrieben", () => {
    expect(NAME_PROD, "docker-compose.prod.yml nennt kein POSTGRES_DB").not.toBeNull();
    expect(TEXT).toContain(`\`${NAME_PROD}\``);
    // Die Abnahme A1 prüft genau diesen Namen.
    const a1 = TEXT.split("\n").find((zeile) => zeile.startsWith("| A1 |"));
    expect(a1, "Abnahmezeile A1 fehlt").toBeDefined();
    expect(a1).toContain(`\`${NAME_PROD}\``);
  });

  it("D3 · jeder Abnahmepunkt A1 bis A7 steht als eigene Zeile mit Erwartung", () => {
    const zeilen = TEXT.split("\n").filter((z) => /^\| A\d+[ab]? \|/.test(z));
    const kennungen = zeilen.map((z) => z.split("|")[1]?.trim());
    expect(kennungen).toEqual(["A1", "A2", "A3", "A4", "A5", "A6", "A7a", "A7b"]);
    for (const zeile of zeilen) {
      const erwartung = zeile.split("|")[3]?.trim() ?? "";
      expect(erwartung, `${zeile}: ohne Erwartung ist der Punkt keine Abnahme`).not.toBe("");
    }
  });

  it("D4 · jede genannte Repository-Datei gibt es wirklich", () => {
    const muster = /`((?:scripts|services|docs|tests)\/[^`\s]+\.(?:sh|md|ts))`/g;
    const pfade = [...new Set([...TEXT.matchAll(muster)].map((m) => m[1] as string))];
    // Ohne gefundene Pfade wäre „alle vorhanden“ wertlos.
    expect(pfade.length).toBeGreaterThanOrEqual(6);
    expect(pfade.filter((p) => !existsSync(p))).toEqual([]);
  });

  it("D5 · was die Anleitung über den Produktstart sagt, steht so im Produkt", () => {
    // Die Migrationssperre ist benannt — und es gibt sie.
    expect(TEXT).toContain("`MIGRATIONSSPERRE`");
    expect(Number.isSafeInteger(MIGRATIONSSPERRE)).toBe(true);
    // Der Pflichtsatz, gegen den A4 prüft, steht in dem genannten Skript.
    expect(lies("scripts/backup/restore-drill.sh")).toMatch(/^PFLICHTTABELLEN=\(/m);
    // Die Erweiterung, die Voraussetzung 2 begründet, legt das Schema wirklich an.
    expect(lies("services/knowledge-object/src/repo-pg.ts")).toContain(
      "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    );
    // Die Folge nach `migrate()` — Token-Migration — steht im Serverstart.
    expect(lies("services/app/src/server.ts")).toMatch(
      /await migrate\(pool\);[\s\S]*?migrateAuthTokensAtRest\(pool\)/,
    );
  });

  it("D6 · die offene Entscheidung bleibt offen — die Anleitung nimmt sie nicht vorweg", () => {
    expect(TEXT).toMatch(/\*\*Offen — Entscheidung bei Pedi\*\*/);
    // E5 und E7 verweisen auf die Anleitung und bleiben als OFFEN geführt.
    const offen = lies("OFFEN.md").split("\n");
    for (const kennung of ["E5", "E7"]) {
      const zeile = offen.find((z) => z.startsWith(`| ${kennung} |`));
      expect(zeile, `OFFEN.md trägt keine Zeile ${kennung}`).toBeDefined();
      expect(zeile).toContain("| OFFEN |");
      expect(zeile).toContain(ANLEITUNG);
    }
  });
});
