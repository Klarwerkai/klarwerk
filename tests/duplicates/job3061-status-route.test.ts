// ================================================================================================
// JOB 3061 · H2 — DER STATUSWEG AM SERVER: `POST /api/duplicates/:id/status`
// ================================================================================================
//
// Warum es diese Datei gibt: Der Menüweg „Status setzen" wird in
// `tests/pruefseite/entscheidungswege-mounted.test.tsx` (Block ST) an der gemounteten Fläche
// gemessen — dort ist der Client aber MOCK, der Server kommt nicht vor. Damit wäre der neue
// Endpunkt ein ungetesteter Endpunkt, und das verbietet das Regelwerk ausdrücklich. Hier läuft
// darum die echte App: echte Anmeldung, echte KOs, echter Dienst, echtes Repo.
//
// Gemessen wird nicht nur der glückliche Fall, sondern vor allem das, was die Route ZUSICHERT:
//  · „In Bearbeitung" ist KEIN Abschluss — der Vorgang bleibt entscheidbar.
//  · „Geschlossen" ohne ausdrücklich gewählten Grund gibt es nicht.
//  · Systemische Gründe (`merged`, `participant_deleted`, `superseded`) sind NICHT wählbar —
//    sonst schriebe die Fläche einen Vorgang ins Protokoll, den es nie gab.
//  · Eine abgewiesene Anfrage lässt den Zustand UNBERÜHRT (ein 400 darf nichts halb tun).
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/** Eine App mit einem Admin und EINEM offenen Duplikat-Paar. */
async function setup() {
  const dienste = buildServices();
  const app = buildApp(dienste);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job3061status.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@job3061status.test", "geheim12345");

  const ids: string[] = [];
  for (const titel of ["Alpha", "Beta"]) {
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: titel,
        statement: `${titel} Aussage zum Vorgang.`,
        type: "best_practice",
        category: "Instandhaltung",
        author: "admin@job3061status.test",
      },
    });
    ids.push(ko.json().id as string);
  }
  const eintrag = await dienste.overlaps.createAuto(
    {
      koA: ids[0] as string,
      koB: ids[1] as string,
      relation: "moeglich",
      aspects: [],
      eigenanteilA: "Alpha",
      eigenanteilB: "Beta",
      recommendation: "pruefen",
    } as never,
    "heuristik" as never,
  );
  return { app, admin, id: eintrag.id };
}

const status = (app: App, admin: Auth, id: string, payload: Record<string, unknown>) =>
  app.inject({ method: "POST", url: `/api/duplicates/${id}/status`, headers: admin, payload });

/** Der Zustand, wie ihn ein Leser NACH der Anfrage sieht — nicht der, den die Antwort behauptet. */
async function zustand(app: App, admin: Auth, id: string): Promise<string> {
  const res = await app.inject({ method: "GET", url: `/api/duplicates/${id}`, headers: admin });
  return res.json().status as string;
}

describe("JOB 3061 · H2 · `POST /api/duplicates/:id/status` — der Statusweg am Server", () => {
  it("R1 · „In Bearbeitung“ wird gesetzt — und ist KEIN Abschluss: der Vorgang bleibt entscheidbar", async () => {
    const { app, admin, id } = await setup();
    expect(await zustand(app, admin, id)).toBe("offen");

    const res = await status(app, admin, id, { status: "in_bearbeitung" });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().status).toBe("in_bearbeitung");
    expect(await zustand(app, admin, id)).toBe("in_bearbeitung");

    // Die Zusage aus dem Dienst-Kommentar, gemessen statt geglaubt: der Eintrag bleibt in der
    // offenen Liste und lässt sich danach noch entscheiden.
    const liste = await app.inject({ method: "GET", url: "/api/duplicates", headers: admin });
    expect((liste.json() as { id: string }[]).map((e) => e.id)).toContain(id);
    const danach = await app.inject({
      method: "POST",
      url: `/api/duplicates/${id}/keep-separate`,
      headers: admin,
      payload: {},
    });
    expect(danach.statusCode, `nach „In Bearbeitung" nicht mehr entscheidbar: ${danach.body}`).toBe(
      200,
    );
    await app.close();
  });

  it("R2 · zweimal „In Bearbeitung“ ist kein Fehler und ändert nichts", async () => {
    const { app, admin, id } = await setup();
    expect((await status(app, admin, id, { status: "in_bearbeitung" })).statusCode).toBe(200);
    const zweite = await status(app, admin, id, { status: "in_bearbeitung" });
    expect(zweite.statusCode, zweite.body).toBe(200);
    expect(zweite.json().status).toBe("in_bearbeitung");
    await app.close();
  });

  it("R3 · „Geschlossen“ mit gewähltem Grund schliesst mit GENAU diesem Grund und dem Vermerk", async () => {
    const { app, admin, id } = await setup();
    const res = await status(app, admin, id, {
      status: "geschlossen",
      reason: "linked_related",
      note: "Beide Fassungen bleiben.",
    });
    expect(res.statusCode, res.body).toBe(200);
    const eintrag = res.json();
    expect(eintrag.status).toBe("geschlossen");
    expect(eintrag.resolution.reason).toBe("linked_related");
    expect(eintrag.resolution.note).toBe("Beide Fassungen bleiben.");
    expect(await zustand(app, admin, id)).toBe("geschlossen");
    await app.close();
  });

  it("R4 · ein leerer Vermerk wird NICHT als Vermerk gespeichert", async () => {
    const { app, admin, id } = await setup();
    const res = await status(app, admin, id, {
      status: "geschlossen",
      reason: "dismissed",
      note: "   ",
    });
    expect(res.statusCode, res.body).toBe(200);
    // Nicht der Leerstring, sondern „kein Vermerk" — sonst stünde im Protokoll ein Grund, der aus
    // einem versehentlich fokussierten Feld stammt.
    expect(res.json().resolution.note ?? null).toBeNull();
    await app.close();
  });

  it("R5 · „Geschlossen“ OHNE Grund wird abgewiesen — und lässt den Zustand unberührt", async () => {
    const { app, admin, id } = await setup();
    for (const rumpf of [
      { status: "geschlossen" },
      { status: "geschlossen", reason: "" },
      { status: "geschlossen", reason: "irgendwas" },
    ]) {
      const res = await status(app, admin, id, rumpf);
      expect(res.statusCode, `Abschluss ohne wählbaren Grund ging durch: ${res.body}`).toBe(400);
      expect(res.json().error).toBe("INVALID_STATUS");
    }
    expect(await zustand(app, admin, id), "ein 400 hat den Vorgang trotzdem angefasst").toBe(
      "offen",
    );
    await app.close();
  });

  it("R6 · systemische Abschlussgründe sind NICHT wählbar", async () => {
    const { app, admin, id } = await setup();
    // Diese drei gehören dem Assistenten bzw. den Integritäts-Routinen. Kämen sie hier durch,
    // behauptete das Protokoll einen Vorgang, den es nicht gab.
    for (const reason of ["merged", "participant_deleted", "superseded"]) {
      const res = await status(app, admin, id, { status: "geschlossen", reason });
      expect(res.statusCode, `„${reason}" war von aussen wählbar: ${res.body}`).toBe(400);
      expect(res.json().error).toBe("INVALID_STATUS");
    }
    expect(await zustand(app, admin, id)).toBe("offen");
    await app.close();
  });

  it("R7 · ein nicht setzbarer Zielzustand wird abgewiesen — auch das Zurückdrehen auf „offen“", async () => {
    const { app, admin, id } = await setup();
    for (const rumpf of [{}, { status: "offen" }, { status: "erledigt" }]) {
      const res = await status(app, admin, id, rumpf);
      expect(res.statusCode, `Zielzustand ${JSON.stringify(rumpf)} ging durch: ${res.body}`).toBe(
        400,
      );
      expect(res.json().error).toBe("INVALID_STATUS");
    }
    expect(await zustand(app, admin, id)).toBe("offen");
    await app.close();
  });

  it("R8 · auf einem geschlossenen Vorgang setzt der Weg nichts mehr", async () => {
    const { app, admin, id } = await setup();
    expect(
      (await status(app, admin, id, { status: "geschlossen", reason: "kept_separate" })).statusCode,
    ).toBe(200);
    for (const rumpf of [
      { status: "in_bearbeitung" },
      { status: "geschlossen", reason: "dismissed" },
    ]) {
      const res = await status(app, admin, id, rumpf);
      expect(
        res.statusCode,
        `ein geschlossener Vorgang liess sich erneut setzen: ${res.body}`,
      ).toBe(400);
      expect(res.json().error).toBe("ALREADY_CLOSED");
    }
    // Und der Abschlussgrund von vorhin steht unverändert.
    const nachher = await app.inject({
      method: "GET",
      url: `/api/duplicates/${id}`,
      headers: admin,
    });
    expect(nachher.json().resolution.reason).toBe("kept_separate");
    await app.close();
  });
});
