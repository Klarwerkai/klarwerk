// ==================================================================================================
// DER PRUEFPLATZ DER KUNDENINSTALLATIONS-STRECKE: Werkzeuge, Docker, TLS — und was davon belegt wird.
// ==================================================================================================
//
// Alles hier arbeitet nur an EIGENEN Ressourcen: einem eindeutigen Compose-Projektnamen, Containern
// mit diesem Namen als Praefix und einem eigenen Temporaerordner. Fremde Container, Volumes oder
// Datenbanken werden weder gelesen noch veraendert — gezaehlt wird der Gesamtbestand nur, damit der
// Beleg sagt, auf welchem Platz die Strecke lief.
import { spawn } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { cpus, freemem, hostname, release, totalmem } from "node:os";
import { chromium } from "playwright";

export interface Ergebnis {
  code: number;
  stdout: string;
  stderr: string;
}

export interface Aufrufoptionen {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  zeitMs?: number;
  /** Fortschritt live auf stderr spiegeln (Bau, Installation) — mit diesem Praefix je Zeile. */
  spiegel?: string;
}

/** Ein Befehl als eigener Prozess, asynchron (lange Bauschritte blockieren den Testarbeiter nicht). */
export function fuehreAus(argv: string[], opt: Aufrufoptionen = {}): Promise<Ergebnis> {
  return new Promise((fertig) => {
    const [befehl, ...args] = argv;
    if (!befehl) {
      fertig({ code: 127, stdout: "", stderr: "kein Befehl" });
      return;
    }
    const kind = spawn(befehl, args, {
      cwd: opt.cwd,
      env: opt.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const spiegle = (stueck: Buffer): void => {
      if (opt.spiegel) {
        for (const zeile of stueck.toString("utf8").split("\n")) {
          if (zeile.trim()) {
            process.stderr.write(`${opt.spiegel} ${zeile}\n`);
          }
        }
      }
    };
    kind.stdout.on("data", (d: Buffer) => {
      stdout += d.toString("utf8");
      spiegle(d);
    });
    kind.stderr.on("data", (d: Buffer) => {
      stderr += d.toString("utf8");
      spiegle(d);
    });
    const uhr = setTimeout(() => kind.kill("SIGKILL"), opt.zeitMs ?? 600_000);
    kind.on("error", (fehler) => {
      clearTimeout(uhr);
      fertig({ code: 127, stdout, stderr: `${stderr}${String(fehler)}` });
    });
    kind.on("close", (code, signal) => {
      clearTimeout(uhr);
      fertig({ code: code ?? (signal ? 128 : 1), stdout, stderr });
    });
  });
}

export async function mussGelingen(
  argv: string[],
  was: string,
  opt: Aufrufoptionen = {},
): Promise<string> {
  const r = await fuehreAus(argv, opt);
  if (r.code !== 0) {
    throw new Error(
      `${was} scheiterte (Exit ${r.code}): ${argv.slice(0, 6).join(" ")} …\n${r.stderr.slice(-3000)}`,
    );
  }
  return r.stdout;
}

// --------------------------------------------------------------------------------------------------
// Docker: vorhanden, per sudo erreichbar — oder auf dem Pruefplatz einzurichten
// --------------------------------------------------------------------------------------------------

export interface Dockerzugang {
  /** Praefix fuer jeden Docker-Aufruf: `["docker"]` oder `["sudo", "-n", "docker"]`. */
  docker: string[];
  /** Was zur Einrichtung getan wurde (leer, wenn Docker schon da war). */
  eingerichtet: string[];
}

async function dockerErreichbar(praefix: string[]): Promise<boolean> {
  const r = await fuehreAus([...praefix, "info", "--format", "{{.ServerVersion}}"], {
    zeitMs: 60_000,
  });
  return r.code === 0 && r.stdout.trim().length > 0;
}

/**
 * apt ohne Rueckfragen: kein Dialog, needrestart nur auflisten, und auf einem frisch gestarteten
 * Server bis zu zehn Minuten auf die Paketsperre warten (dort laeuft oft noch unattended-upgrades).
 */
const APT = [
  "sudo",
  "-n",
  "env",
  "DEBIAN_FRONTEND=noninteractive",
  "NEEDRESTART_MODE=l",
  "apt-get",
  "-o",
  "DPkg::Lock::Timeout=600",
];

/** Die Pakete, die ein leerer Ubuntu-Pruefplatz fuer die dokumentierte Installation braucht. */
export const PRUEFPLATZ_PAKETE = [
  "docker.io",
  "docker-compose-v2",
  "docker-buildx",
  "libnss3-tools",
  "openssl",
] as const;

/**
 * Stellt Docker bereit. Ist es nicht da, wird es — nur mit passwortlosem `sudo` und nur ueber die
 * Paketverwaltung der Distribution — eingerichtet. Scheitert das, ist der Platz ungeeignet, und das
 * ist ein ROTER Befund, kein Uebersprung.
 */
export async function dockerBereitstellen(): Promise<Dockerzugang> {
  if (await dockerErreichbar(["docker"])) {
    return { docker: ["docker"], eingerichtet: [] };
  }
  const sudo = ["sudo", "-n"];
  if ((await fuehreAus([...sudo, "true"], { zeitMs: 30_000 })).code !== 0) {
    throw new Error(
      "Pruefplatz ungeeignet: Docker ist nicht erreichbar und ohne passwortloses sudo nicht einzurichten.",
    );
  }
  if (await dockerErreichbar([...sudo, "docker"])) {
    return { docker: [...sudo, "docker"], eingerichtet: [] };
  }
  const apt = APT;
  const schritte = [
    [...apt, "-o", "APT::Update::Error-Mode=any", "update"],
    [...apt, "install", "-y", "--no-install-recommends", ...PRUEFPLATZ_PAKETE],
    [...sudo, "systemctl", "start", "docker"],
  ];
  const eingerichtet: string[] = [];
  for (const schritt of schritte) {
    await mussGelingen(schritt, "Pruefplatz-Einrichtung", {
      zeitMs: 900_000,
      spiegel: "[kundeninstallation · einrichtung]",
    });
    eingerichtet.push(schritt.join(" "));
  }
  if (!(await dockerErreichbar([...sudo, "docker"]))) {
    throw new Error(
      "Pruefplatz ungeeignet: Docker nach der Einrichtung weiterhin nicht erreichbar.",
    );
  }
  return { docker: [...sudo, "docker"], eingerichtet };
}

/** Werkzeuge, die ausserhalb von Docker gebraucht werden (TLS-Zertifikate, Browser-Vertrauen). */
export async function werkzeugeBereitstellen(zugang: Dockerzugang): Promise<void> {
  const fehlt = async (werkzeug: string): Promise<boolean> =>
    (await fuehreAus(["sh", "-c", `command -v ${werkzeug}`], { zeitMs: 10_000 })).code !== 0;
  if ((await fehlt("certutil")) || (await fehlt("openssl"))) {
    const apt = APT;
    await mussGelingen(
      [...apt, "install", "-y", "--no-install-recommends", "libnss3-tools", "openssl"],
      "Werkzeuge",
      {
        zeitMs: 600_000,
        spiegel: "[kundeninstallation · einrichtung]",
      },
    );
    zugang.eingerichtet.push(`${apt.join(" ")} install -y libnss3-tools openssl`);
  }
  // Der Browser der Strecke: das Chromium, das zur installierten Playwright-Fassung gehoert. Die
  // Systembibliotheken dafuer bringt der Pruefplatz mit (`playwright install-deps chromium`).
  if (!existsSync(chromium.executablePath())) {
    await mussGelingen(["npx", "--no-install", "playwright", "install", "chromium"], "Chromium", {
      zeitMs: 900_000,
      spiegel: "[kundeninstallation · einrichtung]",
    });
    zugang.eingerichtet.push("npx playwright install chromium");
  }
}

// --------------------------------------------------------------------------------------------------
// Der Befund ueber den Platz
// --------------------------------------------------------------------------------------------------

export interface Platzbefund {
  host: string;
  kernel: string;
  betriebssystem: string;
  cpus: number;
  ramGesamtMiB: number;
  ramFreiMiB: number;
  dockerServer: string;
  dockerRoot: string;
  dockerRootFreiKiB: number | null;
  compose: string;
  buildx: string;
  bestandVorher: { container: number; volumes: number; abbilder: number };
}

export async function platzbefund(docker: string[]): Promise<Platzbefund> {
  const os = await fuehreAus(["sh", "-c", '. /etc/os-release 2>/dev/null && echo "$PRETTY_NAME"']);
  const format = await mussGelingen(
    [...docker, "info", "--format", "{{.ServerVersion}}|{{.DockerRootDir}}"],
    "docker info",
  );
  const [server = "", root = ""] = format.trim().split("|");
  const frei = await fuehreAus([...docker.slice(0, -1), "df", "-Pk", root]);
  const freiKiB = Number(frei.stdout.trim().split("\n").at(-1)?.split(/\s+/)[3]);
  const zaehle = async (args: string[]): Promise<number> =>
    (await mussGelingen([...docker, ...args, "-q"], "docker Bestand")).split("\n").filter(Boolean)
      .length;
  return {
    host: hostname(),
    kernel: release(),
    betriebssystem: os.stdout.trim() || process.platform,
    cpus: cpus().length,
    ramGesamtMiB: Math.round(totalmem() / 1048576),
    ramFreiMiB: Math.round(freemem() / 1048576),
    dockerServer: server,
    dockerRoot: root,
    dockerRootFreiKiB: Number.isFinite(freiKiB) ? freiKiB : null,
    compose: (await mussGelingen([...docker, "compose", "version", "--short"], "compose")).trim(),
    buildx: (await fuehreAus([...docker, "buildx", "version"])).stdout.trim() || "nicht vorhanden",
    bestandVorher: {
      container: await zaehle(["ps", "-a"]),
      volumes: await zaehle(["volume", "ls"]),
      abbilder: await zaehle(["images"]),
    },
  };
}

// --------------------------------------------------------------------------------------------------
// TLS: eine eigene Test-CA, ein Serverzertifikat fuer den Instanznamen, Vertrauen fuer Chromium
// --------------------------------------------------------------------------------------------------

export interface Tlsausstattung {
  caPem: string;
  caFingerabdruck: string;
  serverFingerabdruck: string;
  /** Verzeichnis mit `instanz.pem` und `instanz-key.pem` fuer den TLS-Proxy. */
  zertifikatsordner: string;
}

export async function tlsErzeugen(
  ordner: string,
  instanzname: string,
  kennung: string,
): Promise<Tlsausstattung> {
  const o = (datei: string): string => `${ordner}/${datei}`;
  // Der Ordner ist eigener, frischer Bestand dieses Laufs — er existiert vorher NICHT (Runde 1: ohne
  // diese Zeile scheiterte openssl mit „No such file or directory").
  mkdirSync(ordner, { recursive: true, mode: 0o700 });
  await mussGelingen(
    [
      "openssl",
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-days",
      "2",
      "-keyout",
      o("ca-key.pem"),
      "-out",
      o("ca.pem"),
      "-subj",
      `/CN=KLARWERK Pruefplatz-Test-CA ${kennung}`,
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ],
    "Test-CA",
  );
  await mussGelingen(
    [
      "openssl",
      "req",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      o("instanz-key.pem"),
      "-out",
      o("instanz.csr"),
      "-subj",
      `/CN=${instanzname}`,
    ],
    "Serverschluessel",
  );
  writeFileSync(
    o("instanz.ext"),
    [
      `subjectAltName=DNS:${instanzname}`,
      "basicConstraints=CA:FALSE",
      "keyUsage=critical,digitalSignature,keyEncipherment",
      "extendedKeyUsage=serverAuth",
    ].join("\n"),
  );
  await mussGelingen(
    [
      "openssl",
      "x509",
      "-req",
      "-in",
      o("instanz.csr"),
      "-CA",
      o("ca.pem"),
      "-CAkey",
      o("ca-key.pem"),
      "-CAcreateserial",
      "-days",
      "2",
      "-out",
      o("instanz.pem"),
      "-extfile",
      o("instanz.ext"),
    ],
    "Serverzertifikat",
  );
  // Der Proxy-Container liest den Schluessel als anderer Nutzer; der Ordner ist eigener Temp-Bestand.
  chmodSync(o("instanz-key.pem"), 0o644);
  const caPem = readFileSync(o("ca.pem"), "utf8");
  return {
    caPem,
    caFingerabdruck: new X509Certificate(caPem).fingerprint256,
    serverFingerabdruck: new X509Certificate(readFileSync(o("instanz.pem"))).fingerprint256,
    zertifikatsordner: ordner,
  };
}

/**
 * Ein NSS-Zertifikatsspeicher unter `<home>/.pki/nssdb` mit der Test-CA als vertrauenswuerdigem
 * Aussteller — der Ort, an dem Chromium unter Linux lokale Vertrauensanker liest. Ein Browser mit
 * diesem HOME prueft das Serverzertifikat also WIRKLICH gegen die Test-CA.
 */
export async function vertrauenFuerChromium(home: string, caDatei: string): Promise<void> {
  const db = `sql:${home}/.pki/nssdb`;
  mkdirSync(`${home}/.pki/nssdb`, { recursive: true });
  await mussGelingen(["certutil", "-d", db, "-N", "--empty-password"], "NSS-Speicher");
  await mussGelingen(
    ["certutil", "-d", db, "-A", "-t", "C,,", "-n", "KLARWERK Pruefplatz-Test-CA", "-i", caDatei],
    "NSS-Vertrauen",
  );
}

/** GET ueber HTTPS mit Zertifikatspruefung gegen die Test-CA — fuer Readiness und Umleitungsbefunde. */
export function httpsGet(
  instanzname: string,
  pfad: string,
  caPem: string,
  zeitMs = 15_000,
  port = 443,
): Promise<{ status: number; kopf: Record<string, string | string[] | undefined>; text: string }> {
  return new Promise((fertig, scheitere) => {
    const anfrage = request(
      {
        host: "127.0.0.1",
        port,
        path: pfad,
        method: "GET",
        servername: instanzname,
        headers: { host: instanzname },
        ca: caPem,
        rejectUnauthorized: true,
        timeout: zeitMs,
      },
      (antwort) => {
        let text = "";
        antwort.setEncoding("utf8");
        antwort.on("data", (d: string) => {
          text += d;
        });
        antwort.on("end", () =>
          fertig({ status: antwort.statusCode ?? 0, kopf: antwort.headers, text }),
        );
      },
    );
    anfrage.on("timeout", () => anfrage.destroy(new Error("Zeitueberschreitung")));
    anfrage.on("error", scheitere);
    anfrage.end();
  });
}

export async function warte(ms: number): Promise<void> {
  await new Promise((weiter) => setTimeout(weiter, ms));
}
