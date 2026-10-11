// ================================================================================================
// VERSTÄNDNISFRAGEN · ANNAHME NACH DER BESTEHENDEN KONTOREGEL (Nacharbeit 3, Befund Ben).
// ================================================================================================
//
// Gemessen an der ECHTEN App (`buildApp(buildServices())`, Speicherablage) mit einem Space, dessen
// Freigaberegel (ADMIN-09) über dieselben Türen gesetzt wird wie in `tests/freigaberegeln/…`.
// Alle Konten, Spaces und Inhalte sind erfundene Testdaten dieses Falls.
//
//   Ada    (admin)      — Kontoverwaltung, Spacezuständige
//   Carla  (controller) — Prüferin 1 der Regel
//   Paul   (controller) — Prüfer 2 der Regel
//   Ulli   (controller) — Mitglied, Freigaberecht, aber NICHT im Prüferkreis
//   Erik   (experte)    — verantwortet den Eintrag und verfasst den Fragensatz
//
//   R1  (K15) Regel „2 Zustimmungen, Prüfer Carla+Paul": Ulli wird abgewiesen (nicht im Kreis);
//       eine Zustimmung veröffentlicht nichts (Lernende: kein Fragensatz, Abgabe 409); dieselbe
//       Prüferin stimmt nicht zweimal; erst die zweite Prüferin nimmt an. Belege im Prüfprotokoll.
//   R2  (K15) Mehr-Augen-Prinzip: wer die Version verfasst hat, nimmt sie nicht an — auch nicht als
//       Prüferin im Kreis.
//   R3  (K15) Ohne Regel bleibt die direkte Annahme durch Freigabeberechtigte erhalten (S1 in
//       `am-server.test.ts`); hier die Gegenprobe: die Bearbeitungssicht meldet die Regel samt
//       Zählung, ohne Regel „direkt".
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = { authorization: string };

const KENNWORT = "geheim12345";
const AUSSAGE =
  "Der Drehmomentschlüssel geht jährlich zum externen Kalibrierdienst und wird danach plombiert.";

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

function schicke(app: App, kopf: Kopf, url: string, payload: unknown, method = "POST") {
  return app.inject({ method: method as "POST", url, headers: kopf, payload: payload as object });
}

async function buehne() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "ada@vf-regel.test", password: KENNWORT },
  });
  const ada = await anmelden(app, "ada@vf-regel.test");
  for (const [name, email, role] of [
    ["Carla Controller", "carla@vf-regel.test", "controller"],
    ["Paul Prüfer", "paul@vf-regel.test", "controller"],
    ["Ulli Unbefugt", "ulli@vf-regel.test", "controller"],
    ["Erik Experte", "erik@vf-regel.test", "experte"],
  ] as const) {
    const res = await schicke(app, ada, "/api/users", { name, email, password: KENNWORT, role });
    expect(res.statusCode, `Konto ${email}: ${res.body}`).toBe(201);
  }
  const k = {
    ada,
    carla: await anmelden(app, "carla@vf-regel.test"),
    paul: await anmelden(app, "paul@vf-regel.test"),
    ulli: await anmelden(app, "ulli@vf-regel.test"),
    erik: await anmelden(app, "erik@vf-regel.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: ada });
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = {
    ada: id("Ada Admin"),
    carla: id("Carla Controller"),
    paul: id("Paul Prüfer"),
    ulli: id("Ulli Unbefugt"),
    erik: id("Erik Experte"),
  };
  const space = await schicke(app, ada, "/api/spaces", {
    name: "Werkstatt Beispiel",
    zweck: "Prüfmittel der Werkstatt (fiktiv).",
    verantwortlich: ids.ada,
    zugang: "mitglieder",
    mitglieder: [
      { nutzer: ids.carla, recht: "schreiben" },
      { nutzer: ids.paul, recht: "lesen" },
      { nutzer: ids.ulli, recht: "lesen" },
      { nutzer: ids.erik, recht: "schreiben" },
    ],
    ansichten: [],
  });
  expect(space.statusCode, space.body).toBe(201);
  const spaceId = space.json().id as string;

  // Eriks Eintrag im Space, gültig gesetzt (Vorbereitung über den Dienst, wie in am-server.test.ts).
  const angelegt = await schicke(app, k.erik, "/api/kos", {
    confidentiality: "intern",
    title: "Drehmomentschlüssel kalibrieren (Beispiel)",
    statement: AUSSAGE,
    type: "best_practice",
    category: "Prüfmittel",
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const koId = angelegt.json().id as string;
  const vv = await schicke(app, k.erik, "/api/spaces/verschiebung/vorschau", {
    koId,
    zielSpaceId: spaceId,
  });
  expect(vv.statusCode, vv.body).toBe(200);
  const p = vv.json() as { ziel: { version: number }; grundlage: string };
  const verschoben = await schicke(app, k.erik, "/api/spaces/verschiebung", {
    koId,
    zielSpaceId: spaceId,
    basis: {
      quelleId: null,
      quelleVersion: null,
      zielId: spaceId,
      zielVersion: p.ziel.version,
      grundlage: p.grundlage,
    },
  });
  expect(verschoben.statusCode, verschoben.body).toBe(200);
  const gueltig = await services.ko.setValidationState(koId, { trust: 80, status: "validiert" });
  return { app, services, k, ids, spaceId, koId, koVersion: gueltig.version };
}

type Buehne = Awaited<ReturnType<typeof buehne>>;

/** Setzt die Freigaberegel des Space über Vorschau und Bestätigung (dieselben Türen wie ADMIN-09). */
async function regelSetzen(b: Buehne, regel: Record<string, unknown>): Promise<void> {
  const url = `/api/spaces/${b.spaceId}/freigaberegel`;
  const vorschau = await schicke(b.app, b.k.ada, `${url}/vorschau`, { regel });
  expect(vorschau.statusCode, vorschau.body).toBe(200);
  const v = vorschau.json() as { spaceVersion: number; grundlage: string };
  const bestaetigt = { version: v.spaceVersion, regel, grundlage: v.grundlage };
  const gesetzt = await schicke(b.app, b.k.ada, url, bestaetigt, "PUT");
  expect(gesetzt.statusCode, gesetzt.body).toBe(200);
}

function inhalt(b: Buehne) {
  return {
    koVersion: b.koVersion,
    titel: "Drehmomentschlüssel · Verständnis",
    rollen: ["controller"],
    regel: { mindestRichtig: 1, hoechstVersuche: 2 },
    fragen: [
      {
        text: "Wohin geht der Drehmomentschlüssel jährlich?",
        optionen: ["Zum externen Kalibrierdienst", "In den Schrott"],
        richtig: [0],
        erlaeuterung: "Die Anweisung nennt den externen Kalibrierdienst.",
        beleg: "jährlich zum externen Kalibrierdienst",
      },
    ],
  };
}

async function fragensatz(b: Buehne, kopf: Kopf): Promise<string> {
  const r = await schicke(b.app, kopf, `/api/kos/${b.koId}/verstaendnisfragen`, inhalt(b));
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
}

const entscheiden = (b: Buehne, kopf: Kopf, id: string, version = 1) =>
  schicke(b.app, kopf, `/api/verstaendnisfragen/${id}/entscheiden`, {
    version,
    entscheidung: "annehmen",
  });

interface Satz {
  gueltig: { version: number } | null;
  bearbeitung: {
    status: string;
    annahme: {
      regel: { zustimmungen: number } | null;
      erforderlich: number;
      zustimmungen: number;
      darfEntscheiden: boolean;
      hindernis: string | null;
    };
  } | null;
}

async function sicht(b: Buehne, kopf: Kopf): Promise<Satz[]> {
  const r = await b.app.inject({
    method: "GET",
    url: `/api/kos/${b.koId}/verstaendnisfragen`,
    headers: kopf,
  });
  expect(r.statusCode, r.body).toBe(200);
  return r.json().fragensaetze as Satz[];
}

const REGEL = {
  zustimmungen: 2,
  prueferTeams: [] as string[],
  fristTage: null,
  vertretungen: [] as unknown[],
};

const versuch = (b: Buehne, kopf: Kopf, id: string, versuchId: string) =>
  schicke(b.app, kopf, `/api/verstaendnisfragen/${id}/versuche`, {
    versuchId,
    version: 1,
    antworten: [{ frageId: "f1", gewaehlt: ["o1"] }],
  });

describe("R1 · vorgeschriebene Prüfung: Prüferkreis und Mindestzahl", () => {
  it("außerhalb des Kreises abgewiesen; eine Zustimmung veröffentlicht nichts", async () => {
    const b = await buehne();
    await regelSetzen(b, { ...REGEL, pruefer: [b.ids.carla, b.ids.paul] });
    const id = await fragensatz(b, b.k.erik);
    const vorgelegt = await schicke(b.app, b.k.erik, `/api/verstaendnisfragen/${id}/vorlegen`, {
      version: 1,
    });
    expect(vorgelegt.statusCode, vorgelegt.body).toBe(200);

    // Ulli hat Freigaberecht, gehört aber nicht zum Prüferkreis der Regel.
    const ulli = await entscheiden(b, b.k.ulli, id);
    expect(ulli.statusCode).toBe(403);
    expect(ulli.json().grund).toBe("nicht_berechtigt");

    // Erste Zustimmung (Carla): nichts veröffentlicht — die Version bleibt „vorgelegt".
    const erste = await entscheiden(b, b.k.carla, id);
    expect(erste.statusCode, erste.body).toBe(200);
    expect(erste.json().status).toBe("vorgelegt");
    expect(erste.json().zustimmungen).toHaveLength(1);
    const vorzeitig = await versuch(b, b.k.ulli, id, "versuch-vorzeitig-1");
    expect(vorzeitig.statusCode).toBe(409);
    expect(vorzeitig.json().grund).toBe("nicht_angenommen");
    expect((await sicht(b, b.k.ulli))[0]?.gueltig).toBeNull();

    // Dieselbe Prüferin zählt nicht zweimal.
    const nochmal = await entscheiden(b, b.k.carla, id);
    expect(nochmal.statusCode).toBe(409);
    expect(nochmal.json().grund).toBe("bereits_zugestimmt");

    // Pauls Sicht: Regel, Zählung, er darf entscheiden.
    const paulsSicht = (await sicht(b, b.k.paul))[0]?.bearbeitung?.annahme;
    expect(paulsSicht).toMatchObject({
      regel: { zustimmungen: 2 },
      erforderlich: 2,
      zustimmungen: 1,
      darfEntscheiden: true,
      hindernis: null,
    });

    // Zweite Zustimmung (Paul): jetzt angenommen.
    const zweite = await entscheiden(b, b.k.paul, id);
    expect(zweite.statusCode, zweite.body).toBe(200);
    expect(zweite.json().status).toBe("angenommen");
    expect((await sicht(b, b.k.ulli))[0]?.gueltig?.version).toBe(1);
    expect((await versuch(b, b.k.ulli, id, "versuch-danach-1")).statusCode).toBe(201);

    const zugestimmt = await b.services.audit.list({ action: "verstaendnisfragen.zugestimmt" });
    const angenommen = await b.services.audit.list({ action: "verstaendnisfragen.angenommen" });
    expect(zugestimmt.map((e) => e.actor)).toEqual([b.ids.carla]);
    expect(angenommen.map((e) => e.actor)).toEqual([b.ids.paul]);
    expect(angenommen[0]?.payload).toMatchObject({ zustimmungen: 2, erforderlich: 2 });
  });
});

describe("R2 · Mehr-Augen-Prinzip", () => {
  it("wer die Version verfasst hat, nimmt sie nicht an — auch als Prüferin nicht", async () => {
    const b = await buehne();
    await regelSetzen(b, { ...REGEL, zustimmungen: 1, pruefer: [b.ids.carla, b.ids.paul] });
    const id = await fragensatz(b, b.k.carla);
    const selbst = await entscheiden(b, b.k.carla, id);
    expect(selbst.statusCode).toBe(403);
    expect(selbst.json().grund).toBe("selbstpruefung");
    expect((await sicht(b, b.k.carla))[0]?.bearbeitung?.annahme.hindernis).toBe("selbstpruefung");
    // Die andere Prüferin nimmt an — bei einer verlangten Zustimmung sofort.
    const paul = await entscheiden(b, b.k.paul, id);
    expect(paul.statusCode, paul.body).toBe(200);
    expect(paul.json().status).toBe("angenommen");
  });
});

describe("R3 · ohne Regel bleibt die direkte Annahme", () => {
  it("die Bearbeitungssicht meldet „keine Regel“, und eine Zustimmung nimmt an", async () => {
    const b = await buehne();
    const id = await fragensatz(b, b.k.erik);
    const lage = (await sicht(b, b.k.ulli))[0]?.bearbeitung?.annahme;
    expect(lage).toMatchObject({ regel: null, erforderlich: 1, darfEntscheiden: true });
    const r = await entscheiden(b, b.k.ulli, id);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().status).toBe("angenommen");
  });
});
