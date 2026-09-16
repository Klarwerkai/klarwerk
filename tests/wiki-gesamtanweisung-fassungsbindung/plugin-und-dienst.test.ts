// ================================================================================================
// JOB 4233 · TEST 8 — AM DRAHT: DIE ABSAGE HAT EINEN STATUS, DER TEXT KOMMT WIRKLICH AN.
// ================================================================================================
//
// Im Muster von `tests/wiki-gesamtanweisung/f8-plugin-registrierung.test.ts`: eine FRISCHE
// Fastify-Instanz, das echte Routen-Plugin, der ECHTE Dienst, die echte Rechtematrix (`can`).
// Nur die Ablage ist ein Double.
//
// WARUM DAS NICHT DIE DIENSTPRÜFUNG WIEDERHOLT: zwischen Dienst und Mensch liegen zwei Nähte, an
// denen dieses Projekt regelmässig reisst — die Fehlerabbildung (`antworteMitFehler` →
// `sendError`) und die Serialisierung der Antwort. Ein Dienst, der richtig ablehnt, und eine
// Route, die daraus 500 macht, sind beide für sich grün.
//
// DIE ROUTE IST WEITERHIN AN KEINER APP ANGEMELDET (`gesamtanweisung-routes.ts:10-18`,
// `build-app.ts` gehört JOB 4151/4156). Dieser Fall behauptet deshalb nicht „in der App
// erreichbar", sondern prüft das Plugin dort, wo es heute steht.
//
// GEGENPROBE: die Existenzprüfung in `bausteinAufnehmen` entfernen → der erste Fall unten wird rot
// (200 statt 404, und die Anweisung trägt plötzlich einen Baustein).
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { gesamtanweisungRoutes } from "../../services/app/src/routes/gesamtanweisung-routes";
import { GesamtanweisungDienst } from "../../services/knowledge-object/src/gesamtanweisung-service";
import { can } from "../../services/rbac";
import {
  InMemoryAnweisungRepo,
  eintrag,
  kennungen,
  koLeser,
  uhr,
} from "../wiki-gesamtanweisung/pruefstand";

const TEXT_EINS = "Erst absperren, dann entlüften.";
const GEHEIMER_SATZ = "Kessel 3 sofort abschalten.";

const EINTRAEGE = [
  eintrag({ id: "ko-a", title: "Anlage entlüften", version: 2 }, [
    { version: 1, bodyHtml: `<h2>Absperren</h2><p>${TEXT_EINS}</p>` },
    { version: 2, bodyHtml: "<p>Zweite Fassung.</p>" },
  ]),
  eintrag(
    {
      id: "ko-geheim",
      title: "Notabschaltung Kessel 3",
      version: 2,
      author: "clara",
      confidentiality: "vertraulich",
    },
    [
      { version: 1, bodyHtml: `<p>${GEHEIMER_SATZ}</p>` },
      { version: 2, bodyHtml: `<p>${GEHEIMER_SATZ}</p>` },
    ],
  ),
];

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

async function anlegen(): Promise<{ id: string; version: number }> {
  const antwort = await app.inject({
    method: "POST",
    url: "/api/gesamtanweisungen",
    payload: { titel: "Wartung", geltungsbereich: "Werk 1" },
  });
  return antwort.json() as { id: string; version: number };
}

describe("JOB 4233 · Fassungsbindung am Draht", () => {
  it("eine nicht belegte Fassung ergibt 400 INVALID — und die Anweisung bleibt unberührt", async () => {
    const a = await anlegen();
    const schreibvorgaengeVorher = repo.schreibvorgaenge;
    const abdruckVorher = repo.abdruck();

    const abgelehnt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-a", koVersion: 999, nachweisHash: "h" },
    });

    expect(abgelehnt.statusCode).toBe(400);
    expect(abgelehnt.json()).toMatchObject({ error: "INVALID" });
    expect((abgelehnt.json() as { message: string }).message).toContain(
      "Diese Fassung gibt es nicht.",
    );

    expect(repo.schreibvorgaenge).toBe(schreibvorgaengeVorher);
    expect(repo.abdruck()).toBe(abdruckVorher);

    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${a.id}` });
    expect(gelesen.json()).toMatchObject({ version: a.version, bausteine: [] });
  });

  it("ZWEI URSACHEN, ZWEI ANTWORTEN: fehlende ANWEISUNG ist nicht fehlende FASSUNG", async () => {
    // BENs Korrekturpflicht 2. Beide Fälle treffen DENSELBEN Endpunkt, und bis Runde 1 waren sie
    // am Draht ununterscheidbar (beide 404 `NOT_FOUND`) — die Fläche musste also raten und hat
    // geraten. Jetzt sagt der SERVER, was los ist: 404 = die Anweisung gibt es nicht,
    // 400 `INVALID` = die Anweisung gibt es, aber diese Fassung nicht.
    const a = await anlegen();

    const ohneAnweisung = await app.inject({
      method: "POST",
      url: "/api/gesamtanweisungen/gibt-es-nicht/bausteine",
      payload: { version: 1, koId: "ko-a", koVersion: 1, nachweisHash: "h" },
    });
    expect(ohneAnweisung.statusCode).toBe(404);
    expect(ohneAnweisung.json()).toMatchObject({ error: "NOT_FOUND" });
    expect((ohneAnweisung.json() as { message: string }).message).toBe(
      "Diese Anweisung gibt es nicht.",
    );

    const ohneFassung = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-a", koVersion: 999, nachweisHash: "h" },
    });
    expect(ohneFassung.statusCode).toBe(400);
    expect(ohneFassung.json()).toMatchObject({ error: "INVALID" });

    // Und die dritte Ursache bleibt die dritte: kein Recht → 403, ohne jede Auskunft.
    nutzer = { id: "erik", role: "experte" };
    const ohneRecht = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-geheim", koVersion: 1, nachweisHash: "h" },
    });
    expect(ohneRecht.statusCode).toBe(403);
  });

  it("das Lesen liefert den Text der gebundenen Fassung wirklich über die Route", async () => {
    const a = await anlegen();
    const aufgenommen = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
    });
    expect(aufgenommen.statusCode).toBe(200);

    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${a.id}` });
    expect(gelesen.statusCode).toBe(200);
    const stand = gelesen.json() as {
      bausteine: { koVersion: number; rumpfHtml: string | null }[];
    };
    expect(stand.bausteine[0]?.koVersion).toBe(1);
    expect(stand.bausteine[0]?.rumpfHtml).toContain(TEXT_EINS);
    // Der Text der heutigen Fassung ist nicht in der Antwort.
    expect(gelesen.payload).not.toContain("Zweite Fassung.");
  });

  it("dem Unberechtigten antwortet die Route mit 403 und sagt sonst nichts", async () => {
    const a = await anlegen();
    // Erik ist Experte: er darf einreichen, aber nicht prüfen — und er ist nicht Autor.
    nutzer = { id: "erik", role: "experte" };

    const abgelehnt = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-geheim", koVersion: 999, nachweisHash: "h" },
    });

    expect(abgelehnt.statusCode).toBe(403);
    expect(abgelehnt.payload).not.toContain("999");
    expect(abgelehnt.payload).not.toContain("Notabschaltung");
    expect(abgelehnt.payload).not.toContain(GEHEIMER_SATZ);
    // Ununterscheidbar von der Absage zu einer Fassung, die es gibt.
    const zurVorhandenen = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-geheim", koVersion: 1, nachweisHash: "h" },
    });
    expect(zurVorhandenen.statusCode).toBe(403);
    expect(zurVorhandenen.payload).toBe(abgelehnt.payload);
  });

  it("ein verborgener Baustein nimmt seinen Text mit — am Draht gemessen", async () => {
    const a = await anlegen();
    const offen = await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: { version: a.version, koId: "ko-a", koVersion: 1, nachweisHash: "h-1" },
    });
    await app.inject({
      method: "POST",
      url: `/api/gesamtanweisungen/${a.id}/bausteine`,
      payload: {
        version: (offen.json() as { version: number }).version,
        koId: "ko-geheim",
        koVersion: 1,
        nachweisHash: "h-g",
      },
    });

    nutzer = { id: "erik", role: "experte" };
    const gelesen = await app.inject({ method: "GET", url: `/api/gesamtanweisungen/${a.id}` });
    expect(gelesen.statusCode).toBe(200);
    expect(gelesen.payload).not.toContain(GEHEIMER_SATZ);
    expect(gelesen.payload).toContain(TEXT_EINS);
    expect(gelesen.json()).toMatchObject({ unvollstaendig: true, verborgeneBausteine: 1 });
  });
});
