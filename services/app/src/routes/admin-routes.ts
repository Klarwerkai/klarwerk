import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import { type ExampleLoadServices, examplePackage, loadExamplePackage } from "../example-packages";
import { type FactoryReset, factoryResetUnavailable } from "../factory-reset";
import type { Guards } from "../http";
import { type DemoSeedServices, purgeDemoSeed, seedDemoForAdmin } from "../seed-demo";

// SCRUM-181: admin-geschützte Aktion, um eine LEERE Instanz mit Demodaten sichtbar zu machen.
// Kein Auto-Seed, kein anonymer Zugriff. Idempotent über den Empty-Guard im Seed selbst.
// Pedi 05.07.: zusätzlich der Werksreset (Factory-Settings) — nur im Desktop/Dev-Modus verfügbar.
export function adminRoutes(
  // WP-B6: die Beispielpaket-Route braucht zusätzlich das (optionale) Audit — build-app reicht die
  // vollen AppServices, die das strukturell erfüllen; direkte Test-Aufrufer bleiben kompatibel.
  services: DemoSeedServices & { audit?: AuditService },
  guards: Guards,
  factoryReset: FactoryReset = factoryResetUnavailable,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/admin/demo-seed", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      // Pedi 05.07. (Beta): `force` lädt das Demo-Set auch bei bereits erfassten Daten (erst wird
      // nur das vorhandene Demo-Set aufgeräumt, echte Daten bleiben). Ohne `force` unverändert.
      // SCRUM-487: `locale` (DE/EN/NL) steuert die Sprache der Demo-Inhalte — das Frontend sendet die
      // aktuelle UI-Sprache des ladenden Admins; unbekannt/leer → Default "de".
      const body = (request.body ?? {}) as { force?: unknown; locale?: unknown };
      const force = body.force === true;
      const locale = body.locale === "en" ? "en" : body.locale === "nl" ? "nl" : ("de" as const);
      const result = await seedDemoForAdmin(services, user.id, { force, locale });
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

    // WP-B6 (Pedis Wunsch für die VIP-2-Tester): EIN kuratiertes Beispielpaket laden — gezielte
    // kleine Szenarien statt Datenberg. Läuft über die bestehenden Anlege-Wege (KoService.create,
    // wie der Demo-Seed: Beispiel-KOs entstehen direkt als KO); idempotent über den
    // Beispiel-Herkunfts-Anker (zweites Laden dupliziert nichts). Ehrliche Bilanz + Audit.
    app.post<{ Body: { package?: unknown } }>(
      "/api/admin/examples/load",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const pkg = examplePackage(String(request.body?.package ?? ""));
        if (!pkg) {
          reply.code(400).send({
            error: "UNKNOWN_PACKAGE",
            message: "Unbekanntes Beispielpaket.",
          });
          return;
        }
        const deps: ExampleLoadServices = {
          ko: services.ko,
          objects: services.objects,
          // WP-SAMMEL21-FIX (bens Fix 1): echte Konflikt-Anlage für das konflikte-Paket.
          conflicts: services.conflicts,
          ...(services.audit ? { audit: services.audit } : {}),
        };
        reply.code(200).send(await loadExamplePackage(deps, pkg, user.id));
      },
    );

    // Pedi 05.07. (Beta): Verfügbarkeit des Werksresets. Die Oberfläche blendet den Knopf nur ein,
    // wenn er im aktuellen Betriebsmodus (Desktop/Dev-Journal) überhaupt möglich ist.
    app.get("/api/admin/factory-reset", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({ available: factoryReset.available });
    });

    // Pedi 05.07. (Beta): Werksreset ausführen — ALLE lokalen Daten löschen und das Programm
    // beenden; der nächste Start beginnt mit der Ersteinrichtung (erster Anwender = Admin).
    // Nur im Desktop/Dev-Modus möglich (sonst 403), damit produktive Daten nie betroffen sind.
    app.post("/api/admin/factory-reset", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      if (!factoryReset.available) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message:
            "Werksreset ist nur in der lokalen Desktop-Version möglich (nicht im Server-/Produktivbetrieb).",
        });
        return;
      }
      // SCRUM-450: Re-Authentifizierung. Der Werksreset löscht ALLE Daten unwiderruflich —
      // „angemeldet als Admin" allein reicht nicht, der Admin muss sein Passwort bestätigen.
      // So kann ein offener/übernommener Admin-Tab den Reset nicht ohne Passwort auslösen.
      const body = (request.body ?? {}) as { password?: unknown };
      const password = typeof body.password === "string" ? body.password : "";
      if (!password || !(await services.auth.verifyUserPassword(user.id, password))) {
        reply.code(401).send({
          error: "INVALID_PASSWORD",
          message: "Falsches Passwort. Der Werksreset wurde nicht ausgeführt.",
        });
        return;
      }
      // Erst antworten (damit die Oberfläche die Bestätigung erhält), dann Bestand löschen und
      // den Prozess beenden. Der Reset läuft bewusst NACH dem Flush der Antwort.
      reply.code(200).send({ ok: true });
      void factoryReset.run();
    });
  };
}
