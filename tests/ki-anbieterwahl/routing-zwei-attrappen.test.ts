// ================================================================================================
// JOB 3134 · KI-WAHL — NACHWEIS B UND D: DIE WAHL BESTIMMT DEN EMPFÄNGER, UND NUR IHN.
// ================================================================================================
//
// Pedis Befund (06.09., Entscheidung 42): im Dropdown stand „Claude", als aktive KI „ChatGPT". Die
// Auswahl kannte nur EINEN Cloud-Wert, und wer dahinter antwortete, entschied die Fabrik. Hier wird
// nicht die Beschriftung gemessen, sondern der NETZWEG: zwei Transportattrappen, am Endpunkt
// unterscheidbar (api.openai.com / api.anthropic.com), zeichnen jede Anfrage auf. Was Pedi wählt,
// muss der einzige Empfänger sein — bei Erfolg UND bei Fehler (400/401/429/Netz).
//
// DER WEG IST DER DES PRODUKTS: dieselbe Fabrik (`createCappedCloudClientFromEnv`), dieselbe
// Verdrahtung wie `services/app/src/build-app.ts` (Reasoner mit `cloud: { anbieter, gruende }`),
// dieselbe Persistenz-/Zuordnungsschicht (`setTaskConfig`). Kein Netz, kein echter Schlüssel.
import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryModelRunRepo } from "../../services/model-runs";
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import { Reasoner } from "../../services/reasoner/src/service";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_KEY = "sk-test-openai-nur-hier";
const ANTHROPIC_KEY = "ant-test-nur-hier";

const BEIDE_ENV = {
  OPENAI_API_KEY: OPENAI_KEY,
  OPENAI_MODEL: "gpt-4o-mini",
  ANTHROPIC_API_KEY: ANTHROPIC_KEY,
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
};
const NUR_OPENAI_ENV = { OPENAI_API_KEY: OPENAI_KEY, REASONER_MODEL: "gpt-4o-mini" };
const NUR_ANTHROPIC_ENV = {
  ANTHROPIC_API_KEY: ANTHROPIC_KEY,
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
};

const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

interface Anfrage {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/** Wie eine Attrappe antwortet: normal, mit HTTP-Status, oder gar nicht (Netzfehler). */
type Verhalten = { status: number; koerper?: string } | "netz" | undefined;

/**
 * ZWEI TRANSPORTATTRAPPEN in einem `fetch`: am Endpunkt unterscheidbar, jede Anfrage aufgezeichnet.
 * OpenAI antwortet in der /chat/completions-Form („VON-OPENAI"), Anthropic in der /messages-Form
 * („VON-ANTHROPIC") — der Antworttext trägt den Absender, damit ein falscher Empfänger auch am
 * ERGEBNIS auffällt, nicht nur an der URL.
 */
function attrappen(verhalten: { openai?: Verhalten; anthropic?: Verhalten } = {}): Anfrage[] {
  const anfragen: Anfrage[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init: unknown) => {
    const pfad = String(url);
    const opts = (init ?? {}) as { headers?: Record<string, string>; body?: string };
    anfragen.push({
      url: pfad,
      headers: opts.headers ?? {},
      body: opts.body ? (JSON.parse(opts.body) as Record<string, unknown>) : {},
    });
    const seite = pfad.startsWith("https://api.openai.com") ? "openai" : "anthropic";
    const v = verhalten[seite];
    if (v === "netz") {
      throw new TypeError("fetch failed");
    }
    if (v) {
      return {
        ok: false,
        status: v.status,
        text: async () => v.koerper ?? "",
        json: async () => JSON.parse(v.koerper ?? "{}"),
      } as unknown as Response;
    }
    const koerper =
      seite === "openai"
        ? { choices: [{ finish_reason: "stop", message: { content: "VON-OPENAI" } }] }
        : { content: [{ type: "text", text: "VON-ANTHROPIC" }] };
    return { ok: true, status: 200, json: async () => koerper } as unknown as Response;
  }) as unknown as typeof fetch);
  return anfragen;
}

/** Die Verdrahtung des Produkts (`build-app.ts`), Zeile für Zeile nachgebaut. */
function reasonerWieImProdukt(
  env: Record<string, string | undefined>,
  runs = new InMemoryModelRunRepo(),
): { reasoner: Reasoner; runs: InMemoryModelRunRepo } {
  const cappedCloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  const cappedLocal = createCappedLocalClientFromEnv(env);
  const reasoner = new Reasoner(
    undefined,
    undefined,
    runs,
    undefined,
    cappedLocal ? new ModelProvider(cappedLocal) : undefined,
    undefined,
    {
      anbieter: {
        ...(cappedCloud.openai ? { openai: new ModelProvider(cappedCloud.openai) } : {}),
        ...(cappedCloud.anthropic ? { anthropic: new ModelProvider(cappedCloud.anthropic) } : {}),
      },
      gruende: cappedCloud.gruende,
    },
  );
  return { reasoner, runs };
}

const extern = (anfragen: Anfrage[]): Anfrage[] =>
  anfragen.filter((a) => a.url.startsWith("https://"));
const nachOpenAi = (anfragen: Anfrage[]): Anfrage[] =>
  extern(anfragen).filter((a) => a.url === OPENAI_URL);
const nachAnthropic = (anfragen: Anfrage[]): Anfrage[] =>
  extern(anfragen).filter((a) => a.url === ANTHROPIC_URL);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ================================================================================================
// A — DER ROTE AUSGANGSFALL: mit zwei eingerichteten Anbietern bestimmt die Wahl ZWEI Empfänger.
// ================================================================================================
describe("JOB 3134 A: zwei eingerichtete Anbieter, zwei wählbare Empfänger", () => {
  it("A1 · beide eingerichtet: die Konfiguration nennt beide einzeln, „auto“ löst auf genau einen auf", () => {
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    const cfg = reasoner.configStatus();
    expect(cfg.cloudProviders.openai).toEqual({
      configured: true,
      name: "cloud:openai:gpt-4o-mini",
      model: "gpt-4o-mini",
    });
    expect(cfg.cloudProviders.anthropic).toEqual({
      configured: true,
      name: "anthropic:claude-sonnet-4-6",
      model: "claude-sonnet-4-6",
    });
    // Der Vorgabe-Anbieter hinter „auto" ist SICHTBAR, nicht geraten.
    expect(cfg.autoAnbieter).toBe("openai");
    expect(cfg.taskConfig.global).toBe("auto");
    expect(cfg.provider).toBe("cloud:openai:gpt-4o-mini");
    expect(cfg.effectiveAnbieter.assist).toBe("openai");
    expect(cfg.effectiveProvider.assist).toBe("cloud");
  });

  it("A2 · die Wahl kennt beide Anbieter als eigene Werte — und lehnt Unbekanntes weiter ab", async () => {
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "anthropic", perTask: { assist: "openai" } });
    expect(reasoner.getTaskConfig()).toEqual({
      global: "anthropic",
      perTask: { assist: "openai" },
    });
    await expect(
      reasoner.setTaskConfig({ global: "quantum" as never, perTask: {} }),
    ).rejects.toThrow();
  });
});

// ================================================================================================
// B — INTEGRATION MIT ZWEI ATTRAPPEN: OpenAI-Wahl ruft NUR OpenAI, Claude-Wahl NUR Anthropic.
// ================================================================================================
describe("JOB 3134 B: die gespeicherte Wahl ist der einzige Empfänger", () => {
  it("B1 · Wahl ChatGPT: genau eine Anfrage, an api.openai.com, mit dem OpenAI-Schlüssel — null an Anthropic", async () => {
    const anfragen = attrappen();
    const { reasoner, runs } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });

    const ergebnis = await reasoner.assistText("Ein roher Satz.", "de");
    expect(ergebnis).toEqual({ text: "VON-OPENAI", demo: false });
    expect(nachOpenAi(anfragen)).toHaveLength(1);
    expect(nachAnthropic(anfragen)).toHaveLength(0);
    expect(extern(anfragen)).toHaveLength(1);
    expect(nachOpenAi(anfragen)[0]?.headers.authorization).toBe(`Bearer ${OPENAI_KEY}`);
    expect(nachOpenAi(anfragen)[0]?.body.model).toBe("gpt-4o-mini");

    // Die HERKUNFT im Laufprotokoll nennt denselben Empfänger.
    const laeufe = await runs.recent(5);
    expect(laeufe).toHaveLength(1);
    expect(laeufe[0]?.provider).toBe("cloud:openai:gpt-4o-mini");
    expect(laeufe[0]?.model).toBe("gpt-4o-mini");
    // Und die Anzeige-Quelle sagt dasselbe.
    const cfg = reasoner.configStatus();
    expect(cfg.provider).toBe("cloud:openai:gpt-4o-mini");
    expect(cfg.effectiveAnbieter.assist).toBe("openai");
  });

  it("B2 · Wahl Claude: genau eine Anfrage, an api.anthropic.com, mit x-api-key — null an OpenAI", async () => {
    const anfragen = attrappen();
    const { reasoner, runs } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });

    const ergebnis = await reasoner.assistText("Ein roher Satz.", "de");
    expect(ergebnis).toEqual({ text: "VON-ANTHROPIC", demo: false });
    expect(nachAnthropic(anfragen)).toHaveLength(1);
    expect(nachOpenAi(anfragen)).toHaveLength(0);
    expect(nachAnthropic(anfragen)[0]?.headers["x-api-key"]).toBe(ANTHROPIC_KEY);
    expect(nachAnthropic(anfragen)[0]?.body.model).toBe("claude-sonnet-4-6");

    const laeufe = await runs.recent(5);
    expect(laeufe[0]?.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(laeufe[0]?.model).toBe("claude-sonnet-4-6");
    const cfg = reasoner.configStatus();
    expect(cfg.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(cfg.effectiveAnbieter.assist).toBe("anthropic");
    // Die alte Vorzugsregel (OpenAI vor Anthropic) greift NICHT mehr: beide sind eingerichtet, und
    // trotzdem ist der Empfänger der gewählte.
    expect(cfg.cloudProviders.openai.configured).toBe(true);
  });

  it("B3 · Wechsel der Wahl wechselt den Empfänger ab der nächsten Anfrage — in beide Richtungen", async () => {
    const anfragen = attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    await reasoner.assistText("eins", "de");
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    await reasoner.assistText("zwei", "de");
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    await reasoner.assistText("drei", "de");
    expect(extern(anfragen).map((a) => a.url)).toEqual([OPENAI_URL, ANTHROPIC_URL, OPENAI_URL]);
  });

  it("B4 · je Aufgabe abweichend: die Aufgabe geht an ihren Anbieter, die anderen an den globalen; Zurücksetzen wirkt", async () => {
    const anfragen = attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "openai", perTask: { assist: "anthropic" } });
    const cfg = reasoner.configStatus();
    expect(cfg.effectiveAnbieter.assist).toBe("anthropic");
    expect(cfg.effectiveAnbieter.structure).toBe("openai");
    // Das globale „aktiv" bleibt ChatGPT — die Abweichung steht EIGENS in der Konfiguration.
    expect(cfg.provider).toBe("cloud:openai:gpt-4o-mini");
    expect(cfg.taskConfig.perTask).toEqual({ assist: "anthropic" });

    await reasoner.assistText("Palette", "de");
    await reasoner.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de");
    expect(extern(anfragen).map((a) => a.url)).toEqual([ANTHROPIC_URL, OPENAI_URL]);

    // Zurück auf „wie global": der Schlüssel ist WEG, nicht nur überschrieben.
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    expect(reasoner.configStatus().taskConfig.perTask).toEqual({});
    expect(reasoner.configStatus().effectiveAnbieter.assist).toBe("openai");
    await reasoner.assistText("Palette", "de");
    expect(extern(anfragen).at(-1)?.url).toBe(OPENAI_URL);
  });

  it("B5 · der KI-Prüfknopf prüft den GEWÄHLTEN Anbieter und nennt ihn", async () => {
    const anfragen = attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    const probe = await reasoner.probe();
    expect(probe.ok).toBe(true);
    expect(probe.anbieter).toBe("anthropic");
    expect(probe.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(extern(anfragen).map((a) => a.url)).toEqual([ANTHROPIC_URL]);

    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    const probe2 = await reasoner.probe();
    expect(probe2.anbieter).toBe("openai");
    expect(probe2.provider).toBe("cloud:openai:gpt-4o-mini");
    expect(extern(anfragen).map((a) => a.url)).toEqual([ANTHROPIC_URL, OPENAI_URL]);
  });

  it("B6 · Erreichbarkeit wird je Anbieter geführt: ein unerreichbares ChatGPT sperrt Claude nicht", async () => {
    attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    reasoner.recordReachability(false, "openai");
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    expect(reasoner.publicStatus().tasks.structure).toBe(false);
    expect(reasoner.publicStatus().billable.structure).toBe(false);
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    expect(reasoner.publicStatus().tasks.structure).toBe(true);
    expect(reasoner.publicStatus().billable.structure).toBe(true);
  });

  it("B7 · „auto“ nimmt GENAU EINEN externen Anbieter — nie beide in einer Kette", async () => {
    const anfragen = attrappen({ openai: { status: 500 } });
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    // global bleibt „auto" (Default) — der Vorgabe-Anbieter ist OpenAI und scheitert.
    const ergebnis = await reasoner.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de");
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.fallbackReason).toBe("model-error");
    expect(nachOpenAi(anfragen)).toHaveLength(1);
    // Kein Ausweichen auf den zweiten externen Anbieter.
    expect(nachAnthropic(anfragen)).toHaveLength(0);
  });
});

// ================================================================================================
// D — FEHLER BEIM GEWÄHLTEN ANBIETER: ehrlicher Zustand, KEIN Aufruf des anderen, keine Geheimnisse.
// ================================================================================================
describe("JOB 3134 D: Fehler beim gewählten Anbieter wechseln den Anbieter nicht", () => {
  for (const [name, verhalten, erwartet] of [
    [
      "400 (falsches Modell)",
      {
        status: 400,
        koerper: '{"error":{"message":"model x does not exist","code":"model_not_found"}}',
      },
      "model-error",
    ],
    ["401 (Schlüssel abgelehnt)", { status: 401 }, "model-error"],
    ["429 (Kontingent)", { status: 429 }, "model-error"],
    ["Netzfehler", "netz", "model-error"],
  ] as const) {
    it(`D1 · ChatGPT gewählt, OpenAI antwortet mit ${name}: Ersatz ehrlich, null Anfragen an Anthropic`, async () => {
      const anfragen = attrappen({ openai: verhalten });
      const { reasoner, runs } = reasonerWieImProdukt(BEIDE_ENV);
      await reasoner.setTaskConfig({ global: "openai", perTask: {} });
      const ergebnis = await reasoner.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de");
      expect(ergebnis.demo).toBe(true);
      expect(ergebnis.fallbackReason).toBe(erwartet);
      expect(nachOpenAi(anfragen)).toHaveLength(1);
      expect(nachAnthropic(anfragen)).toHaveLength(0);
      // Der Fehlerdatensatz nennt das versuchte Modell — und keinen Schlüssel.
      const laeufe = await runs.recent(5);
      const text = JSON.stringify(laeufe);
      expect(text).not.toContain(OPENAI_KEY);
      expect(text).not.toContain(ANTHROPIC_KEY);
    });

    it(`D2 · Claude gewählt, Anthropic antwortet mit ${name}: Ersatz ehrlich, null Anfragen an OpenAI`, async () => {
      const anfragen = attrappen({ anthropic: verhalten });
      const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
      await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
      const ergebnis = await reasoner.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de");
      expect(ergebnis.demo).toBe(true);
      expect(ergebnis.fallbackReason).toBe(erwartet);
      expect(nachAnthropic(anfragen)).toHaveLength(1);
      expect(nachOpenAi(anfragen)).toHaveLength(0);
    });
  }

  it("D3 · die Probe beim gescheiterten Anbieter nennt Status und Anbieter, aber keinen Schlüssel", async () => {
    attrappen({
      openai: {
        status: 401,
        koerper: `{"error":{"message":"Incorrect API key provided: ${OPENAI_KEY}","code":"invalid_api_key"}}`,
      },
    });
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    const probe = await reasoner.probe();
    expect(probe.ok).toBe(false);
    expect(probe.anbieter).toBe("openai");
    expect(probe.detail).toContain("antwortete mit 401");
    expect(probe.detail).not.toContain(OPENAI_KEY);
    expect(probe.detail).not.toContain(ANTHROPIC_KEY);
  });

  it("D4 · gewählter Anbieter nicht eingerichtet: ehrlicher Zustand mit Grund, null externe Anfragen", async () => {
    const anfragen = attrappen();
    const { reasoner } = reasonerWieImProdukt(NUR_OPENAI_ENV);
    const vorher = reasoner.configStatus();
    expect(vorher.cloudProviders.anthropic.configured).toBe(false);
    expect(vorher.cloudProviders.anthropic.grund).toContain("ANTHROPIC_API_KEY");
    expect(vorher.cloudProviders.anthropic.grund).not.toContain(OPENAI_KEY);

    // Die Wahl wird gespeichert (Pedi darf wählen), aber sie ist nicht AKTIV — und das steht da.
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    const cfg = reasoner.configStatus();
    expect(cfg.taskConfig.global).toBe("anthropic");
    expect(cfg.provider).toBe("deterministic");
    expect(cfg.mode).toBe("demo");
    expect(cfg.effectiveAnbieter.structure).toBe("deterministic");

    const ergebnis = await reasoner.structure("Protokoll: Pumpe P2 alle 200 h schmieren.", "de");
    expect(ergebnis.demo).toBe(true);
    expect(ergebnis.fallbackReason).toBe("no-model");
    expect(extern(anfragen)).toHaveLength(0);

    const probe = await reasoner.probe();
    expect(probe.ok).toBe(false);
    expect(probe.anbieter).toBe("anthropic");
    expect(probe.detail).toContain("Claude (Anthropic) ist nicht eingerichtet");
    expect(probe.detail).toContain("ANTHROPIC_API_KEY");
  });

  it("D5 · vertrauliche Eingabe ohne Freigabe: null externe Übertragungen — bei BEIDEN Anbietern", async () => {
    for (const wahl of ["openai", "anthropic"] as const) {
      const anfragen = attrappen();
      const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
      await reasoner.setTaskConfig({ global: wahl, perTask: {} });
      const ergebnis = await reasoner.structure("Vertrauliche Rezeptur: 3 % Zusatz Z.", "de", true);
      expect([wahl, ergebnis.demo]).toEqual([wahl, true]);
      expect([wahl, ergebnis.fallbackReason]).toEqual([wahl, "confidential"]);
      expect([wahl, extern(anfragen).length]).toEqual([wahl, 0]);
      vi.unstubAllGlobals();
    }
  });

  it("D6 · eine bereits laufende Anfrage behält ihre Herkunft, auch wenn die Wahl währenddessen wechselt", async () => {
    let freigeben: (() => void) | undefined;
    const warten = new Promise<void>((r) => {
      freigeben = r;
    });
    const anfragen: string[] = [];
    vi.stubGlobal("fetch", (async (url: unknown) => {
      const pfad = String(url);
      anfragen.push(pfad);
      if (pfad === OPENAI_URL) {
        await warten;
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "VON-OPENAI" } }] }),
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: "text", text: "VON-ANTHROPIC" }] }),
      } as unknown as Response;
    }) as unknown as typeof fetch);
    const { reasoner, runs } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig({ global: "openai", perTask: {} });
    const laufend = reasoner.assistText("alt", "de");
    await new Promise((r) => setTimeout(r, 0));
    await reasoner.setTaskConfig({ global: "anthropic", perTask: {} });
    freigeben?.();
    const alt = await laufend;
    const neu = await reasoner.assistText("neu", "de");
    expect(alt.text).toBe("VON-OPENAI");
    expect(neu.text).toBe("VON-ANTHROPIC");
    expect(anfragen).toEqual([OPENAI_URL, ANTHROPIC_URL]);
    const laeufe = await runs.recent(5);
    expect(laeufe.map((l) => l.provider).sort()).toEqual([
      "anthropic:claude-sonnet-4-6",
      "cloud:openai:gpt-4o-mini",
    ]);
  });
});

// ================================================================================================
// N — DIE NEBENWEGE (bens Befund R2): Weltwissen, Konflikt-/Dublettenurteil, Auswahl und Status
// lesen DIESELBE Wahl wie die Aufgaben. Bis Runde 2 fiel `judgeCloud()` bei fehlendem gewähltem
// Client auf den Vorgabe-Anbieter zurück — „Claude gewählt, Anthropic fehlt" ging an OpenAI.
// ================================================================================================
describe("JOB 3134 N: die Nebenwege folgen derselben Wahl — Weltwissen, Urteile, Auswahl, Status", () => {
  const nebenwege = async (reasoner: Reasoner): Promise<void> => {
    await reasoner.enrichPublic("Unkritische Testfrage", "de");
    await reasoner.judgeConflictOutcome("Pumpe täglich warten", "Pumpe wöchentlich warten", "de");
    await reasoner.judgeDuplicateOutcome("Pumpe täglich warten", "Pumpe täglich warten.", "de");
    reasoner.select("Pumpe", []);
    await new Promise((r) => setTimeout(r, 2));
  };

  for (const [name, env, wahl] of [
    ["Claude gewählt, nur OpenAI eingerichtet", NUR_OPENAI_ENV, "anthropic"],
    ["ChatGPT gewählt, nur Anthropic eingerichtet", NUR_ANTHROPIC_ENV, "openai"],
  ] as const) {
    it(`N1 · ${name}: Weltwissen, beide Urteile und die Auswahl senden NICHTS an den anderen Anbieter — und sagen „no-model“`, async () => {
      const anfragen = attrappen();
      const { reasoner, runs } = reasonerWieImProdukt(env);
      await reasoner.setTaskConfig({ global: wahl, perTask: {} });

      const welt = await reasoner.enrichPublic("Unkritische Testfrage", "de");
      expect(welt).toEqual({ text: "", provider: "deterministic", demo: true });
      const konflikt = await reasoner.judgeConflictOutcome("A täglich", "A wöchentlich", "de");
      expect(konflikt).toEqual({ verdict: null, failure: "no-model" });
      const dublette = await reasoner.judgeDuplicateOutcome("A täglich", "A täglich.", "de");
      expect(dublette).toEqual({ verdict: null, failure: "no-model" });
      reasoner.select("Pumpe", []);
      await new Promise((r) => setTimeout(r, 2));

      expect(extern(anfragen)).toEqual([]);
      const laeufe = await runs.recent(5);
      expect(laeufe.map((l) => [l.task, l.provider])).toEqual([["select", "deterministic"]]);
      // Status, Konfiguration und Laufdatensatz nennen denselben Empfänger.
      expect(reasoner.status()).toEqual({
        active: false,
        provider: "deterministic",
        mode: "deterministic",
      });
      expect(reasoner.configStatus().provider).toBe("deterministic");
    });
  }

  for (const [wahl, url] of [
    ["openai", OPENAI_URL],
    ["anthropic", ANTHROPIC_URL],
  ] as const) {
    it(`N2 · ${wahl} gewählt, beide eingerichtet: Weltwissen und beide Urteile gehen NUR an ${new URL(url).host}`, async () => {
      const anfragen = attrappen();
      const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
      await reasoner.setTaskConfig({ global: wahl, perTask: {} });
      await nebenwege(reasoner);
      // drei Modellaufrufe (Weltwissen, Konflikt, Dublette); `select` ist Schlagwort-Rangfolge ohne Netz.
      expect(extern(anfragen).map((a) => a.url)).toEqual([url, url, url]);
      expect(reasoner.status().provider).toBe(reasoner.configStatus().provider);
    });
  }

  it("N3 · Auswahl (select): Globalwahl, Aufgabenabweichung, Zurücksetzen und Regelbasiert — Statuskarte und Laufdatensatz nennen denselben Anbieter", async () => {
    const anfragen = attrappen();
    const { reasoner, runs } = reasonerWieImProdukt(BEIDE_ENV);
    const schritte = [
      [{ global: "openai", perTask: {} }, "openai", "cloud:openai:gpt-4o-mini"],
      [
        { global: "openai", perTask: { select: "anthropic" } },
        "anthropic",
        "anthropic:claude-sonnet-4-6",
      ],
      [{ global: "openai", perTask: {} }, "openai", "cloud:openai:gpt-4o-mini"],
      [{ global: "deterministic", perTask: {} }, "deterministic", "deterministic"],
    ] as const;
    for (const [konfig, anbieter, provider] of schritte) {
      await reasoner.setTaskConfig(konfig);
      expect(reasoner.configStatus().effectiveAnbieter.select).toBe(anbieter);
      reasoner.select("Pumpe", []);
      await new Promise((r) => setTimeout(r, 2));
      const letzter = (await runs.recent(1))[0];
      expect([anbieter, letzter?.task, letzter?.provider]).toEqual([anbieter, "select", provider]);
    }
    expect((await runs.recent(10)).map((l) => l.provider)).toEqual([
      "deterministic",
      "cloud:openai:gpt-4o-mini",
      "anthropic:claude-sonnet-4-6",
      "cloud:openai:gpt-4o-mini",
    ]);
    // `select` ist Schlagwort-Rangfolge: kein Netzaufruf, auch bei Cloud-Zuordnung.
    expect(extern(anfragen)).toEqual([]);
  });

  it("N4 · vertrauliches Paar bei expliziter Wahl: das Urteil sagt „confidential“, null externe Übertragungen — bei beiden Anbietern", async () => {
    for (const wahl of ["openai", "anthropic"] as const) {
      const anfragen = attrappen();
      const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
      await reasoner.setTaskConfig({ global: wahl, perTask: {} });
      const konflikt = await reasoner.judgeConflictOutcome(
        "Rezeptur 3 %",
        "Rezeptur 4 %",
        "de",
        true,
      );
      expect([wahl, konflikt]).toEqual([wahl, { verdict: null, failure: "confidential" }]);
      expect([wahl, extern(anfragen).length]).toEqual([wahl, 0]);
      vi.unstubAllGlobals();
    }
  });
});
