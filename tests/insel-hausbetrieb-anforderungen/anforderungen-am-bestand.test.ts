// aufnahme:20260922:gesamt-insel-updates — K2/K3/K4/K5: DIE KONKRETISIERUNG SAGT, WAS DER BESTAND IST.
//
// `docs/operations/insel-hausbetrieb-anforderungen.md` beschreibt Soll und offene Entscheidungen für
// Installationsmaterial, Signierung, Lizenz, Sicherheitsupdate und Datenträgeraustausch. Das Dokument
// stützt sich dabei auf Tatsachen am Code: welche Rechte Export und Einfuhr verlangen, wie die
// Vertraulichkeit an der Importgrenze behandelt wird, dass es heute KEINE Echtheitsprüfung des Pakets
// gibt. Dieser Test hält jede dieser Tatsachen am Produkt fest. Ändert sich eine — etwa weil die
// Signaturprüfung gebaut wird —, wird er rot, und das Dokument muss nachgezogen werden, statt still
// etwas Falsches zu sagen.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ImportItem, ohneQuellRestriktionen } from "../../services/library-analytics";
import { sanitizeImportConfidentiality } from "../../services/library-analytics/src/service";
import { ROLE_PERMISSIONS, can } from "../../services/rbac";
import { repoPfad } from "../support/repoPfad";

const DOKUMENT = "docs/operations/insel-hausbetrieb-anforderungen.md";
const TEXT = readFileSync(repoPfad(DOKUMENT), "utf8");

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

/** Das erste Recht, das eine Route nach ihrem Pfadliteral verlangt. */
function rechtDerRoute(quelle: string, pfad: string): string | undefined {
  const start = quelle.indexOf(`"${pfad}", async`);
  expect(start, `Route ${pfad} nicht gefunden`).toBeGreaterThanOrEqual(0);
  return /requirePermission\("([a-z.]+)"/.exec(quelle.slice(start))?.[1];
}

// Die Zuordnung aus QUELLEN.json (original_points), vollständig: vier Arbeitsaufträge, vier Punkte
// des bestehenden Auftrags B4.
const AUFNAHMEPUNKTE = [
  "R-0815",
  "R-0849",
  "R-0856",
  "R-0859",
  "P-C-INSELPAKET-STARTET",
  "priority:C-INSELPAKET-STARTET:e64d27979c61",
  "TEST-A16",
  "question:K08",
] as const;

describe("Insel-Hausbetrieb: Konkretisierung am Bestand", () => {
  it("K4 · die Punktliste führt jeden zugeordneten Aufnahmepunkt genau einmal", () => {
    const zeilen = abschnitt("6. Punktliste")
      .split("\n")
      .filter((z) => z.startsWith("| ") && !z.startsWith("| Punkt") && !z.startsWith("| ---"));
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

  it("K4 · Originalzielzustände bleiben im Umfang und werden nicht abgeschwächt", () => {
    // R-0815: das kleine Update bleibt offener Rest DIESES Auftrags, keine Neubestellung.
    const r0815 = abschnitt("6. Punktliste")
      .split("\n")
      .find((z) => z.startsWith("| R-0815"));
    expect(r0815).toContain("Offener Rest dieses Auftrags, nicht erfüllt.");
    expect(r0815).not.toMatch(/eigene Anforderung|neu bestell|weiterhin\?/);

    // R-0856: „ohne Betriebsunterbrechung" bleibt Soll; die Neustartpause ist nur eine offene
    // Abschwächung, nicht ausserhalb des Umfangs.
    const r0856 = abschnitt("4. R-0856");
    expect(r0856).toContain("gilt der Originalzielzustand ohne");
    expect(r0856).not.toContain("ginge über die Quellen hinaus");
    // Die Quelle verlangt eine Probe, aber keine menschliche Durchführung.
    expect(r0856).not.toMatch(/Menschen/);
    expect(r0856).toContain("fehlt weiterhin");
  });

  it("K5 · jeder genannte Repopfad existiert", () => {
    const pfade = [...TEXT.matchAll(/`((?:services|scripts|docs|tests)\/[^`\s*<…]+)`/g)].map(
      (m) => m[1] ?? "",
    );
    expect(pfade.length).toBeGreaterThan(10);
    for (const pfad of pfade) {
      expect(existsSync(repoPfad(pfad)), `${DOKUMENT} nennt ${pfad}`).toBe(true);
    }
  });

  it("K2 · §2: keine Echtheitsprüfung des Pakets, kein kleiner Updateweg", () => {
    for (const datei of [
      "scripts/insel/update-einspielen.sh",
      "scripts/insel/build-current-release.mjs",
      "scripts/insel/release-texte.mjs",
    ]) {
      expect(
        lies(datei),
        `${datei} enthält jetzt eine Signaturprüfung — ${DOKUMENT} §2/H3 nachziehen`,
      ).not.toMatch(/signatur|signature|createVerify|crypto\.verify|openssl dgst|minisign/i);
    }
    // W1: der Bauer liefert das volle Release mit Produktionsabhängigkeiten.
    const bauer = lies("scripts/insel/build-current-release.mjs");
    expect(bauer).toContain("npm ci --omit=dev");
    expect(existsSync(repoPfad("scripts/insel/UPDATE-einspielen.command"))).toBe(false);
    expect(TEXT).toContain("Ein beliebiges, richtig aufgebautes ZIP wird eingespielt.");
  });

  it("K3 · D1/D2: Ausfuhr und Einfuhr verlangen die genannten Rechte", () => {
    const routen = lies("services/app/src/routes/library-routes.ts");
    expect(rechtDerRoute(routen, "/api/library/export")).toBe("ko.read");
    expect(routen).toContain('const includeConfidential = can(user.role, "ko.validate");');
    expect(rechtDerRoute(routen, "/api/library/import")).toBe("ko.create");
    expect(rechtDerRoute(routen, "/api/library/import/candidates/:id")).toBe("ko.validate");

    // Wer einreichen darf, darf nicht selbst annehmen — sonst wäre „nur als Kandidat" leer.
    expect(can("experte", "ko.create")).toBe(true);
    expect(can("experte", "ko.validate")).toBe(false);
    expect(ROLE_PERMISSIONS.controller).toContain("ko.validate");
  });

  it("K3 · D3: unbekannte Vertraulichkeit wird vertraulich, fehlende bleibt offen", () => {
    expect(sanitizeImportConfidentiality("geheim")).toBe("vertraulich");
    expect(sanitizeImportConfidentiality("intern")).toBe("intern");
    // Fehlt der Wert, entscheidet erst die Annahme (Standard „intern") — deshalb verlangt D3 ihn
    // im Bündel ausdrücklich.
    expect(sanitizeImportConfidentiality(undefined)).toBeUndefined();
    expect(abschnitt("5. R-0859")).toContain("Eintrag ohne Wert als Fehler im Bündel");
  });

  it("K3 · D4: Quell-Leseeinschränkungen gehen bei der Einfuhr verloren", () => {
    const eintrag = {
      title: "Probe",
      statement: "Probe",
      type: "technik",
      category: "Probe",
      externalId: "zentral-1",
      sourceRestrictions: {},
    } as unknown as ImportItem;
    const [ergebnis] = ohneQuellRestriktionen([eintrag]);
    expect(ergebnis).toBeDefined();
    expect(ergebnis && "sourceRestrictions" in ergebnis).toBe(false);
    expect(ergebnis?.externalId).toBe("zentral-1");
  });

  it("K5 · W4: das lokale Modell ist im Code verdrahtet, wie das Dokument sagt", () => {
    // Die Kette: build-app.ts ruft die gedeckelte Hülle, die Hülle baut den lokalen Client.
    const modellClient = lies("services/reasoner/src/model-client.ts");
    expect(modellClient).toMatch(
      /export function createCappedLocalClientFromEnv\([\s\S]*?createLocalClientFromEnv\(env\)/,
    );
    expect(lies("services/app/src/build-app.ts")).toContain("createCappedLocalClientFromEnv()");
    expect(TEXT).toContain("createCappedLocalClientFromEnv");
  });

  it("K1 · B4 wird abgegrenzt und nicht neu bestellt", () => {
    const abgrenzung = abschnitt("1. Abgrenzung");
    expect(abgrenzung).toContain("arbeit:b4-insel-release-update-rueckfall-20260921");
    expect(abgrenzung).toContain("Bestellt nichts neu.");
    expect(existsSync(repoPfad("scripts/insel/rueckfall.sh"))).toBe(true);
  });
});
