// ================================================================================================
// produkt:20261011:peter-p09 · P09-AC01/02/07/08 — DIE UNTERLAGE HÄLT, WAS PETER ENTSCHIEDEN HAT.
// ================================================================================================
//
// Die vier Kriterien sind Dokumentationskriterien: Varianten mit Umfang (AC01), Zahlen als
// Vorschläge bis Kunde UND Messung sie bestätigen (AC02), zweite unabhängige Sicherung erst nach dem
// PoC (AC07), Kosten und erreichbare Ziele vor einer SLA-Zusage (AC08). Dieser Wächter liest die
// Unterlage selbst und hält dagegen, dass eine spätere Änderung eine Zahl still zur Zusage macht.
// Er ist Quelleninspektion — die Messung selbst liefert `isolierter-wiederanlauf.integration.test.ts`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { gelisteteMeldung } from "../../services/app/src/log-positivliste";
import { GESTOPPTE_AUSSENAKTIONEN } from "../../services/app/src/wiederanlauf";

const root = resolve(import.meta.dirname, "../..");
const lies = (pfad: string) => readFileSync(resolve(root, pfad), "utf8");
const DOK = "docs/operations/wiederanlauf-rpo-rto.md";

function abschnitt(text: string, kopf: string): string {
  const start = text.indexOf(kopf);
  expect(start, `Abschnitt „${kopf}“ fehlt`).toBeGreaterThan(-1);
  const rest = text.slice(start + kopf.length);
  const ende = rest.search(/\n## /);
  return ende === -1 ? rest : rest.slice(0, ende);
}

describe("P09 · Unterlage Datenverlust und Wiederanlauf", () => {
  const dok = lies(DOK);

  it("AC01 · drei Varianten mit RPO, RTO, Ausgangspunkt, Voraussetzung und Umfang", () => {
    const varianten = abschnitt(dok, "## 2. Varianten");
    for (const zeile of [
      "| Basis | 24 Stunden | 8 Stunden |",
      "| Standard | 1 Stunde | 4 Stunden |",
      "| Erhöht | 15 Minuten | 1 Stunde |",
    ]) {
      expect(varianten).toContain(zeile);
    }
    const umfang = abschnitt(varianten, "### Umfang je Variante");
    for (const bereich of [
      "Wissen",
      "Rechte",
      "Historie",
      "Verantwortlichkeit",
      "Konfiguration in der Anwendung",
      "Konfiguration außerhalb",
      "Löschzustände",
    ]) {
      expect(umfang, bereich).toContain(`| ${bereich}`);
    }
  });

  it("AC02 · jede Zahl ist Vorschlag, bis Kunde UND Messung sie bestätigen — keine SLA", () => {
    const varianten = abschnitt(dok, "## 2. Varianten");
    expect(varianten).toContain("VORSCHLÄGE, keine SLA");
    expect(varianten).toMatch(/Kunde sie bestätigt \*\*und\*\* \(b\) eine[\s>]+Messung/);
    const regel = abschnitt(dok, "## 3. Bestätigungsregel und Messung");
    expect(regel).toContain("**Kundenbestätigung**");
    expect(regel).toContain("**Messung** am Zielaufbau");
    expect(regel).toContain("Dieses Dokument nennt keine Messzahl.");
    // Das Betriebsrunbook führt die Varianten als Vorschlag — der abgelöste Einzelwert ist kein Ziel.
    const dr = lies("docs/operations/backup-disaster-recovery.md");
    const runbook = abschnitt(dr, "## 4. RTO / RPO");
    expect(runbook).toContain("Vorschläge, keine SLA");
    expect(runbook).not.toMatch(/\*\*≤ 24 h\*\*|\*\*≤ 4 h\*\*/);
    expect(lies("docs/operations/server-hardening-readiness.md")).not.toContain("RTO ≤ 4 h");
    // Nirgends in der Unterlage gilt eine Variante als vereinbart.
    expect(dok).not.toMatch(/\b(zugesagt|vereinbart ist|garantiert)\b/i);
  });

  it("AC06 · die gestoppten Außenaktionen der Unterlage sind die des Codes; der Drill löst keine aus", () => {
    const wiederanlauf = abschnitt(dok, "## 4. Der Wiederanlauf");
    expect(GESTOPPTE_AUSSENAKTIONEN.map((a) => a.id)).toEqual([
      "wissensereignisse",
      "hintergrundpruefung",
      "lueckenerkennung",
    ]);
    for (const name of ["Wissensereignis-Meldungen", "Hintergrundprüfung", "Lückenerkennung"]) {
      expect(wiederanlauf, name).toContain(name);
    }
    // Der Probeserver des Drills startet ohne Webhook-Ziele und ohne Modellzuordnung.
    const skript = lies("scripts/backup/restore-drill.sh");
    const von = skript.indexOf("exec env \\");
    expect(von, "Startaufruf des Drills").toBeGreaterThan(-1);
    const start = skript.slice(von, skript.indexOf("services/app/src/server.ts", von));
    expect(start).toContain("KLARWERK_WEBHOOKS= \\");
    expect(start).toContain("KLARWERK_REASONER_POLICY=deterministic \\");
    // Die neuen Betriebsmeldungen bleiben im Protokoll lesbar (Log-Positivliste).
    for (const satz of [
      "Wiederanlauf restore-20261011: Außenaktionen gestoppt (wissensereignisse, hintergrundpruefung, lueckenerkennung). Nach der Freigabe ohne KLARWERK_WIEDERANLAUF neu starten.",
      "Wiederanlauf restore-20261011: Sperre aktiv bis zur Freigabe, Datenstand 2026-10-11T09:00:00.000Z, Replay-Grenze: 1 Meldungen unterdrückt, 2 offene Zustellungen geschlossen.",
    ]) {
      expect(gelisteteMeldung(satz)).toBe(satz);
    }
  });

  it("AC07 · zweite unabhängige Sicherung: erst nach dem PoC, mit Betreiber, Ausfallbereich, Schlüssel", () => {
    const plan = abschnitt(dok, "## 5. Zweite unabhängige Sicherung");
    expect(plan).toContain("Ausdrücklich erst nach dem PoC auszuarbeiten und einzurichten.");
    expect(plan).toContain("Im PoC wird nichts davon bestellt");
    for (const punkt of [
      "Unabhängiger Ausfallbereich",
      "Betreiber der Zweitkopie",
      "Schlüsselzugriff",
      "Takt",
      "Nachweis",
    ]) {
      expect(plan, punkt).toContain(`| ${punkt} |`);
    }
  });

  it("AC08 · Kosten und erreichbare Ziele stehen vor jeder SLA-Zusage — ohne erfundene Preise", () => {
    const tor = abschnitt(dok, "## 6. Kosten und erreichbare Ziele");
    for (const bedingung of [
      "Variante mit dem Kunden gewählt",
      "Kosten der Variante kalkuliert",
      "Messung am Zielaufbau hält die Werte ein",
      "Zweite unabhängige Sicherung eingerichtet",
      "Betreiber und Vertretung benannt",
    ]) {
      expect(tor, bedingung).toContain(bedingung);
    }
    expect(tor).toContain("(K7)");
    expect(tor).toContain("(K8)");
    expect(tor).toContain("keine SLA");
    // Keine Preise: sie entstehen nach dem PoC aus Angeboten.
    expect(dok).not.toMatch(/\d\s*(€|EUR\b|Euro\b)/);
    const erreichbar = abschnitt(dok, "### Was heute erreichbar ist");
    expect(erreichbar).toMatch(/\| Standard \| nein \|/);
    expect(erreichbar).toMatch(/\| Erhöht \| nein \|/);
  });
});
