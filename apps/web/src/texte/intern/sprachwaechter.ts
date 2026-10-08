// ================================================================================================
// R-1169 / R-0983 · DER SPRACHWÄCHTER IM BAUPROZESS — HART CODIERTE TEXTE UND UNBEKANNTE SPRACHEN.
// ================================================================================================
//
// R-1169 verlangt einen Wächter im Bau, der anschlägt, wenn ein Text nicht in allen drei Sprachen
// vorliegt, wenn eine unbekannte Sprache auftaucht, UND wenn ein Text hart im Code steht statt in
// der Übersetzungsdatei. Die erste Hälfte trägt seit JOB 4367 der Textmodul-Vertrag
// (`./pruefung.ts`, Regeln 4 und — seit dieser Aufnahme — „unbekannter Eintrag" in der Modulform).
// Diese Datei trägt die beiden anderen:
//
//   1. UNBEKANNTE SPRACHE IM GRUNDBESTAND. `woerterbuch/` führt je Sprache eine Datei. Eine
//      `fr.ts` dort wäre heute still: `i18n.ts` importiert sie nicht, niemand sähe sie. Der Wächter
//      lässt nur die Sprachen der Oberfläche zu (`SPRACHEN` aus `./pruefung.ts`).
//
//   2. HART CODIERTE ANZEIGETEXTE IN TSX. Gesucht wird zeilenweise nach zwei Formen, die in diesem
//      Baum Anzeigetext bedeuten:
//        · Text zwischen zwei Tags auf derselben Zeile:   <span>Bildgröße</span>
//        · ein Textattribut mit Wortlaut:                 title="App-Version (Beta-Phase)"
//                                                         (title, placeholder, aria-label, alt)
//      Ein Wort zählt ab drei Buchstaben. Ausgenommen sind Kommentarzeilen (`//`, `*`, `{/*`), ein
//      `>` nach `=` oder `-` (Pfeilfunktion `=> Promise<…>`, kein Tag) und Text mit `:` oder `,`
//      (Typargumente wie `Map<string, X>, b: Set<…>`).
//
// WAS DER WÄCHTER NICHT SIEHT, ausdrücklich: Text, der über mehrere Zeilen läuft, Text mit Doppel-
// punkt oder Komma, Zeichenketten in Variablen und Texte in `.ts`-Dateien. Er ist eine Sperrklinke
// gegen den häufigsten Fall, kein Beweis, dass nirgends ein Text hart steht.
//
// DIE SPERRKLINKE. Was heute noch gefunden wird, steht namentlich in `BEKANNTE_STELLEN` — mit Grund.
// Mehr Funde in einer Datei, oder Funde in einer Datei, die dort nicht steht, brechen den Bau ab
// und nennen Datei, Zeile und Wortlaut. Weniger Funde sind kein Fehler; der Eintrag gehört dann
// herabgesetzt (das hält `tests/sprache-begriffe/sprachwaechter.test.ts`, Fall H-2).
//
// WARUM HIER UND NICHT NUR IM TEST: dieselbe Funktion ruft das Vite-Plugin `textmodul-vertrag`
// (`./sammeln.ts`) beim Produktbuild. Damit fällt ein neuer harter Text im Bau auf, nicht erst im
// Browser — und nicht nur dort, wo jemand den Test laufen lässt.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SPRACHEN } from "./pruefung";

/**
 * Eine Zeile mit hart codiertem Anzeigetext. Bewusst EIN Ausdruck — die Zahlen in
 * `BEKANNTE_STELLEN` sind mit genau diesem Ausdruck erhoben.
 */
export const HARTKODIERT_MUSTER =
  /^\s*(?:[^/*\s{]|\{[^/]).*(?:(?:^|[^=-])>[^<>{}()=&|;:,]*[A-Za-zÄÖÜäöüß]{3,}[^<>{}()=&|;:,]*<|\b(?:placeholder|title|aria-label|alt)="[^"{]*[A-Za-zÄÖÜäöüß]{3,}[^"]*")/;

export interface BekannteStelle {
  /** So viele Zeilen dürfen in dieser Datei höchstens gefunden werden. */
  readonly anzahl: number;
  /** Warum sie bleiben dürfen — ohne Grund kein Eintrag. */
  readonly grund: string;
}

/** Die heute gemessenen Funde, relativ zu `apps/web/src`, mit Grund. */
export const BEKANNTE_STELLEN: Readonly<Record<string, BekannteStelle>> = {
  "auth/BrandPanel.tsx": {
    anzahl: 1,
    grund: "Marke „klarwerk.ai“ unter dem Anmeldebild — ein Name, kein übersetzbarer Text.",
  },
  "auth/SsoCallback.tsx": {
    anzahl: 2,
    grund: "Marke „KLARWERK“ und „klarwerk.ai“ auf der Rückkehrseite der Anmeldung.",
  },
  "pages/Mobile.tsx": {
    anzahl: 1,
    grund: "Marke „KLARWERK“ im Kopf der mobilen Fläche.",
  },
  "pages/Capture.tsx": {
    anzahl: 1,
    grund:
      "Fehltreffer: eine Zeile eines mehrzeiligen JSX-Kommentars, die mit einem Backtick beginnt.",
  },
};

export interface Fund {
  /** relativ zu `apps/web/src`, mit `/` */
  readonly datei: string;
  /** 1-basiert */
  readonly zeile: number;
  readonly text: string;
}

/** Die Zeilennummern (1-basiert), die das Muster in einem Quelltext trifft. */
export function hartkodierteZeilen(quelle: string): number[] {
  const treffer: number[] = [];
  const zeilen = quelle.split("\n");
  for (let index = 0; index < zeilen.length; index += 1) {
    if (HARTKODIERT_MUSTER.test(zeilen[index] ?? "")) {
      treffer.push(index + 1);
    }
  }
  return treffer;
}

/** Alle `.tsx`-Dateien unter `srcOrdner`, ohne Testdateien und ohne versteckte Ordner. */
function tsxDateien(srcOrdner: string, unterordner = ""): string[] {
  const ordner = unterordner === "" ? srcOrdner : join(srcOrdner, unterordner);
  let eintraege: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
  try {
    eintraege = readdirSync(ordner, { withFileTypes: true });
  } catch {
    return []; // kein Ordner ist ein gültiger Zustand (Bühnen der Vertragstests)
  }
  const gefunden: string[] = [];
  for (const eintrag of eintraege) {
    if (eintrag.name.startsWith(".")) {
      continue;
    }
    const relativ = unterordner === "" ? eintrag.name : `${unterordner}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      gefunden.push(...tsxDateien(srcOrdner, relativ));
    } else if (
      eintrag.isFile() &&
      eintrag.name.endsWith(".tsx") &&
      !eintrag.name.endsWith(".test.tsx")
    ) {
      gefunden.push(relativ);
    }
  }
  return gefunden.sort();
}

/** Jeder Fund im Baum — für die Meldung und für den Test. */
export function hartkodierteFunde(srcOrdner: string): Fund[] {
  const funde: Fund[] = [];
  for (const datei of tsxDateien(srcOrdner)) {
    const zeilen = readFileSync(join(srcOrdner, datei), "utf8").split("\n");
    for (const nummer of hartkodierteZeilen(zeilen.join("\n"))) {
      funde.push({ datei, zeile: nummer, text: (zeilen[nummer - 1] ?? "").trim() });
    }
  }
  return funde;
}

/**
 * Die Sperrklinke: Befunde als Liste, leer heißt grün. Gemeldet wird je Datei, die MEHR Funde trägt
 * als `bekannt` erlaubt — mit jeder Fundzeile, damit niemand suchen muss.
 */
export function pruefeHartkodierteTexte(
  srcOrdner: string,
  bekannt: Readonly<Record<string, BekannteStelle>> = BEKANNTE_STELLEN,
): string[] {
  const jeDatei = new Map<string, Fund[]>();
  for (const fund of hartkodierteFunde(srcOrdner)) {
    jeDatei.set(fund.datei, [...(jeDatei.get(fund.datei) ?? []), fund]);
  }
  const fehler: string[] = [];
  for (const [datei, funde] of [...jeDatei.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const erlaubt = bekannt[datei]?.anzahl ?? 0;
    if (funde.length > erlaubt) {
      const stellen = funde.map((f) => `${f.datei}:${f.zeile} ${f.text}`).join(" | ");
      fehler.push(
        `${datei}: ${funde.length} hart codierte Anzeigetexte, erlaubt ${erlaubt} — Text über t("…") aus einem Textmodul holen (apps/web/src/texte/). Fundstellen: ${stellen}`,
      );
    }
  }
  return fehler;
}

/** Unbekannte Sprachen im Grundbestand: jede Datei in `woerterbuch/`, die keine Sprache der Oberfläche ist. */
export function pruefeSprachdateien(srcOrdner: string): string[] {
  let dateien: string[] = [];
  try {
    dateien = readdirSync(join(srcOrdner, "woerterbuch"));
  } catch {
    return []; // kein Grundbestand-Ordner (Bühnen der Vertragstests) — nichts zu prüfen
  }
  const erlaubt = new Set<string>(SPRACHEN.map((sprache) => `${sprache}.ts`));
  const fehler: string[] = [];
  for (const datei of [...dateien].sort()) {
    if (datei.startsWith(".") || erlaubt.has(datei)) {
      continue;
    }
    fehler.push(
      `woerterbuch/${datei}: unbekannte Sprache — die Oberfläche kennt nur ${SPRACHEN.join(", ")}. Eine weitere Sprache wäre hier still ignoriert worden.`,
    );
  }
  return fehler;
}
