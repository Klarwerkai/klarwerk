// ================================================================================================
// produkt:20261011:peter-p09 · P09-AC06 — AM ECHTEN EINSTIEGSPUNKT: AUSSENAKTIONEN ZUERST GESTOPPT.
// ================================================================================================
//
// `server.ts` als echter Prozess (`node --import tsx`, Speicherbetrieb, keine Produktion), einmal
// mit `KLARWERK_WIEDERANLAUF` und einmal ohne. Gemessen wird die Betriebsausgabe und die Antwort am
// echten Port — nicht ein Aufbau mit `inject`.
//
//   P1  Mit Schalter: die gestoppten Außenaktionen stehen im Protokoll, Lückenerkennung und
//       Wissensereignis-Meldungen starten nicht (obwohl ein gültiges Webhook-Ziel eingetragen ist),
//       und Bibliothek wie Export antworten mit 503 `WIEDERANLAUF`.
//   P2  KALIBRIERUNG ohne Schalter: dieselbe Umgebung startet beide Außenaktionen — ohne diese
//       Gegenrichtung wäre P1 auch dann grün, wenn sie nie liefen.
//   P3  Ein ungültiger Schalterwert bricht den Start ab, statt still normal zu starten.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const GESTOPPT =
  "Außenaktionen gestoppt (wissensereignisse, hintergrundpruefung, lueckenerkennung)";
const LUECKEN_AKTIV = "Lückenerkennung über den Reasoner aktiv";
const MELDUNGEN_AKTIV = "Wissensereignis-Meldungen aktiv";
// Ein gültiges Ziel auf der eigenen Maschine; im Prüflauf wird nichts zugestellt (Grundstand).
const WEBHOOKS = JSON.stringify([
  {
    id: "probe-p09",
    url: "http://127.0.0.1:9/hook",
    ereignisse: ["wissen.validiert"],
    geheimnis: "fiktiv-p09-0123456789abcdef0123456789",
  },
]);

async function freierPort(): Promise<number> {
  return await new Promise((ok, fehler) => {
    const s = createServer();
    s.once("error", fehler);
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => ok(port));
    });
  });
}

function umgebung(port: number, zusatz: Record<string, string>): NodeJS.ProcessEnv {
  return {
    // Das Minimum, ohne das Node startet — keine geerbte DATABASE_URL.
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    KLARWERK_SKIP_KEYCHAIN: "1",
    NODE_ENV: "test",
    PORT: String(port),
    KLARWERK_WEBHOOKS: WEBHOOKS,
    ...zusatz,
  };
}

interface Lauf {
  prozess: ChildProcess;
  ausgabe: () => string;
}

/** Startet den Server und wartet, bis `merkmal` in der Ausgabe steht (oder der Prozess endet). */
async function starte(env: NodeJS.ProcessEnv, merkmal: string): Promise<Lauf> {
  const prozess = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
    cwd: WURZEL,
    env,
    detached: true,
  });
  let text = "";
  prozess.stdout?.on("data", (d) => {
    text += String(d);
  });
  prozess.stderr?.on("data", (d) => {
    text += String(d);
  });
  const ende = Date.now() + 90_000;
  while (!text.includes(merkmal) && prozess.exitCode === null && Date.now() < ende) {
    await new Promise((r) => setTimeout(r, 200));
  }
  // Was nach dem Merkmal im selben Startlauf noch geschrieben wird, kurz abwarten.
  await new Promise((r) => setTimeout(r, 1500));
  return { prozess, ausgabe: () => text };
}

function beende(lauf: Lauf): void {
  if (lauf.prozess.pid && lauf.prozess.exitCode === null) {
    try {
      process.kill(-lauf.prozess.pid, "SIGTERM");
    } catch {
      lauf.prozess.kill("SIGTERM");
    }
  }
}

describe("P09-AC06 · der echte Serverstart im Wiederanlauf", () => {
  it("P1 · mit Schalter: Außenaktionen gestoppt, Bibliothek und Export gesperrt", async () => {
    const port = await freierPort();
    const lauf = await starte(
      umgebung(port, { KLARWERK_WIEDERANLAUF: "probe-p09-server" }),
      "Außenaktionen gestoppt",
    );
    try {
      const text = lauf.ausgabe();
      expect(text, text).toContain(GESTOPPT);
      expect(text).toContain("Wiederanlauf probe-p09-server: Sperre aktiv bis zur Freigabe");
      expect(text).not.toContain(LUECKEN_AKTIV);
      expect(text).not.toContain(MELDUNGEN_AKTIV);

      const basis = `http://127.0.0.1:${port}`;
      expect((await fetch(`${basis}/health`)).status).toBe(200);
      for (const pfad of ["/api/kos", "/api/library/export?format=json"]) {
        const antwort = await fetch(`${basis}${pfad}`);
        expect(antwort.status, pfad).toBe(503);
        expect(await antwort.json()).toMatchObject({
          error: "WIEDERANLAUF",
          wiederanlauf: "probe-p09-server",
        });
      }
    } finally {
      beende(lauf);
    }
  }, 120_000);

  it("P2 · KALIBRIERUNG: ohne Schalter starten dieselben Außenaktionen", async () => {
    const port = await freierPort();
    const lauf = await starte(umgebung(port, {}), MELDUNGEN_AKTIV);
    try {
      const text = lauf.ausgabe();
      expect(text, text).toContain(LUECKEN_AKTIV);
      expect(text).toContain(MELDUNGEN_AKTIV);
      expect(text).not.toContain("Außenaktionen gestoppt");
      const antwort = await fetch(`http://127.0.0.1:${port}/api/kos`);
      expect(antwort.status).toBe(401);
    } finally {
      beende(lauf);
    }
  }, 120_000);

  it("P3 · ein ungültiger Schalterwert bricht den Start ab", () => {
    const ergebnis = spawnSync("node", ["--import", "tsx", "services/app/src/server.ts"], {
      cwd: WURZEL,
      encoding: "utf8",
      timeout: 90_000,
      env: umgebung(1, { KLARWERK_WIEDERANLAUF: "kein gültiger wert" }),
    });
    expect(ergebnis.status, `${ergebnis.stdout}${ergebnis.stderr}`).toBe(1);
    expect(ergebnis.stderr).toMatch(/^Serverstart fehlgeschlagen: /m);
    expect(`${ergebnis.stdout}`).not.toContain("KLARWERK läuft auf");
  }, 120_000);
});
