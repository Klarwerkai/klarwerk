import { GenericContainer, Wait } from "testcontainers";
import { expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgWorkflowLaeufe } from "../../services/app/src/teamworkflow-laeufe-repo";
import { TeamworkflowLaufDienst } from "../../services/app/src/teamworkflow-lauf";
import { PgTeamworkflowRepo } from "../../services/app/src/teamworkflows";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { anfrage } from "../teamassistenten/aufbau";
import { workflowUmfeld } from "./definition-fixture";

it("weist eine bereits vorbereitete Fachbuchung zurück, wenn vor dem atomaren Schreibzugriff ein Quellenkonflikt entsteht", async () => {
  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "workflow-synthetic", POSTGRES_DB: "workflow_conflict" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  const pool = createPool(
    `postgresql://postgres:workflow-synthetic@${container.getHost()}:${container.getMappedPort(5432)}/workflow_conflict`,
  );
  const schliessen = poolAbschluss(pool);
  try {
    await migrate(pool);
    const s = buildPgServices(pool);
    const original = new PgWorkflowLaeufe(pool);
    let kurzVorBuchung: (() => Promise<void>) | undefined;
    const laufdienst = new TeamworkflowLaufDienst(
      {
        lesen: (id) => original.lesen(id),
        fuerWorkflow: (id) => original.fuerWorkflow(id),
        offeneWissensvorschlaege: (ids) => original.offeneWissensvorschlaege(ids),
        async speichern(lauf, basis, bindung) {
          if (kurzVorBuchung) {
            const einfuegen = kurzVorBuchung;
            kurzVorBuchung = undefined;
            await einfuegen();
          }
          return original.speichern(lauf, basis, bindung);
        },
      },
      s.teamworkflows,
      s.teamassistenten,
      async () => undefined,
    );
    const app = buildApp({ ...s, workflowLaeufe: laufdienst });
    try {
      const f = await workflowUmfeld(s, app);
      const chef = anfrage(app, f.autor.token);
      const zweites = await s.ko.create({
        title: "Übergabe",
        statement: "Handover requires a record.",
        type: "technik",
        category: "Service",
        author: f.autor.id,
        confidentiality: "intern",
      });
      await s.ko.setValidationState(zweites.id, { trust: 90, status: "validiert" });
      const a = (await chef("GET", f.assistentPfad)).json();
      const d = await chef("PUT", f.assistentPfad, {
        revision: a.revision,
        definition: { ...a.definition, quellen: [f.ko.id, zweites.id] },
      });
      const t = await chef("POST", `${f.assistentPfad}/pruefen`, {
        revision: d.json().revision,
        sprache: "en",
      });
      const frei = await chef("POST", `${f.assistentPfad}/freigeben`, {
        revision: t.json().revision,
        version: 2,
      });
      expect(frei.statusCode, frei.body).toBe(200);
      const workflow = await chef("POST", f.api, {
        teamId: f.team.id,
        definition: {
          ...f.definition,
          schritte: f.definition.schritte.map((s) =>
            s.typ === "assistent" ? { ...s, version: 2 } : s,
          ),
        },
      });
      const pfad = `${f.api}/${workflow.json().id}`;
      const test = await chef("POST", `${pfad}/pruefen`, { revision: 1, sprache: "en" });
      const w = await chef("POST", `${pfad}/freigeben`, {
        revision: test.json().revision,
        version: 1,
      });
      expect(w.statusCode, w.body).toBe(200);
      const neu = await chef("POST", `${pfad}/laeufe`, {
        version: 1,
        vorgang: "wiederanlauf",
        fall: f.aussage,
      });
      expect(neu.statusCode, neu.body).toBe(200);
      const lauf = `${pfad}/laeufe/${neu.json().id}`;
      const frage = await chef("POST", `${lauf}/weiter`, { revision: 1, aktion: "weiter" });
      expect(frage.json(), frage.body).toMatchObject({ index: 1, revision: 2 });
      const entscheidung = await chef("POST", `${lauf}/weiter`, {
        revision: 2,
        aktion: "annehmen",
      });
      expect(entscheidung.json(), entscheidung.body).toMatchObject({
        index: 2,
        revision: 3,
        ergebnisse: [],
      });
      kurzVorBuchung = async () => {
        await s.conflicts.create(
          {
            type: "truth",
            koA: f.ko.id,
            koB: zweites.id,
            description: "Offener Widerspruch vor Buchung",
          },
          f.autor.id,
        );
      };
      const buchung = await chef("POST", `${lauf}/weiter`, { revision: 3, aktion: "weiter" });
      expect(buchung.statusCode, buchung.body).toBe(409);
      expect(kurzVorBuchung).toBeUndefined();
      const stand = await original.lesen(neu.json().id);
      expect(stand).toMatchObject({ revision: 3, index: 2, ergebnisse: [] });
      expect(stand?.verlauf.map((s) => s.typ)).toEqual(["start", "assistent", "annehmen"]);
      expect((await chef("GET", lauf)).json()).toMatchObject({
        stand: "angehalten",
        grund: "GRUNDLAGE_GEAENDERT",
        verlauf: [],
      });
      const definitionen = new PgTeamworkflowRepo(pool);
      const bestand = await definitionen.lesen(workflow.json().id);
      const publiziert = bestand?.freigaben.at(-1);
      if (!bestand || !publiziert)
        throw new Error("Erwartete veröffentlichte Workflowfassung fehlt.");
      const genommen = await definitionen.speichern(
        { ...bestand, revision: bestand.revision + 1 },
        bestand.revision,
        f.team.version,
        { id: f.autor.id, role: "experte" },
        publiziert,
      );
      expect(genommen).toBe(false);
      expect((await definitionen.lesen(bestand.id))?.revision).toBe(bestand.revision);
    } finally {
      await app.close();
    }
  } finally {
    await schliessen();
    await container.stop();
  }
}, 90000);
