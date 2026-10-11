// ================================================================================================
// AUFNAHME gesamt-peer-validierung · package:pruefablauf — DER VORSCHLAGSWEG AM SERVER.
// ================================================================================================
//
// Ben, Nacharbeit 3, drei belegte Lücken am Vorschlagsweg (JOB 3667):
//   · keine BENANNTE Prüfperson am Vorschlag            → S1–S3
//   · keine nachvollziehbare RÜCKFRAGE erreichbar         → S4–S6
//   · der EINREICHER sieht Entscheidung und Begründung    → S7 (Leseweg; die Fläche: mounted-Test)
//
// GEMESSEN AN DER ECHTEN ROUTE: echtes Login, echte Rollen über `POST /api/users`, echter PUT.
// Die bestehenden Freigaberechte und die Selbstfreigabesperre bleiben dabei unverändert
// (`tests/word-rueckweg/route-accountregel.test.ts` hält sie fest).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

interface Vorschlag {
  id: string;
  author: string;
  status: string;
  pruefer?: string;
  rueckfragen?: { von: string; at: string; text: string }[];
  decidedBy?: string;
  note?: string;
  resultVersion?: number;
}

interface Stand {
  version: number;
  status: string;
  statement: string;
  proposals?: Vorschlag[];
}

async function anmelden(app: App, email: string): Promise<Kopf> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function konto(
  app: App,
  admin: Kopf,
  rolle: string,
  email: string,
): Promise<{ kopf: Kopf; id: string }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${email}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { kopf: await anmelden(app, email), id: (angelegt.json() as { id: string }).id };
}

async function buehne() {
  const app = buildApp(buildServices());
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@pa.test", password: "secret123" },
  });
  const adminId = (erst.json() as { id: string }).id;
  const admin = await anmelden(app, "pedi@pa.test");
  const experte = await konto(app, admin, "experte", "eva@pa.test");
  const controller = await konto(app, admin, "controller", "carl@pa.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const koId = (angelegt.json() as { id: string }).id;
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: admin,
    payload: { action: "admin-validate" },
  });
  expect(frei.statusCode).toBe(200);
  return { app, admin, adminId, experte, controller, koId };
}

function put(app: App, headers: Kopf, id: string, payload: Record<string, unknown>) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

async function stand(app: App, headers: Kopf, id: string): Promise<Stand> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

function einreichen(app: App, headers: Kopf, id: string, baseVersion: number, pruefer?: string) {
  return put(app, headers, id, {
    action: "propose",
    proposal: {
      statement: "Ventil X zusätzlich verplomben.",
      baseVersion,
      origin: "klarwerk_web",
      ...(pruefer === undefined ? {} : { pruefer }),
    },
  });
}

describe("package:pruefablauf · die benannte Prüfperson", () => {
  it("S1 · der Experte gibt seine Änderung einer benannten Person mit Freigaberecht", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    const res = await einreichen(b.app, b.experte.kopf, b.koId, vorher.version, b.adminId);
    expect(res.statusCode, res.body).toBe(200);

    const danach = await stand(b.app, b.experte.kopf, b.koId);
    const v = danach.proposals?.at(-1);
    expect(v?.pruefer).toBe(b.adminId);
    expect(v?.status).toBe("offen");
    // Der geprüfte Bestand bleibt, wie er war.
    expect(danach.version).toBe(vorher.version);
    expect(danach.statement).toBe(vorher.statement);
    expect(danach.status).toBe("validiert");
  });

  it("S2 · eine Person OHNE Freigaberecht wird abgewiesen — eingereicht wird nichts", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    const res = await einreichen(b.app, b.experte.kopf, b.koId, vorher.version, b.controller.id);
    expect(res.statusCode).toBe(400);
    expect((await stand(b.app, b.admin, b.koId)).proposals ?? []).toHaveLength(0);
  });

  it("S3 · sich selbst benennen geht nicht (PROPOSAL_OWN); ohne Benennung bleibt der Weg wie bisher", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    const selbst = await einreichen(b.app, b.experte.kopf, b.koId, vorher.version, b.experte.id);
    expect(selbst.statusCode).toBeGreaterThanOrEqual(400);
    expect((selbst.json() as { error: string }).error).toBe("PROPOSAL_OWN");
    expect((await stand(b.app, b.admin, b.koId)).proposals ?? []).toHaveLength(0);

    const ohne = await einreichen(b.app, b.experte.kopf, b.koId, vorher.version);
    expect(ohne.statusCode).toBe(200);
    expect((await stand(b.app, b.admin, b.koId)).proposals?.[0]?.pruefer).toBeUndefined();
  });
});

describe("package:pruefablauf · die Rückfrage", () => {
  it("S4 · ohne Text keine Rückfrage (400) — mit Text bleibt der Vorschlag offen, der Bestand unverändert", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    await einreichen(b.app, b.experte.kopf, b.koId, vorher.version, b.adminId);
    const id = (await stand(b.app, b.admin, b.koId)).proposals?.[0]?.id ?? "";

    const leer = await put(b.app, b.admin, b.koId, {
      action: "decide-proposal",
      proposalId: id,
      decision: "rueckfrage",
      expectedVersion: vorher.version,
    });
    expect(leer.statusCode).toBe(400);

    const frage = await put(b.app, b.admin, b.koId, {
      action: "decide-proposal",
      proposalId: id,
      decision: "rueckfrage",
      note: "Gilt die Verplombung auch für Ventil Y?",
      expectedVersion: vorher.version,
    });
    expect(frage.statusCode, frage.body).toBe(200);

    const danach = await stand(b.app, b.experte.kopf, b.koId);
    const v = danach.proposals?.[0];
    expect(v?.status).toBe("offen");
    expect(v?.rueckfragen).toHaveLength(1);
    expect(v?.rueckfragen?.[0]).toMatchObject({
      von: b.adminId,
      text: "Gilt die Verplombung auch für Ventil Y?",
    });
    expect(Number.isNaN(Date.parse(v?.rueckfragen?.[0]?.at ?? ""))).toBe(false);
    expect(danach.version).toBe(vorher.version);
    expect(danach.statement).toBe(vorher.statement);
    expect(danach.status).toBe("validiert");
  });

  it("S5 · nach der Rückfrage ist der Vorschlag weiter entscheidbar — die Rückfrage bleibt erhalten", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    await einreichen(b.app, b.experte.kopf, b.koId, vorher.version, b.adminId);
    const id = (await stand(b.app, b.admin, b.koId)).proposals?.[0]?.id ?? "";
    await put(b.app, b.admin, b.koId, {
      action: "decide-proposal",
      proposalId: id,
      decision: "rueckfrage",
      note: "Bitte Quelle nennen.",
      expectedVersion: vorher.version,
    });
    const genommen = await put(b.app, b.admin, b.koId, {
      action: "decide-proposal",
      proposalId: id,
      decision: "uebernehmen",
      expectedVersion: vorher.version,
    });
    expect(genommen.statusCode, genommen.body).toBe(200);
    const danach = await stand(b.app, b.experte.kopf, b.koId);
    const v = danach.proposals?.[0];
    expect(v?.status).toBe("uebernommen");
    expect(v?.rueckfragen?.[0]?.text).toBe("Bitte Quelle nennen.");
    // Erst die Freigabe aktualisiert den geprüften Bestand.
    expect(danach.statement).toBe("Ventil X zusätzlich verplomben.");
    expect(danach.version).toBe(vorher.version + 1);
  });

  it("S6 · ohne Freigaberecht keine Rückfrage, am eigenen Vorschlag auch nicht", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    await einreichen(b.app, b.experte.kopf, b.koId, vorher.version);
    const id = (await stand(b.app, b.admin, b.koId)).proposals?.[0]?.id ?? "";
    const anfrage = {
      action: "decide-proposal",
      proposalId: id,
      decision: "rueckfrage",
      note: "Warum?",
      expectedVersion: vorher.version,
    };
    expect((await put(b.app, b.controller.kopf, b.koId, anfrage)).statusCode).toBe(403);
    expect((await put(b.app, b.experte.kopf, b.koId, anfrage)).statusCode).toBe(403);
    expect((await stand(b.app, b.admin, b.koId)).proposals?.[0]?.rueckfragen).toBeUndefined();

    // Am eigenen Vorschlag: ein Admin, der selbst einreicht, fragt sich nicht selbst.
    await put(b.app, b.admin, b.koId, {
      action: "propose",
      proposal: { statement: "Eigene Änderung.", baseVersion: vorher.version },
    });
    const eigenId = (await stand(b.app, b.admin, b.koId)).proposals?.[1]?.id ?? "";
    const eigen = await put(b.app, b.admin, b.koId, { ...anfrage, proposalId: eigenId });
    expect((eigen.json() as { error: string }).error).toBe("PROPOSAL_OWN");
  });
});

describe("package:pruefablauf · was der Einreicher liest", () => {
  it("S7 · nach der Ablehnung liest der Einreicher Status, Entscheider und Begründung", async () => {
    const b = await buehne();
    const vorher = await stand(b.app, b.admin, b.koId);
    await einreichen(b.app, b.experte.kopf, b.koId, vorher.version, b.adminId);
    const id = (await stand(b.app, b.admin, b.koId)).proposals?.[0]?.id ?? "";
    const ab = await put(b.app, b.admin, b.koId, {
      action: "decide-proposal",
      proposalId: id,
      decision: "ablehnen",
      note: "Widerspricht der Betriebsanweisung 4.",
      expectedVersion: vorher.version,
    });
    expect(ab.statusCode).toBe(200);
    const v = (await stand(b.app, b.experte.kopf, b.koId)).proposals?.[0];
    expect(v).toMatchObject({
      status: "abgelehnt",
      decidedBy: b.adminId,
      note: "Widerspricht der Betriebsanweisung 4.",
      pruefer: b.adminId,
    });
  });
});
