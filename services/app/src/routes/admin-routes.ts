import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import { type ExampleLoadServices, examplePackage, loadExamplePackage } from "../example-packages";
import { type FactoryReset, factoryResetUnavailable } from "../factory-reset";
// AUFTRAG-mega64 Block A: der Betriebsschalter für das Demodaten-Laden — dieselbe eine Wahrheit,
// aus der auch GET /api/features antwortet (mega46 F).
import { schalterAn } from "../feature-flags";
import type { Guards } from "../http";
import { type DemoSeedServices, purgeDemoSeed, seedDemoForAdmin } from "../seed-demo";
// SCRUM-501 (nacht24): Demo-/Simulationskorpus DE/EN/NL — NICHT automatisch, nur über diesen
// Admin-Weg (bzw. tools/seed-sim-corpus); Entfernen über den bestehenden Demo-Purge (demoSeed).
import { loadSimCorpus } from "../sim-corpus";

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
    // ==========================================================================================
    // AUFTRAG-mega64 BLOCK A — DAS TOR VOR DEM EINZIGEN WEG, DER KONTEN ANLEGT.
    // ==========================================================================================
    //
    // Bis mega64 war diese Route in JEDER App registriert, mit `users.manage` als einziger Hürde,
    // und legte freigegebene Controller-/Expertenkonten mit im Quelltext festgeschriebenen
    // Kennwörtern an (Befund ben, BERICHT-ben-sammel61-mega63.md, Finding 1). Ohne gesetzten
    // Schalter EXISTIERT sie ab hier nicht — kein 403 mit erklärender Nachricht, sondern 404, wie
    // der Confluence-Import und die Herkunftskette es in build-app.ts längst vormachen.
    //
    // WARUM DAS TOR HIER STEHT UND NICHT IN build-app.ts BEI DEN ANDEREN ZWEIEN: Diese Datei führt
    // nicht nur den Lade-Weg, sondern auch den ENTFERNEN-Weg (DELETE, Demo-Purge), den lesenden
    // Stand (GET) und den Werksreset. Ein Tor um das ganze Plugin nähme dem Betrieb genau das
    // Werkzeug, mit dem er vorhandene Demodaten wieder loswird — die Sperre würde den Bestand
    // einschließen, statt die Quelle zu schließen. Gesperrt wird deshalb ausschließlich das
    // ANLEGEN.
    //
    // Der Schalter hat ausdrücklich Vorgabe AUS (Begründung am Registry-Eintrag in
    // feature-flags.ts) — er ist keine Notausschalter-Pflichtfläche, sondern eine Vorführhilfe.
    if (schalterAn("demodaten")) {
      app.post("/api/admin/demo-seed", async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        // Pedi 05.07. (Beta): `force` lädt das Demo-Set auch bei bereits erfassten Daten (erst wird
        // nur das vorhandene Demo-Set aufgeräumt, echte Daten bleiben). Ohne `force` unverändert.
        // SCRUM-487: `locale` (DE/EN/NL) steuert die Sprache der Demo-Inhalte — das Frontend sendet
        // die aktuelle UI-Sprache des ladenden Admins; unbekannt/leer → Default "de".
        const body = (request.body ?? {}) as { force?: unknown; locale?: unknown };
        const force = body.force === true;
        const locale = body.locale === "en" ? "en" : body.locale === "nl" ? "nl" : ("de" as const);
        const result = await seedDemoForAdmin(services, user.id, { force, locale });
        // Ehrliche Rückgabe: seeded vs. skipped (Instanz nicht leer) inkl. Kennzahlen.
        //
        // AUFTRAG-mega64 Block A: `einmalkennwoerter` trägt die FRISCH ERZEUGTEN Zugangsdaten der
        // neu angelegten Demo-Konten. Sie stehen NUR hier, in der Antwort auf genau diesen Aufruf —
        // nirgends im Quelltext, nirgends in einem Protokoll. Fastify protokolliert Antwortkörper
        // nicht; wer hier künftig ein `request.log.info(result)` einfügt, macht aus der Antwort
        // einen Logeintrag und hebt die ganze Maßnahme auf.
        reply.code(200).send(result);
      });
    }

    // AUFTRAG-mega14 Block H (SCRUM-437): LESENDER Status der Demodaten für die Bereitschafts-
    // Checkliste. Bis mega14 gab es zu Demodaten nur POST (laden) und DELETE (entfernen) — die
    // Oberfläche konnte gar nicht wissen, ob gerade welche geladen sind, und die Checkliste hatte
    // deshalb keine Zeile dafür.
    //
    // Dieselbe Wahrheit, die `seedDemoForAdmin` selbst benutzt (`seed-demo.ts:150`): der
    // `demoSeed`-Merker am Wissensobjekt. Kein zweiter Zähler, keine zweite Definition — und
    // ausdrücklich KEIN zweiter Lade-/Entfernen-Weg.
    app.get("/api/admin/demo-seed", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const kos = await services.ko.list();
      const count = kos.filter((k) => k.demoSeed === true).length;
      reply.code(200).send({ present: count > 0, count });
    });

    // SCRUM-501 (nacht24 Paket 7.2): Simulationskorpus DE/EN/NL laden (~30 Industrie-KOs je
    // Sprache, inkl. gewollter Cross-Sprach-Duplikate/-Konflikte). Idempotent über das
    // sim-korpus-Tag; alle Einträge tragen demoSeed → Entfernen über den Demo-Purge unten.
    app.post("/api/admin/sim-corpus", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(await loadSimCorpus(services, user.id));
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
