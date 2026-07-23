// WP-SAMMEL20-FIX (bens Fix 1+2+3) am IC-3-Select-Pfad (SHIP-PFLICHT vor VIP-2):
// Fix 1 (P0): der Freitext-Satz wird VOR der Item-Auswahl verarbeitet — die Vertraulichkeits-
//   Grundlage ist deshalb der GESAMTE Snapshot (groupingRequiresConfidential, derselbe fail-safe
//   Batch-Vertrag wie der Gruppierungs-Fix aus sammel17). Spy sitzt am ECHTEN Cloud-Chokepoint
//   (ModelClient.complete): restringiert/fehlend/ungültig → 0 Cloud-Calls.
// Fix 2: KI-Ausfall wird NIE still zur ungefilterten Vollmenge — die Antwort trägt
//   inferenceStatus/fallbackReason, die Klick-Filter wirken unverändert.
// Fix 3: Route-Schema — Prompt-Länge (max 500) und locale (de/en) mit ehrlichem 400.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeGuards } from "../../services/app/src/http";
import {
  SELECT_PROMPT_MAX_CHARS,
  confluenceImportRoutes,
} from "../../services/app/src/routes/confluence-import-routes";
import type { ConfluenceSourceAdapter } from "../../services/confluence";
import { type ImportItem, promptRequiresConfidential } from "../../services/library-analytics";
import { ModelProvider, Reasoner } from "../../services/reasoner";

// WP-VIP2-GATE (bens P0-1, endgueltig): Spy am EMBEDDER-Chokepoint. Das Modul services/embedding
// wird gewrappt: jeder von createEmbeddingProviderFromEnv gebaute Provider zaehlt seine embed()-
// Aufrufe — egal, wo im App-Graph er landet (Prefilter etc.). Zusammen mit dem Cloud-Spy
// (ModelClient.complete) beweist das bens Negativtest: ein unklassifizierter/fehlklassifizierter
// Prompt-Lauf erzeugt exakt NULL Cloud- UND NULL Embedder-Aufrufe.
const embedSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("../../services/embedding", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../services/embedding")>();
  return {
    ...original,
    createEmbeddingProviderFromEnv: (env: Record<string, string | undefined>) => {
      const provider = original.createEmbeddingProviderFromEnv(env);
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
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0); // der Satz hat die Maschine NIE Richtung Cloud verlassen
    const body = res.json() as { inferenceStatus?: string; fallbackReason?: string };
    expect(body.inferenceStatus).toBe("unavailable");
    // WP-SHIP9-S2 (bens Folgeschnitt B4): 0-Cloud-Call-Vertrag unverändert; die Ursache wird nur
    // ehrlicher — die Cloud fiel GENAU wegen der Vertraulichkeit weg (kein lokales Modell) → "confidential".
    expect(body.fallbackReason).toBe("confidential");
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
      const res = await app.inject({
        ...selectBody({ prompt: PROMPT, promptConfidential: false }),
        headers,
      });
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
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
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

describe("WP-VIP2-GATE (bens P0-1, endgueltig): Prompt-Provenienz ohne fail-open — NULL Cloud- UND NULL Embedder-Aufrufe", () => {
  const PROMPT = "alles zur Pumpenwartung";
  const savedPrefilter = process.env.KLARWERK_DUP_PREFILTER;

  beforeEach(() => {
    // Prefilter AN, damit der Embedder-Chokepoint im App-Graph ueberhaupt existiert — der Spy
    // beweist dann, dass der Select-Lauf ihn NIE beruehrt.
    process.env.KLARWERK_DUP_PREFILTER = "1";
    embedSpy.calls = 0;
  });

  afterEach(() => {
    if (savedPrefilter === undefined) {
      delete process.env.KLARWERK_DUP_PREFILTER;
    } else {
      process.env.KLARWERK_DUP_PREFILTER = savedPrefilter;
    }
  });

  it("LEERER Snapshot → vertraulich (fail-closed, vorher fail-open): 0 Cloud- UND 0 Embedder-Aufrufe", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp([], spy.reasoner);
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
    const body = res.json() as { inferenceStatus?: string; fallbackReason?: string };
    expect(body.inferenceStatus).toBe("unavailable");
    // WP-SHIP9-S2: die Cloud fiel wegen der Vertraulichkeit weg → ehrlicher Grund "confidential".
    expect(body.fallbackReason).toBe("confidential");
  });

  it("unklassifiziertes Item im Snapshot → exakt NULL Cloud- und NULL Embedder-Aufrufe (bens Formulierung)", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(
      [item({ title: "Pumpe warten", confidentiality: "intern" }), item({ title: "Ohne Signal" })],
      spy.reasoner,
    );
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
  });

  it("FEHLKLASSIFIZIERT (ungueltige Stufe) → ebenfalls 0/0", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(
      [
        item({ title: "Frei", confidentiality: "intern" }),
        item({
          title: "Kaputt",
          confidentiality: "geheim" as unknown as NonNullable<ImportItem["confidentiality"]>,
        }),
      ],
      spy.reasoner,
    );
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
  });

  it("POSITIVFALL unveraendert: komplett explizit freigegebener Snapshot → genau 1 Cloud-Call, 0 Embedder", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(
      [
        item({ title: "Pumpe warten", confidentiality: "intern" }),
        item({ title: "Ventil tauschen", confidentiality: "intern" }),
      ],
      spy.reasoner,
    );
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(1);
    expect(embedSpy.calls).toBe(0);
  });

  it("promptRequiresConfidential (pure): jede unklare Kante ist vertraulich — leer, fehlend, unklar, werfend", () => {
    expect(promptRequiresConfidential([])).toBe(true);
    expect(promptRequiresConfidential(null)).toBe(true);
    expect(promptRequiresConfidential(undefined)).toBe(true);
    expect(promptRequiresConfidential([item({ title: "Ohne Signal" })])).toBe(true);
    expect(
      promptRequiresConfidential([item({ title: "Restringiert", confidentiality: "vertraulich" })]),
    ).toBe(true);
    // Wirft die Klassifikation selbst (kaputtes Item), gilt defensiv vertraulich.
    const broken = {
      ...item({ title: "Kaputt" }),
      get confidentiality(): ImportItem["confidentiality"] {
        throw new Error("Klassifikation kaputt");
      },
    } as ImportItem;
    expect(promptRequiresConfidential([broken])).toBe(true);
    // Nur die KOMPLETT explizit freigegebene Quelle bleibt offen.
    expect(promptRequiresConfidential([item({ title: "Frei", confidentiality: "intern" })])).toBe(
      false,
    );
  });

  it("Signatur-Pin: deriveImportCriteria hat KEINEN confidential-Default mehr (jeder Aufrufer entscheidet explizit)", () => {
    const src = readFileSync(resolve(process.cwd(), "services/reasoner/src/service.ts"), "utf8");
    expect(src).not.toContain("confidential = false,\n  ): Promise<ImportCriteriaResult>");
    expect(src).toContain("confidential: boolean,\n  ): Promise<ImportCriteriaResult>");
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
      ...selectBody({
        prompt: "nur Wartung bitte",
        promptConfidential: false,
        criteria: { themes: ["wartung"] },
      }),
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
      ...selectBody({ prompt: "x".repeat(SELECT_PROMPT_MAX_CHARS + 1), promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { message: string }).message).toContain(String(SELECT_PROMPT_MAX_CHARS));
    expect(spy.cloudCalls()).toBe(0);
    // Exakt am Deckel ist gültig.
    const ok = await app.inject({
      ...selectBody({ prompt: "x".repeat(SELECT_PROMPT_MAX_CHARS), promptConfidential: false }),
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

// WP-VIP2-GATE-2 (bens Fix 1, P0-1-Kern letzte Stufe): der Satz braucht die EIGENE PFLICHT-
// EINSTUFUNG des Nutzers; der Snapshot bleibt monoton HEBENDER Backstop. bens Testauflage
// woertlich: interner Snapshot + fehlende/vertrauliche Prompt-Einstufung → BEIDE Egress-Spys
// (Cloud + Embedder) exakt 0; Positiv NUR bei explizit unbedenklichem Prompt UND komplett
// internem Snapshot.
describe("WP-VIP2-GATE-2 Fix 1: Prompt-Eigenprovenienz (Pflicht-Einstufung + hebender Backstop)", () => {
  const PROMPT = "alles zur Pumpenwartung";
  const INTERN_SNAPSHOT = () => [
    item({ title: "Pumpe warten", confidentiality: "intern" }),
    item({ title: "Ventil tauschen", confidentiality: "intern" }),
  ];
  const savedPrefilter = process.env.KLARWERK_DUP_PREFILTER;

  beforeEach(() => {
    process.env.KLARWERK_DUP_PREFILTER = "1"; // Embedder-Chokepoint existiert → Spy beweist 0
    embedSpy.calls = 0;
  });

  afterEach(() => {
    if (savedPrefilter === undefined) {
      delete process.env.KLARWERK_DUP_PREFILTER;
    } else {
      process.env.KLARWERK_DUP_PREFILTER = savedPrefilter;
    }
  });

  it("interner Snapshot + FEHLENDE Einstufung → ehrlicher 400 und BEIDE Egress-Spys exakt 0", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(INTERN_SNAPSHOT(), spy.reasoner);
    const res = await app.inject({ ...selectBody({ prompt: PROMPT }), headers });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { message: string }).message).toContain("promptConfidential");
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
    // Auch ein NICHT-boolescher Wert ist keine Einstufung.
    const bad = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: "nein" }),
      headers,
    });
    expect(bad.statusCode).toBe(400);
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
  });

  it("interner Snapshot + VERTRAULICHE Einstufung (Vorgabe Ja/unsicher) → 200, aber 0 Cloud- UND 0 Embedder-Aufrufe", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(INTERN_SNAPSHOT(), spy.reasoner);
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: true }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
    const body = res.json() as { inferenceStatus?: string; fallbackReason?: string };
    expect(body.inferenceStatus).toBe("unavailable"); // Cloud raus, kein lokales Modell → ehrlich
    // WP-SHIP9-S2: ehrlicher Grund "confidential" (Cloud wegen Vertraulichkeit ausgeschlossen).
    expect(body.fallbackReason).toBe("confidential");
  });

  it("POSITIV NUR bei explizit unbedenklichem Prompt UND komplett internem Snapshot (1 Cloud, 0 Embedder)", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(INTERN_SNAPSHOT(), spy.reasoner);
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(1);
    expect(embedSpy.calls).toBe(0);
    expect((res.json() as { inferenceStatus?: string }).inferenceStatus).toBe("ok");
  });

  it("BACKSTOP hebt monoton: unbedenklicher Prompt, aber EIN unklares Item → trotzdem 0/0", async () => {
    const spy = cloudSpyReasoner('{"keywords":["pumpe"]}');
    const { app, headers } = await selectApp(
      [item({ title: "Pumpe warten", confidentiality: "intern" }), item({ title: "Ohne Signal" })],
      spy.reasoner,
    );
    const res = await app.inject({
      ...selectBody({ prompt: PROMPT, promptConfidential: false }),
      headers,
    });
    expect(res.statusCode).toBe(200);
    expect(spy.cloudCalls()).toBe(0);
    expect(embedSpy.calls).toBe(0);
  });

  it("OHNE Satz ist die Einstufung gegenstandslos — reine Klick-Filter laufen ohne das Feld", async () => {
    const { app, headers } = await selectApp(INTERN_SNAPSHOT());
    const res = await app.inject({ ...selectBody({ criteria: {} }), headers });
    expect(res.statusCode).toBe(200);
  });

  it("UI-Verdrahtung: Pflicht-Radio direkt an der Satz-Eingabe, Vorgabe Ja/unsicher, Feld reist immer mit (i18n x3)", () => {
    const src = readFileSync(
      resolve(process.cwd(), "apps/web/src/components/ImportSelect.tsx"),
      "utf8",
    );
    expect(src).toContain("useState(true)"); // Vorgabe: Ja/unsicher (fail-safe)
    expect(src).toContain("promptConfidential,");
    expect(src).toContain('t("imp.select.promptConfidentialLabel")');
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of [
      "imp.select.promptConfidentialLabel",
      "imp.select.promptConfidentialYes",
      "imp.select.promptConfidentialNo",
    ]) {
      expect(i18n.split(`"${key}"`).length - 1, key).toBe(3);
    }
  });
});

// WP-SHIP9-S2c (bens ROT F3): jede Vorschau-Zeile traegt ihre stabile Kandidaten-Id (candidateIdOf,
// bei Anker-Items = externalId) — deckungsgleich mit der Gruppierungs-/Uebernahme-Id. Erst damit kann
// die in der Vorschau getroffene Auswahl die naechsten Schritte steuern.
describe("WP-SHIP9-S2c (F3): Vorschau-Eintraege tragen ihre Kandidaten-Id", () => {
  it("select liefert je Vorschau-Zeile die id (= externalId der Anker-Items)", async () => {
    const { app, headers } = await selectApp([
      item({ title: "Pumpe warten", externalId: "p1" }),
      item({ title: "Ventil tauschen", externalId: "p2" }),
    ]);
    const res = await app.inject({ ...selectBody({ criteria: {} }), headers });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { preview: { id?: string; title: string }[] };
    expect(body.preview.map((p) => p.id)).toEqual(["p1", "p2"]);
  });
});
