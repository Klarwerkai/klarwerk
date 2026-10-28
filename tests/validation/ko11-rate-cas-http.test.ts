import { expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";

type Welt = Awaited<ReturnType<typeof aufbau>>;

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  const password = "ko11-synthetisch-123";
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
      payload: { name: "Autor", email: "ko11-autor@example.test", password },
    });
    expect(setup.statusCode, setup.body).toBe(201);
    const autor = await login("ko11-autor@example.test");
    const created = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: autor.headers,
      payload: {
        name: "Prüferin",
        email: "ko11-pruefer@example.test",
        password,
        role: "controller",
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const pruefer = await login("ko11-pruefer@example.test");
    // Der bestehende Adminweg setzt das Quorum für die beiden echten Freigabefälle.
    const setting = await app.inject({
      method: "PUT",
      url: "/api/validation/settings",
      headers: autor.headers,
      payload: { defaultNeededValidations: 1 },
    });
    expect(setting.statusCode, setting.body).toBe(200);
    return { services, app, autor, pruefer };
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function anlegen(w: Welt) {
  const created = await w.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: w.autor.headers,
    payload: {
      confidentiality: "intern",
      title: "KO11 Wartungsanweisung",
      statement: "Vor der Wartung den Antrieb abschalten.",
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
  expect(ko.neededValidations).toBe(1);
  return ko;
}

function rate(w: Welt, ko: KnowledgeObject) {
  return w.app.inject({
    method: "PUT",
    url: `/api/kos/${ko.id}`,
    headers: w.pruefer.headers,
    payload: {
      action: "rate",
      verdict: "up",
      expectedVersion: ko.version,
      duplicateAcknowledged: true,
    },
  });
}

it("KO11: Revision vor echtem CAS ergibt409 und bewahrt nurBeleg ohne alte Freigabe", async () => {
  const w = await aufbau();
  try {
    const ko = await anlegen(w);
    const beobachtet: { revision?: KnowledgeObject; geschrieben?: boolean } = {};
    const echteKlammer = w.services.ko.setValidationStateMitBeleg.bind(w.services.ko);
    const hook = vi
      .spyOn(w.services.ko, "setValidationStateMitBeleg")
      .mockImplementationOnce(async (...args) => {
        expect(args[2]).toEqual({ expectedVersion: ko.version, beiVersionswechsel: "nurBeleg" });
        beobachtet.revision = structuredClone(
          await w.services.ko.revise(
            ko.id,
            { statement: "Neue Fassung: vor der Wartung abschalten und gegen Anlauf sichern." },
            w.autor.id,
            { expectedVersion: ko.version },
          ),
        );
        const ergebnis = await echteKlammer(...args);
        beobachtet.geschrieben = ergebnis.geschrieben;
        return ergebnis;
      });
    try {
      const res = await rate(w, ko);
      const neu = beobachtet.revision;
      if (!neu) throw new Error("Die reale Revision vor dem CAS wurde nicht ausgeführt");
      expect(hook).toHaveBeenCalledTimes(1);
      expect(beobachtet.geschrieben).toBe(false);
      expect(neu.version).toBe(ko.version + 1);
      expect(res.statusCode, res.body).toBe(409);
      expect(res.json()).toMatchObject({ error: "KO_STALE", currentVersion: neu.version });
      expect(res.json()).not.toHaveProperty("trust");
      const gespeichert = await w.services.ko.get(ko.id);
      expect(gespeichert).toMatchObject({ version: neu.version, status: "offen", trust: 0 });
      expect(gespeichert?.ownership?.validators ?? []).toEqual([]);
      expect(gespeichert?.ownership?.validators).toEqual(neu.ownership?.validators);
      expect(gespeichert?.validationDecisionRef).toEqual(neu.validationDecisionRef);
      expect(gespeichert?.annahmeRef).toEqual(neu.annahmeRef);
      const daten = await w.services.validation.datenVon(w.pruefer.id, [ko.id]);
      expect(daten.bewertungen).toHaveLength(1);
      expect(daten.bewertungen[0]).toMatchObject({ verdict: "up", koVersion: ko.version });
      expect(daten.zuweisungen.find((a) => a.koId === ko.id)?.status).toBe("done");
      const audit = await w.services.audit.list({ action: "ko.rated", target: ko.id });
      expect(audit).toHaveLength(1);
      expect(audit[0]?.actor).toBe(w.pruefer.id);
      expect(audit[0]?.payload).toMatchObject({ verdict: "up", koVersion: ko.version });
    } finally {
      hook.mockRestore();
    }
  } finally {
    await w.app.close();
  }
});

it("KO11: ohne Revision bestätigt HTTP200 den gespeicherten Zustand", async () => {
  const w = await aufbau();
  try {
    const ko = await anlegen(w);
    const res = await rate(w, ko);
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json()).toMatchObject({
      status: "validiert",
      trust: 99,
      validationDecisionRef: { auditSeq: expect.any(Number), auditHash: expect.any(String) },
    });
    const gespeichert = await w.services.ko.get(ko.id);
    expect(gespeichert).toMatchObject({ version: ko.version, status: "validiert", trust: 99 });
    expect(gespeichert?.validationDecisionRef).toEqual(res.json().validationDecisionRef);
    expect(gespeichert?.ownership?.validators).toEqual([w.pruefer.id]);
    const daten = await w.services.validation.datenVon(w.pruefer.id, [ko.id]);
    expect(daten.bewertungen).toHaveLength(1);
    expect(daten.bewertungen[0]).toMatchObject({ verdict: "up", koVersion: ko.version });
    expect(daten.zuweisungen.find((a) => a.koId === ko.id)?.status).toBe("done");
  } finally {
    await w.app.close();
  }
});
