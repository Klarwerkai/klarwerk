// ================================================================================================
// R-0659 · DAS KI-GOVERNANCE-PAKET — SIEBEN TEILE, UND JEDE AUSSAGE HÄNGT AM CODE.
// ================================================================================================
//
// `docs/compliance/ki-governance.md` bündelt Zweck, Rollen, Fassungen, Risikoeinstufung, Aufsicht,
// Vorfallregister und die Prüfung der Kennzeichnungspflicht. Ein solches Paket veraltet still: eine
// Datei zieht um, eine neue KI-Aufgabe kommt hinzu und steht in keiner Tabelle, die Textfassung steigt
// und das Paket nennt die alte. Diese Prüfung hält es an den Stellen fest, an denen es vom Code abhängt.
// Sie misst keine Rechtslage — die Lesart selbst bleibt eine Kanzleifrage.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HINWEIS_TEXT_VERSION } from "../../services/auth/src/notice";
import { KI_ERZEUGENDE_AUFGABEN } from "../../services/model-runs";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const TEXT = readFileSync(join(WURZEL, "docs/compliance/ki-governance.md"), "utf8");
const TEILE = [
  "Zweck",
  "Rollen",
  "Fassungen",
  "Risikoeinstufung",
  "Aufsicht",
  "Vorfallregister",
  "Prüfung der Kennzeichnungspflicht",
] as const;
const PFAD = /`((?:apps|services|tests|docs|specs)\/[^`\s]+\.(?:ts|tsx|md|json))`/g;
const ZEILE = /^\| `(\w+)` \| (gekennzeichnet|nicht gekennzeichnet|kein gelesener Text) \|/gm;
const REGISTERSPALTEN = [
  "Gemeldet am",
  "KI-Aufgabe",
  "Risiko",
  "Belege",
  "Sofortmaßnahme",
  "Ursache",
  "Abgeschlossen am",
] as const;

function abschnitt(titel: string): string {
  const kopf = new RegExp(`\\n## \\d+\\. ${titel}\\n`).exec(TEXT);
  if (!kopf) {
    return "";
  }
  const rest = TEXT.slice(kopf.index + kopf[0].length);
  const ende = rest.indexOf("\n## ");
  return ende < 0 ? rest : rest.slice(0, ende);
}

/** Speicherstelle der Modellbegründung und ihre Anzeige — je Urteilsaufgabe. */
const ANZEIGEWEGE: Record<string, readonly (readonly [string, string])[]> = {
  conflict: [
    ["services/conflicts/src/service.ts", "rationale: verdict.begruendung"],
    ["apps/web/src/lib/conflictBoard.ts", "rationale: d.rationale"],
    ["apps/web/src/pages/Conflicts.tsx", "{origin.rationale}"],
  ],
  duplicate: [
    ["services/conflicts/src/overlap-service.ts", "rationale: verdict.begruendung"],
    ["apps/web/src/lib/duplicateBoard.ts", "rationale: d.rationale"],
    ["apps/web/src/pages/Duplicates.tsx", "{info.rationale}"],
  ],
};

function quelle(pfad: string): string {
  return readFileSync(join(WURZEL, pfad), "utf8");
}

function zeilenVon(titel: string): string[] {
  return abschnitt(titel).split("\n");
}

/** Die Aufgaben des Laufprotokolls, gelesen aus der Typdefinition — keine Abschrift hier. */
function laufAufgaben(): string[] {
  const quelle = readFileSync(join(WURZEL, "services/model-runs/src/types.ts"), "utf8");
  const beginn = quelle.indexOf("export type ModelRunTask =");
  const block = quelle.slice(beginn, quelle.indexOf(";", beginn));
  return [...block.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "");
}

describe("R-0659 · das KI-Governance-Paket", () => {
  it("jeder der sieben Teile hat einen eigenen, nicht leeren Abschnitt", () => {
    for (const titel of TEILE) {
      expect([titel, abschnitt(titel).trim().length > 200]).toEqual([titel, true]);
    }
  });

  it("jede genannte Datei liegt im Repository", () => {
    const pfade = [...new Set([...TEXT.matchAll(PFAD)].map((m) => m[1] ?? ""))];
    expect(pfade.length).toBeGreaterThan(20);
    expect(pfade.filter((pfad) => !existsSync(join(WURZEL, pfad)))).toEqual([]);
  });

  it("die Kennzeichnung deckt das Laufprotokoll und kennzeichnet genau die Codeliste", () => {
    const tabelle = abschnitt("Prüfung der Kennzeichnungspflicht");
    const zeilen = [...tabelle.matchAll(ZEILE)].map((m) => [m[1] ?? "", m[2] ?? ""] as const);
    const aufgaben = laufAufgaben();
    expect(aufgaben.length).toBeGreaterThan(10);
    expect(zeilen.map(([aufgabe]) => aufgabe).sort()).toEqual([...aufgaben].sort());
    const gekennzeichnet = zeilen.filter(([, ergebnis]) => ergebnis === "gekennzeichnet");
    const erwartet = [...KI_ERZEUGENDE_AUFGABEN].sort();
    expect(gekennzeichnet.map(([aufgabe]) => aufgabe).sort()).toEqual(erwartet);
  });

  it("angezeigte Modellbegründung heisst nicht „kein gelesener Text“", () => {
    // Ben-Befund Nacharbeit 1: die Lesart im Code nannte `conflict` und `duplicate` textlos, obwohl
    // die Oberfläche ihre Modellbegründung zeigt. Gemessen wird der Anzeigeweg selbst: solange er
    // besteht, darf das Paket die Aufgabe nicht als textlos führen.
    const tabelle = abschnitt("Prüfung der Kennzeichnungspflicht");
    const paare = [...tabelle.matchAll(ZEILE)].map((m) => [m[1] ?? "", m[2] ?? ""] as const);
    const ergebnis = new Map(paare);
    for (const [aufgabe, weg] of Object.entries(ANZEIGEWEGE)) {
      const angezeigt = weg.every(([datei, stelle]) => quelle(datei).includes(stelle));
      expect([aufgabe, angezeigt]).toEqual([aufgabe, true]);
      expect([aufgabe, ergebnis.get(aufgabe)]).not.toEqual([aufgabe, "kein gelesener Text"]);
    }
  });

  it("die genannte Fassung des Hinweistexts ist die des Produkts", () => {
    const zeile = zeilenVon("Fassungen").find((z) => z.startsWith("| Hinweistext"));
    expect(zeile, "die Zeile zum Hinweistext fehlt").toBeDefined();
    expect(zeile).toContain("HINWEIS_TEXT_VERSION");
    expect(zeile).toContain(`\`${HINWEIS_TEXT_VERSION}\``);
  });

  it("jedes Betriebsrisiko nennt mindestens einen Beleg", () => {
    const risiken = zeilenVon("Risikoeinstufung").filter((z) => /^\| RK-\d+ \|/.test(z));
    expect(risiken.length).toBeGreaterThanOrEqual(5);
    for (const zeile of risiken) {
      const nummer = zeile.slice(2, 7).trim();
      expect([nummer, [...zeile.matchAll(PFAD)].length > 0]).toEqual([nummer, true]);
    }
  });

  it("das Vorfallregister hat die verlangten Spalten, und jeder Eintrag füllt sie alle", () => {
    // Ein leeres Register ist der wahrheitsgemässe Stand; der Test verbietet Einträge nicht, er
    // verlangt nur, dass ein Eintrag dieselben Spalten hat wie der Kopf.
    const tabelle = zeilenVon("Vorfallregister").filter((z) => z.startsWith("|"));
    const kopf = tabelle[0] ?? "";
    for (const spalte of REGISTERSPALTEN) {
      expect(kopf).toContain(spalte);
    }
    const breite = kopf.split("|").length;
    for (const eintrag of tabelle.slice(2)) {
      expect(eintrag.split("|").length).toBe(breite);
    }
  });
});
