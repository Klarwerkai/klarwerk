import type { FastifyPluginAsync } from "fastify";
import type { AskService } from "../../../ask";
import type { Reasoner } from "../../../reasoner";
import type { Guards } from "../http";

// Reasoner (§2.5): ein einheitlicher, modellagnostischer Endpunkt. 'structure' formt Rohtext
// zu einem KO-Vorschlag; 'ask' beantwortet über die Ask-Schicht (Kontext aus validierten KOs).
export interface ReasonerRoutesDeps {
  reasoner: Reasoner;
  ask: AskService;
}

export function reasonerRoutes(deps: ReasonerRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { reasoner, ask } = deps;

  return async (app) => {
    app.post<{ Body: { task: "structure" | "ask"; text: string } }>(
      "/api/reasoner",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const { task, text } = request.body;
        if (task === "structure") {
          reply.code(200).send(await reasoner.structure(text ?? ""));
          return;
        }
        if (task === "ask") {
          reply.code(200).send(await ask.ask(text ?? ""));
          return;
        }
        reply
          .code(400)
          .send({ error: "BAD_REQUEST", message: "task muss 'structure' oder 'ask' sein." });
      },
    );
  };
}
