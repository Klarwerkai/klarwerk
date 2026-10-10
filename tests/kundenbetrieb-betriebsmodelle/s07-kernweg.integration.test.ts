// ==================================================================================================
// AW-12 · ABNAHME S07 — DER INTERNE KERN AUF DEM PRÜFPLATZ, MIT ECHTEN GEWICHTEN.
// ==================================================================================================
//
// Ben, Kandidat 065ee584: der Prüfplan enthielt nur Unit-Prüfungen; der reale S07-Lauf und der
// Modellbestand fehlten. Diese Strecke IST der Anschluss. Sie fährt auf dem Prüfplatz der regulären
// Integrationsprüfung (Docker, PostgreSQL aus `KLARWERK_PG_TEST_URL`) mit ausschließlich künstlichen
// Firmendaten:
//
//   S1  Modellbestand: Ollama-Container mit fester Abbildfassung, Referenzgewichte `qwen3:32b` und
//       `bge-m3` (§6.1), `scripts/betrieb/modellbestand-erfassen.mjs` mit Exit 0.
//   S2  Getrennte Unternehmensressourcen: zwei Serverprozesse, zwei Wegwerf-Datenbanken, zwei
//       Instanzadressen — Inhalt und Konto der einen Firma sind in der anderen nicht vorhanden.
//   S3  Interner Kernweg: KI-Aufgabe am lokalen Sprachmodell, Einbettung am lokalen Embedding-Modell,
//       beides im Datenbestand der Firma A mit Modell bzw. `intern:bge-m3@1024` belegt.
//   S4  Verbindungen: jeder TCP-Aufbau beider App-Prozesse (`verbindungsmitschnitt.mjs`) geht nur an
//       die Datenbank oder den Modellserver.
//   S5  Protokolle: kein Inhaltstext und kein Kennwort in der Prozessausgabe.
//   S6  Sicherung: `scripts/backup/backup.sh` für Firma A — Dump mit passender Prüfsumme, enthält A,
//       enthält B nicht.
//   S7  Netzsperre des Modellservers: nach dem Gewichtsdownload hängt er nur an einem
//       `--internal`-Netz; im Container scheitern TCP nach außen, Namensauflösung und Registry-Abruf.
//
// Jeder Lauf wird über `/health` (`commit`, `instanz`) dem Kandidaten zugeordnet; das Ergebnis steht
// mit Rechnername, Rollen und Kennungen in `.local/run/s07/<zeit>/S07-ERGEBNIS.json` und auf stdout.
//
// VORAUSSETZUNGEN, die der Lauf NICHT selbst schafft und deshalb laut meldet (kein stilles Grün,
// Zeugenfall Z0): `KLARWERK_PG_TEST_URL`, `docker`, `pg_dump`/`pg_restore`, und — falls kein
// vorbefüllter Ordner `KLARWERK_S07_MODELLE_DIR` übergeben wird — Netz zum einmaligen Laden der
// Gewichte in den Container. Die App selbst bekommt keinen Cloud-Schlüssel.
import {
  type ChildProcessWithoutNullStreams,
  execFileSync,
  spawn,
  spawnSync,
} from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PASSWORT, Sitzung, mussGelingen } from "../gast-nutzerweg/strecke";
import {
  type Verbindung,
  WURZEL,
  freierPort,
  pgUrl,
  schneideMit,
  serverUmgebung,
  warteAufGesund,
  zerlege,
} from "../gesamtanweisung-nutzerweg/weg";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { fahreNode } from "./hilfen";

const MARKE = "AW-12 S07";
// Feste Fassung, kein `latest`. Vorgabe ist die auf dem Helferrechner gemessene Ollama-Fassung
// (HILFE/088d3778…/PRUEFPLATZ.json, `client_version`); der Prüfplatz kann sie überschreiben.
const OLLAMA_ABBILD = process.env.KLARWERK_S07_OLLAMA_IMAGE ?? "ollama/ollama:0.32.3";
const SPRACHMODELL = "qwen3:32b";
const EMBEDDING = "bge-m3";
const DIM = 1024;
const STUNDE = 3_600_000;
const ZEIT = `${Date.now()}`.slice(-9);
const DB_A = `klarwerk_s07_firma_a_test_${ZEIT}`;
const DB_B = `klarwerk_s07_firma_b_test_${ZEIT}`;
// Künstliche Inhalte, je Firma eindeutig — nach ihnen wird in B, im Protokoll und im Dump gesucht.
const INHALT_A = `S07-FIRMA-A-${ZEIT} Druckluftanlage vor Wartung entlueften`;
const INHALT_B = `S07-FIRMA-B-${ZEIT} Kuehlkreislauf monatlich pruefen`;
const ADMIN_A = `admin-a-${ZEIT}@s07-firma-a.test`;
const ADMIN_B = `admin-b-${ZEIT}@s07-firma-b.test`;

interface Instanz {
  name: string;
  basis: string;
  adresse: string;
  db: string;
  prozess: ChildProcessWithoutNullStreams;
  protokoll: string[];
  mitschnitt: string;
}

interface Mitschnitt {
  host: string | null;
  port: number | string | null;
  pfad: string | null;
}

let laufzustand: Laufzustand | undefined;
let verbindung: Verbindung | undefined;
let adminPool: Pool | undefined;
let container: string | undefined;
let netz: string | undefined;
let modellHost = "127.0.0.1";
let modellPort = 0;

interface Sperrprobe {
  container: string;
  containerId: string;
  netz: string;
  netzIntern: string;
  netzeVorher: string[];
  netzeNachher: string[];
  tcpNachAussen: number | null;
  namensaufloesung: number | null;
  registryAbruf: number | null;
}
let netzsperre: Sperrprobe | undefined;

/** Die Netze, an denen ein Container hängt, mit seiner Adresse je Netz. */
type Netze = Record<string, { IPAddress?: string }>;
function netzeVon(name: string): Netze {
  const format = "{{json .NetworkSettings.Networks}}";
  return JSON.parse(lauf("docker", ["inspect", "--format", format, name])) as Netze;
}

/** Exitcode eines `docker`-Aufrufs, ohne zu werfen (null = Zeitgrenze oder nicht startbar). */
function exitcode(args: string[], zeitMs: number): number | null {
  return spawnSync("docker", args, { stdio: "pipe", timeout: zeitMs }).status;
}

/**
 * Misst die Netzsperre IM Container: eine TCP-Verbindung nach außen, eine Namensauflösung und ein
 * Registry-Abruf müssen scheitern. Jeder Exitcode ungleich 0 heißt „kam nicht hinaus".
 */
function sperrprobe(name: string, internesNetz: string, vorher: string[]): Sperrprobe {
  const id = lauf("docker", ["inspect", "--format", "{{.Id}}", name]).trim();
  const nachher = Object.keys(netzeVon(name));
  const intern = lauf("docker", ["network", "inspect", "--format", "{{.Internal}}", internesNetz]);
  const tcp = "timeout 15 bash -c 'exec 3<>/dev/tcp/1.1.1.1/443'";
  return {
    container: name,
    containerId: id,
    netz: internesNetz,
    netzIntern: intern.trim(),
    netzeVorher: vorher,
    netzeNachher: nachher,
    tcpNachAussen: exitcode(["exec", name, "bash", "-c", tcp], 30_000),
    namensaufloesung: exitcode(["exec", name, "getent", "hosts", "registry.ollama.ai"], 30_000),
    registryAbruf: exitcode(["exec", name, "ollama", "pull", "all-minilm"], 180_000),
  };
}
let ablage = "";
let commit = "unbekannt";
let bestandLauf: { code: number | null; stdout: string; stderr: string } | undefined;
const instanzen: Instanz[] = [];
const ergebnis: Record<string, unknown> = {};

function lauf(befehl: string, args: string[], zeitMs = 600_000): string {
  // Ein Dump als SQL-Text ist leicht größer als der Vorgabepuffer von 1 MB.
  const maxBuffer = 512 * 1024 * 1024;
  return execFileSync(befehl, args, {
    encoding: "utf8",
    timeout: zeitMs,
    stdio: "pipe",
    maxBuffer,
  });
}

function vorhanden(befehl: string): boolean {
  try {
    execFileSync(befehl, ["--version"], { stdio: "pipe", timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

async function warteAufModellserver(basis: string): Promise<void> {
  const frist = Date.now() + 300_000;
  while (Date.now() < frist) {
    try {
      if ((await fetch(`${basis}/api/version`)).ok) return;
    } catch {
      // noch nicht bereit
    }
    await new Promise((weiter) => setTimeout(weiter, 1000));
  }
  throw new Error(`${MARKE}: Modellserver ${basis} antwortete in 300 s nicht.`);
}

async function starteInstanz(name: string, db: string): Promise<Instanz> {
  if (!verbindung) throw new Error(`${MARKE}: keine Datenbankverbindung`);
  const port = await freierPort();
  const adresse = `https://s07-${name}.test`;
  const mitschnitt = join(ablage, `verbindungen-${name}.jsonl`);
  writeFileSync(mitschnitt, "");
  const env: NodeJS.ProcessEnv = {
    ...serverUmgebung(pgUrl(verbindung, db), port),
    APP_BASE_URL: adresse,
    KLARWERK_BUILD_COMMIT: commit,
    KLARWERK_LOCAL_LLM_URL: `http://${modellHost}:${modellPort}/v1`,
    // Die Adresse im internen Netz ist kein Loopback: sie wird ausdrücklich als interne Herkunft
    // freigegeben (`isConfirmedLocalOrigin`) — derselbe Weg wie bei einem Modellrechner im Haus.
    KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS: `http://${modellHost}:${modellPort}`,
    KLARWERK_LOCAL_LLM_MODEL: SPRACHMODELL,
    KLARWERK_LOCAL_LLM_TIMEOUT_MS: String(STUNDE),
    KLARWERK_LOCAL_EMBEDDING_MODEL: EMBEDDING,
    KLARWERK_EMBEDDING_PROVIDER: "local",
    KLARWERK_EMBEDDING_DIM: String(DIM),
    KLARWERK_DUP_PREFILTER: "1",
    KLARWERK_S07_MITSCHNITT: mitschnitt,
  };
  const vorlade = join(WURZEL, "tests/kundenbetrieb-betriebsmodelle/verbindungsmitschnitt.mjs");
  const args = ["--import", "tsx", "--import", vorlade, "services/app/src/server.ts"];
  const prozess = spawn("node", args, { cwd: WURZEL, env });
  const protokoll: string[] = [];
  schneideMit(prozess, protokoll);
  const basis = `http://127.0.0.1:${port}`;
  await warteAufGesund(basis, prozess, protokoll, `Firma ${name}`);
  return { name, basis, adresse, db, prozess, protokoll, mitschnitt };
}

async function beende(prozess: ChildProcessWithoutNullStreams): Promise<void> {
  if (prozess.exitCode === null && prozess.signalCode === null) {
    const aus = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
    prozess.kill("SIGTERM");
    await aus;
  }
}

function instanz(name: string): Instanz {
  const gefunden = instanzen.find((i) => i.name === name);
  if (!gefunden) throw new Error(`${MARKE}: Instanz ${name} lief nicht`);
  return gefunden;
}

async function health(basis: string): Promise<Record<string, unknown>> {
  return (await (await fetch(`${basis}/health`)).json()) as Record<string, unknown>;
}

beforeAll(async () => {
  const url = guardedLocalPgTestUrl();
  const fehlend: string[] = [];
  if (!url) fehlend.push("KLARWERK_PG_TEST_URL");
  for (const befehl of ["docker", "pg_dump", "pg_restore"]) {
    if (!vorhanden(befehl)) fehlend.push(befehl);
  }
  if (!url || fehlend.length > 0) {
    laufzustand = { gelaufen: false, grund: `Voraussetzung fehlt: ${fehlend.join(", ")}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
    return;
  }
  verbindung = zerlege(url);
  if (!verbindung) {
    laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen" };
    process.stderr.write(befundsatz(MARKE, laufzustand));
    return;
  }
  ablage = join(WURZEL, ".local/run/s07", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(ablage, { recursive: true });
  try {
    commit = lauf("git", ["rev-parse", "HEAD"]).trim();
  } catch {
    commit = "unbekannt";
  }

  // ── Modellserver mit fester Fassung und den Referenzgewichten ────────────────────────────────
  const modelle = process.env.KLARWERK_S07_MODELLE_DIR ?? mkdtempSync(join(tmpdir(), "kw-s07-"));
  modellPort = await freierPort();
  container = `kw-s07-${ZEIT}`;
  lauf("docker", [
    "run",
    "-d",
    "--name",
    container,
    "-p",
    `127.0.0.1:${modellPort}:11434`,
    "-v",
    `${modelle}:/root/.ollama`,
    OLLAMA_ABBILD,
  ]);
  await warteAufModellserver(`http://127.0.0.1:${modellPort}`);
  for (const gewicht of [SPRACHMODELL, EMBEDDING]) {
    lauf("docker", ["exec", container, "ollama", "pull", gewicht], 3 * STUNDE);
  }

  // ── Netzsperre: nach dem Laden der Gewichte NUR noch das interne Netz ────────────────────────
  // Ben, Kandidat 234fe917: der Modellserver lief im Kernweg am Standardnetz, seine Verbindungen und
  // Namensauflösung blieben ungeprüft. Ab hier hängt er nur an einem `--internal`-Netz (kein Weg
  // nach außen, so wie `scripts/deploy/compose-intern.yml`); die App erreicht ihn über seine Adresse
  // in diesem Netz. Die Wirkung wird im Container selbst gemessen (Fall S7).
  const netzeVorher = Object.keys(netzeVon(container));
  netz = `kw-s07-intern-${ZEIT}`;
  lauf("docker", ["network", "create", "--internal", netz]);
  lauf("docker", ["network", "connect", netz, container]);
  lauf("docker", ["network", "disconnect", "bridge", container]);
  modellHost = netzeVon(container)[netz]?.IPAddress ?? "";
  modellPort = 11434;
  if (!modellHost) throw new Error(`${MARKE}: Modellserver hat im Netz ${netz} keine Adresse`);
  await warteAufModellserver(`http://${modellHost}:${modellPort}`);
  netzsperre = sperrprobe(container, netz, netzeVorher);
  writeFileSync(join(ablage, "NETZSPERRE.json"), `${JSON.stringify(netzsperre, null, 2)}\n`);

  // ── S1 vorbereitet: der Bestand am laufenden Server ──────────────────────────────────────────
  const modellHerkunft = `http://${modellHost}:${modellPort}`;
  bestandLauf = await fahreNode([
    join(WURZEL, "scripts/betrieb/modellbestand-erfassen.mjs"),
    modellHerkunft,
    "--sprachmodell",
    SPRACHMODELL,
    "--embedding",
    EMBEDDING,
    "--dim",
    String(DIM),
    "--erlaubt",
    modellHerkunft,
  ]);
  writeFileSync(join(ablage, "MODELLBESTAND.json"), bestandLauf.stdout);

  // ── Zwei Firmen: zwei Datenbanken, zwei Prozesse ─────────────────────────────────────────────
  adminPool = new Pool({ connectionString: url });
  await adminPool.query(`CREATE DATABASE ${DB_A}`);
  await adminPool.query(`CREATE DATABASE ${DB_B}`);
  instanzen.push(await starteInstanz("firma-a", DB_A));
  instanzen.push(await starteInstanz("firma-b", DB_B));
  laufzustand = {
    gelaufen: true,
    quelle: `${verbindung.host}:${verbindung.port} · ${OLLAMA_ABBILD} · ${hostname()}`,
  };
  process.stderr.write(befundsatz(MARKE, laufzustand));
}, 4 * STUNDE);

afterAll(async () => {
  for (const i of instanzen) {
    writeFileSync(join(ablage, `protokoll-${i.name}.txt`), i.protokoll.join(""));
    await beende(i.prozess);
  }
  if (ablage) {
    const gesamt = { kandidat: commit, rechner: hostname(), abbild: OLLAMA_ABBILD, ...ergebnis };
    writeFileSync(join(ablage, "S07-ERGEBNIS.json"), `${JSON.stringify(gesamt, null, 2)}\n`);
    process.stdout.write(`[KLARWERK] ${MARKE} ERGEBNIS ${JSON.stringify(gesamt)}\n`);
  }
  if (container) {
    try {
      lauf("docker", ["rm", "-f", container]);
    } catch {
      // bereits weg
    }
  }
  if (netz) {
    try {
      lauf("docker", ["network", "rm", netz]);
    } catch {
      // bereits weg
    }
  }
  if (adminPool) {
    for (const db of [DB_A, DB_B]) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await adminPool.end();
  }
}, 600_000);

describe("AW-12 · Abnahme S07 auf dem Prüfplatz", () => {
  it("Z0 · der Lauf hat stattgefunden — ein übersprungener Pflichtfall ist kein Grün", () => {
    expect(zaehltAlsBestanden(laufzustand), befundsatz(MARKE, laufzustand)).toBe(true);
  });

  it("S1 · Modellbestand mit Laufzeitfassung, Digests, Lizenztext und Einbettungsprobe", () => {
    expect(bestandLauf?.code, bestandLauf?.stdout ?? "").toBe(0);
    const bestand = JSON.parse(bestandLauf?.stdout ?? "{}") as {
      laufzeit: { version: string | null };
      modelle: { rolle: string; name: string; digest: string | null }[];
      embeddingProbe: { gleich: boolean } | null;
    };
    expect(bestand.laufzeit.version).toBeTruthy();
    expect(bestand.modelle.map((m) => m.name)).toEqual([SPRACHMODELL, EMBEDDING]);
    expect(bestand.modelle.every((m) => typeof m.digest === "string")).toBe(true);
    expect(bestand.embeddingProbe?.gleich).toBe(true);
    ergebnis.modellbestand = bestand;
  });

  it(
    "S2 · zwei Firmen: getrennte Instanz, Konten und Inhalte",
    async () => {
      const a = instanz("firma-a");
      const b = instanz("firma-b");
      const ha = await health(a.basis);
      const hb = await health(b.basis);
      expect(ha.instanz).toBe(a.adresse);
      expect(hb.instanz).toBe(b.adresse);
      expect(ha.commit).toBe(commit);
      expect(hb.commit).toBe(commit);

      const adminA = new Sitzung(a.basis, "admin-a");
      const adminB = new Sitzung(b.basis, "admin-b");
      const setupA = { name: "Admin A", email: ADMIN_A, password: PASSWORT };
      const setupB = { name: "Admin B", email: ADMIN_B, password: PASSWORT };
      mussGelingen("Setup A", await adminA.sende("POST", "/api/auth/setup", setupA), 201);
      mussGelingen("Setup B", await adminB.sende("POST", "/api/auth/setup", setupB), 201);
      const anlage = (inhalt: string) => ({
        confidentiality: "intern",
        title: inhalt,
        statement: `${inhalt} — kuenstlicher Pruefinhalt.`,
        type: "best_practice",
        category: "Wartung",
      });
      const koA = mussGelingen(
        "KO A",
        await adminA.sende("POST", "/api/kos", anlage(INHALT_A)),
        201,
      );
      const koB = mussGelingen(
        "KO B",
        await adminB.sende("POST", "/api/kos", anlage(INHALT_B)),
        201,
      );

      const listeA = await adminA.sende("GET", "/api/kos");
      const listeB = await adminB.sende("GET", "/api/kos");
      expect(listeA.text).toContain(INHALT_A);
      expect(listeA.text).not.toContain(INHALT_B);
      expect(listeB.text).toContain(INHALT_B);
      expect(listeB.text).not.toContain(INHALT_A);

      const fremd = new Sitzung(b.basis, "admin-a-bei-b");
      const anmeldung = await fremd.sende("POST", "/api/auth/login", {
        email: ADMIN_A,
        password: PASSWORT,
      });
      expect(anmeldung.status, anmeldung.text).not.toBe(200);
      expect(anmeldung.status).toBeGreaterThanOrEqual(400);

      ergebnis.trennung = {
        instanzen: [ha.instanz, hb.instanz],
        rollen: { [ADMIN_A]: "admin@firma-a", [ADMIN_B]: "admin@firma-b" },
        wissensobjekte: {
          firmaA: (koA.json as { id: string }).id,
          firmaB: (koB.json as { id: string }).id,
        },
        fremdanmeldung: anmeldung.status,
      };
    },
    STUNDE,
  );

  it(
    "S3 · interner Kernweg: lokales Sprach- und Embedding-Modell im Bestand von A",
    async () => {
      const a = instanz("firma-a");
      if (!verbindung) throw new Error(`${MARKE}: keine Datenbankverbindung`);
      const sitzung = new Sitzung(a.basis, "admin-a-kernweg");
      mussGelingen(
        "Anmeldung A",
        await sitzung.sende("POST", "/api/auth/login", { email: ADMIN_A, password: PASSWORT }),
      );
      const ki = await sitzung.sende("POST", "/api/reasoner", {
        task: "extract",
        text: `${INHALT_A}. Danach den Restdruck am Manometer ablesen.`,
        source: "transient-document",
        confidentiality: "intern",
      });
      expect(ki.status, ki.text).toBe(200);
      const h = await health(a.basis);
      expect((h.ai as { mode?: unknown }).mode).toBe("local");

      const pool = new Pool({ connectionString: pgUrl(verbindung, DB_A) });
      try {
        const laeufe = await pool.query<{ data: Record<string, unknown> }>(
          "SELECT data FROM model_runs",
        );
        const roh = JSON.stringify(laeufe.rows.map((r) => r.data));
        expect(roh, roh).toContain(SPRACHMODELL);
        type Vektorzeile = { ko_id: string; embedding_version: string; dim: number };
        const vektoren = await pool.query<Vektorzeile>(
          "SELECT ko_id, embedding_version, dim FROM ko_embeddings",
        );
        expect(vektoren.rows.length).toBeGreaterThan(0);
        for (const zeile of vektoren.rows) {
          expect(zeile.embedding_version).toBe(`intern:${EMBEDDING}@${DIM}`);
          expect(zeile.dim).toBe(DIM);
        }
        ergebnis.kernweg = {
          kiModus: (h.ai as { mode?: unknown }).mode,
          modellLaeufe: laeufe.rows.map((r) => ({ id: r.data.id, model: r.data.model })),
          vektoren: vektoren.rows,
        };
      } finally {
        await pool.end();
      }
    },
    2 * STUNDE,
  );

  it("S4 · Verbindungen beider Prozesse nur zu Datenbank und Modellserver", () => {
    if (!verbindung) throw new Error(`${MARKE}: keine Datenbankverbindung`);
    const lokal = new Set([null, "localhost", "127.0.0.1", "::1"]);
    const pg = verbindung;
    // `net.connect` bekommt den Port mal als Zahl, mal als Zeichenkette (im S07-Lauf gemessen:
    // undici übergibt "44485"). Verglichen wird deshalb der Zahlenwert.
    const erlaubt = (z: Mitschnitt): boolean => {
      const port = Number(z.port);
      return (
        (port === Number(pg.port) && (z.host === pg.host || lokal.has(z.host))) ||
        (port === modellPort && z.host === modellHost)
      );
    };
    const befund: Record<string, Mitschnitt[]> = {};
    for (const i of instanzen) {
      const zeilen = readFileSync(i.mitschnitt, "utf8")
        .split("\n")
        .filter((z) => z.trim() !== "")
        .map((z) => JSON.parse(z) as Mitschnitt);
      expect(zeilen.length, `${i.name}: kein Verbindungsaufbau mitgeschnitten`).toBeGreaterThan(0);
      const fremd = zeilen.filter((z) => z.pfad === null && !erlaubt(z));
      expect(fremd, `${i.name}: Verbindung zu nicht vorgesehenem Ziel`).toEqual([]);
      const einzeln = new Map(zeilen.map((z) => [`${z.host}:${z.port}:${z.pfad}`, z]));
      befund[i.name] = [...einzeln.values()];
    }
    ergebnis.verbindungen = befund;
  });

  it("S7 · Modellserver im Kernweg ohne Weg nach außen: Netz, TCP, Namen, Registry", () => {
    // Ben, Kandidat 234fe917: Wirkungsnachweis der Netzsperre am Modellserver selbst, gebunden an
    // Kandidat (`commit`) und Container (`containerId`). Gemessen nach dem Gewichtsdownload und
    // VOR dem Kernweg; der Kernweg (S3) lief danach über genau diese Adresse im internen Netz.
    const probe = netzsperre;
    expect(probe, "Netzsperre wurde nicht gemessen").toBeDefined();
    if (!probe) return;
    expect(probe.netzeVorher).toContain("bridge");
    expect(probe.netzeNachher).toEqual([probe.netz]);
    expect(probe.netzIntern).toBe("true");
    expect(probe.tcpNachAussen, "TCP nach außen kam durch").not.toBe(0);
    expect(probe.namensaufloesung, "externer Name wurde aufgelöst").not.toBe(0);
    expect(probe.registryAbruf, "Registry war erreichbar").not.toBe(0);
    expect(modellHost).not.toBe("127.0.0.1");
    ergebnis.netzsperre = { kandidat: commit, modellAdresse: modellHost, ...probe };
  });

  it("S5 · Protokolle tragen keinen Inhaltstext und kein Kennwort", () => {
    for (const i of instanzen) {
      const text = i.protokoll.join("");
      expect(text, `${i.name}: Inhalt im Protokoll`).not.toContain(INHALT_A);
      expect(text, `${i.name}: Inhalt im Protokoll`).not.toContain(INHALT_B);
      expect(text, `${i.name}: Kennwort im Protokoll`).not.toContain(PASSWORT);
    }
    ergebnis.protokolle = { geprueft: instanzen.map((i) => i.name), funde: 0 };
  });

  it("S6 · Sicherung von A: Prüfsumme stimmt, enthält A, enthält B nicht", () => {
    if (!verbindung) throw new Error(`${MARKE}: keine Datenbankverbindung`);
    const ziel = join(ablage, "sicherung-firma-a");
    mkdirSync(ziel, { recursive: true });
    execFileSync("bash", [join(WURZEL, "scripts/backup/backup.sh"), ziel], {
      env: { ...process.env, DATABASE_URL: pgUrl(verbindung, DB_A) },
      stdio: "pipe",
      timeout: 600_000,
    });
    const dump = readdirSync(ziel).find((d) => d.endsWith(".dump"));
    expect(dump, "kein Dump entstanden").toBeDefined();
    const pfad = join(ziel, dump ?? "");
    expect(existsSync(`${pfad}.sha256`)).toBe(true);
    const erwartet = readFileSync(`${pfad}.sha256`, "utf8").split(/\s+/)[0];
    const ist = createHash("sha256").update(readFileSync(pfad)).digest("hex");
    expect(ist).toBe(erwartet);
    const inhalt = lauf("pg_restore", ["--file=-", pfad]);
    expect(inhalt).toContain(INHALT_A);
    expect(inhalt).not.toContain(INHALT_B);
    ergebnis.sicherung = { datei: dump, sha256: ist, enthaeltA: true, enthaeltB: false };
  }, 900_000);
});
