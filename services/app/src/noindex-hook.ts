import type { FastifyInstance } from "fastify";

// WP-E2 (ben-Auflage 1): die X-Robots-Hook-Registrierung als benannte, testbare Funktion. server.ts
// (Laufzeit-Einstieg, startet beim Import) verdrahtet sie in Produktion; Tests verdrahten damit EXAKT
// dieselbe Form — keine Test-Kopie, keine Drift. WP-E-Regel: app-globale onSend-Hooks IMMER synchron
// (Callback-Stil) — ab zwei async-Hops öffnet sich das wrap-thenable-Doppel-Send-Fenster
// (ERR_HTTP_HEADERS_SENT-Crash), Details in routes/addin-static-routes.ts.
export function registerNoindexHook(app: FastifyInstance): void {
  // Vorab-Phase: nicht indexieren (zusätzlich zu robots.txt/Meta im Frontend).
  app.addHook("onSend", (_request, reply, payload, done) => {
    reply.header("X-Robots-Tag", "noindex, nofollow");
    done(null, payload);
  });
}
