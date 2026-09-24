// ================================================================================================
// WORD-RÜCKWEG · ENTSCHEIDUNG 3 (Pedi 11.09.): DIE DIREKTE FREIGABE ERTEILT NUR EIN ADMINISTRATOR.
// ================================================================================================
//
// `revise-release` überarbeitet UND gibt frei, in einem Vorgang. Diesen Zweig darf nur die Rolle
// `admin` nehmen; `controller` und `experte` bekommen 403 `PROPOSAL_REQUIRED` — derselbe
// verständliche Fehlerweg wie am `revise`-Zweig — mit dem Verweis auf den Vorschlagsweg (`propose`).
//
//   K1  admin gelingt wie bisher (Version, Freigabe, Historie); controller/experte → 403 mit Grund
//       und Verweis, und am Objekt ändert sich NICHTS.
//   K2  `revise`, `propose` und `decide-proposal` bleiben für die bisherigen Rollen unverändert.
//   K3  die Rechtematrix ist unverändert — geprüft wird an der Route, nicht über ein neues Recht.
//
// GEMESSEN WIRD AN DER ECHTEN ROUTE: echtes Login, echte Rollen über `POST /api/users`, echter PUT.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ROLE_PERMISSIONS } from "../../services/rbac/src/policy";

type App = ReturnType<typeof buildApp>;
type Antwort = Awaited<ReturnType<App["inject"]>>;
type Kopf = Record<string, string>;

const ABWEISUNG_DIREKTFREIGABE =
  'Direkt freigeben darf nur ein Administrator. Die Änderung wurde nicht gespeichert. Bitte reichen Sie sie als Vorschlag ein (action "propose"); sie gilt erst nach der Freigabe durch jemand anderen.';

interface Stand {
  version: number;
  status: string;
  statement: string;
  proposals?: { id: string; status: string; author: string }[];
}

async function flaeche(): Promise<{ app: App; admin: Kopf }> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  return { app, admin: { authorization: `Bearer ${(login.json() as { token: string }).token}` } };
}

async function konto(app: App, admin: Kopf, rolle: string, email: string): Promise<Kopf> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: `Konto ${rolle}`, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  expect((angelegt.json() as { role: string }).role).toBe(rolle);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function anlegen(app: App, headers: Kopf): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

async function freigegebenesObjekt(app: App, admin: Kopf): Promise<string> {
  const id = await anlegen(app, admin);
  const frei = await put(app, admin, id, { action: "admin-validate" });
  expect(frei.statusCode).toBe(200);
  return id;
}

function put(
  app: App,
  headers: Kopf,
  id: string,
  payload: Record<string, unknown>,
): Promise<Antwort> {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}

async function stand(app: App, headers: Kopf, id: string): Promise<Stand> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
}

async function historie(app: App, headers: Kopf, id: string): Promise<{ version: number }[]> {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}/versions`, headers });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as { version: number }[];
}

describe("Entscheidung 3 · K1: `revise-release` gelingt nur der Rolle admin", () => {
  it("admin: Version, Freigabe und Historie wie bisher", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const vorher = await historie(app, admin, id);

    const direkt = await put(app, admin, id, {
      action: "revise-release",
      changes: { statement: "Direkt abgelegt und freigegeben." },
      expectedVersion: 1,
    });
    expect(direkt.statusCode).toBe(200);
    const nachher = direkt.json() as { version: number; status: string; trust: number };
    expect(nachher.version).toBe(2);
    expect(nachher.status).toBe("validiert");
    expect(nachher.trust).toBe(99);

    const jetzt = await stand(app, admin, id);
    expect(jetzt.statement).toBe("Direkt abgelegt und freigegeben.");
    expect(jetzt.status).toBe("validiert");
    const danach = await historie(app, admin, id);
    expect(danach.length).toBe(vorher.length + 1);
  });

  it("ein zweiter admin darf es ebenso — die Rolle entscheidet, nicht das Konto", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const zweiter = await konto(app, admin, "admin", "admin2@klarwerk.test");

    const direkt = await put(app, zweiter, id, {
      action: "revise-release",
      changes: { statement: "Vom zweiten Admin freigegeben." },
    });
    expect(direkt.statusCode).toBe(200);
    expect((direkt.json() as { status: string }).status).toBe("validiert");
  });

  for (const rolle of ["controller", "experte"] as const) {
    it(`${rolle}: 403 mit verständlichem Grund und Verweis auf den Vorschlagsweg — am Objekt ändert sich nichts`, async () => {
      const { app, admin } = await flaeche();
      const id = await freigegebenesObjekt(app, admin);
      const kopf = await konto(app, admin, rolle, `${rolle}@klarwerk.test`);
      const vorher = await historie(app, admin, id);

      const versuch = await put(app, kopf, id, {
        action: "revise-release",
        changes: { statement: "Selbst freigegeben." },
        expectedVersion: 1,
      });
      expect(versuch.statusCode).toBe(403);
      const koerper = versuch.json() as { error: string; message: string };
      expect(koerper.error).toBe("PROPOSAL_REQUIRED");
      // Der Wortlaut ist gepinnt: er nennt den Grund, sagt wahrheitsgemäss, dass nichts
      // gespeichert wurde, und FORDERT zur Einreichung auf — er behauptet keine, die nicht stattfindet.
      expect(koerper.message).toBe(ABWEISUNG_DIREKTFREIGABE);
      expect(koerper.message).not.toMatch(/wird .*eingereicht|wurde .*eingereicht/);

      const jetzt = await stand(app, admin, id);
      expect(jetzt.version).toBe(1);
      expect(jetzt.status).toBe("validiert");
      expect(jetzt.statement).toBe("Bei Überdruck Ventil X manuell schließen.");
      expect(await historie(app, admin, id)).toHaveLength(vorher.length);
      // Die Abweisung reicht NICHTS ersatzweise ein: die Vorschlagsliste bleibt leer.
      expect(jetzt.proposals ?? []).toHaveLength(0);
    });

    it(`${rolle}: auch an einem NICHT freigegebenen Objekt gibt es keine Direktfreigabe`, async () => {
      const { app, admin } = await flaeche();
      const id = await anlegen(app, admin);
      const kopf = await konto(app, admin, rolle, `${rolle}@klarwerk.test`);

      const versuch = await put(app, kopf, id, {
        action: "revise-release",
        changes: { statement: "Selbst freigegeben." },
      });
      expect(versuch.statusCode).toBe(403);
      expect((versuch.json() as { error: string }).error).toBe("PROPOSAL_REQUIRED");
      expect((versuch.json() as { message: string }).message).toBe(ABWEISUNG_DIREKTFREIGABE);
      const jetzt = await stand(app, admin, id);
      expect(jetzt.version).toBe(1);
      expect(jetzt.status).not.toBe("validiert");
      expect(jetzt.proposals ?? []).toHaveLength(0);
    });
  }

  it("ohne Anmeldung bleibt es beim 401", async () => {
    const { app, admin } = await flaeche();
    const id = await freigegebenesObjekt(app, admin);
    const versuch = await put(app, {}, id, {
      action: "revise-release",
      changes: { statement: "Anonym." },
    });
    expect(versuch.statusCode).toBe(401);
  });
});

describe("Entscheidung 3 · K2: Vorschlag, Zweitprüfung und `revise` bleiben wie bisher", () => {
  for (const rolle of ["controller", "experte"] as const) {
    it(`${rolle}: der Vorschlagsweg steht offen, und ein admin übernimmt ihn`, async () => {
      const { app, admin } = await flaeche();
      const id = await freigegebenesObjekt(app, admin);
      const kopf = await konto(app, admin, rolle, `${rolle}@klarwerk.test`);

      const eingereicht = await put(app, kopf, id, {
        action: "propose",
        proposal: { statement: "So müsste es heißen.", baseVersion: 1, origin: "word_addin" },
      });
      expect(eingereicht.statusCode).toBe(200);
      const vorschlag = (await stand(app, admin, id)).proposals?.[0];
      expect(vorschlag?.status).toBe("offen");

      const entschieden = await put(app, admin, id, {
        action: "decide-proposal",
        proposalId: vorschlag?.id,
        decision: "uebernehmen",
      });
      expect(entschieden.statusCode).toBe(200);
      const jetzt = await stand(app, admin, id);
      expect(jetzt.version).toBe(2);
      expect(jetzt.status).toBe("validiert");
      expect(jetzt.statement).toBe("So müsste es heißen.");
    });

    it(`${rolle}: \`decide-proposal\` bleibt ihm wie bisher verwehrt (users.manage)`, async () => {
      const { app, admin } = await flaeche();
      const id = await freigegebenesObjekt(app, admin);
      const kopf = await konto(app, admin, rolle, `${rolle}@klarwerk.test`);
      await put(app, admin, id, {
        action: "propose",
        proposal: { statement: "Vorschlag des Admins.", baseVersion: 1 },
      });
      const vorschlag = (await stand(app, admin, id)).proposals?.[0];

      const versuch = await put(app, kopf, id, {
        action: "decide-proposal",
        proposalId: vorschlag?.id,
        decision: "uebernehmen",
      });
      expect(versuch.statusCode).toBe(403);
      expect((versuch.json() as { error: string }).error).toBe("FORBIDDEN");
    });

    it(`${rolle}: \`revise\` an einem nicht freigegebenen Objekt gelingt wie bisher`, async () => {
      const { app, admin } = await flaeche();
      const id = await anlegen(app, admin);
      const kopf = await konto(app, admin, rolle, `${rolle}@klarwerk.test`);

      const revidiert = await put(app, kopf, id, {
        action: "revise",
        changes: { statement: "Fortgeschrieben." },
      });
      expect(revidiert.statusCode).toBe(200);
      expect((revidiert.json() as { version: number }).version).toBe(2);
    });

    it(`${rolle}: \`revise\` an einem freigegebenen Objekt bleibt 403 PROPOSAL_REQUIRED`, async () => {
      const { app, admin } = await flaeche();
      const id = await freigegebenesObjekt(app, admin);
      const kopf = await konto(app, admin, rolle, `${rolle}@klarwerk.test`);

      const versuch = await put(app, kopf, id, {
        action: "revise",
        changes: { statement: "Direkt ersetzt." },
      });
      expect(versuch.statusCode).toBe(403);
      expect((versuch.json() as { error: string }).error).toBe("PROPOSAL_REQUIRED");
    });
  }
});

describe("Entscheidung 3 · K3: keine Änderung an der Rechtematrix", () => {
  it("die Rechte der vier Rollen stehen wie zuvor", () => {
    expect(ROLE_PERMISSIONS).toEqual({
      viewer: ["ko.read"],
      experte: ["ko.read", "ko.create"],
      controller: [
        "ko.read",
        "ko.create",
        "ko.validate",
        "ko.assign",
        "ko.relate",
        "conflict.resolve",
      ],
      admin: [
        "ko.read",
        "ko.create",
        "ko.validate",
        "ko.assign",
        "ko.relate",
        "conflict.resolve",
        "users.manage",
      ],
    });
  });
});
