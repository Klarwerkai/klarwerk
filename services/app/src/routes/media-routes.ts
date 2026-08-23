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
  };
}
