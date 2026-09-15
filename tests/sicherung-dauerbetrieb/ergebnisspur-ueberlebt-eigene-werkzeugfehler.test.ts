// ================================================================================================
// JOB 4057 · L7 (BEN R2, Korrekturpflichten 1–3) — DIE ERGEBNISSPUR MUSS AUCH DANN STIMMEN, WENN
// IHR EIGENES WERKZEUG SCHEITERT ODER DER FEHLER NACH DER VERÖFFENTLICHUNG KOMMT.
// ================================================================================================
//
// Runde 2 hat das Sicherheitsnetz gebaut: jeder Ausgang des Prozesses kommt am `trap` vorbei und
// hinterlegt eine Spur. BEN hat zwei Löcher DARIN gemessen, beide mit demselben Muster — die Spur
// sagt etwas, das nicht stimmt:
//
//   L7a  `date` schlägt fehl. Der Ergebnisschreiber ruft `date` SELBST auf, und zwar NACHDEM er
//        sich als „gemeldet" markiert hat. `set -euo pipefail` beendet ihn mitten im Satz: keine
//        neue Spur, kein Hinweis, und das Sicherheitsnetz hält sich für erledigt. Im Verzeichnis
//        bleibt die ERFOLGSSPUR DES VORTAGS bytegleich stehen. Genau die Täuschung aus Runde 1,
//        eine Ebene tiefer: das Netz zerreisst an seinem eigenen Werkzeug.
//
//   L7b  `sort` schlägt fehl. Es steht in der Aufbewahrung, also NACH der Veröffentlichung. Der
//        `trap` behauptete pauschal „es wurde nichts veroeffentlicht" — während Dump und Sidecar
//        vollständig und gültig im Verzeichnis liegen. Eine Sicherung zu bestreiten, die es gibt,
//        ist derselbe Schaden wie eine zu behaupten, die es nicht gibt: der Betreiber legt sie
//        nach dieser Auskunft noch einmal an oder hält sich für ungesichert.
//
// GEMESSEN WIRD MIT DENSELBEN ZAHLEN WIE BEIM PRÜFER: `date` mit Exit 7 nach einem Erfolgslauf,
// `sort` mit Exit 9 bei `BACKUP_KEEP=1`.
import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { folge, lauf, sha256 } from "./lauf";

describe("L7a · der Ergebnisschreiber überlebt sein eigenes fehlschlagendes Werkzeug", () => {
  it("date mit Exit 7 nach einem Erfolg: die alte Erfolgsspur bleibt NICHT unverändert stehen", () => {
    const [vorher, nachher] = folge({}, { werkzeugFehler: ["date"], fehlerExit: 7 });
    if (vorher === undefined || nachher === undefined) throw new Error("zwei Läufe erwartet");
    // Der erste Lauf muss wirklich eine Erfolgsspur hinterlegt haben — sonst misst der zweite nichts.
    expect(vorher.code, vorher.ausgabe).toBe(0);
    expect(vorher.ergebnis().ergebnis).toBe("erfolg");

    expect(nachher.code, nachher.ausgabe).toBe(7);
    // DIE KERNAUSSAGE: was danach im Verzeichnis liegt, darf nicht mehr die alte Erfolgsmeldung
    // sein. Entweder steht dort eine neue Fehlerspur, oder das Skript sagt ausdrücklich, dass es
    // keine hinterlegen konnte. Schweigen plus alte Spur ist die Täuschung.
    const neueSpur =
      nachher.ergebnisRoh !== undefined && nachher.ergebnisRoh !== vorher.ergebnisRoh;
    const hinweis = nachher.stderr.includes("KEIN Ergebnis hinterlegt");
    expect(neueSpur || hinweis, nachher.ausgabe).toBe(true);
  });

  it("die neue Spur nennt den Fehlschlag und den ursprünglichen Exitcode", () => {
    const [, nachher] = folge({}, { werkzeugFehler: ["date"], fehlerExit: 7 });
    if (nachher === undefined) throw new Error("zwei Läufe erwartet");
    const e = nachher.ergebnis();
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(7);
    expect(e.datei).toBeNull();
    expect(e.bytes).toBeNull();
    expect(e.sha256).toBeNull();
  });

  it("ist die Zeit nicht zu ermitteln, steht dort null — keine erfundene Uhrzeit", () => {
    // Wissenslücke statt Erfindung: `date` ist das einzige Werkzeug, das die Zeit kennt. Fällt es
    // aus, ist „zeit" unbekannt. Ein Platzhalter wie „19700101T000000Z" wäre eine Behauptung.
    const [, nachher] = folge({}, { werkzeugFehler: ["date"], fehlerExit: 7 });
    if (nachher === undefined) throw new Error("zwei Läufe erwartet");
    const e = nachher.ergebnis();
    expect(e.zeit).toBeNull();
    expect(String(e.grund)).toContain("Zeitstempel unbekannt");
  });

  it("der gescheiterte Lauf veröffentlicht nichts und lässt keinen Arbeitsstand liegen", () => {
    const [vorher, nachher] = folge({}, { werkzeugFehler: ["date"], fehlerExit: 7 });
    if (vorher === undefined || nachher === undefined) throw new Error("zwei Läufe erwartet");
    expect(nachher.dumps, nachher.dateien.join(" ")).toEqual(vorher.dumps);
    // Und zwar als vollständige PAARE (BEN R3): gleiche Dumpnamen allein sind kein Bestandsnachweis.
    for (const name of vorher.dumps) {
      expect(nachher.inhalt[`${name}.sha256`], nachher.dateien.join(" ")).toBe(
        vorher.inhalt[`${name}.sha256`],
      );
    }
    expect(
      nachher.dateien.filter((n) => n.endsWith(".partial")),
      nachher.dateien.join(" "),
    ).toEqual([]);
  });
});

describe("L7b · ein Fehler NACH der Veröffentlichung bestreitet sie nicht", () => {
  it("sort mit Exit 9 bei BACKUP_KEEP=1: Exit 9, und das gültige Paar bleibt liegen", () => {
    const r = lauf({ keep: "1", werkzeugFehler: ["sort"], fehlerExit: 9 });
    expect(r.code, r.ausgabe).toBe(9);
    expect(r.dumps, r.dateien.join(" ")).toHaveLength(1);
    expect(r.dateien, r.dateien.join(" ")).toContain(`${r.dumps[0]}.sha256`);
  });

  it("weder JSON noch stderr behaupten, es sei nichts veröffentlicht worden", () => {
    const r = lauf({ keep: "1", werkzeugFehler: ["sort"], fehlerExit: 9 });
    const e = r.ergebnis();
    expect(String(e.grund), r.ausgabe).not.toContain("nichts veroeffentlicht");
    expect(r.stderr, r.ausgabe).not.toContain("nichts veroeffentlicht");
    // Und die Meldung auf stderr nennt die Datei, um die es geht — sonst müsste der Betreiber
    // raten, ob die Nacht eine Sicherung gebracht hat.
    expect(r.stderr, r.ausgabe).toContain(String(r.dumps[0]));
  });

  it("jede Aussage der Spur stimmt mit dem tatsächlichen Dateibestand überein", () => {
    // DER ABGLEICH, den BEN verlangt: nicht „die Spur sagt irgendetwas Freundliches", sondern
    // Feld für Feld gegen das, was wirklich im Verzeichnis liegt.
    const r = lauf({ keep: "1", werkzeugFehler: ["sort"], fehlerExit: 9 });
    const name = r.dumps[0];
    if (name === undefined) throw new Error("ein veröffentlichter Dump erwartet");
    const inhalt = r.inhalt[name];
    if (inhalt === undefined) throw new Error("Inhalt des Dumps erwartet");
    const e = r.ergebnis();
    // Der Lauf ist gescheitert — das bleibt er. Aber die Datei, die er erzeugt hat, gibt es.
    expect(e.ergebnis).toBe("fehler");
    expect(e.exitcode).toBe(9);
    expect(e.datei).toBe(name);
    expect(e.bytes).toBe(Buffer.byteLength(inhalt));
    expect(e.sha256).toBe(sha256(inhalt));
    // Und dieselbe Prüfsumme steht im Sidecar, den ein Wiederhersteller liest.
    expect(r.inhalt[`${name}.sha256`]).toBe(`${sha256(inhalt)}  ${name}\n`);
  });

  it("der Grund sagt, WAS nicht abgeschlossen wurde — die Aufbewahrung", () => {
    const r = lauf({ keep: "1", werkzeugFehler: ["sort"], fehlerExit: 9 });
    const grund = String(r.ergebnis().grund);
    expect(grund).toContain("Aufbewahrung");
    expect(grund).toContain(String(r.dumps[0]));
  });

  it("Gegenprobe: ohne Störung meldet derselbe Lauf Erfolg mit Exit 0", () => {
    // Ohne diese Zeile könnte der Fall oben auch von einem generell kaputten BACKUP_KEEP=1 kommen.
    const r = lauf({ keep: "1" });
    expect(r.code, r.ausgabe).toBe(0);
    expect(r.ergebnis().ergebnis).toBe("erfolg");
  });
});
