// ================================================================================================
// JOB 4057 · BEN R6 — EIN FREI GEWORDENER NAME DARF NIE WIEDER VERGEBEN WERDEN.
// ================================================================================================
//
// GEMESSEN HAT DAS BEN: fünf Läufe in DERSELBEN Sekunde, `BACKUP_KEEP=2`. Übrig blieben Lauf 3
// und Lauf 5 — eine JÜNGERE Sicherung war gelöscht, eine ÄLTERE behalten.
//
// Warum: die Ausweichnamen waren „der nächste FREIE", und die Aufbewahrung reiht lexikalisch.
//   Lauf 1 → …Z.dump · Lauf 2 → …Z_02 · Lauf 3 → …Z_03, entfernt das älteste (…Z.dump)
//   Lauf 4 → der Grundname ist wieder FREI, also …Z.dump — und damit steht der JÜNGSTE Lauf
//            lexikalisch VOR …Z_03 aus Lauf 3.
//   Lauf 5 → …Z_02 (frei), Aufbewahrung entfernt das „älteste": …Z.dump = Lauf 4.
//
// DESHALB PRÜFT DIESER FALL INHALTE, PAARE UND HASHES, NICHT ANZAHLEN. Eine reine Zählprüfung
// bestand den Fehler anstandslos: es lagen jederzeit genau zwei vollständige Paare da, nur die
// falschen. Die Attrappe schreibt je Lauf andere Bytes (`lauf.ts`, DUMP_MARKE), daran ist jede
// Sicherung ihrem Lauf zuzuordnen.
import { describe, expect, it } from "vitest";
import { type Lauf, folge, sha256 } from "./lauf";

/** Der Endname, den ein Lauf für sich gewählt hat — aus seiner eigenen Zeile `Dump nach: …`. */
function gewaehlterEndname(lauf: Lauf): string {
  const treffer = /\[backup\] Dump nach: (.*)\n/.exec(lauf.stdout);
  if (treffer?.[1] === undefined) throw new Error(`keine Zeile „Dump nach:" in:\n${lauf.ausgabe}`);
  const pfad = treffer[1];
  const name = pfad.slice(pfad.lastIndexOf("/") + 1);
  return name;
}

/** Der Inhalt, den die Attrappe für Lauf `n` schreibt. */
function inhaltVonLauf(n: number): string {
  return `PGDMP attrappe lauf ${n}\n`;
}

/**
 * Jedes verbliebene `*.dump` hat seinen Sidecar, und der Sidecar trägt den Hash GENAU DIESER Bytes
 * mit GENAU DIESEM Endnamen. Ohne diese Nachrechnung würde ein vertauschtes Paar durchgehen.
 */
function paareGeprueft(lauf: Lauf): string[] {
  for (const name of lauf.dumps) {
    const bytes = lauf.inhalt[name];
    if (bytes === undefined) throw new Error(`Dump ${name} nicht lesbar`);
    expect(lauf.inhalt[`${name}.sha256`], `Sidecar zu ${name}`).toBe(`${sha256(bytes)}  ${name}\n`);
  }
  return lauf.dumps.map((name) => lauf.inhalt[name] ?? "");
}

describe("Aufbewahrung im Dauerbetrieb: Namen werden nie wiederverwendet", () => {
  for (const gleicheSekunde of [true, false]) {
    it(`fünf Läufe, BACKUP_KEEP=2 — es bleiben Lauf 4 und 5 (gleiche Sekunde: ${gleicheSekunde})`, () => {
      const laeufe = folge(
        ...Array.from({ length: 5 }, (_, i) => ({
          keep: "2",
          festerStempel: gleicheSekunde ? "20260915T010203Z" : `20260915T01020${i + 3}Z`,
        })),
      );

      // Jeder Lauf ist für sich erfolgreich — der Fehler steckt nicht im Sichern, sondern im Räumen.
      for (const [stelle, r] of laeufe.entries()) {
        expect(r.code, `Lauf ${stelle + 1}:\n${r.ausgabe}`).toBe(0);
      }

      // KEIN NAME ZWEIMAL. Das ist die Regel selbst, nicht nur ihre Wirkung.
      const namen = laeufe.map(gewaehlterEndname);
      expect(new Set(namen).size, `vergebene Endnamen: ${namen.join(", ")}`).toBe(5);

      // Nach JEDEM Lauf ab dem zweiten: genau die zwei jüngsten, an ihren Bytes erkannt.
      for (let i = 1; i < laeufe.length; i += 1) {
        const r = laeufe[i];
        if (r === undefined) throw new Error(`Lauf ${i + 1} fehlt`);
        expect(
          paareGeprueft(r).sort(),
          `nach Lauf ${i + 1} (Namen: ${r.dumps.join(", ")})`,
        ).toEqual([inhaltVonLauf(i), inhaltVonLauf(i + 1)].sort());
      }

      // Die Ergebnisspur des letzten Laufs sagt Erfolg — und meint diesen Lauf.
      const letzter = laeufe[4];
      if (letzter === undefined) throw new Error("fünfter Lauf fehlt");
      expect(letzter.ergebnis().ergebnis).toBe("erfolg");
      expect(letzter.ergebnis().datei).toBe(gewaehlterEndname(letzter));
    });
  }

  it("ein freier Grundname wird nicht wieder vergeben, sondern die Nummer zählt weiter hoch", () => {
    // Drei Läufe gleicher Sekunde mit KEEP=2: Lauf 3 räumt den Grundnamen weg. Lauf 4 darf ihn
    // NICHT erben — sonst steht der jüngste Stand lexikalisch vor dem älteren `_03`.
    const laeufe = folge(
      ...Array.from({ length: 4 }, () => ({ keep: "2", festerStempel: "20260915T044455Z" })),
    );
    for (const [stelle, r] of laeufe.entries()) {
      expect(r.code, `Lauf ${stelle + 1}:\n${r.ausgabe}`).toBe(0);
    }
    const vierter = laeufe[3];
    if (vierter === undefined) throw new Error("vierter Lauf fehlt");
    expect(gewaehlterEndname(vierter)).toBe("klarwerk-20260915T044455Z_04.dump");
    expect(vierter.dumps).toEqual([
      "klarwerk-20260915T044455Z_03.dump",
      "klarwerk-20260915T044455Z_04.dump",
    ]);
    expect(paareGeprueft(vierter).sort()).toEqual([inhaltVonLauf(3), inhaltVonLauf(4)].sort());
  });
});
