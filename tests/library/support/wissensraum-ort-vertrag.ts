// ==================================================================================================
// AUFTRAG PRO 381 — TESTHILFE DER RED-FIRST-PRÜFFLÄCHE „WISSENSRAUM · ERSTE SICHTBARE WELLE“.
// ==================================================================================================
//
// Diese Datei enthält KEINE Zusicherung. Sie enthält (a) die drei Artefakte, die die spätere
// Umsetzungswelle bauen wird, (b) einen Lader, der sie zur Laufzeit auflöst, und (c) die Bausteine
// für die Vorgaben. Mehr nicht — die Zusicherungen stehen in den `wissensraum381-*`-Testdateien.
//
// WARUM EIN LADER STATT EINES GEWÖHNLICHEN IMPORTS — und das ist die einzige Entwurfsentscheidung
// dieser Datei, die eine Begründung braucht:
//
// Ein statischer `import` einer noch nicht existierenden Datei macht die GANZE Testdatei zu EINEM
// roten Sammelposten („Cannot find module“) und zusätzlich den Typecheck des Repos rot. Beides wäre
// für PRO 381 schädlich, denn der Auftrag verlangt ausdrücklich: „Berichte exakt, welche Fälle rot
// und welche Bewahrungsanker bereits grün sind." Aus einem einzigen Sammel-Rot ist das nicht
// ablesbar, und ein roter Typecheck verdeckt zusätzlich die Bewahrungsanker, die HEUTE schon grün
// sind und es bleiben müssen.
//
// Mit dem Lader wird jeder Fall EINZELN rot, mit einer Meldung, die den fehlenden Pfad nennt. Die
// Zusicherungen selbst sind vollwertig: sobald die Datei existiert, läuft der echte Code gegen die
// echten Erwartungen — hier wird nichts gestubbt, nichts vorgetäuscht und nichts übersprungen.
// AUSDRÜCKLICH NICHT verwendet: `describe.skip`, `it.todo` oder ein `try/catch`, das ein fehlendes
// Modul in Grün verwandelt. Ein Fall, den es noch nicht gibt, ist ROT — das ist der Sinn.
//
// GRENZE, die hier stehen bleiben soll: die Export-NAMEN unten sind mit dieser Prüffläche gesetzt.
// PLAN PRO 378 §4.2 benennt Modul, Ort und Aufgabe der drei Artefakte, aber keine Bezeichner. Die
// Umsetzungswelle übernimmt diese Namen — oder ändert sie in einem ausdrücklichen Auftrag mit.
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Wurzel des Arbeitsbaums, aus der Lage DIESER Datei abgeleitet (tests/library/support/ → ../../..).
// Bewusst NICHT `process.cwd()`: das hinge davon ab, aus welchem Verzeichnis Vitest gestartet wurde.
//
// UND BEWUSST OHNE `new URL(relativ, import.meta.url)` — gemessen, nicht vermutet: In der
// jsdom-Umgebung ist `URL` global die jsdom-Fassung, und die löst eine relative Basis gegen den
// DOKUMENT-Ursprung auf statt gegen die `file:`-URL. Aus `file:///…/tests/library/support/x.ts`
// wurde dort `http://localhost:3000/@fs/Users/peterkohnert/Documents` — ein Pfad, der zwei
// Verzeichnisse zu hoch UND vom falschen Schema ist. Der Fehler war still: er trat nur in den
// gemounteten Testdateien auf, nicht in den DOM-freien.
//
// `fileURLToPath` auf der unveränderten Zeichenkette geht durch Nodes eigenen Parser; das Hochgehen
// erledigt danach `resolve`, das keine URL-Semantik kennt und deshalb in beiden Umgebungen gleich
// rechnet.
const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** Absoluter Pfad einer repo-relativen Datei — unabhängig vom Startverzeichnis von Vitest. */
export function repoPfad(relativ: string): string {
  return resolve(REPO_WURZEL, relativ);
}

// ---- Die drei Artefakte aus PLAN PRO 378 §4.2 „Neu (3)“ ------------------------------------------

export const ORT_ARTEFAKTE = {
  /** `P-1` · Ortszeile: Pfad + Unterraumliste + Umschalter, präsentational. */
  scopeBar: "apps/web/src/components/LibraryScopeBar.tsx",
  /** `P-2` · Heimatzeile am Treffer, nach dem Muster von `KoAuthorLine.tsx`. */
  homeLine: "apps/web/src/components/trust/KoHomeLine.tsx",
  /** Reines, DOM-freies Modul: `raum`-Parameter, Pfadprojektion, die Zustände `Z-1` bis `Z-4`. */
  librarySpace: "apps/web/src/lib/librarySpace.ts",
} as const;

export type OrtArtefakt = keyof typeof ORT_ARTEFAKTE;

/** Ein geladenes Artefakt — bewusst offen typisiert, die Zusicherungen prüfen die Wirklichkeit. */
export type OrtModul = Record<string, unknown>;

/** Repo-relativer Pfad eines Artefakts (für Meldungen und den Existenz-Test). */
export function ortArtefaktPfad(artefakt: OrtArtefakt): string {
  return ORT_ARTEFAKTE[artefakt];
}

/** Existiert das Artefakt im Arbeitsbaum? (Der Existenz-Test selbst ist eine Zusicherung.) */
export function ortArtefaktExistiert(artefakt: OrtArtefakt): boolean {
  return existsSync(resolve(REPO_WURZEL, ORT_ARTEFAKTE[artefakt]));
}

/**
 * Lädt ein Artefakt. Fehlt es, wird der Fall mit einer Meldung ROT, die den Pfad nennt und sagt,
 * dass genau das der erwartete Zustand vor der Umsetzungswelle ist.
 */
export async function ladeOrtArtefakt(artefakt: OrtArtefakt): Promise<OrtModul> {
  const relativ = ORT_ARTEFAKTE[artefakt];
  const absolut = resolve(REPO_WURZEL, relativ);
  if (!existsSync(absolut)) {
    throw new Error(
      `ROT (erwartet, PRO 381): ${relativ} existiert im Arbeitsbaum noch nicht. Diese Prüffläche steht VOR dem Produktcode — der Fall wird grün, sobald die Umsetzungswelle das Artefakt baut. Kein Test darf dafür künstlich grün gemacht werden.`,
    );
  }
  return (await import(/* @vite-ignore */ pathToFileURL(absolut).href)) as OrtModul;
}

/**
 * Liest den QUELLTEXT eines Artefakts. Gebraucht für Zusicherungen über AUFRUFWEGE (`R-12`): dass
 * ein Modul eine Zahl nicht ausrechnet, ist am Ergebnis nur für die geprüften Eingaben belegbar —
 * dass es die zählenden Module gar nicht erst kennt, ist am Quelltext strukturell belegbar.
 */
export function leseOrtArtefakt(artefakt: OrtArtefakt): string {
  const relativ = ORT_ARTEFAKTE[artefakt];
  const absolut = resolve(REPO_WURZEL, relativ);
  if (!existsSync(absolut)) {
    throw new Error(
      `ROT (erwartet, PRO 381): ${relativ} existiert im Arbeitsbaum noch nicht — der Quelltext ist deshalb nicht prüfbar.`,
    );
  }
  return readFileSync(absolut, "utf8");
}

/** Holt einen Export und wird rot, wenn er fehlt — der Name ist Teil des Vertrags. */
export function ortExport(modul: OrtModul, name: string, artefakt: OrtArtefakt): unknown {
  if (!(name in modul)) {
    throw new Error(
      `ROT (erwartet, PRO 381): ${ORT_ARTEFAKTE[artefakt]} exportiert „${name}“ nicht. ` +
        `Vorhandene Exporte: ${Object.keys(modul).join(", ") || "(keine)"}.`,
    );
  }
  return modul[name];
}

/** Wie `ortExport`, aber stellt zusätzlich sicher, dass der Export aufrufbar ist. */
export function ortFunktion(
  modul: OrtModul,
  name: string,
  artefakt: OrtArtefakt,
): (...args: unknown[]) => unknown {
  const wert = ortExport(modul, name, artefakt);
  if (typeof wert !== "function") {
    throw new Error(
      `ROT (erwartet, PRO 381): ${ORT_ARTEFAKTE[artefakt]} · „${name}“ ist keine Funktion ` +
        `(ist: ${typeof wert}).`,
    );
  }
  return wert as (...args: unknown[]) => unknown;
}

// ---- Der beschlossene Vertrag als Konstanten ------------------------------------------------------

/**
 * KW-ARCH-WISSENSRAUM-ERSTE-WELLE-01 · Entscheidung 4: „Maximale Navigationstiefe in Zielstufe 1:
 * 15." Eine Kette DARÜBER ist in Zielstufe 1 nicht darstellbar — und weil die Oberfläche über den
 * Ort nichts erfinden darf (PLAN 378 §4.3 Satz 3), ist die einzige ehrliche Antwort darauf KEIN
 * Pfad. Ein gekürzter Pfad verriete die Tiefe (§5.2 Regel 2), also fällt er ganz weg.
 */
export const ORT_MAX_TIEFE = 15;

/** Der URL-Parameter des Geltungsbereichs (PLAN 378 §4.2, Präzedenz `von`/`bis` in `facetRail`). */
export const ORT_URL_PARAM = "raum";

/** Ein Kettenglied, wie es der Server liefert: Kennung plus bereits aufgelöster Name. */
export interface OrtKnoten {
  id: string;
  name: string;
}

/** Eine vollständig sichtbare Kette der gewünschten Tiefe (Wurzel zuerst). */
export function sichtbareKette(tiefe: number): OrtKnoten[] {
  return Array.from({ length: tiefe }, (_unused, i) => ({
    id: `raum-${i + 1}`,
    name: `Wissensraum ${i + 1}`,
  }));
}

/**
 * Die vier Formen einer LÜCKENHAFTEN Kette, gegen die `§5.2` Regel 2 gerichtet ist. Der Server
 * soll die Kette „ganz oder gar nicht“ liefern — die Oberfläche darf sich darauf aber nicht
 * VERLASSEN, sonst hinge die Leckfreiheit an fremder Disziplin statt an der eigenen Bauform.
 * Deshalb wird jede dieser Formen einzeln geprüft.
 */
export function lueckenhafteKetten(): Array<{ name: string; kette: unknown }> {
  const ganz = sichtbareKette(3);
  return [
    { name: "ein Glied ist null", kette: [ganz[0], null, ganz[2]] },
    { name: "ein Glied hat einen leeren Namen", kette: [ganz[0], { id: "r2", name: "" }, ganz[2]] },
    { name: "einem Glied fehlt der Name ganz", kette: [ganz[0], { id: "r2" }, ganz[2]] },
    {
      name: "die Kette meldet sich selbst als unvollständig",
      kette: { chain: ganz, complete: false },
    },
  ];
}

/**
 * Ein Wissensobjekt OHNE jede Ortsangabe, aber mit prall gefüllten Feldern, aus denen sich ein Ort
 * verlockend ableiten liesse: Kategorie, Schlagwörter, Titel und ein Quellpfad. Genau das verbietet
 * PLAN 378 §4.3 Satz 3 — geprüft in `R-4`.
 */
export function koOhneOrt(): Record<string, unknown> {
  return {
    id: "ko-ohne-ort",
    title: "Anlage 1 / Halle Nord / Ventilwartung",
    statement: "Bei Überdruck Ventil X manuell schließen.",
    category: "Anlage 1",
    tags: ["halle-nord", "ventil", "wartung"],
    type: "best_practice",
    sources: [{ id: "s1", label: "Handbuch", url: "https://intern.example/anlage-1/halle-nord" }],
    // Kein `home` — weder null noch undefined, das Feld fehlt schlicht (Altbestand).
  };
}
