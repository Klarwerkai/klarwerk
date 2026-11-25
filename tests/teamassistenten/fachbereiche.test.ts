import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { anfrage, fachbereich } from "./aufbau";

it("Service und Beschaffung veröffentlichen und verwenden ihre eigenen geprüften Regeln", async () => {
  const s = buildServices();
  const app = buildApp(s);
  try {
    const f = await fachbereich(s, app);
    const alsEinkauf = anfrage(app, f.autor.token);
    const alsService = anfrage(app, f.fremd.token);
    const alsKollege = anfrage(app, f.leser.token);
    const serviceTeam = {
      ...f.team,
      id: "team-service",
      name: "Service",
      verantwortlich: f.fremd.id,
      mitglieder: [f.fremd.id, f.leser.id],
    };
    expect(await s.teams.lege(serviceTeam)).toBe(true);

    async function entwurf(
      teamId: string,
      als: typeof alsService,
      author: string,
      name: string,
      quelle: string,
      regel: string,
      gegen: string,
    ) {
      const ko = await s.ko.create({
        title: quelle,
        statement: regel,
        type: "technik",
        category: name,
        author,
        confidentiality: "intern",
      });
      const validiert = await s.ko.setValidationState(ko.id, { trust: 92, status: "validiert" });
      const version = validiert.version;
      const neu = await als("POST", f.api, {
        teamId,
        definition: {
          name,
          aufgabe: quelle,
          quellen: [ko.id],
          beispiele: [
            { frage: regel, erwartet: "belegt" },
            { frage: gegen, erwartet: "widerspruch" },
            { frage: "Welche Farbe hat der Lieferwagen?", erwartet: "offen" },
          ],
        },
      });
      expect(neu.statusCode, neu.body).toBe(201);
      const { id, revision } = neu.json();
      const test = await als("POST", `${f.api}/${id}/pruefen`, { revision, sprache: "de" });
      expect(test.json().pruefung).toMatchObject({ bestanden: true });
      const aktiv = await als("POST", `${f.api}/${id}/freigeben`, {
        revision: test.json().revision,
        version: test.json().entwurf,
      });
      expect(aktiv.statusCode, aktiv.body).toBe(200);
      return { id, quelle: ko.id, version, regel };
    }
    const einkauf = await entwurf(
      f.team.id,
      alsEinkauf,
      f.autor.id,
      "Einkaufshilfe",
      "Freigabe von Angeboten",
      "Ein Angebot darf ohne Freigabe bestellt werden.",
      "Ein Angebot darf nicht ohne Freigabe bestellt werden.",
    );
    const service = await entwurf(
      serviceTeam.id,
      alsService,
      f.fremd.id,
      "Servicehilfe",
      "Serviceeinsatz beim Kunden",
      "Das Serviceprotokoll darf online ausgefüllt werden.",
      "Das Serviceprotokoll darf nicht online ausgefüllt werden.",
    );
    const liste = await alsKollege("GET", f.api);
    expect(
      liste
        .json()
        .assistenten.map((a: { id: string }) => a.id)
        .sort(),
    ).toEqual([einkauf.id, service.id].sort());
    for (const [assistent, anderer] of [
      [einkauf, service],
      [service, einkauf],
    ] as const) {
      const fragen = (frage: string) =>
        alsKollege("POST", `${f.api}/${assistent.id}/fragen`, { frage, version: 1, sprache: "de" });
      expect((await fragen(assistent.regel)).json()).toMatchObject({
        assistentId: assistent.id,
        version: 1,
        antwort: {
          stand: "belegt",
          quellen: [{ id: assistent.quelle, version: assistent.version }],
        },
      });
      expect((await fragen(anderer.regel)).json().antwort).toMatchObject({
        stand: "offen",
        quellen: [],
      });
    }
    expect((await alsEinkauf("GET", `${f.api}/${service.id}`)).statusCode).toBe(404);
    expect((await alsService("GET", `${f.api}/${einkauf.id}`)).statusCode).toBe(404);
  } finally {
    await app.close();
  }
});
