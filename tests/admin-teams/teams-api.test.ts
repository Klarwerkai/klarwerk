// ================================================================================================
// ADMIN-06 · TEAMS AM DRAHT — buildApp im Speicher, fiktive Konten (produkt:20261009:admin-teams).
// ================================================================================================
//
// Isolierter Testbestand: jede Prüfung baut ihre eigene Anwendung; kein Konto, keine Rolle und kein
// Inhalt ist echt. Die Bühne trägt die Lieferbelege des Auftrags: ZWEI Teams mit ÜBERLAPPENDER
// Mitgliedschaft (Vera in beiden) und Mitgliedern mit ZWEI UNABHÄNGIGEN Rollen (Erik experte,
// Vera viewer), dazu eine direkte Space-Mitgliedschaft (Erik in der Werkstatt).
//
//   Ada    (admin)      — Kontoverwaltung, verwaltet die Teams
//   Carla  (controller) — legt die Spaces an, ist dort zuständig, Autorin der Artikel
//   Erik   (experte)    — Team Messtechnik; zusätzlich DIREKTES Mitglied der Werkstatt (lesen)
//   Vera   (viewer)     — Team Messtechnik UND Team Qualitätszirkel
//   Fritz  (experte)    — Team Qualitätszirkel
//
//   Space „Labor"     (nur Mitglieder): Messtechnik → lesen, Qualitätszirkel → schreiben
//   Space „Werkstatt" (nur Mitglieder): Messtechnik → schreiben, Erik direkt → lesen
//
// Ordnung zu den Originalkriterien:
//   K1 Anlegen, Bearbeiten, Archivieren mit Zweck und Zuständigkeit; Team ist keine Kontokopie.
//   K2 Wirkung VOR Bestätigung: betroffene Space-Zugänge, alle Wege (direkt, anderes Team).
//   K3 Entfernen nimmt nur den Teamweg; globale Rolle unverändert; andere Wege bleiben.
//   K4 Negativprobe mit einer VOR dem Entzug ausgestellten Sitzung („offener Tab"): sofort 404.
//   K5 Archiviert: keine neuen Mitgliedschaften/Bindungen; Inhalte, Autorschaft, Audit bleiben;
//      Folgen für die Spaces werden vorher genannt.
//   K6 Teamliste, Mitglieder, Verlauf nach erneutem Lesen; Unberechtigte: 403, nichts geschrieben.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

// Fiktives Testkennwort des isolierten Speicherbestands — kein Zugang zu einem echten System.
const KENNWORT = "testkonto-123";

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
  const erst = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@teams.test", password: KENNWORT },
  });
  expect(erst.statusCode, erst.body).toBe(201);
  const admin = await anmelden(app, "ada@teams.test");
  for (const [name, email, role] of [
    ["Carla Controller", "carla@teams.test", "controller"],
    ["Erik Experte", "erik@teams.test", "experte"],
    ["Vera Viewer", "vera@teams.test", "viewer"],
    ["Fritz Fachmann", "fritz@teams.test", "experte"],
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
    carla: await anmelden(app, "carla@teams.test"),
    erik: await anmelden(app, "erik@teams.test"),
    vera: await anmelden(app, "vera@teams.test"),
    fritz: await anmelden(app, "fritz@teams.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.carla });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string => {
    const konto = (liste.json().konten as { id: string; name: string }[]).find(
      (x) => x.name === name,
    );
    expect(konto, `Konto ${name}`).toBeDefined();
    return konto?.id ?? "";
  };
  const ids = {
    admin: id("Ada Admin"),
    carla: id("Carla Controller"),
    erik: id("Erik Experte"),
    vera: id("Vera Viewer"),
    fritz: id("Fritz Fachmann"),
  };
  return { app, services, k, ids };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

async function teamAnlegen(b: Buehne, name: string, mitglieder: string[]) {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/teams",
    headers: b.k.admin,
    payload: {
      name,
      zweck: `${name}: gemeinsame Zuständigkeit für Prüfmittel (fiktiv).`,
      verantwortlich: b.ids.carla,
      mitglieder,
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json() as { id: string; version: number };
}

async function lies(b: Buehne, kopf: Kopf, url: string) {
  return b.app.inject({ method: "GET", url, headers: kopf });
}

async function artikelInSpace(b: Buehne, titel: string, spaceId: string): Promise<string> {
  const res = await b.app.inject({
    method: "POST",
    url: "/api/kos",
    headers: b.k.carla,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: `${titel} — fiktive Aussage für den Teamtest.`,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const koId = res.json().id as string;
  const v = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: b.k.carla,
    payload: { koId, zielSpaceId: spaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vorschau = v.json();
  const zug = await b.app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: b.k.carla,
    payload: {
      koId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: vorschau.quelle?.id ?? null,
        quelleVersion: vorschau.quelle?.version ?? null,
        zielId: vorschau.ziel?.id ?? null,
        zielVersion: vorschau.ziel?.version ?? null,
      },
    },
  });
  expect(zug.statusCode, zug.body).toBe(200);
  return koId;
}

/** Die vollständige Bühne: zwei Teams, zwei Spaces, je ein Artikel. */
async function mitSpaces() {
  const b = await buehne();
  const mess = await teamAnlegen(b, "Messtechnik", [b.ids.erik, b.ids.vera]);
  const qz = await teamAnlegen(b, "Qualitätszirkel", [b.ids.vera, b.ids.fritz]);
  const labor = await b.app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: b.k.carla,
    payload: {
      name: "Labor",
      zweck: "Messmittel des Labors (fiktiv).",
      verantwortlich: b.ids.carla,
      zugang: "mitglieder",
      mitglieder: [],
      ansichten: [],
      teams: [
        { team: mess.id, recht: "lesen" },
        { team: qz.id, recht: "schreiben" },
      ],
    },
  });
  expect(labor.statusCode, labor.body).toBe(201);
  const werkstatt = await b.app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: b.k.carla,
    payload: {
      name: "Werkstatt",
      zweck: "Arbeitsanweisungen der Werkstatt (fiktiv).",
      verantwortlich: b.ids.carla,
      zugang: "mitglieder",
      mitglieder: [{ nutzer: b.ids.erik, recht: "lesen" }],
      ansichten: [],
      teams: [{ team: mess.id, recht: "schreiben" }],
    },
  });
  expect(werkstatt.statusCode, werkstatt.body).toBe(201);
  const laborId = labor.json().id as string;
  const werkstattId = werkstatt.json().id as string;
  const koLabor = await artikelInSpace(b, "Kalibrierlehre Labor", laborId);
  const koWerkstatt = await artikelInSpace(b, "Drehmomentschluessel Werkstatt", werkstattId);
  return { ...b, mess, qz, laborId, werkstattId, koLabor, koWerkstatt };
}

type Voll = Awaited<ReturnType<typeof mitSpaces>>;

interface Wirkung {
  grundlage: string;
  spaces: { id: string; name: string; recht: string; verlieren: number }[];
  personen: {
    nutzer: string;
    role: string;
    aenderung: string;
    spaces: {
      spaceId: string;
      vorher: string;
      nachher: string;
      wegeNachher: { art: string; recht: string; team?: string; teamName?: string }[];
    }[];
  }[];
}

async function vorschau(b: Voll, teamId: string, body: unknown): Promise<Wirkung> {
  const res = await b.app.inject({
    method: "POST",
    url: `/api/teams/${teamId}/vorschau`,
    headers: b.k.admin,
    payload: body as Record<string, unknown>,
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Wirkung;
}

async function team(b: Buehne, teamId: string) {
  const res = await lies(b, b.k.admin, `/api/teams/${teamId}`);
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as {
    team: {
      id: string;
      version: number;
      name: string;
      zweck: string;
      verantwortlich: string;
      archiviert: boolean;
      mitglieder: { nutzer: string; name: string | null; role: string | null }[];
      spaces: { id: string; name: string; recht: string }[];
    };
    verlauf: {
      version: number;
      vorgang: string;
      hinzugefuegt: { id: string }[];
      entfernt: { id: string }[];
    }[];
  };
}

/** Mitglieder ändern — der reguläre Weg: Vorschau holen, mit genau ihrer Grundlage übernehmen. */
async function mitgliederSetzen(b: Voll, teamId: string, mitglieder: string[]) {
  const w = await vorschau(b, teamId, { mitglieder });
  const t = (await team(b, teamId)).team;
  return b.app.inject({
    method: "PUT",
    url: `/api/teams/${teamId}`,
    headers: b.k.admin,
    payload: {
      version: t.version,
      name: t.name,
      zweck: t.zweck,
      verantwortlich: t.verantwortlich,
      mitglieder,
      grundlage: w.grundlage,
    },
  });
}

async function protokoll(b: Buehne) {
  const res = await lies(b, b.k.admin, "/api/audit");
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as { actor: string; action: string; target: string; payload: unknown }[];
}

describe("K1 · Team mit Zweck und Zuständigkeit anlegen, bearbeiten, archivieren — keine Kontokopie", () => {
  it("anlegen, wieder lesen und bearbeiten; jede Änderung ist eine neue Fassung", async () => {
    const b = await buehne();
    const angelegt = await teamAnlegen(b, "Messtechnik", [b.ids.erik, b.ids.vera]);
    const gelesen = await team(b, angelegt.id);
    expect(gelesen.team).toMatchObject({
      name: "Messtechnik",
      verantwortlich: b.ids.carla,
      archiviert: false,
      version: 1,
    });
    expect(gelesen.team.zweck).toContain("gemeinsame Zuständigkeit");

    const geaendert = await b.app.inject({
      method: "PUT",
      url: `/api/teams/${angelegt.id}`,
      headers: b.k.admin,
      payload: {
        version: 1,
        name: "Messtechnik Nord",
        zweck: "Neuer Zweck (fiktiv).",
        verantwortlich: b.ids.erik,
        mitglieder: [b.ids.erik, b.ids.vera],
      },
    });
    // Ohne Mitgliederänderung braucht es keine Wirkungsvorschau.
    expect(geaendert.statusCode, geaendert.body).toBe(200);
    const danach = await team(b, angelegt.id);
    expect(danach.team).toMatchObject({
      name: "Messtechnik Nord",
      zweck: "Neuer Zweck (fiktiv).",
      verantwortlich: b.ids.erik,
      version: 2,
    });
    expect(danach.verlauf.map((v) => v.vorgang)).toEqual(["angelegt", "geaendert"]);

    // Veraltete Version → 409, nichts geschrieben.
    const alt = await b.app.inject({
      method: "PUT",
      url: `/api/teams/${angelegt.id}`,
      headers: b.k.admin,
      payload: {
        version: 1,
        name: "Überholt",
        zweck: "x",
        verantwortlich: b.ids.erik,
        mitglieder: [b.ids.erik, b.ids.vera],
      },
    });
    expect(alt.statusCode).toBe(409);
    expect((await team(b, angelegt.id)).team.name).toBe("Messtechnik Nord");
  });

  it("Zweck, Zuständigkeit und Mitglieder müssen bestehende Konten nennen", async () => {
    const b = await buehne();
    for (const payload of [
      { name: "X", zweck: "", verantwortlich: b.ids.carla, mitglieder: [] },
      { name: "X", zweck: "Y", verantwortlich: "konto-gibt-es-nicht", mitglieder: [] },
      { name: "X", zweck: "Y", verantwortlich: b.ids.carla, mitglieder: ["konto-gibt-es-nicht"] },
    ]) {
      const res = await b.app.inject({
        method: "POST",
        url: "/api/teams",
        headers: b.k.admin,
        payload,
      });
      expect(res.statusCode, res.body).toBe(400);
      expect(res.json().error).toBe("TEAM_UNGUELTIG");
    }
    expect((await lies(b, b.k.admin, "/api/teams")).json().teams).toEqual([]);
  });

  it("das Team verweist auf Konten: Name und Rolle kommen vom Konto, gespeichert sind nur Kennungen", async () => {
    const b = await buehne();
    const t = await teamAnlegen(b, "Messtechnik", [b.ids.vera]);
    expect((await team(b, t.id)).team.mitglieder).toEqual([
      { nutzer: b.ids.vera, name: "Vera Viewer", role: "viewer" },
    ]);
    // Die Rolle wird AM KONTO geändert — das Team zeigt sie ohne eigene Änderung.
    const rolle = await b.app.inject({
      method: "PUT",
      url: `/api/users/${b.ids.vera}`,
      headers: b.k.admin,
      payload: { role: "experte" },
    });
    expect(rolle.statusCode, rolle.body).toBeLessThan(300);
    const danach = await team(b, t.id);
    expect(danach.team.mitglieder[0]?.role).toBe("experte");
    expect(danach.team.version).toBe(1);
    // Gespeichert ist die Mitgliedschaft als Kennung — kein Name, keine Rolle, keine E-Mail.
    const fassungen = await b.services.teams.fassungen(t.id);
    expect(fassungen[0]?.mitglieder).toEqual([b.ids.vera]);
    expect(JSON.stringify(fassungen)).not.toContain("vera@teams.test");
  });
});

describe("K2 · Hinzufügen und Entfernen zeigen die betroffenen Space-Zugänge vor Bestätigung", () => {
  it("Entfernen: je Space vorher/nachher und ALLE verbleibenden Wege — anderes Team und direktes Recht", async () => {
    const b = await mitSpaces();
    const w = await vorschau(b, b.mess.id, { mitglieder: [] });
    expect(w.spaces.map((s) => s.name).sort()).toEqual(["Labor", "Werkstatt"]);

    const vera = w.personen.find((p) => p.nutzer === b.ids.vera);
    expect(vera?.aenderung).toBe("entfernt");
    expect(vera?.role).toBe("viewer");
    const veraLabor = vera?.spaces.find((s) => s.spaceId === b.laborId);
    // Vera bleibt im Labor über den Qualitätszirkel — mit Schreibrecht, und der Weg ist benannt.
    expect(veraLabor).toMatchObject({ vorher: "schreiben", nachher: "schreiben" });
    expect(veraLabor?.wegeNachher).toEqual([
      { art: "team", recht: "schreiben", team: b.qz.id, teamName: "Qualitätszirkel" },
    ]);
    const veraWerkstatt = vera?.spaces.find((s) => s.spaceId === b.werkstattId);
    expect(veraWerkstatt).toMatchObject({ vorher: "schreiben", nachher: "keins" });
    expect(veraWerkstatt?.wegeNachher).toEqual([]);

    const erik = w.personen.find((p) => p.nutzer === b.ids.erik);
    expect(erik?.role).toBe("experte");
    const erikWerkstatt = erik?.spaces.find((s) => s.spaceId === b.werkstattId);
    // Erik behält die Werkstatt über seine DIREKTE Mitgliedschaft — nur noch lesend.
    expect(erikWerkstatt).toMatchObject({ vorher: "schreiben", nachher: "lesen" });
    expect(erikWerkstatt?.wegeNachher).toEqual([{ art: "direkt", recht: "lesen" }]);
    expect(erik?.spaces.find((s) => s.spaceId === b.laborId)).toMatchObject({
      vorher: "lesen",
      nachher: "keins",
    });
    // Zähler je Space: wer den Zugang GANZ verliert.
    expect(w.spaces.find((s) => s.id === b.werkstattId)?.verlieren).toBe(1);
    expect(w.spaces.find((s) => s.id === b.laborId)?.verlieren).toBe(1);
  });

  it("Hinzufügen: der neue Zugang steht vor der Übernahme da; die Vorschau schreibt nichts", async () => {
    const b = await mitSpaces();
    const w = await vorschau(b, b.mess.id, { mitglieder: [b.ids.erik, b.ids.vera, b.ids.fritz] });
    const fritz = w.personen.find((p) => p.nutzer === b.ids.fritz);
    expect(fritz?.aenderung).toBe("hinzu");
    expect(fritz?.spaces.find((s) => s.spaceId === b.werkstattId)).toMatchObject({
      vorher: "keins",
      nachher: "schreiben",
    });
    // Im Labor war Fritz schon über den Qualitätszirkel — beide Teamwege stehen danach da.
    const labor = fritz?.spaces.find((s) => s.spaceId === b.laborId);
    expect(labor).toMatchObject({ vorher: "schreiben", nachher: "schreiben" });
    expect(labor?.wegeNachher.map((x) => x.teamName).sort()).toEqual([
      "Messtechnik",
      "Qualitätszirkel",
    ]);
    // Nichts geschrieben: Fassung unverändert, Fritz hat keinen Werkstattzugang.
    expect((await team(b, b.mess.id)).team.version).toBe(1);
    expect((await lies(b, b.k.fritz, `/api/kos/${b.koWerkstatt}`)).statusCode).toBe(404);
  });

  it("ohne Vorschau keine Übernahme; eine überholte Vorschau liefert die neue zurück", async () => {
    const b = await mitSpaces();
    const t = (await team(b, b.mess.id)).team;
    const ohne = await b.app.inject({
      method: "PUT",
      url: `/api/teams/${b.mess.id}`,
      headers: b.k.admin,
      payload: { ...t, mitglieder: [b.ids.erik], version: t.version },
    });
    expect(ohne.statusCode, ohne.body).toBe(400);
    expect(ohne.json().error).toBe("VORSCHAU_FEHLT");

    const w = await vorschau(b, b.mess.id, { mitglieder: [b.ids.erik] });
    // Dazwischen ändert jemand die Werkstatt: Vera wird dort direktes Mitglied.
    const ws = (await lies(b, b.k.carla, `/api/spaces/${b.werkstattId}`)).json().space;
    const aend = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${b.werkstattId}`,
      headers: b.k.carla,
      payload: {
        version: ws.version,
        name: ws.name,
        zweck: ws.zweck,
        verantwortlich: ws.verantwortlich,
        zugang: ws.zugang,
        mitglieder: [
          { nutzer: b.ids.erik, recht: "lesen" },
          { nutzer: b.ids.vera, recht: "lesen" },
        ],
        ansichten: [],
        teams: [{ team: b.mess.id, recht: "schreiben" }],
      },
    });
    expect(aend.statusCode, aend.body).toBe(200);
    const veraltet = await b.app.inject({
      method: "PUT",
      url: `/api/teams/${b.mess.id}`,
      headers: b.k.admin,
      payload: { ...t, mitglieder: [b.ids.erik], version: t.version, grundlage: w.grundlage },
    });
    expect(veraltet.statusCode, veraltet.body).toBe(409);
    expect(veraltet.json().error).toBe("VORSCHAU_VERALTET");
    const neu = veraltet.json().vorschau as Wirkung;
    const veraNeu = neu.personen
      .find((p) => p.nutzer === b.ids.vera)
      ?.spaces.find((s) => s.spaceId === b.werkstattId);
    expect(veraNeu).toMatchObject({ nachher: "lesen" });
    expect(veraNeu?.wegeNachher).toEqual([{ art: "direkt", recht: "lesen" }]);
    expect((await team(b, b.mess.id)).team.version).toBe(1);
  });
});

describe("K3 · Entfernen nimmt nur den Teamweg und ändert keine globale Rolle", () => {
  it("Vera verliert die Werkstatt, behält das Labor über das andere Team; Erik behält sein direktes Recht", async () => {
    const b = await mitSpaces();
    // Positivprobe vorher.
    expect((await lies(b, b.k.vera, `/api/kos/${b.koWerkstatt}`)).statusCode).toBe(200);
    expect((await lies(b, b.k.vera, `/api/kos/${b.koLabor}`)).statusCode).toBe(200);

    const res = await mitgliederSetzen(b, b.mess.id, []);
    expect(res.statusCode, res.body).toBe(200);

    expect((await lies(b, b.k.vera, `/api/kos/${b.koWerkstatt}`)).statusCode).toBe(404);
    expect((await lies(b, b.k.vera, `/api/kos/${b.koLabor}`)).statusCode).toBe(200);
    const labor = (await lies(b, b.k.vera, `/api/spaces/${b.laborId}`)).json().space;
    expect(labor.eigenesRecht).toBe("schreiben");
    expect(labor.teamMitglieder).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nutzer: b.ids.vera, team: b.qz.id, teamName: "Qualitätszirkel" }),
      ]),
    );
    expect(
      (labor.teamMitglieder as { team: string }[]).some((m) => m.team === b.mess.id),
      "ein leeres Team trägt keine Mitgliedschaft mehr bei",
    ).toBe(false);

    expect((await lies(b, b.k.erik, `/api/kos/${b.koWerkstatt}`)).statusCode).toBe(200);
    expect(
      (await lies(b, b.k.erik, `/api/spaces/${b.werkstattId}`)).json().space.eigenesRecht,
    ).toBe("lesen");
    expect((await lies(b, b.k.erik, `/api/kos/${b.koLabor}`)).statusCode).toBe(404);

    // Globale Rollen unverändert — am Konto selbst gelesen.
    const konten = (await lies(b, b.k.admin, "/api/users")).json() as {
      id: string;
      role: string;
    }[];
    expect(konten.find((u) => u.id === b.ids.vera)?.role).toBe("viewer");
    expect(konten.find((u) => u.id === b.ids.erik)?.role).toBe("experte");
  });
});

describe("K4 · Nach Entzug verweigert der Server sofort — auch mit einer schon offenen Sitzung", () => {
  it("dieselbe, VOR dem Entzug ausgestellte Sitzung bekommt danach 404 auf Artikel, Liste und Space", async () => {
    const b = await mitSpaces();
    // Der „offene Tab": Veras Sitzung steht, bevor die Kontoverwaltung sie aus dem Team nimmt.
    const offenerTab = b.k.vera;
    expect((await lies(b, offenerTab, `/api/kos/${b.koWerkstatt}`)).statusCode).toBe(200);
    expect(
      (await lies(b, offenerTab, `/api/spaces/${b.werkstattId}/artikel`)).json().artikel,
    ).toHaveLength(1);

    const res = await mitgliederSetzen(b, b.mess.id, [b.ids.erik]);
    expect(res.statusCode, res.body).toBe(200);

    // Nächste Anfrage derselben Sitzung — keine Wartezeit, kein neues Anmelden.
    expect((await lies(b, offenerTab, `/api/kos/${b.koWerkstatt}`)).statusCode).toBe(404);
    expect((await lies(b, offenerTab, `/api/spaces/${b.werkstattId}`)).statusCode).toBe(404);
    expect((await lies(b, offenerTab, `/api/spaces/${b.werkstattId}/artikel`)).statusCode).toBe(
      404,
    );
    const liste = (await lies(b, offenerTab, "/api/kos")).json() as unknown;
    expect(JSON.stringify(liste)).not.toContain(b.koWerkstatt);
    // Die Sitzung selbst bleibt gültig: der Laborartikel (anderer Weg) ist weiter da.
    expect((await lies(b, offenerTab, `/api/kos/${b.koLabor}`)).statusCode).toBe(200);
  });
});

describe("K5 · Archivieren: Folgen vorher, danach keine neuen Mitgliedschaften; Bestand bleibt", () => {
  it("Folgen je Space vor der Bestätigung, danach gesperrt; Inhalte, Autorschaft, Audit bleiben", async () => {
    const b = await mitSpaces();
    const koVorher = (await lies(b, b.k.carla, `/api/kos/${b.koLabor}`)).json();

    const w = await vorschau(b, b.qz.id, { archivieren: true });
    expect(w.spaces).toEqual([{ id: b.laborId, name: "Labor", recht: "schreiben", verlieren: 1 }]);
    const fritz = w.personen.find((p) => p.nutzer === b.ids.fritz);
    expect(fritz).toMatchObject({ aenderung: "archiviert" });
    expect(fritz?.spaces[0]).toMatchObject({ vorher: "schreiben", nachher: "keins" });
    const vera = w.personen.find((p) => p.nutzer === b.ids.vera);
    // Vera behält das Labor über Messtechnik — lesend.
    expect(vera?.spaces[0]).toMatchObject({ vorher: "schreiben", nachher: "lesen" });

    const ohne = await b.app.inject({
      method: "POST",
      url: `/api/teams/${b.qz.id}/archivieren`,
      headers: b.k.admin,
      payload: { version: 1 },
    });
    expect(ohne.statusCode).toBe(400);
    const arch = await b.app.inject({
      method: "POST",
      url: `/api/teams/${b.qz.id}/archivieren`,
      headers: b.k.admin,
      payload: { version: 1, grundlage: w.grundlage },
    });
    expect(arch.statusCode, arch.body).toBe(200);
    expect(arch.json().archiviert).toBe(true);

    // Keine neuen Mitgliedschaften, keine Änderungen, keine Vorschau mehr.
    const t = (await team(b, b.qz.id)).team;
    for (const versuch of [
      b.app.inject({
        method: "PUT",
        url: `/api/teams/${b.qz.id}`,
        headers: b.k.admin,
        payload: { ...t, mitglieder: [...t.mitglieder.map((m) => m.nutzer), b.ids.erik] },
      }),
      b.app.inject({
        method: "POST",
        url: `/api/teams/${b.qz.id}/vorschau`,
        headers: b.k.admin,
        payload: { mitglieder: [b.ids.erik] },
      }),
    ]) {
      const r = await versuch;
      expect(r.statusCode, r.body).toBe(409);
      expect(r.json().error).toBe("TEAM_ARCHIVIERT");
    }
    // Kein neuer Space bindet das archivierte Team.
    const neuerSpace = await b.app.inject({
      method: "POST",
      url: "/api/spaces",
      headers: b.k.carla,
      payload: {
        name: "Neu",
        zweck: "fiktiv",
        verantwortlich: b.ids.carla,
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [],
        teams: [{ team: b.qz.id, recht: "lesen" }],
      },
    });
    expect(neuerSpace.statusCode).toBe(400);
    expect((await lies(b, b.k.admin, "/api/spaces/teams")).json().teams).toEqual([
      expect.objectContaining({ id: b.mess.id }),
    ]);

    // Das archivierte Team gewährt nichts mehr; der Space nennt die Bindung als archiviert.
    expect((await lies(b, b.k.fritz, `/api/kos/${b.koLabor}`)).statusCode).toBe(404);
    const labor = (await lies(b, b.k.carla, `/api/spaces/${b.laborId}`)).json().space;
    expect(labor.teams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ team: b.qz.id, archiviert: true, name: "Qualitätszirkel" }),
      ]),
    );
    // Die bestehende Bindung bleibt beim Bearbeiten des Space erhalten (Verlauf, kein Umschreiben).
    const weiter = await b.app.inject({
      method: "PUT",
      url: `/api/spaces/${b.laborId}`,
      headers: b.k.carla,
      payload: {
        version: labor.version,
        name: labor.name,
        zweck: "Zweck geändert (fiktiv).",
        verantwortlich: labor.verantwortlich,
        zugang: labor.zugang,
        mitglieder: [],
        ansichten: [],
        teams: labor.teams.map((x: { team: string; recht: string }) => ({
          team: x.team,
          recht: x.recht,
        })),
      },
    });
    expect(weiter.statusCode, weiter.body).toBe(200);

    // Inhalte, Autorschaft und Fassung unverändert.
    const koNachher = (await lies(b, b.k.carla, `/api/kos/${b.koLabor}`)).json();
    expect(koNachher.author).toBe(koVorher.author);
    expect(koNachher.version).toBe(koVorher.version);
    expect(koNachher.history).toEqual(koVorher.history);
    expect(koNachher.statement).toBe(koVorher.statement);

    // Audit: Anlage und Archiv stehen nebeneinander; der Verlauf führt alle Fassungen.
    const eintraege = (await protokoll(b)).filter((e) => e.target === b.qz.id);
    expect(eintraege.map((e) => e.action)).toEqual(["team.angelegt", "team.archiviert"]);
    const verlauf = (await team(b, b.qz.id)).verlauf;
    expect(verlauf.map((v) => [v.version, v.vorgang])).toEqual([
      [1, "angelegt"],
      [2, "archiviert"],
    ]);
  });
});

describe("K6 · Nach erneutem Lesen nachvollziehbar; Unberechtigte verwalten nichts", () => {
  it("Liste, Mitglieder und Rechteänderungen stehen im Verlauf und im Prüfprotokoll", async () => {
    const b = await mitSpaces();
    expect((await mitgliederSetzen(b, b.mess.id, [b.ids.erik])).statusCode).toBe(200);
    expect((await mitgliederSetzen(b, b.mess.id, [b.ids.erik, b.ids.fritz])).statusCode).toBe(200);

    const liste = (await lies(b, b.k.admin, "/api/teams")).json().teams as {
      id: string;
      name: string;
      mitglieder: { nutzer: string }[];
      spaces: { name: string; recht: string }[];
    }[];
    expect(liste.map((t) => t.name)).toEqual(["Messtechnik", "Qualitätszirkel"]);
    const mess = liste.find((t) => t.id === b.mess.id);
    expect(mess?.mitglieder.map((m) => m.nutzer)).toEqual([b.ids.erik, b.ids.fritz]);
    expect(mess?.spaces).toEqual([
      { id: b.laborId, name: "Labor", recht: "lesen" },
      { id: b.werkstattId, name: "Werkstatt", recht: "schreiben" },
    ]);

    const verlauf = (await team(b, b.mess.id)).verlauf;
    expect(
      verlauf.map((v) => ({
        v: v.version,
        hinzu: v.hinzugefuegt.map((x) => x.id),
        weg: v.entfernt.map((x) => x.id),
      })),
    ).toEqual([
      { v: 1, hinzu: [b.ids.erik, b.ids.vera], weg: [] },
      { v: 2, hinzu: [], weg: [b.ids.vera] },
      { v: 3, hinzu: [b.ids.fritz], weg: [] },
    ]);
    const geaendert = (await protokoll(b)).filter(
      (e) => e.target === b.mess.id && e.action === "team.geaendert",
    );
    expect(geaendert.map((e) => e.payload)).toEqual([
      expect.objectContaining({ entfernt: [b.ids.vera], hinzugefuegt: [] }),
      expect.objectContaining({ entfernt: [], hinzugefuegt: [b.ids.fritz] }),
    ]);
    for (const e of geaendert) {
      expect(e.actor).toBe(b.ids.admin);
    }
  });

  it("Controller, Experte und Betrachter: 403 auf jedem Teamweg, nichts geschrieben, nichts protokolliert", async () => {
    const b = await mitSpaces();
    const vorher = JSON.stringify(await b.services.teams.aktuelle());
    const protokollVorher = (await protokoll(b)).length;
    const t = (await team(b, b.mess.id)).team;
    for (const kopf of [b.k.carla, b.k.erik, b.k.vera]) {
      const versuche = [
        { method: "GET" as const, url: "/api/teams" },
        { method: "GET" as const, url: `/api/teams/${b.mess.id}` },
        {
          method: "POST" as const,
          url: "/api/teams",
          payload: { name: "Fremd", zweck: "x", verantwortlich: b.ids.carla, mitglieder: [] },
        },
        {
          method: "POST" as const,
          url: `/api/teams/${b.mess.id}/vorschau`,
          payload: { mitglieder: [] },
        },
        {
          method: "PUT" as const,
          url: `/api/teams/${b.mess.id}`,
          payload: { ...t, mitglieder: [b.ids.fritz], grundlage: "x" },
        },
        {
          method: "POST" as const,
          url: `/api/teams/${b.mess.id}/archivieren`,
          payload: { version: t.version, grundlage: "x" },
        },
      ];
      for (const v of versuche) {
        const res = await b.app.inject({ ...v, headers: kopf });
        expect(res.statusCode, `${v.method} ${v.url}: ${res.body}`).toBe(403);
      }
    }
    expect(JSON.stringify(await b.services.teams.aktuelle())).toBe(vorher);
    expect((await protokoll(b)).length).toBe(protokollVorher);
    // Ohne Anmeldung: 401.
    expect((await b.app.inject({ method: "GET", url: "/api/teams" })).statusCode).toBe(401);
  });
});
