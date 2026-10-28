import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { ConsoleMailer } from "../../services/notifications";

type Welt = Awaited<ReturnType<typeof aufbau>>;

async function aufbau() {
  const services = buildServices();
  const mailer = new ConsoleMailer();
  services.mailer = mailer;
  const app = buildApp(services);
  const password = "ko13-synthetisch-123";
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
      payload: { name: "Autor", email: "ko13-autor@example.test", password },
    });
    expect(setup.statusCode, setup.body).toBe(201);
    const autor = await login("ko13-autor@example.test");
    const pruefer: Array<Awaited<ReturnType<typeof login>>> = [];
    for (const kennung of ["a", "b"]) {
      const email = `ko13-pruefer-${kennung}@example.test`;
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

async function bestand(w: Welt) {
  const kos = await w.services.ko.list();
  return structuredClone({
    kos,
    zuweisungen: await w.services.validation.zuweisungenZu(kos.map((ko) => ko.id)),
    audit: await w.services.audit.list(),
    mails: w.mailer.sent,
    meldungen: await Promise.all(
      [w.autor, ...w.pruefer].map((user) => w.services.validation.openAssignmentsFor(user.id)),
    ),
  });
}

it("KO13: ungültige Prüferlisten lassen den gesamten Bestand unverändert", async () => {
  const w = await aufbau();
  try {
    const id = await anlegen(w);
    const bekannt = w.pruefer[0]?.id;
    if (!bekannt) throw new Error("Das tatsächlich angelegte Prüfkonto fehlt");
    const vorher = await bestand(w);
    const ungueltig: unknown[] = [
      "xyz",
      null,
      false,
      42,
      {},
      [42],
      [null],
      [bekannt, false],
      [bekannt, {}],
      [bekannt, []],
      [""],
      ["gibt-es-nicht"],
      [bekannt, "gibt-es-nicht"],
      ["gibt-es-nicht", bekannt],
      [` ${bekannt}`],
      [`${bekannt} `],
    ];
    for (const userIds of ungueltig) {
      const res = await w.app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: w.autor.headers,
        payload: { action: "assign", userIds },
      });
      expect(res.statusCode, res.body).toBe(400);
      expect(res.json().error).toBe("BAD_REQUEST");
      expect(await bestand(w), JSON.stringify(userIds)).toEqual(vorher);
    }
  } finally {
    await w.app.close();
  }
});

it("KO13: bekannte Prüferkonten erhalten echte Zuweisungen und Nachrichten", async () => {
  const w = await aufbau();
  try {
    const id = await anlegen(w);
    for (const payload of [{ action: "assign" }, { action: "assign", userIds: [] }]) {
      const res = await w.app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: w.autor.headers,
        payload,
      });
      expect(res.statusCode, res.body).toBe(204);
    }
    expect(await w.services.validation.zuweisungenZu([id])).toEqual([]);
    const userIds = w.pruefer.map((user) => user.id);
    const mailsVorher = w.mailer.sent.length;
    const res = await w.app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: w.autor.headers,
      payload: { action: "assign", userIds },
    });
    expect(res.statusCode, res.body).toBe(204);
    const zuweisungen = await w.services.validation.zuweisungenZu([id]);
    expect(zuweisungen.map((a) => a.userId).sort()).toEqual([...userIds].sort());
    for (const zuweisung of zuweisungen) {
      expect(zuweisung).toMatchObject({ koId: id, status: "open", weg: "manuell" });
    }
    const ko = await w.services.ko.get(id);
    expect([...(ko?.ownership?.reviewers ?? [])].sort()).toEqual([...userIds].sort());
    const audit = await w.services.audit.list({ action: "ko.assigned", target: id });
    expect(audit.at(-1)).toMatchObject({ actor: w.autor.id, payload: { userIds } });
    const mails = w.mailer.sent.slice(mailsVorher);
    expect(mails).toHaveLength(userIds.length);
    expect(mails.map((mail) => mail.to).sort()).toEqual(w.pruefer.map((user) => user.email).sort());
    for (const mail of mails) {
      expect(mail.subject).toBe("KLARWERK: Wissensobjekt zur Validierung zugewiesen");
      expect(mail.text).toContain(id);
    }
    for (const user of w.pruefer) {
      const feed = await w.app.inject({
        method: "GET",
        url: "/api/notifications",
        headers: user.headers,
      });
      expect(feed.statusCode, feed.body).toBe(200);
      expect(feed.json()).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: "assignment", koId: id })]),
      );
    }
  } finally {
    await w.app.close();
  }
});
