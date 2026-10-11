// AW-12 — DER INTERNE EMBEDDING-WEG: angebunden, auf das Haus begrenzt, getrennt vom Stub.
//
// Befund aus der Prüfung (Ben, Kandidat 0b21e206): der Embedding-Provider lieferte nur den Stub oder
// `undefined`. Gemessen wird hier der echte Client (`createLocalEmbeddingClientFromEnv`, Egress-
// Chokepoint `services/reasoner/src/model-client.ts`) gegen einen echten HTTP-Server auf 127.0.0.1,
// der den OpenAI-kompatiblen Embedding-Vertrag spricht, und die Verdrahtung im Provider.
// GRENZE: Hier antwortet kein echtes Modell. Dass ein bestimmtes Gewicht sinnvolle Vektoren liefert,
// belegt nur ein Lauf auf einem Rechner mit dem Modell (Abnahme S07) — nicht dieser Test.
import { readFileSync } from "node:fs";
import { type IncomingMessage, type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { STARTVERTRAG } from "../../services/app/src/start-vertrag";
import { createEmbeddingProviderFromEnv, embeddingArt } from "../../services/embedding";
import { createLocalEmbeddingClientFromEnv } from "../../services/reasoner";
import { repoPfad } from "../support/repoPfad";

interface Zielliste {
  ziele: { kennung: string; dateien: string[]; umgebung: string[] }[];
}

interface Anfrage {
  pfad: string;
  autorisierung: string | undefined;
  rumpf: { model?: unknown; input?: unknown };
}

let server: Server | undefined;
afterEach(async () => {
  const s = server;
  server = undefined;
  if (s) await new Promise<void>((zu) => s.close(() => zu()));
});

function lies(anfrage: IncomingMessage): Promise<string> {
  return new Promise((fertig) => {
    let text = "";
    anfrage.on("data", (stueck) => {
      text += String(stueck);
    });
    anfrage.on("end", () => fertig(text));
  });
}

/** Ein OpenAI-kompatibler Embedding-Server, der die Indizes absichtlich rückwärts liefert. */
async function embeddingServer(
  antwort: (eingaben: string[]) => unknown = (eingaben) => ({
    data: eingaben.map((text, index) => ({ index, embedding: [text.length, index, 1] })).reverse(),
  }),
): Promise<{ basis: string; anfragen: Anfrage[] }> {
  const anfragen: Anfrage[] = [];
  server = createServer(async (anfrage, rueckgabe) => {
    const rumpf = JSON.parse(await lies(anfrage)) as Anfrage["rumpf"];
    const autorisierung = anfrage.headers.authorization;
    anfragen.push({ pfad: anfrage.url ?? "", autorisierung, rumpf });
    const eingaben = Array.isArray(rumpf.input) ? (rumpf.input as string[]) : [];
    rueckgabe.setHeader("content-type", "application/json");
    rueckgabe.end(JSON.stringify(antwort(eingaben)));
  });
  const s = server;
  await new Promise<void>((bereit) => s.listen(0, "127.0.0.1", () => bereit()));
  const port = (s.address() as AddressInfo).port;
  return { basis: `http://127.0.0.1:${port}/v1`, anfragen };
}

describe("AW-12 · interner Embedding-Weg", () => {
  it("E1 · entsteht nur für eine bestätigte interne Adresse und mit Modellnamen", () => {
    const modell = { KLARWERK_LOCAL_EMBEDDING_MODEL: "bge-m3" };
    expect(createLocalEmbeddingClientFromEnv({ ...modell })).toBeUndefined();
    expect(
      createLocalEmbeddingClientFromEnv({ KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:11434/v1" }),
    ).toBeUndefined();
    // Fremde Adresse: kein Client, also kein einziger Text verlässt das Haus über diesen Weg.
    const fremd = { ...modell, KLARWERK_LOCAL_LLM_URL: "https://modelle.example/v1" };
    expect(createLocalEmbeddingClientFromEnv(fremd)).toBeUndefined();
    const privat = { ...modell, KLARWERK_LOCAL_LLM_URL: "http://10.0.0.5:8000/v1" };
    expect(createLocalEmbeddingClientFromEnv(privat)).toBeUndefined();
    const freigegeben = { ...privat, KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS: "http://10.0.0.5:8000" };
    expect(createLocalEmbeddingClientFromEnv(freigegeben)?.herkunft).toBe("http://10.0.0.5:8000");
    const loopback = { ...modell, KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:11434/v1" };
    expect(createLocalEmbeddingClientFromEnv(loopback)?.modell).toBe("bge-m3");
  });

  it("E2 · spricht den Embedding-Vertrag und ordnet die Vektoren nach Index", async () => {
    const { basis, anfragen } = await embeddingServer();
    const client = createLocalEmbeddingClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: basis,
      KLARWERK_LOCAL_EMBEDDING_MODEL: "bge-m3",
      KLARWERK_LOCAL_LLM_KEY: "lokal-schluessel",
    });
    expect(client).toBeDefined();
    const vektoren = await client?.einbetten(["a", "bbb"]);
    expect(vektoren).toEqual([
      [1, 0, 1],
      [3, 1, 1],
    ]);
    expect(anfragen).toHaveLength(1);
    expect(anfragen[0]?.pfad).toBe("/v1/embeddings");
    expect(anfragen[0]?.rumpf).toEqual({ model: "bge-m3", input: ["a", "bbb"] });
    expect(anfragen[0]?.autorisierung).toBe("Bearer lokal-schluessel");
  });

  it("E3 · eine unbrauchbare Antwort wirft, statt Vektoren zu raten", async () => {
    const env = (basis: string) => ({
      KLARWERK_LOCAL_LLM_URL: basis,
      KLARWERK_LOCAL_EMBEDDING_MODEL: "bge-m3",
    });
    const zuWenig = await embeddingServer(() => ({ data: [{ index: 0, embedding: [1] }] }));
    await expect(
      createLocalEmbeddingClientFromEnv(env(zuWenig.basis))?.einbetten(["a", "b"]),
    ).rejects.toThrow(/Anzahl/);
    await new Promise<void>((zu) => server?.close(() => zu()));
    server = undefined;
    const keineZahl = await embeddingServer(() => ({ data: [{ index: 0, embedding: ["x"] }] }));
    await expect(
      createLocalEmbeddingClientFromEnv(env(keineZahl.basis))?.einbetten(["a"]),
    ).rejects.toThrow(/ungültigem Vektor/);
  });

  it("E4 · Provider kennzeichnet intern und Stub getrennt und prüft die Dimension", async () => {
    const { basis } = await embeddingServer();
    const weg = createLocalEmbeddingClientFromEnv({
      KLARWERK_LOCAL_LLM_URL: basis,
      KLARWERK_LOCAL_EMBEDDING_MODEL: "bge-m3",
    });
    const intern = createEmbeddingProviderFromEnv(
      { KLARWERK_EMBEDDING_PROVIDER: "local", KLARWERK_EMBEDDING_DIM: "3" },
      { lokal: weg },
    );
    expect(intern?.embeddingVersion).toBe("intern:bge-m3@3");
    expect(embeddingArt(intern?.embeddingVersion ?? "")).toBe("intern");
    const ergebnis = await intern?.embed(["abc"]);
    expect(ergebnis?.vectors).toEqual([[3, 0, 1]]);
    expect(ergebnis?.embeddingVersion).toBe("intern:bge-m3@3");

    const stub = createEmbeddingProviderFromEnv({});
    expect(embeddingArt(stub?.embeddingVersion ?? "")).toBe("stub");
    expect(embeddingArt("fake@8")).toBe("unbekannt");

    // Falsche Dimension: wirft, statt unvereinbare Vektoren zu speichern.
    const falsch = createEmbeddingProviderFromEnv(
      { KLARWERK_EMBEDDING_PROVIDER: "local", KLARWERK_EMBEDDING_DIM: "1024" },
      { lokal: weg },
    );
    await expect(falsch?.embed(["abc"])).rejects.toThrow(/Vektorlänge 3 ≠ dim 1024/);
    // Ohne Dimension oder ohne internen Weg: kein Embedder, nie still der Stub.
    expect(
      createEmbeddingProviderFromEnv({ KLARWERK_EMBEDDING_PROVIDER: "local" }, { lokal: weg }),
    ).toBeUndefined();
    expect(
      createEmbeddingProviderFromEnv({
        KLARWERK_EMBEDDING_PROVIDER: "local",
        KLARWERK_EMBEDDING_DIM: "3",
      }),
    ).toBeUndefined();
  });

  it("E7 · eine Weiterleitung des bestätigten Servers trägt keinen Text weiter", async () => {
    // Ben, Kandidat af4e3fa6: geprüft war nur die Ausgangsadresse; fetch folgte 307/308 von selbst.
    // Hier antwortet der bestätigte Server mit 307 auf ein zweites Ziel. Das zweite Ziel darf
    // KEINE Anfrage sehen, und der Aufruf muss scheitern statt Vektoren zu liefern.
    let beimZiel = 0;
    const ziel = createServer((_anfrage, rueckgabe) => {
      beimZiel += 1;
      rueckgabe.end(JSON.stringify({ data: [{ index: 0, embedding: [1, 2, 3] }] }));
    });
    await new Promise<void>((bereit) => ziel.listen(0, "127.0.0.1", () => bereit()));
    const zielPort = (ziel.address() as AddressInfo).port;
    server = createServer((_anfrage, rueckgabe) => {
      rueckgabe.statusCode = 307;
      rueckgabe.setHeader("location", `http://127.0.0.1:${zielPort}/v1/embeddings`);
      rueckgabe.end();
    });
    const s = server;
    await new Promise<void>((bereit) => s.listen(0, "127.0.0.1", () => bereit()));
    const port = (s.address() as AddressInfo).port;
    try {
      const client = createLocalEmbeddingClientFromEnv({
        KLARWERK_LOCAL_LLM_URL: `http://127.0.0.1:${port}/v1`,
        KLARWERK_LOCAL_EMBEDDING_MODEL: "bge-m3",
      });
      await expect(client?.einbetten(["vertraulicher Satz"])).rejects.toThrow();
      expect(beimZiel).toBe(0);
    } finally {
      await new Promise<void>((zu) => ziel.close(() => zu()));
    }
  });

  it("E8 · der Client verlangt beim Versand ausdrücklich redirect: error", async () => {
    const aufrufe: RequestInit[] = [];
    const fetchSpion = (async (_url: unknown, optionen?: RequestInit) => {
      aufrufe.push(optionen ?? {});
      return new Response(JSON.stringify({ data: [{ index: 0, embedding: [1] }] }));
    }) as typeof fetch;
    const client = createLocalEmbeddingClientFromEnv(
      { KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:1/v1", KLARWERK_LOCAL_EMBEDDING_MODEL: "m" },
      fetchSpion,
    );
    await client?.einbetten(["a"]);
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.redirect).toBe("error");
  });

  it("E6 · Startvertrag und Zielliste führen den internen Weg dieses Auftrags", () => {
    // Die globalen Wächter (vertrag-vollstaendig D1, ausgehende-ziele Z1) prüfen das ganze Repo und
    // sind derzeit an fremden, hier nicht geänderten Stellen rot. Dieser Fall hält genau den eigenen
    // Anteil fest: die neue Variable steht im Vertrag, und ihre einzige Lesestelle liegt in der Datei,
    // die die Zielliste für `ki-lokal` führt.
    const namen = STARTVERTRAG.map((w) => w.name);
    expect(namen).toContain("KLARWERK_LOCAL_EMBEDDING_MODEL");
    const roh = readFileSync(repoPfad("services/app/src/ausgehende-ziele.json"), "utf8");
    const ziele = JSON.parse(roh) as Zielliste;
    const lokal = ziele.ziele.find((z) => z.kennung === "ki-lokal");
    expect(lokal?.dateien).toEqual(["services/reasoner/src/model-client.ts"]);
    expect(lokal?.umgebung).toContain("KLARWERK_LOCAL_LLM_URL");
    const client = readFileSync(repoPfad("services/reasoner/src/model-client.ts"), "utf8");
    expect(client).toContain("env.KLARWERK_LOCAL_EMBEDDING_MODEL");
    expect(client).toContain("env.KLARWERK_LOCAL_LLM_URL");
  });

  it("E5 · die App reicht den internen Weg in die Embedder-Auswahl", () => {
    const app = readFileSync(repoPfad("services/app/src/build-app.ts"), "utf8");
    expect(app).toContain("createEmbeddingProviderFromEnv(process.env, {");
    expect(app).toContain("lokal: createLocalEmbeddingClientFromEnv(process.env),");
  });
});
