import { describe, expect, it } from "vitest";
import { assistenzTabellen } from "../../services/app/src/sicherungsumfang";
import { KENNWORT, KO, OBJ, run } from "./drill-probe";

// ==================================================================================================
// ADMIN-13 — DAS PROTOKOLL DER PROBE (`letzter-drill.json`) UND DIE RECHTEPRÜFUNG (GLIED 3b).
// ==================================================================================================
//
// Jeder Ausgang hinterlässt seine Spur neben dem Dump: der bestandene mit Sicherungsstand, Ziel und
// Vergleich in vier Kategorien; der gescheiterte mit Exitcode, festem Grund und dem, was bis dahin
// gemessen war. Gemessen wird am ECHTEN Skript — die Attrappen ersetzen nur die externen Werkzeuge.
interface Kategorie {
  zustand: string;
  tabellen: { tabelle: string; dump: number | null; datenbank: number | null }[];
}
interface Protokoll {
  format: string;
  beginn: string | null;
  zeit: string | null;
  ergebnis: string;
  exitcode: number;
  grund: string;
  sicherung: string;
  pruefsumme: { zustand: string; sha256: string | null };
  ziel: string | null;
  vergleich: {
    beitraege: Kategorie;
    anhaenge: Kategorie & { belegeOhneAnhang: number | null };
    beziehungen: Kategorie;
    rechte: Kategorie & { rollenDump: string | null; rollenDatenbank: string | null };
    /** produkt:20261010:poc-wiederherstellung-export — private Assistenzspeicher, eigene Kategorie. */
    assistenz: Kategorie;
  };
  wissensnachweis: string | null;
}

function protokollAus(r: { protokoll: string; output: string }): Protokoll {
  expect(r.protokoll, `kein Protokoll hinterlegt:\n${r.output}`).not.toBe("");
  return JSON.parse(r.protokoll) as Protokoll;
}

describe("ADMIN-13 · Protokoll der Wiederherstellungsprobe", () => {
  it("P1 bestanden: Datum, Sicherungsstand, isoliertes Ziel, vier Vergleiche — ohne Zugangsdaten", () => {
    const r = run();
    expect(r.code, r.output).toBe(0);
    expect(r.output).toContain("Glied 3b — Rechte: Rollenverteilung der Konten wie im Dump");
    const p = protokollAus(r);
    expect(p.format).toBe("klarwerk-restore-drill");
    expect(p.ergebnis).toBe("erfolg");
    expect(p.exitcode).toBe(0);
    expect(p.beginn).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(p.zeit).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(p.sicherung).toBe("input.dump");
    expect(p.ziel).toBe("fixture_drill");
    // Die Prüfsumme ist NACHGERECHNET — und steht als eigener Befund neben dem Restore.
    expect(p.pruefsumme.zustand).toBe("passt");
    expect(p.pruefsumme.sha256).toMatch(/^[0-9a-f]{64}$/);
    // Die vier Kategorien, jede mit ihren eigenen Tabellen und beiden Zahlen.
    expect(p.vergleich.beitraege.zustand).toBe("gleich");
    expect(p.vergleich.beitraege.tabellen.map((t) => t.tabelle)).toEqual(["kos", "ko_versions"]);
    expect(p.vergleich.anhaenge.zustand).toBe("gleich");
    expect(p.vergleich.anhaenge.tabellen.map((t) => t.tabelle)).toEqual(["objects", "ko_evidence"]);
    expect(p.vergleich.anhaenge.belegeOhneAnhang).toBe(0);
    expect(p.vergleich.beziehungen.zustand).toBe("gleich");
    expect(p.vergleich.beziehungen.tabellen).toEqual([
      { tabelle: "ko_kanten", dump: 2, datenbank: 2 },
      { tabelle: "ko_kanten_beitrag", dump: 2, datenbank: 2 },
    ]);
    expect(p.vergleich.rechte.zustand).toBe("gleich");
    expect(p.vergleich.rechte.rollenDump).toBe("admin/t=1 experte/t=1");
    expect(p.vergleich.rechte.rollenDatenbank).toBe("admin/t=1 experte/t=1");
    expect(p.wissensnachweis).toContain(`Wissensobjekt ${KO} mit Beleg auf ${OBJ}`);
    // KEINE ZUGANGSDATEN: weder Anmeldeadresse noch Kennwort noch Sitzungstoken.
    expect(r.protokoll).not.toContain("fixture@example.test");
    expect(r.protokoll).not.toContain(KENNWORT);
    expect(r.protokoll).not.toContain("kw_session");
    expect(r.protokoll).not.toContain('"token"');
  }, 120_000);

  // produkt:20261010:poc-wiederherstellung-export (PV-01-01): die privaten Assistenzspeicher stehen
  // GETRENNT von Beiträgen und Anhangsbytes im Protokoll — jede Tabelle mit beiden Zahlen.
  it("P1b bestanden: die privaten Assistenzspeicher sind eine eigene, gemessene Kategorie", () => {
    const r = run();
    expect(r.code, r.output).toBe(0);
    const p = protokollAus(r);
    expect(p.vergleich.assistenz.tabellen.map((t) => t.tabelle)).toEqual(assistenzTabellen());
    for (const t of p.vergleich.assistenz.tabellen) {
      expect(t.dump, t.tabelle).not.toBeNull();
      expect(t.datenbank, t.tabelle).toBe(t.dump);
    }
    expect(p.vergleich.assistenz.zustand).toBe("gleich");
  }, 120_000);

  it("P2 Rechte weichen ab: Exit 74, Befund im Protokoll, die Anwendung startet gar nicht", () => {
    const r = run("rechte-abweichung");
    expect(r.code, r.output).toBe(74);
    expect(r.output).toContain("ABBRUCH (74)");
    expect(r.output).not.toContain("DRILL BESTANDEN");
    expect(r.start).toBe("");
    const p = protokollAus(r);
    expect(p.ergebnis).toBe("fehler");
    expect(p.exitcode).toBe(74);
    expect(p.vergleich.rechte.zustand).toBe("abweichend");
    expect(p.vergleich.rechte.rollenDump).toBe("admin/t=1 experte/t=1");
    expect(p.vergleich.rechte.rollenDatenbank).toBe("admin/t=2");
    // Die Zeilenzahl allein hätte den Schaden nicht gesehen: zwei Konten hier wie dort.
    expect(p.vergleich.rechte.tabellen).toEqual([{ tabelle: "users", dump: 2, datenbank: 2 }]);
  }, 120_000);

  it("P3 eine nicht befragbare Rollenverteilung ist nicht messbar (24), kein Befund", () => {
    const r = run("rechte-sql-fehler");
    expect(r.code, r.output).toBe(24);
    expect(r.output).toContain("Rollenverteilung der Datenbank nicht messbar");
    const p = protokollAus(r);
    expect(p.vergleich.rechte.zustand).toBe("nicht_gemessen");
  }, 120_000);

  // K5 — BESCHÄDIGTE ODER UNVOLLSTÄNDIGE SICHERUNG: sichtbarer Fehlbefund, und die Produktion wird
  // nicht überschrieben — bei 10/11/20 läuft `pg_restore` gar nicht erst.
  it.each([
    ["bad-sidecar", 11, "abweichend"],
    ["no-sidecar", 10, "fehlt"],
  ] as const)(
    "P4 beschädigte Sicherung (%s): Exit %i, Prüfsumme %s, kein Restore, alle Vergleiche ungemessen",
    (mode, code, pruefsumme) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.calls).not.toContain('"pg_restore"');
      const p = protokollAus(r);
      expect(p.ergebnis).toBe("fehler");
      expect(p.exitcode).toBe(code);
      expect(p.pruefsumme.zustand).toBe(pruefsumme);
      expect(p.grund).toContain("nichts wiederhergestellt");
      for (const k of ["beitraege", "anhaenge", "beziehungen", "rechte", "assistenz"] as const) {
        expect(p.vergleich[k].zustand, k).toBe("nicht_gemessen");
      }
    },
    120_000,
  );

  it("P5 belegtes Ziel: Exit 20, kein pg_restore, das Protokoll nennt das Ziel", () => {
    const r = run("occupied");
    expect(r.code, r.output).toBe(20);
    expect(r.calls).not.toContain('"pg_restore"');
    const p = protokollAus(r);
    expect(p.exitcode).toBe(20);
    expect(p.ziel).toBe("fixture_drill");
    expect(p.grund).toContain("nicht leer");
  }, 120_000);

  it("P6 unvollständige Sicherung (kein Bestand für ko_evidence): Exit 22, Anhänge nicht gemessen", () => {
    const r = run("toc-missing");
    expect(r.code, r.output).toBe(22);
    const p = protokollAus(r);
    expect(p.ergebnis).toBe("fehler");
    expect(p.vergleich.anhaenge.zustand).toBe("nicht_gemessen");
    expect(p.vergleich.anhaenge.tabellen).toContainEqual({
      tabelle: "ko_evidence",
      dump: null,
      datenbank: null,
    });
  }, 120_000);

  it("P7 Beleg ohne Anhang: Exit 73, Anhänge abweichend, Zahl im Protokoll", () => {
    const r = run("waise");
    expect(r.code, r.output).toBe(73);
    const p = protokollAus(r);
    expect(p.vergleich.anhaenge.zustand).toBe("abweichend");
    expect(p.vergleich.anhaenge.belegeOhneAnhang).toBe(1);
  }, 120_000);
});
