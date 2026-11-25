import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { anfrage } from "../teamassistenten/aufbau";
import { workflowUmfeld } from "./definition-fixture";

describe("Fachbereiche erstellen, testen und veröffentlichen eigene Workflows", () => {
  const s = buildServices();
  const app = buildApp(s);
  let f: Awaited<ReturnType<typeof workflowUmfeld>>;
  beforeAll(async () => {
    f = await workflowUmfeld(s, app);
  });
  afterAll(() => app.close());
  async function neu(name: string) {
    const r = await anfrage(app, f.autor.token)("POST", f.api, {
      teamId: f.team.id,
      definition: { ...f.definition, name },
    });
    expect(r.statusCode, r.body).toBe(201);
    return { pfad: `${f.api}/${r.json().id}`, id: r.json().id as string };
  }
  it("hält Entwürfe privat, bindet die Prüfung, erhält die frühere Teamfassung und zieht die Freigabe zurück", async () => {
    const autor = anfrage(app, f.autor.token);
    const leser = anfrage(app, f.leser.token);
    const aussen = anfrage(app, f.fremd.token);
    const { pfad, id } = await neu("Einkaufsregel");
    expect((await leser("GET", pfad)).statusCode).toBe(404);
    expect((await leser("GET", f.api)).json().workflows).toEqual([]);
    expect((await autor("POST", `${pfad}/freigeben`, { version: 1, revision: 1 })).statusCode).toBe(
      409,
    );
    expect((await aussen("PUT", pfad, { revision: 1, definition: f.definition })).statusCode).toBe(
      404,
    );
    const test = await autor("POST", `${pfad}/pruefen`, { revision: 1, sprache: "nl" });
    expect(test.statusCode, test.body).toBe(200);
    expect(test.json().pruefung).toMatchObject({
      bestanden: true,
      version: 1,
      sprache: "nl",
      schritte: [{ bestanden: true, ist: "belegt" }, { bestanden: true }, { bestanden: true }],
    });
    expect(test.json().pruefung).not.toHaveProperty("bindungen");
    expect(
      (await autor("POST", `${pfad}/freigeben`, { version: 1, revision: 2 })).json().aktiv,
    ).toBe(1);
    const vertraulich = {
      ...f.definition,
      name: "Unveröffentlichte Bearbeitung",
      beispielfall: "Privater Gegenfall",
    };
    expect(
      (await autor("PUT", pfad, { revision: 3, definition: vertraulich })).json(),
    ).toMatchObject({ entwurf: 2, aktiv: 1, pruefung: null });
    const detail = await leser("GET", pfad);
    expect(detail.json()).toMatchObject({
      id,
      name: "Einkaufsregel",
      aktiv: 1,
      veroeffentlicht: { brauchtFall: true, ausloeser: f.definition.ausloeser },
    });
    expect(detail.body).not.toContain(vertraulich.name);
    expect(detail.body).not.toContain(vertraulich.beispielfall);
    expect(detail.json()).not.toHaveProperty("definition");
    expect(detail.json()).not.toHaveProperty("pruefung");
    expect((await aussen("GET", pfad)).statusCode).toBe(404);
    const rot = await autor("POST", `${pfad}/pruefen`, { revision: 4, sprache: "de" });
    expect(rot.statusCode, rot.body).toBe(200);
    expect(rot.json().pruefung.bestanden).toBe(false);
    expect((await autor("POST", `${pfad}/freigeben`, { revision: 5, version: 2 })).statusCode).toBe(
      409,
    );
    const raus = await autor("POST", `${pfad}/zurueckziehen`, { revision: 5 });
    expect(raus.json().aktiv).toBeNull();
    expect((await leser("GET", pfad)).statusCode).toBe(404);
    expect((await autor("DELETE", pfad, { revision: 6 })).statusCode).toBe(409);
    expect(
      (await autor("POST", `${pfad}/freigeben`, { revision: 6, version: 1 })).json().aktiv,
    ).toBe(1);
  });
  it("erlaubt nur aktive Assistenten desselben Teams und echte Mitglieder mit Autorenrecht", async () => {
    const autor = anfrage(app, f.autor.token);
    const leser = anfrage(app, f.leser.token);
    const aussen = anfrage(app, f.fremd.token);
    const d = { ...f.definition, schritte: [{ ...f.definition.schritte[0], version: 117 }] };
    expect((await autor("POST", f.api, { teamId: f.team.id, definition: d })).statusCode).toBe(409);
    expect(
      (await leser("POST", f.api, { teamId: f.team.id, definition: f.definition })).statusCode,
    ).toBe(403);
    expect(
      (await aussen("POST", f.api, { teamId: f.team.id, definition: f.definition })).statusCode,
    ).toBe(404);
    const anderes = { ...f.team, id: "team-service", name: "Service" };
    expect(await s.teams.lege(anderes)).toBe(true);
    expect(
      (await autor("POST", f.api, { teamId: anderes.id, definition: f.definition })).statusCode,
    ).toBe(404);
    expect(
      (
        await autor("POST", f.api, {
          teamId: f.team.id,
          definition: { ...f.definition, beispielfall: "" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await autor("POST", f.api, {
          teamId: f.team.id,
          definition: {
            ...f.definition,
            schritte: [{ typ: "aktion", titel: "Aktion", aktion: "fremd" }],
          },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("schützt eine parallele Bearbeitung und löscht ausschließlich einen unveröffentlichten eigenen Entwurf", async () => {
    const autor = anfrage(app, f.autor.token);
    const { pfad } = await neu("Servicewissen");
    const resultate = await Promise.all(
      ["A", "B"].map((name) =>
        autor("PUT", pfad, { revision: 1, definition: { ...f.definition, name } }),
      ),
    );
    expect(resultate.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await autor("DELETE", pfad, { revision: 1 })).statusCode).toBe(409);
    expect((await autor("DELETE", pfad, { revision: 2 })).statusCode).toBe(204);
    expect((await autor("GET", pfad)).statusCode).toBe(404);
  });
  it("hält die Veröffentlichung auf, wenn sich die Konfliktlage einer schon geprüften Quelle noch im Probelauf ändert", async () => {
    const autor = anfrage(app, f.autor.token);
    const { pfad } = await neu("Geänderte Grundlage");
    const p = await autor("POST", `${pfad}/pruefen`, { revision: 1, sprache: "en" });
    expect(p.json().pruefung.bestanden).toBe(true);
    const bindung = s.teamassistenten.workflowBindung.bind(s.teamassistenten);
    let zaehler = 0;
    const wechsel = vi
      .spyOn(s.teamassistenten, "workflowBindung")
      .mockImplementation(async (...a) => {
        const w = await bindung(...a);
        return ++zaehler >= 3 ? { ...w, konflikte: "neuer Konflikt nach dem ersten Schritt" } : w;
      });
    try {
      const r = await autor("POST", `${pfad}/freigeben`, { revision: 2, version: 1 });
      expect(r.statusCode, r.body).toBe(409);
      expect(r.json().error).toBe("GRUNDLAGE_GEAENDERT");
      expect((await autor("GET", pfad)).json().aktiv).toBeNull();
    } finally {
      wechsel.mockRestore();
    }
  });
  it("veröffentlicht nach Rückzug des Assistenten keine inzwischen veraltete positive Probe", async () => {
    const autor = anfrage(app, f.autor.token);
    const { pfad } = await neu("Wissensstand vor Freigabe prüfen");
    const p = await autor("POST", `${pfad}/pruefen`, { revision: 1, sprache: "en" });
    expect(p.json().pruefung.bestanden).toBe(true);
    expect(
      (await autor("POST", `${f.assistentPfad}/zurueckziehen`, { revision: 3 })).statusCode,
    ).toBe(200);
    const antwort = await autor("POST", `${pfad}/freigeben`, { revision: 2, version: 1 });
    expect([404, 409]).toContain(antwort.statusCode);
    expect((await autor("GET", pfad)).json().aktiv).toBeNull();
  });
});
