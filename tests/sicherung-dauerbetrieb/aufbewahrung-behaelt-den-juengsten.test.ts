// ================================================================================================
// JOB 4057 · L2 — AUFBEWAHRUNG, DIE DEN JÜNGSTEN STAND NIE ANFASST.
// ================================================================================================
//
// Die Aufbewahrung war ein Satz Prosa (`scripts/backup/RESTORE.md:42`: „z. B.
// `find /data/backups -mtime +14 -delete`") und ein Vorschlag im Runbook. Das Skript tat nichts
// davon: nach zwölf Wochen nächtlichem Cron lag die Platte voll, und die NÄCHSTE Sicherung
// scheiterte — an einer Aufgabe, die jahrelang funktioniert hatte.
//
// `BACKUP_KEEP` ist die angesagte Regel. Gemessen wird hier die gefährlichste Zusage von allen:
// die SOEBEN veröffentlichte Sicherung wird nie gelöscht. Ein naives „lösche alles bis auf n"
// über eine Liste, die die neue Datei mitzählt, kann genau sie treffen — und dann hat das
// Aufräumen den Bestand vernichtet, den es schützen sollte.
import { describe, expect, it } from "vitest";
import { altInhalt, lauf, sha256 } from "./lauf";

const ALT = [
  "20260901T010000Z",
  "20260902T010000Z",
  "20260903T010000Z",
  "20260904T010000Z",
  "20260905T010000Z",
] as const;

describe("L2 · BACKUP_KEEP räumt auf und lässt den jüngsten Stand stehen", () => {
  it("behält genau drei vollständige Paare, darunter das neue", () => {
    const r = lauf({ keep: "3", altstempel: ALT });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(3);
    // Die drei ältesten sind weg, die zwei jüngsten Altpaare und das neue sind da.
    expect(r.dumps).toContain(`klarwerk-${ALT[3]}.dump`);
    expect(r.dumps).toContain(`klarwerk-${ALT[4]}.dump`);
    const neu = r.dumps.filter((n) => !ALT.some((s) => n === `klarwerk-${s}.dump`));
    expect(neu.length, r.dumps.join(" ")).toBe(1);
  });

  it("jeder verbliebene Dump hat seinen Sidecar — es entsteht nie ein Paar ohne Prüfsumme", () => {
    const r = lauf({ keep: "3", altstempel: ALT });
    for (const dump of r.dumps) expect(r.dateien, r.dateien.join(" ")).toContain(`${dump}.sha256`);
    const sidecars = r.dateien.filter((n) => n.endsWith(".sha256"));
    expect(sidecars.length, r.dateien.join(" ")).toBe(r.dumps.length);
  });

  it("die entfernten Namen stehen in der Ausgabe", () => {
    const r = lauf({ keep: "3", altstempel: ALT });
    for (const stempel of [ALT[0], ALT[1], ALT[2]]) {
      expect(r.stdout, r.ausgabe).toContain(`klarwerk-${stempel}.dump`);
    }
    expect(r.stdout, r.ausgabe).toContain("BACKUP_KEEP");
    // Was BLEIBT, wird nicht als entfernt gemeldet.
    expect(r.stdout).not.toContain(`klarwerk-${ALT[4]}.dump`);
  });

  it("BACKUP_KEEP=1 lässt genau die neue Sicherung übrig", () => {
    const r = lauf({ keep: "1", altstempel: ALT });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(1);
    expect(
      ALT.some((s) => r.dumps[0] === `klarwerk-${s}.dump`),
      r.dumps.join(" "),
    ).toBe(false);
  });

  it("ein Altstand mit Zeitstempel in der ZUKUNFT: die neue Sicherung bleibt trotzdem", () => {
    // HIER UND NUR HIER wirkt die Zusage (a) wirklich. Solange die neue Sicherung den jüngsten
    // Namen trägt, steht sie ohnehin am Ende der Liste und wird nie erreicht — ein Prüfstand, der
    // nur diesen Fall kennt, würde das Entfernen der Schutzbedingung nicht merken (gemessen am
    // 14.09.: Gegenprobe B blieb ohne diesen Fall grün).
    //
    // Ein Stempel aus der Zukunft ist kein erfundenes Szenario: eine falsch gestellte Uhr im
    // Container, ein aus einem anderen System kopierter Dump — und die neue Sicherung ist plötzlich
    // die ÄLTESTE der Liste, also die erste Kandidatin fürs Löschen.
    const r = lauf({ keep: "1", altstempel: ["20990101T000000Z"] });
    expect(r.code, r.ausgabe).toBe(0);
    const neu = r.dumps.filter((n) => n !== "klarwerk-20990101T000000Z.dump");
    expect(neu.length, r.dateien.join(" ")).toBe(1);
    // Und die Ergebnisspur nennt keine Datei, die es nicht mehr gibt.
    expect(r.dateien, r.dateien.join(" ")).toContain(String(r.ergebnis().datei));
  });

  it("die verbliebenen Altdumps sind unverändert, nicht neu geschrieben", () => {
    const r = lauf({ keep: "3", altstempel: ALT });
    expect(r.inhalt[`klarwerk-${ALT[4]}.dump`]).toBe(altInhalt(ALT[4]));
    expect(r.inhalt[`klarwerk-${ALT[4]}.dump.sha256`]).toContain(sha256(altInhalt(ALT[4])));
  });

  it("weniger Sicherungen als BACKUP_KEEP: es wird nichts entfernt", () => {
    const r = lauf({ keep: "9", altstempel: ALT });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(6);
  });

  it("die Reihung kommt aus dem Dateinamen, nicht aus der Änderungszeit", () => {
    // Ein Kopiervorgang verstellt mtime, den Namen nicht. Der ÄLTESTE Name wurde hier ZULETZT
    // geschrieben (Reihenfolge der Anlage); trotzdem muss er der Erste sein, der geht.
    const r = lauf({ keep: "2", altstempel: [ALT[4], ALT[3], ALT[0]] });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps, r.dateien.join(" ")).not.toContain(`klarwerk-${ALT[0]}.dump`);
    expect(r.dumps, r.dateien.join(" ")).toContain(`klarwerk-${ALT[4]}.dump`);
  });
});
