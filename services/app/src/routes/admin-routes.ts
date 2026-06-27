import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import { type DemoSeedServices, seedDemoForAdmin } from "../seed-demo";

// SCRUM-181: admin-geschützte Aktion, um eine LEERE Instanz mit Demodaten sichtbar zu machen.
// Kein Auto-Seed, kein anonymer Zugriff. Idempotent über den Empty-Guard im Seed selbst.
export function adminRoutes(services: DemoSeedServices, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/admin/demo-seed", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const result = await seedDemoForAdmin(services, user.id);
      // Ehrliche Rückgabe: seeded vs. skipped (Instanz nicht leer) inkl. Kennzahlen.
      reply.code(200).send(result);
    });
  };
}
