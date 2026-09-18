// ================================================================================================
// JOB 4329 · DIE KALIBRIERUNG DER VORBEREITUNG — ohne sie wäre der Integrationslauf still grün.
// ================================================================================================
//
// Der Integrationslauf (`rueckweg-bilder-pg-im-browser.integration.test.ts`) misst, ob die BILDER
// durch Server, PostgreSQL und Fläche kommen. Er misst NICHT, ob die Bilder überhaupt etwas
// tragen. Trüge `pruefbilder.ts` zwei leere, gleiche oder falsch kodierte Bilder, wäre dort jede
// Zusicherung erfüllt und bewiese nichts — genau der Fehler, den §5 Nr. 2 des Auftrags benennt.
//
// Diese Datei läuft im normalen Tor (`*.test.ts` fällt unter `BESTAND_INCLUDE`,
// `vitest.config.ts:83`), braucht weder Datenbank noch Browser noch Netz, und sie prüft die
// Vorbereitung gegen sich selbst UND gegen das Produkt:
//
//   · Die PNGs werden mit einem EIGENEN Minimalleser dekodiert — nicht mit dem Schreiber von
//     nebenan. Ein Schreiber, der gegen sich selbst gemessen wird, ist immer richtig.
//   · Die Bildpunkt-Regel wird an ALLEN Punkten nachgemessen: Eindeutigkeit, Alpha, Trennung der
//     beiden Bilder.
//   · Der Rumpf läuft durch den ECHTEN Sanitizer des Servers (`services/structure`) — die Stelle,
//     an der eine unsichere `src` zu `__INVALID_IMG__` würde (`sanitize.ts:197-198`).
//   · Die Nutzlast wird auf GENAU die vier Felder von `rwLadung` geprüft, nicht auf „enthält".
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../services/structure";
import {
  ABSATZ,
  BILD1,
  BILD2,
  FIXTUREN,
  FOTO_INNEN_MINDESTKANTE,
  PRUEFBILDER,
  type Pruefbild,
  STATEMENT,
  UEBERSCHRIFT,
  bodyHtmlWieAusWord,
  erwartetePunkteRGBA,
  fotoInnenmass,
  nutzlastWieRwLadung,
  pngBytes,
  sha256,
} from "./pruefbilder";

// ------------------------------------------------------------------------------------------------
// EIN EIGENER, MINIMALER PNG-LESER — die zweite, unabhängige Meinung über die erzeugten Bytes.
// ------------------------------------------------------------------------------------------------
//
// Er kann genau das, was `pngBytes` schreibt, und nichts darüber hinaus: Signatur, IHDR mit
// Bittiefe 8 und Farbtyp 2, ein oder mehrere IDAT, Filterbyte 0 je Zeile, IEND. Jede Abweichung
// wirft mit Grund — ein Leser, der Unbekanntes überliest, bewiese nichts.

interface Gelesen {
  breite: number;
  hoehe: number;
  /** R, G, B je Bildpunkt, zeilenweise. */
  rgb: number[];
}

const SIGNATUR = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngLesen(png: Buffer): Gelesen {
  if (!png.subarray(0, 8).equals(SIGNATUR)) {
    throw new Error("keine PNG-Signatur");
  }
  let pos = 8;
  let breite = 0;
  let hoehe = 0;
  const idat: Buffer[] = [];
  let ihdrGesehen = false;
  let iendGesehen = false;
  const fremde: string[] = [];
  while (pos + 8 <= png.length) {
    const laenge = png.readUInt32BE(pos);
    const typ = png.toString("ascii", pos + 4, pos + 8);
    const daten = png.subarray(pos + 8, pos + 8 + laenge);
    if (typ === "IHDR") {
      breite = daten.readUInt32BE(0);
      hoehe = daten.readUInt32BE(4);
      if (daten[8] !== 8) {
        throw new Error(`Bittiefe ${String(daten[8])} statt 8`);
      }
      if (daten[9] !== 2) {
        throw new Error(`Farbtyp ${String(daten[9])} statt 2 (RGB ohne Alpha)`);
      }
      if (daten[12] !== 0) {
        throw new Error("verschränktes PNG — der exakte Vergleich wäre nicht mehr zulässig");
      }
      ihdrGesehen = true;
    } else if (typ === "IDAT") {
      idat.push(Buffer.from(daten));
    } else if (typ === "IEND") {
      iendGesehen = true;
    } else {
      fremde.push(typ);
    }
    pos += 12 + laenge;
  }
  if (!ihdrGesehen || !iendGesehen) {
    throw new Error("IHDR oder IEND fehlt");
  }
  // Ein Farbprofil (`iCCP`, `gAMA`, `cHRM`) machte den exakten Bildpunktvergleich zu einer
  // Farbumrechnung — `pruefbilder.ts` schreibt bewusst keines, und das wird hier gemessen.
  if (fremde.length > 0) {
    throw new Error(`fremde Blöcke im PNG: ${fremde.join(", ")}`);
  }
  const roh = inflateSync(Buffer.concat(idat));
  const zeilenlaenge = 1 + breite * 3;
  if (roh.length !== hoehe * zeilenlaenge) {
    throw new Error(`entpackt ${roh.length} Bytes, erwartet ${hoehe * zeilenlaenge}`);
  }
  const rgb: number[] = [];
  for (let y = 0; y < hoehe; y += 1) {
    const anfang = y * zeilenlaenge;
    if (roh[anfang] !== 0) {
      throw new Error(`Zeile ${y} trägt Filter ${String(roh[anfang])} statt 0`);
    }
    for (let i = anfang + 1; i < anfang + zeilenlaenge; i += 1) {
      rgb.push(roh[i] as number);
    }
  }
  return { breite, hoehe, rgb };
}

function punkteAls(bild: Pruefbild): string[] {
  const alle: string[] = [];
  for (let y = 0; y < bild.hoehe; y += 1) {
    for (let x = 0; x < bild.breite; x += 1) {
      alle.push(bild.punkt(x, y).join(","));
    }
  }
  return alle;
}

describe("JOB 4329 · Kalibrierung der Prüfbilder und der Nutzlast", () => {
  it("K1 · die Bildpunkt-Regel: Maße, Eindeutigkeit, volle Deckung, getrennte Farbräume", () => {
    expect([BILD1.breite, BILD1.hoehe], "Bild 1 hat nicht 96×64").toEqual([96, 64]);
    expect([BILD2.breite, BILD2.hoehe], "Bild 2 hat nicht 80×56").toEqual([80, 56]);

    const punkte1 = punkteAls(BILD1);
    const punkte2 = punkteAls(BILD2);
    expect(punkte1.length, "Bild 1 zählt nicht 96·64 Punkte").toBe(6144);
    expect(punkte2.length, "Bild 2 zählt nicht 80·56 Punkte").toBe(4480);

    const menge1 = new Set(punkte1);
    const menge2 = new Set(punkte2);
    expect(
      menge1.size,
      "in Bild 1 wiederholt sich ein Punkt — gegen Verschiebung und Spiegelung wäre es damit blind",
    ).toBe(punkte1.length);
    expect(
      menge2.size,
      "in Bild 2 wiederholt sich ein Punkt — gegen Verschiebung und Spiegelung wäre es damit blind",
    ).toBe(punkte2.length);
    const gemeinsam = [...menge1].filter((p) => menge2.has(p));
    expect(
      gemeinsam.slice(0, 5),
      "Bild 1 und Bild 2 teilen sich Punkte — „vertauscht“ wäre dann nicht messbar",
    ).toEqual([]);

    // Jeder Kanal im Bereich, und die Parität, die die beiden Bilder trennt.
    for (const bild of PRUEFBILDER) {
      for (let y = 0; y < bild.hoehe; y += 1) {
        for (let x = 0; x < bild.breite; x += 1) {
          const [r, g, b] = bild.punkt(x, y);
          expect(
            [r, g, b].every((w) => Number.isInteger(w) && w >= 0 && w <= 255),
            `Bild ${bild.nr}, Punkt (${x},${y}) liegt außerhalb 0…255: ${r},${g},${b}`,
          ).toBe(true);
          expect(
            r % 2,
            `Bild ${bild.nr}: der Rotkanal hat die falsche Parität bei (${x},${y})`,
          ).toBe(bild.nr === 1 ? 0 : 1);
        }
      }
    }
  });

  it("K2 · die erwartete Leinwandreihe ist vollständig deckend (Alpha 255) und zeilenweise", () => {
    for (const bild of PRUEFBILDER) {
      const rgba = erwartetePunkteRGBA(bild);
      expect(rgba.length, `Bild ${bild.nr}: die Reihe hat nicht vier Werte je Punkt`).toBe(
        bild.breite * bild.hoehe * 4,
      );
      for (let i = 3; i < rgba.length; i += 4) {
        expect(rgba[i], `Bild ${bild.nr}: Punkt ${(i - 3) / 4} ist nicht deckend`).toBe(255);
      }
      // Stichprobe an drei Stellen — zeilenweise, nicht spaltenweise.
      const mitte = ((bild.hoehe >> 1) * bild.breite + (bild.breite >> 1)) * 4;
      expect(
        [rgba[0], rgba[1], rgba[2]],
        `Bild ${bild.nr}: der erste Punkt der Reihe ist nicht (0,0)`,
      ).toEqual([...bild.punkt(0, 0)]);
      expect(
        [rgba[mitte], rgba[mitte + 1], rgba[mitte + 2]],
        `Bild ${bild.nr}: die Reihe läuft nicht zeilenweise`,
      ).toEqual([...bild.punkt(bild.breite >> 1, bild.hoehe >> 1)]);
    }
  });

  it("K3 · die erzeugten PNGs dekodieren zu genau diesen Maßen und Punkten", () => {
    for (const fix of FIXTUREN) {
      const gelesen = pngLesen(fix.png);
      expect(
        [gelesen.breite, gelesen.hoehe],
        `Bild ${fix.bild.nr}: das PNG trägt andere Maße als die Regel`,
      ).toEqual([fix.bild.breite, fix.bild.hoehe]);
      const erwartet: number[] = [];
      for (let y = 0; y < fix.bild.hoehe; y += 1) {
        for (let x = 0; x < fix.bild.breite; x += 1) {
          erwartet.push(...fix.bild.punkt(x, y));
        }
      }
      expect(
        gelesen.rgb.length,
        `Bild ${fix.bild.nr}: das PNG gibt nicht drei Werte je Punkt her`,
      ).toBe(erwartet.length);
      expect(
        gelesen.rgb,
        `Bild ${fix.bild.nr}: das dekodierte PNG weicht von der Bildpunkt-Regel ab`,
      ).toEqual(erwartet);
    }
  });

  it("K4 · die PNG-Erzeugung ist deterministisch — zweimal erzeugt ist byte-gleich", () => {
    for (const bild of PRUEFBILDER) {
      const a = pngBytes(bild);
      const b = pngBytes(bild);
      expect(a.equals(b), `Bild ${bild.nr}: zwei Läufe erzeugen verschiedene Bytes`).toBe(true);
      expect(sha256(a), `Bild ${bild.nr}: der Hash hängt vom Lauf ab, nicht von der Tabelle`).toBe(
        sha256(b),
      );
    }
  });

  it("K5 · der Rumpf steht wie aus Word: zwei data:-Quellen in <p>, keine figure", () => {
    const rumpf = bodyHtmlWieAusWord();
    expect(rumpf, "die Überschrift fehlt").toContain(`<h2>${UEBERSCHRIFT}</h2>`);
    expect(rumpf, "der Absatz fehlt").toContain(ABSATZ);
    expect(ABSATZ.length, "der Absatz ist kürzer als 40 Zeichen").toBeGreaterThanOrEqual(40);
    expect(
      rumpf.toLowerCase().includes("<figure"),
      "der Rumpf trägt eine figure — Word setzt Bilder in <p>, und mit figure zöge die Galerie die Bilder ein zweites Mal ein",
    ).toBe(false);

    const quellen = [...rumpf.matchAll(/<img src="(data:image\/png;base64,[^"]+)">/g)].map(
      (m) => m[1] as string,
    );
    expect(quellen.length, "der Rumpf trägt nicht genau zwei Bildquellen").toBe(2);
    expect(
      quellen.map((q) => sha256(q)),
      "die Bildquellen stehen nicht in Dokumentreihenfolge Bild 1, Bild 2",
    ).toEqual(FIXTUREN.map((f) => f.sha256Quelle));
    // Jedes Bild steht GENAU EINMAL — sonst wäre „genau zwei <img>" in der Fläche kein Befund.
    for (const fix of FIXTUREN) {
      expect(
        rumpf.split(fix.quelle).length - 1,
        `die Quelle von Bild ${fix.bild.nr} steht nicht genau einmal im Rumpf`,
      ).toBe(1);
    }
  });

  it("K6 · der Sanitizer des Servers lässt beide Bilder mit UNVERÄNDERTER src stehen", () => {
    const rumpf = bodyHtmlWieAusWord();
    const sauber = sanitizeHtml(rumpf);
    expect(
      sauber,
      "der Sanitizer hat ein Bild verworfen (__INVALID_IMG__, sanitize.ts:197-198)",
    ).not.toContain("__INVALID_IMG__");
    const quellen = [...sauber.matchAll(/<img[^>]*\ssrc="(data:image\/png;base64,[^"]+)"/g)].map(
      (m) => m[1] as string,
    );
    expect(quellen.length, "nach dem Sanitizer stehen nicht mehr zwei Bildquellen da").toBe(2);
    expect(
      quellen.map((q) => sha256(q)),
      "der Sanitizer hat eine Bildquelle verändert — dann misst der Browserlauf etwas anderes als das Gesendete",
    ).toEqual(FIXTUREN.map((f) => f.sha256Quelle));
    expect(sanitizeHtml(sauber), "der Sanitizer ist auf diesem Rumpf nicht idempotent").toBe(
      sauber,
    );
  });

  it("K7 · die Nutzlast trägt GENAU die vier Felder von rwLadung (rueckweg.js:606-614)", () => {
    const rumpf = bodyHtmlWieAusWord();
    const ladung = nutzlastWieRwLadung({
      statement: `  ${STATEMENT}  `,
      bodyHtml: rumpf,
      baseVersion: 3,
    });
    // Wörtlich aus `apps/web/public/word-addin/rueckweg.js:606-614`:
    //   return JSON.stringify({
    //     action: "propose",
    //     proposal: { statement: statement, bodyHtml: koerper,
    //                 baseVersion: version, origin: "word_addin" } });
    expect(Object.keys(ladung), "die Nutzlast hat nicht genau { action, proposal }").toEqual([
      "action",
      "proposal",
    ]);
    expect(
      Object.keys(ladung.proposal),
      "der Vorschlag trägt nicht genau statement, bodyHtml, baseVersion, origin — in dieser Reihenfolge",
    ).toEqual(["statement", "bodyHtml", "baseVersion", "origin"]);
    expect(ladung.action).toBe("propose");
    expect(ladung.proposal.origin).toBe("word_addin");
    expect(ladung.proposal.baseVersion).toBe(3);
    expect(ladung.proposal.bodyHtml).toBe(rumpf);
    expect(ladung.proposal.statement, "rwLadung trimmt den Text (`text.trim()`)").toBe(STATEMENT);
    // Die Zeichenkette selbst — `JSON.stringify` folgt der Einfügereihenfolge, also ist auch der
    // gesendete Körper zeichengleich zu dem des Add-ins.
    expect(JSON.stringify(ladung)).toBe(
      `{"action":"propose","proposal":{"statement":${JSON.stringify(STATEMENT)},"bodyHtml":${JSON.stringify(rumpf)},"baseVersion":3,"origin":"word_addin"}}`,
    );
    // Und der gesendete Körper trägt BEIDE Bildquellen — sonst reiste nur eines mit.
    const wiederGelesen = JSON.parse(JSON.stringify(ladung)) as {
      proposal: { bodyHtml: string };
    };
    for (const fix of FIXTUREN) {
      expect(
        wiederGelesen.proposal.bodyHtml.includes(fix.quelle),
        `die Quelle von Bild ${fix.bild.nr} überlebt die Serialisierung der Nutzlast nicht`,
      ).toBe(true);
    }
  });

  it("K8 · der Innenbereich des Bildschirmfotos ist groß genug, um etwas zu belegen", () => {
    for (const bild of PRUEFBILDER) {
      const innen = fotoInnenmass(bild);
      expect(
        [innen.breite, innen.hoehe],
        `Bild ${bild.nr}: der Innenbereich hat nicht die erwartete Grösse`,
      ).toEqual(bild.nr === 1 ? [68, 36] : [52, 28]);
      expect(
        Math.min(innen.breite, innen.hoehe),
        `Bild ${bild.nr}: der Innenbereich unterschreitet die Mindestkante`,
      ).toBeGreaterThanOrEqual(FOTO_INNEN_MINDESTKANTE);
      // Zwei verschiedene Farben im Innenbereich — ein einfarbiger Fleck dürfte nie grün werden.
      const farben = new Set<string>();
      for (let y = 0; y < innen.hoehe; y += 1) {
        for (let x = 0; x < innen.breite; x += 1) {
          farben.add(bild.punkt(x + 14, y + 14).join(","));
        }
      }
      expect(
        farben.size,
        `Bild ${bild.nr}: der Innenbereich ist einfarbig — er könnte jedes andere Bild derselben Farbe sein`,
      ).toBeGreaterThan(1);
    }
  });
});
