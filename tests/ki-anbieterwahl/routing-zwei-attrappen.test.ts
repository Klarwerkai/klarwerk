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
// JOB 3550: die Adminfreigabe für öffentliche KI (JOB 3549) gehört zur Verdrahtung, die dieser Test
// nachbaut. Sie steht an JEDER Stelle, die einen echten Weg nach draußen misst — und an keiner, die
// eine Sperre misst. Welche Stelle welche ist, hält der Wächter am Ende dieser Datei namentlich fest.
import {
  erteileKiFreigabe,
  mitKiFreigabe,
} from "../../services/reasoner/src/testhelfer-ki-freigabe";

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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));

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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));

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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    await reasoner.assistText("eins", "de");
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
    await reasoner.assistText("zwei", "de");
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    await reasoner.assistText("drei", "de");
    expect(extern(anfragen).map((a) => a.url)).toEqual([OPENAI_URL, ANTHROPIC_URL, OPENAI_URL]);
  });

  it("B4 · je Aufgabe abweichend: die Aufgabe geht an ihren Anbieter, die anderen an den globalen; Zurücksetzen wirkt", async () => {
    const anfragen = attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig(
      mitKiFreigabe({ global: "openai", perTask: { assist: "anthropic" } }),
    );
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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    expect(reasoner.configStatus().taskConfig.perTask).toEqual({});
    expect(reasoner.configStatus().effectiveAnbieter.assist).toBe("openai");
    await reasoner.assistText("Palette", "de");
    expect(extern(anfragen).at(-1)?.url).toBe(OPENAI_URL);
  });

  it("B5 · der KI-Prüfknopf prüft den GEWÄHLTEN Anbieter und nennt ihn", async () => {
    const anfragen = attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
    const probe = await reasoner.probe();
    expect(probe.ok).toBe(true);
    expect(probe.anbieter).toBe("anthropic");
    expect(probe.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(extern(anfragen).map((a) => a.url)).toEqual([ANTHROPIC_URL]);

    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    const probe2 = await reasoner.probe();
    expect(probe2.anbieter).toBe("openai");
    expect(probe2.provider).toBe("cloud:openai:gpt-4o-mini");
    expect(extern(anfragen).map((a) => a.url)).toEqual([ANTHROPIC_URL, OPENAI_URL]);
  });

  it("B6 · Erreichbarkeit wird je Anbieter geführt: ein unerreichbares ChatGPT sperrt Claude nicht", async () => {
    attrappen();
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    reasoner.recordReachability(false, "openai");
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    expect(reasoner.publicStatus().tasks.structure).toBe(false);
    expect(reasoner.publicStatus().billable.structure).toBe(false);
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
    expect(reasoner.publicStatus().tasks.structure).toBe(true);
    expect(reasoner.publicStatus().billable.structure).toBe(true);
  });

  it("B7 · „auto“ nimmt GENAU EINEN externen Anbieter — nie beide in einer Kette", async () => {
    const anfragen = attrappen({ openai: { status: 500 } });
    const { reasoner } = reasonerWieImProdukt(BEIDE_ENV);
    // global bleibt „auto" (Default) — der Vorgabe-Anbieter ist OpenAI und scheitert.
    // JOB 3550: genau deshalb hier `erteileKiFreigabe` und kein `setTaskConfig` — die Vorgabe ist
    // der Gegenstand dieses Falls und darf nicht durch das Erteilen der Freigabe verlorengehen.
    await erteileKiFreigabe(reasoner);
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
      await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
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
      await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
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
      await reasoner.setTaskConfig(mitKiFreigabe({ global: wahl, perTask: {} }));
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
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "openai", perTask: {} }));
    const laufend = reasoner.assistText("alt", "de");
    await new Promise((r) => setTimeout(r, 0));
    await reasoner.setTaskConfig(mitKiFreigabe({ global: "anthropic", perTask: {} }));
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
      await reasoner.setTaskConfig(mitKiFreigabe({ global: wahl, perTask: {} }));

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
      await reasoner.setTaskConfig(mitKiFreigabe({ global: wahl, perTask: {} }));
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
      await reasoner.setTaskConfig(mitKiFreigabe(konfig));
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
      await reasoner.setTaskConfig(mitKiFreigabe({ global: wahl, perTask: {} }));
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

// ================================================================================================
// F — DER FREIGABE-WÄCHTER (JOB 3550, Pflichtlieferung 4): DIE FREIGABE BLEIBT DIE AUSNAHME.
// ================================================================================================
//
// DER FEHLER, GEGEN DEN DIESER BLOCK STEHT, ist nicht theoretisch. JOB 3549 baut eine Sperre, und
// 267 Bestandsfälle wurden an ihr rot (JOB 3500, `archiv/3500/runde-3/code.md`). Der billigste Weg
// aus so einer Lage ist immer derselbe: die Freigabe pauschal überall in den Aufbau schreiben, dann
// ist alles wieder grün. Danach misst kein Test mehr die Sperre — sie wäre gebaut, bezahlt und
// unbewacht.
//
// Deshalb ist die Freigabe hier eine NAMENTLICHE Erlaubnis, kein Vorgabewert:
//
//   F1  Nur die im Register genannten Testdateien dürfen den Helfer überhaupt benutzen.
//       Eine neue Datei, die ihn benutzt, ist rot, bis jemand sie mit Grund einträgt.
//   F2  Niemand schreibt die Freigabefelder von Hand — sonst wäre F1 in einer Zeile zu umgehen.
//       Das ist zugleich die Zusage aus Auftrag §3.1: EINE Stelle, nicht 267 Kopien.
//   F3  Die Sperr-Fälle dieser Datei stehen namentlich da, ungesprungen, mit GENAU der Freigabe,
//       die ihnen zusteht — und mit ihrer Null-Erwartung.
//   F4  Je EINZELNEM Testfall der drei angefassten Dateien: der Erwartungsboden und die
//       vollzählige Liste der erlaubten Freigabe-Aufrufe (Auftrag §3.3: „KEINE Aufweichung").
//   F5  Der Vertrag des Helfers, gemessen statt behauptet (Auftrag §4).
//   F6  Jede Datei der Fläche steht in EINEM der drei Register — jede künftige kostet eine
//       Entscheidung statt eines stillen Rots im Tor (eigener Abschnitt weiter unten).
//   F7  NAMENTLICH geführte Erwartungen stehen im Code da, nicht in einer Zeichenkette: Datei,
//       Testname, Wortlaut. Nicht
//       „die Summe stimmt noch", sondern „genau diese Zeile läuft" (eigener Abschnitt weiter unten).
//
// WAS RUNDE 2 AN DIESEM BLOCK GEÄNDERT HAT — drei nachgewiesene Löcher, alle von Prüfer BEN
// gemessen und nicht vermutet:
//   (a) F3 verlangte nur, dass bestimmte Zeilen DA sind. Eine ZUSÄTZLICHE
//       `erteileKiFreigabe(reasoner, { … })` im Sperr-Fall D5 ließ es kalt. Jetzt ist die Liste der
//       Freigabe-Aufrufe je Fall eine GLEICHHEIT: mehr ist so rot wie weniger.
//   (b) F4 zählte eine Dateisumme — in die zählten die Erwartungen dieses Wächters mit. Eine
//       gelöschte Bestandserwartung in B1 verschwand darin spurlos. Jetzt wird der BESTANDSTEIL
//       gezählt (dieser Block ist abgeschnitten), und zwar je Fall einzeln.
//   (c) F2 nahm diese ganze Datei aus. Ausgerechnet ihre eigenen Sperr-Fälle waren damit unbewacht.
//       Jetzt ist nur noch der Block ab der Überschrift oben ausgenommen.
//
// WAS JOB 3570 RUNDE 2 GEÄNDERT HAT — zwei Löcher, beide von Prüfer BEN an echtem Material
// gemessen (Runde 1, Korrekturpflichten 1 und 2):
//   (d) F4 zählte `expect(` im ROHTEXT, Kommentare eingeschlossen. BEN löschte in
//       `tests/ki-lauf-verbrauch/ehrlich.test.ts` einzeln `expect(laeufe).toHaveLength(1)` und
//       `expect(datensatz.status).toBe("error")` — beide Male blieben alle 38 Fälle grün, weil die
//       Prosa in `:65` den Boden mitfüllte (roh 14 gegen ausführbar 13). Gezählt wird jetzt nur
//       noch AUSFÜHRBARER Code; `nurCode` blendet Kommentare längentreu aus.
//   (e) Führte eine Datei ihre Freigabe im VORSPANN, war jeder ihrer Fälle betroffen, aber keiner
//       einzeln geführt — V3c hing allein am Dateiboden, und eine zusätzliche Erwartung in einem
//       anderen Fall hätte seinen Verlust ausgeglichen. F4 verlangt jetzt: VORSPANN gibt frei →
//       die Datei ist vollzählig zu führen.
//
// WAS JOB 3570 RUNDE 3 GEÄNDERT HAT — ein Loch, wieder von Prüfer BEN an echtem Material gemessen
// (Runde 2, Korrekturpflicht 1):
//   (f) (d) blendete Kommentare aus, Zeichenketten nicht. BEN hat in
//       `tests/ki-lauf-verbrauch/ehrlich.test.ts:121` die Prüfung `expect(datensatz.status)`
//       `.toBe("error")` durch `void 'expect(…)';` ersetzt — dieselben Zeichen, nur als
//       Zeichenkette — und alle 38 Fälle blieben grün: der Wortlaut bezahlte den Boden weiter.
//       `nurCode` hat jetzt ZWEI Stufen. Erkannt wird auf der Stufe, die Literale ERHÄLT (Fallköpfe
//       und Freigabe-Argumente sind Zeichenketten), GEZÄHLT auf der Stufe, die den Inhalt von
//       ZEICHENKETTEN und VORLAGEN leert. Beide sind längentreu auf derselben Quelle, und F4 prüft
//       diese Gleichlage je Datei nach, ehe es sich auf sie verlässt. Was in `${…}` steht, läuft
//       und zählt weiter mit.
//
// WAS JOB 3570 RUNDE 4 GEÄNDERT HAT — eine Zusicherung wird ZURÜCKGENOMMEN, auf Weisung der
// Steuerung vom 11.09. („der Wächter wird kleiner, nicht noch einmal versucht"):
//   (g) Runde 3 leerte auch den Inhalt von REGEX-Literalen und nannte das Ergebnis die
//       „literalfreie Stufe". Die Zusicherung trug nicht: ein Regex-Literal fängt an einem `/` an,
//       das ohne Parser nicht von einer Division zu unterscheiden ist, und BEN hat mit
//       `void /expect(datensatz.status).toBe("error");/;` genau diese Stelle getroffen — F4 und F7
//       blieben grün. Statt es ein viertes Mal mit Zeichenvergleichen zu versuchen, leert die
//       zählende Stufe Regex-Literale jetzt GAR NICHT MEHR, und die verbleibende Lücke steht
//       ausdrücklich als gemessener Fall in den Kalibrierungen von F4 und F7: ein Wortlaut in einem
//       Regex-Literal bezahlt den Boden weiter. Was F4 und F7 TRAGEN, ist damit unverändert und
//       dreifach belegt (Prüfer BEN, Runde 3): namentlicher Schutz, Löschprobe, Stringprobe. Die
//       Unterscheidung „ausführbar oder nur Wortlaut" gehört einem Folgeauftrag mit AST-Prüfung;
//       sie ist eine Parseraufgabe und keine Textsuche.
//
// WAS JOB 3586 GEÄNDERT HAT — der Folgeauftrag aus (g) ist eingelöst:
//   (h) F4 und F7 vergleichen keine Zeichen mehr, sondern fragen den SYNTAXBAUM. Was zählt, ist ein
//       `expect(…)`-AUFRUF im Baum von `tests/waechter-ast/erwartungsstellen.ts`. Ein Kommentar
//       steht dort nicht, der Inhalt einer Zeichenkette ist ein Textknoten, der Inhalt eines
//       Regex-Literals ebenso — alle drei Umgehungen aus den Runden 1 bis 3 fallen damit in EINEM
//       Schritt weg statt einzeln nachgepflegt zu werden, und dazu der syntaktisch tote Zweig. Die
//       zweite Abtaststufe (`literale: "leeren"`) ist ERSATZLOS ENTFERNT: sie war der abgelöste
//       Weg, und zwei Wege nebeneinander wären wieder eine Lücke. `nurCode` blendet nur noch
//       Kommentare aus — dafür wird es weiter gebraucht (Fallgrenzen, F3, F6). Die vier Proben, an
//       denen JOB 3570 gescheitert ist, stehen als dauerhafte Testfälle in `tests/waechter-ast/`.
//   (i) Die STÜCKZAHL der Freigabe-Aufrufe je Datei (`freigaben`) und ihre Wortlautliste (`formen`)
//       sind gestrichen. Sie waren Gleichheiten über Zahlen und brachen bei jeder ehrlichen
//       Erweiterung — JOB 3588 hat 29 Bestandsdateien richtig versorgt, und dieser Wächter meldete
//       Rot (Hinweis der Steuerung 11.09. 09:5x). An ihre Stelle tritt eine Regel: erteilen ist
//       erlaubt, die Freigabe SELBST setzen nicht (F4, `setztFreigabeSelbst`) — und ein SPERRFALL
//       steht namentlich in `faelle` mit `freigaben: []`. Ausführlich bei `Dateiakte`.
//
// WAS JOB 3588 GEÄNDERT HAT — nur die beiden REGISTER, keine Regel:
//   (j) Vierundzwanzig Bestandsdateien sind dazugekommen, je mit Grund (FREIGABE_ERLAUBT) und
//       Fallakte (FALLAKTEN). Sie sind der Rest des Nachtrags: JOB 3550 versorgte drei Dateien,
//       JOB 3570 einunddreißig, und diese vierundzwanzig gehörten bis heute niemandem. Die Zahlen
//       sind mit DIESEM Wächter gemessen, nicht abgeschätzt. Damit ist F1 wieder in beiden
//       Richtungen wahr: kein Benutzer ohne Eintrag, kein Eintrag ohne Träger.
//   (k) NICHT dazugekommen sind vier Dateien, die die Freigabe ebenfalls bräuchten und sie auf
//       keinem erlaubten Weg bekommen können: `services/app/src/routes/check-text-routes.test.ts`,
//       `services/app/src/routes/reasoner-egress.test.ts`, `services/ask/src/service.test.ts` und
//       `services/ask/src/ka4-vertraulich-im-erlaubten-zweig.test.ts`. Der Helfer liegt hinter der
//       Modulgrenze (`.dependency-cruiser.cjs:16-27`, gemessen mit `depcruise`), und die Felder von
//       Hand zu schreiben verbietet F2 — auch in der Nutzlast des echten Adminwegs. JOB 3588
//       Runde 1 hatte genau das getan und ist hier rot geworden; die Regel bleibt, der Punkt bleibt
//       offen und steht im Kopf der jeweiligen Datei mit Messung und kleinstem Umbau.
//
// WARUM DIESER BLOCK IN DIESER DATEI STEHT und nicht in einer eigenen: die Zielpfade des Auftrags
// zählen 57 Testdateien EINZELN auf (Auftrag §2b, mit Begründung — ein breiter Pfad hätte fünf
// andere laufende Aufträge blockiert). Eine neue Datei läge außerhalb davon. Diese Datei trägt alle
// Sperr-Fälle, die F3 bewacht, und ist damit der nächstgelegene Ort im erlaubten Rahmen.
//
// AUSDRÜCKLICHE GRENZE: `tests/admin-ki-freigabe/**` steht außerhalb der Fläche. Diese Dateien
// gehören dem Kern JOB 3549 und dürfen die Feldnamen selbstverständlich schreiben — sie sind das
// Modul, nicht sein Benutzer.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type {
  ReasonerTaskConfig,
  ReasonerTaskConfigEingabe,
} from "../../services/reasoner/src/types";
import {
  type Erwartungsbefund,
  erwartungLaeuft,
  erwartungsstellen,
  zaehleErwartungen,
} from "../waechter-ast/erwartungsstellen";

/** Der Modulname, an dem eine Benutzung des Helfers erkennbar ist. */
const HELFER = "testhelfer-ki-freigabe";

/** Diese Datei selbst — sie bewacht, also darf sie die Namen nennen und den Vertrag messen. */
const DIESE_DATEI = "tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts";

/** Der Kern (JOB 3549) mitsamt seinen eigenen Tests: nicht Benutzer, sondern Eigentümer. */
const KERN = "tests/admin-ki-freigabe/";

/**
 * DAS REGISTER · wer die KI-Freigabe im Testaufbau setzen darf — je Zeile mit Grund.
 *
 * Der Grund ist Pflicht und nicht Schmuck: eine Ausnahme ohne Begründung ist der Anfang vom Ende
 * des Wächters (dieselbe Doktrin wie `tests/capture/aufrufer-waechter.test.ts`, REGISTER 1).
 */
const FREIGABE_ERLAUBT: ReadonlyMap<string, string> = new Map([
  [
    "tests/review26-teilpruefung-ursache/fixture.ts",
    "JOB 3484 misst echte Judge-Ausgänge bis zum Runner: ohne Grundfreigabe entstünde no-model " +
      "statt des injizierten Providerfehlers. Vertrauliche Paare bleiben gesperrt; der Aufbau " +
      "erteilt ausschließlich die Grundfreigabe, nie eine Freigabe vertraulicher Inhalte.",
  ],
  [
    "tests/review26-teilpruefung-ursache/ursache-je-klasse.test.ts",
    "JOB 3484 baut für die Gegenlage Cloud ausgeschlossen plus lokaler Netzfehler einen eigenen " +
      "Reasoner. Die Grundfreigabe erhält den normalen Aufbau; die Cloud-Null und der echte lokale " +
      "Aufruf bleiben gepinnt. Der widersprüchliche Outcome wird separat ohne Erweiterung injiziert.",
  ],
  [
    DIESE_DATEI,
    "Misst den NETZWEG mit zwei Transportattrappen: ohne Grundfreigabe ginge nichts hinaus und " +
      "B1–B7/D1–D6/N2–N3 prüften nur noch die Sperre statt der Empfängerwahl. A2 bekommt gar " +
      "keine Freigabe, D5 und N4 nur die Grundfreigabe und nie mehr — namentlich in F3.",
  ],
  [
    "tests/openai-cloud-anbieter/cloud-wahl-verbindungstest.test.tsx",
    "V2/V3 prüfen die echte Zieladresse eines Modellaufrufs (api.openai.com). Ein Aufruf, der nie " +
      "stattfindet, hat keine Adresse — ohne Freigabe misst der Verbindungstest nichts.",
  ],
  [
    "tests/ask/job2659-ask-seite-mounted.test.tsx",
    "Fährt die echte Kette KoService → AskService → Reasoner bis in die gemountete Seite; nur das " +
      "Modell ist ein Fake. Ohne Freigabe antwortet der deterministische Ersatz, und U4–U8c prüfen " +
      "nicht mehr Quellenwortlaut gegen Prosa (JOB 3500: 5 rote Fälle genau dort).",
  ],
  // ---- JOB 3570 · DER NACHTRAG. Zweiunddreißig Bestandsdateien, je mit ihrem eigenen Grund. ----
  [
    "tests/reasoner/dual-provider.test.ts",
    'Die Kette Cloud → lokal → deterministischer Ersatz, gemessen an der ANTWORT ("CLOUD", ' +
      '"LOCAL"). Ohne Grundfreigabe fällt die Cloud aus jeder Kette, und die vier Fälle prüften ' +
      "nicht mehr die Reihenfolge der Backends, sondern dreimal dieselbe Sperre.",
  ],
  [
    "tests/reasoner/aistate-confidential-judge.test.ts",
    "Die vertraulichkeitsbewusste Judge-Kette. Der Ausgang ist ehrlich UNTERSCHIEDEN: " +
      '„confidential" (Cloud da, aber vertraulich) gegen „no-model" (gar kein Modell). Ohne ' +
      "Freigabe wäre er in beiden Fällen derselbe, und genau diese Unterscheidung ist der Inhalt.",
  ],
  [
    "tests/reasoner/aistate-egress-guard.test.ts",
    "Nur der letzte Fall trägt sie: Cloud-Primary + vertrauliches Paar → complete 0 und Ausgang " +
      '„confidential". Die Null soll an der Vertraulichkeit liegen, nicht an der Erlaubnis. Die ' +
      "übrigen Fälle bauen nur den lokalen Secondary oder gar keinen Reasoner.",
  ],
  [
    "tests/reasoner/reasoner-reachability.test.ts",
    "Der Key-Test (`probe`) ist ein echter Aufruf an die öffentliche KI. Ohne Freigabe fände er " +
      'nicht statt, und „active"/„unreachable"/`tasks[t]` wären keine Messung mehr, sondern die ' +
      "Auskunft über eine gesperrte Kante — dieselbe Begründung wie bei V2/V3 des Verbindungstests.",
  ],
  [
    "tests/reasoner/local-empty-response.test.ts",
    "Ein Fall: der Client sitzt als PRIMARY und zählt damit als öffentlicher Anbieter " +
      "(`service.ts:508`). Er muss antworten dürfen, damit die geprüfte Meldung „Die KI hat keine " +
      'Antwort geliefert" überhaupt entsteht. Der `probeLocal`-Fall bleibt ohne Freigabe.',
  ],
  [
    "tests/reasoner/import-criteria.test.ts",
    'Jeder Fall pinnt eine URSACHE: `model-error`, `confidential`, `no-model`, „nichts gefragt". ' +
      "Ohne Freigabe hätten alle dieselbe Ursache — die fehlende Erlaubnis —, und die Datei " +
      "prüfte statt des ehrlichen Ausfall-Vertrags nur noch die Sperre.",
  ],
  [
    "tests/reasoner/group-candidates.test.ts",
    "Dieselbe Ursachen-Unterscheidung für `groupCandidates` (model-error, model-timeout, " +
      "confidential, no-model) plus der Erfolgsfall mit validierten KI-Gruppen (demo false). Die " +
      "fünf reinen Validierungsfälle oben bauen keinen Reasoner und bekommen nichts.",
  ],
  [
    "tests/reasoner/extract-source-language.test.ts",
    "Ein Fall: der Durchstich Reasoner → Provider mit der Nicht-übersetzen-Regel im Prompt. Ohne " +
      "Freigabe wird kein Prompt gesendet (`systems.length > 0` fiele), und der Schalter wäre " +
      "nicht mehr bis zum Provider verfolgbar. Die vier Prompt-Fälle prüfen den Provider direkt.",
  ],
  [
    "tests/reasoner/fallback-reason.test.ts",
    "Die Datei trennt `no-model` von `model-error`/`model-timeout` — dafür muss ein Modell " +
      'wirklich VERSUCHT werden. Ohne Freigabe stünde überall „kein Modell", und auch das ' +
      "PII-freie Diagnose-Log entstünde nicht, weil kein Versuch protokolliert würde.",
  ],
  [
    "tests/reasoner/describe-image.test.ts",
    "Der Vision-Weg: Modelltext, harter Deckel, leere Antwort, Timeout, Protokoll und der " +
      "vertrauliche Fall mit Vision-Spy 0. Alles davon setzt voraus, dass der Bildaufruf erlaubt " +
      'ist; ohne Freigabe bliebe nur „gesperrt". Die Bausteinfälle bekommen keine.',
  ],
  [
    "tests/reasoner/mega67-billable-je-aufgabe.test.ts",
    '`billable` ist die Aussage „kostet dieser Klick wirklich etwas?" und liest die TATSÄCHLICHE ' +
      "Kette der Aufgabe. Eine gesperrte Cloud kostet nichts — ohne Freigabe messen die Fälle " +
      "nicht mehr die Abgrenzung gegen `tasks`/`mode`, sondern die Sperre.",
  ],
  [
    "tests/reasoner/mega61-ki-kennzeichnung.test.ts",
    "Ein Fall: `assist` mit ANTWORTENDEM Modell (demo false) — nur an einem echten Vorschlag ist " +
      "prüfbar, dass er KEINE KI-Kennzeichnung trägt. Alle anderen Fälle laufen ohne Anbieter " +
      "über den deterministischen Ersatz und bleiben unangetastet.",
  ],
  [
    "tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts",
    "Der Titelvorschlag ist die gekürzte Beschreibung eines ECHTEN Vision-Aufrufs. Ohne Freigabe " +
      'gibt es keine Beschreibung und damit keinen Unterschied zwischen „abgeleitet" und „Feld ' +
      'abwesend" — die drei NEGATIV-Fälle ohne Modell bleiben ohne Freigabe.',
  ],
  [
    "tests/ki-anbieterwahl/persistenz-und-migration.test.ts",
    "C1 und C1b prüfen, an WELCHE Adresse die Anfrage nach dem Neustart geht (api.anthropic.com " +
      "statt api.openai.com). Eine Anfrage, die nie stattfindet, hat keine Adresse. C2–C7 messen " +
      "Persistenz, Migration und die ENV-Sperre und bekommen ausdrücklich keine Freigabe.",
  ],
  [
    "tests/openai-anbieterfalle/openai-budget-parameter.test.ts",
    "P1 und P6 fahren den Admin-Mini-Test über den DIENST (`reasoner.probe()`). Ohne Freigabe gibt " +
      "es keinen Request, dessen Körper auf `max_completion_tokens` zu prüfen wäre — und kein " +
      "`ok:false` für die leere Antwort. Die Client-Fälle bekommen keine.",
  ],
  [
    "tests/openai-anbieterfalle/openai-sagt-warum-und-die-anbieterfalle-faellt.test.ts",
    "N3 und N4 fahren die ganze Kette bis in die Extract-Note, die die BEGRÜNDUNG DES ANBIETERS " +
      "trägt (400/401 mit Fremdtext). Ohne Anbieteraufruf gibt es keine Fremdmeldung, also auch " +
      "keinen Schlüsselrest, dessen Tilgung zu belegen wäre.",
  ],
  [
    "tests/ki-lauf-verbrauch/ehrlich.test.ts",
    "Der Verbrauch eines Laufs kommt aus dem `usage`-Block einer echten Antwort. Ohne Freigabe " +
      'gibt es keinen Aufruf, keinen Block und nichts zu unterscheiden — „das Feld FEHLT" wäre ' +
      "dann trivial wahr statt gemessen. Die Freigabe steht an der einen Aufbaustelle.",
  ],
  [
    "tests/ki-lauf-verbrauch/genau-einmal.test.ts",
    "V6a zählt EINEN Modellaufruf über zwei Schreibversuche, V6b ZWEI bezahlte Versuche. Beides " +
      "sind Aussagen über wirklich stattgefundene Aufrufe; ohne Freigabe wäre die gemessene Zahl " +
      'in beiden Fällen null und das Gesetz „genau einmal" unbewacht.',
  ],
  [
    "tests/ki-lauf-verbrauch/mehrfachaufruf.test.ts",
    "Drei Abschnitte, drei Modellaufrufe, eine Summe (6000/180). Ohne Freigabe findet kein " +
      "Abschnitt statt, und der Fall prüfte die Summe von nichts — die Halbheit „nur der letzte " +
      'Wert", gegen die er ausdrücklich steht, wäre nicht mehr unterscheidbar.',
  ],
  [
    "tests/ki-lauf-verbrauch/spur.test.ts",
    "Zwei GLEICHZEITIGE Läufe an einer Client-Instanz; die Aussage ist, dass ihre Verbrauchswerte " +
      "getrennt bleiben (100/10 und 7/3). Ohne Freigabe befragt keiner der beiden das Modell " +
      "(`expect(n).toBe(2)` fiele), und es gäbe keine zwei Werte, die sich vermischen könnten.",
  ],
  [
    "tests/ki-assist-leer/assist-budget-und-anweisung.test.ts",
    "F3 und G3 gehen über den Dienst: die Meldung MIT dem Grund `finish_reason=length` und die " +
      "freie Anweisung, die bis in den System-Prompt reist. Ohne Freigabe käme statt beider die " +
      "Sperrmeldung. Die Budget-Fälle sprechen den Provider direkt an.",
  ],
  [
    "tests/ki-assist-leer/assist-leere-antwort.test.ts",
    "Die Meldung nennt Anbieter, Modell und Grund des VERSUCHS — ohne Versuch gibt es keinen " +
      'Grund, und der Laufdatensatz („status error", „model gpt-6-astra") entsteht nicht. B3 ' +
      "(ganz ohne Modell) und die vier Provider-Fälle bleiben ausdrücklich ohne Freigabe.",
  ],
  [
    "tests/ki-assist-leer/assist-route-ehrliche-meldung.test.ts",
    "Vier Fälle über die ECHTE Route gegen einen Cloud-Client, H4 verlangt ausdrücklich den 200er " +
      "MIT Vorschlag. Ohne Freigabe wäre jede der vier Antworten dieselbe Sperrmeldung, und der " +
      "Unterschied zwischen ehrlicher Meldung und echtem Vorschlag verschwände.",
  ],
  [
    "tests/ki-assist-leer/assist-unveraendert-und-fragment.test.ts",
    'Die Datei unterscheidet „keine ÄNDERUNGEN vorgeschlagen" von „keine ANTWORT geliefert" — ' +
      "beides setzt eine echte Modellantwort voraus (Echo-Text, Korrektur, Fragment). Ohne " +
      "Freigabe gäbe es keine, und die beiden Tatsachen fielen zu einer zusammen.",
  ],
  [
    "services/reasoner/src/service.test.ts",
    "Der Kern-Einheitstest des Dienstes: Modellantwort, Fallback-Pfad mit `fallback:true`, " +
      "Laufprotokoll, wirksame Zuordnung (`effective`) und das Vertraulichkeits-Routing mit " +
      "gezählten Providernamen. Ohne Freigabe bliebe von all dem der deterministische Ersatz. " +
      "Persistenz-, ENV-Sperr- und `configStatus`-Fälle bekommen ausdrücklich keine.",
  ],
  [
    "services/reasoner/src/confidential-fallback.test.ts",
    "Die Harmonisierung von `confidential` gegen `no-model`/`model-error`/`model-timeout` über " +
      "structure, describeImage und deriveImportCriteria. Jede dieser Ursachen setzt voraus, dass " +
      "die Cloud ERLAUBT war und nur an der Einstufung oder der Zuordnung scheiterte.",
  ],
  [
    "services/reasoner/src/job3353-vertraulichkeit-sperre.test.ts",
    "Die Sperrmeldung behauptet, die Cloud wäre OHNE die Einstufung gelaufen — genau das setzt " +
      "eine erteilte Adminfreigabe voraus. Ohne sie wäre `ConfidentialCloudBlockedError` eine " +
      "Aussage über die falsche Ursache. S3 (keine Cloud verdrahtet) bleibt ohne Freigabe.",
  ],
  [
    "services/reasoner/src/extract-failure.test.ts",
    'Der echte Fehlergrund in der Note statt „Ohne KI-Modell", die gerettete gekürzte Antwort, ' +
      "die abschnittsweise Extraktion. Alles davon verlangt einen stattgefundenen Modellaufruf; " +
      "ohne Freigabe stünde überall genau die Meldung, gegen die die Datei antritt.",
  ],
  [
    "services/reasoner/src/extract.test.ts",
    "Ein Fall: der Fallback NACH einem echten, gescheiterten Modellversuch. Ohne Freigabe gäbe es " +
      'keinen Versuch, sondern „kein Modell" — und das prüft der Fall direkt darüber schon. Alle ' +
      "übrigen Fälle bauen keinen öffentlichen Anbieter.",
  ],
  [
    "services/reasoner/src/model-concurrency.test.ts",
    "Drei Fälle reichen den Auslastungsfehler des MODELLS durch (`ModelCapacityError` statt " +
      "stillem null oder Fallback). Ohne Modellaufruf gibt es keinen solchen Fehler; die " +
      "Semaphor- und Wrapper-Fälle bauen keinen Reasoner und bekommen nichts.",
  ],
  [
    "services/reasoner/src/conflict-judge.test.ts",
    'Ein Fall: „Reasoner mit echtem Modell urteilt" — das verlangt einen echten Aufruf. Sein ' +
      "Gegenpart im selben Fall (`withoutModel`) bekommt ausdrücklich keine Freigabe, denn " +
      "seine Null soll am fehlenden Anbieter liegen.",
  ],
  [
    "services/reasoner/src/duplicate-judge.test.ts",
    'Dasselbe für das Dubletten-Urteil: der Fall stellt „mit Modell urteilt" gegen „ohne Modell ' +
      'ehrlich null". Ohne Freigabe wären beide Hälften null, und der Fall verlöre seine ' +
      "Gegenprobe im eigenen Rumpf.",
  ],

  // ----------------------------------------------------------------------------------------------
  // JOB 3588 · DER NACHTRAG 2 — die vierundzwanzig Bestandsdateien, die bis heute niemandem gehörten.
  // ----------------------------------------------------------------------------------------------
  //
  // WOHER DIE LISTE KOMMT: aus dem Torlauf des Kerns (JOB 3549 Runde 3), nicht aus einer Schätzung.
  // JOB 3550 versorgte drei Dateien, JOB 3570 einunddreißig — diese hier lagen dazwischen. Jede
  // misst einen ECHTEN Weg zum Modell und würde mit dem Kern rot, obwohl sich das Produkt richtig
  // verhält.
  //
  // ZWEIMAL STEHT IN DIESEM BLOCK AUSDRÜCKLICH, DASS DIE ZWEITE FREIGABE FEHLT, obwohl der Dateiname
  // das Gegenteil vermuten lässt (`mega61-vertraulich-…`, `ka4-vertraulich-…`): genau diese Dateien
  // messen, dass Vertrauliches NICHT hinausgeht. Sie brauchen die Grundfreigabe, damit der Weg
  // überhaupt beginnt — und nie die zweite, die die gemessene Sperre aufheben würde.
  [
    "tests/app/ai-check-provider-failure-e2e-rt001.test.ts",
    "Jeder Fall misst eine Ursache, die NUR entsteht, wenn der Provider wirklich gerufen wurde " +
      "(401→auth, 429→rate-limit, …). Ohne Freigabe endete der Lauf deterministisch-erfolgreich " +
      "und alle acht Fälle prüften eine Ursache, die es gar nicht gibt.",
  ],
  [
    "tests/app/aistate-fix2.test.ts",
    "EIN Fall (der LIVE-Pfad) zählt echte Judge-Aufrufe und bekommt die Freigabe. Die übrigen " +
      "fahren ohne Modell oder über eigene Attrappen und bleiben ausdrücklich ohne — ihre Null " +
      "gehört dem fehlenden Anbieter.",
  ],
  [
    "tests/app/aistate-fix3.test.ts",
    "Zwei Fälle brauchen sie: der echte Duplikat-Judge-Aufruf und das Modell-Profil im Datensatz. " +
      'Der Sperrfall („ECHTER No-Model-Runner-Test: Provider-/complete-Aufrufe EXAKT 0") bekommt ' +
      "sie AUSDRÜCKLICH NICHT — dort ist die Null die Zusage.",
  ],
  [
    "tests/app/import-group-routes.test.ts",
    "Die Freigabe steht im gemeinsamen Aufbau, weil BEIDE Sorten Fälle sie brauchen: die positiven " +
      "erwarten genau einen Cloud-Aufruf, die Sperrfälle null. Nur mit ihr ist die gemessene Null " +
      "die Aussage über die Vertraulichkeitsregel und nicht über eine fehlende Adminfreigabe.",
  ],
  [
    "tests/app/import-select-route.test.ts",
    "Derselbe Grund wie bei der Gruppenroute, dazu ein zweiter Aufbau: „Modell wirft → " +
      "inferenceStatus unavailable“ setzt voraus, dass das Modell überhaupt gerufen wird — ohne " +
      "Freigabe entstünde `no-model` statt `model-error`, also eine andere Ursache als benannt.",
  ],
  [
    "tests/app/ship8-close-aicheck.test.ts",
    "Der ganze Sinn dieses Aufbaus ist, dass der echte ModelProvider den gefakten Client WIRKLICH " +
      "ruft. Ohne Freigabe stünde er in keiner Kette und jeder Fall prüfte den deterministischen " +
      "Ersatz statt des Weges, den die Datei benennt.",
  ],
  [
    "tests/app/tv1-durchstich-route.test.ts",
    "Nur mit Grundfreigabe läuft der Cloud-Vision-Weg im Fall `intern` und es kann überhaupt ein " +
      "Titelvorschlag entstehen. Der Fall `streng_vertraulich` darunter bleibt gesperrt — dafür " +
      "bräuchte es `vertraulicheInhalte`, und genau die wird hier bewusst nicht gesetzt.",
  ],
  [
    "tests/ask-c02/befund.test.ts",
    "Drei Fälle messen einen echten Weg zum Modell (`mitschreiber` zählt die Prompts). Ohne " +
      "Freigabe gäbe es keinen einzigen Prompt, und die Aussagen über Auszug, Beleg und Deckung " +
      "wären Aussagen über eine Null. Kein Fall dieser Datei stuft ein Objekt vertraulich ein.",
  ],
  [
    "tests/ask-c02/konflikt.test.ts",
    "Alle vier Fälle messen einen echten Modellweg; ohne Freigabe liefe kein Modell und „beide " +
      "Quellen stehen in der Antwort“ wäre eine Aussage über den deterministischen Ersatz. " +
      "Kein Fall stuft hier etwas vertraulich ein.",
  ],
  [
    "tests/ask-volltext/vollkette-und-rechte.test.ts",
    "Auch die beiden RECHTE-Fälle brauchen sie: sie messen nicht „kein Modellaufruf“, sondern " +
      "„das Modell LÄUFT und bekommt den geschützten Dokumenttext trotzdem nicht“ (Promptzahl 1). " +
      "Ohne Freigabe bliebe die Zahl 0 und die Aussage wertlos. Das vertrauliche Objekt fällt " +
      "schon vor dem Prompt aus dem Auszug — der Lauf selbst führt nichts Vertrauliches.",
  ],
  [
    "tests/ask/job2659-eine-marke-ist-kein-beleg.test.ts",
    "Ein Fall, die Vollkette K: K3/K4 messen, dass die ABSAGE bzw. die fehlende Marke des ECHTEN " +
      "Modells zur Wissenslücke wird. Ohne Freigabe liefe das Modell gar nicht, und die Lücke " +
      "entstünde aus dem falschen Grund. Die Objekte sind offen eingestuft.",
  ],
  [
    "tests/ask/mega61-vertraulich-kein-cloud-kontext.test.ts",
    "AUSSCHLIESSLICH `oeffentlicheKi`, NIEMALS die zweite: die Datei misst, dass Vertrauliches den " +
      "Modellkontext nicht erreicht. Die Grundfreigabe lässt den Weg überhaupt erst beginnen — die " +
      "zweite würde die Sperre aufheben, die hier die ganze Zusage trägt.",
  ],
  [
    "tests/conflicts/detection-cap-honesty.test.ts",
    "Vier Fälle zählen ECHTE Judge-Aufrufe und lesen daraus die Abdeckung (geprüfte Menge, " +
      "verfügbare Menge, Deckelung). Ohne Freigabe bliebe jeder Zähler 0, und „der Deckel wirkt in " +
      "BEIDEN Live-Wegen“ wäre eine Aussage über zwei Nullen. Die KOs sind offen eingestuft.",
  ],
  [
    "tests/import-freitext-titel/titel-satz-findet-die-seite.test.ts",
    "Der Doppelgänger soll seine Deutung wirklich liefern; ohne Freigabe käme er nie zum Zug und " +
      "der Fall prüfte den deterministischen Ersatz statt der beobachteten Fehldeutung. Der " +
      "KI-AUSFALL-Fall braucht sie ebenso — sonst wäre die Ursache „kein Modell“ statt „Fehler“.",
  ],
  [
    "tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts",
    "Ein Fall: KA4-S3/KA4-F8a messen, dass der Anbieter über diesen Weg WIRKLICH gerufen wird " +
      "(Zähler 1) und dass das Gesehene von den ausgewiesenen Nutzlastklassen gedeckt ist. KEIN " +
      "`vertraulicheInhalte`: das vertrauliche Objekt soll den Modellweg gerade nicht erreichen.",
  ],
  [
    "tests/ki-lauf-modell/api-lauf-modell.test.ts",
    "Beide Fälle lesen einen ECHTEN Cloud-Lauf aus dem Bestand (`provider` und `model` sind zwei " +
      "verschiedene Angaben). Ohne Freigabe entstünde gar kein Cloud-Lauf und die Route hätte " +
      "nichts zu nennen. Der Anker stuft den Text ausdrücklich als NICHT vertraulich ein.",
  ],
  [
    "tests/ki-lauf-modell/lauf-nennt-modell.test.ts",
    "Die Frage der Datei — „welches MODELL nennt der Datensatz?“ — hat nur dann eine Antwort, " +
      "wenn das Modell auch gerufen wurde. Sie steht unbedingt im Aufbau: die beiden Fälle ohne " +
      "verdrahteten Anbieter enden auch mit Freigabe deterministisch, denn die Freigabe verdrahtet " +
      "keinen Anbieter.",
  ],
  [
    "tests/klara-freigabe/v2-einwilligung-ende-zu-ende.test.ts",
    "V2-E1/E3 messen, ob die EINWILLIGUNG den Anbieterweg öffnet bzw. nach Ablauf wieder schließt. " +
      "Ohne Adminfreigabe wäre der Weg immer zu und beide prüften die falsche Sperre. Die Freigabe " +
      "ersetzt die Einwilligung NICHT — sie ist die Bedingung davor, und E3 belegt das weiterhin.",
  ],
  [
    "tests/library/import-json-zero-model-calls.test.ts",
    "NUR die Gegenprobe („derselbe Spy-Aufbau ZÄHLT, wenn ein Objekt regulär eingereicht wird“) " +
      "bekommt sie, denn nur sie behauptet eine Zahl ÜBER null. Die Sperrfälle „NULL " +
      "Modellaufrufe“ bekommen ausdrücklich KEINE — sie stehen unten namentlich mit leerer " +
      "Freigabeliste.",
  ],
  [
    "tests/m3-dokumentweg-panel/w6-anschluss-echte-route.test.ts",
    "Der Aufbau existiert, damit der mitschreibende Anbieter WIRKLICH gerufen wird. Ohne Freigabe " +
      "bliebe die Liste leer und „mit Zustimmung geht es hinaus / ohne nicht“ prüfte zweimal " +
      "dieselbe Sperre. Die Freigabe ersetzt die ZUSTIMMUNG nicht; `zustimmen === false` bleibt zu.",
  ],
  [
    "tests/n11b-zustimmung-macht-intern/zustimmung.test.ts",
    "Die Datei misst, dass die bestätigte DOKUMENTZUSTIMMUNG den tiefen Zweig öffnet — dafür muss " +
      "er wirklich laufen. Ohne Freigabe gäben „mit Zustimmung“ und „ohne Zustimmung“ dasselbe " +
      "Ergebnis aus zwei verschiedenen Gründen. KEIN `vertraulicheInhalte`: die Zustimmung hebt " +
      "Text auf INTERN, nicht über die Vertraulichkeitsgrenze.",
  ],
  [
    "tests/security/vip2-gate.test.ts",
    "Ein Fall: die Statusrouten sollen keinen Anbieter-/Modellnamen durchsickern lassen UND " +
      "trotzdem ehrlich „cloud-fähig“ melden. Die zweite Hälfte ist die gegatete Antwort des " +
      "Kerns; ohne Adminfreigabe ist sie `false`, und der Leck-Test liefe an einem Zustand vorbei, " +
      "in dem es gar nichts zu lecken gäbe. Die Statusrouten übertragen keinen Text.",
  ],
  [
    "tests/select-lauf-protokoll/laufprotokoll.test.ts",
    "Die Datei protokolliert Auswahlläufe an einem ECHTEN Modell: Modellname, Verbrauch, " +
      "Fehlerursache. Ohne Freigabe stünde der Client in keiner Kette, jeder Lauf endete " +
      "„no-model“, und acht Fälle prüften eine Ursache, die sie gar nicht herbeigeführt haben.",
  ],
  [
    "tests/select-lauf-protokoll/route-einstieg.test.ts",
    "Beide Fälle messen, dass der Routeneinstieg einen ECHTEN Auswahllauf protokolliert (mit " +
      "Modellnamen). Ohne Freigabe endete jeder Lauf „no-model“ und die Route hätte nichts zu " +
      "protokollieren. Der Schnappschuss ist nicht vertraulich eingestuft.",
  ],
]);

/**
 * DAS ZWEITE REGISTER · wer VERTRAULICHES an eine öffentliche KI geben darf. ABSICHTLICH LEER.
 *
 * `vertraulicheInhalte` ist der teurere der beiden Schalter, und kein Bestandstest braucht ihn:
 * jede vertrauliche Stelle in diesem Haus erwartet NULL Übertragungen (D5, N4,
 * `services/reasoner/src/job3353-vertraulichkeit-sperre.test.ts`). Bleibt diese Liste leer, kann
 * eine spätere Runde den Schalter nicht beiläufig irgendwo setzen — F2 wird rot.
 */
const VERTRAULICH_ERLAUBT: readonly string[] = [];

// ================================================================================================
// F6 (JOB 3570) — DIE FLÄCHE HÄLT SICH SELBST VOLLSTÄNDIG.
// ================================================================================================
//
// F1 bewacht, wer den Helfer benutzt. Er kann NICHT bewachen, wer ihn hätte benutzen müssen: eine
// neue Testdatei, die einen Modellweg baut und keine Freigabe setzt, ist für F1 unsichtbar und
// wird im Tor des Kerns still rot. Genau so ist der Nachtrag entstanden — JOB 3550 versorgte drei
// Dateien, und dreiunddreißig weitere blieben liegen (`archiv/3550/runde-2/RUECKGABE.md:83`).
//
// F6 dreht das um: JEDE Datei der Fläche muss in EINEM der beiden Register stehen. Entweder sie
// setzt die Freigabe (FREIGABE_ERLAUBT, mit Grund) oder sie setzt sie ausdrücklich NICHT
// (OHNE_FREIGABE_MIT_GRUND, mit Grund). Damit kostet jede künftige Datei eine ENTSCHEIDUNG.

/**
 * DIE FLÄCHE — die Zielpfade von JOB 3570, wörtlich, und nichts darüber hinaus.
 *
 * Warum nicht das ganze Haus: die Bestandsdateien außerhalb dieser Pfade gehören anderen
 * laufenden Aufträgen (Auftrag 3570 §4 und §10: „nicht in den Diff"). Ein Wächter, der Dateien
 * verlangt, die dieser Auftrag nicht anfassen darf, wäre entweder rot oder eine Aufforderung zum
 * Regelbruch. Die Messung, was außerhalb noch liegt, steht in der Rückgabe (Lieferung 6).
 */
const FLAECHE: readonly string[] = [
  "tests/reasoner",
  "tests/ki-anbieterwahl",
  "tests/openai-anbieterfalle",
  "tests/ki-lauf-verbrauch",
  "tests/ki-assist-leer",
  "services/reasoner/src",
  "services/ask/src",
  "services/app/src/routes/reasoner-egress.test.ts",
  // Nachgereicht von der Steuerung (HINWEIS 11.09. 01:1x): Bestandstests, die NEBEN dem Quellcode
  // liegen statt unter `tests/`, fielen durch das Suchmuster, aus dem die Liste von JOB 3550 kam.
  // An genau diesen beiden ist der Kern JOB 3549 gescheitert — Runde 1 an `reasoner-routes`,
  // Runde 2 an `reasoner-egress`.
  "services/app/src/routes/reasoner-routes.test.ts",
];

/**
 * Woran ein Modellweg im Quelltext erkennbar ist.
 *
 * Die drei Formen, in denen eine Testdatei überhaupt an ein Modell kommt: der Dienst selbst
 * (`new Reasoner(`), die Kompositionswurzel mit ersetztem Reasoner (`buildServices`/`buildApp`)
 * und der Provider direkt (`new ModelProvider(`). Der Import allein zählt nicht — ein Typ-Import
 * baut keinen Weg.
 */
const MODELLWEG = /new Reasoner\(|new ModelProvider\(|buildServices\(|buildApp\(/;

/**
 * DAS DRITTE REGISTER · wer einen Modellweg baut und die Freigabe AUSDRÜCKLICH NICHT bekommt.
 *
 * Drei Sorten stehen hier, und der Grund sagt jedes Mal, welche:
 *   (B) SPERRFALL — der Fall erwartet NULL Übertragungen. Eine Freigabe wäre hier nicht falsch,
 *       sondern gefährlich: sie ist der Schalter, den der Fall gerade nicht braucht.
 *   (C) BERÜHRT DEN WEG NICHT — kein öffentlicher Anbieter verdrahtet (kein `primary`, keine
 *       `cloud`-Anbindung) oder gar kein `Reasoner`, sondern nur ein Provider/Client. Ohne
 *       Entscheidungsstelle gibt es keine Freigabe zu setzen.
 *   (X) BLOCKIERT — der Fall BRAUCHT die Grundfreigabe, kann sie in diesem Auftrag aber nicht
 *       bekommen: der Helfer liegt in `services/reasoner/src` und ist über die Modulgrenze nicht
 *       erreichbar (`dependency-cruiser` „module-boundaries"). Gemessen, nicht vermutet:
 *       `npx depcruise --config .dependency-cruiser.cjs services` meldet
 *       „error module-boundaries: services/app/src/routes/reasoner-egress.test.ts →
 *       services/reasoner/src/testhelfer-ki-freigabe.ts". Nachgelesen in `.dependency-cruiser.cjs`
 *       `:16-27`: über eine Modulgrenze ist AUSSCHLIESSLICH `services/<modul>/index.ts` erlaubt,
 *       Schweregrad `error`. Der Helfer steht dort nicht (JOB 3570 Runde 2 nachgesehen).
 *
 *       DER NACHTRAG DAFÜR kostet zwei Zeilen, beide außerhalb der Zielpfade von JOB 3570:
 *       einen Re-Export in `services/reasoner/index.ts` UND — weil dadurch ein Export ohne
 *       Produktaufrufer entsteht — einen Eintrag in REGISTER 1 von
 *       `tests/capture/aufrufer-waechter.test.ts`, neben dem, der für
 *       `testhelfer-ki-freigabe.ts::erteileKiFreigabe` schon dort steht (`:774-783`).
 *       SOLANGE ER FEHLT, bleibt der Torlauf des Kerns JOB 3549 an genau diesen zwei Dateien rot.
 */
const OHNE_FREIGABE_MIT_GRUND: ReadonlyMap<string, string> = new Map([
  [
    "tests/reasoner/model-run-context.test.ts",
    "(C) Der Reasoner dieser Datei hat KEINEN Cloud-Provider — `:39` baut ihn mit `undefined` als " +
      "primary und dem DeterministicProvider. Der Kopf `:23-25` nennt genau das als Hermetik: " +
      "kein Modellaufruf, kein Egress. Eine Freigabe hätte hier nichts freizugeben.",
  ],
  [
    "services/reasoner/src/provider-model.test.ts",
    "(C) Prüft `ModelProvider` DIREKT, ohne `Reasoner`: es gibt keine Zuordnung, kein " +
      "`setTaskConfig` und damit keine Stelle, an der eine Freigabe wirken könnte. Die " +
      "Entscheidung liegt im Dienst, nicht im Provider.",
  ],
  [
    "services/reasoner/src/presets.test.ts",
    "(C) Baut den Reasoner nur mit einem Preset-Repo (`:60`, `:81` — primary `undefined`) und " +
      "prüft den Rundweg der Assist-Vorlagen. Kein öffentlicher Anbieter, kein Modellaufruf.",
  ],
  [
    "services/ask/src/retrieval-topk.test.ts",
    "(C) `new Reasoner()` ohne jeden Provider (`:21`) — die Datei messt die Kandidatenauswahl des " +
      "deterministischen Ersatzes. Ohne öffentlichen Anbieter gibt es keine Übertragung.",
  ],
  [
    "services/ask/src/service.integration.test.ts",
    "(C) `new Reasoner()` ohne Provider (`:92`); gemessen wird die Postgres-Kette des " +
      "AskService. Kein öffentlicher Anbieter, kein Modellweg nach draußen.",
  ],
  [
    "services/ask/src/service.test.ts",
    "(X) BLOCKIERT — ein Fall braucht die Grundfreigabe (`:210` FR-I18N-01: der Provider " +
      "`capture` wird als Cloud verdrahtet und sein `answer` MUSS laufen, sonst ist `seen` leer). " +
      "Der Helfer ist von `services/ask` aus nicht importierbar (Modulgrenze, s. Kopf dieses " +
      "Registers). Die übrigen Fälle bauen `new Reasoner()` ohne Provider.",
  ],
  [
    "services/ask/src/ka4-vertraulich-im-erlaubten-zweig.test.ts",
    "(X) BLOCKIERT — KA4-V0/V1 verlangen `gesehen.length === 1`, also einen tatsächlichen Aufruf " +
      "des als Cloud verdrahteten Mitschreibers (`:91`). Ohne Grundfreigabe fällt der Aufruf weg " +
      "und die Kalibrierung des Falls mit ihm. Helfer über die Modulgrenze nicht erreichbar.",
  ],
  [
    "services/app/src/routes/reasoner-egress.test.ts",
    "(B) Drei Sperrfälle erwarten „Cloud-complete NIE aufgerufen“ (`:39`, `:52`, `:79`) — sie " +
      "bekommen ausdrücklich KEINE Freigabe. (X) Der vierte Fall (`:106`, bewusst intern → " +
      "complete läuft) bräuchte die Grundfreigabe, kann sie aber nicht bekommen: der Aufbau liegt " +
      "in `services/app`, der Helfer in `services/reasoner/src` (Modulgrenze, s. Kopf).",
  ],
  [
    "services/app/src/routes/reasoner-routes.test.ts",
    "(C) B1–B9 ersetzen `assistText`/`structure` am Dienst durch Spione (`:153-164`, `:373-377`) — " +
      "kein echter Anbieter, keine Stelle für eine Freigabe. (X) B10 (`:418-451`) fährt die GANZE " +
      "Kette mit verdrahteter Cloud und braucht die Grundfreigabe: seine Aussage ist `409` mit " +
      "Grund `unsaved_draft`, und die entsteht nur, wenn die Cloud ERLAUBT war und allein an der " +
      "Vertraulichkeit scheiterte — ohne Freigabe wäre die Ursache „kein Modell“ und der Fall rot. " +
      "Seine Null (`cloudAufrufe` 0, `:450`) bleibt dabei unangetastet. Auch hier sperrt die " +
      "Modulgrenze den Helfer aus (s. Kopf dieses Registers).",
  ],
]);

/**
 * DIE SCHNITTMARKE zwischen dem Bestandsteil dieser Datei und diesem Wächterblock.
 *
 * Der Wächter liest seine eigene Datei mit und darf sich dabei nicht selbst für einen Verstoß
 * halten. Runde 1 hat diese Naht zu weit gelegt und die GANZE Datei ausgenommen — womit ihre
 * eigenen Sperr-Fälle unbewacht blieben (Prüfer BEN, Runde 1, Punkt 4 „Vollständigkeit").
 * Ausgenommen ist jetzt nur noch der Text AB der Überschrift dieses Blocks; alles davor wird
 * geprüft wie jede andere Datei. Die Überschrift steht weit oben und damit VOR dieser Zeile —
 * `indexOf` findet sie und nicht diese Verwendung.
 */
const SCHNITTMARKE = "F — DER FREIGABE-WÄCHTER";

/**
 * Die Wurzeln, die dieser Wächter liest.
 *
 * JOB 3570: bis hierher war es `tests/` allein. Der Nachtrag versorgt auch Tests, die IM Modul
 * liegen (`services/reasoner/src/*.test.ts`, `services/ask/src/*.test.ts`,
 * `services/app/src/routes/reasoner-egress.test.ts`). Sähe F1/F2 sie nicht, wäre der Helfer dort
 * unbewacht benutzbar und die Freigabefelder von Hand schreibbar — das Loch wäre genau so groß wie
 * die Zahl der Tests unterhalb von `services/`.
 */
const WURZELN: readonly string[] = ["tests", "services", "apps"];

/**
 * Was als Quelle gelesen wird: unter `tests/` jede `.ts`/`.tsx`, sonst nur die TESTS.
 *
 * Die Moduldateien selbst bleiben draußen: sie sind der Gegenstand der Freigabe, nicht ihr
 * Benutzer — dieselbe Grenze, die `KERN` für `tests/admin-ki-freigabe/` zieht.
 */
function istQuelle(pfad: string): boolean {
  if (!pfad.endsWith(".ts") && !pfad.endsWith(".tsx")) return false;
  return pfad.startsWith("tests/") || pfad.includes(".test.");
}

function quellenUnter(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(process.cwd(), verzeichnis), { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name === "dist" || eintrag.name.startsWith("."))
      continue;
    const relativ = `${verzeichnis}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      gefunden.push(...quellenUnter(relativ));
    } else if (istQuelle(relativ)) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/** Alle Prüfquellen der drei Wurzeln, ohne den Kern — DIESE Datei eingeschlossen. */
function testquellen(): string[] {
  return WURZELN.flatMap((wurzel) => quellenUnter(wurzel)).filter((p) => !p.startsWith(KERN));
}

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), "utf8");

/**
 * BLENDET KOMMENTARE AUS — längentreu: Kommentartext wird zu Leerzeichen, Umbrüche bleiben stehen.
 *
 * WARUM ES DIESE ABTASTUNG BRAUCHT (Prüfer BEN, JOB 3570 Runde 1, Korrekturpflicht 1). F4 zählte
 * `expect(` im ROHTEXT. In diesem Haus ist es üblich, in Kommentaren auf Erwartungen zu verweisen
 * („Hier stand …") — neununddreißig Dateien tun das. Jede solche Zeile schenkte ihrer Datei einen
 * Erwartungsboden, den kein Lauf einlöst. BEN hat in `tests/ki-lauf-verbrauch/ehrlich.test.ts` eine
 * echte Erwartung GELÖSCHT, und die Suite blieb grün: der Kommentar in `:65` füllte die Lücke.
 * Gemessen: die Datei zählt roh 14 Erwartungen, ausführbar 13 — genau das eine Guthaben, das die
 * Löschung bezahlte. Ein Wächter, den man mit Prosa bezahlen kann, bewacht nichts.
 *
 * LÄNGENTREU ist kein Schmuck: F6 meldet Zeilennummern und `bestand` schneidet an einer
 * Zeichenstelle. Fiele hier Text WEG statt leer zu werden, verschöben sich beide.
 *
 * Die Abtastung kennt Zeichenketten, Vorlagen (samt `${…}`), Regex-Literale und beide
 * Kommentararten. Regex-Literale MÜSSEN dabei sein, das ist gemessen und nicht bedacht:
 * `tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts:164` und
 * `tests/openai-anbieterfalle/openai-budget-parameter.test.ts:283` führen Anführungszeichen
 * INNERHALB eines Literals — ohne diesen Zweig verlöre die Abtastung dort die Spur und hielte
 * anschließend Code für Zeichenkette. Verliert sie sie doch, wirft sie: lieber rot als still
 * falsch gezählt.
 *
 * WAS DIESE ABTASTUNG SEIT JOB 3586 NICHT MEHR TUT: zählen. Sie hatte eine zweite Stufe
 * (`literale: "leeren"`), die zusätzlich den INHALT von Zeichenketten und Vorlagen leerte, damit
 * `void 'expect(…)';` den Erwartungsboden nicht mehr bezahlen konnte (Prüfer BEN, JOB 3570
 * Runde 2). Die Stufe trug nur bis zum nächsten Literaltyp: an
 * `void /expect(datensatz.status).toBe("error");/;` ist sie gescheitert, weil der Anfang eines
 * Regex-Literals ohne Parser nicht von einer Division zu unterscheiden ist. Gezählt wird deshalb
 * jetzt am SYNTAXBAUM (`tests/waechter-ast/erwartungsstellen.ts`), und die zweite Stufe ist
 * ersatzlos entfernt — ein abgelöster Weg, der daneben stehen bleibt, ist die nächste Lücke.
 *
 * Diese Stufe hier braucht jeder, der am Text noch etwas WIEDERERKENNEN muss: die Fallköpfe
 * (`it("B1 · …")`), die Freigabe-Aufrufe mitsamt ihren Argumenten
 * (`mitKiFreigabe({ global: "openai", … })`), die Sperr-Zeilen in F3 und die Modellwege in F6 leben
 * alle in Zeichenketten und müssen lesbar bleiben.
 *
 * DER REGEX-ZWEIG unten rät seinen Anfang weiterhin nur (`istRegexStelle` sieht ein einzelnes
 * Zeichen). Das ist hier hinnehmbar und war es vorher nicht: er entscheidet nichts mehr über
 * Erwartungen, sondern hält nur die Anführungszeichen auseinander. Ohne ihn verlöre die Abtastung
 * an `tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts:164` die Spur und hielte anschließend
 * Code für Zeichenkette.
 */
function nurCode(quelle: string, wofuer: string): string {
  const aus = quelle.split("");
  const leere = (von: number, bis: number): void => {
    for (let k = von; k < bis && k < aus.length; k++) if (aus[k] !== "\n") aus[k] = " ";
  };
  /**
   * GERATEN, nicht entschieden: ein `/` beginnt vermutlich ein Regex-Literal, wenn davor kein Wert
   * steht. Ein Schlüsselwort (`void /…/`) sieht wie ein Wert aus, also rät dieser Blick dort falsch.
   * Das ist hingenommen: der Zweig hält nur die Anführungszeichen auseinander, er entscheidet
   * nichts über Erwartungen (siehe „DER REGEX-ZWEIG" im Kopf dieser Abtastung).
   */
  const istRegexStelle = (v: string): boolean => v === "" || !/[\w$)\]}"'`]/.test(v);
  /** Je offener `${…}`-Einbettung die Klammertiefe, bei der sie wieder in die Vorlage zurückfällt. */
  const einbettungen: number[] = [];
  let tiefe = 0;
  let inVorlage = false;
  let vorher = "";
  let i = 0;
  while (i < quelle.length) {
    const z = quelle.charAt(i);
    if (inVorlage) {
      if (z === "\\") {
        i += 2;
      } else if (z === "`") {
        inVorlage = false;
        vorher = "`";
        i += 1;
      } else if (z === "$" && quelle.charAt(i + 1) === "{") {
        einbettungen.push(tiefe);
        tiefe += 1;
        inVorlage = false;
        vorher = "{";
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }
    if (z === "/" && quelle.charAt(i + 1) === "/") {
      const ende = quelle.indexOf("\n", i);
      const bis = ende < 0 ? quelle.length : ende;
      leere(i, bis);
      i = bis;
      continue;
    }
    if (z === "/" && quelle.charAt(i + 1) === "*") {
      const ende = quelle.indexOf("*/", i + 2);
      const bis = ende < 0 ? quelle.length : ende + 2;
      leere(i, bis);
      i = bis;
      continue;
    }
    if (z === '"' || z === "'") {
      i += 1;
      // Eine unbeendete Zeichenkette endet spätestens an der Zeile — sonst risse ein Tippfehler
      // in einer fremden Datei den ganzen Rest des Wächters mit.
      while (i < quelle.length && quelle.charAt(i) !== z && quelle.charAt(i) !== "\n") {
        i += quelle.charAt(i) === "\\" ? 2 : 1;
      }
      i += 1;
      vorher = z;
      continue;
    }
    if (z === "`") {
      inVorlage = true;
      i += 1;
      continue;
    }
    if (z === "/" && istRegexStelle(vorher)) {
      // ÜBERLESEN, NICHT LEEREN: der Inhalt bleibt stehen. Wer ihn leert, behauptet damit, jedes
      // Regex-Literal zu kennen — und diesen Anfang hier hat er nur geraten.
      i += 1;
      let klasse = false;
      while (i < quelle.length) {
        const r = quelle.charAt(i);
        if (r === "\\") {
          i += 2;
          continue;
        }
        if (r === "[") klasse = true;
        else if (r === "]") klasse = false;
        else if (r === "\n") break;
        else if (r === "/" && !klasse) break;
        i += 1;
      }
      i += 1;
      vorher = "/";
      continue;
    }
    if (z === "{") tiefe += 1;
    if (z === "}") {
      tiefe -= 1;
      if (einbettungen[einbettungen.length - 1] === tiefe) {
        einbettungen.pop();
        inVorlage = true;
        i += 1;
        continue;
      }
    }
    if (!/\s/.test(z)) vorher = z;
    i += 1;
  }
  if (inVorlage || einbettungen.length > 0) {
    throw new Error(`Kommentar-Abtastung verlor die Spur in ${wofuer} — Zählung nicht belastbar`);
  }
  return aus.join("");
}

/**
 * Der BESTANDSTEIL einer Datei: alles, was nicht dieser Wächterblock ist — ROH, mit Kommentaren.
 *
 * Für jede andere Datei ist das die ganze Datei. Nur diese hier wird geschnitten — und wenn die
 * Marke fehlt, ist die Trennung nicht mehr belegt: dann lieber rot als blind grün. Der Schnitt
 * geschieht VOR dem Ausblenden, denn die Marke selbst steht in einem Kommentar.
 */
function bestand(pfad: string): string {
  const quelle = lies(pfad);
  if (pfad !== DIESE_DATEI) return quelle;
  const schnitt = quelle.indexOf(SCHNITTMARKE);
  expect([DIESE_DATEI, schnitt > 0]).toEqual([DIESE_DATEI, true]);
  return quelle.slice(0, schnitt);
}

/**
 * Der Bestandsteil ohne Kommentare — die Grundlage jeder WIEDERERKENNUNG in F3, F4 und F7.
 *
 * Literale bleiben hier stehen: Fallköpfe, Freigabe-Argumente und die Sperr-Zeilen von F3 sind
 * Zeichenketten. Gezählt wird nicht hier, sondern am Syntaxbaum (`bestandsstellen`).
 */
const bestandCode = (pfad: string): string => nurCode(bestand(pfad), pfad);

/**
 * Der Syntaxbaum-Befund einer Datei: wo steht ein AUSGEFÜHRTER `expect(…)`-Aufruf (JOB 3586)?
 *
 * Gelesen wird der ROHE Bestandsteil — der Parser braucht keine ausgeblendeten Kommentare, er
 * kennt sie. Die Zeichenstellen beziehen sich deshalb auf `bestand(pfad)`; weil `nurCode`
 * längentreu ist, liegen sie zugleich richtig in `bestandCode(pfad)`, an dem F4 und F7 ihre
 * Fallgrenzen abstecken. Diese Gleichlage ist keine Annahme: beide Fälle prüfen sie je Datei nach.
 *
 * Einmal je Datei, nicht einmal je Frage: F4 und F7 fragen dieselben Dateien, und ein Parserlauf
 * je Frage wäre die Laufzeit zweimal bezahlt (Auftrag §3.4).
 */
const befunde = new Map<string, Erwartungsbefund>();
const bestandsstellen = (pfad: string): Erwartungsbefund => {
  const bekannt = befunde.get(pfad);
  if (bekannt !== undefined) return bekannt;
  const frisch = erwartungsstellen(bestand(pfad), pfad);
  befunde.set(pfad, frisch);
  return frisch;
};

/** Der Kopf eines Testfalls — die Kennung davor („B1", „D5", „U8c") ist sein Schlüssel. */
const FALL_KOPF = /^it\(\s*[`"'](([A-Za-z]+\d+[a-z]?)\s*·)/;

/**
 * JEDER Fallkopf — auch der ohne Kennung.
 *
 * JOB 3570: die Dateien des Nachtrags folgen der Kennungs-Konvention („B1 · …") überwiegend NICHT.
 * Ohne diesen zweiten Kopf lägen alle ihre Fälle in EINEM Stück, und ein gelöschtes `expect` in
 * Fall 3 wäre durch ein neues in Fall 7 aufzuwiegen — genau das Loch, das Prüfer BEN in Runde 1
 * von JOB 3550 gemessen hat (Korrektur (b) im Kopf dieses Blocks). Ein Fall ohne Kennung heißt
 * deshalb nach seiner STELLE: `#1`, `#2`, …
 */
const FALL_KOPF_ALLE = /\bit\(\s*[`"']/g;

/** Ein Freigabe-Aufruf, wörtlich mitsamt seinen Argumenten. */
const FREIGABE_RUF = /(?:mit|erteile)KiFreigabe\([^)]*\)/g;

/**
 * Setzt dieser Aufruf die Freigabe SELBST, statt sie nur zu erteilen? (JOB 3586)
 *
 * Beide Helferformen nehmen als ZWEITES Argument die Freigabe (`{ oeffentlicheKi, … }`). Wer es
 * schreibt, weitet die Erlaubnis aus; wer es weglässt, bekommt die Grundfreigabe. Genau diese
 * Unterscheidung hat vorher die Wortlautliste `formen` je Datei aufgezählt — als Regel gilt sie für
 * jede Datei, auch für die morgen eingetragene, und kostet keine Pflege.
 *
 * Gezählt wird das Komma auf der OBERSTEN Klammerebene: die Zuordnung selbst trägt Kommata
 * (`{ global: …, perTask: … }`), und die zählen nicht.
 */
function setztFreigabeSelbst(ruf: string): boolean {
  let tiefe = 0;
  for (const z of ruf.slice(ruf.indexOf("(") + 1)) {
    if (z === "{" || z === "[") tiefe += 1;
    else if (z === "}" || z === "]") tiefe -= 1;
    else if (z === "," && tiefe === 0) return true;
  }
  return false;
}

/**
 * Zerlegt einen Bestandsteil lückenlos in seine Testfälle.
 *
 * Was VOR dem ersten Fall steht — Aufbauhelfer, Verdrahtung — heißt `VORSPANN` und wird genauso
 * bewacht: die Ask-Datei setzt ihre Freigabe genau dort, in `verdrahten`.
 */
function fallStellen(quelle: string): Map<string, { readonly von: number; readonly bis: number }> {
  const koepfe = [...quelle.matchAll(FALL_KOPF_ALLE)];
  const stellen = new Map<string, { readonly von: number; readonly bis: number }>();
  stellen.set("VORSPANN", { von: 0, bis: koepfe[0]?.index ?? quelle.length });
  koepfe.forEach((kopf, i) => {
    const stelle = kopf.index ?? 0;
    // Gruppe 2 trägt die Kennung, wenn der Kopf eine führt; sonst zählt die Stelle.
    const kennung = FALL_KOPF.exec(quelle.slice(stelle, stelle + 80))?.[2] ?? `#${i + 1}`;
    // Zwei Fälle mit derselben Kennung würden sich sonst STILL überschreiben — der zweite wäre
    // unbewacht. Deshalb bekommt der Zweite seine Stelle angehängt statt den Platz des Ersten.
    const schluessel = stellen.has(kennung) ? `${kennung}#${i + 1}` : kennung;
    stellen.set(schluessel, { von: stelle, bis: koepfe[i + 1]?.index ?? quelle.length });
  });
  return stellen;
}

/** Dieselbe Zerlegung als Text — für F3, das am Wortlaut prüft und nicht zählt. */
function faelle(quelle: string): Map<string, string> {
  return new Map(
    [...fallStellen(quelle)].map(([schluessel, s]) => [schluessel, quelle.slice(s.von, s.bis)]),
  );
}

/** Die beiden Formen, in denen die Grundfreigabe in diesen drei Dateien überhaupt vorkommt. */
const ZUORDNUNG = (global: string, perTask = "{}"): string =>
  `mitKiFreigabe({ global: ${global}, perTask: ${perTask} })`;
const AM_REASONER = "erteileKiFreigabe(reasoner)";

/** Was über einen einzelnen Testfall festgeschrieben ist. */
interface Fallakte {
  /** Zahl der AUSGEFÜHRTEN Erwartungen im Fall, ausgezählt am Basisstand. BODEN: dazu ja, weg nein. */
  readonly boden: number;
  /** Die erlaubten Freigabe-Aufrufe, wörtlich und VOLLZÄHLIG — mehr ist so rot wie weniger. */
  readonly freigaben: readonly string[];
}

/**
 * Was über eine ganze DATEI festgeschrieben ist (JOB 3570).
 *
 * WARUM DIESE ZWEITE EBENE. JOB 3550 führte drei Dateien und konnte jeden ihrer Fälle einzeln
 * auflisten. Der Nachtrag versorgt dreiunddreißig weitere mit zusammen über dreihundert Fällen;
 * jeden davon einzeln einzutragen, auch die unveränderten, hieße jede fremde Änderung an einer
 * dieser Dateien künstlich rot zu machen (Auftrag 3570 §3.4 zieht die Grenze ausdrücklich:
 * „Unveränderte Fälle brauchen keinen Eintrag"). Weggelassen wird deshalb nur die AUFZÄHLUNG,
 * nicht die Bewachung:
 *
 *   `gesamtboden` — die Summe der ausgeführten Erwartungen über den ganzen Bestandsteil. Eine
 *                   gelöschte Erwartung und ein gelöschter GANZER Fall fallen hier auf, auch wenn
 *                   der Fall nicht einzeln geführt wird.
 *   `faelle`      — je GEÄNDERTEM Fall und je SPERRFALL Boden und exakte Liste der Freigaben.
 *   `vollzaehlig` — nur die drei Dateien von JOB 3550: dort ist `faelle` KOMPLETT, und die
 *                   Gleichheit der Schlüsselmengen bleibt geprüft. Ohne diese Marke wäre die
 *                   Prüfung von Runde 2 stillschweigend verlorengegangen.
 *
 * WAS JOB 3586 HIER GESTRICHEN HAT, und warum (Hinweis der Steuerung 11.09. 09:5x). Bis hierher
 * führte die Akte zusätzlich `freigaben` (die STÜCKZAHL der Freigabe-Aufrufe je Datei) und `formen`
 * (ihre Wortlaute). Beide waren Gleichheiten — und eine Gleichheit über eine Stückzahl bricht bei
 * jeder ehrlichen Erweiterung: JOB 3588 hat 29 Bestandsdateien richtig versorgt, und der Wächter
 * meldete Rot, obwohl beide Seiten sauber gearbeitet hatten. Ein Wächter, den man nur durch
 * Nachtragen einer Zahl beruhigen kann, wird eines Tages durch Hochsetzen der Zahl beruhigt.
 *
 * AN IHRE STELLE TRITT EINE REGEL, und zwar an drei Stellen, die es schon gibt:
 *   1. F1  — wer die Freigabe überhaupt setzen darf, steht namentlich im Register, mit Grund.
 *   2. F2  — die Freigabefelder darf NIEMAND von Hand schreiben; eine großzügigere Freigabe
 *            (`vertraulicheInhalte`) ist damit in der ganzen Fläche unschreibbar. Genau das war die
 *            Aufgabe von `formen`, nur global statt je Datei.
 *   3. F4  — ein Freigabe-Aufruf trägt GENAU EIN Argument (die Zuordnung). Der zweite Parameter des
 *            Helfers ist die Freigabe selbst; wer ihn schreibt, weitet aus. Diese Regel braucht
 *            keine Pflege je Datei und gilt auch für morgen eingetragene Dateien.
 * Und der Fall, den die Stückzahl WIRKLICH geschützt hat — ein SPERRFALL, der still eine Freigabe
 * bekommt —, gehört in `faelle`: dort steht er namentlich mit `freigaben: []`, und mehr ist so rot
 * wie weniger. Wer einen Sperrfall baut, trägt ihn ein; das ist die Regel, die die Zahl ersetzt.
 */
interface Dateiakte {
  readonly gesamtboden: number;
  readonly faelle: Readonly<Record<string, Fallakte>>;
  readonly vollzaehlig?: true;
}

/**
 * DIE FALLAKTE · Fall für Fall, für die drei Dateien, die dieser Auftrag anfasst.
 *
 * Die Zahlen sind ausgezählt aus dem Basisstand 15d49dd (`git show 15d49dd:<datei>`), die Listen
 * aus dem Stand nach dem Einbau der Freigabe. Beides zusammen ist die Zusicherung aus Auftrag §3.3
 * in messbarer Form: keine Erwartung gesenkt, keine Freigabe dazugeschmuggelt.
 */
const FALLAKTEN: Readonly<Record<string, Dateiakte>> = {
  // JOB 3484 R10: nur Register/Fallakten nachgeführt; F1–F7 und die leere Vertraulichkeitsliste
  // bleiben unverändert. Mutation: einen Eintrag entfernen → F1 rot; Cloud-Null löschen → F4 rot.
  "tests/review26-teilpruefung-ursache/fixture.ts": {
    gesamtboden: 0, // Aufbauhelfer ohne eigene Erwartungen; seine Verbraucher messen die Ausgänge.
    vollzaehlig: true,
    faelle: { VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(services.reasoner)"] } },
  },
  "tests/review26-teilpruefung-ursache/ursache-je-klasse.test.ts": {
    gesamtboden: 22,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: [] },
      "#1": { boden: 2, freigaben: [] },
      "#2": { boden: 2, freigaben: [] },
      "#3": { boden: 3, freigaben: [] },
      "#4": { boden: 4, freigaben: [] },
      "#5": { boden: 5, freigaben: ["erteileKiFreigabe(f.services.reasoner)"] },
      "#6": { boden: 3, freigaben: [] },
      "#7": { boden: 3, freigaben: [] },
    },
  },
  [DIESE_DATEI]: {
    gesamtboden: 105,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: [] },
      A1: { boden: 7, freigaben: [] },
      A2: { boden: 2, freigaben: [] },
      B1: { boden: 11, freigaben: [ZUORDNUNG('"openai"')] },
      B2: { boden: 10, freigaben: [ZUORDNUNG('"anthropic"')] },
      B3: {
        boden: 1,
        freigaben: [ZUORDNUNG('"openai"'), ZUORDNUNG('"anthropic"'), ZUORDNUNG('"openai"')],
      },
      B4: {
        boden: 8,
        freigaben: [ZUORDNUNG('"openai"', '{ assist: "anthropic" }'), ZUORDNUNG('"openai"')],
      },
      B5: { boden: 7, freigaben: [ZUORDNUNG('"anthropic"'), ZUORDNUNG('"openai"')] },
      B6: { boden: 4, freigaben: [ZUORDNUNG('"openai"'), ZUORDNUNG('"anthropic"')] },
      B7: { boden: 4, freigaben: [AM_REASONER] },
      D1: { boden: 6, freigaben: [ZUORDNUNG('"openai"')] },
      D2: { boden: 4, freigaben: [ZUORDNUNG('"anthropic"')] },
      D3: { boden: 5, freigaben: [ZUORDNUNG('"openai"')] },
      D4: { boden: 14, freigaben: [ZUORDNUNG('"anthropic"')] },
      D5: { boden: 3, freigaben: [ZUORDNUNG("wahl")] },
      D6: { boden: 4, freigaben: [ZUORDNUNG('"openai"'), ZUORDNUNG('"anthropic"')] },
      N1: { boden: 7, freigaben: [ZUORDNUNG("wahl")] },
      N2: { boden: 2, freigaben: [ZUORDNUNG("wahl")] },
      N3: { boden: 4, freigaben: ["mitKiFreigabe(konfig)"] },
      N4: { boden: 2, freigaben: [ZUORDNUNG("wahl")] },
    },
  },
  "tests/openai-cloud-anbieter/cloud-wahl-verbindungstest.test.tsx": {
    gesamtboden: 42,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: [] },
      V1: { boden: 9, freigaben: [] },
      V2: { boden: 10, freigaben: [AM_REASONER] },
      V3: { boden: 7, freigaben: [ZUORDNUNG('"cloud"')] },
      V4: { boden: 7, freigaben: [] },
      V4b: { boden: 9, freigaben: [] },
    },
  },
  "tests/ask/job2659-ask-seite-mounted.test.tsx": {
    gesamtboden: 37,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 1, freigaben: [AM_REASONER] },
      U1: { boden: 3, freigaben: [] },
      U2: { boden: 3, freigaben: [] },
      U3: { boden: 5, freigaben: [] },
      U4: { boden: 4, freigaben: [] },
      U5: { boden: 3, freigaben: [] },
      U6: { boden: 4, freigaben: [] },
      U7: { boden: 4, freigaben: [] },
      U7b: { boden: 1, freigaben: [] },
      U8: { boden: 4, freigaben: [] },
      U8b: { boden: 2, freigaben: [] },
      U8c: { boden: 1, freigaben: [] },
      U6b: { boden: 2, freigaben: [] },
    },
  },
  // ---- JOB 3570 · DER NACHTRAG. `gesamtboden`/`boden` ausgezählt am Basisstand 53d9b1e ----
  // (`git show 53d9b1e:<datei>`), die Freigabe-Zahlen und -Listen am Stand nach dem Einbau. Die
  // Fälle ohne Kennung heißen nach ihrer Stelle (`#1`, `#2`, …), s. `FALL_KOPF_ALLE`.
  "tests/reasoner/dual-provider.test.ts": {
    gesamtboden: 23,
    faelle: {
      "#1": { boden: 1, freigaben: ["erteileKiFreigabe(r)"] },
      "#2": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#3": { boden: 1, freigaben: ["erteileKiFreigabe(r)"] },
      "#4": {
        boden: 2,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { assist: "local" } })'],
      },
      "#5": { boden: 6, freigaben: ["erteileKiFreigabe(r)"] },
    },
  },
  "tests/reasoner/aistate-confidential-judge.test.ts": {
    gesamtboden: 15,
    faelle: {
      "#1": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#2": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#3": { boden: 6, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/reasoner/aistate-egress-guard.test.ts": {
    gesamtboden: 25,
    faelle: {
      "#8": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/reasoner/reasoner-reachability.test.ts": {
    gesamtboden: 21,
    faelle: {
      "#2": { boden: 4, freigaben: ["erteileKiFreigabe(r)"] },
      "#3": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#4": { boden: 1, freigaben: ["erteileKiFreigabe(r)"] },
      "#5": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#6": {
        boden: 3,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { answer: "cloud" } })'],
      },
      "#7": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#8": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#9": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
    },
  },
  "tests/reasoner/local-empty-response.test.ts": {
    gesamtboden: 34,
    faelle: {
      "#8": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/reasoner/import-criteria.test.ts": {
    gesamtboden: 12,
    faelle: {
      "#1": { boden: 1, freigaben: ["erteileKiFreigabe(r)"] },
      "#3": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#4": { boden: 1, freigaben: ["erteileKiFreigabe(r)"] },
      "#5": { boden: 1, freigaben: ["erteileKiFreigabe(r)"] },
      "#6": { boden: 4, freigaben: ["erteileKiFreigabe(r)"] },
      "#7": {
        boden: 2,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { select: "deterministic" } })'],
      },
    },
  },
  "tests/reasoner/group-candidates.test.ts": {
    gesamtboden: 48,
    faelle: {
      "#8": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#9": {
        boden: 3,
        freigaben: ["erteileKiFreigabe(fehlerhaft)", "erteileKiFreigabe(langsam)"],
      },
      "#10": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": {
        boden: 3,
        freigaben: [
          'mitKiFreigabe({ global: "deterministic", perTask: {} })',
          'mitKiFreigabe({ global: "auto", perTask: { group: "deterministic" } })',
        ],
      },
      "#12": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#13": { boden: 2, freigaben: ['mitKiFreigabe({ global: "local", perTask: {} })'] },
      "#14": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#15": { boden: 4, freigaben: ["erteileKiFreigabe(langsam)", "erteileKiFreigabe(kaputt)"] },
    },
  },
  "tests/reasoner/extract-source-language.test.ts": {
    gesamtboden: 12,
    faelle: {
      "#5": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/reasoner/fallback-reason.test.ts": {
    gesamtboden: 36,
    faelle: {
      "#2": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#3": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#4": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#5": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#7": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/reasoner/describe-image.test.ts": {
    gesamtboden: 44,
    faelle: {
      "#2": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#3": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#4": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#5": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#7": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#8": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#10": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#12": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#13": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/reasoner/mega67-billable-je-aufgabe.test.ts": {
    gesamtboden: 17,
    faelle: {
      "#3": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#4": {
        boden: 4,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { structure: "local" } })'],
      },
      "#5": {
        boden: 2,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { extract: "deterministic" } })'],
      },
      "#6": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
      "#7": { boden: 2, freigaben: ["erteileKiFreigabe(r)"] },
    },
  },
  "tests/reasoner/mega61-ki-kennzeichnung.test.ts": {
    gesamtboden: 23,
    faelle: {
      "#7": { boden: 2, freigaben: ["erteileKiFreigabe(mitModell)"] },
    },
  },
  "tests/reasoner/job1164-wiretyp-dienstgrenze.test.ts": {
    gesamtboden: 26,
    faelle: {
      "#1": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#2": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#4": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#5": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ki-anbieterwahl/persistenz-und-migration.test.ts": {
    gesamtboden: 58,
    faelle: {
      C1: { boden: 8, freigaben: ["erteileKiFreigabe(zweite)"] },
      C1b: { boden: 6, freigaben: ["erteileKiFreigabe(zweite)"] },
    },
  },
  "tests/openai-anbieterfalle/openai-budget-parameter.test.ts": {
    gesamtboden: 44,
    faelle: {
      "#1": { boden: 7, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/openai-anbieterfalle/openai-sagt-warum-und-die-anbieterfalle-faellt.test.ts": {
    gesamtboden: 72,
    faelle: {
      "#14": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#15": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  // Die Freigabe steht hier im VORSPANN (`laufUndDatensatz` baut ALLE Fälle) — damit ist jeder
  // Fall ein betroffener Fall und wird einzeln geführt, nicht nur der Aufbau. Genau hier hat
  // Prüfer BEN die Löschung von `expect(datensatz.status).toBe("error")` in V3c durchgehen sehen.
  "tests/ki-lauf-verbrauch/ehrlich.test.ts": {
    gesamtboden: 13,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 2, freigaben: [] },
      V3a: { boden: 4, freigaben: [] },
      V3b: { boden: 3, freigaben: [] },
      V3c: { boden: 2, freigaben: [] },
      V3d: { boden: 1, freigaben: [] },
    },
  },
  "tests/ki-lauf-verbrauch/genau-einmal.test.ts": {
    gesamtboden: 8,
    faelle: {
      V6a: { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      V6b: { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ki-lauf-verbrauch/mehrfachaufruf.test.ts": {
    gesamtboden: 7,
    faelle: {
      V2: { boden: 7, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ki-lauf-verbrauch/spur.test.ts": {
    gesamtboden: 6,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: [] },
      V1: { boden: 6, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ki-assist-leer/assist-budget-und-anweisung.test.ts": {
    gesamtboden: 23,
    faelle: {
      "#8": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ki-assist-leer/assist-leere-antwort.test.ts": {
    gesamtboden: 38,
    faelle: {
      "#5": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#8": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#9": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#10": { boden: 6, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 9, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#12": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#13": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  // Auch hier trägt der VORSPANN die Freigabe (`baueDienste` für alle vier Fälle) — also
  // vollzählig, sonst hinge jeder der vier allein am Dateiboden.
  "tests/ki-assist-leer/assist-route-ehrliche-meldung.test.ts": {
    gesamtboden: 11,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 2, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#1": { boden: 3, freigaben: [] },
      "#2": { boden: 2, freigaben: [] },
      "#3": { boden: 1, freigaben: [] },
      "#4": { boden: 3, freigaben: [] },
    },
  },
  "tests/ki-assist-leer/assist-unveraendert-und-fragment.test.ts": {
    gesamtboden: 29,
    faelle: {
      "#1": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#2": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#3": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#4": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#5": { boden: 6, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#8": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "services/reasoner/src/service.test.ts": {
    gesamtboden: 174,
    faelle: {
      "#10": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#12": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#13": { boden: 10, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#14": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#20": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#21": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#22": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#23": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#24": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#25": {
        boden: 3,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { structure: "deterministic" } })'],
      },
      "#26": { boden: 1, freigaben: ['mitKiFreigabe({ global: "deterministic", perTask: {} })'] },
      "#44": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#45": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#48": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#49": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#50": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#51": { boden: 7, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#52": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#53": { boden: 2, freigaben: ['mitKiFreigabe({ global: "cloud", perTask: {} })'] },
    },
  },
  "services/reasoner/src/confidential-fallback.test.ts": {
    gesamtboden: 32,
    faelle: {
      "#1": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#2": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#3": {
        boden: 1,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { structure: "deterministic" } })'],
      },
      "#4": {
        boden: 1,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { structure: "local" } })'],
      },
      "#5": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#7": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#9": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#12": { boden: 1, freigaben: ['mitKiFreigabe({ global: "deterministic", perTask: {} })'] },
      "#13": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#14": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#16": {
        boden: 1,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { select: "deterministic" } })'],
      },
      "#17": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#18": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "services/reasoner/src/job3353-vertraulichkeit-sperre.test.ts": {
    gesamtboden: 18,
    faelle: {
      "#1": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#2": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      // S3 misst eine SPERRE („gar keine Cloud verdrahtet") und darf deshalb KEINE Freigabe tragen.
      // Bis JOB 3586 hing dieser Schutz an der Stückzahl `freigaben: 5` der Datei; jetzt steht er
      // als Regel da, wo er hingehört — namentlich beim Fall (Hinweis der Steuerung 11.09. 09:5x,
      // Punkt 3: „Dateien, die eine SPERRE messen, tragen sie ausdrücklich NICHT").
      "#3": { boden: 2, freigaben: [] },
      "#4": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#5": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#6": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "services/reasoner/src/extract-failure.test.ts": {
    gesamtboden: 45,
    faelle: {
      "#1": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#3": {
        boden: 1,
        freigaben: ['mitKiFreigabe({ global: "auto", perTask: { extract: "deterministic" } })'],
      },
      "#4": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#5": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#7": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#8": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#12": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "services/reasoner/src/extract.test.ts": {
    gesamtboden: 41,
    faelle: {
      "#15": { boden: 2, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "services/reasoner/src/model-concurrency.test.ts": {
    gesamtboden: 26,
    faelle: {
      "#8": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#9": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#10": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "services/reasoner/src/conflict-judge.test.ts": {
    gesamtboden: 23,
    faelle: {
      "#13": { boden: 2, freigaben: ["erteileKiFreigabe(withModel)"] },
    },
  },
  "services/reasoner/src/duplicate-judge.test.ts": {
    gesamtboden: 14,
    faelle: {
      "#6": { boden: 2, freigaben: ["erteileKiFreigabe(withModel)"] },
    },
  },

  // ---- JOB 3588 · DER NACHTRAG 2. Alle Zahlen unten sind GEMESSEN, nicht abgeschätzt: sie stammen
  // aus einem Lauf dieses Wächters über den Stand nach dem Einbau der Freigabe (`erwartungsstellen`
  // am Syntaxbaum, `fallStellen` am Bestandsteil ohne Kommentare) — dieselbe Rechnung, die F4
  // gleich darauf anstellt. Was nicht selbst gefahren wurde, steht hier nicht.
  //
  // WARUM SECHZEHN DIESER VIERUNDZWANZIG DATEIEN `vollzaehlig` TRAGEN und acht nicht: sechzehn
  // setzen ihre Freigabe im VORSPANN, im gemeinsamen Aufbau. Dann läuft JEDER Fall der Datei durch
  // sie hindurch, und „nur die geänderten Fälle werden geführt" wäre keine Grenze mehr, sondern ein
  // Loch — F4 verlangt für sie deshalb die vollzählige Fallliste. Die übrigen acht setzen sie in
  // einzelnen Fällen; dort ist nur der betroffene Fall geführt, damit eine fremde Erweiterung an
  // einer dieser Dateien nicht künstlich rot wird (Grenze aus Auftrag 3570 §3.4).
  //
  // DIE SPERRFÄLLE stehen namentlich mit LEERER Freigabeliste — mehr ist dort so rot wie weniger.
  // Das ist die eigentliche Zusage dieses Blocks: `import-json-zero-model-calls` behauptet NULL
  // Modellaufrufe, `aistate-fix3` einen Runner ganz ohne Modell, `mega61` und `tv1-durchstich`
  // je eine Vertraulichkeitssperre. Wer einem von ihnen still eine Freigabe einbaut, ändert, was
  // der Test misst — und genau das fällt hier auf.
  "tests/app/ai-check-provider-failure-e2e-rt001.test.ts": {
    gesamtboden: 6,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 1, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#1": { boden: 5, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
    },
  },
  "tests/app/aistate-fix2.test.ts": {
    gesamtboden: 14,
    faelle: {
      "#5": { boden: 3, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
    },
  },
  "tests/app/aistate-fix3.test.ts": {
    gesamtboden: 37,
    faelle: {
      "#1": { boden: 7, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#2": { boden: 3, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      // SPERRFALL: „ECHTER No-Model-Runner-Test — Provider-/complete-Aufrufe EXAKT 0". Die Null ist
      // hier die Zusage; eine Freigabe würde ändern, was der Fall misst.
      "#3": { boden: 4, freigaben: [] },
    },
  },
  "tests/app/import-group-routes.test.ts": {
    gesamtboden: 85,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 10, freigaben: [] },
      "#2": { boden: 3, freigaben: [] },
      "#3": { boden: 6, freigaben: [] },
      "#4": { boden: 6, freigaben: [] },
      "#5": { boden: 4, freigaben: [] },
      "#6": { boden: 3, freigaben: [] },
      "#7": { boden: 2, freigaben: [] },
      "#8": { boden: 2, freigaben: [] },
      "#9": { boden: 4, freigaben: [] },
      "#10": { boden: 6, freigaben: [] },
      "#11": { boden: 4, freigaben: [] },
      "#12": { boden: 4, freigaben: [] },
      "#13": { boden: 4, freigaben: [] },
      "#14": { boden: 4, freigaben: [] },
      "#15": { boden: 4, freigaben: [] },
      "#16": { boden: 2, freigaben: [] },
      "#17": { boden: 5, freigaben: [] },
      "#18": { boden: 2, freigaben: [] },
      "#19": { boden: 10, freigaben: [] },
    },
  },
  "tests/app/import-select-route.test.ts": {
    gesamtboden: 75,
    vollzaehlig: true,
    faelle: {
      // Zwei Aufbauten, zwei Freigaben: der Spion-Aufbau und der werfende Reasoner.
      VORSPANN: {
        boden: 0,
        freigaben: ["erteileKiFreigabe(reasoner)", "erteileKiFreigabe(reasoner)"],
      },
      "#1": { boden: 4, freigaben: [] },
      "#2": { boden: 2, freigaben: [] },
      "#3": { boden: 5, freigaben: [] },
      "#4": { boden: 5, freigaben: [] },
      "#5": { boden: 3, freigaben: [] },
      "#6": { boden: 3, freigaben: [] },
      "#7": { boden: 3, freigaben: [] },
      "#8": { boden: 7, freigaben: [] },
      "#9": { boden: 2, freigaben: [] },
      "#10": { boden: 5, freigaben: [] },
      "#11": { boden: 2, freigaben: [] },
      "#12": { boden: 4, freigaben: [] },
      "#13": { boden: 4, freigaben: [] },
      "#14": { boden: 7, freigaben: [] },
      "#15": { boden: 5, freigaben: [] },
      "#16": { boden: 4, freigaben: [] },
      "#17": { boden: 3, freigaben: [] },
      "#18": { boden: 1, freigaben: [] },
      "#19": { boden: 4, freigaben: [] },
      "#20": { boden: 2, freigaben: [] },
    },
  },
  "tests/app/ship8-close-aicheck.test.ts": {
    gesamtboden: 20,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 1, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#1": { boden: 2, freigaben: [] },
      "#2": { boden: 2, freigaben: [] },
      "#3": { boden: 2, freigaben: [] },
      "#4": { boden: 2, freigaben: [] },
      "#5": { boden: 4, freigaben: [] },
      "#6": { boden: 3, freigaben: [] },
      "#7": { boden: 4, freigaben: [] },
    },
  },
  "tests/app/tv1-durchstich-route.test.ts": {
    gesamtboden: 13,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#1": { boden: 3, freigaben: [] },
      "#2": { boden: 5, freigaben: [] },
      // SPERRFALL `streng_vertraulich`: er bleibt zu, weil `vertraulicheInhalte` NICHT erteilt ist.
      "#3": { boden: 5, freigaben: [] },
    },
  },
  "tests/ask-c02/befund.test.ts": {
    gesamtboden: 79,
    faelle: {
      Z6: { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      A7: { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      A6: { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ask-c02/konflikt.test.ts": {
    gesamtboden: 18,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 9, freigaben: [] },
      K3: { boden: 7, freigaben: [] },
      K4: { boden: 2, freigaben: [] },
    },
  },
  "tests/ask-volltext/vollkette-und-rechte.test.ts": {
    gesamtboden: 20,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(reasoner)"] },
      V0: { boden: 2, freigaben: [] },
      V1: { boden: 6, freigaben: [] },
      R1: { boden: 6, freigaben: [] },
      R2: { boden: 4, freigaben: [] },
      R3: { boden: 2, freigaben: [] },
    },
  },
  "tests/ask/job2659-eine-marke-ist-kein-beleg.test.ts": {
    gesamtboden: 139,
    faelle: {
      "#39": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ask/mega61-vertraulich-kein-cloud-kontext.test.ts": {
    gesamtboden: 15,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 2, freigaben: [] },
      // G1–G3 sind die SPERRFÄLLE dieser Datei: das vertrauliche Objekt darf den Modellkontext
      // nicht erreichen. Sie leben von der Grundfreigabe im VORSPANN (sonst liefe gar kein Modell)
      // und bekommen nie eine eigene, großzügigere daneben.
      G1: { boden: 4, freigaben: [] },
      G2: { boden: 3, freigaben: [] },
      G3: { boden: 1, freigaben: [] },
      G4: { boden: 3, freigaben: ["erteileKiFreigabe(reasoner)"] },
      G5: { boden: 2, freigaben: [] },
    },
  },
  "tests/conflicts/detection-cap-honesty.test.ts": {
    gesamtboden: 37,
    faelle: {
      "#1": { boden: 3, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#4": { boden: 9, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#5": { boden: 2, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#6": { boden: 5, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
    },
  },
  "tests/import-freitext-titel/titel-satz-findet-die-seite.test.ts": {
    gesamtboden: 27,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 6, freigaben: [] },
      "#2": { boden: 6, freigaben: [] },
      "#3": { boden: 5, freigaben: [] },
      "#4": { boden: 2, freigaben: [] },
      "#5": { boden: 1, freigaben: [] },
      "#6": { boden: 1, freigaben: [] },
      "#7": { boden: 3, freigaben: [] },
      // Der KI-AUSFALL-Fall baut seinen eigenen, werfenden Reasoner — deshalb hier und nicht oben.
      "#8": { boden: 3, freigaben: ["erteileKiFreigabe(werfend)"] },
    },
  },
  "tests/ka4-freischaltung/ka4-einwilligung-wirkt.test.ts": {
    gesamtboden: 55,
    faelle: {
      "#10": { boden: 5, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/ki-lauf-modell/api-lauf-modell.test.ts": {
    gesamtboden: 14,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 1, freigaben: ["erteileKiFreigabe(mutable.reasoner)"] },
      "#1": { boden: 8, freigaben: [] },
      "#2": { boden: 5, freigaben: [] },
    },
  },
  "tests/ki-lauf-modell/lauf-nennt-modell.test.ts": {
    gesamtboden: 53,
    vollzaehlig: true,
    faelle: {
      VORSPANN: {
        boden: 2,
        freigaben: ["erteileKiFreigabe(reasoner)", "erteileKiFreigabe(reasoner)"],
      },
      "#1": { boden: 5, freigaben: [] },
      "#2": { boden: 4, freigaben: [] },
      "#3": { boden: 6, freigaben: [] },
      "#4": { boden: 3, freigaben: [] },
      "#5": { boden: 4, freigaben: [] },
      "#6": { boden: 3, freigaben: [] },
      "#7": { boden: 2, freigaben: [] },
      "#8": { boden: 2, freigaben: [] },
      "#9": { boden: 3, freigaben: [] },
      "#10": { boden: 4, freigaben: [] },
      "#11": { boden: 3, freigaben: [] },
      "#12": { boden: 3, freigaben: [] },
      "#13": { boden: 2, freigaben: [] },
      "#14": { boden: 3, freigaben: [] },
      "#15": { boden: 4, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/klara-freigabe/v2-einwilligung-ende-zu-ende.test.ts": {
    gesamtboden: 62,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 6, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 1, freigaben: [] },
      "#2": { boden: 8, freigaben: [] },
      "#3": { boden: 10, freigaben: [] },
      "#4": { boden: 15, freigaben: [] },
      "#5": { boden: 5, freigaben: [] },
      "#6": { boden: 6, freigaben: [] },
      "#7": { boden: 6, freigaben: [] },
      "#8": { boden: 2, freigaben: [] },
      "#9": { boden: 3, freigaben: [] },
    },
  },
  "tests/library/import-json-zero-model-calls.test.ts": {
    gesamtboden: 23,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: [] },
      // DIE ZWEI SPERRFÄLLE, um die es in dieser Datei geht: ein Bibliotheks-Import erzeugt NULL
      // Modellaufrufe. Sie sind heute grün und bleiben ohne jede Freigabe — hier steht das
      // namentlich, damit eine spätere Runde sie nicht beiläufig „mitversorgt".
      "#1": { boden: 7, freigaben: [] },
      "#2": { boden: 7, freigaben: [] },
      // NUR die Gegenprobe behauptet eine Zahl über null und bekommt deshalb die Grundfreigabe.
      "#3": { boden: 3, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#4": { boden: 3, freigaben: [] },
      "#5": { boden: 3, freigaben: [] },
    },
  },
  "tests/m3-dokumentweg-panel/w6-anschluss-echte-route.test.ts": {
    gesamtboden: 33,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 13, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      R1: { boden: 7, freigaben: [] },
      R2: { boden: 2, freigaben: [] },
      R3: { boden: 2, freigaben: [] },
      R4: { boden: 2, freigaben: [] },
      R5: { boden: 4, freigaben: [] },
      R6: { boden: 3, freigaben: [] },
    },
  },
  "tests/n11b-zustimmung-macht-intern/zustimmung.test.ts": {
    gesamtboden: 71,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 15, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
      "#1": { boden: 5, freigaben: [] },
      "#2": { boden: 3, freigaben: [] },
      "#3": { boden: 3, freigaben: [] },
      "#4": { boden: 20, freigaben: [] },
      "#5": { boden: 9, freigaben: [] },
      "#6": { boden: 5, freigaben: [] },
      "#7": { boden: 4, freigaben: [] },
      "#8": { boden: 4, freigaben: [] },
      "#9": { boden: 3, freigaben: [] },
    },
  },
  "tests/security/vip2-gate.test.ts": {
    gesamtboden: 86,
    faelle: {
      "#12": { boden: 2, freigaben: ["erteileKiFreigabe(services.reasoner)"] },
    },
  },
  "tests/select-lauf-protokoll/laufprotokoll.test.ts": {
    gesamtboden: 52,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 11, freigaben: [] },
      "#2": { boden: 2, freigaben: [] },
      "#3": { boden: 6, freigaben: [] },
      "#4": { boden: 3, freigaben: [] },
      "#5": { boden: 2, freigaben: [] },
      "#6": { boden: 4, freigaben: [] },
      "#7": { boden: 8, freigaben: [] },
      "#8": { boden: 6, freigaben: [] },
      "#9": { boden: 3, freigaben: [] },
      // Drei Fälle bauen ihren eigenen Reasoner neben dem Aufbau und erteilen deshalb selbst.
      "#10": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#11": { boden: 3, freigaben: [] },
      "#12": { boden: 1, freigaben: [] },
      "#13": { boden: 1, freigaben: ["erteileKiFreigabe(reasoner)"] },
    },
  },
  "tests/select-lauf-protokoll/route-einstieg.test.ts": {
    gesamtboden: 17,
    vollzaehlig: true,
    faelle: {
      VORSPANN: { boden: 0, freigaben: ["erteileKiFreigabe(reasoner)"] },
      "#1": { boden: 6, freigaben: [] },
      "#2": { boden: 8, freigaben: [] },
      "#3": { boden: 2, freigaben: [] },
      "#4": { boden: 1, freigaben: [] },
    },
  },
};

// ================================================================================================
// F7 (JOB 3570 Runde 3) — NAMEN STATT ZAHLEN.
// ================================================================================================
//
// DIE ANWEISUNG DER STEUERUNG (HINWEIS 11.09. 03:2x), wörtlich: „Die Wurzel ist immer dieselbe: ein
// Waechter, der ZAEHLT, laesst sich austricksen. Durch einen Kommentar, durch einen String, durch
// eine neue Zutat, durch eine Umformulierung. … Bau ihn namentlich. Der Waechter fuehrt eine LISTE:
// welche Datei, welcher Testname, welche Erwartung muss dort AUSFUEHRBAR vorhanden sein."
//
// Zwei Runden Geschichte belegen sie: Runde 1 bezahlte ein Kommentar den Boden, Runde 2 ein String.
// Beides waren Wege, eine SUMME zu erreichen, ohne die geschützte Erwartung zu erfüllen. Eine Summe
// hat viele Wege; ein Name hat einen.
//
// F7 führt deshalb je Datei und Testnamen die Erwartungen WÖRTLICH, die dort stehen müssen, und
// prüft für jede zwei Dinge zusammen:
//   1. der Wortlaut steht im Bestandsteil der Datei, UND
//   2. an DERSELBEN Zeichenstelle beginnt im SYNTAXBAUM ein `expect(…)`-Aufruf — der Wortlaut ist
//      also wirklich Code und nicht der Inhalt eines Kommentars, einer Zeichenkette, einer Vorlage
//      oder eines Regex-Literals.
// Damit fällt `void 'expect(datensatz.status).toBe("error")';` durch, ebenso
// `void /expect(datensatz.status).toBe("error");/;`, und eine Umformulierung ebenso: sie trägt den
// geführten Namen nicht mehr.
//
// WIE WEIT DAS TRÄGT, ausdrücklich (JOB 3586): Punkt 2 entscheidet ein PARSER
// (`tests/waechter-ast/erwartungsstellen.ts`), kein Zeichenvergleich — drei Runden Zeichenvergleich
// haben belegt, dass es anders nicht geht. Nicht entschieden ist damit die LAUFZEIT: eine
// Bedingung, die erst im Lauf falsch wird, sieht kein Parser. Der syntaktisch tote Zweig ist
// abgedeckt. Was F7 trägt — Name, Datei, Wortlaut, ausgeführt — trägt es belegt (Prüfer BEN,
// Runde 3: Löschprobe und Stringprobe; JOB 3586: dieselben vier Proben dauerhaft in
// `tests/waechter-ast/vier-proben.test.ts`).
//
// WAS F7 (NOCH) NICHT IST: keine vollständige Abschrift aller 803 Erwartungen der Fläche. Geführt
// sind die, deren Verlust gefährlich wäre — jede NULL eines Sperrfalls und je Datei die Erwartung,
// die ohne die Grundfreigabe gar nicht mehr messbar wäre. Was fehlt, steht in der Rückgabe; das
// Register wächst durch Zeilen, nicht durch Umbau.
interface NamentlicheDatei {
  readonly datei: string;
  /** Warum diese Datei namentlich geführt wird — was ihr Verlust kostet. */
  readonly warum: string;
  readonly faelle: readonly {
    /** Ein Stück des Testnamens, eindeutig in der Datei — kein Zählindex, der beim Einfügen rutscht. */
    readonly testname: string;
    /** Wörtlich, einzeilig, beginnt mit `expect(` — und darf nicht in einer Zeichenkette stehen. */
    readonly erwartungen: readonly string[];
  }[];
}

const NAMENTLICHE_ERWARTUNGEN: readonly NamentlicheDatei[] = [
  {
    datei: DIESE_DATEI,
    warum:
      "Die drei Sperr-Fälle dieser Datei tragen die Null, an der die Adminfreigabe gemessen wird: " +
      "A2 speichert nur, D5 und N4 dürfen trotz Grundfreigabe NICHTS übertragen.",
    faelle: [
      {
        testname: "A2 · die Wahl kennt beide Anbieter",
        erwartungen: ["expect(reasoner.getTaskConfig()).toEqual({"],
      },
      {
        testname: "D5 · vertrauliche Eingabe ohne Freigabe",
        erwartungen: [
          "expect([wahl, extern(anfragen).length]).toEqual([wahl, 0]);",
          'expect([wahl, ergebnis.fallbackReason]).toEqual([wahl, "confidential"]);',
        ],
      },
      {
        testname: "N4 · vertrauliches Paar bei expliziter Wahl",
        erwartungen: [
          "expect([wahl, extern(anfragen).length]).toEqual([wahl, 0]);",
          'expect([wahl, konflikt]).toEqual([wahl, { verdict: null, failure: "confidential" }]);',
        ],
      },
    ],
  },
  {
    datei: "tests/ki-lauf-verbrauch/ehrlich.test.ts",
    warum:
      "Die Datei, an der Prüfer BEN beide Löcher gemessen hat. V3c unterscheidet „Verbrauch da, " +
      'Status bleibt error" von „alles gut"; V3b hält die Gegenrichtung (kein Modell, kein Feld).',
    faelle: [
      {
        testname: "V3c · gescheitert NACH gemeldetem Verbrauch",
        erwartungen: ['expect(datensatz.status).toBe("error");'],
      },
      {
        testname: "V3b · rein deterministischer Lauf",
        erwartungen: ['expect(Object.hasOwn(datensatz, "verbrauch")).toBe(false);'],
      },
    ],
  },
  {
    datei: "tests/ki-lauf-verbrauch/spur.test.ts",
    warum:
      "Ohne die Zwei ist nicht belegt, dass ÜBERHAUPT zwei Läufe das Modell befragt haben — dann " +
      "wäre die Trennung der Verbrauchswerte die Trennung von nichts.",
    faelle: [
      {
        testname: "V1 · jeder Lauf trägt genau seinen eigenen Wert",
        erwartungen: [
          'expect(n, "beide Läufe haben wirklich das Modell befragt").toBe(2);',
          'expect(gemessen).toEqual(["100/10", "7/3"]);',
        ],
      },
    ],
  },
  {
    datei: "tests/ki-lauf-verbrauch/genau-einmal.test.ts",
    warum:
      'Das Gesetz „genau einmal bezahlt" hängt an gezählten ECHTEN Aufrufen; fällt die Zählung, ' +
      "ist ein zweiter bezahlter Aufruf nicht mehr von einem zweiten Schreibversuch zu trennen.",
    faelle: [
      {
        testname: "V6a · ein Modellaufruf",
        erwartungen: ['expect(aufrufe, "genau EIN echter Modellaufruf in diesem Lauf").toBe(1);'],
      },
      {
        testname: "V6b · zwei Versuche",
        erwartungen: ['expect(lauf?.model).toBe("claude-sonnet-4-6");'],
      },
    ],
  },
  {
    datei: "tests/reasoner/dual-provider.test.ts",
    warum:
      "Die Reihenfolge Cloud → lokal → Ersatz ist nur an der ANTWORT zu erkennen. Ohne diese drei " +
      "Erwartungen prüfte die Datei dreimal dieselbe Sperre statt der Kette (Auftrag §2).",
    faelle: [
      {
        testname: "auto: das Cloud-Modell arbeitet zuerst",
        erwartungen: ['expect((await r.assistText("roh", "de")).text).toBe("CLOUD");'],
      },
      {
        testname: "auto: fällt der Cloud-Aufruf aus",
        erwartungen: ['expect(res.text).toBe("LOCAL");', "expect(res.demo).toBe(false);"],
      },
    ],
  },
  {
    datei: "tests/reasoner/aistate-egress-guard.test.ts",
    warum:
      "Der einzige Fall dieser Datei MIT Grundfreigabe ist ein Sperrfall: die Null soll an der " +
      "Vertraulichkeit liegen, nicht an der Erlaubnis. Beides zusammen ist die Aussage.",
    faelle: [
      {
        testname: "Cloud-Primary + vertraulich",
        erwartungen: [
          "expect(completes).toBe(0);",
          'expect(out).toEqual({ verdict: null, failure: "confidential" });',
        ],
      },
    ],
  },
  {
    datei: "services/reasoner/src/job3353-vertraulichkeit-sperre.test.ts",
    warum:
      "Die Sperrmeldung behauptet, die Cloud wäre OHNE die Einstufung gelaufen. Fällt die " +
      'Cloud-Null oder die Gegenprobe S3 („gar keine Cloud"), ist das eine Aussage über die ' +
      "falsche Ursache.",
    faelle: [
      {
        testname: "S1 POSITIV",
        erwartungen: [
          "expect(fehler).toBeInstanceOf(ConfidentialCloudBlockedError);",
          "expect(calls()).toBe(0);",
        ],
      },
      {
        testname: "S3 NEGATIV",
        erwartungen: ["expect(fehler).not.toBeInstanceOf(ConfidentialCloudBlockedError);"],
      },
      { testname: "S6 POSITIV am ECHTEN Bestand", erwartungen: ["expect(calls()).toBe(0);"] },
    ],
  },
  {
    datei: "services/app/src/routes/reasoner-egress.test.ts",
    warum:
      "Die drei Sperrfälle hier sind der Grund, warum diese Datei AUSDRÜCKLICH keine Freigabe " +
      "bekommt (Register 3). Ihre GEGENPROBE — derselbe Aufbau, mit Grundfreigabe, mit Aufruf — " +
      "liegt seit JOB 3549 R6 in `tests/admin-ki-freigabe/verlagerte-modellwege.test.ts` (Block 4, " +
      "Fall „Positiv: bewusst intern“); sie braucht die Freigabe und kann sie hier nicht bekommen.",
    faelle: [
      {
        testname: "extract: Upload (transient-document) OHNE Stufe",
        erwartungen: ["expect(complete).not.toHaveBeenCalled();"],
      },
      {
        testname: "assist: Editor-Text (draft) ohne Stufe",
        erwartungen: [
          "expect(complete).not.toHaveBeenCalled();",
          'expect(koerper.reason).toBe("unsaved_draft");',
        ],
      },
      {
        testname: "extract: transient-document + koId eines INTERNEN KOs",
        erwartungen: ["expect(complete).not.toHaveBeenCalled();"],
      },
      // JOB 3549 R6: der Fall „Positiv: bewusst intern" ist AUSGETRAGEN, weil er umgezogen ist
      // (s. `warum` oben). F7 verlangt die Ausführung eines geführten Falls unter seinem Namen in
      // SEINER Datei; ein Eintrag ohne Träger macht den Wächter rot, und zwar zu Recht. Der Fall
      // selbst ist nicht verschwunden, nur umgezogen — die Fallzahl der Klasse ist unverändert.
    ],
  },
  {
    datei: "services/app/src/routes/reasoner-routes.test.ts",
    warum:
      "B10 fährt die GANZE Kette mit verdrahteter Cloud: seine 409 mit Grund `unsaved_draft` und " +
      "seine Cloud-Null sind zusammen die Aussage, an der der Kern JOB 3549 in Runde 1 rot wurde.",
    faelle: [
      {
        testname: "B10 — DIE GANZE KETTE",
        erwartungen: [
          "expect(cloudAufrufe).toBe(0);",
          'expect(body.reason).toBe("unsaved_draft");',
        ],
      },
    ],
  },
];

describe("JOB 3550 F: der Freigabe-Wächter — die KI-Freigabe bleibt eine namentliche Ausnahme", () => {
  it("F1 · genau die Dateien im Register benutzen den Helfer — keine mehr, keine weniger", () => {
    const benutzer = testquellen()
      .filter((p) => new RegExp(`from\\s+"[^"]*${HELFER}"`).test(lies(p)))
      .sort();
    const eingetragen = [...FREIGABE_ERLAUBT.keys()].sort();
    // Beide Richtungen in EINER Aussage: ein neuer Benutzer ist rot, ein Registereintrag ohne
    // Träger ebenso — sonst wüchse das Register mit Zeilen, die nichts mehr decken.
    expect(benutzer).toEqual(eingetragen);
    // Und dieselben Dateien führen eine Fallakte (F4). Zwei Listen, die auseinanderlaufen dürfen,
    // sind keine zwei Wächter, sondern ein Schlupfloch.
    expect(Object.keys(FALLAKTEN).sort()).toEqual(eingetragen);
    // Und die Zusage aus §3.1 ist nachgezählt: EINE Stelle für alle.
    expect(FREIGABE_ERLAUBT.size).toBeGreaterThan(0);
    for (const [datei, grund] of FREIGABE_ERLAUBT) {
      expect([datei, grund.length > 60]).toEqual([datei, true]);
    }
  });

  it("F2 · niemand schreibt die Freigabefelder von Hand — auch diese Datei nicht", () => {
    const felder = ["oeffentlicheKi", "vertraulicheInhalte"];
    // `bestand` schneidet NUR diesen Wächterblock weg (er misst den Vertrag und muss die Namen
    // nennen dürfen). Der Bestandsteil dieser Datei wird geprüft wie jeder andere — das ist die
    // Korrektur (c) aus dem Kopf dieses Blocks.
    //
    // GEMESSEN STATT GERATEN WIRD SEIT JOB 3586 AM CODE, NICHT AM ROHTEXT. F2 verglich Zeichen und
    // fiel damit auf denselben Trick herein wie F4 und F7 vor diesem Auftrag — nur in die andere
    // Richtung: als FEHLALARM. Der Prüffall der Steuerung (JOB 3588, dessen 29 Dateien hier
    // eingespielt und gemessen wurden) machte F2 mit 23 Dateien rot; NEUNZEHN davon nannten das
    // Feld ausschließlich in einem Kommentar, und zwar in genau dem Satz, den die Steuerung
    // ausdrücklich sehen will: „Kein `vertraulicheInhalte`: die KOs sind intern eingestuft."
    // Ein Wächter, der die BEGRÜNDUNG der Zurückhaltung bestraft, treibt sie aus den Dateien
    // heraus. `bestandCode` blendet Kommentare aus und lässt ZEICHENKETTEN stehen — die vier
    // Dateien, die `kiFreigabe: { oeffentlicheKi: true }` wirklich schreiben, bleiben rot.
    const vonHand = testquellen().filter((p) => {
      const quelle = bestandCode(p);
      return felder.some((feld) => quelle.includes(feld));
    });
    expect(vonHand).toEqual([]);
    // KALIBRIERUNG der Unterscheidung, an der sie hängt — beide Richtungen, sonst bewiese die Zeile
    // oben vielleicht nur, dass nirgends etwas steht. Ein Feldname in Prosa ist keine Zuweisung;
    // derselbe Name als Eigenschaft oder in einer Zeichenkette ist eine und bleibt rot.
    const muster = [
      "// Kein `vertraulicheInhalte`: dieser Fall ist intern eingestuft.",
      "/* auch hier nur Prosa: oeffentlicheKi */",
      "const hart = { kiFreigabe: { oeffentlicheKi: true } };",
      'const auchHart = cfg["vertraulicheInhalte"];',
    ].join("\n");
    const gesiebt = nurCode(muster, "F2-KALIBRIERUNG.ts");
    // Der Rohtext trägt jeden der vier Namen — die Siebung entscheidet, nicht die Suche.
    expect((muster.match(/oeffentlicheKi|vertraulicheInhalte/g) ?? []).length).toBe(4);
    expect((gesiebt.match(/oeffentlicheKi|vertraulicheInhalte/g) ?? []).length).toBe(2);
    expect(gesiebt).toContain("kiFreigabe: { oeffentlicheKi: true }");
    expect(gesiebt).toContain('cfg["vertraulicheInhalte"]');
    // Und längentreu bleibt sie auch hier: sonst läge F4 in derselben Datei auf falschen Stellen.
    expect(gesiebt.length).toBe(muster.length);
    // Der zweite Schalter ist nirgends erteilt — und das ist eine Liste, kein Zufall.
    expect(VERTRAULICH_ERLAUBT).toEqual([]);
  });

  it("F3 · die Sperr-Fälle dieser Datei: genau die Freigabe, die ihnen zusteht — und ihre Null", () => {
    const stuecke = faelle(bestandCode(DIESE_DATEI));
    const hole = (fall: string): string => {
      const text = stuecke.get(fall);
      expect([fall, text !== undefined]).toEqual([fall, true]);
      return (text ?? "").replace(/\s+/g, " ");
    };
    const rufe = (text: string): string[] => [...text.matchAll(FREIGABE_RUF)].map((t) => t[0]);

    // A2 misst SPEICHERN und ABLEHNEN, nicht den Weg nach draußen: gar keine Freigabe.
    const a2 = hole("A2");
    expect(rufe(a2)).toEqual([]);
    expect(a2).toContain("rejects.toThrow()");

    // D5 und N4 brauchen die GRUNDfreigabe (sonst wäre die Ursache „kein Modell" statt
    // „vertraulich") — aber GENAU DIESE EINE. Eine zweite, großzügigere daneben ist der Fehler,
    // den Runde 1 durchgelassen hat; deshalb steht hier eine Gleichheit und kein `includes`.
    for (const fall of ["D5", "N4"]) {
      const text = hole(fall);
      expect([fall, rufe(text)]).toEqual([fall, [ZUORDNUNG("wahl")]]);
      expect([fall, text.includes("extern(anfragen).length]).toEqual([wahl, 0])")]).toEqual([
        fall,
        true,
      ]);
      expect([fall, text.includes('"confidential"')]).toEqual([fall, true]);
    }
  });

  it("F4 · je Fall: der Erwartungsboden und die vollzählige Liste der Freigabe-Aufrufe", () => {
    // KALIBRIERUNG (JOB 3586): der Boden zählt AUSGEFÜHRTE Erwartungen, entschieden am Syntaxbaum.
    // Die Formen, an denen JOB 3570 dreimal gescheitert ist, stehen hier nebeneinander: Kommentar
    // (Runde 1), Zeichenkette (Runde 2), Regex-Literal nach `void` (Runde 3) — dazu der tote Zweig
    // in allen Gestalten, die ein Parser entscheiden kann (`if`, `for`, `while`, Kurzschluss,
    // Auswahl; die Schleifen- und Ausdrucksformen sind die Korrekturpflicht von Prüfer BEN aus
    // Runde 1). Jede von ihnen trägt den WORTLAUT einer Erwartung und keine Ausführung. Vor
    // JOB 3586 zahlten sie den Boden; jetzt zählen sie nicht mehr mit. Ihre ausführlichen Proben an
    // ECHTEM Material führt `tests/waechter-ast/vier-proben.test.ts`.
    const muster = [
      'const w = "nicht // ein Kommentar";',
      "// Hier stand einmal expect(alt).toBe(1) — Prosa, kein Lauf.",
      "/* auch das nicht: expect(auch).toBe(2) */",
      "void 'expect(alsZeichenkette).toBe(3)';",
      "void `expect(inVorlage).toBe(4)`;",
      // Der Klammerauf im Regex steht ABSICHTLICH ungeschützt (eine Gruppe): nur so trägt die
      // Zeile überhaupt den Wortlaut, an dem die alte Zählung gescheitert ist.
      "void /expect(imRegexLiteral).toBe(5);/;",
      "if (false) expect(imTotenZweig).toBe(6);",
      // Die Schleifenformen desselben toten Zweigs (Korrekturpflicht 1, Prüfer BEN, Runde 1): in
      // Runde 1 zählte `for (; false;)` noch mit, und damit war die teuerste Erwartung der Fläche
      // still abzuschalten.
      "for (; false;) expect(imTotenFor).toBe(9);",
      "while (false) expect(imTotenWhile).toBe(10);",
      "false && expect(imTotenUnd).toBe(11);",
      "true ? 0 : expect(imTotenZweigWahl).toBe(12);",
      "expect(echt).toBe(7);",
      "void `Vorlage mit ${expect(inEinbettung).toBe(8)} darin`;",
      "expect(zeichen).toMatch(/expect(imMuster)/);",
    ].join("\n");
    const ganzesMuster = { von: 0, bis: muster.length };
    const gemessen = erwartungsstellen(muster, "KALIBRIERUNG.ts");
    // DREI laufen: die offene Erwartung, die in der Einbettung (die läuft wirklich) und die
    // `toMatch`-Prüfung. Der WORTLAUT steht vierzehnmal da — diese Spreizung ist die ganze Aussage
    // des Auftrags, und sie wird gemessen und nicht behauptet.
    expect((muster.match(/expect\(/g) ?? []).length).toBe(14);
    expect(gemessen.stellen).toHaveLength(3);
    for (const laeuft of [
      "expect(echt).toBe(7);",
      "expect(inEinbettung).toBe(8)",
      "expect(zeichen).toMatch(",
    ]) {
      expect([laeuft, erwartungLaeuft(muster, gemessen, laeuft, ganzesMuster)]).toEqual([
        laeuft,
        [muster.indexOf(laeuft)],
      ]);
    }
    for (const wortlaut of [
      "expect(alt).toBe(1)",
      "expect(auch).toBe(2)",
      "expect(alsZeichenkette).toBe(3)",
      "expect(inVorlage).toBe(4)",
      "expect(imRegexLiteral).toBe(5)",
      "expect(imTotenZweig).toBe(6)",
      "expect(imTotenFor).toBe(9)",
      "expect(imTotenWhile).toBe(10)",
      "expect(imTotenUnd).toBe(11)",
      "expect(imTotenZweigWahl).toBe(12)",
      "expect(imMuster)",
    ]) {
      // Der Wortlaut IST da — er läuft nur nicht. Beides wird gemessen, sonst bewiese die zweite
      // Zeile vielleicht nur einen Suchfehler statt einer Unterscheidung.
      expect([wortlaut, muster.includes(wortlaut)]).toEqual([wortlaut, true]);
      expect([wortlaut, erwartungLaeuft(muster, gemessen, wortlaut, ganzesMuster)]).toEqual([
        wortlaut,
        [],
      ]);
    }
    // Und die Unterscheidung greift auf ECHTEM Material, nicht nur am Muster: diese beiden Dateien
    // führen je eine Erwähnung in Prosa, die vor der Korrektur als Boden mitzählte.
    for (const belegt of [
      "tests/ki-lauf-verbrauch/ehrlich.test.ts",
      "tests/ki-lauf-verbrauch/spur.test.ts",
    ]) {
      const roh = (bestand(belegt).match(/expect\(/g) ?? []).length;
      const echt = bestandsstellen(belegt).stellen.length;
      expect([belegt, roh > echt]).toEqual([belegt, true]);
    }

    // KALIBRIERUNG DER REGEL, die seit JOB 3586 die Stückzahl je Datei ersetzt: erteilen ist
    // erlaubt, selbst setzen nicht. Eine Regel, die nie feuert, bewacht nichts — deshalb steht die
    // rote Richtung hier genauso gemessen da wie die grüne. Diese Zeilen dürfen die Feldnamen
    // nennen: der Wächterblock ist aus dem Bestandsteil dieser Datei herausgeschnitten (F2).
    for (const erlaubt of [
      AM_REASONER,
      ZUORDNUNG('"openai"'),
      ZUORDNUNG('"openai"', '{ assist: "anthropic" }'),
      "mitKiFreigabe(konfig)",
    ]) {
      expect([erlaubt, setztFreigabeSelbst(erlaubt)]).toEqual([erlaubt, false]);
    }
    for (const ausgeweitet of [
      "erteileKiFreigabe(reasoner, { vertraulicheInhalte: true })",
      "mitKiFreigabe(vorlage, { oeffentlicheKi: true })",
      'mitKiFreigabe({ global: "openai", perTask: {} }, { vertraulicheInhalte: true })',
    ]) {
      expect([ausgeweitet, setztFreigabeSelbst(ausgeweitet)]).toEqual([ausgeweitet, true]);
    }

    for (const [datei, dateiakte] of Object.entries(FALLAKTEN)) {
      const akten = dateiakte.faelle;
      const code = bestandCode(datei);
      const befund = bestandsstellen(datei);
      // DIE GLEICHLAGE, geprüft statt angenommen: der Syntaxbaum zählt auf der ROHEN Quelle, die
      // Fallgrenzen stehen im ausgeblendeten Text. Nur weil `nurCode` längentreu ist, liegt ein
      // Fall in beiden an derselben Zeichenstelle. Wäre sie verletzt, zählte der Wächter den
      // falschen Fall — still und grün.
      expect([datei, "Gleichlage", bestand(datei).length]).toEqual([
        datei,
        "Gleichlage",
        code.length,
      ]);
      const ganzerBestand = code.replace(/\s+/g, " ");
      const stellen = fallStellen(code);
      // WO DER AUFBAU GETEILT IST, IST JEDER FALL BETROFFEN (Korrekturpflicht 2 von Prüfer BEN).
      // Steht die Freigabe im VORSPANN, läuft JEDER Fall der Datei durch sie hindurch — dann ist
      // „nur die geänderten Fälle führen" keine Grenze mehr, sondern ein Loch: in `ehrlich.test.ts`
      // hing V3c allein am Dateiboden, und eine zusätzliche Erwartung in einem anderen Fall hätte
      // den Verlust seiner Fehlerstatus-Prüfung ausgeglichen. Solche Dateien sind vollzählig.
      if ((akten.VORSPANN?.freigaben.length ?? 0) > 0) {
        const wozu = "VORSPANN gibt frei → die Datei ist vollzählig zu führen";
        expect([datei, wozu, dateiakte.vollzaehlig === true]).toEqual([datei, wozu, true]);
      }
      // DIE DATEI ALS GANZES (JOB 3570): der Boden über alle Fälle. Eine gelöschte Erwartung und
      // ein gelöschter GANZER Fall fallen hier auf — auch in einem Fall, der unten nicht einzeln
      // geführt wird. Eine DAZUGEKOMMENE Erwartung ist kein Fehler; deshalb eine Schranke.
      const alleRufe = [...ganzerBestand.matchAll(FREIGABE_RUF)].map((t) => t[0]);
      expect(
        befund.stellen.length,
        `${datei}: ${befund.stellen.length} ausgeführte Erwartungen, geführt sind ${dateiakte.gesamtboden}`,
      ).toBeGreaterThanOrEqual(dateiakte.gesamtboden);
      // DIE REGEL STATT DER STÜCKZAHL (JOB 3586, Hinweis der Steuerung 11.09. 09:5x): ein
      // Freigabe-Aufruf trägt GENAU EIN Argument — die Zuordnung. Der zweite Parameter beider
      // Helferformen IST die Freigabe (`{ oeffentlicheKi, vertraulicheInhalte }`); wer ihn
      // schreibt, weitet aus, statt die Grundfreigabe zu erteilen. Diese Regel kostet keine
      // Pflege je Datei, gilt für jede künftig eingetragene Datei mit — und sie ersetzt die
      // Wortlautliste `formen`, die genau das je Datei aufzählte. Gezählt wird nichts mehr: eine
      // zusätzliche Grundfreigabe in einem nicht geführten Fall ist erlaubt (so arbeitet
      // JOB 3588), eine in einem SPERRFALL nicht — der steht namentlich unten in `faelle`.
      for (const ruf of alleRufe) {
        expect(
          setztFreigabeSelbst(ruf),
          `${datei}: ${ruf} setzt die Freigabe selbst statt sie zu erteilen`,
        ).toBe(false);
      }
      // Und für die drei Dateien von JOB 3550, deren Fallliste KOMPLETT ist, bleibt es dabei:
      // kein Fall verschwindet und keiner kommt unbemerkt dazu.
      if (dateiakte.vollzaehlig) {
        expect([datei, [...stellen.keys()].sort()]).toEqual([datei, Object.keys(akten).sort()]);
      }
      for (const [fall, akte] of Object.entries(akten)) {
        // Ein geführter Fall, den es nicht mehr gibt (umbenannt, verschoben, gelöscht), ist ein
        // Loch und keine Kleinigkeit: die Akte bewachte dann nichts mehr.
        expect([datei, fall, stellen.has(fall)]).toEqual([datei, fall, true]);
        const stelle = stellen.get(fall) ?? { von: 0, bis: 0 };
        const text = code.slice(stelle.von, stelle.bis).replace(/\s+/g, " ");
        // Gezählt wird am Syntaxbaum, im Bereich DIESES Falls — ein Wortlaut in einem Kommentar,
        // einer Zeichenkette, einem Regex-Literal oder einem toten Zweig ersetzt keine Erwartung.
        const zahl = zaehleErwartungen(befund, stelle.von, stelle.bis);
        expect(
          zahl,
          `${datei} · ${fall}: ${zahl} ausgeführte Erwartungen, geführt sind ${akte.boden}`,
        ).toBeGreaterThanOrEqual(akte.boden);
        expect([datei, fall, [...text.matchAll(FREIGABE_RUF)].map((t) => t[0])]).toEqual([
          datei,
          fall,
          [...akte.freigaben],
        ]);
      }
      // Und kein Fall wird übersprungen. Die Marken werden aus Wortstamm und Klammer
      // ZUSAMMENGESETZT und stehen bewusst nirgends wörtlich in dieser Datei — auch nicht in dieser
      // Erklärung. Der Wächter liest sich selbst mit, und eine wörtliche Marke in seiner eigenen
      // Prüfliste macht ihn rot. Das ist gemessen und nicht bedacht: der erste Lauf fiel genau
      // darüber (Arbeitsprüfung 3925a6e5d44148b199f85f4bdfa40c6a, F4, „expected false, received
      // true"), der zweite noch einmal über den Kommentar, der den ersten Fehler erklären wollte.
      const ganz = lies(datei);
      for (const wort of ["skip", "only", "todo", "fails"]) {
        const schwaeche = `.${wort}(`;
        expect([datei, schwaeche, ganz.includes(schwaeche)]).toEqual([datei, schwaeche, false]);
      }
    }
  });

  it("F5 · der Vertrag des Helfers: er setzt genau die zwei Felder, und nur als `true`", async () => {
    // `mitKiFreigabe` hängt an, ohne zu verändern — und ohne die Vorlage anzufassen.
    const vorlage: ReasonerTaskConfigEingabe = {
      global: "openai",
      perTask: { assist: "anthropic" },
    };
    const mit = mitKiFreigabe(vorlage);
    expect(mit.global).toBe("openai");
    expect(mit.perTask).toEqual({ assist: "anthropic" });
    expect(mit.kiFreigabe).toEqual({ oeffentlicheKi: true });
    expect(vorlage).toEqual({ global: "openai", perTask: { assist: "anthropic" } });

    // Beide Felder aus dem Vertrag (Auftrag §4) sind setzbar — der zweite nur, wenn er genannt wird.
    expect(
      mitKiFreigabe(vorlage, { oeffentlicheKi: true, vertraulicheInhalte: true }).kiFreigabe,
    ).toEqual({ oeffentlicheKi: true, vertraulicheInhalte: true });
    // „Nur `true` zählt" ist keine Prosa, sondern der Typ: `false` ist nicht einmal schreibbar.
    // @ts-expect-error `false` behauptet eine Freigabe, die es nicht gibt — wer nicht freigibt, lässt weg.
    mitKiFreigabe(vorlage, { oeffentlicheKi: false });

    // `erteileKiFreigabe` lässt die Zuordnung, wie sie ist, und reicht die Freigabe durch.
    const gesehen: ReasonerTaskConfigEingabe[] = [];
    const stand: ReasonerTaskConfig = { global: "auto", perTask: { select: "anthropic" } };
    await erteileKiFreigabe({
      getTaskConfig: () => stand,
      setTaskConfig: async (next) => {
        gesehen.push(next);
        return stand;
      },
    });
    expect(gesehen).toHaveLength(1);
    expect(gesehen[0]?.global).toBe("auto");
    expect(gesehen[0]?.perTask).toEqual({ select: "anthropic" });
    expect((gesehen[0] as { kiFreigabe?: unknown }).kiFreigabe).toEqual({ oeffentlicheKi: true });
  });

  it("F7 · namentlich geführte Erwartungen werden AUSGEFÜHRT, nicht nur zitiert", () => {
    /**
     * WAS GEPRÜFT WIRD (seit JOB 3586): der Wortlaut steht in der Quelle UND an genau dieser
     * Zeichenstelle beginnt im SYNTAXBAUM ein `expect(…)`-Aufruf. Beides zusammen, denn einzeln ist
     * jedes zu haben: den Wortlaut hat auch ein Kommentar, den Aufruf hat auch jede andere
     * Erwartung.
     *
     * WAS DAS GEGENÜBER RUNDE 4 MEHR IST: der Baum kennt keinen Kommentar- und keinen
     * Literalinhalt. Damit fällt neben `void 'expect(…)';` jetzt auch `void /expect(…)/;` durch —
     * die Gegenprobe, an der JOB 3570 in Runde 3 gescheitert ist. Der Fall heißt deshalb wieder
     * AUSGEFÜHRT: diesmal hält der Name, weil ein Parser entscheidet und kein Zeichenvergleich.
     *
     * WAS WEITERHIN NICHT GEPRÜFT WIRD: ob der Lauf die Stelle zur Laufzeit ERREICHT — eine
     * Bedingung, die erst im Lauf falsch wird, sieht kein Parser. Der syntaktisch tote Zweig ist
     * abgedeckt (`tests/waechter-ast/erwartungsstellen.ts`, Abschnitt TOTER_ZWEIG).
     */
    // KALIBRIERUNG: die Unterscheidung selbst, an einem Muster gemessen. Die drei Fälschungen sind
    // die drei Runden von JOB 3570 — Kommentar, Zeichenkette, Regex-Literal.
    const probe = [
      "expect(echt).toBe(1);",
      "void 'expect(gefaelscht).toBe(2)';",
      "void /expect(imRegex).toBe(3);/;",
      "// expect(imKommentar).toBe(4);",
    ].join("\n");
    const probeBefund = erwartungsstellen(probe, "F7-KALIBRIERUNG.ts");
    const ganz = { von: 0, bis: probe.length };
    expect(erwartungLaeuft(probe, probeBefund, "expect(echt).toBe(1);", ganz)).toHaveLength(1);
    for (const gefaelscht of [
      "expect(gefaelscht).toBe(2)",
      "expect(imRegex).toBe(3)",
      "expect(imKommentar).toBe(4)",
    ]) {
      // Der Wortlaut IST da — der Suchbegriff ist wörtlich derselbe, der oben gefunden wird; damit
      // trennt die zweite Bedingung und nicht ein Suchfehler.
      expect([gefaelscht, probe.includes(gefaelscht)]).toEqual([gefaelscht, true]);
      expect([gefaelscht, erwartungLaeuft(probe, probeBefund, gefaelscht, ganz)]).toEqual([
        gefaelscht,
        [],
      ]);
    }

    expect(NAMENTLICHE_ERWARTUNGEN.length).toBeGreaterThan(8);
    for (const akte of NAMENTLICHE_ERWARTUNGEN) {
      // Der Grund ist Pflicht, in derselben Länge wie in F1 und F6.
      expect([akte.datei, akte.warum.length > 60]).toEqual([akte.datei, true]);
      const code = bestandCode(akte.datei);
      const roh = bestand(akte.datei);
      const befund = bestandsstellen(akte.datei);
      // Dieselbe Gleichlage wie in F4: Fallgrenzen im ausgeblendeten Text, Aufrufstellen in der
      // rohen Quelle — beide nur deckungsgleich, weil `nurCode` längentreu ist.
      expect([akte.datei, "Gleichlage", roh.length]).toEqual([
        akte.datei,
        "Gleichlage",
        code.length,
      ]);
      const stellen = [...fallStellen(code)];
      expect([akte.datei, akte.faelle.length > 0]).toEqual([akte.datei, true]);

      for (const fall of akte.faelle) {
        // Der Testname wird im KOPFBEREICH des Falls gesucht, nicht in seinem Rumpf: ein Fall, der
        // den Namen eines anderen nur erwähnt, ist nicht dieser Fall.
        const treffer = stellen.filter(([, s]) =>
          code.slice(s.von, Math.min(s.bis, s.von + 300)).includes(fall.testname),
        );
        // Genau einer. Null heißt umbenannt oder gelöscht, zwei heißt: der Name trennt nicht mehr.
        expect([akte.datei, fall.testname, treffer.length]).toEqual([akte.datei, fall.testname, 1]);
        const bereich = treffer[0]?.[1] ?? { von: 0, bis: 0 };
        for (const erwartung of fall.erwartungen) {
          // Eine geführte Zeile, die nicht mit `expect(` beginnt, könnte die zweite Bedingung nie
          // erfüllen — dann wäre der Eintrag stumm statt streng.
          expect([erwartung, erwartung.startsWith("expect(")]).toEqual([erwartung, true]);
          const gefunden = erwartungLaeuft(roh, befund, erwartung, bereich);
          expect([akte.datei, fall.testname, erwartung, gefunden.length > 0]).toEqual([
            akte.datei,
            fall.testname,
            erwartung,
            true,
          ]);
        }
      }
    }
  });

  it("F6 · jede Datei der Fläche steht in EINEM der beiden Register — mit Grund", () => {
    // Die Fläche selbst absuchen, nicht eine Namensliste pflegen: genau daran ist JOB 3550
    // vorbeigelaufen (drei versorgte Dateien, dreiunddreißig liegengeblieben).
    const inDerFlaeche = testquellen().filter((p) =>
      FLAECHE.some((ort) => p === ort || p.startsWith(`${ort}/`)),
    );
    // KALIBRIERUNG: eine leere Fläche würde jede Aussage unten grün machen, ohne etwas zu prüfen.
    expect(inDerFlaeche.length).toBeGreaterThan(40);

    const unversorgt: string[] = [];
    const mitModellweg: string[] = [];
    for (const pfad of inDerFlaeche) {
      // Auf dem AUSFÜHRBAREN suchen: ein auskommentierter Aufbau baut keinen Weg nach draußen und
      // soll keinen Registereintrag verlangen. Die Abtastung ist längentreu, die Zeilennummer in
      // der Fehlermeldung bleibt deshalb die der echten Datei.
      const zeilen = nurCode(lies(pfad), pfad).split("\n");
      const treffer = zeilen.findIndex((zeile) => MODELLWEG.test(zeile));
      if (treffer < 0) continue;
      mitModellweg.push(pfad);
      if (FREIGABE_ERLAUBT.has(pfad) || OHNE_FREIGABE_MIT_GRUND.has(pfad)) continue;
      unversorgt.push(
        `baut einen Modellweg, steht in keinem der beiden Register: ${pfad}:${treffer + 1}`,
      );
    }
    expect(unversorgt).toEqual([]);

    // Die andere Richtung: kein Eintrag ohne Träger. Ein Register, das Dateien führt, die es
    // nicht mehr gibt (oder die keinen Modellweg mehr bauen), verwaltet Papier statt Code.
    const ohneTraeger = [...OHNE_FREIGABE_MIT_GRUND.keys()].filter(
      (p) => !mitModellweg.includes(p),
    );
    expect(ohneTraeger).toEqual([]);

    // Und der Grund ist auch hier Pflicht, in derselben Länge wie in F1 — eine Zeile „passt
    // schon" wäre der Anfang vom Ende dieses Registers.
    for (const [datei, grund] of OHNE_FREIGABE_MIT_GRUND) {
      expect([datei, grund.length > 60]).toEqual([datei, true]);
    }
  });
});
