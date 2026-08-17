// ================================================================================================
// JOB 508 · D8 — DER VERTRAG DES TITELVORSCHLAGS AN DER DIENSTGRENZE
// ================================================================================================
//
// Diese Datei misst NICHT die Innerei aus `titel-vorschlag.ts` — das tun die Einheitentests daneben.
// Sie misst, was ein Aufrufer VON AUSSEN verlangen darf: welche Namen es gibt, dass die vier
// Ehrlichkeitszusagen auch von hier gelten, und dass die Ableitung ohne jeden Dienst auskommt.
//
// ================================================================================================
// EINE OFFENE STELLE, DIE HIER STEHEN MUSS STATT NUR IM BERICHT.
// ================================================================================================
//
// Der Auftrag verlangt in Pflichtlieferung 3 die Anbindung in `services/reasoner/src/index.ts`.
// DIESEN PFAD GIBT ES NICHT — und zwar nicht zufällig: KEIN einziges Modul dieses Repos führt eine
// `src/index.ts`. Die Dienstgrenze liegt überall auf `services/<modul>/index.ts`, und genau diesen
// Pfad nennt auch die Spezifikation (D7 §5.3: „`services/reasoner/index.ts` — Fassadenexport").
//
// `services/reasoner/index.ts` ist in der Lease dieses Durchgangs NICHT freigegeben, und die Lease
// sagt ausdrücklich: „Wird ein weiterer Pfad noetig, ist das ein BLOCKIERT … nicht ein stiller
// fuenfter Write." Der Fassadenexport bleibt deshalb offen; er ist in der Rückgabe mit Pfad,
// gemessenem Pin und der exakt nötigen Zeile ausgewiesen.
//
// V4 unten ist der VORBEREITUNGSWÄCHTER dafür. Er ist heute leer wahr — das sage ich hier deutlich,
// damit ihn niemand als Beleg für eine Anbindung liest, die es noch nicht gibt. Sobald die Zeile in
// der Fassade steht, greift er und verhindert die schlechtere Auflösung: eine zweite Kopie der
// Ableitung neben der einen kanonischen.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TITEL_MAX_ZEICHEN, titelVorschlag } from "../../services/reasoner/src/titel-vorschlag";
import type { DescribeImageResult } from "../../services/reasoner/src/types";

const WURZEL = join(__dirname, "..", "..");
const MODUL = join(WURZEL, "services/reasoner/src/titel-vorschlag.ts");
const FASSADE = join(WURZEL, "services/reasoner/index.ts");

function beschreibung(over: Partial<DescribeImageResult> = {}): DescribeImageResult {
  return { text: "Ein Kegelradgetriebe mit offener Schutzhaube", demo: false, ...over };
}

describe("JOB508 · Vertrag an der Dienstgrenze", () => {
  it("V1: die öffentliche Fläche trägt genau die vereinbarten Namen", () => {
    expect(typeof titelVorschlag).toBe("function");
    expect(typeof TITEL_MAX_ZEICHEN).toBe("number");
    expect(TITEL_MAX_ZEICHEN).toBeGreaterThan(0);
    // Ein Aufrufer bekommt Titel UND Grund — nie nur eine Zeichenkette, die er deuten müsste.
    const e = titelVorschlag(beschreibung());
    expect(Object.keys(e).sort()).toEqual(["grund", "titel"]);
  });

  it("V2: die vier Ehrlichkeitszusagen gelten auch von außerhalb des Moduls", () => {
    expect(titelVorschlag(beschreibung({ text: null }))).toEqual({
      titel: null,
      grund: "kein_text",
    });
    expect(titelVorschlag(beschreibung({ demo: true }))).toEqual({ titel: null, grund: "demo" });
    expect(titelVorschlag(beschreibung({ fallbackReason: "confidential" }))).toEqual({
      titel: null,
      grund: "vertraulich",
    });
    expect(titelVorschlag(beschreibung({ text: "   " }))).toEqual({ titel: null, grund: "leer" });
  });

  it("V3: die Ableitung braucht keinen Dienst — sie bindet zur Laufzeit nichts ein", () => {
    const quelle = readFileSync(MODUL, "utf8");
    // Der einzige Import ist ein TYP-Import; er verschwindet zur Laufzeit restlos. Damit kann diese
    // Ableitung weder ein Modell rufen noch eine Verbindung öffnen — belegt an der Quelle, nicht
    // an der Absicht.
    const laufzeitImporte = (quelle.match(/^import (?!type )/gmu) ?? []).length;
    expect(laufzeitImporte, "ein Laufzeit-Import wäre ein möglicher Dienstaufruf").toBe(0);
    expect(quelle).not.toMatch(/\bfetch\s*\(/u);
    expect(quelle).not.toMatch(/process\.env/u);
  });

  it("V4 (Vorbereitungswächter, heute LEER WAHR): trägt die Fassade den Export, ist es DIESE Funktion", async () => {
    const fassade = (await import("../../services/reasoner")) as Record<string, unknown>;
    const ausFassade = fassade.titelVorschlag;
    if (ausFassade === undefined) {
      // Erwarteter Zustand dieses Durchgangs — die Fassade ist nicht geleast. Der Fall behauptet
      // hier NICHTS über die Anbindung; er hält nur fest, dass es keine zweite Ableitung gibt.
      expect(readFileSync(FASSADE, "utf8")).not.toContain("titel-vorschlag");
      return;
    }
    // Sobald der Export steht: dieselbe Funktion, keine Kopie. Eine zweite Ableitung neben der
    // einen kanonischen wäre die schlechtere Auflösung (Regel „EINE kanonische Quelle").
    expect(ausFassade).toBe(titelVorschlag);
  });

  it("V5: die Dienstgrenze dieses Moduls ist services/reasoner/index.ts — es gibt keine src/index.ts", () => {
    // Der architektonische Befund, auf dem der offene Punkt aus dem Kopf beruht. Er bleibt auch
    // dann gültig, wenn die Fassade später den Export trägt — deshalb ist er hier festgehalten und
    // nicht nur im Bericht.
    expect(() => readFileSync(FASSADE, "utf8")).not.toThrow();
    expect(() => readFileSync(join(WURZEL, "services/reasoner/src/index.ts"), "utf8")).toThrow();
  });
});
