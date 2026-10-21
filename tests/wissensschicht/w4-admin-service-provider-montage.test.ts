// W4: neue heutige Admin-/Service-/Provider-Montage. Keine Wiederholung des alten 9er-Kerns.
// Nur Testdefinitionen: reale App-/Dienst-/Providerlogik, fiktive Modellclients und InMemory-Repos.
// Kein PG-, Provider-, Modellwechsel-, Word-, Browser- oder Betriebsnachweis.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  InMemoryVerhaltensartefaktRepo,
  type KnowledgeRef,
  type ModelClient,
  type ModelProvider,
  type VerhaltensQuelle,
  type Verhaltensartefakt,
} from "../../services/reasoner";

const montage = vi.hoisted(() => ({
  provider: [] as { quelle: VerhaltensQuelle | undefined; provider: ModelProvider }[],
  aufrufe: [] as {
    name: string;
    system: string;
    user: string;
    confidential: boolean;
    maxTokens: number | undefined;
  }[],
}));

// Nur die zwei vorhandenen Fabrikports werden durch fiktive Clients ersetzt. Der echte
// ModelProvider wird lediglich beim Konstruktor erfasst; keine seiner Methoden wird ersetzt.
vi.mock("../../services/reasoner", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../services/reasoner")>();
  function client(name: string, extern: boolean): ModelClient {
    return {
      name,
      model: "w4-fiktiv",
      rejectsConfidential: extern,
      complete: async (system, user, confidential, maxTokens) => {
        montage.aufrufe.push({ name, system, user, confidential, maxTokens });
        return "Fiktiven W4-Absperrhahn schließen [1].";
      },
    };
  }
  class ErfassterProvider extends original.ModelProvider {
    constructor(modell?: ModelClient, quelle?: VerhaltensQuelle) {
      super(modell, quelle);
      montage.provider.push({ quelle, provider: this });
    }
  }
  return {
    ...original,
    ModelProvider: ErfassterProvider,
    createCappedLocalClientFromEnv: () => client("local:w4-fiktiv", false),
    createCappedCloudClientFromEnv: () => ({
      openai: client("cloud:openai:w4-fiktiv", true),
      anthropic: client("anthropic:w4-fiktiv", true),
      gruende: {},
    }),
  };
});

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };
const apps: App[] = [];
const URL = "/api/reasoner/verhaltensartefakte";
const REGEL = "Fiktive W4-Montageregel: Einheit ausdrücklich nennen.";
const KONTEXT: KnowledgeRef[] = [
  {
    id: "w4-fiktiver-beleg",
    title: "Fiktiven W4-Absperrhahn schließen",
    statement: "Fiktiven W4-Absperrhahn schließen.",
    status: "validiert",
    trust: 90,
  },
];

beforeEach(() => {
  vi.stubEnv("KLARWERK_SKIP_KEYCHAIN", "1");
  vi.stubEnv("EXTERNAL_SEARCH", "off");
  vi.stubEnv("KLARWERK_DEV_PERSIST", "0");
});
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  montage.provider.length = 0;
  montage.aufrufe.length = 0;
  vi.unstubAllEnvs();
});

class MontageAblage extends InMemoryVerhaltensartefaktRepo {
  naechsterPkKonflikt = false;

  override async lege(artefakt: Verhaltensartefakt): Promise<void> {
    if (this.naechsterPkKonflikt) {
      this.naechsterPkKonflikt = false;
      throw Object.assign(new Error("Fiktives internes SQL-Detail"), { code: "23505" });
    }
    await super.lege(artefakt);
  }
}

async function anmelden(app: App, email: string): Promise<Auth> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "w4-fiktiv12345" },
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return { authorization: `Bearer ${antwort.json().token}` };
}

async function instanz(ablage = new MontageAblage()) {
  const services = assembleServices(inMemoryRepos(), { verhaltensartefakte: ablage });
  const app = buildApp(services);
  apps.push(app);
  const neu = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "W4 Admin", email: "admin@w4.test", password: "w4-fiktiv12345" },
  });
  expect(neu.statusCode, neu.body).toBe(201);
  const admin = await anmelden(app, "admin@w4.test");
  const leser = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "W4 Leser",
      email: "leser@w4.test",
      password: "w4-fiktiv12345",
      role: "viewer",
    },
  });
  expect(leser.statusCode, leser.body).toBe(201);
  const viewer = await anmelden(app, "leser@w4.test");
  return { app, services, ablage, admin, viewer, adminId: neu.json().id as string };
}

type Instanz = Awaited<ReturnType<typeof instanz>>;

function schreiben(f: Instanz, body: unknown, auth = f.admin) {
  return f.app.inject({
    method: "POST",
    url: URL,
    headers: { ...auth, "content-type": "application/json" },
    payload: JSON.stringify(body) ?? "null",
  });
}

function providerVon(f: Instanz): ModelProvider[] {
  return montage.provider
    .filter((p) => p.quelle === f.services.verhalten)
    .map((p) => p.provider);
}

describe("W4 · heutige Ports sind erhaltend verbunden", () => {
  it("die reguläre Adminquelle erreicht alle drei wirklich zusammengesetzten Provider", async () => {
    const f = await instanz();
    const policyVorher = f.services.reasoner.getTaskConfig();
    const anlage = await schreiben(f, {
      aufgabe: "answer",
      art: "leitplanke",
      inhalt: REGEL,
      status: "freigegeben",
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    expect(anlage.json().angelegtVon).toBe(f.adminId);
    expect(f.services.reasoner.getTaskConfig()).toEqual(policyVorher);
    expect(montage.aufrufe).toHaveLength(0);
    const modelle = providerVon(f);
    expect(modelle).toHaveLength(3);
    for (const [index, locale] of (["de", "en", "nl"] as const).entries()) {
      const modell = modelle[index];
      if (!modell) throw new Error("Zusammengesetzter W4-Provider fehlt");
      const antwort = await modell.answer("Fiktiver W4-Absperrhahn", KONTEXT, locale);
      expect(antwort.answered).toBe(true);
    }
    expect(montage.aufrufe.map((a) => a.name)).toEqual([
      "local:w4-fiktiv",
      "cloud:openai:w4-fiktiv",
      "anthropic:w4-fiktiv",
    ]);
    for (const aufruf of montage.aufrufe) expect(aufruf.system).toContain(REGEL);
    // Derselbe injizierte Bestand, neue App-/Dienstinstanz; kein PG-/Prozessneustartbeleg.
    const erneut = await instanz(f.ablage);
    expect(providerVon(erneut)).toHaveLength(3);
    const verlauf = await erneut.app.inject({ method: "GET", url: URL, headers: erneut.admin });
    expect(verlauf.statusCode, verlauf.body).toBe(200);
    expect(verlauf.json().verlauf).toEqual([anlage.json()]);
  });

  it("aktuelle Adminrechte, Bodytypen und PK-Konfliktantwort lassen Bestand und KI-Rechte stehen", async () => {
    const f = await instanz();
    const body = { aufgabe: "answer", art: "leitplanke", inhalt: REGEL };
    const policyVorher = f.services.reasoner.getTaskConfig();
    const fremdLesen = await f.app.inject({ method: "GET", url: URL, headers: f.viewer });
    expect(fremdLesen.statusCode).toBe(403);
    const fremdSchreiben = await schreiben(f, body, f.viewer);
    expect(fremdSchreiben.statusCode).toBe(403);
    for (const ungueltig of [
      [],
      { ...body, schluessel: 7 },
      { ...body, inhalt: null },
      { ...body, herkunftsfall: [] },
    ]) {
      const abgelehnt = await schreiben(f, ungueltig);
      expect(abgelehnt.statusCode, abgelehnt.body).toBe(400);
    }
    const anlage = await schreiben(f, body);
    expect(anlage.statusCode, anlage.body).toBe(201);
    const vorher = await f.ablage.alle();
    f.ablage.naechsterPkKonflikt = true;
    const kollidiert = await schreiben(f, {
      schluessel: anlage.json().schluessel,
      status: "freigegeben",
    });
    expect(kollidiert.statusCode, kollidiert.body).toBe(409);
    expect(kollidiert.json().error).toBe("VERHALTEN_KONFLIKT");
    expect(kollidiert.body).not.toContain("SQL-Detail");
    expect(await f.ablage.alle()).toEqual(vorher);
    expect(f.services.reasoner.getTaskConfig()).toEqual(policyVorher);
    expect(montage.aufrufe).toHaveLength(0);
  });

  it("der neue Assistanschluss erhält heutige Guidance, Locale, Budget und Vertraulichkeitsbit", async () => {
    const f = await instanz();
    const modell = providerVon(f)[0];
    if (!modell) throw new Error("Zusammengesetzter lokaler W4-Provider fehlt");
    const text = "Fiktiver unveränderter Assisttext.";
    const guidance = "Behalte alle fiktiven Fachbegriffe bei.";
    await modell.assistText(text, "nl", guidance, true);
    const vorher = montage.aufrufe[0];
    if (!vorher) throw new Error("Erster Assistaufruf fehlt");
    const anlage = await schreiben(f, {
      aufgabe: "assist",
      art: "kontrakt",
      inhalt: REGEL,
      status: "freigegeben",
    });
    expect(anlage.statusCode, anlage.body).toBe(201);
    await modell.assistText(text, "nl", guidance, true);
    const nachher = montage.aufrufe[1];
    if (!nachher) throw new Error("Zweiter Assistaufruf fehlt");
    expect(nachher.system.startsWith(`${vorher.system}\n\n`)).toBe(true);
    expect(nachher.system).toContain("Aanvullende bindende regels van deze instantie:");
    expect(nachher.system).toContain(REGEL);
    expect(vorher.system).toContain(guidance);
    expect(nachher.user).toBe(vorher.user);
    expect(nachher.confidential).toBe(true);
    expect(nachher.maxTokens).toBe(vorher.maxTokens);
    expect(nachher.maxTokens).toBeGreaterThan(0);
  });
});
