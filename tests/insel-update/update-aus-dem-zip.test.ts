// ================================================================================================
// JOB 4127 — DAS ZIP IST DER ECHTE BETRIEBSWEG, UND ER WIRD HIER ZUM ERSTEN MAL BIS AN SEINE
// RÄNDER GEFAHREN.
// ================================================================================================
//
// WARUM DIESE DATEI: Der Betreiber der Insel bekommt seine Aktualisierung als `.zip` — etwas anderes
// kann er gar nicht bekommen (`docs/operations/UEBERGABE-KLARWERK-Insel.md` §1: „man kann nicht
// direkt auf den Mac Studio schreiben", deshalb wird alles gezippt), und genau diesen Aufruf nennt
// `docs/operations/maintenance-update-process.md` §6.1 als DEN Betriebsbefehl. Gemessen war davon
// bisher nur der gute Fall (`update-mit-netz.test.ts` U2). Die RÄNDER dieses Weges — und jeder
// Betriebsweg besteht aus seinen Rändern — waren nie gefahren:
//
//   Z2  Ein beschädigtes Zip riss den Weg an `unzip` unter `set -e` mit: kein Grund, keine
//       Ergebniszeile, nur der rohe Exitcode von `unzip`. Dieselbe Lehre wie „START" im Kopf des
//       Skriptes (`update-einspielen.sh:55`), nur für das Auspacken nie gezogen.
//   Z4  Lagen zwei Releaseordner im Paket, nahm die Schleife wortlos den ERSTEN — welches Release
//       auf der Insel landet, entschied die Sortierreihenfolge eines Globs.
//   Z5  Fehlte der Vertrag ganz, nannte die Abbruchmeldung einen Pfad unter
//       `/tmp/klarwerk-update-…`, den der Aufräum-Trap im selben Augenblick löschte.
//
// WAS HIER ATTRAPPE IST: nichts auf dem Update-Weg. Gepackt wird mit dem echten `zip` bzw. `ditto`
// des Prüfstandes, ausgepackt vom echten `unzip` im echten Skript. Fehlt eines der Werkzeuge, wird
// der Fall ÜBERSPRUNGEN mit Grund auf stderr — ein stiller Skip sähe aus wie ein bestandener Lauf.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  type Lauf,
  UPDATE_SH,
  aktivesRelease,
  fahreSkript,
  fahreUpdate,
  fremdbinaerAttrappe,
  gesundheit,
  legeInselAn,
  legeJournalAn,
  packeZip,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
} from "./insel-probe";

const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";
const ZWEIT = "klarwerk-insel-zweiter";
/**
 * Ein VERSTECKTER Kandidat — der Fall, den Runde 1 durchliess (BEN, Runde 1): `"$AUSPACK"/*`
 * übergeht Punkteinträge, also zählte die Mehrdeutigkeitsprüfung ihn nicht mit, und der Weg spielte
 * den sichtbaren Ordner ein mit dem Satz „der einzige mit SCHEMA-VERTRAG" — der nachweislich falsch
 * war. Ein Paket wird gepackt, übertragen und ausgepackt; was dabei an versteckten Einträgen
 * mitkommt, bestimmt nicht der Betreiber.
 */
const VERSTECKT = ".klarwerk-insel-versteckt";

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Der Ausgangszustand jedes Falles: eine laufende Vorversion 1.0.0 und ein Journal mit Daten. */
async function inselMitVorversion(): Promise<Insel> {
  const neue = await legeInselAn();
  schreibeRelease(neue.releases, { name: ALT, appVersion: "1.0.0" });
  setzeCurrent(neue, ALT);
  legeJournalAn(neue);
  return neue;
}

/** Ein leeres Verzeichnis, dessen INHALT gleich in ein Zip wandert. */
function halde(insel: Insel, fall: string): string {
  const ordner = join(insel.wurzel, `bau-${fall}`);
  mkdirSync(ordner, { recursive: true });
  return ordner;
}

/** `unzip` braucht das SKRIPT: ohne es bricht es schon an `command -v unzip` ab (Exit 1, :184). */
function unzipDa(): boolean {
  return spawnSync("bash", ["-c", "command -v unzip"], { encoding: "utf8" }).status === 0;
}

function ueberspringe(ctx: { skip: () => void }, fall: string, grund: string): void {
  process.stderr.write(`[KLARWERK] JOB 4127 ${fall} ÜBERSPRUNGEN: ${grund}.\n`);
  ctx.skip();
}

/**
 * Das Paket für einen Fall — oder `undefined`, wenn dieser Prüfstand den Zip-Weg nicht messen kann.
 * In dem Fall steht der Grund schon auf stderr und der Aufrufer kehrt zurück.
 */
function paketOderSkip(
  ctx: { skip: () => void },
  fall: string,
  inhalt: string,
  ziel: string,
): string | undefined {
  if (!unzipDa()) {
    ueberspringe(ctx, fall, "unzip fehlt — das Skript kann hier kein Paket öffnen");
    return undefined;
  }
  const paket = packeZip(inhalt, ziel);
  if (paket === undefined) {
    ueberspringe(ctx, fall, "weder zip noch ditto vorhanden — hier entsteht kein echtes Paket");
  }
  return paket;
}

/** Alle Einträge unter einem Ordner, ohne Symlinks zu folgen. */
function bestandUnter(ordner: string): { dateien: string[]; symlinks: string[] } {
  const dateien: string[] = [];
  const symlinks: string[] = [];
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isSymbolicLink()) {
      symlinks.push(pfad);
    } else if (eintrag.isDirectory()) {
      const tiefer = bestandUnter(pfad);
      dateien.push(...tiefer.dateien);
      symlinks.push(...tiefer.symlinks);
    } else {
      dateien.push(pfad);
    }
  }
  return { dateien, symlinks };
}

/**
 * Jede Zeile, die dem Menschen einen Ausgang MELDET — `Update auf … aktiv` oder
 * `Update abgebrochen, …`. Es muss genau eine davon geben: zwei wären zwei Wahrheiten über
 * dieselbe Installation, und die letzte Zeile allein zu lesen verdeckt das (BEN, Runde 1, Prüflücke).
 */
function ergebniszeilen(lauf: Lauf): string[] {
  return lauf.ausgabe.split("\n").filter((zeile) => /^Update (auf|abgebrochen)/.test(zeile));
}

/**
 * Eine Attrappe für das FREMDBINARY `unzip` — und nur für das.
 *
 * WARUM SIE HIER SEIN DARF, obwohl auf dem Update-Weg sonst kein PATH-Stub liegt: `unzip` gehört
 * nicht zu Klarwerk, und auf dem Cloud-Prüfstand gibt es es nicht (gemessen: Arbeitsprüfung
 * 28b1382c, alle Zip-Fälle übersprungen). Das ist genau die Lage, für die `insel-probe.ts` den
 * Begriff FREMD führt und `launchctl`, `date` und `pg_dump` ersetzt. BEN hat in Runde 1 mit
 * demselben Griff gemessen.
 *
 * WAS SIE MISST UND WAS NICHT: gemessen wird, was das Skript mit dem AUSGEPACKTEN Inhalt tut —
 * Kandidatenwahl, Mehrdeutigkeit, Vertragssuche — und wie es auf ein gescheitertes Auspacken
 * reagiert. NICHT gemessen wird das Auspacken selbst; dafür stehen Z1–Z6 mit echtem Zip, die dort
 * laufen, wo `unzip` liegt (Mac Studio, Tor, Arbeits-Mac).
 */
function unzipAttrappe(insel: Insel, wunsch: { vorlage?: string; fehler?: number }): string {
  const tat =
    wunsch.fehler === undefined
      ? `cp -R ${JSON.stringify(`${wunsch.vorlage}/.`)} "$ZIEL"/`
      : `echo "unzip-Attrappe:  End-of-central-directory signature not found." >&2
exit ${wunsch.fehler}`;
  return fremdbinaerAttrappe(insel, {
    unzip: `#!/usr/bin/env bash
ZIEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    -d) ZIEL="\${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done
${tat}
`,
  });
}

/** Dasselbe Skript, nur mit der `unzip`-Attrappe vor dem übrigen Pfad. */
function fahreUpdateMitAttrappe(insel: Insel, quelle: string, pfad: string): Lauf {
  return fahreSkript(insel, UPDATE_SH, [quelle], { PATH: `${pfad}:${process.env.PATH ?? ""}` });
}

/**
 * Eine Datei mit der Endung `.zip` — ihr INHALT ist in den Attrappenfällen ohne Bedeutung, weil an
 * der Stelle, die ihn läse, die Attrappe steht. Das Skript prüft nur, dass die Quelle existiert.
 */
function platzhalterPaket(insel: Insel): string {
  const pfad = join(insel.wurzel, "paket.zip");
  writeFileSync(pfad, "Platzhalter — die unzip-Attrappe liest diese Datei nicht.\n");
  return pfad;
}

describe("JOB 4127 · der Zip-Weg, bis zum Ende gefahren", () => {
  it("Z1 · ein gültiges Zip führt zu demselben Ergebnis wie derselbe Inhalt als Ordner", async (ctx) => {
    insel = await inselMitVorversion();
    const journal = join(insel.daten, "state.jsonl");
    const release = schreibeRelease(halde(insel, "z1"), { name: NEU, appVersion: "1.1.0" });
    // Das Release liegt im WURZELVERZEICHNIS des Zips.
    const paket = paketOderSkip(ctx, "Z1", release, join(insel.wurzel, "paket.zip"));
    if (paket === undefined) {
      return;
    }

    const lauf = fahreUpdate(insel, paket);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    // GENAU EINE Ergebniszeile — nicht bloss „die letzte passt". Zwei wären zwei Aussagen über
    // dieselbe Installation, und der Mensch wüsste nicht, welche gilt.
    expect(ergebniszeilen(lauf), "es darf genau eine Ergebniszeile geben").toHaveLength(1);
    const treffer = /^Update auf 1\.1\.0 aktiv, Sicherung (.+)$/.exec(lauf.ergebnis);
    expect(treffer, `Ergebniszeile war: ${lauf.ergebnis}`).not.toBeNull();

    const sicherung = treffer?.[1] ?? "";
    expect(existsSync(sicherung)).toBe(true);
    expect(readFileSync(sicherung, "utf8")).toBe(readFileSync(journal, "utf8"));
    expect(existsSync(`${sicherung}.sha256`)).toBe(true);

    expect(aktivesRelease(insel)).toBe(NEU);
    expect(existsSync(join(insel.releases, NEU, "SCHEMA-VERTRAG"))).toBe(true);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });

  it("Z3 · liegt das Release in einem Unterordner, sagt der Weg, welchen er nimmt", async (ctx) => {
    insel = await inselMitVorversion();
    const bau = halde(insel, "z3");
    schreibeRelease(bau, { name: NEU, appVersion: "1.1.0" });
    // Der Inhalt des Zips ist EIN Ordner `klarwerk-insel-neu/` mit dem Release darin.
    const paket = paketOderSkip(ctx, "Z3", bau, join(insel.wurzel, "paket.zip"));
    if (paket === undefined) {
      return;
    }

    const lauf = fahreUpdate(insel, paket);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(
      lauf.ausgabe,
      "eine Wahl aus dem Paket, die nicht ausgesprochen wird, kann niemand nachprüfen",
    ).toContain(`Paketordner gewählt: ${NEU}`);
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });

  it("Z6 · nach dem gelungenen Lauf ist das Auspackverzeichnis weg und das Release vollständig", async (ctx) => {
    insel = await inselMitVorversion();
    // Ein EIGENES `TMPDIR`: nur so lässt sich nachsehen, ob das Auspackverzeichnis wirklich weg ist.
    const eigenesTmp = join(insel.wurzel, "tmp");
    mkdirSync(eigenesTmp, { recursive: true });
    const release = schreibeRelease(halde(insel, "z6"), { name: NEU, appVersion: "1.1.0" });
    const paket = paketOderSkip(ctx, "Z6", release, join(insel.wurzel, "paket.zip"));
    if (paket === undefined) {
      return;
    }

    const lauf = fahreSkript(insel, UPDATE_SH, [paket], { TMPDIR: eigenesTmp });

    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(
      readdirSync(eigenesTmp).filter((name) => name.startsWith("klarwerk-update-")),
      "das Auspackverzeichnis ist liegen geblieben",
    ).toEqual([]);

    // Gemessen am BESTAND nach dem vollständigen Vorgang, nicht an einer Ausgabezeile: das Release
    // steht wirklich unter `releases/` und zeigt nicht auf das gelöschte Auspackverzeichnis.
    const ziel = join(insel.releases, NEU);
    const bestand = bestandUnter(ziel);
    expect(bestand.symlinks, "ein Release aus Symlinks überlebt das Aufräumen nicht").toEqual([]);
    for (const datei of ["SCHEMA-VERTRAG", "package.json", "BUILD_INFO", "server.mjs"]) {
      expect(bestand.dateien, `${datei} fehlt im eingespielten Release`).toContain(
        join(ziel, datei),
      );
    }
    expect(readFileSync(join(ziel, "SCHEMA-VERTRAG"), "utf8")).toBe(
      readFileSync(join(release, "SCHEMA-VERTRAG"), "utf8"),
    );
    // Der stärkste Beleg: der laufende Server liest aus `releases/` und antwortet noch immer.
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });
});

describe("JOB 4127 · die Ränder: jeder Ausgang nennt seinen Grund und lässt current stehen", () => {
  it("Z2 · eine Datei mit der Endung .zip, die kein Zip ist: Exit 1 mit Ergebniszeile", async (ctx) => {
    if (!unzipDa()) {
      ueberspringe(ctx, "Z2", "unzip fehlt — das Skript bricht schon an `command -v unzip` ab");
      return;
    }
    insel = await inselMitVorversion();
    const paket = join(insel.wurzel, "kaputt.zip");
    writeFileSync(paket, randomBytes(4096));

    const lauf = fahreUpdate(insel, paket);

    expect(lauf.code, lauf.ausgabe).toBe(1);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: paket");
    expect(lauf.ausgabe, "die Meldung muss das übergebene Paket benennen").toContain(paket);
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(
      existsSync(join(insel.releases, NEU)),
      "ein abgebrochenes Update darf nichts unter releases/ angelegt haben",
    ).toBe(false);
  });

  it("Z4 · zwei Ordner mit SCHEMA-VERTRAG: Abbruch mit beiden Namen, nichts angefasst", async (ctx) => {
    insel = await inselMitVorversion();
    const bau = halde(insel, "z4");
    schreibeRelease(bau, { name: NEU, appVersion: "1.1.0" });
    schreibeRelease(bau, { name: ZWEIT, appVersion: "1.2.0" });
    const paket = paketOderSkip(ctx, "Z4", bau, join(insel.wurzel, "paket.zip"));
    if (paket === undefined) {
      return;
    }

    const lauf = fahreUpdate(insel, paket);

    expect(lauf.code, lauf.ausgabe).toBe(1);
    expect(lauf.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: mehrdeutig",
    );
    expect(lauf.ausgabe, "beide Kandidaten müssen genannt werden").toContain(NEU);
    expect(lauf.ausgabe).toContain(ZWEIT);
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(existsSync(join(insel.releases, NEU))).toBe(false);
    expect(existsSync(join(insel.releases, ZWEIT))).toBe(false);
  });

  it("Z4b · ein SICHTBARER und ein VERSTECKTER Kandidat — im echten Zip (BEN Runde 1)", async (ctx) => {
    insel = await inselMitVorversion();
    const bau = halde(insel, "z4b");
    schreibeRelease(bau, { name: NEU, appVersion: "1.1.0" });
    schreibeRelease(bau, { name: VERSTECKT, appVersion: "1.2.0" });
    const paket = paketOderSkip(ctx, "Z4b", bau, join(insel.wurzel, "paket.zip"));
    if (paket === undefined) {
      return;
    }

    const lauf = fahreUpdate(insel, paket);

    expect(lauf.code, lauf.ausgabe).toBe(1);
    expect(lauf.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: mehrdeutig",
    );
    expect(lauf.ausgabe, "der sichtbare Kandidat muss genannt werden").toContain(NEU);
    expect(lauf.ausgabe, "der versteckte Kandidat muss genannt werden").toContain(VERSTECKT);
    expect(
      lauf.ausgabe,
      "„der einzige mit SCHEMA-VERTRAG“ war in genau diesem Fall nachweislich falsch",
    ).not.toContain("der einzige mit SCHEMA-VERTRAG");
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(existsSync(join(insel.releases, NEU))).toBe(false);
    expect(existsSync(join(insel.releases, VERSTECKT))).toBe(false);
    expect(
      existsSync(insel.backups),
      "ein Abbruch vor Glied 1 darf keine Sicherung angelegt haben",
    ).toBe(false);
  });

  it("Z5b · ein Paket ohne SCHEMA-VERTRAG nennt das Zip — auch ohne `unzip` messbar", async () => {
    insel = await inselMitVorversion();
    const vorlage = halde(insel, "z5b");
    mkdirSync(join(vorlage, "fremdpaket"), { recursive: true });
    writeFileSync(join(vorlage, "fremdpaket", "BUILD_INFO"), "version=fremd\n");
    const paket = platzhalterPaket(insel);

    const lauf = fahreUpdateMitAttrappe(insel, paket, unzipAttrappe(insel, { vorlage }));

    expect(lauf.code, lauf.ausgabe).toBe(5);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: vertrag");
    expect(lauf.ausgabe).toContain(paket);
    expect(lauf.ausgabe).not.toContain("klarwerk-update-");
    expect(ergebniszeilen(lauf)).toHaveLength(1);
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("Z5 · ein Paket ohne SCHEMA-VERTRAG nennt das Zip, nicht das gelöschte Auspackverzeichnis", async (ctx) => {
    insel = await inselMitVorversion();
    const bau = halde(insel, "z5");
    const fremd = join(bau, "fremdpaket");
    mkdirSync(fremd, { recursive: true });
    writeFileSync(join(fremd, "BUILD_INFO"), "version=fremd\n");
    const paket = paketOderSkip(ctx, "Z5", bau, join(insel.wurzel, "paket.zip"));
    if (paket === undefined) {
      return;
    }

    const lauf = fahreUpdate(insel, paket);

    expect(lauf.code, lauf.ausgabe).toBe(5);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: vertrag");
    expect(lauf.ausgabe, "die Meldung muss das Paket benennen").toContain(paket);
    expect(
      lauf.ausgabe,
      "ein Pfad, den der Trap beim Beenden löscht, hilft niemandem beim Nachsehen",
    ).not.toContain("klarwerk-update-");
    expect(aktivesRelease(insel)).toBe(ALT);
  });
});

// ================================================================================================
// OHNE `unzip` AUF DEM PRÜFSTAND — die Vertragswahl bleibt trotzdem gemessen.
// ================================================================================================
//
// Der Cloud-Prüfstand hat kein `unzip` (Arbeitsprüfung 28b1382c: alle sechs Fälle oben übersprungen).
// Ein übersprungener Fall ist kein Ausführungsbeleg — und genau in dieser Lücke blieb der Fehler aus
// Runde 1 unbemerkt, bis BEN ihn von Hand nachstellte. Diese vier Fälle ersetzen NUR das
// Fremdbinary `unzip` (siehe `unzipAttrappe`) und messen danach den echten Weg Zeile für Zeile.
describe("JOB 4127 · dieselben Ränder, gemessen ohne `unzip` auf dem Prüfstand", () => {
  it("Z7 · sichtbarer UND versteckter Kandidat: Abbruch mit beiden Namen (BEN Runde 1)", async () => {
    insel = await inselMitVorversion();
    const vorlage = halde(insel, "z7");
    schreibeRelease(vorlage, { name: NEU, appVersion: "1.1.0" });
    schreibeRelease(vorlage, { name: VERSTECKT, appVersion: "1.2.0" });
    const paket = platzhalterPaket(insel);

    const lauf = fahreUpdateMitAttrappe(insel, paket, unzipAttrappe(insel, { vorlage }));

    expect(lauf.code, lauf.ausgabe).toBe(1);
    expect(lauf.ergebnis).toBe(
      "Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: mehrdeutig",
    );
    expect(lauf.ausgabe, "der sichtbare Kandidat muss genannt werden").toContain(NEU);
    expect(lauf.ausgabe, "der versteckte Kandidat muss genannt werden").toContain(VERSTECKT);
    expect(
      lauf.ausgabe,
      "„der einzige mit SCHEMA-VERTRAG“ war in genau diesem Fall nachweislich falsch",
    ).not.toContain("der einzige mit SCHEMA-VERTRAG");
    expect(ergebniszeilen(lauf)).toHaveLength(1);
    // Der Bestand, nicht der Satz: nichts umgeschaltet, nichts angelegt, nichts gesichert.
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(existsSync(join(insel.releases, NEU))).toBe(false);
    expect(existsSync(join(insel.releases, VERSTECKT))).toBe(false);
    expect(
      existsSync(insel.backups),
      "ein Abbruch vor Glied 1 darf keine Sicherung angelegt haben",
    ).toBe(false);
    expect((await gesundheit(insel))?.version ?? "keine Antwort").not.toBe("1.2.0");
  });

  it("Z8 · das Auspacken scheitert: Grund „paket“, Exit 1, current unverändert", async () => {
    insel = await inselMitVorversion();
    const paket = platzhalterPaket(insel);

    const lauf = fahreUpdateMitAttrappe(insel, paket, unzipAttrappe(insel, { fehler: 9 }));

    expect(lauf.code, lauf.ausgabe).toBe(1);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: paket");
    expect(lauf.ausgabe, "die Meldung muss das übergebene Paket benennen").toContain(paket);
    expect(ergebniszeilen(lauf)).toHaveLength(1);
    expect(aktivesRelease(insel)).toBe(ALT);
    expect(existsSync(insel.backups)).toBe(false);
  });

  it("Z9 · genau ein Kandidat: die Wahl wird gesagt UND dieser Ordner läuft danach", async () => {
    insel = await inselMitVorversion();
    const vorlage = halde(insel, "z9");
    schreibeRelease(vorlage, { name: NEU, appVersion: "1.1.0" });
    const paket = platzhalterPaket(insel);

    const lauf = fahreUpdateMitAttrappe(insel, paket, unzipAttrappe(insel, { vorlage }));

    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain(`Paketordner gewählt: ${NEU}`);
    expect(ergebniszeilen(lauf)).toHaveLength(1);
    expect(aktivesRelease(insel)).toBe(NEU);
    // Der gewählte Ordner ist auch der eingespielte — nicht nur der genannte.
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });

  it("Z10 · ein versteckter Kandidat ALLEIN wird gewählt und genannt, nicht übergangen", async () => {
    insel = await inselMitVorversion();
    const vorlage = halde(insel, "z10");
    schreibeRelease(vorlage, { name: VERSTECKT, appVersion: "1.2.0" });
    const paket = platzhalterPaket(insel);

    const lauf = fahreUpdateMitAttrappe(insel, paket, unzipAttrappe(insel, { vorlage }));

    // Die Kehrseite von Z7: wer versteckte Einträge mitzählt, muss sie auch finden, wenn sie der
    // einzige Inhalt sind — sonst stünde hier „trägt keinen SCHEMA-VERTRAG" (Exit 5) über einem
    // Paket, das eines trägt.
    expect(lauf.code, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain(`Paketordner gewählt: ${VERSTECKT}`);
    expect(aktivesRelease(insel)).toBe(VERSTECKT);
    expect((await gesundheit(insel))?.version).toBe("1.2.0");
  });
});
