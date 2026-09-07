// @vitest-environment jsdom
// ================================================================================================
// JOB 3090 · RUNDE 2 — DER VERBINDUNGSTEST: VON DER ENV BIS ZUM TEXT AUF DEM BILDSCHIRM.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BEN, Runde 1, Prüflücke 6 und Promptverbesserung): Die Fälle F1–F12
// prüfen die Fabrik und die Anzeige-Funktion JE FÜR SICH. F8 füttert `aiAccessRows` mit einer
// LITERALEN Konfiguration — es beweist, dass die Funktion aus `cloud:openai:x` den richtigen Text
// macht, aber NICHT, dass jemals ein `cloud:openai:x` aus der echten Verdrahtung dort ankommt.
// Genau diese Naht wird hier gemessen, in einem Stück:
//
//   Env (OPENAI_API_KEY, REASONER_MODEL) → createCappedCloudClientFromEnv → ModelProvider →
//   Reasoner (wie in `services/app/src/build-app.ts` verdrahtet) → reasoner.configStatus()
//   (die Quelle der Admin-Sicht) → HTTP-Antwort von /api/reasoner/config →
//   gemountete Karte `KiZugaengeDetail` → der Text, den ein Mensch liest.
//
// JOB 3134 (KI-WAHL): Pedis Entscheidung 25 (OpenAI hat Vorrang) ist durch Entscheidung 42 ersetzt —
// beide Anbieter sind hinterlegt, und PEDI WÄHLT. Was hier bleibt: (1) nur OPENAI_API_KEY → ChatGPT
// ist der Anbieter hinter „auto"; (2) beide Schlüssel → „auto" nimmt weiterhin OpenAI als Vorgabe,
// Anthropic ist als EIGENER Wert eingerichtet und wählbar; (3) der abgelöste Wert `cloud` wird
// migriert und gemeldet; (4) die Karte nennt Anbieter und Modell. Die Wahl selbst und ihre
// Empfänger misst `tests/ki-anbieterwahl`.
//
// HERMETIK: kein Netz, kein echter Schlüssel. EIN `fetch`-Spion bedient beide Welten und
// unterscheidet sie am Pfad — Modell-API (`json()`) und Web-API (`text()`).
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import i18n from "../../apps/web/src/i18n";
import { aiAccessRows } from "../../apps/web/src/lib/aiOverview";
import { KiZugaengeDetail } from "../../apps/web/src/pages/AdminKiDetails";
import { ModelProvider, Reasoner } from "../../services/reasoner";
// SCRUM-502 R8: die Umgebungsfabriken sind bewusst nicht aus dem Paket-Index exportiert.
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Pedi setzt dieses Modell (Entscheidung 25). Es steht hier bewusst wörtlich: der Test prüft, dass
// die Fläche NENNT, was in der Umgebung steht — nicht einen im Code gepflegten Modellnamen.
const MODELL = "gpt-6-astra";
const OPENAI_ENV = { OPENAI_API_KEY: "test-schluessel-nur-hier", REASONER_MODEL: MODELL };
const BEIDE_ENV = { ...OPENAI_ENV, ANTHROPIC_API_KEY: "test-schluessel-anthropic" };

const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

interface Anfrage {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

/**
 * DIE VERDRAHTUNG DES PRODUKTS, Zeile für Zeile nachgebaut aus `build-app.ts`: beide gecappten
 * Cloud-Clients unter ihrem Namen (`cloud`), gecappter lokaler Client als secondary, deterministisch
 * als fallback. Nachgebaut und nicht importiert, weil `assembleServices` die ganze Repo-Landschaft
 * verlangt; die FÜR DIESE FRAGE tragenden Zeilen sind vollständig hier.
 */
function reasonerWieImProdukt(env: Record<string, string | undefined>): Reasoner {
  const cappedCloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  const cappedLocal = createCappedLocalClientFromEnv(env);
  return new Reasoner(
    undefined,
    undefined,
    undefined,
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
}

/** EIN Spion für beide Welten: Modell-API (json) und Web-API (text). Unterschieden am Pfad. */
function fetchSpion(konfigAntwort?: unknown): Anfrage[] {
  const anfragen: Anfrage[] = [];
  vi.stubGlobal("fetch", (async (url: unknown, init: unknown) => {
    const pfad = String(url);
    const opts = (init ?? {}) as { headers?: Record<string, string>; body?: string };
    anfragen.push({
      url: pfad,
      headers: opts.headers ?? {},
      body: opts.body ? (JSON.parse(opts.body) as Record<string, unknown>) : {},
    });
    if (pfad.includes("/api/reasoner/config")) {
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify(konfigAntwort ?? {}),
      } as unknown as Response;
    }
    // Antwortformen beider Modell-APIs; die jeweils fremde Form wird schlicht ignoriert.
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        choices: [{ message: { content: "OK" } }],
        content: [{ type: "text", text: "OK" }],
      }),
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return anfragen;
}

const durchlaufen = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const gemountet: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(() => {
  for (const { root, container } of gemountet.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function karteMounten(): Promise<HTMLDivElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  gemountet.push({ root, container });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(KiZugaengeDetail, { onZurueck: () => {} }),
      ),
    );
    await durchlaufen();
  });
  await act(durchlaufen);
  return container;
}

describe("JOB 3090 V1–V4: die Anbieterwahl, von der Env bis auf den Bildschirm", () => {
  it("V1 · nur OPENAI_API_KEY gesetzt: die echte Verdrahtung meldet ChatGPT als Cloud-KI", () => {
    const cfg = reasonerWieImProdukt(OPENAI_ENV).configStatus();
    expect(cfg.cloudConfigured).toBe(true);
    expect(cfg.provider).toBe(`cloud:openai:${MODELL}`);
    expect(cfg.model).toBe(`cloud:openai:${MODELL}`);
    expect(cfg.mode).toBe("model");
    // Ohne lokalen LLM bleibt die zweite Kante ehrlich leer — hier wird nichts umgestellt.
    expect(cfg.localConfigured).toBe(false);
    // JOB 3134: der zweite Anbieter ist ehrlich „nicht eingerichtet", mit Grund.
    expect(cfg.cloudProviders.anthropic.configured).toBe(false);
    expect(cfg.cloudProviders.anthropic.grund).toContain("ANTHROPIC_API_KEY");
    // Und was der Admin daraus liest, nennt Anbieter UND Modell — in der Zeile des Anbieters.
    expect(aiAccessRows(cfg)[0]).toEqual({
      id: "openai",
      state: "active",
      detail: `ChatGPT (OpenAI) · ${MODELL}`,
    });
    expect(aiAccessRows(cfg)[1]?.state).toBe("missing");
  });

  it("V2 · beide Schlüssel gesetzt: „auto“ nimmt OpenAI als Vorgabe — Anthropic ist eingerichtet und WÄHLBAR", async () => {
    const anfragen = fetchSpion();
    const reasoner = reasonerWieImProdukt(BEIDE_ENV);
    const cfg = reasoner.configStatus();
    expect(cfg.taskConfig.global).toBe("auto");
    expect(cfg.autoAnbieter).toBe("openai");
    expect(cfg.provider).toBe(`cloud:openai:${MODELL}`);
    expect(cfg.provider).not.toContain("anthropic");
    // JOB 3134: der zweite Anbieter ist nicht „nachrangig", sondern eingerichtet — mit eigenem,
    // gültigem Modell (nie das OpenAI-Modell aus REASONER_MODEL).
    expect(cfg.cloudProviders.anthropic).toEqual({
      configured: true,
      name: "anthropic:claude-sonnet-4-6",
      model: "claude-sonnet-4-6",
    });
    // Die Vorgabe ist keine Anzeige-Behauptung: der echte Lauf geht wirklich zu OpenAI.
    await reasoner.assistText("Ein roher Satz, der geglättet werden soll.", "de");
    const modellAnfragen = anfragen.filter((a) => !a.url.includes("/api/"));
    expect(modellAnfragen).toHaveLength(1);
    expect(modellAnfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(modellAnfragen[0]?.body.model).toBe(MODELL);
    expect(modellAnfragen[0]?.headers.authorization).toBe("Bearer test-schluessel-nur-hier");
    // Kein zweiter Weg nach draußen: die Anthropic-Kante wird in diesem Lauf gar nicht berührt.
    expect(modellAnfragen.some((a) => a.url.includes("anthropic"))).toBe(false);
  });

  it("V3 · der abgelöste Wert „cloud“ wird auf ChatGPT migriert und gemeldet; die Anbieter sind eigene Werte", async () => {
    const anfragen = fetchSpion();
    const reasoner = reasonerWieImProdukt(BEIDE_ENV);
    // Ein alter Schreibweg mit `cloud` landet nicht still: er wird migriert UND gemeldet.
    await reasoner.setTaskConfig({ global: "cloud", perTask: {} });
    const cfg = reasoner.configStatus();
    expect(cfg.taskConfig.global).toBe("openai");
    expect(cfg.migration).toEqual({ global: { von: "cloud", nach: "openai" }, perTask: {} });
    expect(cfg.effectiveProvider.assist).toBe("cloud");
    expect(cfg.effectiveAnbieter.assist).toBe("openai");
    await reasoner.assistText("Ein roher Satz, der geglättet werden soll.", "de");
    const modellAnfragen = anfragen.filter((a) => !a.url.includes("/api/"));
    expect(modellAnfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    // Alle Bestandsoptionen bleiben setzbar — und der Anbieter ist jetzt ein eigener Wert.
    await reasoner.setTaskConfig({ global: "deterministic", perTask: { assist: "anthropic" } });
    expect(reasoner.configStatus().taskConfig.perTask.assist).toBe("anthropic");
    expect(reasoner.configStatus().migration).toBeUndefined();
  });

  it('V4 · die gemountete Admin-Karte zeigt „ChatGPT (OpenAI) · gpt-6-astra"', async () => {
    await i18n.changeLanguage("de");
    // Die HTTP-Antwort ist NICHT erfunden: sie ist der configStatus der echten Verdrahtung.
    const echterStatus = reasonerWieImProdukt(OPENAI_ENV).configStatus();
    fetchSpion(echterStatus);
    const container = await karteMounten();
    const text = container.textContent ?? "";
    expect(container.querySelector('[data-testid="detail-ki-zugaenge"]')).toBeTruthy();
    expect(text, "die Karte nennt den Anbieter nicht").toContain("ChatGPT (OpenAI)");
    expect(text, "die Karte nennt das Modell aus REASONER_MODEL nicht").toContain(MODELL);
    // Der externe Anbieter steht in SEINER Zeile, nicht in der Zeile des eigenen Servers.
    expect(text).not.toContain(`local:${MODELL}`);
    expect(text).not.toContain("cloud:openai:");
    // JOB 3134: die zweite Anbieterzeile sagt, was fehlt — ohne Modell, ohne Schlüssel.
    expect(text).toContain("ANTHROPIC_API_KEY");
    expect(text).not.toContain("test-schluessel");
  });

  it("V4b · ohne Cloud-Schlüssel steht auf der Karte kein Modell — beide Anbieter „nicht konfiguriert“ mit Grund", async () => {
    await i18n.changeLanguage("de");
    const echterStatus = reasonerWieImProdukt({}).configStatus();
    expect(echterStatus.cloudConfigured).toBe(false);
    fetchSpion(echterStatus);
    const container = await karteMounten();
    const text = container.textContent ?? "";
    // Erst der Beleg, dass die Karte überhaupt dasteht — sonst wäre jede „nicht enthalten"-Zusage
    // unten geschenkt (eine leere Fläche enthält nie etwas).
    expect(container.querySelector('[data-testid="detail-ki-zugaenge"]')).toBeTruthy();
    expect(text).toContain(i18n.t("adm.ai.access.openai"));
    expect(text).toContain(i18n.t("adm.ai.access.anthropic"));
    const zustaende = [...container.querySelectorAll("li")].map(
      (li) => li.querySelector(".ml-auto")?.textContent ?? "",
    );
    expect(zustaende.slice(0, 2)).toEqual([
      i18n.t("adm.ai.state.missing"),
      i18n.t("adm.ai.state.missing"),
    ]);
    expect(text).toContain("OPENAI_API_KEY");
    expect(text).toContain("ANTHROPIC_API_KEY");
    // Kein Modellname, den es nicht gibt.
    expect(text).not.toContain("gpt-");
    expect(text).not.toContain("claude-");
  });
});
