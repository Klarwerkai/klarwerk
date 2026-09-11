// ================================================================================================
// JOB 3134 · KI-WAHL — NACHWEIS C: DIE WAHL ÜBERLEBT, WIRD MIGRIERT UND NIE STILL VERLOREN.
// ================================================================================================
//
// P03 Lieferumfang 2 und 4: die Wahl überlebt Neuladen, Neuanmeldung und Serverneustart; die alte
// OpenAI-Vorzugsregel greift danach nicht mehr; die abgelösten Werte `cloud`/`model` werden
// NACHVOLLZIEHBAR migriert (gemeldet, nicht still umgedeutet); ein Schreibfehler lässt den alten
// Stand aktiv; die Deploy-ENV sperrt — und sagt, welche Variable.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { createCappedCloudClientFromEnv } from "../../services/reasoner/src/model-client";
import { ModelProvider } from "../../services/reasoner/src/provider-model";
import {
  InMemoryReasonerPolicyRepo,
  type ReasonerPolicyRepo,
} from "../../services/reasoner/src/reasoner-policy";
import { Reasoner, ReasonerPolicyLockedError } from "../../services/reasoner/src/service";
// JOB 3570: die Grundfreigabe im Aufbau — nur in C1 und C1b, den beiden Fällen, die wirklich
// etwas hinausschicken. C2–C7 messen Persistenz, Migration, Schreibfehler und die ENV-Sperre;
// dort ist der Schreibweg selbst der Gegenstand (C3/C4 erwarten seine Ablehnung), eine Freigabe
// wäre dort nicht setzbar und hätte auch nichts zu erlauben.
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";
import type {
  ReasonerTaskConfig,
  ReasonerTaskConfigEingabe,
} from "../../services/reasoner/src/types";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const BEIDE_ENV = {
  OPENAI_API_KEY: "sk-test-openai-nur-hier",
  OPENAI_MODEL: "gpt-4o-mini",
  ANTHROPIC_API_KEY: "ant-test-nur-hier",
  ANTHROPIC_MODEL: "claude-sonnet-4-6",
};
const NUR_ANTHROPIC_ENV = { ANTHROPIC_API_KEY: "ant-test-nur-hier" };
const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

/** Ein Repo, das den Bestand VOR JOB 3134 nachbildet (mit `cloud`/`model`) und Schreibfehler kann. */
class Bestand implements ReasonerPolicyRepo {
  stored: ReasonerTaskConfigEingabe | null = null;
  schreibenScheitert = false;
  schreibvorgaenge = 0;
  async get(): Promise<ReasonerTaskConfig | null> {
    return this.stored as ReasonerTaskConfig | null;
  }
  async set(config: ReasonerTaskConfig): Promise<void> {
    this.schreibvorgaenge += 1;
    if (this.schreibenScheitert) {
      throw new Error("db write down");
    }
    this.stored = { global: config.global, perTask: { ...config.perTask } };
  }
}

/** Eine „Instanz": frischer Reasoner, wie `build-app.ts` ihn verdrahtet, an einem gegebenen Repo. */
function instanz(env: Record<string, string | undefined>, repo: ReasonerPolicyRepo): Reasoner {
  const cappedCloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  return new Reasoner(undefined, undefined, undefined, undefined, undefined, repo, {
    anbieter: {
      ...(cappedCloud.openai ? { openai: new ModelProvider(cappedCloud.openai) } : {}),
      ...(cappedCloud.anthropic ? { anthropic: new ModelProvider(cappedCloud.anthropic) } : {}),
    },
    gruende: cappedCloud.gruende,
  });
}

function fetchSpion(): string[] {
  const urls: string[] = [];
  vi.stubGlobal("fetch", (async (url: unknown) => {
    const pfad = String(url);
    urls.push(pfad);
    return {
      ok: true,
      status: 200,
      json: async () =>
        pfad === OPENAI_URL
          ? { choices: [{ message: { content: "VON-OPENAI" } }] }
          : { content: [{ type: "text", text: "VON-ANTHROPIC" }] },
    } as unknown as Response;
  }) as unknown as typeof fetch);
  return urls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("JOB 3134 C: Persistenz über den Neustart der Instanz", () => {
  it("C1 · Claude gewählt, Instanz neu gebaut: die Wahl gilt weiter, die Anfrage geht an Anthropic — nicht an den Vorgabe-Anbieter OpenAI", async () => {
    // Der Spion steht VOR dem Bau der Instanzen: die Clients binden `fetch` beim Aufbau.
    const urls = fetchSpion();
    const repo = new InMemoryReasonerPolicyRepo();
    const erste = instanz(BEIDE_ENV, repo);
    await erste.setTaskConfig({ global: "anthropic", perTask: { describe: "openai" } });

    // „Neustart": neue Instanz, dasselbe persistente Repo, derselbe Boot-Schritt wie server.ts.
    const zweite = instanz(BEIDE_ENV, repo);
    expect(zweite.configStatus().provider).toBe("cloud:openai:gpt-4o-mini"); // vor dem Laden: Default auto
    const geladen = await zweite.loadPersistedPolicy();
    expect(geladen.source).toBe("persisted");
    const cfg = zweite.configStatus();
    expect(cfg.taskConfig).toEqual({ global: "anthropic", perTask: { describe: "openai" } });
    expect(cfg.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(cfg.persisted).toBe(true);
    expect(cfg.policySource).toBe("db");
    expect(cfg.migration).toBeUndefined();

    // JOB 3570: die Grundfreigabe im Aufbau, NACH dem Laden und unmittelbar vor der einzigen
    // Übertragung dieses Falls. Sie lässt Zuordnung und Migrationsmeldung unangetastet
    // (`erteileKiFreigabe` schreibt `global`/`perTask` unverändert zurück) und ist die
    // Voraussetzung dafür, dass die Anfrage überhaupt an einen Anbieter geht — sonst prüfte
    // `urls` nicht mehr den EMPFÄNGER, sondern nur noch die Sperre.
    await erteileKiFreigabe(zweite);
    await zweite.assistText("nach dem Neustart", "de");
    expect(urls).toEqual([ANTHROPIC_URL]);
  });

  it("C1b · über eine JSON-Zeile wie in Postgres: die zweite Instanz liest TEXT, kein geteiltes Objekt — die Wahl gilt weiter", async () => {
    // bens Prüflücke R2: C1 teilt ein In-Memory-Objekt. Hier hält das Repo nur den serialisierten
    // Text (wie `PgReasonerPolicyRepo`: `JSON.stringify` beim Schreiben, geparst beim Lesen) —
    // die zweite Instanz kann also nichts am Objekt der ersten festhalten.
    const urls = fetchSpion();
    class Zeile implements ReasonerPolicyRepo {
      data: string | null = null;
      async get(): Promise<ReasonerTaskConfig | null> {
        return this.data ? (JSON.parse(this.data) as ReasonerTaskConfig) : null;
      }
      async set(config: ReasonerTaskConfig): Promise<void> {
        this.data = JSON.stringify(config);
      }
    }
    const zeile = new Zeile();
    const erste = instanz(BEIDE_ENV, zeile);
    await erste.setTaskConfig({ global: "anthropic", perTask: { select: "openai" } });
    expect(zeile.data).toBe('{"global":"anthropic","perTask":{"select":"openai"}}');

    const zweite = instanz(BEIDE_ENV, zeile);
    expect((await zweite.loadPersistedPolicy()).source).toBe("persisted");
    const cfg = zweite.configStatus();
    expect(cfg.taskConfig).toEqual({ global: "anthropic", perTask: { select: "openai" } });
    expect(cfg.provider).toBe("anthropic:claude-sonnet-4-6");
    expect(cfg.effectiveAnbieter.select).toBe("openai");
    // Wie in C1: die Grundfreigabe unmittelbar vor der Übertragung, nach allen Aussagen über den
    // gespeicherten TEXT (`zeile.data` oben) — die bleibt davon unberührt.
    await erteileKiFreigabe(zweite);
    await zweite.assistText("nach dem Neustart", "de");
    expect(urls).toEqual([ANTHROPIC_URL]);
  });

  it("C2 · Bestand mit `cloud`/`model`: beim Laden migriert auf den Anbieter der alten Vorzugsregel, GEMELDET, Datenbank unberührt", async () => {
    const repo = new Bestand();
    repo.stored = { global: "cloud", perTask: { answer: "model", assist: "local" } };
    const r = instanz(BEIDE_ENV, repo);
    const geladen = await r.loadPersistedPolicy();
    expect(geladen.source).toBe("persisted");
    // OpenAI ist eingerichtet → dorthin hätte die alte Fabrik geroutet → dorthin wird migriert.
    expect(r.getTaskConfig()).toEqual({
      global: "openai",
      perTask: { answer: "openai", assist: "local" },
    });
    expect(r.configStatus().migration).toEqual({
      global: { von: "cloud", nach: "openai" },
      perTask: { answer: { von: "model", nach: "openai" } },
    });
    // Boot schreibt nie in die DB: der Bestand liegt unverändert, bis Pedi ausdrücklich speichert.
    expect(repo.stored).toEqual({ global: "cloud", perTask: { answer: "model", assist: "local" } });
    expect(repo.schreibvorgaenge).toBe(0);

    // Die ausdrückliche Speicherung schreibt nur noch aktive Werte — und die Meldung verschwindet.
    await r.setTaskConfig({ global: "anthropic", perTask: { assist: "local" } });
    expect(repo.stored).toEqual({ global: "anthropic", perTask: { assist: "local" } });
    expect(r.configStatus().migration).toBeUndefined();
  });

  it("C2b · ohne OpenAI-Schlüssel wandert `cloud` auf Anthropic — die Regel der alten Fabrik, nicht Willkür", async () => {
    const repo = new Bestand();
    repo.stored = { global: "cloud", perTask: {} };
    const r = instanz(NUR_ANTHROPIC_ENV, repo);
    await r.loadPersistedPolicy();
    expect(r.getTaskConfig().global).toBe("anthropic");
    expect(r.configStatus().migration?.global).toEqual({ von: "cloud", nach: "anthropic" });
    expect(r.configStatus().provider).toBe("anthropic:claude-sonnet-4-6");
  });

  it("C3 · Schreibfehler: die alte Wahl bleibt aktiv, der Empfänger wechselt nicht", async () => {
    const urls = fetchSpion();
    const repo = new Bestand();
    const r = instanz(BEIDE_ENV, repo);
    await r.setTaskConfig({ global: "openai", perTask: {} });
    repo.schreibenScheitert = true;
    await expect(r.setTaskConfig({ global: "anthropic", perTask: {} })).rejects.toThrow(
      "db write down",
    );
    expect(r.getTaskConfig().global).toBe("openai");
    expect(r.configStatus().provider).toBe("cloud:openai:gpt-4o-mini");
    await r.assistText("weiter", "de");
    expect(urls).toEqual([OPENAI_URL]);
  });

  it("C4 · ENV-Sperre: KLARWERK_REASONER_POLICY bestimmt, migriert und sperrt — die Sperre nennt die Variable", async () => {
    const repo = new Bestand();
    repo.stored = { global: "anthropic", perTask: {} };
    const r = instanz(BEIDE_ENV, repo);
    const geladen = await r.loadPersistedPolicy({ envGlobal: "cloud" });
    expect(geladen.source).toBe("env");
    // Der Deploy-Wert `cloud` wird wie jeder andere Eingang migriert und gemeldet.
    expect(r.getTaskConfig().global).toBe("openai");
    const cfg = r.configStatus();
    expect(cfg.policySource).toBe("env");
    expect(cfg.persisted).toBe(false);
    expect(cfg.migration?.global).toEqual({ von: "cloud", nach: "openai" });
    // Pedis Wahl ist gesperrt — mit Namen der Variable, nicht still.
    await expect(r.setTaskConfig({ global: "anthropic", perTask: {} })).rejects.toBeInstanceOf(
      ReasonerPolicyLockedError,
    );
    await expect(r.setTaskConfig({ global: "anthropic", perTask: {} })).rejects.toThrow(
      /KLARWERK_REASONER_POLICY/,
    );
    // Der persistierte Stand bleibt, was er war (transient, nicht überschrieben).
    expect(repo.stored).toEqual({ global: "anthropic", perTask: {} });

    // Und ein ausdrücklicher Anbieter in der ENV gilt ebenso — ohne Migration.
    const r2 = instanz(BEIDE_ENV, new Bestand());
    await r2.loadPersistedPolicy({ envGlobal: "anthropic" });
    expect(r2.getTaskConfig().global).toBe("anthropic");
    expect(r2.configStatus().migration).toBeUndefined();
    expect(r2.configStatus().provider).toBe("anthropic:claude-sonnet-4-6");
  });

  it("C5 · Zurücksetzen einer Aufgabe auf „wie global“: der Schlüssel ist weg, andere Abweichungen bleiben", async () => {
    const repo = new Bestand();
    const r = instanz(BEIDE_ENV, repo);
    await r.setTaskConfig({
      global: "openai",
      perTask: { assist: "anthropic", answer: "anthropic" },
    });
    expect(r.configStatus().effectiveAnbieter.assist).toBe("anthropic");
    await r.setTaskConfig({ global: "openai", perTask: { answer: "anthropic" } });
    expect(r.getTaskConfig().perTask).toEqual({ answer: "anthropic" });
    expect(Object.hasOwn(r.getTaskConfig().perTask, "assist")).toBe(false);
    expect(r.configStatus().effectiveAnbieter.assist).toBe("openai");
    expect(r.configStatus().effectiveAnbieter.answer).toBe("anthropic");
    expect(repo.stored).toEqual({ global: "openai", perTask: { answer: "anthropic" } });
  });
});

describe("JOB 3134 C (HTTP): der Schreibweg der Karte", () => {
  async function alsAdmin(app: ReturnType<typeof buildApp>, email: string) {
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email, password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${login.json().token}` };
  }

  it("C6 · PUT mit dem neuen Wert wird gespeichert und von GET zurückgegeben; PUT mit `cloud` wird migriert und gemeldet", async () => {
    const services = buildServices();
    await services.reasoner.loadPersistedPolicy();
    const app = buildApp(services);
    const headers = await alsAdmin(app, "wahl@x.de");

    const put = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers,
      payload: { global: "openai", perTask: { answer: "anthropic" } },
    });
    expect(put.statusCode).toBe(200);
    const body = put.json() as {
      taskConfig: { global: string; perTask: Record<string, string> };
      migration?: unknown;
      cloudProviders: Record<string, { configured: boolean; grund?: string }>;
      policySource: string;
      persisted: boolean;
    };
    expect(body.taskConfig).toEqual({ global: "openai", perTask: { answer: "anthropic" } });
    expect(body.migration).toBeUndefined();
    expect(body.policySource).toBe("db");
    expect(body.persisted).toBe(true);
    // Ohne Schlüssel in der Testumgebung: beide Anbieter ehrlich nicht eingerichtet, mit Grund.
    expect(body.cloudProviders.openai?.configured).toBe(false);
    expect(body.cloudProviders.openai?.grund).toContain("OPENAI_API_KEY");
    expect(JSON.stringify(body)).not.toMatch(/sk-|Bearer /);

    const get = await app.inject({ method: "GET", url: "/api/reasoner/config", headers });
    expect((get.json() as typeof body).taskConfig).toEqual({
      global: "openai",
      perTask: { answer: "anthropic" },
    });

    const alt = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers,
      payload: { global: "cloud", perTask: {} },
    });
    expect(alt.statusCode).toBe(200);
    const altBody = alt.json() as typeof body;
    expect(altBody.taskConfig.global).toBe("anthropic"); // ohne OpenAI-Schlüssel: der Anthropic-Weg
    expect(altBody.migration).toEqual({
      global: { von: "cloud", nach: "anthropic" },
      perTask: {},
    });
  });

  it("C7 · ohne users.manage bleibt der Schreibweg zu", async () => {
    const services = buildServices();
    const app = buildApp(services);
    const put = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      payload: { global: "openai", perTask: {} },
    });
    expect([401, 403]).toContain(put.statusCode);
  });
});
