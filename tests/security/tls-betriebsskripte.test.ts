// R-2057 — die Betriebsskripte für TLS vom Proxy zur Anwendung (scripts/betrieb/, Anleitung
// docs/operations/tls-bis-zur-anwendung.md). Die Skripte laufen auf dem Server; hier wird nur
// geprüft, was ohne Server prüfbar ist: Syntax, Aufrufregel des Nachweises, keine abgeschaltete
// Zertifikatsprüfung, und dass Skripte und Anleitung dieselben Installationswerte nennen.
// Die Messung der Installation selbst ersetzt das nicht.
//
// NACHARBEIT 8 (Ben): N3 wertete jeden Fehler als abgewiesenen Klartext, N5 jeden Verbindungsfehler
// als Zertifikatsablehnung, N6 ignorierte den HTTP-Status. Die beiden unteren Blöcke prüfen das am
// Verhalten: der eingebettete Node-Block des Nachweises läuft WÖRTLICH gegen echte Server, und das
// ganze Skript läuft gegen Ersatzprogramme für `docker` und `curl`, die Werkzeug- und
// Erreichbarkeitsfehler nachstellen. Keiner dieser Fälle darf als bestanden durchgehen.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { testzertifikat } from "./tls-testzertifikat";

const WURZEL = join(__dirname, "..", "..");
const EINRICHTEN = join(WURZEL, "scripts/betrieb/tls-intern-einrichten.sh");
const NACHWEIS = join(WURZEL, "scripts/betrieb/tls-intern-nachweis.sh");
const ANLEITUNG = readFileSync(join(WURZEL, "docs/operations/tls-bis-zur-anwendung.md"), "utf8");

const lies = (pfad: string) => readFileSync(pfad, "utf8");

describe("R-2057 · Betriebsskripte für TLS bis zur Anwendung", () => {
  it("beide Skripte sind syntaktisch gültiges bash", () => {
    for (const skript of [EINRICHTEN, NACHWEIS]) {
      const lauf = spawnSync("bash", ["-n", skript], { encoding: "utf8" });
      expect(lauf.status, `${skript}: ${lauf.stderr}`).toBe(0);
    }
  });

  it("der Nachweis verlangt einen 40-stelligen Commit und bricht sonst vor jeder Messung ab", () => {
    for (const argumente of [[], ["main"], ["1b07f3e"]]) {
      const lauf = spawnSync("bash", [NACHWEIS, ...argumente], { encoding: "utf8" });
      expect(lauf.status, `Argumente ${JSON.stringify(argumente)}`).toBe(2);
      expect(lauf.stderr).toContain("40-stelliger Commit");
    }
  });

  it("keine abgeschaltete Prüfung: die Transportdatei hat rootCAs, nirgends insecureSkipVerify", () => {
    const einrichten = lies(EINRICHTEN);
    expect(einrichten).toContain("rootCAs:");
    expect(einrichten).toContain("serverName: ${SERVERNAME}");
    // Nur der Nachweis darf das Wort nennen — als Probe, dass es NICHT in der Datei steht.
    expect(einrichten).not.toMatch(/insecureSkipVerify/i);
    expect(lies(NACHWEIS)).toContain("! grep -qi 'insecureSkipVerify'");
    expect(lies(NACHWEIS)).not.toContain("rejectUnauthorized");
  });

  it("Skripte und Anleitung nennen dieselben Installationswerte — für BEIDE HTTPS-Dienste", () => {
    // Nacharbeit 9 (Ben): https-0 (klarwerk.ai) und https-1 (app.klarwerk.ai) teilen den App-Port.
    const transport = "klarwerk-intern@file";
    for (const dienst of ["https-0", "https-1"].map((p) => `${p}-b3rgijsv5jtuhreh9ypyjase`)) {
      for (const text of [lies(EINRICHTEN), ANLEITUNG]) {
        expect(text).toContain(`traefik.http.services.${dienst}.loadbalancer.server.scheme=https`);
        expect(text).toContain(
          `traefik.http.services.${dienst}.loadbalancer.serversTransport=${transport}`,
        );
      }
    }
    for (const text of [lies(EINRICHTEN), ANLEITUNG]) {
      expect(text).toContain("KLARWERK_TLS_CERT_FILE=/run/klarwerk-tls/app.pem");
      expect(text).toContain("KLARWERK_TLS_KEY_FILE=/run/klarwerk-tls/app.key");
    }
    const nachweis = lies(NACHWEIS);
    expect(nachweis).toContain('APP_UUID="b3rgijsv5jtuhreh9ypyjase"');
    expect(nachweis).toContain('PFLICHT_DIENSTE="https-0-${APP_UUID} https-1-${APP_UUID}"');
    expect(nachweis).toContain(`TRANSPORT_SOLL="${transport}"`);
    expect(nachweis).toContain(
      'OEFFENTLICH="https://klarwerk.ai/health https://app.klarwerk.ai/health"',
    );
    expect(ANLEITUNG).not.toMatch(/<dienst>|<pfad-im-proxy>|<app-ip>:3000\/health\s+#/);
  });
});

// ------------------------------------------------------------------------------------------------
// Der Node-Block des Nachweises (N3a/N4/N5), wörtlich aus dem Skript, gegen echte Server.
// ------------------------------------------------------------------------------------------------
const SKRIPT = lies(NACHWEIS);
const MARKE = "<<'JS' || true\n";
const PROBE = SKRIPT.slice(
  SKRIPT.indexOf(MARKE) + MARKE.length,
  SKRIPT.indexOf("\nJS\n", SKRIPT.indexOf(MARKE)),
);

interface ProbeErgebnis {
  n3a: { ergebnis: string; grund: string };
  n4: boolean;
  n5: string;
  n5_grund: string;
  mit: { verbunden: boolean; commit?: unknown };
  ohne: { verbunden: boolean; fehler?: string };
}

// Asynchron: die Server laufen in DIESEM Prozess, ein spawnSync hielte sie an.
function probeLauf(port: number, erwartet: string, ca: string): Promise<ProbeErgebnis> {
  return new Promise((fertig, fehler) => {
    const kind = spawn(process.execPath, ["-e", PROBE], {
      env: {
        ...process.env,
        ZIEL_IP: "127.0.0.1",
        ZIEL_PORT: String(port),
        ERWARTET: erwartet,
        KLARWERK_TLS_CA_FILE: ca,
      },
    });
    let aus = "";
    let err = "";
    kind.stdout.on("data", (d) => {
      aus += String(d);
    });
    kind.stderr.on("data", (d) => {
      err += String(d);
    });
    kind.on("error", fehler);
    kind.on("close", () => {
      try {
        fertig(JSON.parse(aus) as ProbeErgebnis);
      } catch {
        fehler(new Error(`Probe ohne JSON: ${aus} ${err}`));
      }
    });
  });
}

function freierGeschlossenerPort(): Promise<number> {
  return new Promise((fertig) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      const port = typeof a === "object" && a ? a.port : 0;
      s.close(() => fertig(port));
    });
  });
}

describe("R-2057 · der Node-Block des Nachweises unterscheidet Ablehnung von Fehler", () => {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-tls-probe-"));
  const z = testzertifikat("klarwerk-app");
  const ca = join(ordner, "ca.pem");
  writeFileSync(ca, z.cert);
  let tlsApp: FastifyInstance | undefined;
  let klarApp: FastifyInstance | undefined;
  let tlsPort = 0;
  let klarPort = 0;

  const portVon = (app: FastifyInstance): number => {
    const a = app.server.address();
    return typeof a === "object" && a ? a.port : 0;
  };

  beforeAll(async () => {
    const t = buildApp(buildServices(), {
      tls: { cert: Buffer.from(z.cert), key: Buffer.from(z.key) },
    });
    tlsApp = t;
    await t.listen({ port: 0, host: "127.0.0.1" });
    tlsPort = portVon(t);
    const k = buildApp(buildServices());
    klarApp = k;
    await k.listen({ port: 0, host: "127.0.0.1" });
    klarPort = portVon(k);
  });

  afterAll(async () => {
    await tlsApp?.close();
    await klarApp?.close();
    rmSync(ordner, { recursive: true, force: true });
  });

  it("TLS-App mit richtigem Commit: N3a abgewiesen, N4 bestanden, N5 als Zertifikatsablehnung", async () => {
    // Erst den Commit erfahren — derselbe Lauf ist die Gegenprobe „falscher Commit".
    const falsch = await probeLauf(tlsPort, "falscher-commit", ca);
    expect(falsch.n4).toBe(false);
    expect(falsch.n5, "N5 darf ohne bestandenes N4 nicht bestehen").toBe("ungeklaert");
    expect(typeof falsch.mit.commit).toBe("string");

    const r = await probeLauf(tlsPort, String(falsch.mit.commit), ca);
    expect(r.n3a.ergebnis, r.n3a.grund).toBe("abgewiesen");
    expect(r.n4).toBe(true);
    expect(r.n5, r.n5_grund).toBe("zertifikat_abgelehnt");
  });

  it("Gegenprobe Klartext-App: N3a meldet angenommenen Klartext, N4 scheitert, N5 bleibt ungeklärt", async () => {
    const r = await probeLauf(klarPort, "egal", ca);
    expect(r.n3a.ergebnis).toBe("klartext_angenommen");
    expect(r.n4).toBe(false);
    expect(r.n5).toBe("ungeklaert");
  });

  it("Gegenprobe geschlossener Port: nichts gilt als Ablehnung", async () => {
    const r = await probeLauf(await freierGeschlossenerPort(), "egal", ca);
    expect(r.n3a.ergebnis, r.n3a.grund).toBe("ungeklaert");
    expect(r.n4).toBe(false);
    expect(r.n5).toBe("ungeklaert");
  });
});

// ------------------------------------------------------------------------------------------------
// Das ganze Skript gegen Ersatzprogramme für `docker` und `curl` (N3b und N6 und das Gesamturteil).
// ------------------------------------------------------------------------------------------------
const SHA = "1b07f3e26cbf7752565b5c75de390ebf9ffae264";

const ERSATZ_DOCKER = `#!/usr/bin/env bash
case "$1" in
  ps) echo "b3rgijsv5jtuhreh9ypyjase-123" ;;
  inspect)
    case "$3" in
      *'range $k'*) printf '%s\\n' "$FAKE_LABELS" ;;
      *NetworkSettings*) echo "10.0.1.10" ;;
      *Config.Image*) echo "b3rgijsv5jtuhreh9ypyjase:$FAKE_SHA" ;;
      *Config.Env*) printf 'KLARWERK_TLS_CERT_FILE=/a\\nKLARWERK_TLS_KEY_FILE=/b\\n' ;;
      *Mounts*) echo "$FAKE_PROXY_WURZEL" ;;
      *loadbalancer.*)
        # Ein Dienstlabel: Vorgabe je Schlüssel, eine Abweichung als FAKE_ABWEICHUNG=dienst:schluessel:wert.
        d="\${3#*traefik.http.services.}"; d="\${d%%.loadbalancer*}"
        k="\${3#*loadbalancer.}"; k="\${k%%\\"*}"
        case "$k" in
          server.port) w="3000" ;;
          server.scheme) w="https" ;;
          serversTransport) w="klarwerk-intern@file" ;;
        esac
        case "\${FAKE_ABWEICHUNG:-}" in "$d:$k:"*) w="\${FAKE_ABWEICHUNG#"$d:$k:"}" ;; esac
        echo "$w" ;;
    esac ;;
  exec)
    shift
    if [ "$1" = "coolify-proxy" ] && [ "$2" = "sh" ]; then exit "\${FAKE_WGET_FEHLT:-0}"; fi
    if [ "$1" = "coolify-proxy" ] && [ "$2" = "wget" ]; then
      printf '%s\\n' "$FAKE_WGET_MELDUNG" >&2
      exit "$FAKE_WGET_EXIT"
    fi
    if [ "$1" = "-i" ]; then export "$3"; exec "$FAKE_NODE" -e "$7"; fi
    printf '%s\\n' "$FAKE_PROBE" ;;
  *) exit 1 ;;
esac
`;

// Je öffentlichem Weg eigene Antwort: klarwerk.ai liest FAKE_CURL_*_0, sonst die gemeinsamen Werte.
const ERSATZ_CURL = `#!/usr/bin/env bash
ziel=""
url=""
while [ $# -gt 0 ]; do
  case "$1" in -o) ziel="$2"; shift 2 ;; *) url="$1"; shift ;; esac
done
status="$FAKE_CURL_STATUS"
body="$FAKE_CURL_BODY"
if [[ "$url" == "https://klarwerk.ai/"* ]]; then
  status="\${FAKE_CURL_STATUS_0:-$FAKE_CURL_STATUS}"
  body="\${FAKE_CURL_BODY_0:-$FAKE_CURL_BODY}"
fi
printf '%s' "$body" >"$ziel"
printf '%s' "$status"
exit "\${FAKE_CURL_EXIT:-0}"
`;

const GUTE_PROBE = JSON.stringify({
  n3a: { ergebnis: "abgewiesen", grund: "ECONNRESET", erste_bytes: "" },
  n4: true,
  n5: "zertifikat_abgelehnt",
  n5_grund: "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  mit: { verbunden: true, status: 200, commit: SHA },
  ohne: { verbunden: false, fehler: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" },
});

const UUID = "b3rgijsv5jtuhreh9ypyjase";
const label = (dienst: string) =>
  `traefik.http.services.${dienst}-${UUID}.loadbalancer.server.port`;

const GUT: Record<string, string> = {
  FAKE_LABELS: [
    `traefik.http.routers.https-0-${UUID}.rule`,
    label("https-0"),
    label("https-1"),
  ].join("\n"),
  FAKE_WGET_EXIT: "1",
  FAKE_WGET_MELDUNG: "wget: error getting response: Connection reset by peer",
  FAKE_PROBE: GUTE_PROBE,
  FAKE_CURL_STATUS: "200",
  FAKE_CURL_BODY: JSON.stringify({ status: "ok", commit: SHA }),
};

describe("R-2057 · das Gesamturteil des Nachweises besteht nur bei echten Ablehnungen", () => {
  const ordner = mkdtempSync(join(tmpdir(), "klarwerk-tls-nachweis-"));
  const bin = join(ordner, "bin");
  const proxy = join(ordner, "proxy");
  mkdirSync(bin);
  mkdirSync(join(proxy, "dynamic"), { recursive: true });
  writeFileSync(join(bin, "docker"), ERSATZ_DOCKER, { mode: 0o755 });
  writeFileSync(join(bin, "curl"), ERSATZ_CURL, { mode: 0o755 });
  writeFileSync(
    join(proxy, "dynamic", "klarwerk-intern.yml"),
    "http:\n  serversTransports:\n    klarwerk-intern:\n      rootCAs:\n        - /traefik/klarwerk-intern/ca.pem\n",
  );

  afterAll(() => rmSync(ordner, { recursive: true, force: true }));

  function nachweis(abweichung: Record<string, string>) {
    const lauf = spawnSync("bash", [NACHWEIS, SHA], {
      encoding: "utf8",
      timeout: 30_000,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        FAKE_SHA: SHA,
        FAKE_PROXY_WURZEL: proxy,
        FAKE_NODE: process.execPath,
        KLARWERK_TLS_NACHWEIS_DIR: join(ordner, "belege"),
        ...GUT,
        ...abweichung,
      },
    });
    let beleg: Record<string, unknown> = {};
    try {
      beleg = JSON.parse(lauf.stdout) as Record<string, unknown>;
    } catch {
      throw new Error(`Beleg ist kein JSON: ${lauf.stdout} ${lauf.stderr}`);
    }
    return { status: lauf.status, beleg };
  }

  it("Kalibrierung: alle Proben echt bestanden → Exit 0, bestanden", () => {
    const { status, beleg } = nachweis({});
    expect(beleg.bestanden).toBe(true);
    expect(status).toBe(0);
    expect(beleg.n3b_proxy).toMatchObject({ ergebnis: "abgewiesen" });
    expect(beleg.n2_labels_ok).toBe(true);
    expect(beleg.n2_dienste).toEqual([
      expect.objectContaining({ dienst: `https-0-${UUID}`, scheme: "https", ok: true }),
      expect.objectContaining({ dienst: `https-1-${UUID}`, scheme: "https", ok: true }),
    ]);
    expect(beleg.n6_ok).toBe(true);
    expect(beleg.n6_oeffentlich).toEqual([
      { url: "https://klarwerk.ai/health", status: "200", commit_passt: true, ok: true },
      { url: "https://app.klarwerk.ai/health", status: "200", commit_passt: true, ok: true },
    ]);
  });

  const faelle: [string, Record<string, string>, (b: Record<string, unknown>) => void][] = [
    [
      "wget fehlt im Proxy",
      { FAKE_WGET_FEHLT: "1" },
      (b) => expect(b.n3b_proxy).toMatchObject({ ergebnis: "ungeklaert" }),
    ],
    [
      "Verbindung verweigert",
      { FAKE_WGET_MELDUNG: "wget: can't connect to remote host: Connection refused" },
      (b) => expect(b.n3b_proxy).toMatchObject({ ergebnis: "ungeklaert" }),
    ],
    [
      "Zeitüberschreitung",
      { FAKE_WGET_MELDUNG: "wget: download timed out" },
      (b) => expect(b.n3b_proxy).toMatchObject({ ergebnis: "ungeklaert" }),
    ],
    [
      "Klartext angenommen",
      { FAKE_WGET_EXIT: "0", FAKE_WGET_MELDUNG: "" },
      (b) => expect(b.n3b_proxy).toMatchObject({ ergebnis: "klartext_angenommen" }),
    ],
    [
      "N3a ungeklärt",
      {
        FAKE_PROBE: GUTE_PROBE.replace(
          '"ergebnis":"abgewiesen","grund":"ECONNRESET"',
          '"ergebnis":"ungeklaert","grund":"keine Verbindung"',
        ),
      },
      (b) => expect(b.n3a_socket).toBe("nicht_abgewiesen_oder_ungeklaert"),
    ],
    [
      "N5 Zeitüberschreitung statt Zertifikatsablehnung",
      {
        FAKE_PROBE: GUTE_PROBE.replace('"n5":"zertifikat_abgelehnt"', '"n5":"ungeklaert"'),
      },
      (b) => expect(b.n5_ohne_anker_zertifikat_abgelehnt).toBe(false),
    ],
    [
      "öffentlich 502 mit passendem Commit im Körper",
      { FAKE_CURL_STATUS: "502" },
      (b) => expect(b.n6_oeffentlich).toContainEqual(expect.objectContaining({ status: "502" })),
    ],
    [
      "öffentlich 200 mit anderem Commit",
      { FAKE_CURL_BODY: JSON.stringify({ status: "ok", commit: "f".repeat(40) }) },
      (b) => expect(b.n6_ok).toBe(false),
    ],
    [
      "öffentlich nicht erreichbar",
      { FAKE_CURL_STATUS: "000", FAKE_CURL_BODY: "", FAKE_CURL_EXIT: "7" },
      (b) => expect(b.n6_oeffentlich).toContainEqual(expect.objectContaining({ status: "000" })),
    ],
    // Nacharbeit 9 (Ben): ein fehlerhafter ZWEITER Zugang lässt den Gesamtnachweis scheitern.
    [
      "nur klarwerk.ai antwortet 502, app.klarwerk.ai ist in Ordnung",
      { FAKE_CURL_STATUS_0: "502" },
      (b) =>
        expect(b.n6_oeffentlich).toEqual([
          expect.objectContaining({ url: "https://klarwerk.ai/health", status: "502", ok: false }),
          expect.objectContaining({ url: "https://app.klarwerk.ai/health", ok: true }),
        ]),
    ],
    [
      "https-0 ohne scheme=https",
      { FAKE_ABWEICHUNG: `https-0-${UUID}:server.scheme:` },
      (b) =>
        expect(b.n2_dienste).toContainEqual(
          expect.objectContaining({ dienst: `https-0-${UUID}`, ok: false }),
        ),
    ],
    [
      "https-0 ohne serversTransport",
      { FAKE_ABWEICHUNG: `https-0-${UUID}:serversTransport:` },
      (b) => expect(b.n2_labels_ok).toBe(false),
    ],
    [
      "https-0 fehlt in den Labels",
      { FAKE_LABELS: label("https-1") },
      (b) =>
        expect(b.n2_dienste).toContainEqual(
          expect.objectContaining({ dienst: `https-0-${UUID}`, fehlt: true }),
        ),
    ],
    [
      "ein weiterer Dienst ohne TLS",
      {
        FAKE_LABELS: [label("https-0"), label("https-1"), label("http-0")].join("\n"),
        FAKE_ABWEICHUNG: `http-0-${UUID}:server.scheme:http`,
      },
      (b) =>
        expect(b.n2_dienste).toContainEqual(
          expect.objectContaining({ dienst: `http-0-${UUID}`, scheme: "http", ok: false }),
        ),
    ],
  ];

  for (const [name, abweichung, pruefe] of faelle) {
    it(`Gegenprobe ${name} → nicht bestanden, Exit ≠ 0`, () => {
      const { status, beleg } = nachweis(abweichung);
      pruefe(beleg);
      expect(beleg.bestanden).toBe(false);
      expect(status).not.toBe(0);
    });
  }
});
