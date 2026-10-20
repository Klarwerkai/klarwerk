import type { FastifyInstance } from "fastify";
import { expect } from "vitest";

export async function echterNotizauftrag(
  app: FastifyInstance,
  headers: Record<string, string>,
  inhalt: string,
) {
  const objektbezug = {
    pfad: "/kalender",
    seitenName: "Mein Kalender",
    objekt: "Synthetische Normprüfung",
  };
  const notiz = await app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers,
    payload: {
      vorgang: `norm-plan-${crypto.randomUUID()}`,
      weg: "geschrieben",
      titel: "Fiktive Originalbekanntmachung",
      inhalt,
      objektbezug,
    },
  });
  expect(notiz.statusCode, notiz.body).toBe(201);
  const n = notiz.json().notiz;
  const g = await app.inject({
    method: "POST",
    url: "/api/me/klara/gespraeche",
    headers,
    payload: { objektbezug },
  });
  expect(g.statusCode, g.body).toBe(201);
  expect(g.json().gespraech.nachrichten).toEqual([]);
  const ziel = {
    art: "neue_persoenliche_aufgabe",
    id: null,
    titel: "Fiktive Bekanntmachung prüfen",
    stand: null,
    pfad: null,
  };
  const pfad = `/api/me/klara/gespraeche/${g.json().gespraech.id}/auftraege`;
  const r = await app.inject({
    method: "POST",
    url: pfad,
    headers,
    payload: {
      quelle: "getippt",
      wortlaut: "Diese tatsächlich ausgewählte eigene Notiz als persönliche Prüfaufgabe führen.",
      ziel: "Eigene fiktive Normprüfung",
      erlaubteAktionen: ["persoenliche_aufgabe_anlegen"],
      erlaubteZiele: [ziel],
      erlaubteQuellen: [`notiz:${n.id}`],
      ergebnis: "Persönliche Prüfaufgabe aus der wirklichen Originalnotiz",
      geplanteSchritte: 1,
      plan: [
        {
          aktion: "persoenliche_aufgabe_anlegen",
          ziel,
          ausSchritt: null,
          notizQuelle: { id: n.id, fassung: n.fassung, weg: "geschrieben" },
        },
      ],
    },
  });
  expect(r.statusCode, r.body).toBe(201);
  return {
    notiz: n,
    gespraechId: g.json().gespraech.id as string,
    auftragId: r.json().auftrag.id as string,
    pfad,
  };
}
