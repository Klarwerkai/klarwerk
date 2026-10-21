// ================================================================================================
// AW03-K02 · DER QUELLINHALT EINER VERWENDETEN QUELLREVISION — LESBAR UNTER DEN RECHTEN DES OBJEKTS.
// ================================================================================================
//
// Ben (Nacharbeit 13): Die gespeicherte Objektfassung war lesbar, der tatsächlich verwendete
// Quellabschnitt einer importierten Seite nicht. Am Anker standen nur Kennung, Quellfassung und
// Revision, und der einzige Verweis öffnete den HEUTIGEN Stand der Quelle.
//
// WAS ES SCHON GAB, OHNE ZWEITE ABLAGE: Jede übernommene Quellfassung schreibt VOR jeder Mutation
// ihre unveränderliche Revision (`quellrevisionFestschreiben`) und IM SELBEN Schritt ihren Inhalt
// samt Anker mit dieser Revision in eine neue Objektfassung (Erstanlage bzw. `revise` im Re-Sync).
// Die ERSTE Objektfassung, deren Anker diese `sourceRecordId` trägt, hält deshalb genau den Inhalt,
// den KLARWERK aus dieser Quellfassung übernommen hat. Die Revision trägt den Inhaltsabdruck über
// Titel, Kernaussage und Volltext (`quellinhaltAbdruck`) — damit wird geprüft, ob er WÖRTLICH stimmt.
//
// DREI ERGEBNISSE, ausdrücklich unterschieden (`abgleich`):
//   · `bestaetigt`         — der Abdruck der Fassung gleicht dem der Revision: wörtlich der Quellinhalt;
//   · `abweichend`         — die Fassung trägt den übernommenen Inhalt, aber nicht wörtlich (z. B. nach
//                            der serverseitigen HTML-Bereinigung); er wird mit diesem Vermerk gezeigt;
//   · `revision_unbekannt` — die Revision selbst ist nicht (mehr) auffindbar; der Inhalt der Fassung
//                            steht da, ein Abgleich ist nicht möglich.
// Trägt keine Fassung des Objekts diese Revision, ist die Antwort 404: über ein Objekt wird nur der
// Inhalt SEINER Quellrevisionen gelesen, nie der einer fremden.
//
// RECHTE: `ko.read` VOR jedem Zugriff, dann `darfSehen` am lebenden Objekt (Stufe, Autor,
// Quellrechte) — dieselbe Regel und derselbe nichtssagende 404 wie `GET /api/kos/:id/versions`.
import type { FastifyPluginAsync } from "fastify";
import type { KoService } from "../../../knowledge-object";
import { type ExternalSourceRepo, quellinhaltAbdruck } from "../../../library-analytics";
import { type Guards, sendError } from "../http";
import { darfSehen } from "../sichtbarkeit";

export interface QuellrevisionRoutesDeps {
  readonly ko: KoService;
  readonly externalSources: ExternalSourceRepo;
  readonly guards: Guards;
}

const NICHT_GEFUNDEN = { error: "NOT_FOUND", message: "Nicht gefunden." };

export type QuellinhaltAbgleich = "bestaetigt" | "abweichend" | "revision_unbekannt";

export function quellrevisionRoutes(deps: QuellrevisionRoutesDeps): FastifyPluginAsync {
  const { ko, externalSources, guards } = deps;
  return async (app) => {
    app.get<{ Params: { id: string; sourceRecordId: string } }>(
      "/api/kos/:id/quellrevisionen/:sourceRecordId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return reply;
        }
        try {
          const { id, sourceRecordId } = request.params;
          const objekt = await ko.get(id);
          if (!objekt || !darfSehen(user, objekt)) {
            reply.code(404).send(NICHT_GEFUNDEN);
            return reply;
          }
          const fassungen = [...(await ko.versionsOf(id))].sort((a, b) => a.version - b.version);
          const uebernahme = fassungen.find((f) =>
            (f.snapshot.sources ?? []).some(
              (s) => s.sourceRecordId === sourceRecordId && s.attachmentOf === undefined,
            ),
          );
          if (!uebernahme) {
            reply.code(404).send(NICHT_GEFUNDEN);
            return reply;
          }
          const inhalt = {
            title: uebernahme.snapshot.title,
            statement: uebernahme.snapshot.statement,
            bodyHtml: uebernahme.snapshot.bodyHtml ?? null,
          };
          const revision = await externalSources.findById(sourceRecordId);
          const abgleich: QuellinhaltAbgleich = !revision
            ? "revision_unbekannt"
            : quellinhaltAbdruck({
                  title: inhalt.title,
                  statement: inhalt.statement,
                  ...(inhalt.bodyHtml === null ? {} : { bodyHtml: inhalt.bodyHtml }),
                  type: uebernahme.snapshot.type,
                  category: uebernahme.snapshot.category,
                }) === revision.contentHash
              ? "bestaetigt"
              : "abweichend";
          reply.code(200).send({
            sourceRecordId,
            quelle: revision
              ? {
                  sourceSystem: revision.sourceSystem,
                  externalId: revision.externalId,
                  sourceVersion: revision.sourceVersion,
                  title: revision.title,
                  url: revision.url,
                  importedAt: revision.importedAt,
                }
              : null,
            uebernommenInFassung: uebernahme.version,
            uebernommenAm: uebernahme.at,
            inhalt,
            abgleich,
          });
          return reply;
        } catch (error) {
          sendError(reply, error);
          return reply;
        }
      },
    );
  };
}
