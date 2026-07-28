import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { projectModelRunForReader } from "../../services/app/src/routes/model-runs-routes";
import {
  InMemoryModelRunRepo,
  MAX_MODEL_RUN_CONTEXT_ID_LENGTH,
  type ModelRunRecord,
  ModelRunService,
  sanitizeModelRunContext,
} from "../../services/model-runs";
import { DeterministicProvider, Reasoner } from "../../services/reasoner";

// AUFTRAG-mega26 Block A — DER BELEG DES LAUFKONTEXTS.
//
// Was bewiesen wird:
//  1. Ein ECHTER Lauf über den GEBUNDENEN Aufrufer (POST /api/reasoner, task="extract") schreibt
//     einen Datensatz, der aus dem BESTAND gelesen den Actor UND den Subjektbezug trägt.
//  2. GEGENPROBE: derselbe Server, derselbe Nutzer, dasselbe KO — aber ein NICHT gebundener
//     Aufrufer (task="structure") schreibt einen Datensatz OHNE diese Felder, und das Lesen
//     bricht daran nicht.
//  3. Der Kontext trägt NIE Inhalt (weder Dokumenttext noch Antwort) und erfindet keinen Bezug.
//
// HERMETIK: der Reasoner dieses Tests hat KEINEN Modell-Provider — nur den deterministischen
// Ersatzmodus. Es gibt damit keinen Modellaufruf, keinen Egress und keine Abhängigkeit von einem
// Schlüsselbund. `runTask` protokolliert trotzdem (demo=true) — genau das ist der Weg, der geprüft wird.
describe("mega26 Block A: Laufkontext des Modelllaufs (wer/woran)", () => {
  const DOKUMENT =
    "Vor jeder Wartung ist der Hauptschalter zu verriegeln. Anschliessend den Restdruck " +
    "am Manometer ablesen und im Protokoll festhalten. Erst danach darf geoeffnet werden.";

  type Umgebung = Awaited<ReturnType<typeof umgebung>>;

  async function umgebung() {
    const services = buildServices();
    // EIN Repo für Schreiber (Reasoner) und Leser (ModelRunService) — so liest der Test wirklich
    // den Bestand und nicht ein Zwischenergebnis.
    const repo = new InMemoryModelRunRepo();
    const mutable = services as unknown as { reasoner: Reasoner; modelRuns: ModelRunService };
    mutable.reasoner = new Reasoner(undefined, new DeterministicProvider(), repo);
    mutable.modelRuns = new ModelRunService({ repo });
    const app = buildApp(services);

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const adminId = adminLogin.json().user.id as string;
    const admin = { authorization: `Bearer ${adminLogin.json().token}` };

    // Zweiter Nutzer OHNE ko.validate (Rolle "experte") — für die Lesefreigabe-Prüfung.
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: "Ex", email: "ex@x.de", password: "secret123", role: "experte" },
    });
    const exLogin = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ex@x.de", password: "secret123" },
    });
    const experte = { authorization: `Bearer ${exLogin.json().token}` };

    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Wartung Hauptschalter",
        statement: "Vor der Wartung verriegeln.",
        type: "best_practice",
        category: "Anlage 2",
        neededValidations: 1,
      },
    });
    return { app, repo, services, admin, adminId, experte, koId: ko.json().id as string };
  }

  async function laufe(
    { app, admin }: Pick<Umgebung, "app" | "admin">,
    payload: Record<string, unknown>,
  ) {
    const res = await app.inject({ method: "POST", url: "/api/reasoner", headers: admin, payload });
    expect(res.statusCode).toBe(200);
    return res;
  }

  // Liest den Datensatz AUS DEM BESTAND (über den Lese-Service, nicht über den Schreiber).
  async function laufZu(env: Umgebung, task: string): Promise<ModelRunRecord> {
    const runs = await env.services.modelRuns.recent(200);
    const treffer = runs.filter((r) => r.task === task);
    expect(treffer).toHaveLength(1);
    return treffer[0] as ModelRunRecord;
  }

  it("gebundener Aufrufer (extract): Datensatz trägt Actor UND Subjektbezug", async () => {
    const env = await umgebung();
    await laufe(env, {
      task: "extract",
      text: DOKUMENT,
      source: "transient-document",
      confidentiality: "intern",
      koId: env.koId,
    });

    const run = await laufZu(env, "extract");
    expect(run.actor).toBe(env.adminId);
    expect(run.subject).toEqual({ kind: "ko", id: env.koId });
    // Der Lauf lief wirklich deterministisch — kein Modell, kein Egress.
    expect(run.demo).toBe(true);
    expect(run.status).toBe("success");
  });

  it("GEGENPROBE — ungebundener Aufrufer (structure): Datensatz OHNE die Felder, Lesen bricht nicht", async () => {
    const env = await umgebung();
    // Identische Vorbedingungen: derselbe angemeldete Nutzer, dasselbe existierende KO.
    await laufe(env, {
      task: "structure",
      text: DOKUMENT,
      source: "draft",
      confidentiality: "intern",
      koId: env.koId,
    });

    const run = await laufZu(env, "structure");
    expect(run.actor).toBeUndefined();
    expect(run.subject).toBeUndefined();
    // Die Felder fehlen wirklich (nicht nur undefined) — Altdatensätze sehen genauso aus.
    expect(Object.hasOwn(run, "actor")).toBe(false);
    expect(Object.hasOwn(run, "subject")).toBe(false);

    // Und das Lesen über die echte Route bricht an dem feldlosen Datensatz nicht.
    const gelesen = await env.app.inject({
      method: "GET",
      url: "/api/model-runs",
      headers: env.admin,
    });
    expect(gelesen.statusCode).toBe(200);
    expect(gelesen.json()).toHaveLength(1);
    expect(gelesen.json()[0].task).toBe("structure");
  });

  it("beide Wege nebeneinander: nur der gebundene trägt den Kontext", async () => {
    const env = await umgebung();
    const gemeinsam = { source: "draft", confidentiality: "intern", koId: env.koId } as const;
    await laufe(env, { task: "extract", text: DOKUMENT, ...gemeinsam });
    await laufe(env, { task: "assist", text: DOKUMENT, ...gemeinsam });

    expect((await laufZu(env, "extract")).actor).toBe(env.adminId);
    expect((await laufZu(env, "assist")).actor).toBeUndefined();
    expect((await laufZu(env, "assist")).subject).toBeUndefined();
  });

  it("unbekannte koId erfindet KEINEN Subjektbezug (Actor bleibt)", async () => {
    const env = await umgebung();
    await laufe(env, {
      task: "extract",
      text: DOKUMENT,
      source: "transient-document",
      confidentiality: "intern",
      koId: "diese-kennung-gibt-es-nicht",
    });

    const run = await laufZu(env, "extract");
    expect(run.actor).toBe(env.adminId);
    expect(run.subject).toBeUndefined();
  });

  it("der Kontext trägt KEINEN Inhalt — weder Dokumenttext noch Suchauftrag", async () => {
    const env = await umgebung();
    await laufe(env, {
      task: "extract",
      text: DOKUMENT,
      query: "Welche Schritte vor dem Oeffnen?",
      source: "transient-document",
      confidentiality: "intern",
      koId: env.koId,
    });

    const roh = JSON.stringify(await env.services.modelRuns.recent(200));
    expect(roh).not.toContain("Hauptschalter");
    expect(roh).not.toContain("Manometer");
    expect(roh).not.toContain("Welche Schritte");
  });

  // Die Lesefreigabe: der Bezug „wer hat woran gerechnet" ist eine Audit-Aussage und wird auf der
  // Stufe ausgeliefert, die auch /api/audit regelt (ko.validate) — nicht auf der breiten ko.read-Stufe.
  it("Lesefreigabe: ko.validate sieht den Kontext, reines ko.read nicht — Grundfelder unverändert", async () => {
    const env = await umgebung();
    await laufe(env, {
      task: "extract",
      text: DOKUMENT,
      source: "transient-document",
      confidentiality: "intern",
      koId: env.koId,
    });

    const alsAdmin = await env.app.inject({
      method: "GET",
      url: "/api/model-runs",
      headers: env.admin,
    });
    expect(alsAdmin.json()[0].actor).toBe(env.adminId);
    expect(alsAdmin.json()[0].subject).toEqual({ kind: "ko", id: env.koId });

    const alsExperte = await env.app.inject({
      method: "GET",
      url: "/api/model-runs",
      headers: env.experte,
    });
    expect(alsExperte.statusCode).toBe(200);
    const sicht = alsExperte.json()[0];
    expect(sicht.actor).toBeUndefined();
    expect(sicht.subject).toBeUndefined();
    // Alles, was es vor mega26 gab, ist unverändert da.
    expect(sicht.task).toBe("extract");
    expect(sicht.provider).toBe(alsAdmin.json()[0].provider);
    expect(sicht.status).toBe("success");
    expect(sicht.id).toBe(alsAdmin.json()[0].id);
  });
});

describe("mega26 Block A: projectModelRunForReader (reine Projektion)", () => {
  const RECORD: ModelRunRecord = {
    id: "r1",
    task: "extract",
    provider: "deterministic",
    demo: true,
    fallback: false,
    startedAt: "2026-07-26T10:00:00.000Z",
    finishedAt: "2026-07-26T10:00:00.100Z",
    status: "success",
    actor: "u-1",
    subject: { kind: "ko", id: "ko-1" },
  };

  it("mit Freigabe unverändert, ohne Freigabe ohne Kontextfelder", () => {
    expect(projectModelRunForReader(RECORD, true)).toEqual(RECORD);
    const ohne = projectModelRunForReader(RECORD, false);
    expect(Object.hasOwn(ohne, "actor")).toBe(false);
    expect(Object.hasOwn(ohne, "subject")).toBe(false);
    expect(ohne.id).toBe("r1");
    expect(ohne.provider).toBe("deterministic");
  });

  it("ein kontextloser Altdatensatz bleibt in beiden Sichten identisch", () => {
    const alt: ModelRunRecord = { ...RECORD };
    delete alt.actor;
    delete alt.subject;
    expect(projectModelRunForReader(alt, true)).toEqual(alt);
    expect(projectModelRunForReader(alt, false)).toEqual(alt);
  });
});

// Die Struktursperre gegen Inhalt: was keine Kennung ist, erreicht das Protokoll nicht.
describe("mega26 Block A: sanitizeModelRunContext", () => {
  it("ohne Kontext → leer", () => {
    expect(sanitizeModelRunContext()).toEqual({});
    expect(sanitizeModelRunContext({})).toEqual({});
  });

  it("übernimmt getrimmte Kennungen", () => {
    expect(
      sanitizeModelRunContext({ actor: "  u-1  ", subject: { kind: "ko", id: " ko-1 " } }),
    ).toEqual({ actor: "u-1", subject: { kind: "ko", id: "ko-1" } });
  });

  it("leere/nur-Leerraum-Kennungen fallen weg (kein leeres Feld im Datensatz)", () => {
    expect(sanitizeModelRunContext({ actor: "   ", subject: { kind: "ko", id: "" } })).toEqual({});
  });

  it("überlange Werte werden VERWORFEN, nicht gekürzt — eine gekürzte Kennung wäre eine falsche", () => {
    const inhalt = "A".repeat(MAX_MODEL_RUN_CONTEXT_ID_LENGTH + 1);
    const ergebnis = sanitizeModelRunContext({
      actor: inhalt,
      subject: { kind: "ko", id: inhalt },
    });
    expect(ergebnis).toEqual({});
    expect(JSON.stringify(ergebnis)).not.toContain("AAA");
  });

  it("genau an der Grenze bleibt gültig", () => {
    const gerade = "B".repeat(MAX_MODEL_RUN_CONTEXT_ID_LENGTH);
    expect(sanitizeModelRunContext({ actor: gerade }).actor).toBe(gerade);
  });

  it("ein Subjekt ohne bekannte Art fällt weg (nur 'ko' hat einen Erzeuger)", () => {
    const fremd = { kind: "dokument", id: "x" } as unknown as { kind: "ko"; id: string };
    expect(sanitizeModelRunContext({ actor: "u-1", subject: fremd })).toEqual({ actor: "u-1" });
  });
});
