// ================================================================================================
// JOB 1101 · D1 — DER SINGLE-INSTANZ-VERTRAG IST EINE ANNAHME UEBER DIE PLATTFORM, KEINE MESSUNG.
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI BEWACHT, steht in der 947-Rueckgabe als U1 (§2.3) — die einzige
// Zeile jener Inventur, die als „unbelegt" klassifiziert wurde UND zugleich im Produktcode steht:
//
//   „Das Deployment ist Single-Instanz (Coolify, EINE …)" — als DEPLOY-VERTRAG im Produktcode.
//    Eine PRODUKTZUSAGE ruht auf einer Plattformeigenschaft, die nirgends geprueft ist. Skaliert
//    Coolify je auf zwei Instanzen, bricht der Vertrag STILL."
//
// BEN4 hat daraus Prueflücke 6 (3) gemacht, woertlich: „Repo-Test/grep fuer
// `services/auth/src/repo-pg.ts`, Fall Single-Instanz-Vertrag darf nicht ohne Annahme-/Belegverweis
// stehen, erwartetes Ergebnis: Kommentar benennt Voraussetzung und verweist auf Betriebsbeleg oder
// Ownerfrage."
//
// ================================================================================================
// WARUM DIESER WAECHTER QUELLTEXT LIEST — und warum das hier KEIN Ersatz fuer Laufzeitwirkung ist.
// ================================================================================================
//
// Der Gegenstand IST ein Kommentar. Eine Annahme ueber die Betriebsumgebung hat keine
// Laufzeitwirkung, die man messen koennte — sie wirkt dadurch, dass jemand sie liest und glaubt.
// Ein Test, der hier Laufzeit prueft, pruefte etwas anderes als die Zusage.
//
// Was dieser Waechter deshalb NICHT tut: er stellt nicht fest, ob das Deployment wirklich
// Single-Instanz ist. Das steht in der Coolify-Konfiguration und ist eine Owner-Auskunft
// (947-Rueckgabe, Ownerfrage O-1). Kein Coolify-Zugriff, keine erfundene Bestaetigung.
//
// Was er tut: er haelt die FORM fest, in der eine ungemessene Plattformannahme im Produktcode
// stehen darf. Das Muster ist nicht erfunden — es steht schon im Baum, und die 947-Rueckgabe nennt
// es als B5 (`docs/TEAM6_UPDATE.md:291`, Fall U7): Behauptung, Vorbehalt, benannter Bestaetiger,
// Restrisiko. Genau diese vier Teile verlangen die Faelle unten.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const QUELLE = new URL("../../services/auth/src/repo-pg.ts", import.meta.url);
const roh = readFileSync(QUELLE, "utf8");

/**
 * Der zusammenhaengende Kommentarblock, der den DEPLOY-VERTRAG traegt.
 *
 * Bewusst der BLOCK und nicht die ganze Datei: eine Datei-weite Suche waere gruen, sobald das Wort
 * „Annahme" irgendwo sonst faellt — etwa in einem unbeteiligten Kommentar zwanzig Zeilen weiter.
 * Die Zusage gilt fuer DIE Stelle, an der der Vertrag steht.
 */
function vertragsblock(): string {
  const zeilen = roh.split("\n");
  const start = zeilen.findIndex((z) => z.includes("DEPLOY-VERTRAG"));
  if (start < 0) {
    return "";
  }
  const block: string[] = [];
  for (let i = start; i < zeilen.length; i++) {
    const z = zeilen[i] ?? "";
    if (!z.trimStart().startsWith("//")) {
      break;
    }
    block.push(z);
  }
  return block.join("\n");
}

describe("JOB 1101 · der Vertrag existiert ueberhaupt", () => {
  // Ohne diesen Fall waere jede Zusage unten trivial erfuellbar: wer den Kommentar loescht, haette
  // keine unbelegte Behauptung mehr — und auch keine Warnung. Das waere die schlechtere Haelfte.
  it("der DEPLOY-VERTRAG steht im Produktcode und ist nicht stillschweigend entfernt", () => {
    expect(roh).toContain("DEPLOY-VERTRAG");
    expect(vertragsblock().length).toBeGreaterThan(0);
  });

  it("er benennt weiterhin die Single-Instanz-Eigenschaft — sonst waere die Zusage verschwiegen", () => {
    expect(vertragsblock()).toMatch(/Single-Instanz/i);
  });
});

describe("JOB 1101 · die Annahme ist als ANNAHME gekennzeichnet (Lieferung 2)", () => {
  it("der Block nennt sie ausdruecklich eine Annahme und nicht eine Tatsache", () => {
    const block = vertragsblock();
    // Ein Wort aus dieser Menge muss fallen. Ohne es liest sich der Satz als gemessene Eigenschaft
    // des Systems — genau der Zustand, den U1 beanstandet.
    expect(
      /\bANNAHME\b|\bannahme\b|angenommen|unterstellt/.test(block),
      "der Vertragsblock kennzeichnet die Single-Instanz-Eigenschaft nicht als Annahme",
    ).toBe(true);
  });

  it("er sagt ausdruecklich, dass sie NICHT gemessen ist", () => {
    const block = vertragsblock();
    expect(
      /nicht gemessen|nicht geprueft|nicht geprüft|unbelegt|kein Beleg/i.test(block),
      "der Block sagt nicht, dass die Annahme ungemessen ist",
    ).toBe(true);
  });

  it("KALIBRIERUNG: die alte Tatsachenform steht NICHT mehr da", () => {
    // „das Deployment ist Single-Instanz" im Indikativ, ohne Vorbehalt — der Ausgangszustand.
    // Ohne diesen Fall koennte jemand die Annahme-Kennzeichnung DANEBEN schreiben und die
    // Tatsachenbehauptung stehen lassen.
    expect(
      /Deployment ist Single-Instanz/i.test(vertragsblock()),
      "die unbedingte Tatsachenform ist zurueck",
    ).toBe(false);
  });
});

describe("JOB 1101 · das Mehrinstanz-Risiko ist erklaert (Lieferung 2)", () => {
  it("der Block sagt, was bei zwei Instanzen bricht", () => {
    const block = vertragsblock();
    // Auf die SACHE geprueft, nicht auf eine Kasusform: „mehr als einer Instanz" ist ebenso
    // richtig wie „mehr als eine Instanz", und ein Waechter, der Grammatik erzwingt statt Inhalt,
    // waere eine Formalie.
    expect(
      /zwei Instanzen|mehrere Instanzen|Mehrinstanz|mehr als ein(e|er) Instanz|zwei Prozesse/i.test(
        block,
      ),
      "der Block benennt den Mehrinstanz-Fall nicht",
    ).toBe(true);
  });

  it("er benennt die FOLGE, nicht nur den Fall", () => {
    const block = vertragsblock();
    // „bricht", „gleichzeitig", „parallel", „doppelt" — irgendeine konkrete Wirkung muss dastehen.
    // Ein blosses „bei zwei Instanzen gilt das nicht" waere eine Einschraenkung ohne Aussage.
    expect(
      /bricht|gleichzeitig|parallel|doppelt|zeitgleich|nebenlaeufig|nebenläufig/i.test(block),
      "der Block nennt keine konkrete Folge des Mehrinstanz-Falls",
    ).toBe(true);
  });
});

describe("JOB 1101 · ein Bestaetiger ist benannt — und der Beleg NICHT erfunden (Lieferung 3)", () => {
  it("der Block nennt, wer die Annahme bestaetigen muss", () => {
    const block = vertragsblock();
    // Dieselbe Form wie das Vorbild `docs/TEAM6_UPDATE.md:291` („durch Ops/Pedi zu bestaetigen").
    expect(
      /zu bestaetigen|zu bestätigen|Ownerfrage|Owner-Auskunft|Betriebsbeleg|Ops\/Pedi/i.test(block),
      "der Block benennt keinen Bestaetiger und keine Ownerfrage",
    ).toBe(true);
  });

  it("er behauptet NICHT, der Beleg liege bereits vor", () => {
    const block = vertragsblock();
    // Der Kern von Lieferung 3: keine erfundene Bestaetigung. Wer hier „bestaetigt am …" oder
    // „belegt durch …" schreibt, ohne dass ein Beleg existiert, macht aus der Annahme wieder eine
    // Produktwahrheit — nur diesmal mit falschem Siegel.
    expect(
      /\bbestaetigt am\b|\bbestätigt am\b|\bbelegt durch\b|\bnachgewiesen\b|\bverifiziert\b/i.test(
        block,
      ),
      "der Block behauptet einen Beleg, den dieser Durchgang nicht erbracht hat",
    ).toBe(false);
  });

  it("er verweist auf die Herkunft des Befunds statt ihn neu zu erfinden", () => {
    // Die Spur zurueck zu JOB 947 / U1 muss lesbar bleiben — sonst weiss der naechste Leser nicht,
    // woher die Einschraenkung kommt und wo der offene Punkt gefuehrt wird.
    expect(vertragsblock()).toMatch(/947|U1/);
  });
});

describe("JOB 1101 · der Waechter misst NICHT die Plattform", () => {
  it("diese Datei fuehrt keinen Coolify-, Netz- oder Plattformzugriff", () => {
    // Selbstprobe: der Waechter darf die Annahme nicht dadurch „belegen", dass er sie nachschlaegt.
    // Geprueft ueber die IMPORTE statt ueber eine Mustersuche im eigenen Text — eine Suche nach
    // `fetch(` oder `https://` faende in dieser Datei ihr eigenes Suchmuster wieder und waere
    // deshalb dauerhaft rot, ohne etwas zu belegen.
    const selbst = readFileSync(new URL(import.meta.url), "utf8");
    const importe = [...selbst.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]).sort();
    expect(importe, "der Waechter zieht mehr als Dateisystem und Testlauf herein").toEqual([
      "node:fs",
      "vitest",
    ]);
  });
});
