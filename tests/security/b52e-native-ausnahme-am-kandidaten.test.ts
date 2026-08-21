// B52/E · GELB-1 — DIE NATIVE AUSNAHME DARF NICHT AN DER DATEI HAENGEN.
//
// DER BEFUND kommt aus der Erntekontrolle PRO2 (`1652 D1`, Befund 2) — Zitat aus fremder
// Rueckgabe:
//   „Der Schluessel ist an jeder der vier Stellen die Datei (`e.quelle.datei` beziehungsweise die
//    blosse Datei `d`) — nie der Kandidat. Damit gilt weiterhin: eine ZWEITE, nicht native
//    `aria-modal`-Flaeche in einer ausgenommenen Datei rutscht durch, weil die Ausnahme die ganze
//    Datei freistellt."
//
// WAS DIESE DATEI PRUEFT — und was sie ausdruecklich NICHT prueft:
// Sie prueft die VERDRAHTUNG: dass keine Erhebung mehr direkt an der Dateiausnahme haengt. Das
// VERHALTEN prueft der Sammler selbst mit gebauten Erhebungen
// (`tests/app/mega47-modale-flaechen-sammler.test.tsx`, Block „B52/E · GELB-1"), weil die Helfer
// dort wohnen und ein Import der Sammlerdatei ihre gesamte Suite ein zweites Mal fahren wuerde.
//
// ZWEI WAECHTER, ZWEI FEHLERBILDER — und das ist Absicht: eine Mutation an einer Benutzungsstelle
// laesst die Verhaltensfaelle GRUEN (sie rufen den Helfer direkt) und faellt nur hier auf. Genau
// diese Trennung hat in JOB 1601/G24 den Unterschied gemacht.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SAMMLER = "tests/app/mega47-modale-flaechen-sammler.test.tsx";
const QUELLE = readFileSync(resolve(process.cwd(), SAMMLER), "utf8");

/** Zeilen mit einem DIREKTEN Mengenzugriff auf die Ausnahme — je Zeilennummer und Wortlaut. */
function direkteZugriffe(): string[] {
  return QUELLE.split("\n")
    .map((z, i) => ({ nr: i + 1, text: z }))
    .filter((z) => /NATIV_MODAL_AUSNAHMEN\.has\s*\(/.test(z.text))
    .map((z) => `${SAMMLER}:${z.nr} — ${z.text.trim()}`);
}

describe("B52/E · GELB-1: die Ausnahme haengt am Kandidaten", () => {
  it("B52E-1 · genau EIN direkter Mengenzugriff — und der steht im Helfer selbst", () => {
    const zugriffe = direkteZugriffe();
    expect(
      zugriffe.length,
      `\nJeder direkte \`NATIV_MODAL_AUSNAHMEN.has(...)\` ausserhalb von \`nativAusnahmeDecktDatei\`\nstellt eine ganze DATEI frei — auch Funde, die die Ausnahme nie begruendet hat.\nGefunden:\n${zugriffe.join("\n")}\n`,
    ).toBe(1);
    expect(
      zugriffe[0],
      "der eine verbliebene Zugriff steht nicht mehr im Helfer — dann haengt er wieder frei",
    ).toContain("if (!NATIV_MODAL_AUSNAHMEN.has(e.quelle.datei))");
  });

  it("B52E-2 · die drei Erhebungen fragen den Helfer, nicht die Menge", () => {
    // Die drei Stellen aus dem Befund. Sie sind an ihrem Umgebungstext erkannt, nicht an einer
    // Zeilennummer — Zeilennummern verschieben sich beim naechsten Umbau, der Text nicht.
    const stellen: Array<[string, string]> = [
      ["Bauteil-Erhebung", 'e.kandidaten.some((k) => k.art.startsWith("aria-modal"))'],
      ["unregistrierte Vollflaechen", "spanntVollflaecheAuf(e.quelle.gestrippt)"],
      ["unregistrierte Wirkflaechen", "wirktModalAmBestand(e.quelle.gestrippt)"],
    ];
    for (const [name, anker] of stellen) {
      const stelle = QUELLE.indexOf(anker);
      expect(stelle, `${name}: der Anker „${anker}" steht nicht mehr im Sammler`).toBeGreaterThan(
        0,
      );
      // Im Umfeld der Stelle muss der Helfer stehen — nicht die blosse Menge. Das Fenster reicht
      // BEIDE Richtungen: bei der Bauteil-Erhebung steht der Helferaufruf VOR dem Anker.
      const umfeld = QUELLE.slice(Math.max(0, stelle - 420), stelle + 420);
      expect(umfeld, `${name}: die Erhebung bindet die Ausnahme nicht an die Kandidaten`).toContain(
        "nativAusnahmeDecktDatei(e)",
      );
    }
  });

  it("B52E-3 · der Helfer prueft ALLE Funde, nicht irgendeinen", () => {
    // `some` statt `every` waere die stille Umkehr: dann genuegte EIN nativer Fund, um die ganze
    // Datei wieder freizustellen — also genau der Zustand vor diesem Durchgang.
    const helfer = QUELLE.slice(
      QUELLE.indexOf("function nativAusnahmeDecktDatei"),
      QUELLE.indexOf("function beurteile"),
    );
    expect(helfer.length, "der Helfer ist nicht auffindbar").toBeGreaterThan(0);
    expect(helfer, "der Helfer prueft nicht mehr ALLE Kandidaten").toContain(
      "e.kandidaten.every((k) => nativGedeckt(e, k))",
    );
    expect(
      helfer,
      "`some` wuerde die Dateiausnahme durch die Hintertuer zurueckbringen",
    ).not.toContain("e.kandidaten.some(");
  });
});
