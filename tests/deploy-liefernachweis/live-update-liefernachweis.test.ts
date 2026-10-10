import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// R-0786 — geliefert ist ein Stand erst, wenn /health GESUND UND GENAU DIESEN Commit meldet; eine
// fehlgeschlagene Auslieferung ist ein Ausfall. Das Live-Update-Skript läuft hier gegen
// Platzhalter für `curl`, `security` und `sleep` im PATH — kein Netz, kein Deploy, kein Token.

const REPO = join(__dirname, "..", "..");
const LIVE_UPDATE = join(REPO, "scripts", "deploy", "klarwerk-live-update.command");
const SHIP = join(REPO, "scripts", "deploy", "klarwerk-ship.command");

const NEU = "a".repeat(40);
const ALT = "b".repeat(40);

let stubs: string;

// Der curl-Platzhalter bedient die drei Abrufe des Skripts: Deploy anstoßen (schreibt -o, gibt
// den HTTP-Code aus), Deployment-Status und /health — die beiden letzten aus Umgebungsvariablen.
// Wie echtes curl: `-w` wird NACH dem Body ausgegeben, `%{http_code}` ersetzt; der Exitcode ist
// einstellbar (z. B. 18 = Übertragung abgebrochen, NACHDEM der Body schon ausgegeben war).
const CURL = `#!/bin/bash
out=""; url=""; w=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -w) w="$2"; shift 2 ;;
    -H|--max-time|--connect-timeout) shift 2 ;;
    -*) shift ;;
    *) url="$1"; shift ;;
  esac
done
body=""; code=200; ende=0
case "$url" in
  */api/v1/deploy\\?*) body='{"message":"ok","deployments":[{"deployment_uuid":"dep123"}]}' ;;
  */api/v1/deployments/*) body="$STUB_DEPLOYMENT"; code="\${STUB_DEPLOYMENT_CODE:-200}" ;;
  */health) body="$STUB_HEALTH"; code="\${STUB_HEALTH_CODE:-200}"; ende="\${STUB_HEALTH_EXIT:-0}" ;;
esac
if [ -n "$out" ]; then printf '%s' "$body" > "$out"; else printf '%s' "$body"; fi
[ -n "$w" ] && printf "\${w//%\\{http_code\\}/$code}"
exit "$ende"
`;

function stub(name: string, inhalt: string): void {
  const pfad = join(stubs, name);
  writeFileSync(pfad, inhalt);
  chmodSync(pfad, 0o755);
}

function lauf(args: string[], env: Record<string, string>): { code: number | null; aus: string } {
  const r = spawnSync("bash", [LIVE_UPDATE, ...args], {
    encoding: "utf8",
    env: { PATH: `${stubs}:${process.env.PATH}`, TMPDIR: stubs, ...env },
  });
  return { code: r.status, aus: `${r.stdout}${r.stderr}` };
}

const gesund = (commit: string) =>
  `{"status":"ok","version":"1.0.0-beta.1.1","commit":"${commit}"}`;

beforeEach(() => {
  stubs = mkdtempSync(join(tmpdir(), "live-update-"));
  stub("curl", CURL);
  stub("security", "#!/bin/bash\nprintf 'platzhalter'\n");
  stub("sleep", "#!/bin/bash\nexit 0\n");
});

afterEach(() => {
  rmSync(stubs, { recursive: true, force: true });
});

describe("klarwerk-live-update.command — Liefermeldung an den erwarteten Commit gebunden (R-0786)", () => {
  it("meldet GELIEFERT nur, wenn /health gesund ist und genau den erwarteten Commit meldet", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: `{"status":"finished","commit":"${NEU}"}`,
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.aus).toContain("✓ GELIEFERT");
    expect(r.code).toBe(0);
  });

  it("gesund, aber alter Commit live → NICHT GELIEFERT, Exit 2", () => {
    const r = lauf([NEU], { STUB_DEPLOYMENT: '{"status":"finished"}', STUB_HEALTH: gesund(ALT) });
    expect(r.aus).toContain("NICHT GELIEFERT");
    expect(r.aus).not.toContain("✓ GELIEFERT");
    expect(r.code).toBe(2);
  });

  it("gesund, aber Commit unbekannt → NICHT GELIEFERT, Exit 2", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"status":"finished"}',
      STUB_HEALTH: gesund("unbekannt"),
    });
    expect(r.code).toBe(2);
  });

  it("Coolify nennt einen anderen Commit als erwartet → NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: `{"status":"finished","commit":"${ALT}"}`,
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.code).toBe(2);
  });

  it("fehlgeschlagene Auslieferung ist ein AUSFALL mit Exit 1 — nie „kein Ausfall“", () => {
    const r = lauf([NEU], { STUB_DEPLOYMENT: '{"status":"failed"}', STUB_HEALTH: gesund(ALT) });
    expect(r.aus).toContain("AUSFALL");
    expect(r.aus).not.toContain("kein Ausfall");
    expect(r.code).toBe(1);
  });

  it("Status unklar → NICHT GELIEFERT, Exit 2", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"status":"in_progress"}',
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.code).toBe(2);
  });

  it.each([[[] as string[]], [["abc1234"]], [["main"]]])(
    "ohne vollen erwarteten Commit (%j) wird nichts deployt, Exit 1",
    (args) => {
      const r = lauf(args, { STUB_DEPLOYMENT: '{"status":"finished"}', STUB_HEALTH: gesund(NEU) });
      expect(r.aus).toContain("Kein voller erwarteter Commit");
      expect(r.aus).not.toContain("Deploy angestoßen");
      expect(r.code).toBe(1);
    },
  );

  // Bens Gegenproben Runde 2 (B2a): der Deployment-Commit wird strukturell gelesen.
  it("abweichender Coolify-Commit mit Leerzeichen nach dem Doppelpunkt → NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: `{"status":"finished","commit": "${ALT}"}`,
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.aus).toContain(`Coolify:  ${ALT}`);
    expect(r.aus).not.toContain("✓ GELIEFERT");
    expect(r.code).toBe(2);
  });

  it.each([['"main"'], ["12345"], ["null"], ['""']])(
    "Coolify-Commit vorhanden, aber kein Commit (%s) → NICHT GELIEFERT",
    (wert) => {
      const r = lauf([NEU], {
        STUB_DEPLOYMENT: `{"status":"finished","commit":${wert}}`,
        STUB_HEALTH: gesund(NEU),
      });
      expect(r.aus).toContain("Coolify:  ungültig");
      expect(r.code).toBe(2);
    },
  );

  it("mehrzeilig formatierte Antworten mit passendem Commit → GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: `{\n  "status" : "finished",\n  "commit" : "${NEU}"\n}`,
      STUB_HEALTH: `{\n  "status": "ok",\n  "commit": "${NEU}"\n}`,
    });
    expect(r.code).toBe(0);
  });

  it("Deployment-Abruf mit HTTP 500 zählt nicht als fertig → NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: `{"status":"finished","commit":"${NEU}"}`,
      STUB_DEPLOYMENT_CODE: "500",
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.code).toBe(2);
  });

  // Bens Gegenproben Runde 2 (B2b): Transport, HTTP-Status und die EIGENEN Felder zählen.
  it("/health mit HTTP 503 und passend aussehendem Body → NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"status":"finished"}',
      STUB_HEALTH: gesund(NEU),
      STUB_HEALTH_CODE: "503",
    });
    expect(r.aus).not.toContain("✓ GELIEFERT");
    expect(r.code).toBe(2);
  });

  it("/health mit curl-Exit 18 nach ausgegebenem Body → NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"status":"finished"}',
      STUB_HEALTH: gesund(NEU),
      STUB_HEALTH_EXIT: "18",
    });
    expect(r.code).toBe(2);
  });

  it("/health mit status/commit nur in einem verschachtelten Objekt → NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"status":"finished"}',
      STUB_HEALTH: `{"status":"error","previous":{"status":"ok","commit":"${NEU}"}}`,
    });
    expect(r.aus).toContain("gesund: nein");
    expect(r.code).toBe(2);
  });

  it.each([
    [`kein json "status":"ok","commit":"${NEU}"`],
    [`[{"status":"ok","commit":"${NEU}"}]`],
    [`{"status":"ok","commit":"${NEU}"`],
    [`{"status":"ok","commit":"${NEU.slice(0, 12)}"}`],
  ])("/health mit ungültiger oder unpassender Antwort (%s) → NICHT GELIEFERT", (body) => {
    const r = lauf([NEU], { STUB_DEPLOYMENT: '{"status":"finished"}', STUB_HEALTH: body });
    expect(r.code).toBe(2);
  });

  it("Deployment-Status nur verschachtelt → Status unklar, NICHT GELIEFERT", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"queue":{"status":"finished"}}',
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.code).toBe(2);
  });

  it("nimmt den erwarteten Commit auch aus KLARWERK_ERWARTETER_COMMIT", () => {
    const r = lauf([], {
      KLARWERK_ERWARTETER_COMMIT: NEU,
      STUB_DEPLOYMENT: `{"status":"finished","commit":"${NEU}"}`,
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.code).toBe(0);
  });

  // Bens Gegenproben Runde 3 (B5): nur vollständige, von Coolify v4 bekannte Statuswerte zählen.
  it.each([["not_finished"], ["success"], ["done"], ["finished_with_errors"], ["unfinished"]])(
    "Deployment-Status %s mit passendem Commit und gesundem /health → NICHT GELIEFERT, Exit 2",
    (status) => {
      const r = lauf([NEU], {
        STUB_DEPLOYMENT: `{"status":"${status}","commit":"${NEU}"}`,
        STUB_HEALTH: gesund(NEU),
      });
      expect(r.aus).toContain(`Status ${status}`);
      expect(r.aus).not.toContain("✓ GELIEFERT");
      expect(r.code).toBe(2);
    },
  );

  it("vom Nutzer abgebrochenes Deployment ist ein AUSFALL, Exit 1", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: `{"status":"cancelled-by-user","commit":"${NEU}"}`,
      STUB_HEALTH: gesund(ALT),
    });
    expect(r.aus).toContain("AUSFALL");
    expect(r.code).toBe(1);
  });

  // Bens Gegenproben Runde 3 (B6): der Deployment-Commit muss VOLL und GENAU passen.
  it("Deployment-Commit fehlt, /health passt → TEILNACHWEIS, NICHT GELIEFERT, Exit 2", () => {
    const r = lauf([NEU], { STUB_DEPLOYMENT: '{"status":"finished"}', STUB_HEALTH: gesund(NEU) });
    expect(r.aus).toContain("Coolify:  fehlt");
    expect(r.aus).toContain("TEILNACHWEIS");
    expect(r.aus).not.toContain("✓ GELIEFERT");
    expect(r.code).toBe(2);
  });

  it.each([[NEU.slice(0, 7)], [NEU.slice(0, 39)]])(
    "verkürzter Deployment-Commit (%s) ist kein Beleg → TEILNACHWEIS, Exit 2",
    (kurz) => {
      const r = lauf([NEU], {
        STUB_DEPLOYMENT: `{"status":"finished","commit":"${kurz}"}`,
        STUB_HEALTH: gesund(NEU),
      });
      expect(r.aus).toContain(`Coolify:  verkürzt (${kurz})`);
      expect(r.aus).toContain("TEILNACHWEIS");
      expect(r.code).toBe(2);
    },
  );

  it("Deployment-Commit HEAD ist ungültig → NICHT GELIEFERT, Exit 2", () => {
    const r = lauf([NEU], {
      STUB_DEPLOYMENT: '{"status":"finished","commit":"HEAD"}',
      STUB_HEALTH: gesund(NEU),
    });
    expect(r.aus).toContain("Coolify:  ungültig");
    expect(r.code).toBe(2);
  });
});

// B7 (Ben Runde 3): das Ship-Skript läuft WIRKLICH — gegen ein Wegwerf-Repo unter einem eigenen
// HOME. `git` ist ein Platzhalter, der jeden Aufruf protokolliert; Runner, Live-Update und lokaler
// Start sind Platzhalter im Wegwerf-Repo. Kein Push, kein Deploy, kein echtes Git.
describe("klarwerk-ship.command — Versionskopplung und Liefernachweis (ausgeführt)", () => {
  const VERSION_TS = (v: string) =>
    `// eigene Arbeitsänderung, die erhalten bleiben muss\nexport const APP_VERSION = "${v}";\n`;
  const PACKAGE = (v: string) =>
    `{\n  "name": "klarwerk",\n  "version": "${v}",\n  "private": true,\n  "zusatz": "bleibt"\n}\n`;

  let home: string;
  let repo: string;

  function ship(opts: {
    version: string;
    pkg: string;
    liveUpdateExit?: number;
    antwort?: string;
    auditExit?: number;
  }) {
    home = mkdtempSync(join(tmpdir(), "ship-"));
    repo = join(home, "Documents", "dev_Klarwerk");
    for (const d of [
      "apps/web/src",
      "docs/team2-austausch",
      "scripts/deploy",
      "scripts/local",
      "tools",
      ".git",
    ]) {
      mkdirSync(join(repo, d), { recursive: true });
    }
    writeFileSync(join(repo, "apps/web/src/version.ts"), VERSION_TS(opts.version));
    writeFileSync(join(repo, "package.json"), PACKAGE(opts.pkg));
    // R-1398: die Abhängigkeitsprüfung ist ein Platzhalter — kein npm, keine Registry.
    writeFileSync(
      join(repo, "tools/abhaengigkeiten-audit.sh"),
      `echo "audit-platzhalter"\nexit ${opts.auditExit ?? 0}\n`,
    );
    writeFileSync(
      join(repo, "docs/team2-austausch/paul-runner.sh"),
      'echo "runner-gelaufen"\necho "ALLE GATES GRÜN"\n',
    );
    writeFileSync(
      join(repo, "scripts/deploy/klarwerk-live-update.command"),
      `echo "live-update $1"\nexit ${opts.liveUpdateExit ?? 0}\n`,
    );
    writeFileSync(join(repo, "scripts/local/klarwerk-lokal-starten.command"), "exit 0\n");
    stub(
      "git",
      `#!/bin/bash\necho "$*" >> "${join(home, "git.log")}"\n[ "$1" = "rev-parse" ] && echo ${NEU}\nexit 0\n`,
    );
    const r = spawnSync("bash", [SHIP, "Test-Ship"], {
      encoding: "utf8",
      input: `${opts.antwort ?? "j"}\n`,
      env: {
        PATH: `${stubs}:${process.env.PATH}`,
        HOME: home,
        KLARWERK_SHIP_SMOKE_API_KEY: "platzhalter",
      },
    });
    const gitLog = (() => {
      try {
        return readFileSync(join(home, "git.log"), "utf8");
      } catch {
        return "";
      }
    })();
    return { code: r.status, aus: `${r.stdout}${r.stderr}`, gitLog };
  }

  const datei = (rel: string) => readFileSync(join(repo, rel), "utf8");

  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true });
  });

  it("Versionsabweichung: Abbruch VOR jedem Schreiben, Arbeitsänderungen bleiben, kein git", () => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1.0.0-beta.1.600" });
    expect(r.code).toBe(1);
    expect(r.aus).toContain("nichts geschrieben");
    expect(datei("apps/web/src/version.ts")).toBe(VERSION_TS("1.0.0-beta.1.628"));
    expect(datei("package.json")).toBe(PACKAGE("1.0.0-beta.1.600"));
    expect(r.gitLog).toBe("");
  });

  it("Punkte der Nummer zählen wörtlich: 1x0 statt 1.0 gilt als Abweichung", () => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1x0.0-beta.1.628" });
    expect(r.code).toBe(1);
    expect(datei("package.json")).toBe(PACKAGE("1x0.0-beta.1.628"));
  });

  it("gleiche Version: beide Dateien auf die nächste Nummer, sonst nichts verändert", () => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1.0.0-beta.1.628" });
    expect(r.code).toBe(0);
    expect(datei("apps/web/src/version.ts")).toBe(VERSION_TS("1.0.0-beta.1.629"));
    expect(datei("package.json")).toBe(PACKAGE("1.0.0-beta.1.629"));
    expect(r.aus).toContain(`live-update ${NEU}`);
    expect(r.aus).toContain("LIVE fertig");
    expect(r.gitLog).not.toContain("checkout");
  });

  it("Live-Update nicht geliefert (Exit 2) → Ship endet mit Exit 2 ohne „LIVE fertig“", () => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1.0.0-beta.1.628", liveUpdateExit: 2 });
    expect(r.code).toBe(2);
    expect(r.aus).toContain("NICHT als geliefert bestätigt");
    expect(r.aus).not.toContain("LIVE fertig");
  });

  // Exit 1 = unbewertete oder veraltete Meldung, Exit 2 = nicht geprüft. Beide sperren.
  it.each([1, 2])("R-1398: Abhängigkeitsprüfung Exit %i → Abbruch vor Runner und git", (exit) => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1.0.0-beta.1.628", auditExit: exit });
    expect(r.code).toBe(1);
    expect(r.aus).toContain("audit-platzhalter");
    expect(r.aus).toContain(`Abhaengigkeitspruefung nicht gruen (Exit ${exit})`);
    expect(r.aus).not.toContain("runner-gelaufen");
    expect(datei("apps/web/src/version.ts")).toBe(VERSION_TS("1.0.0-beta.1.628"));
    expect(datei("package.json")).toBe(PACKAGE("1.0.0-beta.1.628"));
    expect(r.gitLog).toBe("");
    expect(r.aus).not.toContain("live-update");
  });

  it("R-1398: grüne Abhängigkeitsprüfung läuft VOR dem Runner", () => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1.0.0-beta.1.628" });
    expect(r.code).toBe(0);
    const audit = r.aus.indexOf("audit-platzhalter");
    expect(audit).toBeGreaterThan(-1);
    expect(audit).toBeLessThan(r.aus.indexOf("runner-gelaufen"));
  });

  it("Nachfrage verneint → nichts geschrieben, kein git", () => {
    const r = ship({ version: "1.0.0-beta.1.628", pkg: "1.0.0-beta.1.628", antwort: "n" });
    expect(r.code).toBe(0);
    expect(datei("apps/web/src/version.ts")).toBe(VERSION_TS("1.0.0-beta.1.628"));
    expect(r.gitLog).toBe("");
  });
});
