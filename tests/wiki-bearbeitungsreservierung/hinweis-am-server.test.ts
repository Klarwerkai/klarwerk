// ================================================================================================
// WIKI-BEARBEITUNGSRESERVIERUNG · DER BEARBEITUNGSHINWEIS AM SERVER.
// ================================================================================================
//
// Gemessen wird der Vertrag der drei Routen `…/bearbeitungen` und ihrer Ablage — über die ECHTE
// Anwendung (`buildApp(buildServices())`, `app.inject`) und, wo es um die Zeit geht, an der
// Speicherablage mit gestellter Uhr. Die PostgreSQL-Fassung und mehrere App-Prozesse misst
// `zwei-prozesse-pg-im-browser.integration.test.ts`.
//
//   S1  Beginn, Erneuerung, Ablauf und Neubeginn — die Uhr der Ablage entscheidet (K2/K3).
//   S2  Fremde können eine fremde Bearbeitung weder erneuern noch beenden (K2).
//   S3  Sichtbar nur für Konten, die den Eintrag lesen dürfen; kein Kontakt im Rumpf (K1).
//   S4  Rechteentzug sperrt Änderung (Rolle) und Lesung (Zugang beendet) (K6, Serverhälfte).
//   S5  Der Hinweis ersetzt den bedingten Schreibzugriff nicht: genau EINE Fassung gewinnt (K4).
//   S6  Gegenprobe (K7): die Prüfung aus S5 erkennt einen weggefallenen CAS-Schutz.
import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryBearbeitungsRepo } from "../../services/app/src/bearbeitungshinweis";
import {
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;

let app: App;
let adminToken = "";

async function token(email: string): Promise<string> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return (login.json() as { token: string }).token;
}

async function konto(
  rolle: string,
  email: string,
  name: string,
): Promise<{ id: string; token: string }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { name, email, password: "secret123", role: rolle },
  });
  expect(angelegt.statusCode).toBe(201);
  return { id: (angelegt.json() as { id: string }).id, token: await token(email) };
}

async function eintrag(vertraulichkeit = "intern"): Promise<string> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      confidentiality: vertraulichkeit,
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  return (angelegt.json() as { id: string }).id;
}

const auf = (wer: string, methode: "GET" | "PUT" | "DELETE", url: string) =>
  app.inject({ method: methode, url, headers: { authorization: `Bearer ${wer}` } });

interface Lage {
  jetzt: string;
  ablaufSekunden: number;
  erneuernSekunden: number;
  bearbeitungen: Array<{
    name: string;
    eigen: boolean;
    sitzung?: string;
    seit: string;
    bis: string;
  }>;
}

beforeEach(async () => {
  app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  adminToken = await token("pedi@klarwerk.test");
});

describe("S1 · Beginn, Erneuerung, Ablauf — die Uhr der Ablage entscheidet", () => {
  it("erneuern hält den Beginn fest, ohne Erneuerung ist der Hinweis nach 120 s fort", async () => {
    let jetzt = Date.parse("2026-09-26T10:00:00.000Z");
    const ablage = new InMemoryBearbeitungsRepo(() => jetzt);
    const a = { id: "u-a", name: "Anna" };

    const erste = await ablage.melde("ko-1", a, "sitzung-a-1");
    expect(erste.bearbeitung.seit).toBe("2026-09-26T10:00:00.000Z");
    expect(erste.bearbeitung.bis).toBe("2026-09-26T10:02:00.000Z");

    jetzt += 30_000;
    const erneuert = await ablage.melde("ko-1", a, "sitzung-a-1");
    expect(erneuert.bearbeitung.seit).toBe("2026-09-26T10:00:00.000Z");
    expect(erneuert.bearbeitung.bis).toBe("2026-09-26T10:02:30.000Z");

    jetzt += 119_000;
    expect((await ablage.laufende("ko-1")).bearbeitungen).toHaveLength(1);
    jetzt += 1_000;
    expect((await ablage.laufende("ko-1")).bearbeitungen).toEqual([]);

    // Nach dem Ablauf (Verbindung war weg) beginnt die nächste Meldung NEU.
    const wieder = await ablage.melde("ko-1", a, "sitzung-a-1");
    expect(wieder.bearbeitung.seit).toBe(new Date(jetzt).toISOString());
  });

  it("die Route nennt den Takt des Servers: 30 s Erneuerung, 120 s Ablauf", async () => {
    const id = await eintrag();
    const antwort = await auf(adminToken, "PUT", `/api/kos/${id}/bearbeitungen/sitzung-pedi-1`);
    expect(antwort.statusCode).toBe(200);
    const koerper = antwort.json() as {
      ablaufSekunden: number;
      erneuernSekunden: number;
      bearbeitung: { seit: string; bis: string };
    };
    expect(koerper.ablaufSekunden).toBe(120);
    expect(koerper.erneuernSekunden).toBe(30);
    expect(Date.parse(koerper.bearbeitung.bis) - Date.parse(koerper.bearbeitung.seit)).toBe(
      120_000,
    );
  });
});

describe("S2 · Fremde können eine fremde Bearbeitung nicht erneuern und nicht beenden", () => {
  it("dieselbe Sitzungskennung trifft beim fremden Konto nur dessen eigene Zeile", async () => {
    const id = await eintrag();
    const anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    const bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");

    expect(
      (await auf(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`)).statusCode,
    ).toBe(200);

    // Bernd versucht Annas Sitzung zu beenden: es trifft nichts.
    const beenden = await auf(
      bernd.token,
      "DELETE",
      `/api/kos/${id}/bearbeitungen/annas-sitzung-1`,
    );
    expect(beenden.statusCode).toBe(200);
    expect(beenden.json()).toEqual({ beendet: false });

    // Bernd „erneuert" Annas Sitzung: das legt SEINE eigene Bearbeitung an, Annas bleibt Annas.
    await auf(bernd.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`);
    const sicht = (await auf(anna.token, "GET", `/api/kos/${id}/bearbeitungen`)).json() as Lage;
    const namen = sicht.bearbeitungen.map((b) => `${b.name}:${b.eigen}`).sort();
    expect(namen).toEqual(["Anna Beispiel:true", "Bernd Beispiel:false"]);
    // Die fremde Sitzungskennung geht nicht hinaus.
    expect(sicht.bearbeitungen.find((b) => !b.eigen)?.sitzung).toBeUndefined();

    // Anna beendet ihre eigene — nur ihre ist fort.
    const eigen = await auf(anna.token, "DELETE", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`);
    expect(eigen.json()).toEqual({ beendet: true });
    const danach = (await auf(bernd.token, "GET", `/api/kos/${id}/bearbeitungen`)).json() as Lage;
    expect(danach.bearbeitungen.map((b) => b.name)).toEqual(["Bernd Beispiel"]);
  });

  it("eine unbrauchbare Sitzungskennung wird abgewiesen", async () => {
    const id = await eintrag();
    expect((await auf(adminToken, "PUT", `/api/kos/${id}/bearbeitungen/kurz`)).statusCode).toBe(
      400,
    );
  });
});

describe("S3 · sichtbar nur für Leseberechtigte, ohne Kontaktdaten", () => {
  it("Leser sehen Name und Zeiten — keine E-Mail, keine Kontokennung", async () => {
    const id = await eintrag();
    const anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    const leser = await konto("viewer", "leser@klarwerk.test", "Lea Leser");
    await auf(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`);

    const antwort = await auf(leser.token, "GET", `/api/kos/${id}/bearbeitungen`);
    expect(antwort.statusCode).toBe(200);
    expect(antwort.body).toContain("Anna Beispiel");
    expect(antwort.body).not.toContain("anna@klarwerk.test");
    expect(antwort.body).not.toContain(anna.id);
    expect(antwort.body).not.toContain("annas-sitzung-1");
    // Der Leser darf selbst keine Bearbeitung anmelden — das ist das Recht zum Bearbeiten.
    expect(
      (await auf(leser.token, "PUT", `/api/kos/${id}/bearbeitungen/lesers-sitzung-1`)).statusCode,
    ).toBe(403);
  });

  it("ein vertraulicher Eintrag verrät nicht einmal, dass jemand ihn bearbeitet", async () => {
    const id = await eintrag("vertraulich");
    await auf(adminToken, "PUT", `/api/kos/${id}/bearbeitungen/sitzung-pedi-1`);
    const anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    const antwort = await auf(anna.token, "GET", `/api/kos/${id}/bearbeitungen`);
    expect(antwort.statusCode).toBe(404);
    expect(antwort.body).not.toContain("Pedi");
    // Ohne Anmeldung gibt es gar nichts.
    const anonym = await app.inject({ method: "GET", url: `/api/kos/${id}/bearbeitungen` });
    expect(anonym.statusCode).toBe(401);
  });
});

describe("S4 · Rechteentzug sperrt danach Änderung und Lesung", () => {
  it("Rolle auf Leser: kein Erneuern, kein Beenden mehr; Zugang beendet: kein Lesen mehr", async () => {
    const id = await eintrag();
    const anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    expect(
      (await auf(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`)).statusCode,
    ).toBe(200);

    const rolle = await app.inject({
      method: "PUT",
      url: `/api/users/${anna.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { role: "viewer" },
    });
    expect(rolle.statusCode).toBe(200);
    expect(
      (await auf(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`)).statusCode,
    ).toBe(403);
    expect(
      (await auf(anna.token, "DELETE", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`)).statusCode,
    ).toBe(403);

    const ende = await app.inject({
      method: "PUT",
      url: `/api/users/${anna.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { accessExpiresAt: new Date(Date.now() - 60_000).toISOString() },
    });
    expect(ende.statusCode).toBe(200);
    expect((await auf(anna.token, "GET", `/api/kos/${id}/bearbeitungen`)).statusCode).toBe(401);
  });
});

// ================================================================================================
// S5/S6 · DER HINWEIS ERSETZT DEN BEDINGTEN SCHREIBZUGRIFF NICHT.
// ================================================================================================

interface Speicherversuch {
  status: number;
  statement: string;
}

/**
 * Die Prüfung von K4, als Funktion — damit S6 sie an einem Aufbau OHNE Schutz scheitern sehen kann.
 * Zwei Versuche auf derselben Ausgangsfassung: genau einer gewinnt, der andere bekommt 409, und am
 * Server steht danach genau der Text des Gewinners.
 */
function pruefeGenauEinGewinner(versuche: Speicherversuch[], amServer: string): void {
  const gewonnen = versuche.filter((v) => v.status === 200);
  const konflikt = versuche.filter((v) => v.status === 409);
  expect(gewonnen, "genau eine Fassung gewinnt").toHaveLength(1);
  expect(konflikt, "die andere bekommt einen Konflikt").toHaveLength(1);
  expect(amServer).toBe(gewonnen[0]?.statement);
}

async function zweiSpeichern(
  id: string,
  a: string,
  b: string,
  mitSchutz: boolean,
): Promise<{ versuche: Speicherversuch[]; amServer: string }> {
  const fassung = ((await auf(adminToken, "GET", `/api/kos/${id}`)).json() as { version: number })
    .version;
  const speichere = async (wer: string, statement: string): Promise<Speicherversuch> => {
    const antwort = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${wer}` },
      payload: {
        action: "revise",
        changes: { statement, type: "best_practice" },
        ...(mitSchutz ? { expectedVersion: fassung } : {}),
      },
    });
    return { status: antwort.statusCode, statement };
  };
  const versuche = await Promise.all([
    speichere(a, "Fassung von Anna."),
    speichere(b, "Fassung von Bernd."),
  ]);
  const amServer = (
    (await auf(adminToken, "GET", `/api/kos/${id}`)).json() as { statement: string }
  ).statement;
  return { versuche, amServer };
}

describe("S5 · gleichzeitiges Speichern bleibt durch expectedVersion geschützt", () => {
  it("beide bearbeiten mit Hinweis, beide speichern — genau eine Fassung gewinnt", async () => {
    const id = await eintrag();
    const anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    const bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");
    await auf(anna.token, "PUT", `/api/kos/${id}/bearbeitungen/annas-sitzung-1`);
    await auf(bernd.token, "PUT", `/api/kos/${id}/bearbeitungen/bernds-sitzung-1`);

    const { versuche, amServer } = await zweiSpeichern(id, anna.token, bernd.token, true);
    pruefeGenauEinGewinner(versuche, amServer);

    // Der Hinweis hat am Speicherweg nichts verändert: er steht unverändert da, bis ihn die
    // Fläche beendet — Speichern nimmt ihn nicht still weg und erlaubt nichts zusätzlich.
    const lage = (await auf(adminToken, "GET", `/api/kos/${id}/bearbeitungen`)).json() as Lage;
    expect(lage.bearbeitungen.map((b) => b.name).sort()).toEqual([
      "Anna Beispiel",
      "Bernd Beispiel",
    ]);
  });
});

describe("S6 · Gegenprobe: ohne expectedVersion schlägt die Prüfung aus S5 an", () => {
  it("fehlt der Schutz, überschreibt der zweite still — und pruefeGenauEinGewinner wird rot", async () => {
    const id = await eintrag();
    const anna = await konto("experte", "anna@klarwerk.test", "Anna Beispiel");
    const bernd = await konto("experte", "bernd@klarwerk.test", "Bernd Beispiel");
    const { versuche, amServer } = await zweiSpeichern(id, anna.token, bernd.token, false);
    expect(versuche.every((v) => v.status === 200)).toBe(true);
    expect(() => pruefeGenauEinGewinner(versuche, amServer)).toThrow();
  });
});

// ================================================================================================
// S7 · RUNDE 3, BENS BEFUND: DER KONFLIKT, DEN ERST DIE ABLAGE ERKENNT (MEHRERE APP-PROZESSE).
// ================================================================================================
//
// Zwei App-Prozesse lesen dieselbe Fassung; beide bestehen die Fassungsprüfung des Dienstes, und
// erst der bedingte UPDATE der Ablage weist den zweiten ab (`STALE_WRITE`). Nachgestellt wird das
// hier mit einer Ablage, in deren `update` GENAU EINMAL ein „anderer Prozess" dazwischenschreibt —
// über dieselbe Ablage, also mit echtem rowVersion-Schritt. Erwartet wird der Konflikt des
// direkten Speicherwegs (409 `KO_STALE` mit der jetzt gültigen Fassung), nicht ein 400; der fremde
// Text bleibt stehen, und es wird nichts wiederholt.
describe("S7 · STALE_WRITE der Ablage erreicht den Konfliktweg (409), CAS bleibt", () => {
  it("der dazwischengekommene Text bleibt, die Antwort ist 409 KO_STALE mit currentVersion", async () => {
    const repos = inMemoryRepos();
    const echt = repos.koRepo;
    let dazwischen = false;
    let schreibversuche = 0;
    repos.koRepo = Object.assign(Object.create(Object.getPrototypeOf(echt)), echt, {
      update: async (ko: KnowledgeObject, tx?: unknown): Promise<void> => {
        schreibversuche++;
        if (dazwischen) {
          dazwischen = false;
          const fremd = await echt.findById(ko.id);
          if (fremd) {
            await echt.update({ ...fremd, statement: "Fremder Prozess war schneller." });
          }
        }
        return echt.update(ko, tx as never);
      },
    }) as typeof echt;
    app = buildApp(assembleServices(repos));
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
    });
    adminToken = await token("pedi@klarwerk.test");
    const id = await eintrag();
    const fassung = ((await auf(adminToken, "GET", `/api/kos/${id}`)).json() as { version: number })
      .version;

    dazwischen = true;
    const vorher = schreibversuche;
    const antwort = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        action: "revise",
        changes: { statement: "Meine Fassung.", type: "best_practice" },
        expectedVersion: fassung,
      },
    });
    expect(antwort.statusCode, antwort.body).toBe(409);
    const koerper = antwort.json() as { error: string; currentVersion?: number };
    expect(koerper.error).toBe("KO_STALE");
    expect(typeof koerper.currentVersion).toBe("number");
    // Genau EIN eigener Schreibversuch (plus der fremde darin) — nichts wird still wiederholt.
    expect(schreibversuche - vorher).toBe(1);
    const amServer = (
      (await auf(adminToken, "GET", `/api/kos/${id}`)).json() as { statement: string }
    ).statement;
    expect(amServer).toBe("Fremder Prozess war schneller.");
  });
});
