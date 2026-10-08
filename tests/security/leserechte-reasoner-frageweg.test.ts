// ================================================================================================
// aufnahme:20260922:gesamt-leserechte · Ben, Nacharbeit 8 — DER DIREKTE FRAGEWEG DES REASONERS.
// ================================================================================================
//
// DER BEFUND: `POST /api/reasoner` mit `task: "ask"` rief `ask.ask` in beiden Zweigen OHNE
// Grundlagefilter. Der Dienst nahm dann die gesamte Vorauswahl — ein internes, validiertes Objekt
// aus einem Space, den der Fragende nicht lesen darf, konnte Antwortgrundlage und Quelle werden.
// Die Vertraulichkeitsfilterung greift hier nicht, weil das Objekt nicht vertraulich ist.
//
// GEMESSEN über die echten Routen (buildApp, Anwendungsspeicher): ein Space mit Mitgliedern, ein
// internes, freigegebenes Objekt darin.
//   · Mitglied (Erik)       → das Objekt ist Quelle (GEGENPROBE: der Weg trägt).
//   · Nichtmitglied (Fritz) → weder Kennung noch Wortlaut in der Antwort.
//   · Rechteentzug          → Erik wird aus dem Space genommen; der NÄCHSTE Abruf liefert nichts mehr.
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

const KENNWORT = "geheim12345";
// Ein Wort, das NUR im Testobjekt steht — jede Fundstelle gehört eindeutig zu ihm.
const WORT = "Spindelkalibrierschritt";
const AUSSAGE = `Der ${WORT} läuft vor jeder Schicht mit dem Referenzblock.`;

async function anmelden(app: App, email: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: KENNWORT },
  });
  expect(res.statusCode, `Anmeldung ${email}: ${res.body}`).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

// Der Dienst-Schlüssel für den Add-on-/Dienst-Zweig von `/api/ask` (nur Prüfsumme in der Umgebung).
const FRAGE_SCHLUESSEL = "leserechte-frageweg-schluessel-0123456789abcdef01";
const SCHLUESSEL_ENV = "KLARWERK_SERVICE_KEYS";
const vorherSchluessel = process.env[SCHLUESSEL_ENV];
afterEach(() => {
  if (vorherSchluessel === undefined) {
    delete process.env[SCHLUESSEL_ENV];
  } else {
    process.env[SCHLUESSEL_ENV] = vorherSchluessel;
  }
});

async function buehne(opts: { mitFrageSchluessel?: boolean } = {}) {
  if (opts.mitFrageSchluessel) {
    process.env[SCHLUESSEL_ENV] = JSON.stringify([
      {
        id: "frage-bot",
        sha256: [createHash("sha256").update(FRAGE_SCHLUESSEL, "utf8").digest("hex")],
        rechte: ["ask.validated"],
      },
    ]);
  }
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Admin", email: "admin@reasoner-ask.test", password: KENNWORT },
  });
  const admin = await anmelden(app, "admin@reasoner-ask.test");
  for (const [name, email, role] of [
    ["Lea Leitung", "lea@reasoner-ask.test", "experte"],
    ["Erik Experte", "erik@reasoner-ask.test", "experte"],
    ["Carla Controller", "carla@reasoner-ask.test", "controller"],
    ["Fritz Fremd", "fritz@reasoner-ask.test", "experte"],
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
    lea: await anmelden(app, "lea@reasoner-ask.test"),
    erik: await anmelden(app, "erik@reasoner-ask.test"),
    carla: await anmelden(app, "carla@reasoner-ask.test"),
    fritz: await anmelden(app, "fritz@reasoner-ask.test"),
  };
  const liste = await app.inject({ method: "GET", url: "/api/spaces/konten", headers: k.erik });
  expect(liste.statusCode, liste.body).toBe(200);
  const id = (name: string): string =>
    (liste.json().konten as { id: string; name: string }[]).find((x) => x.name === name)?.id ?? "";
  const ids = { lea: id("Lea Leitung"), erik: id("Erik Experte"), carla: id("Carla Controller") };

  // Der Space — Lea zuständig, Erik schreibt, Carla liest; Fritz und der Admin sind keine Mitglieder.
  const raum = {
    name: "Werkstatt Süd",
    zweck: "Prüfmittel und Arbeitsanweisungen der Werkstatt Süd.",
    verantwortlich: ids.lea,
    zugang: "mitglieder",
    ansichten: [],
  };
  const space = await app.inject({
    method: "POST",
    url: "/api/spaces",
    headers: k.carla,
    payload: {
      ...raum,
      mitglieder: [
        { nutzer: ids.erik, recht: "schreiben" },
        { nutzer: ids.carla, recht: "lesen" },
      ],
    },
  });
  expect(space.statusCode, space.body).toBe(201);
  const spaceId = (space.json() as { id: string }).id;

  // Das interne Objekt: angelegt von Erik, vom Admin freigegeben, DANN in den Space verschoben.
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: k.erik,
    payload: {
      confidentiality: "intern",
      title: `${WORT} am Messplatz`,
      statement: AUSSAGE,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(ko.statusCode, ko.body).toBe(201);
  const koId = ko.json().id as string;
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: admin,
    payload: { action: "admin-validate", duplicateAcknowledged: true },
  });
  expect(frei.statusCode, frei.body).toBe(200);
  const v = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung/vorschau",
    headers: k.erik,
    payload: { koId, zielSpaceId: spaceId },
  });
  expect(v.statusCode, v.body).toBe(200);
  const vor = v.json() as {
    quelle: { id: string; version: number } | null;
    ziel: { id: string; version: number } | null;
  };
  const verschoben = await app.inject({
    method: "POST",
    url: "/api/spaces/verschiebung",
    headers: k.erik,
    payload: {
      koId,
      zielSpaceId: spaceId,
      basis: {
        quelleId: vor.quelle?.id ?? null,
        quelleVersion: vor.quelle?.version ?? null,
        zielId: vor.ziel?.id ?? null,
        zielVersion: vor.ziel?.version ?? null,
      },
    },
  });
  expect(verschoben.statusCode, verschoben.body).toBe(200);

  return { app, k, ids, raum, spaceId, koId, admin };
}

/** Ein weiteres, freigegebenes Objekt des Admins — intern oder vertraulich, ohne Space. */
async function freigegebenesObjekt(
  app: App,
  admin: Kopf,
  felder: { title: string; statement: string; vertraulich?: boolean },
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: admin,
    payload: {
      confidentiality: "intern",
      title: felder.title,
      statement: felder.statement,
      type: "best_practice",
      category: "Prüfmittel",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  const id = res.json().id as string;
  if (felder.vertraulich) {
    const stufe = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
  }
  const frei = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers: admin,
    payload: { action: "admin-validate", duplicateAcknowledged: true },
  });
  expect(frei.statusCode, frei.body).toBe(200);
  return id;
}

const fragen = (app: App, kopf: Kopf) =>
  app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: kopf,
    payload: { task: "ask", text: `Wie läuft der ${WORT}?` },
  });

const quellenAus = (body: unknown): string[] =>
  (body as { result?: { sources?: string[] } }).result?.sources ?? [];

describe("POST /api/reasoner (task ask) — Grundlage nur aus dem, was der Fragende sehen darf", () => {
  it("Space-Mitglied bekommt das Objekt als Quelle, ein Nichtmitglied erfährt nichts davon", async () => {
    const { app, k, koId } = await buehne();

    // GEGENPROBE: das Mitglied bekommt den Weg — sonst bewiese die Sperre unten nichts.
    const erik = await fragen(app, k.erik);
    expect(erik.statusCode, erik.body).toBe(200);
    expect(quellenAus(erik.json()), erik.body.slice(0, 400)).toContain(koId);

    for (const [wer, kopf] of [
      ["Fritz (kein Mitglied)", k.fritz],
      ["Admin (Kontoverwaltung, kein Mitglied)", k.admin],
    ] as const) {
      const res = await fragen(app, kopf);
      expect(res.statusCode, `${wer}: ${res.body}`).toBe(200);
      expect(quellenAus(res.json()), wer).not.toContain(koId);
      expect(res.body, wer).not.toContain(koId);
      expect(res.body, wer).not.toContain(AUSSAGE);
    }
    await app.close();
  });

  it("Rechteentzug: aus dem Space genommen — der nächste Abruf liefert das Objekt nicht mehr", async () => {
    const { app, k, ids, raum, spaceId, koId } = await buehne();
    const vorher = await fragen(app, k.erik);
    expect(quellenAus(vorher.json()), vorher.body.slice(0, 400)).toContain(koId);

    const entzug = await app.inject({
      method: "PUT",
      url: `/api/spaces/${spaceId}`,
      headers: k.lea,
      payload: { ...raum, version: 1, mitglieder: [{ nutzer: ids.carla, recht: "lesen" }] },
    });
    expect(entzug.statusCode, entzug.body).toBe(200);

    const nachher = await fragen(app, k.erik);
    expect(nachher.statusCode, nachher.body).toBe(200);
    expect(quellenAus(nachher.json())).not.toContain(koId);
    expect(nachher.body).not.toContain(koId);
    expect(nachher.body).not.toContain(AUSSAGE);
    await app.close();
  });
});

// ------------------------------------------------------------------------------------------------
// Der Add-on-/Dienst-Zweig von `POST /api/ask` (ask-routes.ts: ohne Sitzungsnutzer gilt als
// Grundlage nur Inhalt ohne Space oder aus offenen Spaces, dazu `validatedOnly` und
// `dropConfidential`). „Nur validiert" belegen bereits `f0688-schluessel-api-nur-validiert` und
// `integrations-api/dienst-schluessel-am-draht` (D3). Was dort fehlt — Vertraulichkeit und
// geschlossener Space für den Schlüssel —, steht hier.
// ------------------------------------------------------------------------------------------------
describe("POST /api/ask mit Dienst-Schlüssel — nie aus geschlossenem Space, nie Vertrauliches", () => {
  it("Gegenprobe offenes Objekt; gesperrt sind vertrauliches Objekt und Objekt im Mitglieder-Space", async () => {
    const { app, admin, koId: imSpaceId } = await buehne({ mitFrageSchluessel: true });
    // Alle drei Objekte tragen JEDEN gebundenen Fragebegriff („läuft", WORT) — sonst fiele ein
    // Objekt schon an der Begriffsregel R-0473 (`decktAlleFragebegriffe`), und sein Fehlen bewiese
    // nichts über Space oder Vertraulichkeit.
    const offenId = await freigegebenesObjekt(app, admin, {
      title: `${WORT} im offenen Handbuch`,
      statement: `Der ${WORT} läuft laut offenem Handbuch in drei Teilschritten.`,
    });
    const geheimAussage = `Der ${WORT} der Rezepturlinie läuft nur unter Aufsicht.`;
    const geheimId = await freigegebenesObjekt(app, admin, {
      title: `${WORT} der Rezepturlinie`,
      statement: geheimAussage,
      vertraulich: true,
    });

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { "x-klarwerk-service-key": FRAGE_SCHLUESSEL },
      payload: { question: `Wie läuft der ${WORT}?` },
    });
    expect(res.statusCode, res.body).toBe(200);
    const quellen = quellenAus(res.json());
    // GEGENPROBE: der Schlüssel ist nicht blind — das offene, validierte Objekt kommt an.
    expect(quellen, res.body.slice(0, 400)).toContain(offenId);
    for (const [was, id, aussage] of [
      ["Objekt im Mitglieder-Space", imSpaceId, AUSSAGE],
      ["vertrauliches Objekt", geheimId, geheimAussage],
    ] as const) {
      expect(quellen, was).not.toContain(id);
      expect(res.body, was).not.toContain(id);
      expect(res.body, was).not.toContain(aussage);
    }
    await app.close();
  });
});
