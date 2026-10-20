import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { AuthService } from "../../../auth";
import type { CaptureService, Draft } from "../../../capture";
import type { ObjectStore } from "../../../object-store";
import { can } from "../../../rbac";
import {
  EMAIL_ANGENOMMEN,
  EmailEingangFehler,
  emailAlsEntwurf,
  ladeEmailEingang,
} from "../email-eingang";
import { sendError } from "../http";

export { EMAIL_ANGENOMMEN } from "../email-eingang";

/** Bestehender Original-/Ankerweg, kein aus Mailheadern geglaubter Dokumentverweis. */
async function originalBinden(
  deps: { capture: CaptureService; objects: ObjectStore },
  draft: Draft,
  fingerprint: string,
  original: string,
): Promise<void> {
  const key = `email-${fingerprint}`;
  if (draft.payload.anchorDocuments?.some((a) => a.key === key)) return;
  const istMailquelle = (s: NonNullable<Draft["payload"]["pendingSources"]>[number]) =>
    s.sourceProvider === "Organisations-E-Mail" && s.excerpt?.endsWith(fingerprint);
  if (!draft.payload.pendingSources?.some(istMailquelle)) {
    throw Object.assign(new Error("Die Herkunft des wartenden Entwurfs wurde geändert."), {
      code: "CONFLICT",
    });
  }
  const ref = await deps.objects.put({
    name: "weitergeleitete-email.json",
    mime: "application/json",
    kind: "document",
    purpose: "anchor",
    owner: draft.originalAuthor,
    draftId: draft.id,
    data: `data:application/json;base64,${Buffer.from(original, "utf8").toString("base64")}`,
  });
  try {
    await deps.capture.continueDraft(
      draft.id,
      {
        anchorDocuments: [
          ...(draft.payload.anchorDocuments ?? []),
          { key, objectId: ref.id, name: ref.name, mime: ref.mime },
        ],
        pendingSources: draft.payload.pendingSources.map((s) =>
          istMailquelle(s) ? { ...s, anchorKey: key, objectId: ref.id } : s,
        ),
      },
      draft.originalAuthor,
      { expectedUpdatedAt: draft.updatedAt },
    );
  } catch (error) {
    // Nur ein bestätigter Standkonflikt beweist, dass dieser Schreibversuch nicht wirkte.
    // Bei ungewissem Speicherausgang das Original erhalten und den Fehler weitergeben.
    if (error && typeof error === "object" && "code" in error && error.code === "DRAFT_STALE") {
      const aktuell = await deps.capture.getDraft(draft.id);
      if (!aktuell?.payload.anchorDocuments?.some((a) => a.objectId === ref.id)) {
        await deps.objects.delete(ref.id);
      }
      if (aktuell?.payload.anchorDocuments?.some((a) => a.key === key)) return;
    }
    throw error;
  }
}

export function emailEingangRoutes(deps: {
  capture: CaptureService;
  objects: ObjectStore;
  auth: Pick<AuthService, "kontoLesen">;
  audit: Pick<AuditService, "list" | "recordOnce">;
}): FastifyPluginAsync {
  const eingang = ladeEmailEingang();
  return async (app) => {
    app.post(
      "/api/eingang/email",
      {
        bodyLimit: 1024 * 1024,
        // Der globale Dienstzugang prüft Schlüssel, Capability und Bremse zuerst. Dieses Tor liegt
        // ebenfalls VOR dem Bodyparser; ein Personenlogin öffnet keine Mailadapter-Schnittstelle.
        onRequest: async (request, reply) => {
          const auth = request.authContext;
          if (auth?.authKind !== "addon" || !auth.principal.dienst) {
            return reply.code(401).send({ error: "UNAUTHENTICATED" });
          }
          if (!eingang) return reply.code(503).send({ error: "EMAIL_NICHT_KONFIGURIERT" });
          if (
            auth.principal.dienst.schluessel !== eingang.dienstId ||
            !auth.principal.capabilities.includes("mail.entwurf")
          ) {
            return reply.code(403).send({ error: "FORBIDDEN" });
          }
        },
      },
      async (request, reply) => {
        if (!eingang) return; // onRequest hat bereits geantwortet.
        try {
          // Konto bei JEDEM Eingang neu lesen; Kopfzeilen können weder Eigentümer noch Rolle setzen.
          const owner = await deps.auth.kontoLesen(eingang.eigentuemerId);
          const ablauf =
            owner?.accessExpiresAt === undefined ? null : Date.parse(owner.accessExpiresAt);
          if (
            !owner?.approved ||
            !can(owner.role, "ko.create") ||
            (ablauf !== null && (!Number.isFinite(ablauf) || ablauf <= Date.now()))
          ) {
            return reply.code(503).send({ error: "EMAIL_ZUSTAENDIGKEIT_FEHLT" });
          }
          const { payload, vorgang, fingerprint, original } = emailAlsEntwurf(
            request.body,
            eingang,
          );
          const vorbel = (await deps.audit.list({ action: EMAIL_ANGENOMMEN, target: vorgang }))[0];
          if (vorbel) {
            if (vorbel.payload.fingerprint !== fingerprint) {
              return reply.code(409).send({ error: "IDEMPOTENCY_PAYLOAD_MISMATCH" });
            }
            // Annahmebeleg bleibt auch nach Einreichen/Löschen erhalten; kein Wiederanlegen.
            return reply.code(200).send({ entwurfId: vorbel.payload.entwurfId, neu: false });
          }
          const { draft, angelegt } = await deps.capture.createDraftVorgang(
            payload,
            owner.id,
            vorgang,
          );
          await originalBinden(deps, draft, fingerprint, original);
          await deps.audit.recordOnce(vorgang, {
            actor: request.authContext?.principal?.id ?? "",
            action: EMAIL_ANGENOMMEN,
            target: vorgang,
            payload: { entwurfId: draft.id, fingerprint },
          });
          return reply.code(angelegt ? 201 : 200).send({ entwurfId: draft.id, neu: angelegt });
        } catch (error) {
          if (error instanceof EmailEingangFehler) {
            return reply
              .code(error.code === "EMAIL_ANHAENGE" ? 422 : 400)
              .send({ error: error.code });
          }
          sendError(reply, error);
        }
      },
    );
  };
}
