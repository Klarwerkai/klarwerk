import type { FastifyPluginAsync } from "fastify";
import { isValidConfidentiality } from "../../../knowledge-object";
import { MediaAnalysisError, type MediaAnalysisService } from "../../../media";
import type { ObjectRef, ObjectStore } from "../../../object-store";
import type { Guards, SessionUser } from "../http";
import {
  type AnhangQuellen,
  type AnhangUrteil,
  type SichtbarkeitsFakten,
  beurteileAnhang,
} from "../sichtbarkeit";

// SCRUM-382: Video-/Audio-Analyse (Transkript) für die Erfassung. Der Schlüssel des
// Transkriptions-Dienstes bleibt serverseitig; der Client erhält nur Ergebnis + ehrlichen Status.
export function mediaRoutes(
  media: MediaAnalysisService,
  guards: Guards,
  objects: ObjectStore,
  quellen: AnhangQuellen,
): FastifyPluginAsync {
  // JOB 2021 (G8): Die Torwache dieser Datei — wortgleich zu object-routes.ts:162, weil sie
  // DENSELBEN Speicher bewacht. Sie beantwortet „darf dieser Mensch diesen Anhang sehen"
  // ausschliesslich über das Prädikat aus Block A; keine zweite Auslegung hier.
  async function urteile(
    user: SessionUser,
    objectId: string,
    ref: ObjectRef,
  ): Promise<AnhangUrteil> {
    const eigen: SichtbarkeitsFakten = {
      confidentiality: isValidConfidentiality(ref.confidentiality) ? ref.confidentiality : null,
      author: ref.lifecycle?.owner ?? null,
    };
    // mega76 A: ein Aufrufer, den der Compiler nicht sieht, bekommt ein NEIN — nicht ein Ja.
    if (typeof quellen?.kos !== "function") {
      return { sichtbar: false, vertraulich: true };
    }
    return beurteileAnhang(user, objectId, eigen, quellen);
  }

  return async (app) => {
    app.get("/api/media/status", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(media.engineInfo());
    });

    app.post<{
      Body: { objectId?: string; locale?: "de" | "en"; confidentiality?: string };
    }>("/api/media/analyze", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const objectId = request.body?.objectId ?? "";
      const locale = request.body?.locale === "en" ? "en" : "de";
      // JOB 2021 (G8): DIE SICHTBARKEIT WIRD HIER GEPRÜFT — der Dienst kann es nicht.
      //
      // `media.analyze()` nimmt keinen Betrachter entgegen (media/src/service.ts:87). Es kennt nur
      // die STUFE des Objekts und verhindert damit den externen Egress des INHALTS
      // (service.ts:119) — die Frage „darf DIESER Mensch DIESES Objekt sehen" stellt es nie.
      //
      // Ohne die Prüfung hier unterschied dieselbe Route für einen Unbefugten drei Fälle:
      // 404 (gibt es nicht), 400 UNSUPPORTED_KIND (gibt es, ist kein Video), 200 mit
      // Vertraulichkeitshinweis (gibt es, ist ein vertrauliches Video). Damit war die Route ein
      // Existenzorakel — genau das, was object-routes.ts:247 benennt und was die beiden
      // Schwesterrouten auf DENSELBEN Speicher (object-routes.ts:249 und :271) mit einem
      // ununterscheidbaren 404 verhindern. Rumpf und Status sind deshalb wortgleich zu ihnen,
      // und sie stehen VOR jeder Auskunft des Dienstes.
      const obj = await objects.read(objectId);
      if (!obj || !(await urteile(user, objectId, obj.ref)).sichtbar) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      // SCRUM-521 (WP1): Die Vertraulichkeit wird NICHT mehr aus dem Request bestimmt. Der Service
      // liest sie serverseitig aus dem gespeicherten Objekt; `request.body.confidentiality` wird nur
      // als optionale HOCHSTUFUNG (restriktiver) durchgereicht — eine Herabstufung ist unmöglich.
      try {
        reply.code(200).send(await media.analyze(objectId, locale, request.body?.confidentiality));
      } catch (err) {
        if (err instanceof MediaAnalysisError) {
          const status =
            err.code === "NOT_FOUND" ? 404 : err.code === "UNSUPPORTED_KIND" ? 400 : 502;
          reply.code(status).send({ error: err.code, message: err.message });
          return;
        }
        throw err;
      }
    });

    // Aufnahme gesamt-sprachassistent · R-0104: eine Sprachaufnahme aus Erfassen oder Fragen wird
    // mit DERSELBEN Transkription verschriftlicht (`media.transcribeRecording`, dort begründet).
    // Kein Objektbezug, also kein Existenzorakel und kein Zeilenrecht; die Aufnahme wird nicht
    // gespeichert. `ko.read` wie `analyze`: auch wer nur fragt, darf seine Frage sprechen. Der
    // Anmelderiegel läuft VOR dem Einlesen des Rumpfs, wie an `POST /api/objects`.
    const anmeldungVorDemEinlesen = async (
      request: Parameters<Guards["requireUser"]>[0],
      reply: Parameters<Guards["requireUser"]>[1],
    ): Promise<void> => {
      await guards.requireUser(request, reply);
    };
    app.post<{
      Body: { data?: string; locale?: "de" | "en"; confidentiality?: string };
    }>(
      "/api/media/transcribe",
      { bodyLimit: SPRACHAUFNAHME_BODY_LIMIT, onRequest: anmeldungVorDemEinlesen },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const data = typeof request.body?.data === "string" ? request.body.data : "";
        if (!data) {
          reply.code(400).send({ error: "BAD_REQUEST", message: "Keine Aufnahme übermittelt." });
          return;
        }
        const locale = request.body?.locale === "en" ? "en" : "de";
        const roh = request.body?.confidentiality;
        const stufe = typeof roh === "string" ? roh : undefined;
        try {
          const ergebnis = await media.transcribeRecording(data, locale, stufe);
          reply.code(200).send(ergebnis);
        } catch (err) {
          if (err instanceof MediaAnalysisError) {
            const status = err.code === "UNSUPPORTED_KIND" ? 400 : 502;
            reply.code(status).send({ error: err.code, message: err.message });
            return;
          }
          throw err;
        }
      },
    );
  };
}

/**
 * Rumpfgrenze der Sprachaufnahme: Base64 trägt ein Drittel mehr als die 20 MiB, die der Dienst
 * annimmt (`SPRACHAUFNAHME_MAX_BYTES` in `services/media/src/service.ts`), dazu Luft für den Rumpf.
 * Dass beide zusammenpassen, hält `tests/admin-ki-freigabe/sprachaufnahme-transkription.test.ts`
 * fest (T5).
 */
export const SPRACHAUFNAHME_BODY_LIMIT = 28 * 1024 * 1024;
