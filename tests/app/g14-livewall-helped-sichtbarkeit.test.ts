// ================================================================================================
// JOB 1325 (G14, DRITTER AUSGABEZWEIG) — DIE LIVE-WALL NANNTE TITEL, DIE DER LESER NICHT SEHEN DARF.
// ================================================================================================
//
// DER BEFUND (heute am Draht gemessen — der erste Lauf dieses Tests war ROT und hat ihn geliefert):
// `/api/livewall` hat ZWEI Ausgabezweige. Der `saved`-Zweig zog seine Grundmenge seit mega74
// BLOCK E durch `sichtbareFuer` (livewall-routes.ts:30) — der `helped`-Zweig nicht.
//
// `helped` speist sich aus dem `answer.helpful`-Audit. Dessen Payload trägt den ECHTEN KO-Titel
// (services/ask/src/service.ts:626), und `livewall.ts:51` prüfte davon nur den TYP
// (`typeof e.payload.koTitle === "string"`) — eine Typprüfung, kein Sichtbarkeitstor. Ein
// vertrauliches Objekt stand damit samt Titel in der Wall und zählte in `helpedToday` mit; wegen
// der Zeitsortierung (livewall.ts:53) sogar an erster Stelle.
//
// Dass das Haus die Frage längst beantwortet hat, zeigt der zweite Verbraucher DESSELBEN Stroms:
// notifications-routes.ts:45 filtert. Nur die Live-Wall folgte dem nicht.
//
// Der dritte Fall unten ist die GEGENPROBE und gehört zum Beweis: er belegt, dass das vertrauliche
// Objekt für diesen Leser tatsächlich unsichtbar ist. Wäre er rot, läge der Fehler in der Lage
// dieses Tests und nicht im Produkt.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  type LiveWallRoutesDeps,
  livewallRoutes,
} from "../../services/app/src/routes/livewall-routes";
import type { KnowledgeObject } from "../../services/knowledge-object";

// Die Route bildet `today` aus der echten Uhr (livewall-routes.ts:26); die Ereignisse müssen
// deshalb auf dem heutigen Kalendertag liegen, sonst prüfte der zweite Fall nichts.
const heute = new Date().toISOString().slice(0, 10);

const ko = (id: string, title: string, confidentiality: string): KnowledgeObject =>
  ({
    id,
    title,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u-fremd",
    author: "u-fremd",
    confidentiality,
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: `${heute}T08:00:00.000Z`,
    history: [],
    comments: [],
    attachments: [],
    sources: [],
  }) as unknown as KnowledgeObject;

// Der Leser ist NICHT Autor und hat NICHT `ko.validate` (Rolle `experte`) — nach
// `darfSehen` (sichtbarkeit.ts:67-77) ist `geheim1` für ihn unsichtbar.
const leser = { id: "u-leser", role: "experte" } as unknown as SessionUser;

const kos = [
  ko("intern1", "Presse P2 entlüften", "intern"),
  ko("geheim1", "Zugangscode Leitstand", "vertraulich"),
];

// BEIDE Objekte haben heute geholfen, BEIDE Einträge tragen einen echten Titel im Payload.
const helpful = [
  {
    actor: "u-anders",
    target: "intern1",
    at: `${heute}T10:00:00.000Z`,
    payload: { koTitle: "Presse P2 entlüften", koAuthor: "u-fremd" },
  },
  {
    actor: "u-anders",
    target: "geheim1",
    at: `${heute}T11:00:00.000Z`,
    payload: { koTitle: "Zugangscode Leitstand", koAuthor: "u-fremd" },
  },
];

async function wandAbrufen() {
  const app = Fastify();
  const deps = {
    ko: { list: async () => kos },
    audit: { list: async () => helpful },
  } as unknown as LiveWallRoutesDeps;
  const guards = {
    requireUser: async () => leser,
    requirePermission: async () => leser,
  } as unknown as Guards;

  await app.register(livewallRoutes(deps, guards));
  const res = await app.inject({ method: "GET", url: "/api/livewall" });
  await app.close();
  expect(res.statusCode).toBe(200);
  return res.json() as {
    saved: Array<{ koId: string; title: string }>;
    helped: Array<{ koId: string; title: string }>;
    helpedToday: number;
  };
}

describe("JOB 1325 G14 · Live-Wall: der helped-Zweig gegen die Sichtbarkeit", () => {
  it("nennt keinen Titel eines Objekts, das der Leser nicht sehen darf", async () => {
    const wand = await wandAbrufen();
    expect(wand.helped.map((h) => h.title)).toEqual(["Presse P2 entlüften"]);
  });

  it("zählt in helpedToday nur sichtbare Objekte", async () => {
    const wand = await wandAbrufen();
    expect(wand.helpedToday).toBe(1);
  });

  it("Gegenprobe: der saved-Zweig filtert bereits — das vertrauliche Objekt ist wirklich unsichtbar", async () => {
    const wand = await wandAbrufen();
    expect(wand.saved.map((s) => s.koId)).toEqual(["intern1"]);
  });
});
