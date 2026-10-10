// AW-12 — REFERENZBEREITSTELLUNG DES INTERNEN KERNS UND FASSUNGSGEBUNDENER MODELLBESTAND.
//
// Befund aus der Prüfung (Ben, Kandidat af4e3fa6): kein bereitgestellter Referenzkern, kein an
// Fassungen und Lizenzbelege gebundener Modellbestand. Gemessen wird hier:
//   · `scripts/betrieb/modellbestand-erfassen.mjs` als eigener Prozess gegen einen echten HTTP-Server
//     auf 127.0.0.1, der die Ollama-Schnittstelle (`/api/version`, `/api/tags`, `/api/show`,
//     `/api/embed`) nachbildet: Digest, Lizenzbeleg, Einbettungsprobe, Fehlfälle, Weiterleitung;
//   · `scripts/deploy/compose-intern.yml`: Modellserver nur am internen Netz, App nur an ihm,
//     Pflichtfassungen ohne `latest`.
// GRENZE: Hier läuft kein echtes Modell. Der Bestand eines echten Rechners entsteht erst, wenn das
// Werkzeug dort gegen den echten Server läuft (Abnahme S07).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { fahreNode } from "./hilfen";

const WERKZEUG = repoPfad("scripts/betrieb/modellbestand-erfassen.mjs");
const LIZENZ = "Apache License\nVersion 2.0, January 2004";
const DIGEST_SPRACHE = "a".repeat(64);
const DIGEST_EMBED = "b".repeat(64);

interface Bestand {
  laufzeit: { version: string | null };
  modelle: {
    rolle: string;
    name: string;
    vorhanden: boolean;
    digest?: string | null;
    quantisierung?: string | null;
    lizenz?: { sha256: string; ersteZeile: string } | null;
  }[];
  embeddingProbe: { erwartet: number; geliefert: number | null; gleich: boolean } | null;
  fehler: string[];
}

interface Optionen {
  modelle?: string[];
  lizenzFuer?: string[];
  dim?: number;
}

const offen: Server[] = [];
afterEach(async () => {
  await Promise.all(offen.splice(0).map((s) => new Promise<void>((zu) => s.close(() => zu()))));
});

async function lausche(server: Server): Promise<string> {
  offen.push(server);
  await new Promise<void>((bereit) => server.listen(0, "127.0.0.1", () => bereit()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Bildet die Ollama-Schnittstelle nach, soweit das Werkzeug sie fragt. */
async function ollama(o: Optionen = {}): Promise<string> {
  const modelle = o.modelle ?? ["qwen3:32b", "bge-m3"];
  const lizenzFuer = o.lizenzFuer ?? modelle;
  const server = createServer((anfrage, rueckgabe) => {
    let text = "";
    anfrage.on("data", (stueck) => {
      text += String(stueck);
    });
    anfrage.on("end", () => {
      const rumpf = text ? (JSON.parse(text) as { model?: string }) : {};
      rueckgabe.setHeader("content-type", "application/json");
      const antworten: Record<string, unknown> = {
        "/api/version": { version: "0.0.0-probe" },
        "/api/tags": {
          models: modelle.map((name) => ({
            name,
            model: name,
            digest: name === "bge-m3" ? DIGEST_EMBED : DIGEST_SPRACHE,
            size: 1000,
            details: { family: "probe", parameter_size: "1B", quantization_level: "Q4_K_M" },
          })),
        },
        "/api/show": { license: lizenzFuer.includes(rumpf.model ?? "") ? LIZENZ : "" },
        "/api/embed": { embeddings: [new Array<number>(o.dim ?? 1024).fill(0.5)] },
      };
      rueckgabe.end(JSON.stringify(antworten[anfrage.url ?? ""] ?? {}));
    });
  });
  return lausche(server);
}

async function erfasse(basis: string, ...extra: string[]) {
  const args = [WERKZEUG, basis, "--sprachmodell", "qwen3:32b", "--embedding", "bge-m3"];
  const lauf = await fahreNode([...args, "--dim", "1024", ...extra]);
  return { lauf, bestand: lauf.stdout ? (JSON.parse(lauf.stdout) as Bestand) : undefined };
}

describe("AW-12 · fassungsgebundener Modellbestand", () => {
  it("B1 · vollständig: Laufzeit, Digest, Lizenzbeleg, Einbettungsprobe — Exit 0", async () => {
    const { lauf, bestand } = await erfasse(await ollama());
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(bestand?.laufzeit.version).toBe("0.0.0-probe");
    const sha = createHash("sha256").update(LIZENZ, "utf8").digest("hex");
    expect(bestand?.modelle.map((m) => [m.rolle, m.name, m.digest, m.lizenz?.sha256])).toEqual([
      ["sprachmodell", "qwen3:32b", DIGEST_SPRACHE, sha],
      ["embedding", "bge-m3", DIGEST_EMBED, sha],
    ]);
    expect(bestand?.modelle[0]?.lizenz?.ersteZeile).toBe("Apache License");
    expect(bestand?.modelle[0]?.quantisierung).toBe("Q4_K_M");
    expect(bestand?.embeddingProbe).toEqual({ erwartet: 1024, geliefert: 1024, gleich: true });
    expect(bestand?.fehler).toEqual([]);
  });

  it("B2 · fehlendes Gewicht und fehlender Lizenztext werden benannt — Exit 1", async () => {
    const basis = await ollama({ modelle: ["qwen3:32b"], lizenzFuer: [] });
    const { lauf, bestand } = await erfasse(basis);
    expect(lauf.code).toBe(1);
    const fehler = bestand?.fehler.join("\n") ?? "";
    expect(fehler).toContain('embedding „bge-m3" ist auf dem Server nicht vorhanden');
    expect(fehler).toContain('„qwen3:32b" bringt keinen Lizenztext mit');
    expect(bestand?.modelle[0]?.lizenz).toBeNull();
    expect(bestand?.embeddingProbe).toBeNull();
  });

  it("B3 · falsche Dimension des Embedding-Modells — Exit 1", async () => {
    const { lauf, bestand } = await erfasse(await ollama({ dim: 768 }));
    expect(lauf.code).toBe(1);
    expect(bestand?.embeddingProbe).toEqual({ erwartet: 1024, geliefert: 768, gleich: false });
  });

  it("B4 · keine interne Adresse: Abbruch vor jeder Anfrage — Exit 2", async () => {
    const { lauf } = await erfasse("https://modelle.example");
    expect(lauf.code).toBe(2);
    expect(lauf.stderr).toContain("keine interne Adresse");
    expect(lauf.stdout).toBe("");
  });

  it("B5 · einer Weiterleitung wird nicht gefolgt", async () => {
    let beimZiel = 0;
    const ziel = await lausche(
      createServer((_a, r) => {
        beimZiel += 1;
        r.end("{}");
      }),
    );
    const umleiter = await lausche(
      createServer((_a, r) => {
        r.statusCode = 307;
        r.setHeader("location", `${ziel}/api/version`);
        r.end();
      }),
    );
    const { lauf, bestand } = await erfasse(umleiter);
    expect(lauf.code).toBe(1);
    expect(bestand?.fehler.join(" ")).toContain("Laufzeit nicht erreichbar");
    expect(beimZiel).toBe(0);
  });
});

describe("AW-12 · Referenzbereitstellung compose-intern.yml", () => {
  const yml = readFileSync(repoPfad("scripts/deploy/compose-intern.yml"), "utf8");

  function block(kopf: RegExp): string {
    const zeilen = yml.split("\n");
    const start = zeilen.findIndex((z) => kopf.test(z));
    expect(start, String(kopf)).toBeGreaterThan(-1);
    const einrueckung = (zeilen[start] ?? "").search(/\S/);
    const rest = zeilen.slice(start + 1);
    const ende = rest.findIndex((z) => z.trim() !== "" && z.search(/\S/) <= einrueckung);
    return (ende === -1 ? rest : rest.slice(0, ende)).join("\n");
  }

  it("R1 · der Modellserver hängt nur am internen Netz, und das Netz ist intern", () => {
    const modell = block(/^ {2}modell:\s*$/);
    expect(modell).toMatch(/^ {4}networks:\s*\n {6}- intern\s*$/m);
    expect(modell).not.toMatch(/- default/);
    expect(modell).not.toMatch(/ports:/);
    expect(block(/^ {2}intern:\s*$/)).toMatch(/^ {4}internal: true$/m);
  });

  it("R2 · die App spricht nur den internen Modellserver an, für Sprache und Einbettung", () => {
    const app = block(/^ {2}app:\s*$/);
    expect(app).toContain("KLARWERK_LOCAL_LLM_URL: http://modell:11434/v1");
    expect(app).toContain("KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS: http://modell:11434");
    expect(app).toContain("KLARWERK_EMBEDDING_PROVIDER: local");
    expect(app).toMatch(/- intern/);
  });

  it("R3 · Fassungen sind Pflicht, ohne stille Vorgabe und ohne latest", () => {
    for (const name of [
      "KLARWERK_OLLAMA_IMAGE",
      "KLARWERK_MODELLE_DIR",
      "KLARWERK_LOCAL_LLM_MODEL",
      "KLARWERK_LOCAL_EMBEDDING_MODEL",
      "KLARWERK_EMBEDDING_DIM",
    ]) {
      expect(yml, name).toContain(`\${${name}:?`);
    }
    expect(yml).not.toMatch(/:latest\b/);
    expect(yml).not.toMatch(/:-/);
  });
});
