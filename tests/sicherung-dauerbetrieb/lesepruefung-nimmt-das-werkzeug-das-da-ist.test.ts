// ================================================================================================
// JOB 4057 · L9 (Tor Runde 4) — DIE LESEPRÜFUNG DARF DIE SICHERUNG NICHT UNMÖGLICH MACHEN.
// ================================================================================================
//
// DER BEFUND, gemessen vom Tor am Stand der Runde 4: `tests/insel-update/sicherung-eindeutig.test.ts`
// (JOB 4012) war rot — `expected 2 to be +0`. Im Log stand der Grund:
//
//     [backup] ABBRUCH: pg_restore nicht gefunden (postgresql-client installieren).
//     [backup] Ohne Lesepruefung wird kein Backup veroeffentlicht.
//
// Der Rechner hat kein `postgresql-client`. Also endete `backup.sh` mit Exit 1, der Wartungsweg
// brach ab („Vorversion 1.0.0 läuft weiter, Grund: sicherung"), und der Betreiber hatte am Ende
// KEINE Sicherung — wegen einer Prüfung, die seine Sicherung schützen sollte. Eine Prüfung, die
// das Geprüfte verhindert, ist keine Prüfung, sondern ein Ausfall.
//
// DIE REGEL, die hier gemessen wird: gelesen wird mit dem Werkzeug, DAS DA IST. Abgebrochen wird
// nur, wenn die Datei TATSÄCHLICH nicht lesbar ist — nie, weil ein Werkzeug fehlt. Und jeder Lauf
// sagt, welche der beiden Prüfungen er hatte; die schwächere gibt sich nie als die stärkere aus.
import { describe, expect, it } from "vitest";
import { lauf } from "./lauf";

describe("L9a · ohne pg_restore läuft die Sicherung durch — mit Ersatzprüfung, und sie sagt es", () => {
  it("Exit 0, ein vollständiges Paar, kein Arbeitsstand", () => {
    const r = lauf({ ohneWerkzeug: ["pg_restore"] });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(1);
    const name = r.dumps[0];
    if (name === undefined) throw new Error("ein veröffentlichter Dump erwartet");
    expect(r.dateien, r.dateien.join(" ")).toContain(`${name}.sha256`);
    expect(
      r.dateien.filter((n) => n.endsWith(".partial")),
      r.dateien.join(" "),
    ).toEqual([]);
  });

  it("die Ausgabe nennt den Ersatz, den fehlenden Grund und den Weg zur vollen Prüfung", () => {
    const r = lauf({ ohneWerkzeug: ["pg_restore"] });
    expect(r.ausgabe, r.ausgabe).toContain("Lesepruefung: Ersatz (pg_restore fehlt)");
    expect(r.stderr, r.ausgabe).toContain("NICHT als Archiv geoeffnet");
    expect(r.stderr, r.ausgabe).toContain("postgresql-client");
  });

  it("die Ergebnisspur behauptet NICHT, pg_restore habe gelesen", () => {
    // Ehrlichkeit vor Optik: der schwächere Nachweis darf sich nie als der starke ausgeben.
    const r = lauf({ ohneWerkzeug: ["pg_restore"] });
    const grund = String(r.ergebnis().grund);
    expect(r.ergebnis().ergebnis).toBe("erfolg");
    expect(grund).toContain("Ersatz (pg_restore fehlt)");
    expect(grund).not.toContain("pg_restore --list");
  });

  it("und es wird wirklich kein pg_restore aufgerufen", () => {
    const r = lauf({ ohneWerkzeug: ["pg_restore"] });
    expect(
      r.aufrufe.map((a) => a[0]),
      JSON.stringify(r.aufrufe),
    ).not.toContain("pg_restore");
  });
});

describe("L9b · mit pg_restore läuft die echte Lesepruefung — unverändert", () => {
  it("Exit 0, und der Grund nennt pg_restore --list, nicht den Ersatz", () => {
    const r = lauf();
    expect(r.code, r.ausgabe).toBe(0);
    const grund = String(r.ergebnis().grund);
    expect(grund).toContain("pg_restore --list");
    expect(grund).not.toContain("Ersatz");
    expect(r.ausgabe).not.toContain("Lesepruefung: Ersatz");
  });

  it("`--list` läuft gegen den ARBEITSSTAND, vor jeder Veröffentlichung", () => {
    const r = lauf();
    const liste = r.aufrufe.filter((a) => a[0] === "pg_restore");
    expect(liste.length, JSON.stringify(r.aufrufe)).toBe(1);
    expect(String(liste[0]?.at(-1)), JSON.stringify(liste)).toMatch(/\.dump\.partial$/);
  });

  it("und ein unlesbares Archiv bleibt Exit 4 — der starke Weg wird nicht geschwächt", () => {
    const r = lauf({ modus: "unlesbar" });
    expect(r.code, r.ausgabe).toBe(4);
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
  });
});

describe("L9c · die Ersatzprüfung ist keine Attrappe — sie bricht ab, wenn die Datei nicht taugt", () => {
  it("ein leerer Dump wird auch ohne pg_restore NICHT veröffentlicht (Exit 4)", () => {
    // Die Gegenprobe zu L9a: „Ersatz" darf nicht „durchwinken" heissen. `pg_dump` legt hier eine
    // Datei mit 0 Bytes an — ohne diese Zeile wäre die Ersatzprüfung ein leeres Versprechen.
    const r = lauf({ ohneWerkzeug: ["pg_restore"], modus: "leerer-dump" });
    expect(r.code, r.ausgabe).toBe(4);
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
    expect(
      r.dateien.filter((n) => n.endsWith(".partial")),
      r.dateien.join(" "),
    ).toEqual([]);
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(4);
    expect(String(e.grund)).toContain("leer");
    // Und sie gibt sich auch im Fehlerfall als das aus, was sie ist.
    expect(String(e.grund)).toContain("Ersatz");
  });

  it("scheitert das LESEN selbst, wird ebenfalls nichts veröffentlicht (Exit 4)", () => {
    // BEN hat diesen Fall in Runde 5 gemessen und verlangt ihn dauerhaft (Korrekturpflicht 6):
    // `cat` ist vorhanden, schlägt aber fehl — die Datei lässt sich also nicht vollständig lesen.
    // Das ist der EINZIGE Grund, aus dem der Ersatzweg abbrechen darf: nicht weil ein Werkzeug
    // fehlt, sondern weil die Datei tatsächlich nicht lesbar ist.
    const r = lauf({ ohneWerkzeug: ["pg_restore"], werkzeugFehler: ["cat"], fehlerExit: 7 });
    expect(r.code, r.ausgabe).toBe(4);
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
    expect(
      r.dateien.filter((n) => n.endsWith(".partial") || n.endsWith(".sha256")),
      r.dateien.join(" "),
    ).toEqual([]);
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(4);
    expect(String(e.grund)).toContain("nicht vollstaendig lesen");
  });
});
