// ================================================================================================
// ADMIN-05 · DER GEMEINSAME ÜBERGABEABLAUF AM DRAHT — Vorschau, Bestätigung, Teilfehler, Bilanz.
// ================================================================================================
//
// produkt:20261007:ownership-uebergabe:admin-20261009. Gemessen an der ECHTEN App (`buildApp` über
// `assembleServices(inMemoryRepos())`, Speicherablage). ISOLIERTER TEST, keine veröffentlichte
// Funktion. Alle Konten und Inhalte sind erfundene Testdaten dieses Falls:
//
//   Ada   (admin)      — Kontoverwaltung, führt den Ablauf aus
//   Paula (experte)    — scheidet aus. Bei ihr liegen: zwei Beiträge (einer freigegeben), ein
//                        vertraulicher Beitrag, ein Entwurf, eine offene Lücke, eine offene
//                        Prüfaufgabe — dazu Ausgeschlossenes: ein Entwurf im Papierkorb, eine
//                        geschlossene Lücke, eine erledigte Prüfaufgabe.
//   Nora  (experte)    — Nachfolgerin 1 (sieht Vertrauliches nicht, darf nicht prüfen)
//   Otto  (controller) — Nachfolger 2 (sieht Vertrauliches, darf prüfen)
//   Vera  (viewer)     — darf kein Wissen bearbeiten, also keine zulässige Nachfolgerin
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · EIN Ablauf trägt beide Umfänge (`gezielt` / `ausscheiden`) über dieselbe Zuteilung.
//   K2 · Vorschau mit zwei Nachfolgern: Pakete, Objekte, Anzahl, Ausgeschlossenes, Rechtewirkung;
//        bestätigbar erst bei vollständiger zulässiger Zuordnung — der Server erzwingt es (409).
//   K3 · Autorschaft, Historie und Freigabe bleiben; keine Neufreigabe, keine Rechteerweiterung.
//   K4 · Teilfehler nennt Übertragenes und Offenes; dieselbe Eingabe noch einmal holt genau den
//        Rest nach — keine Doppelzuordnung, keine verlorene Verantwortung.
//   K5 · Zugang endet nur ohne Restbestand; Vertretung steht in der Vorschau.
//   K6 · Bilanz und Protokoll nach „Neuladen" (neue Anfrage) lesbar; Vorschau/Abbruch ändern nichts.
import { afterEach, describe, expect, it, vi } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { responsibleOf } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";

interface Eintrag {
  art: string;
  id: string;
  titel: string | null;
  an: string;
  anName: string | null;
}
interface Offen extends Eintrag {
  grund: string;
  text: string;
}
interface Bilanz {
  beitraege: number;
  entwuerfe: number;
  luecken: number;
  pruefaufgaben: number;
}
interface Vorschau {
  vorher: Bilanz;
  prognose: Bilanz;
  pakete: {
    an: { id: string; name: string | null };
    anzahl: number;
    eintraege: Eintrag[];
    bereitsErledigt: number;
    wirkung: Record<string, number>;
  }[];
  abgelehnt: Offen[];
  nichtZugeteilt: { art: string; id: string }[];
  ausgeschlossen: {
    entwuerfe: { id: string }[];
    luecken: { id: string }[];
    pruefaufgaben: { koId: string }[];
  };
  zugang: { jetzt: string; entscheidung: string; danach: string };
  vertretung: { id: string }[];
  hindernisse: string[];
  bestaetigbar: boolean;
  unveraendert: string[];
}
interface Ergebnis {
  vorher: Bilanz;
  nachher: Bilanz;
  nachfolger: { an: string; beitraege: number; vorgaenge: number }[];
  uebertragen: Eintrag[];
  bereitsErledigt: Eintrag[];
  offen: Offen[];
  zugang: { vorher: string; nachher: string; beendet: boolean; grund: string | null };
  vollstaendig: boolean;
  protokolliert: boolean;
}

const NULL: Bilanz = { beitraege: 0, entwuerfe: 0, luecken: 0, pruefaufgaben: 0 };

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
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@ablauf.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "ada@ablauf.test");
  for (const [name, email, role] of [
    ["Paula Abgang", "paula@ablauf.test", "experte"],
    ["Nora Nachfolge", "nora@ablauf.test", "experte"],
    ["Otto Controller", "otto@ablauf.test", "controller"],
    ["Vera Viewer", "vera@ablauf.test", "viewer"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: KENNWORT, role },
    });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const liste = (await app.inject({ method: "GET", url: "/api/users", headers: admin })).json() as {
    id: string;
    name: string;
    role: string;
  }[];
  const id = (name: string): string => liste.find((k) => k.name === name)?.id ?? "";
  const ids = {
    ada: id("Ada Admin"),
    paula: id("Paula Abgang"),
    nora: id("Nora Nachfolge"),
    otto: id("Otto Controller"),
    vera: id("Vera Viewer"),
  };
  const k = {
    admin,
    paula: await anmelden(app, "paula@ablauf.test"),
    nora: await anmelden(app, "nora@ablauf.test"),
  };
  const anlegen = async (kopf: Kopf, titel: string, stufe = "intern"): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: stufe,
        title: titel,
        statement: `${titel}: wird vor jeder Schicht am Prüfplatz kontrolliert.`,
        type: "best_practice",
        category: "Prüfmittel",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    return res.json().id as string;
  };
  const ko = {
    a1: await anlegen(k.paula, "Drehmomentschlüssel Linie 1"),
    a2: await anlegen(k.paula, "Messschieber Linie 2"),
    v1: await anlegen(k.paula, "Kalibrierlabor Zugang", "vertraulich"),
    p1: await anlegen(admin, "Prüfplan Halle 3"),
    p2: await anlegen(admin, "Prüfplan Halle 4"),
  };
  // A1 ist freigegeben — die Freigabe muss die Übergabe überdauern (K3).
  await services.validation.adminValidate(ko.a1, ids.ada);
  // Offene Arbeit bei Paula — und, was als Geschichte bei ihr bleibt.
  const entwurf = (eid: string) => ({
    id: eid,
    payload: { title: `Entwurf ${eid}` },
    originalAuthor: ids.paula,
    lastEditor: ids.paula,
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-10-01T08:00:00.000Z",
  });
  await repos.drafts.insert(entwurf("d-offen"));
  await repos.drafts.insert(entwurf("d-papierkorb"));
  await repos.drafts.delete("d-papierkorb", ids.paula, "2026-10-02T08:00:00.000Z");
  const luecke = (gid: string, status: "offen" | "geschlossen") => ({
    id: gid,
    question: `Fiktive Frage ${gid}`,
    status,
    assignee: ids.paula,
    priority: "mittel" as const,
    createdAt: "2026-10-01T08:00:00.000Z",
  });
  await repos.gaps.insert(luecke("g-offen", "offen"));
  await repos.gaps.insert(luecke("g-zu", "geschlossen"));
  await services.validation.assign(ko.p1, [ids.paula], ids.ada);
  await repos.assignments.create({ koId: ko.p2, userId: ids.paula, status: "done" });
  return { app, repos, services, k, ids, ko };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

/** Die vollständige, zulässige Verteilung auf zwei Nachfolger. */
function vollePlanung(b: Buehne, zugang: "behalten" | "beenden" = "beenden") {
  return {
    person: b.ids.paula,
    umfang: "ausscheiden",
    beitraege: [
      { koId: b.ko.a1, an: b.ids.nora },
      { koId: b.ko.a2, an: b.ids.nora },
      { koId: b.ko.v1, an: b.ids.otto },
    ],
    vorgaenge: [
      { art: "entwurf", id: "d-offen", an: b.ids.nora },
      { art: "luecke", id: "g-offen", an: b.ids.otto },
      { art: "pruefaufgabe", id: b.ko.p1, an: b.ids.otto },
    ],
    zugang,
  };
}

function post(b: Buehne, url: string, payload: unknown, kopf: Kopf = b.k.admin) {
  return b.app.inject({ method: "POST", url, headers: kopf, payload: payload as object });
}

async function verantwortlich(b: Buehne, koId: string): Promise<string> {
  const ko = await b.services.ko.get(koId);
  return ko ? responsibleOf(ko) : "";
}

/** Was bei wem liegt — der Stand, den Vorschau und Abbruch nicht verändern dürfen. */
async function lage(b: Buehne) {
  const konto = (await b.services.auth.listUsers()).find((k) => k.id === b.ids.paula);
  return {
    a1: await verantwortlich(b, b.ko.a1),
    a2: await verantwortlich(b, b.ko.a2),
    v1: await verantwortlich(b, b.ko.v1),
    entwurf: (await b.repos.drafts.findById("d-offen"))?.originalAuthor,
    luecke: (await b.repos.gaps.findById("g-offen"))?.assignee,
    pruefaufgaben: (await b.repos.assignments.all())
      .filter((z) => z.koId === b.ko.p1)
      .map((z) => `${z.userId}:${z.status}`)
      .sort(),
    zugang: konto?.accessExpiresAt ?? null,
    approved: konto?.approved,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("K1/K2 · ein Ablauf, Vorschau mit zwei Nachfolgern", () => {
  it("die Vorschau zeigt jedes Paket mit Objekten, Anzahl, Rechtewirkung und Ausgeschlossenem — und schreibt nichts", async () => {
    const b = await buehne();
    const vorher = await lage(b);
    const protokollVorher = (await b.services.audit.list()).length;

    const res = await post(b, "/api/verantwortung/ablauf/vorschau", vollePlanung(b));
    expect(res.statusCode, res.body).toBe(200);
    const v = res.json() as Vorschau;

    expect(v.vorher).toEqual({ beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 });
    expect(v.prognose).toEqual(NULL);
    expect(v.pakete).toHaveLength(2);
    const nora = v.pakete.find((p) => p.an.id === b.ids.nora);
    const otto = v.pakete.find((p) => p.an.id === b.ids.otto);
    expect(nora?.anzahl).toBe(3);
    expect(nora?.eintraege.map((e) => `${e.art}:${e.id}`).sort()).toEqual(
      [`beitrag:${b.ko.a1}`, `beitrag:${b.ko.a2}`, "entwurf:d-offen"].sort(),
    );
    expect(nora?.wirkung).toEqual({ beitrag: 2, entwurf: 1, luecke: 0, pruefaufgabe: 0 });
    expect(otto?.anzahl).toBe(3);
    expect(otto?.wirkung).toEqual({ beitrag: 1, entwurf: 0, luecke: 1, pruefaufgabe: 1 });
    // Titel nur für Beiträge und Prüfaufgaben; ein Entwurf bleibt eine Kennung.
    expect(nora?.eintraege.find((e) => e.art === "entwurf")?.titel).toBeNull();
    expect(otto?.eintraege.find((e) => e.art === "pruefaufgabe")?.titel).toBe("Prüfplan Halle 3");
    expect(v.ausgeschlossen).toEqual({
      entwuerfe: [{ id: "d-papierkorb" }],
      luecken: [{ id: "g-zu" }],
      pruefaufgaben: [{ koId: b.ko.p2 }],
    });
    expect(v.abgelehnt).toEqual([]);
    expect(v.nichtZugeteilt).toEqual([]);
    expect(v.bestaetigbar).toBe(true);
    expect(v.zugang).toEqual({ jetzt: "aktiv", entscheidung: "beenden", danach: "abgelaufen" });
    expect(v.unveraendert).toEqual(
      expect.arrayContaining(["autorschaft", "freigabe", "historie", "rolle"]),
    );
    // K5: die zulässige Vertretung (aktiv, darf prüfen) steht in der Vorschau.
    expect(v.vertretung.map((k) => k.id).sort()).toEqual([b.ids.ada, b.ids.otto].sort());

    // Geschrieben wurde nichts — weder Zuordnung noch Zugang noch Protokoll.
    expect(await lage(b)).toEqual(vorher);
    expect((await b.services.audit.list()).length).toBe(protokollVorher);
  });

  it("der gezielte Umfang nimmt nur das Zugeteilte und lässt den Zugang — `beenden` gehört nur zum Ausscheiden", async () => {
    const b = await buehne();
    const gezielt = {
      person: b.ids.paula,
      umfang: "gezielt",
      beitraege: [{ koId: b.ko.a2, an: b.ids.nora }],
      vorgaenge: [],
    };
    const v = (await post(b, "/api/verantwortung/ablauf/vorschau", gezielt)).json() as Vorschau;
    expect(v.bestaetigbar).toBe(true);
    expect(v.nichtZugeteilt.length).toBe(5);
    expect(v.zugang.danach).toBe("aktiv");

    const mitEnde = await post(b, "/api/verantwortung/ablauf/vorschau", {
      ...gezielt,
      zugang: "beenden",
    });
    expect(mitEnde.statusCode, mitEnde.body).toBe(400);

    const res = await post(b, "/api/verantwortung/ablauf", gezielt);
    expect(res.statusCode, res.body).toBe(200);
    expect(await verantwortlich(b, b.ko.a2)).toBe(b.ids.nora);
    expect(await verantwortlich(b, b.ko.a1)).toBe(b.ids.paula);
    expect((await b.repos.drafts.findById("d-offen"))?.originalAuthor).toBe(b.ids.paula);
  });

  it("nur die Kontoverwaltung — Nora bekommt 403 und sieht nichts", async () => {
    const b = await buehne();
    for (const url of ["/api/verantwortung/ablauf/vorschau", "/api/verantwortung/ablauf"]) {
      const res = await post(b, url, vollePlanung(b), b.k.nora);
      expect(res.statusCode, res.body).toBe(403);
    }
    const lesen = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${b.ids.paula}/ablaeufe`,
      headers: b.k.nora,
    });
    expect(lesen.statusCode).toBe(403);
  });
});

describe("K2 · bestätigbar erst bei vollständiger zulässiger Zuordnung", () => {
  it("unvollständig: die Lücke fehlt — Vorschau sagt es, Ausführung schreibt nichts (409)", async () => {
    const b = await buehne();
    const plan = vollePlanung(b);
    plan.vorgaenge = plan.vorgaenge.filter((z) => z.art !== "luecke");
    const v = (await post(b, "/api/verantwortung/ablauf/vorschau", plan)).json() as Vorschau;
    expect(v.bestaetigbar).toBe(false);
    expect(v.hindernisse).toEqual(["NICHT_ZUGETEILT"]);
    expect(v.nichtZugeteilt).toEqual([{ art: "luecke", id: "g-offen", titel: null }]);

    const vorher = await lage(b);
    const res = await post(b, "/api/verantwortung/ablauf", plan);
    expect(res.statusCode, res.body).toBe(409);
    expect(res.json().error).toBe("NICHT_BESTAETIGBAR");
    expect(await lage(b)).toEqual(vorher);
  });

  it("unzulässig: je Zeile mit Grund abgelehnt — keine Rechteerweiterung, nichts geschrieben", async () => {
    const b = await buehne();
    const plan = {
      ...vollePlanung(b),
      beitraege: [
        { koId: b.ko.a1, an: b.ids.nora },
        { koId: b.ko.a2, an: b.ids.nora },
        // Nora darf Vertrauliches nicht sehen — die Übergabe öffnet es ihr nicht.
        { koId: b.ko.v1, an: b.ids.nora },
      ],
      vorgaenge: [
        // Vera darf kein Wissen bearbeiten.
        { art: "entwurf", id: "d-offen", an: b.ids.vera },
        { art: "luecke", id: "g-offen", an: b.ids.otto },
        // Nora darf nicht prüfen — die Übergabe vergibt keine Rolle.
        { art: "pruefaufgabe", id: b.ko.p1, an: b.ids.nora },
      ],
    };
    const v = (await post(b, "/api/verantwortung/ablauf/vorschau", plan)).json() as Vorschau;
    expect(v.bestaetigbar).toBe(false);
    expect(v.hindernisse).toContain("NICHT_UEBERTRAGBAR");
    const gruende = Object.fromEntries(v.abgelehnt.map((x) => [`${x.art}:${x.id}`, x.grund]));
    expect(gruende).toEqual({
      [`beitrag:${b.ko.v1}`]: "ZIEL_SIEHT_BEITRAG_NICHT",
      "entwurf:d-offen": "ZIEL_OHNE_SCHREIBRECHT",
      [`pruefaufgabe:${b.ko.p1}`]: "ZIEL_OHNE_PRUEFRECHT",
    });

    const vorher = await lage(b);
    expect((await post(b, "/api/verantwortung/ablauf", plan)).statusCode).toBe(409);
    expect(await lage(b)).toEqual(vorher);
    // Nora sieht den vertraulichen Beitrag weiterhin nicht.
    const sicht = await b.app.inject({
      method: "GET",
      url: `/api/kos/${b.ko.v1}`,
      headers: b.k.nora,
    });
    expect(sicht.statusCode).toBe(404);
  });

  it("ein Vorgang mit zwei verschiedenen Nachfolgern ist ein Eingabefehler", async () => {
    const b = await buehne();
    const res = await post(b, "/api/verantwortung/ablauf/vorschau", {
      ...vollePlanung(b),
      vorgaenge: [
        { art: "entwurf", id: "d-offen", an: b.ids.nora },
        { art: "entwurf", id: "d-offen", an: b.ids.otto },
      ],
    });
    expect(res.statusCode, res.body).toBe(400);
  });
});

describe("K3/K5/K6 · Ausführung, Erhalt von Autorschaft und Freigabe, Bilanz nach Neuladen", () => {
  it("vollständig verteilt: Autorschaft, Historie, Freigabe bleiben; Zugang endet; Bilanz steht im Protokoll", async () => {
    const b = await buehne();
    const a1Vorher = await b.services.ko.get(b.ko.a1);
    const spurVorher = await b.services.audit.list({ target: b.ko.a1 });
    expect(a1Vorher?.status).toBe("validiert");

    const res = await post(b, "/api/verantwortung/ablauf", vollePlanung(b));
    expect(res.statusCode, res.body).toBe(200);
    const e = res.json() as Ergebnis;
    expect(e.vollstaendig).toBe(true);
    expect(e.protokolliert).toBe(true);
    expect(e.uebertragen).toHaveLength(6);
    expect(e.offen).toEqual([]);
    expect(e.vorher).toEqual({ beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 });
    expect(e.nachher).toEqual(NULL);
    expect(e.zugang).toMatchObject({ vorher: "aktiv", nachher: "abgelaufen", beendet: true });

    // Hauptverantwortung bei den Nachfolgern; Autorschaft und Freigabe unverändert.
    expect(await verantwortlich(b, b.ko.a1)).toBe(b.ids.nora);
    expect(await verantwortlich(b, b.ko.a2)).toBe(b.ids.nora);
    expect(await verantwortlich(b, b.ko.v1)).toBe(b.ids.otto);
    const a1 = await b.services.ko.get(b.ko.a1);
    expect(a1?.author).toBe(b.ids.paula);
    expect(a1?.originalAuthor).toBe(b.ids.paula);
    expect(a1?.status).toBe("validiert");
    expect(a1?.version).toBe(a1Vorher?.version);
    expect(a1?.validationDecisionRef).toEqual(a1Vorher?.validationDecisionRef);
    // Historie: alle früheren Einträge unverändert; neu ist nur der Verantwortungsbeleg — keine
    // Neufreigabe.
    const spurNachher = await b.services.audit.list({ target: b.ko.a1 });
    expect(spurNachher.slice(0, spurVorher.length)).toEqual(spurVorher);
    expect(spurNachher.slice(spurVorher.length).map((x) => x.action)).toEqual(["ko.ownership"]);

    // Offene Vorgänge: Entwurf mit Urheberin, Lücke, Prüfaufgabe — Ausgeschlossenes bleibt.
    const entwurf = await b.repos.drafts.findById("d-offen");
    expect(entwurf?.originalAuthor).toBe(b.ids.nora);
    expect(entwurf?.urheber).toBe(b.ids.paula);
    expect((await b.repos.gaps.findById("g-offen"))?.assignee).toBe(b.ids.otto);
    expect((await b.repos.gaps.findById("g-zu"))?.assignee).toBe(b.ids.paula);
    expect((await lage(b)).pruefaufgaben).toEqual([`${b.ids.otto}:open`]);
    expect(await b.repos.assignments.find(b.ko.p2, b.ids.paula)).toMatchObject({ status: "done" });

    // Rollen unverändert — die Übergabe vergibt keine Rechte.
    const rollen = Object.fromEntries(
      (await b.services.auth.listUsers()).map((k) => [k.id, k.role]),
    );
    expect(rollen[b.ids.nora]).toBe("experte");
    expect(rollen[b.ids.otto]).toBe("controller");

    // K5: Paula kommt nicht mehr herein; nichts liegt ohne aktive Hauptverantwortung.
    const anmeldung = await b.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "paula@ablauf.test", password: KENNWORT },
    });
    expect(anmeldung.statusCode).toBe(403);
    const ungeklaert = await b.app.inject({
      method: "GET",
      url: "/api/verantwortung/ungeklaert",
      headers: b.k.admin,
    });
    expect(
      (ungeklaert.json() as { personen: { id: string }[] }).personen.map((p) => p.id),
    ).not.toContain(b.ids.paula);

    // K6: nach dem Neuladen — eine NEUE Anfrage — steht die Bilanz aus dem Prüfprotokoll da.
    const nachReload = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${b.ids.paula}/ablaeufe`,
      headers: b.k.admin,
    });
    expect(nachReload.statusCode, nachReload.body).toBe(200);
    const [letzte] = (nachReload.json() as { ablaeufe: Record<string, unknown>[] }).ablaeufe;
    expect(letzte).toMatchObject({
      umfang: "ausscheiden",
      vorher: { beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 },
      nachher: NULL,
      vollstaendig: true,
      zugang: { vorher: "aktiv", nachher: "abgelaufen", beendet: true },
      actor: { id: b.ids.ada, name: "Ada Admin" },
    });
    expect(letzte?.nachfolger).toEqual(
      expect.arrayContaining([
        { an: b.ids.nora, beitraege: 2, vorgaenge: 1, name: "Nora Nachfolge" },
        { an: b.ids.otto, beitraege: 1, vorgaenge: 2, name: "Otto Controller" },
      ]),
    );
    const vorgaenge = await b.services.audit.list({ target: b.ids.paula });
    expect(vorgaenge.map((x) => x.action)).toEqual(
      expect.arrayContaining([
        "verantwortung.uebergabe",
        "lifecycle.handover",
        "user.access-expiry-set",
        "verantwortung.ablauf",
      ]),
    );
  });

  it("Abbrechen vor Bestätigen: beliebig viele Vorschauen ändern weder Zuordnung noch Zugang noch Protokoll", async () => {
    const b = await buehne();
    const vorher = await lage(b);
    const protokoll = (await b.services.audit.list()).length;
    for (const zugang of ["behalten", "beenden"] as const) {
      const res = await post(b, "/api/verantwortung/ablauf/vorschau", vollePlanung(b, zugang));
      expect(res.statusCode).toBe(200);
    }
    expect(await lage(b)).toEqual(vorher);
    expect((await b.services.audit.list()).length).toBe(protokoll);
    const bilanzen = await b.app.inject({
      method: "GET",
      url: `/api/verantwortung/person/${b.ids.paula}/ablaeufe`,
      headers: b.k.admin,
    });
    expect(bilanzen.json()).toEqual({ ausstehend: null, ablaeufe: [] });
  });

  it("das eigene Konto lässt sich hier nicht beenden", async () => {
    const b = await buehne();
    const v = (
      await post(b, "/api/verantwortung/ablauf/vorschau", {
        person: b.ids.ada,
        umfang: "ausscheiden",
        beitraege: [],
        vorgaenge: [],
        zugang: "beenden",
      })
    ).json() as Vorschau;
    expect(v.hindernisse).toContain("SELBST");
    expect(v.bestaetigbar).toBe(false);
  });
});

describe("K4/K5 · Teilfehler, Wiederaufnahme, keine Doppelzuordnung", () => {
  it("ein Beitrag und ein Entwurf scheitern: beide benannt, Zugang bleibt; dieselbe Eingabe holt genau sie nach", async () => {
    const b = await buehne();
    const echt = b.services.ko.uebertrageVerantwortung.bind(b.services.ko);
    let beitragGestoert = false;
    vi.spyOn(b.services.ko, "uebertrageVerantwortung").mockImplementation(
      async (koId, erwartet, nachfolger, actor) => {
        if (koId === b.ko.a2 && !beitragGestoert) {
          beitragGestoert = true;
          throw new Error("Ablage vorübergehend nicht erreichbar (simuliert)");
        }
        return echt(koId, erwartet, nachfolger, actor);
      },
    );
    // Der Entwurfsschritt der Wissensübergabe scheitert einmal so, wie er bei einem zwischenzeitlich
    // gespeicherten Entwurf scheitert (`updateWennStand` → false).
    type MitEntwurfsschritt = {
      entwurfUebergeben: (draft: unknown, an: string) => Promise<void>;
    };
    const weg = b.services.wissensuebergabe as unknown as MitEntwurfsschritt;
    const echtEntwurf = weg.entwurfUebergeben.bind(weg);
    let entwurfGestoert = false;
    vi.spyOn(weg, "entwurfUebergeben").mockImplementation(async (draft, an) => {
      if (!entwurfGestoert) {
        entwurfGestoert = true;
        throw new Error("Der Entwurf wurde zwischenzeitlich geändert.");
      }
      return echtEntwurf(draft, an);
    });

    const erster = await post(b, "/api/verantwortung/ablauf", vollePlanung(b, "beenden"));
    expect(erster.statusCode, erster.body).toBe(207);
    const e1 = erster.json() as Ergebnis;
    expect(e1.vollstaendig).toBe(false);
    expect(e1.uebertragen.map((z) => `${z.art}:${z.id}`).sort()).toEqual(
      [
        `beitrag:${b.ko.a1}`,
        `beitrag:${b.ko.v1}`,
        "luecke:g-offen",
        `pruefaufgabe:${b.ko.p1}`,
      ].sort(),
    );
    expect(e1.offen.map((z) => `${z.art}:${z.id}:${z.grund}`).sort()).toEqual(
      [`beitrag:${b.ko.a2}:SCHREIBFEHLER`, "entwurf:d-offen:SCHREIBFEHLER"].sort(),
    );
    expect(e1.nachher).toEqual({ beitraege: 1, entwuerfe: 1, luecken: 0, pruefaufgaben: 0 });
    // K5: mit Restbestand endet der Zugang NICHT — und der Rest hat weiter eine aktive Verantwortung.
    expect(e1.zugang).toMatchObject({ nachher: "aktiv", beendet: false });
    expect(e1.zugang.grund).toContain("2");
    expect(await verantwortlich(b, b.ko.a2)).toBe(b.ids.paula);
    const nochDa = await b.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "paula@ablauf.test", password: KENNWORT },
    });
    expect(nochDa.statusCode).toBe(200);

    // Wiederaufnahme: DIESELBE Eingabe noch einmal bestätigt.
    const zweiter = await post(b, "/api/verantwortung/ablauf", vollePlanung(b, "beenden"));
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const e2 = zweiter.json() as Ergebnis;
    expect(e2.uebertragen.map((z) => `${z.art}:${z.id}`).sort()).toEqual(
      [`beitrag:${b.ko.a2}`, "entwurf:d-offen"].sort(),
    );
    expect(e2.bereitsErledigt).toHaveLength(4);
    expect(e2.nachher).toEqual(NULL);
    expect(e2.zugang).toMatchObject({ nachher: "abgelaufen", beendet: true });

    // Keine Doppelzuordnung: je Objekt genau ein Verantwortungsbeleg, je Prüfaufgabe genau eine
    // Zuweisung beim Nachfolger und keine mehr bei Paula.
    for (const koId of [b.ko.a1, b.ko.a2, b.ko.v1]) {
      const belege = await b.services.audit.list({ action: "ko.ownership", target: koId });
      expect(belege, koId).toHaveLength(1);
    }
    expect((await lage(b)).pruefaufgaben).toEqual([`${b.ids.otto}:open`]);
    expect((await b.repos.drafts.findById("d-offen"))?.originalAuthor).toBe(b.ids.nora);

    // Ein dritter Lauf nach dem Abschluss schreibt nichts mehr.
    const dritter = await post(b, "/api/verantwortung/ablauf", vollePlanung(b, "beenden"));
    expect(dritter.statusCode, dritter.body).toBe(200);
    const e3 = dritter.json() as Ergebnis;
    expect(e3.uebertragen).toEqual([]);
    expect(e3.bereitsErledigt).toHaveLength(6);
    for (const koId of [b.ko.a1, b.ko.a2, b.ko.v1]) {
      const belege = await b.services.audit.list({ action: "ko.ownership", target: koId });
      expect(belege, koId).toHaveLength(1);
    }

    // K6: die Bilanzen aller drei Läufe stehen im Protokoll, jüngste zuerst; der erste nennt den Rest.
    const bilanzen = (
      await b.app.inject({
        method: "GET",
        url: `/api/verantwortung/person/${b.ids.paula}/ablaeufe`,
        headers: b.k.admin,
      })
    ).json() as { ablaeufe: { vollstaendig: boolean; offen: { id: string }[] }[] };
    expect(bilanzen.ablaeufe.map((x) => x.vollstaendig)).toEqual([true, true, false]);
    expect(bilanzen.ablaeufe[2]?.offen.map((x) => x.id).sort()).toEqual(
      [b.ko.a2, "d-offen"].sort(),
    );
  });
});

// ================================================================================================
// NACHARBEIT 1 (Ben, Kandidat 0eb423b) — die drei belegten Lücken als Gegenproben.
// ================================================================================================
//   N1 · K5: ein vorübergehend gesperrtes Konto bekommt beim Beenden das gespeicherte Zugangsende;
//        eine spätere Freigabe öffnet es NICHT wieder.
//   N2 · K4: scheitern nach den Übertragungen der Vorgangsvermerk oder das Zugangsende, kommt das
//        Teilergebnis strukturiert zurück; dieselbe Eingabe holt den offenen Schritt nach.
//   N3 · K6: scheitert der Abschlussvermerk, ist er ein offener Schritt (207); nach Reload steht
//        der begonnene Ablauf als ausstehend da, und das Nachholen behält die Vorher-Bilanz.
// Die Störungen sind SIMULIERT (vi.spyOn an den echten Diensten der App), wie oben.

type Protokollschreiber = (input: { action: string }, ...rest: unknown[]) => Promise<unknown>;

/** Lässt `audit.record` für die genannte Aktion so oft scheitern, wie `mal` sagt. */
function protokollStoeren(b: Buehne, aktion: string, mal = 1): void {
  const audit = b.services.audit as unknown as { record: Protokollschreiber };
  const echt = audit.record.bind(audit);
  let rest = mal;
  vi.spyOn(audit, "record").mockImplementation(async (input, ...weitere) => {
    if (input.action === aktion && rest > 0) {
      rest -= 1;
      throw new Error(`Prüfprotokoll vorübergehend nicht erreichbar (simuliert: ${aktion})`);
    }
    return echt(input, ...weitere);
  });
}

async function ablaeufe(b: Buehne) {
  const res = await b.app.inject({
    method: "GET",
    url: `/api/verantwortung/person/${b.ids.paula}/ablaeufe`,
    headers: b.k.admin,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    ausstehend: { seq: number; vorher: Bilanz } | null;
    ablaeufe: {
      vorher: Bilanz;
      nachher: Bilanz;
      vollstaendig: boolean;
      nachgeholt?: boolean;
      nachfolger: { an: string; beitraege: number; vorgaenge: number }[];
      vorgaengeUebertragen?: { art: string; id: string; an: string }[];
    }[];
  };
}

async function paulaMeldetSichAn(b: Buehne): Promise<number> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "paula@ablauf.test", password: KENNWORT },
  });
  return res.statusCode;
}

interface ErgebnisN1 extends Ergebnis {
  abschlussOffen: string[];
  nachgeholt: boolean;
  zugang: Ergebnis["zugang"] & { endeGespeichert: boolean };
}

describe("Nacharbeit 1 · N1 (K5): Beenden ist bei einem gesperrten Konto keine Sperre", () => {
  it("das Zugangsende wird gespeichert — eine spätere Freigabe öffnet den Zugang nicht wieder", async () => {
    const b = await buehne();
    // Paula ist vorübergehend gesperrt (nicht freigegeben) — direkt in der Ablage gesetzt, weil
    // die Verwaltung dafür keinen eigenen Weg hat.
    const konto = await b.repos.users.findById(b.ids.paula);
    expect(konto).toBeDefined();
    await b.repos.users.update({ ...(konto as NonNullable<typeof konto>), approved: false });

    const vorschau = await post(b, "/api/verantwortung/ablauf/vorschau", vollePlanung(b));
    expect((vorschau.json() as Vorschau).zugang).toEqual({
      jetzt: "gesperrt",
      entscheidung: "beenden",
      danach: "abgelaufen",
    });

    const res = await post(b, "/api/verantwortung/ablauf", vollePlanung(b));
    expect(res.statusCode, res.body).toBe(200);
    const e = res.json() as ErgebnisN1;
    expect(e.zugang).toMatchObject({
      vorher: "gesperrt",
      nachher: "abgelaufen",
      beendet: true,
      endeGespeichert: true,
    });
    const gespeichert = (await b.services.auth.listUsers()).find((k) => k.id === b.ids.paula);
    expect(gespeichert?.accessExpiresAt, "kein gespeichertes Zugangsende").toBeDefined();
    expect(Date.parse(gespeichert?.accessExpiresAt ?? "")).toBeLessThanOrEqual(Date.now());

    // Die Freigabe hebt nur die Sperre auf — das Zugangsende bleibt.
    const freigabe = await b.app.inject({
      method: "POST",
      url: `/api/auth/users/${b.ids.paula}/approve`,
      headers: b.k.admin,
    });
    expect(freigabe.statusCode, freigabe.body).toBe(200);
    expect(await paulaMeldetSichAn(b)).toBe(403);
  });
});

describe("Nacharbeit 1 · N2 (K4): Fehler NACH den Übertragungen verschlucken kein Teilergebnis", () => {
  it("der Vorgangsvermerk scheitert: Ergebnis vollständig da, Kennungen stehen im Bilanzvermerk", async () => {
    const b = await buehne();
    protokollStoeren(b, "lifecycle.handover");
    const res = await post(b, "/api/verantwortung/ablauf", vollePlanung(b, "behalten"));
    expect(res.statusCode, res.body).toBe(200);
    const e = res.json() as ErgebnisN1;
    expect(e.uebertragen).toHaveLength(6);
    expect(e.offen).toEqual([]);
    expect((await b.repos.drafts.findById("d-offen"))?.originalAuthor).toBe(b.ids.nora);
    const [letzte] = (await ablaeufe(b)).ablaeufe;
    expect(letzte?.vorgaengeUebertragen?.map((z) => `${z.art}:${z.id}:${z.an}`).sort()).toEqual(
      [
        `entwurf:d-offen:${b.ids.nora}`,
        `luecke:g-offen:${b.ids.otto}`,
        `pruefaufgabe:${b.ko.p1}:${b.ids.otto}`,
      ].sort(),
    );
  });

  it("das Zugangsende scheitert: 207 mit allen Übertragungen und offenem Schritt — Wiederaufnahme beendet den Zugang", async () => {
    const b = await buehne();
    const echt = b.services.auth.setAccessExpiry.bind(b.services.auth);
    let gestoert = false;
    vi.spyOn(b.services.auth, "setAccessExpiry").mockImplementation(async (...args) => {
      if (!gestoert) {
        gestoert = true;
        throw new Error("Kontoablage vorübergehend nicht erreichbar (simuliert)");
      }
      return echt(...args);
    });

    const erster = await post(b, "/api/verantwortung/ablauf", vollePlanung(b, "beenden"));
    expect(erster.statusCode, erster.body).toBe(207);
    const e1 = erster.json() as ErgebnisN1;
    expect(e1.vollstaendig).toBe(false);
    expect(e1.uebertragen).toHaveLength(6);
    expect(e1.offen).toEqual([]);
    expect(e1.abschlussOffen).toEqual(["ZUGANG"]);
    expect(e1.nachher).toEqual(NULL);
    expect(e1.zugang).toMatchObject({ nachher: "aktiv", beendet: false, endeGespeichert: false });
    expect(await verantwortlich(b, b.ko.a1)).toBe(b.ids.nora);
    expect(await paulaMeldetSichAn(b)).toBe(200);

    const zweiter = await post(b, "/api/verantwortung/ablauf", vollePlanung(b, "beenden"));
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const e2 = zweiter.json() as ErgebnisN1;
    expect(e2.uebertragen).toEqual([]);
    expect(e2.bereitsErledigt).toHaveLength(6);
    expect(e2.abschlussOffen).toEqual([]);
    expect(e2.zugang).toMatchObject({
      nachher: "abgelaufen",
      beendet: true,
      endeGespeichert: true,
    });
    expect(await paulaMeldetSichAn(b)).toBe(403);
    // Keine Doppelzuordnung durch die Wiederholung.
    for (const koId of [b.ko.a1, b.ko.a2, b.ko.v1]) {
      expect(await b.services.audit.list({ action: "ko.ownership", target: koId })).toHaveLength(1);
    }
  });

  it("lässt sich der Beginn nicht festhalten, wird nichts übertragen (503)", async () => {
    const b = await buehne();
    const vorher = await lage(b);
    protokollStoeren(b, "verantwortung.ablauf-begonnen");
    const res = await post(b, "/api/verantwortung/ablauf", vollePlanung(b));
    expect(res.statusCode, res.body).toBe(503);
    expect(await lage(b)).toEqual(vorher);
  });
});

describe("Nacharbeit 1 · N3 (K6): ein fehlender Abschlussvermerk ist ein offener Schritt", () => {
  it("207, nach Reload ausstehend; die Wiederaufnahme holt ihn mit der ursprünglichen Vorher-Bilanz nach", async () => {
    const b = await buehne();
    protokollStoeren(b, "verantwortung.ablauf");
    const erster = await post(b, "/api/verantwortung/ablauf", vollePlanung(b));
    expect(erster.statusCode, erster.body).toBe(207);
    const e1 = erster.json() as ErgebnisN1;
    expect(e1.vollstaendig).toBe(false);
    expect(e1.protokolliert).toBe(false);
    expect(e1.abschlussOffen).toEqual(["BILANZVERMERK"]);
    expect(e1.uebertragen).toHaveLength(6);

    // Reload: keine Bilanz, aber der begonnene Ablauf mit seiner Vorher-Bilanz.
    const nachReload = await ablaeufe(b);
    expect(nachReload.ablaeufe).toEqual([]);
    expect(nachReload.ausstehend?.vorher).toEqual({
      beitraege: 3,
      entwuerfe: 1,
      luecken: 1,
      pruefaufgaben: 1,
    });

    // Wiederaufnahme mit derselben Eingabe.
    const zweiter = await post(b, "/api/verantwortung/ablauf", vollePlanung(b));
    expect(zweiter.statusCode, zweiter.body).toBe(200);
    const e2 = zweiter.json() as ErgebnisN1;
    expect(e2.nachgeholt).toBe(true);
    expect(e2.vorher).toEqual({ beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 });
    expect(e2.nachher).toEqual(NULL);

    const danach = await ablaeufe(b);
    expect(danach.ausstehend).toBeNull();
    expect(danach.ablaeufe).toHaveLength(1);
    expect(danach.ablaeufe[0]).toMatchObject({
      vorher: { beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 },
      nachher: NULL,
      vollstaendig: true,
      nachgeholt: true,
    });
    expect(danach.ablaeufe[0]?.nachfolger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ an: b.ids.nora, beitraege: 2, vorgaenge: 1 }),
        expect.objectContaining({ an: b.ids.otto, beitraege: 1, vorgaenge: 2 }),
      ]),
    );
  });

  it("nach Reload mit leerem Plan (die Fläche kennt ihn nicht mehr) — der Plan des Beginns zählt", async () => {
    const b = await buehne();
    protokollStoeren(b, "verantwortung.ablauf");
    expect((await post(b, "/api/verantwortung/ablauf", vollePlanung(b))).statusCode).toBe(207);

    const leer = { ...vollePlanung(b), beitraege: [], vorgaenge: [] };
    const res = await post(b, "/api/verantwortung/ablauf", leer);
    expect(res.statusCode, res.body).toBe(200);
    const [bilanz] = (await ablaeufe(b)).ablaeufe;
    expect(bilanz).toMatchObject({
      vorher: { beitraege: 3, entwuerfe: 1, luecken: 1, pruefaufgaben: 1 },
      nachgeholt: true,
    });
    expect(bilanz?.nachfolger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ an: b.ids.nora, beitraege: 2, vorgaenge: 1 }),
        expect.objectContaining({ an: b.ids.otto, beitraege: 1, vorgaenge: 2 }),
      ]),
    );
    expect(await paulaMeldetSichAn(b)).toBe(403);
  });
});
