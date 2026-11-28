import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";
import { run } from "./drill-probe";

describe("Restore-Drill: Aufbaufehler und Prozesszuordnung", () => {
  it.each([
    ["beleg-403", 62],
    ["anhang-403", 62],
    ["beleg-sql-fehler", 62],
    // Die Trennung gilt auch für die neuen Schritte: ein unbefragbarer Bestand, eine unlesbare
    // Zahl, eine unvollständige Zeile und eine Antwort, die keine JSON-Liste ist, sind
    // AUFBAUFEHLER — sie dürfen nie wie ein Befund am Bestand aussehen.
    ["waisen-sql-fehler", 62],
    ["waisen-unlesbar", 62],
    ["kandidat-unvollstaendig", 62],
    ["beleg-unlesbar", 62],
  ] as const)(
    "Aufbaufehler (%s) endet mit %i und sagt ausdrücklich, dass es KEIN Befund ist",
    (mode, code) => {
      const r = run(mode);
      expect(r.code, r.output).toBe(code);
      expect(r.output).toContain("ABBRUCH (62)");
      expect(r.output).toContain("KEIN Befund am Bestand");
    },
    120_000,
  );

  // JOB 4010: DIESELBE ZUSAGE, SCHÄRFER GEMESSEN. Vorher stand in der PID-Datei die PID der
  // Drill-Shell selbst, und belegt wurde nur „die Attrappe bekam kein SIGTERM". Das war schwächer
  // als die Zusage: Seit der Zuordnung über die Prozessgruppe gehört die Attrappe ja zur EIGENEN
  // Nachkommenschaft — sie MUSS abgeräumt werden, sonst bliebe eine Waise auf dem Drill-Port
  // zurück. Gemessen wird jetzt, worauf es ankommt: ein WIRKLICH fremder Prozess in eigener
  // Prozessgruppe lebt danach nachweislich noch, der Drill endet mit 80, und trotzdem läuft von
  // seinem eigenen Start nichts weiter.
  it("Reaping lehnt eine fremde PID ab, ohne sie anzufassen — und räumt die eigene trotzdem ab", () => {
    const fremd = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], {
      detached: true,
      stdio: "ignore",
    });
    fremd.unref();
    const fremdPid = fremd.pid as number;
    try {
      const r = run("foreign-pid", fremdPid);
      expect(r.code, r.output).toBe(80);
      expect(r.output).toContain("Es wird KEIN Signal an ihn gesendet.");
      expect(r.output).toContain(`PID-Datei nennt ${fremdPid}`);
      let fremdLebt = true;
      try {
        process.kill(fremdPid, 0);
      } catch {
        fremdLebt = false;
      }
      expect(fremdLebt).toBe(true);
      expect(r.terminated).toBe("yes");
      expect(r.pidRemains).toBe(false);
    } finally {
      try {
        process.kill(fremdPid, "SIGKILL");
      } catch {
        /* Already exited. */
      }
    }
  }, 120_000);
});
