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

/** Alle Testquellen unterhalb von `tests/`, ohne den Kern — DIESE Datei eingeschlossen. */
function testquellen(verzeichnis = "tests"): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(process.cwd(), verzeichnis), { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name.startsWith(".")) continue;
    const relativ = `${verzeichnis}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      gefunden.push(...testquellen(relativ));
    } else if (relativ.endsWith(".ts") || relativ.endsWith(".tsx")) {
      gefunden.push(relativ);
    }
  }
  return gefunden.filter((p) => !p.startsWith(KERN));
}

const lies = (pfad: string): string => readFileSync(join(process.cwd(), pfad), "utf8");

/**
 * Der BESTANDSTEIL einer Datei: alles, was nicht dieser Wächterblock ist.
 *
 * Für jede andere Datei ist das die ganze Datei. Nur diese hier wird geschnitten — und wenn die
 * Marke fehlt, ist die Trennung nicht mehr belegt: dann lieber rot als blind grün.
 */
function bestand(pfad: string): string {
  const quelle = lies(pfad);
  if (pfad !== DIESE_DATEI) return quelle;
  const schnitt = quelle.indexOf(SCHNITTMARKE);
  expect([DIESE_DATEI, schnitt > 0]).toEqual([DIESE_DATEI, true]);
  return quelle.slice(0, schnitt);
}

/** Der Kopf eines Testfalls — die Kennung davor („B1", „D5", „U8c") ist sein Schlüssel. */
const FALL_KOPF = /\bit\(\s*[`"'](([A-Za-z]+\d+[a-z]?)\s*·)/g;

/** Ein Freigabe-Aufruf, wörtlich mitsamt seinen Argumenten. */
const FREIGABE_RUF = /(?:mit|erteile)KiFreigabe\([^)]*\)/g;

/**
 * Zerlegt einen Bestandsteil lückenlos in seine Testfälle.
 *
 * Was VOR dem ersten Fall steht — Aufbauhelfer, Verdrahtung — heißt `VORSPANN` und wird genauso
 * bewacht: die Ask-Datei setzt ihre Freigabe genau dort, in `verdrahten`.
 */
function faelle(quelle: string): Map<string, string> {
  const koepfe = [...quelle.matchAll(FALL_KOPF)];
  const stuecke = new Map<string, string>();
  stuecke.set("VORSPANN", quelle.slice(0, koepfe[0]?.index ?? quelle.length));
  koepfe.forEach((kopf, i) => {
    // Gruppe 2 ist im Muster nicht optional; das `??` ist die Pflicht des Typs, nicht ein Fall.
    const kennung = kopf[2] ?? "";
    stuecke.set(kennung, quelle.slice(kopf.index ?? 0, koepfe[i + 1]?.index ?? quelle.length));
  });
  return stuecke;
}

/** Die beiden Formen, in denen die Grundfreigabe in diesen drei Dateien überhaupt vorkommt. */
const ZUORDNUNG = (global: string, perTask = "{}"): string =>
  `mitKiFreigabe({ global: ${global}, perTask: ${perTask} })`;
const AM_REASONER = "erteileKiFreigabe(reasoner)";

/** Was über einen einzelnen Testfall festgeschrieben ist. */
interface Fallakte {
  /** Zahl der `expect(` im Fall, Stand Basisstand 15d49dd. BODEN: dazu ja, weg nein. */
  readonly boden: number;
  /** Die erlaubten Freigabe-Aufrufe, wörtlich und VOLLZÄHLIG — mehr ist so rot wie weniger. */
  readonly freigaben: readonly string[];
}

/**
 * DIE FALLAKTE · Fall für Fall, für die drei Dateien, die dieser Auftrag anfasst.
 *
 * Die Zahlen sind ausgezählt aus dem Basisstand 15d49dd (`git show 15d49dd:<datei>`), die Listen
 * aus dem Stand nach dem Einbau der Freigabe. Beides zusammen ist die Zusicherung aus Auftrag §3.3
 * in messbarer Form: keine Erwartung gesenkt, keine Freigabe dazugeschmuggelt.
 */
const FALLAKTEN: Readonly<Record<string, Readonly<Record<string, Fallakte>>>> = {
  [DIESE_DATEI]: {
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
  "tests/openai-cloud-anbieter/cloud-wahl-verbindungstest.test.tsx": {
    VORSPANN: { boden: 0, freigaben: [] },
    V1: { boden: 9, freigaben: [] },
    V2: { boden: 10, freigaben: [AM_REASONER] },
    V3: { boden: 7, freigaben: [ZUORDNUNG('"cloud"')] },
    V4: { boden: 7, freigaben: [] },
    V4b: { boden: 9, freigaben: [] },
  },
  "tests/ask/job2659-ask-seite-mounted.test.tsx": {
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
};

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
    const vonHand = testquellen().filter((p) => {
      const quelle = bestand(p);
      return felder.some((feld) => quelle.includes(feld));
    });
    expect(vonHand).toEqual([]);
    // Der zweite Schalter ist nirgends erteilt — und das ist eine Liste, kein Zufall.
    expect(VERTRAULICH_ERLAUBT).toEqual([]);
  });

  it("F3 · die Sperr-Fälle dieser Datei: genau die Freigabe, die ihnen zusteht — und ihre Null", () => {
    const stuecke = faelle(bestand(DIESE_DATEI));
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
    for (const [datei, akten] of Object.entries(FALLAKTEN)) {
      const stuecke = faelle(bestand(datei));
      // Kein Fall verschwindet und keiner kommt unbemerkt dazu — sonst wäre der Boden zu umgehen,
      // indem man den Fall gleich mitnimmt.
      expect([datei, [...stuecke.keys()].sort()]).toEqual([datei, Object.keys(akten).sort()]);
      for (const [fall, akte] of Object.entries(akten)) {
        const text = (stuecke.get(fall) ?? "").replace(/\s+/g, " ");
        const zahl = (text.match(/expect\(/g) ?? []).length;
        expect([datei, fall, zahl >= akte.boden]).toEqual([datei, fall, true]);
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
});
