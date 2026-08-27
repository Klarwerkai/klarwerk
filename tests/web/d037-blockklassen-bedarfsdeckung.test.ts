// JOB 2461 D1 · BASIC5 · Scheibe D-037, Abschluss
//
// ════════════════════════════════════════════════════════════════════════════════════════════
//  WAS DIESE DATEI BEWACHT — und in welche RICHTUNG:
//
//    Jede Blockklasse, die im Produkt GEBRAUCHT wird, muss das Sanitizing überleben.
//
//  Gebraucht heißt: es gibt eine Darstellungsregel `.prose-kw .KLASSE` in `index.css`, oder
//  `bodyReadMode.ts` führt sie als Blocktyp. Überlebt sie das Sanitizing nicht, ist die Regel
//  tot — der Block wird ohne seine Auszeichnung dargestellt, und kein Fehler sagt etwas.
//
//  DIE RICHTUNG IST ABSICHT, und sie ist der Unterschied zu einem Pin auf den Listeninhalt:
//    · Eine gebrauchte Klasse aus der Erlaubnisliste ENTFERNEN  → rot, mit der Fundstelle,
//      die dadurch verwaist.
//    · Eine neue Klasse HINZUFÜGEN                              → grün. Erweitern bleibt
//      erlaubt; dieser Wächter steht der nächsten Scheibe nicht im Weg.
//
//  Wer eine neue Blockklasse einführt, braucht hier nichts einzutragen: Sobald sie eine
//  Darstellungsregel bekommt, ist sie erfasst.
// ════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { sanitizeHtml } from "../../apps/web/src/lib/richText";
// Beide Einheiten exportieren `sanitizeHtml` — der Alias hält auseinander, welche Seite prüft.
import { sanitizeHtml as sanitizeAufServer } from "../../services/structure/src/sanitize";

// JOB 2442: process.cwd() ist im Zwischenschritt mit --root nicht der Baumwurzel gleich.
const pfad = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const INDEX_CSS = pfad("../../apps/web/src/index.css");
const BODY_READ_MODE = pfad("../../apps/web/src/lib/bodyReadMode.ts");

interface Bedarf {
  klasse: string;
  fundstelle: string;
}

/**
 * Erhebt aus `index.css` jede Klasse, für die es eine Darstellungsregel im Lesekörper gibt.
 * Nur `.prose-kw .KLASSE` zählt — ein Tag-Selektor (`.prose-kw table`) ist keine Klasse, und
 * eine Regel außerhalb von `.prose-kw` gehört der Oberfläche, nicht dem sanitisierten Inhalt.
 */
function erhebeBedarfAusCss(css: string): Bedarf[] {
  const gefunden: Bedarf[] = [];
  const gesehen = new Set<string>();
  css.split("\n").forEach((zeile, i) => {
    if (zeile.trim().startsWith("/*") || zeile.trim().startsWith("*")) {
      return;
    }
    for (const m of zeile.matchAll(/\.prose-kw\s+\.([a-z][a-z0-9-]*)/g)) {
      const klasse = m[1];
      if (klasse && !gesehen.has(klasse)) {
        gesehen.add(klasse);
        gefunden.push({ klasse, fundstelle: `apps/web/src/index.css:${i + 1}` });
      }
    }
  });
  return gefunden;
}

/** Erhebt die Blocktypen, die der Blöcke-Chip im Lesemodus erkennt (dritte Liste, JOB 2442). */
function erhebeBedarfAusLesemodus(quelle: string): Bedarf[] {
  const block = quelle.match(/const BODY_BLOCK_CLASSES = new Set\(\[([\s\S]*?)\]\)/);
  if (!block?.[1]) {
    return [];
  }
  const gefunden: Bedarf[] = [];
  for (const zeile of block[1].split("\n")) {
    if (zeile.trim().startsWith("//")) {
      continue;
    }
    for (const m of zeile.matchAll(/"([a-z][a-z0-9-]*)"/g)) {
      if (m[1]) {
        gefunden.push({ klasse: m[1], fundstelle: "apps/web/src/lib/bodyReadMode.ts" });
      }
    }
  }
  return gefunden;
}

function warnung(b: Bedarf, wer: string): string {
  return [
    "",
    `Die Blockklasse "${b.klasse}" wird gebraucht, überlebt das Sanitizing aber nicht mehr.`,
    "",
    `  gebraucht in:   ${b.fundstelle}`,
    `  entfernt durch: ${wer}`,
    "",
    "Damit ist die Darstellungsregel tot: Der Block wird weiterhin gespeichert und angezeigt,",
    "aber ohne seine Auszeichnung — kein Rahmen, kein Akzent, keine Tönung. Das fällt in keinem",
    "anderen Test auf, weil der Inhalt stimmt und nur das Aussehen fehlt.",
    "",
    "Wurde die Klasse absichtlich abgeschafft? Dann gehört BEIDES entfernt: der Eintrag in den",
    "Sanitizern UND die Darstellungsregel an der oben genannten Fundstelle. Solange die Regel",
    "steht, ist die Entfernung aus der Erlaubnisliste ein Versehen.",
    "",
    "Diese Zusicherung verlangt NICHT, dass die Erlaubnisliste unverändert bleibt — eine neue",
    "Klasse hinzuzufügen ist erlaubt und macht hier nichts rot.",
  ].join("\n");
}

describe("D-037 · Block A · die Bedarfserhebung ist kalibriert", () => {
  it("A1 · sie findet die Blockklassen in index.css", () => {
    // Ohne diesen Fall wäre eine blinde Erhebung (Umbau der Regeln, anderer Wrapper-Selektor)
    // nicht von „alles in Ordnung" zu unterscheiden: Block B liefe gegen eine leere Menge und
    // wäre still grün. Lehre aus JOB 2455.
    const bedarf = erhebeBedarfAusCss(readFileSync(INDEX_CSS, "utf8"));

    expect(bedarf.length).toBeGreaterThan(0);
    expect(bedarf.map((b) => b.klasse)).toContain("panel");
  });

  it("A2 · sie hält einen Tag-Selektor nicht für eine Klasse", () => {
    const css = [
      ".prose-kw table {",
      "  width: 100%;",
      "}",
      ".prose-kw .panel {",
      "  padding: 1px;",
      "}",
    ].join("\n");

    expect(erhebeBedarfAusCss(css).map((b) => b.klasse)).toEqual(["panel"]);
  });

  it("A3 · sie überliest eine Regel, die nicht dem Lesekörper gilt", () => {
    // `.prose-kw` grenzt den sanitisierten Fremdinhalt gegen die Oberfläche ab (index.css:73-74).
    // Eine Oberflächenklasse läuft nie durch den Sanitizer und ist kein Bedarf.
    const css = [".sidebar .panel-info {", "  color: red;", "}"].join("\n");

    expect(erhebeBedarfAusCss(css)).toEqual([]);
  });

  it("A4 · sie findet die Blocktypen des Lesemodus", () => {
    const bedarf = erhebeBedarfAusLesemodus(readFileSync(BODY_READ_MODE, "utf8"));

    expect(bedarf.length).toBeGreaterThan(0);
    expect(bedarf.map((b) => b.klasse)).toContain("panel-warning");
  });
});

describe("D-037 · Block B · jede gebrauchte Blockklasse überlebt beide Sanitizer", () => {
  it("B1 · was index.css darstellt, kommt durch den Sanitizer der Oberfläche", () => {
    for (const b of erhebeBedarfAusCss(readFileSync(INDEX_CSS, "utf8"))) {
      const aus = sanitizeHtml(`<div class="${b.klasse}"><p>x</p></div>`);

      expect(aus, warnung(b, "apps/web/src/lib/richText.ts · ALLOWED_DIV_CLASSES")).toContain(
        `class="${b.klasse}"`,
      );
    }
  });

  it("B2 · und durch den Sanitizer des Servers — sonst driften beide Seiten", () => {
    for (const b of erhebeBedarfAusCss(readFileSync(INDEX_CSS, "utf8"))) {
      const aus = sanitizeAufServer(`<div class="${b.klasse}"><p>x</p></div>`);

      expect(aus, warnung(b, "services/structure/src/sanitize.ts · ALLOWED_DIV_CLASSES")).toContain(
        `class="${b.klasse}"`,
      );
    }
  });

  it("B3 · was der Blöcke-Chip erkennt, muss ihn auch erreichen", () => {
    // Fällt eine dieser Klassen im Sanitizing, meldet der Chip dauerhaft „keine Blöcke" —
    // ohne dass irgendetwas fehlschlägt.
    for (const b of erhebeBedarfAusLesemodus(readFileSync(BODY_READ_MODE, "utf8"))) {
      const aus = sanitizeHtml(`<div class="${b.klasse}"><p>x</p></div>`);

      expect(aus, warnung(b, "apps/web/src/lib/richText.ts · ALLOWED_DIV_CLASSES")).toContain(
        `class="${b.klasse}"`,
      );
    }
  });

  it("B4 · GEGENPROBE: die Erhebung liest den Bedarf, nicht die Erlaubnis", () => {
    // Der Beleg dafür, dass eine Erweiterung der Erlaubnisliste hier nichts rot macht: Die
    // Bedarfsquellen kennen die Liste nicht. Was in der Liste steht, ohne gebraucht zu werden,
    // taucht in der Erhebung gar nicht erst auf — und was gebraucht wird, ohne in der Liste zu
    // stehen, ist genau der Bruch, den Block B meldet.
    const cssOhneRegel = [".prose-kw .panel {", "  padding: 1px;", "}"].join("\n");

    expect(erhebeBedarfAusCss(cssOhneRegel).map((b) => b.klasse)).toEqual(["panel"]);
  });
});
