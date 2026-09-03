// A28 (OFFEN.md:165) — DAS SIGNAL UEBER DIE VERDRAHTETE ROUTE.
//
// WARUM DIESE DATEI EXISTIERT:
// JOB 1500 D1 (`7fb6ace`) hat die Regel gebaut, JOB 1546 D1 hat gemessen, dass sie bis dahin
// KEINEN Aufrufer hatte — der einzige Treffer im ganzen Baum war ihr eigener Test. D2 verdrahtet
// sie an `GET /api/duplicate-signal` (conflicts-routes.ts, registriert in build-app.ts).
//
// Was hier geprueft wird, ist genau das, was ein Kerntest NICHT kann: die Grenze am AUSGANG. Der
// Kern kann noch so sauber sein — entscheidend ist, was ueber HTTP wirklich das Haus verlaesst.
// Deshalb laufen die Faelle gegen die ECHTEN Dienste (`OverlapService`, `ConflictService`) und
// lesen die ANTWORT der Route, nicht den Rueckgabewert einer Funktion.
//
// Die gesperrte Richtung („ein fremdes Objekt dupliziert meines", A28/`OF-1546-1`) wird hier ein
// zweites Mal bewacht — diesmal am Ausgang: `R-2`.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { conflictRoutes } from "../../services/app/src/routes/conflicts-routes";
import {
  ConflictService,
  type DetectSubject,
  InMemoryConflictRepo,
  InMemoryOverlapRepo,
  OverlapService,
  type OverlapVerdict,
} from "../../services/conflicts";

// ------------------------------------------------------------------------------------------------
// Aufbau
// ------------------------------------------------------------------------------------------------

const AUTORIN: SessionUser = { id: "u-autorin", role: "experte" };
const ANDERER: SessionUser = { id: "u-anderer", role: "experte" };

const guardsFuer = (user: SessionUser | undefined): Guards =>
  ({
    requireUser: async () => user,
    requirePermission: async (
      _p: unknown,
      _req: unknown,
      reply: { code: (n: number) => { send: (b: unknown) => void } },
    ) => {
      if (!user) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
        return undefined;
      }
      return user;
    },
  }) as unknown as Guards;

/** Der Bestand, aus dem die EIGENEN Objekte bestimmt werden. Genau die Felder, die A28 braucht. */
const BESTAND = [
  { id: "ko-mein-1", author: "u-autorin", confidentiality: "intern" as const },
  { id: "ko-mein-2", author: "u-autorin", confidentiality: "vertraulich" as const },
  { id: "ko-fremd-9", author: "u-anderer", confidentiality: "intern" as const },
];

const koQuelle = { list: async () => BESTAND };

// JOB 3032 (N5): der Befund traegt seit diesem Auftrag ein viertes Feld — die Deckungslage des
// Laufs, der DIESES eigene Objekt angesehen hat. Kein Objekt im BESTAND oben traegt einen
// `aiCheck`-Vermerk, also sagt ueber sie kein Lauf etwas; die ehrliche Antwort ist `kein_lauf` mit
// zwei `null` und NICHT eine stille Entwarnung. Die Lagen selbst prueft
// `tests/eigenes-signal/n5-deckung-am-eigenen-objekt.test.ts`.
const OHNE_AUSKUNFT = { lage: "kein_lauf", geprueft: null, bestand: null };

function subjekt(id: string, titel: string, aussage: string): DetectSubject {
  return {
    refId: id,
    title: titel,
    statement: aussage,
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
  };
}

// Form gemessen, nicht geraten: `OverlapAspect` = `beschreibung|zitatA|zitatB`
// (duplicate-detect.ts:25-29); `empfehlung` ist eine geschlossene Menge (:31-35).
const URTEIL: OverlapVerdict = {
  beziehung: "identisch",
  aspects: [
    { beschreibung: "Pumpe entlueften", zitatA: "Pumpe entlueften", zitatB: "Pumpe entlueften" },
  ],
  nurInA: "",
  nurInB: "",
  empfehlung: "zusammenfuehren",
  confidence: 0.95,
  begruendung: "Testaufbau",
};
const judge = async (): Promise<OverlapVerdict> => URTEIL;

const MEIN = subjekt(
  "ko-mein-1",
  "Pumpe entlueften",
  "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlueften.",
);
const FREMD = subjekt(
  "ko-fremd-9",
  "Pumpe entlueften",
  "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlueften.",
);

const OHNE_ZUGANG = { get: async () => undefined };

let offen: FastifyInstance[] = [];

/** Baut die Route so, wie `build-app.ts:1237-1239` sie registriert. */
async function routeApp(
  user: SessionUser | undefined,
  overlaps: OverlapService,
  conflicts: ConflictService,
): Promise<FastifyInstance> {
  const instance = Fastify();
  instance.register(
    conflictRoutes(conflicts, guardsFuer(user), OHNE_ZUGANG as never, overlaps, koQuelle),
  );
  await instance.ready();
  offen.push(instance);
  return instance;
}

async function leereDienste(): Promise<[OverlapService, ConflictService]> {
  return [
    new OverlapService({ repo: new InMemoryOverlapRepo() }),
    new ConflictService({ repo: new InMemoryConflictRepo() }),
  ];
}

afterEach(async () => {
  for (const instance of offen) {
    await instance.close();
  }
  offen = [];
});

// ------------------------------------------------------------------------------------------------

describe("A28 · das Signal ueber die verdrahtete Route", () => {
  it("R-1 · mein Einreichen fand eine Dublette → die Route meldet sie an MEINEM Objekt", async () => {
    const [overlaps, conflicts] = await leereDienste();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });

    const app = await routeApp(AUTORIN, overlaps, conflicts);
    const antwort = await app.inject({ method: "GET", url: "/api/duplicate-signal" });

    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: false, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("R-2 · die GESPERRTE Richtung entsteht auch am Ausgang nicht", async () => {
    // Fremdes Subjekt gegen mein Objekt. Der Eintrag existiert und betrifft mich — trotzdem
    // schweigt die Route. Das ist `OF-1546-1`, und sie bleibt gesperrt, bis Pedi entschieden hat.
    const [overlaps, conflicts] = await leereDienste();
    await overlaps.detectForSubject(FREMD, [MEIN], judge, { minConfidence: 0.5 });
    expect((await overlaps.unresolved()).length, "der Aufbau legt keinen Eintrag an").toBe(1);

    const app = await routeApp(AUTORIN, overlaps, conflicts);
    const antwort = await app.inject({ method: "GET", url: "/api/duplicate-signal" });

    expect(antwort.statusCode).toBe(200);
    expect(antwort.json()).toEqual([]);
  });

  it("R-3 · die ANTWORT traegt weder Kennung noch Inhalt der Gegenseite", async () => {
    const [overlaps, conflicts] = await leereDienste();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });
    await conflicts.create({
      koA: "ko-mein-1",
      koB: "ko-fremd-8",
      type: "truth",
      description: "Widersprechende Angaben zur Wartezeit.",
    });

    const app = await routeApp(AUTORIN, overlaps, conflicts);
    const rumpf = (await app.inject({ method: "GET", url: "/api/duplicate-signal" })).body;

    // Kalibrierung: der BESTAND traegt beides wirklich — sonst pruefte dieser Fall nichts.
    expect(JSON.stringify(await overlaps.unresolved())).toContain("Pumpe entlueften");
    expect(JSON.stringify(await conflicts.unresolved())).toContain("Widersprechende Angaben");

    // Und die Antwort traegt es nicht.
    expect(rumpf).not.toContain("ko-fremd-9");
    expect(rumpf).not.toContain("ko-fremd-8");
    expect(rumpf).not.toContain("Pumpe entlueften");
    expect(rumpf).not.toContain("Widersprechende Angaben");
    // JOB 3032 (N5): vier Felder statt drei. Das vierte ist die Deckung des EIGENEN Laufs — sie
    // sagt nichts ueber die Gegenseite, und die vier Zusicherungen darueber gelten unveraendert.
    expect(Object.keys(JSON.parse(rumpf)[0]).sort()).toEqual([
      "deckung",
      "dublette",
      "koId",
      "konflikt",
    ]);
  });

  it("R-4 · derselbe Bestand, zwei Betrachter: jeder sieht nur sein eigenes Objekt", async () => {
    const [overlaps, conflicts] = await leereDienste();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });

    const meins = await routeApp(AUTORIN, overlaps, conflicts);
    const seins = await routeApp(ANDERER, overlaps, conflicts);

    expect((await meins.inject({ method: "GET", url: "/api/duplicate-signal" })).json()).toEqual([
      { koId: "ko-mein-1", dublette: true, konflikt: false, deckung: OHNE_AUSKUNFT },
    ]);
    // Der Autor des vorgefundenen Kandidaten erfaehrt nichts — dieselbe Sperre wie R-2,
    // diesmal aus der anderen Blickrichtung.
    expect((await seins.inject({ method: "GET", url: "/api/duplicate-signal" })).json()).toEqual(
      [],
    );
  });

  it("R-5 · ein VERTRAULICHES eigenes Objekt traegt das Signal ebenfalls", async () => {
    // Die Autor-Ausnahme aus `darfSehen` (sichtbarkeit.ts:61/:76) — ohne sie ginge genau der
    // Alltagsweg zu, fuer den A28 gebaut ist: „ich schreibe etwas Sensibles auf".
    const [overlaps, conflicts] = await leereDienste();
    await conflicts.create({
      koA: "ko-mein-2",
      koB: "ko-fremd-9",
      type: "truth",
      description: "Testaufbau.",
    });

    const app = await routeApp(AUTORIN, overlaps, conflicts);
    const antwort = await app.inject({ method: "GET", url: "/api/duplicate-signal" });

    expect(antwort.json()).toEqual([
      { koId: "ko-mein-2", dublette: false, konflikt: true, deckung: OHNE_AUSKUNFT },
    ]);
  });

  it("R-6 · ohne Anmeldung gibt es kein Signal", async () => {
    const [overlaps, conflicts] = await leereDienste();
    await overlaps.detectForSubject(MEIN, [FREMD], judge, { minConfidence: 0.5 });

    const app = await routeApp(undefined, overlaps, conflicts);
    const antwort = await app.inject({ method: "GET", url: "/api/duplicate-signal" });

    expect(antwort.statusCode).toBe(401);
  });

  it("R-7 · fehlt ein Port, existiert die Flaeche NICHT — fail-closed statt leerer Liste", async () => {
    // Bewusst so gebaut: eine leere Liste waere die Aussage „keine Befunde" — genau die
    // Unwahrheit, gegen die A28 und der Deckel-Ehrlichkeitsvertrag stehen. Kein Port, keine Route.
    const [, conflicts] = await leereDienste();
    const instance = Fastify();
    instance.register(conflictRoutes(conflicts, guardsFuer(AUTORIN), OHNE_ZUGANG as never));
    await instance.ready();
    offen.push(instance);

    const antwort = await instance.inject({ method: "GET", url: "/api/duplicate-signal" });
    expect(antwort.statusCode).toBe(404);

    // Gegenprobe: die uebrigen Konfliktrouten derselben Registrierung laufen unveraendert.
    expect((await instance.inject({ method: "GET", url: "/api/conflicts" })).statusCode).toBe(200);
  });
});

// ================================================================================================
// DIE KOMPOSITIONSWURZEL — der Fall, ohne den dieser ganze Durchgang nichts belegt.
// ================================================================================================
//
// Die sieben Faelle oben registrieren das Plugin SELBST und beweisen deshalb nur, dass die Route
// funktioniert, WENN jemand sie verdrahtet. Genau daran ist `7fb6ace` gescheitert: die Regel war
// gruen getestet und hatte trotzdem keinen Aufrufer.
//
// Dieser Fall prueft die ECHTE App aus `buildServices()`/`buildApp()` — also die Stelle, an der
// `build-app.ts` die zwei Argumente wirklich uebergibt. Nimmt sie jemand wieder weg, wird die
// Route nicht registriert und dieser Fall faellt auf 404. Er ist der einzige Waechter der
// Verdrahtung selbst.
describe("A28 · die Verdrahtung an der Kompositionswurzel", () => {
  it("W-1 · die ECHTE App traegt die Route — nicht nur das einzeln registrierte Plugin", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Autorin", email: "a28@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a28@x.de", password: "secret123" },
    });
    const token = (login.json() as { token: string }).token;

    const antwort = await app.inject({
      method: "GET",
      url: "/api/duplicate-signal",
      headers: { authorization: `Bearer ${token}` },
    });

    // 404 hiesse: die Argumente in build-app.ts fehlen und die Flaeche existiert nicht.
    expect(antwort.statusCode, "die Route ist an der Kompositionswurzel NICHT verdrahtet").toBe(
      200,
    );
    // Frischer Bestand, kein eigenes Objekt mit Befund: ehrlich leer, nicht 404.
    expect(antwort.json()).toEqual([]);
  });
});
