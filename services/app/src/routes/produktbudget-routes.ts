import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import { type Produktbudget, ProduktbudgetFehler } from "../produktbudget";

// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DIE PRODUKTBUDGETS IN DER VERWALTUNG.
// ================================================================================================
//
//   GET /api/admin/produktbudget             Bereiche mit Betrag, Währung, Zeitraum, Verbrauch, Rest
//   PUT /api/admin/produktbudget/:bereich    Einstellung eines Bereichs ändern
//
// BEIDE NUR MIT `users.manage` (PBE-05), am Server geprüft — die Oberfläche blendet nichts frei.
// Mandant und ändernde Person kommen aus Instanz und Sitzung; Angaben dazu im Rumpf werden
// abgewiesen. Die Änderung erteilt keine Anbieterfreigabe, keinen Zugang und keine Tokens.
// Ins Prüfprotokoll geht die Änderung mit Bereich und Änderungskennung, ohne Geheimnisse.

export const PRODUKTBUDGET_GEAENDERT = "produktbudget.geaendert";

export interface ProduktbudgetRoutenDeps {
  readonly dienst: Produktbudget;
  readonly audit: AuditService;
}

const FREMDE_FELDER = ["mandant", "kontoId", "konto", "userId", "nutzer", "von"] as const;

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function produktbudgetRoutes(
  deps: ProduktbudgetRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/admin/produktbudget", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(await deps.dienst.lies());
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.put<{ Params: { bereich: string }; Body: unknown }>(
      "/api/admin/produktbudget/:bereich",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const r = rumpf(request.body);
        if (FREMDE_FELDER.some((f) => r[f] !== undefined)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Mandant und ändernde Person kommen aus Instanz und Anmeldung.",
          });
          return;
        }
        try {
          const ergebnis = await deps.dienst.aendere(user.id, request.params.bereich, {
            betrag: r.betrag,
            waehrung: r.waehrung,
            zeitraum: r.zeitraum,
            fassung: r.fassung,
            aenderungId: r.aenderungId,
            grund: r.grund,
          });
          if (ergebnis.geaendert) {
            await deps.audit.record({
              actor: user.id,
              action: PRODUKTBUDGET_GEAENDERT,
              target: `produktbudget:${request.params.bereich}:${String(r.aenderungId)}`,
            });
          }
          reply.header("cache-control", "no-store");
          reply.code(200).send({
            ...ergebnis.sicht,
            wiederholt: ergebnis.wiederholt,
            geaendert: ergebnis.geaendert,
          });
        } catch (fehler) {
          if (fehler instanceof ProduktbudgetFehler) {
            reply.code(fehler.status).send({
              error:
                fehler.status === 404
                  ? "NOT_FOUND"
                  : fehler.status === 409
                    ? "CONFLICT"
                    : "VALIDATION",
              grund: fehler.grund,
              message: fehler.message,
              ...(fehler.stand ? { stand: fehler.stand } : {}),
            });
            return;
          }
          sendError(reply, fehler);
        }
      },
    );
  };
}
