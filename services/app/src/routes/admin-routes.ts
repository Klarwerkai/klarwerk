import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import { type DemoSeedServices, purgeDemoSeed, seedDemoForAdmin } from "../seed-demo";

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

    // Pedi 02.07.: Demodaten KOMPLETT entfernen — auch wenn Tester sie verändert haben
    // (der demoSeed-Merker überlebt Bearbeitungen). Nur Admin; ehrliche Zähler-Rückgabe.
    app.delete("/api/admin/demo-seed", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await purgeDemoSeed(services, user.id));
    });
  };
}
