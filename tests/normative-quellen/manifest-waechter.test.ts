// ================================================================================================
// MANIFEST-WAECHTER UEBER DIE NORMATIVEN QUELLEN — R-1247, R-2002 (I53), R-1821 (B76), R-1825 (B72).
// ================================================================================================
//
// WAS ER PRUEFT. `docs/normative-quellen/manifest.json` fuehrt je normativer Quelle Zeilenzahl,
// Bytezahl und den vollen Datei-Hash. Der Waechter liest seine Pruefliste aus diesem Manifest und
// vergleicht jede Zeile bytegenau mit der Datei.
//
// WOGEGEN ER PRUEFT — die Grundmenge erhebt er SELBST, nicht aus dem Manifest. Das ist die Antwort
// auf das ROT-Urteil `sammel100` zum frueheren Waechter: „Er kann seine Vollstaendigkeit nicht aus
// sich selbst feststellen ... eine von Hand uebergebene Erwartungszahl ist funktional wieder eine
// Liste.“ Deshalb:
//
//   · Der normative Bereich ist hier unabhaengig vom Manifest festgelegt: die Einstiege `AGENTS.md`
//     und `CLAUDE.md`, jede Datei unter `harness/` und jede `.md`-Datei, auf die ein Einstieg
//     verweist. Faellt eine Manifestzeile weg, ist ihre Datei unklassifiziert und ROT.
//   · Beidseitig: eine Datei im Bereich ohne Manifestzeile ist ROT, eine Manifestzeile ausserhalb
//     des Bereichs ist ROT, eine fehlende Datei ist ROT.
//   · Die erwartete Zahl gepruefter Zeilen wird aus dem Bereich BERECHNET, nicht uebergeben.
//   · Es gibt keine Ausnahmezelle wie das fruehere „nicht erreichbar“.
//
// I53 IN HEUTIGER FORM. Damals bewachte das Manifest eine ueberholte Uebergabelage und kannte die
// geltenden Dokumente nicht. Heute verweist `CLAUDE.md` auf die geltenden Regeln. Bekommt ein
// Einstieg einen Verweis auf eine neue Regelquelle, ist sie ohne Manifestzeile ROT (Fall G6). Eine
// Zeile fuer eine Datei ausserhalb des Bereichs, etwa eine abgeloeste Lage, ist ebenfalls ROT (G7).
//
// BENANNTE GRENZE (R-1247, wortgleich aus der Quelle): „wer eine Datei aendert und ihre Werte im
// selben Zug nachtraegt, ist nicht von einer legitimen Aktualisierung zu unterscheiden — der
// Waechter prueft Widerspruchsfreiheit, nicht Berechtigung.“ Er erzwingt nur, dass jede Aenderung
// an einer normativen Quelle als Manifestzeile im selben Diff sichtbar wird.
//
// HASH-SEMANTIK (Fundament 2f, von `sammel100` bestaetigt): die Spalte nennt den vollen Datei-Hash,
// nicht einen Inhalts-Hash. Verwendet wird das Format von `git hash-object`, damit jeder Wert mit
// Bordmitteln nachrechenbar ist.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const REPO_WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST_PFAD = "docs/normative-quellen/manifest.json";

/** Die Einstiege. Sie selbst und jede `.md`-Datei, auf die sie verweisen, sind normativ. */
const EINSTIEGE: readonly string[] = ["AGENTS.md", "CLAUDE.md"];
/** Verzeichnisse, deren GESAMTER Inhalt normativ ist — auch Dateien, die niemand eingetragen hat. */
const VERZEICHNISSE: readonly string[] = ["harness"];
/** Vom Betriebssystem angelegte Dateien sind keine Quellen. */
const SYSTEMDATEIEN: ReadonlySet<string> = new Set([".DS_Store"]);

interface Eintrag {
  readonly pfad: string;
  readonly rolle: string;
  readonly zeilen: number;
  readonly bytes: number;
  readonly gitBlob: string;
}

interface ManifestDatei {
  readonly eintraege: Eintrag[];
}

type Tabelle = Map<string, Buffer>;

/** Zugriff auf den Bestand — einspeisbar, damit die Gegenproben keine Datei anlegen muessen. */
interface Bestand {
  lies(pfad: string): Buffer | undefined;
  liste(verzeichnis: string): string[];
}

const echterBestand: Bestand = {
  lies(pfad) {
    try {
      return readFileSync(join(REPO_WURZEL, pfad));
    } catch (fehler) {
      if ((fehler as NodeJS.ErrnoException).code === "ENOENT") {
        return undefined;
      }
      throw fehler;
    }
  },
  liste(verzeichnis) {
    const gefunden: string[] = [];
    const absteigen = (relativ: string) => {
      if (!existsSync(join(REPO_WURZEL, relativ))) {
        return;
      }
      for (const name of readdirSync(join(REPO_WURZEL, relativ))) {
        if (SYSTEMDATEIEN.has(name)) {
          continue;
        }
        const kind = posix.join(relativ, name);
        if (statSync(join(REPO_WURZEL, kind)).isDirectory()) {
          absteigen(kind);
        } else {
          gefunden.push(kind);
        }
      }
    };
    absteigen(verzeichnis);
    return gefunden.sort();
  },
};

/** Ein Bestand aus einer Tabelle, fuer die Gegenproben. */
function tabellenBestand(tabelle: Tabelle): Bestand {
  return {
    lies(pfad) {
      return tabelle.get(pfad);
    },
    liste(verzeichnis) {
      const praefix = `${verzeichnis}/`;
      return [...tabelle.keys()].filter((p) => p.startsWith(praefix)).sort();
    },
  };
}

function gitBlob(inhalt: Buffer): string {
  const kopf = Buffer.from(`blob ${inhalt.length}\0`, "utf8");
  return createHash("sha1").update(kopf).update(inhalt).digest("hex");
}

/** Wie `wc -l`: gezaehlt werden Zeilenumbrueche, nicht Zeilen. */
function zeilenzahl(inhalt: Buffer): number {
  let n = 0;
  for (const b of inhalt) {
    if (b === 0x0a) {
      n += 1;
    }
  }
  return n;
}

function mass(zeilen: number, bytes: number, blob: string): string {
  return `${zeilen} Z · ${bytes} B · ${blob}`;
}

/** Verweise auf `.md`-Dateien in Backticks, z. B. `harness/00-principles.md`. */
function verweise(text: string): string[] {
  return [...text.matchAll(/`\/?([A-Za-z0-9_./-]+\.md)`/g)].map((m) => m[1] as string);
}

interface Bereich {
  /** Pfad -> Grund, aus dem er zum Bereich gehoert. */
  dateien: Map<string, string>;
  fehler: string[];
}

/** Erhebt den normativen Bereich aus dem Bestand — ohne einen Blick ins Manifest. */
function erhebeBereich(bestand: Bestand): Bereich {
  const dateien = new Map<string, string>();
  const fehler: string[] = [];
  for (const verzeichnis of VERZEICHNISSE) {
    for (const pfad of bestand.liste(verzeichnis)) {
      dateien.set(pfad, `liegt unter ${verzeichnis}/`);
    }
  }
  for (const einstieg of EINSTIEGE) {
    const inhalt = bestand.lies(einstieg);
    if (inhalt === undefined) {
      fehler.push(`EINSTIEG FEHLT  ${einstieg}`);
      continue;
    }
    dateien.set(einstieg, "Einstieg");
    for (const ziel of verweise(inhalt.toString("utf8"))) {
      if (bestand.lies(ziel) === undefined) {
        fehler.push(`VERWEIS INS LEERE  ${einstieg} verweist auf ${ziel}, die Datei fehlt`);
      } else if (!dateien.has(ziel)) {
        dateien.set(ziel, `verwiesen von ${einstieg}`);
      }
    }
  }
  return { dateien, fehler };
}

function ganzzahl(n: unknown): boolean {
  return Number.isInteger(n) && (n as number) >= 0;
}

/** Die Form des Manifests — vor jedem Dateivergleich, sonst waere ein leeres Manifest gruen. */
function pruefeForm(eintraege: readonly Eintrag[]): string[] {
  const fehler: string[] = [];
  if (eintraege.length === 0) {
    fehler.push("MANIFEST LEER");
  }
  const gesehen = new Set<string>();
  for (const e of eintraege) {
    if (gesehen.has(e.pfad)) {
      fehler.push(`PFAD DOPPELT  ${e.pfad}`);
    }
    gesehen.add(e.pfad);
    if (isAbsolute(e.pfad) || e.pfad.split("/").includes("..")) {
      fehler.push(`PFAD NICHT REPOSITORY-RELATIV  ${e.pfad}`);
    }
    if (typeof e.rolle !== "string" || e.rolle.trim() === "") {
      fehler.push(`ROLLE FEHLT  ${e.pfad}`);
    }
    if (!ganzzahl(e.zeilen) || !ganzzahl(e.bytes)) {
      fehler.push(`MASS UNGUELTIG  ${e.pfad}`);
    }
    if (typeof e.gitBlob !== "string" || !/^[0-9a-f]{40}$/.test(e.gitBlob)) {
      fehler.push(`KEIN VOLLER DATEI-HASH  ${e.pfad}`);
    }
  }
  return fehler;
}

interface Ergebnis {
  geprueft: number;
  gehasht: number;
  abweichend: string[];
}

/** Der beidseitige Vergleich. `geprueft` ist die aus dem Bereich berechnete Zahl. */
function vergleiche(eintraege: readonly Eintrag[], bestand: Bestand): Ergebnis {
  const bereich = erhebeBereich(bestand);
  const abweichend = [...pruefeForm(eintraege), ...bereich.fehler];
  const imManifest = new Set(eintraege.map((e) => e.pfad));
  for (const [pfad, grund] of bereich.dateien) {
    if (!imManifest.has(pfad)) {
      abweichend.push(`UNKLASSIFIZIERT  ${pfad} (${grund}) hat keine Manifestzeile`);
    }
  }
  let gehasht = 0;
  for (const e of eintraege) {
    const inhalt = bestand.lies(e.pfad);
    if (inhalt === undefined) {
      abweichend.push(`FEHLT  ${e.pfad} steht im Manifest, die Datei gibt es nicht`);
      continue;
    }
    if (!bereich.dateien.has(e.pfad)) {
      abweichend.push(`AUSSERHALB DES NORMATIVEN BEREICHS  ${e.pfad}`);
      continue;
    }
    const soll = mass(e.zeilen, e.bytes, e.gitBlob);
    const ist = mass(zeilenzahl(inhalt), inhalt.length, gitBlob(inhalt));
    if (soll !== ist) {
      abweichend.push(`ABWEICHUNG  ${e.pfad}\n  Manifest: ${soll}\n  gemessen: ${ist}`);
      continue;
    }
    gehasht += 1;
  }
  return { geprueft: bereich.dateien.size, gehasht, abweichend };
}

function urteil(e: Ergebnis): string {
  const gruen = e.abweichend.length === 0 && e.gehasht === e.geprueft;
  const abweichend = e.abweichend.length;
  const zahlen = `geprueft ${e.geprueft} · gehasht ${e.gehasht} · abweichend ${abweichend}`;
  return `${zahlen} · URTEIL ${gruen ? "GRUEN" : "ROT"}`;
}

function liesManifest(): Eintrag[] {
  const text = readFileSync(join(REPO_WURZEL, MANIFEST_PFAD), "utf8");
  return (JSON.parse(text) as ManifestDatei).eintraege;
}

/** Der echte Bestand als Tabelle — Grundlage jeder Gegenprobe. */
function heileTabelle(): Tabelle {
  const tabelle: Tabelle = new Map();
  for (const pfad of erhebeBereich(echterBestand).dateien.keys()) {
    const inhalt = echterBestand.lies(pfad);
    if (inhalt === undefined) {
      throw new Error(`Kalibrierung unmoeglich: ${pfad} fehlt.`);
    }
    tabelle.set(pfad, inhalt);
  }
  return tabelle;
}

function mitText(tabelle: Tabelle, pfad: string, text: string): Tabelle {
  const kopie: Tabelle = new Map(tabelle);
  kopie.set(pfad, Buffer.from(text, "utf8"));
  return kopie;
}

function textVon(tabelle: Tabelle, pfad: string): string {
  return tabelle.get(pfad)?.toString("utf8") ?? "";
}

function befund(tabelle: Tabelle, eintraege: readonly Eintrag[] = liesManifest()): string {
  return vergleiche(eintraege, tabellenBestand(tabelle)).abweichend.join("\n");
}

describe("Normative Quellen · 1 · der echte Bestand", () => {
  it("jede normative Quelle stimmt bytegenau mit ihrer Manifestzeile ueberein", () => {
    const ergebnis = vergleiche(liesManifest(), echterBestand);
    expect(ergebnis.abweichend.join("\n")).toBe("");
    // Die erwartete Zahl ist berechnet: so viele Dateien, wie der Bereich selbst ergibt.
    const n = ergebnis.geprueft;
    expect(urteil(ergebnis)).toBe(`geprueft ${n} · gehasht ${n} · abweichend 0 · URTEIL GRUEN`);
  });

  it("der Bereich enthaelt die Einstiege und die von CLAUDE.md verwiesenen Regeln", () => {
    const { dateien, fehler } = erhebeBereich(echterBestand);
    expect(fehler).toEqual([]);
    const pflicht = [
      "AGENTS.md",
      "CLAUDE.md",
      "harness/00-principles.md",
      "harness/40-testing-strategy.md",
      "harness/80-definition-of-done.md",
    ];
    for (const pfad of pflicht) {
      expect(dateien.has(pfad), pfad).toBe(true);
    }
  });

  it("die Masse entsprechen wc -l, wc -c und git hash-object", () => {
    // `printf 'hello\n' | git hash-object --stdin` ergibt diesen Wert.
    const hallo = gitBlob(Buffer.from("hello\n", "utf8"));
    expect(hallo).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    expect(zeilenzahl(Buffer.from("a\nb", "utf8"))).toBe(1);
    expect(Buffer.from("ä", "utf8").length).toBe(2);
  });
});

describe("Normative Quellen · 2 · Gegenproben", () => {
  it("KALIBRIERUNG · die heile Tabelle ist gruen — sonst pruefen G1 bis G10 nichts", () => {
    expect(befund(heileTabelle())).toBe("");
  });

  it("G1 · eine geaenderte Regel wird rot, mit Manifestwert und Messwert", () => {
    const tabelle = heileTabelle();
    const neu = `${textVon(tabelle, "CLAUDE.md")}Neu.\n`;
    const text = befund(mitText(tabelle, "CLAUDE.md", neu));
    expect(text).toContain("ABWEICHUNG  CLAUDE.md");
    expect(text).toContain("Manifest: 36 Z");
    expect(text).toContain("gemessen: 37 Z");
  });

  it("G2 · gleiche Laenge, anderer Inhalt wird allein am Hash rot", () => {
    const tabelle = heileTabelle();
    const alt = textVon(tabelle, "harness/00-principles.md");
    const neu = alt.replace("a", "b");
    expect(neu).not.toBe(alt);
    expect(Buffer.from(neu).length).toBe(Buffer.from(alt).length);
    const text = befund(mitText(tabelle, "harness/00-principles.md", neu));
    expect(text).toContain("ABWEICHUNG  harness/00-principles.md");
  });

  it("G3 · eine neue Datei unter harness/ ohne Manifestzeile ist unklassifiziert und rot", () => {
    const tabelle = mitText(heileTabelle(), "harness/50-neue-regel.md", "# Neu\n");
    const ergebnis = vergleiche(liesManifest(), tabellenBestand(tabelle));
    const text = ergebnis.abweichend.join("\n");
    expect(text).toContain("UNKLASSIFIZIERT  harness/50-neue-regel.md");
    expect(urteil(ergebnis)).toContain("URTEIL ROT");
  });

  it("G4 · eine gestrichene Manifestzeile macht ihre Datei unklassifiziert, nicht still gruen", () => {
    const manifest = liesManifest();
    const letzte = manifest[manifest.length - 1]!;
    const ergebnis = vergleiche(manifest.slice(0, -1), tabellenBestand(heileTabelle()));
    expect(ergebnis.abweichend.join("\n")).toContain(`UNKLASSIFIZIERT  ${letzte.pfad}`);
    // Die Zahl kommt aus dem Bereich: sie sinkt NICHT mit dem Manifest.
    expect(ergebnis.geprueft).toBe(manifest.length);
    expect(urteil(ergebnis)).toContain("URTEIL ROT");
  });

  it("G5 · eine geloeschte normative Datei wird rot", () => {
    const tabelle = heileTabelle();
    tabelle.delete("harness/80-definition-of-done.md");
    expect(befund(tabelle)).toContain("FEHLT  harness/80-definition-of-done.md");
  });

  it("G6 · I53: ein Einstieg verweist auf eine NEUE geltende Regelquelle, ohne Zeile rot", () => {
    const heil = heileTabelle();
    const verweis = `${textVon(heil, "CLAUDE.md")}Siehe \`docs/uebergabe-neu.md\`.\n`;
    const mitVerweis = mitText(heil, "CLAUDE.md", verweis);
    const tabelle = mitText(mitVerweis, "docs/uebergabe-neu.md", "# Geltend\n");
    expect(befund(tabelle)).toContain(
      "UNKLASSIFIZIERT  docs/uebergabe-neu.md (verwiesen von CLAUDE.md)",
    );
  });

  it("G7 · I53: eine Manifestzeile fuer eine Datei ausserhalb des Bereichs ist rot", () => {
    const tabelle = mitText(heileTabelle(), "docs/uebergabe-alt.md", "# Ueberholt\n");
    const inhalt = tabelle.get("docs/uebergabe-alt.md")!;
    const alteLage: Eintrag = {
      pfad: "docs/uebergabe-alt.md",
      rolle: "ueberholte Lage",
      zeilen: zeilenzahl(inhalt),
      bytes: inhalt.length,
      gitBlob: gitBlob(inhalt),
    };
    const text = befund(tabelle, [...liesManifest(), alteLage]);
    expect(text).toContain("AUSSERHALB DES NORMATIVEN BEREICHS  docs/uebergabe-alt.md");
  });

  it("G8 · ein leeres Manifest ist rot", () => {
    const ergebnis = vergleiche([], tabellenBestand(heileTabelle()));
    expect(ergebnis.abweichend).toContain("MANIFEST LEER");
    expect(urteil(ergebnis)).toContain("URTEIL ROT");
  });

  it("G9 · ein fehlender Einstieg ist rot", () => {
    const tabelle = heileTabelle();
    tabelle.delete("AGENTS.md");
    expect(befund(tabelle)).toContain("EINSTIEG FEHLT  AGENTS.md");
  });

  it("G10 · ein Verweis eines Einstiegs ins Leere ist rot", () => {
    const tabelle = heileTabelle();
    const verweis = `${textVon(tabelle, "AGENTS.md")}\`harness/fehlt.md\`\n`;
    expect(befund(mitText(tabelle, "AGENTS.md", verweis))).toContain(
      "VERWEIS INS LEERE  AGENTS.md verweist auf harness/fehlt.md",
    );
  });
});

describe("Normative Quellen · 3 · die Form des Manifests", () => {
  it("doppelter Pfad, fremder Pfad und gekuerzter Hash fallen auf", () => {
    const erster = liesManifest()[0]!;
    const fremd = pruefeForm([{ ...erster, pfad: "../AGENTS.md" }]).join("\n");
    const kurz = pruefeForm([{ ...erster, gitBlob: erster.gitBlob.slice(0, 16) }]).join("\n");
    expect(pruefeForm([erster, erster])).toContain(`PFAD DOPPELT  ${erster.pfad}`);
    expect(fremd).toContain("NICHT REPOSITORY-RELATIV");
    expect(kurz).toContain("KEIN VOLLER DATEI-HASH");
  });

  it("der Waechter laeuft im Testlauf des Tors mit (tests/**)", () => {
    const vitest = readFileSync(join(REPO_WURZEL, "vitest.config.ts"), "utf8");
    expect(vitest).toContain('"tests/**/*.test.{ts,tsx}"');
    expect(fileURLToPath(import.meta.url).startsWith(join(REPO_WURZEL, "tests"))).toBe(true);
  });
});
