// ================================================================================================
// R-1656 · „DU SOLLTEST AUCH WISSEN…" — DIE AUSKUNFT AM SERVER, GEGEN DIE ECHTE APP.
// ================================================================================================
//
// Originalwortlaut: „Wenn jemand ein Wissensobjekt liest, schlägt KLARWERK verwandte Objekte vor —
// basierend auf Co-Reading-Muster, Themen-Nähe und Konflikt-Verknüpfungen."
//
//   S1  Die Türen: ohne Anmeldung keine Auskunft, unbekannter Eintrag 404.
//   S2  Alle drei Gründe kommen an, jeder an seiner Gegenseite; ein Konflikt steht vorn.
//   S3  Co-Reading ist ein MUSTER: unter drei Konten zählt es nicht, dasselbe Konto zählt einmal.
//   S4  Ein unsichtbarer Eintrag existiert nicht — weder als Empfehlung noch als Meldeziel.
//   S5  Das Signal speichert keine Kontokennung (Schema) und verlangt einen ANDEREN Vorgänger.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MITGELESEN_SCHEMA } from "../../services/app/src/wissensempfehlung";
import type { Confidentiality } from "../../services/knowledge-object";

type TestApp = ReturnType<typeof buildApp>;
type Services = Awaited<ReturnType<typeof buildServices>>;

interface Antwort {
  koId: string;
  empfehlungen: Array<{
    id: string;
    title: string;
    gruende: Array<
      | { art: "mitgelesen"; anzahl: number }
      | { art: "thema"; schlagwoerter: string[] }
      | { art: "konflikt"; stand: string }
    >;
  }>;
  total: number;
  truncated: boolean;
}

async function aufbau(): Promise<{
  app: TestApp;
  services: Services;
  kopf: (email: string) => Promise<Record<string, string>>;
}> {
  const services = await buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const kopf = async (email: string): Promise<Record<string, string>> => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  };
  const admin = await kopf("admin@x.de");
  for (const [name, email, role] of [
    ["Expertin", "expertin@x.de", "experte"],
    ["Controllerin", "controllerin@x.de", "controller"],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin,
      payload: { name, email, password: "secret123", role },
    });
  }
  return { app, services, kopf };
}

async function eintrag(
  services: Services,
  title: string,
  tags: string[],
  confidentiality: Confidentiality = "intern",
): Promise<string> {
  const ko = await services.ko.create({
    title,
    statement: `Aussage zu ${title}`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    tags,
    confidentiality,
  });
  return ko.id;
}

async function mitgelesen(app: TestApp, kopf: Record<string, string>, id: string, zuvor: string) {
  return app.inject({
    method: "POST",
    url: `/api/kos/${id}/mitgelesen`,
    headers: kopf,
    payload: { zuvor },
  });
}

async function empfehlungen(app: TestApp, kopf: Record<string, string>, id: string) {
  const res = await app.inject({
    method: "GET",
    url: `/api/kos/${id}/empfehlungen`,
    headers: kopf,
  });
  return { status: res.statusCode, roh: res.body, body: res.json() as Antwort };
}

describe("S1 · die Türen", () => {
  it("ohne Anmeldung keine Auskunft, unbekannter Eintrag 404", async () => {
    const { app, services, kopf } = await aufbau();
    const a = await eintrag(services, "Ventil", ["ventil"]);
    const ohne = await app.inject({ method: "GET", url: `/api/kos/${a}/empfehlungen` });
    expect([401, 403]).toContain(ohne.statusCode);
    const ohnePost = await app.inject({
      method: "POST",
      url: `/api/kos/${a}/mitgelesen`,
      payload: { zuvor: a },
    });
    expect([401, 403]).toContain(ohnePost.statusCode);
    const unbekannt = await app.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/empfehlungen",
      headers: await kopf("expertin@x.de"),
    });
    expect(unbekannt.statusCode).toBe(404);
    await app.close();
  });
});

describe("S2 · Co-Reading, Themennähe und Konflikt — jeder Grund an seiner Gegenseite", () => {
  it("drei Gegenseiten, drei Gründe; der Konflikt steht vorn", async () => {
    const { app, services, kopf } = await aufbau();
    const a = await eintrag(services, "Kaltstart mit Vorwärmung", ["kaltstart"]);
    const thema = await eintrag(services, "Kaltstart ohne Vorwärmung", ["kaltstart"]);
    const konflikt = await eintrag(services, "Vorwärmung ist überflüssig", ["heizung"]);
    const gelesen = await eintrag(services, "Ölwechsel im Winter", ["oel"]);
    await services.conflicts.create(
      { koA: a, koB: konflikt, type: "truth", description: "Widerspruch zur Vorwärmung" },
      "admin",
    );
    for (const email of ["admin@x.de", "expertin@x.de", "controllerin@x.de"]) {
      const res = await mitgelesen(app, await kopf(email), gelesen, a);
      expect(res.statusCode).toBe(200);
      expect((res.json() as { gezaehlt: boolean }).gezaehlt).toBe(true);
    }

    const expertin = await kopf("expertin@x.de");
    const { status, body } = await empfehlungen(app, expertin, a);
    expect(status).toBe(200);
    expect(body.koId).toBe(a);
    expect(body.empfehlungen.map((e) => e.id)).toEqual([konflikt, gelesen, thema]);
    const je = new Map(body.empfehlungen.map((e) => [e.id, e.gruende]));
    expect(je.get(konflikt)).toEqual([{ art: "konflikt", stand: "offen" }]);
    expect(je.get(gelesen)).toEqual([{ art: "mitgelesen", anzahl: 3 }]);
    expect(je.get(thema)).toEqual([{ art: "thema", schlagwoerter: ["kaltstart"] }]);
    // Das Paar ist ungeordnet: von der Gegenseite aus gilt dasselbe Muster.
    const zurueck = await empfehlungen(app, expertin, gelesen);
    expect(zurueck.body.empfehlungen.map((e) => e.id)).toContain(a);
    await app.close();
  });

  it("ein entschiedener Konflikt mit Vorrang heisst „entschieden“, nicht „offen“", async () => {
    const { app, services, kopf } = await aufbau();
    const a = await eintrag(services, "Druckprüfung jährlich", ["druck"]);
    const b = await eintrag(services, "Druckprüfung halbjährlich", ["intervall"]);
    const k = await services.conflicts.create(
      { koA: a, koB: b, type: "context", description: "Intervall" },
      "admin",
    );
    const expertin = await kopf("expertin@x.de");
    const vorher = await empfehlungen(app, expertin, a);
    expect(vorher.body.empfehlungen.find((e) => e.id === b)?.gruende).toEqual([
      { art: "konflikt", stand: "offen" },
    ]);
    const wahl = { art: "ueberstimmt" as const, gilt: a };
    await services.conflicts.resolve(k.id, "controllerin", "A gilt", wahl);
    const nachher = await empfehlungen(app, expertin, a);
    expect(nachher.body.empfehlungen.find((e) => e.id === b)?.gruende).toEqual([
      { art: "konflikt", stand: "entschieden" },
    ]);
    await app.close();
  });
});

describe("S3 · ein Muster, nicht der Weg einzelner Menschen", () => {
  it("zwei Konten reichen nicht; dasselbe Konto zählt dasselbe Paar nur einmal", async () => {
    const { app, services, kopf } = await aufbau();
    const a = await eintrag(services, "Anlage A", ["a"]);
    const b = await eintrag(services, "Anlage B", ["b"]);
    const expertin = await kopf("expertin@x.de");
    expect((await mitgelesen(app, expertin, b, a)).json()).toEqual({ gezaehlt: true });
    // Dasselbe Paar in umgekehrter Richtung und noch einmal: dieselbe Sperre.
    expect((await mitgelesen(app, expertin, a, b)).json()).toEqual({ gezaehlt: false });
    expect((await mitgelesen(app, expertin, b, a)).json()).toEqual({ gezaehlt: false });
    await mitgelesen(app, await kopf("controllerin@x.de"), b, a);
    const zwei = (await empfehlungen(app, expertin, a)).body;
    expect(zwei.empfehlungen).toEqual([]);
    expect(zwei.total).toBe(0);
    await mitgelesen(app, await kopf("admin@x.de"), b, a);
    const drei = (await empfehlungen(app, expertin, a)).body;
    expect(drei.empfehlungen).toEqual([
      { id: b, title: "Anlage B", status: "offen", gruende: [{ art: "mitgelesen", anzahl: 3 }] },
    ]);
    await app.close();
  });
});

describe("S4 · ein unsichtbarer Eintrag existiert nicht", () => {
  it("vertraulich: keine Empfehlung, keine Zählung, kein Zählerleck — für die Kuratorin schon", async () => {
    const { app, services, kopf } = await aufbau();
    const a = await eintrag(services, "Zentrum Wartungsplan", ["wartung"]);
    const geheim = await eintrag(services, "Geheimer Preis", ["wartung"], "vertraulich");
    await services.conflicts.create(
      { koA: a, koB: geheim, type: "truth", description: "Preis" },
      "admin",
    );
    const expertin = await kopf("expertin@x.de");
    // Die Expertin darf den vertraulichen Eintrag nicht sehen — sie kann ihn auch nicht melden.
    expect((await mitgelesen(app, expertin, a, geheim)).statusCode).toBe(404);
    expect((await mitgelesen(app, expertin, geheim, a)).statusCode).toBe(404);
    const sicht = await empfehlungen(app, expertin, a);
    expect(sicht.status).toBe(200);
    expect(sicht.roh).not.toContain(geheim);
    expect(sicht.roh).not.toContain("Geheimer Preis");
    expect(sicht.body.total).toBe(0);
    // Ein unsichtbares ZENTRUM sieht aus wie ein fehlendes.
    expect((await empfehlungen(app, expertin, geheim)).status).toBe(404);
    // Kalibrierung: die Kuratorin (ko.validate) sieht denselben Eintrag mit beiden Gründen.
    const kuratorin = (await empfehlungen(app, await kopf("controllerin@x.de"), a)).body;
    expect(kuratorin.empfehlungen.find((e) => e.id === geheim)?.gruende).toEqual([
      { art: "konflikt", stand: "offen" },
      { art: "thema", schlagwoerter: ["wartung"] },
    ]);
    await app.close();
  });
});

describe("S5 · ohne Personenbezug, nur ein anderer Vorgänger", () => {
  it("die Tabelle trägt Paar und Zahl — keine Kontokennung, keinen Zeitpunkt", () => {
    const zeilen = [...MITGELESEN_SCHEMA.matchAll(/^[ \t]+(\w+)[ \t]+(text|integer)/gm)];
    const spalten = zeilen.map((m) => m[1]);
    expect(spalten).toEqual(["ko_a", "ko_b", "anzahl"]);
  });

  it("ohne `zuvor` oder mit demselben Eintrag: 400, nichts gezählt", async () => {
    const { app, services, kopf } = await aufbau();
    const a = await eintrag(services, "Anlage A", ["a"]);
    const expertin = await kopf("expertin@x.de");
    const ohne = await app.inject({
      method: "POST",
      url: `/api/kos/${a}/mitgelesen`,
      headers: expertin,
      payload: {},
    });
    expect(ohne.statusCode).toBe(400);
    expect((await mitgelesen(app, expertin, a, a)).statusCode).toBe(400);
    await app.close();
  });
});
