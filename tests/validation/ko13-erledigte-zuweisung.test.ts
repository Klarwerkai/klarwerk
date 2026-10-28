import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ConsoleMailer } from "../../services/notifications";

type Welt = Awaited<ReturnType<typeof aufbau>>;

async function aufbau() {
  const services = buildServices();
  const mailer = new ConsoleMailer();
  services.mailer = mailer;
  const app = buildApp(services);
  const password = "ko13-done-synthetisch-123";
  const login = async (email: string) => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(res.statusCode, res.body).toBe(200);
    const headers = { authorization: `Bearer ${res.json().token}` };
    const me = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(me.statusCode, me.body).toBe(200);
    return { id: me.json().id as string, email, headers };
  };
  try {
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Autor", email: "ko13-done-autor@example.test", password },
    });
    expect(setup.statusCode, setup.body).toBe(201);
    const autor = await login("ko13-done-autor@example.test");
    const pruefer: Array<Awaited<ReturnType<typeof login>>> = [];
    for (const kennung of ["a", "b"]) {
      const email = `ko13-done-pruefer-${kennung}@example.test`;
      const created = await app.inject({
        method: "POST",
        url: "/api/users",
        headers: autor.headers,
        payload: { name: `Prüfer ${kennung}`, email, password, role: "controller" },
      });
      expect(created.statusCode, created.body).toBe(201);
      pruefer.push(await login(email));
    }
    return { services, app, autor, pruefer, mailer };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function anlegen(w: Welt) {
  const res = await w.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: w.autor.headers,
    payload: {
      confidentiality: "intern",
      title: "KO13 Wartungsanweisung",
      statement: "Vor der Wartung den Antrieb abschalten.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function zuweisen(w: Welt, id: string, userIds: string[]) {
  const res = await w.app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: w.autor.headers,
    payload: { action: "assign", userIds },
  });
  expect(res.statusCode, res.body).toBe(204);
}

it("KO13: echte Bewertung bleibt bei erneuter und gemischter Zuweisung erledigt", async () => {
  const w = await aufbau();
  try {
    const id = await anlegen(w);
    const [erster, neuer] = w.pruefer;
    if (!erster || !neuer) throw new Error("Die echten Prüferkonten fehlen");
    await zuweisen(w, id, [erster.id]);
    await w.services.validation.benachrichtigungErledigt(id, erster.id);
    const ko = await w.services.ko.get(id);
    if (!ko) throw new Error("Das echte Wissensobjekt fehlt");
    const rate = await w.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: erster.headers,
      payload: {
        action: "rate",
        verdict: "up",
        expectedVersion: ko.version,
        duplicateAcknowledged: true,
      },
    });
    expect(rate.statusCode, rate.body).toBe(200);
    const vorher = structuredClone(await w.services.validation.zuweisungenZu([id]));
    expect(vorher).toHaveLength(1);
    expect(vorher[0]).toMatchObject({
      userId: erster.id,
      status: "done",
      weg: "manuell",
      benachrichtigung: "erledigt",
      zugewiesenAm: expect.any(String),
      erledigtAm: expect.any(String),
    });
    const stimmen = structuredClone(
      (await w.services.validation.datenVon(erster.id, [id])).bewertungen,
    );
    expect(stimmen).toHaveLength(1);
    expect(stimmen[0]).toMatchObject({ verdict: "up", koVersion: ko.version });
    await zuweisen(w, id, [erster.id]);
    expect(await w.services.validation.zuweisungenZu([id])).toEqual(vorher);
    await zuweisen(w, id, [erster.id, neuer.id]);
    const danach = await w.services.validation.zuweisungenZu([id]);
    expect(danach).toHaveLength(2);
    expect(danach.find((a) => a.userId === erster.id)).toEqual(vorher[0]);
    expect(danach.find((a) => a.userId === neuer.id)).toMatchObject({
      koId: id,
      status: "open",
      weg: "manuell",
      zugewiesenAm: expect.any(String),
    });
    expect((await w.services.validation.datenVon(erster.id, [id])).bewertungen).toEqual(stimmen);
    expect(
      (await w.services.validation.openAssignmentsFor(erster.id)).some((a) => a.koId === id),
    ).toBe(false);
    expect(
      (await w.services.validation.openAssignmentsFor(neuer.id)).some((a) => a.koId === id),
    ).toBe(true);
    const feed = await w.app.inject({
      method: "GET",
      url: "/api/notifications",
      headers: erster.headers,
    });
    expect(feed.statusCode, feed.body).toBe(200);
    expect(feed.json()).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "assignment", koId: id })]),
    );
  } finally {
    await w.app.close();
  }
});

it("KO13: manuelles Ergänzen erhält die ganze offene Verzeichniszuweisung", async () => {
  const w = await aufbau();
  try {
    const id = await anlegen(w);
    const [erster, neuer] = w.pruefer;
    if (!erster || !neuer) throw new Error("Die echten Prüferkonten fehlen");
    expect(
      await w.services.validation.verzeichnisAbgleichen(id, [erster.id], w.autor.id),
    ).toEqual({ neu: [erster.id], entzogen: [] });
    await w.services.validation.benachrichtigungErledigt(id, erster.id);
    const vorher = structuredClone(await w.services.validation.zuweisungenZu([id]));
    expect(vorher).toHaveLength(1);
    expect(vorher[0]).toMatchObject({
      userId: erster.id,
      status: "open",
      quelle: "verzeichnis",
      benachrichtigung: "erledigt",
    });
    await zuweisen(w, id, [erster.id, neuer.id]);
    const danach = structuredClone(await w.services.validation.zuweisungenZu([id]));
    expect(danach).toHaveLength(2);
    expect(danach.find((a) => a.userId === erster.id)).toEqual(vorher[0]);
    expect(danach.find((a) => a.userId === neuer.id)).toMatchObject({
      koId: id,
      status: "open",
      weg: "manuell",
      zugewiesenAm: expect.any(String),
    });
    await zuweisen(w, id, [erster.id, neuer.id]);
    expect(await w.services.validation.zuweisungenZu([id])).toEqual(danach);
    for (const user of w.pruefer) {
      expect(
        (await w.services.validation.openAssignmentsFor(user.id)).some((a) => a.koId === id),
      ).toBe(true);
    }
  } finally {
    await w.app.close();
  }
});
