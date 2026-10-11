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

// Kennzeichen für „Feld weglassen" in den Fehlfällen (JSON kennt kein undefined als Wert).
const WEG = Symbol("weglassen");

interface Optionen {
  modelle?: string[];
  lizenzFuer?: string[];
  dim?: number;
  version?: unknown;
  digests?: Record<string, unknown>;
  latestTag?: boolean;
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
      const version = "version" in o ? o.version : "0.0.0-probe";
      const antworten: Record<string, unknown> = {
        "/api/version": version === WEG ? {} : { version },
        "/api/tags": {
          models: modelle.map((name) => {
            const vorgabe = name === "bge-m3" ? DIGEST_EMBED : DIGEST_SPRACHE;
            const digest = o.digests && name in o.digests ? o.digests[name] : vorgabe;
            // Wie Ollama: ein ohne Tag geladenes Gewicht steht als `<name>:latest` in der Liste.
            const gelistet = o.latestTag && !name.includes(":") ? `${name}:latest` : name;
            return {
              name: gelistet,
              model: gelistet,
              ...(digest === WEG ? {} : { digest }),
              size: 1000,
              details: { family: "probe", parameter_size: "1B", quantization_level: "Q4_K_M" },
            };
          }),
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

  // Ben, Kandidat aa1b1679 (HILFE/f0e46293…/PROBE-MODELLBESTAND.json): diese neun Fälle lieferten
  // Exit 0 und fehler=[]. Eine Fassung ohne gültige Fassungsangabe ist kein vollständiger Bestand.
  const VERSIONSFAELLE: [string, unknown][] = [
    ["laufzeit-version-fehlt", WEG],
    ["laufzeit-version-leer", ""],
    ["laufzeit-version-leerzeichen", "   "],
    ["laufzeit-version-falscher-typ", 17],
  ];
  for (const [fall, version] of VERSIONSFAELLE) {
    it(`B6 · ${fall}: Exit 1 mit zugeordnetem Fehler`, async () => {
      const { lauf, bestand } = await erfasse(await ollama({ version }));
      expect(lauf.code).toBe(1);
      expect(bestand?.laufzeit.version).toBeNull();
      expect(bestand?.fehler.join("\n")).toContain("Laufzeitversion fehlt oder ist ungültig");
    });
  }

  const DIGESTFAELLE: [string, string, unknown][] = [
    ["sprachmodell-digest-fehlt", "qwen3:32b", WEG],
    ["embedding-digest-fehlt", "bge-m3", WEG],
    ["sprachmodell-digest-leer", "qwen3:32b", ""],
    ["sprachmodell-digest-ungueltig", "qwen3:32b", "kein-digest"],
    ["embedding-digest-falscher-typ", "bge-m3", 17],
  ];
  for (const [fall, name, digest] of DIGESTFAELLE) {
    it(`B7 · ${fall}: Exit 1, Digest null, Fehler dem Modell zugeordnet`, async () => {
      const { lauf, bestand } = await erfasse(await ollama({ digests: { [name]: digest } }));
      expect(lauf.code).toBe(1);
      expect(bestand?.modelle.find((m) => m.name === name)?.digest).toBeNull();
      expect(bestand?.fehler.join("\n")).toContain(`„${name}": Digest fehlt oder ist ungültig`);
    });
  }

  it("B9 · `bge-m3` wird als `bge-m3:latest` gelistet und trotzdem gefunden", async () => {
    // Gemessen im S07-Lauf am Prüfplatz (HISTORIE/nacharbeit-17): Ollama listet das ohne Tag
    // geladene Gewicht mit `:latest`; das Werkzeug meldete es als „nicht vorhanden".
    const { lauf, bestand } = await erfasse(await ollama({ latestTag: true }));
    expect(lauf.code, lauf.stdout).toBe(0);
    const embedding = bestand?.modelle.find((m) => m.rolle === "embedding");
    expect(embedding?.vorhanden).toBe(true);
    expect(embedding?.digest).toBe(DIGEST_EMBED);
    // Ein ausdrücklich anderer Tag wird NICHT als gleich gewertet.
    const anders = await erfasse(await ollama({ modelle: ["qwen3:32b", "bge-m3:v2"] }));
    expect(anders.lauf.code).toBe(1);
  });

  it("B8 · ein Digest mit sha256:-Präfix gilt als gültig", async () => {
    const mitPraefix = `sha256:${DIGEST_EMBED}`;
    const { lauf, bestand } = await erfasse(await ollama({ digests: { "bge-m3": mitPraefix } }));
    expect(lauf.code, lauf.stderr).toBe(0);
    expect(bestand?.modelle.find((m) => m.name === "bge-m3")?.digest).toBe(mitPraefix);
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

  it("R4 · zusammengeführt bleibt kein Cloud-Schlüssel der Basis aktiv", () => {
    // Ben, Kandidat aa1b1679 (HILFE/f0e46293…/PROBE-COMPOSE.json): `docker compose config` mit
    // gesetzten Cloud-Markern übernahm beide Schlüssel. Docker läuft hier nicht; nachgebildet wird die
    // Regel, nach der Compose die `environment`-Abbildungen zusammenführt: der Wert der späteren Datei
    // ersetzt den der früheren, Schlüssel für Schlüssel.
    const umgebung = (text: string): Map<string, string> => {
      const zeilen = text.split("\n");
      const app = zeilen.findIndex((z) => /^ {2}app:\s*$/.test(z));
      const rest = zeilen.slice(app + 1);
      const ende = rest.findIndex((z) => /^ {2}\S/.test(z) || /^\S/.test(z));
      const werte = new Map<string, string>();
      let inUmgebung = false;
      for (const zeile of ende === -1 ? rest : rest.slice(0, ende)) {
        if (/^ {4}environment:\s*$/.test(zeile)) {
          inUmgebung = true;
          continue;
        }
        if (/^ {4}\S/.test(zeile)) inUmgebung = false;
        const treffer = /^ {6}([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(zeile);
        if (inUmgebung && treffer?.[1] !== undefined) werte.set(treffer[1], treffer[2] ?? "");
      }
      return werte;
    };
    const basis = umgebung(readFileSync(repoPfad("docker-compose.prod.yml"), "utf8"));
    const intern = umgebung(yml);
    const zusammen = new Map([...basis, ...intern]);
    // Kalibrierung: die Basis reicht die Schlüssel wirklich aus der `.env` durch.
    expect(basis.get("ANTHROPIC_API_KEY")).toBe("${ANTHROPIC_API_KEY:-}");
    expect(basis.get("OPENAI_API_KEY")).toBe("${OPENAI_API_KEY:-}");
    // Jeder Schlüsselname der Basis ist im internen Profil ausdrücklich geleert.
    const schluessel = [...basis.keys()].filter((name) => /_API_KEY$/.test(name));
    expect(schluessel.length).toBeGreaterThanOrEqual(2);
    for (const name of schluessel) {
      expect(zusammen.get(name), name).toBe('""');
    }
    expect(zusammen.get("KLARWERK_SKIP_KEYCHAIN")).toBe('"1"');
    expect(zusammen.get("KLARWERK_LOCAL_LLM_URL")).toBe("http://modell:11434/v1");
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
