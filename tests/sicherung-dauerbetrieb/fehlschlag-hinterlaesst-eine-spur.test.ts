// ================================================================================================
// JOB 4057 · L3 — EIN FEHLSCHLAG HINTERLIESS NICHTS.
// ================================================================================================
//
// Das Skript endete mit Exit 1 oder 3 in einem Cron-Log, das niemand liest. Im Sicherungs-
// verzeichnis war „gestern ist die Sicherung gescheitert" nicht von „gestern lief kein Cron"
// zu unterscheiden — beides sah gleich aus: die jüngste Datei ist von vorgestern.
//
// AB JETZT HINTERLÄSST JEDER LAUF EINE ZEILE, der gescheiterte zuerst: `letzter-lauf.json` im
// Zielverzeichnis. Damit das für die FRÜHEN Abbrüche überhaupt möglich ist, entsteht das
// Zielverzeichnis VOR den Umgebungsprüfungen — vorher lag es dahinter, und genau deshalb konnte
// ein Abbruch nichts hinterlegen.
//
// WAS DIE DATEI NICHT SAGT: „alles in Ordnung" oder „eine Sicherung ist vorhanden". Sie sagt
// ausschliesslich, was der LETZTE LAUF getan hat. Ob eine brauchbare Sicherung existiert,
// beantwortet das Verzeichnis.
import { describe, expect, it } from "vitest";
import { folge, lauf } from "./lauf";

const FELDER = ["zeit", "ergebnis", "grund", "exitcode", "datei", "bytes", "sha256"] as const;

describe("L3 · der gescheiterte Lauf hinterlässt eine maschinenlesbare Spur", () => {
  it("ohne DB-URL: Exit 1 und letzter-lauf.json mit ergebnis=fehler", () => {
    const r = lauf({ dbUrl: null });
    expect(r.code, r.ausgabe).toBe(1);
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(1);
  });

  it("der Grund nennt die fehlende Konfiguration", () => {
    const r = lauf({ dbUrl: null });
    const grund = String(r.ergebnis().grund);
    expect(grund).toContain("KLARWERK_DATABASE_URL");
    expect(grund).toContain("DATABASE_URL");
  });

  it("kein Teilwert, der wie ein Erfolg aussieht", () => {
    const r = lauf({ dbUrl: null });
    const e = r.ergebnis();
    expect(e.datei).toBeNull();
    expect(e.bytes).toBeNull();
    expect(e.sha256).toBeNull();
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
  });

  it("genau die sieben vereinbarten Felder, keines mehr, keines weniger", () => {
    const r = lauf({ dbUrl: null });
    expect(Object.keys(r.ergebnis()).sort()).toEqual([...FELDER].sort());
  });

  it("die Zeit steht im Format des Skripts (UTC, sortierbar)", () => {
    const r = lauf({ dbUrl: null });
    expect(String(r.ergebnis().zeit)).toMatch(/^\d{8}T\d{6}Z$/);
  });

  it("fehlendes pg_dump hinterlässt dieselbe Spur", () => {
    const r = lauf({ ohneWerkzeug: ["pg_dump"] });
    expect(r.code, r.ausgabe).toBe(1);
    expect(r.ergebnis().ergebnis).toBe("fehler");
    expect(String(r.ergebnis().grund)).toContain("pg_dump");
  });

  it("fehlendes pg_restore ist KEIN Abbruchgrund mehr — die Ersatzprüfung trägt den Lauf", () => {
    // ABGELÖSTE ZUSAGE (Tor Runde 4): Bis Runde 4 endete dieser Fall mit Exit 1. Das Tor hat
    // gezeigt, was das anrichtet — `tests/insel-update/sicherung-eindeutig.test.ts` (JOB 4012)
    // läuft ohne `postgresql-client`, und der Wartungsweg brach ab. Eine Lesepruefung, die die
    // Sicherung unmöglich macht, schützt nichts. Die Einzelheiten der Ersatzprüfung misst
    // `lesepruefung-nimmt-das-werkzeug-das-da-ist.test.ts`; hier zählt nur: kein Exit 1.
    const r = lauf({ ohneWerkzeug: ["pg_restore"] });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(1);
  });

  it("gescheiterter pg_dump: Spur da, Exitcode des Werkzeugs erhalten, nichts liegen geblieben", () => {
    const r = lauf({ modus: "dump-fehler" });
    expect(r.code, r.ausgabe).toBe(2);
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(2);
    expect(r.dateien, r.dateien.join(" ")).toEqual(["letzter-lauf.json"]);
  });

  it("die Erfolgsspur ist vollständig gefüllt und trägt genau die sieben Felder", () => {
    const r = lauf();
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("erfolg");
    expect(e.datei).toBe(r.dumps[0]);
    // Dieselbe Zahl, die das Skript auf stdout meldet, und die echte Dateigröße.
    expect(e.bytes).toBe(Buffer.byteLength(r.inhalt[String(e.datei)] ?? "", "utf8"));
    expect(r.stdout).toContain(`${String(e.bytes)} Bytes`);
    expect(e.sha256).toBe((r.inhalt[`${String(e.datei)}.sha256`] ?? "").slice(0, 64));
    expect(String(e.sha256)).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(e).sort()).toEqual([...FELDER].sort());
  });

  it("ein erfolgreicher Lauf überschreibt die FEHLERSPUR des vorigen im selben Verzeichnis", () => {
    // Bis BEN R1 stand hier nur ein frischer Erfolgslauf in einem LEEREN Verzeichnis — der kann über
    // ein Überschreiben nichts sagen. Gemessen wird deshalb in Folge: erst Fehler, dann Erfolg.
    const [erst, dann] = folge({ dbUrl: null }, {});
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(erst.code, erst.ausgabe).toBe(1);
    expect(erst.ergebnis().ergebnis).toBe("fehler");

    expect(dann.code, dann.ausgabe).toBe(0);
    const e = dann.ergebnis();
    expect(e.ergebnis).toBe("erfolg");
    expect(e.exitcode).toBe(0);
    expect(e.datei).toBe(dann.dumps[0]);
    expect(String(e.sha256)).toMatch(/^[0-9a-f]{64}$/);
    // Kein Rest des Fehlerdatensatzes bleibt stehen.
    expect(String(dann.ergebnisRoh)).not.toContain("fehler");
    expect(Object.keys(e).sort()).toEqual([...FELDER].sort());
  });

  it("und umgekehrt: ein Fehlschlag überschreibt die ERFOLGSSPUR des vorigen Laufs", () => {
    const [erst, dann] = folge({}, { modus: "unlesbar" });
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(erst.ergebnis().ergebnis).toBe("erfolg");
    expect(dann.code, dann.ausgabe).toBe(4);
    const e = dann.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(4);
    expect(e.datei).toBeNull();
    // Die gültige Sicherung des ersten Laufs bleibt liegen — sie ist ja in Ordnung. GEPRÜFT WIRD
    // DAS PAAR, NICHT DER DUMPNAME (BEN R3, Korrekturpflicht 2): gleiche Dumpnamen allein sind kein
    // Bestandsnachweis — genau darunter verschwand in Runde 3 unbemerkt ein Sidecar, und ein Dump
    // ohne Prüfsumme ist nach `RESTORE.md` kein einspielbares Backup mehr.
    expect(dann.dumps, dann.dateien.join(" ")).toEqual(erst.dumps);
    for (const name of erst.dumps) {
      expect(dann.inhalt[name], dann.dateien.join(" ")).toBe(erst.inhalt[name]);
      expect(dann.inhalt[`${name}.sha256`], dann.dateien.join(" ")).toBe(
        erst.inhalt[`${name}.sha256`],
      );
    }
  });

  it("die Datei ist gültiges JSON, kein halber Datensatz", () => {
    const r = lauf();
    expect(() => JSON.parse(String(r.ergebnisRoh))).not.toThrow();
    // Kein Arbeitsname bleibt liegen — geschrieben wird atomar über ein Umbenennen.
    expect(
      r.dateien.filter((n) => n.includes("letzter-lauf") && n !== "letzter-lauf.json"),
    ).toEqual([]);
  });
});
