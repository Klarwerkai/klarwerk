// ================================================================================================
// R-1133 — JEDER ENTWURF BEKOMMT EINEN TECHNISCHEN INDEX, UND ER FOLGT DEM GESPEICHERTEN STAND.
// ================================================================================================
//
// Gemessen am HTTP-Weg, den die Oberfläche geht, und an der Ablage, in der der Index liegt:
//
//   E1  Anlage indiziert: Titel, Aussage, Kategorie, Schlagwort, Bildunterschrift, sichtbarer Text.
//   E2  Speichern zieht den Index auf den neuen Stand — der alte Inhalt ist aus dem Index weg.
//   E3  Ein abgewiesener (veralteter) Schreibversuch erzeugt keinen Index; eine verspätete
//       Ableitung eines älteren Stands überschreibt den neueren nicht.
//   E4  Ein scheiternder Indexlauf blockiert das Speichern nicht; der Abgleich zieht nach.
//   E5  Altbestand ohne Index: der Abgleich zieht ihn nach, ein zweiter Lauf ist ein No-op, und der
//       Entwurf selbst bleibt Zeichen für Zeichen derselbe.
//   E6  Die Duplikatsfrage über den Index — mit unveränderten Rechten.
//   E7  Papierkorb, Wiederherstellen, endgültiges Löschen: keine verwaisten, keine falschen Treffer.
//   E8  Einreichen: der Entwurfsindex geht, das offene Wissensobjekt trägt seinen eigenen Index
//       (Suchprojektion) — als prüfbarer Eintrag, ohne automatische Validierung.
//   E9  Ein zurückgehaltener Indexschreibvorgang hält weder die Anlage noch weitere Änderungen
//       unter der Entwurfssperre auf (Dienst und HTTP); nach dem Öffnen gilt der letzte Stand.
import { describe, expect, it } from "vitest";
import {
  type AppServices,
  assembleServices,
  buildApp,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import { CaptureService, type Draft, InMemoryDraftRepo } from "../../services/capture";
import {
  ENTWURFS_INDEX_FASSUNG,
  type EntwurfsIndex,
  entwurfsIndexVon,
} from "../../services/capture/src/entwurfs-index";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup(ablage?: InMemoryDraftRepo) {
  const repos = inMemoryRepos();
  const drafts = ablage ?? (repos.drafts as InMemoryDraftRepo);
  const services: AppServices = assembleServices({ ...repos, drafts });
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@index.test", password: "geheim12345" },
  });
  const admin = await login(app, "admin@index.test");
  for (const email of ["anna@index.test", "bodo@index.test"]) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name: email, email, password: "geheim12345", role: "experte" },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    services,
    drafts,
    // Die Indexarbeit läuft entkoppelt vom Speicherweg (BEN, Nacharbeit 4). Wer den Index LIEST,
    // wartet sie ausdrücklich ab — der Speicherweg tut das nie (E9).
    fertig: () => services.capture.indexArbeitAbgeschlossen(),
    anna: await login(app, "anna@index.test"),
    bodo: await login(app, "bodo@index.test"),
  };
}

const INHALT = {
  title: "Kompressor K8 starten",
  statement: "Vor dem Start Ölstand prüfen.",
  type: "best_practice",
  category: "Anlage 4",
  tags: ["Druckluft"],
  confidentiality: "intern",
  bodyHtml:
    "<p>Der Ölstand steht am Schauglas.</p><script>geheimesSkriptwort()</script>" +
    '<figure><img src="x" alt="Schauglas"><figcaption>Schauglas links</figcaption></figure>',
};

async function anlegen(app: App, auth: Auth, payload: Record<string, unknown> = INHALT) {
  const res = await app.inject({ method: "POST", url: "/api/drafts", headers: auth, payload });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as Draft;
}

async function gleicherInhalt(app: App, auth: Auth, id: string) {
  const res = await app.inject({
    method: "GET",
    url: `/api/drafts/${id}/gleicher-inhalt`,
    headers: auth,
  });
  return {
    status: res.statusCode,
    body: res.body,
    json: res.json() as { indexStatus: string; entwuerfe: { id: string; titel: string }[] },
  };
}

describe("R-1133 · der technische Index des Entwurfs folgt dem gespeicherten Stand", () => {
  it("E1 · die Anlage indiziert alle Inhaltsfelder — und nur sichtbaren Text", async () => {
    const { app, drafts, anna, fertig } = await setup();
    const draft = await anlegen(app, anna);
    await fertig();

    const index = await drafts.entwurfsIndexVon(draft.id);
    expect(index).toBeDefined();
    expect(index?.fassung).toBe(ENTWURFS_INDEX_FASSUNG);
    expect(index?.stand).toBe(draft.updatedAt);
    expect(index?.status).toBe("vollstaendig");
    for (const wort of [
      "Kompressor K8",
      "Ölstand prüfen",
      "Anlage 4",
      "Druckluft",
      "Schauglas links",
    ]) {
      expect(index?.text, wort).toContain(wort);
    }
    expect(index?.text).toContain("Der Ölstand steht am Schauglas.");
    // Unsichtbares ist kein Inhalt — dieselbe Regel wie in der KO-Projektion.
    expect(index?.text).not.toContain("geheimesSkriptwort");
    // Der Index ist eine Ableitung des gespeicherten Entwurfs, keine zweite Fassung davon.
    expect(index).toEqual(entwurfsIndexVon((await drafts.findById(draft.id)) as Draft));
    // Kein Antwortfeld hat sich geändert: der Index steht neben dem Entwurf, nicht in ihm.
    expect(draft).not.toHaveProperty("index");
    expect(draft).not.toHaveProperty("technischerIndex");
    expect(await drafts.offeneEntwurfsIndizes(10)).toEqual([]);
  });

  it("E2 · Speichern zieht den Index auf den neuen Stand — alter Inhalt ist aus dem Index weg", async () => {
    const { app, drafts, anna, fertig } = await setup();
    const draft = await anlegen(app, anna);
    await fertig();
    const vorher = (await drafts.entwurfsIndexVon(draft.id)) as EntwurfsIndex;

    const res = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers: anna,
      payload: { title: "Verdichter V2 anfahren", expectedUpdatedAt: draft.updatedAt },
    });
    expect(res.statusCode, res.body).toBe(200);
    const neu = res.json() as Draft;
    await fertig();

    const nachher = (await drafts.entwurfsIndexVon(draft.id)) as EntwurfsIndex;
    expect(nachher.stand).toBe(neu.updatedAt);
    expect(nachher.stand).not.toBe(vorher.stand);
    expect(nachher.inhaltsHash).not.toBe(vorher.inhaltsHash);
    expect(nachher.text).toContain("Verdichter V2 anfahren");
    expect(nachher.text).not.toContain("Kompressor K8");
  });

  it("E3 · ein abgewiesener Schreibversuch und eine verspätete Ableitung lassen den Index stehen", async () => {
    const { app, drafts, anna, fertig } = await setup();
    const draft = await anlegen(app, anna);
    const zweiter = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers: anna,
      payload: { title: "Neuer Titel", expectedUpdatedAt: draft.updatedAt },
    });
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    await fertig();
    const aktuell = (await drafts.entwurfsIndexVon(draft.id)) as EntwurfsIndex;

    // Der zweite Tab mit dem ALTEN Stand: 409, nichts geschrieben — auch kein Index.
    const veraltet = await app.inject({
      method: "PUT",
      url: `/api/drafts/${draft.id}`,
      headers: anna,
      payload: { title: "Veralteter Titel", expectedUpdatedAt: draft.updatedAt },
    });
    expect(veraltet.statusCode, veraltet.body).toBe(409);
    await fertig();
    expect(await drafts.entwurfsIndexVon(draft.id)).toEqual(aktuell);

    // Eine verspätete Ableitung des ersten Stands kommt nicht durch.
    expect(await drafts.setzeEntwurfsIndex(draft.id, entwurfsIndexVon(draft))).toBe(false);
    expect(await drafts.entwurfsIndexVon(draft.id)).toEqual(aktuell);
    expect(aktuell.text).toContain("Neuer Titel");
  });

  it("E4 · ein scheiternder Indexlauf blockiert das Speichern nicht — der Abgleich zieht nach", async () => {
    class StoerrigeAblage extends InMemoryDraftRepo {
      stoert = true;
      override setzeEntwurfsIndex(id: string, index: EntwurfsIndex): Promise<boolean> {
        if (this.stoert) {
          return Promise.reject(new Error("Indexablage nicht erreichbar"));
        }
        return super.setzeEntwurfsIndex(id, index);
      }
    }
    const ablage = new StoerrigeAblage();
    const capture = new CaptureService({ repo: ablage });

    const draft = await capture.createDraft(
      { title: "Pumpe P3", statement: "Dichtung tauschen." },
      "anna",
    );
    expect(await capture.getDraft(draft.id)).toEqual(draft);
    const gespeichert = await capture.continueDraft(
      draft.id,
      { statement: "Dichtung prüfen." },
      "anna",
    );
    expect(gespeichert.payload.statement).toBe("Dichtung prüfen.");
    // Abgewartet, damit „kein Index" heisst: der Lauf ist GESCHEITERT — nicht nur noch nicht dran.
    await capture.indexArbeitAbgeschlossen();
    expect(await ablage.entwurfsIndexVon(draft.id)).toBeUndefined();
    expect(await ablage.offeneEntwurfsIndizes(10)).toEqual([draft.id]);

    ablage.stoert = false;
    expect(await capture.gleicheEntwurfsIndexAb()).toEqual({ nachgezogen: 1, offenDanach: 0 });
    expect((await ablage.entwurfsIndexVon(draft.id))?.stand).toBe(gespeichert.updatedAt);
    expect((await ablage.entwurfsIndexVon(draft.id))?.text).toContain("Dichtung prüfen.");
  });

  it("E5 · Altbestand: einmal nachgezogen, danach No-op — der Entwurf selbst bleibt unverändert", async () => {
    const ablage = new InMemoryDraftRepo();
    const capture = new CaptureService({ repo: ablage });
    const alt: Draft = {
      id: "alt-1",
      payload: { title: "Altentwurf", statement: "Vor dem Index geschrieben." },
      originalAuthor: "anna",
      lastEditor: "anna",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    };
    await ablage.insert(alt);
    expect(await ablage.offeneEntwurfsIndizes(10)).toEqual(["alt-1"]);

    expect(await capture.gleicheEntwurfsIndexAb()).toEqual({ nachgezogen: 1, offenDanach: 0 });
    expect(await capture.gleicheEntwurfsIndexAb()).toEqual({ nachgezogen: 0, offenDanach: 0 });
    expect(await ablage.findById("alt-1")).toEqual(alt);
    expect((await ablage.entwurfsIndexVon("alt-1"))?.stand).toBe(alt.updatedAt);
  });

  it("E6 · die Duplikatsfrage nutzt den Index — und zeigt nur, was der Fragende sehen darf", async () => {
    const { app, anna, bodo, fertig } = await setup();
    const eins = await anlegen(app, anna);
    const zwei = await anlegen(app, anna);
    const anderer = await anlegen(app, anna, { ...INHALT, title: "Etwas anderes" });
    const fremd = await anlegen(app, bodo);
    await fertig();

    const fuerAnna = await gleicherInhalt(app, anna, eins.id);
    expect(fuerAnna.status, fuerAnna.body).toBe(200);
    expect(fuerAnna.json.indexStatus).toBe("vollstaendig");
    // Bodos privater Entwurf mit demselben Inhalt erscheint nicht — auch nicht als Zahl.
    expect(fuerAnna.json.entwuerfe).toEqual([{ id: zwei.id, titel: INHALT.title }]);
    expect(fuerAnna.body).not.toContain(fremd.id);
    expect(fuerAnna.body).not.toContain(anderer.id);

    const fuerBodo = await gleicherInhalt(app, bodo, fremd.id);
    expect(fuerBodo.json.entwuerfe).toEqual([]);
    // Und einen fremden privaten Entwurf kann Bodo gar nicht erst befragen.
    expect((await gleicherInhalt(app, bodo, eins.id)).status).toBe(403);
  });

  it("E7 · Papierkorb blendet aus, Wiederherstellen bringt zurück, endgültiges Löschen nimmt den Index mit", async () => {
    const { app, drafts, anna, fertig } = await setup();
    const eins = await anlegen(app, anna);
    const zwei = await anlegen(app, anna);
    await fertig();

    const loeschen = await app.inject({
      method: "DELETE",
      url: `/api/drafts/${zwei.id}`,
      headers: anna,
    });
    expect(loeschen.statusCode, loeschen.body).toBe(204);
    expect((await gleicherInhalt(app, anna, eins.id)).json.entwuerfe).toEqual([]);
    expect(await drafts.offeneEntwurfsIndizes(10)).toEqual([]);

    const zurueck = await app.inject({
      method: "POST",
      url: `/api/drafts/${zwei.id}/restore`,
      headers: anna,
    });
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    await fertig();
    expect((await gleicherInhalt(app, anna, eins.id)).json.entwuerfe.map((e) => e.id)).toEqual([
      zwei.id,
    ]);

    await app.inject({ method: "DELETE", url: `/api/drafts/${zwei.id}`, headers: anna });
    const endgueltig = await app.inject({
      method: "DELETE",
      url: `/api/drafts/trash/${zwei.id}`,
      headers: anna,
    });
    expect(endgueltig.statusCode, endgueltig.body).toBe(204);
    expect(await drafts.restore(zwei.id)).toBeUndefined();
    expect(await drafts.entwurfsIndexVon(zwei.id)).toBeUndefined();
    expect((await gleicherInhalt(app, anna, eins.id)).json.entwuerfe).toEqual([]);
  });

  it("E8 · Einreichen: Entwurfsindex weg, das offene Objekt trägt seine Suchprojektion — nicht validiert", async () => {
    const { app, services, drafts, anna, fertig } = await setup();
    const eins = await anlegen(app, anna);
    const zwei = await anlegen(app, anna);
    await fertig();

    const promote = await app.inject({
      method: "POST",
      url: `/api/drafts/${zwei.id}/promote`,
      headers: anna,
    });
    expect(promote.statusCode, promote.body).toBe(201);
    await fertig();
    const ko = promote.json() as { id: string; status: string; trust: number };
    expect(ko.status).toBe("offen");
    expect(ko.trust).toBe(0);

    // Der verbrauchte Entwurf trägt keinen Index mehr und taucht als Dublette nicht mehr auf.
    expect(await drafts.entwurfsIndexVon(zwei.id)).toBeUndefined();
    expect((await gleicherInhalt(app, anna, eins.id)).json.entwuerfe).toEqual([]);

    // Der prüfbare Eintrag: das offene Wissensobjekt hat seinen technischen Index (G27).
    const projektion = await services.ko.searchProjectionOf(ko.id);
    expect(projektion?.koVersion).toBe(1);
    expect(projektion?.titleText).toBe(INHALT.title);
    expect(projektion?.bodyText).toContain("Der Ölstand steht am Schauglas.");
    expect((await services.ko.get(ko.id))?.status).toBe("offen");
  });

  // BEN, Nacharbeit 4: „Mit einem gezielt zurückgehaltenen Indexschreibvorgang nachweisen, dass
  // Speicherung und weitere Änderungen unabhängig davon abschließen." Das Tor hält JEDEN
  // Indexschreibvorgang an, bis der Fall es öffnet — vorher darf keiner fertig sein.
  it("E9 · ein zurückgehaltener Indexschreibvorgang hält weder Speichern noch weitere Änderungen auf", async () => {
    class ZurueckhaltendeAblage extends InMemoryDraftRepo {
      gehalten = 0;
      private freigabe: () => void = () => undefined;
      private readonly tor = new Promise<void>((weiter) => {
        this.freigabe = weiter;
      });
      oeffne(): void {
        this.freigabe();
      }
      override async setzeEntwurfsIndex(id: string, index: EntwurfsIndex): Promise<boolean> {
        this.gehalten += 1;
        await this.tor;
        return super.setzeEntwurfsIndex(id, index);
      }
    }
    const naechsteRunde = () => new Promise((weiter) => setTimeout(weiter, 0));

    // (1) Der Dienst: Anlage und zwei Änderungen unter der Entwurfssperre schliessen ab.
    const ablage = new ZurueckhaltendeAblage();
    const capture = new CaptureService({ repo: ablage });
    const erster = await capture.createDraft({ title: "Ventil V1", statement: "Erster." }, "anna");
    const zweiter = await capture.continueDraft(erster.id, { statement: "Zweiter." }, "anna", {
      expectedUpdatedAt: erster.updatedAt,
    });
    const dritter = await capture.continueDraft(erster.id, { statement: "Dritter." }, "anna", {
      expectedUpdatedAt: zweiter.updatedAt,
    });
    expect((await capture.getDraft(erster.id))?.payload.statement).toBe("Dritter.");
    await naechsteRunde();
    // Alle drei Indexschreibvorgänge stehen am Tor — und keiner hat etwas geschrieben.
    expect(ablage.gehalten).toBe(3);
    expect(await ablage.entwurfsIndexVon(erster.id)).toBeUndefined();

    ablage.oeffne();
    await capture.indexArbeitAbgeschlossen();
    // Standbindung erhalten: nur der Index des zuletzt gespeicherten Stands wird wirksam.
    const index = await ablage.entwurfsIndexVon(erster.id);
    expect(index?.stand).toBe(dritter.updatedAt);
    expect(index?.text).toContain("Dritter.");
    expect(await ablage.offeneEntwurfsIndizes(10)).toEqual([]);

    // (2) Derselbe Nachweis am HTTP-Weg: 201 und 200, während das Tor geschlossen ist.
    const httpAblage = new ZurueckhaltendeAblage();
    const { app, anna, fertig } = await setup(httpAblage);
    const angelegt = await anlegen(app, anna);
    const geaendert = await app.inject({
      method: "PUT",
      url: `/api/drafts/${angelegt.id}`,
      headers: anna,
      payload: { title: "Geändert bei geschlossenem Tor", expectedUpdatedAt: angelegt.updatedAt },
    });
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    await naechsteRunde();
    expect(httpAblage.gehalten).toBe(2);
    expect(await httpAblage.entwurfsIndexVon(angelegt.id)).toBeUndefined();

    httpAblage.oeffne();
    await fertig();
    expect((await httpAblage.entwurfsIndexVon(angelegt.id))?.stand).toBe(
      (geaendert.json() as Draft).updatedAt,
    );
  });
});
