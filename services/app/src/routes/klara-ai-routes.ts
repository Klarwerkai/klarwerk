import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { Guards } from "../http";
import { sendError } from "../http";
import {
  type KlaraDocumentDescriptor,
  KlaraError,
  type KlaraSessionService,
  type KlaraSessionView,
} from "../services/klara-session-service";

// ================================================================================================
// W1 S4 — DER KLARA-STATUS-, SITZUNGS- UND CONSENT-VERTRAG (KW-S4-04 §13-100)
// ================================================================================================
//
// WAS DIESE DATEI IST: eine Serialisierungsschicht. Sie prüft die Berechtigung, liest die Bindung
// aus der Anfrage und reicht an den Dienst weiter. Sie entscheidet NICHTS über Modus, Anbieter,
// Modell, Fallback oder Consentbedarf — das ist No-Go 1 des Auftrags und §128 der Architektur
// („Providerwahl in HTTP-Routen").
//
// WARUM NICHT ÜBER `/api/reasoner/status`. KW-S4-04 §54 verbietet Klara-spezifische Consent-/
// Policylogik in der bestehenden öffentlichen Statusroute ausdrücklich. Sie beantwortet die globale
// Reasoner-Lage; Klara braucht eine an Sitzung und Zustimmung gebundene Auflösung. Zwei Fragen,
// zwei Endpunkte — `build-app.ts:839` bleibt unverändert.
//
// BERECHTIGUNG: `ko.read`. Die Rechtematrix (`services/rbac/src/policy.ts`) ist abgeschlossen und
// liegt ausserhalb des Auftragsbereichs; eine eigene `klara.*`-Berechtigung ist hier nicht
// möglich. `ko.read` ist die Berechtigung, die jeder Klara-Nutzer für den Ask-Weg ohnehin braucht
// (`ask-routes.ts:149`) — kein neues Recht und keine Erweiterung. Die feinere Bindung an Actor,
// Add-in-Instanz und Dokumentkontext leistet der Sitzungsdienst, nicht RBAC.

export interface KlaraAiRouteDeps {
  readonly sessions: KlaraSessionService;
}

/**
 * Die Bindung kommt aus Headern, nicht aus dem Body: sie gehört zum Transport der Add-in-Instanz
 * und soll auch bei `DELETE`/`POST` ohne Körper verfügbar sein. Die Werte sind OPAK — der Server
 * interpretiert sie nie, er prüft nur Gleichheit.
 */
const SESSION_HEADER = "x-klara-session";
const INSTANCE_HEADER = "x-klara-instance";
const DOCUMENT_HEADER = "x-klara-document";

function kopf(request: { headers: Record<string, unknown> }, name: string): string {
  const wert = request.headers[name];
  return typeof wert === "string" ? wert.trim() : "";
}

function bindungAus(
  request: { headers: Record<string, unknown> },
  actorId: string,
): { actorId: string; addinInstanceId: string; documentContextId: string } {
  return {
    actorId,
    addinInstanceId: kopf(request, INSTANCE_HEADER),
    documentContextId: kopf(request, DOCUMENT_HEADER),
  };
}

/**
 * EINE Fehlerabbildung für alle sechs Endpunkte. Sie benutzt den vorhandenen `sendError`, damit
 * dieselbe Maskierung greift wie überall sonst (G27: interne Codes bleiben drinnen). Ein
 * `KlaraError` trägt einen Domänencode und eine für Menschen lesbare Meldung — nie eine interne
 * Policyregel und nie ein Secret (Auftrag §154).
 */
function fehler(reply: FastifyReply, error: unknown): void {
  sendError(reply, error);
}

export function klaraAiRoutes(deps: KlaraAiRouteDeps, guards: Guards): FastifyPluginAsync {
  const dienst = deps.sessions;

  return async (app) => {
    // ------------------------------------------------------------------------------------------
    // GET /api/klara/ai-status — NUR gegen eine registrierte, attestierte Zuordnung (S4-20 §5/§6)
    // ------------------------------------------------------------------------------------------
    //
    // KORRIGIERT NACH BEN ROT-5. R1 beantwortete diese Route ohne `sessionId` direkt aus der
    // Konfiguration und benutzte die Instanz-/Dokumentheader gar nicht — ein angemeldeter Nutzer
    // bekam Status ohne jede Bindung. S4-20 §6 ist eindeutig: ohne gültige aktive Zuordnung gibt
    // es keinen Statusvertrag und keine Policyauflösung.
    //
    // Die drei Header sind AUSSCHLIESSLICH Lookup/Korrelation (S4-20 §102-103). Attestiert wird
    // nichts durch sie: der Server vergleicht sie gegen die bei `POST /sessions` registrierte
    // Zuordnung. Wer fremde Werte schickt, bekommt dieselbe Absage wie bei einer fremden Sitzung.
    app.get("/api/klara/ai-status", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const bindung = bindungAus(request, user.id);
        const sessionId = kopf(request, SESSION_HEADER);
        if (!sessionId || !bindung.addinInstanceId || !bindung.documentContextId) {
          // Fail-safe und generisch: kein Hinweis darauf, WELCHE Zuordnung fehlt (S4-20 §133).
          throw new KlaraError(
            "NOT_FOUND",
            "Keine gültige Klara-Sitzungszuordnung für diese Anfrage.",
          );
        }
        reply.code(200).send(await dienst.statusFor(sessionId, bindung));
      } catch (error) {
        fehler(reply, error);
      }
    });

    // ------------------------------------------------------------------------------------------
    // POST /api/klara/sessions — Sitzung starten.
    // ------------------------------------------------------------------------------------------
    //
    // S4-20 §4: HIER wird autoritativ registriert. Der Client liefert `addinInstanceId` und einen
    // `documentDescriptor` — NICHT die fertige `documentContextId`. Die vergibt der Server und
    // liefert sie zurück; erst danach kann der Client sie in `x-klara-document` führen.
    app.post<{
      Body: { addinInstanceId?: string; documentDescriptor?: KlaraDocumentDescriptor };
    }>("/api/klara/sessions", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const body = request.body ?? {};
        // Die Instanz darf auch aus dem Header kommen — derselbe Wert, zwei Transportwege.
        const instanz = (body.addinInstanceId ?? "").trim() || kopf(request, INSTANCE_HEADER);
        const descriptor = body.documentDescriptor;
        if (!descriptor) {
          throw new KlaraError("BAD_REQUEST", "documentDescriptor ist erforderlich.");
        }
        const sicht = await dienst.createSession(user.id, instanz, descriptor);
        reply.code(201).send(sicht);
      } catch (error) {
        fehler(reply, error);
      }
    });

    // ------------------------------------------------------------------------------------------
    // POST /api/klara/sessions/{sessionId}/document-context — der Rebind aus S4-20 §5
    // ------------------------------------------------------------------------------------------
    //
    // Ein temporärer Dokumentkontext, der gespeichert wird, ist ein ANDERER Kontext. Kein stilles
    // Umschreiben: die alte Resolution wird entwertet und eine bestehende Zustimmung verworfen.
    app.post<{
      Params: { sessionId: string };
      Body: { documentDescriptor?: KlaraDocumentDescriptor };
    }>("/api/klara/sessions/:sessionId/document-context", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const descriptor = request.body?.documentDescriptor;
        if (!descriptor) {
          throw new KlaraError("BAD_REQUEST", "documentDescriptor ist erforderlich.");
        }
        const sicht = await dienst.rebindDocumentContext(
          request.params.sessionId,
          bindungAus(request, user.id),
          descriptor,
        );
        reply.code(200).send(sicht);
      } catch (error) {
        fehler(reply, error);
      }
    });

    // ------------------------------------------------------------------------------------------
    // GET /api/klara/sessions/{sessionId}
    // ------------------------------------------------------------------------------------------
    app.get<{ Params: { sessionId: string } }>(
      "/api/klara/sessions/:sessionId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const sicht = await dienst.getSession(
            request.params.sessionId,
            bindungAus(request, user.id),
          );
          reply.code(200).send(sicht);
        } catch (error) {
          fehler(reply, error);
        }
      },
    );

    // ------------------------------------------------------------------------------------------
    // POST /api/klara/sessions/{sessionId}/consent — nur für externe KI.
    // ------------------------------------------------------------------------------------------
    app.post<{ Params: { sessionId: string } }>(
      "/api/klara/sessions/:sessionId/consent",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const sicht = await dienst.grantConsent(
            request.params.sessionId,
            bindungAus(request, user.id),
          );
          reply.code(200).send(sicht);
        } catch (error) {
          fehler(reply, error);
        }
      },
    );

    // ------------------------------------------------------------------------------------------
    // DELETE /api/klara/sessions/{sessionId}/consent — Widerruf, sofort wirksam.
    // ------------------------------------------------------------------------------------------
    app.delete<{ Params: { sessionId: string } }>(
      "/api/klara/sessions/:sessionId/consent",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const sicht = await dienst.revokeConsent(
            request.params.sessionId,
            bindungAus(request, user.id),
          );
          reply.code(200).send(sicht);
        } catch (error) {
          fehler(reply, error);
        }
      },
    );

    // ------------------------------------------------------------------------------------------
    // POST /api/klara/sessions/{sessionId}/close
    // ------------------------------------------------------------------------------------------
    app.post<{ Params: { sessionId: string } }>(
      "/api/klara/sessions/:sessionId/close",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        try {
          const sicht: KlaraSessionView = await dienst.closeSession(
            request.params.sessionId,
            bindungAus(request, user.id),
          );
          reply.code(200).send(sicht);
        } catch (error) {
          fehler(reply, error);
        }
      },
    );
  };
}

// Re-Export für die Kompositionswurzel, damit sie den Fehlertyp nicht aus dem Dienst importieren
// muss, um ihn zu kennen.
export { KlaraError };
