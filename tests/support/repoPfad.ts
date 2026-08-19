// ================================================================================================
// JOB 1155 · D1 — DIE REPOWURZEL FÜR TESTS, GEBUNDEN AN DIESE DATEI STATT AN DEN AUFRUF.
// ================================================================================================
//
// DAS PROBLEM, wörtlich aus dem Urteil `_relay/kopf/outbox/BEN-PRUEFUNG-JOB-642-D3.md`:
// „Der zuvor cwd-abhängige Test las den gebundenen Produktpfad über `resolve(process.cwd(),
// TASKPANE)`. Dadurch hing der Nachweis vom Aufrufverzeichnis ab, obwohl der zu prüfende
// Repositorypfad unverändert war."
//
// `process.cwd()` ist eine Eigenschaft des AUFRUFS, nicht des Repositories. Ein Test, der seine
// Produktdatei so auflöst, ist grün oder rot je nachdem, aus welchem Verzeichnis Vitest gestartet
// wurde — er misst dann die Startbedingung mit, nicht nur das Produkt. `import.meta.url` dagegen
// ist die Lage DIESER Datei im Baum und ändert sich durch keinen Verzeichniswechsel.
//
// Von `tests/support/` sind es fest zwei Ebenen zur Wurzel.
//
// BEWUSST OHNE `new URL(relativ, import.meta.url)` — gemessen, nicht vermutet, und im Bestand unter
// `tests/library/support/wissensraum-ort-vertrag.ts:35-44` dokumentiert: In der jsdom-Umgebung ist
// `URL` global die jsdom-Fassung, und die löst eine relative Basis gegen den DOKUMENT-Ursprung auf
// statt gegen die `file:`-URL. Aus `file:///…/tests/support/x.ts` wurde dort
// `http://localhost:3000/@fs/Users/peterkohnert/Documents` — zwei Verzeichnisse zu hoch und vom
// falschen Schema. Der Fehler war still: er trat nur in den gemounteten Testdateien auf.
//
// `fileURLToPath` auf der unveränderten Zeichenkette geht durch Nodes eigenen Parser; das Hochgehen
// erledigt danach `resolve`, das keine URL-Semantik kennt und deshalb in beiden Umgebungen gleich
// rechnet.
//
// GELTUNGSBEREICH: Diese Datei ist eine TESTHILFE und enthält keine Zusicherung. Ihr Nachweis steht
// in `tests/app/job642-testpfade-cwd-unabhaengig.test.ts`. Bestehende Testdateien werden mit JOB
// 1155 D1 ausdrücklich NICHT umgestellt — das wäre ein Massenumbau und ist nicht beauftragt.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Wurzel des Arbeitsbaums, abgeleitet aus der Lage DIESER Datei (`tests/support/` → zwei Ebenen). */
export const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Absoluter Pfad einer repo-relativen Datei — unabhängig vom Startverzeichnis von Vitest.
 *
 * @param relativ Pfad relativ zur Repowurzel, etwa `apps/web/public/word-addin/taskpane.html`.
 */
export function repoPfad(relativ: string): string {
  return resolve(REPO_WURZEL, relativ);
}
