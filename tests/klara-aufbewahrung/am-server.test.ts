import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
it("P10 · eigene Ausnahme über vorhandene API, minimale Auditspur und getrennte echte VVT-Angaben", async () => {
  const services = buildServices();
  const app = buildApp(services);
  try {
    const email = "p10@fiktiv.test";
    const password = "fiktiv-p10-pruefung";
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "P10 Fiktiv", email, password },
        })
      ).statusCode,
    ).toBe(201);
    const l = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const headers = { authorization: `Bearer ${l.json().token}` };
    const r = await app.inject({
      method: "POST",
      url: "/api/me/gedaechtnis",
      headers,
      payload: { art: "vorliebe", inhalt: "Fiktiver Inhalt", aufbewahrungTage: 30 },
    });
    expect(r.statusCode).toBe(201);
    const e = r.json().eintrag;
    const bis = new Date(Date.now() + 40 * 86400000).toISOString();
    const grund = "Fiktive private Begründung nicht ins Audit";
    const a = await app.inject({
      method: "PUT",
      url: `/api/me/gedaechtnis/${e.id}`,
      headers,
      payload: {
        fassung: 1,
        inhalt: e.inhalt,
        aufbewahrungAusnahme: { bis, begruendung: grund, verantwortlich: "fremde-person" },
      },
    });
    expect(a.statusCode).toBe(200);
    expect(a.json().eintrag).toMatchObject({
      regulaerVerfallAm: e.verfallAm,
      verfallAm: bis,
      aufbewahrungAusnahme: { bis, begruendung: grund, verantwortlich: l.json().user.id },
    });
    const audit = await services.audit.list();
    expect(JSON.stringify(audit)).not.toContain(grund);
    const ereignis = audit.filter((x) => x.action === "gedaechtnis.geaendert").at(-1);
    expect(ereignis?.payload).toEqual({ fassung: 2, art: "vorliebe", ausnahmeBis: bis });
    expect(JSON.stringify(audit)).not.toContain("fremde-person");
    const verzeichnis = await app.inject({
      url: "/api/datenschutz/verarbeitungsverzeichnis",
      headers,
    });
    expect(verzeichnis.statusCode).toBe(200);
    expect(verzeichnis.json().aufbewahrung.map((x: { zweck: string }) => x.zweck)).toEqual([
      "diagnose",
      "sicherheit",
      "audit",
      "privatverlauf",
    ]);
    const md = await app.inject({
      url: "/api/datenschutz/verarbeitungsverzeichnis?format=markdown",
      headers,
    });
    expect(md.statusCode).toBe(200);
    expect(
      (await app.inject({ method: "DELETE", url: `/api/me/gedaechtnis/${e.id}`, headers }))
        .statusCode,
    ).toBe(200);
    expect((await app.inject({ url: "/api/me/gedaechtnis", headers })).json().eintraege).toEqual(
      [],
    );
  } finally {
    await app.close();
  }
});
