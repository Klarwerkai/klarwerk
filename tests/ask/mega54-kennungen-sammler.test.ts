// AUFTRAG-mega54 BLOCK A — KENNUNGEN ÜBERLEBEN DIE ZERLEGUNG.
//
// DER BEFUND (mega53 hat ihn selbst gemessen und benannt, provider.ts): `tokenize` behält nur Wörter
// LÄNGER ALS ZWEI ZEICHEN. Damit fällt „F3" aus Pedis eigener P0-Frage („Der Filter F3 … wie oft muss
// er geprüft werden?") ersatzlos heraus — und mit ihm das einzige Wort, das diese Frage von jeder
// anderen unterscheidet. Seit mega53 die absolute Mindestsubstanz davorstellt, endet die Frage in
// einer Wissenslücke, obwohl das richtige, validierte Wissensobjekt im Bestand liegt.
//
// DIE REGEL (A1/A2) IST ENG: ein Token, das BUCHSTABEN UND ZIFFERN MISCHT, ist eine Kennung und
// überlebt die Längengrenze. Nicht „kurz und selten", nicht eine Ausnahmeliste — Buchstabe UND
// Ziffer, beides mindestens einmal. Die Längengrenze bleibt für reine Wörter, wo sie hingehört.
//
// DIES IST EIN SAMMLER, KEINE LISTE DER HEUTIGEN FÄLLE. Die Kennungen werden aus Bausteinen ERZEUGT
// (Buchstabenteile × Ziffernteile × Stellungen), nicht aufgezählt. Wer die Regel auf eine Liste
// bekannter Kennungen verengt oder sie über eine Längenausnahme baut, wird hier rot — die erzeugte
// Menge enthält Formen, die in keiner Liste stehen.
import { describe, expect, it } from "vitest";
import { queryTokens } from "../../services/reasoner";

// Bausteine, aus denen typische Betriebs-Kennungen bestehen. KEINE Fallliste — das Kreuzprodukt
// unten erzeugt Formen, die hier nirgends als Ganzes stehen (z. B. "dn400", "q12", "abc50").
const BUCHSTABENTEILE = ["f", "m", "q", "l", "dn", "pn", "abc", "kks"];
const ZIFFERNTEILE = ["1", "3", "7", "12", "50", "400"];

// Die drei Stellungen, in denen Buchstaben und Ziffern in Kennungen vorkommen: Buchstaben zuerst
// (F3, DN50), Ziffern zuerst (3F, 400V), und gemischt-umschlossen (M12x1 → hier "m12x").
const KENNUNGEN: string[] = [];
for (const b of BUCHSTABENTEILE) {
  for (const z of ZIFFERNTEILE) {
    KENNUNGEN.push(`${b}${z}`);
    KENNUNGEN.push(`${z}${b}`);
    KENNUNGEN.push(`${b}${z}${b}`);
  }
}

// Die Gegenprobe zur Regel: reine Wörter ohne Ziffer. Erzeugt, nicht aufgezählt — ALLE
// Zweibuchstaben-Kombinationen aus dem Alphabet der Tokenisierung. Darunter liegen die
// Funktionswörter, die die Längengrenze draußen halten SOLL („an", „im", „so", „zu", „am" …).
const ALPHABET = "abcdefghijklmnopqrstuvwxyzäöüß".split("");
const REINE_ZWEIBUCHSTABEN: string[] = [];
for (const a of ALPHABET) {
  for (const b of ALPHABET) {
    REINE_ZWEIBUCHSTABEN.push(`${a}${b}`);
  }
}

// Kennungen stehen in echten Fragen nie allein — sie stecken in einem Satz und hängen an
// Satzzeichen. Der Satzrahmen ist Teil der Erhebung.
function inFrage(kennung: string): string[] {
  return queryTokens(`Wie oft muss der Filter ${kennung} im Betrieb geprüft werden?`);
}

describe("AUFTRAG-mega54 A2 — Sammler: Kennungen überleben die Zerlegung", () => {
  it("JEDE erzeugte Kennungsform (Buchstabe UND Ziffer) bleibt ein Inhaltstoken", () => {
    const verloren = KENNUNGEN.filter((k) => !inFrage(k).includes(k.toLowerCase()));
    expect({ geprueft: KENNUNGEN.length, verloren }).toEqual({
      geprueft: KENNUNGEN.length,
      verloren: [],
    });
  });

  it("die Kennung überlebt auch als Groß-/Kleinschreibung und am Satzzeichen", () => {
    const varianten = KENNUNGEN.flatMap((k) => [k.toUpperCase(), `${k},`, `(${k})`, `${k}.`]);
    const verloren = varianten.filter(
      (v) =>
        !queryTokens(`Bauteil ${v} prüfen`).includes(v.toLowerCase().replace(/[^a-zäöüß0-9]/g, "")),
    );
    expect(verloren).toEqual([]);
  });

  it("die Längengrenze bleibt für REINE Wörter — kein Zweibuchstaben-Token kommt durch", () => {
    const durchgerutscht = REINE_ZWEIBUCHSTABEN.filter((w) =>
      queryTokens(`Der Wert ${w} steht im Protokoll`).includes(w),
    );
    expect({ geprueft: REINE_ZWEIBUCHSTABEN.length, durchgerutscht }).toEqual({
      geprueft: REINE_ZWEIBUCHSTABEN.length,
      durchgerutscht: [],
    });
  });

  it("eine reine ZIFFERNfolge unter drei Stellen ist keine Kennung und kommt nicht durch", () => {
    const kurzeZahlen = ZIFFERNTEILE.filter((z) => z.length <= 2);
    const durchgerutscht = kurzeZahlen.filter((z) =>
      queryTokens(`Der Wert ${z} steht im Protokoll`).includes(z),
    );
    expect({ geprueft: kurzeZahlen.length, durchgerutscht }).toEqual({
      geprueft: kurzeZahlen.length,
      durchgerutscht: [],
    });
  });

  it("Pedis P0-Frage trägt „f3“ als Inhaltstoken (der Fall, der mega53 in die Lücke schickte)", () => {
    expect(queryTokens("Wie oft muss der Filter F3 geprüft werden?")).toContain("f3");
  });
});
