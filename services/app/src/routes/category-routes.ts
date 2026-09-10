import type { FastifyPluginAsync } from "fastify";
import type { KoService } from "../../../knowledge-object";
import { can } from "../../../rbac";
import { type Guards, sendError } from "../http";
import { sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

export function categoryRoutes(ko: KoService, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    // Eine leere Liste heißt „in deinem sichtbaren Bestand kommt kein Bereich vor“,
    // nicht „es gibt keine Bereiche“. Auch eine gefüllte Liste beschreibt ausschließlich
    // die Sicht dieses Fragenden und darf auf der späteren Fläche nicht Gesamtbestand heißen.
    app.get("/api/categories", async (request, reply) => {
      reply.header("cache-control", "private, no-store");
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      // Der Auskunftsvertrag verlangt bei fehlendem Leserecht eine leere Sicht.
      if (!can(user.role, "ko.read")) {
        reply.code(200).send({ categories: [] });
        return;
      }
      try {
        // Dieselbe Naht wie library/search: SQL-Trim plus G-SHADOW, vor der Zählung.
        // Die bestehende Projektion liest ohne bodyHtml und ohne Deckel oder Such-Backfill.
        const sichtbar = sichtbareFuer(user, await ko.listForSearch({}, sqlSichtbarkeitFuer(user)));
        const counts = new Map<string, number>();
        for (const object of sichtbar) {
          const name = object.category;
          if (typeof name !== "string" || name.trim().length === 0) {
            continue;
          }
          // Nur auf Leerraum prüfen, nicht umbenennen: category-Filter vergleichen exakt.
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const categories = [...counts].map(([name, count]) => ({ name, count }));
        // UTF-16-Zeichenreihenfolge; unabhängig von Servergebiet und Intl-Konfiguration.
        categories.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        reply.code(200).send({ categories });
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
