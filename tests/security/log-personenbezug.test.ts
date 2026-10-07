import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { LOG_LEVEL_ENV, buildApp, buildServices } from "../../services/app/src/build-app";
import { istPersonenFeld, sanitizeLogText } from "../../services/app/src/log-sanitize";

// ================================================================================================
// R-0664 (DS20) · PERSONENBEZUG UND LÖSCHGRENZE DER SERVER-PROTOKOLLE
// R-1140 · NACHPRÜFUNG: TRÄGT DIE EINGEBAUTE FASSUNG SENKE UND STUFENSCHALTER?
// ================================================================================================
//
// Der Ausgangsbefund (Landkarte v3, Zeile DS20): „die Log-Saeuberung deckt heute nur Geheimnisse".
// `tests/security/log-keine-inhalte.test.ts` zeigt dasselbe an der Gegenprobe — der Sanitizer liess
// Adresse, Name und Befund durch. Diese Datei misst die beiden Personenregeln, die Feldentfernung in
// der Senke und die Mengengrenze im Ein-Befehl-Weg. Gemessen wird am ECHTEN Logger von `buildApp`,
// nicht nur an der Funktion.
//
// Der zweite Block ist die von R-1140 offen gelassene Nachprüfung: die Stufe kommt im Betrieb aus
// `KLARWERK_LOG_LEVEL` — bisher war nur die Testoption `stufe` gemessen, nicht die Variable.

const ADRESSE = "anna.meier@klinik-nord.de";

function logPuffer() {
  const stuecke: string[] = [];
  return {
    senke: {
      write(zeile: string): void {
        stuecke.push(zeile);
      },
    },
    zeilen: (): Record<string, unknown>[] =>
      stuecke
        .join("")
        .split("\n")
        .filter((z) => z.trim().length > 0)
        .map((z) => JSON.parse(z) as Record<string, unknown>),
    roh: () => stuecke.join(""),
  };
}

const vorher = process.env[LOG_LEVEL_ENV];
afterEach(() => {
  if (vorher === undefined) {
    delete process.env[LOG_LEVEL_ENV];
  } else {
    process.env[LOG_LEVEL_ENV] = vorher;
  }
  delete process.env.KLARWERK_PRUEF_TOKEN;
});

describe("R-0664 · Personenmuster in der Logsenke", () => {
  it("P1: eine E-Mail-Adresse fällt aus dem Text — auch mit langem lokalem Teil ohne Domänenrest", () => {
    expect(sanitizeLogText(`Zustellung an ${ADRESSE} abgelehnt`, {})).toBe(
      "Zustellung an [redacted] abgelehnt",
    );
    const lang = "vorname.nachname.abteilung.standort@klinik-nord.de";
    const gereinigt = sanitizeLogText(`an ${lang}`, {});
    expect(gereinigt).not.toContain("klinik-nord.de");
    expect(gereinigt).not.toContain("@");
  });

  it("P2: ausgewiesene Namen fallen weg, das Etikett bleibt lesbar", () => {
    expect(sanitizeLogText("Name: Anna Meier, Rolle: admin", {})).toBe(
      "Name: [redacted], Rolle: admin",
    );
    expect(sanitizeLogText("vorname=Anna nachname=Meier", {})).toBe(
      "vorname=[redacted] nachname=[redacted]",
    );
    expect(sanitizeLogText('Autor: "A. Meier" gespeichert', {})).toBe(
      "Autor: [redacted] gespeichert",
    );
    expect(sanitizeLogText("Empfänger: Bert Schulz", {})).toBe("Empfänger: [redacted]");
  });

  it("keine Überredaktion: Dateiname, Hostname, Domänencodes und gewöhnliche Sätze bleiben", () => {
    for (const satz of [
      "Dateiname: bericht.pdf",
      "Hostname: db-demo.intern",
      "Postgres — Wirt db-demo.intern, Datenbank klarwerk_demo",
      "Confluence-Import fehlgeschlagen.",
      "Interner Betriebsfehler maskiert",
    ]) {
      expect(sanitizeLogText(satz, {}), satz).toBe(satz);
    }
  });

  it("idempotent: ein zweiter Durchlauf ändert nichts mehr", () => {
    const einmal = sanitizeLogText(`Name: Anna Meier an ${ADRESSE} via https://u:p@h/x`, {});
    expect(sanitizeLogText(einmal, {})).toBe(einmal);
  });

  it("Feldnamen, die eine Person benennen, werden in jeder Schreibweise erkannt", () => {
    for (const feld of [
      "name",
      "displayName",
      "display_name",
      "E-Mail",
      "email",
      "Autor",
      "empfaenger",
    ]) {
      expect(istPersonenFeld(feld), feld).toBe(true);
    }
    for (const feld of ["id", "nutzerId", "dateiname", "code", "pfad", "traceId"]) {
      expect(istPersonenFeld(feld), feld).toBe(false);
    }
  });

  it("am ECHTEN Logger: Personenfelder fallen in jeder Tiefe weg, Kennungen bleiben", async () => {
    const puffer = logPuffer();
    const app = buildApp(buildServices(), { log: { senke: puffer.senke, stufe: "info" } });
    app.log.warn(
      {
        autor: "Anna Meier",
        nutzer: { id: "u-4711", name: "Anna Meier", email: ADRESSE },
        vorgang: "zustellung",
      },
      `Zustellung an ${ADRESSE} gescheitert — Name: Anna Meier`,
    );
    const zeile = puffer.zeilen().find((z) => z.vorgang === "zustellung");
    expect(zeile, "die Logzeile fehlt").toBeDefined();
    expect(Object.keys(zeile ?? {})).not.toContain("autor");
    expect(zeile?.nutzer).toEqual({ id: "u-4711" });
    expect(String(zeile?.msg)).toBe("Zustellung an [redacted] gescheitert — Name: [redacted]");
    expect(puffer.roh()).not.toContain("Meier");
    expect(puffer.roh()).not.toContain(ADRESSE);
    await app.close();
  });
});

describe("R-0664 · Löschgrenze der Server-Protokolle im Ein-Befehl-Weg", () => {
  // Strukturiert gelesen: der `logging:`-Block des Dienstes `app`, Kommentarzeilen ausgenommen.
  function loggingBlock(inhalt: string, dienst: string): string[] {
    const zeilen: string[] = [];
    let imDienst = false;
    let imBlock = false;
    for (const zeile of inhalt.split("\n")) {
      if (zeile.trimStart().startsWith("#")) {
        continue;
      }
      if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(zeile)) {
        imDienst = zeile.trim() === `${dienst}:`;
        imBlock = false;
        continue;
      }
      if (/^\S/.test(zeile)) {
        imDienst = false;
        imBlock = false;
        continue;
      }
      if (imDienst && /^ {4}[A-Za-z0-9_-]+:/.test(zeile)) {
        imBlock = zeile.trim() === "logging:";
        continue;
      }
      if (imDienst && imBlock && zeile.trim().length > 0) {
        zeilen.push(zeile.trim());
      }
    }
    return zeilen;
  }

  it("der App-Dienst rotiert seine Protokolle begrenzt — die älteste Datei wird gelöscht", () => {
    const block = loggingBlock(readFileSync("docker-compose.prod.yml", "utf8"), "app");
    expect(block, "kein logging-Block am Dienst app — die Protokolle wüchsen unbegrenzt").toContain(
      "driver: json-file",
    );
    expect(block).toContain('max-size: "10m"');
    expect(block).toContain('max-file: "5"');
  });

  it("Kalibrierung: ohne den Block findet die Regel nichts", () => {
    const ohne = ["services:", "  app:", "    ports:", '      - "3001:3001"', ""].join("\n");
    expect(loggingBlock(ohne, "app")).toEqual([]);
  });
});

describe("R-1140 · Nachprüfung: Senke und Stufenschalter tragen im Betriebsweg", () => {
  it("die Stufe kommt aus KLARWERK_LOG_LEVEL: auf `warn` fällt `info` weg, `warn` steht da", async () => {
    process.env[LOG_LEVEL_ENV] = "warn";
    const puffer = logPuffer();
    // Ohne `stufe` — genau wie `server.ts` den Logger im Betrieb baut.
    const app = buildApp(buildServices(), { log: { senke: puffer.senke } });
    app.log.info({ probe: "info-zeile" }, "Probe info");
    app.log.warn({ probe: "warn-zeile" }, "Probe warn");
    const proben = puffer.zeilen().map((z) => z.probe);
    expect(proben).not.toContain("info-zeile");
    expect(proben).toContain("warn-zeile");
    await app.close();
  });

  it("Gegenprobe: dieselbe App auf `info` schreibt beide Zeilen", async () => {
    process.env[LOG_LEVEL_ENV] = "info";
    const puffer = logPuffer();
    const app = buildApp(buildServices(), { log: { senke: puffer.senke } });
    app.log.info({ probe: "info-zeile" }, "Probe info");
    app.log.warn({ probe: "warn-zeile" }, "Probe warn");
    const proben = puffer.zeilen().map((z) => z.probe);
    expect(proben).toEqual(expect.arrayContaining(["info-zeile", "warn-zeile"]));
    await app.close();
  });

  it("die Senke am Betriebslogger entfernt Geheimnisformen und Werte secret-benannter Variablen", async () => {
    process.env[LOG_LEVEL_ENV] = "info";
    // Synthetischer Wert — kein echtes Geheimnis.
    process.env.KLARWERK_PRUEF_TOKEN = "pruefwert-r1140-xyz";
    const puffer = logPuffer();
    const app = buildApp(buildServices(), { log: { senke: puffer.senke } });
    app.log.warn(
      { probe: "senke", detail: "Antwort mit pruefwert-r1140-xyz" },
      "Aufruf mit Authorization: Bearer abcdefgh12345678 an https://svc:hunter2@host/api",
    );
    const zeile = puffer.zeilen().find((z) => z.probe === "senke");
    expect(zeile).toBeDefined();
    expect(puffer.roh()).not.toContain("pruefwert-r1140-xyz");
    expect(puffer.roh()).not.toContain("abcdefgh12345678");
    expect(puffer.roh()).not.toContain("hunter2");
    expect(String(zeile?.msg)).toContain("Bearer [redacted]");
    await app.close();
  });
});
