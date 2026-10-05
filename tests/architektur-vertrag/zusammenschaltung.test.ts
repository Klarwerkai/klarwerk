// ================================================================================================
// R-1141 / R-1148 (Aufnahme 20260922 · zentrale-module-aufteilen) — DER VERTRAG STIMMT MIT DER
// VERDRAHTUNG ÜBEREIN.
// ================================================================================================
//
// `docs/architektur/zusammenschaltung.md` beschreibt, wie `services/app/src/build-app.ts` die Module
// zusammensetzt. Eine Beschreibung neben dem Code veraltet still; dieser Prüfstand liest deshalb die
// Wurzel als TEXT und verlangt, dass jede Ablage aus `AppRepos` mit ihren beiden Adaptern, jede
// Option von `assembleServices`, jedes Modul mit eigener `index.ts` und jede der drei Kompositionen
// im Vertrag steht. Gelesen wird der Text und nicht das Modul: die Adapternamen gibt es zur Laufzeit
// nur als Klassen, und genau ihre NAMEN sind die Zusage des Vertrags.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const WURZEL = readFileSync(repoPfad("services/app/src/build-app.ts"), "utf8");
const JOURNAL = readFileSync(repoPfad("services/app/src/dev-persist.ts"), "utf8");
const VERTRAG = readFileSync(repoPfad("docs/architektur/zusammenschaltung.md"), "utf8");

/** Die Kompositionsfunktionen, die der Vertrag beim Namen nennt. */
const FUNKTIONEN = [
  "assembleServices",
  "inMemoryRepos",
  "buildServices",
  "buildPgServices",
  "buildDevPersistServices",
  "buildApp",
] as const;

/** Der Text ab `kopf` bis zur nächsten Zeile, die nur `}` trägt (Ende der Deklaration). */
function rumpf(quelle: string, kopf: string, ende = "\n}\n"): string {
  const anfang = quelle.indexOf(kopf);
  if (anfang < 0) {
    throw new Error(`Deklaration nicht gefunden: ${kopf}`);
  }
  const schluss = quelle.indexOf(ende, anfang);
  if (schluss < 0) {
    throw new Error(`Ende der Deklaration nicht gefunden: ${kopf}`);
  }
  return quelle.slice(anfang, schluss);
}

/** Die erste Fanggruppe jedes Treffers. */
function namen(muster: RegExp, text: string): string[] {
  return [...text.matchAll(muster)].map((m) => m[1] ?? "");
}

/** Erste Fanggruppe → zweite Fanggruppe, je Treffer. */
function paare(muster: RegExp, text: string): Map<string, string> {
  return new Map([...text.matchAll(muster)].map((m) => [m[1] ?? "", m[2] ?? ""]));
}

const REPOS_RUMPF = rumpf(WURZEL, "export interface AppRepos {");
const OPTIONEN_RUMPF = rumpf(WURZEL, "export function assembleServices(", "} = {},");
const SPEICHER_RUMPF = rumpf(WURZEL, "export function inMemoryRepos(): AppRepos {");
const POSTGRES_RUMPF = rumpf(WURZEL, "export function buildPgServices(");

const ABLAGEN = namen(/^ {2}(\w+): /gm, REPOS_RUMPF);
const OPTIONEN = namen(/^ {4}(\w+)\?: /gm, OPTIONEN_RUMPF);
const SPEICHER = paare(/^ {4}(\w+): new (\w+)\(/gm, SPEICHER_RUMPF);
const POSTGRES = paare(/^ {6}(\w+): new (Pg\w+)\(pool\)/gm, POSTGRES_RUMPF);
const MODULE = readdirSync(repoPfad("services")).filter((name) =>
  existsSync(repoPfad(`services/${name}/index.ts`)),
);

/** Was dem Vertrag gegenüber der Verdrahtung fehlt — leer heisst: deckungsgleich. */
function luecken(vertrag: string): string[] {
  const zeilen = vertrag.split("\n");
  const zeileFuer = (schluessel: string): string | undefined =>
    zeilen.find((z) => z.startsWith(`| \`${schluessel}\` |`));
  const fehlt: string[] = [];
  for (const ablage of ABLAGEN) {
    const zeile = zeileFuer(ablage);
    const speicher = SPEICHER.get(ablage);
    const postgres = POSTGRES.get(ablage);
    if (!zeile) {
      fehlt.push(`Ablage ${ablage}: keine Zeile`);
      continue;
    }
    if (!speicher || !zeile.includes(`\`${speicher}\``)) {
      fehlt.push(`Ablage ${ablage}: Speicheradapter ${speicher ?? "(nicht in inMemoryRepos)"}`);
    }
    if (!postgres || !zeile.includes(`\`${postgres}\``)) {
      fehlt.push(`Ablage ${ablage}: Postgresadapter ${postgres ?? "(nicht in buildPgServices)"}`);
    }
  }
  for (const option of OPTIONEN) {
    const zeile = zeileFuer(option);
    if (!zeile) {
      fehlt.push(`Option ${option}: keine Zeile`);
      continue;
    }
    const postgres = option === "withTx" ? "withPgTx" : POSTGRES.get(option);
    if (postgres && !zeile.includes(postgres)) {
      fehlt.push(`Option ${option}: Postgresadapter ${postgres}`);
    }
  }
  for (const modul of MODULE) {
    if (!zeilen.some((z) => z.startsWith(`| \`services/${modul}\` |`))) {
      fehlt.push(`Modul services/${modul}: keine Zeile`);
    }
  }
  for (const name of FUNKTIONEN) {
    if (!vertrag.includes(`\`${name}`)) {
      fehlt.push(`Komposition ${name}: nicht genannt`);
    }
  }
  return fehlt;
}

describe("R-1141 · der Zusammenschaltungsvertrag deckt die Verdrahtung", () => {
  it("Z1 · die drei Kompositionen enden in derselben assembleServices", () => {
    for (const name of FUNKTIONEN.filter((n) => n !== "buildDevPersistServices")) {
      expect(WURZEL, name).toMatch(new RegExp(`export function ${name}\\(`));
    }
    expect(JOURNAL).toMatch(/export async function buildDevPersistServices\(/);
    expect(rumpf(WURZEL, "export function buildServices(")).toContain(
      "assembleServices(inMemoryRepos())",
    );
    const pg = rumpf(WURZEL, "export function buildPgServices(");
    expect(pg).toContain("gatedPool(rohPool)");
    expect(pg).toContain("withTx: (fn) => withPgTx(pool, fn)");
    expect(pg).toContain("return assembleServices(");
    const journal = rumpf(JOURNAL, "export async function buildDevPersistServices(");
    expect(journal).toContain("inMemoryRepos()");
    expect(journal).toContain("assembleServices(");
  });

  it("Z2 · die Erhebung aus dem Quelltext ist nicht leer und in sich stimmig", () => {
    // Kalibrierung: eine leere Erhebung hätte trivial keine Lücke.
    expect(ABLAGEN.length).toBeGreaterThan(20);
    expect(OPTIONEN).toContain("withTx");
    expect(OPTIONEN.length).toBeGreaterThan(5);
    expect(MODULE.length).toBeGreaterThan(20);
    // Jede Ablage hat in beiden Sätzen genau einen Adapter, und keiner nennt eine fremde.
    expect([...SPEICHER.keys()].sort()).toEqual([...ABLAGEN].sort());
    for (const ablage of ABLAGEN) {
      expect(POSTGRES.get(ablage), ablage).toMatch(/^Pg\w+Repo$/);
    }
  });

  it("Z3 · jede Ablage, Option, jedes Modul und jede Komposition steht im Vertrag", () => {
    expect(luecken(VERTRAG)).toEqual([]);
  });

  it("Z4 · Gegenproben: eine fehlende Zeile oder ein falscher Adapter wird ROT", () => {
    const ohneZeile = VERTRAG.split("\n")
      .filter((z) => !z.startsWith("| `koRepo` |"))
      .join("\n");
    expect(luecken(ohneZeile)).toContain("Ablage koRepo: keine Zeile");
    const falscherAdapter = VERTRAG.replace("`PgKantenRepo`", "`PgIrgendwasRepo`");
    expect(luecken(falscherAdapter)).toContain("Option kanten: Postgresadapter PgKantenRepo");
    const ohneModul = VERTRAG.replace("| `services/db-tx` |", "| db-tx |");
    expect(luecken(ohneModul)).toContain("Modul services/db-tx: keine Zeile");
  });
});
