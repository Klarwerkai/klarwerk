import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type Welt = Awaited<ReturnType<typeof aufbau>>;

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  const password = "ko12-synthetisch-123";
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
    return { id: me.json().id as string, headers };
  };
  try {
    const setup = await app.inject({
      method: "POST",
      url: "/api/auth/setup",
      payload: { name: "Autor", email: "ko12-autor@example.test", password },
    });
    expect(setup.statusCode, setup.body).toBe(201);
    const autor = await login("ko12-autor@example.test");
    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: autor.headers,
      payload: {
        name: "Prüferin",
        email: "ko12-pruefer@example.test",
        password,
        role: "controller",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const pruefer = await login("ko12-pruefer@example.test");
    return { services, app, autor, pruefer };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function anlegen(w: Welt, kennung: string) {
  const created = await w.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: w.autor.headers,
    payload: {
      confidentiality: "intern",
      title: `KO12 ${kennung}`,
      statement: `Arbeitsanweisung ${kennung}: vor der Wartung den Antrieb abschalten.`,
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  expect(created.statusCode, created.body).toBe(201);
  const id = created.json().id as string;
  const assigned = await w.app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: w.autor.headers,
    payload: { action: "assign", userIds: [w.pruefer.id] },
  });
  expect(assigned.statusCode, assigned.body).toBe(204);
  const visible = await w.app.inject({
    method: "GET",
    url: `/api/kos/${id}`,
    headers: w.pruefer.headers,
  });
  expect(visible.statusCode, visible.body).toBe(200);
  const ko = await w.services.ko.get(id);
  if (!ko) throw new Error("Das echte angelegte KO fehlt");
  return ko;
}

async function bestand(w: Welt) {
  const kos = await w.services.ko.list();
  const ids = kos.map((ko) => ko.id);
  return structuredClone({
    kos,
    pruefungen: await Promise.all(
      [w.autor.id, w.pruefer.id].map((id) => w.services.validation.datenVon(id, ids)),
    ),
    zuweisungen: await w.services.validation.zuweisungenZu(ids),
    audit: await w.services.audit.list(),
  });
}

it("KO12: ungültige HTTP-verdicts hinterlassen keinen Domänenschreibeffekt", async () => {
  const w = await aufbau();
  try {
    const ko = await anlegen(w, "ungültige Eingabe");
    const vorher = await bestand(w);
    expect(Number.isFinite(ko.trust)).toBe(true);
    expect(vorher.pruefungen.flatMap((p) => p.bewertungen)).toEqual([]);
    expect(vorher.zuweisungen).toEqual(
      expect.arrayContaining([expect.objectContaining({ userId: w.pruefer.id, status: "open" })]),
    );
    for (const verdict of ["foo", 7, true, [], {}, null, "", undefined]) {
      const res = await w.app.inject({
        method: "PUT",
        url: `/api/kos/${ko.id}`,
        headers: w.pruefer.headers,
        payload: {
          action: "rate",
          ...(verdict === undefined ? {} : { verdict }),
          expectedVersion: ko.version,
          duplicateAcknowledged: true,
        },
      });
      expect(res.statusCode, res.body).toBe(400);
      expect(res.json().error).toBe("BAD_REQUEST");
      expect(await bestand(w), JSON.stringify(verdict)).toEqual(vorher);
    }
  } finally {
    await w.app.close();
  }
});

it("KO12: up/warn/down wirken über HTTP mit endlichem gespeicherten Vertrauen", async () => {
  const w = await aufbau();
  try {
    for (const verdict of ["up", "warn", "down"] as const) {
      const ko = await anlegen(w, verdict);
      const res = await w.app.inject({
        method: "PUT",
        url: `/api/kos/${ko.id}`,
        headers: w.pruefer.headers,
        payload: {
          action: "rate",
          verdict,
          expectedVersion: ko.version,
          duplicateAcknowledged: true,
        },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json()).toMatchObject({
        up: verdict === "up" ? 1 : 0,
        warn: verdict === "warn" ? 1 : 0,
        down: verdict === "down" ? 1 : 0,
      });
      expect(Number.isFinite(res.json().trust)).toBe(true);
      const gespeichert = await w.services.ko.get(ko.id);
      expect(gespeichert?.trust).toBe(res.json().trust);
      expect(Number.isFinite(gespeichert?.trust)).toBe(true);
      const daten = await w.services.validation.datenVon(w.pruefer.id, [ko.id]);
      expect(daten.bewertungen).toHaveLength(1);
      expect(daten.bewertungen[0]).toMatchObject({
        koId: ko.id,
        userId: w.pruefer.id,
        verdict,
        koVersion: ko.version,
      });
      expect(daten.zuweisungen.find((a) => a.koId === ko.id)?.status).toBe("done");
      const audit = await w.services.audit.list({ action: "ko.rated", target: ko.id });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.payload).toMatchObject({ verdict });
    }
  } finally {
    await w.app.close();
  }
});
