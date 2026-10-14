// ================================================================================================
// AUFNAHME 20260922 · GESAMT-JOB-STAMMBLATT — EIN BLATT JE AUFTRAG, WACHE GEGEN DOPPELVERGABE.
// ================================================================================================
//
// Prüft `tools/job-stammblatt.ts` an nachgebauten Auftragsordnern im Aufbau des heutigen Wegs
// (`AUFTRAG.json`, `AUFTRAG-B1.json`, `auftragsstand.json`, `HISTORIE/nacharbeit-<n>/`,
// `BEN/ANTWORT.json`) und an einem Gitverlauf im Format `%H<TAB>%s`:
//   · S   R-1492: Gegenstand, Welle/Scheibe, Durchgänge mit Urteilen, Integrations-Commit;
//   · U   das Benurteil wird nur eindeutig gelesen, nie geraten;
//   · I   Integration nur bei vollständigem Titel, kein Präfixtreffer;
//   · D   R-1393: Doppelvergaben von Auftrags-ID, Kennung, Branch und Commit-Titel;
//   · P   der Direktaufruf liefert große Ausgaben über eine Pipe vollständig (Nacharbeit 1);
//   · G   der Gitstand ist gebunden: Vorgabe HEAD, gebundener Commit in der Ausgabe (Nacharbeit 3);
//   · B   der Bestandsabgleich nennt beide Kriterien und nur vorhandene Dateien.
//
// WAS DIESE DATEI NICHT BELEGT: die echten Ordner der Produktionskoordination und deren Vergabe
// von Kennungen. Beide liegen außerhalb des Produktbaums.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  STANDARD_REF,
  alsText,
  auftragsordnerUnter,
  benurteilAus,
  doppelvergaben,
  gitStandVon,
  integrationAus,
  stammblattVon,
} from "../../tools/job-stammblatt";

const wurzel = mkdtempSync(join(tmpdir(), "job-stammblatt-"));
afterAll(() => rmSync(wurzel, { recursive: true, force: true }));

function lege(pfad: string, inhalt: unknown): void {
  const voll = join(wurzel, pfad);
  mkdirSync(dirname(voll), { recursive: true });
  writeFileSync(voll, typeof inhalt === "string" ? inhalt : JSON.stringify(inhalt));
}

const KANDIDAT = "c".repeat(40);

// Ordner A: vollständig, drei archivierte Durchgänge und ein laufender.
lege("auftrag-aaa/AUFTRAG.json", {
  kennung: "auftrag-aaa",
  title: "Titel A",
  base: "b".repeat(40),
  branch: "codex/auftrag-aaa",
  commit_title: "Titel A",
});
lege("auftrag-aaa/AUFTRAG-B1.json", {
  id: "aufnahme:test:a",
  revision: 2,
  title: "Titel A",
  status: "offen",
  milestones: ["Welle 3"],
  priority: 1,
});
lege("auftrag-aaa/auftragsstand.json", {
  schema: 1,
  auftrag: { id: "aufnahme:test:a", branch: "codex/auftrag-aaa" },
  fortschritt: {
    schritt: "ben",
    kandidat: KANDIDAT,
    naechster_schritt: "auslieferung",
    lieferung: null,
  },
});
lege("auftrag-aaa/HISTORIE/nacharbeit-1/BEN/ANTWORT.json", { urteil: "nacharbeit", befunde: [] });
lege("auftrag-aaa/HISTORIE/nacharbeit-1/PRUEFUNG/PRUEFUNG.json", {});
lege("auftrag-aaa/HISTORIE/nacharbeit-10/BEN/ANTWORT.json", { a: "erfuellt", b: "offen" });
lege("auftrag-aaa/HISTORIE/nacharbeit-2/PRUEFUNG/PRUEFUNG.json", {});
lege("auftrag-aaa/HISTORIE/nacharbeit-x/BEN/ANTWORT.json", { urteil: "erfuellt" });
lege("auftrag-aaa/BEN/ANTWORT.json", { ergebnis: "erfuellt" });

// Ordner B: dieselbe Auftrags-ID unter eigener Kennung.
lege("auftrag-bbb/AUFTRAG.json", {
  kennung: "auftrag-bbb",
  branch: "codex/auftrag-bbb",
  commit_title: "Titel B",
});
lege("auftrag-bbb/AUFTRAG-B1.json", { id: "aufnahme:test:a", title: "Titel B" });

// Ordner C: trägt die Kennung von A und denselben Commit-Titel.
lege("auftrag-ccc/AUFTRAG.json", {
  kennung: "auftrag-aaa",
  branch: "codex/auftrag-ccc",
  commit_title: "Titel A",
});
lege("auftrag-ccc/AUFTRAG-B1.json", { id: "aufnahme:test:c" });
lege("auftrag-ccc/auftragsstand.json", { auftrag: { id: "aufnahme:test:anders" } });

// Kein Auftragsordner.
lege("sonstiges/notiz.txt", "kein Auftrag");

const GITLOG = [
  `${"1".repeat(40)}\tTitel A (1.0.0-beta.1.981)`,
  `${"2".repeat(40)}\tTitel A (Hauptstand integriert)`,
  `${"3".repeat(40)}\tTitel A (Arbeitssicherung)`,
  `${"4".repeat(40)}\tTitel AB (Hauptstand integriert)`,
  `${"5".repeat(40)}\tTitel A`,
  `${"6".repeat(40)}\tVorwort Titel A (Hauptstand integriert)`,
  "ohne Tabulator",
].join("\n");

describe("Job-Stammblatt · R-1492", () => {
  const blatt = stammblattVon(join(wurzel, "auftrag-aaa"), GITLOG);

  it("S1: Gegenstand, Welle/Scheibe und Stand aus den Auftragsdateien", () => {
    expect(blatt.kennung).toBe("auftrag-aaa");
    expect(blatt.auftragId).toBe("aufnahme:test:a");
    expect(blatt.revision).toBe(2);
    expect(blatt.status).toBe("offen");
    expect(blatt.gegenstand).toBe("Titel A");
    expect(blatt.meilensteine).toEqual(["Welle 3"]);
    expect(blatt.prioritaet).toBe(1);
    expect(blatt.branch).toBe("codex/auftrag-aaa");
    expect(blatt.schritt).toBe("ben");
    expect(blatt.naechsterSchritt).toBe("auslieferung");
    expect(blatt.kandidat).toBe(KANDIDAT);
    expect(blatt.maengel).toEqual([]);
  });

  it("S2: Durchgänge numerisch geordnet, laufender zuletzt, je mit Prüfbericht und Urteil", () => {
    expect(blatt.durchgaenge.map((d) => d.ort)).toEqual([
      "HISTORIE/nacharbeit-1",
      "HISTORIE/nacharbeit-2",
      "HISTORIE/nacharbeit-10",
      "aktuell",
    ]);
    const [eins, zwei, zehn, aktuell] = blatt.durchgaenge;
    expect(eins).toMatchObject({ pruefbericht: true, ben: { urteil: "nacharbeit" } });
    expect(zwei).toMatchObject({
      pruefbericht: true,
      ben: { urteil: null, grund: "keine BEN/ANTWORT.json" },
    });
    expect(zehn).toMatchObject({
      pruefbericht: false,
      ben: { urteil: null, grund: "mehrdeutig: erfuellt, offen" },
    });
    expect(aktuell).toMatchObject({ pruefbericht: false, ben: { urteil: "erfuellt" } });
  });

  it("S3: Integrations- und Fassungscommit zum Commit-Titel", () => {
    expect(blatt.integration).toEqual({
      integriert: ["2".repeat(40)],
      fassungen: [{ commit: "1".repeat(40), fassung: "1.0.0-beta.1.981" }],
    });
  });

  it("S4: das Blatt als Text trägt alle vier Teile aus R-1492", () => {
    const text = alsText(blatt);
    expect(text).toContain("STAMMBLATT auftrag-aaa");
    expect(text).toContain("Gegenstand:     Titel A");
    expect(text).toContain("Welle/Scheibe:  Meilensteine Welle 3 · Priorität 1");
    expect(text).toContain("HISTORIE/nacharbeit-1");
    expect(text).toContain("Benurteil nacharbeit");
    expect(text).toContain("Benurteil — (mehrdeutig: erfuellt, offen)");
    expect(text).toContain("Integration:    22222222");
    expect(text).toContain("Fassung:        1.0.0-beta.1.981 (11111111)");
  });

  it("S5: ohne Gitverlauf heißt die Integration ausdrücklich „nicht ermittelt“", () => {
    const ohne = stammblattVon(join(wurzel, "auftrag-aaa"));
    expect(ohne.integration).toBeNull();
    expect(alsText(ohne)).toContain("Integration:    nicht ermittelt");
  });
});

describe("Job-Stammblatt · Benurteil nur eindeutig", () => {
  it("U: ein Wert, gleicher Wert doppelt, verschiedene Werte, verschachtelt, unlesbar", () => {
    expect(benurteilAus({ urteil: "offen" })).toEqual({ urteil: "offen", grund: "" });
    expect(benurteilAus({ a: "offen", b: "offen" }).urteil).toBe("offen");
    expect(benurteilAus({ a: "erfuellt", b: "nacharbeit" }).urteil).toBeNull();
    expect(benurteilAus({ antwort: { urteil: "erfuellt" } })).toEqual({
      urteil: null,
      grund: "kein Urteilswert in der Antwort",
    });
    expect(benurteilAus({ urteil: "ERFUELLT" }).urteil).toBeNull();
    expect(benurteilAus(null).grund).toBe("keine lesbare Antwort");
    expect(benurteilAus(["erfuellt"]).grund).toBe("keine lesbare Antwort");
  });
});

describe("Job-Stammblatt · Integration nur bei vollständigem Titel", () => {
  it("I: Präfix, fremder Zusatz und fehlender Titel zählen nicht", () => {
    expect(integrationAus(GITLOG, "Titel AB")?.integriert).toEqual(["4".repeat(40)]);
    expect(integrationAus(GITLOG, "Titel")).toEqual({ integriert: [], fassungen: [] });
    expect(integrationAus(GITLOG, null)).toBeNull();
  });
});

describe("Job-Stammblatt · Wache gegen Doppelvergabe (R-1393)", () => {
  const ordner = auftragsordnerUnter(wurzel);
  const blaetter = ordner.map((o) => stammblattVon(o, GITLOG));

  it("D1: nur Ordner mit Auftragsdatei zählen", () => {
    expect(ordner.map((o) => o.slice(wurzel.length + 1))).toEqual([
      "auftrag-aaa",
      "auftrag-bbb",
      "auftrag-ccc",
    ]);
  });

  it("D2: doppelte Auftrags-ID, Kennung und Commit-Titel werden gemeldet, Branches nicht", () => {
    const funde = doppelvergaben(blaetter).map((f) => ({
      art: f.art,
      wert: f.wert,
      ordner: f.ordner.map((o) => o.slice(wurzel.length + 1)),
    }));
    expect(funde).toEqual([
      { art: "auftrag-id", wert: "aufnahme:test:a", ordner: ["auftrag-aaa", "auftrag-bbb"] },
      { art: "kennung", wert: "auftrag-aaa", ordner: ["auftrag-aaa", "auftrag-ccc"] },
      { art: "commit-titel", wert: "Titel A", ordner: ["auftrag-aaa", "auftrag-ccc"] },
    ]);
  });

  it("D3: Widersprüche im Ordner stehen als Mangel am Blatt", () => {
    const c = blaetter[2];
    expect(c?.maengel).toEqual([
      "Ordnername auftrag-ccc weicht von Kennung auftrag-aaa ab",
      "auftragsstand.json nennt aufnahme:test:anders, AUFTRAG-B1.json aufnahme:test:c",
    ]);
    expect(alsText(c ?? blaetter[0]!)).toContain("MANGEL:         Ordnername auftrag-ccc");
  });

  it("D4: ohne Doppelvergabe meldet die Wache nichts", () => {
    expect(doppelvergaben(blaetter.slice(0, 1))).toEqual([]);
  });
});

// Nacharbeit 1 (Ben): Am Echtbestand kamen über eine Pipe nur 65.536 von 2.153.824 Bytes an, mit
// Exit 0 und ungültigem JSON — `process.exit` direkt nach der Ausgabe. Hier läuft der echte
// Direktaufruf als Kindprozess mit Pipe und einer Ausgabe weit über 64 KiB.
describe("Job-Stammblatt · Direktaufruf über eine Pipe", () => {
  const gross = mkdtempSync(join(tmpdir(), "job-stammblatt-pipe-"));
  afterAll(() => rmSync(gross, { recursive: true, force: true }));
  const ANZAHL = 120;
  const FUELLUNG = "x".repeat(4_000);
  for (let i = 0; i < ANZAHL; i += 1) {
    const k = `auftrag-${String(i).padStart(4, "0")}`;
    const ordner = join(gross, k);
    mkdirSync(ordner, { recursive: true });
    writeFileSync(
      join(ordner, "AUFTRAG.json"),
      JSON.stringify({ kennung: k, branch: `codex/${k}`, commit_title: `Titel ${i}` }),
    );
    writeFileSync(join(ordner, "AUFTRAG-B1.json"), JSON.stringify({ id: `aufnahme:pipe:${i}` }));
    writeFileSync(
      join(ordner, "auftragsstand.json"),
      JSON.stringify({ fortschritt: { schritt: "fertig", lieferung: { scope: FUELLUNG } } }),
    );
  }

  const lauf = (wurzelPfad: string) =>
    spawnSync(
      "node",
      ["--import", "tsx", "tools/job-stammblatt.ts", wurzelPfad, "--json", "--ref", "HEAD"],
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );

  it("P1: große Ausgabe kommt vollständig als gültiges JSON an, Exit 0", () => {
    const r = lauf(gross);
    expect(r.error).toBeUndefined();
    expect(Buffer.byteLength(r.stdout, "utf8")).toBeGreaterThan(4 * 65_536);
    const daten = JSON.parse(r.stdout) as { blaetter: unknown[]; doppelvergaben: unknown[] };
    expect(daten.blaetter).toHaveLength(ANZAHL);
    expect(daten.doppelvergaben).toEqual([]);
    expect(r.status).toBe(0);
  });

  it("P2: mit Doppelvergabe bleibt die Ausgabe vollständig, Exit 1", () => {
    const k = "auftrag-doppelt";
    mkdirSync(join(gross, k), { recursive: true });
    writeFileSync(join(gross, k, "AUFTRAG.json"), JSON.stringify({ kennung: k }));
    writeFileSync(join(gross, k, "AUFTRAG-B1.json"), JSON.stringify({ id: "aufnahme:pipe:0" }));
    const r = lauf(gross);
    const daten = JSON.parse(r.stdout) as {
      blaetter: unknown[];
      doppelvergaben: Array<{ art: string; wert: string }>;
    };
    expect(daten.blaetter).toHaveLength(ANZAHL + 1);
    expect(daten.doppelvergaben).toEqual([
      expect.objectContaining({ art: "auftrag-id", wert: "aufnahme:pipe:0" }),
    ]);
    expect(r.status).toBe(1);
  });

  it("P3: das Werkzeug beendet sich nirgends mit process.exit", () => {
    expect(readFileSync("tools/job-stammblatt.ts", "utf8")).not.toMatch(/process\.exit\(/);
  });
});

// Nacharbeit 3 (Ben): Die Vorgabe `--ref main` las einen veralteten lokalen Verweis; am Echtbestand
// blieben die Integrationslisten leer, obwohl die Commits im Kandidatenverlauf lagen. Hier steht ein
// echtes Gitarchiv mit einem veralteten Zweig und einem aktuellen HEAD.
describe("Job-Stammblatt · Gitstand gebunden", () => {
  const repo = mkdtempSync(join(tmpdir(), "job-stammblatt-git-"));
  afterAll(() => rmSync(repo, { recursive: true, force: true }));
  const g = (...argumente: string[]): string => {
    const r = spawnSync(
      "git",
      [
        "-C",
        repo,
        "-c",
        "user.name=Stammblatt",
        "-c",
        "user.email=stammblatt@example.invalid",
        "-c",
        "commit.gpgsign=false",
        ...argumente,
      ],
      { encoding: "utf8" },
    );
    if (r.status !== 0) throw new Error(`git ${argumente.join(" ")}: ${r.stderr}`);
    return r.stdout.trim();
  };
  let basis = "";
  let integriert = "";
  let fassung = "";

  beforeAll(() => {
    g("init", "-q");
    g("commit", "-q", "--allow-empty", "-m", "Basis");
    basis = g("rev-parse", "HEAD");
    g("branch", "veraltet");
    g("commit", "-q", "--allow-empty", "-m", "Titel A (Arbeitssicherung)");
    g("commit", "-q", "--allow-empty", "-m", "Titel A (Hauptstand integriert)");
    integriert = g("rev-parse", "HEAD");
    g("commit", "-q", "--allow-empty", "-m", "Titel A (1.0.0-beta.1.981)");
    fassung = g("rev-parse", "HEAD");
  });

  it("G1: die Vorgabe ist HEAD; Integrations- und Fassungscommit werden gefunden", () => {
    expect(STANDARD_REF).toBe("HEAD");
    const { stand, log } = gitStandVon(repo);
    expect(stand).toEqual({ repo, ref: "HEAD", commit: fassung });
    expect(integrationAus(log ?? "", "Titel A")).toEqual({
      integriert: [integriert],
      fassungen: [{ commit: fassung, fassung: "1.0.0-beta.1.981" }],
    });
  });

  it("G2: ein ausdrücklich gewählter veralteter Verweis ist am gebundenen Commit erkennbar", () => {
    const { stand, log } = gitStandVon(repo, "veraltet");
    expect(stand.commit).toBe(basis);
    expect(integrationAus(log ?? "", "Titel A")).toEqual({ integriert: [], fassungen: [] });
  });

  it("G3: ein unbekannter Verweis ergibt keinen Commit und keinen Verlauf", () => {
    expect(gitStandVon(repo, "gibt-es-nicht")).toEqual({
      stand: { repo, ref: "gibt-es-nicht", commit: null },
      log: null,
    });
  });

  it("G4: der Direktaufruf ohne --ref liest HEAD und nennt den gebundenen Gitstand", () => {
    const r = spawnSync(
      "node",
      [
        "--import",
        "tsx",
        "tools/job-stammblatt.ts",
        join(wurzel, "auftrag-aaa"),
        "--json",
        "--repo",
        repo,
      ],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] },
    );
    const daten = JSON.parse(r.stdout) as {
      gitStand: { ref: string; commit: string | null };
      blaetter: Array<{ integration: { integriert: string[]; fassungen: unknown[] } | null }>;
    };
    expect(daten.gitStand).toMatchObject({ ref: "HEAD", commit: fassung });
    expect(daten.blaetter[0]?.integration).toEqual({
      integriert: [integriert],
      fassungen: [{ commit: fassung, fassung: "1.0.0-beta.1.981" }],
    });
    expect(r.status).toBe(0);
  });
});

describe("Job-Stammblatt · Bestandsabgleich", () => {
  const DOKUMENT = "docs/entscheidungen/job-stammblatt.md";

  it("B: beide Kriterien mit R-Nummer, K3 und nur vorhandene Produktdateien", () => {
    const text = readFileSync(DOKUMENT, "utf8");
    expect(text).toContain("### K1 · R-1393 — ");
    expect(text).toContain("### K2 · R-1492 — ");
    expect(text).toContain("### K3 — ");
    const pfade = [...text.matchAll(/`((?:tools|tests|docs)\/[^`\s]+)`/g)].map((t) => t[1] ?? "");
    expect(pfade.length).toBeGreaterThan(2);
    expect(pfade.filter((p) => !existsSync(p))).toEqual([]);
  });
});
