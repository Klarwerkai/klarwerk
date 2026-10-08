import { describe, expect, it } from "vitest";
import { notificationTarget } from "../../apps/web/src/lib/notificationTarget";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { demoKennwort } from "../support/demoZugang";

// R-0894: die Glocke bündelt persönliche Hinweise — zugewiesene Prüfungen, Eskalationen, Rückgaben,
// Konflikte, Duplikate und Wissenslücken — jeweils mit Sprungziel; Gesehenes verlässt den
// Ungelesen-Zähler. Eskalation und Rückgabe liefen bis hierher nicht als eigene Art. HTTP über die
// echten Routen (build-app); das Sprungziel über den echten FE-Helfer.
describe("R-0894: Eskalation und Rückgabe als eigene Hinweise in der Glocke (HTTP end-to-end)", () => {
  type App = ReturnType<typeof buildApp>;
  type Meldung = { id: string; kind: string; koId?: string; title: string; seen?: boolean };

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
    const services = buildServices();
    const app = buildApp(services);
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
    const carla = await login(
      app,
      "carla@demo.klarwerk",
      demoKennwort(seed, "carla@demo.klarwerk"),
    );
    return { app, services, admin, carla };
  }

  async function anlegen(app: App, headers: Record<string, string>, title: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title,
        statement: `${title}: eine Aussage mit genug Substanz für die Anlage.`,
        type: "best_practice",
        category: "Anlage 1",
        neededValidations: 2,
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json() as { id: string; version: number };
  }

  const feed = (app: App, headers: Record<string, string>) =>
    app
      .inject({ method: "GET", url: "/api/notifications", headers })
      .then((r) => r.json() as Meldung[]);

  const ungelesen = (items: Meldung[]) => items.filter((n) => !n.seen).length;

  it("Rückgabe: die verantwortliche Person bekommt einen eigenen Hinweis mit Sprung in den Eintrag", async () => {
    const { app, admin, carla } = await setup();
    const ko = await anlegen(app, admin.headers, "Presse P2 entlüften");
    await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [carla.id] },
    });
    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: carla.headers,
      payload: { action: "rate", verdict: "down" },
    });
    expect(bewertet.statusCode, bewertet.body).toBe(200);

    const adminFeed = await feed(app, admin.headers);
    const rueckgabe = adminFeed.find((n) => n.koId === ko.id);
    expect(rueckgabe?.kind).toBe("return");
    expect(rueckgabe?.id.startsWith(`ret-${ko.id}-`)).toBe(true);
    expect(rueckgabe?.title).toBe("Presse P2 entlüften");
    // Kein zweiter Eintrag als gewöhnliche Zuweisung daneben.
    expect(adminFeed.some((n) => n.id === `assign-${ko.id}`)).toBe(false);
    // Sprungziel: der Eintrag selbst, wo überarbeitet wird.
    expect(notificationTarget(rueckgabe as never)).toBe(`/wissen/${ko.id}`);
    // Die bewertende Person hat ihre Prüfung erledigt — bei ihr steht nichts mehr.
    expect((await feed(app, carla.headers)).some((n) => n.koId === ko.id)).toBe(false);

    // Gesehen → verlässt den Ungelesen-Zähler (serverseitig, pro Person).
    const vorher = ungelesen(adminFeed);
    const gesehen = await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids: [rueckgabe?.id] },
    });
    expect(gesehen.statusCode).toBe(200);
    expect((gesehen.json() as { unseenCount: number }).unseenCount).toBe(vorher - 1);
    const danach = await feed(app, admin.headers);
    expect(danach.find((n) => n.id === rueckgabe?.id)?.seen).toBe(true);
  });

  it("Gegenprobe: eine gewöhnliche Zuweisung an die verantwortliche Person bleibt `assignment`", async () => {
    const { app, admin } = await setup();
    const ko = await anlegen(app, admin.headers, "Lager schmieren");
    await app.inject({
      method: "PUT",
      url: `/api/kos/${ko.id}`,
      headers: admin.headers,
      payload: { action: "assign", userIds: [admin.id] },
    });
    const eintrag = (await feed(app, admin.headers)).find((n) => n.koId === ko.id);
    expect(eintrag).toMatchObject({ id: `assign-${ko.id}`, kind: "assignment" });
  });

  it("Eskalation: eigene Art mit Sprung aufs Konfliktboard — ein gesehener Konflikt meldet sich neu", async () => {
    const { app, services, admin } = await setup();
    const a = await anlegen(app, admin.headers, "Drehmoment 40 Nm");
    const b = await anlegen(app, admin.headers, "Drehmoment 55 Nm");
    const konflikt = await services.conflicts.create({
      koA: a.id,
      koB: b.id,
      type: "truth",
      description: "Widersprüchliches Drehmoment",
      koAVersion: a.version,
      koBVersion: b.version,
    });

    const offen = (await feed(app, admin.headers)).find((n) => n.id === `con-${konflikt.id}`);
    expect(offen?.kind).toBe("conflict");
    await app.inject({
      method: "POST",
      url: "/api/notifications/seen",
      headers: admin.headers,
      payload: { ids: [`con-${konflikt.id}`] },
    });

    const eskaliert = await app.inject({
      method: "POST",
      url: `/api/conflicts/${konflikt.id}/escalate`,
      headers: admin.headers,
    });
    expect(eskaliert.statusCode, eskaliert.body).toBe(200);

    const nachher = await feed(app, admin.headers);
    const eskalation = nachher.find((n) => n.id === `esc-${konflikt.id}`);
    expect(eskalation).toMatchObject({
      kind: "escalation",
      title: "Widersprüchliches Drehmoment",
    });
    // Die Eskalation ist neu und damit ungelesen, obwohl der Konflikt vorher gesehen war.
    expect(eskalation?.seen).toBe(false);
    expect(nachher.some((n) => n.id === `con-${konflikt.id}`)).toBe(false);
    expect(notificationTarget(eskalation as never)).toBe("/konflikte");
  });
});
