import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  ERR_TEXT_UNTERDRUECKT,
  ERR_UNBEKANNT,
  LOG_LEVEL_ENV,
  SENKE_NICHT_EINFACH,
  SENKE_ZU_TIEF,
  buildApp,
  buildServices,
  senkeUeberWert,
} from "../../services/app/src/build-app";
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

  // Ben, Nacharbeit 3: an der Tiefengrenze gab die Senke den Teilbaum ungefiltert zurück — ein
  // `name` in sechster Verschachtelung stand unverändert im Protokoll.
  function verschachtelt(tiefe: number, innen: Record<string, unknown>): Record<string, unknown> {
    let wert: Record<string, unknown> = innen;
    for (let i = 0; i < tiefe; i++) {
      wert = { ebene: wert };
    }
    return wert;
  }

  it("Tiefengrenze: ein Personenfeld in jeder Tiefe erreicht das Protokoll nicht", () => {
    for (let tiefe = 0; tiefe <= 10; tiefe++) {
      const bereinigt = JSON.stringify(
        senkeUeberWert(verschachtelt(tiefe, { name: "Anna Meier", email: ADRESSE }), {}),
      );
      expect(bereinigt, `Tiefe ${tiefe}`).not.toContain("Meier");
      expect(bereinigt, `Tiefe ${tiefe}`).not.toContain(ADRESSE);
    }
    // Auch ein Array als Träger und ein Array AN der Grenze.
    const imArray = senkeUeberWert(verschachtelt(5, { liste: [{ name: "Anna Meier" }] }), {});
    expect(JSON.stringify(imArray)).not.toContain("Meier");
  });

  it("Tiefengrenze: unterhalb der Grenze bleibt alles lesbar, an ihr steht ein fester Wert", () => {
    // Fünf Ebenen über dem Blatt: das innere Objekt liegt auf Tiefe 5 und wird noch geprüft.
    const flach = senkeUeberWert(verschachtelt(5, { id: "u-4711", name: "Anna Meier" }), {});
    expect(JSON.stringify(flach)).toContain("u-4711");
    expect(JSON.stringify(flach)).not.toContain(SENKE_ZU_TIEF);
    // Eine Ebene mehr: das Objekt auf Tiefe 6 wird nicht mehr durchsucht und deshalb ersetzt.
    const tief = senkeUeberWert(verschachtelt(6, { id: "u-4711", name: "Anna Meier" }), {});
    expect(JSON.stringify(tief)).toContain(SENKE_ZU_TIEF);
    expect(JSON.stringify(tief)).not.toContain("u-4711");
  });

  it("Tiefengrenze: ein zyklisches Objekt hält den Logger nicht fest", () => {
    const zyklisch: Record<string, unknown> = { id: "z-1", name: "Anna Meier" };
    zyklisch.selbst = zyklisch;
    const bereinigt = JSON.stringify(senkeUeberWert(zyklisch, {}));
    expect(bereinigt).toContain(SENKE_ZU_TIEF);
    expect(bereinigt).not.toContain("Meier");
  });

  // Ben, Nacharbeit 4: nicht einfache Objekte gab die Senke unverändert zurück — eine
  // Klasseninstanz mit eigenen Feldern `name`/`email` lief an der Personenfeldprüfung vorbei.
  class Kontakt {
    name = "Anna Meier";
    email = ADRESSE;
    id = "k-1";
  }

  it("Klasseninstanz: in jeder Tiefe durch den festen Wert ersetzt, nie durchgereicht", () => {
    for (const traeger of [
      { kontakt: new Kontakt() },
      { liste: [new Kontakt()] },
      { a: { b: { kontakt: new Kontakt() } } },
      { karte: new Map([["name", "Anna Meier"]]) },
    ]) {
      const bereinigt = JSON.stringify(senkeUeberWert(traeger, {}));
      expect(bereinigt).not.toContain("Meier");
      expect(bereinigt).not.toContain(ADRESSE);
      expect(bereinigt).toContain(SENKE_NICHT_EINFACH);
    }
    // Auch als ganzes Logargument.
    expect(senkeUeberWert(new Kontakt(), {})).toBe(SENKE_NICHT_EINFACH);
  });

  it("Fehler ausserhalb von `err`: dieselbe strukturierte Form, kein Text, kein eigenes Namensfeld", () => {
    class Boshaft extends Error {
      override name = `Zustellfehler ${ADRESSE}`;
      kontakt = "Anna Meier";
    }
    const bereinigt = senkeUeberWert({ ursache: new Boshaft(`an ${ADRESSE}`) }, {}) as {
      ursache: Record<string, unknown>;
    };
    expect(Object.keys(bereinigt.ursache).sort()).toEqual([
      "code",
      "herkunft",
      "message",
      "stack",
      "type",
    ]);
    expect(bereinigt.ursache.type).toBe(ERR_UNBEKANNT);
    expect(bereinigt.ursache.message).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(JSON.stringify(bereinigt)).not.toContain("Meier");
    expect(JSON.stringify(bereinigt)).not.toContain(ADRESSE);
  });

  it("Gegenprobe: ein Datum bleibt als ISO-Angabe lesbar", () => {
    const zeit = new Date("2026-10-08T12:00:00.000Z");
    expect(senkeUeberWert({ zeit }, {})).toEqual({ zeit: "2026-10-08T12:00:00.000Z" });
  });

  it("am ECHTEN Logger: Klasseninstanz ersetzt, `err` und `req` laufen weiter durch ihre Serializer", async () => {
    const puffer = logPuffer();
    const app = buildApp(buildServices(), { log: { senke: puffer.senke, stufe: "info" } });
    const fehler = new Error(`Zustellung an ${ADRESSE}`) as Error & { code?: string };
    fehler.code = "NOT_FOUND";
    app.log.warn(
      {
        probe: "klasse",
        kontakt: new Kontakt(),
        err: fehler,
        req: { method: "GET", url: "/api/x?email=anna" },
      },
      "Probe Klasseninstanz",
    );
    const zeile = puffer.zeilen().find((z) => z.probe === "klasse");
    expect(zeile, "die Logzeile fehlt").toBeDefined();
    expect(zeile?.kontakt).toBe(SENKE_NICHT_EINFACH);
    // Der err-Serializer hat den Fehler bekommen — nicht die Senke, nicht der feste Wert.
    const err = zeile?.err as Record<string, unknown>;
    expect(err.type).toBe("Error");
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe(ERR_TEXT_UNTERDRUECKT);
    expect(zeile?.req).toEqual({ methode: "GET", pfad: "/api/x" });
    expect(puffer.roh()).not.toContain("Meier");
    expect(puffer.roh()).not.toContain(ADRESSE);
    await app.close();
  });

  it("am ECHTEN Logger: ein tief verschachteltes Personenfeld steht nicht in der Zeile", async () => {
    const puffer = logPuffer();
    const app = buildApp(buildServices(), { log: { senke: puffer.senke, stufe: "info" } });
    app.log.warn(
      { probe: "tief", nutzlast: verschachtelt(8, { name: "Anna Meier", email: ADRESSE }) },
      "Probe tief",
    );
    expect(
      puffer.zeilen().some((z) => z.probe === "tief"),
      "die Logzeile fehlt",
    ).toBe(true);
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
