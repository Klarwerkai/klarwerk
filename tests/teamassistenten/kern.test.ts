import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { anfrage, fachbereich } from "./aufbau";

describe("Teamassistenten über die Produkt-API", () => {
  let s: ReturnType<typeof assembleServices>;
  let app: ReturnType<typeof buildApp>;
  let f: Awaited<ReturnType<typeof fachbereich>>;
  let autor: ReturnType<typeof anfrage>;
  let leser: ReturnType<typeof anfrage>;
  let fremd: ReturnType<typeof anfrage>;
  beforeEach(async () => {
    s = assembleServices(inMemoryRepos());
    app = buildApp(s);
    f = await fachbereich(s, app);
    autor = anfrage(app, f.autor.token);
    leser = anfrage(app, f.leser.token);
    fremd = anfrage(app, f.fremd.token);
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });
  async function freigabe() {
    const test = await autor("POST", `${f.pfad}/pruefen`, { revision: 1, sprache: "en" });
    expect(test.statusCode, test.body).toBe(200);
    expect(test.json().pruefung).toMatchObject({ version: 1, bestanden: true });
    const release = await autor("POST", `${f.pfad}/freigeben`, { revision: 2, version: 1 });
    expect(release.statusCode, release.body).toBe(200);
    return release.json().revision as number;
  }
  it("hält den Entwurf privat, prüft Rechte auf jedem Verwaltungsweg und bindet Nutzerfragen an die gewählte aktive Version", async () => {
    expect((await app.inject({ method: "GET", url: f.api })).statusCode).toBe(401);
    expect((await leser("GET", f.api)).json()).toMatchObject({
      teams: [{ id: f.team.id, kannErstellen: false }],
      assistenten: [],
    });
    expect((await fremd("GET", f.pfad)).statusCode).toBe(404);
    expect((await leser("GET", f.pfad)).statusCode).toBe(404);
    expect(
      (await leser("POST", f.api, { teamId: f.team.id, definition: f.definition })).statusCode,
    ).toBe(403);
    for (const schritt of ["pruefen", "freigeben", "zurueckziehen"])
      expect(
        (await fremd("POST", `${f.pfad}/${schritt}`, { revision: 1, version: 1 })).statusCode,
      ).toBe(404);
    expect((await fremd("PUT", f.pfad, { revision: 1, definition: f.definition })).statusCode).toBe(
      404,
    );
    expect((await fremd("DELETE", f.pfad, { revision: 1 })).statusCode).toBe(404);
    expect(
      (await autor("POST", `${f.pfad}/freigeben`, { revision: 1, version: 1 })).json(),
    ).toEqual({ error: "PRUEFUNG_FEHLT" });
    const revision = await freigabe();
    const detail = (await leser("GET", f.pfad)).json();
    expect(detail).toMatchObject({
      aktiv: 1,
      aktivName: "Netzfragen",
      bearbeitbar: false,
      nutzbar: true,
    });
    for (const feld of ["definition", "pruefung", "entwurf", "revision", "freigegebeneVersionen"])
      expect(detail).not.toHaveProperty(feld);
    const fragen = (version: number) =>
      leser("POST", `${f.pfad}/fragen`, { version, frage: f.aussage, sprache: "en" });
    expect((await fragen(1)).json()).toMatchObject({
      version: 1,
      antwort: { stand: "belegt", quellen: [{ id: f.ko.id, version: f.ko.version }] },
    });
    expect((await fragen(2)).json()).toEqual({ error: "STAND_GEAENDERT" });
    expect((await autor("DELETE", f.pfad, { revision })).statusCode).toBe(409);
    expect(
      (await autor("PUT", f.pfad, { revision, teamId: "fremd", definition: f.definition }))
        .statusCode,
    ).toBe(400);
    const edit = await autor("PUT", f.pfad, {
      revision,
      definition: { ...f.definition, name: "Privater neuer Entwurf" },
    });
    expect(edit.json()).toMatchObject({ entwurf: 2, aktiv: 1, pruefung: null });
    expect((await fragen(1)).json().antwort.stand).toBe("belegt");
    expect((await leser("GET", f.api)).body).not.toContain("Privater neuer Entwurf");
    expect(
      (await autor("POST", `${f.pfad}/zurueckziehen`, { revision: edit.json().revision })).json()
        .aktiv,
    ).toBeNull();
    expect((await fragen(1)).statusCode).toBe(404);
  });
  it("bucht fehlgeschlagene Prüffälle ohne Freigabe und entfernt unveröffentlichte Entwürfe nur mit passender Revision", async () => {
    const zweiter = await autor("PUT", f.pfad, {
      revision: 1,
      definition: { ...f.definition, beispiele: [] },
    });
    expect(zweiter.json()).toMatchObject({ entwurf: 2, revision: 2 });
    expect((await autor("POST", `${f.pfad}/pruefen`, { revision: 2 })).statusCode).toBe(400);
    const beispiele = f.definition.beispiele.map((b, i) =>
      i < 2 ? { ...b, erwartet: i === 0 ? "widerspruch" : "belegt" } : b,
    );
    await autor("PUT", f.pfad, { revision: 2, definition: { ...f.definition, beispiele } });
    const fehler = await autor("POST", `${f.pfad}/pruefen`, { revision: 3 });
    expect(fehler.json().pruefung.bestanden).toBe(false);
    expect(
      (await autor("POST", `${f.pfad}/freigeben`, { revision: 4, version: 3 })).statusCode,
    ).toBe(409);
    expect((await autor("DELETE", f.pfad, { revision: 1 })).statusCode).toBe(409);
    expect((await autor("DELETE", f.pfad, { revision: 4 })).statusCode).toBe(204);
    expect((await autor("GET", f.pfad)).statusCode).toBe(404);
  });
  it("nimmt Verlust von Teamrechten während der Antwort vor der Auslieferung wahr", async () => {
    await freigabe();
    const original = s.ko.get.bind(s.ko);
    vi.spyOn(s.ko, "get").mockImplementationOnce(async (id) => {
      await s.teams.lege({ ...f.team, version: 2, mitglieder: [f.autor.id] });
      return original(id);
    });
    const result = await leser("POST", `${f.pfad}/fragen`, { version: 1, frage: f.aussage });
    expect(result.statusCode, result.body).toBe(404);
    expect(result.body).not.toContain(f.aussage);
  });
  it("hält geänderte Quellenfassungen zurück und gibt sie erst nach neuer, ausdrücklich veröffentlichter Entwurfsnummer frei", async () => {
    const revision = await freigabe();
    const original = await s.ko.get(f.ko.id);
    if (!original) throw new Error("Quelle fehlt.");
    // The source need not change its answer; the approved source version itself must be pinned.
    const lese = s.ko.get.bind(s.ko);
    vi.spyOn(s.ko, "get").mockImplementation(async (id) =>
      id === f.ko.id ? { ...original, version: original.version + 1 } : lese(id),
    );
    const frage = (version: number) =>
      leser("POST", `${f.pfad}/fragen`, { version, frage: f.aussage });
    expect((await frage(1)).json().antwort).toMatchObject({ stand: "offen", quellen: [] });
    expect((await autor("POST", `${f.pfad}/freigeben`, { revision, version: 1 })).json()).toEqual({
      error: "QUELLEN_GEAENDERT",
    });
    const neu = await autor("POST", `${f.pfad}/pruefen`, { revision });
    expect(neu.json()).toMatchObject({
      entwurf: 2,
      aktiv: 1,
      pruefung: { version: 2, bestanden: true },
    });
    expect((await frage(1)).json().antwort.stand).toBe("offen");
    const frei = await autor("POST", `${f.pfad}/freigeben`, {
      revision: neu.json().revision,
      version: 2,
    });
    expect(frei.json()).toMatchObject({ entwurf: 2, aktiv: 2, freigegebeneVersionen: [1, 2] });
    expect((await frage(2)).json().antwort).toMatchObject({
      stand: "belegt",
      quellen: [{ version: original.version + 1 }],
    });
    expect(
      (
        await autor("POST", `${f.pfad}/freigeben`, { revision: frei.json().revision, version: 1 })
      ).json(),
    ).toEqual({ error: "QUELLEN_GEAENDERT" });
  });
});
