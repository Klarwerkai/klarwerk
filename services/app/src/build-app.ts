import Fastify, { type FastifyInstance } from "fastify";
import { AuditService, InMemoryAuditRepo } from "../../audit";
import { AuthService, InMemorySessionRepo, InMemoryUserRepo, authRoutes } from "../../auth";
import { InMemoryKoRepo, KoService } from "../../knowledge-object";
import { type RoleResolver, requirePermission } from "../../rbac";
import { Reasoner } from "../../reasoner";

// Composition-Root des modularen Monolithen: verdrahtet die Module zu EINER App.
// Jeder Import läuft über die öffentliche index.ts des jeweiligen Moduls.
export interface AppServices {
  auth: AuthService;
  ko: KoService;
  reasoner: Reasoner;
  audit: AuditService;
}

export function buildServices(): AppServices {
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  return {
    auth: new AuthService({
      users: new InMemoryUserRepo(),
      sessions: new InMemorySessionRepo(),
      audit,
    }),
    ko: new KoService({ repo: new InMemoryKoRepo(), audit }),
    reasoner: new Reasoner(),
    audit,
  };
}

export function buildApp(services: AppServices = buildServices()): FastifyInstance {
  const app = Fastify();

  // Verbindet rbac mit auth: Rolle des Requests kommt aus der Sitzung (FR-RBAC-04).
  const resolveRole: RoleResolver = async (request) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
    if (!token) {
      return undefined;
    }
    const user = await services.auth.authenticate(token);
    return user?.role;
  };

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/api/reasoner/status", async () => services.reasoner.status()); // FR-RSN-05

  app.register(authRoutes(services.auth));

  // Beispiel-Endpunkt: KO-Liste, geschützt durch die Rechtematrix (auth + rbac + knowledge-object).
  app.get("/api/kos", { preHandler: requirePermission("ko.read", resolveRole) }, () =>
    services.ko.list(),
  );

  return app;
}
