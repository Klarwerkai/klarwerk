import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// FUNKE-FIX3 P0 (bens Blocker B): GET /api/notifications lieferte jede offene Gap-Frage unredigiert
// an JEDEN angemeldeten Nutzer — ein e2e-Bypass des Gap-Sichtbarkeitsvertrags (/api/gaps redigierte
// korrekt, die global gemountete Glocke nicht). Hier wird am ECHTEN HTTP-Endpunkt gepinnt: die
// Gap-Ableitung läuft durch denselben zentralen Vertrag (gap-visibility.redactGapForViewer) —
// Fragetext NUR für Owner/Assignee/Detail-Rolle (ko.validate); für alle anderen kommt der Text im
// GESAMTEN Payload nicht vor (Volltext-Ausschluss über die ganze Antwort, nicht nur ein Feld).
describe("FUNKE-FIX3 P0 (bens Blocker B): /api/notifications redigiert Gap-Fragetexte je Betrachter", () => {
  const QUESTION = "Wie kalibriere ich das Quantenflux Aggregat ZZZ?";

  async function loginToken(
    app: ReturnType<typeof buildApp>,
    email: string,
  ): Promise<{ headers: Record<string, string>; id: string }> {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { headers: { authorization: `Bearer ${login.json().token}` }, id: login.json().user.id };
  }

  // Admin (Bootstrap) legt zwei Experten an; EXPERTE-1 erzeugt über eine unbeantwortbare Frage eine
  // Lücke (createdBy = ex1). EXPERTE-2 ist der fremde Betrachter ohne jede Berechtigung an der Lücke.
  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const admin = await loginToken(app, "admin@x.de");
    for (const [name, email] of [
      ["Ex1", "ex1@x.de"],
      ["Ex2", "ex2@x.de"],
    ]) {
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: admin.headers,
        payload: { name, email, password: "secret123", role: "experte" },
      });
    }
    const ex1 = await loginToken(app, "ex1@x.de");
    const ex2 = await loginToken(app, "ex2@x.de");
    const asked = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: ex1.headers,
      payload: { question: QUESTION },
    });
    const gapId = asked.json().gap.id as string;
    return { app, admin, ex1, ex2, gapId };
  }

  const feed = (app: ReturnType<typeof buildApp>, headers: Record<string, string>) =>
    app.inject({ method: "GET", url: "/api/notifications", headers });

  it("fremder Experte: Fragetext kommt im GESAMTEN Payload nicht vor; Eintrag nur neutral/redigiert", async () => {
    const { app, ex2, gapId } = await setup();
    const res = await feed(app, ex2.headers);
    expect(res.statusCode).toBe(200);
    // Volltext-Ausschluss über die GANZE Antwort — egal in welchem Feld.
    expect(res.payload).not.toContain(QUESTION);
    expect(res.payload).not.toContain("Quantenflux");
    const gapItem = res.json().find((n: { id: string }) => n.id === `gap-${gapId}`) as Record<
      string,
      unknown
    >;
    expect(gapItem).toBeDefined();
    expect(gapItem.kind).toBe("gap");
    expect(gapItem.title).toBe("");
    expect(gapItem.redacted).toBe(true);
  });

  it("Owner (Ersteller der Lücke) sieht den Fragetext in der Glocke", async () => {
    const { app, ex1, gapId } = await setup();
    const res = await feed(app, ex1.headers);
    const gapItem = res.json().find((n: { id: string }) => n.id === `gap-${gapId}`);
    expect(gapItem.title).toBe(QUESTION);
    expect(gapItem.redacted).toBeUndefined();
  });

  it("Detail-Rolle (Admin, ko.validate) sieht den Fragetext in der Glocke", async () => {
    const { app, admin, gapId } = await setup();
    const res = await feed(app, admin.headers);
    const gapItem = res.json().find((n: { id: string }) => n.id === `gap-${gapId}`);
    expect(gapItem.title).toBe(QUESTION);
  });

  it("Assignee sieht den Fragetext erst NACH der Zuweisung (vorher redigiert)", async () => {
    const { app, admin, ex2, gapId } = await setup();
    expect((await feed(app, ex2.headers)).payload).not.toContain("Quantenflux");
    const assigned = await app.inject({
      method: "PUT",
      url: `/api/gaps/${gapId}`,
      headers: admin.headers,
      payload: { expertId: ex2.id },
    });
    expect(assigned.statusCode).toBe(200);
    const after = await feed(app, ex2.headers);
    const gapItem = after.json().find((n: { id: string }) => n.id === `gap-${gapId}`);
    expect(gapItem.title).toBe(QUESTION);
  });

  it("Betrachter stammt IMMER aus der Session: ohne Login 401 (nicht absenkbar über den Client)", async () => {
    const { app } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/notifications" });
    expect(res.statusCode).toBe(401);
  });
});
