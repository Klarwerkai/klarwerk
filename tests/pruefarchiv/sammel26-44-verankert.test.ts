// ================================================================================================
// R-2042 (OFFEN I5) — DIE BEN-BERICHTE SAMMEL26–44 SIND IM REPOSITORY VERANKERT, NICHT NUR IN `_relay/`.
// ================================================================================================
//
// GEGENSTAND. I5 hielt fest, dass `_relay/` in `.gitignore` steht und mit keinem Klon reist, und
// dass die Runden sammel26–44 deshalb noch nirgends gesichert waren. Das Archiv
// `docs/qm/pruefarchiv-sammel26-44.md` führt jeden der 32 Originalberichte als eigene Zeile.
//
// ZWEI REIHEN, GLEICHE NUMMERN (BEN, Nacharbeit 1). Die Gegenprüfungen der mega-Aufträge
// (`BERICHT-ben-sammelNN-megaMM.md`, Reihe A, 26–44) und die Ship-8-Rechecks
// (`BERICHT-sammelNN.md`, Reihe B, 26–38) zählen unabhängig. Die erste Fassung verlangte „genau eine
// Zeile je Rundennummer“ und legte damit zwei Berichte in eine Zeile. Schlüssel ist deshalb jetzt
// Reihe plus Runde, und die Liste unten nennt jeden Bericht mit Datei und SHA-256.
//
// WAS GEHALTEN WIRD:
//   1. JEDER BERICHT GENAU EINMAL, mit seiner Datei und seinem Hash. Kein Bericht fehlt still, keiner
//      steht doppelt, keiner verdrängt den gleichnummerigen der anderen Reihe.
//   2. JEDE FUNDSTELLE TRÄGT. Die Datei existiert, die Zeile liegt in ihr, und die Datei nennt die
//      Runde. Geprüft wird die Nennung, nicht die genaue Zeile, damit eine fremde Änderung oberhalb
//      der Stelle diesen Prüfstand nicht rot macht.
//   3. SPURLOS HEISST SPURLOS. Eine Zeile ohne Fundstelle muss das sagen.
//   4. DIE BERICHTE LIEGEN IM REPOSITORY (Nacharbeit 5). Jede Kopie unter `docs/qm/pruefarchiv/
//      berichte/` ist byte-gleich zum Original (Datei-SHA-256 der Quellenhilfe), und das Archiv
//      nennt genau so viele gesicherte Texte, wie dort liegen.
//   5. DIE TABELLE SAGT, WAS DER BERICHT SAGT. Gesamtverdikt und Inhalts-SHA jeder Zeile werden aus
//      dem Berichtstext gelesen und verglichen. Die Inhalts-SHA der Markerzeile (letzte Zeile, „SHA-256
//      … oberhalb dieser Zeile“) wird über den Inhalt davor nachgerechnet.
//
// Die Datei-Hashes stammen aus der Quellenhilfe `QUELLEN-HILFE-09a427-ORIGINALBERICHTE.json`
// (13.10.2026). Ob die damaligen Befunde heute geschlossen sind, ist nicht Gegenstand.
//
// Jede Regel ist eine reine Funktion und wird zuerst an synthetischen Fällen gegengeprüft.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const WURZEL = fileURLToPath(new URL("../../", import.meta.url));
const ARCHIV_PFAD = "docs/qm/pruefarchiv-sammel26-44.md";
const KOPIEN_PFAD = "docs/qm/pruefarchiv/berichte";
const SPURLOS = "keine Fundstelle im Code";
const VERDIKTE = ["GRÜN", "GELB", "ROT"] as const;

interface Bericht {
  kennung: string;
  datei: string;
  sha256: string;
}

/** Die 32 Originalberichte laut Quellenhilfe; Datei-SHA-256 über die ganze Datei. */
const BERICHTE: readonly Bericht[] = `
A-sammel26 BERICHT-ben-sammel26-mega26.md 9b88c55954342416a2324c01d070baf0622ff3c0c1e0332b830b346742588271
A-sammel27 BERICHT-ben-sammel27-mega27.md dd0a931ae9f54fffda8f6230f8b76ac7228a7e936ca6a0179eec5ff2bddb0193
A-sammel28 BERICHT-ben-sammel28-mega28.md caf3c55ddd5ff19440486f241bf263a918e1c40cdf272d09078d0315b4e823ea
A-sammel29 BERICHT-ben-sammel29-mega29.md ec2b8e4fb32430d93740f1fc662533fcff68829f315ec4debdc48b8be4e8cb20
A-sammel30 BERICHT-ben-sammel30-mega31.md d4781b9d5b9437152b2e73128061e5796fecdf8ec71a010a8eb9bfc568cdd612
A-sammel31 BERICHT-ben-sammel31-mega32.md 5e7891be6596ab6ffe120742ea8abafca47eb59e901ebf5e5d0e22ce6ddbc754
A-sammel32 BERICHT-ben-sammel32-mega33.md 990d8e9f8df1af049ff4bb94f6e0dafe8b2f09d1efc7653743a893ff65bc0f19
A-sammel33 BERICHT-ben-sammel33-mega34.md 081a0f92d84ce4c8a0582acfe2c163fe181a2eb3e4dd5372e589cd936959784f
A-sammel34 BERICHT-ben-sammel34-mega35.md a4596fed2b64e50addbf9b81936244d8ea6bba34147863de2c06287ff4488156
A-sammel35 BERICHT-ben-sammel35-mega36.md 1554f5640553f105e027941b1c5eabe231e64d44e9423fde31eccd429434ee6f
A-sammel36 BERICHT-ben-sammel36-mega37.md 88265d8bb2abe9f135ceb2aa96787648f7e33300620f944f27de2d1db02036c1
A-sammel37 BERICHT-ben-sammel37-mega38.md 8b2de56c085a82ed76c9bf7a981aba164016cf3e87712cf233d1cdde0181b79f
A-sammel38 BERICHT-ben-sammel38-mega39.md 6b575828b6551a2692161cce9655fab8cc5ed7560644ee53434eac36f74c3645
A-sammel39 BERICHT-ben-sammel39-mega40.md 76b16b95712ae4bc9173bddb1cf9ed39c882ba154e7a13c60291f483f80e4f96
A-sammel40 BERICHT-ben-sammel40-mega41.md d5e047b95b55f1a6e81553807bfbc1b190a72f036f495be3bdb75abbc3178985
A-sammel41 BERICHT-ben-sammel41-mega42.md 8f742efc2475ff3a9e3a18b39e78733a26f52ad2a37e11d8970e3f74c3128e49
A-sammel42 BERICHT-ben-sammel42-mega43.md 12826673db3977cd166267222ded2edb38cfa06337236ca6da7f5fa37dcf47fb
A-sammel43 BERICHT-ben-sammel43-mega44.md f513bae978472476c8d1ea301afb0d0a08ba6de574d894515692429bfbe01d52
A-sammel44 BERICHT-ben-sammel44-mega45-46.md 4987ef5371b46ff4eb871a3b6c1924d7d71765edb6654e63e1c6607e53e60337
B-sammel26 BERICHT-sammel26.md b3ebb279ea332d3c23f2e40e6f883bb8c746ba623bd263fe566fa4628202a6ea
B-sammel27 BERICHT-sammel27.md 9f9f6b5e3e58adfb50a5ec6fe9a55a707d8b7d13cd39d72a6cd83dc909af1e67
B-sammel28 BERICHT-sammel28.md 474b112d7f7b5530277e28a515c8b300ec716f218d1279e669c17bfa4be96bce
B-sammel29 BERICHT-sammel29.md e73d53334265136bbcdd600b23945cfd4370059b2293740e37e30f524934fe70
B-sammel30 BERICHT-sammel30.md 6fd88aace14db90e35c734a588b0c326d7e97080e236021c428c6b57d69e1592
B-sammel31 BERICHT-sammel31.md 85f9266cc3fe09985b5f2b5a41e7521e9feceaf32129ec695c679c675edbdccb
B-sammel32 BERICHT-sammel32.md 097b2882dc37184bcea3f1b30d8f5e639b8b644c3f9a47edc2dce2c679116dbb
B-sammel33 BERICHT-sammel33.md 38eeb4a246339b2fb649d077789b5f9812ef2902779fae5923beed50bf6d60ec
B-sammel34 BERICHT-sammel34.md 7f5265b18a75613af5c51ecddd0ad22f84d5b2b4e35e96bb61544e45b8a8278c
B-sammel35 BERICHT-sammel35.md 952f9d48564ed475d927cdf78a859690e8b660c29171863e895120070d8aefd6
B-sammel36 BERICHT-sammel36.md f66e4d0b14e04b20572b9b3bb48825faa1f0a32a434b95fa15d5ff09719d0c8f
B-sammel37 BERICHT-sammel37.md 346aec4969199e8741693b4b350e5e28170838f75ba0339474243cdad803ee9a
B-sammel38 BERICHT-sammel38.md 991e19e350122078d6bb959f58d00a4c2d0dcb39ebd8021cf77763d66dae8f6a
`
  .trim()
  .split("\n")
  .map((zeile) => {
    const [kennung, datei, sha256] = zeile.trim().split(" ");
    return { kennung, datei, sha256 } as Bericht;
  });

interface Zeile {
  kennung: string;
  runde: number;
  datei: string;
  verdikt: string;
  fundstellenZelle: string;
  fundstellen: { pfad: string; zeile: number }[];
  sha256: string;
  inhaltsSha: string;
}

const ohneTicks = (z: string) => z.replace(/`/g, "").trim();

// Spalten: Kennung · Originaldatei · Gegenstand · Basis · Gesamtverdikt · Kernbefund · Folgearbeit ·
// Fundstellen · Datei-SHA-256 · Inhalts-SHA · Zeilen · Bytes.
function zeilenAus(archiv: string): Zeile[] {
  return archiv
    .split("\n")
    .filter((l) => /^\|\s*[AB]-sammel\d+\s*\|/.test(l))
    .map((l) => {
      const zellen = l.split("|").map((z) => z.trim());
      const kennung = zellen[1] as string;
      const fundstellenZelle = zellen[8] ?? "";
      const fundstellen = [...fundstellenZelle.matchAll(/`([^`]+?):(\d+)`/g)].map((m) => ({
        pfad: m[1] as string,
        zeile: Number(m[2]),
      }));
      return {
        kennung,
        runde: Number(kennung.replace(/^[AB]-sammel/, "")),
        datei: ohneTicks(zellen[2] ?? ""),
        verdikt: zellen[5] ?? "",
        fundstellenZelle,
        fundstellen,
        sha256: ohneTicks(zellen[9] ?? ""),
        inhaltsSha: ohneTicks(zellen[10] ?? ""),
      };
    });
}

/** Liefert alle Mängel; leer heißt: das Archiv trägt. `lesen` gibt `null` für fehlende Dateien. */
function maengel(archiv: string, lesen: (pfad: string) => string | null): string[] {
  const funde: string[] = [];
  const zeilen = zeilenAus(archiv);
  for (const b of BERICHTE) {
    const treffer = zeilen.filter((z) => z.kennung === b.kennung);
    if (treffer.length !== 1) {
      funde.push(`${b.kennung}: ${treffer.length} Zeilen statt genau einer`);
      continue;
    }
    const z = treffer[0] as Zeile;
    if (z.datei !== b.datei) funde.push(`${b.kennung}: Datei ${z.datei} statt ${b.datei}`);
    if (z.sha256 !== b.sha256) funde.push(`${b.kennung}: SHA-256 weicht von der Quellenhilfe ab`);
  }
  for (const z of zeilen) {
    if (!BERICHTE.some((b) => b.kennung === z.kennung)) {
      funde.push(`${z.kennung}: kein Originalbericht dieser Kennung`);
    }
    if (!(VERDIKTE as readonly string[]).includes(z.verdikt)) {
      funde.push(`${z.kennung}: Gesamtverdikt „${z.verdikt}“ ist nicht GRÜN, GELB oder ROT`);
    }
    if (z.fundstellen.length === 0 && !z.fundstellenZelle.includes(SPURLOS)) {
      funde.push(`${z.kennung}: ohne Fundstelle, sagt aber nicht „${SPURLOS}“`);
    }
    const marke = new RegExp(`sammel${z.runde}(?!\\d)`);
    for (const f of z.fundstellen) {
      const text = lesen(f.pfad);
      if (text === null) {
        funde.push(`${z.kennung}: ${f.pfad} fehlt`);
        continue;
      }
      if (f.zeile < 1 || f.zeile > text.split("\n").length) {
        funde.push(`${z.kennung}: ${f.pfad}:${f.zeile} liegt außerhalb der Datei`);
      }
      if (!marke.test(text)) funde.push(`${z.kennung}: ${f.pfad} nennt die Runde nicht`);
    }
  }
  return funde;
}

/**
 * Prüft die gesicherten Berichtstexte. Jede Datei muss einer der 32 Berichte sein, byte-gleich
 * (SHA-256), und das Archiv muss genau die Anzahl der gesicherten Texte nennen.
 */
function kopienMaengel(
  dateien: readonly { name: string; inhalt: Buffer }[],
  archiv: string,
): string[] {
  const funde: string[] = [];
  for (const d of dateien) {
    const b = BERICHTE.find((x) => x.datei === d.name);
    if (!b) {
      funde.push(`${d.name}: kein Originalbericht dieses Namens`);
      continue;
    }
    if (createHash("sha256").update(d.inhalt).digest("hex") !== b.sha256) {
      funde.push(`${d.name}: SHA-256 weicht vom Original ab`);
    }
  }
  const stand = archiv.match(/Sicherungsstand: (\d+) von 32 Berichtstexten/);
  if (!stand) funde.push("Archiv nennt keinen Sicherungsstand");
  else if (Number(stand[1]) !== dateien.length) {
    funde.push(`Archiv nennt ${stand[1]} gesicherte Texte, im Repository liegen ${dateien.length}`);
  }
  return funde;
}

/**
 * Die Markerzeile ist die letzte Zeile des Berichts. Sie trägt die SHA-256 über alle Bytes davor
 * („Inhalt oberhalb dieser Zeile“). Zurück kommen der angegebene und der nachgerechnete Wert.
 */
function inhaltsSha(inhalt: Buffer): { angegeben: string | null; gerechnet: string } {
  let ende = inhalt.length;
  if (ende > 0 && inhalt[ende - 1] === 0x0a) ende -= 1;
  const start = inhalt.lastIndexOf(0x0a, ende - 1) + 1;
  const marker = inhalt.subarray(start, ende).toString("utf8");
  const angegeben = marker.match(/[0-9a-f]{64}/)?.[0] ?? null;
  const gerechnet = createHash("sha256").update(inhalt.subarray(0, start)).digest("hex");
  return { angegeben, gerechnet };
}

const VERDIKT_MUSTER =
  /(?:GESAMTVERDIKT|Gesamtverdikt|Kurzverdikt)(?:[^\n]*?\b(GRUEN|GELB|ROT)\b|\s*\n+\s*\*\*(GRUEN|GELB|ROT)\b)/g;

/** Das Gesamtverdikt, das der Berichtstext selbst nennt; `null`, wenn keins oder widersprüchlich. */
function verdiktAus(text: string): string | null {
  const treffer = [...text.matchAll(VERDIKT_MUSTER)];
  const woerter = new Set(treffer.map((m) => (m[1] ?? m[2]) as string));
  if (woerter.size !== 1) return null;
  const wort = [...woerter][0] as string;
  return wort === "GRUEN" ? "GRÜN" : wort;
}

/** Vergleicht jede Tabellenzeile mit dem Text ihres gesicherten Berichts. */
function berichtMaengel(archiv: string, kopie: (datei: string) => Buffer | null): string[] {
  const funde: string[] = [];
  for (const z of zeilenAus(archiv)) {
    const inhalt = kopie(z.datei);
    if (inhalt === null) {
      funde.push(`${z.kennung}: Bericht ${z.datei} ist nicht gesichert`);
      continue;
    }
    const sha = inhaltsSha(inhalt);
    if (sha.angegeben === null) funde.push(`${z.kennung}: keine Markerzeile mit SHA-256`);
    else {
      if (sha.angegeben !== sha.gerechnet) {
        funde.push(`${z.kennung}: Inhalts-SHA der Markerzeile passt nicht zum Text`);
      }
      if (z.inhaltsSha !== sha.angegeben) {
        funde.push(`${z.kennung}: Inhalts-SHA der Tabelle weicht von der Markerzeile ab`);
      }
    }
    const verdikt = verdiktAus(inhalt.toString("utf8"));
    if (verdikt !== z.verdikt) {
      funde.push(`${z.kennung}: Tabelle sagt ${z.verdikt}, Bericht sagt ${verdikt ?? "nichts"}`);
    }
  }
  return funde;
}

const NICHT_REPRODUZIERBAR = ": Inhalts-SHA der Markerzeile passt nicht zum Text";

/**
 * Die Kennungen, deren Markerzeile das Archiv ausdrücklich als nicht reproduzierbar führt. Ein
 * historischer Bericht wird nicht verändert; seine falsche Selbstauskunft wird benannt.
 */
function alsNichtReproduzierbarGefuehrt(archiv: string): string[] {
  const zeile = archiv.match(/\*\*Markerzeile nicht reproduzierbar:\*\*([^\n]*)/);
  return zeile ? [...(zeile[1] as string).matchAll(/[AB]-sammel\d+/g)].map((m) => m[0]) : [];
}

/**
 * Alle Abweichungen außer den im Archiv benannten nicht reproduzierbaren Markerzeilen; dazu jede
 * benannte, die in Wahrheit stimmt. Leer heißt: Tabelle, Archivtext und Berichte passen zusammen.
 */
function unerklaerteAbweichungen(
  archiv: string,
  kopie: (datei: string) => Buffer | null,
): string[] {
  const gefuehrt = alsNichtReproduzierbarGefuehrt(archiv);
  const funde = berichtMaengel(archiv, kopie);
  const erwartet = gefuehrt.map((k) => `${k}${NICHT_REPRODUZIERBAR}`);
  const veraltet = erwartet
    .filter((e) => !funde.includes(e))
    .map((e) => `${e.split(":")[0]}: als nicht reproduzierbar geführt, passt aber`);
  return [...funde.filter((f) => !erwartet.includes(f)), ...veraltet];
}

interface Zeilenwerte {
  verdikt?: string;
  fundstellen?: string;
  sha?: string;
  inhaltsSha?: string;
}

function zeileFuer(b: Bericht, w: Zeilenwerte = {}): string {
  const {
    verdikt = "ROT",
    fundstellen = SPURLOS,
    sha = b.sha256,
    inhaltsSha: inh = "0".repeat(64),
  } = w;
  return `| ${b.kennung} | \`${b.datei}\` | — | — | ${verdikt} | x | — | ${fundstellen} | \`${sha}\` | \`${inh}\` | 1 | 1 |`;
}

function synthetisch(ausser: string[] = [], extra: string[] = []): string {
  const zeilen = BERICHTE.filter((b) => !ausser.includes(b.kennung)).map((b) => zeileFuer(b));
  return [...zeilen, ...extra].join("\n");
}

const bericht = (kennung: string) => BERICHTE.find((b) => b.kennung === kennung) as Bericht;
const sha256 = (s: string) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");

describe("Kalibrierung der Archivregel an synthetischen Archiven", () => {
  const keineDatei = () => null;

  it("die Liste umfasst 32 Berichte: 19 in Reihe A (26–44), 13 in Reihe B (26–38)", () => {
    expect(BERICHTE).toHaveLength(32);
    expect(new Set(BERICHTE.map((b) => b.kennung)).size).toBe(32);
    expect(BERICHTE.filter((b) => b.kennung.startsWith("A-"))).toHaveLength(19);
    expect(BERICHTE.filter((b) => b.kennung.startsWith("B-"))).toHaveLength(13);
  });

  it("ein vollständiges, spurloses Archiv trägt", () => {
    expect(maengel(synthetisch(), keineDatei)).toEqual([]);
  });

  it("gleiche Nummer in beiden Reihen: keiner der beiden Berichte verdrängt den anderen", () => {
    // Der Fehler der ersten Fassung: eine Zeile je Nummer. Fehlt B-sammel34, darf die Zeile
    // A-sammel34 ihn nicht decken.
    expect(maengel(synthetisch(["B-sammel34"]), keineDatei)).toEqual([
      "B-sammel34: 0 Zeilen statt genau einer",
    ]);
    expect(maengel(synthetisch(["A-sammel34"]), keineDatei)).toEqual([
      "A-sammel34: 0 Zeilen statt genau einer",
    ]);
  });

  it("eine Zeile mit bloßer Rundennummer ohne Reihe zählt für keinen Bericht", () => {
    const ohneReihe = `| sammel31 | — | — | — | ROT | — | — | ${SPURLOS} |`;
    const archiv = synthetisch(["A-sammel31"], [ohneReihe]);
    expect(maengel(archiv, keineDatei)).toEqual(["A-sammel31: 0 Zeilen statt genau einer"]);
  });

  it("eine doppelte Zeile, eine fremde Kennung und ein falscher Hash sind rot", () => {
    const fremd = { kennung: "B-sammel39", datei: "BERICHT-sammel39.md", sha256: "x" };
    const archiv = synthetisch(
      ["B-sammel29"],
      [
        zeileFuer(bericht("A-sammel40")),
        zeileFuer(bericht("B-sammel29"), { sha: "0".repeat(64) }),
        zeileFuer(fremd),
      ],
    );
    expect(maengel(archiv, keineDatei)).toEqual([
      "A-sammel40: 2 Zeilen statt genau einer",
      "B-sammel29: SHA-256 weicht von der Quellenhilfe ab",
      "B-sammel39: kein Originalbericht dieser Kennung",
    ]);
  });

  it("ein Verdikt außerhalb von GRÜN, GELB, ROT ist rot", () => {
    const archiv = synthetisch(
      ["A-sammel27"],
      [zeileFuer(bericht("A-sammel27"), { verdikt: "nicht übernommen" })],
    );
    expect(maengel(archiv, keineDatei)).toEqual([
      "A-sammel27: Gesamtverdikt „nicht übernommen“ ist nicht GRÜN, GELB oder ROT",
    ]);
  });

  it("eine Zeile ohne Fundstelle, die nicht spurlos sagt, ist rot", () => {
    const leer = zeileFuer(bericht("A-sammel38"), { fundstellen: "—" });
    const archiv = synthetisch(["A-sammel38"], [leer]);
    expect(maengel(archiv, keineDatei)).toEqual([
      "A-sammel38: ohne Fundstelle, sagt aber nicht „keine Fundstelle im Code“",
    ]);
  });

  it("eine Fundstelle, die die Runde nicht nennt, fehlt oder zu kurz ist, ist rot", () => {
    const archiv = synthetisch(
      ["A-sammel32", "B-sammel33", "A-sammel34"],
      [
        zeileFuer(bericht("A-sammel32"), { fundstellen: "`a.ts:1`" }),
        zeileFuer(bericht("B-sammel33"), { fundstellen: "`fehlt.ts:1`" }),
        zeileFuer(bericht("A-sammel34"), { fundstellen: "`b.ts:9`" }),
      ],
    );
    const dateien: Record<string, string> = {
      // `sammel320` ist nicht `sammel32`: die Marke endet an der Ziffernfolge.
      "a.ts": "// sammel320\n",
      "b.ts": "// sammel34\n",
    };
    expect(maengel(archiv, (p) => dateien[p] ?? null)).toEqual([
      "A-sammel32: a.ts nennt die Runde nicht",
      "B-sammel33: fehlt.ts fehlt",
      "A-sammel34: b.ts:9 liegt außerhalb der Datei",
    ]);
  });
});

describe("Kalibrierung der Kopienprüfung (Sicherungsstand)", () => {
  const stand = (n: number) =>
    `**Sicherungsstand: ${n} von 32 Berichtstexten liegen im Repository.**`;

  it("keine Kopie und „0 von 32“ trägt", () => {
    expect(kopienMaengel([], stand(0))).toEqual([]);
  });

  it("eine behauptete Sicherung ohne Datei ist rot", () => {
    expect(kopienMaengel([], stand(32))).toEqual([
      "Archiv nennt 32 gesicherte Texte, im Repository liegen 0",
    ]);
  });

  it("eine veränderte Kopie, eine fremde Datei und eine fehlende Standzeile sind rot", () => {
    const dateien = [
      { name: "BERICHT-sammel38.md", inhalt: Buffer.from("verändert\n") },
      { name: "BERICHT-sammel99.md", inhalt: Buffer.from("x") },
    ];
    expect(kopienMaengel(dateien, "kein Stand")).toEqual([
      "BERICHT-sammel38.md: SHA-256 weicht vom Original ab",
      "BERICHT-sammel99.md: kein Originalbericht dieses Namens",
      "Archiv nennt keinen Sicherungsstand",
    ]);
  });

  it("der Hash ist der SHA-256 über die rohen Bytes", () => {
    // Bekannter Wert des leeren Inhalts: so ist belegt, dass hier kein anderer Hash rechnet.
    expect(createHash("sha256").update(Buffer.alloc(0)).digest("hex")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("Kalibrierung der Berichtsprüfung (Verdikt und Inhalts-SHA aus dem Text)", () => {
  const oben = "# Bericht\n\nBefund.\n\nGESAMTVERDIKT: GELB\n";
  const echt = Buffer.from(`${oben}SHA-256: ${sha256(oben)}\n`, "utf8");
  const b = bericht("A-sammel41");
  const archivMit = (w: Zeilenwerte) => zeileFuer(b, w);

  it("die Markerzeile wird über die Bytes oberhalb nachgerechnet, mit und ohne Schlussumbruch", () => {
    expect(inhaltsSha(echt)).toEqual({ angegeben: sha256(oben), gerechnet: sha256(oben) });
    const ohneUmbruch = Buffer.from(`${oben}SHA-256: ${sha256(oben)}`, "utf8");
    expect(inhaltsSha(ohneUmbruch).gerechnet).toBe(sha256(oben));
  });

  it("passender Bericht trägt", () => {
    const archiv = archivMit({ verdikt: "GELB", inhaltsSha: sha256(oben) });
    expect(berichtMaengel(archiv, () => echt)).toEqual([]);
  });

  it("veränderter Text, abweichende Tabellen-SHA und falsches Verdikt sind rot", () => {
    const veraendert = Buffer.from(echt.toString("utf8").replace("Befund.", "Befund!"), "utf8");
    const archiv = archivMit({ verdikt: "ROT", inhaltsSha: "1".repeat(64) });
    expect(berichtMaengel(archiv, () => veraendert)).toEqual([
      "A-sammel41: Inhalts-SHA der Markerzeile passt nicht zum Text",
      "A-sammel41: Inhalts-SHA der Tabelle weicht von der Markerzeile ab",
      "A-sammel41: Tabelle sagt ROT, Bericht sagt GELB",
    ]);
  });

  it("fehlende Kopie, fehlende Markerzeile und widersprüchliche Verdikte sind rot", () => {
    expect(berichtMaengel(archivMit({ verdikt: "GELB" }), () => null)).toEqual([
      "A-sammel41: Bericht BERICHT-ben-sammel41-mega42.md ist nicht gesichert",
    ]);
    const zweiDeutig = Buffer.from("Gesamtverdikt ROT.\n\nGESAMTVERDIKT: GELB\nEnde\n", "utf8");
    expect(berichtMaengel(archivMit({ verdikt: "GELB" }), () => zweiDeutig)).toEqual([
      "A-sammel41: keine Markerzeile mit SHA-256",
      "A-sammel41: Tabelle sagt GELB, Bericht sagt nichts",
    ]);
  });

  it("nicht reproduzierbar: benannt trägt, unbenannt oder veraltet ist rot", () => {
    const veraendert = Buffer.from(echt.toString("utf8").replace("Befund.", "Befund!"), "utf8");
    const zeile = archivMit({ verdikt: "GELB", inhaltsSha: sha256(oben) });
    const benannt = `${zeile}\n\n**Markerzeile nicht reproduzierbar:** A-sammel41.\n`;
    expect(unerklaerteAbweichungen(benannt, () => veraendert)).toEqual([]);
    expect(unerklaerteAbweichungen(zeile, () => veraendert)).toEqual([
      `A-sammel41${NICHT_REPRODUZIERBAR}`,
    ]);
    expect(unerklaerteAbweichungen(benannt, () => echt)).toEqual([
      "A-sammel41: als nicht reproduzierbar geführt, passt aber",
    ]);
  });

  it("die Verdiktformen der Berichte werden erkannt", () => {
    expect(verdiktAus("## GESAMTVERDIKT\n\n**GELB.** Kein Blocker")).toBe("GELB");
    expect(verdiktAus("## Kurzverdikt\n\n**GRUEN:** testseitig")).toBe("GRÜN");
    expect(verdiktAus("**GESAMTVERDIKT PATCH 72: ROT / NO-GO AS-IS.**")).toBe("ROT");
    expect(verdiktAus("Daher lautet das Gesamtverdikt GELB.\n…\nGESAMTVERDIKT: GELB")).toBe("GELB");
    expect(verdiktAus("kein Urteil")).toBeNull();
  });
});

describe("R-2042: das echte Archiv sammel26–44", () => {
  const archiv = readFileSync(join(WURZEL, ARCHIV_PFAD), "utf8");
  const ordner = join(WURZEL, KOPIEN_PFAD);
  const kopie = (datei: string) => {
    const voll = join(ordner, datei);
    return existsSync(voll) ? readFileSync(voll) : null;
  };
  const lesen = (pfad: string) => {
    const voll = join(WURZEL, pfad);
    return existsSync(voll) ? readFileSync(voll, "utf8") : null;
  };

  it("alle 32 Berichte liegen byte-gleich im Repository, und das Archiv sagt 32 von 32", () => {
    const dateien = existsSync(ordner)
      ? readdirSync(ordner).map((name) => ({ name, inhalt: readFileSync(join(ordner, name)) }))
      : [];
    expect(kopienMaengel(dateien, archiv)).toEqual([]);
    expect(dateien).toHaveLength(32);
  });

  it("führt jeden der 32 Berichte genau einmal mit Datei und Hash, jede Fundstelle trägt", () => {
    expect(maengel(archiv, lesen)).toEqual([]);
  });

  it("Gesamtverdikt und Inhalts-SHA jeder Zeile sind die des Berichts, nachgerechnet", () => {
    // Prüflauf Nacharbeit 6: 31 von 32 Markerzeilen rechnen sich nach, B-sammel29 nicht. Das
    // Archiv führt sie als nicht reproduzierbar; jede weitere oder entfallene Abweichung ist rot.
    expect(unerklaerteAbweichungen(archiv, kopie)).toEqual([]);
    expect(alsNichtReproduzierbarGefuehrt(archiv)).toEqual(["B-sammel29"]);
  });

  it("ordnet die Fundstellen der richtigen Reihe zu und zählt so, wie es im Text steht", () => {
    const zeilen = zeilenAus(archiv);
    expect(zeilen.filter((z) => z.fundstellen.length > 0).map((z) => z.kennung)).toEqual([
      "A-sammel32",
      "A-sammel34",
      "A-sammel37",
      "A-sammel39",
      "A-sammel40",
      "A-sammel42",
      "A-sammel43",
      "A-sammel44",
      "B-sammel33",
      "B-sammel34",
    ]);
    // sammel34: der Word-Kopierweg gehört zur mega35-Gegenprüfung, WP-SHIP8-CLOSE-7 zum Recheck.
    const a34 = zeilen.find((z) => z.kennung === "A-sammel34") as Zeile;
    const b34 = zeilen.find((z) => z.kennung === "B-sammel34") as Zeile;
    expect(a34.fundstellen.map((f) => f.pfad)).toEqual([
      "tests-smoke/word-taskpane-kopieren.spec.ts",
    ]);
    expect(b34.fundstellen.map((f) => f.pfad)).toEqual(["tests/app/review-claim-recovery.test.ts"]);
    expect(archiv).toContain("32 Berichte, 19 in Reihe A und 13 in Reihe B");
    // BEN Nacharbeit 2: die Zählzeile nannte 11 statt 10. Sie wird jetzt an der Tabelle gemessen.
    const mitSpur = zeilen.filter((z) => z.fundstellen.length > 0).length;
    const genannt = archiv.match(/(\d+)\s+Berichte haben versionierte Fundstellen/);
    expect(Number(genannt?.[1])).toBe(mitSpur);
    expect(archiv).toMatch(new RegExp(`Die übrigen ${32 - mitSpur} sind nur über`));
  });

  it("die Verdiktzählung im Text stimmt mit der Tabelle überein", () => {
    const zeilen = zeilenAus(archiv);
    for (const reihe of ["A", "B"] as const) {
      const n = (v: string) =>
        zeilen.filter((z) => z.kennung.startsWith(`${reihe}-`) && z.verdikt === v).length;
      expect(archiv).toContain(
        `Reihe ${reihe} hat ${n("GRÜN")} GRÜN, ${n("GELB")} GELB und ${n("ROT")} ROT`,
      );
    }
  });

  it("OFFEN.md I5 verweist aufs Archiv, behält den alten Wortlaut, nennt Reihen und 32/32", () => {
    const register = readFileSync(join(WURZEL, "OFFEN.md"), "utf8");
    const i5 = register.split("\n").find((l) => l.startsWith("| I5 |"));
    expect(i5).toBeDefined();
    expect(i5).toContain("Die älteren Runden sammel26–44 stehen weiterhin aus.");
    expect(i5).toContain(ARCHIV_PFAD);
    expect(i5).toContain("32 Stück in zwei Reihen");
    expect(i5).toContain("32 von 32 Berichtstexten");
    expect(i5).not.toContain("0 von 32 Berichtstexten");
  });
});
