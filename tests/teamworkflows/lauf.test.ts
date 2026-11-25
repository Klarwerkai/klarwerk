import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { anfrage } from "../teamassistenten/aufbau";
import { workflowUmfeld } from "./definition-fixture";

describe("gemeinsam ausgeführte und wieder aufgenommene Teamvorgänge", () => {
  let s: ReturnType<typeof buildServices>;
  let app: ReturnType<typeof buildApp>;
  let f: Awaited<ReturnType<typeof workflowUmfeld>>;
  let chef: ReturnType<typeof anfrage>;
  let kollege: ReturnType<typeof anfrage>;
  let pfad: string;
  beforeEach(async () => {
    s = buildServices();
    app = buildApp(s);
    f = await workflowUmfeld(s, app);
    chef = anfrage(app, f.autor.token);
    kollege = anfrage(app, f.leser.token);
    const n = await chef("POST", f.api, { teamId: f.team.id, definition: f.definition });
    expect(n.statusCode, n.body).toBe(201);
    pfad = `${f.api}/${n.json().id}`;
    const p = await chef("POST", `${pfad}/pruefen`, { revision: 1, sprache: "en" });
    expect(p.json().pruefung.bestanden, p.body).toBe(true);
    const a = await chef("POST", `${pfad}/freigeben`, { revision: 2, version: 1 });
    expect(a.statusCode, a.body).toBe(200);
    expect((await chef("GET", `${pfad}/laeufe`)).json().laeufe).toHaveLength(0);
  });
  afterEach(() => app.close());
  async function start(vorgang = "vorgang-1", fall = f.aussage) {
    const l = await kollege("POST", `${pfad}/laeufe`, { version: 1, sprache: "en", vorgang, fall });
    expect(l.statusCode, l.body).toBe(200);
    return `${pfad}/laeufe/${l.json().id}`;
  }
  it("bindet die mitgesendete Fallbeschreibung und hält bei einem anderen fachlichen Urteil vor Entscheidung und Ergebnis", async () => {
    const l = await start("abweichung", f.aussage.replace("must not", "must"));
    const a = await kollege("POST", `${l}/weiter`, { revision: 1, aktion: "weiter" });
    expect(a.json(), a.body).toMatchObject({
      stand: "angehalten",
      index: 0,
      grund: "ASSISTENT_ERWARTUNG",
      ergebnisse: [],
      aktionen: [],
      verlauf: [
        { typ: "start" },
        { typ: "assistent", version: 1, antwort: { stand: "widerspruch" } },
      ],
    });
    expect(
      (await chef("POST", `${l}/weiter`, { revision: 2, aktion: "annehmen" })).statusCode,
    ).toBe(403);
    expect(
      (await kollege("POST", `${pfad}/laeufe`, { version: 1, vorgang: "ohne-fall" })).statusCode,
    ).toBe(400);
  });
  it("startet pro Schlüssel einmal, verbucht Entscheidung und Teambericht idempotent und weist ein anderes Anliegen unter derselben Kennung ab", async () => {
    const [l, z] = await Promise.all([start(), start()]);
    expect(l).toEqual(z);
    expect((await chef("GET", `${pfad}/laeufe`)).json().laeufe).toHaveLength(1);
    expect(
      (
        await kollege("POST", `${pfad}/laeufe`, {
          version: 1,
          sprache: "en",
          vorgang: "vorgang-1",
          fall: "other",
        })
      ).statusCode,
    ).toBe(409);
    const a = await kollege("POST", `${l}/weiter`, { revision: 1, aktion: "weiter" });
    expect(a.json()).toMatchObject({
      revision: 2,
      aktionen: [],
      zustaendig: f.autor.id,
      naechsteWirkung: { index: 2, titel: f.definition.schritte[2]?.titel },
      schritt: { typ: "entscheidung" },
    });
    expect(
      (await kollege("POST", `${l}/weiter`, { revision: 2, aktion: "annehmen" })).statusCode,
    ).toBe(403);
    expect(a.json().verlauf[0]).not.toHaveProperty("schrittTitel");
    expect(a.json().verlauf[1].schrittTitel).toBe(f.definition.schritte[0]?.titel);
    expect(a.json().namen).toEqual({ [f.autor.id]: "autorin", [f.leser.id]: "leser" });
    const cmds = await Promise.all(
      [1, 2].map(() => chef("POST", `${l}/weiter`, { revision: 2, aktion: "annehmen" })),
    );
    expect(cmds.map((c) => c.statusCode)).toEqual([200, 200]);
    expect(
      (await kollege("POST", `${l}/weiter`, { revision: 3, aktion: "weiter" })).statusCode,
    ).toBe(403);
    expect(
      (await chef("POST", `${l}/weiter`, { revision: 2, aktion: "ablehnen" })).statusCode,
    ).toBe(409);
    const festhalten = () => chef("POST", `${l}/weiter`, { revision: 3, aktion: "weiter" });
    const [e, noch] = await Promise.all([festhalten(), festhalten()]);
    expect(e.statusCode, e.body).toBe(200);
    expect(noch.statusCode, noch.body).toBe(200);
    expect(e.json().ergebnisse).toEqual(noch.json().ergebnisse);
    expect(e.json()).toMatchObject({
      stand: "abgeschlossen",
      revision: 4,
      ergebnisse: [
        { titel: f.definition.schritte[2]?.titel, workflowVersion: 1, schritte: [0, 1] },
      ],
    });
    expect(
      (await chef("POST", `${l}/weiter`, { revision: 2, aktion: "annehmen" })).json().revision,
    ).toBe(4);
    await s.teams.lege({ ...f.team, mitglieder: [f.autor.id], version: 2 });
    const mitAustritt = await chef("GET", l);
    expect(mitAustritt.json().namen).toEqual({ [f.autor.id]: "autorin" });
  });
  it("stellt die Rückfrage an die startende Person und hält die Ablehnung mit Begründung vor Fachwirkung fest", async () => {
    const l = await start();
    await kollege("POST", `${l}/weiter`, { revision: 1, aktion: "weiter" });
    expect(
      (await chef("POST", `${l}/weiter`, { revision: 2, aktion: "rueckfrage" })).statusCode,
    ).toBe(400);
    const q = await chef("POST", `${l}/weiter`, {
      revision: 2,
      aktion: "rueckfrage",
      notiz: "Welcher Auftrag?",
    });
    expect(q.json()).toMatchObject({
      stand: "rueckfrage",
      index: 1,
      revision: 3,
      zustaendig: f.leser.id,
      aktionen: [],
    });
    expect(
      (await chef("POST", `${l}/weiter`, { revision: 3, aktion: "antworten", notiz: "fremd" }))
        .statusCode,
    ).toBe(403);
    const a = await kollege("POST", `${l}/weiter`, {
      revision: 3,
      aktion: "antworten",
      notiz: "Auftrag A",
    });
    expect(a.json()).toMatchObject({
      stand: "laeuft",
      index: 1,
      revision: 4,
      zustaendig: f.autor.id,
    });
    const ablehnung = await chef("POST", `${l}/weiter`, {
      revision: 4,
      aktion: "ablehnen",
      notiz: "zurückziehen",
    });
    expect(ablehnung.json()).toMatchObject({ stand: "abgelehnt", ergebnisse: [], aktionen: [] });
    expect(
      ablehnung
        .json()
        .verlauf.slice(-3)
        .map((x: { notiz: string }) => x.notiz),
    ).toEqual(["Welcher Auftrag?", "Auftrag A", "zurückziehen"]);
  });
  it("sperrt den Verlauf einschließlich Fall, Notizen und Fundstellen bei Leserechtsentzug derselben Wissensfassung", async () => {
    const l = await start();
    const a = await kollege("POST", `${l}/weiter`, { revision: 1, aktion: "weiter" });
    expect(a.json().verlauf[1].antwort.quellen[0].id).toBe(f.ko.id);
    const zuvor = await s.ko.get(f.ko.id);
    const neu = await s.ko.setConfidentiality(f.ko.id, "streng_vertraulich", f.autor.id);
    expect(neu.version).toBe(zuvor?.version);
    const nicht = await kollege("GET", l);
    expect(nicht.json()).toMatchObject({
      stand: "angehalten",
      grund: "GRUNDLAGE_GEAENDERT",
      fall: "",
      verlauf: [],
      ergebnisse: [],
      aktionen: [],
      schritt: null,
    });
    expect(nicht.json()).not.toHaveProperty("namen");
    expect(nicht.body).not.toContain(f.ko.id);
    expect(nicht.body).not.toContain(f.aussage);
    expect(
      (await kollege("POST", `${pfad}/laeufe`, { version: 1, vorgang: "zweiter", fall: f.aussage }))
        .statusCode,
    ).toBe(409);
    await s.teams.lege({ ...f.team, mitglieder: [f.autor.id], version: 2 });
    expect((await kollege("GET", l)).statusCode).toBe(404);
  });
  it("behält den ursprünglichen Auslöser beim Fassungswechsel und schützt ihn nach Quellenentzug", async () => {
    const alt = await start();
    const ausloeser = "Neue Dienstanweisung";
    const bearbeitet = await chef("PUT", pfad, {
      revision: 3,
      definition: { ...f.definition, ausloeser },
    });
    expect(bearbeitet.statusCode, bearbeitet.body).toBe(200);
    const test = await chef("POST", `${pfad}/pruefen`, {
      revision: bearbeitet.json().revision,
      sprache: "de",
    });
    const frei = await chef("POST", `${pfad}/freigeben`, {
      revision: test.json().revision,
      version: 2,
    });
    expect(frei.statusCode, frei.body).toBe(200);
    const neu = await kollege("POST", `${pfad}/laeufe`, {
      version: 2,
      vorgang: "zweite-fassung",
      fall: f.aussage,
    });
    expect(neu.json()).toMatchObject({ version: 2, ausloeser });
    expect((await kollege("GET", alt)).json()).toMatchObject({
      version: 1,
      ausloeser: f.definition.ausloeser,
    });
    await s.ko.setConfidentiality(f.ko.id, "streng_vertraulich", f.autor.id);
    const gesperrt = await kollege("GET", alt);
    expect(gesperrt.json().stand).toBe("angehalten");
    expect(gesperrt.json()).not.toHaveProperty("ausloeser");
    expect(gesperrt.body).not.toContain(f.definition.ausloeser);
  });
  it("hält auch bei einem neuen ungeklärten Wahrheitskonflikt zwischen unveränderten gebundenen Wissensfassungen", async () => {
    const zweite = await s.ko.create({
      title: "Übergabe im Service",
      statement: "Handover requires a written record.",
      type: "best_practice",
      category: "Service",
      author: f.autor.id,
      confidentiality: "intern",
    });
    const zweiteFassung = await s.ko.setValidationState(zweite.id, {
      trust: 90,
      status: "validiert",
    });
    const a = (await chef("GET", f.assistentPfad)).json();
    const ersetzt = await chef("PUT", f.assistentPfad, {
      revision: a.revision,
      definition: { ...a.definition, quellen: [f.ko.id, zweite.id] },
    });
    expect(ersetzt.statusCode, ersetzt.body).toBe(200);
    const attest = await chef("POST", `${f.assistentPfad}/pruefen`, {
      revision: ersetzt.json().revision,
      sprache: "en",
    });
    const frei = await chef("POST", `${f.assistentPfad}/freigeben`, {
      revision: attest.json().revision,
      version: 2,
    });
    expect(frei.statusCode, frei.body).toBe(200);
    const quelle = await s.ko.get(f.ko.id);
    const neu = await chef("PUT", pfad, {
      revision: 3,
      definition: {
        ...f.definition,
        schritte: f.definition.schritte.map((s) =>
          s.typ === "assistent" ? { ...s, version: 2 } : s,
        ),
      },
    });
    const pruefung = await chef("POST", `${pfad}/pruefen`, {
      revision: neu.json().revision,
      sprache: "en",
    });
    const w = await chef("POST", `${pfad}/freigeben`, {
      revision: pruefung.json().revision,
      version: 2,
    });
    expect(w.statusCode, w.body).toBe(200);
    const l = await kollege("POST", `${pfad}/laeufe`, {
      version: 2,
      vorgang: "konflikt",
      fall: f.aussage,
    });
    const run = `${pfad}/laeufe/${l.json().id}`;
    expect(
      (await kollege("POST", `${run}/weiter`, { revision: 1, aktion: "weiter" })).json().index,
    ).toBe(1);
    await s.conflicts.create(
      {
        type: "truth",
        koA: f.ko.id,
        koB: zweite.id,
        description: "Anforderungen fachlich erneut prüfen.",
      },
      f.autor.id,
    );
    expect((await s.ko.get(f.ko.id))?.version).toBe(quelle?.version);
    expect((await s.ko.get(zweite.id))?.version).toBe(zweiteFassung.version);
    expect((await kollege("GET", run)).json()).toMatchObject({
      stand: "angehalten",
      grund: "GRUNDLAGE_GEAENDERT",
      verlauf: [],
      ergebnisse: [],
    });
    expect(
      (await chef("POST", `${run}/weiter`, { revision: 2, aktion: "annehmen" })).statusCode,
    ).toBe(409);
  });
  it("hält Altvorgänge bei zurückgezogener Assistentenfassung oder Workflowfreigabe ohne zusätzliche Buchung an", async () => {
    const l = await start();
    await kollege("POST", `${l}/weiter`, { revision: 1, aktion: "weiter" });
    expect(
      (await chef("POST", `${f.assistentPfad}/zurueckziehen`, { revision: 3 })).statusCode,
    ).toBe(200);
    expect(
      (await chef("POST", `${l}/weiter`, { revision: 2, aktion: "annehmen" })).statusCode,
    ).toBe(409);
    expect((await chef("GET", l)).json()).toMatchObject({
      revision: 2,
      stand: "angehalten",
      verlauf: [],
    });
    expect((await chef("POST", `${pfad}/zurueckziehen`, { revision: 3 })).statusCode).toBe(200);
    expect((await chef("GET", l)).statusCode).toBe(404);
  });
});
