import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

// ================================================================================================
// aufnahme:20260922:gesamt-hilfreich-signal — R-0235 / R-0749: „Hat geholfen" AM WISSENSOBJEKT.
// ================================================================================================
//
// „Wer eine Antwort oder ein Wissensobjekt erfolgreich angewendet hat, kann das mit einem Klick
// melden. … Die Meldung ist ausdrücklich keine Prüfstimme."
//
// VORHER: der einzige Weg war POST /api/ask/helpful mit einem Antwortbeleg. Ohne vorausgehende
// Antwort war die Meldung unmöglich. NACHHER: PUT /api/kos/:id mit `action: "helpful"` — durch
// dasselbe Sichtbarkeitstor wie jede Aktion am Objekt, mit demselben gekoppelten Kern (Trust-
// Schritt + Audit, genau einmal je Person und Objekt) und derselben Glocken-Rückmeldung an den Autor.
// Das Antwortfeedback bleibt unverändert an tragende Quellen gebunden (R-0313).
describe("Hat geholfen am Wissensobjekt — ohne vorausgehende Antwort", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${res.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    return { headers, id: me.json().id as string };
  }

  async function setup() {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");
    const seed = await app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: admin.headers,
    });
    const erik = await login(app, "erik@demo.klarwerk", demoKennwort(seed, "erik@demo.klarwerk"));
    return { app, admin, erik };
  }

  async function anlegen(
    app: App,
    headers: Record<string, string>,
    title: string,
    confidentiality: "intern" | "vertraulich",
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality,
        title,
        statement: "Erst entlüften, dann den Deckel lösen.",
        type: "best_practice",
        neededValidations: 1,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  }

  interface KoStand {
    status: string;
    trust: number;
    version: number;
  }

  async function ladeKo(app: App, headers: Record<string, string>, koId: string) {
    const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    return res.json() as KoStand;
  }

  const hilfreich = (app: App, headers: Record<string, string>, koId: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: { action: "helpful" },
    });

  const feed = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/notifications", headers })
      .then((r) => r.json() as Array<{ kind: string; koId?: string; title: string }>);

  it("ein Klick am Objekt: Trust +2, keine Prüfstimme, Autor erfährt es — genau einmal", async () => {
    const { app, admin, erik } = await setup();
    const koId = await anlegen(app, admin.headers, "Pumpe P3 vor dem Öffnen entlüften", "intern");
    const vorher = await ladeKo(app, admin.headers, koId);

    // Erik hat das Objekt angewendet und meldet es — ohne vorher gefragt zu haben.
    const res = await hilfreich(app, erik.headers, koId);
    expect(res.statusCode, res.body).toBe(204);

    const nachher = await ladeKo(app, admin.headers, koId);
    expect(nachher.trust).toBe(Math.min(99, vorher.trust + 2));
    // Keine Prüfstimme: das offene Objekt bleibt offen, die Fassung bleibt dieselbe.
    expect(nachher.status).toBe(vorher.status);
    expect(nachher.version).toBe(vorher.version);

    // R-0747: der Autor erfährt es in der Glocke; der Meldende selbst nicht.
    const adminImpact = (await feed(app, admin.headers)).filter(
      (n) => n.kind === "impact" && n.koId === koId,
    );
    expect(adminImpact).toHaveLength(1);
    expect(adminImpact[0]?.title).toContain("Pumpe P3");
    expect(
      (await feed(app, erik.headers)).some((n) => n.kind === "impact" && n.koId === koId),
    ).toBe(false);

    // Zweiter Klick derselben Person: ehrlicher No-op — kein zweiter Schritt, keine zweite Meldung.
    expect((await hilfreich(app, erik.headers, koId)).statusCode).toBe(204);
    expect((await ladeKo(app, admin.headers, koId)).trust).toBe(nachher.trust);
    expect(
      (await feed(app, admin.headers)).filter((n) => n.kind === "impact" && n.koId === koId),
    ).toHaveLength(1);
  });

  it("berechtigter Zugriff: ein Objekt, das die Person nicht sehen darf, ergibt 404 und keine Wirkung", async () => {
    const { app, admin, erik } = await setup();
    const koId = await anlegen(app, admin.headers, "Zugangscode Leitstand Halle 4", "vertraulich");
    const vorher = await ladeKo(app, admin.headers, koId);

    const res = await hilfreich(app, erik.headers, koId);
    expect(res.statusCode, res.body).toBe(404);
    expect(res.body).not.toContain("Zugangscode");
    expect((await ladeKo(app, admin.headers, koId)).trust).toBe(vorher.trust);
    expect(
      (await feed(app, admin.headers)).some((n) => n.kind === "impact" && n.koId === koId),
    ).toBe(false);

    // Ein Objekt, das es nicht gibt, ebenso 404.
    expect((await hilfreich(app, erik.headers, "gibt-es-nicht")).statusCode).toBe(404);
  });

  it("ohne Anmeldung keine Wirkung", async () => {
    const { app, admin } = await setup();
    const koId = await anlegen(app, admin.headers, "Lager L2 nur trocken einlagern", "intern");
    const vorher = await ladeKo(app, admin.headers, koId);
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      payload: { action: "helpful" },
    });
    expect(res.statusCode).toBe(401);
    expect((await ladeKo(app, admin.headers, koId)).trust).toBe(vorher.trust);
  });
});
