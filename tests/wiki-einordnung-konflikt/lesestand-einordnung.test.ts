// ================================================================================================
// JOB 4251 · RUNDE 2 · K9 — WERT UND STEMPEL SIND EIN LESESTAND, NICHT ZWEI ABFRAGEN.
// ================================================================================================
//
// BENS BEFUND (Korrekturpflicht 1, Gegenprobe C, wörtlich `expected 200 to be 409`). Der Detail-
// abruf las in Runde 1 ZWEI Dinge nacheinander und ohne Klammer: erst das Wissensobjekt (mit
// Kategorie und Schlagwörtern), dann — getrennt — die `metadata_revision` der Metadatenprojektion.
// Zwischen beiden Lesevorgängen liegt ein Fenster.
//
// WAS IN DIESEM FENSTER PASSIERT, IST DER GANZE SCHADEN: schreibt dort jemand Fremdes, bekommt der
// Leser ALTE Schlagwörter mit dem NEUEN Stempel. Er sieht also Bs Änderung nicht — und hält
// trotzdem die Schreibberechtigung für sie in der Hand. Sein nächster Schreibzugriff geht mit 200
// durch und ersetzt eine Einordnung, die er nie gesehen hat. Der Schutz dieses Auftrags ist damit
// nicht bloss lückenhaft, sondern an genau dieser Stelle umgedreht: der Stempel BEGLAUBIGT ein
// Überschreiben, statt es zu verhindern.
//
// WIE HIER UNTERBROCHEN WIRD, und warum das echt ist: die Metadatenprojektion wird umhüllt, und
// GENAU EINMAL — beim ersten `find` nach dem Aufbau — schiebt sich ein ECHTER fremder Schreibzugriff
// dazwischen (echtes zweites Konto, echte Route, echter Dienst). Er wird ANGESTOSSEN, nicht
// abgewartet; danach laufen ein paar Ereignisrunden, damit er ankommen KANN. Ob er ankommt, ist
// genau die Frage: hält der Lesevorgang seine Klammer, muss er warten; hält er sie nicht, schlüpft
// er durch. Ersetzt ist nichts als der Zeitpunkt — kein Ergebnis, kein Statuscode, keine Antwort.
//
// BENANNTE PRÜFLÜCKEN: In-Memory-Ablagen, `app.inject` statt eines echten Sockets, kein PostgreSQL,
// ein Prozess. Die Serialisierung, die hier gemessen wird, ist die des Dienstes (`withKoLock`) —
// nicht die einer Datenbank unter Last.
import { describe, expect, it } from "vitest";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import {
  InMemoryKoSearchProjectionRepo,
  type KoMetadataProjection,
} from "../../services/knowledge-object";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

/** Ein paar Ereignisrunden — genug, dass ein angestossener Schreibzugriff ankommen KANN. */
const runden = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

type Aufbau = {
  app: App;
  a: Kopf;
  b: Kopf;
  id: string;
  /** Wird GENAU EINMAL beim nächsten Stempel-Lesevorgang ausgeführt. */
  setzeUnterbrechung: (tun: () => Promise<void>) => void;
  /** Alles abwarten, was die Unterbrechung angestossen hat. */
  auslaufen: () => Promise<void>;
};

async function aufbau(): Promise<Aufbau> {
  const repos = inMemoryRepos();
  const projections = new InMemoryKoSearchProjectionRepo(repos.koRepo);

  let unterbrechung: (() => Promise<void>) | null = null;
  let unterwegs: Promise<unknown> = Promise.resolve();
  const echtesFind = projections.metadata.find.bind(projections.metadata);
  projections.metadata.find = async (koId: string): Promise<KoMetadataProjection | undefined> => {
    const tun = unterbrechung;
    if (tun !== null) {
      // EINMAL. Sonst schlüge die Unterbrechung auch im Compare-and-Set des Schreibvorgangs zu und
      // der Test misste seinen eigenen Aufbau statt das Produkt.
      unterbrechung = null;
      // ANGESTOSSEN, NICHT ABGEWARTET: ein `await` hier hielte den Lesevorgang an, bis der fremde
      // Schreibzugriff fertig ist — und der wartet seinerseits auf die Klammer des Lesevorgangs.
      unterwegs = tun();
      await runden();
    }
    return echtesFind(koId);
  };

  const app = buildApp(assembleServices(repos, { searchProjections: projections }));
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "anna@klarwerk.test", password: "secret123" },
  });
  const a = await anmelden(app, "anna@klarwerk.test");
  expect(
    (
      await app.inject({
        method: "POST",
        url: "/api/users",
        headers: a,
        payload: {
          name: "Bernd",
          email: "bernd@klarwerk.test",
          password: "secret123",
          role: "admin",
        },
      })
    ).statusCode,
  ).toBe(201);
  const b = await anmelden(app, "bernd@klarwerk.test");

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: a,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
      tags: ["ventil"],
    },
  });
  expect(angelegt.statusCode).toBe(201);

  return {
    app,
    a,
    b,
    id: (angelegt.json() as { id: string }).id,
    setzeUnterbrechung: (tun) => {
      unterbrechung = tun;
    },
    auslaufen: async () => {
      await unterwegs.catch(() => undefined);
      await runden();
    },
  };
}

async function anmelden(app: App, email: string): Promise<Kopf> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

type Stand = { version: number; tags: string[]; category: string; metadataRevision?: number };

const lesen = async (app: App, kopf: Kopf, id: string): Promise<Stand> => {
  const antwort = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers: kopf });
  expect(antwort.statusCode).toBe(200);
  return antwort.json() as Stand;
};

describe("JOB 4251 · K9 · der Detailabruf liefert Einordnung und Stempel als EINEN Stand", () => {
  it("K9a · schreibt B mitten im Abruf, gehören Schlagwörter und Stempel weiterhin zusammen", async () => {
    const s = await aufbau();

    s.setzeUnterbrechung(async () => {
      const antwort = await s.app.inject({
        method: "PUT",
        url: `/api/kos/${s.id}`,
        headers: s.b,
        payload: { action: "tags", tags: ["bernd", "ueberdruck"] },
      });
      expect(antwort.statusCode).toBe(200);
    });

    const gelesen = await lesen(s.app, s.a, s.id);
    await s.auslaufen();

    // DIE ZUSAGE: was in dieser einen Antwort steht, gehört zusammen. Entweder beides alt oder
    // beides neu — nie alte Werte mit neuer Schreibberechtigung.
    const passt =
      (gelesen.tags.join("|") === "ventil" && gelesen.metadataRevision === 1) ||
      (gelesen.tags.join("|") === "bernd|ueberdruck" && gelesen.metadataRevision === 2);
    expect(
      passt,
      `Wert und Stempel stammen aus verschiedenen Ständen: tags=${JSON.stringify(gelesen.tags)}, Stempel=${gelesen.metadataRevision}`,
    ).toBe(true);
  });

  it("K9b · und deshalb beglaubigt der gelesene Stempel kein ungesehenes Überschreiben", async () => {
    const s = await aufbau();

    s.setzeUnterbrechung(async () => {
      const antwort = await s.app.inject({
        method: "PUT",
        url: `/api/kos/${s.id}`,
        headers: s.b,
        payload: { action: "tags", tags: ["bernd", "ueberdruck"] },
      });
      expect(antwort.statusCode).toBe(200);
    });

    // A liest — und schreibt genau mit dem, was A gesehen hat.
    const gelesen = await lesen(s.app, s.a, s.id);
    await s.auslaufen();
    const aSchreibt = await s.app.inject({
      method: "PUT",
      url: `/api/kos/${s.id}`,
      headers: s.a,
      payload: {
        action: "tags",
        tags: [...gelesen.tags, "wartung"],
        ...(gelesen.metadataRevision === undefined
          ? {}
          : { expectedMetadataRevision: gelesen.metadataRevision }),
      },
    });

    // Sah A Bs Änderung NICHT, muss der Schreibzugriff abgewiesen werden. Sah A sie, darf er durch
    // — dann hat A Bs Wörter ja in der eigenen Liste. Ein 200 auf einen Stand, den A nicht gesehen
    // hat, ist genau der Fehler.
    if (gelesen.tags.includes("bernd")) {
      expect(aSchreibt.statusCode).toBe(200);
      expect((await lesen(s.app, s.a, s.id)).tags).toEqual(["bernd", "ueberdruck", "wartung"]);
      return;
    }
    expect(aSchreibt.statusCode, "A überschreibt eine Einordnung, die A nie gesehen hat").toBe(409);
    expect((await lesen(s.app, s.a, s.id)).tags, "Bs Schlagwörter sind weg").toEqual([
      "bernd",
      "ueberdruck",
    ]);
  });

  it("K9c · ohne Unterbrechung ist der Abruf unverändert — Einordnung und Stempel wie bisher", async () => {
    const s = await aufbau();
    const gelesen = await lesen(s.app, s.a, s.id);
    expect(gelesen.tags).toEqual(["ventil"]);
    expect(gelesen.category).toBe("Anlage 1");
    expect(gelesen.metadataRevision).toBe(1);
    expect(gelesen.version).toBe(1);
  });
});
