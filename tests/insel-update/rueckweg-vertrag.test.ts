// ================================================================================================
// JOB 4107 — EINE AUSSAGE, ZWEI ORTE: die `ROLLBACK.md` des Releases und `rueckfall.sh` selbst.
// ================================================================================================
//
// DER FEHLER, GEGEN DEN DIESE DATEI STEHT: Die `ROLLBACK.md` jedes Releases sagte pauschal
// „Zurueckgespielt wird nur auf Ansage: `rueckfall.sh --daten-zurueck <sicherung>`". Für das Journal
// stimmte das. Für einen Postgres-Dump nicht: dort übergibt der Rückfall an `restore-drill.sh`, und
// der PRÜFT den Dump in einer eigenen, leeren Zieldatenbank — die Produktivdaten bleiben unberührt.
// Das Release versprach damit etwas, das sein eigenes Werkzeug nicht tut, und niemand merkte es:
// der Text wurde nirgends gegen das Verhalten gehalten.
//
// WAS HIER GEMESSEN WIRD — und warum es kein Wortlauttest ist: Aus dem WIRKLICH AUSGEFÜHRTEN
// `rollbackText()` wird je Datenhaltung der ZUGESAGTE Ausgang herausgelesen, und derselbe Fall wird
// danach mit dem echten `rueckfall.sh` GEFAHREN. Verglichen werden Zahl gegen Zahl. Ändert einer der
// beiden Orte seine Aussage, ohne dass der andere folgt, wird diese Datei rot — gleichgültig, wie
// die Sätze formuliert sind.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  WURZEL,
  aktivesRelease,
  fahreRueckfall,
  fahreUpdate,
  legeDumpAn,
  legeInselAn,
  legeInselwegeAn,
  legeJournalAn,
  legePaketAn,
  raeumeAb,
  rueckfallInKopie,
  schreibeDatei,
  schreibePruefDrill,
  schreibeRelease,
  setzeCurrent,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";

/**
 * Der Text, den das Release als `ROLLBACK.md` mitbekommt — ERZEUGT, nicht abgeschrieben.
 * `build-current-release.mjs:173` schreibt genau dieses Ergebnis in jedes Release.
 */
function rollbackMd(): string {
  const erzeugt = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import { rollbackText } from ${JSON.stringify(join(WURZEL, "scripts/insel/release-texte.mjs"))};
process.stdout.write(rollbackText("klarwerk-insel-probe"));`,
    ],
    { encoding: "utf8" },
  );
  if (erzeugt.status !== 0) {
    throw new Error(`rollbackText() lief nicht: ${erzeugt.stderr ?? ""}`);
  }
  return erzeugt.stdout;
}

/**
 * Der Absatz zu einer Datenhaltung: ab der Zeile mit der Marke bis zur nächsten Aufzählung oder
 * Leerzeile. So bleibt die Aussage zu Postgres von der zu Journal getrennt prüfbar.
 */
function absatz(text: string, marke: string): string {
  const zeilen = text.split("\n");
  const start = zeilen.findIndex((z) => z.includes(marke));
  if (start < 0) {
    return "";
  }
  const rest = zeilen.slice(start + 1);
  const ende = rest.findIndex((z) => z.startsWith("- ") || z.trim() === "");
  return [zeilen[start], ...(ende < 0 ? rest : rest.slice(0, ende))].join("\n");
}

/** Der Ausgang, den der Text für diesen Fall ZUSAGT. */
function zugesagterAusgang(text: string, marke: string): number {
  const teil = absatz(text, marke);
  const treffer = /Exit\s+\**(\d+)/.exec(teil);
  if (treffer === null) {
    throw new Error(`Die ROLLBACK.md nennt für „${marke}" keinen Ausgang. Absatz:\n${teil}`);
  }
  return Number(treffer[1]);
}

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Eine laufende 1.1.0 auf einer Insel, daneben die Betriebswege und das Prüfskript des Drills. */
async function inselMitUpdate(): Promise<{ dort: Insel; rueckfallSkript: string }> {
  const dort = await legeInselAn();
  insel = dort;
  schreibeRelease(dort.releases, { name: ALT, appVersion: "1.0.0" });
  setzeCurrent(dort, ALT);
  legeJournalAn(dort);
  const weg = legeInselwegeAn(dort);
  schreibePruefDrill(weg, join(dort.wurzel, "drill-aufrufe.txt"));

  const update = fahreUpdate(dort, legePaketAn(dort, { name: NEU, appVersion: "1.1.0" }));
  expect(update.code, update.ausgabe).toBe(0);
  return { dort, rueckfallSkript: rueckfallInKopie(weg) };
}

describe("JOB 4107 · ROLLBACK.md und rueckfall.sh sagen dasselbe", () => {
  it("V1 · die pauschale Zusage ist ABGELOEST, nicht danebengelassen", () => {
    const text = rollbackMd();

    // Genau der Satz, der für Postgres falsch war. Taucht er wieder auf, ist die Ablösung weg.
    expect(text).not.toMatch(/Zurueckgespielt wird nur auf Ansage/);
    // Der Postgres-Absatz darf für den Dump keine Rückspielung behaupten.
    const postgres = absatz(text, "**Postgres**");
    expect(postgres, "der Postgres-Absatz fehlt ganz").not.toBe("");
    expect(postgres).not.toMatch(/zur[üu]e?ckgespielt/i);
    expect(postgres).toContain("Produktivdatenbank");
    // Für das Journal bleibt die Zusage stehen — dort stimmt sie.
    expect(absatz(text, "**Journal**")).toMatch(/zur[üu]e?ck/i);
  });

  it("V2 · Postgres: der zugesagte Ausgang ist der, den das Skript wirklich liefert", async () => {
    const text = rollbackMd();
    const zugesagt = zugesagterAusgang(text, "**Postgres**");
    const { dort, rueckfallSkript } = await inselMitUpdate();

    const dump = legeDumpAn(dort);
    const gefahren = fahreRueckfall(dort, ["--daten-zurueck", dump], rueckfallSkript);

    expect(gefahren.code, `ROLLBACK.md sagt Exit ${zugesagt} zu.\n${gefahren.ausgabe}`).toBe(
      zugesagt,
    );
    // Und die Sache selbst, nicht nur die Zahl: beide Orte nennen dieselbe Lage und denselben
    // nächsten Schritt.
    expect(gefahren.ergebnis).toContain("Produktivdatenbank");
    expect(text).toContain("pg_restore");
    expect(gefahren.ergebnis).toContain("pg_restore");
    expect(aktivesRelease(dort)).toBe(ALT);
  });

  it("V3 · Journal: dieselbe Prüfung, der andere Ausgang", async () => {
    const text = rollbackMd();
    const zugesagt = zugesagterAusgang(text, "**Journal**");
    const { dort, rueckfallSkript } = await inselMitUpdate();

    const journal = join(dort.daten, "state.jsonl");
    const stand = readFileSync(journal, "utf8");
    const sicherung = join(dort.backups, "hand.jsonl");
    schreibeDatei(sicherung, stand);

    const gefahren = fahreRueckfall(dort, ["--daten-zurueck", sicherung], rueckfallSkript);

    expect(gefahren.code, `ROLLBACK.md sagt Exit ${zugesagt} zu.\n${gefahren.ausgabe}`).toBe(
      zugesagt,
    );
    expect(readFileSync(journal, "utf8")).toBe(stand);
    expect(gefahren.ergebnis).not.toContain("Produktivdatenbank");
  });

  it("V4 · fehlende Pruefsumme: auch dieser Ausgang steht im Text und stimmt", async () => {
    const text = rollbackMd();
    const zugesagt = zugesagterAusgang(text, "Pruefsumme");
    const { dort, rueckfallSkript } = await inselMitUpdate();

    const dump = legeDumpAn(dort, false);
    const gefahren = fahreRueckfall(dort, ["--daten-zurueck", dump], rueckfallSkript);

    expect(gefahren.code, `ROLLBACK.md sagt Exit ${zugesagt} zu.\n${gefahren.ausgabe}`).toBe(
      zugesagt,
    );
    // Die Zusage des Textes ist hier eine über den laufenden Betrieb: „die laufende Fassung bleibt
    // dann unberuehrt". Abgelesen am Zeiger, nicht am Satz.
    expect(aktivesRelease(dort)).toBe(NEU);
    expect(existsSync(join(dort.wurzel, "drill-aufrufe.txt"))).toBe(false);
  });
});
