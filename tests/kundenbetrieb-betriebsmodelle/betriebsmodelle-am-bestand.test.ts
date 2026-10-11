// aufnahme:20260922:gesamt-kundenbetrieb — DIE BETRIEBSMODELLE SAGEN, WAS DER BESTAND IST.
//
// `docs/operations/kundenbetrieb-betriebsmodelle.md` erklärt Datenfluss, Ports, „eine Firma je
// Instanz" und die Prüfsumme am Inselpaket und führt jeden zugeordneten Aufnahmepunkt. Dieser Test
// hält die Tatsachen am Produkt fest, auf die sich das Dokument stützt. Ändert sich eine — etwa weil
// eine Mandantenspalte dazukommt oder ein Port wandert —, wird er rot, und das Dokument muss
// nachgezogen werden, statt still etwas Falsches zu sagen.
//
// Die Prüfsumme wird am echten Baustein gemessen (`scripts/insel/paket-pruefsumme.mjs`, eigener
// Node-Prozess, echte Datei). Ein voller Paketlauf braucht `zip` und wird hier nicht behauptet.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { createEmbeddingProviderFromEnv } from "../../services/embedding/src/provider";
import { isConfirmedLocalOrigin } from "../../services/reasoner/src/model-client";
import { REPO_WURZEL, repoPfad } from "../support/repoPfad";

const DOKUMENT = "docs/operations/kundenbetrieb-betriebsmodelle.md";
const TEXT = readFileSync(repoPfad(DOKUMENT), "utf8");
const PRUEFSUMME = repoPfad("scripts/insel/paket-pruefsumme.mjs");
const BAUER = "scripts/insel/build-current-release.mjs";

function lies(relativ: string): string {
  return readFileSync(repoPfad(relativ), "utf8");
}

function abschnitt(kopf: string): string {
  const start = TEXT.indexOf(`## ${kopf}`);
  expect(start, kopf).toBeGreaterThanOrEqual(0);
  const rest = TEXT.slice(start + 3);
  const ende = rest.search(/\n## /);
  return ende < 0 ? rest : rest.slice(0, ende);
}

function punktzeilen(): string[] {
  return abschnitt("9. Punktliste")
    .split("\n")
    .filter((z) => z.startsWith("| ") && !z.startsWith("| Punkt") && !z.startsWith("| ---"));
}

/** Führt ein kurzes ES-Modul-Skript gegen den echten Baustein aus. */
function mitBaustein(rumpf: string): { status: number | null; stdout: string; stderr: string } {
  const kopf = `import * as p from ${JSON.stringify(pathToFileURL(PRUEFSUMME).href)};\n`;
  const lauf = spawnSync("node", ["--input-type=module", "-e", kopf + rumpf], {
    encoding: "utf8",
  });
  return { status: lauf.status, stdout: lauf.stdout ?? "", stderr: lauf.stderr ?? "" };
}

// Die Zuordnung aus QUELLEN.json (original_points), vollständig.
const AUFNAHMEPUNKTE = [
  "R-0779",
  "R-0781",
  "R-0784",
  "R-0787",
  "R-0789",
  "R-0807",
  "R-0809",
  "R-0821",
  "R-0823",
  "R-0826",
  "R-0829",
  "R-0843",
  "R-0844",
  "R-0851",
  "R-0852",
  "R-0861",
  "R-0869",
  "R-1270",
  "R-1487",
  "R-2046",
  "R-2053",
  "R-2061",
  "R-2072",
  "JOB-4366",
  "P-B2-NEUINSTALLATION-DURCHGAENGIG",
  "TEST-A14",
  "priority:B2-NEUINSTALLATION-DURCHGAENGIG:7a59b5a35905",
  "package:betrieb",
  "SOLL:NFR-PRV-01",
  "RECHERCHE:team3-fuehrung",
] as const;

const temporaer: string[] = [];
afterAll(() => {
  for (const ordner of temporaer) rmSync(ordner, { recursive: true, force: true });
});

describe("Kundenbetrieb: Betriebsmodelle am Bestand", () => {
  it("K6 · die Punktliste führt jeden zugeordneten Aufnahmepunkt genau einmal", () => {
    const zeilen = punktzeilen();
    const kennungen = zeilen.map((z) => z.slice(2).split(" ")[0]);
    expect([...kennungen].sort()).toEqual([...AUFNAHMEPUNKTE].sort());
    for (const zeile of zeilen) {
      // Spalten: Punkt | Stand | Ergebnis | Rest — keine darf leer sein.
      const zellen = zeile.split("|").slice(1, -1);
      expect(zellen, zeile).toHaveLength(4);
      for (const zelle of zellen) {
        expect(zelle.trim().length, zeile).toBeGreaterThan(0);
      }
    }
  });

  it("K3 · die Installationspunkte bleiben bei B2, kein zweiter Durchlauf", () => {
    const b2 = ["R-0823", "R-0826", "JOB-4366", "P-B2-NEUINSTALLATION-DURCHGAENGIG"];
    for (const punkt of [...b2, "priority:B2-NEUINSTALLATION-DURCHGAENGIG:7a59b5a35905"]) {
      const zeile = punktzeilen().find((z) => z.startsWith(`| ${punkt} `));
      expect(zeile, punkt).toContain("gehört zu B2");
    }
    expect(abschnitt("1. Abgrenzung")).toContain(
      "Bestellt **keinen** zweiten Installationsdurchlauf.",
    );
  });

  it("K1 · Datenfluss: lokal heißt Loopback oder ausdrücklich freigegeben", () => {
    expect(isConfirmedLocalOrigin("http://127.0.0.1:11434/v1")).toBe(true);
    expect(isConfirmedLocalOrigin("http://localhost:8080/v1")).toBe(true);
    expect(isConfirmedLocalOrigin("https://modell.example/v1")).toBe(false);
    expect(isConfirmedLocalOrigin("http://10.0.0.5:8000/v1", "http://10.0.0.5:8000")).toBe(true);
    // Cloud-Anbieter tragen die Ablehnung vertraulicher Inhalte immer.
    const client = lies("services/reasoner/src/model-client.ts");
    const cloud = client.slice(client.indexOf("export function createCappedCloudClientFromEnv("));
    expect(cloud.slice(0, cloud.indexOf("\n}\n"))).toContain("rejectsConfidential: true");
    // Einbettung: ohne Wert der Stub, die externen Wege sind nicht verdrahtet.
    expect(createEmbeddingProviderFromEnv({})).toBeDefined();
    expect(
      createEmbeddingProviderFromEnv({ KLARWERK_EMBEDDING_PROVIDER: "cloud" }),
    ).toBeUndefined();
    expect(abschnitt("2. Die drei Betriebsmodelle")).toContain("isConfirmedLocalOrigin");
  });

  it("K1 · eine Firma je Instanz: keine Mandantenspalte außer der Word-Sitzung", () => {
    const funde: string[] = [];
    const besuche = (ordner: string): void => {
      for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
        if (eintrag.name === "node_modules") continue;
        const pfad = join(ordner, eintrag.name);
        if (eintrag.isDirectory()) {
          besuche(pfad);
        } else if (/\.tsx?$/.test(eintrag.name) && !/\.test\.tsx?$/.test(eintrag.name)) {
          if (readFileSync(pfad, "utf8").includes("tenant_id")) {
            funde.push(relative(REPO_WURZEL, pfad).split("\\").join("/"));
          }
        }
      }
    };
    besuche(repoPfad("services"));
    expect(funde).toEqual(["services/reasoner/src/klara-policy-store.ts"]);
    expect(abschnitt("2. Die drei Betriebsmodelle")).toContain("**eine Firma je Instanz**");
  });

  it("K4 · ein Port für die App: 3001 in Container, Server, Compose und Leitfäden", () => {
    const dockerfile = lies("Dockerfile");
    expect(dockerfile).toContain("ENV PORT=3001");
    expect(dockerfile).toContain("EXPOSE 3001");
    expect(lies("services/app/src/server.ts")).toContain('process.env.PORT ?? "3001"');
    const compose = lies("docker-compose.prod.yml");
    expect(compose).toMatch(/^\s+PORT: 3001$/m);
    expect(compose).toContain('- "3001:3001"');
    expect(compose).not.toMatch(/"3000:3000"|PORT: 3000\b/);
    for (const leitfaden of [
      "docs/operations/kundeninstanz-neuinstallation.md",
      "docs/operations/deploy-hetzner.md",
      "docs/operations/server-hardening-readiness.md",
    ]) {
      expect(lies(leitfaden), `${leitfaden} nennt 3000`).not.toMatch(/\b3000\b/);
    }
  });

  it("K2 · der Baustein schreibt die Prüfsumme im shasum-Format neben das Paket", () => {
    const ordner = mkdtempSync(join(tmpdir(), "kw-pruefsumme-"));
    temporaer.push(ordner);
    const paket = join(ordner, "klarwerk-insel-probe.zip");
    const inhalt = Buffer.alloc(3 * 1024 * 1024 + 17, 7);
    writeFileSync(paket, inhalt);

    const aufruf = `p.schreibePaketPruefsumme(${JSON.stringify(paket)})`;
    const lauf = mitBaustein(`process.stdout.write(JSON.stringify(${aufruf}));`);
    expect(lauf.status, lauf.stderr).toBe(0);
    const ergebnis = JSON.parse(lauf.stdout) as { sha256: string; datei: string };
    const erwartet = createHash("sha256").update(inhalt).digest("hex");
    expect(ergebnis.sha256).toBe(erwartet);
    expect(ergebnis.datei).toBe(`${paket}.sha256`);
    expect(readFileSync(`${paket}.sha256`, "utf8")).toBe(`${erwartet}  klarwerk-insel-probe.zip\n`);
  });

  it("K2 · die Prüfsummenzeile lehnt Pfade und Nicht-Hex ab", () => {
    const hex = "a".repeat(64);
    const rumpf = [
      "const ergebnis = [];",
      `for (const [h, n] of [[${JSON.stringify(hex)}, "x/y.zip"], ["xyz", "y.zip"]]) {`,
      "  try { p.pruefsummenZeile(h, n); ergebnis.push('angenommen'); }",
      "  catch { ergebnis.push('abgelehnt'); }",
      "}",
      "process.stdout.write(JSON.stringify(ergebnis));",
    ].join("\n");
    const lauf = mitBaustein(rumpf);
    expect(lauf.status, lauf.stderr).toBe(0);
    expect(JSON.parse(lauf.stdout)).toEqual(["abgelehnt", "abgelehnt"]);
  });

  it("K2 · der Bauer räumt die alte Prüfsumme ab und schreibt die neue nur für ein Paket", () => {
    const bauer = lies(BAUER);
    const abraeumen = bauer.indexOf("rmSync(pruefsummenPfad(zipPath), { force: true });");
    expect(abraeumen).toBeGreaterThan(0);
    expect(abraeumen).toBeLessThan(bauer.indexOf("mkdirSync(releaseDir, { recursive: true });"));
    expect(bauer).toMatch(
      /if \(verpackt\) \{\s*verpacke\(\);\s*pruefsumme = schreibePaketPruefsumme\(zipPath\);\s*\}/,
    );
    expect(bauer).toContain("sha256: pruefsumme ? pruefsumme.sha256 : null,");
    // Die Einfuhr des Bauers findet die Namen, die er benutzt.
    const namen = mitBaustein("process.stdout.write(Object.keys(p).sort().join(','));");
    expect(namen.status, namen.stderr).toBe(0);
    for (const name of ["pruefsummenPfad", "schreibePaketPruefsumme"]) {
      expect(namen.stdout.split(","), `${BAUER} benutzt ${name}`).toContain(name);
    }
  });

  it("K7 · jeder genannte Repopfad existiert", () => {
    const pfade = [...TEXT.matchAll(/`((?:services|scripts|docs|tests|apps)\/[^`\s*<…]+)`/g)].map(
      (m) => m[1] ?? "",
    );
    expect(pfade.length).toBeGreaterThan(10);
    for (const pfad of pfade) {
      expect(existsSync(repoPfad(pfad)), `${DOKUMENT} nennt ${pfad}`).toBe(true);
    }
    expect(existsSync(repoPfad("desktop-app/KLARWERK App.app"))).toBe(true);
  });
});
