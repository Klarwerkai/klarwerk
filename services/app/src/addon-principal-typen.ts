import type {} from "fastify";
import type { BremsGrenze } from "./anfragebremse";

// Aufnahme gesamt-integrations-api: die drei weiteren Rechte trägt nur ein Dienst-Schlüssel
// (`dienst-schluessel.ts`) — der Klara-Schlüssel bleibt bei den beiden obigen.
// Aufnahme gesamt-mcp (R-0713): `mcp.werkzeug` öffnet den MCP-Zugang (`routes/mcp-routes.ts`),
// ebenfalls nur für einen Dienst-Schlüssel.
export type AddonCapability =
  | "ask.validated"
  | "checktext.validated"
  | "export.validated"
  | "import.kandidaten"
  | "mail.entwurf"
  | "status.read"
  | "mcp.werkzeug";

export interface AddonPrincipal {
  readonly kind: "addon";
  readonly id: string; // ADDON_ACTOR_ID — stabile Bucket-/Audit-ID
  readonly capabilities: readonly AddonCapability[];
  // Nur bei einem Dienst-Schlüssel: seine Kennung und seine eigene Grenze. Fehlt beim Klara-Schlüssel.
  readonly dienst?: { readonly schluessel: string; readonly grenze: BremsGrenze };
}

// Request-lokaler Auth-Kontext: EINMAL pro Request bestimmt (onRequest-Hook), danach von
// Rate-Limiter, allowList und Handler GELESEN — nie neu validiert. Ersetzt die zuvor dreifache
// Key-Prüfung (keyGenerator/allowList/handler) durch eine einzige Auflösung.
export type AuthContext =
  | { readonly authKind: "addon"; readonly principal: AddonPrincipal }
  | { readonly authKind: "session"; readonly principal: null };

// request.authContext am Fastify-Request tragen (Typaugmentation).
declare module "fastify" {
  interface FastifyRequest {
    authContext?: AuthContext | null;
  }
}
