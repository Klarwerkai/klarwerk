// ================================================================================================
// FE-003 · E8 — GEGENPROBE ZUM PRÜFSTAND: `pruefeKandidat` lehnt jeden falschen Kandidaten ab.
// ================================================================================================
//
// Die beiden Integrationsdateien (`vorschau-weg`, `browser-breiten`) laufen nur auf dem Prüfserver.
// Dass ihre Vorprüfung nicht still grün wird, steht HIER — hermetisch, im Tor: ein Stellvertreter-
// Server beantwortet `/health`, `/api/reasoner/status` und `/fragen` wie der echte
// (`services/app/src/build-app.ts`), und jede Abweichung muss werfen: falscher Commit, falsche
// Version, Modell aktiv, /fragen ohne Oberfläche oder kein Server.
import { type Server, createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { type Stand, erwarteterStand, freierPort, paketVersion, pruefeKandidat } from "./kandidat";

const STAND: Stand = { commit: "a".repeat(40), version: "1.0.0-test" };

interface Lage {
  commit: string;
  version: string;
  aktiv: boolean;
  fragenStatus: number;
  fragenHtml: string;
  healthRoh?: string;
}

const RICHTIG: Lage = {
  commit: STAND.commit,
  version: STAND.version,
  aktiv: false,
  fragenStatus: 200,
  fragenHtml:
    '<!doctype html><div id="root"></div><script type="module" src="/assets/i.js"></script>',
};

let server: Server | undefined;

afterEach(async () => {
  await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  server = undefined;
});

async function stellvertreter(lage: Lage): Promise<string> {
  server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        lage.healthRoh ??
          JSON.stringify({ status: "ok", version: lage.version, commit: lage.commit }),
      );
      return;
    }
    if (req.url === "/api/reasoner/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          lage.aktiv
            ? { active: true, mode: "cloud", reachable: "active" }
            : { active: false, mode: "deterministic", reachable: "none" },
        ),
      );
      return;
    }
    if (req.url === "/fragen") {
      res.writeHead(lage.fragenStatus, { "content-type": "text/html; charset=utf-8" });
      res.end(lage.fragenHtml);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const s = server;
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", () => r()));
  const adresse = s.address();
  if (typeof adresse !== "object" || adresse === null) {
    throw new Error("Stellvertreter ohne Adresse");
  }
  return `http://127.0.0.1:${adresse.port}`;
}

describe("FE-003 E8 · der Prüfstand lehnt jeden falschen Kandidaten ab", () => {
  it("der richtige Kandidat besteht", async () => {
    const befund = await pruefeKandidat(await stellvertreter(RICHTIG), STAND);
    expect(befund.health.commit).toBe(STAND.commit);
    expect(befund.ki).toEqual({ active: false, reachable: "none" });
  });

  it("falscher Commit — die Vorgabe passt nicht zum laufenden Stand", async () => {
    const url = await stellvertreter(RICHTIG);
    await expect(pruefeKandidat(url, { ...STAND, commit: "b".repeat(40) })).rejects.toThrow(
      /commit=a{40}, erwartet b{40}/,
    );
  });

  it("unbekannter Commit (kein KLARWERK_BUILD_COMMIT) gilt nicht als zugeordnet", async () => {
    const url = await stellvertreter({ ...RICHTIG, commit: "unbekannt" });
    await expect(pruefeKandidat(url, STAND)).rejects.toThrow(/commit=unbekannt/);
  });

  it("falsche Version", async () => {
    const url = await stellvertreter({ ...RICHTIG, version: "0.0.1" });
    await expect(pruefeKandidat(url, STAND)).rejects.toThrow(/version=0\.0\.1/);
  });

  it("/health ohne JSON", async () => {
    const url = await stellvertreter({ ...RICHTIG, healthRoh: "ok" });
    await expect(pruefeKandidat(url, STAND)).rejects.toThrow(/kein JSON-Objekt/);
  });

  it("ein aktives Modell", async () => {
    const url = await stellvertreter({ ...RICHTIG, aktiv: true });
    await expect(pruefeKandidat(url, STAND)).rejects.toThrow(/KI aus/);
  });

  it("/fragen ohne 200", async () => {
    const url = await stellvertreter({ ...RICHTIG, fragenStatus: 404 });
    await expect(pruefeKandidat(url, STAND)).rejects.toThrow(/404 statt 200/);
  });

  it("/fragen ohne Oberfläche", async () => {
    const url = await stellvertreter({ ...RICHTIG, fragenHtml: "<html>Wartung</html>" });
    await expect(pruefeKandidat(url, STAND)).rejects.toThrow(/Oberfläche nicht aus/);
  });

  it("kein Server erreichbar", async () => {
    const port = await freierPort();
    await expect(pruefeKandidat(`http://127.0.0.1:${port}`, STAND, 1_000)).rejects.toThrow(
      /nicht erreichbar/,
    );
  });

  it("der erwartete Stand: HEAD und package.json — die Vorgabe überschreibt nur den Commit", () => {
    const vorgabe = "c".repeat(40);
    expect(erwarteterStand({ FE003_ERWARTETER_COMMIT: vorgabe })).toEqual({
      commit: vorgabe,
      version: paketVersion(),
    });
    expect(erwarteterStand({}).commit).toMatch(/^[0-9a-f]{40}$/);
  });
});
