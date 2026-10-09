// ================================================================================================
// R-1398 · BEN nacharbeit-2 — DIE SPERRE MUSS IM TATSÄCHLICHEN LIEFERWEG LIEGEN.
// ================================================================================================
//
// Befund: das Ship-Skript wird vom automatischen Veröffentlichungsweg der Produktionsbahn nicht
// gerufen. Was jeder Lieferweg dagegen durchläuft, ist der Image-Bau: Coolify baut nach dem Push
// das `Dockerfile`. Dort steht deshalb die Stufe `abhaengigkeiten`, und die Laufzeitstufe hängt an
// ihr. Scheitert ihr RUN, scheitert der Bau, und die Fassung geht nicht live.
//
// WAS DIESER TEST BELEGT, OHNE DOCKER (im Prüfplatz gibt es keinen Image-Bau):
//   D1–D5  die Stufe steht so da, dass sie nicht übersprungen und nicht entschärft werden kann;
//   D6     der Kontext enthält alles, was sie kopiert (`.dockerignore` schliesst `tests` aus);
//   A1–A3  AUSGEFÜHRT: genau die Dateien ihrer COPY-Zeilen in einem Wegwerfordner, darin genau
//          der node-Befehl ihrer RUN-Zeile — mit gespeicherten statt Registry-Berichten. Exit 1
//          und 2 sind dort echte Rückgabewerte desselben Befehls, der den Bau abbricht.
// WAS NICHT: ein echter `docker build` und das Verhalten des Coolify-Builders (Cache, Weitergabe
// von SOURCE_COMMIT). Dass ein RUN mit Exit ≠ 0 einen Docker-Bau abbricht, ist Docker-Verhalten
// und hier nicht nachgemessen.
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { BESTAENDE, REGISTER_DATEI } from "../../tools/abhaengigkeiten-audit";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const STUFE = "abhaengigkeiten";

const arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-dockerfile-sperre-"));
afterAll(() => {
  rmSync(arbeitsordner, { recursive: true, force: true });
});

/** Anweisungen des Dockerfiles: Fortsetzungszeilen zusammengezogen, Kommentare entfernt. */
function anweisungen(): string[] {
  return readFileSync(join(WURZEL, "Dockerfile"), "utf8")
    .replace(/\\\n\s*/g, " ")
    .split("\n")
    .map((z) => z.trim())
    .filter((z) => z !== "" && !z.startsWith("#"));
}

/** Die Anweisungen einer benannten Stufe, ab ihrem FROM bis vor das nächste FROM. */
function stufe(name: string): string[] {
  const alle = anweisungen();
  const kopf = alle.findIndex((z) => new RegExp(`^FROM\\s+\\S+\\s+AS\\s+${name}$`, "i").test(z));
  if (kopf === -1) {
    throw new Error(`Dockerfile: keine Stufe „${name}"`);
  }
  const rest = alle.slice(kopf + 1);
  const ende = rest.findIndex((z) => /^FROM\s/i.test(z));
  return [alle[kopf] as string, ...(ende === -1 ? rest : rest.slice(0, ende))];
}

const pruefstufe = () => stufe(STUFE);
const runZeile = (): string => {
  const runs = pruefstufe().filter((z) => /^RUN\s/i.test(z));
  expect(runs, "die Prüfstufe hat genau eine RUN-Anweisung").toHaveLength(1);
  return runs[0] as string;
};

/** Der node-Befehl aus der RUN-Zeile, in Wörter zerlegt. */
function nodeBefehl(): string[] {
  const teil = runZeile()
    .replace(/^RUN\s+/i, "")
    .split("&&")
    .map((t) => t.trim())
    .find((t) => t.startsWith("node "));
  expect(teil, "die RUN-Zeile ruft das Werkzeug nicht mit node").toBeDefined();
  return String(teil).split(/\s+/);
}

/** Je COPY ohne --from: Quellen und Ziel. */
function kopien(): { quellen: string[]; ziel: string }[] {
  return pruefstufe()
    .filter((z) => /^COPY\s/i.test(z) && !/--from=/i.test(z))
    .map((z) => {
      const teile = z.split(/\s+/).slice(1);
      return { quellen: teile.slice(0, -1), ziel: teile[teile.length - 1] as string };
    });
}

/** Wohin eine Quelldatei im Arbeitsverzeichnis der Stufe fällt (relativ zu WORKDIR). */
function zielpfad(quelle: string, ziel: string): string {
  const ordner = ziel === "./" || ziel === "." ? "" : ziel.replace(/\/$/, "");
  return ordner ? `${ordner}/${basename(quelle)}` : basename(quelle);
}

const NOETIG = [
  "package.json",
  BESTAENDE.wurzel.lockdatei,
  "apps/web/package.json",
  BESTAENDE.web.lockdatei,
  "tools/abhaengigkeiten-audit.ts",
  REGISTER_DATEI,
];

describe("R-1398 · Dockerfile-Stufe `abhaengigkeiten` (Aufbau)", () => {
  it("D1 · die Stufe existiert und läuft auf einem Node mit TypeScript-Ausführung (≥ 24)", () => {
    const von = /^FROM\s+node:(\d+)/i.exec(pruefstufe()[0] as string);
    expect(von, "die Prüfstufe baut nicht auf einem node-Image").not.toBeNull();
    expect(Number(von?.[1])).toBeGreaterThanOrEqual(24);
  });

  it("D2 · jede nötige Datei liegt in der Stufe an ihrem Repository-Pfad", () => {
    const abgelegt = kopien().flatMap((k) => k.quellen.map((q) => [q, zielpfad(q, k.ziel)]));
    for (const datei of NOETIG) {
      expect(abgelegt, `${datei} fehlt oder liegt an anderem Ort`).toContainEqual([datei, datei]);
    }
  });

  it("D3 · die RUN-Zeile fragt die Registry und kann nicht still grün werden", () => {
    const run = runZeile();
    expect(nodeBefehl().slice(0, 2)).toEqual(["node", "tools/abhaengigkeiten-audit.ts"]);
    // Gespeicherte Berichte gehören in Tests, nicht in den Bau.
    expect(run).not.toMatch(/--bericht-/);
    // Jede Form, einen Exit-Code zu schlucken, entschärft die Sperre.
    for (const schlucker of [/\|\|/, /;\s*exit\s+0/, /set\s+\+e/, /\|\s*tee\b/, /;\s*true\b/]) {
      expect(run, `RUN schluckt den Rückgabewert: ${schlucker}`).not.toMatch(schlucker);
    }
  });

  it("D4 · SOURCE_COMMIT ist deklariert und im RUN benutzt (neuer Commit = neue Abfrage)", () => {
    const s = pruefstufe();
    const arg = s.findIndex((z) => /^ARG\s+SOURCE_COMMIT\b/.test(z));
    const run = s.findIndex((z) => /^RUN\s/i.test(z));
    expect(arg, "ARG SOURCE_COMMIT fehlt in der Prüfstufe").toBeGreaterThan(-1);
    expect(arg).toBeLessThan(run);
    expect(s[run]).toMatch(/\$\{?SOURCE_COMMIT/);
  });

  it("D5 · die Laufzeitstufe hängt an der Prüfstufe — sonst baut BuildKit sie gar nicht", () => {
    const ausgabe = nodeBefehl()[nodeBefehl().indexOf("--ausgabe") + 1];
    expect(ausgabe, "das Werkzeug legt kein Ergebnis ab").toMatch(/^\//);
    const muster = new RegExp(`^COPY\\s+--from=${STUFE}\\s+${String(ausgabe)}\\s`);
    const bezug = stufe("runtime").find((z) => muster.test(z));
    expect(bezug, "Laufzeitstufe übernimmt das Prüfergebnis nicht (COPY --from)").toBeDefined();
  });

  it("D6 · `.dockerignore` hält keine der kopierten Dateien aus dem Bau-Kontext", () => {
    const muster = readFileSync(join(WURZEL, ".dockerignore"), "utf8")
      .split("\n")
      .map((z) => z.trim())
      .filter((z) => z !== "" && !z.startsWith("#"));
    for (const datei of NOETIG) {
      for (const m of muster) {
        const endung = m.startsWith("*.") ? m.slice(1) : null;
        const trifft = endung ? datei.endsWith(endung) : datei === m || datei.startsWith(`${m}/`);
        expect(trifft, `${datei} wird von „${m}" aus dem Kontext genommen`).toBe(false);
      }
    }
  });
});

describe("R-1398 · Dockerfile-Stufe `abhaengigkeiten` (ausgeführt)", () => {
  let lauf = 0;

  /**
   * Baut das Arbeitsverzeichnis der Stufe nach und führt ihren node-Befehl darin aus.
   * `register` ersetzt das kopierte Register — nur für synthetische Sperrfälle (A4).
   */
  function stufeAusfuehren(wurzelBericht: string, register?: unknown) {
    lauf += 1;
    const arbeit = join(arbeitsordner, `pruef-${lauf}`);
    for (const k of kopien()) {
      for (const q of k.quellen) {
        const ziel = join(arbeit, zielpfad(q, k.ziel));
        mkdirSync(dirname(ziel), { recursive: true });
        cpSync(join(WURZEL, q), ziel);
      }
    }
    if (register !== undefined) {
      writeFileSync(join(arbeit, REGISTER_DATEI), JSON.stringify(register));
    }
    const berichtWurzel = join(arbeitsordner, `bericht-wurzel-${lauf}.json`);
    const berichtWeb = join(arbeitsordner, `bericht-web-${lauf}.json`);
    writeFileSync(berichtWurzel, wurzelBericht);
    writeFileSync(berichtWeb, JSON.stringify({ auditReportVersion: 2, vulnerabilities: {} }));
    const ergebnis = join(arbeitsordner, `ergebnis-${lauf}.txt`);
    const befehl = nodeBefehl().map((w) => (w.startsWith("/pruef/") ? ergebnis : w));
    const r = spawnSync(
      befehl[0] as string,
      [...befehl.slice(1), "--bericht-wurzel", berichtWurzel, "--bericht-web", berichtWeb],
      { cwd: arbeit, encoding: "utf8" },
    );
    let datei = "";
    try {
      datei = readFileSync(ergebnis, "utf8");
    } catch {
      datei = "";
    }
    return { code: r.status, aus: `${r.stdout}${r.stderr}`, datei };
  }

  /**
   * Die heute bewerteten Meldungen in npm-Form (synthetisch, wie in vor-auslieferung.test.ts).
   * Ohne `mitAusstehenden` fehlen die Meldungen mit ausstehender kompatibler Behebung — A1 prüft
   * den Durchlass, A4 genau diese Sperre.
   */
  function bewerteterStand(zusatz: Record<string, unknown> = {}, mitAusstehenden = false): string {
    const register = JSON.parse(readFileSync(join(WURZEL, REGISTER_DATEI), "utf8")) as {
      bestand: string;
      kennung: string;
      paket: string;
      ort: string;
      behebung_ausstehend?: string;
    }[];
    const vulnerabilities: Record<string, { name: string; nodes: string[]; via: unknown[] }> = {};
    const gemeldet = register.filter(
      (e) => e.bestand === "wurzel" && (mitAusstehenden || e.behebung_ausstehend === undefined),
    );
    for (const b of gemeldet) {
      const eintrag = vulnerabilities[b.paket] ?? { name: b.paket, nodes: [b.ort], via: [] };
      eintrag.via.push({
        name: b.paket,
        url: `https://github.com/advisories/${b.kennung}`,
        severity: "high",
        title: "synthetisch",
      });
      vulnerabilities[b.paket] = eintrag;
    }
    return JSON.stringify({
      auditReportVersion: 2,
      vulnerabilities: { ...vulnerabilities, ...zusatz },
    });
  }

  it("A1 · bewerteter Stand → Exit 0, das Ergebnis für die Laufzeitstufe liegt vor", () => {
    const r = stufeAusfuehren(bewerteterStand());
    expect(r.code, r.aus).toBe(0);
    expect(r.datei).toContain("✓ Abhängigkeitsprüfung");
    expect(r.datei).toMatch(/Stand: \d{4}-\d{2}-\d{2}T/);
  });

  it("A2 · unbewertete Meldung → Exit 1, der Bau bricht an dieser Stufe ab", () => {
    const neu = {
      jose: {
        name: "jose",
        nodes: ["node_modules/jose"],
        via: [{ name: "jose", url: "https://github.com/advisories/GHSA-pppp-qqqq-rrrr" }],
      },
    };
    const r = stufeAusfuehren(bewerteterStand(neu));
    expect(r.code, r.aus).toBe(1);
    expect(r.aus).toContain("✖ unbewertet: GHSA-pppp-qqqq-rrrr jose@");
  });

  it("A3 · Registry nicht erreichbar → Exit 2, der Bau bricht ebenfalls ab", () => {
    const r = stufeAusfuehren('{"error":{"code":"ENOTFOUND","summary":"registry"}}');
    expect(r.code, r.aus).toBe(2);
    expect(r.aus).toContain("NICHT durchgeführt");
  });

  it("A4 · exponiert mit ausstehender kompatibler Behebung → Exit 1, der Bau bricht ab", () => {
    // SYNTHETISCH: Seit 08.10.2026 ist sharp auf 0.35.5 gehoben, das echte Register hat keinen
    // ausstehenden Eintrag mehr. Der Sperrzustand wird deshalb an einer Registerkopie hergestellt,
    // in der der sharp-Eintrag (an der echten gebundenen Version) wieder ausstehend ist.
    const echt = JSON.parse(readFileSync(join(WURZEL, REGISTER_DATEI), "utf8")) as {
      kennung: string;
    }[];
    const register = echt.map((e) =>
      e.kennung === "GHSA-wq5f-xc86-pv6w"
        ? { ...e, urteil: "exponiert", behebung_ausstehend: "synthetische Gegenprobe A4" }
        : e,
    );
    const r = stufeAusfuehren(bewerteterStand({}, true), register);
    expect(r.code, r.aus).toBe(1);
    expect(r.aus).toContain("✖ exponiert, kompatible Behebung ausstehend: GHSA-wq5f-xc86-pv6w");
    expect(r.aus).toContain("synthetische Gegenprobe A4");
  });
});
