// ================================================================================================
// ADMIN-07 · SPACES VERWALTEN — DER DRAHT (produkt:20261007:spaces:admin-20261009).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp`, Speicherablage). Alle Konten, Teams, Spaces und Inhalte
// sind erfundene Testdaten dieses Falls; es gibt keine Kennwörter ausser dem Testkennwort der
// isolierten Bühne.
//
// LIEFERBELEG (Auftrag): zwei Spaces, zwei Teams, direkter und geerbter Zugang, derselbe Beitrag in
// zwei erlaubten Ansichten; Rechteentzug, Verschieben und Bestandszuordnung.
//
//   Lea    (experte)    — zuständig für „Werkstatt Nord"
//   Erik   (experte)    — Autor; in „Werkstatt Nord" ÜBER TEAM „Messtechnik" (schreiben),
//                         in „Labor" DIREKT (lesen)
//   Vera   (viewer)     — in „Labor" ÜBER TEAM „Qualitätszirkel" (lesen); NICHT in „Werkstatt Nord"
//   Carla  (controller) — zuständig für „Labor"; direkt in „Werkstatt Nord" (lesen)
//   Fritz  (experte)    — in keinem Space: der Unberechtigte
//   Admin  (admin)      — Kontoverwaltung, in keinem Space (kein Rollen-Durchgriff)
//
// Zuordnung zu den Originalkriterien:
//   K1 · Übersicht: Zweck, Zuständigkeit, Mitgliederzahl, Status, Gruppe, Regeln; Gruppe ≠ Ordner.
//   K2 · Zugriff je Person mit Herkunft (direkt / Team / zuständig) und Wirkung; derselbe Artikel
//        (Kennung + Fassung) in der zweiten erlaubten Ansicht.
//   K3 · Unberechtigte: Suche, direkter Link, Anhang, Vorschau-/Folgenauskunft, Export, Bilanz.
//   K4 · Spacewechsel: Regeln vorher/nachher in der Vorschau; Historie, Autorschaft, Beziehungen,
//        Kennung bleiben.
//   K5 · Archivieren: Lese-/Schreibwirkung, offene Aufgaben, Sperre bei offenen
//        Verantwortungsfragen, Begründung im Verlauf, Wiederaufnahme.
//   K6 · Bestandszuordnung: Bilanz, keine Sichterweiterung, Ausnahmen, dokumentiertes Protokoll.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const WORT = "Lehrdornkalibrierung";
const AUSSAGE = `Die ${WORT} läuft vor jeder Schicht am Referenzring.`;
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@admin07.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@admin07.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@admin07.test", "experte"],
    ["Erik Experte", "erik@admin07.test", "experte"],
    ["Vera Viewer", "vera@admin07.test", "viewer"],
    ["Carla Controller", "carla@admin07.test", "controller"],
    ["Fritz Fremd", "fritz@admin07.test", "experte"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    admin,
    lea: await anmelden(app, "lea@admin07.test"),
    erik: await anmelden(app, "erik@admin07.test"),
    vera: await anmelden(app, "vera@admin07.test"),
    carla: await anmelden(app, "carla@admin07.test"),
    fritz: await anmelden(app, "fritz@admin07.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    admin: id("Ada Admin"),
    lea: id("Lea Leitung"),
    erik: id("Erik Experte"),
    vera: id("Vera Viewer"),
    carla: id("Carla Controller"),
    fritz: id("Fritz Fremd"),
  };
  for (const [name, wert] of Object.entries(ids)) {
    expect(wert, `Konto ${name}`).not.toBe("");
  }
  return { app, services, k, ids };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function lies(b: Buehne, kopf: Kopf, url: string) {
  return b.app.inject({ method: "GET", url, headers: kopf });
}

async function schicke(b: Buehne, kopf: Kopf, url: string, payload: unknown, method = "POST") {
  return b.app.inject({ method: method as "POST", url, headers: kopf, payload: payload as object });
}

async function teamAnlegen(b: Buehne, name: string, mitglieder: string[]): Promise<string> {
  const res = await schicke(b, b.k.admin, "/api/teams", {
    name,
    zweck: `${name} (fiktiv).`,
    verantwortlich: b.ids.admin,
    mitglieder,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/** Zwei Spaces, zwei Teams, direkter und geerbter Zugang — der Lieferbeleg des Auftrags. */
async function lieferbeleg(b: Buehne) {
  const mess = await teamAnlegen(b, "Messtechnik", [b.ids.erik]);
  const qz = await teamAnlegen(b, "Qualitätszirkel", [b.ids.vera]);
  const werkstatt = await schicke(b, b.k.carla, "/api/spaces", {
    name: "Werkstatt Nord",
    zweck: "Prüfmittel und Arbeitsanweisungen der Werkstatt Nord.",
    verantwortlich: b.ids.lea,
    zugang: "mitglieder",
    mitglieder: [{ nutzer: b.ids.carla, recht: "lesen" }],
    teams: [{ team: mess, recht: "schreiben" }],
    ansichten: [],
    gruppe: "Produktion",
    regeln: "Nur freigegebene Arbeitsanweisungen; Prüfung durch die Werkstattleitung.",
  });
  expect(werkstatt.statusCode, werkstatt.body).toBe(201);
  const labor = await schicke(b, b.k.carla, "/api/spaces", {
    name: "Labor",
    zweck: "Kalibrierung und Messmittelfreigabe.",
    verantwortlich: b.ids.carla,
    zugang: "mitglieder",
    mitglieder: [{ nutzer: b.ids.erik, recht: "lesen" }],
    teams: [{ team: qz, recht: "lesen" }],
    ansichten: [{ name: "Prüfmittel", tag: "pruefmittel" }],
    gruppe: "Qualität",
  });
  expect(labor.statusCode, labor.body).toBe(201);
  return {
    mess,
    qz,
    werkstatt: werkstatt.json() as { id: string; version: number },
    labor: labor.json() as { id: string; version: number; ansichten: { id: string }[] },
  };
}

async function artikelAnlegen(b: Buehne, kopf: Kopf, titel: string, tags: string[]) {
  const res = await schicke(b, kopf, "/api/kos", {
    confidentiality: "intern",
    title: titel,
    statement: AUSSAGE,
    type: "best_practice",
    category: "Prüfmittel",
    tags,
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function verschieben(b: Buehne, kopf: Kopf, koId: string, zielSpaceId: string | null) {
  const v = await schicke(b, kopf, "/api/spaces/verschiebung/vorschau", { koId, zielSpaceId });
  expect(v.statusCode, v.body).toBe(200);
  const p = v.json();
  const res = await schicke(b, kopf, "/api/spaces/verschiebung", {
    koId,
    zielSpaceId,
    basis: {
      quelleId: p.quelle?.id ?? null,
      quelleVersion: p.quelle?.version ?? null,
      zielId: p.ziel?.id ?? null,
      zielVersion: p.ziel?.version ?? null,
    },
  });
  return { vorschau: p, res };
}

describe("K1 · Verwaltungsübersicht mit Zweck, Zuständigkeit, Mitgliederzahl, Status, Gruppe, Regeln", () => {
  it("die Liste trägt alles für Suche/Filter; nach Neuladen (neue Anfrage) unverändert", async () => {
    const b = await buehne();
    const { werkstatt, labor } = await lieferbeleg(b);
    const liste = (await lies(b, b.k.admin, "/api/spaces")).json();
    expect(liste.darfBestandZuordnen).toBe(true);
    const w = liste.spaces.find((s: { id: string }) => s.id === werkstatt.id);
    expect(w).toMatchObject({
      name: "Werkstatt Nord",
      zweck: "Prüfmittel und Arbeitsanweisungen der Werkstatt Nord.",
      verantwortlich: b.ids.lea,
      verantwortlichName: "Lea Leitung",
      gruppe: "Produktion",
      regeln: "Nur freigegebene Arbeitsanweisungen; Prüfung durch die Werkstattleitung.",
      archiviert: false,
      vorgang: "angelegt",
      // Carla direkt + Erik über Team „Messtechnik".
      mitgliederZahl: 2,
      // Der Admin verwaltet, liest aber nicht.
      eigenesRecht: "verwalten",
      darfInhalteLesen: false,
    });
    const l = liste.spaces.find((s: { id: string }) => s.id === labor.id);
    expect(l).toMatchObject({ gruppe: "Qualität", mitgliederZahl: 2, archiviert: false });

    // Wer nicht verwaltet, bekommt die Bestandszuordnung nicht angeboten.
    expect((await lies(b, b.k.erik, "/api/spaces")).json().darfBestandZuordnen).toBe(false);
  });

  it("eine Gruppe ist ein Etikett, kein Ordnerpfad; Regeln sind Teil der Fassung", async () => {
    const b = await buehne();
    const ordner = await schicke(b, b.k.carla, "/api/spaces", {
      name: "Unterordner",
      zweck: "Darf keine Ordnerebene vortäuschen.",
      verantwortlich: b.ids.carla,
      gruppe: "Produktion/Werkstatt",
    });
    expect(ordner.statusCode).toBe(400);
    expect(ordner.json().error).toBe("SPACE_UNGUELTIG");

    const { werkstatt } = await lieferbeleg(b);
    const space = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json().space;
    const neu = await schicke(
      b,
      b.k.lea,
      `/api/spaces/${werkstatt.id}`,
      { ...space, regeln: "Neue Regel: jede Anweisung trägt ein Prüfdatum." },
      "PUT",
    );
    expect(neu.statusCode, neu.body).toBe(200);
    const danach = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json();
    expect(danach.space.regeln).toContain("Prüfdatum");
    expect(danach.fassungen.map((f: { vorgang: string }) => f.vorgang)).toEqual([
      "angelegt",
      "geaendert",
    ]);
    const beleg = await b.services.audit.list({ action: "space.geaendert", target: werkstatt.id });
    expect(beleg.at(-1)?.payload).toMatchObject({ regelnGeaendert: true });
  });
});

describe("K2 · Herkunft und Wirkung der Rechte; dieselbe Objekt-ID in der zweiten Ansicht", () => {
  it("direkte und Teamrechte stehen je Person getrennt mit ihrer Wirkung", async () => {
    const b = await buehne();
    const { werkstatt, labor } = await lieferbeleg(b);

    const w = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}/zugriff`)).json();
    const person = (id: string) =>
      (w.personen as { nutzer: string; wege: unknown[]; wirksam: string }[]).find(
        (p) => p.nutzer === id,
      );
    expect(person(b.ids.lea)).toMatchObject({
      wirksam: "zustaendig",
      wege: [{ art: "zustaendig", recht: "schreiben" }],
    });
    expect(person(b.ids.erik)).toMatchObject({
      wirksam: "schreiben",
      wege: [{ art: "team", recht: "schreiben", teamName: "Messtechnik" }],
    });
    expect(person(b.ids.carla)).toMatchObject({
      wirksam: "lesen",
      wege: [{ art: "direkt", recht: "lesen" }],
    });
    // Wer keinen Weg hat, steht nicht in der Liste — auch nicht der Admin.
    expect(person(b.ids.vera)).toBeUndefined();
    expect(person(b.ids.admin)).toBeUndefined();

    const l = (await lies(b, b.k.carla, `/api/spaces/${labor.id}/zugriff`)).json();
    const imLabor = (id: string) =>
      (l.personen as { nutzer: string; wege: { art: string }[] }[]).find((p) => p.nutzer === id);
    expect(imLabor(b.ids.erik)?.wege.map((x) => x.art)).toEqual(["direkt"]);
    expect(imLabor(b.ids.vera)?.wege.map((x) => x.art)).toEqual(["team"]);

    // Wer den Space nicht sehen darf, erfährt auch die Zugriffsliste nicht.
    expect((await lies(b, b.k.fritz, `/api/spaces/${werkstatt.id}/zugriff`)).statusCode).toBe(404);
  });

  it("derselbe Beitrag in zwei erlaubten Ansichten: gleiche Kennung und Fassung, keine Kopie", async () => {
    const b = await buehne();
    const { werkstatt, labor } = await lieferbeleg(b);
    const koId = await artikelAnlegen(b, b.k.erik, `${WORT} Messplatz`, ["pruefmittel"]);
    const { res } = await verschieben(b, b.k.erik, koId, werkstatt.id);
    expect(res.statusCode, res.body).toBe(200);
    const soll = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();

    const ansicht = labor.ansichten[0]?.id ?? "";
    const imSpace = (await lies(b, b.k.erik, `/api/spaces/${werkstatt.id}/artikel`)).json();
    const inAnsicht = (
      await lies(b, b.k.erik, `/api/spaces/${labor.id}/artikel?ansicht=${ansicht}`)
    ).json();
    for (const zeilen of [imSpace.artikel, inAnsicht.artikel]) {
      expect(zeilen).toEqual([
        expect.objectContaining({ id: koId, version: soll.version, spaceId: werkstatt.id }),
      ]);
    }
    const alle = (await lies(b, b.k.erik, "/api/kos")).json() as { title: string }[];
    expect(alle.filter((x) => x.title.includes(WORT))).toHaveLength(1);

    // Vera ist über ihr Team im Labor, nicht in der Werkstatt: die Ansicht gibt ihr NICHTS.
    const vera = await lies(b, b.k.vera, `/api/spaces/${labor.id}/artikel?ansicht=${ansicht}`);
    expect(vera.statusCode).toBe(200);
    expect(vera.json().artikel).toEqual([]);
    expect(vera.body).not.toContain(WORT);
  });

  it("Rechteentzug: Teambindung gelöst → Zugriff und Herkunft verschwinden ab der nächsten Anfrage", async () => {
    const b = await buehne();
    const { werkstatt } = await lieferbeleg(b);
    const koId = await artikelAnlegen(b, b.k.erik, `${WORT} Entzug`, []);
    await verschieben(b, b.k.erik, koId, werkstatt.id);
    expect((await lies(b, b.k.erik, `/api/kos/${koId}`)).statusCode).toBe(200);

    const space = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json().space;
    const ohneTeam = await schicke(
      b,
      b.k.lea,
      `/api/spaces/${werkstatt.id}`,
      { ...space, teams: [] },
      "PUT",
    );
    expect(ohneTeam.statusCode, ohneTeam.body).toBe(200);
    expect((await lies(b, b.k.erik, `/api/kos/${koId}`)).statusCode).toBe(404);
    const w = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}/zugriff`)).json();
    expect(w.personen.map((p: { nutzer: string }) => p.nutzer)).not.toContain(b.ids.erik);
    // Autorschaft und Fassung bleiben; nur der Zugang ist weg.
    const gelesen = (await lies(b, b.k.lea, `/api/kos/${koId}`)).json();
    expect(gelesen.author).toBe(b.ids.erik);
  });
});

describe("K3 · Unberechtigte bekommen weder Inhalt noch geschützten Titel", () => {
  it("Suche, direkter Link, Anhang, Export (alle Formate), Archiv- und Bestandsauskunft", async () => {
    const b = await buehne();
    const { werkstatt } = await lieferbeleg(b);
    // Ein Anhang, den Erik hochlädt und an seinen Artikel hängt.
    const up = await schicke(b, b.k.erik, "/api/objects", {
      name: "lehrdorn.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    });
    expect(up.statusCode, up.body).toBe(201);
    const objectId = up.json().id as string;
    const koId = await artikelAnlegen(b, b.k.erik, `${WORT} Anhang`, ["pruefmittel"]);
    const attach = await schicke(
      b,
      b.k.erik,
      `/api/kos/${koId}`,
      { action: "attach", attachment: { name: "lehrdorn.png", mime: "image/png", objectId } },
      "PUT",
    );
    expect(attach.statusCode, attach.body).toBe(200);
    // Der Export trägt nur validierte Objekte — Testvorbereitung über den Dienst.
    await b.services.ko.setValidationState(koId, { trust: 90, status: "validiert" });

    // KALIBRIERUNG: ohne Space sieht Fritz Artikel und Export-Eintrag.
    const vorher = await lies(b, b.k.fritz, "/api/library/export");
    expect(vorher.body, "ohne Space muss der Export ihn tragen").toContain(koId);

    const { res } = await verschieben(b, b.k.erik, koId, werkstatt.id);
    expect(res.statusCode, res.body).toBe(200);

    for (const [wer, kopf] of [
      ["Fritz", b.k.fritz],
      ["Admin", b.k.admin],
    ] as const) {
      for (const url of [
        `/api/library/search?q=${WORT}`,
        "/api/kos",
        `/api/kos/${koId}`,
        `/api/kos/${koId}/versions`,
        `/api/spaces/kontext/artikel/${koId}`,
        `/api/objects/${objectId}`,
        `/api/objects/${objectId}/raw`,
        "/api/library/export",
        "/api/library/export?format=markdown",
        "/api/library/export?format=mediawiki",
        "/api/library/export?format=html",
      ]) {
        const r = await lies(b, kopf, url);
        expect(r.body, `${wer} ${url}`).not.toContain(WORT);
        expect(r.body, `${wer} ${url}`).not.toContain("Referenzring");
        if (url.startsWith("/api/kos/") || url.startsWith("/api/objects/")) {
          expect(r.statusCode, `${wer} ${url}`).toBe(404);
        }
      }
    }
    // Die Archivfolgen, die der Admin sehen darf, nennen den offenen Artikel nur als Zahl.
    const archivVorschau = `/api/spaces/${werkstatt.id}/archivierung/vorschau`;
    const folgen = await schicke(b, b.k.admin, archivVorschau, {});
    expect(folgen.statusCode, folgen.body).toBe(200);
    // Der Artikel zählt mit — sein Titel steht nirgends in der Antwort.
    expect(folgen.json().artikel.gesamt).toBe(1);
    expect(folgen.body).not.toContain(WORT);
    // Fritz bekommt sie gar nicht (404 — er sieht den Space nicht).
    expect((await schicke(b, b.k.fritz, archivVorschau, {})).statusCode).toBe(404);

    // KALIBRIERUNG: ein Mitglied bekommt Artikel, Anhang und Export-Eintrag.
    expect((await lies(b, b.k.carla, `/api/kos/${koId}`)).statusCode).toBe(200);
    expect((await lies(b, b.k.carla, `/api/objects/${objectId}`)).statusCode).toBe(200);
    expect((await lies(b, b.k.carla, "/api/library/export")).body).toContain(koId);
  });
});

describe("K4 · Spacewechsel zeigt Rechte UND Regeln vorher; Identität bleibt", () => {
  it("Vorschau nennt die Regeln beider Seiten; Historie, Autorschaft, Beziehungen bleiben", async () => {
    const b = await buehne();
    const { werkstatt, labor } = await lieferbeleg(b);
    const koId = await artikelAnlegen(b, b.k.erik, `${WORT} Wechsel`, []);
    const nachbar = await artikelAnlegen(b, b.k.erik, `${WORT} Nachbar`, []);
    const version = async (id: string) =>
      ((await lies(b, b.k.erik, `/api/kos/${id}`)).json() as { version: number }).version;
    // Beziehungen setzt die Kuratierung (`ko.relate`: controller, admin) — hier Carla.
    const kante = await schicke(b, b.k.carla, `/api/kos/${koId}/beziehungen`, {
      zielId: nachbar,
      art: "ergaenzt",
      richtung: "ungerichtet",
      beitragSchluessel: "admin07-wechsel-nachbar",
      gesehen: { quelleVersion: await version(koId), zielVersion: await version(nachbar) },
    });
    expect(kante.statusCode, kante.body).toBe(201);
    await verschieben(b, b.k.erik, koId, werkstatt.id);
    const vorher = (await lies(b, b.k.erik, `/api/kos/${koId}`)).json();
    const beziehungenVorher = await lies(b, b.k.erik, `/api/kos/${koId}/beziehungen`);
    expect(beziehungenVorher.body, "KALIBRIERUNG: die Beziehung steht").toContain(nachbar);

    // Den Wechsel Werkstatt → Labor führt Lea aus: zuständig in der Werkstatt, und im Labor
    // bekommt sie dafür direktes Schreibrecht.
    const laborSpace = (await lies(b, b.k.carla, `/api/spaces/${labor.id}`)).json().space;
    const lea = await schicke(
      b,
      b.k.carla,
      `/api/spaces/${labor.id}`,
      {
        ...laborSpace,
        mitglieder: [...laborSpace.mitglieder, { nutzer: b.ids.lea, recht: "schreiben" }],
      },
      "PUT",
    );
    expect(lea.statusCode, lea.body).toBe(200);

    const { vorschau, res } = await verschieben(b, b.k.lea, koId, labor.id);
    expect(vorschau.regeln.quelle).toMatchObject({
      zugang: "mitglieder",
      regeln: "Nur freigegebene Arbeitsanweisungen; Prüfung durch die Werkstattleitung.",
      verantwortlich: b.ids.lea,
      verantwortlichName: "Lea Leitung",
    });
    expect(vorschau.regeln.ziel).toMatchObject({
      zugang: "mitglieder",
      regeln: null,
      verantwortlichName: "Carla Controller",
    });
    expect(res.statusCode, res.body).toBe(200);

    const nachher = (await lies(b, b.k.lea, `/api/kos/${koId}`)).json();
    expect(nachher.id).toBe(koId);
    expect(nachher.spaceId).toBe(labor.id);
    expect(nachher.version).toBe(vorher.version);
    expect(nachher.author).toBe(vorher.author);
    expect(nachher.originalAuthor).toBe(vorher.originalAuthor);
    expect(nachher.history).toEqual(vorher.history);
    // Die Beziehung hängt an der Kennung, nicht am Space: Erik (liest im Labor) sieht sie weiter.
    const beziehungenNachher = await lies(b, b.k.erik, `/api/kos/${koId}/beziehungen`);
    expect(beziehungenNachher.statusCode).toBe(200);
    expect(beziehungenNachher.body).toContain(nachbar);
  });
});

describe("K5 · Archivieren erklärt Folgen, sperrt bei offener Verantwortung, Wiederaufnahme ist nachvollziehbar", () => {
  it("Folgen → Begründung → archiviert; danach Lesen ja, Schreiben nein; Wiederaufnahme im Verlauf", async () => {
    const b = await buehne();
    const { werkstatt, labor } = await lieferbeleg(b);
    const koId = await artikelAnlegen(b, b.k.erik, `${WORT} Archiv`, []);
    await verschieben(b, b.k.erik, koId, werkstatt.id);

    const v = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivierung/vorschau`, {});
    expect(v.statusCode, v.body).toBe(200);
    const folgen = v.json();
    // Lesen bleibt für Lea, Carla, Erik; Schreiben entfällt für Lea (zuständig) und Erik (Team).
    expect(folgen.leserBleiben).toBe(3);
    expect(folgen.schreibenEntfaellt.map((p: { name: string }) => p.name)).toEqual([
      "Erik Experte",
      "Lea Leitung",
    ]);
    expect(folgen.artikel).toMatchObject({ gesamt: 1, offen: 1 });
    expect(folgen.artikel.offenSichtbar[0]).toMatchObject({ id: koId });
    expect(folgen.verantwortungsfragen).toEqual([]);
    expect(folgen.darfArchivieren).toBe(true);

    // Nicht still: ohne Begründung, ohne Vorschau oder mit veralteter Vorschau wird nichts geschrieben.
    const ohneGrund = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivieren`, {
      version: folgen.version,
      grundlage: folgen.grundlage,
    });
    expect(ohneGrund.statusCode).toBe(400);
    expect(ohneGrund.json().error).toBe("BEGRUENDUNG_FEHLT");
    const ohneVorschau = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivieren`, {
      version: folgen.version,
      begruendung: "Werkstatt Nord zieht um.",
    });
    expect(ohneVorschau.statusCode).toBe(400);
    // Ein Mitglied ohne Zuständigkeit darf nicht archivieren.
    const erik = await schicke(b, b.k.erik, `/api/spaces/${werkstatt.id}/archivieren`, {
      version: folgen.version,
      grundlage: folgen.grundlage,
      begruendung: "Fremd.",
    });
    expect(erik.statusCode).toBe(403);

    const ok = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivieren`, {
      version: folgen.version,
      grundlage: folgen.grundlage,
      begruendung: "Werkstatt Nord zieht um.",
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ archiviert: true, vorgang: "archiviert" });

    // Lesen bleibt, Schreiben nicht: kein Verschieben hinein oder heraus, keine Pflege.
    expect((await lies(b, b.k.carla, `/api/kos/${koId}`)).statusCode).toBe(200);
    const heraus = await verschieben(b, b.k.lea, koId, null);
    expect(heraus.vorschau.darfAusfuehren).toBe(false);
    expect(heraus.res.statusCode).toBe(403);
    const neu = await artikelAnlegen(b, b.k.erik, `${WORT} Neu`, []);
    const hinein = await schicke(b, b.k.erik, "/api/spaces/verschiebung/vorschau", {
      koId: neu,
      zielSpaceId: werkstatt.id,
    });
    expect(hinein.json().darfAusfuehren).toBe(false);
    const kontext = (await lies(b, b.k.erik, `/api/spaces/kontext/artikel/${neu}`)).json();
    expect(kontext.ziele.map((z: { id: string }) => z.id)).not.toContain(werkstatt.id);
    const space = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json();
    const pflege = await schicke(
      b,
      b.k.lea,
      `/api/spaces/${werkstatt.id}`,
      { ...space.space, zweck: "Geändert im Archiv." },
      "PUT",
    );
    expect(pflege.statusCode).toBe(409);
    expect(pflege.json().error).toBe("SPACE_ARCHIVIERT");

    // Verschwindet nicht: in Liste und Detail mit Status; Verlauf mit Begründung.
    const liste = (await lies(b, b.k.admin, "/api/spaces")).json();
    expect(
      liste.spaces.find((s: { id: string }) => s.id === werkstatt.id)?.archiviert,
      "der archivierte Space steht weiter in der Übersicht",
    ).toBe(true);
    expect(space.fassungen.at(-1)).toMatchObject({
      vorgang: "archiviert",
      begruendung: "Werkstatt Nord zieht um.",
      geaendertVonName: "Lea Leitung",
    });
    // Zugriffsherkunft im Archiv: alle Wege nur noch lesend.
    const zugriff = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}/zugriff`)).json();
    expect(
      zugriff.personen.flatMap((p: { wege: { recht: string }[] }) => p.wege.map((w) => w.recht)),
    ).not.toContain("schreiben");

    // Wiederaufnahme: Begründung Pflicht; danach gelten Rechte wieder.
    const wieder = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/wiederaufnehmen`, {
      version: space.space.version,
      begruendung: "Umzug abgesagt.",
    });
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json()).toMatchObject({ archiviert: false, vorgang: "wiederaufgenommen" });
    const verlauf = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json().fassungen;
    expect(verlauf.map((f: { vorgang: string }) => f.vorgang)).toEqual([
      "angelegt",
      "archiviert",
      "wiederaufgenommen",
    ]);
    expect(verlauf.at(-1).begruendung).toBe("Umzug abgesagt.");
    const wiederRaus = await verschieben(b, b.k.erik, koId, labor.id);
    // Erik schreibt in der Werkstatt wieder (Team), im Labor liest er nur: der Grund ist das Ziel.
    expect(wiederRaus.vorschau.grund).toBe("Für den Zielspace fehlt das Schreibrecht.");
    const belege = await b.services.audit.list({ target: werkstatt.id });
    expect(belege.map((e) => e.action)).toEqual(
      expect.arrayContaining(["space.archiviert", "space.wiederaufgenommen"]),
    );
  });

  it("offene Verantwortungsfrage sperrt das Archivieren — der Space bleibt aktiv", async () => {
    const b = await buehne();
    const { werkstatt } = await lieferbeleg(b);
    const koId = await artikelAnlegen(b, b.k.erik, `${WORT} Verantwortung`, []);
    await verschieben(b, b.k.erik, koId, werkstatt.id);
    // Die Artikelverantwortung geht an Fritz — er hat keinen Zugang zur Werkstatt.
    const owner = await schicke(
      b,
      b.k.carla,
      `/api/kos/${koId}`,
      { action: "ownership", ownership: { owner: b.ids.fritz } },
      "PUT",
    );
    expect(owner.statusCode, owner.body).toBe(200);

    const folgen = (
      await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivierung/vorschau`, {})
    ).json();
    expect(folgen.verantwortungsfragen).toEqual([
      expect.objectContaining({ art: "verantwortung_ohne_zugang", anzahl: 1 }),
    ]);
    expect(folgen.darfArchivieren).toBe(false);
    const versuch = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivieren`, {
      version: folgen.version,
      grundlage: folgen.grundlage,
      begruendung: "Trotzdem archivieren.",
    });
    expect(versuch.statusCode).toBe(409);
    expect(versuch.json().error).toBe("OFFENE_VERANTWORTUNG");
    const danach = (await lies(b, b.k.lea, `/api/spaces/${werkstatt.id}`)).json();
    expect(danach.space.archiviert).toBe(false);
    expect(danach.fassungen).toHaveLength(1);

    // Zwischen Vorschau und Bestätigung ändert sich die Lage → neue Folgen statt Archiv.
    const zurueck = await schicke(
      b,
      b.k.carla,
      `/api/kos/${koId}`,
      { action: "ownership", ownership: { owner: b.ids.erik } },
      "PUT",
    );
    expect(zurueck.statusCode, zurueck.body).toBe(200);
    const veraltet = await schicke(b, b.k.lea, `/api/spaces/${werkstatt.id}/archivieren`, {
      version: folgen.version,
      grundlage: folgen.grundlage,
      begruendung: "Mit alter Vorschau.",
    });
    expect(veraltet.statusCode).toBe(409);
    expect(veraltet.json().error).toBe("VORSCHAU_VERALTET");
    expect(veraltet.json().vorschau.darfArchivieren).toBe(true);
  });
});

describe("K6 · Bestandszuordnung ohne Sichterweiterung, mit Bilanz, Ausnahmen und Protokoll", () => {
  it("Bilanz vorher; zugeordnet wird nur, was niemandem mehr Sicht gibt; alles dokumentiert", async () => {
    const b = await buehne();
    const { werkstatt, labor } = await lieferbeleg(b);
    const passend = await artikelAnlegen(b, b.k.erik, `${WORT} Bestand A`, ["bestand-werkstatt"]);
    const mehrdeutig = await artikelAnlegen(b, b.k.erik, `${WORT} Bestand B`, [
      "bestand-werkstatt",
      "bestand-labor",
    ]);
    // Vera ist Autorin, aber nicht in der Werkstatt: sie verlöre den Zugang → Ausnahme.
    const autorin = await artikelAnlegen(b, b.k.lea, `${WORT} Bestand C`, ["bestand-werkstatt"]);
    const owner = await schicke(
      b,
      b.k.carla,
      `/api/kos/${autorin}`,
      { action: "ownership", ownership: { owner: b.ids.vera } },
      "PUT",
    );
    expect(owner.statusCode, owner.body).toBe(200);
    const ohneRegel = await artikelAnlegen(b, b.k.erik, `${WORT} Bestand D`, ["sonstiges"]);
    const schon = await artikelAnlegen(b, b.k.erik, `${WORT} Bestand E`, ["bestand-werkstatt"]);
    await verschieben(b, b.k.erik, schon, werkstatt.id);
    const fritzVorher = (await lies(b, b.k.fritz, `/api/kos/${passend}`)).statusCode;
    expect(fritzVorher, "KALIBRIERUNG: ohne Space sieht Fritz den Artikel").toBe(200);

    const regeln = [
      { tag: "bestand-werkstatt", zielSpaceId: werkstatt.id },
      { tag: "bestand-labor", zielSpaceId: labor.id },
    ];
    // Nur die Kontoverwaltung.
    expect((await schicke(b, b.k.lea, "/api/spaces/bestand/vorschau", { regeln })).statusCode).toBe(
      403,
    );
    const v = await schicke(b, b.k.admin, "/api/spaces/bestand/vorschau", { regeln });
    expect(v.statusCode, v.body).toBe(200);
    const plan = v.json();
    // Die Bilanz geht auf: jeder Artikel ohne Space ist zuordenbar, Ausnahme oder ohne Regel.
    // (Absolute Zahlen nur für die Fälle dieses Tests — ein vorhandener Grundbestand zählt mit.)
    expect(plan.bilanz).toMatchObject({ zuordenbar: 1, ausnahmen: 2 });
    expect(plan.bilanz.ohneSpace).toBe(
      plan.bilanz.zuordenbar + plan.bilanz.ausnahmen + plan.bilanz.ohneRegel,
    );
    expect(plan.bilanz.ohneRegel).toBeGreaterThanOrEqual(1);
    expect(plan.bilanz.gesamt).toBe(plan.bilanz.ohneSpace + plan.bilanz.bereitsZugeordnet);
    expect(plan.bilanz.bereitsZugeordnet).toBeGreaterThanOrEqual(1);
    expect(plan.zuordnungen.map((z: { koId: string }) => z.koId)).toEqual([passend]);
    // Eine Zuordnung schränkt ein (Fritz u. a. verlieren), erweitert nie.
    expect(plan.zuordnungen[0].verlieren).toBeGreaterThan(0);
    const art = (id: string) =>
      (plan.ausnahmen as { koId: string; art: string }[]).find((a) => a.koId === id)?.art;
    expect(art(mehrdeutig)).toBe("mehrdeutig");
    expect(art(autorin)).toBe("verantwortung_verliert");
    expect(art(ohneRegel)).toBeUndefined();

    // Ein unbekannter Zielspace wird abgelehnt (archivierte ebenso, s. pruefeBestandsRegeln).
    const ungueltig = await schicke(b, b.k.admin, "/api/spaces/bestand/vorschau", {
      regeln: [{ tag: "x", zielSpaceId: "gibt-es-nicht" }],
    });
    expect(ungueltig.statusCode).toBe(400);

    // Ohne bestätigte Bilanz nichts; mit ihr genau die angekündigten Zuordnungen.
    expect(
      (await schicke(b, b.k.admin, "/api/spaces/bestand/zuordnung", { regeln })).statusCode,
    ).toBe(400);
    const zu = await schicke(b, b.k.admin, "/api/spaces/bestand/zuordnung", {
      regeln,
      grundlage: plan.grundlage,
    });
    expect(zu.statusCode, zu.body).toBe(200);
    expect(zu.json().zugeordnet).toEqual([{ koId: passend, zielSpaceId: werkstatt.id }]);
    expect(zu.json().bilanz).toMatchObject({ zugeordnet: 1, fehlgeschlagen: 0, ausnahmen: 2 });

    // Wirkung: Fritz verliert den Zugang; Autor und Mitglieder behalten ihn; die Ausnahmen bleiben ohne Space.
    expect((await lies(b, b.k.fritz, `/api/kos/${passend}`)).statusCode).toBe(404);
    const a = (await lies(b, b.k.erik, `/api/kos/${passend}`)).json();
    expect(a.spaceId).toBe(werkstatt.id);
    expect(a.author).toBe(b.ids.erik);
    for (const id of [mehrdeutig, autorin, ohneRegel]) {
      expect((await lies(b, b.k.fritz, `/api/kos/${id}`)).statusCode, id).toBe(200);
    }

    // Prüfbar nach Reload: das Protokoll nennt Regeln, Bilanz, Zuordnungen und Ausnahmen.
    const prot = (await lies(b, b.k.admin, "/api/spaces/bestand/protokoll")).json();
    expect(prot.laeufe).toHaveLength(1);
    expect(prot.laeufe[0]).toMatchObject({
      wer: b.ids.admin,
      zugeordnet: [{ koId: passend, zielSpaceId: werkstatt.id }],
      bilanz: { zugeordnet: 1, ausnahmen: 2 },
    });
    expect(prot.laeufe[0].ausnahmen.map((x: { art: string }) => x.art).sort()).toEqual([
      "mehrdeutig",
      "verantwortung_verliert",
    ]);
    expect(JSON.stringify(prot), "das Protokoll trägt keine Titel").not.toContain(WORT);
    const wechsel = await b.services.audit.list({ action: "ko.space-changed", target: passend });
    expect(wechsel).toHaveLength(1);
    // Ein zweiter Lauf mit derselben Bilanz-Grundlage gilt nicht mehr (der Bestand hat sich bewegt).
    const nochmal = await schicke(b, b.k.admin, "/api/spaces/bestand/zuordnung", {
      regeln,
      grundlage: plan.grundlage,
    });
    expect(nochmal.statusCode).toBe(409);
    expect((await lies(b, b.k.lea, "/api/spaces/bestand/protokoll")).statusCode).toBe(403);
  });
});
