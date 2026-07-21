// WP-SAMMEL20-FIX (bens Fix 1+2+3) am IC-3-Select-Pfad (SHIP-PFLICHT vor VIP-2):
// Fix 1 (P0): der Freitext-Satz wird VOR der Item-Auswahl verarbeitet — die Vertraulichkeits-
//   Grundlage ist deshalb der GESAMTE Snapshot (groupingRequiresConfidential, derselbe fail-safe
//   Batch-Vertrag wie der Gruppierungs-Fix aus sammel17). Spy sitzt am ECHTEN Cloud-Chokepoint
//   (ModelClient.complete): restringiert/fehlend/ungültig → 0 Cloud-Calls.
// Fix 2: KI-Ausfall wird NIE still zur ungefilterten Vollmenge — die Antwort trägt
//   inferenceStatus/fallbackReason, die Klick-Filter wirken unverändert.
// Fix 3: Route-Schema — Prompt-Länge (max 500) und locale (de/en) mit ehrlichem 400.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  SELECT_PROMPT_MAX_CHARS,
  confluenceImportRoutes,
} from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import type { ImportItem } from "../../services/library-analytics";
import { ModelProvider, Reasoner } from "../../services/reasoner";

function item(overrides: Partial<ImportItem> & { title: string }): ImportItem {
  return {
    statement: "kurz",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    updatedAt: "2026-06-01T00:00:00.000Z",
    textCodec: "decoded",
    ...overrides,
  };
}

function fixtureAdapter(items: ImportItem[]): ConfluenceSourceAdapter {
  return {
    source: "Confluence",
    collect: async () => items,
    collectAll: async () => ({ items, failed: [], truncated: false }),
  } as unknown as ConfluenceSourceAdapter;
}

// Spy am ECHTEN Cloud-Chokepoint: ModelClient.complete — der einzige Weg, auf dem der Satz die
// Maschine Richtung Cloud verlassen würde (deriveImportCriteria → completeRaw → client.complete).
function cloudSpyReasoner(criteriaJson: string) {
  let calls = 0;
  const provider = new ModelProvider({
    name: "anthropic:test",
    complete: async () => {
      calls += 1;
      return criteriaJson;
    },
  });
  return { reasoner: new Reasoner(provider), cloudCalls: () => calls };
}

function throwingReasoner() {
  return new Reasoner(
    new ModelProvider({
      name: "anthropic:test",
      complete: async () => {
        throw new Error("Modell down");
      },
    }),
  );
}

async function selectApp(items: ImportItem[], reasoner?: Reasoner) {
  const services = buildServices();
  const app = buildApp(services);
  app.register(
    confluenceImportRoutes({
      library: services.library,
      koService: services.ko,
      guards: makeGuards(services.auth),
      reasoner: reasoner ?? services.reasoner,
      makeAdapter: () => fixtureAdapter(items),
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
  return {
    app,
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
  };
}

const selectBody = (body: unknown) => ({
  method: "POST" as const,
  url: "/api/admin/import/confluence/select",
  payload: body as Record<string, unknown>,
});

describe("WP-SAMMEL20-FIX (Fix 1, P0): Select-Vertraulichkeit — fail-safe Batch-Vertrag über den Snapshot", () => {
  const PROMPT = "alles zur Pumpenwartung";

  it("EIN Item ohne Signal im Snapshot → Select-Aufruf läuft vertraulich: 0 Cloud-Calls, ehrlicher Ausfall", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(
      [
        item({ title: "Pumpe warten", confidentiality: "intern" }),
        item({ title: "Ohne Signal" }), // fehlendes Governance-Signal → Batch vertraulich
      ],
      spy.reasoner,
    );
    const res = await app.inject({ ...selectBody({ prompt: PROMPT }), headers });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0); // der Satz hat die Maschine NIE Richtung Cloud verlassen
    const body = res.json() as { inferenceStatus?: string; fallbackReason?: string };
    expect(body.inferenceStatus).toBe("unavailable");
    expect(body.fallbackReason).toBe("no-model"); // Cloud raus, kein lokales Modell verdrahtet
  });

  it("restringierte UND ungültige Stufe im Snapshot → ebenfalls 0 Cloud-Calls", async () => {
    for (const conf of ["vertraulich", "streng_vertraulich", "geheim"]) {
      const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
      const { app, headers } = await selectApp(
        [
          item({ title: "Frei", confidentiality: "intern" }),
          item({
            title: "Eingeschränkt",
            confidentiality: conf as unknown as NonNullable<ImportItem["confidentiality"]>,
          }),
        ],
        spy.reasoner,
      );
      const res = await app.inject({ ...selectBody({ prompt: PROMPT }), headers });
      expect(res.statusCode).toBe(200);
      expect(spy.cloudCalls(), conf).toBe(0);
    }
  });

  it("POSITIVFALL: NUR bei komplett explizit freigegebenen Stufen arbeitet die Cloud (1 Call, Kriterien wirken)", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(
      [
        item({ title: "Pumpe warten", confidentiality: "intern" }),
        item({ title: "Ventil tauschen", confidentiality: "intern" }),
      ],
      spy.reasoner,
    );
    const res = await app.inject({ ...selectBody({ prompt: PROMPT }), headers });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(1);
    const body = res.json() as {
      matched: number;
      inferenceStatus?: string;
      preview: { title: string }[];
    };
    expect(body.inferenceStatus).toBe("ok");
    // Die abgeleiteten Kriterien (keywords: pumpe) haben WIRKLICH gefiltert.
    expect(body.matched).toBe(1);
    expect(body.preview.map((p) => p.title)).toEqual(["Pumpe warten"]);
  });
});

describe("WP-SAMMEL20-FIX (Fix 2): KI-Ausfall NIE still — inferenceStatus + Klick-Filter wirken weiter", () => {
  it("Modell wirft → inferenceStatus unavailable + fallbackReason model-error; Klick-Filter unverändert wirksam", async () => {
    const { app, headers } = await selectApp(
      [
        item({ title: "Pumpe warten", tags: ["wartung"], confidentiality: "intern" }),
        item({ title: "Ventil tauschen", tags: ["montage"], confidentiality: "intern" }),
      ],
      throwingReasoner(),
    );
    const res = await app.inject({
      ...selectBody({ prompt: "nur Wartung bitte", criteria: { themes: ["wartung"] } }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      matched: number;
      inferenceStatus?: string;
      fallbackReason?: string;
      preview: { title: string }[];
    };
    expect(body.inferenceStatus).toBe("unavailable");
    expect(body.fallbackReason).toBe("model-error");
    // Der Klick-Filter (themes: wartung) wirkt weiter — KEINE stille ungefilterte Vollmenge.
    expect(body.matched).toBe(1);
    expect(body.preview.map((p) => p.title)).toEqual(["Pumpe warten"]);
  });

  it("ohne Prompt gibt es KEINEN inferenceStatus (die KI war nicht gefragt)", async () => {
    const { app, headers } = await selectApp([
      item({ title: "Pumpe warten", confidentiality: "intern" }),
    ]);
    const res = await app.inject({ ...selectBody({ criteria: {} }), headers });
    expect(res.statusCode).toBe(200);
    expect("inferenceStatus" in (res.json() as Record<string, unknown>)).toBe(false);
  });
});

describe("WP-SAMMEL20-FIX (Fix 3): Route-Schema der Auswahl", () => {
  it("Prompt über dem Deckel → ehrlicher 400 (kein stilles Kappen, kein Cloud-Call)", async () => {
    const spy = cloudSpyReasoner("{}");
    const { app, headers } = await selectApp(
      [item({ title: "Pumpe", confidentiality: "intern" })],
      spy.reasoner,
    );
    const res = await app.inject({
      ...selectBody({ prompt: "x".repeat(SELECT_PROMPT_MAX_CHARS + 1) }),
      headers,
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { message: string }).message).toContain(String(SELECT_PROMPT_MAX_CHARS));
    expect(spy.cloudCalls()).toBe(0);
    // Exakt am Deckel ist gültig.
    const ok = await app.inject({
      ...selectBody({ prompt: "x".repeat(SELECT_PROMPT_MAX_CHARS) }),
      headers,
    });
    expect(ok.statusCode).toBe(200);
  });

  it("prompt muss ein Text sein; locale nur de/en — sonst 400", async () => {
    const { app, headers } = await selectApp([item({ title: "Pumpe", confidentiality: "intern" })]);
    const badPrompt = await app.inject({ ...selectBody({ prompt: 42 }), headers });
    expect(badPrompt.statusCode).toBe(400);
    const badLocale = await app.inject({ ...selectBody({ locale: "fr" }), headers });
    expect(badLocale.statusCode).toBe(400);
    expect((badLocale.json() as { message: string }).message).toContain("locale");
    const okLocale = await app.inject({ ...selectBody({ locale: "en" }), headers });
    expect(okLocale.statusCode).toBe(200);
  });
});
