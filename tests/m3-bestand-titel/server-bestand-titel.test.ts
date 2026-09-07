// JOB 3128: Serverweg des Word-taskpane über echte Anmeldung, Repository, Retrieval und Scorer.
// Kein Modell-Fake erzeugt Treffer. Der integrierte Vertrag aus JOB 3093 liefert Prüfstand,
// Version und Fundort; die Version wird mit dem tatsächlich gespeicherten Objekt verglichen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ABSATZ =
  "Vor jeder Wartung an der Presse P2 ist der Hauptschalter abzuschließen und der Druck im " +
  "Hydrauliksystem vollständig abzubauen. Erst danach darf die Schutzhaube geöffnet werden.";
const TITEL = "Arbeitsanweisung aus der Instandhaltung";
const FREMD =
  "Die Buchhaltung schließt das Geschäftsjahr zum einunddreißigsten Dezember ab und testiert " +
  "den Abschluss anschließend beim Wirtschaftsprüfer.";
const apps: ReturnType<typeof buildApp>[] = [];

beforeEach(() => {
  vi.stubEnv("KLARWERK_ADDON_API", "1");
  vi.stubEnv("KLARWERK_ADDON_API_KEY", "m3-test-addon-key");
});
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function bestand(
  status: "offen" | "validiert" = "offen",
  fields: { title?: string; statement?: string; conditions?: string[]; measures?: string[] } = {},
) {
  const services = buildServices();
  const judge = vi.spyOn(services.reasoner, "judgeDuplicate");
  const app = buildApp(services);
  apps.push(app);
  const registered = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Prüfer", email: "m3@example.test", password: "test-password-3128" },
  });
  expect(registered.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "m3@example.test", password: "test-password-3128" },
  });
  expect(login.statusCode).toBe(200);
  expect(login.cookies.length).toBeGreaterThan(0);
  const headers = { cookie: login.cookies.map((c) => `${c.name}=${c.value}`).join("; ") };
  const created = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: TITEL,
      statement: ABSATZ,
      type: "best_practice",
      category: "Instandhaltung",
      tags: ["Presse", "Wartung", "Hydraulik"],
      neededValidations: 1,
      ...fields,
    },
  });
  expect(created.statusCode).toBe(201);
  const id = created.json().id as string;
  if (status === "validiert") {
    const rated = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rated.statusCode).toBe(200);
    expect(rated.json().status).toBe(status);
  }
  const check = (text: string, title?: string, auth: Record<string, string> = headers) =>
    app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: auth,
      payload: {
        text,
        locale: "de",
        source: "transient-document",
        ...(title !== undefined ? { title } : {}),
      },
    });
  const snapshot = async () => {
    const result = [];
    for (const url of ["/api/kos", "/api/duplicates", "/api/gaps"]) {
      const res = await app.inject({ method: "GET", url, headers });
      expect(res.statusCode).toBe(200);
      result.push(res.json());
    }
    return result;
  };
  return { services, app, headers, id, judge, check, snapshot };
}

describe("M3b · gleicher Inhalt trotz fremdem oder fehlendem Titel am Server", () => {
  it("R7 · automatische Erkennung plus direkter Befund: EIN Löschaufruf schließt BEIDE Einträge", async () => {
    // Genau das Inhaltspaar des unveränderten JOB-3066-Löschtests. Dessen Array enthält
    // Rückgabewerte (= geschlossene Befunde), nicht die Zahl der Aufräumaufrufe: [2] ist EIN Ruf.
    const statement = "Bei Überdruck zuerst Ventil V3 schließen.";
    const {
      services,
      app,
      headers,
      id: a,
    } = await bestand("offen", {
      title: "Ventil V3 zuerst",
      statement,
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Ventil V3 zuerst schliessen",
        statement,
        type: "best_practice",
        category: "Anlage 1",
      },
    });
    expect(created.statusCode).toBe(201);
    const b = created.json().id as string;
    const automatisch = await services.overlaps.unresolved();
    expect(automatisch).toHaveLength(1);
    expect(automatisch[0]).toMatchObject({
      koA: b,
      koB: a,
      detector: { trigger: "validation", method: "deterministic", lexicalScore: 1 },
    });

    // Der bestehende Löschtest legt danach über createAuto einen weiteren Befund an.
    // Dieser direkte Insert übernimmt keinen vorhandenen Eintrag desselben Paars.
    const direkt = await services.overlaps.createAuto(
      {
        koA: a,
        koB: b,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    const conflict = await services.conflicts.create(
      { koA: a, koB: b, type: "truth", description: "Widerspruch zur Frist" },
      "anna",
    );
    expect(direkt.id).not.toBe(automatisch[0]?.id);
    expect(direkt.pairKey).toBe(automatisch[0]?.pairKey);
    const vorLoeschung = await services.overlaps.unresolved();
    expect(vorLoeschung).toHaveLength(2);

    const overlapsRemoved = vi.spyOn(services.overlaps, "onKoRemoved");
    const conflictsRemoved = vi.spyOn(services.conflicts, "onKoRemoved");
    const deleted = await app.inject({ method: "DELETE", url: `/api/kos/${a}`, headers });
    expect(deleted.statusCode).toBe(204);
    expect(overlapsRemoved).toHaveBeenCalledTimes(1);
    expect(await overlapsRemoved.mock.results[0]?.value).toBe(2);
    expect(conflictsRemoved).toHaveBeenCalledTimes(1);
    expect(await conflictsRemoved.mock.results[0]?.value).toBe(1);
    expect(await services.overlaps.unresolved()).toEqual([]);
    expect(await services.conflicts.unresolved()).toEqual([]);
    expect(await services.audit.list({ action: "ko.purged" })).toEqual([]);
    const belege = await services.audit.list({ action: "overlap.withdrawn-own" });
    for (const entry of vorLoeschung) {
      expect(belege.filter((event) => event.target === entry.id)).toHaveLength(1);
    }
    const konfliktBelege = await services.audit.list({ action: "conflict.participant-removed" });
    expect(konfliktBelege.filter((event) => event.target === conflict.id)).toHaveLength(1);
  });

  for (const status of ["offen", "validiert"] as const) {
    it.each([undefined, "", "Ein unabhängig vergebener Dokumentname"])(
      `R1 · identischer Absatz, Bestand ${status}, Anfragetitel %s → Kandidat mit echtem Prüfstand`,
      async (title) => {
        const { app, headers, check, id, snapshot, judge } = await bestand(status);
        const vorher = await snapshot();
        const ko = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
        expect(ko.statusCode).toBe(200);
        expect(typeof ko.json().version).toBe("number");
        const res = await check(ABSATZ, title);
        expect(res.statusCode).toBe(200);
        expect(res.json().duplicates).toEqual([
          expect.objectContaining({
            koId: id,
            koTitle: TITEL,
            koStatus: status,
            koCategory: "Instandhaltung",
            relation: "identisch",
            method: "deterministic",
            confidence: null,
            pruefstand: status === "offen" ? "eingereicht" : "validiert",
            version: ko.json().version,
            fundort: {
              kategorie: "Instandhaltung",
              bereich: "Instandhaltung",
              bibliothekPfad: `/wissen/${id}`,
            },
          }),
        ]);
        expect(res.json().persisted).toBe(false);
        expect(await snapshot()).toEqual(vorher);
        expect(judge).not.toHaveBeenCalled();
      },
    );
  }

  it.each<[string, string, string | undefined]>([
    ["gleicher Titel, fremder Inhalt", FREMD, TITEL],
    [
      "nur gleiche Schlagwörter",
      "Presse Wartung Hydraulik: Der Einkauf bestellt neue Ersatzteile.",
      TITEL,
    ],
    ["andere Bedingung", ABSATZ.replace("Vor jeder Wartung", "Während des Betriebs"), undefined],
    ["gegenteilige Maßnahme", ABSATZ.replace("abzuschließen", "einzuschalten"), undefined],
    ["ähnlicher Absatz, fremder Titel", ABSATZ.replace("vollständig", "ganz"), "Fremder Titel"],
    ["nur Leerraum", " ".repeat(50), undefined],
  ])("N1 · %s erzeugt ohne Modell keine Gleichsetzung", async (_name, text, title) => {
    const { check, judge } = await bestand();
    const res = await check(text, title);
    expect(res.statusCode).toBe(200);
    expect(res.json().duplicates).toEqual([]);
    expect(res.json().persisted).toBe(false);
    expect(judge).not.toHaveBeenCalled();
  });

  it.each(["conditions", "measures"] as const)(
    "N2 · gleiche Aussage, gespeicherte %s fehlen in der Anfrage → keine Gleichsetzung",
    async (field) => {
      const { check } = await bestand("offen", {
        [field]: ["Nur bei vollständig stillgesetzter Anlage."],
      });
      const res = await check(ABSATZ);
      expect(res.statusCode).toBe(200);
      expect(res.json().duplicates).toEqual([]);
    },
  );

  it("N3 · leerer Text wird am API-Vertrag abgewiesen", async () => {
    const { check } = await bestand();
    expect((await check("", TITEL)).statusCode).toBe(400);
  });

  it("Z1 · vertraulicher Treffer bleibt ohne Titel unsichtbar", async () => {
    const { app, headers, id, check } = await bestand();
    const updated = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "confidentiality", level: "vertraulich" },
    });
    expect(updated.statusCode).toBe(200);
    const res = await check(ABSATZ);
    expect(res.statusCode).toBe(200);
    expect(res.json().duplicates).toEqual([]);
    for (const secret of [id, TITEL, "Instandhaltung"]) expect(res.payload).not.toContain(secret);
  });

  it("Z2 · Add-on sieht erst validierten Bestand; ohne Anmeldung kein Bestandszugriff", async () => {
    const { app, headers, id, check } = await bestand();
    const addon = { "x-klarwerk-addon-key": "m3-test-addon-key" };
    expect((await check(ABSATZ, undefined, {})).statusCode).toBe(401);
    const offen = await check(ABSATZ, undefined, addon);
    expect(offen.statusCode).toBe(200);
    expect(offen.json().duplicates).toEqual([]);
    expect(offen.payload).not.toContain(id);
    const rated = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rated.statusCode).toBe(200);
    const validiert = await check(ABSATZ, undefined, addon);
    expect(validiert.statusCode).toBe(200);
    expect(validiert.json().duplicates).toEqual([
      expect.objectContaining({ koId: id, koStatus: "validiert" }),
    ]);
  });
});
