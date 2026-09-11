// ================================================================================================
// JOB 3127 · MR-SELECT-1 — DER PRODUKTIVE EINSTIEG, 1:1 GEGEN DEN BEFUND R-1567.
// ================================================================================================
//
// Codex maß am lebenden Produkt (Lauf R-1567 auf 1.125): `POST /api/admin/import/confluence/select`
// antwortete `http: 200` mit `"inferenceStatus": "unavailable"` / `"fallbackReason": "model-error"`
// — ein Modell war befragt worden und gescheitert —, und die im SELBEN Lauf frisch abgerufene
// Laufliste war `[]`. Genau dieses Paar wird hier nachgestellt: Antwort UND Protokoll, an EINEM
// Aufruf gemessen.
//
// WARUM DIESE DATEI NEBEN `laufprotokoll.test.ts` STEHT: ein grüner Servicetest belegt, dass die
// Methode schreibt — nicht, dass der Weg, auf dem der Befund entstand, dort ankommt. Gefahren wird
// deshalb die ECHTE Route (Guard, Schema, Snapshot, Vertraulichkeits-Gate) mit eingespeistem
// Reasoner samt Protokoll-Repo; die Attrappe sitzt ganz unten am Modell-Client.
//
// VERTRAULICHKEIT: die Fixture-Items tragen `confidentiality: "intern"` und der Aufruf schickt
// `promptConfidential: false` — nur so ist der Satz nach dem Gate (`confluence-import-routes.ts:729`)
// nicht vertraulich und die Cloud-Kante bleibt in der Kette. Das ist die Lage des Befunds.
//
// NICHT GEMESSEN: die Anzeige der Laufkarte (siehe `laufkarte-kette.test.ts`).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import { confluenceImportRoutes } from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import { DeterministicProvider, ModelProvider, Reasoner } from "../../services/reasoner";
import { cappedModelClient } from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const SAVED: Record<string, string | undefined> = {};
const KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_ADDON_API"];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

// Ein KOMPLETT explizit eingestufter Snapshot — nur er gibt den Freitext-Satz für die Cloud frei
// (`promptRequiresConfidential`, library-analytics/src/grouping.ts:56).
const ITEMS: ImportItem[] = [
  {
    title: "Wartung Pumpe",
    statement: "Die Pumpe wird jährlich gewartet.",
    type: "best_practice",
    category: "K",
    author: "Anna",
    tags: ["wartung"],
    sourceScope: "SPACE-K",
    updatedAt: "2020-01-01T00:00:00.000Z",
    confidentiality: "intern",
  },
  {
    title: "Fehlercode E5",
    statement: "E5 bedeutet Überdruck.",
    type: "best_practice",
    category: "K",
    author: "Bob",
    tags: ["fehler"],
    sourceScope: "SPACE-K",
    updatedAt: "2024-06-01T00:00:00.000Z",
    confidentiality: "intern",
  },
];

function fixtureAdapter(items: ImportItem[]): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
}

// Der Modell-Client in der Produktverdrahtung (gecappter Wrapper = der echte Chokepoint).
function modellClient(antwort: () => Promise<string>): ModelClient {
  return cappedModelClient(
    {
      name: "anthropic:auswahl-modell",
      model: "auswahl-modell",
      complete: antwort,
    },
    { rejectsConfidential: true },
  );
}

async function selectApp(antwort: () => Promise<string>) {
  const repo = new InMemoryModelRunRepo();
  const reasoner = new Reasoner(
    new ModelProvider(modellClient(antwort)),
    new DeterministicProvider(),
    repo,
  );
  // JOB 3588: die GRUNDFREIGABE im Aufbau. Beide Fälle dieser Datei messen, dass der Routeneinstieg
  // einen ECHTEN Auswahllauf protokolliert (mit Modellnamen). Ohne die Adminfreigabe des Kerns von
  // JOB 3549 endete jeder Lauf „no-model", und die Route hätte nichts zu protokollieren.
  // Kein `vertraulicheInhalte`: der Schnappschuss dieser Datei ist nicht vertraulich eingestuft.
  await erteileKiFreigabe(reasoner);
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner,
      makeAdapter: () => fixtureAdapter(ITEMS),
    }),
  );
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, repo, headers: { authorization: `Bearer ${login.json().token}` } };
}

function auswahlAnfrage(app: Awaited<ReturnType<typeof selectApp>>["app"], headers: object) {
  return app.inject({
    method: "POST",
    url: "/api/admin/import/confluence/select",
    headers: headers as Record<string, string>,
    payload: { prompt: "alles zum Thema Wartung", promptConfidential: false },
  });
}

describe("JOB 3127: der produktive Auswahl-Einstieg hinterlässt seinen Lauf", () => {
  it("A1 Satz gestellt, Modell antwortet: 200 UND genau ein select-Lauf im Protokoll", async () => {
    const { app, repo, headers } = await selectApp(async () => '{"themes":["wartung"]}');

    const res = await auswahlAnfrage(app, headers);

    expect(res.statusCode).toBe(200);
    expect(res.json().inferenceStatus).toBe("ok");
    const laeufe = await repo.recent(50);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]?.task).toBe("select");
    expect(laeufe[0]?.status).toBe("success");
    expect(laeufe[0]?.model).toBe("auswahl-modell");
  });

  it("A2 (Befund R-1567) Modell scheitert: 200 mit model-error UND genau ein Fehler-Lauf", async () => {
    const { app, repo, headers } = await selectApp(async () => {
      throw new Error("Modell-API antwortete mit 500");
    });

    const res = await auswahlAnfrage(app, headers);

    // Das gemessene Paar aus `select-antwort.json:4` und `:52-53` …
    expect(res.statusCode).toBe(200);
    expect(res.json().inferenceStatus).toBe("unavailable");
    expect(res.json().fallbackReason).toBe("model-error");
    // … und die Laufliste, die dort `[]` war (`select-laeufe-neu.json:1`).
    const laeufe = await repo.recent(50);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]?.task).toBe("select");
    expect(laeufe[0]?.status).toBe("error");
    expect(laeufe[0]?.error).toBe("model-error");
    // Der bezahlte Aufruf nennt das Modell, an dem er scheiterte.
    expect(laeufe[0]?.model).toBe("auswahl-modell");
  });

  it("A3 ohne Satz (nur Klick-Kriterien): 200, aber KEIN Lauf — es wurde nichts gefragt", async () => {
    const { app, repo, headers } = await selectApp(async () => '{"themes":["wartung"]}');

    const res = await app.inject({
      method: "POST",
      url: "/api/admin/import/confluence/select",
      headers,
      payload: { criteria: { themes: ["wartung"] } },
    });

    expect(res.statusCode).toBe(200);
    expect(await repo.recent(50)).toEqual([]);
  });

  it("A4 zwei Anfragen: zwei Läufe — die Route zählt keinen Aufruf doppelt", async () => {
    const { app, repo, headers } = await selectApp(async () => '{"themes":["wartung"]}');

    await auswahlAnfrage(app, headers);
    await auswahlAnfrage(app, headers);

    expect(await repo.recent(50)).toHaveLength(2);
  });
});
