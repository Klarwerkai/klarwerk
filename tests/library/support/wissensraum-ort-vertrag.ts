// ==================================================================================================
// AUFTRAG PRO 381 — TESTHILFE DER RED-FIRST-PRÜFFLÄCHE „WISSENSRAUM · ERSTE SICHTBARE WELLE“.
// ==================================================================================================
//
// R-1349 (Aufnahme gesamt-aufruferwaechter, Nacharbeit 10): Diese Datei trug bis hierher außerdem
// die drei Artefakte der geplanten Umsetzungswelle (`LibraryScopeBar`, `KoHomeLine`,
// `lib/librarySpace.ts`), einen Lader dafür und die Bausteine ihrer Vorgaben (Ketten, Tiefe, ein
// KO ohne Ort). Die Welle mit `home`-Kette kam nicht; geliefert ist das flache Space-Modell
// (produkt:20261007:spaces — führender Space je Artikel, `/spaces`, Sprache „Space“). Die drei
// Artefakte waren nie montiert und sind entfernt, mit ihnen der Lader und die Prüfstände, die nur
// sie maßen (`wissensraum381-bauteile`, `-ortsprojektion`, `-sicherheit-leckfreiheit`).
//
// GEBLIEBEN sind die Bewahrungsanker der Bibliothek (`wissensraum381-bewahrung-*`,
// `-sicherheit-gemerkte-sichten`, `-sicherheit-keine-ortszahl`): sie messen, dass die Bibliothek
// einen `raum`-Parameter ignoriert und der Ort keine Facette wird — beides gilt unverändert.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

/**
 * Der URL-Parameter des geplanten Geltungsbereichs (PLAN 378 §4.2, Präzedenz `von`/`bis` in
 * `facetRail`). Die Bewahrungsanker prüfen, dass die Bibliothek ihn heute IGNORIERT.
 */
export const ORT_URL_PARAM = "raum";
