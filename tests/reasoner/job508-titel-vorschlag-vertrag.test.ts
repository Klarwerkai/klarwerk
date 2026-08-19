// ================================================================================================
// JOB 508 · D8 — DER VERTRAG DES TITELVORSCHLAGS AN DER DIENSTGRENZE
// ================================================================================================
//
// Diese Datei misst NICHT die Innerei aus `titel-vorschlag.ts` — das tun die Einheitentests daneben.
// Sie misst, was ein Aufrufer VON AUSSEN verlangen darf: welche Namen es gibt, dass die vier
// Ehrlichkeitszusagen auch von hier gelten, und dass die Ableitung ohne jeden Dienst auskommt.
//
// ================================================================================================
// D9: DER VERTRAG GREIFT NICHT MEHR INS LEERE — UND WAS ER TROTZDEM NICHT BELEGT.
// ================================================================================================
//
// In D8 war der Fassadenexport nicht geleast. V4 stand deshalb als Vorbereitungswächter mit einem
// `if (ausFassade === undefined) … return` da und war LEER WAHR. BEN hat das in D8 zu Recht als
// „vakuumen Fassadenvertrag" beanstandet (Prüflücke 1): ein Fall, der ohne Anbindung durchwinkt,
// belegt keine Anbindung.
//
// In D9 ist `services/reasoner/index.ts` geleast, der Export steht, und V4 hat keinen
// Frühausstieg mehr. Fehlt der Export, wird dieser Test rot — das ist in D9 mit einer
// Gegenmutation gemessen und in der Rückgabe mit Ausgabe belegt.
//
// WAS DIESER VERTRAG AUSDRÜCKLICH NICHT BELEGT: dass irgendwo ein Titelvorschlag SICHTBAR wird.
// Er misst die Erreichbarkeit an der Dienstgrenze, sonst nichts. `describeImage` ruft die
// Ableitung nicht, kein Wiretyp trägt einen Titel, kein Renderer zeigt ihn. D9 begrenzt das
// Versprechen deshalb ausdrücklich auf serverinterne Vorarbeit — siehe den Kopf von
// `services/reasoner/src/titel-vorschlag.ts`.
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

  it("V4: die Fassade trägt den Export — und zwar DIESE Funktion, keine Kopie", async () => {
    const fassade = (await import("../../services/reasoner")) as Record<string, unknown>;
    // KEINE Verzweigung, kein Frühausstieg, kein leer wahrer Zweig: Fehlt der Export, scheitert
    // dieser Fall. Genau das verlangt BEN im D8-Urteil (Prüflücke 1) — der Vertrag darf nicht ins
    // Leere greifen. Bis D8 stand hier ein `if (ausFassade === undefined) … return`, der den Fall
    // ohne Anbindung durchwinkte; das war der „vakuume Fassadenvertrag".
    expect(
      fassade.titelVorschlag,
      "services/reasoner/index.ts exportiert titelVorschlag nicht",
    ).toBeDefined();
    // Dieselbe Funktion, keine zweite Ableitung neben der einen kanonischen (Regel „EINE
    // kanonische Quelle"). Identität, nicht bloß Typgleichheit.
    expect(fassade.titelVorschlag).toBe(titelVorschlag);
    // Die Anzeigegrenze reist mit — sonst erfindet ein späterer Aufrufer sie ein zweites Mal.
    expect(fassade.TITEL_MAX_ZEICHEN).toBe(TITEL_MAX_ZEICHEN);
  });

  it("V4b: die Fassade zieht die Ableitung aus der einen kanonischen Datei", () => {
    // Ergänzt V4 um die Quellenseite: Der Export muss aus `./src/titel-vorschlag` stammen. Ein
    // Re-Export derselben Funktion über einen Umweg wäre identitätsgleich und würde V4 nicht
    // auffallen — hier fällt er auf.
    //
    // Gemessen wird eine echte EXPORT-ANWEISUNG, nicht bloßes Vorkommen der Zeichenkette: Der
    // Dateikopf nennt den Pfad in einem Kommentar, und ein Fall, den ein Kommentar grün hält,
    // misst nichts. (In D9 gemessen: mit der reinen Textsuche überlebte dieser Fall die
    // Gegenmutation, die V4 rot machte.)
    const exportAusModul =
      /^export\s+(?:type\s+)?\{[^}]*\}\s+from\s+"\.\/src\/titel-vorschlag";$/mu;
    expect(readFileSync(FASSADE, "utf8")).toMatch(exportAusModul);
  });

  it("V5: die Dienstgrenze dieses Moduls ist services/reasoner/index.ts — es gibt keine src/index.ts", () => {
    // Der architektonische Befund, auf dem der offene Punkt aus dem Kopf beruht. Er bleibt auch
    // dann gültig, wenn die Fassade später den Export trägt — deshalb ist er hier festgehalten und
    // nicht nur im Bericht.
    expect(() => readFileSync(FASSADE, "utf8")).not.toThrow();
    expect(() => readFileSync(join(WURZEL, "services/reasoner/src/index.ts"), "utf8")).toThrow();
  });
});
