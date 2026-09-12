// ================================================================================================
// JOB 3587 R4 · DIE KALIBRIERUNG DER ZUSAGE-QUELLE — an erfundenen Quelltexten, nicht am Bestand.
// ================================================================================================
//
// WOZU DIESE DATEI. `zusage-quelle.ts` beantwortet seit R4 zwei Fragen: „steht dieser Name im
// Produkt?" UND „ist dieser Name wirklich fort?". Die zweite ist die heiklere, denn der Bestand
// selbst ist der Fall, an dem eine naive Antwort scheitert: `shell/KopfbandPunkte.tsx:191` und
// `shell/Kopfband.tsx:203` NENNEN `KopfbandPunkteSchmal` heute noch — in Kommentaren, die seine
// Entfernung begründen. Ein Muster, das blosse Vorkommen zählt, meldete dort eine Rückkehr, die es
// nicht gibt, und der Lauf bräche mit einer Falschaussage ab.
//
// Gegen den echten Bestand lässt sich das nicht prüfen: dort gibt es immer nur EINE der beiden
// Lagen. Diese Datei füttert die Erkennung deshalb mit erfundenen, aber realistischen Quelltexten
// und hält sie in BEIDE Richtungen fest — dieselbe Bauart wie `sprachweg-ast.test.ts`, aus dem
// gleichen Grund: eine Erkennung, die nur gegen den Istzustand geprüft wird, ist nicht geprüft.
//
// Kein Browser, kein Bestandsbezug, keine Pixel: reine Ableitung, bei jedem Lauf gleich.
import { describe, expect, it } from "vitest";
import { QUELLNAMEN, deklariertIn, erwartetePunkte, ohneKommentare } from "./zusage-quelle";

const NAME = "KopfbandPunkteSchmal";

describe("JOB 3587 · Z · was als Deklaration im Produkt zählt", () => {
  it("Z1 · ein Name NUR im Zeilenkommentar ist keine Deklaration (die Lage des Bestands)", () => {
    // Wörtlich die Bauform von `KopfbandPunkte.tsx:188-191`.
    const text = [
      "// ================================================================",
      "// JOB 3605 · WARUM HIER KEINE ZWEITE, SCHMALE AUSWAHL MEHR STEHT.",
      "// ================================================================",
      `// BIS HIERHER stand an dieser Stelle \`${NAME}\` — eine Liste mit genau einer Id`,
      '// (`["entwuerfe"]`). Sie ist fort, ersatzlos.',
      "export function KopfbandPunkteListe() { return null; }",
    ].join("\n");
    expect(
      deklariertIn(text, NAME),
      "ein Kommentar, der die Entfernung ERKLÄRT, wurde als Rückkehr gelesen",
    ).toBe(false);
  });

  it("Z2 · ein Name im BLOCKkommentar ist ebenfalls keine Deklaration", () => {
    const text = [
      "/**",
      ` * JOB 3605 hat \`${NAME}\` wieder entfernt (Pedi: keine Sonderstellung).`,
      " */",
      "export function KopfbandPunkteListe() { return null; }",
    ].join("\n");
    expect(deklariertIn(text, NAME), "ein Blockkommentar wurde als Deklaration gelesen").toBe(
      false,
    );
  });

  it("Z3 · derselbe Name als echte Deklaration WIRD gesehen — sonst bewacht Z1 ein Nichts", () => {
    for (const rumpf of [
      `function ${NAME}() { return null; }`,
      `const ${NAME} = () => null;`,
      `export const ${NAME} = ["entwuerfe"] as const;`,
    ]) {
      expect(deklariertIn(`// Kommentar\n${rumpf}\n`, NAME), `nicht gesehen: ${rumpf}`).toBe(true);
    }
  });

  it("Z4 · ein Name, der nur als Teil eines längeren Namens vorkommt, zählt nicht", () => {
    expect(deklariertIn(`const ${NAME}Alt = 1;`, NAME)).toBe(false);
  });

  it("Z5 · `ohneKommentare` lässt den Code stehen und nimmt nur die Kommentare fort", () => {
    const text = 'const A = "x"; // weg\n/* auch weg */\nconst B = "y";';
    const rest = ohneKommentare(text);
    expect(rest).toContain('const A = "x"');
    expect(rest).toContain('const B = "y"');
    expect(rest).not.toContain("weg");
  });

  it("Z5b · ein NACHGESTELLTER Kommentar löst keinen Fehlalarm aus (dieser Fall war rot)", () => {
    // Die erste Fassung dieser Runde entfernte nur Kommentare am Zeilenanfang. Damit hätte die
    // Zeile unten eine „Rückkehr" gemeldet, die keine ist — gefunden von Z5, nicht von einem
    // Prüfer. Der Fall bleibt hier, damit die Verkürzung nicht zurückkommt.
    expect(
      deklariertIn(`const Andere = 1; // früher stand hier \`${NAME}\`\n`, NAME),
      "ein nachgestellter Kommentar wurde als Deklaration gelesen",
    ).toBe(false);
  });

  it("Z5c · eine URL im Quelltext überlebt das Abstreifen — sie ist kein Kommentar", () => {
    const rest = ohneKommentare('const U = "https://klarwerk.test/start";');
    expect(rest, "die Protokollangabe wurde zerschnitten").toContain("https://klarwerk.test/start");
  });
});

describe("JOB 3587 · Z · die Zusage selbst", () => {
  it("Z6 · schmal sieht die Zusage seit JOB 3605 KEINEN Navigationspunkt vor", () => {
    expect(
      erwartetePunkte(true),
      "schmal steht wieder ein Punkt in der Zusage — dann ist Pedis Vorgabe vom 11.09.2026 überholt und dieser Fall gehört nachgeführt",
    ).toEqual([]);
  });

  it("Z7 · breit sieht sie die volle Punktreihe vor — sonst prüfte der Lauf breit nichts mehr", () => {
    const breit = erwartetePunkte(false);
    expect(breit.length, "die breite Punktreihe ist leer").toBeGreaterThan(3);
    expect(breit, "„entwuerfe“ ist aus der breiten Zeile verschwunden").toContain("entwuerfe");
  });

  it("Z8 · jeder gelesene Produktname ist benannt und einer der drei Arten zugeordnet", () => {
    expect(QUELLNAMEN.length).toBeGreaterThan(3);
    for (const q of QUELLNAMEN) {
      expect(["text", "liste", "muss fehlen"], `unbekannte Art bei ${q.name}`).toContain(q.art);
      expect(q.datei, `${q.name} nennt keine Produktdatei`).toMatch(/^apps\/web\/src\//);
    }
  });
});
