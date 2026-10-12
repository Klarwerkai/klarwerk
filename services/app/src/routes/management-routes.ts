import type { FastifyPluginAsync } from "fastify";
import type { ManagementService } from "../../../management";
import { can } from "../../../rbac";
import { type Guards, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot. Read-only, stateless.
//
// R-0751 / R-1639 / R-2183 (Nacharbeit 3): dazu der Bereichsblick mit Ruhestandshorizonten
// (`ko.read`, Grundmenge über `sichtbarkeitsfilterFuer`) und die Pflege seiner Eingänge
// (`users.manage`). `nutzerGibtEs` hält die Ruhestandspflege an echten internen Konten — eine
// fremde oder erfundene Kennung wird nicht gespeichert.
export function managementRoutes(
  management: ManagementService,
  guards: Guards,
  nutzerGibtEs: (userId: string) => Promise<boolean> = async () => false,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/management/snapshot", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega76 BLOCK D: der breiteste der sechs Leckpfade. Die Grundmenge wird gefiltert,
      // BEVOR gerechnet wird — sonst trügen die Scores und die Kategoriezeilen den unsichtbaren
      // Bestand weiter mit.
      // R-1657 (Nacharbeit 2): `sicht` merkt DIESE Betrachtersicht für die regelmäßige
      // Reasoner-Analyse der Wissens-Sprints vor — sie urteilt nur über das, was sie sehen darf.
      const snapshot = await management.snapshot({
        sichtbar: sichtbarkeitsfilterFuer(user),
        sicht: user.id,
      });
      reply.code(200).send(snapshot);
    });

    // R-1639 / R-2183: „mein Bereich" — nur Bereiche, die den Abrufenden als Verantwortlichen
    // nennen; wer Bereichsprofile pflegt (`users.manage`), sieht alle. Ruhestandsangaben stehen nur
    // an Trägern dieser Bereiche, und die Grundmenge ist vor dem Zählen getrimmt.
    app.get("/api/management/risk-horizon", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const sicht = await management.riskHorizon({
        sichtbar: sichtbarkeitsfilterFuer(user),
        viewer: { userId: user.id, seesAll: can(user.role, "users.manage") },
      });
      reply.code(200).send(sicht);
    });

    app.get("/api/management/profiles", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const [categories, retirement] = await Promise.all([
        management.listCategoryProfiles(),
        management.listRetirement(),
      ]);
      reply.code(200).send({ categories, retirement });
    });

    app.put("/api/management/profiles/category", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await management.setCategoryProfile(request.body, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Params: { userId: string }; Body: { horizonMonths?: unknown } }>(
      "/api/management/profiles/retirement/:userId",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        if (!(await nutzerGibtEs(request.params.userId))) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Unbekanntes Konto." });
          return;
        }
        try {
          const eintrag = await management.setRetirement(
            request.params.userId,
            request.body?.horizonMonths,
            user.id,
          );
          reply.code(200).send({ entry: eintrag });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );
  };
}
