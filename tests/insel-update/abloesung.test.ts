// ================================================================================================
// JOB 4012 · RUNDE 2 — EIN WEG INS RELEASE, UND ER HAT EIN NETZ.
// ================================================================================================
//
// BENS KORREKTURPFLICHT 4 aus Runde 1: `install.command` blieb ein ZWEITER ausführbarer Weg, der
// `current` umbiegt — ohne Sicherung der Daten über den Vertrag, ohne Schema-Prüfung und ohne
// automatischen Rückfall. Runde 1 hatte die ABTIPPANLEITUNG (`ROLLBACK.md`) abgelöst und den
// gefährlicheren Zwilling stehen lassen. Zwei Wege zum selben Ziel heißt: im Ernstfall läuft der
// ungeübte.
//
// ABGELÖST HEISST HIER NICHT „GELÖSCHT": `install.command` bleibt der Doppelklick, den die Übergabe
// nennt (`UEBERGABE-KLARWERK-Insel.md` §4.4) — er tut nur nicht mehr selbst, was er tat, sondern
// übergibt an `update-einspielen.sh`. Gemessen wird beides: dass der Text keinen eigenen Umschalt-
// weg mehr enthält UND dass der Doppelklick am Ende wirklich das abgesicherte Ergebnis liefert.
//
// BENS KORREKTURPFLICHT 3, erste Hälfte: Der Startbefehl im Release warf `DATABASE_URL` weg
// (`unset DATABASE_URL`) und erzwang Journalbetrieb. Damit konnte der Postgres-Weg des Updates auf
// einer echten Insel gar nicht zustande kommen — gesichert wurde ein Dump, gestartet wurde gegen
// ein Journal. Hier läuft der ECHTE erzeugte Startbefehl; nur `node` selbst ist eine Attrappe
// (Fremdbinary), damit nicht die ganze Laufzeit hochfährt.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Insel,
  WURZEL,
  aktivesRelease,
  fahreSkript,
  gesundheit,
  legeBetriebswegeAb,
  legeInselAn,
  legeJournalAn,
  raeumeAb,
  schreibeRelease,
  setzeCurrent,
} from "./insel-probe";

const RELEASE_TEXTE = join(WURZEL, "scripts/insel/release-texte.mjs");
const BAU = join(WURZEL, "scripts/insel/build-current-release.mjs");
const ALT = "klarwerk-insel-alt";
const NEU = "klarwerk-insel-neu";

let insel: Insel | undefined;
afterEach(() => {
  if (insel !== undefined) {
    raeumeAb(insel);
    insel = undefined;
  }
});

/** Holt einen der erzeugten Skripttexte aus dem echten Modul — nicht aus einer Nachbildung. */
function text(ausdruck: string): string {
  const lauf = spawnSync(
    "node",
    [
      "--input-type=module",
      "-e",
      `import * as t from ${JSON.stringify(RELEASE_TEXTE)};
process.stdout.write(${ausdruck});`,
    ],
    { encoding: "utf8" },
  );
  if (lauf.status !== 0) {
    throw new Error(`release-texte.mjs: ${lauf.stderr ?? ""}`);
  }
  return lauf.stdout ?? "";
}

describe("JOB 4012 · install.command ist kein zweiter Umschaltweg mehr", () => {
  it("D1 · der erzeugte Text biegt nichts mehr selbst um und startet nichts mehr selbst", () => {
    const install = text("t.installBefehlText()");
    expect(install).toContain("update-einspielen.sh");
    for (const handgriff of ["ln -sfn", "rm -rf", "nohup", "launchctl", "curl -fsS"]) {
      expect(
        install,
        `„${handgriff}" ist weiter ein eigener Weg an der Sicherung vorbei`,
      ).not.toContain(handgriff);
    }
  });

  it("D2 · und der Doppelklick liefert am Ende das abgesicherte Ergebnis", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, { name: ALT, appVersion: "1.0.0" });
    setzeCurrent(insel, ALT);
    const journal = legeJournalAn(insel);

    // Ein Paket, wie es aus `build-current-release.mjs` fällt: Anwendung, Vertrag, Betriebswege
    // und der Doppelklick — und der Doppelklick ist der ECHTE erzeugte Text.
    const paket = schreibeRelease(join(insel.wurzel, "eingang"), {
      name: NEU,
      appVersion: "1.1.0",
    });
    legeBetriebswegeAb(paket);
    const install = join(paket, "install.command");
    writeFileSync(install, text("t.installBefehlText()"));
    chmodSync(install, 0o755);

    const lauf = fahreSkript(insel, install);

    expect(lauf.code, lauf.ausgabe).toBe(0);
    const treffer = /^Update auf 1\.1\.0 aktiv, Sicherung (.+)$/.exec(lauf.ergebnis);
    expect(treffer, `Ergebniszeile war: ${lauf.ergebnis}`).not.toBeNull();
    // Die Sicherung ist die Bedingung des Weges — der Doppelklick kommt nicht daran vorbei.
    expect(readFileSync(treffer?.[1] ?? "", "utf8")).toBe(readFileSync(journal, "utf8"));
    expect(aktivesRelease(insel)).toBe(NEU);
    expect((await gesundheit(insel))?.version).toBe("1.1.0");
  });

  it("D3 · über denselben Doppelklick greift auch der Vertrag", async () => {
    insel = await legeInselAn();
    schreibeRelease(insel.releases, {
      name: ALT,
      appVersion: "1.0.0",
      stufen: [
        { stufe: "AUTH_SCHEMA", risiko: "ADDITIV" },
        { stufe: "KO_SCHEMA", risiko: "ADDITIV" },
        { stufe: "SPAETE_STUFE", risiko: "ADDITIV" },
      ],
    });
    setzeCurrent(insel, ALT);
    legeJournalAn(insel);

    // Das Paket kennt `SPAETE_STUFE` nicht, die Daten tragen sie: ein Downgrade.
    const paket = schreibeRelease(join(insel.wurzel, "eingang"), {
      name: NEU,
      appVersion: "0.9.0",
    });
    legeBetriebswegeAb(paket);
    const install = join(paket, "install.command");
    writeFileSync(install, text("t.installBefehlText()"));
    chmodSync(install, 0o755);

    const lauf = fahreSkript(insel, install);

    expect(lauf.code, lauf.ausgabe).toBe(3);
    expect(lauf.ergebnis).toBe("Update abgebrochen, Vorversion 1.0.0 läuft weiter, Grund: vertrag");
    expect(aktivesRelease(insel)).toBe(ALT);
  });

  it("D4 · die Baudatei legt genau diese Texte ins Release", () => {
    const quelle = readFileSync(BAU, "utf8");
    expect(quelle).toContain("installBefehlText()");
    expect(quelle).toContain("startBefehlText()");
  });
});

describe("JOB 4012 · wer den Server führt, entscheidet nicht der Zufall", () => {
  /**
   * Seit `install.command` übergibt, muss der Update-Weg den launchd-Fall kennen (auf dem Mac
   * Studio kann ein Agent den Server halten). Gemessen wird hier die GRENZE der Erkennung — dass
   * sie nichts an sich zieht, was ihr nicht gehört. Der launchd-Zweig selbst ist auf dem
   * Prüfstand nicht fahrbar (kein launchd) und bleibt eine Handprobe auf dem Mac.
   */
  function werFuehrt(label: string, leererPfad = false): string {
    // Der Pfad wird INNERHALB der Schale geleert, nicht für den Start von `bash` selbst — sonst
    // fände schon `spawnSync` die Schale nicht und die Probe mäße ihren eigenen Aufbau.
    const lauf = spawnSync(
      "bash",
      [
        "-c",
        `${leererPfad ? 'export PATH="/nirgendwo"\n' : ""}. ${JSON.stringify(join(WURZEL, "scripts/insel/insel-betrieb.sh"))}
if dienst="$(insel_launchd_dienst)"; then echo "LAUNCHD=$dienst"; else echo "SELBST"; fi`,
      ],
      { encoding: "utf8", env: { ...process.env, KLARWERK_LAUNCHD_LABEL: label } },
    );
    return `${lauf.stdout ?? ""}`.trim();
  }

  it("L1 · ein nicht geladenes Label heißt: wir führen ihn selbst", () => {
    expect(werFuehrt(`de.klarwerk.insel.gibtesnicht.${process.pid}`)).toBe("SELBST");
  });

  it("L2 · ohne launchctl im Pfad wird nicht geraten, sondern selbst geführt", () => {
    expect(werFuehrt("de.klarwerk.insel", true)).toBe("SELBST");
  });
});

describe("JOB 4012 · der Startbefehl im Release wirft die Datenbank nicht mehr weg", () => {
  /**
   * Fährt den ECHTEN erzeugten Startbefehl. Attrappe ist ausschließlich `node` (Fremdbinary): der
   * Ersatz schreibt auf, mit welchen Umgebungswerten der Server gestartet WORDEN WÄRE. Der
   * Startbefehl selbst — seine Verzweigung, sein `export`, sein `unset` — läuft unverändert.
   */
  function starte(zusatz: Record<string, string>): { code: number | null; gemeldet: string } {
    const ordner = join(insel?.wurzel ?? "", "release-start");
    mkdirSync(ordner, { recursive: true });
    writeFileSync(join(ordner, "start.command"), text("t.startBefehlText()"), { mode: 0o755 });
    const stub = join(ordner, "node-attrappe");
    writeFileSync(
      stub,
      `#!/usr/bin/env bash
printf 'DATABASE_URL=[%s]\\nKLARWERK_DEV_PERSIST=[%s]\\nKLARWERK_DEV_PERSIST_FILE=[%s]\\n' \\
  "\${DATABASE_URL-}" "\${KLARWERK_DEV_PERSIST-}" "\${KLARWERK_DEV_PERSIST_FILE-}"
`,
      { mode: 0o755 },
    );
    const lauf = fahreSkript(insel as Insel, join(ordner, "start.command"), [], {
      NODE_BIN: stub,
      ...zusatz,
    });
    return { code: lauf.code, gemeldet: lauf.ausgabe };
  }

  it("S1 · ohne Datenbank-URL bleibt es beim Journal — unverändert zum Bestand", async () => {
    insel = await legeInselAn();

    const lauf = starte({});

    expect(lauf.code, lauf.gemeldet).toBe(0);
    expect(lauf.gemeldet).toContain("DATABASE_URL=[]");
    expect(lauf.gemeldet).toContain("KLARWERK_DEV_PERSIST=[1]");
    expect(lauf.gemeldet).toContain(`KLARWERK_DEV_PERSIST_FILE=[${insel.daten}/state.jsonl]`);
  });

  it("S2 · mit DATABASE_URL startet der Server gegen Postgres und nicht gegen ein Journal", async () => {
    insel = await legeInselAn();

    const lauf = starte({ DATABASE_URL: "postgres://probe:geheim@127.0.0.1:5432/klarwerk" });

    expect(lauf.code, lauf.gemeldet).toBe(0);
    expect(lauf.gemeldet).toContain(
      "DATABASE_URL=[postgres://probe:geheim@127.0.0.1:5432/klarwerk]",
    );
    // Das Journal hat neben Postgres nichts verloren — die App gäbe Postgres ohnehin den Vorrang
    // (`services/app/src/server.ts:70`), aber zwei gesetzte Quellen wären eine Einladung zum Irrtum.
    expect(lauf.gemeldet).toContain("KLARWERK_DEV_PERSIST=[]");
  });

  it("S3 · KLARWERK_DATABASE_URL — derselbe Name, den die Sicherung liest — trägt genauso", async () => {
    insel = await legeInselAn();

    const lauf = starte({
      KLARWERK_DATABASE_URL: "postgres://probe:geheim@127.0.0.1:5432/klarwerk_zwei",
    });

    expect(lauf.code, lauf.gemeldet).toBe(0);
    // `backup.sh:14` liest genau diesen Namen. Sicherte das Update daraus und startete die App
    // gegen etwas anderes, wäre die Sicherung eine Sicherung fremder Daten.
    expect(lauf.gemeldet).toContain(
      "DATABASE_URL=[postgres://probe:geheim@127.0.0.1:5432/klarwerk_zwei]",
    );
    expect(lauf.gemeldet).toContain("KLARWERK_DEV_PERSIST=[]");
  });
});
