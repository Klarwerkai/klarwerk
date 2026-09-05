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
//   Reasoner (wie in `services/app/src/build-app.ts:422-433` verdrahtet) → reasoner.configStatus()
//   (die Quelle der Admin-Sicht, `service.ts:952-977`) → HTTP-Antwort von /api/reasoner/config →
//   gemountete Karte `KiZugaengeDetail` → der Text, den ein Mensch liest.
//
// UND: BEN hat belegt, dass F12 unter M2 GRÜN bleibt (F12 zählt Quelltextmuster und kann die
// Anbieterwahl gar nicht sehen). Die Wahl braucht deshalb einen Nachweis, der unter M2 WIRKLICH
// rot wird — V1 bis V4 sind dieser Nachweis.
//
// PEDIS ENTSCHEIDUNG 25 (05.09., 20:20), hier Fall für Fall geprüft:
//   (1) nur OPENAI_API_KEY (+ REASONER_MODEL) → der Cloud-Client IST OpenAI        → V1
//   (2) beide Schlüssel → OpenAI hat Vorrang, Anthropic bleibt konfigurierbar       → V2
//   (3) die bestehende Admin-Auswahl bleibt; „Cloud/extern" ergibt ChatGPT          → V3
//       die Übersicht nennt Anbieter UND Modell (REASONER_MODEL = gpt-6-astra)      → V4
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
 * DIE VERDRAHTUNG DES PRODUKTS, Zeile für Zeile nachgebaut aus `build-app.ts:422-433`: gecappter
 * Cloud-Client als primary, gecappter lokaler Client als secondary, deterministisch als fallback.
 * Nachgebaut und nicht importiert, weil `assembleServices` die ganze Repo-Landschaft verlangt; die
 * FÜR DIESE FRAGE tragenden vier Zeilen sind vollständig hier.
 */
function reasonerWieImProdukt(env: Record<string, string | undefined>): Reasoner {
  const cappedCloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  const cappedLocal = createCappedLocalClientFromEnv(env);
  return new Reasoner(
    cappedCloud ? new ModelProvider(cappedCloud) : undefined,
    undefined,
    undefined,
    undefined,
    cappedLocal ? new ModelProvider(cappedLocal) : undefined,
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
    // Und was der Admin daraus liest, nennt Anbieter UND Modell.
    expect(aiAccessRows(cfg)[0]).toEqual({
      id: "cloud",
      state: "active",
      detail: `ChatGPT (OpenAI) · ${MODELL}`,
    });
  });

  it("V2 · beide Schlüssel gesetzt: OpenAI hat Vorrang — Anthropic bleibt nachrangig konfigurierbar", async () => {
    const anfragen = fetchSpion();
    const reasoner = reasonerWieImProdukt(BEIDE_ENV);
    const cfg = reasoner.configStatus();
    expect(cfg.provider).toBe(`cloud:openai:${MODELL}`);
    expect(cfg.provider).not.toContain("anthropic");
    // Der Vorrang ist keine Anzeige-Behauptung: der echte Lauf geht wirklich zu OpenAI.
    await reasoner.assistText("Ein roher Satz, der geglättet werden soll.", "de");
    const modellAnfragen = anfragen.filter((a) => !a.url.includes("/api/"));
    expect(modellAnfragen).toHaveLength(1);
    expect(modellAnfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(modellAnfragen[0]?.body.model).toBe(MODELL);
    expect(modellAnfragen[0]?.headers.authorization).toBe("Bearer test-schluessel-nur-hier");
    // Kein zweiter Weg nach draußen: die Anthropic-Kante wird in diesem Lauf gar nicht berührt.
    expect(modellAnfragen.some((a) => a.url.includes("anthropic"))).toBe(false);
  });

  it('V3 · die bestehende Admin-Auswahl bleibt: „Cloud/extern" ergibt ChatGPT', async () => {
    const anfragen = fetchSpion();
    const reasoner = reasonerWieImProdukt(BEIDE_ENV);
    // Die vorhandene Auswahl (KI-Verwaltung v1) wird BENUTZT, nicht ersetzt — kein neuer Schalter.
    await reasoner.setTaskConfig({ global: "cloud", perTask: {} });
    const cfg = reasoner.configStatus();
    expect(cfg.taskConfig.global).toBe("cloud");
    expect(cfg.effectiveProvider.assist).toBe("cloud");
    await reasoner.assistText("Ein roher Satz, der geglättet werden soll.", "de");
    const modellAnfragen = anfragen.filter((a) => !a.url.includes("/api/"));
    expect(modellAnfragen[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    // Die Auswahl selbst ist unangetastet: alle Bestandsoptionen bleiben setzbar.
    await reasoner.setTaskConfig({ global: "deterministic", perTask: { assist: "local" } });
    expect(reasoner.configStatus().taskConfig.perTask.assist).toBe("local");
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
    // Der externe Anbieter steht in der CLOUD-Zeile, nicht in der Zeile des eigenen Servers.
    expect(text).not.toContain(`local:${MODELL}`);
    expect(text).not.toContain("cloud:openai:");
  });

  it("V4b · ohne Cloud-Schlüssel steht auf der Karte kein Anbietername", async () => {
    await i18n.changeLanguage("de");
    const echterStatus = reasonerWieImProdukt({}).configStatus();
    expect(echterStatus.cloudConfigured).toBe(false);
    fetchSpion(echterStatus);
    const container = await karteMounten();
    const text = container.textContent ?? "";
    // Erst der Beleg, dass die Karte überhaupt dasteht — sonst wäre jede „nicht enthalten"-Zusage
    // unten geschenkt (eine leere Fläche enthält nie etwas).
    expect(container.querySelector('[data-testid="detail-ki-zugaenge"]')).toBeTruthy();
    expect(text).toContain(i18n.t("adm.ai.access.cloud"));
    expect(text).not.toContain("OpenAI");
    expect(text).not.toContain("Anthropic");
  });
});
