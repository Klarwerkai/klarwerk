import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

// SCRUM-239: Output-Factory-Workflow über die ECHTEN HTTP-Routen absichern (kein Service-Direktaufruf,
// keine Repo-Manipulation). Quellen via GET /api/output/sources (ko.read, nur validierte KOs),
// Generierung via POST /api/output/generate (ko.read) → Markdown nach Typ + strukturierte Provenance
// in koIds-Reihenfolge. Validierte KOs werden über echte HTTP-Aktionen (create + rate) vorbereitet.
describe("SCRUM-239: Output-Factory-Workflow (HTTP end-to-end)", () => {
  async function login(app: ReturnType<typeof buildApp>, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    // Demo-Seed liefert Carla (controller) als zweiten Validator (needed=2).
    await app.inject({ method: "POST", url: "/api/admin/demo-seed", headers: admin });
    const carla = await login(app, "carla@demo.klarwerk", "demo-pass-carla");
    return { app, admin, carla };
  }

  async function createKo(
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    title: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: "Output",
        measures: ["Schritt 1", "Schritt 2"],
        neededValidations: 2,
      },
    });
    return res.json().id as string;
  }

  const rate = (app: ReturnType<typeof buildApp>, headers: Record<string, string>, id: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

  // KO erstellen und über zwei distinkte Validatoren (Admin + Carla) auf "validiert" bringen.
  async function validatedKo(
    app: ReturnType<typeof buildApp>,
    admin: Record<string, string>,
    carla: Record<string, string>,
    title: string,
  ): Promise<string> {
    const id = await createKo(app, admin, title);
    await rate(app, admin, id);
    await rate(app, carla, id);
    const ko = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: admin });
    expect(ko.json().status).toBe("validiert");
    return id;
  }

  const generate = (
    app: ReturnType<typeof buildApp>,
    headers: Record<string, string>,
    body: Record<string, unknown>,
  ) => app.inject({ method: "POST", url: "/api/output/generate", headers, payload: body });

  it("eligible listet nur validierte KOs; generate erzeugt Markdown + Provenance in koIds-Reihenfolge", async () => {
    const { app, admin, carla } = await setup();
    const koA = await validatedKo(app, admin, carla, "Output Alpha 239");
    const koB = await validatedKo(app, admin, carla, "Output Beta 239");
    const koOpen = await createKo(app, admin, "Output Offen 239"); // bleibt "offen"

    // 1) Eligible-Quellen: enthalten die validierten, NICHT das offene KO.
    const sources = await app.inject({
      method: "GET",
      url: "/api/output/sources",
      headers: admin,
    });
    expect(sources.statusCode).toBe(200);
    const srcIds = sources.json().map((s: { id: string }) => s.id) as string[];
    expect(srcIds).toContain(koA);
    expect(srcIds).toContain(koB);
    expect(srcIds).not.toContain(koOpen);
    expect(sources.json().every((s: { status: string }) => s.status === "validiert")).toBe(true);

    // 2) Generieren mit umgekehrter Reihenfolge [koB, koA] → Provenance respektiert die Reihenfolge.
    const gen = await generate(app, admin, {
      kind: "instruction",
      koIds: [koB, koA],
      audienceRole: "controller",
    });
    expect(gen.statusCode).toBe(200);
    const doc = gen.json();
    expect(doc.kind).toBe("instruction");
    expect(typeof doc.markdown).toBe("string");
    expect(doc.markdown.length).toBeGreaterThan(0);

    // Provenance ist strukturiert, in genau der gewählten Reihenfolge, nur validierte Quellen.
    expect(doc.provenance.map((p: { koId: string }) => p.koId)).toEqual([koB, koA]);
    for (const p of doc.provenance) {
      expect(p.status).toBe("validiert");
      expect(typeof p.validity).toBe("string");
      expect(typeof p.trust).toBe("number");
      expect(typeof p.version).toBe("number");
      expect(typeof p.uncertain).toBe("boolean");
    }

    // Markdown enthält beide Titel und respektiert die Reihenfolge (Beta vor Alpha).
    expect(doc.markdown).toContain("Output Beta 239");
    expect(doc.markdown).toContain("Output Alpha 239");
    expect(doc.markdown.indexOf("Output Beta 239")).toBeLessThan(
      doc.markdown.indexOf("Output Alpha 239"),
    );
  });

  it("weist nicht-validierte, unbekannte, leere und unbekannte-Typ-Eingaben ab", async () => {
    const { app, admin } = await setup();
    const koOpen = await createKo(app, admin, "Output Nur Offen 239");

    // nicht-validiert → NOT_VALIDATED
    expect(
      (await generate(app, admin, { kind: "instruction", koIds: [koOpen] })).statusCode,
    ).toBeGreaterThanOrEqual(400);
    // unbekanntes KO → UNKNOWN_KO
    expect(
      (await generate(app, admin, { kind: "instruction", koIds: ["nope"] })).statusCode,
    ).toBeGreaterThanOrEqual(400);
    // leere Auswahl → NO_SOURCES
    expect(
      (await generate(app, admin, { kind: "instruction", koIds: [] })).statusCode,
    ).toBeGreaterThanOrEqual(400);
    // unbekannter Typ → UNKNOWN_KIND
    expect(
      (await generate(app, admin, { kind: "bogus", koIds: [koOpen] })).statusCode,
    ).toBeGreaterThanOrEqual(400);
  });

  it("Guard: anonym darf weder Quellen lesen noch generieren", async () => {
    const { app } = await setup();
    const sources = await app.inject({ method: "GET", url: "/api/output/sources" });
    expect(sources.statusCode).toBeGreaterThanOrEqual(400);
    const gen = await app.inject({
      method: "POST",
      url: "/api/output/generate",
      payload: { kind: "instruction", koIds: ["x"] },
    });
    expect(gen.statusCode).toBeGreaterThanOrEqual(400);
  });
});
