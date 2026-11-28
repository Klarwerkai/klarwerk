import { describe, expect, it } from "vitest";
import { EV, KO, OBJ, run, tabellen } from "./drill-probe";

describe("Restore-Drill: Schema und Dumpabgleich", () => {
  // EIN vollständiger Lauf, alle Zusagen daran gemessen. Bewusst nicht drei Läufe mit derselben
  // Attrappe: jeder Lauf des Prüfstands fährt den echten Pflichtsatz durch (zwei Prozessaufrufe je
  // Tabelle), und drei identische Läufe hätten den Torlauf um Minuten verlängert, ohne eine einzige
  // zusätzliche Frage zu beantworten.
  it("A vollständiger Stand: jede Pflichttabelle, jedes Paar, Startbefehl, Nachweis, Abräumen", () => {
    const r = run();
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("Glied 4");
    expect(r.output).toContain(`alle ${tabellen.length} Pflichttabellen vorhanden`);
    for (const table of tabellen) expect(r.output).toContain(`${table}: Dump=2 Datenbank=2`);
    // Der produktive Startbefehl, wörtlich wie im Produktionsimage.
    expect(r.start, r.output).toBe(JSON.stringify(["npx", "tsx", "services/app/src/server.ts"]));
    // JOB 4097 · Glied 7b: Beleg UND Anhangsinhalt, über die laufende Anwendung zurückgelesen.
    expect(r.output).toContain("Bestandsscan: keine Belegzeile ohne ihren Anhang in objects");
    expect(r.output).toContain(`Glied 7b — Wissensobjekt ${KO} mit Beleg auf ${OBJ}`);
    expect(r.output).toContain(`(Belegzeile ${EV})`);
    expect(r.output).toContain("64 Bytes Anhangsinhalt zurueckgelesen");
    expect(r.output).toContain("DRILL BESTANDEN");
    // Und das Abräumen: kein Prozess, keine PID-Datei, keine zurückgelassene Anhangs- oder
    // Belegdatei.
    expect(r.terminated).toBe("yes");
    expect(r.pidRemains).toBe(false);
    expect(r.anhangRemains).toBe(false);
    expect(r.belegeRemains).toBe(false);
  }, 120_000);
  it("B nennt alle fehlenden Tabellen in einer Meldung", () => {
    const r = run("missing");
    expect(r.code, r.output).toBe(22);
    expect(r.output).toMatch(/ABBRUCH \(22\):[^\n]*audit[^\n]*objects/);
    expect(r.start).toBe("");
  }, 120_000);
  it("D erkennt Datenverlust mit Tabellenname und beiden Zahlen", () => {
    const r = run("mismatch");
    expect(r.code, r.output).toBe(23);
    expect(r.output).toMatch(/ABBRUCH \(23\):[^\n]*audit[^\n]*Dump=2[^\n]*Datenbank=3/);
    expect(r.start).toBe("");
  }, 120_000);
  it("leere Pflichttabellen sind gemessene 0 = 0", () => {
    const r = run("empty");
    expect(r.code, r.output).toBe(0);
    for (const table of tabellen) expect(r.output).toContain(`${table}: Dump=0 Datenbank=0`);
  }, 120_000);

  // ================================================================================================
  // JOB 4097 · RED-FIRST A — DER FEHLENDE BESTAND EINER NICHT-KERNTABELLE
  // ================================================================================================
  //
  // DIE LÜCKE, GEMESSEN: Ein Dump aus `pg_dump --exclude-table-data=ko_evidence` führt die Struktur
  // von `ko_evidence`, aber KEINEN Bestand. Nach dem Restore steht die Tabelle leer da — die
  // Anhangszuordnung Datei→Wissensobjekt ist weg, die Dateien liegen ohne Zugehörigkeit in der
  // Ablage. Vor JOB 4097 endete dieser Lauf mit **Exit 0**, weil `ko_evidence` in
  // `KERNTABELLEN=(kos users audit objects)` schlicht nicht vorkam.
  it("A(4097) ein Dump ohne Bestand fuer ko_evidence faellt durch — mit dem Namen in der Meldung", () => {
    const r = run("toc-missing");
    expect(r.code, r.output).toBe(22);
    expect(r.output).toMatch(/ABBRUCH \(22\):[^\n]*ko_evidence/);
    expect(r.start).toBe("");
  }, 120_000);
  // DIE GEGENRICHTUNG, damit die Regel nicht zur pauschalen Härte wird: Steht die Tabelle im
  // Inhaltsverzeichnis, ist ein fehlender COPY-Block eine ehrlich gemessene 0 — und kein Abbruch.
  it("A2(4097) dieselbe Tabelle MIT Eintrag im Inhaltsverzeichnis ist eine gemessene 0", () => {
    const r = run("kein-block-mit-toc");
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("ko_evidence: Dump=0 Datenbank=0");
  }, 120_000);
  // ================================================================================================
  // JOB 4097 · RED-FIRST B — DIE ZEILENABWEICHUNG EINER NICHT-KERNTABELLE
  // ================================================================================================
  it("B(4097) Zeilenverlust in `drafts` endet mit 23 und beiden Zahlen", () => {
    const r = run("nichtkern-mismatch");
    expect(r.code, r.output).toBe(23);
    expect(r.output).toMatch(/ABBRUCH \(23\):[^\n]*drafts: Dump=7 Datenbank=3/);
    expect(r.start).toBe("");
  }, 120_000);
});
