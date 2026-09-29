// R-0794 (deploy-health-commit, Ben-Befund B8): „Eine feste Adresse meldet, ob die Anwendung läuft,
// welcher KI-Modus aktiv ist und wie die letzten KI-Läufe verliefen. Sie nennt zusätzlich Version und
// Auslieferungsstand, damit man weiß, welcher Stand wirklich läuft."
//
// Die feste Adresse ist /health. Geprüft wird an der echten Komposition (`buildServices()`), nicht an
// einer Nachbildung: ein KI-Lauf über den regulären Weg `POST /api/reasoner` muss danach in /health
// stehen — sonst schreibt der Reasoner in ein anderes Protokoll, als /health liest.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { HEALTH_KI_LAEUFE_ANZAHL, letzteKiLaeufe } from "../../services/app/src/health-ki-laeufe";
import type { ModelRunRecord } from "../../services/model-runs";

type App = ReturnType<typeof buildApp>;
const offen: App[] = [];

afterEach(async () => {
  await Promise.all(offen.splice(0).map((app) => app.close()));
});

function neueApp(): App {
  const app = buildApp(buildServices());
  offen.push(app);
  return app;
}

async function anmelden(app: App): Promise<Record<string, string>> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${login.json().token}` };
}

async function health(app: App) {
  const res = await app.inject({ method: "GET", url: "/health" });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown> & {
    ai: Record<string, unknown>;
    aiRuns: { available: boolean; recent: Record<string, unknown>[] };
  };
}

describe("R-0794 · eine Adresse, alle fünf Angaben", () => {
  it("/health nennt Laufzustand, Version, Auslieferungsstand, KI-Modus und letzte KI-Läufe", async () => {
    const body = await health(neueApp());
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
    expect(typeof body.commit).toBe("string");
    expect(["cloud", "local", "deterministic"]).toContain(body.ai.mode);
    expect(typeof body.ai.active).toBe("boolean");
    expect(body.aiRuns.available).toBe(true);
    expect(Array.isArray(body.aiRuns.recent)).toBe(true);
  });

  it("der KI-Zustand ist derselbe wie auf /api/ai-status — keine zweite Wahrheit", async () => {
    const app = neueApp();
    const status = (await app.inject({ method: "GET", url: "/api/ai-status" })).json() as {
      ai: unknown;
    };
    expect((await health(app)).ai).toEqual(status.ai);
  });

  it("ohne Anmeldung lesbar — Überwachung von außen braucht kein Konto", async () => {
    const res = await neueApp().inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });
});

describe("R-0794 · die letzten KI-Läufe kommen aus dem echten Laufprotokoll", () => {
  it("ein regulärer KI-Lauf erscheint danach in /health", async () => {
    const app = neueApp();
    const kopf = await anmelden(app);
    expect((await health(app)).aiRuns.recent).toHaveLength(0);

    const lauf = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: kopf,
      payload: {
        task: "extract",
        text: "Vor jeder Wartung ist der Hauptschalter zu verriegeln. Danach Restdruck ablesen.",
        source: "transient-document",
        confidentiality: "intern",
      },
    });
    expect(lauf.statusCode, lauf.body).toBe(200);

    const { recent } = (await health(app)).aiRuns;
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      task: "extract",
      status: "success",
      mode: "deterministic",
      fallback: false,
    });
    expect(Number.isNaN(Date.parse(String(recent[0]?.finishedAt)))).toBe(false);
  });

  it("öffentlich nur abstrahiert: kein Anbieter, Modell, Fehlertext, Nutzer oder Gegenstand", async () => {
    const app = neueApp();
    const kopf = await anmelden(app);
    await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: kopf,
      payload: {
        task: "extract",
        text: "Vor jeder Wartung ist der Hauptschalter zu verriegeln.",
        source: "transient-document",
        confidentiality: "intern",
      },
    });
    const { recent } = (await health(app)).aiRuns;
    expect(recent.length).toBeGreaterThan(0);
    for (const lauf of recent) {
      expect(Object.keys(lauf).sort()).toEqual([
        "fallback",
        "finishedAt",
        "mode",
        "status",
        "task",
      ]);
    }
  });
});

function lauf(i: number, teil: Partial<ModelRunRecord> = {}): ModelRunRecord {
  const zeit = new Date(Date.UTC(2026, 8, 29, 6, 0, i)).toISOString();
  return {
    id: `run-${i}`,
    task: "answer",
    provider: "anbieter-geheim",
    model: "modell-geheim",
    demo: false,
    fallback: false,
    startedAt: zeit,
    finishedAt: zeit,
    status: "success",
    actor: "nutzer-1",
    subject: { kind: "ko", id: "ko-1" },
    ...teil,
  };
}

describe("R-0794 · Teilauskunft ist begrenzt und macht /health nie krank", () => {
  it("fragt genau die festgelegte Anzahl jüngster Läufe ab und bildet Modus/Ausgang ab", async () => {
    let gefragt = -1;
    const ergebnis = await letzteKiLaeufe({
      recent: async (limit?: number) => {
        gefragt = limit ?? -1;
        return [lauf(2, { demo: true, fallback: true, status: "error", error: "x" }), lauf(1)];
      },
    });
    expect(gefragt).toBe(HEALTH_KI_LAEUFE_ANZAHL);
    expect(ergebnis).toEqual({
      available: true,
      recent: [
        {
          task: "answer",
          status: "error",
          mode: "deterministic",
          fallback: true,
          finishedAt: lauf(2).finishedAt,
        },
        {
          task: "answer",
          status: "success",
          mode: "model",
          fallback: false,
          finishedAt: lauf(1).finishedAt,
        },
      ],
    });
    expect(JSON.stringify(ergebnis)).not.toMatch(/geheim|nutzer-1|ko-1/);
  });

  it("fehlerndes Laufprotokoll → available:false, keine Ausnahme", async () => {
    const ergebnis = await letzteKiLaeufe({
      recent: () => Promise.reject(new Error("Datenbank weg")),
    });
    expect(ergebnis).toEqual({ available: false, recent: [] });
  });

  it("hängendes Laufprotokoll → available:false nach der Frist, nicht erst beim Healthcheck-Timeout", async () => {
    const start = Date.now();
    const ergebnis = await letzteKiLaeufe({ recent: () => new Promise(() => {}) }, 50);
    expect(ergebnis).toEqual({ available: false, recent: [] });
    expect(Date.now() - start).toBeLessThan(1000);
  });

  it("/health bleibt 200 und status ok, wenn das Laufprotokoll ausfällt", async () => {
    const services = buildServices();
    (services as unknown as { modelRuns: { recent: () => Promise<never> } }).modelRuns = {
      recent: () => Promise.reject(new Error("Datenbank weg")),
    };
    const app = buildApp(services);
    offen.push(app);
    const body = await health(app);
    expect(body.status).toBe("ok");
    expect(body.aiRuns).toEqual({ available: false, recent: [] });
  });
});
