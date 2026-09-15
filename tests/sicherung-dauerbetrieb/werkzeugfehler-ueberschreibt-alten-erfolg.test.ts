// ================================================================================================
// JOB 4057 · L6 (BEN R1, Korrekturpflicht 2) — KEIN AUSGANG OHNE SPUR, AUCH NICHT DER UNERWARTETE.
// ================================================================================================
//
// DER BEFUND, gemessen von BEN am Stand der Runde 1: `shasum` ist VORHANDEN, endet aber mit Exit 7.
// `command -v shasum` findet es, also greift der Abbruch für „kein Hashwerkzeug" nicht;
// `set -euo pipefail` beendete das Skript sofort — vor jeder Ergebnisspur. Im Verzeichnis blieb die
// ERFOLGSSPUR DES VORTAGS stehen: `"ergebnis": "erfolg"`, `"exitcode": 0`.
//
// DAS IST DER SCHWERSTE FEHLER, DEN DIESES PAKET HABEN KANN. Der Betreiber liest „letzter Lauf
// erfolgreich", während der letzte Lauf gescheitert ist und nichts veröffentlicht hat — genau die
// Täuschung, gegen die die Datei gebaut wurde, eine Ebene tiefer.
//
// DESHALB WIRD HIER IN FOLGE GEMESSEN, im SELBEN Zielverzeichnis, wie im Dauerbetrieb: erst ein
// erfolgreicher Lauf, dann der gescheiterte. Ein frischer Lauf in einem leeren Verzeichnis kann
// über das Überschreiben einer alten Spur nichts sagen (das war die Prüflücke in Runde 1).
import { describe, expect, it } from "vitest";
import { folge, lauf } from "./lauf";

describe("L6 · ein fehlschlagendes Werkzeug ersetzt die alte Erfolgsspur", () => {
  it("shasum mit Exit 7 nach einem Erfolg: Exit 7 und ergebnis=fehler", () => {
    const [erst, dann] = folge({}, { werkzeugFehler: ["shasum", "sha256sum"], fehlerExit: 7 });
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    // Der erste Lauf hat wirklich eine Erfolgsspur hinterlegt — sonst prüft der zweite nichts.
    expect(erst.code, erst.ausgabe).toBe(0);
    expect(erst.ergebnis().ergebnis).toBe("erfolg");

    expect(dann.code, dann.ausgabe).toBe(7);
    const e = dann.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(7);
    expect(e.datei).toBeNull();
    expect(e.bytes).toBeNull();
    expect(e.sha256).toBeNull();
  });

  it("der gescheiterte Lauf veröffentlicht nichts und lässt keinen Arbeitsstand liegen", () => {
    const [erst, dann] = folge({}, { werkzeugFehler: ["shasum", "sha256sum"], fehlerExit: 7 });
    if (erst === undefined || dann === undefined) throw new Error("zwei Läufe erwartet");
    // Die Sicherung des ERSTEN Laufs bleibt selbstverständlich liegen — sie ist gültig. Geprüft
    // wird das PAAR, nicht der Dumpname (BEN R3): ein Dump ohne Sidecar ist kein Backup mehr.
    expect(dann.dumps, dann.dateien.join(" ")).toEqual(erst.dumps);
    for (const name of erst.dumps) {
      expect(dann.inhalt[name], dann.dateien.join(" ")).toBe(erst.inhalt[name]);
      expect(dann.inhalt[`${name}.sha256`], dann.dateien.join(" ")).toBe(
        erst.inhalt[`${name}.sha256`],
      );
    }
    expect(
      dann.dateien.filter((n) => n.endsWith(".partial")),
      dann.dateien.join(" "),
    ).toEqual([]);
  });

  it("die Meldung sagt, dass ein Werkzeug fehlschlug — nicht bloß „fertig“", () => {
    const [, dann] = folge({}, { werkzeugFehler: ["shasum", "sha256sum"], fehlerExit: 7 });
    if (dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(dann.stderr, dann.ausgabe).toContain("Exit 7");
    expect(dann.stdout).not.toContain("[backup] fertig");
  });

  it("derselbe Schutz trägt bei jedem Exitcode und jedem Werkzeug (wc mit Exit 9)", () => {
    // `wc` steht NACH der Prüfsumme und vor der Veröffentlichung. Der Schutz hängt nicht an einer
    // Liste bekannter Stellen, sondern am Ausgang des Prozesses — deshalb muss auch dieser Fall
    // eine Spur hinterlassen, ohne dass jemand `wc` einzeln vorgesehen hat.
    const r = lauf({ werkzeugFehler: ["wc"], fehlerExit: 9 });
    expect(r.code, r.ausgabe).toBe(9);
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(9);
    expect(e.datei).toBeNull();
  });

  it("fehlt jedes Hashwerkzeug, bleibt es beim eigenen Exit 3 mit eigener Begründung", () => {
    // Abgrenzung zum Fall oben: FEHLEN ist etwas anderes als FEHLSCHLAGEN, und der bestehende
    // Abbruch mit Exit 3 (JOB 517) darf durch das Sicherheitsnetz nicht verdrängt werden.
    const r = lauf({ ohneWerkzeug: ["shasum", "sha256sum"] });
    expect(r.code, r.ausgabe).toBe(3);
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(3);
    expect(String(e.grund)).toContain("shasum");
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
  });

  it("scheitert die Veröffentlichung selbst, wird KEIN Erfolg behauptet", () => {
    // `mv` ist das Werkzeug der Veröffentlichung UND das der Ergebnisspur. Scheitert es, kann das
    // Skript nichts hinterlegen — dann sagt es genau das, statt „fertig" zu melden.
    const r = lauf({ werkzeugFehler: ["mv"] });
    expect(r.code, r.ausgabe).not.toBe(0);
    expect(r.dumps, r.dateien.join(" ")).toEqual([]);
    expect(r.ausgabe).toContain("KEIN Ergebnis hinterlegt");
    expect(r.stdout).not.toContain("[backup] fertig");
    expect(r.ergebnisRoh, "eine Spur wäre hier eine Lüge").toBeUndefined();
  });

  it("scheitert das Aufräumen, bleibt die Sicherung gültig — und der Grund nennt den Rest", () => {
    // Die SICHERUNG ist erfolgreich (sie liegt da, gelesen und beglaubigt). Aber die
    // Aufbewahrungsregel wurde nicht eingehalten, und ein „erfolg" ohne diesen Zusatz würde
    // behaupten, dass auch aufgeräumt wurde.
    const r = lauf({
      keep: "1",
      altstempel: ["20260901T010000Z", "20260902T010000Z"],
      werkzeugFehler: ["rm"],
    });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.dumps.length, r.dateien.join(" ")).toBe(3);
    expect(r.stderr, r.ausgabe).toContain("NICHTS entfernt");
    const e = r.ergebnis();
    expect(e.ergebnis).toBe("erfolg");
    expect(String(e.grund)).toContain("Aufbewahrung unvollstaendig");
    expect(String(e.grund)).toContain("2");
  });

  it("die Erfolgsspur eines gelungenen Folgelaufs trägt keinen Vorbehalt", () => {
    // Gegenprobe zur Zeile darüber: ohne Störung darf der Zusatz NICHT auftauchen, sonst wäre er
    // ein Etikett statt einer Aussage.
    const [, dann] = folge({}, { keep: "2" });
    if (dann === undefined) throw new Error("zwei Läufe erwartet");
    expect(dann.code, dann.ausgabe).toBe(0);
    expect(String(dann.ergebnis().grund)).not.toContain("unvollstaendig");
    expect(dann.ergebnis().ergebnis).toBe("erfolg");
  });
});
