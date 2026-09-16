// ================================================================================================
// JOB 4154 · F8 — DAS PLUGIN WIRD WIRKLICH REGISTRIERT UND JEDER ENDPUNKT WIRKLICH GERUFEN.
// ================================================================================================
//
// `services/app/src/build-app.ts` ist in diesem Durchgang gesperrt (JOB 4151 und der Nachfolger
// WIKI-GESAMTANWEISUNG-ANSCHLUSS halten sie). Ohne diesen Fall wäre die Route also nur eine Datei,
// die kompiliert — und genau das ist der häufigste Fehler dieses Projekts: gebaut, grün, nie
// gerufen (`tests/capture/aufrufer-waechter.test.ts`, Kopf).
//
// Hier wird das Plugin deshalb auf einer FRISCHEN Fastify-Instanz registriert, mit Test-Guards, die
// die echte Rechtematrix (`can`, services/rbac) fahren — und der ECHTE Dienst dahinter gebunden.
// Damit prüft dieser Fall drei Dinge auf einmal:
//   · die Route ist registrierbar und jeder Endpunkt antwortet (kein 404 auf eigene Pfade),
//   · Port und Dienst passen zusammen (der Compiler prüft die Zuweisbarkeit, der Fall die Felder),
//   · die Rechtezuordnung greift wirklich — lesen, einreichen und entscheiden sind drei Türen.
//
// Vorbild des Aufbaus: `tests/q9-fremde-flaechen/wachter-sprache.test.ts:17-21` — echte Instanz,
// `app.inject`, Antwort so gelesen, wie der Browser sie bekäme.
//
// GEGENPROBE: Im Endpunkt `/entscheiden` die Zeile `guards.requirePermission("ko.validate", …)`
// durch `guards.requirePermission("ko.read", …)` ersetzen. Dann bleibt der 403 aus, und
// „ein Experte darf nicht entscheiden" wird namentlich rot.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { gesamtanweisungRoutes } from "../../services/app/src/routes/gesamtanweisung-routes";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import { can } from "../../services/rbac";
import { InMemoryAnweisungRepo, eintrag, kennungen, koLeser, uhr } from "./pruefstand";

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Schritt A", version: 2 }, [
    { version: 1, bodyHtml: "<p>alt</p>" },
    { version: 2, bodyHtml: "<table><tr><th>Druck</th></tr></table>" },
  ]),
  eintrag({ id: "ko-b", title: "Schritt B", version: 1 }, [{ version: 1, bodyHtml: "<p>B</p>" }]),
  eintrag(
    {
      id: "ko-geheim",
      title: "Geheim",
      version: 1,
      author: "clara",
      confidentiality: "vertraulich",
    },
    [{ version: 1 }],
  ),
];

/** Die echte Rechtematrix, nur ohne Sitzung — der Nutzer wird gesetzt, nicht authentifiziert. */
function testGuards(aktuell: () => SessionUser | null): Guards {
  return {
    async requireUser(_request, reply) {
      const user = aktuell();
      if (!user) {
        reply.code(401).send({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
        return undefined;
      }
      return user;
    },
    async requirePermission(permission, _request, reply) {
      const user = aktuell();
      if (!user) {
        reply.code(401).send({ error: "UNAUTHENTICATED", message: "Nicht angemeldet." });
        return undefined;
      }
      if (!can(user.role, permission)) {
        reply.code(403).send({ error: "FORBIDDEN", message: "Keine Berechtigung." });
        return undefined;
      }
      return user;
    },
  };
}

let app: FastifyInstance;
let repo: InMemoryAnweisungRepo;
let nutzer: SessionUser | null;

beforeEach(async () => {
  repo = new InMemoryAnweisungRepo();
  nutzer = { id: "anna", role: "controller" };
  const dienst = new GesamtanweisungDienst({
    repo,
    ko: koLeser(EINTRAEGE),
    jetzt: uhr(),
    kennung: kennungen("k"),
  });
  app = Fastify();
  await app.register(gesamtanweisungRoutes, { dienst, guards: testGuards(() => nutzer) });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function anlegenMitZweiBausteinen(): Promise<{ id: string; version: number; ids: string[] }> {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/gesamtanweisungen",
    payload: { titel: "Wartung", geltungsbereich: "Werk 1" },
  });
  const a = angelegt.json() as { id: string; version: number };
  const eins = await app.inject({
    method: "POST",
    url: `/api/gesamtanweisungen/${a.id}/bausteine`,
    payload: { version: a.version, koId: "ko-a", koVersion: 2, nachweisHash: "ha" },
  });
  const nachEins = eins.json() as { version: number };
  const zwei = await app.inject({
    method: "POST",
    url: `/api/gesamtanweisungen/${a.id}/bausteine`,
    payload: { version: nachEins.version, koId: "ko-b", koVersion: 1, nachweisHash: "hb" },
  });
  const nachZwei = zwei.json() as { version: number; bausteine: { id: string }[] };
  return { id: a.id, version: nachZwei.version, ids: nachZwei.bausteine.map((b) => b.id) };
}

describe("F8 · das Plugin am Draht", () => {
  it("jeder Endpunkt antwortet — der ganze Weg über HTTP", async () => {
    const { id, version, ids } = await anlegenMitZweiBausteinen();
    expect(ids).toHaveLength(2);

    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${id}` });
    expect(gelesen.statusCode).toBe(200);
    const stand = gelesen.json() as {
      bausteine: { koVersion: number; herkunft: { titel: string } | null }[];
      unvollstaendig: boolean;
      pruefanbindung: string;
    };
    expect(stand.bausteine).toHaveLength(2);
    expect(stand.unvollstaendig).toBe(false);
    // Der Lückenvermerk kommt wirklich am Draht an.
    expect(stand.pruefanbindung).toBe("nicht_angebunden");

    const geaendert = await app.inject({
      method: "PUT",
      url: `/api/gesamtanweisungen/${id}`,
      payload: { version, zweck: "Sicheres Abstellen" },
    });
    expect(geaendert.statusCode).toBe(200);
    const nachKopf = geaendert.json() as { version: number; zweck: string };
    expect(nachKopf.zweck).toBe("Sicheres Abstellen");

    const geordnet = await app.inject({
      method: "PUT",
      url: `/api/gesamtanweisungen/${id}/reihenfolge`,
      payload: { version: nachKopf.version, reihenfolge: [...ids].reverse() },
    });
    expect(geordnet.statusCode).toBe(200);
    const nachOrdnen = geordnet.json() as { version: number };

    const mitVoraussetzung = await app.inject({
      method: "PUT",
      url: `/api/gesamtanweisungen/${id}/bausteine/${ids[0]}/voraussetzung`,
      payload: { version: nachOrdnen.version, voraussetzung: "Anlage steht still" },
    });
    expect(mitVoraussetzung.statusCode).toBe(200);
    const nachVoraussetzung = mitVoraussetzung.json() as { version: number };

    const staende = await app.inject({
      method: "GET",
      url: `/api/gesamtanweisungen/${id}/staende`,
    });
    expect(staende.statusCode).toBe(200);
    expect((staende.json() as { staende: number[] }).staende).toContain(nachVoraussetzung.version);

    const vergleich = await app.inject({
      method: "GET",
      url: `/api/gesamtanweisungen/${id}/vergleich?von=${version}&bis=${nachVoraussetzung.version}`,
    });
    expect(vergleich.statusCode).toBe(200);
    expect((vergleich.json() as { gesamt: string }).gesamt).toBe("geaendert");

    const vorgelegt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/vorlegen`,
      payload: { version: nachVoraussetzung.version },
    });
    expect(vorgelegt.statusCode).toBe(200);
    const nachVorlegen = vorgelegt.json() as { version: number; stand: string };
    expect(nachVorlegen.stand).toBe("vorgelegt");

    const entschieden = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/entscheiden`,
      payload: { version: nachVorlegen.version, entscheidung: "angenommen" },
    });
    expect(entschieden.statusCode).toBe(200);
    expect((entschieden.json() as { stand: string }).stand).toBe("entschieden");
  });

  it("ein Experte darf einreichen, aber NICHT entscheiden", async () => {
    const { id, version } = await anlegenMitZweiBausteinen();
    nutzer = { id: "erik", role: "experte" };

    const vorgelegt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/vorlegen`,
      payload: { version },
    });
    expect(vorgelegt.statusCode).toBe(200);

    const entschieden = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/entscheiden`,
      payload: {
        version: (vorgelegt.json() as { version: number }).version,
        entscheidung: "angenommen",
      },
    });
    expect(entschieden.statusCode).toBe(403);

    // Und der Bestand ist dabei wirklich unberührt geblieben (Lehre JOB 4141 R1).
    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${id}` });
    expect((gelesen.json() as { stand: string }).stand).toBe("vorgelegt");
  });

  it("ein Leser darf lesen, aber nichts anlegen", async () => {
    nutzer = { id: "lisa", role: "viewer" };
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/gesamtanweisungen",
      payload: { titel: "Geht nicht" },
    });
    expect(angelegt.statusCode).toBe(403);
  });

  it("ohne Anmeldung antwortet jeder Endpunkt mit 401", async () => {
    nutzer = null;
    for (const [method, url] of [
      ["POST", "/api/gesamtanweisungen"],
      ["GET", "/api/gesamtanweisungen/a-1"],
      ["PUT", "/api/gesamtanweisungen/a-1"],
      ["POST", "/api/gesamtanweisungen/a-1/bausteine"],
      ["PUT", "/api/gesamtanweisungen/a-1/reihenfolge"],
      ["PUT", "/api/gesamtanweisungen/a-1/bausteine/b-1/voraussetzung"],
      ["GET", "/api/gesamtanweisungen/a-1/staende"],
      ["GET", "/api/gesamtanweisungen/a-1/vergleich?von=1&bis=2"],
      ["POST", "/api/gesamtanweisungen/a-1/vorlegen"],
      ["POST", "/api/gesamtanweisungen/a-1/entscheiden"],
    ] as const) {
      // Kein Körper an GET: Fastify nähme ihn nicht an, und die Antwort wäre 400 statt 401 —
      // der Fall prüfte dann die Körperform statt der Anmeldung.
      const antwort = await app.inject(
        method === "GET" ? { method, url } : { method, url, payload: {} },
      );
      expect(antwort.statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it("die 409 nennt den neuen Stand — sonst wäre die Ablehnung nicht nachvollziehbar", async () => {
    const { id, version, ids } = await anlegenMitZweiBausteinen();
    const vorgelegt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/vorlegen`,
      payload: { version },
    });
    const geleseneVersion = (vorgelegt.json() as { version: number }).version;

    await app.inject({
      method: "PUT",
      url: `/api/gesamtanweisungen/${id}/reihenfolge`,
      payload: { version: geleseneVersion, reihenfolge: [...ids].reverse() },
    });

    const abgelehnt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${id}/entscheiden`,
      payload: { version: geleseneVersion, entscheidung: "angenommen" },
    });
    expect(abgelehnt.statusCode).toBe(409);
    expect(abgelehnt.json()).toMatchObject({
      error: "CONFLICT",
      stand: "vorgelegt",
      version: geleseneVersion + 1,
    });
  });

  it("ein geschützter Baustein verschwindet am Draht — samt Zahl der verborgenen", async () => {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/gesamtanweisungen",
      payload: { titel: "Störung" },
    });
    const a = angelegt.json() as { id: string; version: number };
    const offen = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-a", koVersion: 2, nachweisHash: "ha" },
    });
    await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: {
        version: (offen.json() as { version: number }).version,
        koId: "ko-geheim",
        koVersion: 1,
        nachweisHash: "hg",
      },
    });

    // Erik ist Experte: er darf lesen und einreichen, aber nicht prüfen — und er ist nicht Autor.
    nutzer = { id: "erik", role: "experte" };
    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${a.id}` });
    expect(gelesen.statusCode).toBe(200);
    expect(gelesen.payload).not.toContain("ko-geheim");
    expect(gelesen.payload).not.toContain("Geheim");
    expect(gelesen.json()).toMatchObject({ unvollstaendig: true, verborgeneBausteine: 1 });
  });

  it("ein Schreibweg ohne gelesenen Stand wird abgewiesen, nicht blind ausgeführt", async () => {
    const { id } = await anlegenMitZweiBausteinen();
    const ohneVersion = await app.inject({
      method: "PUT",
      url: `/api/gesamtanweisungen/${id}`,
      payload: { titel: "Ohne Stand" },
    });
    expect(ohneVersion.statusCode).toBe(400);
    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${id}` });
    expect((gelesen.json() as { titel: string }).titel).toBe("Wartung");
  });
});
