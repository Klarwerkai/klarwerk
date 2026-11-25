import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { anfrage, fachbereich } from "../teamassistenten/aufbau";

it("Beschaffung und Service veröffentlichen verschiedene Abläufe und führen sie mit demselben Teammitglied aus", async () => {
  const services = buildServices();
  const app = buildApp(services);
  try {
    const f = await fachbereich(services, app);
    const kollege = anfrage(app, f.leser.token);
    const service = {
      ...f.team,
      id: "kundendienst",
      name: "Kundendienst",
      verantwortlich: f.fremd.id,
      mitglieder: [f.fremd.id, f.leser.id],
    };
    expect(await services.teams.lege(service)).toBe(true);
    const bereiche = [
      {
        team: f.team,
        konto: f.autor,
        anderer: f.fremd,
        ausloeser: "Geänderte Einkaufsregel",
        quelle: "Unterschrift im Einkauf",
        regel: "Eine Bestellung braucht eine Unterschrift.",
        gegen: "Eine Bestellung braucht keine Unterschrift.",
        ergebnis: "Einkaufsvorgang dokumentiert",
      },
      {
        team: service,
        konto: f.fremd,
        anderer: f.autor,
        ausloeser: "Neue Serviceerfahrung",
        quelle: "Serviceeinsatz dokumentieren",
        regel: "Das Einsatzprotokoll benötigt eine Seriennummer.",
        gegen: "Das Einsatzprotokoll benötigt keine Seriennummer.",
        ergebnis: "Serviceerfahrung festgehalten",
      },
    ];
    for (const b of bereiche) {
      const autor = anfrage(app, b.konto.token);
      const fachfremd = anfrage(app, b.anderer.token);
      const artikel = await services.ko.create({
        title: b.quelle,
        statement: b.regel,
        type: "best_practice",
        category: b.team.name,
        author: b.konto.id,
        confidentiality: "intern",
      });
      const quelle = await services.ko.setValidationState(artikel.id, {
        trust: 92,
        status: "validiert",
      });
      const assistent = await autor("POST", "/api/teamassistenten", {
        teamId: b.team.id,
        definition: {
          name: b.quelle,
          aufgabe: b.ausloeser,
          quellen: [quelle.id],
          beispiele: [
            { frage: b.regel, erwartet: "belegt" },
            { frage: b.gegen, erwartet: "widerspruch" },
            { frage: "Welche Farbe haben die Stühle?", erwartet: "offen" },
          ],
        },
      });
      expect(assistent.statusCode, assistent.body).toBe(201);
      const a = assistent.json();
      const ap = `/api/teamassistenten/${a.id}`;
      const geprueft = await autor("POST", `${ap}/pruefen`, {
        revision: a.revision,
        sprache: "de",
      });
      expect(geprueft.json().pruefung.bestanden, geprueft.body).toBe(true);
      expect(
        (
          await autor("POST", `${ap}/freigeben`, {
            revision: geprueft.json().revision,
            version: a.entwurf,
          })
        ).statusCode,
      ).toBe(200);

      const workflow = await autor("POST", "/api/teamworkflows", {
        teamId: b.team.id,
        definition: {
          name: b.ausloeser,
          ausloeser: b.ausloeser,
          beispielfall: b.regel,
          schritte: [
            {
              typ: "assistent",
              titel: "Mit der Fachregel abgleichen",
              assistentId: a.id,
              version: a.entwurf,
              frage: "{{fall}}",
              erwartet: "belegt",
            },
            { typ: "entscheidung", titel: "Fachlich entscheiden", rolle: "verantwortlich" },
            { typ: "aktion", titel: b.ergebnis, aktion: "ergebnis_festhalten" },
          ],
        },
      });
      expect(workflow.statusCode, workflow.body).toBe(201);
      const w = workflow.json();
      const pfad = `/api/teamworkflows/${w.id}`;
      const probe = await autor("POST", `${pfad}/pruefen`, { revision: w.revision, sprache: "de" });
      expect(probe.json().pruefung.bestanden, probe.body).toBe(true);
      const frei = await autor("POST", `${pfad}/freigeben`, {
        revision: probe.json().revision,
        version: w.entwurf,
      });
      expect(frei.statusCode, frei.body).toBe(200);
      expect((await fachfremd("GET", pfad)).statusCode).toBe(404);

      const liste = await kollege("GET", `${pfad}/laeufe`);
      expect(liste.json().laeufe, liste.body).toEqual([]);
      const start = await kollege("POST", `${pfad}/laeufe`, {
        version: w.entwurf,
        fall: b.regel,
        vorgang: randomUUID(),
        sprache: "de",
      });
      expect([200, 201]).toContain(start.statusCode);
      const lp = `${pfad}/laeufe/${start.json().id}`;
      const fund = await kollege("POST", `${lp}/weiter`, {
        revision: start.json().revision,
        aktion: "weiter",
      });
      expect(fund.statusCode, fund.body).toBe(200);
      expect(fund.json().verlauf).toContainEqual(
        expect.objectContaining({
          typ: "assistent",
          assistentId: a.id,
          version: a.entwurf,
          antwort: expect.objectContaining({
            stand: "belegt",
            quellen: expect.arrayContaining([
              expect.objectContaining({ id: quelle.id, version: quelle.version }),
            ]),
          }),
        }),
      );
      expect(fund.json().aktionen).not.toContain("annehmen");
      const zustimmung = await autor("POST", `${lp}/weiter`, {
        revision: fund.json().revision,
        aktion: "annehmen",
      });
      expect(zustimmung.statusCode, zustimmung.body).toBe(200);
      const fertig = await autor("POST", `${lp}/weiter`, {
        revision: zustimmung.json().revision,
        aktion: "weiter",
      });
      expect(fertig.statusCode, fertig.body).toBe(200);
      expect(fertig.json()).toMatchObject({
        stand: "abgeschlossen",
        version: w.entwurf,
        ergebnisse: [{ titel: b.ergebnis, workflowVersion: w.entwurf }],
      });
      const zurueck = await kollege("GET", lp);
      expect(zurueck.json().ergebnisse).toEqual(fertig.json().ergebnisse);
      expect((await fachfremd("GET", lp)).statusCode).toBe(404);
    }
  } finally {
    await app.close();
  }
});
