import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KioskProfil } from "../../services/app/src/kiosk-profil";

const apps: FastifyInstance[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(apps.splice(0).map((a) => a.close()));
});
async function aufbau() {
  const services = buildServices();
  let profil: KioskProfil | null = null;
  const app = buildApp(services, { kioskProfil: async () => profil });
  apps.push(app);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "Fiktiver Kioskprüfer",
      email: "kiosk@example.test",
      password: "fiktiv-12345",
    },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      email: "kiosk@example.test",
      password: "fiktiv-12345",
    },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  const user = await services.auth.authenticate(login.json().token);
  if (!user) throw new Error("Fiktive Sitzung fehlt");
  async function ko(statement: string, extra: Record<string, unknown> = {}, validieren = true) {
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Fiktive Testpumpe KX42",
        statement,
        confidentiality: "intern",
        type: "best_practice",
        category: "Kiosk-Test",
        neededValidations: 1,
        ...extra,
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const id = created.json().id as string;
    if (validieren) {
      const r = await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers,
        payload: { action: "rate", verdict: "up" },
      });
      expect(r.statusCode, r.body).toBe(200);
    }
    const r = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    return { koId: id, fassung: r.json().version as number };
  }
  const freigeben = (quellen: KioskProfil["quellen"]) => {
    profil = {
      id: "fiktive-installation",
      revision: 1,
      zugang: "sitzung",
      leserId: user.id,
      freigabebeleg: "Fiktiver isolierter Test, keine Betriebsfreigabe",
      gueltigBis: new Date(Date.now() + 3_600_000).toISOString(),
      quellen,
    };
    return profil;
  };
  const fragen = (question = "Testpumpe KX42", zusatz = {}) =>
    app.inject({
      method: "POST",
      url: "/api/kiosk/fragen",
      headers,
      payload: { question, profilId: "fiktive-installation", revision: 1, ...zusatz },
    });
  return {
    app,
    services,
    headers,
    ko,
    freigeben,
    fragen,
    setProfil: (p: KioskProfil | null) => {
      profil = p;
    },
  };
}

describe("R-1648 · geschlossener Lesekiosk über die echte HTTP-App", () => {
  it("ohne Profil auch für bestehende Sitzung gesperrt; allgemeines Anmeldetor bleibt bestehen", async () => {
    const a = await aufbau();
    const ask = vi.spyOn(a.services.ask, "ask");
    expect((await a.fragen()).statusCode).toBe(403);
    expect((await a.app.inject({ url: "/api/kiosk/profil" })).statusCode).toBe(403);
    expect(
      (await a.app.inject({ method: "POST", url: "/api/ask", payload: { question: "KX42" } }))
        .statusCode,
    ).toBe(401);
    expect(ask).not.toHaveBeenCalled();
  });
  it("nur gebundene validierte Quellenfassung; fremde, vertrauliche und ungeprüfte Inhalte bleiben draußen", async () => {
    const a = await aufbau();
    const erlaubt = await a.ko("Testpumpe KX42 nur nach dem Entlasten öffnen.");
    await a.ko("Testpumpe KX42 FREMDE-QUELLE-ABCD verwenden.");
    const vertraulich = await a.ko("Testpumpe KX42 GEHEIM-ABCD.", {
      confidentiality: "vertraulich",
    });
    const offen = await a.ko("Testpumpe KX42 UNGEPRUEFT-ABCD.", {}, false);
    a.freigeben([erlaubt, vertraulich, offen]);
    const r = await a.fragen();
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().result.answered).toBe(true);
    expect(r.json().result.sources).toEqual([erlaubt.koId]);
    expect(r.json().kiosk.quellen).toEqual([erlaubt]);
    expect(r.body).not.toMatch(/FREMDE-QUELLE-ABCD|GEHEIM-ABCD|UNGEPRUEFT-ABCD/);
    expect(r.headers["cache-control"]).toBe("no-store");
  });
  it("keine Lückenanlage oder Schreibbefehle; beliebige Client-Scopes und Aktionen werden abgewiesen", async () => {
    const a = await aufbau();
    const q = await a.ko("Testpumpe KX42 entlasten.");
    a.freigeben([q]);
    for (const body of [
      { action: "write" },
      { quellen: [q] },
      { mode: "anything" },
      { selection: "Text" },
    ]) {
      expect((await a.fragen("KX42", body)).statusCode).toBe(400);
    }
    const r = await a.fragen("Erstelle einen Kalendertermin QUANTENZEIT-ZZZ");
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().result.answered).toBe(false);
    expect(r.json().gap).toBeNull();
    expect((await a.app.inject({ url: "/api/gaps", headers: a.headers })).json()).toEqual([]);
    expect(
      (
        await a.app.inject({
          method: "PUT",
          url: "/api/kiosk/profil",
          headers: a.headers,
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
  });
  it("leeres, abgelaufenes, anonymes und fehlerhaftes Profil bleibt geschlossen", async () => {
    const a = await aufbau();
    const q = await a.ko("Testpumpe KX42 entlasten.");
    const gut = a.freigeben([q]);
    for (const p of [
      { ...gut, quellen: [] },
      { ...gut, freigabebeleg: "" },
      { ...gut, gueltigBis: "2000-01-01" },
      { ...gut, zugang: "anonym" },
      { ...gut, quellen: [q, q] },
      { ...gut, leserId: "anderes-konto" },
    ]) {
      a.setProfil(p as KioskProfil);
      expect((await a.fragen()).statusCode).toBe(403);
    }
    a.setProfil(gut);
    expect((await a.app.inject({ url: "/api/kiosk/profil" })).statusCode).toBe(401);
    expect((await a.fragen("KX42", { revision: 2 })).statusCode).toBe(403);
  });
  it("andere Quellenfassung trägt keine Antwort; Änderung erfordert explizite neue Profilbindung", async () => {
    const a = await aufbau();
    const q = await a.ko("Testpumpe KX42 entlasten.");
    a.freigeben([{ ...q, fassung: q.fassung + 1 }]);
    const r = await a.fragen();
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().result.answered).toBe(false);
    expect(r.json().result.sources).toEqual([]);
  });
  it("Profilentzug während der Antwort verhindert Auslieferung auch nach echtem Antwortlauf", async () => {
    const a = await aufbau();
    const q = await a.ko("Testpumpe KX42 entlasten.");
    a.freigeben([q]);
    const original = a.services.ask.ask.bind(a.services.ask);
    vi.spyOn(a.services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      a.setProfil(null);
      return out;
    });
    const r = await a.fragen();
    expect(r.statusCode).toBe(403);
    expect(r.body).not.toContain("entlasten");
    expect(r.json().result).toBeUndefined();
  });
  it("administrative KI-Abschaltung bleibt auch am Kiosk wirksam", async () => {
    const a = await aufbau();
    const q = await a.ko("Testpumpe KX42 entlasten.");
    a.freigeben([q]);
    expect(
      (
        await a.app.inject({
          method: "PUT",
          url: "/api/reasoner/config",
          headers: a.headers,
          payload: { global: "deterministic" },
        })
      ).statusCode,
    ).toBe(200);
    const lesen = vi.spyOn(a.services.ko, "get");
    const r = await a.fragen();
    expect(r.statusCode, r.body).toBe(503);
    expect(r.json().error).toBe("KI_ABGESCHALTET");
    expect(lesen).not.toHaveBeenCalled();
  });
  it("Quellrechtsentzug während der Antwort bleibt in der bestehenden Schlussprüfung wirksam", async () => {
    const a = await aufbau();
    const q = await a.ko("Testpumpe KX42 entlasten.");
    a.freigeben([q]);
    const original = a.services.ask.ask.bind(a.services.ask);
    vi.spyOn(a.services.ask, "ask").mockImplementation(async (...args) => {
      const out = await original(...args);
      const r = await a.app.inject({
        method: "PUT",
        url: `/api/kos/${q.koId}`,
        headers: a.headers,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(r.statusCode, r.body).toBe(200);
      return out;
    });
    const r = await a.fragen();
    expect(r.statusCode, r.body).toBe(409);
    expect(r.body).not.toContain("entlasten");
  });
});
