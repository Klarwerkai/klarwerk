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

/** Die nummerierten Schritte aus „## 2. Reihenfolge“: Nummer → Text bis zum nächsten Schritt. */
function schritte(text: string): Map<number, string> {
  const start = text.indexOf("## 2. Reihenfolge");
  const ende = text.indexOf("\n## ", start + 1);
  const abschnitt = text.slice(start, ende < 0 ? undefined : ende);
  const ergebnis = new Map<number, string>();
  let nummer: number | null = null;
  for (const zeile of abschnitt.split("\n")) {
    const kopf = /^(\d+)\. /.exec(zeile);
    if (kopf?.[1]) {
      nummer = Number(kopf[1]);
      ergebnis.set(nummer, zeile);
    } else if (nummer !== null) {
      ergebnis.set(nummer, `${ergebnis.get(nummer)}\n${zeile}`);
    }
  }
  return ergebnis;
}

/**
 * BENs Befund (nacharbeit-2): der Übernahmedump muss NACH dem Stopp aller Schreiber entstehen, und
 * übernommen werden darf nur genau dieser Dump. Liefert die Verstösse — leer heisst: konsistent.
 */
function zeitlicheVerstoesse(text: string): string[] {
  const s = [...schritte(text).entries()];
  const stopp = s.find(([, t]) => t.includes("Alle schreibenden Prozesse stoppen"))?.[0];
  const dump = s.find(([, t]) => t.includes("Übernahmedump ziehen"))?.[0];
  const uebernahme = s.find(([, t]) => t.includes("*Übernahme:*"))?.[1] ?? "";
  const quelle = /den Übernahmedump aus Schritt (\d+)/.exec(uebernahme)?.[1];
  const verstoesse: string[] = [];
  if (stopp === undefined) {
    verstoesse.push("kein Schritt stoppt alle schreibenden Prozesse");
  }
  if (dump === undefined) {
    verstoesse.push("kein Schritt zieht den Übernahmedump");
  }
  if (stopp !== undefined && dump !== undefined && !(stopp < dump)) {
    verstoesse.push(`Übernahmedump (Schritt ${dump}) vor dem Schreibstopp (Schritt ${stopp})`);
  }
  if (quelle === undefined) {
    verstoesse.push("die Übernahme nennt nicht den Übernahmedump als Quelle");
  } else if (Number(quelle) !== dump) {
    verstoesse.push(`übernommen wird Schritt ${quelle}, der Übernahmedump ist Schritt ${dump}`);
  }
  return verstoesse;
}

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
    expect(kennungen).toEqual(["A1", "A2", "A3", "A4", "A5", "A6", "A7a", "A7b", "A8"]);
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

  it("D7 · ZEITLICH KONSISTENT: erst alle Schreiber stoppen, dann den Übernahmedump ziehen und genau ihn übernehmen", () => {
    expect(zeitlicheVerstoesse(TEXT)).toEqual([]);
    // Der Stopp ist überprüfbar, nicht nur angeordnet: keine offene Sitzung mehr auf der alten DB.
    const stopp = [...schritte(TEXT).values()].find((t) =>
      t.includes("Alle schreibenden Prozesse stoppen"),
    );
    expect(stopp).toMatch(/pg_stat_activity WHERE datname = 'klarwerk'/);
    // Und die Abnahme erkennt eine Lücke nach dem Dump: A8 vergleicht gegen die alte Datenbank selbst.
    const a8 = TEXT.split("\n").find((z) => z.startsWith("| A8 |")) ?? "";
    expect(a8).toContain("max(seq) FROM audit");
    expect(a8).toContain("gestoppten `klarwerk`");
    expect(a8).toContain(`\`${NAME_PROD}\``);
  });

  it("D7-K · KALIBRIERUNG: die Reihenfolge vor nacharbeit-2 (Sicherung → Stopp → Dump aus Schritt 1) wird erkannt", () => {
    const alt = [
      "## 2. Reihenfolge",
      "",
      "1. **Sicherung ziehen und prüfen** (Voraussetzung 1).",
      "2. **Anwendung stoppen** — kein Schreibzugriff ab hier.",
      "3. **Neue Datenbank anlegen.**",
      "4. **Bestand — nach Pedis Entscheidung (§0):**",
      "   - *Übernahme:* den Dump aus Schritt 1 nach `scripts/backup/RESTORE.md` einspielen.",
      "",
      "## 3. Abnahme",
    ].join("\n");
    expect(zeitlicheVerstoesse(alt).length).toBeGreaterThan(0);
    // Auch mit den neuen Bezeichnungen, aber vertauschter Reihenfolge: rot.
    const vertauscht = [
      "## 2. Reihenfolge",
      "1. **Übernahmedump ziehen und prüfen**",
      "2. **Alle schreibenden Prozesse stoppen**",
      "3. **Bestand:**",
      "   - *Übernahme:* den Übernahmedump aus Schritt 1 einspielen.",
      "## 3. Abnahme",
    ].join("\n");
    expect(zeitlicheVerstoesse(vertauscht)).toEqual([
      "Übernahmedump (Schritt 1) vor dem Schreibstopp (Schritt 2)",
    ]);
    // Und eine Übernahme, die auf die Vorab-Sicherung zeigt: rot.
    const falscheQuelle = [
      "## 2. Reihenfolge",
      "1. *Optional:* **Vorab-Sicherung**",
      "2. **Alle schreibenden Prozesse stoppen**",
      "3. **Übernahmedump ziehen und prüfen**",
      "4. **Bestand:**",
      "   - *Übernahme:* den Übernahmedump aus Schritt 1 einspielen.",
      "## 3. Abnahme",
    ].join("\n");
    expect(zeitlicheVerstoesse(falscheQuelle)).toEqual([
      "übernommen wird Schritt 1, der Übernahmedump ist Schritt 3",
    ]);
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
