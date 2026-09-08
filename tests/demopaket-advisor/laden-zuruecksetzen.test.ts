// ================================================================================================
// JOB 3277 · B — WÄHLEN, LADEN, WIEDER LADEN, ZURÜCKSETZEN.
// ================================================================================================
//
// Gemessen wird an der ECHTEN App (buildServices/buildApp, echte Dienste, echter Guard) — kein
// Mock des Prüflings. Die vier Fragen dieses Auftrags in der Reihenfolge, in der Pedi sie am
// Freitag stellt:
//
//   B1  Was ist das?          Die Übersicht nennt Beschreibung, Sprache und Umfang VOR dem Laden.
//   B2  Was passiert dann?    Sechs Objekte, FREIGEGEBEN, mit stabilen externalIds.
//   B3  Und wenn ich nochmal? Zweites Laden legt nichts an und ändert nichts still.
//   B4  Ich habe was kaputt-  Zurücksetzen stellt den Ausgangstext her (sha256-gleich zum Vertrag),
//       gemacht.              zählt „n aktualisiert, m unverändert" und gibt das Objekt wieder frei.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { EXAMPLE_PROVIDER, EXAMPLE_TITLE_PREFIX } from "../../services/app/src/example-packages";
import {
  ADVISOR_FICTION_NOTICE,
  ADVISOR_ICT_EN_V1,
} from "../../services/app/src/example-packages/advisor-ict-en-v1";

const PAKET = ADVISOR_ICT_EN_V1.id;

async function adminApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { app, services, headers: { authorization: `Bearer ${login.json().token}` } };
}

type App = Awaited<ReturnType<typeof adminApp>>["app"];
type Kopf = Record<string, string>;

const uebersicht = (app: App, headers: Kopf) =>
  app.inject({ method: "GET", url: "/api/admin/demo-packages", headers });
const laden = (app: App, headers: Kopf, id = PAKET) =>
  app.inject({ method: "POST", url: `/api/admin/demo-packages/${id}/load`, headers });
const zuruecksetzen = (app: App, headers: Kopf, id = PAKET) =>
  app.inject({ method: "POST", url: `/api/admin/demo-packages/${id}/reset`, headers });

interface Bilanz {
  package: string;
  /** JOB 3277 R2: die Laufkennung dieses Handgriffs (`run_id`) — beim Entfernen `null`. */
  run: string | null;
  created: number;
  updated: number;
  skipped: number;
  removed: number;
  /** JOB 3277 R3: davon zugeordnete Nicht-Bausteine (Import-/Entwurfsobjekte). */
  removedAssigned: number;
  /** JOB 3277 R2: Objekte, für die dieser Lauf einen Registereintrag geschrieben hat. */
  registered: number;
  /** JOB 3277 R2: gefundene überzählige Kopien — gezählt, nicht weggerechnet. */
  duplicates: number;
  skippedInTrash: number;
  closedConflicts: number;
  closedDuplicates: number;
  failures: { key: string; grund: string }[];
}

describe("JOB 3277 B1 · die Übersicht sagt VOR dem Laden, was kommt", () => {
  it("Beschreibung, Sprache, Umfang, Fiktionsmerkmal — und ein gezählter Stand von 0", async () => {
    const { app, headers } = await adminApp();
    const res = await uebersicht(app, headers);
    expect(res.statusCode).toBe(200);
    const { packages } = res.json() as {
      packages: {
        id: string;
        language: string;
        fictional: boolean;
        items: number;
        areas: string[];
        loaded: number;
        edited: number;
        description: { de: string; en: string; nl: string };
      }[];
    };
    const paket = packages.find((p) => p.id === PAKET);
    expect(paket).toBeDefined();
    expect(paket?.language).toBe("en");
    expect(paket?.fictional).toBe(true);
    expect(paket?.items).toBe(6);
    expect(paket?.areas).toEqual(["Sales", "Commercial", "Technical"]);
    expect(paket?.description.en).toContain("before the Confluence import");
    expect(paket?.description.de.length ?? 0).toBeGreaterThan(20);
    // Der Stand ist GEZÄHLT: vor dem Laden liegt nichts da.
    expect(paket?.loaded).toBe(0);
    expect(paket?.edited).toBe(0);
  });

  it("ohne users.manage: 403, und die Übersicht verrät nichts", async () => {
    const { app, services } = await adminApp();
    const zweiter = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Normalo", email: "n@x.de", password: "secret123" },
    });
    const admin = (await services.auth.listUsers()).find((u) => u.role === "admin");
    await services.auth.approveUser(
      (zweiter.json() as { id: string }).id,
      (admin as { id: string }).id,
    );
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "n@x.de", password: "secret123" },
    });
    const fremd = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
    expect((await uebersicht(app, fremd)).statusCode).toBe(403);
    expect((await laden(app, fremd)).statusCode).toBe(403);
    expect((await zuruecksetzen(app, fremd)).statusCode).toBe(403);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/admin/demo-packages/${PAKET}`,
          headers: fremd,
        })
      ).statusCode,
    ).toBe(403);
    expect(await services.ko.list()).toEqual([]);
  });

  it("unbekanntes Paket: ehrlicher 404, nichts angelegt", async () => {
    const { app, services, headers } = await adminApp();
    expect((await laden(app, headers, "gibt-es-nicht")).statusCode).toBe(404);
    expect(await services.ko.list()).toEqual([]);
  });
});

describe("JOB 3277 B2 · Laden legt sechs FREIGEGEBENE Objekte mit stabilen Ankern an", () => {
  it("6 angelegt, Status validiert, externalId <paket>/<schlüssel>, Herkunft Beispielpaket", async () => {
    const { app, services, headers } = await adminApp();
    const res = await laden(app, headers);
    expect(res.statusCode).toBe(200);
    const bilanz = res.json() as Bilanz;
    // Die VOLLE Form, nicht nur einzelne Felder: ein still hinzugekommener Zähler fällt hier auf.
    // `run` ist die einzige Angabe, die von Lauf zu Lauf wechselt — sie wird auf Vorhandensein
    // geprüft und gleich darunter als echte Laufkennung nachgemessen.
    expect(bilanz).toEqual({
      package: PAKET,
      run: expect.any(String),
      created: 6,
      updated: 0,
      skipped: 0,
      removed: 0,
      removedAssigned: 0,
      registered: 6,
      duplicates: 0,
      skippedInTrash: 0,
      closedConflicts: 0,
      closedDuplicates: 0,
      failures: [],
    });
    // Die Laufkennung ist keine leere Zeichenkette und enthält keinen Doppelpunkt — sonst wäre der
    // Registermerker `paketlauf:<paket>:<art>:<lauf>` nicht mehr zerlegbar.
    expect((bilanz.run ?? "").length).toBeGreaterThan(10);
    expect(bilanz.run).not.toContain(":");

    const kos = await services.ko.list();
    expect(kos.length).toBe(6);
    for (const item of ADVISOR_ICT_EN_V1.items) {
      const externalId = `${PAKET}/${item.key}`;
      const ko = kos.find((k) => k.sources?.some((s) => s.externalId === externalId));
      expect(ko, externalId).toBeDefined();
      // FREIGEGEBEN — der Bestand, gegen den der Confluence-Import Konflikte findet.
      expect(ko?.status, externalId).toBe("validiert");
      expect(ko?.sources?.[0]?.provider, externalId).toBe(EXAMPLE_PROVIDER);
      expect(ko?.title, externalId).toBe(`${EXAMPLE_TITLE_PREFIX}${item.title}`);
      expect(ko?.category, externalId).toBe(item.area);
      // Der Gesamt-Purge nimmt das Paket weiterhin mit.
      expect(ko?.demoSeed, externalId).toBe(true);
      // Am Beleg selbst steht, dass das erfundenes Vorführmaterial ist (die Herkunftsliste zeigt
      // `excerpt` an) — nicht nur im Kasten, aus dem es geladen wurde.
      expect(ko?.sources?.[0]?.excerpt, externalId).toBe(ADVISOR_FICTION_NOTICE);
      // Der Text ist der des Vertrags — nachgemessen am Hash der rekonstruierten Quelldatei.
      const quelle = `# ${item.title}\n\n${ADVISOR_FICTION_NOTICE}\n\n${ko?.statement ?? ""}\n`;
      expect(createHash("sha256").update(quelle, "utf8").digest("hex"), externalId).toBe(
        item.contentSha256,
      );
    }
    // Der absichtliche Fehler steht im Bestand — sonst hätte der Import am Freitag nichts zu finden.
    expect(kos.some((k) => k.statement.includes("only needs eight characters"))).toBe(true);

    // Die Übersicht zählt danach 6 geladen, 0 bearbeitet.
    const nach = (await uebersicht(app, headers)).json() as {
      packages: { id: string; loaded: number; edited: number }[];
    };
    expect(nach.packages.find((p) => p.id === PAKET)).toMatchObject({ loaded: 6, edited: 0 });
  });
});

describe("JOB 3277 B3 · wiederholtes Laden erzeugt keine Kopien", () => {
  it("zweites Laden: 0 created, 6 skipped, weiterhin genau 6 Objekte", async () => {
    const { app, services, headers } = await adminApp();
    expect(((await laden(app, headers)).json() as Bilanz).created).toBe(6);
    const zweite = (await laden(app, headers)).json() as Bilanz;
    expect(zweite.created).toBe(0);
    expect(zweite.updated).toBe(0);
    expect(zweite.skipped).toBe(6);
    expect(zweite.failures).toEqual([]);
    expect((await services.ko.list()).length).toBe(6);
    // Auch die externalIds bleiben eindeutig — keine zweite Quelle mit demselben Anker.
    const anker = (await services.ko.list()).flatMap((k) =>
      (k.sources ?? []).map((s) => s.externalId),
    );
    expect(new Set(anker).size).toBe(anker.length);
  });

  it("Laden fasst einen BEARBEITETEN Baustein nicht an — es ändert nie still einen Text", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const t03 = (await services.ko.list()).find((k) =>
      k.sources?.some((s) => s.externalId === `${PAKET}/T03`),
    );
    await services.ko.revise(
      (t03 as { id: string }).id,
      { statement: "Von Hand geändert: mindestens zwölf Zeichen." },
      "admin",
    );
    const nochmal = (await laden(app, headers)).json() as Bilanz;
    expect(nochmal.created).toBe(0);
    expect(nochmal.updated).toBe(0);
    expect(nochmal.skipped).toBe(6);
    const danach = await services.ko.get((t03 as { id: string }).id);
    expect(danach?.statement).toBe("Von Hand geändert: mindestens zwölf Zeichen.");
  });
});

describe("JOB 3277 B4 · Zurücksetzen stellt den Ausgangszustand her", () => {
  it("bearbeiteter Text → Ausgangstext (sha256-gleich), Bilanz „1 aktualisiert, 5 unverändert“", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const t03Def = ADVISOR_ICT_EN_V1.items.find((i) => i.key === "T03");
    const t03 = (await services.ko.list()).find((k) =>
      k.sources?.some((s) => s.externalId === `${PAKET}/T03`),
    );
    const id = (t03 as { id: string }).id;
    await services.ko.revise(
      id,
      { title: "[Beispiel] Falsch benannt", statement: "Der Fehler wurde wegdiskutiert." },
      "admin",
    );
    // Die Übersicht sieht die Bearbeitung — gezählt, nicht geraten.
    const zwischen = (await uebersicht(app, headers)).json() as {
      packages: { id: string; loaded: number; edited: number }[];
    };
    expect(zwischen.packages.find((p) => p.id === PAKET)).toMatchObject({ loaded: 6, edited: 1 });
    // Und die Revision hat das Objekt (richtigerweise) auf „offen" zurückgesetzt.
    expect((await services.ko.get(id))?.status).toBe("offen");

    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(1);
    expect(reset.skipped).toBe(5);
    expect(reset.created).toBe(0);
    expect(reset.failures).toEqual([]);

    const wieder = await services.ko.get(id);
    expect(wieder?.title).toBe(`${EXAMPLE_TITLE_PREFIX}${t03Def?.title}`);
    const quelle = `# ${t03Def?.title}\n\n${ADVISOR_FICTION_NOTICE}\n\n${wieder?.statement ?? ""}\n`;
    expect(createHash("sha256").update(quelle, "utf8").digest("hex")).toBe(t03Def?.contentSha256);
    // Ausgangszustand heißt AUCH: wieder freigegeben. Ein „offen" liegengelassenes Objekt wäre
    // nicht der Zustand, in dem das Paket geladen wurde.
    expect(wieder?.status).toBe("validiert");
    // Kein Duplikat entstanden, die Übersicht ist wieder sauber.
    expect((await services.ko.list()).length).toBe(6);
    const nach = (await uebersicht(app, headers)).json() as {
      packages: { id: string; loaded: number; edited: number }[];
    };
    expect(nach.packages.find((p) => p.id === PAKET)).toMatchObject({ loaded: 6, edited: 0 });
  });

  it("Zurücksetzen ohne Bearbeitung: 0 aktualisiert, 6 unverändert (kein Versions-Rauschen)", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const versionenVorher = (await services.ko.list()).map((k) => `${k.id}:${k.version}`).sort();
    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.updated).toBe(0);
    expect(reset.skipped).toBe(6);
    expect((await services.ko.list()).map((k) => `${k.id}:${k.version}`).sort()).toEqual(
      versionenVorher,
    );
  });

  it("Zurücksetzen legt einen GELÖSCHTEN Baustein wieder an (der Ausgangszustand ist vollständig)", async () => {
    const { app, services, headers } = await adminApp();
    await laden(app, headers);
    const s02 = (await services.ko.list()).find((k) =>
      k.sources?.some((s) => s.externalId === `${PAKET}/S02`),
    );
    await services.ko.delete((s02 as { id: string }).id, "admin", { hard: true });
    expect((await services.ko.list()).length).toBe(5);
    const reset = (await zuruecksetzen(app, headers)).json() as Bilanz;
    expect(reset.created).toBe(1);
    expect(reset.skipped).toBe(5);
    expect((await services.ko.list()).length).toBe(6);
  });
});
