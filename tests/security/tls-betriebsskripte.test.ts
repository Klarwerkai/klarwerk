// R-2057 — die Betriebsskripte für TLS vom Proxy zur Anwendung (scripts/betrieb/, Anleitung
// docs/operations/tls-bis-zur-anwendung.md). Die Skripte laufen auf dem Server; hier wird nur
// geprüft, was ohne Server prüfbar ist: Syntax, Aufrufregel des Nachweises, keine abgeschaltete
// Zertifikatsprüfung, und dass Skripte und Anleitung dieselben Installationswerte nennen.
// Die Messung der Installation selbst ersetzt das nicht.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it("Skripte und Anleitung nennen dieselben Installationswerte", () => {
    const dienst = "https-1-b3rgijsv5jtuhreh9ypyjase";
    const transport = "klarwerk-intern@file";
    for (const text of [lies(EINRICHTEN), ANLEITUNG]) {
      expect(text).toContain(`traefik.http.services.${dienst}.loadbalancer.server.scheme=https`);
      expect(text).toContain(
        `traefik.http.services.${dienst}.loadbalancer.serversTransport=${transport}`,
      );
      expect(text).toContain("KLARWERK_TLS_CERT_FILE=/run/klarwerk-tls/app.pem");
      expect(text).toContain("KLARWERK_TLS_KEY_FILE=/run/klarwerk-tls/app.key");
    }
    const nachweis = lies(NACHWEIS);
    expect(nachweis).toContain('APP_UUID="b3rgijsv5jtuhreh9ypyjase"');
    expect(nachweis).toContain(`[ "$TRANSPORT" = "${transport}" ]`);
    expect(ANLEITUNG).not.toMatch(/<dienst>|<pfad-im-proxy>|<app-ip>:3000\/health\s+#/);
  });
});
