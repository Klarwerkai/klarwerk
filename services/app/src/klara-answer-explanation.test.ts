// ================================================================================================
// W3-C (JOB 541 D3) — DIE ERKLAERROUTE AM ECHTEN DRAHT.
// ================================================================================================
//
// Gemessen wird ueber `app.inject()`: kein Port, kein Netz, aber der VOLLE Weg — Anmeldung,
// Wache, Route, Dienst, Belegspeicher. Ein Dienst-Test allein koennte nicht zeigen, dass die
// Route verdrahtet ist und ihre Wache traegt; genau das war der offene Punkt aus D2.
//
// DIE FUENF ZUSTAENDE des Vertrags stehen hier einzeln:
//   OK · NOT_FOUND (unbekannt) · NOT_FOUND (fremd) · NO_SNAPSHOT · REDACTED
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "./build-app";

const PASS = "secret123";

async function admin(app: ReturnType<typeof buildApp>, email = "anna541@x.de") {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email, password: PASS },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASS },
  });
  if (login.statusCode !== 200) {
    throw new Error(`Anmeldung fehlgeschlagen: ${login.statusCode} ${login.body}`);
  }
  return { authorization: `Bearer ${login.json().token}` };
}

async function zweiterNutzer(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  email: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: auth,
    payload: { name: email, email, password: PASS, role: "experte" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASS },
  });
  return { authorization: `Bearer ${login.json().token}` };
}

/** Legt ein belegfaehiges Wissensobjekt an und stellt die Frage, die es trifft. */
async function frageMitBeleg(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  opts: { vertraulich?: boolean } = {},
) {
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      title: "Ventil bei Ueberdruck schliessen",
      statement: "Bei Ueberdruck Ventil X manuell schliessen.",
      type: "best_practice",
      category: "Anlage 1",
      ...(opts.vertraulich ? { confidentiality: "vertraulich" } : {}),
    },
  });
  if (ko.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${ko.statusCode} ${ko.body}`);
  }
  const ask = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: auth,
    payload: { question: "Was tun bei Ueberdruck am Ventil?" },
  });
  if (ask.statusCode !== 200) {
    throw new Error(`Frage fehlgeschlagen: ${ask.statusCode} ${ask.body}`);
  }
  return { koId: ko.json().id as string, answerId: ask.json().answerId as string | null };
}

function erklaerung(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  answerId: string,
) {
  return app.inject({
    method: "GET",
    url: `/api/klara/answers/${answerId}/explanation`,
    headers: auth,
  });
}

describe("W3-C · GET /api/klara/answers/:answerId/explanation", () => {
  it("die Route ist verdrahtet und liefert dem Eigentuemer seine Erklaerung", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const { koId, answerId } = await frageMitBeleg(app, auth);
    expect(answerId, "der Antwortlauf muss eine Kennung ausweisen").not.toBeNull();

    const res = await erklaerung(app, auth, String(answerId));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe("OK");
    expect(body.answerId).toBe(answerId);
    expect(body.evidenceCount).toBeGreaterThan(0);

    const beleg = body.evidence.find(
      (e: { knowledgeObjectId: string }) => e.knowledgeObjectId === koId,
    );
    expect(beleg, "das belegende Objekt fehlt in der Erklaerung").toBeDefined();
    // Die Fassung ist gebunden — der eigentliche Fortschritt dieses Durchgangs.
    expect(beleg.knowledgeObjectVersion).toBeGreaterThan(0);
    // Und die Referenzlage steht je Beleg, nicht oben.
    const hatRef = beleg.validationDecisionRef !== null;
    const hatGrund = beleg.validationReferenceAbsenceReason !== null;
    expect(hatRef !== hatGrund).toBe(true);
  });

  it("eine unbekannte Kennung ergibt 404", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const res = await erklaerung(app, auth, "gibt-es-nicht");
    expect(res.statusCode).toBe(404);
  });

  it("GEGENFALL · eine FREMDE Antwort ergibt DASSELBE 404 — kein Unterschied nach aussen", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const { answerId } = await frageMitBeleg(app, auth);
    const bernd = await zweiterNutzer(app, auth, "bernd541@x.de");

    const fremd = await erklaerung(app, bernd, String(answerId));
    const unbekannt = await erklaerung(app, bernd, "gibt-es-nicht");
    expect(fremd.statusCode).toBe(404);
    // Ununterscheidbar: gleicher Code UND gleicher Rumpf. Sonst waere die Kennung selbst eine
    // Auskunft darueber, dass es diese fremde Antwort gibt.
    expect(fremd.body).toBe(unbekannt.body);
  });

  it("ohne Anmeldung gibt es keine Erklaerung", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const { answerId } = await frageMitBeleg(app, auth);
    const res = await app.inject({
      method: "GET",
      url: `/api/klara/answers/${answerId}/explanation`,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
    expect(res.statusCode).toBeLessThan(404);
  });

  it("GEGENFALL · eine Systemantwort gehoert KEINEM Konto — auch keinem namens `system`", async () => {
    // DIESELBE Dienstlandschaft wie die App — sonst waere der Belegspeicher ein anderer und der
    // Test pruefte zwei Bestaende gegeneinander statt einen.
    const services = buildServices();
    const app = buildApp(services);
    const auth = await admin(app);
    // Eine Antwort OHNE angemeldeten Fragenden: der Dienstweg setzt den Platzhalter-Actor.
    await services.ko.create({
      title: "Ventil bei Ueberdruck schliessen",
      statement: "Bei Ueberdruck Ventil X manuell schliessen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
    });
    const lauf = await services.ask.ask("Was tun bei Ueberdruck am Ventil?");
    expect(lauf.answerId).not.toBeNull();
    const record = await services.answerSnapshots.findRecord(String(lauf.answerId));
    expect(record?.owner).toEqual({ kind: "system" });

    // Und ueber den Draht: ein angemeldetes Konto bekommt sie nicht zu sehen.
    const res = await erklaerung(app, auth, String(lauf.answerId));
    expect(res.statusCode).toBe(404);
  });
});
