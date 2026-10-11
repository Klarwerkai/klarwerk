// ================================================================================================
// AUFNAHME 20260922 · GESAMT-KONFLIKTKLASSIFIKATION · R-0252 — DER EINORDNUNGSWEG UND DIE
// DATENZUGRIFFSGRENZEN (Nacharbeit 6, Ben).
// ================================================================================================
//
// `POST /api/conflicts/:id/arbeitsart` prüfte nur das Recht `conflict.resolve`. Gemessen wird hier
// an der ECHTEN Route (`conflictRoutes`), was seit Nacharbeit 6 zusätzlich gilt — dieselben zwei
// Stufen wie der Detailweg `GET /api/conflicts/:id`:
//   E1 · ist das Paar für diesen Menschen nicht sichtbar, antwortet die Route 404 und ändert NICHTS,
//   E2 · ist es sichtbar, der Inhalt einer Seite aber zurückgehalten, geht die Antwort durch
//        `feldFreigabe` + `redigiereKonflikt`: keine Beschreibung, keine Belegzitate, kein von Klara
//        vorgeschlagener Geltungsbereich im Rohkörper,
//   E3 · Kalibrierung: sind beide Seiten frei, geht nichts verloren.
//
// Aufbau wie `tests/security/nebenweg-feldredaktion.test.ts`: die Sichtbarkeitslage kommt über den
// Zugang (`KoSichtbarkeitsZugang`), der Dienst ist eine Attrappe, die jede Änderung mitschreibt.
// GRENZE: die Lage ist hier die Vertraulichkeitsstufe; die Space-Regel läuft durch dasselbe
// Prädikat `paarSichtbar` (sichtbarkeit.ts), wird hier aber nicht eigens aufgebaut.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { conflictRoutes } from "../../services/app/src/routes/conflicts-routes";
import type { KoSichtbarkeitsZugang } from "../../services/app/src/sichtbarkeit";

const KURATORIN: SessionUser = { id: "kuratorin-1", role: "controller" };
const LESERIN: SessionUser = { id: "leserin-1", role: "viewer" };

const KO_INTERN = { confidentiality: "intern" as const, author: "autorin-1" };
const KO_VERTRAULICH = { confidentiality: "vertraulich" as const, author: "autorin-1" };

const zugang = (map: Record<string, { confidentiality: string; author: string }>) =>
  ({
    get: async (id: string) => map[id],
  }) as KoSichtbarkeitsZugang;

/** Die vertrauliche Seite: die Kuratorin darf das Paar öffnen, ihren INHALT bekommt sie nicht. */
const EINE_VERTRAULICH = zugang({ "ko-a": KO_INTERN, "ko-b": KO_VERTRAULICH });
const BEIDE_INTERN = zugang({ "ko-a": KO_INTERN, "ko-b": { ...KO_INTERN, author: "wer-anders" } });

const KONFLIKT = {
  id: "c-1",
  koA: "ko-a",
  koB: "ko-b",
  type: "truth",
  description: "GEHEIM-BESCHREIBUNG",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  origin: "auto",
  createdAt: "2026-08-01T06:00:00.000Z",
  detector: {
    trigger: "validation",
    method: "model",
    rationale: "GEHEIM-GRUND",
    quotes: { a: "GEHEIM-ZITAT-A", b: "GEHEIM-ZITAT-B" },
    vorschlag: { art: "praezisierung", spezieller: "ko-b", geltungsbereich: "GEHEIM-BEREICH" },
  },
};

const guardsFuer = (user: SessionUser): Guards => ({
  requireUser: async () => user,
  requirePermission: async () => user,
});

let offen: FastifyInstance[] = [];

afterEach(async () => {
  for (const instance of offen) {
    await instance.close();
  }
  offen = [];
});

/** Die echte Route über einem Dienst, der jede Einordnung mitschreibt. */
async function einordnungsApp(
  user: SessionUser,
  kos: KoSichtbarkeitsZugang,
  vorhanden: typeof KONFLIKT | undefined,
) {
  const geaendert: { id: string; arbeitsart: string; actor: string }[] = [];
  const dienst = {
    get: async () => vorhanden,
    einordnen: async (id: string, arbeitsart: string, actor: string) => {
      geaendert.push({ id, arbeitsart, actor });
      return { ...KONFLIKT, arbeitsart };
    },
  };
  const instance = Fastify();
  instance.register(conflictRoutes(dienst as never, guardsFuer(user), kos));
  await instance.ready();
  offen.push(instance);
  const einordnen = () =>
    instance.inject({
      method: "POST",
      url: "/api/conflicts/c-1/arbeitsart",
      payload: { arbeitsart: "regel" },
    });
  return { einordnen, geaendert };
}

describe("R-0252 · der Einordnungsweg hält die Paar-Sichtbarkeit und die Feldredaktion ein", () => {
  it("E1: unsichtbares Paar → 404 wie der Detailweg, und es wird NICHTS geändert", async () => {
    const { einordnen, geaendert } = await einordnungsApp(LESERIN, EINE_VERTRAULICH, KONFLIKT);
    const res = await einordnen();
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "NOT_FOUND", message: "Konflikt nicht gefunden." });
    expect(geaendert, "die Einordnung hat einen unsichtbaren Konflikt verändert").toEqual([]);
    expect(res.body).not.toContain("GEHEIM");
  });

  it("E1b: unbekannter Konflikt → dieselbe 404, nichts geändert", async () => {
    const { einordnen, geaendert } = await einordnungsApp(KURATORIN, BEIDE_INTERN, undefined);
    const res = await einordnen();
    expect(res.statusCode).toBe(404);
    expect(geaendert).toEqual([]);
  });

  it("E2: sichtbares Paar mit zurückgehaltener Seite → eingeordnet, Antwort ohne einen geheimen Text", async () => {
    const { einordnen, geaendert } = await einordnungsApp(KURATORIN, EINE_VERTRAULICH, KONFLIKT);
    const res = await einordnen();
    expect(res.statusCode).toBe(200);
    expect(geaendert).toEqual([{ id: "c-1", arbeitsart: "regel", actor: "kuratorin-1" }]);
    const koerper = res.json();
    expect(koerper.arbeitsart).toBe("regel");
    expect(koerper.redacted).toBe(true);
    expect(koerper.description).toBe("");
    expect(koerper.detector.vorschlag.geltungsbereich).toBe("");
    // Der Rohkörper ist die eigentliche Probe — kein Leck an irgendeiner Stelle.
    expect(res.body).not.toContain("GEHEIM");
  });

  it("E3: Kalibrierung — sind beide Seiten frei, kommt der volle Konflikt zurück", async () => {
    const { einordnen } = await einordnungsApp(LESERIN, BEIDE_INTERN, KONFLIKT);
    const res = await einordnen();
    expect(res.statusCode).toBe(200);
    const koerper = res.json();
    expect(koerper.redacted).toBe(undefined);
    expect(koerper.description).toBe("GEHEIM-BESCHREIBUNG");
    expect(koerper.detector.vorschlag.geltungsbereich).toBe("GEHEIM-BEREICH");
  });
});
