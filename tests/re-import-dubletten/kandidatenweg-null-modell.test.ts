// ================================================================================================
// JOB 3050 — DIE NEUE PRUEFUNG AM KANDIDATENWEG IST EINE RECHNUNG AUF TEXT, KEIN MODELLAUFRUF.
// ================================================================================================
//
// Pedis Kostenentscheidung zum Confluence-Bestand haengt an genau einer Aussage, und sie gilt jetzt
// fuer BEIDE Importwege: sie erzeugen NULL Modellaufrufe. Fuer `POST /api/library/import` haelt das
// `tests/library/import-json-zero-model-calls.test.ts` (mega28 Block D) fest. JOB 3050 verdrahtet
// dieselbe Regel in `POST /api/library/import/candidates` — also braucht auch dieser Weg seinen
// Nagel, sonst waere die Aussage fuer den zweiten Weg nur statisch gelesen, und statisches Lesen
// verfaellt.
//
// SPIONE (dieselben vier Kanten wie im Muster):
//   1. Reasoner  — ein ModelClient, der JEDEN complete()-Aufruf zaehlt.
//   2. Embedder  — createEmbeddingProviderFromEnv liefert einen zaehlenden Wrapper; der Prefilter
//                  ist ausdruecklich EINGESCHALTET, damit er ueberhaupt feuern KOENNTE.
//   3. Erkennung — conflicts.detectForSubject / overlaps.detectForSubject, gezaehlt am Service.
//   4. Warteschlange — der aiCheck-Worker (Spy VOR buildApp gesetzt, dokumentierter Test-Haken).
// Kein neuer Egress: der Stub-Embedder rechnet lokal, der Spy-Client spricht mit niemandem.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Embedder-Zaehler muss vor der (gehoisteten) Modul-Attrappe existieren.
const embedSpy = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../../services/embedding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../services/embedding")>();
  return {
    ...actual,
    createEmbeddingProviderFromEnv: (env?: Record<string, string | undefined>) => {
      const provider = actual.createEmbeddingProviderFromEnv(env ?? process.env);
      if (!provider) {
        return provider;
      }
      return {
        ...provider,
        embed: async (texts: readonly string[]) => {
          embedSpy.calls += 1;
          return provider.embed(texts);
        },
      };
    },
  };
});

import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { ModelClient } from "../../services/reasoner";
import { ModelProvider, Reasoner } from "../../services/reasoner";

const ENV_KEYS = [
  "KLARWERK_SKIP_KEYCHAIN",
  "KLARWERK_DUP_PREFILTER",
  "KLARWERK_EMBEDDING_PROVIDER",
] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
  }
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
  // Der Prefilter ist AN — sonst waere „Embedder 0" trivial wahr, weil es gar keinen gaebe.
  process.env.KLARWERK_DUP_PREFILTER = "1";
  process.env.KLARWERK_EMBEDDING_PROVIDER = "stub";
  embedSpy.calls = 0;
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

const GERAETE = [
  "Kesselspeisepumpe",
  "Rueckschlagklappe",
  "Sicherheitsventil",
  "Waermetauscher",
  "Foerderband",
  "Ruehrwerk",
  "Schraubenkompressor",
  "Bandtrockner",
  "Filterpresse",
  "Dekanterzentrifuge",
  "Schaltschrank",
  "Frequenzumrichter",
  "Getriebemotor",
  "Klauenkupplung",
  "Hydraulikaggregat",
  "Vakuumpumpe",
  "Dosierpumpe",
  "Oelabscheider",
  "Gasbrenner",
  "Rauchgasgeblaese",
  "Kuehlturm",
  "Speisewasserbehaelter",
  "Kondensatpumpe",
  "Druckluftnetz",
  "Gleitringdichtung",
] as const;

const ARBEITEN = [
  "entkalken",
  "abschmieren",
  "kalibrieren",
  "ausrichten",
  "entlueften",
  "spuelen",
  "nachziehen",
  "tauschen",
  "abgleichen",
  "freibrennen",
] as const;

/** Wirklich unterscheidbare Eintraege — sonst wuerden sie einander als Dubletten treffen. */
function importItems(n: number) {
  return Array.from({ length: n }, (_, i) => {
    const geraet = GERAETE[i % GERAETE.length];
    const arbeit = ARBEITEN[i % ARBEITEN.length];
    return {
      title: `${geraet} ${arbeit}`,
      statement: `${geraet} ${arbeit}, Befund vermerken.`,
      type: "best_practice" as const,
      category: "Betrieb",
      confidentiality: "intern" as const,
    };
  });
}

async function setup() {
  const services = buildServices();

  const model = { calls: 0 };
  const client = {
    name: "spy",
    complete: async () => {
      model.calls += 1;
      return '{"relation":"kein_konflikt","older":null,"confidence":0.9,"begruendung":"ok","zitat_a":"a","zitat_b":"b"}';
    },
  } as unknown as ModelClient;
  services.reasoner = new Reasoner(new ModelProvider(client));

  const detection = { conflicts: 0, overlaps: 0 };
  const realConflictDetect = services.conflicts.detectForSubject.bind(services.conflicts);
  services.conflicts.detectForSubject = async (...args) => {
    detection.conflicts += 1;
    return realConflictDetect(...args);
  };
  const realOverlapDetect = services.overlaps.detectForSubject.bind(services.overlaps);
  services.overlaps.detectForSubject = async (...args) => {
    detection.overlaps += 1;
    return realOverlapDetect(...args);
  };

  const queue = { enqueued: 0 };
  const worker: AiCheckWorker = {
    enqueue: () => {
      queue.enqueued += 1;
    },
    has: () => false,
    queuedCount: () => 0,
    idle: () => Promise.resolve(),
  };
  services.aiCheckWorker = worker;

  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "nullmodell3050@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "nullmodell3050@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  return { app, headers, model, detection, queue };
}

describe("JOB 3050 · K8 — POST /api/library/import/candidates erzeugt NULL Modellaufrufe", () => {
  it("K8a · 25 Kandidaten in einen leeren Bestand: alle vier Zaehler bleiben null", async () => {
    const { app, headers, model, detection, queue } = await setup();

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: { items: importItems(25) },
    });

    // Der Lauf hat wirklich stattgefunden — sonst waeren die Nullen wertlos.
    expect(res.statusCode, res.body).toBe(201);
    const kandidaten = res.json() as { duplicate: boolean }[];
    expect(kandidaten).toHaveLength(25);
    expect(
      kandidaten.filter((k) => k.duplicate),
      "Die Vorbedingung: 25 UNTERSCHEIDBARE Eintraege, keiner davon Dublette.",
    ).toHaveLength(0);

    expect(model.calls).toBe(0);
    expect(embedSpy.calls).toBe(0);
    expect(detection.conflicts).toBe(0);
    expect(detection.overlaps).toBe(0);
    expect(queue.enqueued).toBe(0);
    await app.close();
  });

  it("K8b · auch gegen einen GEFUELLTEN Bestand (die Dublettenpruefung rechnet wirklich) bleibt alles null", async () => {
    const { app, headers, model, detection, queue } = await setup();
    // Bestand anlegen — jetzt hat Pass 2 wirklich etwas zu vergleichen.
    for (const item of importItems(10)) {
      const res = await app.inject({ method: "POST", url: "/api/kos", headers, payload: item });
      expect(res.statusCode, res.body).toBe(201);
    }
    // Die Einreichungen oben zaehlen (Warteschlange/Embedder) — der Kandidatenweg darf ab HIER
    // nichts mehr kosten. Die Zaehler werden deshalb genau vor dem Messobjekt zurueckgesetzt.
    const vorher = { model: model.calls, embed: embedSpy.calls, ...detection, ...queue };

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: { items: importItems(10) },
    });

    expect(res.statusCode, res.body).toBe(201);
    const kandidaten = res.json() as { duplicate: boolean }[];
    expect(
      kandidaten.filter((k) => k.duplicate),
      "Die Vorbedingung von K8b: die Pruefung hat wirklich getroffen (dieselbe Sicherung erneut).",
    ).toHaveLength(10);

    expect(model.calls).toBe(vorher.model);
    expect(embedSpy.calls).toBe(vorher.embed);
    expect(detection.conflicts).toBe(vorher.conflicts);
    expect(detection.overlaps).toBe(vorher.overlaps);
    expect(queue.enqueued).toBe(vorher.enqueued);
    await app.close();
  });

  // ==============================================================================================
  // KALIBRIERUNG — ein falsch verdrahteter Nullzaehler ist schlechter als keiner.
  // ==============================================================================================
  it("K8c · dieselben Spione ZAEHLEN bei einer regulaeren Einreichung ueber HTTP", async () => {
    const { app, headers, queue } = await setup();

    expect(queue.enqueued).toBe(0);
    expect(embedSpy.calls).toBe(0);
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Pumpe P2 Druckverlust",
        statement: "Bei Pumpe P2 faellt der Druck an Ventil V4.",
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "intern",
      },
    });

    expect(res.statusCode, res.body).toBe(201);
    expect(queue.enqueued).toBeGreaterThan(0);
    expect(embedSpy.calls).toBeGreaterThan(0);
    await app.close();
  });
});
